/**
 * Export Routes - Dışa Aktarım API
 * Excel, PDF ve Mail gönderimi
 */

import express from 'express';
import { query } from '../database.js';
import {
  createCariExcel,
  createCariPDF,
  createDilekcePDF,
  createExcel,
  createFaturaExcel,
  createFaturaPDF,
  createPDF,
  createPersonelExcel,
  createPersonelPDF,
  createStokExcel,
  createStokPDF,
  sendMail,
} from '../services/export-service.js';

const router = express.Router();

// =====================================================
// PERSONEL EXPORT
// =====================================================

/**
 * GET /api/export/personel/excel
 * Personel listesini Excel olarak indir
 */
router.get('/personel/excel', async (req, res) => {
  try {
    const { departman, durum } = req.query;

    let sql = 'SELECT * FROM personeller WHERE 1=1';
    const params = [];

    if (departman) {
      params.push(departman);
      sql += ` AND departman = $${params.length}`;
    }
    if (durum) {
      params.push(durum);
      sql += ` AND durum = $${params.length}`;
    }

    sql += ' ORDER BY tam_ad';

    const result = await query(sql, params);
    const buffer = createPersonelExcel(result.rows);

    const filename = `personel-listesi-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/personel/pdf
 * Personel listesini PDF olarak indir
 */
router.get('/personel/pdf', async (req, res) => {
  try {
    const { departman, durum } = req.query;

    let sql = 'SELECT * FROM personeller WHERE 1=1';
    const params = [];

    if (departman) {
      params.push(departman);
      sql += ` AND departman = $${params.length}`;
    }
    if (durum) {
      params.push(durum);
      sql += ` AND durum = $${params.length}`;
    }

    sql += ' ORDER BY tam_ad';

    const result = await query(sql, params);
    const buffer = await createPersonelPDF(result.rows);

    const filename = `personel-listesi-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/export/personel/mail
 * Personel listesini mail olarak gönder
 */
router.post('/personel/mail', async (req, res) => {
  try {
    const { email, format = 'excel', departman, durum } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-posta adresi gerekli' });
    }

    let sql = 'SELECT * FROM personeller WHERE 1=1';
    const params = [];

    if (departman) {
      params.push(departman);
      sql += ` AND departman = $${params.length}`;
    }
    if (durum) {
      params.push(durum);
      sql += ` AND durum = $${params.length}`;
    }

    sql += ' ORDER BY tam_ad';

    const result = await query(sql, params);

    let buffer, attachmentName, attachmentType;
    if (format === 'pdf') {
      buffer = await createPersonelPDF(result.rows);
      attachmentName = `personel-listesi-${new Date().toISOString().split('T')[0]}.pdf`;
      attachmentType = 'application/pdf';
    } else {
      buffer = createPersonelExcel(result.rows);
      attachmentName = `personel-listesi-${new Date().toISOString().split('T')[0]}.xlsx`;
      attachmentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    await sendMail(
      {
        to: email,
        subject: `Personel Listesi - ${new Date().toLocaleDateString('tr-TR')}`,
        text: `Personel listesi ekte gönderilmiştir.\n\nToplam: ${result.rows.length} personel\nOluşturulma: ${new Date().toLocaleString('tr-TR')}\n\nCatering Pro`,
        html: `
        <h2>Personel Listesi</h2>
        <p>Personel listesi ekte gönderilmiştir.</p>
        <ul>
          <li><strong>Toplam:</strong> ${result.rows.length} personel</li>
          <li><strong>Oluşturulma:</strong> ${new Date().toLocaleString('tr-TR')}</li>
        </ul>
        <hr>
        <p style="color: gray; font-size: 12px;">Catering Pro - Personel Yönetimi</p>
      `,
        attachmentName,
        attachmentType,
      },
      buffer
    );

    res.json({ success: true, message: `Mail ${email} adresine gönderildi` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// FATURA EXPORT
// =====================================================

/**
 * GET /api/export/fatura/excel
 */
router.get('/fatura/excel', async (req, res) => {
  try {
    const { type, status, startDate, endDate } = req.query;

    let sql = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];

    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      sql += ` AND invoice_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND invoice_date <= $${params.length}`;
    }

    sql += ' ORDER BY invoice_date DESC';

    const result = await query(sql, params);
    const buffer = createFaturaExcel(result.rows);

    const filename = `fatura-listesi-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/fatura/pdf
 */
router.get('/fatura/pdf', async (req, res) => {
  try {
    const { type, status, startDate, endDate } = req.query;

    let sql = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];

    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      sql += ` AND invoice_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND invoice_date <= $${params.length}`;
    }

    sql += ' ORDER BY invoice_date DESC';

    const result = await query(sql, params);
    const buffer = await createFaturaPDF(result.rows);

    const filename = `fatura-listesi-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/export/fatura/mail
 */
router.post('/fatura/mail', async (req, res) => {
  try {
    const { email, format = 'excel', type, status, startDate, endDate } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-posta adresi gerekli' });
    }

    let sql = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];

    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      sql += ` AND invoice_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND invoice_date <= $${params.length}`;
    }

    sql += ' ORDER BY invoice_date DESC';

    const result = await query(sql, params);

    let buffer, attachmentName, attachmentType;
    if (format === 'pdf') {
      buffer = await createFaturaPDF(result.rows);
      attachmentName = `fatura-listesi-${new Date().toISOString().split('T')[0]}.pdf`;
      attachmentType = 'application/pdf';
    } else {
      buffer = createFaturaExcel(result.rows);
      attachmentName = `fatura-listesi-${new Date().toISOString().split('T')[0]}.xlsx`;
      attachmentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    await sendMail(
      {
        to: email,
        subject: `Fatura Listesi - ${new Date().toLocaleDateString('tr-TR')}`,
        text: `Fatura listesi ekte gönderilmiştir.\n\nToplam: ${result.rows.length} fatura`,
        html: `
        <h2>Fatura Listesi</h2>
        <p>Fatura listesi ekte gönderilmiştir.</p>
        <ul>
          <li><strong>Toplam:</strong> ${result.rows.length} fatura</li>
          <li><strong>Oluşturulma:</strong> ${new Date().toLocaleString('tr-TR')}</li>
        </ul>
        <hr>
        <p style="color: gray; font-size: 12px;">Catering Pro - Fatura Yönetimi</p>
      `,
        attachmentName,
        attachmentType,
      },
      buffer
    );

    res.json({ success: true, message: `Mail ${email} adresine gönderildi` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// CARİ EXPORT
// =====================================================

/**
 * GET /api/export/cari/excel
 */
router.get('/cari/excel', async (req, res) => {
  try {
    const { tip, aktif } = req.query;

    let sql = 'SELECT * FROM cariler WHERE 1=1';
    const params = [];

    if (tip) {
      params.push(tip);
      sql += ` AND tip = $${params.length}`;
    }
    if (aktif !== undefined) {
      params.push(aktif === 'true');
      sql += ` AND aktif = $${params.length}`;
    }

    sql += ' ORDER BY unvan';

    const result = await query(sql, params);
    const buffer = createCariExcel(result.rows);

    const filename = `cari-listesi-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/cari/pdf
 */
router.get('/cari/pdf', async (req, res) => {
  try {
    const { tip, aktif } = req.query;

    let sql = 'SELECT * FROM cariler WHERE 1=1';
    const params = [];

    if (tip) {
      params.push(tip);
      sql += ` AND tip = $${params.length}`;
    }
    if (aktif !== undefined) {
      params.push(aktif === 'true');
      sql += ` AND aktif = $${params.length}`;
    }

    sql += ' ORDER BY unvan';

    const result = await query(sql, params);
    const buffer = await createCariPDF(result.rows);

    const filename = `cari-listesi-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/export/cari/mail
 * Cari listesini mail olarak gönder
 */
router.post('/cari/mail', async (req, res) => {
  try {
    const { email, format = 'excel', tip, aktif } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-posta adresi gerekli' });
    }

    let sql = 'SELECT * FROM cariler WHERE 1=1';
    const params = [];

    if (tip) {
      params.push(tip);
      sql += ` AND tip = $${params.length}`;
    }
    if (aktif !== undefined) {
      params.push(aktif === 'true');
      sql += ` AND aktif = $${params.length}`;
    }

    sql += ' ORDER BY unvan';

    const result = await query(sql, params);

    let buffer, attachmentName, attachmentType;
    if (format === 'pdf') {
      buffer = await createCariPDF(result.rows);
      attachmentName = `cari-listesi-${new Date().toISOString().split('T')[0]}.pdf`;
      attachmentType = 'application/pdf';
    } else {
      buffer = createCariExcel(result.rows);
      attachmentName = `cari-listesi-${new Date().toISOString().split('T')[0]}.xlsx`;
      attachmentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    await sendMail(
      {
        to: email,
        subject: `Cari Listesi - ${new Date().toLocaleDateString('tr-TR')}`,
        text: `Cari listesi ekte gönderilmiştir.\n\nToplam: ${result.rows.length} cari`,
        html: `
        <h2>Cari Listesi</h2>
        <p>Cari listesi ekte gönderilmiştir.</p>
        <ul>
          <li><strong>Toplam:</strong> ${result.rows.length} cari hesap</li>
          <li><strong>Oluşturulma:</strong> ${new Date().toLocaleString('tr-TR')}</li>
        </ul>
        <hr>
        <p style="color: gray; font-size: 12px;">Catering Pro - Cari Yönetimi</p>
      `,
        attachmentName,
        attachmentType,
      },
      buffer
    );

    res.json({ success: true, message: `Mail ${email} adresine gönderildi` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// STOK EXPORT
// =====================================================

/**
 * GET /api/export/stok/excel
 */
router.get('/stok/excel', async (req, res) => {
  try {
    const { kategori, kritik } = req.query;

    let sql = 'SELECT *, son_alis_fiyati as son_alis_fiyat FROM urun_kartlari WHERE aktif = true';
    const params = [];

    if (kategori) {
      params.push(kategori);
      sql += ` AND kategori = $${params.length}`;
    }
    if (kritik === 'true') {
      sql += ' AND miktar <= kritik_stok';
    }

    sql += ' ORDER BY ad';

    const result = await query(sql, params);
    const buffer = createStokExcel(result.rows);

    const filename = `stok-listesi-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/stok/pdf
 */
router.get('/stok/pdf', async (req, res) => {
  try {
    const { kategori, kritik } = req.query;

    let sql = 'SELECT *, son_alis_fiyati as son_alis_fiyat FROM urun_kartlari WHERE aktif = true';
    const params = [];

    if (kategori) {
      params.push(kategori);
      sql += ` AND kategori = $${params.length}`;
    }
    if (kritik === 'true') {
      sql += ' AND miktar <= kritik_stok';
    }

    sql += ' ORDER BY ad';

    const result = await query(sql, params);
    const buffer = await createStokPDF(result.rows);

    const filename = `stok-listesi-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/export/stok/mail
 * Stok listesini mail olarak gönder
 */
router.post('/stok/mail', async (req, res) => {
  try {
    const { email, format = 'excel', kategori, kritik } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-posta adresi gerekli' });
    }

    let sql = 'SELECT *, son_alis_fiyati as son_alis_fiyat FROM urun_kartlari WHERE aktif = true';
    const params = [];

    if (kategori) {
      params.push(kategori);
      sql += ` AND kategori = $${params.length}`;
    }
    if (kritik === 'true' || kritik === true) {
      sql += ' AND miktar <= kritik_stok';
    }

    sql += ' ORDER BY ad';

    const result = await query(sql, params);

    let buffer, attachmentName, attachmentType;
    if (format === 'pdf') {
      buffer = await createStokPDF(result.rows);
      attachmentName = `stok-listesi-${new Date().toISOString().split('T')[0]}.pdf`;
      attachmentType = 'application/pdf';
    } else {
      buffer = createStokExcel(result.rows);
      attachmentName = `stok-listesi-${new Date().toISOString().split('T')[0]}.xlsx`;
      attachmentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    await sendMail(
      {
        to: email,
        subject: `Stok Listesi - ${new Date().toLocaleDateString('tr-TR')}`,
        text: `Stok listesi ekte gönderilmiştir.\n\nToplam: ${result.rows.length} ürün`,
        html: `
        <h2>Stok Listesi</h2>
        <p>Stok listesi ekte gönderilmiştir.</p>
        <ul>
          <li><strong>Toplam:</strong> ${result.rows.length} ürün</li>
          <li><strong>Oluşturulma:</strong> ${new Date().toLocaleString('tr-TR')}</li>
        </ul>
        <hr>
        <p style="color: gray; font-size: 12px;">Catering Pro - Stok Yönetimi</p>
      `,
        attachmentName,
        attachmentType,
      },
      buffer
    );

    res.json({ success: true, message: `Mail ${email} adresine gönderildi` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// ÖZEL RAPORLAR
// =====================================================

/**
 * GET /api/export/personel/proje/:projeId
 * Proje bazlı personel listesi
 */
router.get('/personel/proje/:projeId', async (req, res) => {
  try {
    const { projeId } = req.params;
    const { format = 'excel' } = req.query;

    const sql = `
      SELECT p.*, pr.ad as proje_adi, pp.gorev as proje_gorevi
      FROM personeller p
      JOIN proje_personelleri pp ON p.id = pp.personel_id
      JOIN projeler pr ON pp.proje_id = pr.id
      WHERE pp.proje_id = $1 AND pp.aktif = true
      ORDER BY p.tam_ad
    `;

    const result = await query(sql, [projeId]);
    const projeResult = await query('SELECT ad FROM projeler WHERE id = $1', [projeId]);
    const projeAdi = projeResult.rows[0]?.ad || 'Proje';

    if (format === 'pdf') {
      const buffer = await createPDF({
        title: `${projeAdi} - Personel Listesi`,
        subtitle: `Toplam ${result.rows.length} personel`,
        headers: ['Ad Soyad', 'Görev', 'Departman', 'Telefon', 'Maaş'],
        data: result.rows.map((p) => ({
          'Ad Soyad': p.tam_ad,
          Görev: p.proje_gorevi || p.pozisyon || '-',
          Departman: p.departman || '-',
          Telefon: p.telefon || '-',
          Maaş: p.maas ? `${Number(p.maas).toLocaleString('tr-TR')} TL` : '-',
        })),
        footer: 'Catering Pro - Proje Bazlı Personel Raporu',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${projeAdi}-personel.pdf"`);
      res.send(buffer);
    } else {
      const buffer = createExcel(result.rows, {
        sheetName: projeAdi,
        columns: {
          tam_ad: 'Ad Soyad',
          proje_gorevi: 'Proje Görevi',
          departman: 'Departman',
          pozisyon: 'Pozisyon',
          telefon: 'Telefon',
          email: 'E-posta',
          maas: 'Maaş',
        },
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${projeAdi}-personel.xlsx"`);
      res.send(buffer);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/bordro/:donem
 * Bordro raporu (YYYY-MM formatında)
 */
router.get('/bordro/:donem', async (req, res) => {
  try {
    const { donem } = req.params;
    const { format = 'excel' } = req.query;

    // Bordro tablosu var mı kontrol et
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bordrolar'
      ) as exists
    `);

    let result = { rows: [] };

    if (tableCheck.rows[0]?.exists) {
      const sql = `
        SELECT b.*, p.tam_ad, p.departman, p.pozisyon
        FROM bordrolar b
        JOIN personeller p ON b.personel_id = p.id
        WHERE b.donem = $1
        ORDER BY p.tam_ad
      `;
      result = await query(sql, [donem]);
    }

    if (format === 'pdf') {
      const buffer = await createPDF({
        title: `BORDRO RAPORU - ${donem}`,
        subtitle:
          result.rows.length > 0
            ? `Toplam ${result.rows.length} personel`
            : 'Bu dönem için bordro kaydı bulunmamaktadır.',
        headers: ['Ad Soyad', 'Brüt', 'SGK', 'Vergi', 'Net', 'Maliyet'],
        data: result.rows.map((b) => ({
          'Ad Soyad': b.tam_ad,
          Brüt: `${Number(b.brut_maas || 0).toLocaleString('tr-TR')} TL`,
          SGK: `${Number(b.sgk_iscipayi || 0).toLocaleString('tr-TR')} TL`,
          Vergi: `${Number(b.gelir_vergisi || 0).toLocaleString('tr-TR')} TL`,
          Net: `${Number(b.net_maas || 0).toLocaleString('tr-TR')} TL`,
          Maliyet: `${Number(b.toplam_maliyet || 0).toLocaleString('tr-TR')} TL`,
        })),
        footer: 'Catering Pro - Bordro Raporu',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bordro-${donem}.pdf"`);
      res.send(buffer);
    } else {
      const buffer = createExcel(result.rows, {
        sheetName: `Bordro ${donem}`,
        columns: {
          tam_ad: 'Ad Soyad',
          departman: 'Departman',
          brut_maas: 'Brüt Maaş',
          sgk_iscipayi: 'SGK İşçi',
          issizlik_iscipayi: 'İşsizlik İşçi',
          gelir_vergisi: 'Gelir Vergisi',
          damga_vergisi: 'Damga Vergisi',
          net_maas: 'Net Maaş',
          isveren_sgk: 'SGK İşveren',
          isveren_issizlik: 'İşsizlik İşveren',
          toplam_maliyet: 'Toplam Maliyet',
        },
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="bordro-${donem}.xlsx"`);
      res.send(buffer);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/izin-raporu
 * İzin raporu
 */
router.get('/izin-raporu', async (req, res) => {
  try {
    const { startDate, endDate, format = 'excel' } = req.query;

    // İzin tabloları var mı kontrol et
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'izin_talepleri'
      ) as exists
    `);

    let result = { rows: [] };

    if (tableCheck.rows[0]?.exists) {
      // Önce tablo yapısını kontrol et
      const columnCheck = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'izin_talepleri'
      `);
      const columns = columnCheck.rows.map((r) => r.column_name);

      let sql = `
        SELECT it.*, p.tam_ad, p.departman
      `;

      // izin_turleri tablosu varsa join et
      const izinTurleriCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'izin_turleri'
        ) as exists
      `);

      if (izinTurleriCheck.rows[0]?.exists && columns.includes('izin_turu_id')) {
        sql += `, COALESCE(iz.ad, '-') as izin_turu_adi`;
      }

      sql += ` FROM izin_talepleri it
        JOIN personeller p ON it.personel_id = p.id
      `;

      if (izinTurleriCheck.rows[0]?.exists && columns.includes('izin_turu_id')) {
        sql += ` LEFT JOIN izin_turleri iz ON it.izin_turu_id = iz.id`;
      }

      sql += ` WHERE 1=1`;

      const params = [];

      if (startDate) {
        params.push(startDate);
        sql += ` AND it.baslangic_tarihi >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        sql += ` AND it.bitis_tarihi <= $${params.length}`;
      }

      sql += ' ORDER BY it.baslangic_tarihi DESC';

      result = await query(sql, params);
    }

    if (format === 'pdf') {
      const buffer = await createPDF({
        title: 'İZİN RAPORU',
        subtitle:
          result.rows.length > 0
            ? startDate && endDate
              ? `${startDate} - ${endDate}`
              : `Toplam ${result.rows.length} izin kaydı`
            : 'İzin kaydı bulunmamaktadır.',
        headers: ['Ad Soyad', 'İzin Türü', 'Başlangıç', 'Bitiş', 'Gün', 'Durum'],
        data: result.rows.map((i) => ({
          'Ad Soyad': i.tam_ad,
          'İzin Türü': i.izin_turu_adi || '-',
          Başlangıç: i.baslangic_tarihi ? new Date(i.baslangic_tarihi).toLocaleDateString('tr-TR') : '-',
          Bitiş: i.bitis_tarihi ? new Date(i.bitis_tarihi).toLocaleDateString('tr-TR') : '-',
          Gün: i.gun_sayisi || '-',
          Durum: i.durum || '-',
        })),
        footer: 'Catering Pro - İzin Raporu',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="izin-raporu.pdf"');
      res.send(buffer);
    } else {
      const buffer = createExcel(result.rows, {
        sheetName: 'İzin Raporu',
        columns: {
          tam_ad: 'Ad Soyad',
          departman: 'Departman',
          izin_turu_adi: 'İzin Türü',
          baslangic_tarihi: 'Başlangıç',
          bitis_tarihi: 'Bitiş',
          gun_sayisi: 'Gün Sayısı',
          durum: 'Durum',
          aciklama: 'Açıklama',
        },
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="izin-raporu.xlsx"');
      res.send(buffer);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/fatura/vadesi-gecen
 * Vadesi geçen faturalar
 */
router.get('/fatura/vadesi-gecen', async (req, res) => {
  try {
    const { format = 'excel' } = req.query;

    const sql = `
      SELECT * FROM invoices 
      WHERE due_date < CURRENT_DATE AND status != 'paid'
      ORDER BY due_date ASC
    `;

    const result = await query(sql);

    if (format === 'pdf') {
      const buffer = await createPDF({
        title: 'VADESİ GEÇEN FATURALAR',
        subtitle: `Toplam ${result.rows.length} fatura`,
        headers: ['Fatura No', 'Müşteri', 'Vade', 'Tutar', 'Gecikme'],
        data: result.rows.map((f) => {
          const dueDate = new Date(f.due_date);
          const today = new Date();
          const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            'Fatura No': f.invoice_number || '-',
            Müşteri: f.customer_name || '-',
            Vade: dueDate.toLocaleDateString('tr-TR'),
            Tutar: `${Number(f.total_amount).toLocaleString('tr-TR')} TL`,
            Gecikme: `${diffDays} gün`,
          };
        }),
        footer: 'Catering Pro - Vadesi Geçen Faturalar',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="vadesi-gecen-faturalar.pdf"');
      res.send(buffer);
    } else {
      const buffer = createFaturaExcel(result.rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="vadesi-gecen-faturalar.xlsx"');
      res.send(buffer);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/stok/kritik
 * Kritik stok raporu
 */
router.get('/stok/kritik', async (req, res) => {
  try {
    const { format = 'excel' } = req.query;

    // Stok miktarları ayrı tabloda tutulduğu için join yapıyoruz
    const sql = `
      SELECT
        uk.*,
        uk.toplam_stok as toplam_miktar,
        COALESCE(k.ad, '-') as kategori_adi,
        COALESCE(b.kisa_ad, b.ad, '-') as birim_adi
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE uk.aktif = true
        AND uk.kritik_stok IS NOT NULL
        AND uk.kritik_stok > 0
        AND uk.toplam_stok <= uk.kritik_stok
      ORDER BY (uk.kritik_stok - uk.toplam_stok) DESC
    `;

    const result = await query(sql);

    if (format === 'pdf') {
      const buffer = await createPDF({
        title: 'KRİTİK STOK RAPORU',
        subtitle: `${result.rows.length} ürün kritik seviyede`,
        headers: ['Ürün', 'Kod', 'Mevcut', 'Kritik', 'Eksik'],
        data: result.rows.map((s) => ({
          Ürün: s.ad,
          Kod: s.kod || '-',
          Mevcut: `${s.toplam_miktar} ${s.birim_adi || ''}`,
          Kritik: `${s.kritik_stok} ${s.birim_adi || ''}`,
          Eksik: `${s.kritik_stok - s.toplam_miktar} ${s.birim_adi || ''}`,
        })),
        footer: 'Catering Pro - Kritik Stok Raporu',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="kritik-stok.pdf"');
      res.send(buffer);
    } else {
      const buffer = createStokExcel(result.rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="kritik-stok.xlsx"');
      res.send(buffer);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/cari/bakiye
 * Cari bakiye raporu
 */
router.get('/cari/bakiye', async (req, res) => {
  try {
    const { tip, format = 'excel' } = req.query;

    let sql = 'SELECT * FROM cariler WHERE bakiye != 0';
    const params = [];

    if (tip) {
      params.push(tip);
      sql += ` AND tip = $${params.length}`;
    }

    sql += ' ORDER BY ABS(bakiye) DESC';

    const result = await query(sql, params);

    if (format === 'pdf') {
      const buffer = await createPDF({
        title: 'CARİ BAKİYE RAPORU',
        subtitle: `Toplam ${result.rows.length} cari`,
        headers: ['Ünvan', 'Tip', 'Borç', 'Alacak', 'Bakiye'],
        data: result.rows.map((c) => ({
          Ünvan: c.unvan,
          Tip: c.tip === 'musteri' ? 'Müşteri' : 'Tedarikçi',
          Borç: `${Number(c.borc || 0).toLocaleString('tr-TR')} TL`,
          Alacak: `${Number(c.alacak || 0).toLocaleString('tr-TR')} TL`,
          Bakiye: `${Number(c.bakiye).toLocaleString('tr-TR')} TL`,
        })),
        footer: 'Catering Pro - Cari Bakiye Raporu',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="cari-bakiye.pdf"');
      res.send(buffer);
    } else {
      const buffer = createCariExcel(result.rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="cari-bakiye.xlsx"');
      res.send(buffer);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// DİLEKÇE EXPORT
// =====================================================

/**
 * POST /api/export/dilekce/pdf
 * Dilekçe PDF olarak indir
 */
router.post('/dilekce/pdf', async (req, res) => {
  try {
    const { title, type, content, ihale } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Dilekçe içeriği gerekli' });
    }

    const buffer = await createDilekcePDF({
      title: title || 'DİLEKÇE',
      type: type || 'genel',
      content,
      ihale: ihale || {},
      footer: 'Catering Pro - İhale Yönetimi',
    });

    const typeLabels = {
      asiri_dusuk: 'Asiri-Dusuk-Aciklama',
      idare_sikayet: 'Idareye-Sikayet',
      kik_itiraz: 'KIK-Itiraz',
      aciklama_cevabi: 'Aciklama-Cevabi',
    };

    const filename = `${typeLabels[type] || 'Dilekce'}_${ihale?.ihale_no || Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/export/dilekce/docx
 * Dilekçe Word olarak indir (basit txt olarak, Word'de açılabilir)
 */
router.post('/dilekce/docx', async (req, res) => {
  try {
    const { title, type, content, ihale } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Dilekçe içeriği gerekli' });
    }

    // Basit metin olarak oluştur (Word açabilir)
    let fullContent = '';

    if (title) {
      fullContent += `${title.toUpperCase()}\n${'='.repeat(50)}\n\n`;
    }

    if (ihale?.kurum) fullContent += `Kurum: ${ihale.kurum}\n`;
    if (ihale?.baslik) fullContent += `İhale: ${ihale.baslik}\n`;
    if (ihale?.ihale_no) fullContent += `İhale No: ${ihale.ihale_no}\n`;
    if (ihale?.kurum || ihale?.baslik) fullContent += '\n';

    fullContent += content;
    fullContent += `\n\n${'─'.repeat(50)}\nOluşturulma: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}\nCatering Pro - İhale Yönetimi`;

    const typeLabels = {
      asiri_dusuk: 'Asiri-Dusuk-Aciklama',
      idare_sikayet: 'Idareye-Sikayet',
      kik_itiraz: 'KIK-Itiraz',
      aciklama_cevabi: 'Aciklama-Cevabi',
    };

    const filename = `${typeLabels[type] || 'Dilekce'}_${ihale?.ihale_no || Date.now()}.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fullContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/export/rapor-tipleri/:modul
 * Modüle göre mevcut rapor tiplerini döndür
 */
router.get('/rapor-tipleri/:modul', (req, res) => {
  const { modul } = req.params;

  const raporlar = {
    personel: [
      { value: 'tum', label: 'Tüm Personel', endpoint: '/personel/excel' },
      { value: 'proje', label: 'Proje Bazlı', endpoint: '/personel/proje/:id', needsParam: 'proje' },
      { value: 'departman', label: 'Departman Bazlı', endpoint: '/personel/excel?departman=', needsParam: 'departman' },
      { value: 'bordro', label: 'Bordro Raporu', endpoint: '/bordro/:donem', needsParam: 'donem' },
      { value: 'izin', label: 'İzin Raporu', endpoint: '/izin-raporu' },
    ],
    fatura: [
      { value: 'tum', label: 'Tüm Faturalar', endpoint: '/fatura/excel' },
      { value: 'satis', label: 'Satış Faturaları', endpoint: '/fatura/excel?type=SATIS' },
      { value: 'alis', label: 'Alış Faturaları', endpoint: '/fatura/excel?type=ALIS' },
      { value: 'vadesi-gecen', label: 'Vadesi Geçenler', endpoint: '/fatura/vadesi-gecen' },
      { value: 'tarih', label: 'Tarih Aralığı', endpoint: '/fatura/excel', needsParam: 'tarih' },
    ],
    cari: [
      { value: 'tum', label: 'Tüm Cariler', endpoint: '/cari/excel' },
      { value: 'musteri', label: 'Müşteriler', endpoint: '/cari/excel?tip=musteri' },
      { value: 'tedarikci', label: 'Tedarikçiler', endpoint: '/cari/excel?tip=tedarikci' },
      { value: 'bakiye', label: 'Bakiye Raporu', endpoint: '/cari/bakiye' },
    ],
    stok: [
      { value: 'tum', label: 'Tüm Stok', endpoint: '/stok/excel' },
      { value: 'kritik', label: 'Kritik Stok', endpoint: '/stok/kritik' },
      { value: 'kategori', label: 'Kategori Bazlı', endpoint: '/stok/excel?kategori=', needsParam: 'kategori' },
    ],
  };

  res.json(raporlar[modul] || []);
});

export default router;
