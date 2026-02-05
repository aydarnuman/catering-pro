import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { query } from '../database.js';
// v9.0: UNIFIED PIPELINE - TEK MERKEZİ SİSTEM
import { getFileType, SUPPORTED_FORMATS } from '../services/ai-analyzer/index.js';
import { analyzeDocument } from '../services/ai-analyzer/unified-pipeline.js';
// DİĞER PİPELINE DOSYALARINI KULLANMA!
import { processDocument } from '../services/document.js';

const router = express.Router();

// Multer storage yapılandırması
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Tüm desteklenen formatlar
const allSupportedExtensions = [
  ...SUPPORTED_FORMATS.pdf,
  ...SUPPORTED_FORMATS.image,
  ...SUPPORTED_FORMATS.document,
  ...SUPPORTED_FORMATS.spreadsheet,
  ...SUPPORTED_FORMATS.text,
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allSupportedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Desteklenmeyen dosya formatı: ${ext}. Desteklenen: ${allSupportedExtensions.join(', ')}`));
    }
  },
});

// Döküman yükleme ve analiz
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    const { tender_id, uploaded_by } = req.body;

    // Dökümanı veritabanına kaydet
    const docResult = await query(
      `
      INSERT INTO documents (
        tender_id, 
        filename, 
        original_filename, 
        file_type, 
        file_size, 
        file_path,
        uploaded_by,
        processing_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing')
      RETURNING *
    `,
      [
        tender_id || null,
        req.file.filename,
        req.file.originalname,
        path.extname(req.file.originalname).toLowerCase(),
        req.file.size,
        req.file.path,
        uploaded_by || 'anonymous',
      ]
    );

    const document = docResult.rows[0];

    // Arka planda işle
    processDocument(document.id, req.file.path, req.file.originalname)
      .then(async (result) => {
        await query(
          `
          UPDATE documents 
          SET 
            extracted_text = $1,
            ocr_result = $2,
            analysis_result = $3,
            processing_status = 'completed',
            processed_at = NOW()
          WHERE id = $4
        `,
          [result.text, JSON.stringify(result.ocr), JSON.stringify(result.analysis), document.id]
        );
      })
      .catch(async (_error) => {
        await query(
          `
          UPDATE documents 
          SET processing_status = 'failed'
          WHERE id = $1
        `,
          [document.id]
        );
      });

    res.json({
      success: true,
      message: 'Döküman yüklendi, işleniyor...',
      data: document,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Claude AI ile döküman analizi (SSE stream) - TÜM FORMATLAR DESTEKLİ
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    const { tender_id, uploaded_by } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Dosya gerekli' });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const fileType = getFileType(file.originalname);

    // ZIP/RAR dosyaları doğrudan analiz edilemez
    if (ext === '.zip' || ext === '.rar') {
      return res.status(400).json({
        error: 'ZIP/RAR dosyaları doğrudan analiz edilemez.',
        message:
          'Lütfen arşivi açıp içindeki dosyaları ayrı ayrı yükleyin veya İhale Merkezi üzerinden indirin (otomatik açılır).',
      });
    }

    if (fileType === 'unknown') {
      return res.status(400).json({
        error: `Desteklenmeyen dosya formatı: ${ext}`,
        supported: allSupportedExtensions,
      });
    }

    // SSE için headers (progress bildirimi)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Dökümanı önce veritabanına kaydet
    let document;
    try {
      const docResult = await query(
        `
        INSERT INTO documents (
          tender_id, 
          filename, 
          original_filename, 
          file_type, 
          file_size, 
          file_path,
          uploaded_by,
          processing_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'analyzing')
        RETURNING *
      `,
        [tender_id || null, file.filename, file.originalname, ext, file.size, file.path, uploaded_by || 'anonymous']
      );

      document = docResult.rows[0];
    } catch (_dbError) {
      res.write(`data: ${JSON.stringify({ stage: 'error', message: 'Veritabanı hatası' })}\n\n`);
      res.end();
      return;
    }

    // Progress callback
    const onProgress = (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    try {
      // v9.0: UNIFIED PIPELINE ile analiz
      const pipelineResult = await analyzeDocument(file.path, {
        onProgress,
      });

      if (!pipelineResult.success) {
        throw new Error(pipelineResult.error || 'Pipeline hatası');
      }

      // Database'e kaydet (pipeline format)
      await query(
        `
        UPDATE documents 
        SET 
          extracted_text = $1,
          analysis_result = $2, 
          processing_status = 'completed', 
          processed_at = NOW()
        WHERE id = $3
      `,
        [
          pipelineResult.extraction?.text || '',
          JSON.stringify({
            pipeline_version: '9.0',
            provider: pipelineResult.meta?.provider_used || 'unified',
            analysis: pipelineResult.analysis,
            stats: pipelineResult.stats,
            validation: pipelineResult.validation,
          }),
          document.id,
        ]
      );

      // Final sonuç
      res.write(
        `data: ${JSON.stringify({
          stage: 'complete',
          result: {
            success: true,
            analiz: pipelineResult.analysis,
            stats: pipelineResult.stats,
          },
          document_id: document.id,
          file_type: fileType,
        })}\n\n`
      );
      res.end();
    } catch (analysisError) {
      // Hata durumunu database'e kaydet
      await query(
        `
        UPDATE documents 
        SET processing_status = 'failed'
        WHERE id = $1
      `,
        [document.id]
      );

      res.write(
        `data: ${JSON.stringify({
          stage: 'error',
          message: analysisError.message || 'Analiz sırasında hata oluştu',
        })}\n\n`
      );
      res.end();
    }
  } catch (error) {
    res.write(
      `data: ${JSON.stringify({
        stage: 'error',
        message: error.message || 'Beklenmeyen hata',
      })}\n\n`
    );
    res.end();
  }
});

// Desteklenen formatları listele
router.get('/supported-formats', (_req, res) => {
  res.json({
    success: true,
    formats: SUPPORTED_FORMATS,
    extensions: allSupportedExtensions,
  });
});

// Döküman listesi
router.get('/', async (req, res) => {
  try {
    const { tender_id } = req.query;

    let queryText = 'SELECT * FROM documents ORDER BY created_at DESC';
    let params = [];

    if (tender_id) {
      queryText = 'SELECT * FROM documents WHERE tender_id = $1 ORDER BY created_at DESC';
      params = [tender_id];
    }

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Döküman detayı
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Döküman bulunamadı' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Döküman silme
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Döküman bulunamadı' });
    }

    const document = result.rows[0];

    // Dosyayı sil
    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }

    // Veritabanından sil
    await query('DELETE FROM documents WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Döküman silindi',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
