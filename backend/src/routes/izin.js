import express from 'express';
import { query } from '../database.js';

const router = express.Router();

// =====================================================
// İZİN TÜRLERİ
// =====================================================

// Tüm izin türlerini listele
router.get('/turler', async (_req, res) => {
  try {
    const result = await query(`
      SELECT * FROM izin_turleri WHERE aktif = TRUE ORDER BY ad
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// İZİN TALEPLERİ
// =====================================================

// Tüm izin taleplerini listele
router.get('/talepler', async (req, res) => {
  try {
    const { durum, personel_id, yil, ay } = req.query;

    let sql = `
      SELECT 
        it.*,
        p.ad as personel_ad,
        p.soyad as personel_soyad,
        p.departman,
        itur.ad as izin_turu_ad,
        itur.kod as izin_turu_kod,
        itur.renk as izin_renk,
        itur.ucretli,
        onay.ad as onaylayan_ad,
        onay.soyad as onaylayan_soyad
      FROM izin_talepleri it
      JOIN personeller p ON p.id = it.personel_id
      JOIN izin_turleri itur ON itur.id = it.izin_turu_id
      LEFT JOIN personeller onay ON onay.id = it.onaylayan_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (durum) {
      sql += ` AND it.durum = $${paramIndex}`;
      params.push(durum);
      paramIndex++;
    }
    if (personel_id) {
      sql += ` AND it.personel_id = $${paramIndex}`;
      params.push(personel_id);
      paramIndex++;
    }
    if (yil) {
      sql += ` AND EXTRACT(YEAR FROM it.baslangic_tarihi) = $${paramIndex}`;
      params.push(yil);
      paramIndex++;
    }
    if (ay) {
      sql += ` AND EXTRACT(MONTH FROM it.baslangic_tarihi) = $${paramIndex}`;
      params.push(ay);
      paramIndex++;
    }

    sql += ` ORDER BY it.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni izin talebi oluştur
router.post('/talepler', async (req, res) => {
  try {
    const {
      personel_id,
      izin_turu_id,
      baslangic_tarihi,
      bitis_tarihi,
      yarim_gun,
      yarim_gun_tipi,
      aciklama,
      belge_url,
    } = req.body;

    if (!personel_id || !izin_turu_id || !baslangic_tarihi || !bitis_tarihi) {
      return res.status(400).json({ success: false, error: 'Personel, izin türü, başlangıç ve bitiş tarihi zorunludur' });
    }

    // Çakışma kontrolü
    const cakismaKontrol = await query(
      `
      SELECT id FROM izin_talepleri 
      WHERE personel_id = $1 
      AND durum IN ('beklemede', 'onaylandi')
      AND (
        (baslangic_tarihi <= $2 AND bitis_tarihi >= $2) OR
        (baslangic_tarihi <= $3 AND bitis_tarihi >= $3) OR
        (baslangic_tarihi >= $2 AND bitis_tarihi <= $3)
      )
    `,
      [personel_id, baslangic_tarihi, bitis_tarihi]
    );

    if (cakismaKontrol.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Bu tarih aralığında zaten bir izin talebi mevcut' });
    }

    const result = await query(
      `
      INSERT INTO izin_talepleri (
        personel_id, izin_turu_id, baslangic_tarihi, bitis_tarihi,
        yarim_gun, yarim_gun_tipi, aciklama, belge_url, gun_sayisi
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $4::date - $3::date + 1)
      RETURNING *
    `,
      [
        personel_id,
        izin_turu_id,
        baslangic_tarihi,
        bitis_tarihi,
        yarim_gun || false,
        yarim_gun_tipi,
        aciklama,
        belge_url,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// İzin talebini onayla/reddet
router.patch('/talepler/:id/durum', async (req, res) => {
  try {
    const { id } = req.params;
    const { durum, onaylayan_id, red_nedeni } = req.body;

    if (!['onaylandi', 'reddedildi', 'iptal'].includes(durum)) {
      return res.status(400).json({ success: false, error: 'Geçersiz durum' });
    }

    const result = await query(
      `
      UPDATE izin_talepleri SET
        durum = $2,
        onaylayan_id = $3,
        onay_tarihi = CASE WHEN $2 IN ('onaylandi', 'reddedildi') THEN NOW() ELSE onay_tarihi END,
        red_nedeni = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
      [id, durum, onaylayan_id, red_nedeni]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'İzin talebi bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// İzin talebini sil
router.delete('/talepler/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      DELETE FROM izin_talepleri WHERE id = $1 AND durum = 'beklemede' RETURNING *
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Sadece bekleyen talepler silinebilir' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PERSONEL İZİN ÖZETİ
// =====================================================

router.get('/personel/:id/ozet', async (req, res) => {
  try {
    const { id } = req.params;
    const yil = new Date().getFullYear();

    // Personel bilgisi ve kıdem
    const personelResult = await query(
      `
      SELECT 
        id, ad, soyad, ise_giris_tarihi, maas,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, ise_giris_tarihi)) as kidem_yil,
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, ise_giris_tarihi)) as kidem_ay,
        AGE(CURRENT_DATE, ise_giris_tarihi) as calisma_suresi
      FROM personeller WHERE id = $1
    `,
      [id]
    );

    if (personelResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Personel bulunamadı' });
    }

    const personel = personelResult.rows[0];
    const kidemYil = parseInt(personel.kidem_yil, 10) || 0;

    // Yıllık izin hakkı
    const hakResult = await query(
      `
      SELECT izin_gunu FROM yillik_izin_haklari
      WHERE $1 >= min_kidem_yil AND ($1 < max_kidem_yil OR max_kidem_yil IS NULL)
      LIMIT 1
    `,
      [kidemYil]
    );

    const yillikIzinHakki = hakResult.rows[0]?.izin_gunu || 14;

    // Bu yıl kullanılan izinler (türe göre)
    const kullanilanResult = await query(
      `
      SELECT 
        itur.kod,
        itur.ad,
        SUM(it.gun_sayisi) as kullanilan
      FROM izin_talepleri it
      JOIN izin_turleri itur ON itur.id = it.izin_turu_id
      WHERE it.personel_id = $1 
      AND it.durum = 'onaylandi'
      AND EXTRACT(YEAR FROM it.baslangic_tarihi) = $2
      GROUP BY itur.kod, itur.ad
    `,
      [id, yil]
    );

    // Bekleyen talepler
    const bekleyenResult = await query(
      `
      SELECT COUNT(*) as sayi FROM izin_talepleri
      WHERE personel_id = $1 AND durum = 'beklemede'
    `,
      [id]
    );

    // Toplam kullanılan yıllık izin
    const yillikKullanilan = kullanilanResult.rows.find((r) => r.kod === 'yillik')?.kullanilan || 0;

    res.json({
      personel: {
        id: personel.id,
        ad: personel.ad,
        soyad: personel.soyad,
        ise_giris_tarihi: personel.ise_giris_tarihi,
        maas: personel.maas,
      },
      kidem: {
        yil: kidemYil,
        ay: parseInt(personel.kidem_ay, 10) || 0,
        toplam_gun: Math.floor((Date.now() - new Date(personel.ise_giris_tarihi)) / (1000 * 60 * 60 * 24)),
      },
      izin: {
        yillik_hak: yillikIzinHakki,
        yillik_kullanilan: parseInt(yillikKullanilan, 10) || 0,
        yillik_kalan: yillikIzinHakki - (parseInt(yillikKullanilan, 10) || 0),
        kullanim_detay: kullanilanResult.rows,
        bekleyen_talep: parseInt(bekleyenResult.rows[0].sayi, 10) || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// KIDEM VE İHBAR TAZMİNATI HESAPLAMA
// =====================================================

router.post('/kidem-hesapla', async (req, res) => {
  try {
    const { personel_id, cikis_tarihi, cikis_nedeni } = req.body;

    if (!personel_id) {
      return res.status(400).json({ success: false, error: 'Personel ID zorunludur' });
    }

    const cikisTarihi = cikis_tarihi ? new Date(cikis_tarihi) : new Date();

    // Personel bilgisi
    const personelResult = await query(
      `
      SELECT * FROM personeller WHERE id = $1
    `,
      [personel_id]
    );

    if (personelResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Personel bulunamadı' });
    }

    const personel = personelResult.rows[0];
    const iseGiris = new Date(personel.ise_giris_tarihi);

    // Toplam çalışma günü ve yılı
    const toplamGun = Math.floor((cikisTarihi - iseGiris) / (1000 * 60 * 60 * 24));
    const toplamYil = toplamGun / 365;

    // Brüt maaş (Net'ten hesapla)
    const brutMaas = personel.maas * 1.4; // Yaklaşık

    // Kıdem tazminatı tavanı
    const ay = cikisTarihi.getMonth() + 1;
    const donem = ay <= 6 ? 1 : 2;
    const tavanResult = await query(
      `
      SELECT tavan_tutar FROM kidem_tazminati_tavan
      WHERE yil = $1 AND donem = $2
    `,
      [cikisTarihi.getFullYear(), donem]
    );

    const kidemTavani = tavanResult.rows[0]?.tavan_tutar || 45000;

    // Kıdem tazminatı hesabı (her yıl için 30 günlük brüt, tavandan fazla olamaz)
    const kidemMatrahi = Math.min(brutMaas, kidemTavani);
    const kidemTazminati = Math.round(kidemMatrahi * toplamYil * 100) / 100;

    // İhbar süresi (gün cinsinden)
    let ihbarGun = 0;
    if (toplamGun < 180)
      ihbarGun = 14; // 0-6 ay: 2 hafta
    else if (toplamGun < 540)
      ihbarGun = 28; // 6-18 ay: 4 hafta
    else if (toplamGun < 1080)
      ihbarGun = 42; // 18-36 ay: 6 hafta
    else ihbarGun = 56; // 36+ ay: 8 hafta

    // İhbar tazminatı
    const gunlukBrut = brutMaas / 30;
    const ihbarTazminati = Math.round(gunlukBrut * ihbarGun * 100) / 100;

    // Kullanılmamış izin
    const yil = cikisTarihi.getFullYear();
    const izinResult = await query(
      `
      SELECT 
        COALESCE(
          (SELECT izin_gunu FROM yillik_izin_haklari
           WHERE $1 >= min_kidem_yil AND ($1 < max_kidem_yil OR max_kidem_yil IS NULL)
           LIMIT 1), 14
        ) as hak,
        COALESCE(
          (SELECT SUM(gun_sayisi) FROM izin_talepleri it
           JOIN izin_turleri itur ON itur.id = it.izin_turu_id
           WHERE it.personel_id = $2 AND itur.kod = 'yillik' AND it.durum = 'onaylandi'
           AND EXTRACT(YEAR FROM it.baslangic_tarihi) = $3), 0
        ) as kullanilan
    `,
      [Math.floor(toplamYil), personel_id, yil]
    );

    const izinHak = parseInt(izinResult.rows[0].hak, 10) || 14;
    const izinKullanilan = parseInt(izinResult.rows[0].kullanilan, 10) || 0;
    const kalanIzin = Math.max(0, izinHak - izinKullanilan);
    const izinUcreti = Math.round(gunlukBrut * kalanIzin * 100) / 100;

    // Kıdem tazminatı hakkı (1 yıldan az çalışanlarda yok, istifada yok vs.)
    const kidemHakki = toplamYil >= 1 && cikis_nedeni !== 'istifa';
    const ihbarHakki = cikis_nedeni !== 'istifa';

    const toplamTazminat = (kidemHakki ? kidemTazminati : 0) + (ihbarHakki ? ihbarTazminati : 0) + izinUcreti;

    res.json({
      personel: {
        id: personel.id,
        ad: personel.ad,
        soyad: personel.soyad,
        ise_giris: personel.ise_giris_tarihi,
        net_maas: personel.maas,
        brut_maas: Math.round(brutMaas * 100) / 100,
      },
      calisma: {
        baslangic: personel.ise_giris_tarihi,
        bitis: cikis_tarihi || new Date().toISOString().split('T')[0],
        toplam_gun: toplamGun,
        toplam_yil: Math.round(toplamYil * 100) / 100,
      },
      kidem: {
        hakki_var: kidemHakki,
        tavan: kidemTavani,
        matrah: kidemMatrahi,
        tazminat: kidemHakki ? kidemTazminati : 0,
      },
      ihbar: {
        hakki_var: ihbarHakki,
        sure_gun: ihbarGun,
        sure_hafta: ihbarGun / 7,
        tazminat: ihbarHakki ? ihbarTazminati : 0,
      },
      izin: {
        yillik_hak: izinHak,
        kullanilan: izinKullanilan,
        kalan: kalanIzin,
        ucret: izinUcreti,
      },
      toplam_tazminat: Math.round(toplamTazminat * 100) / 100,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// İSTATİSTİKLER
// =====================================================

router.get('/stats', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        (SELECT COUNT(*) FROM izin_talepleri WHERE durum = 'beklemede') as bekleyen,
        (SELECT COUNT(*) FROM izin_talepleri WHERE durum = 'onaylandi' 
         AND CURRENT_DATE BETWEEN baslangic_tarihi AND bitis_tarihi) as bugun_izinli,
        (SELECT COUNT(*) FROM izin_talepleri WHERE durum = 'onaylandi'
         AND EXTRACT(YEAR FROM baslangic_tarihi) = EXTRACT(YEAR FROM CURRENT_DATE)) as bu_yil_onaylanan,
        (SELECT SUM(gun_sayisi) FROM izin_talepleri WHERE durum = 'onaylandi'
         AND EXTRACT(YEAR FROM baslangic_tarihi) = EXTRACT(YEAR FROM CURRENT_DATE)) as bu_yil_toplam_gun
    `);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bugün izinli olanlar
router.get('/bugun-izinli', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        p.id, p.ad, p.soyad, p.departman,
        it.baslangic_tarihi, it.bitis_tarihi, it.gun_sayisi,
        itur.ad as izin_turu, itur.renk
      FROM izin_talepleri it
      JOIN personeller p ON p.id = it.personel_id
      JOIN izin_turleri itur ON itur.id = it.izin_turu_id
      WHERE it.durum = 'onaylandi'
      AND CURRENT_DATE BETWEEN it.baslangic_tarihi AND it.bitis_tarihi
      ORDER BY it.bitis_tarihi
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
