/**
 * ============================================================================
 * İHALE SCRAPER SCHEDULER
 * ============================================================================
 *
 * Otomatik ihale güncelleme servisi.
 * runner.js'i kullanarak liste ve döküman scraping işlemlerini yönetir.
 *
 * SCHEDULE:
 * ---------
 * ☀️ 08:00 → Liste tarama (5 sayfa)
 * 🌤️ 14:00 → Liste tarama (3 sayfa)
 * 🌙 19:00 → Liste tarama (2 sayfa)
 * 📄 09:00 → Döküman işleme (eksik dökümanlar)
 * 📄 15:00 → Döküman işleme (eksik dökümanlar)
 * 🧹 03:00 → Temizlik (eski job'lar ve loglar)
 *
 * KULLANIM:
 * ---------
 * import tenderScheduler from './tender-scheduler.js';
 *
 * // Başlat
 * tenderScheduler.start();
 *
 * // Manuel tetikle
 * await tenderScheduler.runListScrape({ pages: 3 });
 * await tenderScheduler.runDocsScrape({ limit: 50 });
 *
 * // Durumu al
 * const status = tenderScheduler.getStatus();
 *
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cron from 'node-cron';
import { query } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Runner.js yolu
const RUNNER_PATH = path.join(__dirname, '../scraper/ihale-tarama/ihale-tarama-cli.js');

class TenderScheduler {
  constructor() {
    this.jobs = new Map();
    this.isListRunning = false;
    this.isDocsRunning = false;
    this.lastListScrape = null;
    this.lastDocsScrape = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null,
      lastNewTenders: 0,
    };
  }

  // ==========================================================================
  // RUNNER ÇALIŞTIRMA
  // ==========================================================================

  /**
   * Runner.js'i belirtilen modda çalıştır
   * @param {string} mode - list, docs, full, retry, cleanup
   * @param {Object} options - Ek parametreler
   */
  async runRunner(mode, options = {}) {
    const {
      pages = 3,
      limit = 100,
      priority = 5,
      days = 7,
      type = 'auto',
      timeout = 10 * 60 * 1000, // 10 dakika
    } = options;

    // Concurrent kontrolü
    if (mode === 'list' || mode === 'full') {
      if (this.isListRunning) {
        return { success: false, reason: 'already_running' };
      }
      this.isListRunning = true;
    }

    if (mode === 'docs') {
      if (this.isDocsRunning) {
        return { success: false, reason: 'already_running' };
      }
      this.isDocsRunning = true;
    }

    const startTime = new Date();

    // CLI argümanları oluştur
    const args = [`--mode=${mode}`];

    if (mode === 'list' || mode === 'full') {
      args.push(`--pages=${pages}`);
    }
    if (mode === 'docs' || mode === 'retry') {
      args.push(`--limit=${limit}`);
      args.push(`--priority=${priority}`);
    }
    if (mode === 'cleanup') {
      args.push(`--days=${days}`);
    }

    return new Promise((resolve) => {
      const child = spawn('node', [RUNNER_PATH, ...args], {
        cwd: path.dirname(RUNNER_PATH),
        env: { ...process.env },
      });

      let _output = '';
      let errorOutput = '';
      const stats = {
        tendersFound: 0,
        tendersNew: 0,
        tendersUpdated: 0,
        docsProcessed: 0,
        docsErrors: 0,
      };

      // Stdout parse
      child.stdout.on('data', (data) => {
        const text = data.toString();
        _output += text;

        // Log to console with prefix
        text
          .split('\n')
          .filter((l) => l.trim())
          .forEach((_line) => {});

        // İstatistikleri parse et
        this.parseOutput(text, stats);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
      });

      child.on('close', async (code) => {
        const duration = (Date.now() - startTime) / 1000;

        // Running flag'leri temizle
        if (mode === 'list' || mode === 'full') {
          this.isListRunning = false;
          this.lastListScrape = new Date();
        }
        if (mode === 'docs') {
          this.isDocsRunning = false;
          this.lastDocsScrape = new Date();
        }

        if (code === 0) {
          // Başarılı
          await this.logScrape('success', {
            mode,
            type,
            startedAt: startTime,
            finishedAt: new Date(),
            duration,
            ...stats,
          });

          this.stats.totalRuns++;
          this.stats.successfulRuns++;
          this.stats.lastNewTenders = stats.tendersNew;

          // Yeni ihale bildirimi
          if (stats.tendersNew > 0) {
            this.sendNotification({
              type: 'new_tenders',
              count: stats.tendersNew,
              total: stats.tendersFound,
            });
          }

          resolve({
            success: true,
            code,
            duration,
            stats,
          });
        } else if (code === 2) {
          resolve({
            success: false,
            code,
            reason: 'circuit_breaker_open',
          });
        } else {
          // Hata
          const error = errorOutput || `Process exited with code ${code}`;

          await this.logScrape('error', {
            mode,
            type,
            startedAt: startTime,
            finishedAt: new Date(),
            duration,
            error,
          });

          this.stats.failedRuns++;
          this.stats.lastError = error;

          resolve({
            success: false,
            code,
            error,
          });
        }
      });

      // Timeout
      const timeoutId = setTimeout(() => {
        if (child.killed) return;
        child.kill('SIGTERM');

        if (mode === 'list' || mode === 'full') this.isListRunning = false;
        if (mode === 'docs') this.isDocsRunning = false;

        resolve({
          success: false,
          error: `Timeout after ${timeout / 1000} seconds`,
        });
      }, timeout);

      child.on('close', () => clearTimeout(timeoutId));
    });
  }

  /**
   * Output'tan istatistikleri parse et
   */
  parseOutput(text, stats) {
    // Liste istatistikleri
    const foundMatch = text.match(/Toplam:?\s*(\d+)/i);
    if (foundMatch) stats.tendersFound = parseInt(foundMatch[1], 10);

    const newMatch = text.match(/Yeni:?\s*(\d+)/i);
    if (newMatch) stats.tendersNew = parseInt(newMatch[1], 10);

    const updatedMatch = text.match(/Güncelle[nm]en:?\s*(\d+)/i);
    if (updatedMatch) stats.tendersUpdated = parseInt(updatedMatch[1], 10);

    // Döküman istatistikleri
    const processedMatch = text.match(/İşlenen:?\s*(\d+)/i);
    if (processedMatch) stats.docsProcessed = parseInt(processedMatch[1], 10);

    const errorMatch = text.match(/Hata:?\s*(\d+)/i);
    if (errorMatch) stats.docsErrors = parseInt(errorMatch[1], 10);
  }

  // ==========================================================================
  // KISA YOL FONKSİYONLARI
  // ==========================================================================

  /**
   * Liste scraping çalıştır
   */
  async runListScrape(options = {}) {
    return this.runRunner('list', {
      ...options,
      type: options.type || 'manual_list',
    });
  }

  /**
   * Döküman scraping çalıştır
   */
  async runDocsScrape(options = {}) {
    return this.runRunner('docs', {
      ...options,
      type: options.type || 'manual_docs',
    });
  }

  /**
   * Tam scraping (liste + döküman)
   */
  async runFullScrape(options = {}) {
    return this.runRunner('full', {
      ...options,
      type: options.type || 'manual_full',
    });
  }

  /**
   * Başarısız job'ları tekrar dene
   */
  async runRetry(options = {}) {
    return this.runRunner('retry', {
      ...options,
      type: options.type || 'manual_retry',
    });
  }

  // ==========================================================================
  // CRON SCHEDULE
  // ==========================================================================

  /**
   * Tüm cron job'ları başlat
   */
  start() {
    // ========== LİSTE TARAMA ==========

    // Sabah 08:00 - Ana güncelleme (5 sayfa)
    const listMorning = cron.schedule('0 8 * * *', async () => {
      await this.runRunner('list', { pages: 5, type: 'scheduled_morning' });
    });
    this.jobs.set('list_morning', listMorning);

    // Öğlen 14:00 - Ara güncelleme (3 sayfa)
    const listAfternoon = cron.schedule('0 14 * * *', async () => {
      await this.runRunner('list', { pages: 3, type: 'scheduled_afternoon' });
    });
    this.jobs.set('list_afternoon', listAfternoon);

    // Akşam 19:00 - Son güncelleme (2 sayfa)
    const listEvening = cron.schedule('0 19 * * *', async () => {
      await this.runRunner('list', { pages: 2, type: 'scheduled_evening' });
    });
    this.jobs.set('list_evening', listEvening);

    // ========== DÖKÜMAN İŞLEME ==========

    // Sabah 09:00 - Döküman işleme (liste taramasından 1 saat sonra)
    const docsMorning = cron.schedule('0 9 * * *', async () => {
      await this.runRunner('docs', { limit: 100, type: 'scheduled_docs_morning' });
    });
    this.jobs.set('docs_morning', docsMorning);

    // Öğleden sonra 15:00 - Döküman işleme
    const docsAfternoon = cron.schedule('0 15 * * *', async () => {
      await this.runRunner('docs', { limit: 50, type: 'scheduled_docs_afternoon' });
    });
    this.jobs.set('docs_afternoon', docsAfternoon);

    // ========== BAKIM ==========

    // Gece 03:00 - Temizlik işlemleri
    const cleanup = cron.schedule('0 3 * * *', async () => {
      await this.runRunner('cleanup', { days: 7, type: 'scheduled_cleanup' });
    });
    this.jobs.set('cleanup', cleanup);

    // ========== HITL AUTO-RETRAIN ==========

    // Gece 02:00 - Düzeltme eşik kontrolü ve otomatik eğitim tetikleme
    const retrainCheck = cron.schedule('0 2 * * *', async () => {
      try {
        const { scheduledRetrainCheck } = await import('./auto-retrain.js');
        await scheduledRetrainCheck();
      } catch (_err) {}
    });
    this.jobs.set('retrain_check', retrainCheck);

    // ========== STARTUP ==========

    // Sunucu başladığında 30 saniye bekle, sonra kontrol et
    setTimeout(async () => {
      const shouldRun = await this.shouldRunStartupScrape();
      if (shouldRun) {
        await this.runRunner('list', { pages: 2, type: 'startup' });
      }
    }, 30000);
  }

  /**
   * Startup scrape gerekli mi kontrol et
   */
  async shouldRunStartupScrape() {
    try {
      const lastScrape = await this.getLastSuccessfulScrape();
      if (!lastScrape) return true;

      const hoursSince = (Date.now() - new Date(lastScrape.started_at).getTime()) / (1000 * 60 * 60);

      if (hoursSince < 4) {
        return false;
      }
      return true;
    } catch (_error) {
      return true; // Hata durumunda çalıştır
    }
  }

  /**
   * Tüm cron job'ları durdur
   */
  stop() {
    this.jobs.forEach((job, _name) => {
      job.stop();
    });
    this.jobs.clear();
  }

  // ==========================================================================
  // YARDIMCI FONKSİYONLAR
  // ==========================================================================

  /**
   * Log kaydet
   * Not: Hem eski hem yeni şema ile uyumlu
   */
  async logScrape(status, details) {
    try {
      // Önce yeni şemayı dene (level, module, message, context)
      const level = status === 'error' ? 'ERROR' : status === 'success' ? 'INFO' : 'WARN';
      const module = details.mode ? `scheduler:${details.mode}` : 'scheduler';
      const message = details.error || `${details.mode || 'scrape'} ${status === 'success' ? 'completed' : 'failed'}`;
      const context = {
        status,
        mode: details.mode,
        type: details.type,
        startedAt: details.startedAt,
        finishedAt: details.finishedAt,
        duration: details.duration,
        tendersFound: details.tendersFound || 0,
        tendersNew: details.tendersNew || 0,
        tendersUpdated: details.tendersUpdated || 0,
        pages: details.pages || 0,
        error: details.error,
      };

      try {
        // Yeni şema
        await query(
          `
          INSERT INTO scraper_logs (
            level, 
            module, 
            message, 
            context
          ) VALUES ($1, $2, $3, $4)
        `,
          [level, module, message, JSON.stringify(context)]
        );
      } catch (newSchemaError) {
        // Yeni şema başarısız olduysa, eski şemayı dene
        if (newSchemaError.message.includes('column') || newSchemaError.code === '42703') {
          await query(
            `
            INSERT INTO scraper_logs (
              action, 
              status, 
              message, 
              metadata,
              started_at,
              finished_at,
              tenders_found,
              tenders_new,
              tenders_updated,
              pages_scraped
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
            [
              `${details.mode}_scrape`,
              status,
              details.error || `${details.mode} completed`,
              JSON.stringify(context),
              details.startedAt || new Date(),
              details.finishedAt || new Date(),
              details.tendersFound || 0,
              details.tendersNew || 0,
              details.tendersUpdated || 0,
              details.pages || 0,
            ]
          );
        } else {
          throw newSchemaError;
        }
      }
    } catch (_error) {}
  }

  /**
   * Son başarılı scrape'i getir
   * Not: Hem eski hem yeni şema ile uyumlu
   */
  async getLastSuccessfulScrape() {
    try {
      // Önce yeni şemayı dene
      try {
        const result = await query(`
          SELECT 
            created_at as started_at, 
            context->>'tendersFound' as tenders_found, 
            context->>'tendersNew' as tenders_new, 
            module as action
          FROM scraper_logs 
          WHERE level = 'INFO' AND context->>'status' = 'success'
          ORDER BY created_at DESC 
          LIMIT 1
        `);
        if (result.rows.length > 0) {
          return result.rows[0];
        }
      } catch (_e) {
        // Yeni şema yok, eski şemayı dene
      }

      // Eski şema
      const result = await query(`
        SELECT started_at, tenders_found, tenders_new, action
        FROM scraper_logs 
        WHERE status = 'success' 
        ORDER BY started_at DESC 
        LIMIT 1
      `);
      return result.rows[0] || null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Bildirim gönder
   */
  sendNotification(_data) {
    // TODO: Email, webhook veya push notification eklenebilir
  }

  /**
   * Scheduler durumunu getir
   */
  getStatus() {
    return {
      isListRunning: this.isListRunning,
      isDocsRunning: this.isDocsRunning,
      lastListScrape: this.lastListScrape,
      lastDocsScrape: this.lastDocsScrape,
      stats: this.stats,
      jobs: Array.from(this.jobs.keys()).map((name) => ({
        name,
        isRunning: this.jobs.get(name)?.running || false,
      })),
      schedule: {
        list: ['08:00', '14:00', '19:00'],
        docs: ['09:00', '15:00'],
        cleanup: ['03:00'],
        retrain_check: ['02:00'],
      },
    };
  }

  /**
   * Son scrape loglarını getir
   */
  async getScrapeLogs(limit = 50) {
    try {
      const result = await query(
        `
        SELECT * FROM scraper_logs 
        ORDER BY created_at DESC 
        LIMIT $1
      `,
        [limit]
      );
      return result.rows;
    } catch (_error) {
      return [];
    }
  }

  /**
   * İhale istatistikleri
   */
  async getTenderStats() {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_tenders,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as this_month,
          COUNT(DISTINCT city) as unique_cities,
          COUNT(*) FILTER (WHERE document_links IS NOT NULL AND document_links != '{}'::jsonb) as with_documents,
          COUNT(*) FILTER (WHERE document_links IS NULL OR document_links = '{}'::jsonb) as without_documents
        FROM tenders
        WHERE status = 'active'
      `);

      const topCities = await query(`
        SELECT city, COUNT(*) as count
        FROM tenders
        WHERE status = 'active' AND city IS NOT NULL
        GROUP BY city
        ORDER BY count DESC
        LIMIT 5
      `);

      return {
        ...stats.rows[0],
        topCities: topCities.rows,
      };
    } catch (_error) {
      return null;
    }
  }
}

// Singleton instance
const tenderScheduler = new TenderScheduler();

export default tenderScheduler;
