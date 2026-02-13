'use client';

import {
  Accordion,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconCloudDownload,
  IconFileAnalytics,
  IconGavel,
  IconPlayerPlay,
  IconShoppingCart,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';

// ─── Types ───────────────────────────────────────────────────

interface SchedulerInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  schedule: string;
  isRunning: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  stats: Record<string, unknown> | null;
  nextRun: string | null;
  jobCount: number | null;
}

// ─── Icon Map ────────────────────────────────────────────────

const SCHEDULER_ICONS: Record<string, React.ElementType> = {
  sync: IconCloudDownload,
  tender: IconGavel,
  piyasa: IconShoppingCart,
  reminder: IconCalendarEvent,
  document: IconFileAnalytics,
};

const CATEGORY_LABELS: Record<string, string> = {
  data: 'Veri Toplama',
  sync: 'Senkronizasyon',
  automation: 'Otomasyon',
};

const CATEGORY_ORDER = ['data', 'sync', 'automation'];

// ─── Helpers ─────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Henüz çalışmadı';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  if (diffHour < 24) return `${diffHour} saat önce`;
  if (diffDay < 7) return `${diffDay} gün önce`;
  return date.toLocaleDateString('tr-TR');
}

// ─── API ─────────────────────────────────────────────────────

async function fetchSchedulers(): Promise<SchedulerInfo[]> {
  try {
    const res = await authFetch(`${API_BASE_URL}/api/system/schedulers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Scheduler bilgileri alınamadı');
    return Array.isArray(data.schedulers) ? data.schedulers : [];
  } catch (err) {
    console.error('[SchedulersSection] Fetch error:', err);
    throw err;
  }
}

async function toggleScheduler(id: string): Promise<{ action: string }> {
  const res = await authFetch(`${API_BASE_URL}/api/system/schedulers/${id}/toggle`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Scheduler değiştirilemedi');
  return data;
}

async function triggerScheduler(id: string): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE_URL}/api/system/schedulers/${id}/trigger`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || data.error || 'Scheduler tetiklenemedi');
  return data;
}

// ─── Main Component ──────────────────────────────────────────

export default function SchedulersSection() {
  const queryClient = useQueryClient();

  const {
    data: schedulers,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['schedulers'],
    queryFn: fetchSchedulers,
    refetchInterval: 30000, // Auto-refresh every 30s
    retry: 1,
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Zamanlanmış görevler yükleniyor...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Paper p="lg" withBorder radius="md">
        <Text c="red" size="sm">
          Scheduler bilgileri yüklenemedi: {(error as Error).message}
        </Text>
      </Paper>
    );
  }

  const items = Array.isArray(schedulers) ? schedulers : [];
  const runningCount = items.filter((s) => s.isRunning).length;

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    schedulers: items.filter((s) => s.category === cat),
  })).filter((g) => g.schedulers.length > 0);

  return (
    <Stack gap="lg">
      <Paper p="lg" withBorder radius="md">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>Zamanlanmış Görevler</Title>
            <Text c="dimmed" size="sm">
              Arka planda otomatik çalışan servisleri yönetin
            </Text>
          </div>
          <Group gap="xs">
            <Badge size="lg" variant="light" color="cyan">
              {items.length} Görev
            </Badge>
            <Badge size="lg" variant="light" color="green">
              {runningCount} Çalışıyor
            </Badge>
          </Group>
        </Group>

        {grouped.map((group) => (
          <Box key={group.category} mb="lg">
            <Text fw={600} size="sm" c="dimmed" tt="uppercase" lts={0.5} mb="xs">
              {group.label}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {group.schedulers.map((scheduler) => (
                <SchedulerCard key={scheduler.id} scheduler={scheduler} queryClient={queryClient} />
              ))}
            </SimpleGrid>
          </Box>
        ))}
      </Paper>
    </Stack>
  );
}

// ─── Scheduler Card ──────────────────────────────────────────

interface SchedulerCardProps {
  scheduler: SchedulerInfo;
  queryClient: ReturnType<typeof useQueryClient>;
}

function SchedulerCard({ scheduler, queryClient }: SchedulerCardProps) {
  const IconComp = SCHEDULER_ICONS[scheduler.id] || IconClock;

  const toggleMut = useMutation({
    mutationFn: () => toggleScheduler(scheduler.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedulers'] });
      notifications.show({
        title: data.action === 'started' ? 'Başlatıldı' : 'Durduruldu',
        message: `${scheduler.name} ${data.action === 'started' ? 'başlatıldı' : 'durduruldu'}`,
        color: data.action === 'started' ? 'green' : 'orange',
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Hata', message: err.message, color: 'red' });
    },
  });

  const triggerMut = useMutation({
    mutationFn: () => triggerScheduler(scheduler.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedulers'] });
      notifications.show({
        title: 'Tetiklendi',
        message: data.message || `${scheduler.name} manuel olarak tetiklendi`,
        color: 'blue',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Hata', message: err.message, color: 'red' });
    },
  });

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <ThemeIcon size="lg" variant="light" color={scheduler.isRunning ? 'green' : 'gray'} radius="md">
            <IconComp size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600} size="sm">
              {scheduler.name}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {scheduler.description}
            </Text>
          </div>
        </Group>
        <Tooltip label={scheduler.isRunning ? 'Durdur' : 'Başlat'} withArrow>
          <Switch
            checked={scheduler.isRunning}
            size="sm"
            onChange={() => toggleMut.mutate()}
            disabled={toggleMut.isPending}
          />
        </Tooltip>
      </Group>

      {/* Status badges */}
      <Group gap="xs" mb="xs">
        <Badge size="xs" variant="dot" color={scheduler.isRunning ? 'green' : 'gray'}>
          {scheduler.isRunning ? 'Çalışıyor' : 'Durdu'}
        </Badge>
        {scheduler.jobCount !== null && scheduler.jobCount > 0 && (
          <Badge size="xs" variant="light" color="blue">
            {scheduler.jobCount} kuyrukta
          </Badge>
        )}
      </Group>

      {/* Schedule info */}
      <Accordion variant="contained" radius="sm" chevronPosition="left">
        <Accordion.Item value="details">
          <Accordion.Control p="xs">
            <Group gap={4}>
              <IconClock size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text size="xs" c="dimmed">
                Son çalışma: {formatRelativeTime(scheduler.lastRunAt)}
              </Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Group gap="xs">
                <Text size="xs" fw={500} c="dimmed" w={80}>
                  Zamanlama:
                </Text>
                <Text size="xs">{scheduler.schedule}</Text>
              </Group>
              {scheduler.lastRunAt && (
                <Group gap="xs">
                  <Text size="xs" fw={500} c="dimmed" w={80}>
                    Son çalışma:
                  </Text>
                  <Text size="xs">{new Date(scheduler.lastRunAt).toLocaleString('tr-TR')}</Text>
                  {scheduler.lastRunStatus === 'error' && (
                    <Badge size="xs" color="red" variant="light">
                      Hata
                    </Badge>
                  )}
                </Group>
              )}
              {scheduler.stats && (
                <Group gap="xs">
                  <Text size="xs" fw={500} c="dimmed" w={80}>
                    İstatistik:
                  </Text>
                  <Text size="xs">
                    {Object.entries(scheduler.stats)
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')}
                  </Text>
                </Group>
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Actions */}
      <Group justify="flex-end" mt="xs">
        <Tooltip label="Şimdi çalıştır" withArrow>
          <Button
            size="compact-xs"
            variant="light"
            color="blue"
            leftSection={<IconPlayerPlay size={12} />}
            onClick={() => triggerMut.mutate()}
            loading={triggerMut.isPending}
            disabled={!scheduler.isRunning}
          >
            Tetikle
          </Button>
        </Tooltip>
      </Group>
    </Card>
  );
}
