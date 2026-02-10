/**
 * Document Queue Processor
 * v9.0 - UNIFIED PIPELINE (TEK MERKEZİ SİSTEM)
 *
 * Kuyruktaki dökümanları otomatik işleme servisi
 *
 * Pipeline Akışı:
 *   1. Azure Custom Model (ihale-catering-v1)
 *   2. Azure Layout + Claude
 *   3. Claude Zero-Loss (fallback)
 *
 * DİĞER PİPELINE DOSYALARINI KULLANMA!
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { pool } from '../database.js';
import aiConfig from '../config/ai.config.js';
import logger from '../utils/logger.js';

// v9.0: TEK MERKEZİ SİSTEM
import { analyzeDocument } from './ai-analyzer/unified-pipeline.js';

// Download ayarları
const DOWNLOAD_CONFIG = {
  maxRetries: aiConfig.queue.maxRetries || 3,
  retryDelayMs: aiConfig.queue.retryDelay || 1000, // İlk retry bekleme süresi
  timeoutMs: 120000, // 2 dakika timeout
  maxRedirects: 5,
  progressLogThreshold: 5 * 1024 * 1024, // 5MB üzeri dosyalarda progress log
};

// Temp dizini
const TEMP_DIR = path.join(process.cwd(), '../temp-analysis');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class DocumentQueueProcessor extends EventEmitter {
  constructor() {
    super();
    this.isProcessing = false;
    // Config'den oku (artık hardcoded değil)
    this.maxConcurrent = aiConfig.queue.maxConcurrent || 4;
    this.processInterval = aiConfig.queue.processInterval || 10000; // 10 saniye
    this.scheduler = null;
    this.pgClient = null; // LISTEN/NOTIFY için
    this._consecutiveEmptyPolls = 0; // Boş poll sayacı (adaptive interval)
    this._sseClients = new Set(); // SSE bağlı istemciler
  }

  /**
   * SSE client kaydet (frontend progress takibi için)
   * @param {import('express').Response} res - SSE response
   */
  addSSEClient(res) {
    this._sseClients.add(res);
    res.on('close', () => this._sseClients.delete(res));
    
    // Bağlantıda mevcut kuyruk durumunu gönder
    this.getQueueStatus().then((status) => {
      this._sendSSE(res, 'queue_status', status);
    }).catch(() => {});
  }

  /**
   * Tüm SSE istemcilere event gönder
   */
  _broadcastSSE(event, data) {
    for (const client of this._sseClients) {
      this._sendSSE(client, event, data);
    }
  }

  /**
   * Tek bir SSE istemciye event gönder
   */
  _sendSSE(res, event, data) {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this._sseClients.delete(res);
    }
  }

  /**
   * Queue processor'ı başlat
   * LISTEN/NOTIFY ile event-driven + polling fallback
   */
  async start() {
    if (this.scheduler) return;

    logger.info('Queue processor started', {
      module: 'queue-processor',
      pipeline: 'unified-v9.0',
      maxConcurrent: this.maxConcurrent,
      interval: `${this.processInterval / 1000}s`,
      mode: 'listen-notify + polling-fallback',
    });

    // 1. LISTEN/NOTIFY başlat (event-driven - birincil mekanizma)
    await this._startListenNotify();

    // 2. Polling fallback (LISTEN/NOTIFY kaçırırsa diye)
    // Adaptive interval: Boş poll artarsa yavaşla, iş gelince hızlan
    this.scheduler = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processQueue();
      }
    }, this.processInterval);

    // 3. İlk başlatmada mevcut kuyruğu kontrol et
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * PostgreSQL LISTEN/NOTIFY - Yeni doküman kuyruğa eklenince anında tetikle
   */
  async _startListenNotify() {
    try {
      // Ayrı bir connection al (LISTEN için dedicated olmalı)
      this.pgClient = await pool.connect();

      this.pgClient.on('notification', async (msg) => {
        if (msg.channel === 'document_queued') {
          logger.info('NOTIFY received: document_queued', {
            module: 'queue-processor',
            payload: msg.payload,
          });
          this._consecutiveEmptyPolls = 0; // Reset adaptive counter

          // Hemen işle
          if (!this.isProcessing) {
            await this.processQueue();
          }
        }
      });

      this.pgClient.on('error', (err) => {
        logger.error('LISTEN connection error, reconnecting...', {
          module: 'queue-processor',
          error: err.message,
        });
        // Reconnect after delay
        setTimeout(() => this._startListenNotify(), 5000);
      });

      await this.pgClient.query('LISTEN document_queued');
      logger.info('LISTEN/NOTIFY active on channel: document_queued', { module: 'queue-processor' });
    } catch (err) {
      logger.warn('LISTEN/NOTIFY setup failed, polling-only mode', {
        module: 'queue-processor',
        error: err.message,
      });
      // Polling yedek olarak çalışır, kritik değil
    }
  }

  /**
   * Queue processor'ı durdur
   */
  stop() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }

    // LISTEN connection'ı kapat
    if (this.pgClient) {
      try {
        this.pgClient.query('UNLISTEN document_queued').catch(() => {});
        this.pgClient.release();
      } catch {}
      this.pgClient = null;
    }

    logger.info('Queue processor stopped', { module: 'queue-processor' });
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
      await pool.query(`UPDATE documents SET processing_status = 'skipped', processed_at = NOW() WHERE id = $1`, [id]);
      return;
    }

    let tempFilePath = null;

    // file_path lokal dosya mı yoksa storage_path mi kontrol et
    // Lokal dosyalar "/" ile başlar, storage_path "tenders/" ile başlar
    const isLocalFile = file_path?.startsWith('/');
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

      // SSE: İşleme başladı bildirimi
      this._broadcastSSE('document_processing', {
        documentId: id,
        filename: original_filename,
        status: 'processing',
        stage: 'download',
        message: `${original_filename} işleniyor...`,
      });

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

      // v9.0: UNIFIED PIPELINE - Tüm dosyalar aynı yöntemle
      if (source_type === 'content') {
        await this.processContentWithPipeline(id);
      } else if (actualFilePath) {
        await this.processWithPipeline(id, actualFilePath);
      } else {
        throw new Error('Dosya yolu veya content bulunamadı');
      }

      logger.info('Document processed', {
        module: 'queue-processor',
        documentId: id,
        pipeline: 'unified-v9.0',
        fromStorage: !!tempFilePath,
      });

      // SSE: İşleme tamamlandı bildirimi
      this._broadcastSSE('document_complete', {
        documentId: id,
        filename: original_filename,
        status: 'completed',
        message: `${original_filename} analizi tamamlandı`,
      });
    } catch (error) {
      logger.error('Document processing failed', {
        module: 'queue-processor',
        documentId: id,
        error: error.message,
      });

      await pool.query(`UPDATE documents SET processing_status = 'failed', processed_at = NOW() WHERE id = $1`, [id]);

      // SSE: Hata bildirimi
      this._broadcastSSE('document_error', {
        documentId: id,
        filename: original_filename,
        status: 'failed',
        error: error.message,
        message: `${original_filename} analizi başarısız`,
      });
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
   * Retry, timeout ve streaming desteği
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
          const delay = DOWNLOAD_CONFIG.retryDelayMs * 2 ** (attempt - 1);
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
   * v9.1: Content dökümanları için doküman tipine özel analiz
   */
  async processContentWithPipeline(docId) {
    const { chunkText } = await import('./ai-analyzer/pipeline/chunker.js');
    const { analyze } = await import('./ai-analyzer/pipeline/analyzer.js');
    const { detectDocType, getDocTypePrompt } = await import('./ai-analyzer/prompts/doc-type/index.js');
    const { safeJsonParse } = await import('./ai-analyzer/utils/parser.js');
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const { aiConfig } = await import('../config/ai.config.js');

    const docResult = await pool.query(
      'SELECT content_text, content_type, doc_type, filename, original_filename, storage_path FROM documents WHERE id = $1',
      [docId]
    );

    if (docResult.rows.length === 0 || !docResult.rows[0].content_text) {
      throw new Error('Content text bulunamadı');
    }

    const doc = docResult.rows[0];
    const contentText = doc.content_text;

    // v9.1: Doküman tipini tespit et ve özel prompt kullan
    const docType = detectDocType(doc);
    const docTypePrompt = docType ? getDocTypePrompt(docType) : null;

    let analysis;
    let provider = 'claude-text';

    if (docTypePrompt) {
      // Doküman tipine özel tek-geçiş analiz (daha kaliteli)
      logger.info(`Content doc-type detected: ${docType}, using specialized prompt`, {
        module: 'queue-processor',
        documentId: docId,
        docType,
      });

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: aiConfig.claude.defaultModel, // Sonnet - content doc'lar kısa, kalite önemli
        max_tokens: 8192,
        messages: [{ role: 'user', content: docTypePrompt.prompt + contentText }],
      });

      const responseText = response.content[0]?.text || '{}';
      analysis = safeJsonParse(responseText) || {};
      analysis.meta = {
        method: 'doc-type-specialized',
        docType,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      };
      provider = `claude-text-${docType}`;
    } else {
      // Genel analiz (eski yöntem - chunk + merge)
      const chunks = chunkText(contentText);
      analysis = await analyze(chunks);
    }

    await pool.query(
      `UPDATE documents SET extracted_text = $1, analysis_result = $2, processing_status = 'completed', processed_at = NOW() WHERE id = $3`,
      [contentText, JSON.stringify({ pipeline_version: '9.1', provider, ...analysis }), docId]
    );

    return { success: true, analysis, docType };
  }

  /**
   * v9.0: Dosya tabanlı dökümanlar için Unified Pipeline
   * + Analiz versiyonlama desteği
   */
  async processWithPipeline(docId, filePath) {
    const startTime = Date.now();

    logger.info('Starting unified pipeline', { module: 'queue-processor', documentId: docId });

    // v9.0: UNIFIED PIPELINE
    const result = await analyzeDocument(filePath);
    const elapsed = Date.now() - startTime;

    if (!result.success) {
      throw new Error(result.error || 'Pipeline hatası');
    }

    const provider = result.meta?.provider_used || 'unified';
    const analysisPayload = {
      pipeline_version: '9.0',
      provider,
      analysis: result.analysis,
      stats: result.stats,
      validation: result.validation,
    };

    // Versiyonlama: Önceki analizi history'ye kaydet, yeni sonucu yaz
    await pool.query(
      `UPDATE documents SET 
        extracted_text = $1, 
        analysis_result = $2, 
        processing_status = 'completed', 
        processed_at = NOW(),
        analysis_version = COALESCE(analysis_version, 0) + 1,
        analysis_history = COALESCE(analysis_history, '[]'::jsonb) || $3::jsonb
       WHERE id = $4`,
      [
        result.extraction?.text || '',
        JSON.stringify(analysisPayload),
        JSON.stringify({
          version: Date.now(),
          provider,
          timestamp: new Date().toISOString(),
          completeness: result.validation?.completeness_score || 0,
          duration_ms: elapsed,
          pipeline_version: '9.0',
        }),
        docId,
      ]
    );

    logger.info('Pipeline completed', {
      module: 'queue-processor',
      documentId: docId,
      provider,
      elapsed_ms: elapsed,
      completeness: result.validation?.completeness_score,
    });

    return result;
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
      pipeline: 'unified-v9.0',
      totalInQueue: stats.pending + stats.queued + stats.processing,
    };
  }
}

export default new DocumentQueueProcessor();
