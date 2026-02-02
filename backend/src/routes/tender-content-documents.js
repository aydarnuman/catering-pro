/**
 * Tender Content Documents API
 * İhale içeriklerini (announcement, goods_services) döküman olarak yönetme
 */

import express from 'express';
import documentQueueProcessor from '../services/document-queue-processor.js';
import tenderContentService from '../services/tender-content-service.js';

const router = express.Router();

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
 * Pipeline v5.0 kullanır
 */
router.post('/documents/:documentId/analyze', async (req, res) => {
  const logger = (await import('../utils/logger.js')).default;
  
  try {
    const { documentId } = req.params;

    logger.info('Single document analyze request', { module: 'tender-content', documentId });

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering'i kapat
    res.flushHeaders();

    // SSE sendEvent with flush for real-time updates
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush(); // Express compression middleware için
    };

    // Keepalive ping (her 15 saniye) - bağlantı timeout'unu önle
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
      if (res.flush) res.flush();
    }, 15000);

    // Cleanup on connection close
    res.on('close', () => clearInterval(keepalive));

    sendEvent({ stage: 'start', message: 'Analiz başlıyor...' });

    // Dökümanı al
    const { pool } = await import('../database.js');
    const docResult = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);

    if (docResult.rows.length === 0) {
      logger.warn('Document not found', { module: 'tender-content', documentId });
      sendEvent({ stage: 'error', message: 'Döküman bulunamadı' });
      return res.end();
    }

    const doc = docResult.rows[0];

    sendEvent({ stage: 'extracting', message: 'Metin çıkarılıyor...', progress: 20 });

    // Content text varsa direkt kullan
    const textContent = doc.content_text || doc.extracted_text;

    if (!textContent) {
      logger.warn('Document content empty', { module: 'tender-content', documentId });
      sendEvent({ stage: 'error', message: 'Döküman içeriği bulunamadı' });
      return res.end();
    }

    logger.info('Analyzing content with Pipeline v5.0', { 
      module: 'tender-content', 
      documentId, 
      textLength: textContent.length 
    });

    sendEvent({ stage: 'analyzing', message: 'AI analiz yapılıyor...', progress: 50 });

    // Pipeline v5.0 ile analiz
    const { chunkText } = await import('../services/ai-analyzer/pipeline/chunker.js');
    const { analyze } = await import('../services/ai-analyzer/pipeline/analyzer.js');

    // Metni chunk'la
    const chunks = chunkText(textContent);
    
    logger.info('Text chunked', { module: 'tender-content', documentId, chunkCount: chunks.length });

    // Analiz et
    const analysisResult = await analyze(chunks, (progress) => {
      sendEvent({ 
        stage: 'analyzing', 
        message: progress.message || 'Analiz devam ediyor...', 
        progress: 50 + (progress.progress || 0) * 0.3 
      });
    });

    sendEvent({ stage: 'saving', message: 'Sonuçlar kaydediliyor...', progress: 80 });

    // Sonucu kaydet
    await pool.query(
      `UPDATE documents 
       SET analysis_result = $1, 
           processing_status = 'completed',
           extracted_text = $2,
           processed_at = NOW()
       WHERE id = $3`,
      [
        JSON.stringify({
          pipeline_version: '5.0',
          ...analysisResult,
          meta: {
            ...analysisResult.meta,
            chunkCount: chunks.length,
          },
        }),
        textContent,
        documentId,
      ]
    );

    logger.info('Document analysis completed', { 
      module: 'tender-content', 
      documentId, 
      chunkCount: chunks.length 
    });

    sendEvent({
      stage: 'complete',
      message: 'Analiz tamamlandı',
      progress: 100,
      result: {
        analiz: analysisResult,
        pipeline_version: '5.0',
      },
    });

    res.end();
  } catch (error) {
    const logger = (await import('../utils/logger.js')).default;
    logger.error('Single document analyze failed', { 
      module: 'tender-content', 
      documentId: req.params?.documentId, 
      error: error.message 
    });
    
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
 * YENİ Pipeline v5.0 kullanır:
 * - 3 katmanlı mimari (extraction → chunking → analysis)
 * - Claude Vision OCR desteği
 * - 2 aşamalı AI analizi (Haiku → Sonnet)
 */
router.post('/analyze-batch', async (req, res) => {
  const { pool } = await import('../database.js');
  const logger = (await import('../utils/logger.js')).default;
  
  logger.info('Analyze batch request received', { 
    module: 'tender-content', 
    documentIds: req.body?.documentIds?.length || 0 
  });
  
  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'documentIds array gerekli',
      });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering'i kapat
    res.flushHeaders();

    // SSE sendEvent with flush for real-time updates
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush(); // Express compression middleware için
    };

    // Keepalive ping (her 15 saniye) - bağlantı timeout'unu önle
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
      if (res.flush) res.flush();
    }, 15000);

    // Cleanup on connection close
    res.on('close', () => clearInterval(keepalive));

    // YENİ Pipeline v5.0 import
    const { runPipeline } = await import('../services/ai-analyzer/index.js');
    const { analyze: analyzeText } = await import('../services/ai-analyzer/pipeline/analyzer.js');
    const { chunkText } = await import('../services/ai-analyzer/pipeline/chunker.js');
    const { downloadFromSupabase } = await import('../services/document.js');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const os = await import('node:os');

    const results = [];

    for (let i = 0; i < documentIds.length; i++) {
      const docId = documentIds[i];

      try {
        sendEvent({
          stage: 'processing',
          current: i + 1,
          total: documentIds.length,
          documentId: docId,
          message: `Döküman ${docId} analiz ediliyor...`,
        });

        // Dökümanı al
        const docResult = await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);

        if (docResult.rows.length === 0) {
          results.push({ id: docId, success: false, error: 'Bulunamadı' });
          continue;
        }

        const doc = docResult.rows[0];

        // ZIP/RAR dosyalarını atla - içindeki dosyalar zaten ayrı yüklendi
        const fileExt = (doc.file_type || '').toLowerCase();
        if (fileExt === 'zip' || fileExt === 'rar' || fileExt === '.zip' || fileExt === '.rar') {
          logger.info('Skipping archive file', { module: 'tender-content', docId, fileExt });
          results.push({
            id: docId,
            success: true,
            skipped: true,
            reason: 'Arşiv dosyası - içindeki dosyalar ayrı analiz edildi',
          });
          continue;
        }

        // CACHE CHECK: Zaten analiz edilmiş dokümanları atla
        if (doc.processing_status === 'completed' && doc.analysis_result) {
          logger.info('Skipping already analyzed document (cached)', { module: 'tender-content', docId });
          sendEvent({
            stage: 'skipped',
            documentId: docId,
            message: 'Zaten analiz edilmiş (cache)',
          });
          results.push({
            id: docId,
            success: true,
            cached: true,
            reason: 'Zaten analiz edilmiş',
          });
          continue;
        }

        let analysisResult;
        let extractedText = '';

        // Content dökümanları için Pipeline text analizi
        if (doc.source_type === 'content' && (doc.content_text || doc.extracted_text)) {
          const textContent = doc.content_text || doc.extracted_text;
          extractedText = textContent;
          
          logger.info('Analyzing content document with Pipeline', { 
            module: 'tender-content', 
            docId, 
            textLength: textContent.length 
          });
          
          // Metni chunk'la ve analiz et
          const chunks = chunkText(textContent);
          analysisResult = await analyzeText(chunks, (progress) => {
            sendEvent({
              stage: 'progress',
              documentId: docId,
              ...progress,
            });
          });
        }
        // Download/upload dökümanları için YENİ Pipeline kullan
        else if (doc.file_path || doc.storage_path) {
          const storagePath = doc.storage_path || doc.file_path;
          let localFilePath;
          let tempDir = null;

          // Supabase'den indir veya local dosyayı kullan
          if (storagePath.includes('supabase') || storagePath.startsWith('tenders/')) {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-analyze-'));
            const ext = path.extname(doc.original_filename || '.pdf');
            localFilePath = path.join(tempDir, `document${ext}`);

            logger.info('Downloading from Supabase', { 
              module: 'tender-content', 
              docId, 
              storagePath: storagePath.substring(0, 50) + '...' 
            });
            
            const buffer = await downloadFromSupabase(storagePath);
            fs.writeFileSync(localFilePath, buffer);
          } else {
            localFilePath = storagePath;
          }

          try {
            logger.info('Running Pipeline v5.0 on document', { 
              module: 'tender-content', 
              docId, 
              filePath: localFilePath 
            });
            
            // YENİ Pipeline v5.0 çalıştır
            const pipelineResult = await runPipeline(localFilePath, {
              onProgress: (progress) => {
                sendEvent({
                  stage: 'progress',
                  documentId: docId,
                  ...progress,
                });
              },
            });

            if (!pipelineResult.success) {
              throw new Error(pipelineResult.error || 'Pipeline hatası');
            }

            analysisResult = pipelineResult.analysis;
            extractedText = pipelineResult.extraction?.text || '';
            
            logger.info('Pipeline completed', { 
              module: 'tender-content', 
              docId,
              chunks: pipelineResult.chunks?.length || 0,
              ocrApplied: pipelineResult.extraction?.ocrApplied || false,
            });
          } finally {
            // Temp dosyayı temizle
            if (tempDir) {
              try {
                fs.rmSync(tempDir, { recursive: true });
              } catch (_e) {}
            }
          }
        } else {
          results.push({ id: docId, success: false, error: 'İçerik bulunamadı' });
          continue;
        }

        // Sonucu kaydet
        await pool.query(
          `UPDATE documents 
           SET analysis_result = $1, 
               extracted_text = COALESCE($2, extracted_text),
               processing_status = 'completed',
               processed_at = NOW()
           WHERE id = $3`,
          [
            JSON.stringify({
              pipeline_version: '5.0',
              ...analysisResult,
            }), 
            extractedText || null,
            docId
          ]
        );

        results.push({ id: docId, success: true, analysis: analysisResult });
        
        logger.info('Document analysis saved', { module: 'tender-content', docId });
      } catch (docError) {
        logger.error('Document analysis failed', { 
          module: 'tender-content', 
          docId, 
          error: docError.message 
        });
        
        results.push({ id: docId, success: false, error: docError.message });

        // Hata durumunu kaydet
        await pool.query(`UPDATE documents SET processing_status = 'failed' WHERE id = $1`, [docId]);
      }
    }

    const summary = {
      total: documentIds.length,
      success: results.filter((r) => r.success && !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.success).length,
    };

    logger.info('Batch analysis completed', { module: 'tender-content', summary });

    sendEvent({
      stage: 'complete',
      message: 'Toplu analiz tamamlandı',
      results,
      summary,
    });

    res.end();
  } catch (error) {
    const logger = (await import('../utils/logger.js')).default;
    logger.error('Batch analysis error', { module: 'tender-content', error: error.message });
    
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
 */
router.post('/documents/reset', async (req, res) => {
  const logger = (await import('../utils/logger.js')).default;
  
  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'documentIds array gerekli',
      });
    }

    const { pool } = await import('../database.js');

    // Tüm dökümanları pending'e çevir ve analiz sonuçlarını temizle
    const result = await pool.query(
      `UPDATE documents 
       SET processing_status = 'pending',
           analysis_result = NULL,
           extracted_text = CASE WHEN source_type = 'content' THEN extracted_text ELSE NULL END
       WHERE id = ANY($1::int[])
       RETURNING id, original_filename`,
      [documentIds]
    );

    logger.info('Documents reset', { 
      module: 'tender-content',
      count: result.rowCount,
      ids: result.rows.map(r => r.id)
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
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );

        const storagePaths = docsResult.rows
          .filter(d => d.storage_path)
          .map(d => d.storage_path);

        if (storagePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('documents')
            .remove(storagePaths);

          if (storageError) {
            logger.warn('Storage delete partial failure', { 
              module: 'tender-content',
              error: storageError.message 
            });
          }
        }
      } catch (storageErr) {
        logger.warn('Storage delete error', { 
          module: 'tender-content',
          error: storageErr.message 
        });
      }
    }

    // Veritabanından sil
    const deleteResult = await pool.query(
      `DELETE FROM documents WHERE tender_id = $1 RETURNING id`,
      [tenderId]
    );

    logger.info('Documents deleted for tender', { 
      module: 'tender-content',
      tenderId,
      count: deleteResult.rowCount,
      fromStorage: deleteFromStorage === 'true'
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

export default router;
