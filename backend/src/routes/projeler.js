import express from 'express';
import { query } from '../database.js';

const router = express.Router();

// =====================================================
// MERKEZİ PROJE API
// Tüm modüller bu API'yi kullanacak
// =====================================================

/**
 * GET /api/projeler
 * Tüm projeleri listele (tüm alanlarla)
 */
router.get('/', async (req, res) => {
  try {
    const { durum, aktif, firma_id } = req.query;
    
    let sql = `
      SELECT 
        p.*,
        f.unvan as firma_unvani,
        f.kisa_ad as firma_kisa_ad,
        COALESCE((SELECT COUNT(*) FROM proje_personelleri pp WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as personel_sayisi,
        COALESCE((SELECT SUM(per.maas) FROM proje_personelleri pp 
                  JOIN personeller per ON per.id = pp.personel_id 
                  WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as toplam_maas,
        COALESCE((SELECT COUNT(*) FROM siparisler s WHERE s.proje_id = p.id), 0) as siparis_sayisi,
        COALESCE((SELECT SUM(s.toplam_tutar) FROM siparisler s WHERE s.proje_id = p.id AND s.durum = 'teslim_alindi'), 0) as toplam_harcama
      FROM projeler p
      LEFT JOIN firmalar f ON p.firma_id = f.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Durum filtresi (string: aktif, pasif, tamamlandi, beklemede)
    if (durum) {
      sql += ` AND p.durum = $${paramIndex}`;
      params.push(durum);
      paramIndex++;
    }
    
    // Aktif filtresi (boolean)
    if (aktif !== undefined) {
      sql += ` AND p.aktif = $${paramIndex}`;
      params.push(aktif === 'true');
      paramIndex++;
    }
    
    // Firma filtresi
    if (firma_id) {
      sql += ` AND p.firma_id = $${paramIndex}`;
      params.push(firma_id);
      paramIndex++;
    }
    
    sql += ' ORDER BY p.ad ASC';
    
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Projeler listeleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projeler/:id
 * Tek proje detayı (tüm ilişkili verilerle)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Proje bilgisi
    const projeResult = await query(`
      SELECT 
        p.*,
        COALESCE((SELECT COUNT(*) FROM proje_personelleri pp WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as personel_sayisi,
        COALESCE((SELECT SUM(per.maas) FROM proje_personelleri pp 
                  JOIN personeller per ON per.id = pp.personel_id 
                  WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as toplam_maas,
        COALESCE((SELECT COUNT(*) FROM siparisler s WHERE s.proje_id = p.id), 0) as siparis_sayisi,
        COALESCE((SELECT SUM(s.toplam_tutar) FROM siparisler s WHERE s.proje_id = p.id AND s.durum = 'teslim_alindi'), 0) as toplam_harcama
      FROM projeler p
      WHERE p.id = $1
    `, [id]);
    
    if (projeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    res.json(projeResult.rows[0]);
  } catch (error) {
    console.error('Proje detay hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projeler/:id/personeller
 * Proje personelleri
 */
router.get('/:id/personeller', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        per.*,
        pp.gorev,
        pp.baslangic_tarihi as atama_tarihi,
        pp.bitis_tarihi as atama_bitis
      FROM personeller per
      JOIN proje_personelleri pp ON pp.personel_id = per.id
      WHERE pp.proje_id = $1 AND pp.aktif = TRUE
      ORDER BY per.ad, per.soyad
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Proje personelleri hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projeler/:id/siparisler
 * Proje siparişleri
 */
router.get('/:id/siparisler', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        s.*,
        c.unvan as tedarikci_unvan,
        (SELECT COUNT(*) FROM siparis_kalemleri WHERE siparis_id = s.id) as kalem_sayisi
      FROM siparisler s
      LEFT JOIN cariler c ON s.tedarikci_id = c.id
      WHERE s.proje_id = $1
      ORDER BY s.created_at DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Proje siparişleri hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projeler/:id/hareketler
 * Proje gelir/gider hareketleri
 */
router.get('/:id/hareketler', async (req, res) => {
  try {
    const { id } = req.params;
    const { yil, ay } = req.query;
    
    let sql = 'SELECT * FROM proje_hareketler WHERE proje_id = $1';
    const params = [id];
    let paramIndex = 2;
    
    if (yil) {
      sql += ` AND EXTRACT(YEAR FROM tarih) = $${paramIndex}`;
      params.push(yil);
      paramIndex++;
    }
    if (ay) {
      sql += ` AND EXTRACT(MONTH FROM tarih) = $${paramIndex}`;
      params.push(ay);
      paramIndex++;
    }
    
    sql += ' ORDER BY tarih DESC';
    
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Proje hareketleri hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projeler
 * Yeni proje oluştur (tüm alanları destekler)
 */
router.post('/', async (req, res) => {
  try {
    const { 
      // Temel
      kod, ad, aciklama, firma_id, tender_id, cari_id,
      // İşveren/Lokasyon
      musteri, lokasyon, adres, il, ilce,
      // Sözleşme
      sozlesme_no, sozlesme_tarihi, sozlesme_bitis_tarihi, sozlesme_bedeli, teminat_tutari, teminat_iade_tarihi,
      // Kapasite
      gunluk_kisi_sayisi, ogun_sayisi, toplam_ogun, gunluk_maliyet_hedef,
      // Fatura
      fatura_unvani, fatura_vergi_no, fatura_vergi_dairesi, fatura_adresi, fatura_kesim_gunu, kdv_orani,
      // Hakediş
      hakedis_tipi, aylik_hakedis, hakedis_gun, hakedis_kesinti_orani,
      // Yetkili
      yetkili, yetkili_unvan, telefon, email,
      // Diğer
      proje_tipi, kategori, baslangic_tarihi, bitis_tarihi, butce, durum, renk, aktif, notlar
    } = req.body;
    
    if (!ad) {
      return res.status(400).json({ error: 'Proje adı zorunludur' });
    }
    
    const result = await query(`
      INSERT INTO projeler (
        kod, ad, aciklama, firma_id, tender_id, cari_id,
        musteri, lokasyon, adres, il, ilce,
        sozlesme_no, sozlesme_tarihi, sozlesme_bitis_tarihi, sozlesme_bedeli, teminat_tutari, teminat_iade_tarihi,
        gunluk_kisi_sayisi, ogun_sayisi, toplam_ogun, gunluk_maliyet_hedef,
        fatura_unvani, fatura_vergi_no, fatura_vergi_dairesi, fatura_adresi, fatura_kesim_gunu, kdv_orani,
        hakedis_tipi, aylik_hakedis, hakedis_gun, hakedis_kesinti_orani,
        yetkili, yetkili_unvan, telefon, email,
        proje_tipi, kategori, baslangic_tarihi, bitis_tarihi, butce, durum, renk, aktif, notlar
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31,
        $32, $33, $34, $35,
        $36, $37, $38, $39, $40, $41, $42, $43, $44
      )
      RETURNING *
    `, [
      kod || null, ad, aciklama || null, firma_id || null, tender_id || null, cari_id || null,
      musteri || null, lokasyon || null, adres || null, il || null, ilce || null,
      sozlesme_no || null, sozlesme_tarihi || null, sozlesme_bitis_tarihi || null, sozlesme_bedeli || null, teminat_tutari || null, teminat_iade_tarihi || null,
      gunluk_kisi_sayisi || null, ogun_sayisi || 3, toplam_ogun || null, gunluk_maliyet_hedef || null,
      fatura_unvani || null, fatura_vergi_no || null, fatura_vergi_dairesi || null, fatura_adresi || null, fatura_kesim_gunu || null, kdv_orani || 10,
      hakedis_tipi || 'aylik', aylik_hakedis || null, hakedis_gun || null, hakedis_kesinti_orani || 0,
      yetkili || null, yetkili_unvan || null, telefon || null, email || null,
      proje_tipi || 'yemek', kategori || null, baslangic_tarihi || null, bitis_tarihi || null, butce || 0, durum || 'aktif', renk || '#6366f1', aktif !== false, notlar || null
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Proje oluşturma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/projeler/:id
 * Proje güncelle (tüm alanları destekler)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      // Temel
      kod, ad, aciklama, firma_id, tender_id, cari_id,
      // İşveren/Lokasyon
      musteri, lokasyon, adres, il, ilce,
      // Sözleşme
      sozlesme_no, sozlesme_tarihi, sozlesme_bitis_tarihi, sozlesme_bedeli, teminat_tutari, teminat_iade_tarihi,
      // Kapasite
      gunluk_kisi_sayisi, ogun_sayisi, toplam_ogun, gunluk_maliyet_hedef,
      // Fatura
      fatura_unvani, fatura_vergi_no, fatura_vergi_dairesi, fatura_adresi, fatura_kesim_gunu, kdv_orani,
      // Hakediş
      hakedis_tipi, aylik_hakedis, hakedis_gun, hakedis_kesinti_orani,
      // Yetkili
      yetkili, yetkili_unvan, telefon, email,
      // Diğer
      proje_tipi, kategori, baslangic_tarihi, bitis_tarihi, butce, durum, renk, aktif, notlar
    } = req.body;
    
    const result = await query(`
      UPDATE projeler SET
        kod = COALESCE($1, kod),
        ad = COALESCE($2, ad),
        aciklama = $3,
        firma_id = COALESCE($4, firma_id),
        tender_id = $5,
        cari_id = $6,
        musteri = $7,
        lokasyon = $8,
        adres = $9,
        il = $10,
        ilce = $11,
        sozlesme_no = $12,
        sozlesme_tarihi = $13,
        sozlesme_bitis_tarihi = $14,
        sozlesme_bedeli = $15,
        teminat_tutari = $16,
        teminat_iade_tarihi = $17,
        gunluk_kisi_sayisi = $18,
        ogun_sayisi = COALESCE($19, ogun_sayisi),
        toplam_ogun = $20,
        gunluk_maliyet_hedef = $21,
        fatura_unvani = $22,
        fatura_vergi_no = $23,
        fatura_vergi_dairesi = $24,
        fatura_adresi = $25,
        fatura_kesim_gunu = $26,
        kdv_orani = COALESCE($27, kdv_orani),
        hakedis_tipi = COALESCE($28, hakedis_tipi),
        aylik_hakedis = $29,
        hakedis_gun = $30,
        hakedis_kesinti_orani = COALESCE($31, hakedis_kesinti_orani),
        yetkili = $32,
        yetkili_unvan = $33,
        telefon = $34,
        email = $35,
        proje_tipi = COALESCE($36, proje_tipi),
        kategori = $37,
        baslangic_tarihi = $38,
        bitis_tarihi = $39,
        butce = COALESCE($40, butce),
        durum = COALESCE($41, durum),
        renk = COALESCE($42, renk),
        aktif = COALESCE($43, aktif),
        notlar = $44,
        updated_at = NOW()
      WHERE id = $45
      RETURNING *
    `, [
      kod, ad, aciklama, firma_id, tender_id, cari_id,
      musteri, lokasyon, adres, il, ilce,
      sozlesme_no, sozlesme_tarihi, sozlesme_bitis_tarihi, sozlesme_bedeli, teminat_tutari, teminat_iade_tarihi,
      gunluk_kisi_sayisi, ogun_sayisi, toplam_ogun, gunluk_maliyet_hedef,
      fatura_unvani, fatura_vergi_no, fatura_vergi_dairesi, fatura_adresi, fatura_kesim_gunu, kdv_orani,
      hakedis_tipi, aylik_hakedis, hakedis_gun, hakedis_kesinti_orani,
      yetkili, yetkili_unvan, telefon, email,
      proje_tipi, kategori, baslangic_tarihi, bitis_tarihi, butce, durum, renk, aktif, notlar,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Proje güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/projeler/:id
 * Proje sil (soft delete - aktif = false)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query; // ?hard=true ile kalıcı silme
    
    if (hard === 'true') {
      const result = await query('DELETE FROM projeler WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Proje bulunamadı' });
      }
      res.json({ success: true, deleted: result.rows[0] });
    } else {
      // Soft delete
      const result = await query(`
        UPDATE projeler SET aktif = false, durum = 'pasif', updated_at = NOW()
        WHERE id = $1 RETURNING *
      `, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Proje bulunamadı' });
      }
      res.json({ success: true, deactivated: result.rows[0] });
    }
  } catch (error) {
    console.error('Proje silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projeler/:id/ozet
 * Proje özet istatistikleri
 */
router.get('/:id/ozet', async (req, res) => {
  try {
    const { id } = req.params;
    const { yil, ay } = req.query;
    
    // Personel özeti
    const personelOzet = await query(`
      SELECT 
        COUNT(*) as personel_sayisi,
        COALESCE(SUM(per.maas), 0) as toplam_maas,
        COALESCE(SUM(per.bordro_maas), 0) as toplam_bordro_maas
      FROM proje_personelleri pp
      JOIN personeller per ON per.id = pp.personel_id
      WHERE pp.proje_id = $1 AND pp.aktif = TRUE
    `, [id]);
    
    // Sipariş özeti
    const siparisOzet = await query(`
      SELECT 
        COUNT(*) as toplam_siparis,
        COUNT(CASE WHEN durum NOT IN ('teslim_alindi', 'iptal') THEN 1 END) as bekleyen,
        COALESCE(SUM(CASE WHEN durum = 'teslim_alindi' THEN toplam_tutar ELSE 0 END), 0) as tamamlanan_tutar
      FROM siparisler
      WHERE proje_id = $1
    `, [id]);
    
    // Gelir/Gider özeti
    let hareketParams = [id];
    let hareketFilter = '';
    if (yil && ay) {
      hareketFilter = 'AND EXTRACT(YEAR FROM tarih) = $2 AND EXTRACT(MONTH FROM tarih) = $3';
      hareketParams.push(yil, ay);
    }
    
    const hareketOzet = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tip = 'gelir' THEN tutar ELSE 0 END), 0) as toplam_gelir,
        COALESCE(SUM(CASE WHEN tip = 'gider' THEN tutar ELSE 0 END), 0) as toplam_gider,
        COALESCE(SUM(CASE WHEN tip = 'gelir' THEN tutar ELSE -tutar END), 0) as net_kar
      FROM proje_hareketler
      WHERE proje_id = $1 ${hareketFilter}
    `, hareketParams);
    
    res.json({
      personel: personelOzet.rows[0],
      siparis: siparisOzet.rows[0],
      hareket: hareketOzet.rows[0]
    });
  } catch (error) {
    console.error('Proje özet hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projeler/:id/tam-ozet
 * Proje TAM özet - TÜM modüllerden veriler
 * Bu endpoint tüm sistemdeki proje ilişkili verileri toplar
 */
router.get('/:id/tam-ozet', async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const yil = now.getFullYear();
    const ay = now.getMonth() + 1;
    
    // 1. Proje temel bilgileri
    const projeResult = await query(`
      SELECT * FROM projeler WHERE id = $1
    `, [id]);
    
    if (projeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    const proje = projeResult.rows[0];
    
    // 2. Personel özeti
    const personelResult = await query(`
      SELECT 
        COUNT(*) as aktif_sayisi,
        COALESCE(SUM(per.maas), 0) as toplam_net_maas,
        COALESCE(SUM(COALESCE(per.bordro_maas, per.maas)), 0) as toplam_bordro_maas
      FROM proje_personelleri pp
      JOIN personeller per ON per.id = pp.personel_id
      WHERE pp.proje_id = $1 AND pp.aktif = TRUE
    `, [id]);
    
    // Elden fark hesapla
    const eldenFarkResult = await query(`
      SELECT 
        COALESCE(SUM(GREATEST(per.maas - COALESCE(per.bordro_maas, per.maas), 0)), 0) as toplam_elden_fark
      FROM proje_personelleri pp
      JOIN personeller per ON per.id = pp.personel_id
      WHERE pp.proje_id = $1 AND pp.aktif = TRUE
    `, [id]);
    
    // 3. Bordro özeti (bu ay)
    const bordroResult = await query(`
      SELECT 
        COALESCE(SUM(toplam_gider), 0) as bu_ay_tahakkuk,
        COALESCE(SUM(odenecek_net_ucret), 0) as net_ucretler,
        COALESCE(SUM(toplam_gider - odenecek_net_ucret), 0) as sgk_vergi_toplam
      FROM bordro_tahakkuk
      WHERE proje_id = $1 AND yil = $2 AND ay = $3
    `, [id, yil, ay]);
    
    // Bordro ödeme durumu
    const bordroOdemeResult = await query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(CASE WHEN banka_odendi = TRUE THEN 1 END) as banka_odenen,
        COUNT(CASE WHEN elden_odendi = TRUE THEN 1 END) as elden_odenen,
        COALESCE(SUM(CASE WHEN banka_odendi THEN bordro_maas ELSE 0 END), 0) as odenen_banka,
        COALESCE(SUM(CASE WHEN elden_odendi THEN elden_fark ELSE 0 END), 0) as odenen_elden
      FROM maas_odemeleri
      WHERE proje_id = $1 AND yil = $2 AND ay = $3
    `, [id, yil, ay]);
    
    // Proje aylik ödemeler (SGK/Vergi durumu)
    const aylikOdemeResult = await query(`
      SELECT * FROM proje_aylik_odemeler
      WHERE proje_id = $1 AND yil = $2 AND ay = $3
    `, [id, yil, ay]);
    const aylikOdeme = aylikOdemeResult.rows[0] || { sgk_odendi: false, vergi_odendi: false };
    
    // 4. Satın alma özeti
    const satinAlmaResult = await query(`
      SELECT 
        COUNT(*) as toplam_siparis,
        COUNT(CASE WHEN durum NOT IN ('teslim_alindi', 'iptal') THEN 1 END) as bekleyen,
        COUNT(CASE WHEN durum = 'teslim_alindi' THEN 1 END) as tamamlanan,
        COALESCE(SUM(CASE WHEN durum = 'teslim_alindi' THEN toplam_tutar ELSE 0 END), 0) as toplam_harcama
      FROM siparisler
      WHERE proje_id = $1
    `, [id]);
    
    // 5. Finans özeti (bu ay)
    const finansResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tip = 'gelir' THEN tutar ELSE 0 END), 0) as bu_ay_gelir,
        COALESCE(SUM(CASE WHEN tip = 'gider' THEN tutar ELSE 0 END), 0) as bu_ay_gider,
        COALESCE(SUM(CASE WHEN tip = 'gider' AND odendi = TRUE THEN tutar ELSE 0 END), 0) as odenen_gider
      FROM proje_hareketler
      WHERE proje_id = $1 
        AND EXTRACT(YEAR FROM tarih) = $2 
        AND EXTRACT(MONTH FROM tarih) = $3
    `, [id, yil, ay]);
    
    // 6. Toplam finans (tüm zamanlar)
    const toplamFinansResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tip = 'gelir' THEN tutar ELSE 0 END), 0) as toplam_gelir,
        COALESCE(SUM(CASE WHEN tip = 'gider' THEN tutar ELSE 0 END), 0) as toplam_gider
      FROM proje_hareketler
      WHERE proje_id = $1
    `, [id]);
    
    // 7. Faturalar (gelecek - şimdilik boş)
    const faturalar = {
      alis_toplam: 0,
      satis_toplam: 0,
      bekleyen: 0,
      not: 'Proje bazlı fatura takibi henüz aktif değil'
    };
    
    // 8. Demirbaş (gelecek - şimdilik boş)
    const demirbas = {
      toplam_adet: 0,
      toplam_deger: 0,
      not: 'Proje bazlı demirbaş takibi henüz aktif değil'
    };
    
    // 9. Çek/Senet (gelecek - şimdilik boş)
    const cekSenet = {
      toplam_cek: 0,
      toplam_senet: 0,
      bekleyen_tutar: 0,
      not: 'Proje bazlı çek/senet takibi henüz aktif değil'
    };
    
    // Response
    res.json({
      proje,
      
      personel: {
        aktif_sayisi: parseInt(personelResult.rows[0].aktif_sayisi) || 0,
        toplam_net_maas: parseFloat(personelResult.rows[0].toplam_net_maas) || 0,
        toplam_bordro_maas: parseFloat(personelResult.rows[0].toplam_bordro_maas) || 0,
        toplam_elden_fark: parseFloat(eldenFarkResult.rows[0].toplam_elden_fark) || 0
      },
      
      bordro: {
        yil,
        ay,
        bu_ay_tahakkuk: parseFloat(bordroResult.rows[0].bu_ay_tahakkuk) || 0,
        net_ucretler: parseFloat(bordroResult.rows[0].net_ucretler) || 0,
        sgk_vergi_toplam: parseFloat(bordroResult.rows[0].sgk_vergi_toplam) || 0,
        odeme_durumu: {
          toplam_personel: parseInt(bordroOdemeResult.rows[0].toplam) || 0,
          banka_odenen: parseInt(bordroOdemeResult.rows[0].banka_odenen) || 0,
          elden_odenen: parseInt(bordroOdemeResult.rows[0].elden_odenen) || 0,
          odenen_banka: parseFloat(bordroOdemeResult.rows[0].odenen_banka) || 0,
          odenen_elden: parseFloat(bordroOdemeResult.rows[0].odenen_elden) || 0
        },
        sgk_odendi: aylikOdeme.sgk_odendi || false,
        vergi_odendi: aylikOdeme.vergi_odendi || false
      },
      
      satin_alma: {
        toplam_siparis: parseInt(satinAlmaResult.rows[0].toplam_siparis) || 0,
        bekleyen: parseInt(satinAlmaResult.rows[0].bekleyen) || 0,
        tamamlanan: parseInt(satinAlmaResult.rows[0].tamamlanan) || 0,
        toplam_harcama: parseFloat(satinAlmaResult.rows[0].toplam_harcama) || 0
      },
      
      finans: {
        bu_ay: {
          gelir: parseFloat(finansResult.rows[0].bu_ay_gelir) || 0,
          gider: parseFloat(finansResult.rows[0].bu_ay_gider) || 0,
          net: (parseFloat(finansResult.rows[0].bu_ay_gelir) || 0) - (parseFloat(finansResult.rows[0].bu_ay_gider) || 0),
          odenen_gider: parseFloat(finansResult.rows[0].odenen_gider) || 0
        },
        toplam: {
          gelir: parseFloat(toplamFinansResult.rows[0].toplam_gelir) || 0,
          gider: parseFloat(toplamFinansResult.rows[0].toplam_gider) || 0,
          net: (parseFloat(toplamFinansResult.rows[0].toplam_gelir) || 0) - (parseFloat(toplamFinansResult.rows[0].toplam_gider) || 0)
        }
      },
      
      faturalar,
      demirbas,
      cek_senet: cekSenet,
      
      _meta: {
        tarih: now.toISOString(),
        yil,
        ay
      }
    });
  } catch (error) {
    console.error('Proje tam özet hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projeler/genel-ozet
 * TÜM projelerin genel özeti - Dashboard için
 */
router.get('/stats/genel-ozet', async (req, res) => {
  try {
    const now = new Date();
    const yil = now.getFullYear();
    const ay = now.getMonth() + 1;
    
    // Proje sayıları
    const projeSayilari = await query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(CASE WHEN durum = 'aktif' AND aktif = TRUE THEN 1 END) as aktif,
        COUNT(CASE WHEN durum = 'tamamlandi' THEN 1 END) as tamamlanan,
        COUNT(CASE WHEN durum = 'beklemede' THEN 1 END) as bekleyen
      FROM projeler
    `);
    
    // Toplam personel
    const personelResult = await query(`
      SELECT 
        COUNT(DISTINCT pp.personel_id) as toplam_personel,
        COALESCE(SUM(per.maas), 0) as toplam_maas_yukü,
        COALESCE(SUM(COALESCE(per.bordro_maas, per.maas)), 0) as toplam_bordro_yukü
      FROM proje_personelleri pp
      JOIN personeller per ON per.id = pp.personel_id
      JOIN projeler p ON p.id = pp.proje_id
      WHERE pp.aktif = TRUE AND p.aktif = TRUE AND p.durum = 'aktif'
    `);
    
    // Bu ay tahakkuk toplamı
    const bordroResult = await query(`
      SELECT 
        COALESCE(SUM(t.toplam_gider), 0) as bu_ay_tahakkuk,
        COALESCE(SUM(t.odenecek_net_ucret), 0) as bu_ay_net
      FROM bordro_tahakkuk t
      JOIN projeler p ON p.id = t.proje_id
      WHERE t.yil = $1 AND t.ay = $2 AND p.aktif = TRUE
    `, [yil, ay]);
    
    // Satın alma özeti
    const satinAlmaResult = await query(`
      SELECT 
        COUNT(*) as toplam_siparis,
        COUNT(CASE WHEN s.durum NOT IN ('teslim_alindi', 'iptal') THEN 1 END) as bekleyen,
        COALESCE(SUM(CASE WHEN s.durum = 'teslim_alindi' THEN s.toplam_tutar ELSE 0 END), 0) as toplam_harcama
      FROM siparisler s
      JOIN projeler p ON p.id = s.proje_id
      WHERE p.aktif = TRUE AND p.durum = 'aktif'
    `);
    
    // Bu ay gelir/gider
    const finansResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tip = 'gelir' THEN tutar ELSE 0 END), 0) as bu_ay_gelir,
        COALESCE(SUM(CASE WHEN tip = 'gider' THEN tutar ELSE 0 END), 0) as bu_ay_gider
      FROM proje_hareketler
      WHERE EXTRACT(YEAR FROM tarih) = $1 AND EXTRACT(MONTH FROM tarih) = $2
    `, [yil, ay]);
    
    // Proje bazlı özet (en aktif 5 proje)
    const enAktifProjeler = await query(`
      SELECT 
        p.id, p.ad, p.kod, p.renk,
        COALESCE((SELECT COUNT(*) FROM proje_personelleri pp WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as personel,
        COALESCE((SELECT SUM(per.maas) FROM proje_personelleri pp 
                  JOIN personeller per ON per.id = pp.personel_id 
                  WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as maas_yuku
      FROM projeler p
      WHERE p.aktif = TRUE AND p.durum = 'aktif'
      ORDER BY personel DESC, maas_yuku DESC
      LIMIT 5
    `);
    
    res.json({
      projeler: {
        toplam: parseInt(projeSayilari.rows[0].toplam) || 0,
        aktif: parseInt(projeSayilari.rows[0].aktif) || 0,
        tamamlanan: parseInt(projeSayilari.rows[0].tamamlanan) || 0,
        bekleyen: parseInt(projeSayilari.rows[0].bekleyen) || 0
      },
      
      personel: {
        toplam: parseInt(personelResult.rows[0].toplam_personel) || 0,
        maas_yuku: parseFloat(personelResult.rows[0].toplam_maas_yukü) || 0,
        bordro_yuku: parseFloat(personelResult.rows[0].toplam_bordro_yukü) || 0
      },
      
      bordro: {
        yil,
        ay,
        tahakkuk: parseFloat(bordroResult.rows[0].bu_ay_tahakkuk) || 0,
        net: parseFloat(bordroResult.rows[0].bu_ay_net) || 0
      },
      
      satin_alma: {
        toplam_siparis: parseInt(satinAlmaResult.rows[0].toplam_siparis) || 0,
        bekleyen: parseInt(satinAlmaResult.rows[0].bekleyen) || 0,
        harcama: parseFloat(satinAlmaResult.rows[0].toplam_harcama) || 0
      },
      
      finans: {
        bu_ay_gelir: parseFloat(finansResult.rows[0].bu_ay_gelir) || 0,
        bu_ay_gider: parseFloat(finansResult.rows[0].bu_ay_gider) || 0,
        bu_ay_net: (parseFloat(finansResult.rows[0].bu_ay_gelir) || 0) - (parseFloat(finansResult.rows[0].bu_ay_gider) || 0)
      },
      
      en_aktif_projeler: enAktifProjeler.rows.map(p => ({
        id: p.id,
        ad: p.ad,
        kod: p.kod,
        renk: p.renk,
        personel: parseInt(p.personel) || 0,
        maas_yuku: parseFloat(p.maas_yuku) || 0
      })),
      
      _meta: {
        tarih: new Date().toISOString(),
        yil,
        ay
      }
    });
  } catch (error) {
    console.error('Genel özet hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PERSONEL ATAMA İŞLEMLERİ
// =====================================================

/**
 * POST /api/projeler/:id/personeller
 * Tek personel atama
 */
router.post('/:id/personeller', async (req, res) => {
  try {
    const { id } = req.params;
    const { personel_id, gorev, baslangic_tarihi, bitis_tarihi, notlar } = req.body;
    
    if (!personel_id) {
      return res.status(400).json({ error: 'Personel ID zorunludur' });
    }
    
    // Mevcut aktif atamayı kontrol et
    const existing = await query(`
      SELECT id FROM proje_personelleri 
      WHERE proje_id = $1 AND personel_id = $2 AND aktif = TRUE
    `, [id, personel_id]);
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Bu personel zaten bu projede görevli' });
    }
    
    const result = await query(`
      INSERT INTO proje_personelleri (proje_id, personel_id, gorev, baslangic_tarihi, bitis_tarihi, notlar)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, personel_id, gorev || null, baslangic_tarihi || new Date().toISOString().split('T')[0], bitis_tarihi || null, notlar || null]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Personel atama hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projeler/:id/personeller/bulk
 * Toplu personel atama
 */
router.post('/:id/personeller/bulk', async (req, res) => {
  try {
    const { id } = req.params;
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
        `, [id, personel_id]);
        
        if (existing.rows.length > 0) {
          errors.push({ personel_id, error: 'Zaten atanmış' });
          continue;
        }
        
        const result = await query(`
          INSERT INTO proje_personelleri (proje_id, personel_id, gorev, baslangic_tarihi)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [id, personel_id, gorev || null, baslangic_tarihi || new Date().toISOString().split('T')[0]]);
        
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

/**
 * PUT /api/projeler/personel-atama/:atamaId
 * Personel ataması güncelle
 */
router.put('/personel-atama/:atamaId', async (req, res) => {
  try {
    const { atamaId } = req.params;
    const { gorev, baslangic_tarihi, bitis_tarihi, notlar, aktif } = req.body;
    
    const result = await query(`
      UPDATE proje_personelleri SET
        gorev = COALESCE($2, gorev),
        baslangic_tarihi = COALESCE($3, baslangic_tarihi),
        bitis_tarihi = $4,
        notlar = COALESCE($5, notlar),
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

/**
 * DELETE /api/projeler/personel-atama/:atamaId
 * Personeli projeden çıkar (soft delete)
 */
router.delete('/personel-atama/:atamaId', async (req, res) => {
  try {
    const { atamaId } = req.params;
    
    // Soft delete - aktif = false yap
    const result = await query(`
      UPDATE proje_personelleri SET 
        aktif = FALSE, 
        bitis_tarihi = CURRENT_DATE, 
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [atamaId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Atama bulunamadı' });
    }
    
    res.json({ success: true, deactivated: result.rows[0] });
  } catch (error) {
    console.error('Personel çıkarma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// RAPORLAR
// =====================================================

/**
 * GET /api/projeler/raporlar/harcama-ozeti
 * Proje bazlı harcama raporu
 */
router.get('/raporlar/harcama-ozeti', async (req, res) => {
  try {
    const { baslangic, bitis } = req.query;
    
    let sql = `
      SELECT 
        p.id,
        p.kod,
        p.ad,
        p.renk,
        p.durum,
        COUNT(s.id) as siparis_sayisi,
        COALESCE(SUM(s.toplam_tutar), 0) as toplam_harcama,
        COALESCE((SELECT COUNT(*) FROM proje_personelleri pp WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as personel_sayisi,
        COALESCE((SELECT SUM(per.maas) FROM proje_personelleri pp 
                  JOIN personeller per ON per.id = pp.personel_id 
                  WHERE pp.proje_id = p.id AND pp.aktif = TRUE), 0) as toplam_maas
      FROM projeler p
      LEFT JOIN siparisler s ON p.id = s.proje_id AND s.durum = 'teslim_alindi'
    `;
    
    const params = [];
    if (baslangic && bitis) {
      sql += ` WHERE s.siparis_tarihi BETWEEN $1 AND $2`;
      params.push(baslangic, bitis);
    }
    
    sql += ` GROUP BY p.id ORDER BY toplam_harcama DESC`;
    
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Proje raporu hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projeler/raporlar/maliyet-analizi
 * Proje maliyet analizi (personel + satın alma + giderler)
 */
router.get('/raporlar/maliyet-analizi', async (req, res) => {
  try {
    const { yil, ay } = req.query;
    const targetYil = yil || new Date().getFullYear();
    const targetAy = ay || new Date().getMonth() + 1;
    
    const result = await query(`
      SELECT 
        p.id,
        p.kod,
        p.ad,
        p.renk,
        -- Personel maliyeti
        COALESCE((
          SELECT SUM(per.maas) 
          FROM proje_personelleri pp 
          JOIN personeller per ON per.id = pp.personel_id 
          WHERE pp.proje_id = p.id AND pp.aktif = TRUE
        ), 0) as personel_maliyeti,
        -- Bordro tahakkuk
        COALESCE((
          SELECT toplam_gider 
          FROM bordro_tahakkuk 
          WHERE proje_id = p.id AND yil = $1 AND ay = $2
        ), 0) as bordro_maliyeti,
        -- Satın alma maliyeti
        COALESCE((
          SELECT SUM(toplam_tutar) 
          FROM siparisler 
          WHERE proje_id = p.id AND durum = 'teslim_alindi'
            AND EXTRACT(YEAR FROM siparis_tarihi) = $1 
            AND EXTRACT(MONTH FROM siparis_tarihi) = $2
        ), 0) as satin_alma_maliyeti,
        -- Diğer giderler
        COALESCE((
          SELECT SUM(tutar) 
          FROM proje_hareketler 
          WHERE proje_id = p.id AND tip = 'gider'
            AND EXTRACT(YEAR FROM tarih) = $1 
            AND EXTRACT(MONTH FROM tarih) = $2
        ), 0) as diger_giderler
      FROM projeler p
      WHERE p.aktif = TRUE
      ORDER BY p.ad
    `, [targetYil, targetAy]);
    
    // Toplam hesapla
    const toplam = result.rows.reduce((acc, row) => ({
      personel: acc.personel + parseFloat(row.personel_maliyeti || 0),
      bordro: acc.bordro + parseFloat(row.bordro_maliyeti || 0),
      satin_alma: acc.satin_alma + parseFloat(row.satin_alma_maliyeti || 0),
      diger: acc.diger + parseFloat(row.diger_giderler || 0),
    }), { personel: 0, bordro: 0, satin_alma: 0, diger: 0 });
    
    res.json({ 
      success: true, 
      yil: parseInt(targetYil),
      ay: parseInt(targetAy),
      projeler: result.rows.map(r => ({
        ...r,
        toplam_maliyet: parseFloat(r.personel_maliyeti || 0) + 
                        parseFloat(r.satin_alma_maliyeti || 0) + 
                        parseFloat(r.diger_giderler || 0)
      })),
      toplam: {
        ...toplam,
        genel: toplam.personel + toplam.satin_alma + toplam.diger
      }
    });
  } catch (error) {
    console.error('Maliyet analizi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projeler/:id/atamasiz-personeller
 * Projeye atanmamış personelleri listele
 */
router.get('/:id/atamasiz-personeller', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT p.* 
      FROM personeller p
      WHERE p.id NOT IN (
        SELECT personel_id FROM proje_personelleri 
        WHERE proje_id = $1 AND aktif = TRUE
      )
      AND (p.durum = 'aktif' OR (p.durum IS NULL AND p.isten_cikis_tarihi IS NULL))
      ORDER BY p.ad, p.soyad
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Atamasız personeller hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PROJE YETKİLİLERİ API
// =====================================================

/**
 * GET /api/projeler/:id/yetkililer
 * Proje yetkililerini listele
 */
router.get('/:id/yetkililer', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT * FROM proje_yetkilileri 
      WHERE proje_id = $1 AND aktif = TRUE
      ORDER BY yetki_turu, ad_soyad
    `, [id]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Proje yetkilileri hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/projeler/:id/yetkililer
 * Proje yetkilisi ekle
 */
router.post('/:id/yetkililer', async (req, res) => {
  try {
    const { id } = req.params;
    const { ad_soyad, unvan, telefon, email, yetki_turu, notlar } = req.body;
    
    if (!ad_soyad) {
      return res.status(400).json({ success: false, error: 'Ad soyad zorunludur' });
    }
    
    const result = await query(`
      INSERT INTO proje_yetkilileri (proje_id, ad_soyad, unvan, telefon, email, yetki_turu, notlar)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [id, ad_soyad, unvan, telefon, email, yetki_turu || 'standart', notlar]);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Yetkili ekle hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/projeler/:projeId/yetkililer/:yetkiliId
 * Proje yetkilisi güncelle
 */
router.put('/:projeId/yetkililer/:yetkiliId', async (req, res) => {
  try {
    const { projeId, yetkiliId } = req.params;
    const { ad_soyad, unvan, telefon, email, yetki_turu, notlar, aktif } = req.body;
    
    const result = await query(`
      UPDATE proje_yetkilileri SET
        ad_soyad = COALESCE($1, ad_soyad),
        unvan = $2,
        telefon = $3,
        email = $4,
        yetki_turu = COALESCE($5, yetki_turu),
        notlar = $6,
        aktif = COALESCE($7, aktif),
        updated_at = NOW()
      WHERE id = $8 AND proje_id = $9
      RETURNING *
    `, [ad_soyad, unvan, telefon, email, yetki_turu, notlar, aktif, yetkiliId, projeId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Yetkili bulunamadı' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Yetkili güncelle hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/projeler/:projeId/yetkililer/:yetkiliId
 * Proje yetkilisi sil
 */
router.delete('/:projeId/yetkililer/:yetkiliId', async (req, res) => {
  try {
    const { projeId, yetkiliId } = req.params;
    
    const result = await query(
      'DELETE FROM proje_yetkilileri WHERE id = $1 AND proje_id = $2 RETURNING *',
      [yetkiliId, projeId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Yetkili bulunamadı' });
    }
    
    res.json({ success: true, message: 'Yetkili silindi' });
  } catch (error) {
    console.error('Yetkili sil hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PROJE DÖKÜMANLARI API
// =====================================================

/**
 * GET /api/projeler/:id/dokumanlar
 * Proje dökümanlarını listele
 */
router.get('/:id/dokumanlar', async (req, res) => {
  try {
    const { id } = req.params;
    const { kategori } = req.query;
    
    let sql = `
      SELECT * FROM proje_dokumanlari 
      WHERE proje_id = $1 AND aktif = TRUE
    `;
    const params = [id];
    
    if (kategori) {
      sql += ' AND kategori = $2';
      params.push(kategori);
    }
    
    sql += ' ORDER BY kategori, yuklenme_tarihi DESC';
    
    const result = await query(sql, params);
    
    // Kategorilere göre grupla
    const kategoriler = {};
    result.rows.forEach(doc => {
      if (!kategoriler[doc.kategori]) {
        kategoriler[doc.kategori] = [];
      }
      kategoriler[doc.kategori].push(doc);
    });
    
    res.json({ 
      success: true, 
      data: result.rows,
      kategoriler 
    });
  } catch (error) {
    console.error('Proje dökümanları hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/projeler/:id/dokumanlar
 * Proje dökümanı ekle
 */
router.post('/:id/dokumanlar', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      dosya_adi, dosya_url, kategori, alt_kategori, 
      aciklama, dosya_boyutu, mime_type, gecerlilik_tarihi 
    } = req.body;
    
    if (!dosya_adi || !dosya_url || !kategori) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dosya adı, URL ve kategori zorunludur' 
      });
    }
    
    const result = await query(`
      INSERT INTO proje_dokumanlari (
        proje_id, dosya_adi, dosya_url, kategori, alt_kategori,
        aciklama, dosya_boyutu, mime_type, gecerlilik_tarihi
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [id, dosya_adi, dosya_url, kategori, alt_kategori, aciklama, dosya_boyutu, mime_type, gecerlilik_tarihi]);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Döküman ekle hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/projeler/:projeId/dokumanlar/:dokumanId
 * Proje dökümanı sil
 */
router.delete('/:projeId/dokumanlar/:dokumanId', async (req, res) => {
  try {
    const { projeId, dokumanId } = req.params;
    
    const result = await query(
      'DELETE FROM proje_dokumanlari WHERE id = $1 AND proje_id = $2 RETURNING *',
      [dokumanId, projeId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı' });
    }
    
    res.json({ success: true, message: 'Döküman silindi' });
  } catch (error) {
    console.error('Döküman sil hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

