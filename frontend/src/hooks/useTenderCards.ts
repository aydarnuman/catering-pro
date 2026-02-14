'use client';

import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getApiUrl } from '@/lib/config';

// ─── Types ─────────────────────────────────────────────────────

export type CardType = 'text' | 'table' | 'list' | 'number';
export type SourceType = 'manual' | 'ai' | 'pdf_selection';
export type CardCategory = 'operasyonel' | 'mali' | 'teknik' | 'belgeler' | 'diger';

export interface TenderCard {
  id: number;
  tender_id: number;
  card_type: CardType;
  title: string;
  content: Record<string, unknown>;
  source_type: SourceType;
  source_document_id: number | null;
  source_page: number | null;
  source_text: string | null;
  category: CardCategory;
  sort_order: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  document_name?: string;
}

export interface CreateCardInput {
  card_type?: CardType;
  title: string;
  content?: Record<string, unknown>;
  source_type?: SourceType;
  source_document_id?: number;
  source_page?: number;
  source_text?: string;
  category?: CardCategory;
}

export interface UpdateCardInput {
  card_type?: CardType;
  title?: string;
  content?: Record<string, unknown>;
  category?: CardCategory;
}

// ─── Hook ──────────────────────────────────────────────────────

export function useTenderCards(tenderId: number | null) {
  const queryClient = useQueryClient();
  const queryKey = ['tender-cards', tenderId];

  // Fetch cards
  const { data, isLoading, isError, error, refetch } = useQuery<TenderCard[]>({
    queryKey,
    queryFn: async () => {
      if (!tenderId) throw new Error('tenderId gerekli');
      const res = await api.get(getApiUrl(`/api/tender-cards/${tenderId}`));
      return res.data?.data || [];
    },
    enabled: !!tenderId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Create card
  const createMutation = useMutation({
    mutationFn: async (input: CreateCardInput) => {
      if (!tenderId) throw new Error('tenderId gerekli');
      const res = await api.post(getApiUrl(`/api/tender-cards/${tenderId}`), input);
      return res.data?.data as TenderCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      notifications.show({
        title: 'Kart eklendi',
        message: 'Yeni kart başarıyla oluşturuldu',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Kart eklenemedi',
        color: 'red',
      });
    },
  });

  // Update card
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: UpdateCardInput & { id: number }) => {
      const res = await api.put(getApiUrl(`/api/tender-cards/${id}`), input);
      return res.data?.data as TenderCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Kart güncellenemedi',
        color: 'red',
      });
    },
  });

  // Delete card
  const deleteMutation = useMutation({
    mutationFn: async (cardId: number) => {
      await api.delete(getApiUrl(`/api/tender-cards/${cardId}`));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      notifications.show({
        title: 'Kart silindi',
        message: 'Kart başarıyla silindi',
        color: 'blue',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Kart silinemedi',
        color: 'red',
      });
    },
  });

  // Reorder card
  const reorderMutation = useMutation({
    mutationFn: async ({ id, sort_order }: { id: number; sort_order: number }) => {
      const res = await api.put(getApiUrl(`/api/tender-cards/${id}/reorder`), { sort_order });
      return res.data?.data as TenderCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    cards: data || [],
    isLoading,
    isError,
    error,
    refetch,
    createCard: createMutation.mutateAsync,
    updateCard: updateMutation.mutateAsync,
    deleteCard: deleteMutation.mutateAsync,
    reorderCard: reorderMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
