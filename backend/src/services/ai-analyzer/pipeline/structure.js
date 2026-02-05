/**
 * Layer 1: Structure Detection - Rule-based Yapı Tespiti
 *
 * Regex ve heuristic ile yapı tespiti (LLM KULLANILMAZ)
 * - Tablo tespiti (CSV, pipe-delimited, tab-delimited)
 * - Başlık tespiti (Madde X.Y.Z, BÖLÜM I, vs.)
 * - Liste tespiti (numaralı, madde işaretli)
 * - Dipnot tespiti ((*), (1), [1], vs.)
 */

import logger from '../../../utils/logger.js';

/**
 * Yapı bilgisi
 * @typedef {Object} StructureInfo
 * @property {Array} tables - Tespit edilen tablolar
 * @property {Array} headings - Tespit edilen başlıklar
 * @property {Array} lists - Tespit edilen listeler
 * @property {Array} footnotes - Tespit edilen dipnotlar
 * @property {Array} references - Tespit edilen çapraz referanslar
 */

// ==================== BAŞLIK TESPİTİ ====================

/**
 * Başlık pattern'leri (Türk ihale dökümanları için optimize edilmiş)
 */
const HEADING_PATTERNS = [
  // MADDE formatları
  { pattern: /^MADDE\s+(\d+)\s*[-–:.]?\s*(.*)$/gim, level: 1, type: 'madde' },
  { pattern: /^Madde\s+(\d+)\s*[-–:.]?\s*(.*)$/gim, level: 1, type: 'madde' },

  // BÖLÜM formatları
  { pattern: /^BÖLÜM\s+([IVX\d]+)\s*[-–:.]?\s*(.*)$/gim, level: 1, type: 'bolum' },
  { pattern: /^Bölüm\s+([IVX\d]+)\s*[-–:.]?\s*(.*)$/gim, level: 1, type: 'bolum' },

  // Numaralı başlıklar (1. 2. 3.)
  { pattern: /^(\d+)\.\s+([A-ZİĞÜŞÖÇ][^.\n]{5,80})$/gim, level: 1, type: 'numbered' },

  // Alt numaralı başlıklar (1.1 1.2 1.1.1)
  { pattern: /^(\d+\.\d+)\.\s*([A-ZİĞÜŞÖÇa-zığüşöç][^.\n]{5,80})$/gim, level: 2, type: 'subnumbered' },
  { pattern: /^(\d+\.\d+\.\d+)\s*[-–.]?\s*([A-ZİĞÜŞÖÇa-zığüşöç][^.\n]{5,80})$/gim, level: 3, type: 'subsubnumbered' },
  { pattern: /^(\d+\.\d+\.\d+\.\d+)\s*[-–.]?\s*(.*)$/gim, level: 4, type: 'deep' },

  // Roma rakamları (I. II. III.)
  { pattern: /^([IVX]+)\.\s+([A-ZİĞÜŞÖÇ][^.\n]{5,80})$/gim, level: 1, type: 'roman' },

  // Harf başlıkları (A. B. C.)
  { pattern: /^([A-Z])\.\s+([A-ZİĞÜŞÖÇ][^.\n]{5,80})$/gim, level: 2, type: 'letter' },
];

/**
 * Metinden başlıkları tespit et
 * @param {string} text - Kaynak metin
 * @returns {Array} Tespit edilen başlıklar
 */
export function detectHeadings(text) {
  const headings = [];
  const lines = text.split('\n');

  let currentPosition = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    for (const { pattern, level, type } of HEADING_PATTERNS) {
      // Pattern'ı sıfırla (global flag nedeniyle)
      pattern.lastIndex = 0;
      const match = pattern.exec(trimmedLine);

      if (match) {
        headings.push({
          level,
          type,
          number: match[1],
          text: match[2]?.trim() || trimmedLine,
          fullText: trimmedLine,
          position: currentPosition,
          lineIndex,
          endPosition: currentPosition + line.length,
        });
        break; // İlk eşleşen pattern'da dur
      }
    }

    currentPosition += line.length + 1; // +1 for \n
  }

  logger.debug('Headings detected', {
    module: 'structure',
    count: headings.length,
    types: [...new Set(headings.map((h) => h.type))],
  });

  return headings;
}

// ==================== TABLO TESPİTİ ====================

/**
 * Tablo satırı olup olmadığını kontrol et
 * @param {string} line - Satır
 * @returns {{ isTable: boolean, type: string|null, columnCount: number }}
 */
function analyzeTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return { isTable: false, type: null, columnCount: 0 };

  // Pipe-delimited tablo (| col1 | col2 | col3 |)
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  if (pipeCount >= 2) {
    return { isTable: true, type: 'pipe', columnCount: pipeCount - 1 };
  }

  // Tab-delimited tablo
  const tabCount = (trimmed.match(/\t/g) || []).length;
  if (tabCount >= 2) {
    return { isTable: true, type: 'tab', columnCount: tabCount + 1 };
  }

  // CSV tarzı (3+ virgül ve sayısal değerler içeriyor)
  const commaCount = (trimmed.match(/,/g) || []).length;
  const hasNumbers = /\d+[.,]\d+/.test(trimmed) || /\d{3,}/.test(trimmed);
  if (commaCount >= 3 && hasNumbers) {
    return { isTable: true, type: 'csv', columnCount: commaCount + 1 };
  }

  // Sabit genişlikli tablo (çoklu boşluk ayırıcı)
  const multiSpaceSegments = trimmed.split(/\s{2,}/).filter((s) => s.trim());
  if (multiSpaceSegments.length >= 3) {
    // En az bazı hücreler sayısal olmalı
    const numericCells = multiSpaceSegments.filter((s) => /[\d.,]+/.test(s));
    if (numericCells.length >= 2) {
      return { isTable: true, type: 'fixed-width', columnCount: multiSpaceSegments.length };
    }
  }

  return { isTable: false, type: null, columnCount: 0 };
}

/**
 * Metinden tabloları tespit et
 * @param {string} text - Kaynak metin
 * @returns {Array} Tespit edilen tablolar
 */
export function detectTables(text) {
  const tables = [];
  const lines = text.split('\n');

  let currentTable = null;
  let currentPosition = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const analysis = analyzeTableLine(line);

    if (analysis.isTable) {
      if (!currentTable) {
        // Yeni tablo başlıyor
        currentTable = {
          index: tables.length,
          type: analysis.type,
          startPosition: currentPosition,
          startLine: lineIndex,
          rows: [],
          columnCount: analysis.columnCount,
        };
      }

      currentTable.rows.push({
        lineIndex,
        content: line,
        columnCount: analysis.columnCount,
      });
      currentTable.columnCount = Math.max(currentTable.columnCount, analysis.columnCount);
    } else {
      // Tablo dışı satır
      if (currentTable) {
        // Tablo sona erdi
        currentTable.endPosition = currentPosition;
        currentTable.endLine = lineIndex - 1;
        currentTable.rowCount = currentTable.rows.length;

        // Minimum 2 satır olmalı tablo sayılması için
        if (currentTable.rows.length >= 2) {
          tables.push(currentTable);
        }
        currentTable = null;
      }
    }

    currentPosition += line.length + 1;
  }

  // Son tablo eğer devam ediyorsa
  if (currentTable && currentTable.rows.length >= 2) {
    currentTable.endPosition = currentPosition;
    currentTable.endLine = lines.length - 1;
    currentTable.rowCount = currentTable.rows.length;
    tables.push(currentTable);
  }

  logger.debug('Tables detected', {
    module: 'structure',
    count: tables.length,
    types: [...new Set(tables.map((t) => t.type))],
  });

  return tables;
}

// ==================== LİSTE TESPİTİ ====================

/**
 * Liste item pattern'leri
 */
const LIST_PATTERNS = [
  // Numaralı liste: 1) 2) 3) veya 1. 2. 3.
  { pattern: /^\s*(\d+)[.)]\s+(.+)$/, type: 'numbered' },

  // Harf listesi: a) b) c) veya a. b. c.
  { pattern: /^\s*([a-zğüşöçı])[.)]\s+(.+)$/i, type: 'lettered' },

  // Romen rakamı: i) ii) iii)
  { pattern: /^\s*([ivx]+)[.)]\s+(.+)$/i, type: 'roman' },

  // Madde işareti: - veya • veya *
  { pattern: /^\s*[-•*]\s+(.+)$/, type: 'bulleted' },

  // Parantezli numara: (1) (2) (3)
  { pattern: /^\s*\((\d+)\)\s+(.+)$/, type: 'parenthetical' },
];

/**
 * Metinden listeleri tespit et
 * @param {string} text - Kaynak metin
 * @returns {Array} Tespit edilen listeler
 */
export function detectLists(text) {
  const lists = [];
  const lines = text.split('\n');

  let currentList = null;
  let currentPosition = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    let matched = false;
    for (const { pattern, type } of LIST_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        if (!currentList || currentList.type !== type) {
          // Yeni liste veya farklı tip
          if (currentList && currentList.items.length >= 2) {
            currentList.endPosition = currentPosition;
            currentList.endLine = lineIndex - 1;
            lists.push(currentList);
          }

          currentList = {
            index: lists.length,
            type,
            startPosition: currentPosition,
            startLine: lineIndex,
            items: [],
          };
        }

        currentList.items.push({
          lineIndex,
          marker: match[1] || '',
          content: match[2] || match[1],
          position: currentPosition,
        });

        matched = true;
        break;
      }
    }

    if (!matched && currentList) {
      // Liste sona erdi
      if (currentList.items.length >= 2) {
        currentList.endPosition = currentPosition;
        currentList.endLine = lineIndex - 1;
        lists.push(currentList);
      }
      currentList = null;
    }

    currentPosition += line.length + 1;
  }

  // Son liste
  if (currentList && currentList.items.length >= 2) {
    currentList.endPosition = currentPosition;
    currentList.endLine = lines.length - 1;
    lists.push(currentList);
  }

  logger.debug('Lists detected', {
    module: 'structure',
    count: lists.length,
    types: [...new Set(lists.map((l) => l.type))],
  });

  return lists;
}

// ==================== DİPNOT TESPİTİ ====================

/**
 * Dipnot pattern'leri
 */
const _FOOTNOTE_PATTERNS = [
  // (*) tarzı
  { marker: /\(\*\)/g, definition: /^\s*\(\*\)\s*(.+)$/gm },

  // (1) (2) tarzı
  { marker: /\((\d+)\)/g, definition: /^\s*\((\d+)\)\s*(?!.*[a-zA-Z]{3,}.*\d)(.+)$/gm },

  // [1] [2] tarzı
  { marker: /\[(\d+)\]/g, definition: /^\s*\[(\d+)\]\s*(.+)$/gm },

  // ¹ ² ³ superscript
  { marker: /[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, definition: /^\s*[¹²³⁴⁵⁶⁷⁸⁹⁰]+\s*(.+)$/gm },
];

/**
 * Metinden dipnotları tespit et
 * @param {string} text - Kaynak metin
 * @returns {Array} Tespit edilen dipnotlar
 */
export function detectFootnotes(text) {
  const footnotes = [];
  const lines = text.split('\n');

  // Basit dipnot tespiti: satır başında (*)  veya (*) sonra açıklama
  let currentPosition = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    // (*) ile başlayan satırlar
    if (/^\s*\(\*\)\s*/.test(line)) {
      footnotes.push({
        index: footnotes.length,
        marker: '(*)',
        type: 'asterisk',
        content: trimmed.replace(/^\(\*\)\s*/, ''),
        position: currentPosition,
        lineIndex,
      });
    }

    // Sayfa altı not göstergeleri: "Not:", "Dipnot:", "Açıklama:"
    if (/^(Not|Dipnot|Açıklama)\s*[:-]\s*/i.test(trimmed)) {
      footnotes.push({
        index: footnotes.length,
        marker: trimmed.match(/^(Not|Dipnot|Açıklama)/i)[0],
        type: 'labeled',
        content: trimmed.replace(/^(Not|Dipnot|Açıklama)\s*[:-]\s*/i, ''),
        position: currentPosition,
        lineIndex,
      });
    }

    currentPosition += line.length + 1;
  }

  logger.debug('Footnotes detected', {
    module: 'structure',
    count: footnotes.length,
  });

  return footnotes;
}

// ==================== REFERANS TESPİTİ ====================

/**
 * Çapraz referans pattern'leri
 */
const REFERENCE_PATTERNS = [
  // "Madde X'e bakınız" / "Madde X'de belirtilen"
  /[Mm]adde\s+(\d+(?:\.\d+)*)'?[eaıiuü]?\s*(bakınız|belirtilen|göre|uyarınca)/gi,

  // "yukarıdaki/aşağıdaki X. madde"
  /(yukarıdaki|aşağıdaki)\s+(\d+(?:\.\d+)*)\.\s*[Mm]adde/gi,

  // "X. maddede belirtildiği gibi"
  /(\d+(?:\.\d+)*)\.\s*[Mm]addede\s+(belirtildiği|açıklandığı)/gi,

  // "Bölüm X'e bakınız"
  /[Bb]ölüm\s+([IVX\d]+)'?[eaıiuü]?\s*(bakınız|göre)/gi,

  // "Ek-X'te yer alan"
  /[Ee]k[-\s]?(\d+|[A-Z])'?[tdea]+\s*(yer alan|belirtilen|gösterilen)/gi,
];

/**
 * Metinden çapraz referansları tespit et
 * @param {string} text - Kaynak metin
 * @returns {Array} Tespit edilen referanslar
 */
export function detectReferences(text) {
  const references = [];

  for (const pattern of REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);

    while (match !== null) {
      references.push({
        index: references.length,
        fullMatch: match[0],
        targetNumber: match[1],
        action: match[2] || '',
        position: match.index,
        endPosition: match.index + match[0].length,
      });
      match = pattern.exec(text);
    }
  }

  // Pozisyona göre sırala ve tekrarları kaldır
  const uniqueRefs = [];
  const seen = new Set();

  references.sort((a, b) => a.position - b.position);

  for (const ref of references) {
    const key = `${ref.position}-${ref.fullMatch}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRefs.push(ref);
    }
  }

  logger.debug('References detected', {
    module: 'structure',
    count: uniqueRefs.length,
  });

  return uniqueRefs;
}

// ==================== ANA FONKSİYON ====================

/**
 * Metindeki tüm yapıları tespit et
 * @param {string} text - Kaynak metin
 * @returns {StructureInfo} Yapı bilgisi
 */
export function detectStructure(text) {
  if (!text || typeof text !== 'string') {
    return {
      tables: [],
      headings: [],
      lists: [],
      footnotes: [],
      references: [],
      stats: {
        totalLength: 0,
        lineCount: 0,
      },
    };
  }

  const startTime = Date.now();

  const tables = detectTables(text);
  const headings = detectHeadings(text);
  const lists = detectLists(text);
  const footnotes = detectFootnotes(text);
  const references = detectReferences(text);

  const duration = Date.now() - startTime;

  const result = {
    tables,
    headings,
    lists,
    footnotes,
    references,
    stats: {
      totalLength: text.length,
      lineCount: text.split('\n').length,
      tableCount: tables.length,
      headingCount: headings.length,
      listCount: lists.length,
      footnoteCount: footnotes.length,
      referenceCount: references.length,
      detectionTime: duration,
    },
  };

  logger.info('Structure detection completed', {
    module: 'structure',
    duration: `${duration}ms`,
    stats: result.stats,
  });

  return result;
}

/**
 * Belirli bir pozisyonun hangi yapı içinde olduğunu bul
 * @param {number} position - Karakter pozisyonu
 * @param {StructureInfo} structureInfo - Yapı bilgisi
 * @returns {Object|null} İçinde bulunulan yapı
 */
export function findContainingStructure(position, structureInfo) {
  // Tablo içinde mi?
  for (const table of structureInfo.tables) {
    if (position >= table.startPosition && position <= table.endPosition) {
      return { type: 'table', structure: table };
    }
  }

  // Liste içinde mi?
  for (const list of structureInfo.lists) {
    if (position >= list.startPosition && position <= list.endPosition) {
      return { type: 'list', structure: list };
    }
  }

  return null;
}

/**
 * Verilen pozisyon için en yakın başlığı bul
 * @param {number} position - Karakter pozisyonu
 * @param {Array} headings - Başlık listesi
 * @returns {Object|null} En yakın başlık
 */
export function findNearestHeading(position, headings) {
  let nearest = null;

  for (const heading of headings) {
    if (heading.position <= position) {
      nearest = heading;
    } else {
      break;
    }
  }

  return nearest;
}

// ==================== REFERANS ÇÖZÜMLEME ====================

/**
 * Çapraz referansları çözümle - Layer 4
 *
 * Referansları tespit edilen başlıklarla eşleştirir.
 * "Madde 5'e bakınız" -> Madde 5 başlığının içeriğine bağlar
 *
 * @param {Array} references - Tespit edilen referanslar (detectReferences çıktısı)
 * @param {Array} headings - Tespit edilen başlıklar (detectHeadings çıktısı)
 * @param {string} text - Orijinal metin
 * @returns {Object} Çözümleme sonucu
 */
export function resolveReferences(references, headings, text) {
  const resolved = [];
  const unresolved = [];

  for (const ref of references) {
    const targetNumber = ref.targetNumber;
    let matchedHeading = null;
    let matchConfidence = 0;

    // Başlıklar arasında eşleşme ara
    for (const heading of headings) {
      // Tam eşleşme (Madde 5 -> 5)
      if (heading.number === targetNumber) {
        matchedHeading = heading;
        matchConfidence = 1.0;
        break;
      }

      // Kısmi eşleşme (Madde 5 -> 5.1, 5.2, ...)
      if (heading.number?.startsWith(targetNumber + '.')) {
        if (!matchedHeading || matchConfidence < 0.8) {
          matchedHeading = heading;
          matchConfidence = 0.8;
        }
      }

      // Üst madde eşleşmesi (Madde 5.1 -> 5)
      if (targetNumber.includes('.') && heading.number === targetNumber.split('.')[0]) {
        if (!matchedHeading || matchConfidence < 0.6) {
          matchedHeading = heading;
          matchConfidence = 0.6;
        }
      }
    }

    if (matchedHeading) {
      // Başlık sonrası içeriği çıkar (bir sonraki başlığa kadar)
      const headingIndex = headings.indexOf(matchedHeading);
      const nextHeading = headings[headingIndex + 1];

      const contentStart = matchedHeading.endPosition;
      const contentEnd = nextHeading ? nextHeading.position : text.length;
      const content = text.slice(contentStart, Math.min(contentEnd, contentStart + 500)).trim();

      resolved.push({
        reference: ref,
        resolved_to: {
          heading: matchedHeading,
          content_preview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          full_content_length: content.length,
        },
        confidence: matchConfidence,
        resolution_type: matchConfidence === 1.0 ? 'exact' : matchConfidence >= 0.8 ? 'partial' : 'parent',
      });
    } else {
      unresolved.push({
        reference: ref,
        reason: `Hedef başlık bulunamadı: ${targetNumber}`,
        suggestions: findSimilarHeadings(targetNumber, headings),
      });
    }
  }

  const stats = {
    total_references: references.length,
    resolved_count: resolved.length,
    unresolved_count: unresolved.length,
    resolution_rate: references.length > 0 ? (resolved.length / references.length) * 100 : 100,
    by_confidence: {
      exact: resolved.filter((r) => r.confidence === 1.0).length,
      partial: resolved.filter((r) => r.confidence >= 0.8 && r.confidence < 1.0).length,
      parent: resolved.filter((r) => r.confidence < 0.8).length,
    },
  };

  logger.info('Reference resolution completed', {
    module: 'structure',
    stats,
  });

  return {
    resolved,
    unresolved,
    stats,
  };
}

/**
 * Benzer başlık önerileri bul
 * @param {string} targetNumber - Aranan numara
 * @param {Array} headings - Başlık listesi
 * @returns {Array} Benzer başlıklar (max 3)
 */
function findSimilarHeadings(targetNumber, headings) {
  const suggestions = [];

  // Sayısal benzerlik ara
  const targetParts = targetNumber.split('.');
  const targetBase = parseInt(targetParts[0], 10);

  for (const heading of headings) {
    if (!heading.number) continue;

    const headingParts = heading.number.split('.');
    const headingBase = parseInt(headingParts[0], 10);

    // Yakın numaralar (±2)
    if (Math.abs(headingBase - targetBase) <= 2) {
      suggestions.push({
        number: heading.number,
        text: heading.text,
        similarity: 1 - Math.abs(headingBase - targetBase) * 0.2,
      });
    }
  }

  return suggestions
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map((s) => ({ number: s.number, text: s.text }));
}

export default {
  detectStructure,
  detectTables,
  detectHeadings,
  detectLists,
  detectFootnotes,
  detectReferences,
  resolveReferences,
  findContainingStructure,
  findNearestHeading,
};
