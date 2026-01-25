/**
 * AI API Servisleri
 * AI ayarları, şablonlar, hafıza ve feedback için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// AI Template
export interface AITemplate {
  id: number;
  name: string;
  description?: string;
  system_prompt: string;
  user_prompt?: string;
  category?: string;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

// AI Settings
export interface AISettings {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
}

// AI Model
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  is_default?: boolean;
}

// AI Memory
export interface AIMemory {
  id: number;
  content: string;
  context?: string;
  created_at: string;
}

// AI Feedback Stats
export interface AIFeedbackStats {
  total: number;
  positive: number;
  negative: number;
  average_rating?: number;
}

// AI API
export const aiAPI = {
  /**
   * AI şablonlarını getir
   */
  async getTemplates(): Promise<ApiResponse<{ templates: AITemplate[] }>> {
    const response = await api.get('/api/ai/templates');
    return response.data;
  },

  /**
   * AI şablonu oluştur
   */
  async createTemplate(template: Partial<AITemplate>): Promise<ApiResponse<AITemplate>> {
    const response = await api.post('/api/ai/templates', template);
    return response.data;
  },

  /**
   * AI şablonu güncelle
   */
  async updateTemplate(id: number, template: Partial<AITemplate>): Promise<ApiResponse<AITemplate>> {
    const response = await api.put(`/api/ai/templates/${id}`, template);
    return response.data;
  },

  /**
   * AI şablonu sil
   */
  async deleteTemplate(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/ai/templates/${id}`);
    return response.data;
  },

  /**
   * AI ayarlarını getir
   */
  async getSettings(): Promise<ApiResponse<{ settings: AISettings }>> {
    const response = await api.get('/api/ai/settings');
    return response.data;
  },

  /**
   * AI ayarlarını güncelle
   */
  async updateSettings(settings: Record<string, any>): Promise<ApiResponse<{ updatedKeys: string[] }>> {
    const response = await api.put('/api/ai/settings', { settings });
    return response.data;
  },

  /**
   * AI ayarlarını export et (JSON dosyası indir)
   */
  async exportSettings(): Promise<Blob> {
    const response = await api.get('/api/ai/settings/export', {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * AI ayarlarını import et
   */
  async importSettings(settings: Record<string, any>, overwrite: boolean = false): Promise<ApiResponse<{
    imported: number;
    skipped: number;
    importedKeys: string[];
    skippedKeys: string[];
    errors?: Array<{ key: string; error: string }>;
  }>> {
    const response = await api.post('/api/ai/settings/import', { settings, overwrite });
    return response.data;
  },

  /**
   * AI ayarları versiyon geçmişini getir
   */
  async getSettingsHistory(settingKey?: string, limit: number = 50): Promise<ApiResponse<{
    history: any[];
    count: number;
  }>> {
    const params = new URLSearchParams();
    if (settingKey) params.append('settingKey', settingKey);
    params.append('limit', limit.toString());
    
    const response = await api.get(`/api/ai/settings/history?${params.toString()}`);
    return response.data;
  },

  /**
   * Belirli bir versiyonu getir
   */
  async getSettingVersion(settingKey: string, version: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/ai/settings/history/${settingKey}/${version}`);
    return response.data;
  },

  /**
   * Versiyona geri dön
   */
  async restoreVersion(settingKey: string, version: number, changeNote?: string): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/ai/settings/restore/${settingKey}/${version}`, { changeNote });
    return response.data;
  },

  /**
   * Mevcut AI modellerini getir
   */
  async getModels(): Promise<ApiResponse<{ models: AIModel[]; defaultModel: string }>> {
    const response = await api.get('/api/ai/settings/models');
    return response.data;
  },

  /**
   * AI modelini değiştir
   */
  async updateModel(modelId: string): Promise<ApiResponse<any>> {
    const response = await api.put('/api/ai/settings/model', { model: modelId });
    return response.data;
  },

  /**
   * Feedback istatistiklerini getir
   */
  async getFeedbackStats(): Promise<ApiResponse<{ stats: AIFeedbackStats }>> {
    const response = await api.get('/api/ai/feedback/stats');
    return response.data;
  },

  /**
   * AI hafızasını getir
   */
  async getMemories(params?: { limit?: number }): Promise<ApiResponse<{ memories: AIMemory[] }>> {
    const response = await api.get('/api/ai/memory', { params });
    return response.data;
  },

  /**
   * AI hafıza kaydını sil
   */
  async deleteMemory(id: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/ai/memory/${id}`);
    return response.data;
  },

  /**
   * AI feedback gönder
   */
  async sendFeedback(data: {
    rating: number;
    feedbackType: 'helpful' | 'not_helpful';
    messageContent: string;
    aiResponse: string;
    templateSlug?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/ai/feedback', data);
    return response.data;
  },

  /**
   * AI agent mesajı gönder
   */
  async sendAgentMessage(data: {
    message: string;
    history?: Array<{ role: string; content: string }>;
    sessionId?: string;
    department?: string;
    templateSlug?: string;
    pageContext?: any;
    systemContext?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/ai/agent', data);
    return response.data;
  },

  /**
   * God Mode mesajı gönder
   */
  async sendGodModeMessage(data: {
    message: string;
    history?: Array<{ role: string; content: string }>;
    sessionId?: string;
    department?: string;
    templateSlug?: string;
    pageContext?: any;
  }): Promise<ApiResponse<any>> {
    // Modern endpoint kullan (aiAgent.processQuery ile)
    const response = await api.post('/api/ai/god-mode/execute', {
      message: data.message,
      sessionId: data.sessionId,
      history: data.history || [],
    });
    return response.data;
  },

  /**
   * Template kullanım sayısını artır
   */
  async incrementTemplateUsage(slug: string): Promise<ApiResponse<any>> {
    const response = await api.post(`/api/ai/templates/${slug}/increment-usage`);
    return response.data;
  },

  /**
   * AI sohbet geçmişini getir
   */
  async getChatHistory(params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    const response = await api.get('/api/ai/history', { params });
    return response.data;
  },

  /**
   * Sohbet detayını getir
   */
  async getChatDetail(chatId: string): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/ai/history/${chatId}`);
    return response.data;
  },

  /**
   * Sohbet sil
   */
  async deleteChat(chatId: string): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/ai/history/${chatId}`);
    return response.data;
  },

  /**
   * Sohbet oturumlarını listele
   */
  async getConversations(params?: { limit?: number }): Promise<ApiResponse<any>> {
    const response = await api.get('/api/ai/conversations', { params });
    return response.data;
  },

  /**
   * Sohbet oturumlarında ara
   */
  async searchConversations(query: string, limit?: number): Promise<ApiResponse<any>> {
    const response = await api.get('/api/ai/conversations/search', {
      params: { q: query, limit: limit || 50 },
    });
    return response.data;
  },

  /**
   * Sohbet oturumu detayını getir
   */
  async getConversation(sessionId: string): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/ai/conversations/${sessionId}`);
    return response.data;
  },

  /**
   * Sohbet oturumunu sil
   */
  async deleteConversation(sessionId: string): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/ai/conversations/${sessionId}`);
    return response.data;
  },

  /**
   * Prefix ile sohbet oturumlarını listele
   */
  async listConversationsByPrefix(prefix: string): Promise<ApiResponse<any>> {
    const response = await api.get('/api/ai/conversations/list', { params: { prefix } });
    return response.data;
  },

  /**
   * Dilekçe AI chat gönder
   */
  async sendDilekceChat(data: {
    message: string;
    sessionId: string;
    dilekceType: string;
    context: any;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/ai/dilekce-chat', data);
    return response.data;
  },

  /**
   * Dilekçe kaydet
   */
  async saveDilekce(data: {
    tender_tracking_id: string | number;
    dilekce_type: string;
    content: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/tender-dilekce', data);
    return response.data;
  },

  /**
   * Dilekçeleri getir (ihale için)
   */
  async getDilekceByTender(tenderId: string | number): Promise<ApiResponse<any>> {
    const response = await api.get(`/api/tender-dilekce/${tenderId}`);
    return response.data;
  },

  /**
   * Dilekçe sil
   */
  async deleteDilekce(dilekceId: number): Promise<ApiResponse<any>> {
    const response = await api.delete(`/api/tender-dilekce/${dilekceId}`);
    return response.data;
  },

  /**
   * AI hafızaya konuşma kaydet
   */
  async saveConversationToMemory(data: {
    sessionId: string;
    summary?: string;
    context?: any;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/api/ai-memory/conversation', data);
    return response.data;
  },

  /**
   * Dilekçe export et
   */
  async exportDilekce(format: string, data: any): Promise<Blob> {
    const response = await api.post(`/api/export/dilekce/${format}`, data, {
      responseType: 'blob',
    });
    return response.data;
  },
};
