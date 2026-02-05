/**
 * Conflict Resolver
 * =================
 *
 * 6. Akıllı çelişki çözümleme
 *
 * Tespit edilen çelişkileri akıllı kurallar ile çözer.
 * Çözemediği çelişkileri "needs_review" olarak işaretler.
 */

import logger from '../../../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUTION STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

const RESOLUTION_STRATEGIES = {
  // Confidence farkı büyükse, yüksek olanı seç
  HIGHEST_CONFIDENCE: 'highest_confidence',

  // En detaylı değeri seç (daha uzun/kapsamlı)
  MOST_DETAILED: 'most_detailed',

  // En son chunk'tan gelen değer (döküman sonuna doğru daha güncel olabilir)
  LATEST_CHUNK: 'latest_chunk',

  // Belirli kaynak tiplerine öncelik ver
  SOURCE_PRIORITY: 'source_priority',

  // Değerleri birleştir (liste tipi alanlar için)
  MERGE_VALUES: 'merge_values',

  // Manuel inceleme gerekli
  MANUAL_REVIEW: 'manual_review',
};

// Kaynak öncelik sırası (yüksek = daha güvenilir)
const SOURCE_PRIORITY = {
  tablo: 5, // Tablolardan gelen veri en güvenilir
  form: 4, // Form alanları
  liste: 3, // Listeler
  baslik: 3, // Başlıklar
  paragraf: 2, // Normal paragraf
  unknown: 1, // Bilinmeyen kaynak
};

// Alan bazlı çözüm stratejileri
const FIELD_STRATEGIES = {
  // Tarihler - en yüksek confidence
  dates: RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE,
  'dates.ihale_tarihi': RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE,
  'dates.son_teklif_tarihi': RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE,
  'dates.baslangic': RESOLUTION_STRATEGIES.LATEST_CHUNK,
  'dates.bitis': RESOLUTION_STRATEGIES.LATEST_CHUNK,

  // Tutarlar - tablo > diğer
  amounts: RESOLUTION_STRATEGIES.SOURCE_PRIORITY,
  'amounts.yaklasik_maliyet': RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE,
  'amounts.birim_fiyat': RESOLUTION_STRATEGIES.SOURCE_PRIORITY,

  // Cezalar - birleştir (farklı cezalar olabilir)
  penalties: RESOLUTION_STRATEGIES.MERGE_VALUES,

  // Yemek bilgileri - tablo öncelikli
  meals: RESOLUTION_STRATEGIES.SOURCE_PRIORITY,
  ogun_bilgileri: RESOLUTION_STRATEGIES.SOURCE_PRIORITY,

  // Personel - birleştir
  personnel: RESOLUTION_STRATEGIES.MERGE_VALUES,
  personel_detaylari: RESOLUTION_STRATEGIES.MERGE_VALUES,
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RESOLVER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Çelişkileri çöz
 * @param {Array} conflicts - detectConflicts'ten gelen çelişki listesi
 * @returns {Object} Çözüm raporu
 */
export function resolveConflicts(conflicts) {
  if (!conflicts || conflicts.length === 0) {
    return {
      resolved: [],
      unresolved: [],
      summary: { total: 0, resolved: 0, unresolved: 0 },
    };
  }

  const resolved = [];
  const unresolved = [];

  for (const conflict of conflicts) {
    const resolution = resolveConflict(conflict);

    if (resolution.success) {
      resolved.push({
        ...conflict,
        resolution,
        needs_review: false,
      });
    } else {
      unresolved.push({
        ...conflict,
        resolution,
        needs_review: true,
      });
    }
  }

  const summary = {
    total: conflicts.length,
    resolved: resolved.length,
    unresolved: unresolved.length,
    resolution_rate: Math.round((resolved.length / conflicts.length) * 100),
  };

  logger.info('Conflict resolution completed', {
    module: 'conflict-resolver',
    ...summary,
  });

  return { resolved, unresolved, summary };
}

/**
 * Tek bir çelişkiyi çöz
 * @param {Object} conflict - Çelişki objesi
 * @returns {Object} Çözüm
 */
function resolveConflict(conflict) {
  const { field, values, conflict_type: _conflict_type } = conflict;

  // Alan için strateji belirle
  const strategy = getStrategy(field);

  // Stratejiyi uygula
  switch (strategy) {
    case RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE:
      return resolveByConfidence(values, field);

    case RESOLUTION_STRATEGIES.MOST_DETAILED:
      return resolveByDetail(values, field);

    case RESOLUTION_STRATEGIES.LATEST_CHUNK:
      return resolveByChunkOrder(values, field);

    case RESOLUTION_STRATEGIES.SOURCE_PRIORITY:
      return resolveBySourcePriority(values, field);

    case RESOLUTION_STRATEGIES.MERGE_VALUES:
      return resolveByMerge(values, field);

    default:
      return {
        success: false,
        strategy: RESOLUTION_STRATEGIES.MANUAL_REVIEW,
        reason: 'Otomatik çözüm bulunamadı',
        selected_value: null,
        all_values: values,
      };
  }
}

/**
 * Alan için strateji belirle
 */
function getStrategy(field) {
  // Tam eşleşme
  if (FIELD_STRATEGIES[field]) {
    return FIELD_STRATEGIES[field];
  }

  // Alan grubuna göre (dates.xxx → dates)
  const fieldBase = field.split('.')[0];
  if (FIELD_STRATEGIES[fieldBase]) {
    return FIELD_STRATEGIES[fieldBase];
  }

  // Default: en yüksek confidence
  return RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * En yüksek confidence'a göre çöz
 */
function resolveByConfidence(values, _field) {
  const sorted = [...values].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const best = sorted[0];
  const second = sorted[1];

  // Confidence farkı yeterli mi?
  const confidenceDiff = (best.confidence || 0) - (second.confidence || 0);

  if (confidenceDiff >= 0.15) {
    return {
      success: true,
      strategy: RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE,
      reason: `Confidence farkı yeterli: ${best.confidence?.toFixed(2)} vs ${second.confidence?.toFixed(2)}`,
      selected_value: best.value,
      selected_item: best,
      confidence_diff: confidenceDiff,
    };
  }

  // Fark az, ama her ikisi de yüksek
  if ((best.confidence || 0) >= 0.8 && (second.confidence || 0) >= 0.8) {
    return {
      success: false,
      strategy: RESOLUTION_STRATEGIES.MANUAL_REVIEW,
      reason: 'Her iki değer de yüksek güvenlikli - manuel inceleme gerekli',
      selected_value: null,
      all_values: values,
    };
  }

  // Fark az ama en yüksek makul
  if ((best.confidence || 0) >= 0.6) {
    return {
      success: true,
      strategy: RESOLUTION_STRATEGIES.HIGHEST_CONFIDENCE,
      reason: `En yüksek confidence seçildi (fark az): ${best.confidence?.toFixed(2)}`,
      selected_value: best.value,
      selected_item: best,
      low_confidence_warning: true,
    };
  }

  return {
    success: false,
    strategy: RESOLUTION_STRATEGIES.MANUAL_REVIEW,
    reason: 'Tüm değerler düşük güvenlikli',
    selected_value: null,
    all_values: values,
  };
}

/**
 * En detaylı değere göre çöz
 */
function resolveByDetail(values, _field) {
  // Değer uzunluğuna göre sırala (daha uzun = daha detaylı)
  const sorted = [...values].sort((a, b) => {
    const lenA = String(a.value || '').length;
    const lenB = String(b.value || '').length;
    return lenB - lenA;
  });

  const best = sorted[0];

  // En detaylı değerin confidence'ı düşük mü?
  if ((best.confidence || 1) < 0.5) {
    return {
      success: false,
      strategy: RESOLUTION_STRATEGIES.MANUAL_REVIEW,
      reason: 'En detaylı değer düşük güvenlikli',
      selected_value: null,
      all_values: values,
    };
  }

  return {
    success: true,
    strategy: RESOLUTION_STRATEGIES.MOST_DETAILED,
    reason: 'En detaylı değer seçildi',
    selected_value: best.value,
    selected_item: best,
  };
}

/**
 * Chunk sırasına göre çöz (sonraki chunk öncelikli)
 */
function resolveByChunkOrder(values, _field) {
  const sorted = [...values].sort((a, b) => {
    const chunkA = parseInt(a.source_chunk_id?.replace('chunk_', '') || '0', 10);
    const chunkB = parseInt(b.source_chunk_id?.replace('chunk_', '') || '0', 10);
    return chunkB - chunkA; // Büyük chunk (sonraki) önce
  });

  const best = sorted[0];

  return {
    success: true,
    strategy: RESOLUTION_STRATEGIES.LATEST_CHUNK,
    reason: `Son chunk'tan gelen değer seçildi (${best.source_chunk_id})`,
    selected_value: best.value,
    selected_item: best,
  };
}

/**
 * Kaynak önceliğine göre çöz
 */
function resolveBySourcePriority(values, field) {
  // Context'ten kaynak tipini çıkar
  const withPriority = values.map((v) => ({
    ...v,
    priority: getSourcePriority(v.context),
  }));

  const sorted = withPriority.sort((a, b) => b.priority - a.priority);
  const best = sorted[0];

  // En yüksek öncelikli kaynak
  if (best.priority >= 4) {
    return {
      success: true,
      strategy: RESOLUTION_STRATEGIES.SOURCE_PRIORITY,
      reason: `Yüksek öncelikli kaynaktan (${getSourceType(best.context)}) seçildi`,
      selected_value: best.value,
      selected_item: best,
      source_type: getSourceType(best.context),
    };
  }

  // Tablo/form yoksa confidence'a bak
  return resolveByConfidence(values, field);
}

/**
 * Değerleri birleştir (liste tipi alanlar için)
 */
function resolveByMerge(values, _field) {
  // Unique değerleri al
  const uniqueValues = [];
  const seen = new Set();

  for (const v of values) {
    const normalized = normalizeForComparison(v.value);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueValues.push(v);
    }
  }

  return {
    success: true,
    strategy: RESOLUTION_STRATEGIES.MERGE_VALUES,
    reason: `${values.length} değer → ${uniqueValues.length} unique değer birleştirildi`,
    selected_value: uniqueValues.map((v) => v.value),
    merged_items: uniqueValues,
    merge_count: uniqueValues.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getSourcePriority(context) {
  if (!context) return SOURCE_PRIORITY.unknown;

  const ctx = context.toLowerCase();

  if (ctx.includes('tablo') || ctx.includes('table')) return SOURCE_PRIORITY.tablo;
  if (ctx.includes('form') || ctx.includes('alan')) return SOURCE_PRIORITY.form;
  if (ctx.includes('liste') || ctx.includes('madde')) return SOURCE_PRIORITY.liste;
  if (ctx.includes('başlık') || ctx.includes('header')) return SOURCE_PRIORITY.baslik;

  return SOURCE_PRIORITY.paragraf;
}

function getSourceType(context) {
  if (!context) return 'unknown';

  const ctx = context.toLowerCase();

  if (ctx.includes('tablo') || ctx.includes('table')) return 'tablo';
  if (ctx.includes('form') || ctx.includes('alan')) return 'form';
  if (ctx.includes('liste') || ctx.includes('madde')) return 'liste';
  if (ctx.includes('başlık') || ctx.includes('header')) return 'başlık';

  return 'paragraf';
}

function normalizeForComparison(value) {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,]/g, '');
}

/**
 * Çözülmüş çelişkileri analize uygula
 * @param {Object} analysis - Mevcut analiz
 * @param {Array} resolved - Çözülmüş çelişkiler
 * @returns {Object} Güncellenmiş analiz
 */
export function applyResolutions(analysis, resolved) {
  const updated = { ...analysis };

  for (const resolution of resolved) {
    if (!resolution.resolution?.success) continue;

    const { field, resolution: res } = resolution;
    const fieldParts = field.split('.');

    // Merge strategy için özel işlem
    if (res.strategy === RESOLUTION_STRATEGIES.MERGE_VALUES) {
      setNestedValue(updated, fieldParts, res.selected_value);
    } else if (res.selected_value !== null) {
      // Tek değer seçildi
      // Array içindeki değeri güncelle veya üst seviye değeri set et
      if (fieldParts.length === 2 && Array.isArray(getNestedValue(updated, [fieldParts[0]]))) {
        // dates.ihale_tarihi gibi bir alan - array'de güncelle
        const arr = getNestedValue(updated, [fieldParts[0]]) || [];
        const idx = arr.findIndex((item) => item.type === fieldParts[1]);
        if (idx >= 0) {
          arr[idx].value = res.selected_value;
          arr[idx].resolved_by = res.strategy;
        }
      } else {
        setNestedValue(updated, fieldParts, res.selected_value);
      }
    }
  }

  return updated;
}

// Nested value helpers
function getNestedValue(obj, path) {
  return path.reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const lastKey = path.pop();
  const target = path.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  resolveConflicts,
  applyResolutions,
  RESOLUTION_STRATEGIES,
};
