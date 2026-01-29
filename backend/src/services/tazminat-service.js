/**
 * Tazminat Hesaplama Servisi
 *
 * Türkiye İş Hukuku'na göre:
 * - Kıdem Tazminatı (1475 Sayılı İş Kanunu Madde 14)
 * - İhbar Tazminatı (4857 Sayılı İş Kanunu Madde 17)
 * - Kullanılmayan İzin Ücreti (4857 Sayılı İş Kanunu Madde 59)
 */

import { query } from '../database.js';

// Çıkış sebepleri ve haklar
export const CIKIS_SEBEPLERI = {
  isveren_fesih: {
    kod: 'isveren_fesih',
    ad: 'İşveren Kaynaklı Fesih',
    kidem: true,
    ihbar: true,
    izin: true,
    aciklama: 'İşveren tarafından iş akdi feshedildiğinde tüm tazminatlar ödenir.',
    kanun: '4857 Sayılı İş Kanunu',
  },
  istifa: {
    kod: 'istifa',
    ad: 'İstifa',
    kidem: false,
    ihbar: false,
    izin: true,
    aciklama: 'İşçi kendi isteğiyle ayrılırsa sadece kullanılmayan izin ücreti ödenir.',
    kanun: '4857 Sayılı İş Kanunu Madde 17',
  },
  emeklilik: {
    kod: 'emeklilik',
    ad: 'Emeklilik',
    kidem: true,
    ihbar: false,
    izin: true,
    aciklama: "SGK'dan yaşlılık aylığı bağlanması halinde kıdem tazminatı hakkı doğar.",
    kanun: '1475 Sayılı İş Kanunu Madde 14',
  },
  evlilik: {
    kod: 'evlilik',
    ad: 'Evlilik (Kadın Çalışan)',
    kidem: true,
    ihbar: false,
    izin: true,
    aciklama: 'Kadın işçi evlendiği tarihten itibaren 1 yıl içinde ayrılırsa kıdem tazminatı alır.',
    kanun: '1475 Sayılı İş Kanunu Madde 14',
  },
  askerlik: {
    kod: 'askerlik',
    ad: 'Askerlik',
    kidem: true,
    ihbar: false,
    izin: true,
    aciklama: 'Muvazzaf askerlik nedeniyle ayrılan işçi kıdem tazminatı alır.',
    kanun: '1475 Sayılı İş Kanunu Madde 14',
  },
  hakli_fesih: {
    kod: 'hakli_fesih',
    ad: 'Haklı Fesih (İşçi Tarafından)',
    kidem: true,
    ihbar: false,
    izin: true,
    aciklama: 'Maaş gecikmesi (2+ ay), mobbing, sağlık tehlikesi gibi durumlarda işçi haklı fesih yapabilir.',
    kanun: '4857 Sayılı İş Kanunu Madde 24',
  },
  vefat: {
    kod: 'vefat',
    ad: 'Vefat',
    kidem: true,
    ihbar: false,
    izin: true,
    aciklama: 'İşçinin vefatı halinde kıdem tazminatı mirasçılara ödenir.',
    kanun: '1475 Sayılı İş Kanunu Madde 14',
  },
};

// İhbar süreleri (4857 Md. 17)
const IHBAR_SURELERI = [
  { minAy: 0, maxAy: 6, hafta: 2, gun: 14 },
  { minAy: 6, maxAy: 18, hafta: 4, gun: 28 },
  { minAy: 18, maxAy: 36, hafta: 6, gun: 42 },
  { minAy: 36, maxAy: Infinity, hafta: 8, gun: 56 },
];

// Yıllık izin hakları (4857 Md. 53)
const IZIN_HAKLARI = [
  { minYil: 1, maxYil: 5, gun: 14 },
  { minYil: 5, maxYil: 15, gun: 20 },
  { minYil: 15, maxYil: Infinity, gun: 26 },
];

// Yasal bilgiler
export const YASAL_BILGILER = {
  kidem: {
    kanun: '1475 Sayılı İş Kanunu - Madde 14',
    baslik: 'Kıdem Tazminatı',
    ozet: 'En az 1 yıl çalışan işçiye, her tam yıl için 30 günlük brüt ücret tutarında kıdem tazminatı ödenir.',
    detay: [
      'Kıdem tazminatı her tam yıl için 30 günlük brüt ücret üzerinden hesaplanır.',
      'Bir yıldan artan süreler için de orantılı hesaplama yapılır.',
      'Kıdem tazminatı tavanı her yıl 2 kez (Ocak ve Temmuz) güncellenir.',
      'Tavan aşıldığında, tavan tutarı üzerinden hesaplama yapılır.',
    ],
    link: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=1475&MevzuatTur=1&MevzuatTertip=5',
  },
  ihbar: {
    kanun: '4857 Sayılı İş Kanunu - Madde 17',
    baslik: 'İhbar Tazminatı',
    ozet: 'İş sözleşmesi feshedilmeden önce karşı tarafa bildirim yapılması gerekir. Aksi halde ihbar tazminatı ödenir.',
    detay: [
      '0-6 ay çalışanlara: 2 hafta (14 gün)',
      '6-18 ay çalışanlara: 4 hafta (28 gün)',
      '18-36 ay çalışanlara: 6 hafta (42 gün)',
      '36+ ay çalışanlara: 8 hafta (56 gün)',
    ],
    link: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4857&MevzuatTur=1&MevzuatTertip=5',
  },
  izin: {
    kanun: '4857 Sayılı İş Kanunu - Madde 59',
    baslik: 'Kullanılmayan İzin Ücreti',
    ozet: 'İş sözleşmesinin herhangi bir nedenle sona ermesinde, kullanılmayan yıllık izin süreleri ücreti ödenir.',
    detay: [
      '1-5 yıl çalışanlara: Yılda 14 gün',
      '5-15 yıl çalışanlara: Yılda 20 gün',
      '15+ yıl çalışanlara: Yılda 26 gün',
      'İzin ücreti brüt günlük ücret üzerinden hesaplanır.',
    ],
    link: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4857&MevzuatTur=1&MevzuatTertip=5',
  },
};

/**
 * Çalışma süresini hesapla
 */
function hesaplaCalismaSuresi(iseGiris, cikisTarihi) {
  const giris = new Date(iseGiris);
  const cikis = new Date(cikisTarihi);

  let yil = cikis.getFullYear() - giris.getFullYear();
  let ay = cikis.getMonth() - giris.getMonth();
  let gun = cikis.getDate() - giris.getDate();

  if (gun < 0) {
    ay--;
    const oncekiAy = new Date(cikis.getFullYear(), cikis.getMonth(), 0);
    gun += oncekiAy.getDate();
  }

  if (ay < 0) {
    yil--;
    ay += 12;
  }

  const toplamGun = Math.floor((cikis - giris) / (1000 * 60 * 60 * 24));
  const toplamAy = yil * 12 + ay;
  const toplamYil = toplamGun / 365.25;

  return {
    yil,
    ay,
    gun,
    toplamGun,
    toplamAy,
    toplamYil: Math.round(toplamYil * 100) / 100,
  };
}

/**
 * Kıdem tazminatı tavanını getir
 */
async function getKidemTavani(tarih) {
  const sql = `
    SELECT tavan_tutari 
    FROM kidem_tavan 
    WHERE $1 BETWEEN gecerlilik_baslangic AND COALESCE(gecerlilik_bitis, '2099-12-31')
    ORDER BY gecerlilik_baslangic DESC
    LIMIT 1
  `;

  const result = await query(sql, [tarih]);

  if (result.rows.length > 0) {
    return parseFloat(result.rows[0].tavan_tutari);
  }

  // Varsayılan: 2025 ilk yarı tavanı
  return 41828.42;
}

/**
 * İhbar süresini hesapla
 */
function hesaplaIhbarSuresi(toplamAy) {
  for (const sure of IHBAR_SURELERI) {
    if (toplamAy >= sure.minAy && toplamAy < sure.maxAy) {
      return { hafta: sure.hafta, gun: sure.gun };
    }
  }
  return { hafta: 8, gun: 56 };
}

/**
 * Yıllık izin hakkını hesapla
 */
function _hesaplaYillikIzinHakki(toplamYil) {
  for (const hak of IZIN_HAKLARI) {
    if (toplamYil >= hak.minYil && toplamYil < hak.maxYil) {
      return hak.gun;
    }
  }
  return 26;
}

/**
 * Tazminat hesapla (ana fonksiyon)
 */
export async function hesaplaTazminat(personelId, cikisTarihi, cikisSebebi, kalanIzinGun = null) {
  // 1. Personel bilgilerini getir
  const personelResult = await query(
    `
    SELECT id, ad, soyad, tc_kimlik, ise_giris_tarihi, maas, kalan_izin_gun, pozisyon, departman
    FROM personeller
    WHERE id = $1
  `,
    [personelId]
  );

  if (personelResult.rows.length === 0) {
    throw new Error('Personel bulunamadı');
  }

  const personel = personelResult.rows[0];
  const iseGiris = personel.ise_giris_tarihi;
  const brutMaas = parseFloat(personel.maas) || 0;
  const izinGun = kalanIzinGun !== null ? kalanIzinGun : personel.kalan_izin_gun || 0;

  if (!iseGiris) {
    throw new Error('Personelin işe giriş tarihi tanımlı değil');
  }

  // 2. Çıkış sebebi hakları
  const sebep = CIKIS_SEBEPLERI[cikisSebebi];
  if (!sebep) {
    throw new Error('Geçersiz çıkış sebebi');
  }

  // 3. Çalışma süresi
  const calisma = hesaplaCalismaSuresi(iseGiris, cikisTarihi);

  // 4. Günlük brüt
  const gunlukBrut = brutMaas / 30;

  // 5. Kıdem tazminatı tavanı
  const kidemTavani = await getKidemTavani(cikisTarihi);
  const tavanAsimi = brutMaas > kidemTavani;
  const kidemMatrahi = tavanAsimi ? kidemTavani : brutMaas;

  // 6. Kıdem Tazminatı
  let kidemTutari = 0;
  let kidemGun = 0;
  const kidemHakVar = sebep.kidem && calisma.toplamYil >= 1;

  if (kidemHakVar) {
    kidemGun = Math.round(calisma.toplamYil * 30);
    kidemTutari = calisma.toplamYil * kidemMatrahi;
  }

  // 7. İhbar Tazminatı
  let ihbarTutari = 0;
  let ihbarGun = 0;
  const ihbarHakVar = sebep.ihbar;

  if (ihbarHakVar) {
    const ihbarSuresi = hesaplaIhbarSuresi(calisma.toplamAy);
    ihbarGun = ihbarSuresi.gun;
    ihbarTutari = ihbarGun * gunlukBrut;
  }

  // 8. İzin Ücreti
  let izinTutari = 0;
  const izinHakVar = sebep.izin && izinGun > 0;

  if (izinHakVar) {
    izinTutari = izinGun * gunlukBrut;
  }

  // 9. Toplam
  const toplamTazminat = kidemTutari + ihbarTutari + izinTutari;

  // Sonuç
  return {
    personel: {
      id: personel.id,
      ad: personel.ad,
      soyad: personel.soyad,
      tam_ad: `${personel.ad} ${personel.soyad}`,
      tc_kimlik: personel.tc_kimlik,
      pozisyon: personel.pozisyon,
      departman: personel.departman,
      ise_giris_tarihi: iseGiris,
      brut_maas: brutMaas,
      kalan_izin_gun: izinGun,
    },
    cikis: {
      tarih: cikisTarihi,
      sebep: sebep,
    },
    calisma_suresi: {
      yil: calisma.yil,
      ay: calisma.ay,
      gun: calisma.gun,
      toplam_yil: calisma.toplamYil,
      toplam_ay: calisma.toplamAy,
      toplam_gun: calisma.toplamGun,
      metin: `${calisma.yil} yıl ${calisma.ay} ay ${calisma.gun} gün`,
    },
    hesaplama: {
      gunluk_brut: Math.round(gunlukBrut * 100) / 100,
      kidem_tavani: kidemTavani,
      tavan_asimi: tavanAsimi,
      kidem_matrahi: kidemMatrahi,
    },
    kidem: {
      hak_var: kidemHakVar,
      gun: kidemGun,
      tutar: Math.round(kidemTutari * 100) / 100,
      aciklama: kidemHakVar
        ? `${calisma.toplamYil} yıl × ${kidemMatrahi.toLocaleString('tr-TR')} ₺ = ${kidemTutari.toLocaleString('tr-TR')} ₺`
        : 'Kıdem tazminatı hakkı yok',
      kanun_ref: YASAL_BILGILER.kidem,
    },
    ihbar: {
      hak_var: ihbarHakVar,
      gun: ihbarGun,
      tutar: Math.round(ihbarTutari * 100) / 100,
      aciklama: ihbarHakVar
        ? `${ihbarGun} gün × ${gunlukBrut.toLocaleString('tr-TR')} ₺ = ${ihbarTutari.toLocaleString('tr-TR')} ₺`
        : 'İhbar tazminatı hakkı yok',
      kanun_ref: YASAL_BILGILER.ihbar,
    },
    izin: {
      hak_var: izinHakVar,
      gun: izinGun,
      tutar: Math.round(izinTutari * 100) / 100,
      aciklama: izinHakVar
        ? `${izinGun} gün × ${gunlukBrut.toLocaleString('tr-TR')} ₺ = ${izinTutari.toLocaleString('tr-TR')} ₺`
        : 'Kullanılmayan izin yok',
      kanun_ref: YASAL_BILGILER.izin,
    },
    toplam: {
      tutar: Math.round(toplamTazminat * 100) / 100,
      metin: toplamTazminat.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
    },
    yasal_bilgiler: YASAL_BILGILER,
  };
}

/**
 * Tazminat hesabını kaydet
 */
export async function kaydetTazminatHesabi(hesap, notlar = '') {
  const sql = `
    INSERT INTO tazminat_hesaplari (
      personel_id, cikis_tarihi, cikis_sebebi,
      ise_giris_tarihi, calisma_yil, calisma_ay, calisma_gun,
      brut_maas, gunluk_brut,
      kidem_hak_var, kidem_gun, kidem_tutari, kidem_tavan_asildi,
      ihbar_hak_var, ihbar_gun, ihbar_tutari,
      izin_hak_var, izin_gun, izin_tutari,
      toplam_tazminat, notlar
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
    )
    RETURNING id
  `;

  const values = [
    hesap.personel.id,
    hesap.cikis.tarih,
    hesap.cikis.sebep.kod,
    hesap.personel.ise_giris_tarihi,
    hesap.calisma_suresi.toplam_yil,
    hesap.calisma_suresi.ay,
    hesap.calisma_suresi.gun,
    hesap.personel.brut_maas,
    hesap.hesaplama.gunluk_brut,
    hesap.kidem.hak_var,
    hesap.kidem.gun,
    hesap.kidem.tutar,
    hesap.hesaplama.tavan_asimi,
    hesap.ihbar.hak_var,
    hesap.ihbar.gun,
    hesap.ihbar.tutar,
    hesap.izin.hak_var,
    hesap.izin.gun,
    hesap.izin.tutar,
    hesap.toplam.tutar,
    notlar,
  ];

  const result = await query(sql, values);
  return result.rows[0].id;
}

/**
 * Personeli pasif yap ve tazminat bilgilerini kaydet
 */
export async function personelCikisYap(personelId, cikisTarihi, cikisSebebi, _tazminatId) {
  const sql = `
    UPDATE personeller SET
      durum = 'pasif',
      cikis_tarihi = $2,
      cikis_sebebi = $3,
      tazminat_odendi = FALSE
    WHERE id = $1
    RETURNING *
  `;

  const result = await query(sql, [personelId, cikisTarihi, cikisSebebi]);
  return result.rows[0];
}

/**
 * Toplam tazminat riskini hesapla (tüm aktif personel)
 */
export async function hesaplaTazminatRiski(projeId = null) {
  const whereClause = projeId
    ? `WHERE p.durum = 'aktif' AND pp.proje_id = $1`
    : `WHERE p.durum = 'aktif' OR p.durum IS NULL`;

  const sql = `
    SELECT 
      p.id,
      p.ad || ' ' || p.soyad as tam_ad,
      p.ise_giris_tarihi,
      p.maas,
      p.kalan_izin_gun,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.ise_giris_tarihi)) +
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, p.ise_giris_tarihi)) / 12.0 as calisma_yil
    FROM personeller p
    ${projeId ? 'JOIN proje_personelleri pp ON pp.personel_id = p.id' : ''}
    ${whereClause}
  `;

  const params = projeId ? [projeId] : [];
  const result = await query(sql, params);

  let toplamKidem = 0;
  let toplamIhbar = 0;
  let toplamIzin = 0;
  const kidemDagilimi = { '0-1': 0, '1-3': 0, '3-5': 0, '5+': 0 };

  for (const p of result.rows) {
    const brutMaas = parseFloat(p.maas) || 0;
    const calismaYil = parseFloat(p.calisma_yil) || 0;
    const kalanIzin = p.kalan_izin_gun || 0;
    const gunlukBrut = brutMaas / 30;

    // Kıdem (her yıl için 1 maaş)
    if (calismaYil >= 1) {
      toplamKidem += calismaYil * brutMaas;
    }

    // İhbar (8 hafta max)
    toplamIhbar += 56 * gunlukBrut;

    // İzin
    toplamIzin += kalanIzin * gunlukBrut;

    // Kıdem dağılımı
    if (calismaYil < 1) kidemDagilimi['0-1']++;
    else if (calismaYil < 3) kidemDagilimi['1-3']++;
    else if (calismaYil < 5) kidemDagilimi['3-5']++;
    else kidemDagilimi['5+']++;
  }

  return {
    personel_sayisi: result.rows.length,
    toplam_kidem_riski: Math.round(toplamKidem),
    toplam_ihbar_riski: Math.round(toplamIhbar),
    toplam_izin_riski: Math.round(toplamIzin),
    toplam_risk: Math.round(toplamKidem + toplamIhbar + toplamIzin),
    kidem_dagilimi: kidemDagilimi,
  };
}

export default {
  CIKIS_SEBEPLERI,
  YASAL_BILGILER,
  hesaplaTazminat,
  kaydetTazminatHesabi,
  personelCikisYap,
  hesaplaTazminatRiski,
};
