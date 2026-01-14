/**
 * İhale Scraper Scheduler
 * Otomatik ihale güncelleme servisi
 */

import cron from 'node-cron';
import { query } from '../database.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TenderScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.lastScrapeTime = null;
    this.scrapeStats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null,
      lastNewTenders: 0
    };
  }

  /**
   * Scraper log kaydet
   */
  async logScrape(status, details) {
    try {
      await query(`
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
      `, [
        'tender_scrape',
        status,
        details.message || details.error || '',
        JSON.stringify(details),
        details.startedAt || new Date(),
        details.finishedAt || new Date(),
        details.tendersFound || 0,
        details.newTenders || 0,
        details.updatedTenders || 0,
        details.maxPages || 0
      ]);
    } catch (error) {
      console.error('❌ Scraper log kayıt hatası:', error);
    }
  }

  /**
   * Son başarılı scrape'i kontrol et
   */
  async getLastSuccessfulScrape() {
    try {
      const result = await query(`
        SELECT started_at, tenders_found, tenders_new
        FROM scraper_logs 
        WHERE action = 'tender_scrape' AND status = 'success' 
        ORDER BY started_at DESC 
        LIMIT 1
      `);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Son scrape kontrolü hatası:', error);
      return null;
    }
  }

  /**
   * İhaleleri scrape et
   */
  async scrapeTenders(options = {}) {
    if (this.isRunning) {
      console.log('⏳ Scraper zaten çalışıyor, atlanıyor...');
      return { success: false, message: 'Scraper already running' };
    }

    // 🔒 AKILLI STARTUP KONTROLÜ - 4 saat içinde scrape varsa atla
    if (options.type === 'startup') {
      const lastScrape = await this.getLastSuccessfulScrape();
      if (lastScrape) {
        const hoursSince = (Date.now() - new Date(lastScrape.started_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 4) {
          console.log(`⏭️ Son scrape ${hoursSince.toFixed(1)} saat önce yapıldı, startup scrape atlanıyor`);
          return { success: true, message: 'Recent scrape exists, skipped', skipped: true };
        }
        console.log(`📊 Son scrape ${hoursSince.toFixed(1)} saat önce, devam ediliyor...`);
      }
    }

    const startTime = new Date();
    this.isRunning = true;
    
    const scrapeDetails = {
      type: options.type || 'auto',
      startedAt: startTime,
      maxPages: options.maxPages || 3,
      tendersFound: 0,
      newTenders: 0,
      updatedTenders: 0
    };

    console.log(`🔄 [${new Date().toISOString()}] İhale scraper başlıyor...`);
    console.log(`   📄 Maksimum sayfa: ${scrapeDetails.maxPages}`);
    
    return new Promise((resolve) => {
      const scraperPath = path.join(__dirname, '../scraper/main.js');
      
      // Node process olarak scraper'ı çalıştır
      const scraper = spawn('node', [
        scraperPath,
        '--maxPages', String(scrapeDetails.maxPages),
        '--startPage', '1'
      ]);

      let output = '';
      let errorOutput = '';

      // Çıktıları dinle
      scraper.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text.trim());
        
        // İstatistikleri parse et
        if (text.includes('Toplam:')) {
          const match = text.match(/Toplam: (\d+) ihale/);
          if (match) scrapeDetails.tendersFound = parseInt(match[1]);
        }
        if (text.includes('Yeni:')) {
          const match = text.match(/Yeni: (\d+)/);
          if (match) scrapeDetails.newTenders = parseInt(match[1]);
        }
        if (text.includes('Güncellenen:')) {
          const match = text.match(/Güncellenen: (\d+)/);
          if (match) scrapeDetails.updatedTenders = parseInt(match[1]);
        }
      });

      scraper.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Scraper error:', data.toString());
      });

      // Process bittiğinde
      scraper.on('close', async (code) => {
        this.isRunning = false;
        
        if (code === 0) {
          // Başarılı
          await this.logScrape('success', {
            ...scrapeDetails,
            finishedAt: new Date(),
            duration: (new Date() - startTime) / 1000
          });
          
          this.scrapeStats.totalRuns++;
          this.scrapeStats.successfulRuns++;
          this.scrapeStats.lastNewTenders = scrapeDetails.newTenders;
          this.lastScrapeTime = new Date();

          console.log(`✅ İhale scraper tamamlandı:`);
          console.log(`   📊 Toplam: ${scrapeDetails.tendersFound} ihale`);
          console.log(`   ✨ Yeni: ${scrapeDetails.newTenders} ihale`);
          console.log(`   🔄 Güncellenen: ${scrapeDetails.updatedTenders} ihale`);

          // Yeni ihale bildirimi
          if (scrapeDetails.newTenders > 0) {
            this.sendNotification({
              type: 'new_tenders',
              count: scrapeDetails.newTenders,
              total: scrapeDetails.tendersFound
            });
          }

          resolve({
            success: true,
            stats: {
              found: scrapeDetails.tendersFound,
              new: scrapeDetails.newTenders,
              updated: scrapeDetails.updatedTenders
            }
          });
        } else {
          // Hata
          const errorMessage = errorOutput || `Process exited with code ${code}`;
          
          await this.logScrape('error', {
            ...scrapeDetails,
            error: errorMessage,
            finishedAt: new Date()
          });
          
          this.scrapeStats.failedRuns++;
          this.scrapeStats.lastError = errorMessage;

          console.error(`❌ Scraper hatası: ${errorMessage}`);
          
          resolve({
            success: false,
            error: errorMessage
          });
        }
      });

      // Timeout - 5 dakika
      setTimeout(() => {
        if (this.isRunning) {
          console.error('⏱️ Scraper timeout, process sonlandırılıyor...');
          scraper.kill();
          this.isRunning = false;
          resolve({
            success: false,
            error: 'Timeout after 5 minutes'
          });
        }
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Bildirim gönder
   */
  sendNotification(data) {
    console.log(`📬 İhale Bildirimi:`, data);
    // TODO: Email, webhook veya push notification gönderilebilir
  }

  /**
   * Cron job'ları başlat
   */
  start() {
    console.log('🚀 İhale scraper scheduler başlatılıyor...');

    // Sabah 08:00'de çalışacak
    const morning = cron.schedule('0 8 * * *', async () => {
      console.log('☀️ Sabah ihale güncellemesi başlıyor');
      await this.scrapeTenders({ 
        type: 'scheduled_morning',
        maxPages: 5 
      });
    });

    // Öğlen 14:00'te çalışacak
    const afternoon = cron.schedule('0 14 * * *', async () => {
      console.log('🌤️ Öğleden sonra ihale güncellemesi başlıyor');
      await this.scrapeTenders({ 
        type: 'scheduled_afternoon',
        maxPages: 3 
      });
    });

    // Akşam 19:00'da çalışacak
    const evening = cron.schedule('0 19 * * *', async () => {
      console.log('🌙 Akşam ihale güncellemesi başlıyor');
      await this.scrapeTenders({ 
        type: 'scheduled_evening',
        maxPages: 2 
      });
    });

    this.jobs.set('morning', morning);
    this.jobs.set('afternoon', afternoon);
    this.jobs.set('evening', evening);

    // İlk kontrolü 30 saniye sonra yap
    setTimeout(() => {
      console.log('🔍 İlk ihale kontrolü yapılıyor...');
      this.scrapeTenders({ 
        type: 'startup',
        maxPages: 2 
      });
    }, 30000);

    console.log('✅ İhale scheduler başlatıldı. Günlük 3 kez çalışacak (08:00, 14:00, 19:00)');
  }

  /**
   * Cron job'ları durdur
   */
  stop() {
    console.log('🛑 İhale scheduler durduruluyor...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`   ⏹️ ${name} durduruldu`);
    });
    this.jobs.clear();
  }

  /**
   * Manuel scrape tetikle
   */
  async triggerManualScrape(options = {}) {
    console.log('👆 Manuel ihale scraper tetiklendi');
    return await this.scrapeTenders({
      ...options,
      type: 'manual'
    });
  }

  /**
   * Scheduler durumunu getir
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastScrapeTime: this.lastScrapeTime,
      stats: this.scrapeStats,
      jobs: Array.from(this.jobs.keys()).map(name => ({
        name,
        isRunning: this.jobs.get(name)?.running || false
      }))
    };
  }

  /**
   * Son scrape loglarını getir
   */
  async getScrapeLogs(limit = 50) {
    try {
      const logs = await query(`
        SELECT * FROM scraper_logs 
        WHERE action = 'tender_scrape'
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);
      
      return logs.rows;
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
          COUNT(*) FILTER (WHERE title ILIKE '%yemek%' OR title ILIKE '%catering%' OR title ILIKE '%gıda%') as food_related
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
