/**
 * Scraper Modülü - Ana Export
 *
 * Tüm scraper bileşenlerini tek yerden export eder.
 *
 * Yapı:
 *   shared/             → Ortak altyapı (browser, login, cookie, logger)
 *   ihale-tarama/       → İhale listesi ve içerik çekme
 *   yuklenici-istihbarat/ → Yüklenici verisi çekme
 *   uyumsoft/           → e-Fatura sistemi
 *
 * Kullanım:
 *   import scraper from './scraper/index.js';
 *   // veya
 *   import { browserManager, loginService, scrapeList } from './scraper/index.js';
 */

import documentScraper from './ihale-tarama/ihale-icerik-cek.js';
// İhale Tarama
import { scrapeList } from './ihale-tarama/ihale-listesi-cek.js';
// Shared - Ortak altyapı
import browserManager from './shared/browser.js';
import sessionManager from './shared/ihalebul-cookie.js';
import loginService from './shared/ihalebul-login.js';
import logger from './shared/scraper-logger.js';
import { batchScrapeParticipants } from './yuklenici-istihbarat/ihale-katilimci-cek.js';
import {
  batchScrapeContractorTenders,
  scrapeContractorTenders,
  scrapeKikDecisions,
} from './yuklenici-istihbarat/yuklenici-gecmisi-cek.js';
// Yüklenici İstihbarat
import { scrapeContractorList } from './yuklenici-istihbarat/yuklenici-listesi-cek.js';
import { normalizeAnalyzData, scrapeAnalyzePage } from './yuklenici-istihbarat/yuklenici-profil-cek.js';

// Default export - tüm modüller tek objede
export default {
  browserManager,
  sessionManager,
  loginService,
  logger,
  scrapeList,
  documentScraper,
  scrapeContractorList,
  scrapeContractorTenders,
  batchScrapeContractorTenders,
  scrapeKikDecisions,
  scrapeAnalyzePage,
  normalizeAnalyzData,
  batchScrapeParticipants,
};

// Named exports
export {
  browserManager,
  sessionManager,
  loginService,
  logger,
  scrapeList,
  documentScraper,
  scrapeContractorList,
  scrapeContractorTenders,
  batchScrapeContractorTenders,
  scrapeKikDecisions,
  scrapeAnalyzePage,
  normalizeAnalyzData,
  batchScrapeParticipants,
};

export const VERSION = '4.0.0';
