/**
 * Layer 2: Smart Chunker - Akıllı Metin Bölümleme
 *
 * Zero-Loss Pipeline için optimize edilmiş bölümleme.
 * P0 Kontrolleri:
 * - P0-01: Tablo bölünme yasağı
 * - P0-02: Tablo dipnotu birlikteliği
 * - P0-03: Başlık-içerik birlikteliği
 * - P0-05: Karakter kaybı kontrolü
 */

import logger from '../../../utils/logger.js';
import { createTextHash } from '../controls/p0-checks.js';

/**
 * Chunk yapısı
 * @typedef {Object} Chunk
 * @property {number} index - Chunk sırası
 * @property {string} content - Chunk içeriği
 * @property {string} type - Chunk türü (text, table, header, mixed)
 * @property {number} tokenEstimate - Tahmini token sayısı
 * @property {Object} context - Bağlam bilgisi (önceki başlık vs.)
 * @property {number} startPos - Orijinal metindeki başlangıç pozisyonu
 * @property {number} endPos - Orijinal metindeki bitiş pozisyonu
 * @property {string} contentHash - İçerik hash'i (P0-05 için)
 */

// Token tahmin katsayısı (Türkçe için ~1.5 karakter/token)
const CHARS_PER_TOKEN = 1.5;
const MAX_TOKENS_PER_CHUNK = 6000; // Claude için optimum (artırıldı: 3500 → 6000)
const MIN_TOKENS_PER_CHUNK = 500; // Minimum chunk boyutu (küçükler birleştirilir)
const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN;
const MIN_HEADING_CONTENT_CHARS = 300; // P0-03: Başlıktan sonra minimum karakter

// OCR sayfa ayırıcı pattern'leri (temizlenecek)
const PAGE_SEPARATOR_PATTERNS = [
  /^-{3,}\s*Sayfa\s*-{3,}$/gim,
  /^-{3,}\s*Page\s*-{3,}$/gim,
  /^\s*---\s*Sayfa\s*---\s*$/gim,
  /^\n{3,}/g, // 3+ boş satır → 2 boş satır
];

/**
 * Metin için tahmini token sayısı
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Başlık satırı mı kontrol et
 * @param {string} line
 * @returns {boolean}
 */
function isHeading(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Tipik başlık kalıpları
  const headingPatterns = [
    /^#{1,6}\s/, // Markdown başlıkları
    /^[A-Z0-9]{1,3}[.)]\s/, // 1. 2. A. B. vs.
    /^MADDE\s+\d+/i, // MADDE 1
    /^BÖLÜM\s+[IVX\d]+/i, // BÖLÜM I
    /^Madde\s+\d+/i,
    /^\d+\.\d+\.?\s+[A-ZİĞÜŞÖÇ]/, // 1.1 Başlık
    /^[IVX]+\.\s+[A-ZİĞÜŞÖÇ]/, // I. II. vs.
  ];

  // Kısa satır + büyük harfle başlıyor = muhtemelen başlık
  if (trimmed.length < 100 && /^[A-ZİĞÜŞÖÇ0-9]/.test(trimmed)) {
    if (headingPatterns.some((p) => p.test(trimmed))) {
      return true;
    }
  }

  return false;
}

/**
 * Tablo satırı mı kontrol et
 * @param {string} line
 * @returns {boolean}
 */
function isTableRow(line) {
  // CSV tarzı: çok sayıda virgül veya tab
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  const pipeCount = (line.match(/\|/g) || []).length;

  return commaCount > 3 || tabCount > 2 || pipeCount > 2;
}

/**
 * Metin chunk'larına böl (basit versiyon - structure info olmadan)
 * @param {string} text - Kaynak metin
 * @param {Object} options - Ayarlar
 * @returns {Chunk[]}
 */
export function chunkText(text, options = {}) {
  // Structure info yoksa basit chunking yap
  return chunkTextWithStructure(text, null, options);
}

/**
 * Metin chunk'larına böl (Zero-Loss - P0 kontrollü)
 * @param {string} text - Kaynak metin
 * @param {Object} structureInfo - Structure detection sonucu (null olabilir)
 * @param {Object} options - Ayarlar
 * @returns {Chunk[]}
 */
export function chunkTextWithStructure(text, structureInfo = null, options = {}) {
  const maxChars = options.maxChars || MAX_CHARS_PER_CHUNK;
  const preserveTables = options.preserveTables !== false; // P0-01
  const preserveHeadingContent = options.preserveHeadingContent !== false; // P0-03

  // OCR sayfa ayırıcılarını temizle (veri kaybı yok, sadece ayırıcılar)
  let cleanedText = text;
  for (const pattern of PAGE_SEPARATOR_PATTERNS) {
    cleanedText = cleanedText.replace(pattern, '\n\n');
  }
  // Çoklu boş satırları normalize et
  cleanedText = cleanedText.replace(/\n{4,}/g, '\n\n\n');

  const lines = cleanedText.split('\n');
  const chunks = [];

  let currentChunk = '';
  let currentChunkStartPos = 0;
  let currentType = 'text';
  let lastHeading = '';
  let lastHeadingPos = 0;
  let inTable = false;
  let tableContent = '';
  let tableStartPos = 0;
  let currentPos = 0;

  // P0-01: Korunması gereken tablo bölgeleri (structure info'dan)
  const protectedTableRegions =
    structureInfo?.tables?.map((t) => ({
      start: t.startPosition,
      end: t.endPosition,
      includeFootnotes: true, // P0-02
    })) || [];

  // Pozisyonun korunan bölgede olup olmadığını kontrol et
  const isInProtectedRegion = (pos) => {
    for (const region of protectedTableRegions) {
      // P0-02: Dipnot için 500 karakter ek koruma
      const extendedEnd = region.includeFootnotes ? region.end + 500 : region.end;
      if (pos >= region.start && pos <= extendedEnd) {
        return true;
      }
    }
    return false;
  };

  const flushChunk = (type = 'text', forcePos = null) => {
    const content = currentChunk.trim();
    if (content.length > 0) {
      const endPos = forcePos ?? currentPos;
      chunks.push({
        index: chunks.length,
        content,
        type,
        tokenEstimate: estimateTokens(content),
        startPos: currentChunkStartPos,
        endPos,
        contentHash: createTextHash(content),
        context: {
          heading: lastHeading,
          position: chunks.length === 0 ? 'start' : 'middle',
        },
      });
    }
    currentChunk = '';
    currentChunkStartPos = currentPos;
    currentType = 'text';
  };

  const flushTable = () => {
    if (tableContent.trim()) {
      chunks.push({
        index: chunks.length,
        content: tableContent.trim(),
        type: 'table',
        tokenEstimate: estimateTokens(tableContent),
        startPos: tableStartPos,
        endPos: currentPos,
        contentHash: createTextHash(tableContent),
        context: {
          heading: lastHeading,
          position: 'table',
        },
      });
    }
    tableContent = '';
    inTable = false;
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineEndPos = currentPos + line.length;

    // Başlık kontrolü
    if (isHeading(line)) {
      // Önceki chunk'ı flush et
      if (inTable) flushTable();

      // P0-03: Başlık-içerik birlikteliği kontrolü
      // Başlık + MIN_HEADING_CONTENT_CHARS aynı chunk'ta kalmalı
      const contentAfterHeading = preserveHeadingContent ? MIN_HEADING_CONTENT_CHARS : 0;
      const neededSpace = line.length + contentAfterHeading;

      if (currentChunk.length > 0 && currentChunk.length + neededSpace > maxChars) {
        // Mevcut chunk'ı flush et, başlık yeni chunk'ta başlasın
        flushChunk(currentType);
      }

      lastHeading = line.trim();
      lastHeadingPos = currentPos;
      currentChunk += line + '\n';
      currentType = 'header';
      currentPos = lineEndPos + 1;
      continue;
    }

    // Tablo satırı kontrolü
    if (isTableRow(line)) {
      if (!inTable) {
        // Tablo başlıyor, önceki text'i flush et
        flushChunk(currentType);
        inTable = true;
        tableStartPos = currentPos;
        tableContent = lastHeading ? `[Tablo - ${lastHeading}]\n` : '';
      }
      tableContent += line + '\n';

      // P0-01: Tablo korunan bölgedeyse BÖLME
      const inProtected = preserveTables && isInProtectedRegion(currentPos);

      // Tablo çok büyüdüyse ve korunan bölgede DEĞİLSE flush et
      if (tableContent.length > maxChars && !inProtected) {
        flushTable();
        inTable = true; // Devam eden tablo
        tableStartPos = currentPos;
        tableContent = '[Tablo devam...]\n';
      }
      currentPos = lineEndPos + 1;
      continue;
    }

    // Normal metin
    if (inTable && line.trim()) {
      // Tablo bitti
      flushTable();
    }

    currentChunk += line + '\n';

    // Chunk doldu mu?
    if (currentChunk.length > maxChars) {
      // P0-01, P0-03: Korunan bölgede bölme yapma
      const inProtected = isInProtectedRegion(currentPos);
      const tooCloseToHeading = preserveHeadingContent && currentPos - lastHeadingPos < MIN_HEADING_CONTENT_CHARS;

      if (!inProtected && !tooCloseToHeading) {
        // Paragraf sınırında bölmeye çalış
        const lastParagraph = currentChunk.lastIndexOf('\n\n');
        if (lastParagraph > maxChars / 2) {
          const toFlush = currentChunk.substring(0, lastParagraph);
          const splitPos = currentChunkStartPos + lastParagraph;
          currentChunk = currentChunk.substring(lastParagraph + 2);

          chunks.push({
            index: chunks.length,
            content: toFlush.trim(),
            type: currentType,
            tokenEstimate: estimateTokens(toFlush),
            startPos: currentChunkStartPos,
            endPos: splitPos,
            contentHash: createTextHash(toFlush),
            context: {
              heading: lastHeading,
              position: 'middle',
            },
          });
          currentChunkStartPos = splitPos + 2;
          currentType = 'text';
        } else {
          flushChunk(currentType);
        }
      }
      // Korunan bölgedeyse chunk'ı büyütmeye devam et (P0-01, P0-03 öncelikli)
    }
    currentPos = lineEndPos + 1;
  }

  // Kalan içeriği flush et
  if (inTable) flushTable();
  flushChunk(currentType, currentPos);

  // Son chunk'ı işaretle
  if (chunks.length > 0) {
    chunks[chunks.length - 1].context.position = 'end';
  }

  // Küçük chunk'ları birleştir (MIN_TOKENS_PER_CHUNK altındakiler)
  const mergedChunks = mergeSmallChunks(chunks);

  // P0-05: Karakter kaybı kontrolü
  const totalChunkedChars = mergedChunks.reduce((sum, c) => sum + c.content.length, 0);
  const charDifference = Math.abs(cleanedText.length - totalChunkedChars);

  logger.info('Text chunked (Zero-Loss)', {
    module: 'chunker',
    totalChars: text.length,
    cleanedChars: cleanedText.length,
    chunkedChars: totalChunkedChars,
    charDifference,
    originalChunks: chunks.length,
    mergedChunks: mergedChunks.length,
    avgChunkSize: Math.round(cleanedText.length / Math.max(1, mergedChunks.length)),
    p0_01_protected_tables: protectedTableRegions.length,
    p0_05_char_loss: charDifference > 10 ? 'WARNING' : 'OK',
  });

  return mergedChunks;
}

/**
 * Küçük chunk'ları bir sonrakiyle birleştir
 * P0-02: Tablo ve hemen sonrasındaki dipnot chunk'ları birleştirilir
 * @param {Chunk[]} chunks
 * @returns {Chunk[]}
 */
function mergeSmallChunks(chunks) {
  if (chunks.length <= 1) return chunks;

  const merged = [];
  let buffer = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const nextChunk = chunks[i + 1];

    // P0-02: Tablo chunk'ı ve hemen sonraki küçük chunk'ı birleştir (dipnot olabilir)
    const isTableFollowedBySmall =
      chunk.type === 'table' && nextChunk && nextChunk.tokenEstimate < MIN_TOKENS_PER_CHUNK;

    if (buffer) {
      // Buffer'ı mevcut chunk ile birleştir
      const combinedContent = buffer.content + '\n\n' + chunk.content;
      const combinedTokens = estimateTokens(combinedContent);

      if (combinedTokens <= MAX_TOKENS_PER_CHUNK) {
        // Birleştir
        buffer = {
          ...chunk,
          index: merged.length,
          content: combinedContent,
          tokenEstimate: combinedTokens,
          startPos: buffer.startPos,
          endPos: chunk.endPos,
          contentHash: createTextHash(combinedContent),
          type: buffer.type === chunk.type ? chunk.type : 'mixed',
          context: {
            ...chunk.context,
            heading: buffer.context.heading || chunk.context.heading,
            merged: true,
            mergedFrom: [buffer.index, chunk.index],
          },
        };
      } else {
        // Buffer'ı kaydet, yeni buffer başlat
        buffer.index = merged.length;
        merged.push(buffer);
        buffer = chunk.tokenEstimate < MIN_TOKENS_PER_CHUNK ? chunk : null;
        if (!buffer) {
          chunk.index = merged.length;
          merged.push(chunk);
        }
      }
    } else if (chunk.tokenEstimate < MIN_TOKENS_PER_CHUNK) {
      // Küçük chunk, buffer'a al
      buffer = chunk;
    } else if (isTableFollowedBySmall) {
      // P0-02: Tablo + küçük chunk = buffer'a al (dipnot birleştirmesi için)
      buffer = chunk;
    } else {
      // Normal boyut, direkt ekle
      chunk.index = merged.length;
      merged.push(chunk);
    }
  }

  // Kalan buffer'ı ekle
  if (buffer) {
    buffer.index = merged.length;
    merged.push(buffer);
  }

  return merged;
}

/**
 * Excel verisi için özel chunking
 * @param {Object} extractionResult - Extractor'dan gelen sonuç
 * @returns {Chunk[]}
 */
export function chunkExcel(extractionResult) {
  const chunks = [];
  const { sheets } = extractionResult.structured;

  for (const sheet of sheets) {
    // Her sayfa bir chunk olabilir (eğer çok büyük değilse)
    const sheetText = sheet.csv;

    if (estimateTokens(sheetText) <= MAX_TOKENS_PER_CHUNK) {
      // Tüm sayfa tek chunk
      chunks.push({
        index: chunks.length,
        content: `=== Sayfa: ${sheet.name} ===\n${sheetText}`,
        type: 'table',
        tokenEstimate: estimateTokens(sheetText),
        context: {
          sheetName: sheet.name,
          rowCount: sheet.rowCount,
          columnCount: sheet.columnCount,
          columns: sheet.columns.map((c) => c.name),
        },
      });
    } else {
      // Sayfa çok büyük, satırlara böl
      const rows = sheet.data;
      const headerRow = rows[0] || [];
      const headerText = headerRow.join(',');

      let currentRows = [];
      let currentSize = headerText.length;

      for (let i = 1; i < rows.length; i++) {
        const rowText = rows[i].join(',');
        currentRows.push(rows[i]);
        currentSize += rowText.length;

        if (currentSize > MAX_CHARS_PER_CHUNK - 500) {
          // Chunk'ı oluştur
          const chunkCsv = [headerRow, ...currentRows].map((r) => r.join(',')).join('\n');
          chunks.push({
            index: chunks.length,
            content: `=== Sayfa: ${sheet.name} (satır ${i - currentRows.length + 2}-${i + 1}) ===\n${chunkCsv}`,
            type: 'table',
            tokenEstimate: estimateTokens(chunkCsv),
            context: {
              sheetName: sheet.name,
              columns: sheet.columns.map((c) => c.name),
              rowRange: [i - currentRows.length + 2, i + 1],
            },
          });

          currentRows = [];
          currentSize = headerText.length;
        }
      }

      // Kalan satırları flush et
      if (currentRows.length > 0) {
        const chunkCsv = [headerRow, ...currentRows].map((r) => r.join(',')).join('\n');
        chunks.push({
          index: chunks.length,
          content: `=== Sayfa: ${sheet.name} (son satırlar) ===\n${chunkCsv}`,
          type: 'table',
          tokenEstimate: estimateTokens(chunkCsv),
          context: {
            sheetName: sheet.name,
            columns: sheet.columns.map((c) => c.name),
          },
        });
      }
    }
  }

  logger.info('Excel chunked', {
    module: 'chunker',
    sheetCount: sheets.length,
    chunkCount: chunks.length,
  });

  return chunks;
}

/**
 * Extraction sonucunu chunk'lara böl
 * @param {Object} extractionResult - Extractor'dan gelen sonuç
 * @param {Object} structureInfo - Structure detection sonucu (opsiyonel)
 * @returns {Chunk[]}
 */
export function chunk(extractionResult, structureInfo = null) {
  const { type, text, structured } = extractionResult;

  // Excel için özel chunking
  if (type === 'xlsx' && structured?.sheets) {
    return chunkExcel(extractionResult);
  }

  // ZIP için her dosyayı ayrı chunk'la
  if (type === 'zip' && structured?.files) {
    const chunks = [];
    for (const file of structured.files) {
      const fileChunks = chunk(file, structureInfo);
      for (const c of fileChunks) {
        c.context.fileName = file.fileName;
        chunks.push(c);
      }
    }
    return chunks;
  }

  // Diğer türler için metin chunking (Zero-Loss)
  return chunkTextWithStructure(text, structureInfo);
}

/**
 * P0-05: Karakter kaybı doğrulaması
 * @param {string} originalText - Orijinal metin
 * @param {Chunk[]} chunks - Chunk listesi
 * @param {number} tolerance - Tolerans (default: 10)
 * @returns {{ valid: boolean, originalLength: number, chunkedLength: number, difference: number }}
 */
export function validateCharacterCount(originalText, chunks, tolerance = 10) {
  const originalLength = originalText?.length || 0;
  const chunkedLength = chunks.reduce((sum, c) => sum + (c.content?.length || 0), 0);
  const difference = Math.abs(originalLength - chunkedLength);

  return {
    valid: difference <= tolerance,
    originalLength,
    chunkedLength,
    difference,
    tolerance,
  };
}

export default {
  chunk,
  chunkText,
  chunkTextWithStructure,
  chunkExcel,
  estimateTokens,
  validateCharacterCount,
};
