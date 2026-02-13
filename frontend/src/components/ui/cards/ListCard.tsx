'use client';

import { Group, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export interface ListCardProps {
  /** Kart başlığı */
  title: string;
  /** Sağ üstte aksiyon (örn. + butonu, bildirim) */
  rightActions?: ReactNode;
  /** Başlık altında ana buton (örn. "New Task") */
  primaryAction?: ReactNode;
  /** Liste içeriği - scroll alanında */
  children: ReactNode;
  /** Maksimum yükseklik (örn. 320) */
  maxHeight?: number;
}

/**
 * Dribbble Dark UI tarzı liste kartı (Members List benzeri).
 * Başlık + aksiyonlar + opsiyonel ana buton + scroll liste.
 */
export function ListCard({ title, rightActions, primaryAction, children, maxHeight = 320 }: ListCardProps) {
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
          <Text fw={600} size="sm">
            {title}
          </Text>
          {rightActions}
        </Group>
        {primaryAction && <div>{primaryAction}</div>}
        <ScrollArea h={maxHeight} type="auto" scrollbarSize={8}>
          <Stack gap="xs">{children}</Stack>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

export default ListCard;
