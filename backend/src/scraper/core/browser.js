/**
 * Browser Manager - Puppeteer Instance Management
 * Singleton pattern ile tek browser instance yönetimi
 */

import puppeteer from 'puppeteer';
import { scraperConfig } from '../../config/scraper.config.js';
import { ScraperError } from '../../lib/errors.js';
import logger from '../../utils/logger.js';

class BrowserManager {
  constructor() {
    this.browser = null;
    this.pageCount = 0;
  }

  /**
   * Browser instance al (yoksa oluştur)
   * @returns {Promise<Browser>}
   */
  async getBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      const startTime = Date.now();

      try {
        const config = scraperConfig.browser;

        this.browser = await puppeteer.launch({
          headless: config.headless ? 'new' : false,
          executablePath: config.executablePath,
          args: config.args,
          defaultViewport: config.viewport,
        });

        const duration = Date.now() - startTime;

        logger.info('Browser launched', {
          module: 'scraper',
          action: 'browser.launch',
          duration: `${duration}ms`,
          headless: config.headless,
          viewport: config.viewport,
        });

        // Browser disconnect event'i dinle
        this.browser.on('disconnected', () => {
          logger.warn('Browser disconnected', {
            module: 'scraper',
            action: 'browser.disconnect',
          });
          this.browser = null;
          this.pageCount = 0;
        });
      } catch (error) {
        logger.error('Failed to launch browser', {
          module: 'scraper',
          action: 'browser.launch',
          error: error.message,
          stack: error.stack,
        });
        throw new ScraperError(`Browser launch failed: ${error.message}`, 'BROWSER_LAUNCH_FAILED', {
          executablePath: scraperConfig.browser.executablePath,
        });
      }
    }

    return this.browser;
  }

  /**
   * Yeni sayfa oluştur
   * @param {Object} options - Sayfa ayarları
   * @returns {Promise<Page>}
   */
  async createPage(options = {}) {
    const browser = await this.getBrowser();
    const config = scraperConfig;

    try {
      const page = await browser.newPage();
      this.pageCount++;

      // User agent ayarla
      await page.setUserAgent(options.userAgent || config.browser.userAgent);

      // Viewport ayarla (options ile override edilebilir)
      if (options.viewport) {
        await page.setViewport(options.viewport);
      }

      // Timeout ayarla
      const timeout = options.timeout || config.timeouts.navigation;
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);

      // Request interception (opsiyonel)
      if (options.interceptRequests) {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          // Gereksiz kaynakları engelle (performans için)
          const blockedTypes = ['image', 'stylesheet', 'font', 'media'];
          if (blockedTypes.includes(request.resourceType())) {
            request.abort();
          } else {
            request.continue();
          }
        });
      }

      // Console log'ları yakala (debug için)
      if (options.captureConsole) {
        page.on('console', (msg) => {
          logger.debug('Page console', {
            module: 'scraper',
            type: msg.type(),
            text: msg.text(),
          });
        });
      }

      // Page error'ları yakala
      page.on('pageerror', (error) => {
        logger.warn('Page error', {
          module: 'scraper',
          action: 'page.error',
          error: error.message,
        });
      });

      logger.debug('Page created', {
        module: 'scraper',
        action: 'browser.createPage',
        pageCount: this.pageCount,
        timeout,
      });

      return page;
    } catch (error) {
      logger.error('Failed to create page', {
        module: 'scraper',
        action: 'browser.createPage',
        error: error.message,
      });
      throw new ScraperError(`Page creation failed: ${error.message}`, 'PAGE_CREATE_FAILED');
    }
  }

  /**
   * Sayfayı kapat
   * @param {Page} page - Puppeteer page
   * @returns {Promise<void>}
   */
  async closePage(page) {
    try {
      if (page && !page.isClosed()) {
        await page.close();
        this.pageCount--;

        logger.debug('Page closed', {
          module: 'scraper',
          action: 'browser.closePage',
          pageCount: this.pageCount,
        });
      }
    } catch (error) {
      logger.warn('Error closing page', {
        module: 'scraper',
        action: 'browser.closePage',
        error: error.message,
      });
    }
  }

  /**
   * Browser'ı kapat
   * @returns {Promise<void>}
   */
  async close() {
    if (this.browser) {
      try {
        await this.browser.close();

        logger.info('Browser closed', {
          module: 'scraper',
          action: 'browser.close',
        });
      } catch (error) {
        logger.warn('Error closing browser', {
          module: 'scraper',
          action: 'browser.close',
          error: error.message,
        });
      } finally {
        this.browser = null;
        this.pageCount = 0;
      }
    }
  }

  /**
   * Browser durumunu al
   * @returns {Object}
   */
  getStatus() {
    return {
      isConnected: this.browser?.isConnected() || false,
      pageCount: this.pageCount,
    };
  }

  /**
   * Tüm sayfaları kapat (browser'ı kapatmadan)
   * @returns {Promise<void>}
   */
  async closeAllPages() {
    if (!this.browser) return;

    try {
      const pages = await this.browser.pages();
      for (const page of pages) {
        await this.closePage(page);
      }

      logger.info('All pages closed', {
        module: 'scraper',
        action: 'browser.closeAllPages',
        closedCount: pages.length,
      });
    } catch (error) {
      logger.error('Error closing all pages', {
        module: 'scraper',
        action: 'browser.closeAllPages',
        error: error.message,
      });
    }
  }
}

// Singleton export
const browserManager = new BrowserManager();
export default browserManager;
export { BrowserManager };
