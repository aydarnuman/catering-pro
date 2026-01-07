/**
 * Otomatik Senkronizasyon Scheduler
 * Cron job ile periyodik fatura senkronizasyonu
 */

import cron from 'node-cron';
import { query } from '../database.js';
import { faturaService } from '../scraper/uyumsoft/index.js';

class SyncScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.lastSyncTime = null;
    this.syncStats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null
    };
  }

  /**
   * Log kaydet
   */
  async logSync(status, details) {
    try {
      await query(`
        INSERT INTO sync_logs (
          sync_type, 
          status, 
          started_at, 
          finished_at, 
          invoices_synced,
          new_invoices,
          error_message,
          details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        details.syncType || 'auto',
        status,
        details.startedAt,
        new Date(),
        details.invoicesSynced || 0,
        details.newInvoices || 0,
        details.error || null,
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('❌ Sync log kayıt hatası:', error);
    }
  }

  /**
   * Son başarılı sync'i kontrol et
   */
  async getLastSuccessfulSync() {
    try {
      const result = await query(`
        SELECT started_at, invoices_synced, new_invoices
        FROM sync_logs 
        WHERE status = 'success' 
        ORDER BY started_at DESC 
        LIMIT 1
      `);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Son sync kontrolü hatası:', error);
      return null;
    }
  }

  /**
   * Uyumsoft faturalarını senkronize et
   */
  async syncUyumsoftInvoices(options = {}) {
    if (this.isRunning) {
      console.log('⏳ Senkronizasyon zaten çalışıyor, atlanıyor...');
      return { success: false, message: 'Sync already running' };
    }

    // 🔒 AKILLI STARTUP KONTROLÜ
    if (options.syncType === 'startup') {
      const lastSync = await this.getLastSuccessfulSync();
      if (lastSync) {
        const hoursSince = (Date.now() - new Date(lastSync.started_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 1) {
          console.log(`⏭️ Son sync ${Math.round(hoursSince * 60)} dakika önce yapıldı, startup sync atlanıyor`);
          return { success: true, message: 'Recent sync exists, skipped', skipped: true };
        }
        console.log(`📊 Son sync ${hoursSince.toFixed(1)} saat önce, devam ediliyor...`);
      }
    }

    const startTime = new Date();
    this.isRunning = true;
    
    const syncDetails = {
      syncType: options.syncType || 'auto',
      startedAt: startTime,
      invoicesSynced: 0,
      newInvoices: 0,
      duplicates: 0
    };

    console.log(`🔄 [${new Date().toISOString()}] Otomatik senkronizasyon başlıyor...`);
    
    try {
      // Uyumsoft'a bağlan
      if (!faturaService.hasCredentials()) {
        throw new Error('Uyumsoft kimlik bilgileri bulunamadı');
      }

      // Faturaları çek (son 3 ay)
      const result = await faturaService.syncFaturalar({
        months: options.months || 3,
        maxInvoices: options.maxInvoices || 500
      });

      if (!result.success) {
        throw new Error(result.message || 'Senkronizasyon başarısız');
      }

      // Veritabanına kaydet
      let savedCount = 0;
      let newCount = 0;
      let duplicateCount = 0;

      for (const invoice of result.data) {
        try {
          // Duplicate kontrolü
          const existing = await query(
            'SELECT id FROM uyumsoft_invoices WHERE ettn = $1',
            [invoice.documentId]
          );

          if (existing.rows.length > 0) {
            duplicateCount++;
            // Mevcut kaydı güncelle
            await query(`
              UPDATE uyumsoft_invoices 
              SET 
                payable_amount = $1,
                status = $2,
                is_new = $3,
                last_sync_date = NOW(),
                updated_at = NOW()
              WHERE ettn = $4
            `, [
              invoice.payableAmount,
              invoice.status,
              invoice.isNew,
              invoice.documentId
            ]);
          } else {
            // Yeni kayıt
            await query(`
              INSERT INTO uyumsoft_invoices (
                ettn, invoice_id, invoice_no,
                invoice_type, invoice_date, creation_date,
                sender_vkn, sender_name, sender_email,
                taxable_amount, tax_amount, payable_amount, 
                currency, status, is_new, is_seen,
                last_sync_date
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, 
                $10, $11, $12, $13, $14, $15, $16, NOW()
              )
            `, [
              invoice.documentId,
              invoice.invoiceId,
              invoice.invoiceId,
              'incoming',
              invoice.executionDate,
              invoice.createDate,
              invoice.targetVkn,
              invoice.targetTitle,
              invoice.targetEmail,
              invoice.taxExclusiveAmount || 0,
              invoice.taxTotal || 0,
              invoice.payableAmount || 0,
              invoice.currency || 'TRY',
              invoice.status,
              invoice.isNew || false,
              invoice.isSeen || false
            ]);
            newCount++;
          }
          savedCount++;
        } catch (dbError) {
          console.error(`❌ DB kayıt hatası (${invoice.documentId}):`, dbError);
        }
      }

      // İstatistikleri güncelle
      syncDetails.invoicesSynced = savedCount;
      syncDetails.newInvoices = newCount;
      syncDetails.duplicates = duplicateCount;

      // Başarılı sync logu
      await this.logSync('success', syncDetails);
      
      this.syncStats.totalRuns++;
      this.syncStats.successfulRuns++;
      this.lastSyncTime = new Date();

      console.log(`✅ Senkronizasyon tamamlandı:`);
      console.log(`   📊 Toplam: ${savedCount} fatura`);
      console.log(`   ✨ Yeni: ${newCount} fatura`);
      console.log(`   🔄 Güncellenen: ${duplicateCount} fatura`);

      // Yeni fatura bildirimi (ileride webhook veya email gönderilebilir)
      if (newCount > 0) {
        this.sendNotification({
          type: 'new_invoices',
          count: newCount,
          total: savedCount
        });
      }

      return {
        success: true,
        stats: {
          total: savedCount,
          new: newCount,
          updated: duplicateCount
        }
      };

    } catch (error) {
      console.error('❌ Senkronizasyon hatası:', error);
      
      syncDetails.error = error.message;
      await this.logSync('error', syncDetails);
      
      this.syncStats.failedRuns++;
      this.syncStats.lastError = error.message;

      return {
        success: false,
        error: error.message
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Bildirim gönder (ileride genişletilebilir)
   */
  sendNotification(data) {
    console.log(`📬 Bildirim:`, data);
    // TODO: Email, webhook veya push notification gönderilebilir
  }

  /**
   * Cron job'ları başlat
   */
  start() {
    console.log('🚀 Senkronizasyon scheduler başlatılıyor...');

    // Her 6 saatte bir çalışacak
    const everySixHours = cron.schedule('0 */6 * * *', async () => {
      console.log('⏰ 6 saatlik otomatik senkronizasyon tetiklendi');
      await this.syncUyumsoftInvoices({ 
        syncType: 'scheduled_6h',
        months: 1 
      });
    });

    // Her gece yarısı tam senkronizasyon
    const midnight = cron.schedule('0 0 * * *', async () => {
      console.log('🌙 Gece yarısı tam senkronizasyon tetiklendi');
      await this.syncUyumsoftInvoices({ 
        syncType: 'scheduled_midnight',
        months: 3,
        maxInvoices: 1000
      });
    });

    // Her pazartesi haftalık rapor
    const weeklyReport = cron.schedule('0 9 * * 1', async () => {
      console.log('📊 Haftalık rapor hazırlanıyor...');
      await this.generateWeeklyReport();
    });

    this.jobs.set('everySixHours', everySixHours);
    this.jobs.set('midnight', midnight);
    this.jobs.set('weeklyReport', weeklyReport);

    // İlk kontrolü 1 dakika sonra yap
    setTimeout(() => {
      this.syncUyumsoftInvoices({ 
        syncType: 'startup',
        months: 1 
      });
    }, 60000);

    console.log('✅ Scheduler başlatıldı. Cron job\'lar aktif.');
  }

  /**
   * Cron job'ları durdur
   */
  stop() {
    console.log('🛑 Scheduler durduruluyor...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`   ⏹️ ${name} durduruldu`);
    });
    this.jobs.clear();
  }

  /**
   * Manuel senkronizasyon tetikle
   */
  async triggerManualSync(options = {}) {
    console.log('👆 Manuel senkronizasyon tetiklendi');
    return await this.syncUyumsoftInvoices({
      ...options,
      syncType: 'manual'
    });
  }

  /**
   * Haftalık rapor oluştur
   */
  async generateWeeklyReport() {
    try {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Haftalık istatistikler
      const stats = await query(`
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(*) FILTER (WHERE created_at > $1) as new_this_week,
          SUM(payable_amount) as total_amount,
          COUNT(DISTINCT sender_vkn) as unique_vendors
        FROM uyumsoft_invoices
        WHERE invoice_date > $1
      `, [lastWeek]);

      // Kategori bazlı özet
      const categoryStats = await query(`
        SELECT 
          ai_category as category,
          COUNT(*) as count,
          SUM(total_amount) as total
        FROM uyumsoft_invoice_items
        JOIN uyumsoft_invoices ON uyumsoft_invoice_items.uyumsoft_invoice_id = uyumsoft_invoices.id
        WHERE uyumsoft_invoices.invoice_date > $1
        GROUP BY ai_category
        ORDER BY total DESC
      `, [lastWeek]);

      const report = {
        period: {
          start: lastWeek,
          end: new Date()
        },
        stats: stats.rows[0],
        categories: categoryStats.rows,
        generated_at: new Date()
      };

      // Raporu kaydet
      await query(`
        INSERT INTO weekly_reports (
          report_date, 
          report_data, 
          created_at
        ) VALUES ($1, $2, NOW())
      `, [new Date(), JSON.stringify(report)]);

      console.log('✅ Haftalık rapor oluşturuldu:', report);
      
      // Rapor bildirimini gönder
      this.sendNotification({
        type: 'weekly_report',
        data: report
      });

      return report;

    } catch (error) {
      console.error('❌ Haftalık rapor hatası:', error);
      return null;
    }
  }

  /**
   * Scheduler durumunu getir
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      stats: this.syncStats,
      jobs: Array.from(this.jobs.keys()).map(name => ({
        name,
        isRunning: this.jobs.get(name)?.running || false
      }))
    };
  }

  /**
   * Son sync loglarını getir
   */
  async getSyncLogs(limit = 50) {
    try {
      const logs = await query(`
        SELECT * FROM sync_logs 
        ORDER BY started_at DESC 
        LIMIT $1
      `, [limit]);
      
      return logs.rows;
    } catch (error) {
      console.error('❌ Log okuma hatası:', error);
      return [];
    }
  }
}

// Singleton instance
const scheduler = new SyncScheduler();

export default scheduler;
