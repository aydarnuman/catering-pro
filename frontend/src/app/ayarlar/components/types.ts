import {
  IconBell,
  IconBuilding,
  IconKey,
  IconPalette,
  IconRobot,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';

// ─── User ────────────────────────────────────────────────
export interface UserInfo {
  id: number;
  name: string;
  email: string;
  role?: string;
  user_type?: 'super_admin' | 'admin' | 'user';
  created_at?: string;
}

// ─── Preferences ─────────────────────────────────────────
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  accentColor: string;
  compactMode: boolean;
  fontSize: number;
  notifications: {
    email: boolean;
    browser: boolean;
    tenderUpdates: boolean;
    invoiceReminders: boolean;
    weeklyReport: boolean;
  };
  language: string;
  dateFormat: string;
  currency: string;
}

export const defaultPreferences: UserPreferences = {
  theme: 'auto',
  accentColor: 'blue',
  compactMode: false,
  fontSize: 14,
  notifications: {
    email: true,
    browser: true,
    tenderUpdates: true,
    invoiceReminders: true,
    weeklyReport: false,
  },
  language: 'tr',
  dateFormat: 'DD.MM.YYYY',
  currency: 'TRY',
};

export const colorOptions = [
  { color: '#228be6', name: 'Mavi', value: 'blue' },
  { color: '#40c057', name: 'Yeşil', value: 'green' },
  { color: '#7950f2', name: 'Mor', value: 'violet' },
  { color: '#fd7e14', name: 'Turuncu', value: 'orange' },
  { color: '#e64980', name: 'Pembe', value: 'pink' },
  { color: '#15aabf', name: 'Cyan', value: 'cyan' },
  { color: '#fab005', name: 'Sarı', value: 'yellow' },
  { color: '#fa5252', name: 'Kırmızı', value: 'red' },
];

// ─── Firma ───────────────────────────────────────────────
export interface FirmaBilgileri {
  id: number;
  unvan: string;
  kisa_ad?: string;
  vergi_dairesi: string;
  vergi_no: string;
  ticaret_sicil_no?: string;
  mersis_no?: string;
  adres: string;
  il?: string;
  ilce?: string;
  posta_kodu?: string;
  telefon: string;
  fax?: string;
  email: string;
  web_sitesi?: string;
  // Yetkili 1
  yetkili_adi: string;
  yetkili_unvani: string;
  yetkili_tc?: string;
  yetkili_telefon?: string;
  yetkili_email?: string;
  imza_yetkisi: string;
  // Yetkili 2
  yetkili2_adi?: string;
  yetkili2_unvani?: string;
  yetkili2_tc?: string;
  yetkili2_telefon?: string;
  // Banka 1
  banka_adi?: string;
  banka_sube?: string;
  iban?: string;
  hesap_no?: string;
  // Banka 2
  banka2_adi?: string;
  banka2_sube?: string;
  banka2_iban?: string;
  // SGK ve Resmi
  sgk_sicil_no?: string;
  kep_adresi?: string;
  nace_kodu?: string;
  // Kapasite
  gunluk_uretim_kapasitesi?: number;
  personel_kapasitesi?: number;
  // Görsel
  logo_url?: string;
  kase_imza_url?: string;
  // Sertifikalar
  haccp_sertifika_url?: string;
  haccp_sertifika_tarih?: string;
  tse_belgesi_url?: string;
  tse_belgesi_tarih?: string;
  halal_sertifika_url?: string;
  halal_sertifika_tarih?: string;
  // Mevcut Belgeler
  vergi_levhasi_url?: string;
  vergi_levhasi_tarih?: string;
  sicil_gazetesi_url?: string;
  sicil_gazetesi_tarih?: string;
  imza_sirküleri_url?: string;
  imza_sirküleri_tarih?: string;
  faaliyet_belgesi_url?: string;
  faaliyet_belgesi_tarih?: string;
  iso_sertifika_url?: string;
  iso_sertifika_tarih?: string;
  ek_belgeler?: Array<{ ad: string; url: string; tarih?: string }>;
  // Referanslar
  referanslar?: Array<{ kurum: string; bedel: number; yil: number; aciklama?: string }>;
  is_deneyim_belgeleri?: Array<{ ad: string; url: string; bedel: number; tarih?: string }>;
  // Meta
  varsayilan: boolean;
  aktif: boolean;
  notlar?: string;
  created_at?: string;
  updated_at?: string;
}

export const emptyFirma: Partial<FirmaBilgileri> = {
  unvan: '',
  kisa_ad: '',
  vergi_dairesi: '',
  vergi_no: '',
  ticaret_sicil_no: '',
  mersis_no: '',
  adres: '',
  il: '',
  ilce: '',
  telefon: '',
  fax: '',
  email: '',
  web_sitesi: '',
  yetkili_adi: '',
  yetkili_unvani: '',
  yetkili_tc: '',
  yetkili_telefon: '',
  yetkili_email: '',
  imza_yetkisi: '',
  banka_adi: '',
  banka_sube: '',
  iban: '',
  varsayilan: false,
  aktif: true,
  notlar: '',
};

// ─── Proje ───────────────────────────────────────────────
export interface Proje {
  id: number;
  kod: string;
  ad: string;
  firma_id?: number;
  firma_unvani?: string;
  musteri: string;
  kurum?: string;
  lokasyon?: string;
  adres: string;
  il?: string;
  ilce?: string;
  sozlesme_no?: string;
  sozlesme_tarihi?: string;
  sozlesme_bitis_tarihi?: string;
  sozlesme_bedeli?: number;
  teminat_tutari?: number;
  teminat_iade_tarihi?: string;
  gunluk_kisi_sayisi?: number;
  ogun_sayisi?: number;
  toplam_ogun?: number;
  gunluk_maliyet_hedef?: number;
  fatura_unvani?: string;
  fatura_vergi_no?: string;
  fatura_vergi_dairesi?: string;
  fatura_adresi?: string;
  fatura_kesim_gunu?: number;
  kdv_orani?: number;
  hakedis_tipi?: string;
  aylik_hakedis?: number;
  hakedis_gun?: number;
  hakedis_kesinti_orani?: number;
  yetkili: string;
  yetkili_unvan?: string;
  telefon: string;
  email?: string;
  proje_tipi?: string;
  kategori?: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  butce: number;
  durum: string;
  renk?: string;
  aktif?: boolean;
  aciklama: string;
  notlar?: string;
  personel_sayisi?: number;
  toplam_maas?: number;
}

// ─── Firma Döküman ───────────────────────────────────────
export interface FirmaDokuman {
  id: number;
  firma_id: number;
  belge_tipi: string;
  belge_kategori: string;
  dosya_adi: string;
  dosya_url: string;
  dosya_boyutu?: number;
  mime_type?: string;
  belge_no?: string;
  verilis_tarihi?: string;
  gecerlilik_tarihi?: string;
  veren_kurum?: string;
  aciklama?: string;
  ai_analiz_yapildi: boolean;
  ai_cikartilan_veriler?: Record<string, string | number | null>;
  ai_guven_skoru?: number;
  onaylanmis: boolean;
  aktif: boolean;
  created_at: string;
}

// ─── AI Analiz ───────────────────────────────────────────
export interface AIAnalysisData {
  guven_skoru?: number;
  [key: string]: string | number | null | undefined;
}

export interface AIAnalysisResult {
  data?: AIAnalysisData;
  [key: string]: unknown;
}

export interface BelgeAnalysisResult {
  analiz?: {
    success: boolean;
    belgeTipiAd?: string;
    data?: AIAnalysisData;
  };
  [key: string]: unknown;
}

// ─── Belge Sabitleri ─────────────────────────────────────
export const belgeKategorileri = {
  kurumsal: { label: 'Kurumsal Belgeler', icon: IconBuilding, color: 'blue' },
  yetki: { label: 'Yetki Belgeleri', icon: IconKey, color: 'violet' },
  mali: { label: 'Mali Belgeler', icon: IconKey, color: 'green' },
  sertifika: { label: 'Sertifikalar', icon: IconKey, color: 'orange' },
  referans: { label: 'Referanslar', icon: IconKey, color: 'pink' },
  diger: { label: 'Diğer Belgeler', icon: IconKey, color: 'gray' },
} as const;

export const belgeTipleriListe = [
  { value: 'auto', label: '🤖 Otomatik Algıla (AI)', kategori: 'all' },
  { value: 'vergi_levhasi', label: 'Vergi Levhası', kategori: 'kurumsal' },
  { value: 'sicil_gazetesi', label: 'Ticaret Sicil Gazetesi', kategori: 'kurumsal' },
  { value: 'imza_sirküleri', label: 'İmza Sirküleri', kategori: 'kurumsal' },
  { value: 'faaliyet_belgesi', label: 'Faaliyet/Oda Kayıt Belgesi', kategori: 'kurumsal' },
  { value: 'kapasite_raporu', label: 'Kapasite Raporu', kategori: 'kurumsal' },
  { value: 'vekaletname', label: 'Vekaletname', kategori: 'yetki' },
  { value: 'yetki_belgesi', label: 'Yetki Belgesi', kategori: 'yetki' },
  { value: 'temsil_ilmuhaberi', label: 'Temsil İlmühaberi', kategori: 'yetki' },
  { value: 'sgk_borcu_yoktur', label: 'SGK Borcu Yoktur', kategori: 'mali' },
  { value: 'vergi_borcu_yoktur', label: 'Vergi Borcu Yoktur', kategori: 'mali' },
  { value: 'bilanco', label: 'Bilanço', kategori: 'mali' },
  { value: 'iso_sertifika', label: 'ISO Sertifikası', kategori: 'sertifika' },
  { value: 'haccp_sertifika', label: 'HACCP Sertifikası', kategori: 'sertifika' },
  { value: 'tse_sertifika', label: 'TSE Belgesi', kategori: 'sertifika' },
  { value: 'gida_uretim_izni', label: 'Gıda Üretim İzin Belgesi', kategori: 'sertifika' },
  { value: 'is_deneyim_belgesi', label: 'İş Deneyim Belgesi', kategori: 'referans' },
  { value: 'referans_mektubu', label: 'Referans Mektubu', kategori: 'referans' },
];

export const belgeTipleri = [
  { value: 'vergi_levhasi', label: 'Vergi Levhası' },
  { value: 'sicil_gazetesi', label: 'Ticaret Sicil Gazetesi' },
  { value: 'imza_sirküleri', label: 'İmza Sirküleri' },
  { value: 'faaliyet_belgesi', label: 'Faaliyet Belgesi' },
  { value: 'iso_sertifika', label: 'ISO Sertifikası' },
];

// ─── Menü ────────────────────────────────────────────────
export const menuItems = [
  { id: 'profil', label: 'Profil', icon: IconUser, color: 'blue', description: 'Hesap bilgileri' },
  {
    id: 'firma',
    label: 'Firma Bilgileri',
    icon: IconBuilding,
    color: 'teal',
    description: 'Şirket bilgileri',
  },
  {
    id: 'gorunum',
    label: 'Görünüm',
    icon: IconPalette,
    color: 'pink',
    description: 'Tema ve arayüz',
  },
  {
    id: 'bildirimler',
    label: 'Bildirimler',
    icon: IconBell,
    color: 'orange',
    description: 'Uyarı tercihleri',
  },
  {
    id: 'ai',
    label: 'AI Ayarları',
    icon: IconRobot,
    color: 'violet',
    description: 'Yapay zeka & Ajanlar',
    href: '/ayarlar/ai',
  },
  {
    id: 'sistem',
    label: 'Sistem',
    icon: IconSettings,
    color: 'gray',
    description: 'Genel tercihler',
  },
  {
    id: 'kisayollar',
    label: 'Kısayollar',
    icon: IconKey,
    color: 'green',
    description: 'Klavye kısayolları',
  },
];
