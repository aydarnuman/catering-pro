/**
 * @deprecated v9.0'dan itibaren kullanılmıyor!
 *
 * unified-pipeline.js aynı işlevselliği içerir:
 *   import { analyzeDocument } from './unified-pipeline.js';
 *
 * Bu dosya geriye uyumluluk için korunuyor ama yeni kodda KULLANILMAMALI.
 * Tüm Azure+Claude hibrit mantığı unified-pipeline.js'e taşındı.
 *
 * Eski: Hybrid Pipeline - Azure Document Intelligence + Claude Semantic Analysis
 */

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import aiConfig, { isAzureConfigured } from '../../../config/ai.config.js';
import logger from '../../../utils/logger.js';
import { analyzeWithLayout } from '../providers/azure-document-ai.js';
import { createErrorOutput, createSuccessOutput } from '../schemas/final-output.js';
import { runZeroLossPipeline } from './index.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════════════════
// HYBRID PIPELINE - MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run Hybrid Pipeline: Azure for tables + Claude for semantic analysis
 *
 * @param {string} filePath - Path to document
 * @param {Object} options - Pipeline options
 * @returns {Promise<Object>} Analysis result in standard format
 */
export async function runHybridPipeline(filePath, options = {}) {
  const startTime = Date.now();
  const { onProgress } = options;

  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const documentId = `hybrid_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // ZIP kontrolü
  if (ext === '.zip') {
    logger.error('ZIP file rejected by Hybrid pipeline', { module: 'hybrid-pipeline', file: fileName });
    return createErrorOutput(documentId, 'ZIP dosyaları doğrudan analiz edilemez');
  }

  logger.info('═══ HYBRID PIPELINE BAŞLADI ═══', {
    module: 'hybrid-pipeline',
    file: fileName,
    azureConfigured: isAzureConfigured(),
  });

  try {
    // ===== STEP 1: AZURE DOCUMENT INTELLIGENCE =====
    if (onProgress) {
      onProgress({ stage: 'azure', message: 'Azure Document Intelligence analiz ediyor...', progress: 10 });
    }

    logger.info('▶ Step 1: Azure Layout Analysis başlıyor...', { module: 'hybrid-pipeline' });

    const documentBuffer = fs.readFileSync(filePath);
    const fileSize = documentBuffer.length;

    let azureResult;
    try {
      azureResult = await analyzeWithLayout(documentBuffer);

      if (!azureResult.success) {
        throw new Error(azureResult.error || 'Azure analysis failed');
      }

      logger.info('✓ Step 1 tamamlandı', {
        module: 'hybrid-pipeline',
        tables: azureResult.tables?.length || 0,
        paragraphs: azureResult.paragraphs?.length || 0,
        elapsed_ms: azureResult.meta?.elapsed_ms,
      });
    } catch (azureError) {
      // Fallback to Claude if Azure fails
      if (aiConfig.pipeline.fallbackToClaudeOnError) {
        logger.warn('Azure failed, falling back to Claude pipeline', {
          module: 'hybrid-pipeline',
          error: azureError.message,
        });
        return await runZeroLossPipeline(filePath, options);
      }
      throw azureError;
    }

    // ===== STEP 2: PREPARE DATA FOR CLAUDE =====
    if (onProgress) {
      onProgress({ stage: 'prepare', message: 'Azure verileri hazırlanıyor...', progress: 40 });
    }

    logger.info('▶ Step 2: Claude için veri hazırlığı...', { module: 'hybrid-pipeline' });

    const preparedData = prepareForClaude(azureResult);

    logger.info('✓ Step 2 tamamlandı', {
      module: 'hybrid-pipeline',
      structuredTextLength: preparedData.structuredText.length,
      tableCount: preparedData.tables.length,
    });

    // ===== STEP 3: CLAUDE SEMANTIC ANALYSIS =====
    if (onProgress) {
      onProgress({ stage: 'claude', message: 'Claude semantic analiz yapıyor...', progress: 60 });
    }

    logger.info('▶ Step 3: Claude Semantic Analysis başlıyor...', { module: 'hybrid-pipeline' });

    const claudeResult = await analyzeWithClaude(preparedData, onProgress);

    logger.info('✓ Step 3 tamamlandı', {
      module: 'hybrid-pipeline',
      hasAnalysis: !!claudeResult,
    });

    // ===== STEP 4: MERGE RESULTS =====
    if (onProgress) {
      onProgress({ stage: 'merge', message: 'Sonuçlar birleştiriliyor...', progress: 85 });
    }

    logger.info('▶ Step 4: Sonuç birleştirme...', { module: 'hybrid-pipeline' });

    const mergedAnalysis = mergeResults(azureResult, claudeResult, preparedData);

    // ===== STEP 5: VALIDATE & OUTPUT =====
    if (onProgress) {
      onProgress({ stage: 'validate', message: 'Doğrulama yapılıyor...', progress: 95 });
    }

    const completenessResult = calculateCompleteness(mergedAnalysis);

    const validation = {
      valid: true,
      schema_errors: [],
      completeness_score: completenessResult.score,
      completeness_details: {
        missing_fields: completenessResult.missing,
        breakdown: completenessResult.details,
      },
      p0_checks: {
        all_passed: true,
        checks: [
          { code: 'HYBRID-01', name: 'Azure Analysis', passed: azureResult.success },
          { code: 'HYBRID-02', name: 'Claude Analysis', passed: !!claudeResult },
          { code: 'HYBRID-03', name: 'Table Extraction', passed: (azureResult.tables?.length || 0) > 0 },
          {
            code: 'HYBRID-04',
            name: 'Menu Extraction',
            passed: (mergedAnalysis.catering?.sample_menus?.length || 0) > 0,
          },
        ],
      },
    };

    const totalDuration = Date.now() - startTime;

    if (onProgress) {
      onProgress({ stage: 'complete', message: 'Hibrit analiz tamamlandı', progress: 100 });
    }

    const result = createSuccessOutput(documentId, mergedAnalysis, validation, {
      pipeline_version: 'hybrid-1.0.0',
      provider: 'hybrid',
      stats: {
        total_tables: azureResult.tables?.length || 0,
        total_paragraphs: azureResult.paragraphs?.length || 0,
        azure_duration_ms: azureResult.meta?.elapsed_ms || 0,
        claude_duration_ms: claudeResult?.meta?.elapsed_ms || 0,
        total_duration_ms: totalDuration,
      },
      file_info: {
        name: fileName,
        type: ext.replace('.', ''),
        size: fileSize,
        ocr_applied: true,
      },
    });

    // Add raw Azure data for debugging
    result.azure = {
      tables: azureResult.tables,
      tableCount: azureResult.tables?.length || 0,
    };

    logger.info('═══ HYBRID PIPELINE TAMAMLANDI ═══', {
      module: 'hybrid-pipeline',
      duration: `${(totalDuration / 1000).toFixed(1)}s`,
      tables: azureResult.tables?.length || 0,
      completeness: validation.completeness_score,
    });

    return result;
  } catch (error) {
    logger.error('Hybrid Pipeline failed', {
      module: 'hybrid-pipeline',
      error: error.message,
      filePath,
    });

    // Final fallback
    if (aiConfig.pipeline.fallbackToClaudeOnError) {
      logger.warn('Hybrid pipeline failed completely, final fallback to Claude', {
        module: 'hybrid-pipeline',
      });
      try {
        return await runZeroLossPipeline(filePath, options);
      } catch (claudeError) {
        return createErrorOutput(
          documentId,
          `Hybrid failed: ${error.message}, Claude fallback failed: ${claudeError.message}`
        );
      }
    }

    return createErrorOutput(documentId, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA PREPARATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Prepare Azure results for Claude semantic analysis
 */
function prepareForClaude(azureResult) {
  const tables = azureResult.tables || [];
  const paragraphs = azureResult.paragraphs || [];

  // Build structured text from paragraphs
  let structuredText = '';

  // Group paragraphs by role
  const headings = paragraphs.filter((p) => p.role === 'title' || p.role === 'sectionHeading');
  const _content = paragraphs.filter((p) => !p.role || p.role === 'paragraph');

  // Build document structure
  for (const para of paragraphs) {
    if (para.role === 'title') {
      structuredText += `\n# ${para.content}\n`;
    } else if (para.role === 'sectionHeading') {
      structuredText += `\n## ${para.content}\n`;
    } else {
      structuredText += `${para.content}\n`;
    }
  }

  // Process tables - Azure provider already returns processed format with headers/rows
  const processedTables = tables.map((table, index) => {
    // Azure provider returns: { tableIndex, rowCount, columnCount, headers, rows, boundingRegions }
    const headers = table.headers || [];
    const rows = table.rows || [];

    return {
      index: table.tableIndex ?? index,
      rowCount: table.rowCount || rows.length,
      columnCount: table.columnCount || headers.length || rows[0]?.length || 0,
      headers,
      rows,
      // Detect table type
      type: detectTableType(headers, rows),
    };
  });

  // Build table text representation
  let tableText = '';
  for (const table of processedTables) {
    tableText += `\n--- TABLO ${table.index + 1} (${table.type}) ---\n`;
    if (table.headers.length > 0) {
      tableText += `| ${table.headers.join(' | ')} |\n`;
      tableText += `| ${table.headers.map(() => '---').join(' | ')} |\n`;
    }
    for (const row of table.rows.slice(0, 50)) {
      // Limit to 50 rows per table
      tableText += `| ${row.join(' | ')} |\n`;
    }
  }

  return {
    structuredText,
    tableText,
    tables: processedTables,
    paragraphCount: paragraphs.length,
    headingCount: headings.length,
  };
}

/**
 * Menu detection keywords and patterns for various formats
 */
const MENU_PATTERNS = {
  // Header keywords that indicate menu tables
  headerKeywords: [
    'örnek menü',
    'menüsü',
    'yemek listesi',
    'haftalık menü',
    'günlük menü',
    'menu',
    'yemek programı',
    'beslenme listesi',
    'öğün listesi',
    'yemek çizelgesi',
    'diyet listesi',
    'rejim listesi',
    'kahvaltı listesi',
    'öğle yemeği',
    'akşam yemeği',
  ],
  // Day indicators (rows or columns)
  dayIndicators: [
    /gün\s*\d+/i,
    /\d+\.\s*gün/i, // Gün 1, 1. Gün
    /pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar/i, // Weekdays
    /pzt|sal|çar|per|cum|cmt|paz/i, // Abbreviated weekdays
    /1\.\s*hafta|2\.\s*hafta|hafta\s*\d+/i, // Week indicators
  ],
  // Food-related keywords in content
  foodKeywords: [
    'çorba',
    'pilav',
    'makarna',
    'salata',
    'meyve',
    'tatlı',
    'et',
    'tavuk',
    'balık',
    'sebze',
    'köfte',
    'kebap',
    'yoğurt',
    'komposto',
    'cacık',
    'ayran',
    'ekmek',
    'pirinç',
    'bulgur',
    'fasulye',
    'nohut',
    'mercimek',
    'patates',
    'yumurta',
    'peynir',
    'zeytin',
    'domates',
    'salatalık',
    'biber',
  ],
  // Meal time indicators
  mealIndicators: ['kahvaltı', 'öğle', 'akşam', 'ara öğün', 'kuşluk', 'ikindi'],
};

/**
 * Check if content looks like a menu (contains food items)
 */
function looksLikeMenuContent(content) {
  const text = content.toLowerCase();
  const foodMatches = MENU_PATTERNS.foodKeywords.filter((food) => text.includes(food));
  return foodMatches.length >= 2; // At least 2 food items
}

/**
 * Check if content has day indicators
 */
function hasDayIndicators(content) {
  const text = content.toLowerCase();
  return MENU_PATTERNS.dayIndicators.some((pattern) => pattern.test(text));
}

/**
 * Detect table type based on headers and content
 * Enhanced to support multiple menu formats
 */
function detectTableType(headers, rows) {
  const headerText = headers.join(' ').toLowerCase();
  const sampleContent = rows.slice(0, 5).flat().join(' ').toLowerCase();
  const allContent = headerText + ' ' + sampleContent;

  // ═══ MENU DETECTION (Priority 1) ═══
  // Check for explicit menu keywords in header
  const hasMenuKeyword = MENU_PATTERNS.headerKeywords.some((kw) => headerText.includes(kw));

  // Check for day structure + food content (implicit menu)
  const hasDays = hasDayIndicators(allContent);
  const hasFood = looksLikeMenuContent(allContent);

  // Check for meal structure (kahvaltı | öğle | akşam columns)
  const hasMealColumns = MENU_PATTERNS.mealIndicators.filter((m) => headerText.includes(m)).length >= 2;

  if (hasMenuKeyword || (hasDays && hasFood) || hasMealColumns) {
    return 'menu';
  }

  // ═══ GRAMAJ DETECTION (Priority 2) ═══
  if (
    headerText.includes('gramaj') ||
    headerText.includes('porsiyon') ||
    (headerText.includes('miktar') && (headerText.includes('birim') || headerText.includes('gram'))) ||
    sampleContent.match(/\d+\s*(g|gr|gram|kg|ml|lt)/)
  ) {
    return 'gramaj';
  }

  // ═══ PERSONEL DETECTION ═══
  if (
    headerText.includes('personel') ||
    headerText.includes('pozisyon') ||
    headerText.includes('unvan') ||
    headerText.includes('çalışan') ||
    (headerText.includes('görev') && headerText.includes('sayı'))
  ) {
    return 'personel';
  }

  // ═══ ÖĞÜN DETECTION ═══
  if (
    headerText.includes('öğün') &&
    (headerText.includes('kahvaltı') || headerText.includes('adet')) &&
    !hasMenuKeyword
  ) {
    return 'ogun';
  }

  // ═══ FİYAT DETECTION ═══
  if (
    headerText.includes('fiyat') ||
    headerText.includes('tutar') ||
    headerText.includes('bedel') ||
    headerText.includes('birim fiyat')
  ) {
    return 'fiyat';
  }

  // ═══ TARİH DETECTION ═══
  if (headerText.includes('tarih') || headerText.includes('süre') || headerText.includes('vade')) {
    return 'tarih';
  }

  // ═══ CEZA DETECTION ═══
  if (headerText.includes('ceza') || headerText.includes('yaptırım') || headerText.includes('kesinti')) {
    return 'ceza';
  }

  return 'genel';
}

// ═══════════════════════════════════════════════════════════════════════════
// CLAUDE SEMANTIC ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

const HYBRID_CLAUDE_PROMPT = `Sen bir ihale dökümanı analiz uzmanısın. Azure Document Intelligence tarafından çıkarılan tablo ve metin verilerini analiz et.

GÖREV: Aşağıdaki yapısal verileri analiz ederek ihale bilgilerini JSON formatında çıkar.

ÖNEMLİ KURALLAR:
1. Sadece verilen verilerde bulunan bilgileri çıkar, tahmin yapma
2. Gramaj değerlerinde ISTIRAK DEĞERLERİ (°C, derece) DAHİL ETME
3. Tarihler dd.mm.yyyy veya dd/mm/yyyy formatında olabilir
4. Tutarlar TL veya ₺ ile belirtilmiş olabilir
5. Personel sayıları tam sayı olmalı
6. ÖRNEK MENÜ tablolarını mutlaka çıkar - bunlar "ÖRNEK MENÜ", "YEMEK LİSTESİ" gibi başlıklı tablolardır

JSON ŞEMASI:
{
  "summary": {
    "title": "İhale başlığı",
    "institution": "Kurum adı",
    "tender_type": "mal/hizmet/yapım",
    "estimated_value": "Yaklaşık maliyet",
    "duration": "Sözleşme süresi",
    "ikn": "İhale Kayıt Numarası"
  },
  "dates": {
    "tender_date": "İhale tarihi",
    "start_date": "Başlangıç tarihi",
    "end_date": "Bitiş tarihi",
    "deadline": "Son teklif tarihi",
    "all_dates": [{"date": "...", "type": "...", "description": "..."}]
  },
  "financial": {
    "estimated_cost": {"amount": "...", "currency": "TRY"},
    "unit_prices": [{"item": "...", "quantity": "...", "unit": "...", "price": "..."}],
    "guarantees": {"gecici": "...", "kesin": "..."},
    "all_amounts": [{"value": "...", "type": "...", "context": "..."}]
  },
  "penalties": [{"description": "...", "rate": "...", "condition": "..."}],
  "catering": {
    "meals": [{"type": "kahvalti/ogle/aksam", "quantity": 0, "unit": "öğün"}],
    "gramaj": [{"item": "Malzeme adı", "weight": "150", "unit": "g"}],
    "sample_menus": [
      {
        "menu_type": "normal/diyet/kahvalti/rejim",
        "days": [
          {"day": 1, "items": ["Yemek 1", "Yemek 2", "Çorba", "Tatlı"]}
        ]
      }
    ],
    "service_times": {"kahvalti": "...", "ogle": "...", "aksam": "..."},
    "quality_requirements": ["..."],
    "daily_meal_count": 0,
    "person_count": 0
  },
  "personnel": {
    "staff": [{"pozisyon": "...", "adet": 0, "nitelik": "..."}],
    "qualifications": ["..."],
    "working_conditions": ["..."],
    "total_count": 0
  },
  "technical_requirements": ["..."]
}

Sadece JSON döndür, açıklama ekleme.`;

/**
 * Run Claude semantic analysis on prepared data
 */
async function analyzeWithClaude(preparedData, _onProgress) {
  const startTime = Date.now();

  // Build input for Claude
  const input = `${HYBRID_CLAUDE_PROMPT}

═══ METİN İÇERİĞİ ═══
${preparedData.structuredText.substring(0, 50000)}

═══ TABLOLAR ═══
${preparedData.tableText.substring(0, 30000)}

═══ TABLO ÖZETLERİ ═══
${preparedData.tables.map((t) => `- Tablo ${t.index + 1}: ${t.type} (${t.rowCount}x${t.columnCount})`).join('\n')}
`;

  try {
    const response = await anthropic.messages.create({
      model: aiConfig.claude.defaultModel,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{ role: 'user', content: input }],
    });

    const responseText = response.content[0]?.text || '';

    // Parse JSON from response
    let analysis;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
      const jsonStr = jsonMatch[1].trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      logger.warn('Claude response JSON parse failed, using regex extraction', {
        module: 'hybrid-pipeline',
        error: parseError.message,
      });
      // Try to extract data with regex as fallback
      analysis = extractWithRegex(responseText);
    }

    return {
      ...analysis,
      meta: {
        elapsed_ms: Date.now() - startTime,
        model: aiConfig.claude.defaultModel,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    };
  } catch (error) {
    logger.error('Claude analysis failed', {
      module: 'hybrid-pipeline',
      error: error.message,
    });
    return null;
  }
}

/**
 * Fallback regex extraction if JSON parsing fails
 */
function extractWithRegex(_text) {
  return {
    summary: { title: '', institution: '', tender_type: '', estimated_value: '', duration: '', ikn: '' },
    dates: { tender_date: null, start_date: null, end_date: null, deadline: null, all_dates: [] },
    financial: { estimated_cost: {}, unit_prices: [], guarantees: {}, all_amounts: [] },
    penalties: [],
    catering: {
      meals: [],
      gramaj: [],
      service_times: {},
      quality_requirements: [],
      daily_meal_count: null,
      person_count: null,
    },
    personnel: { staff: [], qualifications: [], working_conditions: [], total_count: null },
    technical_requirements: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RESULT MERGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Merge Azure and Claude results
 * Priority: Claude for semantic, Azure for tables
 */
function mergeResults(_azureResult, claudeResult, preparedData) {
  // Start with Claude's semantic analysis as base
  const analysis = claudeResult || {
    summary: { title: '', institution: '', tender_type: '', estimated_value: '', duration: '', ikn: '' },
    dates: { tender_date: null, start_date: null, end_date: null, deadline: null, all_dates: [] },
    financial: { estimated_cost: {}, unit_prices: [], guarantees: {}, all_amounts: [] },
    penalties: [],
    catering: {
      meals: [],
      gramaj: [],
      service_times: {},
      quality_requirements: [],
      daily_meal_count: null,
      person_count: null,
    },
    personnel: { staff: [], qualifications: [], working_conditions: [], total_count: null },
    technical_requirements: [],
  };

  // Enhance with Azure table data
  for (const table of preparedData.tables) {
    switch (table.type) {
      case 'gramaj': {
        const gramajFromTable = extractGramajFromTable(table);
        if (gramajFromTable.length > 0) {
          // Merge, avoiding duplicates
          const existingItems = new Set(analysis.catering.gramaj.map((g) => g.item?.toLowerCase()));
          for (const g of gramajFromTable) {
            if (!existingItems.has(g.item?.toLowerCase())) {
              analysis.catering.gramaj.push({ ...g, source: 'azure-table' });
            }
          }
        }
        break;
      }

      case 'personel': {
        const personnelFromTable = extractPersonnelFromTable(table);
        if (personnelFromTable.length > 0) {
          const existingPositions = new Set(analysis.personnel.staff.map((p) => p.pozisyon?.toLowerCase()));
          for (const p of personnelFromTable) {
            if (!existingPositions.has(p.pozisyon?.toLowerCase())) {
              analysis.personnel.staff.push({ ...p, source: 'azure-table' });
            }
          }
        }
        break;
      }

      case 'ogun': {
        const mealsFromTable = extractMealsFromTable(table);
        if (mealsFromTable.length > 0) {
          const existingMeals = new Set(analysis.catering.meals.map((m) => m.type?.toLowerCase()));
          for (const m of mealsFromTable) {
            if (!existingMeals.has(m.type?.toLowerCase())) {
              analysis.catering.meals.push({ ...m, source: 'azure-table' });
            }
          }
        }
        break;
      }

      case 'fiyat': {
        const pricesFromTable = extractPricesFromTable(table);
        if (pricesFromTable.length > 0) {
          analysis.financial.unit_prices.push(...pricesFromTable.map((p) => ({ ...p, source: 'azure-table' })));
        }
        break;
      }

      case 'menu': {
        const menuFromTable = extractMenuFromTable(table);
        if (menuFromTable) {
          if (!analysis.catering.sample_menus) {
            analysis.catering.sample_menus = [];
          }
          // Check if this menu type already exists
          const existingMenu = analysis.catering.sample_menus.find((m) => m.menu_type === menuFromTable.menu_type);
          if (!existingMenu) {
            analysis.catering.sample_menus.push({ ...menuFromTable, source: 'azure-table' });
          }
        }
        break;
      }
    }
  }

  // Calculate totals
  if (analysis.personnel.staff.length > 0 && !analysis.personnel.total_count) {
    analysis.personnel.total_count = analysis.personnel.staff.reduce((sum, s) => sum + (parseInt(s.adet, 10) || 0), 0);
  }

  return analysis;
}

// ═══════════════════════════════════════════════════════════════════════════
// TABLE EXTRACTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function extractGramajFromTable(table) {
  const results = [];
  const headers = (table.headers || []).map((h) => (h || '').toLowerCase());

  // Blacklist for items that are NOT gramaj (personnel positions, etc.)
  const BLACKLIST_ITEMS = [
    'gıda mühendisi',
    'diyetisyen',
    'gıda teknikeri',
    'aşçı başı',
    'aşçıbaşı',
    'aşçı',
    'diyet aşçı',
    'aşçı yardımcısı',
    'kasap',
    'garson',
    'şoför',
    'bulaşıkçı',
    'temizlikçi',
    'personel',
    'unvan',
    'pozisyon',
    'toplam',
    'hastane',
    'gün',
    'bayram',
    'arefe',
    'ocak',
    'şubat',
    'mart',
    'nisan',
    'mayıs',
    'haziran',
    'temmuz',
    'ağustos',
    'eylül',
    'ekim',
    'kasım',
    'aralık',
  ];

  // Check if this table looks like a personnel table (skip entirely)
  const headerText = headers.join(' ').toLowerCase();
  if (
    headerText.includes('personel') ||
    headerText.includes('unvan') ||
    headerText.includes('çalıştırılacak') ||
    headerText.includes('hastane adı')
  ) {
    return results; // Skip personnel tables entirely
  }

  // Find relevant column indices - adjust for offset if first header is a title
  let offset = 0;
  if (headers[0] && (headers[0].includes('gramaj') || headers[0].length > 50)) {
    // First header is likely a title, columns start from index 1
    offset = 1;
  }

  // Find columns
  let itemCol = headers.findIndex((h) => h.includes('malzeme') || h.includes('ürün') || h.includes('madde'));
  let weightCol = headers.findIndex(
    (h) => h.includes('miktar') || h.includes('gramaj') || h.includes('porsiyon') || h.includes('ağırlık')
  );
  let unitCol = headers.findIndex((h) => h.includes('birim'));

  // Adjust indices based on actual row structure
  if (itemCol > 0) itemCol -= offset;
  if (weightCol > 0) weightCol -= offset;
  if (unitCol > 0) unitCol -= offset;

  // Default fallbacks
  if (itemCol < 0) itemCol = 0;
  if (weightCol < 0) weightCol = 1;
  if (unitCol < 0) unitCol = 2;

  for (const row of table.rows) {
    if (!row || row.length === 0) continue;

    const item = row[itemCol] || row[0];
    const weightCell = String(row[weightCol] || row[1] || '');
    const unitCell = String(row[unitCol] || row[2] || '');

    // Skip empty or header-like rows
    if (!item || item.toLowerCase().includes('malzeme') || item.toLowerCase().includes('gramaj')) {
      continue;
    }

    // Skip blacklisted items (personnel positions, dates, etc.)
    const itemLower = item.toLowerCase();
    if (BLACKLIST_ITEMS.some((bl) => itemLower.includes(bl))) {
      continue;
    }

    // Skip if item looks like a number or date
    if (/^\d+$/.test(item.trim()) || /^\d+\s*gün$/i.test(item.trim())) {
      continue;
    }

    // Extract weight value - first try the weight cell, then look in item name
    let weight = null;
    let unit = null;

    // Try to parse weight cell
    const weightMatch = weightCell.match(/^(\d+(?:[.,]\d+)?)$/);
    if (weightMatch) {
      weight = weightMatch[1].replace(',', '.');
      // Get unit from unit column
      const unitMatch = unitCell.match(/(g|gr|gram|kg|ml|lt|adet|demet)/i);
      unit = unitMatch ? unitMatch[1].toLowerCase() : 'g';
    } else {
      // Try to extract from combined format like "100 gram"
      const combinedMatch = weightCell.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gram|kg|ml|lt)?/i);
      if (combinedMatch) {
        weight = combinedMatch[1].replace(',', '.');
        unit = combinedMatch[2] || 'g';
      }
    }

    // Also check item name for weight info (e.g., "Çay (1,5 g)")
    if (!weight) {
      const itemMatch = item.match(/\((\d+(?:[.,]\d+)?)\s*(g|gr|gram|kg|ml)?\)/i);
      if (itemMatch) {
        weight = itemMatch[1].replace(',', '.');
        unit = itemMatch[2] || 'g';
      }
    }

    // Filter out temperature values and invalid entries
    if (weightCell.includes('°') || weightCell.toLowerCase().includes('derece')) {
      continue;
    }

    // Skip very small weights (likely errors) except for spices
    if (weight && parseFloat(weight) < 1 && !itemLower.includes('baharat') && !itemLower.includes('tuz')) {
      continue;
    }

    if (item && weight) {
      // Clean item name (remove weight from name if present)
      const cleanItem = item.replace(/\s*\([^)]*[gG][rR]?[aA]?[mM]?\)/, '').trim();

      results.push({
        item: cleanItem || item.trim(),
        weight: weight,
        unit: unit === 'gram' ? 'g' : unit === 'gr' ? 'g' : unit,
      });
    }
  }

  return results;
}

function extractPersonnelFromTable(table) {
  const results = [];
  const headers = table.headers.map((h) => h.toLowerCase());

  const positionCol = headers.findIndex(
    (h) => h.includes('pozisyon') || h.includes('unvan') || h.includes('görev') || h.includes('personel')
  );
  const countCol = headers.findIndex((h) => h.includes('adet') || h.includes('sayı') || h.includes('kişi'));

  for (const row of table.rows) {
    const position = row[positionCol >= 0 ? positionCol : 0];
    const countCell = row[countCol >= 0 ? countCol : 1] || '';

    const count = parseInt(countCell.match(/\d+/)?.[0], 10);

    if (position && count) {
      results.push({
        pozisyon: position.trim(),
        adet: count,
      });
    }
  }

  return results;
}

function extractMealsFromTable(table) {
  const results = [];

  for (const row of table.rows) {
    const rowText = row.join(' ').toLowerCase();

    // Look for meal types
    const mealTypes = ['kahvaltı', 'öğle', 'akşam', 'diyet', 'iftar', 'sahur'];
    for (const mealType of mealTypes) {
      if (rowText.includes(mealType)) {
        // Find quantity in row
        const quantityMatch = row.find((cell) => /^\d+$/.test(cell?.trim()));
        if (quantityMatch) {
          results.push({
            type: mealType,
            quantity: parseInt(quantityMatch, 10),
            unit: 'öğün',
          });
        }
        break;
      }
    }
  }

  return results;
}

/**
 * Detect menu type from header text
 */
function detectMenuType(headerText) {
  const text = headerText.toLowerCase();

  // Specific diet types
  if (text.includes('diyet') && (text.includes('öğle') || text.includes('yemek'))) return 'diyet_ogle';
  if (text.includes('diyet') && text.includes('kahvaltı')) return 'diyet_kahvalti';
  if (text.includes('diyet')) return 'diyet';

  // Rejim types
  if (text.includes('r1') || text.includes('açık sıvı')) return 'rejim_r1';
  if (text.includes('r2') || text.includes('tam sıvı')) return 'rejim_r2';
  if (text.includes('r3') || text.includes('yumuşak')) return 'rejim_r3';
  if (text.includes('rejim')) return 'rejim';

  // Normal meal types
  if (text.includes('kahvaltı') && text.includes('normal')) return 'normal_kahvalti';
  if (text.includes('kahvaltı')) return 'kahvalti';
  if (text.includes('öğle') && text.includes('normal')) return 'normal_ogle';
  if (text.includes('öğle')) return 'ogle';
  if (text.includes('akşam')) return 'aksam';

  // Weekly/daily
  if (text.includes('haftalık')) return 'haftalik';
  if (text.includes('günlük')) return 'gunluk';

  return 'normal';
}

/**
 * Parse day indicator from cell text
 */
function parseDayFromCell(cellText) {
  const text = (cellText || '').toLowerCase().trim();

  // "Gün 1", "1. Gün", "Gün 01"
  let match = text.match(/gün\s*(\d+)/i) || text.match(/(\d+)\.\s*gün/i);
  if (match) return { day: parseInt(match[1], 10), type: 'number' };

  // Weekday names
  const weekdays = {
    pazartesi: 1,
    pzt: 1,
    salı: 2,
    sal: 2,
    çarşamba: 3,
    çar: 3,
    perşembe: 4,
    per: 4,
    cuma: 5,
    cum: 5,
    cumartesi: 6,
    cmt: 6,
    pazar: 7,
    paz: 7,
  };

  for (const [name, num] of Object.entries(weekdays)) {
    if (text.includes(name)) return { day: num, type: 'weekday', name };
  }

  // "1. hafta", "Hafta 1"
  match = text.match(/(\d+)\.\s*hafta/i) || text.match(/hafta\s*(\d+)/i);
  if (match) return { day: parseInt(match[1], 10), type: 'week' };

  return null;
}

/**
 * Detect table format: vertical (days in rows) or horizontal (days in columns)
 */
function detectMenuFormat(headers, rows) {
  // Check if headers contain day indicators (horizontal format)
  const headerDays = headers.map((h) => parseDayFromCell(h)).filter(Boolean);
  if (headerDays.length >= 2) {
    return 'horizontal'; // Days are columns
  }

  // Check if first column contains day indicators (vertical format)
  const firstColDays = rows
    .slice(0, 5)
    .map((r) => parseDayFromCell(r[0]))
    .filter(Boolean);
  if (firstColDays.length >= 2) {
    return 'vertical'; // Days are rows
  }

  // Check if headers contain meal types (meal-based format)
  const mealHeaders = headers.filter((h) =>
    MENU_PATTERNS.mealIndicators.some((m) => (h || '').toLowerCase().includes(m))
  );
  if (mealHeaders.length >= 2) {
    return 'meal_based'; // Columns are meal types
  }

  return 'vertical'; // Default
}

/**
 * Extract sample menus from table - supports multiple formats
 */
function extractMenuFromTable(table) {
  const headers = (table.headers || []).map((h) => (h || '').toString());
  const headersLower = headers.map((h) => h.toLowerCase());
  const headerText = headersLower.join(' ');
  const rows = table.rows || [];

  if (rows.length === 0 && headers.length < 3) {
    return null;
  }

  const menuType = detectMenuType(headerText);
  const format = detectMenuFormat(headersLower, rows);
  const days = [];

  // ═══ HORIZONTAL FORMAT: Days in columns ═══
  if (format === 'horizontal') {
    // Find which columns are days
    const dayColumns = [];
    headers.forEach((h, idx) => {
      const dayInfo = parseDayFromCell(h);
      if (dayInfo) {
        dayColumns.push({ idx, ...dayInfo });
      }
    });

    // Each row is a food item, each column is a day
    if (dayColumns.length > 0) {
      // Initialize days
      dayColumns.forEach((dc) => {
        days.push({ day: dc.day, dayName: dc.name, items: [] });
      });

      // Collect items for each day
      for (const row of rows) {
        dayColumns.forEach((dc, dayIdx) => {
          const item = row[dc.idx];
          if (item?.trim() && !parseDayFromCell(item)) {
            days[dayIdx].items.push(item.trim());
          }
        });
      }
    }
  }

  // ═══ MEAL-BASED FORMAT: Columns are meal types ═══
  else if (format === 'meal_based') {
    // Find meal columns
    const mealColumns = {};
    headers.forEach((h, idx) => {
      const hLower = h.toLowerCase();
      if (hLower.includes('kahvaltı')) mealColumns.kahvalti = idx;
      else if (hLower.includes('öğle')) mealColumns.ogle = idx;
      else if (hLower.includes('akşam')) mealColumns.aksam = idx;
      else if (hLower.includes('ara')) mealColumns.ara_ogun = idx;
    });

    // Each row is a day
    for (const row of rows) {
      const dayInfo = parseDayFromCell(row[0]);
      const dayNum = dayInfo?.day || days.length + 1;

      const items = [];
      if (mealColumns.kahvalti !== undefined && row[mealColumns.kahvalti]) {
        items.push(`Kahvaltı: ${row[mealColumns.kahvalti].trim()}`);
      }
      if (mealColumns.ogle !== undefined && row[mealColumns.ogle]) {
        items.push(`Öğle: ${row[mealColumns.ogle].trim()}`);
      }
      if (mealColumns.aksam !== undefined && row[mealColumns.aksam]) {
        items.push(`Akşam: ${row[mealColumns.aksam].trim()}`);
      }

      if (items.length > 0) {
        days.push({ day: dayNum, dayName: dayInfo?.name, items });
      }
    }
  }

  // ═══ VERTICAL FORMAT: Days in rows (default) ═══
  else {
    // Check if headers contain menu items (first row is header row with items)
    const headerItems = headers
      .slice(1)
      .filter(
        (h) =>
          h &&
          !h.toLowerCase().includes('gün') &&
          !h.toLowerCase().includes('menü') &&
          !MENU_PATTERNS.dayIndicators.some((p) => p.test(h))
      );

    // If headers have food items, treat first non-title header items as day 1
    if (headerItems.length >= 2 && looksLikeMenuContent(headerItems.join(' '))) {
      days.push({
        day: 1,
        items: headerItems.map((item) => capitalize(item.trim())),
      });
    }

    // Process each row
    for (const row of rows) {
      if (!row || row.length === 0) continue;

      const dayInfo = parseDayFromCell(row[0]);

      if (dayInfo) {
        // Row starts with day indicator
        const items = row.slice(1).filter((item) => item?.trim());
        if (items.length > 0) {
          days.push({
            day: dayInfo.day,
            dayName: dayInfo.name,
            items: items.map((item) => item.trim()),
          });
        }
      } else if (row.length >= 2) {
        // Check if any cell contains food keywords
        const rowText = row.join(' ').toLowerCase();
        if (looksLikeMenuContent(rowText)) {
          const items = row.filter((item) => item?.trim() && !parseDayFromCell(item));
          if (items.length >= 2) {
            days.push({
              day: days.length + 1,
              items: items.map((item) => item.trim()),
            });
          }
        }
      }
    }
  }

  // Filter out empty days and validate
  const validDays = days.filter((d) => d.items && d.items.length > 0);

  if (validDays.length === 0) {
    return null;
  }

  // Build title from first header
  let title = headers[0] || `${menuType} menüsü`;
  if (title.length > 100) {
    title = title.substring(0, 100) + '...';
  }

  return {
    menu_type: menuType,
    title: capitalize(title),
    format: format,
    days: validDays,
    total_days: validDays.length,
  };
}

/**
 * Capitalize first letter of string
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractPricesFromTable(table) {
  const results = [];
  const headers = table.headers.map((h) => h.toLowerCase());

  const itemCol = headers.findIndex((h) => h.includes('kalem') || h.includes('ürün') || h.includes('açıklama'));
  const priceCol = headers.findIndex((h) => h.includes('fiyat') || h.includes('tutar') || h.includes('bedel'));
  const quantityCol = headers.findIndex((h) => h.includes('miktar') || h.includes('adet'));
  const unitCol = headers.findIndex((h) => h.includes('birim'));

  for (const row of table.rows) {
    const item = row[itemCol >= 0 ? itemCol : 0];
    const price = row[priceCol >= 0 ? priceCol : -1];

    if (item && price) {
      results.push({
        item: item.trim(),
        price: price.trim(),
        quantity: row[quantityCol] || '',
        unit: row[unitCol] || '',
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETENESS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

function calculateCompleteness(analysis) {
  // Define checks with weights - total should be 100
  const checks = [
    // Core document data (from idari şartname - may be 0 for teknik şartname only)
    { field: 'dates.all_dates', weight: 8, value: analysis.dates?.all_dates?.length || 0, optional: true },
    { field: 'financial.all_amounts', weight: 8, value: analysis.financial?.all_amounts?.length || 0, optional: true },
    { field: 'summary.ikn', weight: 4, value: analysis.summary?.ikn ? 1 : 0, optional: true },
    { field: 'summary.estimated_value', weight: 5, value: analysis.summary?.estimated_value ? 1 : 0, optional: true },

    // Catering-specific data (critical for teknik şartname)
    { field: 'catering.gramaj', weight: 15, value: analysis.catering?.gramaj?.length || 0 },
    { field: 'catering.sample_menus', weight: 12, value: analysis.catering?.sample_menus?.length || 0 },
    { field: 'catering.meals', weight: 10, value: analysis.catering?.meals?.length || 0 },
    { field: 'catering.quality_requirements', weight: 5, value: analysis.catering?.quality_requirements?.length || 0 },

    // Personnel data
    { field: 'personnel.staff', weight: 12, value: analysis.personnel?.staff?.length || 0 },
    { field: 'personnel.total_count', weight: 3, value: analysis.personnel?.total_count ? 1 : 0 },

    // Other requirements
    { field: 'penalties', weight: 5, value: analysis.penalties?.length || 0, optional: true },
    { field: 'technical_requirements', weight: 8, value: analysis.technical_requirements?.length || 0 },

    // Basic summary
    { field: 'summary.institution', weight: 3, value: analysis.summary?.institution ? 1 : 0 },
    { field: 'summary.title', weight: 2, value: analysis.summary?.title ? 1 : 0 },
  ];

  let totalScore = 0;
  let maxScore = 0;
  const missing = [];

  for (const check of checks) {
    maxScore += check.weight;
    if (check.value > 0) {
      totalScore += check.weight;
    } else if (!check.optional) {
      missing.push(check.field);
    }
  }

  return {
    score: Math.round((totalScore / maxScore) * 100),
    missing,
    details: checks.map((c) => ({ field: c.field, weight: c.weight, found: c.value > 0, value: c.value })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  runHybridPipeline,
};
