'use client';

import {
  Accordion,
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
import {
  IconCalendarEvent,
  IconChevronDown,
  IconClock,
  IconEdit,
  IconEye,
  IconTrash,
} from '@tabler/icons-react';
import React from 'react';
import { formatMoney } from '@/lib/formatters';
import { type MenuPlan, useMenuPlanlama } from './MenuPlanlamaContext';

export function KaydedilenMenuler() {
  const { kaydedilenMenuler, kaydedilenMenulerLoading } = useMenuPlanlama();

  if (kaydedilenMenulerLoading) {
    return (
      <Paper p="md" radius="md" withBorder mt="md">
        <Group justify="center" py="md">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Menüler yükleniyor...
          </Text>
        </Group>
      </Paper>
    );
  }

  if (kaydedilenMenuler.length === 0) {
    return null;
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

  const formatTarih = (tarihStr: string) => {
    const tarih = new Date(tarihStr);
    return tarih.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <Paper
      p="md"
      radius="md"
      withBorder
      mt="md"
      style={{
        background: 'var(--mantine-color-dark-6)',
        borderColor: 'var(--mantine-color-dark-4)',
      }}
    >
      <Accordion
        variant="contained"
        chevron={<IconChevronDown size={16} />}
        styles={{
          control: {
            padding: '8px 12px',
            background: 'transparent',
          },
          content: {
            padding: '8px 0',
          },
          item: {
            background: 'transparent',
            border: 'none',
          },
        }}
      >
        <Accordion.Item value="menuler">
          <Accordion.Control>
            <Group gap="xs">
              <ThemeIcon size="sm" color="violet" variant="light">
                <IconCalendarEvent size={14} />
              </ThemeIcon>
              <Text fw={600} size="sm">
                Kaydedilen Menüler
              </Text>
              <Badge size="xs" variant="light" color="violet">
                {kaydedilenMenuler.length}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              {Object.entries(menulerByProje).map(([projeName, menuler]) => (
                <Box key={projeName}>
                  {/* Proje Başlığı */}
                  <Text size="xs" c="dimmed" fw={500} mb={4}>
                    {projeName}
                  </Text>

                  {/* Menü Listesi */}
                  <Stack gap={4}>
                    {menuler.map((menu) => (
                      <Paper
                        key={menu.id}
                        p="xs"
                        radius="sm"
                        style={{
                          background: 'var(--mantine-color-dark-7)',
                          border: '1px solid var(--mantine-color-dark-5)',
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group gap={6} wrap="nowrap">
                              <Badge size="xs" variant="light" color="blue">
                                {formatTarih(menu.baslangic_tarihi)}
                              </Badge>
                              <Text size="xs" truncate fw={500}>
                                {menu.ad}
                              </Text>
                            </Group>

                            {menu.ogunler && menu.ogunler.length > 0 && (
                              <Group gap={4} mt={4}>
                                {menu.ogunler.map((ogun) => (
                                  <Badge key={ogun.id} size="xs" variant="dot" color="teal">
                                    {ogun.ogun_tipi_adi}: {ogun.yemekler?.length || 0} yemek
                                  </Badge>
                                ))}
                              </Group>
                            )}
                          </Box>

                          <Group gap={4} wrap="nowrap">
                            <Text size="xs" fw={600} c="teal">
                              {formatMoney(menu.toplam_maliyet || 0)}
                            </Text>

                            <Tooltip label="Detay">
                              <ActionIcon variant="subtle" color="gray" size="xs">
                                <IconEye size={12} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
}
