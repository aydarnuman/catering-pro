import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mammoth from 'mammoth';
import fetch from 'node-fetch';
import pdfParse from 'pdf-parse';
import xlsx from 'xlsx';
import { supabase } from '../supabase.js';
import { analyzeDocument } from './document-analyzer.js';

const BUCKET_NAME = 'tender-documents';

/**
 * Döküman işleme ana fonksiyonu
 * @param {number} documentId - Döküman ID
 * @param {string} filePath - Dosya yolu (opsiyonel, content_text varsa kullanılmaz)
 * @param {string} originalFilename - Orijinal dosya adı
 * @returns {Promise<object>} - İşlenmiş veri
 */
export async function processDocument(documentId, filePath, originalFilename) {
  let extractedText = '';
  const ocrResult = null;
  let tempFilePath = null;

  try {
    // Önce döküman bilgilerini DB'den al
    const { pool: dbPool } = await import('../database.js');
    const docResult = await dbPool.query(
      'SELECT content_text, file_type, source_type, storage_path, storage_url FROM documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      throw new Error(`Döküman bulunamadı: ${documentId}`);
    }

    const document = docResult.rows[0];

    // Content dökümanları için direkt content_text kullan
    if (document.source_type === 'content' && document.content_text) {
      extractedText = document.content_text;
    } else if (document.source_type === 'download' && document.storage_path) {
      const fileBuffer = await downloadFromSupabase(document.storage_path, document.storage_url);

      // Temp dosyaya kaydet
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'doc-process-'));
      const ext = path.extname(originalFilename).toLowerCase() || '.pdf';
      tempFilePath = path.join(tempDir, `document${ext}`);
      await fs.promises.writeFile(tempFilePath, fileBuffer);

      // Dosyadan metin çıkar
      extractedText = await extractTextFromFile(tempFilePath, ext);
    } else {
      // Local dosya (upload)
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`Dosya bulunamadı: ${filePath}`);
      }

      const ext = path.extname(originalFilename).toLowerCase();
      extractedText = await extractTextFromFile(filePath, ext);
    }
    const analysis = await analyzeDocument(extractedText, tempFilePath || filePath || '', document.file_type);

    return {
      text: extractedText,
      ocr: ocrResult,
      analysis: analysis,
    };
  } finally {
    // Temp dosyayı temizle
    if (tempFilePath) {
      try {
        const tempDir = path.dirname(tempFilePath);
        await fs.promises.rm(tempDir, { recursive: true });
      } catch (_e) {}
    }
  }
}

/**
 * Supabase Storage'dan dosya indir
 */
export async function downloadFromSupabase(storagePath, storageUrl) {
  // Önce public URL'den dene
  if (storageUrl) {
    const response = await fetch(storageUrl);
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }
  }

  // Signed URL ile dene
  if (supabase?.storage) {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(storagePath, 3600); // 1 saat geçerli

    if (error) {
      throw new Error(`Signed URL hatası: ${error.message}`);
    }
    const response = await fetch(data.signedUrl);
    if (!response.ok) {
      throw new Error(`Download hatası: HTTP ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error('Supabase client mevcut değil');
}

/**
 * Dosyadan metin çıkar
 */
async function extractTextFromFile(filePath, ext) {
  switch (ext) {
    case '.pdf':
      return await extractPDF(filePath);
    case '.doc':
    case '.docx':
      return await extractWord(filePath);
    case '.xls':
    case '.xlsx':
      return await extractExcel(filePath);
    case '.txt':
    case '.csv':
      return await fs.promises.readFile(filePath, 'utf8');
    default:
      throw new Error(`Desteklenmeyen dosya formatı: ${ext}`);
  }
}

/**
 * Content dökümanı işleme (sadece DB'deki metin için)
 * @param {number} documentId - Döküman ID
 * @returns {Promise<object>} - İşlenmiş veri
 */
export async function processContentDocument(documentId) {
  const { pool: dbPool } = await import('../database.js');
  const docResult = await dbPool.query(
    `SELECT content_text, content_type, original_filename 
       FROM documents WHERE id = $1 AND source_type = 'content'`,
    [documentId]
  );

  if (docResult.rows.length === 0) {
    throw new Error(`Content döküman bulunamadı: ${documentId}`);
  }

  const document = docResult.rows[0];

  if (!document.content_text) {
    throw new Error('Content text boş');
  }
  const analysis = await analyzeDocument(
    document.content_text,
    '', // filePath yok
    document.content_type || 'text'
  );

  return {
    text: document.content_text,
    ocr: null,
    analysis: analysis,
  };
}

/**
 * PDF metin çıkarma
 * Eğer çıkan metin çok kısaysa (taranmış PDF olabilir), Gemini Vision ile OCR dener
 */
async function extractPDF(filePath) {
  const dataBuffer = await fs.promises.readFile(filePath);
  const data = await pdfParse(dataBuffer);

  // Eğer metin çok kısaysa (100 karakterden az), muhtemelen taranmış PDF
  // Dosya boyutuna göre kontrol et - büyük dosya ama az metin = taranmış
  const fileSizeKB = dataBuffer.length / 1024;
  const textLength = data.text?.trim().length || 0;

  if (textLength < 200 && fileSizeKB > 500) {
    // Gemini Vision ile OCR dene
    try {
      const ocrText = await extractPDFWithVision(filePath, dataBuffer);
      if (ocrText && ocrText.length > textLength) {
        return ocrText;
      }
    } catch (_ocrError) {}
  }

  return data.text;
}

/**
 * Gemini Vision ile PDF'den metin çıkar (OCR)
 */
async function extractPDFWithVision(_filePath, pdfBuffer) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // PDF'i base64'e çevir
  const base64Data = pdfBuffer.toString('base64');

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Data,
      },
    },
    `Bu PDF dökümanındaki TÜM metni çıkar. 
       Sadece döküman içeriğini döndür, yorum veya açıklama ekleme.
       Tablo varsa düzgün formatla.
       Türkçe karakterleri koru.`,
  ]);

  const response = await result.response;
  return response.text();
}

/**
 * Word döküman çıkarma
 */
async function extractWord(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

/**
 * Excel çıkarma
 */
async function extractExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  let text = '';

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = xlsx.utils.sheet_to_csv(sheet);
    text += `\n=== ${sheetName} ===\n${csv}\n`;
  });

  return text;
}
