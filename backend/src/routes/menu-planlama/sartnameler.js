import express from 'express';
import { query } from '../../database.js';

const router = express.Router();

// =============================================
// ŞARTNAME VE GRAMAJ YÖNETİMİ
// =============================================

// Kurumları listele
router.get('/sartname/kurumlar', async (_req, res) => {
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
    const { kurum_id: _kurum_id, proje_id: _proje_id, aktif = true } = req.query;

    const whereConditions = [];
    const params = [];
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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `
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
    `,
      params
    );

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

    const result = await query(
      `
      INSERT INTO proje_sartnameleri (kod, ad, kurum_id, yil, versiyon, kaynak_url, kaynak_aciklama, notlar)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [kod, ad, kurum_id, yil || new Date().getFullYear(), versiyon || '1.0', kaynak_url, kaynak_aciklama, notlar]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şartname detayı
router.get('/sartname/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const sartname = await query(
      `
      SELECT ps.*, sk.ad as kurum_adi, sk.ikon as kurum_ikon
      FROM proje_sartnameleri ps
      LEFT JOIN sartname_kurumlari sk ON sk.id = ps.kurum_id
      WHERE ps.id = $1
    `,
      [id]
    );

    if (sartname.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Şartname bulunamadı' });
    }

    // Porsiyon gramajlarını al
    const gramajlar = await query(
      `
      SELECT
        spg.*,
        rk.ad as kategori_adi,
        rk.ikon as kategori_ikon
      FROM sartname_porsiyon_gramajlari spg
      LEFT JOIN recete_kategoriler rk ON rk.id = spg.kategori_id
      WHERE spg.sartname_id = $1 AND spg.aktif = true
      ORDER BY spg.sira, spg.yemek_turu
    `,
      [id]
    );

    // Öğün yapılarını al (aktif/pasif hepsini getir)
    const ogunYapilari = await query(
      `
      SELECT * FROM sartname_ogun_yapisi
      WHERE sartname_id = $1
      ORDER BY CASE ogun_tipi WHEN 'kahvalti' THEN 1 WHEN 'ogle' THEN 2 WHEN 'aksam' THEN 3 END
    `,
      [id]
    );

    // Atanan projeleri al
    const projeler = await query(
      `
      SELECT
        p.id, p.ad, p.kod,
        psa.varsayilan, psa.baslangic_tarihi, psa.bitis_tarihi
      FROM proje_sartname_atamalari psa
      JOIN projeler p ON p.id = psa.proje_id
      WHERE psa.sartname_id = $1
    `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...sartname.rows[0],
        gramajlar: gramajlar.rows,
        ogun_yapilari: ogunYapilari.rows,
        projeler: projeler.rows,
      },
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

    const result = await query(
      `
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
    `,
      [ad, kurum_id, yil, versiyon, kaynak_url, kaynak_aciklama, notlar, aktif, id]
    );

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
      await query(
        `
        UPDATE proje_sartname_atamalari
        SET varsayilan = false
        WHERE proje_id = $1 AND sartname_id != $2
      `,
        [proje_id, sartnameId]
      );
    }

    const result = await query(
      `
      INSERT INTO proje_sartname_atamalari (proje_id, sartname_id, varsayilan)
      VALUES ($1, $2, $3)
      ON CONFLICT (proje_id, sartname_id) DO UPDATE SET
        varsayilan = EXCLUDED.varsayilan
      RETURNING *
    `,
      [proje_id, sartnameId, varsayilan || false]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proje için şartnameleri getir
router.get('/proje/:projeId/sartnameler', async (req, res) => {
  try {
    const { projeId } = req.params;

    const result = await query(
      `
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
    `,
      [projeId]
    );

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

    const result = await query(
      `
      INSERT INTO sartname_porsiyon_gramajlari (
        sartname_id, kategori_id, yemek_turu, porsiyon_gramaj, birim, aciklama, sira
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [sartnameId, kategori_id, yemek_turu, porsiyon_gramaj, birim || 'g', aciklama, sira || 0]
    );

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

    const result = await query(
      `
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
    `,
      [kategori_id, yemek_turu, porsiyon_gramaj, birim, aciklama, sira, aktif, gramajId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gramaj sil (soft delete)
router.delete('/sartname/gramaj/:gramajId', async (req, res) => {
  try {
    const { gramajId } = req.params;

    await query(
      `
      UPDATE sartname_porsiyon_gramajlari SET aktif = false WHERE id = $1
    `,
      [gramajId]
    );

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

    const result = await query(
      `
      INSERT INTO sartname_ogun_yapisi (
        sartname_id, ogun_tipi, min_cesit, max_cesit, zorunlu_kategoriler, aciklama
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
      [sartnameId, ogun_tipi, min_cesit, max_cesit, zorunlu_kategoriler, aciklama]
    );

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
    const result = await query(
      `
      UPDATE sartname_ogun_yapisi
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Öğün yapısı bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
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
    const recete = await query(
      `
      SELECT r.*, rk.ad as kategori_adi
      FROM receteler r
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE r.id = $1
    `,
      [receteId]
    );

    if (recete.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }

    const malzemeler = await query(
      `
      SELECT rm.*, urk.ad as stok_adi
      FROM recete_malzemeler rm
      LEFT JOIN urun_kartlari urk ON urk.id = rm.urun_kart_id
      WHERE rm.recete_id = $1
    `,
      [receteId]
    );

    // Şartname ID bul
    let sartnameIdToUse = sartname_id;

    if (!sartnameIdToUse && proje_id) {
      const sartname = await query(
        `
        SELECT sartname_id FROM proje_sartname_atamalari
        WHERE proje_id = $1 AND varsayilan = true
        LIMIT 1
      `,
        [proje_id]
      );
      sartnameIdToUse = sartname.rows[0]?.sartname_id;
    }

    if (!sartnameIdToUse) {
      return res.json({
        success: true,
        data: {
          recete: recete.rows[0],
          malzemeler: malzemeler.rows,
          gramaj_kontrol: null,
          mesaj: 'Şartname belirtilmedi',
        },
      });
    }

    // Şartname gramajlarını al
    const gramajlar = await query(
      `
      SELECT * FROM sartname_gramajlari
      WHERE sartname_id = $1 AND aktif = true
        AND (yemek_turu ILIKE $2 OR yemek_adi ILIKE $2 OR kategori_id = $3)
    `,
      [sartnameIdToUse, `%${recete.rows[0].ad}%`, recete.rows[0].kategori_id]
    );

    // Kontrol sonuçları
    const kontrolSonuclari = [];
    let toplamUygun = 0;
    let toplamUyumsuz = 0;

    for (const malzeme of malzemeler.rows) {
      // Bu malzeme için şartname gramajı var mı?
      const eslesenGramaj = gramajlar.rows.find(
        (g) =>
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
          zorunlu: eslesenGramaj.zorunlu,
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
          toplam_kontrol: kontrolSonuclari.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
