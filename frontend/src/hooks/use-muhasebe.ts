/**
 * Muhasebe Modülleri için Custom React Hooks
 * State management ve data fetching için optimize edilmiş hooks
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  carilerAPI,
  stokAPI,
  gelirGiderAPI,
  personelAPI,
  satinAlmaAPI,
  kasaBankaAPI,
  dashboardAPI
} from '@/lib/muhasebe-api';

// Cache süreleri
const STALE_TIME = 5 * 60 * 1000; // 5 dakika
const CACHE_TIME = 10 * 60 * 1000; // 10 dakika

// Cariler Hook
export function useCariler(filters?: any) {
  return useQuery({
    queryKey: ['cariler', filters],
    queryFn: () => carilerAPI.list(filters),
    staleTime: STALE_TIME,
    cacheTime: CACHE_TIME,
  });
}

export function useCari(id: string) {
  return useQuery({
    queryKey: ['cariler', id],
    queryFn: () => carilerAPI.get(id),
    enabled: !!id,
  });
}

export function useCariMutations() {
  const queryClient = useQueryClient();
  
  const createMutation = useMutation({
    mutationFn: carilerAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cariler'] });
      notifications.show({
        title: 'Başarılı',
        message: 'Cari hesap oluşturuldu',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Hata',
        message: 'Cari hesap oluşturulamadı',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      carilerAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cariler'] });
      notifications.show({
        title: 'Başarılı',
        message: 'Cari hesap güncellendi',
        color: 'green',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: carilerAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cariler'] });
      notifications.show({
        title: 'Başarılı',
        message: 'Cari hesap silindi',
        color: 'green',
      });
    },
  });

  return {
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Stok Hook with Optimistic Updates
export function useStok(filters?: any) {
  return useQuery({
    queryKey: ['stok', filters],
    queryFn: () => stokAPI.list(filters),
    staleTime: STALE_TIME,
    cacheTime: CACHE_TIME,
  });
}

export function useCriticalStok() {
  return useQuery({
    queryKey: ['stok-critical'],
    queryFn: stokAPI.getCriticalItems,
    staleTime: STALE_TIME,
    refetchInterval: 5 * 60 * 1000, // Her 5 dakikada bir kontrol
  });
}

export function useStokMovement(stokId: string) {
  const queryClient = useQueryClient();

  const addMovement = useMutation({
    mutationFn: (data: any) => stokAPI.addMovement(stokId, data),
    onMutate: async (newMovement) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['stok', stokId] });
      const previousData = queryClient.getQueryData(['stok', stokId]);
      
      queryClient.setQueryData(['stok', stokId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          miktar: old.miktar + (newMovement.tip === 'giris' ? 
            newMovement.miktar : -newMovement.miktar),
        };
      });

      return { previousData };
    },
    onError: (err, newMovement, context) => {
      // Rollback on error
      queryClient.setQueryData(['stok', stokId], context?.previousData);
      notifications.show({
        title: 'Hata',
        message: 'Stok hareketi kaydedilemedi',
        color: 'red',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stok'] });
    },
  });

  return {
    addMovement: addMovement.mutate,
    isAdding: addMovement.isPending,
  };
}

// Gelir-Gider Hook with Caching
export function useGelirGider(filters?: any) {
  const queryKey = ['gelir-gider', filters];
  
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => gelirGiderAPI.list(filters),
    staleTime: STALE_TIME,
    cacheTime: CACHE_TIME,
  });

  // Hesaplanmış değerler - useMemo ile optimize
  const totals = useMemo(() => {
    if (!data?.items) return { gelir: 0, gider: 0, net: 0 };
    
    const gelir = data.items
      .filter((item: any) => item.tip === 'gelir')
      .reduce((sum: number, item: any) => sum + item.tutar, 0);
      
    const gider = data.items
      .filter((item: any) => item.tip === 'gider')
      .reduce((sum: number, item: any) => sum + item.tutar, 0);
    
    return {
      gelir,
      gider,
      net: gelir - gider,
    };
  }, [data]);

  return {
    data,
    isLoading,
    error,
    totals,
  };
}

// Dashboard Hook with Multiple Queries
export function useDashboard() {
  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardAPI.getSummary,
    staleTime: 2 * 60 * 1000, // 2 dakika
  });

  const monthlyTrend = useQuery({
    queryKey: ['dashboard-trend'],
    queryFn: () => dashboardAPI.getMonthlyTrend(),
    staleTime: STALE_TIME,
  });

  const expenseDistribution = useQuery({
    queryKey: ['dashboard-expense-dist'],
    queryFn: () => dashboardAPI.getExpenseDistribution(),
    staleTime: STALE_TIME,
  });

  const recentTransactions = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => dashboardAPI.getRecentTransactions(5),
    staleTime: 60 * 1000, // 1 dakika
    refetchInterval: 2 * 60 * 1000, // 2 dakikada bir yenile
  });

  const upcomingPayments = useQuery({
    queryKey: ['dashboard-payments'],
    queryFn: dashboardAPI.getUpcomingPayments,
    staleTime: STALE_TIME,
  });

  const isLoading = 
    summary.isLoading || 
    monthlyTrend.isLoading || 
    expenseDistribution.isLoading;

  return {
    summary: summary.data,
    monthlyTrend: monthlyTrend.data,
    expenseDistribution: expenseDistribution.data,
    recentTransactions: recentTransactions.data,
    upcomingPayments: upcomingPayments.data,
    isLoading,
    refetch: () => {
      summary.refetch();
      monthlyTrend.refetch();
      expenseDistribution.refetch();
      recentTransactions.refetch();
      upcomingPayments.refetch();
    },
  };
}

// Personel Hook with Salary Processing
export function usePersonel(filters?: any) {
  return useQuery({
    queryKey: ['personel', filters],
    queryFn: () => personelAPI.list(filters),
    staleTime: STALE_TIME,
    cacheTime: CACHE_TIME,
  });
}

export function useSalaryProcessing() {
  const queryClient = useQueryClient();
  
  const processSalaries = useMutation({
    mutationFn: personelAPI.processSalary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personel'] });
      queryClient.invalidateQueries({ queryKey: ['gelir-gider'] });
      queryClient.invalidateQueries({ queryKey: ['kasa-banka'] });
      
      notifications.show({
        title: 'Başarılı',
        message: 'Maaşlar işlendi',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Hata',
        message: 'Maaş işleme başarısız',
        color: 'red',
      });
    },
  });

  return {
    processSalaries: processSalaries.mutate,
    isProcessing: processSalaries.isPending,
  };
}

// Satın Alma Hook with Approval Flow
export function useSatinAlma(filters?: any) {
  return useQuery({
    queryKey: ['satin-alma', filters],
    queryFn: () => satinAlmaAPI.listRequests(filters),
    staleTime: STALE_TIME,
    cacheTime: CACHE_TIME,
  });
}

export function useSatinAlmaApproval() {
  const queryClient = useQueryClient();
  
  const approve = useMutation({
    mutationFn: satinAlmaAPI.approveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['satin-alma'] });
      notifications.show({
        title: 'Başarılı',
        message: 'Talep onaylandı',
        color: 'green',
      });
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      satinAlmaAPI.rejectRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['satin-alma'] });
      notifications.show({
        title: 'Başarılı',
        message: 'Talep reddedildi',
        color: 'orange',
      });
    },
  });

  const convertToOrder = useMutation({
    mutationFn: satinAlmaAPI.convertToOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['satin-alma'] });
      notifications.show({
        title: 'Başarılı',
        message: 'Sipariş oluşturuldu',
        color: 'green',
      });
    },
  });

  return {
    approve: approve.mutate,
    reject: reject.mutate,
    convertToOrder: convertToOrder.mutate,
    isApproving: approve.isPending,
    isRejecting: reject.isPending,
    isConverting: convertToOrder.isPending,
  };
}

// Kasa-Banka Hook
export function useKasaBanka() {
  const accounts = useQuery({
    queryKey: ['kasa-banka-accounts'],
    queryFn: kasaBankaAPI.listAccounts,
    staleTime: STALE_TIME,
  });

  const transactions = useQuery({
    queryKey: ['kasa-banka-transactions'],
    queryFn: kasaBankaAPI.listTransactions,
    staleTime: 60 * 1000, // 1 dakika
  });

  const balanceSummary = useQuery({
    queryKey: ['kasa-banka-balance'],
    queryFn: kasaBankaAPI.getBalanceSummary,
    staleTime: 30 * 1000, // 30 saniye
    refetchInterval: 60 * 1000, // Her dakika güncelle
  });

  return {
    accounts: accounts.data,
    transactions: transactions.data,
    balanceSummary: balanceSummary.data,
    isLoading: accounts.isLoading || transactions.isLoading,
    refetch: () => {
      accounts.refetch();
      transactions.refetch();
      balanceSummary.refetch();
    },
  };
}

export function useMoneyTransfer() {
  const queryClient = useQueryClient();
  
  const transfer = useMutation({
    mutationFn: ({ from, to, amount, description }: {
      from: string;
      to: string;
      amount: number;
      description?: string;
    }) => kasaBankaAPI.transfer(from, to, amount, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kasa-banka'] });
      notifications.show({
        title: 'Başarılı',
        message: 'Transfer tamamlandı',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Hata',
        message: 'Transfer başarısız',
        color: 'red',
      });
    },
  });

  return {
    transfer: transfer.mutate,
    isTransferring: transfer.isPending,
  };
}

// Performans için debounce helper
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Pagination helper
export function usePagination(totalItems: number, itemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const offset = (currentPage - 1) * itemsPerPage;
  
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);
  
  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);
  
  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);
  
  return {
    currentPage,
    totalPages,
    offset,
    limit: itemsPerPage,
    goToPage,
    nextPage,
    prevPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
}
