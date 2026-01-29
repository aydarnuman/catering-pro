/**
 * Attachments Routes
 * Handles file attachments for notes
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../../database.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware
router.use(authenticate);

// Configure upload directory
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'notes');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `note-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Desteklenmeyen dosya tipi'), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/**
 * POST /api/notes/attachments/:noteId
 * Upload a file attachment to a note
 */
router.post('/:noteId', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Dosya yüklenmedi' });
    }

    // Verify note ownership
    const noteCheck = await pool.query(
      `SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    );

    if (noteCheck.rows.length === 0) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    }

    // Save attachment record
    const result = await pool.query(
      `INSERT INTO unified_note_attachments (
        note_id, user_id, filename, original_filename, file_path, file_size, file_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        noteId,
        userId,
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype
      ]
    );

    res.status(201).json({
      success: true,
      attachment: {
        id: result.rows[0].id,
        filename: result.rows[0].filename,
        original_filename: result.rows[0].original_filename,
        file_type: result.rows[0].file_type,
        file_size: result.rows[0].file_size
      },
      message: 'Dosya yüklendi'
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Error uploading attachment:', error);
    res.status(500).json({ success: false, message: 'Dosya yüklenirken hata oluştu' });
  }
});

/**
 * GET /api/notes/attachments/:id/download
 * Download an attachment
 */
router.get('/:id/download', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Get attachment with ownership check
    const result = await pool.query(
      `SELECT a.*, n.user_id as note_owner_id
       FROM unified_note_attachments a
       JOIN unified_notes n ON a.note_id = n.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
    }

    const attachment = result.rows[0];

    // Check ownership
    if (attachment.note_owner_id !== userId) {
      return res.status(403).json({ success: false, message: 'Bu dosyaya erişim izniniz yok' });
    }

    // Check if file exists
    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename}"`);
    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');

    // Stream file
    const fileStream = fs.createReadStream(attachment.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ success: false, message: 'Dosya indirilirken hata oluştu' });
  }
});

/**
 * DELETE /api/notes/attachments/:id
 * Delete an attachment
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Get attachment with ownership check
    const result = await pool.query(
      `SELECT a.*, n.user_id as note_owner_id
       FROM unified_note_attachments a
       JOIN unified_notes n ON a.note_id = n.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
    }

    const attachment = result.rows[0];

    // Check ownership
    if (attachment.note_owner_id !== userId) {
      return res.status(403).json({ success: false, message: 'Bu dosyayı silme izniniz yok' });
    }

    // Delete file from disk
    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    // Delete from database
    await pool.query(
      `DELETE FROM unified_note_attachments WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Dosya silindi' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ success: false, message: 'Dosya silinirken hata oluştu' });
  }
});

/**
 * GET /api/notes/attachments/note/:noteId
 * List all attachments for a note
 */
router.get('/note/:noteId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;

    // Verify note ownership
    const noteCheck = await pool.query(
      `SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    );

    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    }

    const result = await pool.query(
      `SELECT id, filename, original_filename, file_type, file_size, created_at
       FROM unified_note_attachments
       WHERE note_id = $1
       ORDER BY created_at DESC`,
      [noteId]
    );

    res.json({
      success: true,
      attachments: result.rows
    });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ success: false, message: 'Dosyalar yüklenirken hata oluştu' });
  }
});

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Dosya boyutu 10MB\'ı geçemez' });
    }
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.message === 'Desteklenmeyen dosya tipi') {
    return res.status(400).json({ success: false, message: error.message });
  }
  next(error);
});

export default router;
