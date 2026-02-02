/**
 * Scraper Configuration
 * ihalebul.com scraper için merkezi yapılandırma
 */

export const scraperConfig = {
  // ihalebul.com ayarları
  ihalebul: {
    baseUrl: process.env.IHALEBUL_BASE_URL || 'https://www.ihalebul.com',
    categoryId: parseInt(process.env.IHALEBUL_CATEGORY_ID || '15', 10),
    categoryName: 'Hazır Yemek - Lokantacılık',
    searchPath: '/tenders/search',
    loginPath: '/',
  },

  // Timeout ayarları (ms)
  timeouts: {
    navigation: parseInt(process.env.SCRAPER_NAV_TIMEOUT || '30000', 10),
    pageDelay: parseInt(process.env.SCRAPER_PAGE_DELAY || '2000', 10),
    downloadDelay: parseInt(process.env.SCRAPER_DOWNLOAD_DELAY || '2000', 10),
    elementWait: parseInt(process.env.SCRAPER_ELEMENT_WAIT || '10000', 10),
    networkIdle: parseInt(process.env.SCRAPER_NETWORK_IDLE || '2000', 10),
  },

  // Session ayarları
  session: {
    ttlHours: parseInt(process.env.SESSION_TTL_HOURS || '8', 10),
    storagePath: process.env.SESSION_STORAGE_PATH || 'storage/session.json',
  },

  // Retry ayarları
  retry: {
    maxAttempts: parseInt(process.env.SCRAPER_MAX_RETRIES || '3', 10),
    backoffMs: parseInt(process.env.SCRAPER_BACKOFF_MS || '2000', 10),
    backoffMultiplier: 1.5,
  },

  // Browser ayarları
  browser: {
    headless: process.env.SCRAPER_HEADLESS !== 'false',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    viewport: {
      width: parseInt(process.env.SCRAPER_VIEWPORT_WIDTH || '1280', 10),
      height: parseInt(process.env.SCRAPER_VIEWPORT_HEIGHT || '800', 10),
    },
    userAgent:
      process.env.SCRAPER_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  },

  // Rate limiting
  rateLimit: {
    requestsPerMinute: parseInt(process.env.SCRAPER_RPM || '30', 10),
    concurrentPages: parseInt(process.env.SCRAPER_CONCURRENT_PAGES || '1', 10),
  },

  // Maskelenmiş veri eşiği (login sorunu tespiti için)
  maskedDataThreshold: 0.3, // %30'dan fazla maskelenmiş veri = re-login gerekli
};

export default scraperConfig;
