-- 119: Reçete maliyet tutarlılığı - bilinen hatalı fiyat düzeltmeleri
-- Tereyağı duplike (850 vs 420), Zeytinyağı son_alis hatalı (1393), Dana et piyasa uyumu

-- 1. Tereyağı: id=20 AI_TAHMINI 850 TL/kg → piyasa uyumlu 420 (SÖZLEŞME ile aynı seviye)
UPDATE urun_kartlari
SET aktif_fiyat = 420,
    aktif_fiyat_tipi = 'MANUEL',
    aktif_fiyat_guncelleme = NOW()
WHERE id = 20 AND ad ILIKE '%Tereyağı%' AND COALESCE(aktif_fiyat, 0) > 500;

-- 2. Zeytinyağı: son_alis_fiyati aşırı yüksek (lt/kg karışıklığı) → aktif_fiyat ile hizala
UPDATE urun_kartlari
SET son_alis_fiyati = COALESCE(aktif_fiyat, son_alis_fiyati),
    son_alis_tarihi = COALESCE(son_alis_tarihi, NOW())
WHERE (id = 238 OR id = 70) AND ad ILIKE '%Zeytinyağı%' AND COALESCE(son_alis_fiyati, 0) > 1000;

-- 3. Dana Kıyma: piyasa uyumu (420 → 650 TL/kg referans)
UPDATE urun_kartlari
SET aktif_fiyat = 650,
    aktif_fiyat_tipi = 'MANUEL',
    aktif_fiyat_guncelleme = NOW()
WHERE (id = 1 OR id = 4728) AND ad ILIKE '%Dana Kıyma%' AND COALESCE(aktif_fiyat, 0) < 500;

-- 4. Dana Kuşbaşı: piyasa uyumu (380-420 → 800 TL/kg referans)
UPDATE urun_kartlari
SET aktif_fiyat = 800,
    aktif_fiyat_tipi = 'MANUEL',
    aktif_fiyat_guncelleme = NOW()
WHERE (id = 2 OR id = 4729) AND ad ILIKE '%Dana Kuşbaşı%' AND COALESCE(aktif_fiyat, 0) < 500;

-- Not: Reçete maliyetlerini yeniden hesaplamak için backend'de
-- POST /api/menu-planlama/receteler/:id/maliyet-hesapla tüm reçeteler için çağrılmalı
-- veya scripts/toplu-maliyet-hesapla.js kullanılabilir.
