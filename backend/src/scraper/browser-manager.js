/**
 * Browser Manager - Puppeteer Instance Yönetimi
 * Singleton pattern ile tek browser instance
 */

import puppeteer from 'puppeteer';

class BrowserManager {
  constructor() {
    this.browser = null;
  }

  /**
   * Browser instance al (yoksa oluştur)
   */
  async getBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('🌐 Browser başlatılıyor...');
      
      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ],
        defaultViewport: { width: 1280, height: 800 }
      });

      console.log('✅ Browser başlatıldı');
    }
    return this.browser;
  }

  /**
   * Yeni sayfa oluştur
   */
  async createPage() {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // User agent ayarla
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Timeout ayarla
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    return page;
  }

  /**
   * Browser'ı kapat
   */
  async close() {
    if (this.browser) {
      console.log('🔒 Browser kapatılıyor...');
      await this.browser.close();
      this.browser = null;
      console.log('✅ Browser kapatıldı');
    }
  }
}

export default new BrowserManager();
