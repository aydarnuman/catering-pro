/**
 * useFaturalar - Manuel Fatura State Hook'u
 *
 * Manuel faturalar listesi, cariler, filtreleme ve CRUD işlemleri.
 * - Faturalar listesi (API'den)
 * - Cariler listesi (cari seçimi için)
 * - Filtreleme (tab + arama)
 * - Toplamlar (satış, alış, bekleyen)
 * - updateDurum, delete + refetch
 */

import { notifications } from '@mantine/notifications';
import { useCallback, useMemo, useState } from 'react';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import { convertToFrontendFormat, invoiceAPI } from '@/lib/invoice-api';
import type { Cari, Fatura, FaturaDurum } from '../types';

export type FaturaTab = 'tumu' | 'manuel' | 'satis' | 'alis' | 'bekleyen' | 'uyumsoft';

export interface UseFaturalarOptions {
  limit?: number;
}

export interface UseFaturalarReturn {
  // List state
  faturalar: Fatura[];
  setFaturalar: React.Dispatch<React.SetStateAction<Fatura[]>>;
  filteredFaturalar: Fatura[];

  // Cariler
  cariler: Cari[];
  loadCariler: () => Promise<void>;

  // Load & error
  loadInvoices: () => Promise<void>;
  isLoading: boolean;
  loadError: string | null;

  // Stats (manuel faturalardan)
  toplamSatis: number;
  toplamAlis: number;
  bekleyenToplam: number;

  // CRUD helpers (API çağrısı + refetch)
  updateDurum: (id: string, durum: FaturaDurum) => Promise<void>;
  deleteFatura: (id: string) => Promise<void>;
}

const statusToApi: Record<FaturaDurum, 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'> = {
  taslak: 'draft',
  gonderildi: 'sent',
  odendi: 'paid',
  gecikti: 'overdue',
  iptal: 'cancelled',
};

const apiStatusToDurum: Record<string, FaturaDurum> = {
  draft: 'taslak',
  sent: 'gonderildi',
  paid: 'odendi',
  overdue: 'gecikti',
  cancelled: 'iptal',
};

function asFatura(raw: ReturnType<typeof convertToFrontendFormat>): Fatura {
  const d = raw.durum as string;
  return {
    ...raw,
    durum: apiStatusToDurum[d] ?? 'taslak',
  } as Fatura;
}

export function useFaturalar(
  activeTab: FaturaTab,
  searchTerm: string,
  options: UseFaturalarOptions = {}
): UseFaturalarReturn {
  const { limit = 250 } = options;

  const [faturalar, setFaturalar] = useState<Fatura[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCariler = useCallback(async () => {
    try {
      const result = (await muhasebeAPI.getCariler()) as { success?: boolean; data?: Cari[] } | { items?: Cari[] };
      if (result && 'data' in result && result.success && result.data) {
        setCariler(result.data);
      } else if (result && 'items' in result && Array.isArray(result.items)) {
        setCariler(result.items);
      }
    } catch (err) {
      console.error('Cariler yükleme hatası:', err);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await invoiceAPI.list({ limit });
      if (result?.success && result.data) {
        const rawList = Array.isArray(result.data) ? result.data : [];
        const formatted = rawList.map((inv: unknown) =>
          asFatura(convertToFrontendFormat(inv as Parameters<typeof convertToFrontendFormat>[0]))
        );
        setFaturalar(formatted);
      } else {
        setFaturalar([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Faturalar yüklenirken bir hata oluştu';
      setLoadError(msg);
      setFaturalar([]);
      notifications.show({ title: 'Hata', message: msg, color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const filteredFaturalar = useMemo(() => {
    return faturalar
      .filter((f) => {
        const matchesTab =
          activeTab === 'tumu' ||
          activeTab === 'manuel' ||
          (activeTab === 'satis' && f.tip === 'satis') ||
          (activeTab === 'alis' && f.tip === 'alis') ||
          (activeTab === 'bekleyen' && (f.durum === 'gonderildi' || f.durum === 'gecikti'));
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          !q || f.cariUnvan.toLowerCase().includes(q) || `${f.seri}${f.no}`.toLowerCase().includes(q);
        return matchesTab && matchesSearch;
      })
      .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
  }, [faturalar, activeTab, searchTerm]);

  const toplamSatis = useMemo(
    () => faturalar.filter((f) => f.tip === 'satis').reduce((acc, f) => acc + f.genelToplam, 0),
    [faturalar]
  );
  const toplamAlis = useMemo(
    () => faturalar.filter((f) => f.tip === 'alis').reduce((acc, f) => acc + f.genelToplam, 0),
    [faturalar]
  );
  const bekleyenToplam = useMemo(
    () =>
      faturalar
        .filter((f) => f.durum === 'gonderildi' || f.durum === 'gecikti')
        .reduce((acc, f) => acc + f.genelToplam, 0),
    [faturalar]
  );

  const updateDurum = useCallback(
    async (id: string, durum: FaturaDurum) => {
      try {
        const apiStatus = statusToApi[durum];
        const result = await invoiceAPI.updateStatus(parseInt(id, 10), apiStatus);
        if (result?.success) {
          notifications.show({
            title: 'Güncellendi',
            message: 'Fatura durumu değiştirildi.',
            color: 'blue',
          });
          await loadInvoices();
        }
      } catch (err: unknown) {
        notifications.show({
          title: 'Hata!',
          message: err instanceof Error ? err.message : 'Durum güncellenemedi',
          color: 'red',
        });
      }
    },
    [loadInvoices]
  );

  const deleteFatura = useCallback(
    async (id: string) => {
      if (!confirm('Bu faturayı silmek istediğinize emin misiniz?')) return;
      try {
        const result = await invoiceAPI.delete(parseInt(id, 10));
        if (result?.success) {
          notifications.show({
            title: 'Silindi',
            message: 'Fatura silindi.',
            color: 'orange',
          });
          await loadInvoices();
        }
      } catch (err: unknown) {
        notifications.show({
          title: 'Hata!',
          message: err instanceof Error ? err.message : 'Silinemedi',
          color: 'red',
        });
      }
    },
    [loadInvoices]
  );

  return {
    faturalar,
    setFaturalar,
    filteredFaturalar,
    cariler,
    loadCariler,
    loadInvoices,
    isLoading,
    loadError,
    toplamSatis,
    toplamAlis,
    bekleyenToplam,
    updateDurum,
    deleteFatura,
  };
}
