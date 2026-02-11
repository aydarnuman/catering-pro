/**
 * Kasa-Banka ve Çek/Senet Yönetimi API
 * PostgreSQL direkt bağlantı
 */

import express from 'express';
import { query } from '../database.js';
import { validate } from '../middleware/validate.js';
import { createHesapSchema, updateHesapSchema, createHareketSchema, createTransferSchema, createCekSenetSchema, tahsilCekSenetSchema, ciroCekSenetSchema, iadeCekSenetSchema } from '../validations/kasa-banka.js';

const router = express.Router();

// ====================================================
// HESAP İŞLEMLERİ
// ====================================================

// Tüm hesapları listele
router.get('/hesaplar', async (req, res) => {
  try {
    const { tip, aktif } = req.query;

    let sql = `
      SELECT
        id,
        hesap_tipi as tip,
        hesap_adi as ad,
        banka_adi,
        sube,
        hesap_no,
        iban,
        para_birimi,
        bakiye,
        kredi_limiti,
        gunluk_limit,
        aktif,
        varsayilan,
        notlar,
        kart_limiti,
        hesap_kesim_gunu,
        son_odeme_gunu,
        created_at,
        updated_at
      FROM kasa_banka_hesaplari
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (tip) {
      sql += ` AND hesap_tipi = $${paramIndex++}`;
      params.push(tip);
    }
    if (aktif !== undefined) {
      sql += ` AND aktif = $${paramIndex++}`;
      params.push(aktif === 'true');
    }

    sql += ' ORDER BY hesap_tipi, hesap_adi';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni hesap ekle
router.post('/hesaplar', validate(createHesapSchema), async (req, res) => {
  try {
    // Frontend tip/ad gönderebilir veya hesap_tipi/hesap_adi gönderebilir
    const {
      tip,
      ad,
      hesap_tipi,
      hesap_adi,
      banka_adi,
      sube,
      hesap_no,
      iban,
      para_birimi,
      bakiye,
      kredi_limiti,
      aktif,
      kart_limiti,
      hesap_kesim_gunu,
      son_odeme_gunu,
    } = req.body;

    const finalTip = tip || hesap_tipi;
    const finalAd = ad || hesap_adi;

    const result = await query(
      `INSERT INTO kasa_banka_hesaplari (
        hesap_tipi, hesap_adi, banka_adi, sube, hesap_no, iban, para_birimi,
        bakiye, kredi_limiti, aktif, kart_limiti, hesap_kesim_gunu, son_odeme_gunu
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING
         id,
         hesap_tipi as tip,
         hesap_adi as ad,
         banka_adi, sube, hesap_no, iban, para_birimi,
         bakiye, kredi_limiti, aktif, varsayilan,
         kart_limiti, hesap_kesim_gunu, son_odeme_gunu,
         created_at, updated_at`,
      [
        finalTip,
        finalAd,
        banka_adi,
        sube,
        hesap_no,
        iban,
        para_birimi || 'TRY',
        bakiye || 0,
        kredi_limiti || 0,
        aktif !== false,
        kart_limiti || 0,
        hesap_kesim_gunu || null,
        son_odeme_gunu || null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Hesap güncelle
router.put('/hesaplar/:id', validate(updateHesapSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tip,
      ad,
      hesap_tipi,
      hesap_adi,
      banka_adi,
      sube,
      hesap_no,
      iban,
      para_birimi,
      bakiye,
      kredi_limiti,
      aktif,
      kart_limiti,
      hesap_kesim_gunu,
      son_odeme_gunu,
    } = req.body;

    const finalTip = tip || hesap_tipi;
    const finalAd = ad || hesap_adi;

    const result = await query(
      `UPDATE kasa_banka_hesaplari
       SET hesap_tipi = $1, hesap_adi = $2, banka_adi = $3, sube = $4, hesap_no = $5, iban = $6,
           para_birimi = $7, bakiye = $8, kredi_limiti = $9, aktif = $10,
           kart_limiti = $11, hesap_kesim_gunu = $12, son_odeme_gunu = $13, updated_at = NOW()
       WHERE id = $14
       RETURNING
         id,
         hesap_tipi as tip,
         hesap_adi as ad,
         banka_adi, sube, hesap_no, iban, para_birimi,
         bakiye, kredi_limiti, aktif, varsayilan,
         kart_limiti, hesap_kesim_gunu, son_odeme_gunu,
         created_at, updated_at`,
      [
        finalTip,
        finalAd,
        banka_adi,
        sube,
        hesap_no,
        iban,
        para_birimi,
        bakiye,
        kredi_limiti,
        aktif,
        kart_limiti,
        hesap_kesim_gunu,
        son_odeme_gunu,
        id,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Hesap sil
router.delete('/hesaplar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM kasa_banka_hesaplari WHERE id = $1', [id]);
    res.json({ success: true, data: { message: 'Hesap silindi' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================
// HAREKET İŞLEMLERİ
// ====================================================

// Hareketleri listele
router.get('/hareketler', async (req, res) => {
  try {
    const { hesap_id, tarih_baslangic, tarih_bitis, limit = 100 } = req.query;

    let sql = `
      SELECT h.*,
             json_build_object(
               'id', hs.id,
               'ad', hs.hesap_adi,
               'tip', hs.hesap_tipi
             ) as hesap,
             CASE WHEN h.karsi_hesap_id IS NOT NULL THEN
               json_build_object('id', ks.id, 'ad', ks.hesap_adi, 'tip', ks.hesap_tipi)
             ELSE NULL END as karsi_hesap,
             CASE WHEN h.cari_id IS NOT NULL THEN
               json_build_object('id', c.id, 'unvan', c.unvan, 'tip', c.tip)
             ELSE NULL END as cari
      FROM kasa_banka_hareketleri h
      LEFT JOIN kasa_banka_hesaplari hs ON hs.id = h.hesap_id
      LEFT JOIN kasa_banka_hesaplari ks ON ks.id = h.karsi_hesap_id
      LEFT JOIN cariler c ON c.id = h.cari_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (hesap_id) {
      sql += ` AND h.hesap_id = $${paramIndex++}`;
      params.push(hesap_id);
    }
    if (tarih_baslangic) {
      sql += ` AND h.tarih >= $${paramIndex++}`;
      params.push(tarih_baslangic);
    }
    if (tarih_bitis) {
      sql += ` AND h.tarih <= $${paramIndex++}`;
      params.push(tarih_bitis);
    }

    sql += ` ORDER BY h.tarih DESC, h.saat DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit, 10));

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni hareket ekle (giriş/çıkış)
router.post('/hareketler', validate(createHareketSchema), async (req, res) => {
  try {
    const { hesap_id, hareket_tipi, tutar, aciklama, belge_no, tarih, cari_id } = req.body;

    // Önce mevcut bakiyeyi al
    const hesapResult = await query('SELECT bakiye FROM kasa_banka_hesaplari WHERE id = $1', [hesap_id]);
    const onceki_bakiye = hesapResult.rows[0]?.bakiye || 0;
    const sonraki_bakiye =
      hareket_tipi === 'giris'
        ? parseFloat(onceki_bakiye) + parseFloat(tutar)
        : parseFloat(onceki_bakiye) - parseFloat(tutar);

    const result = await query(
      `INSERT INTO kasa_banka_hareketleri (hesap_id, hareket_tipi, tutar, onceki_bakiye, sonraki_bakiye, aciklama, belge_no, tarih, cari_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        hesap_id,
        hareket_tipi,
        parseFloat(tutar),
        onceki_bakiye,
        sonraki_bakiye,
        aciklama,
        belge_no,
        tarih || new Date().toISOString().split('T')[0],
        cari_id,
      ]
    );

    // Bakiye trigger tarafından güncellenir
    // Cari hareket de trigger tarafından oluşturulur (create_cari_hareket_from_kasa_banka)
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transfer işlemi
router.post('/transfer', validate(createTransferSchema), async (req, res) => {
  try {
    const { kaynak_hesap_id, hedef_hesap_id, tutar, aciklama, tarih } = req.body;

    // Kaynak hesap bakiyesi
    const kaynakResult = await query('SELECT bakiye, hesap_adi FROM kasa_banka_hesaplari WHERE id = $1', [
      kaynak_hesap_id,
    ]);
    const hedefResult = await query('SELECT bakiye, hesap_adi FROM kasa_banka_hesaplari WHERE id = $1', [
      hedef_hesap_id,
    ]);

    const kaynakBakiye = kaynakResult.rows[0]?.bakiye || 0;

    // Transfer hareketi oluştur
    const result = await query(
      `INSERT INTO kasa_banka_hareketleri (hesap_id, karsi_hesap_id, hareket_tipi, tutar, onceki_bakiye, sonraki_bakiye, aciklama, tarih)
       VALUES ($1, $2, 'transfer', $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        kaynak_hesap_id,
        hedef_hesap_id,
        parseFloat(tutar),
        kaynakBakiye,
        parseFloat(kaynakBakiye) - parseFloat(tutar),
        aciklama || `Transfer: ${kaynakResult.rows[0]?.hesap_adi} → ${hedefResult.rows[0]?.hesap_adi}`,
        tarih || new Date().toISOString().split('T')[0],
      ]
    );

    // Bakiyeler trigger tarafından güncellenir
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================
// ÇEK/SENET İŞLEMLERİ
// ====================================================

// Çek/Senet listele
router.get('/cek-senet', async (req, res) => {
  try {
    const { tip, yonu, durum, vade_baslangic, vade_bitis, cari_id, limit = 100 } = req.query;

    let sql = `
      SELECT cs.*,
             CASE WHEN cs.cari_id IS NOT NULL THEN 
               json_build_object('id', c.id, 'unvan', c.unvan, 'telefon', c.telefon)
             ELSE NULL END as cari,
             CASE WHEN cs.ciro_edilen_cari_id IS NOT NULL THEN 
               json_build_object('id', cc.id, 'unvan', cc.unvan)
             ELSE NULL END as ciro_cari,
             CASE WHEN cs.islem_hesap_id IS NOT NULL THEN 
               json_build_object('id', h.id, 'hesap_adi', h.hesap_adi)
             ELSE NULL END as hesap
      FROM cek_senetler cs
      LEFT JOIN cariler c ON c.id = cs.cari_id
      LEFT JOIN cariler cc ON cc.id = cs.ciro_edilen_cari_id
      LEFT JOIN kasa_banka_hesaplari h ON h.id = cs.islem_hesap_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (tip) {
      sql += ` AND cs.tip = $${paramIndex++}`;
      params.push(tip);
    }
    if (yonu) {
      sql += ` AND cs.yonu = $${paramIndex++}`;
      params.push(yonu);
    }
    if (durum) {
      sql += ` AND cs.durum = $${paramIndex++}`;
      params.push(durum);
    }
    if (cari_id) {
      sql += ` AND cs.cari_id = $${paramIndex++}`;
      params.push(cari_id);
    }
    if (vade_baslangic) {
      sql += ` AND cs.vade_tarihi >= $${paramIndex++}`;
      params.push(vade_baslangic);
    }
    if (vade_bitis) {
      sql += ` AND cs.vade_tarihi <= $${paramIndex++}`;
      params.push(vade_bitis);
    }

    sql += ` ORDER BY cs.vade_tarihi ASC LIMIT $${paramIndex}`;
    params.push(parseInt(limit, 10));

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni çek/senet ekle
router.post('/cek-senet', validate(createCekSenetSchema), async (req, res) => {
  try {
    const {
      tip,
      yonu,
      belge_no,
      seri_no,
      tutar,
      doviz,
      kesim_tarihi,
      vade_tarihi,
      banka_adi,
      sube_adi,
      sube_kodu,
      hesap_no,
      kesen_unvan,
      kesen_vkn_tckn,
      cari_id,
      notlar,
    } = req.body;

    const result = await query(
      `INSERT INTO cek_senetler (
        tip, yonu, durum, belge_no, seri_no, tutar, doviz,
        kesim_tarihi, vade_tarihi, banka_adi, sube_adi,
        sube_kodu, hesap_no, kesen_unvan, kesen_vkn_tckn,
        cari_id, notlar
      ) VALUES ($1, $2, 'beklemede', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        tip,
        yonu,
        belge_no,
        seri_no,
        parseFloat(tutar),
        doviz || 'TRY',
        kesim_tarihi,
        vade_tarihi,
        banka_adi,
        sube_adi,
        sube_kodu,
        hesap_no,
        kesen_unvan,
        kesen_vkn_tckn,
        cari_id || null,
        notlar,
      ]
    );

    // Hareket kaydı oluştur
    await query(
      `INSERT INTO cek_senet_hareketler (cek_senet_id, islem_tipi, yeni_durum, aciklama)
       VALUES ($1, 'kayit', 'beklemede', $2)`,
      [result.rows[0].id, `${tip === 'cek' ? 'Çek' : 'Senet'} kaydedildi`]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Çek/Senet güncelle
router.put('/cek-senet/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    // Dinamik güncelleme
    const keys = Object.keys(fields).filter((k) => k !== 'id');
    const values = keys.map((k) => fields[k]);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

    const result = await query(
      `UPDATE cek_senetler SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Çek/Senet tahsil et
router.post('/cek-senet/:id/tahsil', validate(tahsilCekSenetSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { hesap_id, tarih, aciklama } = req.body;

    // Önce mevcut durumu al
    const cekSenetResult = await query('SELECT * FROM cek_senetler WHERE id = $1', [id]);
    const cekSenet = cekSenetResult.rows[0];

    if (!cekSenet) {
      return res.status(404).json({ success: false, error: 'Çek/Senet bulunamadı' });
    }

    if (cekSenet.durum !== 'beklemede') {
      return res.status(400).json({ success: false, error: 'Sadece beklemedeki çek/senetler tahsil edilebilir' });
    }

    const yeniDurum = cekSenet.yonu === 'alinan' ? 'tahsil_edildi' : 'odendi';

    // Çek/seneti güncelle
    const result = await query(
      `UPDATE cek_senetler SET durum = $1, islem_tarihi = $2, islem_hesap_id = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [yeniDurum, tarih || new Date().toISOString().split('T')[0], hesap_id, id]
    );

    // Hareket kaydı
    await query(
      `INSERT INTO cek_senet_hareketler (cek_senet_id, islem_tipi, eski_durum, yeni_durum, hesap_id, aciklama)
       VALUES ($1, $2, 'beklemede', $3, $4, $5)`,
      [
        id,
        cekSenet.yonu === 'alinan' ? 'tahsilat' : 'odeme',
        yeniDurum,
        hesap_id,
        aciklama ||
          `${cekSenet.tip === 'cek' ? 'Çek' : 'Senet'} ${cekSenet.yonu === 'alinan' ? 'tahsil edildi' : 'ödendi'}`,
      ]
    );

    // Kasa/Banka hareketi oluştur (bakiye güncellemesi için)
    const hareketTipi = cekSenet.yonu === 'alinan' ? 'giris' : 'cikis';
    const hesapResult = await query('SELECT bakiye FROM kasa_banka_hesaplari WHERE id = $1', [hesap_id]);
    const oncekiBakiye = hesapResult.rows[0]?.bakiye || 0;
    const sonrakiBakiye =
      hareketTipi === 'giris'
        ? parseFloat(oncekiBakiye) + parseFloat(cekSenet.tutar)
        : parseFloat(oncekiBakiye) - parseFloat(cekSenet.tutar);

    await query(
      `INSERT INTO kasa_banka_hareketleri (hesap_id, hareket_tipi, tutar, onceki_bakiye, sonraki_bakiye, aciklama, belge_no, tarih)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        hesap_id,
        hareketTipi,
        cekSenet.tutar,
        oncekiBakiye,
        sonrakiBakiye,
        `${cekSenet.tip} ${hareketTipi === 'giris' ? 'tahsilatı' : 'ödemesi'}: ${cekSenet.belge_no}`,
        cekSenet.belge_no,
        tarih || new Date().toISOString().split('T')[0],
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Çek/Senet ciro et
router.post('/cek-senet/:id/ciro', validate(ciroCekSenetSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { ciro_cari_id, tarih, aciklama } = req.body;

    // Önce mevcut durumu al
    const cekSenetResult = await query('SELECT * FROM cek_senetler WHERE id = $1', [id]);
    const cekSenet = cekSenetResult.rows[0];

    if (!cekSenet) {
      return res.status(404).json({ success: false, error: 'Çek/Senet bulunamadı' });
    }

    if (cekSenet.durum !== 'beklemede') {
      return res.status(400).json({ success: false, error: 'Sadece beklemedeki çek/senetler ciro edilebilir' });
    }

    if (cekSenet.yonu !== 'alinan') {
      return res.status(400).json({ success: false, error: 'Sadece alınan çek/senetler ciro edilebilir' });
    }

    // Çek/seneti güncelle
    const result = await query(
      `UPDATE cek_senetler SET durum = 'ciro_edildi', cirolu_mu = true, ciro_edilen_cari_id = $1, ciro_tarihi = $2, ciro_aciklama = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [ciro_cari_id, tarih || new Date().toISOString().split('T')[0], aciklama, id]
    );

    // Hareket kaydı
    await query(
      `INSERT INTO cek_senet_hareketler (cek_senet_id, islem_tipi, eski_durum, yeni_durum, hedef_cari_id, aciklama)
       VALUES ($1, 'ciro', 'beklemede', 'ciro_edildi', $2, $3)`,
      [id, ciro_cari_id, aciklama || `${cekSenet.tip === 'cek' ? 'Çek' : 'Senet'} ciro edildi`]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Çek/Senet iade et
router.post('/cek-senet/:id/iade', validate(iadeCekSenetSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { neden, tarih } = req.body;

    // Önce mevcut durumu al
    const cekSenetResult = await query('SELECT * FROM cek_senetler WHERE id = $1', [id]);
    const cekSenet = cekSenetResult.rows[0];

    if (!cekSenet) {
      return res.status(404).json({ success: false, error: 'Çek/Senet bulunamadı' });
    }

    // Çek/seneti güncelle
    const result = await query(
      `UPDATE cek_senetler SET durum = 'iade_edildi', iade_nedeni = $1, islem_tarihi = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [neden, tarih || new Date().toISOString().split('T')[0], id]
    );

    // Hareket kaydı
    await query(
      `INSERT INTO cek_senet_hareketler (cek_senet_id, islem_tipi, eski_durum, yeni_durum, aciklama)
       VALUES ($1, 'iade', $2, 'iade_edildi', $3)`,
      [id, cekSenet.durum, neden || 'İade edildi']
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Çek/Senet sil
router.delete('/cek-senet/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM cek_senetler WHERE id = $1', [id]);
    res.json({ success: true, data: { message: 'Çek/Senet silindi' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================
// ÖZET VE RAPORLAR
// ====================================================

// Dashboard özeti
router.get('/ozet', async (_req, res) => {
  try {
    // Hesap toplamları (kredi_karti dahil)
    const hesaplarResult = await query(`
      SELECT hesap_tipi as tip, SUM(bakiye) as toplam
      FROM kasa_banka_hesaplari
      WHERE aktif = true
      GROUP BY hesap_tipi
    `);

    const kasaToplam = hesaplarResult.rows.find((h) => h.tip === 'kasa')?.toplam || 0;
    const bankaToplam = hesaplarResult.rows.find((h) => h.tip === 'banka')?.toplam || 0;
    const krediKartiToplam = hesaplarResult.rows.find((h) => h.tip === 'kredi_karti')?.toplam || 0;

    // Çek/Senet toplamları
    const cekSenetResult = await query(`
      SELECT tip, yonu, durum, COUNT(*) as adet, SUM(tutar) as toplam
      FROM cek_senetler
      GROUP BY tip, yonu, durum
    `);

    const alinanCekBeklemede = cekSenetResult.rows.filter(
      (c) => c.tip === 'cek' && c.yonu === 'alinan' && c.durum === 'beklemede'
    );
    const verilenCekBeklemede = cekSenetResult.rows.filter(
      (c) => c.tip === 'cek' && c.yonu === 'verilen' && c.durum === 'beklemede'
    );
    const alinanSenetBeklemede = cekSenetResult.rows.filter(
      (c) => c.tip === 'senet' && c.yonu === 'alinan' && c.durum === 'beklemede'
    );
    const verilenSenetBeklemede = cekSenetResult.rows.filter(
      (c) => c.tip === 'senet' && c.yonu === 'verilen' && c.durum === 'beklemede'
    );

    // Vadesi geçenler ve yaklaşanlar
    const vadeResult = await query(`
      SELECT 
        SUM(CASE WHEN vade_tarihi < CURRENT_DATE THEN tutar ELSE 0 END) as vadesi_gecmis_toplam,
        COUNT(CASE WHEN vade_tarihi < CURRENT_DATE THEN 1 END) as vadesi_gecmis_adet,
        SUM(CASE WHEN vade_tarihi BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN tutar ELSE 0 END) as bu_hafta_toplam,
        COUNT(CASE WHEN vade_tarihi BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as bu_hafta_adet
      FROM cek_senetler
      WHERE durum = 'beklemede'
    `);

    res.json({
      success: true,
      data: {
        kasa_toplam: parseFloat(kasaToplam) || 0,
        banka_toplam: parseFloat(bankaToplam) || 0,
        kredi_karti_toplam: parseFloat(krediKartiToplam) || 0,
        genel_toplam: (parseFloat(kasaToplam) || 0) + (parseFloat(bankaToplam) || 0),
        // Kredi kartı borcu dahil net varlık
        net_varlik:
          (parseFloat(kasaToplam) || 0) + (parseFloat(bankaToplam) || 0) + (parseFloat(krediKartiToplam) || 0),

        alinan_cek_toplam: alinanCekBeklemede.reduce((a, b) => a + parseFloat(b.toplam || 0), 0),
        alinan_cek_adet: alinanCekBeklemede.reduce((a, b) => a + parseInt(b.adet || 0, 10), 0),

        verilen_cek_toplam: verilenCekBeklemede.reduce((a, b) => a + parseFloat(b.toplam || 0), 0),
        verilen_cek_adet: verilenCekBeklemede.reduce((a, b) => a + parseInt(b.adet || 0, 10), 0),

        alinan_senet_toplam: alinanSenetBeklemede.reduce((a, b) => a + parseFloat(b.toplam || 0), 0),
        alinan_senet_adet: alinanSenetBeklemede.reduce((a, b) => a + parseInt(b.adet || 0, 10), 0),

        verilen_senet_toplam: verilenSenetBeklemede.reduce((a, b) => a + parseFloat(b.toplam || 0), 0),
        verilen_senet_adet: verilenSenetBeklemede.reduce((a, b) => a + parseInt(b.adet || 0, 10), 0),

        vadesi_gecmis_toplam: parseFloat(vadeResult.rows[0]?.vadesi_gecmis_toplam) || 0,
        vadesi_gecmis_adet: parseInt(vadeResult.rows[0]?.vadesi_gecmis_adet, 10) || 0,

        bu_hafta_vadeli_toplam: parseFloat(vadeResult.rows[0]?.bu_hafta_toplam) || 0,
        bu_hafta_vadeli_adet: parseInt(vadeResult.rows[0]?.bu_hafta_adet, 10) || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cariler listesi (select için)
router.get('/cariler', async (_req, res) => {
  try {
    const result = await query(`
      SELECT id, unvan, tip, bakiye
      FROM cariler
      WHERE aktif = true
      ORDER BY unvan
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
