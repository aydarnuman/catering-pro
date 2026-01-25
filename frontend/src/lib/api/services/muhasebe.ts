/**
 * Muhasebe API Servisleri
 * Cari, Kasa-Banka, Finans için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// Cari
export interface Cari {
  id: number;
  unvan: string;
  vkn?: string;
  tip?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  aktif?: boolean;
  [key: string]: any;
}

// Kasa-Banka Hesap
export interface KasaBankaHesap {
  id: number;
  ad: string;
  tip: 'kasa' | 'banka';
  bakiye?: number;
  aktif?: boolean;
}

// Kasa-Banka Hareket
export interface KasaBankaHareket {
  id: number;
  hesap_id: number;
  cari_id?: number;
  tutar: number;
  tip: 'giris' | 'cikis';
  aciklama?: string;
  tarih: string;
}

// Muhasebe API
export const muhasebeAPI = {
  /**
   * Carileri listele
   */
  async getCariler(params?: {
    tip?: string;
    aktif?: boolean;
  }): Promise<ApiResponse<Cari[]>> {
    const response = await api.get('/api/cariler', { params });
    return response.data;
  },

  /**
   * Cari detayını getir
   */
  async getCari(id: number): Promise<ApiResponse<Cari>> {
    const response = await api.get(`/api/cariler/${id}`);
    return response.data;
  },

  /**
   * Cari oluştur
   */
  async createCari(cari: Partial<Cari>): Promise<ApiResponse<Cari>> {
    const response = await api.post('/api/cariler', cari);
    return response.data;
  },

  /**
   * Cari güncelle
   */
  async updateCari(id: number, cari: Partial<Cari>): Promise<ApiResponse<Cari>> {
    const response = await api.put(`/api/cariler/${id}`, cari);
    return response.data;
  },

  /**
   * Cari sil
   */
  async deleteCari(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/cariler/${id}`);
    return response.data;
  },

  /**
   * Cari hareketlerini getir
   */
  async getCariHareketler(
    cariId: number,
    params?: {
      baslangic?: string;
      bitis?: string;
      tip?: string;
    }
  ): Promise<ApiResponse<any[]>> {
    const response = await api.get(`/api/cariler/${cariId}/hareketler`, { params });
    return response.data;
  },

  /**
   * Cari aylık özet getir
   */
  async getCariAylikOzet(cariId: number): Promise<ApiResponse<any[]>> {
    const response = await api.get(`/api/cariler/${cariId}/aylik-ozet`);
    return response.data;
  },

  /**
   * Kasa-Banka hesaplarını listele
   */
  async getKasaBankaHesaplar(): Promise<ApiResponse<KasaBankaHesap[]>> {
    const response = await api.get('/api/kasa-banka/hesaplar');
    return response.data;
  },

  /**
   * Kasa-Banka hareketlerini listele
   */
  async getKasaBankaHareketler(params?: {
    limit?: number;
  }): Promise<ApiResponse<KasaBankaHareket[]>> {
    const response = await api.get('/api/kasa-banka/hareketler', { params });
    return response.data;
  },

  /**
   * Kasa-Banka özet getir
   */
  async getKasaBankaOzet(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/kasa-banka/ozet');
    return response.data;
  },

  /**
   * Kasa-Banka hesap oluştur
   */
  async createKasaBankaHesap(hesap: Partial<KasaBankaHesap>): Promise<ApiResponse<KasaBankaHesap>> {
    const response = await api.post('/api/kasa-banka/hesaplar', hesap);
    return response.data;
  },

  /**
   * Kasa-Banka hareket oluştur
   */
  async createKasaBankaHareket(hareket: Partial<KasaBankaHareket>): Promise<ApiResponse<KasaBankaHareket>> {
    const response = await api.post('/api/kasa-banka/hareketler', hareket);
    return response.data;
  },

  /**
   * Kasa-Banka hesap güncelle
   */
  async updateKasaBankaHesap(id: number, hesap: Partial<KasaBankaHesap>): Promise<ApiResponse<KasaBankaHesap>> {
    const response = await api.put(`/api/kasa-banka/hesaplar/${id}`, hesap);
    return response.data;
  },

  /**
   * Kasa-Banka hesap sil
   */
  async deleteKasaBankaHesap(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/kasa-banka/hesaplar/${id}`);
    return response.data;
  },

  /**
   * Kasa-Banka transfer
   */
  async transferKasaBanka(data: {
    kaynak_hesap_id: number;
    hedef_hesap_id: number;
    tutar: number;
    tarih?: string;
    aciklama?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/kasa-banka/transfer', data);
    return response.data;
  },

  /**
   * Kasa-Banka carileri getir
   */
  async getKasaBankaCariler(): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/kasa-banka/cariler');
    return response.data;
  },

  /**
   * Çek/Senet listele
   */
  async getCekSenetler(params?: { limit?: number }): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/kasa-banka/cek-senet', { params });
    return response.data;
  },

  /**
   * Çek/Senet oluştur
   */
  async createCekSenet(data: any): Promise<ApiResponse<any>> {
    const response = await api.post('/api/kasa-banka/cek-senet', data);
    return response.data;
  },

  /**
   * Çek/Senet sil
   */
  async deleteCekSenet(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/kasa-banka/cek-senet/${id}`);
    return response.data;
  },

  /**
   * Çek/Senet tahsil et
   */
  async tahsilCekSenet(id: number, data: { hesap_id: number; tarih?: string }): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/kasa-banka/cek-senet/${id}/tahsil`, data);
    return response.data;
  },

  /**
   * Çek/Senet ciro et
   */
  async ciroCekSenet(id: number, data: { ciro_cari_id: number; ciro_tarihi?: string }): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/kasa-banka/cek-senet/${id}/ciro`, data);
    return response.data;
  },

  /**
   * Çek/Senet iade et
   */
  async iadeCekSenet(id: number): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/kasa-banka/cek-senet/${id}/iade`);
    return response.data;
  },

  /**
   * Çek/Senetleri listele (kasa-banka için)
   */
  async getCekSenetlerListe(): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/kasa-banka/cek-senetler');
    return response.data;
  },

  /**
   * Proje hareketlerini getir
   */
  async getProjeHareketler(projeId: number, params?: {
    yil?: number;
    ay?: number;
  }): Promise<ApiResponse<any[]>> {
    const response = await api.get(`/api/proje-hareketler/${projeId}`, { params });
    return response.data;
  },

  /**
   * Proje hareketi oluştur
   */
  async createProjeHareket(data: any): Promise<ApiResponse<any>> {
    const response = await api.post('/api/proje-hareketler', data);
    return response.data;
  },

  // ========== PROJE İSTATİSTİKLERİ ==========

  /**
   * Genel proje özeti
   */
  async getProjeGenelOzet(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/projeler/stats/genel-ozet');
    return response.data;
  },

  /**
   * Fatura istatistikleri
   */
  async getInvoiceStats(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/invoices/stats');
    return response.data;
  },

  // ========== MUTABAKAT ==========

  /**
   * Mutabakat ekstre
   */
  async getMutabakatEkstre(cariId: number, baslangic: string, bitis: string): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/mutabakat/ekstre/${cariId}`, {
      params: { baslangic, bitis },
    });
    return response.data;
  },

  /**
   * Mutabakat fatura bazlı
   */
  async getMutabakatFaturaBazli(cariId: number, params: {
    durum?: string;
    yil?: number;
    ay?: number;
  }): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/mutabakat/fatura-bazli/${cariId}`, { params });
    return response.data;
  },

  /**
   * Mutabakat dönemsel
   */
  async getMutabakatDonemsel(cariId: number, yil: number, ay: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/mutabakat/donemsel/${cariId}`, {
      params: { yil, ay },
    });
    return response.data;
  },

  // ========== PROJELER ==========

  /**
   * Projeleri listele
   */
  async getProjeler(): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/projeler');
    return response.data;
  },

  /**
   * Proje detayını getir
   */
  async getProje(projeId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/projeler/${projeId}`);
    return response.data;
  },

  /**
   * Proje oluştur
   */
  async createProje(proje: any): Promise<ApiResponse<any>> {
    const response = await api.post('/api/projeler', proje);
    return response.data;
  },

  /**
   * Proje güncelle
   */
  async updateProje(projeId: number, proje: any): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/projeler/${projeId}`, proje);
    return response.data;
  },

  /**
   * Proje sil
   */
  async deleteProje(projeId: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/projeler/${projeId}`);
    return response.data;
  },
};
