'use client';

import { Stack, Text, Title } from '@mantine/core';
import { HotkeysCard } from '@/components/ui/cards';

export default function KisayollarSection() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb={4}>
          ⌨️ Kısayollar
        </Title>
        <Text c="dimmed" size="sm">
          Klavye kısayolları ile hızlı erişim
        </Text>
      </div>
      <HotkeysCard />
    </Stack>
  );
}
