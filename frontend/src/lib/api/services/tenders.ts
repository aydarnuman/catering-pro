/**
 * Tenders API Servisleri
 * İhale yönetimi için merkezi API servisleri
 */

import { api } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import type { Tender, TendersResponse } from '@/types/api';
import type { TeklifResponse, TenderNote } from '@/types/domain';
import type { ApiResponse } from '../types';

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
   * Takip kaydını güncelle
   */
  async updateTracking(trackingId: number, data: any): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/tender-tracking/${trackingId}`, data);
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
  async deleteTrackingNote(trackingId: number, noteId: number): Promise<ApiResponse<any>> {
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

  // ========== TENDER NOTES ==========

  /**
   * İhale notlarını getir
   */
  async getTenderNotes(trackingId: number): Promise<ApiResponse<TenderNote[]>> {
    const response = await api.get(`/api/tender-notes/${trackingId}`);
    return response.data;
  },

  /**
   * Etiket önerilerini getir
   */
  async getTagSuggestions(): Promise<ApiResponse<string[]>> {
    const response = await api.get('/api/tender-notes/tags/suggestions');
    return response.data;
  },

  /**
   * Not oluştur
   */
  async createTenderNote(
    trackingId: number,
    data: Omit<TenderNote, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<TenderNote>> {
    const response = await api.post(`/api/tender-notes/${trackingId}`, data);
    return response.data;
  },

  /**
   * Not güncelle
   */
  async updateTenderNote(
    trackingId: number,
    noteId: number,
    data: Partial<TenderNote>
  ): Promise<ApiResponse<TenderNote>> {
    const response = await api.put(`/api/tender-notes/${trackingId}/${noteId}`, data);
    return response.data;
  },

  /**
   * Not sil
   */
  async deleteTenderNote(trackingId: number, noteId: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/tender-notes/${trackingId}/${noteId}`);
    return response.data;
  },

  /**
   * Not sabitle/kaldır
   */
  async pinTenderNote(
    trackingId: number,
    noteId: number,
    isPinned: boolean
  ): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/tender-notes/${trackingId}/${noteId}/pin`, {
      is_pinned: isPinned,
    });
    return response.data;
  },

  /**
   * Not tamamlanma durumunu güncelle
   */
  async completeTenderNote(
    trackingId: number,
    noteId: number,
    isCompleted: boolean
  ): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/tender-notes/${trackingId}/${noteId}`, {
      is_completed: isCompleted,
    });
    return response.data;
  },

  /**
   * Nota dosya ekle
   */
  async addTenderNoteAttachment(
    trackingId: number,
    noteId: number,
    formData: FormData
  ): Promise<ApiResponse<any>> {
    const response = await api.post(
      `/api/tender-notes/${trackingId}/${noteId}/attachments`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  },

  /**
   * Not dosyasını sil
   */
  async deleteTenderNoteAttachment(
    trackingId: number,
    noteId: number,
    attachmentId: number
  ): Promise<ApiResponse<any>> {
    const response = await api.delete(
      `/api/tender-notes/${trackingId}/${noteId}/attachments/${attachmentId}`
    );
    return response.data;
  },

  /**
   * Notları yeniden sırala
   */
  async reorderTenderNotes(trackingId: number, orderedIds: number[]): Promise<ApiResponse<any>> {
    const response = await api.put(`/api/tender-notes/${trackingId}/reorder`, { orderedIds });
    return response.data;
  },

  /**
   * Ek dosya indirme URL'i
   */
  getAttachmentDownloadUrl(attachmentId: number): string {
    return `${API_BASE_URL}/api/tender-notes/attachments/${attachmentId}/download`;
  },

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
  async hideTrackingNote(
    tenderId: number,
    noteId: string,
    noteText: string
  ): Promise<ApiResponse<any>> {
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
  async updateTeklif(
    teklifId: number,
    data: Partial<TeklifResponse>
  ): Promise<ApiResponse<TeklifResponse>> {
    const response = await api.put(`/api/teklifler/${teklifId}`, data);
    return response.data;
  },
};
