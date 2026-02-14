/**
 * AI Analyzer Module - Public API
 * v9.0 - UNIFIED PIPELINE (TEK MERKEZİ SİSTEM)
 *
 * ÖNERİLEN KULLANIM:
 *   import { analyzeDocument } from './services/ai-analyzer/unified-pipeline.js';
 *   const result = await analyzeDocument(filePath, { onProgress });
 *
 * BU DOSYA sadece geriye uyumluluk ve helper fonksiyonlar için kalıyor.
 * YENİ KOD İÇİN unified-pipeline.js KULLANIN!
 */

import path from 'node:path';
import logger from '../../utils/logger.js';

// v9.0: TEK MERKEZİ SİSTEM - Re-export unified pipeline
import { analyzeDocument, checkPipelineHealth } from './unified-pipeline.js';
export { analyzeDocument, checkPipelineHealth };

// Geriye uyumluluk için eski pipeline (DEPRECATED - kullanmayın!)
import { analyze, chunk, extract, runPipeline, runPipelineBatch } from './pipeline/index.js';
/** @deprecated Use analyzeDocument from unified-pipeline.js instead */
export { runPipeline, runPipelineBatch, extract, chunk, analyze };

// Desteklenen dosya formatları - GENİŞLETİLMİŞ
export const SUPPORTED_FORMATS = {
  pdf: ['.pdf'],
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tiff', '.tif', '.bmp'],
  document: ['.docx', '.doc', '.rtf', '.odt'],
  spreadsheet: ['.xlsx', '.xls', '.ods', '.csv'],
  presentation: ['.pptx', '.ppt', '.odp'],
  text: ['.txt', '.xml', '.json'],
  archive: ['.zip', '.rar'],
};

/**
 * Dosya türünü belirle (uzantıya göre)
 * @param {string} filename - Dosya adı
 * @returns {string} Dosya türü: pdf, image, document, spreadsheet, presentation, text, unknown
 */
export function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();

  if (SUPPORTED_FORMATS.pdf.includes(ext)) return 'pdf';
  if (SUPPORTED_FORMATS.image.includes(ext)) return 'image';
  if (SUPPORTED_FORMATS.document.includes(ext)) return 'document';
  if (SUPPORTED_FORMATS.spreadsheet.includes(ext)) return 'spreadsheet';
  if (SUPPORTED_FORMATS.presentation.includes(ext)) return 'presentation';
  if (SUPPORTED_FORMATS.text.includes(ext)) return 'text';
  if (SUPPORTED_FORMATS.archive.includes(ext)) return 'archive';

  return 'unknown';
}

/**
 * Herhangi bir dosyayı analiz et
 * @deprecated Use analyzeDocument from unified-pipeline.js instead
 * @param {string} filePath - Dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
export async function analyzeFile(filePath, onProgress) {
  logger.warn('analyzeFile is DEPRECATED - use analyzeDocument from unified-pipeline.js', { module: 'ai-analyzer' });

  // v9.0: Unified Pipeline'a yönlendir
  const result = await analyzeDocument(filePath, { onProgress });

  // Eski format uyumluluğu
  return {
    success: result.success,
    toplam_sayfa: result.extraction?.pages || 1,
    analiz: result.analysis,
    kaynak: result.meta?.provider_used || 'unified',
  };
}

// Export utils (hala gerekli olabilir)
export * from './utils/parser.js';

// Default export - v9.0 Unified System
export default {
  // v9.0: TEK MERKEZİ SİSTEM (ÖNERİLEN)
  analyzeDocument,
  checkPipelineHealth,

  // Helpers
  getFileType,
  SUPPORTED_FORMATS,

  // Geriye uyumluluk (DEPRECATED)
  analyzeFile,
  runPipeline,
};
