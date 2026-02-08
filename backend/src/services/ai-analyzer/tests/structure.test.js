/**
 * Structure Detection Unit Tests
 * Layer 1: Rule-based yapı tespiti
 */

import { describe, test, expect } from 'vitest';
import {
  detectHeadings,
  detectTables,
  detectLists,
  detectFootnotes,
  detectReferences,
  detectStructure,
  findContainingStructure,
  findNearestHeading,
  resolveReferences,
} from '../pipeline/structure.js';

// ==================== TEST VERİLERİ ====================

const PIPE_TABLE = `
| Kalem   | Miktar | Birim | Fiyat   |
|---------|--------|-------|---------|
| Et      | 150    | gram  | 45,00   |
| Tavuk   | 120    | gram  | 35,00   |
`;

const TAB_TABLE = `Kalem\tMiktar\tFiyat
Et\t150\t45.00
Tavuk\t120\t35.00`;

const MADDE_HEADINGS = `
MADDE 1 - İhalenin Konusu
Bu ihale catering hizmet alımıdır.

MADDE 2 - İhale Şartları
Yüklenici aşağıdaki şartları sağlamalıdır.

Madde 3: Teknik Gereksinimler
Hizmet kalitesi standartları.
`;

const BOLUM_HEADINGS = `
BÖLÜM I - GENEL HÜKÜMLER
Bu bölümde genel hükümler yer alır.

BÖLÜM II - TEKNİK ŞARTLAR
Teknik gereksinimler aşağıda belirtilmiştir.

Bölüm III - MALİ HÜKÜMLER
Mali konular burada düzenlenir.
`;

const NUMBERED_HEADINGS = `
1.1 Alt Başlık Birinci Kısım
İçerik buradadır.

1.1.1 Detaylı Alt Kısım Numarası
Daha detaylı içerik.

1.1.1.1 Çok derin seviye

2.1 İkinci Bölüm Alt Başlık
Başka bir içerik.
`;

const FOOTNOTE_TEXT = `
Fiyatlar belirtilmiştir.
(*) KDV hariç fiyatlardır.
(1) Fiyatlar 2025 yılı için geçerlidir.
[2] Nakliye bedeli dahildir.
`;

const REFERENCE_TEXT = `
Bu konuda Madde 8'e bakınız.
Ayrıca yukarıdaki 12.3 maddede belirtildiği gibi.
Detaylar için Bölüm III'e göre hareket edilecektir.
Ek-2'de yer alan listeler dikkate alınacaktır.
`;

const LIST_TEXT = `
1. Birinci madde
2. İkinci madde
3. Üçüncü madde

a) Alt madde bir
b) Alt madde iki
c) Alt madde üç
`;

// ==================== TESTLER ====================

describe('detectTables', () => {
  test('pipe tablolarını tespit eder', () => {
    const tables = detectTables(PIPE_TABLE);
    expect(tables.length).toBeGreaterThanOrEqual(1);
    expect(tables[0].type).toBe('pipe');
    expect(tables[0].rowCount).toBeGreaterThanOrEqual(2);
  });

  test('tab-delimited tablolari tespit eder', () => {
    const tables = detectTables(TAB_TABLE);
    expect(tables.length).toBeGreaterThanOrEqual(1);
    expect(tables[0].type).toBe('tab');
  });

  test('boş metin için boş array döner', () => {
    const tables = detectTables('');
    expect(tables).toEqual([]);
  });

  test('tablo olmayan metin için boş array döner', () => {
    const tables = detectTables('Bu bir paragraf metnidir. Tablo yoktur.');
    expect(tables).toEqual([]);
  });

  test('tablo pozisyon bilgisi doğru', () => {
    const tables = detectTables(PIPE_TABLE);
    if (tables.length > 0) {
      expect(tables[0]).toHaveProperty('startPosition');
      expect(tables[0]).toHaveProperty('endPosition');
      expect(tables[0].endPosition).toBeGreaterThan(tables[0].startPosition);
    }
  });
});

describe('detectHeadings', () => {
  test('MADDE formatını tespit eder', () => {
    const headings = detectHeadings(MADDE_HEADINGS);
    const maddeHeadings = headings.filter((h) => h.type === 'madde');
    expect(maddeHeadings.length).toBeGreaterThanOrEqual(2);
  });

  test('BÖLÜM formatını tespit eder', () => {
    const headings = detectHeadings(BOLUM_HEADINGS);
    const bolumHeadings = headings.filter((h) => h.type === 'bolum');
    expect(bolumHeadings.length).toBeGreaterThanOrEqual(2);
  });

  test('numaralı alt başlıkları tespit eder', () => {
    const headings = detectHeadings(NUMBERED_HEADINGS);
    expect(headings.length).toBeGreaterThanOrEqual(2);
    // Derin seviye başlık
    const deepHeading = headings.find((h) => h.level >= 3);
    expect(deepHeading).toBeDefined();
  });

  test('heading level bilgisi doğru', () => {
    const headings = detectHeadings(MADDE_HEADINGS);
    for (const heading of headings) {
      expect(heading.level).toBeGreaterThanOrEqual(1);
      expect(heading.level).toBeLessThanOrEqual(4);
    }
  });

  test('boş metin için boş array döner', () => {
    expect(detectHeadings('')).toEqual([]);
  });
});

describe('detectFootnotes', () => {
  test('dipnotları tespit eder', () => {
    const footnotes = detectFootnotes(FOOTNOTE_TEXT);
    // (*) formatı tespit edilir, (1) ve [2] formatı ise fonksiyonun kapsamına bağlı
    expect(footnotes.length).toBeGreaterThanOrEqual(1);
  });

  test('dipnot marker ve content bilgisi var', () => {
    const footnotes = detectFootnotes(FOOTNOTE_TEXT);
    for (const fn of footnotes) {
      expect(fn).toHaveProperty('marker');
      expect(fn).toHaveProperty('content');
    }
  });
});

describe('detectReferences', () => {
  test('çapraz referansları tespit eder', () => {
    const refs = detectReferences(REFERENCE_TEXT);
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });

  test('referans bilgileri doğru', () => {
    const refs = detectReferences(REFERENCE_TEXT);
    for (const ref of refs) {
      expect(ref).toHaveProperty('fullMatch');
      expect(ref).toHaveProperty('position');
    }
  });
});

describe('detectLists', () => {
  test('numaralı listeleri tespit eder', () => {
    const lists = detectLists(LIST_TEXT);
    expect(lists.length).toBeGreaterThanOrEqual(1);
  });
});

describe('detectStructure', () => {
  test('tam yapı analizi çalışır', () => {
    const fullText = PIPE_TABLE + '\n' + MADDE_HEADINGS + '\n' + FOOTNOTE_TEXT;
    const structure = detectStructure(fullText);

    expect(structure).toHaveProperty('tables');
    expect(structure).toHaveProperty('headings');
    expect(structure).toHaveProperty('lists');
    expect(structure).toHaveProperty('footnotes');
    expect(structure).toHaveProperty('references');
    expect(structure).toHaveProperty('stats');
    expect(structure.stats.totalLength).toBe(fullText.length);
  });

  test('stats doğru hesaplanır', () => {
    const structure = detectStructure(PIPE_TABLE);
    expect(structure.stats.tableCount).toBeGreaterThanOrEqual(1);
    expect(structure.stats.lineCount).toBeGreaterThan(0);
  });
});

describe('findContainingStructure', () => {
  test('tablo içindeki pozisyonu bulur', () => {
    const structure = detectStructure(PIPE_TABLE);
    if (structure.tables.length > 0) {
      const midPos = Math.floor((structure.tables[0].startPosition + structure.tables[0].endPosition) / 2);
      const result = findContainingStructure(midPos, structure);
      expect(result).not.toBeNull();
      expect(result.type).toBe('table');
    }
  });

  test('yapı dışı pozisyon için null döner', () => {
    const structure = detectStructure('Normal metin');
    const result = findContainingStructure(0, structure);
    expect(result).toBeNull();
  });
});

describe('findNearestHeading', () => {
  test('en yakın başlığı bulur', () => {
    const headings = detectHeadings(MADDE_HEADINGS);
    if (headings.length >= 2) {
      const nearEnd = headings[headings.length - 1].position + 50;
      const nearest = findNearestHeading(nearEnd, headings);
      expect(nearest).toBeDefined();
    }
  });

  test('boş başlık listesi için null döner', () => {
    const result = findNearestHeading(100, []);
    expect(result).toBeNull();
  });
});

describe('resolveReferences', () => {
  test('referansları çözer', () => {
    const refs = detectReferences(REFERENCE_TEXT);
    const headings = detectHeadings(MADDE_HEADINGS);
    const result = resolveReferences(refs, headings, REFERENCE_TEXT + '\n' + MADDE_HEADINGS);

    expect(result).toHaveProperty('resolved');
    expect(result).toHaveProperty('unresolved');
    expect(result).toHaveProperty('stats');
    expect(result.stats.total_references).toBe(refs.length);
  });
});
