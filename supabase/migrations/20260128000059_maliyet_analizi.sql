-- =============================================
-- MALİYET ANALİZİ MODÜLÜ
-- Tab bazlı menü şablonları ve maliyet karşılaştırma
-- =============================================

-- Menü kategorileri (tab'lar)
CREATE TABLE IF NOT EXISTS maliyet_kategoriler (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(50) UNIQUE NOT NULL,
    ad VARCHAR(100) NOT NULL,
    ikon VARCHAR(10),
    aciklama TEXT,
    renk VARCHAR(20),                   -- Mantine color: 'teal', 'orange', etc.
    sira INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan kategoriler
INSERT INTO maliyet_kategoriler (kod, ad, ikon, aciklama, renk, sira) VALUES
    ('ekonomik', 'Ekonomik', '💰', 'Bütçe dostu, temel malzemeler', 'teal', 1),
    ('dengeli', 'Dengeli', '⚖️', 'Orta maliyet, çeşitli protein', 'blue', 2),
    ('agir', 'Ağır', '🍖', 'Premium malzemeler, bol et', 'red', 3),
    ('kahvalti', 'Kahvaltı', '☀️', 'Sabah öğünleri', 'yellow', 4),
    ('diyet', 'Diyet', '🥗', 'Düşük kalorili menüler', 'lime', 5),
    ('vejetaryen', 'Vejetaryen', '🌱', 'Etsiz menüler', 'green', 6),
    ('glutensiz', 'Glütensiz', '🌾', 'Glüten içermeyen', 'grape', 7),
    ('ozel', 'Özel', '🎯', 'Kullanıcı tanımlı menüler', 'violet', 8)
ON CONFLICT (kod) DO NOTHING;

-- Ana menü şablonları tablosu
CREATE TABLE IF NOT EXISTS maliyet_menu_sablonlari (
    id SERIAL PRIMARY KEY,
    ad VARCHAR(200) NOT NULL,
    kategori_id INTEGER REFERENCES maliyet_kategoriler(id),
    aciklama TEXT,
    
    -- Kaynak bilgisi
    kaynak_tipi VARCHAR(20) DEFAULT 'manuel',  -- 'menu_plan', 'manuel'
    kaynak_proje_id INTEGER REFERENCES projeler(id) ON DELETE SET NULL,
    kaynak_menu_plan_id INTEGER REFERENCES menu_planlari(id) ON DELETE SET NULL,
    kaynak_ogun_ids INTEGER[],                  -- Hangi öğünlerden çekildi
    
    -- Hesaplama parametreleri
    kisi_sayisi INTEGER DEFAULT 1000,
    gun_sayisi INTEGER DEFAULT 1,
    ogun_tipi VARCHAR(50),                      -- 'kahvalti', 'ogle', 'aksam', 'tum_gun'
    
    -- Hesaplanan maliyetler (porsiyon başına)
    sistem_maliyet DECIMAL(15,2) DEFAULT 0,     -- Reçete maliyeti
    piyasa_maliyet DECIMAL(15,2) DEFAULT 0,     -- Piyasa fiyatıyla
    manuel_maliyet DECIMAL(15,2),               -- Manuel override
    
    -- Toplam maliyetler
    toplam_sistem_maliyet DECIMAL(15,2) DEFAULT 0,
    toplam_piyasa_maliyet DECIMAL(15,2) DEFAULT 0,
    
    -- Meta bilgiler
    etiketler TEXT[],                           -- ['düşük kalorili', 'protein ağırlıklı']
    kalori_toplam INTEGER,
    protein_toplam DECIMAL(10,2),
    
    son_hesaplama TIMESTAMP,
    aktif BOOLEAN DEFAULT TRUE,
    olusturan_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Şablondaki yemekler
CREATE TABLE IF NOT EXISTS maliyet_menu_yemekleri (
    id SERIAL PRIMARY KEY,
    sablon_id INTEGER NOT NULL REFERENCES maliyet_menu_sablonlari(id) ON DELETE CASCADE,
    
    -- Reçeteden gelen yemek
    recete_id INTEGER REFERENCES receteler(id) ON DELETE SET NULL,
    
    -- Veya manuel yemek (reçete yoksa)
    yemek_adi VARCHAR(200),
    
    -- Sıralama ve gruplama
    sira INTEGER DEFAULT 0,
    gun_no INTEGER DEFAULT 1,                   -- Çok günlük menülerde
    ogun VARCHAR(20),                           -- 'kahvalti', 'ogle', 'aksam'
    
    -- Hesaplanan maliyetler (porsiyon başına)
    sistem_maliyet DECIMAL(15,2) DEFAULT 0,
    piyasa_maliyet DECIMAL(15,2) DEFAULT 0,
    manuel_maliyet DECIMAL(15,2),               -- Override
    
    -- Besin değerleri
    kalori INTEGER,
    protein DECIMAL(10,2),
    
    notlar TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Manuel yemek malzemeleri (reçete olmadan eklenen yemekler için)
CREATE TABLE IF NOT EXISTS maliyet_yemek_malzemeleri (
    id SERIAL PRIMARY KEY,
    yemek_id INTEGER NOT NULL REFERENCES maliyet_menu_yemekleri(id) ON DELETE CASCADE,
    
    -- Malzeme bilgisi
    stok_kart_id INTEGER REFERENCES stok_kartlari(id) ON DELETE SET NULL,
    malzeme_adi VARCHAR(200) NOT NULL,
    miktar DECIMAL(15,4) NOT NULL,
    birim VARCHAR(20) NOT NULL,                 -- g, kg, ml, L, adet
    
    -- Fiyatlar
    sistem_fiyat DECIMAL(15,4),
    piyasa_fiyat DECIMAL(15,4),
    manuel_fiyat DECIMAL(15,4),
    
    sira INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_maliyet_sablon_kategori ON maliyet_menu_sablonlari(kategori_id);
CREATE INDEX IF NOT EXISTS idx_maliyet_sablon_aktif ON maliyet_menu_sablonlari(aktif);
CREATE INDEX IF NOT EXISTS idx_maliyet_sablon_kaynak ON maliyet_menu_sablonlari(kaynak_tipi);
CREATE INDEX IF NOT EXISTS idx_maliyet_yemek_sablon ON maliyet_menu_yemekleri(sablon_id);
CREATE INDEX IF NOT EXISTS idx_maliyet_yemek_recete ON maliyet_menu_yemekleri(recete_id);
CREATE INDEX IF NOT EXISTS idx_maliyet_malzeme_yemek ON maliyet_yemek_malzemeleri(yemek_id);

-- Güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_maliyet_sablon_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_maliyet_sablon_updated ON maliyet_menu_sablonlari;
CREATE TRIGGER trg_maliyet_sablon_updated
    BEFORE UPDATE ON maliyet_menu_sablonlari
    FOR EACH ROW
    EXECUTE FUNCTION update_maliyet_sablon_timestamp();

-- View: Şablon özet bilgileri
CREATE OR REPLACE VIEW v_maliyet_sablon_ozet AS
SELECT 
    ms.id,
    ms.ad,
    ms.kategori_id,
    mk.kod as kategori_kod,
    mk.ad as kategori_adi,
    mk.ikon as kategori_ikon,
    mk.renk as kategori_renk,
    ms.kaynak_tipi,
    ms.kisi_sayisi,
    ms.gun_sayisi,
    ms.ogun_tipi,
    ms.sistem_maliyet,
    ms.piyasa_maliyet,
    ms.manuel_maliyet,
    ms.toplam_sistem_maliyet,
    ms.toplam_piyasa_maliyet,
    ms.etiketler,
    ms.kalori_toplam,
    ms.son_hesaplama,
    ms.aktif,
    ms.created_at,
    ms.updated_at,
    p.ad as proje_adi,
    COUNT(my.id) as yemek_sayisi,
    -- Fark hesapla
    CASE 
        WHEN ms.sistem_maliyet > 0 THEN 
            ROUND(((ms.piyasa_maliyet - ms.sistem_maliyet) / ms.sistem_maliyet * 100)::numeric, 1)
        ELSE 0 
    END as fark_yuzde
FROM maliyet_menu_sablonlari ms
LEFT JOIN maliyet_kategoriler mk ON mk.id = ms.kategori_id
LEFT JOIN projeler p ON p.id = ms.kaynak_proje_id
LEFT JOIN maliyet_menu_yemekleri my ON my.sablon_id = ms.id
WHERE ms.aktif = true
GROUP BY ms.id, mk.kod, mk.ad, mk.ikon, mk.renk, p.ad;

-- Yorumlar
COMMENT ON TABLE maliyet_kategoriler IS 'Maliyet analizi tab kategorileri (ekonomik, dengeli, diyet vb.)';
COMMENT ON TABLE maliyet_menu_sablonlari IS 'Maliyet karşılaştırma için menü şablonları';
COMMENT ON TABLE maliyet_menu_yemekleri IS 'Şablondaki yemekler (reçeteden veya manuel)';
COMMENT ON TABLE maliyet_yemek_malzemeleri IS 'Manuel eklenen yemeklerin malzemeleri';

