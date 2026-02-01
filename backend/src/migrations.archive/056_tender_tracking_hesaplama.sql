-- =====================================================
-- Migration: 056_tender_tracking_hesaplama.sql
-- Açıklama: İhale Uzmanı hesaplama verilerini kalıcı tutmak için
-- Tarih: 2026-01-15
-- =====================================================

-- Yaklaşık maliyet (idarenin belirlediği tutar)
ALTER TABLE tender_tracking 
ADD COLUMN IF NOT EXISTS yaklasik_maliyet DECIMAL(15,2);

-- Sınır değer (hesaplanan veya manuel girilen)
ALTER TABLE tender_tracking 
ADD COLUMN IF NOT EXISTS sinir_deger DECIMAL(15,2);

-- Firmamızın teklifi
ALTER TABLE tender_tracking 
ADD COLUMN IF NOT EXISTS bizim_teklif DECIMAL(15,2);

-- Tüm hesaplama verilerini tutan JSON alan
-- Örnek içerik:
-- {
--   "teklif_listesi": [1000000, 950000, 1100000],
--   "asiri_dusuk": { "ana_girdi": 500000, "iscilik": 300000, "toplam": 900000 },
--   "sure_hesaplama": { "teblig_tarihi": "2026-01-15", "basvuru_turu": "sikayet" },
--   "son_hesaplama_tarihi": "2026-01-15T10:30:00Z"
-- }
ALTER TABLE tender_tracking 
ADD COLUMN IF NOT EXISTS hesaplama_verileri JSONB DEFAULT '{}';

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_tender_tracking_yaklasik_maliyet 
ON tender_tracking(yaklasik_maliyet) WHERE yaklasik_maliyet IS NOT NULL;

-- Comment
COMMENT ON COLUMN tender_tracking.yaklasik_maliyet IS 'İdarenin belirlediği yaklaşık maliyet tutarı (TL)';
COMMENT ON COLUMN tender_tracking.sinir_deger IS 'Hesaplanan veya manuel girilen sınır değer (TL)';
COMMENT ON COLUMN tender_tracking.bizim_teklif IS 'Firmamızın teklif tutarı (TL)';
COMMENT ON COLUMN tender_tracking.hesaplama_verileri IS 'Tüm hesaplama verilerini tutan JSON alan';
