/**
 * Document Queue Processor
 * v5.2 - Retry & Streaming Desteği
 *
 * Kuyruktaki dökümanları otomatik işleme servisi
 * - Local dosyalar (file_path)
 * - Supabase dosyalar (storage_url)
 * - Retry mekanizması (exponential backoff)
 * - Timeout koruması
 * - Büyük dosya streaming
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { pool } from '../database.js';
import { processContentDocument, processDocument } from './document.js';
import { runPipeline } from './ai-analyzer/pipeline/index.js';
import logger from '../utils/logger.js';

// Download ayarları
const DOWNLOAD_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,      // İlk retry bekleme süresi
  timeoutMs: 120000,       // 2 dakika timeout
  maxRedirects: 5,
  progressLogThreshold: 5 * 1024 * 1024, // 5MB üzeri dosyalarda progress log
};

// Temp dizini
const TEMP_DIR = path.join(process.cwd(), '../temp-analysis');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class DocumentQueueProcessor {
  constructor() {
    this.isProcessing = false;
    this.maxConcurrent = 2;
    this.processInterval = 30000; // 30 saniye
    this.scheduler = null;
    this.usePipeline = true; // Yeni pipeline'ı kullan
  }

  /**
   * Queue processor'ı başlat
   */
  start() {
    if (this.scheduler) return;

    logger.info('Queue processor started', {
      module: 'queue-processor',
      usePipeline: this.usePipeline,
      interval: `${this.processInterval / 1000}s`,
    });

    this.scheduler = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processQueue();
      }
    }, this.processInterval);
  }

  /**
   * Queue processor'ı durdur
   */
  stop() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
      logger.info('Queue processor stopped', { module: 'queue-processor' });
    }
  }

  /**
   * Kuyruktaki dökümanları işle
   * ALTIN KURAL: ZIP dosyaları asla işlenmez!
   */
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // ZIP dosyalarını kesinlikle hariç tut - ALTIN KURAL
      const queuedResult = await pool.query(
        `SELECT id, tender_id, original_filename, file_path, file_type, 
                source_type, content_type, storage_url
         FROM documents
         WHERE processing_status = 'queued'
           AND file_type NOT IN ('zip', '.zip')
         ORDER BY created_at ASC
         LIMIT $1`,
        [this.maxConcurrent]
      );

      const queuedDocs = queuedResult.rows;
      if (queuedDocs.length === 0) return;

      logger.info('Processing queued documents', {
        module: 'queue-processor',
        count: queuedDocs.length,
      });

      // Paralel işleme
      await Promise.all(queuedDocs.map((doc) => this.processQueuedDocument(doc)));
    } catch (error) {
      logger.error('Queue processing failed', {
        module: 'queue-processor',
        error: error.message,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Tek bir kuyruktaki dökümanı işle
   * @param {Object} doc - Döküman bilgisi
   */
  async processQueuedDocument(doc) {
    const { id, original_filename, file_path, file_type, source_type, storage_url } = doc;

    // ALTIN KURAL: ZIP dosyası kontrolü (güvenlik katmanı)
    if (file_type === 'zip' || file_type === '.zip') {
      logger.warn('ZIP file blocked from processing', {
        module: 'queue-processor',
        documentId: id,
        filename: original_filename,
      });
      await pool.query(
        `UPDATE documents SET processing_status = 'skipped', processed_at = NOW() WHERE id = $1`,
        [id]
      );
      return;
    }

    let tempFilePath = null;

    // file_path lokal dosya mı yoksa storage_path mi kontrol et
    // Lokal dosyalar "/" ile başlar, storage_path "tenders/" ile başlar
    const isLocalFile = file_path && file_path.startsWith('/');
    const needsDownload = !isLocalFile && storage_url;

    logger.info('Document fields', {
      module: 'queue-processor',
      documentId: id,
      file_path: file_path || 'NULL',
      isLocalFile,
      needsDownload,
    });

    try {
      // Status'u processing yap
      await pool.query('UPDATE documents SET processing_status = $1 WHERE id = $2', ['processing', id]);

      let result;
      let actualFilePath = file_path;

      // Supabase'den indirme gerekiyorsa (storage_url varsa ve lokal dosya değilse)
      if (needsDownload) {
        logger.info('Downloading from Supabase', {
          module: 'queue-processor',
          documentId: id,
          url: storage_url.substring(0, 80) + '...',
        });
        tempFilePath = await this.downloadFromStorage(storage_url, original_filename, id);
        actualFilePath = tempFilePath;
        logger.info('File downloaded from storage', {
          module: 'queue-processor',
          documentId: id,
          tempPath: tempFilePath,
        });
      } else if (isLocalFile) {
        logger.info('Using local file_path', {
          module: 'queue-processor',
          documentId: id,
          file_path,
        });
      }

      // Source type'a göre farklı işleme
      if (source_type === 'content') {
        // Content dökümanları için özel işleme (eski yöntem)
        result = await processContentDocument(id);
        await this.saveOldResult(id, result);
      } else if (this.usePipeline && actualFilePath) {
        // Yeni 3 katmanlı pipeline
        result = await this.processWithPipeline(id, actualFilePath);
      } else {
        // Eski yöntem (fallback)
        result = await processDocument(id, actualFilePath, original_filename);
        await this.saveOldResult(id, result);
      }

      logger.info('Document processed', {
        module: 'queue-processor',
        documentId: id,
        method: this.usePipeline ? 'pipeline' : 'legacy',
        fromStorage: !!tempFilePath,
      });
    } catch (error) {
      logger.error('Document processing failed', {
        module: 'queue-processor',
        documentId: id,
        error: error.message,
      });

      await pool.query(
        `UPDATE documents SET processing_status = 'failed', processed_at = NOW() WHERE id = $1`,
        [id]
      );
    } finally {
      // Temp dosyayı temizle
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {}
      }
    }
  }

  /**
   * Supabase storage'dan dosya indir
   * v5.2 - Retry, timeout ve streaming desteği
   */
  async downloadFromStorage(url, filename, docId) {
    const ext = path.extname(filename) || '.tmp';
    const tempPath = path.join(TEMP_DIR, `doc_${docId}_${Date.now()}${ext}`);

    let lastError = null;

    for (let attempt = 1; attempt <= DOWNLOAD_CONFIG.maxRetries; attempt++) {
      try {
        await this._downloadWithTimeout(url, tempPath, docId, attempt);
        return tempPath;
      } catch (error) {
        lastError = error;

        // Dosyayı temizle
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}

        // Son deneme değilse bekle ve tekrar dene
        if (attempt < DOWNLOAD_CONFIG.maxRetries) {
          const delay = DOWNLOAD_CONFIG.retryDelayMs * Math.pow(2, attempt - 1);
          logger.warn('Download failed, retrying...', {
            module: 'queue-processor',
            documentId: docId,
            attempt,
            maxRetries: DOWNLOAD_CONFIG.maxRetries,
            delayMs: delay,
            error: error.message,
          });
          await this._sleep(delay);
        }
      }
    }

    throw new Error(`Download failed after ${DOWNLOAD_CONFIG.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Timeout ve redirect destekli indirme
   */
  _downloadWithTimeout(url, tempPath, docId, attempt = 1) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tempPath);
      let totalBytes = 0;
      let downloadedBytes = 0;
      let redirectCount = 0;
      let timeoutId = null;

      const cleanup = (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        file.close();
        if (error) {
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          reject(error);
        }
      };

      const doRequest = (targetUrl) => {
        if (redirectCount > DOWNLOAD_CONFIG.maxRedirects) {
          cleanup(new Error(`Too many redirects (${redirectCount})`));
          return;
        }

        const protocol = targetUrl.startsWith('https') ? https : http;

        const req = protocol.get(targetUrl, (response) => {
          // Redirect handling
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
            redirectCount++;
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              cleanup(new Error('Redirect without location header'));
              return;
            }
            logger.debug('Following redirect', {
              module: 'queue-processor',
              documentId: docId,
              redirectCount,
              to: redirectUrl.substring(0, 50),
            });
            doRequest(redirectUrl);
            return;
          }

          // Error status codes
          if (response.statusCode !== 200) {
            cleanup(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          // Content-Length varsa al
          totalBytes = parseInt(response.headers['content-length'], 10) || 0;

          // Progress logging for large files
          const shouldLogProgress = totalBytes > DOWNLOAD_CONFIG.progressLogThreshold;

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;

            // Büyük dosyalarda her 20%'de log
            if (shouldLogProgress && totalBytes > 0) {
              const percent = Math.floor((downloadedBytes / totalBytes) * 100);
              if (percent % 20 === 0 && percent > 0) {
                logger.debug('Download progress', {
                  module: 'queue-processor',
                  documentId: docId,
                  percent: `${percent}%`,
                  downloaded: `${(downloadedBytes / 1024 / 1024).toFixed(1)}MB`,
                });
              }
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            if (timeoutId) clearTimeout(timeoutId);
            file.close();

            logger.debug('Download completed', {
              module: 'queue-processor',
              documentId: docId,
              attempt,
              size: `${(downloadedBytes / 1024).toFixed(1)}KB`,
              path: tempPath,
            });

            resolve();
          });

          file.on('error', (err) => cleanup(err));
        });

        req.on('error', (err) => cleanup(err));

        // Timeout
        timeoutId = setTimeout(() => {
          req.destroy();
          cleanup(new Error(`Download timeout (${DOWNLOAD_CONFIG.timeoutMs}ms)`));
        }, DOWNLOAD_CONFIG.timeoutMs);
      };

      doRequest(url);
    });
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Yeni pipeline ile döküman işle
   */
  async processWithPipeline(docId, filePath) {
    const result = await runPipeline(filePath);

    if (!result.success) {
      throw new Error(result.error || 'Pipeline hatası');
    }

    // Sonuçları kaydet
    await pool.query(
      `UPDATE documents SET
        extracted_text = $1,
        analysis_result = $2,
        processing_status = 'completed',
        processed_at = NOW()
      WHERE id = $3`,
      [
        result.extraction?.text || '',
        JSON.stringify({
          pipeline_version: '5.0',
          analysis: result.analysis,
          stats: result.stats,
          chunks: result.chunks?.length || 0,
        }),
        docId,
      ]
    );

    return result;
  }

  /**
   * Eski format sonuçları kaydet
   */
  async saveOldResult(docId, result) {
    if (!result || !result.text || result.text.trim().length === 0) {
      throw new Error('Döküman metni çıkarılamadı veya boş');
    }

    if (!result.analysis || typeof result.analysis !== 'object') {
      await pool.query(
        `UPDATE documents SET
          extracted_text = $1, ocr_result = $2, analysis_result = NULL,
          processing_status = 'completed', processed_at = NOW()
        WHERE id = $3`,
        [result.text, JSON.stringify(result.ocr || null), docId]
      );
    } else {
      await pool.query(
        `UPDATE documents SET
          extracted_text = $1, ocr_result = $2, analysis_result = $3,
          processing_status = 'completed', processed_at = NOW()
        WHERE id = $4`,
        [result.text, JSON.stringify(result.ocr || null), JSON.stringify(result.analysis), docId]
      );
    }
  }

  /**
   * Manuel queue işleme tetikleme
   */
  async triggerManualProcess() {
    if (this.isProcessing) {
      throw new Error('Queue zaten işleniyor');
    }
    await this.processQueue();
    return { success: true, message: 'Queue işleme tamamlandı' };
  }

  /**
   * Pipeline modunu değiştir
   */
  setPipelineMode(enabled) {
    this.usePipeline = enabled;
    logger.info('Pipeline mode changed', {
      module: 'queue-processor',
      usePipeline: enabled,
    });
  }

  /**
   * Queue durumunu getir
   */
  async getQueueStatus() {
    const result = await pool.query(
      `SELECT processing_status, source_type, COUNT(*) as count
       FROM documents
       WHERE processing_status IN ('pending', 'queued', 'processing')
       GROUP BY processing_status, source_type
       ORDER BY processing_status, source_type`
    );

    const stats = { pending: 0, queued: 0, processing: 0, bySourceType: {} };

    result.rows.forEach((row) => {
      stats[row.processing_status] += parseInt(row.count, 10);
      if (!stats.bySourceType[row.source_type]) {
        stats.bySourceType[row.source_type] = {};
      }
      stats.bySourceType[row.source_type][row.processing_status] = parseInt(row.count, 10);
    });

    return {
      ...stats,
      isProcessing: this.isProcessing,
      usePipeline: this.usePipeline,
      totalInQueue: stats.pending + stats.queued + stats.processing,
    };
  }
}

export default new DocumentQueueProcessor();
