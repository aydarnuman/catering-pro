/**
 * Fatura API Servisi
 * Backend API ile iletişimi yöneten servis
 */

import { authFetch } from '@/lib/api';
import { API_BASE_URL, getApiBaseUrlDynamic } from '@/lib/config';

// InvoiceItem lokalde tanımlı - domain.ts'den import etmiyoruz

const API_URL = API_BASE_URL;

/**
 * Uyumsoft fatura doküman URL'leri
 */
export const uyumsoftDocUrls = {
  pdf: (ettn: string) => `${API_BASE_URL}/api/uyumsoft/invoice/${ettn}/pdf`,
  html: (ettn: string) => `${API_BASE_URL}/api/uyumsoft/invoice/${ettn}/html`,
  xml: (ettn: string) => `${API_BASE_URL}/api/uyumsoft/invoice/${ettn}/xml`,
};

// Tip tanımları
export interface Invoice {
  id?: number;
  invoice_type: 'sales' | 'purchase';
  series: string;
  invoice_no: string;
  customer_id?: number;
  customer_name: string;
  customer_vkn?: string;
  customer_address?: string;
  customer_phone?: string;
  customer_email?: string;
  invoice_date: string;
  due_date: string;
  subtotal?: number;
  vat_total?: number;
  total_amount?: number;
  currency?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  payment_status?: 'pending' | 'partial' | 'paid';
  notes?: string;
  internal_notes?: string;
  source?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  description: string;
  product_code?: string;
  category?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  vat_amount?: number;
  line_total?: number;
  line_total_with_vat?: number;
  discount_rate?: number;
  discount_amount?: number;
  line_order?: number;
}

export interface InvoiceListParams {
  type?: 'sales' | 'purchase';
  status?: string;
  customer?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface InvoiceSummary {
  month?: string;
  invoice_type?: string;
  count: number;
  subtotal: number;
  vat_total: number;
  total_amount: number;
}

export interface CategorySummary {
  category: string;
  invoice_count: number;
  total_quantity: number;
  total_amount: number;
  avg_unit_price: number;
}

export interface UyumsoftInvoice {
  id?: number;
  ettn: string;
  invoice_id?: string;
  invoice_no: string;
  invoice_type?: string;
  invoice_date: string;
  creation_date?: string;
  sender_vkn: string;
  sender_name: string;
  sender_email?: string;
  taxable_amount: number;
  tax_amount: number;
  payable_amount: number;
  currency: string;
  status?: string;
  is_new?: boolean;
  is_seen?: boolean;
  is_verified?: boolean;
  dbId?: number;
}

/**
 * API Error Handler
 */
class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fatura/lista istekleri için varsayılan timeout (ms) */
const FETCH_API_TIMEOUT_MS = 30000;

/**
 * HTTP isteği yapar - cookie-only authentication, 30 sn timeout
 */
async function fetchAPI(endpoint: string, options?: RequestInit) {
  const url = `${API_URL}${endpoint}`;
  const signal = options?.signal ?? AbortSignal.timeout(FETCH_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal,
      credentials: 'include', // Cookie'leri gönder
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText;

      console.error(`❌ API Hatası: ${status} ${statusText} - ${options?.method || 'GET'} ${url}`);

      // 401 hatası için özel mesaj (yetkisiz erişim)
      if (status === 401) {
        throw new ApiError(status, 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
      }

      // 403 hatası için özel mesaj (yetki yok)
      if (status === 403) {
        throw new ApiError(status, 'Bu işlem için yetkiniz bulunmuyor.');
      }

      // 404 hatası için özel mesaj
      if (status === 404) {
        throw new ApiError(status, `Endpoint bulunamadı: ${endpoint}`);
      }

      // CORS hatası kontrolü
      if (status === 0) {
        throw new ApiError(0, 'CORS hatası veya network problemi');
      }

      let errorMessage = `HTTP ${status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (_e) {
        // JSON parse edilemezse default mesajı kullan
      }

      throw new ApiError(status, errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(`Ağ hatası: ${(error as Error).message}`);
  }
}

/**
 * Uyumsoft istekleri için auth’lu fetch (Bearer token → CSRF atlanır, 403 önlenir)
 * Base URL her istekte güncel alınır (SSR / farklı origin senaryolarında doğru adrese gider).
 */
async function fetchUyumsoftAPI(endpoint: string, options?: RequestInit) {
  const base = typeof getApiBaseUrlDynamic === 'function' ? getApiBaseUrlDynamic() : API_URL || '';
  const url = endpoint.startsWith('http') ? endpoint : `${base || API_URL}${endpoint}`;
  const response = await authFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const status = response.status;
    const statusText = response.statusText;
    console.error(`❌ Uyumsoft API: ${status} ${statusText} - ${options?.method || 'GET'} ${endpoint}`);
    let errorMessage = `HTTP ${status}`;
    try {
      const text = await response.text();
      const errorData = text ? JSON.parse(text) : null;
      errorMessage =
        (errorData as { error?: string })?.error ??
        (errorData as { message?: string })?.message ??
        (status === 401 ? 'Oturum süresi dolmuş veya Uyumsoft bağlantısı yok.' : errorMessage);
    } catch {
      if (status === 401) errorMessage = 'Oturum süresi dolmuş veya Uyumsoft bağlantısı yok.';
    }
    if (status === 403) throw new ApiError(status, 'Bu işlem için yetkiniz bulunmuyor.');
    if (status === 404) throw new ApiError(status, `Endpoint bulunamadı: ${endpoint}`);
    if (status === 0) throw new ApiError(0, 'Backend erişilemiyor. CORS veya adres (API URL) kontrol edin.');
    throw new ApiError(status, errorMessage);
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError(0, 'Backend yanıtı okunamadı.');
  }
}

/**
 * Fatura API Servisi
 */
export const invoiceAPI = {
  /**
   * Tüm faturaları listele
   */
  async list(params?: InvoiceListParams) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    const endpoint = `/api/invoices${query ? `?${query}` : ''}`;
    return fetchAPI(endpoint);
  },

  /**
   * Tek bir fatura detayı
   */
  async get(id: number) {
    return fetchAPI(`/api/invoices/${id}`);
  },

  /**
   * Yeni fatura oluştur
   */
  async create(invoice: Omit<Invoice, 'id'>) {
    return fetchAPI('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(invoice),
    });
  },

  /**
   * Fatura güncelle
   */
  async update(id: number, invoice: Partial<Invoice>) {
    return fetchAPI(`/api/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(invoice),
    });
  },

  /**
   * Fatura durumunu güncelle
   */
  async updateStatus(id: number, status: Invoice['status']) {
    return fetchAPI(`/api/invoices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  /**
   * Fatura sil
   */
  async delete(id: number) {
    return fetchAPI(`/api/invoices/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Aylık özet
   */
  async getMonthlySummary(year?: number, type?: string) {
    const params = new URLSearchParams();
    if (year) params.append('year', String(year));
    if (type) params.append('type', type);

    const query = params.toString();
    return fetchAPI(`/api/invoices/summary/monthly${query ? `?${query}` : ''}`);
  },

  /**
   * Kategori özeti
   */
  async getCategorySummary(startDate?: string, endDate?: string, type = 'purchase') {
    const params = new URLSearchParams();
    params.append('type', type);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const query = params.toString();
    return fetchAPI(`/api/invoices/summary/category?${query}`);
  },
};

/**
 * Uyumsoft API Servisi
 * Tüm istekler authFetch ile gider → Bearer token sayesinde CSRF atlanır, 403 önlenir.
 */
export const uyumsoftAPI = {
  async status() {
    return fetchUyumsoftAPI('/api/uyumsoft/status');
  },

  async connect(username: string, password: string, remember = true) {
    return fetchUyumsoftAPI('/api/uyumsoft/connect', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember }),
    });
  },

  async connectSaved() {
    return fetchUyumsoftAPI('/api/uyumsoft/connect-saved', {
      method: 'POST',
    });
  },

  async disconnect() {
    return fetchUyumsoftAPI('/api/uyumsoft/disconnect', {
      method: 'POST',
    });
  },

  async deleteCredentials() {
    return fetchUyumsoftAPI('/api/uyumsoft/credentials', {
      method: 'DELETE',
    });
  },

  async sync(months = 3, maxInvoices = 1000) {
    return fetchUyumsoftAPI('/api/uyumsoft/sync/blocking', {
      method: 'POST',
      body: JSON.stringify({ months, maxInvoices }),
      signal: AbortSignal.timeout(120000), // Sync uzun sürebilir, 2 dakika
    });
  },

  async getInvoiceDetail(ettn: string) {
    return fetchUyumsoftAPI('/api/uyumsoft/sync/details', {
      method: 'POST',
      body: JSON.stringify({ ettn }),
    });
  },

  async getInvoices(params?: {
    startDate?: string;
    endDate?: string;
    sender?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return fetchUyumsoftAPI(`/api/uyumsoft/invoices${query ? `?${query}` : ''}`);
  },

  async getSummary() {
    return fetchUyumsoftAPI('/api/uyumsoft/invoices/summary');
  },
};

/**
 * Fatura verilerini Frontend formatına dönüştür
 */
export function convertToFrontendFormat(invoice: Invoice) {
  return {
    id: String(invoice.id),
    tip: invoice.invoice_type === 'sales' ? ('satis' as const) : ('alis' as const),
    seri: invoice.series,
    no: invoice.invoice_no,
    cariId: String(invoice.customer_id || ''),
    cariUnvan: invoice.customer_name,
    tarih: invoice.invoice_date,
    vadeTarihi: invoice.due_date,
    kalemler:
      invoice.items?.map((item) => ({
        id: String(item.id || Date.now()),
        aciklama: item.description,
        miktar: item.quantity,
        birim: item.unit,
        birimFiyat: item.unit_price,
        kdvOrani: item.vat_rate,
        tutar: item.line_total || 0,
      })) || [],
    araToplam: invoice.subtotal || 0,
    kdvToplam: invoice.vat_total || 0,
    genelToplam: invoice.total_amount || 0,
    durum: invoice.status,
    notlar: invoice.notes || '',
    createdAt: invoice.created_at || new Date().toISOString(),
    kaynak: invoice.source || 'manual',
  };
}

// Frontend fatura kalemi formatı (türkçe)
interface FrontendFaturaKalemi {
  id?: string;
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  kdvOrani: number;
  tutar?: number;
  category?: string;
}

// Frontend durum tipi (türkçe)
type FrontendDurum = 'taslak' | 'gonderildi' | 'odendi' | 'gecikti' | 'iptal' | Invoice['status'];

// Frontend fatura formatı (türkçe)
interface FrontendFatura {
  tip: 'satis' | 'alis';
  seri: string;
  no: string;
  cariUnvan: string;
  cariVkn?: string;
  tarih: string;
  vadeTarihi: string;
  durum: FrontendDurum;
  notlar?: string;
  kalemler?: FrontendFaturaKalemi[];
}

// Türkçe durum -> API durum dönüşüm
function convertDurum(durum: FrontendDurum): Invoice['status'] {
  const durumMap: Record<string, Invoice['status']> = {
    taslak: 'draft',
    gonderildi: 'sent',
    odendi: 'paid',
    gecikti: 'overdue',
    iptal: 'cancelled',
    // İngilizce durumlar zaten doğru
    draft: 'draft',
    sent: 'sent',
    paid: 'paid',
    overdue: 'overdue',
    cancelled: 'cancelled',
  };
  return durumMap[durum] || 'draft';
}

/**
 * Frontend verilerini API formatına dönüştür
 */
export function convertToAPIFormat(fatura: FrontendFatura): Omit<Invoice, 'id'> {
  return {
    invoice_type: fatura.tip === 'satis' ? 'sales' : 'purchase',
    series: fatura.seri,
    invoice_no: fatura.no,
    customer_name: fatura.cariUnvan,
    customer_vkn: fatura.cariVkn,
    invoice_date: fatura.tarih,
    due_date: fatura.vadeTarihi,
    status: convertDurum(fatura.durum),
    notes: fatura.notlar,
    items: fatura.kalemler?.map((kalem, index) => ({
      description: kalem.aciklama,
      category:
        kalem.category || kalem.aciklama.toLowerCase().includes('tavuk')
          ? 'tavuk'
          : kalem.aciklama.toLowerCase().includes('et')
            ? 'et'
            : kalem.aciklama.toLowerCase().includes('sebze')
              ? 'sebze'
              : 'diger',
      quantity: kalem.miktar,
      unit: kalem.birim,
      unit_price: kalem.birimFiyat,
      vat_rate: kalem.kdvOrani,
      line_order: index + 1,
    })),
  };
}

/**
 * Etiketler API Servisi
 */
export const etiketlerAPI = {
  /**
   * Tüm etiketleri listele
   */
  async list(aktif = true) {
    return fetchAPI(`/api/etiketler?aktif=${aktif}`);
  },

  /**
   * Yeni etiket oluştur
   */
  async create(etiket: { kod: string; ad: string; renk?: string; ikon?: string; aciklama?: string }) {
    return fetchAPI('/api/etiketler', {
      method: 'POST',
      body: JSON.stringify(etiket),
    });
  },

  /**
   * Etiket güncelle
   */
  async update(
    id: number,
    data: Partial<{ ad: string; renk: string; ikon: string; aciklama: string; aktif: boolean }>
  ) {
    return fetchAPI(`/api/etiketler/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Etiket sil
   */
  async delete(id: number) {
    return fetchAPI(`/api/etiketler/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Faturanın etiketlerini getir
   */
  async getFaturaEtiketler(ettn: string) {
    return fetchAPI(`/api/etiketler/fatura/${ettn}`);
  },

  /**
   * Faturaya etiket ata
   */
  async addToFatura(ettn: string, etiketId: number, notlar?: string) {
    return fetchAPI(`/api/etiketler/fatura/${ettn}`, {
      method: 'POST',
      body: JSON.stringify({ etiket_id: etiketId, notlar }),
    });
  },

  /**
   * Faturadan etiket kaldır
   */
  async removeFromFatura(ettn: string, etiketId: number) {
    return fetchAPI(`/api/etiketler/fatura/${ettn}/${etiketId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Faturanın tüm etiketlerini güncelle
   */
  async updateFaturaEtiketler(ettn: string, etiketIds: number[]) {
    return fetchAPI(`/api/etiketler/fatura/${ettn}`, {
      method: 'PUT',
      body: JSON.stringify({ etiket_ids: etiketIds }),
    });
  },

  /**
   * Etiket bazlı rapor
   */
  async getRapor() {
    return fetchAPI('/api/etiketler/raporlar/etiket-bazli');
  },

  /**
   * Birden fazla faturanın etiketlerini tek seferde getir
   */
  async getBulkFaturaEtiketler(ettnList: string[]) {
    return fetchAPI('/api/etiketler/fatura/bulk', {
      method: 'POST',
      body: JSON.stringify({ ettn_list: ettnList }),
    });
  },
};

export default {
  invoice: invoiceAPI,
  uyumsoft: uyumsoftAPI,
  etiketler: etiketlerAPI,
  convertToFrontendFormat,
  convertToAPIFormat,
};
