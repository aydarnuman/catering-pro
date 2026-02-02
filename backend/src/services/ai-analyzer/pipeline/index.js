/**
 * Document Analysis Pipeline
 * 3 Katmanlı Döküman İşleme Sistemi
 *
 * Layer 1: Extraction - Veri kaybı sıfır çıkarma
 * Layer 2: Chunking - Akıllı bölümleme
 * Layer 3: Analysis - 2 aşamalı AI analizi
 */

import logger from '../../../utils/logger.js';
import { extract } from './extractor.js';
import { chunk } from './chunker.js';
import { analyze } from './analyzer.js';

// OCR için Claude Vision import
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

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
 * OCR gereken dökümanlar için Claude Vision ile metin çıkar
 * @param {string} filePath - Dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>}
 */
async function performOcr(filePath, onProgress) {
  const ext = path.extname(filePath).toLowerCase();

  if (onProgress) {
    onProgress({ stage: 'ocr', message: 'OCR işlemi yapılıyor...', progress: 25 });
  }

  // PDF için sayfa görüntülerine dönüştür
  if (ext === '.pdf') {
    const tempDir = path.join(path.dirname(filePath), `ocr_temp_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // PDF'i PNG'lere dönüştür (ilk 20 sayfa)
      execSync(
        `pdftoppm -png -r 150 -l 20 "${filePath}" "${tempDir}/page"`,
        { timeout: 120000, stdio: 'pipe' }
      );

      const pageFiles = fs.readdirSync(tempDir)
        .filter(f => f.endsWith('.png'))
        .sort()
        .slice(0, 20);

      if (pageFiles.length === 0) {
        throw new Error('PDF görüntüye dönüştürülemedi');
      }

      // Her sayfayı OCR yap
      const pageTexts = [];
      for (let i = 0; i < pageFiles.length; i++) {
        const pagePath = path.join(tempDir, pageFiles[i]);
        const imageData = fs.readFileSync(pagePath);
        const base64Image = imageData.toString('base64');

        if (onProgress) {
          onProgress({
            stage: 'ocr',
            message: `OCR: Sayfa ${i + 1}/${pageFiles.length}`,
            progress: 25 + Math.round((i / pageFiles.length) * 20),
          });
        }

        try {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/png', data: base64Image },
                },
                {
                  type: 'text',
                  text: `Bu görüntüdeki TÜM metni oku ve aynen yaz.
Tablo varsa yapısını koru (| ile ayır).
Türkçe karakterleri doğru kullan.
Sadece metni döndür, yorum ekleme.`,
                },
              ],
            }],
          });

          pageTexts.push(response.content[0]?.text || '');
        } catch (ocrError) {
          logger.warn('Page OCR failed', { page: i + 1, error: ocrError.message });
        }
      }

      // Temizle
      fs.rmSync(tempDir, { recursive: true, force: true });

      return pageTexts.join('\n\n--- Sayfa ---\n\n');
    } catch (error) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      throw error;
    }
  }

  // Görsel dosyalar için direkt OCR
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    const imageData = fs.readFileSync(filePath);
    const base64Image = imageData.toString('base64');
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
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
Tablo varsa yapısını koru.
Türkçe karakterleri doğru kullan.
Sadece metni döndür.`,
          },
        ],
      }],
    });

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

    logger.info('═══ PIPELINE TAMAMLANDI ═══', {
      module: 'pipeline',
      duration: `${durationSec}s`,
      chunks: chunks.length,
      tokens: analysis.meta?.totalInputTokens + analysis.meta?.totalOutputTokens || 0,
      method: analysis.meta?.method || '2-stage',
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
