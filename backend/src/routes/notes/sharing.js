/**
 * Note Sharing Routes
 * POST /api/notes/sharing/:noteId - Share a note
 * GET /api/notes/sharing/:noteId - Get shares for a note
 * DELETE /api/notes/sharing/:shareId - Remove a share
 * GET /api/notes/shared-with-me - Get notes shared with current user
 */

import express from 'express';
import { pool } from '../../database.js';
import { authenticate } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();
router.use(authenticate);

/**
 * POST /api/notes/sharing/:noteId
 * Share a note with another user
 */
router.post('/:noteId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;
    const { shared_with, permission = 'view' } = req.body;

    if (!shared_with) {
      return res.status(400).json({ success: false, message: 'Paylasilacak kullanici belirtilmedi' });
    }

    if (!['view', 'edit'].includes(permission)) {
      return res.status(400).json({ success: false, message: 'Gecersiz yetki tipi' });
    }

    // Verify note ownership
    const noteCheck = await pool.query('SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2', [noteId, userId]);

    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadi veya yetkiniz yok' });
    }

    // Cannot share with self
    if (shared_with === userId) {
      return res.status(400).json({ success: false, message: 'Kendinizle paylasamazsiniz' });
    }

    // Create share
    const result = await pool.query(
      `INSERT INTO note_shares (note_id, shared_by, shared_with, permission)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (note_id, shared_with) DO UPDATE SET permission = $4
       RETURNING *`,
      [noteId, userId, shared_with, permission]
    );

    res.status(201).json({
      success: true,
      share: result.rows[0],
      message: 'Not paylasidi',
    });
  } catch (error) {
    logger.error('Note share error:', error);
    res.status(500).json({ success: false, message: 'Paylasim olusturulurken hata' });
  }
});

/**
 * GET /api/notes/sharing/:noteId
 * Get all shares for a note
 */
router.get('/:noteId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;

    // Verify note ownership
    const noteCheck = await pool.query('SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2', [noteId, userId]);

    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadi veya yetkiniz yok' });
    }

    const result = await pool.query(
      `SELECT ns.*, u.name as shared_with_name, u.email as shared_with_email
       FROM note_shares ns
       JOIN users u ON u.id = ns.shared_with
       WHERE ns.note_id = $1
       ORDER BY ns.created_at DESC`,
      [noteId]
    );

    res.json({ success: true, shares: result.rows });
  } catch (error) {
    logger.error('Get shares error:', error);
    res.status(500).json({ success: false, message: 'Paylasimlar yuklenirken hata' });
  }
});

/**
 * DELETE /api/notes/sharing/:shareId
 * Remove a share
 */
router.delete('/:shareId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { shareId } = req.params;

    // Verify ownership (shared_by must be current user)
    const result = await pool.query('DELETE FROM note_shares WHERE id = $1 AND shared_by = $2 RETURNING id', [
      shareId,
      userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Paylasim bulunamadi' });
    }

    res.json({ success: true, message: 'Paylasim kaldirildi' });
  } catch (error) {
    logger.error('Delete share error:', error);
    res.status(500).json({ success: false, message: 'Paylasim kaldirilirken hata' });
  }
});

/**
 * GET /api/notes/shared-with-me
 * Get notes shared with current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        n.*,
        ns.permission,
        ns.shared_by,
        u.name as shared_by_name,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM note_tags nt
           JOIN note_tags_master t ON nt.tag_id = t.id
           WHERE nt.note_id = n.id),
          '[]'::json
        ) as tags,
        '[]'::json as attachments,
        '[]'::json as reminders
      FROM unified_notes n
      JOIN note_shares ns ON ns.note_id = n.id
      JOIN users u ON u.id = ns.shared_by
      WHERE ns.shared_with = $1
      ORDER BY ns.created_at DESC
      LIMIT 100`,
      [userId]
    );

    res.json({
      success: true,
      notes: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    logger.error('Shared with me error:', error);
    res.status(500).json({ success: false, message: 'Paylasilan notlar yuklenirken hata' });
  }
});

export default router;
