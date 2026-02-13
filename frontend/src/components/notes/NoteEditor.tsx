'use client';

/**
 * NoteEditor - Baslik + Zengin metin editoru + Checklist
 * Tiptap + Mantine entegrasyonu
 */

import { Box, Button, Divider, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { Link, RichTextEditor } from '@mantine/tiptap';
import { IconCheck, IconX } from '@tabler/icons-react';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useState } from 'react';

import type { CreateNoteDTO, NoteColor, NoteContentFormat, NotePriority } from '@/types/notes';
import type { ChecklistItem } from './NoteChecklist';
import { NoteChecklist } from './NoteChecklist';
import { NoteColorPicker } from './NoteColorPicker';
import { NotePrioritySelect } from './NotePrioritySelect';
import { NoteTagsInput } from './NoteTagsInput';

interface NoteEditorProps {
  initialTitle?: string;
  initialContent?: string;
  initialContentFormat?: NoteContentFormat;
  initialColor?: NoteColor;
  initialPriority?: NotePriority;
  initialTags?: string[];
  initialDueDate?: Date | null;
  initialReminderDate?: Date | null;
  initialIsTask?: boolean;
  initialChecklist?: ChecklistItem[];
  onSave: (data: CreateNoteDTO) => void;
  onCancel?: () => void;
  showTaskToggle?: boolean;
  showPriority?: boolean;
  showDueDate?: boolean;
  showReminder?: boolean;
  showTags?: boolean;
  showChecklist?: boolean;
  showActions?: boolean;
  placeholder?: string;
  saveLabel?: string;
  compact?: boolean;
  /** Gorev modu: otomatik is_task=true, baslik odakli */
  taskMode?: boolean;
}

export function NoteEditor({
  initialTitle = '',
  initialContent = '',
  initialContentFormat = 'html',
  initialColor = 'blue',
  initialPriority = 'normal',
  initialTags = [],
  initialDueDate = null,
  initialReminderDate = null,
  initialIsTask = false,
  initialChecklist = [],
  onSave,
  onCancel,
  showTaskToggle = true,
  showPriority = true,
  showDueDate = true,
  showReminder = true,
  showTags = true,
  showChecklist = true,
  showActions = true,
  placeholder = 'Icerik yazin...',
  saveLabel = 'Kaydet',
  compact = false,
  taskMode = false,
}: NoteEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [color, setColor] = useState<NoteColor>(initialColor);
  const [priority, setPriority] = useState<NotePriority>(initialPriority);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [dueDate, setDueDate] = useState<Date | null>(initialDueDate);
  const [reminderDate, setReminderDate] = useState<Date | null>(initialReminderDate);
  const [isTask, setIsTask] = useState(taskMode || initialIsTask);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist);

  // Determine initial HTML content from various formats
  const getInitialHtml = () => {
    if (!initialContent) return '';
    if (initialContentFormat === 'html') return initialContent;
    if (initialContentFormat === 'markdown') {
      return initialContent
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^- (.*)$/gm, '<li>$1</li>')
        .replace(/\n/g, '<br/>');
    }
    return `<p>${initialContent.replace(/\n/g, '<br/>')}</p>`;
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: getInitialHtml(),
  });

  /**
   * Handle save
   */
  const handleSave = useCallback(() => {
    if (!editor) return;
    const htmlContent = editor.getHTML();
    const textContent = editor.getText();

    // En az baslik veya icerik olmali
    if (!title.trim() && !textContent.trim()) return;

    const metadata: Record<string, unknown> = {};
    if (checklist.length > 0) {
      metadata.checklist = checklist;
    }

    const data: CreateNoteDTO = {
      title: title.trim() || undefined,
      content: htmlContent,
      content_format: 'html',
      color,
      priority,
      tags,
      is_task: isTask,
      due_date: dueDate?.toISOString() ?? null,
      reminder_date: reminderDate?.toISOString() ?? null,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    onSave(data);
  }, [editor, title, color, priority, tags, isTask, dueDate, reminderDate, checklist, onSave]);

  if (!editor) return null;

  return (
    <Stack gap="sm">
      {/* Title input */}
      <TextInput
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        placeholder="Baslik yazin..."
        size={compact ? 'sm' : 'md'}
        variant="unstyled"
        styles={{
          input: {
            fontWeight: 700,
            fontSize: compact ? 16 : 18,
            letterSpacing: '-0.01em',
            borderBottom: '1px solid var(--mantine-color-default-border)',
            borderRadius: 0,
            paddingBottom: 8,
          },
        }}
      />

      {/* Rich Text Editor */}
      {!taskMode && (
        <RichTextEditor
          editor={editor}
          styles={{
            root: {
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-md)',
            },
            toolbar: {
              borderBottom: '1px solid var(--mantine-color-default-border)',
              padding: '4px 8px',
              gap: 2,
            },
            content: {
              minHeight: compact ? 80 : 120,
              fontSize: compact ? 13 : 14,
            },
          }}
        >
          <RichTextEditor.Toolbar sticky stickyOffset={0}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.Strikethrough />
              <RichTextEditor.Highlight />
              <RichTextEditor.Code />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.H2 />
              <RichTextEditor.H3 />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
              <RichTextEditor.TaskList />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Link />
              <RichTextEditor.Unlink />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Blockquote />
              <RichTextEditor.Hr />
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>

          <RichTextEditor.Content />
        </RichTextEditor>
      )}

      {/* Checklist */}
      {showChecklist && (
        <Box>
          <Divider my="xs" label="Alt Gorevler" labelPosition="left" />
          <NoteChecklist items={checklist} onChange={setChecklist} />
        </Box>
      )}

      {/* Color picker */}
      <Group gap="xs" align="center">
        <Text size="xs" c="dimmed">
          Renk:
        </Text>
        <NoteColorPicker value={color} onChange={setColor} size="sm" />
      </Group>

      {/* Task toggle */}
      {showTaskToggle && !taskMode && (
        <Switch
          label="Gorev olarak isaretle"
          size="xs"
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
          size={compact ? 'xs' : 'sm'}
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
          size={compact ? 'xs' : 'sm'}
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

      {/* Action buttons */}
      {showActions && (
        <Group justify="flex-end" mt="xs">
          {onCancel && (
            <Button variant="subtle" size={compact ? 'xs' : 'sm'} onClick={onCancel} leftSection={<IconX size={14} />}>
              Iptal
            </Button>
          )}
          <Button
            size={compact ? 'xs' : 'sm'}
            onClick={handleSave}
            disabled={!title.trim() && !editor.getText().trim()}
            leftSection={<IconCheck size={14} />}
          >
            {saveLabel}
          </Button>
        </Group>
      )}
    </Stack>
  );
}

export default NoteEditor;
