'use client';

/**
 * Yapışkan Notlar — Yuklenici icin not ozeti + modal acma butonu.
 * Eski dogrudan API yerine unified notes modal'a yonlendirir.
 */

import { Badge, Button, Card, Group, Text } from '@mantine/core';
import { IconNote } from '@tabler/icons-react';
import { useNotesModal } from '@/context/NotesContext';
import { useNotes } from '@/hooks/useNotes';

interface Props {
  yukleniciId: number;
  firmaAdi?: string;
}

export function YapiskanNotlar({ yukleniciId, firmaAdi }: Props) {
  const { openContextNotes } = useNotesModal();

  // Fetch note count from unified API
  const { notes, isLoading } = useNotes({
    contextType: 'contractor',
    contextId: yukleniciId,
    enabled: yukleniciId > 0,
  });

  const noteCount = notes.length;

  return (
    <Card
      radius="md"
      p="sm"
      style={{
        background: 'var(--yk-surface-glass)',
        border: '1px solid var(--yk-border-subtle)',
      }}
    >
      <Group justify="space-between">
        <Group gap="xs">
          <IconNote size={16} style={{ color: 'var(--yk-gold)' }} />
          <Text size="sm" fw={600} style={{ color: 'var(--yk-gold)', letterSpacing: '0.02em' }}>
            Notlar
          </Text>
          {!isLoading && noteCount > 0 && (
            <Badge variant="light" color="violet" size="xs">
              {noteCount}
            </Badge>
          )}
        </Group>

        <Button
          variant="light"
          color="yellow"
          size="compact-xs"
          leftSection={<IconNote size={12} />}
          onClick={() => openContextNotes('contractor', yukleniciId, firmaAdi || 'Yuklenici')}
        >
          {noteCount > 0 ? 'Notlari Ac' : 'Not Ekle'}
        </Button>
      </Group>

      {/* Son not onizleme */}
      {!isLoading && noteCount > 0 && (
        <Text size="xs" c="dimmed" mt="xs" lineClamp={2}>
          {notes[0]?.content}
        </Text>
      )}
    </Card>
  );
}
