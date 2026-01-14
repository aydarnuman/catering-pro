/**
 * İhale Sonuçları API Helper
 * Backend: /api/ihale-sonuclari
 */

import { API_BASE_URL } from './config';

// Types
export interface RakipTeklif {
  firma: string;
  teklif: number;
  sira: number;
  asiri_dusuk?: boolean;
}

export interface Hesaplama {
  sinir_deger_hesabi?: {
    tort1: number;
    stdSapma: number;
    tort2: number;
    c: number;
    k: number;
    sonuc: number;
  };
  asiri_dusuk_oran?: number;
  itiraz_suresi?: {
    son_tarih: string;
    kalan_gun: number;
  };
  kik_bedeli?: number;
  hesaplanan_tarih?: string;
}

export interface Belge {
  ad: string;
  url: string;
  tip: string;
  tarih: string;
}

export interface AISohbetMesaj {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface IhaleSonucu {
  id: number;
  tender_id: number | null;
  ihale_basligi: string;
  kurum: string;
  ihale_kayit_no: string | null;
  ihale_turu: 'hizmet' | 'mal' | 'yapim';
  yaklasik_maliyet: number | null;
  sinir_deger: number | null;
  bizim_teklif: number | null;
  bizim_sira: number | null;
  diger_teklifler: RakipTeklif[];
  toplam_teklif_sayisi: number;
  ihale_tarihi: string | null;
  kesinlesme_tarihi: string | null;
  asiri_dusuk_sorgu_tarihi: string | null;
  asiri_dusuk_cevap_tarihi: string | null;
  itiraz_son_tarihi: string | null;
  durum: IhaleSonucDurum;
  asiri_dusuk_aciklama_durumu: string | null;
  asiri_dusuk_aciklama_metni: string | null;
  hesaplamalar: Hesaplama;
  belgeler: Belge[];
  notlar: string | null;
  ai_sohbet_gecmisi: AISohbetMesaj[];
  created_at: string;
  updated_at: string;
  // Joined fields from tenders
  ihale_url?: string;
  ihale_sehir?: string;
  sikayet_son_tarih?: string;
  kalan_gun?: number;
}

export type IhaleSonucDurum = 
  | 'beklemede'
  | 'asiri_dusuk_soruldu'
  | 'asiri_dusuk_cevaplandi'
  | 'kazandik'
  | 'elendik'
  | 'itiraz_edildi'
  | 'kik_basvurusu'
  | 'sonuclandi';

export interface IhaleSonucIstatistik {
  toplam: number;
  beklemede: number;
  asiri_dusuk: number;
  kazanilan: number;
  elenen: number;
  itiraz: number;
  kazanilan_toplam_tutar: number | null;
  ortalama_sira: number | null;
}

export interface CreateIhaleSonucInput {
  tender_id?: number;
  ihale_basligi: string;
  kurum: string;
  ihale_kayit_no?: string;
  ihale_turu?: 'hizmet' | 'mal' | 'yapim';
  yaklasik_maliyet?: number;
  sinir_deger?: number;
  bizim_teklif?: number;
  bizim_sira?: number;
  diger_teklifler?: RakipTeklif[];
  ihale_tarihi?: string;
  kesinlesme_tarihi?: string;
  durum?: IhaleSonucDurum;
  notlar?: string;
}

export interface UpdateIhaleSonucInput extends Partial<CreateIhaleSonucInput> {
  asiri_dusuk_sorgu_tarihi?: string;
  asiri_dusuk_cevap_tarihi?: string;
  itiraz_son_tarihi?: string;
  asiri_dusuk_aciklama_durumu?: string;
  asiri_dusuk_aciklama_metni?: string;
  hesaplamalar?: Hesaplama;
  belgeler?: Belge[];
}

// Helper function
const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// API Functions
export const ihaleSonuclariApi = {
  /**
   * Tüm ihale sonuçlarını listele
   */
  async list(params?: { durum?: string; kurum?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.durum) searchParams.set('durum', params.durum);
    if (params?.kurum) searchParams.set('kurum', params.kurum);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    const url = `${API_BASE_URL}/api/ihale-sonuclari${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu[]; pagination: { total: number; limit: number; offset: number } };
  },

  /**
   * Tek ihale sonucu getir
   */
  async get(id: number) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/${id}`, { headers: getAuthHeaders() });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu };
  },

  /**
   * İstatistikler
   */
  async getIstatistikler() {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/istatistikler`, { headers: getAuthHeaders() });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: { ozet: IhaleSonucIstatistik; aktivite: Array<{ tarih: string; sayi: number }> } };
  },

  /**
   * Aktif süreçler (itiraz süresi dolmamış)
   */
  async getAktifSurecler() {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/aktif-surecler`, { headers: getAuthHeaders() });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu[] };
  },

  /**
   * Yeni ihale sonucu ekle
   */
  async create(input: CreateIhaleSonucInput) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu; message: string };
  },

  /**
   * İhale sonucu güncelle
   */
  async update(id: number, input: UpdateIhaleSonucInput) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu; message: string };
  },

  /**
   * Durum güncelle
   */
  async updateDurum(id: number, durum: IhaleSonucDurum) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/${id}/durum`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ durum }),
    });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu; message: string };
  },

  /**
   * Rakip teklif ekle
   */
  async addRakipTeklif(id: number, teklif: { firma: string; teklif: number; sira?: number; asiri_dusuk?: boolean }) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/${id}/rakip-teklif`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(teklif),
    });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu; message: string };
  },

  /**
   * Rakip teklif sil
   */
  async removeRakipTeklif(id: number, sira: number) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/${id}/rakip-teklif/${sira}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu; message: string };
  },

  /**
   * Hesaplama sonuçlarını kaydet
   */
  async saveHesaplama(id: number, tip: string, sonuc: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/${id}/hesaplama-kaydet`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tip, sonuc }),
    });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu; message: string };
  },

  /**
   * AI sohbet mesajı kaydet
   */
  async saveAISohbet(id: number, role: 'user' | 'assistant', content: string) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/${id}/ai-sohbet`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role, content }),
    });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu };
  },

  /**
   * İhale sonucu sil
   */
  async delete(id: number) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; message: string };
  },

  /**
   * Tracking'den ihale sonuçlarına aktar
   */
  async transferFromTracking(tenderId: number) {
    const res = await fetch(`${API_BASE_URL}/api/ihale-sonuclari/tracking-aktar/${tenderId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    
    if (!data.success) throw new Error(data.error);
    return data as { success: true; data: IhaleSonucu; message: string; existing?: boolean };
  },
};

// Durum label ve renk helper'ları
export const durumConfig: Record<IhaleSonucDurum, { label: string; color: string; icon: string }> = {
  beklemede: { label: 'Beklemede', color: 'gray', icon: '⏳' },
  asiri_dusuk_soruldu: { label: 'Aşırı Düşük Soruldu', color: 'orange', icon: '⚠️' },
  asiri_dusuk_cevaplandi: { label: 'Açıklama Verildi', color: 'blue', icon: '📝' },
  kazandik: { label: 'Kazandık', color: 'green', icon: '✅' },
  elendik: { label: 'Elendik', color: 'red', icon: '❌' },
  itiraz_edildi: { label: 'İtiraz Edildi', color: 'violet', icon: '⚖️' },
  kik_basvurusu: { label: 'KİK Başvurusu', color: 'indigo', icon: '🏛️' },
  sonuclandi: { label: 'Sonuçlandı', color: 'teal', icon: '🏁' },
};

export default ihaleSonuclariApi;
