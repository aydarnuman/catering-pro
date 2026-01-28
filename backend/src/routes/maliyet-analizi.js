import express from 'express';
import { query } from '../database.js';
import { miktarDonustur, standartBirimAl } from '../utils/birim-donusum.js';
import { getFiyat, hesaplaMalzemeMaliyet, fiyatFarkiHesapla } from '../utils/fiyat-hesaplama.js';

const router = express.Router();

// =============================================
// KATEGORİLER (TAB'LAR)
// =============================================

// Tüm kategorileri listele
router.get('/kategoriler', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        mk.*,
        COUNT(ms.id) as sablon_sayisi
      FROM maliyet_kategoriler mk
      LEFT JOIN maliyet_menu_sablonlari ms ON ms.kategori_id = mk.id AND ms.aktif = true
      WHERE mk.aktif = true
      GROUP BY mk.id
      ORDER BY mk.sira
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Kategori listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni kategori ekle
router.post('/kategoriler', async (req, res) => {
  try {
    const { kod, ad, ikon, aciklama, renk } = req.body;
    
    if (!kod || !ad) {
      return res.status(400).json({ success: false, error: 'Kod ve ad zorunlu' });
    }
    
    const result = await query(`
      INSERT INTO maliyet_kategoriler (kod, ad, ikon, aciklama, renk, sira)
      VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sira), 0) + 1 FROM maliyet_kategoriler))
      RETURNING *
    `, [kod, ad, ikon || '📋', aciklama, renk || 'gray']);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Kategori ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// MENÜ ŞABLONLARI
// =============================================

// Şablonları listele (kategori bazlı)
router.get('/sablonlar', async (req, res) => {
  try {
    const { kategori, limit = 50 } = req.query;
    
    let whereConditions = ['ms.aktif = true'];
    let params = [];
    let paramIndex = 1;
    
    if (kategori) {
      whereConditions.push(`mk.kod = $${paramIndex}`);
      params.push(kategori);
      paramIndex++;
    }
    
    params.push(limit);
    
    const result = await query(`
      SELECT 
        ms.id,
        ms.ad,
        ms.aciklama,
        ms.kategori_id,
        mk.kod as kategori_kod,
        mk.ad as kategori_adi,
        mk.ikon as kategori_ikon,
        mk.renk as kategori_renk,
        ms.kaynak_tipi,
        ms.kisi_sayisi,
        ms.gun_sayisi,
        ms.ogun_tipi,
        ms.sistem_maliyet,
        ms.piyasa_maliyet,
        ms.manuel_maliyet,
        ms.toplam_sistem_maliyet,
        ms.toplam_piyasa_maliyet,
        ms.etiketler,
        ms.kalori_toplam,
        ms.son_hesaplama,
        ms.created_at,
        p.ad as proje_adi,
        (SELECT COUNT(*) FROM maliyet_menu_yemekleri WHERE sablon_id = ms.id) as yemek_sayisi,
        (SELECT json_agg(json_build_object(
          'id', my.id,
          'yemek_adi', COALESCE(r.ad, my.yemek_adi),
          'recete_id', my.recete_id,
          'sistem_maliyet', my.sistem_maliyet,
          'piyasa_maliyet', my.piyasa_maliyet
        ) ORDER BY my.sira) 
        FROM maliyet_menu_yemekleri my 
        LEFT JOIN receteler r ON r.id = my.recete_id
        WHERE my.sablon_id = ms.id
        LIMIT 5) as yemekler_onizleme
      FROM maliyet_menu_sablonlari ms
      LEFT JOIN maliyet_kategoriler mk ON mk.id = ms.kategori_id
      LEFT JOIN projeler p ON p.id = ms.kaynak_proje_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ms.created_at DESC
      LIMIT $${paramIndex}
    `, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Şablon listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şablon detayı
router.get('/sablonlar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Şablon bilgisi
    const sablonResult = await query(`
      SELECT 
        ms.*,
        mk.kod as kategori_kod,
        mk.ad as kategori_adi,
        mk.ikon as kategori_ikon,
        mk.renk as kategori_renk,
        p.ad as proje_adi
      FROM maliyet_menu_sablonlari ms
      LEFT JOIN maliyet_kategoriler mk ON mk.id = ms.kategori_id
      LEFT JOIN projeler p ON p.id = ms.kaynak_proje_id
      WHERE ms.id = $1
    `, [id]);
    
    if (sablonResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    }
    
    // Yemekler
    const yemeklerResult = await query(`
      SELECT 
        my.id,
        my.yemek_adi,
        my.recete_id,
        my.sira,
        my.gun_no,
        my.ogun,
        my.sistem_maliyet,
        my.piyasa_maliyet,
        my.manuel_maliyet,
        my.kalori,
        my.protein,
        r.ad as recete_adi,
        r.kod as recete_kod,
        rk.ad as recete_kategori,
        rk.ikon as recete_ikon
      FROM maliyet_menu_yemekleri my
      LEFT JOIN receteler r ON r.id = my.recete_id
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE my.sablon_id = $1
      ORDER BY my.gun_no, my.sira
    `, [id]);
    
    // Her yemek için malzemeleri al (manuel yemekler için)
    const yemeklerWithMalzeme = await Promise.all(
      yemeklerResult.rows.map(async (yemek) => {
        if (yemek.recete_id) {
          // Reçeteden malzemeleri al
          const malzemeResult = await query(`
            SELECT 
              rm.id,
              COALESCE(uk.ad, rm.malzeme_adi) as malzeme_adi,
              rm.miktar,
              rm.birim,
              rm.birim_fiyat as sistem_fiyat,
              rm.toplam_fiyat as sistem_toplam,
              (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi 
               WHERE urun_kart_id = rm.urun_kart_id 
               ORDER BY arastirma_tarihi DESC LIMIT 1) as piyasa_fiyat
            FROM recete_malzemeler rm
            LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
            WHERE rm.recete_id = $1
            ORDER BY rm.sira
          `, [yemek.recete_id]);
          
          return { ...yemek, malzemeler: malzemeResult.rows };
        } else {
          // Manuel malzemeleri al
          const malzemeResult = await query(`
            SELECT * FROM maliyet_yemek_malzemeleri
            WHERE yemek_id = $1
            ORDER BY sira
          `, [yemek.id]);
          
          return { ...yemek, malzemeler: malzemeResult.rows };
        }
      })
    );
    
    res.json({
      success: true,
      data: {
        ...sablonResult.rows[0],
        yemekler: yemeklerWithMalzeme
      }
    });
  } catch (error) {
    console.error('Şablon detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni şablon oluştur (manuel)
router.post('/sablonlar', async (req, res) => {
  try {
    const {
      ad,
      kategori_kod,
      aciklama,
      kisi_sayisi = 1000,
      gun_sayisi = 1,
      ogun_tipi,
      etiketler,
      yemekler  // [{ recete_id: 1 } veya { yemek_adi: "Pilav", malzemeler: [...] }]
    } = req.body;
    
    if (!ad || !kategori_kod) {
      return res.status(400).json({ success: false, error: 'Ad ve kategori zorunlu' });
    }
    
    // Kategori ID bul
    const kategoriResult = await query(
      'SELECT id FROM maliyet_kategoriler WHERE kod = $1',
      [kategori_kod]
    );
    
    if (kategoriResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz kategori' });
    }
    
    const kategoriId = kategoriResult.rows[0].id;
    
    // Şablon oluştur
    const sablonResult = await query(`
      INSERT INTO maliyet_menu_sablonlari (
        ad, kategori_id, aciklama, kaynak_tipi, 
        kisi_sayisi, gun_sayisi, ogun_tipi, etiketler
      ) VALUES ($1, $2, $3, 'manuel', $4, $5, $6, $7)
      RETURNING *
    `, [ad, kategoriId, aciklama, kisi_sayisi, gun_sayisi, ogun_tipi, etiketler]);
    
    const sablonId = sablonResult.rows[0].id;
    
    // Yemekleri ekle
    if (yemekler && yemekler.length > 0) {
      for (let i = 0; i < yemekler.length; i++) {
        const yemek = yemekler[i];
        
        if (yemek.recete_id) {
          // Reçeteden ekle
          await query(`
            INSERT INTO maliyet_menu_yemekleri (sablon_id, recete_id, sira, gun_no, ogun)
            VALUES ($1, $2, $3, $4, $5)
          `, [sablonId, yemek.recete_id, i + 1, yemek.gun_no || 1, yemek.ogun || ogun_tipi]);
        } else if (yemek.yemek_adi) {
          // Manuel yemek ekle (fiyatıyla birlikte)
          const yemekResult = await query(`
            INSERT INTO maliyet_menu_yemekleri (sablon_id, yemek_adi, sira, gun_no, ogun, sistem_maliyet, piyasa_maliyet, manuel_maliyet)
            VALUES ($1, $2, $3, $4, $5, $6, $6, $6)
            RETURNING id
          `, [sablonId, yemek.yemek_adi, i + 1, yemek.gun_no || 1, yemek.ogun || ogun_tipi, yemek.manuel_maliyet || 0]);
          
          // Malzemeleri ekle
          if (yemek.malzemeler && yemek.malzemeler.length > 0) {
            for (let j = 0; j < yemek.malzemeler.length; j++) {
              const m = yemek.malzemeler[j];
              await query(`
                INSERT INTO maliyet_yemek_malzemeleri (
                  yemek_id, stok_kart_id, malzeme_adi, miktar, birim, 
                  sistem_fiyat, piyasa_fiyat, manuel_fiyat, sira
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              `, [
                yemekResult.rows[0].id, m.stok_kart_id, m.malzeme_adi,
                m.miktar, m.birim, m.sistem_fiyat, m.piyasa_fiyat, m.manuel_fiyat, j + 1
              ]);
            }
          }
        }
      }
    }
    
    // Maliyeti hesapla
    await hesaplaSablonMaliyet(sablonId);
    
    // Güncel veriyi getir
    const guncelSablon = await query(
      'SELECT * FROM v_maliyet_sablon_ozet WHERE id = $1',
      [sablonId]
    );
    
    res.json({
      success: true,
      data: guncelSablon.rows[0],
      message: 'Menü şablonu oluşturuldu'
    });
  } catch (error) {
    console.error('Şablon oluşturma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Menü planından şablon oluştur
router.post('/sablonlar/menu-plandan', async (req, res) => {
  try {
    const {
      ad,
      kategori_kod,
      aciklama,
      proje_id,
      menu_plan_id,
      ogun_ids,  // Seçilen öğün ID'leri
      kisi_sayisi = 1000,
      etiketler
    } = req.body;
    
    if (!ad || !kategori_kod || !ogun_ids || ogun_ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ad, kategori ve en az bir öğün seçimi zorunlu' 
      });
    }
    
    // Kategori ID bul
    const kategoriResult = await query(
      'SELECT id FROM maliyet_kategoriler WHERE kod = $1',
      [kategori_kod]
    );
    
    if (kategoriResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz kategori' });
    }
    
    const kategoriId = kategoriResult.rows[0].id;
    
    // Seçilen öğünlerin yemeklerini al
    const yemeklerResult = await query(`
      SELECT 
        moy.recete_id,
        r.ad as yemek_adi,
        moy.sira,
        mpo.tarih,
        ot.kod as ogun_tipi
      FROM menu_ogun_yemekleri moy
      JOIN menu_plan_ogunleri mpo ON mpo.id = moy.menu_ogun_id
      JOIN ogun_tipleri ot ON ot.id = mpo.ogun_tipi_id
      JOIN receteler r ON r.id = moy.recete_id
      WHERE moy.menu_ogun_id = ANY($1)
      ORDER BY mpo.tarih, moy.sira
    `, [ogun_ids]);
    
    if (yemeklerResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Seçilen öğünlerde yemek bulunamadı' });
    }
    
    // Gün sayısını hesapla
    const gunSayisi = await query(`
      SELECT COUNT(DISTINCT tarih) as gun_sayisi
      FROM menu_plan_ogunleri
      WHERE id = ANY($1)
    `, [ogun_ids]);
    
    // Şablon oluştur
    const sablonResult = await query(`
      INSERT INTO maliyet_menu_sablonlari (
        ad, kategori_id, aciklama, kaynak_tipi,
        kaynak_proje_id, kaynak_menu_plan_id, kaynak_ogun_ids,
        kisi_sayisi, gun_sayisi, etiketler
      ) VALUES ($1, $2, $3, 'menu_plan', $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      ad, kategoriId, aciklama,
      proje_id, menu_plan_id, ogun_ids,
      kisi_sayisi, parseInt(gunSayisi.rows[0].gun_sayisi), etiketler
    ]);
    
    const sablonId = sablonResult.rows[0].id;
    
    // Yemekleri ekle
    let sira = 1;
    for (const yemek of yemeklerResult.rows) {
      await query(`
        INSERT INTO maliyet_menu_yemekleri (sablon_id, recete_id, sira, ogun)
        VALUES ($1, $2, $3, $4)
      `, [sablonId, yemek.recete_id, sira++, yemek.ogun_tipi]);
    }
    
    // Maliyeti hesapla
    await hesaplaSablonMaliyet(sablonId);
    
    // Güncel veriyi getir
    const guncelSablon = await query(
      'SELECT * FROM v_maliyet_sablon_ozet WHERE id = $1',
      [sablonId]
    );
    
    res.json({
      success: true,
      data: guncelSablon.rows[0],
      message: `${yemeklerResult.rows.length} yemekle menü şablonu oluşturuldu`
    });
  } catch (error) {
    console.error('Menü planından şablon oluşturma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şablona yemek ekle
router.post('/sablonlar/:id/yemek', async (req, res) => {
  try {
    const { id } = req.params;
    const { recete_id, yemek_adi, gun_no, ogun, malzemeler } = req.body;
    
    if (!recete_id && !yemek_adi) {
      return res.status(400).json({ success: false, error: 'Reçete veya yemek adı zorunlu' });
    }
    
    // Sıra numarasını bul
    const siraResult = await query(
      'SELECT COALESCE(MAX(sira), 0) + 1 as sira FROM maliyet_menu_yemekleri WHERE sablon_id = $1',
      [id]
    );
    
    let yemekId;
    
    if (recete_id) {
      const result = await query(`
        INSERT INTO maliyet_menu_yemekleri (sablon_id, recete_id, sira, gun_no, ogun)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [id, recete_id, siraResult.rows[0].sira, gun_no || 1, ogun]);
      yemekId = result.rows[0].id;
    } else {
      const result = await query(`
        INSERT INTO maliyet_menu_yemekleri (sablon_id, yemek_adi, sira, gun_no, ogun)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [id, yemek_adi, siraResult.rows[0].sira, gun_no || 1, ogun]);
      yemekId = result.rows[0].id;
      
      // Manuel malzemeler varsa ekle
      if (malzemeler && malzemeler.length > 0) {
        for (let i = 0; i < malzemeler.length; i++) {
          const m = malzemeler[i];
          await query(`
            INSERT INTO maliyet_yemek_malzemeleri (
              yemek_id, stok_kart_id, malzeme_adi, miktar, birim, sira
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [yemekId, m.stok_kart_id, m.malzeme_adi, m.miktar, m.birim, i + 1]);
        }
      }
    }
    
    // Maliyeti yeniden hesapla
    await hesaplaSablonMaliyet(id);
    
    res.json({ success: true, message: 'Yemek eklendi' });
  } catch (error) {
    console.error('Yemek ekleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şablondan yemek sil
router.delete('/sablonlar/:sablonId/yemek/:yemekId', async (req, res) => {
  try {
    const { sablonId, yemekId } = req.params;
    
    await query('DELETE FROM maliyet_menu_yemekleri WHERE id = $1', [yemekId]);
    
    // Maliyeti yeniden hesapla
    await hesaplaSablonMaliyet(sablonId);
    
    res.json({ success: true, message: 'Yemek silindi' });
  } catch (error) {
    console.error('Yemek silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şablon sil
router.delete('/sablonlar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('UPDATE maliyet_menu_sablonlari SET aktif = false WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Şablon silindi' });
  } catch (error) {
    console.error('Şablon silme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// MALİYET HESAPLAMA
// =============================================

// Şablon maliyetini hesapla
async function hesaplaSablonMaliyet(sablonId) {
  try {
    // Şablon bilgisini al
    const sablon = await query(
      'SELECT kisi_sayisi FROM maliyet_menu_sablonlari WHERE id = $1',
      [sablonId]
    );
    
    if (sablon.rows.length === 0) return null;
    
    const kisiSayisi = sablon.rows[0].kisi_sayisi || 1000;
    
    // Tüm yemekleri al
    const yemekler = await query(`
      SELECT my.*, r.tahmini_maliyet as recete_maliyet
      FROM maliyet_menu_yemekleri my
      LEFT JOIN receteler r ON r.id = my.recete_id
      WHERE my.sablon_id = $1
    `, [sablonId]);
    
    let toplamFaturaMaliyet = 0;
    let toplamPiyasaMaliyet = 0;
    let toplamKalori = 0;
    let toplamProtein = 0;
    let uyarilar = [];
    
    for (const yemek of yemekler.rows) {
      let faturaMaliyet = 0;
      let piyasaMaliyet = 0;
      let kalori = 0;
      let protein = 0;
      let yemekUyarilari = [];
      
      if (yemek.recete_id) {
        // Reçeteden malzemeleri al ve maliyet hesapla
        const malzemeler = await query(`
          SELECT 
            rm.*,
            sk.son_alis_fiyat as stok_fatura_fiyat,
            sk.birim as stok_birim
          FROM recete_malzemeler rm
          LEFT JOIN stok_kartlari sk ON sk.id = rm.stok_kart_id
          WHERE rm.recete_id = $1
        `, [yemek.recete_id]);
        
        // Malzeme maliyetlerini hesapla ve cache'le
        for (const m of malzemeler.rows) {
          // Yeni hesaplama fonksiyonunu kullan
          const maliyet = await hesaplaMalzemeMaliyet({
            miktar: m.miktar,
            birim: m.birim,
            fatura_fiyat: m.fatura_fiyat || m.stok_fatura_fiyat,
            fatura_fiyat_tarihi: m.fatura_fiyat_tarihi,
            piyasa_fiyat: m.piyasa_fiyat || m.birim_fiyat,
            piyasa_fiyat_tarihi: m.piyasa_fiyat_tarihi,
            fiyat_birimi: m.stok_birim || 'kg'
          }, 'auto');
          
          faturaMaliyet += maliyet.fatura.toplam;
          piyasaMaliyet += maliyet.piyasa.toplam;
          
          // Uyarıları topla
          if (maliyet.uyarilar.length > 0) {
            yemekUyarilari.push({
              malzeme: m.malzeme_adi,
              uyarilar: maliyet.uyarilar
            });
          }
          
          // Cache'i güncelle
          await query(`
            UPDATE recete_malzemeler 
            SET hesaplanan_fatura_maliyet = $1,
                hesaplanan_piyasa_maliyet = $2,
                son_maliyet_hesaplama = NOW()
            WHERE id = $3
          `, [maliyet.fatura.toplam, maliyet.piyasa.toplam, m.id]);
        }
        
        // Besin değerleri
        const besinResult = await query(
          'SELECT kalori, protein FROM receteler WHERE id = $1',
          [yemek.recete_id]
        );
        kalori = parseInt(besinResult.rows[0]?.kalori) || 0;
        protein = parseFloat(besinResult.rows[0]?.protein) || 0;
        
      } else {
        // Manuel yemek - doğrudan fiyatı kullan
        faturaMaliyet = parseFloat(yemek.manuel_maliyet) || parseFloat(yemek.sistem_maliyet) || 0;
        piyasaMaliyet = faturaMaliyet;
      }
      
      // Yemek maliyetini güncelle
      await query(`
        UPDATE maliyet_menu_yemekleri 
        SET sistem_maliyet = $1, piyasa_maliyet = $2, kalori = $3, protein = $4
        WHERE id = $5
      `, [faturaMaliyet, piyasaMaliyet, kalori, protein, yemek.id]);
      
      toplamFaturaMaliyet += faturaMaliyet;
      toplamPiyasaMaliyet += piyasaMaliyet;
      toplamKalori += kalori;
      toplamProtein += protein;
      
      if (yemekUyarilari.length > 0) {
        uyarilar.push({ yemek: yemek.yemek_adi, detay: yemekUyarilari });
      }
    }
    
    // Fark hesapla
    const fark = fiyatFarkiHesapla(toplamFaturaMaliyet, toplamPiyasaMaliyet);
    
    // Şablon toplamlarını güncelle
    await query(`
      UPDATE maliyet_menu_sablonlari SET
        sistem_maliyet = $1,
        piyasa_maliyet = $2,
        toplam_sistem_maliyet = $3,
        toplam_piyasa_maliyet = $4,
        kalori_toplam = $5,
        protein_toplam = $6,
        son_hesaplama = NOW()
      WHERE id = $7
    `, [
      toplamFaturaMaliyet,
      toplamPiyasaMaliyet,
      toplamFaturaMaliyet * kisiSayisi,
      toplamPiyasaMaliyet * kisiSayisi,
      toplamKalori,
      toplamProtein,
      sablonId
    ]);
    
    return {
      fatura_maliyet: toplamFaturaMaliyet,
      piyasa_maliyet: toplamPiyasaMaliyet,
      sistem_maliyet: toplamFaturaMaliyet, // Geriye uyumluluk için
      fark: fark,
      uyarilar: uyarilar
    };
  } catch (error) {
    console.error('Maliyet hesaplama hatası:', error);
    return null;
  }
}

// Manuel maliyet hesapla (endpoint)
router.post('/sablonlar/:id/hesapla', async (req, res) => {
  try {
    const { id } = req.params;
    
    const sonuc = await hesaplaSablonMaliyet(id);
    
    if (!sonuc) {
      return res.status(500).json({ success: false, error: 'Hesaplama yapılamadı' });
    }
    
    // Güncel veriyi getir
    const sablon = await query(
      'SELECT * FROM v_maliyet_sablon_ozet WHERE id = $1',
      [id]
    );
    
    res.json({
      success: true,
      data: sablon.rows[0],
      message: 'Maliyet hesaplandı'
    });
  } catch (error) {
    console.error('Maliyet hesaplama hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fiyatları güncelle (piyasadan çek)
router.post('/sablonlar/:id/fiyat-guncelle', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Bu endpoint piyasa robotundan fiyat çekebilir
    // Şimdilik sadece mevcut verileri kullan
    const sonuc = await hesaplaSablonMaliyet(id);
    
    res.json({
      success: true,
      message: 'Fiyatlar güncellendi',
      data: sonuc
    });
  } catch (error) {
    console.error('Fiyat güncelleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// KARŞILAŞTIRMA
// =============================================

// Birden fazla şablonu karşılaştır
router.post('/karsilastir', async (req, res) => {
  try {
    const { sablon_ids } = req.body;
    
    if (!sablon_ids || sablon_ids.length < 2) {
      return res.status(400).json({ success: false, error: 'En az 2 şablon seçin' });
    }
    
    const result = await query(`
      SELECT * FROM v_maliyet_sablon_ozet
      WHERE id = ANY($1)
      ORDER BY sistem_maliyet ASC
    `, [sablon_ids]);
    
    // En ucuz ve en pahalı
    const enUcuz = result.rows[0];
    const enPahali = result.rows[result.rows.length - 1];
    
    res.json({
      success: true,
      data: {
        sablonlar: result.rows,
        karsilastirma: {
          en_ucuz: enUcuz,
          en_pahali: enPahali,
          fark: enPahali.sistem_maliyet - enUcuz.sistem_maliyet,
          fark_yuzde: ((enPahali.sistem_maliyet - enUcuz.sistem_maliyet) / enUcuz.sistem_maliyet * 100).toFixed(1)
        }
      }
    });
  } catch (error) {
    console.error('Karşılaştırma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// YARDIMCI ENDPOINT'LER
// =============================================

// Menü planlarından öğünleri getir (seçim için)
router.get('/menu-ogunler', async (req, res) => {
  try {
    const { proje_id, baslangic, bitis } = req.query;
    
    if (!proje_id) {
      return res.status(400).json({ success: false, error: 'proje_id zorunlu' });
    }
    
    let whereConditions = ['mp.proje_id = $1'];
    let params = [proje_id];
    let paramIndex = 2;
    
    if (baslangic) {
      whereConditions.push(`mpo.tarih >= $${paramIndex}`);
      params.push(baslangic);
      paramIndex++;
    }
    
    if (bitis) {
      whereConditions.push(`mpo.tarih <= $${paramIndex}`);
      params.push(bitis);
      paramIndex++;
    }
    
    const result = await query(`
      SELECT 
        mpo.id,
        mpo.tarih,
        ot.kod as ogun_tipi,
        ot.ad as ogun_adi,
        ot.ikon as ogun_ikon,
        mpo.kisi_sayisi,
        mpo.toplam_maliyet,
        mpo.porsiyon_maliyet,
        mp.id as plan_id,
        mp.ad as plan_adi,
        (SELECT COUNT(*) FROM menu_ogun_yemekleri WHERE menu_ogun_id = mpo.id) as yemek_sayisi,
        (SELECT json_agg(r.ad ORDER BY moy.sira) 
         FROM menu_ogun_yemekleri moy 
         JOIN receteler r ON r.id = moy.recete_id 
         WHERE moy.menu_ogun_id = mpo.id) as yemekler
      FROM menu_plan_ogunleri mpo
      JOIN menu_planlari mp ON mp.id = mpo.menu_plan_id
      JOIN ogun_tipleri ot ON ot.id = mpo.ogun_tipi_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY mpo.tarih, mpo.ogun_tipi_id
    `, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Menü öğünleri hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// REÇETE MALİYETLERİ (Popover için)
// =============================================

// Kategori bazlı reçeteleri ve maliyetlerini getir (ALT KATEGORİ ile)
router.get('/receteler', async (req, res) => {
  try {
    const { kategori } = req.query;
    
    let whereConditions = ['r.aktif = true'];
    let params = [];
    let paramIndex = 1;
    
    if (kategori) {
      whereConditions.push(`r.alt_kategori = $${paramIndex}`);
      params.push(kategori);
      paramIndex++;
    }
    
    const result = await query(`
      SELECT
        r.id,
        r.kod,
        r.ad,
        r.alt_kategori,
        r.kategori_id,
        rk.kod as ana_kategori_kod,
        rk.ad as ana_kategori_adi,
        r.tahmini_maliyet as sistem_maliyet,
        r.kalori,
        r.protein,
        r.porsiyon_miktar,
        -- Piyasa maliyet hesaplama
        (SELECT COALESCE(SUM(
          CASE
            WHEN rm.birim IN ('g', 'gr', 'ml') THEN (rm.miktar / 1000.0) * COALESCE(
              (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi WHERE urun_kart_id = rm.urun_kart_id ORDER BY arastirma_tarihi DESC LIMIT 1),
              uk.son_alis_fiyati,
              rm.birim_fiyat
            )
            ELSE rm.miktar * COALESCE(
              (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi WHERE urun_kart_id = rm.urun_kart_id ORDER BY arastirma_tarihi DESC LIMIT 1),
              uk.son_alis_fiyati,
              rm.birim_fiyat
            )
          END
        ), 0)
        FROM recete_malzemeler rm
        LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
        WHERE rm.recete_id = r.id) as piyasa_maliyet,
        -- Fatura güncellik kontrolü (30 gün)
        (SELECT MIN(fiyat_guncel_mi(COALESCE(rm.fatura_fiyat_tarihi, uk.son_alis_tarihi), 30))::boolean
         FROM recete_malzemeler rm
         LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
         WHERE rm.recete_id = r.id) as fatura_guncel,
        -- Piyasa güncellik kontrolü (7 gün - piyasa daha sık güncellenmeli)
        (SELECT MIN(fiyat_guncel_mi(
           COALESCE(
             rm.piyasa_fiyat_tarihi,
             (SELECT arastirma_tarihi FROM piyasa_fiyat_gecmisi WHERE urun_kart_id = rm.urun_kart_id ORDER BY arastirma_tarihi DESC LIMIT 1)
           ), 7))::boolean
         FROM recete_malzemeler rm
         WHERE rm.recete_id = r.id) as piyasa_guncel
      FROM receteler r
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY r.alt_kategori, r.ad
    `, params);
    
    // Alt kategori tanımları
    const ALT_KATEGORI_BILGI = {
      corba: { ad: 'Çorbalar', ikon: '🥣', renk: 'orange' },
      tavuk: { ad: 'Tavuk Yemekleri', ikon: '🍗', renk: 'orange' },
      et: { ad: 'Et Yemekleri', ikon: '🥩', renk: 'red' },
      balik: { ad: 'Balık', ikon: '🐟', renk: 'blue' },
      bakliyat: { ad: 'Bakliyat', ikon: '🫘', renk: 'yellow' },
      sebze: { ad: 'Sebze Yemekleri', ikon: '🥬', renk: 'green' },
      pilav: { ad: 'Pilav & Makarna', ikon: '🍚', renk: 'cyan' },
      salata: { ad: 'Salatalar', ikon: '🥗', renk: 'lime' },
      tatli: { ad: 'Tatlılar', ikon: '🍮', renk: 'pink' },
      icecek: { ad: 'İçecekler', ikon: '🥛', renk: 'grape' },
      kahvalti: { ad: 'Kahvaltılık', ikon: '🍳', renk: 'yellow' },
      diger: { ad: 'Diğer', ikon: '🍽️', renk: 'gray' }
    };

    // Alt kategori bazlı grupla
    const kategoriler = {};
    result.rows.forEach(row => {
      const altKat = row.alt_kategori || 'diger';
      const bilgi = ALT_KATEGORI_BILGI[altKat] || ALT_KATEGORI_BILGI.diger;

      if (!kategoriler[altKat]) {
        kategoriler[altKat] = {
          kod: altKat,
          ad: bilgi.ad,
          ikon: bilgi.ikon,
          renk: bilgi.renk,
          yemekler: []
        };
      }
      kategoriler[altKat].yemekler.push({
        id: row.id,
        kod: row.kod,
        ad: row.ad,
        sistem_maliyet: parseFloat(row.sistem_maliyet) || 0,
        piyasa_maliyet: parseFloat(row.piyasa_maliyet) || parseFloat(row.sistem_maliyet) || 0,
        fatura_maliyet: parseFloat(row.sistem_maliyet) || 0, // Fatura = sistem (son alış)
        fatura_guncel: row.fatura_guncel !== false, // NULL ise true say
        piyasa_guncel: row.piyasa_guncel !== false,
        fiyat_uyari: !row.fatura_guncel || !row.piyasa_guncel ? 'Eski fiyat' : null,
        kalori: parseInt(row.kalori) || 0,
        protein: parseFloat(row.protein) || 0
      });
    });

    res.json({
      success: true,
      data: Object.values(kategoriler),
      toplam: result.rows.length
    });
  } catch (error) {
    console.error('Reçete listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek reçetenin maliyetini detaylı hesapla
router.get('/receteler/:id/maliyet', async (req, res) => {
  try {
    const { id } = req.params;
    const { fiyat_tipi = 'piyasa' } = req.query; // piyasa | sistem | manuel
    
    // Reçete bilgisi
    const receteResult = await query(`
      SELECT r.*, rk.ad as kategori_adi, rk.ikon as kategori_ikon
      FROM receteler r
      LEFT JOIN recete_kategoriler rk ON rk.id = r.kategori_id
      WHERE r.id = $1
    `, [id]);
    
    if (receteResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reçete bulunamadı' });
    }
    
    const recete = receteResult.rows[0];
    
    // Malzemeler ve fiyatlar
    const malzemelerResult = await query(`
      SELECT 
        rm.id,
        COALESCE(uk.ad, rm.malzeme_adi) as malzeme_adi,
        rm.miktar,
        rm.birim,
        rm.birim_fiyat as sistem_birim_fiyat,
        rm.toplam_fiyat as sistem_toplam,
        uk.son_alis_fiyati,
        (SELECT piyasa_fiyat_ort FROM piyasa_fiyat_gecmisi 
         WHERE urun_kart_id = rm.urun_kart_id 
         ORDER BY arastirma_tarihi DESC LIMIT 1) as piyasa_fiyat,
        (SELECT json_build_object(
          'min', piyasa_fiyat_min,
          'max', piyasa_fiyat_max,
          'ort', piyasa_fiyat_ort,
          'tarih', arastirma_tarihi
        ) FROM piyasa_fiyat_gecmisi 
         WHERE urun_kart_id = rm.urun_kart_id 
         ORDER BY arastirma_tarihi DESC LIMIT 1) as piyasa_detay
      FROM recete_malzemeler rm
      LEFT JOIN urun_kartlari uk ON uk.id = rm.urun_kart_id
      WHERE rm.recete_id = $1
      ORDER BY rm.sira
    `, [id]);
    
    // Maliyet hesapla
    let toplamSistem = 0;
    let toplamPiyasa = 0;
    
    const malzemeler = malzemelerResult.rows.map(m => {
      const miktar = parseFloat(m.miktar) || 0;
      const birim = (m.birim || '').toLowerCase();
      const sistemFiyat = parseFloat(m.sistem_birim_fiyat) || parseFloat(m.son_alis_fiyat) || 0;
      const piyasaFiyat = parseFloat(m.piyasa_fiyat) || sistemFiyat;
      
      // Birim dönüşümü (g, ml -> kg, L)
      const carpan = (birim === 'g' || birim === 'gr' || birim === 'ml') ? 0.001 : 1;
      
      const sistemToplam = miktar * carpan * sistemFiyat;
      const piyasaToplam = miktar * carpan * piyasaFiyat;
      
      toplamSistem += sistemToplam;
      toplamPiyasa += piyasaToplam;
      
      return {
        id: m.id,
        malzeme_adi: m.malzeme_adi,
        miktar: m.miktar,
        birim: m.birim,
        sistem_fiyat: sistemFiyat,
        piyasa_fiyat: piyasaFiyat,
        sistem_toplam: sistemToplam,
        piyasa_toplam: piyasaToplam,
        piyasa_detay: m.piyasa_detay
      };
    });
    
    res.json({
      success: true,
      data: {
        recete: {
          id: recete.id,
          ad: recete.ad,
          kod: recete.kod,
          kategori: recete.kategori_adi,
          ikon: recete.kategori_ikon,
          porsiyon: recete.porsiyon_miktar,
          kalori: recete.kalori,
          protein: recete.protein
        },
        malzemeler,
        maliyet: {
          sistem: toplamSistem,
          piyasa: toplamPiyasa,
          fark: toplamPiyasa - toplamSistem,
          fark_yuzde: toplamSistem > 0 ? ((toplamPiyasa - toplamSistem) / toplamSistem * 100).toFixed(1) : 0
        }
      }
    });
  } catch (error) {
    console.error('Reçete maliyet hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Özet istatistikler
router.get('/ozet', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        mk.kod as kategori,
        mk.ad as kategori_adi,
        mk.ikon,
        COUNT(ms.id) as sablon_sayisi,
        AVG(ms.sistem_maliyet) as ortalama_maliyet,
        MIN(ms.sistem_maliyet) as min_maliyet,
        MAX(ms.sistem_maliyet) as max_maliyet
      FROM maliyet_kategoriler mk
      LEFT JOIN maliyet_menu_sablonlari ms ON ms.kategori_id = mk.id AND ms.aktif = true
      WHERE mk.aktif = true
      GROUP BY mk.id
      ORDER BY mk.sira
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Özet hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
export { hesaplaSablonMaliyet };

