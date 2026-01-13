/**
 * Fatura API Servisi
 * Backend API ile iletişimi yöneten servis
 */

import { API_BASE_URL } from '@/lib/config';

const API_URL = API_BASE_URL;

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
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * HTTP isteği yapar
 */
async function fetchAPI(endpoint: string, options?: RequestInit) {
  const url = `${API_URL}${endpoint}`;
  
  // Debug log
  console.log('🔍 API Çağrısı:', {
    url,
    method: options?.method || 'GET',
    endpoint,
    API_URL
  });
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        url: url,
        method: options?.method || 'GET'
      };
      
      console.error('❌ API Hatası:', errorDetails);
      
      // 404 hatası için özel mesaj
      if (response.status === 404) {
        throw new ApiError(response.status, `Endpoint bulunamadı: ${endpoint}`);
      }
      
      // CORS hatası kontrolü
      if (response.status === 0) {
        throw new ApiError(0, 'CORS hatası veya network problemi');
      }
      
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // JSON parse edilemezse default mesajı kullan
      }
      
      throw new ApiError(response.status, errorMessage);
    }

    const data = await response.json();
    console.log('✅ API Response:', {
      url,
      status: response.status,
      dataPreview: Array.isArray(data) ? `Array(${data.length})` : typeof data
    });
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error('Ağ hatası: ' + (error as Error).message);
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
 */
export const uyumsoftAPI = {
  /**
   * Bağlantı durumu
   */
  async status() {
    return fetchAPI('/api/uyumsoft/status');
  },

  /**
   * Bağlan
   */
  async connect(username: string, password: string, remember = true) {
    return fetchAPI('/api/uyumsoft/connect', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember }),
    });
  },

  /**
   * Kayıtlı bilgilerle bağlan
   */
  async connectSaved() {
    return fetchAPI('/api/uyumsoft/connect-saved', {
      method: 'POST',
    });
  },

  /**
   * Bağlantıyı kes
   */
  async disconnect() {
    return fetchAPI('/api/uyumsoft/disconnect', {
      method: 'POST',
    });
  },

  /**
   * Kimlik bilgilerini sil
   */
  async deleteCredentials() {
    return fetchAPI('/api/uyumsoft/credentials', {
      method: 'DELETE',
    });
  },

  /**
   * Faturaları senkronize et
   */
  async sync(months = 3, maxInvoices = 1000) {
    return fetchAPI('/api/uyumsoft/sync/blocking', {
      method: 'POST',
      body: JSON.stringify({ months, maxInvoices }),
    });
  },

  /**
   * Fatura detayı
   */
  async getInvoiceDetail(ettn: string) {
    return fetchAPI('/api/uyumsoft/sync/details', {
      method: 'POST',
      body: JSON.stringify({ ettn }),
    });
  },

  /**
   * Veritabanındaki Uyumsoft faturaları
   */
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
    return fetchAPI(`/api/uyumsoft/invoices${query ? `?${query}` : ''}`);
  },

  /**
   * Uyumsoft faturaları özeti
   */
  async getSummary() {
    return fetchAPI('/api/uyumsoft/invoices/summary');
  },
};

/**
 * Fatura verilerini Frontend formatına dönüştür
 */
export function convertToFrontendFormat(invoice: Invoice) {
  return {
    id: String(invoice.id),
    tip: invoice.invoice_type === 'sales' ? 'satis' as const : 'alis' as const,
    seri: invoice.series,
    no: invoice.invoice_no,
    cariId: String(invoice.customer_id || ''),
    cariUnvan: invoice.customer_name,
    tarih: invoice.invoice_date,
    vadeTarihi: invoice.due_date,
    kalemler: invoice.items?.map(item => ({
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

/**
 * Frontend verilerini API formatına dönüştür
 */
export function convertToAPIFormat(fatura: any): Omit<Invoice, 'id'> {
  return {
    invoice_type: fatura.tip === 'satis' ? 'sales' : 'purchase',
    series: fatura.seri,
    invoice_no: fatura.no,
    customer_name: fatura.cariUnvan,
    customer_vkn: fatura.cariVkn,
    invoice_date: fatura.tarih,
    due_date: fatura.vadeTarihi,
    status: fatura.durum,
    notes: fatura.notlar,
    items: fatura.kalemler?.map((kalem: any, index: number) => ({
      description: kalem.aciklama,
      category: kalem.category || kalem.aciklama.toLowerCase().includes('tavuk') ? 'tavuk' : 
               kalem.aciklama.toLowerCase().includes('et') ? 'et' :
               kalem.aciklama.toLowerCase().includes('sebze') ? 'sebze' : 'diger',
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
  async update(id: number, data: Partial<{ ad: string; renk: string; ikon: string; aciklama: string; aktif: boolean }>) {
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
