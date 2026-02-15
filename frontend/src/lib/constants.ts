/**
 * Merkezi birim sabitleri
 *
 * KURAL: Ürün kartı birimi = kg/lt/adet/demet (gr/ml YASAK)
 *        Reçete malzeme birimi = gr/ml/adet/porsiyon vb. (serbest)
 *        Fiyat her zaman ürün kartı birimi bazında (TL/kg, TL/lt, TL/adet)
 */

/** Ürün kartı seviyesinde izin verilen birimler (satın alma / fiyatlandırma) */
export const URUN_BIRIMLERI = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'lt', label: 'Litre (lt)' },
  { value: 'adet', label: 'Adet' },
  { value: 'demet', label: 'Demet' },
  { value: 'paket', label: 'Paket' },
] as const;

/** Reçete malzemelerinde kullanılan birimler (porsiyon bazlı) */
export const RECETE_BIRIMLERI = [
  { value: 'gr', label: 'Gram (gr)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'ml', label: 'Mililitre (ml)' },
  { value: 'lt', label: 'Litre (lt)' },
  { value: 'adet', label: 'Adet' },
  { value: 'porsiyon', label: 'Porsiyon' },
  { value: 'dilim', label: 'Dilim' },
  { value: 'tutam', label: 'Tutam' },
] as const;

/**
 * Birim dönüşüm çarpanları (frontend hesaplamaları için)
 *
 * Format: 'kaynak:hedef' → çarpan
 * KURAL: Yeni dönüşüm eklenince hem ileri hem geri yönü ekle
 */
export const BIRIM_DONUSUM: Record<string, number> = {
  // Ağırlık dönüşümleri
  'gr:kg': 0.001,
  'g:kg': 0.001,
  'gram:kg': 0.001,
  'kg:gr': 1000,
  'kg:g': 1000,

  // Hacim dönüşümleri
  'ml:lt': 0.001,
  'ml:l': 0.001,
  'lt:ml': 1000,
  'l:ml': 1000,

  // Hacim ↔ ağırlık çapraz dönüşümler (1ml ≈ 1g yaklaşımı, gıda sıvıları için)
  'ml:g': 1,
  'g:ml': 1,
  'ml:kg': 0.001,
  'kg:ml': 1000,
  'ml:gr': 1,
  'gr:ml': 1,
  'g:lt': 0.001,
  'lt:g': 1000,
  'gr:lt': 0.001,
  'lt:gr': 1000,

  // Identity (aynı birim)
  'kg:kg': 1,
  'lt:lt': 1,
  'l:l': 1,
  'ml:ml': 1,
  'gr:gr': 1,
  'g:g': 1,
  'adet:adet': 1,
  'demet:demet': 1,
  'paket:paket': 1,
  'porsiyon:porsiyon': 1,
  'dilim:dilim': 1,
  'tutam:tutam': 1,

  // Alias dönüşümleri (lt ↔ l aynı şey)
  'lt:l': 1,
  'l:lt': 1,
};

/**
 * Birim varyasyonunu standart forma çevir
 * Örn: 'gr' → 'g', 'Litre' → 'lt', 'AD' → 'adet'
 */
const BIRIM_NORMALIZE: Record<string, string> = {
  gr: 'g',
  gram: 'g',
  g: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilogram: 'kg',
  ml: 'ml',
  mililitre: 'ml',
  lt: 'lt',
  l: 'lt',
  litre: 'lt',
  adet: 'adet',
  ad: 'adet',
  porsiyon: 'porsiyon',
  prs: 'porsiyon',
  paket: 'paket',
  pkt: 'paket',
  demet: 'demet',
  dilim: 'dilim',
  tutam: 'tutam',
};

/**
 * Birim varyasyonunu standart forma çevir
 */
export function normalizeBirim(birim: string): string {
  if (!birim) return 'adet';
  const key = birim.toLowerCase().trim();
  return BIRIM_NORMALIZE[key] || key;
}

/**
 * Birim dönüşüm çarpanını al
 * @param malzemeBirim - reçete malzemesinin birimi (gr, ml, adet)
 * @param urunBirim - ürün kartının birimi (kg, lt, adet)
 * @returns çarpan değeri (örn: gr→kg = 0.001)
 *
 * NOT: Tanımsız dönüşümlerde 1 döndürür (mevcut davranış korunuyor)
 *      Ama console'a uyarı yazar (debug için)
 */
export function getDonusumCarpani(malzemeBirim: string, urunBirim: string): number {
  const kaynak = normalizeBirim(malzemeBirim);
  const hedef = normalizeBirim(urunBirim);

  if (kaynak === hedef) return 1;

  // Direkt dönüşüm
  const key = `${kaynak}:${hedef}`;
  const carpan = BIRIM_DONUSUM[key];
  if (carpan !== undefined) return carpan;

  // Ters dönüşüm
  const tersKey = `${hedef}:${kaynak}`;
  const tersCarpan = BIRIM_DONUSUM[tersKey];
  if (tersCarpan !== undefined && tersCarpan > 0) return 1 / tersCarpan;

  // Tanımsız dönüşüm
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[birim-donusum] Tanımsız dönüşüm: ${malzemeBirim}(${kaynak}) → ${urunBirim}(${hedef}). Çarpan 1 kullanılıyor.`
    );
  }
  return 1;
}

/**
 * Maliyet hesapla (frontend tarafı)
 * @param miktar - reçete malzeme miktarı
 * @param malzemeBirim - reçete malzeme birimi (gr, ml, adet)
 * @param birimFiyat - ürün kartı fiyatı (TL/kg, TL/lt)
 * @param urunBirim - ürün kartı birimi (kg, lt, adet)
 * @returns hesaplanan maliyet (TL)
 */
export function hesaplaMaliyetFrontend(
  miktar: number,
  malzemeBirim: string,
  birimFiyat: number,
  urunBirim: string
): number {
  const carpan = getDonusumCarpani(malzemeBirim, urunBirim);
  return miktar * carpan * birimFiyat;
}
