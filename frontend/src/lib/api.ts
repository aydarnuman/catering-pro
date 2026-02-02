/**
 * API CLIENT - PostgreSQL Only (Simplified)
 * Supabase Session KALDIRILDI - Cookie-based auth
 *
 * Token yönetimi artık backend tarafından cookie ile yapılıyor.
 * Frontend sadece credentials: 'include' ile istekleri gönderiyor.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getApiBaseUrlDynamic } from '@/lib/config';

// Retry flag için tip genişletmesi
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Create axios instance
export const api = axios.create({
  baseURL: '',
  timeout: 300000, // 5 dakika - uzun işlemler için (scraper, analiz vb.)
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
  withCredentials: true, // Cookie'leri otomatik gönder
  validateStatus: (status) => status < 500,
});

// Request interceptor - Sadece base URL ayarla
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // URL base'i ayarla
  if (config.url && !config.url.startsWith('http://') && !config.url.startsWith('https://')) {
    const baseUrl = getApiBaseUrlDynamic();
    if (baseUrl) {
      config.baseURL = baseUrl;
    }
  }

  // Cookie'ler otomatik gönderilecek (withCredentials: true)
  // Authorization header'a gerek yok

  return config;
});

// Response interceptor - 401 hatalarında login'e yönlendir
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 401 hatası
    if (error.response?.status === 401 && !originalRequest._retry) {
      const url = originalRequest.url || '';

      // Bu endpoint'lerde 401 bekleniyor, yönlendirme yapma
      const ignoredEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/me'];
      if (ignoredEndpoints.some((endpoint) => url.includes(endpoint))) {
        return Promise.reject(error);
      }

      // Token yenilemeyi dene
      originalRequest._retry = true;

      try {
        const baseUrl = getApiBaseUrlDynamic();
        const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshResponse.ok) {
          // Token yenilendi, isteği tekrar et
          return api(originalRequest);
        }
      } catch {
        // Refresh başarısız
      }

      // Login sayfasına yönlendir
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/giris')) {
        window.location.href = '/giris';
      }
    }

    return Promise.reject(error);
  }
);

// API functions
export const apiClient = {
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

  async uploadDocument(file: File, metadata?: Record<string, unknown>) {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    const response = await api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
    return `${getApiBaseUrlDynamic()}/api/documents/download/${tenderId}/${docType}`;
  },

  async scrapeDocumentsForTender(tenderId: string) {
    const response = await api.post(`/api/documents/scrape/${tenderId}`);
    return response.data;
  },

  async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  },

  async getStats() {
    const response = await api.get('/api/stats');
    return response.data;
  },
};

export default apiClient;

/** Tarayıcıda csrf-token cookie'sinden token oku (POST/PUT/DELETE için backend CSRF doğrulaması) */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * Native fetch için auth wrapper
 * Cookie'ler otomatik gönderiliyor; mutating isteklerde x-csrf-token header eklenir
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  const baseUrl = getApiBaseUrlDynamic();
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  const timeoutMs = 300000; // 5 dakika
  const timeoutSignal = options.signal || AbortSignal.timeout(timeoutMs);

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include', // Cookie'leri gönder
    signal: timeoutSignal,
  });

  return response;
}

/**
 * Basit fetch wrapper - Auth YOK, sadece timeout
 */
export function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getApiBaseUrlDynamic();
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  const timeoutMs = 300000; // 5 dakika
  const timeoutSignal = options.signal || AbortSignal.timeout(timeoutMs);

  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include',
    signal: timeoutSignal,
  });
}
