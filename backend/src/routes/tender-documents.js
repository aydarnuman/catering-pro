/**
 * Tender Documents API
 * İhale dökümanlarını Supabase Storage'a indirme ve yönetme endpoint'leri
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import mammoth from 'mammoth';
import { pool } from '../database.js';
import supabase from '../supabase.js';
import documentStorageService from '../services/document-storage.js';

const router = express.Router();

/**
 * MERKEZ SCRAPER: İhale için tüm içerikleri işle (dosya indirme + içerik scrape)
 * POST /api/tender-docs/:tenderId/merkez-scraper
 *
 * Aynı zamanda eski /download-documents endpoint'i de buraya yönlendirilir (geriye uyumluluk)
 */
async function merkezScraperHandler(req, res) {
  try {
    const { tenderId } = req.params;

    // İhalenin varlığını kontrol et
    const tenderCheck = await pool.query('SELECT id, title FROM tenders WHERE id = $1', [tenderId]);

    if (tenderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'İhale bulunamadı',
      });
    }

    // İndirmeden önce failed dökümanları otomatik temizle
    const cleanupResult = await pool.query(
      `DELETE FROM documents 
       WHERE tender_id = $1 
       AND source_type = 'download' 
       AND processing_status IN ('failed', 'error')
       RETURNING id, original_filename`,
      [tenderId]
    );

    // Merkez Scraper: hem dosya indirme hem içerik scrape
    const result = await documentStorageService.merkezScraper(parseInt(tenderId, 10));

    res.json({
      success: true,
      data: {
        ...result,
        cleanedUpFailed: cleanupResult.rowCount || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// Ana endpoint
router.post('/:tenderId/merkez-scraper', merkezScraperHandler);

// Geriye uyumluluk - eski endpoint'ler aynı handler'a yönlendirilir
router.post('/:tenderId/download-documents', merkezScraperHandler);

/**
 * İhale için indirilen dökümanları listele
 * GET /api/tenders/:tenderId/downloaded-documents
 */
router.get('/:tenderId/downloaded-documents', async (req, res) => {
  try {
    const { tenderId } = req.params;

    const documents = await documentStorageService.getDownloadedDocuments(parseInt(tenderId, 10));

    // Dökümanları doc_type'a göre grupla
    const grouped = {};
    for (const doc of documents) {
      const type = doc.doc_type || 'other';
      if (!grouped[type]) {
        grouped[type] = {
          docType: type,
          displayName: getDisplayName(type),
          files: [],
        };
      }
      grouped[type].files.push(doc);
    }

    res.json({
      success: true,
      data: {
        tenderId: parseInt(tenderId, 10),
        documents: Object.values(grouped),
        totalCount: documents.length,
        totalSize: documents.reduce((sum, d) => sum + (d.file_size || 0), 0),
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
        error: 'Döküman bulunamadı',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
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
    const expiresIn = parseInt(req.query.expires, 10) || 3600; // Default 1 saat

    const signedUrl = await documentStorageService.getSignedUrl(parseInt(documentId, 10), expiresIn);

    res.json({
      success: true,
      data: {
        signedUrl,
        expiresIn,
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
 * DOC/DOCX dosyasını HTML'e dönüştür (önizleme için)
 * GET /api/tender-docs/documents/:documentId/convert
 *
 * DOCX → mammoth ile HTML'e
 * DOC  → mammoth dener, başarısız olursa LibreOffice → HTML, son çare text'e çevirir
 * Sonuç ayrıca extracted_text alanına kaydedilir (cache)
 */
router.get('/documents/:documentId/convert', async (req, res) => {
  const tmpFiles = [];
  try {
    const { documentId } = req.params;
    const docId = parseInt(documentId, 10);

    // 1. Döküman bilgisini al
    const docResult = await pool.query(
      'SELECT id, storage_path, file_type, original_filename, extracted_text, content_text FROM documents WHERE id = $1',
      [docId]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı' });
    }

    const doc = docResult.rows[0];
    const fileType = (doc.file_type || '').toLowerCase();
    const fileName = doc.original_filename || '';

    // 2. Zaten extracted_text veya content_text varsa direkt döndür
    if (doc.extracted_text && doc.extracted_text.trim().length > 50) {
      return res.json({
        success: true,
        data: {
          html: null,
          text: doc.extracted_text,
          format: 'text',
          cached: true,
        },
      });
    }
    if (doc.content_text && doc.content_text.trim().length > 50) {
      return res.json({
        success: true,
        data: {
          html: doc.content_text,
          text: null,
          format: /<[a-z][\s\S]*>/i.test(doc.content_text) ? 'html' : 'text',
          cached: true,
        },
      });
    }

    // 3. storage_path gerekiyor
    if (!doc.storage_path) {
      return res.status(400).json({ success: false, error: 'Dosya storage_path bulunamadı' });
    }

    // 4. Dosyayı Supabase'den indir
    const { data: fileData, error: dlError } = await supabase.storage
      .from('tender-documents')
      .download(doc.storage_path);
    if (dlError || !fileData) {
      return res.status(500).json({ success: false, error: `Dosya indirilemedi: ${dlError?.message || 'Veri yok'}` });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const ext = path.extname(fileName).toLowerCase() || `.${fileType}`;

    // 5. Dönüştürme dene
    let html = '';
    let text = '';
    let format = 'text';

    // 5a. DOCX → mammoth
    if (ext === '.docx' || fileType === 'docx') {
      try {
        const result = await mammoth.convertToHtml({ buffer });
        html = result.value;
        format = 'html';
        const textResult = await mammoth.extractRawText({ buffer });
        text = textResult.value;
      } catch {
        // mammoth başarısız — aşağıda fallback denenecek
      }
    }

    // 5b. DOC veya mammoth başarısız → mammoth ile dene (bazen eski .doc'ları da açar)
    if (!html && !text) {
      try {
        const result = await mammoth.convertToHtml({ buffer });
        html = result.value;
        format = 'html';
        const textResult = await mammoth.extractRawText({ buffer });
        text = textResult.value;
      } catch {
        // mammoth açamadı — LibreOffice dene
      }
    }

    // 5c. LibreOffice fallback (DOC → HTML)
    if (!html && !text) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-convert-'));
      const tmpFile = path.join(tmpDir, `input${ext || '.doc'}`);
      fs.writeFileSync(tmpFile, buffer);
      tmpFiles.push(tmpDir);

      try {
        // Önce HTML'e çevir
        execSync(`soffice --headless --convert-to html --outdir "${tmpDir}" "${tmpFile}"`, {
          timeout: 30000,
          stdio: 'pipe',
        });
        const htmlFile = path.join(tmpDir, 'input.html');
        if (fs.existsSync(htmlFile)) {
          html = fs.readFileSync(htmlFile, 'utf-8');
          // HTML body içeriğini al
          const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (bodyMatch) html = bodyMatch[1];
          format = 'html';
        }
      } catch {
        // HTML başarısız — text'e çevir
        try {
          execSync(`soffice --headless --convert-to txt:Text --outdir "${tmpDir}" "${tmpFile}"`, {
            timeout: 30000,
            stdio: 'pipe',
          });
          const txtFile = path.join(tmpDir, 'input.txt');
          if (fs.existsSync(txtFile)) {
            text = fs.readFileSync(txtFile, 'utf-8');
            format = 'text';
          }
        } catch {
          // Son çare başarısız
        }
      }
    }

    // 6. Sonuç var mı?
    const resultContent = html || text;
    if (!resultContent || resultContent.trim().length < 10) {
      return res.status(422).json({
        success: false,
        error: 'Dosya dönüştürülemedi. Desteklenmeyen format olabilir.',
      });
    }

    // 7. Sonucu extracted_text'e kaydet (cache)
    const textToSave = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (textToSave.length > 50) {
      pool.query('UPDATE documents SET extracted_text = $1 WHERE id = $2', [textToSave, docId]).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        html: format === 'html' ? html : null,
        text: format === 'text' ? text : (text || null),
        format,
        cached: false,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Temp dosyaları temizle
    for (const tmp of tmpFiles) {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        // Temizlik hatası ihmal
      }
    }
  }
});

/**
 * Dökümanı kuyruğa ekle (analiz için)
 * POST /api/tenders/documents/:documentId/queue
 */
router.post('/documents/:documentId/queue', async (req, res) => {
  try {
    const { documentId } = req.params;

    const result = await documentStorageService.addToQueue(parseInt(documentId, 10));

    res.json({
      success: true,
      data: result,
      message: 'Döküman kuyruğa eklendi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
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
        error: 'documentIds array gerekli',
      });
    }

    const results = await documentStorageService.addMultipleToQueue(documentIds);

    res.json({
      success: true,
      data: results,
      message: `${results.length} döküman kuyruğa eklendi`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
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
    const tenderResult = await pool.query('SELECT document_links FROM tenders WHERE id = $1', [tenderId]);

    if (tenderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'İhale bulunamadı',
      });
    }

    const documentLinks = tenderResult.rows[0].document_links || {};
    const availableTypes = Object.keys(documentLinks).filter((key) => {
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
    const downloadedTypes = downloadedResult.rows.map((r) => r.doc_type).filter(Boolean);

    // Başarısız dökümanları kontrol et
    const failedResult = await pool.query(
      `SELECT DISTINCT doc_type FROM documents 
       WHERE tender_id = $1 AND source_type = 'download' 
       AND processing_status IN ('failed', 'error')`,
      [tenderId]
    );
    const failedTypes = failedResult.rows.map((r) => r.doc_type).filter(Boolean);

    // Hangi tipler indirilmemiş veya başarısız?
    // Failed olan tipler yeniden indirilmeli, bu yüzden pendingTypes'a dahil et
    const pendingTypes = availableTypes.filter((t) => !downloadedTypes.includes(t) || failedTypes.includes(t));

    const hasDocuments = availableTypes.length > 0;
    const isComplete = hasDocuments && downloadedTypes.length > 0 && pendingTypes.length === 0;

    res.json({
      success: true,
      data: {
        tenderId: parseInt(tenderId, 10),
        availableTypes,
        downloadedTypes,
        pendingTypes,
        failedTypes, // Frontend'e failed bilgisi de gönder
        hasDocuments,
        isComplete,
        hasFailedDownloads: failedTypes.length > 0, // Kolay kontrol için
        progress: hasDocuments ? Math.round((downloadedTypes.length / availableTypes.length) * 100) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Helper: Doc type için görüntüleme adı
function getDisplayName(docType) {
  const names = {
    admin_spec: 'İdari Şartname',
    tech_spec: 'Teknik Şartname',
    project_files: 'Proje Dosyaları',
    announcement: 'İhale İlanı',
    zeyilname: 'Zeyilname',
    contract: 'Sözleşme Tasarısı',
    unit_price: 'Birim Fiyat Teklif Cetveli',
    pursantaj: 'Pursantaj Listesi',
    quantity_survey: 'Mahal Listesi / Metraj',
    standard_forms: 'Standart Formlar',
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
