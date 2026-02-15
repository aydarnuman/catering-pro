-- ============================================================================
-- Sözlük ve Gramaj Kuralı Genişletme
-- 46 eşleşmeyen malzeme için sözlük girişleri ve gramaj kuralları
-- ============================================================================

-- ─── 1. MEVCUT SÖZLÜK DÜZELTMELERİ ─────────────────────────────────────────

-- "Su" sözlüğüne eksik anahtar kelime ekle
UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = ARRAY['sıcak su', 'kaynar su', 'içme suyu', 'kaynar', 'su']
WHERE malzeme_tipi = 'Su' AND aktif = true;

-- "Biber" sözlüğüne "biber" kelimesini geri ekle (ama spesifik olarak)
-- Önceki düzeltmede çıkarmıştık ama "Biber (Yeşil)", "Biber (Kırmızı)", "Biber" eşleşmiyor
UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = ARRAY[
  'sivri biber', 'dolmalık biber', 'kapya biber',
  'yeşil biber', 'çarliston', 'kırmızı biber', 'taze biber',
  'biber (yeşil)', 'biber (kırmızı)', 'biber (sivri)'
]
WHERE malzeme_tipi = 'Biber' AND aktif = true;

-- "Kekik" sözlüğüne "kimyon" eklemek YERİNE ayrı giriş var mı kontrol et
-- Kimyon için ayrı giriş ekle
INSERT INTO malzeme_tip_eslesmeleri (malzeme_tipi, eslesen_kelimeler, aktif) VALUES
  ('Kimyon', ARRAY['kimyon', 'toz kimyon'], true)
ON CONFLICT DO NOTHING;

-- ─── 2. YENİ SÖZLÜK GİRİŞLERİ ──────────────────────────────────────────────

INSERT INTO malzeme_tip_eslesmeleri (malzeme_tipi, eslesen_kelimeler, aktif) VALUES
  -- Sebzeler (tekil)
  ('Salatalık', ARRAY['salatalık', 'hıyar', 'salatalik'], true),
  ('Marul', ARRAY['marul', 'göbek marul', 'kıvırcık', 'marul yaprağı'], true),
  ('Pırasa', ARRAY['pırasa', 'pirasa'], true),
  ('Mantar', ARRAY['mantar', 'kültür mantarı', 'mantar (kültür)', 'champignon'], true),
  ('Asma Yaprağı', ARRAY['asma yaprağı', 'yaprak', 'salamura yaprak'], true),
  ('Mısır', ARRAY['mısır', 'mısır (konserve)', 'tatlı mısır', 'konserve mısır'], true),
  ('Portakal', ARRAY['portakal', 'portakal suyu'], true),
  ('Ayva', ARRAY['ayva'], true),
  
  -- Baharatlar ve çeşniler
  ('Vanilya', ARRAY['vanilya', 'vanilin', 'vanilya özütü'], true),
  ('Tarçın', ARRAY['tarçın', 'tarcin', 'çubuk tarçın'], true),
  ('Muskat', ARRAY['muskat', 'hindistan cevizi'], true),
  ('Karanfil', ARRAY['karanfil'], true),
  ('Sumak', ARRAY['sumak'], true),
  ('Haşhaş', ARRAY['haşhaş', 'haşhaş tohumu'], true),
  
  -- Süt ürünleri ve yağlar
  ('Krema', ARRAY['krema', 'sıvı krema', 'çiğ krema', 'kaymak'], true),
  ('Mayonez', ARRAY['mayonez', 'mayo'], true),
  ('Sirke', ARRAY['sirke', 'elma sirkesi', 'üzüm sirkesi', 'nar ekşisi'], true),
  
  -- Hamur işi ve unlu mamuller
  ('Ekmek', ARRAY['ekmek', 'ekmek içi', 'bayat ekmek', 'galeta unu'], true),
  ('İrmik', ARRAY['irmik', 'ince irmik', 'kalın irmik'], true),
  ('Kabartma Tozu', ARRAY['kabartma tozu', 'kabartma', 'karbonat'], true),
  ('Maya', ARRAY['maya', 'yaş maya', 'kuru maya', 'instant maya'], true),
  ('Bisküvi', ARRAY['bisküvi', 'petibör', 'bisküvi (petibör)'], true),
  ('Lavaş', ARRAY['lavaş', 'lavash', 'lavaş ekmeği', 'lavash ekmeği', 'tortilla'], true),
  ('Pizza Hamuru', ARRAY['pizza hamuru', 'pizza'], true),
  ('Simit', ARRAY['simit', 'açma', 'poğaça'], true),

  -- Tatlandırıcı/şekerleme
  ('Çikolata', ARRAY['çikolata', 'bitter', 'sütlü çikolata', 'çikolata (bitter)'], true),
  ('Kakao', ARRAY['kakao', 'kakao tozu'], true),
  ('Bal', ARRAY['bal', 'çam balı', 'çiçek balı', 'süzme bal'], true),
  ('Reçel', ARRAY['reçel', 'çilek reçeli', 'kayısı reçeli', 'portakal reçeli', 'vişne reçeli'], true),
  
  -- İçecekler
  ('Ayran', ARRAY['ayran'], true),
  ('Çay', ARRAY['çay', 'siyah çay', 'demlik çay'], true),
  
  -- Et ürünleri (işlenmiş)
  ('Sucuk', ARRAY['sucuk', 'kangal sucuk'], true),
  ('Salam', ARRAY['salam', 'hindi salam'], true),
  
  -- Konserve/Turşu
  ('Turşu', ARRAY['turşu', 'salatalık turşusu', 'karışık turşu', 'kornişon'], true),
  ('Zeytin', ARRAY['zeytin', 'siyah zeytin', 'yeşil zeytin', 'zeytin (siyah)', 'zeytin (yeşil)'], true),
  
  -- Meyve
  ('İncir', ARRAY['incir', 'taze incir', 'kuru incir'], true),
  ('Karışık Meyve', ARRAY['karışık meyve', 'mevsim meyvesi', 'meyve tabağı'], true)
ON CONFLICT DO NOTHING;

-- ─── 3. YENİ GRAMAJ KURALLARI ───────────────────────────────────────────────
-- Yeni sözlük girişleri için tüm şartnameye × tüm alt tipe gramaj kuralı ekle.
-- Miktarlar porsiyon başına gram cinsinden (1 kişilik).

INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, aktif)
SELECT ps.id, att.id, tip.malzeme_tipi, tip.gramaj, 'g', true
FROM proje_sartnameleri ps
CROSS JOIN alt_tip_tanimlari att
CROSS JOIN (VALUES
  -- Sebzeler (tekil, porsiyon başına gram)
  ('Salatalık', 60.00),
  ('Marul', 30.00),
  ('Pırasa', 50.00),
  ('Mantar', 40.00),
  ('Asma Yaprağı', 20.00),
  ('Mısır', 30.00),
  ('Portakal', 80.00),
  ('Ayva', 150.00),
  
  -- Baharatlar (porsiyon başına gram)
  ('Vanilya', 1.00),
  ('Tarçın', 1.00),
  ('Muskat', 0.50),
  ('Karanfil', 0.50),
  ('Sumak', 3.00),
  ('Haşhaş', 5.00),
  ('Kimyon', 1.00),

  -- Süt ürünleri ve yağlar
  ('Krema', 30.00),
  ('Mayonez', 15.00),
  ('Sirke', 10.00),
  
  -- Hamur işi
  ('Ekmek', 50.00),
  ('İrmik', 30.00),
  ('Kabartma Tozu', 2.00),
  ('Maya', 3.00),
  ('Bisküvi', 30.00),
  ('Lavaş', 50.00),
  ('Pizza Hamuru', 150.00),
  ('Simit', 80.00),

  -- Tatlandırıcı
  ('Çikolata', 15.00),
  ('Kakao', 5.00),
  ('Bal', 20.00),
  ('Reçel', 30.00),
  
  -- İçecek
  ('Ayran', 200.00),
  ('Çay', 3.00),

  -- İşlenmiş et
  ('Sucuk', 50.00),
  ('Salam', 40.00),
  
  -- Konserve/turşu
  ('Turşu', 50.00),
  ('Zeytin', 25.00),
  
  -- Meyve
  ('İncir', 80.00),
  ('Karışık Meyve', 150.00)
) AS tip(malzeme_tipi, gramaj)
WHERE ps.aktif = true
  AND NOT EXISTS (
    SELECT 1 FROM sartname_gramaj_kurallari sgk
    WHERE sgk.sartname_id = ps.id AND sgk.alt_tip_id = att.id
      AND sgk.malzeme_tipi = tip.malzeme_tipi AND sgk.aktif = true
  )
ON CONFLICT DO NOTHING;

-- ─── 4. "Sebze (karışık)" altına düşen tekil sebzeler için spesifik kurallar ──
-- Patlıcan, Kabak, Bezelye, Bamya, Lahana gibi sebzeler "Sebze (karışık)" 238g
-- kuralına düşüyordu. Artık sözlükte ayrı giriş olmasa da, gramaj kurallarında
-- spesifik olarak tanımlanmaları gerekiyor.

-- Patlıcan: tekil sebze olarak ayrı sözlük girişi ekle
INSERT INTO malzeme_tip_eslesmeleri (malzeme_tipi, eslesen_kelimeler, aktif) VALUES
  ('Patlıcan', ARRAY['patlıcan', 'kemer patlıcan', 'bostan patlıcan'], true),
  ('Kabak', ARRAY['kabak', 'sakız kabak', 'dolmalık kabak'], true),
  ('Bezelye', ARRAY['bezelye', 'taze bezelye', 'dondurulmuş bezelye'], true),
  ('Bamya', ARRAY['bamya', 'taze bamya', 'dondurulmuş bamya'], true),
  ('Lahana', ARRAY['lahana', 'beyaz lahana', 'kırmızı lahana', 'kapuska'], true),
  ('Kereviz', ARRAY['kereviz', 'kök kereviz', 'sap kereviz'], true),
  ('Ispanak', ARRAY['ıspanak', 'ispanak', 'taze ıspanak'], true),
  ('Enginar', ARRAY['enginar', 'enginar kalbi'], true),
  ('Karnabahar', ARRAY['karnabahar'], true),
  ('Brokoli', ARRAY['brokoli'], true)
ON CONFLICT DO NOTHING;

-- Bu tekil sebzeler için gramaj kuralları (porsiyon başına)
INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, aktif)
SELECT ps.id, att.id, tip.malzeme_tipi, tip.gramaj, 'g', true
FROM proje_sartnameleri ps
CROSS JOIN alt_tip_tanimlari att
CROSS JOIN (VALUES
  ('Patlıcan', 120.00),
  ('Kabak', 100.00),
  ('Bezelye', 80.00),
  ('Bamya', 100.00),
  ('Lahana', 120.00),
  ('Kereviz', 40.00),
  ('Ispanak', 100.00),
  ('Enginar', 80.00),
  ('Karnabahar', 100.00),
  ('Brokoli', 80.00)
) AS tip(malzeme_tipi, gramaj)
WHERE ps.aktif = true
  AND NOT EXISTS (
    SELECT 1 FROM sartname_gramaj_kurallari sgk
    WHERE sgk.sartname_id = ps.id AND sgk.alt_tip_id = att.id
      AND sgk.malzeme_tipi = tip.malzeme_tipi AND sgk.aktif = true
  )
ON CONFLICT DO NOTHING;

-- "Sebze (karışık)" sözlüğünden bu tekil sebzelerin kelimelerini çıkar
-- (artık kendi sözlük girişleri var, karışığa düşmemeleri lazım)
UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = ARRAY[
  'karışık sebze', 'sebze karışım', 'taze fasulye', 'sebze'
]
WHERE malzeme_tipi = 'Sebze (karışık)' AND aktif = true;

-- ─── 5. TÜRKÇE İ/i SORUNU DÜZELTMELERİ ────────────────────────────────────
-- JavaScript toLowerCase() Türkçe İ'yi i̇ (dotted) yapar, 'irmik' ile eşleşmez.
-- Sözlüğe büyük harfli versiyonları da ekle.

UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = ARRAY['irmik', 'ince irmik', 'kalın irmik', 'İrmik']
WHERE malzeme_tipi = 'İrmik' AND aktif = true;

UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = ARRAY['incir', 'taze incir', 'kuru incir', 'İncir']
WHERE malzeme_tipi = 'İncir' AND aktif = true;

-- "Biber" sözlüğüne 'biber' direkt kelimesini ekle (sadece "Biber" diye geçen malzemeler için)
UPDATE malzeme_tip_eslesmeleri
SET eslesen_kelimeler = array_append(eslesen_kelimeler, 'biber')
WHERE malzeme_tipi = 'Biber' AND aktif = true
  AND NOT ('biber' = ANY(eslesen_kelimeler));

-- Tarhana sözlük girişi
INSERT INTO malzeme_tip_eslesmeleri (malzeme_tipi, eslesen_kelimeler, aktif) VALUES
  ('Tarhana', ARRAY['tarhana', 'Tarhana'], true)
ON CONFLICT DO NOTHING;

-- Tarhana gramaj kuralları (tüm şartname × alt tip)
INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, aktif)
SELECT ps.id, att.id, 'Tarhana', 30.00, 'g', true
FROM proje_sartnameleri ps CROSS JOIN alt_tip_tanimlari att
WHERE ps.aktif = true AND NOT EXISTS (
  SELECT 1 FROM sartname_gramaj_kurallari sgk
  WHERE sgk.sartname_id = ps.id AND sgk.alt_tip_id = att.id
    AND sgk.malzeme_tipi = 'Tarhana' AND sgk.aktif = true
) ON CONFLICT DO NOTHING;
