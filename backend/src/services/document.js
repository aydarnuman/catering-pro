import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import { analyzeWithGemini } from './gemini.js';

/**
 * Döküman işleme ana fonksiyonu
 * @param {number} documentId - Döküman ID
 * @param {string} filePath - Dosya yolu
 * @param {string} originalFilename - Orijinal dosya adı
 * @returns {Promise<object>} - İşlenmiş veri
 */
export async function processDocument(documentId, filePath, originalFilename) {
  console.log(`🔄 Döküman işleniyor [${documentId}]: ${originalFilename}`);
  
  const ext = path.extname(originalFilename).toLowerCase();
  let extractedText = '';
  let ocrResult = null;
  
  try {
    // Dosya tipine göre metin çıkarma
    switch (ext) {
      case '.pdf':
        extractedText = await extractPDF(filePath);
        break;
      case '.doc':
      case '.docx':
        extractedText = await extractWord(filePath);
        break;
      case '.xls':
      case '.xlsx':
        extractedText = await extractExcel(filePath);
        break;
      case '.txt':
        extractedText = await fs.promises.readFile(filePath, 'utf8');
        break;
      default:
        throw new Error(`Desteklenmeyen dosya formatı: ${ext}`);
    }
    
    console.log(`📝 Metin çıkarıldı: ${extractedText.length} karakter`);
    
    // Gemini ile OCR ve analiz
    console.log('🤖 Gemini ile analiz başlıyor...');
    const analysis = await analyzeWithGemini(extractedText, filePath, ext);
    
    return {
      text: extractedText,
      ocr: ocrResult,
      analysis: analysis
    };
    
  } catch (error) {
    console.error(`❌ Döküman işleme hatası [${documentId}]:`, error);
    throw error;
  }
}

/**
 * PDF metin çıkarma
 */
async function extractPDF(filePath) {
  try {
    const dataBuffer = await fs.promises.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF çıkarma hatası:', error);
    throw error;
  }
}

/**
 * Word döküman çıkarma
 */
async function extractWord(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('Word çıkarma hatası:', error);
    throw error;
  }
}

/**
 * Excel çıkarma
 */
async function extractExcel(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    let text = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const csv = xlsx.utils.sheet_to_csv(sheet);
      text += `\n=== ${sheetName} ===\n${csv}\n`;
    });
    
    return text;
  } catch (error) {
    console.error('Excel çıkarma hatası:', error);
    throw error;
  }
}
