/**
 * AI API Servisleri
 * AI ayarları, şablonlar, hafıza ve feedback için merkezi API servisleri
 */

import { api } from '@/lib/api';
import type { ConversationHistory } from '@/types/domain';
import type { ApiResponse } from '../types';

// İhale Agent Analysis result from backend
export interface AgentAnalysisResult {
  id?: number;
  agentId: string;
  findings: Array<{
    label: string;
    value: string;
    severity?: 'info' | 'warning' | 'critical';
    confidence?: number;
    reasoning?: string;
  }>;
  riskScore: number;
  summary: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  keyRisks?: string[];
  recommendations?: string[];
  model?: string;
  createdAt?: string;
  version?: number;
}

// AI Verdict
export interface AIVerdict {
  recommendation: 'gir' | 'dikkat' | 'girme';
  recommendationLabel: string;
  overallScore: number;
  reasoning: string;
  checklist: Array<{
    id: string;
    label: string;
    status: 'pass' | 'fail' | 'unknown';
    detail: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  crossReferences: Array<{
    fromAgentId: string;
    toAgentId: string;
    fromFinding: string;
    impact: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  strategicNotes: string;
  generatedAt: string;
  generatedBy: 'ai' | 'rule';
}

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

// AI Settings (local definition for backward compatibility)
export interface AISettings {
  model?: string;
  temperature?: number;
  max_tokens?: number;
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

// ─── Malzeme Eşleştirme Types (Menu-bazlı) ──────────────

export interface ApprovedIngredientMatch {
  sartname_item: string;
  urun_id: number;
  urun_ad: string;
  gramaj: number | null;
  gramaj_birim: string;
  fiyat: number | null;
  porsiyon_maliyet: number | null;
  match_confidence: number;
  user_modified: boolean;
  yemek_adi?: string;
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
  async deleteTemplate(id: number): Promise<ApiResponse<{ message: string }>> {
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
  async updateSettings(settings: Record<string, unknown>): Promise<ApiResponse<{ updatedKeys: string[] }>> {
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
  async importSettings(
    settings: Record<string, unknown>,
    overwrite: boolean = false
  ): Promise<
    ApiResponse<{
      imported: number;
      skipped: number;
      importedKeys: string[];
      skippedKeys: string[];
      errors?: Array<{ key: string; error: string }>;
    }>
  > {
    const response = await api.post('/api/ai/settings/import', { settings, overwrite });
    return response.data;
  },

  /**
   * AI ayarları versiyon geçmişini getir
   */
  async getSettingsHistory(
    settingKey?: string,
    limit: number = 50
  ): Promise<
    ApiResponse<{
      history: Array<{
        id: number;
        settingKey: string;
        value: unknown;
        version: number;
        changedBy?: string;
        changeNote?: string;
        createdAt: string;
      }>;
      count: number;
    }>
  > {
    const params = new URLSearchParams();
    if (settingKey) params.append('settingKey', settingKey);
    params.append('limit', limit.toString());

    const response = await api.get(`/api/ai/settings/history?${params.toString()}`);
    return response.data;
  },

  /**
   * Belirli bir versiyonu getir
   */
  async getSettingVersion(
    settingKey: string,
    version: number
  ): Promise<
    ApiResponse<{
      settingKey: string;
      value: unknown;
      version: number;
      createdAt: string;
    }>
  > {
    const response = await api.get(`/api/ai/settings/history/${settingKey}/${version}`);
    return response.data;
  },

  /**
   * Versiyona geri dön
   */
  async restoreVersion(
    settingKey: string,
    version: number,
    changeNote?: string
  ): Promise<
    ApiResponse<{
      message: string;
      restored: boolean;
    }>
  > {
    const response = await api.post(`/api/ai/settings/restore/${settingKey}/${version}`, {
      changeNote,
    });
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
  async updateModel(modelId: string): Promise<
    ApiResponse<{
      message: string;
      model: string;
    }>
  > {
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
  async deleteMemory(id: number): Promise<ApiResponse<{ message: string }>> {
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
  }): Promise<ApiResponse<{ message: string; feedbackId: number }>> {
    const response = await api.post('/api/ai/feedback', data);
    return response.data;
  },

  /**
   * AI agent mesajı gönder
   */
  async sendAgentMessage(data: {
    message: string;
    history?: ConversationHistory[];
    sessionId?: string;
    department?: string;
    templateSlug?: string;
    pageContext?: unknown;
    systemContext?: string;
  }): Promise<
    ApiResponse<{
      response: string;
      sessionId: string;
    }>
  > {
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
    pageContext?: unknown;
  }): Promise<
    ApiResponse<{
      response: string;
      sessionId: string;
    }>
  > {
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
  async incrementTemplateUsage(slug: string): Promise<
    ApiResponse<{
      message: string;
      usageCount: number;
    }>
  > {
    const response = await api.post(`/api/ai/templates/${slug}/increment-usage`);
    return response.data;
  },

  /**
   * AI sohbet geçmişini getir
   */
  async getChatHistory(params?: { page?: number; limit?: number }): Promise<
    ApiResponse<{
      chats: Array<{
        id: string;
        title: string;
        lastMessage: string;
        createdAt: string;
      }>;
      total: number;
    }>
  > {
    const response = await api.get('/api/ai/history', { params });
    return response.data;
  },

  /**
   * Sohbet detayını getir
   */
  async getChatDetail(chatId: string): Promise<
    ApiResponse<{
      id: string;
      messages: Array<{ role: string; content: string; timestamp: string }>;
    }>
  > {
    const response = await api.get(`/api/ai/history/${chatId}`);
    return response.data;
  },

  /**
   * Sohbet sil
   */
  async deleteChat(chatId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await api.delete(`/api/ai/history/${chatId}`);
    return response.data;
  },

  /**
   * Sohbet oturumlarını listele
   */
  async getConversations(params?: { limit?: number }): Promise<
    ApiResponse<{
      conversations: Array<{
        sessionId: string;
        title: string;
        lastMessage: string;
        createdAt: string;
      }>;
    }>
  > {
    const response = await api.get('/api/ai/conversations', { params });
    return response.data;
  },

  /**
   * Sohbet oturumlarında ara
   */
  async searchConversations(
    query: string,
    limit?: number
  ): Promise<
    ApiResponse<{
      results: Array<{
        sessionId: string;
        title: string;
        matchedContent: string;
      }>;
    }>
  > {
    const response = await api.get('/api/ai/conversations/search', {
      params: { q: query, limit: limit || 50 },
    });
    return response.data;
  },

  /**
   * Sohbet oturumu detayını getir
   */
  async getConversation(sessionId: string): Promise<
    ApiResponse<{
      sessionId: string;
      messages: Array<{ role: string; content: string; timestamp: string }>;
    }>
  > {
    const response = await api.get(`/api/ai/conversations/${sessionId}`);
    return response.data;
  },

  /**
   * Sohbet oturumunu sil
   */
  async deleteConversation(sessionId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await api.delete(`/api/ai/conversations/${sessionId}`);
    return response.data;
  },

  /**
   * Prefix ile sohbet oturumlarını listele
   */
  async listConversationsByPrefix(prefix: string): Promise<
    ApiResponse<{
      conversations: Array<{ sessionId: string; title: string }>;
    }>
  > {
    const response = await api.get('/api/ai/conversations/list', { params: { prefix } });
    return response.data;
  },

  /**
   * Dilekçe AI chat gönder
   */
  async sendDilekceChat(data: { message: string; sessionId: string; dilekceType: string; context: unknown }): Promise<
    ApiResponse<{
      response: string;
      sessionId: string;
    }>
  > {
    const response = await api.post('/api/ai/dilekce-chat', data);
    return response.data;
  },

  /**
   * Dilekçe kaydet
   */
  async saveDilekce(data: { tender_tracking_id: string | number; dilekce_type: string; content: string }): Promise<
    ApiResponse<{
      id: number;
      message: string;
    }>
  > {
    const response = await api.post('/api/tender-dilekce', data);
    return response.data;
  },

  /**
   * Dilekçeleri getir (ihale için)
   */
  async getDilekceByTender(tenderId: string | number): Promise<
    ApiResponse<{
      dilekce: Array<{
        id: number;
        dilekce_type: string;
        content: string;
        created_at: string;
      }>;
    }>
  > {
    const response = await api.get(`/api/tender-dilekce/${tenderId}`);
    return response.data;
  },

  /**
   * Dilekçe sil
   */
  async deleteDilekce(dilekceId: number): Promise<ApiResponse<{ message: string }>> {
    const response = await api.delete(`/api/tender-dilekce/${dilekceId}`);
    return response.data;
  },

  /**
   * AI hafızaya konuşma kaydet
   */
  async saveConversationToMemory(data: { sessionId: string; summary?: string; context?: unknown }): Promise<
    ApiResponse<{
      id: number;
      message: string;
    }>
  > {
    const response = await api.post('/api/ai-memory/conversation', data);
    return response.data;
  },

  /**
   * Dilekçe export et
   */
  async exportDilekce(
    format: string,
    data: {
      content: string;
      title?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Blob> {
    const response = await api.post(`/api/export/dilekce/${format}`, data, {
      responseType: 'blob',
    });
    return response.data;
  },

  // ═══════════════════════════════════════════
  // İHALE MASASI — Malzeme Eşleştirme
  // ═══════════════════════════════════════════

  /**
   * Şartname örnek menü tariflerini çıkar, ürün kartlarıyla eşleştir, yemek bazlı maliyet hesapla
   */
  async matchIngredients(tenderId: number): Promise<Record<string, unknown>> {
    const response = await api.post('/api/ai/ihale-masasi/match-ingredients', { tenderId });
    return response.data;
  },

  /**
   * Onaylanan malzeme eşleştirmelerini kaydet
   */
  async saveIngredientMatches(data: {
    tenderId: number;
    matches: ApprovedIngredientMatch[];
  }): Promise<ApiResponse<{ message: string; saved: number }>> {
    const response = await api.post('/api/ai/ihale-masasi/save-ingredient-matches', data);
    return response.data;
  },

  /**
   * Kaydedilmiş malzeme eşleştirmelerini getir
   */
  async getSavedIngredientMatches(
    tenderId: number
  ): Promise<ApiResponse<{ matches: ApprovedIngredientMatch[] | null }>> {
    const response = await api.get(`/api/ai/ihale-masasi/ingredient-matches/${tenderId}`);
    const raw = response.data;
    return {
      success: raw.success,
      data: { matches: raw.matches ?? null },
      error: raw.error,
    };
  },

  // ═══════════════════════════════════════════
  // İHALE MASASI — AI Agent Analiz
  // ═══════════════════════════════════════════

  /**
   * 4 agent'ı paralel çalıştır
   */
  async analyzeAllAgents(
    tenderId: number,
    force = false,
    additionalContext?: { notes?: string[]; snippets?: Record<string, string[]> }
  ): Promise<
    ApiResponse<{
      analyses: Record<string, AgentAnalysisResult>;
      errors: Array<{ agentId: string; error: string }>;
    }>
  > {
    const response = await api.post('/api/ai/ihale-masasi/analyze-all', {
      tenderId,
      force,
      additionalContext,
    });
    // Backend { success, analyses, errors } döner — data wrapper'a sar
    const raw = response.data;
    return { success: raw.success, data: { analyses: raw.analyses, errors: raw.errors ?? [] }, error: raw.error };
  },

  /**
   * Tek agent analizi
   */
  async analyzeSingleAgent(
    tenderId: number,
    agentId: string,
    force = false,
    additionalContext?: { notes?: string[]; snippets?: string[] }
  ): Promise<ApiResponse<{ analysis: AgentAnalysisResult; cached: boolean }>> {
    const response = await api.post('/api/ai/ihale-masasi/analyze-agent', {
      tenderId,
      agentId,
      force,
      additionalContext,
    });
    // Backend { success, analysis, cached } döner — data wrapper'a sar
    const raw = response.data;
    return { success: raw.success, data: { analysis: raw.analysis, cached: raw.cached ?? false }, error: raw.error };
  },

  /**
   * Cache'den hızlı yükleme
   */
  async getCachedAgentAnalyses(
    tenderId: number
  ): Promise<ApiResponse<{ analyses: Record<string, AgentAnalysisResult> | null; cached: boolean }>> {
    const response = await api.get(`/api/ai/ihale-masasi/analysis/${tenderId}`);
    // Backend { success, analyses, cached } döner — data wrapper'a sar
    const raw = response.data;
    return {
      success: raw.success,
      data: { analyses: raw.analyses ?? null, cached: raw.cached ?? false },
      error: raw.error,
    };
  },

  /**
   * AI ile akıllı verdict üret (tüm agent bulgularını sentezle)
   */
  async generateAIVerdict(
    tenderId: number,
    analyses: Record<string, AgentAnalysisResult>
  ): Promise<ApiResponse<{ verdict: AIVerdict }>> {
    const response = await api.post('/api/ai/ihale-masasi/verdict', { tenderId, analyses });
    // Backend { success, verdict } döner — data wrapper'a sar
    const raw = response.data;
    return { success: raw.success, data: { verdict: raw.verdict }, error: raw.error };
  },
};
