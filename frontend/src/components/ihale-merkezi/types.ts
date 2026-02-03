import type { Tender } from '@/types/api';

export interface UserNote {
  id: string;
  text: string;
  created_at: string;
}

export interface BirimFiyat {
  id?: string | number;
  kalem?: string;
  aciklama?: string;
  text?: string;
  birim?: string;
  miktar?: string | number;
  fiyat?: string | number;
  tutar?: string | number;
  source?: string;
  doc_id?: number;
}

// Teknik şart (string veya object olabilir)
export interface TeknikSart {
  text: string;
  source?: string;
  doc_id?: number;
}

// AI notu
export interface AINote {
  id?: string;
  text: string;
  source?: string;
  doc_id?: number;
  verified?: boolean;
}

// Takvim öğesi
export interface TakvimItem {
  olay: string;
  tarih: string;
  gun?: string;
}

// Önemli not
export interface OnemliNot {
  not: string;
  tur: 'bilgi' | 'uyari' | 'gereklilik';
}

// Döküman detayı
export interface DocumentDetail {
  id: number;
  filename: string;
  doc_type: string;
}

// Personel detayı
export interface PersonelDetay {
  pozisyon: string;
  adet: number;
  ucret_orani?: string;
}

// Öğün bilgisi
export interface OgunBilgisi {
  tur: string;
  miktar: number;
  birim?: string;
}

// Ceza koşulu
export interface CezaKosulu {
  tur: string;
  oran: string;
  aciklama?: string;
}

// Gerekli belge
export interface GerekliBelge {
  belge: string;
  zorunlu: boolean;
  puan?: number;
}

// Mali kriterler
export interface MaliKriterler {
  cari_oran?: string;
  ozkaynak_orani?: string;
  is_deneyimi?: string;
  ciro_orani?: string;
  [key: string]: string | undefined;
}

// Fiyat farkı
export interface FiyatFarki {
  formul?: string;
  katsayilar?: Record<string, string>;
}

// Teminat oranları
export interface TeminatOranlari {
  gecici?: string;
  kesin?: string;
  ek_kesin?: string;
}

// Servis saatleri
export interface ServisSaatleri {
  kahvalti?: string;
  ogle?: string;
  aksam?: string;
  [key: string]: string | undefined;
}

// İletişim bilgileri (genişletilmiş)
export interface IletisimBilgileri {
  telefon?: string;
  email?: string;
  adres?: string;
  yetkili?: string;
  [key: string]: string | undefined;
}

export interface Firma {
  id: number;
  unvan: string;
  kisa_ad?: string;
  vergi_no?: string;
  vergi_dairesi?: string;
  adres?: string;
  telefon?: string;
  email?: string;
  yetkili_adi?: string;
  yetkili_unvani?: string;
  varsayilan?: boolean;
}

export interface AnalysisData {
  // Temel bilgiler
  ihale_basligi?: string;
  kurum?: string;
  tarih?: string;
  bedel?: string;
  sure?: string;
  ikn?: string;
  // AI analiz sonuçları
  ozet?: string | null;
  ihale_turu?: string | null;
  tahmini_bedel?: string | null;
  teslim_suresi?: string | null;
  gunluk_ogun_sayisi?: string;
  kisi_sayisi?: string;
  // Listeler
  teknik_sartlar?: (string | TeknikSart)[];
  birim_fiyatlar?: BirimFiyat[];
  takvim?: TakvimItem[];
  onemli_notlar?: (string | OnemliNot)[];
  eksik_bilgiler?: string[];
  notlar?: (string | AINote)[];
  // Yeni detaylı alanlar
  personel_detaylari?: PersonelDetay[];
  ogun_bilgileri?: OgunBilgisi[];
  is_yerleri?: string[];
  ceza_kosullari?: CezaKosulu[];
  gerekli_belgeler?: GerekliBelge[];
  mali_kriterler?: MaliKriterler;
  fiyat_farki?: FiyatFarki;
  teminat_oranlari?: TeminatOranlari;
  servis_saatleri?: ServisSaatleri;
  sinir_deger_katsayisi?: string;
  benzer_is_tanimi?: string;
  // Ek bilgiler
  tam_metin?: string;
  iletisim?: IletisimBilgileri;
  // Meta
  documents_count?: number;
  document_details?: DocumentDetail[];
}

export interface SavedTender {
  id: string;
  tender_id: number;
  ihale_basligi: string;
  kurum: string;
  tarih: string;
  bedel: string;
  sure?: string;
  city?: string;
  external_id?: string;
  url?: string;
  status: TenderStatus;
  notes: string;
  user_notes?: UserNote[];
  created_at: string;
  dokuman_sayisi: number;
  analiz_edilen_dokuman?: number;
  teknik_sart_sayisi: number;
  birim_fiyat_sayisi: number;
  analysis_summary?: AnalysisData;
  yaklasik_maliyet?: number;
  sinir_deger?: number;
  bizim_teklif?: number;
  hesaplama_verileri?: Record<string, unknown>;
  // Zeyilname ve duzeltme
  zeyilname_content?: {
    title: string;
    content: string;
    scrapedAt: string;
  } | null;
  correction_notice_content?: {
    title: string;
    content: string;
    scrapedAt: string;
  } | null;
}

export type TenderStatus =
  | 'inceleniyor'
  | 'bekliyor'
  | 'basvuruldu'
  | 'kazanildi'
  | 'kaybedildi'
  | 'iptal';

export const statusConfig: Record<TenderStatus, { color: string; label: string; icon: string }> = {
  inceleniyor: { color: 'cyan', label: 'İnceleniyor', icon: '👁️' },
  bekliyor: { color: 'yellow', label: 'Bekliyor', icon: '⏳' },
  basvuruldu: { color: 'blue', label: 'Başvuruldu', icon: '📄' },
  kazanildi: { color: 'green', label: 'Kazanıldı', icon: '✅' },
  kaybedildi: { color: 'red', label: 'Kaybedildi', icon: '❌' },
  iptal: { color: 'gray', label: 'İptal Edildi', icon: '🚫' },
};

export interface TenderFilters {
  status?: string;
  city?: string[];
  dateRange?: [Date | null, Date | null];
}

export interface UpdateStats {
  lastUpdate: string;
  today: {
    newCount: number;
    updatedCount: number;
    newTenders: Array<{
      id: number;
      external_id: string;
      title: string;
      city: string;
      organization_name: string;
      created_at: string;
    }>;
    updatedTenders: Array<{
      id: number;
      external_id: string;
      title: string;
      city: string;
      organization_name: string;
      updated_at: string;
    }>;
  };
  totalCount: number;
}

export interface IhaleMerkeziState {
  // Sol panel
  activeTab: 'all' | 'tracked';
  selectedTenderId: number | null;
  searchQuery: string;
  filters: TenderFilters;
  currentPage: number;
  showStats: 'new' | 'updated' | false;

  // Orta panel
  detailExpanded: boolean;
  aiChatExpanded: boolean;
  activeDetailTab: 'ozet' | 'dokumanlar' | 'notlar';
  dilekceType: string | null;

  // Sag panel
  activeRightTab: 'dilekce' | 'teklif' | 'araclar' | 'tespit';
  expandedSections: Set<string>;
  selectedFirmaId: number | null;

  // Data
  allTenders: Tender[];
  trackedTenders: SavedTender[];
  selectedTender: Tender | SavedTender | null;
  statsData: UpdateStats | null;
  firmalar: Firma[];

  // Modals
  mapModalOpen: boolean;
  addUrlModalOpen: boolean;
  teklifModalOpen: boolean;
}

// Dilekce tipleri
export const dilekceTypeLabels: Record<string, string> = {
  asiri_dusuk: 'Aşırı Düşük Savunma',
  idare_sikayet: 'İdareye Şikayet',
  kik_itiraz: 'KİK İtiraz',
  aciklama_cevabi: 'Açıklama Cevabı',
};
