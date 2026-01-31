/**
 * Faturalar Modülü - Tip Tanımları
 *
 * Bu dosya faturalar modülündeki tüm tip tanımlarını içerir.
 * Tek kaynak prensibi ile tüm bileşenler bu tipleri kullanır.
 */

// === FATURA DURUM TİPLERİ ===

export type FaturaDurum = 'taslak' | 'gonderildi' | 'odendi' | 'gecikti' | 'iptal';
export type FaturaTip = 'satis' | 'alis';
export type FaturaKaynak = 'manuel' | 'uyumsoft';

// === FATURA KALEM ===

export interface FaturaKalem {
  id: string;
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  kdvOrani: number;
  tutar: number;
}

// === MANUEL FATURA ===

export interface Fatura {
  id: string;
  tip: FaturaTip;
  seri: string;
  no: string;
  cariId: string;
  cariUnvan: string;
  tarih: string;
  vadeTarihi: string;
  kalemler: FaturaKalem[];
  araToplam: number;
  kdvToplam: number;
  genelToplam: number;
  durum: FaturaDurum;
  notlar: string;
  createdAt: string;
  // Uyumsoft faturaları için ek alanlar
  ettn?: string;
  gonderenVkn?: string;
  gonderenEmail?: string;
  kaynak?: FaturaKaynak;
}

// === UYUMSOFT FATURA ===

export interface UyumsoftFatura {
  faturaNo: string;
  ettn: string;
  faturaTarihi: string;
  olusturmaTarihi: string;
  gonderenVkn: string;
  gonderenUnvan: string;
  gonderenEmail?: string;
  odenecekTutar: number;
  vergilerHaricTutar: number;
  kdvTutari: number;
  paraBirimi: string;
  durum: string;
  faturaTipi: string;
  isNew?: boolean;
  isSeen?: boolean;
  stokIslendi?: boolean;
  stokIslemTarihi?: string;
  // Kalem eşleştirme durumu
  eslesmeOrani?: number; // 0-100 arası yüzde
  eslesmisKalem?: number;
  toplamKalem?: number;
}

// === UYUMSOFT BAĞLANTI DURUMU ===

export interface UyumsoftStatus {
  connected: boolean;
  hasCredentials: boolean;
  lastSync: string | null;
  syncCount: number;
}

export interface UyumsoftCredentials {
  username: string;
  password: string;
  remember: boolean;
}

// === CARİ (MÜŞTERİ/TEDARİKÇİ) - domain'den merkezi tip ===
export type { Cari } from '@/types/domain';

// === FORM TİPLERİ ===

export interface FaturaFormData {
  tip: FaturaTip;
  seri: string;
  no: string;
  cariId: string;
  cariUnvan: string;
  tarih: Date;
  vadeTarihi: Date;
  durum: FaturaDurum;
  notlar: string;
}

export interface FaturaFormErrors {
  cari?: string;
  seri?: string;
  vade?: string;
  tarih?: string;
  kalemler?: string;
  toplam?: string;
}

// === SABİTLER ===

export const BIRIMLER = [
  'Adet',
  'Kg',
  'Lt',
  'Metre',
  'Paket',
  'Koli',
  'Porsiyon',
  'Gün',
  'Ay',
  'Saat',
  'Parti',
] as const;

export const KDV_ORANLARI = [0, 1, 10, 20] as const;

export const DURUM_LABELS: Record<FaturaDurum, string> = {
  taslak: 'Taslak',
  gonderildi: 'Gönderildi',
  odendi: 'Ödendi',
  gecikti: 'Gecikti',
  iptal: 'İptal',
};

export const DURUM_COLORS: Record<FaturaDurum, string> = {
  taslak: 'gray',
  gonderildi: 'orange',
  odendi: 'green',
  gecikti: 'red',
  iptal: 'dark',
};

// === VARSAYILAN DEĞERLER ===

export const DEFAULT_FORM_DATA: FaturaFormData = {
  tip: 'satis',
  seri: 'A',
  no: '',
  cariId: '',
  cariUnvan: '',
  tarih: new Date(),
  vadeTarihi: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 gün sonra
  durum: 'taslak',
  notlar: '',
};

export const DEFAULT_KALEM: Omit<FaturaKalem, 'id'> = {
  aciklama: '',
  miktar: 1,
  birim: 'Adet',
  birimFiyat: 0,
  kdvOrani: 10,
  tutar: 0,
};

// === YARDIMCI FONKSİYONLAR ===

/**
 * Yeni bir kalem oluşturur
 */
export function createKalem(overrides?: Partial<FaturaKalem>): FaturaKalem {
  return {
    id: Date.now().toString(),
    ...DEFAULT_KALEM,
    ...overrides,
  };
}

/**
 * Kalem tutarını hesaplar
 */
export function hesaplaKalemTutar(kalem: FaturaKalem): number {
  return kalem.miktar * kalem.birimFiyat;
}

/**
 * Kalem KDV tutarını hesaplar
 */
export function hesaplaKalemKdv(kalem: FaturaKalem): number {
  const tutar = hesaplaKalemTutar(kalem);
  return tutar * (kalem.kdvOrani / 100);
}

/**
 * Kalan gün hesaplar (vade tarihi için)
 */
export function getKalanGun(vadeTarihi: string): number {
  const vade = new Date(vadeTarihi);
  const bugun = new Date();
  const fark = vade.getTime() - bugun.getTime();
  return Math.ceil(fark / (1000 * 60 * 60 * 24));
}

/**
 * Durum badge'i için renk ve etiket döndürür
 */
export function getDurumBadgeProps(durum: FaturaDurum): { color: string; label: string } {
  return {
    color: DURUM_COLORS[durum],
    label: DURUM_LABELS[durum],
  };
}
