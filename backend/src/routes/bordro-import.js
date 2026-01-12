/**
 * Bordro Import Routes - Proje Bazlı Bordro İçe Aktarım
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../database.js';
import {
  analyzeBordroFile,
  saveBordroRecords,
  getProjePersonelleri,
  checkExistingBordro,
  createPersonelFromBordro,
  listTemplates,
  saveTemplate,
  saveTahakkuk,
  getTahakkuk
} from '../services/bordro-import-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Temp upload klasörü
const UPLOAD_DIR = path.join(__dirname, '../../temp/uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    cb(null, `bordro-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece Excel (.xlsx, .xls, .csv) veya PDF dosyaları desteklenir'));
    }
  }
});

/**
 * GET /api/bordro-import/projeler
 * Import için proje listesi
 */
router.get('/projeler', async (req, res) => {
  try {
    const sql = `
      SELECT 
        p.id,
        p.ad,
        p.kod,
        p.durum,
        COUNT(pp.id) FILTER (WHERE pp.aktif = TRUE) as personel_sayisi
      FROM projeler p
      LEFT JOIN proje_personelleri pp ON pp.proje_id = p.id
      WHERE p.durum = 'aktif'
      GROUP BY p.id
      ORDER BY p.ad
    `;
    
    const result = await query(sql);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Proje listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bordro-import/proje/:projeId/personeller
 * Proje personellerini getir
 */
router.get('/proje/:projeId/personeller', async (req, res) => {
  try {
    const { projeId } = req.params;
    const personeller = await getProjePersonelleri(projeId);
    res.json(personeller);
    
  } catch (error) {
    console.error('Proje personelleri hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bordro-import/check/:projeId/:yil/:ay
 * Mevcut bordro kontrolü
 */
router.get('/check/:projeId/:yil/:ay', async (req, res) => {
  try {
    const { projeId, yil, ay } = req.params;
    const existing = await checkExistingBordro(
      projeId === '0' ? null : parseInt(projeId),
      parseInt(yil),
      parseInt(ay)
    );
    
    res.json({
      kayit_sayisi: parseInt(existing.kayit_sayisi) || 0,
      toplam_net: parseFloat(existing.toplam_net) || 0
    });
    
  } catch (error) {
    console.error('Bordro kontrol hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bordro-import/analyze
 * Bordro dosyasını analiz et ve eşleştirme yap
 * Önce template kontrolü yapar, yoksa AI kullanır
 */
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }
    
    const { projeId, yil, ay, forceAI, templateId } = req.body;
    
    if (!yil || !ay) {
      return res.status(400).json({ error: 'Yıl ve ay bilgisi gerekli' });
    }
    
    console.log(`📥 Bordro analizi: Proje ${projeId || 'Genel'}, ${yil}/${ay}, forceAI=${forceAI}, templateId=${templateId}`);
    
    const result = await analyzeBordroFile(
      req.file.path,
      projeId ? parseInt(projeId) : null,
      parseInt(yil),
      parseInt(ay),
      {
        forceAI: forceAI === 'true' || forceAI === true,
        templateId: templateId ? parseInt(templateId) : null
      }
    );
    
    // Temp dosya yolunu sakla
    result.tempFile = req.file.path;
    result.originalFilename = req.file.originalname;
    
    res.json(result);
    
  } catch (error) {
    console.error('Bordro analiz hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bordro-import/confirm
 * Onaylanan bordro kayıtlarını kaydet
 * TAHAKKUK BİLGİLERİ de ayrıca kaydedilir
 */
router.post('/confirm', async (req, res) => {
  try {
    const { projeId, yil, ay, records, tempFile, originalFilename, createMissing, tahakkuk } = req.body;
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Kayıt bulunamadı' });
    }
    
    if (!yil || !ay) {
      return res.status(400).json({ error: 'Yıl ve ay bilgisi gerekli' });
    }
    
    console.log(`📥 Bordro kayıt: ${records.length} kayıt, Proje ${projeId || 'Genel'}, ${yil}/${ay}`);
    
    // Eşleşen kayıtları filtrele
    const matchedRecords = records.filter(r => r.personel_id);
    
    // Kaydet
    const result = await saveBordroRecords(
      matchedRecords,
      projeId ? parseInt(projeId) : null,
      parseInt(yil),
      parseInt(ay),
      originalFilename
    );
    
    // TAHAKKUK BİLGİLERİNİ DE KAYDET (PDF'den gelen özet)
    if (tahakkuk) {
      console.log('📊 TAHAKKUK BİLGİLERİ kaydediliyor...');
      await saveTahakkuk(
        tahakkuk,
        projeId ? parseInt(projeId) : null,
        parseInt(yil),
        parseInt(ay),
        originalFilename
      );
    }
    
    // Temp dosyayı sil
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Bordro kayıt hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bordro-import/create-personel
 * Bulunamayan personeli oluştur
 */
router.post('/create-personel', async (req, res) => {
  try {
    const { personel_adi, tc_kimlik, sgk_no, brut_maas, projeId } = req.body;
    
    if (!personel_adi) {
      return res.status(400).json({ error: 'Personel adı gerekli' });
    }
    
    // Record objesi oluştur
    const record = {
      personel_adi,
      tc_kimlik,
      sgk_no,
      brut_maas
    };
    
    const result = await createPersonelFromBordro(
      record,
      projeId ? parseInt(projeId) : null
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.error || 'Personel oluşturulamadı' });
    }
    
  } catch (error) {
    console.error('Personel oluşturma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bordro-import/cancel
 * İşlemi iptal et ve temp dosyayı sil
 */
router.post('/cancel', async (req, res) => {
  try {
    const { tempFile } = req.body;
    
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('İptal hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bordro-import/tahakkuk/:projeId/:yil/:ay
 * PDF'den çekilen TAHAKKUK BİLGİLERİNİ getir
 */
router.get('/tahakkuk/:projeId/:yil/:ay', async (req, res) => {
  try {
    const { projeId, yil, ay } = req.params;
    
    const tahakkuk = await getTahakkuk(
      projeId === '0' ? null : parseInt(projeId),
      parseInt(yil),
      parseInt(ay)
    );
    
    if (!tahakkuk) {
      return res.json({ 
        exists: false,
        message: 'Bu dönem için TAHAKKUK bilgisi bulunamadı. PDF yükleyerek ekleyebilirsiniz.'
      });
    }
    
    res.json({ exists: true, ...tahakkuk });
    
  } catch (error) {
    console.error('Tahakkuk getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bordro-import/ozet/:projeId/:yil/:ay
 * Bordro özet bilgisi
 */
router.get('/ozet/:projeId/:yil/:ay', async (req, res) => {
  try {
    const { projeId, yil, ay } = req.params;
    
    const sql = `
      SELECT 
        COUNT(*) as personel_sayisi,
        SUM(brut_toplam) as toplam_brut,
        SUM(net_maas) as toplam_net,
        SUM(toplam_isci_sgk) as toplam_sgk_isci,
        SUM(toplam_isveren_sgk) as toplam_sgk_isveren,
        SUM(gelir_vergisi) as toplam_gelir_vergisi,
        SUM(toplam_maliyet) as toplam_maliyet,
        COUNT(*) FILTER (WHERE odeme_durumu = 'odendi') as odenen,
        COUNT(*) FILTER (WHERE odeme_durumu = 'beklemede') as bekleyen
      FROM bordro_kayitlari
      WHERE ($1::integer IS NULL OR proje_id = $1)
        AND yil = $2 
        AND ay = $3
    `;
    
    const result = await query(sql, [
      projeId === '0' ? null : parseInt(projeId),
      parseInt(yil),
      parseInt(ay)
    ]);
    
    res.json(result.rows[0] || {});
    
  } catch (error) {
    console.error('Bordro özet hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// TEMPLATE ENDPOINT'LERİ
// =====================================================

/**
 * GET /api/bordro-import/templates
 * Tüm template'leri listele
 */
router.get('/templates', async (req, res) => {
  try {
    const { projeId } = req.query;
    const templates = await listTemplates(projeId ? parseInt(projeId) : null);
    res.json(templates);
    
  } catch (error) {
    console.error('Template listeleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bordro-import/templates/:id
 * Tek template getir
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM bordro_templates WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template bulunamadı' });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Template getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bordro-import/templates
 * Yeni template kaydet
 */
router.post('/templates', async (req, res) => {
  try {
    const { ad, aciklama, proje_id, kolon_mapping, baslik_satiri, veri_baslangic_satiri, format_imza } = req.body;
    
    if (!ad) {
      return res.status(400).json({ error: 'Template adı gerekli' });
    }
    
    if (!kolon_mapping || Object.keys(kolon_mapping).length === 0) {
      return res.status(400).json({ error: 'Kolon eşleştirmesi gerekli' });
    }
    
    const template = await saveTemplate({
      ad,
      aciklama,
      proje_id: proje_id ? parseInt(proje_id) : null,
      kolon_mapping,
      baslik_satiri: baslik_satiri || 1,
      veri_baslangic_satiri: veri_baslangic_satiri || 2,
      format_imza
    });
    
    res.json(template);
    
  } catch (error) {
    console.error('Template kaydetme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/bordro-import/templates/:id
 * Template güncelle
 */
router.put('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, aciklama, kolon_mapping, baslik_satiri, veri_baslangic_satiri } = req.body;
    
    const updates = {};
    if (ad) updates.ad = ad;
    if (aciklama !== undefined) updates.aciklama = aciklama;
    if (kolon_mapping) updates.kolon_mapping = kolon_mapping;
    if (baslik_satiri) updates.baslik_satiri = baslik_satiri;
    if (veri_baslangic_satiri) updates.veri_baslangic_satiri = veri_baslangic_satiri;
    
    const setClause = Object.keys(updates).map((key, i) => 
      `${key} = $${i + 1}`
    ).join(', ');
    
    const values = Object.values(updates);
    values.push(id);
    
    const sql = `
      UPDATE bordro_templates 
      SET ${setClause} 
      WHERE id = $${values.length}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template bulunamadı' });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Template güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/bordro-import/templates/:id
 * Template sil (soft delete)
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('UPDATE bordro_templates SET aktif = FALSE WHERE id = $1', [id]);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Template silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bordro-import/templates/from-analysis
 * AI analiz sonucundan template oluştur
 */
router.post('/templates/from-analysis', async (req, res) => {
  try {
    const { ad, aciklama, proje_id, suggestedMapping, formatSignature } = req.body;
    
    if (!ad) {
      return res.status(400).json({ error: 'Template adı gerekli' });
    }
    
    if (!suggestedMapping || Object.keys(suggestedMapping).length === 0) {
      return res.status(400).json({ error: 'Kolon eşleştirmesi bulunamadı. AI analizi sonrasında template kaydedebilirsiniz.' });
    }
    
    const template = await saveTemplate({
      ad,
      aciklama: aciklama || 'AI analizinden otomatik oluşturuldu',
      proje_id: proje_id ? parseInt(proje_id) : null,
      kolon_mapping: suggestedMapping,
      baslik_satiri: 1,
      veri_baslangic_satiri: 2,
      format_imza: formatSignature || null
    });
    
    res.json(template);
    
  } catch (error) {
    console.error('Template kaydetme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

