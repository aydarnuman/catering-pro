'use client';

/**
 * NotesPanel — Ihale sag panelinde not ozeti + modal acma butonu.
 * Eski JSONB API kaldirildi, unified notes modal'a yonlendirir.
 */

import { Badge, Box, Button, Center, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconNote, IconNotes } from '@tabler/icons-react';
import { useNotesModal } from '@/context/NotesContext';
import { useNotes } from '@/hooks/useNotes';

interface NotesPanelProps {
  trackingId: number;
  tenderId: number;
  tenderTitle?: string;
}

export function NotesPanel({ trackingId: _trackingId, tenderId, tenderTitle }: NotesPanelProps) {
  const { openContextNotes } = useNotesModal();

  // Fetch note count from unified API
  const { notes, isLoading } = useNotes({
    contextType: 'tender',
    contextId: tenderId,
    enabled: tenderId > 0,
  });

  const noteCount = notes.length;
  const pinnedCount = notes.filter((n) => n.pinned).length;

  return (
    <Box p="sm">
      <Center>
        <Stack align="center" gap="md" py="md">
          <ThemeIcon size={40} radius="xl" variant="light" color="violet">
            <IconNotes size={20} />
          </ThemeIcon>

          {isLoading ? (
            <Text size="xs" c="dimmed">
              Yukleniyor...
            </Text>
          ) : noteCount > 0 ? (
            <Stack align="center" gap={4}>
              <Group gap="xs">
                <Badge variant="light" color="blue" size="sm">
                  {noteCount} not
                </Badge>
                {pinnedCount > 0 && (
                  <Badge variant="light" color="violet" size="sm">
                    {pinnedCount} sabitlenen
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" ta="center" maw={200}>
                {notes[0]?.content.slice(0, 60)}
                {(notes[0]?.content.length ?? 0) > 60 ? '...' : ''}
              </Text>
            </Stack>
          ) : (
            <Text size="xs" c="dimmed">
              Henuz not yok
            </Text>
          )}

          <Button
            variant="light"
            color="violet"
            size="xs"
            leftSection={<IconNote size={14} />}
            onClick={() => openContextNotes('tender', tenderId, tenderTitle || 'Ihale')}
          >
            {noteCount > 0 ? 'Notlari Ac' : 'Not Ekle'}
          </Button>
        </Stack>
      </Center>
    </Box>
  );
}
