'use client';

import { Box, Button, ScrollArea, Tabs, Text, ThemeIcon } from '@mantine/core';
import {
  IconFileAnalytics,
  IconGavel,
  IconSparkles,
  IconUsers,
  IconWand,
} from '@tabler/icons-react';
import type { IhaleMerkeziState, SavedTender } from '../types';
import { CollapsibleSection } from './CollapsibleSection';
import { FirmsPanel } from './FirmsPanel';
import { SuggestionsTab } from './SuggestionsTab';
import { AraclarSection, DilekceSection } from '../CenterPanel/CenterPanel';

interface RightPanelProps {
  state: IhaleMerkeziState;
  onToggleSection: (sectionId: string) => void;
  onStateChange: (updates: Partial<IhaleMerkeziState>) => void;
  onRefreshData?: () => void;
  mobileActiveTab?: 'tools' | 'notes';
}

export function RightPanel({
  state,
  onToggleSection,
  onStateChange,
  onRefreshData,
  mobileActiveTab,
}: RightPanelProps) {
  const { selectedTender, expandedSections, activeRightTab, dilekceType } = state;

  // Check if tender is SavedTender
  const isSavedTender = selectedTender && 'tender_id' in selectedTender;

  // Mobile mode: show only selected tab content
  const isMobile = !!mobileActiveTab;

  return (
    <Box
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: isMobile ? 'transparent' : 'rgba(24, 24, 27, 0.85)',
        backdropFilter: isMobile ? 'none' : 'blur(8px)',
        borderLeft: isMobile ? 'none' : '1px solid var(--mantine-color-default-border)',
      }}
    >
      {/* Araçlar Tabs - sadece tools sekmesinde veya mobil değilse */}
      {(!isMobile || mobileActiveTab === 'tools') && (
        <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Tabs
            value={activeRightTab}
            onChange={(value) => onStateChange({ activeRightTab: value as IhaleMerkeziState['activeRightTab'] })}
            variant="pills"
          >
            <Tabs.List grow>
              <Tabs.Tab
                value="araclar"
                leftSection={<IconWand size={14} />}
                disabled={!isSavedTender}
              >
                Araçlar
              </Tabs.Tab>
              <Tabs.Tab
                value="dilekce"
                leftSection={<IconGavel size={14} />}
                disabled={!isSavedTender}
              >
                Dilekçe
              </Tabs.Tab>
              <Tabs.Tab
                value="teklif"
                leftSection={<IconFileAnalytics size={14} />}
                disabled={!isSavedTender}
              >
                Teklif
              </Tabs.Tab>
              <Tabs.Tab
                value="tespit"
                leftSection={<IconSparkles size={14} />}
                disabled={!isSavedTender}
              >
                Tespit
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Box>
      )}

      <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
        {/* Tab Content */}
        {(!isMobile || mobileActiveTab === 'tools') && isSavedTender && (
          <Box p="sm">
            {activeRightTab === 'araclar' && (
              <AraclarSection tender={selectedTender as SavedTender} onRefresh={onRefreshData} />
            )}

            {activeRightTab === 'dilekce' && (
              <DilekceSection
                tender={selectedTender as SavedTender}
                dilekceType={dilekceType}
                onSelectType={(type) => onStateChange({ dilekceType: type })}
              />
            )}

            {activeRightTab === 'teklif' && (
              <Box ta="center" py="lg">
                <ThemeIcon size="xl" variant="light" color="yellow" radius="xl" mb="md">
                  <IconFileAnalytics size={28} />
                </ThemeIcon>
                <Text size="sm" c="dimmed" mb="md">
                  Detaylı teklif cetveli hazırlamak için butona tıklayın
                </Text>
                <Button
                  variant="gradient"
                  style={{ background: 'linear-gradient(135deg, #C9A227 0%, #D4AF37 50%, #E6C65C 100%)', border: 'none' }}
                  leftSection={<IconFileAnalytics size={16} />}
                  onClick={() => onStateChange({ teklifModalOpen: true })}
                >
                  Teklif Cetveli Hazırla
                </Button>
              </Box>
            )}

            {activeRightTab === 'tespit' && (
              <SuggestionsTab
                tender={selectedTender as SavedTender}
                onRefresh={onRefreshData}
                onApplied={() => {
                  // Hesaplamalar bölümünü aç
                  if (!expandedSections.has('calculations')) {
                    onToggleSection('calculations');
                  }
                }}
              />
            )}
          </Box>
        )}

        {/* İhale seçilmemişse */}
        {(!isMobile || mobileActiveTab === 'tools') && !isSavedTender && (
          <Box ta="center" py="xl" px="md">
            <Text size="sm" c="dimmed">
              Araçları kullanmak için takip edilen bir ihale seçin
            </Text>
          </Box>
        )}

        {/* Rakip Teklifler - Araçlar tab'ında */}
        {(!isMobile || mobileActiveTab === 'tools') && activeRightTab === 'araclar' && isSavedTender && (
          <CollapsibleSection
            title="Rakip Teklifler"
            icon={<IconUsers size={16} />}
            color="orange"
            isExpanded={expandedSections.has('firms')}
            onToggle={() => onToggleSection('firms')}
          >
            <FirmsPanel tender={selectedTender as SavedTender} />
          </CollapsibleSection>
        )}
      </ScrollArea>
    </Box>
  );
}
