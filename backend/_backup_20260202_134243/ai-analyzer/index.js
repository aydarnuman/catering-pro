/**
 * AI Analyzer Module - Public API
 *
 * Tüm döküman analiz fonksiyonlarını tek noktadan export eder.
 *
 * Kullanım:
 *   import { analyzeFile, analyzePdf } from './services/ai-analyzer';
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import logger from '../../utils/logger.js';
import { analyzeImage, analyzeImageFile } from './analyzers/image.js';
import { analyzeDocx, analyzeDocxFile, analyzeExcel, analyzeExcelFile } from './analyzers/office.js';
import { analyzePdf, analyzePdfWithClaude } from './analyzers/pdf.js';
import { analyzeMenu, analyzeText, analyzeTextFile, analyzeWithClaude, normalizeCity } from './analyzers/text.js';
import { mergeDocumentResults } from './utils/parser.js';

// Desteklenen dosya formatları
export const SUPPORTED_FORMATS = {
  pdf: ['.pdf'],
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  document: ['.docx', '.doc'],
  spreadsheet: ['.xlsx', '.xls'],
  text: ['.txt', '.csv'],
};

/**
 * Dosya türünü belirle (uzantıya göre)
 * @param {string} filename - Dosya adı
 * @returns {string} Dosya türü: pdf, image, document, spreadsheet, text, unknown
 */
export function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();

  if (SUPPORTED_FORMATS.pdf.includes(ext)) return 'pdf';
  if (SUPPORTED_FORMATS.image.includes(ext)) return 'image';
  if (SUPPORTED_FORMATS.document.includes(ext)) return 'document';
  if (SUPPORTED_FORMATS.spreadsheet.includes(ext)) return 'spreadsheet';
  if (SUPPORTED_FORMATS.text.includes(ext)) return 'text';

  return 'unknown';
}

/**
 * ZIP dosyasını aç ve içindeki dosyaları bul
 * @param {string} zipPath - ZIP dosya yolu
 * @returns {Promise<{extractDir: string, files: Array}>}
 */
async function extractZipAndFindFiles(zipPath) {
  const extractDir = path.join(path.dirname(zipPath), `extracted_${Date.now()}`);
  const supportedExtensions = [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.txt',
    '.csv',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
  ];

  try {
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });

    const findFiles = (dir) => {
      let files = [];
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          files = files.concat(findFiles(fullPath));
        } else {
          const ext = path.extname(item).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            files.push({ path: fullPath, ext, name: item });
          }
        }
      }
      return files;
    };

    const files = findFiles(extractDir);
    return { extractDir, files };
  } catch {
    try {
      fs.rmSync(extractDir, { recursive: true, force: true });
    } catch {}
    return { extractDir: null, files: [] };
  }
}

/**
 * Herhangi bir dosyayı analiz et (ana dispatcher)
 * @param {string} filePath - Dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
export async function analyzeFile(filePath, onProgress) {
  logger.info('Starting file analysis', {
    module: 'ai-analyzer',
    action: 'analyzeFile',
    filePath,
  });

  // Gerçek dosya türünü tespit et
  const realType = await fileTypeFromFile(filePath).catch(() => null);
  const extensionType = getFileType(filePath);

  // ZIP dosyası kontrolü
  if (realType?.ext === 'zip' || realType?.mime === 'application/zip') {
    if (onProgress) {
      onProgress({ stage: 'extracting', message: 'ZIP dosyası açılıyor...' });
    }

    const { extractDir, files } = await extractZipAndFindFiles(filePath);

    if (files.length === 0) {
      if (extractDir) {
        try {
          fs.rmSync(extractDir, { recursive: true, force: true });
        } catch {}
      }
      throw new Error('ZIP içinde desteklenen dosya bulunamadı');
    }

    // Tüm dosyaları analiz et
    const allResults = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (onProgress) {
        onProgress({
          stage: 'analyzing',
          message: `ZIP içi: ${i + 1}/${files.length} - ${file.name}`,
          progress: Math.round((i / files.length) * 100),
        });
      }

      try {
        let result = null;

        if (file.ext === '.pdf') {
          result = await analyzePdf(file.path, null);
        } else if (['.doc', '.docx'].includes(file.ext)) {
          result = await analyzeDocx(file.path, null);
        } else if (['.xls', '.xlsx'].includes(file.ext)) {
          result = await analyzeExcel(file.path, null);
        } else if (['.txt', '.csv'].includes(file.ext)) {
          result = await analyzeTextFile(file.path, null);
        } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(file.ext)) {
          result = await analyzeImageFile(file.path, null);
        }

        if (result?.analiz) {
          allResults.push(result.analiz);
        }
      } catch {}
    }

    // Temizle
    try {
      fs.rmSync(extractDir, { recursive: true, force: true });
    } catch {}

    if (allResults.length === 0) {
      throw new Error('ZIP içindeki dosyalar analiz edilemedi');
    }

    // Sonuçları birleştir
    const combined = mergeDocumentResults(allResults);

    return {
      success: true,
      toplam_sayfa: files.length,
      analiz: combined,
      kaynak: 'zip',
      dosya_sayisi: files.length,
      dosyalar: files.map((f) => f.name),
    };
  }

  // Normal dosya türü işleme
  let fileType = extensionType;

  // Eğer uzantı PDF ama gerçek tür farklıysa
  if (extensionType === 'pdf' && realType && realType.ext !== 'pdf') {
    if (realType.ext === 'docx') fileType = 'document';
    else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(realType.ext)) fileType = 'image';
    else if (['xlsx', 'xls'].includes(realType.ext)) fileType = 'spreadsheet';
  }

  switch (fileType) {
    case 'pdf':
      return analyzePdf(filePath, onProgress);
    case 'image':
      return analyzeImageFile(filePath, onProgress);
    case 'document':
      return analyzeDocx(filePath, onProgress);
    case 'spreadsheet':
      return analyzeExcel(filePath, onProgress);
    case 'text':
      return analyzeTextFile(filePath, onProgress);
    default:
      throw new Error(`Desteklenmeyen dosya formatı: ${path.extname(filePath)}`);
  }
}

// Re-export all analyzers
export {
  analyzePdf,
  analyzePdfWithClaude,
  analyzeImage,
  analyzeImageFile,
  analyzeDocx,
  analyzeDocxFile,
  analyzeExcel,
  analyzeExcelFile,
  analyzeText,
  analyzeTextFile,
  analyzeWithClaude,
  analyzeMenu,
  normalizeCity,
};

// Export core
export { claudeClient } from './core/client.js';
// Export utils
export * from './utils/parser.js';

// Default export
export default {
  analyzeFile,
  analyzePdf,
  analyzePdfWithClaude,
  analyzeImage,
  analyzeImageFile,
  analyzeDocx,
  analyzeDocxFile,
  analyzeExcel,
  analyzeExcelFile,
  analyzeText,
  analyzeTextFile,
  analyzeWithClaude,
  analyzeMenu,
  normalizeCity,
  getFileType,
  SUPPORTED_FORMATS,
};
