-- =====================================================
-- AI HAFIZA SİSTEMİ
-- Konuşma geçmişi + Uzun vadeli hafıza + Geri bildirim
-- =====================================================

-- 1. KONUŞMALAR (Oturum bazlı)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) DEFAULT 'default',
  role VARCHAR(20) NOT NULL, -- 'user' veya 'assistant'
  content TEXT NOT NULL,
  tools_used TEXT[], -- Kullanılan tool'lar
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session bazlı hızlı erişim için index
CREATE INDEX IF NOT EXISTS idx_ai_conv_session ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_created ON ai_conversations(created_at DESC);

-- 2. UZUN VADELİ HAFIZA (Öğrenilen bilgiler)
CREATE TABLE IF NOT EXISTS ai_memory (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) DEFAULT 'default',
  memory_type VARCHAR(50) NOT NULL, -- 'preference', 'pattern', 'fact', 'reminder'
  category VARCHAR(100), -- 'tedarikci', 'proje', 'siparis', 'genel'
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  importance INTEGER DEFAULT 5, -- 1-10 arası öncelik
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- NULL = süresiz
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Benzersiz hafıza girişi
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_memory_unique 
  ON ai_memory(user_id, memory_type, key);

-- 3. GERİ BİLDİRİM (Öğrenme için)
CREATE TABLE IF NOT EXISTS ai_feedback (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id VARCHAR(100) DEFAULT 'default',
  rating INTEGER, -- 1-5 arası puan veya -1/+1
  feedback_type VARCHAR(50), -- 'helpful', 'not_helpful', 'wrong', 'perfect'
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. SİSTEM SNAPSHOT (Dinamik context için)
CREATE TABLE IF NOT EXISTS ai_system_snapshot (
  id SERIAL PRIMARY KEY,
  snapshot_type VARCHAR(50) NOT NULL, -- 'daily_summary', 'critical_alerts', 'recent_activity'
  data JSONB NOT NULL,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Snapshot temizleme (eski olanları sil)
CREATE INDEX IF NOT EXISTS idx_snapshot_valid ON ai_system_snapshot(valid_until);

-- =====================================================
-- BAŞLANGIÇ VERİLERİ
-- =====================================================

-- Örnek sistem bilgileri
INSERT INTO ai_memory (user_id, memory_type, category, key, value, importance) VALUES
  ('default', 'fact', 'sistem', 'sirket_adi', 'Catering Pro', 10),
  ('default', 'fact', 'sistem', 'projeler', 'KYK, HASTANE, MERKEZ', 9),
  ('default', 'fact', 'sistem', 'is_tanimlari', 'Catering hizmeti veren bir şirket. Projelere (KYK yurdu, hastane, merkez mutfak) yemek malzemesi tedarik ediyor.', 10),
  ('default', 'preference', 'genel', 'dil', 'Türkçe', 10),
  ('default', 'preference', 'genel', 'para_birimi', 'TL', 10)
ON CONFLICT (user_id, memory_type, key) DO NOTHING;

-- Trigger: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_ai_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.usage_count = OLD.usage_count + 1;
  NEW.last_used_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_memory_update_trigger ON ai_memory;
CREATE TRIGGER ai_memory_update_trigger
  BEFORE UPDATE ON ai_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_memory_timestamp();

