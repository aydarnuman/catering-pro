/**
 * Yüklenici Kütüphanesi — Tip Tanımları
 * Rakip firma takip ve analiz sistemi
 */

// ─── Ana Yüklenici Tipi ─────────────────────────────────────────

export interface Yuklenici {
  id: number;
  unvan: string;
  kisa_ad: string | null;
  katildigi_ihale_sayisi: number;
  devam_eden_is_sayisi: number;
  tamamlanan_is_sayisi: number;
  toplam_sozlesme_bedeli: number;
  kazanma_orani: number;
  ortalama_indirim_orani: number | null;
  aktif_sehirler: string[];
  son_ihale_tarihi: string | null;
  ihalebul_url: string | null;
  notlar: string | null;
  etiketler: string[];
  puan: number;
  takipte: boolean;
  istihbarat_takibi?: boolean;
  veri_kaynaklari?: string[];
  fesih_sayisi?: number;
  risk_notu?: string | null;
  kik_sikayet_sayisi?: number;
  scraped_at: string | null;
  created_at: string;
  updated_at: string;
  bizim_db_ihale_sayisi?: number;
  aktif_ihale_sayisi?: number;
  // Analiz sayfası verileri
  analiz_verisi?: AnalyzData | null;
  analiz_scraped_at?: string | null;
}

// ─── Analiz Verisi (ihalebul.com /analyze sayfasından) ──────────

export interface AnalyzData {
  scraped_at?: string;
  source_url?: string;
  ozet?: AnalyzOzet;
  yillik_trend?: AnalyzYillikTrend[];
  idareler?: AnalyzIdare[];
  rakipler?: AnalyzRakip[];
  ortak_girisimler?: AnalyzOrtakGirisim[];
  sehirler?: AnalyzSehir[];
  sektorler?: AnalyzSektor[];
  ihale_usulleri?: AnalyzDagilim[];
  ihale_turleri?: AnalyzDagilim[];
  teklif_turleri?: AnalyzDagilim[];
}

export interface AnalyzOzet {
  gecmis_ihale?: number;
  iptal_ihale?: number;
  kik_kararlari?: number;
  devam_eden?: { sayi: number; tutar: number };
  tamamlanan?: { sayi: number; tutar: number };
  is_bitirme_5yil?: { sayi: number; tutar: number };
  toplam_sozlesme?: { sayi: number; tutar: number };
  yillik_ortalama?: { sayi: number; tutar: number };
  ort_tenzilat?: { yuzde: number; tutar: number };
  ort_sozlesme_suresi_gun?: number;
  ilk_sozlesme?: string;
  son_sozlesme?: string;
}

export interface AnalyzYillikTrend {
  yil: number;
  ort_katilimci: number;
  ort_gecerli_teklif: number;
  tenzilat_yuzde: number;
  tenzilat_tutar: number;
  devam_eden: number;
  tamamlanan: number;
  yillik_ortalama: number;
  toplam_sozlesme: number;
}

export interface AnalyzIdare {
  idare_adi: string;
  guncel: number;
  gecmis: number;
  devam_eden: number;
  tamamlanan: number;
  toplam_sozlesme: number;
}

export interface AnalyzRakip {
  rakip_adi: string;
  ihale_sayisi: number;
  toplam_sozlesme: number;
}

export interface AnalyzOrtakGirisim {
  partner_adi: string;
  devam_eden: number;
  tamamlanan: number;
  toplam_sozlesme: number;
}

export interface AnalyzSehir {
  sehir: string;
  guncel: number;
  gecmis: number;
  devam_eden: number;
  tamamlanan: number;
  toplam_sozlesme: number;
}

export interface AnalyzSektor {
  cpv_kodu: string;
  sektor_adi: string;
  guncel: number;
  gecmis: number;
  devam_eden: number;
  tamamlanan: number;
  toplam_sozlesme: number;
}

export interface AnalyzDagilim {
  ad: string;
  guncel: number;
  gecmis: number;
  devam_eden: number;
  tamamlanan: number;
  toplam_sozlesme: number;
}

// ─── İstatistik Tipleri ─────────────────────────────────────────

export interface StatsData {
  genel: {
    toplam_yuklenici: string;
    takipte_olan: string;
    aktif_yuklenici: string;
    toplam_pazar_buyuklugu: string | null;
    ortalama_kazanma_orani: string | null;
    ortalama_indirim: string | null;
  };
  top10: Yuklenici[];
  sehirDagilimi: { sehir: string; yuklenici_sayisi: string; ihale_sayisi: string }[];
}

// ─── Scrape Durumu ──────────────────────────────────────────────

export interface ScrapeStatus {
  running: boolean;
  type: string | null;
  progress: { current: number; total: number; newCount: number; updated: number; errors: number };
  startedAt: string | null;
  lastLog: { time: string; message: string; type: string }[];
  elapsedSeconds: number;
}

// ─── Sıralama Alanları ──────────────────────────────────────────

export type SortField =
  | 'toplam_sozlesme_bedeli'
  | 'kazanma_orani'
  | 'katildigi_ihale_sayisi'
  | 'tamamlanan_is_sayisi'
  | 'devam_eden_is_sayisi'
  | 'puan'
  | 'unvan';

// ─── Detay Verisi ───────────────────────────────────────────────

export interface YukleniciDetay {
  yuklenici: Yuklenici;
  ihaleler: YukleniciIhale[];
  kazanilanIhaleler: KazanilanIhale[];
  sehirDagilimi: { sehir: string; ihale_sayisi: string; toplam_bedel: string }[];
}

export interface YukleniciIhale {
  id: number;
  yuklenici_id: number;
  tender_id: number | null;
  ihale_basligi: string;
  kurum_adi: string;
  sehir: string;
  sozlesme_bedeli: number;
  sozlesme_tarihi: string;
  indirim_orani: number;
  rol: string;
  durum: string;
  fesih_durumu: string | null;
  ikn: string;
  tender_url?: string;
}

export interface KazanilanIhale {
  id: number;
  title: string;
  city: string;
  organization_name: string;
  sozlesme_bedeli: number;
  estimated_cost: number;
  indirim_orani: number;
  sozlesme_tarihi: string;
  tender_date: string;
  status: string;
  url: string;
  work_duration: string;
}

// ─── Karşılaştırma Tipi (Phase 3) ──────────────────────────────

export interface YukleniciKarsilastirma {
  yukleniciler: Yuklenici[];
  ortakIhaleler: {
    tender_id: number;
    ihale_basligi: string;
    sehir: string;
    katilimcilar: { yuklenici_id: number; unvan: string; sozlesme_bedeli: number }[];
  }[];
}

// ─── Yardımcı Fonksiyonlar ──────────────────────────────────────

export const formatCurrency = (val: number | null | undefined): string => {
  if (!val) return '-';
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} Milyar`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} Milyon`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)} Bin`;
  return val.toLocaleString('tr-TR');
};
