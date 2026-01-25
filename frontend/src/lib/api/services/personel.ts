/**
 * Personel API Servisleri
 * Personel, bordro, maaş ödeme için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// Personel
export interface Personel {
  id: number;
  ad_soyad: string;
  tc_no?: string;
  telefon?: string;
  email?: string;
  iban?: string;
  proje_id?: number;
  giris_tarihi?: string;
  cikis_tarihi?: string;
  aktif?: boolean;
  [key: string]: any;
}

// Personel API
export const personelAPI = {
  /**
   * Personelleri listele
   */
  async getPersoneller(params?: {
    proje_id?: number;
    aktif?: boolean;
  }): Promise<ApiResponse<Personel[]>> {
    const response = await api.get('/api/personel', { params });
    return response.data;
  },

  /**
   * Personel detayı
   */
  async getPersonel(id: number): Promise<ApiResponse<Personel>> {
    const response = await api.get(`/api/personel/${id}`);
    return response.data;
  },

  /**
   * Personel oluştur
   */
  async createPersonel(personel: Partial<Personel>): Promise<ApiResponse<Personel>> {
    const response = await api.post('/api/personel', personel);
    return response.data;
  },

  /**
   * Personel güncelle
   */
  async updatePersonel(id: number, personel: Partial<Personel>): Promise<ApiResponse<Personel>> {
    const response = await api.put(`/api/personel/${id}`, personel);
    return response.data;
  },

  /**
   * Personel sil
   */
  async deletePersonel(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/personel/${id}`);
    return response.data;
  },

  /**
   * Projeleri listele
   */
  async getProjeler(params?: { durum?: string }): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/projeler', { params });
    return response.data;
  },

  /**
   * Proje personellerini listele
   */
  async getProjePersoneller(projeId: number): Promise<ApiResponse<any[]>> {
    const response = await api.get(`/api/projeler/${projeId}/personeller`);
    return response.data;
  },

  /**
   * Bordro tahakkuk
   */
  async getBordroTahakkuk(projeId: number, yil: number, ay: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/bordro-import/tahakkuk/${projeId}/${yil}/${ay}`);
    return response.data;
  },

  /**
   * Bordro özet
   */
  async getBordroOzet(yil: number, ay: number, projeId?: number): Promise<ApiResponse<any>> {
    const params = projeId ? { proje_id: projeId } : {};
    const response = await api.get(`/api/bordro/ozet/${yil}/${ay}`, { params });
    return response.data;
  },

  /**
   * Maaş ödeme özet
   */
  async getMaasOdemeOzet(projeId: number, yil: number, ay: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/maas-odeme/ozet/${projeId}/${yil}/${ay}`);
    return response.data;
  },

  /**
   * Maaş ödeme oluştur
   */
  async createMaasOdeme(projeId: number, yil: number, ay: number): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/maas-odeme/olustur/${projeId}/${yil}/${ay}`);
    return response.data;
  },

  /**
   * Toplu maaş ödendi işaretle
   */
  async topluMaasOdendi(projeId: number, yil: number, ay: number): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/maas-odeme/toplu-odendi/${projeId}/${yil}/${ay}`);
    return response.data;
  },

  /**
   * Aylık ödeme listesi
   */
  async getAylikOdeme(projeId: number, yil: number, ay: number): Promise<ApiResponse<any[]>> {
    const response = await api.get(`/api/maas-odeme/aylik-odeme/${projeId}/${yil}/${ay}`);
    return response.data;
  },

  /**
   * Aylık ödeme güncelle
   */
  async updateAylikOdeme(projeId: number, yil: number, ay: number, data: any): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/maas-odeme/aylik-odeme/${projeId}/${yil}/${ay}`, data);
    return response.data;
  },

  /**
   * Aylık ödeme sil
   */
  async deleteAylikOdeme(projeId: number, yil: number, ay: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/maas-odeme/aylik-odeme/${projeId}/${yil}/${ay}`);
    return response.data;
  },

  /**
   * Ödeme kesinleştir
   */
  async finalizeOdeme(projeId: number, yil: number, ay: number): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/maas-odeme/finalize/${projeId}/${yil}/${ay}`);
    return response.data;
  },

  /**
   * Personel ödeme güncelle
   */
  async updatePersonelOdeme(personelId: number, data: any): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/maas-odeme/personel-odeme/${personelId}`, data);
    return response.data;
  },

  /**
   * Tazminat sebepleri
   */
  async getTazminatSebepler(): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/personel/tazminat/sebepler');
    return response.data;
  },

  /**
   * Tazminat hesapla
   */
  async hesaplaTazminat(data: any): Promise<ApiResponse<any>> {
    const response = await api.post('/api/personel/tazminat/hesapla', data);
    return response.data;
  },

  /**
   * Tazminat kaydet
   */
  async kaydetTazminat(data: any): Promise<ApiResponse<any>> {
    const response = await api.post('/api/personel/tazminat/kaydet', data);
    return response.data;
  },

  /**
   * Personel istatistikleri
   */
  async getStats(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/personel/stats');
    return response.data;
  },
};
