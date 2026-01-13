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
  Avatar,
  Divider,
  ActionIcon,
  Tooltip,
  Timeline,
  ScrollArea
} from '@mantine/core';
import { 
  IconUpload, 
  IconList, 
  IconFileText,
  IconBrain,
  IconAlertCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconChecklist,
  IconSparkles,
  IconRocket,
  IconCalendar,
  IconClock,
  IconCash,
  IconPackage,
  IconUsers,
  IconChefHat,
  IconTruck,
  IconBell,
  IconArrowRight,
  IconSun,
  IconMoon,
  IconCloudRain,
  IconPlus,
  IconDots,
  IconWallet,
  IconReceipt,
  IconChartLine,
  IconRefresh
} from '@tabler/icons-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { StatsResponse } from '@/types/api';
import { AIChat } from '@/components/AIChat';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';

// Saate göre selamlama
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return { text: 'İyi geceler', icon: IconMoon, color: 'indigo' };
  if (hour < 12) return { text: 'Günaydın', icon: IconSun, color: 'orange' };
  if (hour < 18) return { text: 'İyi günler', icon: IconSun, color: 'yellow' };
  if (hour < 22) return { text: 'İyi akşamlar', icon: IconMoon, color: 'violet' };
  return { text: 'İyi geceler', icon: IconMoon, color: 'indigo' };
};

// Tarih formatla
const formatDate = (date: Date) => {
  return date.toLocaleDateString('tr-TR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  });
};

// Saat formatla
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Saat güncelleme
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Stats fetch
  const { data: stats, error, isLoading } = useSWR<StatsResponse>('stats', apiClient.getStats);

  // Finans özeti fetch
  const { data: finansOzet } = useSWR(
    isAuthenticated ? 'finans-ozet' : null,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/finans/ozet`);
      return res.json();
    }
  );

  // Yaklaşan ihaleler
  const { data: yaklasanIhaleler } = useSWR(
    'yaklasan-ihaleler',
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/tenders?limit=5&sort=tender_date&order=asc`);
      const data = await res.json();
      return data.tenders?.slice(0, 5) || [];
    }
  );

  const totalTenders = stats?.totalTenders || 0;
  const activeTenders = stats?.activeTenders || 0;

  // Demo ajanda verileri (gerçek API'den çekilebilir)
  const ajandaItems = [
    { time: '09:00', title: 'Ankara İhalesi Toplantısı', type: 'meeting', color: 'blue' },
    { time: '11:30', title: 'Malzeme Teslimatı - Proje A', type: 'delivery', color: 'green' },
    { time: '14:00', title: 'Menü Planlama', type: 'task', color: 'violet' },
    { time: '16:00', title: 'Tedarikçi Görüşmesi', type: 'meeting', color: 'orange' },
  ];

  return (
    <Box
      style={{
        background: 'linear-gradient(135deg, rgba(34,139,230,0.03) 0%, rgba(139,92,246,0.03) 100%)',
        minHeight: '100vh',
        paddingTop: '1rem',
        paddingBottom: '4rem'
      }}
    >
      <Container size="xl">
        <Stack gap="lg">
          
          {/* 🌅 Hero Section - Dinamik Karşılama */}
          <Paper
            p="xl"
            radius="xl"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Dekoratif arka plan */}
            <Box
              style={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none'
              }}
            />
            
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Box>
                <Group gap="sm" mb="xs">
                  <ThemeIcon size={32} radius="xl" variant="light" color={greeting.color}>
                    <GreetingIcon size={18} />
                  </ThemeIcon>
                  <Text size="xl" fw={700} c={greeting.color}>
                    {greeting.text}{isAuthenticated && user?.ad ? `, ${user.ad}!` : '!'}
                  </Text>
                </Group>
                
                <Text size="sm" c="dimmed" mb="md">
                  📅 {formatDate(currentTime)} • 🕐 {formatTime(currentTime)}
                </Text>
                
                {/* Günün Özeti */}
                <Group gap="lg" wrap="wrap">
                  <Group gap={6}>
                    <IconFileText size={16} color="var(--mantine-color-blue-6)" />
                    <Text size="sm" fw={500}>{activeTenders} aktif ihale</Text>
                  </Group>
                  <Group gap={6}>
                    <IconBrain size={16} color="var(--mantine-color-green-6)" />
                    <Text size="sm" fw={500}>{stats?.aiAnalysisCount || 0} AI analiz</Text>
                  </Group>
                  <Group gap={6}>
                    <IconChecklist size={16} color="var(--mantine-color-violet-6)" />
                    <Text size="sm" fw={500}>{stats?.totalDocuments || 0} döküman</Text>
                  </Group>
                </Group>
              </Box>
              
              {/* Hızlı Aksiyonlar */}
              <Group gap="xs">
                <Tooltip label="Döküman Yükle">
                  <ActionIcon 
                    component={Link} 
                    href="/upload" 
                    size="lg" 
                    variant="light" 
                    color="violet"
                    radius="xl"
                  >
                    <IconUpload size={18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="İhalelere Git">
                  <ActionIcon 
                    component={Link} 
                    href="/tenders" 
                    size="lg" 
                    variant="light" 
                    color="blue"
                    radius="xl"
                  >
                    <IconList size={18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Muhasebe">
                  <ActionIcon 
                    component={Link} 
                    href="/muhasebe" 
                    size="lg" 
                    variant="light" 
                    color="green"
                    radius="xl"
                  >
                    <IconCash size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Paper>

          {/* Error Alert */}
          {error && (
            <Alert 
              icon={<IconAlertCircle size={16} />} 
              title="Bağlantı Hatası" 
              color="red"
              variant="light"
              radius="lg"
            >
              Backend sunucusuna bağlanılamıyor.
            </Alert>
          )}

          {/* 📅 Ajanda + Hızlı İstatistikler */}
          <Grid gutter="lg">
            {/* Sol: Bugünün Ajandası */}
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Card shadow="sm" padding="lg" radius="lg" withBorder h="100%">
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={28} radius="md" variant="light" color="blue">
                      <IconCalendar size={16} />
                    </ThemeIcon>
                    <Text fw={600}>Bugünün Ajandası</Text>
                  </Group>
                  <ActionIcon variant="subtle" color="gray" size="sm">
                    <IconPlus size={14} />
                  </ActionIcon>
                </Group>
                
                <ScrollArea h={220} offsetScrollbars>
                  <Timeline active={1} bulletSize={24} lineWidth={2}>
                    {ajandaItems.map((item, index) => (
                      <Timeline.Item
                        key={index}
                        bullet={
                          <ThemeIcon size={24} radius="xl" color={item.color} variant="filled">
                            {item.type === 'meeting' ? <IconUsers size={12} /> : 
                             item.type === 'delivery' ? <IconTruck size={12} /> : 
                             <IconChecklist size={12} />}
                          </ThemeIcon>
                        }
                        title={
                          <Group gap="xs">
                            <Badge size="xs" variant="light" color={item.color}>{item.time}</Badge>
                            <Text size="sm" fw={500}>{item.title}</Text>
                          </Group>
                        }
                      />
                    ))}
                  </Timeline>
                </ScrollArea>
                
                <Divider my="sm" />
                <Button 
                  variant="subtle" 
                  color="blue" 
                  fullWidth 
                  size="xs"
                  rightSection={<IconArrowRight size={14} />}
                >
                  Tüm Programı Gör
                </Button>
              </Card>
            </Grid.Col>
            
            {/* Sağ: Mini İstatistik Kartları */}
            <Grid.Col span={{ base: 12, md: 7 }}>
              <SimpleGrid cols={{ base: 2, sm: 2 }} spacing="md">
                {/* Kasa Bakiyesi */}
                <Card shadow="sm" padding="md" radius="lg" withBorder>
                  <Group justify="space-between" mb="xs">
                    <ThemeIcon size={32} radius="md" variant="light" color="green">
                      <IconWallet size={18} />
                    </ThemeIcon>
                    {isLoading && <Loader size="xs" />}
                  </Group>
                  <Text size="xs" tt="uppercase" fw={600} c="dimmed">Kasa Bakiyesi</Text>
                  <Text size="xl" fw={800} c="green" mt={4}>
                    ₺{finansOzet?.kasaBakiye?.toLocaleString('tr-TR') || '—'}
                  </Text>
                  <Group gap={4} mt="xs">
                    <IconTrendingUp size={12} color="var(--mantine-color-teal-6)" />
                    <Text size="xs" c="teal">+₺2.5K bugün</Text>
                  </Group>
                </Card>

                {/* Aktif İhaleler */}
                <Card shadow="sm" padding="md" radius="lg" withBorder>
                  <Group justify="space-between" mb="xs">
                    <ThemeIcon size={32} radius="md" variant="light" color="blue">
                      <IconFileText size={18} />
                    </ThemeIcon>
                  </Group>
                  <Text size="xs" tt="uppercase" fw={600} c="dimmed">Aktif İhale</Text>
                  <Text size="xl" fw={800} c="blue" mt={4}>{activeTenders}</Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    {totalTenders} toplam kayıt
                  </Text>
                </Card>

                {/* Bekleyen Analiz */}
                <Card shadow="sm" padding="md" radius="lg" withBorder>
                  <Group justify="space-between" mb="xs">
                    <ThemeIcon size={32} radius="md" variant="light" color="violet">
                      <IconBrain size={18} />
                    </ThemeIcon>
                  </Group>
                  <Text size="xs" tt="uppercase" fw={600} c="dimmed">AI Analiz</Text>
                  <Text size="xl" fw={800} c="violet" mt={4}>{stats?.aiAnalysisCount || 0}</Text>
                  <Badge size="xs" variant="dot" color="green" mt="xs">Gemini Aktif</Badge>
                </Card>

                {/* Stok Uyarısı */}
                <Card shadow="sm" padding="md" radius="lg" withBorder>
                  <Group justify="space-between" mb="xs">
                    <ThemeIcon size={32} radius="md" variant="light" color="orange">
                      <IconPackage size={18} />
                    </ThemeIcon>
                  </Group>
                  <Text size="xs" tt="uppercase" fw={600} c="dimmed">Stok Uyarısı</Text>
                  <Text size="xl" fw={800} c="orange" mt={4}>3</Text>
                  <Text size="xs" c="orange" mt="xs">Kritik seviye</Text>
                </Card>
              </SimpleGrid>
            </Grid.Col>
          </Grid>

          {/* 📋 Alt Bölüm: Yaklaşan İhaleler + Piyasa + Son Aktivite */}
          <Grid gutter="lg">
            {/* Yaklaşan İhaleler */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" padding="lg" radius="lg" withBorder h="100%">
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={28} radius="md" variant="light" color="blue">
                      <IconClock size={16} />
                    </ThemeIcon>
                    <Text fw={600}>Yaklaşan İhaleler</Text>
                  </Group>
                  <Badge size="sm" variant="light" color="blue">{yaklasanIhaleler?.length || 0}</Badge>
                </Group>
                
                <Stack gap="xs">
                  {yaklasanIhaleler?.slice(0, 4).map((ihale: any, i: number) => (
                    <Paper key={i} p="sm" radius="md" withBorder style={{ background: 'rgba(59,130,246,0.03)' }}>
                      <Text size="sm" fw={500} lineClamp={1}>{ihale.title || 'İhale'}</Text>
                      <Group gap="xs" mt={4}>
                        <Badge size="xs" variant="light" color="gray">{ihale.city || '—'}</Badge>
                        <Text size="xs" c="dimmed">
                          {ihale.tender_date ? new Date(ihale.tender_date).toLocaleDateString('tr-TR') : '—'}
                        </Text>
                      </Group>
                    </Paper>
                  )) || (
                    <Text size="sm" c="dimmed" ta="center" py="md">Yaklaşan ihale yok</Text>
                  )}
                </Stack>
                
                <Button 
                  component={Link}
                  href="/tenders"
                  variant="light" 
                  color="blue" 
                  fullWidth 
                  mt="md"
                  size="sm"
                  rightSection={<IconArrowRight size={14} />}
                >
                  Tüm İhaleler
                </Button>
              </Card>
            </Grid.Col>

            {/* Piyasa Özeti */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" padding="lg" radius="lg" withBorder h="100%">
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={28} radius="md" variant="light" color="teal">
                      <IconChartLine size={16} />
                    </ThemeIcon>
                    <Text fw={600}>Piyasa Fiyatları</Text>
                  </Group>
                  <ActionIcon variant="subtle" color="gray" size="sm">
                    <IconRefresh size={14} />
                  </ActionIcon>
                </Group>
                
                <Stack gap="xs">
                  {[
                    { urun: 'Pirinç Baldo', fiyat: '₺82/kg', degisim: '+3%', up: true },
                    { urun: 'Tavuk But', fiyat: '₺145/kg', degisim: '-2%', up: false },
                    { urun: 'Ayçiçek Yağı', fiyat: '₺85/L', degisim: '+1%', up: true },
                    { urun: 'Domates', fiyat: '₺35/kg', degisim: '-5%', up: false },
                  ].map((item, i) => (
                    <Group key={i} justify="space-between" p="xs" style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                      <Text size="sm" fw={500}>{item.urun}</Text>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>{item.fiyat}</Text>
                        <Badge 
                          size="xs" 
                          variant="light" 
                          color={item.up ? 'red' : 'green'}
                          leftSection={item.up ? <IconTrendingUp size={10} /> : <IconTrendingDown size={10} />}
                        >
                          {item.degisim}
                        </Badge>
                      </Group>
                    </Group>
                  ))}
                </Stack>
                
                <Button 
                  component={Link}
                  href="/planlama/piyasa-robotu"
                  variant="light" 
                  color="teal" 
                  fullWidth 
                  mt="md"
                  size="sm"
                  rightSection={<IconArrowRight size={14} />}
                >
                  Piyasa Robotu
                </Button>
              </Card>
            </Grid.Col>

            {/* Hızlı Aksiyonlar */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" padding="lg" radius="lg" withBorder h="100%">
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={28} radius="md" variant="light" color="violet">
                      <IconRocket size={16} />
                    </ThemeIcon>
                    <Text fw={600}>Hızlı Erişim</Text>
                  </Group>
                </Group>
                
                <Stack gap="sm">
                  <Button 
                    component={Link}
                    href="/upload"
                    variant="light" 
                    color="violet" 
                    fullWidth
                    leftSection={<IconUpload size={16} />}
                    justify="flex-start"
                  >
                    Döküman Yükle
                  </Button>
                  <Button 
                    component={Link}
                    href="/muhasebe/cariler"
                    variant="light" 
                    color="blue" 
                    fullWidth
                    leftSection={<IconUsers size={16} />}
                    justify="flex-start"
                  >
                    Cari Hesaplar
                  </Button>
                  <Button 
                    component={Link}
                    href="/muhasebe/personel"
                    variant="light" 
                    color="orange" 
                    fullWidth
                    leftSection={<IconChefHat size={16} />}
                    justify="flex-start"
                  >
                    Personel Yönetimi
                  </Button>
                  <Button 
                    component={Link}
                    href="/muhasebe/faturalar"
                    variant="light" 
                    color="green" 
                    fullWidth
                    leftSection={<IconReceipt size={16} />}
                    justify="flex-start"
                  >
                    Faturalar
                  </Button>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>

        </Stack>
      </Container>
    </Box>
  );
}
