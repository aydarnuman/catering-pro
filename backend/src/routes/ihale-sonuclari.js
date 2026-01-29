/**
 * @swagger
 * tags:
 *   name: İhale Sonuçları
 *   description: İhale açıklandıktan sonraki süreç yönetimi
 */

import express from 'express';
import { query } from '../database.js';
import { logAPI, logError } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/ihale-sonuclari:
 *   get:
 *     summary: Tüm ihale sonuçlarını listele
 *     tags: [İhale Sonuçları]
 */
router.get('/', async (req, res) => {
  try {
    const { durum, kurum, limit = 50, offset = 0 } = req.query;

    let sql = `
            SELECT 
                s.*,
                t.url as ihale_url,
                t.city as ihale_sehir,
                t.tender_date as ihale_tarihi_original,
                CASE 
                    WHEN s.kesinlesme_tarihi IS NOT NULL 
                    THEN (s.kesinlesme_tarihi + INTERVAL '10 days')::date
                    ELSE NULL 
                END as sikayet_son_tarih,
                CASE 
                    WHEN s.kesinlesme_tarihi IS NOT NULL 
                    THEN (s.kesinlesme_tarihi + INTERVAL '10 days')::date - CURRENT_DATE
                    ELSE NULL 
                END as kalan_gun
            FROM ihale_sonuclari s
            LEFT JOIN tenders t ON s.tender_id = t.id
            WHERE 1=1
        `;
    const params = [];
    let paramIndex = 1;

    if (durum) {
      sql += ` AND s.durum = $${paramIndex}`;
      params.push(durum);
      paramIndex++;
    }

    if (kurum) {
      sql += ` AND s.kurum ILIKE $${paramIndex}`;
      params.push(`%${kurum}%`);
      paramIndex++;
    }

    sql += ` ORDER BY s.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);

    // Toplam sayı
    let countSql = `SELECT COUNT(*) FROM ihale_sonuclari s WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;

    if (durum) {
      countSql += ` AND s.durum = $${countParamIndex}`;
      countParams.push(durum);
      countParamIndex++;
    }
    if (kurum) {
      countSql += ` AND s.kurum ILIKE $${countParamIndex}`;
      countParams.push(`%${kurum}%`);
    }

    const countResult = await query(countSql, countParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count, 10),
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (error) {
    logError('İhale Sonuçları Liste', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/istatistikler:
 *   get:
 *     summary: İhale sonuç istatistikleri
 *     tags: [İhale Sonuçları]
 */
router.get('/istatistikler', async (_req, res) => {
  try {
    const result = await query(`SELECT * FROM ihale_sonuc_istatistikleri`);

    // Ek: Son 30 gündeki aktivite
    const aktivite = await query(`
            SELECT 
                DATE(created_at) as tarih,
                COUNT(*) as sayi
            FROM ihale_sonuclari
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY tarih DESC
        `);

    res.json({
      success: true,
      data: {
        ozet: result.rows[0] || {},
        aktivite: aktivite.rows,
      },
    });
  } catch (error) {
    logError('İhale Sonuç İstatistik', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/aktif-surecler:
 *   get:
 *     summary: İtiraz süresi dolmamış aktif süreçler
 *     tags: [İhale Sonuçları]
 */
router.get('/aktif-surecler', async (_req, res) => {
  try {
    const result = await query(`SELECT * FROM aktif_ihale_surecleri`);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logError('Aktif Süreçler', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}:
 *   get:
 *     summary: Tek ihale sonucu getir
 *     tags: [İhale Sonuçları]
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
            SELECT 
                s.*,
                t.url as ihale_url,
                t.city as ihale_sehir,
                t.tender_date as ihale_tarihi_original,
                t.estimated_cost as ihale_yaklasik_maliyet,
                t.organization_name as ihale_kurum_original,
                CASE 
                    WHEN s.kesinlesme_tarihi IS NOT NULL 
                    THEN (s.kesinlesme_tarihi + INTERVAL '10 days')::date
                    ELSE NULL 
                END as sikayet_son_tarih,
                CASE 
                    WHEN s.kesinlesme_tarihi IS NOT NULL 
                    THEN (s.kesinlesme_tarihi + INTERVAL '10 days')::date - CURRENT_DATE
                    ELSE NULL 
                END as kalan_gun
            FROM ihale_sonuclari s
            LEFT JOIN tenders t ON s.tender_id = t.id
            WHERE s.id = $1
        `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logError('İhale Sonuç Detay', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari:
 *   post:
 *     summary: Yeni ihale sonucu ekle
 *     tags: [İhale Sonuçları]
 */
router.post('/', async (req, res) => {
  try {
    const {
      tender_id,
      ihale_basligi,
      kurum,
      ihale_kayit_no,
      ihale_turu,
      yaklasik_maliyet,
      sinir_deger,
      bizim_teklif,
      bizim_sira,
      diger_teklifler,
      ihale_tarihi,
      kesinlesme_tarihi,
      durum,
      notlar,
    } = req.body;

    // Validasyon
    if (!ihale_basligi || !kurum) {
      return res.status(400).json({
        success: false,
        error: 'İhale başlığı ve kurum zorunludur',
      });
    }

    const result = await query(
      `
            INSERT INTO ihale_sonuclari (
                tender_id, ihale_basligi, kurum, ihale_kayit_no, ihale_turu,
                yaklasik_maliyet, sinir_deger, bizim_teklif, bizim_sira,
                diger_teklifler, ihale_tarihi, kesinlesme_tarihi, durum, notlar
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, $12, $13, $14
            ) RETURNING *
        `,
      [
        tender_id || null,
        ihale_basligi,
        kurum,
        ihale_kayit_no || null,
        ihale_turu || 'hizmet',
        yaklasik_maliyet || null,
        sinir_deger || null,
        bizim_teklif || null,
        bizim_sira || null,
        JSON.stringify(diger_teklifler || []),
        ihale_tarihi || null,
        kesinlesme_tarihi || null,
        durum || 'beklemede',
        notlar || null,
      ]
    );

    logAPI('İhale Sonuç Eklendi', { id: result.rows[0].id, ihale_basligi });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'İhale sonucu başarıyla eklendi',
    });
  } catch (error) {
    logError('İhale Sonuç Ekle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}:
 *   put:
 *     summary: İhale sonucu güncelle
 *     tags: [İhale Sonuçları]
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ihale_basligi,
      kurum,
      ihale_kayit_no,
      ihale_turu,
      yaklasik_maliyet,
      sinir_deger,
      bizim_teklif,
      bizim_sira,
      diger_teklifler,
      ihale_tarihi,
      kesinlesme_tarihi,
      asiri_dusuk_sorgu_tarihi,
      asiri_dusuk_cevap_tarihi,
      itiraz_son_tarihi,
      durum,
      asiri_dusuk_aciklama_durumu,
      asiri_dusuk_aciklama_metni,
      hesaplamalar,
      belgeler,
      notlar,
    } = req.body;

    const result = await query(
      `
            UPDATE ihale_sonuclari SET
                ihale_basligi = COALESCE($1, ihale_basligi),
                kurum = COALESCE($2, kurum),
                ihale_kayit_no = $3,
                ihale_turu = COALESCE($4, ihale_turu),
                yaklasik_maliyet = $5,
                sinir_deger = $6,
                bizim_teklif = $7,
                bizim_sira = $8,
                diger_teklifler = COALESCE($9, diger_teklifler),
                ihale_tarihi = $10,
                kesinlesme_tarihi = $11,
                asiri_dusuk_sorgu_tarihi = $12,
                asiri_dusuk_cevap_tarihi = $13,
                itiraz_son_tarihi = $14,
                durum = COALESCE($15, durum),
                asiri_dusuk_aciklama_durumu = $16,
                asiri_dusuk_aciklama_metni = $17,
                hesaplamalar = COALESCE($18, hesaplamalar),
                belgeler = COALESCE($19, belgeler),
                notlar = $20
            WHERE id = $21
            RETURNING *
        `,
      [
        ihale_basligi,
        kurum,
        ihale_kayit_no,
        ihale_turu,
        yaklasik_maliyet,
        sinir_deger,
        bizim_teklif,
        bizim_sira,
        diger_teklifler ? JSON.stringify(diger_teklifler) : null,
        ihale_tarihi,
        kesinlesme_tarihi,
        asiri_dusuk_sorgu_tarihi,
        asiri_dusuk_cevap_tarihi,
        itiraz_son_tarihi,
        durum,
        asiri_dusuk_aciklama_durumu,
        asiri_dusuk_aciklama_metni,
        hesaplamalar ? JSON.stringify(hesaplamalar) : null,
        belgeler ? JSON.stringify(belgeler) : null,
        notlar,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    logAPI('İhale Sonuç Güncellendi', { id });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'İhale sonucu güncellendi',
    });
  } catch (error) {
    logError('İhale Sonuç Güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}/rakip-teklif:
 *   post:
 *     summary: Rakip teklif ekle
 *     tags: [İhale Sonuçları]
 */
router.post('/:id/rakip-teklif', async (req, res) => {
  try {
    const { id } = req.params;
    const { firma, teklif, sira, asiri_dusuk } = req.body;

    if (!firma || !teklif) {
      return res.status(400).json({
        success: false,
        error: 'Firma adı ve teklif tutarı zorunludur',
      });
    }

    // Mevcut teklifleri al
    const current = await query('SELECT diger_teklifler FROM ihale_sonuclari WHERE id = $1', [id]);

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    const teklifler = current.rows[0].diger_teklifler || [];
    teklifler.push({
      firma,
      teklif: parseFloat(teklif),
      sira: sira || teklifler.length + 1,
      asiri_dusuk: asiri_dusuk || false,
    });

    // Sıraya göre sırala
    teklifler.sort((a, b) => a.teklif - b.teklif);
    for (let i = 0; i < teklifler.length; i++) {
      teklifler[i].sira = i + 1;
    }

    const result = await query('UPDATE ihale_sonuclari SET diger_teklifler = $1 WHERE id = $2 RETURNING *', [
      JSON.stringify(teklifler),
      id,
    ]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Rakip teklif eklendi',
    });
  } catch (error) {
    logError('Rakip Teklif Ekle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}/rakip-teklif/{sira}:
 *   delete:
 *     summary: Rakip teklif sil
 *     tags: [İhale Sonuçları]
 */
router.delete('/:id/rakip-teklif/:sira', async (req, res) => {
  try {
    const { id, sira } = req.params;

    const current = await query('SELECT diger_teklifler FROM ihale_sonuclari WHERE id = $1', [id]);

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    let teklifler = current.rows[0].diger_teklifler || [];
    teklifler = teklifler.filter((t) => t.sira !== parseInt(sira, 10));

    // Sıraları yeniden düzenle
    teklifler.sort((a, b) => a.teklif - b.teklif);
    for (let i = 0; i < teklifler.length; i++) {
      teklifler[i].sira = i + 1;
    }

    const result = await query('UPDATE ihale_sonuclari SET diger_teklifler = $1 WHERE id = $2 RETURNING *', [
      JSON.stringify(teklifler),
      id,
    ]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Rakip teklif silindi',
    });
  } catch (error) {
    logError('Rakip Teklif Sil', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}/durum:
 *   patch:
 *     summary: Durum güncelle (Kazandık durumunda otomatik proje oluşturur)
 *     tags: [İhale Sonuçları]
 */
router.patch('/:id/durum', async (req, res) => {
  try {
    const { id } = req.params;
    const { durum, aciklama: _aciklama, otomatik_proje: _otomatik_proje = true } = req.body;

    const validDurumlar = [
      'beklemede',
      'asiri_dusuk_soruldu',
      'asiri_dusuk_cevaplandi',
      'kazandik',
      'elendik',
      'itiraz_edildi',
      'kik_basvurusu',
      'sonuclandi',
    ];

    if (!validDurumlar.includes(durum)) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz durum',
        validDurumlar,
      });
    }

    // Duruma göre ek alanları güncelle
    let extraUpdate = '';
    const params = [durum, id];

    if (durum === 'asiri_dusuk_soruldu') {
      extraUpdate = ', asiri_dusuk_sorgu_tarihi = NOW()';
    } else if (durum === 'asiri_dusuk_cevaplandi') {
      extraUpdate = ', asiri_dusuk_cevap_tarihi = NOW()';
    }

    const result = await query(
      `
            UPDATE ihale_sonuclari 
            SET durum = $1 ${extraUpdate}
            WHERE id = $2
            RETURNING *
        `,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    let projeOlusturuldu = null;

    // "Kazandık" durumuna geçince otomatik proje oluştur
    if (durum === 'kazandik' && otomatik_proje && !result.rows[0].proje_id) {
      try {
        const ihale = result.rows[0];

        // Merkezi projeler tablosuna yeni proje ekle
        const projeResult = await query(
          `
                    INSERT INTO projeler (
                        ad, kurum, tender_id, ihale_sonuc_id, 
                        sozlesme_bedeli, durum, notlar,
                        created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, 'aktif', $6, NOW()
                    ) RETURNING *
                `,
          [
            ihale.ihale_basligi,
            ihale.kurum,
            ihale.tender_id,
            ihale.id,
            ihale.bizim_teklif || ihale.yaklasik_maliyet,
            `İhale kazanıldı: ${ihale.ihale_kayit_no || ''}`,
          ]
        );

        // İhale sonucuna proje_id bağla
        await query('UPDATE ihale_sonuclari SET proje_id = $1 WHERE id = $2', [projeResult.rows[0].id, id]);

        projeOlusturuldu = projeResult.rows[0];
        logAPI('İhale Kazanıldı - Otomatik Proje Oluşturuldu', {
          ihale_id: id,
          proje_id: projeResult.rows[0].id,
        });
      } catch (projeError) {
        logError('Otomatik Proje Oluşturma Hatası', projeError);
        // Proje oluşturma hatası ana işlemi engellemez
      }
    }

    logAPI('İhale Sonuç Durum Değişti', { id, durum });

    res.json({
      success: true,
      data: result.rows[0],
      proje: projeOlusturuldu,
      message: projeOlusturuldu
        ? `Durum "${durum}" olarak güncellendi ve proje oluşturuldu`
        : `Durum "${durum}" olarak güncellendi`,
    });
  } catch (error) {
    logError('Durum Güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}/proje-olustur:
 *   post:
 *     summary: İhale sonucundan manuel proje oluştur (Ayarlar > Projeler'e ekler)
 *     tags: [İhale Sonuçları]
 */
router.post('/:id/proje-olustur', async (req, res) => {
  try {
    const { id } = req.params;
    const { firma_id, ek_bilgiler = {} } = req.body;

    // İhale sonucunu al
    const ihaleResult = await query('SELECT * FROM ihale_sonuclari WHERE id = $1', [id]);

    if (ihaleResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'İhale sonucu bulunamadı' });
    }

    const ihale = ihaleResult.rows[0];

    // Zaten proje var mı?
    if (ihale.proje_id) {
      const mevcutProje = await query('SELECT * FROM projeler WHERE id = $1', [ihale.proje_id]);
      return res.json({
        success: true,
        data: mevcutProje.rows[0],
        message: 'Bu ihale için zaten proje mevcut',
        existing: true,
      });
    }

    // Merkezi projeler tablosuna yeni proje oluştur
    const projeResult = await query(
      `
            INSERT INTO projeler (
                ad, kurum, firma_id, tender_id, ihale_sonuc_id,
                sozlesme_bedeli, proje_tipi, durum, notlar,
                yetkili_adi, yetkili_telefon, yetkili_email,
                created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, 'aktif', $8, $9, $10, $11, NOW()
            ) RETURNING *
        `,
      [
        ek_bilgiler.ad || ihale.ihale_basligi,
        ihale.kurum,
        firma_id || null,
        ihale.tender_id,
        ihale.id,
        ek_bilgiler.sozlesme_bedeli || ihale.bizim_teklif || ihale.yaklasik_maliyet,
        ek_bilgiler.proje_tipi || 'ihale',
        `İhaleden oluşturuldu - IKN: ${ihale.ihale_kayit_no || 'Belirtilmemiş'}`,
        ek_bilgiler.yetkili_adi || null,
        ek_bilgiler.yetkili_telefon || null,
        ek_bilgiler.yetkili_email || null,
      ]
    );

    // İhale sonucuna proje_id bağla
    await query('UPDATE ihale_sonuclari SET proje_id = $1 WHERE id = $2', [projeResult.rows[0].id, id]);

    logAPI('İhaleden Proje Oluşturuldu', {
      ihale_sonuc_id: id,
      proje_id: projeResult.rows[0].id,
    });

    res.status(201).json({
      success: true,
      data: projeResult.rows[0],
      message: "Proje başarıyla oluşturuldu ve Ayarlar > Projeler'e eklendi",
    });
  } catch (error) {
    logError('İhaleden Proje Oluştur', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}/proje:
 *   get:
 *     summary: İhale sonucuna bağlı projeyi getir
 *     tags: [İhale Sonuçları]
 */
router.get('/:id/proje', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
            SELECT p.*, f.unvan as firma_unvani, f.kisa_ad as firma_kisa_ad
            FROM projeler p
            LEFT JOIN firmalar f ON p.firma_id = f.id
            WHERE p.ihale_sonuc_id = $1
        `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bu ihale için proje bulunamadı',
        hint: 'Proje oluşturmak için POST /api/ihale-sonuclari/:id/proje-olustur kullanın',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logError('İhale Proje Getir', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}/hesaplama-kaydet:
 *   post:
 *     summary: Hesaplama sonuçlarını kaydet
 *     tags: [İhale Sonuçları]
 */
router.post('/:id/hesaplama-kaydet', async (req, res) => {
  try {
    const { id } = req.params;
    const { tip, sonuc } = req.body;

    // Mevcut hesaplamaları al
    const current = await query('SELECT hesaplamalar FROM ihale_sonuclari WHERE id = $1', [id]);

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    const hesaplamalar = current.rows[0].hesaplamalar || {};
    hesaplamalar[tip] = {
      ...sonuc,
      hesaplanan_tarih: new Date().toISOString(),
    };

    const result = await query('UPDATE ihale_sonuclari SET hesaplamalar = $1 WHERE id = $2 RETURNING *', [
      JSON.stringify(hesaplamalar),
      id,
    ]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Hesaplama kaydedildi',
    });
  } catch (error) {
    logError('Hesaplama Kaydet', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}/ai-sohbet:
 *   post:
 *     summary: AI sohbet geçmişine mesaj ekle
 *     tags: [İhale Sonuçları]
 */
router.post('/:id/ai-sohbet', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, content } = req.body;

    const current = await query('SELECT ai_sohbet_gecmisi FROM ihale_sonuclari WHERE id = $1', [id]);

    if (current.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    const sohbet = current.rows[0].ai_sohbet_gecmisi || [];
    sohbet.push({
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Son 50 mesajı tut
    const sonSohbet = sohbet.slice(-50);

    const result = await query('UPDATE ihale_sonuclari SET ai_sohbet_gecmisi = $1 WHERE id = $2 RETURNING *', [
      JSON.stringify(sonSohbet),
      id,
    ]);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logError('AI Sohbet Kaydet', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/{id}:
 *   delete:
 *     summary: İhale sonucu sil
 *     tags: [İhale Sonuçları]
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM ihale_sonuclari WHERE id = $1 RETURNING id, ihale_basligi', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }

    logAPI('İhale Sonuç Silindi', { id, ihale_basligi: result.rows[0].ihale_basligi });

    res.json({
      success: true,
      message: 'İhale sonucu silindi',
    });
  } catch (error) {
    logError('İhale Sonuç Sil', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/ihale-sonuclari/tracking-aktar/{tenderId}:
 *   post:
 *     summary: Tracking'den ihale sonuçlarına aktar
 *     tags: [İhale Sonuçları]
 */
router.post('/tracking-aktar/:tenderId', async (req, res) => {
  try {
    const { tenderId } = req.params;

    // Tender bilgilerini al
    const tender = await query('SELECT * FROM tenders WHERE id = $1', [tenderId]);

    if (tender.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'İhale bulunamadı' });
    }

    const t = tender.rows[0];

    // Zaten var mı kontrol et
    const existing = await query('SELECT id FROM ihale_sonuclari WHERE tender_id = $1', [tenderId]);

    if (existing.rowCount > 0) {
      return res.json({
        success: true,
        data: { id: existing.rows[0].id },
        message: 'Bu ihale zaten sonuçlar listesinde',
        existing: true,
      });
    }

    // Yeni kayıt oluştur
    const result = await query(
      `
            INSERT INTO ihale_sonuclari (
                tender_id, ihale_basligi, kurum, ihale_kayit_no,
                yaklasik_maliyet, ihale_tarihi, durum
            ) VALUES ($1, $2, $3, $4, $5, $6, 'beklemede')
            RETURNING *
        `,
      [tenderId, t.title, t.organization_name, t.ikn, t.estimated_cost, t.tender_date]
    );

    logAPI("Tracking'den İhale Sonuçlarına Aktarıldı", { tenderId, id: result.rows[0].id });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'İhale sonuçlarına aktarıldı',
    });
  } catch (error) {
    logError('Tracking Aktar', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
