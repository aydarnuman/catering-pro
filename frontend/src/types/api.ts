// Tender types
export interface Tender {
  id: number;
  title: string;
  organization: string;
  deadline: string; // Frontend için deadline olarak kullanacağız (tender_date mapped)
  estimated_cost?: number;
  status: 'active' | 'expired' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;

  // Backend column mapping
  external_id?: string;
  publish_date?: string;
  tender_date?: string; // Gerçek backend column
  city?: string;
  location?: string;
  organization_name?: string; // Backend'deki organization mapping
  estimated_cost_raw?: string;
  tender_type?: string;
  url?: string;
  detail_scraped?: boolean;
  scraped_at?: string;

  // New fields from backend
  ikn?: string;
  work_name?: string;
  work_start_date?: string;
  work_duration?: string;
  city_raw?: string;
  organization_address?: string;
  organization_phone?: string;
  organization_email?: string;
  estimated_cost_min?: number;
  estimated_cost_max?: number;
  tender_method?: string;
  tender_source?: string;
  bid_type?: string;
  category_id?: number;
  category_name?: string;
  raw_data?: unknown;
  document_links?: Record<string, string | { url: string; name: string; fileName?: string | null }>;
  has_announcement?: boolean;
  has_goods_services?: boolean;
  goods_services_count?: number;
  has_zeyilname?: boolean;
  has_correction_notice?: boolean;

  // Güncelleme bilgileri
  is_updated?: boolean;
  last_update_date?: string;
  zeyilname_content?: unknown;
  correction_notice_content?: unknown;

  // Sonuçlanan ihale bilgileri
  yuklenici_adi?: string;
  sozlesme_bedeli?: number;
  indirim_orani?: number;
  sozlesme_tarihi?: string;
  is_bitis_tarihi?: string;

  // Analysis (optional - only populated when tracked)
  analysis_summary?: {
    teknik_sartlar?: Array<string | { text?: string; source?: string; doc_id?: number }>;
    birim_fiyatlar?: Array<{
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
    }>;
    notlar?: Array<string | { text?: string; source?: string; doc_id?: number; verified?: boolean }>;
    tam_metin?: string;
    [key: string]: unknown;
  };

  // Tracking related (optional)
  yaklasik_maliyet?: number;
  sinir_deger?: number;
  bizim_teklif?: number;
  dokuman_sayisi?: number;
  teknik_sart_sayisi?: number;
  birim_fiyat_sayisi?: number;
}

// Document types
export interface Document {
  id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  analysis_result?: unknown;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface TendersResponse {
  tenders: Tender[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StatsResponse {
  totalTenders: number;
  activeTenders: number;
  expiredTenders: number;
  totalDocuments: number;
  aiAnalysisCount: number;
}

// Upload progress
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}
