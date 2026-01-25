import express from 'express';
import { query } from '../database.js';
import { authenticate, requirePermission, auditLog } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// =============================================
// ÜRÜN ADINDAN OTOMATİK KATEGORİ TESPİTİ
// =============================================
const kategoriAnahtarKelimeleri = {
  // Kategori ID: Anahtar kelimeler (küçük harf)
  1: ['et', 'dana', 'kuzu', 'kıyma', 'bonfile', 'pirzola', 'kavurma', 'sığır', 'köfte', 'sucuk', 'sosis', 'tavuk', 'piliç', 'hindi', 'but', 'kanat', 'ciğer', 'yürek'],
  2: ['balık', 'somon', 'levrek', 'çipura', 'hamsi', 'sardalya', 'karides', 'midye', 'kalamar', 'ahtapot', 'ton balığı', 'deniz'],
  3: ['süt', 'yoğurt', 'peynir', 'kaşar', 'beyaz peynir', 'lor', 'tereyağı', 'krema', 'ayran', 'kefir'],
  4: ['domates', 'biber', 'soğan', 'patates', 'havuç', 'salatalık', 'patlıcan', 'kabak', 'ıspanak', 'marul', 'lahana', 'brokoli', 'karnabahar', 'pırasa', 'sarımsak', 'fasulye', 'bezelye', 'mısır', 'turp', 'kereviz', 'enginar', 'mantar', 'semizotu', 'roka', 'maydanoz', 'dereotu', 'nane', 'fesleğen'],
  5: ['elma', 'armut', 'portakal', 'mandalina', 'limon', 'muz', 'üzüm', 'çilek', 'kiraz', 'vişne', 'şeftali', 'kayısı', 'erik', 'incir', 'karpuz', 'kavun', 'nar', 'kivi', 'ananas', 'mango', 'avokado', 'hindistan cevizi'],
  6: ['un', 'bulgur', 'pirinç', 'makarna', 'şehriye', 'irmik', 'nişasta', 'mısır unu', 'galeta unu', 'yulaf', 'kinoa', 'karabuğday', 'erişte'],
  7: ['şeker', 'tuz', 'karabiber', 'kimyon', 'kekik', 'pul biber', 'tarçın', 'zerdeçal', 'zencefil', 'safran', 'baharat', 'salça', 'ketçap', 'mayonez', 'hardal', 'sirke', 'sos', 'çeşni'],
  8: ['zeytinyağı', 'ayçiçek yağı', 'mısırözü yağı', 'fındık yağı', 'sızma', 'riviera', 'yağ'],
  9: ['çay', 'kahve', 'neskafe', 'espresso', 'bitki çayı', 'yeşil çay', 'siyah çay'],
  10: ['su', 'maden suyu', 'soda', 'meyve suyu', 'kola', 'gazlı içecek', 'enerji içeceği', 'ayran'],
  11: ['ekmek', 'pide', 'simit', 'poğaça', 'börek', 'pasta', 'kek', 'kurabiye', 'bisküvi', 'kraker', 'hamur', 'unlu mamül'],
  12: ['dondurma', 'buzlu', 'donmuş', 'frozen', 'dondurulmuş'],
  13: ['nohut', 'mercimek', 'kuru fasulye', 'barbunya', 'börülce', 'baklagil', 'kuruyemiş', 'fındık', 'ceviz', 'badem', 'fıstık', 'kaju', 'leblebi'],
  14: ['konserve', 'turşu', 'reçel', 'bal', 'pekmez', 'zeytin', 'kapya', 'közlenmiş']
};

// Ürün adından kategori ID tahmin et
function tahminKategori(urunAdi) {
  if (!urunAdi) return null;
  
  const normalizedAdi = urunAdi.toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  
  // En iyi eşleşmeyi bul
  let bestMatch = { kategoriId: null, score: 0 };
  
  for (const [kategoriId, kelimeler] of Object.entries(kategoriAnahtarKelimeleri)) {
    for (const kelime of kelimeler) {
      const normalizedKelime = kelime.toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
      
      if (normalizedAdi.includes(normalizedKelime)) {
        // Kelime uzunluğuna göre skor ver (uzun kelimeler daha spesifik)
        const score = normalizedKelime.length;
        if (score > bestMatch.score) {
          bestMatch = { kategoriId: parseInt(kategoriId), score };
        }
      }
    }
  }
  
  return bestMatch.kategoriId;
}

// =============================================
// ÜRÜN KARTLARI YÖNETİMİ
// =============================================

// Tüm ürün kartlarını listele
router.get('/', async (req, res) => {
  try {
    const { kategori_id, arama, aktif = 'true' } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (aktif === 'true') {
      whereConditions.push('uk.aktif = true');
    }
    
    if (kategori_id) {
      whereConditions.push(`uk.kategori_id = $${paramIndex++}`);
      queryParams.push(kategori_id);
    }
    
    if (arama) {
      whereConditions.push(`(uk.ad ILIKE $${paramIndex} OR uk.kod ILIKE $${paramIndex} OR uk.barkod ILIKE $${paramIndex})`);
      queryParams.push(`%${arama}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const result = await query(`
      SELECT 
        uk.id,
        uk.kod,
        uk.ad,
        uk.kategori_id,
        kat.ad as kategori,
        kat.ikon as kategori_ikon,
        uk.ana_birim_id,
        b.ad as birim,
        b.kisa_ad as birim_kisa,
        uk.barkod,
        uk.min_stok,
        uk.max_stok,
        uk.kritik_stok,
        uk.kdv_orani,
        uk.toplam_stok,
        uk.ortalama_fiyat,
        uk.son_alis_fiyati,
        uk.son_alis_tarihi,
        uk.raf_omru_gun,
        uk.aciklama,
        uk.resim_url,
        uk.aktif,
        uk.created_at,
        uk.ana_urun_id,
        uk.varyant_tipi,
        CASE 
          WHEN uk.toplam_stok <= 0 THEN 'tukendi'
          WHEN uk.kritik_stok IS NOT NULL AND uk.toplam_stok <= uk.kritik_stok THEN 'kritik'
          WHEN uk.min_stok IS NOT NULL AND uk.toplam_stok <= uk.min_stok THEN 'dusuk'
          WHEN uk.max_stok IS NOT NULL AND uk.toplam_stok >= uk.max_stok THEN 'fazla'
          ELSE 'normal'
        END as durum
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      ${whereClause}
      ORDER BY COALESCE(uk.ana_urun_id, uk.id), uk.ana_urun_id NULLS FIRST, uk.ad
    `, queryParams);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Ürün listesi hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek ürün detayı
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ürün bilgileri
    const urunResult = await query(`
      SELECT 
        uk.*,
        kat.ad as kategori,
        kat.ikon as kategori_ikon,
        b.ad as birim,
        b.kisa_ad as birim_kisa
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE uk.id = $1
    `, [id]);
    
    if (urunResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }
    
    const urun = urunResult.rows[0];
    
    // Depo durumları
    const depoResult = await query(`
      SELECT 
        udd.depo_id,
        d.kod as depo_kod,
        d.ad as depo_ad,
        udd.miktar,
        udd.rezerve_miktar,
        udd.raf_konum,
        udd.son_sayim_tarihi
      FROM urun_depo_durumlari udd
      JOIN depolar d ON d.id = udd.depo_id
      WHERE udd.urun_kart_id = $1
      ORDER BY d.kod
    `, [id]);
    
    // Son fiyatlar (tedarikçi bazlı)
    const fiyatResult = await query(`
      SELECT 
        ufg.id,
        ufg.cari_id,
        c.unvan as tedarikci,
        ufg.fiyat,
        ufg.kaynak,
        ufg.tarih,
        ufg.fatura_ettn
      FROM urun_fiyat_gecmisi ufg
      LEFT JOIN cariler c ON c.id = ufg.cari_id
      WHERE ufg.urun_kart_id = $1
      ORDER BY ufg.tarih DESC
      LIMIT 10
    `, [id]);
    
    // Tedarikçi eşleştirmeleri
    const eslestirmeResult = await query(`
      SELECT 
        ute.id,
        ute.cari_id,
        c.unvan as tedarikci,
        ute.tedarikci_urun_kodu,
        ute.tedarikci_urun_adi,
        ute.eslestirme_sayisi,
        ute.guven_skoru
      FROM urun_tedarikci_eslestirme ute
      LEFT JOIN cariler c ON c.id = ute.cari_id
      WHERE ute.urun_kart_id = $1 AND ute.aktif = true
      ORDER BY ute.eslestirme_sayisi DESC
    `, [id]);
    
    res.json({
      success: true,
      data: {
        ...urun,
        depo_durumlari: depoResult.rows,
        fiyat_gecmisi: fiyatResult.rows,
        tedarikci_eslestirmeleri: eslestirmeResult.rows
      }
    });
  } catch (error) {
    logger.error('Ürün detay hatası', { error: error.message, stack: error.stack, id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni ürün ekle
router.post('/', async (req, res) => {
  try {
    const {
      kod,
      ad,
      kategori_id,
      ana_birim_id,
      barkod,
      min_stok,
      max_stok,
      kritik_stok,
      kdv_orani,
      raf_omru_gun,
      aciklama
    } = req.body;
    
    if (!ad) {
      return res.status(400).json({ success: false, error: 'Ürün adı zorunludur' });
    }
    
    // Otomatik kod oluştur (eğer verilmediyse)
    let urunKod = kod;
    if (!urunKod) {
      const lastKod = await query(`
        SELECT kod FROM urun_kartlari 
        WHERE kod LIKE 'URN-%' 
        ORDER BY id DESC LIMIT 1
      `);
      const lastNum = lastKod.rows.length > 0 
        ? parseInt(lastKod.rows[0].kod.split('-')[1]) || 0 
        : 0;
      urunKod = `URN-${String(lastNum + 1).padStart(4, '0')}`;
    }
    
    // Kategori verilmediyse ürün adından otomatik tahmin et
    let finalKategoriId = kategori_id;
    let kategoriOtomatik = false;
    if (!finalKategoriId) {
      finalKategoriId = tahminKategori(ad);
      kategoriOtomatik = true;
      logger.info(`Otomatik kategori tespiti: "${ad}" → Kategori ID: ${finalKategoriId}`, { urunAdi: ad, kategoriId: finalKategoriId });
    }
    
    const result = await query(`
      INSERT INTO urun_kartlari (
        kod, ad, kategori_id, ana_birim_id, barkod,
        min_stok, max_stok, kritik_stok, kdv_orani,
        raf_omru_gun, aciklama, aktif, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW())
      RETURNING *
    `, [
      urunKod, ad, finalKategoriId, ana_birim_id, barkod,
      min_stok || 0, max_stok, kritik_stok, kdv_orani || 10,
      raf_omru_gun, aciklama
    ]);
    
    await auditLog(req, 'urun_kartlari', result.rows[0].id, 'INSERT', null, result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: kategoriOtomatik 
        ? `Ürün başarıyla eklendi (Kategori otomatik belirlendi)` 
        : 'Ürün başarıyla eklendi'
    });
  } catch (error) {
    logger.error('Ürün ekleme hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün güncelle
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      kod,
      ad,
      kategori_id,
      ana_birim_id,
      barkod,
      min_stok,
      max_stok,
      kritik_stok,
      kdv_orani,
      raf_omru_gun,
      aciklama,
      aktif,
      // Varyant alanları
      ana_urun_id,
      varyant_tipi,
      varyant_aciklama,
      tedarikci_urun_adi
    } = req.body;
    
    // Mevcut veriyi al
    const eskiVeri = await query('SELECT * FROM urun_kartlari WHERE id = $1', [id]);
    if (eskiVeri.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }
    
    const result = await query(`
      UPDATE urun_kartlari SET
        kod = COALESCE($2, kod),
        ad = COALESCE($3, ad),
        kategori_id = COALESCE($4, kategori_id),
        ana_birim_id = COALESCE($5, ana_birim_id),
        barkod = COALESCE($6, barkod),
        min_stok = COALESCE($7, min_stok),
        max_stok = COALESCE($8, max_stok),
        kritik_stok = COALESCE($9, kritik_stok),
        kdv_orani = COALESCE($10, kdv_orani),
        raf_omru_gun = COALESCE($11, raf_omru_gun),
        aciklama = COALESCE($12, aciklama),
        aktif = COALESCE($13, aktif),
        ana_urun_id = COALESCE($14, ana_urun_id),
        varyant_tipi = COALESCE($15, varyant_tipi),
        varyant_aciklama = COALESCE($16, varyant_aciklama),
        tedarikci_urun_adi = COALESCE($17, tedarikci_urun_adi),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, kod, ad, kategori_id, ana_birim_id, barkod, min_stok, max_stok, kritik_stok, kdv_orani, raf_omru_gun, aciklama, aktif, ana_urun_id, varyant_tipi, varyant_aciklama, tedarikci_urun_adi]);
    
    await auditLog(req, 'urun_kartlari', id, 'UPDATE', eskiVeri.rows[0], result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Ürün başarıyla güncellendi'
    });
  } catch (error) {
    logger.error('Ürün güncelleme hatası', { error: error.message, stack: error.stack, id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün sil (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Önce ürünün var olduğunu kontrol et
    const checkResult = await query('SELECT * FROM urun_kartlari WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }
    
    // 2. İlişkili verileri sil
    await query('DELETE FROM urun_hareketleri WHERE urun_kart_id = $1', [id]);
    await query('DELETE FROM urun_depo_durumlari WHERE urun_kart_id = $1', [id]);
    await query('DELETE FROM urun_tedarikci_eslestirme WHERE urun_kart_id = $1', [id]);
    await query('DELETE FROM urun_fiyat_gecmisi WHERE urun_kart_id = $1', [id]);
    
    // 3. Ürün kartını pasif yap (soft delete)
    const result = await query(`
      UPDATE urun_kartlari 
      SET aktif = false, 
          kod = kod || '_SILINDI_' || id,
          updated_at = NOW()
      WHERE id = $1 
      RETURNING *
    `, [id]);
    
    // 4. İlgili fatura işlem kayıtlarını kontrol et
    // Eğer başka kalem kalmamışsa fatura işlem kaydını da sil
    await query(`
      DELETE FROM fatura_stok_islem fsi
      WHERE NOT EXISTS (
        SELECT 1 FROM urun_hareketleri uh 
        WHERE uh.fatura_ettn = fsi.ettn
      )
    `);
    
    logger.info(`Ürün silindi: ${result.rows[0]?.ad} (ID: ${id})`, { urunId: id, urunAdi: result.rows[0]?.ad });
    
    res.json({
      success: true,
      message: 'Ürün ve ilişkili tüm veriler başarıyla silindi'
    });
  } catch (error) {
    logger.error('Ürün silme hatası', { error: error.message, stack: error.stack, id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// FİYAT GÜNCELLEME
// =============================================

/**
 * PATCH /api/urunler/:id/fiyat
 * Fatura kaleminden direkt fiyat güncelleme
 */
router.patch('/:id/fiyat', async (req, res) => {
  try {
    const { id } = req.params;
    const { birim_fiyat, kaynak, aciklama } = req.body;
    
    if (!birim_fiyat || birim_fiyat <= 0) {
      return res.status(400).json({ success: false, error: 'Geçerli bir birim fiyat giriniz' });
    }
    
    // Ürün var mı kontrol et
    const urunCheck = await query('SELECT * FROM urun_kartlari WHERE id = $1 AND aktif = true', [id]);
    if (urunCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }
    
    const urun = urunCheck.rows[0];
    const eskiFiyat = urun.son_alis_fiyati;
    
    // Fiyatı güncelle
    const result = await query(`
      UPDATE urun_kartlari 
      SET son_alis_fiyati = $1, 
          son_alis_tarihi = NOW(),
          updated_at = NOW()
      WHERE id = $2 
      RETURNING *
    `, [birim_fiyat, id]);
    
    // Fiyat geçmişine kaydet
    await query(`
      INSERT INTO urun_fiyat_gecmisi (urun_kart_id, fiyat, kaynak, aciklama, tarih)
      VALUES ($1, $2, $3, $4, NOW())
    `, [id, birim_fiyat, kaynak || 'fatura_manuel', aciklama || 'Faturadan manuel fiyat güncellemesi']);
    
    logger.info(`Fiyat güncellendi: ${urun.ad} | ${eskiFiyat || 0}₺ → ${birim_fiyat}₺`, { urunId: id, urunAdi: urun.ad, eskiFiyat, yeniFiyat: birim_fiyat });
    
    res.json({
      success: true,
      data: result.rows[0],
      eski_fiyat: eskiFiyat,
      yeni_fiyat: birim_fiyat,
      message: `${urun.ad} fiyatı güncellendi: ${birim_fiyat}₺`
    });
  } catch (error) {
    logger.error('Fiyat güncelleme hatası', { error: error.message, stack: error.stack, id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ÜRÜN KATEGORİLERİ
// =============================================

router.get('/kategoriler/liste', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        k.id,
        k.ad,
        k.ikon,
        k.sira,
        COUNT(uk.id) as urun_sayisi
      FROM urun_kategorileri k
      LEFT JOIN urun_kartlari uk ON uk.kategori_id = k.id AND uk.aktif = true
      WHERE k.aktif = true
      GROUP BY k.id, k.ad, k.ikon, k.sira
      ORDER BY k.sira, k.ad
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Kategori listesi hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ÜRÜN STOK HAREKETLERİ
// =============================================

// Stok girişi (faturadan veya manuel)
router.post('/:id/giris', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      miktar,
      birim_fiyat,
      depo_id,
      cari_id,
      fatura_ettn,
      aciklama
    } = req.body;
    
    if (!miktar || miktar <= 0) {
      return res.status(400).json({ success: false, error: 'Geçerli bir miktar giriniz' });
    }
    
    if (!depo_id) {
      return res.status(400).json({ success: false, error: 'Depo seçiniz' });
    }
    
    // Hareket kaydı oluştur
    const hareket = await query(`
      INSERT INTO urun_hareketleri (
        urun_kart_id, hareket_tipi, miktar, birim_fiyat,
        toplam_tutar, hedef_depo_id, cari_id, fatura_ettn,
        aciklama, tarih, created_by
      ) VALUES ($1, 'giris', $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      RETURNING *
    `, [
      id, miktar, birim_fiyat, (miktar * (birim_fiyat || 0)),
      depo_id, cari_id, fatura_ettn, aciklama, req.user?.id
    ]);
    
    // Fiyat geçmişine ekle
    if (birim_fiyat) {
      await query(`
        INSERT INTO urun_fiyat_gecmisi (
          urun_kart_id, cari_id, fiyat, fatura_ettn, kaynak, tarih
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
      `, [id, cari_id, birim_fiyat, fatura_ettn, fatura_ettn ? 'fatura' : 'manuel']);
    }
    
    res.json({
      success: true,
      data: hareket.rows[0],
      message: 'Stok girişi başarıyla kaydedildi'
    });
  } catch (error) {
    logger.error('Stok giriş hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stok çıkışı
router.post('/:id/cikis', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      miktar,
      depo_id,
      aciklama
    } = req.body;
    
    if (!miktar || miktar <= 0) {
      return res.status(400).json({ success: false, error: 'Geçerli bir miktar giriniz' });
    }
    
    if (!depo_id) {
      return res.status(400).json({ success: false, error: 'Depo seçiniz' });
    }
    
    // Mevcut stoku kontrol et
    const mevcutStok = await query(`
      SELECT miktar FROM urun_depo_durumlari 
      WHERE urun_kart_id = $1 AND depo_id = $2
    `, [id, depo_id]);
    
    if (mevcutStok.rows.length === 0 || mevcutStok.rows[0].miktar < miktar) {
      return res.status(400).json({ success: false, error: 'Yetersiz stok' });
    }
    
    // Hareket kaydı oluştur
    const hareket = await query(`
      INSERT INTO urun_hareketleri (
        urun_kart_id, hareket_tipi, miktar,
        kaynak_depo_id, aciklama, tarih, created_by
      ) VALUES ($1, 'cikis', $2, $3, $4, NOW(), $5)
      RETURNING *
    `, [id, miktar, depo_id, aciklama, req.user?.id]);
    
    res.json({
      success: true,
      data: hareket.rows[0],
      message: 'Stok çıkışı başarıyla kaydedildi'
    });
  } catch (error) {
    logger.error('Stok çıkış hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// FATURA KALEM EŞLEŞTİRME
// =============================================

// Fatura kalemini ürüne eşleştir
router.post('/eslestir', authenticate, async (req, res) => {
  try {
    const {
      urun_kart_id,
      tedarikci_urun_adi,
      tedarikci_urun_kodu,
      cari_id,
      tedarikci_birimi,
      birim_carpani
    } = req.body;
    
    if (!urun_kart_id || !tedarikci_urun_adi) {
      return res.status(400).json({ success: false, error: 'Ürün ve tedarikçi ürün adı zorunludur' });
    }
    
    // Normalize edilmiş isim
    const normalizedAdi = tedarikci_urun_adi.toLowerCase()
      .replace(/\s*\d+[.,]?\d*\s*(kg|gr|g|lt|l|ml|adet|ad|pkt|paket|kutu|koli)\s*/gi, ' ')
      .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Mevcut eşleştirme var mı kontrol et
    const mevcut = await query(`
      SELECT id, eslestirme_sayisi FROM urun_tedarikci_eslestirme
      WHERE urun_kart_id = $1 AND tedarikci_urun_adi_normalized = $2
    `, [urun_kart_id, normalizedAdi]);
    
    let result;
    if (mevcut.rows.length > 0) {
      // Sayacı artır
      result = await query(`
        UPDATE urun_tedarikci_eslestirme 
        SET eslestirme_sayisi = eslestirme_sayisi + 1, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [mevcut.rows[0].id]);
    } else {
      // Yeni eşleştirme ekle
      result = await query(`
        INSERT INTO urun_tedarikci_eslestirme (
          urun_kart_id, cari_id, tedarikci_urun_kodu, tedarikci_urun_adi,
          tedarikci_urun_adi_normalized, tedarikci_birimi, birim_carpani,
          eslestirme_sayisi, aktif, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, true, $8)
        RETURNING *
      `, [
        urun_kart_id, cari_id, tedarikci_urun_kodu, tedarikci_urun_adi,
        normalizedAdi, tedarikci_birimi, birim_carpani || 1, req.user?.id
      ]);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Eşleştirme kaydedildi'
    });
  } catch (error) {
    logger.error('Eşleştirme hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Akıllı eşleştirme önerisi getir
router.post('/akilli-eslesdir', async (req, res) => {
  try {
    const { urun_adi, urun_kodu, cari_id } = req.body;
    
    if (!urun_adi) {
      return res.status(400).json({ success: false, error: 'Ürün adı zorunludur' });
    }
    
    // Normalize edilmiş isim
    const normalizedAdi = urun_adi.toLowerCase()
      .replace(/\s*\d+[.,]?\d*\s*(kg|gr|g|lt|l|ml|adet|ad|pkt|paket|kutu|koli)\s*/gi, ' ')
      .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 1. Önce tam kod eşleşmesi
    if (urun_kodu) {
      const kodEslestirme = await query(`
        SELECT id, kod, ad, ana_birim_id, 100 as guven_skoru, 'exact_code' as kaynak
        FROM urun_kartlari WHERE kod = $1 AND aktif = true LIMIT 1
      `, [urun_kodu]);
      
      if (kodEslestirme.rows.length > 0) {
        return res.json({ success: true, data: kodEslestirme.rows[0] });
      }
    }
    
    // 2. Tedarikçi geçmişinden ara
    const gecmisEslestirme = await query(`
      SELECT 
        uk.id, uk.kod, uk.ad, uk.ana_birim_id,
        LEAST(100, 80 + (ute.eslestirme_sayisi * 2)) as guven_skoru,
        'tedarikci_gecmis' as kaynak
      FROM urun_tedarikci_eslestirme ute
      JOIN urun_kartlari uk ON uk.id = ute.urun_kart_id
      WHERE ute.aktif = true AND uk.aktif = true
        AND (ute.tedarikci_urun_adi_normalized = $1 OR ute.tedarikci_urun_kodu = $2)
      ORDER BY ute.eslestirme_sayisi DESC
      LIMIT 1
    `, [normalizedAdi, urun_kodu]);
    
    if (gecmisEslestirme.rows.length > 0) {
      return res.json({ success: true, data: gecmisEslestirme.rows[0] });
    }
    
    // 3. Fuzzy match
    const fuzzyEslestirme = await query(`
      SELECT 
        uk.id, uk.kod, uk.ad, uk.ana_birim_id,
        ROUND(similarity($1, LOWER(uk.ad)) * 100) as guven_skoru,
        'fuzzy_match' as kaynak
      FROM urun_kartlari uk
      WHERE uk.aktif = true AND similarity($1, LOWER(uk.ad)) >= 0.3
      ORDER BY similarity($1, LOWER(uk.ad)) DESC
      LIMIT 5
    `, [normalizedAdi]);
    
    if (fuzzyEslestirme.rows.length > 0) {
      return res.json({ 
        success: true, 
        data: fuzzyEslestirme.rows[0],
        alternatifler: fuzzyEslestirme.rows.slice(1)
      });
    }
    
    // Eşleşme bulunamadı
    res.json({ 
      success: true, 
      data: null, 
      message: 'Eşleşme bulunamadı, yeni ürün oluşturulabilir' 
    });
    
  } catch (error) {
    logger.error('Akıllı eşleştirme hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ÖZET / İSTATİSTİK
// =============================================

router.get('/ozet/istatistikler', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE aktif = true) as toplam_urun,
        COUNT(*) FILTER (WHERE toplam_stok <= 0 AND aktif = true) as tukenmis,
        COUNT(*) FILTER (WHERE kritik_stok IS NOT NULL AND toplam_stok <= kritik_stok AND toplam_stok > 0 AND aktif = true) as kritik,
        COUNT(*) FILTER (WHERE min_stok IS NOT NULL AND toplam_stok <= min_stok AND toplam_stok > kritik_stok AND aktif = true) as dusuk,
        COALESCE(SUM(toplam_stok * COALESCE(son_alis_fiyati, 0)) FILTER (WHERE aktif = true), 0) as toplam_deger
      FROM urun_kartlari
    `);
    
    const kategoriStats = await query(`
      SELECT 
        kat.id,
        kat.ad,
        kat.ikon,
        COUNT(uk.id) as urun_sayisi
      FROM urun_kategorileri kat
      LEFT JOIN urun_kartlari uk ON uk.kategori_id = kat.id AND uk.aktif = true
      WHERE kat.aktif = true
      GROUP BY kat.id, kat.ad, kat.ikon
      ORDER BY kat.sira
    `);
    
    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        kategoriler: kategoriStats.rows
      }
    });
  } catch (error) {
    logger.error('İstatistik hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ÜRÜN VARYANTLARI SİSTEMİ
// =============================================

/**
 * POST /api/urunler/varyant-sistemi-kur
 * Varyant sistemini kur (migration)
 */
router.post('/varyant-sistemi-kur', async (req, res) => {
  try {
    // Kolonları ekle
    await query(`ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS ana_urun_id INTEGER REFERENCES urun_kartlari(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS varyant_tipi VARCHAR(50)`);
    await query(`ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS varyant_aciklama VARCHAR(200)`);
    await query(`ALTER TABLE urun_kartlari ADD COLUMN IF NOT EXISTS tedarikci_urun_adi TEXT`);
    
    // İndeks ekle
    await query(`CREATE INDEX IF NOT EXISTS idx_urun_kartlari_ana_urun ON urun_kartlari(ana_urun_id)`);
    
    logger.info('Varyant sistemi kuruldu');
    res.json({ success: true, message: 'Varyant sistemi kuruldu' });
  } catch (error) {
    logger.error('Varyant sistemi kurulum hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/urunler/:id/varyantlar
 * Bir ürünün varyantlarını listele
 */
router.get('/:id/varyantlar', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        uk.id, uk.kod, uk.ad, uk.varyant_tipi, uk.varyant_aciklama,
        uk.tedarikci_urun_adi, uk.son_alis_fiyati, uk.toplam_stok,
        b.kisa_ad as birim
      FROM urun_kartlari uk
      LEFT JOIN birimler b ON b.id = uk.ana_birim_id
      WHERE uk.ana_urun_id = $1 AND uk.aktif = TRUE
      ORDER BY uk.ad
    `, [id]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/urunler/ana-urunler
 * Sadece ana ürünleri listele (varyant olmayanlar)
 */
router.get('/ana-urunler/liste', async (req, res) => {
  try {
    const { kategori_id } = req.query;
    
    let sql = `
      SELECT 
        uk.id, uk.kod, uk.ad, uk.kategori_id,
        kat.ad as kategori_adi,
        (SELECT COUNT(*) FROM urun_kartlari v WHERE v.ana_urun_id = uk.id AND v.aktif = TRUE) as varyant_sayisi
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE uk.aktif = TRUE AND uk.ana_urun_id IS NULL
    `;
    
    const params = [];
    if (kategori_id) {
      params.push(kategori_id);
      sql += ` AND uk.kategori_id = $${params.length}`;
    }
    
    sql += ` ORDER BY uk.ad`;
    
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/urunler/varyant-olustur
 * Fatura kaleminden yeni varyant oluştur
 */
router.post('/varyant-olustur', async (req, res) => {
  try {
    const { 
      ana_urun_id, 
      fatura_urun_adi, 
      varyant_tipi = 'ambalaj',
      birim_fiyat,
      kategori_id 
    } = req.body;
    
    if (!fatura_urun_adi) {
      return res.status(400).json({ success: false, error: 'Ürün adı zorunludur' });
    }
    
    // Ana ürün bilgilerini al (varsa veya otomatik bul)
    let anaUrun = null;
    let bulunanAnaUrunId = ana_urun_id;
    let yeniKod = '';
    let yeniKategoriId = kategori_id;
    let yeniBirim = 'KG';
    
    // Eğer ana_urun_id verilmemişse, fatura ürün adından otomatik bul
    if (!bulunanAnaUrunId) {
      // Fatura ürün adını normalize et
      const faturaAdiLower = fatura_urun_adi.toLowerCase()
        .replace(/[^a-zçğıöşü\s]/g, ' ') // Özel karakterleri temizle
        .replace(/\s+/g, ' ')
        .trim();
      
      // Anahtar kelime eşleştirmeleri (fatura adı → ana ürün adı)
      const anahtarKelimeMap = {
        'şeker': 'Şeker',
        'seker': 'Şeker',
        'toz şeker': 'Şeker',
        'küp şeker': 'Şeker',
        'pudra şekeri': 'Şeker',
        'zeytin': 'Zeytinyağı',
        'zeytinyağı': 'Zeytinyağı',
        'sızma zeytinyağı': 'Zeytinyağı',
        'makarna': 'Makarna (Spagetti)',
        'spagetti': 'Makarna (Spagetti)',
        'penne': 'Makarna (Spagetti)',
        'fiyonk': 'Makarna (Spagetti)',
        'salça': 'Domates Salçası',
        'domates salçası': 'Domates Salçası',
        'biber salçası': 'Biber Salçası',
      };
      
      // Anahtar kelime kontrolü
      let bulunanAnaUrunAdi = null;
      for (const [anahtar, anaUrunAdi] of Object.entries(anahtarKelimeMap)) {
        if (faturaAdiLower.includes(anahtar)) {
          bulunanAnaUrunAdi = anaUrunAdi;
          break;
        }
      }
      
      // Ana ürünü bul
      if (bulunanAnaUrunAdi) {
        const anaUrunResult = await query(`
          SELECT uk.id, uk.kod, uk.ad, uk.kategori_id
          FROM urun_kartlari uk
          WHERE uk.aktif = TRUE 
            AND uk.ana_urun_id IS NULL
            AND LOWER(uk.ad) = LOWER($1)
          LIMIT 1
        `, [bulunanAnaUrunAdi]);
        
        if (anaUrunResult.rows.length > 0) {
          bulunanAnaUrunId = anaUrunResult.rows[0].id;
        }
      }
    }
    
    if (bulunanAnaUrunId) {
      const anaResult = await query('SELECT * FROM urun_kartlari WHERE id = $1', [bulunanAnaUrunId]);
      if (anaResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Ana ürün bulunamadı' });
      }
      anaUrun = anaResult.rows[0];
      yeniKategoriId = yeniKategoriId || anaUrun.kategori_id;
      
      // Varyant kodu: ANA-V1, ANA-V2, ...
      const varyantSayisi = await query(
        'SELECT COUNT(*) as cnt FROM urun_kartlari WHERE ana_urun_id = $1',
        [bulunanAnaUrunId]
      );
      yeniKod = `${anaUrun.kod}-V${parseInt(varyantSayisi.rows[0].cnt) + 1}`;
    } else {
      // Yeni bağımsız ürün kodu
      const lastKod = await query(`
        SELECT kod FROM urun_kartlari 
        WHERE kod LIKE 'YNI-%' 
        ORDER BY id DESC LIMIT 1
      `);
      const nextNum = lastKod.rows.length > 0 
        ? parseInt(lastKod.rows[0].kod.replace('YNI-', '')) + 1 
        : 1;
      yeniKod = `YNI-${String(nextNum).padStart(4, '0')}`;
    }
    
    // Yeni ürün/varyant oluştur
    const result = await query(`
      INSERT INTO urun_kartlari (
        kod, ad, ana_urun_id, varyant_tipi, tedarikci_urun_adi,
        son_alis_fiyati, kategori_id, aktif, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
      RETURNING *
    `, [
      yeniKod,
      fatura_urun_adi,
      bulunanAnaUrunId || null,
      bulunanAnaUrunId ? varyant_tipi : null,
      fatura_urun_adi,
      birim_fiyat || null,
      yeniKategoriId || 13  // Varsayılan: Diğer kategorisi
    ]);
    
    // Fiyat geçmişine kaydet
    if (birim_fiyat) {
      await query(`
        INSERT INTO urun_fiyat_gecmisi (urun_kart_id, fiyat, kaynak, aciklama, tarih)
        VALUES ($1, $2, 'fatura_yeni_urun', 'Faturadan yeni ürün/varyant oluşturuldu', NOW())
      `, [result.rows[0].id, birim_fiyat]);
    }
    
    logger.info(`Yeni ürün/varyant: ${fatura_urun_adi} (${yeniKod})${bulunanAnaUrunId ? ` → ${anaUrun.ad} varyantı` : ''}`, { urunAdi: fatura_urun_adi, kod: yeniKod, anaUrunId: bulunanAnaUrunId });
    
    res.json({
      success: true,
      data: result.rows[0],
      message: bulunanAnaUrunId 
        ? `"${anaUrun.ad}" altına "${fatura_urun_adi}" varyantı oluşturuldu`
        : `"${fatura_urun_adi}" yeni ürün kartı oluşturuldu`
    });
  } catch (error) {
    logger.error('Varyant oluşturma hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/urunler/varyant-bagla
 * Mevcut bir ürünü başka bir ürünün varyantı olarak bağla
 */
router.post('/varyant-bagla', async (req, res) => {
  try {
    const { urun_id, ana_urun_id, varyant_tipi, varyant_aciklama } = req.body;
    
    if (!urun_id || !ana_urun_id) {
      return res.status(400).json({ success: false, error: 'urun_id ve ana_urun_id zorunlu' });
    }
    
    // Kendine bağlama kontrolü
    if (urun_id === ana_urun_id) {
      return res.status(400).json({ success: false, error: 'Ürün kendisinin varyantı olamaz' });
    }
    
    // Ana ürün kontrolü
    const anaCheck = await query('SELECT * FROM urun_kartlari WHERE id = $1', [ana_urun_id]);
    if (anaCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ana ürün bulunamadı' });
    }
    
    // Varyant yapılacak ürün kontrolü
    const urunCheck = await query('SELECT * FROM urun_kartlari WHERE id = $1', [urun_id]);
    if (urunCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }
    
    // Güncelle
    const result = await query(`
      UPDATE urun_kartlari SET
        ana_urun_id = $1,
        varyant_tipi = $2,
        varyant_aciklama = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [ana_urun_id, varyant_tipi || 'genel', varyant_aciklama || null, urun_id]);
    
    logger.info(`Varyant bağlandı: ${urunCheck.rows[0].ad} → ${anaCheck.rows[0].ad}`, { varyantId: urunId, anaUrunId });
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `"${urunCheck.rows[0].ad}" artık "${anaCheck.rows[0].ad}" ürününün varyantı`
    });
  } catch (error) {
    logger.error('Varyant bağlama hatası', { error: error.message, stack: error.stack, urunId, anaUrunId });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/urunler/toplu-varyant-bagla
 * Birden fazla ürünü varyant olarak bağla
 */
router.post('/toplu-varyant-bagla', async (req, res) => {
  try {
    const { baglamalar } = req.body;
    // baglamalar: [{urun_id, ana_urun_id, varyant_tipi, varyant_aciklama}, ...]
    
    if (!baglamalar || !Array.isArray(baglamalar)) {
      return res.status(400).json({ success: false, error: 'baglamalar dizisi gerekli' });
    }
    
    const sonuclar = [];
    
    for (const baglama of baglamalar) {
      try {
        const { urun_id, ana_urun_id, varyant_tipi, varyant_aciklama } = baglama;
        
        if (urun_id === ana_urun_id) continue;
        
        await query(`
          UPDATE urun_kartlari SET
            ana_urun_id = $1,
            varyant_tipi = $2,
            varyant_aciklama = $3,
            updated_at = NOW()
          WHERE id = $4
        `, [ana_urun_id, varyant_tipi || 'genel', varyant_aciklama || null, urun_id]);
        
        sonuclar.push({ urun_id, ana_urun_id, basarili: true });
      } catch (err) {
        sonuclar.push({ urun_id: baglama.urun_id, basarili: false, hata: err.message });
      }
    }
    
    console.log(`🔗 Toplu varyant bağlama: ${sonuclar.filter(s => s.basarili).length}/${baglamalar.length} başarılı`);
    
    res.json({
      success: true,
      data: sonuclar,
      message: `${sonuclar.filter(s => s.basarili).length} varyant bağlandı`
    });
  } catch (error) {
    logger.error('Toplu varyant bağlama hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
