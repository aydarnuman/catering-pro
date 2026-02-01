-- Ana Ürünler (Master Products) Tablosu
-- Stok kartlarını gruplamak için genel ürün kategorileri

-- Ana ürünler tablosu
CREATE TABLE IF NOT EXISTS ana_urunler (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(50) UNIQUE NOT NULL,
    ad VARCHAR(100) NOT NULL,
    ikon VARCHAR(10) DEFAULT '📦',
    kategori VARCHAR(50), -- sebze, meyve, et, bakliyat, sut, yag, baharat, tahil, diger
    sira INTEGER DEFAULT 100,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Stok kartlarına ana_urun_id ekleme
ALTER TABLE stok_kartlari 
ADD COLUMN IF NOT EXISTS ana_urun_id INTEGER REFERENCES ana_urunler(id) ON DELETE SET NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_stok_kartlari_ana_urun ON stok_kartlari(ana_urun_id);
CREATE INDEX IF NOT EXISTS idx_ana_urunler_kategori ON ana_urunler(kategori);
CREATE INDEX IF NOT EXISTS idx_ana_urunler_aktif ON ana_urunler(aktif);

-- Temel ana ürünleri ekle (hazır yemek sektörü için)
INSERT INTO ana_urunler (kod, ad, ikon, kategori, sira) VALUES
-- Sebzeler
('domates', 'Domates', '🍅', 'sebze', 1),
('sogan', 'Soğan', '🧅', 'sebze', 2),
('patates', 'Patates', '🥔', 'sebze', 3),
('havuc', 'Havuç', '🥕', 'sebze', 4),
('biber', 'Biber', '🌶️', 'sebze', 5),
('patlican', 'Patlıcan', '🍆', 'sebze', 6),
('kabak', 'Kabak', '🥒', 'sebze', 7),
('ispanak', 'Ispanak', '🥬', 'sebze', 8),
('lahana', 'Lahana', '🥬', 'sebze', 9),
('fasulye_taze', 'Taze Fasulye', '🫛', 'sebze', 10),
('bezelye', 'Bezelye', '🫛', 'sebze', 11),
('enginar', 'Enginar', '🌿', 'sebze', 12),
('bamya', 'Bamya', '🌿', 'sebze', 13),
('pirasa', 'Pırasa', '🧅', 'sebze', 14),
('kereviz', 'Kereviz', '🥬', 'sebze', 15),
('sarmisak', 'Sarımsak', '🧄', 'sebze', 16),
('maydonoz', 'Maydanoz', '🌿', 'sebze', 17),
('dereotu', 'Dereotu', '🌿', 'sebze', 18),

-- Meyveler
('elma', 'Elma', '🍎', 'meyve', 1),
('portakal', 'Portakal', '🍊', 'meyve', 2),
('limon', 'Limon', '🍋', 'meyve', 3),
('muz', 'Muz', '🍌', 'meyve', 4),
('uzum', 'Üzüm', '🍇', 'meyve', 5),
('karpuz', 'Karpuz', '🍉', 'meyve', 6),
('kavun', 'Kavun', '🍈', 'meyve', 7),
('kiraz', 'Kiraz', '🍒', 'meyve', 8),
('seftali', 'Şeftali', '🍑', 'meyve', 9),
('armut', 'Armut', '🍐', 'meyve', 10),
('erik', 'Erik', '🫐', 'meyve', 11),
('incir', 'İncir', '🍈', 'meyve', 12),

-- Et & Tavuk
('tavuk_but', 'Tavuk But', '🍗', 'et', 1),
('tavuk_gogus', 'Tavuk Göğüs', '🍗', 'et', 2),
('tavuk_kanat', 'Tavuk Kanat', '🍗', 'et', 3),
('tavuk_baget', 'Tavuk Baget', '🍗', 'et', 4),
('piliç_pirzola', 'Piliç Pirzola', '🍗', 'et', 5),
('dana_kiyma', 'Dana Kıyma', '🥩', 'et', 6),
('dana_kusbasi', 'Dana Kuşbaşı', '🥩', 'et', 7),
('dana_but', 'Dana But', '🥩', 'et', 8),
('kuzu_kiyma', 'Kuzu Kıyma', '🥩', 'et', 9),
('kuzu_kusbasi', 'Kuzu Kuşbaşı', '🥩', 'et', 10),
('kuzu_incik', 'Kuzu İncik', '🥩', 'et', 11),
('kofte', 'Köfte', '🍖', 'et', 12),

-- Balık
('levrek', 'Levrek', '🐟', 'balik', 1),
('cipura', 'Çipura', '🐟', 'balik', 2),
('somon', 'Somon', '🐟', 'balik', 3),
('hamsi', 'Hamsi', '🐟', 'balik', 4),
('istavrit', 'İstavrit', '🐟', 'balik', 5),
('mezgit', 'Mezgit', '🐟', 'balik', 6),

-- Tahıl & Bakliyat
('pirinc', 'Pirinç', '🍚', 'tahil', 1),
('bulgur', 'Bulgur', '🌾', 'tahil', 2),
('makarna', 'Makarna', '🍝', 'tahil', 3),
('eriste', 'Erişte', '🍝', 'tahil', 4),
('un', 'Un', '🌾', 'tahil', 5),
('irmik', 'İrmik', '🌾', 'tahil', 6),
('mercimek', 'Mercimek', '🫘', 'bakliyat', 1),
('nohut', 'Nohut', '🫘', 'bakliyat', 2),
('kuru_fasulye', 'Kuru Fasulye', '🫘', 'bakliyat', 3),
('barbunya', 'Barbunya', '🫘', 'bakliyat', 4),

-- Süt Ürünleri
('sut', 'Süt', '🥛', 'sut', 1),
('yogurt', 'Yoğurt', '🥛', 'sut', 2),
('peynir', 'Peynir', '🧀', 'sut', 3),
('kasar', 'Kaşar', '🧀', 'sut', 4),
('tereyag', 'Tereyağı', '🧈', 'sut', 5),
('krema', 'Krema', '🥛', 'sut', 6),
('ayran', 'Ayran', '🥛', 'sut', 7),

-- Yağlar
('aycicek_yagi', 'Ayçiçek Yağı', '🫒', 'yag', 1),
('zeytinyagi', 'Zeytinyağı', '🫒', 'yag', 2),
('misir_yagi', 'Mısır Yağı', '🫒', 'yag', 3),
('sivi_yag', 'Sıvı Yağ', '🫒', 'yag', 4),

-- Baharat & Sos
('tuz', 'Tuz', '🧂', 'baharat', 1),
('karabiber', 'Karabiber', '🌶️', 'baharat', 2),
('pul_biber', 'Pul Biber', '🌶️', 'baharat', 3),
('kimyon', 'Kimyon', '🌿', 'baharat', 4),
('kekik', 'Kekik', '🌿', 'baharat', 5),
('nane', 'Nane', '🌿', 'baharat', 6),
('salca', 'Salça', '🍅', 'baharat', 7),
('sirke', 'Sirke', '🍶', 'baharat', 8),

-- Diğer
('yumurta', 'Yumurta', '🥚', 'diger', 1),
('seker', 'Şeker', '🍬', 'diger', 2),
('ekmek', 'Ekmek', '🍞', 'diger', 3),
('su', 'Su', '💧', 'diger', 4),
('cay', 'Çay', '🍵', 'diger', 5)

ON CONFLICT (kod) DO NOTHING;

-- Mevcut stok kartlarını otomatik eşleştirmeye çalış (basit keyword matching)
-- Bu bir kez çalışacak, sonra manuel düzeltmeler yapılabilir
UPDATE stok_kartlari sk
SET ana_urun_id = au.id
FROM ana_urunler au
WHERE sk.ana_urun_id IS NULL
  AND (
    -- Tam kelime eşleşmesi (kelime sınırlarında)
    LOWER(sk.ad) ~ ('\y' || LOWER(au.ad) || '\y')
    OR 
    -- Veya doğrudan içerme
    LOWER(sk.ad) LIKE '%' || LOWER(au.ad) || '%'
  );

COMMENT ON TABLE ana_urunler IS 'Genel ürün kategorileri - stok kartlarını gruplamak için';
COMMENT ON COLUMN stok_kartlari.ana_urun_id IS 'Bu stok kartının bağlı olduğu ana ürün';
