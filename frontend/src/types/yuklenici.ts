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
  // Firma bilgileri (manuel giriş)
  telefon?: string | null;
  email?: string | null;
  adres?: string | null;
  yetkili_kisi?: string | null;
  vergi_no?: string | null;
  web_sitesi?: string | null;
  sektor?: string | null;
  firma_notu?: string | null;
  // Analiz sayfası verileri
  analiz_verisi?: AnalyzData | null;
  analiz_scraped_at?: string | null;
}

// ─── Yapışkan Not Tipi ──────────────────────────────────────────

export interface YukleniciNot {
  id: number;
  yuklenici_id: number;
  icerik: string;
  renk: 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple';
  olusturan: string | null;
  created_at: string;
  updated_at: string;
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
  totalIhaleler?: number;
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

// ─── İstihbarat Merkezi Tipleri ─────────────────────────────────

/** Backend modül adları (scraper birimleri — 9 adet) */
export type IstihbaratModulAdi =
  | 'veri_havuzu'
  | 'ihale_gecmisi'
  | 'profil_analizi'
  | 'katilimcilar'
  | 'kik_kararlari'
  | 'kik_yasaklilar'
  | 'sirket_bilgileri'
  | 'haberler'
  | 'ai_arastirma';

/** Dock'ta gösterilen grup adları (5 adet) */
export type DockGrupAdi =
  | 'ihale_performansi'   // ihale_gecmisi + profil_analizi + katilimcilar
  | 'hukuki_durum'        // kik_kararlari + kik_yasaklilar
  | 'sirket_bilgileri'    // tekil
  | 'haberler'            // tekil
  | 'ai_arastirma';       // tekil

/** Modül çalışma durumları */
export type ModulDurum = 'bekliyor' | 'calisiyor' | 'tamamlandi' | 'hata';

/** Tek bir istihbarat modülünün durumu */
export interface IstihbaratModul {
  modul: IstihbaratModulAdi;
  durum: ModulDurum;
  son_guncelleme: string | null;
  veri: Record<string, unknown>;
  hata_mesaji: string | null;
  updated_at: string | null;
}

/** Dock grubu gösterim bilgileri (UI tarafı — 5 adet) */
export interface DockGrupMeta {
  ad: DockGrupAdi;
  baslik: string;
  aciklama: string;
  ikon: string;
  renk: string;
  kaynak: string;
  /** Bu grubun kapsadığı backend modül adları */
  moduller: IstihbaratModulAdi[];
}

/** Modül gösterim bilgileri (UI tarafı) — geriye uyumluluk */
export interface ModulMeta {
  ad: IstihbaratModulAdi;
  baslik: string;
  aciklama: string;
  ikon: string;
  renk: string;
  kaynak: string;
  puppeteer: boolean;
}

/** KİK Yasaklı sorgu sonucu */
export interface KikYasakliVeri {
  yasakli_mi: boolean;
  sonuclar: {
    firma_adi: string;
    yasaklama_tarihi: string;
    yasaklama_suresi: string;
    yasaklama_nedeni: string;
    bitis_tarihi: string;
  }[];
  tum_sonuc_sayisi: number;
  sorgulama_tarihi: string;
  kaynak: string;
  not?: string;
}

/** Şirket bilgileri (MERSİS + Ticaret Sicil) */
export interface SirketBilgiVeri {
  mersis: Record<string, string> & { basarili: boolean; not?: string };
  ticaret_sicil: {
    basarili: boolean;
    ilanlar: {
      ilan_tarihi: string;
      ilan_turu: string;
      ozet: string;
      link: string;
    }[];
    toplam: number;
    not?: string;
  };
  sorgulama_tarihi: string;
  kaynaklar: string[];
}

/** Haber arama sonucu */
export interface HaberVeri {
  haberler: {
    baslik: string;
    link: string;
    tarih: string | null;
    tarih_okunur: string;
    kaynak: string;
    ozet: string;
  }[];
  toplam: number;
  arama_metni: string;
  sorgulama_tarihi: string;
  kaynak: string;
}

/** AI istihbarat raporu (Opus 4.6 — İstihbarat Briefing) */
export interface AiRaporVeri {
  rapor: {
    // Yeni format (Opus 4.6)
    ozet_profil?: string;
    tehlike_seviyesi?: 'düşük' | 'orta' | 'yüksek' | 'çok yüksek';
    tehlike_gerekce?: string;
    faaliyet_alani?: string;
    ihale_davranisi?: string;
    risk_sinyalleri?: string;
    rakip_agi?: string;
    stratejik_tavsiyeler?: string[];
    tam_metin?: string;
    // Eski format (geriye uyumluluk)
    genel_degerlendirme?: string;
    guclu_yonler?: string[];
    zayif_yonler?: string[];
    firsatlar?: string[];
    tehditler?: string[];
    rekabet_stratejisi?: string;
    fiyat_analizi?: string;
    tavsiyeler?: string[];
    risk_seviyesi?: 'düşük' | 'orta' | 'yüksek';
  };
  ham_metin: string;
  olusturulma_tarihi: string;
  model: string;
  sure_ms: number;
  veri_kaynagi_ozeti: Record<string, unknown>;
}

/** Fiyat tahmini sonucu */
export interface FiyatTahminVeri {
  yeterli_veri: boolean;
  mesaj?: string;
  toplam_ihale?: number;
  ortalama_indirim?: number;
  medyan_indirim?: number;
  min_indirim?: number;
  max_indirim?: number;
  trend?: 'artiyor' | 'azaliyor' | 'sabit';
  trend_detay?: {
    son_10_ort: number;
    onceki_ort: number;
    fark: number;
  };
  sehir_bazli?: {
    sehir: string;
    ort_indirim: number;
    ihale_sayisi: number;
  }[];
}

/** Yüklenici bildirimi */
export interface YukleniciBildirim {
  id: number;
  yuklenici_id: number;
  tip: string;
  baslik: string;
  icerik: string | null;
  meta: Record<string, unknown>;
  okundu: boolean;
  created_at: string;
  // JOIN alanları
  kisa_ad?: string;
  unvan?: string;
}

// ─── Yardımcı Fonksiyonlar ──────────────────────────────────────

export const formatCurrency = (val: number | null | undefined): string => {
  if (!val) return '-';
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} Milyar`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} Milyon`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)} Bin`;
  return val.toLocaleString('tr-TR');
};
