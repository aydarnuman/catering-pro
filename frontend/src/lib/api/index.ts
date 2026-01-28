/**
 * Merkezi API Servisleri Index
 * Tüm API servislerini tek yerden export eder.
 * api instance lib/api.ts'den gelir (Supabase Bearer + 401 refresh).
 */

export { api, apiClient } from '../api';
export * from './services/admin';
export { adminAPI } from './services/admin';

export * from './services/ai';
export { aiAPI } from './services/ai';
export * from './services/demirbas';
export { demirbasAPI } from './services/demirbas';
export * from './services/fatura-kalemleri';
export { faturaKalemleriAPI } from './services/fatura-kalemleri';
export * from './services/menu-planlama';
export { menuPlanlamaAPI } from './services/menu-planlama';
export * from './services/muhasebe';
export { muhasebeAPI } from './services/muhasebe';
export * from './services/personel';
export { personelAPI } from './services/personel';
export * from './services/scraper';
export { scraperAPI } from './services/scraper';
export * from './services/stok';
export { stokAPI } from './services/stok';
export * from './services/tenders';
export { tendersAPI } from './services/tenders';
export * from './services/urunler';
export { urunlerAPI } from './services/urunler';

export * from './types';
