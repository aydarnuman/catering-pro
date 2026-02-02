-- =====================================================
-- DUPLICATE TEMPLATE'LERİ TEMİZLE
-- Aynı slug'a sahip birden fazla kayıt varsa sadece birini tut
-- =====================================================

-- Önce duplicate'leri bul ve sil (en düşük id'li olanı tut)
DELETE FROM ai_prompt_templates
WHERE id NOT IN (
  SELECT MIN(id)
  FROM ai_prompt_templates
  GROUP BY slug
);

-- Slug'a unique constraint ekle (duplicate önlemek için)
ALTER TABLE ai_prompt_templates 
DROP CONSTRAINT IF EXISTS ai_prompt_templates_slug_unique;

ALTER TABLE ai_prompt_templates 
ADD CONSTRAINT ai_prompt_templates_slug_unique UNIQUE (slug);

-- Doğrulama - kaç template kaldı
SELECT COUNT(*) as total_templates, 
       COUNT(DISTINCT slug) as unique_slugs 
FROM ai_prompt_templates;

-- Template listesi
SELECT id, slug, name, category FROM ai_prompt_templates ORDER BY category, name;
