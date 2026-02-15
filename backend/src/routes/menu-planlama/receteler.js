import express from 'express';
import { query } from '../../database.js';
import { hesaplaReceteMaliyet } from '../../services/maliyet-hesaplama-service.js';
import { receteSartnamePreview } from '../../services/sartname-onizleme.js';
import { validateReceteBirim } from '../../utils/birim-validator.js';

const router = express.Router();

// =============================================
// REÇETE KATEGORİLERİ
// =============================================

// Tüm kategorileri listele
router.get('/kategoriler', async (_req, res) => {
  try {
    const result = await query(`
      SELECT * FROM recete_kategoriler
      WHERE aktif = true
      ORDER BY sira, ad
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni kategori ekle
router.post('/kategoriler', async (req, res) => {
  try {
    const { kod, ad, ikon } = req.body;

    const result = await query(
      `
      INSERT INTO recete_kategoriler (kod, ad, ikon, sira)
      VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sira), 0) + 1 FROM recete_kategoriler))
      RETURNING *
    `,
      [kod, ad, ikon || '📋']
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// REÇETELER
// =============================================

// Tüm reçeteleri listele
router.get('/receteler', async (req, res) => {
  try {
    const { kategori, arama, proje_id, sartname_id, limit = 100, offset = 0 } = req.query;

    const whereConditions = ['r.aktif = true'];
    const params = [];
    let paramIndex = 1;

    // Proje bazlı filtreleme: proje_id varsa o projenin + genel (NULL) reçeteler
    if (proje_id) {
      whereConditions.push(`(r.proje_id = $${paramIndex} OR r.proje_id IS NULL)`);
      params.push(proje_id);
      paramIndex++;
    }

    if (kategori) {
      whereConditions.push(`rk.kod = $${paramIndex}`);
      params.push(kategori);
      paramIndex++;
    }

    if (arama) {
      whereConditions.push(`(r.ad ILIKE $${paramIndex} OR r.kod ILIKE $${paramIndex})`);
      params.push(`%${arama}%`);
      paramIndex++;
    }

    params.push(limit, offset);

    const result = await query(
      `
      SELECT
        r.id,
        r.kod,
        r.ad,
        r.kategori_id,
        rk.ad as kategori_adi,
        rk.ikon as kategori_ikon,
        r.porsiyon_miktar,
        r.hazirlik_suresi,
        r.pisirme_suresi,
        r.kalori,
        r.protein,
        r.karbonhidrat,
        r.yag,
        r.tahmini_maliyet,
        r.ai_olusturuldu,
        r.proje_id,
        p.ad as proje_adi,
        r.alt_tip_id,
        att.kod as alt_tip_kodu,
        att.ad as alt_tip_adi,
        att.ikon as alt_tip_ikon,
        r.created_at,
        COUNT(rm.id) as malzeme_sayisi
      FROM receteler r
      LEFT JOIN projeler p ON p.id = r.proje_id
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      LEFT JOIN alt_tip_tanimlari att ON att.id = r.alt_tip_id
      LEFT JOIN recete_malzemeler rm ON rm.recete_id = r.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY r.id, rk.ad, rk.ikon, p.ad, att.kod, att.ad, att.ikon
      ORDER BY r.ad
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
      params
    );

    // Toplam sayı
    const countResult = await query(
      `
      SELECT COUNT(*) as total
      FROM receteler r
      LEFT JOIN projeler p ON p.id = r.proje_id
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE ${whereConditions.join(' AND ')}
    `,
      params.slice(0, -2)
    );

    const rows = result.rows;

    // Şartname önizlemesi: sartname_id varsa gramaj/fiyat hesapla (DB değişmez)
    if (sartname_id) {
      const kurallarResult = await query(
        `SELECT * FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true`,
        [sartname_id]
      );
      const kurallar = kurallarResult.rows;
      const sozlukResult = await query('SELECT * FROM malzeme_tip_eslesmeleri WHERE aktif = true');
      const sozluk = sozlukResult.rows;

      if (kurallar.length > 0 && sozluk.length > 0) {
        for (const r of rows) {
          if (r.alt_tip_id) {
            const preview = await receteSartnamePreview(r.id, r.alt_tip_id, kurallar, sozluk);
            if (preview.tahmini_maliyet != null) {
              r.tahmini_maliyet = preview.tahmini_maliyet;
            }
            if (preview.porsiyon_gram != null) {
              r.porsiyon_miktar = preview.porsiyon_gram;
            }
          }
        }
      }
    }

    res.json({
      success: true,
      data: rows,
      total: parseInt(countResult.rows[0].total, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reçete detayı (malzemelerle birlikte)
router.get('/receteler/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Reçete bilgisi
    const receteResult = await query(
      `
      SELECT
        r.*,
        rk.ad as kategori_adi,
        rk.ikon as kategori_ikon
      FROM receteler r
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE r.id = $1
    `,
      [id]
    );

    if (receteResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }

    // Malzemeler - ürün kartı öncelikli, hem fatura hem piyasa fiyatı
    const malzemeResult = await query(
      `
      SELECT
        rm.*,

        -- Ürün kartı bilgileri (YENİ SİSTEM)
        uk.ad as urun_adi,
        uk.kod as urun_kod,
        uk.kod as stok_kod,
        uk.ad as stok_adi,
        COALESCE(b.kisa_ad, 'Ad') as stok_birim,
        uk.varsayilan_birim as urun_birim,
        uk.ikon as urun_ikon,

        -- FATURA FİYATI (YENİ SİSTEM: urun_kartlari.son_alis_fiyati)
        COALESCE(
          rm.fatura_fiyat,
          uk.son_alis_fiyati
        ) as fatura_fiyat,

        -- PİYASA FİYATI (özet tablo > AI araştırması > fiyat geçmişi)
        COALESCE(
          rm.piyasa_fiyat,
          (SELECT birim_fiyat_ekonomik FROM urun_fiyat_ozet WHERE urun_kart_id = uk.id),
          uk.manuel_fiyat,
          (
            SELECT fiyat
            FROM urun_fiyat_gecmisi
            WHERE urun_kart_id = uk.id
            ORDER BY tarih DESC
            LIMIT 1
          ),
          (
            SELECT piyasa_fiyat_ort
            FROM piyasa_fiyat_gecmisi
            WHERE LOWER(urun_adi) LIKE '%' || LOWER(COALESCE(uk.ad, rm.malzeme_adi)) || '%'
            ORDER BY arastirma_tarihi DESC
            LIMIT 1
          )
        ) as piyasa_fiyat,

        -- Fiyat tercihi (auto = fatura varsa fatura, yoksa piyasa)
        COALESCE(rm.fiyat_tercihi, 'auto') as fiyat_tercihi,

        -- Eşleştirme güvenilirliği
        COALESCE(rm.eslestirme_guvenilirligi, 0) as eslestirme_guvenilirligi,

        -- Birim (ürün kartı birimi)
        COALESCE(uk.varsayilan_birim, b.kisa_ad, 'Ad') as fiyat_birimi

      FROM recete_malzemeler rm
      LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE rm.recete_id = $1
      ORDER BY rm.sira, rm.id
    `,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...receteResult.rows[0],
        malzemeler: malzemeResult.rows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// REÇETE CRUD
// =============================================

// Yeni reçete oluştur
router.post('/receteler', async (req, res) => {
  try {
    const {
      kod,
      ad,
      kategori_id,
      porsiyon_miktar,
      hazirlik_suresi,
      pisirme_suresi,
      kalori,
      protein,
      karbonhidrat,
      yag,
      lif,
      tarif,
      aciklama,
      ai_olusturuldu,
      proje_id, // Proje bazlı reçete için
      alt_tip_id, // Gramaj şablonu alt tipi
      malzemeler, // [{stok_kart_id, malzeme_adi, miktar, birim, zorunlu}]
    } = req.body;

    // Reçete oluştur
    const receteResult = await query(
      `
      INSERT INTO receteler (
        kod, ad, kategori_id, porsiyon_miktar,
        hazirlik_suresi, pisirme_suresi,
        kalori, protein, karbonhidrat, yag, lif,
        tarif, aciklama, ai_olusturuldu, proje_id, alt_tip_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `,
      [
        kod,
        ad,
        kategori_id,
        porsiyon_miktar || 1,
        hazirlik_suresi,
        pisirme_suresi,
        kalori,
        protein,
        karbonhidrat,
        yag,
        lif,
        tarif,
        aciklama,
        ai_olusturuldu || false,
        proje_id || null,
        alt_tip_id || null,
      ]
    );

    const receteId = receteResult.rows[0].id;

    // Malzemeleri ekle (birim doğrulamalı + batch INSERT)
    if (malzemeler && malzemeler.length > 0) {
      // Önce tüm birimleri doğrula (DB'ye gitmeden)
      for (const m of malzemeler) {
        if (m.birim) {
          const birimCheck = validateReceteBirim(m.birim);
          if (!birimCheck.valid) {
            return res.status(400).json({
              success: false,
              error: `Malzeme "${m.malzeme_adi}": ${birimCheck.error}`,
            });
          }
        }
      }

      // Batch INSERT — tek sorgu ile tüm malzemeleri ekle
      const values = [];
      const params = [];
      for (let i = 0; i < malzemeler.length; i++) {
        const m = malzemeler[i];
        const offset = i * 7;
        values.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
        );
        params.push(receteId, m.stok_kart_id, m.malzeme_adi, m.miktar, m.birim, m.zorunlu ?? true, i + 1);
      }
      await query(
        `INSERT INTO recete_malzemeler (recete_id, stok_kart_id, malzeme_adi, miktar, birim, zorunlu, sira) VALUES ${values.join(', ')}`,
        params
      );
    }

    // Maliyeti hesapla
    await hesaplaReceteMaliyet(receteId);

    res.json({
      success: true,
      data: receteResult.rows[0],
      message: 'Reçete başarıyla oluşturuldu',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reçete güncelle
router.put('/receteler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ad,
      kategori_id,
      porsiyon_miktar,
      hazirlik_suresi,
      pisirme_suresi,
      kalori,
      protein,
      karbonhidrat,
      yag,
      lif,
      tarif,
      aciklama,
      alt_tip_id,
    } = req.body;

    const result = await query(
      `
      UPDATE receteler SET
        ad = COALESCE($1, ad),
        kategori_id = COALESCE($2, kategori_id),
        porsiyon_miktar = COALESCE($3, porsiyon_miktar),
        hazirlik_suresi = COALESCE($4, hazirlik_suresi),
        pisirme_suresi = COALESCE($5, pisirme_suresi),
        kalori = COALESCE($6, kalori),
        protein = COALESCE($7, protein),
        karbonhidrat = COALESCE($8, karbonhidrat),
        yag = COALESCE($9, yag),
        lif = COALESCE($10, lif),
        tarif = COALESCE($11, tarif),
        aciklama = COALESCE($12, aciklama),
        alt_tip_id = COALESCE($13, alt_tip_id),
        updated_at = NOW()
      WHERE id = $14
      RETURNING *
    `,
      [
        ad,
        kategori_id,
        porsiyon_miktar,
        hazirlik_suresi,
        pisirme_suresi,
        kalori,
        protein,
        karbonhidrat,
        yag,
        lif,
        tarif,
        aciklama,
        alt_tip_id,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reçete sil (soft delete)
router.delete('/receteler/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      UPDATE receteler SET aktif = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }

    res.json({ success: true, message: 'Reçete silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// REÇETE MALZEMELERİ (YENİ STİL)
// =============================================

// Malzeme ekle
router.post('/receteler/:id/malzemeler', async (req, res) => {
  try {
    const { id } = req.params;
    const { stok_kart_id, urun_kart_id, malzeme_adi, miktar, birim, zorunlu, birim_fiyat } = req.body;

    // Birim doğrulama
    if (birim) {
      const birimCheck = validateReceteBirim(birim);
      if (!birimCheck.valid) {
        return res.status(400).json({ success: false, error: birimCheck.error });
      }
    }

    // Sıra numarasını bul
    const siraResult = await query(
      `
      SELECT COALESCE(MAX(sira), 0) + 1 as next_sira
      FROM recete_malzemeler
      WHERE recete_id = $1
    `,
      [id]
    );

    // Fiyat belirleme:
    // 1. Manuel fiyat verilmişse kullan
    // 2. Ürün kartı seçilmişse oradan çek (stok kartı bağlantısı varsa)
    // 3. Stok kartı seçilmişse oradan çek
    let finalFiyat = birim_fiyat || null;
    let fiyatKaynagi = birim_fiyat ? 'MANUEL' : null;
    let finalStokKartId = stok_kart_id;

    // Ürün kartından fiyat ve stok kartı ID'si al
    if (urun_kart_id && !birim_fiyat) {
      const urunResult = await query(
        `
        SELECT
          uk.stok_kart_id,
          uk.aktif_fiyat_tipi,
          COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati, uk.manuel_fiyat) as fiyat
        FROM urun_kartlari uk
        WHERE uk.id = $1
      `,
        [urun_kart_id]
      );

      if (urunResult.rows.length > 0) {
        if (urunResult.rows[0].fiyat) {
          finalFiyat = urunResult.rows[0].fiyat;
          fiyatKaynagi = urunResult.rows[0].aktif_fiyat_tipi || 'VARSAYILAN';
        }
        if (urunResult.rows[0].stok_kart_id) {
          finalStokKartId = urunResult.rows[0].stok_kart_id;
        }
      }
    }

    // Fallback: Ürün kartından fiyat çek - YENİ SİSTEM: urun_kartlari
    if (finalStokKartId && !finalFiyat) {
      const urunResult = await query(
        `
        SELECT son_alis_fiyati, ad FROM urun_kartlari WHERE id = $1
      `,
        [finalStokKartId]
      );

      if (urunResult.rows.length > 0 && urunResult.rows[0].son_alis_fiyati) {
        finalFiyat = urunResult.rows[0].son_alis_fiyati;
        fiyatKaynagi = 'FATURA';
      }
    }

    const result = await query(
      `
      INSERT INTO recete_malzemeler (
        recete_id, stok_kart_id, urun_kart_id, malzeme_adi, miktar, birim, zorunlu, sira,
        birim_fiyat, fiyat_kaynagi, piyasa_fiyat
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9)
      RETURNING *
    `,
      [
        id,
        finalStokKartId,
        urun_kart_id,
        malzeme_adi,
        miktar,
        birim,
        zorunlu ?? true,
        siraResult.rows[0].next_sira,
        finalFiyat,
        fiyatKaynagi,
      ]
    );

    // Maliyeti yeniden hesapla
    await hesaplaReceteMaliyet(id);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Malzeme güncelle
router.put('/malzemeler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { stok_kart_id, malzeme_adi, miktar, birim, zorunlu, birim_fiyat } = req.body;

    // Birim doğrulama
    if (birim) {
      const birimCheck = validateReceteBirim(birim);
      if (!birimCheck.valid) {
        return res.status(400).json({ success: false, error: birimCheck.error });
      }
    }

    // Fiyat belirleme (standart enum: FATURA/PIYASA/MANUEL/VARSAYILAN/SOZLESME)
    let finalFiyat = birim_fiyat;
    let fiyatKaynagi = birim_fiyat ? 'MANUEL' : null;

    // Eğer stok kartı seçilmişse ve fiyat verilmemişse, ürün kartından çek
    if (stok_kart_id && !birim_fiyat) {
      const urunResult = await query(
        `
        SELECT son_alis_fiyati, aktif_fiyat, aktif_fiyat_tipi FROM urun_kartlari WHERE id = $1
      `,
        [stok_kart_id]
      );

      if (urunResult.rows.length > 0) {
        const uk = urunResult.rows[0];
        if (uk.aktif_fiyat) {
          finalFiyat = uk.aktif_fiyat;
          fiyatKaynagi = uk.aktif_fiyat_tipi || 'VARSAYILAN';
        } else if (uk.son_alis_fiyati) {
          finalFiyat = uk.son_alis_fiyati;
          fiyatKaynagi = 'FATURA';
        }
      }
    }

    const result = await query(
      `
      UPDATE recete_malzemeler SET
        stok_kart_id = COALESCE($1, stok_kart_id),
        malzeme_adi = COALESCE($2, malzeme_adi),
        miktar = COALESCE($3, miktar),
        birim = COALESCE($4, birim),
        zorunlu = COALESCE($5, zorunlu),
        birim_fiyat = COALESCE($7, birim_fiyat),
        piyasa_fiyat = COALESCE($7, piyasa_fiyat),
        fiyat_kaynagi = COALESCE($8, fiyat_kaynagi),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `,
      [stok_kart_id, malzeme_adi, miktar, birim, zorunlu, id, finalFiyat, fiyatKaynagi]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Malzeme bulunamadı' });
    }

    // Maliyeti yeniden hesapla
    await hesaplaReceteMaliyet(result.rows[0].recete_id);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Malzeme sil
router.delete('/malzemeler/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Önce recete_id'yi al
    const malzeme = await query('SELECT recete_id FROM recete_malzemeler WHERE id = $1', [id]);

    if (malzeme.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Malzeme bulunamadı' });
    }

    const receteId = malzeme.rows[0].recete_id;

    await query('DELETE FROM recete_malzemeler WHERE id = $1', [id]);

    // Maliyeti yeniden hesapla
    await hesaplaReceteMaliyet(receteId);

    res.json({ success: true, message: 'Malzeme silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// MALİYET HESAPLAMA
// =============================================

// Manuel maliyet hesaplama endpoint'i
router.post('/receteler/:id/maliyet-hesapla', async (req, res) => {
  try {
    const { id } = req.params;
    const maliyet = await hesaplaReceteMaliyet(id);

    res.json({
      success: true,
      maliyet: Math.round(maliyet * 100) / 100,
      message: 'Maliyet hesaplandı',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu maliyet hesaplama endpoint'i
router.post('/receteler/toplu-maliyet-hesapla', async (_req, res) => {
  try {
    const receteler = await query('SELECT id, ad FROM receteler WHERE aktif = true ORDER BY id');
    const sonuclar = [];
    let basarili = 0;
    let hatali = 0;

    for (const r of receteler.rows) {
      try {
        const maliyet = await hesaplaReceteMaliyet(r.id);
        sonuclar.push({ id: r.id, ad: r.ad, maliyet: Math.round(maliyet * 100) / 100, basarili: true });
        basarili++;
      } catch (err) {
        sonuclar.push({ id: r.id, ad: r.ad, maliyet: 0, basarili: false, hata: err.message });
        hatali++;
      }
    }

    res.json({
      success: true,
      toplam: receteler.rows.length,
      basarili,
      hatali,
      message: `${basarili}/${receteler.rows.length} reçete hesaplandı`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
