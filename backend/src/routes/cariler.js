/**
 * @swagger
 * tags:
 *   name: Cariler
 *   description: Müşteri ve tedarikçi yönetimi
 */

import express from 'express';
import { query } from '../database.js';
import { logError, logAPI } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/cariler:
 *   get:
 *     summary: Tüm carileri listele
 *     description: Filtreleme ve arama seçenekleriyle cari listesi döner
 *     tags: [Cariler]
 *     parameters:
 *       - in: query
 *         name: tip
 *         schema:
 *           type: string
 *           enum: [musteri, tedarikci, her_ikisi]
 *         description: Cari tipi filtresi
 *       - in: query
 *         name: aktif
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Aktif/pasif filtresi
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Ünvan veya vergi no ile arama
 *     responses:
 *       200:
 *         description: Cari listesi başarıyla döndü
 *       500:
 *         description: Sunucu hatası
 */
router.get('/', async (req, res) => {
  try {
    const { tip, aktif = true, search } = req.query;
    
    let sql = 'SELECT * FROM cariler WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (aktif !== undefined) {
      sql += ` AND aktif = $${paramIndex}`;
      params.push(aktif === 'true' || aktif === true);
      paramIndex++;
    }
    
    if (tip) {
      sql += ` AND tip = $${paramIndex}`;
      params.push(tip);
      paramIndex++;
    }
    
    if (search) {
      sql += ` AND (unvan ILIKE $${paramIndex} OR vergi_no ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    sql += ' ORDER BY unvan ASC';
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
    
  } catch (error) {
    logError('Cariler Liste', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/cariler/{id}:
 *   get:
 *     summary: Tek cari getir
 *     tags: [Cariler]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cari detayı
 *       404:
 *         description: Cari bulunamadı
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM cariler WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cari bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    logError('Cari Detay', error, { cariId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/cariler:
 *   post:
 *     summary: Yeni cari oluştur
 *     tags: [Cariler]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tip
 *               - unvan
 *     responses:
 *       201:
 *         description: Cari başarıyla oluşturuldu
 *       400:
 *         description: Geçersiz veri
 */
router.post('/', async (req, res) => {
  try {
    const {
      tip,
      unvan,
      yetkili,
      vergi_no,
      vergi_dairesi,
      telefon,
      email,
      adres,
      il,
      ilce,
      borc = 0,
      alacak = 0,
      kredi_limiti = 0,
      banka_adi,
      iban,
      notlar,
      etiket
    } = req.body;
    
    if (!tip || !unvan) {
      return res.status(400).json({ 
        error: 'Tip ve ünvan zorunludur' 
      });
    }
    
    const result = await query(`
      INSERT INTO cariler (
        tip, unvan, yetkili, vergi_no, vergi_dairesi,
        telefon, email, adres, il, ilce,
        borc, alacak, kredi_limiti, banka_adi, iban, notlar, etiket
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `, [
      tip, unvan, yetkili, vergi_no, vergi_dairesi,
      telefon, email, adres, il, ilce,
      borc, alacak, kredi_limiti, banka_adi, iban, notlar, etiket
    ]);
    
    logAPI('Cariler', 'Yeni cari oluşturuldu', { cariId: result.rows[0].id, unvan });
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Cari başarıyla oluşturuldu'
    });
    
  } catch (error) {
    logError('Cari Oluşturma', error, { unvan: req.body.unvan });
    
    if (error.code === '23505') {
      return res.status(400).json({ 
        error: 'Bu vergi numarası zaten kayıtlı' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/cariler/{id}:
 *   put:
 *     summary: Cari güncelle
 *     tags: [Cariler]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cari güncellendi
 *       404:
 *         description: Cari bulunamadı
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    delete updates.id;
    delete updates.bakiye;
    delete updates.created_at;
    delete updates.updated_at;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        error: 'Güncellenecek alan bulunamadı' 
      });
    }
    
    const setClause = Object.keys(updates).map(
      (key, index) => `${key} = $${index + 2}`
    ).join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await query(
      `UPDATE cariler SET ${setClause}, updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cari bulunamadı' });
    }
    
    logAPI('Cariler', 'Cari güncellendi', { cariId: id });
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Cari güncellendi'
    });
    
  } catch (error) {
    logError('Cari Güncelleme', error, { cariId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/cariler/{id}/hareketler:
 *   get:
 *     summary: Cari hareketleri
 *     tags: [Cariler]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Hareket listesi
 */
router.get('/:id/hareketler', async (req, res) => {
  try {
    const { id } = req.params;
    const { baslangic, bitis, tip } = req.query;
    
    let sql = `
      SELECT 
        ch.id,
        ch.belge_tarihi as tarih,
        ch.belge_no,
        ch.aciklama,
        ch.borc,
        ch.alacak,
        ch.vade_tarihi,
        ch.hareket_tipi,
        SUM(ch.alacak - ch.borc) OVER (
          PARTITION BY ch.cari_id 
          ORDER BY ch.belge_tarihi, ch.id
        ) as bakiye
      FROM cari_hareketler ch
      WHERE ch.cari_id = $1
    `;
    
    const params = [id];
    let paramIndex = 2;
    
    if (baslangic) {
      sql += ` AND ch.belge_tarihi >= $${paramIndex}`;
      params.push(baslangic);
      paramIndex++;
    }
    
    if (bitis) {
      sql += ` AND ch.belge_tarihi <= $${paramIndex}`;
      params.push(bitis);
      paramIndex++;
    }
    
    if (tip && tip !== 'all') {
      sql += ` AND ch.hareket_tipi = $${paramIndex}`;
      params.push(tip);
      paramIndex++;
    }
    
    sql += ` ORDER BY ch.belge_tarihi DESC, ch.id DESC`;
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    logError('Cari Hareketler', error, { cariId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Cari hareketleri alınırken bir hata oluştu'
    });
  }
});

/**
 * @swagger
 * /api/cariler/{id}/aylik-ozet:
 *   get:
 *     summary: Cari aylık özet
 *     tags: [Cariler]
 */
router.get('/:id/aylik-ozet', async (req, res) => {
  try {
    const { id } = req.params;
    const { yil } = req.query;
    
    let sql = `
      SELECT 
        CASE 
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 1 THEN 'Ocak'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 2 THEN 'Şubat'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 3 THEN 'Mart'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 4 THEN 'Nisan'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 5 THEN 'Mayıs'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 6 THEN 'Haziran'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 7 THEN 'Temmuz'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 8 THEN 'Ağustos'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 9 THEN 'Eylül'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 10 THEN 'Ekim'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 11 THEN 'Kasım'
          WHEN EXTRACT(MONTH FROM ch.belge_tarihi) = 12 THEN 'Aralık'
        END || ' ' || EXTRACT(YEAR FROM ch.belge_tarihi) as ay,
        DATE_TRUNC('month', ch.belge_tarihi) as ay_tarih,
        SUM(ch.borc) as borc,
        SUM(ch.alacak) as alacak,
        SUM(ch.alacak - ch.borc) as bakiye,
        COUNT(*) as hareket_sayisi
      FROM cari_hareketler ch
      WHERE ch.cari_id = $1
    `;
    
    const params = [id];
    
    if (yil) {
      sql += ` AND EXTRACT(YEAR FROM ch.belge_tarihi) = $2`;
      params.push(yil);
    }
    
    sql += `
      GROUP BY DATE_TRUNC('month', ch.belge_tarihi)
      ORDER BY ay_tarih DESC
      LIMIT 12
    `;
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    logError('Cari Aylık Özet', error, { cariId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Aylık özet alınırken bir hata oluştu'
    });
  }
});

/**
 * @swagger
 * /api/cariler/{id}:
 *   delete:
 *     summary: Cari sil (soft delete)
 *     tags: [Cariler]
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE cariler SET aktif = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cari bulunamadı' });
    }
    
    logAPI('Cariler', 'Cari silindi (pasif)', { cariId: id });
    
    res.json({
      success: true,
      message: 'Cari silindi (pasif edildi)'
    });
    
  } catch (error) {
    logError('Cari Silme', error, { cariId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/cariler/{id}/ekstre:
 *   get:
 *     summary: Cari hesap ekstresi
 *     tags: [Cariler]
 */
router.get('/:id/ekstre', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    const cariResult = await query(
      'SELECT * FROM cariler WHERE id = $1',
      [id]
    );
    
    if (cariResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cari bulunamadı' });
    }
    
    let invoiceSql = `
      SELECT 
        'fatura' as kaynak,
        invoice_date as tarih,
        CASE 
          WHEN invoice_type = 'sales' THEN 'Satış Faturası'
          ELSE 'Alış Faturası'
        END as aciklama,
        series || '-' || invoice_no as belge_no,
        CASE 
          WHEN invoice_type = 'sales' THEN total_amount
          ELSE 0
        END as alacak,
        CASE 
          WHEN invoice_type = 'purchase' THEN total_amount
          ELSE 0
        END as borc
      FROM invoices 
      WHERE customer_name = $1
    `;
    
    const params = [cariResult.rows[0].unvan];
    
    if (startDate) {
      invoiceSql += ' AND invoice_date >= $2';
      params.push(startDate);
    }
    
    if (endDate) {
      const endIndex = startDate ? 3 : 2;
      invoiceSql += ` AND invoice_date <= $${endIndex}`;
      params.push(endDate);
    }
    
    invoiceSql += ' ORDER BY invoice_date DESC';
    
    const invoiceResult = await query(invoiceSql, params);
    
    const toplamBorc = invoiceResult.rows.reduce((sum, row) => sum + parseFloat(row.borc || 0), 0);
    const toplamAlacak = invoiceResult.rows.reduce((sum, row) => sum + parseFloat(row.alacak || 0), 0);
    const bakiye = toplamAlacak - toplamBorc;
    
    res.json({
      success: true,
      data: {
        cari: cariResult.rows[0],
        hareketler: invoiceResult.rows,
        ozet: {
          toplamBorc,
          toplamAlacak,
          bakiye
        }
      }
    });
    
  } catch (error) {
    logError('Cari Ekstre', error, { cariId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

export default router;
