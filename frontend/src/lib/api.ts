import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { Session } from '@supabase/supabase-js';
import { getApiBaseUrlDynamic } from '@/lib/config';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';

// Retry flag için tip genişletmesi
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Create axios instance
export const api = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
  withCredentials: true,
  validateStatus: (status) => status < 500,
});

// Token refresh durumu için flag
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Supabase client (singleton)
let supabaseClient: ReturnType<typeof createClient> | null = null;

// BASİTLEŞTİRİLMİŞ SESSION CACHE - Tek kaynak
let currentSession: Session | null = null;
let sessionTimestamp: number = 0;
const SESSION_CACHE_TTL = 60_000; // 60 saniye – her istekte Supabase getSession çağrısını azaltır

/**
 * AuthContext'ten session'ı alıp cache'e kaydet
 * Bu fonksiyon AuthContext tarafından çağrılır
 */
export function setGlobalSession(session: Session | null) {
  currentSession = session;
  sessionTimestamp = Date.now();

  if (session) {
    logger.debug('Session cache güncellendi');
  }
}

/**
 * Session cache'i temizle (logout için)
 */
export function clearGlobalSession() {
  currentSession = null;
  sessionTimestamp = 0;
}

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }
  return supabaseClient;
}

/**
 * Session'ı al - cache'den veya Supabase'den
 * BASİTLEŞTİRİLDİ: Karmaşık promise mekanizması kaldırıldı
 */
async function getCachedSession(): Promise<Session | null> {
  // 1. Cache geçerliyse hemen dön
  if (currentSession?.access_token && Date.now() - sessionTimestamp < SESSION_CACHE_TTL) {
    return currentSession;
  }

  // 2. Cache süresi dolmuş veya yok - Supabase'den al
  try {
    const supabase = getSupabase();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn('Session alınamadı:', error.message);
      return null;
    }

    if (session) {
      currentSession = session;
      sessionTimestamp = Date.now();
      return session;
    }

    return null;
  } catch (e) {
    console.error('Session fetch error:', e);
    return null;
  }
}

// Request interceptor
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    if (config.url && !config.url.startsWith('http://') && !config.url.startsWith('https://')) {
      const baseUrl = getApiBaseUrlDynamic();
      if (baseUrl) {
        config.baseURL = baseUrl;
      }
    }

    const session = await getCachedSession();

    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;

      if (
        config.url?.includes('/permissions') ||
        config.url?.includes('/urunler') ||
        config.url?.includes('/stok')
      ) {
        logger.debug('Token gönderiliyor', { url: config.url });
      }
    }
    // Token yoksa normal - auth olmadan sayfalar açılabilir
  } catch (error) {
    console.warn('Session alma hatası:', error);
  }

  return config;
});

// Response interceptor - 401'de token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

      if (error.response?.status === 401 && !originalRequest._retry) {
      const url = originalRequest.url || '';
      const ignoredEndpoints = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/uyumsoft', // Uyumsoft 401 = bağlantı/credential hatası, uygulama oturumundan çıkış değil
      ];

      if (ignoredEndpoints.some((endpoint) => url.includes(endpoint))) {
        return Promise.reject(error);
      }

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
        const {
          data: { session },
          error: refreshError,
        } = await supabase.auth.refreshSession();

        if (refreshError || !session) {
          isRefreshing = false;
          refreshSubscribers = [];
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/giris')) {
            window.location.href = '/giris';
          }
          return Promise.reject(error);
        }

        const newToken = session.access_token;
        setGlobalSession(session); // Global session'ı güncelle

        refreshSubscribers.forEach((cb) => {
          cb(newToken);
        });
        refreshSubscribers = [];
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (_refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/giris')) {
          window.location.href = '/giris';
        }
        return Promise.reject(error);
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

/**
 * Native fetch için auth wrapper
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const session = await getCachedSession();

  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const baseUrl = getApiBaseUrlDynamic();
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  const timeoutMs = 30000; // Ağır listeler (fatura, cari, Uyumsoft) için 30 sn
  const timeoutSignal = options.signal || AbortSignal.timeout(timeoutMs);

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include',
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
  const timeoutMs = 30000;
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
