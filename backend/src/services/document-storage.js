/**
 * Document Storage Service
 * İhale dökümanlarını Supabase Storage'a indirip kaydeder
 * ZIP dosyalarını açar ve içindeki dosyaları ayrı ayrı kaydeder
 */

import { exec } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import AdmZip from 'adm-zip';
import { pool } from '../database.js';
import documentScraper from '../scraper/ihale-tarama/ihale-icerik-cek.js';
import browserManager from '../scraper/shared/browser.js';
import sessionManager from '../scraper/shared/ihalebul-cookie.js';
import { supabase } from '../supabase.js';
import logger from '../utils/logger.js';
import documentDownloadService from './document-download.js';

const execAsync = promisify(exec);

// Storage bucket name
const BUCKET_NAME = 'tender-documents';

// Desteklenen dosya uzantıları - GENİŞLETİLMİŞ LİSTE
const SUPPORTED_EXTENSIONS = [
  // Dökümanlar
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt', // PowerPoint
  '.pptx', // PowerPoint (yeni)
  '.rtf', // Rich Text
  '.odt', // OpenDocument Text
  '.ods', // OpenDocument Spreadsheet
  '.odp', // OpenDocument Presentation
  // Arşivler
  '.zip',
  '.rar',
  '.7z', // 7-Zip
  // Görseller
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.tiff',
  '.tif',
  '.bmp',
  // Metin
  '.txt',
  '.csv',
  '.xml',
  '.json',
  // Teknik dosyalar (sadece sakla, analiz etme)
  '.dwg', // AutoCAD - teknik şartnamelerde yaygın
  '.dxf', // AutoCAD exchange format
];

// Content-Type mapping - GENİŞLETİLMİŞ
const CONTENT_TYPES = {
  // Dökümanlar
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  // Arşivler
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  // Görseller
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.bmp': 'image/bmp',
  // Metin
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.json': 'application/json',
  // Teknik
  '.dwg': 'application/acad',
  '.dxf': 'application/dxf',
};

// ===== BİRLEŞİK DÖKÜMAN İŞLEME SİSTEMİ =====
// ihalebul.com buton tipleri ve her birinin işleme yöntemi
// Liste sayfasındaki butonlar: /tender/{id}/{typeCode}
const BUTTON_TYPE_CONFIG = {
  announcement: {
    code: 2,
    method: 'content_scrape',
    targetColumn: 'announcement_content',
    format: 'text',
    label: 'İhale İlanı',
  },
  correction_notice: {
    code: 3,
    method: 'content_scrape',
    targetColumn: 'correction_notice_content',
    format: 'text',
    label: 'Düzeltme İlanı',
  },
  goods_list: {
    code: 6,
    method: 'content_scrape',
    targetColumn: 'goods_services_content',
    format: 'json_table',
    label: 'Malzeme Listesi',
  },
  admin_spec: { code: 7, method: 'download', targetColumn: null, format: 'file', label: 'İdari Şartname' },
  tech_spec: { code: 8, method: 'download', targetColumn: null, format: 'file', label: 'Teknik Şartname' },
  zeyilname: {
    code: 9,
    method: 'content_and_download',
    targetColumn: 'zeyilname_content',
    format: 'text',
    label: 'Zeyilname',
  },
};

// İçerik sayfası URL'si mi kontrol et (/tender/{id}/{typeCode} pattern)
function isContentPageUrl(url) {
  return /\/tender\/\d+\/\d+$/.test(url);
}

// Gerçek download URL'si mi kontrol et
function isDownloadUrl(url) {
  return url.includes('/download') || /\.(pdf|doc|docx|xls|xlsx|zip|rar)(\?|$)/i.test(url);
}

// Doc type display names
const DOC_TYPE_NAMES = {
  admin_spec: 'İdari Şartname',
  tech_spec: 'Teknik Şartname',
  project_files: 'Proje Dosyaları',
  announcement: 'İhale İlanı',
  zeyilname: 'Zeyilname',
  zeyilname_tech_spec: 'Teknik Şartname Zeyilnamesi',
  zeyilname_admin_spec: 'İdari Şartname Zeyilnamesi',
  correction_notice: 'Düzeltme İlanı',
  contract: 'Sözleşme Tasarısı',
  unit_price: 'Birim Fiyat Teklif Cetveli',
  pursantaj: 'Pursantaj Listesi',
  quantity_survey: 'Mahal Listesi / Metraj',
  standard_forms: 'Standart Formlar',
  goods_services: 'Mal/Hizmet Listesi',
};

class DocumentStorageService {
  constructor() {
    this.downloadDelay = 2000; // Rate limiting: 2 saniye
  }

  /**
   * Dosya adından doc_type belirle
   * ZIP'ten çıkan dosyalar için dosya adına bakarak doğru tipi belirler
   * @param {string} fileName - Dosya adı
   * @param {string} defaultDocType - Varsayılan doc_type (parent'tan gelen)
   * @returns {string} - Belirlenen doc_type
   */
  detectDocTypeFromFileName(fileName, defaultDocType) {
    // Türkçe karakterleri normalize et ve küçük harfe çevir
    const nameLower = fileName
      .toLowerCase()
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/İ/gi, 'i')
      .replace(/[_-]/g, ' '); // Alt çizgi ve tire'yi boşluğa çevir

    // Zeyilname kontrolü - dosya adında "zeyilname" geçiyorsa
    if (nameLower.includes('zeyilname')) {
      // Hangi şartnamenin zeyilnamesi?
      if (nameLower.includes('teknik') || defaultDocType === 'tech_spec') {
        return 'zeyilname_tech_spec';
      }
      if (nameLower.includes('idari') || defaultDocType === 'admin_spec') {
        return 'zeyilname_admin_spec';
      }
      return 'zeyilname'; // Genel zeyilname
    }

    // Düzeltme kontrolü
    if (nameLower.includes('duzeltme')) {
      return 'correction_notice';
    }

    // ÖNCELİK SIRASI ÖNEMLİ!

    // 1. İlan (en önce - 'ihale ilani', 'sonuc ilani' gibi isimler "hizmet" içerebilir)
    if (nameLower.includes('ilan') || nameLower.includes('announcement')) {
      return 'announcement';
    }

    // 2. Sözleşme/Tasarı
    if (nameLower.includes('sozlesme') || nameLower.includes('tasari') || nameLower.includes('contract')) {
      return 'contract';
    }

    // 3. Teknik şartname
    if (nameLower.includes('teknik') || nameLower.includes('tech')) {
      return 'tech_spec';
    }

    // 4. İdari şartname
    if (nameLower.includes('idari') || nameLower.includes('admin')) {
      return 'admin_spec';
    }

    // 5. Birim fiyat cetveli
    if (
      nameLower.includes('birim') ||
      nameLower.includes('fiyat') ||
      nameLower.includes('cetvel') ||
      nameLower.includes('price')
    ) {
      return 'unit_price';
    }

    // 6. Mal/Hizmet listesi (en sonda - çok genel kelimeler)
    if (
      nameLower.includes('mal ') ||
      nameLower.includes('hizmet ') ||
      nameLower.includes('malzeme') ||
      nameLower.includes('liste')
    ) {
      return 'item_list';
    }

    // Pursantaj
    if (nameLower.includes('pursantaj')) {
      return 'pursantaj';
    }

    // Mahal listesi / Metraj
    if (nameLower.includes('mahal') || nameLower.includes('metraj')) {
      return 'quantity_survey';
    }

    // Standart formlar
    if (nameLower.includes('form') || nameLower.includes('standart')) {
      return 'standard_forms';
    }

    // Varsayılan tipi döndür
    return defaultDocType || 'other';
  }

  // ===== BİRLEŞİK İŞLEME SİSTEMİ =====

  /**
   * Buton URL'sine session cookie'li GET yaparak HTML içeriği döndürür
   * @param {string} url - Buton URL'si (/tender/{id}/{typeCode})
   * @returns {string|null} - HTML string veya null
   */
  async fetchPageHtml(url) {
    try {
      const response = await documentDownloadService.downloadDocument(url);
      const html = response.toString('utf8');
      // Gerçekten HTML mi kontrol et
      if (html.includes('<html') || html.includes('<!DOCTYPE') || html.includes('<body')) {
        return html;
      }
      return null;
    } catch (error) {
      logger.error('Sayfa HTML çekme hatası', { url, error: error.message });
      return null;
    }
  }

  /**
   * HTML içerikten metin çıkarır (announcement, zeyilname, correction_notice için)
   * Card-body veya tablo içeriğini text olarak döndürür
   * @param {string} html - Sayfa HTML'i
   * @returns {string|null}
   */
  scrapeTextFromHtml(html) {
    try {
      // Card body içeriğini çek
      // Pattern: <div class="card-body">...içerik...</div>
      const cardBodyMatch = html.match(/<div[^>]*class="[^"]*card-body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
      if (cardBodyMatch) {
        return this.stripHtmlTags(cardBodyMatch[1]).trim();
      }

      // Tablo içeriğini text olarak çek
      const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
      if (tableMatch) {
        return this.stripHtmlTags(tableMatch[0]).trim();
      }

      // Body içeriğini al
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        const bodyText = this.stripHtmlTags(bodyMatch[1]).trim();
        // Çok kısa ise (navigasyon menüsü vb.) geçersiz say
        if (bodyText.length > 100) return bodyText;
      }

      return null;
    } catch (error) {
      logger.error('HTML text çıkarma hatası', { error: error.message });
      return null;
    }
  }

  /**
   * HTML içerikten tablo verisi çıkarır (goods_list / malzeme listesi için)
   * DataTable satırlarını JSON array olarak döndürür
   * @param {string} html - Sayfa HTML'i
   * @returns {Array|null}
   */
  scrapeTableFromHtml(html) {
    try {
      // Tüm tabloları bul
      const tableRegex = /<table[\s\S]*?<\/table>/gi;
      const tables = html.match(tableRegex);
      if (!tables || tables.length === 0) return null;

      // En büyük tabloyu seç (genelde veri tablosu)
      let targetTable = tables[0];
      for (const t of tables) {
        if (t.length > targetTable.length) targetTable = t;
      }

      // Header'ları çek
      const headers = [];
      const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
      let headerMatch = headerRegex.exec(targetTable);
      while (headerMatch !== null) {
        const text = this.stripHtmlTags(headerMatch[1]).trim();
        if (text === '#') {
          headers.push('sira');
        } else if (text) {
          headers.push(
            text
              .toLowerCase()
              .replace(/ı/g, 'i')
              .replace(/ö/g, 'o')
              .replace(/ü/g, 'u')
              .replace(/ş/g, 's')
              .replace(/ç/g, 'c')
              .replace(/ğ/g, 'g')
              .replace(/\s+/g, '_')
          );
        }
        headerMatch = headerRegex.exec(targetTable);
      }

      // Standart header yoksa varsayılan kullan
      if (headers.length === 0) {
        headers.push('sira', 'kalem', 'miktar', 'birim');
      }

      // Satırları çek
      const rows = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch = rowRegex.exec(targetTable);
      let isFirstRow = true;

      while (rowMatch !== null) {
        // İlk satır header olabilir, atla
        if (isFirstRow && rowMatch[1].includes('<th')) {
          isFirstRow = false;
          rowMatch = rowRegex.exec(targetTable);
          continue;
        }
        isFirstRow = false;

        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch = cellRegex.exec(rowMatch[1]);
        const row = {};
        let cellIdx = 0;
        let hasValidData = false;

        while (cellMatch !== null) {
          const value = this.stripHtmlTags(cellMatch[1]).trim();
          const key = headers[cellIdx] || `col_${cellIdx}`;

          if (value && value.length > 0) {
            row[key] = value;
            if (key !== 'sira' && value.length > 0) hasValidData = true;
          }
          cellIdx++;
          cellMatch = cellRegex.exec(rowMatch[1]);
        }

        if (hasValidData && Object.keys(row).length >= 2) {
          rows.push(row);
        }
        rowMatch = rowRegex.exec(targetTable);
      }

      return rows.length > 0 ? rows : null;
    } catch (error) {
      logger.error('HTML tablo çıkarma hatası', { error: error.message });
      return null;
    }
  }

  /**
   * HTML içerikten gerçek download linklerini çıkarır
   * /download?hash=... pattern'ine uyan linkleri bulur
   * @param {string} html - Sayfa HTML'i
   * @returns {Array<{url: string, name: string}>}
   */
  extractDownloadLinksFromHtml(html) {
    const links = [];
    const seenUrls = new Set();

    // href="..." içeren tüm linkleri bul
    const linkRegex =
      /<a[^>]*href=["']([^"']*(?:download|file|\.pdf|\.doc|\.xls|\.zip|\.rar)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match = linkRegex.exec(html);

    while (match !== null) {
      let url = match[1];
      const text = this.stripHtmlTags(match[2]).trim();

      // Relative URL'yi absolute yap
      if (url.startsWith('/')) {
        url = `https://www.ihalebul.com${url}`;
      }

      // Tekrar kontrolü
      if (!seenUrls.has(url)) {
        seenUrls.add(url);

        // Sadece download URL'lerini al
        if (isDownloadUrl(url)) {
          links.push({ url, name: text || null });
        }
      }
      match = linkRegex.exec(html);
    }

    return links;
  }

  /**
   * İçerik sayfası URL'sinden gerçek download linkini çözer
   * Buton URL'sine (/tender/123/8) gidip sayfadaki /download?hash=... linkini bulur
   * @param {string} contentPageUrl - İçerik sayfası URL'si
   * @returns {Object|null} - { url, name } veya null
   */
  async resolveDownloadUrl(contentPageUrl) {
    logger.info(`Download link çözümleniyor: ${contentPageUrl}`);

    const html = await this.fetchPageHtml(contentPageUrl);
    if (!html) {
      logger.warn(`Sayfa içeriği alınamadı: ${contentPageUrl}`);
      return null;
    }

    const downloadLinks = this.extractDownloadLinksFromHtml(html);
    if (downloadLinks.length === 0) {
      logger.warn(`Sayfada download linki bulunamadı: ${contentPageUrl}`);
      return null;
    }

    // İlk download linkini döndür (genelde tekil dosya)
    logger.info(`Download link bulundu: ${downloadLinks[0].url} (toplam ${downloadLinks.length} link)`);
    return downloadLinks[0];
  }

  /**
   * İçerik sayfası URL'sinden TÜM download linklerini çözer
   * resolveDownloadUrl'den farkı: birden fazla link varsa hepsini döndürür
   * @param {string} contentPageUrl - İçerik sayfası URL'si
   * @returns {Array<{url: string, name: string}>} - Download linkleri dizisi
   */
  async resolveAllDownloadUrls(contentPageUrl) {
    logger.info(`Tüm download linkler çözümleniyor: ${contentPageUrl}`);

    const html = await this.fetchPageHtml(contentPageUrl);
    if (!html) {
      logger.warn(`Sayfa içeriği alınamadı: ${contentPageUrl}`);
      return [];
    }

    const downloadLinks = this.extractDownloadLinksFromHtml(html);
    if (downloadLinks.length === 0) {
      logger.warn(`Sayfada download linki bulunamadı: ${contentPageUrl}`);
      return [];
    }

    logger.info(`${downloadLinks.length} download link bulundu: ${contentPageUrl}`);
    return downloadLinks;
  }

  /**
   * Puppeteer ile Malzeme Listesi (DataTable) çeker
   * AJAX ile yüklenen DataTable içeriklerini görmek için Puppeteer gerekli
   * Pagination varsa tüm sayfaları gez
   * @param {string} url - Mal/Hizmet Listesi sayfası URL'si
   * @returns {Array|null} - JSON array veya null
   */
  async scrapeGoodsListWithPuppeteer(url) {
    let page = null;
    try {
      logger.info(`[PUPPETEER] Malzeme listesi çekiliyor: ${url}`);

      // Browser instance al
      page = await browserManager.createPage();

      // Session cookie'lerini uygula
      const session = await sessionManager.loadSession();
      if (session?.cookies && session.cookies.length > 0) {
        await sessionManager.applyCookies(page, session.cookies);
        logger.debug(`[PUPPETEER] ${session.cookies.length} cookie uygulandı`);
      }

      // Sayfaya git
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // DataTable'ın render olmasını bekle
      try {
        await page.waitForSelector('table tbody tr', { timeout: 10000 });
      } catch (_e) {
        logger.warn(`[PUPPETEER] DataTable bulunamadı, tablo olmayabilir: ${url}`);
      }

      // DataTable pagination: "Tümünü Göster" veya sayfa boyutunu artır
      try {
        await page.evaluate(() => {
          // DataTable API varsa tüm satırları göster
          if (typeof jQuery !== 'undefined' && jQuery.fn.dataTable) {
            const tables = jQuery('table.dataTable');
            if (tables.length > 0) {
              const dt = tables.DataTable();
              dt.page.len(-1).draw(); // Tüm satırları göster
            }
          }
          // Alternatif: select box ile sayfa boyutunu artır
          const selectEl = document.querySelector('.dataTables_length select, select[name*="length"]');
          if (selectEl) {
            // En büyük değeri seç
            const options = Array.from(selectEl.options);
            const lastOption = options[options.length - 1];
            if (lastOption) {
              selectEl.value = lastOption.value;
              selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });

        // DataTable yeniden yüklenmesini bekle
        await this.sleep(2000);
      } catch (_e) {
        logger.debug('[PUPPETEER] DataTable pagination ayarlanamadı (normal olabilir)');
      }

      // document-scraper ile tablo verisini çek
      const result = await documentScraper.scrapeGoodsServicesList(page);

      if (result && result.length > 0) {
        logger.info(`[PUPPETEER] Malzeme listesi başarıyla çekildi: ${result.length} satır`);
      } else {
        logger.warn(`[PUPPETEER] Malzeme listesi boş veya bulunamadı: ${url}`);
      }

      return result;
    } catch (error) {
      logger.error(`[PUPPETEER] Malzeme listesi çekme hatası`, { url, error: error.message });
      return null;
    } finally {
      // Sayfayı kapat
      if (page) {
        try {
          await page.close();
        } catch (_e) {}
      }
    }
  }

  /**
   * Retry mekanizması - Geçici hatalarda otomatik tekrar dene
   * Exponential backoff ile 2 kez daha dener
   * @param {Function} fn - Çalıştırılacak async fonksiyon
   * @param {number} maxRetries - Maksimum tekrar sayısı (varsayılan: 2)
   * @param {number} baseDelay - Baz bekleme süresi ms (varsayılan: 2000)
   * @returns {*} - Fonksiyon sonucu
   */
  async withRetry(fn, maxRetries = 2, baseDelay = 2000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = baseDelay * 2 ** attempt; // exponential backoff: 2s, 4s
          logger.warn(`Retry ${attempt + 1}/${maxRetries}: ${error.message}`, { delay });
          await this.sleep(delay);
        }
      }
    }
    throw lastError;
  }

  /**
   * HTML tag'lerini temizle
   */
  stripHtmlTags(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '') // Script'leri kaldır
      .replace(/<style[\s\S]*?<\/style>/gi, '') // Style'ları kaldır
      .replace(/<[^>]+>/g, ' ') // Tüm tag'leri boşlukla değiştir
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Fazla boşlukları temizle
      .trim();
  }

  /**
   * MERKEZ SCRAPER: Tek bir ihale için tüm buton içeriklerini işle
   * Liste sayfasındaki her butonu doğru yöntemle işler:
   *   - content_scrape: HTML içeriği çekip ilgili kolona kaydet (json_table için Puppeteer)
   *   - content_and_download: Önce içerik çek, sonra download linkleri de indir (Zeyilname)
   *   - download: Gerçek dosyayı indirip Supabase'e yükle (tüm download linkler)
   *
   * Ek özellikler:
   *   - Retry mekanizması: Geçici hatalarda 2 kez daha dener
   *   - Multi-download: Sayfadaki TÜM download linklerini indirir
   *   - DataTable: Puppeteer ile AJAX tablolarını çeker
   *
   * @param {number} tenderId - İhale ID
   * @returns {Object} - İşleme sonuçları
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Central scraper orchestrates multiple download/scrape strategies with retry logic
  async merkezScraper(tenderId) {
    logger.info(`[MERKEZ-SCRAPER] İhale ${tenderId} tüm içerikler işleniyor`);

    const results = {
      tenderId,
      downloaded: [], // Dosya olarak indirilen dökümanlar
      contentScraped: [], // HTML'den çekilen içerikler
      failed: [],
      skipped: [],
    };

    try {
      // 1. İhale bilgilerini al
      const tenderResult = await pool.query(
        `SELECT id, title, document_links, external_id, 
                announcement_content, goods_services_content, 
                zeyilname_content, correction_notice_content
         FROM tenders WHERE id = $1`,
        [tenderId]
      );

      if (tenderResult.rows.length === 0) {
        throw new Error(`İhale bulunamadı: ${tenderId}`);
      }

      const tender = tenderResult.rows[0];
      const documentLinks = tender.document_links || {};

      if (Object.keys(documentLinks).length === 0) {
        logger.warn(`İhale ${tenderId}: Buton linki yok`);
        return { ...results, message: 'Buton linki bulunamadı' };
      }

      // 2. Daha önce indirilmiş dökümanları kontrol et (download tipler için)
      const existingDocs = await pool.query(
        `SELECT source_url FROM documents 
         WHERE tender_id = $1 AND source_type = 'download'`,
        [tenderId]
      );
      const downloadedUrls = new Set(existingDocs.rows.map((d) => d.source_url));

      // 3. Her buton tipi için işle
      for (const [docType, docData] of Object.entries(documentLinks)) {
        try {
          const url = typeof docData === 'string' ? docData : docData?.url;
          const name = typeof docData === 'object' ? docData?.name : null;
          const fileName = typeof docData === 'object' ? docData?.fileName : null;

          if (!url) {
            logger.warn(`${docType}: URL bulunamadı`);
            continue;
          }

          // Config'den işleme yöntemini al
          const config = BUTTON_TYPE_CONFIG[docType];
          const method = config?.method || (isDownloadUrl(url) ? 'download' : 'unknown');

          logger.info(`[MERKEZ-SCRAPER] ${docType}: method=${method}, url=${url.substring(0, 60)}...`);

          // Rate limiting
          await this.sleep(this.downloadDelay);

          // === İÇERİK SCRAPE ===
          if (method === 'content_scrape') {
            // Bu kolonun zaten doluysa atla
            const targetColumn = config.targetColumn;
            if (targetColumn && tender[targetColumn]) {
              logger.debug(`${docType}: ${targetColumn} zaten dolu, atlanıyor`);
              results.skipped.push({ docType, reason: 'content_already_exists' });
              continue;
            }

            let content = null;

            // DataTable (json_table) formatı için Puppeteer kullan
            if (config.format === 'json_table') {
              content = await this.withRetry(() => this.scrapeGoodsListWithPuppeteer(url), 2, 3000);
            }

            // Puppeteer başarısız olduysa veya json_table değilse, HTML fetch + regex fallback
            if (!content) {
              const html = await this.withRetry(() => this.fetchPageHtml(url), 2, 2000);
              if (!html) {
                results.failed.push({ docType, error: 'HTML içerik alınamadı' });
                continue;
              }

              if (config.format === 'json_table') {
                content = this.scrapeTableFromHtml(html); // Regex fallback
              } else {
                content = this.scrapeTextFromHtml(html);
              }

              if (!content) {
                // İçerik bulunamadıysa, belki bu sayfada download linki vardır?
                const downloadLinks = this.extractDownloadLinksFromHtml(html);
                if (downloadLinks.length > 0) {
                  logger.info(
                    `${docType}: İçerik bulunamadı ama ${downloadLinks.length} download link bulundu, dosya olarak indiriliyor`
                  );
                  for (const dl of downloadLinks) {
                    if (downloadedUrls.has(dl.url)) {
                      results.skipped.push({ docType, reason: 'already_downloaded', url: dl.url });
                      continue;
                    }
                    try {
                      const downloadResult = await this.withRetry(
                        () => this.downloadAndStore(tenderId, docType, dl.url, dl.name || name),
                        2,
                        2000
                      );
                      results.downloaded.push({ docType, ...downloadResult });
                      downloadedUrls.add(dl.url);
                    } catch (dlError) {
                      results.failed.push({ docType, error: dlError.message, url: dl.url });
                    }
                  }
                  continue;
                }

                results.failed.push({ docType, error: 'İçerik çıkarılamadı' });
                continue;
              }
            }

            // İçeriği tenders tablosuna kaydet
            if (targetColumn) {
              const contentValue = typeof content === 'string' ? content : JSON.stringify(content);
              await pool.query(`UPDATE tenders SET ${targetColumn} = $1, updated_at = NOW() WHERE id = $2`, [
                contentValue,
                tenderId,
              ]);
              logger.info(
                `${docType}: İçerik kaydedildi → ${targetColumn} (${typeof content === 'string' ? content.length + ' chars' : content.length + ' rows'})`
              );
            }

            results.contentScraped.push({
              docType,
              targetColumn,
              format: config.format,
              size: typeof content === 'string' ? content.length : content.length,
            });
            continue;
          }

          // === İÇERİK + DOSYA İNDİRME (Zeyilname vb.) ===
          if (method === 'content_and_download') {
            const targetColumn = config?.targetColumn;

            // 1. Önce içeriği çek
            const html = await this.withRetry(() => this.fetchPageHtml(url), 2, 2000);
            if (html) {
              // İçerik zaten doluysa atla ama download'a devam et
              if (targetColumn && !tender[targetColumn]) {
                const content = this.scrapeTextFromHtml(html);
                if (content) {
                  await pool.query(`UPDATE tenders SET ${targetColumn} = $1, updated_at = NOW() WHERE id = $2`, [
                    content,
                    tenderId,
                  ]);
                  logger.info(`${docType}: İçerik kaydedildi → ${targetColumn} (${content.length} chars)`);
                  results.contentScraped.push({ docType, targetColumn, format: 'text', size: content.length });
                }
              } else if (targetColumn && tender[targetColumn]) {
                logger.debug(`${docType}: ${targetColumn} zaten dolu, sadece download aranıyor`);
              }

              // 2. Aynı sayfada download link var mı?
              const downloadLinks = this.extractDownloadLinksFromHtml(html);
              if (downloadLinks.length > 0) {
                logger.info(`${docType}: ${downloadLinks.length} download link bulundu, dosyalar indiriliyor`);
                for (const dl of downloadLinks) {
                  if (downloadedUrls.has(dl.url)) {
                    results.skipped.push({ docType, reason: 'already_downloaded', url: dl.url });
                    continue;
                  }
                  try {
                    const downloadResult = await this.withRetry(
                      () => this.downloadAndStore(tenderId, docType, dl.url, dl.name || name),
                      2,
                      2000
                    );
                    results.downloaded.push({ docType, ...downloadResult });
                    downloadedUrls.add(dl.url);
                  } catch (dlError) {
                    results.failed.push({ docType, error: dlError.message, url: dl.url });
                  }
                }
              }
            } else {
              results.failed.push({ docType, error: 'HTML içerik alınamadı (content_and_download)' });
            }
            continue;
          }

          // === DOSYA İNDİRME ===
          if (method === 'download' || isDownloadUrl(url)) {
            // İçerik sayfası URL'si mi? TÜM download linklerini bul
            if (isContentPageUrl(url)) {
              logger.info(`${docType}: İçerik sayfası URL'si, gerçek download linkleri aranıyor...`);
              const resolvedLinks = await this.resolveAllDownloadUrls(url);
              if (resolvedLinks.length > 0) {
                // Tüm download linklerini indir
                for (const resolved of resolvedLinks) {
                  if (downloadedUrls.has(resolved.url)) {
                    results.skipped.push({ docType, reason: 'already_downloaded', url: resolved.url });
                    continue;
                  }

                  // fileName'den uzantı çıkar
                  let fileExtFromName = null;
                  if (fileName) {
                    const extMatch = fileName.match(/\.(\w+)$/);
                    if (extMatch) {
                      fileExtFromName = `.${extMatch[1].toLowerCase()}`;
                    }
                  }

                  try {
                    const downloadResult = await this.withRetry(
                      () =>
                        this.downloadAndStore(tenderId, docType, resolved.url, resolved.name || name, fileExtFromName),
                      2,
                      2000
                    );
                    results.downloaded.push({ docType, ...downloadResult });
                    downloadedUrls.add(resolved.url);
                  } catch (dlError) {
                    results.failed.push({ docType, error: dlError.message, url: resolved.url });
                  }
                }
                continue;
              } else {
                results.skipped.push({ docType, reason: 'no_download_link_on_page' });
                continue;
              }
            }

            // Daha önce indirilmiş mi?
            if (downloadedUrls.has(url)) {
              logger.debug(`${docType}: Zaten indirilmiş`);
              results.skipped.push({ docType, reason: 'already_downloaded' });
              continue;
            }

            // fileName'den uzantı çıkar
            let fileExtFromName = null;
            if (fileName) {
              const extMatch = fileName.match(/\.(\w+)$/);
              if (extMatch) {
                fileExtFromName = `.${extMatch[1].toLowerCase()}`;
              }
            }

            const downloadResult = await this.withRetry(
              () => this.downloadAndStore(tenderId, docType, url, name, fileExtFromName),
              2,
              2000
            );
            results.downloaded.push({ docType, ...downloadResult });
            downloadedUrls.add(url);
            continue;
          }

          // === BİLİNMEYEN TİP ===
          // Config'de tanımlı değil ve URL pattern'i de tanınamadı
          // İçerik sayfası URL'si ise, önce TÜM download linkleri ara, yoksa içerik çek
          if (isContentPageUrl(url)) {
            logger.info(`${docType}: Bilinmeyen tip, içerik sayfası URL'si - önce download link aranıyor`);
            const resolvedLinks = await this.resolveAllDownloadUrls(url);
            if (resolvedLinks.length > 0) {
              for (const resolved of resolvedLinks) {
                if (!downloadedUrls.has(resolved.url)) {
                  try {
                    const downloadResult = await this.withRetry(
                      () => this.downloadAndStore(tenderId, docType, resolved.url, resolved.name || name),
                      2,
                      2000
                    );
                    results.downloaded.push({ docType, ...downloadResult });
                    downloadedUrls.add(resolved.url);
                  } catch (dlError) {
                    results.failed.push({ docType, error: dlError.message, url: resolved.url });
                  }
                }
              }
            } else {
              // Download link yoksa içerik olarak çek
              const html = await this.withRetry(() => this.fetchPageHtml(url), 2, 2000);
              if (html) {
                const textContent = this.scrapeTextFromHtml(html);
                if (textContent) {
                  logger.info(`${docType}: Bilinmeyen tip, içerik olarak kaydedildi (${textContent.length} chars)`);
                  results.contentScraped.push({ docType, format: 'text', size: textContent.length });
                } else {
                  results.skipped.push({ docType, reason: 'unknown_type_no_content' });
                }
              } else {
                results.skipped.push({ docType, reason: 'unknown_type_fetch_failed' });
              }
            }
          } else {
            // Normal URL, download olarak dene
            if (!downloadedUrls.has(url)) {
              try {
                const downloadResult = await this.withRetry(
                  () => this.downloadAndStore(tenderId, docType, url, name),
                  2,
                  2000
                );
                results.downloaded.push({ docType, ...downloadResult });
                downloadedUrls.add(url);
              } catch (dlError) {
                results.failed.push({ docType, error: dlError.message });
              }
            }
          }
        } catch (error) {
          logger.error(`[MERKEZ-SCRAPER] ${docType}: İşleme hatası`, { error: error.message, tenderId });
          results.failed.push({ docType, error: error.message });
        }
      }

      // Başarılı indirmelerin doğrulaması
      if (results.downloaded.length > 0) {
        const verifyResult = await pool.query(
          `SELECT COUNT(*) as count, SUM(file_size) as total_size
           FROM documents 
           WHERE tender_id = $1 AND source_type = 'download' AND processing_status = 'pending'`,
          [tenderId]
        );
        const verified = verifyResult.rows[0];
        logger.debug(
          `Doğrulama: ${verified.count} döküman DB'de pending durumunda (${((verified.total_size || 0) / 1024 / 1024).toFixed(2)} MB)`
        );
      }

      // Özet log
      logger.info(`[MERKEZ-SCRAPER] İhale ${tenderId} tamamlandı`, {
        downloaded: results.downloaded.length,
        contentScraped: results.contentScraped.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
      });

      return results;
    } catch (error) {
      logger.error(`[MERKEZ-SCRAPER] İhale ${tenderId} genel hata`, { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Tek bir dökümanı indir ve depola
   * @param {string} hintExtension - fileName'den çıkarılan uzantı ipucu (opsiyonel)
   */
  async downloadAndStore(tenderId, docType, url, displayName = null, hintExtension = null) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tender-doc-'));

    try {
      // 1. Dökümanı indir
      const fileBuffer = await documentDownloadService.downloadDocument(url);

      // HTML Guard - İndirilen içerik HTML ise dosya olarak kaydetme
      const headerStr = fileBuffer.slice(0, 500).toString('utf8').trim().toLowerCase();
      if (headerStr.startsWith('<!doctype') || headerStr.startsWith('<html') || headerStr.startsWith('<?xml')) {
        throw new Error(
          `HTML içerik tespit edildi, gerçek dosya değil (docType: ${docType}, url: ${url.substring(0, 80)})`
        );
      }

      // 2. Dosya uzantısını belirle - öncelik sırası:
      //    a) Magic bytes'tan tespit (en güvenilir)
      //    b) fileName'den gelen ipucu (hintExtension)
      //    c) URL'den uzantı
      //    d) Varsayılan .pdf
      let extension = this.detectFileType(fileBuffer);

      // Magic bytes null döndü ama hintExtension varsa onu kullan
      if (!extension && hintExtension) {
        logger.info(`Magic bytes tanınamadı, fileName uzantısı kullanılıyor: ${hintExtension}`);
        extension = hintExtension;
      }

      // Hala null ise URL'den veya varsayılan
      extension = extension || this.getExtensionFromUrl(url) || '.pdf';

      const isZip = extension === '.zip' || extension === '.rar';

      logger.debug(`Dosya tipi tespit edildi: ${extension} (URL: ${url.substring(0, 50)}...)`);

      // 3. Temp dosyaya kaydet
      const tempFilePath = path.join(tempDir, `download${extension}`);
      await fs.writeFile(tempFilePath, fileBuffer);

      let uploadResults = [];

      if (isZip) {
        uploadResults = await this.extractAndUpload(tenderId, docType, tempFilePath, url);
      } else {
        // Tek dosyayı yükle
        const result = await this.uploadSingleFile(
          tenderId,
          docType,
          fileBuffer,
          extension,
          displayName || this.getDisplayName(docType),
          url
        );
        uploadResults = [result];
      }

      return {
        docType,
        filesCount: uploadResults.length,
        totalSize: uploadResults.reduce((sum, r) => sum + (r.fileSize || 0), 0),
        files: uploadResults,
      };
    } finally {
      // Temp klasörü temizle
      try {
        await fs.rm(tempDir, { recursive: true });
      } catch (e) {
        logger.warn('Temp klasör temizleme hatası', { error: e.message });
      }
    }
  }

  /**
   * ZIP dosyasını aç ve içindekileri yükle
   * Node.js adm-zip kullanarak Türkçe karakter sorunlarını çözer
   */
  async extractAndUpload(tenderId, docType, zipPath, sourceUrl) {
    const extractDir = path.join(path.dirname(zipPath), 'extracted');
    await fs.mkdir(extractDir, { recursive: true });

    try {
      const ext = path.extname(zipPath).toLowerCase();
      const uploadResults = [];

      if (ext === '.zip') {
        // adm-zip ile ZIP aç (Türkçe karakter desteği)
        logger.info(`ZIP dosyası açılıyor (adm-zip): ${zipPath}`);
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        logger.info(`ZIP içinde ${zipEntries.length} dosya bulundu`);

        for (const entry of zipEntries) {
          // Klasörleri atla
          if (entry.isDirectory) continue;

          // Dosya adını UTF-8 olarak decode et
          let fileName = entry.entryName;

          // Path'ten sadece dosya adını al
          fileName = path.basename(fileName);

          // Türkçe karakterleri düzelt (CP437 -> UTF-8)
          try {
            // Buffer'dan UTF-8 string oluştur
            const nameBuffer = Buffer.from(entry.rawEntryName);
            const utf8Name = nameBuffer.toString('utf8');
            if (utf8Name && !utf8Name.includes('�')) {
              fileName = path.basename(utf8Name);
            }
          } catch (_e) {
            // Decode hatasında orijinal ismi kullan
          }

          const fileExt = path.extname(fileName).toLowerCase();

          // Desteklenen dosya mı kontrol et
          if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
            logger.warn(`Desteklenmeyen dosya atlandı: ${fileName}`);
            continue;
          }

          // Dosya içeriğini al
          const buffer = entry.getData();
          logger.debug(`İşleniyor: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);

          // ZIP'ten çıkan dosyalar için unique source_url oluştur
          // (aynı ZIP'ten birden fazla dosya çıkabilir)
          const uniqueSourceUrl = `${sourceUrl}#file=${encodeURIComponent(entry.entryName)}`;

          // Dosya adına göre doc_type belirle
          const fileDocType = this.detectDocTypeFromFileName(fileName, docType);

          // Dosyayı yükle
          const result = await this.uploadSingleFile(
            tenderId,
            fileDocType, // Dosya adına göre belirlenen doc_type
            buffer,
            fileExt,
            fileName,
            uniqueSourceUrl, // Unique URL
            true // ZIP'ten çıkarıldı
          );

          uploadResults.push(result);
        }
      } else if (ext === '.rar') {
        // RAR için unrar komutu dene
        try {
          await execAsync(`unrar x -o+ "${zipPath}" "${extractDir}/"`);

          // Açılan dosyaları bul
          const extractedFiles = await this.walkDirectory(extractDir);
          logger.info(`RAR'dan ${extractedFiles.length} dosya çıkarıldı`);

          for (const filePath of extractedFiles) {
            const fileName = path.basename(filePath);
            const fileExt = path.extname(fileName).toLowerCase();

            if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
              logger.warn(`Desteklenmeyen dosya atlandı: ${fileName}`);
              continue;
            }

            const buffer = await fs.readFile(filePath);
            const result = await this.uploadSingleFile(tenderId, docType, buffer, fileExt, fileName, sourceUrl, true);
            uploadResults.push(result);
          }
        } catch (e) {
          logger.warn('RAR açılamadı (unrar yüklü olmayabilir)', { error: e.message });
          // RAR'ı direkt yükle
          const buffer = await fs.readFile(zipPath);
          const result = await this.uploadSingleFile(
            tenderId,
            docType,
            buffer,
            '.rar',
            `${this.getDisplayName(docType)}.rar`,
            sourceUrl
          );
          return [result];
        }
      }

      // ZIP/RAR dosyasının kendisini de kaydet (parent olarak)
      const archiveBuffer = await fs.readFile(zipPath);
      const archiveResult = await this.uploadSingleFile(
        tenderId,
        docType,
        archiveBuffer,
        ext,
        this.getDisplayName(docType) + ext,
        sourceUrl,
        false,
        true
      );

      // Çıkarılan dosyaların parent_doc_id'sini güncelle
      if (uploadResults.length > 0 && archiveResult.documentId) {
        await pool.query(`UPDATE documents SET parent_doc_id = $1 WHERE id = ANY($2::int[])`, [
          archiveResult.documentId,
          uploadResults.map((r) => r.documentId),
        ]);
      }

      logger.info(`ZIP'ten ${uploadResults.length} dosya yüklendi`);
      return [archiveResult, ...uploadResults];
    } catch (error) {
      logger.error('ZIP açma hatası', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Tek dosyayı Supabase Storage'a yükle ve DB'ye kaydet
   */
  async uploadSingleFile(
    tenderId,
    docType,
    buffer,
    extension,
    displayName,
    sourceUrl,
    isExtracted = false,
    isZipParent = false
  ) {
    // Unique dosya adı oluştur
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const timestamp = Date.now();
    const safeFileName = this.sanitizeFileName(displayName || `doc-${uniqueId}`);

    // Storage path için URL-safe dosya adı (Türkçe karakterleri ve boşlukları encode et)
    const urlSafeFileName = this.makeUrlSafe(safeFileName);
    const storageFileName = `${timestamp}-${uniqueId}-${urlSafeFileName}${extension}`;

    // Storage path: tenders/{tenderId}/{docType}/{filename}
    const storagePath = `tenders/${tenderId}/${docType}/${storageFileName}`;

    // Content-Type belirle
    const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';

    try {
      // Supabase kontrolü
      if (!supabase || !supabase.storage) {
        throw new Error(
          "Supabase client veya storage mevcut değil. Lütfen SUPABASE_SERVICE_KEY environment variable'ını kontrol edin."
        );
      }

      // 1. Supabase Storage'a yükle
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        // Detaylı hata logla
        logger.error('Supabase Storage yükleme hatası', {
          error: uploadError.message,
          code: uploadError.statusCode,
          storagePath,
          fileSize: buffer.length,
          contentType,
        });
        throw new Error(
          `Storage yükleme hatası: ${uploadError.message} (Code: ${uploadError.statusCode || 'unknown'})`
        );
      }

      if (!uploadData || !uploadData.path) {
        throw new Error('Supabase upload başarılı görünüyor ama data dönmedi');
      }

      logger.info(`Supabase'e yüklendi: ${storagePath} (${buffer.length} bytes, path: ${uploadData.path})`);

      // 2. Public URL al
      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

      const storageUrl = urlData?.publicUrl || null;

      // 3. documents tablosuna kaydet (duplike kontrolü ile)
      const insertResult = await pool.query(
        `INSERT INTO documents (
          tender_id, filename, original_filename, file_type, file_size,
          file_path, storage_path, storage_url, source_url, doc_type,
          source_type, is_extracted, processing_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (tender_id, original_filename) WHERE tender_id IS NOT NULL
        DO UPDATE SET 
          storage_path = EXCLUDED.storage_path,
          storage_url = EXCLUDED.storage_url,
          file_size = EXCLUDED.file_size,
          updated_at = NOW()
        RETURNING id, storage_path, storage_url, (xmax = 0) as is_new`,
        [
          tenderId,
          storageFileName,
          displayName,
          extension.replace('.', ''),
          buffer.length,
          storagePath, // file_path olarak storage_path kullan
          storagePath,
          storageUrl,
          sourceUrl,
          docType,
          'download',
          isExtracted,
          'pending', // Kuyrukta bekliyor
        ]
      );

      const insertedDoc = insertResult.rows[0];

      // Kayıt kontrolü
      if (!insertedDoc || !insertedDoc.id) {
        throw new Error('Döküman veritabanına kaydedilemedi');
      }

      // Duplike uyarısı
      if (!insertedDoc.is_new) {
        logger.warn(`Döküman zaten mevcut, güncellendi: ${displayName}`);
      }

      logger.debug(
        `Döküman DB'ye kaydedildi: ID=${insertedDoc.id}, storage_path=${insertedDoc.storage_path}, storage_url=${insertedDoc.storage_url || 'NULL'}`
      );

      return {
        documentId: insertedDoc.id,
        storagePath: insertedDoc.storage_path,
        storageUrl: insertedDoc.storage_url,
        fileName: displayName,
        fileSize: buffer.length,
        fileType: extension,
        isExtracted,
        isZipParent,
      };
    } catch (error) {
      logger.error(`Dosya yükleme hatası: ${displayName}`, { error: error.message, stack: error.stack, displayName });
      throw error;
    }
  }

  /**
   * Belirli bir dökümanı kuyruğa ekle (analiz için)
   * ALTIN KURAL: ZIP dosyaları asla analize gönderilmez!
   */
  async addToQueue(documentId) {
    // Önce dökümanı kontrol et
    const checkResult = await pool.query(
      `SELECT id, original_filename, file_type, is_extracted 
       FROM documents WHERE id = $1`,
      [documentId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error(`Döküman bulunamadı: ${documentId}`);
    }

    const doc = checkResult.rows[0];

    // ZIP dosyaları analize gönderilemez - ALTIN KURAL
    if (doc.file_type === 'zip' || doc.file_type === '.zip') {
      throw new Error(`ZIP dosyaları analize gönderilemez. Önce çıkarılmalı: ${doc.original_filename}`);
    }

    const result = await pool.query(
      `UPDATE documents 
       SET processing_status = 'queued'
       WHERE id = $1 
       RETURNING id, original_filename, processing_status`,
      [documentId]
    );

    return result.rows[0];
  }

  /**
   * Birden fazla dökümanı kuyruğa ekle
   * ALTIN KURAL: ZIP dosyaları otomatik olarak atlanır!
   */
  async addMultipleToQueue(documentIds) {
    // ZIP dosyalarını hariç tut - ALTIN KURAL
    const result = await pool.query(
      `UPDATE documents 
       SET processing_status = 'queued'
       WHERE id = ANY($1::int[])
         AND file_type NOT IN ('zip', '.zip')
       RETURNING id, original_filename, processing_status`,
      [documentIds]
    );

    // Atlanan ZIP'leri logla
    if (result.rows.length < documentIds.length) {
      const skippedCount = documentIds.length - result.rows.length;
      logger.info('ZIP files skipped from queue', {
        module: 'document-storage',
        skippedCount,
        queuedCount: result.rows.length,
      });
    }

    return result.rows;
  }

  /**
   * İhale için indirilen dökümanları listele
   */
  async getDownloadedDocuments(tenderId) {
    const result = await pool.query(
      `SELECT 
        id, tender_id, filename, original_filename, file_type, file_size,
        storage_path, storage_url, source_url, doc_type, source_type,
        is_extracted, parent_doc_id, processing_status, created_at,
        analysis_result, extracted_text
       FROM documents 
       WHERE tender_id = $1 AND source_type IN ('download', 'content')
       ORDER BY source_type, doc_type, is_extracted, created_at`,
      [tenderId]
    );

    return result.rows;
  }

  /**
   * Döküman için signed URL al (private bucket için)
   */
  async getSignedUrl(documentId, expiresIn = 3600) {
    const docResult = await pool.query('SELECT storage_path FROM documents WHERE id = $1', [documentId]);

    if (docResult.rows.length === 0) {
      throw new Error(`Döküman bulunamadı: ${documentId}`);
    }

    const { storage_path } = docResult.rows[0];

    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(storage_path, expiresIn);

    if (error) {
      throw new Error(`Signed URL oluşturma hatası: ${error.message}`);
    }

    return data.signedUrl;
  }

  // ===== HELPER METHODS =====

  /**
   * URL'den dosya uzantısını çıkar
   */
  getExtensionFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      const ext = path.extname(pathname).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) ? ext : null;
    } catch {
      // URL'de uzantı yoksa içerikten tahmin et
      if (url.includes('idari') || url.includes('teknik')) return '.pdf';
      if (url.includes('.zip')) return '.zip';
      return null;
    }
  }

  /**
   * Doc type için görüntüleme adı
   */
  getDisplayName(docType) {
    // admin_spec_2 -> İdari Şartname 2
    for (const [key, value] of Object.entries(DOC_TYPE_NAMES)) {
      if (docType === key) return value;
      if (docType.startsWith(`${key}_`)) {
        const num = docType.replace(`${key}_`, '');
        return `${value} ${num}`;
      }
    }
    return docType.replace(/_/g, ' ');
  }

  /**
   * Dosya içeriğinden gerçek dosya türünü tespit et (magic bytes)
   */
  detectFileType(buffer) {
    if (!buffer || buffer.length < 4) return null;

    // Magic bytes kontrolü
    const _magicBytes = {
      // PDF: %PDF
      pdf: [0x25, 0x50, 0x44, 0x46],
      // ZIP: PK
      zip: [0x50, 0x4b, 0x03, 0x04],
      // RAR: Rar!
      rar: [0x52, 0x61, 0x72, 0x21],
      // PNG: .PNG
      png: [0x89, 0x50, 0x4e, 0x47],
      // JPEG: FFD8FF
      jpg: [0xff, 0xd8, 0xff],
      // DOCX/XLSX (Office Open XML - aslında ZIP)
      docx: [0x50, 0x4b, 0x03, 0x04],
    };

    // PDF kontrolü
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return '.pdf';
    }

    // ZIP kontrolü (ZIP, DOCX, XLSX, PPTX hepsi aynı magic bytes - PK)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      // ZIP içeriğine bakarak DOCX/XLSX/PPTX mi gerçek ZIP mi anla
      try {
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries().map((e) => e.entryName);

        // Office Open XML dosyaları [Content_Types].xml içerir
        if (entries.includes('[Content_Types].xml')) {
          // Word, Excel, PowerPoint ayrımı
          if (entries.some((e) => e.startsWith('word/'))) {
            logger.debug('DOCX tespit edildi (Office Open XML - Word)');
            return '.docx';
          }
          if (entries.some((e) => e.startsWith('xl/'))) {
            logger.debug('XLSX tespit edildi (Office Open XML - Excel)');
            return '.xlsx';
          }
          if (entries.some((e) => e.startsWith('ppt/'))) {
            logger.debug('PPTX tespit edildi (Office Open XML - PowerPoint)');
            return '.pptx';
          }
          // Bilinmeyen Office formatı, docx olarak varsay
          logger.debug('Office Open XML tespit edildi, docx olarak işleniyor');
          return '.docx';
        }

        // Gerçek ZIP dosyası
        logger.debug('ZIP formatı tespit edildi (gerçek arşiv)');
        return '.zip';
      } catch (e) {
        // ZIP parse hatası, yine de ZIP olarak işle
        logger.debug('ZIP parse hatası, ZIP olarak işleniyor:', e.message);
        return '.zip';
      }
    }

    // RAR kontrolü
    if (buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21) {
      return '.rar';
    }

    // PNG kontrolü
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return '.png';
    }

    // JPEG kontrolü
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return '.jpg';
    }

    // OLE Compound File (DOC, XLS, PPT - eski Office formatları)
    // Magic bytes: D0 CF 11 E0 A1 B1 1A E1
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      logger.debug('OLE Compound File tespit edildi (eski Office formatı)');
      // İçeriğe bakarak DOC/XLS/PPT ayrımı zor, URL'den uzantıya bakacağız
      return null; // getExtensionFromUrl'e bırak
    }

    // GIF kontrolü
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return '.gif';
    }

    // BMP kontrolü
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return '.bmp';
    }

    // TIFF kontrolü
    if (
      (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
      (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
    ) {
      return '.tiff';
    }

    return null;
  }

  /**
   * Dosya adını güvenli hale getir (Türkçe karakter temizleme YOK)
   */
  sanitizeFileName(fileName) {
    // Sadece tehlikeli karakterleri temizle, Türkçe karakter kalsın
    return fileName
      .replace(/[<>:"/\\|?*]/g, '') // Dosya sistemi için tehlikeli karakterler
      .replace(/\s+/g, ' ') // Fazla boşlukları tek boşluğa indir
      .trim()
      .substring(0, 200); // Max 200 karakter
  }

  /**
   * Dosya adını URL-safe hale getir (Supabase Storage için)
   * Türkçe karakterleri ve boşlukları encode eder
   */
  makeUrlSafe(fileName) {
    // Türkçe karakterleri normalize et
    const turkishMap = {
      ç: 'c',
      Ç: 'C',
      ğ: 'g',
      Ğ: 'G',
      ı: 'i',
      İ: 'I',
      ö: 'o',
      Ö: 'O',
      ş: 's',
      Ş: 'S',
      ü: 'u',
      Ü: 'U',
    };

    let safe = fileName;
    // Türkçe karakterleri değiştir
    for (const [turkish, latin] of Object.entries(turkishMap)) {
      safe = safe.replace(new RegExp(turkish, 'g'), latin);
    }

    // Boşlukları tire ile değiştir
    safe = safe.replace(/\s+/g, '-');

    // URL-safe olmayan karakterleri encode et veya kaldır
    safe = safe
      .replace(/[^a-zA-Z0-9\-_.]/g, '-') // Sadece alfanumerik, tire, alt çizgi, nokta
      .replace(/-+/g, '-') // Birden fazla tireyi tek tireye indir
      .replace(/^-|-$/g, ''); // Başta ve sonda tire varsa kaldır

    return safe || 'file'; // Boşsa default isim
  }

  /**
   * Dizini recursive olarak tara
   */
  async walkDirectory(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walkDirectory(fullPath)));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new DocumentStorageService();
