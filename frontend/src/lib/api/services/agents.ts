/**
 * Agent Management API Servisleri
 * Merkezi agent yönetimi için API çağrıları
 */

import { api } from '@/lib/api';
import type { ApiResponse } from '../types';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface Agent {
  id: string;
  slug: string;
  name: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  color?: string;
  accent_hex?: string;
  system_prompt?: string;
  model: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  is_system: boolean;
  verdict_weight: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
  // Computed fields from joins
  tool_count?: number;
  knowledge_count?: number;
  context_sort_order?: number;
  last_analysis_at?: string | null;
  last_analysis_status?: string | null;
}

export interface AgentTool {
  id: number;
  agent_id: string;
  tool_slug: string;
  label: string;
  description?: string;
  icon?: string;
  requires_selection: boolean;
  tool_type: 'ai_prompt' | 'api_call' | 'db_query' | 'composite';
  ai_prompt_template?: string;
  urgency_priority: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Computed fields
  agent_slug?: string;
}

export interface AgentKnowledge {
  id: number;
  agent_id: string;
  title: string;
  content_type: 'pdf' | 'url' | 'note' | 'template' | 'past_analysis';
  content?: string;
  file_path?: string;
  file_size?: number;
  summary?: string;
  tags?: string[];
  source: 'manual' | 'auto_import' | 'past_tender';
  source_tender_id?: number;
  is_active: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentContext {
  id: number;
  agent_id: string;
  context_key: string;
  context_label?: string;
  config: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
}

export interface AgentKnowledgeStats {
  total: number;
  pdf_count: number;
  url_count: number;
  note_count: number;
}

export interface AgentDetail extends Agent {
  tools: AgentTool[];
  knowledgeStats: AgentKnowledgeStats;
  contexts: AgentContext[];
}

// Input types for mutations
export interface AgentUpdateInput {
  name?: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  color?: string;
  accent_hex?: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  verdict_weight?: number;
  is_active?: boolean;
}

export interface AgentToolInput {
  tool_slug: string;
  label: string;
  description?: string;
  icon?: string;
  requires_selection?: boolean;
  tool_type?: 'ai_prompt' | 'api_call' | 'db_query' | 'composite';
  ai_prompt_template?: string;
  urgency_priority?: number;
  sort_order?: number;
}

export interface AgentKnowledgeInput {
  title: string;
  content_type?: 'pdf' | 'url' | 'note' | 'template' | 'past_analysis';
  content?: string;
  summary?: string;
  tags?: string[];
  source?: 'manual' | 'auto_import' | 'past_tender';
}

// =============================================
// API FUNCTIONS
// =============================================

export const agentAPI = {
  // ─── Agent CRUD ───────────────────────────

  /**
   * Tüm aktif agent'ları listele
   */
  async getAll(): Promise<ApiResponse<{ agents: Agent[]; count: number }>> {
    const response = await api.get('/api/agents');
    return response.data;
  },

  /**
   * Tek agent detayı (tools, knowledge stats, contexts dahil)
   */
  async getBySlug(slug: string): Promise<ApiResponse<{ agent: AgentDetail }>> {
    const response = await api.get(`/api/agents/${slug}`);
    return response.data;
  },

  /**
   * Belirli bir bağlamdaki agent'ları getir
   * (örn: ihale_masasi için 4 agent + tool'ları)
   */
  async getByContext(
    contextKey: string
  ): Promise<ApiResponse<{ agents: Agent[]; tools: AgentTool[]; context: string }>> {
    const response = await api.get(`/api/agents/context/${contextKey}`);
    return response.data;
  },

  /**
   * Agent güncelle (Admin)
   */
  async update(slug: string, data: AgentUpdateInput): Promise<ApiResponse<{ agent: Agent }>> {
    const response = await api.put(`/api/agents/${slug}`, data);
    return response.data;
  },

  // ─── Tool CRUD ────────────────────────────

  /**
   * Agent'ın tool'larını getir
   */
  async getTools(slug: string): Promise<ApiResponse<{ tools: AgentTool[] }>> {
    const response = await api.get(`/api/agents/${slug}/tools`);
    return response.data;
  },

  /**
   * Tool ekle (Admin)
   */
  async addTool(slug: string, tool: AgentToolInput): Promise<ApiResponse<{ tool: AgentTool }>> {
    const response = await api.post(`/api/agents/${slug}/tools`, tool);
    return response.data;
  },

  /**
   * Tool güncelle (Admin)
   */
  async updateTool(
    slug: string,
    toolSlug: string,
    data: Partial<AgentToolInput> & { is_active?: boolean }
  ): Promise<ApiResponse<{ tool: AgentTool }>> {
    const response = await api.put(`/api/agents/${slug}/tools/${toolSlug}`, data);
    return response.data;
  },

  /**
   * Tool sil (Admin)
   */
  async deleteTool(slug: string, toolSlug: string): Promise<ApiResponse<{ message: string }>> {
    const response = await api.delete(`/api/agents/${slug}/tools/${toolSlug}`);
    return response.data;
  },

  // ─── Knowledge Base CRUD ──────────────────

  /**
   * Agent kütüphanesini getir
   */
  async getKnowledge(
    slug: string,
    options?: { content_type?: string; limit?: number }
  ): Promise<ApiResponse<{ knowledge: AgentKnowledge[]; count: number }>> {
    const params = new URLSearchParams();
    if (options?.content_type) params.append('content_type', options.content_type);
    if (options?.limit) params.append('limit', options.limit.toString());

    const url = `/api/agents/${slug}/knowledge${params.toString() ? `?${params}` : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  /**
   * Kütüphaneye kaynak ekle (dosya upload destekli)
   */
  async addKnowledge(
    slug: string,
    data: AgentKnowledgeInput | FormData
  ): Promise<ApiResponse<{ knowledge: AgentKnowledge }>> {
    const isFormData = data instanceof FormData;
    const response = await api.post(`/api/agents/${slug}/knowledge`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data;
  },

  /**
   * Kütüphane kaynağını güncelle
   */
  async updateKnowledge(
    slug: string,
    id: number,
    data: Partial<AgentKnowledgeInput> & { is_active?: boolean }
  ): Promise<ApiResponse<{ knowledge: AgentKnowledge }>> {
    const response = await api.put(`/api/agents/${slug}/knowledge/${id}`, data);
    return response.data;
  },

  /**
   * Kütüphane kaynağını sil
   */
  async deleteKnowledge(slug: string, id: number): Promise<ApiResponse<{ message: string }>> {
    const response = await api.delete(`/api/agents/${slug}/knowledge/${id}`);
    return response.data;
  },
};

export default agentAPI;
