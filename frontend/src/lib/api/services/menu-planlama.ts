/**
 * Menu Planlama API Servisleri
 * Reçete, malzeme ve maliyet analizi için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// Reçete
export interface Recete {
  id: number;
  ad: string;
  kategori?: string;
  porsiyon?: number;
  aciklama?: string;
  malzemeler?: Malzeme[];
  toplam_maliyet?: number;
  toplam_piyasa_maliyet?: number;
  created_at?: string;
  updated_at?: string;
  // Backend'den gelen ek alanlar
  kategori_id?: number;
  kategori_adi?: string;
  kategori_ikon?: string;
  porsiyon_miktar?: number;
  tahmini_maliyet?: number;
  malzeme_sayisi?: number;
  kod?: string;
  hazirlik_suresi?: number;
  pisirme_suresi?: number;
  kalori?: number;
  protein?: number;
  karbonhidrat?: number;
  yag?: number;
  ai_olusturuldu?: boolean;
  proje_id?: number;
  proje_adi?: string;
}

// Malzeme
export interface Malzeme {
  id?: number;
  recete_id?: number;
  urun_adi?: string;
  stok_kart_id?: number;
  urun_kart_id?: number;
  miktar: number;
  birim: string;
  sistem_fiyat?: number;
  piyasa_fiyat?: number;
  maliyet?: number;
}

// Reçete Kategorisi
export interface ReceteKategori {
  id: number;
  ad: string;
  aciklama?: string;
}

// Menu Planlama API
export const menuPlanlamaAPI = {
  /**
   * Reçeteleri listele
   */
  async getReceteler(params?: {
    kategori?: string;
    arama?: string;
    limit?: number;
  }): Promise<ApiResponse<Recete[]>> {
    const response = await api.get('/api/menu-planlama/receteler', { params });
    return response.data;
  },

  /**
   * Reçete detayını getir
   */
  async getRecete(id: number): Promise<ApiResponse<Recete>> {
    const response = await api.get(`/api/menu-planlama/receteler/${id}`);
    return response.data;
  },

  /**
   * Reçete oluştur
   */
  async createRecete(recete: Partial<Recete>): Promise<ApiResponse<Recete>> {
    const response = await api.post('/api/menu-planlama/receteler', recete);
    return response.data;
  },

  /**
   * Reçete güncelle
   */
  async updateRecete(id: number, recete: Partial<Recete>): Promise<ApiResponse<Recete>> {
    const response = await api.put(`/api/menu-planlama/receteler/${id}`, recete);
    return response.data;
  },

  /**
   * Reçete sil
   */
  async deleteRecete(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/menu-planlama/receteler/${id}`);
    return response.data;
  },

  /**
   * Reçete kategorilerini getir
   */
  async getKategoriler(): Promise<ApiResponse<ReceteKategori[]>> {
    const response = await api.get('/api/menu-planlama/kategoriler');
    return response.data;
  },

  /**
   * Malzeme ekle/güncelle
   */
  async saveMalzeme(receteId: number, malzeme: Partial<Malzeme>): Promise<ApiResponse<Malzeme>> {
    const response = await api.post(`/api/menu-planlama/receteler/${receteId}/malzemeler`, malzeme);
    return response.data;
  },

  /**
   * Malzeme güncelle
   */
  async updateMalzeme(malzemeId: number, malzeme: Partial<Malzeme>): Promise<ApiResponse<Malzeme>> {
    const response = await api.put(`/api/menu-planlama/malzemeler/${malzemeId}`, malzeme);
    return response.data;
  },

  /**
   * Malzeme sil
   */
  async deleteMalzeme(malzemeId: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/menu-planlama/malzemeler/${malzemeId}`);
    return response.data;
  },

  /**
   * Reçete maliyet analizi getir
   * Backend BackendMaliyetAnaliziResponse döndürüyor
   */
  async getMaliyetAnalizi(receteId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/maliyet-analizi/receteler/${receteId}/maliyet`);
    return response.data;
  },

  /**
   * Reçetelerin maliyet analizini getir
   * Backend'de kategori bazında gruplanmış reçeteler döndürür
   */
  async getRecetelerMaliyet(): Promise<ApiResponse<Recete[]>> {
    // /api/menu-planlama/receteler endpoint'i kullanılıyor
    // Backend'de kategori bazında gruplama yapılıyor
    const response = await api.get('/api/menu-planlama/receteler', {
      params: { limit: 1000 }, // Tüm reçeteleri al
    });
    return response.data;
  },

  /**
   * AI malzeme önerisi
   */
  async getAiMalzemeOneri(receteId: number, prompt: string): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/menu-planlama/receteler/${receteId}/ai-malzeme-oneri`, {
      prompt,
    });
    return response.data;
  },

  /**
   * Toplu AI malzeme önerisi
   */
  async batchAiMalzemeOneri(receteIds: number[]): Promise<ApiResponse<any>> {
    const response = await api.post('/api/menu-planlama/receteler/batch-ai-malzeme-oneri', {
      recete_ids: receteIds,
    });
    return response.data;
  },

  /**
   * Ürün kartı oluştur
   */
  async createUrunKarti(data: {
    ad: string;
    kategori_id?: number;
    varsayilan_birim?: string;
    fiyat_birimi?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/menu-planlama/urun-kartlari', data);
    return response.data;
  },
};
