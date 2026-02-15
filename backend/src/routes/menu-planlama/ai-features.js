import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { getProfilKurallari, SUPPORTED_PROFILES } from '../../data/sartname-gramaj-sablonlari.js';
import { query } from '../../database.js';
import aiAgent from '../../services/ai-agent.js';

// Basit Claude çağrısı (processQuery'nin context ağırlığından kaçınmak için)
async function simpleClaudeCall(prompt, { maxTokens = 4000, temperature = 0.1 } = {}) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0]?.text || '';
}

const router = express.Router();

/** Şablon (asistan üretimi) gramaj kurallarını şartnameye uygular; eklenen/atlanan döner. */
async function applyProfilKurallari(sartnameId, altTipler, mevcutSet, profil) {
  const aiKurallar = getProfilKurallari(profil);
  let eklenen = 0;
  let atlanan = 0;
  const eklenenKurallar = [];
  const set = new Set(mevcutSet);

  for (const altTipGrup of aiKurallar) {
    const altTip = altTipler.find((t) => t.kod === altTipGrup.alt_tip_kod);
    if (!altTip) continue;
    for (const kural of altTipGrup.kurallar || []) {
      const key = `${altTip.id}:${kural.malzeme_tipi}`;
      if (set.has(key)) {
        atlanan++;
        continue;
      }
      try {
        const result = await query(
          `
          INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira)
          VALUES ($1, $2, $3, $4, $5,
            (SELECT COALESCE(MAX(sira), 0) + 1 FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND alt_tip_id = $2))
          ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING
          RETURNING *
        `,
          [sartnameId, altTip.id, kural.malzeme_tipi, kural.gramaj, kural.birim || 'g']
        );
        if (result.rows.length > 0) {
          eklenen++;
          set.add(key);
          eklenenKurallar.push({
            alt_tip: altTip.ad,
            malzeme_tipi: kural.malzeme_tipi,
            gramaj: kural.gramaj,
            birim: kural.birim || 'g',
          });
        }
      } catch {
        atlanan++;
      }
    }
  }
  return { eklenen, atlanan, toplam_alt_tip: aiKurallar.length, kurallar: eklenenKurallar };
}

// AI ile reçete malzeme önerisi (Ürün Kartları kullanır)
router.post('/receteler/:id/ai-malzeme-oneri', async (req, res) => {
  try {
    const { id } = req.params;

    // Reçete bilgilerini getir
    const receteResult = await query(
      `
      SELECT r.*, k.ad as kategori_adi
      FROM receteler r
      LEFT JOIN recete_kategoriler k ON k.id = r.kategori_id
      WHERE r.id = $1
    `,
      [id]
    );

    if (receteResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }

    const recete = receteResult.rows[0];

    // Ürün kartlarını getir (AI eşleştirme için - temiz isimler!)
    const urunKartlariResult = await query(`
      SELECT
        uk.id,
        uk.ad,
        uk.varsayilan_birim as birim,
        uk.fiyat_birimi,
        kat.ad as kategori,
        COALESCE(uk.manuel_fiyat, uk.aktif_fiyat, uk.son_alis_fiyati) as fiyat
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE uk.aktif = true
      ORDER BY kat.sira, uk.ad
    `);

    const urunKartlari = urunKartlariResult.rows.map((uk) => ({
      id: uk.id,
      ad: uk.ad,
      birim: uk.birim || 'gr',
      kategori: uk.kategori,
      fiyat: parseFloat(uk.fiyat) || 0,
    }));

    // Kategorilere göre grupla (AI için daha anlaşılır)
    const kategoriliUrunler = {};
    urunKartlari.forEach((uk) => {
      const kat = uk.kategori || 'Diğer';
      if (!kategoriliUrunler[kat]) kategoriliUrunler[kat] = [];
      kategoriliUrunler[kat].push(uk.ad);
    });

    const urunListesi = Object.entries(kategoriliUrunler)
      .map(([kat, urunler]) => `${kat}: ${urunler.join(', ')}`)
      .join('\n');

    // AI'dan malzeme önerisi iste
    const prompt = `
Sen bir yemek reçetesi uzmanısın. Aşağıdaki yemek için standart Türk mutfağı tarifine göre malzeme listesi ve gramajları öner.

Yemek Adı: ${recete.ad}
Kategori: ${recete.kategori_adi || 'Genel'}

Lütfen bu yemek için gerekli malzemeleri, standart bir porsiyon (yaklaşık 300-400 gr) için gramajlarıyla birlikte listele.

Mevcut Ürün Kartları (öncelikle bunlardan seç):
${urunListesi}

Format (JSON):
\`\`\`json
{
  "malzemeler": [
    {
      "malzeme_adi": "Ürün adı",
      "miktar": 100,
      "birim": "gr",
      "kategori": "Sebzeler"
    }
  ]
}
\`\`\`

Kurallar:
- Birim: gr, kg, ml, lt, adet
- Miktarlar gerçekçi ve 1 porsiyon için olmalı
- Öncelikle yukarıdaki listeden SEÇ (örn: "Kuru Fasulye", "Soğan", "Domates")
- LİSTEDE YOKSA yeni ürün öner ve kategori belirt (Et & Tavuk, Sebzeler, Baharatlar, vb.)
- Kategori seçenekleri: Et & Tavuk, Balık & Deniz Ürünleri, Süt Ürünleri, Sebzeler, Meyveler, Bakliyat, Tahıllar & Makarna, Yağlar, Baharatlar, Soslar & Salçalar, Şekerler & Tatlandırıcılar, İçecekler, Diğer
    `.trim();

    const aiResult = await aiAgent.processQuery(prompt, [], {
      maxTokens: 2000,
      temperature: 0.3,
    });

    // AI'dan gelen JSON'u parse et
    let malzemeler = [];
    try {
      const jsonMatch = aiResult.response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        malzemeler = JSON.parse(jsonMatch[1]).malzemeler || [];
      } else {
        // JSON olmadan direkt array olarak da deneyelim
        const arrayMatch = aiResult.response.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          malzemeler = JSON.parse(arrayMatch[0]);
        }
      }
    } catch (_parseError) {
      return res.status(500).json({
        success: false,
        error: 'AI yanıtı parse edilemedi',
        raw_response: aiResult.response,
      });
    }

    // Ürün kartı eşleştirmesi yap
    const malzemelerWithUrun = malzemeler.map((mal) => {
      const malLower = mal.malzeme_adi.toLowerCase().trim();

      // Önce birebir eşleşme ara
      let match = urunKartlari.find((uk) => uk.ad.toLowerCase().trim() === malLower);

      // Bulamazsa fuzzy match dene
      if (!match) {
        match = urunKartlari.find((uk) => {
          const ukLower = uk.ad.toLowerCase().trim();
          return (
            ukLower.includes(malLower) ||
            malLower.includes(ukLower) ||
            ukLower.replace(/\s+/g, '') === malLower.replace(/\s+/g, '')
          );
        });
      }

      return {
        ...mal,
        urun_kart_id: match ? match.id : null,
        onerilen_urun_adi: match ? match.ad : null,
        birim: mal.birim || (match ? match.birim : 'gr'),
      };
    });

    res.json({
      success: true,
      data: {
        recete_id: parseInt(id, 10),
        recete_adi: recete.ad,
        malzemeler: malzemelerWithUrun,
        ai_response: aiResult.response,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TOPLU AI REÇETE ÖNERİSİ (BATCH - 5 REÇETE BİRDEN)
// =====================================================

router.post('/receteler/batch-ai-malzeme-oneri', async (req, res) => {
  try {
    const { recete_ids } = req.body;

    if (!recete_ids || !Array.isArray(recete_ids) || recete_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'recete_ids gerekli (array)' });
    }

    // Max 3 reçete bir seferde (timeout önlemek için)
    const idsToProcess = recete_ids.slice(0, 3);

    // Reçete bilgilerini getir
    const receteResult = await query(
      `
      SELECT r.id, r.ad, k.ad as kategori_adi
      FROM receteler r
      LEFT JOIN recete_kategoriler k ON k.id = r.kategori_id
      WHERE r.id = ANY($1::int[])
    `,
      [idsToProcess]
    );

    if (receteResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçeteler bulunamadı' });
    }

    const receteler = receteResult.rows;

    // Ürün kartlarını getir
    const urunKartlariResult = await query(`
      SELECT
        uk.id,
        uk.ad,
        uk.varsayilan_birim as birim,
        kat.ad as kategori
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE uk.aktif = true
      ORDER BY kat.sira, uk.ad
    `);

    const urunKartlari = urunKartlariResult.rows;

    // Kategorilere göre grupla
    const kategoriliUrunler = {};
    urunKartlari.forEach((uk) => {
      const kat = uk.kategori || 'Diğer';
      if (!kategoriliUrunler[kat]) kategoriliUrunler[kat] = [];
      kategoriliUrunler[kat].push(uk.ad);
    });

    const urunListesi = Object.entries(kategoriliUrunler)
      .map(([kat, urunler]) => `${kat}: ${urunler.join(', ')}`)
      .join('\n');

    // Yemek listesi oluştur
    const yemekListesi = receteler.map((r) => `- ${r.ad} (${r.kategori_adi || 'Genel'})`).join('\n');

    // TEK AI ÇAĞRISI ile TÜM REÇETELER
    const prompt = `
Sen bir yemek reçetesi uzmanısın. Aşağıdaki ${receteler.length} yemek için standart Türk mutfağı tariflerine göre malzeme listesi ve gramajları öner.

YEMEKLER:
${yemekListesi}

Lütfen HER yemek için ayrı ayrı malzeme listesi ver. Standart bir porsiyon (300-400 gr) için gramajlar kullan.

MEVCUT ÜRÜN KARTLARI (öncelikle bunlardan seç):
${urunListesi}

FORMAT (JSON - HER YEMEK İÇİN AYRI):
\`\`\`json
{
  "sonuclar": [
    {
      "recete_id": ${receteler[0]?.id || 0},
      "recete_adi": "${receteler[0]?.ad || ''}",
      "malzemeler": [
        {"malzeme_adi": "Ürün adı", "miktar": 100, "birim": "gr", "kategori": "Sebzeler"}
      ]
    }
  ]
}
\`\`\`

KURALLAR:
- Birim: gr, kg, ml, lt, adet
- Miktarlar gerçekçi ve 1 porsiyon için olmalı
- Öncelikle mevcut ürün kartlarından SEÇ
- Listede yoksa yeni ürün öner ve kategori belirt
- Kategoriler: Et & Tavuk, Balık & Deniz Ürünleri, Süt Ürünleri, Sebzeler, Meyveler, Bakliyat, Tahıllar & Makarna, Yağlar, Baharatlar, Soslar & Salçalar, Şekerler & Tatlandırıcılar, İçecekler, Diğer
    `.trim();

    const aiResult = await aiAgent.processQuery(prompt, [], {
      maxTokens: 8000,
      temperature: 0.3,
    });

    // Parse AI response
    let sonuclar = [];
    try {
      const jsonMatch = aiResult.response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        sonuclar = parsed.sonuclar || [];
      }
    } catch (_parseError) {
      return res.status(500).json({
        success: false,
        error: 'AI yanıtı parse edilemedi',
        raw_response: aiResult.response,
      });
    }

    // Ürün kartı eşleştirmesi yap
    const enrichedSonuclar = sonuclar.map((s) => {
      const malzemelerWithUrun = (s.malzemeler || []).map((mal) => {
        const malLower = mal.malzeme_adi.toLowerCase().trim();

        let match = urunKartlari.find((uk) => uk.ad.toLowerCase().trim() === malLower);

        if (!match) {
          match = urunKartlari.find((uk) => {
            const ukLower = uk.ad.toLowerCase().trim();
            return ukLower.includes(malLower) || malLower.includes(ukLower);
          });
        }

        return {
          ...mal,
          urun_kart_id: match ? match.id : null,
          birim: mal.birim || (match ? match.birim : 'gr'),
        };
      });

      return {
        ...s,
        malzemeler: malzemelerWithUrun,
      };
    });

    res.json({
      success: true,
      data: {
        sonuclar: enrichedSonuclar,
        toplam: enrichedSonuclar.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// AI ALT TİP ÖNERİSİ
// Reçete adı + malzeme listesine göre en uygun alt tipi öner
// =============================================

// Tek reçete için AI alt tip önerisi
router.post('/receteler/:id/ai-alt-tip-oneri', async (req, res) => {
  try {
    const { id } = req.params;

    // Reçete + malzemeleri al
    const receteResult = await query(
      `
      SELECT r.*, rk.ad as kategori_adi
      FROM receteler r
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE r.id = $1
    `,
      [id]
    );

    if (receteResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }

    const recete = receteResult.rows[0];

    const malzemeResult = await query(
      'SELECT malzeme_adi, miktar, birim FROM recete_malzemeler WHERE recete_id = $1 ORDER BY sira',
      [id]
    );

    // Alt tipleri al (reçetenin kategorisine göre filtreli)
    const altTiplerResult = await query(
      `
      SELECT att.kod, att.ad, att.aciklama
      FROM alt_tip_tanimlari att
      WHERE att.aktif = true
        AND (att.kategori_id = $1 OR att.kategori_id IS NULL)
      ORDER BY att.sira
    `,
      [recete.kategori_id]
    );

    const altTipler = altTiplerResult.rows;

    if (altTipler.length === 0) {
      return res.json({
        success: true,
        data: { oneri: null, mesaj: 'Bu kategori için alt tip tanımlanmamış' },
      });
    }

    // AI prompt oluştur
    const malzemeListesi = malzemeResult.rows.map((m) => `${m.malzeme_adi} (${m.miktar}${m.birim})`).join(', ');

    const altTipListesi = altTipler.map((t) => `- ${t.kod}: ${t.ad} — ${t.aciklama}`).join('\n');

    const prompt = `Sen bir yemek sınıflandırma uzmanısın. Verilen reçeteyi en uygun alt tipe eşleştir.

Reçete: "${recete.ad}"
Kategori: ${recete.kategori_adi || 'Bilinmiyor'}
Malzemeler: ${malzemeListesi || 'Malzeme bilgisi yok'}

Mevcut alt tipler:
${altTipListesi}

Sadece en uygun alt tipin KOD'unu döndür (örn: "parcali_et_kemiksiz"). Başka açıklama ekleme.`;

    // AI çağrısı
    const aiResponse = await simpleClaudeCall(prompt, { maxTokens: 50, temperature: 0 });
    const onerilen = aiResponse?.trim()?.replace(/['"]/g, '') || null;

    // Önerilen kodun geçerli olup olmadığını kontrol et
    const gecerliAltTip = altTipler.find((t) => t.kod === onerilen);

    res.json({
      success: true,
      data: {
        recete_id: recete.id,
        recete_adi: recete.ad,
        oneri: gecerliAltTip ? onerilen : null,
        oneri_adi: gecerliAltTip?.ad || null,
        gecerli: !!gecerliAltTip,
        tum_secenekler: altTipler,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu AI alt tip önerisi
router.post('/receteler/ai-toplu-alt-tip-oneri', async (req, res) => {
  try {
    const { recete_ids, alt_tipsiz = false } = req.body;

    // Hedef reçeteleri bul
    let receteQuery = `
      SELECT r.id, r.ad, r.kategori_id, rk.ad as kategori_adi, r.alt_tip_id
      FROM receteler r
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE r.aktif = true
    `;
    const params = [];

    if (recete_ids?.length) {
      receteQuery += ' AND r.id = ANY($1)';
      params.push(recete_ids);
    } else if (alt_tipsiz) {
      receteQuery += ' AND r.alt_tip_id IS NULL';
    } else {
      return res.status(400).json({ success: false, error: 'recete_ids veya alt_tipsiz parametresi gerekli' });
    }

    receteQuery += ' ORDER BY r.ad LIMIT 50';

    const recetelerResult = await query(receteQuery, params);
    const receteler = recetelerResult.rows;

    if (receteler.length === 0) {
      return res.json({ success: true, data: { oneriler: [], mesaj: 'Önerilecek reçete bulunamadı' } });
    }

    // Tüm alt tipleri al
    const altTiplerResult = await query(
      'SELECT id, kod, ad, kategori_id, aciklama FROM alt_tip_tanimlari WHERE aktif = true ORDER BY sira'
    );
    const tumAltTipler = altTiplerResult.rows;

    // Her reçete için malzemeler ve AI önerisi
    const oneriler = [];

    for (const recete of receteler) {
      const malzemeResult = await query(
        'SELECT malzeme_adi FROM recete_malzemeler WHERE recete_id = $1 ORDER BY sira',
        [recete.id]
      );

      const uygunAltTipler = tumAltTipler.filter((t) => t.kategori_id === recete.kategori_id || t.kategori_id === null);

      if (uygunAltTipler.length === 0) {
        oneriler.push({
          recete_id: recete.id,
          recete_adi: recete.ad,
          kategori: recete.kategori_adi,
          oneri: null,
          oneri_adi: null,
          mesaj: 'Bu kategori için alt tip yok',
        });
        continue;
      }

      const malzemeListesi = malzemeResult.rows.map((m) => m.malzeme_adi).join(', ');
      const altTipListesi = uygunAltTipler.map((t) => `${t.kod}: ${t.ad}`).join(', ');

      const prompt = `Yemek: "${recete.ad}" (${recete.kategori_adi || '?'})
Malzemeler: ${malzemeListesi || 'bilgi yok'}
Alt tipler: ${altTipListesi}
En uygun alt tip kodu? Sadece kodu yaz.`;

      try {
        const aiResponse = await simpleClaudeCall(prompt, { maxTokens: 30, temperature: 0 });
        const onerilen = aiResponse?.trim()?.replace(/['"]/g, '') || null;
        const gecerli = uygunAltTipler.find((t) => t.kod === onerilen);

        oneriler.push({
          recete_id: recete.id,
          recete_adi: recete.ad,
          kategori: recete.kategori_adi,
          mevcut_alt_tip_id: recete.alt_tip_id,
          oneri: gecerli ? onerilen : null,
          oneri_id: gecerli?.id || null,
          oneri_adi: gecerli?.ad || null,
        });
      } catch {
        oneriler.push({
          recete_id: recete.id,
          recete_adi: recete.ad,
          kategori: recete.kategori_adi,
          oneri: null,
          oneri_adi: null,
          mesaj: 'AI çağrısı başarısız',
        });
      }
    }

    res.json({
      success: true,
      data: {
        oneriler,
        toplam: oneriler.length,
        basarili: oneriler.filter((o) => o.oneri).length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu alt tip uygulama (önerileri kabul et)
router.post('/receteler/toplu-alt-tip-uygula', async (req, res) => {
  try {
    const { atamalar } = req.body; // [{ recete_id, alt_tip_kod }]

    if (!atamalar?.length) {
      return res.status(400).json({ success: false, error: 'Atama listesi boş' });
    }

    let basarili = 0;

    for (const atama of atamalar) {
      const result = await query(
        `
        UPDATE receteler
        SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = $1)
        WHERE id = $2 AND aktif = true
      `,
        [atama.alt_tip_kod, atama.recete_id]
      );
      if (result.rowCount > 0) basarili++;
    }

    res.json({
      success: true,
      data: { basarili, toplam: atamalar.length },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// AI GRAMAJ KURALI ÖNERİSİ
// Şartname için tüm alt tiplerin gramaj kurallarını AI ile oluştur
// =============================================

router.post('/sartname/:sartnameId/ai-gramaj-olustur', async (req, res) => {
  try {
    const { sartnameId } = req.params;
    const { alt_tip_ids, profil } = req.body; // profil: 'kyk_yurt', 'premium', 'kopyala:4' vb.

    // KOPYALAMA MODU: "kopyala:SARTNAME_ID" formatında
    if (profil?.startsWith('kopyala:')) {
      const kaynakId = profil.split(':')[1];
      const kaynakKurallar = await query(
        'SELECT alt_tip_id, malzeme_tipi, gramaj, birim, aciklama, sira FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true',
        [kaynakId]
      );

      if (kaynakKurallar.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Kaynak şartnamede kural bulunamadı' });
      }

      // Mevcut kuralları kontrol et
      const mevcutKurallar = await query(
        'SELECT alt_tip_id, malzeme_tipi FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true',
        [sartnameId]
      );
      const mevcutSet = new Set(mevcutKurallar.rows.map((k) => `${k.alt_tip_id}:${k.malzeme_tipi}`));

      let eklenen = 0;
      let atlanan = 0;

      for (const kural of kaynakKurallar.rows) {
        const key = `${kural.alt_tip_id}:${kural.malzeme_tipi}`;
        if (mevcutSet.has(key)) {
          atlanan++;
          continue;
        }

        try {
          await query(
            `INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, aciklama, sira)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING`,
            [sartnameId, kural.alt_tip_id, kural.malzeme_tipi, kural.gramaj, kural.birim, kural.aciklama, kural.sira]
          );
          eklenen++;
        } catch {
          atlanan++;
        }
      }

      return res.json({
        success: true,
        data: { eklenen, atlanan, toplam_alt_tip: 0, kurallar: [] },
      });
    }

    // Şartname bilgisi
    const sartnameResult = await query(
      `
      SELECT ps.*, sk.ad as kurum_adi
      FROM proje_sartnameleri ps
      LEFT JOIN sartname_kurumlari sk ON sk.id = ps.kurum_id
      WHERE ps.id = $1
    `,
      [sartnameId]
    );

    if (sartnameResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Şartname bulunamadı' });
    }

    const sartname = sartnameResult.rows[0];

    // Alt tipleri al
    let altTipQuery = 'SELECT * FROM alt_tip_tanimlari WHERE aktif = true';
    const altTipParams = [];

    if (alt_tip_ids?.length) {
      altTipQuery += ' AND id = ANY($1)';
      altTipParams.push(alt_tip_ids);
    }

    altTipQuery += ' ORDER BY kategori_id, sira';
    const altTiplerResult = await query(altTipQuery, altTipParams);
    const altTipler = altTiplerResult.rows;

    // Mevcut kuralları al (çakışma kontrolü için)
    const mevcutKurallar = await query(
      'SELECT alt_tip_id, malzeme_tipi FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true',
      [sartnameId]
    );
    const mevcutSet = new Set(mevcutKurallar.rows.map((k) => `${k.alt_tip_id}:${k.malzeme_tipi}`));

    // Asistan (AI) tarafından üretilmiş şablon kurallar — Claude API kullanmadan
    if (profil && SUPPORTED_PROFILES.includes(profil)) {
      const data = await applyProfilKurallari(sartnameId, altTipler, mevcutSet, profil);
      return res.json({ success: true, data });
    }

    // Malzeme eşleme sözlüğündeki malzeme tiplerini al (AI'a referans)
    const malzemeTipleri = await query('SELECT malzeme_tipi FROM malzeme_tip_eslesmeleri WHERE aktif = true');
    const malzemeTipListesi = malzemeTipleri.rows.map((m) => m.malzeme_tipi).join(', ');

    // Alt tipleri grupla (AI'a daha verimli gönder - tek çağrı)
    const altTipListesi = altTipler.map((t) => `- ${t.kod} (${t.ad}): ${t.aciklama || ''}`).join('\n');

    // Profil bazlı porsiyon yönergesi
    const profilYonergeleri = {
      kyk_yurt: 'KYK yurt standartları: Standart öğrenci porsiyonu. Orta gramajlar.',
      hastane: 'Hastane standartları: Düşük yağ, kontrollü kalori, diyet uyumlu. Standarttan %10-15 düşük gramajlar.',
      okul: 'MEB okul yemeği: Çocuk/genç porsiyonu. Standarttan %15-20 düşük gramajlar.',
      kurumsal: 'Kurumsal yemekhane: Standart yetişkin porsiyon. Orta gramajlar.',
      premium: 'Premium/restoran kalitesi: Büyük porsiyon, kaliteli malzeme. Standarttan %20-30 yüksek gramajlar.',
      agir_is: 'Ağır iş/asker porsiyonu: Büyük porsiyon, yüksek kalori. Standarttan %30-50 yüksek gramajlar.',
      diyet: 'Diyet/sağlık odaklı: Düşük kalorili, az yağlı, hafif porsiyonlar. Standarttan %20-30 düşük gramajlar.',
    };

    const profilYonergesi =
      profil && profilYonergeleri[profil] ? profilYonergeleri[profil] : 'Standart kurumsal toplu yemek gramajları.';

    const prompt = `Sen Türk toplu yemek (catering) sektöründe gramaj şartnamesi uzmanısın.

GÖREV: "${sartname.ad}" şartnamesi için gramaj kuralları oluştur.

KURUM BİLGİSİ:
- Şartname: ${sartname.ad}
- Bağlı kurum: ${sartname.kurum_adi || 'Özel/Genel'}
${sartname.notlar ? `- Kurum notu: ${sartname.notlar}` : ''}

PORSİYON PROFİLİ: ${profilYonergesi}

Bu kurumun yemek hizmeti verdiği kişiler için yukarıdaki porsiyon profiline uygun gramajlar belirle.
Örneğin "${sartname.ad}" kurumsal yemekhane profiliyle seçildiyse, bu kurumun çalışanları/hizmet alanları için standart yetişkin porsiyonları uygula.

Aşağıdaki yemek alt tipleri için 1 porsiyon (1 kişilik) gramaj kurallarını belirle:

${altTipListesi}

Kullanabileceğin malzeme tipleri (SADECE bunlardan seç, yeni tip UYDURMA):
${malzemeTipListesi}

KURALLAR:
- Porsiyon profiline uygun gramajlar belirle
- Her alt tip için 2-5 arası ana malzeme belirle
- Sadece şartnamelerde belirtilen ana malzemeleri yaz (baharat, tuz gibi detayları atla)
- Malzeme tiplerini AYNEN kullan, büyük/küçük harf dahil

JSON formatında döndür:
[
  { "alt_tip_kod": "parcali_et_kemiksiz", "kurallar": [
    { "malzeme_tipi": "Çiğ et", "gramaj": 150, "birim": "g" },
    { "malzeme_tipi": "Sıvı yağ", "gramaj": 15, "birim": "ml" }
  ]},
  ...
]

Sadece JSON döndür, açıklama ekleme.`;

    const aiResponse = await simpleClaudeCall(prompt, { maxTokens: 4000, temperature: 0.1 });

    // AI yanıtını parse et
    let aiKurallar = [];
    try {
      const jsonStr = aiResponse
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .trim();
      aiKurallar = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({
        success: false,
        error: 'AI yanıtı parse edilemedi',
        raw: (aiResponse || '').slice(0, 500),
      });
    }

    // Kuralları DB'ye ekle
    let eklenen = 0;
    let atlanan = 0;
    const eklenenKurallar = [];

    for (const altTipGrup of aiKurallar) {
      const altTip = altTipler.find((t) => t.kod === altTipGrup.alt_tip_kod);
      if (!altTip) continue;

      for (const kural of altTipGrup.kurallar || []) {
        const key = `${altTip.id}:${kural.malzeme_tipi}`;

        if (mevcutSet.has(key)) {
          atlanan++;
          continue;
        }

        try {
          const result = await query(
            `
            INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira)
            VALUES ($1, $2, $3, $4, $5, 
              (SELECT COALESCE(MAX(sira), 0) + 1 FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND alt_tip_id = $2))
            ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING
            RETURNING *
          `,
            [sartnameId, altTip.id, kural.malzeme_tipi, kural.gramaj, kural.birim || 'g']
          );

          if (result.rows.length > 0) {
            eklenen++;
            eklenenKurallar.push({
              alt_tip: altTip.ad,
              malzeme_tipi: kural.malzeme_tipi,
              gramaj: kural.gramaj,
              birim: kural.birim || 'g',
            });
          }
        } catch {
          atlanan++;
        }
      }
    }

    res.json({
      success: true,
      data: {
        eklenen,
        atlanan,
        toplam_alt_tip: aiKurallar.length,
        kurallar: eklenenKurallar,
      },
    });
  } catch (error) {
    console.error('[ai-gramaj-olustur] HATA:', error.message, error.stack?.split('\n').slice(0, 3).join('\n'));
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
