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
  arrayMove,
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
  ColorSwatch,
  FileButton,
  Group,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  TagsInput,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconAlarm,
  IconBold,
  IconCalendar,
  IconCheck,
  IconClock,
  IconCode,
  IconDots,
  IconEdit,
  IconFile,
  IconGripVertical,
  IconItalic,
  IconLink,
  IconList,
  IconNote,
  IconPaperclip,
  IconPhoto,
  IconPin,
  IconPinnedOff,
  IconPlus,
  IconStrikethrough,
  IconTag,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { notesAPI } from '@/lib/api/services/notes';
import { tendersAPI } from '@/lib/api/services/tenders';

// Types
type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple';

export interface NoteAttachment {
  id: number;
  note_id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
}

export interface Note {
  id: string;
  text: string;
  color: NoteColor;
  pinned: boolean;
  tags: string[];
  order: number;
  reminder_date: string | null;
  created_at: string;
  updated_at: string;
  attachments?: NoteAttachment[];
}

interface NotesSectionProps {
  trackingId: number;
  tenderId: number;
  initialNotes?: Note[];
  onNotesChange?: (notes: Note[]) => void;
}

// Color definitions
const NOTE_COLORS: Record<NoteColor, { bg: string; border: string; accent: string; name: string }> =
  {
    yellow: {
      bg: 'linear-gradient(145deg, #fff9c4 0%, #fff59d 100%)',
      border: '#fbc02d',
      accent: '#f57f17',
      name: 'Sarı',
    },
    blue: {
      bg: 'linear-gradient(145deg, #e3f2fd 0%, #bbdefb 100%)',
      border: '#42a5f5',
      accent: '#1565c0',
      name: 'Mavi',
    },
    green: {
      bg: 'linear-gradient(145deg, #e8f5e9 0%, #c8e6c9 100%)',
      border: '#66bb6a',
      accent: '#2e7d32',
      name: 'Yeşil',
    },
    pink: {
      bg: 'linear-gradient(145deg, #fce4ec 0%, #f8bbd0 100%)',
      border: '#ec407a',
      accent: '#c2185b',
      name: 'Pembe',
    },
    orange: {
      bg: 'linear-gradient(145deg, #fff3e0 0%, #ffe0b2 100%)',
      border: '#ffa726',
      accent: '#e65100',
      name: 'Turuncu',
    },
    purple: {
      bg: 'linear-gradient(145deg, #f3e5f5 0%, #e1bee7 100%)',
      border: '#ab47bc',
      accent: '#7b1fa2',
      name: 'Mor',
    },
  };

// Markdown formatting helpers
const formatMarkdown = (text: string): React.ReactNode => {
  // Simple markdown parser
  let formatted = text;

  // Bold
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Strikethrough
  formatted = formatted.replace(/~~(.*?)~~/g, '<del>$1</del>');
  // Code
  formatted = formatted.replace(
    /`(.*?)`/g,
    '<code style="background:#f1f3f4;padding:2px 4px;border-radius:3px;font-size:0.85em">$1</code>'
  );
  // Links
  formatted = formatted.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" style="color:#1976d2">$1</a>'
  );

  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
};

// Sortable Note Card Component
function SortableNoteCard({
  note,
  onEdit,
  onDelete,
  onPinToggle,
  onColorChange,
  onAddAttachment,
  onDeleteAttachment,
  isEditing,
}: {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onPinToggle: (noteId: string) => void;
  onColorChange: (noteId: string, color: NoteColor) => void;
  onAddAttachment: (noteId: string, file: File) => void;
  onDeleteAttachment: (noteId: string, attachmentId: number) => void;
  isEditing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    disabled: isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const colorConfig = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const hasReminder = note.reminder_date && new Date(note.reminder_date) > new Date();
  const isPastReminder = note.reminder_date && new Date(note.reminder_date) <= new Date();

  return (
    <Paper
      ref={setNodeRef}
      style={{
        ...style,
        background: colorConfig.bg,
        border: `2px solid ${note.pinned ? colorConfig.accent : 'transparent'}`,
        borderLeft: `4px solid ${colorConfig.border}`,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.2s ease',
        position: 'relative',
        cursor: 'default',
      }}
      p="sm"
      radius="md"
    >
      {/* Drag Handle */}
      <Box
        {...attributes}
        {...listeners}
        style={{
          position: 'absolute',
          top: 8,
          left: 4,
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: 0.4,
          transition: 'opacity 0.2s',
        }}
        className="drag-handle"
      >
        <IconGripVertical size={16} />
      </Box>

      {/* Pin Badge */}
      {note.pinned && (
        <Box
          style={{
            position: 'absolute',
            top: -8,
            right: 8,
            transform: 'rotate(30deg)',
          }}
        >
          <ThemeIcon size="sm" color={colorConfig.accent} radius="xl">
            <IconPin size={12} />
          </ThemeIcon>
        </Box>
      )}

      {/* Actions Menu */}
      <Group
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
        }}
        gap={2}
      >
        {/* Reminder indicator */}
        {(hasReminder || isPastReminder) && (
          <Tooltip
            label={
              isPastReminder
                ? 'Hatırlatma geçti'
                : `Hatırlatma: ${new Date(note.reminder_date!).toLocaleString('tr-TR')}`
            }
          >
            <ThemeIcon size="xs" color={isPastReminder ? 'red' : 'blue'} variant="light">
              <IconAlarm size={10} />
            </ThemeIcon>
          </Tooltip>
        )}

        <Menu shadow="md" width={160} position="bottom-end">
          <Menu.Target>
            <ActionIcon size="xs" variant="subtle" color="dark">
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onEdit(note)}>
              Düzenle
            </Menu.Item>
            <Menu.Item
              leftSection={note.pinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
              onClick={() => onPinToggle(note.id)}
            >
              {note.pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}
            </Menu.Item>

            <Menu.Divider />

            <Menu.Label>Renk Seç</Menu.Label>
            <Group p="xs" gap={4}>
              {Object.entries(NOTE_COLORS).map(([color, config]) => (
                <Tooltip key={color} label={config.name}>
                  <ColorSwatch
                    color={config.border}
                    size={20}
                    style={{
                      cursor: 'pointer',
                      border: note.color === color ? '2px solid #333' : 'none',
                    }}
                    onClick={() => onColorChange(note.id, color as NoteColor)}
                  />
                </Tooltip>
              ))}
            </Group>

            <Menu.Divider />

            <Menu.Item
              leftSection={<IconTrash size={14} />}
              color="red"
              onClick={() => onDelete(note.id)}
            >
              Sil
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Note Content */}
      <Box pl="md" pr="xl" pt={note.pinned ? 'sm' : 0}>
        <Text
          size="sm"
          style={{
            lineHeight: 1.5,
            wordBreak: 'break-word',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
          }}
        >
          {formatMarkdown(note.text)}
        </Text>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <Group gap={4} mt="xs">
            {note.tags.map((tag) => (
              <Badge
                key={tag}
                size="xs"
                variant="light"
                color="gray"
                leftSection={<IconTag size={10} />}
              >
                {tag}
              </Badge>
            ))}
          </Group>
        )}

        {/* Attachments */}
        {note.attachments && note.attachments.length > 0 && (
          <Group gap={4} mt="xs">
            {note.attachments.map((att) => (
              <Tooltip key={att.id} label={att.original_filename}>
                <Badge
                  size="xs"
                  variant="outline"
                  leftSection={
                    att.file_type?.startsWith('image/') ? (
                      <IconPhoto size={10} />
                    ) : (
                      <IconFile size={10} />
                    )
                  }
                  rightSection={
                    <ActionIcon
                      size={12}
                      variant="transparent"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAttachment(note.id, att.id);
                      }}
                    >
                      <IconX size={8} />
                    </ActionIcon>
                  }
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    window.open(notesAPI.getAttachmentDownloadUrl(String(att.id)), '_blank')
                  }
                >
                  {att.original_filename.length > 10
                    ? `${att.original_filename.substring(0, 10)}...`
                    : att.original_filename}
                </Badge>
              </Tooltip>
            ))}
          </Group>
        )}

        {/* Footer */}
        <Group justify="space-between" mt="xs">
          <Text size="xs" c="dimmed">
            {new Date(note.created_at).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>

          <FileButton
            onChange={(file) => file && onAddAttachment(note.id, file)}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          >
            {(props) => (
              <Tooltip label="Dosya Ekle">
                <ActionIcon {...props} size="xs" variant="subtle" color="gray">
                  <IconPaperclip size={12} />
                </ActionIcon>
              </Tooltip>
            )}
          </FileButton>
        </Group>
      </Box>
    </Paper>
  );
}

// Main NotesSection Component
export default function NotesSection({
  trackingId,
  tenderId,
  initialNotes = [],
  onNotesChange,
}: NotesSectionProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [_isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  // New note form state
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteColor, setNewNoteColor] = useState<NoteColor>('yellow');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [newNoteReminder, setNewNoteReminder] = useState<Date | null>(null);
  const [newNoteReminderTime, setNewNoteReminderTime] = useState<string>('09:00');
  const [newNotePinned, setNewNotePinned] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    if (!trackingId) return;

    setIsLoading(true);
    try {
      const data = await tendersAPI.getTenderNotes(trackingId);
      if (data.success && data.data) {
        // API'den gelen veriyi Note tipine dönüştür
        const notes = data.data.map((note) => ({
          id: String(note.id || ''),
          text: note.text || note.not || '',
          color: (note.color || 'yellow') as NoteColor,
          pinned: note.pinned || false,
          tags: note.tags || [],
          order: note.order || 0,
          reminder_date: note.reminder_date || null,
          created_at: note.created_at || new Date().toISOString(),
          updated_at: note.updated_at || new Date().toISOString(),
          attachments: note.attachments as NoteAttachment[] | undefined,
        })) as Note[];
        setNotes(notes);
        onNotesChange?.(notes);
      }
    } catch (error) {
      console.error('Not yükleme hatası:', error);
    } finally {
      setIsLoading(false);
    }
  }, [trackingId, onNotesChange]);

  // Fetch tag suggestions
  const fetchTagSuggestions = useCallback(async () => {
    try {
      const data = await tendersAPI.getTagSuggestions();
      if (data.success) {
        setTagSuggestions(data.data || []);
      }
    } catch (error) {
      console.error('Tag suggestions hatası:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
    fetchTagSuggestions();
  }, [fetchNotes, fetchTagSuggestions]);

  // Reset form
  const resetForm = () => {
    setNewNoteText('');
    setNewNoteColor('yellow');
    setNewNoteTags([]);
    setNewNoteReminder(null);
    setNewNoteReminderTime('09:00');
    setNewNotePinned(false);
    setEditingNote(null);
  };

  // Combine date and time for reminder
  const getCombinedReminderDate = (): Date | null => {
    if (!newNoteReminder) return null;
    const [hours, minutes] = newNoteReminderTime.split(':').map(Number);
    const combined = new Date(newNoteReminder);
    combined.setHours(hours || 9, minutes || 0, 0, 0);
    return combined;
  };

  // Helper: API'den dönen notu Note tipine dönüştür
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertToNote = (apiNote: any): Note => ({
    id: String(apiNote?.id || ''),
    text: apiNote?.text || apiNote?.not || '',
    color: (apiNote?.color || 'yellow') as NoteColor,
    pinned: apiNote?.pinned || false,
    tags: apiNote?.tags || [],
    order: apiNote?.order || 0,
    reminder_date: apiNote?.reminder_date || null,
    created_at: apiNote?.created_at || new Date().toISOString(),
    updated_at: apiNote?.updated_at || new Date().toISOString(),
    attachments: apiNote?.attachments as NoteAttachment[] | undefined,
  });

  // Add note
  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;

    const reminderDate = getCombinedReminderDate();

    try {
      const response = await tendersAPI.createTenderNote(trackingId, {
        text: newNoteText,
        color: newNoteColor,
        pinned: newNotePinned,
        tags: newNoteTags,
        reminder_date: reminderDate?.toISOString() || null,
      });

      if (response.success && response.data) {
        const newNote = convertToNote(response.data);
        setNotes((prev) => {
          const newNotes = newNotePinned
            ? [newNote, ...prev]
            : [...prev.filter((n) => n.pinned), newNote, ...prev.filter((n) => !n.pinned)];
          onNotesChange?.(newNotes);
          return newNotes;
        });
        resetForm();
        setIsAddModalOpen(false);
        notifications.show({
          title: '✅ Not Eklendi',
          message: 'Notunuz başarıyla kaydedildi',
          color: 'green',
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Not eklenemedi',
        color: 'red',
      });
    }
  };

  // Update note
  const handleUpdateNote = async () => {
    if (!editingNote || !newNoteText.trim()) return;

    const reminderDate = getCombinedReminderDate();

    try {
      const response = await tendersAPI.updateTenderNote(trackingId, Number(editingNote.id), {
        text: newNoteText,
        color: newNoteColor,
        pinned: newNotePinned,
        tags: newNoteTags,
        reminder_date: reminderDate?.toISOString() || null,
      });

      if (response.success && response.data) {
        const updatedNote = convertToNote(response.data);
        setNotes((prev) => {
          const newNotes = prev.map((n) => (n.id === editingNote.id ? updatedNote : n));
          onNotesChange?.(newNotes);
          return newNotes;
        });
        resetForm();
        setIsAddModalOpen(false);
        notifications.show({
          title: '✅ Not Güncellendi',
          message: 'Değişiklikler kaydedildi',
          color: 'green',
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Not güncellenemedi',
        color: 'red',
      });
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const data = await tendersAPI.deleteTenderNote(trackingId, Number(noteId));

      if (data.success) {
        setNotes((prev) => {
          const newNotes = prev.filter((n) => n.id !== noteId);
          onNotesChange?.(newNotes);
          return newNotes;
        });
        notifications.show({
          title: '🗑️ Not Silindi',
          message: 'Not başarıyla silindi',
          color: 'orange',
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Not silinemedi',
        color: 'red',
      });
    }
  };

  // Toggle pin
  const handlePinToggle = async (noteId: string) => {
    try {
      const note = notes.find((n) => n.id === noteId);
      const response = await tendersAPI.pinTenderNote(trackingId, Number(noteId), !note?.pinned);

      if (response.success && response.data) {
        const updatedNote = convertToNote(response.data);
        setNotes((prev) => {
          const newNotes = prev.map((n) => (n.id === noteId ? updatedNote : n));
          // Re-sort: pinned first
          newNotes.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (a.order || 0) - (b.order || 0);
          });
          onNotesChange?.(newNotes);
          return newNotes;
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Pin durumu değiştirilemedi',
        color: 'red',
      });
    }
  };

  // Change color
  const handleColorChange = async (noteId: string, color: NoteColor) => {
    try {
      const response = await tendersAPI.updateTenderNote(trackingId, Number(noteId), { color });

      if (response.success && response.data) {
        const updatedNote = convertToNote(response.data);
        setNotes((prev) => {
          const newNotes = prev.map((n) => (n.id === noteId ? updatedNote : n));
          onNotesChange?.(newNotes);
          return newNotes;
        });
      }
    } catch (error) {
      console.error('Renk değiştirme hatası:', error);
    }
  };

  // Add attachment
  const handleAddAttachment = async (noteId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await tendersAPI.addTenderNoteAttachment(trackingId, Number(noteId), formData);

      if (data.success) {
        // Refresh notes to get updated attachments
        await fetchNotes();
        notifications.show({
          title: '📎 Dosya Eklendi',
          message: file.name,
          color: 'green',
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Dosya yüklenemedi',
        color: 'red',
      });
    }
  };

  // Delete attachment
  const handleDeleteAttachment = async (noteId: string, attachmentId: number) => {
    try {
      const data = await tendersAPI.deleteTenderNoteAttachment(
        trackingId,
        Number(noteId),
        attachmentId
      );

      if (data.success) {
        setNotes((prev) => {
          const newNotes = prev.map((n) =>
            n.id === noteId
              ? { ...n, attachments: n.attachments?.filter((a) => a.id !== attachmentId) }
              : n
          );
          onNotesChange?.(newNotes);
          return newNotes;
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Dosya silinemedi',
        color: 'red',
      });
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = notes.findIndex((n) => n.id === active.id);
    const newIndex = notes.findIndex((n) => n.id === over.id);

    const newNotes = arrayMove(notes, oldIndex, newIndex);
    setNotes(newNotes);
    onNotesChange?.(newNotes);

    // Save new order to backend
    try {
      await tendersAPI.reorderTenderNotes(
        trackingId,
        newNotes.map((n) => Number(n.id))
      );
    } catch (error) {
      console.error('Sıralama kaydetme hatası:', error);
    }
  };

  // Open edit modal
  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNewNoteText(note.text);
    setNewNoteColor(note.color);
    setNewNoteTags(note.tags || []);

    if (note.reminder_date) {
      const reminderDate = new Date(note.reminder_date);
      setNewNoteReminder(reminderDate);
      const hours = reminderDate.getHours().toString().padStart(2, '0');
      const minutes = reminderDate.getMinutes().toString().padStart(2, '0');
      setNewNoteReminderTime(`${hours}:${minutes}`);
    } else {
      setNewNoteReminder(null);
      setNewNoteReminderTime('09:00');
    }

    setNewNotePinned(note.pinned);
    setIsAddModalOpen(true);
  };

  // Insert markdown formatting
  const insertFormatting = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newNoteText.substring(start, end);
    const newText =
      newNoteText.substring(0, start) + before + selectedText + after + newNoteText.substring(end);

    setNewNoteText(newText);

    // Reset cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      shadow="xs"
      style={{
        background: isDark
          ? 'rgba(255, 255, 255, 0.02)'
          : 'linear-gradient(145deg, #fffde7 0%, #fff9c4 50%, #fff59d 100%)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#fbc02d',
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <ThemeIcon
            size="md"
            variant="gradient"
            gradient={{ from: 'orange', to: 'yellow', deg: 45 }}
            radius="md"
          >
            <IconNote size={16} />
          </ThemeIcon>
          <div>
            <Text size="sm" fw={700} c={isDark ? 'white' : 'dark'}>
              Notlarım
            </Text>
            <Text size="xs" c="dimmed">
              Yapışkan notlar, hatırlatıcılar, etiketler
            </Text>
          </div>
          {notes.length > 0 && (
            <Badge
              size="sm"
              variant="gradient"
              gradient={{ from: 'orange', to: 'yellow' }}
              c="dark"
            >
              {notes.length}
            </Badge>
          )}
        </Group>

        <Tooltip label="Yeni Not Ekle">
          <ActionIcon
            variant="gradient"
            gradient={{ from: 'orange', to: 'yellow' }}
            size="md"
            radius="md"
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Notes Grid */}
      {notes.length > 0 ? (
        <ScrollArea.Autosize mah={350} offsetScrollbars>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs">
                {notes.map((note) => (
                  <SortableNoteCard
                    key={note.id}
                    note={note}
                    onEdit={handleEditNote}
                    onDelete={handleDeleteNote}
                    onPinToggle={handlePinToggle}
                    onColorChange={handleColorChange}
                    onAddAttachment={handleAddAttachment}
                    onDeleteAttachment={handleDeleteAttachment}
                    isEditing={editingNote?.id === note.id}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        </ScrollArea.Autosize>
      ) : (
        <Paper
          p="lg"
          withBorder
          radius="md"
          style={{
            background: 'rgba(255, 255, 255, 0.5)',
            borderStyle: 'dashed',
            textAlign: 'center',
          }}
        >
          <IconNote size={32} color="var(--mantine-color-gray-5)" />
          <Text size="sm" c="dimmed" mt="xs">
            Henüz not eklenmemiş
          </Text>
          <Button
            size="xs"
            variant="light"
            color="yellow"
            mt="sm"
            leftSection={<IconPlus size={14} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            İlk Notu Ekle
          </Button>
        </Paper>
      )}

      {/* Add/Edit Note Modal */}
      <Modal
        opened={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title={
          <Group gap="xs">
            <ThemeIcon color={newNoteColor} variant="light" size="sm">
              <IconNote size={14} />
            </ThemeIcon>
            <Text fw={600}>{editingNote ? 'Notu Düzenle' : 'Yeni Not'}</Text>
          </Group>
        }
        size="lg"
        radius="md"
      >
        <Stack gap="md">
          {/* Color Selection */}
          <Group gap="xs">
            <Text size="sm" fw={500}>
              Renk:
            </Text>
            {Object.entries(NOTE_COLORS).map(([color, config]) => (
              <Tooltip key={color} label={config.name}>
                <ColorSwatch
                  color={config.border}
                  size={24}
                  style={{
                    cursor: 'pointer',
                    border: newNoteColor === color ? '3px solid #333' : '2px solid transparent',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => setNewNoteColor(color as NoteColor)}
                />
              </Tooltip>
            ))}
          </Group>

          {/* Formatting Toolbar */}
          <Paper p="xs" radius="sm" className="nested-card">
            <Group gap={4}>
              <Tooltip label="Kalın">
                <ActionIcon variant="subtle" size="sm" onClick={() => insertFormatting('**', '**')}>
                  <IconBold size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="İtalik">
                <ActionIcon variant="subtle" size="sm" onClick={() => insertFormatting('*', '*')}>
                  <IconItalic size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Üstü Çizili">
                <ActionIcon variant="subtle" size="sm" onClick={() => insertFormatting('~~', '~~')}>
                  <IconStrikethrough size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Kod">
                <ActionIcon variant="subtle" size="sm" onClick={() => insertFormatting('`', '`')}>
                  <IconCode size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Link">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => insertFormatting('[', '](url)')}
                >
                  <IconLink size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Liste">
                <ActionIcon variant="subtle" size="sm" onClick={() => insertFormatting('- ', '')}>
                  <IconList size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Paper>

          {/* Text Input */}
          <Textarea
            ref={textareaRef}
            placeholder="Notunuzu yazın... (Markdown desteklenir: **kalın**, *italik*, ~~üstü çizili~~, `kod`, [link](url))"
            minRows={4}
            maxRows={8}
            autosize
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            styles={{
              input: {
                background: NOTE_COLORS[newNoteColor].bg,
                borderColor: NOTE_COLORS[newNoteColor].border,
              },
            }}
          />

          {/* Preview */}
          {newNoteText && (
            <Paper
              p="sm"
              withBorder
              radius="sm"
              style={{
                background: NOTE_COLORS[newNoteColor].bg,
                borderColor: NOTE_COLORS[newNoteColor].border,
              }}
            >
              <Text size="xs" c="dimmed" mb="xs">
                Önizleme:
              </Text>
              <Text size="sm">{formatMarkdown(newNoteText)}</Text>
            </Paper>
          )}

          {/* Tags */}
          <TagsInput
            label="Etiketler"
            placeholder="Etiket ekle (Enter)"
            value={newNoteTags}
            onChange={setNewNoteTags}
            data={tagSuggestions}
            leftSection={<IconTag size={14} />}
            clearable
          />

          {/* Reminder */}
          <Box>
            <Text size="sm" fw={500} mb={4}>
              Hatırlatıcı
            </Text>
            <Paper
              p="xs"
              withBorder
              radius="md"
              style={{
                background: newNoteReminder
                  ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)'
                  : undefined,
                borderColor: newNoteReminder ? 'var(--mantine-color-blue-4)' : undefined,
              }}
            >
              <Group gap="sm" align="flex-end">
                <DatePickerInput
                  placeholder="Tarih seç"
                  value={newNoteReminder}
                  onChange={setNewNoteReminder}
                  leftSection={
                    <IconCalendar size={16} style={{ color: 'var(--mantine-color-blue-6)' }} />
                  }
                  clearable
                  minDate={new Date()}
                  size="sm"
                  radius="md"
                  style={{ flex: 1 }}
                  valueFormat="DD MMM YYYY"
                  popoverProps={{
                    shadow: 'lg',
                    radius: 'md',
                  }}
                  styles={{
                    input: {
                      fontWeight: 500,
                    },
                    calendarHeader: {
                      marginBottom: 8,
                    },
                    calendarHeaderControl: {
                      width: 32,
                      height: 32,
                    },
                    day: {
                      borderRadius: 8,
                      transition: 'all 0.15s ease',
                    },
                  }}
                />

                <TimeInput
                  ref={timeInputRef}
                  value={newNoteReminderTime}
                  onChange={(e) => setNewNoteReminderTime(e.currentTarget.value)}
                  leftSection={
                    <IconClock size={16} style={{ color: 'var(--mantine-color-violet-6)' }} />
                  }
                  size="sm"
                  radius="md"
                  disabled={!newNoteReminder}
                  w={110}
                  styles={{
                    input: {
                      fontWeight: 500,
                      fontFamily: 'monospace',
                    },
                  }}
                />

                {newNoteReminder && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => {
                      setNewNoteReminder(null);
                      setNewNoteReminderTime('09:00');
                    }}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                )}
              </Group>

              {newNoteReminder && (
                <Text size="xs" c="blue" mt="xs">
                  <IconAlarm size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {getCombinedReminderDate()?.toLocaleString('tr-TR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </Paper>
          </Box>

          {/* Pin Toggle */}
          <Group>
            <Button
              variant={newNotePinned ? 'filled' : 'outline'}
              color={newNotePinned ? 'orange' : 'gray'}
              size="xs"
              leftSection={newNotePinned ? <IconPin size={14} /> : <IconPinnedOff size={14} />}
              onClick={() => setNewNotePinned(!newNotePinned)}
            >
              {newNotePinned ? 'Sabitlenmiş' : 'Sabitle'}
            </Button>
          </Group>

          {/* Actions */}
          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setIsAddModalOpen(false);
                resetForm();
              }}
            >
              İptal
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: 'orange', to: 'yellow' }}
              c="dark"
              onClick={editingNote ? handleUpdateNote : handleAddNote}
              disabled={!newNoteText.trim()}
              leftSection={editingNote ? <IconCheck size={16} /> : <IconPlus size={16} />}
            >
              {editingNote ? 'Kaydet' : 'Ekle'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
