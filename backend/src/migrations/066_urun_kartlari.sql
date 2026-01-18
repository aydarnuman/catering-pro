-- =====================================================
-- 066: Ürün Kartları Sistemi
-- Reçeteler için temiz ürün adları
-- =====================================================

-- Ürün kategorileri
CREATE TABLE IF NOT EXISTS urun_kategorileri (
  id SERIAL PRIMARY KEY,
  ad VARCHAR(100) NOT NULL UNIQUE,
  ikon VARCHAR(10) DEFAULT '📦',
  sira INT DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Varsayılan kategorileri ekle
INSERT INTO urun_kategorileri (ad, ikon, sira) VALUES
  ('Et & Tavuk', '🥩', 1),
  ('Balık & Deniz Ürünleri', '🐟', 2),
  ('Süt Ürünleri', '🥛', 3),
  ('Sebzeler', '🥬', 4),
  ('Meyveler', '🍎', 5),
  ('Bakliyat', '🫘', 6),
  ('Tahıllar & Makarna', '🍚', 7),
  ('Yağlar', '🧈', 8),
  ('Baharatlar', '🌶️', 9),
  ('Soslar & Salçalar', '🍅', 10),
  ('Şekerler & Tatlandırıcılar', '🍯', 11),
  ('İçecekler', '🥤', 12),
  ('Diğer', '📦', 99)
ON CONFLICT (ad) DO NOTHING;

-- Ana ürün kartları tablosu
CREATE TABLE IF NOT EXISTS urun_kartlari (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(20) UNIQUE,
  ad VARCHAR(200) NOT NULL,
  kategori_id INT REFERENCES urun_kategorileri(id),
  
  -- Birim bilgileri
  varsayilan_birim VARCHAR(20) DEFAULT 'gr',
  
  -- Fiyat bilgileri (stok kartından veya manuel)
  stok_kart_id INT REFERENCES stok_kartlari(id) ON DELETE SET NULL,
  manuel_fiyat DECIMAL(15,2),
  fiyat_birimi VARCHAR(20) DEFAULT 'kg', -- kg başına, lt başına vb.
  son_guncelleme TIMESTAMP,
  
  -- Görsel
  ikon VARCHAR(10),
  
  -- Durum
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ürün kodu otomatik oluştur
CREATE OR REPLACE FUNCTION generate_urun_kodu()
RETURNS TRIGGER AS $$
DECLARE
  kategori_kod VARCHAR(3);
  yeni_numara INT;
BEGIN
  -- Kategori kodunu al
  SELECT 
    UPPER(SUBSTRING(REGEXP_REPLACE(ad, '[^a-zA-ZğĞüÜşŞıİöÖçÇ]', '', 'g'), 1, 3))
  INTO kategori_kod
  FROM urun_kategorileri
  WHERE id = NEW.kategori_id;
  
  IF kategori_kod IS NULL THEN
    kategori_kod := 'URN';
  END IF;
  
  -- Sonraki numarayı bul
  SELECT COALESCE(MAX(
    CASE 
      WHEN kod ~ ('^' || kategori_kod || '-[0-9]+$')
      THEN CAST(SUBSTRING(kod FROM '-([0-9]+)$') AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO yeni_numara
  FROM urun_kartlari
  WHERE kod LIKE kategori_kod || '-%';
  
  NEW.kod := kategori_kod || '-' || LPAD(yeni_numara::TEXT, 4, '0');
  NEW.updated_at := CURRENT_TIMESTAMP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_urun_kodu ON urun_kartlari;
CREATE TRIGGER trg_generate_urun_kodu
  BEFORE INSERT ON urun_kartlari
  FOR EACH ROW
  WHEN (NEW.kod IS NULL)
  EXECUTE FUNCTION generate_urun_kodu();

-- Güncelleme trigger
CREATE OR REPLACE FUNCTION update_urun_kartlari_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_urun_kartlari_timestamp ON urun_kartlari;
CREATE TRIGGER trg_update_urun_kartlari_timestamp
  BEFORE UPDATE ON urun_kartlari
  FOR EACH ROW
  EXECUTE FUNCTION update_urun_kartlari_timestamp();

-- recete_malzemeler tablosuna urun_kart_id ekle
ALTER TABLE recete_malzemeler 
ADD COLUMN IF NOT EXISTS urun_kart_id INT REFERENCES urun_kartlari(id) ON DELETE SET NULL;

-- Varsayılan ürün kartlarını ekle (temiz isimler)
INSERT INTO urun_kartlari (ad, kategori_id, varsayilan_birim, ikon, fiyat_birimi) VALUES
  -- Et & Tavuk
  ('Dana Kıyma', 1, 'gr', '🥩', 'kg'),
  ('Dana Kuşbaşı', 1, 'gr', '🥩', 'kg'),
  ('Dana Bonfile', 1, 'gr', '🥩', 'kg'),
  ('Kuzu Kuşbaşı', 1, 'gr', '🥩', 'kg'),
  ('Kuzu Pirzola', 1, 'gr', '🥩', 'kg'),
  ('Tavuk Göğsü', 1, 'gr', '🍗', 'kg'),
  ('Tavuk But', 1, 'gr', '🍗', 'kg'),
  ('Tavuk Kanat', 1, 'gr', '🍗', 'kg'),
  ('Tavuk Bütün', 1, 'gr', '🍗', 'kg'),
  
  -- Balık
  ('Levrek', 2, 'gr', '🐟', 'kg'),
  ('Çipura', 2, 'gr', '🐟', 'kg'),
  ('Somon', 2, 'gr', '🐟', 'kg'),
  ('Hamsi', 2, 'gr', '🐟', 'kg'),
  ('Karides', 2, 'gr', '🦐', 'kg'),
  
  -- Süt Ürünleri
  ('Süt', 3, 'ml', '🥛', 'lt'),
  ('Yoğurt', 3, 'gr', '🥛', 'kg'),
  ('Kaşar Peyniri', 3, 'gr', '🧀', 'kg'),
  ('Beyaz Peynir', 3, 'gr', '🧀', 'kg'),
  ('Krema', 3, 'ml', '🥛', 'lt'),
  ('Tereyağı', 3, 'gr', '🧈', 'kg'),
  ('Labne', 3, 'gr', '🥛', 'kg'),
  
  -- Sebzeler
  ('Soğan', 4, 'gr', '🧅', 'kg'),
  ('Sarımsak', 4, 'gr', '🧄', 'kg'),
  ('Domates', 4, 'gr', '🍅', 'kg'),
  ('Biber (Yeşil)', 4, 'gr', '🫑', 'kg'),
  ('Biber (Kırmızı)', 4, 'gr', '🌶️', 'kg'),
  ('Patlıcan', 4, 'gr', '🍆', 'kg'),
  ('Kabak', 4, 'gr', '🥒', 'kg'),
  ('Havuç', 4, 'gr', '🥕', 'kg'),
  ('Patates', 4, 'gr', '🥔', 'kg'),
  ('Ispanak', 4, 'gr', '🥬', 'kg'),
  ('Marul', 4, 'gr', '🥬', 'kg'),
  ('Salatalık', 4, 'gr', '🥒', 'kg'),
  ('Bamya', 4, 'gr', '🥬', 'kg'),
  ('Fasulye (Taze)', 4, 'gr', '🫛', 'kg'),
  ('Bezelye', 4, 'gr', '🫛', 'kg'),
  ('Enginar', 4, 'gr', '🥬', 'kg'),
  ('Lahana', 4, 'gr', '🥬', 'kg'),
  ('Karnabahar', 4, 'gr', '🥦', 'kg'),
  ('Brokoli', 4, 'gr', '🥦', 'kg'),
  ('Mantar', 4, 'gr', '🍄', 'kg'),
  ('Maydanoz', 4, 'gr', '🌿', 'kg'),
  ('Dereotu', 4, 'gr', '🌿', 'kg'),
  ('Nane', 4, 'gr', '🌿', 'kg'),
  
  -- Meyveler
  ('Limon', 5, 'gr', '🍋', 'kg'),
  ('Portakal', 5, 'gr', '🍊', 'kg'),
  ('Elma', 5, 'gr', '🍎', 'kg'),
  ('Armut', 5, 'gr', '🍐', 'kg'),
  ('Muz', 5, 'gr', '🍌', 'kg'),
  ('Üzüm', 5, 'gr', '🍇', 'kg'),
  ('Çilek', 5, 'gr', '🍓', 'kg'),
  ('Kayısı', 5, 'gr', '🍑', 'kg'),
  ('Şeftali', 5, 'gr', '🍑', 'kg'),
  ('Kiraz', 5, 'gr', '🍒', 'kg'),
  ('Ayva', 5, 'gr', '🍐', 'kg'),
  
  -- Bakliyat
  ('Nohut', 6, 'gr', '🫘', 'kg'),
  ('Kuru Fasulye', 6, 'gr', '🫘', 'kg'),
  ('Mercimek (Kırmızı)', 6, 'gr', '🫘', 'kg'),
  ('Mercimek (Yeşil)', 6, 'gr', '🫘', 'kg'),
  ('Barbunya', 6, 'gr', '🫘', 'kg'),
  
  -- Tahıllar & Makarna
  ('Pirinç', 7, 'gr', '🍚', 'kg'),
  ('Bulgur', 7, 'gr', '🌾', 'kg'),
  ('Un', 7, 'gr', '🌾', 'kg'),
  ('Makarna (Spagetti)', 7, 'gr', '🍝', 'kg'),
  ('Makarna (Penne)', 7, 'gr', '🍝', 'kg'),
  ('Makarna (Fiyonk)', 7, 'gr', '🍝', 'kg'),
  ('Şehriye', 7, 'gr', '🍜', 'kg'),
  ('Erişte', 7, 'gr', '🍜', 'kg'),
  ('Ekmek', 7, 'gr', '🍞', 'kg'),
  
  -- Yağlar
  ('Zeytinyağı', 8, 'ml', '🫒', 'lt'),
  ('Ayçiçek Yağı', 8, 'ml', '🌻', 'lt'),
  ('Mısır Yağı', 8, 'ml', '🌽', 'lt'),
  ('Sızma Zeytinyağı', 8, 'ml', '🫒', 'lt'),
  
  -- Baharatlar
  ('Tuz', 9, 'gr', '🧂', 'kg'),
  ('Karabiber', 9, 'gr', '🌶️', 'kg'),
  ('Kırmızı Biber', 9, 'gr', '🌶️', 'kg'),
  ('Pul Biber', 9, 'gr', '🌶️', 'kg'),
  ('Kimyon', 9, 'gr', '🌿', 'kg'),
  ('Kekik', 9, 'gr', '🌿', 'kg'),
  ('Nane (Kuru)', 9, 'gr', '🌿', 'kg'),
  ('Tarçın', 9, 'gr', '🌿', 'kg'),
  ('Defne Yaprağı', 9, 'adet', '🍃', 'kg'),
  ('Sumak', 9, 'gr', '🌿', 'kg'),
  ('Zerdeçal', 9, 'gr', '🌿', 'kg'),
  ('Köri', 9, 'gr', '🌿', 'kg'),
  
  -- Soslar & Salçalar
  ('Domates Salçası', 10, 'gr', '🍅', 'kg'),
  ('Biber Salçası', 10, 'gr', '🌶️', 'kg'),
  ('Ketçap', 10, 'gr', '🍅', 'kg'),
  ('Mayonez', 10, 'gr', '🥫', 'kg'),
  ('Hardal', 10, 'gr', '🥫', 'kg'),
  ('Soya Sosu', 10, 'ml', '🥫', 'lt'),
  ('Sirke', 10, 'ml', '🍶', 'lt'),
  ('Nar Ekşisi', 10, 'ml', '🍷', 'lt'),
  
  -- Şekerler
  ('Şeker', 11, 'gr', '🍬', 'kg'),
  ('Pudra Şekeri', 11, 'gr', '🍬', 'kg'),
  ('Bal', 11, 'gr', '🍯', 'kg'),
  ('Pekmez', 11, 'gr', '🍯', 'kg'),
  
  -- İçecekler
  ('Su', 12, 'ml', '💧', 'lt'),
  ('Ayran', 12, 'ml', '🥛', 'lt'),
  ('Meyve Suyu', 12, 'ml', '🧃', 'lt'),
  ('Çay', 12, 'gr', '🍵', 'kg'),
  ('Kahve', 12, 'gr', '☕', 'kg'),
  
  -- Diğer
  ('Yumurta', 13, 'adet', '🥚', 'adet'),
  ('Maya', 13, 'gr', '🍞', 'kg'),
  ('Kabartma Tozu', 13, 'gr', '📦', 'kg'),
  ('Vanilya', 13, 'gr', '📦', 'kg'),
  ('Nişasta', 13, 'gr', '📦', 'kg'),
  ('Ceviz', 13, 'gr', '🥜', 'kg'),
  ('Fındık', 13, 'gr', '🥜', 'kg'),
  ('Badem', 13, 'gr', '🥜', 'kg'),
  ('Fıstık', 13, 'gr', '🥜', 'kg'),
  ('Kuru Üzüm', 13, 'gr', '🍇', 'kg'),
  ('Hurma', 13, 'gr', '🌴', 'kg')
ON CONFLICT DO NOTHING;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_kategori ON urun_kartlari(kategori_id);
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_ad ON urun_kartlari(ad);
CREATE INDEX IF NOT EXISTS idx_urun_kartlari_aktif ON urun_kartlari(aktif);
CREATE INDEX IF NOT EXISTS idx_recete_malzemeler_urun_kart ON recete_malzemeler(urun_kart_id);

-- View: Ürün kartları detaylı
CREATE OR REPLACE VIEW v_urun_kartlari AS
SELECT 
  uk.*,
  kat.ad as kategori_adi,
  kat.ikon as kategori_ikon,
  sk.ad as stok_kart_adi,
  sk.son_alis_fiyat as stok_fiyat,
  COALESCE(uk.manuel_fiyat, sk.son_alis_fiyat) as guncel_fiyat
FROM urun_kartlari uk
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
LEFT JOIN stok_kartlari sk ON sk.id = uk.stok_kart_id
WHERE uk.aktif = true;
