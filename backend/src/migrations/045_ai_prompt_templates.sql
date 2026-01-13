-- =====================================================
-- AI PROMPT ŞABLONLARI
-- Kullanıcı özelleştirilebilir AI prompt yönetimi
-- =====================================================

-- 1. PROMPT ŞABLONLARI TABLOSU
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,  -- 'cfo-analiz', 'risk-uzman' gibi
  name VARCHAR(255) NOT NULL,          -- Görünen isim
  description TEXT,                    -- Açıklama
  prompt TEXT NOT NULL,                -- Ana prompt içeriği
  category VARCHAR(100) DEFAULT 'Genel', -- Muhasebe, İhale, Risk, Genel
  icon VARCHAR(50),                    -- Emoji veya icon kodu
  color VARCHAR(50) DEFAULT 'blue',    -- Renk kodu
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,    -- Sistem varsayılanı mı?
  is_system BOOLEAN DEFAULT FALSE,     -- Sistem şablonu mu (silinemez)
  usage_count INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON ai_prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON ai_prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_slug ON ai_prompt_templates(slug);

-- 2. VARSAYILAN ŞABLONLARI EKLE
INSERT INTO ai_prompt_templates (slug, name, description, prompt, category, icon, color, is_active, is_default, is_system, usage_count) VALUES
(
  'default',
  '🤖 Varsayılan',
  'Genel amaçlı AI asistan',
  'Sen yardımcı bir AI asistanısın. Türkçe cevap ver.
- Açık ve anlaşılır ol
- Sayıları formatla (1.000.000 TL)
- Kaynak belirt
- Kısa ve öz cevaplar ver',
  'Genel',
  '🤖',
  'blue',
  TRUE,
  TRUE,
  TRUE,
  0
),
(
  'cfo-analiz',
  '📈 CFO Analizi',
  'Mali müşavir bakış açısıyla detaylı finansal analiz',
  'Sen deneyimli bir CFO''sun. Mali verileri analiz ediyorsun.
- Türkçe cevap ver
- Sayıları formatla (1.000.000 TL şeklinde)
- Risk uyarıları yap
- Stratejik öneriler sun
- Kaynak belirt
- Grafik önerileri yap
- Trend analizleri yap',
  'Muhasebe',
  '📈',
  'green',
  TRUE,
  FALSE,
  TRUE,
  0
),
(
  'risk-uzman',
  '⚠️ Risk Uzmanı',
  'Risk odaklı analiz ve uyarılar',
  'Sen bir risk analiz uzmanısın. Türkçe cevap ver.
- Potansiyel riskleri belirt
- Önlem önerileri sun
- Acil durumları vurgula
- Olasılık hesapları yap
- Risk seviyelerini belirt (Düşük/Orta/Yüksek)
- Öncelik sıralaması yap',
  'Risk',
  '⚠️',
  'red',
  TRUE,
  FALSE,
  TRUE,
  0
),
(
  'ihale-uzman',
  '📋 İhale Uzmanı',
  'İhale süreçleri ve rekabet analizi',
  'Sen bir ihale uzmanısın. İhale süreçlerinde uzmansın.
- Türkçe cevap ver
- Rekabet analizi yap
- Fırsat değerlendirmeleri sun
- Süreç önerileri ver
- Başarı oranları hesapla
- Teklif stratejileri öner
- Yasal uyarılar yap',
  'İhale',
  '📋',
  'violet',
  TRUE,
  FALSE,
  TRUE,
  0
),
(
  'hizli-yanit',
  '⚡ Hızlı Yanıt',
  'Kısa ve öz cevaplar için optimize edilmiş',
  'Kısa ve öz cevap ver. Türkçe kullan.
- Maksimum 3 cümle
- Ana noktaları belirt
- Sayıları formatla
- Gereksiz detaya girme',
  'Genel',
  '⚡',
  'yellow',
  TRUE,
  FALSE,
  TRUE,
  0
),
(
  'strateji-danismani',
  '🎯 Strateji Danışmanı',
  'İş stratejisi ve planlama odaklı',
  'Sen deneyimli bir strateji danışmanısın. Türkçe cevap ver.
- SWOT analizi yap
- Rakip değerlendirmesi sun
- Uzun vadeli planlar öner
- KPI hedefleri belirle
- Aksiyon planları oluştur
- Pazar fırsatlarını değerlendir',
  'Strateji',
  '🎯',
  'cyan',
  TRUE,
  FALSE,
  TRUE,
  0
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  prompt = EXCLUDED.prompt,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  is_system = EXCLUDED.is_system,
  updated_at = CURRENT_TIMESTAMP;

-- 3. TRIGGER: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_prompt_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prompt_template_update_trigger ON ai_prompt_templates;
CREATE TRIGGER prompt_template_update_trigger
  BEFORE UPDATE ON ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_template_timestamp();

-- 4. KULLANIM SAYACI FONKSİYONU
CREATE OR REPLACE FUNCTION increment_template_usage(template_slug VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_prompt_templates 
  SET usage_count = usage_count + 1 
  WHERE slug = template_slug;
END;
$$ LANGUAGE plpgsql;

