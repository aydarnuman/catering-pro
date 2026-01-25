/**
 * Demirbas API Servisleri
 * Demirbas yonetimi icin merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// Demirbas
export interface Demirbas {
  id: number;
  kod: string;
  ad: string;
  kategori_id?: number;
  lokasyon_id?: number;
  durum?: string;
  deger?: number;
  alis_tarihi?: string;
  garanti_bitis?: string;
  [key: string]: any;
}

// Demirbas Kategori
export interface DemirbasKategori {
  id: number;
  ad: string;
  kod?: string;
}

// Demirbas Lokasyon
export interface DemirbasLokasyon {
  id: number;
  ad: string;
  kod?: string;
}

// Demirbas API
export const demirbasAPI = {
  /**
   * Demirbas listele
   */
  async getDemirbaslar(): Promise<ApiResponse<Demirbas[]>> {
    const response = await api.get('/api/demirbas');
    return response.data;
  },

  /**
   * Demirbas detay
   */
  async getDemirbas(id: number): Promise<ApiResponse<Demirbas>> {
    const response = await api.get(`/api/demirbas/${id}`);
    return response.data;
  },

  /**
   * Demirbas olustur
   */
  async createDemirbas(data: Partial<Demirbas>): Promise<ApiResponse<Demirbas>> {
    const response = await api.post('/api/demirbas', data);
    return response.data;
  },

  /**
   * Demirbas guncelle
   */
  async updateDemirbas(id: number, data: Partial<Demirbas>): Promise<ApiResponse<Demirbas>> {
    const response = await api.put(`/api/demirbas/${id}`, data);
    return response.data;
  },

  /**
   * Demirbas sil
   */
  async deleteDemirbas(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/demirbas/${id}`);
    return response.data;
  },

  /**
   * Toplu demirbas sil
   */
  async deleteToplu(ids: number[]): Promise<ApiResponse<any>> {
    const response = await api.post('/api/demirbas/toplu/sil', { ids });
    return response.data;
  },

  /**
   * Kategorileri listele
   */
  async getKategoriler(): Promise<ApiResponse<DemirbasKategori[]>> {
    const response = await api.get('/api/demirbas/kategoriler');
    return response.data;
  },

  /**
   * Lokasyonlari listele
   */
  async getLokasyonlar(): Promise<ApiResponse<DemirbasLokasyon[]>> {
    const response = await api.get('/api/demirbas/lokasyonlar');
    return response.data;
  },

  /**
   * Lokasyon olustur
   */
  async createLokasyon(data: Partial<DemirbasLokasyon>): Promise<ApiResponse<DemirbasLokasyon>> {
    const response = await api.post('/api/demirbas/lokasyonlar', data);
    return response.data;
  },

  /**
   * Lokasyon guncelle
   */
  async updateLokasyon(id: number, data: Partial<DemirbasLokasyon>): Promise<ApiResponse<DemirbasLokasyon>> {
    const response = await api.put(`/api/demirbas/lokasyonlar/${id}`, data);
    return response.data;
  },

  /**
   * Lokasyon sil
   */
  async deleteLokasyon(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/demirbas/lokasyonlar/${id}`);
    return response.data;
  },

  /**
   * Istatistik ozet
   */
  async getIstatistikOzet(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/demirbas/istatistik/ozet');
    return response.data;
  },

  /**
   * Zimmet ata
   */
  async zimmetAta(demirbasId: number, data: {
    personel_id: number;
    proje_id?: number;
    tarih?: string;
    aciklama?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/demirbas/${demirbasId}/zimmet`, data);
    return response.data;
  },

  /**
   * Zimmet iade
   */
  async zimmetIade(demirbasId: number, data?: {
    tarih?: string;
    aciklama?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/demirbas/${demirbasId}/zimmet-iade`, data || {});
    return response.data;
  },

  /**
   * Bakim kaydi ekle
   */
  async bakimEkle(demirbasId: number, data: {
    tarih: string;
    aciklama: string;
    maliyet?: number;
    sonraki_bakim?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/demirbas/${demirbasId}/bakim`, data);
    return response.data;
  },

  /**
   * Transfer yap
   */
  async transfer(demirbasId: number, data: {
    hedef_lokasyon_id: number;
    tarih?: string;
    aciklama?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/demirbas/${demirbasId}/transfer`, data);
    return response.data;
  },
};
