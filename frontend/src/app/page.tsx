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
  Avatar,
  ActionIcon,
  ScrollArea,
  TextInput,
  Checkbox,
  Transition,
  useMantineColorScheme,
  Skeleton,
  RingProgress,
  Tooltip
} from '@mantine/core';
import { 
  IconUpload, 
  IconList, 
  IconAlertCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconCalendar,
  IconClock,
  IconCash,
  IconPackage,
  IconUsers,
  IconArrowRight,
  IconSun,
  IconMoon,
  IconPlus,
  IconWallet,
  IconReceipt,
  IconRefresh,
  IconTrash,
  IconNote,
  IconX,
  IconFileText,
  IconChartBar,
  IconBuildingBank,
  IconAlertTriangle,
  IconCheck,
  IconActivity
} from '@tabler/icons-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { StatsResponse } from '@/types/api';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';
import { useMediaQuery } from '@mantine/hooks';

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

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  trend?: { value: string; isUp: boolean };
  onClick?: () => void;
  isLoading?: boolean;
}

function KPICard({ title, value, subtitle, icon: Icon, color, gradient, trend, onClick, isLoading }: KPICardProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Paper
      p="md"
      radius="lg"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        background: isDark 
          ? 'rgba(255, 255, 255, 0.03)' 
          : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="kpi-card"
    >
      {/* Gradient accent */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: gradient,
        }}
      />

      <Group justify="space-between" align="flex-start" mb="xs">
        <Box
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 14px ${color}40`,
          }}
        >
          <Icon size={22} color="white" />
        </Box>
        {trend && (
          <Badge 
            size="sm" 
            variant="light" 
            color={trend.isUp ? 'teal' : 'red'}
            leftSection={trend.isUp ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
          >
            {trend.value}
          </Badge>
        )}
      </Group>

      {isLoading ? (
        <Skeleton height={36} width="60%" mt="sm" />
      ) : (
        <Text 
          size="1.75rem" 
          fw={800} 
          mt="sm"
          style={{ 
            color: isDark ? 'white' : '#1a1a2e',
            lineHeight: 1.1,
          }}
        >
          {value}
        </Text>
      )}

      <Text size="xs" tt="uppercase" fw={600} c="dimmed" mt={4} style={{ letterSpacing: 0.5 }}>
        {title}
      </Text>

      {subtitle && (
        <Text size="xs" c="dimmed" mt={2}>
          {subtitle}
        </Text>
      )}
    </Paper>
  );
}

// Quick Action Button
interface QuickActionProps {
  href: string;
  icon: React.ElementType;
  label: string;
  color: string;
  gradient: string;
}

function QuickAction({ href, icon: Icon, label, color, gradient }: QuickActionProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Button
      component={Link}
      href={href}
      variant="light"
      size="md"
      radius="lg"
      leftSection={<Icon size={18} />}
      style={{
        background: isDark ? `${color}15` : `${color}10`,
        border: `1px solid ${color}30`,
        color: isDark ? 'white' : color,
        minWidth: 140,
        transition: 'all 0.2s ease',
      }}
      className="quick-action-btn"
    >
      {label}
    </Button>
  );
}

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
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
      const res = await fetch(`${API_BASE_URL}/api/kasa-banka/ozet`);
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
  const kasaBakiye = finansOzet?.kasa?.toplam || finansOzet?.kasaBakiye || 0;

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
        background: isDark 
          ? 'linear-gradient(180deg, #0a0a0f 0%, #111118 100%)'
          : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        minHeight: '100vh',
        paddingTop: '1rem',
        paddingBottom: '4rem'
      }}
    >
      <Container size="xl">
        <Stack gap="lg">
          
          {/* ========== COMPACT HERO BANNER ========== */}
          <Box
            style={{
              position: 'relative',
              borderRadius: 20,
              overflow: 'hidden',
              background: isDark
                ? 'linear-gradient(135deg, #1e1e2e 0%, #2d1b4e 100%)'
                : 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
              padding: isMobile ? '20px' : '24px 32px',
            }}
          >
            {/* Decorative elements */}
            <Box
              style={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                filter: 'blur(40px)',
              }}
            />
            <Box
              style={{
                position: 'absolute',
                bottom: -30,
                left: '30%',
                width: 150,
                height: 150,
                borderRadius: '50%',
                background: 'rgba(139, 92, 246, 0.3)',
                filter: 'blur(50px)',
              }}
            />

            <Group justify="space-between" align="center" wrap="nowrap">
              <Box style={{ position: 'relative', zIndex: 1 }}>
                {/* Date badge */}
                <Group gap="xs" mb="xs">
                  <IconCalendar size={14} color="rgba(255,255,255,0.7)" />
                  <Text size="xs" c="rgba(255,255,255,0.7)" fw={500}>
                    {formatDate(currentTime)}
                  </Text>
                </Group>
                
                {/* Greeting */}
                <Group gap="sm" align="center">
                  <GreetingIcon size={isMobile ? 24 : 32} color="#fbbf24" />
                  <Text 
                    size={isMobile ? 'xl' : '1.75rem'}
                    fw={800} 
                    c="white"
                    style={{ lineHeight: 1.2 }}
                  >
                    {greeting.text}{isAuthenticated && user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
                  </Text>
                </Group>
                
                {!isMobile && (
                  <Text size="sm" c="rgba(255,255,255,0.6)" mt={4}>
                    İş akışınızı yönetmeye hazır mısınız?
                  </Text>
                )}
              </Box>

              {/* Mini stats on desktop */}
              {!isMobile && !isTablet && (
                <Group gap="lg">
                  <Box ta="center">
                    <Text size="1.5rem" fw={800} c="white">{activeTenders}</Text>
                    <Text size="xs" c="rgba(255,255,255,0.6)">Aktif İhale</Text>
                  </Box>
                  <Box ta="center">
                    <Text size="1.5rem" fw={800} c="white">{notlar.filter(n => !n.is_completed).length}</Text>
                    <Text size="xs" c="rgba(255,255,255,0.6)">Bekleyen Not</Text>
                  </Box>
                </Group>
              )}
            </Group>
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

          {/* ========== KPI CARDS ========== */}
          <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="md">
            {/* Kasa Bakiyesi */}
            <KPICard
              title="Kasa Bakiyesi"
              value={`₺${kasaBakiye.toLocaleString('tr-TR')}`}
              icon={IconWallet}
              color="#10B981"
              gradient="linear-gradient(135deg, #10B981 0%, #059669 100%)"
              trend={{ value: '+₺2.5K', isUp: true }}
              isLoading={isLoading}
            />

            {/* Aktif İhaleler */}
            <KPICard
              title="Aktif İhale"
              value={activeTenders}
              subtitle={`${totalTenders} toplam kayıt`}
              icon={IconFileText}
              color="#3B82F6"
              gradient="linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)"
              isLoading={isLoading}
            />

            {/* Bekleyen Fatura */}
            <KPICard
              title="Bekleyen Fatura"
              value={8}
              subtitle="Bu hafta vadesi dolan"
              icon={IconReceipt}
              color="#F59E0B"
              gradient="linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
            />

            {/* Stok Uyarısı */}
            <KPICard
              title="Stok Uyarısı"
              value={3}
              subtitle="Kritik seviyede"
              icon={IconPackage}
              color="#EF4444"
              gradient="linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
            />
          </SimpleGrid>

          {/* ========== QUICK ACTIONS (Mobile: Horizontal Scroll) ========== */}
          <Box>
            <Text size="sm" fw={600} c="dimmed" mb="sm" tt="uppercase" style={{ letterSpacing: 1 }}>
              Hızlı İşlemler
            </Text>
            <ScrollArea type="never" offsetScrollbars={false}>
              <Group gap="sm" wrap={isMobile ? 'nowrap' : 'wrap'}>
                <QuickAction 
                  href="/upload" 
                  icon={IconUpload} 
                  label="Döküman Yükle" 
                  color="#8B5CF6"
                  gradient="linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)"
                />
                <QuickAction 
                  href="/tenders" 
                  icon={IconList} 
                  label="İhale Listesi" 
                  color="#3B82F6"
                  gradient="linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)"
                />
                <QuickAction 
                  href="/muhasebe/finans" 
                  icon={IconBuildingBank} 
                  label="Finans" 
                  color="#10B981"
                  gradient="linear-gradient(135deg, #10B981 0%, #059669 100%)"
                />
                <QuickAction 
                  href="/muhasebe/cariler" 
                  icon={IconUsers} 
                  label="Cariler" 
                  color="#06B6D4"
                  gradient="linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)"
                />
                <QuickAction 
                  href="/muhasebe/faturalar" 
                  icon={IconReceipt} 
                  label="Faturalar" 
                  color="#F59E0B"
                  gradient="linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                />
              </Group>
            </ScrollArea>
          </Box>

          {/* ========== MAIN CONTENT GRID ========== */}
          <Grid gutter="lg">
            {/* Yaklaşan İhaleler */}
            <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
              <Paper
                p="lg"
                radius="lg"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'white',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  height: '100%',
                }}
              >
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={32} radius="lg" variant="light" color="blue">
                      <IconClock size={18} />
                    </ThemeIcon>
                    <Text fw={700} size="md">Yaklaşan İhaleler</Text>
                  </Group>
                  <Badge size="sm" variant="light" color="blue" radius="md">
                    {yaklasanIhaleler?.length || 0}
                  </Badge>
                </Group>
                
                <Stack gap="xs">
                  {yaklasanIhaleler?.slice(0, 4).map((ihale: any, i: number) => (
                    <Paper 
                      key={i} 
                      p="sm" 
                      radius="md" 
                      style={{ 
                        background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)',
                        border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)'}`,
                      }}
                    >
                      <Text size="sm" fw={600} lineClamp={1}>{ihale.title || 'İhale'}</Text>
                      <Group gap="xs" mt={6}>
                        <Badge size="xs" variant="light" color="gray" radius="sm">{ihale.city || '—'}</Badge>
                        <Text size="xs" c="dimmed">
                          {ihale.tender_date ? new Date(ihale.tender_date).toLocaleDateString('tr-TR') : '—'}
                        </Text>
                      </Group>
                    </Paper>
                  )) || (
                    <Text size="sm" c="dimmed" ta="center" py="xl">Yaklaşan ihale yok</Text>
                  )}
                </Stack>
                
                <Button 
                  component={Link}
                  href="/tenders"
                  variant="light" 
                  color="blue" 
                  fullWidth 
                  mt="md"
                  radius="md"
                  rightSection={<IconArrowRight size={14} />}
                >
                  Tüm İhaleler
                </Button>
              </Paper>
            </Grid.Col>

            {/* Notlarım */}
            <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
              <Paper
                p="lg"
                radius="lg"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'white',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  height: '100%',
                }}
              >
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={32} radius="lg" variant="light" color="violet">
                      <IconNote size={18} />
                    </ThemeIcon>
                    <Text fw={700} size="md">Notlarım</Text>
                  </Group>
                  <ActionIcon 
                    variant="light" 
                    color="violet" 
                    radius="md"
                    onClick={() => setIsAddingNote(!isAddingNote)}
                  >
                    {isAddingNote ? <IconX size={16} /> : <IconPlus size={16} />}
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
                        size="sm"
                        radius="md"
                        rightSection={
                          <ActionIcon 
                            variant="filled" 
                            color="violet" 
                            size="sm"
                            radius="md"
                            onClick={handleAddNote}
                            disabled={!newNote.trim()}
                          >
                            <IconPlus size={14} />
                          </ActionIcon>
                        }
                      />
                    </Box>
                  )}
                </Transition>
                
                {/* Notlar listesi */}
                <ScrollArea h={220} scrollbarSize={4}>
                  <Stack gap={8}>
                    {notlar.length === 0 ? (
                      <Text size="sm" c="dimmed" ta="center" py="xl">
                        Henüz not yok. + ile ekleyin.
                      </Text>
                    ) : (
                      notlar.map((not) => (
                        <Group
                          key={not.id}
                          gap="xs"
                          p="sm"
                          style={{
                            background: not.is_completed 
                              ? (isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.08)')
                              : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                            borderRadius: 10,
                            borderLeft: `3px solid ${not.is_completed ? '#22c55e' : '#8B5CF6'}`,
                            transition: 'all 0.2s ease',
                          }}
                          className="note-item"
                        >
                          <Checkbox
                            checked={not.is_completed}
                            onChange={() => handleToggleNote(not.id)}
                            size="sm"
                            color="green"
                            radius="md"
                          />
                          <Text 
                            size="sm" 
                            c={not.is_completed ? 'dimmed' : undefined}
                            td={not.is_completed ? 'line-through' : undefined}
                            style={{ flex: 1 }}
                            lineClamp={1}
                          >
                            {not.content}
                          </Text>
                          <ActionIcon 
                            variant="subtle" 
                            color="red" 
                            size="sm"
                            radius="md"
                            onClick={() => handleDeleteNote(not.id)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      ))
                    )}
                  </Stack>
                </ScrollArea>
              </Paper>
            </Grid.Col>

            {/* Aktivite & Durum */}
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Paper
                p="lg"
                radius="lg"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'white',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  height: '100%',
                }}
              >
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={32} radius="lg" variant="light" color="teal">
                      <IconActivity size={18} />
                    </ThemeIcon>
                    <Text fw={700} size="md">Sistem Durumu</Text>
                  </Group>
                  <Badge size="sm" variant="dot" color="green" radius="md">
                    Aktif
                  </Badge>
                </Group>

                <Stack gap="md">
                  {/* AI Status */}
                  <Paper
                    p="sm"
                    radius="md"
                    style={{
                      background: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)'}`,
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Box
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#22c55e',
                            boxShadow: '0 0 8px #22c55e',
                          }}
                        />
                        <Text size="sm" fw={500}>AI Analiz</Text>
                      </Group>
                      <Text size="sm" fw={700} c="violet">{stats?.aiAnalysisCount || 0}</Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>Gemini API bağlantısı aktif</Text>
                  </Paper>

                  {/* Database Status */}
                  <Paper
                    p="sm"
                    radius="md"
                    style={{
                      background: isDark ? 'rgba(20, 184, 166, 0.1)' : 'rgba(20, 184, 166, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(20, 184, 166, 0.2)' : 'rgba(20, 184, 166, 0.1)'}`,
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Box
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#22c55e',
                            boxShadow: '0 0 8px #22c55e',
                          }}
                        />
                        <Text size="sm" fw={500}>Veritabanı</Text>
                      </Group>
                      <Text size="sm" fw={700} c="teal">Supabase</Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>PostgreSQL bağlantısı aktif</Text>
                  </Paper>

                  {/* Quick Stats */}
                  <SimpleGrid cols={2} spacing="xs">
                    <Paper
                      p="sm"
                      radius="md"
                      ta="center"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <Text size="xl" fw={800} c="blue">{totalTenders}</Text>
                      <Text size="xs" c="dimmed">Toplam İhale</Text>
                    </Paper>
                    <Paper
                      p="sm"
                      radius="md"
                      ta="center"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <Text size="xl" fw={800} c="teal">{notlar.filter(n => n.is_completed).length}</Text>
                      <Text size="xs" c="dimmed">Tamamlanan</Text>
                    </Paper>
                  </SimpleGrid>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>

        </Stack>
      </Container>
    </Box>
  );
}
