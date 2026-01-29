/**
 * @swagger
 * tags:
 *   name: Preferences
 *   description: Kullanıcı tercihleri yönetimi
 */

import express from 'express';
import { query } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Tüm route'lar authentication gerektirir
router.use(authenticate);

/**
 * @swagger
 * /api/preferences:
 *   get:
 *     summary: Kullanıcı tercihlerini getir
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tercihler başarıyla alındı
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `
      SELECT preference_key, preference_value, updated_at
      FROM user_preferences
      WHERE user_id = $1
      ORDER BY preference_key
    `,
      [req.user.id]
    );

    // Key-value formatına dönüştür
    const preferences = {};
    result.rows.forEach((row) => {
      preferences[row.preference_key] = row.preference_value;
    });

    res.json({
      success: true,
      preferences,
      raw: result.rows, // Detaylı bilgi için
    });
  } catch (error) {
    logger.error('Tercihler getirme hatası', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/preferences:
 *   put:
 *     summary: Tercihleri toplu güncelle
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Key-value formatında tercihler
 *     responses:
 *       200:
 *         description: Tercihler güncellendi
 */
router.put('/', async (req, res) => {
  try {
    const preferences = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Geçersiz tercih formatı' });
    }

    const updates = [];

    for (const [key, value] of Object.entries(preferences)) {
      // Güvenlik: key'i validate et
      if (typeof key !== 'string' || key.length > 100) {
        continue;
      }

      updates.push(
        query(
          `
          INSERT INTO user_preferences (user_id, preference_key, preference_value)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, preference_key)
          DO UPDATE SET preference_value = $3, updated_at = NOW()
        `,
          [req.user.id, key, JSON.stringify(value)]
        )
      );
    }

    await Promise.all(updates);

    res.json({
      success: true,
      message: 'Tercihler güncellendi',
      count: updates.length,
    });
  } catch (error) {
    logger.error('Tercihler güncelleme hatası', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/preferences/{key}:
 *   get:
 *     summary: Tek bir tercihi getir
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tercih bulundu
 *       404:
 *         description: Tercih bulunamadı
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;

    const result = await query(
      `
      SELECT preference_value, updated_at
      FROM user_preferences
      WHERE user_id = $1 AND preference_key = $2
    `,
      [req.user.id, key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tercih bulunamadı' });
    }

    res.json({
      success: true,
      key,
      value: result.rows[0].preference_value,
      updated_at: result.rows[0].updated_at,
    });
  } catch (error) {
    logger.error('Tercih getirme hatası', { error: error.message, userId: req.user.id, key: req.params.key });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/preferences/{key}:
 *   put:
 *     summary: Tek bir tercihi güncelle
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 description: Tercih değeri (herhangi bir JSON değeri)
 *     responses:
 *       200:
 *         description: Tercih güncellendi
 */
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'value alanı gerekli' });
    }

    await query(
      `
      INSERT INTO user_preferences (user_id, preference_key, preference_value)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, preference_key)
      DO UPDATE SET preference_value = $3, updated_at = NOW()
    `,
      [req.user.id, key, JSON.stringify(value)]
    );

    res.json({
      success: true,
      message: 'Tercih güncellendi',
      key,
      value,
    });
  } catch (error) {
    logger.error('Tercih güncelleme hatası', { error: error.message, userId: req.user.id, key: req.params.key });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/preferences/{key}:
 *   delete:
 *     summary: Bir tercihi sil
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tercih silindi
 */
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;

    const result = await query(
      `
      DELETE FROM user_preferences
      WHERE user_id = $1 AND preference_key = $2
      RETURNING preference_key
    `,
      [req.user.id, key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tercih bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Tercih silindi',
      key,
    });
  } catch (error) {
    logger.error('Tercih silme hatası', { error: error.message, userId: req.user.id, key: req.params.key });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/preferences/export:
 *   get:
 *     summary: Tüm tercihleri JSON olarak export et
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/export/all', async (req, res) => {
  try {
    const result = await query(
      `
      SELECT preference_key, preference_value
      FROM user_preferences
      WHERE user_id = $1
    `,
      [req.user.id]
    );

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      preferences: {},
    };

    result.rows.forEach((row) => {
      exportData.preferences[row.preference_key] = row.preference_value;
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="preferences-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    logger.error('Tercih export hatası', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/preferences/import:
 *   post:
 *     summary: JSON'dan tercihleri import et
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferences:
 *                 type: object
 *               merge:
 *                 type: boolean
 *                 description: true ise mevcut tercihlerle birleştir, false ise üzerine yaz
 *     responses:
 *       200:
 *         description: Import başarılı
 */
router.post('/import/all', async (req, res) => {
  try {
    const { preferences, merge = true } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Geçersiz import formatı' });
    }

    // Eğer merge değilse önce mevcut tercihleri sil
    if (!merge) {
      await query(
        `
        DELETE FROM user_preferences WHERE user_id = $1
      `,
        [req.user.id]
      );
    }

    // Yeni tercihleri ekle/güncelle
    const updates = [];
    for (const [key, value] of Object.entries(preferences)) {
      if (typeof key !== 'string' || key.length > 100) {
        continue;
      }

      updates.push(
        query(
          `
          INSERT INTO user_preferences (user_id, preference_key, preference_value)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, preference_key)
          DO UPDATE SET preference_value = $3, updated_at = NOW()
        `,
          [req.user.id, key, JSON.stringify(value)]
        )
      );
    }

    await Promise.all(updates);

    res.json({
      success: true,
      message: 'Tercihler import edildi',
      count: updates.length,
      merge,
    });
  } catch (error) {
    logger.error('Tercih import hatası', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: error.message });
  }
});

export default router;
