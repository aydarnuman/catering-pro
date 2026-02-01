-- ====================================================
-- PERSONEL YÖNETİMİ - PROJE BAZLI SİSTEM
-- Migration - 021
-- ====================================================

-- ====================================================
-- 1. PROJELER TABLOSU
-- ====================================================
CREATE TABLE IF NOT EXISTS projeler (
    id SERIAL PRIMARY KEY,
    ad VARCHAR(255) NOT NULL,
    kod VARCHAR(50) UNIQUE,
    aciklama TEXT,
    
    -- Proje detayları
    musteri VARCHAR(255),
    lokasyon VARCHAR(255),
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    
    -- Durum
    durum VARCHAR(20) DEFAULT 'aktif' CHECK (durum IN ('aktif', 'pasif', 'tamamlandi', 'beklemede')),
    
    -- Mali bilgiler
    butce DECIMAL(15,2) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projeler_durum ON projeler(durum);
CREATE INDEX IF NOT EXISTS idx_projeler_ad ON projeler(ad);

-- ====================================================
-- 2. PROJE_PERSONELLERI TABLOSU (Many-to-Many ilişki)
-- ====================================================
CREATE TABLE IF NOT EXISTS proje_personelleri (
    id SERIAL PRIMARY KEY,
    proje_id INTEGER NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
    personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
    
    -- Görevlendirme detayları
    gorev VARCHAR(100),
    baslangic_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
    bitis_tarihi DATE,
    
    -- Durum
    aktif BOOLEAN DEFAULT TRUE,
    notlar TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proje_personel_proje ON proje_personelleri(proje_id);
CREATE INDEX IF NOT EXISTS idx_proje_personel_personel ON proje_personelleri(personel_id);
CREATE INDEX IF NOT EXISTS idx_proje_personel_aktif ON proje_personelleri(aktif);

-- ====================================================
-- 3. PERSONELLER TABLOSUNA YENİ KOLONLAR EKLE
-- ====================================================

-- Acil durum bilgileri
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS acil_kisi VARCHAR(100);
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS acil_telefon VARCHAR(50);

-- Durum alanı
ALTER TABLE personeller ADD COLUMN IF NOT EXISTS durum VARCHAR(20) DEFAULT 'aktif';

-- ====================================================
-- 4. TRIGGER'LAR
-- ====================================================

-- Updated_at otomatik güncelleme (projeler için)
DROP TRIGGER IF EXISTS update_projeler_updated_at ON projeler;
CREATE TRIGGER update_projeler_updated_at 
    BEFORE UPDATE ON projeler
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Updated_at otomatik güncelleme (proje_personelleri için)
DROP TRIGGER IF EXISTS update_proje_personelleri_updated_at ON proje_personelleri;
CREATE TRIGGER update_proje_personelleri_updated_at 
    BEFORE UPDATE ON proje_personelleri
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====================================================
-- 5. ROW LEVEL SECURITY
-- ====================================================

ALTER TABLE projeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE proje_personelleri ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON projeler;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON proje_personelleri;

-- Full access policy (authenticated users)
CREATE POLICY "Enable all access for authenticated users" ON projeler
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all access for authenticated users" ON proje_personelleri
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ====================================================
-- 6. GÖRÜNÜMLER
-- ====================================================

-- Proje ile personel sayısı görünümü
CREATE OR REPLACE VIEW proje_ozet AS
SELECT 
    p.*,
    COALESCE((SELECT COUNT(*) FROM proje_personelleri pp WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as personel_sayisi,
    COALESCE((SELECT SUM(per.maas) FROM proje_personelleri pp 
              JOIN personeller per ON per.id = pp.personel_id 
              WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as toplam_maas
FROM projeler p;

-- Personel proje görünümü
CREATE OR REPLACE VIEW personel_projeler_view AS
SELECT 
    per.*,
    COALESCE(
        json_agg(
            json_build_object(
                'proje_id', p.id,
                'proje_ad', p.ad,
                'proje_kod', p.kod,
                'gorev', pp.gorev,
                'baslangic_tarihi', pp.baslangic_tarihi,
                'bitis_tarihi', pp.bitis_tarihi
            )
        ) FILTER (WHERE p.id IS NOT NULL AND pp.aktif = TRUE),
        '[]'::json
    ) as projeler
FROM personeller per
LEFT JOIN proje_personelleri pp ON pp.personel_id = per.id AND pp.aktif = TRUE
LEFT JOIN projeler p ON p.id = pp.proje_id
GROUP BY per.id;

-- ====================================================
-- Migration tamamlandı!
-- ====================================================
