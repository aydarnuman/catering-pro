'use client';

import { Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';

export interface StatusCardProps {
  /** Büyük ikon veya görsel */
  icon: ReactNode;
  /** Ana durum metni (örn. "Complete uploading") */
  label: string;
  /** Alt etiket (örn. "2 files") */
  sublabel?: string;
  /** Sağ tarafta aksiyon (örn. yeniden başlat butonu) */
  action?: ReactNode;
  /** Vurgu rengi (Mantine color) */
  color?: string;
}

/**
 * Dribbble Dark UI tarzı durum kartı (Upload "Complete uploading" benzeri).
 * Büyük ikon + durum metni + alt etiket + opsiyonel aksiyon.
 */
export function StatusCard({ icon, label, sublabel, action, color = 'violet' }: StatusCardProps) {
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
      <Group justify="space-between" wrap="nowrap">
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon size="xl" radius="md" variant="light" color={color}>
            {icon}
          </ThemeIcon>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" lineClamp={1}>
              {label}
            </Text>
            {sublabel && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {sublabel}
              </Text>
            )}
          </Stack>
        </Group>
        {action}
      </Group>
    </Paper>
  );
}

export default StatusCard;
