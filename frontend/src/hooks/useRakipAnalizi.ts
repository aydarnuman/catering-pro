/**
 * useRakipAnalizi - İhale için potansiyel rakip analizi hook'u
 * Hibrit sistem: iç veritabanı + Tavily web araması
 */

import { useQuery } from '@tanstack/react-query';
import { type RakipAnaliziResponse, tendersAPI } from '@/lib/api/services/tenders';

export function useRakipAnalizi(tenderId: number | null) {
  const query = useQuery<RakipAnaliziResponse>({
    queryKey: ['rakip-analizi', tenderId],
    queryFn: async () => {
      if (!tenderId) throw new Error('tenderId gerekli');
      const res = await tendersAPI.getRakipAnalizi(tenderId);
      return res as unknown as RakipAnaliziResponse;
    },
    enabled: !!tenderId,
    staleTime: 30 * 60 * 1000, // 30 dakika stale
    gcTime: 60 * 60 * 1000, // 1 saat cache
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    toplamRakip: query.data?.toplam_rakip ?? 0,
  };
}
