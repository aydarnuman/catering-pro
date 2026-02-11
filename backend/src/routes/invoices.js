/**
 * Fatura Yönetimi API
 * Manuel faturalar için CRUD işlemleri
 */

import express from 'express';
import { query, transaction } from '../database.js';
import { auditLog, authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { faturaKalemleriClient } from '../services/fatura-kalemleri-client.js';
import { createInvoiceSchema, updateInvoiceSchema, updateInvoiceStatusSchema } from '../validations/invoices.js';

const router = express.Router();

// NOT: GET route'ları herkese açık, POST/PUT/DELETE route'ları authentication gerektirir

/**
 * GET /api/invoices/stats
 * Dashboard widget için fatura istatistikleri
 */
router.get('/stats', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as toplam_fatura,
        COUNT(*) FILTER (WHERE status = 'WaitingForAprovement') as bekleyen_fatura,
        COUNT(*) FILTER (WHERE status = 'Approved') as onaylanan_fatura,
        COUNT(*) FILTER (WHERE status = 'Rejected') as reddedilen_fatura,
        COUNT(*) FILTER (WHERE due_date = CURRENT_DATE) as bugun_vade,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'Paid') as geciken_fatura,
        COALESCE(SUM(total_amount), 0) as toplam_tutar,
        COALESCE(SUM(CASE WHEN status = 'WaitingForAprovement' THEN total_amount ELSE 0 END), 0) as bekleyen_tutar
      FROM invoices
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const stats = result.rows[0];

    res.json({
      success: true,
      toplam_fatura: parseInt(stats.toplam_fatura, 10) || 0,
      bekleyen_fatura: parseInt(stats.bekleyen_fatura, 10) || 0,
      onaylanan_fatura: parseInt(stats.onaylanan_fatura, 10) || 0,
      reddedilen_fatura: parseInt(stats.reddedilen_fatura, 10) || 0,
      bugun_vade: parseInt(stats.bugun_vade, 10) || 0,
      geciken_fatura: parseInt(stats.geciken_fatura, 10) || 0,
      toplam_tutar: Math.round(parseFloat(stats.toplam_tutar)) || 0,
      bekleyen_tutar: Math.round(parseFloat(stats.bekleyen_tutar)) || 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/invoices
 * Tüm faturaları listele
 */
router.get('/', async (req, res) => {
  try {
    const {
      type, // sales, purchase
      status,
      customer,
      startDate,
      endDate,
      limit = 250,
      offset = 0,
      search,
      proje_id, // Proje bazlı filtreleme
    } = req.query;

    // Kalem verisi tek kaynak: /api/fatura-kalemleri (fatura_kalemleri tablosu). Manuel fatura kalemleri kaldırıldı.
    let sql = `
      SELECT 
        i.*,
        p.ad as proje_adi,
        p.musteri as proje_musteri,
        '[]'::json as items
      FROM invoices i
      LEFT JOIN projeler p ON i.proje_id = p.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (type) {
      sql += ` AND i.invoice_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (status) {
      sql += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (customer) {
      sql += ` AND i.customer_name ILIKE $${paramIndex}`;
      params.push(`%${customer}%`);
      paramIndex++;
    }

    if (startDate) {
      sql += ` AND i.invoice_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sql += ` AND i.invoice_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (
        i.invoice_no ILIKE $${paramIndex} OR 
        i.customer_name ILIKE $${paramIndex} OR 
        i.notes ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (proje_id) {
      sql += ` AND i.proje_id = $${paramIndex}`;
      params.push(proje_id);
      paramIndex++;
    }

    sql += ` ORDER BY i.invoice_date DESC, i.created_at DESC`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Toplam sayıyı al
    let countSql = `
      SELECT COUNT(*) as total
      FROM invoices i
      WHERE 1=1
    `;

    const countParams = params.slice(0, -2); // limit ve offset hariç
    if (type) countSql += ` AND i.invoice_type = $1`;
    if (status) countSql += ` AND i.status = $2`;
    // ... diğer filtreler

    const countResult = await query(countSql, countParams);

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/invoices/:id
 * Tek bir fatura detayı
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const invoiceResult = await query(
      `
      SELECT * FROM invoices WHERE id = $1
    `,
      [id]
    );

    if (!invoiceResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Fatura bulunamadı',
      });
    }

    // Kalem verisi tek kaynak: /api/fatura-kalemleri
    const invoice = invoiceResult.rows[0];
    invoice.items = [];

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/invoices
 * Yeni fatura oluştur
 */
router.post(
  '/',
  authenticate,
  validate(createInvoiceSchema),
  requirePermission('fatura', 'create'),
  auditLog('fatura'),
  async (req, res) => {
    try {
      const {
        invoice_type,
        series,
        invoice_no,
        customer_name,
        customer_vkn,
        customer_address,
        customer_phone,
        customer_email,
        invoice_date,
        due_date,
        status = 'draft',
        notes,
        items = [],
        created_by,
      } = req.body;

      // Transaction başlat
      const result = await transaction(async (client) => {
        // Toplamları hesapla
        let subtotal = 0;
        let vat_total = 0;

        items.forEach((item) => {
          const lineTotal = item.quantity * item.unit_price;
          const vatAmount = lineTotal * (item.vat_rate / 100);
          subtotal += lineTotal;
          vat_total += vatAmount;
        });

        const total_amount = subtotal + vat_total;

        // Faturayı kaydet
        const invoiceResult = await client.query(
          `
        INSERT INTO invoices (
          invoice_type, series, invoice_no, 
          customer_name, customer_vkn, customer_address, customer_phone, customer_email,
          invoice_date, due_date, 
          subtotal, vat_total, total_amount,
          status, notes, source, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *
      `,
          [
            invoice_type,
            series,
            invoice_no,
            customer_name,
            customer_vkn,
            customer_address,
            customer_phone,
            customer_email,
            invoice_date,
            due_date,
            subtotal,
            vat_total,
            total_amount,
            status,
            notes,
            'manual',
            created_by,
          ]
        );

        const invoice = invoiceResult.rows[0];

        // Kalem verisi tek kaynak: fatura_kalemleri / /api/fatura-kalemleri. Manuel fatura kalemleri kaldırıldı.
        invoice.items = [];
        return invoice;
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * PUT /api/invoices/:id
 * Fatura güncelle
 */
router.put(
  '/:id',
  authenticate,
  validate(updateInvoiceSchema),
  requirePermission('fatura', 'edit'),
  auditLog('fatura'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        invoice_type,
        series,
        invoice_no,
        customer_name,
        customer_vkn,
        customer_address,
        customer_phone,
        customer_email,
        invoice_date,
        due_date,
        status,
        notes,
        items = [],
        updated_by,
      } = req.body;

      const result = await transaction(async (client) => {
        // Mevcut faturayı kontrol et
        const checkResult = await client.query('SELECT id FROM invoices WHERE id = $1', [id]);

        if (!checkResult.rows[0]) {
          throw new Error('Fatura bulunamadı');
        }

        // Toplamları hesapla
        let subtotal = 0;
        let vat_total = 0;

        items.forEach((item) => {
          const lineTotal = item.quantity * item.unit_price;
          const vatAmount = lineTotal * (item.vat_rate / 100);
          subtotal += lineTotal;
          vat_total += vatAmount;
        });

        const total_amount = subtotal + vat_total;

        // Faturayı güncelle
        const invoiceResult = await client.query(
          `
        UPDATE invoices SET
          invoice_type = $1, series = $2, invoice_no = $3,
          customer_name = $4, customer_vkn = $5, customer_address = $6,
          customer_phone = $7, customer_email = $8,
          invoice_date = $9, due_date = $10,
          subtotal = $11, vat_total = $12, total_amount = $13,
          status = $14, notes = $15, updated_by = $16,
          updated_at = NOW()
        WHERE id = $17
        RETURNING *
      `,
          [
            invoice_type,
            series,
            invoice_no,
            customer_name,
            customer_vkn,
            customer_address,
            customer_phone,
            customer_email,
            invoice_date,
            due_date,
            subtotal,
            vat_total,
            total_amount,
            status,
            notes,
            updated_by,
            id,
          ]
        );

        const invoice = invoiceResult.rows[0];

        // Kalem verisi tek kaynak: fatura_kalemleri / /api/fatura-kalemleri. Manuel fatura kalemleri kaldırıldı.
        invoice.items = [];
        return invoice;
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * PATCH /api/invoices/:id/status
 * Fatura durumunu güncelle
 */
router.patch('/:id/status', validate(updateInvoiceStatusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await query(
      `
      UPDATE invoices 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [status, id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Fatura bulunamadı',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/invoices/:id
 * Fatura sil
 */
router.delete('/:id', authenticate, requirePermission('fatura', 'delete'), auditLog('fatura'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      DELETE FROM invoices WHERE id = $1 RETURNING id
    `,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Fatura bulunamadı',
      });
    }

    res.json({
      success: true,
      message: 'Fatura başarıyla silindi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/invoices/summary/monthly
 * Aylık fatura özeti
 */
router.get('/summary/monthly', async (req, res) => {
  try {
    const { year, type } = req.query;

    let sql = `
      SELECT 
        DATE_TRUNC('month', invoice_date) as month,
        invoice_type,
        COUNT(*) as count,
        SUM(subtotal) as subtotal,
        SUM(vat_total) as vat_total,
        SUM(total_amount) as total_amount
      FROM invoices
      WHERE status != 'cancelled'
    `;

    const params = [];
    if (year) {
      sql += ` AND EXTRACT(YEAR FROM invoice_date) = $1`;
      params.push(year);
    }
    if (type) {
      sql += ` AND invoice_type = $${params.length + 1}`;
      params.push(type);
    }

    sql += ` GROUP BY DATE_TRUNC('month', invoice_date), invoice_type
             ORDER BY month DESC`;

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/invoices/summary/category
 * Kategori bazlı özet (tek kaynak: faturaKalemleriClient)
 */
router.get('/summary/category', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await faturaKalemleriClient.getKategoriOzetSummary({ startDate, endDate });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
