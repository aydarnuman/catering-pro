/**
 * Layer 3: Two-Stage Analyzer - 2 Aşamalı Analiz
 *
 * Zero-Loss Pipeline için micro-extraction desteği.
 *
 * Modlar:
 * - 'full': Mevcut davranış (tek büyük prompt)
 * - 'micro': Alan bazlı küçük prompt'lar (dates, amounts, penalties, menu, personnel)
 *
 * Aşama 1: Her chunk → Haiku (hızlı özet + anahtar veriler)
 * Aşama 2: Tüm özetler → Sonnet (birleştirme + final analiz)
 */

import Anthropic from '@anthropic-ai/sdk';
import { aiConfig } from '../../../config/ai.config.js';
import logger from '../../../utils/logger.js';
import { createTextHash, ensureValidJson } from '../controls/p0-checks.js';
import { getPrompt } from '../prompts/index.js';
import { createFinding } from '../schemas/chunk-output.js';
import { safeJsonParse } from '../utils/parser.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Chunk analiz sonucu
 * @typedef {Object} ChunkAnalysis
 * @property {number} chunkIndex
 * @property {string} summary - Kısa özet
 * @property {Object} extractedData - Çıkarılan yapısal veriler
 */

/**
 * Final analiz sonucu
 * @typedef {Object} FinalAnalysis
 * @property {string} ozet - Genel özet
 * @property {Array} teknik_sartlar - Teknik şartlar
 * @property {Array} birim_fiyatlar - Birim fiyatlar
 * @property {Array} takvim - Tarihler ve süreler
 * @property {Array} notlar - Önemli notlar
 * @property {Object} meta - Analiz metadata
 */

// Geliştirilmiş promptları import et
import { ENHANCED_STAGE1_PROMPT, ENHANCED_STAGE2_PROMPT } from '../prompts/catering-terminology.js';

// Aşama 1 promptu - chunk özeti (GELİŞTİRİLMİŞ)
const STAGE1_PROMPT = ENHANCED_STAGE1_PROMPT;

// Aşama 2 promptu - birleştirme (GELİŞTİRİLMİŞ)
const STAGE2_PROMPT = ENHANCED_STAGE2_PROMPT;

/**
 * Tek bir chunk'ı analiz et (Aşama 1 - Haiku)
 * @param {Object} chunk - Chunk objesi
 * @param {string} extractionType - Extraction türü ('full', 'dates', 'amounts', vb.)
 * @returns {Promise<ChunkAnalysis>}
 */
async function analyzeChunk(chunk, extractionType = 'full') {
  const startTime = Date.now();
  const chunkId = `chunk_${chunk.index}`;

  try {
    // Prompt seç
    const prompt = extractionType === 'full' ? STAGE1_PROMPT : getPrompt(extractionType);

    const response = await anthropic.messages.create({
      model: aiConfig.claude.fastModel, // v9.1: Opus 4.6 (eski: Haiku)
      max_tokens: aiConfig.claude.maxTokens || 8192,
      messages: [
        {
          role: 'user',
          content: prompt + chunk.content,
        },
      ],
    });

    const responseText = response.content[0]?.text || '{}';

    // 1. Önce safeJsonParse ile temizle (aralıkları düzeltir: 55-60 -> "55-60", markdown temizler)
    let parsed = safeJsonParse(responseText);
    let isValid = !!parsed;

    // 2. Eğer safe parse başarısızsa, P0-06 kontrolü ile tekrar dene (fallback)
    if (!isValid) {
      const jsonCheck = ensureValidJson(responseText, chunkId);
      if (jsonCheck.passed) {
        parsed = jsonCheck.details.parsed;
        isValid = true;
      } else {
        logger.warn('Chunk analysis JSON parse failed (P0-06)', {
          chunkIndex: chunk.index,
          extractionType,
          rawOutput: responseText.slice(0, 200),
        });
        parsed = { ozet: responseText.slice(0, 200), parse_error: true };
      }
    }

    const duration = Date.now() - startTime;

    return {
      chunk_id: chunkId,
      chunkIndex: chunk.index,
      chunkType: chunk.type,
      extractionType,
      context: chunk.context,
      summary: parsed.ozet || '',
      extractedData: parsed,
      findings: extractFindingsFromParsed(parsed, extractionType, chunkId),
      duration,
      tokens: {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0,
      },
      raw_text_hash: chunk.contentHash || createTextHash(chunk.content),
      json_valid: isValid,
    };
  } catch (error) {
    logger.error('Chunk analysis failed', {
      chunkIndex: chunk.index,
      extractionType,
      error: error.message,
    });
    return {
      chunk_id: chunkId,
      chunkIndex: chunk.index,
      extractionType,
      error: error.message,
      extractedData: {},
      findings: [],
    };
  }
}

/**
 * Parse edilmiş veriden findings listesi oluştur
 * @param {Object} parsed - Parse edilmiş JSON
 * @param {string} extractionType - Extraction türü
 * @param {string} chunkId - Chunk ID
 * @returns {Array} Findings listesi
 */
function extractFindingsFromParsed(parsed, extractionType, _chunkId) {
  const findings = [];

  if (!parsed || parsed.parse_error) return findings;

  // Extraction türüne göre findings oluştur
  switch (extractionType) {
    case 'dates':
      if (parsed.dates) {
        for (const date of parsed.dates) {
          findings.push(
            createFinding({
              value: date.value,
              type: date.type,
              context: date.context,
              confidence: date.confidence || 1.0,
              sourcePosition: date.source_position,
              rawText: date.raw_text,
            })
          );
        }
      }
      break;

    case 'amounts':
      if (parsed.amounts) {
        for (const amount of parsed.amounts) {
          findings.push(
            createFinding({
              value: amount.value,
              type: amount.type,
              context: amount.context,
              confidence: amount.confidence || 1.0,
              sourcePosition: amount.source_position,
            })
          );
        }
      }
      break;

    case 'penalties':
      if (parsed.penalties) {
        for (const penalty of parsed.penalties) {
          findings.push(
            createFinding({
              value: penalty.rate || penalty.description,
              type: penalty.type,
              context: penalty.context,
              confidence: penalty.confidence || 1.0,
              sourcePosition: penalty.source_position,
              relatedArticle: penalty.related_article,
            })
          );
        }
      }
      break;

    case 'menu':
      // Öğünler
      if (parsed.meals) {
        for (const meal of parsed.meals) {
          findings.push(
            createFinding({
              value: meal.daily_count || meal.person_count,
              type: `meal_${meal.type}`,
              context: meal.context,
              confidence: meal.confidence || 1.0,
            })
          );
        }
      }
      // Gramajlar - ISI VE OPERASYONEL FİLTRELEME
      if (parsed.gramaj) {
        for (const g of parsed.gramaj) {
          // --- FİLTRELEME BAŞLANGICI ---
          const unit = (g.unit || '').toLowerCase();
          const item = (g.item || '').toLowerCase();
          const context = (g.context || '').toLowerCase();
          const weightStr = String(g.weight || '').toLowerCase();

          // 1. Isı değerlerini filtrele (°C, derece, sıcaklık)
          if (
            unit.includes('°') ||
            unit.includes('derece') ||
            unit.includes('c') ||
            unit.includes('celsius') ||
            weightStr.includes('°') ||
            context.includes('sıcaklık') ||
            context.includes('servis sıcaklığı')
          ) {
            logger.debug('Gramaj filtrelendi: Isı değeri', { item: g.item, weight: g.weight, unit: g.unit });
            continue; // Isı değeri, atla
          }

          // 2. Operasyonel detayları filtrele
          if (
            item.includes('bulaşık') ||
            item.includes('servis') ||
            item.includes('personel') ||
            item.includes('araç') ||
            item.includes('araba') ||
            item.includes('tabak') ||
            item.includes('bardak')
          ) {
            logger.debug('Gramaj filtrelendi: Operasyonel detay', { item: g.item });
            continue; // Operasyonel detay, atla
          }

          // 3. Mantıksız gramaj değerlerini filtrele (çok düşük veya çok yüksek)
          const numericWeight = Number.parseFloat(String(g.weight).replace(/[^\d.]/g, ''));
          if (!Number.isNaN(numericWeight) && (numericWeight < 1 || numericWeight > 10000)) {
            logger.debug('Gramaj filtrelendi: Mantıksız değer', { item: g.item, weight: g.weight });
            continue; // Muhtemelen yanlış parse
          }
          // --- FİLTRELEME BİTİŞİ ---

          findings.push(
            createFinding({
              value: `${g.weight} ${g.unit}`,
              type: `gramaj_${g.item}`,
              context: g.context,
              confidence: g.confidence || 1.0,
              sourcePosition: g.source_position,
            })
          );
        }
      }
      break;

    case 'personnel':
      if (parsed.personnel) {
        for (const p of parsed.personnel) {
          findings.push(
            createFinding({
              value: p.count || p.min_count,
              type: `personnel_${p.position}`,
              context: p.context,
              confidence: p.confidence || 1.0,
              sourcePosition: p.source_position,
            })
          );
        }
      }
      break;

    default:
      // Full extraction için tüm alanları kontrol et
      if (parsed.tarihler) {
        for (const date of parsed.tarihler) {
          findings.push(
            createFinding({
              value: date.tarih,
              type: `date_${date.olay || 'unknown'}`,
              context: date.context || '',
              confidence: 1.0,
            })
          );
        }
      }
      if (parsed.ceza_kosullari) {
        for (const ceza of parsed.ceza_kosullari) {
          findings.push(
            createFinding({
              value: ceza.oran,
              type: `penalty_${ceza.tur || 'unknown'}`,
              context: ceza.aciklama || '',
              confidence: 1.0,
            })
          );
        }
      }
      break;
  }

  return findings;
}

/**
 * Paralel chunk analizi (Aşama 1)
 * @param {Array} chunks - Chunk listesi
 * @param {Function} onProgress - Progress callback
 * @param {number} concurrency - Paralel istek sayısı
 * @param {string} extractionType - Extraction türü ('full' veya micro-extraction türü)
 * @returns {Promise<ChunkAnalysis[]>}
 */
async function analyzeChunksParallel(chunks, onProgress, concurrency = 4, extractionType = 'full') {
  const results = [];
  let completed = 0;

  logger.info('  ▸ Aşama 1: Haiku paralel analiz', {
    module: 'analyzer',
    chunks: chunks.length,
    concurrency,
    extractionType,
    batches: Math.ceil(chunks.length / concurrency),
  });

  // Batch'ler halinde işle
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(chunks.length / concurrency);

    logger.info(`    Batch ${batchNum}/${totalBatches} işleniyor...`, { module: 'analyzer' });

    const batchResults = await Promise.all(batch.map((chunk) => analyzeChunk(chunk, extractionType)));

    results.push(...batchResults);
    completed += batch.length;

    if (onProgress) {
      onProgress({
        stage: 'stage1',
        message: `Parça analizi (${extractionType}): ${completed}/${chunks.length}`,
        progress: Math.round((completed / chunks.length) * 50), // 0-50%
      });
    }
  }

  const successCount = results.filter((r) => !r.error).length;
  const totalTokens = results.reduce((sum, r) => sum + (r.tokens?.input || 0) + (r.tokens?.output || 0), 0);
  const totalFindings = results.reduce((sum, r) => sum + (r.findings?.length || 0), 0);

  logger.info('  ✓ Aşama 1 tamamlandı', {
    module: 'analyzer',
    extractionType,
    success: `${successCount}/${chunks.length}`,
    findings: totalFindings,
    tokens: totalTokens,
  });

  return results;
}

/**
 * Micro-extraction: Birden fazla extraction türü ile paralel analiz
 * @param {Array} chunks - Chunk listesi
 * @param {Array} extractionTypes - Extraction türleri (['dates', 'amounts', 'penalties', ...])
 * @param {Function} onProgress - Progress callback
 * @param {number} concurrency - Paralel istek sayısı
 * @returns {Promise<Object>} Türe göre gruplandırılmış sonuçlar
 */
async function analyzeChunksMultiExtraction(chunks, extractionTypes, onProgress, concurrency = 4) {
  const results = {};
  let _overallProgress = 0;
  const totalSteps = extractionTypes.length;

  logger.info('▸ Multi-extraction başlıyor', {
    module: 'analyzer',
    chunks: chunks.length,
    extractionTypes,
  });

  for (let i = 0; i < extractionTypes.length; i++) {
    const extractionType = extractionTypes[i];

    if (onProgress) {
      onProgress({
        stage: 'multi_extraction',
        message: `${extractionType} çıkarılıyor (${i + 1}/${totalSteps})...`,
        progress: Math.round((i / totalSteps) * 40) + 10, // 10-50%
      });
    }

    const typeResults = await analyzeChunksParallel(
      chunks,
      null, // İç progress'i sustur
      concurrency,
      extractionType
    );

    results[extractionType] = typeResults;
    _overallProgress++;
  }

  // Tüm sonuçları düzleştir (birleşik chunk results)
  const flatResults = [];
  const seenChunks = new Set();

  for (const [type, typeResults] of Object.entries(results)) {
    for (const result of typeResults) {
      if (!seenChunks.has(result.chunkIndex)) {
        seenChunks.add(result.chunkIndex);
        flatResults.push({
          ...result,
          multiExtraction: { [type]: result.extractedData },
        });
      } else {
        // Mevcut chunk'a extraction sonucunu ekle
        const existing = flatResults.find((r) => r.chunkIndex === result.chunkIndex);
        if (existing) {
          existing.multiExtraction = existing.multiExtraction || {};
          existing.multiExtraction[type] = result.extractedData;
          existing.findings = [...(existing.findings || []), ...(result.findings || [])];
        }
      }
    }
  }

  logger.info('✓ Multi-extraction tamamlandı', {
    module: 'analyzer',
    extractionTypes,
    totalChunks: flatResults.length,
    totalFindings: flatResults.reduce((sum, r) => sum + (r.findings?.length || 0), 0),
  });

  return {
    byType: results,
    flat: flatResults,
  };
}

/**
 * Chunk analizlerini birleştir (Aşama 2 - Sonnet)
 * @param {ChunkAnalysis[]} chunkAnalyses - Chunk analizleri
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<FinalAnalysis>}
 */
async function synthesizeAnalyses(chunkAnalyses, onProgress) {
  const startTime = Date.now();

  logger.info('  ▸ Aşama 2: Sonnet birleştirme analizi', {
    module: 'analyzer',
    chunkAnalyses: chunkAnalyses.length,
  });

  if (onProgress) {
    onProgress({
      stage: 'stage2',
      message: 'Final analiz yapılıyor...',
      progress: 60,
    });
  }

  // Chunk özetlerini birleştir
  const summariesText = chunkAnalyses
    .filter((a) => !a.error)
    .map((a, idx) => {
      const data = a.extractedData || {};
      return `--- Parça ${idx + 1} (${a.chunkType || 'text'}) ---
Özet: ${data.ozet || 'N/A'}
İçerik tipi: ${data.icerik_tipi || 'genel'}
Teknik şartlar: ${JSON.stringify(data.teknik_sartlar || [])}
Birim fiyatlar: ${JSON.stringify(data.birim_fiyatlar || [])}
Tarihler: ${JSON.stringify(data.tarihler || [])}
Miktarlar: ${JSON.stringify(data.miktarlar || [])}
Notlar: ${JSON.stringify(data.onemli_notlar || [])}
`;
    })
    .join('\n\n');

  // Çok uzunsa kısalt
  const maxInputLength = 100000; // ~66K token
  const inputText =
    summariesText.length > maxInputLength
      ? summariesText.slice(0, maxInputLength) + '\n\n[... kısaltıldı ...]'
      : summariesText;

  try {
    const response = await anthropic.messages.create({
      model: aiConfig.claude.defaultModel, // Sonnet
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: STAGE2_PROMPT + inputText,
        },
      ],
    });

    const responseText = response.content[0]?.text || '{}';

    // JSON parse et
    let finalAnalysis = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        finalAnalysis = JSON.parse(jsonMatch[0]);
      }
    } catch {
      logger.warn('Stage 2 JSON parse failed');
      finalAnalysis = {
        ozet: responseText.slice(0, 500),
        parse_error: true,
      };
    }

    const duration = Date.now() - startTime;

    if (onProgress) {
      onProgress({
        stage: 'complete',
        message: 'Analiz tamamlandı',
        progress: 100,
      });
    }

    logger.info('Stage 2 completed', {
      module: 'analyzer',
      duration: `${duration}ms`,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    });

    return {
      ...finalAnalysis,
      meta: {
        chunkCount: chunkAnalyses.length,
        stage1Duration: chunkAnalyses.reduce((sum, a) => sum + (a.duration || 0), 0),
        stage2Duration: duration,
        totalInputTokens:
          chunkAnalyses.reduce((sum, a) => sum + (a.tokens?.input || 0), 0) + (response.usage?.input_tokens || 0),
        totalOutputTokens:
          chunkAnalyses.reduce((sum, a) => sum + (a.tokens?.output || 0), 0) + (response.usage?.output_tokens || 0),
      },
    };
  } catch (error) {
    logger.error('Stage 2 failed', { error: error.message });
    throw error;
  }
}

/**
 * Tam 2 aşamalı analiz pipeline'ı
 * @param {Array} chunks - Chunk listesi
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<FinalAnalysis>}
 */
export async function analyze(chunks, onProgress) {
  // Küçük dökümanlar için tek aşama yeterli
  if (chunks.length <= 2) {
    logger.info('Small document, using single-stage analysis', {
      chunkCount: chunks.length,
    });

    // Tüm içeriği birleştir ve direkt Sonnet ile analiz et
    const combinedContent = chunks.map((c) => c.content).join('\n\n---\n\n');

    const response = await anthropic.messages.create({
      model: aiConfig.claude.defaultModel,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: STAGE2_PROMPT.replace('PARÇA ANALİZLERİ:', 'DÖKÜMAN İÇERİĞİ:') + combinedContent,
        },
      ],
    });

    const responseText = response.content[0]?.text || '{}';
    let result = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch {
      result = { ozet: responseText.slice(0, 500) };
    }

    if (onProgress) {
      onProgress({ stage: 'complete', message: 'Analiz tamamlandı', progress: 100 });
    }

    return {
      ...result,
      meta: {
        chunkCount: chunks.length,
        method: 'single-stage',
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
    };
  }

  // Aşama 1: Paralel chunk analizi
  const chunkAnalyses = await analyzeChunksParallel(chunks, onProgress);

  // Aşama 2: Birleştirme
  const finalAnalysis = await synthesizeAnalyses(chunkAnalyses, onProgress);

  return finalAnalysis;
}

/**
 * Zero-Loss analiz - micro-extraction veya full extraction seçilebilir
 * @param {Array} chunks - Chunk listesi
 * @param {Object} options - Ayarlar
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
export async function analyzeZeroLoss(chunks, options = {}, onProgress) {
  const {
    extractionTypes = ['full'], // veya ['dates', 'amounts', 'penalties', 'menu', 'personnel']
    useMicroExtraction = false,
    concurrency = 4,
  } = options;

  const startTime = Date.now();

  // Micro-extraction modu
  if (useMicroExtraction && extractionTypes.length > 1) {
    const multiResults = await analyzeChunksMultiExtraction(chunks, extractionTypes, onProgress, concurrency);

    return {
      stage1Results: multiResults.flat,
      byExtractionType: multiResults.byType,
      method: 'multi-extraction',
      extractionTypes,
      meta: {
        chunkCount: chunks.length,
        extractionTypes,
        totalDuration: Date.now() - startTime,
      },
    };
  }

  // Tek extraction türü (mevcut davranış)
  const extractionType = extractionTypes[0] || 'full';
  const chunkResults = await analyzeChunksParallel(chunks, onProgress, concurrency, extractionType);

  return {
    stage1Results: chunkResults,
    byExtractionType: { [extractionType]: chunkResults },
    method: 'single-extraction',
    extractionTypes: [extractionType],
    meta: {
      chunkCount: chunks.length,
      extractionTypes: [extractionType],
      totalDuration: Date.now() - startTime,
    },
  };
}

export default {
  analyze,
  analyzeZeroLoss,
  analyzeChunk,
  analyzeChunksParallel,
  analyzeChunksMultiExtraction,
  synthesizeAnalyses,
};
