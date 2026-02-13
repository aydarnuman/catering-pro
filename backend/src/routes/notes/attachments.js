/**
 * Attachments Routes
 * Handles file attachments for notes using Supabase Storage.
 * Falls back to local disk if Supabase Storage is unavailable.
 */

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { pool } from '../../database.js';
import { authenticate } from '../../middleware/auth.js';
import supabase from '../../supabase.js';
import logger from '../../utils/logger.js';

const router = express.Router();
router.use(authenticate);

// ── Storage config ──
const BUCKET = 'note-attachments';
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'notes');

// Ensure local upload directory exists (fallback)
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

// Use memory storage for Supabase, disk for fallback
const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOCAL_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `note-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
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
    'text/csv',
  ];
  cb(null, allowedMimes.includes(file.mimetype));
};

/**
 * Check if Supabase Storage is available
 */
function getStorageClient() {
  try {
    if (supabase?.storage) return supabase.storage;
  } catch {
    /* ignore */
  }
  return null;
}

// Determine storage mode
const storageClient = getStorageClient();
const useSupabase = !!storageClient;

const upload = multer({
  storage: useSupabase ? memoryStorage : diskStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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
      return res.status(400).json({ success: false, message: 'Dosya yuklenmedi' });
    }

    // Verify note ownership
    const noteCheck = await pool.query('SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2', [noteId, userId]);

    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadi' });
    }

    let storedFilename;
    let filePath;

    if (useSupabase && req.file.buffer) {
      // Upload to Supabase Storage
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(req.file.originalname);
      storedFilename = `${userId}/${noteId}/note-${uniqueSuffix}${ext}`;

      const storage = getStorageClient();
      const { error: uploadError } = await storage.from(BUCKET).upload(storedFilename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

      if (uploadError) {
        logger.error('Supabase storage upload error', { error: uploadError.message });
        return res.status(500).json({ success: false, message: 'Dosya yuklenirken hata olustu' });
      }

      filePath = `supabase://${BUCKET}/${storedFilename}`;
    } else {
      // Local disk fallback
      storedFilename = req.file.filename;
      filePath = req.file.path;
    }

    // Save attachment record
    const result = await pool.query(
      `INSERT INTO unified_note_attachments (
        note_id, user_id, filename, original_filename, file_path, file_size, file_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [noteId, userId, storedFilename, req.file.originalname, filePath, req.file.size, req.file.mimetype]
    );

    res.status(201).json({
      success: true,
      attachment: {
        id: result.rows[0].id,
        filename: result.rows[0].filename,
        original_filename: result.rows[0].original_filename,
        file_type: result.rows[0].file_type,
        file_size: result.rows[0].file_size,
      },
      message: 'Dosya yuklendi',
    });
  } catch (error) {
    logger.error('Attachment upload error', { error: error.message, stack: error.stack });
    // Clean up local file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'Dosya yuklenirken hata olustu' });
  }
});

/**
 * GET /api/notes/attachments/:id/download
 * Download an attachment (supports both Supabase and local storage)
 */
router.get('/:id/download', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT a.*, n.user_id as note_owner_id
       FROM unified_note_attachments a
       JOIN unified_notes n ON a.note_id = n.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Dosya bulunamadi' });
    }

    const attachment = result.rows[0];

    if (attachment.note_owner_id !== userId) {
      return res.status(403).json({ success: false, message: 'Bu dosyaya erisim izniniz yok' });
    }

    // Supabase Storage path
    if (attachment.file_path?.startsWith('supabase://')) {
      const storagePath = attachment.file_path.replace(`supabase://${BUCKET}/`, '');
      const storage = getStorageClient();

      if (!storage) {
        return res.status(500).json({ success: false, message: 'Storage servisi kulanilamiyor' });
      }

      const { data, error } = await storage.from(BUCKET).download(storagePath);
      if (error || !data) {
        return res.status(404).json({ success: false, message: 'Dosya bulunamadi' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename}"`);
      res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');

      const buffer = Buffer.from(await data.arrayBuffer());
      res.send(buffer);
      return;
    }

    // Local disk fallback
    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ success: false, message: 'Dosya bulunamadi' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename}"`);
    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    const fileStream = fs.createReadStream(attachment.file_path);
    fileStream.pipe(res);
  } catch (error) {
    logger.error('Attachment download error', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Dosya indirilirken hata olustu' });
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

    const result = await pool.query(
      `SELECT a.*, n.user_id as note_owner_id
       FROM unified_note_attachments a
       JOIN unified_notes n ON a.note_id = n.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Dosya bulunamadi' });
    }

    const attachment = result.rows[0];

    if (attachment.note_owner_id !== userId) {
      return res.status(403).json({ success: false, message: 'Bu dosyayi silme izniniz yok' });
    }

    // Delete from storage
    if (attachment.file_path?.startsWith('supabase://')) {
      const storagePath = attachment.file_path.replace(`supabase://${BUCKET}/`, '');
      const storage = getStorageClient();
      if (storage) {
        await storage.from(BUCKET).remove([storagePath]);
      }
    } else if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    // Delete from database
    await pool.query('DELETE FROM unified_note_attachments WHERE id = $1', [id]);

    res.json({ success: true, message: 'Dosya silindi' });
  } catch (error) {
    logger.error('Attachment delete error', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Dosya silinirken hata olustu' });
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

    const noteCheck = await pool.query('SELECT id FROM unified_notes WHERE id = $1 AND user_id = $2', [noteId, userId]);

    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not bulunamadi' });
    }

    const result = await pool.query(
      `SELECT id, filename, original_filename, file_type, file_size, created_at
       FROM unified_note_attachments
       WHERE note_id = $1
       ORDER BY created_at DESC`,
      [noteId]
    );

    res.json({ success: true, attachments: result.rows });
  } catch (error) {
    logger.error('Attachment list error', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Dosyalar yuklenirken hata olustu' });
  }
});

// Error handling for multer
router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: "Dosya boyutu 10MB'i gecemez" });
    }
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.message === 'Desteklenmeyen dosya tipi') {
    return res.status(400).json({ success: false, message: error.message });
  }
  next(error);
});

export default router;
