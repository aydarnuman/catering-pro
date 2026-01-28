-- =====================================================
-- FİRMALAR TABLOSU - DİNAMİK EKSTRA ALANLAR
-- Kullanıcının ihtiyacına göre özel alan ekleyebilmesi
-- =====================================================

-- Ekstra alanlar kolonu ekle (eğer yoksa)
ALTER TABLE firmalar 
ADD COLUMN IF NOT EXISTS ekstra_alanlar JSONB DEFAULT '{}'::jsonb;

-- Örnek yapı:
-- {
--   "sgk_sicil_no": "12345678",
--   "kep_adresi": "degsan@kep.tr",
--   "referans_sayisi": 15,
--   "ozel_not": "VIP müşteri"
-- }

-- Ekstra alan şablonları (alan tiplerini tanımlamak için)
CREATE TABLE IF NOT EXISTS firma_alan_sablonlari (
    id SERIAL PRIMARY KEY,
    alan_adi VARCHAR(100) NOT NULL UNIQUE,  -- sgk_sicil_no, kep_adresi
    gorunen_ad VARCHAR(100) NOT NULL,        -- SGK Sicil No, KEP Adresi
    alan_tipi VARCHAR(50) DEFAULT 'text',    -- text, number, date, email, phone, url, textarea
    kategori VARCHAR(50) DEFAULT 'diger',    -- temel, iletisim, resmi, kapasite, diger
    varsayilan_deger TEXT,
    zorunlu BOOLEAN DEFAULT false,
    sira INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

-- Hazır alan şablonları ekle
INSERT INTO firma_alan_sablonlari (alan_adi, gorunen_ad, alan_tipi, kategori, sira) VALUES
('sgk_sicil_no', 'SGK Sicil No', 'text', 'resmi', 1),
('kep_adresi', 'KEP Adresi', 'email', 'iletisim', 2),
('nace_kodu', 'NACE Kodu', 'text', 'resmi', 3),
('faaliyet_kodu', 'Faaliyet Kodu', 'text', 'resmi', 4),
('gunluk_uretim_kapasitesi', 'Günlük Üretim Kapasitesi', 'number', 'kapasite', 5),
('personel_kapasitesi', 'Personel Kapasitesi', 'number', 'kapasite', 6),
('toplam_ciro', 'Toplam Ciro (TL)', 'number', 'mali', 7),
('referans_sayisi', 'Referans Sayısı', 'number', 'referans', 8),
('iso_sertifika_no', 'ISO Sertifika No', 'text', 'sertifika', 9),
('haccp_sertifika_no', 'HACCP Sertifika No', 'text', 'sertifika', 10),
('tse_belge_no', 'TSE Belge No', 'text', 'sertifika', 11),
('halal_sertifika_no', 'Helal Sertifika No', 'text', 'sertifika', 12)
ON CONFLICT (alan_adi) DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_firmalar_ekstra_alanlar ON firmalar USING gin(ekstra_alanlar);
CREATE INDEX IF NOT EXISTS idx_firma_alan_sablonlari_kategori ON firma_alan_sablonlari(kategori);

-- Başarı mesajı
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Firma ekstra alanlar kolonu eklendi!';
    RAISE NOTICE '📋 Özellikler: Dinamik JSONB alanlar, şablon yönetimi';
END $$;
