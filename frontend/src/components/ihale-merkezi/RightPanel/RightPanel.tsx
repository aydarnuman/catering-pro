'use client';

import { Box, Button, ScrollArea, Tabs, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { IconChecklist, IconGavel, IconSparkles, IconTable, IconUsers, IconWand } from '@tabler/icons-react';
import Link from 'next/link';
import { AraclarSection } from '../shared/AraclarSection';
import { DilekceSection } from '../shared/DilekceSection';
import { KontrolSection } from '../shared/KontrolSection';
import type { IhaleMerkeziState, SavedTender } from '../types';
import { CollapsibleSection } from './CollapsibleSection';
import { FirmsPanel } from './FirmsPanel';

interface RightPanelProps {
  state: IhaleMerkeziState;
  onToggleSection: (sectionId: string) => void;
  onStateChange: (updates: Partial<IhaleMerkeziState>) => void;
  onRefreshData?: () => void;
  mobileActiveTab?: 'tools' | 'notes';
}

export function RightPanel({ state, onToggleSection, onStateChange, onRefreshData, mobileActiveTab }: RightPanelProps) {
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
            styles={{
              tab: { fontSize: 'var(--mantine-font-size-xs)', padding: '6px 10px' },
            }}
          >
            <Tabs.List grow>
              <Tabs.Tab value="kontrol" leftSection={<IconChecklist size={13} />} disabled={!isSavedTender}>
                Kontrol
              </Tabs.Tab>
              <Tabs.Tab value="araclar" leftSection={<IconWand size={13} />} disabled={!isSavedTender}>
                Araçlar
              </Tabs.Tab>
              <Tabs.Tab value="dilekce" leftSection={<IconGavel size={13} />} disabled={!isSavedTender}>
                Dilekçe
              </Tabs.Tab>
              <Tabs.Tab
                value="teklif"
                leftSection={<IconSparkles size={13} />}
                disabled={!isSavedTender}
                styles={{
                  tab: {
                    position: 'relative',
                    fontWeight: 600,
                    color: activeRightTab === 'teklif' ? '#fff' : 'rgba(255,255,255,0.85)',
                    background:
                      activeRightTab === 'teklif'
                        ? 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)'
                        : 'rgba(255,255,255,0.05)',
                    border:
                      activeRightTab === 'teklif'
                        ? '1px solid rgba(255,255,255,0.25)'
                        : '1px solid rgba(255,255,255,0.08)',
                    boxShadow:
                      activeRightTab === 'teklif'
                        ? '0 0 12px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : '0 0 6px rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      background:
                        activeRightTab === 'teklif'
                          ? 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.12) 100%)'
                          : 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      boxShadow: '0 0 16px rgba(255,255,255,0.18)',
                    },
                  },
                }}
              >
                Teklif
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
              <>
                {/* Sanal İhale Masası — bağımsız sayfa linki */}
                {(selectedTender as SavedTender).analysis_summary ? (
                  <Button
                    component={Link}
                    href={`/ihale-merkezi/masa/${(selectedTender as SavedTender).tender_id}`}
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'indigo', deg: 135 }}
                    leftSection={<IconTable size={16} />}
                    fullWidth
                    mb="sm"
                    style={{
                      boxShadow: '0 2px 12px rgba(139, 92, 246, 0.2)',
                      transition: 'all 0.2s ease',
                    }}
                    styles={{
                      root: {
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
                        },
                      },
                    }}
                  >
                    Sanal İhale Masası
                  </Button>
                ) : isSavedTender ? (
                  <Tooltip label="Once dokuman analizi yapilmali" position="bottom" withArrow>
                    <Button
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'indigo', deg: 135 }}
                      leftSection={<IconTable size={16} />}
                      fullWidth
                      mb="sm"
                      disabled
                      style={{ opacity: 0.5 }}
                    >
                      Sanal İhale Masası
                    </Button>
                  </Tooltip>
                ) : null}
                <AraclarSection tender={selectedTender as SavedTender} onRefresh={onRefreshData} />
              </>
            )}

            {activeRightTab === 'dilekce' && (
              <DilekceSection
                tender={selectedTender as SavedTender}
                dilekceType={dilekceType}
                onSelectType={(type) => onStateChange({ dilekceType: type })}
              />
            )}

            {activeRightTab === 'teklif' && (
              <Box
                ta="center"
                py="xl"
                px="md"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {/* Animated glow icon */}
                <Box
                  style={{
                    position: 'relative',
                    width: 72,
                    height: 72,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(20, 184, 166, 0.25) 0%, transparent 70%)',
                      animation: 'teklif-pulse 2.5s ease-in-out infinite',
                    }}
                  />
                  <ThemeIcon
                    size={56}
                    variant="gradient"
                    gradient={{ from: 'teal', to: 'cyan', deg: 135 }}
                    radius="xl"
                    style={{
                      boxShadow: '0 0 24px rgba(20, 184, 166, 0.3)',
                    }}
                  >
                    <IconSparkles size={28} />
                  </ThemeIcon>
                </Box>

                <div>
                  <Text size="md" fw={700} mb={4}>
                    Teklif Merkezi
                  </Text>
                  <Text size="xs" c="dimmed" maw={260} style={{ lineHeight: 1.5 }}>
                    AI tespit edilen verileri görüntüleyin, maliyet hesaplayın ve teklif cetveli oluşturun
                  </Text>
                </div>

                <Button
                  size="lg"
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'cyan', deg: 135 }}
                  leftSection={<IconSparkles size={18} />}
                  fullWidth
                  maw={280}
                  onClick={() => onStateChange({ teklifModalOpen: true })}
                  style={{
                    boxShadow: '0 4px 20px rgba(20, 184, 166, 0.25)',
                    transition: 'all 0.2s ease',
                  }}
                  styles={{
                    root: {
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 6px 28px rgba(20, 184, 166, 0.35)',
                      },
                    },
                  }}
                >
                  Teklif Merkezi Aç
                </Button>

                <style>{`
                  @keyframes teklif-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.15); opacity: 1; }
                  }
                `}</style>
              </Box>
            )}

            {activeRightTab === 'kontrol' && (
              <KontrolSection
                tender={selectedTender as SavedTender}
                firmalar={state.firmalar}
                selectedFirmaId={state.selectedFirmaId}
              />
            )}
          </Box>
        )}

        {/* İhale seçilmemişse */}
        {(!isMobile || mobileActiveTab === 'tools') && !isSavedTender && (
          <Box ta="center" py="xl" px="md">
            <Text size="sm" c="dimmed">
              Takip edilen bir ihale seçin
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
