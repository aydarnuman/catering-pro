-- =====================================================
-- ŞABLON MODELLERİNİ GÜNCELLE
-- Tüm şablonlar Opus kullanacak (Genel ve Hızlı Cevap hariç)
-- =====================================================

-- Mutfak Şefi -> Opus
UPDATE ai_prompt_templates 
SET preferred_model = 'claude-opus-4-20250514', updated_at = CURRENT_TIMESTAMP
WHERE slug LIKE '%mutfak%';

-- İK Danışmanı -> Opus
UPDATE ai_prompt_templates 
SET preferred_model = 'claude-opus-4-20250514', updated_at = CURRENT_TIMESTAMP
WHERE slug LIKE '%ik-danismani%';

-- Maliyet Analisti -> Opus
UPDATE ai_prompt_templates 
SET preferred_model = 'claude-opus-4-20250514', updated_at = CURRENT_TIMESTAMP
WHERE slug LIKE '%maliyet%';

-- Resmi Yazı Uzmanı -> Opus
UPDATE ai_prompt_templates 
SET preferred_model = 'claude-opus-4-20250514', updated_at = CURRENT_TIMESTAMP
WHERE slug LIKE '%resmi-yazi%';

-- Satın Alma Uzmanı -> Opus
UPDATE ai_prompt_templates 
SET preferred_model = 'claude-opus-4-20250514', updated_at = CURRENT_TIMESTAMP
WHERE slug LIKE '%satin-alma%';

-- Genel Asistan ve Hızlı Cevap -> Sonnet (null = varsayılan)
UPDATE ai_prompt_templates 
SET preferred_model = NULL, updated_at = CURRENT_TIMESTAMP
WHERE slug IN ('default', 'hizli-yanit');

-- Doğrulama
SELECT name, preferred_model FROM ai_prompt_templates ORDER BY name;
