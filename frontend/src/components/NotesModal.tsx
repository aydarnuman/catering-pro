/**
 * @deprecated Bu component artık kullanılmıyor.
 * Bunun yerine @/components/notes/UnifiedNotesModal kullanın.
 * Tarih: 2026-01-29
 */
'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconFlag,
  IconFlagFilled,
  IconList,
  IconNote,
  IconPin,
  IconPinnedOff,
  IconPlus,
  IconTag,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/common';
import StyledDatePicker from '@/components/ui/StyledDatePicker';

export interface NotItem {
  id: number;
  content: string;
  is_completed: boolean;
  priority: string;
  color: string;
  due_date: string | null;
  pinned?: boolean;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  normal: '#8b5cf6',
  low: '#6b7280',
};

const NOTE_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  violet: '#8b5cf6',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
};

function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.normal;
}

const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function getDaysInMonth(year: number, month: number): { key: string; day: Date | null }[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const out: { key: string; day: Date | null }[] = [];
  for (let i = 0; i < startPad; i++) out.push({ key: `pad-${year}-${month}-${i}`, day: null });
  for (let d = 1; d <= last.getDate(); d++) out.push({ key: toDateKey(new Date(year, month, d)), day: new Date(year, month, d) });
  return out;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayRange() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return { todayStart, todayEnd, weekEnd };
}

interface NotesModalProps {
  opened: boolean;
  onClose: () => void;
  notlar: NotItem[];
  onAddNote: (
    content: string,
    due_date?: string | null,
    priority?: string,
    color?: string
  ) => Promise<void>;
  onToggleNote: (id: number) => Promise<void>;
  onDeleteNote: (id: number) => Promise<void>;
  onTogglePin: (id: number) => Promise<void>;
  onUpdateNote?: (id: number, updates: { priority?: string; color?: string }) => Promise<void>;
}

const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'blue', label: 'Mavi' },
  { value: 'violet', label: 'Mor' },
  { value: 'green', label: 'Yeşil' },
  { value: 'orange', label: 'Turuncu' },
  { value: 'red', label: 'Kırmızı' },
];

export function NotesModal({
  opened,
  onClose,
  notlar,
  onAddNote,
  onToggleNote,
  onDeleteNote,
  onTogglePin,
  onUpdateNote,
}: NotesModalProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [newNote, setNewNote] = useState('');
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [newPriority, setNewPriority] = useState<string>('normal');
  const [newColor, setNewColor] = useState<string>('blue');
  const [activeTab, setActiveTab] = useState<string | null>('ajanda');
  const [composerOpen, setComposerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { todayStart, todayEnd, weekEnd } = getTodayRange();

  const bugun = notlar.filter((n) => {
    if (n.is_completed || !n.due_date) return false;
    const d = new Date(n.due_date);
    return d >= todayStart && d < todayEnd;
  });
  const buHafta = notlar.filter((n) => {
    if (n.is_completed || !n.due_date) return false;
    const d = new Date(n.due_date);
    return d >= todayEnd && d <= weekEnd;
  });
  const sabitlenen = notlar.filter((n) => !n.is_completed && (n.pinned ?? false));
  const ajandaNotlar = [...bugun, ...buHafta].filter(
    (n, i, arr) => arr.findIndex((x) => x.id === n.id) === i
  );

  const handleSubmit = async () => {
    if (!newNote.trim()) return;
    setAdding(true);
    try {
      await onAddNote(
        newNote.trim(),
        newDueDate ? newDueDate.toISOString().slice(0, 10) : null,
        newPriority,
        newColor
      );
      setNewNote('');
      setNewDueDate(null);
      setNewPriority('normal');
      setNewColor('blue');
      setComposerOpen(false);
    } finally {
      setAdding(false);
    }
  };

  const handleRequestDelete = (id: number) => setDeleteConfirmId(id);
  const handleConfirmDelete = () => {
    if (deleteConfirmId !== null) {
      onDeleteNote(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const surfaceBg = isDark ? '#1a1a1e' : '#ffffff';
  const surfaceElevated = isDark ? '#222226' : '#f8fafc';
  const borderSubtl = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.52)';

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="md" wrap="nowrap">
            <ThemeIcon
              size={42}
              radius="xl"
              variant="light"
              color="violet"
              style={{
                background: isDark ? 'rgba(139,92,246,0.14)' : 'rgba(139,92,246,0.1)',
                border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
              }}
            >
              <IconNote size={22} />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="xl" style={{ letterSpacing: '-0.02em', color: textPrimary }}>
                Notlarım
              </Text>
              <Text size="xs" mt={4} style={{ color: textSecondary, fontWeight: 500 }}>
                Ajanda ve sabitlenen notlar · Tek yerden yönetin
              </Text>
            </Box>
          </Group>
        }
        size="xl"
        radius="xl"
        padding={0}
        overlayProps={{
          backgroundOpacity: 0.5,
          blur: 8,
        }}
        classNames={{ content: 'notes-modal-content' }}
        styles={{
          header: {
            padding: '24px 28px',
            borderBottom: `1px solid ${borderSubtl}`,
            background: surfaceBg,
          },
          body: {
            padding: 0,
            background: surfaceBg,
          },
          content: {
            background: surfaceBg,
            boxShadow: isDark
              ? '0 24px 48px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)'
              : '0 24px 48px -12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
            maxWidth: 720,
          },
        }}
      >
        {/* Hızlı ekle — tıklanınca açılan alan */}
        <Box
          px="lg"
          py="md"
          style={{
            borderBottom: `1px solid ${borderSubtl}`,
          }}
        >
          <Stack gap="sm">
            {!composerOpen ? (
              <UnstyledButton
                type="button"
                onClick={() => setComposerOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: surfaceElevated,
                  border: `1px solid ${borderSubtl}`,
                  color: textSecondary,
                  fontWeight: 500,
                  fontSize: 13,
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <IconPlus size={18} style={{ opacity: 0.7 }} />
                <span>Yeni not ekle...</span>
              </UnstyledButton>
            ) : (
              <>
                <Textarea
                  placeholder="Notunuzu yazın..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  minRows={3}
                  maxRows={6}
                  size="sm"
                  radius="md"
                  autosize
                  styles={{
                    input: {
                      fontWeight: 500,
                      background: surfaceElevated,
                      border: `1px solid ${borderSubtl}`,
                      fontSize: 13,
                    },
                  }}
                />
                <Group align="center" wrap="nowrap" gap="xs" justify="space-between">
                  <Group align="center" wrap="nowrap" gap="xs">
                    <Select
                      placeholder="Öncelik"
                      size="xs"
                      radius="md"
                      w={88}
                      value={newPriority}
                      onChange={(v) => setNewPriority(v ?? 'normal')}
                      data={[
                        { value: 'high', label: 'Yüksek' },
                        { value: 'normal', label: 'Normal' },
                        { value: 'low', label: 'Düşük' },
                      ]}
                      styles={{
                        input: {
                          background: surfaceElevated,
                          border: `1px solid ${borderSubtl}`,
                          fontWeight: 500,
                          fontSize: 12,
                        },
                      }}
                    />
                    <Select
                      placeholder="Etiket"
                      size="xs"
                      radius="md"
                      w={82}
                      value={newColor}
                      onChange={(v) => setNewColor(v ?? 'blue')}
                      data={COLOR_OPTIONS}
                      styles={{
                        input: {
                          background: surfaceElevated,
                          border: `1px solid ${borderSubtl}`,
                          fontWeight: 500,
                          fontSize: 12,
                        },
                      }}
                    />
                    <StyledDatePicker
                      placeholder="Vade"
                      value={newDueDate}
                      onChange={setNewDueDate}
                      size="xs"
                      clearable
                      w={100}
                      style={{ flexShrink: 0 }}
                    />
                    <Button
                      variant="default"
                      size="sm"
                      radius="md"
                      leftSection={<IconPlus size={14} style={{ opacity: 0.85 }} />}
                      onClick={handleSubmit}
                      disabled={!newNote.trim() || adding}
                      loading={adding}
                      styles={{
                        root: {
                          background: surfaceElevated,
                          border: `1px solid ${borderSubtl}`,
                          color: isDark ? 'rgba(196,181,253,0.95)' : 'var(--mantine-color-violet-7)',
                          fontWeight: 500,
                          fontSize: 12,
                        },
                      }}
                    >
                      Ekle
                    </Button>
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    color="gray"
                    onClick={() => {
                      setComposerOpen(false);
                      setNewNote('');
                      setNewDueDate(null);
                      setNewPriority('normal');
                      setNewColor('blue');
                    }}
                    aria-label="İptal"
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
              </>
            )}
            <Text size="xs" style={{ color: textSecondary, fontWeight: 500 }}>
              {notlar.filter((n) => !n.is_completed).length} bekleyen
              <Text component="span" mx={6} style={{ opacity: 0.5 }}>·</Text>
              {notlar.filter((n) => n.is_completed).length} tamamlanan
              <Text component="span" mx={6} style={{ opacity: 0.5 }}>·</Text>
              {sabitlenen.length} sabit
              <Text component="span" mx={6} style={{ opacity: 0.5 }}>·</Text>
              Bugün {bugun.length} · Bu hafta {buHafta.length}
            </Text>
          </Stack>
        </Box>

        {/* Sekmeler — ince çizgi, modern */}
        <Tabs value={activeTab} onChange={setActiveTab} variant="default">
          <Tabs.List
            px="xl"
            pt="md"
            style={{ borderBottom: `1px solid ${borderSubtl}`, gap: 4 }}
            styles={{
              list: { borderBottom: 'none' },
            }}
          >
            <Tabs.Tab
              value="tumu"
              leftSection={<IconList size={16} />}
              styles={{ tab: { fontWeight: 500 } }}
            >
              Tümü ({notlar.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="sabitlenen"
              leftSection={<IconPin size={16} />}
              styles={{ tab: { fontWeight: 500 } }}
            >
              Sabitlenen ({sabitlenen.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="ajanda"
              leftSection={<IconCalendar size={16} />}
              styles={{ tab: { fontWeight: 500 } }}
            >
              Ajanda ({ajandaNotlar.length})
            </Tabs.Tab>
          </Tabs.List>

        <Tabs.Panel value="tumu" pt="lg" pb="xl" px="xl">
          <NoteList
            notlar={notlar}
            isDark={isDark}
            onToggleNote={onToggleNote}
            onDeleteNote={handleRequestDelete}
            onTogglePin={onTogglePin}
            onUpdateNote={onUpdateNote}
            emptyTitle="Henüz not yok"
            emptyDescription="Yukarıdaki alana yazarak ilk notunuzu ekleyin"
          />
        </Tabs.Panel>
        <Tabs.Panel value="sabitlenen" pt="lg" pb="xl" px="xl">
          <NoteList
            notlar={sabitlenen}
            isDark={isDark}
            onToggleNote={onToggleNote}
            onDeleteNote={handleRequestDelete}
            onTogglePin={onTogglePin}
            onUpdateNote={onUpdateNote}
            emptyTitle="Sabitlenen not yok"
            emptyDescription="Not kartındaki raptiye ikonuna tıklayarak sabitleyebilirsiniz"
          />
        </Tabs.Panel>
        <Tabs.Panel value="ajanda" pt="lg" pb="xl" px="xl">
          <Stack gap="lg">
            {/* Mini takvim */}
            <Paper p="md" radius="lg" withBorder={false} style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={600}>
                  {calendarMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </Text>
                <Group gap={4}>
                  <UnstyledButton onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}>
                    <IconChevronLeft size={18} />
                  </UnstyledButton>
                  <UnstyledButton onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}>
                    <IconChevronRight size={18} />
                  </UnstyledButton>
                </Group>
              </Group>
              <SimpleGrid cols={7} spacing={4} style={{ textAlign: 'center' }}>
                {WEEKDAYS_TR.map((w) => (
                  <Text key={w} size="xs" c="dimmed" fw={600}>
                    {w}
                  </Text>
                ))}
                {getDaysInMonth(calendarMonth.getFullYear(), calendarMonth.getMonth()).map(({ key: cellKey, day: dayOrNull }) => {
                  if (!dayOrNull) return <Box key={cellKey} />;
                  const count = notlar.filter((n) => n.due_date && toDateKey(new Date(n.due_date)) === cellKey && !n.is_completed).length;
                  const isSelected = selectedDate && toDateKey(selectedDate) === cellKey;
                  const isToday = toDateKey(new Date()) === cellKey;
                  return (
                    <UnstyledButton
                      key={cellKey}
                      onClick={() => setSelectedDate(dayOrNull)}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? (isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.15)') : isToday ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : undefined,
                        fontWeight: isToday ? 700 : 500,
                        fontSize: 13,
                      }}
                    >
                      {dayOrNull.getDate()}
                      {count > 0 && (
                        <Box style={{ width: 5, height: 5, borderRadius: 3, background: '#8b5cf6', marginTop: 2 }} />
                      )}
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>
            </Paper>
            {/* Seçili güne göre liste */}
            <Box>
              {selectedDate && (
                <Text size="xs" c="dimmed" mb="xs">
                  {selectedDate.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })} — notlar
                </Text>
              )}
              <NoteList
                notlar={
                  selectedDate
                    ? ajandaNotlar.filter((n) => n.due_date && toDateKey(new Date(n.due_date)) === toDateKey(selectedDate))
                    : ajandaNotlar
                }
                isDark={isDark}
                onToggleNote={onToggleNote}
                onDeleteNote={handleRequestDelete}
                onTogglePin={onTogglePin}
                onUpdateNote={onUpdateNote}
                emptyTitle={selectedDate ? 'Bu tarihte not yok' : 'Ajandada not yok'}
                emptyDescription={
                  selectedDate
                    ? 'Bu gün için not eklemek üzere yukarıdaki alandan vade seçerek ekleyin.'
                    : 'Not eklerken vade tarihi seçerek ajandada görünmesini sağlayın'
                }
              />
            </Box>
          </Stack>
        </Tabs.Panel>
        </Tabs>
      </Modal>

      <ConfirmDialog
        opened={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleConfirmDelete}
        title="Notu sil"
        message="Bu notu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Sil"
        cancelText="İptal"
        variant="danger"
      />
    </>
  );
}

interface NoteListProps {
  notlar: NotItem[];
  isDark: boolean;
  onToggleNote: (id: number) => Promise<void>;
  onDeleteNote: (id: number) => void;
  onTogglePin: (id: number) => Promise<void>;
  onUpdateNote?: (id: number, updates: { priority?: string; color?: string }) => Promise<void>;
  emptyTitle: string;
  emptyDescription: string;
}

function NoteList({
  notlar,
  isDark,
  onToggleNote,
  onDeleteNote,
  onTogglePin,
  onUpdateNote,
  emptyTitle,
  emptyDescription,
}: NoteListProps) {
  const cardBg = isDark ? '#222226' : '#ffffff';
  const cardBgDone = isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textContent = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)';
  const textMeta = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.48)';

  return (
    <ScrollArea h={400} scrollbarSize={6} offsetScrollbars type="auto">
      <Stack gap="md">
        {notlar.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={<IconNote size={56} />}
            iconColor="violet"
          />
        ) : (
          notlar.map((not) => (
            <Paper
              key={not.id}
              p="lg"
              radius="xl"
              className="note-card"
              style={{
                background: not.is_completed ? cardBgDone : cardBg,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: cardBorder,
                borderLeftWidth: 3,
                borderLeftColor: not.is_completed ? '#22c55e' : getPriorityColor(not.priority),
                boxShadow: 'none',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
                <Group gap="md" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  <Checkbox
                    checked={not.is_completed}
                    onChange={() => onToggleNote(not.id)}
                    size="md"
                    color="green"
                    radius="xl"
                    mt={2}
                    styles={{ input: { cursor: 'pointer' } }}
                  />
                  <Box
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 4,
                      flexShrink: 0,
                      marginTop: 10,
                      background: NOTE_COLORS[not.color ?? 'blue'] ?? NOTE_COLORS.blue,
                      opacity: 0.9,
                    }}
                    title="Etiket rengi"
                  />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      size="sm"
                      fw={500}
                      lineClamp={3}
                      style={{
                        color: not.is_completed ? textMeta : textContent,
                        textDecoration: not.is_completed ? 'line-through' : undefined,
                        lineHeight: 1.5,
                        letterSpacing: '0.01em',
                      }}
                    >
                      {not.content}
                    </Text>
                    <Group gap="sm" mt={10} wrap="wrap">
                      {not.due_date && (
                        <Badge
                          size="xs"
                          variant="subtle"
                          color="orange"
                          radius="md"
                          leftSection={<IconCalendar size={12} />}
                          styles={{ root: { fontWeight: 500, textTransform: 'none' } }}
                        >
                          {new Date(not.due_date).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Badge>
                      )}
                      <Text size="xs" style={{ color: textMeta, fontWeight: 500 }}>
                        {new Date(not.created_at).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </Group>
                  </Box>
                </Group>
                <Group gap={4} wrap="nowrap">
                  {onUpdateNote && (
                    <>
                      <Tooltip label={not.priority === 'high' ? 'Öncelik: Yüksek (tıkla kaldır)' : 'Bayrak ekle (öncelik yüksek)'}>
                        <ActionIcon
                          variant="subtle"
                          color={not.priority === 'high' ? 'red' : 'gray'}
                          size="md"
                          radius="lg"
                          onClick={() => onUpdateNote(not.id, { priority: not.priority === 'high' ? 'normal' : 'high' })}
                        >
                          {not.priority === 'high' ? <IconFlagFilled size={18} /> : <IconFlag size={18} />}
                        </ActionIcon>
                      </Tooltip>
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon variant="subtle" size="md" radius="lg" color="gray">
                            <IconTag size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>Etiket rengi</Menu.Label>
                          {COLOR_OPTIONS.map((c) => (
                            <Menu.Item
                              key={c.value}
                              leftSection={<Box w={12} h={12} style={{ borderRadius: 4, background: NOTE_COLORS[c.value] ?? NOTE_COLORS.blue }} />}
                              onClick={() => onUpdateNote(not.id, { color: c.value })}
                            >
                              {c.label}
                            </Menu.Item>
                          ))}
                        </Menu.Dropdown>
                      </Menu>
                    </>
                  )}
                  <Tooltip label={(not.pinned ?? false) ? 'Sabitten kaldır' : 'Sabitle'}>
                    <ActionIcon
                      variant="subtle"
                      color={(not.pinned ?? false) ? 'violet' : 'gray'}
                      size="md"
                      radius="lg"
                      onClick={() => onTogglePin(not.id)}
                    >
                      {(not.pinned ?? false) ? <IconPin size={18} /> : <IconPinnedOff size={18} />}
                    </ActionIcon>
                  </Tooltip>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="md"
                    radius="lg"
                    onClick={() => onDeleteNote(not.id)}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))
        )}
      </Stack>
    </ScrollArea>
  );
}
