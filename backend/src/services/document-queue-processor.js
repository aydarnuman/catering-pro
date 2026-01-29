/**
 * Document Queue Processor
 * Kuyruktaki dökümanları otomatik işleme servisi
 */

import { pool } from '../database.js';
import { processContentDocument, processDocument } from './document.js';

class DocumentQueueProcessor {
  constructor() {
    this.isProcessing = false;
    this.maxConcurrent = 2; // Aynı anda max 2 döküman işle
    this.processInterval = 30000; // 30 saniye
    this.scheduler = null;
  }

  /**
   * Queue processor'ı başlat
   */
  start() {
    if (this.scheduler) {
      return;
    }

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
    }
  }

  /**
   * Kuyruktaki dökümanları işle
   */
  async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Kuyruktaki dökümanları al
      const queuedResult = await pool.query(
        `SELECT id, tender_id, original_filename, file_path, source_type, content_type
         FROM documents 
         WHERE processing_status = 'queued'
         ORDER BY created_at ASC
         LIMIT $1`,
        [this.maxConcurrent]
      );

      const queuedDocs = queuedResult.rows;

      if (queuedDocs.length === 0) {
        return; // Kuyruk boş
      }

      // Her dökümanı sırayla işle
      for (const doc of queuedDocs) {
        await this.processQueuedDocument(doc);
      }
    } catch (_error) {
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Tek bir kuyruktaki dökümanı işle
   * @param {Object} doc - Döküman bilgisi
   */
  async processQueuedDocument(doc) {
    const { id, original_filename, file_path, source_type } = doc;

    try {
      // Status'u processing yap
      await pool.query('UPDATE documents SET processing_status = $1 WHERE id = $2', ['processing', id]);

      let result;

      // Source type'a göre farklı işleme
      if (source_type === 'content') {
        // Content dökümanları için özel işleme
        result = await processContentDocument(id);
      } else {
        // Dosya tabanlı dökümanlar için normal işleme
        result = await processDocument(id, file_path, original_filename);
      }

      // Sonuçları kontrol et - gerçekten analiz yapıldı mı?
      if (!result || !result.text || result.text.trim().length === 0) {
        throw new Error('Döküman metni çıkarılamadı veya boş');
      }

      if (!result.analysis || typeof result.analysis !== 'object') {
        // Analiz yapılmadıysa bile metin çıkarıldıysa completed yap ama analiz sonucu null olsun
        await pool.query(
          `UPDATE documents 
           SET 
             extracted_text = $1,
             ocr_result = $2,
             analysis_result = NULL,
             processing_status = 'completed',
             processed_at = NOW()
           WHERE id = $3`,
          [result.text, JSON.stringify(result.ocr || null), id]
        );
      } else {
        // Normal kayıt - hem metin hem analiz var
        await pool.query(
          `UPDATE documents 
           SET 
             extracted_text = $1,
             ocr_result = $2,
             analysis_result = $3,
             processing_status = 'completed',
             processed_at = NOW()
           WHERE id = $4`,
          [result.text, JSON.stringify(result.ocr || null), JSON.stringify(result.analysis), id]
        );
      }
    } catch (_error) {
      // Hata durumunda status'u failed yap
      await pool.query(
        `UPDATE documents 
         SET processing_status = 'failed',
             processed_at = NOW()
         WHERE id = $1`,
        [id]
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

    return {
      success: true,
      message: 'Queue işleme tamamlandı',
    };
  }

  /**
   * Queue durumunu getir
   */
  async getQueueStatus() {
    const result = await pool.query(
      `SELECT 
        processing_status,
        source_type,
        COUNT(*) as count
       FROM documents 
       WHERE processing_status IN ('pending', 'queued', 'processing')
       GROUP BY processing_status, source_type
       ORDER BY processing_status, source_type`
    );

    const stats = {
      pending: 0,
      queued: 0,
      processing: 0,
      bySourceType: {},
    };

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
      totalInQueue: stats.pending + stats.queued + stats.processing,
    };
  }
}

export default new DocumentQueueProcessor();
