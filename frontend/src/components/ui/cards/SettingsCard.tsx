'use client';

import { Group, Paper, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export interface SettingsCardProps {
  /** Kart başlığı */
  title: string;
  /** Opsiyonel açıklama */
  description?: string;
  /** Sağ üstte gösterilecek ikon (örn. mod seçici, kapat) */
  rightAction?: ReactNode;
  /** Başlık yanında ikon */
  icon?: ReactNode;
  /** Kart gövdesi (opsiyonel; sadece başlık+rightAction da kullanılabilir) */
  children?: ReactNode;
  /** Hover lift efekti */
  hover?: boolean;
}

/**
 * Dribbble Dark UI tarzı ayarlar kartı.
 * Başlık + opsiyonel sağ aksiyon + bölüm içeriği.
 */
export function SettingsCard({ title, description, rightAction, icon, children, hover = false }: SettingsCardProps) {
  return (
    <Paper
      p="lg"
      radius="md"
      className={hover ? 'dark-ui-card hover-lift' : 'dark-ui-card'}
      style={{
        background: 'var(--surface-elevated, var(--artlist-card))',
        border: '1px solid var(--surface-border, var(--artlist-border))',
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            {icon}
            <div>
              <Text fw={600} size="sm">
                {title}
              </Text>
              {description && (
                <Text size="xs" c="dimmed" mt={2}>
                  {description}
                </Text>
              )}
            </div>
          </Group>
          {rightAction}
        </Group>
        {children != null && children !== undefined && children !== false ? children : null}
      </Stack>
    </Paper>
  );
}

export default SettingsCard;
