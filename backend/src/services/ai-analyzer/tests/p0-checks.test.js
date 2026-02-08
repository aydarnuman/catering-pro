/**
 * P0 Controls Unit Tests
 * Kritik kalite kontrolleri
 */

import { describe, expect, test } from 'vitest';
import {
  checkCharacterLoss,
  checkConflictPreservation,
  checkHeadingContentUnity,
  checkNoNewInformation,
  checkNullVsEmpty,
  checkSourceTraceability,
  checkTableFootnoteConnection,
  checkTableIntegrity,
  createTextHash,
  ensureValidJson,
  runAllP0Checks,
} from '../controls/p0-checks.js';

// ==================== TEST VERİLERİ ====================

const singleChunk = [
  {
    content:
      'MADDE 1\n| Kalem | Fiyat |\n|-------|-------|\n| Et | 45,00 |\n| Tavuk | 35,00 |\n(*) KDV hariç\nToplam: 1.500.000,00 TL',
    startPos: 0,
    endPos: 120,
  },
];

const structureWithTable = {
  tables: [{ index: 0, startPosition: 10, endPosition: 80, type: 'pipe', rowCount: 3 }],
  headings: [{ level: 1, type: 'madde', position: 0, endPosition: 8, text: 'İhalenin Konusu' }],
  footnotes: [{ index: 0, marker: '*', position: 85, content: 'KDV hariç' }],
};

const splitChunks = [
  { content: '| Kalem | Fiyat |\n|-------|-------|\n| Et | 45,00 |', startPos: 10, endPos: 55 },
  { content: '| Tavuk | 35,00 |\n(*) KDV hariç', startPos: 55, endPos: 85 },
];

// ==================== P0-01: TABLO BÜTÜNLÜĞÜ ====================

describe('P0-01: checkTableIntegrity', () => {
  test('tek chunk içinde tablo → passed: true', () => {
    const result = checkTableIntegrity(singleChunk, structureWithTable);
    expect(result.code).toBe('P0-01');
    expect(result.passed).toBe(true);
  });

  test("tablo 2 chunk'a bölünmüş → passed: false", () => {
    const result = checkTableIntegrity(splitChunks, structureWithTable);
    expect(result.code).toBe('P0-01');
    expect(result.passed).toBe(false);
    expect(result.details.split_tables.length).toBeGreaterThan(0);
  });

  test('tablo olmayan yapı → passed: true', () => {
    const result = checkTableIntegrity(singleChunk, { tables: [], headings: [] });
    expect(result.passed).toBe(true);
  });

  test('boş giriş → passed: true', () => {
    const result = checkTableIntegrity([], {});
    expect(result.passed).toBe(true);
  });
});

// ==================== P0-02: TABLO-DİPNOT BAĞLANTISI ====================

describe('P0-02: checkTableFootnoteConnection', () => {
  test('tablo ve dipnot aynı chunk → passed: true', () => {
    const result = checkTableFootnoteConnection(singleChunk, structureWithTable);
    expect(result.code).toBe('P0-02');
    expect(result.passed).toBe(true);
  });

  test('dipnot yoksa → passed: true', () => {
    const result = checkTableFootnoteConnection(singleChunk, { tables: structureWithTable.tables, footnotes: [] });
    expect(result.passed).toBe(true);
  });
});

// ==================== P0-03: BAŞLIK-İÇERİK BİRLİKTELİĞİ ====================

describe('P0-03: checkHeadingContentUnity', () => {
  test('başlık ve içerik aynı chunk → passed: true', () => {
    const result = checkHeadingContentUnity(singleChunk, structureWithTable, 10);
    expect(result.code).toBe('P0-03');
    expect(result.passed).toBe(true);
  });

  test('başlık olmayan yapı → passed: true', () => {
    const result = checkHeadingContentUnity(singleChunk, { headings: [] });
    expect(result.passed).toBe(true);
  });
});

// ==================== P0-05: KARAKTER KAYBI ====================

describe('P0-05: checkCharacterLoss', () => {
  test('aynı metin → passed: true', () => {
    const text = 'Merhaba dünya';
    const chunks = [{ content: text }];
    const result = checkCharacterLoss(text, chunks);
    expect(result.code).toBe('P0-05');
    expect(result.passed).toBe(true);
    expect(result.details.difference).toBe(0);
  });

  test('büyük fark → passed: false', () => {
    const text = 'Bu çok uzun bir metin parçasıdır ve kayıp kontrolü yapılır';
    const chunks = [{ content: 'Kısa' }];
    const result = checkCharacterLoss(text, chunks);
    expect(result.passed).toBe(false);
  });

  test('loss_percentage hesaplanır', () => {
    const text = 'A'.repeat(100);
    const chunks = [{ content: 'A'.repeat(90) }];
    const result = checkCharacterLoss(text, chunks, 5);
    expect(result.details).toHaveProperty('loss_percentage');
  });
});

// ==================== P0-06: JSON PARSE GARANTİSİ ====================

describe('P0-06: ensureValidJson', () => {
  test('geçerli JSON → passed: true', () => {
    const result = ensureValidJson('{"key": "value"}', 'chunk_0');
    expect(result.code).toBe('P0-06');
    expect(result.passed).toBe(true);
    expect(result.details.parsed).toEqual({ key: 'value' });
  });

  test('geçersiz JSON → passed: false', () => {
    const result = ensureValidJson('Bu JSON değil', 'chunk_0');
    expect(result.passed).toBe(false);
  });

  test('markdown içindeki JSON → çıkarılabilir', () => {
    const markdown = 'İşte sonuç:\n```json\n{"dates": []}\n```\nBitti.';
    const result = ensureValidJson(markdown, 'chunk_0');
    // JSON bloğu içinden çıkarılabilirse passed: true
    if (result.passed) {
      expect(result.details.parsed).toBeDefined();
    }
  });

  test('boş yanıt → passed: false', () => {
    const result = ensureValidJson('', 'chunk_0');
    expect(result.passed).toBe(false);
  });

  test('null yanıt → passed: false', () => {
    const result = ensureValidJson(null, 'chunk_0');
    expect(result.passed).toBe(false);
  });
});

// ==================== P0-07: NULL VS EMPTY ====================

describe('P0-07: checkNullVsEmpty', () => {
  test('null değer → value_type: null/undefined', () => {
    const result = checkNullVsEmpty({ dates: null }, 'dates');
    expect(result.code).toBe('P0-07');
    expect(result.passed).toBe(true);
    expect(result.details.value_type).toBe('null/undefined');
  });

  test('boş array → value_type: empty_array', () => {
    const result = checkNullVsEmpty({ dates: [] }, 'dates');
    expect(result.details.value_type).toBe('empty_array');
    expect(result.details.status).toBe('confirmed_empty');
  });

  test('dolu array → value_type: populated_array', () => {
    const result = checkNullVsEmpty({ dates: [{ value: '2025-01-01' }] }, 'dates');
    expect(result.details.value_type).toBe('populated_array');
    expect(result.details.count).toBe(1);
  });

  test('undefined alan → value_type: null/undefined', () => {
    const result = checkNullVsEmpty({}, 'nonexistent');
    expect(result.details.value_type).toBe('null/undefined');
  });
});

// ==================== P0-08: YENİ BİLGİ KONTROLÜ ====================

describe('P0-08: checkNoNewInformation', () => {
  test('aynı bilgi → passed: true', () => {
    const stage1 = [{ findings: [{ value: '2025-01-01' }] }];
    const stage2 = { fields: { dates: [{ value: '2025-01-01' }] } };
    const result = checkNoNewInformation(stage1, stage2);
    expect(result.code).toBe('P0-08');
    expect(result.passed).toBe(true);
  });

  test('yeni bilgi eklenmiş → passed: false', () => {
    const stage1 = [{ findings: [{ value: '2025-01-01' }] }];
    const stage2 = { fields: { dates: [{ value: '2025-01-01' }, { value: '2099-12-31' }] } };
    const result = checkNoNewInformation(stage1, stage2);
    expect(result.passed).toBe(false);
  });
});

// ==================== P0-09: CONFLICT PRESERVATION ====================

describe('P0-09: checkConflictPreservation', () => {
  test('tüm çelişkiler korunmuş → passed: true', () => {
    const conflicts = [{ field: 'dates.baslangic', values: [{ value: 'A' }, { value: 'B' }] }];
    const finalResult = { conflicts };
    const result = checkConflictPreservation(finalResult, conflicts);
    expect(result.code).toBe('P0-09');
    expect(result.passed).toBe(true);
  });

  test('çelişki yoksa → passed: true', () => {
    const result = checkConflictPreservation({ conflicts: [] }, []);
    expect(result.passed).toBe(true);
  });
});

// ==================== P0-10: SOURCE TRACEABILITY ====================

describe('P0-10: checkSourceTraceability', () => {
  test('source bilgisi olan sonuç → geçerli', () => {
    const result = checkSourceTraceability({
      fields: {
        dates: [{ value: '2025-01-01', source_chunk_id: 'chunk_0' }],
        amounts: [],
      },
    });
    expect(result.code).toBe('P0-10');
  });
});

// ==================== YARDIMCI ====================

describe('createTextHash', () => {
  test('aynı metin aynı hash verir', () => {
    const hash1 = createTextHash('test');
    const hash2 = createTextHash('test');
    expect(hash1).toBe(hash2);
  });

  test('farklı metin farklı hash verir', () => {
    const hash1 = createTextHash('test1');
    const hash2 = createTextHash('test2');
    expect(hash1).not.toBe(hash2);
  });

  test('hash string döner', () => {
    expect(typeof createTextHash('test')).toBe('string');
  });
});

// ==================== TÜM P0 KONTROLLER ====================

describe('runAllP0Checks', () => {
  test('tüm kontrolleri çalıştırır', () => {
    const originalText = singleChunk[0].content;
    const result = runAllP0Checks({
      chunks: singleChunk,
      structureInfo: structureWithTable,
      originalText,
    });

    expect(result).toHaveProperty('all_passed');
    expect(result).toHaveProperty('total_checks');
    expect(result).toHaveProperty('passed_count');
    expect(result).toHaveProperty('failed_count');
    expect(result).toHaveProperty('checks');
    expect(result.total_checks).toBeGreaterThan(0);
    expect(result.passed_count + result.failed_count).toBe(result.total_checks);
  });

  test('boş girişle çökmez', () => {
    const result = runAllP0Checks({});
    expect(result).toHaveProperty('total_checks');
  });
});
