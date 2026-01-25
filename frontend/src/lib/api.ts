import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios';
import { API_BASE_URL } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';

// Retry flag için tip genişletmesi
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 saniye (scraper gibi uzun işlemler için)
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
  withCredentials: true,
  // 304 response'ları da handle et
  validateStatus: (status) => status < 500, // 200-499 arası status kodları başarılı say
});

// Token refresh durumu için flag
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Supabase client (singleton)
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }
  return supabaseClient;
}

// Request interceptor - Supabase token ekle
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const supabase = getSupabase();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.warn('Supabase session error:', sessionError);
    }
    
    if (session?.access_token) {
      // Token'ın geçerli olduğunu kontrol et (JWT formatında olmalı)
      const tokenParts = session.access_token.split('.');
      if (tokenParts.length !== 3) {
        console.warn('⚠️ Token formatı geçersiz (JWT 3 parça olmalı):', {
          url: config.url,
          tokenLength: session.access_token.length,
          tokenParts: tokenParts.length
        });
      }
      
      config.headers.Authorization = `Bearer ${session.access_token}`;
      // Debug: Token gönderildiğini logla (sadece development'ta ve önemli endpoint'ler için)
      if (process.env.NODE_ENV === 'development' && (
        config.url?.includes('/permissions') || 
        config.url?.includes('/urunler') || 
        config.url?.includes('/stok')
      )) {
        console.log('🔑 Token gönderiliyor:', {
          url: config.url,
          method: config.method,
          tokenPreview: session.access_token.substring(0, 30) + '...',
          tokenLength: session.access_token.length,
          tokenParts: tokenParts.length,
          hasToken: !!session.access_token
        });
      }
    } else {
      // Debug: Token yoksa logla (tüm endpoint'ler için)
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Token bulunamadı:', {
          url: config.url,
          method: config.method,
          hasSession: !!session,
          hasAccessToken: !!session?.access_token,
          sessionKeys: session ? Object.keys(session) : []
        });
      }
    }
  } catch (error) {
    console.warn('Could not get Supabase session:', error);
  }
  
  return config;
});

// Response interceptor - 401'de token refresh dene
api.interceptors.response.use(
  (response) => {
    // 304 Not Modified başarılı bir response, ama body olmayabilir
    // Eğer 304 ise ve data yoksa, cache'den geliyor demektir - bu normal
    if (response.status === 304 && !response.data) {
      // 304 response'u olduğu gibi döndür (cache'den geliyor)
      return response;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig | undefined;
    
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 401 hatası - token refresh dene
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Bazı endpoint'ler için 401'i ignore et
      const url = originalRequest.url || '';
      const ignoredEndpoints = [
        '/api/auth/login',
        '/api/auth/register',
      ];
      
      if (ignoredEndpoints.some(endpoint => url.includes(endpoint))) {
        return Promise.reject(error);
      }

      // Debug: 401 hatası logla
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ 401 Unauthorized - Token refresh deneniyor:', {
          url: originalRequest.url,
          method: originalRequest.method,
          hasAuthHeader: !!originalRequest.headers?.Authorization
        });
      }

      // Token refresh zaten yapılıyorsa bekle
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const supabase = getSupabase();
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !session) {
          // Refresh başarısız - login'e yönlendir
          isRefreshing = false;
          refreshSubscribers = [];
          
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/giris')) {
            window.location.href = '/giris';
          }
          
          return Promise.reject(error);
        }

        const newToken = session.access_token;
        
        // Bekleyen istekleri bilgilendir
        refreshSubscribers.forEach(cb => cb(newToken));
        refreshSubscribers = [];
        isRefreshing = false;

      // Orijinal isteği yeni token ile tekrar dene
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } else {
        // Token refresh başarısız - login'e yönlendir
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/giris')) {
          window.location.href = '/giris';
        }
        return Promise.reject(error);
      }
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/giris')) {
          window.location.href = '/giris';
        }
        
        return Promise.reject(error);
      }
    }

    // Diğer hataları logla (development'ta)
    if (process.env.NODE_ENV === 'development' && error.response) {
      console.error('❌ API Hatası:', {
        url: originalRequest?.url,
        method: originalRequest?.method,
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
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
  async uploadDocument(file: File, metadata?: Record<string, unknown>) {
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
