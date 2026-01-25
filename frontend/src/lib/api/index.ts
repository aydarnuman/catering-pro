/**
 * Merkezi API Servisleri Index
 * Tüm API servislerini tek yerden export eder
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/lib/config';

// Retry flag için tip genişletmesi
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Base API instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // HttpOnly cookie'leri her istekte gönder
});

// Request interceptor - geriye uyumluluk için localStorage token desteği
// Yeni sistemde cookie kullanılıyor, bu sadece geçiş dönemi için
api.interceptors.request.use((config) => {
  // Geriye uyumluluk: localStorage'da hala token varsa gönder
  // Bu sadece migration döneminde aktif olacak
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor - 401 hatalarında otomatik token yenileme
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // 401 hatası ve henüz retry yapılmamışsa
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Token yenilemeyi dene
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        if (refreshResponse.status === 200) {
          // Token yenilendi, orijinal isteği tekrarla
          return api.request(originalRequest);
        }
      } catch (refreshError) {
        // Refresh başarısız - kullanıcı logout edilmeli
        console.error('Token refresh failed:', refreshError);

        // Event emit et - AuthContext dinleyecek
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:token-expired'));
        }
      }
    }

    return Promise.reject(error);
  }
);

// Scraper servisleri
export * from './services/scraper';
export { scraperAPI } from './services/scraper';

// AI servisleri
export * from './services/ai';
export { aiAPI } from './services/ai';

// Menu Planlama servisleri
export * from './services/menu-planlama';
export { menuPlanlamaAPI } from './services/menu-planlama';

// Tenders servisleri
export * from './services/tenders';
export { tendersAPI } from './services/tenders';

// Ürünler servisleri
export * from './services/urunler';
export { urunlerAPI } from './services/urunler';

// Stok servisleri
export * from './services/stok';
export { stokAPI } from './services/stok';

// Muhasebe servisleri
export * from './services/muhasebe';
export { muhasebeAPI } from './services/muhasebe';

// Admin servisleri
export * from './services/admin';
export { adminAPI } from './services/admin';

// Personel servisleri
export * from './services/personel';
export { personelAPI } from './services/personel';

// Demirbas servisleri
export * from './services/demirbas';
export { demirbasAPI } from './services/demirbas';

// Types
export * from './types';
