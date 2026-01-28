/**
 * Stok Modülü Tip Tanımları
 * Tüm stok modülü bileşenlerinde kullanılan interface'ler
 */

// Stok kartı tipi
export interface StokItem {
  id: number;
  kod: string;
  ad: string;
  kategori: string;
  kategori_id?: number;
  birim: string;
  ana_birim_id?: number;
  toplam_stok: number;
  rezerve_stok?: number;
  kullanilabilir_stok?: number;
  min_stok: number;
  max_stok: number;
  kritik_stok: number;
  son_alis_fiyat: number;
  stok_deger?: number;
  tedarikci?: string;
  durum: 'normal' | 'dusuk' | 'kritik' | 'fazla' | 'tukendi';
  depo_durumlari?: DepoStok[];
}

// Depo stok durumu
export interface DepoStok {
  depo_id: number;
  depo_kod: string;
  depo_ad: string;
  miktar: number;
  rezerve_miktar?: number;
  kullanilabilir?: number;
  lokasyon_kodu?: string;
}

// Depo tipi
export interface Depo {
  id: number;
  kod: string;
  ad: string;
  tip: string;
  tur?: string;
  lokasyon?: string;
  adres?: string;
  sorumlu_kisi?: string;
  telefon?: string;
  email?: string;
  yetkili?: string;
  kapasite_m3?: number;
  urun_sayisi?: number;
  toplam_deger?: number;
  kritik_urun?: number;
  aktif: boolean;
}

// Kategori tipi
export interface Kategori {
  id: number;
  kod: string;
  ad: string;
  ust_kategori_id?: number;
  renk?: string;
}

// Birim tipi
export interface Birim {
  id: number;
  kod: string;
  ad: string;
  kisa_ad: string;
  tip: string;
}

// Lokasyon tipi
export interface Lokasyon {
  id: number;
  ad: string;
  kod?: string;
  tur?: string;
  urun_sayisi?: number;
  depo_id: number;
}

// Stok hareketi tipi
export interface StokHareket {
  id: number;
  hareket_tipi: 'GIRIS' | 'CIKIS' | 'TRANSFER';
  hareket_yonu: '+' | '-';
  stok_kart_id?: number;
  stok_ad?: string;
  miktar: number;
  birim?: string;
  giris_depo_ad?: string;
  cikis_depo_ad?: string;
  belge_no?: string;
  aciklama?: string;
  created_at: string;
}

// Fatura tipi
export interface Fatura {
  ettn: string;
  invoice_date: string;
  sender_name: string;
  payable_amount: string;
  stok_islendi: boolean;
  [key: string]: any;
}

// ===== FORM TİPLERİ =====

// Transfer formu
export interface TransferForm {
  stok_kart_id: number;
  urun_id: number;
  kaynak_depo_id: number;
  hedef_depo_id: number;
  miktar: number;
  birim: string;
  belge_no: string;
  aciklama: string;
}

// Depo formu
export interface DepoForm {
  ad: string;
  kod: string;
  tur: string;
  adres: string;
  telefon: string;
  email: string;
  yetkili: string;
  kapasite_m3: number;
}

// Yeni ürün formu
export interface UrunForm {
  kod: string;
  ad: string;
  kategori_id: string;
  ana_birim_id: string;
  barkod: string;
  min_stok: number;
  max_stok: number;
  son_alis_fiyat: number;
  kdv_orani: number;
  aciklama: string;
}

// Stok giriş formu
export interface StokGirisForm {
  stok_kart_id: number | null;
  urun_id: number | null;
  depo_id: number | null;
  miktar: number;
  birim: string;
  birim_fiyat: number;
  giris_tipi: string;
  aciklama: string;
}

// Stok çıkış formu
export interface StokCikisForm {
  stok_kart_id: number | null;
  urun_id: number | null;
  depo_id: number | null;
  miktar: number;
  birim: string;
  cikis_tipi: string;
  aciklama: string;
}

// ===== FORM VARSAYILAN DEĞERLERİ =====

export const DEFAULT_TRANSFER_FORM: TransferForm = {
  stok_kart_id: 0,
  urun_id: 0,
  kaynak_depo_id: 0,
  hedef_depo_id: 0,
  miktar: 0,
  birim: 'kg',
  belge_no: '',
  aciklama: '',
};

export const DEFAULT_DEPO_FORM: DepoForm = {
  ad: '',
  kod: '',
  tur: 'genel',
  adres: '',
  telefon: '',
  email: '',
  yetkili: '',
  kapasite_m3: 0,
};

export const DEFAULT_URUN_FORM: UrunForm = {
  kod: '',
  ad: '',
  kategori_id: '',
  ana_birim_id: '',
  barkod: '',
  min_stok: 0,
  max_stok: 0,
  son_alis_fiyat: 0,
  kdv_orani: 18,
  aciklama: '',
};

export const DEFAULT_GIRIS_FORM: StokGirisForm = {
  stok_kart_id: null,
  urun_id: null,
  depo_id: null,
  miktar: 0,
  birim: 'kg',
  birim_fiyat: 0,
  giris_tipi: 'SATIN_ALMA',
  aciklama: '',
};

export const DEFAULT_CIKIS_FORM: StokCikisForm = {
  stok_kart_id: null,
  urun_id: null,
  depo_id: null,
  miktar: 0,
  birim: 'kg',
  cikis_tipi: 'TUKETIM',
  aciklama: '',
};

// ===== SABIT LİSTELER =====

export const GIRIS_TIPLERI = [
  { value: 'SATIN_ALMA', label: 'Satın Alma' },
  { value: 'URETIM', label: 'Üretim' },
  { value: 'TRANSFER', label: 'Transfer Girişi' },
  { value: 'SAYIM_FAZLASI', label: 'Sayım Fazlası' },
  { value: 'DIGER', label: 'Diğer' },
];

export const CIKIS_TIPLERI = [
  { value: 'TUKETIM', label: 'Tüketim (Mutfak Kullanımı)' },
  { value: 'FIRE', label: 'Fire (Bozulma/Çürüme)' },
  { value: 'IADE', label: 'İade (Tedarikçiye)' },
  { value: 'DIGER', label: 'Diğer' },
];

export const DEPO_TURLERI = [
  { value: 'genel', label: 'Genel Depo' },
  { value: 'soguk', label: 'Soğuk Hava Deposu' },
  { value: 'kuru', label: 'Kuru Gıda Deposu' },
  { value: 'sebze', label: 'Sebze/Meyve Deposu' },
];
