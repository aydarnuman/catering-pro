'use client';

/**
 * Katılımcılar Detay Paneli
 * İhalelerdeki diğer katılımcı firmalar.
 */

import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { formatCurrency } from '@/types/yuklenici';

interface Props {
  veri: Record<string, unknown> | null;
}

export function KatilimcilarDetay({ veri }: Props) {
  if (!veri) return <Text c="dimmed">Veri bulunamadı.</Text>;

  const katilimcilar = (veri.katilimcilar as Array<Record<string, unknown>>) || [];

  if (katilimcilar.length === 0) {
    return <Text c="dimmed">Katılımcı verisi henüz yok. Modülü çalıştırarak veri toplayabilirsiniz.</Text>;
  }

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed" mb="xs">
        {katilimcilar.length} katılımcı kaydı
      </Text>

      {katilimcilar.slice(0, 25).map((k, idx) => (
        <Paper key={`kat-${idx}`} withBorder p="xs" radius="sm">
          <Group justify="space-between" wrap="nowrap">
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" fw={600} lineClamp={1}>
                {(k.ihale_basligi as string) || (k.ihale_adi as string) || 'İhale'}
              </Text>
              <Group gap={4} mt={2}>
                {!!k.sehir && (
                  <Badge size="xs" variant="light">
                    {String(k.sehir)}
                  </Badge>
                )}
                <Badge size="xs" variant="light" color="cyan">
                  Katılımcı
                </Badge>
              </Group>
            </div>
            {!!k.sozlesme_bedeli && (
              <Text size="xs" fw={600} c="orange">
                {String(formatCurrency(k.sozlesme_bedeli as number))}
              </Text>
            )}
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
