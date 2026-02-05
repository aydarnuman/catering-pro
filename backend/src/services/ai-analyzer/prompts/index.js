/**
 * Prompts Index - Tüm extraction prompt'larını export eder
 */

import extractAmounts from './extract-amounts.js';
import extractDates from './extract-dates.js';
import extractFull from './extract-full.js';
import extractMenu from './extract-menu.js';
import extractPenalties from './extract-penalties.js';
import extractPersonnel from './extract-personnel.js';

/**
 * Tüm prompt tanımları
 */
export const PROMPTS = {
  dates: extractDates,
  amounts: extractAmounts,
  penalties: extractPenalties,
  menu: extractMenu,
  personnel: extractPersonnel,
  full: extractFull,
};

/**
 * Prompt türüne göre prompt metnini al
 * @param {string} type - Prompt türü
 * @returns {string} Prompt metni
 */
export function getPrompt(type) {
  const promptDef = PROMPTS[type];
  if (!promptDef) {
    throw new Error(`Unknown prompt type: ${type}`);
  }
  return promptDef.prompt;
}

/**
 * Prompt türüne göre şemayı al
 * @param {string} type - Prompt türü
 * @returns {Object} JSON Schema
 */
export function getSchema(type) {
  const promptDef = PROMPTS[type];
  if (!promptDef) {
    throw new Error(`Unknown prompt type: ${type}`);
  }
  return promptDef.schema;
}

/**
 * Mevcut prompt türlerini listele
 * @returns {string[]}
 */
export function listPromptTypes() {
  return Object.keys(PROMPTS);
}

/**
 * Chunk türüne göre önerilen extraction türlerini belirle
 * @param {string} chunkType - Chunk türü (table, text, header, mixed)
 * @returns {string[]} Önerilen extraction türleri
 */
export function suggestExtractionTypes(chunkType) {
  switch (chunkType) {
    case 'table':
      // Tablolarda genellikle gramaj, birim fiyat, öğün bilgisi olur
      return ['menu', 'amounts'];

    case 'header':
      // Başlıklarda genellikle tarih ve genel bilgi olur
      return ['dates', 'full'];

    case 'text':
      // Normal metinde her şey olabilir
      return ['full'];

    case 'mixed':
      // Karışık içerikte tümü denenebilir
      return ['dates', 'amounts', 'penalties', 'menu', 'personnel'];

    default:
      return ['full'];
  }
}

/**
 * İhale doküman türüne göre önerilen extraction stratejisi
 * @param {string} documentType - Döküman türü
 * @returns {{ strategy: string, extractionTypes: string[] }}
 */
export function getExtractionStrategy(documentType) {
  const strategies = {
    // Teknik Şartname - gramaj, menü, personel ağırlıklı
    teknik_sartname: {
      strategy: 'detailed',
      extractionTypes: ['menu', 'personnel', 'penalties'],
      priority: ['menu', 'personnel'],
    },

    // İdari Şartname - tarih, tutar, ceza ağırlıklı
    idari_sartname: {
      strategy: 'detailed',
      extractionTypes: ['dates', 'amounts', 'penalties'],
      priority: ['dates', 'amounts'],
    },

    // Birim Fiyat Cetveli - sadece tutarlar
    birim_fiyat: {
      strategy: 'focused',
      extractionTypes: ['amounts', 'menu'],
      priority: ['amounts'],
    },

    // Sözleşme Tasarısı - tarih, ceza ağırlıklı
    sozlesme: {
      strategy: 'detailed',
      extractionTypes: ['dates', 'penalties', 'amounts'],
      priority: ['penalties', 'dates'],
    },

    // Genel/Bilinmeyen - tam tarama
    genel: {
      strategy: 'full',
      extractionTypes: ['full'],
      priority: ['full'],
    },
  };

  return strategies[documentType] || strategies.genel;
}

export default {
  PROMPTS,
  getPrompt,
  getSchema,
  listPromptTypes,
  suggestExtractionTypes,
  getExtractionStrategy,
};
