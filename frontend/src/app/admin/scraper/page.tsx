'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Code,
  Container,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconFileText,
  IconLink,
  IconList,
  IconLoader,
  IconPlayerStop,
  IconPlus,
  IconRefresh,
  IconRocket,
  IconRotateClockwise,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { scraperAPI } from '@/lib/api/services/scraper';

// ============================================================================
// TYPES
// ============================================================================

interface HealthData {
  status: 'healthy' | 'degraded' | 'open' | 'half_open' | 'unknown';
  statusText: string;
  failureCount: number;
  successCount: number;
  failureThreshold: number;
  lastSuccess: string | null;
  lastFailure: string | null;
  cooldownUntil: string | null;
  cooldownRemaining: number | null;
  isHealthy: boolean;
  canExecute: boolean;
}

interface StatsData {
  summary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retry_pending: number;
    cancelled: number;
    total: number;
  };
  last24h: {
    completed: number;
    failed: number;
    avgDuration: number;
  };
  trend: Array<{ date: string; completed: number; failed: number }>;
  lastRun: {
    created_at: string;
    completed_at: string;
    duration_ms: number;
    result?: any;
  } | null;
}

interface Job {
  id: number;
  job_type: string;
  external_id: string;
  tender_url: string;
  status: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  tender_title: string | null;
}

interface LogEntry {
  id: number;
  level: string;
  module: string;
  message: string;
  context: any;
  created_at: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ScraperDashboardPage() {
  // API_URL kaldırıldı - scraperAPI kullanılıyor

  // State
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [logLevel, setLogLevel] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [triggerMode, setTriggerMode] = useState<string>('list');
  const [triggerPages, setTriggerPages] = useState<number>(3);
  const [triggerLimit, setTriggerLimit] = useState<number>(100);
  const [addUrlModalOpen, setAddUrlModalOpen] = useState(false);
  const [tenderUrl, setTenderUrl] = useState<string>('');

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchHealth = useCallback(async () => {
    try {
      const data = await scraperAPI.getHealth();
      if (data.success) setHealth(data.data as unknown as HealthData);
    } catch (err) {
      console.error('Health fetch error:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await scraperAPI.getStats();
      if (data.success) setStats(data.data as unknown as StatsData);
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const status = jobFilter !== 'all' ? jobFilter : undefined;
      const data = await scraperAPI.getJobs({ status, limit: 50 });
      if (data.success) setJobs(data.data as unknown as Job[]);
    } catch (err) {
      console.error('Jobs fetch error:', err);
    }
  }, [jobFilter]);

  const fetchLogs = useCallback(async () => {
    try {
      const level = logLevel !== 'all' ? logLevel : undefined;
      const data = await scraperAPI.getLogs({ level, limit: 100 });
      if (data.success) setLogs(data.data as unknown as LogEntry[]);
    } catch (err) {
      console.error('Logs fetch error:', err);
    }
  }, [logLevel]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHealth(), fetchStats(), fetchJobs(), fetchLogs()]);
    setLoading(false);
  }, [fetchHealth, fetchStats, fetchJobs, fetchLogs]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 30000); // 30 saniye
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAll]);

  // Filter değişince tekrar fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleAction = async (action: string, body?: any) => {
    setActionLoading(action);
    try {
      // action: 'start' | 'stop' | 'restart' | 'trigger'
      if (action === 'trigger') {
        // Trigger için özel endpoint gerekebilir, şimdilik fetch kullan
        const res = await fetch(`${API_BASE_URL}/api/scraper/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (data.success) {
          notifications.show({
            title: 'Başarılı',
            message: data.message,
            color: 'green',
            icon: <IconCheck size={16} />,
          });
          fetchAll();
        } else {
          throw new Error(data.error);
        }
      } else {
        // start, stop, restart için scraperAPI kullan
        const data = await scraperAPI.control(action as 'start' | 'stop' | 'restart');
        if (data.success) {
          notifications.show({
            title: 'Başarılı',
            message: data.message || 'İşlem başarılı',
            color: 'green',
            icon: <IconCheck size={16} />,
          });
          fetchAll();
        } else {
          throw new Error(data.error || 'İşlem başarısız');
        }
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Bir hata oluştu',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTrigger = async () => {
    const payload: any = { mode: triggerMode };
    if (triggerMode === 'list' || triggerMode === 'full') {
      payload.pages = triggerPages;
    }
    if (triggerMode === 'docs' || triggerMode === 'retry') {
      payload.limit = triggerLimit;
    }
    await handleAction('trigger', payload);
    setTriggerModalOpen(false);
  };

  // URL ile ihale ekleme
  const handleAddTenderByUrl = async () => {
    if (!tenderUrl.trim()) {
      notifications.show({
        title: 'Hata',
        message: 'URL girmelisiniz',
        color: 'red',
      });
      return;
    }

    // URL formatı kontrolü
    if (!tenderUrl.includes('ihalebul.com/tender/')) {
      notifications.show({
        title: 'Geçersiz URL',
        message: 'URL formatı: https://ihalebul.com/tender/123456',
        color: 'red',
      });
      return;
    }

    setActionLoading('addUrl');
    try {
      const data = await scraperAPI.addTender(tenderUrl.trim());

      if (data.success) {
        notifications.show({
          title: 'Başarılı!',
          message: `${data.data.isNew ? 'Yeni ihale eklendi' : 'İhale güncellendi'}: ${data.data.title?.substring(0, 50)}... (${data.data.documentCount} döküman)`,
          color: 'green',
        });
        setAddUrlModalOpen(false);
        setTenderUrl('');
        fetchAll();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'İhale eklenemedi',
          color: 'red',
        });
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Bağlantı hatası',
        color: 'red',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      healthy: 'green',
      degraded: 'yellow',
      open: 'red',
      half_open: 'orange',
      unknown: 'gray',
      pending: 'blue',
      processing: 'cyan',
      completed: 'green',
      failed: 'red',
      retry_pending: 'orange',
      cancelled: 'gray',
    };
    return colors[status] || 'gray';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      healthy: IconCircleCheck,
      degraded: IconAlertTriangle,
      open: IconCircleX,
      half_open: IconLoader,
      unknown: IconAlertTriangle,
      pending: IconClock,
      processing: IconLoader,
      completed: IconCircleCheck,
      failed: IconCircleX,
      retry_pending: IconRotateClockwise,
      cancelled: IconPlayerStop,
    };
    const Icon = icons[status] || IconCircleCheck;
    return <Icon size={16} />;
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('tr-TR');
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLogLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      DEBUG: 'gray',
      INFO: 'blue',
      WARN: 'yellow',
      ERROR: 'red',
      FATAL: 'grape',
    };
    return colors[level] || 'gray';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="subtle" size="lg" component="a" href="/admin">
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={1} size="h2" mb={4}>
                🕷️ Scraper Dashboard
              </Title>
              <Text c="dimmed">İhale scraper durumu, istatistikler ve yönetim</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant={autoRefresh ? 'filled' : 'light'}
              color={autoRefresh ? 'green' : 'gray'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              leftSection={<IconActivity size={16} />}
            >
              {autoRefresh ? 'Otomatik Yenileme Açık' : 'Otomatik Yenileme'}
            </Button>
            <Button
              variant="light"
              size="sm"
              onClick={fetchAll}
              leftSection={<IconRefresh size={16} />}
            >
              Yenile
            </Button>
          </Group>
        </Group>

        {/* Durum Kartları */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {/* Circuit Breaker */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Circuit Breaker</Text>
              <ThemeIcon
                variant="light"
                color={getStatusColor(health?.status || 'unknown')}
                size="lg"
              >
                {getStatusIcon(health?.status || 'unknown')}
              </ThemeIcon>
            </Group>
            <Badge color={getStatusColor(health?.status || 'unknown')} size="lg" fullWidth>
              {health?.status?.toUpperCase() || 'UNKNOWN'}
            </Badge>
            <Text size="xs" c="dimmed" mt="xs">
              {health?.statusText}
            </Text>
            {health?.cooldownRemaining && (
              <Text size="xs" c="orange" mt="xs">
                ⏳ Kalan: {health.cooldownRemaining}s
              </Text>
            )}
          </Card>

          {/* Son Çalışma */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Son Başarılı</Text>
              <ThemeIcon variant="light" color="green" size="lg">
                <IconClock size={18} />
              </ThemeIcon>
            </Group>
            <Text size="sm" fw={500}>
              {formatDate(health?.lastSuccess)}
            </Text>
            {stats?.lastRun && (
              <Text size="xs" c="dimmed" mt="xs">
                Süre: {formatDuration(stats.lastRun.duration_ms)}
              </Text>
            )}
          </Card>

          {/* Hata Sayacı */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Hata Sayacı</Text>
              <ThemeIcon variant="light" color="red" size="lg">
                <IconAlertTriangle size={18} />
              </ThemeIcon>
            </Group>
            <Group gap="xs">
              <Text size="xl" fw={700} c="red">
                {health?.failureCount || 0}
              </Text>
              <Text size="sm" c="dimmed">
                / {health?.failureThreshold || 5}
              </Text>
            </Group>
            <Progress
              value={((health?.failureCount || 0) / (health?.failureThreshold || 5)) * 100}
              color="red"
              size="sm"
              mt="xs"
            />
          </Card>

          {/* Queue Durumu */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Queue</Text>
              <ThemeIcon variant="light" color="blue" size="lg">
                <IconList size={18} />
              </ThemeIcon>
            </Group>
            <Group gap="xs">
              <Badge color="blue" variant="light">
                {stats?.summary.pending || 0} Bekleyen
              </Badge>
              <Badge color="cyan" variant="light">
                {stats?.summary.processing || 0} İşlenen
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              Toplam: {stats?.summary.total || 0} job
            </Text>
          </Card>
        </SimpleGrid>

        {/* İstatistik Kartları */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {/* Son 24 Saat */}
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">
              📊 Son 24 Saat
            </Title>
            <Group justify="center" mb="md">
              <RingProgress
                size={120}
                thickness={12}
                sections={[
                  { value: stats?.last24h.completed || 0, color: 'green' },
                  { value: stats?.last24h.failed || 0, color: 'red' },
                ]}
                label={
                  <Center>
                    <Text size="lg" fw={700}>
                      {(stats?.last24h.completed || 0) + (stats?.last24h.failed || 0)}
                    </Text>
                  </Center>
                }
              />
            </Group>
            <Group justify="center" gap="xl">
              <div style={{ textAlign: 'center' }}>
                <Text size="xl" fw={700} c="green">
                  {stats?.last24h.completed || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Başarılı
                </Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Text size="xl" fw={700} c="red">
                  {stats?.last24h.failed || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Başarısız
                </Text>
              </div>
            </Group>
          </Paper>

          {/* Queue Özeti */}
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">
              📋 Queue Özeti
            </Title>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm">Bekleyen</Text>
                <Badge color="blue">{stats?.summary.pending || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">İşleniyor</Text>
                <Badge color="cyan">{stats?.summary.processing || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Retry Bekleyen</Text>
                <Badge color="orange">{stats?.summary.retry_pending || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Tamamlanan</Text>
                <Badge color="green">{stats?.summary.completed || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Başarısız</Text>
                <Badge color="red">{stats?.summary.failed || 0}</Badge>
              </Group>
            </Stack>
          </Paper>

          {/* Kontroller */}
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">
              🎮 Kontroller
            </Title>
            <Stack gap="sm">
              <Button
                variant="gradient"
                gradient={{ from: 'violet', to: 'blue' }}
                fullWidth
                leftSection={<IconRocket size={16} />}
                onClick={() => setTriggerModalOpen(true)}
              >
                Manuel Scraping Başlat
              </Button>
              <Button
                variant="gradient"
                gradient={{ from: 'teal', to: 'cyan' }}
                fullWidth
                leftSection={<IconLink size={16} />}
                onClick={() => setAddUrlModalOpen(true)}
              >
                URL ile İhale Ekle
              </Button>
              <Button
                variant="light"
                color="green"
                fullWidth
                leftSection={<IconRotateClockwise size={16} />}
                loading={actionLoading === 'retry'}
                onClick={() => handleAction('retry', { limit: 50 })}
                disabled={!stats?.summary.failed}
              >
                Başarısızları Tekrar Dene ({stats?.summary.failed || 0})
              </Button>
              <Button
                variant="light"
                color="orange"
                fullWidth
                leftSection={<IconRefresh size={16} />}
                loading={actionLoading === 'reset'}
                onClick={() => handleAction('reset')}
                disabled={health?.status === 'healthy'}
              >
                Circuit Breaker Sıfırla
              </Button>
              <Button
                variant="light"
                color="red"
                fullWidth
                leftSection={<IconPlayerStop size={16} />}
                loading={actionLoading === 'cancel'}
                onClick={() => handleAction('cancel')}
                disabled={!stats?.summary.pending}
              >
                Bekleyenleri İptal Et ({stats?.summary.pending || 0})
              </Button>
              <Button
                variant="light"
                color="gray"
                fullWidth
                leftSection={<IconTrash size={16} />}
                loading={actionLoading === 'cleanup'}
                onClick={() => handleAction('cleanup', { days: 7 })}
              >
                Eski Verileri Temizle
              </Button>
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Tabs: Jobs & Logs */}
        <Paper p="lg" radius="md" withBorder>
          <Tabs defaultValue="jobs">
            <Tabs.List>
              <Tabs.Tab value="jobs" leftSection={<IconList size={16} />}>
                Job Listesi
              </Tabs.Tab>
              <Tabs.Tab value="logs" leftSection={<IconFileText size={16} />}>
                Loglar
              </Tabs.Tab>
            </Tabs.List>

            {/* Jobs Tab */}
            <Tabs.Panel value="jobs" pt="md">
              <Group justify="space-between" mb="md">
                <SegmentedControl
                  value={jobFilter}
                  onChange={setJobFilter}
                  data={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Bekleyen', value: 'pending' },
                    { label: 'İşleniyor', value: 'processing' },
                    { label: 'Başarısız', value: 'failed' },
                    { label: 'Tamamlanan', value: 'completed' },
                  ]}
                  size="xs"
                />
                <Button size="xs" variant="subtle" onClick={fetchJobs}>
                  <IconRefresh size={14} />
                </Button>
              </Group>

              <ScrollArea h={400}>
                {jobs.length === 0 ? (
                  <Center h={200}>
                    <Text c="dimmed">Henüz job kaydı yok</Text>
                  </Center>
                ) : (
                  <Table.ScrollContainer minWidth={700}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>ID</Table.Th>
                          <Table.Th>İhale</Table.Th>
                          <Table.Th>Durum</Table.Th>
                          <Table.Th>Retry</Table.Th>
                          <Table.Th>Süre</Table.Th>
                          <Table.Th>Tarih</Table.Th>
                          <Table.Th>Hata</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {jobs.map((job) => (
                          <Table.Tr key={job.id}>
                            <Table.Td>#{job.id}</Table.Td>
                            <Table.Td>
                              <Tooltip label={job.tender_title || job.tender_url}>
                                <Text size="sm" lineClamp={1} style={{ maxWidth: 200 }}>
                                  {job.external_id}
                                </Text>
                              </Tooltip>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={getStatusColor(job.status)}
                                size="sm"
                                leftSection={getStatusIcon(job.status)}
                              >
                                {job.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              {job.retry_count}/{job.max_retries}
                            </Table.Td>
                            <Table.Td>{formatDuration(job.duration_ms)}</Table.Td>
                            <Table.Td>
                              <Text size="xs">{formatDate(job.created_at)}</Text>
                            </Table.Td>
                            <Table.Td>
                              {job.error_message && (
                                <Tooltip label={job.error_message}>
                                  <Badge color="red" size="xs">
                                    Hata
                                  </Badge>
                                </Tooltip>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </ScrollArea>
            </Tabs.Panel>

            {/* Logs Tab */}
            <Tabs.Panel value="logs" pt="md">
              <Group justify="space-between" mb="md">
                <SegmentedControl
                  value={logLevel}
                  onChange={setLogLevel}
                  data={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Debug', value: 'DEBUG' },
                    { label: 'Info', value: 'INFO' },
                    { label: 'Warn', value: 'WARN' },
                    { label: 'Error', value: 'ERROR' },
                  ]}
                  size="xs"
                />
                <Button size="xs" variant="subtle" onClick={fetchLogs}>
                  <IconRefresh size={14} />
                </Button>
              </Group>

              <ScrollArea h={400}>
                {logs.length === 0 ? (
                  <Center h={200}>
                    <Text c="dimmed">Henüz log kaydı yok</Text>
                  </Center>
                ) : (
                  <Stack gap="xs">
                    {logs.map((log) => (
                      <Paper key={log.id} p="xs" withBorder>
                        <Group justify="space-between" mb={4}>
                          <Group gap="xs">
                            <Badge color={getLogLevelColor(log.level)} size="xs">
                              {log.level}
                            </Badge>
                            <Badge variant="outline" size="xs">
                              {log.module}
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {formatDate(log.created_at)}
                          </Text>
                        </Group>
                        <Text size="sm">{log.message}</Text>
                        {log.context && Object.keys(log.context).length > 0 && (
                          <Code block mt="xs" style={{ fontSize: 11 }}>
                            {JSON.stringify(log.context, null, 2)}
                          </Code>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                )}
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Stack>

      {/* Manuel Trigger Modal */}
      <Modal
        opened={triggerModalOpen}
        onClose={() => setTriggerModalOpen(false)}
        title="Manuel Scraping Başlat"
        centered
      >
        <Stack gap="md">
          <Select
            label="Mod"
            placeholder="Scraping modu seçin"
            value={triggerMode}
            onChange={(v) => setTriggerMode(v || 'list')}
            data={[
              { value: 'list', label: '📋 Liste Tarama (sadece ihaleler)' },
              { value: 'full', label: '🚀 Tam Tarama (liste + döküman)' },
              { value: 'docs', label: '📄 Döküman İşleme (eksik dökümanlar)' },
              { value: 'retry', label: '🔄 Başarısızları Tekrar Dene' },
            ]}
          />

          {(triggerMode === 'list' || triggerMode === 'full') && (
            <NumberInput
              label="Sayfa Sayısı"
              description="Kaç sayfa taransın"
              value={triggerPages}
              onChange={(v) => setTriggerPages(Number(v) || 3)}
              min={1}
              max={50}
            />
          )}

          {(triggerMode === 'docs' || triggerMode === 'retry') && (
            <NumberInput
              label="Limit"
              description="Kaç job işlensin"
              value={triggerLimit}
              onChange={(v) => setTriggerLimit(Number(v) || 100)}
              min={1}
              max={500}
            />
          )}

          <Text size="xs" c="dimmed">
            {triggerMode === 'list' && 'Sadece ihale listesini tarar, dökümanlar ayrıca çekilir.'}
            {triggerMode === 'full' &&
              "Liste tarar ve bulunan ihaleler için döküman job'ları oluşturup işler."}
            {triggerMode === 'docs' && "Bekleyen döküman job'larını işler (login gerektirir)."}
            {triggerMode === 'retry' && "Başarısız olmuş job'ları yeniden kuyruğa alır ve işler."}
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setTriggerModalOpen(false)}>
              İptal
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: 'violet', to: 'blue' }}
              leftSection={<IconRocket size={16} />}
              loading={actionLoading === 'trigger'}
              onClick={handleTrigger}
            >
              Başlat
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* URL ile İhale Ekleme Modal */}
      <Modal
        opened={addUrlModalOpen}
        onClose={() => {
          setAddUrlModalOpen(false);
          setTenderUrl('');
        }}
        title="URL ile İhale Ekle"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="İhale URL'si"
            placeholder="https://ihalebul.com/tender/123456"
            value={tenderUrl}
            onChange={(e) => setTenderUrl(e.target.value)}
            description="ihalebul.com üzerindeki ihale detay sayfasının URL'sini girin"
            leftSection={<IconLink size={16} />}
          />

          <Paper p="sm" bg="gray.0" radius="md">
            <Text size="xs" c="dimmed">
              <strong>Örnek:</strong> https://ihalebul.com/tender/1768253602118
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              Bu işlem ihale bilgilerini ve döküman linklerini otomatik olarak çeker.
            </Text>
          </Paper>

          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              onClick={() => {
                setAddUrlModalOpen(false);
                setTenderUrl('');
              }}
            >
              İptal
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: 'teal', to: 'cyan' }}
              leftSection={<IconPlus size={16} />}
              loading={actionLoading === 'addUrl'}
              onClick={handleAddTenderByUrl}
              disabled={!tenderUrl.trim()}
            >
              İhale Ekle
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
