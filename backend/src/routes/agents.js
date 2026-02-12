/**
 * Agent Management API Routes
 * Merkezi agent yönetimi için CRUD endpoint'leri
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { query } from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Multer config for knowledge base file uploads
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = 'uploads/agent-knowledge';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece PDF, DOC, DOCX, TXT ve MD dosyaları yüklenebilir'));
    }
  },
});

// =============================================
// GET /api/agents - Tüm aktif agent'ları listele
// =============================================
router.get('/', authenticate, async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM agent_tools WHERE agent_id = a.id AND is_active = TRUE) as tool_count,
        (SELECT COUNT(*) FROM agent_knowledge_base WHERE agent_id = a.id AND is_active = TRUE) as knowledge_count
      FROM agents a
      WHERE a.is_active = TRUE
      ORDER BY a.name ASC
    `);

    return res.json({
      success: true,
      agents: rows,
      count: rows.length,
    });
  } catch (error) {
    logger.error('[Agents] List error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Agent listesi yüklenemedi',
    });
  }
});

// =============================================
// GET /api/agents/context/:contextKey - Bağlama göre agent'lar
// =============================================
router.get('/context/:contextKey', authenticate, async (req, res) => {
  try {
    const { contextKey } = req.params;

    // Get agents for this context
    const { rows: agents } = await query(
      `
      SELECT 
        a.*,
        ac.sort_order as context_sort_order
      FROM agents a
      JOIN agent_contexts ac ON ac.agent_id = a.id
      WHERE ac.context_key = $1 
        AND ac.is_active = TRUE 
        AND a.is_active = TRUE
      ORDER BY ac.sort_order ASC, a.name ASC
    `,
      [contextKey]
    );

    if (agents.length === 0) {
      return res.json({
        success: true,
        agents: [],
        tools: [],
        context: contextKey,
      });
    }

    // Get all tools for these agents
    const agentIds = agents.map((a) => a.id);
    const { rows: tools } = await query(
      `
      SELECT 
        t.*,
        a.slug as agent_slug
      FROM agent_tools t
      JOIN agents a ON a.id = t.agent_id
      WHERE t.agent_id = ANY($1::text[])
        AND t.is_active = TRUE
      ORDER BY t.sort_order ASC, t.label ASC
    `,
      [agentIds]
    );

    return res.json({
      success: true,
      agents,
      tools,
      context: contextKey,
    });
  } catch (error) {
    logger.error('[Agents] Context lookup error', { error: error.message, contextKey: req.params.contextKey });
    return res.status(500).json({
      success: false,
      error: 'Agent listesi yüklenemedi',
    });
  }
});

// =============================================
// GET /api/agents/:slug - Tek agent detayı
// =============================================
router.get('/:slug', authenticate, async (req, res) => {
  try {
    const { slug } = req.params;

    const {
      rows: [agent],
    } = await query(
      `
      SELECT * FROM agents WHERE slug = $1
    `,
      [slug]
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent bulunamadı',
      });
    }

    // Get tools
    const { rows: tools } = await query(
      `
      SELECT * FROM agent_tools 
      WHERE agent_id = $1 AND is_active = TRUE
      ORDER BY sort_order ASC, label ASC
    `,
      [agent.id]
    );

    // Get knowledge count
    const {
      rows: [knowledgeStats],
    } = await query(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN content_type = 'pdf' THEN 1 END) as pdf_count,
        COUNT(CASE WHEN content_type = 'url' THEN 1 END) as url_count,
        COUNT(CASE WHEN content_type = 'note' THEN 1 END) as note_count
      FROM agent_knowledge_base 
      WHERE agent_id = $1 AND is_active = TRUE
    `,
      [agent.id]
    );

    // Get contexts
    const { rows: contexts } = await query(
      `
      SELECT * FROM agent_contexts 
      WHERE agent_id = $1 AND is_active = TRUE
      ORDER BY sort_order ASC
    `,
      [agent.id]
    );

    return res.json({
      success: true,
      agent: {
        ...agent,
        tools,
        knowledgeStats,
        contexts,
      },
    });
  } catch (error) {
    logger.error('[Agents] Detail error', { error: error.message, slug: req.params.slug });
    return res.status(500).json({
      success: false,
      error: 'Agent detayı yüklenemedi',
    });
  }
});

// =============================================
// PUT /api/agents/:slug - Agent güncelle (Admin)
// =============================================
router.put('/:slug', authenticate, requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      name,
      subtitle,
      description,
      icon,
      color,
      accent_hex,
      system_prompt,
      model,
      temperature,
      max_tokens,
      verdict_weight,
      is_active,
    } = req.body;

    // Check if agent exists
    const {
      rows: [existing],
    } = await query(
      `
      SELECT id, is_system FROM agents WHERE slug = $1
    `,
      [slug]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Agent bulunamadı',
      });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    const addUpdate = (field, value) => {
      if (value !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    };

    addUpdate('name', name);
    addUpdate('subtitle', subtitle);
    addUpdate('description', description);
    addUpdate('icon', icon);
    addUpdate('color', color);
    addUpdate('accent_hex', accent_hex);
    addUpdate('system_prompt', system_prompt);
    addUpdate('model', model);
    addUpdate('temperature', temperature);
    addUpdate('max_tokens', max_tokens);
    addUpdate('verdict_weight', verdict_weight);

    // is_active only if not a system agent
    if (is_active !== undefined && !existing.is_system) {
      addUpdate('is_active', is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Güncellenecek alan belirtilmedi',
      });
    }

    params.push(slug);
    const {
      rows: [updated],
    } = await query(
      `
      UPDATE agents 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE slug = $${paramIndex}
      RETURNING *
    `,
      params
    );

    logger.info(`[Agents] Updated: ${slug}`, { slug, updates: Object.keys(req.body) });

    return res.json({
      success: true,
      agent: updated,
    });
  } catch (error) {
    logger.error('[Agents] Update error', { error: error.message, slug: req.params.slug });
    return res.status(500).json({
      success: false,
      error: 'Agent güncellenemedi',
    });
  }
});

// =============================================
// TOOLS ENDPOINTS
// =============================================

// GET /api/agents/:slug/tools
router.get('/:slug/tools', authenticate, async (req, res) => {
  try {
    const { slug } = req.params;

    const {
      rows: [agent],
    } = await query(`SELECT id FROM agents WHERE slug = $1`, [slug]);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent bulunamadı' });
    }

    const { rows: tools } = await query(
      `
      SELECT * FROM agent_tools 
      WHERE agent_id = $1
      ORDER BY sort_order ASC, label ASC
    `,
      [agent.id]
    );

    return res.json({ success: true, tools });
  } catch (error) {
    logger.error('[Agent Tools] List error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Tool listesi yüklenemedi' });
  }
});

// POST /api/agents/:slug/tools - Tool ekle (Admin)
router.post('/:slug/tools', authenticate, requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      tool_slug,
      label,
      description,
      icon,
      requires_selection,
      tool_type,
      ai_prompt_template,
      urgency_priority,
      sort_order,
    } = req.body;

    if (!tool_slug || !label) {
      return res.status(400).json({ success: false, error: 'tool_slug ve label zorunlu' });
    }

    const {
      rows: [agent],
    } = await query(`SELECT id FROM agents WHERE slug = $1`, [slug]);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent bulunamadı' });
    }

    const {
      rows: [tool],
    } = await query(
      `
      INSERT INTO agent_tools (agent_id, tool_slug, label, description, icon, requires_selection, tool_type, ai_prompt_template, urgency_priority, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
      [
        agent.id,
        tool_slug,
        label,
        description,
        icon,
        requires_selection || false,
        tool_type || 'ai_prompt',
        ai_prompt_template,
        urgency_priority || 5,
        sort_order || 0,
      ]
    );

    logger.info(`[Agent Tools] Created: ${slug}/${tool_slug}`);
    return res.json({ success: true, tool });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Bu tool_slug zaten mevcut' });
    }
    logger.error('[Agent Tools] Create error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Tool eklenemedi' });
  }
});

// PUT /api/agents/:slug/tools/:toolSlug - Tool güncelle (Admin)
router.put('/:slug/tools/:toolSlug', authenticate, requireAdmin, async (req, res) => {
  try {
    const { slug, toolSlug } = req.params;
    const {
      label,
      description,
      icon,
      requires_selection,
      tool_type,
      ai_prompt_template,
      urgency_priority,
      sort_order,
      is_active,
    } = req.body;

    const {
      rows: [agent],
    } = await query(`SELECT id FROM agents WHERE slug = $1`, [slug]);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent bulunamadı' });
    }

    const {
      rows: [tool],
    } = await query(
      `
      UPDATE agent_tools 
      SET 
        label = COALESCE($3, label),
        description = COALESCE($4, description),
        icon = COALESCE($5, icon),
        requires_selection = COALESCE($6, requires_selection),
        tool_type = COALESCE($7, tool_type),
        ai_prompt_template = COALESCE($8, ai_prompt_template),
        urgency_priority = COALESCE($9, urgency_priority),
        sort_order = COALESCE($10, sort_order),
        is_active = COALESCE($11, is_active),
        updated_at = NOW()
      WHERE agent_id = $1 AND tool_slug = $2
      RETURNING *
    `,
      [
        agent.id,
        toolSlug,
        label,
        description,
        icon,
        requires_selection,
        tool_type,
        ai_prompt_template,
        urgency_priority,
        sort_order,
        is_active,
      ]
    );

    if (!tool) {
      return res.status(404).json({ success: false, error: 'Tool bulunamadı' });
    }

    logger.info(`[Agent Tools] Updated: ${slug}/${toolSlug}`);
    return res.json({ success: true, tool });
  } catch (error) {
    logger.error('[Agent Tools] Update error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Tool güncellenemedi' });
  }
});

// DELETE /api/agents/:slug/tools/:toolSlug - Tool sil (Admin)
router.delete('/:slug/tools/:toolSlug', authenticate, requireAdmin, async (req, res) => {
  try {
    const { slug, toolSlug } = req.params;

    const {
      rows: [agent],
    } = await query(`SELECT id FROM agents WHERE slug = $1`, [slug]);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent bulunamadı' });
    }

    const { rowCount } = await query(
      `
      DELETE FROM agent_tools WHERE agent_id = $1 AND tool_slug = $2
    `,
      [agent.id, toolSlug]
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Tool bulunamadı' });
    }

    logger.info(`[Agent Tools] Deleted: ${slug}/${toolSlug}`);
    return res.json({ success: true, message: 'Tool silindi' });
  } catch (error) {
    logger.error('[Agent Tools] Delete error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Tool silinemedi' });
  }
});

// =============================================
// KNOWLEDGE BASE ENDPOINTS
// =============================================

// GET /api/agents/:slug/knowledge
router.get('/:slug/knowledge', authenticate, async (req, res) => {
  try {
    const { slug } = req.params;
    const { content_type, limit = 50 } = req.query;

    const {
      rows: [agent],
    } = await query(`SELECT id FROM agents WHERE slug = $1`, [slug]);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent bulunamadı' });
    }

    let sql = `
      SELECT * FROM agent_knowledge_base 
      WHERE agent_id = $1 AND is_active = TRUE
    `;
    const params = [agent.id];

    if (content_type) {
      sql += ` AND content_type = $2`;
      params.push(content_type);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const { rows } = await query(sql, params);

    return res.json({ success: true, knowledge: rows, count: rows.length });
  } catch (error) {
    logger.error('[Agent Knowledge] List error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Kütüphane yüklenemedi' });
  }
});

// POST /api/agents/:slug/knowledge - Kaynak ekle
router.post('/:slug/knowledge', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content_type, content, summary, tags, source } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Başlık zorunlu' });
    }

    const {
      rows: [agent],
    } = await query(`SELECT id FROM agents WHERE slug = $1`, [slug]);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent bulunamadı' });
    }

    // Parse tags if string
    let parsedTags = tags;
    if (typeof tags === 'string') {
      try {
        parsedTags = JSON.parse(tags);
      } catch {
        parsedTags = tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }

    // Handle file upload
    let filePath = null;
    let fileSize = null;
    if (req.file) {
      filePath = req.file.path;
      fileSize = req.file.size;
    }

    const {
      rows: [knowledge],
    } = await query(
      `
      INSERT INTO agent_knowledge_base (agent_id, title, content_type, content, file_path, file_size, summary, tags, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [agent.id, title, content_type || 'note', content, filePath, fileSize, summary, parsedTags, source || 'manual']
    );

    logger.info(`[Agent Knowledge] Created: ${slug}/${knowledge.id}`);
    return res.json({ success: true, knowledge });
  } catch (error) {
    logger.error('[Agent Knowledge] Create error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Kaynak eklenemedi' });
  }
});

// PUT /api/agents/:slug/knowledge/:id - Kaynak güncelle
router.put('/:slug/knowledge/:id', authenticate, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const { title, content, summary, tags, is_active } = req.body;

    const {
      rows: [agent],
    } = await query(`SELECT id FROM agents WHERE slug = $1`, [slug]);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent bulunamadı' });
    }

    // Parse tags if string
    let parsedTags = tags;
    if (typeof tags === 'string') {
      try {
        parsedTags = JSON.parse(tags);
      } catch {
        parsedTags = tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }

    const {
      rows: [knowledge],
    } = await query(
      `
      UPDATE agent_knowledge_base 
      SET 
        title = COALESCE($3, title),
        content = COALESCE($4, content),
        summary = COALESCE($5, summary),
        tags = COALESCE($6, tags),
        is_active = COALESCE($7, is_active),
        updated_at = NOW()
      WHERE agent_id = $1 AND id = $2
      RETURNING *
    `,
      [agent.id, parseInt(id, 10), title, content, summary, parsedTags, is_active]
    );

    if (!knowledge) {
      return res.status(404).json({ success: false, error: 'Kaynak bulunamadı' });
    }

    logger.info(`[Agent Knowledge] Updated: ${slug}/${id}`);
    return res.json({ success: true, knowledge });
  } catch (error) {
    logger.error('[Agent Knowledge] Update error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Kaynak güncellenemedi' });
  }
});

// DELETE /api/agents/:slug/knowledge/:id - Kaynak sil
router.delete('/:slug/knowledge/:id', authenticate, async (req, res) => {
  try {
    const { slug, id } = req.params;

    const {
      rows: [agent],
    } = await query(`SELECT id FROM agents WHERE slug = $1`, [slug]);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent bulunamadı' });
    }

    // Get file path before delete (for cleanup)
    const {
      rows: [existing],
    } = await query(
      `
      SELECT file_path FROM agent_knowledge_base WHERE agent_id = $1 AND id = $2
    `,
      [agent.id, parseInt(id, 10)]
    );

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Kaynak bulunamadı' });
    }

    await query(`DELETE FROM agent_knowledge_base WHERE agent_id = $1 AND id = $2`, [agent.id, parseInt(id, 10)]);

    // Cleanup file if exists
    if (existing.file_path) {
      try {
        await fs.unlink(existing.file_path);
      } catch (e) {
        logger.warn(`[Agent Knowledge] File cleanup failed: ${existing.file_path}`, { error: e.message });
      }
    }

    logger.info(`[Agent Knowledge] Deleted: ${slug}/${id}`);
    return res.json({ success: true, message: 'Kaynak silindi' });
  } catch (error) {
    logger.error('[Agent Knowledge] Delete error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Kaynak silinemedi' });
  }
});

export default router;
