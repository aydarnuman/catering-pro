'use client';

import { Box, ScrollArea, Text } from '@mantine/core';
import { IconCalculator, IconClock, IconFileText, IconNote, IconUsers } from '@tabler/icons-react';
import { ContextualNotesSection } from '@/components/notes/ContextualNotesSection';
import type { IhaleMerkeziState } from '../types';
import { CalculationsPanel } from './CalculationsPanel';
import { CollapsibleSection } from './CollapsibleSection';
import { DocumentsPanel } from './DocumentsPanel';
import { FirmsPanel } from './FirmsPanel';
import { TimelinePanel } from './TimelinePanel';

interface RightPanelProps {
  state: IhaleMerkeziState;
  onToggleSection: (sectionId: string) => void;
  onStateChange: (updates: Partial<IhaleMerkeziState>) => void; // Reserved for future use
  mobileActiveTab?: 'tools' | 'notes';
}

export function RightPanel({
  state,
  onToggleSection,
  onStateChange: _onStateChange,
  mobileActiveTab,
}: RightPanelProps) {
  const { selectedTender, expandedSections } = state;

  // Check if tender is SavedTender
  const isSavedTender = selectedTender && 'tender_id' in selectedTender;
  const tenderId = isSavedTender ? selectedTender.tender_id : selectedTender?.id;

  // Mobile mode: show only selected tab content
  const isMobile = !!mobileActiveTab;

  return (
    <Box
      style={{
        height: '100%',
        minHeight: 0, // Critical for CSS Grid scroll
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: isMobile ? 'transparent' : 'rgba(24, 24, 27, 0.85)',
        backdropFilter: isMobile ? 'none' : 'blur(8px)',
        borderLeft: isMobile ? 'none' : '1px solid var(--mantine-color-default-border)',
      }}
    >
      <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
        {/* Notlar - Gelişmiş Not Sistemi */}
        {(!isMobile || mobileActiveTab === 'notes') && (
          <CollapsibleSection
            title="Notlar"
            icon={<IconNote size={16} />}
            color="yellow"
            isExpanded={isMobile || expandedSections.has('notes')}
            onToggle={() => onToggleSection('notes')}
          >
            {selectedTender && tenderId ? (
              <Box p="xs">
                <ContextualNotesSection
                  contextType="tender"
                  contextId={Number(tenderId)}
                  title=""
                  compact
                  showAddButton
                />
              </Box>
            ) : (
              <Box p="xs" ta="center" c="dimmed">
                <Text size="xs">İhale seçin</Text>
              </Box>
            )}
          </CollapsibleSection>
        )}

        {/* Hesaplamalar */}
        {(!isMobile || mobileActiveTab === 'tools') && (
          <CollapsibleSection
            title="Hesaplamalar"
            icon={<IconCalculator size={16} />}
            color="violet"
            isExpanded={isMobile || expandedSections.has('calculations')}
            onToggle={() => onToggleSection('calculations')}
          >
            {selectedTender && isSavedTender ? (
              <CalculationsPanel tender={selectedTender} />
            ) : (
              <Box p="xs" ta="center" c="dimmed">
                <Text size="xs">İhale seçin</Text>
              </Box>
            )}
          </CollapsibleSection>
        )}

        {/* Dökümanlar */}
        {(!isMobile || mobileActiveTab === 'tools') && (
          <CollapsibleSection
            title="Dökümanlar"
            icon={<IconFileText size={16} />}
            color="blue"
            isExpanded={isMobile || expandedSections.has('documents')}
            onToggle={() => onToggleSection('documents')}
            badge={isSavedTender ? selectedTender.dokuman_sayisi : undefined}
          >
            {selectedTender && tenderId ? (
              <DocumentsPanel tenderId={tenderId} />
            ) : (
              <Box p="xs" ta="center" c="dimmed">
                <Text size="xs">İhale seçin</Text>
              </Box>
            )}
          </CollapsibleSection>
        )}

        {/* Firmalar / Rakip Teklifler */}
        {(!isMobile || mobileActiveTab === 'tools') && (
          <CollapsibleSection
            title="Rakip Teklifler"
            icon={<IconUsers size={16} />}
            color="orange"
            isExpanded={expandedSections.has('firms')}
            onToggle={() => onToggleSection('firms')}
          >
            {selectedTender && isSavedTender ? (
              <FirmsPanel tender={selectedTender} />
            ) : (
              <Box p="xs" ta="center" c="dimmed">
                <Text size="xs">Takip edilen bir ihale seçin</Text>
              </Box>
            )}
          </CollapsibleSection>
        )}

        {/* Timeline */}
        {(!isMobile || mobileActiveTab === 'tools') && (
          <CollapsibleSection
            title="Timeline"
            icon={<IconClock size={16} />}
            color="gray"
            isExpanded={expandedSections.has('timeline')}
            onToggle={() => onToggleSection('timeline')}
          >
            {selectedTender && tenderId ? (
              <TimelinePanel tenderId={tenderId} />
            ) : (
              <Box p="xs" ta="center" c="dimmed">
                <Text size="xs">İhale seçin</Text>
              </Box>
            )}
          </CollapsibleSection>
        )}
      </ScrollArea>
    </Box>
  );
}
