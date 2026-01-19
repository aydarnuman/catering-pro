/**
 * Tender Dilekçe Routes
 * İhale uzmanı modalında oluşturulan dilekçelerin CRUD işlemleri
 */

import express from 'express';
import { query } from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/tender-dilekce/:tenderId
 * Bir ihaleye ait tüm dilekçeleri getir
 */
router.get('/:tenderId', authenticate, async (req, res) => {
  try {
    const { tenderId } = req.params;
    
    const result = await query(`
      SELECT 
        td.*,
        u.email as created_by_email
      FROM tender_dilekceleri td
      LEFT JOIN users u ON td.created_by = u.id
      WHERE td.tender_id = $1 OR td.tender_tracking_id = $1
      ORDER BY td.created_at DESC
    `, [tenderId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Dilekçe listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tender-dilekce/detail/:id
 * Tek bir dilekçenin detayını getir
 */
router.get('/detail/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        td.*,
        u.email as created_by_email
      FROM tender_dilekceleri td
      LEFT JOIN users u ON td.created_by = u.id
      WHERE td.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dilekçe bulunamadı' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Dilekçe detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tender-dilekce
 * Yeni dilekçe kaydet
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      tender_tracking_id,
      tender_id,
      dilekce_type,
      title,
      content,
      ihale_bilgileri,
      maliyet_bilgileri
    } = req.body;

    if (!content || !dilekce_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dilekçe içeriği ve türü gerekli' 
      });
    }

    // Aynı ihale ve tür için versiyon hesapla
    const versionResult = await query(`
      SELECT COALESCE(MAX(version), 0) + 1 as next_version
      FROM tender_dilekceleri
      WHERE (tender_id = $1 OR tender_tracking_id = $2)
        AND dilekce_type = $3
    `, [tender_id, tender_tracking_id, dilekce_type]);

    const version = versionResult.rows[0].next_version;

    const result = await query(`
      INSERT INTO tender_dilekceleri (
        tender_tracking_id,
        tender_id,
        dilekce_type,
        title,
        content,
        ihale_bilgileri,
        maliyet_bilgileri,
        version,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      tender_tracking_id || null,
      tender_id || null,
      dilekce_type,
      title,
      content,
      JSON.stringify(ihale_bilgileri || {}),
      JSON.stringify(maliyet_bilgileri || {}),
      version,
      req.user?.id || null
    ]);

    console.log(`✅ Dilekçe kaydedildi: ${dilekce_type} v${version}`);

    res.json({
      success: true,
      data: result.rows[0],
      message: `Dilekçe kaydedildi (v${version})`
    });
  } catch (error) {
    console.error('Dilekçe kaydetme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/tender-dilekce/:id
 * Dilekçe güncelle
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const result = await query(`
      UPDATE tender_dilekceleri
      SET 
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [title, content, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dilekçe bulunamadı' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Dilekçe güncellendi'
    });
  } catch (error) {
    console.error('Dilekçe güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/tender-dilekce/:id
 * Dilekçe sil
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM tender_dilekceleri
      WHERE id = $1
      RETURNING id, dilekce_type, title
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dilekçe bulunamadı' });
    }

    console.log(`🗑️ Dilekçe silindi: ${result.rows[0].title || result.rows[0].dilekce_type}`);

    res.json({
      success: true,
      message: 'Dilekçe silindi'
    });
  } catch (error) {
    console.error('Dilekçe silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tender-dilekce/types/stats
 * Dilekçe türlerine göre istatistikler
 */
router.get('/types/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        dilekce_type,
        COUNT(*) as count,
        MAX(created_at) as last_created
      FROM tender_dilekceleri
      GROUP BY dilekce_type
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Dilekçe istatistik hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
