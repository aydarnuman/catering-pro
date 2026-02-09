/**
 * Field Validator - Kritik Alanların Doluluğunu Kontrol Eder
 *
 * Zero-Loss Pipeline için boş alan tespit ve raporlama
 */

import logger from '../../../utils/logger.js';

/**
 * Kritik alanlar ve beklenen içerikleri
 * Bu alanlar catering ihalelerinde MUTLAKA olmalı
 */
export const CRITICAL_FIELDS = {
  iletisim: {
    required: ['telefon', 'adres'],
    optional: ['email', 'yetkili', 'fax'],
    sources: ['idari_sartname', 'ilan', 'idari'],
    fallbackPrompt: `Bu metinde İLETİŞİM BİLGİLERİNİ bul:
- Telefon numarası (0xxx xxx xx xx formatında)
- Email adresi (@içeren)
- Adres (il, ilçe, cadde/sokak)
- Yetkili kişi adı

JSON formatında döndür:
{ "iletisim": { "telefon": "...", "email": "...", "adres": "...", "yetkili": "..." } }

Bulamadıysan o alanı "Belirtilmemiş" yaz.`,
    docTypes: ['idari_sartname', 'ilan'],
  },

  teminat_oranlari: {
    required: ['gecici', 'kesin'],
    optional: ['ek_kesin'],
    sources: ['idari_sartname', 'sozlesme', 'idari'],
    fallbackPrompt: `Bu metinde TEMİNAT ORANLARINI bul:
- Geçici teminat (genellikle %3)
- Kesin teminat (genellikle %6)

JSON formatında döndür:
{ "teminat_oranlari": { "gecici": "%3", "kesin": "%6" } }

Bulamadıysan "Belirtilmemiş" yaz.`,
    docTypes: ['idari_sartname'],
  },

  servis_saatleri: {
    required: ['kahvalti', 'ogle', 'aksam'],
    optional: ['ara_ogun', 'gece', 'sahur'],
    sources: ['teknik_sartname', 'teknik'],
    fallbackPrompt: `Bu metinde SERVİS SAATLERİNİ bul:
- Kahvaltı saati (örn: 07:00-08:30)
- Öğle yemeği saati (örn: 12:00-13:30)
- Akşam yemeği saati (örn: 17:30-19:00)

JSON formatında döndür:
{ "servis_saatleri": { "kahvalti": "07:00-08:30", "ogle": "12:00-13:30", "aksam": "17:30-19:00" } }

Bulamadıysan "Belirtilmemiş" yaz.`,
    docTypes: ['teknik_sartname'],
  },

  tahmini_bedel: {
    required: true,
    sources: ['ilan', 'idari_sartname', 'idari'],
    fallbackPrompt: `Bu metinde TAHMİNİ BEDEL / YAKLASIK MALİYET değerini bul.
Genellikle "Yaklaşık maliyet", "Tahmini bedel" veya "İşin bedeli" olarak geçer.
TL cinsinden tutar olmalı.

JSON formatında döndür:
{ "tahmini_bedel": "45.000.000,00 TL" }

Bulamadıysan "Belirtilmemiş" yaz.`,
    docTypes: ['ilan', 'idari_sartname'],
  },

  mali_kriterler: {
    required: ['cari_oran', 'ozkaynak_orani'],
    optional: ['is_deneyimi', 'banka_referans'],
    sources: ['idari_sartname', 'idari'],
    fallbackPrompt: `Bu metinde MALİ YETERLİK KRİTERLERİNİ bul:
- Cari oran (örn: 0.75, en az 0.75)
- Özkaynak oranı (örn: 0.15, %15)
- İş deneyimi (örn: %20, %25-50)

JSON formatında döndür:
{ "mali_kriterler": { "cari_oran": "0.75", "ozkaynak_orani": "0.15", "is_deneyimi": "%25" } }`,
    docTypes: ['idari_sartname'],
  },
};

/**
 * Object'in gerçekten dolu olup olmadığını kontrol et
 * Boş string, null, undefined değerlerini boş sayar
 */
function hasContent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '' && value !== 'Belirtilmemiş';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value).some((v) => hasContent(v));
  }
  return true;
}

/**
 * Kritik alanların doluluğunu kontrol et
 * @param {Object} analysis - Analiz sonucu
 * @returns {{ valid: boolean, missing: Array, filled: Array, completeness: number }}
 */
export function validateCriticalFields(analysis) {
  const missing = [];
  const filled = [];
  const details = {};

  for (const [field, config] of Object.entries(CRITICAL_FIELDS)) {
    const value = analysis[field];
    const fieldHasContent = hasContent(value);

    details[field] = {
      exists: value !== undefined,
      hasContent: fieldHasContent,
      value: fieldHasContent ? value : null,
    };

    if (!fieldHasContent) {
      missing.push({
        field,
        config,
        reason: value === undefined ? 'missing' : 'empty',
      });
    } else {
      filled.push(field);
    }
  }

  const totalFields = Object.keys(CRITICAL_FIELDS).length;
  const completeness = filled.length / totalFields;

  logger.info('Critical fields validation', {
    module: 'field-validator',
    filled: filled.length,
    missing: missing.length,
    completeness: `${(completeness * 100).toFixed(1)}%`,
    missingFields: missing.map((m) => m.field),
  });

  return {
    valid: missing.length === 0,
    missing,
    filled,
    completeness,
    details,
  };
}

/**
 * Döküman tipine göre hangi kritik alanların bekleneceğini belirle
 * @param {string} docType - Döküman tipi
 * @returns {string[]} Beklenen kritik alan listesi
 */
export function getExpectedFieldsForDocType(docType) {
  const expected = [];
  const normalizedType = (docType || '').toLowerCase();

  for (const [field, config] of Object.entries(CRITICAL_FIELDS)) {
    if (config.docTypes?.some((dt) => normalizedType.includes(dt))) {
      expected.push(field);
    }
  }

  return expected;
}

/**
 * Eksik alan için uygun chunk'ları bul
 * @param {Array} chunks - Tüm chunk'lar
 * @param {Object} fieldConfig - Alan konfigürasyonu
 * @returns {Array} İlgili chunk'lar
 */
export function findRelevantChunks(chunks, fieldConfig) {
  const relevantChunks = [];
  const sources = fieldConfig.sources || [];

  for (const chunk of chunks) {
    const rawContext = chunk.context;
    const chunkContext = (typeof rawContext === 'string' ? rawContext : JSON.stringify(rawContext || '')).toLowerCase();
    const chunkContent = (typeof chunk.content === 'string' ? chunk.content : '').toLowerCase();

    // Source eşleşmesi
    if (sources.some((s) => chunkContext.includes(s) || chunkContent.includes(s))) {
      relevantChunks.push(chunk);
      continue;
    }

    // İçerik ipuçları
    if (fieldConfig === CRITICAL_FIELDS.iletisim) {
      if (
        chunkContent.includes('telefon') ||
        chunkContent.includes('adres') ||
        chunkContent.includes('email') ||
        chunkContent.includes('@')
      ) {
        relevantChunks.push(chunk);
      }
    } else if (fieldConfig === CRITICAL_FIELDS.teminat_oranlari) {
      if (chunkContent.includes('teminat') || chunkContent.includes('geçici') || chunkContent.includes('kesin')) {
        relevantChunks.push(chunk);
      }
    } else if (fieldConfig === CRITICAL_FIELDS.servis_saatleri) {
      if (
        chunkContent.includes('saat') ||
        chunkContent.includes('servis') ||
        chunkContent.includes('kahvaltı') ||
        chunkContent.includes('öğle')
      ) {
        relevantChunks.push(chunk);
      }
    } else if (fieldConfig === CRITICAL_FIELDS.tahmini_bedel) {
      if (
        chunkContent.includes('bedel') ||
        chunkContent.includes('maliyet') ||
        chunkContent.includes('yaklaşık') ||
        chunkContent.includes('tutar')
      ) {
        relevantChunks.push(chunk);
      }
    }
  }

  // En az 1, en fazla 5 chunk döndür
  return relevantChunks.slice(0, 5);
}

/**
 * Validation sonucunu logla
 * @param {Object} validation - Validation sonucu
 * @param {string} stage - Pipeline aşaması
 */
export function logValidationResult(validation, stage = 'unknown') {
  const emoji = validation.valid ? '✓' : '⚠️';

  logger.info(`${emoji} Field Validation [${stage}]`, {
    module: 'field-validator',
    stage,
    valid: validation.valid,
    completeness: `${(validation.completeness * 100).toFixed(1)}%`,
    filled: validation.filled,
    missing: validation.missing.map((m) => m.field),
  });

  return validation;
}

export default {
  CRITICAL_FIELDS,
  validateCriticalFields,
  getExpectedFieldsForDocType,
  findRelevantChunks,
  logValidationResult,
};
