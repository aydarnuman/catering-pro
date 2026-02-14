'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrain,
  IconCards,
  IconCheck,
  IconCopy,
  IconEdit,
  IconGripVertical,
  IconList,
  IconNote,
  IconPackage,
  IconPlus,
  IconSend,
  IconSparkles,
  IconTable,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useNotesModal } from '@/context/NotesContext';
import { useAnalysisCorrections } from '@/hooks/useAnalysisCorrections';
import { useCreateMasaPaketi } from '@/hooks/useMasaVeriPaketi';
import type { CardCategory, CreateCardInput, TenderCard, UpdateCardInput } from '@/hooks/useTenderCards';
import { useTenderCards } from '@/hooks/useTenderCards';
import { AnalysisCardsPanel } from '../CenterPanel/AnalysisCardsPanel';
import { normalizeAnalysisData } from '../CenterPanel/normalizeAnalysis';
import type { AnalysisData, IhaleMerkeziState, SavedTender } from '../types';
import { CardCategoryBadge, CardContentRenderer, CardDetailModal } from './CardRenderers';

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

// ─── Sortable Card Wrapper ────────────────────────────────────

function SortableCard({
  card,
  onUpdate,
  onDelete,
  isUpdating,
  onCardClick,
}: {
  card: TenderCard;
  onUpdate: (data: UpdateCardInput & { id: number }) => void;
  onDelete: (id: number) => void;
  isUpdating: boolean;
  onCardClick: (card: TenderCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <EditableCard
        card={card}
        onUpdate={onUpdate}
        onDelete={onDelete}
        isUpdating={isUpdating}
        onCardClick={onCardClick}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ─── Editable Card Component ──────────────────────────────────

function EditableCard({
  card,
  onUpdate,
  onDelete,
  isUpdating,
  onCardClick,
  dragHandleProps,
}: {
  card: TenderCard;
  onUpdate: (data: UpdateCardInput & { id: number }) => void;
  onDelete: (id: number) => void;
  isUpdating: boolean;
  onCardClick: (card: TenderCard) => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editText, setEditText] = useState(typeof card.content?.text === 'string' ? card.content.text : '');
  const [editCategory, setEditCategory] = useState<string>(card.category || 'diger');

  const handleSave = () => {
    onUpdate({
      id: card.id,
      title: editTitle.trim() || card.title,
      content: { ...card.content, text: editText },
      category: editCategory as CardCategory,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(card.title);
    setEditText(typeof card.content?.text === 'string' ? card.content.text : '');
    setEditCategory(card.category || 'diger');
    setEditing(false);
  };

  if (editing) {
    return (
      <Paper p="xs" radius="sm" withBorder style={{ borderColor: 'var(--mantine-color-pink-7)' }}>
        <Stack gap={6}>
          <TextInput
            size="xs"
            placeholder="Kart başlığı"
            value={editTitle}
            onChange={(e) => setEditTitle(e.currentTarget.value)}
          />
          {card.card_type === 'text' && (
            <Textarea
              size="xs"
              placeholder="İçerik"
              value={editText}
              onChange={(e) => setEditText(e.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={6}
            />
          )}
          <Select
            size="xs"
            placeholder="Kategori"
            value={editCategory}
            onChange={(val) => setEditCategory(val || 'diger')}
            data={[
              { value: 'operasyonel', label: 'Operasyonel' },
              { value: 'mali', label: 'Mali' },
              { value: 'teknik', label: 'Teknik' },
              { value: 'belgeler', label: 'Belgeler' },
              { value: 'diger', label: 'Diğer' },
            ]}
          />
          <Group gap={4} justify="flex-end">
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={handleCancel}
              leftSection={<IconX size={10} />}
            >
              İptal
            </Button>
            <Button
              size="compact-xs"
              variant="filled"
              color="pink"
              onClick={handleSave}
              loading={isUpdating}
              leftSection={<IconCheck size={10} />}
            >
              Kaydet
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      p="xs"
      radius="sm"
      withBorder
      onClick={() => onCardClick(card)}
      style={{
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      styles={{
        root: {
          '&:hover': {
            borderColor: 'var(--mantine-color-pink-7)',
            background: 'rgba(236, 72, 153, 0.05)',
          },
        },
      }}
    >
      <Group justify="space-between" gap="xs" mb={4}>
        <Group gap={4} style={{ flex: 1, minWidth: 0 }}>
          {dragHandleProps && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              style={{ cursor: 'grab' }}
              onClick={(e) => e.stopPropagation()}
              {...dragHandleProps}
            >
              <IconGripVertical size={10} />
            </ActionIcon>
          )}
          <Text size="xs" fw={600} lineClamp={1} style={{ flex: 1 }}>
            {card.title}
          </Text>
        </Group>
        <Group gap={2} onClick={(e) => e.stopPropagation()}>
          <Tooltip label="Hızlı düzenle">
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setEditing(true)}>
              <IconEdit size={10} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Sil">
            <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onDelete(card.id)}>
              <IconTrash size={10} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Box style={{ maxHeight: 80, overflow: 'hidden' }}>
        <CardContentRenderer card={card} />
      </Box>
      <Group gap={4} mt={4}>
        <CardCategoryBadge category={card.category} />
        {card.document_name && (
          <Badge size="xs" variant="dot" color="gray">
            {card.document_name}
          </Badge>
        )}
      </Group>
    </Paper>
  );
}

// ─── Editable Note Component ──────────────────────────────────

function EditableNote({
  note,
  onUpdate,
  onDelete,
}: {
  note: VeriPaketiNote;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);

  const handleSave = () => {
    if (editText.trim()) {
      onUpdate(note.id, editText.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Paper p="xs" radius="sm" withBorder style={{ borderColor: 'var(--mantine-color-teal-7)' }}>
        <Stack gap={4}>
          <Textarea
            size="xs"
            value={editText}
            onChange={(e) => setEditText(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={5}
          />
          <Group gap={4} justify="flex-end">
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                setEditText(note.text);
                setEditing(false);
              }}
            >
              <IconX size={10} />
            </ActionIcon>
            <ActionIcon size="xs" variant="filled" color="teal" onClick={handleSave}>
              <IconCheck size={10} />
            </ActionIcon>
          </Group>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper p="xs" radius="sm" withBorder>
      <Group justify="space-between" gap="xs" align="flex-start">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs">{note.text}</Text>
          {note.source && (
            <Text size="xs" c="dimmed" mt={2} style={{ fontSize: 10 }}>
              Kaynak: {note.source}
            </Text>
          )}
        </Box>
        <Group gap={2} style={{ flexShrink: 0 }}>
          <Tooltip label="Düzenle">
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setEditing(true)}>
              <IconEdit size={10} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Sil">
            <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onDelete(note.id)}>
              <IconTrash size={10} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function RightPanel({
  state,
  onStateChange,
  onRefreshData,
  selectedText,
  selectedTextDocId,
  mobileActiveTab,
}: RightPanelProps) {
  const { selectedTender, veriPaketiSections } = state;
  const { openContextNotes } = useNotesModal();
  const router = useRouter();

  const isSavedTender = selectedTender && 'tender_id' in selectedTender;
  const savedTender = isSavedTender ? (selectedTender as SavedTender) : null;
  const tenderId = savedTender?.tender_id ?? null;

  // Masaya gönder mutation
  const { mutateAsync: createMasaPaketi, isPending: isSendingToMasa } = useCreateMasaPaketi();

  // HITL corrections
  const { correctionCount, isConfirmed, saveCorrection, getCorrectionForField } = useAnalysisCorrections(
    tenderId ? Number(tenderId) : null
  );

  // Custom Cards
  const {
    cards: tenderCards,
    isLoading: cardsLoading,
    createCard,
    updateCard,
    deleteCard,
    reorderCard,
    isCreating: isCardCreating,
    isUpdating: isCardUpdating,
  } = useTenderCards(tenderId ? Number(tenderId) : null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = tenderCards.findIndex((c) => c.id === active.id);
      const newIndex = tenderCards.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      reorderCard({ id: Number(active.id), sort_order: newIndex + 1 });
    },
    [tenderCards, reorderCard]
  );

  // AI Analiz editing state
  const [editingAnalysisCards, setEditingAnalysisCards] = useState<Set<string>>(new Set());
  const toggleAnalysisCardEdit = useCallback((cardName: string) => {
    setEditingAnalysisCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardName)) next.delete(cardName);
      else next.add(cardName);
      return next;
    });
  }, []);

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

  const updateNote = useCallback((id: string, text: string) => {
    setPaketiNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
    notifications.show({ message: 'Not güncellendi', color: 'teal', autoClose: 1500 });
  }, []);

  const deleteNote = useCallback((id: string) => {
    setPaketiNotes((prev) => prev.filter((n) => n.id !== id));
    notifications.show({ message: 'Not silindi', color: 'gray', autoClose: 1500 });
  }, []);

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

  // ─── Accordion ────────────────────────────────────────────
  const accordionValue = useMemo(() => Array.from(veriPaketiSections || new Set()), [veriPaketiSections]);
  const handleAccordionChange = useCallback(
    (values: string[]) => onStateChange({ veriPaketiSections: new Set(values) }),
    [onStateChange]
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
          <Accordion
            multiple
            value={accordionValue}
            onChange={handleAccordionChange}
            variant="separated"
            radius="md"
            styles={{
              item: { borderColor: 'var(--mantine-color-dark-4)', background: 'rgba(255, 255, 255, 0.02)' },
              control: { padding: '8px 12px' },
              label: { fontSize: 'var(--mantine-font-size-sm)', fontWeight: 600 },
              content: { padding: '0 8px 8px' },
            }}
            mx="xs"
            mt="xs"
          >
            {/* ═══ 1. AI Analiz ════════════════════════════════ */}
            {hasAnalysis && (
              <Accordion.Item value="analiz">
                <Accordion.Control
                  icon={
                    <ThemeIcon size="xs" variant="light" color="violet">
                      <IconBrain size={12} />
                    </ThemeIcon>
                  }
                >
                  <Group gap="xs">
                    AI Analiz
                    {correctionCount > 0 && (
                      <Badge size="xs" variant="light" color="yellow">
                        {correctionCount} düzeltme
                      </Badge>
                    )}
                    {isConfirmed && (
                      <Badge size="xs" variant="light" color="green">
                        Onaylı
                      </Badge>
                    )}
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <AnalysisCardsPanel
                    analysisSummary={analysisSummary}
                    editingCards={editingAnalysisCards}
                    toggleCardEdit={toggleAnalysisCardEdit}
                    saveCorrection={saveCorrection}
                    getCorrectionForField={getCorrectionForField}
                    onRefreshData={onRefreshData}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {/* ═══ 2. Özel Kartlar ═════════════════════════════ */}
            <Accordion.Item value="ozel-kartlar">
              <Accordion.Control
                icon={
                  <ThemeIcon size="xs" variant="light" color="pink">
                    <IconCards size={12} />
                  </ThemeIcon>
                }
              >
                <Group gap="xs">
                  Özel Kartlar
                  {tenderCards.length > 0 && (
                    <Badge size="xs" variant="light" color="pink">
                      {tenderCards.length}
                    </Badge>
                  )}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  {/* ── Seçimden kart oluştur (metin + AI menü) ── */}
                  {selectedText && (
                    <Group gap={4}>
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
                        Metin Kartı
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

                  {/* ── Kart listesi (DnD sortable) ── */}
                  {cardsLoading ? (
                    <Text size="xs" c="dimmed">
                      Yükleniyor...
                    </Text>
                  ) : tenderCards.length === 0 ? (
                    <Text size="xs" c="dimmed" ta="center" py="xs">
                      Henüz özel kart yok. Döküman üzerinden metin seçip kart oluşturabilirsiniz.
                    </Text>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={tenderCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        {tenderCards.map((card) => (
                          <SortableCard
                            key={card.id}
                            card={card}
                            onUpdate={updateCard}
                            onDelete={deleteCard}
                            isUpdating={isCardUpdating}
                            onCardClick={handleCardClick}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {/* ═══ 3. Notlar ═══════════════════════════════════ */}
            <Accordion.Item value="notlar">
              <Accordion.Control
                icon={
                  <ThemeIcon size="xs" variant="light" color="teal">
                    <IconNote size={12} />
                  </ThemeIcon>
                }
              >
                <Group gap="xs">
                  Notlar
                  {paketiNotes.length > 0 && (
                    <Badge size="xs" variant="light" color="teal">
                      {paketiNotes.length}
                    </Badge>
                  )}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  {/* Not ekle */}
                  <Group gap="xs">
                    <Textarea
                      placeholder="Not ekle..."
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

                  {/* Not listesi */}
                  {paketiNotes.map((note) => (
                    <EditableNote key={note.id} note={note} onUpdate={updateNote} onDelete={deleteNote} />
                  ))}

                  <Button
                    variant="subtle"
                    size="compact-xs"
                    color="violet"
                    leftSection={<IconNote size={12} />}
                    onClick={() =>
                      openContextNotes('tender', savedTender?.tender_id ?? 0, savedTender?.ihale_basligi || 'İhale')
                    }
                  >
                    Tüm İhale Notlarını Aç
                  </Button>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
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
          <Button
            variant="gradient"
            gradient={{ from: 'violet', to: 'indigo', deg: 135 }}
            leftSection={<IconSend size={16} />}
            fullWidth
            size="sm"
            loading={isSendingToMasa}
            style={{ boxShadow: '0 2px 12px rgba(139, 92, 246, 0.25)' }}
            onClick={async () => {
              try {
                await createMasaPaketi({
                  tenderId: savedTender.tender_id,
                  tender_title: savedTender.ihale_basligi,
                  kurum: savedTender.kurum,
                  tarih: savedTender.tarih,
                  bedel: savedTender.bedel,
                  sure: savedTender.sure,
                  analysis_cards: (analysisSummary as Record<string, unknown>) || {},
                  user_cards: tenderCards as unknown[],
                  notes: paketiNotes as unknown[],
                  correction_count: correctionCount,
                  is_confirmed: isConfirmed,
                });
                router.push(`/ihale-merkezi/masa/${savedTender.tender_id}`);
              } catch {
                // notification handled by hook
              }
            }}
          >
            Masaya Gönder
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
    </Box>
  );
}
