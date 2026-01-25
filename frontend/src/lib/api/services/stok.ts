/**
 * Stok API Servisleri
 * Stok yönetimi, depolar, hareketler için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// Depo
export interface Depo {
  id: number;
  kod: string;
  ad: string;
  aciklama?: string;
  aktif?: boolean;
}

// Depo Stok
export interface DepoStok {
  depo_id: number;
  depo_kod: string;
  depo_ad: string;
  miktar: number;
  rezerve_miktar?: number;
  kullanilabilir_miktar?: number;
}

// Stok Hareketi
export interface StokHareket {
  id: number;
  hareket_tipi: 'giris' | 'cikis' | 'transfer';
  depo_id?: number;
  hedef_depo_id?: number;
  urun_id: number;
  miktar: number;
  birim: string;
  belge_no?: string;
  belge_tarihi?: string;
  aciklama?: string;
  created_at?: string;
}

// Stok Fatura
export interface StokFatura {
  ettn: string;
  fatura_no: string;
  tarih: string;
  toplam_tutar: number;
  [key: string]: any;
}

// Stok API
export const stokAPI = {
  /**
   * Depoları listele
   */
  async getDepolar(): Promise<ApiResponse<Depo[]>> {
    const response = await api.get('/api/stok/depolar');
    return response.data;
  },

  /**
   * Depo detayını getir
   */
  async getDepo(id: number): Promise<ApiResponse<Depo>> {
    const response = await api.get(`/api/stok/depolar/${id}`);
    return response.data;
  },

  /**
   * Depo oluştur
   */
  async createDepo(depo: Partial<Depo>): Promise<ApiResponse<Depo>> {
    const response = await api.post('/api/stok/depolar', depo);
    return response.data;
  },

  /**
   * Depo güncelle
   */
  async updateDepo(id: number, depo: Partial<Depo>): Promise<ApiResponse<Depo>> {
    const response = await api.put(`/api/stok/depolar/${id}`, depo);
    return response.data;
  },

  /**
   * Depo sil
   */
  async deleteDepo(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/stok/depolar/${id}`);
    return response.data;
  },

  /**
   * Depo stoklarını getir
   */
  async getDepoStoklar(depoId: number): Promise<ApiResponse<DepoStok[]>> {
    const response = await api.get(`/api/stok/depolar/${depoId}/stoklar`);
    return response.data;
  },

  /**
   * Depo lokasyonlarını getir
   */
  async getDepoLokasyonlar(depoId: number): Promise<ApiResponse<any[]>> {
    const response = await api.get(`/api/stok/depolar/${depoId}/lokasyonlar`);
    return response.data;
  },

  /**
   * Lokasyon stoklarını getir
   */
  async getLokasyonStoklar(lokasyonId: number): Promise<ApiResponse<any[]>> {
    const response = await api.get(`/api/stok/lokasyonlar/${lokasyonId}/stoklar`);
    return response.data;
  },

  /**
   * Stok hareketlerini listele
   */
  async getHareketler(params?: { limit?: number }): Promise<ApiResponse<StokHareket[]>> {
    const response = await api.get('/api/stok/hareketler', { params });
    return response.data;
  },

  /**
   * Stok transferi yap
   */
  async transferHareket(data: {
    kaynak_depo_id: number;
    hedef_depo_id: number;
    urun_id: number;
    miktar: number;
    birim: string;
    belge_no?: string;
    belge_tarihi?: string;
    aciklama?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/stok/hareketler/transfer', data);
    return response.data;
  },

  /**
   * Stok girişi yap
   */
  async girisHareket(data: {
    depo_id: number;
    urun_id: number;
    miktar: number;
    birim: string;
    belge_no?: string;
    belge_tarihi?: string;
    aciklama?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/stok/hareketler/giris', data);
    return response.data;
  },

  /**
   * Stok çıkışı yap
   */
  async cikisHareket(data: {
    depo_id: number;
    urun_id: number;
    miktar: number;
    birim: string;
    belge_no?: string;
    belge_tarihi?: string;
    aciklama?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/stok/hareketler/cikis', data);
    return response.data;
  },

  /**
   * Stok faturalarını listele
   */
  async getFaturalar(params?: { limit?: number }): Promise<ApiResponse<StokFatura[]>> {
    const response = await api.get('/api/stok/faturalar', { params });
    return response.data;
  },

  /**
   * Fatura kalemlerini getir
   */
  async getFaturaKalemler(ettn: string): Promise<ApiResponse<any[]>> {
    const response = await api.get(`/api/stok/faturalar/${ettn}/kalemler`);
    return response.data;
  },

  /**
   * Toplu fatura işle
   */
  async topluFaturaIsle(data: {
    faturalar: string[];
    depo_id: number;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/stok/toplu-fatura-isle', data);
    return response.data;
  },

  /**
   * Faturadan stok girişi
   */
  async faturadanGiris(data: {
    ettn: string;
    depo_id: number;
    kalemler?: number[];
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/stok/faturadan-giris', data);
    return response.data;
  },

  /**
   * Stok kartlarını ara
   */
  async araKartlar(query: string): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/stok/kartlar/ara', { params: { q: query } });
    return response.data;
  },

  /**
   * Birimleri listele
   */
  async getBirimler(): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/stok/birimler');
    return response.data;
  },

  /**
   * Stok kartlarını listele
   */
  async getKartlar(params?: { limit?: number }): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/stok/kartlar', { params });
    return response.data;
  },
};
