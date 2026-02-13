'use client';

import { Box, Group, Paper, Text } from '@mantine/core';
import { formatMoney } from '@/lib/formatters';

interface PlanSummaryProps {
  doluGunSayisi: number;
  toplamGun: number;
  toplamOgun: number;
  toplamMaliyet: number;
  kisiSayisi: number;
}

export function PlanSummary({ doluGunSayisi, toplamGun, toplamOgun, toplamMaliyet, kisiSayisi }: PlanSummaryProps) {
  return (
    <Paper p="md" radius="md" withBorder>
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
    </Paper>
  );
}
