/**
 * Text Analyzer - Metin dosya analizi
 */

import fs from 'node:fs';
import logger from '../../../utils/logger.js';
import claudeClient from '../core/client.js';
import { buildMenuAnalysisPrompt, buildTextAnalysisPrompt, CITY_NORMALIZE_PROMPT } from '../core/prompts.js';
import { parseDocumentAnalysis, parseJsonResponse } from '../utils/parser.js';

/**
 * Metin içeriğini analiz et
 * @param {string} text - Analiz edilecek metin
 * @returns {Promise<Object>}
 */
export async function analyzeText(text) {
  logger.debug('Analyzing text content', {
    module: 'ai-analyzer',
    action: 'text.analyze',
    textLength: text.length,
  });

  const prompt = buildTextAnalysisPrompt(text);
  const responseText = await claudeClient.analyze(prompt, { maxTokens: 8192 });

  return parseDocumentAnalysis(responseText, text);
}

/**
 * TXT/CSV dosyasını analiz et
 * @param {string} textPath - Dosya yolu
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
export async function analyzeTextFile(textPath, onProgress) {
  const startTime = Date.now();

  logger.info('Starting text file analysis', {
    module: 'ai-analyzer',
    action: 'text.analyzeFile',
    textPath,
  });

  if (onProgress) {
    onProgress({ stage: 'reading', message: 'Dosya okunuyor...' });
  }

  const text = fs.readFileSync(textPath, 'utf-8');

  if (!text || text.trim().length === 0) {
    throw new Error('Dosya boş');
  }

  if (onProgress) {
    onProgress({ stage: 'analyzing', message: 'İçerik analiz ediliyor...' });
  }

  const parsed = await analyzeText(text);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info('Text file analysis completed', {
    module: 'ai-analyzer',
    action: 'text.analyzeFile',
    textLength: text.length,
    duration: `${duration}s`,
  });

  // Tüm alanları top-level'da döndür
  return {
    success: true,
    toplam_sayfa: 1,
    ...parsed,
    ham_metin: text,
  };
}

/**
 * Şehir adını normalize et (Claude ile)
 * @param {string} cityInput - Şehir metni
 * @returns {Promise<string>}
 */
export async function normalizeCity(cityInput) {
  if (!cityInput) return cityInput;

  try {
    const prompt = `${CITY_NORMALIZE_PROMPT}

Metin: "${cityInput}"`;

    const responseText = await claudeClient.analyze(prompt, { maxTokens: 100 });
    return responseText.trim();
  } catch (error) {
    logger.warn('City normalization failed', {
      module: 'ai-analyzer',
      action: 'text.normalizeCity',
      cityInput,
      error: error.message,
    });
    return cityInput; // Fallback: orijinal değeri döndür
  }
}

/**
 * Menü içeriğini analiz et (tarih ve yemek çıkarma)
 * @param {string} text - Menü metni
 * @returns {Promise<Array>} - Tarih ve yemek listesi
 */
export async function analyzeMenu(text) {
  logger.debug('Analyzing menu content', {
    module: 'ai-analyzer',
    action: 'text.analyzeMenu',
    textLength: text.length,
  });

  const prompt = buildMenuAnalysisPrompt(text);
  const responseText = await claudeClient.analyze(prompt, { maxTokens: 4096 });

  // JSON array çıkarmaya çalış
  const parsed = parseJsonResponse(responseText, []);

  // Array değilse boş array döndür
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed;
}

// Legacy export alias
export const analyzeWithClaude = analyzeText;

export default {
  analyzeText,
  analyzeTextFile,
  analyzeWithClaude,
  analyzeMenu,
  normalizeCity,
};
