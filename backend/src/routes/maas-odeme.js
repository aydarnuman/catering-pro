import express from 'express';
import { query } from '../database.js';
import { validate } from '../middleware/validate.js';
import { odendiSchema, personelOdemeSchema, avansSchema, primSchema, personelMaasDetaySchema, projeAyarlariSchema, aylikOdemeSchema, finalizeSchema } from '../validations/maas-odeme.js';

const router = express.Router();

// =====================================================
// MAAŞ ÖDEMELERİ
// =====================================================

/**
 * GET /api/maas-odeme/ozet/:projeId/:yil/:ay
 * Proje maaş ödeme özeti
 */
router.get('/ozet/:projeId/:yil/:ay', async (req, res) => {
  try {
    const { projeId, yil, ay } = req.params;

    // Personel listesi ve maaş bilgileri
    const personelResult = await query(
      `
      SELECT 
        p.id,
        p.id as personel_id,
        p.ad,
        p.soyad,
        p.maas as net_maas,
        p.bordro_maas,
        COALESCE(m.elden_fark, p.maas - COALESCE(p.bordro_maas, 0)) as elden_fark,
        COALESCE(m.avans, 0) as avans,
        COALESCE(m.prim, 0) as prim,
        COALESCE(m.fazla_mesai, 0) as fazla_mesai,
        COALESCE(m.net_odenecek, p.bordro_maas + COALESCE(m.elden_fark, p.maas - COALESCE(p.bordro_maas, 0)) + COALESCE(m.prim, 0) - COALESCE(m.avans, 0)) as net_odenecek,
        COALESCE(m.banka_odendi, false) as banka_odendi,
        COALESCE(m.elden_odendi, false) as elden_odendi,
        m.banka_odeme_tarihi,
        m.elden_odeme_tarihi,
        m.notlar
      FROM personeller p
      JOIN proje_personelleri pp ON pp.personel_id = p.id
      LEFT JOIN maas_odemeleri m ON m.personel_id = p.id 
        AND m.proje_id = $1 AND m.yil = $2 AND m.ay = $3
      WHERE pp.proje_id = $1 AND p.durum = 'aktif'
      ORDER BY p.ad, p.soyad
    `,
      [projeId, yil, ay]
    );

    // Toplam hesapla
    const toplamlar = personelResult.rows.reduce(
      (acc, p) => ({
        toplam_bordro: acc.toplam_bordro + parseFloat(p.bordro_maas || 0),
        toplam_elden: acc.toplam_elden + parseFloat(p.elden_fark || 0),
        toplam_avans: acc.toplam_avans + parseFloat(p.avans || 0),
        toplam_prim: acc.toplam_prim + parseFloat(p.prim || 0),
        toplam_net: acc.toplam_net + parseFloat(p.net_odenecek || p.net_maas || 0),
        banka_odenen: acc.banka_odenen + (p.banka_odendi ? 1 : 0),
        elden_odenen: acc.elden_odenen + (p.elden_odendi ? 1 : 0),
      }),
      {
        toplam_bordro: 0,
        toplam_elden: 0,
        toplam_avans: 0,
        toplam_prim: 0,
        toplam_net: 0,
        banka_odenen: 0,
        elden_odenen: 0,
      }
    );

    // Proje ödeme ayarları
    const ayarResult = await query(
      `
      SELECT odeme_gunu, banka_adi, iban 
      FROM proje_maas_ayarlari WHERE proje_id = $1
    `,
      [projeId]
    );

    const odemeGunu = ayarResult.rows[0]?.odeme_gunu || 15;

    const data = {
      personeller: personelResult.rows,
      ozet: {
        ...toplamlar,
        personel_sayisi: personelResult.rows.length,
        odeme_gunu: odemeGunu,
        banka_adi: ayarResult.rows[0]?.banka_adi,
        iban: ayarResult.rows[0]?.iban,
      },
    };
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/maas-odeme/olustur/:projeId/:yil/:ay
 * Ay için maaş ödemelerini oluştur (personel listesinden)
 */
router.post('/olustur/:projeId/:yil/:ay', async (req, res) => {
  try {
    const { projeId, yil, ay } = req.params;

    // Mevcut personelleri al ve maaş ödemesi oluştur
    const result = await query(
      `
      INSERT INTO maas_odemeleri (proje_id, personel_id, yil, ay, bordro_maas, elden_fark)
      SELECT 
        $1,
        p.id,
        $2,
        $3,
        COALESCE(p.bordro_maas, 0),
        (p.maas - COALESCE(p.bordro_maas, 0))
      FROM personeller p
      JOIN proje_personelleri pp ON pp.personel_id = p.id
      WHERE pp.proje_id = $1 AND p.durum = 'aktif'
      ON CONFLICT (proje_id, personel_id, yil, ay) 
      DO UPDATE SET 
        bordro_maas = EXCLUDED.bordro_maas,
        elden_fark = EXCLUDED.elden_fark,
        updated_at = NOW()
      RETURNING *
    `,
      [projeId, yil, ay]
    );

    res.json({ success: true, data: { count: result.rows.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/maas-odeme/:id/odendi
 * Ödeme durumunu güncelle
 */
router.patch('/:id/odendi', validate(odendiSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { tip, odendi } = req.body; // tip: 'banka' veya 'elden'

    const field = tip === 'banka' ? 'banka_odendi' : 'elden_odendi';
    const dateField = tip === 'banka' ? 'banka_odeme_tarihi' : 'elden_odeme_tarihi';

    const result = await query(
      `
      UPDATE maas_odemeleri 
      SET ${field} = $1, ${dateField} = ${odendi ? 'NOW()' : 'NULL'}
      WHERE id = $2
      RETURNING *
    `,
      [odendi, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/maas-odeme/personel-odeme/:personelId
 * Personel ödeme bilgilerini güncelle (elden_fark, avans, prim)
 */
router.patch('/personel-odeme/:personelId', validate(personelOdemeSchema), async (req, res) => {
  try {
    const { personelId } = req.params;
    const { proje_id, yil, ay, elden_fark, avans, prim } = req.body;

    // Önce personelden bordro_maas'ı al
    const personelRes = await query('SELECT bordro_maas FROM personeller WHERE id = $1', [personelId]);
    const bordroMaas = parseFloat(personelRes.rows[0]?.bordro_maas || 0);

    // Net ödenecek hesapla
    const netOdenecek = bordroMaas + (elden_fark || 0) + (prim || 0) - (avans || 0);

    // maas_odemeleri tablosunu güncelle
    const result = await query(
      `
      INSERT INTO maas_odemeleri (proje_id, personel_id, yil, ay, bordro_maas, elden_fark, avans, prim, net_odenecek)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (proje_id, personel_id, yil, ay) 
      DO UPDATE SET 
        elden_fark = $6,
        avans = $7,
        prim = $8,
        net_odenecek = $9,
        updated_at = NOW()
      RETURNING *
    `,
      [proje_id, personelId, yil, ay, bordroMaas, elden_fark, avans, prim, netOdenecek]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/maas-odeme/toplu-odendi/:projeId/:yil/:ay
 * Tüm ödemeleri işaretle
 */
router.patch('/toplu-odendi/:projeId/:yil/:ay', validate(odendiSchema), async (req, res) => {
  try {
    const { projeId, yil, ay } = req.params;
    const { tip, odendi } = req.body;

    const field = tip === 'banka' ? 'banka_odendi' : 'elden_odendi';
    const dateField = tip === 'banka' ? 'banka_odeme_tarihi' : 'elden_odeme_tarihi';

    await query(
      `
      UPDATE maas_odemeleri 
      SET ${field} = $1, ${dateField} = ${odendi ? 'NOW()' : 'NULL'}
      WHERE proje_id = $2 AND yil = $3 AND ay = $4
    `,
      [odendi, projeId, yil, ay]
    );

    res.json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// AVANS
// =====================================================

/**
 * GET /api/maas-odeme/avans/:personelId
 * Personel avans geçmişi
 */
router.get('/avans/:personelId', async (req, res) => {
  try {
    const { personelId } = req.params;
    const result = await query(
      `
      SELECT * FROM avans_hareketleri 
      WHERE personel_id = $1 
      ORDER BY tarih DESC
    `,
      [personelId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/maas-odeme/avans
 * Avans ekle
 */
router.post('/avans', validate(avansSchema), async (req, res) => {
  try {
    const { personel_id, proje_id, tutar, tarih, aciklama, odeme_sekli, mahsup_ay, mahsup_yil } = req.body;

    const result = await query(
      `
      INSERT INTO avans_hareketleri 
        (personel_id, proje_id, tutar, tarih, aciklama, odeme_sekli, mahsup_ay, mahsup_yil)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [personel_id, proje_id, tutar, tarih, aciklama, odeme_sekli || 'nakit', mahsup_ay, mahsup_yil]
    );

    // Maaş ödemesine avansı ekle
    if (mahsup_ay && mahsup_yil) {
      await query(
        `
        UPDATE maas_odemeleri 
        SET avans = avans + $1
        WHERE personel_id = $2 AND proje_id = $3 AND yil = $4 AND ay = $5
      `,
        [tutar, personel_id, proje_id, mahsup_yil, mahsup_ay]
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PRİM
// =====================================================

/**
 * GET /api/maas-odeme/prim/:personelId
 * Personel prim geçmişi
 */
router.get('/prim/:personelId', async (req, res) => {
  try {
    const { personelId } = req.params;
    const result = await query(
      `
      SELECT * FROM prim_hareketleri 
      WHERE personel_id = $1 
      ORDER BY tarih DESC
    `,
      [personelId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/maas-odeme/prim
 * Prim ekle
 */
router.post('/prim', validate(primSchema), async (req, res) => {
  try {
    const { personel_id, proje_id, tutar, tarih, prim_turu, aciklama, odeme_ay, odeme_yil } = req.body;

    const result = await query(
      `
      INSERT INTO prim_hareketleri 
        (personel_id, proje_id, tutar, tarih, prim_turu, aciklama, odeme_ay, odeme_yil)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [personel_id, proje_id, tutar, tarih, prim_turu, aciklama, odeme_ay, odeme_yil]
    );

    // Maaş ödemesine primi ekle
    if (odeme_ay && odeme_yil) {
      await query(
        `
        UPDATE maas_odemeleri 
        SET prim = prim + $1
        WHERE personel_id = $2 AND proje_id = $3 AND yil = $4 AND ay = $5
      `,
        [tutar, personel_id, proje_id, odeme_yil, odeme_ay]
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/maas-odeme/personel/:maasOdemeId
 * Personel bazlı maaş ödemesi güncelle (avans, prim, not vs)
 */
router.patch('/personel/:maasOdemeId', validate(personelMaasDetaySchema), async (req, res) => {
  try {
    const { maasOdemeId } = req.params;
    const { avans, prim, fazla_mesai, notlar } = req.body;

    const result = await query(
      `
      UPDATE maas_odemeleri 
      SET 
        avans = COALESCE($1, avans),
        prim = COALESCE($2, prim),
        fazla_mesai = COALESCE($3, fazla_mesai),
        notlar = COALESCE($4, notlar)
      WHERE id = $5
      RETURNING *
    `,
      [avans, prim, fazla_mesai, notlar, maasOdemeId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/maas-odeme/proje-ayarlari/:projeId
 * Proje ödeme ayarları
 */
router.get('/proje-ayarlari/:projeId', async (req, res) => {
  try {
    const { projeId } = req.params;
    const result = await query(
      `
      SELECT * FROM proje_maas_ayarlari WHERE proje_id = $1
    `,
      [projeId]
    );
    res.json({ success: true, data: result.rows[0] || { odeme_gunu: 15 } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/maas-odeme/proje-ayarlari/:projeId
 * Proje ödeme ayarları kaydet
 */
router.post('/proje-ayarlari/:projeId', validate(projeAyarlariSchema), async (req, res) => {
  try {
    const { projeId } = req.params;
    const { odeme_gunu, banka_adi, iban } = req.body;

    const result = await query(
      `
      INSERT INTO proje_maas_ayarlari (proje_id, odeme_gunu, banka_adi, iban)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (proje_id) DO UPDATE SET
        odeme_gunu = EXCLUDED.odeme_gunu,
        banka_adi = EXCLUDED.banka_adi,
        iban = EXCLUDED.iban
      RETURNING *
    `,
      [projeId, odeme_gunu || 15, banka_adi, iban]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PROJE AYLIK ÖDEME TAKİP (TÜM ÖDEMELER)
// =====================================================

/**
 * GET /api/maas-odeme/aylik-odeme/:projeId/:yil/:ay
 * Proje aylık ödeme durumu (maaş + SGK + vergiler)
 */
router.get('/aylik-odeme/:projeId/:yil/:ay', async (req, res) => {
  try {
    const { projeId, yil, ay } = req.params;

    // Kayıt yoksa oluştur
    await query(
      `
      INSERT INTO proje_aylik_odemeler (proje_id, yil, ay)
      VALUES ($1, $2, $3)
      ON CONFLICT (proje_id, yil, ay) DO NOTHING
    `,
      [projeId, yil, ay]
    );

    const result = await query(
      `
      SELECT * FROM proje_aylik_odemeler 
      WHERE proje_id = $1 AND yil = $2 AND ay = $3
    `,
      [projeId, yil, ay]
    );

    res.json({ success: true, data: result.rows[0] || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/maas-odeme/aylik-odeme/:projeId/:yil/:ay
 * Ödeme durumunu güncelle
 */
router.patch('/aylik-odeme/:projeId/:yil/:ay', validate(aylikOdemeSchema), async (req, res) => {
  try {
    const { projeId, yil, ay } = req.params;
    const { field, odendi } = req.body;

    // Güvenlik: sadece izin verilen alanlar
    const allowedFields = [
      'maas_banka_odendi',
      'maas_elden_odendi',
      'sgk_odendi',
      'gelir_vergisi_odendi',
      'damga_vergisi_odendi',
      'issizlik_odendi',
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ success: false, error: 'Geçersiz alan' });
    }

    const tarihField = field.replace('_odendi', '_tarih');

    // Önce kayıt var mı kontrol et, yoksa oluştur
    await query(
      `
      INSERT INTO proje_aylik_odemeler (proje_id, yil, ay)
      VALUES ($1, $2, $3)
      ON CONFLICT (proje_id, yil, ay) DO NOTHING
    `,
      [projeId, yil, ay]
    );

    // Güncelle
    const result = await query(
      `
      UPDATE proje_aylik_odemeler 
      SET ${field} = $1, ${tarihField} = ${odendi ? 'NOW()' : 'NULL'}, updated_at = NOW()
      WHERE proje_id = $2 AND yil = $3 AND ay = $4
      RETURNING *
    `,
      [odendi, projeId, yil, ay]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/maas-odeme/finalize/:projeId/:yil/:ay
 * Ödemeler tamamlandığında proje_hareketler'e kayıt ekle
 */
router.post('/finalize/:projeId/:yil/:ay', validate(finalizeSchema), async (req, res) => {
  try {
    const { projeId, yil, ay } = req.params;
    const { maas, sgk, vergi } = req.body;
    const tarih = `${yil}-${String(ay).padStart(2, '0')}-15`;

    const hareketler = [];

    // Maaş hareketi
    if (maas > 0) {
      const maasResult = await query(
        `
        INSERT INTO proje_hareketler 
          (proje_id, tip, kategori, tutar, tarih, aciklama, referans_tip, odendi, odeme_tarihi)
        SELECT $1, 'gider', 'personel_maas', $2, $3, $4, 'bordro', true, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM proje_hareketler 
          WHERE proje_id = $1 AND kategori = 'personel_maas' 
          AND EXTRACT(YEAR FROM tarih) = $5 AND EXTRACT(MONTH FROM tarih) = $6
        )
        RETURNING *
      `,
        [projeId, maas, tarih, `${ay}/${yil} Personel Maaşları`, yil, ay]
      );
      if (maasResult.rows[0]) hareketler.push(maasResult.rows[0]);
    }

    // SGK hareketi
    if (sgk > 0) {
      const sgkResult = await query(
        `
        INSERT INTO proje_hareketler 
          (proje_id, tip, kategori, tutar, tarih, aciklama, referans_tip, odendi, odeme_tarihi)
        SELECT $1, 'gider', 'personel_sgk', $2, $3, $4, 'bordro', true, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM proje_hareketler 
          WHERE proje_id = $1 AND kategori = 'personel_sgk' 
          AND EXTRACT(YEAR FROM tarih) = $5 AND EXTRACT(MONTH FROM tarih) = $6
        )
        RETURNING *
      `,
        [projeId, sgk, tarih, `${ay}/${yil} SGK Primleri`, yil, ay]
      );
      if (sgkResult.rows[0]) hareketler.push(sgkResult.rows[0]);
    }

    // Vergi hareketi
    if (vergi > 0) {
      const vergiResult = await query(
        `
        INSERT INTO proje_hareketler 
          (proje_id, tip, kategori, tutar, tarih, aciklama, referans_tip, odendi, odeme_tarihi)
        SELECT $1, 'gider', 'personel_vergi', $2, $3, $4, 'bordro', true, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM proje_hareketler 
          WHERE proje_id = $1 AND kategori = 'personel_vergi' 
          AND EXTRACT(YEAR FROM tarih) = $5 AND EXTRACT(MONTH FROM tarih) = $6
        )
        RETURNING *
      `,
        [projeId, vergi, tarih, `${ay}/${yil} Vergiler`, yil, ay]
      );
      if (vergiResult.rows[0]) hareketler.push(vergiResult.rows[0]);
    }

    res.json({ success: true, data: { hareketler, count: hareketler.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
