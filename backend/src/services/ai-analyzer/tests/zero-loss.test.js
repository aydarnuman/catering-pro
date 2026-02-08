/**
 * Zero-Loss Pipeline Test Suite
 *
 * Edge case testleri:
 * - Tablo tespiti ve bütünlüğü
 * - Başlık tespiti (iç içe maddeler dahil)
 * - Çapraz referans tespiti
 * - Chunking ve karakter kaybı kontrolü
 * - Çelişki tespiti
 * - Sonuç birleştirme
 * - P0 kontrolleri (JSON, null/empty, tablo bütünlüğü)
 * - Tamlık skoru hesaplama
 */

import { describe, test, expect } from 'vitest';

import {
  checkHeadingContentUnity,
  checkNullVsEmpty,
  checkTableIntegrity,
  ensureValidJson,
} from '../controls/p0-checks.js';
import { assembleResults, validateNoNewInformation } from '../pipeline/assembler.js';
import { chunkTextWithStructure, validateCharacterCount } from '../pipeline/chunker.js';
import { detectConflicts } from '../pipeline/conflict.js';
import { detectHeadings, detectReferences, detectStructure, detectTables } from '../pipeline/structure.js';
import { calculateCompleteness } from '../pipeline/validator.js';

// ==================== TEST VERİLERİ ====================

const TABLE_TEXT = `
Bu bir giriş paragrafıdır.

| Kalem | Miktar | Birim | Fiyat |
|-------|--------|-------|-------|
| Et    | 150    | gram  | 45,00 |
| Tavuk | 120    | gram  | 35,00 |
| Balık | 180    | gram  | 55,00 |

Bu tablodan sonra gelen metin.
`;

const HEADING_TEXT = `
MADDE 1 - KONU

Bu maddenin içeriği.

1.1 Alt Başlık

Alt başlık içeriği.

1.1.1 Alt Alt Başlık

Daha derin içerik.

BÖLÜM II - TEKNİK ŞARTLAR

Bölüm içeriği.
`;

const REFERENCE_TEXT = `
Bu konuda Madde 8'e bakınız.
Ayrıca yukarıdaki 12.3 maddede belirtildiği gibi işlem yapılacaktır.
Detaylar için Bölüm III'e göre hareket edilecektir.
Ek-2'de yer alan listeler dikkate alınacaktır.
`;

const LONG_TABLE_TEXT = `
Başlangıç metni.

MADDE 5 - FİYAT LİSTESİ

| Kalem | Miktar | Birim | Fiyat |
|-------|--------|-------|-------|
| Et    | 150    | gram  | 45,00 |
| Tavuk | 120    | gram  | 35,00 |
| Balık | 180    | gram  | 55,00 |
| Sebze | 200    | gram  | 15,00 |
| Pilav | 150    | gram  | 10,00 |

(*) Fiyatlar KDV hariçtir.

Tablo sonrası metin devam eder.
`;

const NESTED_HEADING_TEXT = `
MADDE 12 - CEZA KOŞULLARI

12.1 Genel Hükümler
12.1.1 Gecikme Cezası
12.1.1.a İlk Hafta
12.1.1.b İkinci Hafta
12.1.2 Kalite Cezası
12.2 Özel Hükümler
`;

const TABLE_WITH_FOOTNOTE = `
| Kalem | Fiyat (*) |
|-------|-----------|
| Et    | 45,00     |

(*) KDV hariç fiyatlardır.
(1) Fiyatlar 2025 yılı için geçerlidir.
`;

// ==================== TEST SUITE ====================

describe('Structure Detection', () => {
  test('detectTables - pipe tablolarını tespit eder', () => {
    const tables = detectTables(TABLE_TEXT);
    expect(tables).toBeDefined();
    expect(tables.length).toBeGreaterThanOrEqual(1);
    expect(tables[0].type).toBe('pipe');
  });

  test('detectHeadings - farklı seviyelerde başlık tespit eder', () => {
    const headings = detectHeadings(HEADING_TEXT);
    expect(headings).toBeDefined();
    expect(headings.length).toBeGreaterThanOrEqual(2);

    // MADDE tespiti (text = capture group, fullText = tam satır)
    const madde = headings.find((h) => h.type === 'madde' || (h.fullText && h.fullText.includes('MADDE 1')));
    expect(madde).toBeDefined();

    // BÖLÜM tespiti
    const bolum = headings.find((h) => h.type === 'bolum' || (h.fullText && h.fullText.includes('BÖLÜM')));
    expect(bolum).toBeDefined();
  });

  test('detectHeadings - iç içe maddeleri tespit eder', () => {
    const headings = detectHeadings(NESTED_HEADING_TEXT);
    expect(headings).toBeDefined();
    expect(headings.length).toBeGreaterThanOrEqual(4);

    // Derin iç içe madde kontrolü (12.1.1.a gibi)
    const hasDeepNesting = headings.some((h) => h.level >= 3);
    expect(hasDeepNesting).toBe(true);
  });

  test('detectReferences - çapraz referansları tespit eder', () => {
    const references = detectReferences(REFERENCE_TEXT);
    expect(references).toBeDefined();
    expect(references.length).toBeGreaterThanOrEqual(2);
  });

  test('detectStructure - tam yapı analizi çalışır', () => {
    const combined = TABLE_TEXT + HEADING_TEXT + REFERENCE_TEXT;
    const structure = detectStructure(combined);
    expect(structure).toBeDefined();
    expect(structure.tables).toBeDefined();
    expect(structure.headings).toBeDefined();
  });

  test('detectStructure - dipnotlu tabloyu tanır', () => {
    const structure = detectStructure(TABLE_WITH_FOOTNOTE);
    expect(structure).toBeDefined();
    expect(structure.tables.length).toBeGreaterThanOrEqual(1);
    expect(structure.footnotes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Chunking', () => {
  test('chunkTextWithStructure - metni parçalar', () => {
    const structure = detectStructure(LONG_TABLE_TEXT);
    const chunks = chunkTextWithStructure(LONG_TABLE_TEXT, structure, {
      preserveTables: true,
      preserveHeadingContent: true,
    });
    expect(chunks).toBeDefined();
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  test('validateCharacterCount - karakter kaybı kontrolü (P0-05)', () => {
    const structure = detectStructure(LONG_TABLE_TEXT);
    const chunks = chunkTextWithStructure(LONG_TABLE_TEXT, structure, {
      preserveTables: true,
    });
    const validation = validateCharacterCount(LONG_TABLE_TEXT, chunks);
    expect(validation).toBeDefined();
    // Karakter farkı orijinal metnin %5'inden az olmalı
    const maxAllowedDifference = Math.max(50, LONG_TABLE_TEXT.length * 0.05);
    expect(validation.difference).toBeLessThan(maxAllowedDifference);
  });
});

describe('P0 Controls', () => {
  test('checkTableIntegrity - tablo bütünlüğü kontrolü (P0-01)', () => {
    const structure = detectStructure(LONG_TABLE_TEXT);
    const chunks = chunkTextWithStructure(LONG_TABLE_TEXT, structure, {
      preserveTables: true,
      preserveHeadingContent: true,
    });
    const integrity = checkTableIntegrity(chunks, structure);
    expect(integrity).toBeDefined();
    expect(integrity.passed).toBe(true);
  });

  test('checkHeadingContentUnity - başlık-içerik birlikteliği (P0-03)', () => {
    const structure = detectStructure(LONG_TABLE_TEXT);
    const chunks = chunkTextWithStructure(LONG_TABLE_TEXT, structure, {
      preserveTables: true,
      preserveHeadingContent: true,
    });
    const result = checkHeadingContentUnity(chunks, structure, 100);
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
  });

  test('ensureValidJson - geçerli JSON kontrol (P0-06)', () => {
    const validJson = '{"dates": [], "found": true}';
    const validCheck = ensureValidJson(validJson, 'test');
    expect(validCheck).toBeDefined();
    expect(validCheck.passed).toBe(true);
  });

  test('ensureValidJson - geçersiz JSON tespiti (P0-06)', () => {
    const invalidJson = 'Bu JSON değil { açık parantez';
    const invalidCheck = ensureValidJson(invalidJson, 'test');
    expect(invalidCheck).toBeDefined();
    expect(invalidCheck.passed).toBe(false);
  });

  test('checkNullVsEmpty - null/empty ayrımı (P0-07)', () => {
    const nullResult = { penalties: null };
    const emptyResult = { penalties: [] };
    const filledResult = { penalties: [{ type: 'gecikme' }] };

    const nullCheck = checkNullVsEmpty(nullResult, 'penalties');
    const emptyCheck = checkNullVsEmpty(emptyResult, 'penalties');
    const filledCheck = checkNullVsEmpty(filledResult, 'penalties');

    expect(nullCheck).toBeDefined();
    expect(emptyCheck).toBeDefined();
    expect(filledCheck).toBeDefined();

    // null ve empty farklı value_type'lar
    expect(nullCheck.details.value_type).not.toBe(filledCheck.details.value_type);
  });
});

describe('Conflict Detection', () => {
  const chunkResults = [
    {
      chunk_id: 'chunk_0',
      chunkIndex: 0,
      extractedData: {
        dates: [{ value: '01.06.2025', type: 'baslangic', context: 'Chunk 0', confidence: 1.0 }],
        amounts: [{ value: '1.000.000,00', type: 'yaklasik_maliyet', context: 'Chunk 0', confidence: 1.0 }],
      },
    },
    {
      chunk_id: 'chunk_1',
      chunkIndex: 1,
      extractedData: {
        dates: [
          { value: '15.06.2025', type: 'baslangic', context: 'Chunk 1', confidence: 0.9 },
        ],
        amounts: [
          { value: '1.000.000,00', type: 'yaklasik_maliyet', context: 'Chunk 1', confidence: 0.8 },
        ],
      },
    },
  ];

  test('detectConflicts - çelişkili tarihleri tespit eder', () => {
    const conflicts = detectConflicts(chunkResults);
    expect(conflicts).toBeDefined();
    expect(Array.isArray(conflicts)).toBe(true);

    // Aynı tip (baslangic) farklı değer → field = "dates.baslangic"
    const dateConflict = conflicts.find((c) => c.field && c.field.startsWith('dates'));
    expect(dateConflict).toBeDefined();
  });

  test('detectConflicts - aynı değerleri çelişki saymaz', () => {
    const conflicts = detectConflicts(chunkResults);
    // yaklasik_maliyet her iki chunk'ta aynı değer → çelişki olmamalı
    const amountConflicts = conflicts.filter(
      (c) => c.field && c.field.startsWith('amounts'),
    );
    expect(amountConflicts.length).toBe(0);
  });
});

describe('Assembly', () => {
  const chunkResults = [
    {
      chunk_id: 'chunk_0',
      chunkIndex: 0,
      extractedData: {
        dates: [{ value: '01.06.2025', type: 'baslangic', context: 'Chunk 0', confidence: 1.0 }],
        amounts: [{ value: '1.000.000,00', type: 'yaklasik_maliyet', context: 'Chunk 0', confidence: 1.0 }],
      },
    },
    {
      chunk_id: 'chunk_1',
      chunkIndex: 1,
      extractedData: {
        dates: [{ value: '15.06.2025', type: 'baslangic', context: 'Chunk 1', confidence: 0.9 }],
        amounts: [{ value: '1.000.000,00', type: 'yaklasik_maliyet', context: 'Chunk 1', confidence: 0.8 }],
      },
    },
  ];

  const conflicts = detectConflicts(chunkResults);

  test('assembleResults - chunk sonuçlarını birleştirir', () => {
    const assembled = assembleResults(chunkResults, conflicts);
    expect(assembled).toBeDefined();
    expect(assembled.fields).toBeDefined();
    expect(assembled.fields.dates).toBeDefined();
    expect(assembled.fields.amounts).toBeDefined();
  });

  test('validateNoNewInformation - yeni bilgi kontrolü (P0-08)', () => {
    const assembled = assembleResults(chunkResults, conflicts);
    const noNewInfo = validateNoNewInformation(chunkResults, assembled);
    expect(noNewInfo).toBeDefined();
    expect(noNewInfo.valid).toBe(true);
  });
});

describe('Validation', () => {
  test('calculateCompleteness - tamlık skoru hesaplar', () => {
    const mockResult = {
      fields: {
        dates: [
          { value: '01.06.2025', type: 'ihale_tarihi' },
          { value: '15.06.2025', type: 'baslangic' },
        ],
        amounts: [
          { value: '1.000.000,00', type: 'yaklasik_maliyet' },
          { value: '25,50', type: 'birim_fiyat' },
        ],
        penalties: [{ type: 'gecikme', rate: '%2' }],
        menus: { meals: [{ type: 'ogle', daily_count: 500 }], gramaj: [] },
        personnel: { staff: [{ position: 'asci', count: 3 }] },
      },
    };

    const completeness = calculateCompleteness(mockResult);
    expect(completeness).toBeDefined();
    expect(typeof completeness.score).toBe('number');
    expect(completeness.score).toBeGreaterThan(0);
    expect(completeness.score).toBeLessThanOrEqual(100);
  });

  test('calculateCompleteness - boş sonuçta düşük skor', () => {
    const emptyResult = { fields: {} };
    const completeness = calculateCompleteness(emptyResult);
    expect(completeness).toBeDefined();
    expect(completeness.score).toBeLessThan(50);
  });
});
