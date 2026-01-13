/**
 * Muhasebe Modülleri için Merkezi API Servisi
 * Tüm muhasebe işlemlerini backend üzerinden yönetir
 */

import { API_BASE_URL } from '@/lib/config';

const API_URL = API_BASE_URL;

// Base API Client
class MuhasebeAPI {
  private token: string | null = null;

  constructor() {
    // Token'ı localStorage'dan al (sadece token için kullanım)
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}/api${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint: string, params?: Record<string, any>) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`${endpoint}${queryString}`, {
      method: 'GET',
    });
  }

  // POST request
  async post(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }
}

// Singleton instance
const api = new MuhasebeAPI();

// Cariler API
export const carilerAPI = {
  list: (params?: any) => api.get('/cariler', params),
  get: (id: string) => api.get(`/cariler/${id}`),
  create: (data: any) => api.post('/cariler', data),
  update: (id: string, data: any) => api.put(`/cariler/${id}`, data),
  delete: (id: string) => api.delete(`/cariler/${id}`),
  
  // Cari hesap ekstreleri
  getStatement: (id: string, params?: any) => 
    api.get(`/cariler/${id}/statement`, params),
};

// Stok API
export const stokAPI = {
  list: (params?: any) => api.get('/stok', params),
  get: (id: string) => api.get(`/stok/${id}`),
  create: (data: any) => api.post('/stok', data),
  update: (id: string, data: any) => api.put(`/stok/${id}`, data),
  delete: (id: string) => api.delete(`/stok/${id}`),
  
  // Stok hareketleri
  movements: (stokId: string) => api.get(`/stok/${stokId}/movements`),
  addMovement: (stokId: string, data: any) => 
    api.post(`/stok/${stokId}/movements`, data),
  
  // Kritik stok raporu
  getCriticalItems: () => api.get('/stok/critical'),
};

// Gelir-Gider API
export const gelirGiderAPI = {
  list: (params?: any) => api.get('/gelir-gider', params),
  create: (data: any) => api.post('/gelir-gider', data),
  update: (id: string, data: any) => api.put(`/gelir-gider/${id}`, data),
  delete: (id: string) => api.delete(`/gelir-gider/${id}`),
  
  // Özet raporlar
  getSummary: (period: 'daily' | 'monthly' | 'yearly', date?: string) =>
    api.get('/gelir-gider/summary', { period, date }),
  
  // Kategori bazlı analiz
  getCategoryAnalysis: (startDate: string, endDate: string) =>
    api.get('/gelir-gider/analysis', { startDate, endDate }),
};

// Personel API
export const personelAPI = {
  list: (params?: any) => api.get('/personel', params),
  get: (id: string) => api.get(`/personel/${id}`),
  create: (data: any) => api.post('/personel', data),
  update: (id: string, data: any) => api.put(`/personel/${id}`, data),
  delete: (id: string) => api.delete(`/personel/${id}`),
  
  // Maaş işlemleri
  getSalaryHistory: (id: string) => api.get(`/personel/${id}/salaries`),
  processSalary: (data: any) => api.post('/personel/salary-batch', data),
};

// Satın Alma API
export const satinAlmaAPI = {
  listRequests: (params?: any) => api.get('/satin-alma/talepler', params),
  createRequest: (data: any) => api.post('/satin-alma/talepler', data),
  updateRequest: (id: string, data: any) => 
    api.put(`/satin-alma/talepler/${id}`, data),
  
  // Onay işlemleri
  approveRequest: (id: string) => 
    api.post(`/satin-alma/talepler/${id}/approve`),
  rejectRequest: (id: string, reason: string) => 
    api.post(`/satin-alma/talepler/${id}/reject`, { reason }),
    
  // Sipariş dönüşümü
  convertToOrder: (requestId: string) =>
    api.post(`/satin-alma/talepler/${requestId}/convert-to-order`),
};

// Kasa-Banka API
export const kasaBankaAPI = {
  // Hesaplar
  listAccounts: () => api.get('/kasa-banka/hesaplar'),
  createAccount: (data: any) => api.post('/kasa-banka/hesaplar', data),
  updateAccount: (id: string, data: any) => 
    api.put(`/kasa-banka/hesaplar/${id}`, data),
  
  // Hareketler
  listTransactions: (params?: any) => api.get('/kasa-banka/hareketler', params),
  createTransaction: (data: any) => api.post('/kasa-banka/hareketler', data),
  
  // Transfer işlemleri
  transfer: (fromId: string, toId: string, amount: number, description?: string) =>
    api.post('/kasa-banka/transfer', {
      fromAccountId: fromId,
      toAccountId: toId,
      amount,
      description
    }),
    
  // Bakiye özeti
  getBalanceSummary: () => api.get('/kasa-banka/balance-summary'),
};

// Dashboard API
export const dashboardAPI = {
  // Ana özet veriler
  getSummary: () => api.get('/muhasebe/dashboard'),
  
  // Gelir/Gider trendi (grafik için)
  getMonthlyTrend: (year?: number) => 
    api.get('/muhasebe/dashboard/trend', { year }),
  
  // Gider dağılımı (pie chart için)
  getExpenseDistribution: (period?: string) =>
    api.get('/muhasebe/dashboard/expense-distribution', { period }),
  
  // Son işlemler
  getRecentTransactions: (limit: number = 10) =>
    api.get('/muhasebe/dashboard/recent-transactions', { limit }),
    
  // Yaklaşan ödemeler
  getUpcomingPayments: () =>
    api.get('/muhasebe/dashboard/upcoming-payments'),
    
  // Hızlı istatistikler
  getQuickStats: () =>
    api.get('/muhasebe/dashboard/quick-stats'),
};

export default api;
