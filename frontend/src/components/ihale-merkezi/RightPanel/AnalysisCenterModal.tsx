'use client';

import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
  Transition,
} from '@mantine/core';
import {
  IconBrain,
  IconCards,
  IconChevronUp,
  IconEye,
  IconNote,
  IconSearch,
  IconSend,
  IconSparkles,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import type { TenderCard } from '@/hooks/useTenderCards';
import { type AnalysisCardType, AnalysisDetailModal } from '../CenterPanel/cards/AnalysisDetailModal';
import type { AnalysisData } from '../types';

// ─── Types ────────────────────────────────────────────────────

export interface AnalysisCenterModalProps {
  opened: boolean;
  onClose: () => void;
  // AI Analiz
  analysisSummary?: AnalysisData;
  tenderId?: number;
  // Özel Kartlar
  tenderCards: TenderCard[];
  onCardClick?: (card: TenderCard) => void;
  onCardDelete?: (id: number) => void;
  // Notlar
  notes: Array<{ id: string; text: string; source?: string; createdAt: string }>;
  onNoteDelete?: (id: string) => void;
  // Seçim
  selectedAnalysisCards: Set<string>;
  selectedUserCards: Set<number>;
  selectedNotes: Set<string>;
  onToggleAnalysisCard: (path: string) => void;
  onToggleUserCard: (id: number) => void;
  onToggleNote: (id: string) => void;
  // Masaya gönder
  onSendToMasa?: (data: { analysisCards: string[]; userCards: number[]; notes: string[] }) => void;
  isSendingToMasa?: boolean;
  // Çapraz analiz
  onCrossAnalysis?: () => void;
  crossAnalysisResult?: string;
  isCrossAnalyzing?: boolean;
  // Analiz kartı kaydetme
  onAnalysisSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
}

type TabValue = 'all' | 'analysis' | 'cards' | 'notes';

// ─── Card Type Labels ─────────────────────────────────────────

const analysisCardLabels: Record<string, { label: string; icon: string; color: string }> = {
  // Operasyonel
  takvim: { label: 'Takvim', icon: '📅', color: 'blue' },
  personel_detaylari: { label: 'Personel Detayları', icon: '👥', color: 'cyan' },
  ogun_bilgileri: { label: 'Öğün Bilgileri', icon: '🍽️', color: 'orange' },
  servis_noktalari: { label: 'Servis Noktaları', icon: '📍', color: 'teal' },
  catering_detaylari: { label: 'Catering Detayları', icon: '🍴', color: 'lime' },
  // Mali
  mali_kriterler: { label: 'Mali Kriterler', icon: '💰', color: 'green' },
  teminat_oranlari: { label: 'Teminat Oranları', icon: '🔒', color: 'yellow' },
  birim_fiyatlar: { label: 'Birim Fiyatlar', icon: '💵', color: 'emerald' },
  ceza_kosullari: { label: 'Ceza Koşulları', icon: '⚠️', color: 'red' },
  // Teknik
  teknik_sartlar: { label: 'Teknik Şartlar', icon: '📋', color: 'violet' },
  onemli_notlar: { label: 'Önemli Notlar', icon: '📝', color: 'pink' },
  diger_detaylar: { label: 'Diğer Detaylar', icon: '📎', color: 'gray' },
  // Belgeler
  istenen_belgeler: { label: 'İstenen Belgeler', icon: '📄', color: 'indigo' },
  eksik_bilgiler: { label: 'Eksik Bilgiler', icon: '❓', color: 'red' },
};

// ─── Helpers ──────────────────────────────────────────────────

function getCardMeta(cardType: string) {
  return analysisCardLabels[cardType] || { label: cardType, icon: '📊', color: 'gray' };
}

function formatCardContent(data: unknown): string {
  if (!data) return 'Veri yok';
  if (typeof data === 'string') return data.length > 100 ? `${data.slice(0, 100)}...` : data;
  if (typeof data === 'number') return String(data);
  if (Array.isArray(data)) return `${data.length} öğe`;
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    return `${keys.length} alan`;
  }
  return 'Veri mevcut';
}

function getCardStatus(data: unknown): 'complete' | 'warning' | 'empty' {
  if (!data) return 'empty';
  if (typeof data === 'object' && data !== null) {
    const values = Object.values(data);
    const hasEmpty = values.some((v) => v === null || v === undefined || v === '');
    if (hasEmpty) return 'warning';
  }
  return 'complete';
}

// ─── SelectableCard Component ─────────────────────────────────

interface SelectableCardProps {
  id: string | number;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  status: 'complete' | 'warning' | 'empty';
  isSelected: boolean;
  onToggle: () => void;
  onClick?: () => void;
  onDelete?: () => void;
}

function SelectableCard({
  title,
  subtitle,
  icon,
  color: _color,
  status,
  isSelected,
  onToggle,
  onClick,
  onDelete,
}: SelectableCardProps) {
  // Subtle, professional status indicators
  const statusConfig = {
    complete: { color: 'teal', text: 'Tamam', opacity: 0.7 },
    warning: { color: 'orange', text: 'Uyarı', opacity: 0.7 },
    empty: { color: 'gray', text: 'Eksik', opacity: 0.5 },
  };

  return (
    <Paper
      p="md"
      radius="sm"
      onClick={onToggle}
      style={{
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s ease-out',
        // Gömülü (inset) efekti - seçildiğinde hafif basılmış his
        border: '1px solid',
        borderColor: isSelected ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.12)',
        background: isSelected
          ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)'
          : 'rgba(30, 41, 59, 0.4)',
        boxShadow: isSelected
          ? 'inset 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(0, 0, 0, 0.3)'
          : '0 1px 3px rgba(0, 0, 0, 0.1)',
        // Seçili olmayan kartlar hafif yukarı, seçili olanlar "basılmış"
        transform: isSelected ? 'translateY(1px)' : 'translateY(0)',
      }}
    >
      {/* Sol kenar indicator - subtle accent */}
      <Box
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: isSelected ? '60%' : '0%',
          background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.8) 0%, rgba(139, 92, 246, 0.6) 100%)',
          borderRadius: '0 2px 2px 0',
          transition: 'height 0.2s ease-out',
        }}
      />

      {/* Header */}
      <Group justify="space-between" mb={8} wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text
            size="md"
            style={{
              opacity: isSelected ? 1 : 0.7,
              transition: 'opacity 0.15s',
            }}
          >
            {icon}
          </Text>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text
              size="sm"
              fw={500}
              lineClamp={1}
              style={{
                color: isSelected ? 'var(--mantine-color-gray-1)' : 'var(--mantine-color-gray-4)',
                transition: 'color 0.15s',
              }}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                size="xs"
                lineClamp={1}
                style={{
                  color: 'var(--mantine-color-gray-6)',
                  marginTop: 2,
                }}
              >
                {subtitle}
              </Text>
            )}
          </Box>
        </Group>

        {/* Status - minimal dot indicator */}
        <Box
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: `var(--mantine-color-${statusConfig[status].color}-6)`,
            opacity: statusConfig[status].opacity,
            flexShrink: 0,
          }}
          title={statusConfig[status].text}
        />
      </Group>

      {/* Actions - more subtle */}
      <Group gap={6} mt="sm" onClick={(e) => e.stopPropagation()}>
        {onClick && (
          <Button
            variant="subtle"
            size="compact-xs"
            color="gray"
            leftSection={<IconEye size={12} />}
            onClick={onClick}
            styles={{
              root: {
                color: 'var(--mantine-color-gray-5)',
                '&:hover': {
                  color: 'var(--mantine-color-gray-3)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
              },
            }}
          >
            Detay
          </Button>
        )}
        {onDelete && (
          <Tooltip label="Sil" withArrow position="top">
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onDelete} style={{ opacity: 0.5 }}>
              <IconTrash size={12} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Paper>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function AnalysisCenterModal({
  opened,
  onClose,
  analysisSummary,
  tenderId,
  tenderCards,
  onCardClick,
  onCardDelete,
  notes,
  onNoteDelete,
  selectedAnalysisCards,
  selectedUserCards,
  selectedNotes,
  onToggleAnalysisCard,
  onToggleUserCard,
  onToggleNote,
  onSendToMasa,
  isSendingToMasa,
  onCrossAnalysis,
  crossAnalysisResult,
  isCrossAnalyzing,
  onAnalysisSave,
}: AnalysisCenterModalProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCrossAnalysis, setShowCrossAnalysis] = useState(false);

  // ─── Detay Modal State ─────────────────────────────────────
  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [selectedAnalysisCardForDetail, setSelectedAnalysisCardForDetail] = useState<{
    cardType: AnalysisCardType;
    data: unknown;
    title: string;
    icon: string;
    color: string;
  } | null>(null);

  const handleOpenAnalysisCardDetail = useCallback(
    (cardType: AnalysisCardType, data: unknown, title: string, icon: string, color: string) => {
      setSelectedAnalysisCardForDetail({ cardType, data, title, icon, color });
      setDetailModalOpened(true);
    },
    []
  );

  // ─── Computed Values ────────────────────────────────────────

  const analysisCards = useMemo(() => {
    if (!analysisSummary) return [];

    const cards: Array<{
      path: string;
      type: AnalysisCardType;
      data: unknown;
      category: 'operasyonel' | 'mali' | 'teknik' | 'belgeler';
    }> = [];

    // Operasyonel
    const opFields = ['takvim', 'personel_detaylari', 'ogun_bilgileri', 'servis_noktalari', 'catering_detaylari'];
    for (const field of opFields) {
      const data = (analysisSummary as Record<string, unknown>)[field];
      if (data) cards.push({ path: field, type: field as AnalysisCardType, data, category: 'operasyonel' });
    }

    // Mali
    const maliFields = ['mali_kriterler', 'teminat_oranlari', 'birim_fiyatlar', 'ceza_kosullari'];
    for (const field of maliFields) {
      const data = (analysisSummary as Record<string, unknown>)[field];
      if (data) cards.push({ path: field, type: field as AnalysisCardType, data, category: 'mali' });
    }

    // Teknik
    const teknikFields = ['teknik_sartlar', 'onemli_notlar', 'diger_detaylar'];
    for (const field of teknikFields) {
      const data = (analysisSummary as Record<string, unknown>)[field];
      if (data) cards.push({ path: field, type: field as AnalysisCardType, data, category: 'teknik' });
    }

    // Belgeler
    const belgeFields = ['istenen_belgeler', 'eksik_bilgiler'];
    for (const field of belgeFields) {
      const data = (analysisSummary as Record<string, unknown>)[field];
      if (data) cards.push({ path: field, type: field as AnalysisCardType, data, category: 'belgeler' });
    }

    return cards;
  }, [analysisSummary]);

  // Filter by search
  const filteredAnalysisCards = useMemo(() => {
    if (!searchQuery) return analysisCards;
    const q = searchQuery.toLowerCase();
    return analysisCards.filter((c) => {
      const meta = getCardMeta(c.type);
      return meta.label.toLowerCase().includes(q);
    });
  }, [analysisCards, searchQuery]);

  const filteredUserCards = useMemo(() => {
    if (!searchQuery) return tenderCards;
    const q = searchQuery.toLowerCase();
    return tenderCards.filter((c) => c.title.toLowerCase().includes(q));
  }, [tenderCards, searchQuery]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter((n) => n.text.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  // Counts
  const totalSelected = selectedAnalysisCards.size + selectedUserCards.size + selectedNotes.size;
  const totalItems = analysisCards.length + tenderCards.length + notes.length;

  // Stats
  const stats = useMemo(() => {
    let complete = 0;
    let warning = 0;
    let empty = 0;

    for (const card of analysisCards) {
      const status = getCardStatus(card.data);
      if (status === 'complete') complete++;
      else if (status === 'warning') warning++;
      else empty++;
    }

    return { complete, warning, empty };
  }, [analysisCards]);

  // ─── Handlers ───────────────────────────────────────────────

  const handleSelectAll = useCallback(() => {
    // Select all visible items based on active tab
    for (const card of filteredAnalysisCards) {
      if (!selectedAnalysisCards.has(card.path)) {
        onToggleAnalysisCard(card.path);
      }
    }
    for (const card of filteredUserCards) {
      if (!selectedUserCards.has(card.id)) {
        onToggleUserCard(card.id);
      }
    }
    for (const note of filteredNotes) {
      if (!selectedNotes.has(note.id)) {
        onToggleNote(note.id);
      }
    }
  }, [
    filteredAnalysisCards,
    filteredUserCards,
    filteredNotes,
    selectedAnalysisCards,
    selectedUserCards,
    selectedNotes,
    onToggleAnalysisCard,
    onToggleUserCard,
    onToggleNote,
  ]);

  const handleDeselectAll = useCallback(() => {
    for (const path of selectedAnalysisCards) {
      onToggleAnalysisCard(path);
    }
    for (const id of selectedUserCards) {
      onToggleUserCard(id);
    }
    for (const id of selectedNotes) {
      onToggleNote(id);
    }
  }, [selectedAnalysisCards, selectedUserCards, selectedNotes, onToggleAnalysisCard, onToggleUserCard, onToggleNote]);

  const handleSendToMasa = useCallback(() => {
    if (!onSendToMasa) return;
    onSendToMasa({
      analysisCards: Array.from(selectedAnalysisCards),
      userCards: Array.from(selectedUserCards),
      notes: Array.from(selectedNotes),
    });
  }, [onSendToMasa, selectedAnalysisCards, selectedUserCards, selectedNotes]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      fullScreen
      radius={0}
      padding={0}
      withCloseButton={false}
      styles={{
        content: {
          background: 'linear-gradient(180deg, rgb(15, 23, 42) 0%, rgb(10, 15, 30) 100%)',
        },
        body: {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <Box
        px="xl"
        py="lg"
        style={{
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, transparent 100%)',
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="md">
            <Box
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconBrain size={20} style={{ color: 'var(--mantine-color-gray-4)' }} />
            </Box>
            <Box>
              <Text size="md" fw={600} c="gray.2">
                Analiz Merkezi
              </Text>
              <Text size="xs" c="gray.6">
                Verileri görüntüle ve masaya gönder
              </Text>
            </Box>
          </Group>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={onClose} style={{ opacity: 0.6 }}>
            <IconX size={18} />
          </ActionIcon>
        </Group>
      </Box>

      {/* ─── Toolbar ────────────────────────────────────────── */}
      <Box
        px="xl"
        py="sm"
        style={{
          borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          {/* Tab Selector */}
          <SegmentedControl
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabValue)}
            size="xs"
            radius="sm"
            styles={{
              root: {
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
              },
              label: {
                color: 'var(--mantine-color-gray-5)',
                fontWeight: 500,
                fontSize: '0.75rem',
              },
              indicator: {
                background: 'rgba(99, 102, 241, 0.2)',
              },
            }}
            data={[
              { label: `Tümü (${totalItems})`, value: 'all' },
              { label: `AI Analiz (${analysisCards.length})`, value: 'analysis' },
              { label: `Özel Kartlar (${tenderCards.length})`, value: 'cards' },
              { label: `Notlar (${notes.length})`, value: 'notes' },
            ]}
          />

          {/* Search */}
          <TextInput
            placeholder="Ara..."
            size="xs"
            leftSection={<IconSearch size={14} style={{ opacity: 0.5 }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ width: 180 }}
            styles={{
              input: {
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                color: 'var(--mantine-color-gray-4)',
                '&::placeholder': {
                  color: 'var(--mantine-color-gray-6)',
                },
              },
            }}
          />
        </Group>
      </Box>

      {/* ─── Stats Bar ──────────────────────────────────────── */}
      <Box
        px="xl"
        py="xs"
        style={{
          borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="lg">
            {/* Minimal status dots with counts */}
            <Group gap="md">
              <Group gap={6}>
                <Box
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'var(--mantine-color-teal-6)',
                    opacity: 0.8,
                  }}
                />
                <Text size="xs" c="gray.5">
                  {stats.complete}
                </Text>
              </Group>
              <Group gap={6}>
                <Box
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'var(--mantine-color-orange-6)',
                    opacity: 0.8,
                  }}
                />
                <Text size="xs" c="gray.5">
                  {stats.warning}
                </Text>
              </Group>
              <Group gap={6}>
                <Box
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'var(--mantine-color-gray-6)',
                    opacity: 0.5,
                  }}
                />
                <Text size="xs" c="gray.6">
                  {stats.empty}
                </Text>
              </Group>
            </Group>

            <Box style={{ width: 1, height: 16, background: 'rgba(148, 163, 184, 0.15)' }} />

            <Text size="xs" c="gray.5">
              <Text span fw={500} c="gray.4">
                {totalSelected}
              </Text>
              {' / '}
              {totalItems} seçili
            </Text>
          </Group>

          <Group gap="sm">
            <Button
              variant="subtle"
              size="compact-xs"
              color="gray"
              onClick={handleSelectAll}
              styles={{
                root: {
                  color: 'var(--mantine-color-gray-5)',
                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                },
              }}
            >
              Tümü
            </Button>
            <Button
              variant="subtle"
              size="compact-xs"
              color="gray"
              onClick={handleDeselectAll}
              styles={{
                root: {
                  color: 'var(--mantine-color-gray-5)',
                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                },
              }}
            >
              Temizle
            </Button>

            <Box style={{ width: 1, height: 16, background: 'rgba(148, 163, 184, 0.15)' }} />

            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<IconSparkles size={12} />}
              onClick={() => {
                setShowCrossAnalysis(!showCrossAnalysis);
                if (onCrossAnalysis && !crossAnalysisResult) {
                  onCrossAnalysis();
                }
              }}
              loading={isCrossAnalyzing}
              styles={{
                root: {
                  color: 'var(--mantine-color-gray-4)',
                  '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' },
                },
              }}
            >
              Çapraz Analiz
            </Button>

            <Button
              variant="filled"
              size="compact-sm"
              leftSection={<IconSend size={12} />}
              onClick={handleSendToMasa}
              loading={isSendingToMasa}
              disabled={totalSelected === 0}
              styles={{
                root: {
                  background: totalSelected > 0 ? 'rgba(99, 102, 241, 0.9)' : 'rgba(99, 102, 241, 0.3)',
                  border: 'none',
                  '&:hover': {
                    background: 'rgba(99, 102, 241, 1)',
                  },
                  '&:disabled': {
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: 'var(--mantine-color-gray-6)',
                  },
                },
              }}
            >
              Gönder ({totalSelected})
            </Button>
          </Group>
        </Group>
      </Box>

      {/* ─── Cross Analysis Result ──────────────────────────── */}
      <Transition mounted={showCrossAnalysis && !!crossAnalysisResult} transition="slide-down">
        {(styles) => (
          <Box
            px="xl"
            py="sm"
            style={{
              ...styles,
              borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
              background: 'rgba(30, 41, 59, 0.5)',
              flexShrink: 0,
            }}
          >
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconSparkles size={16} color="var(--mantine-color-violet-5)" />
                <Text size="sm" fw={600} c="violet">
                  Çapraz Analiz Sonucu
                </Text>
              </Group>
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setShowCrossAnalysis(false)}>
                <IconChevronUp size={14} />
              </ActionIcon>
            </Group>
            <Paper p="sm" radius="md" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {crossAnalysisResult}
              </Text>
            </Paper>
          </Box>
        )}
      </Transition>

      {/* ─── Main Content ───────────────────────────────────── */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        <Box p="xl">
          {/* AI Analiz Cards */}
          {(activeTab === 'all' || activeTab === 'analysis') && filteredAnalysisCards.length > 0 && (
            <Box mb="xl">
              {activeTab === 'all' && (
                <Group gap="sm" mb="lg">
                  <IconBrain size={14} style={{ color: 'var(--mantine-color-gray-5)' }} />
                  <Text size="xs" fw={500} c="gray.5" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
                    AI Analiz
                  </Text>
                  <Text size="xs" c="gray.6">
                    {filteredAnalysisCards.length}
                  </Text>
                </Group>
              )}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
                {filteredAnalysisCards.map((card) => {
                  const meta = getCardMeta(card.type);
                  return (
                    <SelectableCard
                      key={card.path}
                      id={card.path}
                      title={meta.label}
                      subtitle={formatCardContent(card.data)}
                      icon={meta.icon}
                      color={meta.color}
                      status={getCardStatus(card.data)}
                      isSelected={selectedAnalysisCards.has(card.path)}
                      onToggle={() => onToggleAnalysisCard(card.path)}
                      onClick={() =>
                        handleOpenAnalysisCardDetail(card.type, card.data, meta.label, meta.icon, meta.color)
                      }
                    />
                  );
                })}
              </SimpleGrid>
            </Box>
          )}

          {/* Özel Kartlar */}
          {(activeTab === 'all' || activeTab === 'cards') && filteredUserCards.length > 0 && (
            <Box mb="xl">
              {activeTab === 'all' && (
                <Group gap="sm" mb="lg">
                  <IconCards size={14} style={{ color: 'var(--mantine-color-gray-5)' }} />
                  <Text size="xs" fw={500} c="gray.5" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
                    Özel Kartlar
                  </Text>
                  <Text size="xs" c="gray.6">
                    {filteredUserCards.length}
                  </Text>
                </Group>
              )}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
                {filteredUserCards.map((card) => (
                  <SelectableCard
                    key={card.id}
                    id={card.id}
                    title={card.title}
                    subtitle={card.card_type}
                    icon="📋"
                    color="pink"
                    status="complete"
                    isSelected={selectedUserCards.has(card.id)}
                    onToggle={() => onToggleUserCard(card.id)}
                    onClick={() => onCardClick?.(card)}
                    onDelete={() => onCardDelete?.(card.id)}
                  />
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Notlar */}
          {(activeTab === 'all' || activeTab === 'notes') && filteredNotes.length > 0 && (
            <Box mb="xl">
              {activeTab === 'all' && (
                <Group gap="sm" mb="lg">
                  <IconNote size={14} style={{ color: 'var(--mantine-color-gray-5)' }} />
                  <Text size="xs" fw={500} c="gray.5" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
                    Notlar
                  </Text>
                  <Text size="xs" c="gray.6">
                    {filteredNotes.length}
                  </Text>
                </Group>
              )}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
                {filteredNotes.map((note) => (
                  <SelectableCard
                    key={note.id}
                    id={note.id}
                    title={note.text.length > 50 ? `${note.text.slice(0, 50)}...` : note.text}
                    subtitle={note.source || 'Manuel not'}
                    icon="📝"
                    color="teal"
                    status="complete"
                    isSelected={selectedNotes.has(note.id)}
                    onToggle={() => onToggleNote(note.id)}
                    onDelete={() => onNoteDelete?.(note.id)}
                  />
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Empty State */}
          {totalItems === 0 && (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <Box
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: 'rgba(99, 102, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconBrain size={24} style={{ color: 'var(--mantine-color-gray-5)', opacity: 0.6 }} />
                </Box>
                <Text size="sm" c="gray.5">
                  Henüz veri yok
                </Text>
                <Text size="xs" c="gray.6">
                  Dökümanları analiz ettikten sonra kartlar görünecek
                </Text>
              </Stack>
            </Center>
          )}
        </Box>
      </ScrollArea>

      {/* ─── Analysis Detail Modal ────────────────────────────── */}
      {selectedAnalysisCardForDetail && (
        <AnalysisDetailModal
          opened={detailModalOpened}
          onClose={() => {
            setDetailModalOpened(false);
            setTimeout(() => setSelectedAnalysisCardForDetail(null), 200);
          }}
          cardType={selectedAnalysisCardForDetail.cardType}
          data={selectedAnalysisCardForDetail.data}
          title={selectedAnalysisCardForDetail.title}
          icon={<Text size="lg">{selectedAnalysisCardForDetail.icon}</Text>}
          color={selectedAnalysisCardForDetail.color}
          tenderId={tenderId}
          onSave={onAnalysisSave}
        />
      )}
    </Modal>
  );
}
