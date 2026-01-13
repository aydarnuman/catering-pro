'use client';

import { 
  Container, 
  Title, 
  Grid, 
  Card, 
  Text, 
  Badge,
  Button,
  Group,
  Stack,
  Loader,
  Alert,
  ThemeIcon,
  Box,
  SimpleGrid,
  Paper,
  Progress,
  RingProgress,
  Center
} from '@mantine/core';
import { 
  IconUpload, 
  IconList, 
  IconChartBar, 
  IconFileText,
  IconBrain,
  IconClock,
  IconAlertCircle,
  IconTrendingUp,
  IconChecklist,
  IconSparkles,
  IconRocket
} from '@tabler/icons-react';
import Link from 'next/link';
import useSWR from 'swr';
import { apiClient } from '@/lib/api';
import { StatsResponse } from '@/types/api';
import { AIChat } from '@/components/AIChat';
import { AIDashboardWidget } from '@/components/AIDashboardWidget';

export default function HomePage() {
  // Fetch stats from backend
  const { 
    data: stats, 
    error, 
    isLoading 
  } = useSWR<StatsResponse>('stats', apiClient.getStats);

  const totalTenders = stats?.totalTenders || 0;
  const activeTenders = stats?.activeTenders || 0;
  const activePercentage = totalTenders > 0 ? (activeTenders / totalTenders) * 100 : 0;

  return (
    <Box
      style={{
        background: 'linear-gradient(180deg, rgba(34,139,230,0.05) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh',
        paddingTop: '2rem',
        paddingBottom: '4rem'
      }}
    >
      <Container size="xl">
        <Stack gap="xl">
          {/* Hero Section */}
          <Box ta="center" py="xl">
            <Center>
              <img 
                src="/logo.png" 
                alt="Catering Pro Logo" 
                style={{ 
                  height: 140, 
                  width: 'auto',
                  objectFit: 'contain'
                }}
              />
            </Center>
            <Text size="xl" c="dimmed" mt="xl" maw={600} mx="auto">
              AI destekli ihale analiz ve yönetim sistemi ile ihalelerinizi kolayca takip edin
            </Text>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert 
              icon={<IconAlertCircle size={16} />} 
              title="Bağlantı Hatası" 
              color="red"
              variant="filled"
            >
              Backend sunucusuna bağlanılamıyor. Lütfen sunucunun çalıştığından emin olun.
            </Alert>
          )}

          {/* Quick Stats - Modern Design */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            {/* Toplam İhale */}
            <Card shadow="md" padding="lg" radius="lg" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <ThemeIcon size={40} radius="md" variant="light" color="blue">
                    <IconFileText size={22} />
                  </ThemeIcon>
                  {isLoading && <Loader size="xs" />}
                </Group>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  Toplam İhale
                </Text>
                <Text size="28px" fw={900} c="blue" style={{ lineHeight: 1 }}>
                  {totalTenders}
                </Text>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    {activeTenders} aktif
                  </Text>
                  <Text size="xs" c="dimmed">
                    {totalTenders - activeTenders} kapalı
                  </Text>
                </Group>
              </Stack>
            </Card>

            {/* AI Analiz */}
            <Card shadow="md" padding="lg" radius="lg" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <ThemeIcon size={40} radius="md" variant="light" color="green">
                    <IconBrain size={22} />
                  </ThemeIcon>
                  {isLoading && <Loader size="xs" />}
                </Group>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  AI Analiz
                </Text>
                <Text size="28px" fw={900} c="green" style={{ lineHeight: 1 }}>
                  {stats?.aiAnalysisCount || 0}
                </Text>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Gemini 2.5
                  </Text>
                  <Badge variant="dot" color="green" size="xs">
                    Aktif
                  </Badge>
                </Group>
              </Stack>
            </Card>

            {/* Dökümanlar */}
            <Card shadow="md" padding="lg" radius="lg" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <ThemeIcon size={40} radius="md" variant="light" color="violet">
                    <IconChecklist size={22} />
                  </ThemeIcon>
                  {isLoading && <Loader size="xs" />}
                </Group>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  Dökümanlar
                </Text>
                <Text size="28px" fw={900} c="violet" style={{ lineHeight: 1 }}>
                  {stats?.totalDocuments || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Toplam yükleme
                </Text>
              </Stack>
            </Card>

            {/* Aktif Oran */}
            <Card shadow="md" padding="lg" radius="lg" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <ThemeIcon size={40} radius="md" variant="light" color="orange">
                    <IconTrendingUp size={22} />
                  </ThemeIcon>
                  {isLoading && <Loader size="xs" />}
                </Group>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  Aktif Oran
                </Text>
                <Text size="28px" fw={900} c="orange" style={{ lineHeight: 1 }}>
                  {activePercentage.toFixed(0)}%
                </Text>
                <Progress
                  value={activePercentage}
                  color="orange"
                  size="sm"
                  radius="xl"
                />
              </Stack>
            </Card>
          </SimpleGrid>

          {/* Quick Actions - Enhanced */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="md" padding="xl" radius="lg" withBorder h="100%">
                <Stack h="100%" justify="space-between">
                  <div>
                    <Group mb="md">
                      <ThemeIcon size={40} radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                        <IconList size={24} />
                      </ThemeIcon>
                      <Title order={3}>İhale Listesi</Title>
                    </Group>
                    <Text c="dimmed" mb="md">
                      Tüm ihaleleri görüntüleyin, filtreleyin ve detaylı bilgilere erişin
                    </Text>
                  </div>
                  <Button 
                    size="lg"
                    fullWidth
                    component={Link}
                    href="/tenders"
                    rightSection={<IconRocket size={18} />}
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan' }}
                  >
                    İhaleleri Görüntüle
                  </Button>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="md" padding="xl" radius="lg" withBorder h="100%">
                <Stack h="100%" justify="space-between">
                  <div>
                    <Group mb="md">
                      <ThemeIcon size={40} radius="md" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
                        <IconUpload size={24} />
                      </ThemeIcon>
                      <Title order={3}>Döküman Yükle</Title>
                    </Group>
                    <Text c="dimmed" mb="md">
                      PDF, Word, Excel dökümanlarınızı yükleyin ve AI ile analiz edin
                    </Text>
                  </div>
                  <Button 
                    size="lg"
                    fullWidth
                    component={Link}
                    href="/upload"
                    rightSection={<IconSparkles size={18} />}
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'grape' }}
                  >
                    Yüklemeye Başla
                  </Button>
                </Stack>
              </Card>
            </Grid.Col>

            {/* AI Smart Insights Widget */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <AIDashboardWidget />
            </Grid.Col>
          </Grid>

          {/* Feature Cards */}
          <Card shadow="md" padding="xl" radius="lg" withBorder>
            <Title order={2} mb="xl" ta="center">
              ✨ Özellikler
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
              <Paper p="md" radius="md" withBorder>
                <ThemeIcon size={40} radius="md" variant="light" color="blue" mb="md">
                  <IconBrain size={24} />
                </ThemeIcon>
                <Text fw={600} mb="xs">AI Destekli Analiz</Text>
                <Text size="sm" c="dimmed">
                  Gemini 2.5 Flash ile ihale dökümanlarınızı otomatik analiz edin
                </Text>
              </Paper>

              <Paper p="md" radius="md" withBorder>
                <ThemeIcon size={40} radius="md" variant="light" color="green" mb="md">
                  <IconTrendingUp size={24} />
                </ThemeIcon>
                <Text fw={600} mb="xs">Otomatik Scraping</Text>
                <Text size="sm" c="dimmed">
                  EKAP sisteminden otomatik olarak ihale verilerini çekin
                </Text>
              </Paper>

              <Paper p="md" radius="md" withBorder>
                <ThemeIcon size={40} radius="md" variant="light" color="violet" mb="md">
                  <IconChecklist size={24} />
                </ThemeIcon>
                <Text fw={600} mb="xs">Döküman Yönetimi</Text>
                <Text size="sm" c="dimmed">
                  Tüm ihale dökümanlarınızı tek bir yerde saklayın ve yönetin
                </Text>
              </Paper>
            </SimpleGrid>
          </Card>

          {/* AI Chat Section */}
          <Card shadow="md" padding="xl" radius="lg" withBorder>
            <Title order={2} mb="xl" ta="center">
              🤖 AI Asistan
            </Title>
            <AIChat compact />
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}