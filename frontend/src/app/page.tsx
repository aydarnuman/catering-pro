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
          
          {/* 🌅 Hero Section - Premium Bento Style */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {/* Main Greeting Card */}
            <Box
              style={{
                gridColumn: 'span 2',
                position: 'relative',
                borderRadius: 20,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                minHeight: 180,
              }}
            >
              {/* Animated mesh gradient */}
              <Box
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '60%',
                  height: '100%',
                  background: `
                    radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.4) 0%, transparent 50%),
                    radial-gradient(ellipse at 60% 80%, rgba(168, 85, 247, 0.3) 0%, transparent 50%),
                    radial-gradient(ellipse at 40% 40%, rgba(59, 130, 246, 0.2) 0%, transparent 50%)
                  `,
                  filter: 'blur(40px)',
                  pointerEvents: 'none',
                }}
              />
              
              {/* Grid pattern overlay */}
              <Box
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
                  `,
                  backgroundSize: '32px 32px',
                  pointerEvents: 'none',
                }}
              />
              
              <Box p="xl" style={{ position: 'relative', zIndex: 1 }}>
                <Box>
                  {/* Date badge */}
                  <Box
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      marginBottom: 16,
                    }}
                  >
                    <IconCalendar size={14} color="#818cf8" />
                    <Text size="xs" fw={600} c="#a5b4fc" tt="uppercase" style={{ letterSpacing: 0.5 }}>
                      {formatDate(currentTime)}
                    </Text>
                  </Box>
                  
                  {/* Large greeting */}
                  <Group gap="sm" align="center">
                    <GreetingIcon size={32} color="#fbbf24" />
                    <Text 
                      size="2rem" 
                      fw={800} 
                      style={{ 
                        background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        lineHeight: 1.1,
                      }}
                    >
                      {greeting.text}{isAuthenticated && user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
                    </Text>
                  </Group>
                  
                  {/* Subtitle */}
                  <Text size="sm" c="dimmed" mt="xs">
                    İş akışınızı yönetmeye hazır mısınız?
                  </Text>
                </Box>
                
                {/* Quick action buttons */}
                <Group gap="xs" mt="xl">
                  <Button
                    component={Link}
                    href="/upload"
                    variant="light"
                    color="violet"
                    size="sm"
                    leftSection={<IconUpload size={16} />}
                    radius="md"
                    style={{ 
                      background: 'rgba(139, 92, 246, 0.15)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    Döküman Yükle
                  </Button>
                  <Button
                    component={Link}
                    href="/tenders"
                    variant="light"
                    color="blue"
                    size="sm"
                    leftSection={<IconList size={16} />}
                    radius="md"
                    style={{ 
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    İhaleler
                  </Button>
                  <Button
                    component={Link}
                    href="/muhasebe"
                    variant="light"
                    color="teal"
                    size="sm"
                    leftSection={<IconCash size={16} />}
                    radius="md"
                    style={{ 
                      background: 'rgba(20, 184, 166, 0.15)',
                      border: '1px solid rgba(20, 184, 166, 0.3)',
                    }}
                  >
                    Muhasebe
                  </Button>
                </Group>
              </Box>
            </Box>
            
            {/* Ajanda Card */}
            <Box
              style={{
                position: 'relative',
                borderRadius: 20,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                minHeight: 180,
              }}
            >
              {/* Glow effect */}
              <Box
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 150,
                  height: 150,
                  background: 'radial-gradient(circle, rgba(251, 191, 36, 0.15) 0%, transparent 70%)',
                  filter: 'blur(30px)',
                  pointerEvents: 'none',
                }}
              />
              
              <Box p="lg" style={{ position: 'relative', zIndex: 1, height: '100%' }}>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <IconCalendar size={16} color="#fbbf24" />
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: 1 }}>
                      Bugünün Ajandası
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">{ajandaItems.length} etkinlik</Text>
                </Group>
                
                <ScrollArea h={140} scrollbarSize={4}>
                  <Stack gap="xs">
                    {ajandaItems.map((item, index) => (
                      <Box 
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '8px 10px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: 8,
                          borderLeft: `3px solid var(--mantine-color-${item.color}-6)`,
                        }}
                      >
                        <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: 'monospace', minWidth: 40 }}>
                          {item.time}
                        </Text>
                        <Text size="sm" c="white" lineClamp={1}>{item.title}</Text>
                      </Box>
                    ))}
                  </Stack>
                </ScrollArea>
              </Box>
            </Box>
          </SimpleGrid>

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
