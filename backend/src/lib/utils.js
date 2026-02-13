/**
 * Utility Functions
 * Tüm modüllerin kullanacağı ortak yardımcı fonksiyonlar
 */

import { TURKISH_CHAR_MAP, TURKISH_CITIES } from './constants.js';

// ============================================
// ASYNC HELPERS
// ============================================

/**
 * Promise tabanlı delay
 * @param {number} ms - Milisaniye
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry with exponential backoff
 * @param {Function} fn - Çalıştırılacak async fonksiyon
 * @param {Object} options - Retry ayarları
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(fn, options = {}) {
  const { maxAttempts = 3, backoffMs = 2000, multiplier = 1.5, onRetry = null } = options;

  let lastError;
  let currentBackoff = backoffMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        if (onRetry) {
          onRetry(error, attempt, currentBackoff);
        }
        await delay(currentBackoff);
        currentBackoff = Math.round(currentBackoff * multiplier);
      }
    }
  }

  throw lastError;
}

// ============================================
// STRING HELPERS
// ============================================

/**
 * Şehir normalize et
 * @param {string} text
 * @returns {string|null}
 */
export function normalizeCity(text) {
  if (!text) return null;
  const normalized = text.trim().toLocaleLowerCase('tr-TR');
  return TURKISH_CITIES.find((city) => normalized.includes(city.toLocaleLowerCase('tr-TR'))) || null;
}

/**
 * Dosya adını güvenli hale getir
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFileName(name) {
  if (!name) return 'unnamed';

  return (
    name
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Dosya adı sanitize için kontrol karakterleri kasıtlı
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Tehlikeli karakterler
      .replace(/\s+/g, '_') // Boşluklar
      .replace(/_+/g, '_') // Çoklu alt çizgi
      .replace(/^_|_$/g, '') // Başta/sonda alt çizgi
      .substring(0, 200)
  ); // Max uzunluk
}

/**
 * URL-safe dosya adı oluştur
 * @param {string} name
 * @returns {string}
 */
export function makeUrlSafe(name) {
  let result = name;

  // Türkçe karakterleri değiştir
  for (const [tr, en] of Object.entries(TURKISH_CHAR_MAP)) {
    result = result.replace(new RegExp(tr, 'g'), en);
  }

  return sanitizeFileName(result.toLowerCase());
}

/**
 * Türkçe karakterleri ASCII'ye dönüştür
 * @param {string} text
 * @returns {string}
 */
export function turkishToAscii(text) {
  return text
    .split('')
    .map((char) => TURKISH_CHAR_MAP[char] || char)
    .join('');
}

/**
 * Para formatı parse et (örn: "1.234.567,89 TL" -> 1234567.89)
 * @param {string} text
 * @returns {number|null}
 */
export function parseAmount(text) {
  if (!text) return null;

  // Sadece sayı ve nokta/virgül karakterlerini al
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  // Türk formatı: 1.234.567,89 -> 1234567.89
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');

  const amount = parseFloat(normalized);
  return Number.isNaN(amount) ? null : amount;
}

/**
 * Tarih parse et (çeşitli formatları destekler)
 * @param {string} text
 * @returns {Date|null}
 */
export function parseDate(text) {
  if (!text) return null;

  // dd.mm.yyyy veya dd/mm/yyyy formatı
  const dmyMatch = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }

  // yyyy-mm-dd formatı (ISO)
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(text);
  }

  // Native Date parse dene
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ============================================
// JSON HELPERS
// ============================================

/**
 * JSON'u güvenli şekilde parse et
 * @param {string} text
 * @param {any} fallback - Parse başarısız olursa döndürülecek değer
 * @returns {any}
 */
export function parseJsonSafe(text, fallback = null) {
  if (!text) return fallback;

  try {
    // İlk olarak direkt parse dene
    return JSON.parse(text);
  } catch {
    // JSON bloğu içeren metinden çıkarmaya çalış
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : fallback;
    } catch {
      return fallback;
    }
  }
}

/**
 * AI yanıtından JSON çıkar
 * @param {string} response
 * @returns {Object|null}
 */
export function extractJsonFromResponse(response) {
  if (!response) return null;

  // Markdown code block içinden çıkar
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return parseJsonSafe(codeBlockMatch[1]);
  }

  // Direkt JSON objesi
  return parseJsonSafe(response);
}

// ============================================
// FILE HELPERS
// ============================================

/**
 * Dosya uzantısını al
 * @param {string} filename
 * @returns {string}
 */
export function getExtension(filename) {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot).toLowerCase() : '';
}

/**
 * MIME type'dan uzantı al
 * @param {string} mimeType
 * @returns {string}
 */
export function getExtensionFromMime(mimeType) {
  const mimeMap = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'text/plain': '.txt',
    'application/json': '.json',
  };

  return mimeMap[mimeType] || '';
}

/**
 * Magic bytes ile dosya tipini tespit et
 * @param {Buffer} buffer
 * @returns {string|null}
 */
export function detectFileType(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return '.pdf';
  }

  // ZIP/DOCX/XLSX: PK
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return '.zip';
  }

  // RAR: Rar!
  if (buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21) {
    return '.rar';
  }

  // PNG: .PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return '.png';
  }

  // JPEG: FFD8FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg';
  }

  // GIF: GIF8
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return '.gif';
  }

  return null;
}

/**
 * ZIP mi Office dosyası mı kontrol et
 * @param {Array<string>} entryNames - ZIP içindeki dosya adları
 * @returns {{isZip: boolean, isDocx: boolean, isXlsx: boolean}}
 */
export function detectOfficeFormat(entryNames) {
  const lowerNames = entryNames.map((n) => n.toLowerCase());
  const hasContentTypes = lowerNames.some((n) => n.includes('[content_types].xml'));

  if (!hasContentTypes) {
    return { isZip: true, isDocx: false, isXlsx: false };
  }

  const isDocx = lowerNames.some((n) => n.includes('word/document.xml'));
  const isXlsx = lowerNames.some((n) => n.includes('xl/workbook.xml'));

  return { isZip: !isDocx && !isXlsx, isDocx, isXlsx };
}

// ============================================
// OBJECT HELPERS
// ============================================

/**
 * Object'i flat key-value'lara dönüştür
 * @param {Object} obj
 * @param {string} prefix
 * @returns {Object}
 */
export function flattenObject(obj, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * İki objeyi deep merge et
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
export function deepMerge(target, source) {
  const output = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (target[key] && typeof target[key] === 'object') {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = { ...source[key] };
      }
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Email geçerli mi kontrol et
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * URL geçerli mi kontrol et
 * @param {string} url
 * @returns {boolean}
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Maskelenmiş veri mi kontrol et
 * @param {string} text
 * @returns {boolean}
 */
export function isMaskedData(text) {
  if (!text) return false;
  return text.includes('***') || text.includes('•••');
}

// ============================================
// TIMING HELPERS
// ============================================

/**
 * İşlem süresi ölçümü için timer
 * @returns {{stop: function(): number}}
 */
export function createTimer() {
  const start = Date.now();
  return {
    stop: () => Date.now() - start,
    elapsed: () => Date.now() - start,
  };
}

/**
 * İşlem süresini formatla
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  delay,
  retryWithBackoff,
  normalizeCity,
  sanitizeFileName,
  makeUrlSafe,
  turkishToAscii,
  parseAmount,
  parseDate,
  parseJsonSafe,
  extractJsonFromResponse,
  getExtension,
  getExtensionFromMime,
  detectFileType,
  detectOfficeFormat,
  flattenObject,
  deepMerge,
  isValidEmail,
  isValidUrl,
  isMaskedData,
  createTimer,
  formatDuration,
};
