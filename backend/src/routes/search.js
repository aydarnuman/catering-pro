/**
 * Global Search API
 * Tüm modüllerde arama yapan endpoint
 */

import express from 'express';
import { query } from '../database.js';

const router = express.Router();

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Global arama
 *     description: Tüm modüllerde arama yapar (ihaleler, cariler, faturalar, stok, personel)
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Arama terimi (min 2 karakter)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Her kategori için maksimum sonuç sayısı
 *     responses:
 *       200:
 *         description: Arama sonuçları kategorize edilmiş şekilde
 *       400:
 *         description: Geçersiz arama terimi
 */
router.get('/', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Arama terimi en az 2 karakter olmalı' 
      });
    }
    
    const searchTerm = `%${q}%`;
    const limitNum = Math.min(parseInt(limit) || 5, 10);
    
    // Paralel arama sorguları
    const [tenders, cariler, invoices, stok, personel] = await Promise.all([
      // İhaleler
      query(`
        SELECT 
          id,
          title,
          city,
          organization_name as organization,
          tender_date,
          'tender' as type
        FROM tenders 
        WHERE (title ILIKE $1 OR organization_name ILIKE $1 OR city ILIKE $1)
          AND status = 'active'
        ORDER BY tender_date DESC NULLS LAST
        LIMIT $2
      `, [searchTerm, limitNum]),
      
      // Cariler
      query(`
        SELECT 
          id,
          unvan as title,
          tip,
          vergi_no,
          telefon,
          'cari' as type
        FROM cariler 
        WHERE (unvan ILIKE $1 OR vergi_no ILIKE $1 OR telefon ILIKE $1)
          AND aktif = true
        ORDER BY unvan ASC
        LIMIT $2
      `, [searchTerm, limitNum]),
      
      // Faturalar - cariler join ile
      query(`
        SELECT 
          i.id,
          COALESCE(c.unvan, 'Fatura #' || i.id) as title,
          c.unvan as customer_name,
          i.total_amount,
          i.invoice_date,
          'invoice' as type
        FROM invoices i
        LEFT JOIN cariler c ON c.id = i.customer_id
        WHERE c.unvan ILIKE $1
        ORDER BY i.invoice_date DESC
        LIMIT $2
      `, [searchTerm, limitNum]),
      
      // Stok Kartları
      query(`
        SELECT 
          id,
          ad as title,
          kod,
          marka as kategori,
          'stok' as type
        FROM stok_kartlari 
        WHERE (ad ILIKE $1 OR kod ILIKE $1 OR barkod ILIKE $1)
          AND aktif = true
        ORDER BY ad ASC
        LIMIT $2
      `, [searchTerm, limitNum]),
      
      // Personel
      query(`
        SELECT 
          id,
          COALESCE(tam_ad, ad || ' ' || COALESCE(soyad, '')) as title,
          departman,
          pozisyon,
          telefon,
          'personel' as type
        FROM personeller 
        WHERE (ad ILIKE $1 OR soyad ILIKE $1 OR tc_kimlik ILIKE $1 OR tam_ad ILIKE $1)
          AND aktif = true
        ORDER BY ad ASC
        LIMIT $2
      `, [searchTerm, limitNum])
    ]);
    
    const results = {
      tenders: tenders.rows,
      cariler: cariler.rows,
      invoices: invoices.rows,
      stok: stok.rows,
      personel: personel.rows,
      totalCount: 
        tenders.rowCount + 
        cariler.rowCount + 
        invoices.rowCount + 
        stok.rowCount + 
        personel.rowCount
    };
    
    res.json({
      success: true,
      query: q,
      results
    });
    
  } catch (error) {
    console.error('Global search hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
