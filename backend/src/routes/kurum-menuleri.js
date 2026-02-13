/**
 * Kurum Menüleri Route
 *
 * Kurum tipine göre hazır menü şablonları yönetimi.
 * İhale maliyet hesabında referans menü olarak kullanılır.
 *
 * Tablolar: kurum_menuleri, kurum_menu_gunleri, kurum_menu_yemekleri
 * Lookup: kurum_tipleri, maliyet_seviyeleri
 */

import { Router } from 'express';
import { query } from '../database.js';
import logger from '../utils/logger.js';

const router = Router();

// ═══════════════════════════════════════════════════
// LOOKUP: Kurum Tipleri & Maliyet Seviyeleri
// ═══════════════════════════════════════════════════

/** GET /api/kurum-menuleri/kurum-tipleri */
router.get('/kurum-tipleri', async (_req, res) => {
  try {
    const result = await query(
      'SELECT id, kod, ad, ikon, aciklama FROM kurum_tipleri WHERE aktif = true ORDER BY sira'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Kurum Menüleri] Kurum tipleri getirme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/kurum-menuleri/maliyet-seviyeleri */
router.get('/maliyet-seviyeleri', async (_req, res) => {
  try {
    const result = await query('SELECT id, kod, ad, renk, aciklama FROM maliyet_seviyeleri ORDER BY sira');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Kurum Menüleri] Maliyet seviyeleri getirme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════
// CRUD: Kurum Menüleri
// ═══════════════════════════════════════════════════

/** GET /api/kurum-menuleri — Liste (view'dan) */
router.get('/', async (req, res) => {
  try {
    const { kurum_tipi, maliyet_seviyesi, durum, arama } = req.query;

    let sql = 'SELECT * FROM v_kurum_menu_ozet WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (kurum_tipi) {
      sql += ` AND kurum_tipi_kod = $${paramIdx++}`;
      params.push(kurum_tipi);
    }
    if (maliyet_seviyesi) {
      sql += ` AND maliyet_seviyesi_kod = $${paramIdx++}`;
      params.push(maliyet_seviyesi);
    }
    if (durum) {
      sql += ` AND durum = $${paramIdx++}`;
      params.push(durum);
    }
    if (arama) {
      sql += ` AND ad ILIKE $${paramIdx++}`;
      params.push(`%${arama}%`);
    }

    sql += ' ORDER BY favori DESC, updated_at DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    logger.error('[Kurum Menüleri] Liste hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/kurum-menuleri/:id — Detay (günler + yemekler dahil) */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Ana menü bilgisi
    const menuResult = await query('SELECT * FROM v_kurum_menu_ozet WHERE id = $1', [id]);
    if (menuResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menü bulunamadı' });
    }
    const menu = menuResult.rows[0];

    // Günler + yemekler
    const gunlerResult = await query(
      `SELECT g.id, g.gun_no, g.ogun_tipi_id, g.porsiyon_maliyet, g.notlar,
              ot.kod AS ogun_kod, ot.ad AS ogun_ad, ot.ikon AS ogun_ikon
       FROM kurum_menu_gunleri g
       JOIN ogun_tipleri ot ON ot.id = g.ogun_tipi_id
       WHERE g.kurum_menu_id = $1
       ORDER BY g.gun_no, ot.varsayilan_sira`,
      [id]
    );

    // Yemekler (reçete detayı dahil)
    const yemeklerResult = await query(
      `SELECT y.id, y.kurum_menu_gun_id, y.recete_id, y.yemek_adi, y.sira, y.porsiyon_maliyet,
              r.tahmini_maliyet AS recete_maliyet, r.kategori_id,
              rk.kod AS kategori_kod, rk.ad AS kategori_ad, rk.ikon AS kategori_ikon
       FROM kurum_menu_yemekleri y
       JOIN kurum_menu_gunleri g ON g.id = y.kurum_menu_gun_id
       LEFT JOIN receteler r ON r.id = y.recete_id
       LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
       WHERE g.kurum_menu_id = $1
       ORDER BY y.sira`,
      [id]
    );

    // Yemekleri günlere ata
    const gunlerMap = new Map();
    for (const gun of gunlerResult.rows) {
      gunlerMap.set(gun.id, { ...gun, yemekler: [] });
    }
    for (const yemek of yemeklerResult.rows) {
      const gun = gunlerMap.get(yemek.kurum_menu_gun_id);
      if (gun) gun.yemekler.push(yemek);
    }

    res.json({
      success: true,
      data: {
        ...menu,
        gunler: [...gunlerMap.values()],
      },
    });
  } catch (error) {
    logger.error('[Kurum Menüleri] Detay hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/kurum-menuleri — Yeni menü oluştur */
router.post('/', async (req, res) => {
  try {
    const {
      ad,
      kurum_tipi_id,
      maliyet_seviyesi_id,
      gun_sayisi = 15,
      ogun_yapisi = '3_ogun',
      kisi_sayisi = 500,
      aciklama,
      notlar,
      etiketler = [],
    } = req.body;

    if (!ad) {
      return res.status(400).json({ success: false, error: 'Menü adı gerekli' });
    }

    const result = await query(
      `INSERT INTO kurum_menuleri (ad, kurum_tipi_id, maliyet_seviyesi_id, gun_sayisi, ogun_yapisi, kisi_sayisi, aciklama, notlar, etiketler, olusturan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        ad,
        kurum_tipi_id,
        maliyet_seviyesi_id,
        gun_sayisi,
        ogun_yapisi,
        kisi_sayisi,
        aciklama,
        notlar,
        etiketler,
        req.user?.id || null,
      ]
    );

    res.json({ success: true, data: { id: result.rows[0].id }, message: 'Menü oluşturuldu' });
  } catch (error) {
    logger.error('[Kurum Menüleri] Oluşturma hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/** PUT /api/kurum-menuleri/:id — Menü güncelle */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ad,
      kurum_tipi_id,
      maliyet_seviyesi_id,
      gun_sayisi,
      ogun_yapisi,
      kisi_sayisi,
      aciklama,
      notlar,
      etiketler,
      durum,
      favori,
    } = req.body;

    const result = await query(
      `UPDATE kurum_menuleri SET
        ad = COALESCE($2, ad),
        kurum_tipi_id = COALESCE($3, kurum_tipi_id),
        maliyet_seviyesi_id = COALESCE($4, maliyet_seviyesi_id),
        gun_sayisi = COALESCE($5, gun_sayisi),
        ogun_yapisi = COALESCE($6, ogun_yapisi),
        kisi_sayisi = COALESCE($7, kisi_sayisi),
        aciklama = COALESCE($8, aciklama),
        notlar = COALESCE($9, notlar),
        etiketler = COALESCE($10, etiketler),
        durum = COALESCE($11, durum),
        favori = COALESCE($12, favori),
        updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [
        id,
        ad,
        kurum_tipi_id,
        maliyet_seviyesi_id,
        gun_sayisi,
        ogun_yapisi,
        kisi_sayisi,
        aciklama,
        notlar,
        etiketler,
        durum,
        favori,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menü bulunamadı' });
    }

    res.json({ success: true, message: 'Menü güncellendi' });
  } catch (error) {
    logger.error('[Kurum Menüleri] Güncelleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/** DELETE /api/kurum-menuleri/:id */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM kurum_menuleri WHERE id = $1', [id]);
    res.json({ success: true, message: 'Menü silindi' });
  } catch (error) {
    logger.error('[Kurum Menüleri] Silme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════
// TOPLU KAYDET: Günler + Yemekler tek seferde
// ═══════════════════════════════════════════════════

/**
 * POST /api/kurum-menuleri/:id/toplu-kaydet
 *
 * Body: { gunler: [{ gun_no, ogun_tipi_id, yemekler: [{ recete_id?, yemek_adi, sira }] }] }
 *
 * Mevcut günleri siler, yeniden oluşturur.
 * Reçetesi olan yemeklerin maliyetini otomatik çeker.
 */
router.post('/:id/toplu-kaydet', async (req, res) => {
  try {
    const { id } = req.params;
    const { gunler } = req.body;

    if (!gunler || !Array.isArray(gunler)) {
      return res.status(400).json({ success: false, error: 'gunler array gerekli' });
    }

    // Menü var mı?
    const menuCheck = await query('SELECT id FROM kurum_menuleri WHERE id = $1', [id]);
    if (menuCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menü bulunamadı' });
    }

    // Mevcut günleri temizle (cascade ile yemekler de silinir)
    await query('DELETE FROM kurum_menu_gunleri WHERE kurum_menu_id = $1', [id]);

    let toplamMaliyet = 0;
    let gunSayisi = 0;
    let yemekSayisi = 0;

    for (const gun of gunler) {
      const { gun_no, ogun_tipi_id, yemekler = [], notlar } = gun;
      if (!gun_no || !ogun_tipi_id) continue;

      // Gün oluştur
      const gunResult = await query(
        `INSERT INTO kurum_menu_gunleri (kurum_menu_id, gun_no, ogun_tipi_id, notlar)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [id, gun_no, ogun_tipi_id, notlar || null]
      );
      const gunId = gunResult.rows[0].id;
      gunSayisi++;

      let gunMaliyet = 0;

      for (const yemek of yemekler) {
        const { recete_id, yemek_adi, sira = 0 } = yemek;
        if (!yemek_adi) continue;

        // Reçete maliyetini çek
        let porsiyonMaliyet = 0;
        if (recete_id) {
          const receteResult = await query('SELECT tahmini_maliyet FROM receteler WHERE id = $1', [recete_id]);
          porsiyonMaliyet = Number(receteResult.rows[0]?.tahmini_maliyet) || 0;
        }

        await query(
          `INSERT INTO kurum_menu_yemekleri (kurum_menu_gun_id, recete_id, yemek_adi, sira, porsiyon_maliyet)
           VALUES ($1, $2, $3, $4, $5)`,
          [gunId, recete_id || null, yemek_adi, sira, porsiyonMaliyet]
        );

        gunMaliyet += porsiyonMaliyet;
        yemekSayisi++;
      }

      // Gün maliyetini güncelle
      await query('UPDATE kurum_menu_gunleri SET porsiyon_maliyet = $2 WHERE id = $1', [
        gunId,
        Math.round(gunMaliyet * 100) / 100,
      ]);
      toplamMaliyet += gunMaliyet;
    }

    // Menü maliyet özetini güncelle
    const benzersizGun = new Set(gunler.map((g) => g.gun_no)).size;
    const gunlukMaliyet = benzersizGun > 0 ? toplamMaliyet / benzersizGun : 0;
    const porsiyonMaliyetOrt = gunSayisi > 0 ? toplamMaliyet / gunSayisi : 0;

    await query(
      `UPDATE kurum_menuleri SET
        porsiyon_maliyet = $2,
        gunluk_maliyet = $3,
        toplam_maliyet = $4,
        updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        Math.round(porsiyonMaliyetOrt * 100) / 100,
        Math.round(gunlukMaliyet * 100) / 100,
        Math.round(toplamMaliyet * 100) / 100,
      ]
    );

    logger.info(`[Kurum Menüleri] Toplu kayıt: ${gunSayisi} öğün, ${yemekSayisi} yemek`, { menuId: id });

    res.json({
      success: true,
      data: {
        gun_sayisi: benzersizGun,
        ogun_sayisi: gunSayisi,
        yemek_sayisi: yemekSayisi,
        toplam_maliyet: Math.round(toplamMaliyet * 100) / 100,
      },
      message: 'Menü kaydedildi',
    });
  } catch (error) {
    logger.error('[Kurum Menüleri] Toplu kayıt hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════
// MALİYET YENİDEN HESAPLA
// ═══════════════════════════════════════════════════

/** POST /api/kurum-menuleri/:id/maliyet-hesapla */
router.post('/:id/maliyet-hesapla', async (req, res) => {
  try {
    const { id } = req.params;

    // Tüm yemeklerin reçete maliyetlerini güncelle
    await query(
      `UPDATE kurum_menu_yemekleri y
       SET porsiyon_maliyet = COALESCE(r.tahmini_maliyet, 0)
       FROM kurum_menu_gunleri g
       JOIN receteler r ON r.id = y.recete_id
       WHERE y.kurum_menu_gun_id = g.id
         AND g.kurum_menu_id = $1
         AND y.recete_id IS NOT NULL`,
      [id]
    );

    // Gün maliyetlerini güncelle
    await query(
      `UPDATE kurum_menu_gunleri g
       SET porsiyon_maliyet = COALESCE((
         SELECT SUM(y.porsiyon_maliyet)
         FROM kurum_menu_yemekleri y
         WHERE y.kurum_menu_gun_id = g.id
       ), 0)
       WHERE g.kurum_menu_id = $1`,
      [id]
    );

    // Menü toplam maliyetini güncelle
    const toplamResult = await query(
      `SELECT
         COALESCE(SUM(g.porsiyon_maliyet), 0) AS toplam,
         COUNT(DISTINCT g.gun_no) AS gun_sayisi,
         COUNT(*) AS ogun_sayisi
       FROM kurum_menu_gunleri g
       WHERE g.kurum_menu_id = $1`,
      [id]
    );

    const { toplam, gun_sayisi: gunSay, ogun_sayisi: ogunSay } = toplamResult.rows[0];
    const gunluk = gunSay > 0 ? Number(toplam) / Number(gunSay) : 0;
    const porsiyon = ogunSay > 0 ? Number(toplam) / Number(ogunSay) : 0;

    await query(
      `UPDATE kurum_menuleri SET
        porsiyon_maliyet = $2,
        gunluk_maliyet = $3,
        toplam_maliyet = $4,
        updated_at = NOW()
       WHERE id = $1`,
      [id, Math.round(porsiyon * 100) / 100, Math.round(gunluk * 100) / 100, Math.round(Number(toplam) * 100) / 100]
    );

    res.json({
      success: true,
      data: {
        toplam_maliyet: Math.round(Number(toplam) * 100) / 100,
        gunluk_maliyet: Math.round(gunluk * 100) / 100,
        porsiyon_maliyet: Math.round(porsiyon * 100) / 100,
      },
      message: 'Maliyet yeniden hesaplandı',
    });
  } catch (error) {
    logger.error('[Kurum Menüleri] Maliyet hesaplama hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════
// AI MENU OLUSTURMA — Çok Faktörlü Motor
// ═══════════════════════════════════════════════════

/**
 * POST /api/kurum-menuleri/ai-olustur
 *
 * 8 faktör dikkate alarak AI ile otomatik menü oluşturur:
 * 1. Kurum kuralları (preset)  5. Rotasyon
 * 2. Bütçe filtresi            6. Besin dengesi
 * 3. Mevsimsellik              7. Öğün yapısı
 * 4. Kategori dengesi          8. Hariç tutma
 */
router.post('/ai-olustur', async (req, res) => {
  try {
    const {
      kurum_tipi_kod,
      maliyet_seviyesi_kod = 'standart',
      gun_sayisi = 15,
      ogun_yapisi = '3_ogun',
      mevsim = 'auto',
      haric_tutma = [],
      ozel_istekler = '',
    } = req.body;

    if (!kurum_tipi_kod) {
      return res.status(400).json({ success: false, error: 'kurum_tipi_kod gerekli' });
    }

    // 1. Preset kurallarını yükle
    const presetResult = await query('SELECT preset_config FROM kurum_tipleri WHERE kod = $1', [kurum_tipi_kod]);
    const preset = presetResult.rows[0]?.preset_config || {};

    // 2. Reçeteleri çek (id, ad, kategori, maliyet, besin değerleri)
    const receteResult = await query(
      `SELECT r.id, r.ad, r.tahmini_maliyet, r.kalori, r.protein, r.karbonhidrat, r.yag,
              rk.kod AS kategori_kod, rk.ad AS kategori_ad, rk.ikon AS kategori_ikon
       FROM receteler r
       LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
       WHERE r.aktif = true
       ORDER BY rk.kod, r.ad`
    );
    const receteler = receteResult.rows;

    if (receteler.length === 0) {
      return res.json({ success: false, error: 'Hiç aktif reçete bulunamadı' });
    }

    // 3. Bütçe filtresi — maliyet limitine göre
    const maliyetLimitleri = preset.maliyet_limit_porsiyon || {};
    const porsiyonLimit = maliyetLimitleri[maliyet_seviyesi_kod] || 999;

    // 4. Mevsim bilgisi
    const mevsimStr = mevsim === 'auto' ? getCurrentSeason() : mevsim;

    // 5. AI'ya gönderilecek reçete kataloğu (kompakt format)
    const katalog = receteler.map((r) => ({
      id: r.id,
      ad: r.ad,
      kat: r.kategori_kod,
      fiyat: Number(r.tahmini_maliyet || 0),
      kcal: Number(r.kalori || 0),
    }));

    // 6. System prompt oluştur (3 katmanlı)
    const systemPrompt = buildMenuSystemPrompt(
      preset,
      maliyet_seviyesi_kod,
      porsiyonLimit,
      mevsimStr,
      gun_sayisi,
      ogun_yapisi,
      haric_tutma
    );

    // 7. Claude'a gönder
    const aiClient = new (await import('@anthropic-ai/sdk')).default({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const userMessage =
      `REÇETE KATALOĞU (${katalog.length} reçete):\n${JSON.stringify(katalog)}\n\n` +
      `GÜN SAYISI: ${gun_sayisi}\n` +
      `ÖĞÜN YAPISI: ${ogun_yapisi}\n` +
      `MEVSİM: ${mevsimStr}\n` +
      `BÜTÇE: ${maliyet_seviyesi_kod} (max ${porsiyonLimit} TL/öğün)\n` +
      (haric_tutma.length > 0 ? `HARİÇ TUTMA: ${haric_tutma.join(', ')}\n` : '') +
      (ozel_istekler ? `ÖZEL İSTEK: ${ozel_istekler}\n` : '') +
      `\nYukarıdaki katalogdan ${gun_sayisi} günlük menü oluştur. SADECE katalogdaki reçete id'lerini kullan.`;

    logger.info(`[Kurum Menüleri] AI menu oluşturma başladı`, {
      kurum_tipi_kod,
      gun_sayisi,
      recete_count: katalog.length,
    });

    const aiResponse = await aiClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // 8. AI yanıtını parse et
    const aiText = aiResponse.content[0]?.text || '{}';
    let menuData;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      menuData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      logger.warn('[Kurum Menüleri] AI JSON parse hatası', { text: aiText.slice(0, 300) });
      return res.json({ success: false, error: 'AI yanıtı parse edilemedi' });
    }

    // 9. Reçete detaylarını zenginleştir (fiyat, ikon ekle)
    const receteMap = new Map(receteler.map((r) => [r.id, r]));
    const gunler = (menuData.gunler || []).map((gun) => ({
      gun_no: gun.gun_no,
      ogunler: (gun.ogunler || []).map((ogun) => ({
        ogun_kod: ogun.ogun_kod,
        yemekler: (ogun.yemekler || []).map((y) => {
          const recete = receteMap.get(y.recete_id);
          return {
            recete_id: y.recete_id,
            ad: recete?.ad || y.ad || 'Bilinmeyen',
            fiyat: Number(recete?.tahmini_maliyet || 0),
            ikon: recete?.kategori_ikon || null,
          };
        }),
      })),
    }));

    logger.info(`[Kurum Menüleri] AI menu oluşturuldu`, {
      gun_count: gunler.length,
      tokens: { input: aiResponse.usage?.input_tokens, output: aiResponse.usage?.output_tokens },
    });

    return res.json({
      success: true,
      gunler,
      ozet: menuData.ozet || null,
      ai_tokens: {
        input: aiResponse.usage?.input_tokens || 0,
        output: aiResponse.usage?.output_tokens || 0,
      },
    });
  } catch (error) {
    logger.error('[Kurum Menüleri] AI menu oluşturma hatası', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Mevsim tespiti
 */
function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'ilkbahar';
  if (month >= 6 && month <= 8) return 'yaz';
  if (month >= 9 && month <= 11) return 'sonbahar';
  return 'kis';
}

/**
 * 3 katmanlı AI system prompt oluştur
 */
function buildMenuSystemPrompt(preset, maliyetSeviyesi, porsiyonLimit, mevsim, gunSayisi, ogunYapisi, haricTutma) {
  const ogunCesit = preset.ogun_cesit || {};
  const haftalikZorunlu = preset.haftalik_zorunlu || {};
  const rotasyon = preset.rotasyon || {};
  const kaloriHedef = preset.gunluk_kalori_hedef || { min: 2000, max: 2500 };

  return `Sen profesyonel bir toplu yemek üretim (catering) menü planlama uzmanısın. Türk mutfağında uzmanlaşmış, kurumsal beslenme standartlarını bilen bir diyetisyensin.

## GÖREV
Verilen reçete kataloğundan ${gunSayisi} günlük dengeli bir kurumsal menü oluştur. SADECE katalogdaki reçete id'lerini kullan, uydurma yapma.

## 8 FAKTÖR KURALLARI

### 1. KURUM KURALLARI
${preset.ozel_notlar || 'Standart kurumsal beslenme.'}
- Günlük kalori hedefi: ${kaloriHedef.min}-${kaloriHedef.max} kcal

### 2. BÜTÇE
- Maliyet seviyesi: ${maliyetSeviyesi}
- Maksimum öğün maliyeti: ${porsiyonLimit} TL
- Pahalı reçeteleri sınırla, bütçeye uygun olanları tercih et

### 3. MEVSİMSELLİK (${mevsim})
${
  mevsim === 'kis'
    ? '- Sıcak çorbalar ve etli yemekler ağırlıklı. Hafif salatalar azalt.'
    : mevsim === 'yaz'
      ? '- Hafif yemekler, salatalar ve soğuk çorbalar tercih et. Ağır etli yemekleri azalt.'
      : mevsim === 'ilkbahar'
        ? '- Taze sebze yemekleri öne çıkar. Dengeli et/sebze oranı.'
        : '- Geçiş mevsimi: Hem sıcak hem soğuk seçenekler dengeli.'
}

### 4. KATEGORİ DENGESİ (haftalık zorunlu minimumlar)
${Object.entries(haftalikZorunlu)
  .map(([k, v]) => `- ${k}: Haftada en az ${v} kez`)
  .join('\n')}

### 5. ROTASYON
${Object.entries(rotasyon)
  .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v} gün`)
  .join('\n')}
- Aynı yemek ardışık günlerde ASLA tekrarlanmasın
- Çorba çeşitleri mümkün olduğunca farklı olsun

### 6. BESİN DENGESİ
- Her günün toplam kalorisi ${kaloriHedef.min}-${kaloriHedef.max} kcal arasında olmalı
- Protein, karbonhidrat ve yağ dengesi gözetilmeli
- Her öğünde en az 1 sebze içeren yemek olmalı

### 7. ÖĞÜN YAPISI (${ogunYapisi})
${Object.entries(ogunCesit)
  .map(([ogun, kategoriler]) => `- ${ogun}: ${Array.isArray(kategoriler) ? kategoriler.join(' + ') : 'serbest'}`)
  .join('\n')}

### 8. HARİÇ TUTMA
${haricTutma.length > 0 ? haricTutma.map((h) => `- ${h} içeren reçeteleri KULLANMA`).join('\n') : '- Özel kısıtlama yok'}

## ÇIKTI FORMATI (JSON)
Yanıtını SADECE aşağıdaki JSON formatında ver, başka açıklama yazma:

{
  "gunler": [
    {
      "gun_no": 1,
      "ogunler": [
        {
          "ogun_kod": "kahvalti|ogle|aksam",
          "yemekler": [
            { "recete_id": <katalogdaki_id>, "ad": "<reçete_adı>" }
          ]
        }
      ]
    }
  ],
  "ozet": {
    "ortalama_gunluk_kalori": <sayı>,
    "ortalama_porsiyon_maliyet": <sayı>,
    "rotasyon_notu": "<kısa açıklama>"
  }
}

## ÖNEMLİ
- SADECE katalogdaki reçete id'lerini kullan
- Her gün için ${ogunYapisi === '2_ogun' ? 'öğle' : 'kahvaltı + öğle + akşam'} öğünlerini doldur
- Reçete id'si katalogda yoksa O REÇETEYİ KULLANMA
- Öğle: genellikle çorba + ana yemek + pilav/makarna + salata/tatlı + içecek
- Akşam: genellikle çorba + ana yemek + pilav/makarna + tatlı/salata + içecek`;
}

export default router;
