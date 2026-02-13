import { Badge, Box, CloseButton, Group, ScrollArea, Stack, Tabs, Text, Tooltip } from '@mantine/core';
import { IconClipboardList, IconCoin, IconFileText, IconHelmet, IconUsers } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AnalysisData } from '../../../types';
import type { AgentHighlight, AgentPersona } from '../../types';
import { ContextMenuPopup } from './ContextMenuPopup';
import { DragHandle } from './DragHandle';
import { MiniStat } from './shared';
import { KosullarTabExpanded } from './tabs/KosullarTab';
import { MaliTabExpanded } from './tabs/MaliTab';
import { MetinTab } from './tabs/MetinTab';
import { PersonelTabExpanded } from './tabs/PersonelTab';
import { TeknikTabExpanded } from './tabs/TeknikTab';

// ─── Tab Definitions ─────────────────────────────────────────

const DOC_TABS = [
  { value: 'metin', label: 'Tam Metin', icon: IconFileText },
  { value: 'teknik', label: 'Teknik', icon: IconHelmet },
  { value: 'mali', label: 'Mali', icon: IconCoin },
  { value: 'personel', label: 'Personel', icon: IconUsers },
  { value: 'kosullar', label: 'Kosullar', icon: IconClipboardList },
] as const;

type DocTab = (typeof DOC_TABS)[number]['value'];

// ─── Props ───────────────────────────────────────────────────

interface DocumentViewerProps {
  title: string;
  kurum: string;
  bedel?: string;
  tamMetin?: string;
  analysisSummary?: AnalysisData;
  agentHighlights?: AgentHighlight[];
  expanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  onDragStart?: (text: string) => void;
  onDragEnd?: () => void;
  onSendToAgent?: (agentId: AgentPersona['id'], text: string) => void;
  onBroadcast?: (text: string) => void;
}

// ─── Component ───────────────────────────────────────────────

export function DocumentViewer({
  title,
  kurum,
  bedel,
  tamMetin,
  analysisSummary,
  agentHighlights = [],
  expanded = false,
  onExpand,
  onCollapse,
  onDragStart,
  onDragEnd,
  onSendToAgent,
  onBroadcast,
}: DocumentViewerProps) {
  const [activeTab, setActiveTab] = useState<DocTab>('metin');
  const [selectedText, setSelectedText] = useState('');
  const [showDragHandle, setShowDragHandle] = useState(false);
  const [handlePos, setHandlePos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Text Selection & Drag ─────────────────────────────────

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 10) {
      setSelectedText(text);
      const range = selection?.getRangeAt(0);
      if (range && containerRef.current) {
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        setHandlePos({
          x: rect.right - containerRect.left + 8,
          y: rect.top - containerRect.top + rect.height / 2 - 14,
        });
        setShowDragHandle(true);
      }
    } else {
      setShowDragHandle(false);
      setSelectedText('');
    }
  }, []);

  const handleDragHandleStart = useCallback(() => {
    if (selectedText && onDragStart) {
      onDragStart(selectedText);
    }
  }, [selectedText, onDragStart]);

  const handleDragHandleEnd = useCallback(() => {
    setShowDragHandle(false);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
    onDragEnd?.();
  }, [onDragEnd]);

  // ─── Context Menu ──────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 5) {
      e.preventDefault();
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setContextMenu({
          x: e.clientX - containerRect.left,
          y: e.clientY - containerRect.top,
          text,
        });
      }
    }
  }, []);

  const handleSendTo = useCallback(
    (agentId: AgentPersona['id']) => {
      if (contextMenu?.text && onSendToAgent) {
        onSendToAgent(agentId, contextMenu.text);
      }
      setContextMenu(null);
    },
    [contextMenu, onSendToAgent]
  );

  const handleBroadcast = useCallback(() => {
    if (contextMenu?.text && onBroadcast) {
      onBroadcast(contextMenu.text);
    }
    setContextMenu(null);
  }, [contextMenu, onBroadcast]);

  const handleContainerClick = useCallback(() => {
    if (contextMenu) setContextMenu(null);
  }, [contextMenu]);

  // ─── Paragraphs ───────────────────────────────────────────

  const paragraphs = useMemo(() => {
    return tamMetin ? tamMetin.split(/\n\n+/).filter((p) => p.trim()) : [];
  }, [tamMetin]);

  const handleCardClick = useCallback(() => {
    if (!expanded && onExpand) {
      onExpand();
    }
  }, [expanded, onExpand]);

  // ─── Render ───────────────────────────────────────────────

  return (
    <AnimatePresence mode="wait">
      {expanded ? (
        <motion.div
          key="expanded"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          style={{ borderRadius: 20 }}
        >
          <Box
            ref={containerRef}
            onClick={handleContainerClick}
            style={{
              position: 'relative',
              width: 'min(820px, 65vw)',
              height: 'min(620px, 72vh)',
              borderRadius: 20,
              background: 'linear-gradient(145deg, rgba(30, 30, 50, 0.96), rgba(18, 18, 32, 0.98))',
              backdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <Box
              px="lg"
              py="sm"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
                flexShrink: 0,
              }}
            >
              <Group justify="space-between" align="center">
                <Group gap="sm" align="center" style={{ flex: 1, minWidth: 0 }}>
                  <IconFileText size={20} color="rgba(200,200,220,0.8)" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" fw={700} c="white" lineClamp={1}>
                      {title}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {kurum}
                    </Text>
                  </div>
                  {bedel && (
                    <Badge size="sm" variant="light" color="cyan" style={{ flexShrink: 0 }}>
                      {bedel}
                    </Badge>
                  )}
                </Group>
                <CloseButton
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCollapse?.();
                  }}
                />
              </Group>
            </Box>

            {/* Tab Navigation */}
            <Tabs
              value={activeTab}
              onChange={(v) => setActiveTab((v as DocTab) || 'metin')}
              variant="pills"
              radius="xl"
              styles={{
                root: { borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
                list: { padding: '8px 16px', gap: 6 },
                tab: {
                  fontSize: 12,
                  padding: '6px 14px',
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 600,
                },
              }}
            >
              <Tabs.List>
                {DOC_TABS.map((tab) => (
                  <Tabs.Tab key={tab.value} value={tab.value} leftSection={<tab.icon size={14} />}>
                    {tab.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>

            {/* Tab Content */}
            <ScrollArea style={{ flex: 1, minHeight: 0 }} type="hover" offsetScrollbars scrollbarSize={6}>
              <Box
                p="lg"
                onMouseUp={handleMouseUp}
                onContextMenu={handleContextMenu}
                style={{ userSelect: 'text', cursor: 'text' }}
              >
                {activeTab === 'metin' && (
                  <MetinTab paragraphs={paragraphs} agentHighlights={agentHighlights} expanded />
                )}
                {activeTab === 'teknik' && <TeknikTabExpanded data={analysisSummary} />}
                {activeTab === 'mali' && <MaliTabExpanded data={analysisSummary} />}
                {activeTab === 'personel' && <PersonelTabExpanded data={analysisSummary} />}
                {activeTab === 'kosullar' && <KosullarTabExpanded data={analysisSummary} />}
              </Box>
            </ScrollArea>

            {/* Drag Handle */}
            {showDragHandle && (
              <DragHandle
                pos={handlePos}
                text={selectedText}
                onDragStart={handleDragHandleStart}
                onDragEnd={handleDragHandleEnd}
              />
            )}

            {/* Context Menu */}
            {contextMenu && (onSendToAgent || onBroadcast) && (
              <ContextMenuPopup
                x={contextMenu.x}
                y={contextMenu.y}
                onSendTo={handleSendTo}
                onBroadcast={onBroadcast ? handleBroadcast : undefined}
              />
            )}
          </Box>
        </motion.div>
      ) : (
        /* Collapsed (orbit small card) */
        <motion.div
          key="collapsed"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          style={{ borderRadius: 16 }}
        >
          <motion.div
            animate={{
              scale: [1, 1.015, 1],
              boxShadow: [
                '0 0 30px rgba(255,255,255,0.04)',
                '0 0 50px rgba(255,255,255,0.1)',
                '0 0 30px rgba(255,255,255,0.04)',
              ],
            }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            style={{ borderRadius: 16 }}
          >
            <Tooltip label="Tikla — dokumani genislet" position="top" withArrow>
              <Box
                className="document-stack"
                ref={containerRef}
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={handleCardClick}
              >
                <Box className="document-viewer">
                  <div className="document-scan-bar" />

                  {/* Header */}
                  <Box className="document-viewer-header">
                    <Stack align="center" gap={8}>
                      <IconFileText size={24} color="rgba(200,200,220,0.8)" />
                      <Text size="sm" fw={700} ta="center" c="white" lineClamp={2} style={{ lineHeight: 1.4 }}>
                        {title}
                      </Text>
                      <Text size="xs" ta="center" c="dimmed" lineClamp={1}>
                        {kurum}
                      </Text>
                      {bedel && (
                        <Badge size="sm" variant="light" color="cyan">
                          {bedel}
                        </Badge>
                      )}
                    </Stack>
                  </Box>

                  {/* Mini summary */}
                  <Box px="sm" py={8}>
                    <Stack gap={4}>
                      {analysisSummary?.teknik_sartlar?.length ? (
                        <MiniStat label="Teknik" value={`${analysisSummary.teknik_sartlar.length} madde`} />
                      ) : null}
                      {analysisSummary?.birim_fiyatlar?.length ? (
                        <MiniStat label="Fiyat" value={`${analysisSummary.birim_fiyatlar.length} kalem`} />
                      ) : null}
                      {analysisSummary?.personel_detaylari?.length ? (
                        <MiniStat
                          label="Personel"
                          value={`${analysisSummary.personel_detaylari.reduce((s, p) => s + (p.adet || 0), 0)} kisi`}
                        />
                      ) : null}
                      {analysisSummary?.gerekli_belgeler?.length ? (
                        <MiniStat label="Belge" value={`${analysisSummary.gerekli_belgeler.length} belge`} />
                      ) : null}
                    </Stack>
                  </Box>
                </Box>
              </Box>
            </Tooltip>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
