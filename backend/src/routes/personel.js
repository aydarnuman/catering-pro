import express from 'express';
import { pool, query } from '../database.js';

const router = express.Router();

// =====================================================
// PERSONEL İSTATİSTİKLERİ (Dashboard Widget için)
// =====================================================
router.get('/stats', async (req, res) => {
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
    
    res.json({
      toplam_personel: parseInt(stats.toplam_personel) || 0,
      aktif_personel: parseInt(stats.aktif_personel) || 0,
      izinli_personel: parseInt(izinResult.rows[0]?.bugun_izinli) || parseInt(stats.izinli_personel) || 0,
      pasif_personel: parseInt(stats.pasif_personel) || 0,
      toplam_maas: Math.round(parseFloat(stats.toplam_maas)) || 0,
      ortalama_maas: Math.round(parseFloat(stats.ortalama_maas)) || 0
    });
  } catch (error) {
    console.error('Personel stats hatası:', error);
    res.status(500).json({ error: error.message });
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
    res.json(result.rows);
  } catch (error) {
    console.error('Projeler listeleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PROJE DETAYI (personellerle birlikte)
// =====================================================
router.get('/projeler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Proje bilgisi
    const projeResult = await query(`
      SELECT 
        p.*,
        COALESCE((SELECT COUNT(*) FROM proje_personelleri pp WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as personel_sayisi,
        COALESCE((SELECT SUM(per.maas) FROM proje_personelleri pp 
                  JOIN personeller per ON per.id = pp.personel_id 
                  WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as toplam_maas
      FROM projeler p
      WHERE p.id = $1
    `, [id]);
    
    if (projeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    // Projedeki personeller
    const personellerResult = await query(`
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
    `, [id]);
    
    res.json({
      ...projeResult.rows[0],
      personeller: personellerResult.rows
    });
  } catch (error) {
    console.error('Proje detayı hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// YENİ PROJE EKLE
// =====================================================
router.post('/projeler', async (req, res) => {
  try {
    const { ad, kod, aciklama, musteri, lokasyon, baslangic_tarihi, bitis_tarihi, butce, durum } = req.body;
    
    if (!ad) {
      return res.status(400).json({ error: 'Proje adı zorunludur' });
    }
    
    const result = await query(`
      INSERT INTO projeler (ad, kod, aciklama, musteri, lokasyon, baslangic_tarihi, bitis_tarihi, butce, durum)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [ad, kod || null, aciklama || null, musteri || null, lokasyon || null, baslangic_tarihi || null, bitis_tarihi || null, butce || 0, durum || 'aktif']);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Proje ekleme hatası:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Bu proje kodu zaten kullanılıyor' });
    }
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PROJE GÜNCELLE
// =====================================================
router.put('/projeler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, kod, aciklama, musteri, lokasyon, baslangic_tarihi, bitis_tarihi, butce, durum } = req.body;
    
    const result = await query(`
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
    `, [id, ad, kod, aciklama, musteri, lokasyon, baslangic_tarihi, bitis_tarihi, butce, durum]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Proje güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
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
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Proje silme hatası:', error);
    res.status(500).json({ error: error.message });
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
    res.json(result.rows);
  } catch (error) {
    console.error('Personeller listeleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PERSONEL DETAYI
// =====================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
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
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personel bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Personel detayı hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// YENİ PERSONEL EKLE
// =====================================================
router.post('/', async (req, res) => {
  try {
    const { 
      ad, soyad, tc_kimlik, telefon, email, adres, 
      departman, pozisyon, ise_giris_tarihi, maas, maas_tipi,
      iban, dogum_tarihi, cinsiyet, notlar, sicil_no,
      acil_kisi, acil_telefon, durum,
      // Bordro alanları
      medeni_durum, es_calisiyormu, cocuk_sayisi, engel_derecesi, sgk_no, yemek_yardimi, yol_yardimi
    } = req.body;
    
    if (!ad || !soyad || !tc_kimlik || !ise_giris_tarihi) {
      return res.status(400).json({ error: 'Ad, soyad, TC kimlik ve işe giriş tarihi zorunludur' });
    }
    
    const result = await query(`
      INSERT INTO personeller (
        ad, soyad, tc_kimlik, telefon, email, adres,
        departman, pozisyon, ise_giris_tarihi, maas, maas_tipi,
        iban, dogum_tarihi, cinsiyet, notlar, sicil_no,
        acil_kisi, acil_telefon, durum,
        medeni_durum, es_calisiyormu, cocuk_sayisi, engel_derecesi, sgk_no, yemek_yardimi, yol_yardimi
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *
    `, [
      ad, soyad, tc_kimlik, telefon || null, email || null, adres || null,
      departman || null, pozisyon || null, ise_giris_tarihi, maas || 0, maas_tipi || 'aylik',
      iban || null, dogum_tarihi || null, cinsiyet || null, notlar || null, sicil_no || null,
      acil_kisi || null, acil_telefon || null, durum || 'aktif',
      medeni_durum || 'bekar', es_calisiyormu || false, cocuk_sayisi || 0, engel_derecesi || 0, sgk_no || null, yemek_yardimi || 0, yol_yardimi || 0
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Personel ekleme hatası:', error);
    if (error.code === '23505') {
      if (error.constraint?.includes('tc_kimlik')) {
        return res.status(400).json({ error: 'Bu TC kimlik numarası zaten kayıtlı' });
      }
      if (error.constraint?.includes('sicil_no')) {
        return res.status(400).json({ error: 'Bu sicil numarası zaten kullanılıyor' });
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PERSONEL GÜNCELLE
// =====================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      ad, soyad, tc_kimlik, telefon, email, adres, 
      departman, pozisyon, ise_giris_tarihi, isten_cikis_tarihi, maas, maas_tipi,
      iban, dogum_tarihi, cinsiyet, notlar, sicil_no,
      acil_kisi, acil_telefon, durum,
      // Bordro alanları
      medeni_durum, es_calisiyormu, cocuk_sayisi, engel_derecesi, sgk_no, yemek_yardimi, yol_yardimi
    } = req.body;
    
    const result = await query(`
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
    `, [
      id, ad, soyad, tc_kimlik, telefon, email, adres,
      departman, pozisyon, ise_giris_tarihi, isten_cikis_tarihi, maas, maas_tipi,
      iban, dogum_tarihi, cinsiyet, notlar, sicil_no,
      acil_kisi, acil_telefon, durum,
      medeni_durum, es_calisiyormu, cocuk_sayisi, engel_derecesi, sgk_no, yemek_yardimi, yol_yardimi
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personel bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Personel güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PERSONEL SİL
// =====================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM personeller WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personel bulunamadı' });
    }
    
    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Personel silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PROJEye PERSONEL ATA
// =====================================================
router.post('/projeler/:projeId/personel', async (req, res) => {
  try {
    const { projeId } = req.params;
    const { personel_id, gorev, baslangic_tarihi, bitis_tarihi, notlar } = req.body;
    
    if (!personel_id) {
      return res.status(400).json({ error: 'Personel ID zorunludur' });
    }
    
    // Önce mevcut aktif atamayı kontrol et
    const existing = await query(`
      SELECT id FROM proje_personelleri 
      WHERE proje_id = $1 AND personel_id = $2 AND aktif = TRUE
    `, [projeId, personel_id]);
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Bu personel zaten bu projede görevli' });
    }
    
    const result = await query(`
      INSERT INTO proje_personelleri (proje_id, personel_id, gorev, baslangic_tarihi, bitis_tarihi, notlar)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [projeId, personel_id, gorev || null, baslangic_tarihi || new Date().toISOString().split('T')[0], bitis_tarihi || null, notlar || null]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Personel atama hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// TOPLU PERSONEL ATA
// =====================================================
router.post('/projeler/:projeId/personel/bulk', async (req, res) => {
  try {
    const { projeId } = req.params;
    const { personel_ids, gorev, baslangic_tarihi } = req.body;
    
    if (!personel_ids || !Array.isArray(personel_ids) || personel_ids.length === 0) {
      return res.status(400).json({ error: 'En az bir personel seçmelisiniz' });
    }
    
    const results = [];
    const errors = [];
    
    for (const personel_id of personel_ids) {
      try {
        // Mevcut aktif atamayı kontrol et
        const existing = await query(`
          SELECT id FROM proje_personelleri 
          WHERE proje_id = $1 AND personel_id = $2 AND aktif = TRUE
        `, [projeId, personel_id]);
        
        if (existing.rows.length > 0) {
          errors.push({ personel_id, error: 'Zaten atanmış' });
          continue;
        }
        
        const result = await query(`
          INSERT INTO proje_personelleri (proje_id, personel_id, gorev, baslangic_tarihi)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [projeId, personel_id, gorev || null, baslangic_tarihi || new Date().toISOString().split('T')[0]]);
        
        results.push(result.rows[0]);
      } catch (err) {
        errors.push({ personel_id, error: err.message });
      }
    }
    
    res.status(201).json({ success: results, errors });
  } catch (error) {
    console.error('Toplu personel atama hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PROJE ATAMASI GÜNCELLE
// =====================================================
router.put('/atama/:atamaId', async (req, res) => {
  try {
    const { atamaId } = req.params;
    const { gorev, baslangic_tarihi, bitis_tarihi, notlar, aktif } = req.body;
    
    const result = await query(`
      UPDATE proje_personelleri SET
        gorev = $2,
        baslangic_tarihi = COALESCE($3, baslangic_tarihi),
        bitis_tarihi = $4,
        notlar = $5,
        aktif = COALESCE($6, aktif),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [atamaId, gorev, baslangic_tarihi, bitis_tarihi, notlar, aktif]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Atama bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Atama güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PROJE ATAMASINI KALDIR
// =====================================================
router.delete('/atama/:atamaId', async (req, res) => {
  try {
    const { atamaId } = req.params;
    
    // Soft delete - aktif = false yap
    const result = await query(`
      UPDATE proje_personelleri SET aktif = FALSE, bitis_tarihi = CURRENT_DATE, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [atamaId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Atama bulunamadı' });
    }
    
    res.json({ success: true, removed: result.rows[0] });
  } catch (error) {
    console.error('Atama kaldırma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// İSTATİSTİKLER
// =====================================================
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM personeller WHERE durum = 'aktif' OR (durum IS NULL AND isten_cikis_tarihi IS NULL)) as toplam_personel,
        (SELECT COUNT(*) FROM personeller WHERE durum = 'izinli') as izinli_personel,
        (SELECT COUNT(*) FROM projeler WHERE durum = 'aktif') as aktif_proje,
        (SELECT COALESCE(SUM(maas), 0) FROM personeller WHERE durum = 'aktif' OR (durum IS NULL AND isten_cikis_tarihi IS NULL)) as toplam_maas,
        (SELECT COUNT(DISTINCT personel_id) FROM proje_personelleri WHERE aktif = TRUE) as gorevli_personel
    `);
    
    res.json(stats.rows[0]);
  } catch (error) {
    console.error('İstatistik hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// DEPARTMAN BAZLI İSTATİSTİKLER
// =====================================================
router.get('/stats/departman', async (req, res) => {
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
    
    res.json(result.rows);
  } catch (error) {
    console.error('Departman istatistik hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

