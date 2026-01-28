/**
 * Prompt Builder Hook
 * State management ve API calls
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type {
  PBAnswers,
  PBCategory,
  PBQuestion,
  PBSavedPrompt,
  PBTemplate,
  PBUserStats,
} from '@/components/PromptBuilder/types';
import { API_BASE_URL } from '@/lib/config';

const API_URL = `${API_BASE_URL}/api/prompt-builder`;

// Fetch helpers
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Bir hata oluştu');
  }
  return data;
}

/**
 * Kategorileri getir
 */
export function useCategories() {
  return useQuery({
    queryKey: ['pb-categories'],
    queryFn: async () => {
      const data = await fetchJson<{ success: boolean; data: PBCategory[] }>(
        `${API_URL}/categories`
      );
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 dakika cache
  });
}

/**
 * Kategori detayı (sorular + şablonlar)
 */
export function useCategoryDetail(slug: string | null) {
  return useQuery({
    queryKey: ['pb-category', slug],
    queryFn: async () => {
      if (!slug) return null;
      const data = await fetchJson<{
        success: boolean;
        data: {
          category: PBCategory;
          questions: PBQuestion[];
          templates: PBTemplate[];
        };
      }>(`${API_URL}/categories/${slug}`);
      return data.data;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Prompt oluştur
 */
export function useGeneratePrompt() {
  return useMutation({
    mutationFn: async ({ templateId, answers }: { templateId: number; answers: PBAnswers }) => {
      const data = await fetchJson<{
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
      }>(`${API_URL}/generate`, {
        method: 'POST',
        body: JSON.stringify({ templateId, answers }),
      });
      return data.data;
    },
  });
}

/**
 * Prompt kaydet
 */
export function useSavePrompt() {
  // Cookie-only authentication - token gerekmiyor
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      categoryId: number;
      templateId: number;
      name: string;
      description?: string;
      generatedPrompt: string;
      answers: PBAnswers;
      style?: string;
    }) => {
      const result = await fetchJson<{ success: boolean; data: PBSavedPrompt }>(`${API_URL}/save`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pb-saved-prompts'] });
    },
  });
}

/**
 * Kayıtlı prompt'ları getir
 */
export function useSavedPrompts(options?: { categoryId?: number; favoriteOnly?: boolean }) {
  // Cookie-only authentication - token gerekmiyor

  return useQuery({
    queryKey: ['pb-saved-prompts', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.categoryId) params.append('categoryId', String(options.categoryId));
      if (options?.favoriteOnly) params.append('favoriteOnly', 'true');

      const data = await fetchJson<{ success: boolean; data: PBSavedPrompt[] }>(
        `${API_URL}/saved?${params}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return data.data;
    },
    enabled: true,
    staleTime: 30 * 1000, // 30 saniye
  });
}

/**
 * Kayıtlı prompt güncelle
 */
export function useUpdateSavedPrompt() {
  // Cookie-only authentication - token gerekmiyor
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: number;
      name?: string;
      description?: string;
      isFavorite?: boolean;
      isPublic?: boolean;
    }) => {
      const result = await fetchJson<{ success: boolean; data: PBSavedPrompt }>(
        `${API_URL}/saved/${id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pb-saved-prompts'] });
    },
  });
}

/**
 * Kayıtlı prompt sil
 */
export function useDeleteSavedPrompt() {
  // Cookie-only authentication - token gerekmiyor
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await fetchJson<{ success: boolean }>(`${API_URL}/saved/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pb-saved-prompts'] });
    },
  });
}

/**
 * Galeri (public prompt'lar)
 */
export function useGallery(options?: { categoryId?: number; sortBy?: string }) {
  return useQuery({
    queryKey: ['pb-gallery', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.categoryId) params.append('categoryId', String(options.categoryId));
      if (options?.sortBy) params.append('sortBy', options.sortBy);

      const data = await fetchJson<{ success: boolean; data: PBSavedPrompt[] }>(
        `${API_URL}/gallery?${params}`
      );
      return data.data;
    },
    staleTime: 60 * 1000, // 1 dakika
  });
}

/**
 * Kullanıcı istatistikleri
 */
export function useUserStats() {
  // Cookie-only authentication - token gerekmiyor

  return useQuery({
    queryKey: ['pb-user-stats'],
    queryFn: async () => {
      const data = await fetchJson<{ success: boolean; data: PBUserStats }>(`${API_URL}/my-stats`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data.data;
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
}

/**
 * Kullanım istatistiği kaydet
 */
export function useLogUsage() {
  // Cookie-only authentication - token gerekmiyor

  return useMutation({
    mutationFn: async (data: {
      savedPromptId?: number;
      categoryId?: number;
      templateId?: number;
      action: string;
      metadata?: Record<string, unknown>;
    }) => {
      await fetchJson<{ success: boolean }>(`${API_URL}/stats`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    },
  });
}

/**
 * Main Wizard Hook
 */
export function usePromptBuilderWizard() {
  const [step, setStep] = useState(0);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<PBAnswers>({});
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');

  // Queries
  const categoriesQuery = useCategories();
  const categoryDetailQuery = useCategoryDetail(selectedCategorySlug);

  // Mutations
  const generateMutation = useGeneratePrompt();
  const saveMutation = useSavePrompt();
  const logUsage = useLogUsage();

  // Derived state
  const selectedCategory = categoryDetailQuery.data?.category || null;
  const questions = categoryDetailQuery.data?.questions || [];
  const templates = categoryDetailQuery.data?.templates || [];
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  // Actions
  const selectCategory = useCallback((slug: string) => {
    setSelectedCategorySlug(slug);
    setStep(1);
    setSelectedTemplateId(null);
    setAnswers({});
    setGeneratedPrompt('');
  }, []);

  const selectTemplate = useCallback((id: number) => {
    setSelectedTemplateId(id);
  }, []);

  const updateAnswer = useCallback((variableName: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [variableName]: value }));
  }, []);

  const nextStep = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const prevStep = useCallback(() => {
    setStep((prev) => Math.max(0, prev - 1));
  }, []);

  const generate = useCallback(async () => {
    if (!selectedTemplateId) return;

    const result = await generateMutation.mutateAsync({
      templateId: selectedTemplateId,
      answers,
    });

    setGeneratedPrompt(result.prompt);
    setStep(3); // Sonuç adımına geç

    // Kullanım kaydı
    logUsage.mutate({
      templateId: selectedTemplateId,
      categoryId: selectedCategory?.id,
      action: 'generate',
    });

    return result;
  }, [selectedTemplateId, answers, generateMutation, logUsage, selectedCategory]);

  const save = useCallback(
    async (name: string, description?: string) => {
      if (!selectedCategory || !selectedTemplateId) return;

      const result = await saveMutation.mutateAsync({
        categoryId: selectedCategory.id,
        templateId: selectedTemplateId,
        name,
        description,
        generatedPrompt,
        answers,
        style: selectedTemplate?.style,
      });

      return result;
    },
    [selectedCategory, selectedTemplateId, generatedPrompt, answers, selectedTemplate, saveMutation]
  );

  const reset = useCallback(() => {
    setStep(0);
    setSelectedCategorySlug(null);
    setSelectedTemplateId(null);
    setAnswers({});
    setGeneratedPrompt('');
  }, []);

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    logUsage.mutate({
      templateId: selectedTemplateId || undefined,
      categoryId: selectedCategory?.id,
      action: 'copy',
    });
  }, [generatedPrompt, selectedTemplateId, selectedCategory, logUsage]);

  return {
    // State
    step,
    selectedCategory,
    selectedCategorySlug,
    selectedTemplate,
    selectedTemplateId,
    questions,
    templates,
    answers,
    generatedPrompt,

    // Loading states
    isLoadingCategories: categoriesQuery.isLoading,
    isLoadingCategory: categoryDetailQuery.isLoading,
    isGenerating: generateMutation.isPending,
    isSaving: saveMutation.isPending,

    // Data
    categories: categoriesQuery.data || [],

    // Actions
    selectCategory,
    selectTemplate,
    updateAnswer,
    nextStep,
    prevStep,
    generate,
    save,
    reset,
    copyToClipboard,

    // Errors
    error:
      categoriesQuery.error ||
      categoryDetailQuery.error ||
      generateMutation.error ||
      saveMutation.error,
  };
}
