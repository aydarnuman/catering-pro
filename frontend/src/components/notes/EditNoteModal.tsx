'use client';

/**
 * EditNoteModal - Sub-modal for editing an existing note
 */

import { Group, Modal, Paper, Stack, Text } from '@mantine/core';
import { IconNote } from '@tabler/icons-react';

import type { CreateNoteDTO, UnifiedNote } from '@/types/notes';
import { NoteAttachments } from './NoteAttachments';
import type { ChecklistItem } from './NoteChecklist';
import { NoteEditor } from './NoteEditor';

interface EditNoteModalProps {
  note: UnifiedNote | null;
  checklist: ChecklistItem[];
  onSave: (data: CreateNoteDTO) => Promise<void>;
  onClose: () => void;
  onRefresh: () => void;
}

export function EditNoteModal({ note, checklist, onSave, onClose, onRefresh }: EditNoteModalProps) {
  return (
    <Modal
      opened={!!note}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconNote size={18} />
          <Text fw={600} size="sm">
            Notu Duzenle
          </Text>
        </Group>
      }
      size="lg"
      radius="lg"
      centered
    >
      {note && (
        <Stack>
          <NoteEditor
            initialTitle={note.title || ''}
            initialContent={note.content}
            initialContentFormat={note.content_format}
            initialColor={note.color}
            initialPriority={note.priority}
            initialTags={note.tags?.map((t) => t.name) ?? []}
            initialDueDate={note.due_date ? new Date(note.due_date) : null}
            initialReminderDate={note.reminder_date ? new Date(note.reminder_date) : null}
            initialIsTask={note.is_task}
            initialChecklist={checklist}
            onSave={onSave}
            onCancel={onClose}
            saveLabel="Guncelle"
          />
          {note.attachments && note.attachments.length > 0 && (
            <Paper p="sm" withBorder radius="md">
              <Text size="xs" fw={600} mb="xs">
                Dosya Ekleri
              </Text>
              <NoteAttachments noteId={note.id} attachments={note.attachments} onUpdate={onRefresh} />
            </Paper>
          )}
        </Stack>
      )}
    </Modal>
  );
}
