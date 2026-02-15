-- ============================================================================
-- Fiyatsız Ürün Kartlarına Piyasa Fiyatı Atama
-- 31 aktif ürün kartının fiyatı yok. Hepsinin urun_fiyat_ozet tablosunda
-- piyasa fiyatı mevcut. Manuel fiyat olarak piyasa fiyatını ata.
-- ============================================================================

-- Piyasa fiyatı olan ürünlere manuel_fiyat ata
UPDATE urun_kartlari uk
SET manuel_fiyat = ROUND(ufo.birim_fiyat_ekonomik::numeric, 2),
    aktif_fiyat = ROUND(ufo.birim_fiyat_ekonomik::numeric, 4),
    aktif_fiyat_tipi = 'piyasa',
    updated_at = NOW()
FROM urun_fiyat_ozet ufo
WHERE ufo.urun_kart_id = uk.id
  AND uk.aktif = true
  AND COALESCE(uk.aktif_fiyat, 0) = 0
  AND COALESCE(uk.manuel_fiyat, 0) = 0
  AND COALESCE(uk.son_alis_fiyati, 0) = 0
  AND ufo.birim_fiyat_ekonomik > 0;
