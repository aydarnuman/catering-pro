/**
 * useUyumsoftFaturalar - Uyumsoft Fatura State Hook'u
 *
 * Uyumsoft faturaları listesi, filtreleme, sync ve toplam.
 * - Liste (API'den)
 * - Filtreleme (tab + arama)
 * - Senkronizasyon
 * - Toplam (odenecekTutar)
 */

import { notifications } from '@mantine/notifications';
import { useCallback, useMemo, useState } from 'react';
import { uyumsoftAPI } from '@/lib/invoice-api';
import type { UyumsoftFatura } from '../types';
import type { FaturaTab } from './useFaturalar';

export interface UseUyumsoftFaturalarOptions {
  limit?: number;
}

export interface UseUyumsoftFaturalarReturn {
  uyumsoftFaturalar: UyumsoftFatura[];
  setUyumsoftFaturalar: React.Dispatch<React.SetStateAction<UyumsoftFatura[]>>;
  filteredUyumsoftFaturalar: UyumsoftFatura[];

  loadUyumsoftInvoices: () => Promise<void>;
  isLoading: boolean;
  loadError: string | null;

  uyumsoftToplam: number;

  sync: (onAfterSync?: () => void | Promise<void>) => Promise<void>;
  isSyncing: boolean;
}

export function useUyumsoftFaturalar(
  activeTab: FaturaTab,
  searchTerm: string,
  options: UseUyumsoftFaturalarOptions = {}
): UseUyumsoftFaturalarReturn {
  const { limit = 250 } = options;

  const [uyumsoftFaturalar, setUyumsoftFaturalar] = useState<UyumsoftFatura[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadUyumsoftInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await uyumsoftAPI.getInvoices({ limit });
      if (result?.success && result.data) {
        setUyumsoftFaturalar(Array.isArray(result.data) ? result.data : []);
      } else {
        setUyumsoftFaturalar([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Uyumsoft faturaları yüklenemedi';
      setLoadError(msg);
      setUyumsoftFaturalar([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const filteredUyumsoftFaturalar = useMemo(() => {
    return uyumsoftFaturalar.filter((f) => {
      const matchesTab =
        activeTab === 'tumu' || activeTab === 'uyumsoft' || (activeTab === 'alis' && f.faturaTipi === 'gelen');
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q || f.gonderenUnvan.toLowerCase().includes(q) || (f.faturaNo || '').toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [uyumsoftFaturalar, activeTab, searchTerm]);

  const uyumsoftToplam = useMemo(
    () => uyumsoftFaturalar.reduce((acc, f) => acc + f.odenecekTutar, 0),
    [uyumsoftFaturalar]
  );

  const sync = useCallback(
    async (onAfterSync?: () => void) => {
      setIsSyncing(true);
      try {
        const data = await uyumsoftAPI.sync(3, 1000);
        if (data?.success && data.data) {
          setUyumsoftFaturalar(Array.isArray(data.data) ? data.data : []);
          const dbMsg = data.savedToDb ? ` (${data.savedToDb} tanesi veritabanına kaydedildi)` : '';
          notifications.show({
            title: 'Senkronizasyon Tamamlandı!',
            message: `${data.total ?? 0} fatura başarıyla çekildi${dbMsg}`,
            color: 'green',
          });
          await loadUyumsoftInvoices();
          await onAfterSync?.();
        } else {
          const syncData = data as { error?: string };
          notifications.show({
            title: 'Senkronizasyon Hatası',
            message: syncData?.error || 'Faturalar çekilemedi',
            color: 'red',
          });
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error && (err.name === 'AbortError' || /abort|timeout/i.test(err.message))
            ? 'Uyumsoft servisi zaman aşımına uğradı. İnternet bağlantınızı ve Uyumsoft erişimini kontrol edin.'
            : err instanceof Error
              ? err.message
              : 'Senkronizasyon başarısız';
        notifications.show({
          title: 'Hata!',
          message: msg,
          color: 'red',
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [loadUyumsoftInvoices]
  );

  return {
    uyumsoftFaturalar,
    setUyumsoftFaturalar,
    filteredUyumsoftFaturalar,
    loadUyumsoftInvoices,
    isLoading,
    loadError,
    uyumsoftToplam,
    sync,
    isSyncing,
  };
}
