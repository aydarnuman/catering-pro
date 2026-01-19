// IhaleUzmani - Tip Tanımları

// AI tarafından çıkarılan not
export interface AINote {
  id: string;
  text: string;
  source: string; // Kaynak döküman adı
  doc_id?: number;
  verified?: boolean;
}

// Teknik şart (kaynak bilgisiyle)
export interface TeknikSart {
  text: string;
  source: string;
  doc_id?: number;
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
  iletisim?: any;
}

export interface BirimFiyat {
  kalem?: string;
  aciklama?: string;
  text?: string; // String formatı için
  birim?: string;
  miktar?: string | number;
  fiyat?: string | number;
  tutar?: string | number;
  source?: string; // Kaynak döküman
  doc_id?: number;
}

export interface UserNote {
  id: string;
  text: string;
  created_at: string;
}

export interface SavedTender {
  id: string;
  tender_id: number;
  ihale_basligi: string;
  kurum: string;
  tarih: string;
  bedel: string;
  sure: string;
  city?: string;
  external_id?: string;
  url?: string;
  status: TenderStatus;
  notes: string;
  notlar?: string;
  user_notes?: UserNote[];
  created_at: string;
  dokuman_sayisi: number;
  analiz_edilen_dokuman?: number;
  teknik_sart_sayisi: number;
  birim_fiyat_sayisi: number;
  analiz_data?: AnalysisData;
  analysis_summary?: AnalysisData;
}

export type TenderStatus = 'bekliyor' | 'basvuruldu' | 'kazanildi' | 'kaybedildi' | 'iptal' | 'inceleniyor';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type ClipboardItemType = 'teknik' | 'fiyat' | 'ai' | 'hesaplama' | 'genel' | 'not';
export type ClipboardPriority = 'high' | 'medium' | 'low';
export type ClipboardTag = 'onemli' | 'acil' | 'kontrol' | 'soru' | 'hatirlatma' | 'onay';

export interface ClipboardItem {
  id: string;
  type: ClipboardItemType;
  content: string;
  source: string;
  isPinned: boolean;
  createdAt: Date;
  priority?: ClipboardPriority;
  tags?: ClipboardTag[];
  color?: string;
  metadata?: {
    itemIndex?: number;
    isZorunlu?: boolean;
    value?: number;
    unit?: string;
  };
}

// Öncelik config
export const priorityConfig: Record<ClipboardPriority, { color: string; label: string; icon: string }> = {
  high: { color: 'red', label: 'Yüksek', icon: '🔴' },
  medium: { color: 'yellow', label: 'Orta', icon: '🟡' },
  low: { color: 'green', label: 'Düşük', icon: '🟢' },
};

// Etiket config
export const tagConfig: Record<ClipboardTag, { color: string; label: string; icon: string }> = {
  onemli: { color: 'red', label: 'Önemli', icon: '⭐' },
  acil: { color: 'orange', label: 'Acil', icon: '⚡' },
  kontrol: { color: 'blue', label: 'Kontrol', icon: '✓' },
  soru: { color: 'violet', label: 'Soru', icon: '❓' },
  hatirlatma: { color: 'teal', label: 'Hatırlatma', icon: '🔔' },
  onay: { color: 'green', label: 'Onay', icon: '✅' },
};

export interface FirmaBilgisi {
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

export interface TeklifItem {
  firma: string;
  tutar: number;
}

export interface MaliyetBilesenleri {
  anaCigGirdi: number;
  yardimciGirdi: number;
  iscilik: number;
  nakliye: number;
  sozlesmeGideri: number;
  genelGider: number;
  kar: number;
}

export interface AsiriDusukSonuc {
  toplamMaliyet: number;
  asiriDusukMu: boolean;
  fark: number;
  farkOran: number;
  aciklama: string;
}

export interface TeminatSonuc {
  geciciTeminat: number;
  kesinTeminat: number;
  damgaVergisi: number;
}

export interface BedelSonuc {
  bedel: number;
  aciklama: string;
}

export interface DilekceMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DilekceConversation {
  id: number;
  dilekce_type: string;
  baslik?: string;
  content?: string;
  created_at: string;
  updated_at?: string;
}

export interface IhaleUzmaniModalProps {
  opened: boolean;
  onClose: () => void;
  tender: SavedTender | null;
  onUpdateStatus: (id: string, status: TenderStatus) => void;
  onDelete: (id: string) => void;
  /** @deprecated NotesSection handles notes internally now */
  onAddNote?: (id: string, text: string) => void;
  /** @deprecated NotesSection handles notes internally now */
  onDeleteNote?: (trackingId: string, noteId: string) => void;
}

// Status config
export const statusConfig: Record<TenderStatus, { color: string; label: string; icon: string }> = {
  bekliyor: { color: 'yellow', label: 'Bekliyor', icon: '🟡' },
  basvuruldu: { color: 'blue', label: 'Başvuruldu', icon: '🔵' },
  kazanildi: { color: 'green', label: 'Kazanıldı', icon: '🟢' },
  kaybedildi: { color: 'red', label: 'Kaybedildi', icon: '🔴' },
  iptal: { color: 'gray', label: 'İptal Edildi', icon: '⚫' },
  inceleniyor: { color: 'orange', label: 'İnceleniyor', icon: '🟠' },
};

// Dilekçe tür etiketleri
export const dilekceTypeLabels: Record<string, string> = {
  asiri_dusuk: 'Aşırı Düşük Teklif Açıklaması',
  idare_sikayet: 'İdareye Şikayet Dilekçesi',
  kik_itiraz: 'KİK İtirazen Şikayet Dilekçesi',
  aciklama_cevabi: 'İdare Açıklama Cevabı',
};

// Clipboard kategorileri
export const clipboardTypeLabels: Record<ClipboardItemType, { label: string; color: string; icon: string }> = {
  teknik: { label: 'Teknik Şart', color: 'violet', icon: '🔧' },
  fiyat: { label: 'Birim Fiyat', color: 'green', icon: '💰' },
  ai: { label: 'AI Notu', color: 'blue', icon: '🤖' },
  hesaplama: { label: 'Hesaplama', color: 'orange', icon: '📊' },
  genel: { label: 'Genel', color: 'gray', icon: '📝' },
  not: { label: 'Manuel Not', color: 'pink', icon: '✏️' },
};
