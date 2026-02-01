'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBook2,
  IconCalculator,
  IconChartLine,
  IconShoppingCart,
  IconToolsKitchen2,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { useMenuPlanlama } from './components/MenuPlanlamaContext';
import { formatMoney } from '@/lib/formatters';

// Tab content components - lazy import'lar import edebiliriz ama şimdilik direkt
import YemeklerPage from './yemekler/page';
import RecetelerPage from './receteler/page';
import { FiyatYonetimiTab } from './components/FiyatYonetimiTab';

export default function MenuPlanlamaPage() {
  const { isMobile, isMounted } = useResponsive();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Context'ten sepet bilgileri
  const { 
    seciliYemekler, 
    kisiSayisi, 
    setKisiSayisi,
    toplamMaliyet, 
    clearSepet,
    handleYemekSil 
  } = useMenuPlanlama();

  // Active tab - URL ile senkronize
  const [activeTab, setActiveTab] = useState<string | null>(searchParams.get('tab') || 'yemekler');

  // Tab değiştiğinde URL'i güncelle
  const handleTabChange = (value: string | null) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'yemekler') {
      params.set('tab', value);
    } else {
      params.delete('tab');
    }
    router.push(`/muhasebe/menu-planlama?${params.toString()}`, { scroll: false });
  };

  if (!isMounted) {
    return null;
  }

  // Sepet sidebar
  const SepetSidebar = () => (
    <Paper p="md" withBorder radius="md" style={{ position: 'sticky', top: '2rem' }}>
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon size="sm" color="teal" radius="xl">
            <IconShoppingCart size={14} />
          </ThemeIcon>
          <Text fw={600} size="sm">Seçilen Yemekler</Text>
        </Group>
        {seciliYemekler.length > 0 && (
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={clearSepet}
            title="Sepeti Temizle"
          >
            <IconTrash size={14} />
          </ActionIcon>
        )}
      </Group>

      {seciliYemekler.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Henüz yemek seçilmedi
        </Text>
      ) : (
        <Stack gap="sm">
          {seciliYemekler.map((yemek, index) => (
            <Paper key={yemek.id} p="sm" radius="md" withBorder>
              <Group justify="space-between">
                <Group gap="sm">
                  <Badge size="sm" variant="light" color="gray">
                    {index + 1}
                  </Badge>
                  <Text size="sm">{yemek.ikon}</Text>
                  <Box>
                    <Text fw={500} size="sm">
                      {yemek.ad}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {yemek.kategori}
                    </Text>
                  </Box>
                </Group>
                <Group gap="sm">
                  <Text fw={600} c="teal">
                    {formatMoney(yemek.fiyat)}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleYemekSil(yemek.id)}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}
          
          {/* Maliyet Özeti */}
          <Paper p="sm" style={{ background: 'var(--mantine-color-teal-light)' }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm">Toplam Maliyet:</Text>
                <Text fw={700} c="teal">
                  {formatMoney(toplamMaliyet)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {kisiSayisi.toLocaleString('tr-TR')} Kişi için
                </Text>
                <Text size="sm" fw={600} c="teal">
                  {formatMoney(toplamMaliyet * kisiSayisi)}
                </Text>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      )}
    </Paper>
  );

  return (
    <>
      {/* Header */}
      <Group justify="space-between" wrap="wrap" gap="md" mb="xl">
        <Group gap="md">
          <ThemeIcon
            size={isMobile ? 40 : 50}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
          >
            <IconCalculator size={isMobile ? 20 : 26} />
          </ThemeIcon>
          <Box>
            <Title order={isMobile ? 4 : 2}>Menü Maliyet Hesaplama</Title>
            <Text c="dimmed" size="xs">
              Reçete seçin, maliyeti görün
            </Text>
          </Box>
        </Group>

        {seciliYemekler.length > 0 && !isMobile && (
          <Button
            variant="light"
            leftSection={<IconShoppingCart size={16} />}
            rightSection={<Badge size="sm">{seciliYemekler.length}</Badge>}
            onClick={() => handleTabChange('yemekler')}
          >
            Sepet ({seciliYemekler.length})
          </Button>
        )}
      </Group>

      {/* 🔥 TAB NAVIGATION - ÇALIŞIR DURUMDA */}
      <Tabs value={activeTab} onChange={handleTabChange} variant="outline" radius="md" mb="xl">
        <Tabs.List grow={isMobile}>
          <Tabs.Tab
            value="yemekler"
            leftSection={<IconToolsKitchen2 size={16} />}
          >
            Yemek Seçimi
          </Tabs.Tab>
          <Tabs.Tab
            value="receteler"
            leftSection={<IconBook2 size={16} />}
          >
            Reçete Yönetimi
          </Tabs.Tab>
          <Tabs.Tab
            value="fiyat-analizi"
            leftSection={<IconChartLine size={16} />}
          >
            Fiyat Analizi
          </Tabs.Tab>
        </Tabs.List>

        {/* TAB İÇERİKLERİ - ÇALIŞIR DURUMDA */}
        <Tabs.Panel value="yemekler">
          <Group align="flex-start" gap="xl">
            <Box style={{ flex: 1 }}>
              <YemeklerPage />
            </Box>
            {!isMobile && (
              <Box style={{ width: 350, flexShrink: 0 }}>
                <SepetSidebar />
              </Box>
            )}
          </Group>
        </Tabs.Panel>

        <Tabs.Panel value="receteler">
          <RecetelerPage />
        </Tabs.Panel>

        <Tabs.Panel value="fiyat-analizi">
          <FiyatYonetimiTab />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}