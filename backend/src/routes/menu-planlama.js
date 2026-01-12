import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../database.js';
import { parseExcelMenu, parsePdfMenu, parseImageMenu } from '../services/menu-import.js';

const router = express.Router();

// Multer config for menu import
const menuUpload = multer({
  dest: 'uploads/menu-import/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya formatı'));
    }
  }
});

// =============================================
// REÇETE KATEGORİLERİ
// =============================================

// Tüm kategorileri listele
router.get('/kategoriler', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM recete_kategoriler 
      WHERE aktif = true 
      ORDER BY sira, ad
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Kategori listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni kategori ekle
router.post('/kategoriler', async (req, res) => {
  try {
    const { kod, ad, ikon } = req.body;
    
    const result = await query(`
      INSERT INTO recete_kategoriler (kod, ad, ikon, sira)
      VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sira), 0) + 1 FROM recete_kategoriler))
      RETURNING *
    `, [kod, ad, ikon || '📋']);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Kategori ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// REÇETELER
// =============================================

// Tüm reçeteleri listele
router.get('/receteler', async (req, res) => {
  try {
    const { kategori, arama, proje_id, limit = 100, offset = 0 } = req.query;
    
    let whereConditions = ['r.aktif = true'];
    let params = [];
    let paramIndex = 1;
    
    // Proje bazlı filtreleme: proje_id varsa o projenin + genel (NULL) reçeteler
    if (proje_id) {
      whereConditions.push(`(r.proje_id = $${paramIndex} OR r.proje_id IS NULL)`);
      params.push(proje_id);
      paramIndex++;
    }
    
    if (kategori) {
      whereConditions.push(`rk.kod = $${paramIndex}`);
      params.push(kategori);
      paramIndex++;
    }
    
    if (arama) {
      whereConditions.push(`(r.ad ILIKE $${paramIndex} OR r.kod ILIKE $${paramIndex})`);
      params.push(`%${arama}%`);
      paramIndex++;
    }
    
    params.push(limit, offset);
    
    const result = await query(`
      SELECT 
        r.id,
        r.kod,
        r.ad,
        r.kategori_id,
        rk.ad as kategori_adi,
        rk.ikon as kategori_ikon,
        r.porsiyon_miktar,
        r.hazirlik_suresi,
        r.pisirme_suresi,
        r.kalori,
        r.protein,
        r.karbonhidrat,
        r.yag,
        r.tahmini_maliyet,
        r.ai_olusturuldu,
        r.proje_id,
        p.ad as proje_adi,
        r.created_at,
        COUNT(rm.id) as malzeme_sayisi
      FROM receteler r
      LEFT JOIN projeler p ON p.id = r.proje_id
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      LEFT JOIN recete_malzemeler rm ON rm.recete_id = r.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY r.id, rk.ad, rk.ikon, p.ad
      ORDER BY r.ad
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);
    
    // Toplam sayı
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM receteler r
      LEFT JOIN projeler p ON p.id = r.proje_id
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE ${whereConditions.join(' AND ')}
    `, params.slice(0, -2));
    
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Reçete listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reçete detayı (malzemelerle birlikte)
router.get('/receteler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Reçete bilgisi
    const receteResult = await query(`
      SELECT 
        r.*,
        rk.ad as kategori_adi,
        rk.ikon as kategori_ikon
      FROM receteler r
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE r.id = $1
    `, [id]);
    
    if (receteResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }
    
    // Malzemeler
    const malzemeResult = await query(`
      SELECT 
        rm.*,
        sk.kod as stok_kod,
        sk.ad as stok_adi,
        sk.son_alis_fiyat as sistem_fiyat,
        b.kisa_ad as stok_birim,
        -- Piyasa fiyatı (en son araştırma)
        (
          SELECT piyasa_fiyat_ort 
          FROM piyasa_fiyat_gecmisi 
          WHERE stok_kart_id = rm.stok_kart_id 
          ORDER BY arastirma_tarihi DESC 
          LIMIT 1
        ) as piyasa_fiyat
      FROM recete_malzemeler rm
      LEFT JOIN stok_kartlari sk ON sk.id = rm.stok_kart_id
      LEFT JOIN birimler b ON b.id = sk.ana_birim_id
      WHERE rm.recete_id = $1
      ORDER BY rm.sira, rm.id
    `, [id]);
    
    res.json({
      success: true,
      data: {
        ...receteResult.rows[0],
        malzemeler: malzemeResult.rows
      }
    });
  } catch (error) {
    console.error('Reçete detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// REÇETE MALZEMELERİ
// =============================================

// Reçeteye malzeme ekle
router.post('/recete/:receteId/malzeme', async (req, res) => {
  try {
    const { receteId } = req.params;
    const { malzeme_adi, miktar, birim, stok_kart_id, zorunlu = true } = req.body;
    
    // Sıra numarası al
    const siraResult = await query(
      'SELECT COALESCE(MAX(sira), 0) + 1 as sira FROM recete_malzemeler WHERE recete_id = $1',
      [receteId]
    );
    const sira = siraResult.rows[0].sira;
    
    const result = await query(`
      INSERT INTO recete_malzemeler (recete_id, stok_kart_id, malzeme_adi, miktar, birim, zorunlu, sira)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [receteId, stok_kart_id, malzeme_adi, miktar, birim, zorunlu, sira]);
    
    // Maliyeti yeniden hesapla
    await hesaplaReceteMaliyet(receteId);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Malzeme ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Malzeme güncelle
router.put('/recete/malzeme/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { malzeme_adi, miktar, birim, stok_kart_id } = req.body;
    
    const result = await query(`
      UPDATE recete_malzemeler 
      SET malzeme_adi = $1, miktar = $2, birim = $3, stok_kart_id = $4
      WHERE id = $5
      RETURNING *
    `, [malzeme_adi, miktar, birim, stok_kart_id, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Malzeme bulunamadı' });
    }
    
    // Maliyeti yeniden hesapla
    await hesaplaReceteMaliyet(result.rows[0].recete_id);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Malzeme güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Malzeme sil
router.delete('/recete/malzeme/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Önce recete_id'yi al
    const malzemeResult = await query('SELECT recete_id FROM recete_malzemeler WHERE id = $1', [id]);
    if (malzemeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Malzeme bulunamadı' });
    }
    const receteId = malzemeResult.rows[0].recete_id;
    
    await query('DELETE FROM recete_malzemeler WHERE id = $1', [id]);
    
    // Maliyeti yeniden hesapla
    await hesaplaReceteMaliyet(receteId);
    
    res.json({ success: true, message: 'Malzeme silindi' });
  } catch (error) {
    console.error('Malzeme silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni reçete oluştur
router.post('/receteler', async (req, res) => {
  try {
    const {
      kod, ad, kategori_id, porsiyon_miktar,
      hazirlik_suresi, pisirme_suresi,
      kalori, protein, karbonhidrat, yag, lif,
      tarif, aciklama, ai_olusturuldu,
      proje_id, // Proje bazlı reçete için
      malzemeler // [{stok_kart_id, malzeme_adi, miktar, birim, zorunlu}]
    } = req.body;
    
    // Reçete oluştur
    const receteResult = await query(`
      INSERT INTO receteler (
        kod, ad, kategori_id, porsiyon_miktar,
        hazirlik_suresi, pisirme_suresi,
        kalori, protein, karbonhidrat, yag, lif,
        tarif, aciklama, ai_olusturuldu, proje_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      kod, ad, kategori_id, porsiyon_miktar || 1,
      hazirlik_suresi, pisirme_suresi,
      kalori, protein, karbonhidrat, yag, lif,
      tarif, aciklama, ai_olusturuldu || false, proje_id || null
    ]);
    
    const receteId = receteResult.rows[0].id;
    
    // Malzemeleri ekle
    if (malzemeler && malzemeler.length > 0) {
      for (let i = 0; i < malzemeler.length; i++) {
        const m = malzemeler[i];
        await query(`
          INSERT INTO recete_malzemeler (
            recete_id, stok_kart_id, malzeme_adi, miktar, birim, zorunlu, sira
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [receteId, m.stok_kart_id, m.malzeme_adi, m.miktar, m.birim, m.zorunlu ?? true, i + 1]);
      }
    }
    
    // Maliyeti hesapla
    await hesaplaReceteMaliyet(receteId);
    
    res.json({
      success: true,
      data: receteResult.rows[0],
      message: 'Reçete başarıyla oluşturuldu'
    });
  } catch (error) {
    console.error('Reçete oluşturma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reçete güncelle
router.put('/receteler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ad, kategori_id, porsiyon_miktar,
      hazirlik_suresi, pisirme_suresi,
      kalori, protein, karbonhidrat, yag, lif,
      tarif, aciklama
    } = req.body;
    
    const result = await query(`
      UPDATE receteler SET
        ad = COALESCE($1, ad),
        kategori_id = COALESCE($2, kategori_id),
        porsiyon_miktar = COALESCE($3, porsiyon_miktar),
        hazirlik_suresi = COALESCE($4, hazirlik_suresi),
        pisirme_suresi = COALESCE($5, pisirme_suresi),
        kalori = COALESCE($6, kalori),
        protein = COALESCE($7, protein),
        karbonhidrat = COALESCE($8, karbonhidrat),
        yag = COALESCE($9, yag),
        lif = COALESCE($10, lif),
        tarif = COALESCE($11, tarif),
        aciklama = COALESCE($12, aciklama),
        updated_at = NOW()
      WHERE id = $13
      RETURNING *
    `, [ad, kategori_id, porsiyon_miktar, hazirlik_suresi, pisirme_suresi,
        kalori, protein, karbonhidrat, yag, lif, tarif, aciklama, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Reçete güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reçete sil (soft delete)
router.delete('/receteler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      UPDATE receteler SET aktif = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }
    
    res.json({ success: true, message: 'Reçete silindi' });
  } catch (error) {
    console.error('Reçete silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// REÇETE MALZEMELERİ
// =============================================

// Malzeme ekle
router.post('/receteler/:id/malzemeler', async (req, res) => {
  try {
    const { id } = req.params;
    const { stok_kart_id, malzeme_adi, miktar, birim, zorunlu } = req.body;
    
    // Sıra numarasını bul
    const siraResult = await query(`
      SELECT COALESCE(MAX(sira), 0) + 1 as next_sira 
      FROM recete_malzemeler 
      WHERE recete_id = $1
    `, [id]);
    
    const result = await query(`
      INSERT INTO recete_malzemeler (
        recete_id, stok_kart_id, malzeme_adi, miktar, birim, zorunlu, sira
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [id, stok_kart_id, malzeme_adi, miktar, birim, zorunlu ?? true, siraResult.rows[0].next_sira]);
    
    // Maliyeti yeniden hesapla
    await hesaplaReceteMaliyet(id);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Malzeme ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Malzeme güncelle
router.put('/malzemeler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { stok_kart_id, malzeme_adi, miktar, birim, zorunlu } = req.body;
    
    const result = await query(`
      UPDATE recete_malzemeler SET
        stok_kart_id = COALESCE($1, stok_kart_id),
        malzeme_adi = COALESCE($2, malzeme_adi),
        miktar = COALESCE($3, miktar),
        birim = COALESCE($4, birim),
        zorunlu = COALESCE($5, zorunlu),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [stok_kart_id, malzeme_adi, miktar, birim, zorunlu, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Malzeme bulunamadı' });
    }
    
    // Maliyeti yeniden hesapla
    await hesaplaReceteMaliyet(result.rows[0].recete_id);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Malzeme güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Malzeme sil
router.delete('/malzemeler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Önce recete_id'yi al
    const malzeme = await query('SELECT recete_id FROM recete_malzemeler WHERE id = $1', [id]);
    
    if (malzeme.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Malzeme bulunamadı' });
    }
    
    const receteId = malzeme.rows[0].recete_id;
    
    await query('DELETE FROM recete_malzemeler WHERE id = $1', [id]);
    
    // Maliyeti yeniden hesapla
    await hesaplaReceteMaliyet(receteId);
    
    res.json({ success: true, message: 'Malzeme silindi' });
  } catch (error) {
    console.error('Malzeme silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// MALİYET HESAPLAMA
// =============================================

// Reçete maliyetini hesapla
async function hesaplaReceteMaliyet(receteId) {
  try {
    // Malzemeleri al
    const malzemeler = await query(`
      SELECT 
        rm.*,
        sk.son_alis_fiyat as sistem_fiyat,
        (
          SELECT piyasa_fiyat_ort 
          FROM piyasa_fiyat_gecmisi 
          WHERE stok_kart_id = rm.stok_kart_id 
          ORDER BY arastirma_tarihi DESC 
          LIMIT 1
        ) as piyasa_fiyat
      FROM recete_malzemeler rm
      LEFT JOIN stok_kartlari sk ON sk.id = rm.stok_kart_id
      WHERE rm.recete_id = $1
    `, [receteId]);
    
    let toplamMaliyet = 0;
    
    for (const m of malzemeler.rows) {
      // Fiyat önceliği: piyasa > sistem > 0
      const birimFiyat = m.piyasa_fiyat || m.sistem_fiyat || 0;
      
      // Birim dönüşümü (g → kg, ml → L)
      let maliyet = 0;
      const birim = (m.birim || '').toLowerCase();
      
      if (birim === 'g' || birim === 'gr') {
        maliyet = (m.miktar / 1000) * birimFiyat; // kg fiyatı
      } else if (birim === 'ml') {
        maliyet = (m.miktar / 1000) * birimFiyat; // L fiyatı
      } else {
        maliyet = m.miktar * birimFiyat;
      }
      
      // Malzeme fiyatını güncelle
      await query(`
        UPDATE recete_malzemeler SET
          birim_fiyat = $1,
          toplam_fiyat = $2,
          fiyat_kaynagi = $3
        WHERE id = $4
      `, [birimFiyat, maliyet, m.piyasa_fiyat ? 'piyasa' : (m.sistem_fiyat ? 'sistem' : 'manuel'), m.id]);
      
      toplamMaliyet += maliyet;
    }
    
    // Reçete maliyetini güncelle
    await query(`
      UPDATE receteler SET
        tahmini_maliyet = $1,
        son_hesaplama_tarihi = NOW()
      WHERE id = $2
    `, [Math.round(toplamMaliyet * 100) / 100, receteId]);
    
    return toplamMaliyet;
  } catch (error) {
    console.error('Maliyet hesaplama hatası:', error);
    return 0;
  }
}

// Manuel maliyet hesaplama endpoint'i
router.post('/receteler/:id/maliyet-hesapla', async (req, res) => {
  try {
    const { id } = req.params;
    const maliyet = await hesaplaReceteMaliyet(id);
    
    res.json({
      success: true,
      maliyet: Math.round(maliyet * 100) / 100,
      message: 'Maliyet hesaplandı'
    });
  } catch (error) {
    console.error('Maliyet hesaplama hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// PROJE ÖĞÜN ŞABLONLARI
// =============================================

// Öğün tiplerini listele
router.get('/ogun-tipleri', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM ogun_tipleri 
      WHERE aktif = true 
      ORDER BY varsayilan_sira
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje öğün şablonlarını getir
router.get('/projeler/:projeId/ogun-sablonlari', async (req, res) => {
  try {
    const { projeId } = req.params;
    
    const result = await query(`
      SELECT 
        pos.*,
        ot.ad as ogun_tip_adi,
        ot.ikon as ogun_ikon
      FROM proje_ogun_sablonlari pos
      JOIN ogun_tipleri ot ON ot.id = pos.ogun_tipi_id
      WHERE pos.proje_id = $1 AND pos.aktif = true
      ORDER BY pos.sira, ot.varsayilan_sira
    `, [projeId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje öğün şablonu ekle/güncelle
router.post('/projeler/:projeId/ogun-sablonlari', async (req, res) => {
  try {
    const { projeId } = req.params;
    const { ogun_tipi_id, cesit_sayisi, kisi_sayisi, tip, ogun_adi } = req.body;
    
    const result = await query(`
      INSERT INTO proje_ogun_sablonlari (
        proje_id, ogun_tipi_id, cesit_sayisi, kisi_sayisi, tip, ogun_adi, sira
      ) VALUES ($1, $2, $3, $4, $5, $6, 
        (SELECT COALESCE(MAX(sira), 0) + 1 FROM proje_ogun_sablonlari WHERE proje_id = $1)
      )
      ON CONFLICT (proje_id, ogun_tipi_id) 
      DO UPDATE SET
        cesit_sayisi = EXCLUDED.cesit_sayisi,
        kisi_sayisi = EXCLUDED.kisi_sayisi,
        tip = EXCLUDED.tip,
        ogun_adi = EXCLUDED.ogun_adi,
        updated_at = NOW()
      RETURNING *
    `, [projeId, ogun_tipi_id, cesit_sayisi || 4, kisi_sayisi || 1000, tip || 'tabldot', ogun_adi]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// MENÜ PLANLARI
// =============================================

// Proje menü planlarını listele
router.get('/projeler/:projeId/menu-planlari', async (req, res) => {
  try {
    const { projeId } = req.params;
    
    const result = await query(`
      SELECT * FROM v_menu_plan_ozet
      WHERE proje_id = $1
      ORDER BY baslangic_tarihi DESC
    `, [projeId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Menü planı detayı
router.get('/menu-planlari/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Plan bilgisi
    const planResult = await query(`
      SELECT mp.*, p.ad as proje_adi
      FROM menu_planlari mp
      JOIN projeler p ON p.id = mp.proje_id
      WHERE mp.id = $1
    `, [id]);
    
    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan bulunamadı' });
    }
    
    // Öğünler ve yemekler
    const ogunlerResult = await query(`
      SELECT 
        mpo.*,
        ot.ad as ogun_tip_adi,
        ot.ikon as ogun_ikon,
        json_agg(
          json_build_object(
            'id', moy.id,
            'recete_id', moy.recete_id,
            'recete_ad', r.ad,
            'recete_kategori', rk.ad,
            'recete_ikon', rk.ikon,
            'sira', moy.sira,
            'porsiyon_maliyet', moy.porsiyon_maliyet,
            'toplam_maliyet', moy.toplam_maliyet
          ) ORDER BY moy.sira
        ) FILTER (WHERE moy.id IS NOT NULL) as yemekler
      FROM menu_plan_ogunleri mpo
      LEFT JOIN ogun_tipleri ot ON ot.id = mpo.ogun_tipi_id
      LEFT JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
      LEFT JOIN receteler r ON r.id = moy.recete_id
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE mpo.menu_plan_id = $1
      GROUP BY mpo.id, ot.ad, ot.ikon
      ORDER BY mpo.tarih, mpo.ogun_tipi_id
    `, [id]);
    
    res.json({
      success: true,
      data: {
        ...planResult.rows[0],
        ogunler: ogunlerResult.rows
      }
    });
  } catch (error) {
    console.error('Menü planı detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni menü planı oluştur
router.post('/menu-planlari', async (req, res) => {
  try {
    const {
      proje_id, ad, tip, baslangic_tarihi, bitis_tarihi,
      varsayilan_kisi_sayisi, notlar
    } = req.body;
    
    const result = await query(`
      INSERT INTO menu_planlari (
        proje_id, ad, tip, baslangic_tarihi, bitis_tarihi,
        varsayilan_kisi_sayisi, notlar, durum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'taslak')
      RETURNING *
    `, [proje_id, ad, tip || 'haftalik', baslangic_tarihi, bitis_tarihi,
        varsayilan_kisi_sayisi || 1000, notlar]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Menü planı oluşturma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Menü planına öğün ekle
router.post('/menu-planlari/:planId/ogunler', async (req, res) => {
  try {
    const { planId } = req.params;
    const { tarih, ogun_tipi_id, kisi_sayisi } = req.body;
    
    const result = await query(`
      INSERT INTO menu_plan_ogunleri (
        menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (menu_plan_id, tarih, ogun_tipi_id) DO UPDATE SET
        kisi_sayisi = EXCLUDED.kisi_sayisi,
        updated_at = NOW()
      RETURNING *
    `, [planId, tarih, ogun_tipi_id, kisi_sayisi]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğüne yemek ekle
router.post('/ogunler/:ogunId/yemekler', async (req, res) => {
  try {
    const { ogunId } = req.params;
    const { recete_id, sira } = req.body;
    
    // Reçete maliyetini al
    const receteResult = await query(
      'SELECT tahmini_maliyet FROM receteler WHERE id = $1',
      [recete_id]
    );
    
    const porsiyonMaliyet = receteResult.rows[0]?.tahmini_maliyet || 0;
    
    // Öğün kişi sayısını al
    const ogunResult = await query(`
      SELECT mpo.kisi_sayisi, mp.varsayilan_kisi_sayisi
      FROM menu_plan_ogunleri mpo
      JOIN menu_planlari mp ON mp.id = mpo.menu_plan_id
      WHERE mpo.id = $1
    `, [ogunId]);
    
    const kisiSayisi = ogunResult.rows[0]?.kisi_sayisi || 
                       ogunResult.rows[0]?.varsayilan_kisi_sayisi || 1000;
    
    const toplamMaliyet = porsiyonMaliyet * kisiSayisi;
    
    // Yemek ekle
    const result = await query(`
      INSERT INTO menu_ogun_yemekleri (
        menu_ogun_id, recete_id, sira, porsiyon_maliyet, toplam_maliyet
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (menu_ogun_id, recete_id) DO UPDATE SET
        sira = EXCLUDED.sira,
        porsiyon_maliyet = EXCLUDED.porsiyon_maliyet,
        toplam_maliyet = EXCLUDED.toplam_maliyet
      RETURNING *
    `, [ogunId, recete_id, sira || 1, porsiyonMaliyet, toplamMaliyet]);
    
    // Öğün toplamını güncelle
    await guncelleOgunMaliyet(ogunId);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Yemek ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğün kişi sayısını güncelle
router.put('/menu-ogun/:ogunId', async (req, res) => {
  try {
    const { ogunId } = req.params;
    const { kisi_sayisi } = req.body;
    
    const result = await query(`
      UPDATE menu_plan_ogunleri 
      SET kisi_sayisi = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [kisi_sayisi, ogunId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Öğün bulunamadı' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Öğün güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğünden yemek sil
router.delete('/yemekler/:yemekId', async (req, res) => {
  try {
    const { yemekId } = req.params;
    
    // Önce öğün ID'yi al
    const yemek = await query('SELECT menu_ogun_id FROM menu_ogun_yemekleri WHERE id = $1', [yemekId]);
    
    if (yemek.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Yemek bulunamadı' });
    }
    
    const ogunId = yemek.rows[0].menu_ogun_id;
    
    await query('DELETE FROM menu_ogun_yemekleri WHERE id = $1', [yemekId]);
    
    // Öğün toplamını güncelle
    await guncelleOgunMaliyet(ogunId);
    
    res.json({ success: true, message: 'Yemek silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğün maliyetini güncelle
async function guncelleOgunMaliyet(ogunId) {
  try {
    // Yemeklerin toplam maliyeti
    const result = await query(`
      SELECT 
        COALESCE(SUM(toplam_maliyet), 0) as toplam,
        COALESCE(SUM(porsiyon_maliyet), 0) as porsiyon_toplam
      FROM menu_ogun_yemekleri
      WHERE menu_ogun_id = $1
    `, [ogunId]);
    
    const toplam = result.rows[0].toplam;
    
    // Öğün kişi sayısı
    const ogunResult = await query(`
      SELECT kisi_sayisi, 
             (SELECT varsayilan_kisi_sayisi FROM menu_planlari WHERE id = menu_plan_id) as varsayilan
      FROM menu_plan_ogunleri WHERE id = $1
    `, [ogunId]);
    
    const kisiSayisi = ogunResult.rows[0]?.kisi_sayisi || ogunResult.rows[0]?.varsayilan || 1;
    const porsiyonMaliyet = kisiSayisi > 0 ? toplam / kisiSayisi : 0;
    
    await query(`
      UPDATE menu_plan_ogunleri SET
        toplam_maliyet = $1,
        porsiyon_maliyet = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [toplam, porsiyonMaliyet, ogunId]);
    
    // Plan toplamını da güncelle
    const planId = await query('SELECT menu_plan_id FROM menu_plan_ogunleri WHERE id = $1', [ogunId]);
    if (planId.rows.length > 0) {
      await guncellePlanMaliyet(planId.rows[0].menu_plan_id);
    }
  } catch (error) {
    console.error('Öğün maliyet güncelleme hatası:', error);
  }
}

// Plan maliyetini güncelle
async function guncellePlanMaliyet(planId) {
  try {
    const result = await query(`
      SELECT 
        COALESCE(SUM(toplam_maliyet), 0) as toplam,
        COUNT(DISTINCT tarih) as gun_sayisi
      FROM menu_plan_ogunleri
      WHERE menu_plan_id = $1
    `, [planId]);
    
    const toplam = result.rows[0].toplam;
    const gunSayisi = result.rows[0].gun_sayisi || 1;
    const gunlukOrtalama = toplam / gunSayisi;
    
    // Toplam porsiyon sayısı
    const porsiyonResult = await query(`
      SELECT COALESCE(SUM(COALESCE(kisi_sayisi, mp.varsayilan_kisi_sayisi)), 0) as toplam_porsiyon
      FROM menu_plan_ogunleri mpo
      JOIN menu_planlari mp ON mp.id = mpo.menu_plan_id
      WHERE mpo.menu_plan_id = $1
    `, [planId]);
    
    const toplamPorsiyon = porsiyonResult.rows[0].toplam_porsiyon || 1;
    const porsiyonOrtalama = toplam / toplamPorsiyon;
    
    await query(`
      UPDATE menu_planlari SET
        toplam_maliyet = $1,
        gunluk_ortalama_maliyet = $2,
        porsiyon_ortalama_maliyet = $3,
        updated_at = NOW()
      WHERE id = $4
    `, [toplam, gunlukOrtalama, porsiyonOrtalama, planId]);
  } catch (error) {
    console.error('Plan maliyet güncelleme hatası:', error);
  }
}

// =============================================
// MENÜ PLAN - Query ile getir
// =============================================

// Aylık menü planını getir (proje ve tarih aralığı ile)
router.get('/menu-plan', async (req, res) => {
  try {
    const { proje_id, baslangic, bitis } = req.query;
    
    if (!proje_id || !baslangic || !bitis) {
      return res.status(400).json({ 
        success: false, 
        error: 'proje_id, baslangic ve bitis parametreleri gerekli' 
      });
    }
    
    // Önce menü planını bul veya oluştur
    let planResult = await query(`
      SELECT id FROM menu_planlari 
      WHERE proje_id = $1 
        AND baslangic_tarihi <= $2 
        AND bitis_tarihi >= $3
      LIMIT 1
    `, [proje_id, bitis, baslangic]);
    
    let planId = planResult.rows[0]?.id;
    
    // Plan yoksa oluştur
    if (!planId) {
      const createResult = await query(`
        INSERT INTO menu_planlari (
          proje_id, ad, tip, baslangic_tarihi, bitis_tarihi,
          varsayilan_kisi_sayisi, durum
        ) VALUES ($1, $2, 'aylik', $3, $4, 1000, 'taslak')
        RETURNING id
      `, [proje_id, `Menü Planı - ${baslangic}`, baslangic, bitis]);
      planId = createResult.rows[0].id;
    }
    
    // Öğünleri getir
    const ogunlerResult = await query(`
      SELECT 
        mpo.id,
        mpo.tarih,
        mpo.ogun_tipi_id,
        ot.kod as ogun_tip_kodu,
        ot.ad as ogun_tip_adi,
        ot.ikon as ogun_ikon,
        mpo.kisi_sayisi,
        mpo.toplam_maliyet,
        mpo.porsiyon_maliyet,
        json_agg(
          json_build_object(
            'id', moy.id,
            'recete_id', moy.recete_id,
            'recete_ad', r.ad,
            'recete_kategori', rk.ad,
            'recete_ikon', rk.ikon,
            'sira', moy.sira,
            'porsiyon_maliyet', moy.porsiyon_maliyet,
            'toplam_maliyet', moy.toplam_maliyet
          ) ORDER BY moy.sira
        ) FILTER (WHERE moy.id IS NOT NULL) as yemekler
      FROM menu_plan_ogunleri mpo
      JOIN ogun_tipleri ot ON ot.id = mpo.ogun_tipi_id
      LEFT JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
      LEFT JOIN receteler r ON r.id = moy.recete_id
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE mpo.menu_plan_id = $1
        AND mpo.tarih >= $2 AND mpo.tarih <= $3
      GROUP BY mpo.id, ot.kod, ot.ad, ot.ikon
      ORDER BY mpo.tarih, mpo.ogun_tipi_id
    `, [planId, baslangic, bitis]);
    
    res.json({
      success: true,
      data: {
        plan_id: planId,
        ogunler: ogunlerResult.rows
      }
    });
  } catch (error) {
    console.error('Menü planı getirme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yemek ekle (kısa yol)
router.post('/menu-plan/yemek-ekle', async (req, res) => {
  try {
    const { proje_id, tarih, ogun_tipi, recete_id, kisi_sayisi = 1000 } = req.body;
    
    if (!proje_id || !tarih || !ogun_tipi || !recete_id) {
      return res.status(400).json({
        success: false,
        error: 'proje_id, tarih, ogun_tipi ve recete_id gerekli'
      });
    }
    
    // Öğün tipi kodunu ID'ye çevir
    const ogunTipResult = await query(
      'SELECT id FROM ogun_tipleri WHERE kod = $1',
      [ogun_tipi]
    );
    
    if (ogunTipResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz öğün tipi' });
    }
    
    const ogunTipiId = ogunTipResult.rows[0].id;
    
    // Menü planını bul veya oluştur
    const ayBaslangic = tarih.substring(0, 7) + '-01';
    const ay = parseInt(tarih.substring(5, 7));
    const yil = parseInt(tarih.substring(0, 4));
    const sonGun = new Date(yil, ay, 0).getDate();
    const ayBitis = tarih.substring(0, 7) + '-' + sonGun;
    
    let planResult = await query(`
      SELECT id FROM menu_planlari 
      WHERE proje_id = $1 
        AND baslangic_tarihi <= $2 
        AND bitis_tarihi >= $2
      LIMIT 1
    `, [proje_id, tarih]);
    
    let planId = planResult.rows[0]?.id;
    
    if (!planId) {
      const createResult = await query(`
        INSERT INTO menu_planlari (
          proje_id, ad, tip, baslangic_tarihi, bitis_tarihi,
          varsayilan_kisi_sayisi, durum
        ) VALUES ($1, $2, 'aylik', $3, $4, $5, 'taslak')
        RETURNING id
      `, [proje_id, `Menü Planı - ${ayBaslangic}`, ayBaslangic, ayBitis, kisi_sayisi]);
      planId = createResult.rows[0].id;
    }
    
    // Öğünü bul veya oluştur
    let ogunResult = await query(`
      SELECT id FROM menu_plan_ogunleri 
      WHERE menu_plan_id = $1 AND tarih = $2 AND ogun_tipi_id = $3
    `, [planId, tarih, ogunTipiId]);
    
    let ogunId = ogunResult.rows[0]?.id;
    
    if (!ogunId) {
      const createOgunResult = await query(`
        INSERT INTO menu_plan_ogunleri (
          menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [planId, tarih, ogunTipiId, kisi_sayisi]);
      ogunId = createOgunResult.rows[0].id;
    }
    
    // Reçete maliyetini al
    const receteResult = await query(
      'SELECT tahmini_maliyet FROM receteler WHERE id = $1',
      [recete_id]
    );
    
    const porsiyonMaliyet = parseFloat(receteResult.rows[0]?.tahmini_maliyet) || 0;
    const toplamMaliyet = porsiyonMaliyet * kisi_sayisi;
    
    // Sıra numarasını bul
    const siraResult = await query(`
      SELECT COALESCE(MAX(sira), 0) + 1 as next_sira 
      FROM menu_ogun_yemekleri 
      WHERE menu_ogun_id = $1
    `, [ogunId]);
    
    // Yemek ekle
    const yemekResult = await query(`
      INSERT INTO menu_ogun_yemekleri (
        menu_ogun_id, recete_id, sira, porsiyon_maliyet, toplam_maliyet
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (menu_ogun_id, recete_id) DO UPDATE SET
        porsiyon_maliyet = EXCLUDED.porsiyon_maliyet,
        toplam_maliyet = EXCLUDED.toplam_maliyet
      RETURNING *
    `, [ogunId, recete_id, siraResult.rows[0].next_sira, porsiyonMaliyet, toplamMaliyet]);
    
    // Öğün ve plan maliyetlerini güncelle
    await guncelleOgunMaliyet(ogunId);
    
    res.json({
      success: true,
      data: yemekResult.rows[0],
      message: 'Yemek menüye eklendi'
    });
  } catch (error) {
    console.error('Yemek ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// YARDIMCI ENDPOINT'LER
// =============================================

// Tarih aralığındaki günlük özetler
router.get('/menu-planlari/:planId/gunluk-ozet', async (req, res) => {
  try {
    const { planId } = req.params;
    
    const result = await query(`
      SELECT 
        mpo.tarih,
        COUNT(DISTINCT mpo.id) as ogun_sayisi,
        COUNT(moy.id) as yemek_sayisi,
        COALESCE(SUM(mpo.toplam_maliyet), 0) as gunluk_maliyet,
        COALESCE(AVG(mpo.porsiyon_maliyet), 0) as ortalama_porsiyon
      FROM menu_plan_ogunleri mpo
      LEFT JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
      WHERE mpo.menu_plan_id = $1
      GROUP BY mpo.tarih
      ORDER BY mpo.tarih
    `, [planId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şablon kopyalama (proje → proje)
router.post('/projeler/:kaynakId/sablon-kopyala/:hedefId', async (req, res) => {
  try {
    const { kaynakId, hedefId } = req.params;
    
    // Kaynak şablonları al
    const sablonlar = await query(`
      SELECT ogun_tipi_id, cesit_sayisi, kisi_sayisi, tip, ogun_adi, sira
      FROM proje_ogun_sablonlari
      WHERE proje_id = $1 AND aktif = true
    `, [kaynakId]);
    
    // Hedef projeye kopyala
    for (const s of sablonlar.rows) {
      await query(`
        INSERT INTO proje_ogun_sablonlari (
          proje_id, ogun_tipi_id, cesit_sayisi, kisi_sayisi, tip, ogun_adi, sira
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (proje_id, ogun_tipi_id) DO UPDATE SET
          cesit_sayisi = EXCLUDED.cesit_sayisi,
          kisi_sayisi = EXCLUDED.kisi_sayisi,
          tip = EXCLUDED.tip,
          ogun_adi = EXCLUDED.ogun_adi,
          sira = EXCLUDED.sira
      `, [hedefId, s.ogun_tipi_id, s.cesit_sayisi, s.kisi_sayisi, s.tip, s.ogun_adi, s.sira]);
    }
    
    res.json({ 
      success: true, 
      message: `${sablonlar.rows.length} öğün şablonu kopyalandı` 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ŞARTNAME VE GRAMAJ YÖNETİMİ
// =============================================

// Kurumları listele
router.get('/sartname/kurumlar', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM sartname_kurumlari 
      WHERE aktif = true 
      ORDER BY ad
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şartnameleri listele
router.get('/sartname/liste', async (req, res) => {
  try {
    const { kurum_id, proje_id, aktif = true } = req.query;
    
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (aktif !== 'all') {
      whereConditions.push(`ps.aktif = $${paramIndex}`);
      params.push(aktif === 'true');
      paramIndex++;
    }
    
    if (kurum_id) {
      whereConditions.push(`ps.kurum_id = $${paramIndex}`);
      params.push(kurum_id);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    const result = await query(`
      SELECT 
        ps.*,
        sk.ad as kurum_adi,
        sk.ikon as kurum_ikon,
        (SELECT COUNT(*) FROM sartname_porsiyon_gramajlari spg WHERE spg.sartname_id = ps.id AND spg.aktif = true) as gramaj_sayisi,
        (SELECT COUNT(*) FROM proje_sartname_atamalari psa WHERE psa.sartname_id = ps.id) as proje_sayisi
      FROM proje_sartnameleri ps
      LEFT JOIN sartname_kurumlari sk ON sk.id = ps.kurum_id
      ${whereClause}
      ORDER BY ps.yil DESC, ps.ad
    `, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni şartname oluştur
router.post('/sartname', async (req, res) => {
  try {
    const { kod, ad, kurum_id, yil, versiyon, kaynak_url, kaynak_aciklama, notlar } = req.body;
    
    if (!kod || !ad) {
      return res.status(400).json({ success: false, error: 'Kod ve ad zorunlu' });
    }
    
    const result = await query(`
      INSERT INTO proje_sartnameleri (kod, ad, kurum_id, yil, versiyon, kaynak_url, kaynak_aciklama, notlar)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [kod, ad, kurum_id, yil || new Date().getFullYear(), versiyon || '1.0', kaynak_url, kaynak_aciklama, notlar]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Şartname ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şartname detayı
router.get('/sartname/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const sartname = await query(`
      SELECT ps.*, sk.ad as kurum_adi, sk.ikon as kurum_ikon
      FROM proje_sartnameleri ps
      LEFT JOIN sartname_kurumlari sk ON sk.id = ps.kurum_id
      WHERE ps.id = $1
    `, [id]);
    
    if (sartname.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Şartname bulunamadı' });
    }
    
    // Porsiyon gramajlarını al
    const gramajlar = await query(`
      SELECT 
        spg.*,
        rk.ad as kategori_adi,
        rk.ikon as kategori_ikon
      FROM sartname_porsiyon_gramajlari spg
      LEFT JOIN recete_kategoriler rk ON rk.id = spg.kategori_id
      WHERE spg.sartname_id = $1 AND spg.aktif = true
      ORDER BY spg.sira, spg.yemek_turu
    `, [id]);
    
    // Öğün yapılarını al (aktif/pasif hepsini getir)
    const ogunYapilari = await query(`
      SELECT * FROM sartname_ogun_yapisi
      WHERE sartname_id = $1
      ORDER BY CASE ogun_tipi WHEN 'kahvalti' THEN 1 WHEN 'ogle' THEN 2 WHEN 'aksam' THEN 3 END
    `, [id]);
    
    // Atanan projeleri al
    const projeler = await query(`
      SELECT 
        p.id, p.ad, p.kod,
        psa.varsayilan, psa.baslangic_tarihi, psa.bitis_tarihi
      FROM proje_sartname_atamalari psa
      JOIN projeler p ON p.id = psa.proje_id
      WHERE psa.sartname_id = $1
    `, [id]);
    
    res.json({ 
      success: true, 
      data: {
        ...sartname.rows[0],
        gramajlar: gramajlar.rows,
        ogun_yapilari: ogunYapilari.rows,
        projeler: projeler.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şartname güncelle
router.put('/sartname/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, kurum_id, yil, versiyon, kaynak_url, kaynak_aciklama, notlar, aktif } = req.body;
    
    const result = await query(`
      UPDATE proje_sartnameleri
      SET ad = COALESCE($1, ad),
          kurum_id = COALESCE($2, kurum_id),
          yil = COALESCE($3, yil),
          versiyon = COALESCE($4, versiyon),
          kaynak_url = COALESCE($5, kaynak_url),
          kaynak_aciklama = COALESCE($6, kaynak_aciklama),
          notlar = COALESCE($7, notlar),
          aktif = COALESCE($8, aktif),
          updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [ad, kurum_id, yil, versiyon, kaynak_url, kaynak_aciklama, notlar, aktif, id]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şartname projeye ata
router.post('/sartname/:sartnameId/proje-ata', async (req, res) => {
  try {
    const { sartnameId } = req.params;
    const { proje_id, varsayilan } = req.body;
    
    // Varsayilan atama yapılıyorsa, diğerlerini varsayilan olmaktan çıkar
    if (varsayilan) {
      await query(`
        UPDATE proje_sartname_atamalari
        SET varsayilan = false
        WHERE proje_id = $1 AND sartname_id != $2
      `, [proje_id, sartnameId]);
    }
    
    const result = await query(`
      INSERT INTO proje_sartname_atamalari (proje_id, sartname_id, varsayilan)
      VALUES ($1, $2, $3)
      ON CONFLICT (proje_id, sartname_id) DO UPDATE SET
        varsayilan = EXCLUDED.varsayilan
      RETURNING *
    `, [proje_id, sartnameId, varsayilan || false]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje için şartnameleri getir
router.get('/proje/:projeId/sartnameler', async (req, res) => {
  try {
    const { projeId } = req.params;
    
    const result = await query(`
      SELECT 
        ps.*,
        sk.ad as kurum_adi,
        sk.ikon as kurum_ikon,
        psa.varsayilan,
        (SELECT COUNT(*) FROM sartname_porsiyon_gramajlari spg WHERE spg.sartname_id = ps.id AND spg.aktif = true) as gramaj_sayisi
      FROM proje_sartname_atamalari psa
      JOIN proje_sartnameleri ps ON ps.id = psa.sartname_id
      LEFT JOIN sartname_kurumlari sk ON sk.id = ps.kurum_id
      WHERE psa.proje_id = $1 AND ps.aktif = true
      ORDER BY psa.varsayilan DESC, ps.ad
    `, [projeId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// GRAMAJ YÖNETİMİ (BASİTLEŞTİRİLMİŞ)
// Yemek kategorisi bazında porsiyon gramajları
// =============================================

// Porsiyon gramajı ekle
router.post('/sartname/:sartnameId/gramaj', async (req, res) => {
  try {
    const { sartnameId } = req.params;
    const { kategori_id, yemek_turu, porsiyon_gramaj, birim, aciklama, sira } = req.body;
    
    if (!yemek_turu || !porsiyon_gramaj) {
      return res.status(400).json({ success: false, error: 'Yemek türü ve porsiyon gramajı zorunlu' });
    }
    
    const result = await query(`
      INSERT INTO sartname_porsiyon_gramajlari (
        sartname_id, kategori_id, yemek_turu, porsiyon_gramaj, birim, aciklama, sira
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [sartnameId, kategori_id, yemek_turu, porsiyon_gramaj, birim || 'g', aciklama, sira || 0]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Porsiyon gramajı güncelle
router.put('/sartname/gramaj/:gramajId', async (req, res) => {
  try {
    const { gramajId } = req.params;
    const { kategori_id, yemek_turu, porsiyon_gramaj, birim, aciklama, sira, aktif } = req.body;
    
    const result = await query(`
      UPDATE sartname_porsiyon_gramajlari
      SET 
        kategori_id = COALESCE($1, kategori_id),
        yemek_turu = COALESCE($2, yemek_turu),
        porsiyon_gramaj = COALESCE($3, porsiyon_gramaj),
        birim = COALESCE($4, birim),
        aciklama = COALESCE($5, aciklama),
        sira = COALESCE($6, sira),
        aktif = COALESCE($7, aktif)
      WHERE id = $8
      RETURNING *
    `, [kategori_id, yemek_turu, porsiyon_gramaj, birim, aciklama, sira, aktif, gramajId]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gramaj sil (soft delete)
router.delete('/sartname/gramaj/:gramajId', async (req, res) => {
  try {
    const { gramajId } = req.params;
    
    await query(`
      UPDATE sartname_porsiyon_gramajlari SET aktif = false WHERE id = $1
    `, [gramajId]);
    
    res.json({ success: true, message: 'Gramaj silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğün yapısı ekle
router.post('/sartname/:sartnameId/ogun-yapisi', async (req, res) => {
  try {
    const { sartnameId } = req.params;
    const { ogun_tipi, min_cesit, max_cesit, zorunlu_kategoriler, aciklama } = req.body;
    
    const result = await query(`
      INSERT INTO sartname_ogun_yapisi (
        sartname_id, ogun_tipi, min_cesit, max_cesit, zorunlu_kategoriler, aciklama
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [sartnameId, ogun_tipi, min_cesit, max_cesit, zorunlu_kategoriler, aciklama]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğün yapısı güncelle
router.put('/ogun-yapisi/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { aktif, min_cesit, max_cesit, zorunlu_kategoriler, aciklama } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (aktif !== undefined) {
      updates.push(`aktif = $${paramCount++}`);
      values.push(aktif);
    }
    if (min_cesit !== undefined) {
      updates.push(`min_cesit = $${paramCount++}`);
      values.push(min_cesit);
    }
    if (max_cesit !== undefined) {
      updates.push(`max_cesit = $${paramCount++}`);
      values.push(max_cesit);
    }
    if (zorunlu_kategoriler !== undefined) {
      updates.push(`zorunlu_kategoriler = $${paramCount++}`);
      values.push(zorunlu_kategoriler);
    }
    if (aciklama !== undefined) {
      updates.push(`aciklama = $${paramCount++}`);
      values.push(aciklama);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Güncellenecek alan yok' });
    }
    
    values.push(id);
    const result = await query(`
      UPDATE sartname_ogun_yapisi 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Öğün yapısı bulunamadı' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Öğün yapısı güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// GRAMAJ KONTROL FONKSİYONLARI
// =============================================

// Reçete gramaj kontrolü
router.get('/recete/:receteId/gramaj-kontrol', async (req, res) => {
  try {
    const { receteId } = req.params;
    const { sartname_id, proje_id } = req.query;
    
    // Reçete ve malzemelerini al
    const recete = await query(`
      SELECT r.*, rk.ad as kategori_adi
      FROM receteler r
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE r.id = $1
    `, [receteId]);
    
    if (recete.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }
    
    const malzemeler = await query(`
      SELECT rm.*, sk.ad as stok_adi
      FROM recete_malzemeler rm
      LEFT JOIN stok_kartlari sk ON sk.id = rm.stok_kart_id
      WHERE rm.recete_id = $1
    `, [receteId]);
    
    // Şartname ID bul
    let sartnameIdToUse = sartname_id;
    
    if (!sartnameIdToUse && proje_id) {
      const sartname = await query(`
        SELECT sartname_id FROM proje_sartname_atamalari
        WHERE proje_id = $1 AND varsayilan = true
        LIMIT 1
      `, [proje_id]);
      sartnameIdToUse = sartname.rows[0]?.sartname_id;
    }
    
    if (!sartnameIdToUse) {
      return res.json({ 
        success: true, 
        data: { 
          recete: recete.rows[0],
          malzemeler: malzemeler.rows,
          gramaj_kontrol: null,
          mesaj: 'Şartname belirtilmedi'
        }
      });
    }
    
    // Şartname gramajlarını al
    const gramajlar = await query(`
      SELECT * FROM sartname_gramajlari
      WHERE sartname_id = $1 AND aktif = true
        AND (yemek_turu ILIKE $2 OR yemek_adi ILIKE $2 OR kategori_id = $3)
    `, [sartnameIdToUse, `%${recete.rows[0].ad}%`, recete.rows[0].kategori_id]);
    
    // Kontrol sonuçları
    const kontrolSonuclari = [];
    let toplamUygun = 0;
    let toplamUyumsuz = 0;
    
    for (const malzeme of malzemeler.rows) {
      // Bu malzeme için şartname gramajı var mı?
      const eslesenGramaj = gramajlar.rows.find(g => 
        g.malzeme_adi.toLowerCase().includes(malzeme.malzeme_adi?.toLowerCase()) ||
        malzeme.malzeme_adi?.toLowerCase().includes(g.malzeme_adi.toLowerCase()) ||
        (malzeme.stok_kart_id && g.stok_kart_id === malzeme.stok_kart_id)
      );
      
      if (eslesenGramaj) {
        const gercekGramaj = parseFloat(malzeme.miktar) || 0;
        const minGramaj = parseFloat(eslesenGramaj.min_gramaj);
        const maxGramaj = parseFloat(eslesenGramaj.max_gramaj) || minGramaj * 1.5;
        
        let durum = 'uygun';
        if (gercekGramaj < minGramaj) durum = 'dusuk';
        else if (gercekGramaj > maxGramaj) durum = 'yuksek';
        
        if (durum === 'uygun') toplamUygun++;
        else toplamUyumsuz++;
        
        kontrolSonuclari.push({
          malzeme_adi: malzeme.malzeme_adi,
          recete_gramaj: gercekGramaj,
          min_gramaj: minGramaj,
          max_gramaj: maxGramaj,
          birim: eslesenGramaj.birim,
          durum,
          zorunlu: eslesenGramaj.zorunlu
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        recete: recete.rows[0],
        malzemeler: malzemeler.rows,
        gramaj_kontrol: {
          sartname_id: sartnameIdToUse,
          sonuclar: kontrolSonuclari,
          uygun_sayisi: toplamUygun,
          uyumsuz_sayisi: toplamUyumsuz,
          toplam_kontrol: kontrolSonuclari.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// MENÜ İÇE AKTARMA (IMPORT)
// =============================================

// Menü dosyası analiz et (önizleme)
router.post('/import/analyze', menuUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi' });
    }
    
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    let menuData = [];
    
    console.log('Menü dosyası analiz ediliyor:', req.file.originalname, mimeType);
    
    // Dosya tipine göre parse et
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      menuData = await parseExcelMenu(filePath);
    } else if (mimeType === 'application/pdf') {
      menuData = await parsePdfMenu(filePath);
    } else if (mimeType.startsWith('image/')) {
      menuData = await parseImageMenu(filePath);
    }
    
    // Geçici dosyayı sil
    fs.unlinkSync(filePath);
    
    // Sonuçları grupla ve özetle
    const ozet = {
      toplam_gun: menuData.length,
      toplam_yemek: menuData.reduce((sum, d) => sum + d.yemekler.length, 0),
      ogunler: {
        kahvalti: menuData.filter(d => d.ogun === 'kahvalti').length,
        ogle: menuData.filter(d => d.ogun === 'ogle').length,
        aksam: menuData.filter(d => d.ogun === 'aksam').length
      },
      tarih_araligi: menuData.length > 0 ? {
        baslangic: menuData.map(d => d.tarih).sort()[0],
        bitis: menuData.map(d => d.tarih).sort().pop()
      } : null
    };
    
    res.json({
      success: true,
      data: menuData,
      ozet
    });
  } catch (error) {
    console.error('Menü analiz hatası:', error);
    // Dosya varsa sil
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analiz edilen menüyü kaydet
router.post('/import/save', async (req, res) => {
  try {
    const { proje_id, menuData, varsayilan_ogun } = req.body;
    
    if (!proje_id || !menuData || !Array.isArray(menuData)) {
      return res.status(400).json({ success: false, error: 'Geçersiz veri' });
    }
    
    // Plan al veya oluştur
    let planResult = await query(
      `SELECT id FROM menu_planlari WHERE proje_id = $1 ORDER BY id LIMIT 1`,
      [proje_id]
    );
    
    let planId;
    if (planResult.rows.length === 0) {
      // Yeni plan oluştur
      const tarihler = menuData.map(d => d.tarih).sort();
      const baslangic = tarihler[0];
      const bitis = tarihler[tarihler.length - 1];
      
      const newPlan = await query(
        `INSERT INTO menu_planlari (proje_id, ad, baslangic_tarihi, bitis_tarihi, durum) 
         VALUES ($1, $2, $3, $4, 'taslak') RETURNING id`,
        [proje_id, `İçe Aktarılan Menü`, baslangic, bitis]
      );
      planId = newPlan.rows[0].id;
    } else {
      planId = planResult.rows[0].id;
    }
    
    // Öğün tiplerini al
    const ogunTipleri = await query(`SELECT id, kod FROM ogun_tipleri`);
    const ogunMap = {};
    ogunTipleri.rows.forEach(o => { ogunMap[o.kod] = o.id; });
    
    // Kategori ID al (varsayılan)
    const defaultKategori = await query(`SELECT id FROM recete_kategoriler WHERE kod = 'ana_yemek' LIMIT 1`);
    const kahvaltiKategori = await query(`SELECT id FROM recete_kategoriler WHERE kod = 'kahvaltilik' LIMIT 1`);
    
    let eklenenGun = 0;
    let eklenenYemek = 0;
    let olusturulanRecete = 0;
    
    for (const gun of menuData) {
      const tarih = gun.tarih;
      const ogun = gun.ogun || varsayilan_ogun || 'aksam';
      const ogunTipiId = ogunMap[ogun] || ogunMap['aksam'];
      
      // Öğün al veya oluştur
      let ogunResult = await query(
        `SELECT id FROM menu_plan_ogunleri WHERE menu_plan_id = $1 AND tarih = $2 AND ogun_tipi_id = $3`,
        [planId, tarih, ogunTipiId]
      );
      
      let ogunId;
      if (ogunResult.rows.length === 0) {
        const newOgun = await query(
          `INSERT INTO menu_plan_ogunleri (menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi) 
           VALUES ($1, $2, $3, 1000) RETURNING id`,
          [planId, tarih, ogunTipiId]
        );
        ogunId = newOgun.rows[0].id;
        eklenenGun++;
      } else {
        ogunId = ogunResult.rows[0].id;
      }
      
      // Her yemek için
      for (let sira = 0; sira < gun.yemekler.length; sira++) {
        const yemekAdi = gun.yemekler[sira];
        
        // Reçete bul veya oluştur
        let receteResult = await query(
          `SELECT id FROM receteler WHERE LOWER(TRIM(ad)) = LOWER(TRIM($1)) AND proje_id = $2 LIMIT 1`,
          [yemekAdi, proje_id]
        );
        
        let receteId;
        if (receteResult.rows.length === 0) {
          // Kısmi eşleşme dene
          const temizAd = yemekAdi.split('/')[0].split('+')[0].trim();
          receteResult = await query(
            `SELECT id FROM receteler WHERE ad ILIKE $1 AND proje_id = $2 LIMIT 1`,
            [`%${temizAd}%`, proje_id]
          );
        }
        
        if (receteResult.rows.length > 0) {
          receteId = receteResult.rows[0].id;
        } else {
          // Yeni reçete oluştur
          const kategoriId = ogun === 'kahvalti' 
            ? (kahvaltiKategori.rows[0]?.id || defaultKategori.rows[0]?.id || 1)
            : (defaultKategori.rows[0]?.id || 1);
          
          const kod = 'IMP-' + Date.now().toString().slice(-8) + '-' + sira;
          const newRecete = await query(
            `INSERT INTO receteler (kod, ad, kategori_id, proje_id, porsiyon_miktar) 
             VALUES ($1, $2, $3, $4, 1) RETURNING id`,
            [kod, yemekAdi, kategoriId, proje_id]
          );
          receteId = newRecete.rows[0].id;
          olusturulanRecete++;
        }
        
        // Yemeği öğüne ekle (duplicate kontrolü)
        const existing = await query(
          `SELECT id FROM menu_ogun_yemekleri WHERE menu_ogun_id = $1 AND recete_id = $2`,
          [ogunId, receteId]
        );
        
        if (existing.rows.length === 0) {
          await query(
            `INSERT INTO menu_ogun_yemekleri (menu_ogun_id, recete_id, sira) VALUES ($1, $2, $3)`,
            [ogunId, receteId, sira + 1]
          );
          eklenenYemek++;
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Menü başarıyla aktarıldı',
      sonuc: {
        plan_id: planId,
        eklenen_gun: eklenenGun,
        eklenen_yemek: eklenenYemek,
        olusturulan_recete: olusturulanRecete
      }
    });
  } catch (error) {
    console.error('Menü kaydetme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
export { hesaplaReceteMaliyet, guncelleOgunMaliyet, guncellePlanMaliyet };

