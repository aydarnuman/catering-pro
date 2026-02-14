'use client';

import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getApiUrl } from '@/lib/config';

// ─── Types ─────────────────────────────────────────────────────

export interface MasaVeriPaketi {
  id: number;
  tender_id: number;
  tender_title: string | null;
  kurum: string | null;
  tarih: string | null;
  bedel: string | null;
  sure: string | null;
  analysis_cards: Record<string, unknown>;
  user_cards: unknown[];
  notes: unknown[];
  correction_count: number;
  is_confirmed: boolean;
  agent_analyses: Record<string, unknown> | null;
  verdict_data: Record<string, unknown> | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  version: number;
  is_active: boolean;
}

export interface CreateMasaPaketiInput {
  tender_title?: string;
  kurum?: string;
  tarih?: string;
  bedel?: string;
  sure?: string;
  analysis_cards?: Record<string, unknown>;
  user_cards?: unknown[];
  notes?: unknown[];
  correction_count?: number;
  is_confirmed?: boolean;
}

export interface UpdateMasaPaketiInput {
  agent_analyses?: Record<string, unknown>;
  verdict_data?: Record<string, unknown>;
}

// ─── Query Keys ────────────────────────────────────────────────

const masaPaketiKeys = {
  all: ['masa-paketleri'] as const,
  detail: (tenderId: number) => ['masa-paketleri', tenderId] as const,
  versions: (tenderId: number) => ['masa-paketleri', tenderId, 'versions'] as const,
};

// ─── Hook: Aktif paketi oku ────────────────────────────────────

export function useMasaVeriPaketi(tenderId: number | null) {
  return useQuery<MasaVeriPaketi>({
    queryKey: masaPaketiKeys.detail(tenderId ?? 0),
    queryFn: async () => {
      const { data } = await api.get(getApiUrl(`/api/masa-paketleri/${tenderId}`));
      return data.data;
    },
    enabled: !!tenderId,
    staleTime: 30_000,
    retry: false,
  });
}

// ─── Hook: Paket oluştur (masaya gönder) ──────────────────────

export function useCreateMasaPaketi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenderId, ...input }: CreateMasaPaketiInput & { tenderId: number }) => {
      const { data } = await api.post(getApiUrl(`/api/masa-paketleri/${tenderId}`), input);
      return data.data as MasaVeriPaketi;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: masaPaketiKeys.detail(data.tender_id) });
      notifications.show({
        title: 'Veri Paketi Gönderildi',
        message: `Versiyon ${data.version} masaya gönderildi`,
        color: 'violet',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Veri paketi gönderilemedi',
        color: 'red',
      });
    },
  });
}

// ─── Hook: Paket güncelle (ajan sonuçları geri yaz) ───────────

export function useUpdateMasaPaketi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenderId, ...input }: UpdateMasaPaketiInput & { tenderId: number }) => {
      const { data } = await api.patch(getApiUrl(`/api/masa-paketleri/${tenderId}`), input);
      return data.data as MasaVeriPaketi;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: masaPaketiKeys.detail(data.tender_id) });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Veri paketi güncellenemedi',
        color: 'red',
      });
    },
  });
}
