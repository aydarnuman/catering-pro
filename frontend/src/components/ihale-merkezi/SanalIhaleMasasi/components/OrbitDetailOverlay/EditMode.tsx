import { ActionIcon, Button, Group, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import type { OrbitAttachment } from '../../types';

interface EditModeProps {
  attachment: OrbitAttachment;
  onSave: (id: string, updates: { title?: string; content?: string }) => Promise<void>;
  onCancel: () => void;
}

export function EditMode({ attachment, onSave, onCancel }: EditModeProps) {
  const [title, setTitle] = useState(attachment.title);
  const [content, setContent] = useState(attachment.content);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onSave(attachment.id, { title, content });
    setSaving(false);
    onCancel();
  }, [attachment.id, title, content, onSave, onCancel]);

  return (
    <Stack gap="sm" px="md" pt="md" pb="md" style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between">
        <Text size="sm" fw={700} c="white">
          Duzenle
        </Text>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onCancel}>
          <IconX size={14} />
        </ActionIcon>
      </Group>

      <TextInput
        size="xs"
        placeholder="Baslik"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        styles={{
          input: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
        }}
      />

      <Textarea
        size="xs"
        placeholder="Icerik"
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        minRows={6}
        maxRows={12}
        autosize
        styles={{
          input: { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
        }}
      />

      <Group justify="flex-end" gap="xs">
        <Button size="xs" variant="subtle" color="gray" onClick={onCancel}>
          Iptal
        </Button>
        <Button
          size="xs"
          variant="gradient"
          gradient={{ from: 'indigo', to: 'violet' }}
          leftSection={<IconCheck size={14} />}
          loading={saving}
          onClick={handleSave}
        >
          Kaydet
        </Button>
      </Group>
    </Stack>
  );
}
