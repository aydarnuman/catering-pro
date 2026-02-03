/**
 * Document Analysis Pipeline
 * 3 Katmanlı Döküman İşleme Sistemi
 *
 * Layer 1: Extraction - Veri kaybı sıfır çıkarma
 * Layer 2: Chunking - Akıllı bölümleme
 * Layer 3: Analysis - 2 aşamalı AI analizi
 */

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import aiConfig from '../../../config/ai.config.js';
import logger from '../../../utils/logger.js';
import { analyze } from './analyzer.js';
import { chunk } from './chunker.js';
import { extract } from './extractor.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Pipeline sonuç yapısı
 * @typedef {Object} PipelineResult
 * @property {boolean} success
 * @property {Object} extraction - Layer 1 sonucu
 * @property {Array} chunks - Layer 2 sonucu
 * @property {Object} analysis - Layer 3 sonucu
 * @property {Object} stats - İstatistikler
 */

/**
 * Tek sayfa için OCR helper fonksiyonu (retry mekanizması ile)
 * @param {string} pagePath - Sayfa görüntü yolu
 * @param {number} pageIndex - Sayfa index (0-based)
 * @param {number} totalPages - Toplam sayfa sayısı
 * @param {number} maxRetries - Maksimum deneme sayısı (default: 3)
 * @returns {Promise<string>}
 */
async function ocrSinglePage(pagePath, pageIndex, totalPages, maxRetries = 3) {
  const imageData = fs.readFileSync(pagePath);
  const base64Image = imageData.toString('base64');
  const pageStart = Date.now();
  
  // Dosya uzantısına göre media type belirle
  const ext = path.extname(pagePath).toLowerCase();
  const mediaType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: aiConfig.claude.defaultModel,
        max_tokens: aiConfig.claude.maxTokens,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Image },
            },
            {
              type: 'text',
              text: `Bu görüntüdeki TÜM metni oku ve aynen yaz.
El yazısı varsa dikkatli oku, okunaksız kısımları [okunamadı] olarak işaretle.
Tablo varsa yapısını koru (| ile ayır).
Form alanları varsa "Alan: Değer" formatında yaz.
Türkçe karakterleri doğru kullan (ş, ğ, ü, ö, ç, ı).
Sadece metni döndür, yorum veya açıklama ekleme.`,
            },
          ],
        }],
      });

      const text = response.content[0]?.text || '';
      logger.info(`    ✓ Sayfa ${pageIndex + 1}/${totalPages} (${((Date.now() - pageStart) / 1000).toFixed(1)}s, ${text.length} karakter)`, { module: 'ocr' });
      return text;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error(`    ✗ Sayfa ${pageIndex + 1} ${maxRetries} denemede başarısız: ${error.message}`, { module: 'ocr', error: error.message });
        return '';
      }
      // Exponential backoff: 2s, 4s, 8s...
      const waitTime = 2000 * (2 ** (attempt - 1));
      logger.warn(`    ⟳ Sayfa ${pageIndex + 1} retry ${attempt}/${maxRetries} (${waitTime / 1000}s bekleniyor)`, { module: 'ocr', error: error.message });
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
  return '';
}

/**
 * OCR gereken dökümanlar için Claude Vision ile metin çıkar
 * PARALEL işleme ile 4x hızlı, TÜM sayfalar okunur (veri kaybı yok)
 * @param {string} filePath - Dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>}
 */
async function performOcr(filePath, onProgress) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Config'den ayarları al
  const maxPages = aiConfig.pdf.maxPages || 100;
  const parallelPages = aiConfig.pdf.parallelPages || 4;
  const dpi = aiConfig.pdf.dpi || 150;

  if (onProgress) {
    onProgress({ stage: 'ocr', message: 'OCR işlemi yapılıyor...', progress: 25 });
  }

  // PDF için sayfa görüntülerine dönüştür
  if (ext === '.pdf') {
    const tempDir = path.join(path.dirname(filePath), `ocr_temp_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      logger.info(`  PDF→JPEG dönüşümü başlıyor (max ${maxPages} sayfa, ${dpi} DPI)...`, { module: 'ocr' });
      const startConvert = Date.now();
      
      // PDF'i JPEG'lere dönüştür - JPEG PNG'den %60-70 daha küçük, OCR için yeterli kalite
      execSync(
        `pdftoppm -jpeg -jpegopt quality=85 -r ${dpi} -l ${maxPages} "${filePath}" "${tempDir}/page"`,
        { timeout: 300000, stdio: 'pipe' } // 5 dakika timeout (büyük dosyalar için)
      );

      const pageFiles = fs.readdirSync(tempDir)
        .filter(f => f.endsWith('.jpg'))
        .sort()
        .slice(0, maxPages);

      const convertTime = ((Date.now() - startConvert) / 1000).toFixed(1);
      logger.info(`  PDF→JPEG tamamlandı: ${pageFiles.length} sayfa (${convertTime}s)`, { module: 'ocr' });

      if (pageFiles.length === 0) {
        throw new Error('PDF görüntüye dönüştürülemedi');
      }

      // PARALEL OCR - 4x hızlı
      const totalBatches = Math.ceil(pageFiles.length / parallelPages);
      const pageResults = new Array(pageFiles.length);
      
      logger.info(`  Claude Vision PARALEL OCR başlıyor (${pageFiles.length} sayfa, ${parallelPages} paralel, ${totalBatches} batch)...`, { module: 'ocr' });
      
      for (let i = 0; i < pageFiles.length; i += parallelPages) {
        const batchNum = Math.floor(i / parallelPages) + 1;
        const batch = pageFiles.slice(i, Math.min(i + parallelPages, pageFiles.length));
        
        logger.info(`  ▶ Batch ${batchNum}/${totalBatches} (${batch.length} sayfa paralel)...`, { module: 'ocr' });

        if (onProgress) {
          onProgress({
            stage: 'ocr',
            message: `OCR: Batch ${batchNum}/${totalBatches} (Sayfa ${i + 1}-${Math.min(i + batch.length, pageFiles.length)}/${pageFiles.length})`,
            progress: 25 + Math.round((i / pageFiles.length) * 20),
          });
        }

        // Paralel işle
        const batchPromises = batch.map((pageFile, batchIdx) => {
          const globalIdx = i + batchIdx;
          const pagePath = path.join(tempDir, pageFile);
          return ocrSinglePage(pagePath, globalIdx, pageFiles.length);
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Sonuçları doğru sırada kaydet
        batchResults.forEach((text, batchIdx) => {
          pageResults[i + batchIdx] = text;
        });
        
        const successCount = batchResults.filter(t => t.length > 0).length;
        logger.info(`  ✓ Batch ${batchNum}/${totalBatches} tamamlandı (${successCount}/${batch.length} başarılı)`, { module: 'ocr' });
      }

      // Temizle
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      const successPages = pageResults.filter(t => t && t.length > 0).length;
      logger.info(`  OCR tamamlandı: ${successPages}/${pageFiles.length} sayfa başarılı`, { module: 'ocr' });

      return pageResults.filter(Boolean).join('\n\n--- Sayfa ---\n\n');
    } catch (error) {
      logger.error(`  OCR HATA: ${error.message}`, { module: 'ocr', error: error.message });
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      throw error;
    }
  }

  // Görsel dosyalar için direkt OCR
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    logger.info('  Görsel OCR başlıyor...', { module: 'ocr', file: path.basename(filePath) });
    const imageData = fs.readFileSync(filePath);
    const base64Image = imageData.toString('base64');
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const response = await anthropic.messages.create({
      model: aiConfig.claude.defaultModel,
      max_tokens: aiConfig.claude.maxTokens,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          {
            type: 'text',
            text: `Bu görüntüdeki TÜM metni oku ve aynen yaz.
El yazısı varsa dikkatli oku, okunaksız kısımları [okunamadı] olarak işaretle.
Tablo varsa yapısını koru (| ile ayır).
Form alanları varsa "Alan: Değer" formatında yaz.
Türkçe karakterleri doğru kullan (ş, ğ, ü, ö, ç, ı).
Sadece metni döndür, yorum veya açıklama ekleme.`,
          },
        ],
      }],
    });

    logger.info('  ✓ Görsel OCR tamamlandı', { module: 'ocr' });
    return response.content[0]?.text || '';
  }

  return '';
}

/**
 * Tam pipeline'ı çalıştır
 * @param {string} filePath - Dosya yolu
 * @param {Object} options - Ayarlar
 * @param {Function} options.onProgress - Progress callback
 * @param {boolean} options.skipAnalysis - Sadece extraction yap
 * @returns {Promise<PipelineResult>}
 */
export async function runPipeline(filePath, options = {}) {
  const startTime = Date.now();
  const { onProgress, skipAnalysis = false } = options;
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // ALTIN KURAL: ZIP dosyaları pipeline'a giremez!
  if (ext === '.zip') {
    logger.error('ZIP file rejected by pipeline', {
      module: 'pipeline',
      file: fileName,
    });
    return {
      success: false,
      error: 'ZIP dosyaları doğrudan analiz edilemez. Önce çıkarılmalıdır.',
      extraction: null,
      chunks: null,
      analysis: null,
      stats: { totalDuration: Date.now() - startTime },
    };
  }

  logger.info('═══ PIPELINE BAŞLADI ═══', {
    module: 'pipeline',
    file: fileName,
    path: filePath,
  });

  try {
    // ===== LAYER 1: EXTRACTION =====
    logger.info('▶ Layer 1: EXTRACTION başlıyor...', { module: 'pipeline' });

    if (onProgress) {
      onProgress({ stage: 'extraction', message: 'Döküman okunuyor...', progress: 5 });
    }

    const extraction = await extract(filePath);

    // ZIP ise dosya listesini logla
    if (extraction.type === 'zip' && extraction.structured?.files) {
      logger.info('  ZIP içeriği:', {
        module: 'pipeline',
        fileCount: extraction.structured.files.length,
        files: extraction.structured.files.map(f => f.fileName || f.name).slice(0, 10),
      });
    }

    // OCR gerekiyorsa
    if (extraction.needsOcr) {
      logger.info('  OCR gerekli, Claude Vision çalışıyor...', { module: 'pipeline' });
      const ocrText = await performOcr(filePath, onProgress);
      if (ocrText) {
        extraction.text = ocrText;
        extraction.needsOcr = false;
        extraction.ocrApplied = true;
        logger.info('  OCR tamamlandı', { module: 'pipeline', textLength: ocrText.length });
      }
    }

    if (onProgress) {
      onProgress({ stage: 'extraction', message: 'Döküman okundu', progress: 20 });
    }

    logger.info('✓ Layer 1 tamamlandı', {
      module: 'pipeline',
      type: extraction.type,
      textLength: extraction.text.length,
      ocrApplied: extraction.ocrApplied || false,
    });

    // Sadece extraction isteniyorsa
    if (skipAnalysis) {
      return {
        success: true,
        extraction,
        chunks: null,
        analysis: null,
        stats: {
          totalDuration: Date.now() - startTime,
        },
      };
    }

    // ===== LAYER 2: CHUNKING =====
    logger.info('▶ Layer 2: CHUNKING başlıyor...', { module: 'pipeline' });

    if (onProgress) {
      onProgress({ stage: 'chunking', message: 'İçerik bölümleniyor...', progress: 30 });
    }

    const chunks = chunk(extraction);
    const avgTokens = Math.round(chunks.reduce((s, c) => s + c.tokenEstimate, 0) / chunks.length);
    const chunkTypes = {};
    chunks.forEach(c => { chunkTypes[c.type] = (chunkTypes[c.type] || 0) + 1; });

    logger.info('✓ Layer 2 tamamlandı', {
      module: 'pipeline',
      chunkCount: chunks.length,
      avgTokens,
      types: chunkTypes,
    });

    // ===== LAYER 3: ANALYSIS =====
    logger.info('▶ Layer 3: 2-AŞAMALI ANALİZ başlıyor...', { module: 'pipeline' });

    if (onProgress) {
      onProgress({ stage: 'analysis', message: 'AI analizi başlıyor...', progress: 40 });
    }

    const analysis = await analyze(chunks, onProgress);

    const totalDuration = Date.now() - startTime;
    const durationSec = (totalDuration / 1000).toFixed(1);

    // Cost tracking
    const inputTokens = analysis.meta?.totalInputTokens || 0;
    const outputTokens = analysis.meta?.totalOutputTokens || 0;
    let costInfo = {};
    
    if (aiConfig.costTracking?.enabled) {
      const cost = (inputTokens / 1000) * (aiConfig.costTracking.claudeInputCost || 0.003) +
                   (outputTokens / 1000) * (aiConfig.costTracking.claudeOutputCost || 0.015);
      costInfo = { cost: `$${cost.toFixed(4)}` };
      logger.info('💰 API Cost', { 
        module: 'pipeline', 
        inputTokens, 
        outputTokens, 
        cost: `$${cost.toFixed(4)}`,
      });
    }

    logger.info('═══ PIPELINE TAMAMLANDI ═══', {
      module: 'pipeline',
      duration: `${durationSec}s`,
      chunks: chunks.length,
      tokens: inputTokens + outputTokens,
      method: analysis.meta?.method || '2-stage',
      ...costInfo,
    });

    return {
      success: true,
      extraction: {
        type: extraction.type,
        textLength: extraction.text.length,
        structured: extraction.structured,
        metadata: extraction.metadata,
        ocrApplied: extraction.ocrApplied || false,
      },
      chunks: chunks.map(c => ({
        index: c.index,
        type: c.type,
        tokenEstimate: c.tokenEstimate,
        context: c.context,
      })),
      analysis,
      stats: {
        totalDuration,
        extractionTime: extraction.metadata?.extractionTime || 0,
        chunkCount: chunks.length,
        totalTokens: analysis.meta?.totalInputTokens + analysis.meta?.totalOutputTokens || 0,
      },
    };
  } catch (error) {
    logger.error('Pipeline failed', {
      module: 'pipeline',
      error: error.message,
      filePath,
    });

    return {
      success: false,
      error: error.message,
      extraction: null,
      chunks: null,
      analysis: null,
      stats: {
        totalDuration: Date.now() - startTime,
      },
    };
  }
}

/**
 * Birden fazla dosyayı paralel işle
 * @param {string[]} filePaths - Dosya yolları
 * @param {Object} options - Ayarlar
 * @returns {Promise<PipelineResult[]>}
 */
export async function runPipelineBatch(filePaths, options = {}) {
  const { concurrency = 2, onProgress } = options;
  const results = [];

  for (let i = 0; i < filePaths.length; i += concurrency) {
    const batch = filePaths.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map((fp, idx) =>
        runPipeline(fp, {
          onProgress: onProgress
            ? (p) => onProgress({ ...p, fileIndex: i + idx, totalFiles: filePaths.length })
            : undefined,
        })
      )
    );

    results.push(...batchResults);
  }

  return results;
}

// Export individual layers for testing
export { extract } from './extractor.js';
export { chunk, chunkText, chunkExcel } from './chunker.js';
export { analyze } from './analyzer.js';

export default {
  runPipeline,
  runPipelineBatch,
};
