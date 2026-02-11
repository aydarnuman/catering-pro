'use client';

/**
 * NoteChecklist - Alt gorevler / checklist items
 * Metadata JSONB icinde { checklist: [{ id, text, done }] } olarak saklanir
 */

import { ActionIcon, Checkbox, Group, Progress, Stack, Text, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface NoteChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readonly?: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function NoteChecklist({ items, onChange, readonly = false }: NoteChecklistProps) {
  const [newItemText, setNewItemText] = useState('');

  const toggleItem = useCallback(
    (id: string) => {
      onChange(items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
    },
    [items, onChange]
  );

  const removeItem = useCallback(
    (id: string) => {
      onChange(items.filter((item) => item.id !== id));
    },
    [items, onChange]
  );

  const addItem = useCallback(() => {
    if (!newItemText.trim()) return;
    onChange([...items, { id: generateId(), text: newItemText.trim(), done: false }]);
    setNewItemText('');
  }, [items, newItemText, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addItem();
      }
    },
    [addItem]
  );

  // Progress
  const doneCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  return (
    <Stack gap="xs">
      {/* Progress bar */}
      {items.length > 0 && (
        <Group gap="xs" align="center">
          <Progress value={progress} size="sm" color="green" style={{ flex: 1 }} radius="xl" />
          <Text size="xs" c="dimmed" fw={500}>
            {doneCount}/{items.length}
          </Text>
        </Group>
      )}

      {/* Items */}
      {items.map((item) => (
        <Group key={item.id} gap="xs" wrap="nowrap">
          <Checkbox
            checked={item.done}
            onChange={() => !readonly && toggleItem(item.id)}
            size="xs"
            radius="xl"
            disabled={readonly}
          />
          <Text
            size="xs"
            style={{
              flex: 1,
              textDecoration: item.done ? 'line-through' : 'none',
              opacity: item.done ? 0.6 : 1,
            }}
          >
            {item.text}
          </Text>
          {!readonly && (
            <ActionIcon variant="subtle" size="xs" color="red" onClick={() => removeItem(item.id)}>
              <IconTrash size={12} />
            </ActionIcon>
          )}
        </Group>
      ))}

      {/* Add new item */}
      {!readonly && (
        <Group gap="xs">
          <TextInput
            placeholder="Gorev ekle..."
            size="xs"
            value={newItemText}
            onChange={(e) => setNewItemText(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <ActionIcon variant="light" size="sm" onClick={addItem} disabled={!newItemText.trim()}>
            <IconPlus size={14} />
          </ActionIcon>
        </Group>
      )}
    </Stack>
  );
}

export default NoteChecklist;
