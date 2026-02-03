/**
 * PDF Analyzer - PDF döküman analizi (Sadece Claude)
 *
 * Strateji (öncelik sırasına göre):
 * 1. Doğrudan Claude PDF API - <25MB dosyalar için
 * 2. Text extraction + Claude analiz - Metin içeren PDF'ler
 * 3. Claude Vision - Taranmış PDF'ler için (sayfa sayfa görsel analiz)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import { aiConfig } from '../../../config/ai.config.js';
import logger from '../../../utils/logger.js';
import claudeClient from '../core/client.js';
import { buildTextAnalysisPrompt, PAGE_ANALYSIS_PROMPT } from '../core/prompts.js';
import { mergePageResults, parseDocumentAnalysis, parsePageAnalysis } from '../utils/parser.js';

/**
 * PDF sayfa sayısını al
 * @param {string} pdfPath - PDF dosya yolu
 * @returns {Promise<number>}
 */
async function getPdfPageCount(pdfPath) {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(pdfBuffer);
    return data.numpages || 1;
  } catch {
    // Fallback: sayfa sayfa dene
    try {
      const convert = fromPath(pdfPath, {
        density: 72,
        saveFilename: 'count_test',
        savePath: '/tmp',
        format: 'png',
        width: 100,
        height: 100,
      });

      let pageCount = 1;
      const maxPages = aiConfig.pdf.maxPages || 100;
      while (pageCount <= maxPages) {
        try {
          await convert(pageCount);
          pageCount++;
        } catch {
          break;
        }
      }
      return Math.max(1, pageCount - 1);
    } catch {
      return 1;
    }
  }
}

/**
 * PDF'i görsellere çevir
 * @param {string} pdfPath - PDF dosya yolu
 * @param {number} maxPages - Maksimum sayfa sayısı (default: tümü)
 * @returns {Promise<string[]>} Görsel dosya yolları
 */
async function pdfToImages(pdfPath, maxPages = 0) {
  const options = {
    density: aiConfig.pdf?.dpi || 150,
    saveFilename: 'page',
    savePath: path.dirname(pdfPath),
    format: 'png',
    width: 1200,
    height: 1600,
  };

  const convert = fromPath(pdfPath, options);
  const totalPages = await getPdfPageCount(pdfPath);
  const pagesToConvert = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages;
  const images = [];
  const parallelPages = aiConfig.pdf?.parallelPages || 3;

  logger.debug('Converting PDF to images', {
    module: 'ai-analyzer',
    action: 'pdf.toImages',
    totalPages,
    pagesToConvert,
    parallelPages,
  });

  for (let i = 1; i <= pagesToConvert; i += parallelPages) {
    const pagePromises = [];

    for (let j = i; j < i + parallelPages && j <= pagesToConvert; j++) {
      pagePromises.push(
        (async (pageNum) => {
          try {
            const result = await convert(pageNum);

            // Sharp ile optimize et
            const optimizedPath = result.path.replace('.png', '_optimized.jpg');
            await sharp(result.path)
              .resize(1000, 1400, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: aiConfig.image?.quality || 80 })
              .toFile(optimizedPath);

            // Orijinali sil
            try {
              fs.unlinkSync(result.path);
            } catch {}

            return { pageNum, path: optimizedPath };
          } catch {
            return null;
          }
        })(j)
      );
    }

    const results = await Promise.all(pagePromises);
    for (const result of results) {
      if (result) images.push(result.path);
    }
  }

  return images;
}

/**
 * Tek bir görsel sayfayı Claude Vision ile analiz et
 * @param {string} imagePath - Görsel dosya yolu
 * @param {number} pageNumber - Sayfa numarası
 * @returns {Promise<Object>}
 */
async function analyzePageImage(imagePath, pageNumber) {
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : 'image/png';

  logger.debug('Analyzing page image with Claude Vision', {
    module: 'ai-analyzer',
    action: 'pdf.analyzePageImage',
    pageNumber,
  });

  const responseText = await claudeClient.analyzeWithImage(base64Image, mimeType, PAGE_ANALYSIS_PROMPT);

  return parsePageAnalysis(responseText);
}

/**
 * PDF'i doğrudan Claude'a gönder (< 25MB)
 * @param {string} pdfPath - PDF dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
async function analyzePdfDirect(pdfPath, onProgress) {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const base64Pdf = pdfBuffer.toString('base64');
  const sizeMB = pdfBuffer.length / (1024 * 1024);

  // Boyut kontrolü (max ~20MB for direct)
  if (sizeMB > 20) {
    throw new Error('PDF çok büyük, doğrudan gönderilemez');
  }

  if (onProgress) {
    onProgress({ stage: 'analyzing', message: 'PDF Claude ile analiz ediliyor...', progress: 30 });
  }

  const prompt = buildTextAnalysisPrompt('');
  const responseText = await claudeClient.analyzeWithDocument(base64Pdf, prompt);
  const parsed = parseDocumentAnalysis(responseText);

  // Tüm alanları top-level'da döndür (nested analiz yerine)
  return {
    success: true,
    ...parsed,
    ham_metin: parsed.tam_metin || '',
  };
}

/**
 * PDF'den metin çıkar (hızlı yöntem)
 * @param {string} pdfPath - PDF dosya yolu
 * @returns {Promise<{text: string, pageCount: number, needsOcr: boolean} | null>}
 */
async function extractPdfText(pdfPath) {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfBuffer = fs.readFileSync(pdfPath);
    const stat = fs.statSync(pdfPath);
    const data = await pdfParse(pdfBuffer);

    const text = data.text || '';
    const pageCount = data.numpages || 1;
    
    // Taranmış PDF kontrolü: büyük dosya ama az metin
    const fileSizeKB = stat.size / 1024;
    const textDensity = text.length / fileSizeKB;
    
    // Daha agresif OCR tespiti: 
    // - textDensity < 20 (önceden 10 idi)
    // - veya sayfa başına < 100 karakter
    const charsPerPage = text.length / pageCount;
    const needsOcr = (textDensity < 20 && fileSizeKB > 50) || charsPerPage < 100;

    if (needsOcr) {
      logger.info('PDF needs OCR (scanned document detected)', {
        module: 'ai-analyzer',
        action: 'pdf.extractText',
        fileSizeKB: Math.round(fileSizeKB),
        textLength: text.length,
        textDensity: textDensity.toFixed(2),
        charsPerPage: Math.round(charsPerPage),
      });
    }

    if (text.trim().length > 100 && !needsOcr) {
      return {
        text: text,
        pageCount: pageCount,
        needsOcr: false,
      };
    }
    
    return {
      text: text,
      pageCount: pageCount,
      needsOcr: needsOcr,
    };
  } catch (error) {
    logger.debug('PDF text extraction failed', {
      module: 'ai-analyzer',
      action: 'pdf.extractText',
      error: error.message,
    });
    return null;
  }
}

/**
 * PDF dosyasını analiz et (ana fonksiyon)
 *
 * Strateji (öncelik sırasına göre):
 * 1. <25MB: Doğrudan PDF gönder (Claude hem metin hem görsel analiz yapar)
 * 2. Metin içeren PDF: Text extraction + Claude analiz
 * 3. Taranmış PDF: Claude Vision ile sayfa sayfa analiz
 *
 * @param {string} pdfPath - PDF dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
export async function analyzePdf(pdfPath, onProgress) {
  const startTime = Date.now();
  const pdfBuffer = fs.readFileSync(pdfPath);
  const sizeMB = pdfBuffer.length / (1024 * 1024);

  logger.info('Starting PDF analysis (Claude only)', {
    module: 'ai-analyzer',
    action: 'pdf.analyze',
    pdfPath,
    sizeMB: sizeMB.toFixed(2),
  });

  // ===== YÖNTEM 1: Doğrudan PDF Gönderimi (<25MB) =====
  if (sizeMB <= 25) {
    logger.info('Using direct PDF method', {
      module: 'ai-analyzer',
      action: 'pdf.analyze',
      sizeMB: sizeMB.toFixed(2),
    });

    if (onProgress) {
      onProgress({ stage: 'analyzing', message: 'PDF doğrudan analiz ediliyor...', progress: 20 });
    }

    try {
      const result = await analyzePdfDirect(pdfPath, onProgress);

      // Ek olarak text extraction yap, birleştir
      const extractedText = await extractPdfText(pdfPath);
      if (extractedText?.text) {
        result.ham_metin = extractedText.text.substring(0, 10000);
        result.toplam_sayfa = extractedText.pageCount;
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      result.method = 'direct_pdf';
      result.sure_saniye = parseFloat(duration);

      if (onProgress) {
        onProgress({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100 });
      }

      logger.info('PDF analysis completed (direct)', {
        module: 'ai-analyzer',
        action: 'pdf.analyze',
        method: 'direct_pdf',
        duration: `${duration}s`,
      });

      return result;
    } catch (directError) {
      logger.warn('Direct PDF failed, falling back to text extraction', {
        module: 'ai-analyzer',
        action: 'pdf.analyze',
        error: directError.message,
      });
    }
  }

  // ===== YÖNTEM 2: Text Extraction + Claude Analiz =====
  if (onProgress) {
    onProgress({ stage: 'extracting', message: 'PDF metni çıkarılıyor...', progress: 10 });
  }

  const extractedText = await extractPdfText(pdfPath);
  
  // Metin başarıyla çıkarıldı ve OCR gerekmiyor
  if (extractedText && extractedText.text.length > 100 && !extractedText.needsOcr) {
    logger.info('Using text extraction method', {
      module: 'ai-analyzer',
      action: 'pdf.analyze',
      textLength: extractedText.text.length,
    });

    if (onProgress) {
      onProgress({ stage: 'analyzing_text', message: 'Metin analiz ediliyor...', progress: 40 });
    }

    try {
      let textToAnalyze = extractedText.text;
      if (textToAnalyze.length > 120000) {
        const firstPart = textToAnalyze.substring(0, 100000);
        const lastPart = textToAnalyze.substring(textToAnalyze.length - 20000);
        textToAnalyze = `${firstPart}\n\n... [ORTA KISIM KISALTILDI] ...\n\n${lastPart}`;
      }

      const prompt = buildTextAnalysisPrompt(textToAnalyze);
      const responseText = await claudeClient.analyze(prompt, {
        model: aiConfig.claude.analysisModel,
        maxTokens: 8192,
      });
      const analysisResult = parseDocumentAnalysis(responseText, extractedText.text);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (onProgress) {
        onProgress({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100 });
      }

      logger.info('PDF analysis completed (text extraction)', {
        module: 'ai-analyzer',
        action: 'pdf.analyze',
        method: 'text_extraction',
        pageCount: extractedText.pageCount,
        textLength: extractedText.text.length,
        duration: `${duration}s`,
      });

      // Tüm alanları top-level'da döndür (nested analiz yerine)
      return {
        success: true,
        method: 'text_extraction',
        toplam_sayfa: extractedText.pageCount,
        ...analysisResult,
        ham_metin: extractedText.text.substring(0, 10000),
        sure_saniye: parseFloat(duration),
      };
    } catch (textError) {
      logger.warn('Text analysis failed, falling back to Vision', { error: textError.message });
    }
  }

  // ===== YÖNTEM 3: Claude Vision (Taranmış PDF) =====
  logger.info('Using Claude Vision for scanned PDF', {
    module: 'ai-analyzer',
    action: 'pdf.analyze',
    reason: extractedText?.needsOcr ? 'low_text_density' : 'text_extraction_failed',
  });

  if (onProgress) {
    onProgress({ stage: 'converting', message: 'PDF görsellere çevriliyor...', progress: 20 });
  }

  // Seçici sayfa analizi: ilk 15 + son 5 sayfa
  let images = [];
  try {
    images = await pdfToImages(pdfPath);
  } catch (error) {
    logger.error('PDF to image conversion failed', { error: error.message });
    return {
      success: false,
      method: 'vision_failed',
      error: 'PDF görüntüye çevrilemedi',
    };
  }

  if (images.length === 0) {
    return {
      success: false,
      method: 'vision_failed',
      error: 'PDF sayfaları çıkarılamadı',
    };
  }

  // Seçili sayfalar: ilk 15 + son 5
  const totalPages = images.length;
  const selectedIndices = new Set();

  for (let i = 0; i < Math.min(15, totalPages); i++) {
    selectedIndices.add(i);
  }
  if (totalPages > 20) {
    for (let i = totalPages - 5; i < totalPages; i++) {
      selectedIndices.add(i);
    }
  }

  const selectedImages = Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .map((i) => ({
      path: images[i],
      pageNumber: i + 1,
    }));

  // Kullanılmayan görselleri temizle
  images.forEach((img, idx) => {
    if (!selectedIndices.has(idx)) {
      try {
        fs.unlinkSync(img);
      } catch {}
    }
  });

  logger.info('Starting Claude Vision analysis', {
    module: 'ai-analyzer',
    action: 'pdf.analyze',
    totalPages,
    selectedPages: selectedImages.length,
  });

  const allResults = [];

  // Sayfaları sırayla analiz et
  for (let i = 0; i < selectedImages.length; i++) {
    const { path: imgPath, pageNumber } = selectedImages[i];

    if (onProgress) {
      onProgress({
        stage: 'analyzing_images',
        message: `Claude Vision: Sayfa ${pageNumber} (${i + 1}/${selectedImages.length})`,
        progress: 30 + Math.round((i / selectedImages.length) * 60),
      });
    }

    try {
      const result = await analyzePageImage(imgPath, pageNumber);
      if (result) allResults.push(result);
    } catch (err) {
      logger.warn(`Page ${pageNumber} analysis failed`, { error: err.message });
    }

    // Görseli sil
    try {
      fs.unlinkSync(imgPath);
    } catch {}
  }

  if (allResults.length === 0) {
    return {
      success: false,
      method: 'vision_failed',
      error: 'Hiçbir sayfa analiz edilemedi',
    };
  }

  const mergedResult = mergePageResults(allResults);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  if (onProgress) {
    onProgress({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100 });
  }

  logger.info('PDF analysis completed (Claude Vision)', {
    module: 'ai-analyzer',
    action: 'pdf.analyze',
    method: 'claude_vision',
    totalPages,
    analyzedPages: allResults.length,
    duration: `${duration}s`,
  });

  // Tüm alanları top-level'da döndür (nested analiz yerine)
  return {
    success: true,
    method: 'claude_vision',
    toplam_sayfa: totalPages,
    ...mergedResult,
    ham_metin: mergedResult.tam_metin || '',
    analyzed_pages: allResults.length,
    sure_saniye: parseFloat(duration),
  };
}

// Legacy export alias
export const analyzePdfWithClaude = analyzePdf;

export default {
  analyzePdf,
  analyzePdfWithClaude,
};
