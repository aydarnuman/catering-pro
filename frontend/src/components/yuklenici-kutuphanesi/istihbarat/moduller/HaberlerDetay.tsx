'use client';

/**
 * Haberler Detay Paneli
 * Google News RSS'ten çekilen güncel haberler.
 */

import { Anchor, Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

interface Props {
  veri: Record<string, unknown> | null;
}

export function HaberlerDetay({ veri }: Props) {
  if (!veri) return <Text c="dimmed">Veri bulunamadı. Modülü çalıştırarak haber taraması yapabilirsiniz.</Text>;

  const haberler = (veri.haberler as Array<Record<string, unknown>>) || [];
  const toplam = (veri.toplam as number) || haberler.length;
  const aramaMetni = veri.arama_metni as string | undefined;
  const sorgulamaTarihi = veri.sorgulama_tarihi as string | undefined;

  if (haberler.length === 0) {
    return (
      <Stack gap="sm">
        <Text c="dimmed">
          {aramaMetni
            ? `"${aramaMetni}" araması için haber bulunamadı.`
            : 'Haber bulunamadı.'}
        </Text>
        <Text size="xs" c="dimmed">Bu firma hakkında güncel haber kaynağı yok olabilir.</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed" mb="xs">
        {toplam} haber bulundu
        {aramaMetni && <Text span size="xs"> — &quot;{aramaMetni}&quot;</Text>}
      </Text>

      {haberler.map((haber, idx) => (
        <Paper key={`haber-${idx}`} withBorder p="sm" radius="sm">
          <Group justify="space-between" wrap="nowrap" mb={4}>
            <Text size="sm" fw={600} lineClamp={2} style={{ flex: 1 }}>
              {haber.link ? (
                <Anchor href={haber.link as string} target="_blank" underline="hover" c="inherit">
                  {haber.baslik as string}
                  <IconExternalLink size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                </Anchor>
              ) : (
                haber.baslik as string
              )}
            </Text>
          </Group>

          {haber.ozet && (
            <Text size="xs" c="dimmed" lineClamp={2} mb={4}>{haber.ozet as string}</Text>
          )}

          <Group gap={8}>
            {haber.kaynak && <Badge size="xs" variant="light" color="violet">{haber.kaynak as string}</Badge>}
            {haber.tarih_okunur && <Text size="xs" c="dimmed">{haber.tarih_okunur as string}</Text>}
          </Group>
        </Paper>
      ))}

      {sorgulamaTarihi && (
        <Text size="xs" c="dimmed" ta="right" mt="xs">
          Son tarama: {new Date(sorgulamaTarihi).toLocaleString('tr-TR')}
        </Text>
      )}
    </Stack>
  );
}
