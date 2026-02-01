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
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Collapse,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconNotes,
  IconPin,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';

import { useNotes } from '@/hooks/useNotes';
import type { CreateNoteDTO, NoteColor, UnifiedNote } from '@/types/notes';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';

interface UnifiedNotesModalProps {
  opened: boolean;
  onClose: () => void;
}

// Sortable note card wrapper
function SortableNoteCard({
  note,
  ...props
}: {
  note: UnifiedNote;
  onToggleComplete?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (note: UnifiedNote) => void;
  onColorChange?: (id: string, color: NoteColor) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <NoteCard
        note={note}
        showDragHandle
        dragHandleProps={{ ...attributes, ...listeners }}
        {...props}
      />
    </div>
  );
}

// Mini Calendar Component
function MiniCalendar({
  selectedDate,
  onDateSelect,
  noteDates,
}: {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  noteDates: Map<string, number>;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDays = ['Pt', 'Sa', 'Ca', 'Pe', 'Cu', 'Ct', 'Pa'];

  return (
    <Paper p="xs" withBorder>
      {/* Month navigation */}
      <Group justify="space-between" mb="xs">
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <IconChevronDown size={14} style={{ transform: 'rotate(90deg)' }} />
        </ActionIcon>
        <Text size="sm" fw={500}>
          {format(currentMonth, 'MMMM yyyy', { locale: tr })}
        </Text>
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <IconChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
        </ActionIcon>
      </Group>

      {/* Weekday headers */}
      <SimpleGrid cols={7} spacing={2}>
        {weekDays.map((day) => (
          <Center key={day}>
            <Text size="xs" c="dimmed" fw={500}>
              {day}
            </Text>
          </Center>
        ))}
      </SimpleGrid>

      {/* Days */}
      <SimpleGrid cols={7} spacing={2} mt={4}>
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const noteCount = noteDates.get(dateKey) || 0;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <Box
              key={dateKey}
              onClick={() => {
                if (isSelected) {
                  onDateSelect(null);
                } else {
                  onDateSelect(day);
                }
              }}
              style={{
                cursor: 'pointer',
                borderRadius: 4,
                padding: 2,
                textAlign: 'center',
                backgroundColor: isSelected
                  ? 'var(--mantine-color-blue-5)'
                  : isTodayDate
                    ? 'var(--mantine-color-blue-1)'
                    : 'transparent',
                opacity: isCurrentMonth ? 1 : 0.3,
              }}
            >
              <Text
                size="xs"
                c={isSelected ? 'white' : isTodayDate ? 'blue' : undefined}
                fw={isTodayDate ? 600 : 400}
              >
                {format(day, 'd')}
              </Text>
              {noteCount > 0 && (
                <Badge size="xs" variant="filled" color="orange" circle>
                  {noteCount}
                </Badge>
              )}
            </Box>
          );
        })}
      </SimpleGrid>
    </Paper>
  );
}

export function UnifiedNotesModal({ opened, onClose }: UnifiedNotesModalProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<UnifiedNote | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Fetch personal notes
  const {
    notes,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
    toggleComplete,
    togglePin,
    reorderNotes,
    deleteCompleted,
  } = useNotes({ enabled: opened });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Filter notes based on active tab and search
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Tab filtering
    if (activeTab === 'pinned') {
      result = result.filter((n) => n.pinned);
    } else if (activeTab === 'agenda') {
      // Filter by selected date if any
      if (selectedDate) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        result = result.filter((n) => {
          if (!n.due_date) return false;
          return format(new Date(n.due_date), 'yyyy-MM-dd') === dateStr;
        });
      } else {
        // Show only notes with due dates
        result = result.filter((n) => n.due_date);
      }
    }

    // Search filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.content.toLowerCase().includes(q) ||
          n.tags?.some((t) => t.name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [notes, activeTab, selectedDate, searchQuery]);

  // Compute note counts by date for calendar
  const noteDates = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach((n) => {
      if (n.due_date) {
        const dateKey = format(new Date(n.due_date), 'yyyy-MM-dd');
        map.set(dateKey, (map.get(dateKey) || 0) + 1);
      }
    });
    return map;
  }, [notes]);

  // Stats
  const stats = useMemo(() => {
    const pending = notes.filter((n) => n.is_task && !n.is_completed).length;
    const completed = notes.filter((n) => n.is_task && n.is_completed).length;
    const pinned = notes.filter((n) => n.pinned).length;
    return { pending, completed, pinned, total: notes.length };
  }, [notes]);

  // Handlers
  const handleCreateNote = useCallback(
    async (data: CreateNoteDTO) => {
      await createNote(data);
      setComposerOpen(false);
    },
    [createNote]
  );

  const handleUpdateNote = useCallback(
    async (data: CreateNoteDTO) => {
      if (!editingNote) return;
      await updateNote(editingNote.id, data);
      setEditingNote(null);
    },
    [editingNote, updateNote]
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote(id);
    },
    [deleteNote]
  );

  const handleToggleComplete = useCallback(
    async (id: string) => {
      await toggleComplete(id);
    },
    [toggleComplete]
  );

  const handleTogglePin = useCallback(
    async (id: string) => {
      await togglePin(id);
    },
    [togglePin]
  );

  const handleColorChange = useCallback(
    async (id: string, color: NoteColor) => {
      await updateNote(id, { color });
    },
    [updateNote]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = filteredNotes.findIndex((n) => n.id === active.id);
      const newIndex = filteredNotes.findIndex((n) => n.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...filteredNotes];
        const [moved] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, moved);
        reorderNotes(newOrder.map((n) => n.id));
      }
    },
    [filteredNotes, reorderNotes]
  );

  const handleDeleteCompleted = useCallback(async () => {
    await deleteCompleted();
  }, [deleteCompleted]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconNotes size={20} />
          <Text fw={600}>Notlar ve Ajanda</Text>
        </Group>
      }
      size="lg"
      centered
      styles={{
        body: { padding: 0 },
      }}
    >
      <Stack gap={0}>
        {/* Stats bar */}
        <Group px="md" py="xs" justify="space-between" bg={isDark ? 'dark.6' : 'gray.0'}>
          <Group gap="md">
            <Badge variant="light" color="blue">
              Toplam: {stats.total}
            </Badge>
            <Badge variant="light" color="orange">
              Bekleyen: {stats.pending}
            </Badge>
            <Badge variant="light" color="green">
              Tamamlanan: {stats.completed}
            </Badge>
            <Badge variant="light" color="violet">
              Sabitlenen: {stats.pinned}
            </Badge>
          </Group>
          {stats.completed > 0 && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={handleDeleteCompleted}
            >
              Tamamlananlari sil
            </Button>
          )}
        </Group>

        {/* Search bar */}
        <Box px="md" py="xs">
          <TextInput
            placeholder="Notlarda ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            size="sm"
          />
        </Box>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List px="md">
            <Tabs.Tab value="all" leftSection={<IconNotes size={14} />}>
              Tumu
            </Tabs.Tab>
            <Tabs.Tab value="pinned" leftSection={<IconPin size={14} />}>
              Sabitlenen
            </Tabs.Tab>
            <Tabs.Tab value="agenda" leftSection={<IconCalendar size={14} />}>
              Ajanda
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <Divider />

        {/* Content area */}
        <Group align="flex-start" gap={0} wrap="nowrap" style={{ minHeight: 400 }}>
          {/* Mini calendar (only for agenda tab) */}
          {activeTab === 'agenda' && (
            <Box
              p="md"
              style={{ borderRight: '1px solid var(--mantine-color-gray-3)', width: 240 }}
            >
              <MiniCalendar
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                noteDates={noteDates}
              />
              {selectedDate && (
                <Button
                  variant="subtle"
                  size="xs"
                  mt="xs"
                  fullWidth
                  onClick={() => setSelectedDate(null)}
                >
                  Filtreyi temizle
                </Button>
              )}
            </Box>
          )}

          {/* Notes list */}
          <Box style={{ flex: 1 }}>
            {/* Add note button / composer */}
            <Box px="md" py="sm">
              <Button
                variant={composerOpen ? 'light' : 'outline'}
                leftSection={composerOpen ? <IconChevronUp size={16} /> : <IconPlus size={16} />}
                onClick={() => setComposerOpen(!composerOpen)}
                fullWidth
              >
                {composerOpen ? 'Kapat' : 'Yeni not ekle'}
              </Button>

              <Collapse in={composerOpen}>
                <Paper p="md" mt="sm" withBorder>
                  <NoteEditor
                    onSave={handleCreateNote}
                    onCancel={() => setComposerOpen(false)}
                    placeholder="Not veya gorev ekle..."
                  />
                  <Group justify="flex-end" mt="md">
                    <Button variant="subtle" onClick={() => setComposerOpen(false)}>
                      Iptal
                    </Button>
                    <Button
                      leftSection={<IconCheck size={16} />}
                      onClick={() => {
                        // Trigger save via form submission
                        const form = document.querySelector('[data-note-editor]');
                        if (form) {
                          (form as HTMLFormElement).requestSubmit();
                        }
                      }}
                    >
                      Kaydet
                    </Button>
                  </Group>
                </Paper>
              </Collapse>
            </Box>

            {/* Notes scroll area */}
            <ScrollArea h={350} px="md" pb="md">
              {isLoading ? (
                <Center h={200}>
                  <Loader />
                </Center>
              ) : filteredNotes.length === 0 ? (
                <Center h={200}>
                  <Stack align="center" gap="xs">
                    <IconNotes size={48} color="gray" opacity={0.5} />
                    <Text c="dimmed" size="sm">
                      {searchQuery
                        ? 'Aramanizla eslesen not bulunamadi'
                        : activeTab === 'pinned'
                          ? 'Sabitlenen not yok'
                          : activeTab === 'agenda'
                            ? selectedDate
                              ? 'Bu tarihte not yok'
                              : 'Tarihli not yok'
                            : 'Henuz not eklenmemis'}
                    </Text>
                    {!searchQuery && activeTab === 'all' && (
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={() => setComposerOpen(true)}
                      >
                        Ilk notunu ekle
                      </Button>
                    )}
                  </Stack>
                </Center>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={filteredNotes.map((n) => n.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Stack gap="xs">
                      {filteredNotes.map((note) => (
                        <SortableNoteCard
                          key={note.id}
                          note={note}
                          onToggleComplete={handleToggleComplete}
                          onTogglePin={handleTogglePin}
                          onDelete={handleDeleteNote}
                          onEdit={setEditingNote}
                          onColorChange={handleColorChange}
                        />
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
              )}
            </ScrollArea>
          </Box>
        </Group>
      </Stack>

      {/* Edit note modal */}
      <Modal
        opened={!!editingNote}
        onClose={() => setEditingNote(null)}
        title="Notu Duzenle"
        size="md"
      >
        {editingNote && (
          <Stack>
            <NoteEditor
              initialContent={editingNote.content}
              initialColor={editingNote.color}
              initialPriority={editingNote.priority}
              initialTags={editingNote.tags?.map((t) => t.name) ?? []}
              initialDueDate={editingNote.due_date ? new Date(editingNote.due_date) : null}
              initialReminderDate={
                editingNote.reminder_date ? new Date(editingNote.reminder_date) : null
              }
              initialIsTask={editingNote.is_task}
              initialContentFormat={editingNote.content_format}
              onSave={handleUpdateNote}
              onCancel={() => setEditingNote(null)}
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setEditingNote(null)}>
                Iptal
              </Button>
              <Button
                leftSection={<IconCheck size={16} />}
                onClick={() => {
                  // Trigger save via form submission
                  const form = document.querySelector('[data-note-editor]');
                  if (form) {
                    (form as HTMLFormElement).requestSubmit();
                  }
                }}
              >
                Kaydet
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Modal>
  );
}

export default UnifiedNotesModal;
