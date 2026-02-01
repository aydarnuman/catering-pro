-- =============================================
-- REÇETE VE MENÜ PLANLAMA SİSTEMİ
-- =============================================

-- =============================================
-- BÖLÜM 1: REÇETE SİSTEMİ
-- =============================================

-- Reçete kategorileri
CREATE TABLE IF NOT EXISTS recete_kategoriler (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(50) UNIQUE NOT NULL,
    ad VARCHAR(100) NOT NULL,
    ikon VARCHAR(10),                       -- Emoji: 🥣, 🍖, 🥗
    sira INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan kategoriler
INSERT INTO recete_kategoriler (kod, ad, ikon, sira) VALUES
    ('corba', 'Çorba', '🥣', 1),
    ('ana_yemek', 'Ana Yemek', '🍖', 2),
    ('pilav_makarna', 'Pilav / Makarna', '🍚', 3),
    ('salata_meze', 'Salata / Meze', '🥗', 4),
    ('tatli', 'Tatlı', '🍮', 5),
    ('icecek', 'İçecek', '🥤', 6),
    ('kahvaltilik', 'Kahvaltılık', '🥐', 7),
    ('kahvalti_paketi', 'Kahvaltı Paketi', '☀️', 8)
ON CONFLICT (kod) DO NOTHING;

-- Ana reçete tablosu
CREATE TABLE IF NOT EXISTS receteler (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(50) UNIQUE NOT NULL,        -- "MERC-CORBA", "TAVUK-PILAV"
    ad VARCHAR(200) NOT NULL,               -- "Mercimek Çorbası"
    kategori_id INTEGER REFERENCES recete_kategoriler(id),
    
    -- Porsiyon bilgisi
    porsiyon_miktar DECIMAL(10,2) DEFAULT 1,    -- Kaç kişilik (1 = 1 porsiyon)
    porsiyon_birim VARCHAR(20) DEFAULT 'porsiyon',
    
    -- Hazırlık bilgileri
    hazirlik_suresi INTEGER,                -- dakika
    pisirme_suresi INTEGER,                 -- dakika
    
    -- Besin değerleri (1 porsiyon için)
    kalori DECIMAL(10,2),                   -- kcal
    protein DECIMAL(10,2),                  -- gram
    karbonhidrat DECIMAL(10,2),             -- gram
    yag DECIMAL(10,2),                      -- gram
    lif DECIMAL(10,2),                      -- gram
    
    -- Maliyet (otomatik hesaplanır)
    tahmini_maliyet DECIMAL(15,2),          -- Piyasa fiyatıyla hesaplanan
    son_hesaplama_tarihi TIMESTAMP,
    
    -- Diğer
    aciklama TEXT,
    tarif TEXT,                             -- Yapılış tarifi
    resim_url VARCHAR(500),
    ai_olusturuldu BOOLEAN DEFAULT FALSE,   -- AI tarafından mı oluşturuldu
    
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Reçete malzemeleri
CREATE TABLE IF NOT EXISTS recete_malzemeler (
    id SERIAL PRIMARY KEY,
    recete_id INTEGER NOT NULL REFERENCES receteler(id) ON DELETE CASCADE,
    stok_kart_id INTEGER REFERENCES stok_kartlari(id) ON DELETE SET NULL,
    
    -- Malzeme bilgisi
    malzeme_adi VARCHAR(200),               -- Stok kartı yoksa manuel ad
    miktar DECIMAL(15,4) NOT NULL,          -- 100 (gram için)
    birim VARCHAR(20) NOT NULL,             -- g, kg, ml, L, adet
    
    -- Fiyat bilgisi (son hesaplama)
    birim_fiyat DECIMAL(15,4),              -- Piyasa/sistem fiyatı
    toplam_fiyat DECIMAL(15,4),             -- miktar × birim_fiyat
    fiyat_kaynagi VARCHAR(20),              -- 'piyasa', 'sistem', 'manuel'
    
    -- Opsiyonlar
    zorunlu BOOLEAN DEFAULT TRUE,           -- Olmazsa olmaz mı?
    alternatif_stok_kart_id INTEGER REFERENCES stok_kartlari(id),
    
    -- Besin değerleri (bu malzeme için)
    kalori DECIMAL(10,2),
    protein DECIMAL(10,2),
    karbonhidrat DECIMAL(10,2),
    yag DECIMAL(10,2),
    
    aciklama VARCHAR(500),
    sira INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(recete_id, stok_kart_id)
);

-- =============================================
-- BÖLÜM 2: PROJE ÖĞÜN ŞABLONLARI
-- =============================================

-- Öğün tipleri
CREATE TABLE IF NOT EXISTS ogun_tipleri (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(50) UNIQUE NOT NULL,
    ad VARCHAR(100) NOT NULL,
    ikon VARCHAR(10),
    varsayilan_sira INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT TRUE
);

INSERT INTO ogun_tipleri (kod, ad, ikon, varsayilan_sira) VALUES
    ('kahvalti', 'Kahvaltı', '☀️', 1),
    ('ogle', 'Öğle Yemeği', '🌞', 2),
    ('aksam', 'Akşam Yemeği', '🌙', 3),
    ('ara_ogun', 'Ara Öğün', '🍎', 4),
    ('gece', 'Gece Kahvaltısı', '🌃', 5)
ON CONFLICT (kod) DO NOTHING;

-- Proje bazlı öğün şablonları
CREATE TABLE IF NOT EXISTS proje_ogun_sablonlari (
    id SERIAL PRIMARY KEY,
    proje_id INTEGER NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
    ogun_tipi_id INTEGER REFERENCES ogun_tipleri(id),
    
    -- Öğün ayarları
    ogun_adi VARCHAR(100),                  -- Özel ad (opsiyonel)
    cesit_sayisi INTEGER DEFAULT 4,         -- Kaç çeşit yemek
    kisi_sayisi INTEGER DEFAULT 1000,       -- Varsayılan kişi sayısı
    tip VARCHAR(50) DEFAULT 'tabldot',      -- tabldot, acik_bufe, paket
    
    aktif BOOLEAN DEFAULT TRUE,
    sira INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(proje_id, ogun_tipi_id)
);

-- =============================================
-- BÖLÜM 3: MENÜ PLANLAMA
-- =============================================

-- Ana menü planı
CREATE TABLE IF NOT EXISTS menu_planlari (
    id SERIAL PRIMARY KEY,
    proje_id INTEGER NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
    
    ad VARCHAR(200) NOT NULL,               -- "Ocak 2026 Menüsü"
    tip VARCHAR(20) DEFAULT 'aylik',        -- gunluk, haftalik, aylik
    
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi DATE NOT NULL,
    
    -- Varsayılan kişi sayısı (öğün bazında override edilebilir)
    varsayilan_kisi_sayisi INTEGER DEFAULT 1000,
    
    -- Toplam maliyet (otomatik hesaplanır)
    toplam_maliyet DECIMAL(15,2),
    gunluk_ortalama_maliyet DECIMAL(15,2),
    porsiyon_ortalama_maliyet DECIMAL(15,2),
    
    durum VARCHAR(20) DEFAULT 'taslak',     -- taslak, onaylandi, aktif, tamamlandi
    notlar TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Menü planındaki öğünler (her gün için)
CREATE TABLE IF NOT EXISTS menu_plan_ogunleri (
    id SERIAL PRIMARY KEY,
    menu_plan_id INTEGER NOT NULL REFERENCES menu_planlari(id) ON DELETE CASCADE,
    
    tarih DATE NOT NULL,
    ogun_tipi_id INTEGER REFERENCES ogun_tipleri(id),
    
    -- Kişi sayısı (override)
    kisi_sayisi INTEGER,                    -- NULL ise plan varsayılanı kullanılır
    
    -- Maliyet (otomatik hesaplanır)
    toplam_maliyet DECIMAL(15,2),
    porsiyon_maliyet DECIMAL(15,2),
    
    notlar VARCHAR(500),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(menu_plan_id, tarih, ogun_tipi_id)
);

-- Öğündeki yemekler
CREATE TABLE IF NOT EXISTS menu_ogun_yemekleri (
    id SERIAL PRIMARY KEY,
    menu_ogun_id INTEGER NOT NULL REFERENCES menu_plan_ogunleri(id) ON DELETE CASCADE,
    recete_id INTEGER NOT NULL REFERENCES receteler(id),
    
    sira INTEGER DEFAULT 0,                 -- Sıralama (1: çorba, 2: ana yemek...)
    
    -- Porsiyon bazlı maliyet
    porsiyon_maliyet DECIMAL(15,2),         -- Reçeteden alınan
    toplam_maliyet DECIMAL(15,2),           -- porsiyon_maliyet × kisi_sayisi
    
    notlar VARCHAR(500),
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(menu_ogun_id, recete_id)
);

-- =============================================
-- İNDEKSLER
-- =============================================

CREATE INDEX IF NOT EXISTS idx_receteler_kategori ON receteler(kategori_id);
CREATE INDEX IF NOT EXISTS idx_receteler_aktif ON receteler(aktif);
CREATE INDEX IF NOT EXISTS idx_receteler_kod ON receteler(kod);

CREATE INDEX IF NOT EXISTS idx_recete_malz_recete ON recete_malzemeler(recete_id);
CREATE INDEX IF NOT EXISTS idx_recete_malz_stok ON recete_malzemeler(stok_kart_id);

CREATE INDEX IF NOT EXISTS idx_proje_ogun_proje ON proje_ogun_sablonlari(proje_id);

CREATE INDEX IF NOT EXISTS idx_menu_plan_proje ON menu_planlari(proje_id);
CREATE INDEX IF NOT EXISTS idx_menu_plan_tarih ON menu_planlari(baslangic_tarihi, bitis_tarihi);
CREATE INDEX IF NOT EXISTS idx_menu_plan_durum ON menu_planlari(durum);

CREATE INDEX IF NOT EXISTS idx_menu_ogun_plan ON menu_plan_ogunleri(menu_plan_id);
CREATE INDEX IF NOT EXISTS idx_menu_ogun_tarih ON menu_plan_ogunleri(tarih);

CREATE INDEX IF NOT EXISTS idx_menu_yemek_ogun ON menu_ogun_yemekleri(menu_ogun_id);

-- =============================================
-- TRİGGER'LAR
-- =============================================

-- Reçete güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_recete_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recete_updated ON receteler;
CREATE TRIGGER trg_recete_updated
    BEFORE UPDATE ON receteler
    FOR EACH ROW
    EXECUTE FUNCTION update_recete_timestamp();

DROP TRIGGER IF EXISTS trg_recete_malz_updated ON recete_malzemeler;
CREATE TRIGGER trg_recete_malz_updated
    BEFORE UPDATE ON recete_malzemeler
    FOR EACH ROW
    EXECUTE FUNCTION update_recete_timestamp();

DROP TRIGGER IF EXISTS trg_menu_plan_updated ON menu_planlari;
CREATE TRIGGER trg_menu_plan_updated
    BEFORE UPDATE ON menu_planlari
    FOR EACH ROW
    EXECUTE FUNCTION update_recete_timestamp();

-- =============================================
-- VIEW'LAR
-- =============================================

-- Reçete özet görünümü
CREATE OR REPLACE VIEW v_recete_ozet AS
SELECT 
    r.id,
    r.kod,
    r.ad,
    r.kategori_id,
    rk.ad as kategori_adi,
    rk.ikon as kategori_ikon,
    r.porsiyon_miktar,
    r.hazirlik_suresi,
    r.pisirme_suresi,
    r.kalori,
    r.tahmini_maliyet,
    r.aktif,
    r.ai_olusturuldu,
    COUNT(rm.id) as malzeme_sayisi,
    COALESCE(SUM(rm.toplam_fiyat), 0) as hesaplanan_maliyet
FROM receteler r
LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
LEFT JOIN recete_malzemeler rm ON rm.recete_id = r.id
GROUP BY r.id, rk.ad, rk.ikon;

-- Menü plan özet görünümü
CREATE OR REPLACE VIEW v_menu_plan_ozet AS
SELECT 
    mp.id,
    mp.ad,
    mp.proje_id,
    p.ad as proje_adi,
    mp.tip,
    mp.baslangic_tarihi,
    mp.bitis_tarihi,
    mp.varsayilan_kisi_sayisi,
    mp.toplam_maliyet,
    mp.durum,
    COUNT(DISTINCT mpo.id) as ogun_sayisi,
    COUNT(DISTINCT mpo.tarih) as gun_sayisi
FROM menu_planlari mp
LEFT JOIN projeler p ON p.id = mp.proje_id
LEFT JOIN menu_plan_ogunleri mpo ON mpo.menu_plan_id = mp.id
GROUP BY mp.id, p.ad;

-- =============================================
-- ÖRNEK VERİLER
-- =============================================

-- Örnek reçete: Mercimek Çorbası
INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, hazirlik_suresi, pisirme_suresi, kalori, protein, karbonhidrat, yag, tarif)
SELECT 
    'MERC-CORBA',
    'Mercimek Çorbası',
    (SELECT id FROM recete_kategoriler WHERE kod = 'corba'),
    1,
    10,
    30,
    180,
    12,
    28,
    4,
    '1. Mercimeği yıkayın. 2. Soğan ve havucu doğrayın. 3. Tüm malzemeleri tencereye alıp pişirin. 4. Blenderdan geçirin.'
WHERE NOT EXISTS (SELECT 1 FROM receteler WHERE kod = 'MERC-CORBA');

-- Mercimek çorbası malzemeleri
INSERT INTO recete_malzemeler (recete_id, malzeme_adi, miktar, birim, sira)
SELECT 
    (SELECT id FROM receteler WHERE kod = 'MERC-CORBA'),
    malzeme,
    miktar,
    birim,
    sira
FROM (VALUES
    ('Kırmızı Mercimek', 80, 'g', 1),
    ('Soğan', 30, 'g', 2),
    ('Havuç', 20, 'g', 3),
    ('Domates Salçası', 10, 'g', 4),
    ('Tereyağı', 10, 'g', 5),
    ('Un', 5, 'g', 6),
    ('Tuz', 3, 'g', 7),
    ('Karabiber', 1, 'g', 8),
    ('Su', 300, 'ml', 9)
) AS t(malzeme, miktar, birim, sira)
WHERE NOT EXISTS (SELECT 1 FROM recete_malzemeler WHERE recete_id = (SELECT id FROM receteler WHERE kod = 'MERC-CORBA'));

-- Örnek reçete: Tavuklu Pilav
INSERT INTO receteler (kod, ad, kategori_id, porsiyon_miktar, hazirlik_suresi, pisirme_suresi, kalori, protein, karbonhidrat, yag, tarif)
SELECT 
    'TAVUK-PILAV',
    'Tavuklu Pilav',
    (SELECT id FROM recete_kategoriler WHERE kod = 'ana_yemek'),
    1,
    15,
    40,
    450,
    35,
    45,
    12,
    '1. Tavuğu haşlayın ve didikleyin. 2. Pirinci yıkayıp suyunu süzün. 3. Tereyağında kavurun. 4. Tavuk suyunu ekleyip pişirin.'
WHERE NOT EXISTS (SELECT 1 FROM receteler WHERE kod = 'TAVUK-PILAV');

-- Tavuklu pilav malzemeleri
INSERT INTO recete_malzemeler (recete_id, malzeme_adi, miktar, birim, sira)
SELECT 
    (SELECT id FROM receteler WHERE kod = 'TAVUK-PILAV'),
    malzeme,
    miktar,
    birim,
    sira
FROM (VALUES
    ('Baldo Pirinç', 100, 'g', 1),
    ('Tavuk But', 150, 'g', 2),
    ('Tereyağı', 20, 'g', 3),
    ('Tavuk Suyu', 200, 'ml', 4),
    ('Tuz', 3, 'g', 5),
    ('Karabiber', 1, 'g', 6)
) AS t(malzeme, miktar, birim, sira)
WHERE NOT EXISTS (SELECT 1 FROM recete_malzemeler WHERE recete_id = (SELECT id FROM receteler WHERE kod = 'TAVUK-PILAV'));

-- =============================================
-- YORUMLAR
-- =============================================

COMMENT ON TABLE receteler IS 'Yemek reçeteleri - tüm yemek tanımları';
COMMENT ON TABLE recete_malzemeler IS 'Reçete malzemeleri - stok kartlarına bağlı';
COMMENT ON TABLE proje_ogun_sablonlari IS 'Proje bazlı öğün şablonları (kahvaltı, öğle, akşam)';
COMMENT ON TABLE menu_planlari IS 'Menü planları - haftalık/aylık planlar';
COMMENT ON TABLE menu_plan_ogunleri IS 'Plandaki öğünler (her gün için)';
COMMENT ON TABLE menu_ogun_yemekleri IS 'Öğündeki yemekler (reçetelere bağlı)';

