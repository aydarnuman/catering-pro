/**
 * Kurum Menüleri API Servisleri
 * Kurum tipine göre hazır menü şablonları yönetimi
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// ─── Types ────────────────────────────────────────────────────

export interface KurumTipi {
  id: number;
  kod: string;
  ad: string;
  ikon: string;
  aciklama: string;
}

export interface MaliyetSeviyesi {
  id: number;
  kod: string;
  ad: string;
  renk: string;
  aciklama: string;
}

export interface KurumMenuOzet {
  id: number;
  ad: string;
  gun_sayisi: number;
  ogun_yapisi: string;
  kisi_sayisi: number;
  porsiyon_maliyet: number;
  gunluk_maliyet: number;
  toplam_maliyet: number;
  durum: string;
  favori: boolean;
  kullanim_sayisi: number;
  etiketler: string[];
  created_at: string;
  updated_at: string;
  kurum_tipi_kod: string;
  kurum_tipi_ad: string;
  kurum_tipi_ikon: string;
  maliyet_seviyesi_kod: string;
  maliyet_seviyesi_ad: string;
  maliyet_seviyesi_renk: string;
  ogun_sayisi: number;
  yemek_sayisi: number;
}

export interface MenuYemek {
  id: number;
  kurum_menu_gun_id: number;
  recete_id: number | null;
  yemek_adi: string;
  sira: number;
  porsiyon_maliyet: number;
  recete_maliyet: number | null;
  kategori_kod: string | null;
  kategori_ad: string | null;
  kategori_ikon: string | null;
}

export interface MenuGun {
  id: number;
  gun_no: number;
  ogun_tipi_id: number;
  porsiyon_maliyet: number;
  notlar: string | null;
  ogun_kod: string;
  ogun_ad: string;
  ogun_ikon: string;
  yemekler: MenuYemek[];
}

export interface KurumMenuDetay extends KurumMenuOzet {
  gunler: MenuGun[];
}

export interface TopluKaydetGun {
  gun_no: number;
  ogun_tipi_id: number;
  notlar?: string;
  yemekler: Array<{
    recete_id?: number;
    yemek_adi: string;
    sira?: number;
  }>;
}

// ─── API ──────────────────────────────────────────────────────

export const kurumMenuleriAPI = {
  /** Kurum tiplerini getir */
  async getKurumTipleri(): Promise<ApiResponse<KurumTipi[]>> {
    const response = await api.get('/api/kurum-menuleri/kurum-tipleri');
    return response.data;
  },

  /** Maliyet seviyelerini getir */
  async getMaliyetSeviyeleri(): Promise<ApiResponse<MaliyetSeviyesi[]>> {
    const response = await api.get('/api/kurum-menuleri/maliyet-seviyeleri');
    return response.data;
  },

  /** Kurum menüleri listele */
  async getMenuler(params?: {
    kurum_tipi?: string;
    maliyet_seviyesi?: string;
    durum?: string;
    arama?: string;
  }): Promise<ApiResponse<KurumMenuOzet[]>> {
    const response = await api.get('/api/kurum-menuleri', { params });
    return response.data;
  },

  /** Menü detayı (günler + yemekler dahil) */
  async getMenuDetay(id: number): Promise<ApiResponse<KurumMenuDetay>> {
    const response = await api.get(`/api/kurum-menuleri/${id}`);
    return response.data;
  },

  /** Yeni menü oluştur */
  async createMenu(data: {
    ad: string;
    kurum_tipi_id: number;
    maliyet_seviyesi_id: number;
    gun_sayisi?: number;
    ogun_yapisi?: string;
    kisi_sayisi?: number;
    aciklama?: string;
    notlar?: string;
    etiketler?: string[];
  }): Promise<ApiResponse<{ id: number }>> {
    const response = await api.post('/api/kurum-menuleri', data);
    return response.data;
  },

  /** Menü güncelle */
  async updateMenu(
    id: number,
    data: Partial<{
      ad: string;
      kurum_tipi_id: number;
      maliyet_seviyesi_id: number;
      gun_sayisi: number;
      ogun_yapisi: string;
      kisi_sayisi: number;
      aciklama: string;
      notlar: string;
      etiketler: string[];
      durum: string;
      favori: boolean;
    }>
  ): Promise<ApiResponse<{ message: string }>> {
    const response = await api.put(`/api/kurum-menuleri/${id}`, data);
    return response.data;
  },

  /** Menü sil */
  async deleteMenu(id: number): Promise<ApiResponse<{ message: string }>> {
    const response = await api.delete(`/api/kurum-menuleri/${id}`);
    return response.data;
  },

  /** Toplu kaydet (günler + yemekler) */
  async topluKaydet(
    id: number,
    gunler: TopluKaydetGun[]
  ): Promise<
    ApiResponse<{
      gun_sayisi: number;
      ogun_sayisi: number;
      yemek_sayisi: number;
      toplam_maliyet: number;
    }>
  > {
    const response = await api.post(`/api/kurum-menuleri/${id}/toplu-kaydet`, { gunler });
    return response.data;
  },

  /** AI ile otomatik menu olustur (8 faktorlu motor) */
  async aiOlustur(data: {
    kurum_tipi_kod: string;
    maliyet_seviyesi_kod: string;
    gun_sayisi: number;
    ogun_yapisi: string;
    mevsim?: string;
    haric_tutma?: string[];
    ozel_istekler?: string;
  }): Promise<Record<string, unknown>> {
    const response = await api.post('/api/kurum-menuleri/ai-olustur', data);
    return response.data;
  },

  /** Maliyet yeniden hesapla */
  async maliyetHesapla(id: number): Promise<
    ApiResponse<{
      toplam_maliyet: number;
      gunluk_maliyet: number;
      porsiyon_maliyet: number;
    }>
  > {
    const response = await api.post(`/api/kurum-menuleri/${id}/maliyet-hesapla`);
    return response.data;
  },
};
