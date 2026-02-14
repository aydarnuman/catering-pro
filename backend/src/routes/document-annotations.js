import express from 'express';
import { query } from '../database.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// GET /api/document-annotations/:documentId
// Bir dokümanın tüm annotasyonlarını getir
// ═══════════════════════════════════════════════════════════════
router.get('/:documentId', authenticate, async (req, res) => {
  try {
    const { documentId } = req.params;

    const result = await query(
      `SELECT da.*, tc.title as card_title
       FROM document_annotations da
       LEFT JOIN tender_custom_cards tc ON tc.id = da.target_card_id
       WHERE da.document_id = $1
       ORDER BY da.page_number ASC NULLS LAST, da.created_at ASC`,
      [documentId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Annotasyon listesi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/document-annotations/tender/:tenderId
// Bir ihalenin tüm dökümanlarındaki annotasyonları getir
// ═══════════════════════════════════════════════════════════════
router.get('/tender/:tenderId', authenticate, async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await query(
      `SELECT da.*, d.original_filename as document_name, tc.title as card_title
       FROM document_annotations da
       LEFT JOIN documents d ON d.id = da.document_id
       LEFT JOIN tender_custom_cards tc ON tc.id = da.target_card_id
       WHERE da.tender_id = $1
       ORDER BY da.document_id, da.page_number ASC NULLS LAST, da.created_at ASC`,
      [tenderId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Tender annotasyon listesi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/document-annotations
// Yeni annotasyon ekle
// ═══════════════════════════════════════════════════════════════
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      document_id,
      tender_id,
      annotation_type = 'highlight',
      page_number,
      text_content,
      color = 'yellow',
      target_card_id,
      target_field_path,
      position_data,
    } = req.body;

    if (!document_id || !tender_id) {
      return res.status(400).json({ success: false, error: 'document_id ve tender_id zorunlu' });
    }

    const result = await query(
      `INSERT INTO document_annotations 
        (document_id, tender_id, annotation_type, page_number, text_content, color, target_card_id, target_field_path, position_data, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        document_id,
        tender_id,
        annotation_type,
        page_number || null,
        text_content || null,
        color,
        target_card_id || null,
        target_field_path || null,
        position_data ? JSON.stringify(position_data) : null,
        req.user?.id || null,
      ]
    );

    logger.info('Yeni annotasyon eklendi', {
      documentId: document_id,
      tenderId: tender_id,
      type: annotation_type,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Annotasyon ekleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/document-annotations/:id
// Annotasyon güncelle
// ═══════════════════════════════════════════════════════════════
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { text_content, color, target_card_id, target_field_path, annotation_type } = req.body;

    const existing = await query('SELECT * FROM document_annotations WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Annotasyon bulunamadı' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (text_content !== undefined) {
      updates.push(`text_content = $${paramCount++}`);
      values.push(text_content);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramCount++}`);
      values.push(color);
    }
    if (target_card_id !== undefined) {
      updates.push(`target_card_id = $${paramCount++}`);
      values.push(target_card_id);
    }
    if (target_field_path !== undefined) {
      updates.push(`target_field_path = $${paramCount++}`);
      values.push(target_field_path);
    }
    if (annotation_type !== undefined) {
      updates.push(`annotation_type = $${paramCount++}`);
      values.push(annotation_type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Güncellenecek alan yok' });
    }

    values.push(id);
    const result = await query(
      `UPDATE document_annotations SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Annotasyon güncelleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/document-annotations/:id
// Annotasyon sil
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM document_annotations WHERE id = $1 RETURNING id, document_id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Annotasyon bulunamadı' });
    }

    logger.info('Annotasyon silindi', { annotationId: id });

    res.json({
      success: true,
      message: 'Annotasyon silindi',
    });
  } catch (error) {
    logger.error('Annotasyon silme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
