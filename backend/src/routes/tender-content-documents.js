/**
 * Tender Content Documents API
 * İhale içeriklerini (announcement, goods_services) döküman olarak yönetme
 */

import express from 'express';
import documentQueueProcessor from '../services/document-queue-processor.js';
import tenderContentService from '../services/tender-content-service.js';

const router = express.Router();

/**
 * storage_path'ten docType çıkar
 * Örn: "tenders/11231/tech_spec/dosya.pdf" → "tech_spec"
 * @param {string|null} storagePath
 * @returns {string|null}
 */
function extractDocTypeFromPath(storagePath) {
  if (!storagePath) return null;
  const parts = storagePath.split('/');
  // Pattern: tenders/<id>/<docType>/...
  if (parts.length >= 3 && parts[0] === 'tenders') {
    return parts[2] || null;
  }
  return null;
}

/**
 * İhale içeriklerini documents tablosuna kaydet
 * POST /api/tender-content/:tenderId/create-documents
 */
router.post('/:tenderId/create-documents', async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await tenderContentService.createContentDocuments(parseInt(tenderId, 10));

    res.json({
      success: true,
      data: result,
      message: `${result.created.length} içerik döküman oluşturuldu`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * İhale için content dökümanlarını listele
 * GET /api/tender-content/:tenderId/documents
 */
router.get('/:tenderId/documents', async (req, res) => {
  try {
    const { tenderId } = req.params;

    const documents = await tenderContentService.getContentDocuments(parseInt(tenderId, 10));

    res.json({
      success: true,
      data: {
        tenderId: parseInt(tenderId, 10),
        documents,
        totalCount: documents.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Content dökümanı kuyruğa ekle
 * POST /api/tender-content/documents/:documentId/queue
 */
router.post('/documents/:documentId/queue', async (req, res) => {
  try {
    const { documentId } = req.params;

    const result = await tenderContentService.addContentToQueue(parseInt(documentId, 10));

    res.json({
      success: true,
      data: result,
      message: 'Content döküman kuyruğa eklendi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Tüm dökümanları getir (content + download + upload)
 * GET /api/tender-content/:tenderId/all-documents
 */
router.get('/:tenderId/all-documents', async (req, res) => {
  try {
    const { tenderId } = req.params;

    const documents = await tenderContentService.getAllDocuments(parseInt(tenderId, 10));

    res.json({
      success: true,
      data: {
        tenderId: parseInt(tenderId, 10),
        ...documents,
        totalCount: {
          content: documents.content.length,
          download: documents.download.length,
          upload: documents.upload.length,
          total: documents.content.length + documents.download.length + documents.upload.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Queue durumunu getir
 * GET /api/tender-content/queue/status
 */
router.get('/queue/status', async (_req, res) => {
  try {
    const status = await documentQueueProcessor.getQueueStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Manuel queue işleme tetikleme
 * POST /api/tender-content/queue/process
 */
router.post('/queue/process', async (_req, res) => {
  try {
    const result = await documentQueueProcessor.triggerManualProcess();

    res.json({
      success: true,
      data: result,
      message: 'Queue işleme tetiklendi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Content dökümanı analiz et (streaming)
 * POST /api/tender-content/documents/:documentId/analyze
 *
 * v9.0 UNIFIED PIPELINE - TEK MERKEZİ SİSTEM
 */
router.post('/documents/:documentId/analyze', async (req, res) => {
  const logger = (await import('../utils/logger.js')).default;
  // v9.0: TEK MERKEZİ SİSTEM - Sadece unified-pipeline kullan!
  const { analyzeDocument } = await import('../services/ai-analyzer/unified-pipeline.js');

  try {
    const { documentId } = req.params;

    logger.info('Single document analyze request (v9.0)', { module: 'tender-content', documentId });

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush();
    };

    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
      if (res.flush) res.flush();
    }, 15000);

    res.on('close', () => clearInterval(keepalive));

    sendEvent({ stage: 'start', message: 'Analiz başlıyor...' });

    // Dökümanı al
    const { pool } = await import('../database.js');
    const docResult = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);

    if (docResult.rows.length === 0) {
      sendEvent({ stage: 'error', message: 'Döküman bulunamadı' });
      return res.end();
    }

    const doc = docResult.rows[0];

    // Dosya varsa unified-pipeline kullan, content varsa text-based analiz
    if (doc.file_path || doc.storage_path) {
      // docType: DB'den al, yoksa storage_path'ten çıkar
      const docType = doc.doc_type || extractDocTypeFromPath(doc.storage_path) || undefined;

      // v9.0: UNIFIED PIPELINE
      const result = await analyzeDocument(doc.file_path || doc.storage_path, {
        onProgress: (progress) => sendEvent(progress),
        docType,
      });

      await pool.query(
        `UPDATE documents 
         SET analysis_result = $1, 
             processing_status = 'completed',
             processed_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ pipeline_version: '9.0', ...result }), documentId]
      );

      sendEvent({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100, result });
    } else {
      // Content text analizi (fallback)
      const textContent = doc.content_text || doc.extracted_text;
      if (!textContent) {
        sendEvent({ stage: 'error', message: 'Döküman içeriği bulunamadı' });
        return res.end();
      }

      const { chunkText } = await import('../services/ai-analyzer/pipeline/chunker.js');
      const { analyze } = await import('../services/ai-analyzer/pipeline/analyzer.js');

      const chunks = chunkText(textContent);
      const analysisResult = await analyze(chunks, (progress) => {
        sendEvent({ stage: 'analyzing', message: progress.message, progress: 50 + (progress.progress || 0) * 0.3 });
      });

      await pool.query(
        `UPDATE documents 
         SET analysis_result = $1, processing_status = 'completed', extracted_text = $2, processed_at = NOW()
         WHERE id = $3`,
        [JSON.stringify({ pipeline_version: '9.0', ...analysisResult }), textContent, documentId]
      );

      sendEvent({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100, result: analysisResult });
    }

    res.end();
  } catch (error) {
    try {
      res.write(`data: ${JSON.stringify({ stage: 'error', message: error.message })}\n\n`);
    } catch {}
    res.end();
  }
});

/**
 * Toplu döküman analizi (content + download)
 * POST /api/tender-content/analyze-batch
 *
 * v9.0 UNIFIED PIPELINE - TEK MERKEZİ SİSTEM
 */
router.post('/analyze-batch', async (req, res) => {
  const { pool } = await import('../database.js');
  const logger = (await import('../utils/logger.js')).default;
  // v9.0: TEK MERKEZİ SİSTEM
  const { analyzeDocument } = await import('../services/ai-analyzer/unified-pipeline.js');
  const { downloadFromSupabase } = await import('../services/document.js');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');

  logger.info('Analyze batch request (v9.0)', { module: 'tender-content', count: req.body?.documentIds?.length || 0 });

  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ success: false, error: 'documentIds array gerekli' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush();
    };

    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
      if (res.flush) res.flush();
    }, 15000);

    res.on('close', () => clearInterval(keepalive));

    const results = [];
    const CONCURRENCY = 2;

    // Tek döküman işleme - v9.0 unified pipeline
    const processDoc = async (docId, index) => {
      try {
        const docResult = await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);
        if (docResult.rows.length === 0) return { id: docId, success: false, error: 'Bulunamadı' };

        const doc = docResult.rows[0];
        const docName = doc.original_filename || `Döküman #${docId}`;

        sendEvent({
          stage: 'processing',
          current: index + 1,
          total: documentIds.length,
          documentId: docId,
          message: `"${docName}" analiz ediliyor...`,
        });

        // ZIP/RAR atla
        const fileExt = (doc.file_type || '').toLowerCase();
        if (['zip', 'rar', '.zip', '.rar'].includes(fileExt)) {
          return { id: docId, success: true, skipped: true, reason: 'Arşiv dosyası' };
        }

        // Cache check
        if (doc.processing_status === 'completed' && doc.analysis_result) {
          sendEvent({ stage: 'skipped', documentId: docId, message: 'Zaten analiz edilmiş' });
          return { id: docId, success: true, cached: true };
        }

        let localFilePath = null;
        let tempDir = null;

        try {
          // v9.1: Content dokümanları için özel yol
          if (doc.source_type === 'content' && doc.content_text) {
            sendEvent({
              stage: 'progress',
              documentId: docId,
              message: 'Content doküman analiz ediliyor...',
              progress: 30,
            });

            const { detectDocType, getDocTypePrompt } = await import(
              '../services/ai-analyzer/prompts/doc-type/index.js'
            );
            const { safeJsonParse } = await import('../services/ai-analyzer/utils/parser.js');
            const Anthropic = (await import('@anthropic-ai/sdk')).default;
            const { aiConfig } = await import('../config/ai.config.js');

            const docType = detectDocType(doc);
            const docTypePrompt = docType ? getDocTypePrompt(docType) : null;

            let analysis;
            let provider = 'claude-text';

            if (docTypePrompt) {
              sendEvent({
                stage: 'progress',
                documentId: docId,
                message: `${docType} tipinde özel analiz...`,
                progress: 50,
              });
              const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
              const response = await anthropic.messages.create({
                model: aiConfig.claude.defaultModel,
                max_tokens: 8192,
                messages: [{ role: 'user', content: docTypePrompt.prompt + doc.content_text }],
              });
              analysis = safeJsonParse(response.content[0]?.text || '{}') || {};
              analysis.meta = {
                method: 'doc-type-specialized',
                docType,
                inputTokens: response.usage?.input_tokens || 0,
                outputTokens: response.usage?.output_tokens || 0,
              };
              provider = `claude-text-${docType}`;
            } else {
              // Genel analiz fallback
              const { chunkText } = await import('../services/ai-analyzer/pipeline/chunker.js');
              const { analyze: analyzeChunks } = await import('../services/ai-analyzer/pipeline/analyzer.js');
              const chunks = chunkText(doc.content_text);
              analysis = await analyzeChunks(chunks);
            }

            sendEvent({ stage: 'progress', documentId: docId, message: 'Analiz tamamlandı', progress: 100 });

            await pool.query(
              `UPDATE documents SET analysis_result = $1, extracted_text = COALESCE($2, extracted_text), processing_status = 'completed', processed_at = NOW() WHERE id = $3`,
              [JSON.stringify({ pipeline_version: '9.1', provider, ...analysis }), doc.content_text, docId]
            );

            return { id: docId, success: true, provider };
          }

          // Dosya tabanlı dokümanlar - Supabase'den indir
          const storagePath = doc.storage_path || doc.file_path;
          const fileExt = path.extname(doc.original_filename || doc.filename || '.pdf');
          if (storagePath?.includes('supabase') || storagePath?.startsWith('tenders/')) {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-'));
            localFilePath = path.join(tempDir, `document${fileExt}`);
            const buffer = await downloadFromSupabase(storagePath);
            fs.writeFileSync(localFilePath, buffer);
          } else {
            localFilePath = storagePath;
          }

          // docType: DB'den al, yoksa storage_path'ten çıkar
          const docType = doc.doc_type || extractDocTypeFromPath(doc.storage_path) || undefined;

          // TÜM dosya tabanlı dokümanlar → UNIFIED PIPELINE
          // PDF: Azure Custom Model + Claude Enhancement
          // DOC/DOCX/XLSX: Yerel extract + Zero-Loss Pipeline (chunker → Haiku → Sonnet)
          const result = await analyzeDocument(localFilePath, {
            onProgress: (progress) => {
              sendEvent({
                stage: 'progress',
                documentId: docId,
                message: progress.message,
                progress: progress.progress,
              });
            },
            docType,
          });

          if (!result.success) throw new Error(result.error || 'Pipeline hatası');

          // Kaydet
          await pool.query(
            `UPDATE documents SET analysis_result = $1, extracted_text = COALESCE($2, extracted_text), processing_status = 'completed', processed_at = NOW() WHERE id = $3`,
            [JSON.stringify({ pipeline_version: '9.1', ...result }), result.extraction?.text || null, docId]
          );

          return { id: docId, success: true, provider: result.meta?.provider_used };
        } finally {
          if (tempDir)
            try {
              fs.rmSync(tempDir, { recursive: true });
            } catch {}
        }
      } catch (err) {
        await pool.query(`UPDATE documents SET processing_status = 'failed' WHERE id = $1`, [docId]);
        return { id: docId, success: false, error: err.message };
      }
    };

    // Paralel işleme
    for (let i = 0; i < documentIds.length; i += CONCURRENCY) {
      const batch = documentIds.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map((docId, idx) => processDoc(docId, i + idx)));
      results.push(...batchResults);
    }

    const summary = {
      total: documentIds.length,
      success: results.filter((r) => r.success && !r.skipped && !r.cached).length,
      skipped: results.filter((r) => r.skipped || r.cached).length,
      failed: results.filter((r) => !r.success).length,
    };

    sendEvent({ stage: 'complete', message: 'Toplu analiz tamamlandı', results, summary });
    res.end();
  } catch (error) {
    try {
      res.write(`data: ${JSON.stringify({ stage: 'error', message: error.message })}\n\n`);
    } catch {}
    res.end();
  }
});

/**
 * Hatalı dökümanları sıfırla (tekrar analiz için)
 * POST /api/tender-content/documents/reset-failed
 */
router.post('/documents/reset-failed', async (req, res) => {
  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'documentIds array gerekli',
      });
    }

    const { pool } = await import('../database.js');

    // Hatalı dökümanları pending'e çevir
    const result = await pool.query(
      `UPDATE documents 
       SET processing_status = 'pending',
           analysis_result = NULL
       WHERE id = ANY($1::int[])
         AND processing_status = 'failed'
       RETURNING id`,
      [documentIds]
    );

    res.json({
      success: true,
      message: `${result.rowCount} döküman tekrar analiz için hazır`,
      resetCount: result.rowCount,
      resetIds: result.rows.map((r) => r.id),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Seçili dökümanları sıfırla (tüm statusler için)
 * POST /api/tender-content/documents/reset
 * Body: { documentIds: number[] } veya { tenderId: number }
 */
router.post('/documents/reset', async (req, res) => {
  const logger = (await import('../utils/logger.js')).default;

  try {
    const { documentIds, tenderId } = req.body;
    const { pool } = await import('../database.js');

    let result;

    // tenderId ile tüm dökümanları sıfırla
    if (tenderId) {
      result = await pool.query(
        `UPDATE documents 
         SET processing_status = 'pending',
             analysis_result = NULL
         WHERE tender_id = $1
         RETURNING id, original_filename`,
        [tenderId]
      );
    }
    // documentIds ile seçili dökümanları sıfırla
    else if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      result = await pool.query(
        `UPDATE documents 
         SET processing_status = 'pending',
             analysis_result = NULL
         WHERE id = ANY($1::int[])
         RETURNING id, original_filename`,
        [documentIds]
      );
    } else {
      return res.status(400).json({
        success: false,
        error: 'documentIds array veya tenderId gerekli',
      });
    }

    logger.info('Documents reset', {
      module: 'tender-content',
      count: result.rowCount,
      tenderId: tenderId || null,
      ids: result.rows.map((r) => r.id),
    });

    res.json({
      success: true,
      message: `${result.rowCount} döküman sıfırlandı`,
      resetCount: result.rowCount,
      resetDocs: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Bir ihaleye ait tüm dökümanları sil
 * DELETE /api/tender-content/:tenderId/documents
 */
router.delete('/:tenderId/documents', async (req, res) => {
  const logger = (await import('../utils/logger.js')).default;

  try {
    const { tenderId } = req.params;
    const { deleteFromStorage } = req.query; // ?deleteFromStorage=true

    const { pool } = await import('../database.js');

    // Önce dökümanları al (storage path'leri için)
    const docsResult = await pool.query(
      `SELECT id, storage_path, original_filename FROM documents WHERE tender_id = $1`,
      [tenderId]
    );

    if (docsResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Silinecek döküman bulunamadı',
        deletedCount: 0,
      });
    }

    // Supabase Storage'dan da sil (opsiyonel)
    if (deleteFromStorage === 'true') {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

        const storagePaths = docsResult.rows.filter((d) => d.storage_path).map((d) => d.storage_path);

        if (storagePaths.length > 0) {
          const { error: storageError } = await supabase.storage.from('documents').remove(storagePaths);

          if (storageError) {
            logger.warn('Storage delete partial failure', {
              module: 'tender-content',
              error: storageError.message,
            });
          }
        }
      } catch (storageErr) {
        logger.warn('Storage delete error', {
          module: 'tender-content',
          error: storageErr.message,
        });
      }
    }

    // Veritabanından sil
    const deleteResult = await pool.query(`DELETE FROM documents WHERE tender_id = $1 RETURNING id`, [tenderId]);

    // tender_tracking tablosundaki analiz verilerini temizle
    try {
      await pool.query(
        `UPDATE tender_tracking 
         SET analysis_summary = NULL,
             documents_analyzed = 0,
             teknik_sart_sayisi = 0,
             birim_fiyat_sayisi = 0,
             last_analysis_at = NULL
         WHERE tender_id = $1`,
        [tenderId]
      );
    } catch (trackErr) {
      logger.warn('Tender tracking clear failed', {
        module: 'tender-content',
        error: trackErr.message,
      });
    }

    logger.info('Documents deleted for tender', {
      module: 'tender-content',
      tenderId,
      count: deleteResult.rowCount,
      fromStorage: deleteFromStorage === 'true',
    });

    res.json({
      success: true,
      message: `${deleteResult.rowCount} döküman silindi`,
      deletedCount: deleteResult.rowCount,
      deletedFromStorage: deleteFromStorage === 'true',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Bir ihaleye ait tüm analizleri temizle (dökümanlar kalır)
 * POST /api/tender-content/:tenderId/clear-analysis
 */
router.post('/:tenderId/clear-analysis', async (req, res) => {
  const logger = (await import('../utils/logger.js')).default;

  try {
    const { tenderId } = req.params;
    const { pool } = await import('../database.js');

    let clearedCount = 0;

    // 1. Dökümanların analiz sonuçlarını temizle
    try {
      const result = await pool.query(
        `UPDATE documents 
         SET processing_status = 'pending',
             analysis_result = NULL
         WHERE tender_id = $1
           AND analysis_result IS NOT NULL
         RETURNING id`,
        [tenderId]
      );
      clearedCount = result.rowCount;
    } catch (docErr) {
      logger.warn('Documents clear failed (may not exist)', {
        module: 'tender-content',
        error: docErr.message,
      });
    }

    // 2. tender_tracking tablosundaki analiz verilerini temizle
    try {
      await pool.query(
        `UPDATE tender_tracking 
         SET analysis_summary = NULL,
             documents_analyzed = 0,
             teknik_sart_sayisi = 0,
             birim_fiyat_sayisi = 0,
             last_analysis_at = NULL
         WHERE tender_id = $1`,
        [tenderId]
      );
    } catch (trackErr) {
      logger.warn('Tender tracking clear failed', {
        module: 'tender-content',
        error: trackErr.message,
      });
    }

    logger.info('Analysis cleared for tender', {
      module: 'tender-content',
      tenderId,
      clearedCount,
    });

    res.json({
      success: true,
      message: clearedCount > 0 ? `${clearedCount} dökümanın analizi temizlendi` : 'Analiz verileri temizlendi',
      clearedCount,
    });
  } catch (error) {
    logger.error('Clear analysis failed', {
      module: 'tender-content',
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
