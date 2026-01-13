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

const router = express.Router();

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
      unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
      adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
      yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
      banka_adi, banka_sube, iban, hesap_no,
      varsayilan, aktif, notlar
    } = req.body;
    
    const sql = `
      INSERT INTO firmalar (
        unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
        adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
        yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
        banka_adi, banka_sube, iban, hesap_no,
        varsayilan, aktif, notlar
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24,
        $25, $26, $27
      ) RETURNING *
    `;
    
    const result = await query(sql, [
      unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
      adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
      yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
      banka_adi, banka_sube, iban, hesap_no,
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
      unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
      adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
      yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
      banka_adi, banka_sube, iban, hesap_no,
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
        banka_adi = $21,
        banka_sube = $22,
        iban = $23,
        hesap_no = $24,
        varsayilan = COALESCE($25, varsayilan),
        aktif = COALESCE($26, aktif),
        notlar = $27
      WHERE id = $28
      RETURNING *
    `;
    
    const result = await query(sql, [
      unvan, kisa_ad, vergi_dairesi, vergi_no, ticaret_sicil_no, mersis_no,
      adres, il, ilce, posta_kodu, telefon, fax, email, web_sitesi,
      yetkili_adi, yetkili_unvani, yetkili_tc, yetkili_telefon, yetkili_email, imza_yetkisi,
      banka_adi, banka_sube, iban, hesap_no,
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
      iso_sertifika: { url: 'iso_sertifika_url', tarih: 'iso_sertifika_tarih' }
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

export default router;
