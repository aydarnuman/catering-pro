/**
 * Document Storage Service
 * İhale dökümanlarını Supabase Storage'a indirip kaydeder
 * ZIP dosyalarını açar ve içindeki dosyaları ayrı ayrı kaydeder
 */

import { exec } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import AdmZip from 'adm-zip';
import { pool } from '../database.js';
import { supabase } from '../supabase.js';
import logger from '../utils/logger.js';
import documentDownloadService from './document-download.js';

const execAsync = promisify(exec);

// Storage bucket name
const BUCKET_NAME = 'tender-documents';

// Desteklenen dosya uzantıları - GENİŞLETİLMİŞ LİSTE
const SUPPORTED_EXTENSIONS = [
  // Dökümanlar
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',      // PowerPoint
  '.pptx',     // PowerPoint (yeni)
  '.rtf',      // Rich Text
  '.odt',      // OpenDocument Text
  '.ods',      // OpenDocument Spreadsheet
  '.odp',      // OpenDocument Presentation
  // Arşivler
  '.zip',
  '.rar',
  '.7z',       // 7-Zip
  // Görseller
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.tiff',
  '.tif',
  '.bmp',
  // Metin
  '.txt',
  '.csv',
  '.xml',
  '.json',
  // Teknik dosyalar (sadece sakla, analiz etme)
  '.dwg',      // AutoCAD - teknik şartnamelerde yaygın
  '.dxf',      // AutoCAD exchange format
];

// Content-Type mapping - GENİŞLETİLMİŞ
const CONTENT_TYPES = {
  // Dökümanlar
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  // Arşivler
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  // Görseller
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.bmp': 'image/bmp',
  // Metin
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.json': 'application/json',
  // Teknik
  '.dwg': 'application/acad',
  '.dxf': 'application/dxf',
};

// Doc type display names
const DOC_TYPE_NAMES = {
  admin_spec: 'İdari Şartname',
  tech_spec: 'Teknik Şartname',
  project_files: 'Proje Dosyaları',
  announcement: 'İhale İlanı',
  zeyilname: 'Zeyilname',
  zeyilname_tech_spec: 'Teknik Şartname Zeyilnamesi',
  zeyilname_admin_spec: 'İdari Şartname Zeyilnamesi',
  correction_notice: 'Düzeltme İlanı',
  contract: 'Sözleşme Tasarısı',
  unit_price: 'Birim Fiyat Teklif Cetveli',
  pursantaj: 'Pursantaj Listesi',
  quantity_survey: 'Mahal Listesi / Metraj',
  standard_forms: 'Standart Formlar',
  goods_services: 'Mal/Hizmet Listesi',
};

class DocumentStorageService {
  constructor() {
    this.downloadDelay = 2000; // Rate limiting: 2 saniye
  }

  /**
   * Dosya adından doc_type belirle
   * ZIP'ten çıkan dosyalar için dosya adına bakarak doğru tipi belirler
   * @param {string} fileName - Dosya adı
   * @param {string} defaultDocType - Varsayılan doc_type (parent'tan gelen)
   * @returns {string} - Belirlenen doc_type
   */
  detectDocTypeFromFileName(fileName, defaultDocType) {
    // Türkçe karakterleri normalize et ve küçük harfe çevir
    const nameLower = fileName
      .toLowerCase()
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/İ/gi, 'i')
      .replace(/[_-]/g, ' '); // Alt çizgi ve tire'yi boşluğa çevir

    // Zeyilname kontrolü - dosya adında "zeyilname" geçiyorsa
    if (nameLower.includes('zeyilname')) {
      // Hangi şartnamenin zeyilnamesi?
      if (nameLower.includes('teknik') || defaultDocType === 'tech_spec') {
        return 'zeyilname_tech_spec';
      }
      if (nameLower.includes('idari') || defaultDocType === 'admin_spec') {
        return 'zeyilname_admin_spec';
      }
      return 'zeyilname'; // Genel zeyilname
    }

    // Düzeltme kontrolü
    if (nameLower.includes('duzeltme')) {
      return 'correction_notice';
    }

    // ÖNCELİK SIRASI ÖNEMLİ!
    
    // 1. İlan (en önce - 'ihale ilani', 'sonuc ilani' gibi isimler "hizmet" içerebilir)
    if (nameLower.includes('ilan') || nameLower.includes('announcement')) {
      return 'announcement';
    }
    
    // 2. Sözleşme/Tasarı
    if (nameLower.includes('sozlesme') || nameLower.includes('tasari') || nameLower.includes('contract')) {
      return 'contract';
    }

    // 3. Teknik şartname
    if (nameLower.includes('teknik') || nameLower.includes('tech')) {
      return 'tech_spec';
    }

    // 4. İdari şartname
    if (nameLower.includes('idari') || nameLower.includes('admin')) {
      return 'admin_spec';
    }

    // 5. Birim fiyat cetveli
    if (nameLower.includes('birim') || nameLower.includes('fiyat') || nameLower.includes('cetvel') || nameLower.includes('price')) {
      return 'unit_price';
    }

    // 6. Mal/Hizmet listesi (en sonda - çok genel kelimeler)
    if (nameLower.includes('mal ') || nameLower.includes('hizmet ') || nameLower.includes('malzeme') || nameLower.includes('liste')) {
      return 'item_list';
    }

    // Pursantaj
    if (nameLower.includes('pursantaj')) {
      return 'pursantaj';
    }

    // Mahal listesi / Metraj
    if (nameLower.includes('mahal') || nameLower.includes('metraj')) {
      return 'quantity_survey';
    }

    // Standart formlar
    if (nameLower.includes('form') || nameLower.includes('standart')) {
      return 'standard_forms';
    }

    // Varsayılan tipi döndür
    return defaultDocType || 'other';
  }

  /**
   * Tek bir ihale için tüm dökümanları indir ve depola
   * @param {number} tenderId - İhale ID
   * @returns {Object} - İndirme sonuçları
   */
  async downloadTenderDocuments(tenderId) {
    logger.info(`İhale ${tenderId} dökümanları indiriliyor`);

    const results = {
      tenderId,
      success: [],
      failed: [],
      skipped: [],
      totalDownloaded: 0,
      totalSize: 0,
    };

    try {
      // 1. İhale bilgilerini al
      const tenderResult = await pool.query(
        'SELECT id, title, document_links, external_id FROM tenders WHERE id = $1',
        [tenderId]
      );

      if (tenderResult.rows.length === 0) {
        throw new Error(`İhale bulunamadı: ${tenderId}`);
      }

      const tender = tenderResult.rows[0];
      const documentLinks = tender.document_links || {};

      if (Object.keys(documentLinks).length === 0) {
        logger.warn(`İhale ${tenderId}: Döküman linki yok`);
        return { ...results, message: 'Döküman linki bulunamadı' };
      }

      // 2. Daha önce indirilmiş dökümanları kontrol et
      const existingDocs = await pool.query(
        `SELECT source_url FROM documents 
         WHERE tender_id = $1 AND source_type = 'download'`,
        [tenderId]
      );
      const downloadedUrls = new Set(existingDocs.rows.map((d) => d.source_url));

      // 3. Her döküman tipi için indir
      for (const [docType, docData] of Object.entries(documentLinks)) {
        try {
          const url = typeof docData === 'string' ? docData : docData?.url;
          const name = typeof docData === 'object' ? docData?.name : null;
          const fileName = typeof docData === 'object' ? docData?.fileName : null;
          
          // fileName'den uzantı çıkar (ekap://2026/26DT183631.cetvel.docx -> .docx)
          let fileExtFromName = null;
          if (fileName) {
            const extMatch = fileName.match(/\.(\w+)$/);
            if (extMatch) {
              fileExtFromName = `.${extMatch[1].toLowerCase()}`;
              logger.debug(`fileName'den uzantı: ${fileExtFromName} (${fileName})`);
            }
          }

          if (!url) {
            logger.warn(`${docType}: URL bulunamadı`);
            continue;
          }

          // Daha önce indirilmiş mi kontrol et
          if (downloadedUrls.has(url)) {
            logger.debug(`${docType}: Zaten indirilmiş`);
            results.skipped.push({ docType, reason: 'already_downloaded' });
            continue;
          }

          logger.info(`${docType}: İndiriliyor... ${url.substring(0, 50)}...`);

          // Rate limiting
          await this.sleep(this.downloadDelay);

          // Dökümanı indir (fileExtFromName varsa öncelikli uzantı olarak geç)
          const downloadResult = await this.downloadAndStore(tenderId, docType, url, name, fileExtFromName);

          results.success.push({
            docType,
            ...downloadResult,
          });
          results.totalDownloaded += downloadResult.filesCount || 1;
          results.totalSize += downloadResult.totalSize || 0;
        } catch (error) {
          logger.error(`${docType}: İndirme hatası`, { error: error.message, docType, tenderId });
          results.failed.push({
            docType,
            error: error.message,
          });
        }
      }

      logger.info(`İhale ${tenderId} dökümanları tamamlandı`, {
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        totalFiles: results.totalDownloaded,
        totalSizeMB: (results.totalSize / 1024 / 1024).toFixed(2),
      });

      // Başarılı indirmelerin Supabase'e kaydedildiğini doğrula
      if (results.success.length > 0) {
        const verifyResult = await pool.query(
          `SELECT COUNT(*) as count, SUM(file_size) as total_size
           FROM documents 
           WHERE tender_id = $1 AND source_type = 'download' AND processing_status = 'pending'`,
          [tenderId]
        );
        const verified = verifyResult.rows[0];
        logger.debug(
          `Doğrulama: ${verified.count} döküman DB'de pending durumunda (${(verified.total_size / 1024 / 1024).toFixed(2)} MB)`
        );
      }

      return results;
    } catch (error) {
      logger.error(`İhale ${tenderId} döküman indirme hatası`, { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Tek bir dökümanı indir ve depola
   * @param {string} hintExtension - fileName'den çıkarılan uzantı ipucu (opsiyonel)
   */
  async downloadAndStore(tenderId, docType, url, displayName = null, hintExtension = null) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tender-doc-'));

    try {
      // 1. Dökümanı indir
      const fileBuffer = await documentDownloadService.downloadDocument(url);

      // 2. Dosya uzantısını belirle - öncelik sırası:
      //    a) Magic bytes'tan tespit (en güvenilir)
      //    b) fileName'den gelen ipucu (hintExtension)
      //    c) URL'den uzantı
      //    d) Varsayılan .pdf
      let extension = this.detectFileType(fileBuffer);
      
      // Magic bytes null döndü ama hintExtension varsa onu kullan
      if (!extension && hintExtension) {
        logger.info(`Magic bytes tanınamadı, fileName uzantısı kullanılıyor: ${hintExtension}`);
        extension = hintExtension;
      }
      
      // Hala null ise URL'den veya varsayılan
      extension = extension || this.getExtensionFromUrl(url) || '.pdf';
      
      const isZip = extension === '.zip' || extension === '.rar';

      logger.debug(`Dosya tipi tespit edildi: ${extension} (URL: ${url.substring(0, 50)}...)`);

      // 3. Temp dosyaya kaydet
      const tempFilePath = path.join(tempDir, `download${extension}`);
      await fs.writeFile(tempFilePath, fileBuffer);

      let uploadResults = [];

      if (isZip) {
        // ZIP dosyasını aç ve içindekileri yükle
        console.log(`[DocumentStorage] ZIP tespit edildi, açılıyor: ${url}`);
        uploadResults = await this.extractAndUpload(tenderId, docType, tempFilePath, url);
        console.log(`[DocumentStorage] ZIP açıldı, ${uploadResults.length} dosya:`, uploadResults.map(r => r.fileName));
      } else {
        // Tek dosyayı yükle
        const result = await this.uploadSingleFile(
          tenderId,
          docType,
          fileBuffer,
          extension,
          displayName || this.getDisplayName(docType),
          url
        );
        uploadResults = [result];
      }

      return {
        docType,
        filesCount: uploadResults.length,
        totalSize: uploadResults.reduce((sum, r) => sum + (r.fileSize || 0), 0),
        files: uploadResults,
      };
    } finally {
      // Temp klasörü temizle
      try {
        await fs.rm(tempDir, { recursive: true });
      } catch (e) {
        logger.warn('Temp klasör temizleme hatası', { error: e.message });
      }
    }
  }

  /**
   * ZIP dosyasını aç ve içindekileri yükle
   * Node.js adm-zip kullanarak Türkçe karakter sorunlarını çözer
   */
  async extractAndUpload(tenderId, docType, zipPath, sourceUrl) {
    const extractDir = path.join(path.dirname(zipPath), 'extracted');
    await fs.mkdir(extractDir, { recursive: true });

    try {
      const ext = path.extname(zipPath).toLowerCase();
      const uploadResults = [];

      if (ext === '.zip') {
        // adm-zip ile ZIP aç (Türkçe karakter desteği)
        logger.info(`ZIP dosyası açılıyor (adm-zip): ${zipPath}`);
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        logger.info(`ZIP içinde ${zipEntries.length} dosya bulundu`);

        for (const entry of zipEntries) {
          // Klasörleri atla
          if (entry.isDirectory) continue;

          // Dosya adını UTF-8 olarak decode et
          let fileName = entry.entryName;

          // Path'ten sadece dosya adını al
          fileName = path.basename(fileName);

          // Türkçe karakterleri düzelt (CP437 -> UTF-8)
          try {
            // Buffer'dan UTF-8 string oluştur
            const nameBuffer = Buffer.from(entry.rawEntryName);
            const utf8Name = nameBuffer.toString('utf8');
            if (utf8Name && !utf8Name.includes('�')) {
              fileName = path.basename(utf8Name);
            }
          } catch (_e) {
            // Decode hatasında orijinal ismi kullan
          }

          const fileExt = path.extname(fileName).toLowerCase();

          // Desteklenen dosya mı kontrol et
          if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
            logger.warn(`Desteklenmeyen dosya atlandı: ${fileName}`);
            continue;
          }

          // Dosya içeriğini al
          const buffer = entry.getData();
          logger.debug(`İşleniyor: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);

          // ZIP'ten çıkan dosyalar için unique source_url oluştur
          // (aynı ZIP'ten birden fazla dosya çıkabilir)
          const uniqueSourceUrl = `${sourceUrl}#file=${encodeURIComponent(entry.entryName)}`;

          // Dosya adına göre doc_type belirle
          const fileDocType = this.detectDocTypeFromFileName(fileName, docType);

          // Dosyayı yükle
          const result = await this.uploadSingleFile(
            tenderId,
            fileDocType, // Dosya adına göre belirlenen doc_type
            buffer,
            fileExt,
            fileName,
            uniqueSourceUrl, // Unique URL
            true // ZIP'ten çıkarıldı
          );

          uploadResults.push(result);
        }
      } else if (ext === '.rar') {
        // RAR için unrar komutu dene
        try {
          await execAsync(`unrar x -o+ "${zipPath}" "${extractDir}/"`);

          // Açılan dosyaları bul
          const extractedFiles = await this.walkDirectory(extractDir);
          logger.info(`RAR'dan ${extractedFiles.length} dosya çıkarıldı`);

          for (const filePath of extractedFiles) {
            const fileName = path.basename(filePath);
            const fileExt = path.extname(fileName).toLowerCase();

            if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
              logger.warn(`Desteklenmeyen dosya atlandı: ${fileName}`);
              continue;
            }

            const buffer = await fs.readFile(filePath);
            const result = await this.uploadSingleFile(tenderId, docType, buffer, fileExt, fileName, sourceUrl, true);
            uploadResults.push(result);
          }
        } catch (e) {
          logger.warn('RAR açılamadı (unrar yüklü olmayabilir)', { error: e.message });
          // RAR'ı direkt yükle
          const buffer = await fs.readFile(zipPath);
          const result = await this.uploadSingleFile(
            tenderId,
            docType,
            buffer,
            '.rar',
            `${this.getDisplayName(docType)}.rar`,
            sourceUrl
          );
          return [result];
        }
      }

      // ZIP/RAR dosyasının kendisini de kaydet (parent olarak)
      const archiveBuffer = await fs.readFile(zipPath);
      const archiveResult = await this.uploadSingleFile(
        tenderId,
        docType,
        archiveBuffer,
        ext,
        this.getDisplayName(docType) + ext,
        sourceUrl,
        false,
        true
      );

      // Çıkarılan dosyaların parent_doc_id'sini güncelle
      if (uploadResults.length > 0 && archiveResult.documentId) {
        await pool.query(`UPDATE documents SET parent_doc_id = $1 WHERE id = ANY($2::int[])`, [
          archiveResult.documentId,
          uploadResults.map((r) => r.documentId),
        ]);
      }

      logger.info(`ZIP'ten ${uploadResults.length} dosya yüklendi`);
      return [archiveResult, ...uploadResults];
    } catch (error) {
      logger.error('ZIP açma hatası', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Tek dosyayı Supabase Storage'a yükle ve DB'ye kaydet
   */
  async uploadSingleFile(
    tenderId,
    docType,
    buffer,
    extension,
    displayName,
    sourceUrl,
    isExtracted = false,
    isZipParent = false
  ) {
    // Unique dosya adı oluştur
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const timestamp = Date.now();
    const safeFileName = this.sanitizeFileName(displayName || `doc-${uniqueId}`);

    // Storage path için URL-safe dosya adı (Türkçe karakterleri ve boşlukları encode et)
    const urlSafeFileName = this.makeUrlSafe(safeFileName);
    const storageFileName = `${timestamp}-${uniqueId}-${urlSafeFileName}${extension}`;

    // Storage path: tenders/{tenderId}/{docType}/{filename}
    const storagePath = `tenders/${tenderId}/${docType}/${storageFileName}`;

    // Content-Type belirle
    const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';

    try {
      // Supabase kontrolü
      if (!supabase || !supabase.storage) {
        throw new Error(
          "Supabase client veya storage mevcut değil. Lütfen SUPABASE_SERVICE_KEY environment variable'ını kontrol edin."
        );
      }

      // 1. Supabase Storage'a yükle
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        // Detaylı hata logla
        logger.error('Supabase Storage yükleme hatası', {
          error: uploadError.message,
          code: uploadError.statusCode,
          storagePath,
          fileSize: buffer.length,
          contentType,
        });
        throw new Error(
          `Storage yükleme hatası: ${uploadError.message} (Code: ${uploadError.statusCode || 'unknown'})`
        );
      }

      if (!uploadData || !uploadData.path) {
        throw new Error('Supabase upload başarılı görünüyor ama data dönmedi');
      }

      logger.info(`Supabase'e yüklendi: ${storagePath} (${buffer.length} bytes, path: ${uploadData.path})`);

      // 2. Public URL al
      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

      const storageUrl = urlData?.publicUrl || null;

      // 3. documents tablosuna kaydet (duplike kontrolü ile)
      const insertResult = await pool.query(
        `INSERT INTO documents (
          tender_id, filename, original_filename, file_type, file_size,
          file_path, storage_path, storage_url, source_url, doc_type,
          source_type, is_extracted, processing_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (tender_id, original_filename) WHERE tender_id IS NOT NULL
        DO UPDATE SET 
          storage_path = EXCLUDED.storage_path,
          storage_url = EXCLUDED.storage_url,
          file_size = EXCLUDED.file_size,
          updated_at = NOW()
        RETURNING id, storage_path, storage_url, (xmax = 0) as is_new`,
        [
          tenderId,
          storageFileName,
          displayName,
          extension.replace('.', ''),
          buffer.length,
          storagePath, // file_path olarak storage_path kullan
          storagePath,
          storageUrl,
          sourceUrl,
          docType,
          'download',
          isExtracted,
          'pending', // Kuyrukta bekliyor
        ]
      );

      const insertedDoc = insertResult.rows[0];

      // Kayıt kontrolü
      if (!insertedDoc || !insertedDoc.id) {
        throw new Error('Döküman veritabanına kaydedilemedi');
      }

      // Duplike uyarısı
      if (!insertedDoc.is_new) {
        logger.warn(`Döküman zaten mevcut, güncellendi: ${displayName}`);
      }

      logger.debug(
        `Döküman DB'ye kaydedildi: ID=${insertedDoc.id}, storage_path=${insertedDoc.storage_path}, storage_url=${insertedDoc.storage_url || 'NULL'}`
      );

      return {
        documentId: insertedDoc.id,
        storagePath: insertedDoc.storage_path,
        storageUrl: insertedDoc.storage_url,
        fileName: displayName,
        fileSize: buffer.length,
        fileType: extension,
        isExtracted,
        isZipParent,
      };
    } catch (error) {
      logger.error(`Dosya yükleme hatası: ${displayName}`, { error: error.message, stack: error.stack, displayName });
      throw error;
    }
  }

  /**
   * Belirli bir dökümanı kuyruğa ekle (analiz için)
   * ALTIN KURAL: ZIP dosyaları asla analize gönderilmez!
   */
  async addToQueue(documentId) {
    // Önce dökümanı kontrol et
    const checkResult = await pool.query(
      `SELECT id, original_filename, file_type, is_extracted 
       FROM documents WHERE id = $1`,
      [documentId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error(`Döküman bulunamadı: ${documentId}`);
    }

    const doc = checkResult.rows[0];

    // ZIP dosyaları analize gönderilemez - ALTIN KURAL
    if (doc.file_type === 'zip' || doc.file_type === '.zip') {
      throw new Error(`ZIP dosyaları analize gönderilemez. Önce çıkarılmalı: ${doc.original_filename}`);
    }

    const result = await pool.query(
      `UPDATE documents 
       SET processing_status = 'queued'
       WHERE id = $1 
       RETURNING id, original_filename, processing_status`,
      [documentId]
    );

    return result.rows[0];
  }

  /**
   * Birden fazla dökümanı kuyruğa ekle
   * ALTIN KURAL: ZIP dosyaları otomatik olarak atlanır!
   */
  async addMultipleToQueue(documentIds) {
    // ZIP dosyalarını hariç tut - ALTIN KURAL
    const result = await pool.query(
      `UPDATE documents 
       SET processing_status = 'queued'
       WHERE id = ANY($1::int[])
         AND file_type NOT IN ('zip', '.zip')
       RETURNING id, original_filename, processing_status`,
      [documentIds]
    );

    // Atlanan ZIP'leri logla
    if (result.rows.length < documentIds.length) {
      const skippedCount = documentIds.length - result.rows.length;
      logger.info('ZIP files skipped from queue', {
        module: 'document-storage',
        skippedCount,
        queuedCount: result.rows.length,
      });
    }

    return result.rows;
  }

  /**
   * İhale için indirilen dökümanları listele
   */
  async getDownloadedDocuments(tenderId) {
    const result = await pool.query(
      `SELECT 
        id, tender_id, filename, original_filename, file_type, file_size,
        storage_path, storage_url, source_url, doc_type, source_type,
        is_extracted, parent_doc_id, processing_status, created_at,
        analysis_result, extracted_text
       FROM documents 
       WHERE tender_id = $1 AND source_type IN ('download', 'content')
       ORDER BY source_type, doc_type, is_extracted, created_at`,
      [tenderId]
    );

    return result.rows;
  }

  /**
   * Döküman için signed URL al (private bucket için)
   */
  async getSignedUrl(documentId, expiresIn = 3600) {
    const docResult = await pool.query('SELECT storage_path FROM documents WHERE id = $1', [documentId]);

    if (docResult.rows.length === 0) {
      throw new Error(`Döküman bulunamadı: ${documentId}`);
    }

    const { storage_path } = docResult.rows[0];

    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(storage_path, expiresIn);

    if (error) {
      throw new Error(`Signed URL oluşturma hatası: ${error.message}`);
    }

    return data.signedUrl;
  }

  // ===== HELPER METHODS =====

  /**
   * URL'den dosya uzantısını çıkar
   */
  getExtensionFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      const ext = path.extname(pathname).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) ? ext : null;
    } catch {
      // URL'de uzantı yoksa içerikten tahmin et
      if (url.includes('idari') || url.includes('teknik')) return '.pdf';
      if (url.includes('.zip')) return '.zip';
      return null;
    }
  }

  /**
   * Doc type için görüntüleme adı
   */
  getDisplayName(docType) {
    // admin_spec_2 -> İdari Şartname 2
    for (const [key, value] of Object.entries(DOC_TYPE_NAMES)) {
      if (docType === key) return value;
      if (docType.startsWith(`${key}_`)) {
        const num = docType.replace(`${key}_`, '');
        return `${value} ${num}`;
      }
    }
    return docType.replace(/_/g, ' ');
  }

  /**
   * Dosya içeriğinden gerçek dosya türünü tespit et (magic bytes)
   */
  detectFileType(buffer) {
    if (!buffer || buffer.length < 4) return null;

    // Magic bytes kontrolü
    const _magicBytes = {
      // PDF: %PDF
      pdf: [0x25, 0x50, 0x44, 0x46],
      // ZIP: PK
      zip: [0x50, 0x4b, 0x03, 0x04],
      // RAR: Rar!
      rar: [0x52, 0x61, 0x72, 0x21],
      // PNG: .PNG
      png: [0x89, 0x50, 0x4e, 0x47],
      // JPEG: FFD8FF
      jpg: [0xff, 0xd8, 0xff],
      // DOCX/XLSX (Office Open XML - aslında ZIP)
      docx: [0x50, 0x4b, 0x03, 0x04],
    };

    // PDF kontrolü
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return '.pdf';
    }

    // ZIP kontrolü (ZIP, DOCX, XLSX, PPTX hepsi aynı magic bytes - PK)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      // ZIP içeriğine bakarak DOCX/XLSX/PPTX mi gerçek ZIP mi anla
      try {
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries().map(e => e.entryName);
        
        // Office Open XML dosyaları [Content_Types].xml içerir
        if (entries.includes('[Content_Types].xml')) {
          // Word, Excel, PowerPoint ayrımı
          if (entries.some(e => e.startsWith('word/'))) {
            logger.debug('DOCX tespit edildi (Office Open XML - Word)');
            return '.docx';
          }
          if (entries.some(e => e.startsWith('xl/'))) {
            logger.debug('XLSX tespit edildi (Office Open XML - Excel)');
            return '.xlsx';
          }
          if (entries.some(e => e.startsWith('ppt/'))) {
            logger.debug('PPTX tespit edildi (Office Open XML - PowerPoint)');
            return '.pptx';
          }
          // Bilinmeyen Office formatı, docx olarak varsay
          logger.debug('Office Open XML tespit edildi, docx olarak işleniyor');
          return '.docx';
        }
        
        // Gerçek ZIP dosyası
        logger.debug('ZIP formatı tespit edildi (gerçek arşiv)');
        return '.zip';
      } catch (e) {
        // ZIP parse hatası, yine de ZIP olarak işle
        logger.debug('ZIP parse hatası, ZIP olarak işleniyor:', e.message);
        return '.zip';
      }
    }

    // RAR kontrolü
    if (buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21) {
      return '.rar';
    }

    // PNG kontrolü
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return '.png';
    }

    // JPEG kontrolü
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return '.jpg';
    }

    // OLE Compound File (DOC, XLS, PPT - eski Office formatları)
    // Magic bytes: D0 CF 11 E0 A1 B1 1A E1
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      logger.debug('OLE Compound File tespit edildi (eski Office formatı)');
      // İçeriğe bakarak DOC/XLS/PPT ayrımı zor, URL'den uzantıya bakacağız
      return null; // getExtensionFromUrl'e bırak
    }

    // GIF kontrolü
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return '.gif';
    }

    // BMP kontrolü
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return '.bmp';
    }

    // TIFF kontrolü
    if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
        (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)) {
      return '.tiff';
    }

    return null;
  }

  /**
   * Dosya adını güvenli hale getir (Türkçe karakter temizleme YOK)
   */
  sanitizeFileName(fileName) {
    // Sadece tehlikeli karakterleri temizle, Türkçe karakter kalsın
    return fileName
      .replace(/[<>:"/\\|?*]/g, '') // Dosya sistemi için tehlikeli karakterler
      .replace(/\s+/g, ' ') // Fazla boşlukları tek boşluğa indir
      .trim()
      .substring(0, 200); // Max 200 karakter
  }

  /**
   * Dosya adını URL-safe hale getir (Supabase Storage için)
   * Türkçe karakterleri ve boşlukları encode eder
   */
  makeUrlSafe(fileName) {
    // Türkçe karakterleri normalize et
    const turkishMap = {
      ç: 'c',
      Ç: 'C',
      ğ: 'g',
      Ğ: 'G',
      ı: 'i',
      İ: 'I',
      ö: 'o',
      Ö: 'O',
      ş: 's',
      Ş: 'S',
      ü: 'u',
      Ü: 'U',
    };

    let safe = fileName;
    // Türkçe karakterleri değiştir
    for (const [turkish, latin] of Object.entries(turkishMap)) {
      safe = safe.replace(new RegExp(turkish, 'g'), latin);
    }

    // Boşlukları tire ile değiştir
    safe = safe.replace(/\s+/g, '-');

    // URL-safe olmayan karakterleri encode et veya kaldır
    safe = safe
      .replace(/[^a-zA-Z0-9\-_.]/g, '-') // Sadece alfanumerik, tire, alt çizgi, nokta
      .replace(/-+/g, '-') // Birden fazla tireyi tek tireye indir
      .replace(/^-|-$/g, ''); // Başta ve sonda tire varsa kaldır

    return safe || 'file'; // Boşsa default isim
  }

  /**
   * Dizini recursive olarak tara
   */
  async walkDirectory(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walkDirectory(fullPath)));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new DocumentStorageService();
