'use client';

import { Badge, Box, Group, Paper, Stack, Text } from '@mantine/core';
import { formatMoney } from '@/lib/formatters';

interface OgunMaliyetBilgi {
  ad: string;
  renk: string;
  maliyet: number;
}

interface PlanSummaryProps {
  doluGunSayisi: number;
  toplamGun: number;
  toplamOgun: number;
  toplamMaliyet: number;
  kisiSayisi: number;
  ogunMaliyetleri?: OgunMaliyetBilgi[];
}

export function PlanSummary({
  doluGunSayisi,
  toplamGun,
  toplamOgun,
  toplamMaliyet,
  kisiSayisi,
  ogunMaliyetleri,
}: PlanSummaryProps) {
  const gunlukOrtMaliyet = doluGunSayisi > 0 ? toplamMaliyet / doluGunSayisi : 0;
  const kisiBasi = doluGunSayisi > 0 ? toplamMaliyet / (doluGunSayisi * kisiSayisi) : 0;

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xl">
            <Box>
              <Text size="xs" c="dimmed">
                Dolu Gün
              </Text>
              <Text fw={700} size="xl">
                {doluGunSayisi} / {toplamGun}
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                Toplam Öğün
              </Text>
              <Text fw={700} size="xl">
                {toplamOgun}
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                Porsiyon Maliyeti
              </Text>
              <Text fw={700} size="xl" c="teal">
                {formatMoney(toplamMaliyet)}
              </Text>
            </Box>
            {doluGunSayisi > 0 && (
              <>
                <Box>
                  <Text size="xs" c="dimmed">
                    Günlük Ort. Maliyet
                  </Text>
                  <Text fw={700} size="xl" c="blue">
                    {formatMoney(gunlukOrtMaliyet)}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">
                    Kişi Başı / Gün
                  </Text>
                  <Text fw={700} size="xl" c="orange">
                    {formatMoney(kisiBasi)}
                  </Text>
                </Box>
              </>
            )}
          </Group>
          <Box>
            <Text size="xs" c="dimmed">
              {kisiSayisi.toLocaleString('tr-TR')} Kişilik Toplam
            </Text>
            <Text fw={700} size="xl" c="teal">
              {formatMoney(toplamMaliyet * kisiSayisi)}
            </Text>
          </Box>
        </Group>

        {/* Öğün Bazlı Maliyet Dağılımı */}
        {ogunMaliyetleri && ogunMaliyetleri.some((o) => o.maliyet > 0) && (
          <Group gap="md" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
            <Text size="xs" fw={600} c="dimmed">
              Öğün Dağılımı:
            </Text>
            {ogunMaliyetleri.map((ogun) =>
              ogun.maliyet > 0 ? (
                <Badge key={ogun.ad} size="lg" variant="light" color={ogun.renk}>
                  {ogun.ad}: {formatMoney(ogun.maliyet)}
                </Badge>
              ) : null
            )}
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
