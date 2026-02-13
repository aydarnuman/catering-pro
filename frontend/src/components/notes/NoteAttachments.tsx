'use client';

/**
 * NoteAttachments - Dosya ekleri gosterim + upload + delete
 */

import { ActionIcon, Badge, Button, FileButton, Group, Loader, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconPaperclip, IconTrash, IconUpload } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { notesAPI } from '@/lib/api/services/notes';
import type { NoteAttachment } from '@/types/notes';

interface NoteAttachmentsProps {
  noteId: string;
  attachments: NoteAttachment[];
  onUpdate?: () => void;
  readonly?: boolean;
}

export function NoteAttachments({ noteId, attachments, onUpdate, readonly = false }: NoteAttachmentsProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setUploading(true);
      try {
        const result = await notesAPI.uploadAttachment(noteId, file);
        if (result.success) {
          notifications.show({ message: 'Dosya yuklendi', color: 'green' });
          onUpdate?.();
        }
      } catch {
        notifications.show({ title: 'Hata', message: 'Dosya yuklenemedi', color: 'red' });
      } finally {
        setUploading(false);
      }
    },
    [noteId, onUpdate]
  );

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      try {
        const result = await notesAPI.deleteAttachment(attachmentId);
        if (result.success) {
          notifications.show({ message: 'Dosya silindi', color: 'orange' });
          onUpdate?.();
        }
      } catch {
        notifications.show({ title: 'Hata', message: 'Dosya silinemedi', color: 'red' });
      }
    },
    [onUpdate]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Stack gap="xs">
      {/* Attachment list */}
      {attachments.length > 0 && (
        <Paper p="xs" withBorder style={{ borderStyle: 'dashed' }}>
          <Stack gap={4}>
            {attachments.map((att) => (
              <Group key={att.id} justify="space-between" gap="xs">
                <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                  <IconPaperclip size={14} />
                  <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                    {att.original_filename}
                  </Text>
                  <Badge size="xs" variant="light">
                    {formatSize(att.file_size)}
                  </Badge>
                </Group>
                <Group gap={4}>
                  <Tooltip label="Indir">
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      component="a"
                      href={notesAPI.getAttachmentDownloadUrl(att.id)}
                      target="_blank"
                    >
                      <IconDownload size={12} />
                    </ActionIcon>
                  </Tooltip>
                  {!readonly && (
                    <Tooltip label="Sil">
                      <ActionIcon variant="subtle" size="xs" color="red" onClick={() => handleDelete(att.id)}>
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
      {!readonly && (
        <FileButton onChange={handleUpload} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv">
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
      )}
    </Stack>
  );
}

export default NoteAttachments;
