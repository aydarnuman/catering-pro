import express from 'express';
import { query } from '../database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// File upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/notes');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `note-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya türü'));
    }
  }
});

// Note colors
const VALID_COLORS = ['yellow', 'blue', 'green', 'pink', 'orange', 'purple'];

/**
 * Get all notes for a tracking record
 * GET /api/tender-notes/:trackingId
 */
router.get('/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    const result = await query(`
      SELECT 
        id,
        user_notes,
        (SELECT json_agg(na.*) FROM note_attachments na WHERE na.tracking_id = tt.id) as attachments
      FROM tender_tracking tt
      WHERE id = $1
    `, [trackingId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    const notes = result.rows[0].user_notes || [];
    const attachments = result.rows[0].attachments || [];
    
    // Sort: pinned first, then by order
    const sortedNotes = notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (a.order || 0) - (b.order || 0);
    });
    
    // Attach files to notes
    const notesWithAttachments = sortedNotes.map(note => ({
      ...note,
      attachments: attachments.filter(a => a.note_id === note.id) || []
    }));
    
    res.json({
      success: true,
      data: notesWithAttachments
    });
  } catch (error) {
    console.error('Not getirme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add a new note
 * POST /api/tender-notes/:trackingId
 */
router.post('/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { text, color, pinned, tags, reminder_date } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Not metni gerekli' });
    }
    
    // Get current max order
    const orderResult = await query(`
      SELECT COALESCE(MAX((elem->>'order')::int), -1) + 1 as next_order
      FROM tender_tracking tt,
           jsonb_array_elements(COALESCE(user_notes, '[]'::jsonb)) elem
      WHERE tt.id = $1
    `, [trackingId]);
    
    const nextOrder = orderResult.rows[0]?.next_order || 0;
    const now = new Date().toISOString();
    
    const newNote = {
      id: `note_${Date.now()}`,
      text: text.trim(),
      color: VALID_COLORS.includes(color) ? color : 'yellow',
      pinned: pinned || false,
      tags: Array.isArray(tags) ? tags : [],
      order: nextOrder,
      reminder_date: reminder_date || null,
      created_at: now,
      updated_at: now
    };
    
    const result = await query(`
      UPDATE tender_tracking 
      SET user_notes = COALESCE(user_notes, '[]'::jsonb) || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `, [JSON.stringify(newNote), trackingId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    // Create reminder if specified
    if (reminder_date) {
      await query(`
        INSERT INTO note_reminders (note_id, tracking_id, user_id, reminder_date)
        SELECT $1, $2, user_id, $3
        FROM tender_tracking WHERE id = $2
      `, [newNote.id, trackingId, reminder_date]);
    }
    
    res.json({
      success: true,
      data: newNote
    });
  } catch (error) {
    console.error('Not ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a note
 * PUT /api/tender-notes/:trackingId/:noteId
 */
router.put('/:trackingId/:noteId', async (req, res) => {
  try {
    const { trackingId, noteId } = req.params;
    const { text, color, pinned, tags, reminder_date } = req.body;
    
    const now = new Date().toISOString();
    
    // Build update object
    const updates = {};
    if (text !== undefined) updates.text = text.trim();
    if (color !== undefined && VALID_COLORS.includes(color)) updates.color = color;
    if (pinned !== undefined) updates.pinned = pinned;
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : [];
    if (reminder_date !== undefined) updates.reminder_date = reminder_date;
    updates.updated_at = now;
    
    // Update note in JSONB array
    const result = await query(`
      UPDATE tender_tracking 
      SET user_notes = (
        SELECT jsonb_agg(
          CASE 
            WHEN elem->>'id' = $1 
            THEN elem || $2::jsonb
            ELSE elem 
          END
        )
        FROM jsonb_array_elements(COALESCE(user_notes, '[]'::jsonb)) elem
      ),
      updated_at = NOW()
      WHERE id = $3
      RETURNING user_notes
    `, [noteId, JSON.stringify(updates), trackingId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    // Update reminder
    if (reminder_date !== undefined) {
      // Delete old reminder
      await query(`DELETE FROM note_reminders WHERE note_id = $1`, [noteId]);
      
      // Create new reminder if date provided
      if (reminder_date) {
        await query(`
          INSERT INTO note_reminders (note_id, tracking_id, user_id, reminder_date)
          SELECT $1, $2, user_id, $3
          FROM tender_tracking WHERE id = $2
        `, [noteId, trackingId, reminder_date]);
      }
    }
    
    // Find updated note
    const notes = result.rows[0].user_notes || [];
    const updatedNote = notes.find(n => n.id === noteId);
    
    res.json({
      success: true,
      data: updatedNote
    });
  } catch (error) {
    console.error('Not güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a note
 * DELETE /api/tender-notes/:trackingId/:noteId
 */
router.delete('/:trackingId/:noteId', async (req, res) => {
  try {
    const { trackingId, noteId } = req.params;
    
    // Delete note from JSONB
    const result = await query(`
      UPDATE tender_tracking 
      SET user_notes = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(user_notes, '[]'::jsonb)) elem
        WHERE elem->>'id' != $1
      ),
      updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `, [noteId, trackingId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    // Delete attachments from filesystem
    const attachments = await query(
      `SELECT file_path FROM note_attachments WHERE note_id = $1`,
      [noteId]
    );
    
    for (const att of attachments.rows) {
      try {
        await fs.unlink(att.file_path);
      } catch (e) {
        console.warn('Dosya silinemedi:', att.file_path);
      }
    }
    
    // Delete from DB
    await query(`DELETE FROM note_attachments WHERE note_id = $1`, [noteId]);
    await query(`DELETE FROM note_reminders WHERE note_id = $1`, [noteId]);
    
    res.json({
      success: true,
      message: 'Not silindi'
    });
  } catch (error) {
    console.error('Not silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Reorder notes (drag & drop)
 * PUT /api/tender-notes/:trackingId/reorder
 */
router.put('/:trackingId/reorder', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { noteIds } = req.body; // Array of note IDs in new order
    
    if (!Array.isArray(noteIds)) {
      return res.status(400).json({ success: false, error: 'noteIds array gerekli' });
    }
    
    // Update order for each note
    const result = await query(`
      UPDATE tender_tracking 
      SET user_notes = (
        SELECT jsonb_agg(
          elem || jsonb_build_object('order', 
            COALESCE(
              (SELECT idx FROM unnest($1::text[]) WITH ORDINALITY AS t(id, idx) WHERE t.id = elem->>'id'),
              999
            ) - 1
          )
        ORDER BY 
          CASE WHEN (elem->>'pinned')::boolean THEN 0 ELSE 1 END,
          COALESCE(
            (SELECT idx FROM unnest($1::text[]) WITH ORDINALITY AS t(id, idx) WHERE t.id = elem->>'id'),
            999
          )
        )
        FROM jsonb_array_elements(COALESCE(user_notes, '[]'::jsonb)) elem
      ),
      updated_at = NOW()
      WHERE id = $2
      RETURNING user_notes
    `, [noteIds, trackingId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0].user_notes
    });
  } catch (error) {
    console.error('Sıralama hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Toggle pin status
 * POST /api/tender-notes/:trackingId/:noteId/pin
 */
router.post('/:trackingId/:noteId/pin', async (req, res) => {
  try {
    const { trackingId, noteId } = req.params;
    
    // Toggle pinned status
    const result = await query(`
      UPDATE tender_tracking 
      SET user_notes = (
        SELECT jsonb_agg(
          CASE 
            WHEN elem->>'id' = $1 
            THEN elem || jsonb_build_object(
              'pinned', NOT COALESCE((elem->>'pinned')::boolean, false),
              'updated_at', NOW()::text
            )
            ELSE elem 
          END
        )
        FROM jsonb_array_elements(COALESCE(user_notes, '[]'::jsonb)) elem
      ),
      updated_at = NOW()
      WHERE id = $2
      RETURNING user_notes
    `, [noteId, trackingId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
    }
    
    const notes = result.rows[0].user_notes || [];
    const updatedNote = notes.find(n => n.id === noteId);
    
    res.json({
      success: true,
      data: updatedNote
    });
  } catch (error) {
    console.error('Pin hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Upload attachment
 * POST /api/tender-notes/:trackingId/:noteId/attachments
 */
router.post('/:trackingId/:noteId/attachments', upload.single('file'), async (req, res) => {
  try {
    const { trackingId, noteId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya gerekli' });
    }
    
    const result = await query(`
      INSERT INTO note_attachments (note_id, tracking_id, filename, original_filename, file_path, file_size, file_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      noteId,
      trackingId,
      req.file.filename,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype
    ]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Dosya yükleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete attachment
 * DELETE /api/tender-notes/:trackingId/:noteId/attachments/:attachmentId
 */
router.delete('/:trackingId/:noteId/attachments/:attachmentId', async (req, res) => {
  try {
    const { attachmentId } = req.params;
    
    const attachment = await query(
      `SELECT file_path FROM note_attachments WHERE id = $1`,
      [attachmentId]
    );
    
    if (attachment.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    }
    
    // Delete file
    try {
      await fs.unlink(attachment.rows[0].file_path);
    } catch (e) {
      console.warn('Dosya silinemedi:', attachment.rows[0].file_path);
    }
    
    // Delete from DB
    await query(`DELETE FROM note_attachments WHERE id = $1`, [attachmentId]);
    
    res.json({
      success: true,
      message: 'Dosya silindi'
    });
  } catch (error) {
    console.error('Dosya silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Download attachment
 * GET /api/tender-notes/attachments/:attachmentId/download
 */
router.get('/attachments/:attachmentId/download', async (req, res) => {
  try {
    const { attachmentId } = req.params;
    
    const result = await query(
      `SELECT file_path, original_filename, file_type FROM note_attachments WHERE id = $1`,
      [attachmentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    }
    
    const { file_path, original_filename, file_type } = result.rows[0];
    
    res.setHeader('Content-Disposition', `attachment; filename="${original_filename}"`);
    res.setHeader('Content-Type', file_type);
    res.sendFile(file_path);
  } catch (error) {
    console.error('Dosya indirme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get tag suggestions
 * GET /api/tender-notes/tags/suggestions
 */
router.get('/tags/suggestions', async (req, res) => {
  try {
    const result = await query(`
      SELECT tag, COUNT(*) as count
      FROM (
        SELECT jsonb_array_elements_text(elem->'tags') as tag
        FROM tender_tracking tt,
             jsonb_array_elements(COALESCE(tt.user_notes, '[]'::jsonb)) elem
        WHERE jsonb_typeof(elem->'tags') = 'array'
      ) tags
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 20
    `);
    
    res.json({
      success: true,
      data: result.rows.map(r => r.tag)
    });
  } catch (error) {
    console.error('Tag suggestions hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get upcoming reminders
 * GET /api/tender-notes/reminders/upcoming
 */
router.get('/reminders/upcoming', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    const result = await query(`
      SELECT 
        nr.*,
        tt.tender_id,
        t.title as tender_title,
        (
          SELECT elem 
          FROM jsonb_array_elements(tt.user_notes) elem 
          WHERE elem->>'id' = nr.note_id
        ) as note_data
      FROM note_reminders nr
      JOIN tender_tracking tt ON nr.tracking_id = tt.id
      JOIN tenders t ON tt.tender_id = t.id
      WHERE nr.reminder_sent = FALSE
        AND nr.reminder_date >= NOW()
        AND ($1::int IS NULL OR nr.user_id = $1)
      ORDER BY nr.reminder_date ASC
      LIMIT 50
    `, [user_id || null]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Reminder hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Mark reminder as sent
 * POST /api/tender-notes/reminders/:reminderId/sent
 */
router.post('/reminders/:reminderId/sent', async (req, res) => {
  try {
    const { reminderId } = req.params;
    
    await query(
      `UPDATE note_reminders SET reminder_sent = TRUE WHERE id = $1`,
      [reminderId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Reminder güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
