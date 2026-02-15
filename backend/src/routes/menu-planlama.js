import express from 'express';
import { query } from '../database.js';
import {
  guncelleOgunMaliyet,
  guncellePlanMaliyet,
  hesaplaReceteMaliyet,
} from '../services/maliyet-hesaplama-service.js';
import { getFirmaId } from '../utils/firma-filter.js';
import aiFeaturesRouter from './menu-planlama/ai-features.js';
import menuImportRouter from './menu-planlama/menu-import.js';
// Sub-router'lar
import recetelerRouter from './menu-planlama/receteler.js';
import sartnamelerRouter, { gramajKontrolHesapla } from './menu-planlama/sartnameler.js';
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
router.get('/projeler', async (req, res) => {
  try {
    const firmaId = getFirmaId(req);
    const params = [];
    let firmaClause = '';
    if (firmaId) {
      firmaClause = ' AND p.firma_id = $1';
      params.push(firmaId);
    }
    const result = await query(
      `SELECT p.id, p.ad, p.kod, p.aciklama, p.baslangic_tarihi, p.bitis_tarihi,
        p.aktif, p.created_at, p.updated_at
      FROM projeler p
      WHERE p.aktif = true${firmaClause}
      ORDER BY p.ad`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tüm menü planlarını listele (kaydedilen menüler için)
router.get('/menu-planlari', async (req, res) => {
  try {
    const firmaId = getFirmaId(req);
    const params = [];
    let firmaClause = '';
    if (firmaId) {
      firmaClause = ' WHERE p.firma_id = $1';
      params.push(firmaId);
    }
    const result = await query(
      `SELECT mp.id, mp.proje_id, mp.ad, mp.tip,
        mp.baslangic_tarihi, mp.bitis_tarihi, mp.varsayilan_kisi_sayisi,
        mp.toplam_maliyet, mp.durum, mp.notlar, mp.created_at, mp.updated_at,
        p.ad as proje_adi
      FROM menu_planlari mp
      LEFT JOIN projeler p ON p.id = mp.proje_id
      ${firmaClause}
      ORDER BY mp.created_at DESC`,
      params
    );
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

    const firmaId = getFirmaId(req);
    // Plan bilgisi
    const planParams = firmaId ? [id, firmaId] : [id];
    const planResult = await query(
      `SELECT mp.*, p.ad as proje_adi
      FROM menu_planlari mp
      LEFT JOIN projeler p ON p.id = mp.proje_id
      WHERE mp.id = $1${firmaId ? ' AND (p.firma_id = $2 OR mp.proje_id IS NULL)' : ''}`,
      planParams
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan bulunamadı' });
    }

    // Öğünler ve yemekler
    const ogunlerResult = await query(
      `
      SELECT
        mpo.*,
        ot.kod as ogun_tip_kodu,
        ot.ad as ogun_tip_adi,
        ot.ikon as ogun_ikon,
        json_agg(
          json_build_object(
            'id', moy.id,
            'recete_id', moy.recete_id,
            'recete_ad', r.ad,
            'recete_kategori', rk.ad,
            'recete_kategori_kod', rk.kod,
            'recete_ikon', rk.ikon,
            'recete_alt_tip_id', r.alt_tip_id,
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
      GROUP BY mpo.id, ot.kod, ot.ad, ot.ikon
      ORDER BY mpo.tarih, mpo.ogun_tipi_id
    `,
      [id]
    );

    // Şartname uyumluluk durumu hesapla
    const ogunler = ogunlerResult.rows;
    const projeId = planResult.rows[0].proje_id;
    try {
      if (projeId) {
        const sartnameRes = await query(
          `SELECT ps.sartname_id
           FROM proje_sartname_atamalari ps
           WHERE ps.proje_id = $1 AND ps.aktif = true
           LIMIT 1`,
          [projeId]
        );

        if (sartnameRes.rows.length > 0) {
          const sartnameId = sartnameRes.rows[0].sartname_id;

          const ogunYapilariRes = await query(
            `SELECT DISTINCT ON (ogun_tipi) ogun_tipi, min_cesit, max_cesit, zorunlu_kategoriler
             FROM sartname_ogun_yapisi
             WHERE sartname_id = $1 AND aktif = true
             ORDER BY ogun_tipi, id DESC`,
            [sartnameId]
          );
          const ogunYapilari = Object.fromEntries(ogunYapilariRes.rows.map((r) => [r.ogun_tipi, r]));

          const [tumKurallarRes, sozlukRes] = await Promise.all([
            query('SELECT * FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true', [sartnameId]),
            query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true'),
          ]);
          const tumKurallar = tumKurallarRes.rows;

          for (const ogun of ogunler) {
            const yemekler = ogun.yemekler || [];
            if (yemekler.length === 0) {
              ogun.sartname_durum = 'kontrol_yok';
              continue;
            }

            const uyarilar = [];

            for (const yemek of yemekler) {
              if (!yemek.recete_id || !yemek.recete_alt_tip_id) continue;
              try {
                const malzRes = await query(
                  'SELECT malzeme_adi, miktar, birim FROM recete_malzemeler WHERE recete_id = $1',
                  [yemek.recete_id]
                );
                const altTipKurallar = tumKurallar.filter(
                  (k) => Number(k.alt_tip_id) === Number(yemek.recete_alt_tip_id)
                );
                if (altTipKurallar.length > 0) {
                  const kontrol = gramajKontrolHesapla(malzRes.rows, altTipKurallar, tumKurallar, sozlukRes.rows);
                  if (kontrol.uyumsuz_sayisi > 0) {
                    uyarilar.push({
                      tip: 'gramaj',
                      recete_ad: yemek.recete_ad,
                      mesaj: `${yemek.recete_ad}: ${kontrol.uyumsuz_sayisi} gramaj uyumsuzluğu`,
                    });
                  }
                }
              } catch (_e) {
                // devam
              }
            }

            const ogunTipKodu = ogun.ogun_tip_kodu;
            const ogunYapi = ogunTipKodu ? ogunYapilari[ogunTipKodu] : null;
            if (ogunYapi) {
              const yemekSayisi = yemekler.length;
              if (ogunYapi.max_cesit && yemekSayisi > ogunYapi.max_cesit) {
                uyarilar.push({ tip: 'cesit_fazla', mesaj: `Maks ${ogunYapi.max_cesit} çeşit, ${yemekSayisi} var` });
              }
              if (ogunYapi.min_cesit && yemekSayisi < ogunYapi.min_cesit) {
                uyarilar.push({ tip: 'cesit_eksik', mesaj: `Min ${ogunYapi.min_cesit} çeşit, ${yemekSayisi} var` });
              }
              if (ogunYapi.zorunlu_kategoriler && ogunYapi.zorunlu_kategoriler.length > 0) {
                const mevcutKategoriler = [...new Set(yemekler.map((y) => y.recete_kategori_kod).filter(Boolean))];
                const eksik = ogunYapi.zorunlu_kategoriler.filter((zk) => !mevcutKategoriler.includes(zk));
                if (eksik.length > 0) {
                  uyarilar.push({ tip: 'kategori_eksik', mesaj: `Eksik: ${eksik.join(', ')}`, eksik });
                }
              }
            }

            ogun.sartname_durum = uyarilar.length > 0 ? 'uyari' : 'uygun';
            if (uyarilar.length > 0) ogun.sartname_uyarilar = uyarilar;
          }
        } else {
          for (const ogun of ogunler) ogun.sartname_durum = 'kontrol_yok';
        }
      } else {
        for (const ogun of ogunler) ogun.sartname_durum = 'kontrol_yok';
      }
    } catch (_e) {
      for (const ogun of ogunler) ogun.sartname_durum = 'kontrol_yok';
    }

    res.json({
      success: true,
      data: {
        ...planResult.rows[0],
        ogunler,
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

// Menü planı güncelle (isim değiştir)
router.put('/menu-planlari/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ad } = req.body;

    if (!ad || !ad.trim()) {
      return res.status(400).json({ success: false, error: 'Plan adı zorunludur' });
    }

    const result = await query(`UPDATE menu_planlari SET ad = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [
      ad.trim(),
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Menü planı sil (cascade: öğünler + yemekler)
router.delete('/menu-planlari/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Önce yemekleri sil
    await query(
      `DELETE FROM menu_ogun_yemekleri WHERE menu_ogun_id IN (SELECT id FROM menu_plan_ogunleri WHERE menu_plan_id = $1)`,
      [id]
    );
    // Öğünleri sil
    await query(`DELETE FROM menu_plan_ogunleri WHERE menu_plan_id = $1`, [id]);
    // Planı sil
    const result = await query(`DELETE FROM menu_planlari WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan bulunamadı' });
    }

    res.json({ success: true, data: { message: 'Plan silindi' } });
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

    // Bug #7 fix: Reçete maliyetini önce tazele, sonra oku
    await hesaplaReceteMaliyet(recete_id);
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

    // Bug #6 fix: kişi_sayısı değişince yemek maliyetlerini yeniden hesapla
    // Her yemeğin toplam_maliyet = porsiyon_maliyet × yeni_kisi_sayisi
    const yeniKisiSayisi = Number(kisi_sayisi) || 1;
    await query(
      `
      UPDATE menu_ogun_yemekleri
      SET toplam_maliyet = porsiyon_maliyet * $1
      WHERE menu_ogun_id = $2
    `,
      [yeniKisiSayisi, ogunId]
    );

    // Öğün ve plan toplamlarını zincirleme güncelle
    await guncelleOgunMaliyet(ogunId);

    // Güncel veriyi döndür
    const updated = await query('SELECT * FROM menu_plan_ogunleri WHERE id = $1', [ogunId]);
    res.json({ success: true, data: updated.rows[0] });
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

    if (!proje_id && tip !== 'gunluk') {
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
      [proje_id || null, ad, tip || 'haftalik', baslangic_tarihi, bitis_tarihi, varsayilan_kisi_sayisi || 1000]
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

    // 5. Şartname uyumluluk kontrolü (bilgilendirme — kayıt engellenmez)
    let sartname_uyarilar = null;
    try {
      if (proje_id) {
        const sartnameRes = await query(
          `SELECT ps.sartname_id
           FROM proje_sartname_atamalari ps
           WHERE ps.proje_id = $1 AND ps.aktif = true
           LIMIT 1`,
          [proje_id]
        );
        if (sartnameRes.rows.length > 0) {
          const sartnameId = sartnameRes.rows[0].sartname_id;
          const uyarilar = [];

          // Her öğün için gramaj + öğün yapısı kontrolü
          for (const ogun of ogunler) {
            const ogunUyarilari = [];

            // Öğün tipi kodunu al
            const ogunTipRes = await query('SELECT kod FROM ogun_tipleri WHERE id = $1', [ogun.ogun_tipi_id]);
            const ogunTipKodu = ogunTipRes.rows[0]?.kod;

            // (a) Gramaj kontrolü — her yemek için
            for (const yemek of ogun.yemekler || []) {
              if (!yemek.recete_id) continue;
              try {
                const receteInfo = await query('SELECT alt_tip_id FROM receteler WHERE id = $1', [yemek.recete_id]);
                const altTipId = receteInfo.rows[0]?.alt_tip_id;
                if (!altTipId) continue;

                const [kurallarRes, malzRes, sozlukRes] = await Promise.all([
                  query('SELECT * FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true', [
                    sartnameId,
                  ]),
                  query('SELECT malzeme_adi, miktar, birim FROM recete_malzemeler WHERE recete_id = $1', [
                    yemek.recete_id,
                  ]),
                  query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true'),
                ]);
                const tumKurallar = kurallarRes.rows;
                const altTipKurallar = tumKurallar.filter((k) => Number(k.alt_tip_id) === Number(altTipId));
                const kontrol = gramajKontrolHesapla(malzRes.rows, altTipKurallar, tumKurallar, sozlukRes.rows);
                if (kontrol.uyumsuz_sayisi > 0) {
                  ogunUyarilari.push({
                    tip: 'gramaj',
                    recete_id: yemek.recete_id,
                    mesaj: `${kontrol.uyumsuz_sayisi} malzemede gramaj uyumsuzluğu`,
                    uygun: kontrol.uygun_sayisi,
                    uyumsuz: kontrol.uyumsuz_sayisi,
                  });
                }
              } catch (_e) {
                // Tek reçete kontrolü başarısız olursa devam et
              }
            }

            // (b) Öğün yapısı kontrolü
            if (ogunTipKodu) {
              try {
                const ogunYapiRes = await query(
                  `SELECT min_cesit, max_cesit, zorunlu_kategoriler, aciklama
                   FROM sartname_ogun_yapisi
                   WHERE sartname_id = $1 AND ogun_tipi = $2 AND aktif = true
                   ORDER BY id DESC LIMIT 1`,
                  [sartnameId, ogunTipKodu]
                );
                if (ogunYapiRes.rows.length > 0) {
                  const yapi = ogunYapiRes.rows[0];
                  const yemekSayisi = (ogun.yemekler || []).filter((y) => y.recete_id).length;

                  // Çeşit sayısı kontrolü
                  if (yapi.max_cesit && yemekSayisi > yapi.max_cesit) {
                    ogunUyarilari.push({
                      tip: 'cesit_fazla',
                      mesaj: `Maksimum ${yapi.max_cesit} çeşit olmalı, ${yemekSayisi} çeşit var`,
                    });
                  }
                  if (yapi.min_cesit && yemekSayisi < yapi.min_cesit) {
                    ogunUyarilari.push({
                      tip: 'cesit_eksik',
                      mesaj: `Minimum ${yapi.min_cesit} çeşit olmalı, ${yemekSayisi} çeşit var`,
                    });
                  }

                  // Zorunlu kategori kontrolü
                  if (yapi.zorunlu_kategoriler && yapi.zorunlu_kategoriler.length > 0) {
                    const receteIds = (ogun.yemekler || []).map((y) => y.recete_id).filter(Boolean);
                    if (receteIds.length > 0) {
                      const katRes = await query(
                        `SELECT DISTINCT rk.kod
                         FROM receteler r
                         JOIN recete_kategoriler rk ON rk.id = r.kategori_id
                         WHERE r.id = ANY($1)`,
                        [receteIds]
                      );
                      const mevcutKategoriler = katRes.rows.map((r) => r.kod);
                      const eksikKategoriler = yapi.zorunlu_kategoriler.filter((zk) => !mevcutKategoriler.includes(zk));
                      if (eksikKategoriler.length > 0) {
                        ogunUyarilari.push({
                          tip: 'kategori_eksik',
                          mesaj: `Eksik zorunlu kategoriler: ${eksikKategoriler.join(', ')}`,
                          eksik: eksikKategoriler,
                        });
                      }
                    }
                  }
                }
              } catch (_e) {
                // Öğün yapısı kontrolü başarısız olursa devam et
              }
            }

            if (ogunUyarilari.length > 0) {
              uyarilar.push({
                tarih: ogun.tarih,
                ogun_tipi_id: ogun.ogun_tipi_id,
                ogun_tipi_kod: ogunTipKodu,
                uyarilar: ogunUyarilari,
              });
            }
          }

          if (uyarilar.length > 0) {
            sartname_uyarilar = uyarilar;
          }
        }
      }
    } catch (_sartnameErr) {
      // Şartname kontrolü başarısız olursa kayıt yine de başarılı
    }

    res.json({
      success: true,
      data: {
        plan_id: planId,
        toplam_ogun: totalOgunler,
        toplam_yemek: totalYemekler,
      },
      sartname_uyarilar,
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
            'recete_kategori_kod', rk.kod,
            'recete_ikon', rk.ikon,
            'recete_alt_tip_id', r.alt_tip_id,
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

    // Şartname uyumluluk durumu hesapla (her öğün için)
    const ogunler = ogunlerResult.rows;
    try {
      const sartnameRes = await query(
        `SELECT ps.sartname_id
         FROM proje_sartname_atamalari ps
         WHERE ps.proje_id = $1 AND ps.aktif = true
         LIMIT 1`,
        [proje_id]
      );

      if (sartnameRes.rows.length > 0) {
        const sartnameId = sartnameRes.rows[0].sartname_id;

        // Öğün yapısı kurallarını toplu çek
        const ogunYapilariRes = await query(
          `SELECT DISTINCT ON (ogun_tipi) ogun_tipi, min_cesit, max_cesit, zorunlu_kategoriler
           FROM sartname_ogun_yapisi
           WHERE sartname_id = $1 AND aktif = true
           ORDER BY ogun_tipi, id DESC`,
          [sartnameId]
        );
        const ogunYapilari = Object.fromEntries(ogunYapilariRes.rows.map((r) => [r.ogun_tipi, r]));

        // Gramaj kurallarını toplu çek
        const [tumKurallarRes, sozlukRes] = await Promise.all([
          query('SELECT * FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true', [sartnameId]),
          query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true'),
        ]);
        const tumKurallar = tumKurallarRes.rows;

        for (const ogun of ogunler) {
          const yemekler = ogun.yemekler || [];
          if (yemekler.length === 0) {
            ogun.sartname_durum = 'kontrol_yok';
            continue;
          }

          const uyarilar = [];

          // (a) Gramaj kontrolü — her yemek için
          for (const yemek of yemekler) {
            if (!yemek.recete_id || !yemek.recete_alt_tip_id) continue;
            try {
              const malzRes = await query(
                'SELECT malzeme_adi, miktar, birim FROM recete_malzemeler WHERE recete_id = $1',
                [yemek.recete_id]
              );
              const altTipKurallar = tumKurallar.filter(
                (k) => Number(k.alt_tip_id) === Number(yemek.recete_alt_tip_id)
              );
              if (altTipKurallar.length > 0) {
                const kontrol = gramajKontrolHesapla(malzRes.rows, altTipKurallar, tumKurallar, sozlukRes.rows);
                if (kontrol.uyumsuz_sayisi > 0) {
                  uyarilar.push({
                    tip: 'gramaj',
                    recete_ad: yemek.recete_ad,
                    mesaj: `${yemek.recete_ad}: ${kontrol.uyumsuz_sayisi} gramaj uyumsuzluğu`,
                  });
                }
              }
            } catch (_e) {
              // Devam et
            }
          }

          // (b) Öğün yapısı kontrolü
          const ogunYapi = ogunYapilari[ogun.ogun_tip_kodu];
          if (ogunYapi) {
            const yemekSayisi = yemekler.length;

            if (ogunYapi.max_cesit && yemekSayisi > ogunYapi.max_cesit) {
              uyarilar.push({
                tip: 'cesit_fazla',
                mesaj: `Maks ${ogunYapi.max_cesit} çeşit, ${yemekSayisi} var`,
              });
            }
            if (ogunYapi.min_cesit && yemekSayisi < ogunYapi.min_cesit) {
              uyarilar.push({
                tip: 'cesit_eksik',
                mesaj: `Min ${ogunYapi.min_cesit} çeşit, ${yemekSayisi} var`,
              });
            }

            if (ogunYapi.zorunlu_kategoriler && ogunYapi.zorunlu_kategoriler.length > 0) {
              const mevcutKategoriler = [...new Set(yemekler.map((y) => y.recete_kategori_kod).filter(Boolean))];
              const eksik = ogunYapi.zorunlu_kategoriler.filter((zk) => !mevcutKategoriler.includes(zk));
              if (eksik.length > 0) {
                uyarilar.push({
                  tip: 'kategori_eksik',
                  mesaj: `Eksik kategoriler: ${eksik.join(', ')}`,
                  eksik,
                });
              }
            }
          }

          // Durum belirle
          if (uyarilar.length > 0) {
            ogun.sartname_durum = 'uyari';
            ogun.sartname_uyarilar = uyarilar;
          } else {
            ogun.sartname_durum = 'uygun';
          }
        }
      } else {
        // Şartname ataması yok
        for (const ogun of ogunler) {
          ogun.sartname_durum = 'kontrol_yok';
        }
      }
    } catch (_sartnameErr) {
      // Şartname kontrolü başarısız olursa durum bilgisi olmadan devam et
      for (const ogun of ogunler) {
        ogun.sartname_durum = 'kontrol_yok';
      }
    }

    res.json({
      success: true,
      data: {
        plan_id: planId,
        ogunler,
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

    // Bug #7 fix: Reçete maliyetini önce tazele, sonra oku
    await hesaplaReceteMaliyet(recete_id);
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

    // Şartname uyumluluk kontrolü (bilgilendirme — kayıt engellenmez)
    let sartnameUyari = null;
    try {
      // Projenin bağlı şartnamesini bul
      const sartnameResult = await query(
        `SELECT ps.sartname_id
         FROM proje_sartname_atamalari ps
         WHERE ps.proje_id = $1 AND ps.aktif = true
         LIMIT 1`,
        [proje_id]
      );
      if (sartnameResult.rows.length > 0) {
        const sartnameId = sartnameResult.rows[0].sartname_id;
        const uyariListesi = [];

        // (a) Gramaj kontrolü
        const receteInfo = await query('SELECT alt_tip_id FROM receteler WHERE id = $1', [recete_id]);
        const altTipId = receteInfo.rows[0]?.alt_tip_id;
        if (altTipId) {
          const [kurallarRes, malzRes, sozlukRes] = await Promise.all([
            query('SELECT * FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true', [sartnameId]),
            query('SELECT malzeme_adi, miktar, birim FROM recete_malzemeler WHERE recete_id = $1', [recete_id]),
            query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true'),
          ]);
          const tumKurallar = kurallarRes.rows;
          const altTipKurallar = tumKurallar.filter((k) => Number(k.alt_tip_id) === Number(altTipId));
          const kontrol = gramajKontrolHesapla(malzRes.rows, altTipKurallar, tumKurallar, sozlukRes.rows);
          if (kontrol.uyumsuz_sayisi > 0) {
            uyariListesi.push({
              tip: 'gramaj',
              mesaj: `${kontrol.uyumsuz_sayisi} malzemede gramaj uyumsuzluğu`,
              uygun: kontrol.uygun_sayisi,
              uyumsuz: kontrol.uyumsuz_sayisi,
              toplam: kontrol.toplam_kontrol,
            });
          }
        }

        // (b) Öğün yapısı kontrolü — mevcut öğündeki yemek sayısı + kategoriler
        try {
          const ogunTipRes = await query('SELECT kod FROM ogun_tipleri WHERE id = $1', [ogunTipiId]);
          const ogunTipKodu = ogunTipRes.rows[0]?.kod;
          if (ogunTipKodu) {
            const ogunYapiRes = await query(
              `SELECT min_cesit, max_cesit, zorunlu_kategoriler
               FROM sartname_ogun_yapisi
               WHERE sartname_id = $1 AND ogun_tipi = $2 AND aktif = true
               ORDER BY id DESC LIMIT 1`,
              [sartnameId, ogunTipKodu]
            );
            if (ogunYapiRes.rows.length > 0) {
              const yapi = ogunYapiRes.rows[0];
              // Mevcut öğündeki yemek sayısını al (yeni eklenen dahil)
              const mevcutYemekRes = await query(
                'SELECT COUNT(*) as sayi FROM menu_ogun_yemekleri WHERE menu_ogun_id = $1',
                [ogunId]
              );
              const yemekSayisi = parseInt(mevcutYemekRes.rows[0]?.sayi) || 0;

              if (yapi.max_cesit && yemekSayisi > yapi.max_cesit) {
                uyariListesi.push({
                  tip: 'cesit_fazla',
                  mesaj: `Maksimum ${yapi.max_cesit} çeşit olmalı, ${yemekSayisi} çeşit var`,
                });
              }

              // Zorunlu kategori kontrolü
              if (yapi.zorunlu_kategoriler && yapi.zorunlu_kategoriler.length > 0) {
                const katRes = await query(
                  `SELECT DISTINCT rk.kod
                   FROM menu_ogun_yemekleri moy
                   JOIN receteler r ON r.id = moy.recete_id
                   JOIN recete_kategoriler rk ON rk.id = r.kategori_id
                   WHERE moy.menu_ogun_id = $1`,
                  [ogunId]
                );
                const mevcutKategoriler = katRes.rows.map((r) => r.kod);
                const eksikKategoriler = yapi.zorunlu_kategoriler.filter((zk) => !mevcutKategoriler.includes(zk));
                if (eksikKategoriler.length > 0) {
                  uyariListesi.push({
                    tip: 'kategori_eksik',
                    mesaj: `Eksik zorunlu kategoriler: ${eksikKategoriler.join(', ')}`,
                    eksik: eksikKategoriler,
                  });
                }
              }
            }
          }
        } catch (_ogunErr) {
          // Öğün yapısı kontrolü başarısız olursa devam et
        }

        if (uyariListesi.length > 0) {
          // Geriye uyumluluk: ilk gramaj uyarısını eski formatta tut + tüm uyarıları ekle
          const gramajUyari = uyariListesi.find((u) => u.tip === 'gramaj');
          sartnameUyari = {
            mesaj: gramajUyari?.mesaj || uyariListesi[0].mesaj,
            uygun: gramajUyari?.uygun || 0,
            uyumsuz: gramajUyari?.uyumsuz || 0,
            toplam: gramajUyari?.toplam || 0,
            detaylar: uyariListesi,
          };
        }
      }
    } catch (_sartnameErr) {
      // Şartname kontrolü başarısız olursa kayıt yine de başarılı
    }

    res.json({
      success: true,
      data: yemekResult.rows[0],
      message: 'Yemek menüye eklendi',
      sartname_uyari: sartnameUyari,
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
