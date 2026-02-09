/**
 * Teklif Merkezi - Birleşik Tip Tanımları
 * TeklifModal, CalculationModal, SuggestionsTab ve CalculationsPanel
 * bileşenlerinden birleştirilen tüm tipler.
 */

// Re-export mevcut tipler
export type {
  TeklifData,
  MaliyetDetay,
  MaliyetKalemKey,
  CetvelKalemi,
  MalzemeMaliyet,
  PersonelMaliyet,
  NakliyeMaliyet,
  SarfMalzemeMaliyet,
  EkipmanBakimMaliyet,
  GenelGiderMaliyet,
  YasalGiderlerMaliyet,
  RiskPayiMaliyet,
  OgunDetay,
  PozisyonKalem,
  AracKalem,
  SarfKalem,
  EkipmanKalem,
  GenelGiderKalem,
  YasalGiderKalem,
  RiskKategori,
} from '../../teklif/types';

export {
  DEFAULT_TEKLIF_DATA,
  MALIYET_KALEMLERI,
  POZISYON_SABLONLARI,
  ARAC_TIPLERI,
  EKIPMAN_SABLONLARI,
  SARF_KALEMLERI,
  GENEL_GIDER_KALEMLERI,
  YASAL_GIDER_SABLONLARI,
  RISK_KATEGORILERI,
} from '../../teklif/types';

export type { SavedTender, AnalysisData } from '../types';
export type { TeklifItem, ActiveTool, IhaleTuru } from '../calculation-utils';
export { IHALE_KATSAYILARI } from '../calculation-utils';

// ─── Section Tanımları ─────────────────────────────────────────

export type TeklifMerkeziSection = 'tespit' | 'maliyet' | 'hesaplamalar' | 'cetvel' | 'ozet';

export type SectionCompletionStatus = 'not_started' | 'partial' | 'complete' | 'warning';

export interface SectionInfo {
  id: TeklifMerkeziSection;
  label: string;
  icon: string;
  description: string;
}

export const SECTIONS: SectionInfo[] = [
  { id: 'tespit', label: 'Döküman Tespitleri', icon: 'sparkles', description: 'AI tespit edilen veriler' },
  { id: 'maliyet', label: 'Teklif Maliyetlendirme', icon: 'calculator', description: '8 kategori gider dökümü' },
  { id: 'hesaplamalar', label: 'KİK & Hesaplamalar', icon: 'scale', description: 'Sınır değer, teminat, risk' },
  { id: 'cetvel', label: 'Teklif Cetveli', icon: 'table', description: 'Teklif kalemleri listesi' },
  { id: 'ozet', label: 'Son Kontrol', icon: 'check', description: 'Son kontrol ve onay' },
];

// ─── Tespit (AI Suggestions) Tipleri ──────────────────────────

export interface DetectedValue {
  key: string;
  label: string;
  value: string | number | null;
  source: 'sartname' | 'analiz' | 'hesaplama' | 'scraper';
  fieldName: string;
  type: 'currency' | 'number' | 'text';
}

// ─── Hesaplama Verileri ───────────────────────────────────────

export interface HesaplamaState {
  yaklasikMaliyet: number;
  bizimTeklif: number;
  ihaleTuru: 'hizmet' | 'yapim_ustyapi' | 'yapim_altyapi';
  teklifListesi: Array<{ firma: string; tutar: number }>;
  kikSinirDeger: number | null;
  maliyetler: {
    hammadde: number;
    iscilik: number;
    enerji: number;
    nakliye: number;
    ambalaj: number;
    diger: number;
  };
}

// ─── Completion Tracking ──────────────────────────────────────

export type CompletionMap = Record<TeklifMerkeziSection, SectionCompletionStatus>;

// ─── Modal Props ──────────────────────────────────────────────

export interface TeklifMerkeziModalProps {
  opened: boolean;
  onClose: () => void;
  tender: import('../types').SavedTender;
  onRefresh?: () => void;
  /** Doğrudan belirli bir bölümde açılmak için */
  initialSection?: TeklifMerkeziSection;
}
