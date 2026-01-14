/**
 * Bildirim Sistemi API
 * Kullanıcı bildirimlerini yönetir
 */

import express from 'express';
import { query } from '../database.js';

const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Kullanıcı bildirimlerini listele
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: unread_only
 *         schema:
 *           type: boolean
 *           default: false
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 10, unread_only = false } = req.query;
    // TODO: user_id JWT'den alınacak, şimdilik 1 kullanıyoruz
    const userId = req.user?.id || 1;
    
    let sql = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;
    
    if (unread_only === 'true' || unread_only === true) {
      sql += ' AND is_read = false';
    }
    
    sql += ' ORDER BY created_at DESC LIMIT $2';
    
    const result = await query(sql, [userId, parseInt(limit)]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
    
  } catch (error) {
    console.error('Bildirimler hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Okunmamış bildirim sayısı
 *     tags: [Notifications]
 */
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    
    const result = await query(`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = $1 AND is_read = false
    `, [userId]);
    
    res.json({
      success: true,
      count: parseInt(result.rows[0].count)
    });
    
  } catch (error) {
    console.error('Bildirim sayısı hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Bildirimi okundu olarak işaretle
 *     tags: [Notifications]
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 1;
    
    const result = await query(`
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Bildirim bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Bildirim güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Tüm bildirimleri okundu olarak işaretle
 *     tags: [Notifications]
 */
router.patch('/read-all', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    
    const result = await query(`
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = false
      RETURNING id
    `, [userId]);
    
    res.json({
      success: true,
      message: `${result.rowCount} bildirim okundu olarak işaretlendi`
    });
    
  } catch (error) {
    console.error('Toplu bildirim güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Yeni bildirim oluştur (sistem kullanımı için)
 *     tags: [Notifications]
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, title, message, type = 'info', category, link } = req.body;
    
    if (!user_id || !title) {
      return res.status(400).json({ 
        success: false, 
        error: 'user_id ve title zorunludur' 
      });
    }
    
    const result = await query(`
      INSERT INTO notifications (user_id, title, message, type, category, link)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [user_id, title, message, type, category, link]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Bildirim oluşturma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Bildirimi sil
 *     tags: [Notifications]
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 1;
    
    const result = await query(`
      DELETE FROM notifications 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [id, userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Bildirim bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Bildirim silindi'
    });
    
  } catch (error) {
    console.error('Bildirim silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
