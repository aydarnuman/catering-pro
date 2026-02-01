'use client';

import { Box, Group, Text, ThemeIcon, Title } from '@mantine/core';
import { IconChartLine } from '@tabler/icons-react';
import { useResponsive } from '@/hooks/useResponsive';
import { FiyatYonetimiTab } from '../components/FiyatYonetimiTab';

export default function FiyatAnaliziPage() {
  const { isMobile, isMounted } = useResponsive();

  if (!isMounted) {
    return null;
  }

  return (
    <>
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <Group gap="md">
          <ThemeIcon
            size={isMobile ? 40 : 50}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'violet', to: 'blue' }}
          >
            <IconChartLine size={isMobile ? 20 : 26} />
          </ThemeIcon>
          <Box>
            <Title order={isMobile ? 4 : 2}>Fiyat Analizi</Title>
            <Text c="dimmed" size="xs">
              Piyasa fiyatları, trend analizi ve fiyat yönetimi
            </Text>
          </Box>
        </Group>
      </Group>

      {/* Fiyat Yönetimi Tab */}
      <FiyatYonetimiTab />
    </>
  );
}