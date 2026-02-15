/**
 * Birim Doğrulama Utility
 * Tüm giriş noktalarında kullanılan merkezi birim validasyonu.
 *
 * KURAL:
 * - Ürün kartı birimleri: kg, lt, adet, demet, paket, porsiyon (gr/ml YASAK)
 * - Reçete malzeme birimleri: g, gr, kg, ml, lt, adet, porsiyon, dilim, tutam, demet, paket
 * - Fiyat üst limitleri birime göre değişir
 */

import { donusumCarpaniAl } from './birim-donusum.js';

// ─── Sabitler ────────────────────────────────────────────────────

/** Ürün kartı seviyesinde izin verilen birimler */
const URUN_BIRIMLER = ['kg', 'lt', 'adet', 'demet', 'paket', 'porsiyon'];

/** Reçete malzeme seviyesinde izin verilen birimler */
const RECETE_BIRIMLER = ['g', 'gr', 'kg', 'ml', 'lt', 'l', 'adet', 'porsiyon', 'dilim', 'tutam', 'demet', 'paket'];

/** Birim normalizasyon map'i (ürün kartı → standart birime dönüştür) */
const URUN_BIRIM_NORMALIZE = {
  kg: 'kg',
  kilo: 'kg',
  kilogram: 'kg',
  gr: 'kg',
  g: 'kg',
  gram: 'kg',
  lt: 'lt',
  l: 'lt',
  litre: 'lt',
  ml: 'lt',
  mililitre: 'lt',
  adet: 'adet',
  ad: 'adet',
  demet: 'demet',
  paket: 'paket',
  pkt: 'paket',
  porsiyon: 'porsiyon',
  prs: 'porsiyon',
};

/** Fiyat üst limitleri (birime göre TL) */
const FIYAT_UST_LIMIT = {
  kg: 50000,
  lt: 50000,
  adet: 10000,
  demet: 5000,
  paket: 10000,
  porsiyon: 5000,
};

// ─── Doğrulama Fonksiyonları ─────────────────────────────────────

/**
 * Ürün kartı birimi doğrula ve normalize et
 * gr→kg, ml→lt otomatik dönüşüm yapar
 * @param {string} birim
 * @returns {{ valid: boolean, birim: string, error?: string }}
 */
export function validateUrunBirim(birim) {
  if (!birim || !birim.trim()) {
    return { valid: true, birim: 'kg' }; // Varsayılan
  }

  const lower = birim.toLowerCase().trim();
  const normalized = URUN_BIRIM_NORMALIZE[lower];

  if (!normalized) {
    return {
      valid: false,
      birim: lower,
      error: `Geçersiz ürün birimi: "${birim}". İzin verilen: ${URUN_BIRIMLER.join(', ')}`,
    };
  }

  return { valid: true, birim: normalized };
}

/**
 * Reçete malzeme birimi doğrula
 * @param {string} birim
 * @returns {{ valid: boolean, birim: string, error?: string }}
 */
export function validateReceteBirim(birim) {
  if (!birim || !birim.trim()) {
    return { valid: true, birim: 'g' }; // Varsayılan
  }

  const lower = birim.toLowerCase().trim();

  if (!RECETE_BIRIMLER.includes(lower)) {
    return {
      valid: false,
      birim: lower,
      error: `Geçersiz reçete birimi: "${birim}". İzin verilen: ${RECETE_BIRIMLER.join(', ')}`,
    };
  }

  return { valid: true, birim: lower };
}

/**
 * Birim uyumluluk kontrolü: malzeme birimi → ürün birimi dönüşüm yolu var mı?
 * @param {string} malzemeBirim - reçete malzeme birimi (gr, ml, adet)
 * @param {string} urunBirim - ürün kartı birimi (kg, lt, adet)
 * @param {number|null} urunKartId - ürüne özel dönüşüm kontrolü için
 * @returns {Promise<{ uyumlu: boolean, carpan: number, uyari?: string }>}
 */
export async function validateBirimUyumluluk(malzemeBirim, urunBirim, urunKartId = null) {
  const carpan = await donusumCarpaniAl(malzemeBirim, urunBirim, urunKartId);

  // Aynı birimse (normalize sonrası) sorun yok
  const mLower = (malzemeBirim || '').toLowerCase().trim();
  const uLower = (urunBirim || '').toLowerCase().trim();
  if (mLower === uLower) {
    return { uyumlu: true, carpan: 1 };
  }

  // Çarpan 1 döndü ama birimler farklı → muhtemelen tanımsız dönüşüm
  if (carpan === 1) {
    // Bilinen güvenli dönüşümler: SADECE aynı birim varyasyonları (çarpan gerçekten 1 olanlar)
    // g:kg (0.001), gr:kg (0.001), ml:lt (0.001) ÇIKARILDI — carpan=1 dönüyorsa hatalıdır
    const guvenliCiftler = new Set([
      'kg:kg',
      'lt:lt',
      'g:g',
      'gr:g',
      'ml:ml',
      'adet:adet',
      'g:gr',
      'gr:gr',
      'lt:l',
      'l:lt',
    ]);
    const key = `${mLower}:${uLower}`;
    if (guvenliCiftler.has(key)) {
      return { uyumlu: true, carpan };
    }

    return {
      uyumlu: false,
      carpan: 1,
      uyari: `Birim dönüşümü tanımsız: ${malzemeBirim} → ${urunBirim}. Ürüne özel dönüşüm tanımlayın veya birimi düzeltin.`,
    };
  }

  return { uyumlu: true, carpan };
}

/**
 * Fiyat mantık kontrolü
 * @param {number} fiyat - TL cinsinden fiyat
 * @param {string} birim - ürün birimi (kg, lt, adet vb.)
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFiyatMantik(fiyat, birim) {
  if (fiyat === null || fiyat === undefined) return { valid: true };

  const numFiyat = parseFloat(fiyat);
  if (Number.isNaN(numFiyat)) {
    return { valid: false, error: 'Fiyat geçerli bir sayı değil' };
  }
  if (numFiyat < 0) {
    return { valid: false, error: 'Fiyat negatif olamaz' };
  }

  const normalizedBirim = (birim || 'kg').toLowerCase();
  const ustLimit = FIYAT_UST_LIMIT[normalizedBirim] || 50000;

  if (numFiyat > ustLimit) {
    return {
      valid: false,
      error: `Fiyat çok yüksek: ${numFiyat} TL/${normalizedBirim}. Üst limit: ${ustLimit} TL/${normalizedBirim}. Hatalı giriş olabilir.`,
    };
  }

  return { valid: true };
}

// Sabit export'lar
export { URUN_BIRIMLER, RECETE_BIRIMLER };
