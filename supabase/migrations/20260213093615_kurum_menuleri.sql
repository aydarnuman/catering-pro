-- ═══════════════════════════════════════════════════════════
-- KURUM MENÜLERİ — Kurum tipine göre hazır menü şablonları
-- İhale maliyet hesabında kullanılmak üzere
-- ═══════════════════════════════════════════════════════════

-- 1. Kurum tipleri (lookup)
CREATE TABLE IF NOT EXISTS kurum_tipleri (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(50) UNIQUE NOT NULL,   -- kyk, hastane, askeri, okul, ozel_sektor, belediye
  ad VARCHAR(100) NOT NULL,
  ikon VARCHAR(10),
  aciklama TEXT,
  sira INT DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed kurum tipleri
INSERT INTO kurum_tipleri (kod, ad, ikon, aciklama, sira) VALUES
  ('kyk', 'KYK Yurdu', '🏫', 'Kredi Yurtlar Kurumu öğrenci yurtları', 1),
  ('hastane', 'Hastane', '🏥', 'Kamu ve özel hastaneler', 2),
  ('askeri', 'Askeri Birlik', '🎖️', 'TSK birlikleri ve karargahlar', 3),
  ('okul', 'Okul / Üniversite', '📚', 'İlk-orta-lise ve üniversite yemekhaneleri', 4),
  ('belediye', 'Belediye', '🏛️', 'Belediye aşevleri ve sosyal tesisler', 5),
  ('ozel_sektor', 'Özel Sektör', '🏢', 'Fabrika, ofis, şantiye yemekhaneleri', 6),
  ('huzurevi', 'Huzurevi / Bakım', '🏠', 'Huzurevleri ve bakım merkezleri', 7),
  ('cezaevi', 'Ceza İnfaz Kurumu', '🔒', 'Cezaevleri ve tutukevleri', 8)
ON CONFLICT (kod) DO NOTHING;


-- 2. Maliyet seviyesi (lookup)
CREATE TABLE IF NOT EXISTS maliyet_seviyeleri (
  id SERIAL PRIMARY KEY,
  kod VARCHAR(30) UNIQUE NOT NULL,   -- ekonomik, standart, premium
  ad VARCHAR(50) NOT NULL,
  renk VARCHAR(20),
  aciklama TEXT,
  sira INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO maliyet_seviyeleri (kod, ad, renk, aciklama, sira) VALUES
  ('ekonomik', 'Ekonomik', 'orange', 'Minimum bütçe, temel beslenme', 1),
  ('standart', 'Standart', 'blue', 'Orta bütçe, dengeli menü', 2),
  ('premium', 'Premium', 'green', 'Yüksek bütçe, zengin çeşitlilik', 3)
ON CONFLICT (kod) DO NOTHING;


-- 3. Ana tablo: Kurum Menüleri
CREATE TABLE IF NOT EXISTS kurum_menuleri (
  id SERIAL PRIMARY KEY,
  ad VARCHAR(200) NOT NULL,                       -- "KYK Standart 15 Günlük Menü"
  kurum_tipi_id INT REFERENCES kurum_tipleri(id),
  maliyet_seviyesi_id INT REFERENCES maliyet_seviyeleri(id),
  
  -- Plan bilgileri
  gun_sayisi INT NOT NULL DEFAULT 15,             -- 7, 15, 30
  ogun_yapisi VARCHAR(50) DEFAULT '3_ogun',       -- 2_ogun, 3_ogun, 3_ogun_ara
  kisi_sayisi INT DEFAULT 500,                    -- Referans kişi sayısı
  
  -- Hesaplanan maliyetler
  porsiyon_maliyet NUMERIC(10,2) DEFAULT 0,       -- Tek kişi tek öğün ortalama
  gunluk_maliyet NUMERIC(10,2) DEFAULT 0,         -- Tek kişi günlük ortalama
  toplam_maliyet NUMERIC(10,2) DEFAULT 0,         -- Tüm menü toplam (1 kişi x tüm günler)
  
  -- Meta
  aciklama TEXT,
  notlar TEXT,
  etiketler TEXT[] DEFAULT '{}',                  -- ['diyet', 'helal', 'vejetaryen']
  durum VARCHAR(20) DEFAULT 'taslak',             -- taslak, aktif, arsiv
  favori BOOLEAN DEFAULT false,
  kullanim_sayisi INT DEFAULT 0,
  
  olusturan_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kurum_menuleri_kurum ON kurum_menuleri(kurum_tipi_id);
CREATE INDEX IF NOT EXISTS idx_kurum_menuleri_maliyet ON kurum_menuleri(maliyet_seviyesi_id);
CREATE INDEX IF NOT EXISTS idx_kurum_menuleri_durum ON kurum_menuleri(durum);


-- 4. Menü günleri (hangi gün hangi öğünde hangi yemekler)
CREATE TABLE IF NOT EXISTS kurum_menu_gunleri (
  id SERIAL PRIMARY KEY,
  kurum_menu_id INT NOT NULL REFERENCES kurum_menuleri(id) ON DELETE CASCADE,
  gun_no INT NOT NULL,                            -- 1..30 (gün sırası)
  ogun_tipi_id INT NOT NULL REFERENCES ogun_tipleri(id),
  
  -- Hesaplanan
  porsiyon_maliyet NUMERIC(10,2) DEFAULT 0,
  
  notlar VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(kurum_menu_id, gun_no, ogun_tipi_id)
);

CREATE INDEX IF NOT EXISTS idx_kurum_menu_gunleri_menu ON kurum_menu_gunleri(kurum_menu_id);


-- 5. Menü yemekleri (her öğündeki reçeteler)
CREATE TABLE IF NOT EXISTS kurum_menu_yemekleri (
  id SERIAL PRIMARY KEY,
  kurum_menu_gun_id INT NOT NULL REFERENCES kurum_menu_gunleri(id) ON DELETE CASCADE,
  recete_id INT REFERENCES receteler(id) ON DELETE SET NULL,
  
  -- Recete yoksa serbest yemek adı
  yemek_adi VARCHAR(200) NOT NULL,
  sira INT DEFAULT 0,
  
  -- Maliyet (reçeteden veya manuel)
  porsiyon_maliyet NUMERIC(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kurum_menu_yemekleri_gun ON kurum_menu_yemekleri(kurum_menu_gun_id);
CREATE INDEX IF NOT EXISTS idx_kurum_menu_yemekleri_recete ON kurum_menu_yemekleri(recete_id);


-- 6. View: Kurum menü özeti
CREATE OR REPLACE VIEW v_kurum_menu_ozet AS
SELECT
  km.id,
  km.ad,
  km.gun_sayisi,
  km.ogun_yapisi,
  km.kisi_sayisi,
  km.porsiyon_maliyet,
  km.gunluk_maliyet,
  km.toplam_maliyet,
  km.durum,
  km.favori,
  km.kullanim_sayisi,
  km.etiketler,
  km.created_at,
  km.updated_at,
  kt.kod AS kurum_tipi_kod,
  kt.ad AS kurum_tipi_ad,
  kt.ikon AS kurum_tipi_ikon,
  ms.kod AS maliyet_seviyesi_kod,
  ms.ad AS maliyet_seviyesi_ad,
  ms.renk AS maliyet_seviyesi_renk,
  (SELECT COUNT(*) FROM kurum_menu_gunleri g WHERE g.kurum_menu_id = km.id) AS ogun_sayisi,
  (SELECT COUNT(*) FROM kurum_menu_yemekleri y 
   JOIN kurum_menu_gunleri g ON g.id = y.kurum_menu_gun_id 
   WHERE g.kurum_menu_id = km.id) AS yemek_sayisi
FROM kurum_menuleri km
LEFT JOIN kurum_tipleri kt ON kt.id = km.kurum_tipi_id
LEFT JOIN maliyet_seviyeleri ms ON ms.id = km.maliyet_seviyesi_id;


-- RLS
ALTER TABLE kurum_tipleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE maliyet_seviyeleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE kurum_menuleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE kurum_menu_gunleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE kurum_menu_yemekleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kurum_tipleri_read" ON kurum_tipleri FOR SELECT USING (true);
CREATE POLICY "maliyet_seviyeleri_read" ON maliyet_seviyeleri FOR SELECT USING (true);
CREATE POLICY "kurum_menuleri_all" ON kurum_menuleri FOR ALL USING (true);
CREATE POLICY "kurum_menu_gunleri_all" ON kurum_menu_gunleri FOR ALL USING (true);
CREATE POLICY "kurum_menu_yemekleri_all" ON kurum_menu_yemekleri FOR ALL USING (true);
