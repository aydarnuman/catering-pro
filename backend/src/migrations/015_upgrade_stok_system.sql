-- =============================================
-- MEVCUT STOK SİSTEMİNİ YÜKSELT
-- =============================================

-- Önce mevcut tabloları yedekle
ALTER TABLE IF EXISTS stok_kartlari RENAME TO stok_kartlari_old;
ALTER TABLE IF EXISTS stok_hareketleri RENAME TO stok_hareketleri_old;
DROP VIEW IF EXISTS kritik_stoklar;

-- =============================================
-- 1. BİRİMLER TABLOSU (Kg, Lt, Adet vb.)
-- =============================================
CREATE TABLE IF NOT EXISTS birimler (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(10) UNIQUE NOT NULL,
    ad VARCHAR(50) NOT NULL,
    kisa_ad VARCHAR(10),
    tip VARCHAR(20) DEFAULT 'genel', -- ağırlık, hacim, adet
    donusum_katsayi DECIMAL(10,4) DEFAULT 1, -- ana birime dönüşüm
    ana_birim_id INTEGER REFERENCES birimler(id),
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Temel birimler
INSERT INTO birimler (kod, ad, kisa_ad, tip) VALUES 
    ('KG', 'Kilogram', 'Kg', 'ağırlık'),
    ('GR', 'Gram', 'Gr', 'ağırlık'),
    ('TON', 'Ton', 'Ton', 'ağırlık'),
    ('LT', 'Litre', 'Lt', 'hacim'),
    ('ML', 'Mililitre', 'Ml', 'hacim'),
    ('M3', 'Metreküp', 'M³', 'hacim'),
    ('ADET', 'Adet', 'Ad', 'sayı'),
    ('PAKET', 'Paket', 'Pkt', 'sayı'),
    ('KUTU', 'Kutu', 'Kt', 'sayı'),
    ('KOLİ', 'Koli', 'Koli', 'sayı'),
    ('DESTE', 'Deste', 'Dst', 'sayı'),
    ('DUZINE', 'Düzine', 'Dz', 'sayı'),
    ('PORSIYON', 'Porsiyon', 'Prs', 'sayı'),
    ('METRE', 'Metre', 'M', 'uzunluk'),
    ('CM', 'Santimetre', 'Cm', 'uzunluk'),
    ('M2', 'Metrekare', 'M²', 'alan')
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- 2. DEPOLAR (Merkez, Mutfak, Soğuk Hava vb.)
-- =============================================
CREATE TABLE IF NOT EXISTS depolar (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(20) UNIQUE NOT NULL,
    ad VARCHAR(100) NOT NULL,
    tip VARCHAR(30) DEFAULT 'genel', -- genel, soğuk, kuru, tehlikeli
    lokasyon VARCHAR(200),
    adres TEXT,
    sorumlu_kisi VARCHAR(100),
    telefon VARCHAR(20),
    email VARCHAR(100),
    kapasite_m3 DECIMAL(10,2),
    sicaklik_min DECIMAL(5,2), -- soğuk depolar için
    sicaklik_max DECIMAL(5,2),
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan depolar
INSERT INTO depolar (kod, ad, tip, lokasyon) VALUES 
    ('MERKEZ', 'Merkez Depo', 'genel', 'Ana Bina - Zemin Kat'),
    ('MUTFAK', 'Mutfak Deposu', 'genel', 'Mutfak Bölümü'),
    ('SOGUK1', 'Soğuk Hava Deposu 1', 'soğuk', 'Bodrum Kat - Soğuk Oda'),
    ('SOGUK2', 'Dondurulmuş Ürün Deposu', 'soğuk', 'Bodrum Kat - Dondurucu'),
    ('KURU', 'Kuru Gıda Deposu', 'kuru', 'Depo Binası')
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- 3. STOK KATEGORİLERİ (Ağaç yapısında)
-- =============================================
CREATE TABLE IF NOT EXISTS stok_kategoriler (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(20) UNIQUE NOT NULL,
    ad VARCHAR(100) NOT NULL,
    ust_kategori_id INTEGER REFERENCES stok_kategoriler(id),
    seviye INTEGER DEFAULT 1,
    renk VARCHAR(7), -- #FF5733 gibi hex renk
    ikon VARCHAR(50),
    sira_no INTEGER DEFAULT 999,
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ana kategoriler ve alt kategoriler
INSERT INTO stok_kategoriler (kod, ad, seviye, renk, sira_no) VALUES 
    ('GIDA', 'Gıda Malzemeleri', 1, '#4CAF50', 1),
    ('ICECEK', 'İçecekler', 1, '#2196F3', 2),
    ('TEMIZLIK', 'Temizlik Malzemeleri', 1, '#9C27B0', 3),
    ('AMBALAJ', 'Ambalaj Malzemeleri', 1, '#FF9800', 4),
    ('EKIPMAN', 'Mutfak Ekipmanları', 1, '#795548', 5),
    ('KIRTASIYE', 'Kırtasiye Malzemeleri', 1, '#607D8B', 6)
ON CONFLICT (kod) DO NOTHING;

-- Alt kategoriler
INSERT INTO stok_kategoriler (kod, ad, ust_kategori_id, seviye, sira_no)
SELECT 'GIDA_ET', 'Et ve Et Ürünleri', id, 2, 1 FROM stok_kategoriler WHERE kod = 'GIDA'
ON CONFLICT (kod) DO NOTHING;

INSERT INTO stok_kategoriler (kod, ad, ust_kategori_id, seviye, sira_no)
SELECT 'GIDA_SEBZE', 'Sebze ve Meyveler', id, 2, 2 FROM stok_kategoriler WHERE kod = 'GIDA'
ON CONFLICT (kod) DO NOTHING;

INSERT INTO stok_kategoriler (kod, ad, ust_kategori_id, seviye, sira_no)
SELECT 'GIDA_SARKUTERI', 'Şarküteri Ürünleri', id, 2, 3 FROM stok_kategoriler WHERE kod = 'GIDA'
ON CONFLICT (kod) DO NOTHING;

INSERT INTO stok_kategoriler (kod, ad, ust_kategori_id, seviye, sira_no)
SELECT 'GIDA_KURU', 'Kuru Gıda', id, 2, 4 FROM stok_kategoriler WHERE kod = 'GIDA'
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- 4. YENİ STOK KARTLARI
-- =============================================
CREATE TABLE IF NOT EXISTS stok_kartlari_new (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(50) UNIQUE NOT NULL,
    barkod VARCHAR(50) UNIQUE,
    ad VARCHAR(200) NOT NULL,
    kisa_ad VARCHAR(100),
    
    -- Kategori ve Birim (Foreign Key)
    kategori_id INTEGER REFERENCES stok_kategoriler(id),
    ana_birim_id INTEGER REFERENCES birimler(id) NOT NULL,
    alt_birim_id INTEGER REFERENCES birimler(id),
    birim_donusum DECIMAL(10,4) DEFAULT 1, -- 1 ana birim = X alt birim
    
    -- Stok Takip Yöntemi
    takip_yontemi VARCHAR(20) DEFAULT 'miktar', -- miktar, seri, lot
    
    -- Stok Miktarları (Toplam)
    toplam_stok DECIMAL(15,3) DEFAULT 0,
    rezerve_stok DECIMAL(15,3) DEFAULT 0,
    kullanilabilir_stok DECIMAL(15,3) GENERATED ALWAYS AS (toplam_stok - rezerve_stok) STORED,
    
    -- Stok Limitleri
    min_stok DECIMAL(15,3) DEFAULT 0,
    max_stok DECIMAL(15,3) DEFAULT 99999,
    kritik_stok DECIMAL(15,3) DEFAULT 0,
    optimum_stok DECIMAL(15,3) DEFAULT 0,
    siparis_noktasi DECIMAL(15,3) DEFAULT 0,
    siparis_miktari DECIMAL(15,3) DEFAULT 0,
    
    -- Fiyat Bilgileri
    son_alis_fiyat DECIMAL(15,2) DEFAULT 0,
    ortalama_maliyet DECIMAL(15,2) DEFAULT 0,
    standart_maliyet DECIMAL(15,2) DEFAULT 0,
    satis_fiyat1 DECIMAL(15,2) DEFAULT 0,
    satis_fiyat2 DECIMAL(15,2) DEFAULT 0,
    satis_fiyat3 DECIMAL(15,2) DEFAULT 0,
    
    -- Tedarik Bilgileri
    varsayilan_tedarikci_id INTEGER REFERENCES cariler(id),
    alternatif_tedarikci1_id INTEGER REFERENCES cariler(id),
    alternatif_tedarikci2_id INTEGER REFERENCES cariler(id),
    tedarik_suresi INTEGER DEFAULT 1, -- gün
    son_alis_tarihi DATE,
    
    -- Raf Ömrü
    raf_omru_var BOOLEAN DEFAULT FALSE,
    raf_omru_gun INTEGER,
    
    -- KDV ve Muhasebe
    kdv_orani DECIMAL(5,2) DEFAULT 18,
    kdv_dahil BOOLEAN DEFAULT FALSE,
    muhasebe_kodu VARCHAR(50),
    
    -- Ek Bilgiler
    marka VARCHAR(100),
    model VARCHAR(100),
    uretici VARCHAR(200),
    mensei VARCHAR(100), -- Türkiye, İtalya vb.
    ozel_kod1 VARCHAR(50),
    ozel_kod2 VARCHAR(50),
    ozel_kod3 VARCHAR(50),
    aciklama TEXT,
    resim_url TEXT,
    teknik_ozellik TEXT,
    
    -- Durum
    aktif BOOLEAN DEFAULT TRUE,
    satin_alinabilir BOOLEAN DEFAULT TRUE,
    satilebilir BOOLEAN DEFAULT TRUE,
    uretilebilir BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(100)
);

-- =============================================
-- 5. STOK-DEPO DURUMLARI (Hangi üründen hangi depoda ne kadar var)
-- =============================================
CREATE TABLE IF NOT EXISTS stok_depo_durumlari (
    id SERIAL PRIMARY KEY,
    stok_kart_id INTEGER NOT NULL, -- stok_kartlari_new referansı sonra eklenecek
    depo_id INTEGER REFERENCES depolar(id) NOT NULL,
    
    -- Miktarlar
    miktar DECIMAL(15,3) DEFAULT 0,
    rezerve_miktar DECIMAL(15,3) DEFAULT 0,
    bloke_miktar DECIMAL(15,3) DEFAULT 0,
    kullanilabilir DECIMAL(15,3) GENERATED ALWAYS AS (miktar - rezerve_miktar - bloke_miktar) STORED,
    
    -- Lokasyon
    blok VARCHAR(10),
    raf VARCHAR(10),
    kat VARCHAR(10),
    goz VARCHAR(10),
    lokasyon_kodu VARCHAR(50), -- Örn: A-12-3-5
    
    -- Limitler (Depo bazlı)
    min_stok DECIMAL(15,3) DEFAULT 0,
    max_stok DECIMAL(15,3) DEFAULT 99999,
    
    -- Tarihler
    ilk_giris_tarihi DATE,
    son_giris_tarihi DATE,
    son_cikis_tarihi DATE,
    
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(stok_kart_id, depo_id)
);

-- =============================================
-- 6. STOK HAREKETLERİ (Geliştirilmiş)
-- =============================================
CREATE TABLE IF NOT EXISTS stok_hareketleri_new (
    id SERIAL PRIMARY KEY,
    stok_kart_id INTEGER NOT NULL, -- stok_kartlari_new referansı sonra eklenecek
    
    -- Hareket Tipi
    hareket_tipi VARCHAR(20) NOT NULL CHECK (hareket_tipi IN (
        'GIRIS', 'CIKIS', 'TRANSFER', 'SAYIM', 'FIRE', 
        'IADE_GIRIS', 'IADE_CIKIS', 'URETIM_GIRIS', 'URETIM_CIKIS', 'DEVIR'
    )),
    hareket_yonu CHAR(1) GENERATED ALWAYS AS (
        CASE 
            WHEN hareket_tipi IN ('GIRIS', 'IADE_GIRIS', 'URETIM_GIRIS', 'DEVIR', 'SAYIM') THEN '+'
            ELSE '-'
        END
    ) STORED,
    
    -- Miktar ve Birim
    miktar DECIMAL(15,3) NOT NULL,
    birim_id INTEGER REFERENCES birimler(id),
    birim_fiyat DECIMAL(15,4) DEFAULT 0,
    tutar DECIMAL(15,2) GENERATED ALWAYS AS (miktar * birim_fiyat) STORED,
    kdv_orani DECIMAL(5,2) DEFAULT 18,
    kdv_tutar DECIMAL(15,2),
    toplam_tutar DECIMAL(15,2),
    
    -- Depo Bilgileri
    giris_depo_id INTEGER REFERENCES depolar(id),
    cikis_depo_id INTEGER REFERENCES depolar(id),
    lokasyon_kodu VARCHAR(50),
    
    -- Belge Bilgileri
    belge_tipi VARCHAR(30), -- Fatura, İrsaliye, Fis vb
    belge_no VARCHAR(50),
    belge_tarihi DATE,
    belge_seri VARCHAR(10),
    belge_sira VARCHAR(20),
    
    -- İlişkili Kayıtlar
    cari_id INTEGER REFERENCES cariler(id),
    fatura_id INTEGER REFERENCES uyumsoft_invoices(id),
    satin_alma_talep_id INTEGER, -- REFERENCES satin_alma_talepleri(id)
    uretim_emri_id INTEGER, -- İleride eklenecek
    
    -- Lot/Seri Takibi
    lot_no VARCHAR(50),
    seri_no VARCHAR(50),
    uretim_tarihi DATE,
    son_kullanma_tarihi DATE,
    
    -- Stok Durumu (Hareket öncesi ve sonrası)
    onceki_stok DECIMAL(15,3),
    sonraki_stok DECIMAL(15,3),
    
    -- Açıklama ve Notlar
    aciklama TEXT,
    hareket_nedeni VARCHAR(100),
    onay_durumu VARCHAR(20) DEFAULT 'beklemede', -- beklemede, onaylandi, iptal
    onaylayan VARCHAR(100),
    onay_tarihi TIMESTAMP,
    
    -- Sistem Bilgileri
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(100),
    ip_adresi VARCHAR(45),
    
    -- İptal Bilgileri
    iptal BOOLEAN DEFAULT FALSE,
    iptal_nedeni TEXT,
    iptal_eden VARCHAR(100),
    iptal_tarihi TIMESTAMP
);

-- =============================================
-- GÖRÜNÜMLER (VIEWS)
-- =============================================

-- Depo Bazlı Stok Durumu
CREATE OR REPLACE VIEW v_depo_stok_durum AS
SELECT 
    d.kod as depo_kod,
    d.ad as depo_ad,
    sk.kod as stok_kod,
    sk.ad as stok_ad,
    k.ad as kategori,
    b.ad as birim,
    sd.miktar,
    sd.rezerve_miktar,
    sd.kullanilabilir,
    sd.lokasyon_kodu,
    sk.min_stok,
    CASE 
        WHEN sd.miktar <= sk.kritik_stok THEN 'Kritik'
        WHEN sd.miktar <= sk.min_stok THEN 'Düşük'
        WHEN sd.miktar >= sk.max_stok THEN 'Fazla'
        ELSE 'Normal'
    END as stok_durumu
FROM stok_depo_durumlari sd
JOIN stok_kartlari_new sk ON sk.id = sd.stok_kart_id
JOIN depolar d ON d.id = sd.depo_id
LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
LEFT JOIN birimler b ON b.id = sk.ana_birim_id
WHERE sk.aktif = TRUE
ORDER BY d.kod, sk.kod;

-- Kritik Stoklar (Depo Bazlı)
CREATE OR REPLACE VIEW v_kritik_stoklar AS
SELECT 
    sk.kod,
    sk.ad as stok_ad,
    d.ad as depo,
    sd.miktar as mevcut,
    sk.min_stok,
    sk.kritik_stok,
    (sk.min_stok - sd.miktar) as eksik_miktar,
    b.kisa_ad as birim,
    c.unvan as tedarikci,
    sk.tedarik_suresi
FROM stok_depo_durumlari sd
JOIN stok_kartlari_new sk ON sk.id = sd.stok_kart_id
JOIN depolar d ON d.id = sd.depo_id
LEFT JOIN birimler b ON b.id = sk.ana_birim_id
LEFT JOIN cariler c ON c.id = sk.varsayilan_tedarikci_id
WHERE sd.miktar <= sk.min_stok
AND sk.aktif = TRUE
ORDER BY (sk.kritik_stok - sd.miktar) DESC;

-- Stok Hareket Raporu
CREATE OR REPLACE VIEW v_stok_hareket_rapor AS
SELECT 
    h.id,
    h.belge_tarihi as tarih,
    h.belge_no,
    sk.kod as stok_kod,
    sk.ad as stok_ad,
    h.hareket_tipi,
    CASE 
        WHEN h.hareket_yonu = '+' THEN h.miktar 
        ELSE 0 
    END as giris,
    CASE 
        WHEN h.hareket_yonu = '-' THEN h.miktar 
        ELSE 0 
    END as cikis,
    h.birim_fiyat,
    h.toplam_tutar,
    d1.ad as giris_depo,
    d2.ad as cikis_depo,
    c.unvan as cari,
    h.aciklama
FROM stok_hareketleri_new h
JOIN stok_kartlari_new sk ON sk.id = h.stok_kart_id
LEFT JOIN depolar d1 ON d1.id = h.giris_depo_id
LEFT JOIN depolar d2 ON d2.id = h.cikis_depo_id
LEFT JOIN cariler c ON c.id = h.cari_id
WHERE h.iptal = FALSE
ORDER BY h.belge_tarihi DESC, h.id DESC;

-- =============================================
-- TRİGGER'LAR
-- =============================================

-- Stok hareketi sonrası güncelleme
CREATE OR REPLACE FUNCTION update_stok_after_hareket_new()
RETURNS TRIGGER AS $$
DECLARE
    v_depo_id INTEGER;
    v_miktar DECIMAL(15,3);
BEGIN
    -- Depo ve miktar belirle
    IF NEW.hareket_yonu = '+' THEN
        v_depo_id := NEW.giris_depo_id;
        v_miktar := NEW.miktar;
    ELSE
        v_depo_id := NEW.cikis_depo_id;
        v_miktar := -NEW.miktar;
    END IF;
    
    -- Stok kartını güncelle (toplam)
    UPDATE stok_kartlari_new 
    SET 
        toplam_stok = toplam_stok + v_miktar,
        son_alis_tarihi = CASE 
            WHEN NEW.hareket_tipi = 'GIRIS' THEN NEW.belge_tarihi 
            ELSE son_alis_tarihi 
        END,
        son_alis_fiyat = CASE 
            WHEN NEW.hareket_tipi = 'GIRIS' THEN NEW.birim_fiyat 
            ELSE son_alis_fiyat 
        END,
        updated_at = NOW()
    WHERE id = NEW.stok_kart_id;
    
    -- Depo stok durumunu güncelle
    INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, son_giris_tarihi)
    VALUES (NEW.stok_kart_id, v_depo_id, v_miktar, NEW.belge_tarihi)
    ON CONFLICT (stok_kart_id, depo_id)
    DO UPDATE SET 
        miktar = stok_depo_durumlari.miktar + v_miktar,
        son_giris_tarihi = CASE 
            WHEN NEW.hareket_yonu = '+' THEN NEW.belge_tarihi 
            ELSE stok_depo_durumlari.son_giris_tarihi 
        END,
        son_cikis_tarihi = CASE 
            WHEN NEW.hareket_yonu = '-' THEN NEW.belge_tarihi 
            ELSE stok_depo_durumlari.son_cikis_tarihi 
        END,
        updated_at = NOW();
    
    -- Transfer durumunda her iki depoyu güncelle
    IF NEW.hareket_tipi = 'TRANSFER' THEN
        -- Çıkış deposu
        UPDATE stok_depo_durumlari 
        SET 
            miktar = miktar - NEW.miktar,
            son_cikis_tarihi = NEW.belge_tarihi,
            updated_at = NOW()
        WHERE stok_kart_id = NEW.stok_kart_id 
        AND depo_id = NEW.cikis_depo_id;
        
        -- Giriş deposu
        INSERT INTO stok_depo_durumlari (stok_kart_id, depo_id, miktar, son_giris_tarihi)
        VALUES (NEW.stok_kart_id, NEW.giris_depo_id, NEW.miktar, NEW.belge_tarihi)
        ON CONFLICT (stok_kart_id, depo_id)
        DO UPDATE SET 
            miktar = stok_depo_durumlari.miktar + NEW.miktar,
            son_giris_tarihi = NEW.belge_tarihi,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mevcut verileri taşı (eğer varsa)
INSERT INTO stok_kartlari_new (
    kod, ad, kategori_id, ana_birim_id, toplam_stok, 
    min_stok, max_stok, kritik_stok, son_alis_fiyat, 
    varsayilan_tedarikci_id, barkod, aktif, created_at
)
SELECT 
    kod, 
    ad,
    (SELECT id FROM stok_kategoriler WHERE ad = old.kategori LIMIT 1),
    (SELECT id FROM birimler WHERE ad ILIKE old.birim || '%' LIMIT 1),
    miktar,
    min_stok,
    max_stok,
    CASE WHEN kritik_stok = true THEN min_stok * 0.5 ELSE min_stok END,
    alis_fiyati,
    tedarikci_id,
    barkod,
    aktif,
    created_at
FROM stok_kartlari_old old
WHERE NOT EXISTS (
    SELECT 1 FROM stok_kartlari_new WHERE kod = old.kod
);

-- Yeni tabloları etkinleştir
ALTER TABLE stok_kartlari_new RENAME TO stok_kartlari;
ALTER TABLE stok_hareketleri_new RENAME TO stok_hareketleri;

-- Foreign key'leri ekle
ALTER TABLE stok_depo_durumlari 
    ADD CONSTRAINT fk_stok_depo_stok FOREIGN KEY (stok_kart_id) REFERENCES stok_kartlari(id);

ALTER TABLE stok_hareketleri 
    ADD CONSTRAINT fk_stok_hareket_stok FOREIGN KEY (stok_kart_id) REFERENCES stok_kartlari(id);

-- Trigger'ı ekle
CREATE TRIGGER trg_update_stok_after_hareket
    AFTER INSERT ON stok_hareketleri
    FOR EACH ROW
    EXECUTE FUNCTION update_stok_after_hareket_new();

-- Eski tabloları temizle
DROP TABLE IF EXISTS stok_kartlari_old CASCADE;
DROP TABLE IF EXISTS stok_hareketleri_old CASCADE;

-- İndeksler
CREATE INDEX idx_stok_kartlari_kod ON stok_kartlari(kod);
CREATE INDEX idx_stok_kartlari_barkod ON stok_kartlari(barkod);
CREATE INDEX idx_stok_kartlari_kategori ON stok_kartlari(kategori_id);
CREATE INDEX idx_stok_depo_stok ON stok_depo_durumlari(stok_kart_id);
CREATE INDEX idx_stok_depo_depo ON stok_depo_durumlari(depo_id);
CREATE INDEX idx_stok_hareket_stok ON stok_hareketleri(stok_kart_id);
CREATE INDEX idx_stok_hareket_tarih ON stok_hareketleri(belge_tarihi);

COMMENT ON TABLE birimler IS 'Stok birimleri (Kg, Lt, Adet vb.)';
COMMENT ON TABLE depolar IS 'Depo tanımları ve lokasyonlar';
COMMENT ON TABLE stok_kartlari IS 'Stok kartları - tüm ürün tanımları';
COMMENT ON TABLE stok_depo_durumlari IS 'Hangi üründen hangi depoda ne kadar var';
COMMENT ON TABLE stok_hareketleri IS 'Tüm stok giriş-çıkış hareketleri';
COMMENT ON VIEW v_depo_stok_durum IS 'Depo bazlı anlık stok durumu';
COMMENT ON VIEW v_kritik_stoklar IS 'Kritik seviyedeki stoklar';
