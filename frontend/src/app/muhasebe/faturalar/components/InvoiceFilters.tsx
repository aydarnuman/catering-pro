/**
 * InvoiceFilters Component
 * Fatura sayfası için filtre ve istatistik bileşeni
 * - Stats cards (Satış, Alış, Uyumsoft, Bekleyen)
 * - Tab navigation
 * - Search input
 */

'use client';

import {
  Card,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import {
  IconClock,
  IconCloudDownload,
  IconFileInvoice,
  IconReceipt,
  IconSearch,
} from '@tabler/icons-react';
import { formatMoney } from '@/lib/formatters';

export interface InvoiceFiltersProps {
  // Tab state
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;

  // Search state
  searchTerm: string;
  onSearchChange: (term: string) => void;

  // Stats data
  stats: {
    toplamSatis: number;
    toplamAlis: number;
    uyumsoftToplam: number;
    bekleyenToplam: number;
    manuelCount: number;
    uyumsoftCount: number;
    satisCount: number;
    alisCount: number;
  };

  // Mobile detection
  isMobile?: boolean;
}

export function InvoiceFilters({
  activeTab,
  onTabChange,
  searchTerm,
  onSearchChange,
  stats,
  isMobile = false,
}: InvoiceFiltersProps) {
  return (
    <>
      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card withBorder shadow="sm" p="lg" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Satış Faturaları
            </Text>
            <ThemeIcon color="green" variant="light" size="lg" radius="md">
              <IconReceipt size={20} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="md" c="green">
            {formatMoney(stats.toplamSatis)}
          </Text>
          <Text size="xs" c="dimmed">
            {stats.satisCount} fatura
          </Text>
        </Card>

        <Card withBorder shadow="sm" p="lg" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Alış Faturaları
            </Text>
            <ThemeIcon color="orange" variant="light" size="lg" radius="md">
              <IconFileInvoice size={20} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="md" c="orange">
            {formatMoney(stats.toplamAlis)}
          </Text>
          <Text size="xs" c="dimmed">
            {stats.alisCount} fatura
          </Text>
        </Card>

        <Card withBorder shadow="sm" p="lg" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Uyumsoft Gelen
            </Text>
            <ThemeIcon color="violet" variant="light" size="lg" radius="md">
              <IconCloudDownload size={20} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="md" c="violet">
            {formatMoney(stats.uyumsoftToplam)}
          </Text>
          <Text size="xs" c="dimmed">
            {stats.uyumsoftCount} fatura
          </Text>
        </Card>

        <Card withBorder shadow="sm" p="lg" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Bekleyen Tahsilat
            </Text>
            <ThemeIcon color="blue" variant="light" size="lg" radius="md">
              <IconClock size={20} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="md" c="blue">
            {formatMoney(stats.bekleyenToplam)}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Filters & Search */}
      <Card withBorder shadow="sm" p={{ base: 'sm', sm: 'lg' }} radius="md">
        <Stack gap="md">
          {/* Tabs with horizontal scroll on mobile */}
          <ScrollArea type="scroll" offsetScrollbars scrollbarSize={4}>
            <Tabs value={activeTab} onChange={onTabChange}>
              <Tabs.List style={{ flexWrap: 'nowrap' }}>
                <Tabs.Tab value="tumu">Tümü</Tabs.Tab>
                <Tabs.Tab value="manuel">Manuel ({stats.manuelCount})</Tabs.Tab>
                <Tabs.Tab value="uyumsoft" color="violet">
                  Uyumsoft ({stats.uyumsoftCount})
                </Tabs.Tab>
                <Tabs.Tab value="satis" color="green">
                  Satış
                </Tabs.Tab>
                <Tabs.Tab value="alis" color="orange">
                  Alış
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </ScrollArea>

          {/* Search - full width on mobile */}
          <TextInput
            placeholder="Fatura ara..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.currentTarget.value)}
            style={{ maxWidth: isMobile ? '100%' : 250 }}
          />
        </Stack>
      </Card>
    </>
  );
}
