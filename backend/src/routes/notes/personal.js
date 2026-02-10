/**
 * Personal Notes Routes
 * Handles personal (non-context) notes operations
 */

import express from 'express';
import { pool } from '../../database.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticate);

/**
 * GET /api/notes
 * List personal notes with filtering
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      is_task,
      is_completed,
      priority,
      color,
      pinned,
      due_date_from,
      due_date_to,
      search,
      limit = 100,
      offset = 0,
    } = req.query;

    let query = `
      SELECT
        n.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM note_tags nt
           JOIN note_tags_master t ON nt.tag_id = t.id
           WHERE nt.note_id = n.id),
          '[]'::json
        ) as tags,
        COALESCE(
          (SELECT json_agg(json_build_object(
              'id', a.id,
              'filename', a.filename,
              'original_filename', a.original_filename,
              'file_type', a.file_type,
              'file_size', a.file_size
          ))
           FROM unified_note_attachments a
           WHERE a.note_id = n.id),
          '[]'::json
        ) as attachments,
        COALESCE(
          (SELECT json_agg(json_build_object(
              'id', r.id,
              'reminder_date', r.reminder_date,
              'reminder_type', r.reminder_type,
              'reminder_sent', r.reminder_sent
          ))
           FROM unified_note_reminders r
           WHERE r.note_id = n.id AND r.reminder_sent = FALSE),
          '[]'::json
        ) as reminders
      FROM unified_notes n
      WHERE n.user_id = $1
        AND n.context_type IS NULL
    `;

    const params = [userId];
    let paramIndex = 2;

    // Apply filters
    if (is_task !== undefined) {
      query += ` AND n.is_task = $${paramIndex}`;
      params.push(is_task === 'true');
      paramIndex++;
    }

    if (is_completed !== undefined) {
      query += ` AND n.is_completed = $${paramIndex}`;
      params.push(is_completed === 'true');
      paramIndex++;
    }

    if (priority) {
      query += ` AND n.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (color) {
      query += ` AND n.color = $${paramIndex}`;
      params.push(color);
      paramIndex++;
    }

    if (pinned !== undefined) {
      query += ` AND n.pinned = $${paramIndex}`;
      params.push(pinned === 'true');
      paramIndex++;
    }

    if (due_date_from) {
      query += ` AND n.due_date >= $${paramIndex}`;
      params.push(due_date_from);
      paramIndex++;
    }

    if (due_date_to) {
      query += ` AND n.due_date <= $${paramIndex}`;
      params.push(due_date_to);
      paramIndex++;
    }

    if (search) {
      query += ` AND n.content ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Ordering: pinned first, then by due date, then by sort_order
    query += `
      ORDER BY
        n.pinned DESC NULLS LAST,
        n.is_completed ASC,
        CASE WHEN n.due_date IS NOT NULL THEN 0 ELSE 1 END,
        n.due_date ASC NULLS LAST,
        CASE n.priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'low' THEN 3
        END,
        n.sort_order ASC,
        n.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM unified_notes
      WHERE user_id = $1 AND context_type IS NULL
    `;
    const countResult = await pool.query(countQuery, [userId]);

    res.json({
      success: true,
      notes: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Notlar yüklenirken hata oluştu' });
  }
});

/**
 * GET /api/notes/:id
 * Get single note by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const query = `
      SELECT
        n.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM note_tags nt
           JOIN note_tags_master t ON nt.tag_id = t.id
           WHERE nt.note_id = n.id),
          '[]'::json
        ) as tags,
        COALESCE(
          (SELECT json_agg(json_build_object(
              'id', a.id,
              'filename', a.filename,
              'original_filename', a.original_filename,
              'file_type', a.file_type,
              'file_size', a.file_size
          ))
           FROM unified_note_attachments a
           WHERE a.note_id = n.id),
          '[]'::json
        ) as attachments,
        COALESCE(
          (SELECT json_agg(json_build_object(
              'id', r.id,
              'reminder_date', r.reminder_date,
              'reminder_type', r.reminder_type,
              'reminder_sent', r.reminder_sent
          ))
           FROM unified_note_reminders r
           WHERE r.note_id = n.id AND r.reminder_sent = FALSE),
          '[]'::json
        ) as reminders
      FROM unified_notes n
      WHERE n.id = $1 AND n.user_id = $2
    `;

    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    }

    res.json({ success: true, note: result.rows[0] });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Not yüklenirken hata oluştu' });
  }
});

/**
 * POST /api/notes
 * Create a new personal note
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const {
      title = null,
      content,
      content_format = 'plain',
      is_task = false,
      priority = 'normal',
      color = 'blue',
      pinned = false,
      due_date = null,
      reminder_date = null,
      tags = [],
      metadata = null,
    } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Not içeriği boş olamaz' });
    }

    await client.query('BEGIN');

    // Get next sort order
    const orderResult = await client.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
       FROM unified_notes
       WHERE user_id = $1 AND context_type IS NULL`,
      [userId]
    );
    const sortOrder = orderResult.rows[0].next_order;

    // Insert note
    const insertQuery = `
      INSERT INTO unified_notes (
        user_id, title, content, content_format, is_task, priority, color,
        pinned, due_date, reminder_date, sort_order, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12::jsonb, '{}'::jsonb))
      RETURNING *
    `;

    const noteResult = await client.query(insertQuery, [
      userId,
      title?.trim() || null,
      content.trim(),
      content_format,
      is_task,
      priority,
      color,
      pinned,
      due_date,
      reminder_date,
      sortOrder,
      metadata ? JSON.stringify(metadata) : null,
    ]);

    const note = noteResult.rows[0];

    // Add tags
    const addedTags = [];
    for (const tagName of tags) {
      if (tagName?.trim()) {
        // Get or create tag
        const tagResult = await client.query(
          `INSERT INTO note_tags_master (user_id, name)
           VALUES ($1, $2)
           ON CONFLICT (user_id, name) DO UPDATE SET usage_count = note_tags_master.usage_count
           RETURNING id, name, color`,
          [userId, tagName.trim()]
        );
        const tag = tagResult.rows[0];

        // Link tag to note
        await client.query(`INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
          note.id,
          tag.id,
        ]);

        addedTags.push(tag);
      }
    }

    // Add reminder if provided
    const reminders = [];
    if (reminder_date) {
      const reminderResult = await client.query(
        `INSERT INTO unified_note_reminders (note_id, user_id, reminder_date)
         VALUES ($1, $2, $3)
         RETURNING id, reminder_date, reminder_type, reminder_sent`,
        [note.id, userId, reminder_date]
      );
      reminders.push(reminderResult.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      note: {
        ...note,
        tags: addedTags,
        attachments: [],
        reminders,
      },
      message: 'Not başarıyla oluşturuldu',
    });
  } catch (_error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Not oluşturulurken hata oluştu' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/notes/:id
 * Update a note
 */
router.put('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      title,
      content,
      content_format,
      is_task,
      is_completed,
      priority,
      color,
      pinned,
      due_date,
      reminder_date,
      sort_order,
      tags,
      metadata,
    } = req.body;

    await client.query('BEGIN');

    // Verify note ownership
    const checkResult = await client.query(`SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2`, [id, userId]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(title?.trim() || null);
      paramIndex++;
    }

    if (content !== undefined) {
      if (content.trim() === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Not içeriği boş olamaz' });
      }
      updates.push(`content = $${paramIndex}`);
      params.push(content.trim());
      paramIndex++;
    }

    if (content_format !== undefined) {
      updates.push(`content_format = $${paramIndex}`);
      params.push(content_format);
      paramIndex++;
    }

    if (is_task !== undefined) {
      updates.push(`is_task = $${paramIndex}`);
      params.push(is_task);
      paramIndex++;
    }

    if (is_completed !== undefined) {
      updates.push(`is_completed = $${paramIndex}`);
      params.push(is_completed);
      paramIndex++;

      // Set completed_at timestamp
      if (is_completed) {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }

    if (color !== undefined) {
      updates.push(`color = $${paramIndex}`);
      params.push(color);
      paramIndex++;
    }

    if (pinned !== undefined) {
      updates.push(`pinned = $${paramIndex}`);
      params.push(pinned);
      paramIndex++;
    }

    if (due_date !== undefined) {
      updates.push(`due_date = $${paramIndex}`);
      params.push(due_date);
      paramIndex++;
    }

    if (reminder_date !== undefined) {
      updates.push(`reminder_date = $${paramIndex}`);
      params.push(reminder_date);
      paramIndex++;
    }

    if (sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex}`);
      params.push(sort_order);
      paramIndex++;
    }

    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(metadata));
      paramIndex++;
    }

    if (updates.length > 0) {
      params.push(id);
      const updateQuery = `
        UPDATE unified_notes
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      await client.query(updateQuery, params);
    }

    // Update tags if provided
    if (tags !== undefined) {
      // Remove existing tags
      await client.query(`DELETE FROM note_tags WHERE note_id = $1`, [id]);

      // Add new tags
      for (const tagName of tags) {
        if (tagName?.trim()) {
          const tagResult = await client.query(
            `INSERT INTO note_tags_master (user_id, name)
             VALUES ($1, $2)
             ON CONFLICT (user_id, name) DO UPDATE SET usage_count = note_tags_master.usage_count
             RETURNING id`,
            [userId, tagName.trim()]
          );
          await client.query(`INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
            id,
            tagResult.rows[0].id,
          ]);
        }
      }
    }

    // Update reminder if provided
    if (reminder_date !== undefined) {
      // Remove existing unsent reminders
      await client.query(`DELETE FROM unified_note_reminders WHERE note_id = $1 AND reminder_sent = FALSE`, [id]);

      // Add new reminder if date provided
      if (reminder_date) {
        await client.query(
          `INSERT INTO unified_note_reminders (note_id, user_id, reminder_date)
           VALUES ($1, $2, $3)`,
          [id, userId, reminder_date]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch updated note with all relations
    const noteQuery = `
      SELECT
        n.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM note_tags nt
           JOIN note_tags_master t ON nt.tag_id = t.id
           WHERE nt.note_id = n.id),
          '[]'::json
        ) as tags,
        COALESCE(
          (SELECT json_agg(json_build_object(
              'id', a.id,
              'filename', a.filename,
              'original_filename', a.original_filename,
              'file_type', a.file_type,
              'file_size', a.file_size
          ))
           FROM unified_note_attachments a
           WHERE a.note_id = n.id),
          '[]'::json
        ) as attachments,
        COALESCE(
          (SELECT json_agg(json_build_object(
              'id', r.id,
              'reminder_date', r.reminder_date,
              'reminder_type', r.reminder_type,
              'reminder_sent', r.reminder_sent
          ))
           FROM unified_note_reminders r
           WHERE r.note_id = n.id AND r.reminder_sent = FALSE),
          '[]'::json
        ) as reminders
      FROM unified_notes n
      WHERE n.id = $1
    `;
    const noteResult = await pool.query(noteQuery, [id]);

    res.json({
      success: true,
      note: noteResult.rows[0],
      message: 'Not güncellendi',
    });
  } catch (_error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Not güncellenirken hata oluştu' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/notes/:id
 * Delete a note
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(`DELETE FROM unified_notes WHERE id = $1 AND user_id = $2 RETURNING id`, [
      id,
      userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    }

    res.json({ success: true, message: 'Not silindi' });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Not silinirken hata oluştu' });
  }
});

/**
 * PUT /api/notes/:id/toggle
 * Toggle note completion status
 */
router.put('/:id/toggle', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE unified_notes
       SET is_completed = NOT is_completed,
           completed_at = CASE WHEN is_completed THEN NULL ELSE NOW() END
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    }

    const note = result.rows[0];
    res.json({
      success: true,
      note,
      message: note.is_completed ? 'Not tamamlandı' : 'Not tamamlanmadı olarak işaretlendi',
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Not güncellenirken hata oluştu' });
  }
});

/**
 * PUT /api/notes/:id/pin
 * Toggle note pin status
 */
router.put('/:id/pin', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE unified_notes
       SET pinned = NOT pinned
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    }

    const note = result.rows[0];
    res.json({
      success: true,
      note,
      message: note.pinned ? 'Not sabitlendi' : 'Not sabitleme kaldırıldı',
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Not güncellenirken hata oluştu' });
  }
});

/**
 * PUT /api/notes/reorder
 * Reorder notes (drag-drop)
 */
router.put('/reorder', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { noteIds } = req.body;

    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Geçersiz sıralama verisi' });
    }

    await client.query('BEGIN');

    // Update sort_order for each note
    for (let i = 0; i < noteIds.length; i++) {
      await client.query(
        `UPDATE unified_notes
         SET sort_order = $1
         WHERE id = $2 AND user_id = $3`,
        [i, noteIds[i], userId]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true, message: 'Sıralama güncellendi' });
  } catch (_error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Sıralama güncellenirken hata oluştu' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/notes/completed
 * Delete all completed notes
 */
router.delete('/completed', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `DELETE FROM unified_notes
       WHERE user_id = $1 AND context_type IS NULL AND is_completed = TRUE
       RETURNING id`,
      [userId]
    );

    res.json({
      success: true,
      deleted: result.rowCount,
      message: `${result.rowCount} tamamlanmış not silindi`,
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Notlar silinirken hata oluştu' });
  }
});

export default router;
