-- Tracker sheets persistence (previously localStorage only)
CREATE TABLE IF NOT EXISTS tracker_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracker_sheets_user ON tracker_sheets(user_id);

-- Each user has exactly one row (their sheets array)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracker_sheets_user_unique ON tracker_sheets(user_id);

-- RLS
ALTER TABLE tracker_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracker_sheets_user_policy ON tracker_sheets
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::integer);
