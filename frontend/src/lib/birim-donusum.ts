/**
 * =============================================
 * BİRİM DÖNÜŞÜM SABİTLERİ VE FORMÜLLERİ
 * =============================================
 * 
 * SINGLE SOURCE OF TRUTH - TÜM SİSTEM BU DOSYAYI KULLANMALI
 * 
 * Uluslararası standartlara göre hazırlanmıştır:
 * - USDA FoodData Central
 * - FAO Food Standards
 * - King Arthur Baking
 * - WHO/TSE Gıda Standartları
 * 
 * ÖNEMLİ: Bu dosyadaki değerleri başka yerde DUPLICATE ETMEYİN!
 * Backend için: backend/src/utils/birim-constants.js dosyasını kullanın
 * 
 * @version 2.0.0
 * @lastUpdated 2026-01-31
 */

// =============================================
// GLOBAL SABİTLER (DUPLICATE YAPILMAMALI!)
// =============================================

/** Varsayılan adet başına gram (USDA büyük boy yumurta standardı) */
export const GRAM_PER_ADET_DEFAULT = 50;

/** Varsayılan sıvı yoğunluğu - yağlar için (kg/L) */
export const DEFAULT_OIL_DENSITY = 0.92;

/** Zeytinyağı yoğunluğu - bilimsel standart (kg/L) */
export const ZEYTINYAGI_DENSITY = 0.917;

/** Süt yoğunluğu (kg/L) */
export const SUT_DENSITY = 1.03;

/** Gram → Kilogram çarpanı */
export const GRAM_TO_KG = 0.001;

/** Kilogram → Gram çarpanı */
export const KG_TO_GRAM = 1000;

/** Mililitre → Litre çarpanı */
export const ML_TO_LITRE = 0.001;

/** Litre → Mililitre çarpanı */
export const LITRE_TO_ML = 1000;

/** Varsayılan porsiyon miktarı (gram) - yetişkin standart */
export const DEFAULT_PORSIYON_GRAM = 250;

// =============================================
// ADET BAŞINA STANDART GRAMAJLAR
// =============================================

export const ADET_GRAMAJ = {
  // YUMURTA (USDA Standardı - kabuksuz)
  yumurta: { gram: 50, kaynak: 'USDA', aciklama: 'Büyük boy yumurta (kabuksuz)' },
  yumurta_kucuk: { gram: 38, kaynak: 'USDA', aciklama: 'Küçük boy yumurta' },
  yumurta_orta: { gram: 44, kaynak: 'USDA', aciklama: 'Orta boy yumurta' },
  yumurta_buyuk: { gram: 50, kaynak: 'USDA', aciklama: 'Büyük boy yumurta' },
  yumurta_jumbo: { gram: 62, kaynak: 'USDA', aciklama: 'Jumbo yumurta' },
  
  // SEBZELER (FAO/USDA)
  patates: { gram: 150, kaynak: 'USDA', aciklama: 'Orta boy patates' },
  patates_buyuk: { gram: 280, kaynak: 'USDA', aciklama: 'Büyük boy patates' },
  sogan: { gram: 110, kaynak: 'USDA', aciklama: 'Orta boy soğan' },
  sogan_kucuk: { gram: 70, kaynak: 'USDA', aciklama: 'Küçük boy soğan' },
  domates: { gram: 123, kaynak: 'USDA', aciklama: 'Orta boy domates' },
  domates_buyuk: { gram: 182, kaynak: 'USDA', aciklama: 'Büyük boy domates' },
  havuc: { gram: 72, kaynak: 'USDA', aciklama: 'Orta boy havuç' },
  sarimsak_dis: { gram: 5, kaynak: 'USDA', aciklama: '1 diş sarımsak' },
  sarimsak_bas: { gram: 40, kaynak: 'USDA', aciklama: '1 baş sarımsak (~8 diş)' },
  biber_dolmalik: { gram: 119, kaynak: 'USDA', aciklama: 'Orta boy dolmalık biber' },
  biber_sivri: { gram: 45, kaynak: 'FAO', aciklama: 'Sivri biber' },
  patlican: { gram: 458, kaynak: 'USDA', aciklama: 'Orta boy patlıcan' },
  kabak: { gram: 196, kaynak: 'USDA', aciklama: 'Orta boy kabak' },
  salatalik: { gram: 301, kaynak: 'USDA', aciklama: 'Orta boy salatalık' },
  marul_bas: { gram: 600, kaynak: 'FAO', aciklama: '1 baş marul' },
  
  // MEYVELER (USDA)
  elma: { gram: 182, kaynak: 'USDA', aciklama: 'Orta boy elma' },
  muz: { gram: 118, kaynak: 'USDA', aciklama: 'Orta boy muz' },
  portakal: { gram: 131, kaynak: 'USDA', aciklama: 'Orta boy portakal' },
  limon: { gram: 84, kaynak: 'USDA', aciklama: 'Orta boy limon' },
  mandalina: { gram: 88, kaynak: 'USDA', aciklama: 'Orta boy mandalina' },
  armut: { gram: 178, kaynak: 'USDA', aciklama: 'Orta boy armut' },
  seftali: { gram: 150, kaynak: 'USDA', aciklama: 'Orta boy şeftali' },
  erik: { gram: 66, kaynak: 'USDA', aciklama: 'Orta boy erik' },
  kayisi: { gram: 35, kaynak: 'USDA', aciklama: 'Orta boy kayısı' },
  
  // EKMEK / HAMUR İŞLERİ
  ekmek_dilim: { gram: 30, kaynak: 'Sektör', aciklama: 'Standart ekmek dilimi' },
  pide: { gram: 200, kaynak: 'Sektör', aciklama: '1 adet pide' },
  simit: { gram: 120, kaynak: 'Sektör', aciklama: '1 adet simit' },
  pogaca: { gram: 80, kaynak: 'Sektör', aciklama: '1 adet poğaça' },
  
} as const;

// =============================================
// SIVI ÜRÜN YOĞUNLUKLARI (kg/L)
// =============================================

export const SIVI_YOGUNLUK = {
  // YAĞLAR
  zeytinyagi: { yogunluk: 0.917, kaynak: 'Bilimsel', aciklama: '1 litre = 0.917 kg' },
  aycicek_yagi: { yogunluk: 0.92, kaynak: 'Bilimsel', aciklama: '1 litre = 0.92 kg' },
  misir_yagi: { yogunluk: 0.92, kaynak: 'Bilimsel', aciklama: '1 litre = 0.92 kg' },
  tereyag_eritilmis: { yogunluk: 0.91, kaynak: 'Bilimsel', aciklama: '1 litre = 0.91 kg' },
  
  // SÜT ÜRÜNLERİ
  sut: { yogunluk: 1.03, kaynak: 'USDA', aciklama: '1 litre = 1.03 kg' },
  krema: { yogunluk: 1.01, kaynak: 'USDA', aciklama: '1 litre = 1.01 kg' },
  yogurt: { yogunluk: 1.05, kaynak: 'Sektör', aciklama: '1 litre ≈ 1.05 kg' },
  ayran: { yogunluk: 1.02, kaynak: 'Sektör', aciklama: '1 litre = 1.02 kg' },
  
  // DİĞER
  su: { yogunluk: 1.0, kaynak: 'Fizik', aciklama: '1 litre = 1 kg' },
  bal: { yogunluk: 1.42, kaynak: 'USDA', aciklama: '1 litre = 1.42 kg' },
  pekmez: { yogunluk: 1.35, kaynak: 'Sektör', aciklama: '1 litre ≈ 1.35 kg' },
  sirke: { yogunluk: 1.01, kaynak: 'Bilimsel', aciklama: '1 litre = 1.01 kg' },
  
} as const;

// =============================================
// KAŞIK BAŞINA GRAMAJLAR
// =============================================

export const KASIK_GRAMAJ = {
  // UN VE NİŞASTA
  un: { yemek_kasigi: 8, cay_kasigi: 3, kaynak: 'King Arthur' },
  nisasta: { yemek_kasigi: 8, cay_kasigi: 3, kaynak: 'King Arthur' },
  irmik: { yemek_kasigi: 12, cay_kasigi: 4, kaynak: 'Sektör' },
  
  // ŞEKERLER
  seker: { yemek_kasigi: 12, cay_kasigi: 4, kaynak: 'USDA' },
  pudra_sekeri: { yemek_kasigi: 8, cay_kasigi: 3, kaynak: 'USDA' },
  esmer_seker: { yemek_kasigi: 14, cay_kasigi: 5, kaynak: 'USDA' },
  
  // TUZ VE BAHARATLAR
  tuz: { yemek_kasigi: 18, cay_kasigi: 6, kaynak: 'USDA' },
  karabiber: { yemek_kasigi: 6, cay_kasigi: 2, kaynak: 'USDA' },
  kimyon: { yemek_kasigi: 6, cay_kasigi: 2, kaynak: 'USDA' },
  kekik: { yemek_kasigi: 3, cay_kasigi: 1, kaynak: 'USDA' },
  pul_biber: { yemek_kasigi: 5, cay_kasigi: 1.5, kaynak: 'Sektör' },
  
  // SIVILAR
  sivi_yag: { yemek_kasigi: 14, cay_kasigi: 5, kaynak: 'USDA' },
  bal: { yemek_kasigi: 21, cay_kasigi: 7, kaynak: 'USDA' },
  
  // SOSLAR
  salca: { yemek_kasigi: 16, cay_kasigi: 5, kaynak: 'Sektör' },
  soya_sosu: { yemek_kasigi: 18, cay_kasigi: 6, kaynak: 'USDA' },
  
} as const;

// =============================================
// ET VE BALIK PORSİYON STANDARTLARI
// =============================================

export const ET_PORSIYON = {
  // YETİŞKİN PORSİYONLARI
  kirmizi_et: { porsiyon: 150, kaynak: 'WHO/TSE', aciklama: 'Yetişkin porsiyon' },
  tavuk_gogus: { porsiyon: 150, kaynak: 'WHO/TSE', aciklama: 'Kemiksiz göğüs' },
  tavuk_but: { porsiyon: 200, kaynak: 'WHO/TSE', aciklama: 'Kemikli but' },
  balik_fileto: { porsiyon: 170, kaynak: 'WHO/TSE', aciklama: 'Fileto porsiyon' },
  balik_tam: { porsiyon: 250, kaynak: 'WHO/TSE', aciklama: 'Kemikli tam balık' },
  kiyma: { porsiyon: 120, kaynak: 'TSE', aciklama: 'Köfte/lahmacun porsiyon' },
  
  // ÇOCUK PORSİYONLARI (6-10 yaş)
  cocuk_et: { porsiyon: 90, kaynak: 'WHO', aciklama: '6-10 yaş çocuk porsiyon' },
  cocuk_balik: { porsiyon: 110, kaynak: 'WHO', aciklama: '6-10 yaş çocuk porsiyon' },
  
} as const;

// =============================================
// PİRİNÇ VE MAKARNA PORSİYON STANDARTLARI
// =============================================

export const KARBONHIDRAT_PORSIYON = {
  pirinc_cig: { porsiyon: 60, kaynak: 'TSE', aciklama: 'Çiğ pirinç - 1 porsiyon' },
  pirinc_pismis: { porsiyon: 150, kaynak: 'TSE', aciklama: 'Pişmiş pirinç (2.5x şişme)' },
  bulgur_cig: { porsiyon: 60, kaynak: 'TSE', aciklama: 'Çiğ bulgur - 1 porsiyon' },
  bulgur_pismis: { porsiyon: 180, kaynak: 'TSE', aciklama: 'Pişmiş bulgur (3x şişme)' },
  makarna_cig: { porsiyon: 80, kaynak: 'TSE', aciklama: 'Çiğ makarna - 1 porsiyon' },
  makarna_pismis: { porsiyon: 200, kaynak: 'TSE', aciklama: 'Pişmiş makarna (2.5x şişme)' },
  
} as const;

// =============================================
// DÖNÜŞÜM FONKSİYONLARI
// =============================================

/**
 * Ürün adına göre adet başına gram değerini döndür
 */
export function getAdetGram(urunAdi: string): { gram: number; kaynak: string; aciklama: string } | null {
  const normalizedAd = urunAdi.toLowerCase().trim();
  
  // Direkt eşleşme
  for (const [key, value] of Object.entries(ADET_GRAMAJ)) {
    if (normalizedAd.includes(key.replace(/_/g, ' '))) {
      return value;
    }
  }
  
  // Fuzzy eşleşme
  const keywords: Record<string, keyof typeof ADET_GRAMAJ> = {
    'yumurta': 'yumurta',
    'patates': 'patates',
    'soğan': 'sogan',
    'domates': 'domates',
    'havuç': 'havuc',
    'sarımsak': 'sarimsak_dis',
    'biber': 'biber_dolmalik',
    'patlıcan': 'patlican',
    'kabak': 'kabak',
    'salatalık': 'salatalik',
    'elma': 'elma',
    'muz': 'muz',
    'portakal': 'portakal',
    'limon': 'limon',
    'armut': 'armut',
    'ekmek': 'ekmek_dilim',
    'pide': 'pide',
    'simit': 'simit',
    'poğaça': 'pogaca',
  };
  
  for (const [keyword, key] of Object.entries(keywords)) {
    if (normalizedAd.includes(keyword)) {
      return ADET_GRAMAJ[key];
    }
  }
  
  return null;
}

/**
 * Ürün adına göre sıvı yoğunluğunu döndür
 */
export function getSiviYogunluk(urunAdi: string): { yogunluk: number; kaynak: string; aciklama: string } | null {
  const normalizedAd = urunAdi.toLowerCase().trim();
  
  const keywords: Record<string, keyof typeof SIVI_YOGUNLUK> = {
    'zeytinyağ': 'zeytinyagi',
    'zeytin yağ': 'zeytinyagi',
    'ayçiçek': 'aycicek_yagi',
    'mısır yağ': 'misir_yagi',
    'süt': 'sut',
    'krema': 'krema',
    'yoğurt': 'yogurt',
    'ayran': 'ayran',
    'bal': 'bal',
    'pekmez': 'pekmez',
    'sirke': 'sirke',
    'su': 'su',
  };
  
  for (const [keyword, key] of Object.entries(keywords)) {
    if (normalizedAd.includes(keyword)) {
      return SIVI_YOGUNLUK[key];
    }
  }
  
  return null;
}

/**
 * Birim dönüşümü yap
 * @param miktar - Miktar
 * @param kaynakBirim - Kaynak birim (g, kg, ml, lt, adet)
 * @param hedefBirim - Hedef birim
 * @param urunAdi - Ürün adı (yoğunluk/adet gram için)
 */
export function birimDonustur(
  miktar: number,
  kaynakBirim: string,
  hedefBirim: string,
  urunAdi?: string
): { sonuc: number; aciklama: string } {
  const kb = kaynakBirim.toLowerCase();
  const hb = hedefBirim.toLowerCase();
  
  // Aynı birimler
  if (kb === hb) {
    return { sonuc: miktar, aciklama: 'Aynı birim' };
  }
  
  // Gram ↔ Kilogram
  if ((kb === 'g' || kb === 'gr') && hb === 'kg') {
    return { sonuc: miktar * GRAM_TO_KG, aciklama: `${KG_TO_GRAM}g = 1kg` };
  }
  if (kb === 'kg' && (hb === 'g' || hb === 'gr')) {
    return { sonuc: miktar * KG_TO_GRAM, aciklama: `1kg = ${KG_TO_GRAM}g` };
  }
  
  // Mililitre ↔ Litre
  if (kb === 'ml' && (hb === 'lt' || hb === 'l')) {
    return { sonuc: miktar * ML_TO_LITRE, aciklama: `${LITRE_TO_ML}ml = 1L` };
  }
  if ((kb === 'lt' || kb === 'l') && hb === 'ml') {
    return { sonuc: miktar * LITRE_TO_ML, aciklama: `1L = ${LITRE_TO_ML}ml` };
  }
  
  // Litre ↔ Kilogram (yoğunluk gerekli)
  if ((kb === 'lt' || kb === 'l') && hb === 'kg' && urunAdi) {
    const yogunluk = getSiviYogunluk(urunAdi);
    if (yogunluk) {
      return { 
        sonuc: miktar * yogunluk.yogunluk, 
        aciklama: `1L = ${yogunluk.yogunluk}kg (${yogunluk.kaynak})` 
      };
    }
  }
  
  // Adet ↔ Gram
  if (kb === 'adet' && (hb === 'g' || hb === 'gr') && urunAdi) {
    const gramBilgi = getAdetGram(urunAdi);
    if (gramBilgi) {
      return { 
        sonuc: miktar * gramBilgi.gram, 
        aciklama: `1 adet = ${gramBilgi.gram}g (${gramBilgi.kaynak})` 
      };
    }
  }
  
  if ((kb === 'g' || kb === 'gr') && hb === 'adet' && urunAdi) {
    const gramBilgi = getAdetGram(urunAdi);
    if (gramBilgi) {
      return { 
        sonuc: Math.ceil(miktar / gramBilgi.gram), 
        aciklama: `${gramBilgi.gram}g = 1 adet (${gramBilgi.kaynak})` 
      };
    }
  }
  
  return { sonuc: miktar, aciklama: 'Dönüşüm yapılamadı' };
}

/**
 * Ürün için birim bilgisi kartı oluştur
 */
export function getUrunBirimBilgisi(urunAdi: string, birim: string): {
  tip: 'adet' | 'sivi' | 'agirlik' | 'bilinmiyor';
  bilgi: string;
  kaynak: string;
  formul?: string;
} {
  const birimLower = birim.toLowerCase();
  
  // ADET birimli ürünler
  if (birimLower === 'adet' || birimLower === 'ad') {
    const gramBilgi = getAdetGram(urunAdi);
    if (gramBilgi) {
      return {
        tip: 'adet',
        bilgi: `1 adet ≈ ${gramBilgi.gram}g`,
        kaynak: gramBilgi.kaynak,
        formul: gramBilgi.aciklama,
      };
    }
    return {
      tip: 'adet',
      bilgi: `1 adet = ${GRAM_PER_ADET_DEFAULT}g (varsayılan)`,
      kaynak: 'Varsayılan',
      formul: 'USDA büyük boy yumurta standardı',
    };
  }
  
  // SIVI birimli ürünler
  if (birimLower === 'lt' || birimLower === 'l' || birimLower === 'ml') {
    const yogunlukBilgi = getSiviYogunluk(urunAdi);
    if (yogunlukBilgi) {
      return {
        tip: 'sivi',
        bilgi: `1L = ${yogunlukBilgi.yogunluk}kg`,
        kaynak: yogunlukBilgi.kaynak,
        formul: yogunlukBilgi.aciklama,
      };
    }
    return {
      tip: 'sivi',
      bilgi: `1L ≈ ${DEFAULT_OIL_DENSITY}kg (yağ varsayılan)`,
      kaynak: 'Varsayılan',
      formul: 'Yağlar için ortalama yoğunluk',
    };
  }
  
  // AĞIRLIK birimleri
  if (birimLower === 'kg' || birimLower === 'g' || birimLower === 'gr') {
    return {
      tip: 'agirlik',
      bilgi: birimLower === 'kg' ? '1kg = 1000g' : '1000g = 1kg',
      kaynak: 'Metrik',
      formul: 'Standart ağırlık birimi',
    };
  }
  
  return {
    tip: 'bilinmiyor',
    bilgi: 'Birim bilgisi yok',
    kaynak: '-',
  };
}

// =============================================
// MALIYET HESAPLAMA FORMÜLÜ
// =============================================

/**
 * Gıda maliyet yüzdesi hesapla
 * Sağlıklı oran: %28-35
 */
export function gidaMaliyetYuzdesi(
  baslangicStok: number,
  alimlar: number,
  bitisStok: number,
  satisGeliri: number
): { yuzde: number; durum: 'dusuk' | 'normal' | 'yuksek' } {
  if (satisGeliri <= 0) return { yuzde: 0, durum: 'dusuk' };
  
  const maliyet = baslangicStok + alimlar - bitisStok;
  const yuzde = (maliyet / satisGeliri) * 100;
  
  let durum: 'dusuk' | 'normal' | 'yuksek' = 'normal';
  if (yuzde < 28) durum = 'dusuk';
  else if (yuzde > 35) durum = 'yuksek';
  
  return { yuzde, durum };
}

/**
 * Porsiyon maliyeti hesapla
 */
export function porsiyonMaliyeti(
  toplamMalzemeMaliyeti: number,
  porsiyonSayisi: number
): number {
  if (porsiyonSayisi <= 0) return 0;
  return toplamMalzemeMaliyeti / porsiyonSayisi;
}

/**
 * Satış fiyatı önerisi (markup ile)
 * @param maliyet - Porsiyon maliyeti
 * @param hedefYuzde - Hedef gıda maliyet yüzdesi (varsayılan %30)
 */
export function satisFiyatiOnerisi(maliyet: number, hedefYuzde: number = 30): number {
  if (hedefYuzde <= 0) return maliyet;
  return maliyet / (hedefYuzde / 100);
}

// =============================================
// DOĞRULAMA VE KONTROL FONKSİYONLARI
// =============================================

/**
 * Birim maliyet hesapla - TÜM SİSTEM BU FONKSİYONU KULLANMALI
 * @param miktar - Reçetedeki miktar
 * @param birim - Reçetedeki birim (g, kg, ml, lt, adet)
 * @param fiyat - Ürünün birim fiyatı (genellikle /kg veya /lt)
 * @param fiyatBirimi - Fiyatın birimi (kg, lt, adet)
 * @param urunAdi - Ürün adı (adet/sıvı dönüşümü için)
 */
export function hesaplaMalzemeMaliyeti(
  miktar: number,
  birim: string,
  fiyat: number,
  fiyatBirimi: string,
  urunAdi?: string
): { maliyet: number; aciklama: string; carpan: number } {
  if (!miktar || !fiyat) {
    return { maliyet: 0, aciklama: 'Miktar veya fiyat eksik', carpan: 0 };
  }

  const birimLower = birim.toLowerCase();
  const fiyatBirimLower = fiyatBirimi.toLowerCase();
  
  let carpan = 1;
  let aciklama = '';

  // ADET birimli malzeme, fiyat /kg ise
  if ((birimLower === 'adet' || birimLower === 'ad') && fiyatBirimLower === 'kg') {
    const gramBilgi = urunAdi ? getAdetGram(urunAdi) : null;
    const gramPerAdet = gramBilgi?.gram || GRAM_PER_ADET_DEFAULT;
    carpan = gramPerAdet * GRAM_TO_KG; // adet → kg
    aciklama = `${gramPerAdet}g/adet × ${GRAM_TO_KG} = ${carpan.toFixed(4)} kg/adet`;
  }
  // GR birimli malzeme, fiyat /kg ise
  else if ((birimLower === 'g' || birimLower === 'gr') && fiyatBirimLower === 'kg') {
    carpan = GRAM_TO_KG;
    aciklama = `1g = ${GRAM_TO_KG}kg`;
  }
  // ML birimli malzeme, fiyat /kg veya /lt ise
  else if (birimLower === 'ml') {
    if (fiyatBirimLower === 'lt' || fiyatBirimLower === 'l') {
      carpan = ML_TO_LITRE;
      aciklama = `1ml = ${ML_TO_LITRE}L`;
    } else if (fiyatBirimLower === 'kg') {
      // ml → L → kg (yoğunluk ile)
      const yogunluk = urunAdi ? getSiviYogunluk(urunAdi) : null;
      const density = yogunluk?.yogunluk || DEFAULT_OIL_DENSITY;
      carpan = ML_TO_LITRE * density;
      aciklama = `1ml = ${ML_TO_LITRE}L × ${density}kg/L = ${carpan.toFixed(5)}kg`;
    }
  }
  // LT birimli malzeme, fiyat /kg ise
  else if ((birimLower === 'lt' || birimLower === 'l') && fiyatBirimLower === 'kg') {
    const yogunluk = urunAdi ? getSiviYogunluk(urunAdi) : null;
    const density = yogunluk?.yogunluk || DEFAULT_OIL_DENSITY;
    carpan = density;
    aciklama = `1L = ${density}kg`;
  }
  // KG birimli malzeme, fiyat /kg ise (aynı birim)
  else if (birimLower === 'kg' && fiyatBirimLower === 'kg') {
    carpan = 1;
    aciklama = '1kg = 1kg';
  }
  // ADET birimli malzeme, fiyat /adet ise (aynı birim)
  else if ((birimLower === 'adet' || birimLower === 'ad') && fiyatBirimLower === 'adet') {
    carpan = 1;
    aciklama = '1adet = 1adet';
  }
  // LT birimli, fiyat /lt ise (aynı birim)
  else if ((birimLower === 'lt' || birimLower === 'l') && (fiyatBirimLower === 'lt' || fiyatBirimLower === 'l')) {
    carpan = 1;
    aciklama = '1L = 1L';
  }
  // Bilinmeyen kombinasyon
  else {
    carpan = 1;
    aciklama = `Bilinmeyen dönüşüm: ${birim} → ${fiyatBirimi}`;
  }

  const maliyet = miktar * carpan * fiyat;
  
  return { maliyet, aciklama, carpan };
}

/**
 * Sabit değerlerin tutarlılığını doğrula
 * Development/test ortamında çalıştırılmalı
 */
export function dogrulamaKontrol(): {
  basarili: boolean;
  hatalar: string[];
  uyarilar: string[];
} {
  const hatalar: string[] = [];
  const uyarilar: string[] = [];

  // ADET_GRAMAJ kontrolü
  if (ADET_GRAMAJ.yumurta.gram !== GRAM_PER_ADET_DEFAULT) {
    hatalar.push(`ADET_GRAMAJ.yumurta.gram (${ADET_GRAMAJ.yumurta.gram}) !== GRAM_PER_ADET_DEFAULT (${GRAM_PER_ADET_DEFAULT})`);
  }

  // SIVI_YOGUNLUK kontrolü
  if (SIVI_YOGUNLUK.zeytinyagi.yogunluk !== ZEYTINYAGI_DENSITY) {
    hatalar.push(`SIVI_YOGUNLUK.zeytinyagi.yogunluk (${SIVI_YOGUNLUK.zeytinyagi.yogunluk}) !== ZEYTINYAGI_DENSITY (${ZEYTINYAGI_DENSITY})`);
  }
  
  if (SIVI_YOGUNLUK.aycicek_yagi.yogunluk !== DEFAULT_OIL_DENSITY) {
    uyarilar.push(`SIVI_YOGUNLUK.aycicek_yagi.yogunluk (${SIVI_YOGUNLUK.aycicek_yagi.yogunluk}) !== DEFAULT_OIL_DENSITY (${DEFAULT_OIL_DENSITY})`);
  }

  if (SIVI_YOGUNLUK.sut.yogunluk !== SUT_DENSITY) {
    hatalar.push(`SIVI_YOGUNLUK.sut.yogunluk (${SIVI_YOGUNLUK.sut.yogunluk}) !== SUT_DENSITY (${SUT_DENSITY})`);
  }

  // Dönüşüm çarpanları kontrolü
  if (GRAM_TO_KG !== 1 / KG_TO_GRAM) {
    hatalar.push(`GRAM_TO_KG (${GRAM_TO_KG}) !== 1/KG_TO_GRAM (${1/KG_TO_GRAM})`);
  }

  if (ML_TO_LITRE !== 1 / LITRE_TO_ML) {
    hatalar.push(`ML_TO_LITRE (${ML_TO_LITRE}) !== 1/LITRE_TO_ML (${1/LITRE_TO_ML})`);
  }

  return {
    basarili: hatalar.length === 0,
    hatalar,
    uyarilar,
  };
}

/**
 * Tüm sabitleri JSON olarak döndür (backend senkronizasyonu için)
 */
export function getAllConstants() {
  return {
    // Global sabitler
    GRAM_PER_ADET_DEFAULT,
    DEFAULT_OIL_DENSITY,
    ZEYTINYAGI_DENSITY,
    SUT_DENSITY,
    GRAM_TO_KG,
    KG_TO_GRAM,
    ML_TO_LITRE,
    LITRE_TO_ML,
    DEFAULT_PORSIYON_GRAM,
    // Detaylı tablolar
    ADET_GRAMAJ,
    SIVI_YOGUNLUK,
    KASIK_GRAMAJ,
    ET_PORSIYON,
    KARBONHIDRAT_PORSIYON,
  };
}
