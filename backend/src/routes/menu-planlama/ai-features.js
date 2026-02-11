import express from 'express';
import { query } from '../../database.js';
import aiAgent from '../../services/ai-agent.js';

const router = express.Router();

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

export default router;
