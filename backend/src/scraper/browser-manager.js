import puppeteer from 'puppeteer';

/**
 * Browser Manager - Singleton Pattern
 * Tek bir browser instance yönetir
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    this.isInitializing = false;
  }

  /**
   * Browser instance al (singleton)
   */
  async getBrowser() {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // Eğer başka bir initialize işlemi devam ediyorsa bekle
    if (this.isInitializing) {
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isInitializing && this.browser) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      return this.browser;
    }

    this.isInitializing = true;

    try {
      console.log('🌐 Browser başlatılıyor...');
      
      // Headless mode: environment variable ile kontrol edilebilir
      const headlessMode = process.env.BROWSER_HEADLESS !== 'false';
      
      this.browser = await puppeteer.launch({
        headless: headlessMode,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/snap/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1366,768'
        ]
      });
      
      console.log(`✅ Browser başlatıldı (headless: ${headlessMode})`);
      
      // Browser kapanırsa temizle
      this.browser.on('disconnected', () => {
        console.log('⚠️ Browser disconnected');
        this.browser = null;
      });

      return this.browser;
      
    } finally {
      this.isInitializing = false;
    }
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

    // Viewport ayarla
    await page.setViewport({
      width: 1366,
      height: 768
    });

    // Request interception (opsiyonel - performans için)
    await page.setRequestInterception(false);

    return page;
  }

  /**
   * Browser'ı kapat
   */
  async close() {
    if (this.browser) {
      console.log('🔄 Browser kapatılıyor...');
      await this.browser.close();
      this.browser = null;
      console.log('✅ Browser kapatıldı');
    }
  }

  /**
   * Browser durumu
   */
  isConnected() {
    return this.browser && this.browser.connected;
  }
}

// Singleton instance
const browserManager = new BrowserManager();

export default browserManager;