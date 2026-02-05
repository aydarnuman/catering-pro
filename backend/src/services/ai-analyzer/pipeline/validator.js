/**
 * Layer 7: Validation - Şema Doğrulama
 *
 * Final sonucun şema uyumunu ve tamlığını doğrular.
 * Completeness score hesaplar.
 */

import Ajv from 'ajv';
import logger from '../../../utils/logger.js';
import { runAllP0Checks } from '../controls/p0-checks.js';
import { FINAL_OUTPUT_SCHEMA } from '../schemas/final-output.js';

// AJV instance
const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * İhale dökümanı için beklenen alanlar
 */
const EXPECTED_FIELDS = {
  // Kritik alanlar (yoksa ciddi eksiklik)
  critical: ['dates.ihale_tarihi', 'dates.baslangic', 'amounts.yaklasik_maliyet'],

  // Önemli alanlar (olması beklenir)
  important: ['dates.bitis', 'amounts.birim_fiyat', 'penalties', 'menus.meals', 'menus.gramaj', 'personnel.staff'],

  // Opsiyonel alanlar (bonus)
  optional: [
    'dates.son_basvuru',
    'amounts.gecici_teminat',
    'amounts.kesin_teminat',
    'menus.service_times',
    'personnel.qualifications',
    'contact',
  ],
};

/**
 * Nested path'den değer al
 * @param {Object} obj - Obje
 * @param {string} path - Path (örn: "dates.ihale_tarihi")
 * @returns {any}
 */
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Alanın dolu olup olmadığını kontrol et
 * @param {any} value - Değer
 * @returns {boolean}
 */
function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Tamlık skoru hesapla
 * @param {Object} result - Analiz sonucu
 * @returns {{ score: number, details: Object }}
 */
export function calculateCompleteness(result) {
  const details = {
    critical: { total: 0, found: 0, missing: [] },
    important: { total: 0, found: 0, missing: [] },
    optional: { total: 0, found: 0, missing: [] },
  };

  // Analysis veya fields objesini bul
  const analysisData = result.analysis || result.fields || result;

  // Kritik alanları kontrol et
  for (const field of EXPECTED_FIELDS.critical) {
    details.critical.total++;
    const value = getNestedValue(analysisData, field);

    if (hasValue(value)) {
      details.critical.found++;
    } else {
      details.critical.missing.push(field);
    }
  }

  // Önemli alanları kontrol et
  for (const field of EXPECTED_FIELDS.important) {
    details.important.total++;
    const value = getNestedValue(analysisData, field);

    if (hasValue(value)) {
      details.important.found++;
    } else {
      details.important.missing.push(field);
    }
  }

  // Opsiyonel alanları kontrol et
  for (const field of EXPECTED_FIELDS.optional) {
    details.optional.total++;
    const value = getNestedValue(analysisData, field);

    if (hasValue(value)) {
      details.optional.found++;
    } else {
      details.optional.missing.push(field);
    }
  }

  // Ağırlıklı skor hesapla
  // Kritik: %50, Önemli: %35, Opsiyonel: %15
  const criticalScore = details.critical.total > 0 ? details.critical.found / details.critical.total : 0;
  const importantScore = details.important.total > 0 ? details.important.found / details.important.total : 0;
  const optionalScore = details.optional.total > 0 ? details.optional.found / details.optional.total : 0;

  const score = criticalScore * 0.5 + importantScore * 0.35 + optionalScore * 0.15;

  return {
    score: Math.round(score * 100) / 100, // 2 decimal
    details,
    critical_complete: details.critical.missing.length === 0,
    summary: {
      critical: `${details.critical.found}/${details.critical.total}`,
      important: `${details.important.found}/${details.important.total}`,
      optional: `${details.optional.found}/${details.optional.total}`,
    },
  };
}

/**
 * JSON şema doğrulaması
 * @param {Object} result - Doğrulanacak sonuç
 * @param {Object} schema - JSON Schema (opsiyonel)
 * @returns {{ valid: boolean, errors: Array }}
 */
export function validateSchema(result, schema = FINAL_OUTPUT_SCHEMA) {
  try {
    const validate = ajv.compile(schema);
    const valid = validate(result);

    return {
      valid,
      errors: validate.errors || [],
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: `Schema validation error: ${error.message}` }],
    };
  }
}

/**
 * Veri kalitesi kontrolü
 * @param {Object} result - Analiz sonucu
 * @returns {{ score: number, issues: Array }}
 */
export function checkDataQuality(result) {
  const issues = [];
  let qualityScore = 1.0;

  const analysisData = result.analysis || result.fields || result;

  // Düşük güvenli değerleri kontrol et
  const lowConfidenceThreshold = 0.6;
  const fieldsToCheck = ['dates', 'amounts', 'penalties'];

  for (const field of fieldsToCheck) {
    const items = getNestedValue(analysisData, field) || [];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (item.confidence && item.confidence < lowConfidenceThreshold) {
        issues.push({
          type: 'low_confidence',
          field,
          value: item.value,
          confidence: item.confidence,
          severity: 'warning',
        });
        qualityScore -= 0.02; // Her düşük güvenli değer için -2%
      }
    }
  }

  // Eksik context kontrolü
  for (const field of fieldsToCheck) {
    const items = getNestedValue(analysisData, field) || [];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item.context && !item.source_chunk_id) {
        issues.push({
          type: 'missing_context',
          field,
          value: item.value,
          severity: 'info',
        });
        qualityScore -= 0.01;
      }
    }
  }

  // Çelişki varsa
  const conflicts = result.conflicts || [];
  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      issues.push({
        type: 'conflict',
        field: conflict.field,
        values: conflict.values?.map((v) => v.value),
        severity: 'warning',
      });
      qualityScore -= 0.05; // Her çelişki için -5%
    }
  }

  return {
    score: Math.max(0, Math.round(qualityScore * 100) / 100),
    issues,
    issue_count: issues.length,
    by_severity: {
      error: issues.filter((i) => i.severity === 'error').length,
      warning: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length,
    },
  };
}

/**
 * Tam doğrulama yap
 * @param {Object} result - Analiz sonucu
 * @param {Object} context - Ek bağlam (chunks, structureInfo vb.)
 * @returns {Object} Doğrulama sonucu
 */
export function validateOutput(result, context = {}) {
  const startTime = Date.now();

  // Şema doğrulaması
  const schemaValidation = validateSchema(result);

  // Tamlık kontrolü
  const completeness = calculateCompleteness(result);

  // Veri kalitesi
  const dataQuality = checkDataQuality(result);

  // P0 kontrolleri (context varsa)
  let p0Checks = { all_passed: true, checks: [] };
  if (context.chunks || context.originalText) {
    p0Checks = runAllP0Checks({
      chunks: context.chunks,
      structureInfo: context.structureInfo,
      originalText: context.originalText,
      stage1Results: context.stage1Results,
      stage2Result: context.stage2Result,
      finalResult: result,
      detectedConflicts: result.conflicts,
    });
  }

  const duration = Date.now() - startTime;

  // Genel geçerlilik
  const valid =
    schemaValidation.valid && completeness.critical_complete && p0Checks.all_passed && dataQuality.score >= 0.5;

  const validation = {
    valid,
    schema_valid: schemaValidation.valid,
    schema_errors: schemaValidation.errors,
    completeness_score: completeness.score,
    completeness_details: completeness.details,
    completeness_summary: completeness.summary,
    critical_complete: completeness.critical_complete,
    data_quality: dataQuality,
    p0_checks: p0Checks,
    validation_time_ms: duration,
  };

  logger.info('Validation completed', {
    module: 'validator',
    valid,
    schema_valid: schemaValidation.valid,
    completeness_score: completeness.score,
    p0_passed: p0Checks.all_passed,
    quality_score: dataQuality.score,
    duration: `${duration}ms`,
  });

  return validation;
}

/**
 * Hızlı doğrulama (sadece kritik kontroller)
 * @param {Object} result - Analiz sonucu
 * @returns {{ valid: boolean, reason: string }}
 */
export function quickValidate(result) {
  // Sonuç boş mu?
  if (!result) {
    return { valid: false, reason: 'Sonuç boş' };
  }

  // Error var mı?
  if (result.error) {
    return { valid: false, reason: `Hata: ${result.error}` };
  }

  // Minimum veri var mı?
  const analysisData = result.analysis || result.fields || result;
  const dates = getNestedValue(analysisData, 'dates') || [];
  const amounts = getNestedValue(analysisData, 'amounts') || [];

  if (dates.length === 0 && amounts.length === 0) {
    return { valid: false, reason: 'Minimum veri yok (tarih ve tutar bulunamadı)' };
  }

  return { valid: true, reason: 'OK' };
}

export default {
  validateOutput,
  validateSchema,
  calculateCompleteness,
  checkDataQuality,
  quickValidate,
};
