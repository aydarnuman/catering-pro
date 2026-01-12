import express from 'express';
import { pool } from '../database.js';

const router = express.Router();

// =============================================
// DEMİRBAŞ KATEGORİLERİ
// =============================================

// Kategorileri listele
router.get('/kategoriler', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        k.*,
        pk.ad as ust_kategori_ad,
        (SELECT COUNT(*) FROM demirbaslar d WHERE d.kategori_id = k.id AND d.aktif = TRUE) as demirbas_sayisi
      FROM demirbas_kategoriler k
      LEFT JOIN demirbas_kategoriler pk ON pk.id = k.ust_kategori_id
      WHERE k.aktif = TRUE
      ORDER BY k.sira_no, k.ad
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Kategori listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Kategori ekle
router.post('/kategoriler', async (req, res) => {
  try {
    const { kod, ad, ust_kategori_id, renk, ikon, amortisman_oran, faydali_omur } = req.body;
    
    const result = await pool.query(`
      INSERT INTO demirbas_kategoriler (kod, ad, ust_kategori_id, renk, ikon, amortisman_oran, faydali_omur)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [kod, ad, ust_kategori_id, renk || '#6366f1', ikon || '📦', amortisman_oran || 20, faydali_omur || 5]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Kategori ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// LOKASYONLAR
// =============================================

// Lokasyonları listele
router.get('/lokasyonlar', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.*,
        pl.ad as ust_lokasyon_ad,
        (SELECT COUNT(*) FROM demirbaslar d WHERE d.lokasyon_id = l.id AND d.aktif = TRUE) as demirbas_sayisi
      FROM demirbas_lokasyonlar l
      LEFT JOIN demirbas_lokasyonlar pl ON pl.id = l.ust_lokasyon_id
      WHERE l.aktif = TRUE
      ORDER BY l.ad
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Lokasyon listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lokasyon ekle
router.post('/lokasyonlar', async (req, res) => {
  try {
    const { kod, ad, ust_lokasyon_id, tip, adres, sorumlu_kisi, telefon, aciklama } = req.body;
    
    const result = await pool.query(`
      INSERT INTO demirbas_lokasyonlar (kod, ad, ust_lokasyon_id, tip, adres, sorumlu_kisi, telefon, aciklama)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [kod, ad, ust_lokasyon_id, tip || 'depo', adres, sorumlu_kisi, telefon, aciklama]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Lokasyon ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lokasyon güncelle
router.put('/lokasyonlar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { kod, ad, ust_lokasyon_id, tip, adres, sorumlu_kisi, telefon, aciklama } = req.body;
    
    const result = await pool.query(`
      UPDATE demirbas_lokasyonlar 
      SET kod = COALESCE($1, kod),
          ad = COALESCE($2, ad),
          ust_lokasyon_id = $3,
          tip = COALESCE($4, tip),
          adres = $5,
          sorumlu_kisi = $6,
          telefon = $7,
          aciklama = $8,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [kod, ad, ust_lokasyon_id, tip, adres, sorumlu_kisi, telefon, aciklama, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lokasyon bulunamadı' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Lokasyon güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lokasyon sil (soft delete)
router.delete('/lokasyonlar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Önce bu lokasyonda envanter var mı kontrol et
    const checkResult = await pool.query(`
      SELECT COUNT(*) as count FROM demirbaslar WHERE lokasyon_id = $1 AND aktif = TRUE
    `, [id]);
    
    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bu lokasyonda hala envanter bulunuyor. Önce envanterleri taşıyın.' 
      });
    }
    
    const result = await pool.query(`
      UPDATE demirbas_lokasyonlar 
      SET aktif = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lokasyon bulunamadı' });
    }
    
    res.json({ success: true, message: 'Lokasyon silindi' });
  } catch (error) {
    console.error('Lokasyon silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// İSTATİSTİKLER & DASHBOARD (Önce tanımlanmalı)
// =============================================

router.get('/istatistik/ozet', async (req, res) => {
  try {
    // Genel özet
    const ozet = await pool.query(`
      SELECT 
        COUNT(*) as toplam_demirbas,
        COUNT(CASE WHEN durum = 'aktif' THEN 1 END) as aktif,
        COUNT(CASE WHEN durum = 'bakimda' THEN 1 END) as bakimda,
        COUNT(CASE WHEN durum = 'arizali' THEN 1 END) as arizali,
        COUNT(CASE WHEN zimmetli_personel_id IS NOT NULL THEN 1 END) as zimmetli,
        COALESCE(SUM(alis_fiyati), 0) as toplam_alis_degeri,
        COALESCE(SUM(net_defter_degeri), 0) as toplam_net_deger,
        COALESCE(SUM(birikimis_amortisman), 0) as toplam_amortisman
      FROM demirbaslar
      WHERE aktif = TRUE
    `);
    
    // Kategori dağılımı
    const kategoriDagilimi = await pool.query(`
      SELECT 
        k.id,
        k.kod,
        k.ad,
        k.renk,
        k.ikon,
        COUNT(d.id) as toplam_adet,
        COALESCE(SUM(d.alis_fiyati), 0) as toplam_alis_degeri,
        COALESCE(SUM(d.net_defter_degeri), 0) as toplam_net_deger,
        COALESCE(SUM(d.birikimis_amortisman), 0) as toplam_amortisman,
        COUNT(CASE WHEN d.durum = 'bakimda' THEN 1 END) as bakimda_adet,
        COUNT(CASE WHEN d.zimmetli_personel_id IS NOT NULL THEN 1 END) as zimmetli_adet
      FROM demirbas_kategoriler k
      LEFT JOIN demirbaslar d ON d.kategori_id = k.id AND d.aktif = TRUE
      WHERE k.aktif = TRUE AND k.ust_kategori_id IS NULL
      GROUP BY k.id, k.kod, k.ad, k.renk, k.ikon
      ORDER BY k.sira_no
    `);
    
    // Garanti yaklaşanlar
    const garantiYaklasan = await pool.query(`
      SELECT 
        d.id,
        d.kod,
        d.ad,
        d.marka,
        d.model,
        d.garanti_bitis,
        d.garanti_bitis - CURRENT_DATE as kalan_gun,
        k.ad as kategori,
        k.renk,
        l.ad as lokasyon
      FROM demirbaslar d
      LEFT JOIN demirbas_kategoriler k ON k.id = d.kategori_id
      LEFT JOIN demirbas_lokasyonlar l ON l.id = d.lokasyon_id
      WHERE d.aktif = TRUE 
      AND d.garanti_bitis IS NOT NULL
      AND d.garanti_bitis BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
      ORDER BY d.garanti_bitis
      LIMIT 5
    `);
    
    // Bakımdakiler
    const bakimdakiler = await pool.query(`
      SELECT 
        d.id,
        d.kod,
        d.ad,
        b.bakim_tipi,
        b.servis_firma,
        b.gonderim_tarihi,
        b.tahmini_donus,
        CURRENT_DATE - b.gonderim_tarihi as gecen_gun,
        b.tahmini_maliyet,
        k.ad as kategori,
        k.renk
      FROM demirbaslar d
      JOIN demirbas_bakimlar b ON b.demirbas_id = d.id AND b.durum = 'devam_ediyor'
      LEFT JOIN demirbas_kategoriler k ON k.id = d.kategori_id
      WHERE d.durum = 'bakimda'
      ORDER BY b.gonderim_tarihi
    `);
    
    res.json({ 
      success: true, 
      data: {
        ozet: ozet.rows[0],
        kategoriDagilimi: kategoriDagilimi.rows,
        garantiYaklasan: garantiYaklasan.rows,
        bakimdakiler: bakimdakiler.rows
      }
    });
  } catch (error) {
    console.error('İstatistik hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// TOPLU İŞLEMLER
// =============================================

// Toplu silme
router.post('/toplu/sil', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz ID listesi' });
    }
    
    await pool.query(`
      UPDATE demirbaslar SET aktif = FALSE, updated_at = NOW()
      WHERE id = ANY($1)
    `, [ids]);
    
    res.json({ success: true, message: `${ids.length} demirbaş silindi` });
  } catch (error) {
    console.error('Toplu silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu transfer
router.post('/toplu/transfer', async (req, res) => {
  try {
    const { ids, lokasyon_id, aciklama } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz ID listesi' });
    }
    
    for (const id of ids) {
      const demirbas = await pool.query('SELECT lokasyon_id FROM demirbaslar WHERE id = $1', [id]);
      if (demirbas.rows.length > 0) {
        await pool.query(`
          INSERT INTO demirbas_hareketler (demirbas_id, hareket_tipi, tarih, onceki_lokasyon_id, yeni_lokasyon_id, aciklama)
          VALUES ($1, 'TRANSFER', CURRENT_DATE, $2, $3, $4)
        `, [id, demirbas.rows[0].lokasyon_id, lokasyon_id, aciklama || 'Toplu transfer']);
      }
    }
    
    res.json({ success: true, message: `${ids.length} demirbaş transfer edildi` });
  } catch (error) {
    console.error('Toplu transfer hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// DEMİRBAŞLAR - CRUD
// =============================================

// Demirbaşları listele
router.get('/', async (req, res) => {
  try {
    const { kategori_id, lokasyon_id, durum, zimmetli, search, limit = 100, offset = 0 } = req.query;
    
    let whereConditions = ['d.aktif = TRUE'];
    let params = [];
    let paramIndex = 1;
    
    if (kategori_id) {
      whereConditions.push(`d.kategori_id = $${paramIndex++}`);
      params.push(kategori_id);
    }
    
    if (lokasyon_id) {
      whereConditions.push(`d.lokasyon_id = $${paramIndex++}`);
      params.push(lokasyon_id);
    }
    
    if (durum) {
      whereConditions.push(`d.durum = $${paramIndex++}`);
      params.push(durum);
    }
    
    if (zimmetli === 'true') {
      whereConditions.push('d.zimmetli_personel_id IS NOT NULL');
    } else if (zimmetli === 'false') {
      whereConditions.push('d.zimmetli_personel_id IS NULL');
    }
    
    if (search) {
      whereConditions.push(`(
        d.kod ILIKE $${paramIndex} OR 
        d.ad ILIKE $${paramIndex} OR 
        d.marka ILIKE $${paramIndex} OR 
        d.model ILIKE $${paramIndex} OR
        d.seri_no ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const countParams = [...params];
    params.push(limit, offset);
    
    const result = await pool.query(`
      SELECT 
        d.*,
        k.ad as kategori_ad,
        k.renk as kategori_renk,
        k.ikon as kategori_ikon,
        l.ad as lokasyon_ad,
        pr.ad as proje_ad,
        p.ad || ' ' || p.soyad as zimmetli_personel,
        p.departman as zimmetli_departman,
        c.unvan as tedarikci,
        CASE 
          WHEN d.garanti_bitis IS NULL THEN 'belirsiz'
          WHEN d.garanti_bitis < CURRENT_DATE THEN 'bitti'
          WHEN d.garanti_bitis < CURRENT_DATE + INTERVAL '30 days' THEN 'yaklasiyor'
          ELSE 'gecerli'
        END as garanti_durumu
      FROM demirbaslar d
      LEFT JOIN demirbas_kategoriler k ON k.id = d.kategori_id
      LEFT JOIN demirbas_lokasyonlar l ON l.id = d.lokasyon_id
      LEFT JOIN projeler pr ON pr.id = d.proje_id
      LEFT JOIN personeller p ON p.id = d.zimmetli_personel_id
      LEFT JOIN cariler c ON c.id = d.tedarikci_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);
    
    // Toplam sayı
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM demirbaslar d
      WHERE ${whereConditions.join(' AND ')}
    `, countParams);
    
    res.json({ 
      success: true, 
      data: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0)
    });
  } catch (error) {
    console.error('Demirbaş listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Demirbaş detayı
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ana bilgiler
    const result = await pool.query(`
      SELECT 
        d.*,
        k.ad as kategori_ad,
        k.renk as kategori_renk,
        k.ikon as kategori_ikon,
        l.ad as lokasyon_ad,
        p.ad || ' ' || p.soyad as zimmetli_personel,
        p.departman as zimmetli_departman,
        p.telefon as zimmetli_telefon,
        c.unvan as tedarikci
      FROM demirbaslar d
      LEFT JOIN demirbas_kategoriler k ON k.id = d.kategori_id
      LEFT JOIN demirbas_lokasyonlar l ON l.id = d.lokasyon_id
      LEFT JOIN personeller p ON p.id = d.zimmetli_personel_id
      LEFT JOIN cariler c ON c.id = d.tedarikci_id
      WHERE d.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Demirbaş bulunamadı' });
    }
    
    // Hareket geçmişi
    const hareketler = await pool.query(`
      SELECT 
        h.*,
        op.ad || ' ' || op.soyad as onceki_personel,
        np.ad || ' ' || np.soyad as yeni_personel,
        ol.ad as onceki_lokasyon,
        nl.ad as yeni_lokasyon
      FROM demirbas_hareketler h
      LEFT JOIN personeller op ON op.id = h.onceki_personel_id
      LEFT JOIN personeller np ON np.id = h.yeni_personel_id
      LEFT JOIN demirbas_lokasyonlar ol ON ol.id = h.onceki_lokasyon_id
      LEFT JOIN demirbas_lokasyonlar nl ON nl.id = h.yeni_lokasyon_id
      WHERE h.demirbas_id = $1
      ORDER BY h.tarih DESC, h.created_at DESC
      LIMIT 20
    `, [id]);
    
    // Bakım geçmişi
    const bakimlar = await pool.query(`
      SELECT * FROM demirbas_bakimlar
      WHERE demirbas_id = $1
      ORDER BY gonderim_tarihi DESC
      LIMIT 10
    `, [id]);
    
    res.json({ 
      success: true, 
      data: {
        ...result.rows[0],
        hareketler: hareketler.rows,
        bakimlar: bakimlar.rows
      }
    });
  } catch (error) {
    console.error('Demirbaş detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni demirbaş ekle
router.post('/', async (req, res) => {
  try {
    const {
      kod, barkod, ad, kategori_id, marka, model, seri_no,
      alis_tarihi, alis_fiyati, tedarikci_id, fatura_no, fatura_id,
      garanti_suresi, garanti_bitis, amortisman_yontemi, faydali_omur, hurda_degeri,
      lokasyon_id, lokasyon_detay, proje_id, aciklama, resim_url, teknik_ozellik, muhasebe_hesap_kodu
    } = req.body;
    
    // Kod otomatik oluştur (eğer boşsa)
    let demirbasKod = kod;
    if (!demirbasKod) {
      const yil = new Date().getFullYear();
      const countResult = await pool.query(`
        SELECT COUNT(*) as sayi FROM demirbaslar WHERE kod LIKE $1
      `, [`DMB-${yil}-%`]);
      const siraNo = (parseInt(countResult.rows[0].sayi) + 1).toString().padStart(4, '0');
      demirbasKod = `DMB-${yil}-${siraNo}`;
    }
    
    // Garanti bitiş tarihi hesapla
    let garantiBitis = garanti_bitis;
    if (!garantiBitis && garanti_suresi && alis_tarihi) {
      const alisTarihi = new Date(alis_tarihi);
      alisTarihi.setMonth(alisTarihi.getMonth() + parseInt(garanti_suresi));
      garantiBitis = alisTarihi.toISOString().split('T')[0];
    }
    
    const result = await pool.query(`
      INSERT INTO demirbaslar (
        kod, barkod, ad, kategori_id, marka, model, seri_no,
        alis_tarihi, alis_fiyati, tedarikci_id, fatura_no, fatura_id,
        garanti_suresi, garanti_bitis, amortisman_yontemi, faydali_omur, hurda_degeri,
        lokasyon_id, lokasyon_detay, proje_id, aciklama, resim_url, teknik_ozellik, muhasebe_hesap_kodu,
        durum
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24,
        'aktif'
      )
      RETURNING *
    `, [
      demirbasKod, barkod, ad, kategori_id, marka, model, seri_no,
      alis_tarihi, alis_fiyati || 0, tedarikci_id, fatura_no, fatura_id,
      garanti_suresi, garantiBitis, amortisman_yontemi || 'dogrusal', faydali_omur || 5, hurda_degeri || 0,
      lokasyon_id, lokasyon_detay, proje_id || null, aciklama, resim_url, teknik_ozellik, muhasebe_hesap_kodu
    ]);
    
    // Giriş hareketi oluştur
    await pool.query(`
      INSERT INTO demirbas_hareketler (demirbas_id, hareket_tipi, tarih, yeni_lokasyon_id, aciklama)
      VALUES ($1, 'GIRIS', $2, $3, $4)
    `, [result.rows[0].id, alis_tarihi, lokasyon_id, `Yeni demirbaş girişi - ${fatura_no || 'Manuel giriş'}`]);
    
    res.json({ success: true, data: result.rows[0], message: 'Demirbaş başarıyla eklendi' });
  } catch (error) {
    console.error('Demirbaş ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Demirbaş güncelle
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ad, kategori_id, marka, model, seri_no, barkod,
      garanti_suresi, garanti_bitis, amortisman_yontemi, faydali_omur, hurda_degeri,
      lokasyon_id, lokasyon_detay, proje_id, aciklama, resim_url, teknik_ozellik, muhasebe_hesap_kodu
    } = req.body;
    
    const result = await pool.query(`
      UPDATE demirbaslar SET
        ad = COALESCE($1, ad),
        kategori_id = COALESCE($2, kategori_id),
        marka = COALESCE($3, marka),
        model = COALESCE($4, model),
        seri_no = COALESCE($5, seri_no),
        barkod = COALESCE($6, barkod),
        garanti_suresi = COALESCE($7, garanti_suresi),
        garanti_bitis = COALESCE($8, garanti_bitis),
        amortisman_yontemi = COALESCE($9, amortisman_yontemi),
        faydali_omur = COALESCE($10, faydali_omur),
        hurda_degeri = COALESCE($11, hurda_degeri),
        lokasyon_id = COALESCE($12, lokasyon_id),
        lokasyon_detay = COALESCE($13, lokasyon_detay),
        proje_id = $14,
        aciklama = COALESCE($15, aciklama),
        resim_url = COALESCE($16, resim_url),
        teknik_ozellik = COALESCE($17, teknik_ozellik),
        muhasebe_hesap_kodu = COALESCE($18, muhasebe_hesap_kodu),
        updated_at = NOW()
      WHERE id = $19
      RETURNING *
    `, [
      ad, kategori_id, marka, model, seri_no, barkod,
      garanti_suresi, garanti_bitis, amortisman_yontemi, faydali_omur, hurda_degeri,
      lokasyon_id, lokasyon_detay, proje_id || null, aciklama, resim_url, teknik_ozellik, muhasebe_hesap_kodu,
      id
    ]);
    
    res.json({ success: true, data: result.rows[0], message: 'Demirbaş güncellendi' });
  } catch (error) {
    console.error('Demirbaş güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Demirbaş sil
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete
    await pool.query(`
      UPDATE demirbaslar SET aktif = FALSE, updated_at = NOW()
      WHERE id = $1
    `, [id]);
    
    res.json({ success: true, message: 'Demirbaş silindi' });
  } catch (error) {
    console.error('Demirbaş silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ZİMMET İŞLEMLERİ
// =============================================

// Zimmet ver
router.post('/:id/zimmet', async (req, res) => {
  try {
    const { id } = req.params;
    const { personel_id, tarih, notlar, teslim_alan, teslim_eden } = req.body;
    
    // Mevcut durumu kontrol et
    const demirbas = await pool.query('SELECT * FROM demirbaslar WHERE id = $1', [id]);
    if (demirbas.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Demirbaş bulunamadı' });
    }
    
    const mevcutDemirbas = demirbas.rows[0];
    
    // Eğer zaten zimmetli ise hata ver
    if (mevcutDemirbas.zimmetli_personel_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bu demirbaş zaten zimmetli. Önce zimmet iade alın veya devir yapın.' 
      });
    }
    
    // Zimmet kaydı oluştur
    await pool.query(`
      INSERT INTO demirbas_zimmetler (demirbas_id, personel_id, zimmet_tarihi, notlar, teslim_alan, teslim_eden)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, personel_id, tarih || new Date(), notlar, teslim_alan, teslim_eden]);
    
    // Hareket kaydı oluştur (trigger demirbaşı güncelleyecek)
    await pool.query(`
      INSERT INTO demirbas_hareketler (demirbas_id, hareket_tipi, tarih, yeni_personel_id, aciklama)
      VALUES ($1, 'ZIMMET', $2, $3, $4)
    `, [id, tarih || new Date(), personel_id, notlar || 'Zimmet verildi']);
    
    res.json({ success: true, message: 'Zimmet başarıyla verildi' });
  } catch (error) {
    console.error('Zimmet verme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Zimmet iade
router.post('/:id/zimmet-iade', async (req, res) => {
  try {
    const { id } = req.params;
    const { tarih, notlar, lokasyon_id } = req.body;
    
    // Mevcut durumu kontrol et
    const demirbas = await pool.query('SELECT * FROM demirbaslar WHERE id = $1', [id]);
    if (demirbas.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Demirbaş bulunamadı' });
    }
    
    const mevcutDemirbas = demirbas.rows[0];
    
    if (!mevcutDemirbas.zimmetli_personel_id) {
      return res.status(400).json({ success: false, error: 'Bu demirbaş zaten zimmetsiz' });
    }
    
    // Mevcut zimmet kaydını kapat
    await pool.query(`
      UPDATE demirbas_zimmetler 
      SET iade_tarihi = $1, durum = 'iade'
      WHERE demirbas_id = $2 AND durum = 'aktif'
    `, [tarih || new Date(), id]);
    
    // Hareket kaydı oluştur
    await pool.query(`
      INSERT INTO demirbas_hareketler (
        demirbas_id, hareket_tipi, tarih, 
        onceki_personel_id, yeni_lokasyon_id, aciklama
      )
      VALUES ($1, 'ZIMMET_IADE', $2, $3, $4, $5)
    `, [id, tarih || new Date(), mevcutDemirbas.zimmetli_personel_id, lokasyon_id, notlar || 'Zimmet iade alındı']);
    
    res.json({ success: true, message: 'Zimmet başarıyla iade alındı' });
  } catch (error) {
    console.error('Zimmet iade hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Zimmet devir
router.post('/:id/zimmet-devir', async (req, res) => {
  try {
    const { id } = req.params;
    const { yeni_personel_id, tarih, notlar } = req.body;
    
    const demirbas = await pool.query('SELECT * FROM demirbaslar WHERE id = $1', [id]);
    if (demirbas.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Demirbaş bulunamadı' });
    }
    
    const mevcutDemirbas = demirbas.rows[0];
    
    if (!mevcutDemirbas.zimmetli_personel_id) {
      return res.status(400).json({ success: false, error: 'Bu demirbaş zimmetsiz, önce zimmet verin' });
    }
    
    // Eski zimmet kaydını kapat
    await pool.query(`
      UPDATE demirbas_zimmetler 
      SET iade_tarihi = $1, durum = 'devir'
      WHERE demirbas_id = $2 AND durum = 'aktif'
    `, [tarih || new Date(), id]);
    
    // Yeni zimmet kaydı oluştur
    await pool.query(`
      INSERT INTO demirbas_zimmetler (demirbas_id, personel_id, zimmet_tarihi, notlar)
      VALUES ($1, $2, $3, $4)
    `, [id, yeni_personel_id, tarih || new Date(), notlar]);
    
    // Hareket kaydı
    await pool.query(`
      INSERT INTO demirbas_hareketler (
        demirbas_id, hareket_tipi, tarih, 
        onceki_personel_id, yeni_personel_id, aciklama
      )
      VALUES ($1, 'ZIMMET_DEVIR', $2, $3, $4, $5)
    `, [id, tarih || new Date(), mevcutDemirbas.zimmetli_personel_id, yeni_personel_id, notlar || 'Zimmet devredildi']);
    
    res.json({ success: true, message: 'Zimmet başarıyla devredildi' });
  } catch (error) {
    console.error('Zimmet devir hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// BAKIM İŞLEMLERİ
// =============================================

// Bakıma gönder
router.post('/:id/bakim', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      bakim_tipi, bakim_nedeni, servis_firma, servis_telefon, servis_belge_no,
      gonderim_tarihi, tahmini_donus, tahmini_maliyet, garanti_kapsaminda
    } = req.body;
    
    // Bakım kaydı oluştur
    const bakimResult = await pool.query(`
      INSERT INTO demirbas_bakimlar (
        demirbas_id, bakim_tipi, bakim_nedeni, servis_firma, servis_telefon, servis_belge_no,
        gonderim_tarihi, tahmini_donus, tahmini_maliyet, garanti_kapsaminda
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      id, bakim_tipi, bakim_nedeni, servis_firma, servis_telefon, servis_belge_no,
      gonderim_tarihi || new Date(), tahmini_donus, tahmini_maliyet || 0, garanti_kapsaminda || false
    ]);
    
    // Hareket kaydı
    await pool.query(`
      INSERT INTO demirbas_hareketler (
        demirbas_id, hareket_tipi, tarih, bakim_tipi, servis_firma, tahmini_donus, aciklama
      )
      VALUES ($1, 'BAKIM_GIRIS', $2, $3, $4, $5, $6)
    `, [id, gonderim_tarihi || new Date(), bakim_tipi, servis_firma, tahmini_donus, bakim_nedeni]);
    
    res.json({ success: true, data: bakimResult.rows[0], message: 'Bakıma gönderildi' });
  } catch (error) {
    console.error('Bakım gönderme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bakımdan çıkar
router.post('/:id/bakim-cikis', async (req, res) => {
  try {
    const { id } = req.params;
    const { bakim_id, gercek_donus, gercek_maliyet, yapilan_islem, degisen_parcalar } = req.body;
    
    // Bakım kaydını güncelle
    await pool.query(`
      UPDATE demirbas_bakimlar SET
        gercek_donus = $1,
        gercek_maliyet = $2,
        yapilan_islem = $3,
        degisen_parcalar = $4,
        durum = 'tamamlandi',
        updated_at = NOW()
      WHERE id = $5
    `, [gercek_donus || new Date(), gercek_maliyet || 0, yapilan_islem, degisen_parcalar, bakim_id]);
    
    // Hareket kaydı
    await pool.query(`
      INSERT INTO demirbas_hareketler (
        demirbas_id, hareket_tipi, tarih, bakim_maliyeti, aciklama
      )
      VALUES ($1, 'BAKIM_CIKIS', $2, $3, $4)
    `, [id, gercek_donus || new Date(), gercek_maliyet || 0, yapilan_islem || 'Bakımdan döndü']);
    
    res.json({ success: true, message: 'Bakımdan çıkış yapıldı' });
  } catch (error) {
    console.error('Bakım çıkış hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// TRANSFER İŞLEMİ
// =============================================

router.post('/:id/transfer', async (req, res) => {
  try {
    const { id } = req.params;
    const { lokasyon_id, lokasyon_detay, tarih, aciklama } = req.body;
    
    const demirbas = await pool.query('SELECT * FROM demirbaslar WHERE id = $1', [id]);
    if (demirbas.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Demirbaş bulunamadı' });
    }
    
    const mevcutDemirbas = demirbas.rows[0];
    
    // Hareket kaydı
    await pool.query(`
      INSERT INTO demirbas_hareketler (
        demirbas_id, hareket_tipi, tarih, 
        onceki_lokasyon_id, yeni_lokasyon_id, aciklama
      )
      VALUES ($1, 'TRANSFER', $2, $3, $4, $5)
    `, [id, tarih || new Date(), mevcutDemirbas.lokasyon_id, lokasyon_id, aciklama || 'Lokasyon transferi']);
    
    // Lokasyon detayını da güncelle
    if (lokasyon_detay) {
      await pool.query(`
        UPDATE demirbaslar SET lokasyon_detay = $1 WHERE id = $2
      `, [lokasyon_detay, id]);
    }
    
    res.json({ success: true, message: 'Transfer başarıyla yapıldı' });
  } catch (error) {
    console.error('Transfer hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// HURDA / SATIŞ İŞLEMİ
// =============================================

router.post('/:id/cikis', async (req, res) => {
  try {
    const { id } = req.params;
    const { islem_tipi, tarih, tutar, alici_bilgi, aciklama } = req.body; // islem_tipi: 'hurda', 'satis', 'kayip'
    
    const hareketTipi = islem_tipi.toUpperCase();
    
    await pool.query(`
      INSERT INTO demirbas_hareketler (
        demirbas_id, hareket_tipi, tarih, satis_tutari, alici_bilgi, aciklama
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, hareketTipi, tarih || new Date(), tutar || 0, alici_bilgi, aciklama]);
    
    res.json({ success: true, message: `${islem_tipi} işlemi başarıyla kaydedildi` });
  } catch (error) {
    console.error('Çıkış işlemi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
