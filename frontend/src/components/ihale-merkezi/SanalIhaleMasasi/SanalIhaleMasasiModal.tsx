'use client';

import { ActionIcon, Badge, Box, Button, Group, Menu, Modal, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconClock, IconDeviceFloppy, IconHistory, IconX } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import type { SavedTender } from '../types';
import { AgentCard } from './components/AgentCard';
import { AgentDetailPanel } from './components/AgentDetailPanel';
import { AssembleButton } from './components/AssembleButton';
import { CompareOverlay } from './components/CompareOverlay';
import { DocumentViewer } from './components/DocumentViewer';
import { NetworkLines } from './components/NetworkLines';
import { OrbitDetailOverlay } from './components/OrbitDetailOverlay';
import { OrbitRing } from './components/OrbitRing';
import { StageBackground } from './components/StageBackground';
import { TenderDocumentCard } from './components/TenderDocumentCard';
import { VerdictReport } from './components/VerdictReport';
import { SPRING_CONFIG } from './constants';
import { useAgentRegistry } from './hooks/useAgentRegistry';
import { useOrbitAttachments } from './hooks/useOrbitAttachments';
import { useSanalMasa } from './hooks/useSanalMasa';
import type { AgentPersona, SessionRecord } from './types';

const API = `${API_BASE_URL}/api`;

interface SanalIhaleMasasiModalProps {
  opened: boolean;
  onClose: () => void;
  tender: SavedTender;
}

export function SanalIhaleMasasiModal({ opened, onClose, tender }: SanalIhaleMasasiModalProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const {
    viewMode,
    focusedAgent,
    focusedAnalysis,
    verdictData,
    agentAnalyses,
    agentHighlights,
    crossReferences,
    snippetDrops,
    handleAgentClick,
    handleBackToOrbit,
    handleAssemble,
    handleReset,
    handleSnippetDrop,
    reanalyzeAgent,
  } = useSanalMasa(tender);

  // Fetch agents from registry (DB) with fallback to hardcoded constants
  const { agents } = useAgentRegistry({
    contextKey: 'ihale_masasi',
    enabled: opened,
  });

  // Session tracking
  const [sessionStartTime] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const orbit = useOrbitAttachments({
    tenderId: tender?.id ?? null,
    enabled: opened,
    analysisSummary: tender?.analysis_summary ?? null,
  });

  // Fetch orbit attachments when modal opens
  const { fetchAttachments } = orbit;
  useEffect(() => {
    if (opened && tender?.id) {
      fetchAttachments();
    }
  }, [opened, tender?.id, fetchAttachments]);

  // Agent tool → orbit auto-attach
  const handleToolComplete = useCallback(
    (agentId: string, toolId: string, result: import('./types').ToolResult) => {
      orbit.addFromToolResult(agentId as import('./types').AgentPersona['id'], toolId, result);
    },
    [orbit]
  );

  // Document expanded state (managed via ref for keyboard handler)
  const [documentExpanded, setDocumentExpanded] = useState(false);

  // Context menu: send selected text to a specific agent
  const handleSendToAgent = useCallback(
    (agentId: string, text: string) => {
      setDocumentExpanded(false); // Close document when sending to agent
      handleSnippetDrop(agentId, text);
      handleAgentClick(agentId); // Switch to FOCUS mode for the target agent
    },
    [handleSnippetDrop, handleAgentClick]
  );

  // Context menu: broadcast selected text to all agents
  const handleBroadcast = useCallback(
    (text: string) => {
      setDocumentExpanded(false);
      for (const agent of agents) {
        handleSnippetDrop(agent.id, text);
      }
      handleAssemble();
    },
    [agents, handleSnippetDrop, handleAssemble]
  );

  // Deadline calculation
  const deadline = tender.tarih ? new Date(tender.tarih) : null;
  const now = new Date();
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Session save
  const handleSaveSession = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`${API}/ai/ihale-masasi/session/save`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderId: tender.id,
          sessionData: {
            verdictData,
            snippetDrops,
            agentAnalyses,
            duration: Math.floor((Date.now() - sessionStartTime) / 1000),
            savedAt: new Date().toISOString(),
          },
        }),
      });
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [verdictData, snippetDrops, agentAnalyses, tender.id, sessionStartTime]);

  // Session history fetch
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/ai/ihale-masasi/session/${tender.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) setSessions(data.sessions);
    } catch {
      // silently fail
    }
  }, [tender.id]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // First close document expanded if open
        if (documentExpanded) {
          setDocumentExpanded(false);
          e.stopPropagation();
          return;
        }
        // Then close compare overlay if open
        if (orbit.compareNodes) {
          orbit.endCompare();
          e.stopPropagation();
          return;
        }
        // Then close orbit detail if open
        if (orbit.detailState.attachmentId || orbit.detailState.mode === 'create') {
          orbit.closeDetail();
          e.stopPropagation();
          return;
        }
        if (viewMode === 'FOCUS') {
          handleBackToOrbit();
          e.stopPropagation();
        } else if (viewMode === 'ASSEMBLE') {
          handleReset();
          e.stopPropagation();
        }
      }
      if (e.key === 'Backspace' && viewMode === 'FOCUS') {
        handleBackToOrbit();
      }
    },
    [viewMode, handleBackToOrbit, handleReset, orbit, documentExpanded]
  );

  useEffect(() => {
    if (opened) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [opened, handleKeyDown]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton={false}
      padding={0}
      styles={{
        content: {
          background: '#0a0a14',
          overflow: 'hidden',
        },
        body: {
          height: '100%',
          padding: 0,
        },
      }}
      transitionProps={{ transition: 'fade', duration: 300 }}
    >
      <Box
        style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        {/* Stage Background */}
        <StageBackground viewMode={viewMode} />

        {/* Header */}
        <Box
          p="sm"
          px="lg"
          style={{
            position: 'relative',
            zIndex: 10,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(10,10,20,0.6)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Group justify="space-between" align="center">
            <div>
              <Group gap="sm" align="center">
                <Text size="sm" fw={700} c="white">
                  Sanal Ihale Masasi
                </Text>
                {daysLeft !== null && (
                  <Badge
                    size="sm"
                    variant="light"
                    color={daysLeft <= 3 ? 'red' : daysLeft <= 7 ? 'yellow' : 'green'}
                    leftSection={<IconClock size={12} />}
                  >
                    {daysLeft <= 0 ? 'Sure Doldu' : `${daysLeft} gun kaldi`}
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {tender.ihale_basligi}
              </Text>
            </div>
            <Group gap="xs">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={<IconDeviceFloppy size={14} />}
                loading={saving}
                onClick={handleSaveSession}
              >
                Kaydet
              </Button>
              <Menu shadow="md" width={280} position="bottom-end" onOpen={fetchSessions}>
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" size="lg">
                    <IconHistory size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Gecmis Oturumlar</Menu.Label>
                  {sessions.length === 0 && <Menu.Item disabled>Henuz kayit yok</Menu.Item>}
                  {sessions.slice(0, 5).map((s) => {
                    const sd = s.session_data;
                    const date = new Date(s.created_at).toLocaleDateString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const score = sd?.verdictData?.overallScore;
                    return (
                      <Menu.Item key={s.id} disabled>
                        <Group justify="space-between" w="100%">
                          <Stack gap={0}>
                            <Text size="xs" fw={500}>
                              {date}
                            </Text>
                            <Text size="10px" c="dimmed">
                              {sd?.duration
                                ? `${Math.floor(sd.duration / 60)}dk ${sd.duration % 60}sn`
                                : ''}
                            </Text>
                          </Stack>
                          {score !== undefined && score !== null && (
                            <Badge
                              size="sm"
                              color={score >= 70 ? 'green' : score >= 45 ? 'yellow' : 'red'}
                            >
                              {score}
                            </Badge>
                          )}
                        </Group>
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>
              <ActionIcon variant="subtle" color="gray" onClick={onClose} size="lg">
                <IconX size={18} />
              </ActionIcon>
            </Group>
          </Group>
        </Box>

        {/* Stage Content */}
        <Box style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {isMobile ? (
            <MobileLayout
              tender={tender}
              agents={agents}
              viewMode={viewMode}
              agentAnalyses={agentAnalyses}
              agentHighlights={agentHighlights}
              crossReferences={crossReferences}
              focusedAgent={focusedAgent}
              focusedAnalysis={focusedAnalysis}
              verdictData={verdictData}
              snippetDrops={snippetDrops}
              onAgentClick={handleAgentClick}
              onBackToOrbit={handleBackToOrbit}
              onAssemble={handleAssemble}
              onReset={handleReset}
              onSnippetDrop={handleSnippetDrop}
              onSendToAgent={handleSendToAgent}
              onBroadcast={handleBroadcast}
              onReanalyze={reanalyzeAgent}
            />
          ) : (
            <DesktopLayout
              tender={tender}
              agents={agents}
              viewMode={viewMode}
              agentAnalyses={agentAnalyses}
              agentHighlights={agentHighlights}
              crossReferences={crossReferences}
              focusedAgent={focusedAgent}
              focusedAnalysis={focusedAnalysis}
              verdictData={verdictData}
              snippetDrops={snippetDrops}
              orbit={orbit}
              daysLeft={daysLeft}
              documentExpanded={documentExpanded}
              onExpandDocument={() => setDocumentExpanded(true)}
              onCollapseDocument={() => setDocumentExpanded(false)}
              onToolComplete={handleToolComplete}
              onAgentClick={handleAgentClick}
              onBackToOrbit={handleBackToOrbit}
              onAssemble={handleAssemble}
              onReset={handleReset}
              onSnippetDrop={handleSnippetDrop}
              onSendToAgent={handleSendToAgent}
              onBroadcast={handleBroadcast}
              onReanalyze={reanalyzeAgent}
            />
          )}
        </Box>
      </Box>
    </Modal>
  );
}

// ─── Desktop Layout ──────────────────────────────────────────

interface LayoutProps {
  tender: SavedTender;
  agents: AgentPersona[];
  viewMode: ReturnType<typeof useSanalMasa>['viewMode'];
  agentAnalyses: ReturnType<typeof useSanalMasa>['agentAnalyses'];
  agentHighlights: ReturnType<typeof useSanalMasa>['agentHighlights'];
  crossReferences: ReturnType<typeof useSanalMasa>['crossReferences'];
  focusedAgent: ReturnType<typeof useSanalMasa>['focusedAgent'];
  focusedAnalysis: ReturnType<typeof useSanalMasa>['focusedAnalysis'];
  verdictData: ReturnType<typeof useSanalMasa>['verdictData'];
  snippetDrops: ReturnType<typeof useSanalMasa>['snippetDrops'];
  orbit?: ReturnType<typeof useOrbitAttachments>;
  daysLeft?: number | null;
  documentExpanded?: boolean;
  onExpandDocument?: () => void;
  onCollapseDocument?: () => void;
  onToolComplete?: (agentId: string, toolId: string, result: import('./types').ToolResult) => void;
  onAgentClick: (id: string) => void;
  onBackToOrbit: () => void;
  onAssemble: () => void;
  onReset: () => void;
  onSnippetDrop: (agentId: string, text: string) => void;
  onSendToAgent?: (agentId: string, text: string) => void;
  onBroadcast?: (text: string) => void;
  onReanalyze?: (agentId: string) => Promise<void>;
}

function DesktopLayout({
  tender,
  agents,
  viewMode,
  agentAnalyses,
  agentHighlights,
  crossReferences,
  focusedAgent,
  focusedAnalysis,
  verdictData,
  snippetDrops,
  orbit,
  daysLeft,
  onToolComplete,
  onAgentClick,
  onBackToOrbit,
  onAssemble,
  onReset,
  onSnippetDrop,
  onSendToAgent,
  onBroadcast,
  onReanalyze,
  documentExpanded = false,
  onExpandDocument,
  onCollapseDocument,
}: LayoutProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [dragText, setDragText] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Camera shift: determine shift direction based on focused agent side + bottom detection
  const isBottomAgent = focusedAgent ? Boolean(focusedAgent.orbitPosition.bottom) : false;

  const shiftX = focusedAgent ? (focusedAgent.side === 'right' ? -220 : 220) : 0;

  const shiftY = focusedAgent && isBottomAgent ? -100 : 0;

  // Drag & Drop handlers
  const handleDocDragStart = useCallback((text: string) => {
    setDragText(text);
  }, []);

  const handleDocDragEnd = useCallback(() => {
    setDragText(null);
    setDropTargetId(null);
  }, []);

  // Track pointer position during drag for agent proximity detection
  useEffect(() => {
    if (!dragText || !stageRef.current) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!stageRef.current) return;
      const stageRect = stageRef.current.getBoundingClientRect();
      const px = e.clientX - stageRect.left;
      const py = e.clientY - stageRect.top;

      // Find closest agent
      let closest: string | null = null;
      let minDist = 120; // Snap distance threshold
      for (const agent of agents) {
        const el = stageRef.current.querySelector(`[data-node="${agent.id}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2 - stageRect.left;
          const cy = rect.top + rect.height / 2 - stageRect.top;
          const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
          if (dist < minDist) {
            minDist = dist;
            closest = agent.id;
          }
        }
      }
      setDropTargetId(closest);
    };

    const handlePointerUp = () => {
      if (dropTargetId && dragText) {
        onSnippetDrop(dropTargetId, dragText);
      }
      setDragText(null);
      setDropTargetId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [agents, dragText, dropTargetId, onSnippetDrop]);

  return (
    <Box ref={stageRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* SVG Network Lines */}
      <NetworkLines
        viewMode={viewMode}
        focusedAgentId={focusedAgent?.id ?? null}
        agentAnalyses={agentAnalyses}
        stageRef={stageRef}
        crossReferences={crossReferences}
      />

      {/* Camera Shift Wrapper — click backdrop to close FOCUS or documentExpanded */}
      <motion.div
        animate={{
          scale: documentExpanded
            ? 1
            : viewMode === 'FOCUS'
              ? 0.82
              : viewMode === 'ASSEMBLE'
                ? 0.9
                : 1,
          x: viewMode === 'FOCUS' && !documentExpanded ? shiftX : 0,
          y: viewMode === 'FOCUS' && !documentExpanded ? shiftY : 0,
          filter: viewMode === 'FOCUS' && !documentExpanded ? 'brightness(0.7)' : 'brightness(1)',
        }}
        transition={SPRING_CONFIG.gentle}
        onClick={
          documentExpanded ? onCollapseDocument : viewMode === 'FOCUS' ? onBackToOrbit : undefined
        }
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: 'center center',
          cursor: documentExpanded ? 'pointer' : viewMode === 'FOCUS' ? 'pointer' : undefined,
        }}
      >
        {/* Center Document */}
        <motion.div
          data-node="center"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            zIndex: documentExpanded ? 25 : 5,
          }}
          animate={{
            x: '-50%',
            y: '-50%',
            scale: viewMode === 'ASSEMBLE' ? 0.8 : 1,
          }}
          transition={SPRING_CONFIG.gentle}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Propagation stopper for modal backdrop */}
          <div role="presentation" onClick={(e) => e.stopPropagation()}>
            <DocumentViewer
              title={tender.ihale_basligi}
              kurum={tender.kurum}
              bedel={tender.bedel}
              tamMetin={tender.analysis_summary?.tam_metin}
              analysisSummary={tender.analysis_summary}
              agentHighlights={agentHighlights}
              expanded={documentExpanded}
              onExpand={onExpandDocument}
              onCollapse={onCollapseDocument}
              onDragStart={handleDocDragStart}
              onDragEnd={handleDocDragEnd}
              onSendToAgent={
                onSendToAgent as
                  | ((agentId: import('./types').AgentPersona['id'], text: string) => void)
                  | undefined
              }
              onBroadcast={onBroadcast}
            />
          </div>
          {/* Orbit Ring — attachment nodes around center card */}
          {orbit && (
            <OrbitRing
              attachments={orbit.attachments}
              positions={orbit.nodePositions}
              viewMode={viewMode}
              loading={orbit.loading}
              compareFirstId={orbit.compareFirstId}
              onNodeClick={(id, shiftKey) => orbit.handleNodeClick(id, shiftKey)}
              onAddClick={() => orbit.openCreate()}
            />
          )}
          {/* Orbit Detail Overlay — opens on top of center card */}
          {orbit && (
            <OrbitDetailOverlay
              attachment={
                orbit.detailState.attachmentId
                  ? (orbit.attachments.find((a) => a.id === orbit.detailState.attachmentId) ?? null)
                  : null
              }
              mode={orbit.detailState.mode}
              createType={orbit.detailState.createType}
              onSave={orbit.updateAttachment}
              onCreate={orbit.addAttachment}
              onDelete={orbit.deleteAttachment}
              onSaveVirtual={orbit.saveVirtualAttachment}
              onClose={orbit.closeDetail}
              onEdit={orbit.openEdit}
            />
          )}
        </motion.div>

        {/* Agent Cards */}
        {agents.map((agent) => {
          const analysis = agentAnalyses.find((a) => a.agentId === agent.id) ?? {
            agentId: agent.id,
            status: 'no-data' as const,
            findings: [],
            riskScore: 0,
            summary: '',
          };
          const assembleX = agent.assembleOffset.x;
          const assembleY = agent.assembleOffset.y;
          const isDropTarget = dropTargetId === agent.id;
          const agentSnippetCount = snippetDrops.filter((s) => s.agentId === agent.id).length;

          return (
            <motion.div
              key={agent.id}
              data-node={agent.id}
              style={{
                position: 'absolute',
                zIndex: 8,
              }}
              initial={{
                ...agent.orbitPosition,
                opacity: 0,
                scale: 0.8,
              }}
              animate={
                viewMode === 'ASSEMBLE'
                  ? {
                      top: '50%',
                      left: '50%',
                      right: 'auto',
                      bottom: 'auto',
                      x: `calc(-50% + ${assembleX}px)`,
                      y: `calc(-50% + ${assembleY}px)`,
                      opacity: 1,
                      scale: 0.85,
                      filter: 'brightness(1)',
                    }
                  : {
                      ...agent.orbitPosition,
                      right: agent.orbitPosition.right,
                      bottom: agent.orbitPosition.bottom,
                      opacity: documentExpanded ? 0.3 : 1,
                      scale: documentExpanded ? 0.7 : 1,
                      filter: documentExpanded ? 'brightness(0.5)' : 'brightness(1)',
                    }
              }
              transition={{
                ...SPRING_CONFIG.gentle,
                delay: viewMode === 'ASSEMBLE' ? agent.assembleDelay : 0,
              }}
            >
              {/* stopPropagation: prevent backdrop click from closing panel */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: Propagation stopper for modal backdrop */}
              <div role="presentation" onClick={(e) => e.stopPropagation()}>
                <AgentCard
                  agent={agent}
                  analysis={analysis}
                  viewMode={viewMode}
                  isDropTarget={isDropTarget}
                  snippetCount={agentSnippetCount}
                  onClick={() => onAgentClick(agent.id)}
                />
              </div>
            </motion.div>
          );
        })}

        {/* ORBIT: Assemble Button */}
        {viewMode === 'ORBIT' && !documentExpanded && (
          <Box
            style={{
              position: 'absolute',
              bottom: 40,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <AssembleButton onClick={onAssemble} />
          </Box>
        )}
      </motion.div>

      {/* FOCUS: Floating Detail Panel — full-height rail (Railway style) */}
      <AnimatePresence>
        {viewMode === 'FOCUS' && focusedAgent && focusedAnalysis && (
          <motion.div
            key="detail-panel"
            initial={{ opacity: 0, x: focusedAgent.side === 'right' ? 80 : -80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: focusedAgent.side === 'right' ? 80 : -80 }}
            transition={SPRING_CONFIG.stiff}
            style={{
              position: 'absolute',
              top: 16,
              bottom: 16,
              ...(focusedAgent.side === 'right' ? { right: 24 } : { left: 24 }),
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <AgentDetailPanel
              agent={focusedAgent}
              analysis={focusedAnalysis}
              snippetDrops={snippetDrops}
              tenderId={tender?.tender_id ?? Number(tender?.id) ?? 0}
              analysisContext={(tender?.analysis_summary ?? {}) as Record<string, unknown>}
              daysLeft={daysLeft}
              onBack={onBackToOrbit}
              onToolComplete={onToolComplete}
              onReanalyze={onReanalyze}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ASSEMBLE: Verdict Report */}
      <AnimatePresence>
        {viewMode === 'ASSEMBLE' && verdictData && (
          <VerdictReport data={verdictData} crossReferences={crossReferences} onReset={onReset} />
        )}
      </AnimatePresence>

      {/* Compare Overlay */}
      <AnimatePresence>
        {orbit?.compareNodes &&
          (() => {
            const [compareIdA, compareIdB] = orbit.compareNodes;
            const nodeA = orbit.attachments.find((a) => a.id === compareIdA);
            const nodeB = orbit.attachments.find((a) => a.id === compareIdB);
            if (!nodeA || !nodeB) return null;
            return <CompareOverlay nodeA={nodeA} nodeB={nodeB} onClose={orbit.endCompare} />;
          })()}
      </AnimatePresence>

      {/* Drag ghost indicator */}
      {dragText && (
        <Box className="drag-active-overlay">
          <Text size="xs" c="white" fw={600}>
            Bir ajana birak
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ─── Mobile Layout ───────────────────────────────────────────

function MobileLayout({
  tender,
  agents,
  viewMode,
  agentAnalyses,
  crossReferences,
  focusedAgent,
  focusedAnalysis,
  verdictData,
  snippetDrops,
  onAgentClick,
  onBackToOrbit,
  onAssemble,
  onReset,
  onReanalyze,
}: LayoutProps) {
  return (
    <Box
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 16,
      }}
    >
      {/* Document - top area */}
      <motion.div
        animate={{
          scale: viewMode === 'ASSEMBLE' ? 0.7 : 1,
          opacity: viewMode === 'FOCUS' ? 0.3 : 1,
        }}
        transition={SPRING_CONFIG.gentle}
        style={{ zIndex: 5 }}
      >
        <TenderDocumentCard
          title={tender.ihale_basligi}
          kurum={tender.kurum}
          bedel={tender.bedel}
        />
      </motion.div>

      {/* Agents - bottom arc */}
      <AnimatePresence>
        {viewMode !== 'FOCUS' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              flexWrap: 'wrap',
              zIndex: 8,
            }}
          >
            {agents.map((agent) => {
              const analysis = agentAnalyses.find((a) => a.agentId === agent.id) ?? {
                agentId: agent.id,
                status: 'no-data' as const,
                findings: [],
                riskScore: 0,
                summary: '',
              };
              return (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  analysis={analysis}
                  viewMode={viewMode}
                  isMobile
                  onClick={() => onAgentClick(agent.id)}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ORBIT: Assemble Button */}
      {viewMode === 'ORBIT' && (
        <Box style={{ zIndex: 10 }}>
          <AssembleButton onClick={onAssemble} />
        </Box>
      )}

      {/* FOCUS: Agent Detail Panel */}
      <AnimatePresence>
        {viewMode === 'FOCUS' && focusedAgent && focusedAnalysis && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING_CONFIG.gentle}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 15,
            }}
          >
            <AgentDetailPanel
              agent={focusedAgent}
              analysis={focusedAnalysis}
              snippetDrops={snippetDrops}
              tenderId={tender?.tender_id ?? Number(tender?.id) ?? 0}
              analysisContext={(tender?.analysis_summary ?? {}) as Record<string, unknown>}
              onBack={onBackToOrbit}
              onReanalyze={onReanalyze}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ASSEMBLE: Verdict Report */}
      <AnimatePresence>
        {viewMode === 'ASSEMBLE' && verdictData && (
          <VerdictReport data={verdictData} crossReferences={crossReferences} onReset={onReset} />
        )}
      </AnimatePresence>
    </Box>
  );
}
