'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  Paper,
  ActionIcon,
  Tooltip,
  Badge,
  FileButton,
  Loader,
  Center,
  Collapse,
  Box,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconGripVertical,
  IconUpload,
  IconPaperclip,
  IconDownload,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useNotes } from '@/hooks/useNotes';
import { notesAPI } from '@/lib/api/services/notes';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import type {
  UnifiedNote,
  CreateNoteDTO,
  NoteColor,
  NoteAttachment,
  NoteContextType,
} from '@/types/notes';

interface ContextualNotesSectionProps {
  /** Context type (tender, customer, event, project) */
  contextType: Exclude<NoteContextType, null>;
  /** Context ID */
  contextId: number;
  /** Optional title */
  title?: string;
  /** Show compact view */
  compact?: boolean;
  /** Default content format */
  defaultContentFormat?: 'plain' | 'markdown';
  /** Show add note button initially */
  showAddButton?: boolean;
  /** Callback when notes change */
  onNotesChange?: (notes: UnifiedNote[]) => void;
}

// Sortable note card with attachments support
function SortableContextNote({
  note,
  onTogglePin,
  onDelete,
  onEdit,
  onColorChange,
  onUploadAttachment,
  onDeleteAttachment,
}: {
  note: UnifiedNote;
  onTogglePin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (note: UnifiedNote) => void;
  onColorChange?: (id: string, color: NoteColor) => void;
  onUploadAttachment?: (noteId: string, file: File) => void;
  onDeleteAttachment?: (noteId: string, attachmentId: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file || !onUploadAttachment) return;
    setUploading(true);
    try {
      await onUploadAttachment(note.id, file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Stack gap="xs">
        <NoteCard
          note={note}
          showDragHandle
          dragHandleProps={{ ...attributes, ...listeners }}
          onTogglePin={onTogglePin}
          onDelete={onDelete}
          onEdit={onEdit}
          onColorChange={onColorChange}
        />

        {/* Attachments */}
        {note.attachments && note.attachments.length > 0 && (
          <Paper p="xs" ml="xl" withBorder style={{ borderStyle: 'dashed' }}>
            <Stack gap={4}>
              {note.attachments.map((attachment) => (
                <Group key={attachment.id} justify="space-between" gap="xs">
                  <Group gap="xs">
                    <IconPaperclip size={14} />
                    <Text size="xs" lineClamp={1} style={{ maxWidth: 200 }}>
                      {attachment.original_filename}
                    </Text>
                    <Badge size="xs" variant="light">
                      {Math.round(attachment.file_size / 1024)} KB
                    </Badge>
                  </Group>
                  <Group gap={4}>
                    <Tooltip label="Indir">
                      <ActionIcon
                        variant="subtle"
                        size="xs"
                        component="a"
                        href={notesAPI.getAttachmentDownloadUrl(attachment.id)}
                        target="_blank"
                      >
                        <IconDownload size={12} />
                      </ActionIcon>
                    </Tooltip>
                    {onDeleteAttachment && (
                      <Tooltip label="Sil">
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          color="red"
                          onClick={() => onDeleteAttachment(note.id, attachment.id)}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              ))}
            </Stack>
          </Paper>
        )}

        {/* Upload button */}
        {onUploadAttachment && (
          <Group ml="xl">
            <FileButton onChange={handleFileUpload} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt">
              {(props) => (
                <Button
                  {...props}
                  variant="subtle"
                  size="xs"
                  leftSection={uploading ? <Loader size={12} /> : <IconUpload size={12} />}
                  disabled={uploading}
                >
                  {uploading ? 'Yukleniyor...' : 'Dosya ekle'}
                </Button>
              )}
            </FileButton>
          </Group>
        )}
      </Stack>
    </div>
  );
}

export function ContextualNotesSection({
  contextType,
  contextId,
  title = 'Notlar',
  compact = false,
  defaultContentFormat = 'markdown',
  showAddButton = true,
  onNotesChange,
}: ContextualNotesSectionProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<UnifiedNote | null>(null);

  // Fetch context notes
  const {
    notes,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    reorderNotes,
    refresh,
  } = useNotes({
    contextType,
    contextId,
    enabled: true,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Notify parent of changes
  const notifyChange = useCallback(() => {
    if (onNotesChange) {
      onNotesChange(notes);
    }
  }, [notes, onNotesChange]);

  // Handlers
  const handleCreateNote = useCallback(
    async (data: CreateNoteDTO) => {
      const result = await createNote({
        ...data,
        content_format: data.content_format || defaultContentFormat,
      });
      if (result) {
        setComposerOpen(false);
        notifyChange();
        notifications.show({
          title: 'Basarili',
          message: 'Not eklendi',
          color: 'green',
        });
      }
    },
    [createNote, defaultContentFormat, notifyChange]
  );

  const handleUpdateNote = useCallback(
    async (data: CreateNoteDTO) => {
      if (!editingNote) return;
      const result = await updateNote(editingNote.id, data);
      if (result) {
        setEditingNote(null);
        notifyChange();
        notifications.show({
          title: 'Basarili',
          message: 'Not guncellendi',
          color: 'green',
        });
      }
    },
    [editingNote, updateNote, notifyChange]
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      const success = await deleteNote(id);
      if (success) {
        notifyChange();
        notifications.show({
          title: 'Basarili',
          message: 'Not silindi',
          color: 'green',
        });
      }
    },
    [deleteNote, notifyChange]
  );

  const handleTogglePin = useCallback(
    async (id: string) => {
      await togglePin(id);
      notifyChange();
    },
    [togglePin, notifyChange]
  );

  const handleColorChange = useCallback(
    async (id: string, color: NoteColor) => {
      await updateNote(id, { color });
      notifyChange();
    },
    [updateNote, notifyChange]
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
        reorderNotes(newOrder.map((n) => n.id));
        notifyChange();
      }
    },
    [notes, reorderNotes, notifyChange]
  );

  const handleUploadAttachment = useCallback(
    async (noteId: string, file: File) => {
      try {
        const result = await notesAPI.uploadAttachment(noteId, file);
        if (result.success) {
          refresh();
          notifyChange();
          notifications.show({
            title: 'Basarili',
            message: 'Dosya yuklendi',
            color: 'green',
          });
        }
      } catch (error) {
        notifications.show({
          title: 'Hata',
          message: 'Dosya yuklenemedi',
          color: 'red',
        });
      }
    },
    [refresh, notifyChange]
  );

  const handleDeleteAttachment = useCallback(
    async (noteId: string, attachmentId: string) => {
      try {
        const result = await notesAPI.deleteAttachment(attachmentId);
        if (result.success) {
          refresh();
          notifyChange();
          notifications.show({
            title: 'Basarili',
            message: 'Dosya silindi',
            color: 'green',
          });
        }
      } catch (error) {
        notifications.show({
          title: 'Hata',
          message: 'Dosya silinemedi',
          color: 'red',
        });
      }
    },
    [refresh, notifyChange]
  );

  // Stats
  const pinnedCount = notes.filter((n) => n.pinned).length;

  return (
    <Stack gap="sm">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={600} size={compact ? 'sm' : 'md'}>
            {title}
          </Text>
          {notes.length > 0 && (
            <Badge variant="light" size="sm">
              {notes.length}
            </Badge>
          )}
          {pinnedCount > 0 && (
            <Badge variant="light" color="violet" size="sm">
              {pinnedCount} sabitlenen
            </Badge>
          )}
        </Group>

        {showAddButton && !composerOpen && (
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setComposerOpen(true)}
          >
            Not ekle
          </Button>
        )}
      </Group>

      {/* Composer */}
      <Collapse in={composerOpen}>
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={500}>
              Yeni Not
            </Text>
            <ActionIcon variant="subtle" size="sm" onClick={() => setComposerOpen(false)}>
              <IconX size={16} />
            </ActionIcon>
          </Group>
          <NoteEditor
            initialContentFormat={defaultContentFormat}
            onSave={handleCreateNote}
            onCancel={() => setComposerOpen(false)}
            showTaskToggle={false}
            showPriority={false}
            showDueDate={false}
            showReminder={true}
            showTags={true}
            placeholder="Not icerigi..."
            minRows={2}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" size="xs" onClick={() => setComposerOpen(false)}>
              Iptal
            </Button>
            <Button size="xs" onClick={() => {}}>
              Kaydet
            </Button>
          </Group>
        </Paper>
      </Collapse>

      {/* Notes list */}
      {isLoading ? (
        <Center h={100}>
          <Loader size="sm" />
        </Center>
      ) : notes.length === 0 ? (
        <Paper p="md" withBorder style={{ borderStyle: 'dashed' }}>
          <Center>
            <Stack align="center" gap="xs">
              <Text c="dimmed" size="sm">
                Henuz not eklenmemis
              </Text>
              {!composerOpen && (
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setComposerOpen(true)}
                >
                  Ilk notu ekle
                </Button>
              )}
            </Stack>
          </Center>
        </Paper>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={notes.map((n) => n.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap="xs">
              {notes.map((note) => (
                <SortableContextNote
                  key={note.id}
                  note={note}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDeleteNote}
                  onEdit={setEditingNote}
                  onColorChange={handleColorChange}
                  onUploadAttachment={handleUploadAttachment}
                  onDeleteAttachment={handleDeleteAttachment}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      {/* Edit modal would go here - for now using inline editing */}
      {editingNote && (
        <Paper p="md" withBorder mt="sm">
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={500}>
              Notu Duzenle
            </Text>
            <ActionIcon variant="subtle" size="sm" onClick={() => setEditingNote(null)}>
              <IconX size={16} />
            </ActionIcon>
          </Group>
          <NoteEditor
            initialContent={editingNote.content}
            initialColor={editingNote.color}
            initialTags={editingNote.tags?.map((t) => t.name) ?? []}
            initialReminderDate={editingNote.reminder_date ? new Date(editingNote.reminder_date) : null}
            initialContentFormat={editingNote.content_format}
            onSave={handleUpdateNote}
            onCancel={() => setEditingNote(null)}
            showTaskToggle={false}
            showPriority={false}
            showDueDate={false}
            showReminder={true}
            showTags={true}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" size="xs" onClick={() => setEditingNote(null)}>
              Iptal
            </Button>
            <Button size="xs" onClick={() => {}}>
              Kaydet
            </Button>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}

export default ContextualNotesSection;
