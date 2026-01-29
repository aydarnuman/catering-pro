-- Notlar: sabitlenen (pinned) ve ajanda için sıralama desteği
ALTER TABLE notlar ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_notlar_pinned ON notlar(pinned) WHERE pinned = TRUE;

COMMENT ON COLUMN notlar.pinned IS 'Sabitlenen notlar önce listelenir; ajanda + pin widget için kullanılır';
