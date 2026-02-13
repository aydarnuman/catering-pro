'use client';

/**
 * NoteComposer - New note / task creation area
 */

import { ActionIcon, Box, Button, Collapse, Group, Paper, Text, useMantineColorScheme } from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';
import type { CreateNoteDTO } from '@/types/notes';
import { NoteEditor } from './NoteEditor';

interface NoteComposerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSave: (data: CreateNoteDTO) => Promise<void>;
  isTaskView: boolean;
}

export function NoteComposer({ isOpen, onOpen, onClose, onSave, isTaskView }: NoteComposerProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Box px="lg" py="sm">
      {!isOpen ? (
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={onOpen}
          fullWidth
          radius="lg"
          styles={{
            root: {
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
              border: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
              fontWeight: 500,
              height: 44,
              transition: 'all 0.15s ease',
            },
          }}
        >
          {isTaskView ? '+ Yeni gorev ekle...' : '+ Yeni not ekle...'}
        </Button>
      ) : (
        <Collapse in={isOpen}>
          <Paper
            p="md"
            radius="lg"
            withBorder
            style={{
              borderColor: isTaskView
                ? `var(--mantine-color-orange-${isDark ? '6' : '3'})`
                : `var(--mantine-color-violet-${isDark ? '6' : '3'})`,
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.2)' : '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c={isTaskView ? 'orange' : 'violet'}>
                {isTaskView ? 'Yeni Gorev' : 'Yeni Not'}
              </Text>
              <ActionIcon variant="subtle" size="sm" onClick={onClose}>
                <IconX size={16} />
              </ActionIcon>
            </Group>
            <NoteEditor
              onSave={onSave}
              onCancel={onClose}
              compact
              taskMode={isTaskView}
              showTaskToggle={!isTaskView}
              initialIsTask={isTaskView}
              initialColor={isTaskView ? 'orange' : 'blue'}
            />
          </Paper>
        </Collapse>
      )}
    </Box>
  );
}
