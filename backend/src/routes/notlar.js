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
router.get('/', async (req, res) => {
  try {
    const { completed, limit = 20 } = req.query;
    
    let query = `
      SELECT id, content, is_completed, priority, color, due_date, created_at, updated_at
      FROM notlar
    `;
    const params = [];
    const conditions = [];
    
    if (completed !== undefined) {
      conditions.push(`is_completed = $${params.length + 1}`);
      params.push(completed === 'true');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Tamamlanmayanlar önce, sonra önceliğe göre, sonra tarihe göre
    query += ' ORDER BY is_completed ASC, CASE priority WHEN \'high\' THEN 1 WHEN \'normal\' THEN 2 WHEN \'low\' THEN 3 END, created_at DESC';
    query += ` LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      notlar: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Notlar listeleme hatası:', error);
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
    const { content, priority = 'normal', color = 'blue', due_date } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, error: 'Not içeriği boş olamaz' });
    }
    
    const result = await pool.query(`
      INSERT INTO notlar (content, priority, color, due_date)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [content.trim(), priority, color, due_date || null]);
    
    res.json({
      success: true,
      not: result.rows[0],
      message: 'Not başarıyla eklendi'
    });
  } catch (error) {
    console.error('Not ekleme hatası:', error);
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
    const { content, is_completed, priority, color, due_date } = req.body;
    
    const existing = await pool.query('SELECT * FROM notlar WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not bulunamadı' });
    }
    
    const current = existing.rows[0];
    
    const result = await pool.query(`
      UPDATE notlar SET
        content = $1,
        is_completed = $2,
        priority = $3,
        color = $4,
        due_date = $5
      WHERE id = $6
      RETURNING *
    `, [
      content !== undefined ? content : current.content,
      is_completed !== undefined ? is_completed : current.is_completed,
      priority !== undefined ? priority : current.priority,
      color !== undefined ? color : current.color,
      due_date !== undefined ? due_date : current.due_date,
      id
    ]);
    
    res.json({
      success: true,
      not: result.rows[0],
      message: 'Not güncellendi'
    });
  } catch (error) {
    console.error('Not güncelleme hatası:', error);
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
    
    const result = await pool.query(`
      UPDATE notlar SET is_completed = NOT is_completed
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not bulunamadı' });
    }
    
    res.json({
      success: true,
      not: result.rows[0],
      message: result.rows[0].is_completed ? 'Not tamamlandı' : 'Not aktif'
    });
  } catch (error) {
    console.error('Not toggle hatası:', error);
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
      message: 'Not silindi'
    });
  } catch (error) {
    console.error('Not silme hatası:', error);
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
router.delete('/completed/all', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM notlar WHERE is_completed = true RETURNING id');
    
    res.json({
      success: true,
      deleted: result.rows.length,
      message: `${result.rows.length} tamamlanan not silindi`
    });
  } catch (error) {
    console.error('Tamamlanan notları silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
