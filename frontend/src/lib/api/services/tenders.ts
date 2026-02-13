/**
 * Tenders API Servisleri
 * İhale yönetimi için merkezi API servisleri
 *
 * NOT: Bu dosyadaki `any` kullanımları bilinçlidir.
 * Backend API response'ları dinamik yapıda olduğundan, her endpoint için
 * ayrı interface tanımlamak yerine `any` kullanılmaktadır.
 * İleride response type'ları tanımlandığında kaldırılabilir.
 */

/* biome-ignore-all lint/suspicious/noExplicitAny: API response tipleri henüz tanımlanmadı */

import { api } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import type { Tender, TendersResponse } from '@/types/api';
import type { TeklifResponse } from '@/types/domain';
import type { ApiResponse } from '../types';

// ─── Rakip Analizi Types ────────────────────────────────────
export interface RakipGecmis {
  ihale_basligi: string;
  kurum_adi: string;
  sehir: string;
  sozlesme_bedeli: number | null;
  indirim_orani: number | null;
  sozlesme_tarihi: string | null;
  rol: string;
  durum: string;
}

export interface Rakip {
  yuklenici_id: number | null;
  unvan: string;
  katildigi_ihale_sayisi: number | null;
  kazanma_orani: number | null;
  ortalama_indirim_orani: number | null;
  aktif_sehirler: string[] | null;
  devam_eden_is?: number | null;
  son_ihale_tarihi?: string | null;
  takipte: boolean;
  istihbarat_takibi?: boolean;
  puan?: number | null;
  ihalebul_url?: string | null;
  katman: 'kesin' | 'kuvvetli' | 'sehir' | 'web_kesfedildi' | 'web_yeni';
  neden: string;
  gecmis: RakipGecmis[];
}

export interface RakipAnaliziResponse {
  success: boolean;
  ihale: {
    id: number;
    kurum: string;
    sehir: string;
    tahmini_bedel: number | null;
  };
  katmanlar: {
    kesin_rakipler: Rakip[];
    kuvvetli_adaylar: Rakip[];
    sehir_aktif: Rakip[];
    web_kesfedilen: Rakip[];
  };
  toplam_rakip: number;
  kaynak: 'ic_veri' | 'tavily' | 'yok';
  tavily_ozet: string | null;
  cached?: boolean;
}

// Tenders API
export const tendersAPI = {
  /**
   * İhaleleri listele
   */
  async getTenders(params?: {
    page?: number;
    limit?: number;
    city?: string;
    search?: string;
    status?: string;
  }): Promise<TendersResponse> {
    const response = await api.get('/api/tenders', { params });
    return response.data;
  },

  /**
   * İhale detayını getir
   */
  async getTenderById(id: string): Promise<ApiResponse<Tender>> {
    const response = await api.get(`/api/tenders/${id}`);
    return response.data;
  },

  /**
   * İhale güncelleme istatistiklerini getir
   */
  async getTenderStats(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/tenders/stats/updates');
    return response.data;
  },

  /**
   * Takip listesindeki ihale ID'lerini getir
   */
  async getTrackingIds(): Promise<ApiResponse<Array<{ tender_id: number }>>> {
    const response = await api.get('/api/tender-tracking');
    return response.data;
  },

  /**
   * İhale takip durumunu kontrol et
   */
  async checkTracking(tenderId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/tender-tracking/check/${tenderId}`);
    return response.data;
  },

  /**
   * İhale takibe ekle
   */
  async addTracking(tenderId: number): Promise<ApiResponse<any>> {
    const response = await api.post('/api/tender-tracking', { tender_id: tenderId });
    return response.data;
  },

  /**
   * İhale takipten çıkar
   */
  async removeTracking(trackingId: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/tender-tracking/${trackingId}`);
    return response.data;
  },

  /**
   * Takip listesini getir (detaylı)
   */
  async getTrackingList(): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/tender-tracking');
    return response.data;
  },

  /**
   * Tekil takip kaydını getir (ihale masası sayfası için)
   */
  async getTrackedTenderDetail(tenderId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/tender-tracking/detail/${tenderId}`);
    return response.data;
  },

  /**
   * Takip kaydını güncelle
   */
  async updateTracking(trackingId: number, data: any): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/tender-tracking/${trackingId}`, data);
    return response.data;
  },

  /**
   * Döküman analizinden tespit edilen önerileri getir
   */
  async getTenderSuggestions(trackingId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/tender-tracking/${trackingId}/suggestions`);
    return response.data;
  },

  /**
   * Takip notunu ekle
   */
  async addTrackingNote(trackingId: number, note: string): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/tender-tracking/${trackingId}/notes`, { note });
    return response.data;
  },

  /**
   * Takip notunu sil
   */
  async deleteTrackingNote(trackingId: number, noteId: string | number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/tender-tracking/${trackingId}/notes/${noteId}`);
    return response.data;
  },

  /**
   * İhale AI analizi
   */
  async getTrackingAnalysis(tenderId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/tender-tracking/${tenderId}/analysis`);
    return response.data;
  },

  /**
   * İhale takip detayları (tam metin dahil)
   */
  async getTrackingDetails(tenderId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/tender-tracking/${tenderId}/analysis`);
    return response.data;
  },

  /**
   * Döküman yükle
   */
  async uploadDocument(file: File, metadata?: Record<string, any>): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Dökümanları listele
   */
  async getDocuments(): Promise<ApiResponse<any>> {
    const response = await api.get('/api/documents');
    return response.data;
  },

  /**
   * İhale dökümanlarını getir
   */
  async getTenderDocuments(tenderId: string): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/documents/list/${tenderId}`);
    return response.data;
  },

  /**
   * Döküman indirme URL'i
   */
  getDocumentDownloadUrl(tenderId: string, docType: string): string {
    return `${API_BASE_URL}/api/documents/download/${tenderId}/${docType}`;
  },

  /**
   * İhale için dökümanları scrape et
   */
  async scrapeDocumentsForTender(tenderId: string): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/documents/scrape/${tenderId}`);
    return response.data;
  },

  /**
   * İhale detayını getir (alias for getTenderById)
   */
  async getTender(id: number): Promise<ApiResponse<Tender>> {
    const response = await api.get(`/api/tenders/${id}`);
    return response.data;
  },

  // TENDER NOTES: Eski legacy API fonksiyonlari kaldirildi (2026-02-10).
  // Yeni kodlar icin unified notes sistemi kullanilmalidir:
  //   Frontend: useNotes hook + useNotesModal context
  //   Backend: /api/notes/* endpoint'leri

  // ========== TENDER CONTENT & DOCUMENTS ==========

  /**
   * İhale içerik dökümanlarını getir
   */
  async getTenderContentDocuments(tenderId: string | number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/tender-content/${tenderId}/documents`);
    return response.data;
  },

  /**
   * İndirilen dökümanları getir
   */
  async getDownloadedDocuments(tenderId: string | number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/tender-docs/${tenderId}/downloaded-documents`);
    return response.data;
  },

  /**
   * Döküman indirme durumunu getir
   */
  async getDownloadStatus(tenderId: string | number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/tender-docs/${tenderId}/download-status`);
    return response.data;
  },

  /**
   * Dökümanları indir (tetikle)
   */
  async downloadTenderDocuments(tenderId: string | number): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/tender-docs/${tenderId}/download-documents`);
    return response.data;
  },

  /**
   * İçerik dökümanlarını oluştur
   */
  async createContentDocuments(tenderId: string | number): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/tender-content/${tenderId}/create-documents`);
    return response.data;
  },

  /**
   * Analizden takip listesine ekle
   */
  async addTrackingFromAnalysis(tenderId: number): Promise<ApiResponse<any>> {
    const response = await api.post('/api/tender-tracking/add-from-analysis', {
      tender_id: tenderId,
    });
    return response.data;
  },

  /**
   * Hatalı dökümanları sıfırla
   */
  async resetFailedDocuments(documentIds: number[]): Promise<ApiResponse<any>> {
    const response = await api.post('/api/tender-content/documents/reset-failed', { documentIds });
    return response.data;
  },

  /**
   * AI notunu gizle
   */
  async hideTrackingNote(tenderId: number, noteId: string, noteText: string): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/tender-tracking/${tenderId}/hide-note`, {
      noteId,
      noteText,
    });
    return response.data;
  },

  /**
   * Batch analiz URL'i (streaming için fetch gerekli)
   */
  getAnalyzeBatchUrl(): string {
    return `${API_BASE_URL}/api/tender-content/analyze-batch`;
  },

  /**
   * İhale dökümanlarını AI ile analiz et
   */
  async analyzeDocuments(tenderId: string): Promise<ApiResponse<any>> {
    const response = await api.post('/api/tender-content/analyze-batch', {
      tenderId: parseInt(tenderId, 10),
    });
    return response.data;
  },

  // ========== RAKİP ANALİZİ ==========

  /**
   * İhale için potansiyel rakip analizi
   * Hibrit: iç veritabanı + Tavily web araması
   */
  async getRakipAnalizi(tenderId: number, force = false): Promise<ApiResponse<RakipAnaliziResponse>> {
    const response = await api.get(`/api/tender-tracking/${tenderId}/rakip-analizi`, {
      params: force ? { force: 'true' } : undefined,
    });
    return response.data;
  },

  // ========== FIRMALAR ==========

  /**
   * Firmaları getir
   */
  async getFirmalar(): Promise<ApiResponse<any[]>> {
    const response = await api.get('/api/firmalar');
    return response.data;
  },

  // ========== TEKLİFLER ==========

  /**
   * İhaleye ait teklifi getir
   */
  async getTeklifByIhale(ihaleId: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/teklifler/ihale/${ihaleId}`);
    return response.data;
  },

  /**
   * Teklif oluştur
   */
  async createTeklif(
    data: Omit<TeklifResponse, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<TeklifResponse>> {
    const response = await api.post('/api/teklifler', data);
    return response.data;
  },

  /**
   * Teklif güncelle
   */
  async updateTeklif(teklifId: number, data: Partial<TeklifResponse>): Promise<ApiResponse<TeklifResponse>> {
    const response = await api.put(`/api/teklifler/${teklifId}`, data);
    return response.data;
  },
};
