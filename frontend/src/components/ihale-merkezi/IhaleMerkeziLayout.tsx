'use client';

import { ActionIcon, Box, Drawer, Group, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowLeft, IconNote, IconTools } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { CenterPanel } from './CenterPanel/CenterPanel';
import { IhaleMerkeziProvider, useIhaleMerkezi } from './IhaleMerkeziContext';
import { LeftPanel } from './LeftPanel/LeftPanel';
import { MevzuatWidget } from './MevzuatWidget';
import { AddTenderModal } from './Modals/AddTenderModal';
import { RightPanel } from './RightPanel/RightPanel';

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
  right: 420,
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

// ─── Main Export (with Provider wrapper) ───────────────────────

export function IhaleMerkeziLayout() {
  return (
    <IhaleMerkeziProvider>
      <IhaleMerkeziLayoutInner />
    </IhaleMerkeziProvider>
  );
}

// ─── Inner Layout (consumes context) ───────────────────────────

function IhaleMerkeziLayoutInner() {
  const {
    state,
    loading,
    totalPages,
    totalCount,
    updateState,
    selectTender,
    toggleSection,
    toggleTracking,
    updateTenderStatus,
    refreshAll,
    refreshTracked,
    refreshAndUpdateSelected,
  } = useIhaleMerkezi();

  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'tools' | 'notes'>('tools');

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
              onRefresh={refreshAll}
              onToggleTracking={toggleTracking}
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
                onRefreshData={refreshAndUpdateSelected}
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
            onRefreshData={() => {
              refreshTracked();
            }}
            mobileActiveTab={mobileActiveTab}
          />
        </Drawer>

        {/* Modals */}
        <AddTenderModal
          opened={state.addUrlModalOpen}
          onClose={() => updateState({ addUrlModalOpen: false })}
          onSuccess={refreshAll}
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
        onRefresh={refreshAll}
        onToggleTracking={toggleTracking}
      />

      {/* Orta Panel */}
      <CenterPanel
        state={state}
        onStateChange={updateState}
        onSelectTender={selectTender}
        onUpdateStatus={updateTenderStatus}
        onRefreshData={refreshAndUpdateSelected}
      />

      {/* Sag Panel */}
      <RightPanel
        state={state}
        onToggleSection={toggleSection}
        onStateChange={updateState}
        onRefreshData={() => {
          refreshTracked();
        }}
      />

      {/* Modals */}
      <AddTenderModal
        opened={state.addUrlModalOpen}
        onClose={() => updateState({ addUrlModalOpen: false })}
        onSuccess={refreshAll}
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

      {/* Mevzuat & Rehber Widget */}
      <MevzuatWidget />
    </Box>
  );
}
