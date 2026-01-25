/**
 * Prompt Builder Types
 */

export interface PBCategory {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  question_count?: number;
  template_count?: number;
  created_at: string;
}

export interface PBQuestion {
  id: number;
  category_id: number;
  question_text: string;
  question_type: 'text' | 'select' | 'multiselect' | 'textarea' | 'number';
  options: { value: string; label: string }[] | null;
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
  variable_name: string;
  help_text: string | null;
  default_value: string | null;
}

export interface PBTemplate {
  id: number;
  category_id: number;
  name: string;
  template_text: string;
  style: 'professional' | 'friendly' | 'technical' | 'creative';
  model_hint: string | null;
  example_output: string | null;
  is_active: boolean;
  is_default: boolean;
  usage_count: number;
  category_slug?: string;
  category_name?: string;
}

export interface PBSavedPrompt {
  id: number;
  user_id: number;
  category_id: number;
  template_id: number | null;
  name: string;
  description: string | null;
  generated_prompt: string;
  answers: Record<string, string>;
  style: string | null;
  is_favorite: boolean;
  is_public: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  category_name?: string;
  category_slug?: string;
  category_icon?: string;
  category_color?: string;
  template_name?: string;
  author_name?: string;
}

export interface PBAnswers {
  [variableName: string]: string;
}

export interface PBUserStats {
  total_prompts: number;
  favorite_count: number;
  shared_count: number;
  total_usage: number;
}

// Wizard State
export interface PromptBuilderState {
  step: number;
  selectedCategory: PBCategory | null;
  questions: PBQuestion[];
  templates: PBTemplate[];
  selectedTemplate: PBTemplate | null;
  answers: PBAnswers;
  generatedPrompt: string;
  selectedStyle: string;
}

// API Response Types
export interface CategoriesResponse {
  success: boolean;
  data: PBCategory[];
}

export interface CategoryDetailResponse {
  success: boolean;
  data: {
    category: PBCategory;
    questions: PBQuestion[];
    templates: PBTemplate[];
  };
}

export interface GenerateResponse {
  success: boolean;
  data: {
    prompt: string;
    template: {
      id: number;
      name: string;
      style: string;
      categorySlug: string;
      categoryName: string;
    };
  };
}

export interface SavedPromptsResponse {
  success: boolean;
  data: PBSavedPrompt[];
}
