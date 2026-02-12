/**
 * AI Ayarları Sayfası - Shared Types
 */

export interface PromptTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  icon: string;
  color: string;
  is_active: boolean;
  is_default: boolean;
  is_system: boolean;
  usage_count: number;
  preferred_model?: string;
  created_at: string;
  updated_at: string;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  icon: string;
  speed: 'fast' | 'slow';
  intelligence: 'high' | 'highest';
}

export interface AISettings {
  default_model: string;
  available_models: AIModel[];
  auto_learn_enabled: boolean;
  auto_learn_threshold: number;
  max_memory_items: number;
  memory_retention_days: number;
  daily_snapshot_enabled: boolean;
  snapshot_time: string;
}

export interface FeedbackStats {
  total: number;
  positive: number;
  negative: number;
  avg_rating: number;
  avg_response_time: number;
}

export interface MemoryItem {
  id: number;
  memory_type: string;
  category: string;
  key: string;
  value: string;
  importance: number;
  usage_count: number;
}

export interface VersionHistoryItem {
  id: number;
  setting_key: string;
  setting_value: unknown;
  version: number;
  user_name?: string;
  user_email?: string;
  change_note?: string;
  created_at: string;
}

export interface ImportPreviewData {
  settings?: Record<string, unknown>;
  metadata?: {
    exported_at: string;
    version: string;
    count: number;
  };
}

export interface TemplateFormData {
  name: string;
  description: string;
  prompt: string;
  category: string;
  icon: string;
  color: string;
  is_active: boolean;
  preferred_model: string;
}

export interface EditableSettings {
  auto_learn_enabled: boolean;
  daily_snapshot_enabled: boolean;
  max_memory_items: number;
  memory_retention_days: number;
  auto_learn_threshold: number;
  snapshot_time: string;
}
