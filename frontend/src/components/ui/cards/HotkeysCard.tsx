'use client';

import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { IconKey } from '@tabler/icons-react';
import { formatHotkey, HOTKEY_LIST } from '@/hooks/useGlobalHotkeys';

export interface HotkeysCardProps {
  /** Sağ üstte durum (örn. yeşil nokta "Aktif") */
  showStatus?: boolean;
}

/**
 * Dribbble Dark UI tarzı kısayollar kartı.
 * HOTKEY_LIST ile liste gösterir; formatHotkey ile tuş birleşimini formatlar.
 */
export function HotkeysCard({ showStatus = true }: HotkeysCardProps) {
  return (
    <Paper
      p="lg"
      radius="md"
      className="dark-ui-card"
      style={{
        background: 'var(--surface-elevated, var(--artlist-card))',
        border: '1px solid var(--surface-border, var(--artlist-border))',
      }}
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <IconKey size={18} color="var(--card-accent, var(--mantine-color-violet-5))" />
            <Text fw={600} size="sm">
              Kısayollar
            </Text>
          </Group>
          {showStatus && (
            <Badge size="xs" color="green" variant="dot">
              Aktif
            </Badge>
          )}
        </Group>
        <Stack gap="xs">
          {HOTKEY_LIST.map((item) => (
            <Group key={`${formatHotkey(item)}-${item.description}`} justify="space-between" wrap="nowrap">
              <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                {item.description}
              </Text>
              <Badge
                size="sm"
                variant="light"
                color="violet"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 500,
                }}
              >
                {formatHotkey(item)}
              </Badge>
            </Group>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default HotkeysCard;
