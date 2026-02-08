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
import logger from '../../utils/logger.js';
// Kritik alan validasyonu (Layer 6.5)
import { logValidationResult, validateCriticalFields } from './controls/field-validator.js';
// Kalite metrikleri
import { PipelineMonitor } from './controls/quality-metrics.js';
// Zero-Loss Pipeline - Son fallback olarak kullanılır
import { runZeroLossPipeline as runFallbackPipeline } from './pipeline/index.js';
// Extractor - yerel metin çıkarma (DOC/DOCX/XLSX/TXT için Azure'u atla)
import { extract as extractLocal } from './pipeline/extractor.js';
import { analyzeWithCustomModel, analyzeWithLayout, checkHealth } from './providers/azure-document-ai.js';
import { createErrorOutput, createSuccessOutput } from './schemas/final-output.js';
import { safeJsonParse } from './utils/parser.js';

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

  const { onProgress, provider = 'auto' } = options;

  // Pipeline Monitor başlat (performans takibi)
  const monitor = new PipelineMonitor(documentId);
  monitor.startStage('initialization');

  logger.info('═══ UNIFIED PIPELINE v9.0 BAŞLADI ═══', {
    module: 'unified-pipeline',
    file: fileName,
    provider,
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
    const criticalValidation = validateCriticalFields(analysis);
    logValidationResult(criticalValidation, 'unified-pipeline');

    // Eksik kritik alanlar varsa doldurmaya çalış
    if (!criticalValidation.valid && criticalValidation.missing.length > 0) {
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
        try {
          // Eksik alan doldurma - yeterli metin gönder (150K limit)
          const fillText = extractedText.length > 150_000
            ? extractedText.substring(0, 97_500) + '\n\n[...atlandı...]\n\n' + extractedText.substring(extractedText.length - 52_500)
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
          logger.warn(`Kritik alan doldurma hatası: ${field}`, {
            module: 'unified-pipeline',
            error: fillError.message,
          });
        }
      }

      // Re-validate
      const revalidation = validateCriticalFields(result.analysis || result);
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
    // STEP 7: PIPELINE RAPORU
    // ═══════════════════════════════════════════════════════════════════
    const pipelineReport = monitor.generateReport();

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
      critical_fields_completeness: criticalValidation.completeness,
      performance: pipelineReport,
    };

    progress('complete', 'Analiz tamamlandı', 100);

    logger.info('═══ UNIFIED PIPELINE TAMAMLANDI ═══', {
      module: 'unified-pipeline',
      provider: usedProvider,
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      completeness: result.validation?.completeness_score || 0,
      criticalFieldsCompleteness: `${(criticalValidation.completeness * 100).toFixed(1)}%`,
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
      .replace(/\0/g, '')                        // null bytes
      .replace(/¿/g, '')                        // garbled question marks
      .replace(/\uFFFD/g, '')                   // Unicode replacement char
      .replace(/[^\S\n]{3,}/g, ' ')             // 3+ ardışık boşluk → tek boşluk
      .replace(/\n{4,}/g, '\n\n\n')             // 4+ ardışık newline → 3
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
        const confidence = typeof field === 'object' ? (field.confidence || 0) : 1;
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
        droppedFields: droppedFields.map(f => `${f.key}(${f.confidence}%)`).join(', '),
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
  const TEXT_LIMIT = 500_000;   // ~125K token (was 15K - 33x artış!)
  const TABLE_LIMIT = 100_000;  // ~25K token  (was 8K  - 12x artış!)

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

  try {
    const response = await anthropic.messages.create({
      model: aiConfig.claude.analysisModel, // Opus 4 - derin belge analizi için
      max_tokens: 8192, // 4K -> 8K (daha detaylı JSON çıktısı için)
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0]?.text || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch (err) {
    logger.warn('Claude analysis failed', { error: err.message });
    return {};
  }
}

function mergeResults(azureResult, claudeAnalysis) {
  // ═══════════════════════════════════════════════════════════════════════
  // Azure Custom Model'den gelen alanlar - CONFIDENCE BİLGİSİ KORUNUYOR
  // ═══════════════════════════════════════════════════════════════════════
  const MIN_MERGE_CONFIDENCE = 0.4; // Merge'de Azure'un kazanması için min güven (0.5 -> 0.4 düşürüldü: catering alanları 0.3-0.5 arasında)
  const rawFields = azureResult.fields || {};
  const customFields = {};
  const fieldConfidences = {}; // confidence bilgisini ayrı tut

  for (const [key, field] of Object.entries(rawFields)) {
    if (field && typeof field === 'object') {
      customFields[key] = field.value || field.content || null;
      fieldConfidences[key] = field.confidence || 0;
      // Array alanları: items varsa value olarak stringify kullan, items'ı da sakla
      if (field.items) {
        customFields[key] = field.value || JSON.stringify(field.items);
      }
    } else {
      customFields[key] = field;
      fieldConfidences[key] = 1; // primitive değer = güvenli
    }
  }

  // Merge confidence loglama - hangi alanlar atılıyor?
  const mergeDropped = [];
  for (const [key, val] of Object.entries(customFields)) {
    const conf = fieldConfidences[key] || 0;
    if (val !== null && val !== undefined && val !== '' && conf < MIN_MERGE_CONFIDENCE) {
      mergeDropped.push({ key, confidence: Math.round(conf * 100) });
    }
  }
  if (mergeDropped.length > 0) {
    logger.info(`Merge confidence filtreleme: ${mergeDropped.length} alan conf < ${MIN_MERGE_CONFIDENCE} nedeniyle atılacak`, {
      module: 'unified-pipeline',
      droppedFields: mergeDropped.map(f => `${f.key}(${f.confidence}%)`).join(', '),
    });
  }

  // Azure tablolarından veri çıkar
  const tables = azureResult.tables || [];
  const extractedTables = {
    menus: [],
    gramaj: [],
    personnel: [],
  };

  for (const table of tables) {
    const type = detectTableType(table);
    if (type === 'menu') extractedTables.menus.push(table);
    else if (type === 'gramaj') extractedTables.gramaj.push(table);
    else if (type === 'personnel') extractedTables.personnel.push(table);
  }

  // Custom Model field'larını kullan - SADECE yüksek confidence varsa
  const getField = (...keys) => {
    for (const key of keys) {
      const val = customFields[key];
      const conf = fieldConfidences[key] || 0;
      if (val !== null && val !== undefined && val !== '' && conf >= MIN_MERGE_CONFIDENCE) return val;
    }
    return null;
  };

  // Azure prebuilt alanlarından değer al
  const prebuiltFields = {
    institution: customFields.VendorName || customFields.CustomerName || null,
    estimated_value: customFields.InvoiceTotal || customFields.toplam_tutar || null,
    address: customFields.VendorAddressRecipient || customFields.VendorAddress || null,
  };

  // ═══════════════════════════════════════════════════════════════════════
  // AKILLI MERGE: Claude kazanır EĞER Azure'un confidence'ı düşükse
  // ═══════════════════════════════════════════════════════════════════════
  const mergeObjectField = (azureObj, claudeObj) => {
    const result = {};
    const allKeys = new Set([...Object.keys(azureObj || {}), ...Object.keys(claudeObj || {})]);
    for (const key of allKeys) {
      const azureVal = azureObj?.[key];
      const claudeVal = claudeObj?.[key];

      // Claude Opus 4.6 daha güvenilir - Claude doluysa Claude'u tercih et
      // Azure sadece Claude boşsa veya "Belirtilmemiş" ise devreye girsin
      if (claudeVal && claudeVal !== '' && claudeVal !== 'Belirtilmemiş' && claudeVal !== null) {
        result[key] = claudeVal;
      } else if (azureVal && azureVal !== '' && azureVal !== 'Belirtilmemiş') {
        result[key] = azureVal;
      } else {
        result[key] = claudeVal || azureVal || '';
      }
    }
    return result;
  };

  // KRİTİK ALANLAR - Zero-Loss Pipeline ile uyumlu format
  const iletisim = mergeObjectField(
    customFields.iletisim || {
      adres: getField('adres', 'idare_adres') || prebuiltFields.address,
      telefon: getField('telefon', 'idare_telefon'),
      email: getField('email', 'idare_email'),
      yetkili: getField('yetkili', 'yetkili_kisi'),
    },
    claudeAnalysis.iletisim
  );

  const teminat_oranlari = mergeObjectField(
    customFields.teminat_oranlari || {
      gecici: getField('gecici_teminat', 'gecici_teminat_orani'),
      kesin: getField('kesin_teminat', 'kesin_teminat_orani'),
    },
    claudeAnalysis.teminat_oranlari
  );

  // Azure v5'te dagitim_saatleri var - parse edip servis saatlerine böl
  const parseDagitimSaatleri = (dagitim) => {
    if (!dagitim) return {};
    const str = String(dagitim).toLowerCase();
    const result = {};
    // "kahvaltı 07:00-08:30, öğle 12:00-13:00, akşam 18:00-19:00" gibi format
    const kahvaltiMatch = str.match(/kahvalt[ıi][:\s]*(\d{1,2}[:.]\d{2}[\s-–]*\d{1,2}[:.]\d{2})/);
    const ogleMatch = str.match(/[öo]ğle[:\s]*(\d{1,2}[:.]\d{2}[\s-–]*\d{1,2}[:.]\d{2})/);
    const aksamMatch = str.match(/akşam[:\s]*(\d{1,2}[:.]\d{2}[\s-–]*\d{1,2}[:.]\d{2})/);
    if (kahvaltiMatch) result.kahvalti = kahvaltiMatch[1];
    if (ogleMatch) result.ogle = ogleMatch[1];
    if (aksamMatch) result.aksam = aksamMatch[1];
    return result;
  };

  const dagitimParsed = parseDagitimSaatleri(getField('dagitim_saatleri'));
  const servis_saatleri = mergeObjectField(
    customFields.servis_saatleri || {
      kahvalti: getField('kahvalti_saati') || dagitimParsed.kahvalti,
      ogle: getField('ogle_saati') || dagitimParsed.ogle,
      aksam: getField('aksam_saati') || dagitimParsed.aksam,
    },
    claudeAnalysis.servis_saatleri
  );

  const mali_kriterler = mergeObjectField(
    customFields.mali_kriterler || {
      is_deneyimi: getField('is_deneyimi', 'is_deneyim_orani'),
      ozkaynak_orani: getField('ozkaynak_orani'),
      cari_oran: getField('cari_oran'),
    },
    claudeAnalysis.mali_kriterler
  );

  const tahmini_bedel =
    getField('tahmini_bedel', 'yaklasik_maliyet', 'estimated_value') ||
    claudeAnalysis.tahmini_bedel ||
    claudeAnalysis.summary?.estimated_value ||
    null;

  return {
    // Ana özet bilgileri
    summary: {
      title: getField('ihale_baslik', 'ihale_konusu', 'title') || claudeAnalysis.summary?.title || null,
      institution:
        getField('kurum_adi', 'idare', 'idare_adi', 'institution') ||
        prebuiltFields.institution ||
        claudeAnalysis.summary?.institution ||
        null,
      ikn: getField('ihale_kayit_no', 'ikn', 'ihale_kayit_numarasi') || claudeAnalysis.summary?.ikn || null,
      estimated_value: tahmini_bedel || prebuiltFields.estimated_value,
    },
    dates: {
      // Azure v5: ise_baslama_tarihi, is_bitis_tarihi
      start_date:
        getField('ise_baslama_tarihi', 'baslangic_tarihi', 'is_baslangic', 'start_date') ||
        claudeAnalysis.dates?.start_date || null,
      end_date:
        getField('is_bitis_tarihi', 'bitis_tarihi', 'is_bitis', 'end_date') ||
        claudeAnalysis.dates?.end_date || null,
      tender_date: getField('ihale_tarihi', 'tender_date') || claudeAnalysis.dates?.tender_date || null,
    },
    financial: {
      estimated_value: tahmini_bedel,
      guarantee_rate: getField('teminat_orani', 'gecici_teminat') || claudeAnalysis.financial?.guarantee_rate || null,
    },
    catering: {
      // Azure v5: toplam_personel_sayisi (toplam kişi = yemek yiyen), gunluk_toplam_ogun
      total_persons:
        getField('kisi_sayisi', 'toplam_kisi', 'total_persons') || claudeAnalysis.catering?.total_persons || null,
      daily_meals:
        getField('gunluk_toplam_ogun', 'gunluk_ogun', 'ogun_sayisi', 'daily_meals') ||
        claudeAnalysis.catering?.daily_meals || null,
      contract_duration:
        getField('sozlesme_suresi', 'sure') || claudeAnalysis.catering?.contract_duration || null,
      meal_types: getField('ogun_turleri', 'meal_types') || claudeAnalysis.catering?.meal_types || [],
      sample_menus: extractedTables.menus,
      gramaj: getField('gramaj_listesi', 'gramaj', 'gramaj_tablosu') || extractGramajData(extractedTables.gramaj),

      // ═══ AZURE v5 CATERİNG-SPESİFİK ALANLAR ═══
      // Kişi dağılımı (öğün bazlı)
      breakfast_persons:
        getField('kahvalti_kisi_sayisi') || claudeAnalysis.catering?.breakfast_persons || null,
      lunch_persons:
        getField('ogle_kisi_sayisi') || claudeAnalysis.catering?.lunch_persons || null,
      dinner_persons:
        getField('aksam_kisi_sayisi') || claudeAnalysis.catering?.dinner_persons || null,
      diet_persons:
        getField('diyet_kisi_sayisi') || claudeAnalysis.catering?.diet_persons || null,

      // Operasyonel bilgiler
      service_days:
        getField('hizmet_gun_sayisi') || claudeAnalysis.catering?.service_days || null,
      kitchen_type:
        getField('mutfak_tipi') || claudeAnalysis.catering?.kitchen_type || null,
      service_type:
        getField('servis_tipi') || claudeAnalysis.catering?.service_type || null,
      meat_type:
        getField('et_tipi') || claudeAnalysis.catering?.meat_type || null,
      meal_variety:
        getField('yemek_cesit_sayisi') || claudeAnalysis.catering?.meal_variety || null,
      cooking_location:
        getField('yemek_pisirilecek_yer') || claudeAnalysis.catering?.cooking_location || null,
      labor_rate:
        getField('iscilik_orani') || claudeAnalysis.catering?.labor_rate || null,
      delivery_hours:
        getField('dagitim_saatleri') || claudeAnalysis.catering?.delivery_hours || null,
      quality_standards:
        getField('kalite_standartlari') || claudeAnalysis.catering?.quality_standards || null,
      food_safety_docs:
        getField('gida_guvenligi_belgeleri') || claudeAnalysis.catering?.food_safety_docs || null,

      // Dağıtım ve ekipman
      distribution_points:
        getField('dagitim_noktalari') || claudeAnalysis.catering?.distribution_points || null,
      equipment_list:
        getField('ekipman_listesi') || claudeAnalysis.catering?.equipment_list || null,
      material_list:
        getField('malzeme_listesi') || claudeAnalysis.catering?.material_list || null,

      // Tablo verileri (Azure v5 custom model'den)
      meal_distribution:
        getField('ogun_dagilimi') || claudeAnalysis.catering?.meal_distribution || null,
      unit_price_table:
        getField('birim_fiyat_cetveli') || claudeAnalysis.catering?.unit_price_table || null,
      menu_table:
        getField('menu_tablosu') || claudeAnalysis.catering?.menu_table || null,
    },
    personnel: {
      // Azure v5: toplam_personel_sayisi, personel_tablosu
      total_count:
        getField('toplam_personel_sayisi', 'personel_sayisi', 'toplam_personel') ||
        claudeAnalysis.personnel?.total_count || null,
      staff:
        getField('personel_listesi', 'personel', 'personel_tablosu') ||
        extractPersonnelData(extractedTables.personnel),
    },
    technical_requirements: getField('teknik_sartlar') || claudeAnalysis.technical_requirements || [],
    penalties: getField('ceza_kosullari', 'cezalar') || claudeAnalysis.penalties || [],
    important_notes: getField('onemli_notlar', 'notlar') || claudeAnalysis.important_notes || [],

    // ═══════════════════════════════════════════════════════════════════════
    // KRİTİK ALANLAR - Zero-Loss Pipeline ile uyumlu (UI'da gösterilir)
    // ═══════════════════════════════════════════════════════════════════════
    iletisim,
    teminat_oranlari,
    servis_saatleri,
    mali_kriterler,
    tahmini_bedel,
  };
}

function detectTableType(table) {
  // REST API formatı: cells array ile geliyor
  // SDK formatı: headers ve rows ile geliyor
  let text = '';

  if (table.cells) {
    // REST API formatı
    text = table.cells
      .map((c) => c.content || '')
      .join(' ')
      .toLowerCase();
  } else {
    // SDK formatı
    text = [...(table.headers || []), ...(table.rows || []).flat()].join(' ').toLowerCase();
  }

  if (text.includes('menü') || text.includes('kahvaltı') || text.includes('öğle') || text.includes('yemek'))
    return 'menu';
  if (text.includes('gram') || text.includes('porsiyon') || text.includes('miktar') || text.includes('ağırlık'))
    return 'gramaj';
  if (text.includes('personel') || text.includes('aşçı') || text.includes('görevli') || text.includes('çalışan'))
    return 'personnel';
  return 'unknown';
}

function extractGramajData(tables) {
  const results = [];
  for (const table of tables) {
    // REST API formatı: cells array
    if (table.cells) {
      const cellsByRow = {};
      for (const cell of table.cells) {
        if (!cellsByRow[cell.rowIndex]) cellsByRow[cell.rowIndex] = [];
        cellsByRow[cell.rowIndex][cell.columnIndex] = cell.content || '';
      }
      // İlk satır header olabilir, atla
      const rows = Object.keys(cellsByRow)
        .map(Number)
        .sort((a, b) => a - b);
      for (let i = 1; i < rows.length; i++) {
        const row = cellsByRow[rows[i]] || [];
        if (row.length >= 2) {
          const item = row[0]?.trim();
          const weightMatch = row[1]?.match(/(\d+)/);
          if (item && weightMatch) {
            results.push({ item, weight: weightMatch[1], unit: 'g' });
          }
        }
      }
    } else {
      // SDK formatı: rows array
      for (const row of table.rows || []) {
        if (row.length >= 2) {
          const item = row[0];
          const weight = row[1]?.match(/(\d+)/)?.[1];
          if (item && weight) {
            results.push({ item, weight, unit: 'g' });
          }
        }
      }
    }
  }
  return results;
}

function extractPersonnelData(tables) {
  const results = [];
  for (const table of tables) {
    // REST API formatı: cells array
    if (table.cells) {
      const cellsByRow = {};
      for (const cell of table.cells) {
        if (!cellsByRow[cell.rowIndex]) cellsByRow[cell.rowIndex] = [];
        cellsByRow[cell.rowIndex][cell.columnIndex] = cell.content || '';
      }
      // İlk satır header olabilir, atla
      const rows = Object.keys(cellsByRow)
        .map(Number)
        .sort((a, b) => a - b);
      for (let i = 1; i < rows.length; i++) {
        const row = cellsByRow[rows[i]] || [];
        if (row.length >= 2) {
          const position = row[0]?.trim();
          const countMatch = row[1]?.match(/(\d+)/);
          if (position && countMatch) {
            results.push({ pozisyon: position, adet: parseInt(countMatch[1], 10) });
          }
        }
      }
    } else {
      // SDK formatı: rows array
      for (const row of table.rows || []) {
        if (row.length >= 2) {
          const position = row[0];
          const count = parseInt(row[1]?.match(/(\d+)/)?.[1], 10);
          if (position && count) {
            results.push({ pozisyon: position, adet: count });
          }
        }
      }
    }
  }
  return results;
}

function calculateCompleteness(analysis) {
  // Temel alanlar (eskisiyle uyumlu, toplam 70 puan)
  const coreChecks = [
    { field: 'summary.title', weight: 5, value: analysis.summary?.title ? 1 : 0 },
    { field: 'summary.institution', weight: 5, value: analysis.summary?.institution ? 1 : 0 },
    { field: 'summary.ikn', weight: 5, value: analysis.summary?.ikn ? 1 : 0 },
    { field: 'catering.total_persons', weight: 8, value: analysis.catering?.total_persons ? 1 : 0 },
    { field: 'catering.daily_meals', weight: 8, value: analysis.catering?.daily_meals ? 1 : 0 },
    { field: 'catering.sample_menus', weight: 10, value: (analysis.catering?.sample_menus?.length || 0) > 0 ? 1 : 0 },
    { field: 'catering.gramaj', weight: 10, value: (analysis.catering?.gramaj?.length || 0) > 0 ? 1 : 0 },
    { field: 'personnel.staff', weight: 9, value: (analysis.personnel?.staff?.length || 0) > 0 ? 1 : 0 },
    { field: 'dates.start_date', weight: 5, value: analysis.dates?.start_date ? 1 : 0 },
    { field: 'dates.end_date', weight: 5, value: analysis.dates?.end_date ? 1 : 0 },
  ];

  // Azure v5 catering-spesifik alanlar (bonus 30 puan)
  const cateringChecks = [
    { field: 'catering.breakfast_persons', weight: 3, value: analysis.catering?.breakfast_persons ? 1 : 0 },
    { field: 'catering.lunch_persons', weight: 3, value: analysis.catering?.lunch_persons ? 1 : 0 },
    { field: 'catering.dinner_persons', weight: 3, value: analysis.catering?.dinner_persons ? 1 : 0 },
    { field: 'catering.service_days', weight: 3, value: analysis.catering?.service_days ? 1 : 0 },
    { field: 'catering.kitchen_type', weight: 3, value: analysis.catering?.kitchen_type ? 1 : 0 },
    { field: 'catering.cooking_location', weight: 3, value: analysis.catering?.cooking_location ? 1 : 0 },
    { field: 'catering.delivery_hours', weight: 2, value: analysis.catering?.delivery_hours ? 1 : 0 },
    { field: 'catering.labor_rate', weight: 3, value: analysis.catering?.labor_rate ? 1 : 0 },
    { field: 'catering.distribution_points', weight: 2, value: analysis.catering?.distribution_points ? 1 : 0 },
    { field: 'catering.equipment_list', weight: 2, value: analysis.catering?.equipment_list ? 1 : 0 },
    { field: 'catering.material_list', weight: 3, value: analysis.catering?.material_list ? 1 : 0 },
  ];

  const allChecks = [...coreChecks, ...cateringChecks];

  let score = 0;
  const missing = [];

  for (const check of allChecks) {
    if (check.value > 0) score += check.weight;
    else missing.push(check.field);
  }

  return { score, missing, total: 100 };
}

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
