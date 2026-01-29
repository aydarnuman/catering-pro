/**
 * Import Routes - AI Destekli İçe Aktarım API
 * Dosya yükleme, analiz ve veritabanına kayıt
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import {
  analyzeMenuDocument,
  confirmImport,
  getAllSchemas,
  getSchema,
  getSupportedFormats,
  processImport,
  saveMenuAsRecipes,
} from '../services/import-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Upload klasörü
const UPLOAD_DIR = path.join(__dirname, '../../temp/uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer konfigürasyonu
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `import-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.pdf', '.xlsx', '.xls', '.csv', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Desteklenmeyen dosya formatı: ${ext}`));
    }
  },
});

/**
 * GET /api/import/info
 * Desteklenen formatlar ve şemalar
 */
router.get('/info', (_req, res) => {
  res.json({
    supportedFormats: getSupportedFormats(),
    targetTypes: Object.keys(getAllSchemas()),
    schemas: getAllSchemas(),
  });
});

/**
 * GET /api/import/schema/:type
 * Belirli bir şemanın detayları
 */
router.get('/schema/:type', (req, res) => {
  const { type } = req.params;
  const schema = getSchema(type);

  if (!schema) {
    return res.status(400).json({
      error: 'Geçersiz tip',
      validTypes: Object.keys(getAllSchemas()),
    });
  }

  res.json(schema);
});

/**
 * POST /api/import/analyze
 * Dosyayı yükle ve AI ile analiz et (önizleme)
 */
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    const { targetType } = req.body;
    if (!targetType) {
      // Dosyayı sil
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Hedef tip belirtilmedi',
        validTypes: Object.keys(getAllSchemas()),
      });
    }

    // AI ile analiz
    const result = await processImport(req.file.path, req.file.originalname, targetType);

    // Geçici dosya bilgisini ekle (onay için)
    result.tempFile = req.file.filename;

    res.json(result);
  } catch (error) {
    // Hata durumunda dosyayı sil
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/confirm
 * Analiz edilen verileri onayla ve kaydet
 */
router.post('/confirm', async (req, res) => {
  try {
    const { targetType, records, tempFile } = req.body;

    if (!targetType || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'targetType ve records gerekli' });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'Kaydedilecek veri yok' });
    }

    // Veritabanına kaydet
    const result = await confirmImport(targetType, records);

    // Geçici dosyayı sil
    if (tempFile) {
      const tempPath = path.join(UPLOAD_DIR, tempFile);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }

    res.json({
      success: true,
      message: `${result.inserted} kayıt başarıyla eklendi`,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/cancel
 * Analizi iptal et ve geçici dosyayı sil
 */
router.post('/cancel', (req, res) => {
  try {
    const { tempFile } = req.body;

    if (tempFile) {
      const tempPath = path.join(UPLOAD_DIR, tempFile);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }

    res.json({ success: true, message: 'İçe aktarım iptal edildi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/menu-analyze
 * Menü dokümanını (PDF/Excel/PNG) analiz et ve yemekleri çıkar
 */
router.post('/menu-analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    // AI ile menü analizi
    const result = await analyzeMenuDocument(req.file.path, req.file.originalname);

    // Geçici dosya bilgisini ekle
    result.tempFile = req.file.filename;

    res.json(result);
  } catch (error) {
    // Hata durumunda dosyayı sil
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/menu-save
 * Analiz edilen menüyü reçetelere kaydet
 */
router.post('/menu-save', async (req, res) => {
  try {
    const { yemekler, tempFile, options = {} } = req.body;

    if (!yemekler || !Array.isArray(yemekler) || yemekler.length === 0) {
      return res.status(400).json({ error: 'Kaydedilecek yemek listesi gerekli' });
    }

    // Reçetelere kaydet
    const result = await saveMenuAsRecipes(yemekler, options);

    // Geçici dosyayı sil
    if (tempFile) {
      const tempPath = path.join(UPLOAD_DIR, tempFile);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }

    res.json({
      success: true,
      message: `${result.inserted} yemek reçetelere eklendi`,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/import/template/:type
 * Örnek şablon indir
 */
router.get('/template/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const schema = getSchema(type);

    if (!schema) {
      return res.status(400).json({ error: 'Geçersiz tip' });
    }

    // Excel şablonu oluştur
    const xlsx = await import('xlsx');
    const wb = xlsx.utils.book_new();

    // Header'lar (alan açıklamaları)
    const headers = Object.entries(schema.fields).map(([key, field]) => ({
      field: key,
      description: field.description,
      type: field.type,
      required: field.required ? 'Evet' : 'Hayır',
    }));

    // Boş veri satırları ile örnek
    const exampleRow = {};
    Object.entries(schema.fields).forEach(([key, field]) => {
      switch (field.type) {
        case 'date':
          exampleRow[key] = '2026-01-01';
          break;
        case 'number':
          exampleRow[key] = 0;
          break;
        default:
          exampleRow[key] = `Örnek ${field.description}`;
      }
    });

    // Header sheet
    const wsInfo = xlsx.utils.json_to_sheet(headers);
    xlsx.utils.book_append_sheet(wb, wsInfo, 'Alan Bilgileri');

    // Veri sheet
    const wsData = xlsx.utils.json_to_sheet([exampleRow]);
    xlsx.utils.book_append_sheet(wb, wsData, 'Veriler');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `${type}-sablonu.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
