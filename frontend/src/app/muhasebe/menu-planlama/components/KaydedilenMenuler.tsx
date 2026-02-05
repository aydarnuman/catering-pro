'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconCalendarEvent, IconEye } from '@tabler/icons-react';
import { formatMoney } from '@/lib/formatters';
import { type MenuPlan, useMenuPlanlama } from './MenuPlanlamaContext';

// Kaydedilen Menü Kartı
const KaydedilenMenuKart = ({ menu }: { menu: MenuPlan }) => {
  const formatTarih = (tarihStr: string) => {
    const tarih = new Date(tarihStr);
    return tarih.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Paper
      p="sm"
      radius="md"
      style={{
        background: 'var(--mantine-color-dark-7)',
        border: '1px solid var(--mantine-color-dark-5)',
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={8} wrap="nowrap">
            <Badge size="sm" variant="light" color="blue">
              {formatTarih(menu.baslangic_tarihi)}
            </Badge>
            <Text size="sm" truncate fw={500}>
              {menu.ad}
            </Text>
          </Group>

          {menu.ogunler && menu.ogunler.length > 0 && (
            <Group gap={6} mt={6}>
              {menu.ogunler.map((ogun) => (
                <Badge key={ogun.id} size="xs" variant="dot" color="teal">
                  {ogun.ogun_tipi_adi}: {ogun.yemekler?.length || 0} yemek
                </Badge>
              ))}
            </Group>
          )}
        </Box>

        <Group gap={8} wrap="nowrap">
          <Text size="sm" fw={600} c="teal">
            {formatMoney(menu.toplam_maliyet || 0)}
          </Text>

          <Tooltip label="Detay">
            <ActionIcon variant="subtle" color="gray" size="sm">
              <IconEye size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );
};

export function KaydedilenMenuler() {
  const { kaydedilenMenuler, kaydedilenMenulerLoading } = useMenuPlanlama();

  if (kaydedilenMenulerLoading) {
    return (
      <Paper p="xl" radius="md" withBorder>
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text>Menüler yükleniyor...</Text>
        </Group>
      </Paper>
    );
  }

  if (kaydedilenMenuler.length === 0) {
    return (
      <Paper p="xl" radius="md" withBorder>
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon size={60} radius="xl" variant="light" color="gray">
            <IconCalendarEvent size={30} />
          </ThemeIcon>
          <Stack gap={4} align="center">
            <Text fw={500}>Henüz kaydedilmiş menü yok</Text>
            <Text size="sm" c="dimmed" ta="center">
              Planlama &gt; Takvim bölümünden menü oluşturup kaydedin
            </Text>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  // Menüleri projeye göre grupla
  const menulerByProje = kaydedilenMenuler.reduce(
    (acc, menu) => {
      const projeKey = menu.proje_adi || `Proje ${menu.proje_id}`;
      if (!acc[projeKey]) {
        acc[projeKey] = [];
      }
      acc[projeKey].push(menu);
      return acc;
    },
    {} as Record<string, MenuPlan[]>
  );

  return (
    <Stack gap="md">
      {Object.entries(menulerByProje).map(([projeName, menuler]) => (
        <Paper
          key={projeName}
          p="md"
          radius="md"
          withBorder
          style={{
            background: 'var(--mantine-color-dark-6)',
            borderColor: 'var(--mantine-color-dark-4)',
          }}
        >
          <Group gap="xs" mb="sm">
            <ThemeIcon size="sm" color="violet" variant="light">
              <IconCalendarEvent size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              {projeName}
            </Text>
            <Badge size="xs" variant="light" color="violet">
              {menuler.length} menü
            </Badge>
          </Group>

          <Stack gap="xs">
            {menuler.map((menu) => (
              <KaydedilenMenuKart key={menu.id} menu={menu} />
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
