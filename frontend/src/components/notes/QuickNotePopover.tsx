'use client';

/**
 * QuickNotePopover - Lightweight floating note creator
 * Accessible via Ctrl+Shift+N from anywhere in the app.
 * Creates notes without opening the full-screen workspace modal.
 */

import {
  ActionIcon,
  Box,
  Button,
  Group,
  Kbd,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconNote, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNotesModal } from '@/context/NotesContext';
import { notesAPI } from '@/lib/api/services/notes';

export function QuickNotePopover() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const { quickNoteState, closeQuickNote, openNotes } = useNotesModal();
  const { opened } = quickNoteState;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const ref = useClickOutside(() => {
    if (opened && !title.trim() && !content.trim()) closeQuickNote();
  });

  // Focus title on open
  useEffect(() => {
    if (opened) {
      setTitle('');
      setContent('');
      setSaving(false);
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [opened]);

  const handleSave = useCallback(async () => {
    if (!title.trim() && !content.trim()) return;
    setSaving(true);
    try {
      await notesAPI.createNote({
        title: title.trim() || undefined,
        content: content.trim() || title.trim(),
        content_format: 'plain',
        color: 'blue',
        priority: 'normal',
        is_task: false,
      });
      notifications.show({
        message: 'Hizli not olusturuldu',
        color: 'green',
        icon: <IconCheck size={16} />,
        autoClose: 2000,
      });
      closeQuickNote();
    } catch {
      notifications.show({ message: 'Not olusturulamadi', color: 'red' });
    } finally {
      setSaving(false);
    }
  }, [title, content, closeQuickNote]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeQuickNote();
      }
    },
    [handleSave, closeQuickNote]
  );

  if (!opened) return null;

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeQuickNote();
      }}
    >
      <Paper
        ref={ref}
        shadow="xl"
        radius="lg"
        p="lg"
        style={{
          width: 440,
          maxHeight: 400,
          background: isDark ? 'rgba(30,30,36,0.98)' : 'rgba(255,255,255,0.98)',
          border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
          backdropFilter: 'blur(24px)',
          boxShadow: isDark
            ? '0 20px 60px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4)'
            : '0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08)',
          alignSelf: 'flex-start',
        }}
        onKeyDown={handleKeyDown}
      >
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <Box
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)',
              }}
            >
              <IconNote size={14} color="var(--mantine-color-violet-5)" />
            </Box>
            <Text size="sm" fw={700}>
              Hizli Not
            </Text>
          </Group>
          <Group gap={4}>
            <Tooltip label="Calisma Alanim'i Ac">
              <ActionIcon
                variant="subtle"
                size="sm"
                radius="md"
                color="violet"
                onClick={() => {
                  closeQuickNote();
                  openNotes();
                }}
              >
                <IconNote size={14} />
              </ActionIcon>
            </Tooltip>
            <ActionIcon variant="subtle" size="sm" radius="md" onClick={closeQuickNote}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        </Group>

        <Stack gap="xs">
          <TextInput
            ref={titleRef}
            placeholder="Baslik (opsiyonel)"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            size="sm"
            radius="md"
            variant="filled"
          />
          <Textarea
            placeholder="Notunuzu yazin..."
            value={content}
            onChange={(e) => setContent(e.currentTarget.value)}
            size="sm"
            radius="md"
            variant="filled"
            minRows={3}
            maxRows={8}
            autosize
          />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              <Kbd size="xs">Ctrl</Kbd> + <Kbd size="xs">Enter</Kbd> kaydet
            </Text>
            <Button
              size="xs"
              radius="md"
              color="violet"
              onClick={handleSave}
              loading={saving}
              disabled={!title.trim() && !content.trim()}
            >
              Kaydet
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Box>
  );
}
