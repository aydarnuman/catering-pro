import express from 'express';
import { pool } from '../database.js';
import { getFirmaId } from '../utils/firma-filter.js';

const router = express.Router();

// ==================== PROJELER ====================

// Tüm projeleri getir
router.get('/projeler', async (req, res) => {
  try {
    const firmaId = getFirmaId(req);
    const result = await pool.query(
      `SELECT * FROM projeler
      WHERE aktif = true${firmaId ? ' AND firma_id = $1' : ''}
      ORDER BY ad`,
      firmaId ? [firmaId] : []
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje ekle
router.post('/projeler', async (req, res) => {
  try {
    const { kod, ad, adres, yetkili, telefon, renk } = req.body;
    const result = await pool.query(
      `
      INSERT INTO projeler (kod, ad, adres, yetkili, telefon, renk)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
      [kod.toUpperCase(), ad, adres, yetkili, telefon, renk || '#6366f1']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje güncelle
router.put('/projeler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { kod, ad, adres, yetkili, telefon, renk, aktif } = req.body;
    const result = await pool.query(
      `
      UPDATE projeler SET 
        kod = COALESCE($1, kod),
        ad = COALESCE($2, ad),
        adres = COALESCE($3, adres),
        yetkili = COALESCE($4, yetkili),
        telefon = COALESCE($5, telefon),
        renk = COALESCE($6, renk),
        aktif = COALESCE($7, aktif),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `,
      [kod, ad, adres, yetkili, telefon, renk, aktif, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje sil
router.delete('/projeler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE projeler SET aktif = false WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SİPARİŞLER ====================

// Tüm siparişleri getir (projeler ve tedarikçiler ile)
router.get('/siparisler', async (req, res) => {
  try {
    const { proje_id, tedarikci_id, durum, baslangic, bitis } = req.query;
    const firmaId = getFirmaId(req);

    let query = `
      SELECT
        s.*,
        p.kod as proje_kod,
        p.ad as proje_ad,
        p.renk as proje_renk,
        c.unvan as tedarikci_unvan,
        c.vergi_no as tedarikci_vkn,
        (SELECT COUNT(*) FROM siparis_kalemleri WHERE siparis_id = s.id) as kalem_sayisi
      FROM siparisler s
      LEFT JOIN projeler p ON s.proje_id = p.id
      LEFT JOIN cariler c ON s.tedarikci_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Firma filtresi
    if (firmaId) {
      paramCount++;
      query += ` AND (s.proje_id IS NULL OR p.firma_id = $${paramCount})`;
      params.push(firmaId);
    }

    if (proje_id) {
      paramCount++;
      query += ` AND s.proje_id = $${paramCount}`;
      params.push(proje_id);
    }

    if (tedarikci_id) {
      paramCount++;
      query += ` AND s.tedarikci_id = $${paramCount}`;
      params.push(tedarikci_id);
    }

    if (durum) {
      paramCount++;
      query += ` AND s.durum = $${paramCount}`;
      params.push(durum);
    }

    if (baslangic) {
      paramCount++;
      query += ` AND s.siparis_tarihi >= $${paramCount}`;
      params.push(baslangic);
    }

    if (bitis) {
      paramCount++;
      query += ` AND s.siparis_tarihi <= $${paramCount}`;
      params.push(bitis);
    }

    query += ' ORDER BY s.siparis_tarihi DESC, s.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek sipariş detayı (kalemlerle birlikte)
router.get('/siparisler/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const siparisResult = await pool.query(
      `
      SELECT 
        s.*,
        p.kod as proje_kod,
        p.ad as proje_ad,
        p.renk as proje_renk,
        c.unvan as tedarikci_unvan,
        c.vergi_no as tedarikci_vkn
      FROM siparisler s
      LEFT JOIN projeler p ON s.proje_id = p.id
      LEFT JOIN cariler c ON s.tedarikci_id = c.id
      WHERE s.id = $1
    `,
      [id]
    );

    if (siparisResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sipariş bulunamadı' });
    }

    const kalemlerResult = await pool.query(
      `
      SELECT * FROM siparis_kalemleri WHERE siparis_id = $1 ORDER BY id
    `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...siparisResult.rows[0],
        kalemler: kalemlerResult.rows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni sipariş oluştur
router.post('/siparisler', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { proje_id, tedarikci_id, baslik, siparis_tarihi, teslim_tarihi, oncelik, notlar, kalemler } = req.body;

    // Sipariş numarası oluştur
    const yil = new Date().getFullYear();
    const countResult = await client.query(
      `
      SELECT COUNT(*) FROM siparisler WHERE EXTRACT(YEAR FROM created_at) = $1
    `,
      [yil]
    );
    const siparisNo = `SA-${yil}-${String(parseInt(countResult.rows[0].count, 10) + 1).padStart(3, '0')}`;

    // Toplam tutarı hesapla
    const toplamTutar = (kalemler || []).reduce((acc, k) => acc + (parseFloat(k.tahmini_fiyat) || 0), 0);

    // Siparişi ekle
    const siparisResult = await client.query(
      `
      INSERT INTO siparisler (siparis_no, proje_id, tedarikci_id, baslik, siparis_tarihi, teslim_tarihi, oncelik, toplam_tutar, notlar)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        siparisNo,
        proje_id,
        tedarikci_id,
        baslik,
        siparis_tarihi,
        teslim_tarihi,
        oncelik || 'normal',
        toplamTutar,
        notlar,
      ]
    );

    const siparisId = siparisResult.rows[0].id;

    // Kalemleri ekle
    if (kalemler && kalemler.length > 0) {
      for (const kalem of kalemler) {
        await client.query(
          `
          INSERT INTO siparis_kalemleri (siparis_id, urun_adi, miktar, birim, tahmini_fiyat)
          VALUES ($1, $2, $3, $4, $5)
        `,
          [siparisId, kalem.urun_adi, kalem.miktar, kalem.birim, kalem.tahmini_fiyat || 0]
        );
      }
    }

    await client.query('COMMIT');

    // Tam veriyi döndür
    const fullResult = await pool.query(
      `
      SELECT 
        s.*,
        p.kod as proje_kod,
        p.ad as proje_ad,
        p.renk as proje_renk,
        c.unvan as tedarikci_unvan
      FROM siparisler s
      LEFT JOIN projeler p ON s.proje_id = p.id
      LEFT JOIN cariler c ON s.tedarikci_id = c.id
      WHERE s.id = $1
    `,
      [siparisId]
    );

    res.json({ success: true, data: fullResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Sipariş güncelle
router.put('/siparisler/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { proje_id, tedarikci_id, baslik, siparis_tarihi, teslim_tarihi, durum, oncelik, notlar, kalemler } =
      req.body;

    // Toplam tutarı hesapla
    const toplamTutar = kalemler ? kalemler.reduce((acc, k) => acc + (parseFloat(k.tahmini_fiyat) || 0), 0) : undefined;

    // Siparişi güncelle
    await client.query(
      `
      UPDATE siparisler SET 
        proje_id = COALESCE($1, proje_id),
        tedarikci_id = COALESCE($2, tedarikci_id),
        baslik = COALESCE($3, baslik),
        siparis_tarihi = COALESCE($4, siparis_tarihi),
        teslim_tarihi = COALESCE($5, teslim_tarihi),
        durum = COALESCE($6, durum),
        oncelik = COALESCE($7, oncelik),
        toplam_tutar = COALESCE($8, toplam_tutar),
        notlar = COALESCE($9, notlar),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
    `,
      [proje_id, tedarikci_id, baslik, siparis_tarihi, teslim_tarihi, durum, oncelik, toplamTutar, notlar, id]
    );

    // Kalemleri güncelle (varsa)
    if (kalemler) {
      // Eski kalemleri sil
      await client.query('DELETE FROM siparis_kalemleri WHERE siparis_id = $1', [id]);

      // Yeni kalemleri ekle
      for (const kalem of kalemler) {
        await client.query(
          `
          INSERT INTO siparis_kalemleri (siparis_id, urun_adi, miktar, birim, tahmini_fiyat, gercek_fiyat)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
          [id, kalem.urun_adi, kalem.miktar, kalem.birim, kalem.tahmini_fiyat || 0, kalem.gercek_fiyat || 0]
        );
      }
    }

    await client.query('COMMIT');

    // Güncel veriyi döndür
    const result = await pool.query(
      `
      SELECT 
        s.*,
        p.kod as proje_kod,
        p.ad as proje_ad,
        p.renk as proje_renk,
        c.unvan as tedarikci_unvan
      FROM siparisler s
      LEFT JOIN projeler p ON s.proje_id = p.id
      LEFT JOIN cariler c ON s.tedarikci_id = c.id
      WHERE s.id = $1
    `,
      [id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Sipariş durumu güncelle
router.put('/siparisler/:id/durum', async (req, res) => {
  try {
    const { id } = req.params;
    const { durum } = req.body;

    const result = await pool.query(
      `
      UPDATE siparisler SET durum = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `,
      [durum, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sipariş sil
router.delete('/siparisler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM siparisler WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RAPORLAR ====================

// Özet istatistikler
router.get('/ozet', async (req, res) => {
  try {
    const firmaId = getFirmaId(req);
    let firmaJoin = '';
    let firmaClause = '';
    const params = [];
    if (firmaId) {
      firmaJoin = ' LEFT JOIN projeler p ON s.proje_id = p.id';
      firmaClause = ' AND (s.proje_id IS NULL OR p.firma_id = $1)';
      params.push(firmaId);
    }
    const result = await pool.query(
      `
      SELECT
        COUNT(*) as toplam_siparis,
        COUNT(*) FILTER (WHERE s.durum IN ('talep', 'onay_bekliyor', 'onaylandi', 'siparis_verildi')) as bekleyen,
        COUNT(*) FILTER (WHERE s.durum = 'teslim_alindi') as tamamlanan,
        COALESCE(SUM(s.toplam_tutar) FILTER (WHERE s.durum = 'siparis_verildi'), 0) as beklenen_tutar,
        COALESCE(SUM(s.toplam_tutar) FILTER (WHERE s.durum = 'teslim_alindi' AND EXTRACT(MONTH FROM s.siparis_tarihi) = EXTRACT(MONTH FROM CURRENT_DATE)), 0) as bu_ay_harcama
      FROM siparisler s${firmaJoin}
      WHERE 1=1${firmaClause}
    `,
      params
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje bazlı harcamalar
router.get('/raporlar/proje-bazli', async (req, res) => {
  try {
    const { baslangic, bitis } = req.query;
    const firmaId = getFirmaId(req);

    let sql = `
      SELECT
        p.id,
        p.kod,
        p.ad,
        p.renk,
        COUNT(s.id) as siparis_sayisi,
        COALESCE(SUM(s.toplam_tutar), 0) as toplam_harcama
      FROM projeler p
      LEFT JOIN siparisler s ON p.id = s.proje_id AND s.durum = 'teslim_alindi'
    `;

    const params = [];
    let paramCount = 0;
    const conditions = [];

    if (firmaId) {
      paramCount++;
      conditions.push(`p.firma_id = $${paramCount}`);
      params.push(firmaId);
    }

    if (baslangic && bitis) {
      paramCount++;
      const p1 = paramCount;
      paramCount++;
      const p2 = paramCount;
      conditions.push(`s.siparis_tarihi BETWEEN $${p1} AND $${p2}`);
      params.push(baslangic, bitis);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` GROUP BY p.id ORDER BY toplam_harcama DESC`;

    const result = await pool.query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tedarikçi bazlı alımlar
router.get('/raporlar/tedarikci-bazli', async (req, res) => {
  try {
    const { baslangic, bitis } = req.query;
    const firmaId = getFirmaId(req);

    let sql = `
      SELECT
        c.id,
        c.unvan,
        COUNT(s.id) as siparis_sayisi,
        COALESCE(SUM(s.toplam_tutar), 0) as toplam_tutar
      FROM cariler c
      INNER JOIN siparisler s ON c.id = s.tedarikci_id
    `;

    const params = [];
    let paramCount = 0;
    const conditions = ["c.tip = 'tedarikci'"];

    if (firmaId) {
      paramCount++;
      sql += ` LEFT JOIN projeler p ON s.proje_id = p.id`;
      conditions.push(`(s.proje_id IS NULL OR p.firma_id = $${paramCount})`);
      params.push(firmaId);
    }

    sql += ` WHERE ${conditions.join(' AND ')}`;

    if (baslangic && bitis) {
      paramCount++;
      sql += ` AND s.siparis_tarihi >= $${paramCount}`;
      params.push(baslangic);
      paramCount++;
      sql += ` AND s.siparis_tarihi <= $${paramCount}`;
      params.push(bitis);
    }

    sql += ` GROUP BY c.id ORDER BY toplam_tutar DESC`;

    const result = await pool.query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
