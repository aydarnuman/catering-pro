-- ====================================================
-- İZİN VE KIDEM YÖNETİMİ
-- Migration - 023
-- ====================================================

-- ====================================================
-- 1. İZİN TÜRLERİ TABLOSU
-- ====================================================
CREATE TABLE IF NOT EXISTS izin_turleri (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(20) UNIQUE NOT NULL,
    ad VARCHAR(100) NOT NULL,
    aciklama TEXT,
    ucretli BOOLEAN DEFAULT TRUE,  -- Ücretli mi?
    yillik_hak INTEGER,            -- Yıllık maksimum gün (NULL = sınırsız)
    belge_gerekli BOOLEAN DEFAULT FALSE,
    renk VARCHAR(20) DEFAULT '#228be6',
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan izin türleri
INSERT INTO izin_turleri (kod, ad, aciklama, ucretli, yillik_hak, belge_gerekli, renk) VALUES
('yillik', 'Yıllık İzin', 'Yasal yıllık ücretli izin', TRUE, NULL, FALSE, '#228be6'),
('ucretsiz', 'Ücretsiz İzin', 'Maaş kesintili izin', FALSE, NULL, TRUE, '#868e96'),
('mazeret', 'Mazeret İzni', 'Günlük mazeret izni', TRUE, 5, FALSE, '#fab005'),
('rapor', 'Sağlık Raporu', 'Doktor raporu ile izin', TRUE, NULL, TRUE, '#fa5252'),
('evlilik', 'Evlilik İzni', '3 gün ücretli evlilik izni', TRUE, 3, TRUE, '#e64980'),
('dogum_anne', 'Doğum İzni (Anne)', '16 hafta analık izni', TRUE, 112, TRUE, '#be4bdb'),
('dogum_baba', 'Doğum İzni (Baba)', '5 gün babalık izni', TRUE, 5, TRUE, '#7950f2'),
('olum', 'Ölüm İzni', '3 gün birinci derece yakın vefatı', TRUE, 3, FALSE, '#495057'),
('askerlik', 'Askerlik', 'Askerlik görevi', FALSE, NULL, TRUE, '#40c057'),
('egitim', 'Eğitim İzni', 'Eğitim/seminer izni', TRUE, NULL, FALSE, '#15aabf')
ON CONFLICT (kod) DO NOTHING;

-- ====================================================
-- 2. İZİN TALEPLERİ TABLOSU
-- ====================================================
CREATE TABLE IF NOT EXISTS izin_talepleri (
    id SERIAL PRIMARY KEY,
    personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
    izin_turu_id INTEGER NOT NULL REFERENCES izin_turleri(id),
    
    -- Tarih bilgileri
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi DATE NOT NULL,
    gun_sayisi INTEGER NOT NULL,
    
    -- Yarım gün desteği
    yarim_gun BOOLEAN DEFAULT FALSE,
    yarim_gun_tipi VARCHAR(10), -- 'sabah' veya 'ogle'
    
    -- Açıklama ve belgeler
    aciklama TEXT,
    belge_url TEXT,
    
    -- Onay süreci
    durum VARCHAR(20) DEFAULT 'beklemede' CHECK (durum IN ('beklemede', 'onaylandi', 'reddedildi', 'iptal')),
    onaylayan_id INTEGER REFERENCES personeller(id),
    onay_tarihi TIMESTAMP,
    red_nedeni TEXT,
    
    -- İzin dönüşü
    donus_tarihi DATE,
    erken_donus BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_izin_personel ON izin_talepleri(personel_id);
CREATE INDEX IF NOT EXISTS idx_izin_tarih ON izin_talepleri(baslangic_tarihi, bitis_tarihi);
CREATE INDEX IF NOT EXISTS idx_izin_durum ON izin_talepleri(durum);
CREATE INDEX IF NOT EXISTS idx_izin_tur ON izin_talepleri(izin_turu_id);

-- ====================================================
-- 3. YILLIK İZİN HAKLARI TABLOSU (Kıdeme göre)
-- ====================================================
CREATE TABLE IF NOT EXISTS yillik_izin_haklari (
    id SERIAL PRIMARY KEY,
    min_kidem_yil INTEGER NOT NULL, -- Minimum kıdem yılı
    max_kidem_yil INTEGER,          -- Maksimum kıdem yılı (NULL = sınırsız)
    izin_gunu INTEGER NOT NULL,     -- Hak edilen gün sayısı
    aciklama VARCHAR(100)
);

-- Yasal yıllık izin hakları
INSERT INTO yillik_izin_haklari (min_kidem_yil, max_kidem_yil, izin_gunu, aciklama) VALUES
(0, 1, 14, '1 yıldan az çalışanlar için'),
(1, 5, 14, '1-5 yıl arası çalışanlar'),
(5, 15, 20, '5-15 yıl arası çalışanlar'),
(15, NULL, 26, '15 yıl üzeri çalışanlar')
ON CONFLICT DO NOTHING;

-- ====================================================
-- 4. İŞTEN ÇIKIŞ KAYITLARI TABLOSU
-- ====================================================
CREATE TABLE IF NOT EXISTS isten_cikis_kayitlari (
    id SERIAL PRIMARY KEY,
    personel_id INTEGER NOT NULL REFERENCES personeller(id),
    
    -- Çıkış bilgileri
    cikis_tarihi DATE NOT NULL,
    cikis_nedeni VARCHAR(50) NOT NULL CHECK (cikis_nedeni IN (
        'istifa', 'isten_cikarma', 'karsilikli_fesih', 
        'emeklilik', 'askerlik', 'vefat', 'sozlesme_bitti', 'diger'
    )),
    cikis_aciklama TEXT,
    
    -- Kıdem bilgileri
    toplam_calisma_gun INTEGER NOT NULL,
    toplam_calisma_yil DECIMAL(10,2) NOT NULL,
    
    -- Tazminat hesaplamaları
    son_brut_maas DECIMAL(15,2) NOT NULL,
    kidem_tazminati_hakki BOOLEAN DEFAULT TRUE,
    kidem_tazminati DECIMAL(15,2) DEFAULT 0,
    
    ihbar_suresi_gun INTEGER DEFAULT 0,
    ihbar_tazminati_hakki BOOLEAN DEFAULT TRUE,
    ihbar_tazminati DECIMAL(15,2) DEFAULT 0,
    
    kullanilmamis_izin_gun INTEGER DEFAULT 0,
    izin_ucreti DECIMAL(15,2) DEFAULT 0,
    
    toplam_tazminat DECIMAL(15,2) DEFAULT 0,
    
    -- Ödeme bilgileri
    odeme_durumu VARCHAR(20) DEFAULT 'beklemede',
    odeme_tarihi DATE,
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cikis_personel ON isten_cikis_kayitlari(personel_id);
CREATE INDEX IF NOT EXISTS idx_cikis_tarih ON isten_cikis_kayitlari(cikis_tarihi);

-- ====================================================
-- 5. KIDEM TAZMİNATI TAVAN TABLOSU
-- ====================================================
CREATE TABLE IF NOT EXISTS kidem_tazminati_tavan (
    id SERIAL PRIMARY KEY,
    yil INTEGER NOT NULL,
    donem INTEGER NOT NULL, -- 1: Ocak-Haziran, 2: Temmuz-Aralık
    tavan_tutar DECIMAL(15,2) NOT NULL,
    
    UNIQUE(yil, donem)
);

-- Kıdem tazminatı tavanları
INSERT INTO kidem_tazminati_tavan (yil, donem, tavan_tutar) VALUES
(2024, 1, 23489.83),
(2024, 2, 35058.58),
(2025, 1, 35058.58),
(2025, 2, 40000.00), -- Tahmini
(2026, 1, 45000.00), -- Tahmini
(2026, 2, 50000.00)  -- Tahmini
ON CONFLICT (yil, donem) DO NOTHING;

-- ====================================================
-- 6. TRIGGER'LAR
-- ====================================================

-- İzin günü otomatik hesaplama
CREATE OR REPLACE FUNCTION hesapla_izin_gunu()
RETURNS TRIGGER AS $$
BEGIN
    -- Gün sayısını hesapla (hafta sonları dahil basit hesaplama)
    NEW.gun_sayisi := NEW.bitis_tarihi - NEW.baslangic_tarihi + 1;
    
    -- Yarım gün ise 0.5 yap
    IF NEW.yarim_gun = TRUE THEN
        NEW.gun_sayisi := 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hesapla_izin_gunu ON izin_talepleri;
CREATE TRIGGER trg_hesapla_izin_gunu
    BEFORE INSERT OR UPDATE ON izin_talepleri
    FOR EACH ROW EXECUTE FUNCTION hesapla_izin_gunu();

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_izin_talepleri_updated_at ON izin_talepleri;
CREATE TRIGGER update_izin_talepleri_updated_at 
    BEFORE UPDATE ON izin_talepleri
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_isten_cikis_updated_at ON isten_cikis_kayitlari;
CREATE TRIGGER update_isten_cikis_updated_at 
    BEFORE UPDATE ON isten_cikis_kayitlari
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====================================================
-- 7. VIEW: Personel İzin Özeti
-- ====================================================
CREATE OR REPLACE VIEW personel_izin_ozeti AS
SELECT 
    p.id as personel_id,
    p.ad,
    p.soyad,
    p.ise_giris_tarihi,
    -- Kıdem yılı hesapla
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.ise_giris_tarihi)) as kidem_yil,
    -- Yıllık izin hakkı
    COALESCE(
        (SELECT izin_gunu FROM yillik_izin_haklari yih
         WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.ise_giris_tarihi)) >= yih.min_kidem_yil
         AND (yih.max_kidem_yil IS NULL OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.ise_giris_tarihi)) < yih.max_kidem_yil)
         LIMIT 1),
        14
    ) as yillik_izin_hakki,
    -- Bu yıl kullanılan yıllık izin
    COALESCE(
        (SELECT SUM(it.gun_sayisi) 
         FROM izin_talepleri it
         JOIN izin_turleri itur ON itur.id = it.izin_turu_id
         WHERE it.personel_id = p.id 
         AND itur.kod = 'yillik'
         AND it.durum = 'onaylandi'
         AND EXTRACT(YEAR FROM it.baslangic_tarihi) = EXTRACT(YEAR FROM CURRENT_DATE)),
        0
    ) as kullanilan_yillik_izin,
    -- Toplam izin kullanımı (bu yıl)
    COALESCE(
        (SELECT SUM(gun_sayisi) FROM izin_talepleri 
         WHERE personel_id = p.id 
         AND durum = 'onaylandi'
         AND EXTRACT(YEAR FROM baslangic_tarihi) = EXTRACT(YEAR FROM CURRENT_DATE)),
        0
    ) as toplam_izin_bu_yil,
    -- Bekleyen talepler
    (SELECT COUNT(*) FROM izin_talepleri WHERE personel_id = p.id AND durum = 'beklemede') as bekleyen_talep
FROM personeller p
WHERE p.isten_cikis_tarihi IS NULL;

-- ====================================================
-- 8. ROW LEVEL SECURITY
-- ====================================================

ALTER TABLE izin_turleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE izin_talepleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE yillik_izin_haklari ENABLE ROW LEVEL SECURITY;
ALTER TABLE isten_cikis_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE kidem_tazminati_tavan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON izin_turleri;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON izin_talepleri;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON yillik_izin_haklari;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON isten_cikis_kayitlari;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON kidem_tazminati_tavan;

CREATE POLICY "Enable all access for authenticated users" ON izin_turleri FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Enable all access for authenticated users" ON izin_talepleri FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Enable all access for authenticated users" ON yillik_izin_haklari FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Enable all access for authenticated users" ON isten_cikis_kayitlari FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Enable all access for authenticated users" ON kidem_tazminati_tavan FOR ALL USING (auth.uid() IS NOT NULL);

-- ====================================================
-- Migration tamamlandı!
-- ====================================================

