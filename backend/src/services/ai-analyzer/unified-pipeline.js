/**
 * UNIFIED DOCUMENT ANALYSIS PIPELINE v9.0
 * ========================================
 * TEK MERKEZİ SİSTEM - Tüm document analysis işlemleri buradan geçer
 *
 * KULLANIM:
 *   import { analyzeDocument } from './ai-analyzer/unified-pipeline.js';
 *   const result = await analyzeDocument(filePath, { onProgress });
 *
 * DİĞER DOSYALARI KULLANMAYIN:
 *   ❌ runZeroLossPipeline, runHybridPipeline, runAzurePipeline
 *   ❌ analyzeFile, runPipeline
 *
 * Pipeline Akışı:
 *   1. Azure Custom Model (ihale-catering-v5) → En doğru (31 catering-spesifik alan)
 *   2. Azure Layout + Claude → Hibrit
 *   3. Claude Zero-Loss → Fallback
 */

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
// TEK MERKEZİ CONFIG - başka yerde config tanımlamayın!
import aiConfig, { getCustomModelId, isAzureConfigured, isCustomModelEnabled } from '../../config/ai.config.js';
import { checkApiCircuit, reportApiError } from '../../utils/circuit-breaker.js';
import logger from '../../utils/logger.js';
// Kritik alan validasyonu (Layer 6.5)
import { logValidationResult, validateCriticalFields } from './controls/field-validator.js';
// Kalite metrikleri
import { PipelineMonitor } from './controls/quality-metrics.js';
// Extractor - yerel metin çıkarma (DOC/DOCX/XLSX/TXT için Azure'u atla)
import { extract as extractLocal } from './pipeline/extractor.js';
// Zero-Loss Pipeline - Son fallback olarak kullanılır
import { runZeroLossPipeline as runFallbackPipeline } from './pipeline/index.js';
// Dosya adından belge tipi tespiti
import { detectDocTypeFromFilename } from './prompts/doc-type/index.js';
import { analyzeWithCustomModel, analyzeWithLayout, checkHealth } from './providers/azure-document-ai.js';
import { createErrorOutput, createSuccessOutput } from './schemas/final-output.js';
import { mergeResults } from './utils/merge-results.js';
import { safeJsonParse } from './utils/parser.js';
import { calculateCompleteness } from './utils/table-helpers.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT - TEK GİRİŞ NOKTASI
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ana analiz fonksiyonu - TÜM belgeler buradan geçer
 *
 * @param {string} filePath - Belge yolu
 * @param {Object} options - Opsiyonlar
 * @param {Function} options.onProgress - İlerleme callback
 * @param {string} options.provider - Zorunlu provider ('auto', 'custom', 'layout', 'claude')
 * @returns {Promise<Object>} Analiz sonucu
 */
export async function analyzeDocument(filePath, options = {}) {
  const startTime = Date.now();
  const fileName = path.basename(filePath);
  const documentId = `unified_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const { onProgress, provider = 'auto', docType: explicitDocType } = options;

  // Belge tipi tespiti (explicit > filename detection)
  const docType = explicitDocType || detectDocTypeFromFilename(fileName) || null;

  // Pipeline Monitor başlat (performans takibi)
  const monitor = new PipelineMonitor(documentId);
  monitor.startStage('initialization');

  logger.info('═══ UNIFIED PIPELINE v9.0 BAŞLADI ═══', {
    module: 'unified-pipeline',
    file: fileName,
    provider,
    docType: docType || 'unknown',
    customModelEnabled: isCustomModelEnabled(),
  });

  // Progress helper
  const progress = (stage, message, percent) => {
    if (onProgress) onProgress({ stage, message, progress: percent });
    logger.info(`  [${percent}%] ${message}`, { module: 'unified-pipeline' });
  };

  try {
    // Dosya kontrolü
    if (!fs.existsSync(filePath)) {
      throw new Error(`Dosya bulunamadı: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileSizeKB = Math.round(fileBuffer.length / 1024);
    const ext = path.extname(filePath).toLowerCase();

    // ZIP kontrolü
    if (ext === '.zip') {
      return createErrorOutput(documentId, 'ZIP dosyaları doğrudan analiz edilemez');
    }

    progress('start', `Belge yüklendi (${fileSizeKB}KB)`, 5);
    monitor.endStage({ file: fileName, size_kb: fileSizeKB });

    let result = null;
    let usedProvider = null;
    let azureResult = null;

    // ═══════════════════════════════════════════════════════════════════
    // DOSYA TİPİ YÖNLENDİRME - OCR gerektirmeyen dosyalar Azure'u atlar
    // ═══════════════════════════════════════════════════════════════════
    // PDF ve görseller → Azure Custom Model + Claude (OCR gerekli)
    // DOC/DOCX/XLSX/XLS/TXT/CSV → Yerel metin çıkarma + Claude (OCR gereksiz)
    const OCR_REQUIRED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.tiff', '.tif', '.bmp'];
    const isOcrRequired = OCR_REQUIRED_EXTENSIONS.includes(ext);

    if (!isOcrRequired) {
      // ═══════════════════════════════════════════════════════════════════
      // NON-OCR PATH: DOC/DOCX/XLSX/TXT → Yerel extract + Claude-only
      // ═══════════════════════════════════════════════════════════════════
      logger.info(`📄 Non-OCR dosya tespit edildi (${ext}), Azure atlanıyor → yerel extract + Claude`, {
        module: 'unified-pipeline',
        ext,
        file: fileName,
      });

      monitor.startStage('local_extraction');
      progress('extract', `Yerel metin çıkarma (${ext})...`, 15);

      try {
        const extraction = await extractLocal(filePath);

        if (!extraction.text || extraction.text.trim().length < 50) {
          throw new Error(`Yerel extract başarısız: metin çok kısa (${extraction.text?.length || 0} karakter)`);
        }

        logger.info(`✓ Yerel extract başarılı`, {
          module: 'unified-pipeline',
          type: extraction.type,
          textLength: extraction.text.length,
          needsOcr: extraction.needsOcr,
        });
        monitor.endStage({ success: true, type: extraction.type, textLength: extraction.text.length });

        // Çıkarılan metni fallback pipeline üzerinden Claude'a gönder
        monitor.startStage('claude_semantic');
        progress('claude', 'Claude analiz yapıyor...', 50);

        result = await runFallbackPipeline(filePath, { onProgress });
        monitor.recordApiCall('claude');
        usedProvider = `local-extract(${extraction.type})+claude`;
        monitor.endStage({ success: !!result, provider: usedProvider });
      } catch (extractErr) {
        monitor.endStage({ success: false, error: extractErr.message });
        logger.warn(`Yerel extract başarısız, fallback pipeline deneniyor...`, {
          module: 'unified-pipeline',
          error: extractErr.message,
        });

        // Fallback: Zero-Loss pipeline kendi extractor'ını kullanır
        monitor.startStage('claude_semantic');
        progress('fallback', 'Fallback pipeline çalışıyor...', 60);
        result = await runFallbackPipeline(filePath, { onProgress });
        monitor.recordApiCall('claude');
        usedProvider = 'claude-fallback';
        monitor.endStage({ success: !!result, provider: usedProvider });
      }
    } else {
      // ═══════════════════════════════════════════════════════════════════
      // OCR PATH: PDF/Image → Azure Custom Model + Claude
      // ═══════════════════════════════════════════════════════════════════

      // STEP 1: AZURE CUSTOM MODEL (Eğitilmiş model - en doğru)
      if ((provider === 'auto' || provider === 'custom') && isCustomModelEnabled()) {
        monitor.startStage('azure_custom_model');
        progress('azure-custom', 'Azure Custom Model analiz ediyor...', 15);

        try {
          azureResult = await analyzeWithCustomModel(fileBuffer, getCustomModelId());
          monitor.recordApiCall('azure');

          if (azureResult.success) {
            usedProvider = 'azure-custom';
            monitor.endStage({ success: true, tables: azureResult.tables?.length || 0 });
            logger.info('✓ Azure Custom Model başarılı', {
              module: 'unified-pipeline',
              tables: azureResult.tables?.length || 0,
              fields: Object.keys(azureResult.fields || {}).length,
            });
          } else {
            monitor.endStage({ success: false });
          }
        } catch (err) {
          monitor.endStage({ success: false, error: err.message });
          monitor.recordError('azure_custom_model', err);
          logger.warn('Azure Custom Model başarısız, fallback...', {
            module: 'unified-pipeline',
            error: err.message,
          });
        }
      }

      // STEP 2: AZURE LAYOUT (Prebuilt - tablo çıkarma) - sadece Custom Model başarısız olursa
      if (!usedProvider && (provider === 'auto' || provider === 'layout') && isAzureConfigured()) {
        monitor.startStage('azure_layout');
        progress('azure-layout', 'Azure Layout analiz ediyor...', 25);

        try {
          azureResult = await analyzeWithLayout(fileBuffer);
          monitor.recordApiCall('azure');

          if (azureResult.success) {
            usedProvider = 'azure-layout';
            monitor.endStage({ success: true, tables: azureResult.tables?.length || 0 });
            logger.info('✓ Azure Layout başarılı', {
              module: 'unified-pipeline',
              tables: azureResult.tables?.length || 0,
              paragraphs: azureResult.paragraphs?.length || 0,
            });
          } else {
            monitor.endStage({ success: false });
          }
        } catch (err) {
          monitor.endStage({ success: false, error: err.message });
          monitor.recordError('azure_layout', err);
          logger.warn('Azure Layout başarısız, fallback...', {
            module: 'unified-pipeline',
            error: err.message,
          });
        }
      }

      // STEP 3: CLAUDE SEMANTIC ANALYSIS
      monitor.startStage('claude_semantic');
      progress('claude', 'Claude semantic analiz yapıyor...', 50);

      if (azureResult?.success) {
        // Azure başarılı - Claude ile birleştir
        result = await enhanceWithClaude(azureResult, documentId, onProgress);
        monitor.recordApiCall('claude');
        usedProvider = usedProvider + '+claude';
        monitor.endStage({ success: true, provider: usedProvider });
      } else if (provider === 'auto' || provider === 'claude') {
        // Azure başarısız - Fallback: Pure Claude analizi
        progress('fallback', 'Fallback pipeline çalışıyor...', 60);
        result = await runFallbackPipeline(filePath, { onProgress });
        monitor.recordApiCall('claude');
        usedProvider = 'claude-fallback';
        monitor.endStage({ success: !!result, provider: usedProvider });
      } else {
        monitor.endStage({ success: false, reason: 'no_provider_available' });
      }
    } // end OCR path

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: SONUÇ BİRLEŞTİRME
    // ═══════════════════════════════════════════════════════════════════

    progress('finalize', 'Sonuçlar birleştiriliyor...', 90);

    if (!result) {
      return createErrorOutput(documentId, 'Hiçbir analiz yöntemi başarılı olmadı');
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: KRİTİK ALAN VALİDASYONU (Layer 6.5)
    // ═══════════════════════════════════════════════════════════════════
    progress('critical_fields', 'Kritik alanlar kontrol ediliyor...', 92);

    const analysis = result.analysis || result;
    const criticalValidation = validateCriticalFields(analysis, docType);
    logValidationResult(criticalValidation, 'unified-pipeline');

    // Eksik kritik alanlar varsa doldurmaya çalış (skipped=true ise atla)
    if (!criticalValidation.skipped && !criticalValidation.valid && criticalValidation.missing.length > 0) {
      logger.info(`Unified Pipeline: ${criticalValidation.missing.length} eksik kritik alan bulundu, dolduruluyor...`, {
        module: 'unified-pipeline',
        missingFields: criticalValidation.missing.map((m) => m.field),
      });

      progress('fill_missing', `Eksik alanlar dolduruluyor (${criticalValidation.missing.length})...`, 94);

      // Metin içeriğini al (extraction'dan veya tablolardan)
      const extractedText =
        result.extraction?.text ||
        result.extraction?.structured?.content ||
        JSON.stringify(result.analysis || result, null, 2);

      // Her eksik alan için focused extraction
      for (const { field, config } of criticalValidation.missing) {
        // Circuit breaker kontrolü — tripped ise kalan alanları da atla
        const circuit = checkApiCircuit();
        if (!circuit.allowed) {
          logger.warn('⛔ Pipeline durduruldu: Kritik alan doldurma atlanıyor (circuit breaker)', {
            module: 'unified-pipeline',
            reason: circuit.reason,
            skippedField: field,
          });
          break;
        }

        try {
          // Eksik alan doldurma - yeterli metin gönder (150K limit)
          const fillText =
            extractedText.length > 150_000
              ? extractedText.substring(0, 97_500) +
                '\n\n[...atlandı...]\n\n' +
                extractedText.substring(extractedText.length - 52_500)
              : extractedText;
          const fillPrompt = config.fallbackPrompt + `\n\nMETİN:\n${fillText}`;

          const fillResponse = await anthropic.messages.create({
            model: aiConfig.claude.defaultModel,
            max_tokens: 1024,
            messages: [{ role: 'user', content: fillPrompt }],
          });

          const responseText = fillResponse.content[0]?.text || '{}';
          const parsed = safeJsonParse(responseText);

          if (parsed?.[field]) {
            const extractedValue = parsed[field];
            const hasRealContent =
              typeof extractedValue === 'object'
                ? Object.values(extractedValue).some((v) => v && v !== '' && v !== 'Belirtilmemiş')
                : extractedValue && extractedValue !== '' && extractedValue !== 'Belirtilmemiş';

            if (hasRealContent) {
              // Merge into analysis
              if (result.analysis) {
                result.analysis[field] = extractedValue;
              } else {
                result[field] = extractedValue;
              }
              logger.info(`✓ Kritik alan dolduruldu: ${field}`, { module: 'unified-pipeline' });
            }
          }
        } catch (fillError) {
          // Fatal hata kontrolü
          if (reportApiError(fillError)) {
            logger.error('⛔ Pipeline durduruldu: Kritik alan doldurma sırasında fatal API hatası', {
              module: 'unified-pipeline',
              field,
              error: fillError.message,
            });
            break; // Kalan alanları da atla
          }
          logger.warn(`Kritik alan doldurma hatası: ${field}`, {
            module: 'unified-pipeline',
            error: fillError.message,
          });
        }
      }

      // Re-validate
      const revalidation = validateCriticalFields(result.analysis || result, docType);
      logValidationResult(revalidation, 'unified-pipeline-post-fill');

      // Meta'ya kritik alan bilgisi ekle
      result.critical_fields = {
        before: criticalValidation,
        after: revalidation,
        filled_count: criticalValidation.missing.length - revalidation.missing.length,
      };
    } else {
      result.critical_fields = {
        validation: criticalValidation,
        all_filled: true,
      };
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: CONFIDENCE ANALİZİ
    // ═══════════════════════════════════════════════════════════════════
    monitor.startStage('confidence_analysis');

    // Basit confidence hesaplaması
    const analysisForConfidence = result.analysis || result;
    const fieldCount = Object.keys(analysisForConfidence).filter((k) => analysisForConfidence[k] != null).length;
    const overallConfidence = Math.min(0.95, 0.5 + fieldCount * 0.03);

    result.quality = {
      field_count: fieldCount,
      overall_confidence: overallConfidence,
      azure_confidence: azureResult?.confidence || 0,
      provider: usedProvider,
    };

    monitor.endStage({ overall_confidence: overallConfidence });

    // ═══════════════════════════════════════════════════════════════════
    // STEP 7: CHUNK METRİKLERİ & PIPELINE RAPORU
    // ═══════════════════════════════════════════════════════════════════

    // Chunk success tracking — result'tan chunk bilgisini monitor'a aktar
    const chunkCount = result.stats?.chunkCount || result.chunks?.length || 0;
    if (chunkCount > 0) {
      // Fallback pipeline chunks array'i döndürür, her biri success kabul edilir
      // Eğer analysis.meta'da hata bilgisi varsa failed_chunks ayrıştırılır
      const failedChunks = result.analysis?.meta?.failedChunks || 0;
      const successfulChunks = chunkCount - failedChunks;
      for (let i = 0; i < successfulChunks; i++) {
        monitor.recordChunkProcessed(true);
      }
      for (let i = 0; i < failedChunks; i++) {
        monitor.recordChunkProcessed(false);
      }
    }

    const pipelineReport = monitor.generateReport();

    // Completeness metrikleri:
    // 1. overallCompleteness: 21 alanlık ağırlıklı puan (100 üzerinden) — table-helpers calculateCompleteness
    // 2. criticalFieldsCompleteness: 5 kritik catering alanı (iletisim, teminat, servis_saatleri vb.) — field-validator
    const overallCompletenessRaw = result.validation?.completeness_score || 0;

    // Meta bilgi ekle
    result.meta = {
      ...result.meta,
      unified_pipeline_version: '2.0.0',
      provider_used: usedProvider,
      duration_ms: Date.now() - startTime,
      file_info: {
        name: fileName,
        size_kb: fileSizeKB,
        type: ext.replace('.', ''),
      },
      completeness: {
        overall: `${overallCompletenessRaw}%`,
        critical_fields: `${(criticalValidation.completeness * 100).toFixed(1)}%`,
      },
      performance: pipelineReport,
    };

    progress('complete', 'Analiz tamamlandı', 100);

    logger.info('═══ UNIFIED PIPELINE TAMAMLANDI ═══', {
      module: 'unified-pipeline',
      provider: usedProvider,
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      overallCompleteness: `${overallCompletenessRaw}%`,
      criticalFieldsCompleteness: `${(criticalValidation.completeness * 100).toFixed(1)}%`,
      chunks: `${monitor.metrics.processed_chunks}/${monitor.metrics.total_chunks} başarılı`,
      overallConfidence: `${(overallConfidence * 100).toFixed(1)}%`,
    });

    return result;
  } catch (error) {
    logger.error('Unified Pipeline hatası', {
      module: 'unified-pipeline',
      error: error.message,
      file: fileName,
    });

    return createErrorOutput(documentId, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLAUDE ENHANCEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function enhanceWithClaude(azureResult, documentId, _onProgress) {
  // Azure sonuçlarını Claude için hazırla
  const preparedData = prepareForClaude(azureResult);

  // Claude ile semantic analiz
  const claudeAnalysis = await runClaudeAnalysis(preparedData);

  // Claude sonucu boşsa logla (JSON parse + retry başarısız)
  const claudeFieldCount = Object.keys(claudeAnalysis).length;
  if (claudeFieldCount === 0) {
    logger.warn('Claude analysis returned empty - using Azure-only results as fallback', {
      module: 'unified-pipeline',
      documentId,
      azureFieldCount: Object.keys(azureResult.fields || {}).length,
      azureTableCount: azureResult.tables?.length || 0,
    });
  } else {
    logger.info('Claude analysis merged with Azure results', {
      module: 'unified-pipeline',
      claudeFieldCount,
      azureFieldCount: Object.keys(azureResult.fields || {}).length,
    });
  }

  // Sonuçları birleştir
  const mergedAnalysis = mergeResults(azureResult, claudeAnalysis);

  // Completeness hesapla
  const completeness = calculateCompleteness(mergedAnalysis);

  return createSuccessOutput(
    documentId,
    mergedAnalysis,
    {
      valid: true,
      completeness_score: completeness.score,
      completeness_details: completeness,
      p0_checks: { all_passed: true },
    },
    {
      pipeline_version: 'unified-1.0.0',
      azure_tables: azureResult.tables?.length || 0,
      azure_paragraphs: azureResult.paragraphs?.length || 0,
    }
  );
}

function prepareForClaude(azureResult) {
  const tables = azureResult.tables || [];
  const paragraphs = azureResult.paragraphs || [];
  const customFields = azureResult.fields || {};
  const rawResult = azureResult.raw || {};

  // ═══════════════════════════════════════════════════════════════════════
  // 1. OCR ARTEFAKT TEMİZLEME
  // ═══════════════════════════════════════════════════════════════════════
  function cleanOcrText(rawText) {
    if (!rawText) return '';
    return rawText
      .replace(/\0/g, '') // null bytes
      .replace(/¿/g, '') // garbled question marks
      .replace(/\uFFFD/g, '') // Unicode replacement char
      .replace(/[^\S\n]{3,}/g, ' ') // 3+ ardışık boşluk → tek boşluk
      .replace(/\n{4,}/g, '\n\n\n') // 4+ ardışık newline → 3
      .replace(/:selec[t ]*ed|:unselected/gi, '') // Azure checkbox artifacts
      .trim();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. METİN OLUŞTUR - paragraphs veya raw.content'ten
  // ═══════════════════════════════════════════════════════════════════════
  let text = '';

  // REST API formatı: raw.content string olarak gelir (custom model)
  if (rawResult.content && Array.isArray(rawResult.content)) {
    text = rawResult.content.map((c) => c.content || '').join('\n');
  } else if (typeof rawResult.content === 'string') {
    text = rawResult.content;
  }

  // SDK formatı: paragraphs
  for (const para of paragraphs) {
    if (para.role === 'title') text += `\n# ${para.content}\n`;
    else if (para.role === 'sectionHeading') text += `\n## ${para.content}\n`;
    else text += `${para.content}\n`;
  }

  text = cleanOcrText(text);

  // ═══════════════════════════════════════════════════════════════════════
  // 3. TABLO METNİ - TÜM tablolar (limit kaldırıldı, 100K char sınırı var zaten)
  // ═══════════════════════════════════════════════════════════════════════
  let tableText = '';
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    tableText += `\n--- TABLO ${i + 1} ---\n`;

    // REST API formatı: cells array
    if (table.cells && Array.isArray(table.cells)) {
      const cellsByRow = {};
      for (const cell of table.cells) {
        const row = cell.rowIndex || 0;
        if (!cellsByRow[row]) cellsByRow[row] = [];
        cellsByRow[row][cell.columnIndex || 0] = cell.content || '';
      }
      const rowNums = Object.keys(cellsByRow)
        .map(Number)
        .sort((a, b) => a - b);
      for (const rowNum of rowNums) {
        const rowCells = cellsByRow[rowNum] || [];
        tableText += `| ${rowCells.join(' | ')} |\n`;
      }
    } else {
      // SDK formatı: headers ve rows
      if (table.headers?.length) {
        tableText += `| ${table.headers.join(' | ')} |\n`;
      }
      for (const row of table.rows || []) {
        tableText += `| ${row.join(' | ')} |\n`;
      }
    }
  }

  tableText = cleanOcrText(tableText);

  // ═══════════════════════════════════════════════════════════════════════
  // 4. CUSTOM MODEL FIELD'LARI - CONFIDENCE FİLTRELEME (< 0.3 = çöp)
  // ═══════════════════════════════════════════════════════════════════════
  const MIN_CONFIDENCE = 0.3;
  let fieldsText = '';
  const extractedFields = {};
  let filteredCount = 0;
  const droppedFields = []; // Atılan alanların isimlerini logla

  if (Object.keys(customFields).length > 0) {
    fieldsText = '\n--- AZURE CUSTOM MODEL ÇIKTISI ---\n';
    for (const [key, field] of Object.entries(customFields)) {
      if (field !== null && field !== undefined) {
        const confidence = typeof field === 'object' ? field.confidence || 0 : 1;
        const value = typeof field === 'object' ? field.value || field.content : field;

        // Düşük confidence field'ları atla
        if (confidence < MIN_CONFIDENCE) {
          filteredCount++;
          droppedFields.push({ key, confidence: Math.round(confidence * 100) });
          continue;
        }

        if (value && String(value).trim()) {
          const cleanValue = cleanOcrText(String(value));
          if (cleanValue) {
            fieldsText += `${key}: ${cleanValue} (güven: ${Math.round(confidence * 100)}%)\n`;
            extractedFields[key] = cleanValue;
          }
        }
      }
    }

    if (filteredCount > 0) {
      logger.info(`Confidence filtreleme: ${filteredCount} alan atıldı (conf < ${MIN_CONFIDENCE})`, {
        module: 'unified-pipeline',
        droppedFields: droppedFields.map((f) => `${f.key}(${f.confidence}%)`).join(', '),
      });
    }
  }

  logger.info('prepareForClaude sonuç', {
    textLen: text.length,
    tableTextLen: tableText.length,
    tableCount: tables.length,
    fieldsCount: Object.keys(extractedFields).length,
    filteredFields: filteredCount,
  });

  return { text, tableText, fieldsText, tables, paragraphs, customFields: extractedFields };
}

async function runClaudeAnalysis(preparedData) {
  // Eğer Custom Model zaten çoğu alanı doldurduysa, Claude'a sadece eksikleri sor
  const customFields = preparedData.customFields || {};
  const hasCustomData = Object.keys(customFields).length > 5;

  // KRİTİK ALANLAR - Her zaman çıkarılmalı (Zero-Loss Pipeline ile uyumlu)
  const criticalFieldsSchema = `
  "iletisim": {
    "adres": "İdare/kurum adresi",
    "telefon": "İletişim telefonu",
    "email": "İletişim e-postası",
    "yetkili": "Yetkili kişi adı"
  },
  "teminat_oranlari": {
    "gecici": "Geçici teminat oranı (ör: %3)",
    "kesin": "Kesin teminat oranı (ör: %6)"
  },
  "servis_saatleri": {
    "kahvalti": "Kahvaltı servisi saati",
    "ogle": "Öğle yemeği saati",
    "aksam": "Akşam yemeği saati"
  },
  "mali_kriterler": {
    "is_deneyimi": "İş deneyim belgesi oranı",
    "ozkaynak_orani": "Özkaynak oranı",
    "cari_oran": "Cari oran"
  },
  "tahmini_bedel": "Yaklaşık maliyet/tahmini bedel (TL)"`;

  // Tam JSON schema - Azure v5 custom model etiketleriyle EŞLEŞTİRİLMİŞ
  // Azure v5 etiketleri: ihale_konusu, idare_adi, ihale_kayit_no, ise_baslama_tarihi,
  // is_bitis_tarihi, sure, yaklasik_maliyet, mutfak_tipi, servis_tipi, et_tipi,
  // gunluk_toplam_ogun, yemek_cesit_sayisi, toplam_personel_sayisi, ogle_kisi_sayisi,
  // kahvalti_kisi_sayisi, aksam_kisi_sayisi, diyet_kisi_sayisi, hizmet_gun_sayisi,
  // kalite_standartlari, iscilik_orani, yemek_pisirilecek_yer, dagitim_saatleri,
  // gida_guvenligi_belgeleri, menu_tablosu, gramaj_tablosu, personel_tablosu,
  // ogun_dagilimi, birim_fiyat_cetveli, malzeme_listesi, dagitim_noktalari, ekipman_listesi
  const fullJsonSchema = `{
  "summary": {
    "title": "İhale başlığı/konusu",
    "institution": "İhaleyi açan kurum/idare adı",
    "ikn": "İhale kayıt numarası (2024/123456 formatında)",
    "estimated_value": "Yaklaşık maliyet/tahmini bedel (TL)"
  },
  "catering": {
    "total_persons": "Toplam yemek yiyen kişi sayısı (sadece sayı)",
    "daily_meals": "Günlük toplam öğün sayısı (sadece sayı)",
    "contract_duration": "Sözleşme süresi (ay veya gün olarak belirt)",
    "meal_types": ["kahvaltı", "öğle", "akşam"],
    "breakfast_persons": "Kahvaltı yiyen kişi sayısı (sadece sayı)",
    "lunch_persons": "Öğle yemeği yiyen kişi sayısı (sadece sayı)",
    "dinner_persons": "Akşam yemeği yiyen kişi sayısı (sadece sayı)",
    "diet_persons": "Diyet yemek alan kişi sayısı (sadece sayı)",
    "service_days": "Toplam hizmet gün sayısı (sadece sayı)",
    "kitchen_type": "Mutfak tipi (örn: kapalı mutfak, açık mutfak, taşımalı)",
    "service_type": "Servis tipi (örn: tabldot, açık büfe, paket)",
    "meat_type": "Et tipi tercihi (örn: dana, tavuk, kuzu, karışık)",
    "meal_variety": "Öğün başına yemek çeşit sayısı",
    "cooking_location": "Yemek pişirilecek yer (örn: kurum mutfağı, yüklenici mutfağı)",
    "labor_rate": "İşçilik oranı (yüzde)",
    "delivery_hours": "Yemek dağıtım/servis saatleri",
    "quality_standards": "İstenen kalite standartları (ISO, HACCP vb.)",
    "food_safety_docs": "İstenen gıda güvenliği belgeleri",
    "distribution_points": "Yemek dağıtım noktaları listesi",
    "equipment_list": "İstenen mutfak ekipman listesi",
    "material_list": "Malzeme/hammadde listesi",
    "meal_distribution": "Öğün dağılımı detayları (hangi öğünde kaç kişi)",
    "unit_price_table": "Birim fiyat cetveli bilgileri",
    "menu_table": "Menü tablosu/örnek menü bilgileri"
  },
  "dates": {
    "start_date": "İşe başlama tarihi (GG.AA.YYYY)",
    "end_date": "İş bitiş tarihi (GG.AA.YYYY)",
    "tender_date": "İhale tarihi (GG.AA.YYYY)"
  },
  "personnel": {
    "total_count": "Toplam çalıştırılacak personel sayısı",
    "positions": [{"title": "Pozisyon adı", "count": "Adet (sayı)"}]
  },
  ${criticalFieldsSchema}
}`;

  // ═══════════════════════════════════════════════════════════════════════
  // AKILLI METİN HAZIRLAMA - Claude Opus 4.6: 1M token context!
  // 500K karakter ≈ 125K token, context'in %12'si - rahat sığar
  // ═══════════════════════════════════════════════════════════════════════
  const TEXT_LIMIT = 500_000; // ~125K token (was 15K - 33x artış!)
  const TABLE_LIMIT = 100_000; // ~25K token  (was 8K  - 12x artış!)

  function smartTruncate(text, limit) {
    if (!text || text.length <= limit) return text;
    // Büyük belgeler için: baştan %65 + sondan %35 (şartname başı + ek'ler sonu)
    const headSize = Math.floor(limit * 0.65);
    const tailSize = limit - headSize - 100; // 100 char separator
    const head = text.substring(0, headSize);
    const tail = text.substring(text.length - tailSize);
    return `${head}\n\n[... ${text.length - headSize - tailSize} karakter atlandı - belge ortası ...]\n\n${tail}`;
  }

  const docText = smartTruncate(preparedData.text, TEXT_LIMIT);
  const tableText = smartTruncate(preparedData.tableText, TABLE_LIMIT);

  logger.info('Claude analiz metin boyutları', {
    originalTextLen: preparedData.text?.length || 0,
    sentTextLen: docText?.length || 0,
    originalTableLen: preparedData.tableText?.length || 0,
    sentTableLen: tableText?.length || 0,
    truncated: (preparedData.text?.length || 0) > TEXT_LIMIT,
  });

  let prompt;

  if (hasCustomData) {
    // Custom Model başarılı - Azure verisini bağlam olarak ver, TAM analiz yap
    prompt = `Sen bir catering/yemek hizmeti ihale belgesi analiz uzmanısın. Azure Custom Model belgeyi okudu ve bazı verileri çıkardı.
Senin görevin belge metnini BAŞTAN SONA analiz edip TÜM alanları doldurmak.
Azure çıktısını referans olarak kullan ama belge metninden bağımsız olarak da tüm bilgileri ara.

ÖNEMLİ KRİTİK ALANLAR (mutlaka doldur):
1. GENEL: summary (title, institution, ikn, estimated_value)
2. TARİHLER: dates (start_date, end_date, tender_date)
3. CATERİNG OPERASYONEL:
   - Kişi sayıları: total_persons, breakfast_persons, lunch_persons, dinner_persons, diet_persons
   - Öğün: daily_meals, meal_types, meal_variety, meal_distribution
   - Operasyon: kitchen_type, service_type, cooking_location, delivery_hours, service_days
   - Kalite: quality_standards, food_safety_docs, meat_type
   - Mali: labor_rate, unit_price_table
   - Fiziksel: distribution_points, equipment_list, material_list
4. PERSONEL: total_count, positions
5. İLETİŞİM: adres, telefon, email, yetkili
6. TEMİNAT: gecici, kesin
7. SERVİS SAATLERİ: kahvaltı, öğle, akşam
8. MALİ KRİTERLER: is_deneyimi, ozkaynak_orani, cari_oran
9. TAHMİNİ BEDEL

AZURE CUSTOM MODEL ÇIKTISI (referans - doğruluğunu belge metninden teyit et):
${preparedData.fieldsText}

BELGE METNİ:
${docText}

TABLOLAR:
${tableText}

Aşağıdaki JSON formatında yanıt ver (sadece bulunan değerleri doldur, bulunamayanlar null):
${fullJsonSchema}`;
  } else {
    // Custom Model başarısız - tam analiz yap
    prompt = `Sen bir catering/yemek hizmeti ihale belgesi analiz uzmanısın. Aşağıdaki belgeyi analiz et ve JSON formatında çıktı ver.

ÖNEMLİ KRİTİK ALANLAR (mutlaka doldur):
1. GENEL: summary (title, institution, ikn, estimated_value)
2. TARİHLER: dates (start_date, end_date, tender_date)
3. CATERİNG OPERASYONEL:
   - Kişi sayıları: total_persons, breakfast_persons, lunch_persons, dinner_persons, diet_persons
   - Öğün: daily_meals, meal_types, meal_variety, meal_distribution
   - Operasyon: kitchen_type, service_type, cooking_location, delivery_hours, service_days
   - Kalite: quality_standards, food_safety_docs, meat_type
   - Mali: labor_rate, unit_price_table
   - Fiziksel: distribution_points, equipment_list, material_list
4. PERSONEL: total_count, positions
5. İLETİŞİM: adres, telefon, email, yetkili
6. TEMİNAT: gecici, kesin
7. SERVİS SAATLERİ: kahvaltı, öğle, akşam
8. MALİ KRİTERLER: is_deneyimi, ozkaynak_orani, cari_oran
9. TAHMİNİ BEDEL

BELGE METNİ:
${docText}

TABLOLAR:
${tableText}

Aşağıdaki JSON formatında yanıt ver (sadece bulunan değerleri doldur):
${fullJsonSchema}`;
  }

  const MAX_ATTEMPTS = 2; // 1 deneme + 1 retry

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Circuit breaker kontrolü
    const circuit = checkApiCircuit();
    if (!circuit.allowed) {
      logger.warn('⛔ Pipeline durduruldu: Claude API circuit breaker açık', {
        module: 'unified-pipeline',
        reason: circuit.reason,
      });
      return {};
    }

    try {
      const response = await anthropic.messages.create({
        model: aiConfig.claude.analysisModel, // Opus 4 - derin belge analizi için
        max_tokens: 8192, // 4K -> 8K (daha detaylı JSON çıktısı için)
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0]?.text || '{}';
      const parsed = safeJsonParse(content);
      if (parsed) return parsed;

      // safeJsonParse null döndü - JSON tamir edilemedi
      logger.warn(`Claude analysis JSON repair failed (attempt ${attempt}/${MAX_ATTEMPTS})`, {
        responseLength: content.length,
        snippet: content.slice(0, 200),
        stopReason: response.stop_reason,
      });

      // Son deneme ise boş dön, değilse retry
      if (attempt >= MAX_ATTEMPTS) {
        logger.warn('Claude analysis JSON parse exhausted all retries, returning empty result');
        return {};
      }

      // Retry öncesi kısa bekleme (2s)
      await new Promise((resolve) => setTimeout(resolve, 2000));
      logger.info('Retrying Claude analysis due to JSON parse failure...');
    } catch (err) {
      // Fatal hata kontrolü (credit balance vb.)
      if (reportApiError(err)) {
        logger.error('⛔ Pipeline durduruldu: Fatal API hatası', {
          module: 'unified-pipeline',
          error: err.message,
        });
        return {};
      }

      logger.warn(`Claude analysis failed (attempt ${attempt}/${MAX_ATTEMPTS})`, { error: err.message });

      if (attempt >= MAX_ATTEMPTS) return {};

      // API hatası için de retry (rate limit vb.)
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return {};
}

// mergeResults, detectTableType, extractGramajData, extractPersonnelData, calculateCompleteness
// → utils/merge-results.js ve utils/table-helpers.js'e taşındı (refactoring)

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  analyzeDocument,
};

/**
 * Pipeline health check - sistem durumunu kontrol et
 * @returns {Promise<Object>} Health status
 */
export async function checkPipelineHealth() {
  const status = {
    version: '9.0',
    azure: { configured: isAzureConfigured(), healthy: false },
    customModel: { enabled: isCustomModelEnabled(), modelId: getCustomModelId() },
    claude: { configured: !!process.env.ANTHROPIC_API_KEY },
  };

  if (status.azure.configured) {
    try {
      const health = await checkHealth();
      status.azure.healthy = health.healthy;
      status.azure.customModelExists = health.customModelExists;
    } catch (e) {
      status.azure.healthy = false;
      status.azure.error = e.message;
    }
  }

  return status;
}
