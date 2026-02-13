/**
 * Tracker Sheets Routes
 * Persists the Takip Defteri (tracker spreadsheet) data to the server.
 * GET  /api/notes/tracker  - Get user's tracker sheets
 * PUT  /api/notes/tracker  - Save/update user's tracker sheets
 */

import express from 'express';
import { pool } from '../../database.js';
import { authenticate } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/notes/tracker
 * Get all tracker sheets for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query('SELECT data, updated_at FROM tracker_sheets WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.json({ success: true, sheets: [], updated_at: null });
    }

    res.json({
      success: true,
      sheets: result.rows[0].data,
      updated_at: result.rows[0].updated_at,
    });
  } catch (error) {
    logger.error('Tracker get error', { error: error.message, userId: req.user?.id });
    res.status(500).json({ success: false, message: 'Tracker verileri yuklenirken hata olustu' });
  }
});

/**
 * PUT /api/notes/tracker
 * Save/update tracker sheets (upsert: one row per user)
 */
router.put('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sheets } = req.body;

    if (!Array.isArray(sheets)) {
      return res.status(400).json({ success: false, message: 'sheets bir dizi olmali' });
    }

    const result = await pool.query(
      `INSERT INTO tracker_sheets (user_id, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET data = $2::jsonb, updated_at = NOW()
       RETURNING updated_at`,
      [userId, JSON.stringify(sheets)]
    );

    res.json({
      success: true,
      updated_at: result.rows[0].updated_at,
    });
  } catch (error) {
    logger.error('Tracker save error', { error: error.message, userId: req.user?.id });
    res.status(500).json({ success: false, message: 'Tracker verileri kaydedilirken hata olustu' });
  }
});

export default router;
