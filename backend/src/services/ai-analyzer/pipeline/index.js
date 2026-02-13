/**
 * Document Analysis Pipeline
 * Zero-Loss Pipeline - 8 Katmanlı Döküman İşleme Sistemi
 *
 * Layer 0: Raw Capture (Extraction)
 * Layer 1: Structure Detection (Rule-based)
 * Layer 2: Semantic Chunking (P0 kontrollü)
 * Layer 3: Field Extraction (LLM - Micro veya Full)
 * Layer 4: Cross-Reference Resolution
 * Layer 5: Conflict Detection
 * Layer 6: Assembly
 * Layer 6.5: Fill Missing Critical Fields (NEW)
 * Layer 7: Validation
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import aiConfig from '../../../config/ai.config.js';
import logger from '../../../utils/logger.js';
import { applyResolutions, resolveConflicts } from '../controls/conflict-resolver.js';
import { findRelevantChunks, logValidationResult, validateCriticalFields } from '../controls/field-validator.js';
import { createTextHash, runAllP0Checks } from '../controls/p0-checks.js';
import { createErrorOutput, createSuccessOutput } from '../schemas/final-output.js';
import { safeJsonParse } from '../utils/parser.js';
import { analyze, analyzeZeroLoss } from './analyzer.js';
import { assembleResults, validateNoNewInformation } from './assembler.js';
import { chunk, chunkTextWithStructure, validateCharacterCount } from './chunker.js';
import { detectConflicts, generateConflictReport } from './conflict.js';
import { extract } from './extractor.js';
import { detectStructure, resolveReferences } from './structure.js';
import { validateOutput } from './validator.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Helpers: Compute catering counts from assembled meals ──────

/**
 * Assembled meals dizisinden gunluk ogun sayisini hesapla.
 * Her benzersiz tur (kahvalti, ogle, aksam, vb.) bir ogun sayilir.
 */
function computeDailyMealCount(meals) {
  if (!meals || !Array.isArray(meals) || meals.length === 0) return null;
  const uniqueTypes = new Set();
  for (const m of meals) {
    const t = (m.type || m.tur || '').toLowerCase().trim();
    if (t) uniqueTypes.add(t);
  }
  return uniqueTypes.size > 0 ? uniqueTypes.size : null;
}

/**
 * Assembled meals dizisinden toplam kisi sayisini hesapla.
 * Her ogunun daily_count/miktar/person_count degerinden en buyugunu alir.
 */
function computePersonCount(meals) {
  if (!meals || !Array.isArray(meals) || meals.length === 0) return null;
  let maxCount = 0;
  for (const m of meals) {
    const count = parseNumeric(m.daily_count) || parseNumeric(m.miktar) || parseNumeric(m.person_count) || 0;
    if (count > maxCount) maxCount = count;
  }
  return maxCount > 0 ? maxCount : null;
}

/**
 * Metin veya sayidan sayi cikar. "500 kisi" -> 500, "1.250" -> 1250, null -> null
 */
function parseNumeric(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return null;
  // Sadece rakamlari cikar (Turkce binlik ayiracini kaldir)
  const cleaned = val
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : Math.round(num);
}

/**
 * Eksik kritik alanları doldurmak için focused extraction
 * @param {Object} analysis - Mevcut analiz sonucu
 * @param {Array} chunks - Tüm chunk'lar
 * @param {Array} missingFields - Eksik alan listesi
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Güncellenmiş analiz
 */
async function fillMissingFields(analysis, chunks, missingFields, _onProgress) {
  const filled = [];

  for (const { field, config } of missingFields) {
    logger.info(`▶ Filling missing field: ${field}`, { module: 'fill-missing' });

    // İlgili chunk'ları bul
    let relevantChunks = findRelevantChunks(chunks, config);

    // İlgili chunk bulunamadıysa ilk 3 chunk'ı dene
    if (relevantChunks.length === 0) {
      logger.warn(`No relevant chunks found for ${field}, using first 3 chunks`, { module: 'fill-missing' });
      relevantChunks = chunks.slice(0, 3);
    }

    // Her relevant chunk için focused prompt ile dene
    for (const chunk of relevantChunks) {
      try {
        const response = await anthropic.messages.create({
          model: aiConfig.claude.defaultModel, // Sonnet (daha güçlü)
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: config.fallbackPrompt + '\n\nMETİN:\n' + chunk.content,
            },
          ],
        });

        const responseText = response.content[0]?.text || '{}';
        const parsed = safeJsonParse(responseText);

        if (parsed?.[field]) {
          const extractedValue = parsed[field];

          // "Belirtilmemiş" değilse ve içerik varsa kullan
          const hasRealContent =
            typeof extractedValue === 'object'
              ? Object.values(extractedValue).some((v) => v && v !== '' && v !== 'Belirtilmemiş')
              : extractedValue && extractedValue !== 'Belirtilmemiş';

          if (hasRealContent) {
            // Mevcut değerle birleştir (object ise merge, değilse üzerine yaz)
            if (typeof extractedValue === 'object' && typeof analysis[field] === 'object') {
              analysis[field] = { ...analysis[field], ...extractedValue };
            } else {
              analysis[field] = extractedValue;
            }

            filled.push(field);
            logger.info(`✓ Field filled: ${field}`, {
              module: 'fill-missing',
              value: JSON.stringify(extractedValue).substring(0, 100),
            });
            break; // Bu alan için başarılı, sonraki alana geç
          }
        }
      } catch (err) {
        logger.warn(`Fill attempt failed for ${field}`, {
          module: 'fill-missing',
          error: err.message,
        });
      }
    }
  }

  logger.info(`Fill missing completed: ${filled.length}/${missingFields.length} fields filled`, {
    module: 'fill-missing',
    filled,
    stillMissing: missingFields.filter((m) => !filled.includes(m.field)).map((m) => m.field),
  });

  return analysis;
}

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
 * Tesseract.js ile lokal OCR fallback
 * Claude Vision başarısız olursa bu fonksiyon devreye girer.
 * @param {string} pagePath - Sayfa görüntü yolu
 * @param {number} pageIndex - Sayfa index (0-based)
 * @returns {Promise<string>}
 */
async function ocrWithTesseract(pagePath, pageIndex) {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('tur+eng'); // Türkçe + İngilizce

    const { data } = await worker.recognize(pagePath);
    await worker.terminate();

    const text = data.text || '';
    logger.info(`    ✓ Tesseract fallback sayfa ${pageIndex + 1} (${text.length} karakter)`, {
      module: 'ocr-tesseract',
    });
    return text;
  } catch (err) {
    logger.warn(`    ✗ Tesseract fallback başarısız sayfa ${pageIndex + 1}: ${err.message}`, {
      module: 'ocr-tesseract',
    });
    return '';
  }
}

/**
 * Tek sayfa için OCR helper fonksiyonu (retry mekanizması + Tesseract fallback)
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
        messages: [
          {
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
          },
        ],
      });

      const text = response.content[0]?.text || '';
      logger.info(
        `    ✓ Sayfa ${pageIndex + 1}/${totalPages} (${((Date.now() - pageStart) / 1000).toFixed(1)}s, ${text.length} karakter)`,
        { module: 'ocr' }
      );
      return text;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error(
          `    ✗ Sayfa ${pageIndex + 1} Claude Vision ${maxRetries} denemede başarısız, Tesseract fallback deneniyor...`,
          {
            module: 'ocr',
            error: error.message,
          }
        );
        // Tesseract.js lokal OCR fallback
        return ocrWithTesseract(pagePath, pageIndex);
      }
      // Exponential backoff: 2s, 4s, 8s...
      const waitTime = 2000 * 2 ** (attempt - 1);
      logger.warn(`    ⟳ Sayfa ${pageIndex + 1} retry ${attempt}/${maxRetries} (${waitTime / 1000}s bekleniyor)`, {
        module: 'ocr',
        error: error.message,
      });
      await new Promise((r) => setTimeout(r, waitTime));
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
  const dpi = aiConfig.pdf.dpi || 250;
  const jpegQuality = aiConfig.pdf.jpegQuality || 85;

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
        `pdftoppm -jpeg -jpegopt quality=${jpegQuality} -r ${dpi} -l ${maxPages} "${filePath}" "${tempDir}/page"`,
        { timeout: 300000, stdio: 'pipe' } // 5 dakika timeout (büyük dosyalar için)
      );

      const pageFiles = fs
        .readdirSync(tempDir)
        .filter((f) => f.endsWith('.jpg'))
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

      logger.info(
        `  Claude Vision PARALEL OCR başlıyor (${pageFiles.length} sayfa, ${parallelPages} paralel, ${totalBatches} batch)...`,
        { module: 'ocr' }
      );

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

        const successCount = batchResults.filter((t) => t.length > 0).length;
        logger.info(`  ✓ Batch ${batchNum}/${totalBatches} tamamlandı (${successCount}/${batch.length} başarılı)`, {
          module: 'ocr',
        });
      }

      // Temizle
      fs.rmSync(tempDir, { recursive: true, force: true });

      const successPages = pageResults.filter((t) => t && t.length > 0).length;
      logger.info(`  OCR tamamlandı: ${successPages}/${pageFiles.length} sayfa başarılı`, { module: 'ocr' });

      return pageResults.filter(Boolean).join('\n\n--- Sayfa ---\n\n');
    } catch (error) {
      logger.error(`  OCR HATA: ${error.message}`, { module: 'ocr', error: error.message });
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
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
      messages: [
        {
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
        },
      ],
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
        files: extraction.structured.files.map((f) => f.fileName || f.name).slice(0, 10),
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
    chunks.forEach((c) => {
      chunkTypes[c.type] = (chunkTypes[c.type] || 0) + 1;
    });

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
      const cost =
        (inputTokens / 1000) * (aiConfig.costTracking.claudeInputCost || 0.003) +
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
      chunks: chunks.map((c) => ({
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

/**
 * Zero-Loss Pipeline - 7 Katmanlı Tam Döküman Analizi
 *
 * P0 Kontrolleri:
 * - P0-01: Tablo bölünme yasağı
 * - P0-02: Tablo dipnotu birlikteliği
 * - P0-03: Başlık-içerik birlikteliği
 * - P0-05: Karakter kaybı kontrolü
 * - P0-06: JSON parse garantisi
 * - P0-07: Null vs empty ayrımı
 * - P0-08: Yeni bilgi ekleme yasağı
 * - P0-09: Conflict preservation
 * - P0-10: Source traceability
 *
 * @param {string} filePath - Dosya yolu
 * @param {Object} options - Ayarlar
 * @returns {Promise<Object>} Zero-Loss analiz sonucu
 */
export async function runZeroLossPipeline(filePath, options = {}) {
  const startTime = Date.now();
  const {
    onProgress,
    extractionTypes = ['full'], // veya ['dates', 'amounts', 'penalties', 'menu', 'personnel']
    useMicroExtraction = false,
    enableP0Checks = true,
    enableConflictDetection = true,
    concurrency = 4,
  } = options;

  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // ZIP kontrolü
  if (ext === '.zip') {
    logger.error('ZIP file rejected by Zero-Loss pipeline', { module: 'zero-loss', file: fileName });
    return createErrorOutput(documentId, 'ZIP dosyaları doğrudan analiz edilemez');
  }

  logger.info('═══ ZERO-LOSS PIPELINE BAŞLADI ═══', {
    module: 'zero-loss',
    file: fileName,
    extractionTypes,
    useMicroExtraction,
  });

  try {
    // ===== LAYER 0: RAW CAPTURE (EXTRACTION) =====
    if (onProgress) {
      onProgress({ stage: 'extraction', message: 'Döküman okunuyor...', progress: 5 });
    }

    logger.info('▶ Layer 0: RAW CAPTURE başlıyor...', { module: 'zero-loss' });
    const extraction = await extract(filePath);

    // OCR gerekiyorsa
    if (extraction.needsOcr) {
      logger.info('  OCR gerekli, Claude Vision çalışıyor...', { module: 'zero-loss' });
      const ocrText = await performOcr(filePath, onProgress);
      if (ocrText) {
        extraction.text = ocrText;
        extraction.needsOcr = false;
        extraction.ocrApplied = true;
      }
    }

    const originalText = extraction.text;
    const _originalTextHash = createTextHash(originalText);

    logger.info('✓ Layer 0 tamamlandı', {
      module: 'zero-loss',
      textLength: originalText.length,
      ocrApplied: extraction.ocrApplied || false,
    });

    // ===== LAYER 1: STRUCTURE DETECTION =====
    if (onProgress) {
      onProgress({ stage: 'structure', message: 'Yapı analizi yapılıyor...', progress: 10 });
    }

    logger.info('▶ Layer 1: STRUCTURE DETECTION başlıyor...', { module: 'zero-loss' });
    const structureInfo = detectStructure(originalText);

    logger.info('✓ Layer 1 tamamlandı', {
      module: 'zero-loss',
      tables: structureInfo.stats.tableCount,
      headings: structureInfo.stats.headingCount,
      references: structureInfo.stats.referenceCount,
    });

    // ===== LAYER 2: SEMANTIC CHUNKING (P0 kontrollü) =====
    if (onProgress) {
      onProgress({ stage: 'chunking', message: 'İçerik bölümleniyor (P0 kontrollü)...', progress: 15 });
    }

    logger.info('▶ Layer 2: SEMANTIC CHUNKING başlıyor...', { module: 'zero-loss' });
    const chunks = chunkTextWithStructure(originalText, structureInfo, {
      preserveTables: true, // P0-01
      preserveHeadingContent: true, // P0-03
    });

    // P0-05: Karakter kaybı kontrolü
    const charValidation = validateCharacterCount(originalText, chunks);
    if (!charValidation.valid) {
      logger.warn('P0-05 WARNING: Karakter kaybı tespit edildi', {
        module: 'zero-loss',
        ...charValidation,
      });
    }

    logger.info('✓ Layer 2 tamamlandı', {
      module: 'zero-loss',
      chunkCount: chunks.length,
      p0_05_valid: charValidation.valid,
    });

    // ===== LAYER 3: FIELD EXTRACTION =====
    if (onProgress) {
      onProgress({ stage: 'extraction', message: 'AI analizi başlıyor...', progress: 25 });
    }

    logger.info('▶ Layer 3: FIELD EXTRACTION başlıyor...', { module: 'zero-loss' });

    const analysisResult = await analyzeZeroLoss(
      chunks,
      {
        extractionTypes,
        useMicroExtraction,
        concurrency,
      },
      onProgress
    );

    const stage1Results = analysisResult.stage1Results;

    logger.info('✓ Layer 3 tamamlandı', {
      module: 'zero-loss',
      method: analysisResult.method,
      extractionTypes: analysisResult.extractionTypes,
      totalFindings: stage1Results.reduce((sum, r) => sum + (r.findings?.length || 0), 0),
    });

    // ===== LAYER 4: CROSS-REFERENCE RESOLUTION =====
    if (onProgress) {
      onProgress({ stage: 'reference', message: 'Referanslar çözümleniyor...', progress: 60 });
    }

    logger.info('▶ Layer 4: CROSS-REFERENCE RESOLUTION başlıyor...', { module: 'zero-loss' });

    // Referansları çözümle (başlıklarla eşleştir)
    const referenceResolution = resolveReferences(structureInfo.references, structureInfo.headings, originalText);

    const unresolvedReferences = referenceResolution.unresolved.map((u) => ({
      reference_text: u.reference.fullMatch,
      target: u.reference.targetNumber,
      reason: u.reason,
      suggestions: u.suggestions,
    }));

    logger.info('✓ Layer 4 tamamlandı', {
      module: 'zero-loss',
      totalReferences: structureInfo.references.length,
      resolved: referenceResolution.resolved.length,
      unresolved: unresolvedReferences.length,
      resolutionRate: `${referenceResolution.stats.resolution_rate.toFixed(1)}%`,
    });

    // ===== LAYER 5: CONFLICT DETECTION =====
    if (onProgress) {
      onProgress({ stage: 'conflict', message: 'Çelişkiler tespit ediliyor...', progress: 70 });
    }

    logger.info('▶ Layer 5: CONFLICT DETECTION başlıyor...', { module: 'zero-loss' });

    const conflicts = enableConflictDetection ? detectConflicts(stage1Results) : [];
    const conflictReport = generateConflictReport(conflicts);

    // ===== LAYER 5.5: CONFLICT RESOLUTION (NEW) =====
    let resolvedConflicts = { resolved: [], unresolved: [], stats: { total: 0, auto_resolved: 0, manual_review: 0 } };
    if (conflicts.length > 0) {
      resolvedConflicts = resolveConflicts(conflicts);
      logger.info('✓ Layer 5.5: Çatışma çözümü tamamlandı', {
        module: 'zero-loss',
        total: resolvedConflicts.stats.total,
        autoResolved: resolvedConflicts.stats.auto_resolved,
        manualReview: resolvedConflicts.stats.manual_review,
      });
    }

    logger.info('✓ Layer 5 tamamlandı', {
      module: 'zero-loss',
      conflictsFound: conflicts.length,
      criticalConflicts: conflictReport.critical_conflicts,
      autoResolved: resolvedConflicts.stats.auto_resolved,
    });

    // ===== LAYER 6: ASSEMBLY =====
    if (onProgress) {
      onProgress({ stage: 'assembly', message: 'Sonuçlar birleştiriliyor...', progress: 80 });
    }

    logger.info('▶ Layer 6: ASSEMBLY başlıyor...', { module: 'zero-loss' });

    let assembled = assembleResults(stage1Results, conflicts);

    // Otomatik çözülen çatışmaları assembly sonucuna uygula
    if (resolvedConflicts.resolved.length > 0) {
      assembled = applyResolutions(assembled, resolvedConflicts);
      logger.info("✓ Çatışma çözümleri assembly'e uygulandı", {
        module: 'zero-loss',
        appliedCount: resolvedConflicts.resolved.length,
      });
    }

    // P0-08: Yeni bilgi ekleme kontrolü
    const noNewInfoCheck = validateNoNewInformation(stage1Results, assembled);
    if (!noNewInfoCheck.valid) {
      logger.warn("P0-08 WARNING: Assembly'de yeni bilgi tespit edildi", {
        module: 'zero-loss',
        newValues: noNewInfoCheck.newValues,
      });
    }

    logger.info('✓ Layer 6 tamamlandı', {
      module: 'zero-loss',
      dates: assembled.fields.dates.length,
      amounts: assembled.fields.amounts.length,
      penalties: assembled.fields.penalties.length,
      p0_08_valid: noNewInfoCheck.valid,
    });

    // ===== LAYER 6.5: FILL MISSING CRITICAL FIELDS =====
    if (onProgress) {
      onProgress({ stage: 'fill_missing', message: 'Kritik alanlar kontrol ediliyor...', progress: 82 });
    }

    logger.info('▶ Layer 6.5: FILL MISSING CRITICAL FIELDS başlıyor...', { module: 'zero-loss' });

    // Kritik alanları kontrol et
    let criticalValidation = validateCriticalFields(assembled);
    logValidationResult(criticalValidation, 'post-assembly');

    // finalAssembled: Layer 6.5 sonrası kullanılacak obje
    let finalAssembled = assembled;

    // Eksik kritik alanlar varsa doldurmaya çalış
    if (!criticalValidation.valid && criticalValidation.missing.length > 0) {
      logger.info(`Found ${criticalValidation.missing.length} missing critical fields, attempting to fill...`, {
        module: 'zero-loss',
        missingFields: criticalValidation.missing.map((m) => m.field),
      });

      if (onProgress) {
        onProgress({
          stage: 'fill_missing',
          message: `Eksik alanlar dolduruluyor (${criticalValidation.missing.length})...`,
          progress: 85,
        });
      }

      // Eksik alanları doldur - sonucu finalAssembled'a ata
      finalAssembled = await fillMissingFields(assembled, chunks, criticalValidation.missing, onProgress);

      // Re-validate
      const revalidation = validateCriticalFields(finalAssembled);
      logValidationResult(revalidation, 'post-fill');

      logger.info('✓ Layer 6.5 tamamlandı', {
        module: 'zero-loss',
        beforeCompleteness: `${(criticalValidation.completeness * 100).toFixed(1)}%`,
        afterCompleteness: `${(revalidation.completeness * 100).toFixed(1)}%`,
        filledCount: criticalValidation.missing.length - revalidation.missing.length,
      });

      // Final validation'ı güncelle
      criticalValidation = revalidation;
    } else {
      logger.info('✓ Layer 6.5 atlandı - Tüm kritik alanlar dolu', {
        module: 'zero-loss',
        completeness: `${(criticalValidation.completeness * 100).toFixed(1)}%`,
      });
    }

    // ===== LAYER 7: VALIDATION =====
    if (onProgress) {
      onProgress({ stage: 'validation', message: 'Doğrulama yapılıyor...', progress: 90 });
    }

    logger.info('▶ Layer 7: VALIDATION başlıyor...', { module: 'zero-loss' });

    const validation = validateOutput(finalAssembled, {
      chunks,
      structureInfo,
      originalText,
      stage1Results,
      stage2Result: finalAssembled,
      detectedConflicts: conflicts,
    });

    // P0 kontrolleri (tüm)
    let p0Summary = null;
    if (enableP0Checks) {
      p0Summary = runAllP0Checks({
        chunks,
        structureInfo,
        originalText,
        stage1Results,
        stage2Result: finalAssembled,
        finalResult: finalAssembled,
        detectedConflicts: conflicts,
      });
    }

    logger.info('✓ Layer 7 tamamlandı', {
      module: 'zero-loss',
      valid: validation.valid,
      completenessScore: validation.completeness_score,
      p0AllPassed: p0Summary?.all_passed ?? 'skipped',
    });

    // ===== FINAL OUTPUT =====
    const totalDuration = Date.now() - startTime;

    if (onProgress) {
      onProgress({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100 });
    }

    // Final sonucu oluştur (finalAssembled = Layer 6.5 sonrası)
    const analysis = {
      // Kritik alanlar (Layer 6.5'ten)
      iletisim: finalAssembled.iletisim,
      teminat_oranlari: finalAssembled.teminat_oranlari,
      servis_saatleri: finalAssembled.servis_saatleri,
      mali_kriterler: finalAssembled.mali_kriterler,
      tahmini_bedel: finalAssembled.tahmini_bedel,

      summary: {
        title: '',
        institution: '',
        tender_type: '',
        estimated_value:
          finalAssembled.tahmini_bedel ||
          finalAssembled.fields.amounts.find((a) => a.type === 'yaklasik_maliyet')?.value ||
          '',
        duration: '',
        ikn: '',
      },
      dates: {
        tender_date: finalAssembled.fields.dates.find((d) => d.type === 'ihale_tarihi')?.value || null,
        start_date: finalAssembled.fields.dates.find((d) => d.type === 'baslangic')?.value || null,
        end_date: finalAssembled.fields.dates.find((d) => d.type === 'bitis')?.value || null,
        deadline: finalAssembled.fields.dates.find((d) => d.type === 'son_basvuru')?.value || null,
        all_dates: finalAssembled.fields.dates,
      },
      financial: {
        estimated_cost: finalAssembled.fields.amounts.find((a) => a.type === 'yaklasik_maliyet') || {},
        unit_prices: finalAssembled.fields.amounts.filter((a) => a.type === 'birim_fiyat'),
        guarantees: finalAssembled.teminat_oranlari || {},
        all_amounts: finalAssembled.fields.amounts,
      },
      penalties: finalAssembled.fields.penalties,
      catering: {
        meals: finalAssembled.fields.menus.meals,
        gramaj: finalAssembled.fields.menus.gramaj,
        service_times: finalAssembled.servis_saatleri || finalAssembled.fields.menus.service_times,
        quality_requirements: finalAssembled.fields.menus.quality_requirements,
        daily_meal_count: computeDailyMealCount(finalAssembled.fields.menus.meals),
        person_count: computePersonCount(finalAssembled.fields.menus.meals),
      },
      personnel: finalAssembled.fields.personnel,
      technical_requirements: finalAssembled.fields.requirements,
      required_documents: finalAssembled.fields.required_documents,
      contact: finalAssembled.iletisim || {},
      important_notes: finalAssembled.important_notes,

      // Kritik alan validasyon sonucu
      _critical_fields_validation: criticalValidation,
    };

    const result = createSuccessOutput(
      documentId,
      analysis,
      {
        valid: validation.valid,
        schema_errors: validation.schema_errors,
        completeness_score: validation.completeness_score,
        completeness_details: validation.completeness_details,
        p0_checks: p0Summary || { all_passed: true, checks: [] },
      },
      {
        pipeline_version: '2.0.0',
        stats: {
          total_chunks: chunks.length,
          extraction_types: extractionTypes,
          total_findings: stage1Results.reduce((sum, r) => sum + (r.findings?.length || 0), 0),
          total_duration_ms: totalDuration,
          total_tokens: analysisResult.meta?.totalTokens || 0,
        },
        file_info: {
          name: fileName,
          type: extraction.type,
          size: extraction.metadata?.fileSize || 0,
          ocr_applied: extraction.ocrApplied || false,
        },
        chunk_summary: chunks.map((c, i) => ({
          index: i,
          type: c.type,
          findings_count: stage1Results[i]?.findings?.length || 0,
        })),
      }
    );

    // Çelişkileri ve referans çözümleme sonuçlarını ekle
    result.conflicts = conflicts;
    result.references = {
      resolved: referenceResolution.resolved,
      unresolved: unresolvedReferences,
      stats: referenceResolution.stats,
    };
    // Geriye uyumluluk için
    result.unresolved_references = unresolvedReferences;

    logger.info('═══ ZERO-LOSS PIPELINE TAMAMLANDI ═══', {
      module: 'zero-loss',
      duration: `${(totalDuration / 1000).toFixed(1)}s`,
      valid: validation.valid,
      completeness: validation.completeness_score,
      conflicts: conflicts.length,
      references_resolved: referenceResolution.stats.resolved_count,
      p0_passed: p0Summary?.all_passed ?? 'skipped',
    });

    return result;
  } catch (error) {
    logger.error('Zero-Loss Pipeline failed', {
      module: 'zero-loss',
      error: error.message,
      filePath,
    });

    return createErrorOutput(documentId, error.message);
  }
}

export { analyze, analyzeZeroLoss } from './analyzer.js';
export { assembleResults, validateNoNewInformation } from './assembler.js';
export { chunk, chunkExcel, chunkText, chunkTextWithStructure, validateCharacterCount } from './chunker.js';
export { detectConflicts, generateConflictReport } from './conflict.js';
export { extract } from './extractor.js';
export { detectStructure, resolveReferences } from './structure.js';
export { calculateCompleteness, validateOutput } from './validator.js';

export default {
  runPipeline,
  runPipelineBatch,
  runZeroLossPipeline,
};
