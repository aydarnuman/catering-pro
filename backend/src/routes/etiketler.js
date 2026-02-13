/**
 * Etiketler API
 * Fatura etiketleme sistemi
 */

import express from 'express';
import { query } from '../database.js';
import { asyncHandler } from '../middleware/error-handler.js';

const router = express.Router();

// ==================== ETİKETLER ====================

// Tüm etiketleri listele
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { aktif } = req.query;

    let sql = 'SELECT * FROM etiketler';
    const params = [];

    if (aktif !== undefined) {
      sql += ' WHERE aktif = $1';
      params.push(aktif === 'true');
    }

    sql += ' ORDER BY sira ASC, ad ASC';

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

// Yeni etiket oluştur
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { kod, ad, renk, ikon, aciklama } = req.body;

    if (!kod || !ad) {
      return res.status(400).json({
        success: false,
        error: 'Kod ve ad zorunludur',
      });
    }

    try {
      const result = await query(
        `
      INSERT INTO etiketler (kod, ad, renk, ikon, aciklama)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
        [kod.toUpperCase(), ad, renk || '#6366f1', ikon || 'tag', aciklama]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Etiket oluşturuldu',
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'Bu kod zaten kullanılıyor',
        });
      }
      throw error;
    }
  })
);

// Etiket güncelle
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { ad, renk, ikon, aciklama, aktif, sira } = req.body;

    const result = await query(
      `
      UPDATE etiketler 
      SET ad = COALESCE($2, ad),
          renk = COALESCE($3, renk),
          ikon = COALESCE($4, ikon),
          aciklama = COALESCE($5, aciklama),
          aktif = COALESCE($6, aktif),
          sira = COALESCE($7, sira),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
      [id, ad, renk, ikon, aciklama, aktif, sira]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Etiket bulunamadı' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Etiket güncellendi',
    });
  })
);

// Etiket sil
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query('DELETE FROM etiketler WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Etiket bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Etiket silindi',
    });
  })
);

// ==================== FATURA ETİKETLERİ ====================

// Birden fazla faturanın etiketlerini getir (bulk) - ÖNCELİKLİ OLMALI!
router.post(
  '/fatura/bulk',
  asyncHandler(async (req, res) => {
    const { ettn_list } = req.body;

    if (!Array.isArray(ettn_list) || ettn_list.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const placeholders = ettn_list.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `
      SELECT fe.fatura_ettn, e.*
      FROM fatura_etiketler fe
      JOIN etiketler e ON e.id = fe.etiket_id
      WHERE fe.fatura_ettn IN (${placeholders})
      ORDER BY e.sira ASC
    `,
      ettn_list
    );

    // ETTN bazlı grupla
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.fatura_ettn]) {
        grouped[row.fatura_ettn] = [];
      }
      grouped[row.fatura_ettn].push({
        id: row.id,
        kod: row.kod,
        ad: row.ad,
        renk: row.renk,
        ikon: row.ikon,
      });
    }

    res.json({
      success: true,
      data: grouped,
    });
  })
);

// Faturanın etiketlerini getir
router.get(
  '/fatura/:ettn',
  asyncHandler(async (req, res) => {
    const { ettn } = req.params;

    const result = await query(
      `
      SELECT e.*, fe.notlar, fe.created_at as atanma_tarihi
      FROM fatura_etiketler fe
      JOIN etiketler e ON e.id = fe.etiket_id
      WHERE fe.fatura_ettn = $1
      ORDER BY e.sira ASC
    `,
      [ettn]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

// Faturaya etiket ata
router.post(
  '/fatura/:ettn',
  asyncHandler(async (req, res) => {
    const { ettn } = req.params;
    const { etiket_id, notlar } = req.body;

    if (!etiket_id) {
      return res.status(400).json({
        success: false,
        error: 'Etiket ID zorunludur',
      });
    }

    const result = await query(
      `
      INSERT INTO fatura_etiketler (fatura_ettn, etiket_id, notlar)
      VALUES ($1, $2, $3)
      ON CONFLICT (fatura_ettn, etiket_id) DO UPDATE SET notlar = $3
      RETURNING *
    `,
      [ettn, etiket_id, notlar]
    );

    // Etiket bilgisini de getir
    const etiketResult = await query('SELECT * FROM etiketler WHERE id = $1', [etiket_id]);

    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        etiket: etiketResult.rows[0],
      },
      message: 'Etiket atandı',
    });
  })
);

// Faturadan etiket kaldır
router.delete(
  '/fatura/:ettn/:etiketId',
  asyncHandler(async (req, res) => {
    const { ettn, etiketId } = req.params;

    const result = await query(
      `
      DELETE FROM fatura_etiketler 
      WHERE fatura_ettn = $1 AND etiket_id = $2
      RETURNING *
    `,
      [ettn, etiketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Etiket ataması bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Etiket kaldırıldı',
    });
  })
);

// Faturanın tüm etiketlerini güncelle (toplu)
router.put(
  '/fatura/:ettn',
  asyncHandler(async (req, res) => {
    const { ettn } = req.params;
    const { etiket_ids } = req.body; // Array of etiket IDs

    if (!Array.isArray(etiket_ids)) {
      return res.status(400).json({
        success: false,
        error: 'etiket_ids array olmalı',
      });
    }

    // Önce mevcut etiketleri sil
    await query('DELETE FROM fatura_etiketler WHERE fatura_ettn = $1', [ettn]);

    // Yeni etiketleri ekle
    if (etiket_ids.length > 0) {
      const values = etiket_ids.map((_id, i) => `($1, $${i + 2})`).join(', ');
      await query(`INSERT INTO fatura_etiketler (fatura_ettn, etiket_id) VALUES ${values}`, [ettn, ...etiket_ids]);
    }

    // Güncel etiketleri getir
    const result = await query(
      `
      SELECT e.*
      FROM fatura_etiketler fe
      JOIN etiketler e ON e.id = fe.etiket_id
      WHERE fe.fatura_ettn = $1
      ORDER BY e.sira ASC
    `,
      [ettn]
    );

    res.json({
      success: true,
      data: result.rows,
      message: 'Etiketler güncellendi',
    });
  })
);

// Etiket bazlı fatura listesi
router.get(
  '/raporlar/etiket-bazli',
  asyncHandler(async (_req, res) => {
    const result = await query(`
      SELECT 
        e.id,
        e.kod,
        e.ad,
        e.renk,
        e.ikon,
        COUNT(fe.id) as fatura_sayisi,
        COALESCE(SUM(ui.payable_amount), 0) as toplam_tutar
      FROM etiketler e
      LEFT JOIN fatura_etiketler fe ON fe.etiket_id = e.id
      LEFT JOIN uyumsoft_invoices ui ON ui.ettn = fe.fatura_ettn
      WHERE e.aktif = true
      GROUP BY e.id, e.kod, e.ad, e.renk, e.ikon
      ORDER BY e.sira ASC
    `);

    // Etiketsiz faturaları da say
    const etiketsizResult = await query(`
      SELECT 
        COUNT(*) as fatura_sayisi,
        COALESCE(SUM(payable_amount), 0) as toplam_tutar
      FROM uyumsoft_invoices ui
      WHERE NOT EXISTS (
        SELECT 1 FROM fatura_etiketler fe WHERE fe.fatura_ettn = ui.ettn
      )
    `);

    res.json({
      success: true,
      data: {
        etiketler: result.rows,
        etiketsiz: etiketsizResult.rows[0],
      },
    });
  })
);

export default router;
