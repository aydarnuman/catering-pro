-- =====================================================
-- FİRMALAR TABLOSU
-- Kendi şirket bilgileri (ihale dilekçeleri için)
-- =====================================================

CREATE TABLE IF NOT EXISTS firmalar (
    id SERIAL PRIMARY KEY,
    
    -- Temel Bilgiler
    unvan VARCHAR(255) NOT NULL,
    kisa_ad VARCHAR(100),
    vergi_dairesi VARCHAR(100),
    vergi_no VARCHAR(20) UNIQUE,
    ticaret_sicil_no VARCHAR(50),
    mersis_no VARCHAR(20),
    
    -- İletişim
    adres TEXT,
    il VARCHAR(50),
    ilce VARCHAR(50),
    posta_kodu VARCHAR(10),
    telefon VARCHAR(50),
    fax VARCHAR(50),
    email VARCHAR(100),
    web_sitesi VARCHAR(255),
    
    -- Yetkili Kişi Bilgileri
    yetkili_adi VARCHAR(100),
    yetkili_unvani VARCHAR(100),  -- Genel Müdür, Şirket Müdürü vs
    yetkili_tc VARCHAR(11),
    yetkili_telefon VARCHAR(50),
    yetkili_email VARCHAR(100),
    imza_yetkisi TEXT,  -- "Münferiden imza yetkisi" vs
    
    -- Banka Bilgileri
    banka_adi VARCHAR(100),
    banka_sube VARCHAR(100),
    iban VARCHAR(34),
    hesap_no VARCHAR(50),
    
    -- Belgeler (dosya yolları)
    vergi_levhasi_url TEXT,
    vergi_levhasi_tarih DATE,
    sicil_gazetesi_url TEXT,
    sicil_gazetesi_tarih DATE,
    imza_sirküleri_url TEXT,
    imza_sirküleri_tarih DATE,
    faaliyet_belgesi_url TEXT,
    faaliyet_belgesi_tarih DATE,
    iso_sertifika_url TEXT,
    iso_sertifika_tarih DATE,
    
    -- Ek Belgeler (JSON array)
    ek_belgeler JSONB DEFAULT '[]'::jsonb,
    -- Örnek: [{"ad": "TSE Belgesi", "url": "/uploads/...", "tarih": "2024-01-01"}]
    
    -- Meta
    varsayilan BOOLEAN DEFAULT false,
    aktif BOOLEAN DEFAULT true,
    notlar TEXT,
    
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_firmalar_vergi_no ON firmalar(vergi_no);
CREATE INDEX IF NOT EXISTS idx_firmalar_varsayilan ON firmalar(varsayilan);
CREATE INDEX IF NOT EXISTS idx_firmalar_aktif ON firmalar(aktif);

-- Varsayılan firma kontrolü (sadece bir tane varsayılan olabilir)
CREATE OR REPLACE FUNCTION check_varsayilan_firma()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.varsayilan = true THEN
        UPDATE firmalar SET varsayilan = false WHERE id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_varsayilan_firma ON firmalar;
CREATE TRIGGER trg_varsayilan_firma
    BEFORE INSERT OR UPDATE ON firmalar
    FOR EACH ROW
    WHEN (NEW.varsayilan = true)
    EXECUTE FUNCTION check_varsayilan_firma();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_firmalar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_firmalar_updated ON firmalar;
CREATE TRIGGER trg_firmalar_updated
    BEFORE UPDATE ON firmalar
    FOR EACH ROW
    EXECUTE FUNCTION update_firmalar_timestamp();

-- Başarı mesajı
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Firmalar tablosu oluşturuldu!';
    RAISE NOTICE '📋 Özellikler: Vergi levhası, sicil gazetesi, imza sirküsü upload desteği';
END $$;
