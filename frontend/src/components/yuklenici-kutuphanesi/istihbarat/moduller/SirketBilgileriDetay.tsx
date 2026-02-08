'use client';

/**
 * Şirket Bilgileri Detay Paneli
 * MERSİS ve Ticaret Sicil Gazetesi verileri.
 */

import { Badge, Card, Divider, Group, Paper, Stack, Text } from '@mantine/core';

interface Props {
  veri: Record<string, unknown> | null;
}

export function SirketBilgileriDetay({ veri }: Props) {
  if (!veri)
    return <Text c="dimmed">Veri bulunamadı. Modülü çalıştırarak veri toplayabilirsiniz.</Text>;

  const mersis = veri.mersis as Record<string, unknown> | undefined;
  const ticaretSicil = veri.ticaret_sicil as Record<string, unknown> | undefined;
  const sorgulamaTarihi = veri.sorgulama_tarihi as string | undefined;

  return (
    <Stack gap="md">
      {/* MERSİS Bilgileri */}
      <div>
        <Group gap="xs" mb="xs">
          <Badge variant="filled" color="teal" size="sm">
            MERSİS
          </Badge>
          <Text size="xs" c="dimmed">
            Merkezi Sicil Kayıt Sistemi
          </Text>
        </Group>

        {mersis?.basarili ? (
          <Card withBorder p="sm" radius="sm">
            <Stack gap={4}>
              {Object.entries(mersis)
                .filter(([key]) => !['basarili', 'not'].includes(key))
                .map(([key, value]) => (
                  <Group key={key} justify="space-between">
                    <Text size="xs" c="dimmed" style={{ textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}
                    </Text>
                    <Text size="xs" fw={500}>
                      {String(value)}
                    </Text>
                  </Group>
                ))}
            </Stack>
          </Card>
        ) : (
          <Text size="xs" c="dimmed">
            {(mersis?.not as string) || 'MERSİS verisi alınamadı.'}
          </Text>
        )}
      </div>

      <Divider />

      {/* Ticaret Sicil Gazetesi */}
      <div>
        <Group gap="xs" mb="xs">
          <Badge variant="filled" color="blue" size="sm">
            Ticaret Sicil
          </Badge>
          <Text size="xs" c="dimmed">
            Ticaret Sicil Gazetesi İlanları
          </Text>
        </Group>

        {ticaretSicil?.basarili && (ticaretSicil.ilanlar as unknown[])?.length > 0 ? (
          <Stack gap="xs">
            {(ticaretSicil.ilanlar as Array<Record<string, string>>).map((ilan, idx) => (
              <Paper key={`ilan-${idx}`} withBorder p="xs" radius="sm">
                <Group justify="space-between" mb={2}>
                  {ilan.ilan_tarihi && (
                    <Badge size="xs" variant="light">
                      {ilan.ilan_tarihi}
                    </Badge>
                  )}
                  {ilan.ilan_turu && (
                    <Badge size="xs" variant="light" color="grape">
                      {ilan.ilan_turu}
                    </Badge>
                  )}
                </Group>
                <Text size="xs" lineClamp={3}>
                  {ilan.ozet}
                </Text>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">
            {(ticaretSicil?.not as string) || 'Ticaret Sicil Gazetesi ilanı bulunamadı.'}
          </Text>
        )}
      </div>

      {sorgulamaTarihi && (
        <Text size="xs" c="dimmed" ta="right">
          Son sorgulama: {new Date(sorgulamaTarihi).toLocaleString('tr-TR')}
        </Text>
      )}
    </Stack>
  );
}
