import express from 'express';
import { query } from '../database.js';
import { auditLog, authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createPersonelSchema, updatePersonelSchema, createProjeSchema, updateProjeSchema, atamaSchema, topluAtamaSchema, updateAtamaSchema, createGorevSchema, updateGorevSchema, tazminatHesaplaSchema, tazminatKaydetSchema, izinGunSchema } from '../validations/personel.js';

const router = express.Router();

// NOT: GET route'ları herkese açık, POST/PUT/DELETE route'ları authentication gerektirir

// =====================================================
// PERSONEL İSTATİSTİKLERİ (Dashboard Widget için)
// =====================================================
router.get('/stats', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as toplam_personel,
        COUNT(*) FILTER (WHERE durum = 'aktif' OR durum IS NULL) as aktif_personel,
        COUNT(*) FILTER (WHERE durum = 'izinli') as izinli_personel,
        COUNT(*) FILTER (WHERE durum = 'pasif') as pasif_personel,
        COALESCE(SUM(maas), 0) as toplam_maas,
        COALESCE(AVG(maas), 0) as ortalama_maas
      FROM personeller
      WHERE isten_cikis_tarihi IS NULL
    `);

    // Bugün izinli olanlar
    const izinResult = await query(`
      SELECT COUNT(DISTINCT it.personel_id) as bugun_izinli
      FROM izin_talepleri it
      WHERE it.durum = 'onaylandi'
      AND CURRENT_DATE BETWEEN it.baslangic_tarihi AND it.bitis_tarihi
    `);

    const stats = result.rows[0];
    const data = {
      toplam_personel: parseInt(stats.toplam_personel, 10) || 0,
      aktif_personel: parseInt(stats.aktif_personel, 10) || 0,
      izinli_personel: parseInt(izinResult.rows[0]?.bugun_izinli, 10) || parseInt(stats.izinli_personel, 10) || 0,
      pasif_personel: parseInt(stats.pasif_personel, 10) || 0,
      toplam_maas: Math.round(parseFloat(stats.toplam_maas)) || 0,
      ortalama_maas: Math.round(parseFloat(stats.ortalama_maas)) || 0,
    };
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PROJELERİ LİSTELE
// =====================================================
router.get('/projeler', async (req, res) => {
  try {
    const { durum } = req.query;

    let sql = `
      SELECT 
        p.*,
        COALESCE((SELECT COUNT(*) FROM proje_personelleri pp WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as personel_sayisi,
        COALESCE((SELECT SUM(per.maas) FROM proje_personelleri pp 
                  JOIN personeller per ON per.id = pp.personel_id 
                  WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as toplam_maas
      FROM projeler p
    `;

    const params = [];
    if (durum) {
      sql += ` WHERE p.durum = $1`;
      params.push(durum);
    }

    sql += ` ORDER BY p.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PROJE DETAYI (personellerle birlikte)
// =====================================================
router.get('/projeler/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Proje bilgisi
    const projeResult = await query(
      `
      SELECT 
        p.*,
        COALESCE((SELECT COUNT(*) FROM proje_personelleri pp WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as personel_sayisi,
        COALESCE((SELECT SUM(per.maas) FROM proje_personelleri pp 
                  JOIN personeller per ON per.id = pp.personel_id 
                  WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as toplam_maas
      FROM projeler p
      WHERE p.id = $1
    `,
      [id]
    );

    if (projeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Proje bulunamadı' });
    }

    // Projedeki personeller
    const personellerResult = await query(
      `
      SELECT 
        per.*,
        pp.gorev as proje_gorev,
        pp.baslangic_tarihi as gorev_baslangic,
        pp.bitis_tarihi as gorev_bitis,
        pp.aktif as gorev_aktif,
        pp.id as atama_id
      FROM proje_personelleri pp
      JOIN personeller per ON per.id = pp.personel_id
      WHERE pp.proje_id = $1 AND pp.aktif = TRUE
      ORDER BY per.ad, per.soyad
    `,
      [id]
    );

    const data = { ...projeResult.rows[0], personeller: personellerResult.rows };
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// YENİ PROJE EKLE
// =====================================================
router.post('/projeler', validate(createProjeSchema), async (req, res) => {
  try {
    const { ad, kod, aciklama, musteri, lokasyon, baslangic_tarihi, bitis_tarihi, butce, durum } = req.body;

    const result = await query(
      `
      INSERT INTO projeler (ad, kod, aciklama, musteri, lokasyon, baslangic_tarihi, bitis_tarihi, butce, durum)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        ad,
        kod || null,
        aciklama || null,
        musteri || null,
        lokasyon || null,
        baslangic_tarihi || null,
        bitis_tarihi || null,
        butce || 0,
        durum || 'aktif',
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, error: 'Bu proje kodu zaten kullanılıyor' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PROJE GÜNCELLE
// =====================================================
router.put('/projeler/:id', validate(updateProjeSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, kod, aciklama, musteri, lokasyon, baslangic_tarihi, bitis_tarihi, butce, durum } = req.body;

    const result = await query(
      `
      UPDATE projeler SET
        ad = COALESCE($2, ad),
        kod = $3,
        aciklama = $4,
        musteri = $5,
        lokasyon = $6,
        baslangic_tarihi = $7,
        bitis_tarihi = $8,
        butce = COALESCE($9, butce),
        durum = COALESCE($10, durum),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
      [id, ad, kod, aciklama, musteri, lokasyon, baslangic_tarihi, bitis_tarihi, butce, durum]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Proje bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PROJE SİL
// =====================================================
router.delete('/projeler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM projeler WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Proje bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PERSONELLERİ LİSTELE
// =====================================================
router.get('/', async (req, res) => {
  try {
    const { departman, durum, proje_id, sadece_atamasiz } = req.query;

    let sql = `
      SELECT 
        p.*,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'proje_id', pr.id,
              'proje_ad', pr.ad,
              'proje_kod', pr.kod,
              'gorev', pp.gorev,
              'baslangic_tarihi', pp.baslangic_tarihi,
              'bitis_tarihi', pp.bitis_tarihi
            )
          ) FILTER (WHERE pr.id IS NOT NULL)
          FROM proje_personelleri pp
          JOIN projeler pr ON pr.id = pp.proje_id
          WHERE pp.personel_id = p.id AND pp.aktif = TRUE
          ),
          '[]'::json
        ) as projeler
      FROM personeller p
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (departman) {
      sql += ` AND p.departman = $${paramIndex}`;
      params.push(departman);
      paramIndex++;
    }

    if (durum) {
      sql += ` AND p.durum = $${paramIndex}`;
      params.push(durum);
      paramIndex++;
    }

    if (proje_id) {
      sql += ` AND p.id IN (SELECT personel_id FROM proje_personelleri WHERE proje_id = $${paramIndex} AND aktif = TRUE)`;
      params.push(proje_id);
      paramIndex++;
    }

    if (sadece_atamasiz === 'true') {
      sql += ` AND p.id NOT IN (SELECT personel_id FROM proje_personelleri WHERE aktif = TRUE)`;
    }

    sql += ` ORDER BY p.ad, p.soyad`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PERSONEL DETAYI
// =====================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT 
        p.*,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'proje_id', pr.id,
              'proje_ad', pr.ad,
              'proje_kod', pr.kod,
              'gorev', pp.gorev,
              'baslangic_tarihi', pp.baslangic_tarihi,
              'bitis_tarihi', pp.bitis_tarihi,
              'atama_id', pp.id
            )
          ) FILTER (WHERE pr.id IS NOT NULL)
          FROM proje_personelleri pp
          JOIN projeler pr ON pr.id = pp.proje_id
          WHERE pp.personel_id = p.id AND pp.aktif = TRUE
          ),
          '[]'::json
        ) as projeler
      FROM personeller p
      WHERE p.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Personel bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// YENİ PERSONEL EKLE
// =====================================================
router.post('/', authenticate, requirePermission('personel', 'create'), validate(createPersonelSchema), auditLog('personel'), async (req, res) => {
  try {
    const {
      ad,
      soyad,
      tc_kimlik,
      telefon,
      email,
      adres,
      departman,
      pozisyon,
      ise_giris_tarihi,
      maas,
      maas_tipi,
      iban,
      dogum_tarihi,
      cinsiyet,
      notlar,
      sicil_no,
      acil_kisi,
      acil_telefon,
      durum,
      // Bordro alanları
      medeni_durum,
      es_calisiyormu,
      cocuk_sayisi,
      engel_derecesi,
      sgk_no,
      yemek_yardimi,
      yol_yardimi,
    } = req.body;

    const result = await query(
      `
      INSERT INTO personeller (
        ad, soyad, tc_kimlik, telefon, email, adres,
        departman, pozisyon, ise_giris_tarihi, maas, maas_tipi,
        iban, dogum_tarihi, cinsiyet, notlar, sicil_no,
        acil_kisi, acil_telefon, durum,
        medeni_durum, es_calisiyormu, cocuk_sayisi, engel_derecesi, sgk_no, yemek_yardimi, yol_yardimi
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *
    `,
      [
        ad,
        soyad,
        tc_kimlik,
        telefon || null,
        email || null,
        adres || null,
        departman || null,
        pozisyon || null,
        ise_giris_tarihi,
        maas || 0,
        maas_tipi || 'aylik',
        iban || null,
        dogum_tarihi || null,
        cinsiyet || null,
        notlar || null,
        sicil_no || null,
        acil_kisi || null,
        acil_telefon || null,
        durum || 'aktif',
        medeni_durum || 'bekar',
        es_calisiyormu || false,
        cocuk_sayisi || 0,
        engel_derecesi || 0,
        sgk_no || null,
        yemek_yardimi || 0,
        yol_yardimi || 0,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint?.includes('tc_kimlik')) {
        return res.status(400).json({ success: false, error: 'Bu TC kimlik numarası zaten kayıtlı' });
      }
      if (error.constraint?.includes('sicil_no')) {
        return res.status(400).json({ success: false, error: 'Bu sicil numarası zaten kullanılıyor' });
      }
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PERSONEL GÜNCELLE
// =====================================================
router.put('/:id', authenticate, requirePermission('personel', 'edit'), validate(updatePersonelSchema), auditLog('personel'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ad,
      soyad,
      tc_kimlik,
      telefon,
      email,
      adres,
      departman,
      pozisyon,
      ise_giris_tarihi,
      isten_cikis_tarihi,
      maas,
      maas_tipi,
      iban,
      dogum_tarihi,
      cinsiyet,
      notlar,
      sicil_no,
      acil_kisi,
      acil_telefon,
      durum,
      // Bordro alanları
      medeni_durum,
      es_calisiyormu,
      cocuk_sayisi,
      engel_derecesi,
      sgk_no,
      yemek_yardimi,
      yol_yardimi,
    } = req.body;

    const result = await query(
      `
      UPDATE personeller SET
        ad = COALESCE($2, ad),
        soyad = COALESCE($3, soyad),
        tc_kimlik = COALESCE($4, tc_kimlik),
        telefon = $5,
        email = $6,
        adres = $7,
        departman = $8,
        pozisyon = $9,
        ise_giris_tarihi = COALESCE($10, ise_giris_tarihi),
        isten_cikis_tarihi = $11,
        maas = COALESCE($12, maas),
        maas_tipi = COALESCE($13, maas_tipi),
        iban = $14,
        dogum_tarihi = $15,
        cinsiyet = $16,
        notlar = $17,
        sicil_no = $18,
        acil_kisi = $19,
        acil_telefon = $20,
        durum = COALESCE($21, durum),
        medeni_durum = COALESCE($22, medeni_durum),
        es_calisiyormu = COALESCE($23, es_calisiyormu),
        cocuk_sayisi = COALESCE($24, cocuk_sayisi),
        engel_derecesi = COALESCE($25, engel_derecesi),
        sgk_no = $26,
        yemek_yardimi = COALESCE($27, yemek_yardimi),
        yol_yardimi = COALESCE($28, yol_yardimi),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
      [
        id,
        ad,
        soyad,
        tc_kimlik,
        telefon,
        email,
        adres,
        departman,
        pozisyon,
        ise_giris_tarihi,
        isten_cikis_tarihi,
        maas,
        maas_tipi,
        iban,
        dogum_tarihi,
        cinsiyet,
        notlar,
        sicil_no,
        acil_kisi,
        acil_telefon,
        durum,
        medeni_durum,
        es_calisiyormu,
        cocuk_sayisi,
        engel_derecesi,
        sgk_no,
        yemek_yardimi,
        yol_yardimi,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Personel bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PERSONEL SİL
// =====================================================
router.delete('/:id', authenticate, requirePermission('personel', 'delete'), auditLog('personel'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM personeller WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Personel bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PROJEye PERSONEL ATA
// =====================================================
router.post('/projeler/:projeId/personel', validate(atamaSchema), async (req, res) => {
  try {
    const { projeId } = req.params;
    const { personel_id, gorev, baslangic_tarihi, bitis_tarihi, notlar } = req.body;

    // Önce mevcut aktif atamayı kontrol et
    const existing = await query(
      `
      SELECT id FROM proje_personelleri 
      WHERE proje_id = $1 AND personel_id = $2 AND aktif = TRUE
    `,
      [projeId, personel_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Bu personel zaten bu projede görevli' });
    }

    const result = await query(
      `
      INSERT INTO proje_personelleri (proje_id, personel_id, gorev, baslangic_tarihi, bitis_tarihi, notlar)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
      [
        projeId,
        personel_id,
        gorev || null,
        baslangic_tarihi || new Date().toISOString().split('T')[0],
        bitis_tarihi || null,
        notlar || null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TOPLU PERSONEL ATA
// =====================================================
router.post('/projeler/:projeId/personel/bulk', validate(topluAtamaSchema), async (req, res) => {
  try {
    const { projeId } = req.params;
    const { personel_ids, gorev, baslangic_tarihi } = req.body;

    const results = [];
    const errors = [];

    for (const personel_id of personel_ids) {
      try {
        // Mevcut aktif atamayı kontrol et
        const existing = await query(
          `
          SELECT id FROM proje_personelleri 
          WHERE proje_id = $1 AND personel_id = $2 AND aktif = TRUE
        `,
          [projeId, personel_id]
        );

        if (existing.rows.length > 0) {
          errors.push({ personel_id, error: 'Zaten atanmış' });
          continue;
        }

        const result = await query(
          `
          INSERT INTO proje_personelleri (proje_id, personel_id, gorev, baslangic_tarihi)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
          [projeId, personel_id, gorev || null, baslangic_tarihi || new Date().toISOString().split('T')[0]]
        );

        results.push(result.rows[0]);
      } catch (err) {
        errors.push({ personel_id, error: err.message });
      }
    }

    res.status(201).json({ success: true, data: results, errors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PROJE ATAMASI GÜNCELLE
// =====================================================
router.put('/atama/:atamaId', validate(updateAtamaSchema), async (req, res) => {
  try {
    const { atamaId } = req.params;
    const { gorev, baslangic_tarihi, bitis_tarihi, notlar, aktif } = req.body;

    const result = await query(
      `
      UPDATE proje_personelleri SET
        gorev = $2,
        baslangic_tarihi = COALESCE($3, baslangic_tarihi),
        bitis_tarihi = $4,
        notlar = $5,
        aktif = COALESCE($6, aktif),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
      [atamaId, gorev, baslangic_tarihi, bitis_tarihi, notlar, aktif]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Atama bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PROJE ATAMASINI KALDIR
// =====================================================
router.delete('/atama/:atamaId', async (req, res) => {
  try {
    const { atamaId } = req.params;

    // Soft delete - aktif = false yap
    const result = await query(
      `
      UPDATE proje_personelleri SET aktif = FALSE, bitis_tarihi = CURRENT_DATE, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
      [atamaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Atama bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// İSTATİSTİKLER
// =====================================================
router.get('/stats/overview', async (_req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM personeller WHERE durum = 'aktif' OR (durum IS NULL AND isten_cikis_tarihi IS NULL)) as toplam_personel,
        (SELECT COUNT(*) FROM personeller WHERE durum = 'izinli') as izinli_personel,
        (SELECT COUNT(*) FROM projeler WHERE durum = 'aktif') as aktif_proje,
        (SELECT COALESCE(SUM(maas), 0) FROM personeller WHERE durum = 'aktif' OR (durum IS NULL AND isten_cikis_tarihi IS NULL)) as toplam_maas,
        (SELECT COUNT(DISTINCT personel_id) FROM proje_personelleri WHERE aktif = TRUE) as gorevli_personel
    `);

    res.json({ success: true, data: stats.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// DEPARTMAN BAZLI İSTATİSTİKLER
// =====================================================
router.get('/stats/departman', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        COALESCE(departman, 'Belirsiz') as departman,
        COUNT(*) as personel_sayisi,
        COALESCE(SUM(maas), 0) as toplam_maas
      FROM personeller
      WHERE durum = 'aktif' OR (durum IS NULL AND isten_cikis_tarihi IS NULL)
      GROUP BY departman
      ORDER BY personel_sayisi DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// GÖREVLER - LİSTELE
// =====================================================
router.get('/gorevler', async (_req, res) => {
  try {
    const result = await query(`
      SELECT * FROM gorevler 
      WHERE aktif = TRUE 
      ORDER BY sira ASC, ad ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// GÖREVLER - EKLE
// =====================================================
router.post('/gorevler', validate(createGorevSchema), async (req, res) => {
  try {
    const { ad, kod, aciklama, renk, ikon, saat_ucreti, gunluk_ucret, sira } = req.body;

    const result = await query(
      `
      INSERT INTO gorevler (ad, kod, aciklama, renk, ikon, saat_ucreti, gunluk_ucret, sira)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [ad, kod, aciklama, renk || '#6366f1', ikon || 'briefcase', saat_ucreti || 0, gunluk_ucret || 0, sira || 0]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, error: 'Bu görev adı zaten mevcut' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// GÖREVLER - GÜNCELLE
// =====================================================
router.put('/gorevler/:id', validate(updateGorevSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, kod, aciklama, renk, ikon, saat_ucreti, gunluk_ucret, sira, aktif } = req.body;

    const result = await query(
      `
      UPDATE gorevler SET
        ad = COALESCE($2, ad),
        kod = $3,
        aciklama = $4,
        renk = COALESCE($5, renk),
        ikon = COALESCE($6, ikon),
        saat_ucreti = COALESCE($7, saat_ucreti),
        gunluk_ucret = COALESCE($8, gunluk_ucret),
        sira = COALESCE($9, sira),
        aktif = COALESCE($10, aktif),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
      [id, ad, kod, aciklama, renk, ikon, saat_ucreti, gunluk_ucret, sira, aktif]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Görev bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// GÖREVLER - SİL
// =====================================================
router.delete('/gorevler/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Kullanımda mı kontrol et
    const usage = await query(
      `
      SELECT COUNT(*) as count FROM proje_personelleri WHERE gorev_id = $1
    `,
      [id]
    );

    if (parseInt(usage.rows[0].count, 10) > 0) {
      // Kullanımdaysa pasife çek
      await query('UPDATE gorevler SET aktif = FALSE WHERE id = $1', [id]);
      return res.json({ success: true, data: null, message: 'Görev kullanımda olduğu için pasife alındı' });
    }

    await query('DELETE FROM gorevler WHERE id = $1', [id]);
    res.json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TAZMİNAT - ÇIKIŞ SEBEPLERİ
// =====================================================
import {
  CIKIS_SEBEPLERI,
  hesaplaTazminat,
  hesaplaTazminatRiski,
  kaydetTazminatHesabi,
  personelCikisYap,
  YASAL_BILGILER,
} from '../services/tazminat-service.js';

router.get('/tazminat/sebepler', async (_req, res) => {
  try {
    res.json({ success: true, data: CIKIS_SEBEPLERI });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TAZMİNAT - YASAL BİLGİLER
// =====================================================
router.get('/tazminat/yasal-bilgiler', async (_req, res) => {
  try {
    res.json({ success: true, data: YASAL_BILGILER });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TAZMİNAT - HESAPLA
// =====================================================
router.post('/tazminat/hesapla', validate(tazminatHesaplaSchema), async (req, res) => {
  try {
    const { personelId, cikisTarihi, cikisSebebi, kalanIzinGun } = req.body;

    const hesap = await hesaplaTazminat(personelId, cikisTarihi, cikisSebebi, kalanIzinGun);
    res.json({ success: true, data: hesap });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TAZMİNAT - KAYDET VE İŞTEN ÇIKAR
// =====================================================
router.post('/tazminat/kaydet', validate(tazminatKaydetSchema), async (req, res) => {
  try {
    const { personelId, cikisTarihi, cikisSebebi, kalanIzinGun, notlar, istenCikar } = req.body;

    // Önce hesapla
    const hesap = await hesaplaTazminat(personelId, cikisTarihi, cikisSebebi, kalanIzinGun);

    // Kaydet
    const tazminatId = await kaydetTazminatHesabi(hesap, notlar);

    // İşten çıkar
    if (istenCikar) {
      await personelCikisYap(personelId, cikisTarihi, cikisSebebi, tazminatId);
    }

    res.json({ success: true, data: { tazminatId, hesap } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TAZMİNAT - RİSK ANALİZİ
// =====================================================
router.get('/tazminat/risk', async (req, res) => {
  try {
    const { projeId } = req.query;
    const risk = await hesaplaTazminatRiski(projeId ? parseInt(projeId, 10) : null);
    res.json({ success: true, data: risk });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TAZMİNAT - GEÇMİŞ HESAPLAR
// =====================================================
router.get('/tazminat/gecmis', async (req, res) => {
  try {
    const { personelId, limit = 50 } = req.query;

    // Limit validation
    const limitValue = parseInt(limit, 10) || 50;
    if (limitValue > 1000) {
      return res.status(400).json({ success: false, error: 'Limit çok yüksek (max: 1000)' });
    }

    let sql = `
      SELECT
        th.*,
        p.ad || ' ' || p.soyad as personel_adi
      FROM tazminat_hesaplari th
      JOIN personeller p ON p.id = th.personel_id
    `;

    const params = [];
    let paramIndex = 1;

    if (personelId) {
      sql += ` WHERE th.personel_id = $${paramIndex}`;
      params.push(personelId);
      paramIndex++;
    }

    sql += ` ORDER BY th.created_at DESC LIMIT $${paramIndex}`;
    params.push(limitValue);

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TAZMİNAT - KALAN İZİN GÜNCELLE
// =====================================================
router.put('/:id/izin-gun', validate(izinGunSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { kalanIzinGun } = req.body;

    const result = await query(
      `
      UPDATE personeller 
      SET kalan_izin_gun = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
      [id, kalanIzinGun]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Personel bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
