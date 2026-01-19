// Teklif Maliyet Kalemleri Tipleri - v2

// ========== MALZEME ==========
export interface OgunDetay {
  ad: string;
  aktif: boolean;
  kisiSayisi: number;
  gunSayisi: number;
  kisiBasiMaliyet: number;
}

export interface MalzemeMaliyet {
  hesaplamaYontemi: 'toplam' | 'ogun_bazli';
  // Toplam hesaplama için
  gunlukKisi: number;
  gunSayisi: number;
  ogunSayisi: number;
  kisiBasiMaliyet: number;
  // Öğün bazlı hesaplama için
  ogunler: OgunDetay[];
}

// ========== PERSONEL ==========
export interface PozisyonKalem {
  pozisyon: string;
  adet: number;
  brutMaas: number;
}

export interface PersonelMaliyet {
  pozisyonlar: PozisyonKalem[];
  aySayisi: number;
  sgkOrani: number; // %22.5 varsayılan
}

// Hazır pozisyon şablonları
export const POZISYON_SABLONLARI = [
  { pozisyon: 'Aşçıbaşı', varsayilanMaas: 85000 },
  { pozisyon: 'Aşçı', varsayilanMaas: 50000 },
  { pozisyon: 'Aşçı Yardımcısı', varsayilanMaas: 35000 },
  { pozisyon: 'Garson', varsayilanMaas: 28000 },
  { pozisyon: 'Bulaşıkçı', varsayilanMaas: 25000 },
  { pozisyon: 'Temizlikçi', varsayilanMaas: 25000 },
  { pozisyon: 'Şoför', varsayilanMaas: 35000 },
  { pozisyon: 'Depocu', varsayilanMaas: 30000 },
  { pozisyon: 'Kasap', varsayilanMaas: 45000 },
  { pozisyon: 'Pastacı', varsayilanMaas: 40000 },
  { pozisyon: 'Mutfak Şefi', varsayilanMaas: 70000 },
  { pozisyon: 'Diyetisyen', varsayilanMaas: 60000 },
  { pozisyon: 'Kalite Kontrol', varsayilanMaas: 45000 },
  { pozisyon: 'Diğer', varsayilanMaas: 30000 },
];

// ========== NAKLİYE ==========
export interface AracKalem {
  tip: string;
  adet: number;
  aylikKira: number;
  aylikKm: number;
  yakitTuketimi: number; // lt/100km
}

export interface NakliyeMaliyet {
  araclar: AracKalem[];
  yakitFiyati: number; // ₺/lt
  aySayisi: number;
}

export const ARAC_TIPLERI = [
  { tip: 'Soğutuculu Kamyonet', varsayilanKira: 45000, varsayilanTuketim: 12 },
  { tip: 'Panelvan', varsayilanKira: 35000, varsayilanTuketim: 10 },
  { tip: 'Kamyon', varsayilanKira: 60000, varsayilanTuketim: 18 },
  { tip: 'Minibüs', varsayilanKira: 40000, varsayilanTuketim: 14 },
  { tip: 'Otomobil', varsayilanKira: 25000, varsayilanTuketim: 8 },
];

// ========== SARF MALZEME ==========
export interface SarfKalem {
  ad: string;
  birim: string; // ₺/kişi/gün veya ₺/ay
  miktar: number;
}

export interface SarfMalzemeMaliyet {
  hesaplamaYontemi: 'toplam' | 'kisi_basi';
  // Toplam için
  aylikTutar: number;
  aySayisi: number;
  // Kişi başı için
  gunlukKisi: number;
  gunSayisi: number;
  kalemler: SarfKalem[];
}

export const SARF_KALEMLERI = [
  { ad: 'Peçete', varsayilanBirim: 0.25 },
  { ad: 'Ambalaj Malzemesi', varsayilanBirim: 0.5 },
  { ad: 'Temizlik Malzemesi', varsayilanBirim: 0.3 },
  { ad: 'Hijyen Malzemesi', varsayilanBirim: 0.2 },
  { ad: 'Tek Kullanımlık', varsayilanBirim: 0.35 },
  { ad: 'Diğer', varsayilanBirim: 0.15 },
];

// ========== EKİPMAN & BAKIM ==========
export interface EkipmanKalem {
  ad: string;
  tip: 'kira' | 'satin_alma';
  adet: number;
  birimFiyat: number; // Kira için aylık, satın alma için tek sefer
}

export interface EkipmanBakimMaliyet {
  ekipmanlar: EkipmanKalem[];
  aylikBakimTutar: number;
  aySayisi: number;
}

export const EKIPMAN_SABLONLARI = [
  { ad: 'Konveksiyonlu Fırın', varsayilanKira: 15000, varsayilanSatin: 250000 },
  { ad: 'Endüstriyel Bulaşık Makinesi', varsayilanKira: 8000, varsayilanSatin: 120000 },
  { ad: 'Soğuk Oda', varsayilanKira: 12000, varsayilanSatin: 180000 },
  { ad: 'Derin Dondurucu', varsayilanKira: 5000, varsayilanSatin: 80000 },
  { ad: 'Benmari', varsayilanKira: 3000, varsayilanSatin: 45000 },
  { ad: 'Fritöz', varsayilanKira: 2500, varsayilanSatin: 35000 },
  { ad: 'Et Kıyma Makinesi', varsayilanKira: 2000, varsayilanSatin: 30000 },
  { ad: 'Sebze Doğrama Makinesi', varsayilanKira: 1500, varsayilanSatin: 25000 },
];

// ========== GENEL GİDERLER ==========
export interface GenelGiderKalem {
  ad: string;
  aylikTutar: number;
}

export interface GenelGiderMaliyet {
  kalemler: GenelGiderKalem[];
  aySayisi: number;
}

export const GENEL_GIDER_KALEMLERI = [
  { ad: 'Kira', varsayilan: 0 },
  { ad: 'Elektrik', varsayilan: 0 },
  { ad: 'Su', varsayilan: 0 },
  { ad: 'Doğalgaz', varsayilan: 0 },
  { ad: 'İnternet/Telefon', varsayilan: 0 },
  { ad: 'Merkez Ofis Payı', varsayilan: 0 },
  { ad: 'Diğer', varsayilan: 0 },
];

// ========== YASAL GİDERLER ==========
export interface YasalGiderKalem {
  ad: string;
  tutar: number;
  aciklama?: string;
}

export interface YasalGiderlerMaliyet {
  sigortalar: YasalGiderKalem[];
  belgeler: YasalGiderKalem[];
  isg: YasalGiderKalem[];
  ihaleGiderleri: YasalGiderKalem[];
}

export const YASAL_GIDER_SABLONLARI = {
  sigortalar: [
    { ad: 'İşveren Sorumluluk Sigortası', varsayilan: 50000 },
    { ad: 'Araç Kasko', varsayilan: 35000 },
    { ad: 'Yangın Sigortası', varsayilan: 20000 },
  ],
  belgeler: [
    { ad: 'Hijyen Sertifikası', varsayilan: 15000 },
    { ad: 'ISO 22000 Belgesi', varsayilan: 25000 },
    { ad: 'TSE Belgesi', varsayilan: 10000 },
    { ad: 'Helal Belgesi', varsayilan: 8000 },
  ],
  isg: [
    { ad: 'İSG Uzmanı (yıllık)', varsayilan: 48000 },
    { ad: 'İSG Ekipmanları', varsayilan: 20000 },
    { ad: 'Yangın Söndürme', varsayilan: 10000 },
  ],
  ihaleGiderleri: [
    { ad: 'Geçici Teminat', varsayilan: 0 },
    { ad: 'Noter/Damga', varsayilan: 5000 },
    { ad: 'İhale Dosya Bedeli', varsayilan: 2000 },
  ],
};

// ========== RİSK PAYI ==========
export interface RiskKategori {
  ad: string;
  aktif: boolean;
  oran: number;
}

export interface RiskPayiMaliyet {
  kategoriler: RiskKategori[];
  manuelOran: number; // Manuel giriş için
  kullanManuel: boolean;
}

export const RISK_KATEGORILERI = [
  { ad: 'Enflasyon Riski', varsayilanOran: 3 },
  { ad: 'Malzeme Fiyat Artışı', varsayilanOran: 2 },
  { ad: 'Kur Riski', varsayilanOran: 1 },
  { ad: 'Beklenmedik Giderler', varsayilanOran: 1 },
  { ad: 'İş Gücü Riski', varsayilanOran: 0.5 },
];

// ========== ANA YAPILAR ==========
export interface MaliyetDetay {
  malzeme: { tutar: number; detay: MalzemeMaliyet };
  personel: { tutar: number; detay: PersonelMaliyet };
  nakliye: { tutar: number; detay: NakliyeMaliyet };
  sarf_malzeme: { tutar: number; detay: SarfMalzemeMaliyet };
  ekipman_bakim: { tutar: number; detay: EkipmanBakimMaliyet };
  genel_gider: { tutar: number; detay: GenelGiderMaliyet };
  yasal_giderler: { tutar: number; detay: YasalGiderlerMaliyet };
  risk_payi: { tutar: number; detay: RiskPayiMaliyet };
}

export interface CetvelKalemi {
  sira: number;
  isKalemi: string;
  birim: string;
  miktar: number;
  birimFiyat: number;
  tutar: number;
}

export interface TeklifData {
  id?: number;
  ihale_id?: number;
  ihale_adi: string;
  ihale_kayit_no?: string;
  maliyet_toplam: number;
  kar_orani: number;
  kar_tutari: number;
  teklif_fiyati: number;
  maliyet_detay: MaliyetDetay;
  birim_fiyat_cetveli: CetvelKalemi[];
  cetvel_toplami: number;
  durum: 'taslak' | 'tamamlandi' | 'gonderildi' | 'kazanildi' | 'kaybedildi';
  notlar?: string;
}

// Maliyet kalemleri listesi
export const MALIYET_KALEMLERI = [
  { key: 'malzeme', label: 'Öğün Maliyeti', icon: '💰' },
  { key: 'personel', label: 'Personel', icon: '👷' },
  { key: 'nakliye', label: 'Nakliye', icon: '🚚' },
  { key: 'sarf_malzeme', label: 'Sarf Malzeme', icon: '🧴' },
  { key: 'ekipman_bakim', label: 'Ekipman & Bakım', icon: '🍽️' },
  { key: 'genel_gider', label: 'Genel Gider', icon: '🏢' },
  { key: 'yasal_giderler', label: 'Yasal Giderler', icon: '📜' },
  { key: 'risk_payi', label: 'Risk Payı', icon: '⚠️' },
] as const;

export type MaliyetKalemKey = (typeof MALIYET_KALEMLERI)[number]['key'];

// Varsayılan öğünler
const DEFAULT_OGUNLER: OgunDetay[] = [
  { ad: 'Kahvaltı', aktif: true, kisiSayisi: 1000, gunSayisi: 365, kisiBasiMaliyet: 12 },
  { ad: 'Öğle Yemeği', aktif: true, kisiSayisi: 1000, gunSayisi: 365, kisiBasiMaliyet: 28 },
  { ad: 'Akşam Yemeği', aktif: true, kisiSayisi: 1000, gunSayisi: 365, kisiBasiMaliyet: 25 },
  { ad: 'Ara Öğün', aktif: false, kisiSayisi: 0, gunSayisi: 0, kisiBasiMaliyet: 8 },
];

// Varsayılan sarf kalemleri
const DEFAULT_SARF_KALEMLERI: SarfKalem[] = [
  { ad: 'Peçete', birim: '₺/kişi/gün', miktar: 0.25 },
  { ad: 'Ambalaj Malzemesi', birim: '₺/kişi/gün', miktar: 0.5 },
  { ad: 'Temizlik Malzemesi', birim: '₺/kişi/gün', miktar: 0.3 },
  { ad: 'Hijyen Malzemesi', birim: '₺/kişi/gün', miktar: 0.2 },
  { ad: 'Diğer', birim: '₺/kişi/gün', miktar: 0.15 },
];

// Varsayılan genel gider kalemleri
const DEFAULT_GENEL_GIDER_KALEMLERI: GenelGiderKalem[] = [
  { ad: 'Kira', aylikTutar: 0 },
  { ad: 'Elektrik', aylikTutar: 0 },
  { ad: 'Su', aylikTutar: 0 },
  { ad: 'Doğalgaz', aylikTutar: 0 },
  { ad: 'İnternet/Telefon', aylikTutar: 0 },
  { ad: 'Diğer', aylikTutar: 0 },
];

// Varsayılan risk kategorileri
const DEFAULT_RISK_KATEGORILERI: RiskKategori[] = [
  { ad: 'Enflasyon Riski', aktif: true, oran: 3 },
  { ad: 'Malzeme Fiyat Artışı', aktif: true, oran: 2 },
  { ad: 'Beklenmedik Giderler', aktif: true, oran: 1 },
  { ad: 'Kur Riski', aktif: false, oran: 0 },
  { ad: 'İş Gücü Riski', aktif: false, oran: 0 },
];

// Varsayılan boş teklif verisi
export const DEFAULT_TEKLIF_DATA: TeklifData = {
  ihale_adi: '',
  maliyet_toplam: 0,
  kar_orani: 12,
  kar_tutari: 0,
  teklif_fiyati: 0,
  maliyet_detay: {
    malzeme: {
      tutar: 0,
      detay: {
        hesaplamaYontemi: 'ogun_bazli',
        gunlukKisi: 0,
        gunSayisi: 0,
        ogunSayisi: 3,
        kisiBasiMaliyet: 0,
        ogunler: DEFAULT_OGUNLER,
      },
    },
    personel: {
      tutar: 0,
      detay: {
        pozisyonlar: [],
        aySayisi: 12,
        sgkOrani: 22.5,
      },
    },
    nakliye: {
      tutar: 0,
      detay: {
        araclar: [],
        yakitFiyati: 42,
        aySayisi: 12,
      },
    },
    sarf_malzeme: {
      tutar: 0,
      detay: {
        hesaplamaYontemi: 'kisi_basi',
        aylikTutar: 0,
        aySayisi: 12,
        gunlukKisi: 1000,
        gunSayisi: 365,
        kalemler: DEFAULT_SARF_KALEMLERI,
      },
    },
    ekipman_bakim: {
      tutar: 0,
      detay: {
        ekipmanlar: [],
        aylikBakimTutar: 0,
        aySayisi: 12,
      },
    },
    genel_gider: {
      tutar: 0,
      detay: {
        kalemler: DEFAULT_GENEL_GIDER_KALEMLERI,
        aySayisi: 12,
      },
    },
    yasal_giderler: {
      tutar: 0,
      detay: {
        sigortalar: [],
        belgeler: [],
        isg: [],
        ihaleGiderleri: [],
      },
    },
    risk_payi: {
      tutar: 0,
      detay: {
        kategoriler: DEFAULT_RISK_KATEGORILERI,
        manuelOran: 5,
        kullanManuel: false,
      },
    },
  },
  birim_fiyat_cetveli: [],
  cetvel_toplami: 0,
  durum: 'taslak',
};
