'use client';

/**
 * Yüklenici Kütüphanesi — React Query Hooks
 * Tüm API çağrıları ve cache yönetimi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/config';
import type { Yuklenici, StatsData, ScrapeStatus, YukleniciDetay, SortField } from '@/types/yuklenici';

// ─── Fetch Helper ───────────────────────────────────────────────

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ─── Query Keys ─────────────────────────────────────────────────

export const yukleniciKeys = {
  all: ['yukleniciler'] as const,
  lists: () => [...yukleniciKeys.all, 'list'] as const,
  list: (params: Record<string, string>) => [...yukleniciKeys.lists(), params] as const,
  stats: () => [...yukleniciKeys.all, 'stats'] as const,
  details: () => [...yukleniciKeys.all, 'detail'] as const,
  detail: (id: number) => [...yukleniciKeys.details(), id] as const,
  scrapeStatus: () => [...yukleniciKeys.all, 'scrape-status'] as const,
};

// ─── Liste Hook ─────────────────────────────────────────────────

interface UseYukleniciListParams {
  page: number;
  limit?: number;
  sort: SortField;
  order: 'asc' | 'desc';
  search?: string;
  takipte?: boolean;
}

interface YukleniciListResponse {
  success: boolean;
  data: Yuklenici[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export function useYukleniciList(params: UseYukleniciListParams) {
  const queryParams: Record<string, string> = {
    page: String(params.page),
    limit: String(params.limit || 20),
    sort: params.sort,
    order: params.order,
  };
  if (params.search) queryParams.search = params.search;
  if (params.takipte) queryParams.takipte = 'true';

  return useQuery({
    queryKey: yukleniciKeys.list(queryParams),
    queryFn: () =>
      apiFetch<YukleniciListResponse>(`/contractors?${new URLSearchParams(queryParams)}`),
    staleTime: 30_000, // 30 saniye fresh kalır
    placeholderData: (previousData) => previousData, // Sayfa değişirken eski veriyi göster
  });
}

// ─── İstatistik Hook ────────────────────────────────────────────

interface StatsResponse {
  success: boolean;
  data: StatsData;
}

export function useYukleniciStats() {
  return useQuery({
    queryKey: yukleniciKeys.stats(),
    queryFn: () => apiFetch<StatsResponse>('/contractors/stats'),
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── Detay Hook ─────────────────────────────────────────────────

interface DetailResponse {
  success: boolean;
  data: YukleniciDetay;
}

export function useYukleniciDetay(id: number | null) {
  return useQuery({
    queryKey: yukleniciKeys.detail(id ?? 0),
    queryFn: () => apiFetch<DetailResponse>(`/contractors/${id}`),
    enabled: id !== null && id > 0,
    staleTime: 30_000,
  });
}

// ─── Scrape Status Hook ────────────────────────────────────────

export function useScrapeStatus(enabled: boolean) {
  return useQuery({
    queryKey: yukleniciKeys.scrapeStatus(),
    queryFn: () => apiFetch<ScrapeStatus>('/contractors/scrape/status'),
    enabled,
    refetchInterval: enabled ? 2000 : false,
  });
}

// ─── Mutation: Takip Toggle ─────────────────────────────────────

export function useTakipToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ success: boolean; data: Yuklenici }>(`/contractors/${id}/toggle-follow`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: yukleniciKeys.all });
    },
  });
}

// ─── Mutation: İstihbarat Toggle ────────────────────────────────

export function useIstihbaratToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ success: boolean; data: Yuklenici; scrapeStarted: boolean }>(
        `/contractors/${id}/toggle-istihbarat`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: yukleniciKeys.all });
    },
  });
}

// ─── Mutation: Scrape Başlat ────────────────────────────────────

export function useStartScrape() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (maxPages: number = 20) =>
      apiFetch<{ success: boolean; message: string }>('/contractors/scrape', {
        method: 'POST',
        body: JSON.stringify({ maxPages }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: yukleniciKeys.scrapeStatus() });
    },
  });
}

// ─── Mutation: Notları Kaydet ───────────────────────────────────

export function useSaveNotlar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notlar }: { id: number; notlar: string }) =>
      apiFetch<{ success: boolean; data: Yuklenici }>(`/contractors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notlar }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: yukleniciKeys.detail(variables.id) });
    },
  });
}

// ─── Mutation: İhale Geçmişi Scrape ────────────────────────────

export function useScrapeHistory() {
  return useMutation({
    mutationFn: ({ id, maxPages = 10 }: { id: number; maxPages?: number }) =>
      apiFetch<{ success: boolean; message: string }>(`/contractors/${id}/scrape-history`, {
        method: 'POST',
        body: JSON.stringify({ maxPages }),
      }),
  });
}

// ─── Mutation: Analiz Scrape ────────────────────────────────────

export function useScrapeAnalyze() {
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ success: boolean; message: string }>(`/contractors/${id}/scrape-analyze`, {
        method: 'POST',
      }),
  });
}
