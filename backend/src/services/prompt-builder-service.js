/**
 * Prompt Builder Service
 * AI Prompt Builder iş mantığı
 */

import { query } from '../database.js';

/**
 * Tüm aktif kategorileri getir
 */
export async function getCategories() {
  const result = await query(`
    SELECT 
      c.*,
      COUNT(DISTINCT q.id) as question_count,
      COUNT(DISTINCT t.id) as template_count
    FROM pb_categories c
    LEFT JOIN pb_questions q ON q.category_id = c.id
    LEFT JOIN pb_templates t ON t.category_id = c.id AND t.is_active = TRUE
    WHERE c.is_active = TRUE
    GROUP BY c.id
    ORDER BY c.sort_order ASC
  `);
  return result.rows;
}

/**
 * Kategori detayını getir
 */
export async function getCategoryBySlug(slug) {
  const result = await query(
    `
    SELECT * FROM pb_categories WHERE slug = $1 AND is_active = TRUE
  `,
    [slug]
  );
  return result.rows[0];
}

/**
 * Kategorinin sorularını getir
 */
export async function getQuestionsByCategory(categoryId) {
  const result = await query(
    `
    SELECT * FROM pb_questions 
    WHERE category_id = $1 AND is_active = TRUE
    ORDER BY sort_order ASC
  `,
    [categoryId]
  );
  return result.rows;
}

/**
 * Kategorinin sorularını slug ile getir
 */
export async function getQuestionsByCategorySlug(slug) {
  const result = await query(
    `
    SELECT q.* FROM pb_questions q
    JOIN pb_categories c ON c.id = q.category_id
    WHERE c.slug = $1 AND c.is_active = TRUE AND q.is_active = TRUE
    ORDER BY q.sort_order ASC
  `,
    [slug]
  );
  return result.rows;
}

/**
 * Kategorinin şablonlarını getir
 */
export async function getTemplatesByCategory(categoryId) {
  const result = await query(
    `
    SELECT * FROM pb_templates 
    WHERE category_id = $1 AND is_active = TRUE
    ORDER BY is_default DESC, usage_count DESC
  `,
    [categoryId]
  );
  return result.rows;
}

/**
 * Kategorinin şablonlarını slug ile getir
 */
export async function getTemplatesByCategorySlug(slug) {
  const result = await query(
    `
    SELECT t.* FROM pb_templates t
    JOIN pb_categories c ON c.id = t.category_id
    WHERE c.slug = $1 AND c.is_active = TRUE AND t.is_active = TRUE
    ORDER BY t.is_default DESC, t.usage_count DESC
  `,
    [slug]
  );
  return result.rows;
}

/**
 * Tek bir şablonu getir
 */
export async function getTemplateById(id) {
  const result = await query(
    `
    SELECT t.*, c.slug as category_slug, c.name as category_name
    FROM pb_templates t
    LEFT JOIN pb_categories c ON c.id = t.category_id
    WHERE t.id = $1
  `,
    [id]
  );
  return result.rows[0];
}

/**
 * Prompt oluştur (template + answers)
 * GÜVENLİK: Template injection koruması eklendi
 */
export function generatePrompt(templateText, answers) {
  let prompt = templateText;

  // {{variable}} formatındaki placeholder'ları değiştir
  for (const [key, value] of Object.entries(answers)) {
    // GÜVENLİK: Değerlerdeki {{ ve }} karakterlerini escape et
    // Bu, kullanıcının {{başka_değişken}} yazarak injection yapmasını engeller
    const safeValue = String(value || '')
      .replace(/\{\{/g, '{ {') // {{ -> { { (kırılır)
      .replace(/\}\}/g, '} }'); // }} -> } } (kırılır)

    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    prompt = prompt.replace(regex, safeValue);
  }

  // Kullanılmayan placeholder'ları temizle
  prompt = prompt.replace(/\{\{[^}]+\}\}/g, '[Belirtilmedi]');

  return prompt;
}

/**
 * Şablon kullanım sayacını artır
 */
export async function incrementTemplateUsage(templateId) {
  await query(
    `
    UPDATE pb_templates 
    SET usage_count = usage_count + 1 
    WHERE id = $1
  `,
    [templateId]
  );
}

/**
 * Prompt kaydet
 */
export async function savePrompt(userId, data) {
  const { categoryId, templateId, name, description, generatedPrompt, answers, style } = data;

  const result = await query(
    `
    INSERT INTO pb_saved_prompts 
      (user_id, category_id, template_id, name, description, generated_prompt, answers, style)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `,
    [userId, categoryId, templateId, name, description, generatedPrompt, JSON.stringify(answers), style]
  );

  return result.rows[0];
}

/**
 * Kullanıcının kayıtlı prompt'larını getir
 */
export async function getSavedPrompts(userId, options = {}) {
  const { limit = 50, offset = 0, categoryId, favoriteOnly } = options;

  let whereClause = 'WHERE sp.user_id = $1';
  const params = [userId];
  let paramIndex = 2;

  if (categoryId) {
    whereClause += ` AND sp.category_id = $${paramIndex}`;
    params.push(categoryId);
    paramIndex++;
  }

  if (favoriteOnly) {
    whereClause += ' AND sp.is_favorite = TRUE';
  }

  const result = await query(
    `
    SELECT 
      sp.*,
      c.name as category_name,
      c.slug as category_slug,
      c.icon as category_icon,
      c.color as category_color,
      t.name as template_name
    FROM pb_saved_prompts sp
    LEFT JOIN pb_categories c ON c.id = sp.category_id
    LEFT JOIN pb_templates t ON t.id = sp.template_id
    ${whereClause}
    ORDER BY sp.is_favorite DESC, sp.updated_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `,
    [...params, limit, offset]
  );

  return result.rows;
}

/**
 * Tek bir kayıtlı prompt'u getir
 */
export async function getSavedPromptById(id, userId) {
  const result = await query(
    `
    SELECT 
      sp.*,
      c.name as category_name,
      c.slug as category_slug,
      c.icon as category_icon,
      t.name as template_name,
      t.template_text as original_template
    FROM pb_saved_prompts sp
    LEFT JOIN pb_categories c ON c.id = sp.category_id
    LEFT JOIN pb_templates t ON t.id = sp.template_id
    WHERE sp.id = $1 AND (sp.user_id = $2 OR sp.is_public = TRUE)
  `,
    [id, userId]
  );

  return result.rows[0];
}

/**
 * Kayıtlı prompt güncelle
 */
export async function updateSavedPrompt(id, userId, data) {
  const { name, description, isFavorite, isPublic } = data;

  const result = await query(
    `
    UPDATE pb_saved_prompts
    SET 
      name = COALESCE($3, name),
      description = COALESCE($4, description),
      is_favorite = COALESCE($5, is_favorite),
      is_public = COALESCE($6, is_public),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `,
    [id, userId, name, description, isFavorite, isPublic]
  );

  return result.rows[0];
}

/**
 * Kayıtlı prompt sil
 */
export async function deleteSavedPrompt(id, userId) {
  const result = await query(
    `
    DELETE FROM pb_saved_prompts
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `,
    [id, userId]
  );

  return result.rowCount > 0;
}

/**
 * Prompt kullanım istatistiği kaydet
 */
export async function logUsage(userId, data) {
  const { savedPromptId, categoryId, templateId, action, metadata } = data;

  await query(
    `
    INSERT INTO pb_usage_stats 
      (user_id, saved_prompt_id, category_id, template_id, action, metadata)
    VALUES ($1, $2, $3, $4, $5, $6)
  `,
    [userId, savedPromptId, categoryId, templateId, action, JSON.stringify(metadata || {})]
  );

  // Kayıtlı prompt'un kullanım sayısını güncelle
  if (savedPromptId) {
    await query(
      `
      UPDATE pb_saved_prompts 
      SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
      [savedPromptId]
    );
  }
}

/**
 * Public (paylaşılmış) prompt'ları getir - Galeri
 */
export async function getPublicPrompts(options = {}) {
  const { limit = 50, offset = 0, categoryId, sortBy = 'usage_count' } = options;

  let whereClause = 'WHERE sp.is_public = TRUE';
  const params = [];
  let paramIndex = 1;

  if (categoryId) {
    whereClause += ` AND sp.category_id = $${paramIndex}`;
    params.push(categoryId);
    paramIndex++;
  }

  const orderBy = sortBy === 'recent' ? 'sp.created_at DESC' : 'sp.usage_count DESC';

  const result = await query(
    `
    SELECT 
      sp.*,
      c.name as category_name,
      c.slug as category_slug,
      c.icon as category_icon,
      c.color as category_color,
      u.name as author_name
    FROM pb_saved_prompts sp
    LEFT JOIN pb_categories c ON c.id = sp.category_id
    LEFT JOIN users u ON u.id = sp.user_id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `,
    [...params, limit, offset]
  );

  return result.rows;
}

/**
 * Kullanıcı istatistiklerini getir
 */
export async function getUserStats(userId) {
  const result = await query(
    `
    SELECT 
      COUNT(*) as total_prompts,
      COUNT(*) FILTER (WHERE is_favorite = TRUE) as favorite_count,
      COUNT(*) FILTER (WHERE is_public = TRUE) as shared_count,
      COALESCE(SUM(usage_count), 0) as total_usage
    FROM pb_saved_prompts
    WHERE user_id = $1
  `,
    [userId]
  );

  return result.rows[0];
}

/**
 * En popüler kategorileri getir
 */
export async function getPopularCategories(limit = 5) {
  const result = await query(
    `
    SELECT 
      c.*,
      COUNT(sp.id) as prompt_count,
      COALESCE(SUM(sp.usage_count), 0) as total_usage
    FROM pb_categories c
    LEFT JOIN pb_saved_prompts sp ON sp.category_id = c.id
    WHERE c.is_active = TRUE
    GROUP BY c.id
    ORDER BY total_usage DESC NULLS LAST
    LIMIT $1
  `,
    [limit]
  );

  return result.rows;
}

export default {
  getCategories,
  getCategoryBySlug,
  getQuestionsByCategory,
  getQuestionsByCategorySlug,
  getTemplatesByCategory,
  getTemplatesByCategorySlug,
  getTemplateById,
  generatePrompt,
  incrementTemplateUsage,
  savePrompt,
  getSavedPrompts,
  getSavedPromptById,
  updateSavedPrompt,
  deleteSavedPrompt,
  logUsage,
  getPublicPrompts,
  getUserStats,
  getPopularCategories,
};
