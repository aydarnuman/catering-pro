import express from 'express';
import { query } from '../database.js';
import {
  guncelleOgunMaliyet,
  guncellePlanMaliyet,
  hesaplaReceteMaliyet,
} from '../services/maliyet-hesaplama-service.js';
import aiFeaturesRouter from './menu-planlama/ai-features.js';
import menuImportRouter from './menu-planlama/menu-import.js';
// Sub-router'lar
import recetelerRouter from './menu-planlama/receteler.js';
import sartnamelerRouter from './menu-planlama/sartnameler.js';
import urunKartlariRouter from './menu-planlama/urun-kartlari.js';

const router = express.Router();

// =============================================
// SUB-ROUTER MOUNT
// =============================================
router.use(recetelerRouter);
router.use(sartnamelerRouter);
router.use(urunKartlariRouter);
router.use(menuImportRouter);
router.use(aiFeaturesRouter);

// =============================================
// PROJE ÖĞÜN ŞABLONLARI
// =============================================

// Öğün tiplerini listele
router.get('/ogun-tipleri', async (_req, res) => {
  try {
    const result = await query(`
      SELECT * FROM ogun_tipleri
      WHERE aktif = true
      ORDER BY varsayilan_sira
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Projeleri listele
router.get('/projeler', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.ad,
        p.kod,
        p.aciklama,
        p.baslangic_tarihi,
        p.bitis_tarihi,
        p.aktif,
        p.created_at,
        p.updated_at
      FROM projeler p
      WHERE p.aktif = true
      ORDER BY p.ad
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tüm menü planlarını listele (kaydedilen menüler için)
router.get('/menu-planlari', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        mp.id,
        mp.proje_id,
        mp.ad,
        mp.baslangic_tarihi,
        mp.bitis_tarihi,
        mp.durum,
        mp.notlar,
        mp.created_at,
        mp.updated_at,
        p.ad as proje_adi
      FROM menu_planlari mp
      LEFT JOIN projeler p ON p.id = mp.proje_id
      ORDER BY mp.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje öğün şablonlarını getir
router.get('/projeler/:projeId/ogun-sablonlari', async (req, res) => {
  try {
    const { projeId } = req.params;

    const result = await query(
      `
      SELECT
        pos.*,
        ot.ad as ogun_tip_adi,
        ot.ikon as ogun_ikon
      FROM proje_ogun_sablonlari pos
      JOIN ogun_tipleri ot ON ot.id = pos.ogun_tipi_id
      WHERE pos.proje_id = $1 AND pos.aktif = true
      ORDER BY pos.sira, ot.varsayilan_sira
    `,
      [projeId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje öğün şablonu ekle/güncelle
router.post('/projeler/:projeId/ogun-sablonlari', async (req, res) => {
  try {
    const { projeId } = req.params;
    const { ogun_tipi_id, cesit_sayisi, kisi_sayisi, tip, ogun_adi } = req.body;

    const result = await query(
      `
      INSERT INTO proje_ogun_sablonlari (
        proje_id, ogun_tipi_id, cesit_sayisi, kisi_sayisi, tip, ogun_adi, sira
      ) VALUES ($1, $2, $3, $4, $5, $6,
        (SELECT COALESCE(MAX(sira), 0) + 1 FROM proje_ogun_sablonlari WHERE proje_id = $1)
      )
      ON CONFLICT (proje_id, ogun_tipi_id)
      DO UPDATE SET
        cesit_sayisi = EXCLUDED.cesit_sayisi,
        kisi_sayisi = EXCLUDED.kisi_sayisi,
        tip = EXCLUDED.tip,
        ogun_adi = EXCLUDED.ogun_adi,
        updated_at = NOW()
      RETURNING *
    `,
      [projeId, ogun_tipi_id, cesit_sayisi || 4, kisi_sayisi || 1000, tip || 'tabldot', ogun_adi]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// MENÜ PLANLARI
// =============================================

// Proje menü planlarını listele
router.get('/projeler/:projeId/menu-planlari', async (req, res) => {
  try {
    const { projeId } = req.params;

    const result = await query(
      `
      SELECT * FROM v_menu_plan_ozet
      WHERE proje_id = $1
      ORDER BY baslangic_tarihi DESC
    `,
      [projeId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Menü planı detayı
router.get('/menu-planlari/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Plan bilgisi
    const planResult = await query(
      `
      SELECT mp.*, p.ad as proje_adi
      FROM menu_planlari mp
      JOIN projeler p ON p.id = mp.proje_id
      WHERE mp.id = $1
    `,
      [id]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan bulunamadı' });
    }

    // Öğünler ve yemekler
    const ogunlerResult = await query(
      `
      SELECT
        mpo.*,
        ot.ad as ogun_tip_adi,
        ot.ikon as ogun_ikon,
        json_agg(
          json_build_object(
            'id', moy.id,
            'recete_id', moy.recete_id,
            'recete_ad', r.ad,
            'recete_kategori', rk.ad,
            'recete_ikon', rk.ikon,
            'sira', moy.sira,
            'porsiyon_maliyet', moy.porsiyon_maliyet,
            'toplam_maliyet', moy.toplam_maliyet
          ) ORDER BY moy.sira
        ) FILTER (WHERE moy.id IS NOT NULL) as yemekler
      FROM menu_plan_ogunleri mpo
      LEFT JOIN ogun_tipleri ot ON ot.id = mpo.ogun_tipi_id
      LEFT JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
      LEFT JOIN receteler r ON r.id = moy.recete_id
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE mpo.menu_plan_id = $1
      GROUP BY mpo.id, ot.ad, ot.ikon
      ORDER BY mpo.tarih, mpo.ogun_tipi_id
    `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...planResult.rows[0],
        ogunler: ogunlerResult.rows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni menü planı oluştur
router.post('/menu-planlari', async (req, res) => {
  try {
    const { proje_id, ad, tip, baslangic_tarihi, bitis_tarihi, varsayilan_kisi_sayisi, notlar } = req.body;

    const result = await query(
      `
      INSERT INTO menu_planlari (
        proje_id, ad, tip, baslangic_tarihi, bitis_tarihi,
        varsayilan_kisi_sayisi, notlar, durum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'taslak')
      RETURNING *
    `,
      [proje_id, ad, tip || 'haftalik', baslangic_tarihi, bitis_tarihi, varsayilan_kisi_sayisi || 1000, notlar]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Menü planına öğün ekle
router.post('/menu-planlari/:planId/ogunler', async (req, res) => {
  try {
    const { planId } = req.params;
    const { tarih, ogun_tipi_id, kisi_sayisi } = req.body;

    const result = await query(
      `
      INSERT INTO menu_plan_ogunleri (
        menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (menu_plan_id, tarih, ogun_tipi_id) DO UPDATE SET
        kisi_sayisi = EXCLUDED.kisi_sayisi,
        updated_at = NOW()
      RETURNING *
    `,
      [planId, tarih, ogun_tipi_id, kisi_sayisi]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğüne yemek ekle
router.post('/ogunler/:ogunId/yemekler', async (req, res) => {
  try {
    const { ogunId } = req.params;
    const { recete_id, sira } = req.body;

    // Reçete maliyetini al
    const receteResult = await query('SELECT tahmini_maliyet FROM receteler WHERE id = $1', [recete_id]);

    const porsiyonMaliyet = receteResult.rows[0]?.tahmini_maliyet || 0;

    // Öğün kişi sayısını al
    const ogunResult = await query(
      `
      SELECT mpo.kisi_sayisi, mp.varsayilan_kisi_sayisi
      FROM menu_plan_ogunleri mpo
      JOIN menu_planlari mp ON mp.id = mpo.menu_plan_id
      WHERE mpo.id = $1
    `,
      [ogunId]
    );

    const kisiSayisi = ogunResult.rows[0]?.kisi_sayisi || ogunResult.rows[0]?.varsayilan_kisi_sayisi || 1000;

    const toplamMaliyet = porsiyonMaliyet * kisiSayisi;

    // Yemek ekle
    const result = await query(
      `
      INSERT INTO menu_ogun_yemekleri (
        menu_ogun_id, recete_id, sira, porsiyon_maliyet, toplam_maliyet
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (menu_ogun_id, recete_id) DO UPDATE SET
        sira = EXCLUDED.sira,
        porsiyon_maliyet = EXCLUDED.porsiyon_maliyet,
        toplam_maliyet = EXCLUDED.toplam_maliyet
      RETURNING *
    `,
      [ogunId, recete_id, sira || 1, porsiyonMaliyet, toplamMaliyet]
    );

    // Öğün toplamını güncelle
    await guncelleOgunMaliyet(ogunId);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğün kişi sayısını güncelle
router.put('/menu-ogun/:ogunId', async (req, res) => {
  try {
    const { ogunId } = req.params;
    const { kisi_sayisi } = req.body;

    const result = await query(
      `
      UPDATE menu_plan_ogunleri
      SET kisi_sayisi = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [kisi_sayisi, ogunId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Öğün bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğünden yemek sil
router.delete('/yemekler/:yemekId', async (req, res) => {
  try {
    const { yemekId } = req.params;

    // Önce öğün ID'yi al
    const yemek = await query('SELECT menu_ogun_id FROM menu_ogun_yemekleri WHERE id = $1', [yemekId]);

    if (yemek.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Yemek bulunamadı' });
    }

    const ogunId = yemek.rows[0].menu_ogun_id;

    await query('DELETE FROM menu_ogun_yemekleri WHERE id = $1', [yemekId]);

    // Öğün toplamını güncelle
    await guncelleOgunMaliyet(ogunId);

    res.json({ success: true, message: 'Yemek silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// TOPLU KAYDETME (Bulk Save)
// =============================================

// Tüm planı tek istekte kaydet
router.post('/menu-planlari/toplu-kaydet', async (req, res) => {
  try {
    const {
      proje_id,
      ad,
      tip,
      baslangic_tarihi,
      bitis_tarihi,
      varsayilan_kisi_sayisi,
      ogunler, // [{ tarih, ogun_tipi_id, kisi_sayisi, yemekler: [{ recete_id, ad, fiyat }] }]
    } = req.body;

    if (!proje_id) {
      return res.status(400).json({ success: false, error: 'Proje seçiniz' });
    }
    if (!ogunler || ogunler.length === 0) {
      return res.status(400).json({ success: false, error: 'En az bir öğün ekleyin' });
    }

    // 1. Plan oluştur
    const planResult = await query(
      `INSERT INTO menu_planlari (
        proje_id, ad, tip, baslangic_tarihi, bitis_tarihi,
        varsayilan_kisi_sayisi, durum
      ) VALUES ($1, $2, $3, $4, $5, $6, 'taslak')
      RETURNING *`,
      [proje_id, ad, tip || 'haftalik', baslangic_tarihi, bitis_tarihi, varsayilan_kisi_sayisi || 1000]
    );
    const planId = planResult.rows[0].id;
    const kisiSayisi = varsayilan_kisi_sayisi || 1000;

    let totalOgunler = 0;
    let totalYemekler = 0;

    // 2. Her öğün için toplu ekle
    for (const ogun of ogunler) {
      const ogunResult = await query(
        `INSERT INTO menu_plan_ogunleri (
          menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (menu_plan_id, tarih, ogun_tipi_id) DO UPDATE SET
          kisi_sayisi = EXCLUDED.kisi_sayisi,
          updated_at = NOW()
        RETURNING *`,
        [planId, ogun.tarih, ogun.ogun_tipi_id, ogun.kisi_sayisi || kisiSayisi]
      );
      const ogunId = ogunResult.rows[0].id;
      totalOgunler++;

      // 3. Yemekleri ekle
      if (ogun.yemekler && ogun.yemekler.length > 0) {
        for (let i = 0; i < ogun.yemekler.length; i++) {
          const yemek = ogun.yemekler[i];

          // recete_id varsa reçete maliyetini al
          let porsiyonMaliyet = yemek.fiyat || 0;
          if (yemek.recete_id) {
            const receteResult = await query('SELECT tahmini_maliyet FROM receteler WHERE id = $1', [yemek.recete_id]);
            if (receteResult.rows[0]?.tahmini_maliyet) {
              porsiyonMaliyet = receteResult.rows[0].tahmini_maliyet;
            }
          }

          const toplamMaliyet = porsiyonMaliyet * (ogun.kisi_sayisi || kisiSayisi);

          await query(
            `INSERT INTO menu_ogun_yemekleri (
              menu_ogun_id, recete_id, sira, porsiyon_maliyet, toplam_maliyet
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (menu_ogun_id, recete_id) DO UPDATE SET
              sira = EXCLUDED.sira,
              porsiyon_maliyet = EXCLUDED.porsiyon_maliyet,
              toplam_maliyet = EXCLUDED.toplam_maliyet`,
            [ogunId, yemek.recete_id, i + 1, porsiyonMaliyet, toplamMaliyet]
          );
          totalYemekler++;
        }

        // Öğün toplamını güncelle
        await guncelleOgunMaliyet(ogunId);
      }
    }

    // 4. Plan toplamını güncelle
    await guncellePlanMaliyet(planId);

    res.json({
      success: true,
      data: {
        plan_id: planId,
        toplam_ogun: totalOgunler,
        toplam_yemek: totalYemekler,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// MENÜ PLAN - Query ile getir
// =============================================

// Aylık menü planını getir (proje ve tarih aralığı ile)
router.get('/menu-plan', async (req, res) => {
  try {
    const { proje_id, baslangic, bitis } = req.query;

    if (!proje_id || !baslangic || !bitis) {
      return res.status(400).json({
        success: false,
        error: 'proje_id, baslangic ve bitis parametreleri gerekli',
      });
    }

    // Önce menü planını bul veya oluştur
    const planResult = await query(
      `
      SELECT id FROM menu_planlari
      WHERE proje_id = $1
        AND baslangic_tarihi <= $2
        AND bitis_tarihi >= $3
      LIMIT 1
    `,
      [proje_id, bitis, baslangic]
    );

    let planId = planResult.rows[0]?.id;

    // Plan yoksa oluştur
    if (!planId) {
      const createResult = await query(
        `
        INSERT INTO menu_planlari (
          proje_id, ad, tip, baslangic_tarihi, bitis_tarihi,
          varsayilan_kisi_sayisi, durum
        ) VALUES ($1, $2, 'aylik', $3, $4, 1000, 'taslak')
        RETURNING id
      `,
        [proje_id, `Menü Planı - ${baslangic}`, baslangic, bitis]
      );
      planId = createResult.rows[0].id;
    }

    // Öğünleri getir
    const ogunlerResult = await query(
      `
      SELECT
        mpo.id,
        mpo.tarih,
        mpo.ogun_tipi_id,
        ot.kod as ogun_tip_kodu,
        ot.ad as ogun_tip_adi,
        ot.ikon as ogun_ikon,
        mpo.kisi_sayisi,
        mpo.toplam_maliyet,
        mpo.porsiyon_maliyet,
        json_agg(
          json_build_object(
            'id', moy.id,
            'recete_id', moy.recete_id,
            'recete_ad', r.ad,
            'recete_kategori', rk.ad,
            'recete_ikon', rk.ikon,
            'sira', moy.sira,
            'porsiyon_maliyet', moy.porsiyon_maliyet,
            'toplam_maliyet', moy.toplam_maliyet
          ) ORDER BY moy.sira
        ) FILTER (WHERE moy.id IS NOT NULL) as yemekler
      FROM menu_plan_ogunleri mpo
      JOIN ogun_tipleri ot ON ot.id = mpo.ogun_tipi_id
      LEFT JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
      LEFT JOIN receteler r ON r.id = moy.recete_id
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE mpo.menu_plan_id = $1
        AND mpo.tarih >= $2 AND mpo.tarih <= $3
      GROUP BY mpo.id, ot.kod, ot.ad, ot.ikon
      ORDER BY mpo.tarih, mpo.ogun_tipi_id
    `,
      [planId, baslangic, bitis]
    );

    res.json({
      success: true,
      data: {
        plan_id: planId,
        ogunler: ogunlerResult.rows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yemek ekle (kısa yol)
router.post('/menu-plan/yemek-ekle', async (req, res) => {
  try {
    const { proje_id, tarih, ogun_tipi, recete_id, kisi_sayisi = 1000 } = req.body;

    if (!proje_id || !tarih || !ogun_tipi || !recete_id) {
      return res.status(400).json({
        success: false,
        error: 'proje_id, tarih, ogun_tipi ve recete_id gerekli',
      });
    }

    // Öğün tipi kodunu ID'ye çevir
    const ogunTipResult = await query('SELECT id FROM ogun_tipleri WHERE kod = $1', [ogun_tipi]);

    if (ogunTipResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz öğün tipi' });
    }

    const ogunTipiId = ogunTipResult.rows[0].id;

    // Menü planını bul veya oluştur
    const ayBaslangic = `${tarih.substring(0, 7)}-01`;
    const ay = parseInt(tarih.substring(5, 7), 10);
    const yil = parseInt(tarih.substring(0, 4), 10);
    const sonGun = new Date(yil, ay, 0).getDate();
    const ayBitis = `${tarih.substring(0, 7)}-${sonGun}`;

    const planResult = await query(
      `
      SELECT id FROM menu_planlari
      WHERE proje_id = $1
        AND baslangic_tarihi <= $2
        AND bitis_tarihi >= $2
      LIMIT 1
    `,
      [proje_id, tarih]
    );

    let planId = planResult.rows[0]?.id;

    if (!planId) {
      const createResult = await query(
        `
        INSERT INTO menu_planlari (
          proje_id, ad, tip, baslangic_tarihi, bitis_tarihi,
          varsayilan_kisi_sayisi, durum
        ) VALUES ($1, $2, 'aylik', $3, $4, $5, 'taslak')
        RETURNING id
      `,
        [proje_id, `Menü Planı - ${ayBaslangic}`, ayBaslangic, ayBitis, kisi_sayisi]
      );
      planId = createResult.rows[0].id;
    }

    // Öğünü bul veya oluştur
    const ogunResult = await query(
      `
      SELECT id FROM menu_plan_ogunleri
      WHERE menu_plan_id = $1 AND tarih = $2 AND ogun_tipi_id = $3
    `,
      [planId, tarih, ogunTipiId]
    );

    let ogunId = ogunResult.rows[0]?.id;

    if (!ogunId) {
      const createOgunResult = await query(
        `
        INSERT INTO menu_plan_ogunleri (
          menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
        [planId, tarih, ogunTipiId, kisi_sayisi]
      );
      ogunId = createOgunResult.rows[0].id;
    }

    // Reçete maliyetini al
    const receteResult = await query('SELECT tahmini_maliyet FROM receteler WHERE id = $1', [recete_id]);

    const porsiyonMaliyet = parseFloat(receteResult.rows[0]?.tahmini_maliyet) || 0;
    const toplamMaliyet = porsiyonMaliyet * kisi_sayisi;

    // Sıra numarasını bul
    const siraResult = await query(
      `
      SELECT COALESCE(MAX(sira), 0) + 1 as next_sira
      FROM menu_ogun_yemekleri
      WHERE menu_ogun_id = $1
    `,
      [ogunId]
    );

    // Yemek ekle
    const yemekResult = await query(
      `
      INSERT INTO menu_ogun_yemekleri (
        menu_ogun_id, recete_id, sira, porsiyon_maliyet, toplam_maliyet
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (menu_ogun_id, recete_id) DO UPDATE SET
        porsiyon_maliyet = EXCLUDED.porsiyon_maliyet,
        toplam_maliyet = EXCLUDED.toplam_maliyet
      RETURNING *
    `,
      [ogunId, recete_id, siraResult.rows[0].next_sira, porsiyonMaliyet, toplamMaliyet]
    );

    // Öğün ve plan maliyetlerini güncelle
    await guncelleOgunMaliyet(ogunId);

    res.json({
      success: true,
      data: yemekResult.rows[0],
      message: 'Yemek menüye eklendi',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// YARDIMCI ENDPOINT'LER
// =============================================

// Tarih aralığındaki günlük özetler
router.get('/menu-planlari/:planId/gunluk-ozet', async (req, res) => {
  try {
    const { planId } = req.params;

    const result = await query(
      `
      SELECT
        mpo.tarih,
        COUNT(DISTINCT mpo.id) as ogun_sayisi,
        COUNT(moy.id) as yemek_sayisi,
        COALESCE(SUM(mpo.toplam_maliyet), 0) as gunluk_maliyet,
        COALESCE(AVG(mpo.porsiyon_maliyet), 0) as ortalama_porsiyon
      FROM menu_plan_ogunleri mpo
      LEFT JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
      WHERE mpo.menu_plan_id = $1
      GROUP BY mpo.tarih
      ORDER BY mpo.tarih
    `,
      [planId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şablon kopyalama (proje → proje)
router.post('/projeler/:kaynakId/sablon-kopyala/:hedefId', async (req, res) => {
  try {
    const { kaynakId, hedefId } = req.params;

    // Kaynak şablonları al
    const sablonlar = await query(
      `
      SELECT ogun_tipi_id, cesit_sayisi, kisi_sayisi, tip, ogun_adi, sira
      FROM proje_ogun_sablonlari
      WHERE proje_id = $1 AND aktif = true
    `,
      [kaynakId]
    );

    // Hedef projeye kopyala
    for (const s of sablonlar.rows) {
      await query(
        `
        INSERT INTO proje_ogun_sablonlari (
          proje_id, ogun_tipi_id, cesit_sayisi, kisi_sayisi, tip, ogun_adi, sira
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (proje_id, ogun_tipi_id) DO UPDATE SET
          cesit_sayisi = EXCLUDED.cesit_sayisi,
          kisi_sayisi = EXCLUDED.kisi_sayisi,
          tip = EXCLUDED.tip,
          ogun_adi = EXCLUDED.ogun_adi,
          sira = EXCLUDED.sira
      `,
        [hedefId, s.ogun_tipi_id, s.cesit_sayisi, s.kisi_sayisi, s.tip, s.ogun_adi, s.sira]
      );
    }

    res.json({
      success: true,
      message: `${sablonlar.rows.length} öğün şablonu kopyalandı`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
// Re-export maliyet fonksiyonları (backward compat — urunler.js kullanıyor)
export { hesaplaReceteMaliyet, guncelleOgunMaliyet, guncellePlanMaliyet };
