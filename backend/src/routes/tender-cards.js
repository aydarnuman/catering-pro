import express from 'express';
import { query } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// GET /api/tender-cards/:tenderId
// Bir ihaleye ait tüm özel kartları getir
// ═══════════════════════════════════════════════════════════════
router.get('/:tenderId', authenticate, async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { category } = req.query;

    let sql = `
      SELECT tc.*, d.original_filename as document_name
      FROM tender_custom_cards tc
      LEFT JOIN documents d ON d.id = tc.source_document_id
      WHERE tc.tender_id = $1
    `;
    const params = [tenderId];

    if (category && category !== 'tumu') {
      sql += ' AND tc.category = $2';
      params.push(category);
    }

    sql += ' ORDER BY tc.sort_order ASC, tc.created_at ASC';

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Tender cards listesi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/tender-cards/:tenderId
// Yeni kart ekle
// ═══════════════════════════════════════════════════════════════
router.post('/:tenderId', authenticate, async (req, res) => {
  try {
    const { tenderId } = req.params;
    const {
      card_type = 'text',
      title,
      content = {},
      source_type = 'manual',
      source_document_id,
      source_page,
      source_text,
      category = 'diger',
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Kart başlığı zorunlu' });
    }

    // En yüksek sort_order değerini bul
    const maxOrder = await query(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM tender_custom_cards WHERE tender_id = $1',
      [tenderId]
    );

    const result = await query(
      `INSERT INTO tender_custom_cards 
        (tender_id, card_type, title, content, source_type, source_document_id, source_page, source_text, category, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        tenderId,
        card_type,
        title.trim(),
        JSON.stringify(content),
        source_type,
        source_document_id || null,
        source_page || null,
        source_text || null,
        category,
        (maxOrder.rows[0]?.max_order || 0) + 1,
        req.user?.id || null,
      ]
    );

    logger.info('Yeni kart eklendi', { tenderId, cardId: result.rows[0].id, card_type });

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Kart ekleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/tender-cards/:id
// Kart güncelle
// ═══════════════════════════════════════════════════════════════
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { card_type, title, content, category } = req.body;

    // Mevcut kartı kontrol et
    const existing = await query('SELECT * FROM tender_custom_cards WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kart bulunamadı' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (card_type !== undefined) {
      updates.push(`card_type = $${paramCount++}`);
      values.push(card_type);
    }
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title.trim());
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(JSON.stringify(content));
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Güncellenecek alan yok' });
    }

    values.push(id);
    const result = await query(
      `UPDATE tender_custom_cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    logger.info('Kart güncellendi', { cardId: id });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Kart güncelleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/tender-cards/:id/reorder
// Kart sırasını değiştir
// ═══════════════════════════════════════════════════════════════
router.put('/:id/reorder', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { sort_order } = req.body;

    if (sort_order === undefined || sort_order === null) {
      return res.status(400).json({ success: false, error: 'sort_order zorunlu' });
    }

    const result = await query('UPDATE tender_custom_cards SET sort_order = $1 WHERE id = $2 RETURNING *', [
      sort_order,
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kart bulunamadı' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Kart sıralama hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/tender-cards/:id
// Kart sil
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM tender_custom_cards WHERE id = $1 RETURNING id, tender_id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kart bulunamadı' });
    }

    logger.info('Kart silindi', { cardId: id, tenderId: result.rows[0].tender_id });

    res.json({
      success: true,
      message: 'Kart silindi',
    });
  } catch (error) {
    logger.error('Kart silme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
