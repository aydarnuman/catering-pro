/**
 * Scraper Modülü - Ana Export
 * 
 * Tüm scraper bileşenlerini tek yerden export eder.
 * 
 * Kullanım:
 *   import scraper from './scraper/index.js';
 *   // veya
 *   import { browserManager, loginService, scrapeList } from './scraper/index.js';
 */

// Core modüller
import browserManager from './browser-manager.js';
import sessionManager from './session-manager.js';
import loginService from './login-service.js';
import logger from './logger.js';

// Scraper'lar
import { scrapeList } from './list-scraper.js';
import documentScraper from './document-scraper.js';

// Default export - tüm modüller tek objede
export default {
  browserManager,
  sessionManager,
  loginService,
  logger,
  scrapeList,
  documentScraper
};

// Named exports
export {
  browserManager,
  sessionManager,
  loginService,
  logger,
  scrapeList,
  documentScraper
};

export const VERSION = '3.0.0';
