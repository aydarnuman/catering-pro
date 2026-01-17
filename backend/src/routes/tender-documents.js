/**
 * Tender Documents API
 * İhale dökümanlarını Supabase Storage'a indirme ve yönetme endpoint'leri
 */

import express from 'express';
import documentStorageService from '../services/document-storage.js';
import { pool } from '../database.js';

const router = express.Router();

/**
 * İhale dökümanlarını Storage'a indir
 * POST /api/tenders/:tenderId/download-documents
 */
router.post('/:tenderId/download-documents', async (req, res) => {
  try {
    const { tenderId } = req.params;
    
    console.log(`📥 API: İhale ${tenderId} dökümanları indiriliyor...`);
    
    // İhalenin varlığını kontrol et
    const tenderCheck = await pool.query(
      'SELECT id, title FROM tenders WHERE id = $1',
      [tenderId]
    );
    
    if (tenderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'İhale bulunamadı'
      });
    }

    // ✅ İndirmeden önce failed dökümanları otomatik temizle
    // Bu sayede yeniden indirme tetiklenecek
    const cleanupResult = await pool.query(
      `DELETE FROM documents 
       WHERE tender_id = $1 
       AND source_type = 'download' 
       AND processing_status IN ('failed', 'error')
       RETURNING id, original_filename`,
      [tenderId]
    );
    
    if (cleanupResult.rowCount > 0) {
      console.log(`🧹 ${cleanupResult.rowCount} başarısız döküman temizlendi (tender_id: ${tenderId})`);
    }

    // Dökümanları indir
    const result = await documentStorageService.downloadTenderDocuments(parseInt(tenderId));

    res.json({
      success: true,
      data: {
        ...result,
        cleanedUpFailed: cleanupResult.rowCount || 0 // Temizlenen sayısını da döndür
      }
    });

  } catch (error) {
    console.error('❌ Döküman indirme API hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * İhale için indirilen dökümanları listele
 * GET /api/tenders/:tenderId/downloaded-documents
 */
router.get('/:tenderId/downloaded-documents', async (req, res) => {
  try {
    const { tenderId } = req.params;
    
    const documents = await documentStorageService.getDownloadedDocuments(parseInt(tenderId));
    
    // Dökümanları doc_type'a göre grupla
    const grouped = {};
    for (const doc of documents) {
      const type = doc.doc_type || 'other';
      if (!grouped[type]) {
        grouped[type] = {
          docType: type,
          displayName: getDisplayName(type),
          files: []
        };
      }
      grouped[type].files.push(doc);
    }

    res.json({
      success: true,
      data: {
        tenderId: parseInt(tenderId),
        documents: Object.values(grouped),
        totalCount: documents.length,
        totalSize: documents.reduce((sum, d) => sum + (d.file_size || 0), 0)
      }
    });

  } catch (error) {
    console.error('❌ Döküman listeleme hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Döküman detayı
 * GET /api/tenders/documents/:documentId
 */
router.get('/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        d.*,
        t.title as tender_title,
        t.external_id as tender_external_id
       FROM documents d
       LEFT JOIN tenders t ON d.tender_id = t.id
       WHERE d.id = $1`,
      [documentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Döküman bulunamadı'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Döküman detay hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Döküman için imzalı URL al (önizleme/indirme için)
 * GET /api/tenders/documents/:documentId/url
 */
router.get('/documents/:documentId/url', async (req, res) => {
  try {
    const { documentId } = req.params;
    const expiresIn = parseInt(req.query.expires) || 3600; // Default 1 saat
    
    const signedUrl = await documentStorageService.getSignedUrl(
      parseInt(documentId), 
      expiresIn
    );

    res.json({
      success: true,
      data: {
        signedUrl,
        expiresIn
      }
    });

  } catch (error) {
    console.error('❌ Signed URL hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Dökümanı kuyruğa ekle (analiz için)
 * POST /api/tenders/documents/:documentId/queue
 */
router.post('/documents/:documentId/queue', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const result = await documentStorageService.addToQueue(parseInt(documentId));

    res.json({
      success: true,
      data: result,
      message: 'Döküman kuyruğa eklendi'
    });

  } catch (error) {
    console.error('❌ Kuyruğa ekleme hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Birden fazla dökümanı kuyruğa ekle
 * POST /api/tenders/documents/queue-multiple
 */
router.post('/documents/queue-multiple', async (req, res) => {
  try {
    const { documentIds } = req.body;
    
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'documentIds array gerekli'
      });
    }

    const results = await documentStorageService.addMultipleToQueue(documentIds);

    res.json({
      success: true,
      data: results,
      message: `${results.length} döküman kuyruğa eklendi`
    });

  } catch (error) {
    console.error('❌ Toplu kuyruğa ekleme hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * İhale için indirme durumu kontrol
 * GET /api/tenders/:tenderId/download-status
 */
router.get('/:tenderId/download-status', async (req, res) => {
  try {
    const { tenderId } = req.params;
    
    // Tenders'dan document_links'i al
    const tenderResult = await pool.query(
      'SELECT document_links FROM tenders WHERE id = $1',
      [tenderId]
    );
    
    if (tenderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'İhale bulunamadı'
      });
    }

    const documentLinks = tenderResult.rows[0].document_links || {};
    const availableTypes = Object.keys(documentLinks).filter(key => {
      // Boş veya null linkleri filtrele
      const link = documentLinks[key];
      if (typeof link === 'string') return link && link.trim() !== '';
      if (typeof link === 'object' && link !== null) return link.url && link.url.trim() !== '';
      return false;
    });

    // İndirilen dökümanları kontrol et (başarılı olanlar)
    const downloadedResult = await pool.query(
      `SELECT DISTINCT doc_type FROM documents 
       WHERE tender_id = $1 AND source_type = 'download' 
       AND processing_status NOT IN ('failed', 'error')`,
      [tenderId]
    );
    const downloadedTypes = downloadedResult.rows.map(r => r.doc_type).filter(Boolean);

    // Başarısız dökümanları kontrol et
    const failedResult = await pool.query(
      `SELECT DISTINCT doc_type FROM documents 
       WHERE tender_id = $1 AND source_type = 'download' 
       AND processing_status IN ('failed', 'error')`,
      [tenderId]
    );
    const failedTypes = failedResult.rows.map(r => r.doc_type).filter(Boolean);

    // Hangi tipler indirilmemiş veya başarısız?
    // Failed olan tipler yeniden indirilmeli, bu yüzden pendingTypes'a dahil et
    const pendingTypes = availableTypes.filter(t => 
      !downloadedTypes.includes(t) || failedTypes.includes(t)
    );

    const hasDocuments = availableTypes.length > 0;
    const isComplete = hasDocuments && downloadedTypes.length > 0 && pendingTypes.length === 0;

    res.json({
      success: true,
      data: {
        tenderId: parseInt(tenderId),
        availableTypes,
        downloadedTypes,
        pendingTypes,
        failedTypes, // Frontend'e failed bilgisi de gönder
        hasDocuments,
        isComplete,
        hasFailedDownloads: failedTypes.length > 0, // Kolay kontrol için
        progress: hasDocuments
          ? Math.round((downloadedTypes.length / availableTypes.length) * 100)
          : 0
      }
    });

  } catch (error) {
    console.error('❌ İndirme durumu hatası:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper: Doc type için görüntüleme adı
function getDisplayName(docType) {
  const names = {
    'admin_spec': 'İdari Şartname',
    'tech_spec': 'Teknik Şartname',
    'project_files': 'Proje Dosyaları',
    'announcement': 'İhale İlanı',
    'zeyilname': 'Zeyilname',
    'contract': 'Sözleşme Tasarısı',
    'unit_price': 'Birim Fiyat Teklif Cetveli',
    'pursantaj': 'Pursantaj Listesi',
    'quantity_survey': 'Mahal Listesi / Metraj',
    'standard_forms': 'Standart Formlar'
  };

  for (const [key, value] of Object.entries(names)) {
    if (docType === key) return value;
    if (docType.startsWith(key + '_')) {
      const num = docType.replace(key + '_', '');
      return `${value} ${num}`;
    }
  }
  return docType.replace(/_/g, ' ');
}

export default router;
