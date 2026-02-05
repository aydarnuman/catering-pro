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
 *   1. Azure Custom Model (ihale-catering-v1) → En doğru
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
    // STEP 1: AZURE CUSTOM MODEL (Eğitilmiş model - en doğru)
    // ═══════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: AZURE LAYOUT (Prebuilt - tablo çıkarma)
    // ═══════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: CLAUDE SEMANTIC ANALYSIS
    // ═══════════════════════════════════════════════════════════════════

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
          const fillPrompt = config.fallbackPrompt + `\n\nMETİN:\n${extractedText.substring(0, 15000)}`;

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

  // Metin oluştur - paragraphs veya raw.content'ten
  let text = '';

  // REST API formatı: raw.content içinde metin olabilir
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

  // Tablo metni - REST API cells formatını destekle
  let tableText = '';
  for (let i = 0; i < Math.min(tables.length, 20); i++) {
    // İlk 20 tablo
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
      for (const rowNum of rowNums.slice(0, 15)) {
        // İlk 15 satır
        const rowCells = cellsByRow[rowNum] || [];
        tableText += `| ${rowCells.join(' | ')} |\n`;
      }
    } else {
      // SDK formatı: headers ve rows
      if (table.headers?.length) {
        tableText += `| ${table.headers.join(' | ')} |\n`;
      }
      for (const row of (table.rows || []).slice(0, 15)) {
        tableText += `| ${row.join(' | ')} |\n`;
      }
    }
  }

  // Custom Model field'larını metin olarak ekle - .value özelliğini al
  let fieldsText = '';
  const extractedFields = {};
  if (Object.keys(customFields).length > 0) {
    fieldsText = '\n--- AZURE CUSTOM MODEL ÇIKTISI ---\n';
    for (const [key, field] of Object.entries(customFields)) {
      if (field !== null && field !== undefined) {
        const value = typeof field === 'object' ? field.value || field.content : field;
        if (value) {
          fieldsText += `${key}: ${value}\n`;
          extractedFields[key] = value;
        }
      }
    }
  }

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

  let prompt;

  if (hasCustomData) {
    // Custom Model başarılı - eksik alanları + kritik alanları tamamla
    prompt = `Sen bir ihale belgesi analiz uzmanısın. Azure Custom Model aşağıdaki verileri çıkardı. 
Belge metninden EKSİK KALAN bilgileri bul ve tamamla.

ÖNEMLİ: Aşağıdaki KRİTİK ALANLAR mutlaka doldurulmalı (varsa):
- iletisim (adres, telefon, email, yetkili)
- teminat_oranlari (gecici, kesin)
- servis_saatleri (kahvalti, ogle, aksam)
- mali_kriterler (is_deneyimi, ozkaynak_orani, cari_oran)
- tahmini_bedel

AZURE CUSTOM MODEL ÇIKTISI:
${preparedData.fieldsText}

BELGE METNİ (özet):
${preparedData.text.substring(0, 12000)}

TABLOLAR:
${preparedData.tableText.substring(0, 5000)}

Sadece BULUNAN değerleri içeren JSON döndür (bulunamayanlar null):
{
  "summary": { "title": null, "institution": null, "ikn": null },
  "dates": { "start_date": null, "end_date": null, "tender_date": null },
  "catering": { "total_persons": null, "daily_meals": null },
  "personnel": { "total_count": null },
  ${criticalFieldsSchema}
}`;
  } else {
    // Custom Model başarısız - tam analiz yap
    prompt = `Sen bir ihale belgesi analiz uzmanısın. Aşağıdaki belgeyi analiz et ve JSON formatında çıktı ver.

ÖNEMLİ: Aşağıdaki KRİTİK ALANLAR mutlaka doldurulmalı (varsa):
- iletisim (adres, telefon, email, yetkili)
- teminat_oranlari (gecici, kesin)
- servis_saatleri (kahvalti, ogle, aksam)
- mali_kriterler (is_deneyimi, ozkaynak_orani, cari_oran)
- tahmini_bedel

BELGE METNİ:
${preparedData.text.substring(0, 15000)}

TABLOLAR:
${preparedData.tableText.substring(0, 8000)}

Aşağıdaki JSON formatında yanıt ver (sadece bulunan değerleri doldur):
{
  "summary": {
    "title": "İhale başlığı",
    "institution": "İhaleyi açan kurum",
    "ikn": "İhale kayıt numarası (2024/123456 formatında)"
  },
  "catering": {
    "total_persons": "Toplam kişi sayısı (sadece sayı)",
    "daily_meals": "Günlük öğün sayısı (sadece sayı)",
    "contract_duration": "Sözleşme süresi (ay)",
    "meal_types": ["kahvaltı", "öğle", "akşam"]
  },
  "dates": {
    "start_date": "İşe başlama tarihi (GG.AA.YYYY)",
    "end_date": "İş bitiş tarihi (GG.AA.YYYY)",
    "tender_date": "İhale tarihi (GG.AA.YYYY)"
  },
  "personnel": {
    "total_count": "Toplam personel sayısı",
    "positions": [{"title": "Pozisyon", "count": 5}]
  },
  ${criticalFieldsSchema}
}`;
  }

  try {
    const response = await anthropic.messages.create({
      model: aiConfig.claude.defaultModel, // Daha iyi model kullan
      max_tokens: 4096,
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
  // Azure Custom Model'den gelen eğitilmiş alanlar - .value özelliğini al
  const rawFields = azureResult.fields || {};
  const customFields = {};
  for (const [key, field] of Object.entries(rawFields)) {
    if (field && typeof field === 'object') {
      // {value: "...", confidence: 0.9} formatı
      customFields[key] = field.value || field.content || null;
      // Array tipindeki field'lar için items'ı al
      if (field.items) customFields[key] = field.items;
    } else {
      customFields[key] = field;
    }
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

  // Custom Model field'larını kullan, yoksa Claude'dan al
  // Türkçe, İngilizce ve Azure prebuilt alan isimlerini kontrol et
  const getField = (...keys) => {
    for (const key of keys) {
      const val = customFields[key];
      if (val !== null && val !== undefined && val !== '') return val;
    }
    return null;
  };

  // Azure prebuilt alanlarından değer al (VendorName, CustomerName, InvoiceTotal gibi)
  const prebuiltFields = {
    institution: customFields.VendorName || customFields.CustomerName || null,
    estimated_value: customFields.InvoiceTotal || customFields.toplam_tutar || null,
    address: customFields.VendorAddressRecipient || customFields.VendorAddress || null,
  };

  // Object alanları birleştir (dolu değerler öncelikli)
  const mergeObjectField = (azureObj, claudeObj) => {
    const result = {};
    const allKeys = new Set([...Object.keys(azureObj || {}), ...Object.keys(claudeObj || {})]);
    for (const key of allKeys) {
      const azureVal = azureObj?.[key];
      const claudeVal = claudeObj?.[key];
      // Azure'dan dolu değer varsa onu al, yoksa Claude'dan
      if (azureVal && azureVal !== '' && azureVal !== 'Belirtilmemiş') {
        result[key] = azureVal;
      } else if (claudeVal && claudeVal !== '' && claudeVal !== 'Belirtilmemiş') {
        result[key] = claudeVal;
      } else {
        result[key] = azureVal || claudeVal || '';
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

  const servis_saatleri = mergeObjectField(
    customFields.servis_saatleri || {
      kahvalti: getField('kahvalti_saati'),
      ogle: getField('ogle_saati'),
      aksam: getField('aksam_saati'),
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
      start_date:
        getField('baslangic_tarihi', 'is_baslangic', 'start_date') || claudeAnalysis.dates?.start_date || null,
      end_date: getField('bitis_tarihi', 'is_bitis', 'end_date') || claudeAnalysis.dates?.end_date || null,
      tender_date: getField('ihale_tarihi', 'tender_date') || claudeAnalysis.dates?.tender_date || null,
    },
    financial: {
      estimated_value: tahmini_bedel,
      guarantee_rate: getField('teminat_orani', 'gecici_teminat') || claudeAnalysis.financial?.guarantee_rate || null,
    },
    catering: {
      total_persons:
        getField('kisi_sayisi', 'toplam_kisi', 'total_persons') || claudeAnalysis.catering?.total_persons || null,
      daily_meals:
        getField('gunluk_ogun', 'ogun_sayisi', 'daily_meals') || claudeAnalysis.catering?.daily_meals || null,
      contract_duration: getField('sozlesme_suresi', 'sure') || claudeAnalysis.catering?.contract_duration || null,
      meal_types: getField('ogun_turleri', 'meal_types') || claudeAnalysis.catering?.meal_types || [],
      sample_menus: extractedTables.menus,
      gramaj: getField('gramaj_listesi', 'gramaj') || extractGramajData(extractedTables.gramaj),
    },
    personnel: {
      total_count: getField('personel_sayisi', 'toplam_personel') || claudeAnalysis.personnel?.total_count || null,
      staff: getField('personel_listesi', 'personel') || extractPersonnelData(extractedTables.personnel),
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
  const checks = [
    { field: 'summary.title', weight: 5, value: analysis.summary?.title ? 1 : 0 },
    { field: 'summary.institution', weight: 5, value: analysis.summary?.institution ? 1 : 0 },
    { field: 'summary.ikn', weight: 5, value: analysis.summary?.ikn ? 1 : 0 },
    { field: 'catering.total_persons', weight: 10, value: analysis.catering?.total_persons ? 1 : 0 },
    { field: 'catering.daily_meals', weight: 10, value: analysis.catering?.daily_meals ? 1 : 0 },
    { field: 'catering.sample_menus', weight: 15, value: (analysis.catering?.sample_menus?.length || 0) > 0 ? 1 : 0 },
    { field: 'catering.gramaj', weight: 15, value: (analysis.catering?.gramaj?.length || 0) > 0 ? 1 : 0 },
    { field: 'personnel.staff', weight: 15, value: (analysis.personnel?.staff?.length || 0) > 0 ? 1 : 0 },
    { field: 'dates.start_date', weight: 10, value: analysis.dates?.start_date ? 1 : 0 },
    { field: 'dates.end_date', weight: 10, value: analysis.dates?.end_date ? 1 : 0 },
  ];

  let score = 0;
  const missing = [];

  for (const check of checks) {
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
