-- Add teknik_sart_sayisi and birim_fiyat_sayisi columns to tender_tracking
ALTER TABLE tender_tracking 
ADD COLUMN IF NOT EXISTS teknik_sart_sayisi INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS birim_fiyat_sayisi INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN tender_tracking.teknik_sart_sayisi IS 'Number of technical requirements extracted from analysis';
COMMENT ON COLUMN tender_tracking.birim_fiyat_sayisi IS 'Number of unit prices extracted from analysis';
