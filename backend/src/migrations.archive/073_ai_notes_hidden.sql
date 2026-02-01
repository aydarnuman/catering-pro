-- AI Notları için gizleme/onaylama sistemi
-- Kullanıcı tarafından silinen (gizlenen) notları tutar

-- tender_tracking tablosuna hidden_notes kolonu ekle
ALTER TABLE tender_tracking 
ADD COLUMN IF NOT EXISTS hidden_notes JSONB DEFAULT '[]'::jsonb;

-- Yorum: hidden_notes array formatında not ID'lerini tutar
-- Örnek: ["note_123_1", "note_456_2"]

-- İndeks ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_tender_tracking_hidden_notes 
ON tender_tracking USING gin(hidden_notes);

COMMENT ON COLUMN tender_tracking.hidden_notes IS 'Kullanıcı tarafından gizlenen AI notlarının ID listesi';
