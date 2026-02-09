'use client';

/**
 * İhale Merkezi — React Query Hooks
 * Tüm data fetching, cache yönetimi ve mutation'lar
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnalysisData,
  SavedTender,
  TenderStatus,
  UpdateStats,
  UserNote,
} from '@/components/ihale-merkezi/types';
import { firmalarAPI } from '@/lib/api/services/firmalar';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { TendersResponse } from '@/types/api';

// ─── Raw Tracking Data Type ────────────────────────────────────

interface RawTrackingData {
  id: number | string;
  tender_id: number;
  ihale_basligi?: string;
  kurum?: string;
  tarih?: string;
  bedel?: number | string;
  city?: string;
  external_id?: string;
  url?: string;
  status?: string;
  notes?: string;
  user_notes?: UserNote[];
  created_at?: string;
  dokuman_sayisi?: number;
  analiz_edilen_dokuman?: number;
  analysis_summary?: AnalysisData;
  yaklasik_maliyet?: number | string;
  sinir_deger?: number | string;
  bizim_teklif?: number | string;
}

// ─── Format Helper ─────────────────────────────────────────────

function formatTrackedTender(t: RawTrackingData): SavedTender {
  return {
    id: String(t.id),
    tender_id: Number(t.tender_id),
    ihale_basligi: String(t.ihale_basligi || ''),
    kurum: String(t.kurum || ''),
    tarih: t.tarih || '',
    bedel: t.bedel ? `${Number(t.bedel).toLocaleString('tr-TR')} ₺` : '',
    city: t.city,
    external_id: t.external_id,
    url: t.url,
    status: (t.status || 'bekliyor') as TenderStatus,
    notes: String(t.notes || ''),
    user_notes: t.user_notes || [],
    created_at: String(t.created_at || ''),
    dokuman_sayisi: Number(t.dokuman_sayisi || 0),
    analiz_edilen_dokuman: Number(t.analiz_edilen_dokuman || 0),
    teknik_sart_sayisi: t.analysis_summary?.teknik_sartlar?.length || 0,
    birim_fiyat_sayisi: t.analysis_summary?.birim_fiyatlar?.length || 0,
    analysis_summary: t.analysis_summary as AnalysisData | undefined,
    yaklasik_maliyet: t.yaklasik_maliyet ? parseFloat(String(t.yaklasik_maliyet)) : undefined,
    sinir_deger: t.sinir_deger ? parseFloat(String(t.sinir_deger)) : undefined,
    bizim_teklif: t.bizim_teklif ? parseFloat(String(t.bizim_teklif)) : undefined,
  };
}

// ─── Query Keys ────────────────────────────────────────────────

export const tenderKeys = {
  all: ['tenders'] as const,
  lists: () => [...tenderKeys.all, 'list'] as const,
  list: (params: Record<string, string | number | undefined>) =>
    [...tenderKeys.lists(), params] as const,
  tracked: () => [...tenderKeys.all, 'tracked'] as const,
  stats: () => [...tenderKeys.all, 'stats'] as const,
  firmalar: () => ['firmalar'] as const,
};

// ─── All Tenders (Liste) ───────────────────────────────────────

interface UseAllTendersParams {
  page: number;
  limit?: number;
  search?: string;
  status?: string;
  city?: string;
}

export function useAllTenders(params: UseAllTendersParams) {
  return useQuery({
    queryKey: tenderKeys.list({
      page: params.page,
      limit: params.limit || 20,
      search: params.search,
      status: params.status || 'active',
      city: params.city,
    }),
    queryFn: () =>
      tendersAPI.getTenders({
        page: params.page,
        limit: params.limit || 20,
        search: params.search || undefined,
        status: params.status || 'active',
        city: params.city || undefined,
      }),
    staleTime: 30_000,
    placeholderData: (previousData: TendersResponse | undefined) => previousData,
  });
}

// ─── Tracked Tenders (Takip Listesi) ───────────────────────────

export function useTrackedTenders() {
  return useQuery({
    queryKey: tenderKeys.tracked(),
    queryFn: async (): Promise<SavedTender[]> => {
      const result = await tendersAPI.getTrackingList();
      if (result.success && result.data) {
        return result.data.map((t: RawTrackingData) => formatTrackedTender(t));
      }
      return [];
    },
    staleTime: 30_000,
  });
}

// ─── Tender Stats ──────────────────────────────────────────────

export function useTenderStats() {
  return useQuery({
    queryKey: tenderKeys.stats(),
    queryFn: async (): Promise<UpdateStats | null> => {
      const result = await tendersAPI.getTenderStats();
      if (result.success) {
        return result.data as UpdateStats;
      }
      return null;
    },
    staleTime: 60_000,
  });
}

// ─── Firmalar ──────────────────────────────────────────────────

export function useFirmalar() {
  return useQuery({
    queryKey: tenderKeys.firmalar(),
    queryFn: async () => {
      const result = await firmalarAPI.getFirmalar();
      if (result.success && result.data) {
        return result.data;
      }
      return [];
    },
    staleTime: 120_000, // Firmalar nadiren değişir
  });
}

// ─── Mutation: Toggle Tracking ─────────────────────────────────

interface ToggleTrackingParams {
  tenderId: number;
  isCurrentlyTracked: boolean;
  trackedId?: string; // tracked.id for removal
}

export function useToggleTracking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenderId, isCurrentlyTracked, trackedId }: ToggleTrackingParams) => {
      if (isCurrentlyTracked && trackedId) {
        await tendersAPI.removeTracking(Number(trackedId));
      } else {
        await tendersAPI.addTracking(tenderId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.tracked() });
      queryClient.invalidateQueries({ queryKey: tenderKeys.stats() });
    },
  });
}

// ─── Mutation: Update Tender Status ────────────────────────────

interface UpdateStatusParams {
  tenderId: string;
  newStatus: string;
}

export function useUpdateTenderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenderId, newStatus }: UpdateStatusParams) => {
      await tendersAPI.updateTracking(Number(tenderId), { status: newStatus });
      return { tenderId, newStatus };
    },
    onSuccess: ({ tenderId, newStatus }) => {
      // Optimistic: update tracked tenders cache directly
      queryClient.setQueryData<SavedTender[]>(tenderKeys.tracked(), (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === tenderId ? { ...t, status: newStatus as TenderStatus } : t
        );
      });
    },
  });
}

// ─── Helper: Invalidate All Tender Queries ─────────────────────

export function useInvalidateTenderQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.all });
      queryClient.invalidateQueries({ queryKey: tenderKeys.firmalar() });
    },
    invalidateTenders: () => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.lists() });
    },
    invalidateTracked: () => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.tracked() });
    },
    invalidateStats: () => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.stats() });
    },
    /** Refetch tracked tenders and return the fresh list */
    refetchTracked: async (): Promise<SavedTender[]> => {
      await queryClient.refetchQueries({ queryKey: tenderKeys.tracked() });
      return queryClient.getQueryData<SavedTender[]>(tenderKeys.tracked()) || [];
    },
  };
}
