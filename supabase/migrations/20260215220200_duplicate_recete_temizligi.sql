-- ============================================================================
-- Duplicate Reçete Temizliği
-- Benzer isimli reçetelerden kullanılmayanı deaktive et.
-- Menüde kullanılan versiyon her zaman korunur.
-- İkisi de menüde kullanılmıyorsa daha az malzemeli olan deaktive edilir.
-- ============================================================================

-- Şehriye Çorba (ID:160, menu:0) — Şehriye Çorbası (ID:7, menu:3) var
UPDATE receteler SET aktif = false WHERE id = 160 AND aktif = true;

-- Tarhana Çorba (ID:80, menu:0) — Tarhana Çorbası (ID:4, menu:5) var
UPDATE receteler SET aktif = false WHERE id = 80 AND aktif = true;

-- Sebze Çorba (ID:103, menu:0, 15 malz) vs Sebze Çorbası (ID:9, menu:0, 6 malz)
-- İkisi de menüde kullanılmıyor. Daha detaylı olan (15 malzeme) korunur.
UPDATE receteler SET aktif = false WHERE id = 9 AND aktif = true;

-- Kremalı Mantar Çorba (ID:105, 10 malz) vs Kremalı Mantar Çorbası (ID:225, 10 malz)
-- İkisi de menüde yok, eşit malzeme. Daha eski olanı (105) koru, yenisini deaktive et.
UPDATE receteler SET aktif = false WHERE id = 225 AND aktif = true;

-- Yayla Çorba (ID:81, 6 malz) vs Yayla Çorbası (ID:6, 7 malz)
-- İkisi de menüde yok. Daha fazla malzemeli (7) olan korunur.
UPDATE receteler SET aktif = false WHERE id = 81 AND aktif = true;

-- Kuru Fasulye (ID:227) vs Kuru Fasulye  Yemeği (ID:211)
-- İkisi de menüde kullanılmıyor. 227'yi koru (daha eski, standart isim).
UPDATE receteler SET aktif = false WHERE id = 211 AND aktif = true;
