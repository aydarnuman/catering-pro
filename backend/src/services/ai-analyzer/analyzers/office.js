/**
 * Office Analyzer - Word ve Excel dosya analizi
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import logger from '../../../utils/logger.js';
import claudeClient from '../core/client.js';
import { buildTableAnalysisPrompt, buildTextAnalysisPrompt } from '../core/prompts.js';
import { parseDocumentAnalysis } from '../utils/parser.js';

/**
 * LibreOffice ile DOC/DOCX'i TXT'ye dönüştür
 * @param {string} docPath - Döküman yolu
 * @returns {string|null}
 */
function tryLibreOfficeConvert(docPath) {
  const tmpDir = path.dirname(docPath);
  const ext = path.extname(docPath).toLowerCase();
  const baseName = path.basename(docPath, ext);
  const tmpTxt = path.join(tmpDir, `${baseName}.txt`);

  try {
    execSync(`soffice --headless --convert-to txt:Text --outdir "${tmpDir}" "${docPath}"`, {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: 'pipe',
    });

    if (fs.existsSync(tmpTxt)) {
      const content = fs.readFileSync(tmpTxt, 'utf-8');
      fs.unlinkSync(tmpTxt);
      return content;
    }
  } catch {}

  return null;
}

/**
 * HTML içerikli DOC dosyasından metin çıkar
 * @param {string} content - Dosya içeriği
 * @returns {string}
 */
function extractTextFromHtmlDoc(content) {
  return content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Word dosyasını analiz et (DOCX ve DOC)
 * @param {string} docPath - Döküman yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
export async function analyzeDocx(docPath, onProgress) {
  const startTime = Date.now();
  const ext = path.extname(docPath).toLowerCase();

  logger.info('Starting Word analysis', {
    module: 'ai-analyzer',
    action: 'office.analyzeDocx',
    docPath,
    extension: ext,
  });

  if (onProgress) {
    onProgress({ stage: 'extracting', message: 'Word belgesi okunuyor...' });
  }

  let text = '';

  if (ext === '.docx') {
    // DOCX için önce LibreOffice, sonra mammoth
    text = tryLibreOfficeConvert(docPath);
    if (!text) {
      const result = await mammoth.extractRawText({ path: docPath });
      text = result.value;
    }
  } else if (ext === '.doc') {
    // DOC için önce içerik tipini kontrol et
    const fileContent = fs.readFileSync(docPath, 'utf-8').slice(0, 500);
    const isHtmlDoc =
      fileContent.includes('<html') ||
      fileContent.includes('<!DOCTYPE html') ||
      fileContent.includes('xmlns:w=') ||
      fileContent.includes('urn:schemas-microsoft-com:office:word');

    if (isHtmlDoc) {
      const fullContent = fs.readFileSync(docPath, 'utf-8');
      text = extractTextFromHtmlDoc(fullContent);
    } else {
      // Gerçek DOC formatı
      text = tryLibreOfficeConvert(docPath);

      if (!text) {
        // Fallback: antiword
        try {
          text = execSync(`antiword "${docPath}"`, {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
          });
        } catch {
          // Son çare: textutil (macOS)
          try {
            const tmpTxt = docPath.replace('.doc', '_tmp.txt');
            execSync(`textutil -convert txt -output "${tmpTxt}" "${docPath}"`, {
              encoding: 'utf-8',
            });
            text = fs.readFileSync(tmpTxt, 'utf-8');
            fs.unlinkSync(tmpTxt);
          } catch {
            throw new Error('DOC dosyası okunamadı. LibreOffice, antiword veya textutil gerekli.');
          }
        }
      }
    }
  } else {
    throw new Error(`Desteklenmeyen Word formatı: ${ext}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Word dosyasından metin çıkarılamadı');
  }

  if (onProgress) {
    onProgress({ stage: 'analyzing', message: 'İçerik analiz ediliyor...' });
  }

  // Claude ile analiz et
  const prompt = buildTextAnalysisPrompt(text);
  const responseText = await claudeClient.analyze(prompt, { maxTokens: 8192 });
  const parsed = parseDocumentAnalysis(responseText, text);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info('Word analysis completed', {
    module: 'ai-analyzer',
    action: 'office.analyzeDocx',
    textLength: text.length,
    duration: `${duration}s`,
  });

  return {
    success: true,
    toplam_sayfa: 1,
    analiz: parsed,
    ham_metin: text,
  };
}

/**
 * Excel dosyasını analiz et
 * @param {string} excelPath - Excel dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
export async function analyzeExcel(excelPath, onProgress) {
  const startTime = Date.now();

  logger.info('Starting Excel analysis', {
    module: 'ai-analyzer',
    action: 'office.analyzeExcel',
    excelPath,
  });

  if (onProgress) {
    onProgress({ stage: 'extracting', message: 'Excel dosyası okunuyor...' });
  }

  // Excel'i oku
  const workbook = XLSX.readFile(excelPath);
  const sheets = [];
  let fullText = '';

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const csvData = XLSX.utils.sheet_to_csv(sheet);

    sheets.push({
      name: sheetName,
      data: jsonData,
      csv: csvData,
    });

    fullText += `\n--- Sayfa: ${sheetName} ---\n${csvData}\n`;
  }

  if (onProgress) {
    onProgress({ stage: 'analyzing', message: 'Tablo verileri analiz ediliyor...' });
  }

  // Claude ile analiz et
  const prompt = buildTableAnalysisPrompt(fullText);
  const responseText = await claudeClient.analyze(prompt, { maxTokens: 4096 });
  const parsed = parseDocumentAnalysis(responseText, fullText);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info('Excel analysis completed', {
    module: 'ai-analyzer',
    action: 'office.analyzeExcel',
    sheetCount: sheets.length,
    duration: `${duration}s`,
  });

  return {
    success: true,
    toplam_sayfa: sheets.length,
    analiz: parsed,
    sheets,
  };
}

// Legacy export aliases
export const analyzeDocxFile = analyzeDocx;
export const analyzeExcelFile = analyzeExcel;

export default {
  analyzeDocx,
  analyzeDocxFile,
  analyzeExcel,
  analyzeExcelFile,
};
