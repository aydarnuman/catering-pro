-- Agent Analyses: AI tarafından üretilen ihale analiz sonuçları
-- Her agent (mevzuat, maliyet, teknik, rekabet) ayrı analiz kaydı oluşturur

CREATE TABLE IF NOT EXISTS agent_analyses (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('mevzuat', 'maliyet', 'teknik', 'rekabet')),
  findings JSONB NOT NULL DEFAULT '[]',
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'complete', 'error')),
  key_risks TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  ai_model TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  analysis_version INTEGER DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, agent_id, analysis_version)
);

CREATE INDEX idx_agent_analyses_tender ON agent_analyses(tender_id);
CREATE INDEX idx_agent_analyses_status ON agent_analyses(status);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_agent_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_analyses_updated_at
  BEFORE UPDATE ON agent_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_analyses_updated_at();

COMMENT ON TABLE agent_analyses IS 'Sanal İhale Masası — Agent bazlı AI analiz sonuçları';
