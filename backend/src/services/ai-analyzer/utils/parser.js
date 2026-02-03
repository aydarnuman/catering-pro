/**
 * Parser Utils - JSON parse ve merge helpers
 */

import { EMPTY_ANALYSIS_RESULT, EMPTY_PAGE_RESULT } from '../core/prompts.js';

/**
 * AI yanıtından JSON çıkar
 * @param {string} responseText - Claude yanıtı
 * @param {Object} fallback - Parse edilemezse döndürülecek değer
 * @returns {Object}
 */
export function parseJsonResponse(responseText, fallback = null) {
  if (!responseText) return fallback;

  try {
    // Direkt JSON parse dene
    return JSON.parse(responseText);
  } catch {
    // JSON bloğunu bul
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parse edilemedi
    }
  }

  return fallback;
}

/**
 * Sayfa analiz sonucunu parse et
 * @param {string} responseText - Claude yanıtı
 * @returns {Object}
 */
export function parsePageAnalysis(responseText) {
  const parsed = parseJsonResponse(responseText);

  if (parsed) {
    const bilgi = parsed.tespit_edilen_bilgiler || {};
    return {
      sayfa_metni: parsed.sayfa_metni || '',
      tespit_edilen_bilgiler: {
        ihale_basligi: bilgi.ihale_basligi || '',
        kurum: bilgi.kurum || '',
        tarih: bilgi.tarih || '',
        bedel: bilgi.bedel || '',
        sure: bilgi.sure || '',
        ikn: bilgi.ikn || '',
        teknik_sartlar: bilgi.teknik_sartlar || [],
        birim_fiyatlar: bilgi.birim_fiyatlar || [],
        iletisim: bilgi.iletisim || {},
        notlar: bilgi.notlar || [],
        personel_detaylari: bilgi.personel_detaylari || [],
        ogun_bilgileri: bilgi.ogun_bilgileri || [],
        is_yerleri: bilgi.is_yerleri || [],
        mali_kriterler: bilgi.mali_kriterler || {},
        ceza_kosullari: bilgi.ceza_kosullari || [],
        fiyat_farki: bilgi.fiyat_farki || {},
        gerekli_belgeler: bilgi.gerekli_belgeler || [],
        teminat_oranlari: bilgi.teminat_oranlari || {},
        servis_saatleri: bilgi.servis_saatleri || {},
        sinir_deger_katsayisi: bilgi.sinir_deger_katsayisi || '',
        benzer_is_tanimi: bilgi.benzer_is_tanimi || '',
      },
    };
  }

  // Fallback: Ham metin döndür
  return {
    ...EMPTY_PAGE_RESULT,
    sayfa_metni: responseText || '',
  };
}

/**
 * Döküman analiz sonucunu parse et
 * @param {string} responseText - Claude yanıtı
 * @param {string} originalText - Orijinal metin (fallback için)
 * @returns {Object}
 */
export function parseDocumentAnalysis(responseText, originalText = '') {
  const parsed = parseJsonResponse(responseText);

  if (parsed) {
    return {
      tam_metin: parsed.tam_metin || '',
      ihale_basligi: parsed.ihale_basligi || '',
      kurum: parsed.kurum || '',
      tarih: parsed.tarih || '',
      bedel: parsed.bedel || '',
      sure: parsed.sure || '',
      ikn: parsed.ikn || '',
      gunluk_ogun_sayisi: parsed.gunluk_ogun_sayisi || '',
      kisi_sayisi: parsed.kisi_sayisi || '',
      teknik_sartlar: parsed.teknik_sartlar || [],
      birim_fiyatlar: parsed.birim_fiyatlar || [],
      iletisim: parsed.iletisim || {},
      notlar: parsed.notlar || [],
      // Yeni alanlar
      personel_detaylari: parsed.personel_detaylari || [],
      ogun_bilgileri: parsed.ogun_bilgileri || [],
      is_yerleri: parsed.is_yerleri || [],
      mali_kriterler: parsed.mali_kriterler || {},
      ceza_kosullari: parsed.ceza_kosullari || [],
      fiyat_farki: parsed.fiyat_farki || {},
      gerekli_belgeler: parsed.gerekli_belgeler || [],
      teminat_oranlari: parsed.teminat_oranlari || {},
      servis_saatleri: parsed.servis_saatleri || {},
      sinir_deger_katsayisi: parsed.sinir_deger_katsayisi || '',
      benzer_is_tanimi: parsed.benzer_is_tanimi || '',
    };
  }

  // Fallback
  return {
    ...EMPTY_ANALYSIS_RESULT,
    tam_metin: originalText.substring(0, 5000),
  };
}

/**
 * Birden fazla sayfa sonucunu birleştir
 * @param {Array} pages - Sayfa sonuçları array'i
 * @returns {Object}
 */
export function mergePageResults(pages) {
  const merged = {
    tam_metin: '',
    ihale_basligi: '',
    kurum: '',
    tarih: '',
    bedel: '',
    sure: '',
    ikn: '',
    teknik_sartlar: [],
    birim_fiyatlar: [],
    iletisim: {},
    notlar: [],
    // Yeni alanlar
    personel_detaylari: [],
    ogun_bilgileri: [],
    is_yerleri: [],
    mali_kriterler: {},
    ceza_kosullari: [],
    fiyat_farki: {},
    gerekli_belgeler: [],
    teminat_oranlari: {},
    servis_saatleri: {},
    sinir_deger_katsayisi: '',
    benzer_is_tanimi: '',
  };

  for (const page of pages) {
    if (!page) continue;

    // Metni birleştir
    if (page.sayfa_metni) {
      merged.tam_metin += page.sayfa_metni + '\n\n';
    }

    // Bilgileri birleştir (boş olmayanları al)
    const bilgi = page.tespit_edilen_bilgiler || {};

    // Temel string alanlar - ilk boş olmayanı al
    if (bilgi.ihale_basligi && !merged.ihale_basligi) {
      merged.ihale_basligi = bilgi.ihale_basligi;
    }
    if (bilgi.kurum && !merged.kurum) {
      merged.kurum = bilgi.kurum;
    }
    if (bilgi.tarih && !merged.tarih) {
      merged.tarih = bilgi.tarih;
    }
    if (bilgi.bedel && !merged.bedel) {
      merged.bedel = bilgi.bedel;
    }
    if (bilgi.sure && !merged.sure) {
      merged.sure = bilgi.sure;
    }
    if (bilgi.ikn && !merged.ikn) {
      merged.ikn = bilgi.ikn;
    }
    if (bilgi.sinir_deger_katsayisi && !merged.sinir_deger_katsayisi) {
      merged.sinir_deger_katsayisi = bilgi.sinir_deger_katsayisi;
    }
    if (bilgi.benzer_is_tanimi && !merged.benzer_is_tanimi) {
      merged.benzer_is_tanimi = bilgi.benzer_is_tanimi;
    }

    // Array alanlar - hepsini birleştir
    if (bilgi.teknik_sartlar?.length) {
      merged.teknik_sartlar.push(...bilgi.teknik_sartlar);
    }
    if (bilgi.birim_fiyatlar?.length) {
      merged.birim_fiyatlar.push(...bilgi.birim_fiyatlar);
    }
    if (bilgi.notlar?.length) {
      merged.notlar.push(...bilgi.notlar);
    }
    if (bilgi.personel_detaylari?.length) {
      merged.personel_detaylari.push(...bilgi.personel_detaylari);
    }
    if (bilgi.ogun_bilgileri?.length) {
      merged.ogun_bilgileri.push(...bilgi.ogun_bilgileri);
    }
    if (bilgi.is_yerleri?.length) {
      merged.is_yerleri.push(...bilgi.is_yerleri);
    }
    if (bilgi.ceza_kosullari?.length) {
      merged.ceza_kosullari.push(...bilgi.ceza_kosullari);
    }
    if (bilgi.gerekli_belgeler?.length) {
      merged.gerekli_belgeler.push(...bilgi.gerekli_belgeler);
    }

    // Object alanlar - merge et
    if (bilgi.iletisim && Object.keys(bilgi.iletisim).length) {
      merged.iletisim = { ...merged.iletisim, ...bilgi.iletisim };
    }
    if (bilgi.mali_kriterler && Object.keys(bilgi.mali_kriterler).length) {
      merged.mali_kriterler = { ...merged.mali_kriterler, ...bilgi.mali_kriterler };
    }
    if (bilgi.fiyat_farki && Object.keys(bilgi.fiyat_farki).length) {
      merged.fiyat_farki = { ...merged.fiyat_farki, ...bilgi.fiyat_farki };
    }
    if (bilgi.teminat_oranlari && Object.keys(bilgi.teminat_oranlari).length) {
      merged.teminat_oranlari = { ...merged.teminat_oranlari, ...bilgi.teminat_oranlari };
    }
    if (bilgi.servis_saatleri && Object.keys(bilgi.servis_saatleri).length) {
      merged.servis_saatleri = { ...merged.servis_saatleri, ...bilgi.servis_saatleri };
    }
  }

  // Duplikeleri temizle (string array'ler için)
  merged.teknik_sartlar = [...new Set(merged.teknik_sartlar)];
  merged.notlar = [...new Set(merged.notlar)];
  merged.is_yerleri = [...new Set(merged.is_yerleri)];

  return merged;
}

/**
 * Birden fazla döküman sonucunu birleştir (ZIP için)
 * @param {Array} results - Döküman sonuçları array'i
 * @returns {Object}
 */
export function mergeDocumentResults(results) {
  if (!results || results.length === 0) {
    return EMPTY_ANALYSIS_RESULT;
  }

  if (results.length === 1) {
    return results[0];
  }

  return {
    tam_metin: results.map((r) => r.tam_metin || '').join('\n\n---\n\n'),
    ihale_basligi: results.find((r) => r.ihale_basligi)?.ihale_basligi || '',
    kurum: results.find((r) => r.kurum)?.kurum || '',
    tarih: results.find((r) => r.tarih)?.tarih || '',
    bedel: results.find((r) => r.bedel)?.bedel || '',
    sure: results.find((r) => r.sure)?.sure || '',
    ikn: results.find((r) => r.ikn)?.ikn || '',
    gunluk_ogun_sayisi: results.find((r) => r.gunluk_ogun_sayisi)?.gunluk_ogun_sayisi || '',
    kisi_sayisi: results.find((r) => r.kisi_sayisi)?.kisi_sayisi || '',
    // Array alanlar - birleştir ve dedupe
    teknik_sartlar: [...new Set(results.flatMap((r) => r.teknik_sartlar || []))],
    birim_fiyatlar: results.flatMap((r) => r.birim_fiyatlar || []),
    notlar: [...new Set(results.flatMap((r) => r.notlar || []))],
    personel_detaylari: results.flatMap((r) => r.personel_detaylari || []),
    ogun_bilgileri: results.flatMap((r) => r.ogun_bilgileri || []),
    is_yerleri: [...new Set(results.flatMap((r) => r.is_yerleri || []))],
    ceza_kosullari: results.flatMap((r) => r.ceza_kosullari || []),
    gerekli_belgeler: results.flatMap((r) => r.gerekli_belgeler || []),
    // Object alanlar - merge
    iletisim: Object.assign({}, ...results.map((r) => r.iletisim || {})),
    mali_kriterler: Object.assign({}, ...results.map((r) => r.mali_kriterler || {})),
    fiyat_farki: Object.assign({}, ...results.map((r) => r.fiyat_farki || {})),
    teminat_oranlari: Object.assign({}, ...results.map((r) => r.teminat_oranlari || {})),
    servis_saatleri: Object.assign({}, ...results.map((r) => r.servis_saatleri || {})),
    // String alanlar - ilk boş olmayanı al
    sinir_deger_katsayisi: results.find((r) => r.sinir_deger_katsayisi)?.sinir_deger_katsayisi || '',
    benzer_is_tanimi: results.find((r) => r.benzer_is_tanimi)?.benzer_is_tanimi || '',
  };
}
