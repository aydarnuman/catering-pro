/**
 * Doküman Tipine Özel Prompt'lar - Index
 *
 * Her ihale doküman tipi için ayrı prompt tanımlar.
 * Doküman tipi dosya adından veya DB doc_type/content_type'dan tespit edilir.
 */

import birimFiyatCetveli from './birim-fiyat-cetveli.js';
import idariSartname from './idari-sartname.js';
import ilanMetni from './ilan-metni.js';
import malHizmetListesi from './mal-hizmet-listesi.js';
import sozlesmeTasarisi from './sozlesme-tasarisi.js';
import teknikSartname from './teknik-sartname.js';

/**
 * Doküman tipine özel prompt registry
 */
export const DOC_TYPE_PROMPTS = {
  ilan: ilanMetni,
  announcement: ilanMetni,
  idari_sartname: idariSartname,
  admin_spec: idariSartname,
  idari: idariSartname,
  sozlesme: sozlesmeTasarisi,
  sozlesme_tasarisi: sozlesmeTasarisi,
  contract: sozlesmeTasarisi,
  teknik_sartname: teknikSartname,
  tech_spec: teknikSartname,
  teknik: teknikSartname,
  mal_hizmet_listesi: malHizmetListesi,
  goods_services: malHizmetListesi,
  birim_fiyat: birimFiyatCetveli,
  birim_fiyat_cetveli: birimFiyatCetveli,
  unit_price: birimFiyatCetveli,
};

/**
 * Dosya adından doküman tipini tespit et
 * @param {string} filename - Dosya adı
 * @returns {string|null} Tespit edilen doküman tipi
 */
export function detectDocTypeFromFilename(filename) {
  if (!filename) return null;
  const lower = filename.toLowerCase();

  // İdari Şartname
  if (lower.includes('idari') && (lower.includes('sart') || lower.includes('şart'))) return 'idari_sartname';
  if (lower.includes('admin_spec') || lower.includes('idari_sartname')) return 'idari_sartname';

  // Teknik Şartname
  if (lower.includes('teknik') && (lower.includes('sart') || lower.includes('şart'))) return 'teknik_sartname';
  if (lower.includes('tech_spec') || lower.includes('teknik_sartname')) return 'teknik_sartname';

  // Sözleşme Tasarısı
  if (lower.includes('sozlesme') || lower.includes('sözleşme')) return 'sozlesme';
  if (lower.includes('contract')) return 'sozlesme';

  // Birim Fiyat Cetveli
  if (lower.includes('birim') && lower.includes('fiyat')) return 'birim_fiyat';
  if (lower.includes('unit_price')) return 'birim_fiyat';
  if (lower.includes('teklif_cetveli') || lower.includes('teklif cetveli')) return 'birim_fiyat';

  // İlan
  if (lower.includes('ilan') || lower.includes('ihale-ilani')) return 'ilan';
  if (lower.includes('announcement')) return 'ilan';

  // Mal/Hizmet Listesi
  if (lower.includes('mal') && lower.includes('hizmet')) return 'mal_hizmet_listesi';
  if (lower.includes('goods') || lower.includes('services')) return 'mal_hizmet_listesi';

  // Zeyilname
  if (lower.includes('zeyilname') || lower.includes('addendum')) return null; // Genel prompt kullan

  return null;
}

/**
 * DB alanlarından doküman tipini tespit et
 * @param {Object} doc - Doküman objesi (doc_type, content_type, filename, storage_path)
 * @returns {string|null} Tespit edilen doküman tipi
 */
export function detectDocType(doc) {
  // 1. content_type varsa öncelik ver (scrape edilen içerikler)
  if (doc.content_type) {
    const mapped = DOC_TYPE_PROMPTS[doc.content_type] ? doc.content_type : null;
    if (mapped) return mapped;
  }

  // 2. doc_type varsa
  if (doc.doc_type && DOC_TYPE_PROMPTS[doc.doc_type]) {
    return doc.doc_type;
  }

  // 3. storage_path'ten tespit (tenders/289/tech_spec/... gibi)
  if (doc.storage_path) {
    const pathParts = doc.storage_path.split('/');
    for (const part of pathParts) {
      if (DOC_TYPE_PROMPTS[part]) return part;
    }
  }

  // 4. Dosya adından tespit
  const fromFilename = detectDocTypeFromFilename(doc.filename || doc.original_filename);
  if (fromFilename) return fromFilename;

  return null;
}

/**
 * Doküman tipine göre prompt al
 * @param {string} docType - Doküman tipi
 * @returns {Object|null} Prompt tanımı { prompt, schema, type }
 */
export function getDocTypePrompt(docType) {
  if (!docType) return null;
  return DOC_TYPE_PROMPTS[docType] || null;
}

export default {
  DOC_TYPE_PROMPTS,
  detectDocType,
  detectDocTypeFromFilename,
  getDocTypePrompt,
};
