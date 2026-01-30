'use client';

import {
  ActionIcon,
  Box,
  Divider,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  IconBold,
  IconCode,
  IconItalic,
  IconLink,
  IconList,
  IconMarkdown,
  IconStrikethrough,
} from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import type { CreateNoteDTO, NoteColor, NoteContentFormat, NotePriority } from '@/types/notes';
import { NoteColorPicker } from './NoteColorPicker';
import { NotePrioritySelect } from './NotePrioritySelect';
import { NoteTagsInput } from './NoteTagsInput';

interface NoteEditorProps {
  initialContent?: string;
  initialColor?: NoteColor;
  initialPriority?: NotePriority;
  initialTags?: string[];
  initialDueDate?: Date | null;
  initialReminderDate?: Date | null;
  initialIsTask?: boolean;
  initialContentFormat?: NoteContentFormat;
  onSave: (data: CreateNoteDTO) => void;
  onCancel?: () => void;
  showTaskToggle?: boolean;
  showPriority?: boolean;
  showDueDate?: boolean;
  showReminder?: boolean;
  showTags?: boolean;
  minRows?: number;
  maxRows?: number;
  placeholder?: string;
}

/**
 * Format toolbar button
 */
function FormatButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number | string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" size="sm" onClick={onClick}>
        <Icon size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

/**
 * Simple markdown preview
 */
function MarkdownPreview({ content }: { content: string }) {
  const rendered = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(
      /`(.*?)`/g,
      '<code style="background:#f1f3f4;padding:2px 4px;border-radius:3px">$1</code>'
    )
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>');

  const html = rendered || '<em style="color:gray">Onizleme...</em>';
  // biome-ignore lint/security/noDangerouslySetInnerHtml: kontrollü regex + sabit fallback
  const previewEl = <span dangerouslySetInnerHTML={{ __html: html }} />;

  return (
    <Paper p="xs" withBorder style={{ minHeight: 60 }}>
      <Text size="sm">{previewEl}</Text>
    </Paper>
  );
}

export function NoteEditor({
  initialContent = '',
  initialColor = 'blue',
  initialPriority = 'normal',
  initialTags = [],
  initialDueDate = null,
  initialReminderDate = null,
  initialIsTask = false,
  initialContentFormat = 'plain',
  onSave,
  onCancel,
  showTaskToggle = true,
  showPriority = true,
  showDueDate = true,
  showReminder = true,
  showTags = true,
  minRows = 3,
  maxRows = 8,
  placeholder = 'Not yazin...',
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [color, setColor] = useState<NoteColor>(initialColor);
  const [priority, setPriority] = useState<NotePriority>(initialPriority);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [dueDate, setDueDate] = useState<Date | null>(initialDueDate);
  const [reminderDate, setReminderDate] = useState<Date | null>(initialReminderDate);
  const [isTask, setIsTask] = useState(initialIsTask);
  const [contentFormat, setContentFormat] = useState<NoteContentFormat>(initialContentFormat);
  const [showPreview, setShowPreview] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Insert formatting at cursor position
   */
  const insertFormatting = useCallback(
    (before: string, after: string = before) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);

      const newContent =
        content.substring(0, start) + before + selectedText + after + content.substring(end);

      setContent(newContent);

      // Re-focus and set cursor position
      setTimeout(() => {
        textarea.focus();
        const _newCursorPos = start + before.length + selectedText.length + after.length;
        textarea.setSelectionRange(
          start + before.length,
          start + before.length + selectedText.length
        );
      }, 0);
    },
    [content]
  );

  /**
   * Handle save
   */
  const _handleSave = useCallback(() => {
    if (!content.trim()) return;

    const data: CreateNoteDTO = {
      content: content.trim(),
      content_format: contentFormat,
      color,
      priority,
      tags,
      is_task: isTask,
      due_date: dueDate?.toISOString() ?? null,
      reminder_date: reminderDate?.toISOString() ?? null,
    };

    onSave(data);
  }, [content, contentFormat, color, priority, tags, isTask, dueDate, reminderDate, onSave]);

  return (
    <Stack gap="sm">
      {/* Content format toggle and toolbar */}
      <Group justify="space-between">
        <Group gap="xs">
          {contentFormat === 'markdown' && (
            <>
              <FormatButton icon={IconBold} label="Kalin" onClick={() => insertFormatting('**')} />
              <FormatButton
                icon={IconItalic}
                label="Italik"
                onClick={() => insertFormatting('*')}
              />
              <FormatButton
                icon={IconStrikethrough}
                label="Ustu cizili"
                onClick={() => insertFormatting('~~')}
              />
              <FormatButton icon={IconCode} label="Kod" onClick={() => insertFormatting('`')} />
              <FormatButton
                icon={IconLink}
                label="Link"
                onClick={() => insertFormatting('[', '](url)')}
              />
              <FormatButton
                icon={IconList}
                label="Liste"
                onClick={() => insertFormatting('- ', '')}
              />
              <Divider orientation="vertical" />
            </>
          )}
          <Tooltip label={contentFormat === 'markdown' ? 'Markdown acik' : 'Markdown kapali'}>
            <ActionIcon
              variant={contentFormat === 'markdown' ? 'filled' : 'subtle'}
              size="sm"
              color={contentFormat === 'markdown' ? 'blue' : 'gray'}
              onClick={() => setContentFormat(contentFormat === 'markdown' ? 'plain' : 'markdown')}
            >
              <IconMarkdown size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {contentFormat === 'markdown' && (
          <Switch
            label="Onizleme"
            size="xs"
            checked={showPreview}
            onChange={(e) => setShowPreview(e.currentTarget.checked)}
          />
        )}
      </Group>

      {/* Textarea or preview */}
      {showPreview && contentFormat === 'markdown' ? (
        <MarkdownPreview content={content} />
      ) : (
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          placeholder={placeholder}
          minRows={minRows}
          maxRows={maxRows}
          autosize
          styles={{
            input: {
              fontFamily: contentFormat === 'markdown' ? 'monospace' : 'inherit',
            },
          }}
        />
      )}

      {/* Color picker */}
      <Group gap="xs" align="center">
        <Text size="xs" c="dimmed">
          Renk:
        </Text>
        <NoteColorPicker value={color} onChange={setColor} size="sm" />
      </Group>

      {/* Task toggle */}
      {showTaskToggle && (
        <Switch
          label="Gorev olarak isaretle"
          checked={isTask}
          onChange={(e) => setIsTask(e.currentTarget.checked)}
        />
      )}

      {/* Priority */}
      {showPriority && isTask && (
        <Box>
          <Text size="xs" c="dimmed" mb={4}>
            Oncelik:
          </Text>
          <NotePrioritySelect value={priority} onChange={setPriority} size="sm" />
        </Box>
      )}

      {/* Due date */}
      {showDueDate && (
        <DateTimePicker
          label="Bitis tarihi"
          placeholder="Tarih secin"
          value={dueDate}
          onChange={setDueDate}
          clearable
          minDate={new Date()}
        />
      )}

      {/* Reminder */}
      {showReminder && (
        <DateTimePicker
          label="Hatirlatici"
          placeholder="Hatirlatici tarihi"
          value={reminderDate}
          onChange={setReminderDate}
          clearable
          minDate={new Date()}
        />
      )}

      {/* Tags */}
      {showTags && (
        <Box>
          <Text size="xs" c="dimmed" mb={4}>
            Etiketler:
          </Text>
          <NoteTagsInput value={tags} onChange={setTags} />
        </Box>
      )}
    </Stack>
  );
}

export default NoteEditor;
