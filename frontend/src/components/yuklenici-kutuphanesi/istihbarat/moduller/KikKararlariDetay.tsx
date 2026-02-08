'use client';

/**
 * KİK Kararları Detay Paneli
 * Kamu İhale Kurumu şikayet ve itiraz kararları.
 */

import { Badge, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconGavel } from '@tabler/icons-react';
import { formatCurrency } from '@/types/yuklenici';

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
        <Text size="sm" c="dimmed">
          {kararlar.length} KİK kararı bulundu
        </Text>
      </Group>

      {kararlar.map((karar) => (
        <Paper key={`kik-${karar.id || karar.ihale_basligi}`} withBorder p="xs" radius="sm">
          <Text size="xs" fw={600} lineClamp={2}>
            {(karar.ihale_basligi as string) || (karar.ihale_adi as string) || 'İhale'}
          </Text>
          {!!karar.kurum_adi && (
            <Text size="xs" c="dimmed" lineClamp={1} mt={2}>
              {String(karar.kurum_adi)}
            </Text>
          )}
          <Group gap={4} mt={4}>
            {!!karar.sehir && (
              <Badge size="xs" variant="light" color="blue">
                {String(karar.sehir)}
              </Badge>
            )}
            {!!karar.sozlesme_bedeli && (
              <Text size="xs" c="orange" fw={500}>
                {formatCurrency(karar.sozlesme_bedeli as number)}
              </Text>
            )}
            {!!karar.sozlesme_tarihi && (
              <Text size="xs" c="dimmed">
                {new Date(karar.sozlesme_tarihi as string).toLocaleDateString('tr-TR')}
              </Text>
            )}
            {!karar.sozlesme_tarihi && !!karar.created_at && (
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
