/**
 * Note Folders Routes
 * CRUD + password lock/unlock for note folders
 */

import bcrypt from 'bcryptjs';
import express from 'express';
import { pool } from '../../database.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/notes/folders
 * List user's folders (password_hash is NOT returned, only is_locked)
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        id, user_id, name, color, icon, sort_order,
        (password_hash IS NOT NULL) as is_locked,
        created_at, updated_at,
        (SELECT COUNT(*) FROM unified_notes WHERE folder_id = note_folders.id)::int as note_count
      FROM note_folders
      WHERE user_id = $1
      ORDER BY sort_order ASC, created_at ASC`,
      [userId]
    );

    res.json({ success: true, folders: result.rows });
  } catch (error) {
    console.error('Folder list error:', error);
    res.status(500).json({ success: false, message: 'Klasörler yüklenemedi' });
  }
});

/**
 * POST /api/notes/folders
 * Create a new folder
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, color = 'blue', icon = 'folder', password = null } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Klasör adı boş olamaz' });
    }

    // Hash password if provided
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Get next sort order
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM note_folders WHERE user_id = $1',
      [userId]
    );

    const result = await pool.query(
      `INSERT INTO note_folders (user_id, name, color, icon, password_hash, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, name, color, icon, sort_order,
         (password_hash IS NOT NULL) as is_locked, created_at, updated_at`,
      [userId, name.trim(), color, icon, passwordHash, orderResult.rows[0].next_order]
    );

    res.json({ success: true, folder: { ...result.rows[0], note_count: 0 } });
  } catch (error) {
    console.error('Folder create error:', error);
    res.status(500).json({ success: false, message: 'Klasör oluşturulamadı' });
  }
});

/**
 * PUT /api/notes/folders/:id
 * Update folder (name, color, icon, password)
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, color, icon, password, remove_password } = req.body;

    // Check ownership
    const existing = await pool.query(
      'SELECT id FROM note_folders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Klasör bulunamadı' });
    }

    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIdx}`);
      params.push(name.trim());
      paramIdx++;
    }
    if (color !== undefined) {
      updates.push(`color = $${paramIdx}`);
      params.push(color);
      paramIdx++;
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramIdx}`);
      params.push(icon);
      paramIdx++;
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIdx}`);
      params.push(hash);
      paramIdx++;
    }
    if (remove_password) {
      updates.push(`password_hash = NULL`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Güncellenecek alan yok' });
    }

    updates.push(`updated_at = NOW()`);

    params.push(id, userId);
    const result = await pool.query(
      `UPDATE note_folders SET ${updates.join(', ')}
       WHERE id = $${paramIdx} AND user_id = $${paramIdx + 1}
       RETURNING id, user_id, name, color, icon, sort_order,
         (password_hash IS NOT NULL) as is_locked, created_at, updated_at`,
      params
    );

    res.json({ success: true, folder: result.rows[0] });
  } catch (error) {
    console.error('Folder update error:', error);
    res.status(500).json({ success: false, message: 'Klasör güncellenemedi' });
  }
});

/**
 * DELETE /api/notes/folders/:id
 * Delete folder (notes become folder-less, NOT deleted)
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Move notes to no-folder first
    await pool.query(
      'UPDATE unified_notes SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2',
      [id, userId]
    );

    const result = await pool.query(
      'DELETE FROM note_folders WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Klasör bulunamadı' });
    }

    res.json({ success: true, message: 'Klasör silindi' });
  } catch (error) {
    console.error('Folder delete error:', error);
    res.status(500).json({ success: false, message: 'Klasör silinemedi' });
  }
});

/**
 * POST /api/notes/folders/:id/unlock
 * Verify folder password
 */
router.post('/:id/unlock', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Şifre gerekli' });
    }

    const result = await pool.query(
      'SELECT password_hash FROM note_folders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Klasör bulunamadı' });
    }

    const { password_hash } = result.rows[0];
    if (!password_hash) {
      return res.json({ success: true, unlocked: true });
    }

    const match = await bcrypt.compare(password, password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Yanlış şifre' });
    }

    res.json({ success: true, unlocked: true });
  } catch (error) {
    console.error('Folder unlock error:', error);
    res.status(500).json({ success: false, message: 'Kilit açılamadı' });
  }
});

/**
 * PUT /api/notes/folders/move-note
 * Move a note to a folder (or remove from folder)
 */
router.put('/move-note', async (req, res) => {
  try {
    const userId = req.user.id;
    const { note_id, folder_id } = req.body;

    if (!note_id) {
      return res.status(400).json({ success: false, message: 'note_id gerekli' });
    }

    // Verify note ownership
    const noteCheck = await pool.query(
      'SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2',
      [note_id, userId]
    );
    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    }

    // If folder_id provided, verify folder ownership
    if (folder_id) {
      const folderCheck = await pool.query(
        'SELECT id FROM note_folders WHERE id = $1 AND user_id = $2',
        [folder_id, userId]
      );
      if (folderCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Klasör bulunamadı' });
      }
    }

    await pool.query(
      'UPDATE unified_notes SET folder_id = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [folder_id || null, note_id, userId]
    );

    res.json({ success: true, message: folder_id ? 'Not klasöre taşındı' : 'Not klasörden çıkarıldı' });
  } catch (error) {
    console.error('Move note error:', error);
    res.status(500).json({ success: false, message: 'Not taşınamadı' });
  }
});

export default router;
