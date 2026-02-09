/**
 * Merge Results - Azure + Claude analiz sonuçlarını birleştirme
 * unified-pipeline.js'den extract edildi (refactoring)
 * 
 * Azure Document Intelligence ve Claude AI sonuçlarını akıllı merge eder:
 * - Confidence bazlı alan seçimi
 * - Claude öncelikli merge (Claude daha güvenilir semantic anlama)
 * - Azure prebuilt alanlarıyla zenginleştirme
 */

import logger from '../../../utils/logger.js';
import { detectTableType, extractGramajData, extractPersonnelData } from './table-helpers.js';

/**
 * Azure ve Claude sonuçlarını akıllı merge et
 * @param {Object} azureResult - Azure Document Intelligence sonucu
 * @param {Object} claudeAnalysis - Claude analiz sonucu
 * @returns {Object} Birleştirilmiş analiz
 */
export function mergeResults(azureResult, claudeAnalysis) {
  // ═══════════════════════════════════════════════════════════════════════
  // Azure Custom Model'den gelen alanlar - CONFIDENCE BİLGİSİ KORUNUYOR
  // ═══════════════════════════════════════════════════════════════════════
  const MIN_MERGE_CONFIDENCE = 0.4; // Merge'de Azure'un kazanması için min güven (0.5 -> 0.4 düşürüldü: catering alanları 0.3-0.5 arasında)
  const rawFields = azureResult.fields || {};
  const customFields = {};
  const fieldConfidences = {}; // confidence bilgisini ayrı tut

  for (const [key, field] of Object.entries(rawFields)) {
    if (field && typeof field === 'object') {
      customFields[key] = field.value || field.content || null;
      fieldConfidences[key] = field.confidence || 0;
      // Array alanları: items varsa value olarak stringify kullan, items'ı da sakla
      if (field.items) {
        customFields[key] = field.value || JSON.stringify(field.items);
      }
    } else {
      customFields[key] = field;
      fieldConfidences[key] = 1; // primitive değer = güvenli
    }
  }

  // Merge confidence loglama - hangi alanlar atılıyor?
  const mergeDropped = [];
  for (const [key, val] of Object.entries(customFields)) {
    const conf = fieldConfidences[key] || 0;
    if (val !== null && val !== undefined && val !== '' && conf < MIN_MERGE_CONFIDENCE) {
      mergeDropped.push({ key, confidence: Math.round(conf * 100) });
    }
  }
  if (mergeDropped.length > 0) {
    logger.info(`Merge confidence filtreleme: ${mergeDropped.length} alan conf < ${MIN_MERGE_CONFIDENCE} nedeniyle atılacak`, {
      module: 'unified-pipeline',
      droppedFields: mergeDropped.map(f => `${f.key}(${f.confidence}%)`).join(', '),
    });
  }

  // Azure tablolarından veri çıkar
  const tables = azureResult.tables || [];
  const extractedTables = {
    menus: [],
    gramaj: [],
    personnel: [],
  };

  for (const table of tables) {
    const type = detectTableType(table);
    if (type === 'menu') extractedTables.menus.push(table);
    else if (type === 'gramaj') extractedTables.gramaj.push(table);
    else if (type === 'personnel') extractedTables.personnel.push(table);
  }

  // Custom Model field'larını kullan - SADECE yüksek confidence varsa
  const getField = (...keys) => {
    for (const key of keys) {
      const val = customFields[key];
      const conf = fieldConfidences[key] || 0;
      if (val !== null && val !== undefined && val !== '' && conf >= MIN_MERGE_CONFIDENCE) return val;
    }
    return null;
  };

  // Azure prebuilt alanlarından değer al
  const prebuiltFields = {
    institution: customFields.VendorName || customFields.CustomerName || null,
    estimated_value: customFields.InvoiceTotal || customFields.toplam_tutar || null,
    address: customFields.VendorAddressRecipient || customFields.VendorAddress || null,
  };

  // ═══════════════════════════════════════════════════════════════════════
  // AKILLI MERGE: Claude kazanır EĞER Azure'un confidence'ı düşükse
  // ═══════════════════════════════════════════════════════════════════════
  const mergeObjectField = (azureObj, claudeObj) => {
    const result = {};
    const allKeys = new Set([...Object.keys(azureObj || {}), ...Object.keys(claudeObj || {})]);
    for (const key of allKeys) {
      const azureVal = azureObj?.[key];
      const claudeVal = claudeObj?.[key];

      // Claude Opus 4.6 daha güvenilir - Claude doluysa Claude'u tercih et
      // Azure sadece Claude boşsa veya "Belirtilmemiş" ise devreye girsin
      if (claudeVal && claudeVal !== '' && claudeVal !== 'Belirtilmemiş' && claudeVal !== null) {
        result[key] = claudeVal;
      } else if (azureVal && azureVal !== '' && azureVal !== 'Belirtilmemiş') {
        result[key] = azureVal;
      } else {
        result[key] = claudeVal || azureVal || '';
      }
    }
    return result;
  };

  // KRİTİK ALANLAR - Zero-Loss Pipeline ile uyumlu format
  const iletisim = mergeObjectField(
    customFields.iletisim || {
      adres: getField('adres', 'idare_adres') || prebuiltFields.address,
      telefon: getField('telefon', 'idare_telefon'),
      email: getField('email', 'idare_email'),
      yetkili: getField('yetkili', 'yetkili_kisi'),
    },
    claudeAnalysis.iletisim
  );

  const teminat_oranlari = mergeObjectField(
    customFields.teminat_oranlari || {
      gecici: getField('gecici_teminat', 'gecici_teminat_orani'),
      kesin: getField('kesin_teminat', 'kesin_teminat_orani'),
    },
    claudeAnalysis.teminat_oranlari
  );

  // Azure v5'te dagitim_saatleri var - parse edip servis saatlerine böl
  const parseDagitimSaatleri = (dagitim) => {
    if (!dagitim) return {};
    const str = String(dagitim).toLowerCase();
    const result = {};
    // "kahvaltı 07:00-08:30, öğle 12:00-13:00, akşam 18:00-19:00" gibi format
    const kahvaltiMatch = str.match(/kahvalt[ıi][:\s]*(\d{1,2}[:.]\d{2}[\s-–]*\d{1,2}[:.]\d{2})/);
    const ogleMatch = str.match(/[öo]ğle[:\s]*(\d{1,2}[:.]\d{2}[\s-–]*\d{1,2}[:.]\d{2})/);
    const aksamMatch = str.match(/akşam[:\s]*(\d{1,2}[:.]\d{2}[\s-–]*\d{1,2}[:.]\d{2})/);
    if (kahvaltiMatch) result.kahvalti = kahvaltiMatch[1];
    if (ogleMatch) result.ogle = ogleMatch[1];
    if (aksamMatch) result.aksam = aksamMatch[1];
    return result;
  };

  const dagitimParsed = parseDagitimSaatleri(getField('dagitim_saatleri'));
  const servis_saatleri = mergeObjectField(
    customFields.servis_saatleri || {
      kahvalti: getField('kahvalti_saati') || dagitimParsed.kahvalti,
      ogle: getField('ogle_saati') || dagitimParsed.ogle,
      aksam: getField('aksam_saati') || dagitimParsed.aksam,
    },
    claudeAnalysis.servis_saatleri
  );

  const mali_kriterler = mergeObjectField(
    customFields.mali_kriterler || {
      is_deneyimi: getField('is_deneyimi', 'is_deneyim_orani'),
      ozkaynak_orani: getField('ozkaynak_orani'),
      cari_oran: getField('cari_oran'),
    },
    claudeAnalysis.mali_kriterler
  );

  const tahmini_bedel =
    getField('tahmini_bedel', 'yaklasik_maliyet', 'estimated_value') ||
    claudeAnalysis.tahmini_bedel ||
    claudeAnalysis.summary?.estimated_value ||
    null;

  return {
    // Ana özet bilgileri
    summary: {
      title: getField('ihale_baslik', 'ihale_konusu', 'title') || claudeAnalysis.summary?.title || null,
      institution:
        getField('kurum_adi', 'idare', 'idare_adi', 'institution') ||
        prebuiltFields.institution ||
        claudeAnalysis.summary?.institution ||
        null,
      ikn: getField('ihale_kayit_no', 'ikn', 'ihale_kayit_numarasi') || claudeAnalysis.summary?.ikn || null,
      estimated_value: tahmini_bedel || prebuiltFields.estimated_value,
    },
    dates: {
      // Azure v5: ise_baslama_tarihi, is_bitis_tarihi
      start_date:
        getField('ise_baslama_tarihi', 'baslangic_tarihi', 'is_baslangic', 'start_date') ||
        claudeAnalysis.dates?.start_date || null,
      end_date:
        getField('is_bitis_tarihi', 'bitis_tarihi', 'is_bitis', 'end_date') ||
        claudeAnalysis.dates?.end_date || null,
      tender_date: getField('ihale_tarihi', 'tender_date') || claudeAnalysis.dates?.tender_date || null,
    },
    financial: {
      estimated_value: tahmini_bedel,
      guarantee_rate: getField('teminat_orani', 'gecici_teminat') || claudeAnalysis.financial?.guarantee_rate || null,
    },
    catering: {
      // Azure v5: toplam_personel_sayisi (toplam kişi = yemek yiyen), gunluk_toplam_ogun
      total_persons:
        getField('kisi_sayisi', 'toplam_kisi', 'total_persons') || claudeAnalysis.catering?.total_persons || null,
      daily_meals:
        getField('gunluk_toplam_ogun', 'gunluk_ogun', 'ogun_sayisi', 'daily_meals') ||
        claudeAnalysis.catering?.daily_meals || null,
      contract_duration:
        getField('sozlesme_suresi', 'sure') || claudeAnalysis.catering?.contract_duration || null,
      meal_types: getField('ogun_turleri', 'meal_types') || claudeAnalysis.catering?.meal_types || [],
      sample_menus: extractedTables.menus,
      gramaj: getField('gramaj_listesi', 'gramaj', 'gramaj_tablosu') || extractGramajData(extractedTables.gramaj),

      // ═══ AZURE v5 CATERİNG-SPESİFİK ALANLAR ═══
      // Kişi dağılımı (öğün bazlı)
      breakfast_persons:
        getField('kahvalti_kisi_sayisi') || claudeAnalysis.catering?.breakfast_persons || null,
      lunch_persons:
        getField('ogle_kisi_sayisi') || claudeAnalysis.catering?.lunch_persons || null,
      dinner_persons:
        getField('aksam_kisi_sayisi') || claudeAnalysis.catering?.dinner_persons || null,
      diet_persons:
        getField('diyet_kisi_sayisi') || claudeAnalysis.catering?.diet_persons || null,

      // Operasyonel bilgiler
      service_days:
        getField('hizmet_gun_sayisi') || claudeAnalysis.catering?.service_days || null,
      kitchen_type:
        getField('mutfak_tipi') || claudeAnalysis.catering?.kitchen_type || null,
      service_type:
        getField('servis_tipi') || claudeAnalysis.catering?.service_type || null,
      meat_type:
        getField('et_tipi') || claudeAnalysis.catering?.meat_type || null,
      meal_variety:
        getField('yemek_cesit_sayisi') || claudeAnalysis.catering?.meal_variety || null,
      cooking_location:
        getField('yemek_pisirilecek_yer') || claudeAnalysis.catering?.cooking_location || null,
      labor_rate:
        getField('iscilik_orani') || claudeAnalysis.catering?.labor_rate || null,
      delivery_hours:
        getField('dagitim_saatleri') || claudeAnalysis.catering?.delivery_hours || null,
      quality_standards:
        getField('kalite_standartlari') || claudeAnalysis.catering?.quality_standards || null,
      food_safety_docs:
        getField('gida_guvenligi_belgeleri') || claudeAnalysis.catering?.food_safety_docs || null,

      // Dağıtım ve ekipman
      distribution_points:
        getField('dagitim_noktalari') || claudeAnalysis.catering?.distribution_points || null,
      equipment_list:
        getField('ekipman_listesi') || claudeAnalysis.catering?.equipment_list || null,
      material_list:
        getField('malzeme_listesi') || claudeAnalysis.catering?.material_list || null,

      // Tablo verileri (Azure v5 custom model'den)
      meal_distribution:
        getField('ogun_dagilimi') || claudeAnalysis.catering?.meal_distribution || null,
      unit_price_table:
        getField('birim_fiyat_cetveli') || claudeAnalysis.catering?.unit_price_table || null,
      menu_table:
        getField('menu_tablosu') || claudeAnalysis.catering?.menu_table || null,
    },
    personnel: {
      // Azure v5: toplam_personel_sayisi, personel_tablosu
      total_count:
        getField('toplam_personel_sayisi', 'personel_sayisi', 'toplam_personel') ||
        claudeAnalysis.personnel?.total_count || null,
      staff:
        getField('personel_listesi', 'personel', 'personel_tablosu') ||
        extractPersonnelData(extractedTables.personnel),
    },
    technical_requirements: getField('teknik_sartlar') || claudeAnalysis.technical_requirements || [],
    penalties: getField('ceza_kosullari', 'cezalar') || claudeAnalysis.penalties || [],
    important_notes: getField('onemli_notlar', 'notlar') || claudeAnalysis.important_notes || [],

    // ═══════════════════════════════════════════════════════════════════════
    // KRİTİK ALANLAR - Zero-Loss Pipeline ile uyumlu (UI'da gösterilir)
    // ═══════════════════════════════════════════════════════════════════════
    iletisim,
    teminat_oranlari,
    servis_saatleri,
    mali_kriterler,
    tahmini_bedel,
  };
}
