-- Zeyilname ve Düzeltme İlanı içerik kolonları
-- Bu içerikler ihalebul.com'dan sayfa içi olarak çekiliyor

-- Zeyilname içeriği (JSON veya text)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS zeyilname_content JSONB;

-- Düzeltme İlanı içeriği (JSON veya text)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS correction_notice_content JSONB;

-- İhale güncellenmiş mi? (Düzeltme ilanı veya zeyilname varsa true)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_updated BOOLEAN DEFAULT FALSE;

-- Güncelleme tarihi (son düzeltme/zeyilname tarihi)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS last_update_date TIMESTAMP;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_tenders_is_updated ON tenders(is_updated) WHERE is_updated = true;

-- Mevcut verileri güncelle (düzeltme ilanı veya zeyilname varsa is_updated = true)
UPDATE tenders 
SET is_updated = true 
WHERE title ILIKE '%güncellendi%' 
   OR title ILIKE '%düzeltme%'
   OR title ILIKE '%zeyilname%';

COMMENT ON COLUMN tenders.zeyilname_content IS 'Zeyilname içeriği - ihalebul.com sayfa içi';
COMMENT ON COLUMN tenders.correction_notice_content IS 'Düzeltme İlanı içeriği - ihalebul.com sayfa içi';
COMMENT ON COLUMN tenders.is_updated IS 'İhale güncellenmiş mi (düzeltme/zeyilname var)';
COMMENT ON COLUMN tenders.last_update_date IS 'Son güncelleme tarihi';
