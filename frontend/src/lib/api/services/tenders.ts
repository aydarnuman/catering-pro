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

  // ========== TENDER NOTES (LEGACY COMPATIBILITY) ==========
  // Bu bölüm eski NotesSection component'i için geriye dönük uyumluluk sağlar.
  // Yeni kodlar için unified notes sistemi kullanılmalıdır.
  // Frontend: ContextualNotesSection component'i ve useNotes hook'u
  // Backend: /api/notes/context/tender/:id endpoint'leri

  async getTenderNotes(trackingId: number): Promise<ApiResponse<TenderNote[]>> {
    const response = await api.get(`/api/notes/context/tender/${trackingId}`);
    return response.data;
  },

  async getTagSuggestions(): Promise<ApiResponse<string[]>> {
    const response = await api.get('/api/notes/tags/suggestions');
    return response.data;
  },

  async createTenderNote(
    trackingId: number,
    noteData: {
      text?: string;
      content?: string;
      color?: string;
      priority?: string;
      tags?: string[];
      pinned?: boolean;
      reminder_date?: string | null;
    }
  ): Promise<ApiResponse<TenderNote>> {
    // Legacy field mapping: text -> content
    const payload = {
      content: noteData.content || noteData.text || '',
      color: noteData.color,
      priority: noteData.priority,
      tags: noteData.tags,
      is_pinned: noteData.pinned,
      due_date: noteData.reminder_date,
    };
    const response = await api.post(`/api/notes/context/tender/${trackingId}`, payload);
    return response.data;
  },

  async updateTenderNote(
    _trackingId: number,
    noteId: number,
    updates: {
      text?: string;
      content?: string;
      color?: string;
      priority?: string;
      pinned?: boolean;
      tags?: string[];
      reminder_date?: string | null;
    }
  ): Promise<ApiResponse<TenderNote>> {
    // Legacy field mapping
    const payload: Record<string, unknown> = {};
    if (updates.content || updates.text) payload.content = updates.content || updates.text;
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.pinned !== undefined) payload.is_pinned = updates.pinned;
    if (updates.tags !== undefined) payload.tags = updates.tags;
    if (updates.reminder_date !== undefined) payload.due_date = updates.reminder_date;
    const response = await api.put(`/api/notes/${noteId}`, payload);
    return response.data;
  },

  async deleteTenderNote(_trackingId: number, noteId: number): Promise<ApiResponse<void>> {
    const response = await api.delete(`/api/notes/${noteId}`);
    return response.data;
  },

  async pinTenderNote(
    _trackingId: number,
    noteId: number,
    _pinned: boolean
  ): Promise<ApiResponse<TenderNote>> {
    const response = await api.put(`/api/notes/${noteId}/pin`);
    return response.data;
  },

  async addTenderNoteAttachment(
    _trackingId: number,
    noteId: number,
    formData: FormData
  ): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/notes/${noteId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async deleteTenderNoteAttachment(
    _trackingId: number,
    noteId: number,
    attachmentId: number
  ): Promise<ApiResponse<void>> {
    const response = await api.delete(`/api/notes/${noteId}/attachments/${attachmentId}`);
    return response.data;
  },

  async reorderTenderNotes(trackingId: number, noteIds: number[]): Promise<ApiResponse<void>> {
    const response = await api.put(`/api/notes/context/tender/${trackingId}/reorder`, {
      noteIds: noteIds.map(String),
    });
    return response.data;
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

  /**
   * İhale dökümanlarını AI ile analiz et
   */
  async analyzeDocuments(tenderId: string): Promise<ApiResponse<any>> {
    const response = await api.post('/api/tender-content/analyze-batch', {
      tenderId: parseInt(tenderId, 10),
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
  async updateTeklif(
    teklifId: number,
    data: Partial<TeklifResponse>
  ): Promise<ApiResponse<TeklifResponse>> {
    const response = await api.put(`/api/teklifler/${teklifId}`, data);
    return response.data;
  },
};
