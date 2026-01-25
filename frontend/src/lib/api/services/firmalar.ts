/**
 * Firmalar API Servisleri
 * Firma yönetimi için merkezi API servisleri
 */

import { api } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import type { ApiResponse } from '../types';

// Firma tipi
export interface Firma {
  id: number;
  unvan: string;
  vergi_no?: string;
  vergi_dairesi?: string;
  adres?: string;
  telefon?: string;
  email?: string;
  yetkili_adi?: string;
  yetkili_unvan?: string;
  varsayilan?: boolean;
  [key: string]: any;
}

// Firmalar API
export const firmalarAPI = {
  /**
   * Firmaları listele
   */
  async getFirmalar(): Promise<ApiResponse<Firma[]>> {
    const response = await api.get('/api/firmalar');
    return response.data;
  },

  /**
   * Firma detayını getir
   */
  async getFirma(id: number): Promise<ApiResponse<Firma>> {
    const response = await api.get(`/api/firmalar/${id}`);
    return response.data;
  },

  /**
   * Firma oluştur
   */
  async createFirma(firma: Partial<Firma>): Promise<ApiResponse<Firma>> {
    const response = await api.post('/api/firmalar', firma);
    return response.data;
  },

  /**
   * Firma güncelle
   */
  async updateFirma(id: number, firma: Partial<Firma>): Promise<ApiResponse<Firma>> {
    const response = await api.put(`/api/firmalar/${id}`, firma);
    return response.data;
  },

  /**
   * Firma sil
   */
  async deleteFirma(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/firmalar/${id}`);
    return response.data;
  },

  /**
   * Varsayılan firma yap
   */
  async setVarsayilan(id: number): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/firmalar/${id}/varsayilan`);
    return response.data;
  },

  /**
   * Firma dökümanlarını getir
   */
  async getDokumanlar(firmaId: number): Promise<ApiResponse<any[]>> {
    const response = await api.get(`/api/firmalar/${firmaId}/dokumanlar`);
    return response.data;
  },

  /**
   * Firma dökümanı yükle
   */
  async uploadDokuman(firmaId: number, formData: FormData): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/firmalar/${firmaId}/dokumanlar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Firma dökümanı sil
   */
  async deleteDokuman(firmaId: number, dokumanId: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/firmalar/${firmaId}/dokumanlar/${dokumanId}`);
    return response.data;
  },

  /**
   * Döküman verisini uygula
   */
  async applyDokumanData(firmaId: number, dokumanId: number): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/firmalar/${firmaId}/dokumanlar/${dokumanId}/veriyi-uygula`);
    return response.data;
  },

  /**
   * Dökümanı yeniden analiz et
   */
  async reanalyzeDokuman(firmaId: number, dokumanId: number): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/firmalar/${firmaId}/dokumanlar/${dokumanId}/yeniden-analiz`);
    return response.data;
  },

  /**
   * Belge analizi yap
   */
  async analyzeBelge(formData: FormData): Promise<ApiResponse<any>> {
    const response = await api.post('/api/firmalar/analyze-belge', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Belge yükle
   */
  async uploadBelge(firmaId: number, formData: FormData): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/firmalar/${firmaId}/belge`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Alan şablonlarını getir
   */
  async getAlanSablonlari(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/firmalar/alan-sablonlari');
    return response.data;
  },

  /**
   * Ekstra alanları getir
   */
  async getEkstraAlanlar(firmaId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/firmalar/${firmaId}/ekstra-alanlar`);
    return response.data;
  },

  /**
   * Ekstra alan ekle
   */
  async addEkstraAlan(firmaId: number, data: any): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/firmalar/${firmaId}/ekstra-alan`, data);
    return response.data;
  },

  /**
   * Ekstra alan sil
   */
  async deleteEkstraAlan(firmaId: number, alanAdi: string): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/firmalar/${firmaId}/ekstra-alan/${alanAdi}`);
    return response.data;
  },

  /**
   * Dökümanlar ZIP indirme URL'i
   */
  getDokumanlarZipUrl(firmaId: number, token: string): string {
    return `${API_BASE_URL}/api/firmalar/${firmaId}/dokumanlar-zip?token=${token}`;
  },

  /**
   * Excel export URL'i
   */
  getExcelExportUrl(firmaId: number, token: string): string {
    return `${API_BASE_URL}/api/firmalar/${firmaId}/export?format=excel&token=${token}`;
  },

  /**
   * Dosya URL'i
   */
  getFileUrl(path: string): string {
    return `${API_BASE_URL}${path}`;
  },
};
