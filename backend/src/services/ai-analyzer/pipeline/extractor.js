/**
 * Layer 1: Extractor - Veri Kaybı Sıfır Extraction
 *
 * Her dosya türü için optimize edilmiş veri çıkarma.
 * Ham veri yapısı korunur, AI işlemi yapılmaz.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import logger from '../../../utils/logger.js';

/**
 * Extraction sonuç yapısı
 * @typedef {Object} ExtractionResult
 * @property {string} type - Dosya türü (pdf, xlsx, docx, image, text)
 * @property {string} text - Düz metin içeriği
 * @property {Object} structured - Yapılandırılmış veri (tablolar, başlıklar)
 * @property {Object} metadata - Dosya metadata'sı
 * @property {boolean} needsOcr - OCR gerekli mi
 */

/**
 * ZIP dosyasını aç ve dosya listesini döndür
 * @param {string} zipPath - ZIP dosya yolu
 * @returns {Promise<{extractDir: string, files: Array}>}
 */
export async function extractZip(zipPath) {
  const extractDir = path.join(path.dirname(zipPath), `extracted_${Date.now()}`);
  // Genişletilmiş desteklenen uzantılar
  const supportedExtensions = [
    // Dökümanlar
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.rtf',
    '.odt',
    '.ods',
    '.odp',
    // Metin
    '.txt',
    '.csv',
    '.xml',
    '.json',
    // Görseller
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.tiff',
    '.tif',
    '.bmp',
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
            files.push({
              path: fullPath,
              ext,
              name: item,
              size: stat.size,
            });
          }
        }
      }
      return files;
    };

    const files = findFiles(extractDir);

    logger.info('ZIP extracted', {
      module: 'extractor',
      fileCount: files.length,
      files: files.map((f) => f.name),
    });

    return { extractDir, files };
  } catch (error) {
    try {
      fs.rmSync(extractDir, { recursive: true, force: true });
    } catch {}
    throw new Error(`ZIP açılamadı: ${error.message}`);
  }
}

/**
 * PDF metin kalitesini değerlendir
 * Tablo yapısının bozulup bozulmadığını kontrol eder
 * @param {string} text - Çıkarılan metin
 * @returns {Object} Kalite metrikleri
 */
function assessPdfTextQuality(text) {
  if (!text || text.length < 100) {
    return { score: 0, issues: ['insufficient_text'], needsVision: true };
  }

  const issues = [];
  let score = 100;

  // 1. Tablo benzeri yapı tespiti (sayılar ve birimler yan yana)
  // Gramaj tabloları genellikle: "Dana Eti 150 gr" veya "150 gram" içerir
  const tablePatterns = [/\d+\s*(gr|gram|kg|ml|lt|adet|porsiyon)/gi, /\d+[.,]\d+\s*(TL|₺|lira)/gi, /madde\s*\d+[.:]/gi];

  let tableHints = 0;
  for (const pattern of tablePatterns) {
    const matches = text.match(pattern) || [];
    tableHints += matches.length;
  }

  // 2. Satır karışıklığı tespiti
  // pdf-parse tabloları bozduğunda satırlar birbirine girer
  // Örn: "Dana Eti150grTavuk120gr" gibi boşluksuz birleşimler
  const mergedPatterns = /[a-zığüşöç]{3,}\d{2,}[a-zığüşöç]{2,}/gi;
  const mergedMatches = text.match(mergedPatterns) || [];

  if (mergedMatches.length > 5) {
    issues.push('merged_columns');
    score -= 30;
  }

  // 3. Anormal satır uzunluğu dağılımı
  // Normal metin: satırlar 40-120 karakter arası
  // Bozuk tablo: çok kısa veya çok uzun satırlar
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const lineLengths = lines.map((l) => l.length);
  const avgLength = lineLengths.reduce((a, b) => a + b, 0) / lineLengths.length;
  const veryShortLines = lineLengths.filter((l) => l < 10).length;
  const veryLongLines = lineLengths.filter((l) => l > 200).length;

  if (veryShortLines > lines.length * 0.3) {
    issues.push('fragmented_lines');
    score -= 20;
  }

  if (veryLongLines > lines.length * 0.2) {
    issues.push('merged_lines');
    score -= 20;
  }

  // 4. Sayısal değer yoğunluğu (catering şartnamelerinde yüksek olmalı)
  const numberMatches = text.match(/\d+[.,]?\d*/g) || [];
  const numberDensity = numberMatches.length / (text.length / 1000);

  // Yüksek sayı yoğunluğu + düşük kalite = muhtemelen bozuk tablo
  if (numberDensity > 15 && score < 80) {
    issues.push('possible_corrupted_table');
    score -= 20;
  }

  // 5. Tekrarlayan pattern'ler (tablo satırları)
  // "MADDE" veya sıra numaraları çoksa tablo var demektir
  const maddeCount = (text.match(/madde\s*\d/gi) || []).length;
  const siraCount = (text.match(/^\s*\d{1,3}[.)]\s/gm) || []).length;

  const hasTableStructure = tableHints > 10 || maddeCount > 5 || siraCount > 10;

  // Final karar
  const needsVision = score < 60 || (hasTableStructure && score < 80);

  return {
    score: Math.max(0, score),
    issues,
    hasTableStructure,
    tableHints,
    mergedColumns: mergedMatches.length,
    avgLineLength: Math.round(avgLength),
    numberDensity: numberDensity.toFixed(2),
    needsVision,
  };
}

/**
 * PDF'den veri çıkar
 * @param {string} pdfPath - PDF dosya yolu
 * @returns {Promise<ExtractionResult>}
 */
export async function extractPdf(pdfPath) {
  const startTime = Date.now();
  const stat = fs.statSync(pdfPath);
  const dataBuffer = await fs.promises.readFile(pdfPath);

  let text = '';
  let pageCount = 0;
  let needsOcr = false;
  let textQuality = null;
  const tables = [];

  try {
    const data = await pdfParse(dataBuffer);
    text = data.text || '';
    pageCount = data.numpages || 0;

    // Taranmış PDF kontrolü: büyük dosya ama az metin
    const fileSizeKB = stat.size / 1024;
    const textDensity = text.length / fileSizeKB;

    if (textDensity < 10 && fileSizeKB > 100) {
      needsOcr = true;
      logger.info('PDF needs OCR: Low text density (scanned)', {
        module: 'extractor',
        fileSizeKB: Math.round(fileSizeKB),
        textLength: text.length,
        textDensity: textDensity.toFixed(2),
      });
    }

    // Zero-Loss: Metin kalitesi değerlendirmesi
    // Tablo yapısı bozulmuş olabilir, Vision'a yönlendir
    if (!needsOcr && text.length > 500) {
      textQuality = assessPdfTextQuality(text);

      if (textQuality.needsVision) {
        needsOcr = true;
        logger.info('PDF needs Vision: Text quality issues detected', {
          module: 'extractor',
          score: textQuality.score,
          issues: textQuality.issues,
          hasTableStructure: textQuality.hasTableStructure,
          tableHints: textQuality.tableHints,
        });
      } else if (textQuality.hasTableStructure) {
        // Tablo var ama kalite yeterli - uyarı log'u
        logger.info('PDF has table structure, text quality acceptable', {
          module: 'extractor',
          score: textQuality.score,
          tableHints: textQuality.tableHints,
        });
      }
    }
  } catch (error) {
    needsOcr = true;
    logger.warn('PDF parse failed, needs OCR', { error: error.message });
  }

  const duration = Date.now() - startTime;

  return {
    type: 'pdf',
    text: text.trim(),
    structured: {
      pageCount,
      tables,
      textQuality, // Kalite metrikleri de döndür
    },
    metadata: {
      fileName: path.basename(pdfPath),
      fileSize: stat.size,
      extractionTime: duration,
    },
    needsOcr,
  };
}

/**
 * Excel'den veri çıkar - YAPIYI KORU
 * @param {string} excelPath - Excel dosya yolu
 * @returns {Promise<ExtractionResult>}
 */
export async function extractExcel(excelPath) {
  const startTime = Date.now();
  const stat = fs.statSync(excelPath);

  const workbook = XLSX.readFile(excelPath);
  const sheets = [];
  let fullText = '';

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    // JSON olarak yapıyı koru
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const csvData = XLSX.utils.sheet_to_csv(sheet);

    // Başlık satırını tespit et
    const headerRow = jsonData[0] || [];
    const dataRows = jsonData.slice(1);

    // Sütun bilgilerini çıkar
    const columns = headerRow.map((col, idx) => ({
      index: idx,
      name: String(col).trim(),
      sampleValues: dataRows
        .slice(0, 3)
        .map((row) => row[idx])
        .filter((v) => v !== ''),
    }));

    sheets.push({
      name: sheetName,
      rowCount: jsonData.length,
      columnCount: headerRow.length,
      columns,
      data: jsonData, // Ham veri - kayıp yok
      csv: csvData,
    });

    fullText += `\n=== Sayfa: ${sheetName} (${jsonData.length} satır, ${headerRow.length} sütun) ===\n`;
    fullText += csvData + '\n';
  }

  const duration = Date.now() - startTime;

  logger.info('Excel extracted', {
    module: 'extractor',
    sheetCount: sheets.length,
    totalRows: sheets.reduce((sum, s) => sum + s.rowCount, 0),
    duration: `${duration}ms`,
  });

  return {
    type: 'xlsx',
    text: fullText.trim(),
    structured: {
      sheets,
      sheetCount: sheets.length,
    },
    metadata: {
      fileName: path.basename(excelPath),
      fileSize: stat.size,
      extractionTime: duration,
    },
    needsOcr: false,
  };
}

/**
 * Word'den veri çıkar
 * @param {string} docPath - Word dosya yolu
 * @returns {Promise<ExtractionResult>}
 */
export async function extractWord(docPath) {
  const startTime = Date.now();
  const stat = fs.statSync(docPath);
  const ext = path.extname(docPath).toLowerCase();

  let text = '';
  let html = '';
  const tables = [];

  if (ext === '.docx') {
    // DOCX - mammoth kullan (HTML ile yapıyı koru)
    const result = await mammoth.convertToHtml({ path: docPath });
    html = result.value;

    // HTML'den düz metin çıkar
    const textResult = await mammoth.extractRawText({ path: docPath });
    text = textResult.value;

    // HTML'den tabloları çıkar
    const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
    for (const tableHtml of tableMatches) {
      tables.push({
        html: tableHtml,
        rowCount: (tableHtml.match(/<tr/gi) || []).length,
      });
    }
  } else if (ext === '.doc') {
    // DOC - LibreOffice veya antiword
    try {
      const tmpDir = path.dirname(docPath);
      execSync(`soffice --headless --convert-to txt:Text --outdir "${tmpDir}" "${docPath}"`, {
        timeout: 60000,
        stdio: 'pipe',
      });
      const txtPath = path.join(tmpDir, path.basename(docPath, ext) + '.txt');
      if (fs.existsSync(txtPath)) {
        text = fs.readFileSync(txtPath, 'utf-8');
        fs.unlinkSync(txtPath);
      }
    } catch {
      // Fallback: antiword
      try {
        text = execSync(`antiword "${docPath}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      } catch {
        throw new Error('DOC dosyası okunamadı');
      }
    }
  }

  const duration = Date.now() - startTime;

  return {
    type: 'docx',
    text: text.trim(),
    structured: {
      html,
      tables,
      tableCount: tables.length,
    },
    metadata: {
      fileName: path.basename(docPath),
      fileSize: stat.size,
      extractionTime: duration,
    },
    needsOcr: false,
  };
}

/**
 * Metin dosyasından veri çıkar
 * @param {string} txtPath - Metin dosya yolu
 * @returns {Promise<ExtractionResult>}
 */
export async function extractText(txtPath) {
  const stat = fs.statSync(txtPath);
  const text = fs.readFileSync(txtPath, 'utf-8');

  return {
    type: 'text',
    text: text.trim(),
    structured: {
      lineCount: text.split('\n').length,
    },
    metadata: {
      fileName: path.basename(txtPath),
      fileSize: stat.size,
      extractionTime: 0,
    },
    needsOcr: false,
  };
}

/**
 * Görsel için extraction (sadece metadata, OCR gerekli)
 * @param {string} imagePath - Görsel dosya yolu
 * @returns {Promise<ExtractionResult>}
 */
export async function extractImage(imagePath) {
  const stat = fs.statSync(imagePath);

  return {
    type: 'image',
    text: '',
    structured: {},
    metadata: {
      fileName: path.basename(imagePath),
      fileSize: stat.size,
      extractionTime: 0,
    },
    needsOcr: true,
  };
}

/**
 * Herhangi bir dosyayı extract et
 * @param {string} filePath - Dosya yolu
 * @returns {Promise<ExtractionResult>}
 */
export async function extract(filePath) {
  // Gerçek dosya türünü tespit et
  const realType = await fileTypeFromFile(filePath).catch(() => null);
  const ext = path.extname(filePath).toLowerCase();

  // ZIP kontrolü
  if (realType?.ext === 'zip' || realType?.mime === 'application/zip') {
    const { extractDir, files } = await extractZip(filePath);

    // Her dosyayı extract et
    const results = [];
    for (const file of files) {
      try {
        const result = await extract(file.path);
        results.push({
          fileName: file.name,
          ...result,
        });
      } catch (error) {
        logger.warn('File extraction failed', { file: file.name, error: error.message });
      }
    }

    // Temizle
    try {
      fs.rmSync(extractDir, { recursive: true, force: true });
    } catch {}

    return {
      type: 'zip',
      text: results.map((r) => r.text).join('\n\n---\n\n'),
      structured: {
        files: results,
        fileCount: results.length,
      },
      metadata: {
        fileName: path.basename(filePath),
        fileSize: fs.statSync(filePath).size,
        extractionTime: 0,
      },
      needsOcr: results.some((r) => r.needsOcr),
    };
  }

  // Dosya türüne göre extract
  if (ext === '.pdf' || realType?.ext === 'pdf') {
    return extractPdf(filePath);
  }
  if (['.xlsx', '.xls'].includes(ext) || ['xlsx', 'xls'].includes(realType?.ext)) {
    return extractExcel(filePath);
  }
  if (['.docx', '.doc'].includes(ext) || ['docx', 'doc'].includes(realType?.ext)) {
    return extractWord(filePath);
  }
  if (['.txt', '.csv'].includes(ext)) {
    return extractText(filePath);
  }
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
    return extractImage(filePath);
  }

  throw new Error(`Desteklenmeyen dosya formatı: ${ext}`);
}

export default {
  extract,
  extractZip,
  extractPdf,
  extractExcel,
  extractWord,
  extractText,
  extractImage,
};
