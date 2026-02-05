/**
 * Layer 6: Assembly - JSON Birleştirme
 *
 * P0-08: Stage 2 çıktısında, Stage 1 çıktılarında bulunmayan bilgi OLMAMALI.
 * Bu modül sadece BİRLEŞTİRİR, yeni bilgi EKLEMEZ.
 */

import logger from '../../../utils/logger.js';
import { createTextHash } from '../controls/p0-checks.js';

/**
 * Değer birleştirme stratejileri
 */
const _MERGE_STRATEGIES = {
  // İlk bulunandan al (string değerler için)
  FIRST_NON_EMPTY: 'first_non_empty',
  // Tümünü birleştir (array değerler için)
  CONCATENATE: 'concatenate',
  // En yüksek güvenli olanı al
  HIGHEST_CONFIDENCE: 'highest_confidence',
  // Merge et (object değerler için)
  MERGE_OBJECTS: 'merge_objects',
};

/**
 * Değerleri dedupe et (tekrarları kaldır)
 * @param {Array} values - Değer listesi
 * @param {Function} keyFn - Anahtar oluşturma fonksiyonu
 * @returns {Array} Dedupe edilmiş liste
 */
function dedupeValues(values, keyFn = (v) => JSON.stringify(v)) {
  const seen = new Map();

  for (const value of values) {
    const key = keyFn(value);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, value);
    } else {
      // Daha yüksek güvenli olanı tut
      if ((value.confidence || 0) > (existing.confidence || 0)) {
        seen.set(key, value);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * String değer için anahtar oluştur (dedupe için)
 */
function createValueKey(item) {
  const value = item.value ?? item.rate ?? item.description ?? '';
  const type = item.type ?? '';
  return `${type}:${String(value).toLowerCase().trim()}`;
}

/**
 * Chunk sonuçlarından tarihleri birleştir
 * @param {Array} chunkResults - Chunk sonuçları
 * @returns {Array} Birleştirilmiş tarihler
 */
function assembleDates(chunkResults) {
  const allDates = [];

  for (const chunkResult of chunkResults) {
    if (!chunkResult || chunkResult.error) continue;

    const data = chunkResult.extractedData || chunkResult;
    const dates = data.dates || data.tarihler || [];

    for (const date of dates) {
      if (!date.value) continue;

      allDates.push({
        value: date.value,
        type: date.type,
        raw_text: date.raw_text,
        context: date.context,
        confidence: date.confidence || 1.0,
        source_chunk_id: chunkResult.chunk_id || chunkResult.chunkIndex,
        source_position: date.source_position,
      });
    }
  }

  // Dedupe
  return dedupeValues(allDates, createValueKey);
}

/**
 * Chunk sonuçlarından tutarları birleştir
 * @param {Array} chunkResults - Chunk sonuçları
 * @returns {Array} Birleştirilmiş tutarlar
 */
function assembleAmounts(chunkResults) {
  const allAmounts = [];

  for (const chunkResult of chunkResults) {
    if (!chunkResult || chunkResult.error) continue;

    const data = chunkResult.extractedData || chunkResult;
    const amounts = data.amounts || data.tutarlar || [];

    for (const amount of amounts) {
      if (!amount.value) continue;

      allAmounts.push({
        value: amount.value,
        numeric_value: amount.numeric_value,
        type: amount.type,
        currency: amount.currency,
        includes_kdv: amount.includes_kdv,
        unit: amount.unit,
        description: amount.description,
        context: amount.context,
        confidence: amount.confidence || 1.0,
        source_chunk_id: chunkResult.chunk_id || chunkResult.chunkIndex,
        source_position: amount.source_position,
      });
    }
  }

  return dedupeValues(allAmounts, createValueKey);
}

/**
 * Chunk sonuçlarından cezaları birleştir
 * @param {Array} chunkResults - Chunk sonuçları
 * @returns {Array} Birleştirilmiş cezalar
 */
function assemblePenalties(chunkResults) {
  const allPenalties = [];

  for (const chunkResult of chunkResults) {
    if (!chunkResult || chunkResult.error) continue;

    const data = chunkResult.extractedData || chunkResult;
    const penalties = data.penalties || data.cezalar || [];

    for (const penalty of penalties) {
      allPenalties.push({
        type: penalty.type,
        rate: penalty.rate,
        rate_numeric: penalty.rate_numeric,
        period: penalty.period,
        base: penalty.base,
        max_limit: penalty.max_limit,
        description: penalty.description,
        trigger_condition: penalty.trigger_condition,
        context: penalty.context,
        confidence: penalty.confidence || 1.0,
        source_chunk_id: chunkResult.chunk_id || chunkResult.chunkIndex,
        source_position: penalty.source_position,
        related_article: penalty.related_article,
      });
    }
  }

  // Cezalar için özel dedupe (type + rate kombinasyonu)
  return dedupeValues(allPenalties, (p) => `${p.type}:${p.rate}:${p.period || ''}`);
}

/**
 * Chunk sonuçlarından menü bilgilerini birleştir
 * @param {Array} chunkResults - Chunk sonuçları
 * @returns {Object} Birleştirilmiş menü bilgileri
 */
function assembleMenus(chunkResults) {
  const result = {
    meals: [],
    gramaj: [],
    calories: [],
    quality_requirements: [],
    menu_options: [],
    service_times: {},
  };

  for (const chunkResult of chunkResults) {
    if (!chunkResult || chunkResult.error) continue;

    const data = chunkResult.extractedData || chunkResult;
    const chunkId = chunkResult.chunk_id || chunkResult.chunkIndex;

    // Öğünler
    const meals = data.meals || data.ogun_bilgileri || [];
    for (const meal of meals) {
      result.meals.push({
        ...meal,
        source_chunk_id: chunkId,
      });
    }

    // Gramajlar
    const gramaj = data.gramaj || data.gramaj_bilgileri || [];
    for (const g of gramaj) {
      result.gramaj.push({
        ...g,
        source_chunk_id: chunkId,
      });
    }

    // Kaloriler
    const calories = data.calories || [];
    for (const c of calories) {
      result.calories.push({
        ...c,
        source_chunk_id: chunkId,
      });
    }

    // Kalite gereksinimleri
    const quality = data.quality_requirements || [];
    for (const q of quality) {
      result.quality_requirements.push({
        ...q,
        source_chunk_id: chunkId,
      });
    }

    // Menü seçenekleri
    const options = data.menu_options || [];
    for (const o of options) {
      result.menu_options.push({
        ...o,
        source_chunk_id: chunkId,
      });
    }

    // Servis saatleri (merge)
    if (data.service_times) {
      result.service_times = { ...result.service_times, ...data.service_times };
    }
  }

  // Dedupe
  result.meals = dedupeValues(result.meals, (m) => `${m.type}:${m.daily_count || m.miktar}`);
  result.gramaj = dedupeValues(result.gramaj, (g) => `${g.item}:${g.weight}:${g.meal_type || ''}`);

  return result;
}

/**
 * Chunk sonuçlarından personel bilgilerini birleştir
 * @param {Array} chunkResults - Chunk sonuçları
 * @returns {Object} Birleştirilmiş personel bilgileri
 */
function assemblePersonnel(chunkResults) {
  const result = {
    staff: [],
    qualifications: [],
    working_conditions: [],
    wage_info: [],
    total_count: null,
  };

  for (const chunkResult of chunkResults) {
    if (!chunkResult || chunkResult.error) continue;

    const data = chunkResult.extractedData || chunkResult;
    const chunkId = chunkResult.chunk_id || chunkResult.chunkIndex;

    // Personel
    const personnel = data.personnel || data.personel_detaylari || [];
    for (const p of personnel) {
      result.staff.push({
        ...p,
        source_chunk_id: chunkId,
      });
    }

    // Nitelikler
    const qualifications = data.qualifications || [];
    for (const q of qualifications) {
      result.qualifications.push({
        ...q,
        source_chunk_id: chunkId,
      });
    }

    // Çalışma koşulları
    const conditions = data.working_conditions || [];
    for (const c of conditions) {
      result.working_conditions.push({
        ...c,
        source_chunk_id: chunkId,
      });
    }

    // Ücret bilgileri
    const wages = data.wage_info || [];
    for (const w of wages) {
      result.wage_info.push({
        ...w,
        source_chunk_id: chunkId,
      });
    }

    // Toplam sayı
    if (data.total_personnel_count && !result.total_count) {
      result.total_count = data.total_personnel_count;
    }
  }

  // Dedupe
  result.staff = dedupeValues(result.staff, (s) => `${s.position}:${s.count || s.min_count}`);

  return result;
}

/**
 * Tüm chunk sonuçlarını birleştir
 * @param {Array} chunkResults - Chunk analiz sonuçları
 * @param {Array} conflicts - Tespit edilen çelişkiler
 * @returns {Object} Birleştirilmiş sonuç
 */
export function assembleResults(chunkResults, conflicts = []) {
  if (!chunkResults || chunkResults.length === 0) {
    return {
      fields: {
        dates: [],
        amounts: [],
        penalties: [],
        menus: {},
        personnel: {},
      },
      conflicts,
      assembly_metadata: {
        source_chunks: 0,
        assembly_time: 0,
      },
    };
  }

  const startTime = Date.now();

  // Her alan için birleştir
  const dates = assembleDates(chunkResults);
  const amounts = assembleAmounts(chunkResults);
  const penalties = assemblePenalties(chunkResults);
  const menus = assembleMenus(chunkResults);
  const personnel = assemblePersonnel(chunkResults);

  // Teknik şartlar ve notlar
  const technicalRequirements = [];
  const importantNotes = [];
  const requiredDocuments = [];

  // KRİTİK ALANLAR (Layer 6.5 için)
  const iletisim = {};
  const teminat_oranlari = {};
  const servis_saatleri = {};
  const mali_kriterler = {};
  let tahmini_bedel = null;

  for (const chunkResult of chunkResults) {
    if (!chunkResult || chunkResult.error) continue;

    const data = chunkResult.extractedData || chunkResult;
    const chunkId = chunkResult.chunk_id || chunkResult.chunkIndex;

    // Teknik şartlar
    const techReqs = data.teknik_sartlar || [];
    for (const req of techReqs) {
      if (typeof req === 'string') {
        technicalRequirements.push({
          requirement: req,
          source_chunk_id: chunkId,
        });
      } else {
        technicalRequirements.push({
          ...req,
          source_chunk_id: chunkId,
        });
      }
    }

    // Önemli notlar
    const notes = data.onemli_notlar || data.notlar || [];
    for (const note of notes) {
      if (typeof note === 'string') {
        importantNotes.push({
          note,
          source_chunk_id: chunkId,
        });
      } else {
        importantNotes.push({
          ...note,
          source_chunk_id: chunkId,
        });
      }
    }

    // Gerekli belgeler
    const docs = data.gerekli_belgeler || [];
    for (const doc of docs) {
      requiredDocuments.push({
        ...doc,
        source_chunk_id: chunkId,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // KRİTİK ALANLAR (validateCriticalFields ile uyumlu isimler)
    // ═══════════════════════════════════════════════════════════════

    // İletişim
    if (data.iletisim) {
      const il = data.iletisim;
      // Sadece gerçek değeri olan alanları al (boş string veya "Belirtilmemiş" hariç)
      if (il.telefon && il.telefon !== '' && il.telefon !== 'Belirtilmemiş') {
        iletisim.telefon = il.telefon;
      }
      if (il.email && il.email !== '' && il.email !== 'Belirtilmemiş') {
        iletisim.email = il.email;
      }
      if (il.adres && il.adres !== '' && il.adres !== 'Belirtilmemiş') {
        iletisim.adres = il.adres;
      }
      if (il.yetkili && il.yetkili !== '' && il.yetkili !== 'Belirtilmemiş') {
        iletisim.yetkili = il.yetkili;
      }
      if (il.yetkili_kisi && il.yetkili_kisi !== '' && il.yetkili_kisi !== 'Belirtilmemiş') {
        iletisim.yetkili_kisi = il.yetkili_kisi;
      }
    }

    // Teminat oranları
    if (data.teminat_oranlari) {
      const tem = data.teminat_oranlari;
      if (tem.gecici && tem.gecici !== '' && tem.gecici !== 'Belirtilmemiş') {
        teminat_oranlari.gecici = tem.gecici;
      }
      if (tem.kesin && tem.kesin !== '' && tem.kesin !== 'Belirtilmemiş') {
        teminat_oranlari.kesin = tem.kesin;
      }
    }

    // Servis saatleri
    if (data.servis_saatleri) {
      const srv = data.servis_saatleri;
      if (srv.kahvalti && srv.kahvalti !== '' && srv.kahvalti !== 'Belirtilmemiş') {
        servis_saatleri.kahvalti = srv.kahvalti;
      }
      if (srv.ogle && srv.ogle !== '' && srv.ogle !== 'Belirtilmemiş') {
        servis_saatleri.ogle = srv.ogle;
      }
      if (srv.aksam && srv.aksam !== '' && srv.aksam !== 'Belirtilmemiş') {
        servis_saatleri.aksam = srv.aksam;
      }
    }

    // Mali kriterler
    if (data.mali_kriterler) {
      const mk = data.mali_kriterler;
      if (mk.cari_oran && mk.cari_oran !== '' && mk.cari_oran !== 'Belirtilmemiş') {
        mali_kriterler.cari_oran = mk.cari_oran;
      }
      if (mk.ozkaynak_orani && mk.ozkaynak_orani !== '' && mk.ozkaynak_orani !== 'Belirtilmemiş') {
        mali_kriterler.ozkaynak_orani = mk.ozkaynak_orani;
      }
      if (mk.is_deneyimi && mk.is_deneyimi !== '' && mk.is_deneyimi !== 'Belirtilmemiş') {
        mali_kriterler.is_deneyimi = mk.is_deneyimi;
      }
      if (mk.banka_referans && mk.banka_referans !== '' && mk.banka_referans !== 'Belirtilmemiş') {
        mali_kriterler.banka_referans = mk.banka_referans;
      }
    }

    // Tahmini bedel
    if (!tahmini_bedel) {
      const bedel = data.tahmini_bedel || data.yaklasik_maliyet;
      if (bedel && bedel !== '' && bedel !== 'Belirtilmemiş') {
        tahmini_bedel = bedel;
      }
    }
  }

  const duration = Date.now() - startTime;

  // P0-08: Assembly sonucu sadece chunk'lardan gelen veriyi içermeli
  // Yeni bilgi EKLENMEZ
  const result = {
    // KRİTİK ALANLAR (Layer 6.5 validateCriticalFields için - top level)
    iletisim: Object.keys(iletisim).length > 0 ? iletisim : null,
    teminat_oranlari: Object.keys(teminat_oranlari).length > 0 ? teminat_oranlari : null,
    servis_saatleri: Object.keys(servis_saatleri).length > 0 ? servis_saatleri : null,
    mali_kriterler: Object.keys(mali_kriterler).length > 0 ? mali_kriterler : null,
    tahmini_bedel: tahmini_bedel,

    // DİĞER ALANLAR
    fields: {
      dates,
      amounts,
      penalties,
      menus,
      personnel,
      requirements: dedupeValues(technicalRequirements, (r) => r.requirement || JSON.stringify(r)),
      required_documents: dedupeValues(requiredDocuments, (d) => d.belge || d.document_name),
    },
    important_notes: dedupeValues(importantNotes, (n) => n.note || JSON.stringify(n)),
    conflicts,
    assembly_metadata: {
      source_chunks: chunkResults.length,
      successful_chunks: chunkResults.filter((c) => !c.error).length,
      assembly_time: duration,
      total_findings: dates.length + amounts.length + penalties.length,
      content_hash: createTextHash(JSON.stringify({ dates, amounts, penalties })),
      critical_fields_status: {
        iletisim: Object.keys(iletisim).length > 0,
        teminat_oranlari: Object.keys(teminat_oranlari).length > 0,
        servis_saatleri: Object.keys(servis_saatleri).length > 0,
        mali_kriterler: Object.keys(mali_kriterler).length > 0,
        tahmini_bedel: !!tahmini_bedel,
      },
    },
  };

  logger.info('Assembly completed', {
    module: 'assembler',
    chunks: chunkResults.length,
    dates: dates.length,
    amounts: amounts.length,
    penalties: penalties.length,
    conflicts: conflicts.length,
    duration: `${duration}ms`,
    criticalFields: {
      iletisim: Object.keys(iletisim).length > 0 ? Object.keys(iletisim) : null,
      teminat: Object.keys(teminat_oranlari).length > 0,
      servis: Object.keys(servis_saatleri).length > 0,
      mali: Object.keys(mali_kriterler).length > 0,
      bedel: !!tahmini_bedel,
    },
  });

  return result;
}

/**
 * P0-08: Stage 1 ve Stage 2 sonuçlarını karşılaştır
 * Stage 2'de Stage 1'de olmayan bilgi olmamalı
 * @param {Array} stage1Results - Stage 1 chunk sonuçları
 * @param {Object} stage2Result - Stage 2 birleştirme sonucu
 * @returns {{ valid: boolean, newValues: Array }}
 */
export function validateNoNewInformation(stage1Results, stage2Result) {
  // Stage 1'deki tüm değerleri topla
  const stage1Values = new Set();

  for (const chunk of stage1Results) {
    if (!chunk || chunk.error) continue;

    const data = chunk.extractedData || chunk;

    // Tüm array alanlarındaki değerleri ekle
    const fields = ['dates', 'tarihler', 'amounts', 'tutarlar', 'penalties', 'cezalar'];
    for (const field of fields) {
      const items = data[field] || [];
      for (const item of items) {
        const value = item.value ?? item.rate ?? item.description;
        if (value) {
          stage1Values.add(String(value).toLowerCase().trim());
        }
      }
    }
  }

  // Stage 2 değerlerini kontrol et
  const newValues = [];
  const fieldsToCheck = ['dates', 'amounts', 'penalties'];

  for (const field of fieldsToCheck) {
    const items = stage2Result?.fields?.[field] || [];
    for (const item of items) {
      const value = item.value ?? item.rate ?? item.description;
      if (!value) continue;

      const normalizedValue = String(value).toLowerCase().trim();
      if (!stage1Values.has(normalizedValue)) {
        // Kısmi eşleşme dene
        const hasPartialMatch = Array.from(stage1Values).some(
          (v) => v.includes(normalizedValue) || normalizedValue.includes(v)
        );

        if (!hasPartialMatch) {
          newValues.push({
            field,
            value,
            source: 'stage2_only',
          });
        }
      }
    }
  }

  return {
    valid: newValues.length === 0,
    newValues,
  };
}

export default {
  assembleResults,
  validateNoNewInformation,
  assembleDates,
  assembleAmounts,
  assemblePenalties,
  assembleMenus,
  assemblePersonnel,
};
