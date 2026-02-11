'use client';

/**
 * İhale Merkezi Context
 * Tüm state yönetimi, data fetching ve action'ları merkezileştirir.
 * Panel'ler hâlâ props üzerinden veri alır (backward compatible),
 * ancak bu context gelecekte doğrudan tüketim için hazırdır.
 */

import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { createContext, useCallback, useContext, useState } from 'react';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import {
  useAllTenders,
  useFirmalar,
  useInvalidateTenderQueries,
  useTenderStats,
  useToggleTracking,
  useTrackedTenders,
  useUpdateTenderStatus,
} from '@/hooks/useIhaleMerkeziData';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { Tender } from '@/types/api';
import type { IhaleMerkeziState, SavedTender, TenderStatus } from './types';

// ─── Context Value Type ────────────────────────────────────────

interface IhaleMerkeziContextValue {
  /** Composed state object (UI state + query data) for panel props */
  state: IhaleMerkeziState;
  /** Loading state for initial data load */
  loading: boolean;
  /** Total pages from allTenders query */
  totalPages: number;
  /** Total count from allTenders query */
  totalCount: number;

  // Actions
  updateState: (updates: Partial<IhaleMerkeziState>) => void;
  selectTender: (tender: Tender | SavedTender | null) => void;
  toggleSection: (sectionId: string) => void;
  toggleTracking: (tenderId: number, isCurrentlyTracked: boolean) => void;
  updateTenderStatus: (tenderId: string, newStatus: string) => void;
  /** Toggle left panel collapsed state */
  toggleLeftPanel: () => void;
  /** Refresh all data */
  refreshAll: () => void;
  /** Refresh tracked tenders and return fresh list */
  refreshTracked: () => Promise<SavedTender[]>;
  /** Refresh data and update selected tender */
  refreshAndUpdateSelected: () => Promise<void>;
}

const IhaleMerkeziContext = createContext<IhaleMerkeziContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────

export function IhaleMerkeziProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();

  // ========== UI STATE ==========
  const [uiState, setUiState] = useState({
    // Sol panel
    activeTab: (searchParams.get('tab') as 'all' | 'tracked') || 'all',
    selectedTenderId: searchParams.get('tender') ? Number(searchParams.get('tender')) : null,
    searchQuery: '',
    filters: {} as IhaleMerkeziState['filters'],
    currentPage: 1,
    showStats: false as IhaleMerkeziState['showStats'],
    leftPanelCollapsed: false,

    // Orta panel
    detailExpanded: !!searchParams.get('tender'),
    aiChatExpanded: true,
    activeDetailTab: 'ozet' as IhaleMerkeziState['activeDetailTab'],
    dilekceType: null as string | null,

    // Sag panel
    activeRightTab: 'kontrol' as IhaleMerkeziState['activeRightTab'],
    expandedSections: new Set(['notes']),
    selectedFirmaId: null as number | null,

    // Selection
    selectedTender: null as IhaleMerkeziState['selectedTender'],

    // Modals
    mapModalOpen: false,
    addUrlModalOpen: false,
    teklifModalOpen: false,
    sanalMasaOpen: false,
  });

  // ========== DATA FETCHING (TanStack Query) ==========

  const allTendersQuery = useAllTenders({
    page: uiState.currentPage,
    search: uiState.searchQuery || undefined,
    status: uiState.filters.apiStatus || 'active',
    city: uiState.filters.city?.[0] || undefined,
  });

  const trackedTendersQuery = useTrackedTenders();
  const statsQuery = useTenderStats();
  const firmalarQuery = useFirmalar();

  // Derived values
  const loading =
    allTendersQuery.isLoading ||
    trackedTendersQuery.isLoading ||
    statsQuery.isLoading ||
    firmalarQuery.isLoading;
  const totalPages = allTendersQuery.data?.totalPages || 1;
  const totalCount = allTendersQuery.data?.total || 0;

  // Mutations
  const toggleTrackingMutation = useToggleTracking();
  const updateStatusMutation = useUpdateTenderStatus();
  const { invalidateTenders, invalidateTracked, invalidateStats, refetchTracked } =
    useInvalidateTenderQueries();

  // Compose full state for panels (backward compatible)
  const state: IhaleMerkeziState = {
    ...uiState,
    allTenders: allTendersQuery.data?.tenders || [],
    trackedTenders: trackedTendersQuery.data || [],
    statsData: statsQuery.data || null,
    firmalar: firmalarQuery.data || [],
  };

  // Realtime refresh via query invalidation
  useRealtimeRefetch('tenders', () => {
    invalidateTenders();
    invalidateTracked();
    invalidateStats();
  });

  // ========== ACTIONS ==========

  const updateState = useCallback((updates: Partial<IhaleMerkeziState>) => {
    // Filter out data fields managed by TanStack Query
    const { allTenders, trackedTenders, statsData, firmalar, ...uiUpdates } = updates;
    setUiState((prev) => ({ ...prev, ...uiUpdates }));
  }, []);

  const selectTender = useCallback(async (tender: Tender | SavedTender | null) => {
    setUiState((prev) => ({
      ...prev,
      selectedTender: tender,
      selectedTenderId: tender ? ('tender_id' in tender ? tender.tender_id : tender.id) : null,
      detailExpanded: !!tender,
      // Auto-collapse left panel when a tender is selected
      leftPanelCollapsed: !!tender,
    }));

    // Update URL
    if (tender) {
      const id = 'tender_id' in tender ? tender.tender_id : tender.id;
      const url = new URL(window.location.href);
      url.searchParams.set('tender', String(id));
      window.history.replaceState({}, '', url.toString());

      // Global AI Asistana context gönder
      const isSaved = 'tender_id' in tender;
      window.dispatchEvent(
        new CustomEvent('ai-context-update', {
          detail: {
            type: 'tender',
            id: id,
            title: isSaved ? tender.ihale_basligi : tender.title,
            pathname: '/ihale-merkezi',
            department: 'İHALE',
            data: {
              title: isSaved ? tender.ihale_basligi : tender.title,
              organization: isSaved ? tender.kurum : tender.organization,
              city: tender.city,
              external_id: isSaved ? tender.external_id : tender.external_id,
              deadline: isSaved ? tender.tarih : tender.deadline,
              estimated_cost: isSaved ? tender.yaklasik_maliyet : tender.estimated_cost,
              ...(isSaved && {
                dokuman_sayisi: tender.dokuman_sayisi,
                teknik_sart_sayisi: tender.teknik_sart_sayisi,
                birim_fiyat_sayisi: tender.birim_fiyat_sayisi,
                status: tender.status,
              }),
            },
          },
        })
      );

      // On-demand döküman çekme
      const dokumanSayisi = isSaved ? tender.dokuman_sayisi : 0;
      if (dokumanSayisi === 0) {
        try {
          tendersAPI.scrapeDocumentsForTender(String(id)).catch(() => {});
        } catch {
          // Ignore
        }
      }
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('tender');
      window.history.replaceState({}, '', url.toString());

      window.dispatchEvent(
        new CustomEvent('ai-context-update', {
          detail: {
            type: 'tender',
            pathname: '/ihale-merkezi',
            department: 'İHALE',
          },
        })
      );
    }
  }, []);

  const toggleLeftPanel = useCallback(() => {
    setUiState((prev) => ({
      ...prev,
      leftPanelCollapsed: !prev.leftPanelCollapsed,
    }));
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setUiState((prev) => {
      const newExpanded = new Set(prev.expandedSections);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        newExpanded.add(sectionId);
      }
      return { ...prev, expandedSections: newExpanded };
    });
  }, []);

  const toggleTracking = useCallback(
    async (tenderId: number, isCurrentlyTracked: boolean) => {
      try {
        const trackedTenders = trackedTendersQuery.data || [];
        const tracked = trackedTenders.find((t) => t.tender_id === tenderId);

        await toggleTrackingMutation.mutateAsync({
          tenderId,
          isCurrentlyTracked,
          trackedId: tracked?.id,
        });

        const freshList = await refetchTracked();

        if (uiState.selectedTender) {
          const selectedId =
            'tender_id' in uiState.selectedTender
              ? uiState.selectedTender.tender_id
              : uiState.selectedTender.id;
          if (selectedId === tenderId) {
            const freshTracked = freshList.find((t) => t.tender_id === tenderId);
            if (freshTracked) {
              selectTender(freshTracked);
            }
          }
        }
      } catch (error) {
        console.error('Toggle tracking error:', error);
      }
    },
    [
      trackedTendersQuery.data,
      uiState.selectedTender,
      toggleTrackingMutation,
      refetchTracked,
      selectTender,
    ]
  );

  const updateTenderStatus = useCallback(
    async (tenderId: string, newStatus: string) => {
      try {
        await updateStatusMutation.mutateAsync({ tenderId, newStatus });
        setUiState((prev) => {
          if (
            prev.selectedTender &&
            'tender_id' in prev.selectedTender &&
            (prev.selectedTender as SavedTender).id === tenderId
          ) {
            return {
              ...prev,
              selectedTender: {
                ...(prev.selectedTender as SavedTender),
                status: newStatus as TenderStatus,
              } as SavedTender,
            };
          }
          return prev;
        });
      } catch (error) {
        console.error('Status update error:', error);
      }
    },
    [updateStatusMutation]
  );

  const refreshAll = useCallback(() => {
    invalidateTenders();
    invalidateTracked();
    invalidateStats();
  }, [invalidateTenders, invalidateTracked, invalidateStats]);

  const refreshTracked = useCallback(async () => {
    return refetchTracked();
  }, [refetchTracked]);

  const refreshAndUpdateSelected = useCallback(async () => {
    const trackedList = await refetchTracked();
    if (uiState.selectedTender) {
      const tenderId =
        'tender_id' in uiState.selectedTender
          ? uiState.selectedTender.tender_id
          : uiState.selectedTender.id;
      const tracked = trackedList.find((t) => t.tender_id === tenderId);
      if (tracked) {
        selectTender(tracked);
      }
    }
  }, [refetchTracked, uiState.selectedTender, selectTender]);

  const value: IhaleMerkeziContextValue = {
    state,
    loading,
    totalPages,
    totalCount,
    updateState,
    selectTender,
    toggleSection,
    toggleTracking,
    updateTenderStatus,
    toggleLeftPanel,
    refreshAll,
    refreshTracked,
    refreshAndUpdateSelected,
  };

  return <IhaleMerkeziContext.Provider value={value}>{children}</IhaleMerkeziContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────

export function useIhaleMerkezi(): IhaleMerkeziContextValue {
  const context = useContext(IhaleMerkeziContext);
  if (!context) {
    throw new Error('useIhaleMerkezi must be used within IhaleMerkeziProvider');
  }
  return context;
}
