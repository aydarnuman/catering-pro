-- ═══════════════════════════════════════════════════════════════
-- masa_veri_paketleri: Sağ panelden masaya gönderilen veri paketleri
-- Tek doğruluk kaynağı: ihale masası bu tablodan beslenir
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS masa_veri_paketleri (
  id BIGSERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL,

  -- Temel ihale bilgileri (snapshot)
  tender_title TEXT,
  kurum TEXT,
  tarih TEXT,
  bedel TEXT,
  sure TEXT,

  -- Süzülmüş analiz verisi (sağ panelden)
  analysis_cards JSONB DEFAULT '{}'::jsonb,

  -- Kullanıcı özel kartları (snapshot)
  user_cards JSONB DEFAULT '[]'::jsonb,

  -- Notlar
  notes JSONB DEFAULT '[]'::jsonb,

  -- HITL durumu
  correction_count INTEGER DEFAULT 0,
  is_confirmed BOOLEAN DEFAULT false,

  -- Ajan analizleri (masada üretilir, pakete geri yazılır)
  agent_analyses JSONB DEFAULT NULL,

  -- Karar verisi (masada üretilir, pakete geri yazılır)
  verdict_data JSONB DEFAULT NULL,

  -- Meta
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Bir ihale için birden fazla paket olabilir (versiyon)
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_masa_veri_paketleri_tender_id ON masa_veri_paketleri(tender_id);
CREATE INDEX IF NOT EXISTS idx_masa_veri_paketleri_active ON masa_veri_paketleri(tender_id, is_active) WHERE is_active = true;

-- updated_at otomatik güncelleme
CREATE TRIGGER set_masa_veri_paketleri_updated_at
  BEFORE UPDATE ON masa_veri_paketleri
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- RLS
ALTER TABLE masa_veri_paketleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY masa_veri_paketleri_all ON masa_veri_paketleri
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE masa_veri_paketleri IS 'İhale masasının tek veri kaynağı. Sağ panelden masaya gönderilen süzülmüş veri paketleri.';
