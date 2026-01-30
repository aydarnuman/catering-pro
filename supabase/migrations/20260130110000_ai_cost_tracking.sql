-- =====================================================
-- AI COST TRACKING SYSTEM
-- Claude API kullanım ve maliyet takibi
-- =====================================================

-- AI Kullanım Tracking Tablosu
CREATE TABLE IF NOT EXISTS ai_usage_tracking (
  id SERIAL PRIMARY KEY,

  -- Kullanıcı ve Endpoint bilgileri
  user_id VARCHAR(255) DEFAULT 'default',
  endpoint VARCHAR(100) NOT NULL, -- '/api/ai/chat', '/api/ai/agent', etc.
  session_id VARCHAR(255),

  -- Model bilgileri
  model VARCHAR(100) NOT NULL, -- 'claude-sonnet-4-20250514', etc.
  prompt_template VARCHAR(100), -- 'default', 'cfo-analiz', etc.

  -- Token kullanımı
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- Maliyet hesaplama (USD)
  input_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  output_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  total_cost_usd DECIMAL(10,6) GENERATED ALWAYS AS (input_cost_usd + output_cost_usd) STORED,

  -- TL cinsinden maliyet (güncel kur: ~33.5)
  total_cost_tl DECIMAL(10,2) GENERATED ALWAYS AS ((input_cost_usd + output_cost_usd) * 33.5) STORED,

  -- Metadata
  tools_used JSONB DEFAULT '[]', -- Kullanılan tool'ların listesi
  response_time_ms INTEGER, -- Yanıt süresi (milisaniye)
  success BOOLEAN DEFAULT true, -- İstek başarılı mı?
  error_message TEXT, -- Hata mesajı (varsa)

  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performans indexleri
CREATE INDEX IF NOT EXISTS idx_usage_tracking_created ON ai_usage_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON ai_usage_tracking(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_endpoint ON ai_usage_tracking(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_model ON ai_usage_tracking(model);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_session ON ai_usage_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_date ON ai_usage_tracking(DATE(created_at));

-- =====================================================
-- VIEWS: Hızlı Raporlama
-- =====================================================

-- Günlük AI Maliyetleri
CREATE OR REPLACE VIEW daily_ai_costs AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN success = true THEN 1 END) as successful_requests,
  COUNT(CASE WHEN success = false THEN 1 END) as failed_requests,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost_usd) as total_cost_usd,
  SUM(total_cost_tl) as total_cost_tl,
  AVG(response_time_ms) as avg_response_time_ms
FROM ai_usage_tracking
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Endpoint bazlı istatistikler
CREATE OR REPLACE VIEW endpoint_usage_stats AS
SELECT
  endpoint,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  AVG(total_tokens) as avg_tokens_per_request,
  SUM(total_cost_usd) as total_cost_usd,
  SUM(total_cost_tl) as total_cost_tl,
  AVG(response_time_ms) as avg_response_time_ms,
  COUNT(CASE WHEN success = false THEN 1 END) as error_count
FROM ai_usage_tracking
GROUP BY endpoint
ORDER BY request_count DESC;

-- Kullanıcı bazlı istatistikler (Son 30 gün)
CREATE OR REPLACE VIEW user_usage_stats_30d AS
SELECT
  user_id,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost_usd) as total_cost_usd,
  SUM(total_cost_tl) as total_cost_tl,
  MAX(created_at) as last_used_at,
  MIN(created_at) as first_used_at
FROM ai_usage_tracking
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id
ORDER BY request_count DESC;

-- Model bazlı kullanım (Son 7 gün)
CREATE OR REPLACE VIEW model_usage_stats_7d AS
SELECT
  model,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  AVG(total_tokens) as avg_tokens,
  SUM(total_cost_usd) as total_cost_usd,
  SUM(total_cost_tl) as total_cost_tl
FROM ai_usage_tracking
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY model
ORDER BY request_count DESC;

-- =====================================================
-- FUNCTIONS: Yardımcı Fonksiyonlar
-- =====================================================

-- Günlük bütçe kontrolü fonksiyonu
CREATE OR REPLACE FUNCTION check_daily_budget(budget_limit_usd DECIMAL DEFAULT 50.0)
RETURNS TABLE (
  today_cost_usd DECIMAL,
  today_cost_tl DECIMAL,
  budget_limit DECIMAL,
  budget_remaining DECIMAL,
  budget_exceeded BOOLEAN,
  request_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(total_cost_usd), 0)::DECIMAL as today_cost_usd,
    COALESCE(SUM(total_cost_tl), 0)::DECIMAL as today_cost_tl,
    budget_limit_usd as budget_limit,
    (budget_limit_usd - COALESCE(SUM(total_cost_usd), 0))::DECIMAL as budget_remaining,
    (COALESCE(SUM(total_cost_usd), 0) > budget_limit_usd) as budget_exceeded,
    COUNT(*)::INTEGER as request_count
  FROM ai_usage_tracking
  WHERE DATE(created_at) = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Aylık toplam maliyet
CREATE OR REPLACE FUNCTION get_monthly_cost(year INTEGER, month INTEGER)
RETURNS TABLE (
  total_requests INTEGER,
  total_tokens BIGINT,
  total_cost_usd DECIMAL,
  total_cost_tl DECIMAL,
  avg_cost_per_request DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_requests,
    SUM(ai_usage_tracking.total_tokens)::BIGINT as total_tokens,
    SUM(ai_usage_tracking.total_cost_usd)::DECIMAL as total_cost_usd,
    SUM(ai_usage_tracking.total_cost_tl)::DECIMAL as total_cost_tl,
    (SUM(ai_usage_tracking.total_cost_usd) / NULLIF(COUNT(*), 0))::DECIMAL as avg_cost_per_request
  FROM ai_usage_tracking
  WHERE EXTRACT(YEAR FROM created_at) = year
    AND EXTRACT(MONTH FROM created_at) = month;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Otomatik Budget Alert
-- =====================================================

-- Budget alert tablosu (opsiyonel - notification için)
CREATE TABLE IF NOT EXISTS ai_budget_alerts (
  id SERIAL PRIMARY KEY,
  alert_date DATE NOT NULL UNIQUE,
  daily_cost_usd DECIMAL(10,6) NOT NULL,
  budget_limit_usd DECIMAL(10,6) NOT NULL DEFAULT 50.0,
  request_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Budget control trigger function
CREATE OR REPLACE FUNCTION check_and_alert_budget()
RETURNS TRIGGER AS $$
DECLARE
  daily_total DECIMAL;
  daily_limit DECIMAL := 50.0; -- $50/gün limit
BEGIN
  -- Bugünün toplam maliyetini hesapla
  SELECT COALESCE(SUM(total_cost_usd), 0) INTO daily_total
  FROM ai_usage_tracking
  WHERE DATE(created_at) = CURRENT_DATE;

  -- Eğer limit aşıldıysa ve bugün için alert yoksa, alert oluştur
  IF daily_total > daily_limit THEN
    INSERT INTO ai_budget_alerts (alert_date, daily_cost_usd, budget_limit_usd, request_count)
    SELECT
      CURRENT_DATE,
      daily_total,
      daily_limit,
      COUNT(*)
    FROM ai_usage_tracking
    WHERE DATE(created_at) = CURRENT_DATE
    ON CONFLICT (alert_date) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Her yeni kayıttan sonra budget kontrol et
DROP TRIGGER IF EXISTS ai_budget_check_trigger ON ai_usage_tracking;
CREATE TRIGGER ai_budget_check_trigger
  AFTER INSERT ON ai_usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION check_and_alert_budget();

-- =====================================================
-- BAŞLANGIÇ VERİLERİ
-- =====================================================

-- Örnek kayıt (test için - opsiyonel)
INSERT INTO ai_usage_tracking (
  user_id, endpoint, model, input_tokens, output_tokens,
  input_cost_usd, output_cost_usd, response_time_ms, success
) VALUES (
  'system',
  '/api/ai/status',
  'claude-sonnet-4-20250514',
  100,
  50,
  0.0003, -- 100 tokens × $3/1M
  0.00075, -- 50 tokens × $15/1M
  150,
  true
);

-- =====================================================
-- KOMUTLAR: Bakım ve Temizlik
-- =====================================================

-- Eski kayıtları temizleme (90 günden eski)
-- CRON job ile çalıştırılabilir
-- DELETE FROM ai_usage_tracking WHERE created_at < CURRENT_DATE - INTERVAL '90 days';

-- Veya partition kullanarak performanslı temizlik yapılabilir (ileride)

COMMENT ON TABLE ai_usage_tracking IS 'AI API kullanım ve maliyet takibi - Claude Sonnet 4 pricing: Input $3/1M tokens, Output $15/1M tokens';
COMMENT ON VIEW daily_ai_costs IS 'Günlük AI maliyet özeti';
COMMENT ON VIEW endpoint_usage_stats IS 'Endpoint bazlı kullanım istatistikleri';
COMMENT ON FUNCTION check_daily_budget IS 'Günlük bütçe kontrolü - Varsayılan $50/gün';
COMMENT ON FUNCTION get_monthly_cost IS 'Aylık toplam maliyet hesaplama';
