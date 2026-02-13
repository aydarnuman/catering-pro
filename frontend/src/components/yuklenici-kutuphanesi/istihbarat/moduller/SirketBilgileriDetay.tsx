'use client';

/**
 * Şirket Bilgileri Detay Paneli
 * MERSİS ve Ticaret Sicil Gazetesi verileri.
 */

import { Anchor, Badge, Card, Divider, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconExternalLink, IconWorld } from '@tabler/icons-react';
import type { HavuzVeri } from '../ModulDetay';

interface Props {
  veri: Record<string, unknown> | null;
  /** Veri havuzundan zenginleştirilmiş web istihbaratı */
  havuzVeri?: HavuzVeri | null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function SirketBilgileriDetay({ veri, havuzVeri }: Props) {
  if (!veri) return <Text c="dimmed">Veri bulunamadı. Modülü çalıştırarak veri toplayabilirsiniz.</Text>;

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
            {(ticaretSicil.ilanlar as Array<Record<string, string>>).map((ilan) => (
              <Paper
                key={ilan.ilan_tarihi + ilan.ilan_turu + (ilan.ozet?.slice(0, 30) || '')}
                withBorder
                p="xs"
                radius="sm"
              >
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

      {/* Veri Havuzundan ek sicil bulguları */}
      {havuzVeri?.web_istihbarat?.sicil_sonuclari && havuzVeri.web_istihbarat.sicil_sonuclari.length > 0 && (
        <>
          <Divider />
          <div>
            <Group gap="xs" mb="xs">
              <ThemeIcon size="sm" variant="light" color="indigo">
                <IconWorld size={12} />
              </ThemeIcon>
              <Title order={6}>Web Sicil Bulguları ({havuzVeri.web_istihbarat.sicil_sonuclari.length})</Title>
              <Badge size="xs" variant="light" color="indigo">
                Veri Havuzu
              </Badge>
            </Group>

            <Stack gap="xs">
              {havuzVeri.web_istihbarat.sicil_sonuclari.map((item) => (
                <Paper key={item.url || item.title} withBorder p="sm" radius="sm">
                  <Group justify="space-between" wrap="nowrap" mb={4}>
                    <Text size="sm" fw={600} lineClamp={2} style={{ flex: 1 }}>
                      {item.url ? (
                        <Anchor href={item.url} target="_blank" underline="hover" c="inherit">
                          {item.title || 'Sicil kaynağı'}
                          <IconExternalLink size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                        </Anchor>
                      ) : (
                        item.title || 'Sicil kaynağı'
                      )}
                    </Text>
                  </Group>
                  {item.content && (
                    <Text size="xs" c="dimmed" lineClamp={3} mb={4}>
                      {item.content}
                    </Text>
                  )}
                  <Badge size="xs" variant="outline" color="gray">
                    {getDomain(item.url)}
                  </Badge>
                </Paper>
              ))}
            </Stack>
          </div>
        </>
      )}

      {sorgulamaTarihi && (
        <Text size="xs" c="dimmed" ta="right">
          Son sorgulama: {new Date(sorgulamaTarihi).toLocaleString('tr-TR')}
        </Text>
      )}
      {havuzVeri?.meta?.toplama_tarihi && (
        <Text size="xs" c="dimmed" ta="right">
          Veri havuzu: {new Date(havuzVeri.meta.toplama_tarihi).toLocaleString('tr-TR')}
        </Text>
      )}
    </Stack>
  );
}
