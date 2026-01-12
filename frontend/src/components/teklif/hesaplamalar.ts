import type {
  MaliyetDetay,
  MalzemeMaliyet,
  PersonelMaliyet,
  NakliyeMaliyet,
  SarfMalzemeMaliyet,
  EkipmanBakimMaliyet,
  GenelGiderMaliyet,
  YasalGiderlerMaliyet,
  RiskPayiMaliyet,
  CetvelKalemi,
} from './types';

// ========== MALZEME HESAPLAMA ==========
export function hesaplaMalzemeMaliyet(detay: MalzemeMaliyet): number {
  if (detay.hesaplamaYontemi === 'ogun_bazli') {
    // Öğün bazlı hesaplama
    let toplam = 0;
    for (const ogun of detay.ogunler) {
      if (ogun.aktif) {
        toplam += ogun.kisiSayisi * ogun.gunSayisi * ogun.kisiBasiMaliyet;
      }
    }
    return toplam;
  } else {
    // Toplam hesaplama
    const { gunlukKisi, gunSayisi, ogunSayisi, kisiBasiMaliyet } = detay;
    return gunlukKisi * gunSayisi * ogunSayisi * kisiBasiMaliyet;
  }
}

// ========== PERSONEL HESAPLAMA ==========
export function hesaplaPersonelMaliyet(detay: PersonelMaliyet): number {
  const sgkKatsayi = 1 + (detay.sgkOrani / 100);
  let aylikToplam = 0;
  
  for (const poz of detay.pozisyonlar) {
    const aylikMaliyet = poz.brutMaas * sgkKatsayi;
    aylikToplam += poz.adet * aylikMaliyet;
  }
  
  return aylikToplam * detay.aySayisi;
}

// Personel özet bilgileri
export function hesaplaPersonelOzet(detay: PersonelMaliyet) {
  const sgkKatsayi = 1 + (detay.sgkOrani / 100);
  let aylikBrut = 0;
  let toplamKisi = 0;
  
  for (const poz of detay.pozisyonlar) {
    aylikBrut += poz.adet * poz.brutMaas;
    toplamKisi += poz.adet;
  }
  
  const aylikSgk = aylikBrut * (detay.sgkOrani / 100);
  const aylikToplam = aylikBrut + aylikSgk;
  const yillikToplam = aylikToplam * detay.aySayisi;
  
  return {
    toplamKisi,
    aylikBrut,
    aylikSgk,
    aylikToplam,
    yillikToplam,
  };
}

// ========== NAKLİYE HESAPLAMA ==========
export function hesaplaNakliyeMaliyet(detay: NakliyeMaliyet): number {
  let aylikToplam = 0;
  
  for (const arac of detay.araclar) {
    const aylikKira = arac.adet * arac.aylikKira;
    const aylikYakit = arac.adet * (arac.aylikKm / 100) * arac.yakitTuketimi * detay.yakitFiyati;
    aylikToplam += aylikKira + aylikYakit;
  }
  
  return aylikToplam * detay.aySayisi;
}

// Nakliye özet bilgileri
export function hesaplaNakliyeOzet(detay: NakliyeMaliyet) {
  let toplamArac = 0;
  let aylikKiraToplam = 0;
  let aylikYakitToplam = 0;
  
  for (const arac of detay.araclar) {
    toplamArac += arac.adet;
    aylikKiraToplam += arac.adet * arac.aylikKira;
    aylikYakitToplam += arac.adet * (arac.aylikKm / 100) * arac.yakitTuketimi * detay.yakitFiyati;
  }
  
  const aylikToplam = aylikKiraToplam + aylikYakitToplam;
  const yillikToplam = aylikToplam * detay.aySayisi;
  
  return {
    toplamArac,
    aylikKiraToplam,
    aylikYakitToplam,
    aylikToplam,
    yillikToplam,
  };
}

// ========== SARF MALZEME HESAPLAMA ==========
export function hesaplaSarfMalzemeMaliyet(detay: SarfMalzemeMaliyet): number {
  if (detay.hesaplamaYontemi === 'kisi_basi') {
    // Kişi başı hesaplama
    let kisiBasiGunlukToplam = 0;
    for (const kalem of detay.kalemler) {
      kisiBasiGunlukToplam += kalem.miktar;
    }
    return detay.gunlukKisi * detay.gunSayisi * kisiBasiGunlukToplam;
  } else {
    // Toplam hesaplama
    return detay.aylikTutar * detay.aySayisi;
  }
}

// Sarf malzeme özet bilgileri
export function hesaplaSarfOzet(detay: SarfMalzemeMaliyet) {
  let kisiBasiGunluk = 0;
  for (const kalem of detay.kalemler) {
    kisiBasiGunluk += kalem.miktar;
  }
  
  const gunlukToplam = detay.gunlukKisi * kisiBasiGunluk;
  const yillikToplam = gunlukToplam * detay.gunSayisi;
  
  return {
    kisiBasiGunluk,
    gunlukToplam,
    yillikToplam,
  };
}

// ========== EKİPMAN & BAKIM HESAPLAMA ==========
export function hesaplaEkipmanBakimMaliyet(detay: EkipmanBakimMaliyet): number {
  let kiraToplam = 0;
  let satinAlmaToplam = 0;
  
  for (const ekipman of detay.ekipmanlar) {
    if (ekipman.tip === 'kira') {
      kiraToplam += ekipman.adet * ekipman.birimFiyat * detay.aySayisi;
    } else {
      satinAlmaToplam += ekipman.adet * ekipman.birimFiyat;
    }
  }
  
  const bakimToplam = detay.aylikBakimTutar * detay.aySayisi;
  
  return kiraToplam + satinAlmaToplam + bakimToplam;
}

// Ekipman özet bilgileri
export function hesaplaEkipmanOzet(detay: EkipmanBakimMaliyet) {
  let aylikKiraToplam = 0;
  let satinAlmaToplam = 0;
  
  for (const ekipman of detay.ekipmanlar) {
    if (ekipman.tip === 'kira') {
      aylikKiraToplam += ekipman.adet * ekipman.birimFiyat;
    } else {
      satinAlmaToplam += ekipman.adet * ekipman.birimFiyat;
    }
  }
  
  const aylikBakim = detay.aylikBakimTutar;
  const yillikKira = aylikKiraToplam * detay.aySayisi;
  const yillikBakim = aylikBakim * detay.aySayisi;
  
  return {
    aylikKiraToplam,
    satinAlmaToplam,
    aylikBakim,
    yillikKira,
    yillikBakim,
    toplam: yillikKira + satinAlmaToplam + yillikBakim,
  };
}

// ========== GENEL GİDER HESAPLAMA ==========
export function hesaplaGenelGiderMaliyet(detay: GenelGiderMaliyet): number {
  let aylikToplam = 0;
  for (const kalem of detay.kalemler) {
    aylikToplam += kalem.aylikTutar;
  }
  return aylikToplam * detay.aySayisi;
}

// Genel gider özet bilgileri
export function hesaplaGenelGiderOzet(detay: GenelGiderMaliyet) {
  let aylikToplam = 0;
  for (const kalem of detay.kalemler) {
    aylikToplam += kalem.aylikTutar;
  }
  return {
    aylikToplam,
    yillikToplam: aylikToplam * detay.aySayisi,
  };
}

// ========== YASAL GİDERLER HESAPLAMA ==========
export function hesaplaYasalGiderlerMaliyet(detay: YasalGiderlerMaliyet): number {
  let toplam = 0;
  
  for (const item of detay.sigortalar) {
    toplam += item.tutar;
  }
  for (const item of detay.belgeler) {
    toplam += item.tutar;
  }
  for (const item of detay.isg) {
    toplam += item.tutar;
  }
  for (const item of detay.ihaleGiderleri) {
    toplam += item.tutar;
  }
  
  return toplam;
}

// Yasal gider özet bilgileri
export function hesaplaYasalGiderOzet(detay: YasalGiderlerMaliyet) {
  let sigortaToplam = 0;
  let belgeToplam = 0;
  let isgToplam = 0;
  let ihaleToplam = 0;
  
  for (const item of detay.sigortalar) sigortaToplam += item.tutar;
  for (const item of detay.belgeler) belgeToplam += item.tutar;
  for (const item of detay.isg) isgToplam += item.tutar;
  for (const item of detay.ihaleGiderleri) ihaleToplam += item.tutar;
  
  return {
    sigortaToplam,
    belgeToplam,
    isgToplam,
    ihaleToplam,
    toplam: sigortaToplam + belgeToplam + isgToplam + ihaleToplam,
  };
}

// ========== RİSK PAYI HESAPLAMA ==========
export function hesaplaRiskPayi(toplamMaliyet: number, detay: RiskPayiMaliyet): number {
  if (detay.kullanManuel) {
    return toplamMaliyet * (detay.manuelOran / 100);
  }
  
  // Kategorilerden toplam oran hesapla
  let toplamOran = 0;
  for (const kategori of detay.kategoriler) {
    if (kategori.aktif) {
      toplamOran += kategori.oran;
    }
  }
  
  return toplamMaliyet * (toplamOran / 100);
}

// Risk payı özet bilgileri
export function hesaplaRiskOzet(toplamMaliyet: number, detay: RiskPayiMaliyet) {
  let toplamOran = 0;
  
  if (detay.kullanManuel) {
    toplamOran = detay.manuelOran;
  } else {
    for (const kategori of detay.kategoriler) {
      if (kategori.aktif) {
        toplamOran += kategori.oran;
      }
    }
  }
  
  const riskTutari = toplamMaliyet * (toplamOran / 100);
  
  return {
    toplamOran,
    riskTutari,
  };
}

// ========== ANA HESAPLAMA FONKSİYONLARI ==========

// Tüm maliyetleri hesapla ve güncelle
export function hesaplaTumMaliyetler(maliyetDetay: MaliyetDetay): MaliyetDetay {
  const yeniDetay = JSON.parse(JSON.stringify(maliyetDetay)) as MaliyetDetay;

  // Her kalemi hesapla
  yeniDetay.malzeme.tutar = hesaplaMalzemeMaliyet(yeniDetay.malzeme.detay);
  yeniDetay.personel.tutar = hesaplaPersonelMaliyet(yeniDetay.personel.detay);
  yeniDetay.nakliye.tutar = hesaplaNakliyeMaliyet(yeniDetay.nakliye.detay);
  yeniDetay.sarf_malzeme.tutar = hesaplaSarfMalzemeMaliyet(yeniDetay.sarf_malzeme.detay);
  yeniDetay.ekipman_bakim.tutar = hesaplaEkipmanBakimMaliyet(yeniDetay.ekipman_bakim.detay);
  yeniDetay.genel_gider.tutar = hesaplaGenelGiderMaliyet(yeniDetay.genel_gider.detay);
  yeniDetay.yasal_giderler.tutar = hesaplaYasalGiderlerMaliyet(yeniDetay.yasal_giderler.detay);

  // Risk payı hariç toplam
  const riskHaricToplam =
    yeniDetay.malzeme.tutar +
    yeniDetay.personel.tutar +
    yeniDetay.nakliye.tutar +
    yeniDetay.sarf_malzeme.tutar +
    yeniDetay.ekipman_bakim.tutar +
    yeniDetay.genel_gider.tutar +
    yeniDetay.yasal_giderler.tutar;

  // Risk payı
  yeniDetay.risk_payi.tutar = hesaplaRiskPayi(riskHaricToplam, yeniDetay.risk_payi.detay);

  return yeniDetay;
}

// Toplam maliyet hesapla
export function hesaplaToplam(maliyetDetay: MaliyetDetay): number {
  return (
    maliyetDetay.malzeme.tutar +
    maliyetDetay.personel.tutar +
    maliyetDetay.nakliye.tutar +
    maliyetDetay.sarf_malzeme.tutar +
    maliyetDetay.ekipman_bakim.tutar +
    maliyetDetay.genel_gider.tutar +
    maliyetDetay.yasal_giderler.tutar +
    maliyetDetay.risk_payi.tutar
  );
}

// Kar ve teklif fiyatı hesapla
export function hesaplaKarVeTeklif(
  maliyetToplam: number,
  karOrani: number
): { karTutari: number; teklifFiyati: number } {
  const karTutari = maliyetToplam * (karOrani / 100);
  const teklifFiyati = maliyetToplam + karTutari;
  return { karTutari, teklifFiyati };
}

// Cetvel toplamı hesapla
export function hesaplaCetvelToplami(cetvel: CetvelKalemi[]): number {
  return cetvel.reduce((toplam, kalem) => toplam + kalem.tutar, 0);
}

// ========== FORMAT FONKSİYONLARI ==========

// Para formatı
export function formatPara(tutar: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(tutar);
}

// Kısa para formatı (milyon/bin)
export function formatParaKisa(tutar: number): string {
  if (tutar >= 1000000) {
    return `${(tutar / 1000000).toFixed(1)}M ₺`;
  }
  if (tutar >= 1000) {
    return `${(tutar / 1000).toFixed(0)}K ₺`;
  }
  return `${tutar.toFixed(0)} ₺`;
}

// Sayı formatı (binlik ayraç)
export function formatSayi(sayi: number): string {
  return new Intl.NumberFormat('tr-TR').format(sayi);
}
