-- =====================================================
-- Tenders tablosuna yüklenici/sonuçlanma bilgileri ekle
-- list-scraper.js bu kolonlara yazar, contractors.js bu kolonlardan okur
-- =====================================================

-- Yüklenici adı (sonuçlanan ihalelerde kazanan firma)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS yuklenici_adi TEXT;

-- Sözleşme bedeli (₺)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS sozlesme_bedeli NUMERIC(15,2);

-- İndirim oranı (%)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS indirim_orani NUMERIC(5,2);

-- Sözleşme tarihi
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS sozlesme_tarihi DATE;

-- İş başlangıç tarihi
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS work_start_date DATE;

-- İş bitiş tarihi
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_bitis_tarihi DATE;

-- Yüklenici FK (yukleniciler tablosuna)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS yuklenici_id INTEGER REFERENCES yukleniciler(id) ON DELETE SET NULL;

-- === İndeksler ===
CREATE INDEX IF NOT EXISTS idx_tenders_yuklenici_adi ON tenders(yuklenici_adi) WHERE yuklenici_adi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenders_yuklenici_id ON tenders(yuklenici_id) WHERE yuklenici_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenders_sozlesme_bedeli ON tenders(sozlesme_bedeli) WHERE sozlesme_bedeli IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenders_sozlesme_tarihi ON tenders(sozlesme_tarihi) WHERE sozlesme_tarihi IS NOT NULL;

COMMENT ON COLUMN tenders.yuklenici_adi IS 'Sonuçlanan ihalelerde kazanan yüklenici firma adı (ihalebul.com''dan çekilir)';
COMMENT ON COLUMN tenders.yuklenici_id IS 'Yüklenici kütüphanesindeki firma referansı (seed/scraper tarafından eşleştirilir)';
