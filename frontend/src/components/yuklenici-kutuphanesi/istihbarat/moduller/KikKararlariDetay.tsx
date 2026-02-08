'use client';

/**
 * KİK Kararları Detay Paneli
 * Kamu İhale Kurumu şikayet ve itiraz kararları.
 */

import { Badge, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconGavel } from '@tabler/icons-react';

interface Props {
  veri: Record<string, unknown> | null;
}

export function KikKararlariDetay({ veri }: Props) {
  if (!veri) return <Text c="dimmed">Veri bulunamadı.</Text>;

  const kararlar = (veri.kararlar as Array<Record<string, unknown>>) || [];

  if (kararlar.length === 0) {
    return <Text c="dimmed">KİK kararı bulunamadı. Bu olumlu bir işaret olabilir.</Text>;
  }

  return (
    <Stack gap="xs">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color="red">
          <IconGavel size={14} />
        </ThemeIcon>
        <Text size="sm" c="dimmed">{kararlar.length} KİK kararı bulundu</Text>
      </Group>

      {kararlar.map((karar, idx) => (
        <Paper key={`kik-${idx}`} withBorder p="xs" radius="sm">
          <Text size="xs" fw={600} lineClamp={2}>
            {(karar.ihale_basligi as string) || (karar.ihale_adi as string) || 'İhale'}
          </Text>
          <Group gap={4} mt={4}>
            {karar.durum && (
              <Badge size="xs" variant="light" color="red">{karar.durum as string}</Badge>
            )}
            {karar.created_at && (
              <Text size="xs" c="dimmed">
                {new Date(karar.created_at as string).toLocaleDateString('tr-TR')}
              </Text>
            )}
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
