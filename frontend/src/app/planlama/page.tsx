'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Title, Text, SimpleGrid, Card, Group, ThemeIcon, Box, Stack, Badge } from '@mantine/core';
import { IconRobot, IconCalendarStats, IconChefHat, IconTrendingUp } from '@tabler/icons-react';

const planlamaModulleri = [
  {
    title: 'Piyasa Robotu',
    description: 'AI destekli piyasa fiyat araştırma ve karşılaştırma',
    icon: IconRobot,
    color: 'violet',
    href: '/planlama/piyasa-robotu',
    badge: 'Aktif',
    badgeColor: 'green'
  },
  {
    title: 'Menü Planlama',
    description: 'Haftalık/aylık menü planlama ve maliyet hesaplama',
    icon: IconChefHat,
    color: 'orange',
    href: '/planlama/menu',
    badge: 'Yakında',
    badgeColor: 'gray'
  },
  {
    title: 'Üretim Planı',
    description: 'Günlük üretim planlaması ve malzeme ihtiyacı',
    icon: IconCalendarStats,
    color: 'blue',
    href: '/planlama/uretim',
    badge: 'Yakında',
    badgeColor: 'gray'
  },
  {
    title: 'Maliyet Analizi',
    description: 'Proje ve menü bazlı maliyet analizleri',
    icon: IconTrendingUp,
    color: 'teal',
    href: '/planlama/maliyet',
    badge: 'Yakında',
    badgeColor: 'gray'
  }
];

export default function PlanlamaPage() {
  const router = useRouter();

  // Direkt Piyasa Robotu'na yönlendir
  useEffect(() => {
    router.push('/planlama/piyasa-robotu');
  }, [router]);

  return (
    <Box 
      style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)'
      }}
    >
      <Container size="lg" py="xl">
        <Stack gap="xl">
          <Box ta="center">
            <Title order={1} fw={800} mb="xs">
              🎯 Planlama Merkezi
            </Title>
            <Text c="dimmed" size="lg">
              AI destekli planlama ve analiz araçları
            </Text>
          </Box>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            {planlamaModulleri.map((modul, index) => (
              <Card
                key={index}
                withBorder
                shadow="sm"
                radius="lg"
                p="xl"
                style={{
                  cursor: modul.badge === 'Aktif' ? 'pointer' : 'default',
                  opacity: modul.badge === 'Aktif' ? 1 : 0.6,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => modul.badge === 'Aktif' && router.push(modul.href)}
              >
                <Group justify="space-between" mb="md">
                  <ThemeIcon 
                    size={50} 
                    radius="xl" 
                    variant="light" 
                    color={modul.color}
                  >
                    <modul.icon size={28} />
                  </ThemeIcon>
                  <Badge color={modul.badgeColor} variant="light">
                    {modul.badge}
                  </Badge>
                </Group>
                
                <Text fw={600} size="lg" mb={4}>
                  {modul.title}
                </Text>
                <Text size="sm" c="dimmed">
                  {modul.description}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}

