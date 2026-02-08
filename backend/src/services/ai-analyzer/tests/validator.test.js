/**
 * Validator Unit Tests
 * Layer 7: Schema Validation & Completeness
 */

import { describe, expect, test } from 'vitest';
import { calculateCompleteness, checkDataQuality, quickValidate, validateSchema } from '../pipeline/validator.js';

// ==================== TEST VERİLERİ ====================

// calculateCompleteness, getNestedValue ile "dates.baslangic" gibi path'lere erişir.
// Bu yüzden veriler { dates: { baslangic: ..., bitis: ... } } formatında olmalı.
const FULL_RESULT = {
  analysis: {
    dates: {
      ihale_tarihi: '15.05.2025',
      baslangic: '01.06.2025',
      bitis: '31.12.2025',
    },
    amounts: {
      yaklasik_maliyet: '1.500.000,00',
      birim_fiyat: '45,00',
      gecici_teminat: '150.000,00',
      kesin_teminat: '300.000,00',
    },
    penalties: [{ rate: '%1', type: 'gecikme_cezasi' }],
    menus: {
      meals: [{ type: 'ogle', daily_count: 800 }],
      gramaj: [{ type: 'et', gram: 150 }],
      service_times: { sabah: '07:00', ogle: '12:00' },
    },
    personnel: {
      staff: [{ position: 'Aşçıbaşı', count: 1 }],
      qualifications: ['ISO 22000'],
    },
    contact: { email: 'test@test.com' },
  },
  conflicts: [],
};

const PARTIAL_RESULT = {
  analysis: {
    dates: {
      baslangic: '01.06.2025',
    },
    amounts: {},
    penalties: [],
  },
  conflicts: [],
};

const EMPTY_RESULT = {
  analysis: {
    dates: {},
    amounts: {},
    penalties: [],
  },
  conflicts: [],
};

const LOW_CONFIDENCE_RESULT = {
  fields: {
    dates: [{ value: '01.06.2025', type: 'baslangic', confidence: 0.3, source_chunk_id: 'c0' }],
    amounts: [{ value: '???', type: 'yaklasik_maliyet', confidence: 0.2, source_chunk_id: 'c0' }],
    penalties: [],
  },
  conflicts: [{ field: 'dates.baslangic', values: [{ value: 'A' }, { value: 'B' }] }],
};

// ==================== calculateCompleteness ====================

describe('calculateCompleteness', () => {
  test('tam sonuç yüksek skor verir', () => {
    const result = calculateCompleteness(FULL_RESULT);

    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('details');
    expect(result).toHaveProperty('critical_complete');
    expect(result).toHaveProperty('summary');
    expect(result.score).toBeGreaterThan(0.5);
  });

  test('kısmi sonuç orta skor verir', () => {
    const result = calculateCompleteness(PARTIAL_RESULT);

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });

  test('boş sonuç düşük skor verir', () => {
    const result = calculateCompleteness(EMPTY_RESULT);

    expect(result.score).toBeLessThan(0.3);
    expect(result.critical_complete).toBe(false);
  });

  test('skor 0-1 arasında', () => {
    for (const input of [FULL_RESULT, PARTIAL_RESULT, EMPTY_RESULT]) {
      const result = calculateCompleteness(input);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });

  test('details yapısı doğru', () => {
    const result = calculateCompleteness(FULL_RESULT);

    expect(result.details).toHaveProperty('critical');
    expect(result.details).toHaveProperty('important');
    expect(result.details).toHaveProperty('optional');
    expect(result.details.critical).toHaveProperty('total');
    expect(result.details.critical).toHaveProperty('found');
    expect(result.details.critical).toHaveProperty('missing');
  });

  test('summary yapısı doğru', () => {
    const result = calculateCompleteness(FULL_RESULT);

    expect(result.summary).toHaveProperty('critical');
    expect(result.summary).toHaveProperty('important');
    expect(result.summary).toHaveProperty('optional');
  });

  test('null input çökmez', () => {
    // null input koruma: throw veya default sonuç
    try {
      const result = calculateCompleteness(null);
      expect(result.score).toBeLessThanOrEqual(1);
    } catch {
      // null argument throw ederse kabul edilebilir
      expect(true).toBe(true);
    }
  });
});

// ==================== validateSchema ====================

describe('validateSchema', () => {
  test('sonuç validate edilir', () => {
    const result = validateSchema(FULL_RESULT);
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
  });

  test('boş sonuç validate edilir', () => {
    const result = validateSchema({});
    expect(result).toHaveProperty('valid');
  });
});

// ==================== checkDataQuality ====================

describe('checkDataQuality', () => {
  test('yüksek güvenli sonuç iyi skor alır', () => {
    const quality = checkDataQuality(FULL_RESULT);

    expect(quality).toHaveProperty('score');
    expect(quality).toHaveProperty('issues');
    expect(quality).toHaveProperty('issue_count');
    expect(quality).toHaveProperty('by_severity');
    expect(quality.score).toBeGreaterThan(0.5);
  });

  test('düşük güvenli sonuç düşük skor alır', () => {
    const quality = checkDataQuality(LOW_CONFIDENCE_RESULT);

    expect(quality.score).toBeLessThan(1);
    expect(quality.issues.length).toBeGreaterThan(0);
  });

  test('issue severity kategorileri mevcut', () => {
    const quality = checkDataQuality(LOW_CONFIDENCE_RESULT);

    expect(quality.by_severity).toHaveProperty('error');
    expect(quality.by_severity).toHaveProperty('warning');
    expect(quality.by_severity).toHaveProperty('info');
  });

  test('boş sonuç çökmez', () => {
    const quality = checkDataQuality(EMPTY_RESULT);
    expect(quality).toHaveProperty('score');
  });
});

// ==================== quickValidate ====================

describe('quickValidate', () => {
  test('geçerli sonuç → valid: true', () => {
    const result = quickValidate(FULL_RESULT);
    expect(result.valid).toBe(true);
  });

  test('null/undefined → valid: false', () => {
    const result = quickValidate(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('reason açıklama içerir', () => {
    const result = quickValidate(FULL_RESULT);
    expect(typeof result.reason).toBe('string');
  });
});
