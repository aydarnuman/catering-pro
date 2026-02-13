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

/** Birim dönüşüm çarpanları (frontend hesaplamaları için) */
export const BIRIM_DONUSUM: Record<string, number> = {
  'gr:kg': 0.001,
  'g:kg': 0.001,
  'gram:kg': 0.001,
  'ml:lt': 0.001,
  'kg:kg': 1,
  'lt:lt': 1,
  'adet:adet': 1,
  'demet:demet': 1,
  'paket:paket': 1,
  'porsiyon:porsiyon': 1,
};

/**
 * Birim dönüşüm çarpanını al
 * @param malzemeBirim - reçete malzemesinin birimi (gr, ml, adet)
 * @param urunBirim - ürün kartının birimi (kg, lt, adet)
 * @returns çarpan değeri (örn: gr→kg = 0.001)
 */
export function getDonusumCarpani(malzemeBirim: string, urunBirim: string): number {
  const kaynak = (malzemeBirim || '').toLowerCase().trim();
  const hedef = (urunBirim || 'kg').toLowerCase().trim();

  if (kaynak === hedef) return 1;

  const key = `${kaynak}:${hedef}`;
  return BIRIM_DONUSUM[key] ?? 1;
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
