/**
 * Assembler Unit Tests
 * Layer 6: JSON Birleştirme
 */

import { describe, test, expect } from 'vitest';
import { assembleResults, validateNoNewInformation } from '../pipeline/assembler.js';
import { detectConflicts } from '../pipeline/conflict.js';

// ==================== TEST VERİLERİ ====================

const CHUNK_RESULTS = [
  {
    chunk_id: 'chunk_0',
    chunkIndex: 0,
    extractedData: {
      dates: [
        { value: '01.06.2025', type: 'baslangic', context: 'İhale başlangıç', confidence: 1.0 },
        { value: '31.12.2025', type: 'bitis', context: 'İhale bitiş', confidence: 1.0 },
      ],
      amounts: [{ value: '1.500.000,00', type: 'yaklasik_maliyet', context: 'Yaklaşık maliyet', confidence: 1.0 }],
      penalties: [{ rate: '%1', type: 'gecikme_cezasi', context: 'Gecikme cezası', confidence: 0.9 }],
    },
  },
  {
    chunk_id: 'chunk_1',
    chunkIndex: 1,
    extractedData: {
      dates: [{ value: '15.05.2025', type: 'ihale_tarihi', context: 'İhale açılış', confidence: 0.95 }],
      amounts: [{ value: '150.000,00', type: 'gecici_teminat', context: 'Geçici teminat', confidence: 0.85 }],
      meals: [
        { type: 'sabah', daily_count: 500, context: 'Sabah kahvaltısı', confidence: 1.0 },
        { type: 'ogle', daily_count: 800, context: 'Öğle yemeği', confidence: 1.0 },
      ],
    },
  },
];

const EMPTY_CHUNKS = [];

const SINGLE_CHUNK = [
  {
    chunk_id: 'chunk_0',
    extractedData: {
      dates: [{ value: '2025-01-01', type: 'baslangic', confidence: 1.0 }],
    },
  },
];

// ==================== TESTLER ====================

describe('assembleResults', () => {
  test('chunk sonuçlarını birleştirir', () => {
    const conflicts = detectConflicts(CHUNK_RESULTS);
    const assembled = assembleResults(CHUNK_RESULTS, conflicts);

    expect(assembled).toBeDefined();
    expect(assembled.fields).toBeDefined();
    expect(assembled.fields.dates).toBeDefined();
    expect(assembled.fields.amounts).toBeDefined();
    expect(assembled.fields.penalties).toBeDefined();
  });

  test('tarihleri doğru birleştirir', () => {
    const assembled = assembleResults(CHUNK_RESULTS, []);

    // 3 farklı tarih (baslangic, bitis, ihale_tarihi)
    expect(assembled.fields.dates.length).toBeGreaterThanOrEqual(2);
  });

  test('tutarları doğru birleştirir', () => {
    const assembled = assembleResults(CHUNK_RESULTS, []);

    // 2 farklı tutar
    expect(assembled.fields.amounts.length).toBeGreaterThanOrEqual(2);
  });

  test('assembly_metadata mevcut', () => {
    const assembled = assembleResults(CHUNK_RESULTS, []);

    expect(assembled.assembly_metadata).toBeDefined();
    expect(assembled.assembly_metadata.source_chunks).toBe(2);
    expect(assembled.assembly_metadata.assembly_time).toBeGreaterThanOrEqual(0);
  });

  test('conflicts korunur', () => {
    const conflicts = detectConflicts(CHUNK_RESULTS);
    const assembled = assembleResults(CHUNK_RESULTS, conflicts);

    expect(assembled.conflicts).toEqual(conflicts);
  });

  test('boş chunk listesi → varsayılan sonuç', () => {
    const assembled = assembleResults(EMPTY_CHUNKS, []);

    expect(assembled.fields.dates).toEqual([]);
    expect(assembled.fields.amounts).toEqual([]);
    expect(assembled.assembly_metadata.source_chunks).toBe(0);
  });

  test('tek chunk birleştirme', () => {
    const assembled = assembleResults(SINGLE_CHUNK, []);

    expect(assembled.fields.dates.length).toBeGreaterThanOrEqual(1);
  });

  test('hatalı chunk atlanır', () => {
    const results = [{ error: 'parse_error' }, CHUNK_RESULTS[0]];
    const assembled = assembleResults(results, []);
    expect(assembled.fields.dates.length).toBeGreaterThanOrEqual(1);
  });
});

describe('validateNoNewInformation', () => {
  test('aynı bilgiler → valid: true', () => {
    const assembled = assembleResults(CHUNK_RESULTS, []);
    const validation = validateNoNewInformation(CHUNK_RESULTS, assembled);

    expect(validation).toBeDefined();
    expect(validation.valid).toBe(true);
    expect(validation.newValues).toEqual([]);
  });

  test('yeni bilgi eklenmiş → valid: false', () => {
    const fakeStage2 = {
      fields: {
        dates: [
          { value: '01.06.2025' },
          { value: '99.99.9999' }, // Bu stage1'de yok
        ],
        amounts: [],
        penalties: [],
      },
    };

    const validation = validateNoNewInformation(CHUNK_RESULTS, fakeStage2);
    expect(validation.valid).toBe(false);
    expect(validation.newValues.length).toBeGreaterThan(0);
  });

  test('boş stage2 → valid: true', () => {
    const validation = validateNoNewInformation(CHUNK_RESULTS, { fields: {} });
    expect(validation.valid).toBe(true);
  });

  test('boş stage1 ve stage2 → valid: true', () => {
    const validation = validateNoNewInformation([], { fields: {} });
    expect(validation.valid).toBe(true);
  });
});
