import express from 'express';
import { query } from '../database.js';
import { auditLog, authenticate } from '../middleware/auth.js';
import { aiTopluEslestir, mappingIleEslestir } from '../services/ai-eslestirme.js';
import {
  FIYAT_ONCELIKLERI,
  aiTahminiFiyat,
  getFiyatDashboard,
  getFiyatDetay,
  getTedarikciKarsilastirma,
  getUrunlerFiyatDurumu,
  hesaplaAktifFiyat,
  hesaplaTopluAktifFiyat,
  manuelFiyatGir,
  topluAiTahmini,
  tumFiyatlariYenidenHesapla,
} from '../services/fiyat-motor.js';
import {
  eskimisFiyatKontrolu,
  getScrapingDurumu,
  hesaplaMevsimselKatsayilar,
  parseESKFiyatlari,
  parseHalFiyatlari,
  parseTZOBFiyatlari,
  yenidenHesaplaGuvenSkorlari,
} from '../services/fiyat-scraper.js';
import { closeBrowser, searchMarketPrices } from '../services/market-scraper.js';
import logger from '../utils/logger.js';

const router = express.Router();

// =====================================================
// DASHBOARD
// =====================================================

// Internal: Toplu AI tahmini (auth yok - sadece localhost için)
router.post('/internal/ai-tahmini', async (req, res) => {
  // Sadece localhost'tan erişime izin ver
  const ip = req.ip || req.connection.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
    return res.status(403).json({ success: false, error: 'Sadece localhost erişebilir' });
  }
  
  try {
    const { limit = 100 } = req.body;
    logger.info('Internal AI tahmini başlatıldı', { limit, ip });
    const sonuc = await topluAiTahmini(parseInt(limit, 10));
    res.json({ success: true, data: sonuc });
  } catch (error) {
    logger.error('Internal AI tahmini hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Internal: Reçete malzemelerindeki cache'lenmiş fiyatları temizle
router.post('/internal/temizle-fiyat-cache', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
    return res.status(403).json({ success: false, error: 'Sadece localhost erişebilir' });
  }
  
  try {
    // Ürün kartı bağlı malzemelerin cache'ini temizle
    // Böylece maliyet hesaplarken ürün kartından güncel fiyat alınır
    const result = await query(`
      UPDATE recete_malzemeler rm
      SET 
        birim_fiyat = COALESCE(
          (SELECT aktif_fiyat FROM urun_kartlari WHERE id = rm.urun_kart_id),
          (SELECT son_alis_fiyati FROM urun_kartlari WHERE id = rm.urun_kart_id),
          rm.birim_fiyat
        ),
        updated_at = NOW()
      WHERE rm.urun_kart_id IS NOT NULL
    `);
    
    logger.info('Fiyat cache temizlendi', { guncellenen: result.rowCount });
    
    res.json({ 
      success: true, 
      data: { guncellenen: result.rowCount },
      message: `${result.rowCount} malzemenin fiyatı ürün kartından güncellendi`
    });
  } catch (error) {
    logger.error('Fiyat cache temizleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Internal: Adet birimli ürünlerin yanlış çarpılmış fiyatlarını düzelt (/1000)
router.post('/internal/duzelt-adet-fiyat', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
    return res.status(403).json({ success: false, error: 'Sadece localhost erişebilir' });
  }
  
  try {
    const { esik = 500 } = req.body; // 500 TL üstü adet fiyatlarını düzelt
    
    logger.info('Adet fiyat düzeltme başlatıldı', { esik, ip });
    
    // Adet birimli ve yüksek fiyatlı ürünleri /1000 yap
    const result = await query(`
      UPDATE urun_kartlari
      SET 
        aktif_fiyat = aktif_fiyat / 1000,
        aktif_fiyat_guncelleme = NOW()
      WHERE aktif = true
        AND varsayilan_birim = 'adet'
        AND aktif_fiyat IS NOT NULL
        AND aktif_fiyat > $1
      RETURNING id, ad, aktif_fiyat as yeni_fiyat, (aktif_fiyat * 1000) as eski_fiyat
    `, [esik]);
    
    logger.info('Adet fiyat düzeltme tamamlandı', { guncellenen: result.rowCount });
    
    res.json({ 
      success: true, 
      data: {
        guncellenen: result.rowCount,
        detaylar: result.rows
      },
      message: `${result.rowCount} adet birimli ürünün fiyatı düzeltildi`
    });
  } catch (error) {
    logger.error('Adet fiyat düzeltme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Internal: Gram başına fiyatları kg başına düzelt (x1000)
router.post('/internal/duzelt-birim-fiyat', async (req, res) => {
  // Sadece localhost'tan erişime izin ver
  const ip = req.ip || req.connection.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
    return res.status(403).json({ success: false, error: 'Sadece localhost erişebilir' });
  }
  
  try {
    const { esik = 5 } = req.body; // 5 TL altındaki fiyatları düzelt
    
    logger.info('Birim fiyat düzeltme başlatıldı', { esik, ip });
    
    // Düşük fiyatlı ürünleri bul ve x1000 ile çarp
    const result = await query(`
      UPDATE urun_kartlari
      SET 
        aktif_fiyat = aktif_fiyat * 1000,
        aktif_fiyat_guncelleme = NOW()
      WHERE aktif = true
        AND aktif_fiyat IS NOT NULL
        AND aktif_fiyat > 0
        AND aktif_fiyat < $1
      RETURNING id, ad, aktif_fiyat as yeni_fiyat, (aktif_fiyat / 1000) as eski_fiyat
    `, [esik]);
    
    logger.info('Birim fiyat düzeltme tamamlandı', { guncellenen: result.rowCount });
    
    res.json({ 
      success: true, 
      data: {
        guncellenen: result.rowCount,
        detaylar: result.rows.slice(0, 20) // İlk 20 örnek
      },
      message: `${result.rowCount} ürünün fiyatı gram→kg olarak düzeltildi`
    });
  } catch (error) {
    logger.error('Birim fiyat düzeltme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dashboard istatistikleri
router.get('/dashboard', async (_req, res) => {
  try {
    const dashboard = await getFiyatDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    logger.error('Dashboard hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fiyat öncelikleri (frontend için)
router.get('/oncelikler', (_req, res) => {
  res.json({ success: true, data: FIYAT_ONCELIKLERI });
});

// =====================================================
// ÜRÜN LİSTESİ VE DETAY
// =====================================================

// Ürün listesi fiyat durumu ile
router.get('/urunler', async (req, res) => {
  try {
    const { kategori_id, guncellik, tip, search, limit = 100, offset = 0 } = req.query;

    const result = await getUrunlerFiyatDurumu({
      kategori_id: kategori_id ? parseInt(kategori_id, 10) : null,
      guncellik,
      tip,
      search,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.json({ success: true, data: result.urunler, total: result.total });
  } catch (error) {
    logger.error('Ürün listesi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek ürün fiyat detayı
router.get('/urunler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const detay = await getFiyatDetay(parseInt(id, 10));

    if (!detay) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }

    res.json({ success: true, data: detay });
  } catch (error) {
    logger.error('Ürün detay hatası', { error: error.message, id: req.params.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün fiyat geçmişi
router.get('/urunler/:id/gecmis', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, kaynak_id, baslangic, bitis } = req.query;

    const whereConditions = ['ufg.urun_kart_id = $1'];
    const params = [id];
    let paramIndex = 2;

    if (kaynak_id) {
      whereConditions.push(`ufg.kaynak_id = $${paramIndex}`);
      params.push(kaynak_id);
      paramIndex++;
    }

    if (baslangic) {
      whereConditions.push(`ufg.tarih >= $${paramIndex}`);
      params.push(baslangic);
      paramIndex++;
    }

    if (bitis) {
      whereConditions.push(`ufg.tarih <= $${paramIndex}`);
      params.push(bitis);
      paramIndex++;
    }

    params.push(limit);

    const result = await query(
      `
      SELECT 
        ufg.id,
        ufg.fiyat,
        ufg.birim,
        ufg.tarih,
        ufg.kaynak,
        ufg.aciklama,
        ufg.dogrulanmis,
        fk.ad as kaynak_adi,
        fk.kod as kaynak_kodu,
        fk.guvenilirlik_skoru as kaynak_guvenilirlik,
        c.unvan as tedarikci_adi
      FROM urun_fiyat_gecmisi ufg
      LEFT JOIN fiyat_kaynaklari fk ON fk.id = ufg.kaynak_id
      LEFT JOIN cariler c ON c.id = ufg.cari_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ufg.tarih DESC, ufg.id DESC
      LIMIT $${paramIndex}
    `,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Fiyat geçmişi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün tedarikçi karşılaştırma
router.get('/urunler/:id/tedarikci', async (req, res) => {
  try {
    const { id } = req.params;
    const karsilastirma = await getTedarikciKarsilastirma(parseInt(id, 10));
    res.json({ success: true, data: karsilastirma });
  } catch (error) {
    logger.error('Tedarikçi karşılaştırma hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün aktif fiyat yeniden hesapla
router.post('/urunler/:id/hesapla', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const sonuc = await hesaplaAktifFiyat(parseInt(id, 10));
    res.json({ success: true, data: sonuc, message: 'Fiyat yeniden hesaplandı' });
  } catch (error) {
    logger.error('Fiyat hesaplama hatası', { error: error.message, id: req.params.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manuel fiyat girişi
router.post('/urunler/:id/fiyat', authenticate, auditLog('fiyat'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fiyat, birim, aciklama } = req.body;

    if (!fiyat || fiyat <= 0) {
      return res.status(400).json({ success: false, error: 'Geçerli bir fiyat giriniz' });
    }

    const sonuc = await manuelFiyatGir(parseInt(id, 10), fiyat, {
      birim,
      aciklama,
      kullanici_id: req.user?.id,
    });

    res.json({ success: true, data: sonuc, message: 'Fiyat kaydedildi' });
  } catch (error) {
    logger.error('Manuel fiyat giriş hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TEDARİKÇİ SÖZLEŞMELERİ
// =====================================================

// Tüm sözleşmeler
router.get('/sozlesmeler', async (req, res) => {
  try {
    const { cari_id, aktif } = req.query;

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (cari_id) {
      whereConditions.push(`tf.cari_id = $${paramIndex++}`);
      params.push(cari_id);
    }

    if (aktif !== undefined) {
      whereConditions.push(`tf.aktif = $${paramIndex++}`);
      params.push(aktif === 'true');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `
      SELECT 
        c.id as cari_id,
        c.unvan as tedarikci_adi,
        COUNT(tf.id) as urun_sayisi,
        MIN(tf.gecerlilik_bitis) as en_yakin_bitis,
        SUM(CASE WHEN tf.aktif THEN 1 ELSE 0 END) as aktif_sayisi,
        MAX(tf.updated_at) as son_guncelleme
      FROM cariler c
      JOIN tedarikci_fiyatlari tf ON tf.cari_id = c.id
      ${whereClause}
      GROUP BY c.id, c.unvan
      ORDER BY c.unvan
    `,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Sözleşme listesi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tedarikçi sözleşme detayları
router.get('/sozlesmeler/:cariId', async (req, res) => {
  try {
    const { cariId } = req.params;

    // Tedarikçi bilgisi
    const cariResult = await query('SELECT id, unvan, vergi_no, telefon FROM cariler WHERE id = $1', [cariId]);

    if (cariResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tedarikçi bulunamadı' });
    }

    // Sözleşme fiyatları
    const fiyatResult = await query(
      `
      SELECT 
        tf.*,
        uk.kod as urun_kod,
        uk.ad as urun_ad,
        uk.varsayilan_birim,
        kat.ad as kategori_ad
      FROM tedarikci_fiyatlari tf
      JOIN urun_kartlari uk ON uk.id = tf.urun_kart_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE tf.cari_id = $1
      ORDER BY uk.ad
    `,
      [cariId]
    );

    res.json({
      success: true,
      data: {
        tedarikci: cariResult.rows[0],
        fiyatlar: fiyatResult.rows,
      },
    });
  } catch (error) {
    logger.error('Sözleşme detay hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tedarikçi fiyat ekle/güncelle
router.post('/sozlesmeler/fiyat', authenticate, auditLog('fiyat'), async (req, res) => {
  try {
    const {
      urun_kart_id,
      cari_id,
      fiyat,
      birim,
      kdv_dahil,
      min_siparis_miktar,
      teslim_suresi_gun,
      gecerlilik_baslangic,
      gecerlilik_bitis,
      sozlesme_no,
    } = req.body;

    if (!urun_kart_id || !cari_id || !fiyat) {
      return res.status(400).json({ success: false, error: 'Ürün, tedarikçi ve fiyat zorunludur' });
    }

    // Mevcut kayıt var mı kontrol et
    const existing = await query('SELECT id FROM tedarikci_fiyatlari WHERE urun_kart_id = $1 AND cari_id = $2', [
      urun_kart_id,
      cari_id,
    ]);

    let result;
    if (existing.rows.length > 0) {
      // Güncelle
      result = await query(
        `
        UPDATE tedarikci_fiyatlari SET
          fiyat = $1, birim = $2, kdv_dahil = $3,
          min_siparis_miktar = $4, teslim_suresi_gun = $5,
          gecerlilik_baslangic = $6, gecerlilik_bitis = $7,
          sozlesme_no = $8, aktif = true, updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `,
        [
          fiyat,
          birim,
          kdv_dahil,
          min_siparis_miktar,
          teslim_suresi_gun,
          gecerlilik_baslangic,
          gecerlilik_bitis,
          sozlesme_no,
          existing.rows[0].id,
        ]
      );
    } else {
      // Yeni ekle
      result = await query(
        `
        INSERT INTO tedarikci_fiyatlari (
          urun_kart_id, cari_id, fiyat, birim, kdv_dahil,
          min_siparis_miktar, teslim_suresi_gun,
          gecerlilik_baslangic, gecerlilik_bitis, sozlesme_no
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
        [
          urun_kart_id,
          cari_id,
          fiyat,
          birim,
          kdv_dahil,
          min_siparis_miktar,
          teslim_suresi_gun,
          gecerlilik_baslangic,
          gecerlilik_bitis,
          sozlesme_no,
        ]
      );
    }

    // Fiyat geçmişine de ekle
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'TEDARIKCI'");
    if (kaynakResult.rows[0]) {
      await query(
        `
        INSERT INTO urun_fiyat_gecmisi (
          urun_kart_id, fiyat, kaynak_id, cari_id, kaynak, tarih
        ) VALUES ($1, $2, $3, $4, 'Tedarikçi sözleşmesi', CURRENT_DATE)
      `,
        [urun_kart_id, fiyat, kaynakResult.rows[0].id, cari_id]
      );
    }

    res.json({ success: true, data: result.rows[0], message: 'Sözleşme fiyatı kaydedildi' });
  } catch (error) {
    logger.error('Sözleşme fiyat kayıt hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sözleşme fiyat sil
router.delete('/sozlesmeler/fiyat/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM tedarikci_fiyatlari WHERE id = $1', [id]);
    res.json({ success: true, message: 'Sözleşme fiyatı silindi' });
  } catch (error) {
    logger.error('Sözleşme fiyat silme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// UYARILAR
// =====================================================

// Uyarı listesi
router.get('/uyarilar', async (req, res) => {
  try {
    const { tip, cozulmemis, limit = 100 } = req.query;

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (tip) {
      whereConditions.push(`fu.uyari_tipi = $${paramIndex++}`);
      params.push(tip);
    }

    if (cozulmemis === 'true') {
      whereConditions.push('fu.cozuldu = false');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    params.push(limit);

    const result = await query(
      `
      SELECT 
        fu.*,
        uk.kod as urun_kod,
        uk.ad as urun_ad
      FROM fiyat_uyarilari fu
      JOIN urun_kartlari uk ON uk.id = fu.urun_kart_id
      ${whereClause}
      ORDER BY fu.created_at DESC
      LIMIT $${paramIndex}
    `,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Uyarı listesi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Uyarı okundu işaretle
router.put('/uyarilar/:id/okundu', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE fiyat_uyarilari SET okundu = true WHERE id = $1', [id]);
    res.json({ success: true, message: 'Uyarı okundu işaretlendi' });
  } catch (error) {
    logger.error('Uyarı okundu hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Uyarı çözüldü işaretle
router.put('/uyarilar/:id/cozuldu', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE fiyat_uyarilari SET cozuldu = true, cozulme_tarihi = NOW() WHERE id = $1', [id]);
    res.json({ success: true, message: 'Uyarı çözüldü işaretlendi' });
  } catch (error) {
    logger.error('Uyarı çözüldü hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu okundu işaretle
router.post('/uyarilar/toplu-okundu', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'ID listesi gerekli' });
    }

    await query('UPDATE fiyat_uyarilari SET okundu = true WHERE id = ANY($1)', [ids]);
    res.json({ success: true, message: `${ids.length} uyarı okundu işaretlendi` });
  } catch (error) {
    logger.error('Toplu okundu hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TOPLU İŞLEMLER
// =====================================================

// Tüm fiyatları yeniden hesapla
router.post('/toplu/yeniden-hesapla', authenticate, async (_req, res) => {
  try {
    const sonuc = await tumFiyatlariYenidenHesapla();
    res.json({
      success: true,
      data: sonuc,
      message: `${sonuc.basarili} ürün başarıyla güncellendi, ${sonuc.hatali} hata`,
    });
  } catch (error) {
    logger.error('Toplu hesaplama hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI ile toplu fiyat tahmini (fiyatı olmayan ürünler için)
router.post('/toplu/ai-tahmini', authenticate, async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    const sonuc = await topluAiTahmini(parseInt(limit, 10));
    res.json({
      success: true,
      data: sonuc,
      message: `${sonuc.basarili} ürün için AI tahmini yapıldı, ${sonuc.hatali} hata`,
    });
  } catch (error) {
    logger.error('AI toplu tahmini hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek ürün için AI fiyat tahmini
router.post('/urunler/:id/ai-tahmini', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Ürün bilgisi al
    const urunResult = await query(`
      SELECT uk.id, uk.ad, uk.varsayilan_birim, kat.ad as kategori_ad
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE uk.id = $1
    `, [id]);

    if (urunResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }

    const urun = urunResult.rows[0];
    const tahmin = await aiTahminiFiyat(urun);

    if (!tahmin) {
      return res.json({
        success: false,
        error: 'AI fiyat tahmini yapılamadı - ürün için yeterli bilgi yok',
      });
    }

    // Kaydet
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'AI_TAHMINI'");
    const kaynakId = kaynakResult.rows[0]?.id;

    if (kaynakId) {
      await query(`
        INSERT INTO urun_fiyat_gecmisi (
          urun_kart_id, fiyat, kaynak_id, kaynak, tarih, aciklama
        ) VALUES ($1, $2, $3, 'AI Tahmini', CURRENT_DATE, $4)
        ON CONFLICT DO NOTHING
      `, [id, tahmin.fiyat, kaynakId, tahmin.aciklama]);

      await query(`
        UPDATE urun_kartlari SET
          aktif_fiyat = $2,
          aktif_fiyat_tipi = 'AI_TAHMINI',
          aktif_fiyat_guven = $3,
          aktif_fiyat_kaynagi_id = $4,
          aktif_fiyat_guncelleme = NOW()
        WHERE id = $1
      `, [id, tahmin.fiyat, tahmin.guven, kaynakId]);
    }

    res.json({
      success: true,
      data: {
        urun_id: parseInt(id, 10),
        urun_ad: urun.ad,
        fiyat: tahmin.fiyat,
        guven: tahmin.guven,
        aciklama: tahmin.aciklama,
      },
    });
  } catch (error) {
    logger.error('AI tahmini hatası', { error: error.message, id: req.params.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu fiyat hesapla (seçili ürünler)
router.post('/toplu/hesapla', authenticate, async (req, res) => {
  try {
    const { urun_ids } = req.body;
    if (!urun_ids || !Array.isArray(urun_ids)) {
      return res.status(400).json({ success: false, error: 'Ürün ID listesi gerekli' });
    }

    const sonuclar = await hesaplaTopluAktifFiyat(urun_ids);
    res.json({
      success: true,
      data: Object.fromEntries(sonuclar),
      message: `${urun_ids.length} ürün için fiyat hesaplandı`,
    });
  } catch (error) {
    logger.error('Toplu fiyat hesaplama hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu fiyat güncelleme (kategori bazlı)
router.post('/toplu/guncelle', authenticate, auditLog('fiyat'), async (req, res) => {
  try {
    const { kategori_id, islem, deger, aciklama } = req.body;

    if (!islem || !deger) {
      return res.status(400).json({ success: false, error: 'İşlem ve değer zorunludur' });
    }

    // Hedef ürünleri bul
    let urunQuery = 'SELECT id, aktif_fiyat FROM urun_kartlari WHERE aktif = true AND aktif_fiyat IS NOT NULL';
    const params = [];

    if (kategori_id) {
      urunQuery += ' AND kategori_id = $1';
      params.push(kategori_id);
    }

    const urunler = await query(urunQuery, params);

    // Manuel kaynak ID
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'MANUEL'");
    const kaynakId = kaynakResult.rows[0]?.id;

    let guncellenen = 0;

    for (const urun of urunler.rows) {
      let yeniFiyat;

      if (islem === 'yuzde_artir') {
        yeniFiyat = urun.aktif_fiyat * (1 + deger / 100);
      } else if (islem === 'yuzde_azalt') {
        yeniFiyat = urun.aktif_fiyat * (1 - deger / 100);
      } else if (islem === 'sabit_ekle') {
        yeniFiyat = parseFloat(urun.aktif_fiyat) + parseFloat(deger);
      } else if (islem === 'sabit_cikar') {
        yeniFiyat = parseFloat(urun.aktif_fiyat) - parseFloat(deger);
      } else {
        continue;
      }

      if (yeniFiyat > 0) {
        await query(
          `
          INSERT INTO urun_fiyat_gecmisi (
            urun_kart_id, fiyat, kaynak_id, kaynak, aciklama, tarih
          ) VALUES ($1, $2, $3, 'Toplu güncelleme', $4, CURRENT_DATE)
        `,
          [urun.id, yeniFiyat.toFixed(2), kaynakId, aciklama || `Toplu ${islem}: ${deger}`]
        );

        guncellenen++;
      }
    }

    res.json({
      success: true,
      message: `${guncellenen} ürün güncellendi`,
      data: { guncellenen },
    });
  } catch (error) {
    logger.error('Toplu güncelleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// FİYAT KAYNAKLARI
// =====================================================

// Tüm fiyat kaynaklarını listele
router.get('/kaynaklar', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        fk.*,
        (SELECT COUNT(*) FROM urun_fiyat_gecmisi WHERE kaynak_id = fk.id) as toplam_kayit,
        (SELECT COUNT(*) FROM urun_fiyat_gecmisi WHERE kaynak_id = fk.id AND tarih > NOW() - INTERVAL '30 days') as son_30_gun,
        (SELECT COUNT(*) FROM urun_kartlari WHERE aktif_fiyat_kaynagi_id = fk.id AND aktif = true) as aktif_urun_sayisi
      FROM fiyat_kaynaklari fk
      ORDER BY fk.guvenilirlik_skoru DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Fiyat kaynakları listesi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Kaynak güncelle
router.put('/kaynaklar/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, aciklama, guvenilirlik_skoru, aktif, scraping_config } = req.body;

    const result = await query(
      `
      UPDATE fiyat_kaynaklari
      SET ad = COALESCE($1, ad),
          aciklama = COALESCE($2, aciklama),
          guvenilirlik_skoru = COALESCE($3, guvenilirlik_skoru),
          aktif = COALESCE($4, aktif),
          scraping_config = COALESCE($5, scraping_config),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `,
      [ad, aciklama, guvenilirlik_skoru, aktif, scraping_config, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Kaynak güncelleme hatası', { error: error.message, id: req.params.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// KATEGORİLER
// =====================================================

// Kategori listesi (filtre için)
router.get('/kategoriler', async (_req, res) => {
  try {
    const result = await query(`
      SELECT * FROM v_kategori_fiyat_durumu
      ORDER BY kategori_ad
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Kategori listesi hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// RAPORLAR
// =====================================================

// Fiyat güncellik raporu
router.get('/raporlar/guncellik', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        guncellik_durumu,
        COUNT(*) as urun_sayisi
      FROM v_urun_fiyat_durumu
      GROUP BY guncellik_durumu
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Güncellik raporu hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fiyat trend raporu (son 30 gün)
router.get('/raporlar/trend', async (req, res) => {
  try {
    const { kategori_id } = req.query;

    let whereClause = '';
    const params = [];

    if (kategori_id) {
      whereClause = 'WHERE uk.kategori_id = $1';
      params.push(kategori_id);
    }

    const result = await query(
      `
      SELECT 
        DATE_TRUNC('day', ufg.tarih) as tarih,
        COUNT(DISTINCT ufg.urun_kart_id) as urun_sayisi,
        COUNT(*) as kayit_sayisi,
        AVG(ufg.fiyat) as ort_fiyat
      FROM urun_fiyat_gecmisi ufg
      JOIN urun_kartlari uk ON uk.id = ufg.urun_kart_id
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} ufg.tarih >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', ufg.tarih)
      ORDER BY tarih
    `,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Trend raporu hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eskimiş fiyat kontrolü başlat
router.post('/raporlar/eskime-kontrolu', authenticate, async (_req, res) => {
  try {
    // Eskimiş fiyatları tespit et ve uyarı oluştur
    const result = await query(`
      INSERT INTO fiyat_uyarilari (urun_kart_id, uyari_tipi, uyari_mesaji, onem_derecesi)
      SELECT 
        uk.id,
        'ESKIMIS',
        'Fiyat ' || EXTRACT(DAY FROM NOW() - uk.aktif_fiyat_guncelleme)::INTEGER || ' gündür güncellenmedi',
        CASE 
          WHEN uk.aktif_fiyat_guncelleme < NOW() - INTERVAL '60 days' THEN 'kritik'
          WHEN uk.aktif_fiyat_guncelleme < NOW() - INTERVAL '30 days' THEN 'yuksek'
          ELSE 'orta'
        END
      FROM urun_kartlari uk
      WHERE uk.aktif = true
        AND uk.aktif_fiyat_guncelleme < NOW() - INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM fiyat_uyarilari fu 
          WHERE fu.urun_kart_id = uk.id 
            AND fu.uyari_tipi = 'ESKIMIS' 
            AND fu.cozuldu = false
        )
      RETURNING id
    `);

    res.json({
      success: true,
      message: `${result.rowCount} eskimiş fiyat uyarısı oluşturuldu`,
    });
  } catch (error) {
    logger.error('Eskime kontrolü hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PİYASA VERİLERİ / SCRAPING
// =====================================================

// Scraping durumu
router.get('/piyasa/durum', async (_req, res) => {
  try {
    const durum = await getScrapingDurumu();
    res.json({ success: true, data: durum });
  } catch (error) {
    logger.error('Scraping durumu hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// TZOB verisi yükle (manuel JSON girişi)
router.post('/piyasa/tzob', authenticate, auditLog('fiyat'), async (req, res) => {
  try {
    const { veri } = req.body;

    if (!veri || !Array.isArray(veri)) {
      return res.status(400).json({
        success: false,
        error: 'Veri formatı hatalı. Beklenen: [{urun_adi, uretici_fiyat, market_fiyat, birim}]',
      });
    }

    const sonuc = await parseTZOBFiyatlari(veri);

    res.json({
      success: true,
      data: sonuc,
      message: `TZOB: ${sonuc.guncellenen}/${sonuc.toplam} ürün eşleşti ve güncellendi`,
    });
  } catch (error) {
    logger.error('TZOB veri yükleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ESK verisi yükle (manuel JSON girişi)
router.post('/piyasa/esk', authenticate, auditLog('fiyat'), async (req, res) => {
  try {
    const { veri } = req.body;

    if (!veri || !Array.isArray(veri)) {
      return res.status(400).json({
        success: false,
        error: 'Veri formatı hatalı. Beklenen: [{urun_adi, fiyat, birim, kdv_dahil}]',
      });
    }

    const sonuc = await parseESKFiyatlari(veri);

    res.json({
      success: true,
      data: sonuc,
      message: `ESK: ${sonuc.guncellenen}/${sonuc.toplam} ürün eşleşti ve güncellendi`,
    });
  } catch (error) {
    logger.error('ESK veri yükleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Hal fiyatları yükle (manuel JSON girişi)
router.post('/piyasa/hal', authenticate, auditLog('fiyat'), async (req, res) => {
  try {
    const { veri, bolge = 'istanbul' } = req.body;

    if (!veri || !Array.isArray(veri)) {
      return res.status(400).json({
        success: false,
        error: 'Veri formatı hatalı. Beklenen: [{urun_adi, min_fiyat, max_fiyat, ortalama_fiyat, birim}]',
      });
    }

    const sonuc = await parseHalFiyatlari(veri, bolge);

    res.json({
      success: true,
      data: sonuc,
      message: `HAL (${bolge}): ${sonuc.guncellenen}/${sonuc.toplam} ürün eşleşti ve güncellendi`,
    });
  } catch (error) {
    logger.error('HAL veri yükleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Güven skorlarını yeniden hesapla
router.post('/piyasa/guven-hesapla', authenticate, async (_req, res) => {
  try {
    const sonuc = await yenidenHesaplaGuvenSkorlari();
    res.json({
      success: true,
      data: sonuc,
      message: `${sonuc.guncellenen} ürün için güven skoru güncellendi`,
    });
  } catch (error) {
    logger.error('Güven skoru hesaplama hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eskimiş fiyat kontrolü (servis fonksiyonu)
router.post('/piyasa/eskime-kontrolu', authenticate, async (_req, res) => {
  try {
    const sonuc = await eskimisFiyatKontrolu();
    res.json({
      success: true,
      data: sonuc,
      message: `${sonuc.yeniUyari} yeni eskime uyarısı oluşturuldu`,
    });
  } catch (error) {
    logger.error('Eskime kontrolü hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// MEVSİMSEL ANALİZ
// =====================================================

// Ürün için mevsimsel katsayı hesapla
router.post('/mevsimsel/:urunId/hesapla', authenticate, async (req, res) => {
  try {
    const { urunId } = req.params;
    const sonuc = await hesaplaMevsimselKatsayilar(parseInt(urunId, 10));

    if (!sonuc.success) {
      return res.status(400).json({ success: false, error: sonuc.message });
    }

    res.json({
      success: true,
      data: sonuc,
      message: `${sonuc.katsayilar.length} ay için mevsimsel katsayı hesaplandı`,
    });
  } catch (error) {
    logger.error('Mevsimsel katsayı hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün mevsimsel katsayıları getir
router.get('/mevsimsel/:urunId', async (req, res) => {
  try {
    const { urunId } = req.params;

    const result = await query(
      `
      SELECT 
        mk.*,
        uk.ad as urun_ad,
        CASE mk.ay 
          WHEN 1 THEN 'Ocak' WHEN 2 THEN 'Şubat' WHEN 3 THEN 'Mart'
          WHEN 4 THEN 'Nisan' WHEN 5 THEN 'Mayıs' WHEN 6 THEN 'Haziran'
          WHEN 7 THEN 'Temmuz' WHEN 8 THEN 'Ağustos' WHEN 9 THEN 'Eylül'
          WHEN 10 THEN 'Ekim' WHEN 11 THEN 'Kasım' WHEN 12 THEN 'Aralık'
        END as ay_adi
      FROM mevsimsel_katsayilar mk
      JOIN urun_kartlari uk ON uk.id = mk.urun_kart_id
      WHERE mk.urun_kart_id = $1
      ORDER BY mk.ay
    `,
      [urunId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Mevsimsel katsayı getirme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mevsimsel ürünleri listele
router.get('/mevsimsel', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        uk.id, uk.kod, uk.ad, uk.aktif_fiyat,
        kat.ad as kategori_ad,
        ARRAY_AGG(
          json_build_object('ay', mk.ay, 'katsayi', mk.katsayi)
          ORDER BY mk.ay
        ) as katsayilar
      FROM urun_kartlari uk
      JOIN mevsimsel_katsayilar mk ON mk.urun_kart_id = uk.id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE uk.aktif = true
      GROUP BY uk.id, uk.kod, uk.ad, uk.aktif_fiyat, kat.ad
      ORDER BY uk.ad
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Mevsimsel ürünler hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SCRAPING LOG
// =====================================================

// Scraping loglarını getir
router.get('/piyasa/loglar', async (req, res) => {
  try {
    const { kaynak_id, limit = 50 } = req.query;

    let whereClause = '';
    const params = [];

    if (kaynak_id) {
      whereClause = 'WHERE fsl.kaynak_id = $1';
      params.push(kaynak_id);
    }

    params.push(limit);

    const result = await query(
      `
      SELECT 
        fsl.*,
        fk.kod as kaynak_kod,
        fk.ad as kaynak_ad
      FROM fiyat_scraping_log fsl
      JOIN fiyat_kaynaklari fk ON fk.id = fsl.kaynak_id
      ${whereClause}
      ORDER BY fsl.created_at DESC
      LIMIT $${params.length}
    `,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Scraping log hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// OTOMATİK MARKET FİYATLARI (Migros, ŞOK, Trendyol)
// =====================================================

// Tek ürün için market fiyatı çek (GERÇEK SCRAPING)
router.post('/piyasa/market/:urunId', authenticate, async (req, res) => {
  try {
    const { urunId } = req.params;

    // Ürün bilgisini al
    const urunResult = await query(
      `
      SELECT id, kod, ad, varsayilan_birim FROM urun_kartlari WHERE id = $1 AND aktif = true
    `,
      [urunId]
    );

    if (urunResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı' });
    }

    const urun = urunResult.rows[0];
    logger.info('Market fiyatı çekiliyor', { urunId, urunAd: urun.ad });

    // Market scraper ile fiyat çek
    const sonuc = await searchMarketPrices(urun.ad);

    if (!sonuc.success || !sonuc.fiyatlar || sonuc.fiyatlar.length === 0) {
      return res.json({
        success: false,
        error: `"${urun.ad}" için piyasa fiyatı bulunamadı`,
        urun: urun,
      });
    }

    // Piyasa kaynak ID'sini al
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'PIYASA'");
    const kaynakId = kaynakResult.rows[0]?.id;

    // Fiyat geçmişine kaydet
    const fiyat = sonuc.ortalama || sonuc.medyan;
    const birim = sonuc.birim === 'kg' ? 'kg' : sonuc.birim === 'L' ? 'lt' : urun.varsayilan_birim;

    await query(
      `
      INSERT INTO urun_fiyat_gecmisi (
        urun_kart_id, fiyat, kaynak_id, kaynak, birim, 
        min_fiyat, max_fiyat, tarih, ham_veri
      ) VALUES ($1, $2, $3, 'Market Scraping (Migros, ŞOK, Trendyol)', $4, $5, $6, CURRENT_DATE, $7)
    `,
      [
        urun.id,
        fiyat,
        kaynakId,
        birim,
        sonuc.min,
        sonuc.max,
        JSON.stringify({
          kaynak: sonuc.kaynak,
          toplam_sonuc: sonuc.toplam_sonuc,
          fiyatlar: sonuc.fiyatlar.slice(0, 5), // İlk 5 sonucu sakla
        }),
      ]
    );

    // Kaynak güncelleme zamanını güncelle
    await query(`
      UPDATE fiyat_kaynaklari 
      SET son_basarili_guncelleme = NOW()
      WHERE kod = 'PIYASA'
    `);

    // Log kaydı
    if (kaynakId) {
      await query(
        `
        INSERT INTO fiyat_scraping_log (kaynak_id, basarili, toplam_urun, guncellenen_urun)
        VALUES ($1, true, 1, 1)
      `,
        [kaynakId]
      );
    }

    res.json({
      success: true,
      data: {
        urun_id: urun.id,
        urun_ad: urun.ad,
        fiyat,
        birim,
        min: sonuc.min,
        max: sonuc.max,
        ortalama: sonuc.ortalama,
        medyan: sonuc.medyan,
        toplam_sonuc: sonuc.toplam_sonuc,
        fiyatlar: sonuc.fiyatlar.slice(0, 10),
      },
      message: `${urun.ad} için ${sonuc.toplam_sonuc} market fiyatı bulundu. Ortalama: ₺${fiyat}/${birim}`,
    });
  } catch (error) {
    logger.error('Market fiyat çekme hatası', { error: error.message, urunId: req.params.urunId });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu market fiyat güncelleme (kategori veya liste bazlı)
router.post('/piyasa/market/toplu', authenticate, async (req, res) => {
  try {
    const { kategori_id, urun_ids, limit = 20, mode = 'eskimis' } = req.body;

    let urunler;

    if (urun_ids && Array.isArray(urun_ids)) {
      // Belirli ürünler (seçili)
      const result = await query(
        `
        SELECT id, kod, ad, varsayilan_birim 
        FROM urun_kartlari 
        WHERE id = ANY($1) AND aktif = true
      `,
        [urun_ids]
      );
      urunler = result.rows;
    } else if (mode === 'kategori' && kategori_id) {
      // Kategori bazlı - seçili kategorideki TÜM ürünler
      const result = await query(
        `
        SELECT id, kod, ad, varsayilan_birim 
        FROM urun_kartlari 
        WHERE kategori_id = $1 AND aktif = true
        ORDER BY ad
        LIMIT $2
      `,
        [kategori_id, limit]
      );
      urunler = result.rows;
    } else if (mode === 'fiyatsiz') {
      // Fiyatı olmayan ürünler
      const result = await query(
        `
        SELECT id, kod, ad, varsayilan_birim 
        FROM urun_kartlari 
        WHERE aktif = true 
          AND (aktif_fiyat IS NULL OR aktif_fiyat = 0)
        ORDER BY ad
        LIMIT $1
      `,
        [limit]
      );
      urunler = result.rows;
    } else if (mode === 'hepsi') {
      // TÜM ürünler
      const result = await query(
        `
        SELECT id, kod, ad, varsayilan_birim 
        FROM urun_kartlari 
        WHERE aktif = true
        ORDER BY ad
        LIMIT $1
      `,
        [limit]
      );
      urunler = result.rows;
    } else {
      // Varsayılan: Fiyatı eski olanlar (30+ gün)
      const result = await query(
        `
        SELECT id, kod, ad, varsayilan_birim 
        FROM urun_kartlari 
        WHERE aktif = true 
          AND (aktif_fiyat_guncelleme IS NULL OR aktif_fiyat_guncelleme < NOW() - INTERVAL '30 days')
        ORDER BY aktif_fiyat_guncelleme ASC NULLS FIRST
        LIMIT $1
      `,
        [limit]
      );
      urunler = result.rows;
    }

    logger.info('Toplu market güncelleme başlatıldı', { mode, kategori_id, limit, urunSayisi: urunler?.length });

    if (urunler.length === 0) {
      return res.json({ success: true, message: 'Güncellenecek ürün bulunamadı', data: { basarili: 0, hatali: 0 } });
    }

    // Piyasa kaynak ID'sini al
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'PIYASA'");
    const kaynakId = kaynakResult.rows[0]?.id;

    const sonuclar = { basarili: 0, hatali: 0, detaylar: [] };

    // Sırayla işle (paralel yapmıyoruz, site engelleyebilir)
    for (const urun of urunler) {
      try {
        logger.info('Toplu market fiyatı çekiliyor', { urunId: urun.id, urunAd: urun.ad });

        const sonuc = await searchMarketPrices(urun.ad);

        if (sonuc.success && sonuc.fiyatlar && sonuc.fiyatlar.length > 0) {
          const fiyat = sonuc.ortalama || sonuc.medyan;
          const birim = sonuc.birim === 'kg' ? 'kg' : sonuc.birim === 'L' ? 'lt' : urun.varsayilan_birim;

          await query(
            `
            INSERT INTO urun_fiyat_gecmisi (
              urun_kart_id, fiyat, kaynak_id, kaynak, birim, 
              min_fiyat, max_fiyat, tarih, ham_veri
            ) VALUES ($1, $2, $3, 'Market Scraping (Toplu)', $4, $5, $6, CURRENT_DATE, $7)
          `,
            [urun.id, fiyat, kaynakId, birim, sonuc.min, sonuc.max, JSON.stringify({ toplam: sonuc.toplam_sonuc })]
          );

          sonuclar.basarili++;
          sonuclar.detaylar.push({ urun_id: urun.id, ad: urun.ad, fiyat, durum: 'basarili' });
        } else {
          sonuclar.hatali++;
          sonuclar.detaylar.push({ urun_id: urun.id, ad: urun.ad, durum: 'bulunamadi' });
        }

        // Rate limiting - her istek arasında 2 saniye bekle
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (urunError) {
        sonuclar.hatali++;
        sonuclar.detaylar.push({ urun_id: urun.id, ad: urun.ad, durum: 'hata', hata: urunError.message });
      }
    }

    // Kaynak güncelle
    if (sonuclar.basarili > 0) {
      await query(`UPDATE fiyat_kaynaklari SET son_basarili_guncelleme = NOW() WHERE kod = 'PIYASA'`);

      if (kaynakId) {
        await query(
          `
          INSERT INTO fiyat_scraping_log (kaynak_id, basarili, toplam_urun, guncellenen_urun)
          VALUES ($1, true, $2, $3)
        `,
          [kaynakId, urunler.length, sonuclar.basarili]
        );
      }
    }

    // Browser'ı kapat
    await closeBrowser();

    res.json({
      success: true,
      data: sonuclar,
      message: `${sonuclar.basarili}/${urunler.length} ürün için piyasa fiyatı güncellendi`,
    });
  } catch (error) {
    logger.error('Toplu market fiyat hatası', { error: error.message });
    await closeBrowser();
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ürün adı ile direkt arama (test için)
router.get('/piyasa/market/ara', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'Arama terimi en az 2 karakter olmalı' });
    }

    logger.info('Market fiyat araması', { arama: q });

    const sonuc = await searchMarketPrices(q);

    // Browser'ı kapat
    await closeBrowser();

    res.json({
      success: sonuc.success,
      data: sonuc,
    });
  } catch (error) {
    logger.error('Market arama hatası', { error: error.message });
    await closeBrowser();
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// AI AKILLI EŞLEŞTİRME
// =====================================================

// AI ile toplu fatura kalemi eşleştirme
router.post('/ai/eslestir', async (req, res) => {
  try {
    const { limit = 20 } = req.body;

    logger.info('AI toplu eşleştirme başlatıldı', { limit });

    const sonuc = await aiTopluEslestir(limit);

    if (sonuc.success) {
      res.json({
        success: true,
        data: sonuc.data,
        message: sonuc.message,
      });
    } else {
      res.status(500).json({ success: false, error: sonuc.error });
    }
  } catch (error) {
    logger.error('AI eşleştirme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mevcut mapping'lerle eşleştir
router.post('/ai/mapping-eslestir', async (_req, res) => {
  try {
    const sonuc = await mappingIleEslestir();

    res.json({
      success: sonuc.success,
      data: sonuc,
      message: sonuc.success ? `${sonuc.eslesen} kalem eşleştirildi` : sonuc.error,
    });
  } catch (error) {
    logger.error('Mapping eşleştirme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eşleşmemiş kalemleri listele
router.get('/ai/eslesmemis', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await query(
      `
      SELECT 
        fk.id,
        fk.orijinal_urun_adi,
        fk.birim,
        fk.birim_fiyat,
        fk.tedarikci_ad,
        fk.fatura_tarihi
      FROM fatura_kalemleri fk
      WHERE fk.urun_id IS NULL
        AND fk.orijinal_urun_adi IS NOT NULL
      ORDER BY fk.fatura_tarihi DESC
      LIMIT $1
    `,
      [limit]
    );

    res.json({ success: true, data: result.rows, total: result.rowCount });
  } catch (error) {
    logger.error('Eşleşmemiş kalemler hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
