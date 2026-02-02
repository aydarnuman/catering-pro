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
    return {
      sayfa_metni: parsed.sayfa_metni || '',
      tespit_edilen_bilgiler: {
        ihale_basligi: parsed.tespit_edilen_bilgiler?.ihale_basligi || '',
        kurum: parsed.tespit_edilen_bilgiler?.kurum || '',
        tarih: parsed.tespit_edilen_bilgiler?.tarih || '',
        bedel: parsed.tespit_edilen_bilgiler?.bedel || '',
        sure: parsed.tespit_edilen_bilgiler?.sure || '',
        teknik_sartlar: parsed.tespit_edilen_bilgiler?.teknik_sartlar || [],
        birim_fiyatlar: parsed.tespit_edilen_bilgiler?.birim_fiyatlar || [],
        iletisim: parsed.tespit_edilen_bilgiler?.iletisim || {},
        notlar: parsed.tespit_edilen_bilgiler?.notlar || [],
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
      gunluk_ogun_sayisi: parsed.gunluk_ogun_sayisi || '',
      kisi_sayisi: parsed.kisi_sayisi || '',
      teknik_sartlar: parsed.teknik_sartlar || [],
      birim_fiyatlar: parsed.birim_fiyatlar || [],
      iletisim: parsed.iletisim || {},
      notlar: parsed.notlar || [],
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
    teknik_sartlar: [],
    birim_fiyatlar: [],
    iletisim: {},
    notlar: [],
  };

  for (const page of pages) {
    if (!page) continue;

    // Metni birleştir
    if (page.sayfa_metni) {
      merged.tam_metin += page.sayfa_metni + '\n\n';
    }

    // Bilgileri birleştir (boş olmayanları al)
    const bilgi = page.tespit_edilen_bilgiler || {};

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
    if (bilgi.teknik_sartlar?.length) {
      merged.teknik_sartlar.push(...bilgi.teknik_sartlar);
    }
    if (bilgi.birim_fiyatlar?.length) {
      merged.birim_fiyatlar.push(...bilgi.birim_fiyatlar);
    }
    if (bilgi.iletisim && Object.keys(bilgi.iletisim).length) {
      merged.iletisim = { ...merged.iletisim, ...bilgi.iletisim };
    }
    if (bilgi.notlar?.length) {
      merged.notlar.push(...bilgi.notlar);
    }
  }

  // Duplikeleri temizle
  merged.teknik_sartlar = [...new Set(merged.teknik_sartlar)];
  merged.notlar = [...new Set(merged.notlar)];

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
    gunluk_ogun_sayisi: results.find((r) => r.gunluk_ogun_sayisi)?.gunluk_ogun_sayisi || '',
    kisi_sayisi: results.find((r) => r.kisi_sayisi)?.kisi_sayisi || '',
    teknik_sartlar: [...new Set(results.flatMap((r) => r.teknik_sartlar || []))],
    birim_fiyatlar: results.flatMap((r) => r.birim_fiyatlar || []),
    iletisim: Object.assign({}, ...results.map((r) => r.iletisim || {})),
    notlar: [...new Set(results.flatMap((r) => r.notlar || []))],
  };
}
