-- ============================================
-- PROMPT BUILDER PERFORMANCE & SECURITY INDEXES
-- Migration: 109_prompt_builder_indexes.sql
-- Date: 2026-01-28
-- ============================================

-- 1. Saved prompts için performans indeksleri
-- Tarih sıralaması için (en çok kullanılan sorgu)
CREATE INDEX IF NOT EXISTS idx_pb_saved_created_at
  ON pb_saved_prompts(created_at DESC);

-- Updated_at için (son güncellenen promptlar)
CREATE INDEX IF NOT EXISTS idx_pb_saved_updated_at
  ON pb_saved_prompts(updated_at DESC);

-- Kullanıcı + favori kombinasyonu (favori listesi)
CREATE INDEX IF NOT EXISTS idx_pb_saved_user_favorite
  ON pb_saved_prompts(user_id, is_favorite)
  WHERE is_favorite = TRUE;

-- Public promptlar için (galeri sorguları)
CREATE INDEX IF NOT EXISTS idx_pb_saved_public_usage
  ON pb_saved_prompts(usage_count DESC)
  WHERE is_public = TRUE;

-- 2. Categories için performans indeksleri
-- Aktif kategoriler (çoğu sorgu aktif filtreliyor)
CREATE INDEX IF NOT EXISTS idx_pb_categories_active_sort
  ON pb_categories(sort_order ASC)
  WHERE is_active = TRUE;

-- 3. Templates için performans indeksleri
-- Kategori + aktif kombinasyonu
CREATE INDEX IF NOT EXISTS idx_pb_templates_category_active
  ON pb_templates(category_id, is_active)
  WHERE is_active = TRUE;

-- Usage count sıralaması (popüler şablonlar)
CREATE INDEX IF NOT EXISTS idx_pb_templates_usage
  ON pb_templates(usage_count DESC)
  WHERE is_active = TRUE;

-- 4. Questions için performans indeksleri
-- Kategori bazlı sıralı sorular
CREATE INDEX IF NOT EXISTS idx_pb_questions_category_sort
  ON pb_questions(category_id, sort_order ASC)
  WHERE is_active = TRUE;

-- 5. Usage stats için performans indeksleri
-- Kullanıcı bazlı istatistikler
CREATE INDEX IF NOT EXISTS idx_pb_usage_stats_user_date
  ON pb_usage_stats(user_id, created_at DESC);

-- Action bazlı istatistikler (analytics için)
CREATE INDEX IF NOT EXISTS idx_pb_usage_stats_action_date
  ON pb_usage_stats(action, created_at DESC);

-- Template bazlı kullanım (popülerlik hesaplama)
CREATE INDEX IF NOT EXISTS idx_pb_usage_stats_template
  ON pb_usage_stats(template_id, created_at DESC)
  WHERE template_id IS NOT NULL;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON INDEX idx_pb_saved_created_at IS 'Kayıtlı promptların tarih sıralaması için';
COMMENT ON INDEX idx_pb_saved_updated_at IS 'Son güncellenen promptlar için';
COMMENT ON INDEX idx_pb_saved_user_favorite IS 'Kullanıcının favori promptları için';
COMMENT ON INDEX idx_pb_saved_public_usage IS 'Galeri sayfası için popüler public promptlar';
COMMENT ON INDEX idx_pb_categories_active_sort IS 'Aktif kategorilerin sıralı listesi için';
COMMENT ON INDEX idx_pb_templates_category_active IS 'Kategori bazlı aktif şablonlar için';
COMMENT ON INDEX idx_pb_templates_usage IS 'Popüler şablonların listesi için';
COMMENT ON INDEX idx_pb_questions_category_sort IS 'Kategoriye ait soruların sıralı listesi için';
COMMENT ON INDEX idx_pb_usage_stats_user_date IS 'Kullanıcı istatistikleri için';
COMMENT ON INDEX idx_pb_usage_stats_action_date IS 'Action bazlı analytics için';
COMMENT ON INDEX idx_pb_usage_stats_template IS 'Template popülerlik hesaplama için';
