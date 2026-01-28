-- =============================================
-- ŞARTNAME VE GRAMAJ YÖNETİM SİSTEMİ
-- Catering projelerinin resmi gramaj şartnamelerini yönetir
-- =============================================

-- Kurumlar (GSB, MEB, Sağlık Bakanlığı vs.)
CREATE TABLE IF NOT EXISTS sartname_kurumlari (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(20) UNIQUE NOT NULL,
  ad VARCHAR(100) NOT NULL,
  ikon VARCHAR(10),
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Başlangıç kurumları
INSERT INTO sartname_kurumlari (kod, ad, ikon) VALUES
  ('GSB', 'Gençlik ve Spor Bakanlığı', '🏛️'),
  ('MEB', 'Milli Eğitim Bakanlığı', '🎓'),
  ('SAGLIK', 'Sağlık Bakanlığı', '🏥'),
  ('ADALET', 'Adalet Bakanlığı', '⚖️'),
  ('DIGER', 'Diğer', '📋')
ON CONFLICT (kod) DO NOTHING;

-- Proje şartnameleri
CREATE TABLE IF NOT EXISTS proje_sartnameleri (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(50) UNIQUE NOT NULL,
  ad VARCHAR(200) NOT NULL,
  kurum_id INTEGER REFERENCES sartname_kurumlari(id),
  yil INTEGER,
  versiyon VARCHAR(20) DEFAULT '1.0',
  kaynak_url TEXT,
  kaynak_aciklama TEXT,
  pdf_dosya TEXT,
  notlar TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Şartname-Proje ilişkisi (çoka-çok)
CREATE TABLE IF NOT EXISTS proje_sartname_atamalari (
  id SERIAL PRIMARY KEY,
  proje_id INTEGER REFERENCES projeler(id) ON DELETE CASCADE,
  sartname_id INTEGER REFERENCES proje_sartnameleri(id) ON DELETE CASCADE,
  varsayilan BOOLEAN DEFAULT false,
  baslangic_tarihi DATE,
  bitis_tarihi DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(proje_id, sartname_id)
);

-- Şartname gramaj tanımları
CREATE TABLE IF NOT EXISTS sartname_gramajlari (
  id SERIAL PRIMARY KEY,
  sartname_id INTEGER REFERENCES proje_sartnameleri(id) ON DELETE CASCADE,
  kategori_id INTEGER REFERENCES recete_kategoriler(id),
  yemek_turu VARCHAR(200),           -- Genel yemek türü: "Çorba", "Et Yemeği"
  yemek_adi VARCHAR(200),            -- Spesifik: "Mercimek Çorbası" (opsiyonel)
  malzeme_adi VARCHAR(200) NOT NULL, -- "Kırmızı Mercimek"
  stok_kart_id INTEGER REFERENCES stok_kartlari(id), -- Eşleşen stok kartı
  min_gramaj DECIMAL(10,2) NOT NULL,
  max_gramaj DECIMAL(10,2),
  birim VARCHAR(20) DEFAULT 'g',
  kisi_basi BOOLEAN DEFAULT true,    -- Kişi başı gramaj mı?
  zorunlu BOOLEAN DEFAULT false,
  notlar TEXT,
  sira INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Şartname öğün kuralları
CREATE TABLE IF NOT EXISTS sartname_ogun_kurallari (
  id SERIAL PRIMARY KEY,
  sartname_id INTEGER REFERENCES proje_sartnameleri(id) ON DELETE CASCADE,
  ogun_tipi_id INTEGER REFERENCES ogun_tipleri(id),
  min_cesit INTEGER DEFAULT 1,
  max_cesit INTEGER,
  min_kalori INTEGER,
  max_kalori INTEGER,
  zorunlu_kategoriler INTEGER[],     -- Zorunlu kategori ID'leri
  ek_kurallar JSONB,                 -- Ek kurallar JSON
  notlar TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Gramaj kontrol logları (uyumsuzluk kayıtları)
CREATE TABLE IF NOT EXISTS gramaj_kontrol_loglari (
  id SERIAL PRIMARY KEY,
  menu_ogun_yemek_id INTEGER REFERENCES menu_ogun_yemekleri(id),
  recete_id INTEGER REFERENCES receteler(id),
  sartname_gramaj_id INTEGER REFERENCES sartname_gramajlari(id),
  malzeme_adi VARCHAR(200),
  beklenen_min DECIMAL(10,2),
  beklenen_max DECIMAL(10,2),
  gerceklesen DECIMAL(10,2),
  durum VARCHAR(20), -- 'uygun', 'dusuk', 'yuksek'
  kontrol_tarihi TIMESTAMP DEFAULT NOW()
);

-- Örnek KYK Şartnamesi
INSERT INTO proje_sartnameleri (kod, ad, kurum_id, yil, notlar) VALUES
  ('KYK-2024', 'KYK Yurt Yemek Şartnamesi 2024', 
   (SELECT id FROM sartname_kurumlari WHERE kod = 'GSB'), 
   2024, 
   'Gençlik ve Spor Bakanlığı KYK yurtları için standart gramaj şartnamesi')
ON CONFLICT (kod) DO NOTHING;

-- Örnek gramajlar (KYK Şartnamesi için)
DO $$
DECLARE
  v_sartname_id INTEGER;
  v_corba_kategori INTEGER;
  v_ana_yemek_kategori INTEGER;
  v_pilav_kategori INTEGER;
BEGIN
  SELECT id INTO v_sartname_id FROM proje_sartnameleri WHERE kod = 'KYK-2024';
  SELECT id INTO v_corba_kategori FROM recete_kategoriler WHERE kod = 'corba';
  SELECT id INTO v_ana_yemek_kategori FROM recete_kategoriler WHERE kod = 'ana_yemek';
  SELECT id INTO v_pilav_kategori FROM recete_kategoriler WHERE kod = 'pilav_makarna';
  
  IF v_sartname_id IS NOT NULL THEN
    -- Çorba gramajları
    INSERT INTO sartname_gramajlari (sartname_id, kategori_id, yemek_turu, malzeme_adi, min_gramaj, max_gramaj, birim, zorunlu, sira) VALUES
      (v_sartname_id, v_corba_kategori, 'Mercimek Çorbası', 'Kırmızı Mercimek', 25, 30, 'g', true, 1),
      (v_sartname_id, v_corba_kategori, 'Mercimek Çorbası', 'Soğan', 10, 15, 'g', false, 2),
      (v_sartname_id, v_corba_kategori, 'Mercimek Çorbası', 'Un', 5, 8, 'g', false, 3),
      (v_sartname_id, v_corba_kategori, 'Mercimek Çorbası', 'Salça', 3, 5, 'g', false, 4),
      (v_sartname_id, v_corba_kategori, 'Ezogelin Çorbası', 'Kırmızı Mercimek', 20, 25, 'g', true, 1),
      (v_sartname_id, v_corba_kategori, 'Ezogelin Çorbası', 'Bulgur', 10, 15, 'g', true, 2),
      (v_sartname_id, v_corba_kategori, 'Ezogelin Çorbası', 'Pirinç', 5, 8, 'g', false, 3),
      (v_sartname_id, v_corba_kategori, 'Domates Çorbası', 'Domates', 80, 100, 'g', true, 1),
      (v_sartname_id, v_corba_kategori, 'Domates Çorbası', 'Un', 8, 12, 'g', false, 2),
      (v_sartname_id, v_corba_kategori, 'Yayla Çorbası', 'Yoğurt', 50, 60, 'g', true, 1),
      (v_sartname_id, v_corba_kategori, 'Yayla Çorbası', 'Pirinç', 15, 20, 'g', true, 2)
    ON CONFLICT DO NOTHING;
    
    -- Ana yemek gramajları
    INSERT INTO sartname_gramajlari (sartname_id, kategori_id, yemek_turu, malzeme_adi, min_gramaj, max_gramaj, birim, zorunlu, sira) VALUES
      (v_sartname_id, v_ana_yemek_kategori, 'Et Yemeği', 'Dana Eti', 80, 100, 'g', true, 1),
      (v_sartname_id, v_ana_yemek_kategori, 'Tavuk Yemeği', 'Tavuk (But/Göğüs)', 100, 120, 'g', true, 1),
      (v_sartname_id, v_ana_yemek_kategori, 'Köfte', 'Kıyma', 80, 100, 'g', true, 1),
      (v_sartname_id, v_ana_yemek_kategori, 'Köfte', 'Soğan', 15, 20, 'g', false, 2),
      (v_sartname_id, v_ana_yemek_kategori, 'Köfte', 'Ekmek İçi', 10, 15, 'g', false, 3),
      (v_sartname_id, v_ana_yemek_kategori, 'Balık', 'Balık', 150, 180, 'g', true, 1),
      (v_sartname_id, v_ana_yemek_kategori, 'Kuru Fasulye', 'Kuru Fasulye', 60, 80, 'g', true, 1),
      (v_sartname_id, v_ana_yemek_kategori, 'Nohut', 'Nohut', 60, 80, 'g', true, 1)
    ON CONFLICT DO NOTHING;
    
    -- Pilav gramajları
    INSERT INTO sartname_gramajlari (sartname_id, kategori_id, yemek_turu, malzeme_adi, min_gramaj, max_gramaj, birim, zorunlu, sira) VALUES
      (v_sartname_id, v_pilav_kategori, 'Pilav', 'Pirinç', 60, 80, 'g', true, 1),
      (v_sartname_id, v_pilav_kategori, 'Pilav', 'Tereyağı/Margarin', 8, 12, 'g', false, 2),
      (v_sartname_id, v_pilav_kategori, 'Bulgur Pilavı', 'Bulgur', 60, 80, 'g', true, 1),
      (v_sartname_id, v_pilav_kategori, 'Makarna', 'Makarna', 80, 100, 'g', true, 1)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_sartname_gramaj_sartname ON sartname_gramajlari(sartname_id);
CREATE INDEX IF NOT EXISTS idx_sartname_gramaj_kategori ON sartname_gramajlari(kategori_id);
CREATE INDEX IF NOT EXISTS idx_sartname_gramaj_yemek ON sartname_gramajlari(yemek_turu);
CREATE INDEX IF NOT EXISTS idx_proje_sartname_atama_proje ON proje_sartname_atamalari(proje_id);
CREATE INDEX IF NOT EXISTS idx_gramaj_kontrol_recete ON gramaj_kontrol_loglari(recete_id);

-- Updated_at trigger'ları
CREATE OR REPLACE FUNCTION update_sartname_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sartname_updated ON proje_sartnameleri;
CREATE TRIGGER trigger_sartname_updated
  BEFORE UPDATE ON proje_sartnameleri
  FOR EACH ROW EXECUTE FUNCTION update_sartname_updated_at();

DROP TRIGGER IF EXISTS trigger_gramaj_updated ON sartname_gramajlari;
CREATE TRIGGER trigger_gramaj_updated
  BEFORE UPDATE ON sartname_gramajlari
  FOR EACH ROW EXECUTE FUNCTION update_sartname_updated_at();

-- View: Proje şartname detayları
CREATE OR REPLACE VIEW proje_sartname_detay_view AS
SELECT 
  p.id as proje_id,
  p.ad as proje_adi,
  ps.id as sartname_id,
  ps.kod as sartname_kodu,
  ps.ad as sartname_adi,
  sk.ad as kurum,
  sk.ikon as kurum_ikon,
  ps.yil,
  psa.varsayilan,
  (SELECT COUNT(*) FROM sartname_gramajlari sg WHERE sg.sartname_id = ps.id AND sg.aktif = true) as gramaj_sayisi
FROM projeler p
LEFT JOIN proje_sartname_atamalari psa ON psa.proje_id = p.id
LEFT JOIN proje_sartnameleri ps ON ps.id = psa.sartname_id
LEFT JOIN sartname_kurumlari sk ON sk.id = ps.kurum_id
WHERE p.aktif = true;

-- View: Şartname gramaj detayları
CREATE OR REPLACE VIEW sartname_gramaj_detay_view AS
SELECT 
  sg.*,
  ps.kod as sartname_kodu,
  ps.ad as sartname_adi,
  rk.ad as kategori_adi,
  rk.ikon as kategori_ikon,
  sk.ad as stok_adi
FROM sartname_gramajlari sg
JOIN proje_sartnameleri ps ON ps.id = sg.sartname_id
LEFT JOIN recete_kategoriler rk ON rk.id = sg.kategori_id
LEFT JOIN stok_kartlari sk ON sk.id = sg.stok_kart_id
WHERE sg.aktif = true;

COMMENT ON TABLE proje_sartnameleri IS 'Catering projelerinin resmi gramaj şartnameleri';
COMMENT ON TABLE sartname_gramajlari IS 'Şartnamelerdeki malzeme gramaj tanımları';
COMMENT ON TABLE sartname_ogun_kurallari IS 'Şartnamelerdeki öğün bazlı kurallar (çeşit sayısı, kalori vs.)';

