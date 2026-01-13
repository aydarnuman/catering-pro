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
  ScrollArea,
  TextInput,
  Checkbox,
  Transition
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
  IconRefresh,
  IconTrash,
  IconNote,
  IconX
} from '@tabler/icons-react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { StatsResponse } from '@/types/api';
import { AIChat } from '@/components/AIChat';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';

// Types
interface Not {
  id: number;
  content: string;
  is_completed: boolean;
  priority: string;
  color: string;
  due_date: string | null;
  created_at: string;
}

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

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Saat güncelleme
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Stats fetch
  const { data: stats, error, isLoading } = useSWR<StatsResponse>('stats', apiClient.getStats);

  // Notlar fetch
  const { data: notlarData, mutate: mutateNotlar } = useSWR(
    'notlar',
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/notlar?limit=10`);
      return res.json();
    }
  );
  const notlar: Not[] = notlarData?.notlar || [];

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

  // Not ekle
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await fetch(`${API_BASE_URL}/api/notlar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() })
      });
      setNewNote('');
      setIsAddingNote(false);
      mutateNotlar();
    } catch (error) {
      console.error('Not ekleme hatası:', error);
    }
  };

  // Not toggle
  const handleToggleNote = async (id: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/notlar/${id}/toggle`, { method: 'PUT' });
      mutateNotlar();
    } catch (error) {
      console.error('Not toggle hatası:', error);
    }
  };

  // Not sil
  const handleDeleteNote = async (id: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/notlar/${id}`, { method: 'DELETE' });
      mutateNotlar();
    } catch (error) {
      console.error('Not silme hatası:', error);
    }
  };

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
          
          {/* 🌅 Hero Section - Tek Kart */}
          <Box
            style={{
              position: 'relative',
              borderRadius: 24,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Animated mesh gradient */}
            <Box
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '50%',
                height: '100%',
                background: `
                  radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.3) 0%, transparent 50%),
                  radial-gradient(ellipse at 60% 80%, rgba(168, 85, 247, 0.2) 0%, transparent 50%)
                `,
                filter: 'blur(40px)',
                pointerEvents: 'none',
              }}
            />
            
            {/* Grid pattern */}
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
              <Grid gutter="xl">
                {/* Sol: Karşılama */}
                <Grid.Col span={{ base: 12, md: 6 }}>
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
                  
                  {/* Greeting */}
                  <Group gap="sm" align="center">
                    <GreetingIcon size={36} color="#fbbf24" />
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
                  
                  <Text size="sm" c="dimmed" mt="xs" mb="xl">
                    İş akışınızı yönetmeye hazır mısınız?
                  </Text>
                  
                  {/* Quick actions */}
                  <Group gap="xs">
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
                </Grid.Col>
                
                {/* Sağ: Notlarım */}
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Box
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 16,
                      padding: 16,
                      border: '1px solid rgba(255,255,255,0.06)',
                      height: '100%',
                    }}
                  >
                    <Group justify="space-between" mb="sm">
                      <Group gap="xs">
                        <IconNote size={18} color="#fbbf24" />
                        <Text size="sm" fw={600} c="white">Notlarım</Text>
                      </Group>
                      <ActionIcon 
                        variant="subtle" 
                        color="gray" 
                        size="sm"
                        onClick={() => setIsAddingNote(!isAddingNote)}
                      >
                        {isAddingNote ? <IconX size={14} /> : <IconPlus size={14} />}
                      </ActionIcon>
                    </Group>
                    
                    {/* Not ekleme */}
                    <Transition mounted={isAddingNote} transition="slide-down" duration={200}>
                      {(styles) => (
                        <Box style={styles} mb="sm">
                          <TextInput
                            placeholder="Yeni not ekle..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.currentTarget.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                            size="xs"
                            rightSection={
                              <ActionIcon 
                                variant="filled" 
                                color="violet" 
                                size="xs"
                                onClick={handleAddNote}
                                disabled={!newNote.trim()}
                              >
                                <IconPlus size={12} />
                              </ActionIcon>
                            }
                            styles={{
                              input: {
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                              }
                            }}
                          />
                        </Box>
                      )}
                    </Transition>
                    
                    {/* Notlar listesi */}
                    <ScrollArea h={150} scrollbarSize={4}>
                      <Stack gap={6}>
                        {notlar.length === 0 ? (
                          <Text size="xs" c="dimmed" ta="center" py="md">
                            Henüz not yok. + ile ekleyin.
                          </Text>
                        ) : (
                          notlar.map((not) => (
                            <Group
                              key={not.id}
                              gap="xs"
                              p="xs"
                              style={{
                                background: not.is_completed 
                                  ? 'rgba(34, 197, 94, 0.1)' 
                                  : 'rgba(255,255,255,0.02)',
                                borderRadius: 8,
                                borderLeft: `3px solid ${not.is_completed ? '#22c55e' : '#6366f1'}`,
                              }}
                            >
                              <Checkbox
                                checked={not.is_completed}
                                onChange={() => handleToggleNote(not.id)}
                                size="xs"
                                color="green"
                                styles={{
                                  input: {
                                    background: 'rgba(255,255,255,0.1)',
                                    borderColor: 'rgba(255,255,255,0.2)',
                                  }
                                }}
                              />
                              <Text 
                                size="sm" 
                                c={not.is_completed ? 'dimmed' : 'white'}
                                td={not.is_completed ? 'line-through' : undefined}
                                style={{ flex: 1 }}
                                lineClamp={1}
                              >
                                {not.content}
                              </Text>
                              <ActionIcon 
                                variant="subtle" 
                                color="red" 
                                size="xs"
                                onClick={() => handleDeleteNote(not.id)}
                              >
                                <IconTrash size={12} />
                              </ActionIcon>
                            </Group>
                          ))
                        )}
                      </Stack>
                    </ScrollArea>
                  </Box>
                </Grid.Col>
              </Grid>
            </Box>
          </Box>

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

          {/* 📊 Mini İstatistik Kartları */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
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

            {/* AI Analiz */}
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

          {/* 📋 Alt Bölüm: Yaklaşan İhaleler + Piyasa + Hızlı Erişim */}
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

            {/* Hızlı Erişim */}
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
