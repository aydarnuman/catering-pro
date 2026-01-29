import express from 'express';
import { pool } from '../database.js';

const router = express.Router();

/**
 * @swagger
 * /api/notlar:
 *   get:
 *     summary: Kullanıcının notlarını listele
 *     tags: [Notlar]
 *     parameters:
 *       - in: query
 *         name: completed
 *         schema:
 *           type: boolean
 *         description: Tamamlanmış notları filtrele
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Notlar listesi
 */
// pinned sütunu yoksa (migration henüz çalışmamışsa) kullanılacak sütun listesi ve sıralama
const COLS_WITH_PINNED = 'id, content, is_completed, priority, color, due_date, pinned, created_at, updated_at';
const COLS_WITHOUT_PINNED = 'id, content, is_completed, priority, color, due_date, created_at, updated_at';
const ORDER_WITH_PINNED =
  " ORDER BY pinned DESC NULLS LAST, is_completed ASC, due_date ASC NULLS LAST, CASE priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END, created_at DESC";
const ORDER_WITHOUT_PINNED =
  " ORDER BY is_completed ASC, due_date ASC NULLS LAST, CASE priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END, created_at DESC";

router.get('/', async (req, res) => {
  try {
    const { completed, limit = 20 } = req.query;
    const params = [];
    const conditions = [];

    if (completed !== undefined) {
      conditions.push(`is_completed = $${params.length + 1}`);
      params.push(completed === 'true');
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const limitParam = ` LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    let result;
    try {
      const query = `SELECT ${COLS_WITH_PINNED} FROM notlar${whereClause}${ORDER_WITH_PINNED}${limitParam}`;
      result = await pool.query(query, params);
    } catch (colError) {
      if (colError.message?.includes('pinned')) {
        const query = `SELECT ${COLS_WITHOUT_PINNED} FROM notlar${whereClause}${ORDER_WITHOUT_PINNED}${limitParam}`;
        result = await pool.query(query, params);
        result.rows = result.rows.map((row) => ({ ...row, pinned: false }));
      } else {
        throw colError;
      }
    }

    res.json({
      success: true,
      notlar: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notlar:
 *   post:
 *     summary: Yeni not ekle
 *     tags: [Notlar]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high]
 *               color:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Not eklendi
 */
router.post('/', async (req, res) => {
  try {
    const { content, priority = 'normal', color = 'blue', due_date, pinned = false } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, error: 'Not içeriği boş olamaz' });
    }

    let result;
    try {
      result = await pool.query(
        `
        INSERT INTO notlar (content, priority, color, due_date, pinned)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
        [content.trim(), priority, color, due_date || null, !!pinned]
      );
    } catch (insertErr) {
      if (insertErr.message?.includes('pinned')) {
        result = await pool.query(
          `
          INSERT INTO notlar (content, priority, color, due_date)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
          [content.trim(), priority, color, due_date || null]
        );
        if (result.rows[0]) result.rows[0].pinned = false;
      } else {
        throw insertErr;
      }
    }

    res.json({
      success: true,
      not: result.rows[0],
      message: 'Not başarıyla eklendi',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notlar/{id}:
 *   put:
 *     summary: Not güncelle
 *     tags: [Notlar]
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, is_completed, priority, color, due_date, pinned } = req.body;

    const existing = await pool.query('SELECT * FROM notlar WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not bulunamadı' });
    }

    const current = existing.rows[0];

    let result;
    try {
      result = await pool.query(
        `
        UPDATE notlar SET
          content = $1,
          is_completed = $2,
          priority = $3,
          color = $4,
          due_date = $5,
          pinned = $6
        WHERE id = $7
        RETURNING *
      `,
        [
          content !== undefined ? content : current.content,
          is_completed !== undefined ? is_completed : current.is_completed,
          priority !== undefined ? priority : current.priority,
          color !== undefined ? color : current.color,
          due_date !== undefined ? due_date : current.due_date,
          pinned !== undefined ? !!pinned : (current.pinned ?? false),
          id,
        ]
      );
    } catch (updateErr) {
      if (updateErr.message?.includes('pinned')) {
        result = await pool.query(
          `
          UPDATE notlar SET
            content = $1,
            is_completed = $2,
            priority = $3,
            color = $4,
            due_date = $5
          WHERE id = $6
          RETURNING *
        `,
          [
            content !== undefined ? content : current.content,
            is_completed !== undefined ? is_completed : current.is_completed,
            priority !== undefined ? priority : current.priority,
            color !== undefined ? color : current.color,
            due_date !== undefined ? due_date : current.due_date,
            id,
          ]
        );
        if (result.rows[0]) result.rows[0].pinned = false;
      } else {
        throw updateErr;
      }
    }

    res.json({
      success: true,
      not: result.rows[0],
      message: 'Not güncellendi',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notlar/{id}/toggle:
 *   put:
 *     summary: Not tamamlandı durumunu değiştir
 *     tags: [Notlar]
 */
router.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE notlar SET is_completed = NOT is_completed
      WHERE id = $1
      RETURNING *
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not bulunamadı' });
    }

    res.json({
      success: true,
      not: result.rows[0],
      message: result.rows[0].is_completed ? 'Not tamamlandı' : 'Not aktif',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notlar/{id}:
 *   delete:
 *     summary: Not sil
 *     tags: [Notlar]
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM notlar WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Not silindi',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notlar/completed/all:
 *   delete:
 *     summary: Tamamlanan notları temizle
 *     tags: [Notlar]
 */
router.delete('/completed/all', async (_req, res) => {
  try {
    const result = await pool.query('DELETE FROM notlar WHERE is_completed = true RETURNING id');

    res.json({
      success: true,
      deleted: result.rows.length,
      message: `${result.rows.length} tamamlanan not silindi`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
