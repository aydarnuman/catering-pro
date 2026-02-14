import express from 'express';
import { query } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// GET /api/masa-paketleri/:tenderId
// Bir ihaleye ait aktif veri paketini getir
// ═══════════════════════════════════════════════════════════════
router.get('/:tenderId', authenticate, async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await query(
      `SELECT * FROM masa_veri_paketleri
       WHERE tender_id = $1 AND is_active = true
       ORDER BY version DESC
       LIMIT 1`,
      [tenderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bu ihale için veri paketi bulunamadı',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Masa veri paketi getirme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/masa-paketleri/:tenderId
// Yeni veri paketi oluştur (masaya gönder)
// Mevcut aktif paketi pasifleştir, yenisini aktif yap
// ═══════════════════════════════════════════════════════════════
router.post('/:tenderId', authenticate, async (req, res) => {
  try {
    const { tenderId } = req.params;
    const {
      tender_title,
      kurum,
      tarih,
      bedel,
      sure,
      analysis_cards,
      user_cards,
      notes,
      correction_count,
      is_confirmed,
    } = req.body;

    // Mevcut aktif paketi pasifleştir + versiyonu al
    const existing = await query(
      `UPDATE masa_veri_paketleri
       SET is_active = false, updated_at = NOW()
       WHERE tender_id = $1 AND is_active = true
       RETURNING version`,
      [tenderId]
    );

    const nextVersion = existing.rows.length > 0 ? existing.rows[0].version + 1 : 1;

    // Yeni paketi oluştur
    const result = await query(
      `INSERT INTO masa_veri_paketleri
        (tender_id, tender_title, kurum, tarih, bedel, sure,
         analysis_cards, user_cards, notes,
         correction_count, is_confirmed,
         created_by, version, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
       RETURNING *`,
      [
        tenderId,
        tender_title || null,
        kurum || null,
        tarih || null,
        bedel || null,
        sure || null,
        JSON.stringify(analysis_cards || {}),
        JSON.stringify(user_cards || []),
        JSON.stringify(notes || []),
        correction_count || 0,
        is_confirmed || false,
        req.user?.id || null,
        nextVersion,
      ]
    );

    logger.info('Masa veri paketi oluşturuldu', {
      tenderId,
      version: nextVersion,
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Masa veri paketi oluşturma hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/masa-paketleri/:tenderId
// Aktif paketi güncelle (ajan analizleri, karar verisi vb.)
// Masadaki ajanlar çalıştıktan sonra sonuçları geri yazar
// ═══════════════════════════════════════════════════════════════
router.patch('/:tenderId', authenticate, async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { agent_analyses, verdict_data } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (agent_analyses !== undefined) {
      updates.push(`agent_analyses = $${paramCount++}`);
      values.push(JSON.stringify(agent_analyses));
    }
    if (verdict_data !== undefined) {
      updates.push(`verdict_data = $${paramCount++}`);
      values.push(JSON.stringify(verdict_data));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Güncellenecek alan yok' });
    }

    values.push(tenderId);
    const result = await query(
      `UPDATE masa_veri_paketleri
       SET ${updates.join(', ')}
       WHERE tender_id = $${paramCount} AND is_active = true
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Aktif veri paketi bulunamadı',
      });
    }

    logger.info('Masa veri paketi güncellendi', { tenderId, fields: Object.keys(req.body) });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Masa veri paketi güncelleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/masa-paketleri/:tenderId/versions
// Paket geçmişini listele
// ═══════════════════════════════════════════════════════════════
router.get('/:tenderId/versions', authenticate, async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await query(
      `SELECT id, version, is_active, created_at, updated_at, created_by,
              correction_count, is_confirmed
       FROM masa_veri_paketleri
       WHERE tender_id = $1
       ORDER BY version DESC`,
      [tenderId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Masa paket versiyonları hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
