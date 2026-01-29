/**
 * Reminders Routes
 * Handles reminder management for notes
 */

import express from 'express';
import { pool } from '../../database.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware
router.use(authenticate);

/**
 * GET /api/notes/reminders/upcoming
 * Get upcoming (unsent) reminders
 */
router.get('/upcoming', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50 } = req.query;

    const result = await pool.query(
      `SELECT
        r.id,
        r.note_id,
        r.reminder_date,
        r.reminder_type,
        r.reminder_sent,
        r.created_at,
        n.content,
        n.content_format,
        n.priority,
        n.color,
        n.context_type,
        n.context_id
       FROM unified_note_reminders r
       JOIN unified_notes n ON r.note_id = n.id
       WHERE r.user_id = $1
         AND r.reminder_sent = FALSE
         AND r.reminder_date >= NOW() - INTERVAL '1 day'
       ORDER BY r.reminder_date ASC
       LIMIT $2`,
      [userId, parseInt(limit, 10)]
    );

    res.json({
      success: true,
      reminders: result.rows,
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Hatırlatıcılar yüklenirken hata oluştu' });
  }
});

/**
 * GET /api/notes/reminders/due
 * Get reminders that are due (for notification system)
 */
router.get('/due', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        r.id,
        r.note_id,
        r.reminder_date,
        r.reminder_type,
        n.content,
        n.content_format,
        n.priority,
        n.color,
        n.context_type,
        n.context_id
       FROM unified_note_reminders r
       JOIN unified_notes n ON r.note_id = n.id
       WHERE r.user_id = $1
         AND r.reminder_sent = FALSE
         AND r.reminder_date <= NOW()
       ORDER BY r.reminder_date ASC`,
      [userId]
    );

    res.json({
      success: true,
      reminders: result.rows,
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Hatırlatıcılar yüklenirken hata oluştu' });
  }
});

/**
 * POST /api/notes/reminders/:noteId
 * Add a reminder to a note
 */
router.post('/:noteId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;
    const { reminder_date, reminder_type = 'notification' } = req.body;

    if (!reminder_date) {
      return res.status(400).json({ success: false, message: 'Hatırlatıcı tarihi gerekli' });
    }

    // Verify note ownership
    const noteCheck = await pool.query(`SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2`, [noteId, userId]);

    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    }

    // Check if reminder already exists for this date
    const existingCheck = await pool.query(
      `SELECT id FROM unified_note_reminders
       WHERE note_id = $1 AND reminder_date = $2 AND reminder_sent = FALSE`,
      [noteId, reminder_date]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Bu tarih için zaten hatırlatıcı var' });
    }

    const result = await pool.query(
      `INSERT INTO unified_note_reminders (note_id, user_id, reminder_date, reminder_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [noteId, userId, reminder_date, reminder_type]
    );

    // Also update the note's reminder_date field
    await pool.query(`UPDATE unified_notes SET reminder_date = $1 WHERE id = $2`, [reminder_date, noteId]);

    res.status(201).json({
      success: true,
      reminder: result.rows[0],
      message: 'Hatırlatıcı eklendi',
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Hatırlatıcı eklenirken hata oluştu' });
  }
});

/**
 * PUT /api/notes/reminders/:id/sent
 * Mark a reminder as sent
 */
router.put('/:id/sent', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE unified_note_reminders
       SET reminder_sent = TRUE, sent_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hatırlatıcı bulunamadı' });
    }

    res.json({
      success: true,
      reminder: result.rows[0],
      message: 'Hatırlatıcı gönderildi olarak işaretlendi',
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Hatırlatıcı güncellenirken hata oluştu' });
  }
});

/**
 * DELETE /api/notes/reminders/:id
 * Delete a reminder
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Get the note_id before deleting
    const reminderResult = await pool.query(
      `SELECT note_id FROM unified_note_reminders WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (reminderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hatırlatıcı bulunamadı' });
    }

    const noteId = reminderResult.rows[0].note_id;

    // Delete the reminder
    await pool.query(`DELETE FROM unified_note_reminders WHERE id = $1 AND user_id = $2`, [id, userId]);

    // Check if there are other reminders for this note
    const otherReminders = await pool.query(
      `SELECT MIN(reminder_date) as next_reminder
       FROM unified_note_reminders
       WHERE note_id = $1 AND reminder_sent = FALSE`,
      [noteId]
    );

    // Update the note's reminder_date to the next reminder or null
    const nextReminder = otherReminders.rows[0]?.next_reminder || null;
    await pool.query(`UPDATE unified_notes SET reminder_date = $1 WHERE id = $2`, [nextReminder, noteId]);

    res.json({ success: true, message: 'Hatırlatıcı silindi' });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Hatırlatıcı silinirken hata oluştu' });
  }
});

export default router;
