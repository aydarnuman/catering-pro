/**
 * Fiyat Hesaplama Yardımcı Fonksiyonları
 * Fatura ve piyasa fiyatı önceliklendirme
 */

import { miktarDonustur } from './birim-donusum.js';

/** Fiyat geçerlilik süresi (gün) — tüm sistemlerin ortak sabiti */
export const FIYAT_GECERLILIK_GUN = 90;

/**
 * Fiyatın güncel olup olmadığını kontrol et
 * @param {Date|string} tarih - Fiyat tarihi
 * @param {number} maxGun - Maksimum geçerlilik süresi (varsayılan 90)
 * @returns {Object} { guncel: boolean, gun: number }
 */
export function fiyatGuncelMi(tarih, maxGun = FIYAT_GECERLILIK_GUN) {
  if (!tarih) return { guncel: false, gun: null };

  const fiyatTarihi = new Date(tarih);
  const simdi = new Date();
  const farkMs = simdi - fiyatTarihi;
  const gun = Math.floor(farkMs / (1000 * 60 * 60 * 24));

  // Gelecek tarihler için (negatif gün) güncel sayılır
  if (gun < 0) {
    return { guncel: true, gun: 0 };
  }

  return {
    guncel: gun <= maxGun,
    gun: gun,
  };
}

/**
 * Malzeme için en uygun fiyatı belirle
 * Öncelik (maliyet-hesaplama-service ile tutarlı):
 *   aktif_fiyat > son_alış (≤90 gün) > piyasa > son_alış (eski) > manuel > varyant > 0
 *
 * @param {Object} malzeme - recete_malzemeler satırı (JOIN ürün kartı ile)
 * @param {string} tercih - 'auto', 'fatura', 'piyasa'
 * @returns {Object} { fiyat, kaynak, tarih, guncel, uyari }
 */
export function getFiyat(malzeme, tercih = 'auto') {
  const result = {
    fiyat: 0,
    kaynak: null,
    tarih: null,
    guncel: false,
    uyari: null,
  };

  // Eğer malzeme objesinde fiyat_tercihi varsa, onu kullan (parametre öncelikli)
  const kullanilacakTercih = tercih !== 'auto' ? tercih : malzeme.fiyat_tercihi || 'auto';

  // Aktif fiyat kontrolü (ürün kartından)
  const aktifFiyat = parseFloat(malzeme.aktif_fiyat || malzeme.urun_aktif_fiyat) || 0;

  // Fatura fiyatı kontrolü
  const faturaFiyat = parseFloat(malzeme.fatura_fiyat || malzeme.son_alis_fiyati || malzeme.urun_son_alis) || 0;
  const faturaTarih = malzeme.fatura_fiyat_tarihi || malzeme.son_alis_tarihi || malzeme.urun_son_alis_tarihi;
  const faturaGuncel = fiyatGuncelMi(faturaTarih);

  // Piyasa fiyatı kontrolü
  const piyasaFiyat = parseFloat(malzeme.piyasa_fiyat) || parseFloat(malzeme.birim_fiyat) || 0;
  const piyasaTarih = malzeme.piyasa_fiyat_tarihi;
  const piyasaGuncel = piyasaTarih ? fiyatGuncelMi(piyasaTarih) : { guncel: false, gun: null };

  // Manuel fiyat
  const manuelFiyat = parseFloat(malzeme.manuel_fiyat || malzeme.urun_manuel_fiyat) || parseFloat(malzeme.toplam_fiyat) || 0;

  // Varyant fiyat (ana ürün yoksa varyantlardan)
  const varyantFiyat = parseFloat(malzeme.varyant_fiyat) || 0;

  // Tercih: Sadece fatura
  if (kullanilacakTercih === 'fatura') {
    if (faturaFiyat > 0) {
      return {
        fiyat: faturaFiyat,
        kaynak: 'fatura',
        tarih: faturaTarih,
        guncel: faturaGuncel.guncel,
        uyari: !faturaGuncel.guncel ? `Fatura fiyatı ${faturaGuncel.gun} gün önce` : null,
      };
    }
    return { ...result, uyari: 'Fatura fiyatı bulunamadı' };
  }

  // Tercih: Sadece piyasa
  if (kullanilacakTercih === 'piyasa') {
    if (piyasaFiyat > 0) {
      return {
        fiyat: piyasaFiyat,
        kaynak: 'piyasa',
        tarih: piyasaTarih,
        guncel: piyasaGuncel.guncel,
        uyari:
          !piyasaGuncel.guncel && piyasaGuncel.gun !== null
            ? `Piyasa fiyatı ${piyasaGuncel.gun} gün önce`
            : !piyasaTarih
              ? 'Piyasa fiyatı tarihi belirtilmemiş'
              : null,
      };
    }
    return { ...result, uyari: 'Piyasa fiyatı bulunamadı' };
  }

  // Tercih: Auto (akıllı seçim — maliyet-hesaplama-service ile tutarlı öncelik)
  // 1. Aktif fiyat varsa onu kullan
  if (aktifFiyat > 0) {
    return {
      fiyat: aktifFiyat,
      kaynak: 'aktif',
      tarih: null,
      guncel: true,
      uyari: null,
    };
  }

  // 2. Güncel fatura fiyatı varsa onu kullan
  if (faturaFiyat > 0 && faturaGuncel.guncel) {
    return {
      fiyat: faturaFiyat,
      kaynak: 'fatura',
      tarih: faturaTarih,
      guncel: true,
      uyari: null,
    };
  }

  // 3. Piyasa fiyatı varsa onu kullan
  if (piyasaFiyat > 0) {
    return {
      fiyat: piyasaFiyat,
      kaynak: 'piyasa',
      tarih: piyasaTarih,
      guncel: piyasaGuncel.guncel,
      uyari:
        !piyasaGuncel.guncel && piyasaGuncel.gun !== null
          ? `Piyasa fiyatı ${piyasaGuncel.gun} gün önce`
          : !piyasaTarih
            ? 'Piyasa fiyatı tarihi belirtilmemiş'
            : null,
    };
  }

  // 4. Eski fatura fiyatı varsa onu kullan (uyarıyla)
  if (faturaFiyat > 0) {
    return {
      fiyat: faturaFiyat,
      kaynak: 'fatura',
      tarih: faturaTarih,
      guncel: false,
      uyari: `Fatura fiyatı ${faturaGuncel.gun} gün önce güncellendi`,
    };
  }

  // 5. Manuel fiyat
  if (manuelFiyat > 0) {
    return {
      fiyat: manuelFiyat,
      kaynak: 'manuel',
      tarih: null,
      guncel: false,
      uyari: 'Manuel fiyat kullanılıyor',
    };
  }

  // 6. Varyant fiyat (son fallback)
  if (varyantFiyat > 0) {
    return {
      fiyat: varyantFiyat,
      kaynak: 'varyant',
      tarih: null,
      guncel: false,
      uyari: 'Varyant fiyatı kullanılıyor',
    };
  }

  // 7. Fiyat yok
  return {
    fiyat: 0,
    kaynak: null,
    tarih: null,
    guncel: false,
    uyari: 'Fiyat bilgisi bulunamadı',
  };
}

/**
 * Malzeme toplam maliyetini hesapla (birim dönüşümü dahil)
 * @param {Object} malzeme - recete_malzemeler satırı
 * @param {string} fiyatTercihi - 'auto', 'fatura', 'piyasa'
 * @returns {Object} { sistem, piyasa, secilen, birim, miktar, uyarilar }
 */
export async function hesaplaMalzemeMaliyet(malzeme, fiyatTercihi = null) {
  // Eğer fiyatTercihi verilmemişse, malzeme objesindeki fiyat_tercihi'ni kullan
  const kullanilacakTercih = fiyatTercihi || malzeme.fiyat_tercihi || 'auto';

  const miktar = parseFloat(malzeme.miktar) || 0;
  const malzemeBirim = malzeme.birim || 'g';
  const fiyatBirim = malzeme.fiyat_birimi || malzeme.stok_birim || 'kg';

  // Birim dönüşümü: malzeme birimi -> fiyat birimi
  // Örnek: 100g malzeme, fiyat kg bazında -> 0.1 kg
  const donusturulmusMiktar = await miktarDonustur(miktar, malzemeBirim, fiyatBirim);

  // Fatura maliyeti
  const faturaFiyatBilgi = getFiyat(malzeme, 'fatura');
  const faturaMaliyet = donusturulmusMiktar * faturaFiyatBilgi.fiyat;

  // Piyasa maliyeti
  const piyasaFiyatBilgi = getFiyat(malzeme, 'piyasa');
  const piyasaMaliyet = donusturulmusMiktar * piyasaFiyatBilgi.fiyat;

  // Seçilen (auto) maliyet
  const secilenFiyatBilgi = getFiyat(malzeme, kullanilacakTercih);
  const secilenMaliyet = donusturulmusMiktar * secilenFiyatBilgi.fiyat;

  // Uyarıları topla
  const uyarilar = [];
  if (faturaFiyatBilgi.uyari) uyarilar.push({ tip: 'fatura', mesaj: faturaFiyatBilgi.uyari });
  if (piyasaFiyatBilgi.uyari) uyarilar.push({ tip: 'piyasa', mesaj: piyasaFiyatBilgi.uyari });
  if (secilenFiyatBilgi.uyari && secilenFiyatBilgi.kaynak !== 'fatura' && secilenFiyatBilgi.kaynak !== 'piyasa') {
    uyarilar.push({ tip: 'secilen', mesaj: secilenFiyatBilgi.uyari });
  }

  return {
    miktar: miktar,
    birim: malzemeBirim,
    donusturulen_miktar: donusturulmusMiktar,
    fiyat_birim: fiyatBirim,

    fatura: {
      birim_fiyat: faturaFiyatBilgi.fiyat,
      toplam: faturaMaliyet,
      guncel: faturaFiyatBilgi.guncel,
      tarih: faturaFiyatBilgi.tarih,
    },

    piyasa: {
      birim_fiyat: piyasaFiyatBilgi.fiyat,
      toplam: piyasaMaliyet,
      guncel: piyasaFiyatBilgi.guncel,
      tarih: piyasaFiyatBilgi.tarih,
    },

    secilen: {
      kaynak: secilenFiyatBilgi.kaynak,
      birim_fiyat: secilenFiyatBilgi.fiyat,
      toplam: secilenMaliyet,
      guncel: secilenFiyatBilgi.guncel,
    },

    uyarilar: uyarilar,
  };
}

/**
 * Fiyat farkını hesapla
 * @param {number} fatura - Fatura fiyatı
 * @param {number} piyasa - Piyasa fiyatı
 * @returns {Object} { fark, yuzde, durum }
 */
export function fiyatFarkiHesapla(fatura, piyasa) {
  if (!fatura || fatura === 0) {
    return { fark: 0, yuzde: 0, durum: 'fatura_yok' };
  }
  if (!piyasa || piyasa === 0) {
    return { fark: 0, yuzde: 0, durum: 'piyasa_yok' };
  }

  const fark = piyasa - fatura;
  const yuzde = (fark / fatura) * 100;

  let durum = 'normal';
  if (yuzde > 10) durum = 'piyasa_yuksek';
  else if (yuzde < -10) durum = 'piyasa_dusuk';

  return {
    fark: fark,
    yuzde: parseFloat(yuzde.toFixed(1)),
    durum: durum,
  };
}

/**
 * Maliyet değişikliğini logla
 * Sadece %5'ten fazla değişimleri kaydeder
 *
 * @param {Function} queryFn - Database query fonksiyonu
 * @param {Object} data - Log verisi
 * @returns {Promise<number|null>} - Log ID veya null
 */
export async function logMaliyetDegisimi(queryFn, data) {
  const {
    recete_id,
    sablon_id,
    onceki_fatura,
    onceki_piyasa,
    yeni_fatura,
    yeni_piyasa,
    sebep,
    aciklama,
    kullanici_id,
  } = data;

  // Değişim hesapla
  const faturaDegisim = (yeni_fatura || 0) - (onceki_fatura || 0);
  const piyasaDegisim = (yeni_piyasa || 0) - (onceki_piyasa || 0);

  const faturaDegisimYuzde = onceki_fatura > 0 ? (faturaDegisim / onceki_fatura) * 100 : 0;
  const piyasaDegisimYuzde = onceki_piyasa > 0 ? (piyasaDegisim / onceki_piyasa) * 100 : 0;

  // Sadece %5'ten fazla değişimleri logla
  if (Math.abs(faturaDegisimYuzde) < 5 && Math.abs(piyasaDegisimYuzde) < 5) {
    return null;
  }

  try {
    const result = await queryFn(
      `
      INSERT INTO maliyet_audit_log (
        recete_id, sablon_id,
        onceki_fatura_maliyet, onceki_piyasa_maliyet,
        yeni_fatura_maliyet, yeni_piyasa_maliyet,
        fatura_degisim, piyasa_degisim,
        fatura_degisim_yuzde, piyasa_degisim_yuzde,
        sebep, aciklama, kullanici_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `,
      [
        recete_id || null,
        sablon_id || null,
        onceki_fatura || 0,
        onceki_piyasa || 0,
        yeni_fatura || 0,
        yeni_piyasa || 0,
        faturaDegisim,
        piyasaDegisim,
        parseFloat(faturaDegisimYuzde.toFixed(2)),
        parseFloat(piyasaDegisimYuzde.toFixed(2)),
        sebep,
        aciklama || null,
        kullanici_id || null,
      ]
    );

    return result.rows[0]?.id;
  } catch (_error) {
    return null;
  }
}

// Test fonksiyonu
export async function testFiyatHesaplama() {
  const _testMalzeme = {
    miktar: 100,
    birim: 'g',
    fatura_fiyat: 45,
    fatura_fiyat_tarihi: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 gün önce
    piyasa_fiyat: 52,
    piyasa_fiyat_tarihi: new Date(),
    fiyat_birimi: 'kg',
  };
}
