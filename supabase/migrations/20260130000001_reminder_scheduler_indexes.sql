-- =====================================================
-- Reminder Notification Scheduler Indexes
-- Vade bildirimi scheduler'ı için optimize edilmiş index'ler
-- =====================================================

-- 1. Bildirim duplicate kontrolü için index
-- metadata->>'notification_key' ile hızlı sorgu
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_key
ON notifications ((metadata->>'notification_key'))
WHERE metadata->>'notification_key' IS NOT NULL;

-- 2. Vadesi yaklaşan notlar için index
-- Tamamlanmamış ve vadesi olan notları hızlı bulmak için
CREATE INDEX IF NOT EXISTS idx_unified_notes_due_soon
ON unified_notes(due_date)
WHERE due_date IS NOT NULL AND is_completed = FALSE;

-- 3. Bekleyen çek/senet vade sorgusu için index
-- Sadece 'beklemede' durumundaki kayıtlar için partial index
CREATE INDEX IF NOT EXISTS idx_cek_senet_vade_beklemede
ON cek_senetler(vade_tarihi)
WHERE durum = 'beklemede';

-- 4. Vadesi geçmiş çek/senet sorgusu için ek index
CREATE INDEX IF NOT EXISTS idx_cek_senet_overdue
ON cek_senetler(vade_tarihi, durum)
WHERE durum = 'beklemede' AND vade_tarihi < CURRENT_DATE;

-- Yorumlar
COMMENT ON INDEX idx_notifications_metadata_key IS 'Duplicate bildirim kontrolü için notification_key index';
COMMENT ON INDEX idx_unified_notes_due_soon IS 'Vadesi yaklaşan notlar için optimize edilmiş index';
COMMENT ON INDEX idx_cek_senet_vade_beklemede IS 'Bekleyen çek/senet vade sorguları için index';
COMMENT ON INDEX idx_cek_senet_overdue IS 'Vadesi geçmiş çek/senet sorguları için index';
