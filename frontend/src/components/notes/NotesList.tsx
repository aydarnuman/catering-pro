'use client';

/**
 * NotesList - DnD sortable list of notes with empty/loading states + inline checklist
 */

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
  Box,
  Button,
  Center,
  Checkbox,
  Divider,
  Group,
  Loader,
  Menu,
  ScrollArea,
  Stack,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import { IconListCheck, IconNotes, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import type { NoteColor, NoteFolder, UnifiedNote } from '@/types/notes';
import { NoteAttachments } from './NoteAttachments';
import { NoteCard } from './NoteCard';
import { type ChecklistItem, NoteChecklist } from './NoteChecklist';

// ── Sortable wrapper ──
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
  extraMenuItems?: React.ReactNode;
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
      <NoteCard note={note} showDragHandle dragHandleProps={{ ...attributes, ...listeners }} {...props} />
    </div>
  );
}

interface NotesListProps {
  notes: UnifiedNote[];
  allNotes: UnifiedNote[];
  isLoading: boolean;
  activeTab: 'notes' | 'tasks';
  searchQuery: string;
  pinnedCount: number;
  folders: NoteFolder[];
  composerOpen: boolean;
  onOpenComposer: () => void;
  onToggleComplete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (note: UnifiedNote) => void;
  onColorChange: (id: string, color: NoteColor) => void;
  onReorder: (noteIds: string[]) => void;
  onMoveToFolder: (noteId: string, folderId: number | null) => void;
  onRefresh: () => void;
}

export function NotesList({
  notes,
  allNotes,
  isLoading,
  activeTab,
  searchQuery,
  pinnedCount,
  folders,
  composerOpen,
  onOpenComposer,
  onToggleComplete,
  onTogglePin,
  onDelete,
  onEdit,
  onColorChange,
  onReorder,
  onMoveToFolder,
  onRefresh,
}: NotesListProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isTaskView = activeTab === 'tasks';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = notes.findIndex((n) => n.id === active.id);
      const newIndex = notes.findIndex((n) => n.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...notes];
        const [moved] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, moved);
        onReorder(newOrder.map((n) => n.id));
      }
    },
    [notes, onReorder]
  );

  // Inline checklist items (tasks tab)
  const inlineChecklist = useMemo(() => {
    if (!isTaskView) return [];
    const items: Array<ChecklistItem & { noteId: string; noteTitle: string }> = [];
    for (const note of allNotes) {
      const meta = note.metadata as Record<string, unknown> | undefined;
      const cl = meta?.checklist;
      if (Array.isArray(cl)) {
        const title = note.title || note.content.replace(/<[^>]+>/g, '').slice(0, 50);
        for (const item of cl as ChecklistItem[]) items.push({ ...item, noteId: note.id, noteTitle: title });
      }
    }
    return items;
  }, [allNotes, isTaskView]);

  return (
    <ScrollArea style={{ flex: 1 }} px="lg" pb="md">
      {isLoading ? (
        <Center h={200}>
          <Stack align="center" gap="xs">
            <Loader size="md" color="violet" />
            <Text size="sm" c="dimmed">
              Yukleniyor...
            </Text>
          </Stack>
        </Center>
      ) : notes.length === 0 ? (
        <Center style={{ flex: 1, minHeight: 240 }}>
          <Stack align="center" gap="md">
            <Box
              className="ws-empty-icon"
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(99,102,241,0.03) 100%)',
                border: `1px solid ${isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)'}`,
              }}
            >
              {searchQuery ? (
                <IconSearch size={32} stroke={1.3} color="var(--mantine-color-gray-5)" />
              ) : isTaskView ? (
                <IconListCheck size={32} stroke={1.3} color="var(--mantine-color-orange-4)" />
              ) : (
                <IconNotes size={32} stroke={1.3} color="var(--mantine-color-violet-4)" />
              )}
            </Box>
            <Stack align="center" gap={4}>
              <Text size="md" fw={600} c={isDark ? 'gray.4' : 'gray.7'}>
                {searchQuery ? 'Sonuc bulunamadi' : isTaskView ? 'Gorev listeniz temiz' : 'Henuz not eklenmemis'}
              </Text>
              <Text size="xs" c="dimmed" ta="center" maw={280}>
                {searchQuery
                  ? 'Farkli anahtar kelimelerle deneyin'
                  : isTaskView
                    ? 'Yeni gorevler ekleyerek islerinizi takip edin'
                    : 'Fikirlerinizi ve planlarinizi burada yonetin'}
              </Text>
            </Stack>
            {!searchQuery && !composerOpen && (
              <Button
                variant="light"
                size="sm"
                color="violet"
                leftSection={<IconPlus size={16} />}
                onClick={onOpenComposer}
                mt={4}
                radius="md"
              >
                {isTaskView ? 'Yeni gorev ekle' : 'Ilk notunu olustur'}
              </Button>
            )}
          </Stack>
        </Center>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            <Stack gap="xs">
              {notes.map((note, idx) => (
                <Stack key={note.id} gap={4}>
                  {activeTab === 'notes' && pinnedCount > 0 && idx === pinnedCount && (
                    <Divider
                      my={4}
                      label={
                        <Text size="xs" c="dimmed" fw={500}>
                          Diger notlar
                        </Text>
                      }
                      labelPosition="left"
                    />
                  )}
                  <SortableNoteCard
                    note={note}
                    onToggleComplete={onToggleComplete}
                    onTogglePin={onTogglePin}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onColorChange={onColorChange}
                    extraMenuItems={
                      activeTab === 'notes' && folders.length > 0 ? (
                        <>
                          <Menu.Divider />
                          <Menu.Label>Klasore tasi</Menu.Label>
                          {note.folder_id && (
                            <Menu.Item leftSection={<IconX size={12} />} onClick={() => onMoveToFolder(note.id, null)}>
                              Klasorden cikar
                            </Menu.Item>
                          )}
                          {folders
                            .filter((f) => f.id !== note.folder_id)
                            .map((f) => (
                              <Menu.Item
                                key={f.id}
                                leftSection={
                                  <Box
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      background: `var(--mantine-color-${f.color}-5)`,
                                    }}
                                  />
                                }
                                onClick={() => onMoveToFolder(note.id, f.id)}
                              >
                                {f.name}
                              </Menu.Item>
                            ))}
                        </>
                      ) : undefined
                    }
                  />
                  {note.attachments && note.attachments.length > 0 && (
                    <Box ml={28}>
                      <NoteAttachments noteId={note.id} attachments={note.attachments} onUpdate={onRefresh} />
                    </Box>
                  )}
                  {Array.isArray((note.metadata as Record<string, unknown>)?.checklist) &&
                    ((note.metadata as Record<string, unknown>).checklist as ChecklistItem[]).length > 0 && (
                      <Box ml={28}>
                        <NoteChecklist
                          items={(note.metadata as Record<string, unknown>).checklist as ChecklistItem[]}
                          onChange={() => {}}
                          readonly
                        />
                      </Box>
                    )}
                </Stack>
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      {/* Inline checklist (tasks tab) */}
      {isTaskView && inlineChecklist.length > 0 && (
        <Box mt="lg">
          <Divider
            label={
              <Text size="xs" fw={600} c="dimmed">
                Not Ici Gorevler ({inlineChecklist.filter((i) => i.done).length}/{inlineChecklist.length})
              </Text>
            }
            labelPosition="left"
            mb="sm"
          />
          <Stack gap={4}>
            {inlineChecklist.map((item) => (
              <Group key={`${item.noteId}-${item.id}`} gap="xs" wrap="nowrap">
                <Checkbox
                  checked={item.done}
                  size="xs"
                  radius="xl"
                  readOnly
                  styles={{ input: { cursor: 'default' } }}
                />
                <Text
                  size="xs"
                  style={{
                    flex: 1,
                    textDecoration: item.done ? 'line-through' : 'none',
                    opacity: item.done ? 0.5 : 1,
                  }}
                >
                  {item.text}
                </Text>
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  {item.noteTitle}
                </Text>
              </Group>
            ))}
          </Stack>
        </Box>
      )}
    </ScrollArea>
  );
}
