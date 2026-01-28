-- ====================================================
-- MUHASEBE SİSTEMİ - TÜM TABLOLAR
-- Supabase Migration - 006
-- ====================================================

-- ====================================================
-- 1. CARİLER (Müşteri/Tedarikçi Yönetimi)
-- ====================================================
CREATE TABLE IF NOT EXISTS cariler (
    id SERIAL PRIMARY KEY,
    tip VARCHAR(20) NOT NULL CHECK (tip IN ('musteri', 'tedarikci', 'her_ikisi')),
    unvan VARCHAR(255) NOT NULL,
    yetkili VARCHAR(100),
    vergi_no VARCHAR(20),
    vergi_dairesi VARCHAR(100),
    telefon VARCHAR(50),
    email VARCHAR(100),
    adres TEXT,
    il VARCHAR(50),
    ilce VARCHAR(50),
    
    -- Mali bilgiler
    borc DECIMAL(15,2) DEFAULT 0,
    alacak DECIMAL(15,2) DEFAULT 0,
    bakiye DECIMAL(15,2) GENERATED ALWAYS AS (alacak - borc) STORED,
    kredi_limiti DECIMAL(15,2) DEFAULT 0,
    
    -- Banka bilgileri
    banka_adi VARCHAR(100),
    iban VARCHAR(34),
    
    -- Durum ve notlar
    aktif BOOLEAN DEFAULT TRUE,
    notlar TEXT,
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cariler_tip ON cariler(tip);
CREATE INDEX idx_cariler_unvan ON cariler(unvan);
CREATE INDEX idx_cariler_vergi_no ON cariler(vergi_no);
CREATE INDEX idx_cariler_aktif ON cariler(aktif);

-- ====================================================
-- 2. STOK YÖNETİMİ
-- ====================================================
CREATE TABLE IF NOT EXISTS stok_kartlari (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(50) UNIQUE NOT NULL,
    ad VARCHAR(255) NOT NULL,
    kategori VARCHAR(100) NOT NULL,
    birim VARCHAR(20) NOT NULL,
    
    -- Stok miktarları
    miktar DECIMAL(15,3) DEFAULT 0,
    min_stok DECIMAL(15,3) DEFAULT 0,
    max_stok DECIMAL(15,3) DEFAULT 0,
    kritik_stok BOOLEAN GENERATED ALWAYS AS (miktar < min_stok) STORED,
    
    -- Fiyat bilgileri
    alis_fiyati DECIMAL(15,2) DEFAULT 0,
    satis_fiyati DECIMAL(15,2) DEFAULT 0,
    kdv_orani INTEGER DEFAULT 18,
    
    -- Tedarikçi
    tedarikci_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
    tedarik_suresi INTEGER DEFAULT 1, -- gün
    
    -- Depo bilgileri
    raf VARCHAR(50),
    barkod VARCHAR(50),
    
    -- Durum
    aktif BOOLEAN DEFAULT TRUE,
    notlar TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stok_kod ON stok_kartlari(kod);
CREATE INDEX idx_stok_kategori ON stok_kartlari(kategori);
CREATE INDEX idx_stok_kritik ON stok_kartlari(kritik_stok) WHERE kritik_stok = TRUE;
CREATE INDEX idx_stok_aktif ON stok_kartlari(aktif);

-- Stok Hareketleri
CREATE TABLE IF NOT EXISTS stok_hareketleri (
    id SERIAL PRIMARY KEY,
    stok_id INTEGER NOT NULL REFERENCES stok_kartlari(id) ON DELETE CASCADE,
    hareket_tipi VARCHAR(20) NOT NULL CHECK (hareket_tipi IN ('giris', 'cikis', 'transfer', 'sayim')),
    
    -- Hareket detayları
    miktar DECIMAL(15,3) NOT NULL,
    onceki_miktar DECIMAL(15,3),
    sonraki_miktar DECIMAL(15,3),
    birim_fiyat DECIMAL(15,2),
    
    -- İlişkili kayıtlar
    fatura_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
    
    -- Açıklamalar
    aciklama TEXT,
    belge_no VARCHAR(50),
    
    -- Metadata
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stok_hareket_stok_id ON stok_hareketleri(stok_id);
CREATE INDEX idx_stok_hareket_tarih ON stok_hareketleri(tarih DESC);
CREATE INDEX idx_stok_hareket_tip ON stok_hareketleri(hareket_tipi);

-- ====================================================
-- 3. PERSONEL YÖNETİMİ
-- ====================================================
CREATE TABLE IF NOT EXISTS personeller (
    id SERIAL PRIMARY KEY,
    sicil_no VARCHAR(20) UNIQUE,
    tc_kimlik VARCHAR(11) UNIQUE NOT NULL,
    ad VARCHAR(50) NOT NULL,
    soyad VARCHAR(50) NOT NULL,
    tam_ad VARCHAR(101) GENERATED ALWAYS AS (ad || ' ' || soyad) STORED,
    
    -- İletişim
    telefon VARCHAR(50),
    email VARCHAR(100),
    adres TEXT,
    
    -- Çalışma bilgileri
    departman VARCHAR(100),
    pozisyon VARCHAR(100),
    ise_giris_tarihi DATE NOT NULL,
    isten_cikis_tarihi DATE,
    aktif BOOLEAN GENERATED ALWAYS AS (isten_cikis_tarihi IS NULL) STORED,
    
    -- Maaş bilgileri
    maas DECIMAL(15,2) DEFAULT 0,
    maas_tipi VARCHAR(20) DEFAULT 'aylik' CHECK (maas_tipi IN ('aylik', 'haftalik', 'gunluk', 'saatlik')),
    
    -- Banka bilgileri
    iban VARCHAR(34),
    
    -- Kimlik bilgileri
    dogum_tarihi DATE,
    cinsiyet VARCHAR(10) CHECK (cinsiyet IN ('erkek', 'kadin', 'diger')),
    
    -- Belgeler ve notlar
    notlar TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_personel_aktif ON personeller(aktif);
CREATE INDEX idx_personel_departman ON personeller(departman);
CREATE INDEX idx_personel_tc ON personeller(tc_kimlik);

-- Personel Ödemeleri
CREATE TABLE IF NOT EXISTS personel_odemeleri (
    id SERIAL PRIMARY KEY,
    personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
    
    -- Ödeme detayları
    odeme_tipi VARCHAR(30) NOT NULL CHECK (odeme_tipi IN ('maas', 'avans', 'ikramiye', 'prim', 'fazla_mesai', 'diger')),
    tutar DECIMAL(15,2) NOT NULL,
    donem VARCHAR(20), -- '2024-01' gibi
    
    -- Kesintiler
    sgk_kesinti DECIMAL(15,2) DEFAULT 0,
    vergi_kesinti DECIMAL(15,2) DEFAULT 0,
    diger_kesinti DECIMAL(15,2) DEFAULT 0,
    net_tutar DECIMAL(15,2) GENERATED ALWAYS AS (tutar - sgk_kesinti - vergi_kesinti - diger_kesinti) STORED,
    
    -- Ödeme bilgileri
    odeme_yontemi VARCHAR(30) CHECK (odeme_yontemi IN ('nakit', 'banka', 'cek')),
    odeme_tarihi DATE,
    aciklama TEXT,
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_personel_odeme_personel ON personel_odemeleri(personel_id);
CREATE INDEX idx_personel_odeme_tarih ON personel_odemeleri(odeme_tarihi DESC);
CREATE INDEX idx_personel_odeme_donem ON personel_odemeleri(donem);

-- ====================================================
-- 4. GELİR-GİDER YÖNETİMİ
-- ====================================================
CREATE TABLE IF NOT EXISTS gelir_giderler (
    id SERIAL PRIMARY KEY,
    tip VARCHAR(10) NOT NULL CHECK (tip IN ('gelir', 'gider')),
    kategori VARCHAR(100) NOT NULL,
    
    -- İşlem detayları
    aciklama TEXT NOT NULL,
    tutar DECIMAL(15,2) NOT NULL,
    kdv_dahil BOOLEAN DEFAULT TRUE,
    kdv_orani INTEGER DEFAULT 18,
    kdv_tutar DECIMAL(15,2),
    
    -- İlişkili kayıtlar
    cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
    fatura_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    personel_id INTEGER REFERENCES personeller(id) ON DELETE SET NULL,
    
    -- Ödeme bilgileri
    odeme_yontemi VARCHAR(30) CHECK (odeme_yontemi IN ('nakit', 'banka', 'kredi_karti', 'cek', 'senet')),
    belge_no VARCHAR(50),
    
    -- Durum
    durum VARCHAR(20) DEFAULT 'odendi' CHECK (durum IN ('beklemede', 'odendi', 'iptal')),
    
    -- Tarih ve notlar
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    vade_tarihi DATE,
    notlar TEXT,
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gelir_gider_tip ON gelir_giderler(tip);
CREATE INDEX idx_gelir_gider_kategori ON gelir_giderler(kategori);
CREATE INDEX idx_gelir_gider_tarih ON gelir_giderler(tarih DESC);
CREATE INDEX idx_gelir_gider_durum ON gelir_giderler(durum);
CREATE INDEX idx_gelir_gider_cari ON gelir_giderler(cari_id);

-- ====================================================
-- 5. KASA-BANKA YÖNETİMİ
-- ====================================================
CREATE TABLE IF NOT EXISTS kasa_banka_hesaplari (
    id SERIAL PRIMARY KEY,
    hesap_tipi VARCHAR(20) NOT NULL CHECK (hesap_tipi IN ('kasa', 'banka')),
    hesap_adi VARCHAR(100) NOT NULL,
    
    -- Banka bilgileri (eğer banka hesabı ise)
    banka_adi VARCHAR(100),
    sube VARCHAR(100),
    hesap_no VARCHAR(50),
    iban VARCHAR(34),
    
    -- Para birimi ve bakiye
    para_birimi VARCHAR(3) DEFAULT 'TRY',
    bakiye DECIMAL(15,2) DEFAULT 0,
    
    -- Limitler
    kredi_limiti DECIMAL(15,2) DEFAULT 0,
    gunluk_limit DECIMAL(15,2),
    
    -- Durum
    aktif BOOLEAN DEFAULT TRUE,
    varsayilan BOOLEAN DEFAULT FALSE, -- Varsayılan hesap
    notlar TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kasa_banka_tip ON kasa_banka_hesaplari(hesap_tipi);
CREATE INDEX idx_kasa_banka_aktif ON kasa_banka_hesaplari(aktif);
CREATE UNIQUE INDEX idx_kasa_banka_varsayilan ON kasa_banka_hesaplari(varsayilan) WHERE varsayilan = TRUE;

-- Kasa-Banka Hareketleri
CREATE TABLE IF NOT EXISTS kasa_banka_hareketleri (
    id SERIAL PRIMARY KEY,
    hesap_id INTEGER NOT NULL REFERENCES kasa_banka_hesaplari(id) ON DELETE CASCADE,
    hareket_tipi VARCHAR(20) NOT NULL CHECK (hareket_tipi IN ('giris', 'cikis', 'transfer')),
    
    -- Hareket detayları
    tutar DECIMAL(15,2) NOT NULL,
    onceki_bakiye DECIMAL(15,2),
    sonraki_bakiye DECIMAL(15,2),
    
    -- Transfer için karşı hesap
    karsi_hesap_id INTEGER REFERENCES kasa_banka_hesaplari(id) ON DELETE SET NULL,
    
    -- İlişkili kayıtlar
    gelir_gider_id INTEGER REFERENCES gelir_giderler(id) ON DELETE SET NULL,
    fatura_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
    
    -- Açıklamalar
    aciklama TEXT,
    belge_no VARCHAR(50),
    
    -- Tarih
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    saat TIME DEFAULT CURRENT_TIME,
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kasa_banka_hareket_hesap ON kasa_banka_hareketleri(hesap_id);
CREATE INDEX idx_kasa_banka_hareket_tarih ON kasa_banka_hareketleri(tarih DESC, saat DESC);
CREATE INDEX idx_kasa_banka_hareket_tip ON kasa_banka_hareketleri(hareket_tipi);

-- ====================================================
-- 6. SATIN ALMA YÖNETİMİ
-- ====================================================
CREATE TABLE IF NOT EXISTS satin_alma_talepleri (
    id SERIAL PRIMARY KEY,
    talep_no VARCHAR(50) UNIQUE NOT NULL,
    
    -- Talep eden
    talep_eden VARCHAR(100) NOT NULL,
    departman VARCHAR(100),
    
    -- Talep detayları
    konu VARCHAR(255) NOT NULL,
    aciklama TEXT,
    aciliyet VARCHAR(20) DEFAULT 'normal' CHECK (aciliyet IN ('dusuk', 'normal', 'yuksek', 'acil')),
    
    -- Onay süreci
    durum VARCHAR(30) DEFAULT 'beklemede' CHECK (durum IN ('beklemede', 'onaylandi', 'reddedildi', 'tamamlandi', 'iptal')),
    onaylayan VARCHAR(100),
    onay_tarihi TIMESTAMP,
    red_nedeni TEXT,
    
    -- Tahmini maliyet
    tahmini_tutar DECIMAL(15,2),
    gerceklesen_tutar DECIMAL(15,2),
    
    -- Tedarikçi
    tedarikci_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
    
    -- Tarihler
    talep_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
    termin_tarihi DATE,
    tamamlanma_tarihi DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_satin_alma_durum ON satin_alma_talepleri(durum);
CREATE INDEX idx_satin_alma_aciliyet ON satin_alma_talepleri(aciliyet);
CREATE INDEX idx_satin_alma_tarih ON satin_alma_talepleri(talep_tarihi DESC);

-- Satın Alma Talep Kalemleri
CREATE TABLE IF NOT EXISTS satin_alma_kalemleri (
    id SERIAL PRIMARY KEY,
    talep_id INTEGER NOT NULL REFERENCES satin_alma_talepleri(id) ON DELETE CASCADE,
    
    -- Ürün bilgileri
    stok_id INTEGER REFERENCES stok_kartlari(id) ON DELETE SET NULL,
    urun_adi VARCHAR(255) NOT NULL,
    miktar DECIMAL(15,3) NOT NULL,
    birim VARCHAR(20) NOT NULL,
    
    -- Fiyat bilgileri
    tahmini_birim_fiyat DECIMAL(15,2),
    gerceklesen_birim_fiyat DECIMAL(15,2),
    toplam_tutar DECIMAL(15,2) GENERATED ALWAYS AS (miktar * COALESCE(gerceklesen_birim_fiyat, tahmini_birim_fiyat)) STORED,
    
    -- Notlar
    notlar TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_satin_alma_kalem_talep ON satin_alma_kalemleri(talep_id);
CREATE INDEX idx_satin_alma_kalem_stok ON satin_alma_kalemleri(stok_id);

-- ====================================================
-- 7. GÖRÜNÜMLER (VIEWS)
-- ====================================================

-- Cari Özet Görünümü
CREATE OR REPLACE VIEW cari_ozet AS
SELECT 
    c.*,
    COALESCE(COUNT(DISTINCT i.id), 0) as fatura_sayisi,
    COALESCE(SUM(i.total_amount), 0) as toplam_islem
FROM cariler c
LEFT JOIN invoices i ON i.customer_name = c.unvan
GROUP BY c.id;

-- Kritik Stok Görünümü
CREATE OR REPLACE VIEW kritik_stoklar AS
SELECT 
    sk.*,
    c.unvan as tedarikci_unvan,
    c.telefon as tedarikci_telefon
FROM stok_kartlari sk
LEFT JOIN cariler c ON c.id = sk.tedarikci_id
WHERE sk.kritik_stok = TRUE AND sk.aktif = TRUE
ORDER BY sk.miktar ASC;

-- Aylık Gelir-Gider Özeti
CREATE OR REPLACE VIEW aylik_gelir_gider_ozet AS
SELECT 
    DATE_TRUNC('month', tarih) as ay,
    SUM(CASE WHEN tip = 'gelir' THEN tutar ELSE 0 END) as toplam_gelir,
    SUM(CASE WHEN tip = 'gider' THEN tutar ELSE 0 END) as toplam_gider,
    SUM(CASE WHEN tip = 'gelir' THEN tutar ELSE -tutar END) as net_kar
FROM gelir_giderler
WHERE durum = 'odendi'
GROUP BY DATE_TRUNC('month', tarih)
ORDER BY ay DESC;

-- Kasa-Banka Güncel Durum
CREATE OR REPLACE VIEW kasa_banka_durum AS
SELECT 
    kbh.*,
    (
        SELECT COUNT(*) 
        FROM kasa_banka_hareketleri 
        WHERE hesap_id = kbh.id 
        AND tarih = CURRENT_DATE
    ) as bugun_hareket_sayisi
FROM kasa_banka_hesaplari kbh
WHERE kbh.aktif = TRUE
ORDER BY kbh.hesap_tipi, kbh.hesap_adi;

-- ====================================================
-- 8. TRIGGER'LAR
-- ====================================================

-- Updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ları oluştur
CREATE TRIGGER update_cariler_updated_at BEFORE UPDATE ON cariler
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stok_kartlari_updated_at BEFORE UPDATE ON stok_kartlari
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_personeller_updated_at BEFORE UPDATE ON personeller
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gelir_giderler_updated_at BEFORE UPDATE ON gelir_giderler
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_kasa_banka_hesaplari_updated_at BEFORE UPDATE ON kasa_banka_hesaplari
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_satin_alma_talepleri_updated_at BEFORE UPDATE ON satin_alma_talepleri
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Stok hareketi sonrası miktar güncelleme
CREATE OR REPLACE FUNCTION update_stok_miktar()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hareket_tipi = 'giris' THEN
        UPDATE stok_kartlari 
        SET miktar = miktar + NEW.miktar 
        WHERE id = NEW.stok_id;
    ELSIF NEW.hareket_tipi = 'cikis' THEN
        UPDATE stok_kartlari 
        SET miktar = miktar - NEW.miktar 
        WHERE id = NEW.stok_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stok_hareket_miktar_guncelle AFTER INSERT ON stok_hareketleri
    FOR EACH ROW EXECUTE FUNCTION update_stok_miktar();

-- Kasa-Banka hareketi sonrası bakiye güncelleme
CREATE OR REPLACE FUNCTION update_kasa_banka_bakiye()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hareket_tipi = 'giris' THEN
        UPDATE kasa_banka_hesaplari 
        SET bakiye = bakiye + NEW.tutar 
        WHERE id = NEW.hesap_id;
        
    ELSIF NEW.hareket_tipi = 'cikis' THEN
        UPDATE kasa_banka_hesaplari 
        SET bakiye = bakiye - NEW.tutar 
        WHERE id = NEW.hesap_id;
        
    ELSIF NEW.hareket_tipi = 'transfer' AND NEW.karsi_hesap_id IS NOT NULL THEN
        UPDATE kasa_banka_hesaplari 
        SET bakiye = bakiye - NEW.tutar 
        WHERE id = NEW.hesap_id;
        
        UPDATE kasa_banka_hesaplari 
        SET bakiye = bakiye + NEW.tutar 
        WHERE id = NEW.karsi_hesap_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kasa_banka_bakiye_guncelle AFTER INSERT ON kasa_banka_hareketleri
    FOR EACH ROW EXECUTE FUNCTION update_kasa_banka_bakiye();

-- ====================================================
-- 9. ROW LEVEL SECURITY (RLS) - Supabase için
-- ====================================================

-- RLS'yi aktif et (Supabase'de otomatik)
ALTER TABLE cariler ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_kartlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_hareketleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE personeller ENABLE ROW LEVEL SECURITY;
ALTER TABLE personel_odemeleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE gelir_giderler ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasa_banka_hesaplari ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasa_banka_hareketleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE satin_alma_talepleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE satin_alma_kalemleri ENABLE ROW LEVEL SECURITY;

-- İlk aşamada tüm kullanıcılara full access (sonra detaylandırılacak)
CREATE POLICY "Enable all access for authenticated users" ON cariler
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON stok_kartlari
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON stok_hareketleri
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON personeller
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON personel_odemeleri
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON gelir_giderler
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON kasa_banka_hesaplari
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON kasa_banka_hareketleri
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON satin_alma_talepleri
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON satin_alma_kalemleri
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ====================================================
-- Migration tamamlandı!
-- ====================================================
