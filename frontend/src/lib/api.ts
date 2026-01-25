import axios, { type AxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/config';
import { getCsrfToken } from '@/lib/csrf';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 saniye (scraper gibi uzun işlemler için)
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Cookie'leri göndermek için
});

// Token refresh durumu için flag (sonsuz döngüyü önlemek için)
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

// Request interceptor
api.interceptors.request.use((config: any) => {
  // Add auth token if available
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add CSRF token for unsafe methods
  const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const method = config.method?.toUpperCase();
  
  if (method && unsafeMethods.includes(method)) {
    // CSRF koruması olmayan endpoint'ler
    const excludedPaths = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/logout'
    ];
    
    const url = config.url || '';
    const isExcluded = excludedPaths.some(path => url.includes(path));
    
    if (!isExcluded && config.headers) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
  }
  
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // CSRF token'ı response header'dan al ve cache'le (varsa)
    const csrfToken = response.headers['x-csrf-token'];
    if (csrfToken && typeof window !== 'undefined') {
      // Cookie zaten set edilmiş olacak, sadece cache'le
      try {
        localStorage.setItem('csrf_token_cache', csrfToken);
      } catch (e) {
        // localStorage kullanılamıyorsa sessizce devam et
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 401 hatası - token refresh dene
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Bazı endpoint'ler için 401'i ignore et (opsiyonel özellikler)
      const url = originalRequest.url || '';
      const ignoredEndpoints = [
        '/api/auth/sessions', // Session endpoint opsiyonel
        '/api/auth/login',    // Login endpoint zaten auth gerektirmez
        '/api/auth/register', // Register endpoint zaten auth gerektirmez
      ];
      
      const shouldIgnore = ignoredEndpoints.some(endpoint => url.includes(endpoint));
      
      if (shouldIgnore) {
        return Promise.reject(error);
      }

      // Token refresh zaten yapılıyorsa, bekleyen istekleri queue'ya ekle
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push((token) => {
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Token refresh dene
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshResponse.ok) {
          // Refresh başarılı - kullanıcı bilgisini tekrar al
          const meResponse = await fetch(API_ENDPOINTS.AUTH_ME, {
            credentials: 'include',
          });

          if (meResponse.ok) {
            const meData = await meResponse.json();
            // Token cookie'de, localStorage'a eklemeye gerek yok
            const token = 'cookie-based';
            
            // AuthContext'e token refresh başarılı olduğunu bildir
            if (typeof window !== 'undefined' && meData.user) {
              window.dispatchEvent(new CustomEvent('auth:token-refreshed', { 
                detail: { user: meData.user } 
              }));
            }
            
            // Bekleyen tüm istekleri notify et
            refreshSubscribers.forEach(cb => cb(token));
            refreshSubscribers = [];

            // Orijinal isteği tekrar dene
            if (originalRequest.headers) {
              // Cookie-based auth kullanıyoruz, Bearer token gerekmez
              delete originalRequest.headers.Authorization;
            }
            return api(originalRequest);
          }
        }

        // Refresh başarısız - logout yap
        isRefreshing = false;
        refreshSubscribers = [];
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:token-expired'));
        }
        
        return Promise.reject(error);
      } catch (refreshError) {
        // Refresh hatası - logout yap
        isRefreshing = false;
        refreshSubscribers = [];
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:token-expired'));
        }
        
        return Promise.reject(error);
      }
    }
    
    // CSRF hatası durumunda token'ı yenile (reload yapma)
    if (error.response?.status === 403 && error.response?.data?.code === 'CSRF_ERROR') {
      // CSRF token'ı cache'den temizle, bir sonraki istekte yeniden alınacak
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('csrf_token_cache');
        } catch (e) {
          // Sessizce devam et
        }
        console.warn('CSRF token hatası, token temizlendi. İstek tekrar denenebilir.');
      }
    }
    
    return Promise.reject(error);
  }
);

// API functions
export const apiClient = {
  // Tenders
  async getTenders(params?: {
    page?: number;
    limit?: number;
    city?: string;
    search?: string;
    status?: string;
  }) {
    const response = await api.get('/api/tenders', { params });
    return response.data;
  },

  async getTenderById(id: string) {
    const response = await api.get(`/api/tenders/${id}`);
    return response.data;
  },

  // Documents
  async uploadDocument(file: File, metadata?: Record<string, any>) {
    const formData = new FormData();
    formData.append('file', file);

    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getDocuments() {
    const response = await api.get('/api/documents');
    return response.data;
  },

  async getTenderDocuments(tenderId: string) {
    const response = await api.get(`/api/documents/list/${tenderId}`);
    return response.data;
  },

  getDocumentDownloadUrl(tenderId: string, docType: string) {
    return `${API_BASE_URL}/api/documents/download/${tenderId}/${docType}`;
  },

  async scrapeDocumentsForTender(tenderId: string) {
    const response = await api.post(`/api/documents/scrape/${tenderId}`);
    return response.data;
  },

  // Health check
  async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  },

  // Stats
  async getStats() {
    const response = await api.get('/api/stats');
    return response.data;
  },
};

export default apiClient;
