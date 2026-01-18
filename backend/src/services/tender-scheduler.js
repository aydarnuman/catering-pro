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

import cron from 'node-cron';
import { query } from '../database.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Runner.js yolu
const RUNNER_PATH = path.join(__dirname, '../scraper/runner.js');

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
      lastNewTenders: 0
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
      timeout = 10 * 60 * 1000 // 10 dakika
    } = options;

    // Concurrent kontrolü
    if (mode === 'list' || mode === 'full') {
      if (this.isListRunning) {
        console.log('⏳ Liste scraper zaten çalışıyor, atlanıyor...');
        return { success: false, reason: 'already_running' };
      }
      this.isListRunning = true;
    }

    if (mode === 'docs') {
      if (this.isDocsRunning) {
        console.log('⏳ Döküman scraper zaten çalışıyor, atlanıyor...');
        return { success: false, reason: 'already_running' };
      }
      this.isDocsRunning = true;
    }

    const startTime = new Date();
    console.log(`🚀 [${startTime.toISOString()}] Runner başlatılıyor: --mode=${mode}`);

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
        env: { ...process.env }
      });

      let output = '';
      let errorOutput = '';
      let stats = {
        tendersFound: 0,
        tendersNew: 0,
        tendersUpdated: 0,
        docsProcessed: 0,
        docsErrors: 0
      };

      // Stdout parse
      child.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Log to console with prefix
        text.split('\n').filter(l => l.trim()).forEach(line => {
          console.log(`   ${line}`);
        });
        
        // İstatistikleri parse et
        this.parseOutput(text, stats);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.error(`   ⚠️ ${text.trim()}`);
      });

      child.on('close', async (code) => {
        const duration = (new Date() - startTime) / 1000;
        
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
            ...stats
          });

          this.stats.totalRuns++;
          this.stats.successfulRuns++;
          this.stats.lastNewTenders = stats.tendersNew;

          console.log(`✅ Runner tamamlandı: ${mode} (${duration.toFixed(1)}s)`);
          
          // Yeni ihale bildirimi
          if (stats.tendersNew > 0) {
            this.sendNotification({
              type: 'new_tenders',
              count: stats.tendersNew,
              total: stats.tendersFound
            });
          }

          resolve({
            success: true,
            code,
            duration,
            stats
          });

        } else if (code === 2) {
          // Circuit breaker aktif
          console.log(`⏸️ Runner bekleme modunda (circuit breaker)`);
          
          resolve({
            success: false,
            code,
            reason: 'circuit_breaker_open'
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
            error
          });

          this.stats.failedRuns++;
          this.stats.lastError = error;

          console.error(`❌ Runner hatası: ${error}`);
          
          resolve({
            success: false,
            code,
            error
          });
        }
      });

      // Timeout
      const timeoutId = setTimeout(() => {
        if (child.killed) return;
        
        console.error('⏱️ Runner timeout, sonlandırılıyor...');
        child.kill('SIGTERM');
        
        if (mode === 'list' || mode === 'full') this.isListRunning = false;
        if (mode === 'docs') this.isDocsRunning = false;
        
        resolve({
          success: false,
          error: `Timeout after ${timeout / 1000} seconds`
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
    if (foundMatch) stats.tendersFound = parseInt(foundMatch[1]);

    const newMatch = text.match(/Yeni:?\s*(\d+)/i);
    if (newMatch) stats.tendersNew = parseInt(newMatch[1]);

    const updatedMatch = text.match(/Güncelle[nm]en:?\s*(\d+)/i);
    if (updatedMatch) stats.tendersUpdated = parseInt(updatedMatch[1]);

    // Döküman istatistikleri
    const processedMatch = text.match(/İşlenen:?\s*(\d+)/i);
    if (processedMatch) stats.docsProcessed = parseInt(processedMatch[1]);

    const errorMatch = text.match(/Hata:?\s*(\d+)/i);
    if (errorMatch) stats.docsErrors = parseInt(errorMatch[1]);
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
      type: options.type || 'manual_list'
    });
  }

  /**
   * Döküman scraping çalıştır
   */
  async runDocsScrape(options = {}) {
    return this.runRunner('docs', {
      ...options,
      type: options.type || 'manual_docs'
    });
  }

  /**
   * Tam scraping (liste + döküman)
   */
  async runFullScrape(options = {}) {
    return this.runRunner('full', {
      ...options,
      type: options.type || 'manual_full'
    });
  }

  /**
   * Başarısız job'ları tekrar dene
   */
  async runRetry(options = {}) {
    return this.runRunner('retry', {
      ...options,
      type: options.type || 'manual_retry'
    });
  }

  // ==========================================================================
  // CRON SCHEDULE
  // ==========================================================================

  /**
   * Tüm cron job'ları başlat
   */
  start() {
    console.log('🚀 İhale scraper scheduler başlatılıyor...\n');

    // ========== LİSTE TARAMA ==========

    // Sabah 08:00 - Ana güncelleme (5 sayfa)
    const listMorning = cron.schedule('0 8 * * *', async () => {
      console.log('\n☀️ [CRON] Sabah liste güncellemesi');
      await this.runRunner('list', { pages: 5, type: 'scheduled_morning' });
    });
    this.jobs.set('list_morning', listMorning);

    // Öğlen 14:00 - Ara güncelleme (3 sayfa)
    const listAfternoon = cron.schedule('0 14 * * *', async () => {
      console.log('\n🌤️ [CRON] Öğlen liste güncellemesi');
      await this.runRunner('list', { pages: 3, type: 'scheduled_afternoon' });
    });
    this.jobs.set('list_afternoon', listAfternoon);

    // Akşam 19:00 - Son güncelleme (2 sayfa)
    const listEvening = cron.schedule('0 19 * * *', async () => {
      console.log('\n🌙 [CRON] Akşam liste güncellemesi');
      await this.runRunner('list', { pages: 2, type: 'scheduled_evening' });
    });
    this.jobs.set('list_evening', listEvening);

    // ========== DÖKÜMAN İŞLEME ==========

    // Sabah 09:00 - Döküman işleme (liste taramasından 1 saat sonra)
    const docsMorning = cron.schedule('0 9 * * *', async () => {
      console.log('\n📄 [CRON] Sabah döküman işleme');
      await this.runRunner('docs', { limit: 100, type: 'scheduled_docs_morning' });
    });
    this.jobs.set('docs_morning', docsMorning);

    // Öğleden sonra 15:00 - Döküman işleme
    const docsAfternoon = cron.schedule('0 15 * * *', async () => {
      console.log('\n📄 [CRON] Öğleden sonra döküman işleme');
      await this.runRunner('docs', { limit: 50, type: 'scheduled_docs_afternoon' });
    });
    this.jobs.set('docs_afternoon', docsAfternoon);

    // ========== BAKIM ==========

    // Gece 03:00 - Temizlik işlemleri
    const cleanup = cron.schedule('0 3 * * *', async () => {
      console.log('\n🧹 [CRON] Gece temizlik işlemleri');
      await this.runRunner('cleanup', { days: 7, type: 'scheduled_cleanup' });
    });
    this.jobs.set('cleanup', cleanup);

    // ========== STARTUP ==========

    // Sunucu başladığında 30 saniye bekle, sonra kontrol et
    setTimeout(async () => {
      const shouldRun = await this.shouldRunStartupScrape();
      if (shouldRun) {
        console.log('\n🔍 [STARTUP] İlk liste kontrolü yapılıyor...');
        await this.runRunner('list', { pages: 2, type: 'startup' });
      }
    }, 30000);

    console.log('✅ İhale scheduler başlatıldı.\n');
    console.log('📋 SCHEDULE:');
    console.log('   ☀️ 08:00 → Liste tarama (5 sayfa)');
    console.log('   📄 09:00 → Döküman işleme');
    console.log('   🌤️ 14:00 → Liste tarama (3 sayfa)');
    console.log('   📄 15:00 → Döküman işleme');
    console.log('   🌙 19:00 → Liste tarama (2 sayfa)');
    console.log('   🧹 03:00 → Temizlik işlemleri\n');
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
        console.log(`⏭️ Son scrape ${hoursSince.toFixed(1)} saat önce, startup atlanıyor`);
        return false;
      }
      
      console.log(`📊 Son scrape ${hoursSince.toFixed(1)} saat önce, startup gerekli`);
      return true;
    } catch (error) {
      console.error('❌ Startup kontrol hatası:', error);
      return true; // Hata durumunda çalıştır
    }
  }

  /**
   * Tüm cron job'ları durdur
   */
  stop() {
    console.log('🛑 İhale scheduler durduruluyor...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`   ⏹️ ${name} durduruldu`);
    });
    this.jobs.clear();
  }

  // ==========================================================================
  // YARDIMCI FONKSİYONLAR
  // ==========================================================================

  /**
   * Log kaydet
   * Not: scraper_logs tablosu migration 059'da yeni şemaya geçirildi
   */
  async logScrape(status, details) {
    try {
      // Yeni şema: level, module, message, context
      const level = status === 'error' ? 'ERROR' : (status === 'success' ? 'INFO' : 'WARN');
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
        error: details.error
      };

      await query(`
        INSERT INTO scraper_logs (
          level, 
          module, 
          message, 
          context
        ) VALUES ($1, $2, $3, $4)
      `, [
        level,
        module,
        message,
        JSON.stringify(context)
      ]);
    } catch (error) {
      console.error('❌ Log kayıt hatası:', error.message);
    }
  }

  /**
   * Son başarılı scrape'i getir
   * Not: Yeni şemada context içinde metadata saklanıyor
   */
  async getLastSuccessfulScrape() {
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
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Son scrape kontrolü hatası:', error);
      return null;
    }
  }

  /**
   * Bildirim gönder
   */
  sendNotification(data) {
    console.log(`📬 İhale Bildirimi:`, data);
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
      jobs: Array.from(this.jobs.keys()).map(name => ({
        name,
        isRunning: this.jobs.get(name)?.running || false
      })),
      schedule: {
        list: ['08:00', '14:00', '19:00'],
        docs: ['09:00', '15:00'],
        cleanup: ['03:00']
      }
    };
  }

  /**
   * Son scrape loglarını getir
   */
  async getScrapeLogs(limit = 50) {
    try {
      const result = await query(`
        SELECT * FROM scraper_logs 
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Log okuma hatası:', error);
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
        topCities: topCities.rows
      };
    } catch (error) {
      console.error('❌ İstatistik hatası:', error);
      return null;
    }
  }
}

// Singleton instance
const tenderScheduler = new TenderScheduler();

export default tenderScheduler;
