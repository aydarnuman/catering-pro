-- Enhanced Notes System / Gelişmiş Not Sistemi
-- Features: Pin, Color, Rich Text, Reminders, Attachments, Tags, Ordering

-- Not ekleri için ayrı tablo
CREATE TABLE IF NOT EXISTS note_attachments (
    id SERIAL PRIMARY KEY,
    note_id VARCHAR(100) NOT NULL, -- Refers to note_xxx ID in JSONB
    tracking_id INTEGER REFERENCES tender_tracking(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id ON note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_note_attachments_tracking ON note_attachments(tracking_id);

-- Not hatırlatıcıları için tablo
CREATE TABLE IF NOT EXISTS note_reminders (
    id SERIAL PRIMARY KEY,
    note_id VARCHAR(100) NOT NULL,
    tracking_id INTEGER REFERENCES tender_tracking(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reminder_date TIMESTAMP NOT NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_reminders_date ON note_reminders(reminder_date) WHERE NOT reminder_sent;
CREATE INDEX IF NOT EXISTS idx_note_reminders_user ON note_reminders(user_id);

-- JSONB user_notes yapısı (referans):
-- {
--   "id": "note_1705590000000",
--   "text": "Markdown destekli metin **kalın** _italik_",
--   "color": "yellow", -- yellow, blue, green, pink, orange, purple
--   "pinned": false,
--   "tags": ["önemli", "acil", "teknik"],
--   "order": 0,
--   "reminder_date": "2026-01-20T10:00:00Z", -- opsiyonel
--   "created_at": "2026-01-18T12:00:00Z",
--   "updated_at": "2026-01-18T12:00:00Z"
-- }

-- Mevcut notları yeni formata migrate et
DO $$
DECLARE
    rec RECORD;
    note JSONB;
    updated_notes JSONB;
    note_order INT;
BEGIN
    FOR rec IN SELECT id, user_notes FROM tender_tracking WHERE user_notes IS NOT NULL AND user_notes != '[]'::jsonb
    LOOP
        updated_notes := '[]'::jsonb;
        note_order := 0;
        
        FOR note IN SELECT * FROM jsonb_array_elements(rec.user_notes)
        LOOP
            -- Eğer yeni alanlar yoksa ekle
            IF NOT note ? 'color' THEN
                note := note || jsonb_build_object(
                    'color', 'yellow',
                    'pinned', false,
                    'tags', '[]'::jsonb,
                    'order', note_order,
                    'updated_at', COALESCE(note->>'created_at', NOW()::text)
                );
            END IF;
            
            updated_notes := updated_notes || jsonb_build_array(note);
            note_order := note_order + 1;
        END LOOP;
        
        UPDATE tender_tracking SET user_notes = updated_notes WHERE id = rec.id;
    END LOOP;
END $$;

-- Etiket listesi için yardımcı view
CREATE OR REPLACE VIEW note_tags_view AS
SELECT DISTINCT jsonb_array_elements_text(elem->'tags') as tag
FROM tender_tracking tt,
     jsonb_array_elements(COALESCE(tt.user_notes, '[]'::jsonb)) elem
WHERE jsonb_typeof(elem->'tags') = 'array';

COMMENT ON TABLE note_attachments IS 'Not ekleri - dosya, resim vb.';
COMMENT ON TABLE note_reminders IS 'Not hatırlatıcıları';
