/**
 * Tender Content Documents API
 * İhale içeriklerini (announcement, goods_services) döküman olarak yönetme
 */

import express from 'express';
import tenderContentService from '../services/tender-content-service.js';
import documentQueueProcessor from '../services/document-queue-processor.js';

const router = express.Router();

/**
 * İhale içeriklerini documents tablosuna kaydet
 * POST /api/tender-content/:tenderId/create-documents
 */
router.post('/:tenderId/create-documents', async (req, res) => {
  try {
    const { tenderId } = req.params;
    
    console.log(`📄 API: İhale ${tenderId} içerikleri döküman olarak kaydediliyor...`);
    
    const result = await tenderContentService.createContentDocuments(parseInt(tenderId));

    res.json({
      success: true,
      data: result,
      message: `${result.created.length} içerik döküman oluşturuldu`
    });

  } catch (error) {
    console.error('❌ İçerik döküman oluşturma API hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
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
    
    const documents = await tenderContentService.getContentDocuments(parseInt(tenderId));
    
    res.json({
      success: true,
      data: {
        tenderId: parseInt(tenderId),
        documents,
        totalCount: documents.length
      }
    });

  } catch (error) {
    console.error('❌ Content döküman listeleme hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
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
    
    const result = await tenderContentService.addContentToQueue(parseInt(documentId));

    res.json({
      success: true,
      data: result,
      message: 'Content döküman kuyruğa eklendi'
    });

  } catch (error) {
    console.error('❌ Content kuyruğa ekleme hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
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
    
    const documents = await tenderContentService.getAllDocuments(parseInt(tenderId));
    
    res.json({
      success: true,
      data: {
        tenderId: parseInt(tenderId),
        ...documents,
        totalCount: {
          content: documents.content.length,
          download: documents.download.length,
          upload: documents.upload.length,
          total: documents.content.length + documents.download.length + documents.upload.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Tüm döküman listeleme hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Queue durumunu getir
 * GET /api/tender-content/queue/status
 */
router.get('/queue/status', async (req, res) => {
  try {
    const status = await documentQueueProcessor.getQueueStatus();
    
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('❌ Queue status hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Manuel queue işleme tetikleme
 * POST /api/tender-content/queue/process
 */
router.post('/queue/process', async (req, res) => {
  try {
    const result = await documentQueueProcessor.triggerManualProcess();
    
    res.json({
      success: true,
      data: result,
      message: 'Queue işleme tetiklendi'
    });

  } catch (error) {
    console.error('❌ Manuel queue işleme hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Content dökümanı analiz et (streaming)
 * POST /api/tender-content/documents/:documentId/analyze
 */
router.post('/documents/:documentId/analyze', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    sendEvent({ stage: 'start', message: 'Analiz başlıyor...' });
    
    // Dökümanı al
    const { pool } = await import('../database.js');
    const docResult = await pool.query(
      'SELECT * FROM documents WHERE id = $1',
      [documentId]
    );
    
    if (docResult.rows.length === 0) {
      sendEvent({ stage: 'error', message: 'Döküman bulunamadı' });
      return res.end();
    }
    
    const doc = docResult.rows[0];
    
    sendEvent({ stage: 'extracting', message: 'Metin çıkarılıyor...', progress: 20 });
    
    // Content text varsa direkt kullan
    let textContent = doc.content_text || doc.extracted_text;
    
    if (!textContent) {
      sendEvent({ stage: 'error', message: 'Döküman içeriği bulunamadı' });
      return res.end();
    }
    
    sendEvent({ stage: 'analyzing', message: 'AI analiz yapılıyor...', progress: 50 });
    
    // Gemini ile analiz
    const { analyzeDocument } = await import('../services/document-analyzer.js');
    const analysisResult = await analyzeDocument(textContent);
    
    sendEvent({ stage: 'saving', message: 'Sonuçlar kaydediliyor...', progress: 80 });
    
    // Sonucu kaydet
    await pool.query(
      `UPDATE documents 
       SET analysis_result = $1, 
           processing_status = 'completed',
           extracted_text = $2
       WHERE id = $3`,
      [JSON.stringify(analysisResult), textContent, documentId]
    );
    
    sendEvent({ 
      stage: 'complete', 
      message: 'Analiz tamamlandı',
      progress: 100,
      result: {
        analiz: analysisResult
      }
    });
    
    res.end();
    
  } catch (error) {
    console.error('❌ Content analiz hatası:', error);
    try {
      res.write(`data: ${JSON.stringify({ stage: 'error', message: error.message })}\n\n`);
    } catch {}
    res.end();
  }
});

/**
 * Toplu döküman analizi (content + download)
 * POST /api/tender-content/analyze-batch
 */
router.post('/analyze-batch', async (req, res) => {
  try {
    const { documentIds } = req.body;
    
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'documentIds array gerekli'
      });
    }
    
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    const { pool } = await import('../database.js');
    const { analyzeFile, analyzeWithClaude } = await import('../services/claude.js');
    const { downloadFromSupabase } = await import('../services/document.js');
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const results = [];
    
    for (let i = 0; i < documentIds.length; i++) {
      const docId = documentIds[i];
      
      try {
        sendEvent({ 
          stage: 'processing', 
          current: i + 1, 
          total: documentIds.length,
          documentId: docId,
          message: `Döküman ${docId} analiz ediliyor...`
        });
        
        // Dökümanı al
        const docResult = await pool.query(
          'SELECT * FROM documents WHERE id = $1',
          [docId]
        );
        
        if (docResult.rows.length === 0) {
          results.push({ id: docId, success: false, error: 'Bulunamadı' });
          continue;
        }
        
        const doc = docResult.rows[0];
        
        // ZIP/RAR dosyalarını atla - içindeki dosyalar zaten ayrı yüklendi
        const fileExt = (doc.file_type || '').toLowerCase();
        if (fileExt === 'zip' || fileExt === 'rar' || fileExt === '.zip' || fileExt === '.rar') {
          console.log(`⏭️ Arşiv dosyası atlandı [${docId}]: ${doc.original_filename}`);
          results.push({ id: docId, success: true, skipped: true, reason: 'Arşiv dosyası - içindeki dosyalar ayrı analiz edildi' });
          continue;
        }
        
        let analysisResult;
        
        // Content dökümanları için Claude ile text analizi
        if (doc.source_type === 'content' && (doc.content_text || doc.extracted_text)) {
          const textContent = doc.content_text || doc.extracted_text;
          console.log(`📝 Content döküman analizi [${docId}]: ${textContent.length} karakter`);
          analysisResult = await analyzeWithClaude(textContent, 'text');
        } 
        // Download/upload dökümanları için Claude analyzeFile kullan (Upload sayfasıyla aynı!)
        else if (doc.file_path || doc.storage_path) {
          const storagePath = doc.storage_path || doc.file_path;
          console.log(`📄 Dosya analizi [${docId}]: ${doc.original_filename}`);
          
          // Supabase'den indir veya local dosyayı kullan
          let localFilePath;
          let tempDir = null;
          
          if (storagePath.includes('supabase') || storagePath.startsWith('tenders/')) {
            // Supabase'den indir
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-analyze-'));
            const ext = path.extname(doc.original_filename || '.pdf');
            localFilePath = path.join(tempDir, `document${ext}`);
            
            const buffer = await downloadFromSupabase(storagePath);
            fs.writeFileSync(localFilePath, buffer);
            console.log(`   ✅ Supabase'den indirildi: ${localFilePath}`);
          } else {
            localFilePath = storagePath;
          }
          
          try {
            // Claude analyzeFile kullan (Upload sayfasıyla AYNI sistem!)
            const result = await analyzeFile(localFilePath, (progress) => {
              sendEvent({ 
                stage: 'progress', 
                documentId: docId,
                ...progress 
              });
            });
            
            analysisResult = result.analiz || result;
          } finally {
            // Temp dosyayı temizle
            if (tempDir) {
              try { fs.rmSync(tempDir, { recursive: true }); } catch(e) {}
            }
          }
        }
        else {
          results.push({ id: docId, success: false, error: 'İçerik bulunamadı' });
          continue;
        }
        
        // Sonucu kaydet
        await pool.query(
          `UPDATE documents 
           SET analysis_result = $1, 
               processing_status = 'completed'
           WHERE id = $2`,
          [JSON.stringify(analysisResult), docId]
        );
        
        results.push({ id: docId, success: true, analysis: analysisResult });
        
      } catch (docError) {
        console.error(`Döküman ${docId} analiz hatası:`, docError);
        results.push({ id: docId, success: false, error: docError.message });
        
        // Hata durumunu kaydet
        await pool.query(
          `UPDATE documents SET processing_status = 'failed' WHERE id = $1`,
          [docId]
        );
      }
    }
    
    sendEvent({ 
      stage: 'complete', 
      message: 'Toplu analiz tamamlandı',
      results,
      summary: {
        total: documentIds.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
    res.end();
    
  } catch (error) {
    console.error('❌ Toplu analiz hatası:', error);
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
        error: 'documentIds array gerekli'
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
    
    console.log(`🔄 ${result.rowCount} hatalı döküman sıfırlandı`);
    
    res.json({
      success: true,
      message: `${result.rowCount} döküman tekrar analiz için hazır`,
      resetCount: result.rowCount,
      resetIds: result.rows.map(r => r.id)
    });
    
  } catch (error) {
    console.error('❌ Reset failed hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;