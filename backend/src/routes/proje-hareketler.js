import express from 'express';
import { query } from '../database.js';

const router = express.Router();

/**
 * GET /api/proje-hareketler/ozet/:projeId
 * Proje gelir/gider özeti
 */
router.get('/ozet/:projeId', async (req, res) => {
  try {
    const { projeId } = req.params;
    const { yil, ay } = req.query;

    let dateFilter = '';
    const params = [projeId];

    if (yil && ay) {
      dateFilter = 'AND EXTRACT(YEAR FROM tarih) = $2 AND EXTRACT(MONTH FROM tarih) = $3';
      params.push(yil, ay);
    }

    // Genel özet
    const ozetResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tip = 'gelir' THEN tutar ELSE 0 END), 0) as toplam_gelir,
        COALESCE(SUM(CASE WHEN tip = 'gider' THEN tutar ELSE 0 END), 0) as toplam_gider,
        COALESCE(SUM(CASE WHEN tip = 'gelir' THEN tutar ELSE -tutar END), 0) as net_kar,
        COALESCE(SUM(CASE WHEN tip = 'gider' AND odendi THEN tutar ELSE 0 END), 0) as odenen_gider,
        COALESCE(SUM(CASE WHEN tip = 'gider' AND NOT odendi THEN tutar ELSE 0 END), 0) as bekleyen_gider
      FROM proje_hareketler
      WHERE proje_id = $1 ${dateFilter}
    `, params);

    // Kategori bazlı özet
    const kategoriResult = await query(`
      SELECT 
        tip,
        kategori,
        COALESCE(SUM(tutar), 0) as toplam,
        COALESCE(SUM(CASE WHEN odendi THEN tutar ELSE 0 END), 0) as odenen,
        COUNT(*) as hareket_sayisi
      FROM proje_hareketler
      WHERE proje_id = $1 ${dateFilter}
      GROUP BY tip, kategori
      ORDER BY tip, toplam DESC
    `, params);

    // Gelir ve gider kategorilerini ayır
    const gelirler = kategoriResult.rows.filter(k => k.tip === 'gelir');
    const giderler = kategoriResult.rows.filter(k => k.tip === 'gider');

    res.json({
      ozet: ozetResult.rows[0],
      gelirler,
      giderler
    });
  } catch (error) {
    console.error('Proje özet hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/proje-hareketler/:projeId
 * Proje hareketleri listesi
 */
router.get('/:projeId', async (req, res) => {
  try {
    const { projeId } = req.params;
    const { yil, ay, tip, kategori, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE proje_id = $1';
    const params = [projeId];
    let paramIndex = 2;

    if (yil) {
      whereClause += ` AND EXTRACT(YEAR FROM tarih) = $${paramIndex}`;
      params.push(yil);
      paramIndex++;
    }
    if (ay) {
      whereClause += ` AND EXTRACT(MONTH FROM tarih) = $${paramIndex}`;
      params.push(ay);
      paramIndex++;
    }
    if (tip) {
      whereClause += ` AND tip = $${paramIndex}`;
      params.push(tip);
      paramIndex++;
    }
    if (kategori) {
      whereClause += ` AND kategori = $${paramIndex}`;
      params.push(kategori);
      paramIndex++;
    }

    const result = await query(`
      SELECT 
        h.*,
        p.ad as proje_adi
      FROM proje_hareketler h
      JOIN projeler p ON p.id = h.proje_id
      ${whereClause}
      ORDER BY h.tarih DESC, h.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    res.json(result.rows);
  } catch (error) {
    console.error('Hareketler listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/proje-hareketler
 * Yeni hareket ekle (manuel)
 */
router.post('/', async (req, res) => {
  try {
    const { proje_id, tip, kategori, tutar, tarih, aciklama, odendi } = req.body;

    const result = await query(`
      INSERT INTO proje_hareketler 
        (proje_id, tip, kategori, tutar, tarih, aciklama, referans_tip, odendi, odeme_tarihi)
      VALUES ($1, $2, $3, $4, $5, $6, 'manuel', $7, ${odendi ? 'NOW()' : 'NULL'})
      RETURNING *
    `, [proje_id, tip, kategori, tutar, tarih, aciklama, odendi || false]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Hareket ekleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/proje-hareketler/personel-gideri
 * Personel gideri ekle (otomatik - maaş ödemesinden)
 */
router.post('/personel-gideri', async (req, res) => {
  try {
    const { proje_id, yil, ay, maas, sgk, vergi, referans_id } = req.body;
    const tarih = `${yil}-${String(ay).padStart(2, '0')}-15`; // Ayın 15'i varsayılan

    const hareketler = [];

    // Maaş hareketi
    if (maas > 0) {
      const maasResult = await query(`
        INSERT INTO proje_hareketler 
          (proje_id, tip, kategori, tutar, tarih, aciklama, referans_tip, referans_id, odendi, odeme_tarihi)
        VALUES ($1, 'gider', 'personel_maas', $2, $3, $4, 'bordro', $5, true, NOW())
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [proje_id, maas, tarih, `${ay}/${yil} Personel Maaşları`, referans_id]);
      if (maasResult.rows[0]) hareketler.push(maasResult.rows[0]);
    }

    // SGK hareketi
    if (sgk > 0) {
      const sgkResult = await query(`
        INSERT INTO proje_hareketler 
          (proje_id, tip, kategori, tutar, tarih, aciklama, referans_tip, referans_id, odendi, odeme_tarihi)
        VALUES ($1, 'gider', 'personel_sgk', $2, $3, $4, 'bordro', $5, true, NOW())
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [proje_id, sgk, tarih, `${ay}/${yil} SGK Primleri`, referans_id]);
      if (sgkResult.rows[0]) hareketler.push(sgkResult.rows[0]);
    }

    // Vergi hareketi
    if (vergi > 0) {
      const vergiResult = await query(`
        INSERT INTO proje_hareketler 
          (proje_id, tip, kategori, tutar, tarih, aciklama, referans_tip, referans_id, odendi, odeme_tarihi)
        VALUES ($1, 'gider', 'personel_vergi', $2, $3, $4, 'bordro', $5, true, NOW())
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [proje_id, vergi, tarih, `${ay}/${yil} Vergiler`, referans_id]);
      if (vergiResult.rows[0]) hareketler.push(vergiResult.rows[0]);
    }

    res.json({ success: true, hareketler });
  } catch (error) {
    console.error('Personel gideri ekleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/proje-hareketler/:id
 * Hareket güncelle
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tutar, aciklama, odendi, proje_id } = req.body;

    const result = await query(`
      UPDATE proje_hareketler 
      SET 
        tutar = COALESCE($1, tutar),
        aciklama = COALESCE($2, aciklama),
        odendi = COALESCE($3, odendi),
        odeme_tarihi = CASE WHEN $3 = true THEN NOW() ELSE odeme_tarihi END,
        proje_id = COALESCE($5, proje_id)
      WHERE id = $4
      RETURNING *
    `, [tutar, aciklama, odendi, id, proje_id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Hareket güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/proje-hareketler/:id
 * Hareket sil (sadece manuel eklenenler)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM proje_hareketler 
      WHERE id = $1 AND referans_tip = 'manuel'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Sadece manuel eklenen hareketler silinebilir' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Hareket silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/proje-hareketler/atanmamis
 * Projeye atanmamış giderler (proje_id NULL olanlar)
 */
router.get('/atanmamis', async (req, res) => {
  try {
    const { yil, ay } = req.query;

    let whereClause = 'WHERE proje_id IS NULL';
    const params = [];
    let paramIndex = 1;

    if (yil) {
      whereClause += ` AND EXTRACT(YEAR FROM tarih) = $${paramIndex}`;
      params.push(yil);
      paramIndex++;
    }
    if (ay) {
      whereClause += ` AND EXTRACT(MONTH FROM tarih) = $${paramIndex}`;
      params.push(ay);
      paramIndex++;
    }

    const result = await query(`
      SELECT *
      FROM proje_hareketler
      ${whereClause}
      ORDER BY tarih DESC, id DESC
      LIMIT 50
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Atanmamış giderler hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/proje-hareketler/tum-projeler/ozet
 * Tüm projelerin özeti (dashboard için)
 */
router.get('/tum-projeler/ozet', async (req, res) => {
  try {
    const { yil, ay } = req.query;

    let dateFilter = '';
    const params = [];

    if (yil && ay) {
      dateFilter = 'WHERE EXTRACT(YEAR FROM h.tarih) = $1 AND EXTRACT(MONTH FROM h.tarih) = $2';
      params.push(yil, ay);
    }

    const result = await query(`
      SELECT 
        p.id as proje_id,
        p.ad as proje_adi,
        COALESCE(SUM(CASE WHEN h.tip = 'gelir' THEN h.tutar ELSE 0 END), 0) as toplam_gelir,
        COALESCE(SUM(CASE WHEN h.tip = 'gider' THEN h.tutar ELSE 0 END), 0) as toplam_gider,
        COALESCE(SUM(CASE WHEN h.tip = 'gelir' THEN h.tutar ELSE -h.tutar END), 0) as net_kar,
        COALESCE(SUM(CASE WHEN h.tip = 'gider' AND h.odendi THEN h.tutar ELSE 0 END), 0) as odenen_gider,
        COALESCE(SUM(CASE WHEN h.tip = 'gider' AND NOT h.odendi THEN h.tutar ELSE 0 END), 0) as bekleyen_gider
      FROM projeler p
      LEFT JOIN proje_hareketler h ON h.proje_id = p.id ${dateFilter ? 'AND ' + dateFilter.replace('WHERE ', '') : ''}
      WHERE p.durum = 'aktif'
      GROUP BY p.id, p.ad
      ORDER BY toplam_gider DESC
    `, params);

    // Genel toplam
    const genelToplam = result.rows.reduce((acc, p) => ({
      toplam_gelir: acc.toplam_gelir + parseFloat(p.toplam_gelir),
      toplam_gider: acc.toplam_gider + parseFloat(p.toplam_gider),
      net_kar: acc.net_kar + parseFloat(p.net_kar),
      odenen_gider: acc.odenen_gider + parseFloat(p.odenen_gider),
      bekleyen_gider: acc.bekleyen_gider + parseFloat(p.bekleyen_gider)
    }), { toplam_gelir: 0, toplam_gider: 0, net_kar: 0, odenen_gider: 0, bekleyen_gider: 0 });

    res.json({
      projeler: result.rows,
      genel: genelToplam
    });
  } catch (error) {
    console.error('Tüm projeler özet hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

