/**
 * Layer 2: Smart Chunker - Akıllı Metin Bölümleme
 *
 * Döküman türüne göre optimize edilmiş bölümleme.
 * Tablolar ve başlık-içerik bağlamı korunur.
 */

import logger from '../../../utils/logger.js';

/**
 * Chunk yapısı
 * @typedef {Object} Chunk
 * @property {number} index - Chunk sırası
 * @property {string} content - Chunk içeriği
 * @property {string} type - Chunk türü (text, table, header, mixed)
 * @property {number} tokenEstimate - Tahmini token sayısı
 * @property {Object} context - Bağlam bilgisi (önceki başlık vs.)
 */

// Token tahmin katsayısı (Türkçe için ~1.5 karakter/token)
const CHARS_PER_TOKEN = 1.5;
const MAX_TOKENS_PER_CHUNK = 6000; // Claude için optimum (artırıldı: 3500 → 6000)
const MIN_TOKENS_PER_CHUNK = 500; // Minimum chunk boyutu (küçükler birleştirilir)
const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN;

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
    /^[A-Z0-9]{1,3}[\.\)]\s/, // 1. 2. A. B. vs.
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
 * Metin chunk'larına böl
 * @param {string} text - Kaynak metin
 * @param {Object} options - Ayarlar
 * @returns {Chunk[]}
 */
export function chunkText(text, options = {}) {
  const maxChars = options.maxChars || MAX_CHARS_PER_CHUNK;
  
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
  let currentType = 'text';
  let lastHeading = '';
  let inTable = false;
  let tableContent = '';

  const flushChunk = (type = 'text') => {
    const content = currentChunk.trim();
    if (content.length > 0) {
      chunks.push({
        index: chunks.length,
        content,
        type,
        tokenEstimate: estimateTokens(content),
        context: {
          heading: lastHeading,
          position: chunks.length === 0 ? 'start' : 'middle',
        },
      });
    }
    currentChunk = '';
    currentType = 'text';
  };

  const flushTable = () => {
    if (tableContent.trim()) {
      chunks.push({
        index: chunks.length,
        content: tableContent.trim(),
        type: 'table',
        tokenEstimate: estimateTokens(tableContent),
        context: {
          heading: lastHeading,
          position: 'table',
        },
      });
    }
    tableContent = '';
    inTable = false;
  };

  for (const line of lines) {
    // Başlık kontrolü
    if (isHeading(line)) {
      // Önceki chunk'ı flush et
      if (inTable) flushTable();
      if (currentChunk.length > maxChars / 2) {
        flushChunk(currentType);
      }
      lastHeading = line.trim();
      currentChunk += line + '\n';
      currentType = 'header';
      continue;
    }

    // Tablo satırı kontrolü
    if (isTableRow(line)) {
      if (!inTable) {
        // Tablo başlıyor, önceki text'i flush et
        flushChunk(currentType);
        inTable = true;
        tableContent = lastHeading ? `[Tablo - ${lastHeading}]\n` : '';
      }
      tableContent += line + '\n';

      // Tablo çok büyüdüyse flush et
      if (tableContent.length > maxChars) {
        flushTable();
        inTable = true; // Devam eden tablo
        tableContent = '[Tablo devam...]\n';
      }
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
      // Paragraf sınırında bölmeye çalış
      const lastParagraph = currentChunk.lastIndexOf('\n\n');
      if (lastParagraph > maxChars / 2) {
        const toFlush = currentChunk.substring(0, lastParagraph);
        currentChunk = currentChunk.substring(lastParagraph + 2);

        chunks.push({
          index: chunks.length,
          content: toFlush.trim(),
          type: currentType,
          tokenEstimate: estimateTokens(toFlush),
          context: {
            heading: lastHeading,
            position: 'middle',
          },
        });
        currentType = 'text';
      } else {
        flushChunk(currentType);
      }
    }
  }

  // Kalan içeriği flush et
  if (inTable) flushTable();
  flushChunk(currentType);

  // Son chunk'ı işaretle
  if (chunks.length > 0) {
    chunks[chunks.length - 1].context.position = 'end';
  }

  // Küçük chunk'ları birleştir (MIN_TOKENS_PER_CHUNK altındakiler)
  const mergedChunks = mergeSmallChunks(chunks);

  logger.info('Text chunked', {
    module: 'chunker',
    totalChars: text.length,
    originalChunks: chunks.length,
    mergedChunks: mergedChunks.length,
    avgChunkSize: Math.round(text.length / mergedChunks.length),
  });

  return mergedChunks;
}

/**
 * Küçük chunk'ları bir sonrakiyle birleştir
 * @param {Chunk[]} chunks 
 * @returns {Chunk[]}
 */
function mergeSmallChunks(chunks) {
  if (chunks.length <= 1) return chunks;
  
  const merged = [];
  let buffer = null;
  
  for (const chunk of chunks) {
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
          type: buffer.type === chunk.type ? chunk.type : 'mixed',
          context: {
            ...chunk.context,
            heading: buffer.context.heading || chunk.context.heading,
            merged: true,
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
 * @returns {Chunk[]}
 */
export function chunk(extractionResult) {
  const { type, text, structured } = extractionResult;

  // Excel için özel chunking
  if (type === 'xlsx' && structured?.sheets) {
    return chunkExcel(extractionResult);
  }

  // ZIP için her dosyayı ayrı chunk'la
  if (type === 'zip' && structured?.files) {
    const chunks = [];
    for (const file of structured.files) {
      const fileChunks = chunk(file);
      for (const c of fileChunks) {
        c.context.fileName = file.fileName;
        chunks.push(c);
      }
    }
    return chunks;
  }

  // Diğer türler için metin chunking
  return chunkText(text);
}

export default {
  chunk,
  chunkText,
  chunkExcel,
  estimateTokens,
};
