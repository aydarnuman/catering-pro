/**
 * Layer 5: Conflict Detection - Çelişki Tespiti
 *
 * P0-09: Aynı alan için farklı değerler tespit edildiğinde her iki değer de saklanmalı.
 * Bu modül çelişkileri TESPİT eder, ÇÖZMEZ.
 */

import logger from '../../../utils/logger.js';

/**
 * Çelişki yapısı
 * @typedef {Object} Conflict
 * @property {string} field - Çelişen alan adı
 * @property {Array} values - Çelişen değerler listesi
 * @property {boolean} needs_review - İnceleme gerekli
 * @property {string} conflict_type - Çelişki türü
 * @property {string} suggested_resolution - Önerilen çözüm (opsiyonel)
 */

/**
 * Değer normalizasyonu (karşılaştırma için)
 * @param {any} value - Değer
 * @returns {string} Normalize edilmiş string
 */
function normalizeValue(value) {
  if (value === null || value === undefined) return '';

  let str = String(value).toLowerCase().trim();

  // Tarih normalizasyonu: farklı formatları birleştir
  // 15.03.2025, 15/03/2025, 15-03-2025 → 15.03.2025
  str = str.replace(/(\d{2})[-/](\d{2})[-/](\d{4})/, '$1.$2.$3');

  // Para normalizasyonu: 1.250.000,00 → 1250000
  if (/[\d.,]+\s*(tl|₺|usd|\$|eur|€)/i.test(str)) {
    str = str.replace(/[.\s]/g, '').replace(',', '.');
  }

  // Yüzde normalizasyonu: %2,5 → 2.5
  if (str.startsWith('%')) {
    str = str.replace('%', '').replace(',', '.').trim();
  }

  return str;
}

/**
 * İki değerin çelişip çelişmediğini kontrol et
 * @param {any} value1 - Birinci değer
 * @param {any} value2 - İkinci değer
 * @returns {{ isConflict: boolean, conflictType: string }}
 */
function checkValueConflict(value1, value2) {
  const norm1 = normalizeValue(value1);
  const norm2 = normalizeValue(value2);

  // Boş değerler çelişki değil
  if (!norm1 || !norm2) {
    return { isConflict: false, conflictType: null };
  }

  // Tam eşleşme
  if (norm1 === norm2) {
    return { isConflict: false, conflictType: null };
  }

  // Kısmi eşleşme (biri diğerini içeriyor)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return { isConflict: true, conflictType: 'partial_match' };
  }

  // Tamamen farklı
  return { isConflict: true, conflictType: 'different_values' };
}

/**
 * Chunk sonuçlarından değerleri alan bazında grupla
 * @param {Array} chunkResults - Chunk analiz sonuçları
 * @returns {Object} Alan bazında gruplandırılmış değerler
 */
function groupValuesByField(chunkResults) {
  const groups = {
    dates: [],
    amounts: [],
    penalties: [],
    meals: [],
    personnel: [],
  };

  for (const chunkResult of chunkResults) {
    if (!chunkResult || chunkResult.error) continue;

    const chunkId = chunkResult.chunk_id || chunkResult.chunkIndex;
    const data = chunkResult.extractedData || chunkResult.findings || chunkResult;

    // Tarihler
    if (data.dates || data.tarihler) {
      const dates = data.dates || data.tarihler || [];
      for (const date of dates) {
        groups.dates.push({
          value: date.value,
          type: date.type,
          context: date.context,
          confidence: date.confidence || 1.0,
          source_chunk_id: chunkId,
        });
      }
    }

    // Tutarlar
    if (data.amounts || data.tutarlar) {
      const amounts = data.amounts || data.tutarlar || [];
      for (const amount of amounts) {
        groups.amounts.push({
          value: amount.value,
          type: amount.type,
          context: amount.context,
          confidence: amount.confidence || 1.0,
          source_chunk_id: chunkId,
        });
      }
    }

    // Cezalar
    if (data.penalties || data.cezalar) {
      const penalties = data.penalties || data.cezalar || [];
      for (const penalty of penalties) {
        groups.penalties.push({
          value: penalty.rate || penalty.description,
          type: penalty.type,
          context: penalty.context,
          confidence: penalty.confidence || 1.0,
          source_chunk_id: chunkId,
        });
      }
    }

    // Öğün bilgileri
    if (data.meals || data.ogun_bilgileri) {
      const meals = data.meals || data.ogun_bilgileri || [];
      for (const meal of meals) {
        groups.meals.push({
          value: meal.daily_count || meal.miktar,
          type: meal.type || meal.tur,
          context: meal.context,
          confidence: meal.confidence || 1.0,
          source_chunk_id: chunkId,
        });
      }
    }

    // Personel
    if (data.personnel || data.personel_detaylari) {
      const personnel = data.personnel || data.personel_detaylari || [];
      for (const person of personnel) {
        groups.personnel.push({
          value: person.count || person.adet,
          type: person.position || person.pozisyon,
          context: person.context,
          confidence: person.confidence || 1.0,
          source_chunk_id: chunkId,
        });
      }
    }
  }

  return groups;
}

/**
 * Aynı türdeki değerler arasındaki çelişkileri tespit et
 * @param {Array} values - Değer listesi (aynı alan türünden)
 * @param {string} fieldName - Alan adı
 * @returns {Conflict[]} Tespit edilen çelişkiler
 */
function detectConflictsInField(values, fieldName) {
  const conflicts = [];

  // Değerleri alt türe göre grupla
  const byType = {};
  for (const item of values) {
    const type = item.type || 'unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push(item);
  }

  // Her alt tür için çelişki kontrolü
  for (const [type, items] of Object.entries(byType)) {
    if (items.length < 2) continue;

    // Her çift için karşılaştır
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const { isConflict, conflictType } = checkValueConflict(items[i].value, items[j].value);

        if (isConflict) {
          // Bu çelişki zaten kaydedilmiş mi kontrol et
          const existingConflict = conflicts.find(
            (c) =>
              c.field === `${fieldName}.${type}` &&
              c.values.some((v) => normalizeValue(v.value) === normalizeValue(items[i].value))
          );

          if (existingConflict) {
            // Mevcut çelişkiye yeni değer ekle
            if (!existingConflict.values.some((v) => normalizeValue(v.value) === normalizeValue(items[j].value))) {
              existingConflict.values.push({
                value: items[j].value,
                source_chunk_id: items[j].source_chunk_id,
                context: items[j].context,
                confidence: items[j].confidence,
              });
            }
          } else {
            // Yeni çelişki oluştur
            conflicts.push({
              field: `${fieldName}.${type}`,
              values: [
                {
                  value: items[i].value,
                  source_chunk_id: items[i].source_chunk_id,
                  context: items[i].context,
                  confidence: items[i].confidence,
                },
                {
                  value: items[j].value,
                  source_chunk_id: items[j].source_chunk_id,
                  context: items[j].context,
                  confidence: items[j].confidence,
                },
              ],
              needs_review: true,
              conflict_type: conflictType,
              suggested_resolution: suggestResolution(conflictType, items[i], items[j]),
            });
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Çelişki için çözüm önerisi
 * @param {string} conflictType - Çelişki türü
 * @param {Object} item1 - Birinci değer
 * @param {Object} item2 - İkinci değer
 * @returns {string} Öneri
 */
function suggestResolution(conflictType, item1, item2) {
  // Güven skoruna göre öneri
  if (item1.confidence > item2.confidence + 0.2) {
    return `Daha yüksek güvenli değer tercih edilebilir: "${item1.value}" (${item1.confidence})`;
  }
  if (item2.confidence > item1.confidence + 0.2) {
    return `Daha yüksek güvenli değer tercih edilebilir: "${item2.value}" (${item2.confidence})`;
  }

  // Kısmi eşleşme
  if (conflictType === 'partial_match') {
    return 'Değerler kısmen örtüşüyor - daha detaylı olanı tercih edilebilir';
  }

  // Farklı değerler
  return 'Manuel inceleme gerekli - orijinal dökümandan doğrulayın';
}

/**
 * Tüm chunk sonuçlarından çelişkileri tespit et
 * @param {Array} chunkResults - Chunk analiz sonuçları
 * @returns {Conflict[]} Tespit edilen tüm çelişkiler
 */
export function detectConflicts(chunkResults) {
  if (!chunkResults || chunkResults.length === 0) {
    return [];
  }

  const startTime = Date.now();
  const allConflicts = [];

  // Değerleri grupla
  const groups = groupValuesByField(chunkResults);

  // Her alan için çelişki tespit et
  for (const [fieldName, values] of Object.entries(groups)) {
    if (values.length < 2) continue;

    const fieldConflicts = detectConflictsInField(values, fieldName);
    allConflicts.push(...fieldConflicts);
  }

  const duration = Date.now() - startTime;

  logger.info('Conflict detection completed', {
    module: 'conflict',
    chunks_analyzed: chunkResults.length,
    conflicts_found: allConflicts.length,
    duration: `${duration}ms`,
    conflict_fields: [...new Set(allConflicts.map((c) => c.field))],
  });

  return allConflicts;
}

/**
 * Çelişki raporunu oluştur
 * @param {Conflict[]} conflicts - Çelişki listesi
 * @returns {Object} Rapor
 */
export function generateConflictReport(conflicts) {
  const report = {
    total_conflicts: conflicts.length,
    critical_conflicts: 0,
    by_field: {},
    by_type: {
      different_values: 0,
      partial_match: 0,
      contradictory: 0,
    },
    needs_review_count: 0,
  };

  for (const conflict of conflicts) {
    // Alan bazında
    const fieldBase = conflict.field.split('.')[0];
    if (!report.by_field[fieldBase]) {
      report.by_field[fieldBase] = 0;
    }
    report.by_field[fieldBase]++;

    // Tür bazında
    if (conflict.conflict_type) {
      report.by_type[conflict.conflict_type]++;
    }

    // İnceleme gerekli
    if (conflict.needs_review) {
      report.needs_review_count++;
    }

    // Kritik alanlar (tarih, tutar)
    if (['dates', 'amounts'].includes(fieldBase)) {
      report.critical_conflicts++;
    }
  }

  return report;
}

export default {
  detectConflicts,
  generateConflictReport,
  normalizeValue,
  checkValueConflict,
};
