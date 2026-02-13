-- AI Learning Systems Migration
-- ================================
-- 1. Ihale sonuç takibi (kazanılan/kaybedilen)
-- 2. Agent analiz feedback (risk skoru doğruluğu)
-- 3. Pipeline öğrenme tablosu (correction patterns)
-- 4. Cross-agent öğrenme tablosu (shared learnings)

-- ═══════════════════════════════════════════════════════════════
-- 1. İHALE SONUÇ TAKİBİ — Gerçek sonuçları kaydederek ajanların öğrenmesini sağla
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tender_outcomes (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'cancelled', 'no_bid')),
  our_bid_amount NUMERIC(15,2),
  winning_bid_amount NUMERIC(15,2),
  winner_company TEXT,
  reason TEXT,                        -- Neden kazandık/kaybettik?
  lessons_learned TEXT,               -- Alınan dersler
  agent_verdict TEXT,                 -- AI'ın verdigi go/caution/dont-bid kararı
  agent_risk_scores JSONB DEFAULT '{}', -- {mevzuat: 45, maliyet: 60, teknik: 30, rekabet: 55}
  actual_profit_margin NUMERIC(5,2),  -- Gerçek kar marjı (kazanıldıysa)
  metadata JSONB DEFAULT '{}',
  created_by TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id)
);

CREATE INDEX IF NOT EXISTS idx_tender_outcomes_outcome ON tender_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_tender_outcomes_created ON tender_outcomes(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 2. PIPELINE ÖĞRENME — Sık tekrarlayan extraction hata pattern'leri
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pipeline_learned_patterns (
  id SERIAL PRIMARY KEY,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('correction', 'format', 'terminology', 'institution')),
  field_name TEXT NOT NULL,           -- Hangi alan hatalıydı (tarih, tutar, personel vb.)
  wrong_pattern TEXT,                 -- AI'ın yanlış çıkardığı
  correct_pattern TEXT NOT NULL,      -- Doğru olan
  frequency INTEGER DEFAULT 1,       -- Kaç kez tekrarlandı
  source_institution TEXT,            -- Kurum bazlı pattern (opsiyonel)
  confidence NUMERIC(3,2) DEFAULT 0.7,
  is_active BOOLEAN DEFAULT true,
  prompt_type TEXT,                   -- Hangi prompt'a eklenmeli (extract-dates, extract-amounts vb.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_name, wrong_pattern, correct_pattern)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_patterns_active ON pipeline_learned_patterns(is_active, field_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_patterns_type ON pipeline_learned_patterns(pattern_type);

-- ═══════════════════════════════════════════════════════════════
-- 3. CROSS-AGENT ÖĞRENME — Ajanlar arası bilgi paylaşımı
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shared_learnings (
  id SERIAL PRIMARY KEY,
  source_agent TEXT NOT NULL,         -- Öğrenen ajan (main, mevzuat, maliyet, teknik, rekabet, pipeline)
  target_agents TEXT[] DEFAULT '{}',  -- Hedef ajanlar (boş = tümü)
  learning_type TEXT NOT NULL CHECK (learning_type IN ('fact', 'pattern', 'correction', 'insight')),
  category TEXT NOT NULL,             -- ihale, fatura, personel, stok, genel, mevzuat
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_agent, learning_type, key)
);

CREATE INDEX IF NOT EXISTS idx_shared_learnings_active ON shared_learnings(is_active, category);
CREATE INDEX IF NOT EXISTS idx_shared_learnings_target ON shared_learnings USING gin(target_agents);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_tender_outcomes_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tender_outcomes_updated_at
  BEFORE UPDATE ON tender_outcomes
  FOR EACH ROW EXECUTE FUNCTION update_tender_outcomes_updated_at();

CREATE OR REPLACE FUNCTION update_pipeline_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pipeline_patterns_updated_at
  BEFORE UPDATE ON pipeline_learned_patterns
  FOR EACH ROW EXECUTE FUNCTION update_pipeline_patterns_updated_at();

CREATE OR REPLACE FUNCTION update_shared_learnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shared_learnings_updated_at
  BEFORE UPDATE ON shared_learnings
  FOR EACH ROW EXECUTE FUNCTION update_shared_learnings_updated_at();

-- Upsert: frequency++ on conflict
CREATE OR REPLACE FUNCTION upsert_pipeline_pattern(
  p_type TEXT, p_field TEXT, p_wrong TEXT, p_correct TEXT, p_institution TEXT DEFAULT NULL, p_prompt_type TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO pipeline_learned_patterns (pattern_type, field_name, wrong_pattern, correct_pattern, source_institution, prompt_type)
  VALUES (p_type, p_field, p_wrong, p_correct, p_institution, p_prompt_type)
  ON CONFLICT (field_name, wrong_pattern, correct_pattern)
  DO UPDATE SET
    frequency = pipeline_learned_patterns.frequency + 1,
    confidence = LEAST(0.99, pipeline_learned_patterns.confidence + 0.05),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE tender_outcomes IS 'İhale sonuçları — kazanılan/kaybedilen + gerçek sonuç verileri';
COMMENT ON TABLE pipeline_learned_patterns IS 'Dokuman pipeline öğrenme — sık tekrarlayan extraction hata pattern''leri';
COMMENT ON TABLE shared_learnings IS 'Ajanlar arası öğrenme — cross-agent bilgi paylaşımı';
