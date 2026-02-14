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

// Döküman bilgisi (context'te yönetilen, sol panel + merkez panelde kullanılan)
export interface DocumentInfo {
  id: number;
  original_filename: string;
  file_type: string;
  doc_type: string;
  source_type: 'content' | 'download' | 'upload';
  processing_status: string;
  storage_url?: string;
  content_text?: string;
  extracted_text?: string;
}

// Gramaj grubu (yemek bazlı gruplanmış)
export interface GramajMalzeme {
  item: string;
  weight: number | null;
  unit: string;
}

export interface GramajGrubu {
  yemek_adi: string;
  kategori?: string;
  malzemeler: GramajMalzeme[];
  toplam_gramaj: number | null;
  porsiyon_notu?: string | null;
}

// Personel detayı
export interface PersonelDetay {
  pozisyon: string;
  adet: number;
  ucret_orani?: string;
  sure?: string; // "6 AY", "12 AY" gibi
}

// Öğün bilgisi (flat format veya tablo format)
export interface OgunBilgisi {
  tur?: string;
  miktar?: number;
  birim?: string;
  // Tablo format (Azure'dan gelen)
  rows?: string[][];
  headers?: string[];
  index?: number;
  rowCount?: number;
  columnCount?: number;
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
  banka_borc_orani?: string;
  toplam_ciro_orani?: string;
  hizmet_ciro_orani?: string;
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
  gunluk_ogun_sayisi?: number | string | null;
  gunluk_ogun_sayisi_raw?: string;
  kisi_sayisi?: number | string | null;
  kisi_sayisi_raw?: string;
  // Azure v5 Catering-Spesifik Alanlar
  kahvalti_kisi_sayisi?: number | string | null;
  kahvalti_kisi_sayisi_raw?: string;
  ogle_kisi_sayisi?: number | string | null;
  ogle_kisi_sayisi_raw?: string;
  aksam_kisi_sayisi?: number | string | null;
  aksam_kisi_sayisi_raw?: string;
  diyet_kisi_sayisi?: number | string | null;
  diyet_kisi_sayisi_raw?: string;
  hizmet_gun_sayisi?: number | string | null;
  hizmet_gun_sayisi_raw?: string;
  mutfak_tipi?: string | null;
  servis_tipi?: string | null;
  et_tipi?: string | null;
  yemek_cesit_sayisi?: string | null;
  yemek_pisirilecek_yer?: string | null;
  iscilik_orani?: string | null;
  dagitim_saatleri?: string | null;
  kalite_standartlari?: string | null;
  gida_guvenligi_belgeleri?: string | null;
  dagitim_noktalari?: string | null;
  ekipman_listesi?: string | null;
  malzeme_listesi?: string | null;
  ogun_dagilimi?: string | null;
  birim_fiyat_cetveli?: string | null;
  menu_tablosu?: string | null;
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
  // v9.1 Yeni alanlar
  kapasite_gereksinimi?: string;
  teklif_turu?: string;
  ihale_usulu?: string;
  odeme_kosullari?: {
    odeme_yeri?: string;
    hakedis_suresi?: string;
    odeme_suresi?: string;
    avans?: string;
    odeme_periyodu?: string;
  };
  is_artisi?: {
    oran?: string;
    kosullar?: string;
    is_eksilisi?: string;
  };
  operasyonel_kurallar?: {
    alt_yuklenici?: string;
    personel_kurallari?: string[];
    yemek_kurallari?: string[];
    muayene_kabul?: string;
    denetim?: string;
  };
  // Konsolidasyon alanları
  toplam_ogun_sayisi?: number;
  /** @deprecated kisi_sayisi kullan — bu alan geriye donuk uyumluluk icin korunuyor */
  toplam_personel?: number;
  /** @deprecated kisi_sayisi_raw kullan */
  toplam_personel_raw?: string;
  /** @deprecated kisi_sayisi kullan — bu alan geriye donuk uyumluluk icin korunuyor */
  personel_sayisi?: number;
  /** @deprecated kisi_sayisi_raw kullan */
  personel_sayisi_raw?: string;
  // Yemek bazlı gramaj grupları
  gramaj_gruplari?: GramajGrubu[];
  // Tahmini bedel (metin gösterim + sayısal hesaplama)
  tahmini_bedel_numeric?: number;
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

export type TenderStatus = 'inceleniyor' | 'bekliyor' | 'basvuruldu' | 'kazanildi' | 'kaybedildi' | 'iptal';

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
  apiStatus?: string; // Backend'e giden status: 'active' | 'expired' | 'completed' | 'all'
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
  leftPanelCollapsed: boolean;

  // Orta panel (Dokuman Calisma Alani)
  detailExpanded: boolean;
  aiChatExpanded: boolean;
  selectedDocumentId: number | null;
  dilekceType: string | null;

  // Dokuman yonetimi (context'te)
  documents: DocumentInfo[];
  documentsLoading: boolean;
  signedUrl: string | null;
  signedUrlLoading: boolean;

  // Sag panel (Veri Paketi)
  veriPaketiSections: Set<string>; // Acik olan accordion bolumleri
  expandedSections: Set<string>;
  selectedFirmaId: number | null;

  // Eski uyumluluk (deprecating)
  /** @deprecated Artik kullanilmiyor - center panel tab'siz */
  activeDetailTab?: 'ozet' | 'analiz' | 'dokumanlar' | 'notlar';
  /** @deprecated Artik kullanilmiyor - right panel accordion */
  activeRightTab?: 'dilekce' | 'teklif' | 'araclar' | 'kontrol';

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

// HITL Düzeltme tipleri
export interface CorrectionData {
  field_path: string;
  old_value: unknown;
  new_value: unknown;
  correction_type: 'edit' | 'delete' | 'add';
}

// Dilekce tipleri
export const dilekceTypeLabels: Record<string, string> = {
  asiri_dusuk: 'Aşırı Düşük Savunma',
  idare_sikayet: 'İdareye Şikayet',
  kik_itiraz: 'KİK İtiraz',
  aciklama_cevabi: 'Açıklama Cevabı',
};
