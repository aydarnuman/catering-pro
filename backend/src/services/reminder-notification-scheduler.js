/**
 * Reminder Notification Scheduler
 *
 * Otomatik bildirim oluşturan scheduler:
 * 1. Not/Ajanda - due_date'i 3 gün sonra olan notlar için bildirim
 * 2. Çek/Senet - vade_tarihi 3 gün sonra olan bekleyen kayıtlar için bildirim
 * 3. Vadesi geçmiş - Vadesi geçmiş çek/senetler için günlük uyarı
 *
 * Zamanlama: Her gün saat 07:00
 */

import cron from 'node-cron';
import { query } from '../database.js';
import logger from '../utils/logger.js';
import unifiedNotificationService, {
  NotificationSeverity,
  NotificationSource,
  NotificationType,
} from './unified-notification-service.js';

class ReminderNotificationScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      notesProcessed: 0,
      cekSenetProcessed: 0,
      notificationsCreated: 0,
      duplicatesSkipped: 0,
      errors: 0,
    };
  }

  /**
   * Bildirim key'ine göre duplicate kontrolü
   */
  async notificationExists(notificationKey) {
    try {
      const result = await query(
        `SELECT id FROM notifications
         WHERE metadata->>'notification_key' = $1
         LIMIT 1`,
        [notificationKey]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Notification exists check error:', { error: error.message });
      return false;
    }
  }

  /**
   * Not/Ajanda hatırlatıcılarını işle
   * 3 gün sonra vadesi dolacak notlar için bildirim oluştur
   */
  async processNoteReminders() {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const targetDate = threeDaysFromNow.toISOString().split('T')[0];

    logger.info(`Processing note reminders for date: ${targetDate}`);

    try {
      // 3 gün sonra vadesi dolacak notları bul
      const notes = await query(
        `
        SELECT
          n.id,
          n.user_id,
          n.content,
          n.priority,
          n.due_date,
          n.context_type,
          n.context_id
        FROM unified_notes n
        WHERE n.due_date::date = $1::date
          AND n.is_completed = FALSE
          AND n.user_id IS NOT NULL
      `,
        [targetDate]
      );

      let created = 0;
      let skipped = 0;

      for (const note of notes.rows) {
        const notificationKey = `reminder_note_${note.id}_${targetDate}`;

        // Duplicate kontrolü
        if (await this.notificationExists(notificationKey)) {
          skipped++;
          continue;
        }

        // İçerik önizlemesi (ilk 80 karakter)
        const contentPreview = note.content.length > 80 ? note.content.substring(0, 80) + '...' : note.content;

        // Link belirleme (context'e göre)
        let link = '/ayarlar?tab=notlar';
        if (note.context_type === 'tender' && note.context_id) {
          link = `/tracking?ihale=${note.context_id}`;
        } else if (note.context_type === 'customer' && note.context_id) {
          link = `/muhasebe/cariler?id=${note.context_id}`;
        }

        // Bildirim oluştur
        await unifiedNotificationService.createNotification({
          userId: note.user_id,
          title: '📅 Hatırlatıcı: 3 gün kaldı',
          message: contentPreview,
          type:
            note.priority === 'high' || note.priority === 'urgent' ? NotificationType.WARNING : NotificationType.INFO,
          category: 'reminder',
          link,
          severity: note.priority === 'urgent' ? NotificationSeverity.WARNING : NotificationSeverity.INFO,
          source: NotificationSource.SYSTEM,
          metadata: {
            scheduler_type: 'reminder_due',
            source_table: 'unified_notes',
            source_id: note.id,
            due_date: note.due_date,
            notification_key: notificationKey,
            context_type: note.context_type,
            context_id: note.context_id,
            priority: note.priority,
          },
        });

        created++;
      }

      logger.info(`Note reminders: total=${notes.rows.length}, created=${created}, skipped=${skipped}`);
      return { total: notes.rows.length, created, skipped };
    } catch (error) {
      logger.error('Process note reminders error:', { error: error.message });
      return { total: 0, created: 0, skipped: 0, error: error.message };
    }
  }

  /**
   * Çek/Senet vadelerini işle
   * 3 gün sonra vadesi dolacak bekleyen çek/senetler için bildirim
   */
  async processCekSenetReminders() {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const targetDate = threeDaysFromNow.toISOString().split('T')[0];

    logger.info(`Processing cek/senet reminders for date: ${targetDate}`);

    try {
      // 3 gün sonra vadesi dolacak bekleyen çek/senetleri bul
      const items = await query(
        `
        SELECT
          cs.id,
          cs.tip,
          cs.yonu,
          cs.belge_no,
          cs.tutar,
          cs.doviz,
          cs.vade_tarihi,
          cs.kesen_unvan,
          c.unvan as cari_unvan
        FROM cek_senetler cs
        LEFT JOIN cariler c ON c.id = cs.cari_id
        WHERE cs.vade_tarihi = $1::date
          AND cs.durum = 'beklemede'
      `,
        [targetDate]
      );

      let created = 0;
      let skipped = 0;

      for (const item of items.rows) {
        const notificationKey = `cek_senet_${item.id}_${targetDate}`;

        if (await this.notificationExists(notificationKey)) {
          skipped++;
          continue;
        }

        const tipText = item.tip === 'cek' ? 'Çek' : 'Senet';
        const yonuText = item.yonu === 'alinan' ? 'Alınan' : 'Verilen';
        const yonuEmoji = item.yonu === 'alinan' ? '📥' : '📤';

        // Tutar formatla
        const tutar = new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: item.doviz || 'TRY',
        }).format(item.tutar);

        const title = `${yonuEmoji} ${yonuText} ${tipText} - 3 gün kaldı`;
        const message = `${item.belge_no || 'Belge No Yok'} - ${tutar}${item.cari_unvan ? ` (${item.cari_unvan})` : item.kesen_unvan ? ` (${item.kesen_unvan})` : ''}`;

        // Sistem bildirimi (admin'ler görecek)
        await unifiedNotificationService.createNotification({
          userId: null, // Tüm admin'ler görsün
          title,
          message,
          type: NotificationType.WARNING,
          category: 'cek_senet',
          link: '/muhasebe/kasa-banka?tab=cek-senet',
          severity:
            item.yonu === 'verilen'
              ? NotificationSeverity.WARNING // Verilen = ödeme yapılacak
              : NotificationSeverity.INFO,
          source: NotificationSource.SYSTEM,
          metadata: {
            scheduler_type: 'cek_senet_due',
            source_table: 'cek_senetler',
            source_id: item.id,
            due_date: item.vade_tarihi,
            notification_key: notificationKey,
            tip: item.tip,
            yonu: item.yonu,
            tutar: item.tutar,
            doviz: item.doviz || 'TRY',
            belge_no: item.belge_no,
          },
        });

        created++;
      }

      logger.info(`Cek/Senet reminders: total=${items.rows.length}, created=${created}, skipped=${skipped}`);
      return { total: items.rows.length, created, skipped };
    } catch (error) {
      logger.error('Process cek/senet reminders error:', { error: error.message });
      return { total: 0, created: 0, skipped: 0, error: error.message };
    }
  }

  /**
   * Vadesi geçmiş çek/senetleri işle
   * Her gün bir kez uyarı (daily reminder)
   */
  async processOverdueItems() {
    const today = new Date().toISOString().split('T')[0];

    logger.info(`Processing overdue items for date: ${today}`);

    try {
      // Vadesi geçmiş bekleyen çek/senetler
      const overdueItems = await query(`
        SELECT
          cs.id,
          cs.tip,
          cs.yonu,
          cs.belge_no,
          cs.tutar,
          cs.doviz,
          cs.vade_tarihi,
          cs.kesen_unvan,
          c.unvan as cari_unvan,
          CURRENT_DATE - cs.vade_tarihi as days_overdue
        FROM cek_senetler cs
        LEFT JOIN cariler c ON c.id = cs.cari_id
        WHERE cs.vade_tarihi < CURRENT_DATE
          AND cs.durum = 'beklemede'
        ORDER BY cs.vade_tarihi ASC
        LIMIT 50
      `);

      let created = 0;
      let skipped = 0;

      for (const item of overdueItems.rows) {
        // Her gün yeni bildirim (günlük hatırlatma)
        const notificationKey = `cek_senet_overdue_${item.id}_${today}`;

        if (await this.notificationExists(notificationKey)) {
          skipped++;
          continue;
        }

        const tipText = item.tip === 'cek' ? 'Çek' : 'Senet';
        const yonuText = item.yonu === 'alinan' ? 'Alınan' : 'Verilen';

        const tutar = new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: item.doviz || 'TRY',
        }).format(item.tutar);

        await unifiedNotificationService.createNotification({
          userId: null,
          title: `⚠️ VADESİ GEÇMİŞ: ${yonuText} ${tipText}`,
          message: `${item.belge_no || 'Belge No Yok'} - ${tutar} (${item.days_overdue} gün gecikmiş)`,
          type: NotificationType.ERROR,
          category: 'cek_senet',
          link: '/muhasebe/kasa-banka?tab=cek-senet',
          severity: NotificationSeverity.ERROR,
          source: NotificationSource.SYSTEM,
          metadata: {
            scheduler_type: 'cek_senet_overdue',
            source_table: 'cek_senetler',
            source_id: item.id,
            due_date: item.vade_tarihi,
            notification_key: notificationKey,
            days_overdue: item.days_overdue,
            tip: item.tip,
            yonu: item.yonu,
            tutar: item.tutar,
            doviz: item.doviz || 'TRY',
          },
        });

        created++;
      }

      logger.info(`Overdue items: total=${overdueItems.rows.length}, created=${created}, skipped=${skipped}`);
      return { total: overdueItems.rows.length, created, skipped };
    } catch (error) {
      logger.error('Process overdue items error:', { error: error.message });
      return { total: 0, created: 0, skipped: 0, error: error.message };
    }
  }

  /**
   * Tüm hatırlatıcıları işle
   */
  async processReminders() {
    if (this.isRunning) {
      logger.warn('Reminder scheduler already running, skipping...');
      return { success: false, reason: 'already_running' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    logger.info('========== Starting reminder notification scheduler ==========');

    try {
      // 1. Not hatırlatıcıları
      const noteResults = await this.processNoteReminders();
      this.stats.notesProcessed += noteResults.total;
      this.stats.notificationsCreated += noteResults.created;
      this.stats.duplicatesSkipped += noteResults.skipped;

      // 2. Çek/Senet hatırlatıcıları
      const cekSenetResults = await this.processCekSenetReminders();
      this.stats.cekSenetProcessed += cekSenetResults.total;
      this.stats.notificationsCreated += cekSenetResults.created;
      this.stats.duplicatesSkipped += cekSenetResults.skipped;

      // 3. Vadesi geçmiş uyarılar
      const overdueResults = await this.processOverdueItems();
      this.stats.notificationsCreated += overdueResults.created;
      this.stats.duplicatesSkipped += overdueResults.skipped;

      this.stats.totalRuns++;
      this.lastRun = new Date();

      const duration = (Date.now() - startTime) / 1000;
      logger.info(`========== Reminder scheduler completed in ${duration.toFixed(2)}s ==========`);
      logger.info(
        `Summary: notes=${noteResults.created}, cek_senet=${cekSenetResults.created}, overdue=${overdueResults.created}`
      );

      return {
        success: true,
        duration,
        notes: noteResults,
        cekSenet: cekSenetResults,
        overdue: overdueResults,
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('Reminder scheduler error:', { error: error.message, stack: error.stack });
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Scheduler'ı başlat
   */
  start() {
    logger.info('Initializing reminder notification scheduler...');

    // Her gün saat 07:00'de çalış
    const dailyJob = cron.schedule(
      '0 7 * * *',
      async () => {
        logger.info('[CRON] Daily reminder check triggered at 07:00');
        await this.processReminders();
      },
      {
        timezone: 'Europe/Istanbul',
      }
    );
    this.jobs.set('daily_reminders', dailyJob);

    // Sunucu başlangıcında da çalış (30 saniye gecikme ile)
    setTimeout(async () => {
      const shouldRun = this.shouldRunStartup();
      if (shouldRun) {
        logger.info('[STARTUP] Running initial reminder check...');
        await this.processReminders();
      } else {
        logger.info('[STARTUP] Skipping initial run - already ran recently');
      }
    }, 30000);

    logger.info('Reminder scheduler started. Schedule: Daily at 07:00 (Europe/Istanbul)');
  }

  /**
   * Başlangıçta çalıştırılmalı mı kontrolü
   */
  shouldRunStartup() {
    if (!this.lastRun) return true;

    const hoursSinceLastRun = (Date.now() - this.lastRun.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastRun >= 20; // 20 saatten fazla olduysa çalıştır
  }

  /**
   * Scheduler'ı durdur
   */
  stop() {
    logger.info('Stopping reminder scheduler...');
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Durum bilgisi
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      stats: { ...this.stats },
      jobs: Array.from(this.jobs.keys()),
      schedule: {
        daily: '07:00 (Europe/Istanbul)',
      },
    };
  }
}

// Singleton instance
const reminderNotificationScheduler = new ReminderNotificationScheduler();

export default reminderNotificationScheduler;
export { ReminderNotificationScheduler };
