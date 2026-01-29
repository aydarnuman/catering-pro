/**
 * Tags Routes
 * Handles tag management for notes
 */

import express from 'express';
import { pool } from '../../database.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware
router.use(authenticate);

/**
 * GET /api/notes/tags
 * List all tags for the user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, name, color, usage_count, created_at
       FROM note_tags_master
       WHERE user_id = $1
       ORDER BY usage_count DESC, name ASC`,
      [userId]
    );

    res.json({
      success: true,
      tags: result.rows,
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Etiketler yüklenirken hata oluştu' });
  }
});

/**
 * GET /api/notes/tags/suggestions
 * Get tag suggestions for autocomplete
 */
router.get('/suggestions', async (req, res) => {
  try {
    const userId = req.user.id;
    const { q = '', limit = 20 } = req.query;

    let query = `
      SELECT id, name, color, usage_count
      FROM note_tags_master
      WHERE user_id = $1
    `;
    const params = [userId];

    if (q) {
      query += ` AND name ILIKE $2`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY usage_count DESC, name ASC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      suggestions: result.rows,
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Etiket önerileri yüklenirken hata oluştu' });
  }
});

/**
 * POST /api/notes/tags
 * Create a new tag
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, color = 'gray' } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Etiket adı boş olamaz' });
    }

    const result = await pool.query(
      `INSERT INTO note_tags_master (user_id, name, color)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, name) DO UPDATE SET color = $3
       RETURNING *`,
      [userId, name.trim(), color]
    );

    res.status(201).json({
      success: true,
      tag: result.rows[0],
      message: 'Etiket oluşturuldu',
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Etiket oluşturulurken hata oluştu' });
  }
});

/**
 * PUT /api/notes/tags/:tagId
 * Update a tag
 */
router.put('/:tagId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { tagId } = req.params;
    const { name, color } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Etiket adı boş olamaz' });
      }
      updates.push(`name = $${paramIndex}`);
      params.push(name.trim());
      paramIndex++;
    }

    if (color !== undefined) {
      updates.push(`color = $${paramIndex}`);
      params.push(color);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Güncellenecek veri yok' });
    }

    params.push(parseInt(tagId, 10), userId);
    const result = await pool.query(
      `UPDATE note_tags_master
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Etiket bulunamadı' });
    }

    res.json({
      success: true,
      tag: result.rows[0],
      message: 'Etiket güncellendi',
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Etiket güncellenirken hata oluştu' });
  }
});

/**
 * DELETE /api/notes/tags/:tagId
 * Delete a tag
 */
router.delete('/:tagId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { tagId } = req.params;

    const result = await pool.query(
      `DELETE FROM note_tags_master
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [parseInt(tagId, 10), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Etiket bulunamadı' });
    }

    res.json({ success: true, message: 'Etiket silindi' });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Etiket silinirken hata oluştu' });
  }
});

/**
 * PUT /api/notes/:noteId/tags (mounted from personal.js but defined here for clarity)
 * This route is handled in the main router by redirecting
 */

export default router;
