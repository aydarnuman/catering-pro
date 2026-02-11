import fs from 'node:fs';
import express from 'express';
import multer from 'multer';
import { query } from '../../database.js';
import { parseExcelMenu, parseImageMenu, parsePdfMenu } from '../../services/menu-import.js';

const router = express.Router();

const menuUpload = multer({
  dest: 'uploads/menu-import/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya formatı'));
    }
  },
});

// Menü dosyası analiz et (önizleme)
router.post('/import/analyze', menuUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    let menuData = [];

    // Dosya tipine göre parse et
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      menuData = await parseExcelMenu(filePath);
    } else if (mimeType === 'application/pdf') {
      menuData = await parsePdfMenu(filePath);
    } else if (mimeType.startsWith('image/')) {
      menuData = await parseImageMenu(filePath);
    }

    // Geçici dosyayı sil
    fs.unlinkSync(filePath);

    // Sonuçları grupla ve özetle
    const ozet = {
      toplam_gun: menuData.length,
      toplam_yemek: menuData.reduce((sum, d) => sum + d.yemekler.length, 0),
      ogunler: {
        kahvalti: menuData.filter((d) => d.ogun === 'kahvalti').length,
        ogle: menuData.filter((d) => d.ogun === 'ogle').length,
        aksam: menuData.filter((d) => d.ogun === 'aksam').length,
      },
      tarih_araligi:
        menuData.length > 0
          ? {
              baslangic: menuData.map((d) => d.tarih).sort()[0],
              bitis: menuData
                .map((d) => d.tarih)
                .sort()
                .pop(),
            }
          : null,
    };

    res.json({
      success: true,
      data: menuData,
      ozet,
    });
  } catch (error) {
    // Dosya varsa sil
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analiz edilen menüyü kaydet
router.post('/import/save', async (req, res) => {
  try {
    const { proje_id, menuData, varsayilan_ogun } = req.body;

    if (!proje_id || !menuData || !Array.isArray(menuData)) {
      return res.status(400).json({ success: false, error: 'Geçersiz veri' });
    }

    // Plan al veya oluştur
    const planResult = await query(`SELECT id FROM menu_planlari WHERE proje_id = $1 ORDER BY id LIMIT 1`, [proje_id]);

    let planId;
    if (planResult.rows.length === 0) {
      // Yeni plan oluştur
      const tarihler = menuData.map((d) => d.tarih).sort();
      const baslangic = tarihler[0];
      const bitis = tarihler[tarihler.length - 1];

      const newPlan = await query(
        `INSERT INTO menu_planlari (proje_id, ad, baslangic_tarihi, bitis_tarihi, durum)
         VALUES ($1, $2, $3, $4, 'taslak') RETURNING id`,
        [proje_id, `İçe Aktarılan Menü`, baslangic, bitis]
      );
      planId = newPlan.rows[0].id;
    } else {
      planId = planResult.rows[0].id;
    }

    // Öğün tiplerini al
    const ogunTipleri = await query(`SELECT id, kod FROM ogun_tipleri`);
    const ogunMap = {};
    ogunTipleri.rows.forEach((o) => {
      ogunMap[o.kod] = o.id;
    });

    // Kategori ID al (varsayılan)
    const defaultKategori = await query(`SELECT id FROM recete_kategoriler WHERE kod = 'ana_yemek' LIMIT 1`);
    const kahvaltiKategori = await query(`SELECT id FROM recete_kategoriler WHERE kod = 'kahvaltilik' LIMIT 1`);

    let eklenenGun = 0;
    let eklenenYemek = 0;
    let olusturulanRecete = 0;

    for (const gun of menuData) {
      const tarih = gun.tarih;
      const ogun = gun.ogun || varsayilan_ogun || 'aksam';
      const ogunTipiId = ogunMap[ogun] || ogunMap.aksam;

      // Öğün al veya oluştur
      const ogunResult = await query(
        `SELECT id FROM menu_plan_ogunleri WHERE menu_plan_id = $1 AND tarih = $2 AND ogun_tipi_id = $3`,
        [planId, tarih, ogunTipiId]
      );

      let ogunId;
      if (ogunResult.rows.length === 0) {
        const newOgun = await query(
          `INSERT INTO menu_plan_ogunleri (menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi)
           VALUES ($1, $2, $3, 1000) RETURNING id`,
          [planId, tarih, ogunTipiId]
        );
        ogunId = newOgun.rows[0].id;
        eklenenGun++;
      } else {
        ogunId = ogunResult.rows[0].id;
      }

      // Her yemek için
      for (let sira = 0; sira < gun.yemekler.length; sira++) {
        const yemekAdi = gun.yemekler[sira];

        // Reçete bul veya oluştur
        let receteResult = await query(
          `SELECT id FROM receteler WHERE LOWER(TRIM(ad)) = LOWER(TRIM($1)) AND proje_id = $2 LIMIT 1`,
          [yemekAdi, proje_id]
        );

        let receteId;
        if (receteResult.rows.length === 0) {
          // Kısmi eşleşme dene
          const temizAd = yemekAdi.split('/')[0].split('+')[0].trim();
          receteResult = await query(`SELECT id FROM receteler WHERE ad ILIKE $1 AND proje_id = $2 LIMIT 1`, [
            `%${temizAd}%`,
            proje_id,
          ]);
        }

        if (receteResult.rows.length > 0) {
          receteId = receteResult.rows[0].id;
        } else {
          // Yeni reçete oluştur
          const kategoriId =
            ogun === 'kahvalti'
              ? kahvaltiKategori.rows[0]?.id || defaultKategori.rows[0]?.id || 1
              : defaultKategori.rows[0]?.id || 1;

          const kod = `IMP-${Date.now().toString().slice(-8)}-${sira}`;
          const newRecete = await query(
            `INSERT INTO receteler (kod, ad, kategori_id, proje_id, porsiyon_miktar)
             VALUES ($1, $2, $3, $4, 1) RETURNING id`,
            [kod, yemekAdi, kategoriId, proje_id]
          );
          receteId = newRecete.rows[0].id;
          olusturulanRecete++;
        }

        // Yemeği öğüne ekle (duplicate kontrolü)
        const existing = await query(`SELECT id FROM menu_ogun_yemekleri WHERE menu_ogun_id = $1 AND recete_id = $2`, [
          ogunId,
          receteId,
        ]);

        if (existing.rows.length === 0) {
          await query(`INSERT INTO menu_ogun_yemekleri (menu_ogun_id, recete_id, sira) VALUES ($1, $2, $3)`, [
            ogunId,
            receteId,
            sira + 1,
          ]);
          eklenenYemek++;
        }
      }
    }

    res.json({
      success: true,
      message: 'Menü başarıyla aktarıldı',
      sonuc: {
        plan_id: planId,
        eklenen_gun: eklenenGun,
        eklenen_yemek: eklenenYemek,
        olusturulan_recete: olusturulanRecete,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
