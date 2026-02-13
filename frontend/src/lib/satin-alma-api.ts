import { API_BASE_URL } from '@/lib/config';
import type { Proje } from '@/types/domain';

const API_URL = `${API_BASE_URL}/api/satin-alma`;
const PROJELER_API_URL = `${API_BASE_URL}/api/projeler`;

// ==================== TİPLER ====================

export type { Proje };

export interface SiparisKalem {
  id?: number;
  urun_adi: string;
  miktar: number;
  birim: string;
  tahmini_fiyat: number;
  gercek_fiyat?: number;
}

export interface Siparis {
  id: number;
  siparis_no: string;
  proje_id: number | null;
  tedarikci_id: number | null;
  baslik: string;
  siparis_tarihi: string;
  teslim_tarihi: string | null;
  durum: 'talep' | 'onay_bekliyor' | 'onaylandi' | 'siparis_verildi' | 'teslim_alindi' | 'iptal';
  oncelik: 'dusuk' | 'normal' | 'yuksek' | 'acil';
  toplam_tutar: number;
  notlar?: string;
  // Join fields
  proje_kod?: string;
  proje_ad?: string;
  proje_renk?: string;
  tedarikci_unvan?: string;
  tedarikci_vkn?: string;
  kalem_sayisi?: number;
  kalemler?: SiparisKalem[];
}

export interface SiparisOzet {
  toplam_siparis: number;
  bekleyen: number;
  tamamlanan: number;
  beklenen_tutar: number;
  bu_ay_harcama: number;
}

// ==================== PROJELER API (MERKEZİ) ====================

export const projelerAPI = {
  list: async (): Promise<{ success: boolean; data: Proje[] }> => {
    try {
      // Merkezi Proje API kullan
      const res = await fetch(`${PROJELER_API_URL}?aktif=true`);
      const json = await res.json();
      // API doğrudan array veya {success, data} formatında dönebilir
      const data = Array.isArray(json) ? json : json.data || [];
      return { success: res.ok, data: Array.isArray(data) ? data : [] };
    } catch (error) {
      console.error('Projeler API hatası:', error);
      return { success: false, data: [] };
    }
  },

  create: async (data: Partial<Proje>): Promise<{ success: boolean; data: Proje }> => {
    const res = await fetch(PROJELER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    return { success: res.ok, data: result };
  },

  update: async (id: number, data: Partial<Proje>): Promise<{ success: boolean; data: Proje }> => {
    const res = await fetch(`${PROJELER_API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    return { success: res.ok, data: result };
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    const res = await fetch(`${PROJELER_API_URL}/${id}`, { method: 'DELETE' });
    return { success: res.ok };
  },
};

// ==================== SİPARİŞLER API ====================

export const siparislerAPI = {
  list: async (filters?: {
    proje_id?: number;
    tedarikci_id?: number;
    durum?: string;
    baslangic?: string;
    bitis?: string;
  }): Promise<{ success: boolean; data: Siparis[] }> => {
    const params = new URLSearchParams();
    if (filters?.proje_id) params.append('proje_id', String(filters.proje_id));
    if (filters?.tedarikci_id) params.append('tedarikci_id', String(filters.tedarikci_id));
    if (filters?.durum) params.append('durum', filters.durum);
    if (filters?.baslangic) params.append('baslangic', filters.baslangic);
    if (filters?.bitis) params.append('bitis', filters.bitis);

    const res = await fetch(`${API_URL}/siparisler?${params}`);
    return res.json();
  },

  get: async (id: number): Promise<{ success: boolean; data: Siparis }> => {
    const res = await fetch(`${API_URL}/siparisler/${id}`);
    return res.json();
  },

  create: async (data: {
    proje_id: number | null;
    tedarikci_id: number | null;
    baslik: string;
    siparis_tarihi: string;
    teslim_tarihi?: string;
    oncelik?: string;
    notlar?: string;
    kalemler: SiparisKalem[];
  }): Promise<{ success: boolean; data: Siparis }> => {
    const res = await fetch(`${API_URL}/siparisler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  update: async (
    id: number,
    data: Partial<Siparis & { kalemler?: SiparisKalem[] }>
  ): Promise<{ success: boolean; data: Siparis }> => {
    const res = await fetch(`${API_URL}/siparisler/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateDurum: async (id: number, durum: Siparis['durum']): Promise<{ success: boolean; data: Siparis }> => {
    const res = await fetch(`${API_URL}/siparisler/${id}/durum`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durum }),
    });
    return res.json();
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/siparisler/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Özet istatistikler
  getOzet: async (): Promise<{ success: boolean; data: SiparisOzet }> => {
    const res = await fetch(`${API_URL}/ozet`);
    return res.json();
  },

  // Proje bazlı rapor
  getProjeBazliRapor: async (baslangic?: string, bitis?: string): Promise<{ success: boolean; data: any[] }> => {
    const params = new URLSearchParams();
    if (baslangic) params.append('baslangic', baslangic);
    if (bitis) params.append('bitis', bitis);
    const res = await fetch(`${API_URL}/raporlar/proje-bazli?${params}`);
    return res.json();
  },

  // Tedarikçi bazlı rapor
  getTedarikciRapor: async (baslangic?: string, bitis?: string): Promise<{ success: boolean; data: any[] }> => {
    const params = new URLSearchParams();
    if (baslangic) params.append('baslangic', baslangic);
    if (bitis) params.append('bitis', bitis);
    const res = await fetch(`${API_URL}/raporlar/tedarikci-bazli?${params}`);
    return res.json();
  },
};
