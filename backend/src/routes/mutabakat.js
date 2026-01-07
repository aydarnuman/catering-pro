/**
 * Cari Mutabakat API
 * Ekstre, Fatura Bazlı ve Dönemsel Mutabakat
 */

import express from 'express';
import { query } from '../database.js';

const router = express.Router();

// ====================================================
// CARİ EKSTRE
// Belirli dönemde tüm hareketlerin listesi
// ====================================================
router.get('/ekstre/:cariId', async (req, res) => {
  try {
    const { cariId } = req.params;
    const { baslangic, bitis } = req.query;
    
    // Varsayılan: Bu ay
    const baslangicTarihi = baslangic || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const bitisTarihi = bitis || new Date().toISOString().split('T')[0];

    // Cari bilgisi
    const cariResult = await query('SELECT * FROM cariler WHERE id = $1', [cariId]);
    if (cariResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cari bulunamadı' });
    }
    const cari = cariResult.rows[0];

    // Dönem öncesi bakiye (açılış bakiyesi)
    const acilisResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN kaynak_tip = 'fatura' AND fatura_tipi = 'satis' THEN tutar ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN kaynak_tip = 'fatura' AND fatura_tipi = 'alis' THEN tutar ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN kaynak_tip IN ('hareket', 'cek_senet') AND hareket_tipi = 'giris' THEN tutar ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN kaynak_tip IN ('hareket', 'cek_senet') AND hareket_tipi = 'cikis' THEN tutar ELSE 0 END), 0) as bakiye
      FROM (
        -- Manuel Faturalar (invoices)
        SELECT 'fatura' as kaynak_tip, i.invoice_type as fatura_tipi, NULL as hareket_tipi, i.total_amount as tutar, i.invoice_date as tarih
        FROM invoices i
        WHERE (i.customer_name = $1 OR i.cari_id = $2) AND i.invoice_date < $3
        
        UNION ALL
        
        -- Uyumsoft Faturaları (e-fatura)
        SELECT 'fatura' as kaynak_tip, 'alis' as fatura_tipi, NULL as hareket_tipi, u.payable_amount as tutar, u.invoice_date as tarih
        FROM uyumsoft_invoices u
        WHERE u.sender_name = $1 AND u.invoice_date < $3
        
        UNION ALL
        
        -- Kasa/Banka Hareketleri
        SELECT 'hareket' as kaynak_tip, NULL as fatura_tipi, h.hareket_tipi, h.tutar, h.tarih
        FROM kasa_banka_hareketleri h
        WHERE h.cari_id = $2 AND h.tarih < $3
        
        UNION ALL
        
        -- Çek/Senetler
        SELECT 'cek_senet' as kaynak_tip, NULL as fatura_tipi,
          CASE WHEN cs.yonu = 'alinan' THEN 'giris' ELSE 'cikis' END as hareket_tipi,
          cs.tutar, COALESCE(cs.islem_tarihi, cs.vade_tarihi) as tarih
        FROM cek_senetler cs
        WHERE cs.cari_id = $2 AND cs.durum IN ('tahsil_edildi', 'odendi') 
        AND COALESCE(cs.islem_tarihi, cs.vade_tarihi) < $3
      ) t
    `, [cari.unvan, cariId, baslangicTarihi]);
    
    const acilisBakiyesi = parseFloat(acilisResult.rows[0]?.bakiye) || 0;

    // Dönem içi hareketler
    const hareketlerResult = await query(`
      SELECT * FROM (
        -- Manuel Faturalar (invoices)
        SELECT 
          'fatura' as kaynak_tip,
          i.id as kaynak_id,
          i.invoice_no as belge_no,
          i.invoice_date as tarih,
          CASE WHEN i.invoice_type = 'satis' THEN i.total_amount ELSE 0 END as borc,
          CASE WHEN i.invoice_type = 'alis' THEN i.total_amount ELSE 0 END as alacak,
          'Fatura: ' || i.invoice_no as aciklama,
          i.invoice_type as alt_tip
        FROM invoices i
        WHERE (i.customer_name = $1 OR i.cari_id = $2)
        AND i.invoice_date BETWEEN $3 AND $4
        
        UNION ALL
        
        -- Uyumsoft Faturaları (e-fatura - alış)
        SELECT 
          'fatura' as kaynak_tip,
          u.id as kaynak_id,
          u.invoice_no as belge_no,
          u.invoice_date as tarih,
          0 as borc,
          u.payable_amount as alacak,
          'E-Fatura: ' || u.invoice_no as aciklama,
          'alis' as alt_tip
        FROM uyumsoft_invoices u
        WHERE u.sender_name = $1
        AND u.invoice_date BETWEEN $3 AND $4
        
        UNION ALL
        
        -- Kasa/Banka Hareketleri
        SELECT 
          'hareket' as kaynak_tip,
          h.id as kaynak_id,
          h.belge_no,
          h.tarih,
          CASE WHEN h.hareket_tipi = 'cikis' THEN h.tutar ELSE 0 END as borc,
          CASE WHEN h.hareket_tipi = 'giris' THEN h.tutar ELSE 0 END as alacak,
          COALESCE(h.aciklama, 'Ödeme/Tahsilat') as aciklama,
          h.hareket_tipi as alt_tip
        FROM kasa_banka_hareketleri h
        WHERE h.cari_id = $2 AND h.tarih BETWEEN $3 AND $4
        
        UNION ALL
        
        -- Çek/Senetler
        SELECT 
          'cek_senet' as kaynak_tip,
          cs.id as kaynak_id,
          cs.belge_no,
          COALESCE(cs.islem_tarihi, cs.vade_tarihi) as tarih,
          CASE WHEN cs.yonu = 'verilen' THEN cs.tutar ELSE 0 END as borc,
          CASE WHEN cs.yonu = 'alinan' THEN cs.tutar ELSE 0 END as alacak,
          cs.tip || ' ' || CASE WHEN cs.yonu = 'alinan' THEN 'tahsilatı' ELSE 'ödemesi' END as aciklama,
          cs.tip as alt_tip
        FROM cek_senetler cs
        WHERE cs.cari_id = $2 AND cs.durum IN ('tahsil_edildi', 'odendi')
        AND COALESCE(cs.islem_tarihi, cs.vade_tarihi) BETWEEN $3 AND $4
      ) t
      ORDER BY tarih ASC, kaynak_id ASC
    `, [cari.unvan, cariId, baslangicTarihi, bitisTarihi]);

    // Running balance hesapla
    let bakiye = acilisBakiyesi;
    const hareketler = hareketlerResult.rows.map(h => {
      bakiye = bakiye + parseFloat(h.borc) - parseFloat(h.alacak);
      return {
        ...h,
        borc: parseFloat(h.borc),
        alacak: parseFloat(h.alacak),
        bakiye: bakiye
      };
    });

    // Dönem toplamları
    const toplamBorc = hareketler.reduce((sum, h) => sum + h.borc, 0);
    const toplamAlacak = hareketler.reduce((sum, h) => sum + h.alacak, 0);

    res.json({
      cari,
      donem: {
        baslangic: baslangicTarihi,
        bitis: bitisTarihi
      },
      acilis_bakiyesi: acilisBakiyesi,
      hareketler,
      toplam_borc: toplamBorc,
      toplam_alacak: toplamAlacak,
      kapanis_bakiyesi: bakiye
    });

  } catch (error) {
    console.error('Ekstre hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================
// FATURA BAZLI MUTABAKAT
// Hangi faturalar açık, kapandı, kısmi ödendi
// ====================================================
router.get('/fatura-bazli/:cariId', async (req, res) => {
  try {
    const { cariId } = req.params;
    const { durum, yil, ay } = req.query; // 'acik', 'kapali', 'kismi', 'tumu' + tarih filtresi

    // Cari bilgisi
    const cariResult = await query('SELECT * FROM cariler WHERE id = $1', [cariId]);
    if (cariResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cari bulunamadı' });
    }
    const cari = cariResult.rows[0];

    // Tarih filtresi hesapla
    const now = new Date();
    const year = parseInt(yil) || now.getFullYear();
    const month = parseInt(ay) || now.getMonth() + 1;
    const baslangic = `${year}-${String(month).padStart(2, '0')}-01`;
    const sonGun = new Date(year, month, 0).getDate();
    const bitis = `${year}-${String(month).padStart(2, '0')}-${sonGun}`;

    // Faturalar ve ödemeleri (hem manuel hem uyumsoft) - TARİH FİLTRELİ
    const faturalarResult = await query(`
      SELECT * FROM (
        -- Manuel Faturalar
        SELECT 
          i.id,
          i.invoice_no,
          i.invoice_date as fatura_tarihi,
          i.due_date as vade_tarihi,
          i.invoice_type as fatura_tipi,
          i.total_amount as fatura_tutari,
          i.notes,
          'manuel' as kaynak,
          COALESCE(odeme.odenen_tutar, 0) as odenen_tutar,
          i.total_amount - COALESCE(odeme.odenen_tutar, 0) as kalan_tutar,
          CASE 
            WHEN i.total_amount - COALESCE(odeme.odenen_tutar, 0) <= 0 THEN 'kapali'
            WHEN COALESCE(odeme.odenen_tutar, 0) > 0 THEN 'kismi'
            ELSE 'acik'
          END as odeme_durumu,
          odeme.odemeler
        FROM invoices i
        LEFT JOIN (
          SELECT 
            fatura_id,
            SUM(tutar) as odenen_tutar,
            json_agg(json_build_object(
              'id', fo.id,
              'tutar', fo.tutar,
              'tarih', fo.tarih,
              'aciklama', fo.aciklama,
              'belge_no', fo.belge_no
            ) ORDER BY fo.tarih) as odemeler
          FROM fatura_odemeleri fo
          GROUP BY fatura_id
        ) odeme ON odeme.fatura_id = i.id
        WHERE (i.customer_name = $1 OR i.cari_id = $2)
        AND i.invoice_date BETWEEN $3 AND $4
        
        UNION ALL
        
        -- Uyumsoft E-Faturaları
        SELECT 
          u.id,
          u.invoice_no,
          u.invoice_date as fatura_tarihi,
          u.invoice_date as vade_tarihi,
          'alis' as fatura_tipi,
          u.payable_amount as fatura_tutari,
          NULL as notes,
          'uyumsoft' as kaynak,
          0 as odenen_tutar,
          u.payable_amount as kalan_tutar,
          'acik' as odeme_durumu,
          NULL as odemeler
        FROM uyumsoft_invoices u
        WHERE u.sender_name = $1
        AND u.invoice_date BETWEEN $3 AND $4
      ) all_invoices
      ORDER BY fatura_tarihi DESC
    `, [cari.unvan, cariId, baslangic, bitis]);

    let faturalar = faturalarResult.rows.map(f => ({
      ...f,
      fatura_tutari: parseFloat(f.fatura_tutari),
      odenen_tutar: parseFloat(f.odenen_tutar),
      kalan_tutar: parseFloat(f.kalan_tutar),
      odemeler: f.odemeler || []
    }));

    // Durum filtresi
    if (durum && durum !== 'tumu') {
      faturalar = faturalar.filter(f => f.odeme_durumu === durum);
    }

    // Özet
    const ozet = {
      toplam_fatura: faturalar.length,
      toplam_tutar: faturalar.reduce((sum, f) => sum + f.fatura_tutari, 0),
      odenen_tutar: faturalar.reduce((sum, f) => sum + f.odenen_tutar, 0),
      kalan_tutar: faturalar.reduce((sum, f) => sum + f.kalan_tutar, 0),
      acik_fatura_sayisi: faturalar.filter(f => f.odeme_durumu === 'acik').length,
      kapali_fatura_sayisi: faturalar.filter(f => f.odeme_durumu === 'kapali').length,
      kismi_fatura_sayisi: faturalar.filter(f => f.odeme_durumu === 'kismi').length
    };

    res.json({
      cari,
      faturalar,
      ozet
    });

  } catch (error) {
    console.error('Fatura bazlı mutabakat hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================
// DÖNEMSEL MUTABAKAT
// Aylık özet
// ====================================================
router.get('/donemsel/:cariId', async (req, res) => {
  try {
    const { cariId } = req.params;
    const { yil, ay } = req.query;

    // Varsayılan: Bu ay
    const now = new Date();
    const year = parseInt(yil) || now.getFullYear();
    const month = parseInt(ay) || now.getMonth() + 1;

    const baslangic = `${year}-${String(month).padStart(2, '0')}-01`;
    const sonGun = new Date(year, month, 0).getDate();
    const bitis = `${year}-${String(month).padStart(2, '0')}-${sonGun}`;

    // Cari bilgisi
    const cariResult = await query('SELECT * FROM cariler WHERE id = $1', [cariId]);
    if (cariResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cari bulunamadı' });
    }
    const cari = cariResult.rows[0];

    // Dönem öncesi bakiye (manuel + uyumsoft faturaları)
    const acilisResult = await query(`
      SELECT COALESCE(SUM(borc - alacak), 0) as bakiye FROM (
        -- Manuel faturalar
        SELECT 
          CASE WHEN i.invoice_type = 'satis' THEN i.total_amount ELSE 0 END as borc,
          CASE WHEN i.invoice_type = 'alis' THEN i.total_amount ELSE 0 END as alacak
        FROM invoices i WHERE (i.customer_name = $1 OR i.cari_id = $2) AND i.invoice_date < $3
        UNION ALL
        -- Uyumsoft faturaları (alış)
        SELECT 0 as borc, u.payable_amount as alacak
        FROM uyumsoft_invoices u WHERE u.sender_name = $1 AND u.invoice_date < $3
        UNION ALL
        -- Kasa/Banka hareketleri
        SELECT 
          CASE WHEN h.hareket_tipi = 'cikis' THEN h.tutar ELSE 0 END as borc,
          CASE WHEN h.hareket_tipi = 'giris' THEN h.tutar ELSE 0 END as alacak
        FROM kasa_banka_hareketleri h WHERE h.cari_id = $2 AND h.tarih < $3
      ) t
    `, [cari.unvan, cariId, baslangic]);
    const acilisBakiyesi = parseFloat(acilisResult.rows[0]?.bakiye) || 0;

    // Dönem içi satış faturaları (manuel)
    const satisFaturaResult = await query(`
      SELECT COUNT(*) as adet, COALESCE(SUM(total_amount), 0) as toplam
      FROM invoices 
      WHERE (customer_name = $1 OR cari_id = $2) 
      AND invoice_type = 'satis' AND invoice_date BETWEEN $3 AND $4
    `, [cari.unvan, cariId, baslangic, bitis]);

    // Dönem içi alış faturaları (manuel + uyumsoft)
    const alisFaturaResult = await query(`
      SELECT 
        COUNT(*) as adet, 
        COALESCE(SUM(tutar), 0) as toplam
      FROM (
        SELECT total_amount as tutar FROM invoices 
        WHERE (customer_name = $1 OR cari_id = $2) 
        AND invoice_type = 'alis' AND invoice_date BETWEEN $3 AND $4
        UNION ALL
        SELECT payable_amount as tutar FROM uyumsoft_invoices 
        WHERE sender_name = $1 AND invoice_date BETWEEN $3 AND $4
      ) t
    `, [cari.unvan, cariId, baslangic, bitis]);

    // Dönem içi tahsilatlar
    const tahsilatResult = await query(`
      SELECT COUNT(*) as adet, COALESCE(SUM(tutar), 0) as toplam
      FROM kasa_banka_hareketleri
      WHERE cari_id = $1 AND hareket_tipi = 'giris' AND tarih BETWEEN $2 AND $3
    `, [cariId, baslangic, bitis]);

    // Dönem içi ödemeler
    const odemeResult = await query(`
      SELECT COUNT(*) as adet, COALESCE(SUM(tutar), 0) as toplam
      FROM kasa_banka_hareketleri
      WHERE cari_id = $1 AND hareket_tipi = 'cikis' AND tarih BETWEEN $2 AND $3
    `, [cariId, baslangic, bitis]);

    // Hesaplamalar
    const satisFatura = {
      adet: parseInt(satisFaturaResult.rows[0]?.adet) || 0,
      toplam: parseFloat(satisFaturaResult.rows[0]?.toplam) || 0
    };
    const alisFatura = {
      adet: parseInt(alisFaturaResult.rows[0]?.adet) || 0,
      toplam: parseFloat(alisFaturaResult.rows[0]?.toplam) || 0
    };
    const tahsilat = {
      adet: parseInt(tahsilatResult.rows[0]?.adet) || 0,
      toplam: parseFloat(tahsilatResult.rows[0]?.toplam) || 0
    };
    const odeme = {
      adet: parseInt(odemeResult.rows[0]?.adet) || 0,
      toplam: parseFloat(odemeResult.rows[0]?.toplam) || 0
    };

    const donemBorc = satisFatura.toplam + odeme.toplam;
    const donemAlacak = alisFatura.toplam + tahsilat.toplam;
    const kapanisBakiyesi = acilisBakiyesi + donemBorc - donemAlacak;

    res.json({
      cari,
      donem: {
        yil: year,
        ay: month,
        ay_adi: new Date(year, month - 1).toLocaleString('tr-TR', { month: 'long' }),
        baslangic,
        bitis
      },
      acilis_bakiyesi: acilisBakiyesi,
      satis_faturalari: satisFatura,
      alis_faturalari: alisFatura,
      tahsilatlar: tahsilat,
      odemeler: odeme,
      donem_borc: donemBorc,
      donem_alacak: donemAlacak,
      kapanis_bakiyesi: kapanisBakiyesi
    });

  } catch (error) {
    console.error('Dönemsel mutabakat hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================
// FATURA ÖDEME EŞLEŞTİRME
// Bir faturaya ödeme ekle
// ====================================================
router.post('/fatura-odeme', async (req, res) => {
  try {
    const { fatura_id, tutar, tarih, aciklama, belge_no, hareket_id, cek_senet_id } = req.body;

    // Fatura kontrol
    const faturaResult = await query('SELECT * FROM invoices WHERE id = $1', [fatura_id]);
    if (faturaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fatura bulunamadı' });
    }

    // Mevcut ödemeleri kontrol
    const mevcutOdemeResult = await query(
      'SELECT COALESCE(SUM(tutar), 0) as toplam FROM fatura_odemeleri WHERE fatura_id = $1',
      [fatura_id]
    );
    const mevcutOdeme = parseFloat(mevcutOdemeResult.rows[0]?.toplam) || 0;
    const faturaTutari = parseFloat(faturaResult.rows[0].total_amount);

    if (mevcutOdeme + parseFloat(tutar) > faturaTutari) {
      return res.status(400).json({ 
        error: 'Ödeme tutarı fatura tutarını aşamaz',
        fatura_tutari: faturaTutari,
        mevcut_odeme: mevcutOdeme,
        kalan: faturaTutari - mevcutOdeme
      });
    }

    const result = await query(`
      INSERT INTO fatura_odemeleri (fatura_id, tutar, tarih, aciklama, belge_no, hareket_id, cek_senet_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [fatura_id, tutar, tarih || new Date().toISOString().split('T')[0], aciklama, belge_no, hareket_id, cek_senet_id]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Fatura ödeme eşleştirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================
// FATURA ÖDEMELERİNİ LİSTELE
// ====================================================
router.get('/fatura-odemeler/:faturaId', async (req, res) => {
  try {
    const { faturaId } = req.params;

    const result = await query(`
      SELECT fo.*,
        CASE WHEN fo.hareket_id IS NOT NULL THEN
          json_build_object('id', h.id, 'hesap_adi', kb.hesap_adi, 'tarih', h.tarih)
        ELSE NULL END as hareket,
        CASE WHEN fo.cek_senet_id IS NOT NULL THEN
          json_build_object('id', cs.id, 'belge_no', cs.belge_no, 'tip', cs.tip)
        ELSE NULL END as cek_senet
      FROM fatura_odemeleri fo
      LEFT JOIN kasa_banka_hareketleri h ON h.id = fo.hareket_id
      LEFT JOIN kasa_banka_hesaplari kb ON kb.id = h.hesap_id
      LEFT JOIN cek_senetler cs ON cs.id = fo.cek_senet_id
      WHERE fo.fatura_id = $1
      ORDER BY fo.tarih
    `, [faturaId]);

    res.json(result.rows);

  } catch (error) {
    console.error('Fatura ödemeleri listesi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

