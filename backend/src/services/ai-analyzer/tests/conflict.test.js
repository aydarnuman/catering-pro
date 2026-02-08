/**
 * Conflict Detection Unit Tests
 * Layer 5: Çelişki tespiti
 */

import { describe, expect, test } from 'vitest';
import { detectConflicts, generateConflictReport } from '../pipeline/conflict.js';

// ==================== TEST VERİLERİ ====================

const NO_CONFLICT_RESULTS = [
  {
    chunk_id: 'chunk_0',
    extractedData: {
      dates: [{ value: '01.06.2025', type: 'baslangic', context: 'Başlangıç tarihi', confidence: 1.0 }],
      amounts: [{ value: '1.000.000,00', type: 'yaklasik_maliyet', confidence: 1.0 }],
    },
  },
  {
    chunk_id: 'chunk_1',
    extractedData: {
      dates: [{ value: '01.06.2025', type: 'baslangic', context: 'İşe başlama', confidence: 0.9 }],
      amounts: [{ value: '1.000.000,00', type: 'yaklasik_maliyet', confidence: 0.8 }],
    },
  },
];

const CONFLICT_RESULTS = [
  {
    chunk_id: 'chunk_0',
    extractedData: {
      dates: [
        { value: '01.06.2025', type: 'baslangic', context: 'Chunk 0', confidence: 1.0 },
        { value: '31.12.2025', type: 'bitis', context: 'Chunk 0', confidence: 1.0 },
      ],
      amounts: [{ value: '1.500.000,00', type: 'yaklasik_maliyet', confidence: 1.0 }],
    },
  },
  {
    chunk_id: 'chunk_1',
    extractedData: {
      dates: [
        { value: '15.06.2025', type: 'baslangic', context: 'Chunk 1', confidence: 0.8 },
        { value: '31.12.2025', type: 'bitis', context: 'Chunk 1', confidence: 1.0 },
      ],
      amounts: [{ value: '2.000.000,00', type: 'yaklasik_maliyet', confidence: 0.7 }],
    },
  },
];

const SINGLE_CHUNK = [
  {
    chunk_id: 'chunk_0',
    extractedData: {
      dates: [{ value: '01.06.2025', type: 'baslangic', confidence: 1.0 }],
    },
  },
];

const EMPTY_RESULTS = [];

// ==================== TESTLER ====================

describe('detectConflicts', () => {
  test('aynı değerler çelişki sayılmaz', () => {
    const conflicts = detectConflicts(NO_CONFLICT_RESULTS);
    expect(conflicts).toBeDefined();
    expect(Array.isArray(conflicts)).toBe(true);

    // Aynı baslangic tarihi → çelişki yok
    const dateConflicts = conflicts.filter((c) => c.field?.startsWith('dates.baslangic'));
    expect(dateConflicts.length).toBe(0);
  });

  test('farklı değerler çelişki olarak tespit edilir', () => {
    const conflicts = detectConflicts(CONFLICT_RESULTS);
    expect(conflicts.length).toBeGreaterThan(0);

    // baslangic tarihleri farklı → çelişki
    const dateConflict = conflicts.find((c) => c.field === 'dates.baslangic');
    expect(dateConflict).toBeDefined();
    expect(dateConflict.values.length).toBeGreaterThanOrEqual(2);
  });

  test('aynı bitis tarihleri çelişki oluşturmaz', () => {
    const conflicts = detectConflicts(CONFLICT_RESULTS);
    const bitisConflict = conflicts.find((c) => c.field === 'dates.bitis');
    expect(bitisConflict).toBeUndefined();
  });

  test('tutarlarda çelişki tespit edilir', () => {
    const conflicts = detectConflicts(CONFLICT_RESULTS);
    const amountConflict = conflicts.find((c) => c.field?.startsWith('amounts'));
    expect(amountConflict).toBeDefined();
  });

  test('tek chunk ile çelişki olmaz', () => {
    const conflicts = detectConflicts(SINGLE_CHUNK);
    expect(conflicts.length).toBe(0);
  });

  test('boş sonuçlarla çökmez', () => {
    const conflicts = detectConflicts(EMPTY_RESULTS);
    expect(conflicts).toEqual([]);
  });

  test('null/error chunk atlanır', () => {
    const results = [
      null,
      { error: 'parse_error' },
      {
        chunk_id: 'chunk_2',
        extractedData: { dates: [{ value: '01.01.2025', type: 'baslangic', confidence: 1.0 }] },
      },
    ];
    const conflicts = detectConflicts(results);
    expect(Array.isArray(conflicts)).toBe(true);
  });

  test('çelişki objesi doğru yapıda', () => {
    const conflicts = detectConflicts(CONFLICT_RESULTS);
    for (const conflict of conflicts) {
      expect(conflict).toHaveProperty('field');
      expect(conflict).toHaveProperty('values');
      expect(conflict).toHaveProperty('needs_review');
      expect(conflict).toHaveProperty('conflict_type');
      expect(conflict).toHaveProperty('suggested_resolution');
      expect(Array.isArray(conflict.values)).toBe(true);
    }
  });

  test('çelişki değerleri source_chunk_id içerir', () => {
    const conflicts = detectConflicts(CONFLICT_RESULTS);
    for (const conflict of conflicts) {
      for (const val of conflict.values) {
        expect(val).toHaveProperty('source_chunk_id');
      }
    }
  });
});

describe('generateConflictReport', () => {
  test('rapor doğru yapıda', () => {
    const conflicts = detectConflicts(CONFLICT_RESULTS);
    const report = generateConflictReport(conflicts);

    expect(report).toHaveProperty('total_conflicts');
    expect(report).toHaveProperty('critical_conflicts');
    expect(report).toHaveProperty('by_field');
    expect(report).toHaveProperty('by_type');
    expect(report).toHaveProperty('needs_review_count');
  });

  test('toplam sayı doğru', () => {
    const conflicts = detectConflicts(CONFLICT_RESULTS);
    const report = generateConflictReport(conflicts);
    expect(report.total_conflicts).toBe(conflicts.length);
  });

  test('boş çelişki listesi için sıfır rapor', () => {
    const report = generateConflictReport([]);
    expect(report.total_conflicts).toBe(0);
    expect(report.needs_review_count).toBe(0);
  });

  test('by_type kategorileri mevcut', () => {
    const report = generateConflictReport([]);
    expect(report.by_type).toHaveProperty('different_values');
    expect(report.by_type).toHaveProperty('partial_match');
  });
});
