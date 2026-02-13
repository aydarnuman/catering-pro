/**
 * Notes Service Layer
 * Centralizes database operations for the unified notes system.
 * Route handlers should use these functions instead of raw SQL.
 */

import { pool } from '../database.js';
import logger from '../utils/logger.js';

// ────────────────────────────────────────────────
// Shared SQL fragments
// ────────────────────────────────────────────────

/** Subquery: aggregate tags as JSON array */
const TAGS_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
     FROM note_tags nt
     JOIN note_tags_master t ON nt.tag_id = t.id
     WHERE nt.note_id = n.id),
    '[]'::json
  ) as tags`;

/** Subquery: aggregate attachments as JSON array */
const ATTACHMENTS_SUBQUERY = `
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
  ) as attachments`;

/** Subquery: aggregate pending reminders as JSON array */
const REMINDERS_SUBQUERY = `
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
  ) as reminders`;

/** Full SELECT with all related data */
const NOTE_SELECT = `
  SELECT
    n.*,
    ${TAGS_SUBQUERY},
    ${ATTACHMENTS_SUBQUERY},
    ${REMINDERS_SUBQUERY}
  FROM unified_notes n`;

/** Standard ordering for notes */
const STANDARD_ORDER = `
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
    n.created_at DESC`;

// ────────────────────────────────────────────────
// Query helpers
// ────────────────────────────────────────────────

/**
 * Get a single note by ID and user (with tags, attachments, reminders)
 */
export async function getNoteById(noteId, userId) {
  const query = `${NOTE_SELECT} WHERE n.id = $1 AND n.user_id = $2`;
  const result = await pool.query(query, [noteId, userId]);
  return result.rows[0] || null;
}

/**
 * List personal notes with optional filters
 */
export async function listPersonalNotes(userId, filters = {}) {
  const {
    is_task,
    is_completed,
    priority,
    color,
    pinned,
    due_date_from,
    due_date_to,
    search,
    folder_id,
    limit = 100,
    offset = 0,
  } = filters;

  let query = `${NOTE_SELECT} WHERE n.user_id = $1 AND n.context_type IS NULL`;
  const params = [userId];
  let paramIndex = 2;

  if (is_task !== undefined) {
    query += ` AND n.is_task = $${paramIndex}`;
    params.push(is_task === 'true' || is_task === true);
    paramIndex++;
  }

  if (is_completed !== undefined) {
    query += ` AND n.is_completed = $${paramIndex}`;
    params.push(is_completed === 'true' || is_completed === true);
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
    params.push(pinned === 'true' || pinned === true);
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
    query += ` AND (n.content ILIKE $${paramIndex} OR n.title ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (folder_id !== undefined) {
    if (folder_id === 'null' || folder_id === '') {
      query += ' AND n.folder_id IS NULL';
    } else {
      query += ` AND n.folder_id = $${paramIndex}`;
      params.push(parseInt(folder_id, 10));
      paramIndex++;
    }
  }

  query += STANDARD_ORDER;
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const result = await pool.query(query, params);

  // Total count
  const countResult = await pool.query(
    'SELECT COUNT(*) as total FROM unified_notes WHERE user_id = $1 AND context_type IS NULL',
    [userId]
  );

  return {
    notes: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  };
}

/**
 * List context notes for a given entity
 */
export async function listContextNotes(userId, contextType, contextId, filters = {}) {
  const { limit = 100, offset = 0 } = filters;

  const query = `${NOTE_SELECT}
    WHERE n.user_id = $1 AND n.context_type = $2 AND n.context_id = $3
    ${STANDARD_ORDER}
    LIMIT $4 OFFSET $5`;

  const result = await pool.query(query, [userId, contextType, contextId, parseInt(limit, 10), parseInt(offset, 10)]);

  const countResult = await pool.query(
    'SELECT COUNT(*) as total FROM unified_notes WHERE user_id = $1 AND context_type = $2 AND context_id = $3',
    [userId, contextType, contextId]
  );

  return {
    notes: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
}

/**
 * Create a note (personal or contextual) within a transaction
 */
export async function createNote(userId, data) {
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
    folder_id = null,
    context_type = null,
    context_id = null,
  } = data;

  if (!content || content.trim() === '') {
    throw new Error('Not icerigi bos olamaz');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get next sort order
    const contextFilter = context_type
      ? `AND context_type = '${context_type}' AND context_id = ${context_id}`
      : 'AND context_type IS NULL';

    const orderResult = await client.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM unified_notes WHERE user_id = $1 ${contextFilter}`,
      [userId]
    );
    const sortOrder = orderResult.rows[0].next_order;

    const insertQuery = `
      INSERT INTO unified_notes (
        user_id, title, content, content_format, is_task, priority, color,
        pinned, due_date, reminder_date, sort_order, metadata, folder_id,
        context_type, context_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12::jsonb, '{}'::jsonb), $13, $14, $15)
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
      folder_id,
      context_type,
      context_id,
    ]);

    const note = noteResult.rows[0];

    // Process tags
    if (tags.length > 0) {
      await processTags(client, userId, note.id, tags);
    }

    await client.query('COMMIT');

    // Fetch full note with relations
    const fullNote = await getNoteById(note.id, userId);
    return fullNote;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Note create error', { error: error.message, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update a note
 */
export async function updateNote(noteId, userId, data) {
  const client = await pool.connect();

  try {
    // Verify ownership
    const existing = await client.query('SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2', [
      noteId,
      userId,
    ]);
    if (existing.rows.length === 0) return null;

    await client.query('BEGIN');

    // Build dynamic UPDATE
    const fields = [];
    const values = [];
    let idx = 1;

    const updatableFields = [
      'title',
      'content',
      'content_format',
      'is_task',
      'priority',
      'color',
      'pinned',
      'due_date',
      'reminder_date',
      'sort_order',
      'folder_id',
      'is_completed',
    ];

    for (const field of updatableFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${idx}`);
        values.push(data[field]);
        idx++;
      }
    }

    // Handle metadata merge
    if (data.metadata !== undefined) {
      fields.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx}::jsonb`);
      values.push(JSON.stringify(data.metadata));
      idx++;
    }

    // Handle completed_at
    if (data.is_completed === true) {
      fields.push(`completed_at = NOW()`);
    } else if (data.is_completed === false) {
      fields.push('completed_at = NULL');
    }

    if (fields.length > 0) {
      fields.push('updated_at = NOW()');
      values.push(noteId, userId);
      const query = `UPDATE unified_notes SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`;
      await client.query(query, values);
    }

    // Process tags if provided
    if (data.tags !== undefined) {
      await client.query('DELETE FROM note_tags WHERE note_id = $1', [noteId]);
      if (data.tags.length > 0) {
        await processTags(client, userId, noteId, data.tags);
      }
    }

    await client.query('COMMIT');
    return await getNoteById(noteId, userId);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Note update error', { error: error.message, noteId, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a note
 */
export async function deleteNoteById(noteId, userId) {
  const result = await pool.query('DELETE FROM unified_notes WHERE id = $1 AND user_id = $2 RETURNING id', [
    noteId,
    userId,
  ]);
  return result.rowCount > 0;
}

/**
 * Toggle note completion
 */
export async function toggleNoteComplete(noteId, userId) {
  const result = await pool.query(
    `UPDATE unified_notes
     SET is_completed = NOT is_completed,
         completed_at = CASE WHEN is_completed THEN NULL ELSE NOW() END,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [noteId, userId]
  );
  if (result.rows.length === 0) return null;
  return await getNoteById(noteId, userId);
}

/**
 * Toggle note pin status
 */
export async function toggleNotePin(noteId, userId) {
  const result = await pool.query(
    `UPDATE unified_notes
     SET pinned = NOT pinned, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [noteId, userId]
  );
  if (result.rows.length === 0) return null;
  return await getNoteById(noteId, userId);
}

/**
 * Reorder notes (drag-drop)
 */
export async function reorderNotes(userId, noteIds, _contextType = null, _contextId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < noteIds.length; i++) {
      await client.query(
        'UPDATE unified_notes SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
        [i, noteIds[i], userId]
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Reorder error', { error: error.message, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete all completed notes for a user
 */
export async function deleteCompletedNotes(userId) {
  const result = await pool.query(
    'DELETE FROM unified_notes WHERE user_id = $1 AND is_completed = TRUE AND context_type IS NULL RETURNING id',
    [userId]
  );
  return result.rowCount;
}

// ────────────────────────────────────────────────
// Tag helpers
// ────────────────────────────────────────────────

/**
 * Process tags: get-or-create each tag and link to note
 */
async function processTags(client, userId, noteId, tags) {
  for (const tagName of tags) {
    const name = tagName.trim();
    if (!name) continue;

    // Get or create tag
    const tagResult = await client.query(
      `INSERT INTO note_tags_master (user_id, name, color)
       VALUES ($1, $2, 'gray')
       ON CONFLICT (user_id, name) DO UPDATE SET usage_count = note_tags_master.usage_count
       RETURNING id`,
      [userId, name]
    );

    const tagId = tagResult.rows[0].id;

    // Link tag to note
    await client.query(
      `INSERT INTO note_tags (note_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [noteId, tagId]
    );
  }
}

// ────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────

export default {
  getNoteById,
  listPersonalNotes,
  listContextNotes,
  createNote,
  updateNote,
  deleteNoteById,
  toggleNoteComplete,
  toggleNotePin,
  reorderNotes,
  deleteCompletedNotes,
};
