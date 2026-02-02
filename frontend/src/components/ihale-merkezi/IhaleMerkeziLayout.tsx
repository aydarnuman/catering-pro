'use client';

import { ActionIcon, Box, Drawer, Group, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowLeft, IconNote, IconTools } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { apiClient } from '@/lib/api';
import { firmalarAPI } from '@/lib/api/services/firmalar';
import { tendersAPI } from '@/lib/api/services/tenders';
import type { Tender, TendersResponse } from '@/types/api';
import { CenterPanel } from './CenterPanel/CenterPanel';
import { LeftPanel } from './LeftPanel/LeftPanel';
import { AddTenderModal } from './Modals/AddTenderModal';
import { RightPanel } from './RightPanel/RightPanel';
import type { IhaleMerkeziState, SavedTender, UpdateStats } from './types';

// Lazy load heavy modals
const TenderMapModal = dynamic(() => import('@/components/TenderMapModal'), {
  ssr: false,
  loading: () => null,
});

const TeklifModal = dynamic(() => import('@/components/teklif/TeklifModal'), {
  ssr: false,
  loading: () => null,
});

// CSS variables for panel widths
const PANEL_WIDTHS = {
  left: 300,
  right: 340,
};

// Cowork-style grid background CSS
const gridBackgroundStyle = {
  backgroundImage: `
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
  `,
  backgroundSize: '24px 24px',
  backgroundPosition: '-1px -1px',
};

export function IhaleMerkeziLayout() {
  const searchParams = useSearchParams();
  
  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'tools' | 'notes'>('tools');

  // ========== STATE ==========
  const [state, setState] = useState<IhaleMerkeziState>({
    // Sol panel
    activeTab: (searchParams.get('tab') as 'all' | 'tracked') || 'all',
    selectedTenderId: searchParams.get('tender') ? Number(searchParams.get('tender')) : null,
    searchQuery: '',
    filters: {},
    currentPage: 1,
    showStats: false,

    // Orta panel
    detailExpanded: !!searchParams.get('tender'),
    aiChatExpanded: true,
    activeDetailTab: 'ozet',
    dilekceType: null,

    // Sag panel
    expandedSections: new Set(['notes']),
    selectedFirmaId: null,

    // Data
    allTenders: [],
    trackedTenders: [],
    selectedTender: null,
    statsData: null,
    firmalar: [],

    // Modals
    mapModalOpen: false,
    addUrlModalOpen: false,
    teklifModalOpen: false,
  });

  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // ========== DATA FETCHING ==========

  // Fetch all tenders
  const fetchAllTenders = useCallback(async () => {
    try {
      const response: TendersResponse = await apiClient.getTenders({
        page: state.currentPage,
        limit: 20,
        search: state.searchQuery || undefined,
        status: 'active',
      });

      setState((prev) => ({
        ...prev,
        allTenders: response.tenders || [],
      }));
      setTotalPages(response.totalPages || 1);
      setTotalCount(response.total || 0);
    } catch (error) {
      console.error('Tenders fetch error:', error);
    }
  }, [state.currentPage, state.searchQuery]);

  // Fetch tracked tenders
  const fetchTrackedTenders = useCallback(async () => {
    try {
      const result = await tendersAPI.getTrackingList();
      if (result.success && result.data) {
        const formatted: SavedTender[] = result.data.map((t: Record<string, unknown>) => ({
          id: t.id.toString(),
          tender_id: t.tender_id,
          ihale_basligi: t.ihale_basligi || '',
          kurum: t.kurum || '',
          tarih: t.tarih ? new Date(t.tarih).toLocaleDateString('tr-TR') : '',
          bedel: t.bedel ? `${Number(t.bedel).toLocaleString('tr-TR')} ₺` : '',
          city: t.city,
          external_id: t.external_id,
          url: t.url,
          status: t.status || 'bekliyor',
          notes: t.notes || '',
          user_notes: t.user_notes || [],
          created_at: t.created_at,
          dokuman_sayisi: t.dokuman_sayisi || 0,
          analiz_edilen_dokuman: t.analiz_edilen_dokuman || 0,
          teknik_sart_sayisi: t.analysis_summary?.teknik_sartlar?.length || 0,
          birim_fiyat_sayisi: t.analysis_summary?.birim_fiyatlar?.length || 0,
          analysis_summary: t.analysis_summary,
          yaklasik_maliyet: t.yaklasik_maliyet ? parseFloat(t.yaklasik_maliyet) : undefined,
          sinir_deger: t.sinir_deger ? parseFloat(t.sinir_deger) : undefined,
          bizim_teklif: t.bizim_teklif ? parseFloat(t.bizim_teklif) : undefined,
        }));
        setState((prev) => ({ ...prev, trackedTenders: formatted }));
      }
    } catch (error) {
      console.error('Tracked tenders fetch error:', error);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const result = await tendersAPI.getTenderStats();
      if (result.success) {
        setState((prev) => ({ ...prev, statsData: result.data as UpdateStats }));
      }
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
  }, []);

  // Fetch firmalar
  const fetchFirmalar = useCallback(async () => {
    try {
      const result = await firmalarAPI.getFirmalar();
      if (result.success && result.data) {
        setState((prev) => ({ ...prev, firmalar: result.data || [] }));
      }
    } catch (error) {
      console.error('Firmalar fetch error:', error);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAllTenders(), fetchTrackedTenders(), fetchStats(), fetchFirmalar()]);
      setLoading(false);
    };
    loadData();
  }, [fetchAllTenders, fetchTrackedTenders, fetchStats, fetchFirmalar]);

  // Realtime refresh
  useRealtimeRefetch('tenders', () => {
    fetchAllTenders();
    fetchTrackedTenders();
    fetchStats();
  });

  // ========== STATE UPDATERS ==========

  const updateState = useCallback((updates: Partial<IhaleMerkeziState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const selectTender = useCallback(
    async (tender: Tender | SavedTender | null) => {
      updateState({
        selectedTender: tender,
        selectedTenderId: tender ? ('tender_id' in tender ? tender.tender_id : tender.id) : null,
        detailExpanded: !!tender,
      });

      // Update URL
      if (tender) {
        const id = 'tender_id' in tender ? tender.tender_id : tender.id;
        const url = new URL(window.location.href);
        url.searchParams.set('tender', String(id));
        window.history.replaceState({}, '', url.toString());
        
        // Global AI Asistana context gönder
        const isSaved = 'tender_id' in tender;
        window.dispatchEvent(new CustomEvent('ai-context-update', {
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
              // Eğer SavedTender ise ek bilgiler
              ...(isSaved && {
                dokuman_sayisi: tender.dokuman_sayisi,
                teknik_sart_sayisi: tender.teknik_sart_sayisi,
                birim_fiyat_sayisi: tender.birim_fiyat_sayisi,
                status: tender.status,
              }),
            },
          },
        }));
        
        // On-demand döküman çekme - eğer tracked değilse veya döküman sayısı 0 ise
        const dokumanSayisi = isSaved ? tender.dokuman_sayisi : 0;
        
        if (dokumanSayisi === 0) {
          try {
            // Arka planda dökümanları çek
            tendersAPI.scrapeDocumentsForTender(String(id)).catch(() => {
              // Hata olursa sessizce devam et
            });
          } catch {
            // İgnore
          }
        }
      } else {
        const url = new URL(window.location.href);
        url.searchParams.delete('tender');
        window.history.replaceState({}, '', url.toString());
        
        // AI context'i temizle
        window.dispatchEvent(new CustomEvent('ai-context-update', {
          detail: {
            type: 'tender',
            pathname: '/ihale-merkezi',
            department: 'İHALE',
          },
        }));
      }
    },
    [updateState]
  );

  const toggleSection = useCallback((sectionId: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expandedSections);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        newExpanded.add(sectionId);
      }
      return { ...prev, expandedSections: newExpanded };
    });
  }, []);

  // Update tender status
  const updateTenderStatus = useCallback(
    async (tenderId: string, newStatus: string) => {
      try {
        await tendersAPI.updateTracking(Number(tenderId), { status: newStatus });
        // Update local state
        setState((prev) => ({
          ...prev,
          trackedTenders: prev.trackedTenders.map((t) =>
            t.id === tenderId ? { ...t, status: newStatus as SavedTender['status'] } : t
          ),
          selectedTender:
            prev.selectedTender && 'id' in prev.selectedTender && prev.selectedTender.id === tenderId
              ? { ...prev.selectedTender, status: newStatus as SavedTender['status'] }
              : prev.selectedTender,
        }));
      } catch (error) {
        console.error('Status update error:', error);
      }
    },
    []
  );

  // ========== RENDER ==========

  // Mobile back handler
  const handleMobileBack = useCallback(() => {
    selectTender(null);
  }, [selectTender]);

  // ========== MOBILE LAYOUT ==========
  if (isMobile) {
    return (
      <Box
        style={{
          height: 'calc(100vh - 60px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--mantine-color-dark-9)',
          ...gridBackgroundStyle,
        }}
      >
        {/* Mobile: Liste veya Detay görünümü */}
        {!state.selectedTender ? (
          // Liste görünümü
          <Box style={{ flex: 1, overflow: 'hidden' }}>
            <LeftPanel
              state={state}
              loading={loading}
              totalPages={totalPages}
              totalCount={totalCount}
              onStateChange={updateState}
              onSelectTender={selectTender}
              onRefresh={() => {
                fetchAllTenders();
                fetchTrackedTenders();
                fetchStats();
              }}
              isMobile
            />
          </Box>
        ) : (
          // Detay görünümü
          <>
            {/* Header with back button */}
            <Box
              p="xs"
              style={{
                borderBottom: '1px solid var(--mantine-color-dark-4)',
                background: 'rgba(37, 38, 43, 0.95)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Group gap="xs">
                <ActionIcon variant="subtle" onClick={handleMobileBack}>
                  <IconArrowLeft size={20} />
                </ActionIcon>
                <Text size="sm" fw={500} lineClamp={1} style={{ flex: 1 }}>
                  {'ihale_basligi' in state.selectedTender
                    ? state.selectedTender.ihale_basligi
                    : state.selectedTender.title || 'İhale Detayı'}
                </Text>
              </Group>
            </Box>

            {/* Content */}
            <Box style={{ flex: 1, overflow: 'auto' }}>
              <CenterPanel
                state={state}
                onStateChange={updateState}
                onSelectTender={selectTender}
                onUpdateStatus={updateTenderStatus}
                onRefreshData={() => {
                  fetchTrackedTenders();
                }}
                isMobile
              />
            </Box>

            {/* Bottom bar */}
            <Box
              p="xs"
              style={{
                borderTop: '1px solid var(--mantine-color-dark-4)',
                background: 'rgba(37, 38, 43, 0.98)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Group grow>
                <ActionIcon
                  variant={mobileActiveTab === 'tools' ? 'filled' : 'subtle'}
                  size="xl"
                  onClick={() => {
                    setMobileActiveTab('tools');
                    setMobileToolsOpen(true);
                  }}
                >
                  <Group gap={4}>
                    <IconTools size={18} />
                    <Text size="xs">Araçlar</Text>
                  </Group>
                </ActionIcon>
                <ActionIcon
                  variant={mobileActiveTab === 'notes' ? 'filled' : 'subtle'}
                  size="xl"
                  onClick={() => {
                    setMobileActiveTab('notes');
                    setMobileToolsOpen(true);
                  }}
                >
                  <Group gap={4}>
                    <IconNote size={18} />
                    <Text size="xs">Notlar</Text>
                  </Group>
                </ActionIcon>
              </Group>
            </Box>
          </>
        )}

        {/* Bottom Sheet Drawer */}
        <Drawer
          opened={mobileToolsOpen}
          onClose={() => setMobileToolsOpen(false)}
          position="bottom"
          size="70%"
          title={mobileActiveTab === 'tools' ? 'Araçlar & Hesaplamalar' : 'Notlar'}
          styles={{
            content: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            },
            header: {
              borderBottom: '1px solid var(--mantine-color-dark-4)',
            },
          }}
        >
          <RightPanel
            state={state}
            onToggleSection={toggleSection}
            onStateChange={updateState}
            mobileActiveTab={mobileActiveTab}
          />
        </Drawer>

        {/* Modals */}
        <AddTenderModal
          opened={state.addUrlModalOpen}
          onClose={() => updateState({ addUrlModalOpen: false })}
          onSuccess={() => {
            fetchAllTenders();
            fetchTrackedTenders();
            fetchStats();
          }}
        />

        <TenderMapModal
          opened={state.mapModalOpen}
          onClose={() => updateState({ mapModalOpen: false })}
          tenders={state.allTenders}
        />

        {state.selectedTender && 'tender_id' in state.selectedTender && (
          <TeklifModal
            opened={state.teklifModalOpen}
            onClose={() => updateState({ teklifModalOpen: false })}
            ihaleBasligi={state.selectedTender.ihale_basligi || 'İsimsiz İhale'}
            ihaleBedeli={state.selectedTender.yaklasik_maliyet}
            birimFiyatlar={state.selectedTender.analysis_summary?.birim_fiyatlar}
          />
        )}
      </Box>
    );
  }

  // ========== DESKTOP LAYOUT ==========
  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: `${PANEL_WIDTHS.left}px 1fr ${PANEL_WIDTHS.right}px`,
        height: 'calc(100vh - 60px)', // Navbar height
        overflow: 'hidden',
        gap: 0,
        background: 'var(--mantine-color-dark-9)',
        ...gridBackgroundStyle,
      }}
    >
      {/* Sol Panel */}
      <LeftPanel
        state={state}
        loading={loading}
        totalPages={totalPages}
        totalCount={totalCount}
        onStateChange={updateState}
        onSelectTender={selectTender}
        onRefresh={() => {
          fetchAllTenders();
          fetchTrackedTenders();
          fetchStats();
        }}
      />

      {/* Orta Panel */}
      <CenterPanel
        state={state}
        onStateChange={updateState}
        onSelectTender={selectTender}
        onUpdateStatus={updateTenderStatus}
        onRefreshData={() => {
          fetchTrackedTenders();
        }}
      />

      {/* Sag Panel */}
      <RightPanel
        state={state}
        onToggleSection={toggleSection}
        onStateChange={updateState}
      />

      {/* Modals */}
      <AddTenderModal
        opened={state.addUrlModalOpen}
        onClose={() => updateState({ addUrlModalOpen: false })}
        onSuccess={() => {
          fetchAllTenders();
          fetchTrackedTenders();
          fetchStats();
        }}
      />

      <TenderMapModal
        opened={state.mapModalOpen}
        onClose={() => updateState({ mapModalOpen: false })}
        tenders={state.allTenders}
      />

      {state.selectedTender && 'tender_id' in state.selectedTender && (
        <TeklifModal
          opened={state.teklifModalOpen}
          onClose={() => updateState({ teklifModalOpen: false })}
          ihaleBasligi={state.selectedTender.ihale_basligi || 'İsimsiz İhale'}
          ihaleBedeli={state.selectedTender.yaklasik_maliyet}
          birimFiyatlar={state.selectedTender.analysis_summary?.birim_fiyatlar}
        />
      )}
    </Box>
  );
}
