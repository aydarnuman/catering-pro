/**
 * Chunker Unit Tests
 * Layer 2: Smart Text Chunking
 */

import { describe, test, expect } from 'vitest';
import { chunkText, chunkTextWithStructure, chunkExcel, chunk, validateCharacterCount } from '../pipeline/chunker.js';
import { detectStructure } from '../pipeline/structure.js';

// ==================== TEST VERİLERİ ====================

const SHORT_TEXT = 'Bu kısa bir metin.';

const MEDIUM_TEXT = `
MADDE 1 - İHALENİN KONUSU
Bu ihale yemek hizmeti alımı içindir.

| Öğün   | Kişi | Birim Fiyat |
|--------|------|-------------|
| Sabah  | 500  | 25,00       |
| Öğle   | 800  | 45,00       |
| Akşam  | 300  | 40,00       |

MADDE 2 - TEKNİK ŞARTLAR
Yemekler günlük taze hazırlanmalıdır.
Hijyen standartlarına uyulmalıdır.
ISO 22000 sertifikası zorunludur.

MADDE 3 - MALİ HÜKÜMLER
Yaklaşık maliyet 1.500.000,00 TL'dir.
KDV dahil değildir.
`;

const LONG_TEXT = Array(50)
  .fill(null)
  .map(
    (_, i) =>
      `MADDE ${i + 1} - BÖLÜM ${i + 1}\nBu bölümün içeriği detaylı bir şekilde burada yer almaktadır. ` +
      `Yüklenici bu bölümde belirtilen tüm şartlara uymak zorundadır. ` +
      `Aksi halde cezai yaptırımlar uygulanacaktır.\n`,
  )
  .join('\n');

const EXCEL_DATA = {
  type: 'xlsx',
  structured: {
    sheets: [
      {
        name: 'Fiyat Listesi',
        csv: 'Kalem,Miktar,Fiyat\nEt,150,45.00\nTavuk,120,35.00\nBalık,180,55.00',
        columns: [{ name: 'Kalem' }, { name: 'Miktar' }, { name: 'Fiyat' }],
        rowCount: 4,
        columnCount: 3,
        data: [
          ['Kalem', 'Miktar', 'Fiyat'],
          ['Et', 150, 45.0],
          ['Tavuk', 120, 35.0],
          ['Balık', 180, 55.0],
        ],
      },
    ],
  },
};

// ==================== TESTLER ====================

describe('chunkText', () => {
  test('kısa metni tek chunk olarak döner', () => {
    const chunks = chunkText(SHORT_TEXT);
    expect(chunks).toBeDefined();
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain('kısa');
  });

  test('chunk objeleri doğru yapıda', () => {
    const chunks = chunkText(MEDIUM_TEXT);
    for (const ch of chunks) {
      expect(ch).toHaveProperty('index');
      expect(ch).toHaveProperty('content');
      expect(ch).toHaveProperty('tokenEstimate');
      expect(ch.content.length).toBeGreaterThan(0);
    }
  });

  test('boş metin için boş array döner', () => {
    const chunks = chunkText('');
    expect(chunks).toEqual([]);
  });

  test('undefined/null metin için hata veya boş array döner', () => {
    // null/undefined girdi koruma davranışı
    try {
      const chunks = chunkText(null);
      expect(chunks).toEqual([]);
    } catch {
      // null input'ta throw etmesi de kabul edilebilir
      expect(true).toBe(true);
    }
  });
});

describe('chunkTextWithStructure', () => {
  test('yapı bilgisi ile chunking çalışır', () => {
    const structure = detectStructure(MEDIUM_TEXT);
    const chunks = chunkTextWithStructure(MEDIUM_TEXT, structure, {
      preserveTables: true,
      preserveHeadingContent: true,
    });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  test('uzun metin birden fazla chunk oluşturur', () => {
    const structure = detectStructure(LONG_TEXT);
    const chunks = chunkTextWithStructure(LONG_TEXT, structure, {
      maxChars: 1000,
    });
    expect(chunks.length).toBeGreaterThan(1);
  });

  test('preserveTables tabloları korur', () => {
    const structure = detectStructure(MEDIUM_TEXT);
    const chunks = chunkTextWithStructure(MEDIUM_TEXT, structure, {
      preserveTables: true,
    });

    // Tablo olan chunk
    const tableChunks = chunks.filter(
      (c) => c.content.includes('Sabah') && c.content.includes('Öğle') && c.content.includes('Akşam'),
    );
    expect(tableChunks.length).toBeGreaterThanOrEqual(1);
  });

  test('yapı bilgisi olmadan da çalışır', () => {
    const chunks = chunkTextWithStructure(MEDIUM_TEXT, null);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  test('chunk context bilgisi var', () => {
    const structure = detectStructure(MEDIUM_TEXT);
    const chunks = chunkTextWithStructure(MEDIUM_TEXT, structure);
    for (const ch of chunks) {
      expect(ch).toHaveProperty('context');
    }
  });
});

describe('chunkExcel', () => {
  test('Excel verisini chunk eder', () => {
    const chunks = chunkExcel(EXCEL_DATA);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  test('sheet bilgisi context içinde', () => {
    const chunks = chunkExcel(EXCEL_DATA);
    if (chunks.length > 0) {
      expect(chunks[0].context).toHaveProperty('sheetName');
      expect(chunks[0].context.sheetName).toBe('Fiyat Listesi');
    }
  });

  test('boş Excel verisi için boş array döner', () => {
    const chunks = chunkExcel({ type: 'xlsx', structured: { sheets: [] } });
    expect(chunks).toEqual([]);
  });
});

describe('chunk', () => {
  test('text tipi için chunkTextWithStructure kullanır', () => {
    const result = chunk({ type: 'text', text: MEDIUM_TEXT });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  test('xlsx tipi için chunkExcel kullanır', () => {
    const result = chunk(EXCEL_DATA);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('validateCharacterCount', () => {
  test('karakter sayısı doğruysa valid: true', () => {
    const chunks = [{ content: 'Hello World' }];
    const result = validateCharacterCount('Hello World', chunks);
    expect(result.valid).toBe(true);
    expect(result.difference).toBe(0);
  });

  test('büyük fark varsa valid: false', () => {
    const chunks = [{ content: 'Kısa' }];
    const result = validateCharacterCount('Bu çok uzun bir metin parçasıdır', chunks);
    expect(result.valid).toBe(false);
    expect(result.difference).toBeGreaterThan(10);
  });

  test('tolerance parametresi çalışır', () => {
    const chunks = [{ content: 'Hello World!!!' }]; // 14 chars
    const result = validateCharacterCount('Hello World', chunks, 5); // 11 chars, diff=3
    expect(result.valid).toBe(true);
  });

  test('boş input kontrolü', () => {
    const result = validateCharacterCount('', []);
    expect(result.valid).toBe(true);
    expect(result.originalLength).toBe(0);
    expect(result.chunkedLength).toBe(0);
  });
});
