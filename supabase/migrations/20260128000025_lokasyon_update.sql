-- =============================================
-- 025: Lokasyon tablosu güncellemesi
-- =============================================

-- aciklama ve updated_at sütunlarını ekle
ALTER TABLE demirbas_lokasyonlar 
ADD COLUMN IF NOT EXISTS aciklama TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- updated_at trigger'ı ekle
CREATE OR REPLACE FUNCTION update_lokasyon_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_demirbas_lokasyonlar_timestamp ON demirbas_lokasyonlar;
CREATE TRIGGER update_demirbas_lokasyonlar_timestamp
    BEFORE UPDATE ON demirbas_lokasyonlar
    FOR EACH ROW
    EXECUTE FUNCTION update_lokasyon_timestamp();

-- Migration tamamlandı
COMMENT ON COLUMN demirbas_lokasyonlar.aciklama IS 'Lokasyon açıklaması';
COMMENT ON COLUMN demirbas_lokasyonlar.updated_at IS 'Son güncelleme tarihi';

