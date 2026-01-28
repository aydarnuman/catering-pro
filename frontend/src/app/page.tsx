'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Container,
  Grid,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconArrowRight,
  IconBuildingBank,
  IconCalendar,
  IconClock,
  IconFileText,
  IconList,
  IconMoon,
  IconNote,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconSun,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
  IconUpload,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { EmptyState, LoadingState, showError } from '@/components/common';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { apiClient, authFetch } from '@/lib/api';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import { API_BASE_URL } from '@/lib/config';
import { formatDate } from '@/lib/formatters';
import type { StatsResponse } from '@/types/api';

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

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  gradient,
  trend,
  onClick,
  isLoading,
}: KPICardProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Paper
      p="md"
      radius="lg"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.8)',
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
        <LoadingState loading={true} variant="skeleton" skeletonHeight={36} skeletonLines={1} />
      ) : (
        <Text
          size="1.75rem"
          fw={800}
          mt="sm"
          style={{
            color: isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-9)',
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
        minWidth: 'min(140px, 42vw)',
        transition: 'all 0.2s ease',
      }}
      className="quick-action-btn"
    >
      {label}
    </Button>
  );
}

export default function HomePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  const [currentTime, setCurrentTime] = useState(new Date());
  const [newNote, setNewNote] = useState('');
  const [aiTip, setAiTip] = useState<string>('');
  const [_aiTipIndex, setAiTipIndex] = useState(0);
  const [notesModalOpened, { open: openNotesModal, close: closeNotesModal }] = useDisclosure(false);
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // AI önerileri - döngüsel
  const aiTips = [
    '💡 Bu hafta 3 ihale son başvuru tarihine yaklaşıyor. Takip listesini kontrol edin.',
    '📊 Geçen aya göre alış faturalarında %12 artış var. Maliyet analizi yapmanızı öneririm.',
    '🎯 En çok kazandığınız kategori: Okul yemekhaneleri. Bu alana odaklanabilirsiniz.',
    '⚡ 5 adet stok kalemi kritik seviyede. Tedarik siparişi oluşturmayı unutmayın.',
    "📈 Son 30 günde 8 yeni ihale eklendi. Fırsat analizi için AI Uzmanı'nı kullanın.",
    '💰 Vadesi geçmiş 2 fatura bulunuyor. Tahsilat takibi yapmanızı öneririm.',
    '🔔 Yarın için planlanmış 1 ihale toplantısı var. Dökümanları hazırladınız mı?',
    '✨ Yeni özellik: Döküman analizi artık daha hızlı! İhale detayından deneyin.',
  ];

  // Saat güncelleme
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // AI öneri döngüsü
  useEffect(() => {
    setAiTip(aiTips[0]);
    const tipTimer = setInterval(() => {
      setAiTipIndex((prev) => {
        const next = (prev + 1) % aiTips.length;
        setAiTip(aiTips[next]);
        return next;
      });
    }, 8000); // Her 8 saniyede değiş
    return () => clearInterval(tipTimer);
  }, []);

  // Stats fetch - Auth olmadan da çalışır
  const SWR_OPTS = { dedupingInterval: 5000 }; // Aynı key ile 5 sn içinde tekrar istek atma
  const {
    data: stats,
    error,
    isLoading,
    mutate: mutateStats,
  } = useSWR<StatsResponse>('stats', apiClient.getStats, SWR_OPTS);

  // Notlar fetch - Auth olmadan da çalışır (token varsa kullanır)
  const { data: notlarData, mutate: mutateNotlar } = useSWR(
    'notlar',
    async () => {
      const res = await authFetch(`${API_BASE_URL}/api/notlar?limit=10`);
      return res.json();
    },
    SWR_OPTS
  );
  const notlar: Not[] = notlarData?.notlar || [];

  // Finans özeti fetch - Auth olmadan da çalışır
  const { data: finansOzet, mutate: mutateFinans } = useSWR(
    'finans-ozet',
    () => muhasebeAPI.getKasaBankaOzet(),
    SWR_OPTS
  );

  // Yaklaşan ihaleler - Auth olmadan da çalışır
  const { data: yaklasanIhaleler, mutate: mutateYaklasanIhaleler } = useSWR(
    'yaklasan-ihaleler',
    async () => {
      const { tendersAPI } = await import('@/lib/api/services/tenders');
      const data = await tendersAPI.getTenders({ limit: 5, status: 'active' });
      return data.tenders?.slice(0, 5) || [];
    },
    SWR_OPTS
  );

  // 🔴 REALTIME - Ana sayfa için tüm tabloları dinle
  const refetchDashboard = useCallback(() => {
    mutateStats();
    mutateNotlar();
    mutateFinans();
    mutateYaklasanIhaleler();
  }, [mutateStats, mutateNotlar, mutateFinans, mutateYaklasanIhaleler]);

  useRealtimeRefetch(['invoices', 'tenders', 'stok', 'notifications'], refetchDashboard);

  const totalTenders = stats?.totalTenders || 0;
  const activeTenders = stats?.activeTenders || 0;
  const kasaBakiye = (finansOzet as any)?.kasa?.toplam || (finansOzet as any)?.kasaBakiye || 0;

  // Not ekle
  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      await authFetch(`${API_BASE_URL}/api/notlar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      setNewNote('');
      mutateNotlar();
    } catch (error) {
      showError(error, { title: 'Not Ekleme Hatası' });
    }
  };

  // Not toggle
  const handleToggleNote = async (id: number) => {
    try {
      await authFetch(`${API_BASE_URL}/api/notlar/${id}/toggle`, { method: 'PUT' });
      mutateNotlar();
    } catch (error) {
      showError(error, { title: 'Not Güncelleme Hatası' });
    }
  };

  // Not sil
  const handleDeleteNote = async (id: number) => {
    try {
      await authFetch(`${API_BASE_URL}/api/notlar/${id}`, { method: 'DELETE' });
      mutateNotlar();
    } catch (error) {
      showError(error, { title: 'Not Silme Hatası' });
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
        paddingBottom: '4rem',
      }}
    >
      <Container size="xl">
        <Stack gap="lg">
          {/* ========== DARK HERO BANNER WITH AI ========== */}
          <Box
            style={{
              position: 'relative',
              borderRadius: 20,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
              padding: isMobile ? '20px' : '28px 32px',
            }}
          >
            {/* Decorative elements */}
            <Box
              style={{
                position: 'absolute',
                top: -80,
                right: -80,
                width: 250,
                height: 250,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
            <Box
              style={{
                position: 'absolute',
                bottom: -60,
                left: '20%',
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
                filter: 'blur(50px)',
              }}
            />
            <Box
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 400,
                height: 400,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 60%)',
                filter: 'blur(60px)',
              }}
            />

            {/* Grid layout for 3 columns */}
            <Group
              justify="space-between"
              align="center"
              wrap={isMobile ? 'wrap' : 'nowrap'}
              style={{ position: 'relative', zIndex: 1 }}
            >
              {/* Sol: Tarih ve Selamlama */}
              <Box style={{ flex: '0 0 auto' }}>
                <Group gap="xs" mb="xs">
                  <IconCalendar size={14} color="rgba(255,255,255,0.6)" />
                  <Text size="xs" c="rgba(255,255,255,0.6)" fw={500}>
                    {formatDate(currentTime, 'long')}
                  </Text>
                </Group>

                <Group gap="sm" align="center">
                  <GreetingIcon size={isMobile ? 24 : 28} color="#fbbf24" />
                  <Text
                    size={isMobile ? 'lg' : 'xl'}
                    fw={700}
                    c="white"
                    style={{ lineHeight: 1.2 }}
                  >
                    {greeting.text}
                    {isAuthenticated && user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
                  </Text>
                </Group>
              </Box>

              {/* Orta: AI Önerileri */}
              {!isMobile && (
                <Box
                  style={{
                    flex: '1 1 auto',
                    maxWidth: 550,
                    margin: '0 32px',
                  }}
                >
                  <Paper
                    px="md"
                    py="xs"
                    radius="xl"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <Text
                      size="sm"
                      c="rgba(255,255,255,0.85)"
                      ta="center"
                      style={{
                        lineHeight: 1.5,
                        transition: 'opacity 0.3s ease',
                      }}
                    >
                      {aiTip}
                    </Text>
                  </Paper>
                </Box>
              )}

              {/* Sağ: Mini Stats + Notes Button */}
              {!isMobile && !isTablet && (
                <Group gap="xl" style={{ flex: '0 0 auto' }}>
                  <Box ta="center">
                    <Text size="1.75rem" fw={800} c="white" style={{ lineHeight: 1 }}>
                      {activeTenders}
                    </Text>
                    <Text size="xs" c="rgba(255,255,255,0.5)" mt={4}>
                      Aktif İhale
                    </Text>
                  </Box>
                  <Box
                    style={{
                      width: 1,
                      height: 40,
                      background: 'rgba(255,255,255,0.15)',
                    }}
                  />
                  <Box ta="center">
                    <Text size="1.75rem" fw={800} c="white" style={{ lineHeight: 1 }}>
                      {notlar.filter((n) => !n.is_completed).length}
                    </Text>
                    <Text size="xs" c="rgba(255,255,255,0.5)" mt={4}>
                      Bekleyen Not
                    </Text>
                  </Box>
                  <Box
                    style={{
                      width: 1,
                      height: 40,
                      background: 'rgba(255,255,255,0.15)',
                    }}
                  />
                  <Tooltip label="Notlarım" position="bottom" withArrow>
                    <ActionIcon
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'purple', deg: 135 }}
                      size="xl"
                      radius="xl"
                      onClick={openNotesModal}
                      style={{
                        boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <IconNote size={22} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )}

              {/* Mobile/Tablet: Notes Button */}
              {(isMobile || isTablet) && (
                <Tooltip label="Notlarım" position="bottom" withArrow>
                  <ActionIcon
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'purple', deg: 135 }}
                    size="lg"
                    radius="xl"
                    onClick={openNotesModal}
                    style={{
                      boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
                    }}
                  >
                    <IconNote size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>

            {/* Mobile: AI öneri alt satırda */}
            {isMobile && (
              <Paper
                p="xs"
                radius="md"
                mt="md"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text size="xs" c="white" lineClamp={2}>
                  {aiTip}
                </Text>
              </Paper>
            )}
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
            <Grid.Col span={12}>
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
                    <Text fw={700} size="md">
                      Yaklaşan İhaleler
                    </Text>
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
                      <Text size="sm" fw={600} lineClamp={1}>
                        {ihale.title || 'İhale'}
                      </Text>
                      <Group gap="xs" mt={6}>
                        <Badge size="xs" variant="light" color="gray" radius="sm">
                          {ihale.city || '—'}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {ihale.tender_date
                            ? new Date(ihale.tender_date).toLocaleDateString('tr-TR')
                            : '—'}
                        </Text>
                      </Group>
                    </Paper>
                  )) || (
                    <Text size="sm" c="dimmed" ta="center" py="xl">
                      Yaklaşan ihale yok
                    </Text>
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
          </Grid>
        </Stack>
      </Container>

      {/* ========== NOTES MODAL ========== */}
      <Modal
        opened={notesModalOpened}
        onClose={closeNotesModal}
        title={
          <Group gap="sm">
            <ThemeIcon
              size={32}
              radius="lg"
              variant="gradient"
              gradient={{ from: 'violet', to: 'purple' }}
            >
              <IconNote size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="lg">
                Notlarım
              </Text>
              <Text size="xs" c="dimmed">
                Yapışkan notlar ve hatırlatıcılar
              </Text>
            </Box>
          </Group>
        }
        size="lg"
        radius="xl"
        padding="xl"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          header: {
            paddingBottom: 16,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          },
          content: {
            background: isDark ? '#1a1b26' : 'white',
          },
        }}
      >
        <Stack gap="md" pt="sm">
          {/* Not ekleme formu */}
          <Paper
            p="md"
            radius="lg"
            style={{
              background: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
              border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'}`,
            }}
          >
            <TextInput
              placeholder="Yeni not ekle... (Enter ile kaydet)"
              value={newNote}
              onChange={(e) => setNewNote(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              size="md"
              radius="lg"
              leftSection={<IconPlus size={16} color="#8B5CF6" />}
              rightSection={
                <ActionIcon
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'purple' }}
                  size="md"
                  radius="lg"
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                >
                  <IconPlus size={16} />
                </ActionIcon>
              }
              styles={{
                input: {
                  background: isDark ? 'rgba(0,0,0,0.3)' : 'white',
                  border: 'none',
                  '&:focus': {
                    borderColor: '#8B5CF6',
                  },
                },
              }}
            />
          </Paper>

          {/* Stats */}
          <Group justify="space-between">
            <Group gap="xl">
              <Box>
                <Text size="xl" fw={800} c="violet">
                  {notlar.filter((n) => !n.is_completed).length}
                </Text>
                <Text size="xs" c="dimmed">
                  Bekleyen
                </Text>
              </Box>
              <Box>
                <Text size="xl" fw={800} c="teal">
                  {notlar.filter((n) => n.is_completed).length}
                </Text>
                <Text size="xs" c="dimmed">
                  Tamamlanan
                </Text>
              </Box>
            </Group>
            <Badge size="lg" variant="light" color="violet" radius="md">
              Toplam: {notlar.length}
            </Badge>
          </Group>

          {/* Notlar listesi */}
          <ScrollArea h={350} scrollbarSize={6} offsetScrollbars>
            <Stack gap="xs">
              {notlar.length === 0 ? (
                <EmptyState
                  title="Henüz not yok"
                  description="Yukarıdaki alana yazarak ilk notunuzu ekleyin"
                  icon={<IconNote size={48} />}
                  iconColor="violet"
                />
              ) : (
                notlar.map((not) => (
                  <Paper
                    key={not.id}
                    p="md"
                    radius="lg"
                    style={{
                      background: not.is_completed
                        ? isDark
                          ? 'rgba(34, 197, 94, 0.1)'
                          : 'rgba(34, 197, 94, 0.08)'
                        : isDark
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(0,0,0,0.02)',
                      borderLeft: `4px solid ${not.is_completed ? '#22c55e' : '#8B5CF6'}`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Group justify="space-between" wrap="wrap">
                      <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                        <Checkbox
                          checked={not.is_completed}
                          onChange={() => handleToggleNote(not.id)}
                          size="md"
                          color="green"
                          radius="xl"
                          styles={{
                            input: {
                              cursor: 'pointer',
                            },
                          }}
                        />
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            size="sm"
                            fw={500}
                            c={not.is_completed ? 'dimmed' : undefined}
                            td={not.is_completed ? 'line-through' : undefined}
                            lineClamp={2}
                          >
                            {not.content}
                          </Text>
                          <Text size="xs" c="dimmed" mt={4}>
                            {new Date(not.created_at).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </Box>
                      </Group>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="md"
                        radius="lg"
                        onClick={() => handleDeleteNote(not.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </Modal>
    </Box>
  );
}
