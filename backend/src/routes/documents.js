import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { query } from '../database.js';
import { detectDocTypeFromFilename } from '../services/ai-analyzer/prompts/doc-type/index.js';
// v9.0: UNIFIED PIPELINE - TEK MERKEZİ SİSTEM (DİĞER PİPELINE DOSYALARINI KULLANMA!)
import { SUPPORTED_FORMATS, getFileType } from '../services/ai-analyzer/index.js';
import { analyzeDocument } from '../services/ai-analyzer/unified-pipeline.js';
import { processDocument } from '../services/document.js';
import { supabase } from '../supabase.js';

// Storage bucket name
const BUCKET_NAME = 'tender-documents';

// Content-Type mapping
const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
};

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
  ...SUPPORTED_FORMATS.presentation,
  ...SUPPORTED_FORMATS.text,
  ...SUPPORTED_FORMATS.archive,
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
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi' });
    }

    const { tender_id, uploaded_by } = req.body;

    // Check for duplicate filename and add timestamp if needed
    let originalFilename = req.file.originalname;
    if (tender_id) {
      const existingDoc = await query(
        'SELECT id FROM documents WHERE tender_id = $1 AND original_filename = $2',
        [tender_id, originalFilename]
      );
      if (existingDoc.rows.length > 0) {
        // Add timestamp to filename to make it unique
        const ext = path.extname(originalFilename);
        const baseName = path.basename(originalFilename, ext);
        const timestamp = Date.now();
        originalFilename = `${baseName}_${timestamp}${ext}`;
      }
    }

    // AI ile döküman tipini tespit et
    const detectedDocType = detectDocTypeFromFilename(originalFilename) || 'other';
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    // Görsel dosya mı kontrol et
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.webp'].includes(fileExt);

    // Supabase Storage'a yükle (tender_id olsun olmasın, her zaman yükle)
    let storageUrl = null;
    let storagePath = null;

    if (supabase?.storage) {
      try {
        const uniqueId = crypto.randomBytes(4).toString('hex');
        const timestamp = Date.now();
        const safeFileName = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storageFileName = `${timestamp}-${uniqueId}-${safeFileName}`;
        // tender_id yoksa 'uploads' klasörüne koy
        const folder = tender_id ? `tenders/${tender_id}/${detectedDocType}` : 'uploads';
        storagePath = `${folder}/${storageFileName}`;

        const fileBuffer = fs.readFileSync(req.file.path);
        const contentType = CONTENT_TYPES[fileExt] || 'application/octet-stream';

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, fileBuffer, {
            contentType,
            upsert: false,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
          storageUrl = urlData?.publicUrl || null;
          console.log(`[Upload] Supabase Storage'a yüklendi: ${storagePath}`);
        } else {
          console.error('[Upload] Supabase Storage hatası:', uploadError.message);
        }
      } catch (storageErr) {
        console.error('[Upload] Supabase Storage yükleme hatası:', storageErr.message);
      }
    }

    // Görsel dosyalar için status 'completed' (AI analizi gerekmez, hemen görüntülenebilir)
    const initialStatus = isImage ? 'completed' : 'processing';

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
        storage_path,
        storage_url,
        uploaded_by,
        processing_status,
        source_type,
        doc_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'upload', $11)
      RETURNING *
    `,
      [
        tender_id || null,
        req.file.filename,
        originalFilename,
        fileExt,
        req.file.size,
        req.file.path,
        storagePath,
        storageUrl,
        uploaded_by || 'anonymous',
        initialStatus,
        detectedDocType,
      ]
    );

    const document = docResult.rows[0];

    // Görsel dosyalar için AI işleme yapma, sadece döndür (zaten 'completed' olarak kaydedildi)
    if (isImage) {
      res.json({
        success: true,
        message: 'Görsel yüklendi',
        data: document,
      });
      return;
    }

    // Diğer dosyalar için arka planda işle
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Claude AI ile döküman analizi (SSE stream) - TÜM FORMATLAR DESTEKLİ
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    const { tender_id, uploaded_by } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'Dosya gerekli' });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// SSE: Kuyruk işleme progress stream'i
// Frontend bu endpoint'e EventSource ile bağlanır, queue processor event'lerini alır
router.get('/queue/progress', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Nginx buffering'i devre dışı bırak
  });

  // Heartbeat: bağlantı canlı kalsın
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Queue processor'a SSE client olarak kayıt ol
  const { default: queueProcessor } = await import('../services/document-queue-processor.js');
  queueProcessor.addSSEClient(res);

  // Bağlantı kesilince temizle
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// Döküman detayı
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eksik storage_url olan dökümanları Supabase'e yükle
router.post('/fix-storage', async (req, res) => {
  try {
    const { document_ids } = req.body;

    // storage_url null olup file_path olan dökümanları bul
    let docsToFix;
    if (document_ids && Array.isArray(document_ids) && document_ids.length > 0) {
      const result = await query(
        `SELECT id, tender_id, original_filename, file_path, file_type, doc_type 
         FROM documents 
         WHERE id = ANY($1) AND storage_url IS NULL AND file_path IS NOT NULL`,
        [document_ids]
      );
      docsToFix = result.rows;
    } else {
      const result = await query(
        `SELECT id, tender_id, original_filename, file_path, file_type, doc_type 
         FROM documents 
         WHERE storage_url IS NULL AND file_path IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 50`
      );
      docsToFix = result.rows;
    }

    if (docsToFix.length === 0) {
      return res.json({ success: true, message: 'Düzeltilecek döküman bulunamadı', fixed: 0 });
    }

    const results = [];
    for (const doc of docsToFix) {
      try {
        // Dosya var mı kontrol et
        if (!fs.existsSync(doc.file_path)) {
          results.push({ id: doc.id, status: 'error', message: 'Dosya bulunamadı' });
          continue;
        }

        // Supabase'e yükle
        const fileBuffer = fs.readFileSync(doc.file_path);
        const fileExt = (doc.file_type || path.extname(doc.original_filename)).toLowerCase();
        const contentType = CONTENT_TYPES[fileExt] || 'application/octet-stream';

        const uniqueId = crypto.randomBytes(4).toString('hex');
        const timestamp = Date.now();
        const safeFileName = (doc.original_filename || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
        const storageFileName = `${timestamp}-${uniqueId}-${safeFileName}`;
        const storagePath = `tenders/${doc.tender_id || 'unknown'}/${doc.doc_type || 'other'}/${storageFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, fileBuffer, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          results.push({ id: doc.id, status: 'error', message: uploadError.message });
          continue;
        }

        // Public URL al
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
        const storageUrl = urlData?.publicUrl || null;

        // Database'i güncelle
        await query(
          'UPDATE documents SET storage_path = $1, storage_url = $2 WHERE id = $3',
          [storagePath, storageUrl, doc.id]
        );

        results.push({ id: doc.id, status: 'fixed', storage_url: storageUrl });
      } catch (err) {
        results.push({ id: doc.id, status: 'error', message: err.message });
      }
    }

    const fixed = results.filter((r) => r.status === 'fixed').length;
    const errors = results.filter((r) => r.status === 'error').length;

    res.json({
      success: true,
      message: `${fixed} döküman düzeltildi, ${errors} hata`,
      fixed,
      errors,
      results,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Döküman silme
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı' });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
