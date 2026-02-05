/**
 * Zero-Loss Pipeline Test Suite
 *
 * Edge case testleri:
 * - Çok sayfalı tablo
 * - İç içe maddeler (12.3.4.a.ii)
 * - Dipnotlu fiyat tablosu
 * - Çapraz referans ("Madde 8'e bakınız")
 * - Çelişkili değerler
 */

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

// ==================== TEST HELPERS ====================

function _createTestChunk(index, content, type = 'text') {
  return {
    index,
    content,
    type,
    tokenEstimate: content.length / 1.5,
    startPos: 0,
    endPos: content.length,
    context: { heading: '', position: 'middle' },
  };
}

function _createTestChunkResult(index, extractionType, findings = []) {
  return {
    chunk_id: `chunk_${index}`,
    chunkIndex: index,
    extractionType,
    findings,
    extractedData: { dates: findings.filter((f) => f.type?.startsWith('date')) },
    error: null,
  };
}

// Test 1: Tablo Tespiti
const tableText = `
Bu bir giriş paragrafıdır.

| Kalem | Miktar | Birim | Fiyat |
|-------|--------|-------|-------|
| Et    | 150    | gram  | 45,00 |
| Tavuk | 120    | gram  | 35,00 |
| Balık | 180    | gram  | 55,00 |

Bu tablodan sonra gelen metin.
`;

const _tables = detectTables(tableText);

// Test 2: Başlık Tespiti
const headingText = `
MADDE 1 - KONU

Bu maddenin içeriği.

1.1 Alt Başlık

Alt başlık içeriği.

1.1.1 Alt Alt Başlık

Daha derin içerik.

BÖLÜM II - TEKNİK ŞARTLAR

Bölüm içeriği.
`;

const headings = detectHeadings(headingText);
headings.forEach((_h) => {});

// Test 3: Çapraz Referans Tespiti
const referenceText = `
Bu konuda Madde 8'e bakınız.
Ayrıca yukarıdaki 12.3 maddede belirtildiği gibi işlem yapılacaktır.
Detaylar için Bölüm III'e göre hareket edilecektir.
Ek-2'de yer alan listeler dikkate alınacaktır.
`;

const references = detectReferences(referenceText);
references.forEach((_r) => {});

// Test 4: Tam Yapı Tespiti
const _fullStructure = detectStructure(tableText + headingText + referenceText);

// Test 5: P0-01 - Tablo Bölünme Kontrolü
const longTableText = `
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

const structureForChunk = detectStructure(longTableText);
const chunksWithStructure = chunkTextWithStructure(longTableText, structureForChunk, {
  preserveTables: true,
  preserveHeadingContent: true,
});

const _tableIntegrity = checkTableIntegrity(chunksWithStructure, structureForChunk);

// Test 6: P0-05 - Karakter Kaybı Kontrolü
const _charValidation = validateCharacterCount(longTableText, chunksWithStructure);

// Test 7: P0-03 - Başlık-İçerik Birlikteliği
const _headingIntegrity = checkHeadingContentUnity(chunksWithStructure, structureForChunk, 100);

// Test 8: Çelişki Tespiti
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
        { value: '15.06.2025', type: 'baslangic', context: 'Chunk 1', confidence: 0.9 }, // ÇELIŞKI!
      ],
      amounts: [
        { value: '1.000.000,00', type: 'yaklasik_maliyet', context: 'Chunk 1', confidence: 0.8 }, // AYNI
      ],
    },
  },
];

const conflicts = detectConflicts(chunkResults);
conflicts.forEach((_c) => {});

// Test 9: Sonuç Birleştirme
const assembled = assembleResults(chunkResults, conflicts);

// Test 10: P0-08 - Yeni Bilgi Kontrolü
const _noNewInfo = validateNoNewInformation(chunkResults, assembled);

// Test 11: Tamlık Skoru
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

const _completeness = calculateCompleteness(mockResult);

// Test 12: P0-06 - JSON Parse Kontrolü
const validJson = '{"dates": [], "found": true}';
const invalidJson = 'Bu JSON değil { açık parantez';

const _validCheck = ensureValidJson(validJson, 'test');
const _invalidCheck = ensureValidJson(invalidJson, 'test');

// Test 13: P0-07 - Null vs Empty Kontrolü
const nullResult = { penalties: null };
const emptyResult = { penalties: [] };
const filledResult = { penalties: [{ type: 'gecikme' }] };

const _nullCheck = checkNullVsEmpty(nullResult, 'penalties');
const _emptyCheck = checkNullVsEmpty(emptyResult, 'penalties');
const _filledCheck = checkNullVsEmpty(filledResult, 'penalties');

// Test 14: İç içe maddeler
const nestedHeadingText = `
MADDE 12 - CEZA KOŞULLARI

12.1 Genel Hükümler
12.1.1 Gecikme Cezası
12.1.1.a İlk Hafta
12.1.1.b İkinci Hafta
12.1.2 Kalite Cezası
12.2 Özel Hükümler
`;

const nestedHeadings = detectHeadings(nestedHeadingText);
const _hasDeepNesting = nestedHeadings.some((h) => h.level >= 3);

// Test 15: Dipnotlu tablo
const tableWithFootnote = `
| Kalem | Fiyat (*) |
|-------|-----------|
| Et    | 45,00     |

(*) KDV hariç fiyatlardır.
(1) Fiyatlar 2025 yılı için geçerlidir.
`;

const _footnotedStructure = detectStructure(tableWithFootnote);
