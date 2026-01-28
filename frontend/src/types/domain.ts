/**
 * Domain Types
 * Uygulamaya özgü domain model tipleri
 */

// CekSenet - Çek ve Senet yönetimi
export interface CekSenet {
  id?: number;
  firma_id?: number;
  cari_id?: number | null;
  cek_senet_no: string;
  tur: 'cek' | 'senet';
  tutar: number;
  kesim_tarihi?: string;
  vade_tarihi: string;
  durum: 'beklemede' | 'tahsil_edildi' | 'odendi' | 'iade';
  aciklama?: string;
  created_at?: string;
  updated_at?: string;
}

// ProjeHareket - Proje gelir/gider hareketleri
export interface ProjeHareket {
  id?: number;
  proje_id: number;
  islem_tipi: 'gelir' | 'gider';
  tutar: number;
  aciklama: string;
  tarih: string;
  kategori?: string;
  created_at?: string;
}

// TenderNote - İhale notları (Genişletilmiş)
export interface TenderNote {
  id?: number | string;
  ihale_id?: number;
  tracking_id?: number;
  user_id?: number;
  not?: string;
  text?: string;
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple';
  pinned?: boolean;
  tags?: string[];
  order?: number;
  reminder_date?: string | null;
  created_at?: string;
  updated_at?: string;
  attachments?: TenderNoteAttachment[];
}

// TenderNoteAttachment - Not ekleri
export interface TenderNoteAttachment {
  id: number;
  note_id: string | number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
}

// TeklifResponse - İhale teklifleri
export interface TeklifResponse {
  id?: number;
  ihale_id?: number;
  ihale_adi?: string;
  ihale_kayit_no?: string;
  firma_id?: number;
  tutar?: number;
  gerekce?: string;
  durum?: 'taslak' | 'hazirlaniyor' | 'gonderildi' | 'kazanildi' | 'kaybedildi' | 'tamamlandi';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maliyet_detay?: any;
  maliyet_toplam?: number;
  kar_orani?: number;
  kar_tutari?: number;
  teklif_fiyati?: number;
  notlar?: string;
  created_at?: string;
  updated_at?: string;
}

// AuditLog - Sistem denetim logları
export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  table_name: string;
  record_id?: number;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// InvoiceItem - Fatura kalemleri
export interface InvoiceItem {
  id?: number;
  fatura_id: number;
  urun_adi: string;
  miktar: number;
  birim: string;
  birim_fiyat: number;
  kdv_orani: number;
  tutar: number;
  aciklama?: string;
}

// RealtimePayload - Supabase realtime payloadları
export interface RealtimePayload<T = unknown> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  table: string;
  schema: string;
  commit_timestamp: string;
}

// ConversationHistory - AI konuşma geçmişi
export interface ConversationHistory {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string; // Optional to allow flexible usage
}

// PageContext - Sayfa bağlamı (AI için)
export interface PageContext {
  url: string;
  title: string;
  content?: string;
  metadata?: Record<string, string>;
}

// AISettings - AI ayarları
export interface AISettings {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  enableHistory: boolean;
}

// Conversation - AI konuşması
export interface Conversation {
  id: number;
  title: string;
  history: ConversationHistory[];
  created_at: string;
}

// =====================================================
// AI RESPONSE TYPES - as any sorunlarını çözmek için
// =====================================================

// AI Agent Response - /api/ai/agent endpoint'i için
export interface AIAgentResponse {
  success: boolean;
  response: string;
  message?: string;
  sessionId?: string;
  toolsUsed?: string[];
  iterations?: number;
  godMode?: boolean;
  error?: string;
}

// AI Chat Response - /api/ai/chat endpoint'i için
export interface AIChatResponse {
  success: boolean;
  response: string;
  message?: string;
  sessionId?: string;
  conversationId?: number;
}

// AI Dilekce Response - /api/ai/dilekce-chat endpoint'i için
export interface AIDilekceResponse {
  success: boolean;
  response: string;
  message?: string;
  sessionId?: string;
  toolsUsed?: string[];
  dilekceId?: number;
}

// ChatMessage - AI sohbet mesajı
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  iterations?: number;
  godMode?: boolean;
  isStreaming?: boolean;
}

// AI Conversations List Response
export interface AIConversationsResponse {
  success: boolean;
  conversations?: ConversationSummary[];
  data?: ConversationSummary[];
}

// Conversation Summary - Liste görünümü için
export interface ConversationSummary {
  session_id: string;
  title?: string;
  first_message?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

// AI Conversation Detail Response
export interface AIConversationDetailResponse {
  success: boolean;
  messages?: ChatMessageRecord[];
  data?: ChatMessageRecord[];
}

// Chat Message Record - DB'den gelen mesaj
export interface ChatMessageRecord {
  id: number;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// AI Search Results Response
export interface AISearchResponse {
  success: boolean;
  results?: ConversationSummary[];
  data?: ConversationSummary[];
}

// Dilekce - Saved dilekçe document
export interface Dilekce {
  id: number;
  tender_id: number;
  user_id: number;
  content: string;
  title?: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
}

// Dilekce List Response
export interface DilekceListResponse {
  success: boolean;
  dilekce?: Dilekce[];
  data?: Dilekce[] | { dilekce: Dilekce[] };
}

// AI Template
export interface AITemplate {
  id: number;
  slug: string;
  name: string;
  description?: string;
  prompt: string;
  category?: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// AI Templates Response
export interface AITemplatesResponse {
  success: boolean;
  data?: AITemplate[];
  templates?: AITemplate[];
}

// AI Memory Item
export interface AIMemoryItem {
  id: number;
  user_id: number;
  key: string;
  value: string;
  category?: string;
  created_at: string;
}

// AI Feedback Stats
export interface AIFeedbackStats {
  total: number;
  positive: number;
  negative: number;
  average_rating: number;
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

// Notification
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  link?: string;
  created_at: string;
}

// Notification Count Response
export interface NotificationCountResponse {
  success: boolean;
  count?: number;
  data?: number;
}

// Notifications List Response
export interface NotificationsResponse {
  success: boolean;
  data?: Notification[];
  notifications?: Notification[];
}

// =====================================================
// SEARCH TYPES
// =====================================================

// Search Result Item
export interface SearchResultItem {
  id: number;
  type: 'tender' | 'invoice' | 'cari' | 'personel' | 'urun';
  title: string;
  subtitle?: string;
  url: string;
  score?: number;
}

// Search Response
export interface SearchResponse {
  success: boolean;
  results?: SearchResultItem[];
  data?: SearchResultItem[];
}

// =====================================================
// CARI TYPES - Müşteri/Tedarikçi yönetimi
// =====================================================

// Cari Tipi
export type CariTip = 'musteri' | 'tedarikci' | 'her_ikisi';

// Cari - Müşteri/Tedarikçi ana interface
export interface Cari {
  id: number;
  tip: CariTip;
  unvan: string;
  yetkili?: string;
  vergi_no?: string;
  vergi_dairesi?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  il?: string;
  ilce?: string;
  borc: number;
  alacak: number;
  bakiye: number;
  kredi_limiti?: number;
  banka_adi?: string;
  iban?: string;
  aktif?: boolean;
  notlar?: string;
  etiket?: string;
  created_at?: string;
  updated_at?: string;
}

// CariHareket - Cari hesap hareketleri
export interface CariHareket {
  id: number;
  cari_id: number;
  hareket_tipi: string;
  belge_tipi?: string;
  belge_no?: string;
  belge_tarihi: string;
  vade_tarihi?: string;
  borc: number;
  alacak: number;
  bakiye: number;
  aciklama?: string;
  doviz_tipi?: string;
  doviz_kuru?: number;
  fatura_id?: number;
  created_at?: string;
  updated_at?: string;
}

/** Cari hareket listesi satırı - API'den belge_tarihi 'tarih' alias ile döner */
export type CariHareketListRow = Omit<CariHareket, 'belge_tarihi'> & { tarih: string };

// CariOzet - Cari özet istatistikleri
export interface CariOzet {
  toplamCari: number;
  musteriSayisi: number;
  tedarikciSayisi: number;
  toplamBorc: number;
  toplamAlacak: number;
  netBakiye: number;
}

// =====================================================
// PAGINATION TYPES - Sayfalama
// =====================================================

// Pagination bilgisi
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Paginated Response - Generic sayfalı yanıt
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationInfo;
}

// =====================================================
// FORM DATA TYPES - Muhasebe sayfaları için
// =====================================================

// Cari Form Data
export interface CariFormData {
  tip: CariTip;
  unvan: string;
  yetkili?: string;
  vergi_no?: string;
  vergi_dairesi?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  il?: string;
  ilce?: string;
  kredi_limiti?: number;
  banka_adi?: string;
  iban?: string;
  notlar?: string;
  etiket?: string;
}

// Demirbas Form Data
export interface DemirbasFormData {
  ad: string;
  kategori_id?: number;
  lokasyon_id?: number;
  seri_no?: string;
  marka?: string;
  model?: string;
  alis_tarihi?: string;
  alis_fiyati?: number;
  durum: 'aktif' | 'arizali' | 'bakimda' | 'hurda';
  aciklama?: string;
}

// Kasa Banka Hesap Form Data
export interface KasaBankaHesapFormData {
  ad: string;
  tip: 'kasa' | 'banka';
  banka_adi?: string;
  iban?: string;
  acilis_bakiye: number;
  para_birimi: string;
  aciklama?: string;
}

// Kasa Banka Hareket Form Data
export interface KasaBankaHareketFormData {
  hesap_id: number;
  islem_tipi: 'gelir' | 'gider' | 'transfer';
  tutar: number;
  tarih: string;
  aciklama: string;
  kategori?: string;
  cari_id?: number;
}

// =====================================================
// REALTIME SUBSCRIPTION TYPES
// =====================================================

// Postgres Changes Event Config
export interface PostgresChangesConfig {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  filter?: string;
}

// Realtime Channel Config
export interface RealtimeChannelConfig {
  channelName: string;
  config: PostgresChangesConfig;
  callback: (payload: RealtimePayload) => void;
}
