'use client';

/**
 * NoteCard - Gelismis not karti
 * Baslik + icerik onizleme + checklist progress + etiketler/tarih/ek
 */

import {
  ActionIcon,
  Badge,
  Box,
  Checkbox,
  Group,
  Menu,
  Paper,
  Progress,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconBell,
  IconCalendar,
  IconDotsVertical,
  IconEdit,
  IconFlag,
  IconGripVertical,
  IconPalette,
  IconPaperclip,
  IconPin,
  IconPinFilled,
  IconTrash,
} from '@tabler/icons-react';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useState } from 'react';

import { NOTE_COLORS, type NoteColor, PRIORITY_LABELS, type UnifiedNote } from '@/types/notes';
import type { ChecklistItem } from './NoteChecklist';
import { NoteColorPicker } from './NoteColorPicker';

interface NoteCardProps {
  note: UnifiedNote;
  onToggleComplete?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (note: UnifiedNote) => void;
  onColorChange?: (id: string, color: NoteColor) => void;
  /** Extra menu items to inject into the 3-dot menu */
  extraMenuItems?: React.ReactNode;
  showDragHandle?: boolean;
  compact?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

/**
 * Format due date for display
 */
function formatDueDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isToday(d)) return 'Bugun';
  if (isTomorrow(d)) return 'Yarin';
  if (isPast(d)) return `${formatDistanceToNow(d, { locale: tr })} once`;
  return format(d, 'd MMM', { locale: tr });
}

/**
 * Strip HTML tags and get plain text preview
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get title from note (title field or first line of content)
 */
function getNoteTitle(note: UnifiedNote): string {
  if (note.title) return note.title;
  const plain = stripHtml(note.content);
  const firstLine = plain.split('\n')[0] || plain;
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine;
}

/**
 * Get content preview (excluding title-like first line)
 */
function getContentPreview(note: UnifiedNote): string {
  const plain = stripHtml(note.content);
  if (note.title) return plain.slice(0, 120);
  // Skip first line (used as title), show rest
  const lines = plain.split('\n');
  const rest = lines.slice(1).join(' ').trim();
  return rest.slice(0, 120);
}

export function NoteCard({
  note,
  onToggleComplete,
  onTogglePin,
  onDelete,
  onEdit,
  onColorChange,
  extraMenuItems,
  showDragHandle = false,
  compact = false,
  dragHandleProps,
}: NoteCardProps) {
  const [_colorMenuOpened, _setColorMenuOpened] = useState(false);

  const colorConfig = NOTE_COLORS[note.color] || NOTE_COLORS.blue;
  const dueDateLabel = formatDueDate(note.due_date);
  const isOverdue = note.due_date && isPast(new Date(note.due_date)) && !note.is_completed;
  const hasReminder = note.reminders && note.reminders.length > 0;
  const hasAttachments = note.attachments && note.attachments.length > 0;

  // Checklist from metadata
  const checklist: ChecklistItem[] = (() => {
    const meta = note.metadata as Record<string, unknown> | undefined;
    const items = meta?.checklist;
    return Array.isArray(items) ? items : [];
  })();
  const checklistDone = checklist.filter((i) => i.done).length;
  const checklistTotal = checklist.length;
  const checklistProgress = checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0;

  const title = getNoteTitle(note);
  const preview = getContentPreview(note);

  return (
    <Paper
      p={compact ? 'xs' : 'sm'}
      radius="lg"
      className="ws-note-card"
      style={{
        background: colorConfig.bg,
        borderLeft: `4px solid ${colorConfig.border}`,
        opacity: note.is_completed ? 0.6 : 1,
        cursor: onEdit ? 'pointer' : 'default',
        filter: note.is_completed ? 'saturate(0.6)' : 'none',
      }}
      onClick={() => onEdit?.(note)}
    >
      <Group gap="xs" align="flex-start" wrap="nowrap">
        {/* Drag handle */}
        {showDragHandle && (
          <Box
            {...dragHandleProps}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            style={{
              cursor: 'grab',
              color: 'var(--mantine-color-gray-6)',
              display: 'flex',
              alignItems: 'center',
              paddingTop: 2,
              opacity: 0.4,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.4';
            }}
          >
            <IconGripVertical size={16} />
          </Box>
        )}

        {/* Completion checkbox (for tasks) */}
        {note.is_task && onToggleComplete && (
          <Box onClick={(e: React.MouseEvent) => e.stopPropagation()} pt={2}>
            <Checkbox
              checked={note.is_completed}
              onChange={() => onToggleComplete(note.id)}
              radius="xl"
              size="sm"
              styles={{
                input: {
                  borderColor: colorConfig.accent,
                },
              }}
            />
          </Box>
        )}

        {/* Content */}
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <Text
            size={compact ? 'sm' : 'md'}
            fw={700}
            lineClamp={1}
            style={{
              textDecoration: note.is_completed ? 'line-through' : 'none',
              color: note.is_completed ? 'var(--mantine-color-gray-6)' : colorConfig.accent,
              letterSpacing: '-0.015em',
            }}
          >
            {title}
          </Text>

          {/* Content preview */}
          {preview && (
            <Text
              size="xs"
              c="dimmed"
              lineClamp={2}
              style={{
                textDecoration: note.is_completed ? 'line-through' : 'none',
                lineHeight: 1.5,
                opacity: note.is_completed ? 0.7 : 0.8,
              }}
            >
              {preview}
            </Text>
          )}

          {/* Checklist progress */}
          {checklistTotal > 0 && (
            <Group gap="xs" align="center">
              <Progress
                value={checklistProgress}
                size={4}
                color={checklistProgress === 100 ? 'green' : 'violet'}
                style={{ flex: 1, maxWidth: 120 }}
                radius="xl"
              />
              <Text size="xs" c="dimmed" fw={500} style={{ fontSize: 11 }}>
                {checklistDone}/{checklistTotal}
              </Text>
            </Group>
          )}

          {/* Metadata row */}
          <Group gap={5} wrap="wrap" mt={2}>
            {/* Priority badge */}
            {note.priority !== 'normal' && (
              <Badge
                size="xs"
                variant="light"
                color={
                  note.priority === 'urgent' ? 'red' : note.priority === 'high' ? 'orange' : 'gray'
                }
                leftSection={<IconFlag size={10} />}
              >
                {PRIORITY_LABELS[note.priority]}
              </Badge>
            )}

            {/* Due date */}
            {dueDateLabel && (
              <Badge
                size="xs"
                variant="light"
                color={isOverdue ? 'red' : 'blue'}
                leftSection={<IconCalendar size={10} />}
              >
                {dueDateLabel}
              </Badge>
            )}

            {/* Reminder indicator */}
            {hasReminder && (
              <Tooltip label="Hatirlatici var">
                <Badge
                  size="xs"
                  variant="light"
                  color="violet"
                  leftSection={<IconBell size={10} />}
                >
                  {note.reminders.length}
                </Badge>
              </Tooltip>
            )}

            {/* Attachment indicator */}
            {hasAttachments && (
              <Tooltip label={`${note.attachments.length} dosya`}>
                <Badge
                  size="xs"
                  variant="light"
                  color="cyan"
                  leftSection={<IconPaperclip size={10} />}
                >
                  {note.attachments.length}
                </Badge>
              </Tooltip>
            )}

            {/* Tags */}
            {note.tags?.slice(0, 3).map((tag) => (
              <Badge key={tag.id} size="xs" variant="dot" color={tag.color || 'gray'}>
                {tag.name}
              </Badge>
            ))}
            {note.tags && note.tags.length > 3 && (
              <Badge size="xs" variant="light" color="gray">
                +{note.tags.length - 3}
              </Badge>
            )}
          </Group>
        </Stack>

        {/* Actions */}
        <Group gap={4} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          {/* Pin button */}
          {onTogglePin && (
            <Tooltip label={note.pinned ? 'Sabitlemeyi kaldir' : 'Sabitle'}>
              <ActionIcon
                variant="subtle"
                size="sm"
                color={note.pinned ? colorConfig.accent : 'gray'}
                onClick={() => onTogglePin(note.id)}
              >
                {note.pinned ? <IconPinFilled size={16} /> : <IconPin size={16} />}
              </ActionIcon>
            </Tooltip>
          )}

          {/* More actions menu */}
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              {onEdit && (
                <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onEdit(note)}>
                  Duzenle
                </Menu.Item>
              )}

              {onColorChange && (
                <>
                  <Menu.Label>
                    <Group gap={4}>
                      <IconPalette size={14} />
                      <Text size="xs">Renk</Text>
                    </Group>
                  </Menu.Label>
                  <Box px="xs" pb="xs">
                    <NoteColorPicker
                      value={note.color}
                      onChange={(color) => onColorChange(note.id, color)}
                      size="sm"
                    />
                  </Box>
                </>
              )}

              {extraMenuItems}

              {onDelete && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => onDelete(note.id)}
                  >
                    Sil
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Paper>
  );
}

export default NoteCard;
