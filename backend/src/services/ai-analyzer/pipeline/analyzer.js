/**
 * Layer 3: Two-Stage Analyzer - 2 Aşamalı Analiz
 *
 * Aşama 1: Her chunk → Haiku (hızlı özet + anahtar veriler)
 * Aşama 2: Tüm özetler → Sonnet (birleştirme + final analiz)
 */

import Anthropic from '@anthropic-ai/sdk';
import logger from '../../../utils/logger.js';
import { aiConfig } from '../../../config/ai.config.js';

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

// Aşama 1 promptu - chunk özeti
const STAGE1_PROMPT = `Bu metin bir ihale dökümanının bir parçasıdır.

GÖREV: Bu parçadan aşağıdaki bilgileri çıkar. Sadece bu parçada olan bilgileri yaz, tahmin yapma.

JSON formatında döndür:
{
  "ozet": "Bu parçanın 1-2 cümlelik özeti",
  "teknik_sartlar": ["Varsa teknik şartlar listesi"],
  "birim_fiyatlar": [{"kalem": "...", "miktar": "...", "birim": "...", "fiyat": "..."}],
  "tarihler": [{"olay": "...", "tarih": "..."}],
  "miktarlar": [{"kalem": "...", "miktar": "...", "birim": "..."}],
  "onemli_notlar": ["Kritik notlar, uyarılar"],
  "icerik_tipi": "tablo/teknik/idari/liste/genel"
}

Boş alanları boş array [] olarak bırak.
Sadece JSON döndür, başka açıklama ekleme.

DÖKÜMAN PARÇASI:
`;

// Aşama 2 promptu - birleştirme
const STAGE2_PROMPT = `Aşağıda bir ihale dökümanının farklı parçalarından çıkarılan analizler var.

GÖREV: Tüm parçaları birleştirerek kapsamlı bir ihale analizi oluştur.

JSON formatında döndür:
{
  "ozet": "İhalenin genel özeti (ne alınacak, yaklaşık büyüklük)",
  "ihale_turu": "mal/hizmet/yapım",
  "tahmini_bedel": "Varsa yaklaşık maliyet",
  "teknik_sartlar": [
    {"madde": "Şart açıklaması", "onem": "kritik/normal/bilgi"}
  ],
  "birim_fiyatlar": [
    {"kalem": "Ürün/hizmet adı", "miktar": "...", "birim": "...", "birim_fiyat": "...", "toplam": "..."}
  ],
  "takvim": [
    {"olay": "İhale tarihi/Teslim süresi/vs", "tarih": "...", "gun": "..."}
  ],
  "teslim_suresi": "Genel teslim süresi varsa",
  "onemli_notlar": [
    {"not": "Açıklama", "tur": "uyari/bilgi/gereklilik"}
  ],
  "eksik_bilgiler": ["Dökümanda bulunamayan önemli bilgiler"]
}

Tekrar eden bilgileri birleştir, çelişkileri belirt.
Sadece JSON döndür.

PARÇA ANALİZLERİ:
`;

/**
 * Tek bir chunk'ı analiz et (Aşama 1 - Haiku)
 * @param {Object} chunk - Chunk objesi
 * @returns {Promise<ChunkAnalysis>}
 */
async function analyzeChunk(chunk) {
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: aiConfig.claude.fastModel, // Haiku
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: STAGE1_PROMPT + chunk.content,
        },
      ],
    });

    const responseText = response.content[0]?.text || '{}';

    // JSON parse et
    let parsed = {};
    try {
      // JSON bloğunu bul
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      logger.warn('Chunk analysis JSON parse failed', { chunkIndex: chunk.index });
      parsed = { ozet: responseText.slice(0, 200), parse_error: true };
    }

    const duration = Date.now() - startTime;

    return {
      chunkIndex: chunk.index,
      chunkType: chunk.type,
      context: chunk.context,
      summary: parsed.ozet || '',
      extractedData: parsed,
      duration,
      tokens: {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0,
      },
    };
  } catch (error) {
    logger.error('Chunk analysis failed', {
      chunkIndex: chunk.index,
      error: error.message,
    });
    return {
      chunkIndex: chunk.index,
      error: error.message,
      extractedData: {},
    };
  }
}

/**
 * Paralel chunk analizi (Aşama 1)
 * @param {Array} chunks - Chunk listesi
 * @param {Function} onProgress - Progress callback
 * @param {number} concurrency - Paralel istek sayısı
 * @returns {Promise<ChunkAnalysis[]>}
 */
async function analyzeChunksParallel(chunks, onProgress, concurrency = 4) {
  const results = [];
  let completed = 0;

  logger.info('  ▸ Aşama 1: Haiku paralel analiz', {
    module: 'analyzer',
    chunks: chunks.length,
    concurrency,
    batches: Math.ceil(chunks.length / concurrency),
  });

  // Batch'ler halinde işle
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(chunks.length / concurrency);

    logger.info(`    Batch ${batchNum}/${totalBatches} işleniyor...`, { module: 'analyzer' });

    const batchResults = await Promise.all(batch.map((chunk) => analyzeChunk(chunk)));

    results.push(...batchResults);
    completed += batch.length;

    if (onProgress) {
      onProgress({
        stage: 'stage1',
        message: `Parça analizi: ${completed}/${chunks.length}`,
        progress: Math.round((completed / chunks.length) * 50), // 0-50%
      });
    }
  }

  const successCount = results.filter((r) => !r.error).length;
  const totalTokens = results.reduce((sum, r) => sum + (r.tokens?.input || 0) + (r.tokens?.output || 0), 0);

  logger.info('  ✓ Aşama 1 tamamlandı', {
    module: 'analyzer',
    success: `${successCount}/${chunks.length}`,
    tokens: totalTokens,
  });

  return results;
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
          chunkAnalyses.reduce((sum, a) => sum + (a.tokens?.input || 0), 0) +
          (response.usage?.input_tokens || 0),
        totalOutputTokens:
          chunkAnalyses.reduce((sum, a) => sum + (a.tokens?.output || 0), 0) +
          (response.usage?.output_tokens || 0),
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

export default {
  analyze,
  analyzeChunk,
  analyzeChunksParallel,
  synthesizeAnalyses,
};
