-- =============================================
-- DEMİRBAŞ/ENVANTER YÖNETİM SİSTEMİ
-- Migration: 024
-- =============================================

-- =============================================
-- 1. DEMİRBAŞ KATEGORİLERİ
-- =============================================
CREATE TABLE IF NOT EXISTS demirbas_kategoriler (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(20) UNIQUE NOT NULL,
    ad VARCHAR(100) NOT NULL,
    ust_kategori_id INTEGER REFERENCES demirbas_kategoriler(id),
    renk VARCHAR(7) DEFAULT '#6366f1', -- Hex renk kodu
    ikon VARCHAR(50), -- Emoji veya icon adı
    amortisman_oran DECIMAL(5,2) DEFAULT 20, -- Yıllık amortisman oranı %
    faydali_omur INTEGER DEFAULT 5, -- Varsayılan faydalı ömür (yıl)
    sira_no INTEGER DEFAULT 999,
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan kategoriler
INSERT INTO demirbas_kategoriler (kod, ad, renk, ikon, amortisman_oran, faydali_omur, sira_no) VALUES 
    ('BILGISAYAR', 'Bilgisayar & Elektronik', '#3b82f6', '💻', 20, 5, 1),
    ('MOBILYA', 'Mobilya', '#8b5cf6', '🪑', 10, 10, 2),
    ('ARAC', 'Araçlar', '#ec4899', '🚗', 20, 5, 3),
    ('MUTFAK', 'Mutfak Ekipmanları', '#10b981', '🍳', 10, 10, 4),
    ('MAKINE', 'Makine & Teçhizat', '#f59e0b', '🔧', 10, 10, 5),
    ('KLIMA', 'Klima & Havalandırma', '#06b6d4', '❄️', 10, 10, 6),
    ('DIGER', 'Diğer', '#6b7280', '📦', 20, 5, 7)
ON CONFLICT (kod) DO NOTHING;

-- Alt kategoriler
INSERT INTO demirbas_kategoriler (kod, ad, ust_kategori_id, renk, ikon, sira_no)
SELECT 'LAPTOP', 'Laptop', id, '#3b82f6', '💻', 1 FROM demirbas_kategoriler WHERE kod = 'BILGISAYAR'
ON CONFLICT (kod) DO NOTHING;

INSERT INTO demirbas_kategoriler (kod, ad, ust_kategori_id, renk, ikon, sira_no)
SELECT 'MASAUSTU', 'Masaüstü Bilgisayar', id, '#3b82f6', '🖥️', 2 FROM demirbas_kategoriler WHERE kod = 'BILGISAYAR'
ON CONFLICT (kod) DO NOTHING;

INSERT INTO demirbas_kategoriler (kod, ad, ust_kategori_id, renk, ikon, sira_no)
SELECT 'YAZICI', 'Yazıcı & Tarayıcı', id, '#3b82f6', '🖨️', 3 FROM demirbas_kategoriler WHERE kod = 'BILGISAYAR'
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- 2. LOKASYONLAR (Şube/Bina/Oda)
-- =============================================
CREATE TABLE IF NOT EXISTS demirbas_lokasyonlar (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(20) UNIQUE NOT NULL,
    ad VARCHAR(100) NOT NULL,
    ust_lokasyon_id INTEGER REFERENCES demirbas_lokasyonlar(id),
    tip VARCHAR(30) DEFAULT 'oda', -- sube, bina, kat, oda
    adres TEXT,
    sorumlu_kisi VARCHAR(100),
    telefon VARCHAR(20),
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan lokasyonlar
INSERT INTO demirbas_lokasyonlar (kod, ad, tip) VALUES 
    ('MERKEZ', 'Merkez Ofis', 'sube'),
    ('MUTFAK', 'Mutfak Bölümü', 'bolum'),
    ('DEPO', 'Ana Depo', 'depo'),
    ('GARAJ', 'Araç Garajı', 'depo')
ON CONFLICT (kod) DO NOTHING;

-- =============================================
-- 3. DEMİRBAŞ KARTLARI (Ana Tablo)
-- =============================================
CREATE TABLE IF NOT EXISTS demirbaslar (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(50) UNIQUE NOT NULL, -- DMB-2026-0001
    barkod VARCHAR(50) UNIQUE,
    ad VARCHAR(200) NOT NULL,
    
    -- Kategori
    kategori_id INTEGER REFERENCES demirbas_kategoriler(id),
    
    -- Marka/Model/Seri
    marka VARCHAR(100),
    model VARCHAR(100),
    seri_no VARCHAR(100),
    
    -- Satın Alma Bilgileri
    alis_tarihi DATE NOT NULL,
    alis_fiyati DECIMAL(15,2) NOT NULL DEFAULT 0,
    tedarikci_id INTEGER REFERENCES cariler(id),
    fatura_no VARCHAR(50),
    fatura_id INTEGER REFERENCES uyumsoft_invoices(id),
    
    -- Garanti Bilgileri
    garanti_suresi INTEGER, -- Ay cinsinden
    garanti_bitis DATE,
    
    -- Amortisman Bilgileri
    amortisman_yontemi VARCHAR(20) DEFAULT 'dogrusal', -- dogrusal, azalan
    faydali_omur INTEGER DEFAULT 5, -- Yıl
    hurda_degeri DECIMAL(15,2) DEFAULT 0,
    birikimis_amortisman DECIMAL(15,2) DEFAULT 0,
    net_defter_degeri DECIMAL(15,2) GENERATED ALWAYS AS (alis_fiyati - birikimis_amortisman) STORED,
    
    -- Lokasyon
    lokasyon_id INTEGER REFERENCES demirbas_lokasyonlar(id),
    lokasyon_detay VARCHAR(100), -- Oda no, raf no vs.
    
    -- Zimmet Bilgisi (aktif zimmet)
    zimmetli_personel_id INTEGER REFERENCES personeller(id),
    zimmet_tarihi DATE,
    
    -- Durum
    durum VARCHAR(20) DEFAULT 'aktif' CHECK (durum IN ('aktif', 'bakimda', 'arizali', 'hurda', 'satildi', 'kayip')),
    
    -- Ek Bilgiler
    aciklama TEXT,
    resim_url TEXT,
    teknik_ozellik TEXT,
    
    -- Muhasebe
    muhasebe_hesap_kodu VARCHAR(50),
    
    -- Meta
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(100)
);

-- =============================================
-- 4. DEMİRBAŞ HAREKETLERİ
-- =============================================
CREATE TABLE IF NOT EXISTS demirbas_hareketler (
    id SERIAL PRIMARY KEY,
    demirbas_id INTEGER NOT NULL REFERENCES demirbaslar(id) ON DELETE CASCADE,
    
    -- Hareket Tipi
    hareket_tipi VARCHAR(30) NOT NULL CHECK (hareket_tipi IN (
        'GIRIS', 'ZIMMET', 'ZIMMET_DEVIR', 'ZIMMET_IADE', 
        'TRANSFER', 'BAKIM_GIRIS', 'BAKIM_CIKIS', 
        'AMORTISMAN', 'HURDA', 'SATIS', 'KAYIP', 'SAYIM'
    )),
    
    -- Tarih
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Zimmet bilgileri
    onceki_personel_id INTEGER REFERENCES personeller(id),
    yeni_personel_id INTEGER REFERENCES personeller(id),
    
    -- Lokasyon bilgileri
    onceki_lokasyon_id INTEGER REFERENCES demirbas_lokasyonlar(id),
    yeni_lokasyon_id INTEGER REFERENCES demirbas_lokasyonlar(id),
    
    -- Bakım bilgileri
    bakim_tipi VARCHAR(50), -- periyodik, arizali, garanti
    servis_firma VARCHAR(200),
    tahmini_donus DATE,
    bakim_maliyeti DECIMAL(15,2) DEFAULT 0,
    
    -- Amortisman
    amortisman_tutari DECIMAL(15,2),
    
    -- Satış/Hurda
    satis_tutari DECIMAL(15,2),
    alici_bilgi TEXT,
    
    -- Açıklama
    aciklama TEXT,
    belge_no VARCHAR(50),
    
    -- Meta
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- =============================================
-- 5. ZİMMET TARİHÇESİ
-- =============================================
CREATE TABLE IF NOT EXISTS demirbas_zimmetler (
    id SERIAL PRIMARY KEY,
    demirbas_id INTEGER NOT NULL REFERENCES demirbaslar(id) ON DELETE CASCADE,
    personel_id INTEGER NOT NULL REFERENCES personeller(id),
    
    -- Zimmet tarihleri
    zimmet_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
    iade_tarihi DATE,
    
    -- Zimmet durumu
    durum VARCHAR(20) DEFAULT 'aktif' CHECK (durum IN ('aktif', 'iade', 'devir')),
    
    -- Teslim bilgileri
    teslim_durumu VARCHAR(20) DEFAULT 'teslim_edildi', -- teslim_edildi, beklemede
    teslim_alan VARCHAR(100),
    teslim_eden VARCHAR(100),
    
    -- Notlar
    notlar TEXT,
    
    -- Meta
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- =============================================
-- 6. BAKIM KAYITLARI
-- =============================================
CREATE TABLE IF NOT EXISTS demirbas_bakimlar (
    id SERIAL PRIMARY KEY,
    demirbas_id INTEGER NOT NULL REFERENCES demirbaslar(id) ON DELETE CASCADE,
    
    -- Bakım bilgileri
    bakim_tipi VARCHAR(30) NOT NULL CHECK (bakim_tipi IN ('periyodik', 'ariza', 'garanti', 'onleyici')),
    bakim_nedeni TEXT,
    
    -- Servis bilgileri
    servis_firma VARCHAR(200),
    servis_telefon VARCHAR(20),
    servis_belge_no VARCHAR(50),
    
    -- Tarihler
    gonderim_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
    tahmini_donus DATE,
    gercek_donus DATE,
    
    -- Maliyet
    tahmini_maliyet DECIMAL(15,2) DEFAULT 0,
    gercek_maliyet DECIMAL(15,2) DEFAULT 0,
    garanti_kapsaminda BOOLEAN DEFAULT FALSE,
    
    -- Yapılan işlemler
    yapilan_islem TEXT,
    degisen_parcalar TEXT,
    
    -- Durum
    durum VARCHAR(20) DEFAULT 'devam_ediyor' CHECK (durum IN ('devam_ediyor', 'tamamlandi', 'iptal')),
    
    -- Meta
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 7. AMORTİSMAN KAYITLARI
-- =============================================
CREATE TABLE IF NOT EXISTS demirbas_amortismanlar (
    id SERIAL PRIMARY KEY,
    demirbas_id INTEGER NOT NULL REFERENCES demirbaslar(id) ON DELETE CASCADE,
    
    yil INTEGER NOT NULL,
    ay INTEGER, -- Aylık hesaplama için (opsiyonel)
    
    -- Değerler
    donem_basi_deger DECIMAL(15,2) NOT NULL,
    amortisman_tutari DECIMAL(15,2) NOT NULL,
    birikimis_amortisman DECIMAL(15,2) NOT NULL,
    donem_sonu_deger DECIMAL(15,2) NOT NULL,
    
    -- Hesaplama bilgileri
    amortisman_orani DECIMAL(5,2),
    hesaplama_tarihi DATE DEFAULT CURRENT_DATE,
    
    -- Meta
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    
    UNIQUE(demirbas_id, yil, ay)
);

-- =============================================
-- 8. GÖRÜNÜMLER (VIEWS)
-- =============================================

-- Demirbaş özet görünümü
CREATE OR REPLACE VIEW v_demirbas_ozet AS
SELECT 
    d.id,
    d.kod,
    d.ad,
    d.marka,
    d.model,
    d.seri_no,
    d.alis_tarihi,
    d.alis_fiyati,
    d.garanti_bitis,
    d.durum,
    d.net_defter_degeri,
    d.birikimis_amortisman,
    
    -- Kategori
    k.id as kategori_id,
    k.ad as kategori_ad,
    k.renk as kategori_renk,
    k.ikon as kategori_ikon,
    
    -- Lokasyon
    l.id as lokasyon_id,
    l.ad as lokasyon_ad,
    d.lokasyon_detay,
    
    -- Zimmetli personel
    d.zimmetli_personel_id,
    p.ad || ' ' || p.soyad as zimmetli_personel,
    p.departman as zimmetli_departman,
    d.zimmet_tarihi,
    
    -- Tedarikçi
    c.unvan as tedarikci,
    
    -- Garanti durumu
    CASE 
        WHEN d.garanti_bitis IS NULL THEN 'belirsiz'
        WHEN d.garanti_bitis < CURRENT_DATE THEN 'bitti'
        WHEN d.garanti_bitis < CURRENT_DATE + INTERVAL '30 days' THEN 'yaklasiyor'
        ELSE 'gecerli'
    END as garanti_durumu,
    
    d.created_at
FROM demirbaslar d
LEFT JOIN demirbas_kategoriler k ON k.id = d.kategori_id
LEFT JOIN demirbas_lokasyonlar l ON l.id = d.lokasyon_id
LEFT JOIN personeller p ON p.id = d.zimmetli_personel_id
LEFT JOIN cariler c ON c.id = d.tedarikci_id
WHERE d.aktif = TRUE
ORDER BY d.created_at DESC;

-- Kategori bazlı özet
CREATE OR REPLACE VIEW v_demirbas_kategori_ozet AS
SELECT 
    k.id,
    k.kod,
    k.ad,
    k.renk,
    k.ikon,
    COUNT(d.id) as toplam_adet,
    COALESCE(SUM(d.alis_fiyati), 0) as toplam_alis_degeri,
    COALESCE(SUM(d.net_defter_degeri), 0) as toplam_net_deger,
    COALESCE(SUM(d.birikimis_amortisman), 0) as toplam_amortisman,
    COUNT(CASE WHEN d.durum = 'bakimda' THEN 1 END) as bakimda_adet,
    COUNT(CASE WHEN d.zimmetli_personel_id IS NOT NULL THEN 1 END) as zimmetli_adet
FROM demirbas_kategoriler k
LEFT JOIN demirbaslar d ON d.kategori_id = k.id AND d.aktif = TRUE
WHERE k.aktif = TRUE AND k.ust_kategori_id IS NULL
GROUP BY k.id, k.kod, k.ad, k.renk, k.ikon
ORDER BY k.sira_no;

-- Garanti yaklaşan demirbaşlar
CREATE OR REPLACE VIEW v_demirbas_garanti_yaklasan AS
SELECT 
    d.id,
    d.kod,
    d.ad,
    d.marka,
    d.model,
    d.garanti_bitis,
    d.garanti_bitis - CURRENT_DATE as kalan_gun,
    k.ad as kategori,
    k.renk,
    l.ad as lokasyon
FROM demirbaslar d
LEFT JOIN demirbas_kategoriler k ON k.id = d.kategori_id
LEFT JOIN demirbas_lokasyonlar l ON l.id = d.lokasyon_id
WHERE d.aktif = TRUE 
AND d.garanti_bitis IS NOT NULL
AND d.garanti_bitis BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
ORDER BY d.garanti_bitis;

-- Bakımda olan demirbaşlar
CREATE OR REPLACE VIEW v_demirbas_bakimda AS
SELECT 
    d.id,
    d.kod,
    d.ad,
    b.bakim_tipi,
    b.servis_firma,
    b.gonderim_tarihi,
    b.tahmini_donus,
    CURRENT_DATE - b.gonderim_tarihi as gecen_gun,
    b.tahmini_maliyet,
    k.ad as kategori,
    k.renk
FROM demirbaslar d
JOIN demirbas_bakimlar b ON b.demirbas_id = d.id AND b.durum = 'devam_ediyor'
LEFT JOIN demirbas_kategoriler k ON k.id = d.kategori_id
WHERE d.durum = 'bakimda'
ORDER BY b.gonderim_tarihi;

-- =============================================
-- 9. TRİGGER'LAR
-- =============================================

-- Updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_demirbas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_demirbas_updated_at
    BEFORE UPDATE ON demirbaslar
    FOR EACH ROW
    EXECUTE FUNCTION update_demirbas_updated_at();

CREATE TRIGGER trg_demirbas_bakim_updated_at
    BEFORE UPDATE ON demirbas_bakimlar
    FOR EACH ROW
    EXECUTE FUNCTION update_demirbas_updated_at();

-- Hareket sonrası demirbaş güncelleme
CREATE OR REPLACE FUNCTION update_demirbas_after_hareket()
RETURNS TRIGGER AS $$
BEGIN
    -- Zimmet hareketi
    IF NEW.hareket_tipi IN ('ZIMMET', 'ZIMMET_DEVIR') THEN
        UPDATE demirbaslar SET 
            zimmetli_personel_id = NEW.yeni_personel_id,
            zimmet_tarihi = NEW.tarih,
            lokasyon_id = COALESCE(NEW.yeni_lokasyon_id, lokasyon_id),
            updated_at = NOW()
        WHERE id = NEW.demirbas_id;
        
    -- Zimmet iade
    ELSIF NEW.hareket_tipi = 'ZIMMET_IADE' THEN
        UPDATE demirbaslar SET 
            zimmetli_personel_id = NULL,
            zimmet_tarihi = NULL,
            lokasyon_id = COALESCE(NEW.yeni_lokasyon_id, lokasyon_id),
            updated_at = NOW()
        WHERE id = NEW.demirbas_id;
        
    -- Transfer
    ELSIF NEW.hareket_tipi = 'TRANSFER' THEN
        UPDATE demirbaslar SET 
            lokasyon_id = NEW.yeni_lokasyon_id,
            updated_at = NOW()
        WHERE id = NEW.demirbas_id;
        
    -- Bakıma giriş
    ELSIF NEW.hareket_tipi = 'BAKIM_GIRIS' THEN
        UPDATE demirbaslar SET 
            durum = 'bakimda',
            updated_at = NOW()
        WHERE id = NEW.demirbas_id;
        
    -- Bakımdan çıkış
    ELSIF NEW.hareket_tipi = 'BAKIM_CIKIS' THEN
        UPDATE demirbaslar SET 
            durum = 'aktif',
            updated_at = NOW()
        WHERE id = NEW.demirbas_id;
        
    -- Hurda
    ELSIF NEW.hareket_tipi = 'HURDA' THEN
        UPDATE demirbaslar SET 
            durum = 'hurda',
            zimmetli_personel_id = NULL,
            aktif = FALSE,
            updated_at = NOW()
        WHERE id = NEW.demirbas_id;
        
    -- Satış
    ELSIF NEW.hareket_tipi = 'SATIS' THEN
        UPDATE demirbaslar SET 
            durum = 'satildi',
            zimmetli_personel_id = NULL,
            aktif = FALSE,
            updated_at = NOW()
        WHERE id = NEW.demirbas_id;
        
    -- Kayıp
    ELSIF NEW.hareket_tipi = 'KAYIP' THEN
        UPDATE demirbaslar SET 
            durum = 'kayip',
            aktif = FALSE,
            updated_at = NOW()
        WHERE id = NEW.demirbas_id;
        
    -- Amortisman
    ELSIF NEW.hareket_tipi = 'AMORTISMAN' THEN
        UPDATE demirbaslar SET 
            birikimis_amortisman = birikimis_amortisman + NEW.amortisman_tutari,
            updated_at = NOW()
        WHERE id = NEW.demirbas_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_demirbas_hareket
    AFTER INSERT ON demirbas_hareketler
    FOR EACH ROW
    EXECUTE FUNCTION update_demirbas_after_hareket();

-- =============================================
-- 10. İNDEKSLER
-- =============================================
CREATE INDEX idx_demirbas_kod ON demirbaslar(kod);
CREATE INDEX idx_demirbas_kategori ON demirbaslar(kategori_id);
CREATE INDEX idx_demirbas_lokasyon ON demirbaslar(lokasyon_id);
CREATE INDEX idx_demirbas_zimmetli ON demirbaslar(zimmetli_personel_id);
CREATE INDEX idx_demirbas_durum ON demirbaslar(durum);
CREATE INDEX idx_demirbas_garanti ON demirbaslar(garanti_bitis);
CREATE INDEX idx_demirbas_hareket_demirbas ON demirbas_hareketler(demirbas_id);
CREATE INDEX idx_demirbas_hareket_tarih ON demirbas_hareketler(tarih DESC);
CREATE INDEX idx_demirbas_zimmet_demirbas ON demirbas_zimmetler(demirbas_id);
CREATE INDEX idx_demirbas_zimmet_personel ON demirbas_zimmetler(personel_id);
CREATE INDEX idx_demirbas_bakim_demirbas ON demirbas_bakimlar(demirbas_id);

-- =============================================
-- 11. RLS (Row Level Security)
-- =============================================
ALTER TABLE demirbaslar ENABLE ROW LEVEL SECURITY;
ALTER TABLE demirbas_kategoriler ENABLE ROW LEVEL SECURITY;
ALTER TABLE demirbas_lokasyonlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE demirbas_hareketler ENABLE ROW LEVEL SECURITY;
ALTER TABLE demirbas_zimmetler ENABLE ROW LEVEL SECURITY;
ALTER TABLE demirbas_bakimlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE demirbas_amortismanlar ENABLE ROW LEVEL SECURITY;

-- Tüm authenticated kullanıcılara erişim
CREATE POLICY "demirbas_all_access" ON demirbaslar FOR ALL USING (true);
CREATE POLICY "demirbas_kat_all_access" ON demirbas_kategoriler FOR ALL USING (true);
CREATE POLICY "demirbas_lok_all_access" ON demirbas_lokasyonlar FOR ALL USING (true);
CREATE POLICY "demirbas_har_all_access" ON demirbas_hareketler FOR ALL USING (true);
CREATE POLICY "demirbas_zim_all_access" ON demirbas_zimmetler FOR ALL USING (true);
CREATE POLICY "demirbas_bak_all_access" ON demirbas_bakimlar FOR ALL USING (true);
CREATE POLICY "demirbas_amo_all_access" ON demirbas_amortismanlar FOR ALL USING (true);

-- =============================================
-- Migration tamamlandı!
-- =============================================
COMMENT ON TABLE demirbaslar IS 'Şirket demirbaş/envanter kayıtları';
COMMENT ON TABLE demirbas_kategoriler IS 'Demirbaş kategorileri (Bilgisayar, Mobilya, Araç vb.)';
COMMENT ON TABLE demirbas_lokasyonlar IS 'Demirbaş lokasyonları (Şube, Bina, Oda)';
COMMENT ON TABLE demirbas_hareketler IS 'Demirbaş hareket geçmişi';
COMMENT ON TABLE demirbas_zimmetler IS 'Zimmet takip tablosu';
COMMENT ON TABLE demirbas_bakimlar IS 'Bakım/onarım kayıtları';
COMMENT ON TABLE demirbas_amortismanlar IS 'Yıllık amortisman kayıtları';

