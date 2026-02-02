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
  ihale_basligi?: string;
  kurum?: string;
  tarih?: string;
  bedel?: string;
  sure?: string;
  teknik_sartlar?: (string | TeknikSart)[];
  birim_fiyatlar?: BirimFiyat[];
  notlar?: (string | AINote)[];
  tam_metin?: string;
  iletisim?: Record<string, string>;
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
  activeDetailTab: 'ozet' | 'analiz' | 'dokumanlar' | 'araclar' | 'dilekce' | 'teklif';
  dilekceType: string | null;

  // Sag panel
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
