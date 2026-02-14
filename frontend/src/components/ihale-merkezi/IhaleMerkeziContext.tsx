'use client';

/**
 * İhale Merkezi Context
 * Tüm state yönetimi, data fetching ve action'ları merkezileştirir.
 * Panel'ler hâlâ props üzerinden veri alır (backward compatible),
 * ancak bu context gelecekte doğrudan tüketim için hazırdır.
 */

import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
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
import { api } from '@/lib/api';
import { tendersAPI } from '@/lib/api/services/tenders';
import { getApiUrl } from '@/lib/config';
import type { Tender } from '@/types/api';
import type { DocumentInfo, IhaleMerkeziState, SavedTender, TenderStatus } from './types';

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
  /** Select a document and fetch its signed URL */
  selectDocument: (doc: DocumentInfo) => void;
  /** Deselect tender and go back to tender list (left panel Mod A) */
  deselectTender: () => void;
  toggleSection: (sectionId: string) => void;
  toggleTracking: (tenderId: number, isCurrentlyTracked: boolean) => void;
  updateTenderStatus: (tenderId: string, newStatus: string) => void;
  /** Toggle left panel collapsed state */
  toggleLeftPanel: () => void;
  /** Refresh all data */
  refreshAll: () => void;
  /** Refresh tracked tenders and return fresh list */
  refreshTracked: () => Promise<SavedTender[]>;
  /** Refresh documents for selected tender */
  refreshDocuments: () => void;
  /** Refresh data and update selected tender */
  refreshAndUpdateSelected: () => Promise<void>;
  /** Open document wizard modal */
  openDocumentWizard: () => void;
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

    // Orta panel (Dokuman Calisma Alani)
    detailExpanded: !!searchParams.get('tender'),
    aiChatExpanded: true,
    selectedDocumentId: null as number | null,
    dilekceType: null as string | null,

    // Dokuman yonetimi
    documents: [] as DocumentInfo[],
    documentsLoading: false,
    signedUrl: null as string | null,
    signedUrlLoading: false,

    // Sag panel (Veri Paketi)
    veriPaketiSections: new Set(['analiz']),
    expandedSections: new Set(['notes']),
    selectedFirmaId: null as number | null,

    // Selection
    selectedTender: null as IhaleMerkeziState['selectedTender'],

    // Modals
    mapModalOpen: false,
    addUrlModalOpen: false,
    teklifModalOpen: false,
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
    allTendersQuery.isLoading || trackedTendersQuery.isLoading || statsQuery.isLoading || firmalarQuery.isLoading;
  const totalPages = allTendersQuery.data?.totalPages || 1;
  const totalCount = allTendersQuery.data?.total || 0;

  // Mutations
  const toggleTrackingMutation = useToggleTracking();
  const updateStatusMutation = useUpdateTenderStatus();
  const { invalidateTenders, invalidateTracked, invalidateStats, refetchTracked } = useInvalidateTenderQueries();

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

  // ========== DOCUMENT FETCHING ==========

  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchSignedUrl = useCallback(async (doc: DocumentInfo) => {
    if (doc.source_type === 'content') {
      setUiState((prev) => ({ ...prev, signedUrl: null, signedUrlLoading: false }));
      return;
    }
    if (!doc.storage_url) {
      setUiState((prev) => ({ ...prev, signedUrl: null, signedUrlLoading: false }));
      return;
    }
    setUiState((prev) => ({ ...prev, signedUrlLoading: true, signedUrl: null }));
    try {
      const res = await api.get(getApiUrl(`/api/tender-docs/documents/${doc.id}/url`));
      setUiState((prev) => ({
        ...prev,
        signedUrl: res.data?.data?.signedUrl || null,
        signedUrlLoading: false,
      }));
    } catch {
      setUiState((prev) => ({ ...prev, signedUrl: null, signedUrlLoading: false }));
    }
  }, []);

  const fetchDocuments = useCallback(
    async (tId: number) => {
      // Cancel previous fetch
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setUiState((prev) => ({ ...prev, documentsLoading: true }));
      try {
        const res = await api.get(getApiUrl(`/api/tender-docs/${tId}/downloaded-documents`), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const grouped = res.data?.data?.documents || [];
        const flat: DocumentInfo[] = [];
        for (const group of grouped) {
          for (const file of group.files || []) {
            flat.push(file);
          }
        }
        setUiState((prev) => ({
          ...prev,
          documents: flat,
          documentsLoading: false,
          // Auto-select first if nothing selected
          selectedDocumentId: flat.length > 0 ? flat[0].id : null,
        }));
        // Auto-fetch signed URL for first doc
        if (flat.length > 0) {
          fetchSignedUrl(flat[0]);
        }
      } catch {
        if (controller.signal.aborted) return;
        setUiState((prev) => ({ ...prev, documents: [], documentsLoading: false }));
      }
    },
    [fetchSignedUrl]
  );

  // ========== ACTIONS ==========

  const updateState = useCallback((updates: Partial<IhaleMerkeziState>) => {
    // Filter out data fields managed by TanStack Query
    const { allTenders, trackedTenders, statsData, firmalar, ...uiUpdates } = updates;
    setUiState((prev) => ({ ...prev, ...uiUpdates }));
  }, []);

  const selectDocument = useCallback(
    (doc: DocumentInfo) => {
      setUiState((prev) => ({ ...prev, selectedDocumentId: doc.id }));
      fetchSignedUrl(doc);
    },
    [fetchSignedUrl]
  );

  const selectTender = useCallback(
    async (tender: Tender | SavedTender | null) => {
      setUiState((prev) => ({
        ...prev,
        selectedTender: tender,
        selectedTenderId: tender ? ('tender_id' in tender ? tender.tender_id : tender.id) : null,
        detailExpanded: !!tender,
        // Do NOT auto-collapse — left panel switches to document list mode
        leftPanelCollapsed: false,
        // Reset document state
        documents: [],
        documentsLoading: false,
        selectedDocumentId: null,
        signedUrl: null,
        signedUrlLoading: false,
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

        // On-demand döküman çekme (scrape if no docs yet)
        const dokumanSayisi = isSaved ? tender.dokuman_sayisi : 0;
        if (isSaved && dokumanSayisi === 0) {
          try {
            tendersAPI.scrapeDocumentsForTender(String(id)).catch(() => {});
          } catch {
            // Ignore
          }
        }

        // Always fetch documents for saved tenders
        // (dokuman_sayisi may be stale/zero even when documents exist)
        if (isSaved) {
          fetchDocuments(id as number);
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
    },
    [fetchDocuments]
  );

  const toggleLeftPanel = useCallback(() => {
    setUiState((prev) => ({
      ...prev,
      leftPanelCollapsed: !prev.leftPanelCollapsed,
    }));
  }, []);

  const deselectTender = useCallback(() => {
    selectTender(null);
  }, [selectTender]);

  const openDocumentWizard = useCallback(() => {
    // Dispatch a custom event that CenterPanel listens to
    window.dispatchEvent(new CustomEvent('open-document-wizard'));
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
            'tender_id' in uiState.selectedTender ? uiState.selectedTender.tender_id : uiState.selectedTender.id;
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
    [trackedTendersQuery.data, uiState.selectedTender, toggleTrackingMutation, refetchTracked, selectTender]
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
        'tender_id' in uiState.selectedTender ? uiState.selectedTender.tender_id : uiState.selectedTender.id;
      const tracked = trackedList.find((t) => t.tender_id === tenderId);
      if (tracked) {
        selectTender(tracked);
      }
    }
  }, [refetchTracked, uiState.selectedTender, selectTender]);

  const refreshDocuments = useCallback(() => {
    if (uiState.selectedTender && 'tender_id' in uiState.selectedTender) {
      const tenderId = (uiState.selectedTender as SavedTender).tender_id;
      fetchDocuments(tenderId);
    }
  }, [uiState.selectedTender, fetchDocuments]);

  const value: IhaleMerkeziContextValue = {
    state,
    loading,
    totalPages,
    totalCount,
    updateState,
    selectTender,
    selectDocument,
    deselectTender,
    toggleSection,
    toggleTracking,
    updateTenderStatus,
    toggleLeftPanel,
    refreshAll,
    refreshTracked,
    refreshDocuments,
    refreshAndUpdateSelected,
    openDocumentWizard,
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
