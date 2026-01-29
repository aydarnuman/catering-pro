/**
 * Otomatik Senkronizasyon Scheduler
 * Cron job ile periyodik fatura senkronizasyonu
 */

import cron from 'node-cron';
import { query } from '../database.js';
import { faturaService } from '../scraper/uyumsoft/index.js';
import logger from '../utils/logger.js';
import { faturaKalemleriClient } from './fatura-kalemleri-client.js';

class SyncScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.lastSyncTime = null;
    this.syncStats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null,
    };
  }

  /**
   * Log kaydet
   */
  async logSync(status, details) {
    try {
      await query(
        `
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
      `,
        [
          details.syncType || 'auto',
          status,
          details.startedAt,
          new Date(),
          details.invoicesSynced || 0,
          details.newInvoices || 0,
          details.error || null,
          JSON.stringify(details),
        ]
      );
    } catch (error) {
      logger.error('Sync log kayıt hatası', { error: error.message });
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
      logger.error('Son sync kontrolü hatası', { error: error.message });
      return null;
    }
  }

  /**
   * Database-level lock ile sync kilidi al
   * Race condition'ı önler (multiple instance/request koruması)
   */
  async acquireSyncLock() {
    try {
      // Advisory lock kullan (PostgreSQL)
      // Lock ID: 12345 (sync işlemi için sabit ID)
      const result = await query('SELECT pg_try_advisory_lock(12345) as acquired');
      return result.rows[0]?.acquired === true;
    } catch (error) {
      logger.error('Lock alma hatası', { error: error.message });
      return false;
    }
  }

  async releaseSyncLock() {
    try {
      await query('SELECT pg_advisory_unlock(12345)');
    } catch (error) {
      logger.error('Lock bırakma hatası', { error: error.message });
    }
  }

  /**
   * Uyumsoft faturalarını senkronize et
   */
  async syncUyumsoftInvoices(options = {}) {
    // İlk önce local flag kontrolü (hızlı return için)
    if (this.isRunning) {
      logger.info('Senkronizasyon zaten çalışıyor (local flag), atlanıyor');
      return { success: false, message: 'Sync already running' };
    }

    // Database-level lock al (race condition koruması)
    const lockAcquired = await this.acquireSyncLock();
    if (!lockAcquired) {
      logger.info('Senkronizasyon zaten çalışıyor (db lock), atlanıyor');
      return { success: false, message: 'Sync already running (db lock)' };
    }

    // 🔒 AKILLI STARTUP KONTROLÜ
    if (options.syncType === 'startup') {
      const lastSync = await this.getLastSuccessfulSync();
      if (lastSync) {
        const hoursSince = (Date.now() - new Date(lastSync.started_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 1) {
          logger.info('Son sync yakın zamanda yapıldı, startup sync atlanıyor', {
            minutesSince: Math.round(hoursSince * 60),
          });
          await this.releaseSyncLock();
          return { success: true, message: 'Recent sync exists, skipped', skipped: true };
        }
        logger.info('Son sync eski, devam ediliyor', { hoursSince: hoursSince.toFixed(1) });
      }
    }

    const startTime = new Date();
    this.isRunning = true;

    const syncDetails = {
      syncType: options.syncType || 'auto',
      startedAt: startTime,
      invoicesSynced: 0,
      newInvoices: 0,
      duplicates: 0,
    };

    logger.info('Otomatik senkronizasyon başlıyor', { syncType: options.syncType });

    try {
      // Uyumsoft'a bağlan
      if (!faturaService.hasCredentials()) {
        throw new Error('Uyumsoft kimlik bilgileri bulunamadı');
      }

      // Faturaları çek (startDate/endDate varsa tarih aralığı, yoksa months)
      const result = await faturaService.syncFaturalar({
        months: options.months || 3,
        maxInvoices: options.maxInvoices || 500,
        ...(options.startDate && options.endDate ? { startDate: options.startDate, endDate: options.endDate } : {}),
      });

      if (!result.success) {
        throw new Error(result.message || 'Senkronizasyon başarısız');
      }

      let data = result.data || [];

      // Kategori filtresi: gönderen (satıcı) adında kategori kelimesi ara
      if (options.category && String(options.category).trim()) {
        const cat = String(options.category).trim().toLowerCase();
        const before = data.length;
        data = data.filter((inv) => (inv.targetTitle || '').toLowerCase().includes(cat));
        if (before !== data.length) {
          logger.info('Kategori filtresi uygulandı', { category: options.category, before, after: data.length });
        }
      }

      // Satıcı filtresi: VKN tam eşleşme veya gönderen adında ara
      if (options.vendorVkn || options.vendorName) {
        const vkn = options.vendorVkn ? String(options.vendorVkn).trim() : '';
        const name = options.vendorName ? String(options.vendorName).trim().toLowerCase() : '';
        const before = data.length;
        data = data.filter((inv) => {
          if (vkn && (inv.targetVkn || '') === vkn) return true;
          if (name && (inv.targetTitle || '').toLowerCase().includes(name)) return true;
          return false;
        });
        if (before !== data.length) {
          logger.info('Satıcı filtresi uygulandı', { before, after: data.length });
        }
      }

      // Veritabanına kaydet - BATCH OPERATION (N+1 sorunu çözümü)
      let savedCount = 0;
      let newCount = 0;
      let duplicateCount = 0;

      // 1. Önce tüm mevcut ETTN'leri tek sorguda al
      const ettnList = data.map((inv) => inv.documentId);
      const existingResult = await query('SELECT ettn FROM uyumsoft_invoices WHERE ettn = ANY($1)', [ettnList]);
      const existingEttns = new Set(existingResult.rows.map((r) => r.ettn));

      // 2. Yeni ve mevcut faturaları ayır
      const newInvoices = [];
      const existingInvoices = [];

      for (const invoice of data) {
        if (existingEttns.has(invoice.documentId)) {
          existingInvoices.push(invoice);
        } else {
          newInvoices.push(invoice);
        }
      }

      // 3. Yeni faturaları BATCH INSERT ile ekle
      if (newInvoices.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < newInvoices.length; i += BATCH_SIZE) {
          const batch = newInvoices.slice(i, i + BATCH_SIZE);

          // Dinamik VALUES oluştur
          const values = [];
          const params = [];
          let paramIndex = 1;

          for (const invoice of batch) {
            values.push(
              `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, NOW())`
            );
            params.push(
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
            );
          }

          try {
            await query(
              `
              INSERT INTO uyumsoft_invoices (
                ettn, invoice_id, invoice_no,
                invoice_type, invoice_date, creation_date,
                sender_vkn, sender_name, sender_email,
                taxable_amount, tax_amount, payable_amount,
                currency, status, is_new, is_seen,
                last_sync_date
              ) VALUES ${values.join(', ')}
              ON CONFLICT (ettn) DO NOTHING
            `,
              params
            );

            newCount += batch.length;
            savedCount += batch.length;
          } catch (dbError) {
            logger.error('Batch INSERT hatası', { error: dbError.message, batchSize: batch.length });
            // Fallback: tek tek dene
            for (const invoice of batch) {
              try {
                await query(
                  `
                  INSERT INTO uyumsoft_invoices (
                    ettn, invoice_id, invoice_no,
                    invoice_type, invoice_date, creation_date,
                    sender_vkn, sender_name, sender_email,
                    taxable_amount, tax_amount, payable_amount,
                    currency, status, is_new, is_seen,
                    last_sync_date
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
                  ON CONFLICT (ettn) DO NOTHING
                `,
                  [
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
                    invoice.isSeen || false,
                  ]
                );
                newCount++;
                savedCount++;
              } catch (singleError) {
                logger.error('Tekil INSERT hatası', { ettn: invoice.documentId, error: singleError.message });
              }
            }
          }
        }
      }

      // 4. Mevcut faturaları BATCH UPDATE ile güncelle
      if (existingInvoices.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < existingInvoices.length; i += BATCH_SIZE) {
          const batch = existingInvoices.slice(i, i + BATCH_SIZE);

          // Her batch için ayrı UPDATE (PostgreSQL unnest ile toplu güncelleme)
          try {
            // Temporary values array oluştur
            const updateValues = batch
              .map(
                (inv) => `(
              '${inv.documentId}'::text,
              '${(inv.invoiceId || inv.documentId).replace(/'/g, "''")}'::text,
              ${inv.executionDate ? `'${inv.executionDate}'::timestamp` : 'NULL'},
              ${inv.createDate ? `'${inv.createDate}'::timestamp` : 'NULL'},
              '${(inv.targetVkn || '').replace(/'/g, "''")}'::text,
              '${(inv.targetTitle || '').replace(/'/g, "''")}'::text,
              '${(inv.targetEmail || '').replace(/'/g, "''")}'::text,
              ${inv.taxExclusiveAmount ?? 0}::numeric,
              ${inv.taxTotal ?? 0}::numeric,
              ${inv.payableAmount ?? 0}::numeric,
              '${inv.currency || 'TRY'}'::text,
              '${(inv.status || '').replace(/'/g, "''")}'::text,
              ${inv.isNew ?? false}::boolean,
              ${inv.isSeen ?? false}::boolean
            )`
              )
              .join(',');

            await query(`
              UPDATE uyumsoft_invoices AS u SET
                invoice_no = COALESCE(v.invoice_no, u.invoice_no),
                invoice_date = COALESCE(v.invoice_date, u.invoice_date),
                creation_date = COALESCE(v.creation_date, u.creation_date),
                sender_vkn = COALESCE(v.sender_vkn, u.sender_vkn),
                sender_name = COALESCE(v.sender_name, u.sender_name),
                sender_email = COALESCE(v.sender_email, u.sender_email),
                taxable_amount = COALESCE(v.taxable_amount, u.taxable_amount),
                tax_amount = COALESCE(v.tax_amount, u.tax_amount),
                payable_amount = COALESCE(v.payable_amount, u.payable_amount),
                currency = COALESCE(v.currency, u.currency),
                status = COALESCE(v.status, u.status),
                is_new = v.is_new,
                is_seen = v.is_seen,
                last_sync_date = NOW(),
                updated_at = NOW()
              FROM (VALUES ${updateValues}) AS v(
                ettn, invoice_no, invoice_date, creation_date,
                sender_vkn, sender_name, sender_email,
                taxable_amount, tax_amount, payable_amount,
                currency, status, is_new, is_seen
              )
              WHERE u.ettn = v.ettn
            `);

            duplicateCount += batch.length;
            savedCount += batch.length;
          } catch (dbError) {
            logger.error('Batch UPDATE hatası', { error: dbError.message, batchSize: batch.length });
            // Fallback: tek tek güncelle
            for (const invoice of batch) {
              try {
                await query(
                  `
                  UPDATE uyumsoft_invoices
                  SET
                    invoice_no = COALESCE($1, invoice_no),
                    invoice_date = COALESCE($2, invoice_date),
                    creation_date = COALESCE($3, creation_date),
                    sender_vkn = COALESCE($4, sender_vkn),
                    sender_name = COALESCE($5, sender_name),
                    sender_email = COALESCE($6, sender_email),
                    taxable_amount = COALESCE($7, taxable_amount),
                    tax_amount = COALESCE($8, tax_amount),
                    payable_amount = COALESCE($9, payable_amount),
                    currency = COALESCE($10, currency),
                    status = COALESCE($11, status),
                    is_new = $12,
                    is_seen = $13,
                    last_sync_date = NOW(),
                    updated_at = NOW()
                  WHERE ettn = $14
                `,
                  [
                    invoice.invoiceId || invoice.documentId,
                    invoice.executionDate,
                    invoice.createDate,
                    invoice.targetVkn,
                    invoice.targetTitle,
                    invoice.targetEmail,
                    invoice.taxExclusiveAmount ?? 0,
                    invoice.taxTotal ?? 0,
                    invoice.payableAmount ?? 0,
                    invoice.currency || 'TRY',
                    invoice.status,
                    invoice.isNew ?? false,
                    invoice.isSeen ?? false,
                    invoice.documentId,
                  ]
                );
                duplicateCount++;
                savedCount++;
              } catch (singleError) {
                logger.error('Tekil UPDATE hatası', { ettn: invoice.documentId, error: singleError.message });
              }
            }
          }
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

      logger.info('Senkronizasyon tamamlandı', {
        total: savedCount,
        new: newCount,
        updated: duplicateCount,
      });

      // Yeni fatura bildirimi (ileride webhook veya email gönderilebilir)
      if (newCount > 0) {
        this.sendNotification({
          type: 'new_invoices',
          count: newCount,
          total: savedCount,
        });
      }

      return {
        success: true,
        stats: {
          total: savedCount,
          new: newCount,
          updated: duplicateCount,
        },
      };
    } catch (error) {
      logger.error('Senkronizasyon hatası', { error: error.message, stack: error.stack });

      syncDetails.error = error.message;
      await this.logSync('error', syncDetails);

      this.syncStats.failedRuns++;
      this.syncStats.lastError = error.message;

      return {
        success: false,
        error: error.message,
      };
    } finally {
      this.isRunning = false;
      // Database lock'u her zaman serbest bırak
      await this.releaseSyncLock();
    }
  }

  /**
   * Bildirim gönder (ileride genişletilebilir)
   */
  sendNotification(data) {
    logger.info('Bildirim gönderildi', data);
    // TODO: Email, webhook veya push notification gönderilebilir
  }

  /**
   * Cron job'ları başlat
   */
  start() {
    logger.info('Senkronizasyon scheduler başlatılıyor');

    // Her 6 saatte bir çalışacak
    const everySixHours = cron.schedule('0 */6 * * *', async () => {
      logger.info('6 saatlik otomatik senkronizasyon tetiklendi');
      await this.syncUyumsoftInvoices({
        syncType: 'scheduled_6h',
        months: 1,
      });
    });

    // Her gece yarısı tam senkronizasyon
    const midnight = cron.schedule('0 0 * * *', async () => {
      logger.info('Gece yarısı tam senkronizasyon tetiklendi');
      await this.syncUyumsoftInvoices({
        syncType: 'scheduled_midnight',
        months: 3,
        maxInvoices: 1000,
      });
    });

    // Her pazartesi haftalık rapor
    const weeklyReport = cron.schedule('0 9 * * 1', async () => {
      logger.info('Haftalık rapor hazırlanıyor');
      await this.generateWeeklyReport();
    });

    this.jobs.set('everySixHours', everySixHours);
    this.jobs.set('midnight', midnight);
    this.jobs.set('weeklyReport', weeklyReport);

    // İlk kontrolü 1 dakika sonra yap
    setTimeout(() => {
      this.syncUyumsoftInvoices({
        syncType: 'startup',
        months: 1,
      });
    }, 60000);

    logger.info('Scheduler başlatıldı, cron joblar aktif');
  }

  /**
   * Cron job'ları durdur
   */
  stop() {
    logger.info('Scheduler durduruluyor');
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info('Cron job durduruldu', { name });
    });
    this.jobs.clear();
  }

  /**
   * Manuel senkronizasyon tetikle
   */
  async triggerManualSync(options = {}) {
    logger.info('Manuel senkronizasyon tetiklendi', options);
    return await this.syncUyumsoftInvoices({
      ...options,
      syncType: 'manual',
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
      const stats = await query(
        `
        SELECT
          COUNT(*) as total_invoices,
          COUNT(*) FILTER (WHERE created_at > $1) as new_this_week,
          SUM(payable_amount) as total_amount,
          COUNT(DISTINCT sender_vkn) as unique_vendors
        FROM uyumsoft_invoices
        WHERE invoice_date > $1
      `,
        [lastWeek]
      );

      // Kategori bazlı özet (tek kaynak: faturaKalemleriClient)
      const lastWeekStr = lastWeek.toISOString().slice(0, 10);
      const categoryStats = await faturaKalemleriClient.getKategoriHarcamaHaftalik(lastWeekStr);

      const report = {
        period: {
          start: lastWeek,
          end: new Date(),
        },
        stats: stats.rows[0],
        categories: categoryStats,
        generated_at: new Date(),
      };

      // Raporu kaydet
      await query(
        `
        INSERT INTO weekly_reports (
          report_date,
          report_data,
          created_at
        ) VALUES ($1, $2, NOW())
      `,
        [new Date(), JSON.stringify(report)]
      );

      logger.info('Haftalık rapor oluşturuldu', {
        totalInvoices: report.stats.total_invoices,
        totalAmount: report.stats.total_amount,
      });

      // Rapor bildirimini gönder
      this.sendNotification({
        type: 'weekly_report',
        data: report,
      });

      return report;
    } catch (error) {
      logger.error('Haftalık rapor hatası', { error: error.message });
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
      jobs: Array.from(this.jobs.keys()).map((name) => ({
        name,
        isRunning: this.jobs.get(name)?.running || false,
      })),
    };
  }

  /**
   * Son sync loglarını getir
   */
  async getSyncLogs(limit = 50) {
    try {
      const logs = await query(
        `
        SELECT * FROM sync_logs
        ORDER BY started_at DESC
        LIMIT $1
      `,
        [limit]
      );

      return logs.rows;
    } catch (error) {
      logger.error('Log okuma hatası', { error: error.message });
      return [];
    }
  }
}

// Singleton instance
const scheduler = new SyncScheduler();

export default scheduler;
