'use client';

import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import { IconDeviceFloppy, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';

interface CardEditToolbarProps {
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  /** Ek buton: "Yeni ekle" gibi */
  onAdd?: () => void;
  addLabel?: string;
}

/**
 * Kart basliginda edit/save/cancel/delete butonlari.
 * ExpandableCardShell icerisinde varsayilan olarak render edilir,
 * ancak ozel durumlar icin bagimsiz olarak da kullanilabilir.
 */
export function CardEditToolbar({ isEditing, onToggleEdit, onSave, onDelete, onAdd, addLabel }: CardEditToolbarProps) {
  if (isEditing) {
    return (
      <Group gap={4}>
        <Button size="compact-xs" variant="light" color="gray" onClick={onToggleEdit}>
          İptal
        </Button>
        <Button size="compact-xs" variant="filled" color="green" onClick={onSave} leftSection={<IconDeviceFloppy size={12} />}>
          Kaydet
        </Button>
      </Group>
    );
  }

  return (
    <Group gap={4}>
      {onDelete && (
        <Tooltip label="Kartı Temizle" withArrow>
          <ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete}>
            <IconTrash size={12} />
          </ActionIcon>
        </Tooltip>
      )}
      {onToggleEdit && (
        <Tooltip label="Düzenle" withArrow>
          <ActionIcon size="xs" variant="subtle" color="gray" onClick={onToggleEdit}>
            <IconEdit size={12} />
          </ActionIcon>
        </Tooltip>
      )}
      {onAdd && (
        <Button size="compact-xs" variant="light" color="blue" leftSection={<IconPlus size={12} />} onClick={onAdd}>
          {addLabel || 'Ekle'}
        </Button>
      )}
    </Group>
  );
}
