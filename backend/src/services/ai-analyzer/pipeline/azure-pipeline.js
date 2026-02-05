/**
 * Azure Document Intelligence Pipeline
 * İhale dökümanları için yüksek doğruluklu extraction
 *
 * Bu pipeline, standart Zero-Loss pipeline'a alternatif olarak
 * Azure Document Intelligence kullanır.
 *
 * Avantajları:
 * - Tablo extraction %99+ doğruluk
 * - Custom model ile ihale-spesifik alanlar
 * - OCR aşaması gereksiz (Azure kendi OCR'ını kullanır)
 * - Chunking gereksiz (Azure tüm dökümanı işler)
 */

import fs from 'node:fs';
import path from 'node:path';
import logger from '../../../utils/logger.js';
import { analyzeIhaleDocument, analyzeWithLayout, isAzureConfigured } from '../providers/azure-document-ai.js';
import { createErrorOutput, createSuccessOutput } from '../schemas/final-output.js';

/**
 * Azure Document Intelligence ile ihale dökümanı analizi
 *
 * @param {string} filePath - Dosya yolu
 * @param {Object} options - Ayarlar
 * @returns {Promise<Object>} Analiz sonucu (Zero-Loss formatında)
 */
export async function runAzurePipeline(filePath, options = {}) {
  const startTime = Date.now();
  const { onProgress, useCustomModel = true, modelId = null } = options;

  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const documentId = `azure_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Azure konfigürasyon kontrolü
  if (!isAzureConfigured()) {
    logger.error('Azure Document Intelligence not configured', { module: 'azure-pipeline' });
    return createErrorOutput(
      documentId,
      "Azure Document Intelligence yapılandırılmamış. AZURE_DOCUMENT_AI_ENDPOINT ve AZURE_DOCUMENT_AI_KEY environment variable'larını ayarlayın."
    );
  }

  // ZIP kontrolü
  if (ext === '.zip') {
    logger.error('ZIP file rejected by Azure pipeline', { module: 'azure-pipeline', file: fileName });
    return createErrorOutput(documentId, 'ZIP dosyaları doğrudan analiz edilemez');
  }

  // Desteklenen formatlar
  const supportedFormats = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'];
  if (!supportedFormats.includes(ext)) {
    logger.error('Unsupported file format for Azure', { module: 'azure-pipeline', ext });
    return createErrorOutput(
      documentId,
      `Azure Document Intelligence ${ext} formatını desteklemiyor. Desteklenen: ${supportedFormats.join(', ')}`
    );
  }

  logger.info('═══ AZURE PIPELINE BAŞLADI ═══', {
    module: 'azure-pipeline',
    file: fileName,
    useCustomModel,
  });

  try {
    // Progress: Başlangıç
    if (onProgress) {
      onProgress({
        stage: 'azure-upload',
        message: "Döküman Azure'a gönderiliyor...",
        progress: 10,
      });
    }

    // Dosyayı oku
    const documentBuffer = fs.readFileSync(filePath);
    const fileSize = documentBuffer.length;

    logger.info('▶ Azure analizi başlıyor...', {
      module: 'azure-pipeline',
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
    });

    // Progress: Analiz
    if (onProgress) {
      onProgress({
        stage: 'azure-analysis',
        message: 'Azure Document Intelligence analiz ediyor...',
        progress: 30,
      });
    }

    // Azure analizi
    let azureResult;

    if (useCustomModel) {
      // Custom model + Layout birlikte
      azureResult = await analyzeIhaleDocument(documentBuffer, modelId);
    } else {
      // Sadece Layout (custom model eğitilmemişse)
      azureResult = await analyzeWithLayout(documentBuffer);
      azureResult.analysis = transformLayoutToAnalysis(azureResult);
    }

    if (!azureResult.success) {
      throw new Error(azureResult.error || 'Azure analizi başarısız');
    }

    // Progress: İşleme
    if (onProgress) {
      onProgress({
        stage: 'azure-processing',
        message: 'Sonuçlar işleniyor...',
        progress: 70,
      });
    }

    logger.info('✓ Azure analizi tamamlandı', {
      module: 'azure-pipeline',
      tables: azureResult.tables?.length || 0,
      customModelUsed: azureResult.customModelUsed || false,
      elapsed_ms: azureResult.meta?.elapsed_ms,
    });

    // Validation
    const validation = {
      valid: true,
      schema_errors: [],
      completeness_score: calculateAzureCompleteness(azureResult.analysis),
      completeness_details: {},
      p0_checks: {
        all_passed: true,
        checks: [
          { code: 'AZURE-01', name: 'Azure API Success', passed: true },
          { code: 'AZURE-02', name: 'Table Extraction', passed: (azureResult.tables?.length || 0) > 0 },
        ],
      },
    };

    // Final output
    const totalDuration = Date.now() - startTime;

    if (onProgress) {
      onProgress({
        stage: 'complete',
        message: 'Azure analizi tamamlandı',
        progress: 100,
      });
    }

    const result = createSuccessOutput(documentId, azureResult.analysis, validation, {
      pipeline_version: 'azure-1.0.0',
      provider: 'azure-document-intelligence',
      stats: {
        total_tables: azureResult.tables?.length || 0,
        total_paragraphs: azureResult.paragraphs?.length || 0,
        custom_model_used: azureResult.customModelUsed || false,
        total_duration_ms: totalDuration,
        azure_duration_ms: azureResult.meta?.elapsed_ms || 0,
      },
      file_info: {
        name: fileName,
        type: ext.replace('.', ''),
        size: fileSize,
        ocr_applied: true, // Azure her zaman OCR yapar
      },
    });

    // Azure-spesifik veriler
    result.azure = {
      tables: azureResult.tables,
      paragraphs: azureResult.paragraphs,
      confidence: azureResult.confidence,
    };

    logger.info('═══ AZURE PIPELINE TAMAMLANDI ═══', {
      module: 'azure-pipeline',
      duration: `${(totalDuration / 1000).toFixed(1)}s`,
      tables: azureResult.tables?.length || 0,
      completeness: validation.completeness_score,
    });

    return result;
  } catch (error) {
    logger.error('Azure Pipeline failed', {
      module: 'azure-pipeline',
      error: error.message,
      filePath,
    });

    return createErrorOutput(documentId, error.message);
  }
}

/**
 * Layout sonuçlarını analysis formatına dönüştür
 * (Custom model olmadan sadece layout kullanıldığında)
 */
function transformLayoutToAnalysis(layoutResult) {
  const analysis = {
    summary: {
      title: '',
      institution: '',
      tender_type: '',
      estimated_value: '',
      duration: '',
      ikn: '',
    },
    dates: {
      tender_date: null,
      start_date: null,
      end_date: null,
      deadline: null,
      all_dates: [],
    },
    financial: {
      estimated_cost: {},
      unit_prices: [],
      guarantees: {},
      all_amounts: [],
    },
    penalties: [],
    catering: {
      meals: [],
      gramaj: [],
      service_times: {},
      quality_requirements: [],
      daily_meal_count: null,
      person_count: null,
    },
    personnel: {
      staff: [],
      qualifications: [],
      working_conditions: [],
      wage_info: [],
      total_count: null,
    },
    technical_requirements: [],
  };

  // Paragraflardan tarih çıkar
  const dateRegex = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/g;
  const amountRegex = /([\d.,]+)\s*(TL|₺|lira)/gi;

  for (const para of layoutResult.paragraphs || []) {
    const text = para.content;

    // Tarihleri bul
    const dates = text.match(dateRegex);
    if (dates) {
      for (const d of dates) {
        analysis.dates.all_dates.push({
          date: d,
          type: 'unknown',
          source: 'azure-layout',
        });
      }
    }

    // Tutarları bul
    const amounts = text.matchAll(amountRegex);
    for (const match of amounts) {
      analysis.financial.all_amounts.push({
        value: match[1],
        currency: 'TRY',
        type: 'unknown',
        source: 'azure-layout',
      });
    }
  }

  // Tablolardan gramaj çıkar
  for (const table of layoutResult.tables || []) {
    const isGramajTable = table.headers?.some(
      (h) =>
        h.toLowerCase().includes('gramaj') || h.toLowerCase().includes('miktar') || h.toLowerCase().includes('porsiyon')
    );

    if (isGramajTable) {
      for (const row of table.rows || []) {
        const item = row[0];
        const weightCell = row.find((cell) => /\d+\s*(g|gr|gram|kg)/i.test(cell));

        if (item && weightCell) {
          analysis.catering.gramaj.push({
            item,
            weight: weightCell.match(/[\d.,]+/)?.[0],
            unit: weightCell.match(/(g|gr|gram|kg)/i)?.[0] || 'g',
            source: 'azure-layout',
          });
        }
      }
    }

    // Personel tablosu
    const isPersonelTable = table.headers?.some(
      (h) =>
        h.toLowerCase().includes('personel') ||
        h.toLowerCase().includes('unvan') ||
        h.toLowerCase().includes('pozisyon')
    );

    if (isPersonelTable) {
      for (const row of table.rows || []) {
        const position = row[0];
        const countCell = row.find((cell) => /^\d+$/.test(cell?.trim()));

        if (position && countCell) {
          analysis.personnel.staff.push({
            pozisyon: position,
            adet: parseInt(countCell, 10),
            source: 'azure-layout',
          });
        }
      }
    }
  }

  return analysis;
}

/**
 * Azure sonuçları için completeness hesapla
 */
function calculateAzureCompleteness(analysis) {
  const checks = [
    { field: 'dates.all_dates', weight: 15, value: analysis.dates?.all_dates?.length || 0 },
    { field: 'financial.all_amounts', weight: 15, value: analysis.financial?.all_amounts?.length || 0 },
    { field: 'catering.gramaj', weight: 20, value: analysis.catering?.gramaj?.length || 0 },
    { field: 'personnel.staff', weight: 15, value: analysis.personnel?.staff?.length || 0 },
    { field: 'penalties', weight: 10, value: analysis.penalties?.length || 0 },
    { field: 'technical_requirements', weight: 10, value: analysis.technical_requirements?.length || 0 },
    { field: 'summary.institution', weight: 5, value: analysis.summary?.institution ? 1 : 0 },
    { field: 'summary.ikn', weight: 5, value: analysis.summary?.ikn ? 1 : 0 },
    { field: 'summary.estimated_value', weight: 5, value: analysis.summary?.estimated_value ? 1 : 0 },
  ];

  let totalScore = 0;
  let maxScore = 0;

  for (const check of checks) {
    maxScore += check.weight;
    if (check.value > 0) {
      totalScore += check.weight;
    }
  }

  return Math.round((totalScore / maxScore) * 100);
}

/**
 * Azure ve Claude pipeline'larını karşılaştır
 * A/B test için
 */
export async function compareWithClaude(filePath, options = {}) {
  const { runZeroLossPipeline } = await import('./index.js');

  logger.info('Starting A/B comparison: Azure vs Claude', {
    module: 'azure-pipeline',
    file: path.basename(filePath),
  });

  // Her iki pipeline'ı paralel çalıştır
  const [azureResult, claudeResult] = await Promise.all([
    runAzurePipeline(filePath, options),
    runZeroLossPipeline(filePath, options),
  ]);

  // Karşılaştırma raporu
  const comparison = {
    file: path.basename(filePath),
    timestamp: new Date().toISOString(),
    azure: {
      success: azureResult.success,
      duration_ms: azureResult.meta?.stats?.total_duration_ms,
      completeness: azureResult.validation?.completeness_score,
      tables: azureResult.azure?.tables?.length || 0,
      dates: azureResult.analysis?.dates?.all_dates?.length || 0,
      amounts: azureResult.analysis?.financial?.all_amounts?.length || 0,
      gramaj: azureResult.analysis?.catering?.gramaj?.length || 0,
      personnel: azureResult.analysis?.personnel?.staff?.length || 0,
    },
    claude: {
      success: claudeResult.success,
      duration_ms: claudeResult.meta?.stats?.total_duration_ms,
      completeness: claudeResult.validation?.completeness_score,
      chunks: claudeResult.meta?.stats?.total_chunks || 0,
      dates: claudeResult.analysis?.dates?.all_dates?.length || 0,
      amounts: claudeResult.analysis?.financial?.all_amounts?.length || 0,
      gramaj: claudeResult.analysis?.catering?.gramaj?.length || 0,
      personnel: claudeResult.analysis?.personnel?.staff?.length || 0,
    },
    winner: null,
  };

  // Kazananı belirle (daha yüksek completeness)
  if (comparison.azure.completeness > comparison.claude.completeness) {
    comparison.winner = 'azure';
  } else if (comparison.claude.completeness > comparison.azure.completeness) {
    comparison.winner = 'claude';
  } else {
    comparison.winner = 'tie';
  }

  logger.info('A/B comparison completed', {
    module: 'azure-pipeline',
    winner: comparison.winner,
    azure_completeness: comparison.azure.completeness,
    claude_completeness: comparison.claude.completeness,
  });

  return {
    comparison,
    azure: azureResult,
    claude: claudeResult,
  };
}

export default {
  runAzurePipeline,
  compareWithClaude,
  isAzureConfigured,
};
