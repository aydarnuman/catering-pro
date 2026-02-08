'use client';

import { Card, Group, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';

export function StatMiniCard({
  label,
  value,
  sub,
  color = 'blue',
  icon,
  gold,
}: {
  label: string;
  value: string | number | undefined;
  sub?: string;
  color?: string;
  icon?: ReactNode;
  /** When true, renders with premium gold accent */
  gold?: boolean;
}) {
  return (
    <Card
      p="xs"
      radius="md"
      className="yk-stat-card"
      style={
        {
          '--card-bg': 'transparent',
          borderColor: gold ? 'var(--yk-gold-glow)' : undefined,
        } as React.CSSProperties
      }
    >
      <Group gap={6} mb={2}>
        {icon && (
          <ThemeIcon
            size="sm"
            variant="light"
            color={gold ? 'yellow' : color}
            radius="sm"
            style={
              gold
                ? {
                    background: 'var(--yk-gold-dim)',
                    color: 'var(--yk-gold)',
                  }
                : undefined
            }
          >
            {icon}
          </ThemeIcon>
        )}
        <Text
          size="xs"
          c="dimmed"
          lineClamp={1}
          style={{ letterSpacing: '0.02em', textTransform: 'uppercase', fontSize: 10 }}
        >
          {label}
        </Text>
      </Group>
      <Text
        fw={700}
        size="md"
        style={gold ? { color: 'var(--yk-gold)' } : undefined}
        c={gold ? undefined : color}
      >
        {value ?? '-'}
      </Text>
      {sub && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {sub}
        </Text>
      )}
    </Card>
  );
}
