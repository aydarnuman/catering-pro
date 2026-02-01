-- Firma Döküman Yönetimi ve AI Analiz Sistemi
-- Migration 057

-- 1. firma_dokumanlari tablosu
CREATE TABLE IF NOT EXISTS firma_dokumanlari (
    id SERIAL PRIMARY KEY,
    firma_id INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    
    -- Belge bilgileri
    belge_tipi VARCHAR(50) NOT NULL, -- vergi_levhasi, sicil_gazetesi, imza_sirküleri, vekaletname, iso_sertifika vs.
    belge_kategori VARCHAR(50) NOT NULL DEFAULT 'kurumsal', -- kurumsal, yetki, mali, sertifika, referans
    dosya_adi VARCHAR(255) NOT NULL,
    dosya_url TEXT NOT NULL,
    dosya_boyutu INTEGER,
    mime_type VARCHAR(100),
    
    -- Belge detayları
    belge_no VARCHAR(100), -- Belge/sertifika numarası
    verilis_tarihi DATE,
    gecerlilik_tarihi DATE,
    veren_kurum VARCHAR(255),
    aciklama TEXT,
    
    -- AI analiz sonuçları
    ai_analiz_yapildi BOOLEAN DEFAULT FALSE,
    ai_analiz_tarihi TIMESTAMP,
    ai_cikartilan_veriler JSONB DEFAULT '{}', -- AI'ın çıkardığı tüm veriler
    ai_guven_skoru DECIMAL(5,2), -- 0-100 arası güven skoru
    ai_uygulanacak_alanlar JSONB DEFAULT '[]', -- Firmaya uygulanabilecek alanlar
    ai_hata_mesaji TEXT,
    
    -- Meta bilgiler
    yukleyen_id INTEGER,
    onay_durumu VARCHAR(20) DEFAULT 'bekliyor', -- bekliyor, onaylandi, reddedildi
    onaylayan_id INTEGER,
    onay_tarihi TIMESTAMP,
    
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. firma_dokuman_uygulamalari - AI ile uygulanmış değişiklikler
CREATE TABLE IF NOT EXISTS firma_dokuman_uygulamalari (
    id SERIAL PRIMARY KEY,
    firma_id INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    dokuman_id INTEGER NOT NULL REFERENCES firma_dokumanlari(id) ON DELETE CASCADE,
    
    -- Uygulanan değişiklik
    alan_adi VARCHAR(100) NOT NULL, -- unvan, vergi_no, yetkili_adi vs.
    eski_deger TEXT,
    yeni_deger TEXT,
    
    -- Uygulama bilgileri
    uygulayan_id INTEGER,
    uygulama_tarihi TIMESTAMP DEFAULT NOW(),
    otomatik BOOLEAN DEFAULT FALSE, -- Otomatik mi kullanıcı onaylı mı
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Belge tipi enum listesi (referans için view)
CREATE OR REPLACE VIEW v_firma_belge_tipleri AS
SELECT * FROM (VALUES
    -- Kurumsal Belgeler
    ('vergi_levhasi', 'Vergi Levhası', 'kurumsal', TRUE),
    ('sicil_gazetesi', 'Ticaret Sicil Gazetesi', 'kurumsal', TRUE),
    ('faaliyet_belgesi', 'Faaliyet Belgesi / Oda Kayıt', 'kurumsal', TRUE),
    ('imza_sirkuleri', 'İmza Sirküleri', 'kurumsal', TRUE),
    ('kapasite_raporu', 'Kapasite Raporu', 'kurumsal', FALSE),
    
    -- Yetki Belgeleri
    ('vekaletname', 'Vekaletname', 'yetki', FALSE),
    ('yetki_belgesi', 'Yetki Belgesi', 'yetki', FALSE),
    ('temsil_ilmuhaberi', 'Temsil İlmühaberi', 'yetki', FALSE),
    
    -- Mali Belgeler
    ('sgk_borcu_yoktur', 'SGK Borcu Yoktur Belgesi', 'mali', FALSE),
    ('vergi_borcu_yoktur', 'Vergi Borcu Yoktur Belgesi', 'mali', FALSE),
    ('bilanco', 'Bilanço', 'mali', FALSE),
    ('gelir_tablosu', 'Gelir Tablosu', 'mali', FALSE),
    
    -- Sertifikalar
    ('iso_9001', 'ISO 9001 Kalite Yönetim', 'sertifika', TRUE),
    ('iso_22000', 'ISO 22000 Gıda Güvenliği', 'sertifika', TRUE),
    ('haccp', 'HACCP Sertifikası', 'sertifika', TRUE),
    ('tse', 'TSE Belgesi', 'sertifika', TRUE),
    ('halal', 'Helal Sertifikası', 'sertifika', FALSE),
    ('gida_uretim_izni', 'Gıda Üretim İzin Belgesi', 'sertifika', FALSE),
    ('isletme_kayit', 'İşletme Kayıt Belgesi', 'sertifika', FALSE),
    
    -- Referans ve İş Deneyim
    ('is_deneyim', 'İş Deneyim Belgesi', 'referans', FALSE),
    ('referans_mektup', 'Referans Mektubu', 'referans', FALSE),
    ('sozlesme_sureti', 'Sözleşme Sureti', 'referans', FALSE),
    
    -- Diğer
    ('diger', 'Diğer Belgeler', 'diger', FALSE)
) AS t(tip, ad, kategori, ai_destekli);

-- 4. Firma döküman özet view
CREATE OR REPLACE VIEW v_firma_dokuman_ozet AS
SELECT 
    f.id as firma_id,
    f.unvan as firma_unvan,
    COUNT(fd.id) as toplam_dokuman,
    COUNT(fd.id) FILTER (WHERE fd.belge_kategori = 'kurumsal') as kurumsal_belge_sayisi,
    COUNT(fd.id) FILTER (WHERE fd.belge_kategori = 'sertifika') as sertifika_sayisi,
    COUNT(fd.id) FILTER (WHERE fd.ai_analiz_yapildi = TRUE) as ai_analiz_yapilan,
    COUNT(fd.id) FILTER (WHERE fd.gecerlilik_tarihi < CURRENT_DATE) as suresi_dolmus,
    COUNT(fd.id) FILTER (WHERE fd.gecerlilik_tarihi BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') as yakinda_dolacak,
    MAX(fd.created_at) as son_yuklenme
FROM firmalar f
LEFT JOIN firma_dokumanlari fd ON f.id = fd.firma_id AND fd.aktif = TRUE
GROUP BY f.id, f.unvan;

-- 5. Index'ler
CREATE INDEX IF NOT EXISTS idx_firma_dokumanlari_firma ON firma_dokumanlari(firma_id);
CREATE INDEX IF NOT EXISTS idx_firma_dokumanlari_tip ON firma_dokumanlari(belge_tipi);
CREATE INDEX IF NOT EXISTS idx_firma_dokumanlari_kategori ON firma_dokumanlari(belge_kategori);
CREATE INDEX IF NOT EXISTS idx_firma_dokumanlari_gecerlilik ON firma_dokumanlari(gecerlilik_tarihi);
CREATE INDEX IF NOT EXISTS idx_firma_dokuman_uygulamalari_firma ON firma_dokuman_uygulamalari(firma_id);
CREATE INDEX IF NOT EXISTS idx_firma_dokuman_uygulamalari_dokuman ON firma_dokuman_uygulamalari(dokuman_id);

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION update_firma_dokumanlari_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_firma_dokumanlari_timestamp ON firma_dokumanlari;
CREATE TRIGGER update_firma_dokumanlari_timestamp
    BEFORE UPDATE ON firma_dokumanlari
    FOR EACH ROW
    EXECUTE FUNCTION update_firma_dokumanlari_timestamp();

COMMENT ON TABLE firma_dokumanlari IS 'Firma belgeleri - AI analizi ile otomatik veri çıkarma destekli';
COMMENT ON TABLE firma_dokuman_uygulamalari IS 'AI analiz sonuçlarının firmaya uygulanma geçmişi';
