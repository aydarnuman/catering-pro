import express from 'express';
import { query } from '../../database.js';
import { optimizeSingleProduct } from '../../services/arama-terimi-optimizer.js';
import { validateFiyatMantik, validateUrunBirim } from '../../utils/birim-validator.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// =====================================================
// ÜRÜN KARTLARI API
// =====================================================

// Ürün kategorilerini listele
router.get('/urun-kategorileri', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        uk.*,
        COUNT(u.id) as urun_sayisi
      FROM urun_kategorileri uk
      LEFT JOIN urun_kartlari u ON u.kategori_id = uk.id AND u.aktif = true
      WHERE uk.aktif = true
      GROUP BY uk.id
      ORDER BY uk.sira, uk.ad
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün kartlarını listele (fiyatlarıyla birlikte)
router.get('/urun-kartlari', async (req, res) => {
  try {
    const { kategori_id, arama, aktif = 'true' } = req.query;

    let sql = `
      SELECT
        uk.id, uk.ad, uk.kod, uk.kategori_id,
        uk.varsayilan_birim, uk.fiyat_birimi, uk.ikon,
        uk.aktif_fiyat, uk.aktif_fiyat_tipi,
        uk.son_alis_fiyati, uk.manuel_fiyat,
        uk.son_fiyat_guncelleme, uk.aktif,
        uk.ana_urun_id,
        COALESCE(
          NULLIF(uk.aktif_fiyat, 0),
          (SELECT NULLIF(ufo.birim_fiyat_ekonomik, 0) FROM urun_fiyat_ozet ufo WHERE ufo.urun_kart_id = uk.id),
          NULLIF(uk.son_alis_fiyati, 0),
          NULLIF(uk.manuel_fiyat, 0),
          get_en_iyi_varyant_fiyat(uk.id)
        ) as guncel_fiyat,
        kat.ad as kategori_adi,
        kat.ikon as kategori_ikon,
        (SELECT COUNT(*) FROM recete_malzemeler rm WHERE rm.urun_kart_id = uk.id) as recete_sayisi,
        COALESCE(
          (SELECT ufo.birim_fiyat_ekonomik FROM urun_fiyat_ozet ufo WHERE ufo.urun_kart_id = uk.id),
          (SELECT pfg.piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi pfg
           WHERE pfg.urun_kart_id = uk.id
           ORDER BY pfg.arastirma_tarihi DESC NULLS LAST LIMIT 1)
        ) as piyasa_fiyati,
        COALESCE(
          (SELECT ufo.son_guncelleme FROM urun_fiyat_ozet ufo WHERE ufo.urun_kart_id = uk.id),
          (SELECT pfg.arastirma_tarihi FROM piyasa_fiyat_gecmisi pfg
           WHERE pfg.urun_kart_id = uk.id
           ORDER BY pfg.arastirma_tarihi DESC NULLS LAST LIMIT 1)
        ) as piyasa_fiyat_tarihi,
        -- Varyant bilgileri
        (SELECT COUNT(*) FROM urun_kartlari v WHERE v.ana_urun_id = uk.id AND v.aktif = TRUE) as varyant_sayisi,
        (SELECT vo.en_ucuz_fiyat FROM get_varyant_fiyat_ozet(uk.id) vo) as varyant_en_ucuz,
        (SELECT vo.en_ucuz_varyant_adi FROM get_varyant_fiyat_ozet(uk.id) vo) as varyant_en_ucuz_adi
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE 1=1
    `;

    const params = [];

    if (aktif === 'true') {
      sql += ' AND uk.aktif = true';
    }

    if (kategori_id) {
      params.push(kategori_id);
      sql += ` AND uk.kategori_id = $${params.length}`;
    }

    if (arama) {
      params.push(`%${arama}%`);
      sql += ` AND (uk.ad ILIKE $${params.length} OR uk.kod ILIKE $${params.length})`;
    }

    sql += ' ORDER BY kat.id NULLS LAST, uk.ad';

    const result = await query(sql, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Ürün kartları listeleme hatası:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek ürün kartı detayı
router.get('/urun-kartlari/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        uk.*,
        kat.ad as kategori_adi,
        kat.ikon as kategori_ikon,
        uk.ad as stok_kart_adi,
        uk.son_alis_fiyati as stok_fiyat,
        b.kisa_ad as stok_birim,
        COALESCE(
          NULLIF(uk.aktif_fiyat, 0),
          (SELECT NULLIF(ufo.birim_fiyat_ekonomik, 0) FROM urun_fiyat_ozet ufo WHERE ufo.urun_kart_id = uk.id),
          NULLIF(uk.son_alis_fiyati, 0),
          NULLIF(uk.manuel_fiyat, 0)
        ) as guncel_fiyat,
        -- Piyasa özet bilgileri
        ufo2.birim_fiyat_ekonomik as piyasa_ekonomik_fiyat,
        ufo2.birim_fiyat_min as piyasa_min,
        ufo2.birim_fiyat_max as piyasa_max,
        ufo2.birim_fiyat_medyan as piyasa_medyan,
        ufo2.birim_tipi as piyasa_birim_tipi,
        ufo2.confidence as piyasa_confidence,
        ufo2.kaynak_sayisi as piyasa_kaynak_sayisi,
        ufo2.kaynak_tip as piyasa_kaynak_tip,
        ufo2.varyant_fiyat_dahil as piyasa_varyant_dahil,
        ufo2.son_guncelleme as piyasa_son_guncelleme
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      LEFT JOIN urun_fiyat_ozet ufo2 ON ufo2.urun_kart_id = uk.id
      WHERE uk.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün kartı bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni ürün kartı oluştur
router.post('/urun-kartlari', async (req, res) => {
  try {
    const {
      ad,
      kategori_id,
      varsayilan_birim = 'gr',
      stok_kart_id,
      manuel_fiyat,
      fiyat_birimi = 'kg',
      ikon,
    } = req.body;

    if (!ad) {
      return res.status(400).json({ success: false, error: 'Ürün adı zorunludur' });
    }

    // Birim doğrulama (gr→kg, ml→lt otomatik normalize)
    const birimCheck = validateUrunBirim(fiyat_birimi);
    if (!birimCheck.valid) {
      return res.status(400).json({ success: false, error: birimCheck.error });
    }

    // Fiyat mantık kontrolü
    if (manuel_fiyat) {
      const fiyatCheck = validateFiyatMantik(manuel_fiyat, birimCheck.birim);
      if (!fiyatCheck.valid) {
        return res.status(400).json({ success: false, error: fiyatCheck.error });
      }
    }

    // Aynı isimde aktif ürün var mı kontrol et
    const existing = await query('SELECT id FROM urun_kartlari WHERE LOWER(ad) = LOWER($1) AND aktif = true', [ad]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Bu isimde bir ürün kartı zaten mevcut' });
    }

    const result = await query(
      `
      INSERT INTO urun_kartlari (ad, kategori_id, varsayilan_birim, birim, stok_kart_id, manuel_fiyat, fiyat_birimi, ikon)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [ad, kategori_id, varsayilan_birim, birimCheck.birim, stok_kart_id, manuel_fiyat, birimCheck.birim, ikon]
    );

    const newProduct = result.rows[0];

    // Arka planda: en iyi arama terimini bul ve sabitle
    // Yanıtı bekletmemek için async fire-and-forget
    optimizeSingleProduct(newProduct.id).catch((err) => {
      logger.warn(`[UrunKart] Arama terimi optimizasyonu hatası: ${err.message}`);
    });

    res.json({ success: true, data: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün kartı güncelle
router.put('/urun-kartlari/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, kategori_id, varsayilan_birim, stok_kart_id, manuel_fiyat, fiyat_birimi, ikon, aktif } = req.body;

    // Birim doğrulama (eğer gönderildiyse)
    if (fiyat_birimi) {
      const birimCheck = validateUrunBirim(fiyat_birimi);
      if (!birimCheck.valid) {
        return res.status(400).json({ success: false, error: birimCheck.error });
      }
    }
    if (manuel_fiyat) {
      const fiyatCheck = validateFiyatMantik(manuel_fiyat, fiyat_birimi || 'kg');
      if (!fiyatCheck.valid) {
        return res.status(400).json({ success: false, error: fiyatCheck.error });
      }
    }

    // Mevcut ürünü kontrol et
    const existing = await query('SELECT * FROM urun_kartlari WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün kartı bulunamadı' });
    }

    const current = existing.rows[0];

    const result = await query(
      `
      UPDATE urun_kartlari SET
        ad = $1,
        kategori_id = $2,
        varsayilan_birim = $3,
        stok_kart_id = $4,
        manuel_fiyat = $5,
        fiyat_birimi = $6,
        ikon = $7,
        aktif = $8,
        son_guncelleme = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `,
      [
        ad ?? current.ad,
        kategori_id ?? current.kategori_id,
        varsayilan_birim ?? current.varsayilan_birim,
        stok_kart_id !== undefined ? stok_kart_id : current.stok_kart_id,
        manuel_fiyat !== undefined ? manuel_fiyat : current.manuel_fiyat,
        fiyat_birimi ?? current.fiyat_birimi,
        ikon ?? current.ikon,
        aktif !== undefined ? aktif : current.aktif,
        id,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün kartı sil (soft delete)
router.delete('/urun-kartlari/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Reçetelerde kullanılıyor mu kontrol et
    const usageCheck = await query('SELECT COUNT(*) as count FROM recete_malzemeler WHERE urun_kart_id = $1', [id]);

    if (parseInt(usageCheck.rows[0].count, 10) > 0) {
      // Soft delete - pasife çek
      await query('UPDATE urun_kartlari SET aktif = false WHERE id = $1', [id]);
      return res.json({
        success: true,
        message: 'Ürün kartı reçetelerde kullanıldığı için pasife alındı',
        soft_deleted: true,
      });
    }

    // Hiçbir yerde kullanılmıyorsa tamamen sil
    await query('DELETE FROM urun_kartlari WHERE id = $1', [id]);

    res.json({ success: true, message: 'Ürün kartı silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── VARYANT ENDPOINTLERİ ──

// Bir ürünün varyantlarını listele (fiyat ve detay bilgileriyle)
router.get('/urun-kartlari/:id/varyantlar', async (req, res) => {
  try {
    const { id } = req.params;

    // Varyant listesi
    const varyantlar = await query(
      `
      SELECT
        v.id, v.ad, v.kod, v.varyant_tipi, v.varyant_aciklama,
        v.tedarikci_urun_adi, v.birim,
        v.aktif_fiyat, v.aktif_fiyat_tipi,
        v.son_alis_fiyati, v.manuel_fiyat,
        v.son_fiyat_guncelleme, v.aktif,
        COALESCE(
          NULLIF(v.aktif_fiyat, 0),
          NULLIF(v.son_alis_fiyati, 0),
          NULLIF(v.manuel_fiyat, 0),
          (SELECT NULLIF(pfg.piyasa_fiyat_ort, 0) FROM piyasa_fiyat_gecmisi pfg
           WHERE pfg.urun_kart_id = v.id
           ORDER BY pfg.arastirma_tarihi DESC NULLS LAST LIMIT 1)
        ) as guncel_fiyat,
        CASE
          WHEN NULLIF(v.aktif_fiyat, 0) IS NOT NULL THEN COALESCE(v.aktif_fiyat_tipi, 'AKTIF')
          WHEN NULLIF(v.son_alis_fiyati, 0) IS NOT NULL THEN 'FATURA'
          WHEN NULLIF(v.manuel_fiyat, 0) IS NOT NULL THEN 'MANUEL'
          WHEN EXISTS(SELECT 1 FROM piyasa_fiyat_gecmisi pfg WHERE pfg.urun_kart_id = v.id AND pfg.piyasa_fiyat_ort > 0) THEN 'PIYASA'
          ELSE 'YOK'
        END as fiyat_kaynagi
      FROM urun_kartlari v
      WHERE v.ana_urun_id = $1 AND v.aktif = TRUE
      ORDER BY v.son_fiyat_guncelleme DESC NULLS LAST, v.ad
    `,
      [id]
    );

    // Özet bilgi
    const ozetResult = await query(`SELECT * FROM get_varyant_fiyat_ozet($1)`, [id]);
    const ozet = ozetResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        varyantlar: varyantlar.rows,
        ozet: {
          varyant_sayisi: Number(ozet.varyant_sayisi) || 0,
          fiyatli_varyant_sayisi: Number(ozet.fiyatli_varyant_sayisi) || 0,
          en_ucuz_fiyat: Number(ozet.en_ucuz_fiyat) || null,
          en_ucuz_varyant_adi: ozet.en_ucuz_varyant_adi || null,
          en_pahali_fiyat: Number(ozet.en_pahali_fiyat) || null,
          ortalama_fiyat: Number(ozet.ortalama_fiyat) || null,
        },
      },
    });
  } catch (error) {
    logger.error('Varyant listesi hatası:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün kartlarını stok kartlarıyla eşleştir (toplu)
router.post('/urun-kartlari/eslestir', async (req, res) => {
  try {
    const { eslesme_listesi } = req.body;
    // eslesme_listesi: [{ urun_kart_id: 1, stok_kart_id: 10 }, ...]

    if (!Array.isArray(eslesme_listesi)) {
      return res.status(400).json({ success: false, error: 'Eşleşme listesi array olmalı' });
    }

    let guncellenen = 0;

    for (const item of eslesme_listesi) {
      await query('UPDATE urun_kartlari SET stok_kart_id = $1, son_guncelleme = CURRENT_TIMESTAMP WHERE id = $2', [
        item.stok_kart_id,
        item.urun_kart_id,
      ]);
      guncellenen++;
    }

    res.json({
      success: true,
      message: `${guncellenen} ürün kartı stok kartıyla eşleştirildi`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok kartlarını listele (eşleştirme için)
router.get('/stok-kartlari-listesi', async (req, res) => {
  try {
    const { arama } = req.query;

    // YENİ SİSTEM: urun_kartlari
    let sql = `
      SELECT
        uk.id,
        uk.kod,
        uk.ad,
        b.kisa_ad as birim,
        uk.son_alis_fiyati as son_alis_fiyat
      FROM urun_kartlari uk
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE uk.aktif = true
    `;

    const params = [];

    if (arama) {
      params.push(`%${arama}%`);
      sql += ` AND (uk.ad ILIKE $1 OR uk.kod ILIKE $1)`;
    }

    sql += ' ORDER BY uk.ad LIMIT 100';

    const result = await query(sql, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
