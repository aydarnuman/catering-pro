-- İhale Masası Oturum Kayıtları
CREATE TABLE IF NOT EXISTS ihale_masasi_sessions (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  user_id TEXT DEFAULT 'default',
  session_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ihale_masasi_sessions_tender ON ihale_masasi_sessions(tender_id);

COMMENT ON TABLE ihale_masasi_sessions IS 'Sanal İhale Masası oturum kayıtları';
