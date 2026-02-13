import { ActionIcon, Badge, Box, Divider, Group, Stack, Text } from '@mantine/core';
import { IconDeviceFloppy, IconEdit, IconNote, IconTrash, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { ATTACHMENT_TYPE_MAP } from '../../constants';
import type { OrbitAttachment } from '../../types';
import { ICON_MAP } from './shared';

interface ViewModeProps {
  attachment: OrbitAttachment;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onSaveVirtual?: () => void;
}

export function ViewMode({ attachment, onEdit, onDelete, onClose, onSaveVirtual }: ViewModeProps) {
  const config = ATTACHMENT_TYPE_MAP[attachment.type];
  const Icon = ICON_MAP[config?.icon || 'note'] || IconNote;
  const isVirtual = !!attachment.virtual;
  const [saving, setSaving] = useState(false);

  return (
    <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
      {/* Header */}
      <Group justify="space-between" align="flex-start" px="md" pt="md">
        <Group gap="xs" align="center" style={{ flex: 1, minWidth: 0 }}>
          <Icon size={18} color={`var(--mantine-color-${config?.color || 'yellow'}-5)`} />
          <Text size="sm" fw={700} c="white" lineClamp={2} style={{ flex: 1 }}>
            {attachment.title || 'Baslissiz'}
          </Text>
        </Group>
        <Group gap={4}>
          {isVirtual ? (
            <ActionIcon
              variant="gradient"
              gradient={{ from: 'teal', to: 'green' }}
              size="sm"
              loading={saving}
              onClick={async () => {
                setSaving(true);
                await onSaveVirtual?.();
                setSaving(false);
              }}
            >
              <IconDeviceFloppy size={14} />
            </ActionIcon>
          ) : (
            <>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
                <IconEdit size={14} />
              </ActionIcon>
              <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
                <IconTrash size={14} />
              </ActionIcon>
            </>
          )}
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
            <IconX size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Type badge + date */}
      <Group gap="xs" px="md">
        <Badge size="xs" color={config?.color || 'yellow'} variant="light">
          {config?.label || attachment.type}
        </Badge>
        {isVirtual && (
          <Badge size="xs" color="teal" variant="outline">
            AI Analiz
          </Badge>
        )}
        {attachment.sourceAgent && (
          <Badge size="xs" color="indigo" variant="outline">
            Agent
          </Badge>
        )}
        {attachment.pinned && (
          <Badge size="xs" color="orange" variant="outline">
            Sabitlenmis
          </Badge>
        )}
      </Group>

      <Divider color="dark.5" mx="md" />

      {/* Content */}
      <Box px="md" pb="md" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Text size="xs" c="gray.4" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {attachment.content || 'Icerik yok'}
        </Text>

        {attachment.url && (
          <Box mt="sm">
            <Text size="10px" c="dimmed">
              Baglanti:
            </Text>
            <Text
              size="xs"
              c="teal"
              component="a"
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ wordBreak: 'break-all' }}
            >
              {attachment.url}
            </Text>
          </Box>
        )}

        {attachment.tags && attachment.tags.length > 0 && (
          <Group gap={4} mt="sm">
            {attachment.tags.map((tag) => (
              <Badge key={tag.id} size="xs" color={tag.color || 'gray'} variant="dot">
                {tag.name}
              </Badge>
            ))}
          </Group>
        )}

        <Text size="10px" c="dimmed" mt="sm">
          {attachment.createdAt
            ? new Date(attachment.createdAt).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''}
        </Text>
      </Box>
    </Stack>
  );
}
