-- =============================================
-- AGENT MANAGEMENT SYSTEM
-- Merkezi agent yönetimi için 4 tablo
-- =============================================

-- 1. AGENTS - Ana agent tablosu
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  icon TEXT,
  color TEXT,
  accent_hex TEXT,
  system_prompt TEXT,
  model TEXT DEFAULT 'default',
  temperature DECIMAL(3,2) DEFAULT 0.70,
  max_tokens INTEGER DEFAULT 4096,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  verdict_weight DECIMAL(3,2) DEFAULT 0.25,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agents IS 'Sistemdeki tüm AI agent tanımları';
COMMENT ON COLUMN agents.slug IS 'Benzersiz URL-safe identifier (mevzuat, maliyet, teknik, rekabet, genel)';
COMMENT ON COLUMN agents.is_system IS 'true ise silinemez';
COMMENT ON COLUMN agents.verdict_weight IS 'İhale masası verdict hesabındaki ağırlık (0-1)';

-- 2. AGENT_TOOLS - Agent araçları
CREATE TABLE IF NOT EXISTS agent_tools (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_slug TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  requires_selection BOOLEAN DEFAULT FALSE,
  tool_type TEXT DEFAULT 'ai_prompt',
  ai_prompt_template TEXT,
  urgency_priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT agent_tools_unique_slug UNIQUE(agent_id, tool_slug)
);

COMMENT ON TABLE agent_tools IS 'Agent''lara bağlı araç tanımları';
COMMENT ON COLUMN agent_tools.tool_type IS 'ai_prompt, api_call, db_query, composite';
COMMENT ON COLUMN agent_tools.ai_prompt_template IS 'AI''a gönderilecek prompt şablonu ({{input}}, {{context}} placeholder destekler)';
COMMENT ON COLUMN agent_tools.urgency_priority IS 'Deadline yakınsa öne çıkma önceliği (1=en acil)';

-- 3. AGENT_KNOWLEDGE_BASE - Agent kütüphanesi (ihaleden bağımsız)
CREATE TABLE IF NOT EXISTS agent_knowledge_base (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT DEFAULT 'note',
  content TEXT,
  file_path TEXT,
  file_size INTEGER,
  summary TEXT,
  tags TEXT[],
  source TEXT DEFAULT 'manual',
  source_tender_id INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agent_knowledge_base IS 'Agent''ların birikimli kütüphanesi (PDF, URL, not, geçmiş analiz)';
COMMENT ON COLUMN agent_knowledge_base.content_type IS 'pdf, url, note, template, past_analysis';
COMMENT ON COLUMN agent_knowledge_base.source IS 'manual, auto_import, past_tender';

-- 4. AGENT_CONTEXTS - Agent kullanım bağlamları
CREATE TABLE IF NOT EXISTS agent_contexts (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  context_key TEXT NOT NULL,
  context_label TEXT,
  config JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT agent_contexts_unique_key UNIQUE(agent_id, context_key)
);

COMMENT ON TABLE agent_contexts IS 'Agent''ların hangi sayfalarda/bağlamlarda kullanıldığı';
COMMENT ON COLUMN agent_contexts.context_key IS 'ihale_masasi, ai_chat, analiz, genel vb.';

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_agent_tools_agent_id ON agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tools_slug ON agent_tools(tool_slug);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_base_agent_id ON agent_knowledge_base(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_base_tags ON agent_knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_base_content_type ON agent_knowledge_base(content_type);

CREATE INDEX IF NOT EXISTS idx_agent_contexts_agent_id ON agent_contexts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_contexts_context_key ON agent_contexts(context_key);

-- =============================================
-- TRIGGERS - updated_at otomatik güncelleme
-- =============================================

CREATE TRIGGER set_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER set_agent_tools_updated_at
  BEFORE UPDATE ON agent_tools
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER set_agent_knowledge_base_updated_at
  BEFORE UPDATE ON agent_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- =============================================
-- SEED DATA - 5 Agent
-- =============================================

INSERT INTO agents (id, slug, name, subtitle, description, icon, color, accent_hex, system_prompt, model, verdict_weight, is_system) VALUES
(
  'agent-mevzuat',
  'mevzuat',
  'Mevzuat & Sözleşme',
  'Kanun & Sözleşme Analizi',
  '4734 sayılı Kamu İhale Kanunu, 4735 sayılı Kamu İhale Sözleşmeleri Kanunu, KİK kararları ve Danıştay içtihatlarına hakim hukuk uzmanı.',
  'scale',
  'indigo',
  '#6366f1',
  'Sen bir kamu ihale mevzuatı uzmanısın. 4734 sayılı Kamu İhale Kanunu, 4735 sayılı Kamu İhale Sözleşmeleri Kanunu, KİK kararları ve Danıştay içtihatlarına hakimsin. Görevin ihale şartnamelerindeki hukuki riskleri tespit etmek ve teklif veren lehine öneriler sunmaktır. Türkçe yanıt ver.',
  'default',
  0.30,
  TRUE
),
(
  'agent-maliyet',
  'maliyet',
  'Maliyet & Bütçe',
  'Finansal Risk Değerlendirmesi',
  'Yemek hizmet alımı ihalelerinde maliyet analizi, birim fiyat hesaplama, kâr marjı optimizasyonu konularında uzman.',
  'calculator',
  'green',
  '#10b981',
  'Sen bir catering maliyetlendirme uzmanısın. Yemek hizmet alımı ihalelerinde maliyet analizi, birim fiyat hesaplama, kâr marjı optimizasyonu konularında uzmansın. Mevcut piyasa fiyatları ve fatura verileriyle gerçekçi maliyet hesabı yaparsın. Türkçe yanıt ver.',
  'default',
  0.25,
  TRUE
),
(
  'agent-teknik',
  'teknik',
  'Teknik Yeterlilik',
  'Teknik Şartname Değerlendirmesi',
  'Personel yeterliliği, ekipman gereksinimleri, menü planlaması, kapasite analizi konularında uzman.',
  'hardhat',
  'yellow',
  '#f59e0b',
  'Sen bir yemek hizmeti teknik şartname uzmanısın. Personel yeterliliği, ekipman gereksinimleri, menü planlaması, kapasite analizi konularında uzmansın. Şartnameyi teknik açıdan değerlendirip firmanın karşılayıp karşılayamayacağını analiz edersin. Türkçe yanıt ver.',
  'default',
  0.20,
  TRUE
),
(
  'agent-rekabet',
  'rekabet',
  'Rekabet İstihbaratı',
  'Piyasa & Rakip Analizi',
  'Rakip firma analizleri, geçmiş ihale sonuçları, teklif stratejileri konularında uzman istihbaratçı.',
  'radar',
  'pink',
  '#f43f5e',
  'Sen bir ihale rekabet analisti ve istihbaratçısın. Rakip firma analizleri, geçmiş ihale sonuçları, teklif stratejileri konularında uzmansın. Piyasadaki rekabet durumunu değerlendirip optimal teklif stratejisi önerirsin. Türkçe yanıt ver.',
  'default',
  0.25,
  TRUE
),
(
  'agent-genel',
  'genel',
  'Genel Asistan',
  'Her Konuda Yardımcı',
  'Catering Pro sisteminin tüm modüllerine hakim genel amaçlı AI asistan.',
  'robot',
  'blue',
  '#3b82f6',
  'Sen Catering Pro sisteminin genel amaçlı AI asistanısın. İhale, muhasebe, personel, stok, menü planlama ve diğer tüm modüller hakkında yardımcı olabilirsin. Kullanıcının sorularına açık ve yararlı yanıtlar ver. Türkçe yanıt ver.',
  'default',
  0.00,
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  accent_hex = EXCLUDED.accent_hex,
  system_prompt = EXCLUDED.system_prompt,
  verdict_weight = EXCLUDED.verdict_weight,
  updated_at = NOW();

-- =============================================
-- SEED DATA - 11 Agent Tools (prompt template'ler dahil)
-- =============================================

-- Mevzuat Agent Tools
INSERT INTO agent_tools (agent_id, tool_slug, label, description, icon, requires_selection, tool_type, ai_prompt_template, urgency_priority, sort_order) VALUES
(
  'agent-mevzuat',
  'redline',
  'Maddeyi Düzenle',
  'Riskli maddeyi teklif veren lehine yeniden yazar',
  'pencil',
  TRUE,
  'ai_prompt',
  'Aşağıdaki ihale şartname maddesini teklif veren lehine revize et. Orijinal metni, revize metni ve değişiklik gerekçesini ayrı ayrı belirt.

Orijinal Madde:
"{{input}}"

İhale Bilgileri:
{{context}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "redline",
  "originalText": "orijinal madde metni",
  "revisedText": "revize edilmiş metin",
  "explanation": "değişiklik gerekçesi ve hukuki dayanaklar"
}',
  5,
  1
),
(
  'agent-mevzuat',
  'emsal',
  'KİK/Mahkeme Kararı Ara',
  'Bu konuyla ilgili emsal kararları tarar',
  'gavel',
  FALSE,
  'ai_prompt',
  'Bu ihale şartnamesi konusuyla ilgili KİK kararları ve Danıştay içtihatlarını ara. Emsal kararları önem sırasına göre listele.

İhale Konusu: {{ihale_basligi}}
İhale Usulü: {{ihale_usulu}}
Araştırma Konusu: {{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "precedent",
  "citations": [
    {
      "reference": "KİK Kararı veya Danıştay kararı referans numarası",
      "summary": "Kararın özeti ve ilgisi",
      "relevance": "Yüksek/Orta/Düşük"
    }
  ]
}',
  5,
  2
),
(
  'agent-mevzuat',
  'zeyilname',
  'Zeyilname Oluştur',
  'İdareye resmi itiraz mektubu taslağı hazırlar',
  'file-text',
  FALSE,
  'ai_prompt',
  'Bu ihale için idareye resmi zeyilname talep mektubu hazırla. Hukuki dayanakları ve talep edilen değişiklikleri belirt.

İhale: {{ihale_basligi}}
Kurum: {{kurum}}
Konu: {{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "draft",
  "draftTitle": "mektup başlığı",
  "addressee": "hitap",
  "draftDate": "{{current_date}}",
  "draftBody": "mektup tam metni"
}',
  1,
  3
)
ON CONFLICT (agent_id, tool_slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  requires_selection = EXCLUDED.requires_selection,
  ai_prompt_template = EXCLUDED.ai_prompt_template,
  urgency_priority = EXCLUDED.urgency_priority,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Maliyet Agent Tools
INSERT INTO agent_tools (agent_id, tool_slug, label, description, icon, requires_selection, tool_type, ai_prompt_template, urgency_priority, sort_order) VALUES
(
  'agent-maliyet',
  'maliyet_hesapla',
  'Maliyet Hesapla',
  'Menü bazlı tahmini maliyet analizi yapar',
  'calculator',
  FALSE,
  'ai_prompt',
  'Bu ihale şartnamesindeki menü/yemek gereksinimlerine göre tahmini maliyet hesabı yap.

İhale: {{ihale_basligi}}
Tahmini Bedel: {{tahmini_bedel}}
Kişi Sayısı: {{kisi_sayisi}}
Süre: {{sure}}
Öğün Bilgileri: {{ogun_bilgileri}}
Birim Fiyatlar: {{birim_fiyatlar}}
{{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "calculation",
  "content": "detaylı maliyet hesabı (markdown formatında)"
}',
  5,
  1
),
(
  'agent-maliyet',
  'piyasa_karsilastir',
  'Piyasa Karşılaştır',
  'Birim fiyatları güncel piyasa ile karşılaştırır',
  'chart-bar',
  FALSE,
  'ai_prompt',
  'Bu ihale için piyasa fiyat karşılaştırması yap. Şartnamedeki birim fiyatları güncel piyasa ile karşılaştır.

Birim Fiyatlar: {{birim_fiyatlar}}
Tahmini Bedel: {{tahmini_bedel}}
{{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "calculation",
  "content": "piyasa karşılaştırma analizi (markdown formatında)"
}',
  5,
  2
),
(
  'agent-maliyet',
  'teminat_hesapla',
  'Teminat Hesapla',
  'Geçici ve kesin teminat tutarlarını hesaplar',
  'shield-check',
  FALSE,
  'ai_prompt',
  'Bu ihale için teminat hesaplaması yap.

Tahmini Bedel: {{tahmini_bedel}}
Geçici Teminat: {{gecici_teminat}}
Kesin Teminat: {{kesin_teminat}}
{{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "calculation",
  "content": "teminat hesaplama detayları (markdown formatında)"
}',
  1,
  3
)
ON CONFLICT (agent_id, tool_slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  ai_prompt_template = EXCLUDED.ai_prompt_template,
  urgency_priority = EXCLUDED.urgency_priority,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Teknik Agent Tools
INSERT INTO agent_tools (agent_id, tool_slug, label, description, icon, requires_selection, tool_type, ai_prompt_template, urgency_priority, sort_order) VALUES
(
  'agent-teknik',
  'personel_karsilastir',
  'Personel Analizi',
  'Şartnamedeki personel gereksinimlerini analiz eder',
  'users',
  FALSE,
  'ai_prompt',
  'İhale şartnamesindeki personel gereksinimlerini analiz et ve firmanın mevcut kadrosuyla karşılaştırma önerisi yap.

Şartnamedeki Personel Gereksinimleri: {{personel_detaylari}}
Kişi Sayısı: {{kisi_sayisi}}
{{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "personel analizi ve öneriler (markdown formatında)"
}',
  5,
  1
),
(
  'agent-teknik',
  'menu_uygunluk',
  'Menü Uygunluk',
  'Öğün gereksinimleri ile menü kapasitesini eşler',
  'chef-hat',
  FALSE,
  'ai_prompt',
  'İhale şartnamesindeki menü/yemek gereksinimlerini değerlendir.

Öğün Bilgileri: {{ogun_bilgileri}}
Teknik Şartlar: {{teknik_sartlar}}
Servis Saatleri: {{servis_saatleri}}
{{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "menü uygunluk analizi (markdown formatında)"
}',
  5,
  2
),
(
  'agent-teknik',
  'kapasite_kontrol',
  'Kapasite Kontrolü',
  'Üretim kapasitesi yeterlilik analizi yapar',
  'gauge',
  FALSE,
  'ai_prompt',
  'İhale için kapasite yeterlilik analizi yap.

Kişi Sayısı: {{kisi_sayisi}}
Süre: {{sure}}
Öğün Bilgileri: {{ogun_bilgileri}}
Kapasite Gereksinimi: {{kapasite_gereksinimi}}
{{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "kapasite analizi ve değerlendirme (markdown formatında)"
}',
  5,
  3
)
ON CONFLICT (agent_id, tool_slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  ai_prompt_template = EXCLUDED.ai_prompt_template,
  urgency_priority = EXCLUDED.urgency_priority,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Rekabet Agent Tools
INSERT INTO agent_tools (agent_id, tool_slug, label, description, icon, requires_selection, tool_type, ai_prompt_template, urgency_priority, sort_order) VALUES
(
  'agent-rekabet',
  'benzer_ihale',
  'Benzer İhale Ara',
  'Geçmiş benzer ihaleleri bulur ve analiz eder',
  'search',
  FALSE,
  'ai_prompt',
  'Bu ihaleye benzer geçmiş ihaleleri analiz et ve rekabet durumunu değerlendir.

İhale: {{ihale_basligi}}
Kurum: {{kurum}}
İl: {{il}}
Tahmini Bedel: {{tahmini_bedel}}
İhale Usulü: {{ihale_usulu}}
{{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "rekabet analizi ve strateji önerileri (markdown formatında)"
}',
  5,
  1
),
(
  'agent-rekabet',
  'teklif_stratejisi',
  'Teklif Stratejisi',
  'Optimal teklif stratejisi ve senaryolar önerir',
  'target',
  FALSE,
  'ai_prompt',
  'Bu ihale için optimal teklif stratejisi öner.

Tahmini Bedel: {{tahmini_bedel}}
Sınır Değer Katsayısı: {{sinir_deger_katsayisi}}
Teklif Türü: {{teklif_turu}}
Benzer İş Tanımı: {{benzer_is_tanimi}}
{{input}}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "teklif stratejisi analizi (markdown formatında, senaryolu)"
}',
  1,
  2
)
ON CONFLICT (agent_id, tool_slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  ai_prompt_template = EXCLUDED.ai_prompt_template,
  urgency_priority = EXCLUDED.urgency_priority,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- =============================================
-- SEED DATA - Agent Contexts
-- =============================================

INSERT INTO agent_contexts (agent_id, context_key, context_label, sort_order, is_active) VALUES
('agent-mevzuat', 'ihale_masasi', 'Sanal İhale Masası', 1, TRUE),
('agent-maliyet', 'ihale_masasi', 'Sanal İhale Masası', 2, TRUE),
('agent-teknik', 'ihale_masasi', 'Sanal İhale Masası', 3, TRUE),
('agent-rekabet', 'ihale_masasi', 'Sanal İhale Masası', 4, TRUE),
('agent-genel', 'ai_chat', 'AI Sohbet', 1, TRUE),
('agent-genel', 'genel', 'Genel Kullanım', 2, TRUE)
ON CONFLICT (agent_id, context_key) DO UPDATE SET
  context_label = EXCLUDED.context_label,
  sort_order = EXCLUDED.sort_order;
