/**
 * Ürünler API Servisleri
 * Ürün kartları ve kategoriler için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse, ApiListResponse } from '../types';

// Ürün Karti
export interface UrunKarti {
  id: number;
  kod: string;
  ad: string;
  kategori?: string;
  kategori_id?: number;
  birim?: string;
  birim_kisa?: string;
  ana_birim_id?: number;
  toplam_stok?: number;
  min_stok?: number;
  max_stok?: number;
  kritik_stok?: number;
  son_alis_fiyati?: number;
  durum?: string;
  [key: string]: any;
}

// Ürün Kategorisi
export interface UrunKategori {
  id: number;
  kod: string;
  ad: string;
  aciklama?: string;
}

// Ürünler API
export const urunlerAPI = {
  /**
   * Ürünleri listele
   */
  async getUrunler(params?: {
    kategori_id?: string;
    arama?: string;
    limit?: number;
  }): Promise<ApiResponse<UrunKarti[]>> {
    const response = await api.get('/api/urunler', { params });
    return response.data;
  },

  /**
   * Ürün detayını getir
   */
  async getUrun(id: number): Promise<ApiResponse<UrunKarti>> {
    const response = await api.get(`/api/urunler/${id}`);
    return response.data;
  },

  /**
   * Ürün oluştur
   */
  async createUrun(urun: Partial<UrunKarti>): Promise<ApiResponse<UrunKarti>> {
    const response = await api.post('/api/urunler', urun);
    return response.data;
  },

  /**
   * Ürün güncelle
   */
  async updateUrun(id: number, urun: Partial<UrunKarti>): Promise<ApiResponse<UrunKarti>> {
    const response = await api.put(`/api/urunler/${id}`, urun);
    return response.data;
  },

  /**
   * Ürün sil
   */
  async deleteUrun(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/urunler/${id}`);
    return response.data;
  },

  /**
   * Ürün kategorilerini listele
   */
  async getKategoriler(): Promise<ApiResponse<UrunKategori[]>> {
    const response = await api.get('/api/urunler/kategoriler/liste');
    return response.data;
  },

  /**
   * Ürün fiyatını getir
   */
  async getFiyat(urunKartId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/urunler/${urunKartId}/fiyat`);
    return response.data;
  },

  /**
   * Ürün varyantı oluştur
   */
  async createVaryant(data: {
    urun_kart_id: number;
    varyant_adi: string;
    fiyat_farki?: number;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/urunler/varyant-olustur', data);
    return response.data;
  },

  /**
   * Ürün fiyatını güncelle
   */
  async updateFiyat(urunKartId: number, data: {
    birim_fiyat: number;
    kaynak?: string;
    aciklama?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.patch(`/api/urunler/${urunKartId}/fiyat`, data);
    return response.data;
  },
};
