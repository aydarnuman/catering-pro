'use client';

import { ActionIcon, Box, Button, Group, Paper, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconClipboard, IconCopy, IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

interface ClipboardPanelProps {
  tenderId: string;
}

interface ClipboardItem {
  id: string;
  text: string;
  category?: string;
  createdAt: Date;
}

export function ClipboardPanel({ tenderId }: ClipboardPanelProps) {
  const [items, setItems] = useState<ClipboardItem[]>([]);

  // Load from localStorage
  useEffect(() => {
    const key = `clipboard_${tenderId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ClipboardItem[];
        setItems(parsed.map((item) => ({ ...item, createdAt: new Date(item.createdAt) })));
      } catch {
        // Invalid data
      }
    }
  }, [tenderId]);

  // Save to localStorage
  const saveItems = useCallback(
    (newItems: ClipboardItem[]) => {
      const key = `clipboard_${tenderId}`;
      localStorage.setItem(key, JSON.stringify(newItems));
      setItems(newItems);
    },
    [tenderId]
  );

  // Add item from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;

      const newItem: ClipboardItem = {
        id: `item-${Date.now()}`,
        text: text.trim(),
        createdAt: new Date(),
      };

      saveItems([newItem, ...items]);
      notifications.show({
        title: 'Eklendi',
        message: 'Metin panoya eklendi',
        color: 'teal',
      });
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Pano okunamadı',
        color: 'red',
      });
    }
  };

  // Copy item
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notifications.show({
        title: 'Kopyalandı',
        message: '',
        color: 'green',
      });
    } catch {
      // Fallback
    }
  };

  // Delete item
  const handleDelete = (id: string) => {
    saveItems(items.filter((item) => item.id !== id));
  };

  // Clear all
  const handleClearAll = () => {
    saveItems([]);
  };

  return (
    <Box p="xs">
      {/* Actions */}
      <Group justify="space-between" mb="xs">
        <Button size="xs" variant="light" leftSection={<IconClipboard size={14} />} onClick={handlePaste}>
          Panodan Ekle
        </Button>
        {items.length > 0 && (
          <Button size="xs" variant="subtle" color="red" onClick={handleClearAll}>
            Temizle
          </Button>
        )}
      </Group>

      {/* Items */}
      <ScrollArea.Autosize mah={200}>
        <Stack gap={4}>
          {items.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="md">
              Pano boş. Metinleri kopyalayıp "Panodan Ekle" ile ekleyin.
            </Text>
          ) : (
            items.map((item) => (
              <Paper key={item.id} p="xs" withBorder radius="sm">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Text size="xs" lineClamp={3} style={{ flex: 1 }}>
                    {item.text}
                  </Text>
                  <Group gap={2}>
                    <Tooltip label="Kopyala">
                      <ActionIcon size="xs" variant="subtle" color="blue" onClick={() => handleCopy(item.text)}>
                        <IconCopy size={12} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Sil">
                      <ActionIcon size="xs" variant="subtle" color="red" onClick={() => handleDelete(item.id)}>
                        <IconTrash size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Paper>
            ))
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Box>
  );
}
