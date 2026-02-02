'use client';

import {
  ActionIcon,
  Box,
  Button,
  ColorSwatch,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPin, IconPlus, IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { tendersAPI } from '@/lib/api/services/tenders';

interface NotesPanelProps {
  trackingId: number;
  tenderId: number; // Reserved for future API calls
}

interface Note {
  id: string;
  text: string;
  color: string;
  pinned: boolean;
  created_at: string;
}

const NOTE_COLORS = ['yellow', 'blue', 'green', 'pink', 'orange', 'purple'];

export function NotesPanel({ trackingId, tenderId: _tenderId }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    if (!trackingId) return;
    try {
      const data = await tendersAPI.getTenderNotes(trackingId);
      if (data.success && data.data) {
        setNotes(
          data.data.map((n: Record<string, unknown>) => ({
            id: String(n.id),
            text: n.text || n.not || '',
            color: n.color || 'yellow',
            pinned: Boolean(n.pinned) || false,
            created_at: String(n.created_at),
          }))
        );
      }
    } catch (error) {
      console.error('Notes fetch error:', error);
    }
  }, [trackingId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Add note
  const handleAddNote = async () => {
    if (!newNote.trim() || !trackingId) return;

    try {
      const response = await tendersAPI.createTenderNote(trackingId, {
        text: newNote,
        color: selectedColor,
        pinned: false,
        tags: [],
        reminder_date: null,
      });

      if (response.success) {
        setNewNote('');
        fetchNotes();
        notifications.show({
          title: 'Not Eklendi',
          message: 'Notunuz kaydedildi',
          color: 'green',
        });
      }
    } catch (error) {
      console.error('Add note error:', error);
      notifications.show({
        title: 'Hata',
        message: 'Not eklenemedi',
        color: 'red',
      });
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const data = await tendersAPI.deleteTenderNote(trackingId, Number(noteId));
      if (data.success) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        notifications.show({
          title: 'Not Silindi',
          message: '',
          color: 'orange',
        });
      }
    } catch (error) {
      console.error('Delete note error:', error);
    }
  };

  // Toggle pin
  const handleTogglePin = async (noteId: string, currentPinned: boolean) => {
    try {
      const response = await tendersAPI.pinTenderNote(trackingId, Number(noteId), !currentPinned);
      if (response.success) {
        fetchNotes();
      }
    } catch (error) {
      console.error('Pin toggle error:', error);
    }
  };

  // Get color style
  const getColorStyle = (color: string) => {
    const colorMap: Record<string, { bg: string; border: string }> = {
      yellow: { bg: '#fff9c4', border: '#fbc02d' },
      blue: { bg: '#e3f2fd', border: '#42a5f5' },
      green: { bg: '#e8f5e9', border: '#66bb6a' },
      pink: { bg: '#fce4ec', border: '#ec407a' },
      orange: { bg: '#fff3e0', border: '#ffa726' },
      purple: { bg: '#f3e5f5', border: '#ab47bc' },
    };
    return colorMap[color] || colorMap.yellow;
  };

  return (
    <Box p="xs">
      {/* Add Note Form */}
      <Paper p="xs" withBorder radius="md" mb="xs">
        <Textarea
          placeholder="Yeni not..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          minRows={2}
          maxRows={4}
          autosize
          mb="xs"
        />
        <Group justify="space-between">
          <Group gap={4}>
            {NOTE_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={getColorStyle(color).border}
                size={18}
                style={{
                  cursor: 'pointer',
                  border: selectedColor === color ? '2px solid #333' : 'none',
                }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={handleAddNote}
            disabled={!newNote.trim()}
          >
            Ekle
          </Button>
        </Group>
      </Paper>

      {/* Notes List */}
      <ScrollArea.Autosize mah={200}>
        <Stack gap={4}>
          {notes.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="md">
              Henüz not yok
            </Text>
          ) : (
            notes.map((note) => {
              const colorStyle = getColorStyle(note.color);
              return (
                <Paper
                  key={note.id}
                  p="xs"
                  radius="sm"
                  style={{
                    background: colorStyle.bg,
                    borderLeft: `3px solid ${colorStyle.border}`,
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Text size="xs" style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                      {note.text}
                    </Text>
                    <Group gap={2}>
                      <Tooltip label={note.pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color={note.pinned ? 'orange' : 'gray'}
                          onClick={() => handleTogglePin(note.id, note.pinned)}
                        >
                          <IconPin size={12} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Sil">
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>
                    {new Date(note.created_at).toLocaleDateString('tr-TR')}
                  </Text>
                </Paper>
              );
            })
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Box>
  );
}
