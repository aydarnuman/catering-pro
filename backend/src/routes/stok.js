import express from 'express';
import { query } from '../database.js';
import { authenticate, requirePermission, auditLog } from '../middleware/auth.js';

const router = express.Router();

// NOT: GET route'ları herkese açık, POST/PUT/DELETE route'ları authentication gerektirir

// =============================================
// DEPO YÖNETİMİ
// =============================================

// Tüm depoları listele (özet bilgilerle)
router.get('/depolar', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        d.*,
        COUNT(DISTINCT sd.stok_kart_id) as urun_sayisi,
        COALESCE(SUM(sd.miktar * sk.son_alis_fiyat), 0) as toplam_deger,
        SUM(CASE WHEN sd.miktar <= sk.kritik_stok THEN 1 ELSE 0 END) as kritik_urun
      FROM depolar d
      LEFT JOIN stok_depo_durumlari sd ON sd.depo_id = d.id
      LEFT JOIN stok_kartlari sk ON sk.id = sd.stok_kart_id
      WHERE d.aktif = true
      GROUP BY d.id
      ORDER BY d.kod
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Depo listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Depo lokasyonlarını getir
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
        COUNT(DISTINCT sd.stok_kart_id) as urun_sayisi,
        COALESCE(SUM(sd.miktar * sk.son_alis_fiyat), 0) as toplam_deger
      FROM depo_lokasyonlar dl
      LEFT JOIN stok_depo_durumlari sd ON sd.lokasyon_id = dl.id
      LEFT JOIN stok_kartlari sk ON sk.id = sd.stok_kart_id
      WHERE dl.depo_id = $1 AND dl.aktif = true
      GROUP BY dl.id, dl.kod, dl.ad, dl.tur, dl.sicaklik_min, dl.sicaklik_max
      ORDER BY dl.kod
    `, [depoId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Lokasyon listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Belirli bir lokasyonun stoklarını getir
router.get('/lokasyonlar/:lokasyonId/stoklar', async (req, res) => {
  try {
    const { lokasyonId } = req.params;
    const { arama } = req.query;
    
    let whereConditions = ['sd.lokasyon_id = $1', 'sd.miktar > 0'];
    let queryParams = [lokasyonId];
    
    if (arama) {
      whereConditions.push('(sk.ad ILIKE $2 OR sk.kod ILIKE $2)');
      queryParams.push(`%${arama}%`);
    }
    
    const result = await query(`
      SELECT 
        sk.id,
        sk.kod,
        sk.ad,
        sk.barkod,
        k.ad as kategori,
        b.kisa_ad as birim,
        sd.miktar,
        sd.rezerve_miktar,
        sd.kullanilabilir,
        dl.ad as lokasyon,
        dl.tur as lokasyon_tur,
        sk.min_stok,
        sk.max_stok,
        sk.kritik_stok,
        sk.son_alis_fiyat,
        (sd.miktar * sk.son_alis_fiyat) as stok_deger,
        CASE 
          WHEN sd.miktar = 0 THEN 'tukendi'
          WHEN sd.miktar <= sk.kritik_stok THEN 'kritik'
          WHEN sd.miktar <= sk.min_stok THEN 'dusuk'
          WHEN sd.miktar >= sk.max_stok THEN 'fazla'
          ELSE 'normal'
        END as durum
      FROM stok_depo_durumlari sd
      JOIN stok_kartlari sk ON sk.id = sd.stok_kart_id
      JOIN depo_lokasyonlar dl ON dl.id = sd.lokasyon_id
      LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
      LEFT JOIN birimler b ON b.id = sk.ana_birim_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY sk.kod
    `, queryParams);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Lokasyon stok listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Belirli bir deponun stoklarını getir
router.get('/depolar/:depoId/stoklar', async (req, res) => {
  try {
    const { depoId } = req.params;
    const { kritik, kategori, arama } = req.query;
    
    let whereConditions = ['sd.depo_id = $1'];
    let queryParams = [depoId];
    let paramIndex = 2;
    
    // Kritik stok filtresi
    if (kritik === 'true') {
      whereConditions.push('sd.miktar <= sk.kritik_stok');
    }
    
    // Kategori filtresi
    if (kategori) {
      whereConditions.push(`k.kod = $${paramIndex}`);
      queryParams.push(kategori);
      paramIndex++;
    }
    
    // Arama filtresi
    if (arama) {
      whereConditions.push(`(sk.ad ILIKE $${paramIndex} OR sk.kod ILIKE $${paramIndex})`);
      queryParams.push(`%${arama}%`);
      paramIndex++;
    }
    
    const result = await query(`
      SELECT 
        sk.id,
        sk.kod,
        sk.ad,
        sk.barkod,
        k.ad as kategori,
        b.kisa_ad as birim,
        sd.miktar as toplam_stok,
        sd.rezerve_miktar as rezerve_stok,
        sd.kullanilabilir as kullanilabilir_stok,
        sd.lokasyon_kodu,
        sk.min_stok,
        sk.max_stok,
        sk.kritik_stok,
        sk.son_alis_fiyat,
        (sd.miktar * sk.son_alis_fiyat) as stok_deger,
        CASE 
          WHEN sd.miktar = 0 THEN 'tukendi'
          WHEN sd.miktar <= sk.kritik_stok THEN 'kritik'
          WHEN sd.miktar <= sk.min_stok THEN 'dusuk'
          WHEN sd.miktar >= sk.max_stok THEN 'fazla'
          ELSE 'normal'
        END as durum,
        d.ad as depo_ad,
        d.kod as depo_kod
      FROM stok_depo_durumlari sd
      JOIN stok_kartlari sk ON sk.id = sd.stok_kart_id
      JOIN depolar d ON d.id = sd.depo_id
      LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
      LEFT JOIN birimler b ON b.id = sk.ana_birim_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY sk.kod
    `, queryParams);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Depo stok listesi hatası:', error);
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
    console.error('Depo karşılaştırma hatası:', error);
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
    console.error('Depo ekleme hatası:', error);
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
    console.error('Depo güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Depo sil (soft delete)
router.delete('/depolar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Stok kontrolü
    const stokKontrol = await query(`
      SELECT COUNT(*) as count 
      FROM stok_depo_durumlari 
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
    console.error('Depo silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// STOK KARTLARI
// =============================================

// Tüm stok kartlarını listele
router.get('/kartlar', async (req, res) => {
  try {
    const { kategori, depo, kritik, arama, limit = 100, offset = 0 } = req.query;
    
    let whereConditions = ['sk.aktif = true'];
    let queryParams = [];
    let paramIndex = 1;
    
    if (kategori) {
      whereConditions.push(`k.kod = $${paramIndex}`);
      queryParams.push(kategori);
      paramIndex++;
    }
    
    if (kritik === 'true') {
      whereConditions.push('sk.toplam_stok <= sk.kritik_stok');
    }
    
    if (arama) {
      whereConditions.push(`(sk.ad ILIKE $${paramIndex} OR sk.kod ILIKE $${paramIndex} OR sk.barkod ILIKE $${paramIndex})`);
      queryParams.push(`%${arama}%`);
      paramIndex++;
    }
    
    // Depo filtresi varsa join ekle
    let depoJoin = '';
    if (depo) {
      depoJoin = 'JOIN stok_depo_durumlari sd ON sd.stok_kart_id = sk.id';
      whereConditions.push(`sd.depo_id = $${paramIndex}`);
      queryParams.push(depo);
      paramIndex++;
    }
    
    // Limit ve offset parametreleri için indeksler
    const limitIndex = paramIndex;
    const offsetIndex = paramIndex + 1;
    queryParams.push(limit, offset);
    
    const result = await query(`
      SELECT DISTINCT
        sk.id,
        sk.kod,
        sk.barkod,
        sk.ad,
        k.ad as kategori,
        b.kisa_ad as birim,
        sk.toplam_stok,
        sk.rezerve_stok,
        sk.kullanilabilir_stok,
        sk.min_stok,
        sk.max_stok,
        sk.kritik_stok,
        sk.son_alis_fiyat,
        sk.ortalama_maliyet,
        (sk.toplam_stok * sk.son_alis_fiyat) as stok_deger,
        c.unvan as tedarikci,
        sk.tedarik_suresi,
        CASE 
          WHEN sk.toplam_stok = 0 THEN 'tukendi'
          WHEN sk.toplam_stok <= sk.kritik_stok THEN 'kritik'
          WHEN sk.toplam_stok <= sk.min_stok THEN 'dusuk'
          WHEN sk.toplam_stok >= sk.max_stok THEN 'fazla'
          ELSE 'normal'
        END as durum
      FROM stok_kartlari sk
      ${depoJoin}
      LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
      LEFT JOIN birimler b ON b.id = sk.ana_birim_id
      LEFT JOIN cariler c ON c.id = sk.varsayilan_tedarikci_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY sk.kod
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `, queryParams);
    
    // Toplam sayı (limit ve offset olmadan)
    const countParams = queryParams.slice(0, -2); // limit ve offset'i çıkar
    const countResult = await query(`
      SELECT COUNT(DISTINCT sk.id) as total
      FROM stok_kartlari sk
      ${depoJoin}
      LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
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
    console.error('Stok kartları listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek bir stok kartının detayları (tüm depolardaki durumu ile)
// Stok kartını sil
router.delete('/kartlar/:id', authenticate, requirePermission('stok', 'delete'), auditLog('stok'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Bu stok kartına ait fatura ETTN'lerini al
    const faturaEttnResult = await query(
      'SELECT DISTINCT fatura_ettn FROM stok_hareketleri WHERE stok_kart_id = $1 AND fatura_ettn IS NOT NULL',
      [id]
    );
    const faturaEttnler = faturaEttnResult.rows.map(r => r.fatura_ettn);
    
    // Stok hareketlerini sil
    await query('DELETE FROM stok_hareketleri WHERE stok_kart_id = $1', [id]);
    
    // Depo durumlarını sil
    await query('DELETE FROM stok_depo_durumlari WHERE stok_kart_id = $1', [id]);
    
    // Fatura ürün eşleştirmelerini sil
    await query('DELETE FROM fatura_urun_eslestirme WHERE stok_kart_id = $1', [id]);
    
    // Her fatura için kontrol et - başka ürün kaldı mı?
    for (const ettn of faturaEttnler) {
      const kalanHareket = await query(
        'SELECT COUNT(*) as sayi FROM stok_hareketleri WHERE fatura_ettn = $1',
        [ettn]
      );
      
      // Başka ürün kalmadıysa fatura işlem kaydını sil
      if (parseInt(kalanHareket.rows[0].sayi) === 0) {
        await query('DELETE FROM fatura_stok_islem WHERE ettn = $1', [ettn]);
      } else {
        // Kalan ürün sayısını güncelle
        await query(
          'UPDATE fatura_stok_islem SET toplam_kalem = $1 WHERE ettn = $2',
          [parseInt(kalanHareket.rows[0].sayi), ettn]
        );
      }
    }
    
    // Stok kartını pasif et ve kodunu değiştir (soft delete)
    const result = await query(`
      UPDATE stok_kartlari
      SET aktif = false, 
          kod = kod || '_SILINDI_' || id,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stok kartı bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Stok kartı silindi',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Stok silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok detayını getir
router.get('/kartlar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Stok kartı bilgileri
    const kartResult = await query(`
      SELECT 
        sk.*,
        k.ad as kategori_ad,
        b.ad as birim_ad,
        b.kisa_ad as birim_kisa,
        c.unvan as tedarikci_unvan
      FROM stok_kartlari sk
      LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
      LEFT JOIN birimler b ON b.id = sk.ana_birim_id
      LEFT JOIN cariler c ON c.id = sk.varsayilan_tedarikci_id
      WHERE sk.id = $1
    `, [id]);
    
    if (kartResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stok kartı bulunamadı' });
    }
    
    // Depo durumları
    const depoResult = await query(`
      SELECT 
        d.id as depo_id,
        d.kod as depo_kod,
        d.ad as depo_ad,
        d.tip as depo_tip,
        sd.miktar,
        sd.rezerve_miktar,
        sd.kullanilabilir,
        sd.lokasyon_kodu,
        sd.min_stok as depo_min_stok,
        sd.max_stok as depo_max_stok
      FROM stok_depo_durumlari sd
      JOIN depolar d ON d.id = sd.depo_id
      WHERE sd.stok_kart_id = $1
      ORDER BY d.kod
    `, [id]);
    
    // Son hareketler
    const hareketResult = await query(`
      SELECT 
        h.*,
        d1.ad as giris_depo_ad,
        d2.ad as cikis_depo_ad,
        c.unvan as cari_unvan
      FROM stok_hareketleri h
      LEFT JOIN depolar d1 ON d1.id = h.giris_depo_id
      LEFT JOIN depolar d2 ON d2.id = h.cikis_depo_id
      LEFT JOIN cariler c ON c.id = h.cari_id
      WHERE h.stok_kart_id = $1
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
    console.error('Stok kartı detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni stok kartı oluştur
router.post('/kartlar', authenticate, requirePermission('stok', 'create'), auditLog('stok'), async (req, res) => {
  try {
    const {
      kod, ad, barkod, kategori_id, ana_birim_id,
      min_stok, max_stok, kritik_stok, optimum_stok,
      son_alis_fiyat, kdv_orani, varsayilan_tedarikci_id,
      raf_omru_var, raf_omru_gun, aciklama
    } = req.body;
    
    const result = await query(`
      INSERT INTO stok_kartlari (
        kod, ad, barkod, kategori_id, ana_birim_id,
        min_stok, max_stok, kritik_stok, optimum_stok,
        son_alis_fiyat, kdv_orani, varsayilan_tedarikci_id,
        raf_omru_var, raf_omru_gun, aciklama
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [kod, ad, barkod, kategori_id, ana_birim_id,
        min_stok || 0, max_stok || 99999, kritik_stok || 0, optimum_stok || 0,
        son_alis_fiyat || 0, kdv_orani || 18, varsayilan_tedarikci_id,
        raf_omru_var || false, raf_omru_gun, aciklama]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Stok kartı başarıyla oluşturuldu'
    });
  } catch (error) {
    console.error('Stok kartı oluşturma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// STOK HAREKETLERİ
// =============================================

// Stok hareketleri listesi
router.get('/hareketler', async (req, res) => {
  try {
    const { limit = 100, offset = 0, stok_kart_id, depo_id, hareket_tipi } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (stok_kart_id) {
      whereConditions.push(`h.stok_kart_id = $${paramIndex}`);
      queryParams.push(stok_kart_id);
      paramIndex++;
    }
    
    if (depo_id) {
      whereConditions.push(`(h.giris_depo_id = $${paramIndex} OR h.cikis_depo_id = $${paramIndex})`);
      queryParams.push(depo_id);
      paramIndex++;
    }
    
    if (hareket_tipi) {
      whereConditions.push(`h.hareket_tipi = $${paramIndex}`);
      queryParams.push(hareket_tipi);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    queryParams.push(limit, offset);
    
    const result = await query(`
      SELECT 
        h.*,
        sk.kod as stok_kod,
        sk.ad as stok_ad,
        d1.ad as giris_depo_ad,
        d2.ad as cikis_depo_ad,
        b.kisa_ad as birim
      FROM stok_hareketleri h
      LEFT JOIN stok_kartlari sk ON sk.id = h.stok_kart_id
      LEFT JOIN depolar d1 ON d1.id = h.giris_depo_id
      LEFT JOIN depolar d2 ON d2.id = h.cikis_depo_id
      LEFT JOIN birimler b ON b.id = sk.ana_birim_id
      ${whereClause}
      ORDER BY h.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, queryParams);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Stok hareketleri listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok girişi
router.post('/hareketler/giris', async (req, res) => {
  try {
    const {
      stok_kart_id, depo_id, miktar, birim_fiyat,
      belge_no, belge_tarihi, cari_id, aciklama,
      lot_no, son_kullanma_tarihi
    } = req.body;
    
    // Önceki stok miktarını al
    const oncekiStok = await query(
      'SELECT miktar FROM stok_depo_durumlari WHERE stok_kart_id = $1 AND depo_id = $2',
      [stok_kart_id, depo_id]
    );
    
    const onceki_miktar = oncekiStok.rows[0]?.miktar || 0;
    
    // Hareketi kaydet
    const result = await query(`
      INSERT INTO stok_hareketleri (
        stok_kart_id, hareket_tipi, miktar, birim_fiyat,
        giris_depo_id, belge_tipi, belge_no, belge_tarihi,
        cari_id, lot_no, son_kullanma_tarihi,
        onceki_stok, sonraki_stok, aciklama,
        created_by
      ) VALUES (
        $1, 'GIRIS', $2, $3, $4, 'FATURA', $5, $6, $7, $8, $9,
        $10, $11, $12, 'API'
      ) RETURNING *
    `, [stok_kart_id, miktar, birim_fiyat, depo_id, 
        belge_no, belge_tarihi, cari_id, lot_no, son_kullanma_tarihi,
        onceki_miktar, onceki_miktar + parseFloat(miktar), aciklama]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `${miktar} birim stok girişi yapıldı`
    });
  } catch (error) {
    console.error('Stok giriş hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok çıkışı
router.post('/hareketler/cikis', async (req, res) => {
  try {
    const {
      stok_kart_id, depo_id, miktar,
      belge_no, belge_tarihi, aciklama
    } = req.body;
    
    // Mevcut stok kontrolü
    const mevcutStok = await query(
      'SELECT miktar, kullanilabilir FROM stok_depo_durumlari WHERE stok_kart_id = $1 AND depo_id = $2',
      [stok_kart_id, depo_id]
    );
    
    if (!mevcutStok.rows[0] || mevcutStok.rows[0].kullanilabilir < miktar) {
      return res.status(400).json({ 
        success: false, 
        error: 'Yetersiz stok! Kullanılabilir: ' + (mevcutStok.rows[0]?.kullanilabilir || 0)
      });
    }
    
    const onceki_miktar = mevcutStok.rows[0].miktar;
    
    // Hareketi kaydet
    const result = await query(`
      INSERT INTO stok_hareketleri (
        stok_kart_id, hareket_tipi, miktar,
        cikis_depo_id, belge_tipi, belge_no, belge_tarihi,
        onceki_stok, sonraki_stok, aciklama, created_by
      ) VALUES (
        $1, 'CIKIS', $2, $3, 'FIS', $4, $5,
        $6, $7, $8, 'API'
      ) RETURNING *
    `, [stok_kart_id, miktar, depo_id, belge_no, belge_tarihi,
        onceki_miktar, onceki_miktar - parseFloat(miktar), aciklama]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `${miktar} birim stok çıkışı yapıldı`
    });
  } catch (error) {
    console.error('Stok çıkış hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Depolar arası transfer
router.post('/hareketler/transfer', async (req, res) => {
  try {
    const {
      stok_kart_id, kaynak_depo_id, hedef_depo_id, miktar,
      belge_no, belge_tarihi, aciklama
    } = req.body;
    
    // Kaynak depo stok kontrolü
    const kaynakStok = await query(
      'SELECT miktar, kullanilabilir FROM stok_depo_durumlari WHERE stok_kart_id = $1 AND depo_id = $2',
      [stok_kart_id, kaynak_depo_id]
    );
    
    if (!kaynakStok.rows[0] || kaynakStok.rows[0].kullanilabilir < miktar) {
      return res.status(400).json({ 
        success: false, 
        error: 'Kaynak depoda yetersiz stok!'
      });
    }
    
    // Transfer hareketini kaydet
    const result = await query(`
      INSERT INTO stok_hareketleri (
        stok_kart_id, hareket_tipi, miktar,
        cikis_depo_id, giris_depo_id,
        belge_tipi, belge_no, belge_tarihi,
        aciklama, created_by
      ) VALUES (
        $1, 'TRANSFER', $2, $3, $4,
        'TRANSFER', $5, $6, $7, 'API'
      ) RETURNING *
    `, [stok_kart_id, miktar, kaynak_depo_id, hedef_depo_id,
        belge_no, belge_tarihi, aciklama]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `${miktar} birim transfer yapıldı`
    });
  } catch (error) {
    console.error('Transfer hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// RAPORLAR
// =============================================

// Kritik stoklar
router.get('/kritik', async (req, res) => {
  try {
    const { depo_id } = req.query;
    
    let whereClause = '';
    let params = [];
    
    if (depo_id) {
      whereClause = 'WHERE depo_id = $1';
      params = [depo_id];
    }
    
    const result = await query(`
      SELECT 
        k.*,
        d.ad as depo_ad
      FROM v_kritik_stoklar k
      LEFT JOIN depolar d ON d.id = k.depo_id
      ${whereClause}
      ORDER BY eksik_miktar DESC
    `, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Kritik stok hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok değer raporu
router.get('/rapor/deger', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        k.ad as kategori,
        COUNT(*) as urun_sayisi,
        SUM(sk.toplam_stok) as toplam_miktar,
        SUM(sk.toplam_stok * sk.son_alis_fiyat) as toplam_deger
      FROM stok_kartlari sk
      LEFT JOIN stok_kategoriler k ON k.id = sk.kategori_id
      WHERE sk.aktif = true
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
    console.error('Değer raporu hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// YARDIMCI ENDPOINTLER
// =============================================

// Kategoriler
router.get('/kategoriler', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM stok_kategoriler 
      WHERE aktif = true 
      ORDER BY seviye, sira_no, ad
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
    console.error('Fatura listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fatura kalemlerini API'den çek ve parse et
router.get('/faturalar/:ettn/kalemler', async (req, res) => {
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
    const faturaInfo = {
      fatura_no: invoice.ID?.['_'] || invoice.ID,
      tarih: invoice.IssueDate,
      toplam_tutar: parseFloat(invoice.LegalMonetaryTotal?.PayableAmount?.['_'] || invoice.LegalMonetaryTotal?.PayableAmount || 0),
      gonderen: invoice.AccountingSupplierParty?.Party?.PartyName?.Name || 
                invoice.AccountingSupplierParty?.Party?.PartyIdentification?.ID?.['_']
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
      
      // Önceki eşleştirme var mı kontrol et
      const eslestirme = await query(`
        SELECT fue.stok_kart_id, sk.kod, sk.ad 
        FROM fatura_urun_eslestirme fue
        JOIN stok_kartlari sk ON sk.id = fue.stok_kart_id
        WHERE fue.tedarikci_urun_kodu = $1 OR fue.tedarikci_urun_adi ILIKE $2
        ORDER BY fue.eslestirme_sayisi DESC
        LIMIT 1
      `, [urunKodu, `%${urunAdi.substring(0, 20)}%`]);
      
      return {
        sira: index + 1,
        urun_adi: urunAdi,
        urun_kodu: urunKodu,
        miktar: parseFloat(line.InvoicedQuantity?.['_'] || line.InvoicedQuantity || 0),
        birim: line.InvoicedQuantity?.['$']?.unitCode || 'C62',
        birim_fiyat: parseFloat(price.PriceAmount?.['_'] || price.PriceAmount || 0),
        tutar: parseFloat(line.LineExtensionAmount?.['_'] || line.LineExtensionAmount || 0),
        kdv_orani: parseFloat(line.TaxTotal?.TaxSubtotal?.TaxCategory?.Percent || 0),
        kdv_tutar: parseFloat(line.TaxTotal?.TaxAmount?.['_'] || line.TaxTotal?.TaxAmount || 0),
        // Önerilen eşleştirme
        onerilen_stok_kart_id: eslestirme.rows[0]?.stok_kart_id || null,
        onerilen_stok_kart: eslestirme.rows[0] ? {
          id: eslestirme.rows[0].stok_kart_id,
          kod: eslestirme.rows[0].kod,
          ad: eslestirme.rows[0].ad
        } : null
      };
    }));
    
    res.json({
      success: true,
      fatura: faturaInfo,
      kalemler: kalemler
    });
    
  } catch (error) {
    console.error('Fatura kalem hatası:', error);
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
    
    // Her kalem için stok girişi yap
    for (const kalem of kalemler) {
      if (!kalem.stok_kart_id) continue; // Eşleştirilmemiş kalemleri atla
      
      // Stok hareketi oluştur (GİRİŞ - hareket_yonu otomatik hesaplanır)
      await query(`
        INSERT INTO stok_hareketleri (
          stok_kart_id, giris_depo_id, hareket_tipi, miktar,
          birim_fiyat, belge_no, aciklama, fatura_ettn, fatura_kalem_sira, belge_tarihi
        ) VALUES ($1, $2, 'GIRIS', $3, $4, $5, $6, $7, $8, CURRENT_DATE)
      `, [
        kalem.stok_kart_id,
        depo_id,
        kalem.miktar,
        kalem.birim_fiyat || 0,
        `FAT-${ettn.substring(0, 8)}`,
        `${tedarikci} faturasından giriş`,
        ettn,
        kalem.kalem_sira
      ]);
      
      // Stok kartı fiyatını güncelle
      await query(`
        UPDATE stok_kartlari 
        SET son_alis_fiyat = $1, updated_at = NOW()
        WHERE id = $2 AND (son_alis_fiyat IS NULL OR son_alis_fiyat < $1)
      `, [kalem.birim_fiyat || 0, kalem.stok_kart_id]);
      
      // Min/Kritik/Max stok değerlerini CATERING ölçeğinde güncelle
      // Catering için yüksek limitler gerekli (günde 1000+ kişi)
      const miktar = parseFloat(kalem.miktar) || 0;
      await query(`
        UPDATE stok_kartlari 
        SET 
          kritik_stok = GREATEST(COALESCE(kritik_stok, 0), 50, ROUND($1 * 1.5, 2)),
          min_stok = GREATEST(COALESCE(min_stok, 0), 100, ROUND($1 * 3, 2)),
          max_stok = GREATEST(COALESCE(max_stok, 0), 500, ROUND($1 * 15, 2)),
          updated_at = NOW()
        WHERE id = $2
      `, [miktar, kalem.stok_kart_id]);
      
      // Eşleştirme geçmişine ekle
      if (kalem.urun_kodu || kalem.urun_adi) {
        await query(`
          INSERT INTO fatura_urun_eslestirme (tedarikci_urun_kodu, tedarikci_urun_adi, stok_kart_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (tedarikci_urun_kodu, stok_kart_id) 
          DO UPDATE SET eslestirme_sayisi = fatura_urun_eslestirme.eslestirme_sayisi + 1,
                        son_eslestirme = NOW()
        `, [kalem.urun_kodu || '', kalem.urun_adi || '', kalem.stok_kart_id]);
      }
      
      toplamTutar += (kalem.miktar * (kalem.birim_fiyat || 0));
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
    console.error('Faturadan stok giriş hatası:', error);
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
    
    const result = await query(`
      SELECT id, kod, ad, ana_birim_id, son_alis_fiyat,
             (SELECT kisaltma FROM birimler WHERE id = ana_birim_id) as birim
      FROM stok_kartlari
      WHERE aktif = true
        AND (LOWER(kod) LIKE LOWER($1) OR LOWER(ad) LIKE LOWER($1))
      ORDER BY ad
      LIMIT 20
    `, [`%${q}%`]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
