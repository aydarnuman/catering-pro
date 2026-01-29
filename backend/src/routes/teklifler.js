import express from 'express';
import { query } from '../database.js';

const router = express.Router();

// Tüm teklifleri listele
router.get('/', async (req, res) => {
  try {
    const { durum, ihale_id } = req.query;

    let sql = `
            SELECT t.*, 
                   tn.title as ihale_title,
                   tn.tender_date,
                   tn.city
            FROM teklifler t
            LEFT JOIN tenders tn ON t.ihale_id = tn.id
            WHERE 1=1
        `;
    const params = [];

    if (durum) {
      params.push(durum);
      sql += ` AND t.durum = $${params.length}`;
    }

    if (ihale_id) {
      params.push(ihale_id);
      sql += ` AND t.ihale_id = $${params.length}`;
    }

    sql += ` ORDER BY t.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek teklif getir
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
            SELECT t.*, 
                   tn.title as ihale_title,
                   tn.tender_date,
                   tn.city,
                   tn.estimated_cost as ihale_bedeli
            FROM teklifler t
            LEFT JOIN tenders tn ON t.ihale_id = tn.id
            WHERE t.id = $1
        `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// İhaleye ait teklif getir
router.get('/ihale/:ihaleId', async (req, res) => {
  try {
    const { ihaleId } = req.params;

    const result = await query(
      `
            SELECT * FROM teklifler 
            WHERE ihale_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `,
      [ihaleId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni teklif oluştur
router.post('/', async (req, res) => {
  try {
    const {
      ihale_id,
      ihale_adi,
      ihale_kayit_no,
      maliyet_toplam,
      kar_orani,
      kar_tutari,
      teklif_fiyati,
      maliyet_detay,
      birim_fiyat_cetveli,
      cetvel_toplami,
      durum,
      notlar,
    } = req.body;

    const result = await query(
      `
            INSERT INTO teklifler (
                ihale_id, ihale_adi, ihale_kayit_no,
                maliyet_toplam, kar_orani, kar_tutari, teklif_fiyati,
                maliyet_detay, birim_fiyat_cetveli, cetvel_toplami,
                durum, notlar
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `,
      [
        ihale_id || null,
        ihale_adi,
        ihale_kayit_no || null,
        maliyet_toplam || 0,
        kar_orani || 12,
        kar_tutari || 0,
        teklif_fiyati || 0,
        JSON.stringify(maliyet_detay || {}),
        JSON.stringify(birim_fiyat_cetveli || []),
        cetvel_toplami || 0,
        durum || 'taslak',
        notlar || null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Teklif güncelle
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ihale_adi,
      ihale_kayit_no,
      maliyet_toplam,
      kar_orani,
      kar_tutari,
      teklif_fiyati,
      maliyet_detay,
      birim_fiyat_cetveli,
      cetvel_toplami,
      durum,
      notlar,
    } = req.body;

    const result = await query(
      `
            UPDATE teklifler SET
                ihale_adi = COALESCE($1, ihale_adi),
                ihale_kayit_no = COALESCE($2, ihale_kayit_no),
                maliyet_toplam = COALESCE($3, maliyet_toplam),
                kar_orani = COALESCE($4, kar_orani),
                kar_tutari = COALESCE($5, kar_tutari),
                teklif_fiyati = COALESCE($6, teklif_fiyati),
                maliyet_detay = COALESCE($7, maliyet_detay),
                birim_fiyat_cetveli = COALESCE($8, birim_fiyat_cetveli),
                cetvel_toplami = COALESCE($9, cetvel_toplami),
                durum = COALESCE($10, durum),
                notlar = COALESCE($11, notlar)
            WHERE id = $12
            RETURNING *
        `,
      [
        ihale_adi,
        ihale_kayit_no,
        maliyet_toplam,
        kar_orani,
        kar_tutari,
        teklif_fiyati,
        maliyet_detay ? JSON.stringify(maliyet_detay) : null,
        birim_fiyat_cetveli ? JSON.stringify(birim_fiyat_cetveli) : null,
        cetvel_toplami,
        durum,
        notlar,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Teklif sil
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM teklifler WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı' });
    }

    res.json({ success: true, message: 'Teklif silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
