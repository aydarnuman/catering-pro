import express from 'express';
import { query } from '../database.js';
import { authenticate, requirePermission, auditLog } from '../middleware/auth.js';
import { faturaKalemleriClient } from '../services/fatura-kalemleri-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// NOT: GET route'ları herkese açık, POST/PUT/DELETE route'ları authentication gerektirir

// =============================================
// DEPO YÖNETİMİ
// =============================================

// Tüm depoları listele (özet bilgilerle) - YENİ SİSTEM: urun_depo_durumlari + urun_kartlari
router.get('/depolar', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        d.*,
        COUNT(DISTINCT udd.urun_kart_id) as urun_sayisi,
        COALESCE(SUM(udd.miktar * uk.son_alis_fiyati), 0) as toplam_deger,
        SUM(CASE WHEN udd.miktar <= COALESCE(uk.kritik_stok, 0) AND udd.miktar > 0 THEN 1 ELSE 0 END) as kritik_urun
      FROM depolar d
      LEFT JOIN urun_depo_durumlari udd ON udd.depo_id = d.id
      LEFT JOIN urun_kartlari uk ON uk.id = udd.urun_kart_id
      WHERE d.aktif = true
      GROUP BY d.id
      ORDER BY d.kod
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Depo listesi hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Depo lokasyonlarını getir
// Depo lokasyonları - YENİ SİSTEM: urun_depo_durumlari
router.get('/depolar/:depoId/lokasyonlar', async (req, res) => {
  try {
    const { depoId } = req.params;

    const result = await query(`
      SELECT
        dl.id,
        dl.kod,
        dl.ad,
        dl.tur,
        dl.sicaklik_min,
        dl.sicaklik_max,
        COUNT(DISTINCT udd.urun_kart_id) as urun_sayisi,
        COALESCE(SUM(udd.miktar * COALESCE(uk.son_alis_fiyati, 0)), 0) as toplam_deger
      FROM depo_lokasyonlar dl
      LEFT JOIN urun_depo_durumlari udd ON udd.depo_id = dl.depo_id AND udd.raf_konum = dl.kod
      LEFT JOIN urun_kartlari uk ON uk.id = udd.urun_kart_id
      WHERE dl.depo_id = $1 AND dl.aktif = true
      GROUP BY dl.id, dl.kod, dl.ad, dl.tur, dl.sicaklik_min, dl.sicaklik_max
      ORDER BY dl.kod
    `, [depoId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Lokasyon listesi hatası', { error: error.message, stack: error.stack, depoId });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Belirli bir lokasyonun stoklarını getir - YENİ SİSTEM
router.get('/lokasyonlar/:lokasyonId/stoklar', async (req, res) => {
  try {
    const { lokasyonId } = req.params;
    const { arama } = req.query;

    // Lokasyon bilgisini al
    const lokasyonResult = await query('SELECT * FROM depo_lokasyonlar WHERE id = $1', [lokasyonId]);
    if (lokasyonResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lokasyon bulunamadı' });
    }
    const lokasyon = lokasyonResult.rows[0];

    let whereConditions = ['udd.depo_id = $1', 'udd.raf_konum = $2', 'udd.miktar > 0'];
    let queryParams = [lokasyon.depo_id, lokasyon.kod];

    if (arama) {
      whereConditions.push('(uk.ad ILIKE $3 OR uk.kod ILIKE $3)');
      queryParams.push(`%${arama}%`);
    }

    const result = await query(`
      SELECT
        uk.id,
        uk.kod,
        uk.ad,
        uk.barkod,
        kat.ad as kategori,
        COALESCE(b.kisa_ad, 'Ad') as birim,
        udd.miktar,
        COALESCE(udd.rezerve_miktar, 0) as rezerve_miktar,
        (udd.miktar - COALESCE(udd.rezerve_miktar, 0)) as kullanilabilir,
        $2 as lokasyon,
        uk.min_stok,
        uk.max_stok,
        uk.kritik_stok,
        uk.son_alis_fiyati as son_alis_fiyat,
        (udd.miktar * COALESCE(uk.son_alis_fiyati, 0)) as stok_deger,
        CASE
          WHEN udd.miktar = 0 THEN 'tukendi'
          WHEN uk.kritik_stok IS NOT NULL AND udd.miktar <= uk.kritik_stok THEN 'kritik'
          WHEN uk.min_stok IS NOT NULL AND udd.miktar <= uk.min_stok THEN 'dusuk'
          WHEN uk.max_stok IS NOT NULL AND udd.miktar >= uk.max_stok THEN 'fazla'
          ELSE 'normal'
        END as durum
      FROM urun_depo_durumlari udd
      JOIN urun_kartlari uk ON uk.id = udd.urun_kart_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY uk.kod
    `, queryParams);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Lokasyon stok listesi hatası', { error: error.message, stack: error.stack, depoId, lokasyonId });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Belirli bir deponun stoklarını getir - YENİ SİSTEM: urun_depo_durumlari + urun_kartlari
router.get('/depolar/:depoId/stoklar', async (req, res) => {
  try {
    const { depoId } = req.params;
    const { kritik, kategori, arama } = req.query;
    
    let whereConditions = ['udd.depo_id = $1', 'uk.aktif = true'];
    let queryParams = [depoId];
    let paramIndex = 2;
    
    // Kritik stok filtresi
    if (kritik === 'true') {
      whereConditions.push('udd.miktar <= COALESCE(uk.kritik_stok, 0)');
    }
    
    // Kategori filtresi
    if (kategori) {
      whereConditions.push(`k.id = $${paramIndex}`);
      queryParams.push(kategori);
      paramIndex++;
    }
    
    // Arama filtresi
    if (arama) {
      whereConditions.push(`(uk.ad ILIKE $${paramIndex} OR uk.kod ILIKE $${paramIndex})`);
      queryParams.push(`%${arama}%`);
      paramIndex++;
    }
    
    const result = await query(`
      SELECT 
        uk.id,
        uk.kod,
        uk.ad,
        uk.barkod,
        k.ad as kategori,
        COALESCE(b.kisa_ad, 'Ad') as birim,
        udd.miktar as toplam_stok,
        COALESCE(udd.rezerve_miktar, 0) as rezerve_stok,
        (udd.miktar - COALESCE(udd.rezerve_miktar, 0)) as kullanilabilir_stok,
        udd.raf_konum as lokasyon_kodu,
        uk.min_stok,
        uk.max_stok,
        uk.kritik_stok,
        uk.son_alis_fiyati as son_alis_fiyat,
        (udd.miktar * COALESCE(uk.son_alis_fiyati, 0)) as stok_deger,
        CASE 
          WHEN udd.miktar = 0 THEN 'tukendi'
          WHEN udd.miktar <= COALESCE(uk.kritik_stok, 0) THEN 'kritik'
          WHEN udd.miktar <= COALESCE(uk.min_stok, 0) THEN 'dusuk'
          WHEN uk.max_stok IS NOT NULL AND udd.miktar >= uk.max_stok THEN 'fazla'
          ELSE 'normal'
        END as durum,
        d.ad as depo_ad,
        d.kod as depo_kod
      FROM urun_depo_durumlari udd
      JOIN urun_kartlari uk ON uk.id = udd.urun_kart_id
      JOIN depolar d ON d.id = udd.depo_id
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY uk.kod
    `, queryParams);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Depo stok listesi hatası', { error: error.message, stack: error.stack, depoId });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Depo karşılaştırma raporu
router.get('/depolar/karsilastirma', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM v_depo_karsilastirma
      ORDER BY stok_kod
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Depo karşılaştırma hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni depo ekle
router.post('/depolar', async (req, res) => {
  try {
    const { ad, kod, tur, adres, telefon, email, yetkili, kapasite_m3 } = req.body;
    
    // Kod kontrolü
    const kodKontrol = await query('SELECT id FROM depolar WHERE kod = $1', [kod]);
    if (kodKontrol.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bu kod zaten kullanılıyor' 
      });
    }
    
    const result = await query(`
      INSERT INTO depolar (ad, kod, tur, adres, telefon, email, yetkili, kapasite_m3, aktif)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *
    `, [ad, kod, tur || 'genel', adres, telefon, email, yetkili, kapasite_m3 || 0]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Depo ekleme hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Depo güncelle
router.put('/depolar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, tur, adres, telefon, email, yetkili, kapasite_m3, aktif } = req.body;
    
    const result = await query(`
      UPDATE depolar
      SET ad = $1, tur = $2, adres = $3, telefon = $4, email = $5, 
          yetkili = $6, kapasite_m3 = $7, aktif = $8, updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [ad, tur, adres, telefon, email, yetkili, kapasite_m3, aktif, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Depo bulunamadı' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Depo güncelleme hatası', { error: error.message, stack: error.stack, id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Depo sil (soft delete)
router.delete('/depolar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Stok kontrolü - YENİ SİSTEM: urun_depo_durumlari
    const stokKontrol = await query(`
      SELECT COUNT(*) as count
      FROM urun_depo_durumlari
      WHERE depo_id = $1 AND miktar > 0
    `, [id]);
    
    if (parseInt(stokKontrol.rows[0].count) > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bu depoda stok bulunuyor. Önce stokları transfer edin.' 
      });
    }
    
    const result = await query(`
      UPDATE depolar
      SET aktif = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Depo bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Depo pasif edildi',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Depo silme hatası', { error: error.message, stack: error.stack, id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// STOK KARTLARI
// =============================================

// Tüm stok kartlarını listele - YENİ SİSTEM: urun_kartlari + urun_depo_durumlari
router.get('/kartlar', async (req, res) => {
  try {
    const { kategori, depo, kritik, arama, limit = 100, offset = 0 } = req.query;
    
    let whereConditions = ['uk.aktif = true'];
    let queryParams = [];
    let paramIndex = 1;
    
    if (kategori) {
      whereConditions.push(`k.id = $${paramIndex}`);
      queryParams.push(kategori);
      paramIndex++;
    }
    
    if (kritik === 'true') {
      whereConditions.push('COALESCE(toplam.miktar, 0) <= COALESCE(uk.kritik_stok, 0)');
    }
    
    if (arama) {
      whereConditions.push(`(uk.ad ILIKE $${paramIndex} OR uk.kod ILIKE $${paramIndex} OR uk.barkod ILIKE $${paramIndex})`);
      queryParams.push(`%${arama}%`);
      paramIndex++;
    }
    
    // Depo filtresi varsa
    let depoJoin = '';
    let depoSelect = 'COALESCE(toplam.miktar, 0)';
    if (depo) {
      depoJoin = `LEFT JOIN urun_depo_durumlari udd ON udd.urun_kart_id = uk.id AND udd.depo_id = $${paramIndex}`;
      depoSelect = 'COALESCE(udd.miktar, 0)';
      whereConditions.push('udd.miktar > 0');
      queryParams.push(depo);
      paramIndex++;
    }
    
    const limitIndex = paramIndex;
    const offsetIndex = paramIndex + 1;
    queryParams.push(limit, offset);
    
    const result = await query(`
      SELECT DISTINCT
        uk.id,
        uk.kod,
        uk.barkod,
        uk.ad,
        k.ad as kategori,
        COALESCE(b.kisa_ad, 'Ad') as birim,
        COALESCE(toplam.miktar, 0) as toplam_stok,
        0 as rezerve_stok,
        COALESCE(toplam.miktar, 0) as kullanilabilir_stok,
        uk.min_stok,
        uk.max_stok,
        uk.kritik_stok,
        uk.son_alis_fiyati as son_alis_fiyat,
        uk.ortalama_fiyat as ortalama_maliyet,
        (COALESCE(toplam.miktar, 0) * COALESCE(uk.son_alis_fiyati, 0)) as stok_deger,
        NULL as tedarikci,
        NULL as tedarik_suresi,
        CASE 
          WHEN COALESCE(toplam.miktar, 0) = 0 THEN 'tukendi'
          WHEN COALESCE(toplam.miktar, 0) <= COALESCE(uk.kritik_stok, 0) THEN 'kritik'
          WHEN COALESCE(toplam.miktar, 0) <= COALESCE(uk.min_stok, 0) THEN 'dusuk'
          WHEN uk.max_stok IS NOT NULL AND COALESCE(toplam.miktar, 0) >= uk.max_stok THEN 'fazla'
          ELSE 'normal'
        END as durum
      FROM urun_kartlari uk
      LEFT JOIN (
        SELECT urun_kart_id, SUM(miktar) as miktar FROM urun_depo_durumlari GROUP BY urun_kart_id
      ) toplam ON toplam.urun_kart_id = uk.id
      ${depoJoin}
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY uk.kod
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `, queryParams);
    
    const countParams = queryParams.slice(0, -2);
    const countResult = await query(`
      SELECT COUNT(DISTINCT uk.id) as total
      FROM urun_kartlari uk
      LEFT JOIN (
        SELECT urun_kart_id, SUM(miktar) as miktar FROM urun_depo_durumlari GROUP BY urun_kart_id
      ) toplam ON toplam.urun_kart_id = uk.id
      ${depoJoin}
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      WHERE ${whereConditions.join(' AND ')}
    `, countParams);
    
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Stok kartları listesi hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok kartını sil - YENİ SİSTEM: urun_kartlari + urun_hareketleri + urun_depo_durumlari
router.delete('/kartlar/:id', authenticate, requirePermission('stok', 'delete'), auditLog('stok'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ürün hareketlerini sil
    await query('DELETE FROM urun_hareketleri WHERE urun_kart_id = $1', [id]);
    
    // Depo durumlarını sil
    await query('DELETE FROM urun_depo_durumlari WHERE urun_kart_id = $1', [id]);
    
    // Tedarikçi eşleştirmelerini sil
    await query('DELETE FROM urun_tedarikci_eslestirme WHERE urun_kart_id = $1', [id]);
    
    // Fiyat geçmişini sil
    await query('DELETE FROM urun_fiyat_gecmisi WHERE urun_kart_id = $1', [id]);
    
    // İlgili fatura işlem kayıtlarını kontrol et ve gerekirse temizle
    const faturaResult = await query(`
      SELECT DISTINCT fsi.ettn 
      FROM fatura_stok_islem fsi
      WHERE NOT EXISTS (
        SELECT 1 FROM urun_hareketleri uh WHERE uh.aciklama LIKE '%' || fsi.ettn || '%'
      )
    `);
    
    for (const row of faturaResult.rows) {
      await query('DELETE FROM fatura_stok_islem WHERE ettn = $1', [row.ettn]);
    }
    
    // Ürün kartını pasif et (soft delete)
    const result = await query(`
      UPDATE urun_kartlari
      SET aktif = false, 
          kod = kod || '_SILINDI_' || id,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün kartı bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Ürün kartı ve ilişkili veriler silindi',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Ürün silme hatası', { error: error.message, stack: error.stack, id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok detayını getir - YENİ SİSTEM: urun_kartlari
router.get('/kartlar/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Ürün kartı bilgileri (YENİ SİSTEM)
    const kartResult = await query(`
      SELECT
        uk.*,
        uk.son_alis_fiyati as son_alis_fiyat,
        k.ad as kategori_ad,
        b.ad as birim_ad,
        b.kisa_ad as birim_kisa
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE uk.id = $1
    `, [id]);

    if (kartResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün kartı bulunamadı' });
    }

    // Depo durumları (YENİ SİSTEM)
    const depoResult = await query(`
      SELECT
        d.id as depo_id,
        d.kod as depo_kod,
        d.ad as depo_ad,
        d.tur as depo_tip,
        udd.miktar,
        udd.rezerve_miktar,
        (udd.miktar - COALESCE(udd.rezerve_miktar, 0)) as kullanilabilir,
        udd.raf_konum as lokasyon_kodu,
        udd.min_stok as depo_min_stok,
        udd.max_stok as depo_max_stok
      FROM urun_depo_durumlari udd
      JOIN depolar d ON d.id = udd.depo_id
      WHERE udd.urun_kart_id = $1
      ORDER BY d.kod
    `, [id]);

    // Son hareketler (YENİ SİSTEM)
    const hareketResult = await query(`
      SELECT
        h.*,
        d1.ad as giris_depo_ad,
        d2.ad as cikis_depo_ad,
        c.unvan as cari_unvan
      FROM urun_hareketleri h
      LEFT JOIN depolar d1 ON d1.id = h.hedef_depo_id
      LEFT JOIN depolar d2 ON d2.id = h.kaynak_depo_id
      LEFT JOIN cariler c ON c.id = h.cari_id
      WHERE h.urun_kart_id = $1
      ORDER BY h.created_at DESC
      LIMIT 10
    `, [id]);

    res.json({
      success: true,
      data: {
        ...kartResult.rows[0],
        depo_durumlari: depoResult.rows,
        son_hareketler: hareketResult.rows
      }
    });
  } catch (error) {
    logger.error('Ürün kartı detay hatası', { error: error.message, stack: error.stack, id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni ürün kartı oluştur - YENİ SİSTEM: urun_kartlari
router.post('/kartlar', authenticate, requirePermission('stok', 'create'), auditLog('stok'), async (req, res) => {
  try {
    const {
      kod, ad, barkod, kategori_id, ana_birim_id,
      min_stok, max_stok, kritik_stok,
      son_alis_fiyat, kdv_orani,
      raf_omru_gun, aciklama
    } = req.body;

    // Otomatik kod oluştur (eğer verilmediyse)
    let urunKod = kod;
    if (!urunKod) {
      const lastKod = await query(`
        SELECT kod FROM urun_kartlari
        WHERE kod LIKE 'URN-%'
        ORDER BY id DESC LIMIT 1
      `);
      const lastNum = lastKod.rows.length > 0
        ? parseInt(lastKod.rows[0].kod.split('-')[1]) || 0
        : 0;
      urunKod = `URN-${String(lastNum + 1).padStart(4, '0')}`;
    }

    const result = await query(`
      INSERT INTO urun_kartlari (
        kod, ad, barkod, kategori_id, ana_birim_id,
        min_stok, max_stok, kritik_stok,
        son_alis_fiyati, kdv_orani,
        raf_omru_gun, aciklama, aktif, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW())
      RETURNING *
    `, [urunKod, ad, barkod, kategori_id, ana_birim_id,
        min_stok || 0, max_stok, kritik_stok || 0,
        son_alis_fiyat || 0, kdv_orani || 10,
        raf_omru_gun, aciklama]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Ürün kartı başarıyla oluşturuldu'
    });
  } catch (error) {
    logger.error('Ürün kartı oluşturma hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// STOK HAREKETLERİ - YENİ SİSTEM: urun_hareketleri
// =============================================

// Stok hareketleri listesi - YENİ SİSTEM
router.get('/hareketler', async (req, res) => {
  try {
    const { limit = 100, offset = 0, urun_kart_id, stok_kart_id, depo_id, hareket_tipi } = req.query;

    // stok_kart_id parametresini de kabul et (geriye uyumluluk)
    const urunId = urun_kart_id || stok_kart_id;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (urunId) {
      whereConditions.push(`h.urun_kart_id = $${paramIndex}`);
      queryParams.push(urunId);
      paramIndex++;
    }

    if (depo_id) {
      whereConditions.push(`(h.hedef_depo_id = $${paramIndex} OR h.kaynak_depo_id = $${paramIndex})`);
      queryParams.push(depo_id);
      paramIndex++;
    }

    if (hareket_tipi) {
      whereConditions.push(`UPPER(h.hareket_tipi) = UPPER($${paramIndex})`);
      queryParams.push(hareket_tipi);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    queryParams.push(limit, offset);

    const result = await query(`
      SELECT
        h.*,
        h.urun_kart_id as stok_kart_id,
        h.hedef_depo_id as giris_depo_id,
        h.kaynak_depo_id as cikis_depo_id,
        uk.kod as stok_kod,
        uk.ad as stok_ad,
        d1.ad as giris_depo_ad,
        d2.ad as cikis_depo_ad,
        COALESCE(b.kisa_ad, 'Ad') as birim
      FROM urun_hareketleri h
      LEFT JOIN urun_kartlari uk ON uk.id = h.urun_kart_id
      LEFT JOIN depolar d1 ON d1.id = h.hedef_depo_id
      LEFT JOIN depolar d2 ON d2.id = h.kaynak_depo_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      ${whereClause}
      ORDER BY h.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, queryParams);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Stok hareketleri listesi hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok girişi - YENİ SİSTEM: urun_hareketleri (trigger otomatik günceller)
router.post('/hareketler/giris', async (req, res) => {
  try {
    const {
      urun_kart_id, stok_kart_id, depo_id, miktar, birim_fiyat,
      belge_no, cari_id, aciklama
    } = req.body;

    // stok_kart_id parametresini de kabul et (geriye uyumluluk)
    const urunId = urun_kart_id || stok_kart_id;

    if (!urunId || !depo_id || !miktar) {
      return res.status(400).json({
        success: false,
        error: 'Ürün ID, depo ID ve miktar zorunludur'
      });
    }

    // Hareket kaydı oluştur (trigger otomatik olarak depo durumunu günceller)
    const result = await query(`
      INSERT INTO urun_hareketleri (
        urun_kart_id, hareket_tipi, miktar, birim_fiyat,
        toplam_tutar, hedef_depo_id, cari_id,
        referans_no, aciklama, tarih, created_at
      ) VALUES ($1, 'giris', $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [
      urunId, miktar, birim_fiyat || 0,
      (parseFloat(miktar) * parseFloat(birim_fiyat || 0)),
      depo_id, cari_id,
      belge_no || `GRS-${Date.now()}`, aciklama
    ]);

    // Fiyat geçmişine ekle
    if (birim_fiyat && birim_fiyat > 0) {
      await query(`
        INSERT INTO urun_fiyat_gecmisi (urun_kart_id, cari_id, fiyat, kaynak, tarih, created_at)
        VALUES ($1, $2, $3, 'manuel', CURRENT_DATE, NOW())
      `, [urunId, cari_id, birim_fiyat]);
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `${miktar} birim stok girişi yapıldı`
    });
  } catch (error) {
    logger.error('Stok giriş hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok çıkışı - YENİ SİSTEM: urun_hareketleri (trigger otomatik günceller)
router.post('/hareketler/cikis', async (req, res) => {
  try {
    const {
      urun_kart_id, stok_kart_id, depo_id, miktar,
      belge_no, aciklama
    } = req.body;

    // stok_kart_id parametresini de kabul et (geriye uyumluluk)
    const urunId = urun_kart_id || stok_kart_id;

    if (!urunId || !depo_id || !miktar) {
      return res.status(400).json({
        success: false,
        error: 'Ürün ID, depo ID ve miktar zorunludur'
      });
    }

    // Mevcut stok kontrolü (YENİ SİSTEM)
    const mevcutStok = await query(
      'SELECT miktar, COALESCE(rezerve_miktar, 0) as rezerve FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [urunId, depo_id]
    );

    const kullanilabilir = mevcutStok.rows[0]
      ? (parseFloat(mevcutStok.rows[0].miktar) - parseFloat(mevcutStok.rows[0].rezerve))
      : 0;

    if (kullanilabilir < parseFloat(miktar)) {
      return res.status(400).json({
        success: false,
        error: `Yetersiz stok! Kullanılabilir: ${kullanilabilir}`
      });
    }

    // Hareket kaydı oluştur (trigger otomatik olarak depo durumunu günceller)
    const result = await query(`
      INSERT INTO urun_hareketleri (
        urun_kart_id, hareket_tipi, miktar,
        kaynak_depo_id, referans_no, aciklama, tarih, created_at
      ) VALUES ($1, 'cikis', $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [urunId, miktar, depo_id, belge_no || `CKS-${Date.now()}`, aciklama]);

    res.json({
      success: true,
      data: result.rows[0],
      message: `${miktar} birim stok çıkışı yapıldı`
    });
  } catch (error) {
    logger.error('Stok çıkış hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Depolar arası transfer - YENİ SİSTEM: urun_hareketleri (trigger otomatik günceller)
router.post('/hareketler/transfer', async (req, res) => {
  try {
    const {
      urun_kart_id, stok_kart_id, kaynak_depo_id, hedef_depo_id, miktar,
      belge_no, aciklama
    } = req.body;

    // stok_kart_id parametresini de kabul et (geriye uyumluluk)
    const urunId = urun_kart_id || stok_kart_id;

    if (!urunId || !kaynak_depo_id || !hedef_depo_id || !miktar) {
      return res.status(400).json({
        success: false,
        error: 'Ürün ID, kaynak depo, hedef depo ve miktar zorunludur'
      });
    }

    // Kaynak depo stok kontrolü (YENİ SİSTEM)
    const kaynakStok = await query(
      'SELECT miktar, COALESCE(rezerve_miktar, 0) as rezerve FROM urun_depo_durumlari WHERE urun_kart_id = $1 AND depo_id = $2',
      [urunId, kaynak_depo_id]
    );

    const kullanilabilir = kaynakStok.rows[0]
      ? (parseFloat(kaynakStok.rows[0].miktar) - parseFloat(kaynakStok.rows[0].rezerve))
      : 0;

    if (kullanilabilir < parseFloat(miktar)) {
      return res.status(400).json({
        success: false,
        error: `Kaynak depoda yetersiz stok! Kullanılabilir: ${kullanilabilir}`
      });
    }

    // Transfer hareketi kaydet (trigger otomatik olarak her iki depoyu da günceller)
    const result = await query(`
      INSERT INTO urun_hareketleri (
        urun_kart_id, hareket_tipi, miktar,
        kaynak_depo_id, hedef_depo_id,
        referans_no, aciklama, tarih, created_at
      ) VALUES ($1, 'transfer', $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `, [urunId, miktar, kaynak_depo_id, hedef_depo_id,
        belge_no || `TRF-${Date.now()}`, aciklama]);

    res.json({
      success: true,
      data: result.rows[0],
      message: `${miktar} birim transfer yapıldı`
    });
  } catch (error) {
    logger.error('Transfer hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// RAPORLAR - YENİ SİSTEM
// =============================================

// Kritik stoklar - YENİ SİSTEM: urun_kartlari
router.get('/kritik', async (req, res) => {
  try {
    const { depo_id } = req.query;

    let whereClause = 'WHERE uk.aktif = true';
    let params = [];

    if (depo_id) {
      whereClause += ' AND udd.depo_id = $1';
      params = [depo_id];
    }

    // Yeni sistem - kritik stok hesaplama
    const result = await query(`
      SELECT
        uk.id,
        uk.kod,
        uk.ad,
        uk.min_stok,
        uk.kritik_stok,
        uk.toplam_stok,
        COALESCE(udd.miktar, 0) as depo_stok,
        udd.depo_id,
        d.ad as depo_ad,
        kat.ad as kategori,
        CASE
          WHEN uk.toplam_stok <= 0 THEN 'tukendi'
          WHEN uk.kritik_stok IS NOT NULL AND uk.toplam_stok <= uk.kritik_stok THEN 'kritik'
          WHEN uk.min_stok IS NOT NULL AND uk.toplam_stok <= uk.min_stok THEN 'dusuk'
          ELSE 'normal'
        END as durum,
        GREATEST(0, COALESCE(uk.min_stok, 0) - uk.toplam_stok) as eksik_miktar
      FROM urun_kartlari uk
      LEFT JOIN urun_depo_durumlari udd ON udd.urun_kart_id = uk.id
      LEFT JOIN depolar d ON d.id = udd.depo_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      ${whereClause}
        AND (
          uk.toplam_stok <= 0
          OR (uk.kritik_stok IS NOT NULL AND uk.toplam_stok <= uk.kritik_stok)
          OR (uk.min_stok IS NOT NULL AND uk.toplam_stok <= uk.min_stok)
        )
      ORDER BY
        CASE
          WHEN uk.toplam_stok <= 0 THEN 1
          WHEN uk.kritik_stok IS NOT NULL AND uk.toplam_stok <= uk.kritik_stok THEN 2
          ELSE 3
        END,
        eksik_miktar DESC
    `, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Kritik stok hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok değer raporu - YENİ SİSTEM: urun_kartlari
router.get('/rapor/deger', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COALESCE(k.ad, 'Kategorisiz') as kategori,
        COUNT(*) as urun_sayisi,
        COALESCE(SUM(uk.toplam_stok), 0) as toplam_miktar,
        COALESCE(SUM(uk.toplam_stok * COALESCE(uk.son_alis_fiyati, 0)), 0) as toplam_deger
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri k ON k.id = uk.kategori_id
      WHERE uk.aktif = true
      GROUP BY k.ad
      ORDER BY toplam_deger DESC
    `);

    const toplamDeger = result.rows.reduce((sum, row) => sum + parseFloat(row.toplam_deger || 0), 0);

    res.json({
      success: true,
      data: result.rows,
      ozet: {
        toplam_deger: toplamDeger,
        kategori_sayisi: result.rows.length
      }
    });
  } catch (error) {
    logger.error('Değer raporu hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// YARDIMCI ENDPOINTLER - YENİ SİSTEM
// =============================================

// Kategoriler - YENİ SİSTEM: urun_kategorileri
router.get('/kategoriler', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM urun_kategorileri
      WHERE aktif = true
      ORDER BY sira, ad
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Birimler
router.get('/birimler', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM birimler 
      WHERE aktif = true 
      ORDER BY tip, kod
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// FATURADAN STOK GİRİŞİ
// =============================================

import { faturaService } from '../scraper/uyumsoft/index.js';
import { parseStringPromise } from 'xml2js';

// İşlenmemiş faturaları listele
router.get('/faturalar', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Son 3 ayın faturaları, henüz stok olarak işlenmemişler
    const result = await query(`
      SELECT 
        ui.id,
        ui.ettn,
        ui.invoice_no,
        ui.sender_name,
        ui.sender_vkn,
        ui.invoice_date,
        ui.payable_amount,
        ui.invoice_type,
        CASE WHEN fsi.id IS NOT NULL THEN true ELSE false END as stok_islendi,
        fsi.islem_tarihi as stok_islem_tarihi,
        fsi.depo_id as islenen_depo_id
      FROM uyumsoft_invoices ui
      LEFT JOIN fatura_stok_islem fsi ON fsi.ettn = ui.ettn
      WHERE ui.invoice_type LIKE '%incoming%'
        AND ui.invoice_date > NOW() - INTERVAL '3 months'
      ORDER BY ui.invoice_date DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    // Toplam sayı
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM uyumsoft_invoices
      WHERE invoice_type LIKE '%incoming%'
        AND invoice_date > NOW() - INTERVAL '3 months'
    `);
    
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Fatura listesi hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fatura kalemlerini getir – tek kaynak: faturaKalemleriClient
router.get('/faturalar/:ettn/kalemler', async (req, res) => {
  try {
    const { ettn } = req.params;

    const rows = await faturaKalemleriClient.getKalemler(ettn);

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        fatura: null,
        kalemler: [],
        message: 'Bu faturaya ait kalem bulunamadı. Önce Faturalar > Kalemler sayfasında faturayı açıp kalemleri yükleyin.'
      });
    }

    const toplamTutar = rows.reduce((s, r) => s + (parseFloat(r.tutar) || 0), 0);
    const faturaInfo = {
      fatura_no: ettn,
      tarih: rows[0]?.fatura_tarihi ?? null,
      toplam_tutar: toplamTutar,
      gonderen: rows[0]?.tedarikci_ad ?? null
    };

    const kalemler = rows.map((r) => ({
      sira: r.kalem_sira,
      urun_adi: r.orijinal_urun_adi,
      urun_kodu: r.orijinal_urun_kodu,
      miktar: parseFloat(r.miktar) || 0,
      birim: r.birim || 'C62',
      birim_fiyat: parseFloat(r.birim_fiyat) || 0,
      tutar: parseFloat(r.tutar) || 0,
      kdv_orani: parseFloat(r.kdv_orani) || 0,
      kdv_tutar: parseFloat(r.kdv_tutari) || 0,
      onerilen_stok_kart_id: r.urun_id ?? null,
      onerilen_stok_kart: r.urun_id
        ? { id: r.urun_id, kod: r.urun_kod, ad: r.urun_ad }
        : null
    }));

    res.json({
      success: true,
      fatura: faturaInfo,
      kalemler
    });
  } catch (error) {
    logger.error('Fatura kalem hatası', { error: error.message, stack: error.stack, ettn: req.params?.ettn });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Faturadan stok girişi yap
router.post('/faturadan-giris', async (req, res) => {
  try {
    const { 
      ettn, 
      depo_id, 
      kalemler,  // [{kalem_sira, stok_kart_id, miktar, birim_fiyat, yeni_urun?}]
      notlar 
    } = req.body;
    
    if (!ettn || !depo_id || !kalemler || kalemler.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'ETTN, depo ve kalemler zorunludur' 
      });
    }
    
    // Fatura daha önce işlenmiş mi kontrol et
    const mevcutIslem = await query(
      'SELECT id FROM fatura_stok_islem WHERE ettn = $1',
      [ettn]
    );
    
    if (mevcutIslem.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bu fatura zaten stok olarak işlenmiş' 
      });
    }
    
    // Fatura bilgisini al
    const faturaResult = await query(
      'SELECT id, sender_name FROM uyumsoft_invoices WHERE ettn = $1',
      [ettn]
    );
    
    const faturaId = faturaResult.rows[0]?.id;
    const tedarikci = faturaResult.rows[0]?.sender_name || 'Bilinmeyen';
    
    let toplamTutar = 0;
    let islemSayisi = 0;
    
    // Her kalem için stok girişi yap (YENİ SİSTEM: urun_hareketleri + urun_depo_durumlari)
    for (const kalem of kalemler) {
      if (!kalem.stok_kart_id) continue; // Eşleştirilmemiş kalemleri atla
      
      const miktar = parseFloat(kalem.miktar) || 0;
      const birimFiyat = parseFloat(kalem.birim_fiyat) || 0;
      
      // 1. Ürün hareketi oluştur (urun_hareketleri tablosuna)
      // GİRİŞ için hedef_depo_id kullanılır
      await query(`
        INSERT INTO urun_hareketleri (
          urun_kart_id, hedef_depo_id, hareket_tipi, miktar,
          birim_fiyat, toplam_tutar, referans_no, aciklama, fatura_ettn, tarih, created_at
        ) VALUES ($1, $2, 'GIRIS', $3, $4, $5, $6, $7, $8, CURRENT_DATE, NOW())
      `, [
        kalem.stok_kart_id,
        depo_id,
        miktar,
        birimFiyat,
        miktar * birimFiyat,
        `FAT-${ettn.substring(0, 8)}`,
        `${tedarikci} faturasından giriş - ${kalem.urun_adi || ''}`,
        ettn
      ]);
      
      // 2. Depo stok durumunu güncelle (urun_depo_durumlari)
      await query(`
        INSERT INTO urun_depo_durumlari (urun_kart_id, depo_id, miktar, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (urun_kart_id, depo_id) 
        DO UPDATE SET miktar = urun_depo_durumlari.miktar + $3, updated_at = NOW()
      `, [kalem.stok_kart_id, depo_id, miktar]);
      
      // 3. Ürün kartı fiyatını güncelle (urun_kartlari)
      await query(`
        UPDATE urun_kartlari 
        SET son_alis_fiyati = $1, updated_at = NOW()
        WHERE id = $2 AND (son_alis_fiyati IS NULL OR son_alis_fiyati < $1)
      `, [birimFiyat, kalem.stok_kart_id]);
      
      // 4. Fiyat geçmişi kaydet (urun_fiyat_gecmisi)
      if (birimFiyat > 0) {
        await query(`
          INSERT INTO urun_fiyat_gecmisi (urun_kart_id, fiyat, kaynak, fatura_ettn, tarih, created_at)
          VALUES ($1, $2, $3, $4, CURRENT_DATE, NOW())
        `, [kalem.stok_kart_id, birimFiyat, `Fatura: ${tedarikci.substring(0, 40)}`, ettn]);
      }
      
      // 5. Tedarikçi eşleştirme geçmişine ekle (urun_tedarikci_eslestirme)
      if (kalem.urun_kodu || kalem.urun_adi) {
        // Önce cari_id'yi tedarikçi adından bul
        const cariResult = await query(
          `SELECT id FROM cariler WHERE unvan ILIKE $1 LIMIT 1`,
          [`%${tedarikci.substring(0, 20)}%`]
        );
        const cariId = cariResult.rows[0]?.id || null;
        
        const tedarikciUrunAdi = (kalem.urun_adi || '').substring(0, 500);
        const tedarikciUrunKodu = (kalem.urun_kodu || `FATURA-${kalem.kalem_sira}`).substring(0, 100);
        
        // Normalize edilmiş ismi al
        const normalizeResult = await query(
          `SELECT normalize_urun_adi_v2($1) as normalized`,
          [tedarikciUrunAdi]
        );
        const normalizedAdi = normalizeResult.rows[0]?.normalized || '';
        
        // Önce mevcut kayıt var mı kontrol et (UNIQUE: cari_id + tedarikci_urun_adi_normalized)
        const existingResult = await query(`
          SELECT id FROM urun_tedarikci_eslestirme 
          WHERE cari_id = $1 AND tedarikci_urun_adi_normalized = $2
        `, [cariId, normalizedAdi]);
        
        if (existingResult.rows.length > 0) {
          // Mevcut kaydı güncelle
          await query(`
            UPDATE urun_tedarikci_eslestirme 
            SET eslestirme_sayisi = eslestirme_sayisi + 1, updated_at = NOW()
            WHERE id = $1
          `, [existingResult.rows[0].id]);
        } else {
          // Yeni kayıt ekle
          await query(`
            INSERT INTO urun_tedarikci_eslestirme (
              urun_kart_id, cari_id, tedarikci_urun_kodu, tedarikci_urun_adi, 
              tedarikci_urun_adi_normalized, eslestirme_sayisi, aktif
            )
            VALUES ($1, $2, $3, $4, $5, 1, true)
          `, [kalem.stok_kart_id, cariId, tedarikciUrunKodu, tedarikciUrunAdi, normalizedAdi]);
        }
      }
      
      toplamTutar += (miktar * birimFiyat);
      islemSayisi++;
    }
    
    // Fatura işlem kaydı
    await query(`
      INSERT INTO fatura_stok_islem (
        uyumsoft_invoice_id, ettn, depo_id, toplam_kalem, toplam_tutar, notlar
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [faturaId, ettn, depo_id, islemSayisi, toplamTutar, notlar || '']);
    
    res.json({
      success: true,
      message: `${islemSayisi} kalem stok girişi yapıldı`,
      toplam_tutar: toplamTutar
    });
    
  } catch (error) {
    logger.error('Faturadan stok giriş hatası', { error: error.message, stack: error.stack, faturaId });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok kartı arama (eşleştirme için)
router.get('/kartlar/ara', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }
    
    // YENİ SİSTEM: urun_kartlari tablosu
    const result = await query(`
      SELECT uk.id, uk.kod, uk.ad, uk.ana_birim_id, uk.son_alis_fiyati as son_alis_fiyat,
             COALESCE(b.kisa_ad, 'Ad') as birim
      FROM urun_kartlari uk
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE uk.aktif = true
        AND (LOWER(uk.kod) LIKE LOWER($1) OR LOWER(uk.ad) LIKE LOWER($1))
      ORDER BY uk.ad
      LIMIT 20
    `, [`%${q}%`]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// AKILLI STOK EŞLEŞTİRME
// =============================================

// UBL birim kodunu sistem birimine dönüştür
async function donusturBirim(ublKodu, miktar) {
  try {
    const result = await query(`
      SELECT ubd.sistem_birim_id, ubd.carpan, b.kod as birim_kod, b.kisa_ad as birim_ad
      FROM ubl_birim_donusum ubd
      JOIN birimler b ON b.id = ubd.sistem_birim_id
      WHERE ubd.ubl_kodu = $1 AND ubd.aktif = true
    `, [ublKodu]);
    
    if (result.rows.length === 0) {
      // Bilinmeyen birim - varsayılan olarak ADET kabul et
      return { 
        birim_id: null, 
        birim_kod: ublKodu, 
        birim_ad: ublKodu,
        miktar: miktar,
        donusturuldu: false 
      };
    }
    
    const { sistem_birim_id, carpan, birim_kod, birim_ad } = result.rows[0];
    return {
      birim_id: sistem_birim_id,
      birim_kod,
      birim_ad,
      miktar: miktar * parseFloat(carpan),
      donusturuldu: true
    };
  } catch (error) {
    logger.error('Birim dönüşüm hatası', { error: error.message, stack: error.stack });
    return { birim_id: null, birim_kod: ublKodu, birim_ad: ublKodu, miktar, donusturuldu: false };
  }
}

// Tek ürün için akıllı eşleştirme
router.post('/akilli-eslestir', async (req, res) => {
  try {
    const { urun_adi, urun_kodu, tedarikci_vkn } = req.body;
    
    if (!urun_adi) {
      return res.status(400).json({ success: false, error: 'Ürün adı zorunludur' });
    }
    
    // PostgreSQL fonksiyonunu çağır
    const result = await query(`
      SELECT * FROM akilli_stok_eslestir($1, $2, $3)
      ORDER BY guven_skoru DESC
      LIMIT 5
    `, [urun_adi, urun_kodu || null, tedarikci_vkn || null]);
    
    res.json({
      success: true,
      data: result.rows,
      en_iyi_eslesme: result.rows.length > 0 ? result.rows[0] : null,
      otomatik_onay: result.rows.length > 0 && parseFloat(result.rows[0].guven_skoru) >= 90
    });
  } catch (error) {
    logger.error('Akıllı eşleştirme hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fatura kalemlerini akıllı eşleştirmeyle getir (YENİ - GELİŞTİRİLMİŞ)
router.get('/faturalar/:ettn/akilli-kalemler', async (req, res) => {
  try {
    const { ettn } = req.params;
    
    // Uyumsoft API'ye bağlan
    faturaService.initClient();
    
    // Fatura XML'ini çek
    const invoiceData = await faturaService.client.getInboxInvoiceData(ettn);
    
    if (!invoiceData.success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Fatura detayı alınamadı' 
      });
    }
    
    // Base64 decode ve XML parse
    const xmlBuffer = Buffer.from(invoiceData.xmlBase64, 'base64');
    const xmlString = xmlBuffer.toString('utf-8');
    
    const parsed = await parseStringPromise(xmlString, {
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [(name) => name.replace(/^.*:/, '')]
    });
    
    const invoice = parsed.Invoice;
    
    if (!invoice) {
      return res.status(400).json({ 
        success: false, 
        error: 'Fatura XML parse edilemedi' 
      });
    }
    
    // Fatura bilgileri
    const tedarikciVkn = invoice.AccountingSupplierParty?.Party?.PartyIdentification?.ID?.['_'] || 
                         invoice.AccountingSupplierParty?.Party?.PartyIdentification?.ID || '';
    const faturaInfo = {
      fatura_no: invoice.ID?.['_'] || invoice.ID,
      tarih: invoice.IssueDate,
      toplam_tutar: parseFloat(invoice.LegalMonetaryTotal?.PayableAmount?.['_'] || invoice.LegalMonetaryTotal?.PayableAmount || 0),
      gonderen: invoice.AccountingSupplierParty?.Party?.PartyName?.Name || tedarikciVkn,
      gonderen_vkn: tedarikciVkn
    };
    
    // Kalemleri çıkar
    let invoiceLines = invoice.InvoiceLine;
    if (!Array.isArray(invoiceLines)) {
      invoiceLines = invoiceLines ? [invoiceLines] : [];
    }
    
    const kalemler = await Promise.all(invoiceLines.map(async (line, index) => {
      const item = line.Item || {};
      const price = line.Price || {};
      const urunKodu = item.SellersItemIdentification?.ID?.['_'] || item.SellersItemIdentification?.ID || '';
      const urunAdi = item.Name || 'Bilinmiyor';
      const ublBirim = line.InvoicedQuantity?.['$']?.unitCode || 'C62';
      const miktar = parseFloat(line.InvoicedQuantity?.['_'] || line.InvoicedQuantity || 0);
      const birimFiyat = parseFloat(price.PriceAmount?.['_'] || price.PriceAmount || 0);
      
      // Birim dönüşümü
      const birimSonuc = await donusturBirim(ublBirim, miktar);
      
      // Akıllı eşleştirme (PostgreSQL fonksiyonu)
      const eslestirmeResult = await query(`
        SELECT * FROM akilli_stok_eslestir($1, $2, $3)
        ORDER BY guven_skoru DESC
        LIMIT 3
      `, [urunAdi, urunKodu || null, tedarikciVkn || null]);
      
      const enIyiEslesme = eslestirmeResult.rows[0] || null;
      const guvenSkoru = enIyiEslesme ? parseFloat(enIyiEslesme.guven_skoru) : 0;
      
      // Fiyat anomali kontrolü (eğer eşleşme varsa)
      let anomali = null;
      if (enIyiEslesme && birimFiyat > 0) {
        try {
          const anomaliResult = await query(`
            SELECT * FROM kontrol_fiyat_anomali($1, $2, 30)
          `, [enIyiEslesme.stok_kart_id, birimFiyat]);
          
          if (anomaliResult.rows[0]?.anomali_var) {
            anomali = {
              var: true,
              onceki_fiyat: parseFloat(anomaliResult.rows[0].onceki_fiyat),
              degisim_yuzde: parseFloat(anomaliResult.rows[0].fiyat_degisim_yuzde),
              aciklama: anomaliResult.rows[0].aciklama
            };
          }
        } catch (anomaliErr) {
          logger.warn('Anomali kontrolü atlandı', { error: anomaliErr.message });
        }
      }
      
      return {
        sira: index + 1,
        urun_adi: urunAdi,
        urun_kodu: urunKodu,
        // Orijinal değerler
        orijinal_miktar: miktar,
        orijinal_birim: ublBirim,
        orijinal_birim_fiyat: birimFiyat,
        // Dönüştürülmüş değerler
        miktar: birimSonuc.miktar,
        birim: birimSonuc.birim_ad,
        birim_kod: birimSonuc.birim_kod,
        birim_donusturuldu: birimSonuc.donusturuldu,
        birim_fiyat: birimSonuc.donusturuldu ? (birimFiyat / birimSonuc.miktar * miktar) : birimFiyat,
        tutar: parseFloat(line.LineExtensionAmount?.['_'] || line.LineExtensionAmount || 0),
        kdv_orani: parseFloat(line.TaxTotal?.TaxSubtotal?.TaxCategory?.Percent || 0),
        kdv_tutar: parseFloat(line.TaxTotal?.TaxAmount?.['_'] || line.TaxTotal?.TaxAmount || 0),
        // Akıllı eşleştirme sonuçları
        eslesme: enIyiEslesme ? {
          stok_kart_id: enIyiEslesme.stok_kart_id,
          stok_kodu: enIyiEslesme.stok_kodu,
          stok_adi: enIyiEslesme.stok_adi,
          guven_skoru: guvenSkoru,
          eslestirme_yontemi: enIyiEslesme.eslestirme_yontemi,
          otomatik_onay: guvenSkoru >= 90
        } : null,
        alternatif_eslesmeler: eslestirmeResult.rows.slice(1),
        anomali: anomali
      };
    }));
    
    // Özet istatistikler
    const otomatikOnaylilar = kalemler.filter(k => k.eslesme?.otomatik_onay);
    const manuelGerekli = kalemler.filter(k => !k.eslesme?.otomatik_onay);
    const anomaliler = kalemler.filter(k => k.anomali?.var);
    
    res.json({
      success: true,
      fatura: faturaInfo,
      kalemler: kalemler,
      ozet: {
        toplam_kalem: kalemler.length,
        otomatik_onay: otomatikOnaylilar.length,
        manuel_gereken: manuelGerekli.length,
        anomali_sayisi: anomaliler.length,
        tum_otomatik: otomatikOnaylilar.length === kalemler.length && anomaliler.length === 0
      }
    });
    
  } catch (error) {
    logger.error('Akıllı fatura kalem hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu fatura işleme (birden fazla fatura)
router.post('/toplu-fatura-isle', authenticate, async (req, res) => {
  try {
    const { fatura_ettnler, depo_id, sadece_otomatik = false } = req.body;
    
    if (!fatura_ettnler || fatura_ettnler.length === 0 || !depo_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Fatura ETTN listesi ve depo ID zorunludur' 
      });
    }
    
    // Toplu işlem kaydı oluştur
    const topluIslemResult = await query(`
      INSERT INTO toplu_fatura_islem (isleyen_kullanici_id, toplam_fatura, durum)
      VALUES ($1, $2, 'isleniyor')
      RETURNING id
    `, [req.user?.id || null, fatura_ettnler.length]);
    
    const topluIslemId = topluIslemResult.rows[0].id;
    
    let basarili = 0;
    let hatali = 0;
    let toplamKalem = 0;
    let otomatikEslesen = 0;
    let manuelGereken = 0;
    const sonuclar = [];
    
    for (const ettn of fatura_ettnler) {
      try {
        // Daha önce işlenmiş mi kontrol et
        const mevcutIslem = await query(
          'SELECT id FROM fatura_stok_islem WHERE ettn = $1',
          [ettn]
        );
        
        if (mevcutIslem.rows.length > 0) {
          sonuclar.push({ ettn, durum: 'zaten_islenmis' });
          continue;
        }
        
        // Akıllı kalemler endpoint'ini kullanarak kalemleri al
        // (Bu kısım ayrı fonksiyona çıkarılabilir)
        faturaService.initClient();
        const invoiceData = await faturaService.client.getInboxInvoiceData(ettn);
        
        if (!invoiceData.success) {
          sonuclar.push({ ettn, durum: 'fatura_alinamadi', hata: 'API hatası' });
          hatali++;
          continue;
        }
        
        const xmlBuffer = Buffer.from(invoiceData.xmlBase64, 'base64');
        const xmlString = xmlBuffer.toString('utf-8');
        const parsed = await parseStringPromise(xmlString, {
          explicitArray: false,
          ignoreAttrs: false,
          tagNameProcessors: [(name) => name.replace(/^.*:/, '')]
        });
        
        const invoice = parsed.Invoice;
        if (!invoice) {
          sonuclar.push({ ettn, durum: 'parse_hatasi' });
          hatali++;
          continue;
        }
        
        const tedarikciVkn = invoice.AccountingSupplierParty?.Party?.PartyIdentification?.ID?.['_'] || '';
        const tedarikci = invoice.AccountingSupplierParty?.Party?.PartyName?.Name || tedarikciVkn;
        
        let invoiceLines = invoice.InvoiceLine;
        if (!Array.isArray(invoiceLines)) {
          invoiceLines = invoiceLines ? [invoiceLines] : [];
        }
        
        const islenecekKalemler = [];
        let faturaOtomatik = 0;
        let faturaManuel = 0;
        
        for (let i = 0; i < invoiceLines.length; i++) {
          const line = invoiceLines[i];
          const item = line.Item || {};
          const price = line.Price || {};
          const urunKodu = item.SellersItemIdentification?.ID?.['_'] || item.SellersItemIdentification?.ID || '';
          const urunAdi = item.Name || 'Bilinmiyor';
          const ublBirim = line.InvoicedQuantity?.['$']?.unitCode || 'C62';
          const miktar = parseFloat(line.InvoicedQuantity?.['_'] || line.InvoicedQuantity || 0);
          const birimFiyat = parseFloat(price.PriceAmount?.['_'] || price.PriceAmount || 0);
          
          // Birim dönüşümü
          const birimSonuc = await donusturBirim(ublBirim, miktar);
          
          // Akıllı eşleştirme
          const eslestirmeResult = await query(`
            SELECT * FROM akilli_stok_eslestir($1, $2, $3)
            ORDER BY guven_skoru DESC
            LIMIT 1
          `, [urunAdi, urunKodu || null, tedarikciVkn || null]);
          
          const eslesme = eslestirmeResult.rows[0];
          const guvenSkoru = eslesme ? parseFloat(eslesme.guven_skoru) : 0;
          
          if (eslesme && guvenSkoru >= 90) {
            // Fiyat anomali kontrolü
            let anomaliVar = false;
            try {
              const anomaliResult = await query(`
                SELECT * FROM kontrol_fiyat_anomali($1, $2, 30)
              `, [eslesme.stok_kart_id, birimFiyat]);
              anomaliVar = anomaliResult.rows[0]?.anomali_var;
            } catch (anomaliErr) {
              logger.warn('Anomali kontrolü atlandı', { error: anomaliErr.message });
            }
            
            // Anomali yoksa veya sadece_otomatik=false ise işle
            if (!anomaliVar || !sadece_otomatik) {
              islenecekKalemler.push({
                kalem_sira: i + 1,
                stok_kart_id: eslesme.stok_kart_id,
                miktar: birimSonuc.miktar,
                birim_fiyat: birimFiyat,
                urun_kodu: urunKodu,
                urun_adi: urunAdi,
                guven_skoru: guvenSkoru,
                eslestirme_yontemi: eslesme.eslestirme_yontemi,
                anomali: anomaliVar ? anomaliResult.rows[0].aciklama : null
              });
              faturaOtomatik++;
            } else {
              faturaManuel++;
            }
          } else {
            faturaManuel++;
          }
        }
        
        toplamKalem += invoiceLines.length;
        otomatikEslesen += faturaOtomatik;
        manuelGereken += faturaManuel;
        
        // Eğer sadece_otomatik=true ve manuel gereken varsa atla
        if (sadece_otomatik && faturaManuel > 0) {
          sonuclar.push({ 
            ettn, 
            durum: 'manuel_gereken', 
            otomatik: faturaOtomatik, 
            manuel: faturaManuel 
          });
          continue;
        }
        
        // İşlenecek kalem yoksa atla
        if (islenecekKalemler.length === 0) {
          sonuclar.push({ ettn, durum: 'eslesme_yok' });
          continue;
        }
        
        // Fatura bilgisini al
        const faturaResult = await query(
          'SELECT id FROM uyumsoft_invoices WHERE ettn = $1',
          [ettn]
        );
        const faturaId = faturaResult.rows[0]?.id;
        
        let toplamTutar = 0;
        
        // Her kalem için stok girişi yap - YENİ SİSTEM: urun_hareketleri (trigger otomatik günceller)
        for (const kalem of islenecekKalemler) {
          // urun_kart_id veya stok_kart_id kabul et (geriye uyumluluk)
          const urunKartId = kalem.urun_kart_id || kalem.stok_kart_id;

          // Stok hareketi oluştur
          await query(`
            INSERT INTO urun_hareketleri (
              urun_kart_id, hedef_depo_id, hareket_tipi, miktar,
              birim_fiyat, belge_no, aciklama, fatura_ettn, fatura_kalem_sira, belge_tarihi
            ) VALUES ($1, $2, 'GIRIS', $3, $4, $5, $6, $7, $8, CURRENT_DATE)
          `, [
            urunKartId,
            depo_id,
            kalem.miktar,
            kalem.birim_fiyat || 0,
            `FAT-${ettn.substring(0, 8)}`,
            `${tedarikci} faturasından otomatik giriş`,
            ettn,
            kalem.kalem_sira
          ]);

          // Fiyat geçmişine kaydet - YENİ SİSTEM: urun_kartlari
          const oncekiFiyatResult = await query(
            'SELECT son_alis_fiyati FROM urun_kartlari WHERE id = $1',
            [urunKartId]
          );
          const oncekiFiyat = oncekiFiyatResult.rows[0]?.son_alis_fiyati || 0;

          await query(`
            INSERT INTO urun_fiyat_gecmisi (
              urun_kart_id, tedarikci_vkn, tedarikci_ad, fatura_ettn, fatura_tarihi,
              fiyat, miktar, onceki_fiyat, fiyat_degisim_orani, anomali_var, anomali_aciklama
            ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, $10)
          `, [
            urunKartId,
            tedarikciVkn,
            tedarikci,
            ettn,
            kalem.birim_fiyat,
            kalem.miktar,
            oncekiFiyat,
            oncekiFiyat > 0 ? ((kalem.birim_fiyat - oncekiFiyat) / oncekiFiyat * 100) : 0,
            !!kalem.anomali,
            kalem.anomali
          ]);

          // Ürün kartı fiyatını güncelle - YENİ SİSTEM: urun_kartlari
          await query(`
            UPDATE urun_kartlari
            SET son_alis_fiyati = $1, updated_at = NOW()
            WHERE id = $2
          `, [kalem.birim_fiyat || 0, urunKartId]);
          
          // Eşleştirme geçmişine ekle
          if (kalem.urun_kodu || kalem.urun_adi) {
            await query(`
              INSERT INTO fatura_urun_eslestirme (tedarikci_urun_kodu, tedarikci_urun_adi, stok_kart_id, tedarikci_vkn, guven_skoru, eslestirme_yontemi, otomatik_onay)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (tedarikci_urun_kodu, stok_kart_id) 
              DO UPDATE SET eslestirme_sayisi = fatura_urun_eslestirme.eslestirme_sayisi + 1,
                            son_eslestirme = NOW(),
                            guven_skoru = GREATEST(fatura_urun_eslestirme.guven_skoru, $5)
            `, [kalem.urun_kodu || '', kalem.urun_adi || '', kalem.stok_kart_id, tedarikciVkn, kalem.guven_skoru, kalem.eslestirme_yontemi, true]);
          }
          
          toplamTutar += (kalem.miktar * (kalem.birim_fiyat || 0));
        }
        
        // Fatura işlem kaydı
        await query(`
          INSERT INTO fatura_stok_islem (
            uyumsoft_invoice_id, ettn, depo_id, toplam_kalem, toplam_tutar, notlar
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [faturaId, ettn, depo_id, islenecekKalemler.length, toplamTutar, 'Toplu işlem ile otomatik']);
        
        basarili++;
        sonuclar.push({ 
          ettn, 
          durum: 'basarili', 
          kalem_sayisi: islenecekKalemler.length,
          toplam_tutar: toplamTutar
        });
        
      } catch (faturaError) {
        logger.error(`Fatura işleme hatası (${ettn})`, { error: faturaError.message, stack: faturaError.stack, ettn });
        hatali++;
        sonuclar.push({ ettn, durum: 'hata', hata: faturaError.message });
      }
    }
    
    // Toplu işlem kaydını güncelle
    await query(`
      UPDATE toplu_fatura_islem
      SET basarili_fatura = $1, hatali_fatura = $2, toplam_kalem = $3,
          otomatik_eslesen = $4, manuel_gereken = $5, durum = 'tamamlandi',
          sonuc_ozeti = $6
      WHERE id = $7
    `, [basarili, hatali, toplamKalem, otomatikEslesen, manuelGereken, JSON.stringify(sonuclar), topluIslemId]);
    
    res.json({
      success: true,
      message: `${basarili} fatura başarıyla işlendi`,
      ozet: {
        toplam_fatura: fatura_ettnler.length,
        basarili,
        hatali,
        toplam_kalem: toplamKalem,
        otomatik_eslesen: otomatikEslesen,
        manuel_gereken: manuelGereken
      },
      sonuclar
    });
    
  } catch (error) {
    logger.error('Toplu fatura işleme hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// İşlenmemiş faturaları listele (detaylı - toplu işlem için)
router.get('/faturalar/islenmemis', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await query(
      `
      SELECT 
        ui.id,
        ui.ettn,
        ui.invoice_no,
        ui.sender_name,
        ui.sender_vkn,
        ui.invoice_date,
        ui.payable_amount
      FROM uyumsoft_invoices ui
      LEFT JOIN fatura_stok_islem fsi ON fsi.ettn = ui.ettn
      WHERE ui.invoice_type LIKE '%incoming%'
        AND ui.invoice_date > NOW() - INTERVAL '3 months'
        AND fsi.id IS NULL
      ORDER BY ui.invoice_date DESC
      LIMIT $1
    `,
      [limit]
    );

    const rows = result.rows;
    const ettnList = rows.map((r) => r.ettn);
    const kalemSayilari = ettnList.length ? await faturaKalemleriClient.getKalemSayilari(ettnList) : {};

    const data = rows.map((r) => ({ ...r, kalem_sayisi: kalemSayilari[r.ettn] ?? 0 }));

    res.json({
      success: true,
      data,
      toplam: data.length
    });
  } catch (error) {
    logger.error('İşlenmemiş fatura listesi hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fiyat anomali raporu - YENİ SİSTEM: urun_fiyat_gecmisi + urun_kartlari
router.get('/fiyat-anomaliler', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await query(`
      SELECT
        ufg.*,
        uk.kod as stok_kodu,
        uk.ad as stok_adi,
        uk.son_alis_fiyati as guncel_fiyat
      FROM urun_fiyat_gecmisi ufg
      JOIN urun_kartlari uk ON uk.id = ufg.urun_kart_id
      WHERE ufg.anomali_var = true
      ORDER BY ufg.created_at DESC
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      data: result.rows,
      toplam: result.rows.length
    });
  } catch (error) {
    logger.error('Fiyat anomali raporu hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
