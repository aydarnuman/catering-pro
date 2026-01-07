/**
 * Cariler (Müşteri/Tedarikçi) API
 */

import express from 'express';
import { query } from '../database.js';

const router = express.Router();

// Tüm carileri listele
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
    console.error('Cariler listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tek cari getir
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
    console.error('Cari detay hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yeni cari oluştur
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
      notlar
    } = req.body;
    
    // Zorunlu alanlar kontrolü
    if (!tip || !unvan) {
      return res.status(400).json({ 
        error: 'Tip ve ünvan zorunludur' 
      });
    }
    
    const result = await query(`
      INSERT INTO cariler (
        tip, unvan, yetkili, vergi_no, vergi_dairesi,
        telefon, email, adres, il, ilce,
        borc, alacak, kredi_limiti, banka_adi, iban, notlar
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING *
    `, [
      tip, unvan, yetkili, vergi_no, vergi_dairesi,
      telefon, email, adres, il, ilce,
      borc, alacak, kredi_limiti, banka_adi, iban, notlar
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Cari başarıyla oluşturuldu'
    });
    
  } catch (error) {
    console.error('Cari oluşturma hatası:', error);
    
    // Duplicate key hatası
    if (error.code === '23505') {
      return res.status(400).json({ 
        error: 'Bu vergi numarası zaten kayıtlı' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Cari güncelle
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // ID'yi update'lerden çıkar
    delete updates.id;
    delete updates.bakiye; // Computed field
    delete updates.created_at;
    delete updates.updated_at;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        error: 'Güncellenecek alan bulunamadı' 
      });
    }
    
    // Dinamik UPDATE sorgusu oluştur
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
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Cari güncellendi'
    });
    
  } catch (error) {
    console.error('Cari güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cari hareketlerini getir
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
    console.error('Cari hareketleri getirme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Cari hareketleri alınırken bir hata oluştu'
    });
  }
});

// Cari aylık özet
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
    console.error('Aylık özet hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Aylık özet alınırken bir hata oluştu'
    });
  }
});

// Cari sil
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete - sadece aktif flag'ini false yap
    const result = await query(
      'UPDATE cariler SET aktif = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cari bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Cari silindi (pasif edildi)'
    });
    
  } catch (error) {
    console.error('Cari silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cari hesap ekstresi
router.get('/:id/ekstre', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    // Cari bilgilerini al
    const cariResult = await query(
      'SELECT * FROM cariler WHERE id = $1',
      [id]
    );
    
    if (cariResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cari bulunamadı' });
    }
    
    // Fatura hareketlerini al
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
    
    // Bakiye hesapla
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
    console.error('Cari ekstre hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
