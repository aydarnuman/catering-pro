'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrain,
  IconCards,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconList,
  IconNote,
  IconPackage,
  IconPlus,
  IconSend,
  IconSparkles,
  IconTable,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAnalysisCorrections } from '@/hooks/useAnalysisCorrections';
import { useCreateMasaPaketi } from '@/hooks/useMasaVeriPaketi';
import type { CreateCardInput, TenderCard } from '@/hooks/useTenderCards';
import { useTenderCards } from '@/hooks/useTenderCards';
import { normalizeAnalysisData } from '../CenterPanel/normalizeAnalysis';
import type { AnalysisData, IhaleMerkeziState, SavedTender } from '../types';
import { filterAnalysisBySelection, getAllAnalysisCardPaths } from '../utils/selection-helpers';
import { AnalysisCenterModal } from './AnalysisCenterModal';
import { CardDetailModal } from './CardRenderers';

// ─── Types ────────────────────────────────────────────────────

interface RightPanelProps {
  state: IhaleMerkeziState;
  onToggleSection?: (sectionId: string) => void;
  onStateChange: (updates: Partial<IhaleMerkeziState>) => void;
  onRefreshData?: () => void;
  selectedText?: string;
  selectedTextDocId?: number;
  mobileActiveTab?: 'tools' | 'notes';
}

interface VeriPaketiNote {
  id: string;
  text: string;
  source?: string;
  documentId?: number;
  createdAt: string;
}

// ─── Main Component ───────────────────────────────────────────

export function RightPanel({
  state,
  onStateChange: _onStateChange,
  onRefreshData: _onRefreshData,
  selectedText,
  selectedTextDocId,
  mobileActiveTab,
}: RightPanelProps) {
  const { selectedTender } = state;
  const router = useRouter();

  const isSavedTender = selectedTender && 'tender_id' in selectedTender;
  const savedTender = isSavedTender ? (selectedTender as SavedTender) : null;
  const tenderId = savedTender?.tender_id ?? null;

  // Masaya gönder mutation
  const { mutateAsync: createMasaPaketi, isPending: isSendingToMasa } = useCreateMasaPaketi();

  // HITL corrections
  const { correctionCount, isConfirmed } = useAnalysisCorrections(tenderId ? Number(tenderId) : null);

  // Custom Cards
  const {
    cards: tenderCards,
    createCard,
    updateCard,
    deleteCard,
    isCreating: isCardCreating,
    isUpdating: isCardUpdating,
  } = useTenderCards(tenderId ? Number(tenderId) : null);

  // AI transform loading
  const [aiTransformLoading, setAiTransformLoading] = useState(false);

  // Card detail modal
  const [detailModalCard, setDetailModalCard] = useState<TenderCard | null>(null);
  const [detailModalOpened, setDetailModalOpened] = useState(false);

  const handleCardClick = useCallback((card: TenderCard) => {
    setDetailModalCard(card);
    setDetailModalOpened(true);
  }, []);

  const handleDetailModalClose = useCallback(() => {
    setDetailModalOpened(false);
    setTimeout(() => setDetailModalCard(null), 200); // Clear after animation
  }, []);

  // ─── Analysis Center Modal (states only - handlers defined after analysisSummary) ─────
  const [analysisCenterOpened, setAnalysisCenterOpened] = useState(false);
  const [crossAnalysisResult, setCrossAnalysisResult] = useState<string | null>(null);
  const [isCrossAnalyzing, setIsCrossAnalyzing] = useState(false);

  const isMobile = !!mobileActiveTab;

  // Analysis data
  const analysisSummary: AnalysisData | undefined = useMemo(
    () => normalizeAnalysisData(savedTender?.analysis_summary),
    [savedTender?.analysis_summary]
  );
  const hasAnalysis =
    isSavedTender &&
    ((savedTender?.analiz_edilen_dokuman || 0) > 0 ||
      (savedTender?.teknik_sart_sayisi || 0) > 0 ||
      (savedTender?.birim_fiyat_sayisi || 0) > 0);

  // ─── Checkbox Selection State ─────────────────────────────
  const [selectedAnalysisCards, setSelectedAnalysisCards] = useState<Set<string>>(new Set());
  const [selectedUserCards, setSelectedUserCards] = useState<Set<number>>(new Set());
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());

  // ─── Notes state ──────────────────────────────────────────
  const [paketiNotes, setPaketiNotes] = useState<VeriPaketiNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');

  const addNote = useCallback((text: string, source?: string, docId?: number) => {
    const note: VeriPaketiNote = {
      id: `note-${Date.now()}`,
      text,
      source,
      documentId: docId,
      createdAt: new Date().toISOString(),
    };
    setPaketiNotes((prev) => [note, ...prev]);
    notifications.show({
      title: 'Not Eklendi',
      message: text.length > 60 ? `${text.substring(0, 60)}...` : text,
      color: 'teal',
    });
  }, []);

  // ─── Checkbox Helper Functions ────────────────────────────
  const toggleAnalysisCard = useCallback((fieldPath: string) => {
    setSelectedAnalysisCards((prev) => {
      const next = new Set(prev);
      if (next.has(fieldPath)) next.delete(fieldPath);
      else next.add(fieldPath);
      return next;
    });
  }, []);

  const toggleUserCard = useCallback((cardId: number) => {
    setSelectedUserCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  const toggleNote = useCallback((noteId: string) => {
    setSelectedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }, []);

  // ─── Analysis Center Modal Handlers ────────────────────────
  const handleCrossAnalysis = useCallback(async () => {
    if (!analysisSummary || !tenderId) return;
    setIsCrossAnalyzing(true);
    setCrossAnalysisResult(null);
    try {
      const { api } = await import('@/lib/api');
      const { getApiUrl } = await import('@/lib/config');
      const res = await api.post(getApiUrl('/api/ai/cross-analysis'), {
        tender_id: tenderId,
        analysis_summary: analysisSummary,
      });
      if (res.data?.data?.content) {
        setCrossAnalysisResult(res.data.data.content);
      }
    } catch {
      notifications.show({ title: 'Hata', message: 'Çapraz analiz başarısız', color: 'red' });
    } finally {
      setIsCrossAnalyzing(false);
    }
  }, [analysisSummary, tenderId]);

  const handleSendToMasaFromModal = useCallback(
    async (data: { analysisCards: string[]; userCards: number[]; notes: string[] }) => {
      if (!tenderId) return;
      try {
        // Seçili analiz kartlarını filtrele
        const filteredAnalysis = analysisSummary
          ? filterAnalysisBySelection(analysisSummary, new Set(data.analysisCards))
          : undefined;

        // Seçili özel kartları al
        const selectedCards = tenderCards.filter((c) => data.userCards.includes(c.id));

        // Seçili notları al
        const selectedNoteTexts = paketiNotes.filter((n) => data.notes.includes(n.id)).map((n) => n.text);

        await createMasaPaketi({
          tenderId: Number(tenderId),
          tender_title: savedTender?.ihale_basligi,
          kurum: savedTender?.kurum,
          tarih: savedTender?.tarih,
          bedel: savedTender?.bedel,
          sure: savedTender?.sure,
          analysis_cards: filteredAnalysis,
          user_cards: selectedCards as unknown[],
          notes: selectedNoteTexts.map((text) => ({ text, source: 'Modal' })) as unknown[],
        });

        notifications.show({
          title: 'Başarılı',
          message: 'Veriler masaya gönderildi',
          color: 'green',
        });

        setAnalysisCenterOpened(false);
        router.push(`/ihale/${tenderId}/masa`);
      } catch {
        notifications.show({ title: 'Hata', message: 'Masaya gönderme başarısız', color: 'red' });
      }
    },
    [
      tenderId,
      analysisSummary,
      tenderCards,
      paketiNotes,
      createMasaPaketi,
      router,
      savedTender?.ihale_basligi,
      savedTender?.kurum,
      savedTender?.tarih,
      savedTender?.bedel,
      savedTender?.sure,
    ]
  );

  // Tümünü seç/kaldır fonksiyonları (gelecekte UI'da kullanılacak)
  // const selectAll = useCallback(() => {
  //   const allAnalysisCards = getAllAnalysisCardPaths(analysisSummary);
  //   setSelectedAnalysisCards(new Set(allAnalysisCards));
  //   setSelectedUserCards(new Set(tenderCards.map((c) => c.id)));
  //   setSelectedNotes(new Set(paketiNotes.map((n) => n.id)));
  // }, [analysisSummary, tenderCards, paketiNotes]);

  // const deselectAll = useCallback(() => {
  //   setSelectedAnalysisCards(new Set());
  //   setSelectedUserCards(new Set());
  //   setSelectedNotes(new Set());
  // }, []);

  // ─── Initialize Selections (All Selected by Default) ──────
  // Stable primitive deps so effect runs only when the set of cards/notes actually changes,
  // not on every render (tenderCards/paketiNotes are new array refs from hooks → would cause update loop).
  const tenderCardIds = tenderCards.map((c) => c.id).join(',');
  const paketiNoteIds = paketiNotes.map((n) => n.id).join(',');

  useEffect(() => {
    if (!analysisSummary) return;

    const allAnalysisCards = getAllAnalysisCardPaths(analysisSummary);
    setSelectedAnalysisCards(new Set(allAnalysisCards));
    setSelectedUserCards(new Set(tenderCardIds ? tenderCardIds.split(',').map(Number) : []));
    setSelectedNotes(new Set(paketiNoteIds ? paketiNoteIds.split(',') : []));
  }, [analysisSummary, tenderCardIds, paketiNoteIds]);

  const addSelectedTextAsNote = useCallback(() => {
    if (selectedText) addNote(selectedText, 'Döküman seçimi', selectedTextDocId);
  }, [selectedText, selectedTextDocId, addNote]);

  // ─── AI Card Transform ────────────────────────────────────
  const handleAiTransform = useCallback(
    async (transformType: 'table' | 'summary' | 'extract') => {
      if (!selectedText || !tenderId) return;
      setAiTransformLoading(true);
      try {
        const { api } = await import('@/lib/api');
        const { getApiUrl } = await import('@/lib/config');
        const res = await api.post(getApiUrl('/api/ai/card-transform'), {
          text: selectedText,
          transform_type: transformType,
          tender_id: tenderId,
        });
        const result = res.data?.data;
        if (result) {
          await createCard({
            card_type: result.card_type || 'text',
            title: result.title || 'AI Kart',
            content: result.content || { text: selectedText },
            source_type: 'ai',
            source_document_id: selectedTextDocId,
            source_text: selectedText,
            category: result.category || 'diger',
          });
        }
      } catch {
        notifications.show({ title: 'Hata', message: 'AI dönüşümü başarısız', color: 'red' });
      } finally {
        setAiTransformLoading(false);
      }
    },
    [selectedText, tenderId, selectedTextDocId, createCard]
  );

  // ─── Render ───────────────────────────────────────────────
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
      {/* ─── Header ────────────────────────────────────────── */}
      <Box
        px="sm"
        py="xs"
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
          background: 'rgba(24, 24, 27, 0.6)',
        }}
      >
        <Group justify="space-between" gap="xs">
          <Group gap={6}>
            <ThemeIcon size="sm" variant="light" color="violet">
              <IconPackage size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              Veri Paketi
            </Text>
          </Group>
          <Group gap={4}>
            {tenderCards.length > 0 && (
              <Badge size="xs" variant="light" color="pink">
                {tenderCards.length} kart
              </Badge>
            )}
            {paketiNotes.length > 0 && (
              <Badge size="xs" variant="light" color="teal">
                {paketiNotes.length} not
              </Badge>
            )}
          </Group>
        </Group>
      </Box>

      {/* ─── Selected Text Banner ──────────────────────────── */}
      {selectedText && (
        <Box
          px="sm"
          py="xs"
          style={{
            borderBottom: '1px solid var(--mantine-color-default-border)',
            background: 'rgba(20, 184, 166, 0.08)',
            flexShrink: 0,
          }}
        >
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="xs" c="teal" lineClamp={2} style={{ flex: 1, minWidth: 0 }}>
              &quot;{selectedText.length > 80 ? `${selectedText.substring(0, 80)}...` : selectedText}&quot;
            </Text>
            <Group gap={4}>
              <Tooltip label="Not olarak ekle">
                <ActionIcon size="xs" variant="light" color="teal" onClick={addSelectedTextAsNote}>
                  <IconPlus size={12} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Kopyala">
                <ActionIcon
                  size="xs"
                  variant="light"
                  color="gray"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedText);
                    notifications.show({ message: 'Kopyalandı', color: 'gray' });
                  }}
                >
                  <IconCopy size={12} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Box>
      )}

      {/* ─── Main Content ──────────────────────────────────── */}
      <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
        {!isSavedTender ? (
          <Box ta="center" py="xl" px="md">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray" mx="auto" mb="md">
              <IconPackage size={24} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Takip edilen bir ihale seçin
            </Text>
          </Box>
        ) : (
          <Stack gap="md" mx="xs" mt="xs">
            {/* ═══ Analiz Merkezi Ana Butonu ════════════════════ */}
            <Paper
              p="md"
              radius="md"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }} radius="xl">
                      <IconBrain size={20} />
                    </ThemeIcon>
                    <Box>
                      <Text size="sm" fw={600}>
                        Analiz Merkezi
                      </Text>
                      <Text size="xs" c="dimmed">
                        AI analiz, özel kartlar ve notlarınız tek yerde
                      </Text>
                    </Box>
                  </Group>
                </Group>

                {/* Stats */}
                <Group gap="xs">
                  {hasAnalysis && (
                    <Badge size="sm" variant="light" color="violet" leftSection={<IconBrain size={10} />}>
                      AI Analiz
                    </Badge>
                  )}
                  {tenderCards.length > 0 && (
                    <Badge size="sm" variant="light" color="pink" leftSection={<IconCards size={10} />}>
                      {tenderCards.length} Kart
                    </Badge>
                  )}
                  {paketiNotes.length > 0 && (
                    <Badge size="sm" variant="light" color="teal" leftSection={<IconNote size={10} />}>
                      {paketiNotes.length} Not
                    </Badge>
                  )}
                  {correctionCount > 0 && (
                    <Badge size="sm" variant="light" color="yellow">
                      {correctionCount} düzeltme
                    </Badge>
                  )}
                  {isConfirmed && (
                    <Badge size="sm" variant="light" color="green" leftSection={<IconCheck size={10} />}>
                      Onaylı
                    </Badge>
                  )}
                </Group>

                <Button
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'indigo' }}
                  size="md"
                  leftSection={<IconExternalLink size={18} />}
                  onClick={() => setAnalysisCenterOpened(true)}
                  fullWidth
                  style={{ boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' }}
                >
                  Analiz Merkezi&apos;ni Aç
                </Button>
              </Stack>
            </Paper>

            {/* ═══ Hızlı İşlemler ═══════════════════════════════ */}
            <Paper p="sm" radius="md" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--mantine-color-dark-5)' }}>
              <Text size="xs" c="dimmed" mb="xs" fw={500}>
                Hızlı İşlemler
              </Text>

              {/* Metin seçiliyse kart oluşturma */}
              {selectedText && (
                <Group gap={4} mb="xs">
                  <Button
                    variant="light"
                    size="compact-xs"
                    color="pink"
                    leftSection={<IconPlus size={12} />}
                    loading={isCardCreating}
                    style={{ flex: 1 }}
                    onClick={() => {
                      const input: CreateCardInput = {
                        title: selectedText.length > 80 ? `${selectedText.substring(0, 80)}...` : selectedText,
                        content: { text: selectedText },
                        source_type: 'pdf_selection',
                        source_document_id: selectedTextDocId,
                        source_text: selectedText,
                        category: 'diger',
                      };
                      createCard(input);
                    }}
                  >
                    Seçimden Kart Oluştur
                  </Button>
                  <Menu shadow="md" width={180} position="bottom-end">
                    <Menu.Target>
                      <Button
                        variant="light"
                        size="compact-xs"
                        color="violet"
                        loading={aiTransformLoading}
                        leftSection={<IconSparkles size={12} />}
                      >
                        AI
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>AI Dönüşüm</Menu.Label>
                      <Menu.Item leftSection={<IconTable size={14} />} onClick={() => handleAiTransform('table')}>
                        Tablo Çıkar
                      </Menu.Item>
                      <Menu.Item leftSection={<IconNote size={14} />} onClick={() => handleAiTransform('summary')}>
                        Özetle
                      </Menu.Item>
                      <Menu.Item leftSection={<IconList size={14} />} onClick={() => handleAiTransform('extract')}>
                        Veri Çıkar
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              )}

              {/* Hızlı not ekleme */}
              <Group gap="xs">
                <Textarea
                  placeholder="Hızlı not ekle..."
                  size="xs"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.currentTarget.value)}
                  autosize
                  minRows={1}
                  maxRows={3}
                  style={{ flex: 1 }}
                />
                <ActionIcon
                  variant="light"
                  color="teal"
                  size="md"
                  disabled={!newNoteText.trim()}
                  onClick={() => {
                    if (newNoteText.trim()) {
                      addNote(newNoteText.trim(), 'Manuel');
                      setNewNoteText('');
                    }
                  }}
                >
                  <IconPlus size={14} />
                </ActionIcon>
              </Group>
            </Paper>

            {/* ═══ Seçim Özeti ══════════════════════════════════ */}
            {(selectedAnalysisCards.size > 0 || selectedUserCards.size > 0 || selectedNotes.size > 0) && (
              <Paper p="sm" radius="md" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <Group justify="space-between" mb="xs">
                  <Text size="xs" fw={500}>
                    Seçili Öğeler
                  </Text>
                  <Badge size="sm" variant="light" color="blue">
                    {selectedAnalysisCards.size + selectedUserCards.size + selectedNotes.size} seçili
                  </Badge>
                </Group>
                <Group gap="xs">
                  {selectedAnalysisCards.size > 0 && (
                    <Badge size="xs" variant="dot" color="violet">
                      {selectedAnalysisCards.size} analiz
                    </Badge>
                  )}
                  {selectedUserCards.size > 0 && (
                    <Badge size="xs" variant="dot" color="pink">
                      {selectedUserCards.size} kart
                    </Badge>
                  )}
                  {selectedNotes.size > 0 && (
                    <Badge size="xs" variant="dot" color="teal">
                      {selectedNotes.size} not
                    </Badge>
                  )}
                </Group>
              </Paper>
            )}
          </Stack>
        )}
      </ScrollArea>

      {/* ─── Bottom: Masaya Gönder ─────────────────────────── */}
      {isSavedTender && savedTender?.analysis_summary && (
        <Box
          px="sm"
          py="xs"
          style={{
            borderTop: '1px solid var(--mantine-color-default-border)',
            flexShrink: 0,
            background: 'rgba(24, 24, 27, 0.8)',
          }}
        >
          {/* Selection Summary */}
          <Stack gap={4} mb="xs">
            <Text size="xs" c="dimmed">
              ✓ {selectedAnalysisCards.size} analiz kartı
            </Text>
            <Text size="xs" c="dimmed">
              ✓ {selectedUserCards.size} özel kart
            </Text>
            <Text size="xs" c="dimmed">
              ✓ {selectedNotes.size} not
            </Text>
          </Stack>

          {/* Send Button */}
          <Button
            variant="gradient"
            gradient={{ from: 'violet', to: 'indigo', deg: 135 }}
            leftSection={<IconSend size={16} />}
            fullWidth
            size="sm"
            loading={isSendingToMasa}
            disabled={selectedAnalysisCards.size + selectedUserCards.size + selectedNotes.size === 0}
            style={{ boxShadow: '0 2px 12px rgba(139, 92, 246, 0.25)' }}
            onClick={async () => {
              try {
                // Filter data by selection
                const selectedAnalysis = filterAnalysisBySelection(analysisSummary, selectedAnalysisCards);
                const selectedCards = tenderCards.filter((c) => selectedUserCards.has(c.id));
                const selectedNotesList = paketiNotes.filter((n) => selectedNotes.has(n.id));

                await createMasaPaketi({
                  tenderId: savedTender.tender_id,
                  tender_title: savedTender.ihale_basligi,
                  kurum: savedTender.kurum,
                  tarih: savedTender.tarih,
                  bedel: savedTender.bedel,
                  sure: savedTender.sure,
                  analysis_cards: selectedAnalysis,
                  user_cards: selectedCards as unknown[],
                  notes: selectedNotesList as unknown[],
                  correction_count: correctionCount,
                  is_confirmed: isConfirmed,
                });
                router.push(`/ihale-merkezi/masa/${savedTender.tender_id}`);
              } catch {
                // notification handled by hook
              }
            }}
          >
            Masaya Gönder ({selectedAnalysisCards.size + selectedUserCards.size + selectedNotes.size} öğe)
          </Button>
        </Box>
      )}

      {/* ─── Card Detail Modal ─────────────────────────────── */}
      <CardDetailModal
        card={detailModalCard}
        opened={detailModalOpened}
        onClose={handleDetailModalClose}
        onUpdate={updateCard}
        onDelete={deleteCard}
        isUpdating={isCardUpdating}
      />

      {/* ─── Analysis Center Modal ──────────────────────────── */}
      <AnalysisCenterModal
        opened={analysisCenterOpened}
        onClose={() => setAnalysisCenterOpened(false)}
        analysisSummary={analysisSummary}
        tenderId={tenderId ? Number(tenderId) : undefined}
        tenderCards={tenderCards}
        onCardClick={handleCardClick}
        onCardDelete={(id) => deleteCard(id)}
        notes={paketiNotes}
        onNoteDelete={(id) => {
          setPaketiNotes((prev) => prev.filter((n) => n.id !== id));
        }}
        selectedAnalysisCards={selectedAnalysisCards}
        selectedUserCards={selectedUserCards}
        selectedNotes={selectedNotes}
        onToggleAnalysisCard={toggleAnalysisCard}
        onToggleUserCard={toggleUserCard}
        onToggleNote={toggleNote}
        onSendToMasa={handleSendToMasaFromModal}
        isSendingToMasa={isSendingToMasa}
        onCrossAnalysis={handleCrossAnalysis}
        crossAnalysisResult={crossAnalysisResult || undefined}
        isCrossAnalyzing={isCrossAnalyzing}
      />
    </Box>
  );
}
