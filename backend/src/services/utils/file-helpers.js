/**
 * File Helper Utilities - Dosya tipi algılama, sanitize, URL-safe dönüşüm
 * document-storage.js'den extract edildi (refactoring)
 * 
 * Bu fonksiyonlar pure utility'lerdir - hiçbir side effect yoktur.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import logger from '../../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Desteklenen dosya uzantıları - GENİŞLETİLMİŞ LİSTE
export const SUPPORTED_EXTENSIONS = [
  // Dökümanlar
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.rtf', '.odt', '.ods', '.odp',
  // Arşivler
  '.zip', '.rar', '.7z',
  // Görseller
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp',
  // Metin
  '.txt', '.csv', '.xml', '.json',
  // Teknik dosyalar (sadece sakla, analiz etme)
  '.dwg', '.dxf',
];

// Content-Type mapping - GENİŞLETİLMİŞ
export const CONTENT_TYPES = {
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

// Doc type display names
export const DOC_TYPE_NAMES = {
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

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dosya içeriğinden gerçek dosya türünü tespit et (magic bytes)
 * @param {Buffer} buffer - Dosya buffer'ı
 * @returns {string|null} Dosya uzantısı (.pdf, .docx, vb.) veya null
 */
export function detectFileType(buffer) {
  if (!buffer || buffer.length < 4) return null;

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
 * URL'den dosya uzantısını çıkar
 * @param {string} url - Dosya URL'si
 * @returns {string|null} Dosya uzantısı veya null
 */
export function getExtensionFromUrl(url) {
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
 * @param {string} docType - Doküman tipi kodu
 * @returns {string} Görüntüleme adı
 */
export function getDisplayName(docType) {
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
 * Dosya adını güvenli hale getir (Türkçe karakter temizleme YOK)
 * @param {string} fileName - Orijinal dosya adı
 * @returns {string} Güvenli dosya adı
 */
export function sanitizeFileName(fileName) {
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
 * @param {string} fileName - Orijinal dosya adı
 * @returns {string} URL-safe dosya adı
 */
export function makeUrlSafe(fileName) {
  // Türkçe karakterleri normalize et
  const turkishMap = {
    ç: 'c', Ç: 'C',
    ğ: 'g', Ğ: 'G',
    ı: 'i', İ: 'I',
    ö: 'o', Ö: 'O',
    ş: 's', Ş: 'S',
    ü: 'u', Ü: 'U',
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
 * @param {string} dir - Dizin yolu
 * @returns {Promise<string[]>} Dosya yolları listesi
 */
export async function walkDirectory(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Sleep helper
 * @param {number} ms - Bekleme süresi (milisaniye)
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
