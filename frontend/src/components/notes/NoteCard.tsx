'use client';

import { useState } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  ActionIcon,
  Badge,
  Menu,
  Checkbox,
  Tooltip,
  Box,
} from '@mantine/core';
import {
  IconPin,
  IconPinFilled,
  IconTrash,
  IconEdit,
  IconDotsVertical,
  IconFlag,
  IconPalette,
  IconCalendar,
  IconBell,
  IconPaperclip,
  IconGripVertical,
} from '@tabler/icons-react';
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  NOTE_COLORS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  type UnifiedNote,
  type NoteColor,
} from '@/types/notes';
import { NoteColorPicker } from './NoteColorPicker';

interface NoteCardProps {
  note: UnifiedNote;
  onToggleComplete?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (note: UnifiedNote) => void;
  onColorChange?: (id: string, color: NoteColor) => void;
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

  if (isToday(d)) {
    return 'Bugun';
  }
  if (isTomorrow(d)) {
    return 'Yarin';
  }
  if (isPast(d)) {
    return `${formatDistanceToNow(d, { locale: tr })} once`;
  }

  return format(d, 'd MMM', { locale: tr });
}

/**
 * Render markdown-like content (simplified)
 */
function renderContent(content: string, format: string): React.ReactNode {
  if (format !== 'markdown') {
    return content;
  }

  // Simple markdown rendering
  let rendered = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/`(.*?)`/g, '<code>$1</code>');

  return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
}

export function NoteCard({
  note,
  onToggleComplete,
  onTogglePin,
  onDelete,
  onEdit,
  onColorChange,
  showDragHandle = false,
  compact = false,
  dragHandleProps,
}: NoteCardProps) {
  const [colorMenuOpened, setColorMenuOpened] = useState(false);

  const colorConfig = NOTE_COLORS[note.color] || NOTE_COLORS.blue;
  const dueDateLabel = formatDueDate(note.due_date);
  const isOverdue = note.due_date && isPast(new Date(note.due_date)) && !note.is_completed;
  const hasReminder = note.reminders && note.reminders.length > 0;
  const hasAttachments = note.attachments && note.attachments.length > 0;

  return (
    <Paper
      p={compact ? 'xs' : 'sm'}
      radius="md"
      style={{
        background: colorConfig.bg,
        borderLeft: `4px solid ${colorConfig.border}`,
        opacity: note.is_completed ? 0.7 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      <Group gap="xs" align="flex-start" wrap="nowrap">
        {/* Drag handle */}
        {showDragHandle && (
          <Box
            {...dragHandleProps}
            style={{
              cursor: 'grab',
              color: 'var(--mantine-color-gray-5)',
              display: 'flex',
              alignItems: 'center',
              paddingTop: 2,
            }}
          >
            <IconGripVertical size={16} />
          </Box>
        )}

        {/* Completion checkbox (for tasks) */}
        {note.is_task && onToggleComplete && (
          <Checkbox
            checked={note.is_completed}
            onChange={() => onToggleComplete(note.id)}
            radius="xl"
            size="sm"
            styles={{
              input: {
                borderColor: colorConfig.accent,
                '&:checked': {
                  backgroundColor: colorConfig.accent,
                  borderColor: colorConfig.accent,
                },
              },
            }}
          />
        )}

        {/* Content */}
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          {/* Main content */}
          <Text
            size={compact ? 'xs' : 'sm'}
            style={{
              textDecoration: note.is_completed ? 'line-through' : 'none',
              color: note.is_completed ? 'var(--mantine-color-gray-6)' : 'inherit',
              wordBreak: 'break-word',
            }}
            lineClamp={compact ? 2 : 4}
          >
            {renderContent(note.content, note.content_format)}
          </Text>

          {/* Metadata row */}
          <Group gap={6} wrap="wrap">
            {/* Priority badge */}
            {note.priority !== 'normal' && (
              <Badge
                size="xs"
                variant="light"
                color={note.priority === 'urgent' ? 'red' : note.priority === 'high' ? 'orange' : 'gray'}
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
                <Badge size="xs" variant="light" color="violet" leftSection={<IconBell size={10} />}>
                  {note.reminders.length}
                </Badge>
              </Tooltip>
            )}

            {/* Attachment indicator */}
            {hasAttachments && (
              <Tooltip label={`${note.attachments.length} dosya`}>
                <Badge size="xs" variant="light" color="cyan" leftSection={<IconPaperclip size={10} />}>
                  {note.attachments.length}
                </Badge>
              </Tooltip>
            )}

            {/* Tags */}
            {note.tags?.slice(0, 3).map((tag) => (
              <Badge
                key={tag.id}
                size="xs"
                variant="dot"
                color={tag.color || 'gray'}
              >
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
        <Group gap={4}>
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
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  onClick={() => onEdit(note)}
                >
                  Duzenle
                </Menu.Item>
              )}

              {onColorChange && (
                <Menu.Item
                  leftSection={<IconPalette size={14} />}
                  closeMenuOnClick={false}
                >
                  <NoteColorPicker
                    value={note.color}
                    onChange={(color) => {
                      onColorChange(note.id, color);
                    }}
                    size="sm"
                  />
                </Menu.Item>
              )}

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
