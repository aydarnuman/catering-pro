'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBrain,
  IconChevronRight,
  IconDeviceFloppy,
  IconFile,
  IconFileText,
  IconLink,
  IconMathFunction,
  IconNote,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconUser,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import { ATTACHMENT_TYPE_MAP, SPRING_CONFIG } from '../constants';
import type { AgentPersona, AttachmentType, OrbitAttachment, ViewMode } from '../types';

// ─── Icon mapping ─────────────────────────────────────

const TYPE_ICONS: Record<AttachmentType, typeof IconNote> = {
  note: IconNote,
  document: IconFileText,
  petition: IconFile,
  ai_report: IconBrain,
  link: IconLink,
  contact: IconUser,
  calculation: IconMathFunction,
};

const AGENT_COLORS: Record<AgentPersona['id'], string> = {
  mevzuat: '#6366f1',
  maliyet: '#10b981',
  teknik: '#f59e0b',
  rekabet: '#f43f5e',
};

const AGENT_LABELS: Record<AgentPersona['id'], string> = {
  mevzuat: 'Mevzuat',
  maliyet: 'Maliyet',
  teknik: 'Teknik',
  rekabet: 'Rekabet',
};

// ─── Component ────────────────────────────────────────

interface AttachmentPanelProps {
  attachments: OrbitAttachment[];
  loading: boolean;
  viewMode: ViewMode;
  /** When in FOCUS mode, auto-filter to this agent */
  focusedAgentId?: string | null;
  onItemClick: (id: string) => void;
  onAddClick: () => void;
  onSaveVirtual?: (id: string) => Promise<void>;
}

export function AttachmentPanel({
  attachments,
  loading,
  viewMode,
  focusedAgentId,
  onItemClick,
  onAddClick,
  onSaveVirtual,
}: AttachmentPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<AttachmentType | 'all'>('all');
  const [filterAgent, setFilterAgent] = useState<AgentPersona['id'] | 'all' | 'general'>('all');

  // In FOCUS mode, override agent filter to focused agent
  const effectiveAgentFilter =
    viewMode === 'FOCUS' && focusedAgentId ? (focusedAgentId as AgentPersona['id']) : filterAgent;

  // Filter attachments
  const filteredAttachments = useMemo(() => {
    let result = [...attachments];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          (a.sourceAgent && AGENT_LABELS[a.sourceAgent]?.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter((a) => a.type === filterType);
    }

    // Agent filter
    if (effectiveAgentFilter === 'general') {
      result = result.filter((a) => !a.sourceAgent);
    } else if (effectiveAgentFilter !== 'all') {
      // Show agent-specific + general items (same logic as old AgentRingSidebar)
      result = result.filter((a) => a.sourceAgent === effectiveAgentFilter || !a.sourceAgent);
    }

    // Sort: pinned first, then by date
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [attachments, searchQuery, filterType, effectiveAgentFilter]);

  // Agent filter counts
  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: attachments.length, general: 0 };
    for (const a of attachments) {
      if (a.sourceAgent) {
        counts[a.sourceAgent] = (counts[a.sourceAgent] || 0) + 1;
      } else {
        counts.general += 1;
      }
    }
    return counts;
  }, [attachments]);

  // Type filter options
  const typeOptions = useMemo(() => {
    const counts: Record<string, number> = { all: attachments.length };
    for (const a of attachments) {
      counts[a.type] = (counts[a.type] || 0) + 1;
    }
    return counts;
  }, [attachments]);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // ── Collapsed state ──
  if (!isExpanded) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={SPRING_CONFIG.gentle}
        style={{
          position: 'absolute',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 15,
        }}
      >
        <Tooltip label={`Eklentiler (${attachments.length})`} position="left" withArrow>
          <ActionIcon
            variant="light"
            color="gray"
            size="xl"
            radius="xl"
            onClick={handleToggle}
            style={{
              background: 'rgba(30, 30, 50, 0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Group gap={2}>
              <IconPaperclip size={18} />
              {attachments.length > 0 && (
                <Badge
                  size="xs"
                  variant="filled"
                  color="blue"
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    padding: '0 4px',
                  }}
                >
                  {attachments.length}
                </Badge>
              )}
            </Group>
          </ActionIcon>
        </Tooltip>
      </motion.div>
    );
  }

  // ── Expanded panel ──
  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={SPRING_CONFIG.gentle}
      style={{
        position: 'absolute',
        right: 16,
        top: 16,
        bottom: 16,
        width: 320,
        zIndex: 15,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(20, 20, 35, 0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          backdropFilter: 'blur(16px)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          p="sm"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconPaperclip size={16} color="rgba(255,255,255,0.5)" />
              <Text size="sm" fw={600} c="white">
                Eklentiler ({attachments.length})
              </Text>
              {viewMode === 'FOCUS' && focusedAgentId && (
                <Badge
                  size="xs"
                  variant="dot"
                  color={
                    AGENT_COLORS[focusedAgentId as AgentPersona['id']] === '#6366f1'
                      ? 'indigo'
                      : AGENT_COLORS[focusedAgentId as AgentPersona['id']] === '#10b981'
                        ? 'green'
                        : AGENT_COLORS[focusedAgentId as AgentPersona['id']] === '#f59e0b'
                          ? 'yellow'
                          : 'pink'
                  }
                >
                  {AGENT_LABELS[focusedAgentId as AgentPersona['id']] || focusedAgentId}
                </Badge>
              )}
            </Group>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleToggle}>
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>

          {/* Search */}
          <TextInput
            placeholder="Ara..."
            size="xs"
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            styles={{
              input: {
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
              },
            }}
          />

          {/* Type filter pills */}
          <ScrollArea type="never" mt="xs">
            <Group gap={4} wrap="nowrap">
              <FilterPill
                label="Tumu"
                count={typeOptions.all || 0}
                active={filterType === 'all'}
                onClick={() => setFilterType('all')}
              />
              {Object.entries(typeOptions)
                .filter(([k]) => k !== 'all')
                .map(([type, count]) => {
                  const config = ATTACHMENT_TYPE_MAP[type];
                  return (
                    <FilterPill
                      key={type}
                      label={config?.label || type}
                      count={count}
                      color={config?.color}
                      active={filterType === type}
                      onClick={() => setFilterType(type as AttachmentType)}
                    />
                  );
                })}
            </Group>
          </ScrollArea>

          {/* Agent filter pills — hidden when FOCUS mode auto-filters */}
          {!(viewMode === 'FOCUS' && focusedAgentId) && (
            <ScrollArea type="never" mt={6}>
              <Group gap={4} wrap="nowrap">
                <FilterPill
                  label="Tumu"
                  count={agentCounts.all || 0}
                  active={filterAgent === 'all'}
                  onClick={() => setFilterAgent('all')}
                />
                {(['mevzuat', 'maliyet', 'teknik', 'rekabet'] as const).map((agentId) => (
                  <FilterPill
                    key={agentId}
                    label={AGENT_LABELS[agentId]}
                    count={agentCounts[agentId] || 0}
                    color={AGENT_COLORS[agentId]}
                    active={filterAgent === agentId}
                    onClick={() => setFilterAgent(agentId)}
                  />
                ))}
                <FilterPill
                  label="Genel"
                  count={agentCounts.general || 0}
                  active={filterAgent === 'general'}
                  onClick={() => setFilterAgent('general')}
                />
              </Group>
            </ScrollArea>
          )}
        </Box>

        {/* List */}
        <ScrollArea style={{ flex: 1 }} type="hover" offsetScrollbars>
          <Stack gap={0} p="xs">
            {loading ? (
              <Text size="xs" c="dimmed" ta="center" py="xl">
                Yukleniyor...
              </Text>
            ) : filteredAttachments.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="xl">
                {searchQuery || filterType !== 'all' ? 'Sonuc bulunamadi' : 'Henuz eklenti yok'}
              </Text>
            ) : (
              filteredAttachments.map((attachment) => (
                <AttachmentListItem
                  key={attachment.id}
                  attachment={attachment}
                  onClick={() => onItemClick(attachment.id)}
                  onSaveVirtual={onSaveVirtual}
                />
              ))
            )}
          </Stack>
        </ScrollArea>

        {/* Footer */}
        <Box
          p="xs"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Button
            variant="light"
            color="blue"
            size="xs"
            fullWidth
            leftSection={<IconPlus size={14} />}
            onClick={onAddClick}
          >
            Yeni Ekle
          </Button>
        </Box>
      </Box>
    </motion.div>
  );
}

// ─── Filter Pill Component ─────────────────────────────────

interface FilterPillProps {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}

function FilterPill({ label, count, color, active, onClick }: FilterPillProps) {
  const isHexColor = color?.startsWith('#');
  const bgActive = color
    ? isHexColor
      ? `${color}40`
      : `var(--mantine-color-${color}-filled)`
    : 'rgba(59, 130, 246, 0.3)';
  const borderActive = isHexColor ? `1px solid ${color}` : 'none';

  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        padding: '4px 8px',
        borderRadius: 12,
        background: active ? bgActive : 'rgba(255,255,255,0.05)',
        border: active ? borderActive : '1px solid rgba(255,255,255,0.1)',
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
    >
      <Group gap={4} wrap="nowrap">
        <Text size="10px" fw={500} c={active ? 'white' : 'dimmed'}>
          {label}
        </Text>
        <Text size="9px" c={active ? 'white' : 'dimmed'} opacity={0.7}>
          {count}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

// ─── List Item Component ─────────────────────────────────

interface AttachmentListItemProps {
  attachment: OrbitAttachment;
  onClick: () => void;
  onSaveVirtual?: (id: string) => Promise<void>;
}

function AttachmentListItem({ attachment, onClick, onSaveVirtual }: AttachmentListItemProps) {
  const TypeIcon = TYPE_ICONS[attachment.type] || IconNote;
  const config = ATTACHMENT_TYPE_MAP[attachment.type];
  const agentColor = attachment.sourceAgent ? AGENT_COLORS[attachment.sourceAgent] : undefined;
  const [saving, setSaving] = useState(false);

  const dateStr = useMemo(() => {
    const d = new Date(attachment.updatedAt || attachment.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Dun';
    if (diffDays < 7) return `${diffDays} gun once`;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  }, [attachment.updatedAt, attachment.createdAt]);

  const preview = useMemo(() => {
    const text = attachment.content.replace(/[#*_`]/g, '').trim();
    return text.length > 60 ? `${text.slice(0, 60)}...` : text;
  }, [attachment.content]);

  const handleSaveVirtual = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onSaveVirtual) return;
      setSaving(true);
      await onSaveVirtual(attachment.id);
      setSaving(false);
    },
    [onSaveVirtual, attachment.id]
  );

  return (
    <Box
      component="div"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        display: 'block',
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        background: 'transparent',
        transition: 'background 0.15s ease',
        position: 'relative',
        cursor: 'pointer',
      }}
      className="ring-list-item"
    >
      <Group gap="sm" align="flex-start" wrap="nowrap">
        {/* Type icon */}
        <Box
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `var(--mantine-color-${config?.color || 'gray'}-light)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <TypeIcon size={16} />
        </Box>

        {/* Content */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" justify="space-between" wrap="nowrap">
            <Text size="xs" fw={600} c="white" lineClamp={1} style={{ flex: 1 }}>
              {attachment.title || 'Baslıksız'}
            </Text>
            <Text size="10px" c="dimmed" style={{ flexShrink: 0 }}>
              {dateStr}
            </Text>
          </Group>

          {preview && (
            <Text size="10px" c="dimmed" lineClamp={2} mt={2}>
              {preview}
            </Text>
          )}

          {/* Meta badges */}
          <Group gap={4} mt={4}>
            {attachment.virtual && onSaveVirtual && (
              <Tooltip label="Veritabanina kaydet" position="top" withArrow>
                <ActionIcon
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'green' }}
                  size="xs"
                  loading={saving}
                  onClick={handleSaveVirtual}
                  style={{ borderRadius: 6 }}
                >
                  <IconDeviceFloppy size={12} />
                </ActionIcon>
              </Tooltip>
            )}
            {attachment.virtual && (
              <Badge size="xs" variant="light" color="cyan" styles={{ root: { textTransform: 'none', fontSize: 9 } }}>
                Taslak
              </Badge>
            )}
            {attachment.sourceAgent && (
              <Badge
                size="xs"
                variant="dot"
                styles={{
                  root: {
                    background: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    textTransform: 'none',
                  },
                }}
                color={
                  agentColor === '#6366f1'
                    ? 'indigo'
                    : agentColor === '#10b981'
                      ? 'green'
                      : agentColor === '#f59e0b'
                        ? 'yellow'
                        : 'pink'
                }
              >
                {AGENT_LABELS[attachment.sourceAgent]}
              </Badge>
            )}
            {attachment.pinned && (
              <Badge size="xs" variant="light" color="yellow" styles={{ root: { textTransform: 'none' } }}>
                Sabitli
              </Badge>
            )}
            {attachment.files && attachment.files.length > 0 && (
              <Badge size="xs" variant="light" color="blue" styles={{ root: { textTransform: 'none' } }}>
                {attachment.files.length} dosya
              </Badge>
            )}
          </Group>
        </Box>
      </Group>
    </Box>
  );
}
