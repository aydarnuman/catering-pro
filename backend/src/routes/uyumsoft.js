import express from 'express';
import { query } from '../database.js';
import { faturaService, UyumsoftSession } from '../scraper/uyumsoft/index.js';

const router = express.Router();

/**
 * POST /api/uyumsoft/connect
 * Uyumsoft API'ye bağlan (yeni credentials ile)
 */
router.post('/connect', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Kullanıcı adı ve şifre gerekli',
      });
    }

    // Credentials'ı kaydet
    faturaService.saveCredentials(username, password);

    // Bağlantıyı test et
    const testResult = await faturaService.testConnection();

    if (!testResult.success) {
      return res.status(401).json({
        success: false,
        error: testResult.message || 'Bağlantı başarısız',
      });
    }

    // Kullanıcı bilgilerini al
    const userInfo = await faturaService.getUserInfo();

    return res.json({
      success: true,
      message: 'Bağlantı başarılı',
      connected: true,
      user: userInfo.user,
      customer: userInfo.customer,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Bağlantı sırasında hata oluştu: ${error.message}`,
    });
  }
});

/**
 * POST /api/uyumsoft/connect-saved
 * Kayıtlı bilgilerle bağlan
 */
router.post('/connect-saved', async (_req, res) => {
  try {
    if (!faturaService.hasCredentials()) {
      return res.status(400).json({
        success: false,
        error: 'Kayıtlı giriş bilgisi bulunamadı. Lütfen önce kullanıcı adı ve şifre ile giriş yapın.',
      });
    }

    // Bağlantıyı test et
    const testResult = await faturaService.testConnection();

    if (!testResult.success) {
      return res.status(401).json({
        success: false,
        error: testResult.message || 'Bağlantı başarısız',
      });
    }

    // Kullanıcı bilgilerini al
    const userInfo = await faturaService.getUserInfo();

    return res.json({
      success: true,
      message: 'Bağlantı başarılı',
      connected: true,
      user: userInfo.user,
      customer: userInfo.customer,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/uyumsoft/invoice/:ettn
 * Tek bir fatura detayını getir
 */
router.get('/invoice/:ettn', async (req, res) => {
  try {
    const { ettn } = req.params;

    // Önce veritabanından dene
    const result = await query(
      `
      SELECT 
        id,
        ettn,
        invoice_no,
        invoice_date,
        sender_name,
        sender_vkn,
        payable_amount,
        tax_amount,
        taxable_amount,
        currency,
        status
      FROM uyumsoft_invoices
      WHERE ettn = $1 OR invoice_no = $1
      LIMIT 1
    `,
      [ettn]
    );

    if (result.rows.length > 0) {
      res.json({
        success: true,
        invoice: result.rows[0],
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Fatura bulunamadı',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/uyumsoft/disconnect
 * Bağlantıyı kes (client tarafında "bağlı değil" gösterilir; kayıtlı bilgiler silinmez)
 */
router.post('/disconnect', async (_req, res) => {
  try {
    return res.json({ success: true, message: 'Bağlantı kesildi' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/uyumsoft/status
 * Bağlantı durumunu kontrol et
 */
router.get('/status', async (_req, res) => {
  try {
    const hasCredentials = faturaService.hasCredentials();
    const lastSync = faturaService.getLastSync();

    let connected = false;
    if (hasCredentials) {
      const testResult = await faturaService.testConnection();
      connected = testResult.success;
    }

    return res.json({
      connected,
      hasCredentials,
      lastSync: lastSync?.lastSync,
      syncCount: lastSync?.lastFaturaCount ?? lastSync?.totalFetched ?? 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/uyumsoft/credentials
 * Kayıtlı giriş bilgilerini sil
 */
router.delete('/credentials', async (_req, res) => {
  try {
    const session = new UyumsoftSession();
    session.clearAll();

    return res.json({
      success: true,
      message: 'Giriş bilgileri silindi',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/uyumsoft/sync/blocking
 * Fatura senkronizasyonu (senkron - sonuç bekler)
 */
router.post('/sync/blocking', async (req, res) => {
  try {
    const requestedMonths = req.body.months || 3;
    const months = Math.min(requestedMonths, 3);
    const maxInvoices = req.body.maxInvoices || 1000;

    if (requestedMonths > 3) {
    }

    if (!faturaService.hasCredentials()) {
      return res.status(401).json({
        success: false,
        error: 'Bağlantı yok. Önce giriş yapın.',
      });
    }

    const result = await faturaService.syncFaturalar({
      months,
      maxInvoices,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message,
      });
    }

    // Veritabanına kaydet
    let savedCount = 0;
    let errorCount = 0;
    const savedInvoices = [];

    for (const invoice of result.data) {
      try {
        // Veritabanına kaydet veya güncelle
        const dbResult = await query(
          `
          INSERT INTO uyumsoft_invoices (
            ettn, invoice_id, invoice_no,
            invoice_type, invoice_date, creation_date,
            sender_vkn, sender_name, sender_email,
            taxable_amount, tax_amount, payable_amount, currency,
            status, is_new, is_seen,
            last_sync_date
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          )
          ON CONFLICT (ettn) 
          DO UPDATE SET
            invoice_no = EXCLUDED.invoice_no,
            invoice_date = EXCLUDED.invoice_date,
            creation_date = EXCLUDED.creation_date,
            sender_vkn = EXCLUDED.sender_vkn,
            sender_name = EXCLUDED.sender_name,
            sender_email = EXCLUDED.sender_email,
            taxable_amount = EXCLUDED.taxable_amount,
            tax_amount = EXCLUDED.tax_amount,
            payable_amount = EXCLUDED.payable_amount,
            currency = EXCLUDED.currency,
            status = EXCLUDED.status,
            is_new = EXCLUDED.is_new,
            is_seen = EXCLUDED.is_seen,
            last_sync_date = EXCLUDED.last_sync_date,
            updated_at = NOW()
          RETURNING *
        `,
          [
            invoice.documentId, // ettn
            invoice.invoiceId,
            invoice.invoiceId || '', // invoice_no
            'incoming', // invoice_type
            invoice.executionDate,
            invoice.createDate,
            invoice.targetVkn,
            invoice.targetTitle,
            invoice.targetEmail || null,
            invoice.taxExclusiveAmount || 0,
            invoice.taxTotal || 0,
            invoice.payableAmount || 0,
            invoice.currency || 'TRY',
            invoice.status || '',
            invoice.isNew || false,
            invoice.isSeen || false,
            new Date(),
          ]
        );

        savedInvoices.push(dbResult.rows[0]);
        savedCount++;

        // Cari işlemi trigger (create_cari_hareket_from_uyumsoft) ile yapılır.
        // Sadece INSERT edilen faturalarda trigger tetiklenir; duplicate (UPDATE)
        // durumunda borç tekrar eklenmez. Route'tan borç eklemek çift sayıma yol açar.
      } catch (_dbError) {
        errorCount++;
      }
    }
    if (errorCount > 0) {
    }

    // Frontend interface'ine dönüştür
    const formattedData = result.data.map((f) => ({
      faturaNo: f.invoiceId || '',
      ettn: f.documentId || '',
      faturaTarihi: f.executionDate || '',
      olusturmaTarihi: f.createDate || '',
      gonderenVkn: f.targetVkn || '',
      gonderenUnvan: f.targetTitle || '',
      odenecekTutar: f.payableAmount || 0,
      vergilerHaricTutar: f.taxExclusiveAmount || 0,
      kdvTutari: f.taxTotal || 0,
      paraBirimi: f.currency || 'TRY',
      durum: f.status || '',
      faturaTipi: f.type || 'gelen',
      isNew: f.isNew,
      isSeen: f.isSeen,
    }));

    return res.json({
      success: true,
      data: formattedData,
      total: result.total,
      fetched: result.fetched,
      savedToDb: savedCount,
      dbErrors: errorCount,
      dateRange: result.dateRange,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/uyumsoft/sync/details
 * Fatura detayını çek (HTML)
 */
router.post('/sync/details', async (req, res) => {
  try {
    const { ettn } = req.body;

    if (!ettn) {
      return res.status(400).json({
        success: false,
        error: 'ETTN (documentId) gerekli',
      });
    }

    if (!faturaService.hasCredentials()) {
      return res.status(401).json({
        success: false,
        error: 'Bağlantı yok. Önce giriş yapın.',
      });
    }

    const result = await faturaService.getFaturaDetail(ettn);

    return res.json({
      success: result.success,
      ettn,
      html: result.html,
      isVerified: result.isVerified,
      signingDate: result.signingDate,
      error: result.message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/uyumsoft/invoice/:ettn/pdf
 * Fatura PDF'ini indir
 */
router.get('/invoice/:ettn/pdf', async (req, res) => {
  try {
    const { ettn } = req.params;

    if (!faturaService.hasCredentials()) {
      return res.status(401).json({
        success: false,
        error: 'Bağlantı yok.',
      });
    }

    const result = await faturaService.getFaturaPdf(ettn);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message,
      });
    }

    // PDF'i base64'den decode et ve gönder
    const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${ettn}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/uyumsoft/invoice/:ettn/xml
 * Fatura XML'ini indir
 */
router.get('/invoice/:ettn/xml', async (req, res) => {
  try {
    const { ettn } = req.params;

    if (!faturaService.hasCredentials()) {
      return res.status(401).json({
        success: false,
        error: 'Bağlantı yok.',
      });
    }

    const result = await faturaService.getFaturaXml(ettn);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message,
      });
    }

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${ettn}.xml"`);
    return res.send(result.xml);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/uyumsoft/invoice/:ettn/html
 * Fatura HTML görünümünü getir
 */
router.get('/invoice/:ettn/html', async (req, res) => {
  try {
    const { ettn } = req.params;

    if (!faturaService.hasCredentials()) {
      return res.status(401).json({
        success: false,
        error: 'Bağlantı yok.',
      });
    }

    const result = await faturaService.getFaturaDetail(ettn);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message,
      });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(result.html);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/uyumsoft/invoices
 * Veritabanındaki Uyumsoft faturalarını getir
 */
router.get('/invoices', async (req, res) => {
  try {
    const { startDate, endDate, sender, limit = 250, offset = 0, search } = req.query;

    let sql = `
      SELECT ui.*, 
        CASE WHEN fsi.id IS NOT NULL THEN true ELSE false END as stok_islendi,
        fsi.islem_tarihi as stok_islem_tarihi
      FROM uyumsoft_invoices ui
      LEFT JOIN fatura_stok_islem fsi ON ui.ettn = fsi.ettn
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (startDate) {
      sql += ` AND invoice_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sql += ` AND invoice_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (sender) {
      sql += ` AND sender_name ILIKE $${paramIndex}`;
      params.push(`%${sender}%`);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (
        invoice_no ILIKE $${paramIndex} OR 
        sender_name ILIKE $${paramIndex} OR 
        ettn ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY invoice_date DESC, created_at DESC`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Toplam sayıyı al (listeyle aynı filtreler)
    let countSql = `
      SELECT COUNT(*) as total FROM uyumsoft_invoices ui
      WHERE 1=1
    `;
    const countParams = [];
    let countParamIndex = 1;
    if (startDate) {
      countSql += ` AND ui.invoice_date >= $${countParamIndex}`;
      countParams.push(startDate);
      countParamIndex++;
    }
    if (endDate) {
      countSql += ` AND ui.invoice_date <= $${countParamIndex}`;
      countParams.push(endDate);
      countParamIndex++;
    }
    if (sender) {
      countSql += ` AND ui.sender_name ILIKE $${countParamIndex}`;
      countParams.push(`%${sender}%`);
      countParamIndex++;
    }
    if (search) {
      countSql += ` AND (
        ui.invoice_no ILIKE $${countParamIndex} OR 
        ui.sender_name ILIKE $${countParamIndex} OR 
        ui.ettn ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
    }
    const countResult = await query(countSql, countParams);

    // Frontend formatına dönüştür
    const formattedData = result.rows.map((row) => ({
      faturaNo: row.invoice_no,
      ettn: row.ettn,
      faturaTarihi: row.invoice_date,
      olusturmaTarihi: row.creation_date,
      gonderenVkn: row.sender_vkn,
      gonderenUnvan: row.sender_name,
      gonderenEmail: row.sender_email,
      odenecekTutar: parseFloat(row.payable_amount || 0),
      vergilerHaricTutar: parseFloat(row.taxable_amount || 0),
      kdvTutari: parseFloat(row.tax_amount || 0),
      paraBirimi: row.currency,
      durum: row.status,
      faturaTipi: 'gelen',
      isNew: row.is_new,
      isSeen: row.is_seen,
      isVerified: row.is_verified,
      dbId: row.id, // Veritabanı ID'si
      stokIslendi: row.stok_islendi || false,
      stokIslemTarihi: row.stok_islem_tarihi,
    }));

    return res.json({
      success: true,
      data: formattedData,
      total: parseInt(String(countResult.rows[0]?.total ?? 0), 10),
      limit: parseInt(String(limit), 10),
      offset: parseInt(String(offset), 10),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/uyumsoft/invoices/summary
 * Uyumsoft faturaları özet bilgisi
 */
router.get('/invoices/summary', async (_req, res) => {
  try {
    const summary = await query(`
      SELECT 
        COUNT(*) as total_count,
        SUM(payable_amount) as total_amount,
        SUM(tax_amount) as total_vat,
        COUNT(*) FILTER (WHERE is_new = true) as new_count,
        COUNT(*) FILTER (WHERE ai_processed = true) as ai_processed_count,
        MAX(invoice_date) as latest_invoice_date,
        MAX(last_sync_date) as last_sync
      FROM uyumsoft_invoices
    `);

    const byMonth = await query(`
      SELECT 
        DATE_TRUNC('month', invoice_date) as month,
        COUNT(*) as count,
        SUM(payable_amount) as total_amount
      FROM uyumsoft_invoices
      GROUP BY DATE_TRUNC('month', invoice_date)
      ORDER BY month DESC
      LIMIT 12
    `);

    const topSenders = await query(`
      SELECT 
        sender_name,
        sender_vkn,
        COUNT(*) as invoice_count,
        SUM(payable_amount) as total_amount
      FROM uyumsoft_invoices
      GROUP BY sender_name, sender_vkn
      ORDER BY total_amount DESC
      LIMIT 10
    `);

    return res.json({
      success: true,
      summary: summary.rows[0],
      byMonth: byMonth.rows,
      topSenders: topSenders.rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/uyumsoft/test
 * Test endpoint
 */
router.get('/test', async (_req, res) => {
  try {
    const hasCredentials = faturaService.hasCredentials();
    const lastSync = faturaService.getLastSync();

    // Veritabanındaki fatura sayısını al
    const dbCount = await query('SELECT COUNT(*) as count FROM uyumsoft_invoices');

    return res.json({
      success: true,
      message: 'Uyumsoft API aktif',
      timestamp: new Date().toISOString(),
      hasCredentials,
      lastSync,
      dbInvoiceCount: parseInt(String(dbCount.rows[0]?.count ?? 0), 10),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
