import express from 'express';
import { query } from '../../database.js';
import { kuralBul, receteSartnameMalzemeOnizleme } from '../../services/sartname-onizleme.js';
import { donusumCarpaniAlSync } from '../../utils/birim-donusum.js';

const router = express.Router();

// =============================================
// ŞARTNAME VE GRAMAJ YÖNETİMİ
// =============================================
//
// Gramaj için iki yapı vardır:
// - sartname_gramaj_kurallari (alt_tip + malzeme_tipi): Ana sistem. UI toplu uygulama,
//   önizleme ve uyum kontrolü bu tabloyu kullanır.
// - sartname_porsiyon_gramajlari (kategori + yemek_turu): Eski yapı. API şartname detayda
//   gramajlar olarak döner; yeni özellikler sadece gramaj kuralları ile çalışır.
//

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
    const { kurum_id, aktif = 'true' } = req.query;

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
        (SELECT COUNT(*) FROM sartname_gramaj_kurallari sgk WHERE sgk.sartname_id = ps.id AND sgk.aktif = true) as gramaj_sayisi,
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
    const { kod: inputKod, ad, kurum_id, yil, versiyon, kaynak_url, kaynak_aciklama, notlar } = req.body;

    if (!ad) {
      return res.status(400).json({ success: false, error: 'Ad zorunlu' });
    }

    // Kod verilmediyse ad'dan otomatik oluştur (büyük harf, Türkçe karakter temizle)
    const kod =
      inputKod ||
      ad
        .toUpperCase()
        .replace(/[ÇçĞğİıÖöŞşÜü]/g, (c) => {
          const map = {
            Ç: 'C',
            ç: 'C',
            Ğ: 'G',
            ğ: 'G',
            İ: 'I',
            ı: 'I',
            Ö: 'O',
            ö: 'O',
            Ş: 'S',
            ş: 'S',
            Ü: 'U',
            ü: 'U',
          };
          return map[c] || c;
        })
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 30);

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

// =============================================
// SABİT PATH ROUTE'LARI (/:id'den ÖNCE olmalı!)
// =============================================

// Alt tipleri listele (kategori gruplanmış)
router.get('/sartname/alt-tipler', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        att.*,
        rk.ad as kategori_adi,
        rk.ikon as kategori_ikon,
        rk.kod as kategori_kodu
      FROM alt_tip_tanimlari att
      LEFT JOIN recete_kategoriler rk ON rk.id = att.kategori_id
      WHERE att.aktif = true
      ORDER BY rk.sira, att.sira
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Alt tip ekle
router.post('/sartname/alt-tipler', async (req, res) => {
  try {
    const { kod, ad, kategori_id, aciklama, ikon } = req.body;

    if (!kod || !ad) {
      return res.status(400).json({ success: false, error: 'Kod ve ad zorunlu' });
    }

    const result = await query(
      `
      INSERT INTO alt_tip_tanimlari (kod, ad, kategori_id, aciklama, ikon, sira)
      VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sira), 0) + 1 FROM alt_tip_tanimlari WHERE kategori_id = $3))
      RETURNING *
    `,
      [kod, ad, kategori_id, aciklama, ikon]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Bu kod zaten mevcut' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Alt tip güncelle
router.put('/sartname/alt-tipler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, aciklama, ikon, aktif, sira } = req.body;

    const result = await query(
      `
      UPDATE alt_tip_tanimlari
      SET ad = COALESCE($1, ad),
          aciklama = COALESCE($2, aciklama),
          ikon = COALESCE($3, ikon),
          aktif = COALESCE($4, aktif),
          sira = COALESCE($5, sira)
      WHERE id = $6
      RETURNING *
    `,
      [ad, aciklama, ikon, aktif, sira, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alt tip bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Malzeme eşleme sözlüğünü getir
router.get('/sartname/malzeme-eslesmeleri', async (_req, res) => {
  try {
    const result = await query(`
      SELECT * FROM malzeme_tip_eslesmeleri
      WHERE aktif = true
      ORDER BY malzeme_tipi
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gramaj kuralı güncelle (sabit path)
router.put('/sartname/gramaj-kurallari/:kuralId', async (req, res) => {
  try {
    const { kuralId } = req.params;
    const { alt_tip_id, malzeme_tipi, gramaj, birim, aciklama, sira, aktif } = req.body;

    const result = await query(
      `
      UPDATE sartname_gramaj_kurallari
      SET alt_tip_id = COALESCE($1, alt_tip_id),
          malzeme_tipi = COALESCE($2, malzeme_tipi),
          gramaj = COALESCE($3, gramaj),
          birim = COALESCE($4, birim),
          aciklama = COALESCE($5, aciklama),
          sira = COALESCE($6, sira),
          aktif = COALESCE($7, aktif)
      WHERE id = $8
      RETURNING *
    `,
      [alt_tip_id, malzeme_tipi, gramaj, birim, aciklama, sira, aktif, kuralId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Gramaj kuralı bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gramaj kuralı sil (sabit path, soft delete)
router.delete('/sartname/gramaj-kurallari/:kuralId', async (req, res) => {
  try {
    const { kuralId } = req.params;

    await query('UPDATE sartname_gramaj_kurallari SET aktif = false WHERE id = $1', [kuralId]);

    res.json({ success: true, message: 'Gramaj kuralı silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Malzeme eşleme güncelle (sabit path)
router.put('/sartname/malzeme-eslesmeleri/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { eslesen_kelimeler, urun_kategori_kodlari, aciklama } = req.body;

    const result = await query(
      `
      UPDATE malzeme_tip_eslesmeleri
      SET eslesen_kelimeler = COALESCE($1, eslesen_kelimeler),
          urun_kategori_kodlari = COALESCE($2, urun_kategori_kodlari),
          aciklama = COALESCE($3, aciklama)
      WHERE id = $4
      RETURNING *
    `,
      [eslesen_kelimeler, urun_kategori_kodlari, aciklama, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Eşleme bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni malzeme eşleme ekle
router.post('/sartname/malzeme-eslesmeleri', async (req, res) => {
  try {
    const { malzeme_tipi, eslesen_kelimeler, urun_kategori_kodlari, aciklama } = req.body;

    if (!malzeme_tipi || !eslesen_kelimeler?.length) {
      return res.status(400).json({ success: false, error: 'Malzeme tipi ve eşleşen kelimeler zorunlu' });
    }

    const result = await query(
      `
      INSERT INTO malzeme_tip_eslesmeleri (malzeme_tipi, eslesen_kelimeler, urun_kategori_kodlari, aciklama)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [malzeme_tipi, eslesen_kelimeler, urun_kategori_kodlari || [], aciklama]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// PARAMETRELİ ROUTE'LAR (/:id ile)
// =============================================

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
        (SELECT COUNT(*) FROM sartname_gramaj_kurallari sgk WHERE sgk.sartname_id = ps.id AND sgk.aktif = true) as gramaj_sayisi
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
// GRAMAJ KURALLARI (YENİ SİSTEM - /:id parametreli)
// =============================================

// Şartnamenin gramaj kurallarını getir (alt tip gruplanmış)
router.get('/sartname/:id/gramaj-kurallari', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        sgk.*,
        att.kod as alt_tip_kodu,
        att.ad as alt_tip_adi,
        att.ikon as alt_tip_ikon,
        rk.ad as kategori_adi,
        rk.ikon as kategori_ikon,
        rk.kod as kategori_kodu
      FROM sartname_gramaj_kurallari sgk
      JOIN alt_tip_tanimlari att ON att.id = sgk.alt_tip_id
      LEFT JOIN recete_kategoriler rk ON rk.id = att.kategori_id
      WHERE sgk.sartname_id = $1 AND sgk.aktif = true
      ORDER BY rk.sira, att.sira, sgk.sira
    `,
      [id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gramaj kuralı ekle
router.post('/sartname/:id/gramaj-kurallari', async (req, res) => {
  try {
    const { id } = req.params;
    const { alt_tip_id, malzeme_tipi, gramaj, birim, aciklama } = req.body;

    if (!alt_tip_id || !malzeme_tipi || gramaj == null) {
      return res.status(400).json({ success: false, error: 'Alt tip, malzeme tipi ve gramaj zorunlu' });
    }

    const result = await query(
      `
      INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, aciklama, sira)
      VALUES ($1, $2, $3, $4, $5, $6,
        (SELECT COALESCE(MAX(sira), 0) + 1 FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND alt_tip_id = $2))
      RETURNING *
    `,
      [id, alt_tip_id, malzeme_tipi, gramaj, birim || 'g', aciklama]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Bu alt tip ve malzeme tipi kombinasyonu zaten mevcut' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// TOPLU UYGULAMA
// Şartname gramajlarını reçetelere toplu uygula
// =============================================

// Toplu gramaj uygulama (eşleme: sartname-onizleme ile aynı çok katmanlı mantık)
router.post('/sartname/:sartnameId/toplu-uygula', async (req, res) => {
  try {
    const { sartnameId } = req.params;
    const { recete_ids, kategori_id, alt_tip_id: filterAltTipId } = req.body;

    // 1. Şartname kurallarını al
    const kurallarResult = await query(
      `SELECT * FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true`,
      [sartnameId]
    );
    const kurallar = kurallarResult.rows;

    if (kurallar.length === 0) {
      return res.status(400).json({ success: false, error: 'Bu şartnameye ait gramaj kuralı bulunamadı' });
    }

    // 2. Malzeme eşleme sözlüğünü al
    const sozlukResult = await query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true');
    const sozluk = sozlukResult.rows;

    // 3. Hedef reçeteleri bul
    let receteQuery = `
      SELECT r.id, r.ad, r.alt_tip_id, r.kategori_id
      FROM receteler r
      WHERE r.aktif = true AND r.alt_tip_id IS NOT NULL
    `;
    const receteParams = [];
    let paramIdx = 1;

    if (recete_ids?.length) {
      receteQuery += ` AND r.id = ANY($${paramIdx})`;
      receteParams.push(recete_ids);
      paramIdx++;
    }
    if (kategori_id) {
      receteQuery += ` AND r.kategori_id = $${paramIdx}`;
      receteParams.push(kategori_id);
      paramIdx++;
    }
    if (filterAltTipId) {
      receteQuery += ` AND r.alt_tip_id = $${paramIdx}`;
      receteParams.push(filterAltTipId);
    }

    const recetelerResult = await query(receteQuery, receteParams);
    const receteler = recetelerResult.rows;

    if (receteler.length === 0) {
      return res.json({
        success: true,
        data: {
          guncellenen_recete: 0,
          guncellenen_malzeme: 0,
          eslesmeyenler: [],
          mesaj: 'Uygulanacak reçete bulunamadı',
        },
      });
    }

    let guncelRecete = 0;
    let guncelMalzeme = 0;
    const eslesmeyenler = [];

    for (const recete of receteler) {
      // alt_tip_id'si olmayan reçeteler gramaj kontrolünden atlanır — kullanıcıya bildir
      if (!recete.alt_tip_id) {
        eslesmeyenler.push({
          recete_id: recete.id,
          recete_ad: recete.ad,
          sebep: 'alt_tip_id tanımlanmamış — gramaj kuralı uygulanamaz',
        });
        continue;
      }

      // Bu reçetenin alt tipine ait kuralları filtrele (Number ile tip güvenli karşılaştırma)
      const receteKurallari = kurallar.filter((k) => Number(k.alt_tip_id) === Number(recete.alt_tip_id));
      if (receteKurallari.length === 0) continue;

      // Reçetenin malzemelerini al
      const malzemeResult = await query(
        `SELECT id, malzeme_adi, miktar, birim FROM recete_malzemeler WHERE recete_id = $1`,
        [recete.id]
      );

      let receteDegisti = false;

      // Malzeme merkezli eşleme: her malzeme için önizleme ile aynı kuralBul kullanılır
      for (const malzeme of malzemeResult.rows) {
        const sonuc = kuralBul(malzeme.malzeme_adi, sozluk, receteKurallari, kurallar);
        if (sonuc) {
          await query(`UPDATE recete_malzemeler SET miktar = $1, birim = $2 WHERE id = $3`, [
            sonuc.kural.gramaj,
            sonuc.kural.birim,
            malzeme.id,
          ]);
          guncelMalzeme++;
          receteDegisti = true;
        }
      }

      if (receteDegisti) guncelRecete++;
    }

    res.json({
      success: true,
      data: {
        guncellenen_recete: guncelRecete,
        guncellenen_malzeme: guncelMalzeme,
        toplam_recete: receteler.length,
        eslesmeyenler,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// GRAMAJ ÖNİZLEME (YENİ SİSTEM - Modal için)
// Reçete malzemeleri + şartname override gramajları
// =============================================

router.get('/recete/:receteId/sartname/:sartnameId/gramaj-onizleme', async (req, res) => {
  try {
    const { receteId, sartnameId } = req.params;
    const result = await receteSartnameMalzemeOnizleme(Number(receteId), Number(sartnameId));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// GRAMAJ KONTROL (YENİ SİSTEM)
// Reçetenin gramajlarını şartname kurallarıyla karşılaştır
// =============================================

/**
 * Tek reçete için gramaj kontrolü sonucu (malzemeler + kurallar + sözlük verildiğinde)
 * Eşleşme: sözlük + doğrudan isim eşleşme (kuralBul ile aynı mantık)
 * @returns {{ uygun_sayisi: number, uyumsuz_sayisi: number, toplam_kontrol: number, sonuclar: Array }}
 */
/**
 * Gramaj kontrol hesaplama — malzemeleri kurallara göre karşılaştır.
 * Önizleme ile tutarlı 4-katmanlı kuralBul() eşleşmesi kullanır (Bug #8, #14 fix).
 *
 * @param {Array} malzemelerRows - reçete malzemeleri
 * @param {Array} altTipKurallar - belirli alt tipe ait kurallar
 * @param {Array} tumKurallar - şartnamenin TÜM kuralları (fallback için)
 * @param {Array} sozluk - malzeme_tip_eslesmeleri
 */
function gramajKontrolHesapla(malzemelerRows, altTipKurallar, tumKurallar, sozluk) {
  const kontrolSonuclari = [];
  let toplamUygun = 0;
  let toplamUyumsuz = 0;

  // Eşleştirilmiş kural malzeme_tipi'lerini takip et (her malzeme için bir kural)
  const eslesilenKurallar = new Set();

  for (const malzeme of malzemelerRows) {
    const sonuc = kuralBul(malzeme.malzeme_adi, sozluk, altTipKurallar, tumKurallar);
    if (sonuc) {
      eslesilenKurallar.add(sonuc.malzeme_tipi);

      // Her iki tarafı da gram'a çevirerek karşılaştır (Bug #1 fix)
      const malzemeBirimi = (malzeme.birim || 'g').toLowerCase();
      const kuralBirimi = (sonuc.kural.birim || 'g').toLowerCase();
      const malzemeMiktar = parseFloat(malzeme.miktar) || 0;
      const kuralMiktar = parseFloat(sonuc.kural.gramaj);
      const gercekGramaj = malzemeMiktar * donusumCarpaniAlSync(malzemeBirimi, 'g');
      const hedefGramaj = kuralMiktar * donusumCarpaniAlSync(kuralBirimi, 'g');
      const tolerans = hedefGramaj * 0.15;
      let durum = 'uygun';
      if (gercekGramaj < hedefGramaj - tolerans) durum = 'dusuk';
      else if (gercekGramaj > hedefGramaj + tolerans) durum = 'yuksek';
      if (durum === 'uygun') toplamUygun++;
      else toplamUyumsuz++;
      kontrolSonuclari.push({
        malzeme_adi: malzeme.malzeme_adi,
        malzeme_tipi: sonuc.malzeme_tipi,
        kaynak: sonuc.kaynak,
        recete_gramaj: gercekGramaj,
        recete_orijinal_miktar: malzemeMiktar,
        recete_orijinal_birim: malzemeBirimi,
        hedef_gramaj: hedefGramaj,
        birim: sonuc.kural.birim,
        durum,
      });
    }
  }

  // Eşleşmeyen kuralları "eksik" olarak ekle (altTipKurallar'dan)
  for (const kural of altTipKurallar) {
    if (!eslesilenKurallar.has(kural.malzeme_tipi)) {
      toplamUyumsuz++;
      kontrolSonuclari.push({
        malzeme_adi: null,
        malzeme_tipi: kural.malzeme_tipi,
        kaynak: 'alt_tip',
        recete_gramaj: null,
        hedef_gramaj: parseFloat(kural.gramaj),
        birim: kural.birim,
        durum: 'eksik',
      });
    }
  }

  return {
    uygun_sayisi: toplamUygun,
    uyumsuz_sayisi: toplamUyumsuz,
    toplam_kontrol: kontrolSonuclari.length,
    sonuclar: kontrolSonuclari,
  };
}

router.get('/recete/:receteId/gramaj-kontrol', async (req, res) => {
  try {
    const { receteId } = req.params;
    const { sartname_id, proje_id } = req.query;

    const recete = await query(
      `
      SELECT r.*, rk.ad as kategori_adi, att.ad as alt_tip_adi, att.kod as alt_tip_kodu
      FROM receteler r
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      LEFT JOIN alt_tip_tanimlari att ON att.id = r.alt_tip_id
      WHERE r.id = $1
    `,
      [receteId]
    );

    if (recete.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }

    const malzemeler = await query(
      `SELECT rm.*, urk.ad as stok_adi
       FROM recete_malzemeler rm
       LEFT JOIN urun_kartlari urk ON urk.id = rm.urun_kart_id
       WHERE rm.recete_id = $1`,
      [receteId]
    );

    let sartnameIdToUse = sartname_id;
    if (!sartnameIdToUse && proje_id) {
      const sartResult = await query(
        'SELECT sartname_id FROM proje_sartname_atamalari WHERE proje_id = $1 AND varsayilan = true LIMIT 1',
        [proje_id]
      );
      sartnameIdToUse = sartResult.rows[0]?.sartname_id;
    }

    if (!sartnameIdToUse || !recete.rows[0].alt_tip_id) {
      return res.json({
        success: true,
        data: {
          recete: recete.rows[0],
          malzemeler: malzemeler.rows,
          gramaj_kontrol: null,
          mesaj: !sartnameIdToUse ? 'Şartname belirtilmedi' : 'Reçeteye alt tip atanmamış',
        },
      });
    }

    // Bug #8 fix: TÜM şartname kurallarını al (fallback için)
    const tumKurallarResult = await query(
      `SELECT * FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true ORDER BY sira`,
      [sartnameIdToUse]
    );
    const tumKurallar = tumKurallarResult.rows;
    const altTipKurallar = tumKurallar.filter((k) => Number(k.alt_tip_id) === Number(recete.rows[0].alt_tip_id));

    const sozlukResult = await query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true');
    const sozluk = sozlukResult.rows;

    const { uygun_sayisi, uyumsuz_sayisi, sonuclar } = gramajKontrolHesapla(
      malzemeler.rows,
      altTipKurallar,
      tumKurallar,
      sozluk
    );

    res.json({
      success: true,
      data: {
        recete: recete.rows[0],
        malzemeler: malzemeler.rows,
        gramaj_kontrol: {
          sartname_id: sartnameIdToUse,
          alt_tip: recete.rows[0].alt_tip_adi,
          sonuclar,
          uygun_sayisi,
          uyumsuz_sayisi,
          toplam_kontrol: sonuclar.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu gramaj uyum kontrolü (şartname/kategori bazlı)
router.get('/gramaj-kontrol-toplu', async (req, res) => {
  try {
    const { sartname_id, kategori_id } = req.query;
    if (!sartname_id) {
      return res.status(400).json({ success: false, error: 'sartname_id zorunlu' });
    }
    const sartnameId = Number(sartname_id);
    const kategoriId = kategori_id ? Number(kategori_id) : null;

    const sozlukResult = await query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true');
    const sozluk = sozlukResult.rows;

    let receteQuery = `
      SELECT r.id, r.ad, r.alt_tip_id
      FROM receteler r
      WHERE r.aktif = true AND r.alt_tip_id IS NOT NULL
    `;
    const receteParams = [];
    let paramIdx = 1;
    if (kategoriId != null) {
      receteQuery += ` AND r.kategori_id = $${paramIdx}`;
      receteParams.push(kategoriId);
      paramIdx++;
    }
    const recetelerResult = await query(receteQuery, receteParams);
    const receteler = recetelerResult.rows;

    const kurallarTum = await query('SELECT * FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true', [
      sartnameId,
    ]);
    const kurallarByAltTip = new Map();
    for (const k of kurallarTum.rows) {
      const aid = k.alt_tip_id;
      if (!kurallarByAltTip.has(aid)) kurallarByAltTip.set(aid, []);
      kurallarByAltTip.get(aid).push(k);
    }

    const recetelerSonuc = [];
    let toplamUygun = 0;
    let toplamUyumsuz = 0;

    for (const recete of receteler) {
      const altTipKurallari = kurallarByAltTip.get(recete.alt_tip_id) || [];
      if (altTipKurallari.length === 0) {
        recetelerSonuc.push({
          recete_id: recete.id,
          ad: recete.ad,
          uygun_sayisi: 0,
          uyumsuz_sayisi: 0,
          toplam_kontrol: 0,
          tam_uyum: null,
        });
        continue;
      }
      const malzemeler = await query(
        'SELECT id, malzeme_adi, miktar, birim FROM recete_malzemeler WHERE recete_id = $1',
        [recete.id]
      );
      const { uygun_sayisi, uyumsuz_sayisi, toplam_kontrol } = gramajKontrolHesapla(
        malzemeler.rows,
        altTipKurallari,
        kurallarTum.rows,
        sozluk
      );
      toplamUygun += uygun_sayisi;
      toplamUyumsuz += uyumsuz_sayisi;
      recetelerSonuc.push({
        recete_id: recete.id,
        ad: recete.ad,
        uygun_sayisi,
        uyumsuz_sayisi,
        toplam_kontrol,
        tam_uyum: toplam_kontrol > 0 ? uyumsuz_sayisi === 0 : null,
      });
    }

    res.json({
      success: true,
      data: {
        receteler: recetelerSonuc,
        ozet: {
          toplam_recete: receteler.length,
          toplam_uygun: toplamUygun,
          toplam_uyumsuz: toplamUyumsuz,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
