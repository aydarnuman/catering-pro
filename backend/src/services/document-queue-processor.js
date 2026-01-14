/**
 * Document Queue Processor
 * Kuyruktaki dökümanları otomatik işleme servisi
 */

import { pool } from '../database.js';
import { processDocument, processContentDocument } from './document.js';

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
      console.log('⚠️ Document queue processor zaten çalışıyor');
      return;
    }

    console.log('🚀 Document queue processor başlatılıyor...');
    
    this.scheduler = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processQueue();
      }
    }, this.processInterval);

    console.log(`✅ Document queue processor başlatıldı (${this.processInterval/1000}s interval)`);
  }

  /**
   * Queue processor'ı durdur
   */
  stop() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
      console.log('🛑 Document queue processor durduruldu');
    }
  }

  /**
   * Kuyruktaki dökümanları işle
   */
  async processQueue() {
    if (this.isProcessing) {
      console.log('⏳ Queue zaten işleniyor...');
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

      console.log(`📋 ${queuedDocs.length} döküman kuyruğundan işlenecek`);

      // Her dökümanı sırayla işle
      for (const doc of queuedDocs) {
        await this.processQueuedDocument(doc);
      }

    } catch (error) {
      console.error('❌ Queue işleme hatası:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Tek bir kuyruktaki dökümanı işle
   * @param {Object} doc - Döküman bilgisi
   */
  async processQueuedDocument(doc) {
    const { id, original_filename, file_path, source_type, content_type } = doc;
    
    try {
      console.log(`🔄 Queue'dan işleniyor [${id}]: ${original_filename}`);
      
      // Status'u processing yap
      await pool.query(
        'UPDATE documents SET processing_status = $1 WHERE id = $2',
        ['processing', id]
      );

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
        console.warn(`⚠️ Döküman [${id}] için analiz sonucu eksik veya geçersiz`);
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
          [
            result.text,
            JSON.stringify(result.ocr || null),
            id
          ]
        );
        console.log(`✅ Queue döküman tamamlandı (analiz yok) [${id}]: ${original_filename}`);
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
          [
            result.text,
            JSON.stringify(result.ocr || null),
            JSON.stringify(result.analysis),
            id
          ]
        );
        console.log(`✅ Queue döküman tamamlandı [${id}]: ${original_filename} (${result.text.length} karakter, analiz: ${result.analysis ? 'var' : 'yok'})`);
      }

    } catch (error) {
      console.error(`❌ Queue döküman hatası [${id}]:`, error);
      
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

    console.log('🔧 Manuel queue işleme tetikleniyor...');
    await this.processQueue();
    
    return {
      success: true,
      message: 'Queue işleme tamamlandı'
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
      bySourceType: {}
    };

    result.rows.forEach(row => {
      stats[row.processing_status] += parseInt(row.count);
      
      if (!stats.bySourceType[row.source_type]) {
        stats.bySourceType[row.source_type] = {};
      }
      stats.bySourceType[row.source_type][row.processing_status] = parseInt(row.count);
    });

    return {
      ...stats,
      isProcessing: this.isProcessing,
      totalInQueue: stats.pending + stats.queued + stats.processing
    };
  }
}

export default new DocumentQueueProcessor();