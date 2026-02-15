-- =============================================
-- ŞARTNAME GRAMAJ TOPLU YÖNETİM SİSTEMİ
-- Alt tip referans tablosu + gramaj kuralları + malzeme eşleme sözlüğü
-- =============================================

-- =============================================
-- 1. ALT TİP TANIMLARI (Referans tablo)
-- Her kategori altında detaylı yemek tipleri
-- =============================================
CREATE TABLE IF NOT EXISTS alt_tip_tanimlari (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(50) UNIQUE NOT NULL,
  ad VARCHAR(100) NOT NULL,
  kategori_id INTEGER REFERENCES recete_kategoriler(id),
  aciklama TEXT,
  ikon VARCHAR(10),
  sira INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed: Alt tip tanımları
INSERT INTO alt_tip_tanimlari (kod, ad, kategori_id, aciklama, ikon, sira) VALUES
  -- Ana Yemek alt tipleri (kategori_id=2)
  ('parcali_et_kemiksiz', 'Parçalı Et (Kemiksiz)', 2, 'Kuşbaşı, sote, kavurma gibi kemiksiz parça et yemekleri', '🥩', 1),
  ('parcali_et_kemikli', 'Parçalı Et (Kemikli)', 2, 'Tandır, incik, pirzola gibi kemikli et yemekleri', '🍖', 2),
  ('kiymali', 'Kıymalı Yemekler', 2, 'Köfte, kıymalı yemekler, musakka', '🫓', 3),
  ('etli_sebze', 'Etli Sebze Yemekleri', 2, 'Az et + bol sebze: Etli bamya, etli kabak', '🥘', 4),
  ('etli_bakliyat', 'Etli Baklagil', 2, 'Az et + baklagil: Etli kuru fasulye, etli nohut', '🫘', 5),

  -- Kuru Baklagil alt tipleri (kategori_id=18)
  ('kuru_baklagil_etsiz', 'Kuru Baklagil (Etsiz)', 18, 'Etsiz nohut, fasulye, mercimek', '🫘', 1),

  -- Tavuk alt tipleri (kategori_id=19)
  ('tavuk_parcali', 'Tavuk (Parçalı)', 19, 'Tavuk sote, but, göğüs parça yemekleri', '🍗', 1),
  ('tavuk_kemikli', 'Tavuk (Kemikli)', 19, 'Tavuk haşlama, fırın tavuk (kemikli)', '🐔', 2),

  -- Balık alt tipleri (kategori_id=20)
  ('balik_genel', 'Balık', 20, 'Her türlü balık yemeği', '🐟', 1),

  -- Sebze alt tipleri (kategori_id=17)
  ('sebze_yemegi', 'Sebze Yemeği', 17, 'Etsiz sebze yemekleri', '🥬', 1),
  ('sebze_zeytinyagli', 'Zeytinyağlı Sebze', 17, 'Zeytinyağlı yaprak sarma, enginar vb.', '🫒', 2),

  -- Çorba alt tipleri (kategori_id=1)
  ('corba_mercimek', 'Mercimek Çorbası', 1, 'Mercimek bazlı çorbalar', '🥣', 1),
  ('corba_yayla', 'Yoğurtlu/Yayla Çorbası', 1, 'Yoğurt bazlı çorbalar', '🥣', 2),
  ('corba_sebze', 'Sebze/Domates Çorbası', 1, 'Sebze bazlı çorbalar', '🥣', 3),
  ('corba_et_suyu', 'Et Suyu Çorbası', 1, 'Et suyu bazlı çorbalar (düğün, işkembe)', '🥣', 4),
  ('corba_genel', 'Çorba (Genel)', 1, 'Diğer çorbalar', '🥣', 5),

  -- Pilav/Makarna alt tipleri (kategori_id=3)
  ('pilav_pirinc', 'Pirinç Pilavı', 3, 'Pirinç bazlı pilavlar', '🍚', 1),
  ('pilav_bulgur', 'Bulgur Pilavı', 3, 'Bulgur bazlı pilavlar', '🌾', 2),
  ('makarna_genel', 'Makarna', 3, 'Her türlü makarna', '🍝', 3),

  -- Salata/Meze alt tipleri (kategori_id=4)
  ('salata_mevsim', 'Mevsim Salatası', 4, 'Mevsim yeşillik salatası', '🥗', 1),
  ('salata_diger', 'Diğer Salatalar', 4, 'Çoban, piyaz, cacık vb.', '🥒', 2),
  ('meze_sicak', 'Ara Sıcak / Meze', 4, 'Sıcak meze, sigara böreği vb.', '🧆', 3),

  -- Tatlı alt tipleri (kategori_id=5)
  ('tatli_sutlu', 'Sütlü Tatlı', 5, 'Sütlaç, muhallebi, keşkül', '🍮', 1),
  ('tatli_serbetli', 'Şerbetli Tatlı', 5, 'Baklava, kadayıf, revani', '🍯', 2),
  ('tatli_meyve', 'Meyve', 5, 'Mevsim meyvesi, komposto', '🍎', 3),
  ('tatli_hamur', 'Hamur Tatlısı', 5, 'Lokma, tulumba vb.', '🍩', 4),

  -- İçecek alt tipleri (kategori_id=6)
  ('icecek_ayran', 'Ayran', 6, 'Ayran', '🥛', 1),
  ('icecek_komposto', 'Komposto / Hoşaf', 6, 'Meyveli içecekler', '🍹', 2),
  ('icecek_diger', 'Diğer İçecek', 6, 'Su, çay vb.', '🫗', 3),

  -- Kahvaltılık alt tipleri (kategori_id=7)
  ('kahvalti_genel', 'Kahvaltı', 7, 'Genel kahvaltı tabağı', '☀️', 1),

  -- Börek/Hamur İşi alt tipleri (kategori_id=21)
  ('borek_hamur', 'Börek / Hamur İşi', 21, 'Börek, pide, gözleme', '🥟', 1)
ON CONFLICT (kod) DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_alt_tip_kategori ON alt_tip_tanimlari(kategori_id);
CREATE INDEX IF NOT EXISTS idx_alt_tip_aktif ON alt_tip_tanimlari(aktif);

-- =============================================
-- 2. ŞARTNAME GRAMAJ KURALLARI
-- Her şartname × alt tip × malzeme tipi için gramaj
-- =============================================
CREATE TABLE IF NOT EXISTS sartname_gramaj_kurallari (
  id SERIAL PRIMARY KEY,
  sartname_id INTEGER NOT NULL REFERENCES proje_sartnameleri(id) ON DELETE CASCADE,
  alt_tip_id INTEGER NOT NULL REFERENCES alt_tip_tanimlari(id) ON DELETE CASCADE,
  malzeme_tipi VARCHAR(100) NOT NULL,   -- "Çiğ et", "Sıvı yağ", "Pirinç" vb.
  gramaj DECIMAL(10,2) NOT NULL,        -- 150
  birim VARCHAR(20) DEFAULT 'g',        -- g, ml, adet
  aciklama TEXT,
  sira INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sartname_id, alt_tip_id, malzeme_tipi)
);

CREATE INDEX IF NOT EXISTS idx_gramaj_kural_sartname ON sartname_gramaj_kurallari(sartname_id);
CREATE INDEX IF NOT EXISTS idx_gramaj_kural_alt_tip ON sartname_gramaj_kurallari(alt_tip_id);
CREATE INDEX IF NOT EXISTS idx_gramaj_kural_aktif ON sartname_gramaj_kurallari(aktif);

-- =============================================
-- 3. MALZEME TİP EŞLEŞMELERİ (Sözlük)
-- Soyut malzeme tipi → gerçek malzeme adları
-- =============================================
CREATE TABLE IF NOT EXISTS malzeme_tip_eslesmeleri (
  id SERIAL PRIMARY KEY,
  malzeme_tipi VARCHAR(100) NOT NULL,
  eslesen_kelimeler TEXT[] NOT NULL DEFAULT '{}',    -- ARRAY['dana', 'kuzu', 'kuşbaşı', 'bonfile']
  urun_kategori_kodlari TEXT[] DEFAULT '{}',         -- Ürün kartı kategorisi ile eşleşme
  aciklama TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_malzeme_tip_eslesme_tip ON malzeme_tip_eslesmeleri(malzeme_tipi) WHERE aktif = true;

-- Seed: Malzeme eşleme sözlüğü
INSERT INTO malzeme_tip_eslesmeleri (malzeme_tipi, eslesen_kelimeler, aciklama) VALUES
  ('Çiğ et', ARRAY['dana', 'kuzu', 'kuşbaşı', 'bonfile', 'but', 'incik', 'antrikot', 'biftek', 'sığır', 'kemiksiz et', 'parça et', 'dana eti', 'kuzu eti'], 'Kırmızı et (kemiksiz parça)'),
  ('Çiğ et (kemikli)', ARRAY['kemikli et', 'kuzu incik', 'pirzola', 'kaburga', 'tandir'], 'Kemikli kırmızı et'),
  ('Çiğ kıyma', ARRAY['kıyma', 'dana kıyma', 'kuzu kıyma', 'kıymalı'], 'Her türlü kıyma'),
  ('Tavuk', ARRAY['tavuk', 'piliç', 'tavuk but', 'tavuk göğüs', 'but', 'göğüs', 'kanat'], 'Tavuk ve piliç'),
  ('Balık', ARRAY['balık', 'somon', 'hamsi', 'levrek', 'çipura', 'palamut', 'mezgit', 'alabalık'], 'Her türlü balık'),
  ('Sıvı yağ', ARRAY['ayçiçek yağı', 'ayçiçekyağı', 'sıvıyağ', 'sıvı yağ', 'mısırözü yağı', 'kanola yağı', 'bitkisel yağ'], 'Sıvı bitkisel yağlar'),
  ('Zeytinyağı', ARRAY['zeytinyağı', 'zeytin yağı'], 'Zeytinyağı'),
  ('Tereyağı', ARRAY['tereyağı', 'tereyağ', 'margarin', 'tere yağı'], 'Tereyağı ve margarin'),
  ('Soğan', ARRAY['soğan', 'kuru soğan', 'sogan'], 'Kuru soğan'),
  ('Domates', ARRAY['domates', 'çeri domates'], 'Taze domates'),
  ('Domates salçası', ARRAY['salça', 'domates salçası', 'salca'], 'Domates salçası'),
  ('Biber salçası', ARRAY['biber salçası', 'acı biber salçası', 'tatli biber salcasi'], 'Biber salçası'),
  ('Pirinç', ARRAY['pirinç', 'baldo', 'osmancık', 'pirinc', 'basmati'], 'Pirinç çeşitleri'),
  ('Bulgur', ARRAY['bulgur', 'pilavlık bulgur', 'ince bulgur', 'köftelik bulgur'], 'Bulgur çeşitleri'),
  ('Makarna', ARRAY['makarna', 'spagetti', 'penne', 'fettuccine', 'erişte', 'şehriye'], 'Makarna çeşitleri'),
  ('Kuru fasulye', ARRAY['kuru fasulye', 'fasulye', 'barbunya'], 'Kuru fasulye ve barbunya'),
  ('Nohut', ARRAY['nohut'], 'Nohut'),
  ('Kırmızı mercimek', ARRAY['kırmızı mercimek', 'mercimek'], 'Mercimek'),
  ('Yeşil mercimek', ARRAY['yeşil mercimek'], 'Yeşil mercimek'),
  ('Un', ARRAY['un', 'buğday unu', 'ekmek unu'], 'Un'),
  ('Yoğurt', ARRAY['yoğurt', 'yogurt', 'süzme yoğurt'], 'Yoğurt'),
  ('Süt', ARRAY['süt', 'tam yağlı süt'], 'Süt'),
  ('Yumurta', ARRAY['yumurta'], 'Yumurta'),
  ('Tuz', ARRAY['tuz', 'iyotlu tuz'], 'Tuz'),
  ('Karabiber', ARRAY['karabiber', 'kara biber'], 'Karabiber'),
  ('Pul biber', ARRAY['pul biber', 'pulbiber', 'kırmızı pul biber', 'kırmızıbiber'], 'Pul biber'),
  ('Sebze (karışık)', ARRAY['patlıcan', 'kabak', 'biber', 'bamya', 'bezelye', 'ıspanak', 'lahana', 'havuç', 'patates', 'enginar', 'kereviz', 'pirasa', 'karnabahar', 'brokoli'], 'Genel sebze grubu')
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. RECETELER TABLOSUNA ALT_TIP_ID EKLE
-- =============================================
ALTER TABLE receteler ADD COLUMN IF NOT EXISTS alt_tip_id INTEGER REFERENCES alt_tip_tanimlari(id);
CREATE INDEX IF NOT EXISTS idx_receteler_alt_tip ON receteler(alt_tip_id);

-- =============================================
-- 5. MEVCUT ALT_KATEGORİ → ALT_TİP_ID GEÇİŞİ
-- Mevcut alt_kategori değerlerini yeni alt_tip_id'ye eşle
-- =============================================
DO $$
BEGIN
  -- et → parcali_et_kemiksiz (varsayılan, kemikli olanlar sonra ayırt edilir)
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'parcali_et_kemiksiz')
  WHERE alt_kategori = 'et' AND alt_tip_id IS NULL;

  -- tavuk → tavuk_parcali
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tavuk_parcali')
  WHERE alt_kategori = 'tavuk' AND alt_tip_id IS NULL;

  -- bakliyat → kuru_baklagil_etsiz (varsayılan, etli olanlar sonra ayırt edilir)
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'kuru_baklagil_etsiz')
  WHERE alt_kategori = 'bakliyat' AND alt_tip_id IS NULL;

  -- sebze → sebze_yemegi
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'sebze_yemegi')
  WHERE alt_kategori = 'sebze' AND alt_tip_id IS NULL;

  -- pilav → pilav_pirinc (varsayılan)
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'pilav_pirinc')
  WHERE alt_kategori = 'pilav' AND alt_tip_id IS NULL;

  -- corba → corba_genel
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_genel')
  WHERE alt_kategori = 'corba' AND alt_tip_id IS NULL;

  -- salata → salata_mevsim
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'salata_mevsim')
  WHERE alt_kategori = 'salata' AND alt_tip_id IS NULL;

  -- tatli → tatli_sutlu (varsayılan)
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tatli_sutlu')
  WHERE alt_kategori = 'tatli' AND alt_tip_id IS NULL;

  -- icecek → icecek_diger
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'icecek_diger')
  WHERE alt_kategori = 'icecek' AND alt_tip_id IS NULL;

  -- kahvalti → kahvalti_genel
  UPDATE receteler SET alt_tip_id = (SELECT id FROM alt_tip_tanimlari WHERE kod = 'kahvalti_genel')
  WHERE alt_kategori = 'kahvalti' AND alt_tip_id IS NULL;

  -- diger → NULL (alt_tip_id atanmaz, AI ile belirlenecek)

  RAISE NOTICE 'Alt kategori -> Alt tip geçişi tamamlandı.';
END $$;

-- =============================================
-- 6. KYK-2025 ÖRNEK ŞARTNAME + GRAMAJ KURALLARI
-- =============================================

-- KYK-2025 şartnamesini ekle (veya mevcut KYK-2024'ü kullan)
INSERT INTO proje_sartnameleri (kod, ad, kurum_id, yil, notlar)
VALUES (
  'KYK-2025',
  'KYK Yurt Yemek Şartnamesi 2025',
  (SELECT id FROM sartname_kurumlari WHERE kod = 'GSB'),
  2025,
  'Gençlik ve Spor Bakanlığı KYK yurtları için standart gramaj şartnamesi (2025)'
)
ON CONFLICT (kod) DO NOTHING;

-- Gramaj kuralları seed
DO $$
DECLARE
  v_sartname_id INTEGER;
BEGIN
  SELECT id INTO v_sartname_id FROM proje_sartnameleri WHERE kod = 'KYK-2025';

  IF v_sartname_id IS NOT NULL THEN

    -- Parçalı Et (Kemiksiz) kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'parcali_et_kemiksiz'), 'Çiğ et', 150, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'parcali_et_kemiksiz'), 'Sıvı yağ', 15, 'ml', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'parcali_et_kemiksiz'), 'Soğan', 30, 'g', 3)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Parçalı Et (Kemikli) kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'parcali_et_kemikli'), 'Çiğ et (kemikli)', 200, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'parcali_et_kemikli'), 'Sıvı yağ', 10, 'ml', 2)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Kıymalı Yemekler kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'kiymali'), 'Çiğ kıyma', 120, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'kiymali'), 'Sıvı yağ', 10, 'ml', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'kiymali'), 'Soğan', 25, 'g', 3)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Etli Sebze kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'etli_sebze'), 'Çiğ et', 80, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'etli_sebze'), 'Sebze (karışık)', 200, 'g', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'etli_sebze'), 'Sıvı yağ', 15, 'ml', 3)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Etli Baklagil kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'etli_bakliyat'), 'Çiğ et', 60, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'etli_bakliyat'), 'Kuru fasulye', 80, 'g', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'etli_bakliyat'), 'Sıvı yağ', 15, 'ml', 3)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Kuru Baklagil (Etsiz) kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'kuru_baklagil_etsiz'), 'Kuru fasulye', 80, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'kuru_baklagil_etsiz'), 'Sıvı yağ', 15, 'ml', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'kuru_baklagil_etsiz'), 'Soğan', 20, 'g', 3),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'kuru_baklagil_etsiz'), 'Domates salçası', 10, 'g', 4)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Tavuk (Parçalı) kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tavuk_parcali'), 'Tavuk', 120, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tavuk_parcali'), 'Sıvı yağ', 10, 'ml', 2)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Tavuk (Kemikli) kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tavuk_kemikli'), 'Tavuk', 180, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tavuk_kemikli'), 'Sıvı yağ', 10, 'ml', 2)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Balık kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'balik_genel'), 'Balık', 150, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'balik_genel'), 'Sıvı yağ', 15, 'ml', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'balik_genel'), 'Un', 15, 'g', 3)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Çorba (Genel) kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_genel'), 'Kırmızı mercimek', 25, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_genel'), 'Sıvı yağ', 10, 'ml', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_genel'), 'Un', 8, 'g', 3),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_genel'), 'Soğan', 10, 'g', 4),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_genel'), 'Domates salçası', 5, 'g', 5)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Mercimek Çorbası kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_mercimek'), 'Kırmızı mercimek', 30, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_mercimek'), 'Sıvı yağ', 10, 'ml', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_mercimek'), 'Soğan', 15, 'g', 3),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_mercimek'), 'Un', 5, 'g', 4),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'corba_mercimek'), 'Domates salçası', 5, 'g', 5)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Pirinç Pilavı kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'pilav_pirinc'), 'Pirinç', 100, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'pilav_pirinc'), 'Tereyağı', 15, 'g', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'pilav_pirinc'), 'Tuz', 3, 'g', 3)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Bulgur Pilavı kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'pilav_bulgur'), 'Bulgur', 100, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'pilav_bulgur'), 'Sıvı yağ', 15, 'ml', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'pilav_bulgur'), 'Soğan', 15, 'g', 3),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'pilav_bulgur'), 'Domates salçası', 5, 'g', 4)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Makarna kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'makarna_genel'), 'Makarna', 100, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'makarna_genel'), 'Sıvı yağ', 10, 'ml', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'makarna_genel'), 'Domates salçası', 15, 'g', 3)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Salata kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'salata_mevsim'), 'Sebze (karışık)', 150, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'salata_mevsim'), 'Zeytinyağı', 10, 'ml', 2)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Sütlü tatlı kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tatli_sutlu'), 'Süt', 200, 'ml', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tatli_sutlu'), 'Pirinç', 25, 'g', 2)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Şerbetli tatlı kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tatli_serbetli'), 'Un', 50, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'tatli_serbetli'), 'Tereyağı', 20, 'g', 2)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    -- Sebze Yemeği kuralları
    INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira) VALUES
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'sebze_yemegi'), 'Sebze (karışık)', 250, 'g', 1),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'sebze_yemegi'), 'Sıvı yağ', 15, 'ml', 2),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'sebze_yemegi'), 'Soğan', 20, 'g', 3),
      (v_sartname_id, (SELECT id FROM alt_tip_tanimlari WHERE kod = 'sebze_yemegi'), 'Domates salçası', 10, 'g', 4)
    ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING;

    RAISE NOTICE 'KYK-2025 gramaj kuralları eklendi.';
  END IF;
END $$;

-- =============================================
-- 7. UPDATED_AT TRİGGER'LARI
-- =============================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_alt_tip_updated ON alt_tip_tanimlari;
CREATE TRIGGER trigger_alt_tip_updated
  BEFORE UPDATE ON alt_tip_tanimlari
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS trigger_gramaj_kural_updated ON sartname_gramaj_kurallari;
CREATE TRIGGER trigger_gramaj_kural_updated
  BEFORE UPDATE ON sartname_gramaj_kurallari
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS trigger_malzeme_eslesme_updated ON malzeme_tip_eslesmeleri;
CREATE TRIGGER trigger_malzeme_eslesme_updated
  BEFORE UPDATE ON malzeme_tip_eslesmeleri
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================
-- 8. VIEW: Şartname gramaj kuralları detay
-- =============================================
CREATE OR REPLACE VIEW sartname_gramaj_kural_detay_view AS
SELECT
  sgk.id,
  sgk.sartname_id,
  ps.kod as sartname_kodu,
  ps.ad as sartname_adi,
  sgk.alt_tip_id,
  att.kod as alt_tip_kodu,
  att.ad as alt_tip_adi,
  att.ikon as alt_tip_ikon,
  rk.ad as kategori_adi,
  rk.ikon as kategori_ikon,
  sgk.malzeme_tipi,
  sgk.gramaj,
  sgk.birim,
  sgk.aciklama,
  sgk.sira,
  sgk.aktif
FROM sartname_gramaj_kurallari sgk
JOIN proje_sartnameleri ps ON ps.id = sgk.sartname_id
JOIN alt_tip_tanimlari att ON att.id = sgk.alt_tip_id
LEFT JOIN recete_kategoriler rk ON rk.id = att.kategori_id
WHERE sgk.aktif = true;

-- =============================================
-- 9. VIEW: Reçete alt tip durumu
-- =============================================
CREATE OR REPLACE VIEW recete_alt_tip_durum_view AS
SELECT
  r.id as recete_id,
  r.ad as recete_adi,
  r.kategori_id,
  rk.ad as kategori_adi,
  r.alt_kategori,
  r.alt_tip_id,
  att.kod as alt_tip_kodu,
  att.ad as alt_tip_adi,
  att.ikon as alt_tip_ikon,
  CASE
    WHEN r.alt_tip_id IS NOT NULL THEN 'atanmis'
    WHEN r.alt_kategori IS NOT NULL THEN 'eski_sistem'
    ELSE 'atanmamis'
  END as alt_tip_durumu
FROM receteler r
LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
LEFT JOIN alt_tip_tanimlari att ON att.id = r.alt_tip_id
WHERE r.aktif = true;

-- Yorumlar
COMMENT ON TABLE alt_tip_tanimlari IS 'Yemek alt tip referans tablosu. Her kategori altında detaylı yemek tipleri (parcali_et_kemiksiz, kiymali, etli_sebze vb.)';
COMMENT ON TABLE sartname_gramaj_kurallari IS 'Şartname × alt_tip × malzeme_tipi gramaj kuralları. Toplu gramaj uygulaması bu tablo üzerinden çalışır.';
COMMENT ON TABLE malzeme_tip_eslesmeleri IS 'Soyut malzeme tipi → gerçek malzeme adları sözlüğü. Toplu uygulamada malzeme eşleştirme için kullanılır.';
COMMENT ON COLUMN receteler.alt_tip_id IS 'Reçetenin detaylı alt tipi. Şartname gramaj kurallarıyla eşleşme bu alan üzerinden yapılır.';
