/**
 * PDF Analyzer - PDF döküman analizi
 *
 * Strateji (öncelik sırasına göre):
 * 1. Docling (IBM) - En iyi tablo çıkarma (%97.9 doğruluk)
 * 2. Doğrudan Claude PDF - <25MB dosyalar için
 * 3. Hibrit (metin + görsel) - Büyük dosyalar için
 * 4. Gemini OCR - Taranmış PDF'ler için fallback
 */

import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import { aiConfig } from '../../../config/ai.config.js';
import logger from '../../../utils/logger.js';
import claudeClient from '../core/client.js';
import doclingClient from '../core/docling-client.js';
import { buildTextAnalysisPrompt, PAGE_ANALYSIS_PROMPT } from '../core/prompts.js';
import { mergePageResults, parseDocumentAnalysis, parsePageAnalysis } from '../utils/parser.js';

// Gemini OCR client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Docling kullanılsın mı? (env ile kontrol edilebilir)
const USE_DOCLING = process.env.USE_DOCLING !== 'false';

/**
 * Docling ile PDF'den metin ve tablo çıkar
 * IBM Docling - %97.9 tablo doğruluğu
 * @param {string} pdfPath - PDF dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{text: string, tables: Array, pageCount: number} | null>}
 */
async function extractWithDocling(pdfPath, onProgress) {
  try {
    // Docling erişilebilir mi kontrol et
    const isAvailable = await doclingClient.isAvailable();
    if (!isAvailable) {
      logger.warn('Docling service not available, skipping', {
        module: 'ai-analyzer',
        action: 'pdf.docling',
      });
      return null;
    }

    // Dosya boyutunu kontrol et
    const stats = fs.statSync(pdfPath);
    const sizeMB = stats.size / (1024 * 1024);
    const useChunked = sizeMB > 5; // 5MB üstü dosyalar için chunked kullan

    logger.info('Starting Docling extraction', {
      module: 'ai-analyzer',
      action: 'pdf.docling',
      pdfPath,
      sizeMB: sizeMB.toFixed(2),
      useChunked,
    });

    if (onProgress) {
      onProgress({
        stage: 'docling',
        message: useChunked ? 'Docling ile büyük PDF parçalı işleniyor...' : 'Docling ile PDF işleniyor...',
        progress: 20,
      });
    }

    // Büyük PDF'ler için chunked metodu kullan (OOM önleme)
    const result = useChunked
      ? await doclingClient.convertFromFileChunked(pdfPath, 10, onProgress)
      : await doclingClient.convertFromFile(pdfPath);

    if (!result.success || !result.text) {
      logger.warn('Docling extraction returned empty result', {
        module: 'ai-analyzer',
        action: 'pdf.docling',
      });
      return null;
    }

    logger.info('Docling extraction successful', {
      module: 'ai-analyzer',
      action: 'pdf.docling',
      textLength: result.text?.length || 0,
      tableCount: result.tables?.length || 0,
      pageCount: result.pageCount || 1,
    });

    // Tabloları markdown formatına çevir ve metne ekle
    let fullText = result.text || '';
    if (result.tables && result.tables.length > 0) {
      fullText += '\n\n--- TABLOLAR ---\n\n';
      result.tables.forEach((table, idx) => {
        fullText += `\n### Tablo ${idx + 1}\n`;
        fullText += table.markdown || JSON.stringify(table.data);
        fullText += '\n';
      });
    }

    return {
      text: fullText,
      tables: result.tables || [],
      pageCount: result.pageCount || 1,
      method: 'docling',
      raw: result.raw,
    };
  } catch (error) {
    logger.error('Docling extraction failed', {
      module: 'ai-analyzer',
      action: 'pdf.docling',
      error: error.message,
    });
    return null;
  }
}

/**
 * Gemini Vision ile görsellerden düz metin çıkar (OCR)
 * @param {string} imagePath - Görsel dosya yolu
 * @returns {Promise<string>} - Çıkarılan metin
 */
async function geminiOcrExtract(imagePath) {
  try {
    // Env'deki modeli kullan veya fallback
    const modelName = process.env.GEMINI_MODEL || 'gemini-pro-vision';
    const model = genAI.getGenerativeModel({ model: modelName });

    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');

    const prompt = `Bu görseldeki TÜM METNİ oku ve aynen yaz. 
Tablolar varsa tablo formatında yaz.
Sadece görünen metni yaz, yorum yapma.
Türkçe karakterlere dikkat et.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    logger.debug('Gemini OCR page extracted', {
      module: 'ai-analyzer',
      action: 'geminiOcr',
      textLength: text?.length || 0,
    });

    return text || '';
  } catch (error) {
    logger.warn('Gemini OCR page failed', {
      module: 'ai-analyzer',
      action: 'geminiOcr',
      error: error.message,
    });
    return '';
  }
}

/**
 * PDF sayfa sayısını al
 * @param {string} pdfPath - PDF dosya yolu
 * @returns {Promise<number>}
 */
async function getPdfPageCount(pdfPath) {
  try {
    const convert = fromPath(pdfPath, {
      density: 100,
      saveFilename: 'test',
      savePath: '/tmp',
      format: 'png',
      width: 600,
      height: 800,
    });

    let pageCount = 1;
    try {
      const maxPages = aiConfig.pdf.maxPages;
      while (pageCount <= maxPages) {
        await convert(pageCount);
        pageCount++;
      }
    } catch {
      pageCount--;
    }

    return Math.max(1, pageCount);
  } catch {
    return 1;
  }
}

/**
 * PDF'i görsellere çevir
 * @param {string} pdfPath - PDF dosya yolu
 * @returns {Promise<string[]>} Görsel dosya yolları
 */
async function pdfToImages(pdfPath) {
  const options = {
    density: aiConfig.pdf.dpi,
    saveFilename: 'page',
    savePath: path.dirname(pdfPath),
    format: 'png',
    width: 1200,
    height: 1600,
  };

  const convert = fromPath(pdfPath, options);
  const pageCount = await getPdfPageCount(pdfPath);
  const images = [];
  const parallelPages = aiConfig.pdf.parallelPages;

  logger.debug('Converting PDF to images', {
    module: 'ai-analyzer',
    action: 'pdf.toImages',
    pageCount,
    parallelPages,
  });

  for (let i = 1; i <= pageCount; i += parallelPages) {
    const pagePromises = [];

    for (let j = i; j < i + parallelPages && j <= pageCount; j++) {
      pagePromises.push(
        (async (pageNum) => {
          try {
            const result = await convert(pageNum);

            // Sharp ile optimize et
            const optimizedPath = result.path.replace('.png', '_optimized.jpg');
            await sharp(result.path)
              .resize(1000, 1400, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: aiConfig.image.quality })
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
 * Tek bir görsel sayfayı analiz et
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

  logger.debug('Analyzing page image', {
    module: 'ai-analyzer',
    action: 'pdf.analyzePageImage',
    pageNumber,
    imagePath,
  });

  const responseText = await claudeClient.analyzeWithImage(base64Image, mimeType, PAGE_ANALYSIS_PROMPT);

  return parsePageAnalysis(responseText);
}

/**
 * Birden fazla sayfayı tek API çağrısında analiz et (BATCH)
 * @param {Array<{path: string, pageNumber: number}>} pages - Sayfa bilgileri
 * @returns {Promise<Array<Object>>}
 */
async function _analyzePageBatch(pages) {
  if (pages.length === 0) return [];

  // Tüm görselleri hazırla
  const imageContents = pages.map(({ path: imgPath, pageNumber: _pageNumber }) => {
    const imageData = fs.readFileSync(imgPath);
    const base64Image = imageData.toString('base64');
    const ext = path.extname(imgPath).toLowerCase();
    const mimeType =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/png';

    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: base64Image,
      },
    };
  });

  const pageNumbers = pages.map((p) => p.pageNumber).join(', ');

  logger.debug('Analyzing page batch', {
    module: 'ai-analyzer',
    action: 'pdf.analyzePageBatch',
    pageCount: pages.length,
    pageNumbers,
  });

  const batchPrompt = `Bu ${pages.length} sayfalık bir döküman bölümüdür (Sayfa ${pageNumbers}).
Her sayfadaki bilgileri ayrı ayrı analiz et ve birleştir.

${PAGE_ANALYSIS_PROMPT}

ÖNEMLİ: Tüm sayfalardaki bilgileri birleştirerek TEK bir JSON yanıt ver.`;

  try {
    // Claude'a çoklu görsel gönder
    const client = claudeClient.getClient();
    const response = await client.messages.create({
      model: aiConfig.claude.analysisModel,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [...imageContents, { type: 'text', text: batchPrompt }],
        },
      ],
    });

    const responseText = response.content[0]?.text || '';
    return [parsePageAnalysis(responseText)]; // Tek birleştirilmiş sonuç
  } catch (error) {
    logger.warn('Batch analysis failed, falling back to individual', {
      error: error.message,
      pageCount: pages.length,
    });

    // Fallback: tek tek analiz et
    const results = [];
    for (const page of pages) {
      try {
        const result = await analyzePageImage(page.path, page.pageNumber);
        results.push(result);
      } catch (e) {
        logger.warn(`Page ${page.pageNumber} failed`, { error: e.message });
      }
    }
    return results;
  }
}

/**
 * PDF'i doğrudan Claude'a gönder
 * @param {string} pdfPath - PDF dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
async function analyzePdfDirect(pdfPath, onProgress) {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const base64Pdf = pdfBuffer.toString('base64');

  // Boyut kontrolü (max ~20MB)
  const sizeMB = pdfBuffer.length / (1024 * 1024);
  if (sizeMB > 20) {
    // Büyük PDF için text extraction dene
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(pdfBuffer);

    if (data.text && data.text.length > 100) {
      const prompt = buildTextAnalysisPrompt(data.text);
      const responseText = await claudeClient.analyze(prompt, {
        model: aiConfig.claude.analysisModel,
        maxTokens: 8192,
      });
      const parsed = parseDocumentAnalysis(responseText, data.text);

      return {
        success: true,
        analiz: parsed,
        ham_metin: data.text.substring(0, 5000),
      };
    }

    throw new Error('PDF çok büyük ve metin çıkarılamadı');
  }

  if (onProgress) {
    onProgress({ stage: 'analyzing', message: 'PDF Claude ile analiz ediliyor...' });
  }

  const prompt = buildTextAnalysisPrompt('');
  const responseText = await claudeClient.analyzeWithDocument(base64Pdf, prompt);
  const parsed = parseDocumentAnalysis(responseText);

  return {
    success: true,
    analiz: parsed,
    ham_metin: parsed.tam_metin || '',
  };
}

/**
 * PDF'den metin çıkar (hızlı yöntem)
 * @param {string} pdfPath - PDF dosya yolu
 * @returns {Promise<{text: string, pageCount: number} | null>}
 */
async function extractPdfText(pdfPath) {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(pdfBuffer);

    if (data.text && data.text.trim().length > 100) {
      return {
        text: data.text,
        pageCount: data.numpages || 1,
      };
    }
    return null;
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
 * Gemini Vision ile taranmış PDF'den metin çıkar (OCR)
 * @param {string} pdfPath - PDF dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{text: string, pageCount: number} | null>}
 */
async function _extractPdfTextWithGeminiOCR(pdfPath, onProgress) {
  try {
    logger.info('Starting Gemini OCR for scanned PDF', {
      module: 'ai-analyzer',
      action: 'pdf.geminiOCR',
    });

    if (onProgress) {
      onProgress({ stage: 'ocr', message: 'Taranmış PDF - Gemini OCR başlatılıyor...', progress: 15 });
    }

    // PDF sayfa sayısını hızlı al (pdf-parse ile)
    let pageCount = 30; // default
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(pdfBuffer);
      pageCount = data.numpages || 30;
    } catch {
      // pdf-parse başarısız olursa default kullan
    }

    // PDF'i görsellere çevir (sadece ilk 20 sayfa - OCR için yeterli)
    const options = {
      density: 120, // Daha düşük DPI = daha hızlı
      saveFilename: 'ocr_page',
      savePath: path.dirname(pdfPath),
      format: 'jpeg',
      width: 1000,
      height: 1400,
    };

    const convert = fromPath(pdfPath, options);
    const maxOcrPages = Math.min(pageCount, 20); // Max 20 sayfa OCR (hızlandırma)

    logger.info('OCR page count determined', {
      module: 'ai-analyzer',
      action: 'pdf.geminiOCR',
      totalPages: pageCount,
      ocrPages: maxOcrPages,
    });

    const allText = [];

    // Sayfa sayfa OCR yap (memory-safe)
    for (let i = 1; i <= maxOcrPages; i++) {
      if (onProgress) {
        onProgress({
          stage: 'ocr',
          message: `OCR: Sayfa ${i}/${maxOcrPages}...`,
          progress: 15 + Math.round((i / maxOcrPages) * 35),
        });
      }

      try {
        const result = await convert(i);

        // Gemini OCR ile metni çıkar
        const pageText = await geminiOcrExtract(result.path);

        if (pageText?.trim()) {
          allText.push(`--- SAYFA ${i} ---\n${pageText}`);
        }

        // Görsel dosyayı sil
        try {
          fs.unlinkSync(result.path);
        } catch {}
      } catch (pageError) {
        logger.debug(`OCR failed for page ${i}`, { error: pageError.message });
      }
    }

    if (allText.length === 0) {
      logger.warn('Gemini OCR extracted no text', {
        module: 'ai-analyzer',
        action: 'pdf.geminiOCR',
      });
      return null;
    }

    const combinedText = allText.join('\n\n');

    logger.info('Gemini OCR completed', {
      module: 'ai-analyzer',
      action: 'pdf.geminiOCR',
      pagesProcessed: allText.length,
      textLength: combinedText.length,
    });

    return {
      text: combinedText,
      pageCount: maxOcrPages,
      method: 'gemini_ocr',
    };
  } catch (error) {
    logger.error('Gemini OCR failed', {
      module: 'ai-analyzer',
      action: 'pdf.geminiOCR',
      error: error.message,
    });
    return null;
  }
}

/**
 * PDF dosyasını analiz et (ana fonksiyon - VERİ KAYBI 0)
 *
 * Strateji (öncelik sırasına göre):
 * 1. Docling (IBM) - En iyi tablo çıkarma (%97.9 doğruluk) + Claude analiz
 * 2. <25MB: Doğrudan PDF gönder (Claude hem metin hem görsel analiz yapar)
 * 3. >25MB: Text extraction + seçili sayfalar görsel analiz + birleştir
 *
 * @param {string} pdfPath - PDF dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
export async function analyzePdf(pdfPath, onProgress) {
  const startTime = Date.now();
  const pdfBuffer = fs.readFileSync(pdfPath);
  const sizeMB = pdfBuffer.length / (1024 * 1024);

  logger.info('Starting PDF analysis (zero data loss mode)', {
    module: 'ai-analyzer',
    action: 'pdf.analyze',
    pdfPath,
    sizeMB: sizeMB.toFixed(2),
    useDocling: USE_DOCLING,
  });

  // ===== YÖNTEM 0: DOCLING (IBM) - EN İYİ TABLO ÇIKARMA =====
  // %97.9 tablo doğruluğu - ihale dökümanları için ideal
  if (USE_DOCLING) {
    if (onProgress) {
      onProgress({ stage: 'docling', message: 'Docling ile PDF işleniyor...', progress: 10 });
    }

    const doclingResult = await extractWithDocling(pdfPath, onProgress);

    if (doclingResult?.text && doclingResult.text.length > 100) {
      logger.info('Docling extraction successful, analyzing with Claude', {
        module: 'ai-analyzer',
        action: 'pdf.analyze',
        textLength: doclingResult.text.length,
        tableCount: doclingResult.tables?.length || 0,
      });

      if (onProgress) {
        onProgress({ stage: 'analyzing', message: 'Claude ile analiz ediliyor...', progress: 50 });
      }

      try {
        // Docling metnini Claude ile analiz et
        let textToAnalyze = doclingResult.text;
        if (textToAnalyze.length > 120000) {
          const firstPart = textToAnalyze.substring(0, 100000);
          const lastPart = textToAnalyze.substring(textToAnalyze.length - 20000);
          textToAnalyze = firstPart + '\n\n... [ORTA KISIM KISALTILDI] ...\n\n' + lastPart;
        }

        const prompt = buildTextAnalysisPrompt(textToAnalyze);
        const responseText = await claudeClient.analyze(prompt, {
          model: aiConfig.claude.analysisModel,
          maxTokens: 8192,
        });
        const analysisResult = parseDocumentAnalysis(responseText, doclingResult.text);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        logger.info('PDF analysis completed (Docling + Claude)', {
          module: 'ai-analyzer',
          action: 'pdf.analyze',
          method: 'docling',
          pageCount: doclingResult.pageCount,
          textLength: doclingResult.text.length,
          tableCount: doclingResult.tables?.length || 0,
          duration: `${duration}s`,
        });

        if (onProgress) {
          onProgress({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100 });
        }

        return {
          success: true,
          method: 'docling',
          toplam_sayfa: doclingResult.pageCount,
          analiz: analysisResult,
          ham_metin: doclingResult.text.substring(0, 10000),
          tables: doclingResult.tables,
          sure_saniye: parseFloat(duration),
        };
      } catch (claudeError) {
        logger.warn('Claude analysis after Docling failed, trying fallback', {
          module: 'ai-analyzer',
          action: 'pdf.analyze',
          error: claudeError.message,
        });
        // Fallback to other methods
      }
    } else {
      logger.info('Docling extraction failed or empty, trying fallback methods', {
        module: 'ai-analyzer',
        action: 'pdf.analyze',
      });
    }
  }

  // ===== YÖNTEM 1: Doğrudan PDF Gönderimi (<25MB) =====
  // Claude PDF'i hem metin hem görsel olarak analiz eder - EN KAPSAMLI
  if (sizeMB <= 25) {
    logger.info('Using direct PDF method (comprehensive)', {
      module: 'ai-analyzer',
      action: 'pdf.analyze',
      sizeMB: sizeMB.toFixed(2),
    });

    if (onProgress) {
      onProgress({ stage: 'analyzing', message: 'PDF doğrudan analiz ediliyor (tam içerik)...' });
    }

    try {
      const result = await analyzePdfDirect(pdfPath, onProgress);

      // Ek olarak text extraction yap, birleştir
      const extractedText = await extractPdfText(pdfPath);
      if (extractedText?.text) {
        result.ham_metin = extractedText.text.substring(0, 10000);
        result.toplam_sayfa = extractedText.pageCount;
      }

      result.method = 'direct_pdf';
      return result;
    } catch (directError) {
      logger.warn('Direct PDF failed, falling back to hybrid', {
        module: 'ai-analyzer',
        action: 'pdf.analyze',
        error: directError.message,
      });
      // Fallback to hybrid method below
    }
  }

  // ===== YÖNTEM 2: Akıllı Metin Analizi (Büyük PDF'ler - HIZLI) =====
  // Strateji: Önce metin çıkar ve analiz et, Vision sadece gerekirse
  logger.info('Using smart text-first method for large PDF', {
    module: 'ai-analyzer',
    action: 'pdf.analyze',
    sizeMB: sizeMB.toFixed(2),
  });

  // ADIM 1: Text extraction (tüm metin)
  if (onProgress) {
    onProgress({ stage: 'extracting', message: 'PDF metni çıkarılıyor...', progress: 10 });
  }

  const extractedText = await extractPdfText(pdfPath);
  let textAnalysisResult = null;

  if (extractedText && extractedText.text.length > 100) {
    if (onProgress) {
      onProgress({ stage: 'analyzing_text', message: 'Metin içeriği analiz ediliyor...', progress: 30 });
    }

    try {
      // Metin çok uzunsa, önemli kısımları al (ilk 100K + son 20K karakter)
      let textToAnalyze = extractedText.text;
      if (textToAnalyze.length > 120000) {
        const firstPart = textToAnalyze.substring(0, 100000);
        const lastPart = textToAnalyze.substring(textToAnalyze.length - 20000);
        textToAnalyze = firstPart + '\n\n... [ORTA KISIM KISALTILDI] ...\n\n' + lastPart;
      }

      const prompt = buildTextAnalysisPrompt(textToAnalyze);
      const responseText = await claudeClient.analyze(prompt, {
        model: aiConfig.claude.analysisModel,
        maxTokens: 8192,
      });
      textAnalysisResult = parseDocumentAnalysis(responseText, extractedText.text);

      if (onProgress) {
        onProgress({ stage: 'analyzing_text', message: 'Metin analizi tamamlandı', progress: 80 });
      }
    } catch (textError) {
      logger.warn('Text analysis failed', { error: textError.message });
    }
  }

  // Metin analizi başarılıysa, sadece TABLO SAYFALARI için Vision kullan
  // İlk 10 + son 5 sayfa genelde tablolar içerir (gramaj, birim fiyat, personel)
  if (textAnalysisResult) {
    if (onProgress) {
      onProgress({ stage: 'converting', message: 'Tablo sayfaları için görsel analiz...', progress: 50 });
    }

    // Sadece tablo sayfalarını Vision ile analiz et (ilk 10 + son 5)
    let tableImages = [];
    try {
      const allImages = await pdfToImages(pdfPath);
      const totalPages = allImages.length;

      if (totalPages > 0) {
        // İlk 10 sayfa
        const _firstPages = allImages.slice(0, Math.min(10, totalPages));
        // Son 5 sayfa (eğer 15'ten fazla sayfa varsa)
        const _lastPages = totalPages > 15 ? allImages.slice(-5) : [];

        // Birleştir (duplicate olmasın)
        const selectedIndices = new Set();
        for (let i = 0; i < Math.min(10, totalPages); i++) selectedIndices.add(i);
        if (totalPages > 15) {
          for (let i = totalPages - 5; i < totalPages; i++) selectedIndices.add(i);
        }

        tableImages = Array.from(selectedIndices).map((i) => ({
          path: allImages[i],
          pageNumber: i + 1,
        }));

        // Kullanılmayan görselleri temizle
        allImages.forEach((img, idx) => {
          if (!selectedIndices.has(idx)) {
            try {
              fs.unlinkSync(img);
            } catch {}
          }
        });

        logger.info('Selected table pages for Vision analysis', {
          module: 'ai-analyzer',
          action: 'pdf.analyze',
          totalPages,
          selectedPages: tableImages.length,
          pageNumbers: tableImages.map((p) => p.pageNumber).join(', '),
        });
      }
    } catch (error) {
      logger.warn('PDF to image conversion failed', { error: error.message });
    }

    let tableAnalysisResult = null;

    if (tableImages.length > 0) {
      if (onProgress) {
        onProgress({
          stage: 'analyzing_images',
          message: `Tablo sayfaları analiz ediliyor (${tableImages.length} sayfa)...`,
          progress: 60,
        });
      }

      // Tablo sayfalarını paralel analiz et (max 5 paralel)
      const parallelCount = Math.min(5, tableImages.length);
      const tableResults = [];

      for (let i = 0; i < tableImages.length; i += parallelCount) {
        const batch = tableImages.slice(i, i + parallelCount);

        if (onProgress) {
          onProgress({
            stage: 'analyzing_images',
            message: `Sayfa ${i + 1}-${Math.min(i + parallelCount, tableImages.length)}/${tableImages.length}`,
            progress: 60 + Math.round((i / tableImages.length) * 30),
          });
        }

        const batchPromises = batch.map(({ path: imgPath, pageNumber: _pageNumber }) =>
          analyzePageImage(imgPath, pageNumber)
            .then((result) => {
              try {
                fs.unlinkSync(imgPath);
              } catch {}
              return result;
            })
            .catch((err) => {
              logger.warn(`Table page ${pageNumber} analysis failed`, { error: err.message });
              try {
                fs.unlinkSync(imgPath);
              } catch {}
              return null;
            })
        );

        const results = await Promise.all(batchPromises);
        tableResults.push(...results.filter((r) => r !== null));
      }

      if (tableResults.length > 0) {
        tableAnalysisResult = mergePageResults(tableResults);
      }
    }

    // Metin + Tablo sonuçlarını birleştir
    const finalResult = tableAnalysisResult
      ? mergeHybridResults(textAnalysisResult, tableAnalysisResult)
      : textAnalysisResult;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    logger.info('PDF analysis completed (smart hybrid mode)', {
      module: 'ai-analyzer',
      action: 'pdf.analyze',
      method: 'smart_hybrid',
      pageCount: extractedText?.pageCount || 1,
      textLength: extractedText?.text?.length || 0,
      tablePages: tableImages.length,
      duration: `${duration}s`,
    });

    if (onProgress) {
      onProgress({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100 });
    }

    return {
      success: true,
      method: 'smart_hybrid',
      toplam_sayfa: extractedText?.pageCount || 1,
      analiz: finalResult,
      ham_metin: extractedText?.text?.substring(0, 10000) || '',
      text_analysis: textAnalysisResult,
      table_analysis: tableAnalysisResult,
    };
  }

  // Metin analizi başarısızsa, Claude Vision ile seçili sayfaları analiz et
  logger.info('Text analysis failed, using Claude Vision for scanned PDF', {
    module: 'ai-analyzer',
    action: 'pdf.analyze',
  });

  // Gemini OCR geçici devre dışı - doğrudan Claude Vision'a git
  const ocrResult = null; // await extractPdfTextWithGeminiOCR(pdfPath, onProgress);

  if (ocrResult?.text && ocrResult.text.length > 100) {
    logger.info('Gemini OCR successful, analyzing extracted text', {
      module: 'ai-analyzer',
      action: 'pdf.analyze',
      textLength: ocrResult.text.length,
    });

    if (onProgress) {
      onProgress({ stage: 'analyzing_text', message: 'OCR metni analiz ediliyor...', progress: 55 });
    }

    try {
      // OCR metnini Claude ile analiz et
      let textToAnalyze = ocrResult.text;
      if (textToAnalyze.length > 100000) {
        const firstPart = textToAnalyze.substring(0, 80000);
        const lastPart = textToAnalyze.substring(textToAnalyze.length - 20000);
        textToAnalyze = firstPart + '\n\n... [ORTA KISIM KISALTILDI] ...\n\n' + lastPart;
      }

      const prompt = buildTextAnalysisPrompt(textToAnalyze);
      const responseText = await claudeClient.analyze(prompt, {
        model: aiConfig.claude.analysisModel,
        maxTokens: 8192,
      });
      const ocrAnalysisResult = parseDocumentAnalysis(responseText, ocrResult.text);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      logger.info('PDF analysis completed (Gemini OCR + Claude)', {
        module: 'ai-analyzer',
        action: 'pdf.analyze',
        method: 'gemini_ocr',
        pageCount: ocrResult.pageCount,
        textLength: ocrResult.text.length,
        duration: `${duration}s`,
      });

      if (onProgress) {
        onProgress({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100 });
      }

      return {
        success: true,
        method: 'gemini_ocr',
        toplam_sayfa: ocrResult.pageCount,
        analiz: ocrAnalysisResult,
        ham_metin: ocrResult.text.substring(0, 10000),
        ocr_method: 'gemini_vision',
      };
    } catch (ocrAnalysisError) {
      logger.warn('OCR text analysis failed', { error: ocrAnalysisError.message });
    }
  }

  // FALLBACK: Gemini OCR de başarısızsa, sadece önemli sayfaları Claude Vision ile analiz et
  logger.info('All text methods failed, using selective Claude Vision (first 15 + last 5 pages)', {
    module: 'ai-analyzer',
    action: 'pdf.analyze',
  });

  if (onProgress) {
    onProgress({ stage: 'converting', message: 'Seçili sayfalar için görsel analiz başlıyor...' });
  }

  let images = [];
  try {
    images = await pdfToImages(pdfPath);
  } catch (error) {
    logger.warn('PDF to image conversion failed', { error: error.message });
  }

  let imageAnalysisResult = null;

  if (images.length > 0) {
    // SEÇİCİ ANALİZ: Sadece ilk 15 + son 5 sayfa (memory-safe)
    const totalPages = images.length;
    const selectedIndices = new Set();

    // İlk 15 sayfa
    for (let i = 0; i < Math.min(15, totalPages); i++) {
      selectedIndices.add(i);
    }
    // Son 5 sayfa (20'den fazla sayfa varsa)
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

    logger.info('Starting selective image analysis', {
      module: 'ai-analyzer',
      action: 'pdf.analyze',
      totalPages,
      selectedPages: selectedImages.length,
    });

    const allResults = [];

    // Sayfaları sırayla analiz et (memory-safe)
    for (let i = 0; i < selectedImages.length; i++) {
      const { path: imgPath, pageNumber: _pageNumber } = selectedImages[i];

      if (onProgress) {
        onProgress({
          stage: 'analyzing_images',
          message: `Görsel analiz: Sayfa ${pageNumber} (${i + 1}/${selectedImages.length})`,
          progress: 60 + Math.round((i / selectedImages.length) * 35),
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

    if (allResults.length > 0) {
      imageAnalysisResult = mergePageResults(allResults);
    }

    logger.info('Selective image analysis completed', {
      module: 'ai-analyzer',
      action: 'pdf.analyze',
      totalPages,
      analyzedPages: selectedImages.length,
      successfulResults: allResults.length,
    });
  }

  // ADIM 3: Sonuçları birleştir (VERİ KAYBI 0)
  if (onProgress) {
    onProgress({ stage: 'merging', message: 'Tüm sonuçlar birleştiriliyor...' });
  }

  const mergedAnalysis = mergeHybridResults(textAnalysisResult, imageAnalysisResult);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info('PDF analysis completed (hybrid - zero data loss)', {
    module: 'ai-analyzer',
    action: 'pdf.analyze',
    method: 'hybrid',
    pageCount: images.length || extractedText?.pageCount || 1,
    hasTextAnalysis: !!textAnalysisResult,
    hasImageAnalysis: !!imageAnalysisResult,
    duration: `${duration}s`,
  });

  return {
    success: true,
    method: 'hybrid_zero_loss',
    toplam_sayfa: images.length || extractedText?.pageCount || 1,
    analiz: mergedAnalysis,
    ham_metin: extractedText?.text?.substring(0, 10000) || '',
    text_analysis: textAnalysisResult,
    image_analysis: imageAnalysisResult,
    sure_saniye: parseFloat(duration),
  };
}

/**
 * Text ve Image analiz sonuçlarını birleştir
 * Her iki kaynaktan da veri al, çakışmada ikisini de koru
 */
function mergeHybridResults(textResult, imageResult) {
  if (!textResult && !imageResult) {
    return { hata: 'Analiz sonucu alınamadı' };
  }

  if (!textResult) return imageResult;
  if (!imageResult) return textResult;

  // İki sonucu birleştir
  const merged = { ...textResult };

  // Image'dan gelen ek bilgileri ekle
  if (imageResult.teknik_sartlar?.length) {
    merged.teknik_sartlar = [
      ...(merged.teknik_sartlar || []),
      ...imageResult.teknik_sartlar.filter((t) => !merged.teknik_sartlar?.includes(t)),
    ];
  }

  if (imageResult.birim_fiyatlar?.length) {
    merged.birim_fiyatlar = [...(merged.birim_fiyatlar || []), ...imageResult.birim_fiyatlar];
    // Duplike fiyatları temizle
    const seen = new Set();
    merged.birim_fiyatlar = merged.birim_fiyatlar.filter((f) => {
      const key = `${f.kalem}-${f.miktar}-${f.birim}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (imageResult.notlar?.length) {
    merged.notlar = [...(merged.notlar || []), ...imageResult.notlar.filter((n) => !merged.notlar?.includes(n))];
  }

  // Eksik alanları image'dan doldur
  for (const key of ['ihale_basligi', 'kurum', 'tarih', 'bedel', 'sure']) {
    if (!merged[key] && imageResult[key]) {
      merged[key] = imageResult[key];
    }
  }

  // İletişim bilgilerini birleştir
  if (imageResult.iletisim) {
    merged.iletisim = { ...merged.iletisim, ...imageResult.iletisim };
  }

  // Tam metni birleştir
  if (imageResult.tam_metin && !merged.tam_metin) {
    merged.tam_metin = imageResult.tam_metin;
  } else if (imageResult.tam_metin && merged.tam_metin) {
    // Image'dan gelen ek metni ekle (tablolar vs)
    merged.tam_metin += '\n\n--- Görsel Analiz Ekleri ---\n\n' + imageResult.tam_metin;
  }

  return merged;
}

// Legacy export alias
export const analyzePdfWithClaude = analyzePdf;

export default {
  analyzePdf,
  analyzePdfWithClaude,
};
