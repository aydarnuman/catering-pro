'use client';

/**
 * ContextNotesButton - Generic button to open notes for any entity.
 * Usage: <ContextNotesButton contextType="invoice" contextId={42} title="Fatura #42" />
 *
 * Supports multiple display variants:
 * - "button" (default): Full button with count badge
 * - "icon": Compact icon-only button
 * - "card": Summary card with note preview (like NotesPanel/YapiskanNotlar)
 */

import { ActionIcon, Badge, Box, Button, Group, Paper, Text, Tooltip, useMantineColorScheme } from '@mantine/core';
import { IconNote, IconNotes, IconPin } from '@tabler/icons-react';

import { useNotesModal } from '@/context/NotesContext';
import { useNotes } from '@/hooks/useNotes';
import type { NoteContextType } from '@/types/notes';

const CONTEXT_LABELS: Record<string, string> = {
  tender: 'Ihale',
  customer: 'Musteri',
  event: 'Etkinlik',
  project: 'Proje',
  contractor: 'Yuklenici',
  invoice: 'Fatura',
  stock: 'Stok',
  personnel: 'Personel',
  purchasing: 'Satin Alma',
  asset: 'Demirbas',
  finance: 'Finans',
  menu: 'Menu',
  recipe: 'Recete',
};

interface ContextNotesButtonProps {
  /** Entity type to attach notes to */
  contextType: Exclude<NoteContextType, null>;
  /** Entity ID */
  contextId: number;
  /** Optional display title for the entity */
  title?: string;
  /** Display variant */
  variant?: 'button' | 'icon' | 'card';
  /** Custom label override */
  label?: string;
  /** Button color */
  color?: string;
  /** Button size */
  size?: 'xs' | 'sm' | 'md';
}

export function ContextNotesButton({
  contextType,
  contextId,
  title,
  variant = 'button',
  label,
  color = 'violet',
  size = 'sm',
}: ContextNotesButtonProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const { openContextNotes } = useNotesModal();

  const { notes, isLoading } = useNotes({
    contextType,
    contextId,
    enabled: true,
  });

  const noteCount = notes.length;
  const pinnedCount = notes.filter((n) => n.pinned).length;
  const displayLabel = label || `${CONTEXT_LABELS[contextType] || contextType} Notlari`;

  const handleOpen = () => {
    openContextNotes(contextType, contextId, title);
  };

  // ── Icon variant ──
  if (variant === 'icon') {
    return (
      <Tooltip label={`${displayLabel} (${noteCount})`}>
        <ActionIcon
          variant="subtle"
          color={noteCount > 0 ? color : 'gray'}
          size={size}
          radius="md"
          onClick={handleOpen}
        >
          <Box style={{ position: 'relative' }}>
            <IconNotes size={size === 'xs' ? 14 : size === 'sm' ? 16 : 18} />
            {noteCount > 0 && (
              <Box
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: `var(--mantine-color-${color}-6)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'white',
                }}
              >
                {noteCount > 9 ? '9+' : noteCount}
              </Box>
            )}
          </Box>
        </ActionIcon>
      </Tooltip>
    );
  }

  // ── Card variant ──
  if (variant === 'card') {
    const latestNote = notes[0];
    const previewText = latestNote
      ? (latestNote.title || latestNote.content.replace(/<[^>]+>/g, '')).slice(0, 80)
      : null;

    return (
      <Paper
        p="sm"
        radius="md"
        withBorder
        style={{
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }}
        onClick={handleOpen}
      >
        <Group justify="space-between" mb={previewText ? 'xs' : 0}>
          <Group gap="xs">
            <IconNote size={16} color={`var(--mantine-color-${color}-5)`} />
            <Text size="sm" fw={600}>
              {displayLabel}
            </Text>
          </Group>
          <Group gap={4}>
            {pinnedCount > 0 && (
              <Badge variant="light" color="violet" size="xs" leftSection={<IconPin size={8} />}>
                {pinnedCount}
              </Badge>
            )}
            <Badge variant="light" color={noteCount > 0 ? color : 'gray'} size="xs">
              {isLoading ? '...' : noteCount}
            </Badge>
          </Group>
        </Group>
        {previewText && (
          <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
            {previewText}
          </Text>
        )}
      </Paper>
    );
  }

  // ── Button variant (default) ──
  return (
    <Button
      variant="light"
      color={noteCount > 0 ? color : 'gray'}
      size={size}
      radius="md"
      leftSection={<IconNotes size={14} />}
      rightSection={
        noteCount > 0 ? (
          <Badge variant="filled" color={color} size="xs" circle>
            {noteCount}
          </Badge>
        ) : undefined
      }
      onClick={handleOpen}
    >
      {displayLabel}
    </Button>
  );
}
