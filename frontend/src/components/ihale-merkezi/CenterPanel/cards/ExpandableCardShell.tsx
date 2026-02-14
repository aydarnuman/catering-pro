'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconChevronDown,
  IconDeviceFloppy,
  IconEdit,
  IconExternalLink,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';

export interface ExpandableCardShellProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  badge?: string | number;
  children: React.ReactNode;
  // Expand/collapse
  expandable?: boolean;
  totalCount?: number;
  initialShowCount?: number;
  maxExpandedHeight?: number;
  // HITL editing
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  isCorrected?: boolean;
  // Detail modal trigger
  onOpenDetail?: () => void;
  // Extra header content
  headerExtra?: React.ReactNode;
  // Empty state
  hidden?: boolean;
}

export function ExpandableCardShell({
  title,
  icon,
  color,
  badge,
  children,
  expandable = false,
  totalCount,
  initialShowCount,
  maxExpandedHeight = 400,
  isEditing,
  onToggleEdit,
  onSave,
  onDelete,
  isCorrected,
  onOpenDetail,
  headerExtra,
  hidden,
}: ExpandableCardShellProps) {
  const [expanded, setExpanded] = useState(false);

  if (hidden) return null;

  const hasMore = expandable && totalCount != null && initialShowCount != null && totalCount > initialShowCount;

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      className="glassy-card-nested"
      style={isCorrected ? { borderColor: 'var(--mantine-color-green-5)' } : undefined}
    >
      {/* Header */}
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color={color}>
            {icon}
          </ThemeIcon>
          <Text size="sm" fw={600}>
            {title}
          </Text>
          {badge != null && (
            <Badge size="xs" variant="light" color={color}>
              {badge}
            </Badge>
          )}
          {isCorrected && (
            <Badge size="xs" variant="filled" color="green">
              Düzeltildi
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          {/* Detail modal trigger */}
          {onOpenDetail && !isEditing && (
            <Tooltip label="Detay" position="top" withArrow>
              <ActionIcon size="xs" variant="subtle" color={color} onClick={onOpenDetail}>
                <IconExternalLink size={12} />
              </ActionIcon>
            </Tooltip>
          )}
          {/* Delete */}
          {onDelete && !isEditing && (
            <ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete} title="Kartı Temizle">
              <IconTrash size={12} />
            </ActionIcon>
          )}
          {/* Edit toggle */}
          {onToggleEdit && !isEditing && (
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onToggleEdit}>
              <IconEdit size={12} />
            </ActionIcon>
          )}
          {/* Edit mode buttons */}
          {isEditing && (
            <Group gap={4}>
              <Button size="compact-xs" variant="light" color="gray" onClick={onToggleEdit}>
                İptal
              </Button>
              <Button
                size="compact-xs"
                variant="filled"
                color="green"
                onClick={onSave}
                leftSection={<IconDeviceFloppy size={12} />}
              >
                Kaydet
              </Button>
            </Group>
          )}
          {/* Expand/collapse */}
          {hasMore && !isEditing && (
            <Button
              size="xs"
              variant="subtle"
              color={color}
              onClick={() => setExpanded(!expanded)}
              rightSection={
                <IconChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              }
            >
              {expanded ? 'Daralt' : `Tümü (${totalCount})`}
            </Button>
          )}
          {/* Extra header content */}
          {headerExtra}
        </Group>
      </Group>

      {/* Content */}
      <ScrollArea.Autosize mah={expanded || isEditing ? maxExpandedHeight : undefined}>
        {children}
      </ScrollArea.Autosize>
    </Paper>
  );
}

/**
 * Kart icinde expand state'ini yonetmek icin yardimci.
 * ExpandableCardShell.expanded degerine erisim vermez (internal),
 * bu hook kart iceriginin kac item gosterecegini yonetir.
 */
export function useExpandableItems<T>(items: T[], initialCount: number, isEditing?: boolean) {
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || !!isEditing;
  const displayItems = showAll ? items : items.slice(0, initialCount);
  const hasMore = items.length > initialCount;

  return { expanded, setExpanded, displayItems, hasMore, showAll };
}
