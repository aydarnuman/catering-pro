/**
 * P0 Kontrol Fonksiyonları
 *
 * Zero-Loss Pipeline için kritik kontroller.
 * Bu kontroller geçmezse veri kaybı KESİN.
 */

import crypto from 'node:crypto';
import logger from '../../../utils/logger.js';

/**
 * P0 Kontrol sonucu
 * @typedef {Object} P0CheckResult
 * @property {string} code - Kontrol kodu (P0-01, P0-02, vb.)
 * @property {string} name - Kontrol adı
 * @property {boolean} passed - Kontrol geçti mi?
 * @property {Object} details - Detay bilgileri
 * @property {string} [error] - Hata mesajı (passed=false ise)
 */

// ==================== P0-01: TABLO BÖLÜNME KONTROLÜ ====================

/**
 * P0-01: Hiçbir tablo iki veya daha fazla chunk'a bölünmemiş olmalı
 * @param {Array} chunks - Chunk listesi (startPos, endPos içermeli)
 * @param {Object} structureInfo - Structure detection sonucu
 * @returns {P0CheckResult}
 */
export function checkTableIntegrity(chunks, structureInfo) {
  const result = {
    code: 'P0-01',
    name: 'Tablo Bölünme Kontrolü',
    passed: true,
    details: {
      total_tables: structureInfo?.tables?.length || 0,
      split_tables: [],
    },
  };

  if (!structureInfo?.tables?.length || !chunks?.length) {
    return result;
  }

  for (const table of structureInfo.tables) {
    // Bu tablonun kaç chunk'a dağıldığını kontrol et
    const containingChunks = chunks.filter((chunk) => {
      const chunkStart = chunk.startPos ?? chunk.position ?? 0;
      const chunkEnd = chunk.endPos ?? chunkStart + (chunk.content?.length || 0);

      // Chunk ve tablo kesişiyor mu?
      return chunkStart < table.endPosition && chunkEnd > table.startPosition;
    });

    if (containingChunks.length > 1) {
      result.passed = false;
      result.details.split_tables.push({
        table_index: table.index,
        table_type: table.type,
        table_rows: table.rowCount,
        start_pos: table.startPosition,
        end_pos: table.endPosition,
        chunk_count: containingChunks.length,
        chunk_indices: containingChunks.map((c) => c.index),
      });
    }
  }

  if (!result.passed) {
    result.error = `${result.details.split_tables.length} tablo birden fazla chunk'a bölündü`;
  }

  return result;
}

// ==================== P0-02: TABLO DİPNOTU BAĞLANTISI ====================

/**
 * P0-02: Tablo dipnotları tablonun bulunduğu chunk ile aynı chunk'ta olmalı
 * @param {Array} chunks - Chunk listesi
 * @param {Object} structureInfo - Structure detection sonucu
 * @returns {P0CheckResult}
 */
export function checkTableFootnoteConnection(chunks, structureInfo) {
  const result = {
    code: 'P0-02',
    name: 'Tablo Dipnotu Bağlantısı',
    passed: true,
    details: {
      tables_with_footnotes: 0,
      disconnected_footnotes: [],
    },
  };

  if (!structureInfo?.tables?.length || !structureInfo?.footnotes?.length) {
    return result;
  }

  // Her tablo için yakın dipnotları kontrol et
  for (const table of structureInfo.tables) {
    // Tablo bitişinden sonraki 500 karakter içindeki dipnotlar
    const nearbyFootnotes = structureInfo.footnotes.filter(
      (fn) => fn.position > table.endPosition && fn.position < table.endPosition + 500
    );

    if (nearbyFootnotes.length > 0) {
      result.details.tables_with_footnotes++;

      // Tablo ve dipnotların aynı chunk'ta olup olmadığını kontrol et
      for (const footnote of nearbyFootnotes) {
        const tableChunk = chunks.find((c) => {
          const start = c.startPos ?? c.position ?? 0;
          const end = c.endPos ?? start + (c.content?.length || 0);
          return start <= table.startPosition && end >= table.endPosition;
        });

        const footnoteChunk = chunks.find((c) => {
          const start = c.startPos ?? c.position ?? 0;
          const end = c.endPos ?? start + (c.content?.length || 0);
          return start <= footnote.position && end >= footnote.position;
        });

        if (tableChunk && footnoteChunk && tableChunk.index !== footnoteChunk.index) {
          result.passed = false;
          result.details.disconnected_footnotes.push({
            table_index: table.index,
            footnote_marker: footnote.marker,
            footnote_content: footnote.content?.substring(0, 50),
            table_chunk: tableChunk.index,
            footnote_chunk: footnoteChunk.index,
          });
        }
      }
    }
  }

  if (!result.passed) {
    result.error = `${result.details.disconnected_footnotes.length} dipnot tablodan ayrı chunk'ta`;
  }

  return result;
}

// ==================== P0-03: BAŞLIK-İÇERİK BİRLİKTELİĞİ ====================

/**
 * P0-03: Madde başlığı ve içeriği aynı chunk'ta olmalı
 * @param {Array} chunks - Chunk listesi
 * @param {Object} structureInfo - Structure detection sonucu
 * @param {number} minContentChars - Başlıktan sonra minimum karakter (default: 200)
 * @returns {P0CheckResult}
 */
export function checkHeadingContentUnity(chunks, structureInfo, minContentChars = 200) {
  const result = {
    code: 'P0-03',
    name: 'Başlık-İçerik Birlikteliği',
    passed: true,
    details: {
      total_headings: structureInfo?.headings?.length || 0,
      split_headings: [],
    },
  };

  if (!structureInfo?.headings?.length || !chunks?.length) {
    return result;
  }

  for (let i = 0; i < structureInfo.headings.length; i++) {
    const heading = structureInfo.headings[i];
    const nextHeading = structureInfo.headings[i + 1];

    // Başlığın bulunduğu chunk
    const headingChunk = chunks.find((c) => {
      const start = c.startPos ?? c.position ?? 0;
      const end = c.endPos ?? start + (c.content?.length || 0);
      return start <= heading.position && end >= heading.position;
    });

    if (!headingChunk) continue;

    // Başlıktan sonraki en az minContentChars karakter aynı chunk'ta olmalı
    const contentEndPos = Math.min(
      heading.position + minContentChars,
      nextHeading?.position || Number.MAX_SAFE_INTEGER
    );

    const chunkEnd = headingChunk.endPos ?? (headingChunk.startPos ?? 0) + (headingChunk.content?.length || 0);

    if (chunkEnd < contentEndPos) {
      result.passed = false;
      result.details.split_headings.push({
        heading_text: heading.fullText?.substring(0, 80),
        heading_position: heading.position,
        chunk_end: chunkEnd,
        required_end: contentEndPos,
        missing_chars: contentEndPos - chunkEnd,
      });
    }
  }

  if (!result.passed) {
    result.error = `${result.details.split_headings.length} başlık içeriğinden ayrılmış`;
  }

  return result;
}

// ==================== P0-04: SAYISAL DEĞER BÜTÜNLÜĞÜ ====================

/**
 * P0-04: Para tutarları, yüzde ve tarih aralıkları chunk ortasından bölünmemiş olmalı
 * @param {Array} chunks - Chunk listesi
 * @param {string} originalText - Orijinal metin
 * @returns {P0CheckResult}
 */
export function checkNumericValueIntegrity(chunks, originalText) {
  const result = {
    code: 'P0-04',
    name: 'Sayısal Değer Bütünlüğü',
    passed: true,
    details: {
      split_values: [],
    },
  };

  // Kritik pattern'lar
  const patterns = [
    // Para tutarları: 1.250.000,00 TL
    { regex: /[\d.,]+\s*(TL|USD|EUR|₺|\$|€)/gi, type: 'amount' },
    // Yüzdeler: %2,5 günlük
    { regex: /%[\d.,]+\s*\w+/gi, type: 'percentage' },
    // Tarih aralıkları: 01.06.2025 - 31.08.2025
    { regex: /\d{2}\.\d{2}\.\d{4}\s*[-–]\s*\d{2}\.\d{2}\.\d{4}/gi, type: 'date_range' },
    // Tarihler: 01.06.2025
    { regex: /\d{2}\.\d{2}\.\d{4}/gi, type: 'date' },
  ];

  // Her chunk sınırında kontrol
  let currentPos = 0;
  for (let i = 0; i < chunks.length - 1; i++) {
    const chunk = chunks[i];
    const chunkEnd = currentPos + (chunk.content?.length || 0);

    // Chunk sınırı civarında kritik pattern var mı?
    const boundaryRegion = originalText.substring(
      Math.max(0, chunkEnd - 50),
      Math.min(originalText.length, chunkEnd + 50)
    );

    for (const { regex, type } of patterns) {
      regex.lastIndex = 0;
      let match = regex.exec(boundaryRegion);
      while (match !== null) {
        const matchStart = chunkEnd - 50 + match.index;
        const matchEnd = matchStart + match[0].length;

        // Değer chunk sınırında bölünmüş mü?
        if (matchStart < chunkEnd && matchEnd > chunkEnd) {
          result.passed = false;
          result.details.split_values.push({
            value: match[0],
            type,
            chunk_boundary: chunkEnd,
            value_start: matchStart,
            value_end: matchEnd,
            affected_chunks: [i, i + 1],
          });
        }
        match = regex.exec(boundaryRegion);
      }
    }

    currentPos = chunkEnd;
  }

  if (!result.passed) {
    result.error = `${result.details.split_values.length} sayısal değer chunk sınırında bölündü`;
  }

  return result;
}

// ==================== P0-05: KARAKTER KAYBI KONTROLÜ ====================

/**
 * P0-05: OCR çıktısı ile tüm chunk'ların toplam karakter sayısı eşit olmalı
 * @param {string} originalText - Orijinal metin
 * @param {Array} chunks - Chunk listesi
 * @param {number} tolerance - Tolerans (default: 10 karakter)
 * @returns {P0CheckResult}
 */
export function checkCharacterLoss(originalText, chunks, tolerance = 10) {
  const originalLength = originalText?.length || 0;
  const chunkedLength = chunks.reduce((sum, c) => sum + (c.content?.length || 0), 0);
  const difference = Math.abs(originalLength - chunkedLength);

  const result = {
    code: 'P0-05',
    name: 'Karakter Kaybı Kontrolü',
    passed: difference <= tolerance,
    details: {
      original_length: originalLength,
      chunked_length: chunkedLength,
      difference,
      tolerance,
      loss_percentage: originalLength > 0 ? ((difference / originalLength) * 100).toFixed(4) : 0,
    },
  };

  if (!result.passed) {
    result.error = `${difference} karakter kayıp (tolerans: ${tolerance})`;
  }

  return result;
}

// ==================== P0-06: JSON PARSE GARANTİSİ ====================

/**
 * P0-06: Her LLM çıktısı geçerli JSON olmalı
 * @param {string} response - LLM yanıtı
 * @param {string} chunkId - Chunk kimliği
 * @returns {P0CheckResult}
 */
export function ensureValidJson(response, chunkId = 'unknown') {
  const result = {
    code: 'P0-06',
    name: 'JSON Parse Garantisi',
    passed: false,
    details: {
      chunk_id: chunkId,
      response_length: response?.length || 0,
      parsed: null,
      raw_output_preserved: false,
    },
  };

  if (!response) {
    result.error = 'Boş yanıt';
    result.details.raw_output_preserved = true;
    result.details.raw_output = '';
    return result;
  }

  try {
    // Direkt parse dene
    result.details.parsed = JSON.parse(response);
    result.passed = true;
  } catch {
    // JSON bloğu bulmayı dene
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result.details.parsed = JSON.parse(jsonMatch[0]);
        result.passed = true;
        result.details.json_extracted = true;
      }
    } catch {
      // Parse edilemedi
    }
  }

  if (!result.passed) {
    result.error = 'JSON parse başarısız';
    result.details.raw_output_preserved = true;
    result.details.raw_output = response.substring(0, 1000); // İlk 1000 karakter
  }

  return result;
}

// ==================== P0-07: BOŞ ARRAY vs NULL AYRIMI ====================

/**
 * P0-07: [] (gerçekten yok) vs null (bulunamadı) ayrımı
 * @param {Object} extractionResult - Extraction sonucu
 * @param {string} field - Alan adı
 * @returns {P0CheckResult}
 */
export function checkNullVsEmpty(extractionResult, field) {
  const result = {
    code: 'P0-07',
    name: 'Null vs Empty Ayrımı',
    passed: true,
    details: {
      field,
      value_type: null,
      status: null,
    },
  };

  const value = extractionResult?.[field];

  if (value === null || value === undefined) {
    result.details.value_type = 'null/undefined';
    result.details.status = 'not_found';
    result.details.interpretation = 'LLM bu alanı bulamadı - İNCELENMELİ';
    // Bu durumda passed=true çünkü null doğru şekilde ayrılmış
  } else if (Array.isArray(value) && value.length === 0) {
    result.details.value_type = 'empty_array';
    result.details.status = 'confirmed_empty';
    result.details.interpretation = 'Bu alan gerçekten boş (metinde yok)';
  } else if (Array.isArray(value) && value.length > 0) {
    result.details.value_type = 'populated_array';
    result.details.status = 'has_data';
    result.details.count = value.length;
  } else if (typeof value === 'object' && Object.keys(value).length === 0) {
    result.details.value_type = 'empty_object';
    result.details.status = 'confirmed_empty';
  } else {
    result.details.value_type = typeof value;
    result.details.status = 'has_data';
  }

  return result;
}

// ==================== P0-08: YENİ BİLGİ EKLEME YASAĞI ====================

/**
 * P0-08: Stage 2 çıktısında, Stage 1 çıktılarında bulunmayan bilgi olmamalı
 * @param {Array} stage1Results - Stage 1 (chunk) sonuçları
 * @param {Object} stage2Result - Stage 2 (birleştirme) sonucu
 * @returns {P0CheckResult}
 */
export function checkNoNewInformation(stage1Results, stage2Result) {
  const result = {
    code: 'P0-08',
    name: 'Yeni Bilgi Ekleme Yasağı',
    passed: true,
    details: {
      new_values_found: [],
      checked_fields: [],
    },
  };

  // Stage 1'deki tüm değerleri topla
  const stage1Values = new Set();
  for (const chunkResult of stage1Results) {
    if (chunkResult.findings) {
      for (const finding of chunkResult.findings) {
        if (finding.value !== null && finding.value !== undefined) {
          // Değeri normalize et ve ekle
          const normalizedValue = String(finding.value).toLowerCase().trim();
          stage1Values.add(normalizedValue);
        }
      }
    }
  }

  // Stage 2 değerlerini kontrol et
  const fieldsToCheck = ['dates', 'amounts', 'penalties'];

  for (const field of fieldsToCheck) {
    result.details.checked_fields.push(field);

    const fieldData = stage2Result?.fields?.[field] || stage2Result?.[field];
    if (!Array.isArray(fieldData)) continue;

    for (const item of fieldData) {
      const value = item.value ?? item.rate ?? item.description;
      if (!value) continue;

      const normalizedValue = String(value).toLowerCase().trim();

      // Stage 1'de bu değer var mı?
      if (!stage1Values.has(normalizedValue)) {
        // Kısmi eşleşme dene (benzer değerler için)
        const hasPartialMatch = Array.from(stage1Values).some(
          (v) => v.includes(normalizedValue) || normalizedValue.includes(v)
        );

        if (!hasPartialMatch) {
          result.passed = false;
          result.details.new_values_found.push({
            field,
            value,
            source: 'stage2_only',
          });
        }
      }
    }
  }

  if (!result.passed) {
    result.error = `${result.details.new_values_found.length} yeni değer Stage 2'de eklendi`;
  }

  return result;
}

// ==================== P0-09: CONFLICT PRESERVATION ====================

/**
 * P0-09: Aynı alan için farklı değerler tespit edildiğinde her iki değer de saklanmalı
 * @param {Object} finalResult - Final sonuç
 * @param {Array} detectedConflicts - Tespit edilen çelişkiler
 * @returns {P0CheckResult}
 */
export function checkConflictPreservation(finalResult, detectedConflicts) {
  const result = {
    code: 'P0-09',
    name: 'Conflict Preservation',
    passed: true,
    details: {
      detected_conflicts: detectedConflicts?.length || 0,
      preserved_conflicts: finalResult?.conflicts?.length || 0,
      missing_conflicts: [],
    },
  };

  if (!detectedConflicts?.length) {
    return result; // Çelişki yoksa kontrol geçer
  }

  // Her tespit edilen çelişkinin final sonuçta olup olmadığını kontrol et
  for (const conflict of detectedConflicts) {
    const preserved = finalResult?.conflicts?.find((c) => c.field === conflict.field);

    if (!preserved) {
      result.passed = false;
      result.details.missing_conflicts.push({
        field: conflict.field,
        values: conflict.values?.map((v) => v.value),
      });
    } else {
      // Tüm değerlerin korunduğunu kontrol et
      const detectedValues = new Set(conflict.values?.map((v) => String(v.value)));
      const preservedValues = new Set(preserved.values?.map((v) => String(v.value)));

      for (const v of detectedValues) {
        if (!preservedValues.has(v)) {
          result.passed = false;
          result.details.missing_conflicts.push({
            field: conflict.field,
            missing_value: v,
          });
        }
      }
    }
  }

  if (!result.passed) {
    result.error = `${result.details.missing_conflicts.length} çelişki korunmadı`;
  }

  return result;
}

// ==================== P0-10: SOURCE TRACEABILITY ====================

/**
 * P0-10: Final JSON'daki her değer için kaynak chunk ID'si mevcut olmalı
 * @param {Object} finalResult - Final sonuç
 * @returns {P0CheckResult}
 */
export function checkSourceTraceability(finalResult) {
  const result = {
    code: 'P0-10',
    name: 'Source Traceability',
    passed: true,
    details: {
      checked_values: 0,
      missing_source: [],
    },
  };

  const fieldsToCheck = ['dates', 'amounts', 'penalties'];

  for (const field of fieldsToCheck) {
    const fieldData = finalResult?.fields?.[field] || finalResult?.analysis?.[field];
    if (!Array.isArray(fieldData)) continue;

    for (let i = 0; i < fieldData.length; i++) {
      const item = fieldData[i];
      result.details.checked_values++;

      // source_chunk_id veya source_position olmalı
      if (!item.source_chunk_id && !item.source_position && !item.source_chunk) {
        result.passed = false;
        result.details.missing_source.push({
          field,
          index: i,
          value: item.value ?? item.rate ?? item.description,
        });
      }
    }
  }

  if (!result.passed) {
    result.error = `${result.details.missing_source.length} değerin kaynağı yok`;
  }

  return result;
}

// ==================== TÜM P0 KONTROLLERİNİ ÇALIŞTIR ====================

/**
 * Tüm P0 kontrollerini çalıştır
 * @param {Object} params - Kontrol parametreleri
 * @returns {Object} Tüm kontrol sonuçları
 */
export function runAllP0Checks({
  chunks,
  structureInfo,
  originalText,
  stage1Results,
  stage2Result,
  finalResult,
  detectedConflicts,
}) {
  const checks = [];

  // P0-01: Tablo bölünme
  if (chunks && structureInfo) {
    checks.push(checkTableIntegrity(chunks, structureInfo));
  }

  // P0-02: Tablo dipnotu
  if (chunks && structureInfo) {
    checks.push(checkTableFootnoteConnection(chunks, structureInfo));
  }

  // P0-03: Başlık-içerik
  if (chunks && structureInfo) {
    checks.push(checkHeadingContentUnity(chunks, structureInfo));
  }

  // P0-04: Sayısal değer bütünlüğü
  if (chunks && originalText) {
    checks.push(checkNumericValueIntegrity(chunks, originalText));
  }

  // P0-05: Karakter kaybı
  if (originalText && chunks) {
    checks.push(checkCharacterLoss(originalText, chunks));
  }

  // P0-08: Yeni bilgi yasağı
  if (stage1Results && stage2Result) {
    checks.push(checkNoNewInformation(stage1Results, stage2Result));
  }

  // P0-09: Conflict preservation
  if (finalResult && detectedConflicts) {
    checks.push(checkConflictPreservation(finalResult, detectedConflicts));
  }

  // P0-10: Source traceability
  if (finalResult) {
    checks.push(checkSourceTraceability(finalResult));
  }

  const allPassed = checks.every((c) => c.passed);
  const failedChecks = checks.filter((c) => !c.passed);

  const summary = {
    all_passed: allPassed,
    total_checks: checks.length,
    passed_count: checks.filter((c) => c.passed).length,
    failed_count: failedChecks.length,
    checks,
    failed_checks: failedChecks.map((c) => ({ code: c.code, error: c.error })),
  };

  if (!allPassed) {
    logger.warn('P0 checks failed', {
      module: 'p0-checks',
      failed: summary.failed_checks,
    });
  }

  return summary;
}

/**
 * Metin hash'i oluştur (P0-05 için)
 * @param {string} text - Metin
 * @returns {string} MD5 hash
 */
export function createTextHash(text) {
  return crypto
    .createHash('md5')
    .update(text || '')
    .digest('hex');
}

export default {
  checkTableIntegrity,
  checkTableFootnoteConnection,
  checkHeadingContentUnity,
  checkNumericValueIntegrity,
  checkCharacterLoss,
  ensureValidJson,
  checkNullVsEmpty,
  checkNoNewInformation,
  checkConflictPreservation,
  checkSourceTraceability,
  runAllP0Checks,
  createTextHash,
};
