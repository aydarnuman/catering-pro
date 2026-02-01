-- =====================================================
-- AI AYARLARI VE İYİLEŞTİRMELER
-- Model seçimi, feedback, otomatik öğrenme
-- =====================================================

-- 1. AI AYARLARI TABLOSU
CREATE TABLE IF NOT EXISTS ai_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Varsayılan ayarları ekle
INSERT INTO ai_settings (setting_key, setting_value, description, category) VALUES
  ('default_model', '"claude-sonnet-4-20250514"', 'Varsayılan AI modeli', 'model'),
  ('available_models', '[
    {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "description": "Hızlı ve dengeli", "icon": "⚡", "speed": "fast", "intelligence": "high"},
    {"id": "claude-opus-4-20250514", "name": "Claude Opus 4", "description": "En akıllı, derin analiz", "icon": "🧠", "speed": "slow", "intelligence": "highest"}
  ]', 'Kullanılabilir AI modelleri', 'model'),
  ('auto_learn_enabled', 'true', 'Otomatik öğrenme aktif mi', 'learning'),
  ('auto_learn_threshold', '0.8', 'Otomatik öğrenme güven eşiği (0-1)', 'learning'),
  ('max_memory_items', '100', 'Maksimum hafıza öğesi sayısı', 'memory'),
  ('memory_retention_days', '365', 'Hafıza saklama süresi (gün)', 'memory'),
  ('daily_snapshot_enabled', 'true', 'Günlük sistem özeti aktif mi', 'snapshot'),
  ('snapshot_time', '"03:00"', 'Günlük özet saati', 'snapshot')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = CURRENT_TIMESTAMP;

-- 2. AI FEEDBACK TABLOSUNU GÜNCELleme (mevcut tablo varsa)
-- Yeni alanlar ekle
ALTER TABLE ai_feedback 
  ADD COLUMN IF NOT EXISTS message_content TEXT,
  ADD COLUMN IF NOT EXISTS ai_response TEXT,
  ADD COLUMN IF NOT EXISTS model_used VARCHAR(100),
  ADD COLUMN IF NOT EXISTS template_slug VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tools_used TEXT[],
  ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- 3. AI ÖĞRENİLEN BİLGİLER (Otomatik çıkarım için)
CREATE TABLE IF NOT EXISTS ai_learned_facts (
  id SERIAL PRIMARY KEY,
  source_conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE SET NULL,
  fact_type VARCHAR(50) NOT NULL, -- 'entity', 'preference', 'pattern', 'correction'
  entity_type VARCHAR(100), -- 'tedarikci', 'proje', 'personel', 'urun' vb.
  entity_name VARCHAR(255),
  fact_key VARCHAR(255) NOT NULL,
  fact_value TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.80, -- 0.00 - 1.00 arası güven skoru
  verified BOOLEAN DEFAULT FALSE, -- Kullanıcı onayladı mı?
  applied_to_memory BOOLEAN DEFAULT FALSE, -- ai_memory'ye eklendi mi?
  user_id VARCHAR(100) DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learned_facts_type ON ai_learned_facts(fact_type);
CREATE INDEX IF NOT EXISTS idx_learned_facts_entity ON ai_learned_facts(entity_type, entity_name);
CREATE INDEX IF NOT EXISTS idx_learned_facts_confidence ON ai_learned_facts(confidence DESC);

-- 4. AI HATIRLATICILAR (Reminder sistemi)
CREATE TABLE IF NOT EXISTS ai_reminders (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) DEFAULT 'default',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  remind_at TIMESTAMP NOT NULL,
  repeat_type VARCHAR(50), -- 'once', 'daily', 'weekly', 'monthly'
  repeat_config JSONB, -- Tekrar ayarları
  related_entity_type VARCHAR(100), -- 'fatura', 'siparis', 'ihale' vb.
  related_entity_id INTEGER,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'triggered', 'dismissed', 'completed'
  triggered_at TIMESTAMP,
  created_from_conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON ai_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON ai_reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON ai_reminders(remind_at);

-- 5. GÜNLÜK SİSTEM ÖZETİ (Snapshot detayları)
-- Mevcut ai_system_snapshot tablosunu kullan, ek index
CREATE INDEX IF NOT EXISTS idx_snapshot_type_date ON ai_system_snapshot(snapshot_type, created_at DESC);

-- 6. TRIGGER: ai_settings updated_at
CREATE OR REPLACE FUNCTION update_ai_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_settings_update_trigger ON ai_settings;
CREATE TRIGGER ai_settings_update_trigger
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_settings_timestamp();

-- 7. TRIGGER: ai_reminders updated_at
CREATE OR REPLACE FUNCTION update_ai_reminders_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_reminders_update_trigger ON ai_reminders;
CREATE TRIGGER ai_reminders_update_trigger
  BEFORE UPDATE ON ai_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_reminders_timestamp();

-- 8. FONKSİYON: Güvenilir fact'leri memory'ye taşı
CREATE OR REPLACE FUNCTION apply_learned_facts_to_memory()
RETURNS INTEGER AS $$
DECLARE
  applied_count INTEGER := 0;
  fact RECORD;
BEGIN
  FOR fact IN 
    SELECT * FROM ai_learned_facts 
    WHERE confidence >= 0.85 
      AND verified = TRUE 
      AND applied_to_memory = FALSE
  LOOP
    INSERT INTO ai_memory (user_id, memory_type, category, key, value, importance)
    VALUES (fact.user_id, 'fact', fact.entity_type, fact.fact_key, fact.fact_value, 7)
    ON CONFLICT (user_id, memory_type, key) DO UPDATE SET
      value = EXCLUDED.value,
      usage_count = ai_memory.usage_count + 1,
      updated_at = CURRENT_TIMESTAMP;
    
    UPDATE ai_learned_facts SET applied_to_memory = TRUE WHERE id = fact.id;
    applied_count := applied_count + 1;
  END LOOP;
  
  RETURN applied_count;
END;
$$ LANGUAGE plpgsql;

