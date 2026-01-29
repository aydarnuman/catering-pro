'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
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
  IconReceipt,
  IconSun,
  IconTrendingDown,
  IconTrendingUp,
  IconUpload,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { LoadingState } from '@/components/common';
import { UnifiedNotesModal } from '@/components/notes';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { useNotes } from '@/hooks/useNotes';
import { apiClient } from '@/lib/api';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import { formatDate } from '@/lib/formatters';
import type { StatsResponse } from '@/types/api';

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
  return (
    <Paper
      p="md"
      radius="lg"
      onClick={onClick}
      className="glassy-card kpi-card"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
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
          borderRadius: '16px 16px 0 0',
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
}

function QuickAction({ href, icon: Icon, label, color }: QuickActionProps) {
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

function HomePageContent() {
  const { user, isAuthenticated } = useAuth();
  const { colorScheme } = useMantineColorScheme();
  const _isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiTip, setAiTip] = useState<string>('');
  const [_aiTipIndex, setAiTipIndex] = useState(0);
  const [aiTipOpacity, setAiTipOpacity] = useState(1);
  const aiTipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notesModalOpened, { open: openNotesModal, close: closeNotesModal }] = useDisclosure(false);
  const searchParams = useSearchParams();

  // Toolbar "Hızlı Not" tıklanınca notlar modalını aç
  useEffect(() => {
    const handler = () => openNotesModal();
    window.addEventListener('open-notes-modal', handler);
    return () => window.removeEventListener('open-notes-modal', handler);
  }, [openNotesModal]);

  // Ana sayfaya ?openNotes=1 ile gelindiyse notlar modalını aç
  useEffect(() => {
    if (searchParams?.get('openNotes') === '1') openNotesModal();
  }, [searchParams, openNotesModal]);

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // AI önerileri - tek satır, sabit boyut (layout shift önlenir)
  const aiTips = [
    '💡 3 ihale son başvuruya yaklaşıyor — takip listesini kontrol edin.',
    '📊 Alış faturalarında %12 artış. Maliyet analizi yapmanızı öneririz.',
    '🎯 En kazançlı kategori: okul yemekhaneleri. Bu alana odaklanın.',
    '⚡ 5 stok kalemi kritik seviyede. Tedarik siparişi oluşturmayı unutmayın.',
    '📈 Son 30 günde 8 yeni ihale. Asistanı açıp fırsat analizi yapın.',
    '💰 Vadesi geçmiş 2 fatura var. Tahsilat takibini yapın.',
    '🔔 Yarın 1 ihale toplantısı planlı. Dökümanları hazırlayın.',
    '✨ Döküman analizi artık daha hızlı. İhale detayından deneyin.',
  ];

  // Saat güncelleme
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // AI öneri döngüsü — fade out → metin değiş → fade in
  useEffect(() => {
    setAiTip(aiTips[0]);
    setAiTipIndex(0);
    setAiTipOpacity(1);
    const tipTimer = setInterval(() => {
      setAiTipOpacity(0);
      aiTipTimeoutRef.current = setTimeout(() => {
        setAiTipIndex((prev) => {
          const next = (prev + 1) % aiTips.length;
          setAiTip(aiTips[next]);
          setAiTipOpacity(1);
          return next;
        });
      }, 320);
    }, 8000);
    return () => {
      clearInterval(tipTimer);
      if (aiTipTimeoutRef.current) clearTimeout(aiTipTimeoutRef.current);
    };
  }, []);

  // Stats fetch - Auth olmadan da çalışır
  const SWR_OPTS = { dedupingInterval: 5000 }; // Aynı key ile 5 sn içinde tekrar istek atma
  const {
    data: stats,
    error,
    isLoading,
    mutate: mutateStats,
  } = useSWR<StatsResponse>('stats', apiClient.getStats, SWR_OPTS);

  // Unified Notes System - Kişisel notları getir
  const { notes: personalNotes, refresh: refreshNotes } = useNotes({
    contextType: null, // Kişisel notlar
    contextId: null,
    enabled: true,
  });

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
    refreshNotes();
    mutateFinans();
    mutateYaklasanIhaleler();
  }, [mutateStats, refreshNotes, mutateFinans, mutateYaklasanIhaleler]);

  useRealtimeRefetch(['invoices', 'tenders', 'stok', 'notifications'], refetchDashboard);

  const totalTenders = stats?.totalTenders || 0;
  const activeTenders = stats?.activeTenders || 0;
  type FinansOzetKasa = { kasa?: { toplam?: number }; kasaBakiye?: number };
  const kasaBakiye =
    (finansOzet as FinansOzetKasa)?.kasa?.toplam ?? (finansOzet as FinansOzetKasa)?.kasaBakiye ?? 0;

  return (
    <Box
      style={{
        minHeight: '100vh',
        paddingTop: '1rem',
        paddingBottom: '4rem',
      }}
    >
      <Container size="xl">
        <Stack gap="lg">
          {/* ========== ARTLIST-STYLE HERO BANNER (koyu + altın vurgu) ========== */}
          <Box
            style={{
              position: 'relative',
              borderRadius: 20,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #121212 0%, #1a1a1a 50%, #252525 100%)',
              border: '1px solid var(--artlist-border, #262626)',
              padding: isMobile ? '20px' : '28px 32px',
            }}
          >
            {/* Decorative - Artlist altın vurgu */}
            <Box
              style={{
                position: 'absolute',
                top: -80,
                right: -80,
                width: 250,
                height: 250,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(230, 197, 48, 0.15) 0%, transparent 70%)',
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
                background: 'radial-gradient(circle, rgba(230, 197, 48, 0.1) 0%, transparent 70%)',
                filter: 'blur(50px)',
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
                  <GreetingIcon size={isMobile ? 24 : 28} color="#e6c530" />
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

              {/* Orta: AI Önerileri — çerçevesiz, fade geçişli metin */}
              {!isMobile && (
                <Box
                  style={{
                    flex: '1 1 auto',
                    maxWidth: 550,
                    margin: '0 32px',
                    minHeight: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    style={{
                      width: '100%',
                      opacity: aiTipOpacity,
                      transition: 'opacity 0.35s ease',
                    }}
                  >
                    <Text
                      size="sm"
                      c="rgba(255,255,255,0.85)"
                      ta="center"
                      lineClamp={1}
                      style={{
                        lineHeight: 1.4,
                        width: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {aiTip}
                    </Text>
                  </Box>
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
                      {personalNotes.filter((n) => !n.is_completed).length}
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
                      variant="filled"
                      color="yellow"
                      size="xl"
                      radius="xl"
                      onClick={openNotesModal}
                      style={{
                        backgroundColor: '#e6c530',
                        color: '#0a0a0a',
                        boxShadow: '0 4px 20px rgba(230, 197, 48, 0.35)',
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
                    variant="filled"
                    color="yellow"
                    size="lg"
                    radius="xl"
                    onClick={openNotesModal}
                    style={{
                      backgroundColor: '#e6c530',
                      color: '#0a0a0a',
                      boxShadow: '0 4px 20px rgba(230, 197, 48, 0.35)',
                    }}
                  >
                    <IconNote size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>

            {/* Mobile: AI öneri alt satırda — çerçevesiz, fade geçişli */}
            {isMobile && (
              <Box
                mt="md"
                style={{
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box
                  style={{
                    width: '100%',
                    opacity: aiTipOpacity,
                    transition: 'opacity 0.35s ease',
                  }}
                >
                  <Text
                    size="xs"
                    c="rgba(255,255,255,0.85)"
                    lineClamp={1}
                    style={{
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textAlign: 'center',
                    }}
                  >
                    {aiTip}
                  </Text>
                </Box>
              </Box>
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
                />
                <QuickAction
                  href="/tenders"
                  icon={IconList}
                  label="İhale Listesi"
                  color="#3B82F6"
                />
                <QuickAction
                  href="/muhasebe/finans"
                  icon={IconBuildingBank}
                  label="Finans"
                  color="#10B981"
                />
                <QuickAction
                  href="/muhasebe/cariler"
                  icon={IconUsers}
                  label="Cariler"
                  color="#06B6D4"
                />
                <QuickAction
                  href="/muhasebe/faturalar"
                  icon={IconReceipt}
                  label="Faturalar"
                  color="#F59E0B"
                />
              </Group>
            </ScrollArea>
          </Box>

          {/* ========== MAIN CONTENT GRID ========== */}
          <Grid gutter="lg">
            {/* Yaklaşan İhaleler */}
            <Grid.Col span={12}>
              <Paper p="lg" radius="md" className="standard-card" style={{ height: '100%' }}>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={32} radius="md" variant="light" color="blue">
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
                  {yaklasanIhaleler?.slice(0, 4).map((ihale) => (
                    <Paper
                      key={ihale.id}
                      p="sm"
                      radius="md"
                      className="stat-card"
                      data-gradient="blue"
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

      {/* ========== UNIFIED NOTES MODAL (birleşik not sistemi) ========== */}
      <UnifiedNotesModal opened={notesModalOpened} onClose={closeNotesModal} />
    </Box>
  );
}

// Suspense boundary ile sarmalanmış export
export default function HomePage() {
  return (
    <Suspense fallback={<LoadingState loading={true} message="Yükleniyor..." />}>
      <HomePageContent />
    </Suspense>
  );
}
