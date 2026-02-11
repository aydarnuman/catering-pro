/**
 * Contextual Notes Routes
 * Handles context-bound notes (tender, customer, event, etc.)
 */

import express from 'express';
import { pool } from '../../database.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware
router.use(authenticate);

// Valid context types
const VALID_CONTEXT_TYPES = [
  'tender',
  'customer',
  'event',
  'project',
  'contractor',
  'invoice',
  'stock',
  'personnel',
  'purchasing',
  'asset',
  'finance',
  'menu',
  'recipe',
];

/**
 * GET /api/notes/context/:type/:id
 * Get all notes for a specific context
 */
router.get('/:type/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    if (!VALID_CONTEXT_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Geçersiz bağlam tipi' });
    }

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
      WHERE n.user_id = $1
        AND n.context_type = $2
        AND n.context_id = $3
      ORDER BY
        n.pinned DESC NULLS LAST,
        n.sort_order ASC,
        n.created_at DESC
      LIMIT $4 OFFSET $5
    `;

    const result = await pool.query(query, [userId, type, parseInt(id, 10), parseInt(limit, 10), parseInt(offset, 10)]);

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM unified_notes
       WHERE user_id = $1 AND context_type = $2 AND context_id = $3`,
      [userId, type, parseInt(id, 10)]
    );

    res.json({
      success: true,
      notes: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      context_type: type,
      context_id: parseInt(id, 10),
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Notlar yüklenirken hata oluştu' });
  }
});

/**
 * POST /api/notes/context/:type/:id
 * Create a note for a specific context
 */
router.post('/:type/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { type, id: contextId } = req.params;
    const {
      title = null,
      content,
      content_format = 'markdown',
      is_task = false,
      priority = 'normal',
      color = 'yellow',
      pinned = false,
      due_date = null,
      reminder_date = null,
      tags = [],
      metadata = null,
    } = req.body;

    if (!VALID_CONTEXT_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Geçersiz bağlam tipi' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Not içeriği boş olamaz' });
    }

    await client.query('BEGIN');

    // Get next sort order for this context
    const orderResult = await client.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
       FROM unified_notes
       WHERE user_id = $1 AND context_type = $2 AND context_id = $3`,
      [userId, type, parseInt(contextId, 10)]
    );
    const sortOrder = orderResult.rows[0].next_order;

    // Insert note
    const insertQuery = `
      INSERT INTO unified_notes (
        user_id, context_type, context_id, title, content, content_format,
        is_task, priority, color, pinned, due_date, reminder_date, sort_order, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14::jsonb, '{}'::jsonb))
      RETURNING *
    `;

    const noteResult = await client.query(insertQuery, [
      userId,
      type,
      parseInt(contextId, 10),
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
        const tagResult = await client.query(
          `INSERT INTO note_tags_master (user_id, name)
           VALUES ($1, $2)
           ON CONFLICT (user_id, name) DO UPDATE SET usage_count = note_tags_master.usage_count
           RETURNING id, name, color`,
          [userId, tagName.trim()]
        );
        const tag = tagResult.rows[0];

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
 * PUT /api/notes/context/:type/:id/reorder
 * Reorder notes for a specific context
 */
router.put('/:type/:id/reorder', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { type, id: contextId } = req.params;
    const { noteIds } = req.body;

    if (!VALID_CONTEXT_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Geçersiz bağlam tipi' });
    }

    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Geçersiz sıralama verisi' });
    }

    await client.query('BEGIN');

    // Update sort_order for each note
    for (let i = 0; i < noteIds.length; i++) {
      await client.query(
        `UPDATE unified_notes
         SET sort_order = $1
         WHERE id = $2 AND user_id = $3 AND context_type = $4 AND context_id = $5`,
        [i, noteIds[i], userId, type, parseInt(contextId, 10)]
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

export default router;
