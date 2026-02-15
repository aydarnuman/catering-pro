-- ============================================================================
-- Fiyat Anomali Düzeltmeleri
-- Anomali tespit scriptlerinde bulunan sorunların çözümü
-- ============================================================================

-- ─── 1. BİRİM DÖNÜŞÜM EKSİKLİKLERİ ─────────────────────────────────────────

-- 1a. Genel birim dönüşümleri: demet <-> kg/g
-- 1 demet maydanoz ≈ 50g, 1 demet taze soğan ≈ 200g, 1 demet roka ≈ 100g
-- Genel ortalama 1 demet ≈ 100g (ürün bazlı override aşağıda)
INSERT INTO birim_donusumleri (kaynak_birim, hedef_birim, carpan) VALUES
  ('demet', 'kg', 0.1),     -- 1 demet ≈ 100g = 0.1 kg (genel)
  ('demet', 'g', 100),      -- 1 demet ≈ 100g
  ('g', 'demet', 0.01),     -- 1g = 0.01 demet
  ('kg', 'demet', 10),      -- 1kg = 10 demet
  ('demet', 'demet', 1)     -- identity
ON CONFLICT DO NOTHING;

-- 1b. tutam <-> kg/g (baharatlar için: 1 tutam ≈ 1g)
INSERT INTO birim_donusumleri (kaynak_birim, hedef_birim, carpan) VALUES
  ('tutam', 'g', 1),
  ('tutam', 'kg', 0.001),
  ('g', 'tutam', 1),
  ('kg', 'tutam', 1000)
ON CONFLICT DO NOTHING;

-- 1c. dilim <-> kg/g (1 dilim ≈ 30g genel)
INSERT INTO birim_donusumleri (kaynak_birim, hedef_birim, carpan) VALUES
  ('dilim', 'g', 30),
  ('dilim', 'kg', 0.03),
  ('g', 'dilim', 0.0333),
  ('kg', 'dilim', 33.33)
ON CONFLICT DO NOTHING;

-- 1d. adet <-> kg/g (1 adet ≈ 120g genel ortalama - ürün bazlı override aşağıda)
INSERT INTO birim_donusumleri (kaynak_birim, hedef_birim, carpan) VALUES
  ('adet', 'kg', 0.12),
  ('adet', 'g', 120),
  ('g', 'adet', 0.00833),
  ('kg', 'adet', 8.33)
ON CONFLICT DO NOTHING;

-- ─── 2. ÜRÜN BAZLI BİRİM DÖNÜŞÜMLERİ (product-specific overrides) ──────────

-- Maydanoz: 1 demet ≈ 50g
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama) VALUES
  (4763, 'g', 'demet', 0.02, '1 demet maydanoz ≈ 50g → 1g = 0.02 demet'),
  (4763, 'demet', 'g', 50, '1 demet maydanoz ≈ 50g'),
  (4763, 'demet', 'kg', 0.05, '1 demet maydanoz ≈ 50g = 0.05 kg'),
  (4763, 'kg', 'demet', 20, '1 kg maydanoz = 20 demet')
ON CONFLICT DO NOTHING;

-- Taze Soğan: 1 demet ≈ 200g
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama) VALUES
  (4881, 'g', 'demet', 0.005, '1 demet taze soğan ≈ 200g → 1g = 0.005 demet'),
  (4881, 'demet', 'g', 200, '1 demet taze soğan ≈ 200g'),
  (4881, 'demet', 'kg', 0.2, '1 demet taze soğan ≈ 200g = 0.2 kg'),
  (4881, 'kg', 'demet', 5, '1 kg taze soğan = 5 demet')
ON CONFLICT DO NOTHING;

-- Roka: 1 demet ≈ 100g
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama) VALUES
  (4882, 'g', 'demet', 0.01, '1 demet roka ≈ 100g → 1g = 0.01 demet'),
  (4882, 'demet', 'g', 100, '1 demet roka ≈ 100g'),
  (4882, 'demet', 'kg', 0.1, '1 demet roka ≈ 100g = 0.1 kg'),
  (4882, 'kg', 'demet', 10, '1 kg roka = 10 demet')
ON CONFLICT DO NOTHING;

-- Limon: 1 adet ≈ 120g
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama) VALUES
  (4767, 'adet', 'kg', 0.12, '1 adet limon ≈ 120g = 0.12 kg'),
  (4767, 'kg', 'adet', 8.33, '1 kg limon ≈ 8.3 adet'),
  (4767, 'adet', 'g', 120, '1 adet limon ≈ 120g'),
  (4767, 'g', 'adet', 0.00833, '1g limon = 0.00833 adet')
ON CONFLICT DO NOTHING;

-- Sarımsak: 1 adet (diş) ≈ 5g
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama) VALUES
  (4759, 'adet', 'kg', 0.005, '1 diş sarımsak ≈ 5g = 0.005 kg'),
  (4759, 'kg', 'adet', 200, '1 kg sarımsak ≈ 200 diş'),
  (4759, 'adet', 'g', 5, '1 diş sarımsak ≈ 5g'),
  (4759, 'g', 'adet', 0.2, '1g sarımsak = 0.2 diş')
ON CONFLICT DO NOTHING;

-- Çilek Reçeli: 1 adet (porsiyon kutu) ≈ 30g
INSERT INTO urun_birim_donusumleri (urun_kart_id, kaynak_birim, hedef_birim, carpan, aciklama) VALUES
  (4658, 'g', 'adet', 0.0333, '30g = 1 porsiyon kutu çilek reçeli'),
  (4658, 'adet', 'g', 30, '1 porsiyon kutu çilek reçeli ≈ 30g'),
  (4658, 'adet', 'kg', 0.03, '1 porsiyon kutu çilek reçeli ≈ 30g = 0.03 kg'),
  (4658, 'kg', 'adet', 33.33, '1 kg çilek reçeli ≈ 33 porsiyon kutu')
ON CONFLICT DO NOTHING;

-- ─── 3. SÖZLÜK EŞLEŞTİRME DÜZELTMELERİ ─────────────────────────────────────

-- 3a. "Sebze (karışık)" kelime listesinden yanlış eşleşmeye neden olanları çıkar:
--     "biber" → Karabiber, Pul Biber gibi baharatlara da eşleşiyor
--     "havuç", "patates" gibi tekil sebzeler gereksiz yere karışığa düşüyor
--     Daha spesifik kelimeler kullanarak false positive'leri önle.
UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = ARRAY[
  'patlıcan', 'kabak', 'sivri biber', 'dolmalık biber', 'kapya biber',
  'bamya', 'bezelye', 'ıspanak', 'lahana',
  'enginar', 'kereviz', 'pirasa', 'karnabahar', 'brokoli',
  'karışık sebze', 'sebze karışım', 'taze fasulye'
]
WHERE malzeme_tipi = 'Sebze (karışık)' AND aktif = true;

-- 3b. Havuç ve Patates için ayrı malzeme tipi tanımları ekle
--     (şartname kurallarında bunlar zaten var ise eşleşecek,
--      yoksa en azından yanlış yere düşmeyecek)
INSERT INTO malzeme_tip_eslesmeleri (malzeme_tipi, eslesen_kelimeler, aktif) VALUES
  ('Havuç', ARRAY['havuç', 'baby havuç', 'havuc'], true),
  ('Patates', ARRAY['patates', 'baby patates'], true)
ON CONFLICT DO NOTHING;

-- 3c. "Biber" sözlüğünü daha spesifik yap (çiğ sebze biberleri için)
UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = ARRAY[
  'sivri biber', 'dolmalık biber', 'kapya biber',
  'yeşil biber', 'çarliston', 'kırmızı biber', 'taze biber'
]
WHERE malzeme_tipi = 'Biber' AND aktif = true;

-- 3d. "Maydanoz" sözlüğünden yeşillik dışı eşleşmeleri temizle
--     "nane", "kekik", "defne yaprağı" çok farklı malzemeler
UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = ARRAY['maydanoz', 'taze maydanoz']
WHERE malzeme_tipi = 'Maydanoz' AND aktif = true;

-- 3e. Dereotu, Nane, Kekik için ayrı sözlük girişleri
INSERT INTO malzeme_tip_eslesmeleri (malzeme_tipi, eslesen_kelimeler, aktif) VALUES
  ('Dereotu', ARRAY['dereotu', 'dere otu', 'taze dereotu'], true),
  ('Nane', ARRAY['nane', 'taze nane', 'kuru nane'], true),
  ('Kekik', ARRAY['kekik', 'taze kekik', 'kuru kekik'], true),
  ('Defne', ARRAY['defne yaprağı', 'defne', 'bay leaf'], true)
ON CONFLICT DO NOTHING;

-- 3f. "Un" sözlüğünden "nişasta" çıkar (zaten ayrı tipi var)
UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = ARRAY['buğday unu', 'ekmek unu', 'pirinç unu', 'mısır unu', 'galeta unu', 'un']
WHERE malzeme_tipi = 'Un' AND aktif = true;

-- ─── 4. EKSİK ALT TİP ATAMALARI ─────────────────────────────────────────────
-- Bazı reçeteler alt_tip_id = NULL olabilir, gerçek kategorisine göre ata
-- (Sadece alt_tip_id NULL ve aktif olanları güncelle)

-- Bilgi: Bu sadece proje_id=1'deki global reçeteler içindir.
-- alt_tip_id NULL olan 9 reçeteyi kontrol et ama güncelleme yapmak riskli
-- çünkü doğru alt tip her reçete için farklı olabilir.
-- Manuel kontrol gerekir, bu yüzden sadece loglama yapılır.

-- ─── 5. ŞARTNAME GRAMAJ KURALLARINA EKSİK TİPLER EKLE ──────────────────────

-- Şartnamelerde Havuç ve Patates gibi yaygın sebzeler için
-- kurallar eksik olabilir. Kontrol edelim ve varsa ekleyelim.
-- Her şartnameye "Sebze Yemeği" (alt_tip_id=10) için Havuç ve Patates kuralı ekle
-- (mevcut "Sebze (karışık)" gramajının %50'si mantıklı bir varsayılan)

INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, aktif)
SELECT 
  ps.id as sartname_id,
  10 as alt_tip_id,  -- Sebze Yemeği
  'Havuç' as malzeme_tipi,
  COALESCE(
    (SELECT sgk.gramaj * 0.4  -- Sebze karışığın %40'ı
     FROM sartname_gramaj_kurallari sgk 
     WHERE sgk.sartname_id = ps.id AND sgk.alt_tip_id = 10 
       AND sgk.malzeme_tipi = 'Sebze (karışık)' AND sgk.aktif = true
     LIMIT 1),
    80  -- varsayılan 80g
  ) as gramaj,
  'g' as birim,
  true as aktif
FROM proje_sartnameleri ps
WHERE ps.aktif = true
  AND NOT EXISTS (
    SELECT 1 FROM sartname_gramaj_kurallari sgk 
    WHERE sgk.sartname_id = ps.id AND sgk.malzeme_tipi = 'Havuç' AND sgk.aktif = true
  )
ON CONFLICT DO NOTHING;

INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, aktif)
SELECT 
  ps.id as sartname_id,
  10 as alt_tip_id,
  'Patates' as malzeme_tipi,
  COALESCE(
    (SELECT sgk.gramaj * 0.5
     FROM sartname_gramaj_kurallari sgk 
     WHERE sgk.sartname_id = ps.id AND sgk.alt_tip_id = 10 
       AND sgk.malzeme_tipi = 'Sebze (karışık)' AND sgk.aktif = true
     LIMIT 1),
    120  -- varsayılan 120g
  ) as gramaj,
  'g' as birim,
  true as aktif
FROM proje_sartnameleri ps
WHERE ps.aktif = true
  AND NOT EXISTS (
    SELECT 1 FROM sartname_gramaj_kurallari sgk 
    WHERE sgk.sartname_id = ps.id AND sgk.malzeme_tipi = 'Patates' AND sgk.aktif = true
  )
ON CONFLICT DO NOTHING;

-- Karabiber, Pul biber, Tuz, Sarımsak, Maydanoz, Limon gibi yaygın
-- malzemeler için gramaj kuralları — HER alt tipe ayrı ayrı eklenir.
-- (alt_tip_id NOT NULL constraint var, genel kural eklenemez)
-- Baharat/garnitür gramajları sabittir, yemek tipinden bağımsızdır.

INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, aktif)
SELECT ps.id, att.id, tip.malzeme_tipi, tip.gramaj, 'g', true
FROM proje_sartnameleri ps
CROSS JOIN alt_tip_tanimlari att
CROSS JOIN (VALUES 
  ('Karabiber', 2.00),
  ('Pul biber', 3.00),
  ('Tuz', 5.00),
  ('Nane', 2.00),
  ('Kekik', 2.00),
  ('Kimyon', 1.00),
  ('Dereotu', 5.00),
  ('Defne', 1.00),
  ('Sarımsak', 5.00),
  ('Nişasta', 15.00),
  ('Maydanoz', 10.00),
  ('Limon', 15.00)
) AS tip(malzeme_tipi, gramaj)
WHERE ps.aktif = true
  AND NOT EXISTS (
    SELECT 1 FROM sartname_gramaj_kurallari sgk 
    WHERE sgk.sartname_id = ps.id 
      AND sgk.alt_tip_id = att.id
      AND sgk.malzeme_tipi = tip.malzeme_tipi 
      AND sgk.aktif = true
  )
ON CONFLICT DO NOTHING;
