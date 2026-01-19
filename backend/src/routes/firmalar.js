/**
 * @swagger
 * tags:
 *   name: Firmalar
 *   description: Kendi şirket bilgileri yönetimi (ihale işlemleri için)
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../database.js';
import { logError, logAPI } from '../utils/logger.js';
import { analyzeFirmaBelgesi, getDesteklenenBelgeTipleri } from '../services/firma-belge-service.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Tüm firmalar endpoint'leri için authentication gerekli
router.use(authenticate);

// Dosya upload ayarları
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'firmalar');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `firma-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece PDF ve resim dosyaları yüklenebilir'));
    }
  }
});

/**
 * @swagger
 * /api/firmalar:
 *   get:
 *     summary: Tüm firmaları listele
 *     tags: [Firmalar]
 */
router.get('/', async (req, res) => {
  try {
    const { aktif = true } = req.query;
    
    let sql = 'SELECT * FROM firmalar WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (aktif !== undefined && aktif !== 'all') {
      sql += ` AND aktif = $${paramIndex}`;
      params.push(aktif === 'true' || aktif === true);
      paramIndex++;
    }
    
    sql += ' ORDER BY varsayilan DESC, unvan ASC';
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
    
  } catch (error) {
    logError('Firmalar Liste', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}:
 *   get:
 *     summary: Tek firma getir
 *     tags: [Firmalar]
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query('SELECT * FROM firmalar WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    logError('Firma Detay', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/varsayilan:
 *   get:
 *     summary: Varsayılan firmayı getir
 *     tags: [Firmalar]
 */
router.get('/varsayilan/get', async (req, res) => {
  try {
    const result = await query('SELECT * FROM firmalar WHERE varsayilan = true AND aktif = true LIMIT 1');
    
    res.json({
      success: true,
      data: result.rows[0] || null
    });
    
  } catch (error) {
    logError('Varsayılan Firma', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar:
 *   post:
 *     summary: Yeni firma ekle
 *     tags: [Firmalar]
 */
router.post('/', async (req, res) => {
  try {
    const {
      // Temel bilgiler
      unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
      // İletişim
      adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
      // Yetkili 1
      yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
      // Yetkili 2 (yeni)
      yetkili2_adi, yetkili2_unvani, yetkili2_tc, yetkili2_telefon,
      // Banka 1
      banka_adi, banka_sube, iban, hesap_no,
      // Banka 2 (yeni)
      banka2_adi, banka2_sube, banka2_iban,
      // SGK ve Resmi (yeni)
      sgk_sicil_no, kep_adresi, nace_kodu,
      // Kapasite (yeni)
      gunluk_uretim_kapasitesi, personel_kapasitesi,
      // Görsel (yeni)
      logo_url, kase_imza_url,
      // Referanslar (yeni)
      referanslar, is_deneyim_belgeleri,
      // Durum
      varsayilan, aktif, notlar
    } = req.body;
    
    const sql = `
      INSERT INTO firmalar (
        unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
        adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
        yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
        yetkili2_adi, yetkili2_unvani, yetkili2_tc, yetkili2_telefon,
        banka_adi, banka_sube, iban, hesap_no,
        banka2_adi, banka2_sube, banka2_iban,
        sgk_sicil_no, kep_adresi, nace_kodu,
        gunluk_uretim_kapasitesi, personel_kapasitesi,
        logo_url, kase_imza_url,
        referanslar, is_deneyim_belgeleri,
        varsayilan, aktif, notlar
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24,
        $25, $26, $27, $28,
        $29, $30, $31,
        $32, $33, $34,
        $35, $36,
        $37, $38,
        $39, $40,
        $41, $42, $43
      ) RETURNING *
    `;
    
    const result = await query(sql, [
      unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
      adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
      yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
      yetkili2_adi, yetkili2_unvani, yetkili2_tc, yetkili2_telefon,
      banka_adi, banka_sube, iban, hesap_no,
      banka2_adi, banka2_sube, banka2_iban,
      sgk_sicil_no, kep_adresi, nace_kodu,
      gunluk_uretim_kapasitesi, personel_kapasitesi,
      logo_url, kase_imza_url,
      referanslar ? JSON.stringify(referanslar) : '[]',
      is_deneyim_belgeleri ? JSON.stringify(is_deneyim_belgeleri) : '[]',
      varsayilan || false, aktif !== false, notlar
    ]);
    
    logAPI('Firma Eklendi', { unvan });
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Firma başarıyla eklendi'
    });
    
  } catch (error) {
    logError('Firma Ekle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}:
 *   put:
 *     summary: Firma güncelle
 *     tags: [Firmalar]
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Temel bilgiler
      unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
      // İletişim
      adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
      // Yetkili 1
      yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
      // Yetkili 2 (yeni)
      yetkili2_adi, yetkili2_unvani, yetkili2_tc, yetkili2_telefon,
      // Banka 1
      banka_adi, banka_sube, iban, hesap_no,
      // Banka 2 (yeni)
      banka2_adi, banka2_sube, banka2_iban,
      // SGK ve Resmi (yeni)
      sgk_sicil_no, kep_adresi, nace_kodu,
      // Kapasite (yeni)
      gunluk_uretim_kapasitesi, personel_kapasitesi,
      // Görsel (yeni)
      logo_url, kase_imza_url,
      // Referanslar (yeni)
      referanslar, is_deneyim_belgeleri,
      // Durum
      varsayilan, aktif, notlar
    } = req.body;
    
    const sql = `
      UPDATE firmalar SET
        unvan = COALESCE($1, unvan),
        kisa_ad = $2,
        vergi_dairesi = $3,
        vergi_no = $4,
        ticaret_sicil_no = $5,
        mersis_no = $6,
        adres = $7,
        il = $8,
        ilce = $9,
        posta_kodu = $10,
        telefon = $11,
        fax = $12,
        email = $13,
        web_sitesi = $14,
        yetkili_adi = $15,
        yetkili_unvani = $16,
        yetkili_tc = $17,
        yetkili_telefon = $18,
        yetkili_email = $19,
        imza_yetkisi = $20,
        yetkili2_adi = $21,
        yetkili2_unvani = $22,
        yetkili2_tc = $23,
        yetkili2_telefon = $24,
        banka_adi = $25,
        banka_sube = $26,
        iban = $27,
        hesap_no = $28,
        banka2_adi = $29,
        banka2_sube = $30,
        banka2_iban = $31,
        sgk_sicil_no = $32,
        kep_adresi = $33,
        nace_kodu = $34,
        gunluk_uretim_kapasitesi = $35,
        personel_kapasitesi = $36,
        logo_url = $37,
        kase_imza_url = $38,
        referanslar = COALESCE($39, referanslar),
        is_deneyim_belgeleri = COALESCE($40, is_deneyim_belgeleri),
        varsayilan = COALESCE($41, varsayilan),
        aktif = COALESCE($42, aktif),
        notlar = $43,
        updated_at = NOW()
      WHERE id = $44
      RETURNING *
    `;
    
    const result = await query(sql, [
      unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
      adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
      yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
      yetkili2_adi, yetkili2_unvani, yetkili2_tc, yetkili2_telefon,
      banka_adi, banka_sube, iban, hesap_no,
      banka2_adi, banka2_sube, banka2_iban,
      sgk_sicil_no, kep_adresi, nace_kodu,
      gunluk_uretim_kapasitesi, personel_kapasitesi,
      logo_url, kase_imza_url,
      referanslar ? JSON.stringify(referanslar) : null,
      is_deneyim_belgeleri ? JSON.stringify(is_deneyim_belgeleri) : null,
      varsayilan, aktif, notlar,
      id
    ]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }
    
    logAPI('Firma Güncellendi', { id, unvan });
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Firma başarıyla güncellendi'
    });
    
  } catch (error) {
    logError('Firma Güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/belge:
 *   post:
 *     summary: Firma belgesi yükle
 *     tags: [Firmalar]
 */
router.post('/:id/belge', upload.single('dosya'), async (req, res) => {
  try {
    const { id } = req.params;
    const { belge_tipi, tarih } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi' });
    }
    
    const dosyaUrl = `/uploads/firmalar/${req.file.filename}`;
    
    // Belge tipine göre güncelle
    const belgeAlanlari = {
      vergi_levhasi: { url: 'vergi_levhasi_url', tarih: 'vergi_levhasi_tarih' },
      sicil_gazetesi: { url: 'sicil_gazetesi_url', tarih: 'sicil_gazetesi_tarih' },
      imza_sirküleri: { url: 'imza_sirküleri_url', tarih: 'imza_sirküleri_tarih' },
      faaliyet_belgesi: { url: 'faaliyet_belgesi_url', tarih: 'faaliyet_belgesi_tarih' },
      iso_sertifika: { url: 'iso_sertifika_url', tarih: 'iso_sertifika_tarih' },
      haccp_sertifika: { url: 'haccp_sertifika_url', tarih: 'haccp_sertifika_tarih' },
      tse_belgesi: { url: 'tse_belgesi_url', tarih: 'tse_belgesi_tarih' },
      halal_sertifika: { url: 'halal_sertifika_url', tarih: 'halal_sertifika_tarih' },
      logo: { url: 'logo_url', tarih: null },
      kase_imza: { url: 'kase_imza_url', tarih: null }
    };
    
    if (belgeAlanlari[belge_tipi]) {
      const alan = belgeAlanlari[belge_tipi];
      const sql = `UPDATE firmalar SET ${alan.url} = $1, ${alan.tarih} = $2 WHERE id = $3 RETURNING *`;
      const result = await query(sql, [dosyaUrl, tarih || null, id]);
      
      res.json({
        success: true,
        data: result.rows[0],
        message: 'Belge başarıyla yüklendi'
      });
    } else {
      // Ek belge olarak ekle
      const sql = `
        UPDATE firmalar 
        SET ek_belgeler = COALESCE(ek_belgeler, '[]'::jsonb) || $1::jsonb
        WHERE id = $2
        RETURNING *
      `;
      const ekBelge = JSON.stringify([{ ad: belge_tipi, url: dosyaUrl, tarih: tarih || null }]);
      const result = await query(sql, [ekBelge, id]);
      
      res.json({
        success: true,
        data: result.rows[0],
        message: 'Ek belge başarıyla eklendi'
      });
    }
    
  } catch (error) {
    logError('Belge Yükle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/varsayilan:
 *   patch:
 *     summary: Firmayı varsayılan yap
 *     tags: [Firmalar]
 */
router.patch('/:id/varsayilan', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Trigger otomatik olarak diğerlerini false yapacak
    const result = await query(
      'UPDATE firmalar SET varsayilan = true WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Varsayılan firma güncellendi'
    });
    
  } catch (error) {
    logError('Varsayılan Firma Güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}:
 *   delete:
 *     summary: Firma sil
 *     tags: [Firmalar]
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query('DELETE FROM firmalar WHERE id = $1 RETURNING *', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }
    
    logAPI('Firma Silindi', { id, unvan: result.rows[0].unvan });
    
    res.json({
      success: true,
      message: 'Firma başarıyla silindi'
    });
    
  } catch (error) {
    logError('Firma Sil', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/belge-tipleri:
 *   get:
 *     summary: Desteklenen belge tiplerini listele
 *     tags: [Firmalar]
 */
router.get('/belge-tipleri', async (req, res) => {
  try {
    const tipler = getDesteklenenBelgeTipleri();
    res.json({ success: true, data: tipler });
  } catch (error) {
    logError('Belge Tipleri', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/analyze-belge:
 *   post:
 *     summary: Belgeyi AI ile analiz et ve firma bilgilerini çıkar
 *     tags: [Firmalar]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - name: dosya
 *         in: formData
 *         type: file
 *         required: true
 *       - name: belge_tipi
 *         in: formData
 *         type: string
 *         required: true
 *         enum: [vergi_levhasi, sicil_gazetesi, imza_sirküleri, faaliyet_belgesi, iso_sertifika]
 */
router.post('/analyze-belge', upload.single('dosya'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi' });
    }

    const { belge_tipi } = req.body;
    if (!belge_tipi) {
      return res.status(400).json({ success: false, error: 'Belge tipi belirtilmedi' });
    }

    console.log(`🔍 Belge analizi başlıyor: ${belge_tipi} - ${req.file.originalname}`);

    // AI ile analiz et
    const analizSonucu = await analyzeFirmaBelgesi(
      req.file.path,
      belge_tipi,
      req.file.mimetype
    );

    // Dosya URL'ini ekle
    const dosyaUrl = `/uploads/firmalar/${req.file.filename}`;

    res.json({
      success: true,
      analiz: analizSonucu,
      dosya: {
        url: dosyaUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      },
      message: 'Belge başarıyla analiz edildi'
    });

  } catch (error) {
    logError('Belge Analiz', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/analyze-and-save:
 *   post:
 *     summary: Belgeyi analiz et, firma bilgilerini güncelle ve belgeyi kaydet
 *     tags: [Firmalar]
 */
router.post('/:id/analyze-and-save', upload.single('dosya'), async (req, res) => {
  try {
    const { id } = req.params;
    const { belge_tipi, auto_fill } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi' });
    }

    // Firma var mı kontrol et
    const firmaCheck = await query('SELECT * FROM firmalar WHERE id = $1', [id]);
    if (firmaCheck.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }

    // AI ile analiz et
    const analizSonucu = await analyzeFirmaBelgesi(
      req.file.path,
      belge_tipi,
      req.file.mimetype
    );

    const dosyaUrl = `/uploads/firmalar/${req.file.filename}`;

    // Belge URL'ini güncelle
    const belgeAlanlari = {
      vergi_levhasi: { url: 'vergi_levhasi_url', tarih: 'vergi_levhasi_tarih' },
      sicil_gazetesi: { url: 'sicil_gazetesi_url', tarih: 'sicil_gazetesi_tarih' },
      imza_sirküleri: { url: 'imza_sirküleri_url', tarih: 'imza_sirküleri_tarih' },
      faaliyet_belgesi: { url: 'faaliyet_belgesi_url', tarih: 'faaliyet_belgesi_tarih' },
      iso_sertifika: { url: 'iso_sertifika_url', tarih: 'iso_sertifika_tarih' }
    };

    let updatedFirma = firmaCheck.rows[0];

    // Belge URL'ini kaydet
    if (belgeAlanlari[belge_tipi]) {
      const alan = belgeAlanlari[belge_tipi];
      const belgeResult = await query(
        `UPDATE firmalar SET ${alan.url} = $1, ${alan.tarih} = $2 WHERE id = $3 RETURNING *`,
        [dosyaUrl, new Date().toISOString().split('T')[0], id]
      );
      updatedFirma = belgeResult.rows[0];
    }

    // auto_fill true ise analiz sonuçlarını firmaya uygula
    if (auto_fill === 'true' && analizSonucu.success && analizSonucu.data) {
      const data = analizSonucu.data;
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      // Sadece dolu ve mevcut firmada boş olan alanları güncelle
      const alanMap = {
        'unvan': 'unvan',
        'vergi_dairesi': 'vergi_dairesi',
        'vergi_no': 'vergi_no',
        'ticaret_sicil_no': 'ticaret_sicil_no',
        'mersis_no': 'mersis_no',
        'adres': 'adres',
        'il': 'il',
        'ilce': 'ilce',
        'telefon': 'telefon',
        'yetkili_adi': 'yetkili_adi',
        'yetkili_tc': 'yetkili_tc',
        'yetkili_unvani': 'yetkili_unvani',
        'imza_yetkisi': 'imza_yetkisi'
      };

      for (const [aiKey, dbKey] of Object.entries(alanMap)) {
        if (data[aiKey] && !updatedFirma[dbKey]) {
          updateFields.push(`${dbKey} = $${paramIndex}`);
          updateValues.push(data[aiKey]);
          paramIndex++;
        }
      }

      if (updateFields.length > 0) {
        updateValues.push(id);
        const updateSql = `UPDATE firmalar SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const updateResult = await query(updateSql, updateValues);
        updatedFirma = updateResult.rows[0];
      }
    }

    logAPI('Belge Analiz ve Kaydet', { id, belge_tipi, auto_fill });

    res.json({
      success: true,
      firma: updatedFirma,
      analiz: analizSonucu,
      dosya: {
        url: dosyaUrl,
        originalName: req.file.originalname
      },
      message: 'Belge analiz edildi ve kaydedildi'
    });

  } catch (error) {
    logError('Belge Analiz ve Kaydet', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// FİRMA ORTAKLARI API
// =====================================================

/**
 * @swagger
 * /api/firmalar/{id}/ortaklar:
 *   get:
 *     summary: Firma ortaklarını listele
 *     tags: [Firmalar]
 */
router.get('/:id/ortaklar', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT * FROM firma_ortaklari 
      WHERE firma_id = $1 AND aktif = TRUE
      ORDER BY hisse_orani DESC NULLS LAST, ad_soyad
    `, [id]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logError('Firma ortakları listele', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/ortaklar:
 *   post:
 *     summary: Firma ortağı ekle
 *     tags: [Firmalar]
 */
router.post('/:id/ortaklar', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      ad_soyad, tc_kimlik, hisse_orani, gorevi, imza_yetkisi,
      temsil_yetkisi_baslangic, temsil_yetkisi_bitis,
      telefon, email, adres, notlar 
    } = req.body;
    
    if (!ad_soyad) {
      return res.status(400).json({ success: false, error: 'Ad soyad zorunludur' });
    }
    
    const result = await query(`
      INSERT INTO firma_ortaklari (
        firma_id, ad_soyad, tc_kimlik, hisse_orani, gorevi, imza_yetkisi,
        temsil_yetkisi_baslangic, temsil_yetkisi_bitis,
        telefon, email, adres, notlar
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      id, ad_soyad, tc_kimlik, hisse_orani, gorevi, imza_yetkisi || false,
      temsil_yetkisi_baslangic, temsil_yetkisi_bitis,
      telefon, email, adres, notlar
    ]);
    
    logAPI('Firma ortağı eklendi', { firma_id: id, ortak_id: result.rows[0].id });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logError('Firma ortağı ekle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{firmaId}/ortaklar/{ortakId}:
 *   put:
 *     summary: Firma ortağı güncelle
 *     tags: [Firmalar]
 */
router.put('/:firmaId/ortaklar/:ortakId', async (req, res) => {
  try {
    const { firmaId, ortakId } = req.params;
    const { 
      ad_soyad, tc_kimlik, hisse_orani, gorevi, imza_yetkisi,
      temsil_yetkisi_baslangic, temsil_yetkisi_bitis,
      telefon, email, adres, notlar, aktif 
    } = req.body;
    
    const result = await query(`
      UPDATE firma_ortaklari SET
        ad_soyad = COALESCE($1, ad_soyad),
        tc_kimlik = $2,
        hisse_orani = $3,
        gorevi = $4,
        imza_yetkisi = COALESCE($5, imza_yetkisi),
        temsil_yetkisi_baslangic = $6,
        temsil_yetkisi_bitis = $7,
        telefon = $8,
        email = $9,
        adres = $10,
        notlar = $11,
        aktif = COALESCE($12, aktif),
        updated_at = NOW()
      WHERE id = $13 AND firma_id = $14
      RETURNING *
    `, [
      ad_soyad, tc_kimlik, hisse_orani, gorevi, imza_yetkisi,
      temsil_yetkisi_baslangic, temsil_yetkisi_bitis,
      telefon, email, adres, notlar, aktif, ortakId, firmaId
    ]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Ortak bulunamadı' });
    }
    
    logAPI('Firma ortağı güncellendi', { firma_id: firmaId, ortak_id: ortakId });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logError('Firma ortağı güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{firmaId}/ortaklar/{ortakId}:
 *   delete:
 *     summary: Firma ortağı sil
 *     tags: [Firmalar]
 */
router.delete('/:firmaId/ortaklar/:ortakId', async (req, res) => {
  try {
    const { firmaId, ortakId } = req.params;
    
    const result = await query(
      'DELETE FROM firma_ortaklari WHERE id = $1 AND firma_id = $2 RETURNING *',
      [ortakId, firmaId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Ortak bulunamadı' });
    }
    
    logAPI('Firma ortağı silindi', { firma_id: firmaId, ortak_id: ortakId });
    res.json({ success: true, message: 'Ortak silindi' });
  } catch (error) {
    logError('Firma ortağı sil', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// FİRMA DÖKÜMANLARI API (GELİŞMİŞ)
// =====================================================

/**
 * @swagger
 * /api/firmalar/{id}/dokumanlar:
 *   get:
 *     summary: Firma dökümanlarını listele
 *     tags: [Firmalar]
 */
router.get('/:id/dokumanlar', async (req, res) => {
  try {
    const { id } = req.params;
    const { kategori, onaylanmis } = req.query;
    
    let sql = `
      SELECT * FROM firma_dokumanlari 
      WHERE firma_id = $1 AND aktif = TRUE
    `;
    const params = [id];
    let paramIndex = 2;
    
    if (kategori) {
      sql += ` AND belge_kategori = $${paramIndex}`;
      params.push(kategori);
      paramIndex++;
    }
    
    if (onaylanmis !== undefined) {
      sql += ` AND onaylanmis = $${paramIndex}`;
      params.push(onaylanmis === 'true');
    }
    
    sql += ' ORDER BY belge_kategori, belge_tipi, created_at DESC';
    
    const result = await query(sql, params);
    
    // Kategorilere göre grupla
    const kategoriler = {};
    result.rows.forEach(doc => {
      if (!kategoriler[doc.belge_kategori]) {
        kategoriler[doc.belge_kategori] = [];
      }
      kategoriler[doc.belge_kategori].push(doc);
    });
    
    res.json({ 
      success: true, 
      data: result.rows,
      kategoriler,
      toplam: result.rowCount
    });
  } catch (error) {
    logError('Firma dökümanları listele', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/dokumanlar:
 *   post:
 *     summary: Firma dökümanı ekle ve AI ile analiz et
 *     tags: [Firmalar]
 */
router.post('/:id/dokumanlar', upload.single('dosya'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      belge_tipi, 
      belge_kategori = 'kurumsal',
      belge_no, 
      verilis_tarihi, 
      gecerlilik_tarihi,
      veren_kurum,
      aciklama,
      auto_fill = 'false' 
    } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenemedi' });
    }
    
    if (!belge_tipi) {
      return res.status(400).json({ success: false, error: 'Belge tipi zorunludur' });
    }
    
    // Dosya URL oluştur
    const dosyaUrl = `/uploads/firmalar/${req.file.filename}`;
    
    // AI analizi yap (otomatik tip algılama dahil)
    let analizSonucu = null;
    let ai_cikartilan_veriler = {};
    let ai_guven_skoru = null;
    let detectedBelgeTipi = belge_tipi;
    
    try {
      analizSonucu = await analyzeFirmaBelgesi(
        req.file.path, 
        belge_tipi, 
        req.file.mimetype
      );
      
      if (analizSonucu.success) {
        ai_cikartilan_veriler = analizSonucu.data;
        ai_guven_skoru = analizSonucu.data.guven_skoru || 0.8;
        // AI algıladığı belge tipini kullan
        if (analizSonucu.belgeTipi && analizSonucu.belgeTipi !== 'auto') {
          detectedBelgeTipi = analizSonucu.belgeTipi;
        }
      }
    } catch (aiError) {
      console.warn('AI analizi başarısız:', aiError.message);
    }
    
    // "auto" seçilmişse ve AI algılamamışsa, "diger" olarak kaydet
    if (detectedBelgeTipi === 'auto') {
      detectedBelgeTipi = 'diger';
    }
    
    // Dökümanı veritabanına kaydet (algılanan belge tipi ile)
    const result = await query(`
      INSERT INTO firma_dokumanlari (
        firma_id, belge_tipi, belge_kategori, dosya_adi, dosya_url,
        dosya_boyutu, mime_type, belge_no, verilis_tarihi, gecerlilik_tarihi,
        veren_kurum, aciklama,
        ai_analiz_yapildi, ai_analiz_tarihi, ai_cikartilan_veriler, ai_guven_skoru
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), $14, $15)
      RETURNING *
    `, [
      id, detectedBelgeTipi, belge_kategori, req.file.originalname, dosyaUrl,
      req.file.size, req.file.mimetype, belge_no, verilis_tarihi || null, 
      gecerlilik_tarihi || null, veren_kurum, aciklama,
      analizSonucu?.success || false, ai_cikartilan_veriler, ai_guven_skoru
    ]);
    
    const savedDoc = result.rows[0];
    
    // Auto-fill aktifse firma bilgilerini güncelle
    let updatedFirma = null;
    if (auto_fill === 'true' && analizSonucu?.success && ai_cikartilan_veriler) {
      updatedFirma = await applyAIDataToFirma(id, ai_cikartilan_veriler);
    }
    
    logAPI('Firma dökümanı eklendi', { firma_id: id, dokuman_id: savedDoc.id, belge_tipi });
    
    res.status(201).json({ 
      success: true, 
      data: savedDoc,
      analiz: analizSonucu,
      firma: updatedFirma,
      message: analizSonucu?.success 
        ? 'Döküman yüklendi ve AI ile analiz edildi'
        : 'Döküman yüklendi (AI analizi yapılamadı)'
    });
    
  } catch (error) {
    logError('Firma dökümanı ekle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{firmaId}/dokumanlar/{dokumanId}:
 *   put:
 *     summary: Firma dökümanı güncelle
 *     tags: [Firmalar]
 */
router.put('/:firmaId/dokumanlar/:dokumanId', async (req, res) => {
  try {
    const { firmaId, dokumanId } = req.params;
    const { 
      belge_no, verilis_tarihi, gecerlilik_tarihi,
      veren_kurum, aciklama, onaylanmis, onaylayan_kullanici
    } = req.body;
    
    const result = await query(`
      UPDATE firma_dokumanlari SET
        belge_no = COALESCE($1, belge_no),
        verilis_tarihi = $2,
        gecerlilik_tarihi = $3,
        veren_kurum = COALESCE($4, veren_kurum),
        aciklama = COALESCE($5, aciklama),
        onaylanmis = COALESCE($6, onaylanmis),
        onaylayan_kullanici = $7,
        onay_tarihi = CASE WHEN $6 = TRUE THEN NOW() ELSE onay_tarihi END,
        updated_at = NOW()
      WHERE id = $8 AND firma_id = $9
      RETURNING *
    `, [
      belge_no, verilis_tarihi || null, gecerlilik_tarihi || null,
      veren_kurum, aciklama, onaylanmis, onaylayan_kullanici,
      dokumanId, firmaId
    ]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı' });
    }
    
    logAPI('Firma dökümanı güncellendi', { firma_id: firmaId, dokuman_id: dokumanId });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logError('Firma dökümanı güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{firmaId}/dokumanlar/{dokumanId}:
 *   delete:
 *     summary: Firma dökümanı sil
 *     tags: [Firmalar]
 */
router.delete('/:firmaId/dokumanlar/:dokumanId', async (req, res) => {
  try {
    const { firmaId, dokumanId } = req.params;
    
    // Soft delete
    const result = await query(`
      UPDATE firma_dokumanlari SET aktif = FALSE, updated_at = NOW()
      WHERE id = $1 AND firma_id = $2
      RETURNING *
    `, [dokumanId, firmaId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı' });
    }
    
    logAPI('Firma dökümanı silindi', { firma_id: firmaId, dokuman_id: dokumanId });
    res.json({ success: true, message: 'Döküman silindi' });
  } catch (error) {
    logError('Firma dökümanı sil', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{firmaId}/dokumanlar/{dokumanId}/yeniden-analiz:
 *   post:
 *     summary: Dökümanı yeniden AI ile analiz et
 *     tags: [Firmalar]
 */
router.post('/:firmaId/dokumanlar/:dokumanId/yeniden-analiz', async (req, res) => {
  try {
    const { firmaId, dokumanId } = req.params;
    const { auto_fill = 'false' } = req.body;
    
    // Dökümanı getir
    const docResult = await query(
      'SELECT * FROM firma_dokumanlari WHERE id = $1 AND firma_id = $2',
      [dokumanId, firmaId]
    );
    
    if (docResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı' });
    }
    
    const doc = docResult.rows[0];
    const filePath = path.join(process.cwd(), doc.dosya_url);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    }
    
    // Yeniden AI analizi (belge tipi otomatik algılansın)
    const analizSonucu = await analyzeFirmaBelgesi(filePath, 'auto', doc.mime_type);
    
    // Algılanan belge tipini al
    const detectedBelgeTipi = analizSonucu.belgeTipi || doc.belge_tipi;
    
    // Dökümanı güncelle (algılanan belge tipi ile)
    await query(`
      UPDATE firma_dokumanlari SET
        belge_tipi = $1,
        ai_analiz_yapildi = $2,
        ai_analiz_tarihi = NOW(),
        ai_cikartilan_veriler = $3,
        ai_guven_skoru = $4,
        ai_hata_mesaji = $5,
        updated_at = NOW()
      WHERE id = $6
    `, [
      detectedBelgeTipi,
      analizSonucu.success,
      analizSonucu.success ? analizSonucu.data : {},
      analizSonucu.data?.guven_skoru || null,
      analizSonucu.success ? null : analizSonucu.error,
      dokumanId
    ]);
    
    // Auto-fill aktifse firma bilgilerini güncelle
    let updatedFirma = null;
    if (auto_fill === 'true' && analizSonucu.success) {
      updatedFirma = await applyAIDataToFirma(firmaId, analizSonucu.data);
    }
    
    logAPI('Döküman yeniden analiz edildi', { firma_id: firmaId, dokuman_id: dokumanId });
    
    res.json({
      success: true,
      analiz: analizSonucu,
      firma: updatedFirma,
      message: analizSonucu.success 
        ? 'Döküman başarıyla analiz edildi'
        : 'Analiz başarısız: ' + analizSonucu.error
    });
    
  } catch (error) {
    logError('Döküman yeniden analiz', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{firmaId}/dokumanlar/{dokumanId}/veriyi-uygula:
 *   post:
 *     summary: AI'ın çıkardığı verileri firmaya uygula
 *     tags: [Firmalar]
 */
router.post('/:firmaId/dokumanlar/:dokumanId/veriyi-uygula', async (req, res) => {
  try {
    const { firmaId, dokumanId } = req.params;
    const { secilenAlanlar } = req.body; // Kullanıcının seçtiği alanlar
    
    // Dökümanı getir
    const docResult = await query(
      'SELECT ai_cikartilan_veriler FROM firma_dokumanlari WHERE id = $1 AND firma_id = $2',
      [dokumanId, firmaId]
    );
    
    if (docResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı' });
    }
    
    const aiData = docResult.rows[0].ai_cikartilan_veriler;
    
    if (!aiData || Object.keys(aiData).length === 0) {
      return res.status(400).json({ success: false, error: 'AI verisi bulunamadı' });
    }
    
    // Sadece seçilen alanları filtrele
    const dataToApply = secilenAlanlar 
      ? Object.fromEntries(
          Object.entries(aiData).filter(([key]) => secilenAlanlar.includes(key))
        )
      : aiData;
    
    // Firmaya uygula
    const updatedFirma = await applyAIDataToFirma(firmaId, dataToApply, true);
    
    // Uygulanan alanları döküman kaydına işle
    await query(`
      UPDATE firma_dokumanlari SET
        ai_uygulanacak_alanlar = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(secilenAlanlar || Object.keys(aiData)), dokumanId]);
    
    logAPI('AI verisi firmaya uygulandı', { firma_id: firmaId, dokuman_id: dokumanId });
    
    res.json({
      success: true,
      firma: updatedFirma,
      uygulaananAlanlar: Object.keys(dataToApply),
      message: 'Veriler başarıyla firmaya uygulandı'
    });
    
  } catch (error) {
    logError('AI verisi uygula', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * AI verilerini firma kaydına uygula (yardımcı fonksiyon)
 */
async function applyAIDataToFirma(firmaId, aiData, forceUpdate = false) {
  // Mevcut firma verilerini al
  const firmaResult = await query('SELECT * FROM firmalar WHERE id = $1', [firmaId]);
  if (firmaResult.rowCount === 0) return null;
  
  const firma = firmaResult.rows[0];
  
  // Alan eşleştirmeleri
  const alanMap = {
    'unvan': 'unvan',
    'vergi_dairesi': 'vergi_dairesi',
    'vergi_no': 'vergi_no',
    'ticaret_sicil_no': 'ticaret_sicil_no',
    'mersis_no': 'mersis_no',
    'adres': 'adres',
    'il': 'il',
    'ilce': 'ilce',
    'telefon': 'telefon',
    'yetkili_adi': 'yetkili_adi',
    'yetkili_tc': 'yetkili_tc',
    'yetkili_unvani': 'yetkili_unvani',
    'imza_yetkisi': 'imza_yetkisi',
    'faaliyet_kodu': 'faaliyet_kodu',
    'kep_adresi': 'kep_adresi',
    'web_sitesi': 'web_sitesi',
    'email': 'email',
    'sgk_sicil_no': 'sgk_sicil_no'
  };
  
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;
  
  for (const [aiKey, dbKey] of Object.entries(alanMap)) {
    // AI verisinde varsa ve (firma alanı boşsa veya forceUpdate aktifse)
    if (aiData[aiKey] && (forceUpdate || !firma[dbKey])) {
      updateFields.push(`${dbKey} = $${paramIndex}`);
      updateValues.push(aiData[aiKey]);
      paramIndex++;
    }
  }
  
  if (updateFields.length === 0) {
    return firma;
  }
  
  updateValues.push(firmaId);
  const updateSql = `UPDATE firmalar SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;
  const updateResult = await query(updateSql, updateValues);
  
  return updateResult.rows[0];
}

// =====================================================
// FİRMA EXPORT API (PDF/Excel/ZIP)
// =====================================================

/**
 * @swagger
 * /api/firmalar/{id}/export:
 *   get:
 *     summary: Firma bilgilerini export et
 *     tags: [Firmalar]
 */
router.get('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    
    // Firma bilgilerini al
    const firmaResult = await query('SELECT * FROM firmalar WHERE id = $1', [id]);
    if (firmaResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }
    
    const firma = firmaResult.rows[0];
    
    // İlişkili verileri al
    const [ortaklarResult, dokumanlarResult, projelerResult] = await Promise.all([
      query('SELECT * FROM firma_ortaklari WHERE firma_id = $1 AND aktif = TRUE', [id]),
      query('SELECT id, belge_tipi, belge_kategori, dosya_adi, dosya_url, belge_no, verilis_tarihi, gecerlilik_tarihi, veren_kurum FROM firma_dokumanlari WHERE firma_id = $1 AND aktif = TRUE', [id]),
      query('SELECT id, ad, musteri, durum, sozlesme_baslangic_tarihi, sozlesme_bitis_tarihi, sozlesme_bedeli FROM projeler WHERE firma_id = $1', [id])
    ]);
    
    const exportData = {
      firma,
      ortaklar: ortaklarResult.rows,
      dokumanlar: dokumanlarResult.rows,
      projeler: projelerResult.rows,
      exportTarihi: new Date().toISOString(),
      exportFormat: format
    };
    
    if (format === 'json') {
      res.json({ success: true, data: exportData });
    } else if (format === 'excel') {
      // Excel export
      const xlsx = await import('xlsx');
      const workbook = xlsx.utils.book_new();
      
      // Firma sayfası
      const firmaSheet = xlsx.utils.json_to_sheet([firma]);
      xlsx.utils.book_append_sheet(workbook, firmaSheet, 'Firma');
      
      // Ortaklar sayfası
      if (ortaklarResult.rows.length > 0) {
        const ortaklarSheet = xlsx.utils.json_to_sheet(ortaklarResult.rows);
        xlsx.utils.book_append_sheet(workbook, ortaklarSheet, 'Ortaklar');
      }
      
      // Dökümanlar sayfası
      if (dokumanlarResult.rows.length > 0) {
        const dokumanlarSheet = xlsx.utils.json_to_sheet(dokumanlarResult.rows);
        xlsx.utils.book_append_sheet(workbook, dokumanlarSheet, 'Dökümanlar');
      }
      
      // Projeler sayfası
      if (projelerResult.rows.length > 0) {
        const projelerSheet = xlsx.utils.json_to_sheet(projelerResult.rows);
        xlsx.utils.book_append_sheet(workbook, projelerSheet, 'Projeler');
      }
      
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="firma_${firma.kisa_ad || firma.id}_${Date.now()}.xlsx"`);
      res.send(buffer);
      
    } else {
      res.status(400).json({ success: false, error: 'Geçersiz format. Desteklenen: json, excel' });
    }
    
  } catch (error) {
    logError('Firma export', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/dokumanlar-zip:
 *   get:
 *     summary: Tüm firma dökümanlarını ZIP olarak indir
 *     tags: [Firmalar]
 */
router.get('/:id/dokumanlar-zip', async (req, res) => {
  try {
    const { id } = req.params;
    const { kategori } = req.query;
    
    // Dökümanları al
    let sql = 'SELECT * FROM firma_dokumanlari WHERE firma_id = $1 AND aktif = TRUE';
    const params = [id];
    
    if (kategori) {
      sql += ' AND belge_kategori = $2';
      params.push(kategori);
    }
    
    const result = await query(sql, params);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı' });
    }
    
    // ZIP oluştur
    const archiver = (await import('archiver')).default;
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="firma_dokumanlar_${id}_${Date.now()}.zip"`);
    
    archive.pipe(res);
    
    // Her dökümanı ZIP'e ekle
    for (const doc of result.rows) {
      const filePath = path.join(process.cwd(), doc.dosya_url);
      if (fs.existsSync(filePath)) {
        const folderName = doc.belge_kategori || 'diger';
        archive.file(filePath, { name: `${folderName}/${doc.dosya_adi}` });
      }
    }
    
    await archive.finalize();
    
    logAPI('Firma dökümanları ZIP', { firma_id: id, dokuman_sayisi: result.rowCount });
    
  } catch (error) {
    logError('Firma dökümanları ZIP', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Desteklenen belge tiplerini döndür
 */
router.get('/belge-tipleri/listele', async (req, res) => {
  try {
    const belgeTipleri = getDesteklenenBelgeTipleri();
    
    const kategoriler = {
      kurumsal: [
        { value: 'vergi_levhasi', label: 'Vergi Levhası' },
        { value: 'sicil_gazetesi', label: 'Ticaret Sicil Gazetesi' },
        { value: 'imza_sirküleri', label: 'İmza Sirküleri' },
        { value: 'faaliyet_belgesi', label: 'Faaliyet/Oda Kayıt Belgesi' },
        { value: 'kapasite_raporu', label: 'Kapasite Raporu' },
        { value: 'isletme_kayit', label: 'İşletme Kayıt Belgesi' }
      ],
      yetki: [
        { value: 'vekaletname', label: 'Vekaletname' },
        { value: 'yetki_belgesi', label: 'Yetki Belgesi' },
        { value: 'temsil_ilmuhaberi', label: 'Temsil İlmühaberi' }
      ],
      mali: [
        { value: 'sgk_borcu_yoktur', label: 'SGK Borcu Yoktur' },
        { value: 'vergi_borcu_yoktur', label: 'Vergi Borcu Yoktur' },
        { value: 'bilanco', label: 'Bilanço' },
        { value: 'gelir_tablosu', label: 'Gelir Tablosu' }
      ],
      sertifika: [
        { value: 'iso_sertifika', label: 'ISO Sertifikası' },
        { value: 'haccp_sertifika', label: 'HACCP Sertifikası' },
        { value: 'tse_sertifika', label: 'TSE Belgesi' },
        { value: 'gida_uretim_izni', label: 'Gıda Üretim İzin Belgesi' },
        { value: 'cevre_izin', label: 'Çevre İzin/Lisans' },
        { value: 'yangin_guvenlik', label: 'Yangın Güvenlik Raporu' }
      ],
      referans: [
        { value: 'is_deneyim_belgesi', label: 'İş Deneyim Belgesi' },
        { value: 'referans_mektubu', label: 'Referans Mektubu' },
        { value: 'sozlesme_ornegi', label: 'Sözleşme Örneği' }
      ]
    };
    
    res.json({ 
      success: true, 
      data: belgeTipleri,
      kategoriler 
    });
  } catch (error) {
    logError('Belge tipleri listele', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// EKSTRA ALANLAR YÖNETİMİ
// =====================================================

/**
 * @swagger
 * /api/firmalar/alan-sablonlari:
 *   get:
 *     summary: Kullanılabilir alan şablonlarını listele
 */
router.get('/alan-sablonlari', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM firma_alan_sablonlari 
      WHERE aktif = true 
      ORDER BY kategori, sira
    `);
    
    // Kategorilere göre grupla
    const gruplu = {};
    result.rows.forEach(alan => {
      if (!gruplu[alan.kategori]) gruplu[alan.kategori] = [];
      gruplu[alan.kategori].push(alan);
    });
    
    res.json({ success: true, data: result.rows, gruplu });
  } catch (error) {
    logError('Alan şablonları listele', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/alan-sablonlari:
 *   post:
 *     summary: Yeni alan şablonu ekle
 */
router.post('/alan-sablonlari', async (req, res) => {
  try {
    const { alan_adi, gorunen_ad, alan_tipi = 'text', kategori = 'diger' } = req.body;
    
    if (!alan_adi || !gorunen_ad) {
      return res.status(400).json({ success: false, error: 'Alan adı ve görünen ad zorunlu' });
    }
    
    // alan_adi'nı snake_case'e çevir
    const cleanAlanAdi = alan_adi.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
    
    const result = await query(`
      INSERT INTO firma_alan_sablonlari (alan_adi, gorunen_ad, alan_tipi, kategori)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [cleanAlanAdi, gorunen_ad, alan_tipi, kategori]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, error: 'Bu alan adı zaten mevcut' });
    }
    logError('Alan şablonu ekle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/ekstra-alanlar:
 *   get:
 *     summary: Firmanın ekstra alanlarını getir
 */
router.get('/:id/ekstra-alanlar', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT ekstra_alanlar FROM firmalar WHERE id = $1
    `, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }
    
    res.json({ success: true, data: result.rows[0].ekstra_alanlar || {} });
  } catch (error) {
    logError('Ekstra alanlar getir', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/ekstra-alanlar:
 *   put:
 *     summary: Firmanın ekstra alanlarını güncelle
 */
router.put('/:id/ekstra-alanlar', async (req, res) => {
  try {
    const { id } = req.params;
    const { ekstra_alanlar } = req.body;
    
    const result = await query(`
      UPDATE firmalar 
      SET ekstra_alanlar = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, ekstra_alanlar
    `, [JSON.stringify(ekstra_alanlar), id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }
    
    logAPI('Firma ekstra alanlar güncellendi', { firma_id: id });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logError('Ekstra alanlar güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/ekstra-alan:
 *   patch:
 *     summary: Tek bir ekstra alanı güncelle veya ekle
 */
router.patch('/:id/ekstra-alan', async (req, res) => {
  try {
    const { id } = req.params;
    const { alan_adi, deger } = req.body;
    
    if (!alan_adi) {
      return res.status(400).json({ success: false, error: 'Alan adı zorunlu' });
    }
    
    // JSONB alanını güncelle
    const result = await query(`
      UPDATE firmalar 
      SET ekstra_alanlar = COALESCE(ekstra_alanlar, '{}'::jsonb) || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, ekstra_alanlar
    `, [JSON.stringify({ [alan_adi]: deger }), id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }
    
    logAPI('Firma ekstra alan güncellendi', { firma_id: id, alan: alan_adi });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logError('Ekstra alan güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/firmalar/{id}/ekstra-alan/{alan}:
 *   delete:
 *     summary: Bir ekstra alanı sil
 */
router.delete('/:id/ekstra-alan/:alan', async (req, res) => {
  try {
    const { id, alan } = req.params;
    
    const result = await query(`
      UPDATE firmalar 
      SET ekstra_alanlar = ekstra_alanlar - $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, ekstra_alanlar
    `, [alan, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Firma bulunamadı' });
    }
    
    logAPI('Firma ekstra alan silindi', { firma_id: id, alan });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logError('Ekstra alan sil', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
