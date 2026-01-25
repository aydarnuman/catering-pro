'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Loader,
  NumberInput,
  Paper,
  Progress,
  rem,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBrain,
  IconCategory,
  IconChartBar,
  IconCheck,
  IconClock,
  IconCloudDownload,
  IconDatabase,
  IconFileInvoice,
  IconFileText,
  IconGavel,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconSettings,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

export default function SyncControlPage() {
  const { colorScheme } = useMantineColorScheme();
  const _isDark = colorScheme === 'dark';

  // Fatura State
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [syncType, setSyncType] = useState('standard');
  const [syncMonths, setSyncMonths] = useState(3);
  const [maxInvoices, setMaxInvoices] = useState(500);
  const [dateRange, _setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [selectedCategory, _setSelectedCategory] = useState<string | null>(null);
  const [selectedVendor, _setSelectedVendor] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [_settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [_settingsModal, _setSettingsModal] = useState(false);

  // İhale State
  const [tenderSchedulerStatus, setTenderSchedulerStatus] = useState<any>(null);
  const [scrapingTenders, setScrapingTenders] = useState(false);

  // Database Stats
  const [databaseStats, setDatabaseStats] = useState<any>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<string | null>('invoices');

  // Scheduler durumunu yükle (Fatura)
  const loadSchedulerStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sync/status`);
      const data = await res.json();
      if (data.success) {
        setSchedulerStatus(data);
      }
    } catch (error) {
      console.error('Scheduler durumu yüklenemedi:', error);
    }
  };

  // İhale scheduler durumunu yükle
  const loadTenderSchedulerStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tenders/scheduler/status`);
      const data = await res.json();
      if (data.success) {
        setTenderSchedulerStatus(data);
      }
    } catch (error) {
      console.error('İhale scheduler durumu yüklenemedi:', error);
    }
  };

  // Sync loglarını yükle
  const loadSyncLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sync/logs`);
      const data = await res.json();
      if (data.success) {
        setSyncLogs(data.logs);
      }
    } catch (error) {
      console.error('Log yüklenemedi:', error);
    }
  };

  // Ayarları yükle
  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sync/settings`);
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
    }
  };

  // Veritabanı istatistiklerini yükle
  const loadDatabaseStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/database-stats/summary`);
      const data = await res.json();
      if (data.success) {
        setDatabaseStats(data.data);
      }
    } catch (error) {
      console.error('Veritabanı istatistikleri yüklenemedi:', error);
    }
  };

  // İlk yükleme
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadSchedulerStatus(),
        loadTenderSchedulerStatus(),
        loadSyncLogs(),
        loadSettings(),
        loadDatabaseStats(),
      ]);
      setLoading(false);
    };

    loadData();

    // Her 10 saniyede bir güncelle
    const interval = setInterval(() => {
      loadSchedulerStatus();
      loadTenderSchedulerStatus();
      loadSyncLogs();
      if (activeTab === 'database') {
        loadDatabaseStats();
      }
    }, 10000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Manuel sync
  const handleManualSync = async () => {
    setSyncing(true);

    let endpoint = '/sync/manual';
    let body: any = {};

    if (syncType === 'dateRange' && dateRange[0] && dateRange[1]) {
      endpoint = '/sync/date-range';
      body = {
        startDate: dayjs(dateRange[0]).format('YYYY-MM-DD'),
        endDate: dayjs(dateRange[1]).format('YYYY-MM-DD'),
        maxInvoices,
      };
    } else if (syncType === 'category' && selectedCategory) {
      endpoint = '/sync/category';
      body = { category: selectedCategory, months: syncMonths, maxInvoices };
    } else if (syncType === 'vendor' && selectedVendor) {
      endpoint = '/sync/vendor';
      body = { vendor: selectedVendor, months: syncMonths, maxInvoices };
    } else {
      body = { months: syncMonths, maxInvoices };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'Senkronizasyon Başarılı',
          message: `${data.invoicesSynced || 0} fatura senkronize edildi. ${data.newInvoices || 0} yeni fatura eklendi.`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        await Promise.all([loadSchedulerStatus(), loadSyncLogs()]);
      } else {
        notifications.show({
          title: 'Senkronizasyon Hatası',
          message: data.error || 'Bilinmeyen bir hata oluştu',
          color: 'red',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Scheduler başlat/durdur (Fatura)
  const toggleScheduler = async () => {
    const endpoint = schedulerStatus?.isRunning ? '/sync/stop' : '/sync/start';

    try {
      const res = await fetch(`${API_BASE_URL}/api${endpoint}`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: schedulerStatus?.isRunning ? 'Scheduler durduruldu' : 'Scheduler başlatıldı',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        await loadSchedulerStatus();
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    }
  };

  // İhale Scheduler başlat/durdur
  const toggleTenderScheduler = async () => {
    const endpoint = tenderSchedulerStatus?.isRunning
      ? '/tenders/scheduler/stop'
      : '/tenders/scheduler/start';

    try {
      const res = await fetch(`${API_BASE_URL}/api${endpoint}`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: tenderSchedulerStatus?.isRunning
            ? 'İhale Scheduler durduruldu'
            : 'İhale Scheduler başlatıldı',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        await loadTenderSchedulerStatus();
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    }
  };

  // Manuel ihale scrape
  const handleTenderScrape = async (maxPages = 3) => {
    setScrapingTenders(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/tenders/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPages }),
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${data.stats?.new || 0} yeni ihale bulundu`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        await loadTenderSchedulerStatus();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'İhale scraper başarısız',
          color: 'red',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    } finally {
      setScrapingTenders(false);
    }
  };

  // Duplicate temizle
  const cleanupDuplicates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sync/cleanup-duplicates`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${data.removed || 0} duplicate fatura temizlendi`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    }
  };

  // Haftalık rapor oluştur
  const generateReport = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sync/generate-report`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Haftalık rapor oluşturuldu',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" py={100}>
          <Loader size="xl" color="violet" />
          <Text c="dimmed">Yükleniyor...</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={1}>
              <Group gap="sm">
                <ThemeIcon
                  size={50}
                  radius="md"
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                >
                  <IconDatabase size={30} />
                </ThemeIcon>
                📊 Veri Yönetimi Merkezi
              </Group>
            </Title>
            <Text c="dimmed" size="sm" mt="xs">
              Tüm verilerinizi tek merkezden yönetin: Otomatik güncelleme, senkronizasyon ve
              yedekleme
            </Text>
          </div>

          <Group>
            <Button
              component="a"
              href="/ayarlar"
              variant="light"
              leftSection={<IconSettings size={16} />}
              size="sm"
            >
              Ayarlar
            </Button>
          </Group>
        </Group>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab
              value="invoices"
              leftSection={<IconFileInvoice style={{ width: rem(16), height: rem(16) }} />}
            >
              Fatura Senkronizasyonu
            </Tabs.Tab>
            <Tabs.Tab
              value="tenders"
              leftSection={<IconGavel style={{ width: rem(16), height: rem(16) }} />}
            >
              İhale Güncellemeleri
            </Tabs.Tab>
            <Tabs.Tab
              value="backup"
              leftSection={<IconDatabase style={{ width: rem(16), height: rem(16) }} />}
            >
              Yedekleme & Geri Yükleme
            </Tabs.Tab>
            <Tabs.Tab
              value="database"
              leftSection={<IconChartBar style={{ width: rem(16), height: rem(16) }} />}
            >
              Veritabanı Özeti
            </Tabs.Tab>
          </Tabs.List>

          {/* FATURA TAB */}
          <Tabs.Panel value="invoices" pt="xl">
            <Stack gap="lg">
              {/* Fatura Durum Kartları */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      UYUMSOFT DURUM
                    </Text>
                    <ThemeIcon
                      color={schedulerStatus?.isRunning ? 'green' : 'gray'}
                      variant="light"
                      size={30}
                    >
                      <IconPlayerPlay size={16} />
                    </ThemeIcon>
                  </Group>
                  <Group align="flex-end" gap="xs">
                    <Badge
                      size="xl"
                      color={schedulerStatus?.isRunning ? 'green' : 'gray'}
                      variant="filled"
                    >
                      {schedulerStatus?.isRunning ? 'ÇALIŞIYOR' : 'DURDURULDU'}
                    </Badge>
                  </Group>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      SON GÜNCELLEME
                    </Text>
                    <ThemeIcon color="blue" variant="light" size={30}>
                      <IconClock size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg">
                    {schedulerStatus?.lastSyncTime
                      ? dayjs(schedulerStatus.lastSyncTime).format('DD.MM HH:mm')
                      : 'Henüz yapılmadı'}
                  </Text>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      TOPLAM ÇALIŞMA
                    </Text>
                    <ThemeIcon color="violet" variant="light" size={30}>
                      <IconChartBar size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg">
                    {schedulerStatus?.stats?.totalRuns || 0}
                  </Text>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      BAŞARI ORANI
                    </Text>
                    <ThemeIcon color="green" variant="light" size={30}>
                      <IconCheck size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg">
                    {schedulerStatus?.stats?.totalRuns > 0
                      ? Math.round(
                          (schedulerStatus.stats.successfulRuns / schedulerStatus.stats.totalRuns) *
                            100
                        )
                      : 0}
                    %
                  </Text>
                </Paper>
              </SimpleGrid>

              {/* Fatura Kontrol Paneli */}
              <Card withBorder shadow="sm" p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="lg" fw={600}>
                      📊 Manuel Fatura Senkronizasyonu
                    </Text>
                    <Button
                      leftSection={
                        schedulerStatus?.isRunning ? (
                          <IconPlayerStop size={16} />
                        ) : (
                          <IconPlayerPlay size={16} />
                        )
                      }
                      color={schedulerStatus?.isRunning ? 'red' : 'green'}
                      onClick={toggleScheduler}
                    >
                      Otomatik Güncellemeyi {schedulerStatus?.isRunning ? 'Durdur' : 'Başlat'}
                    </Button>
                  </Group>

                  <Divider />

                  <Select
                    label="Senkronizasyon Tipi"
                    leftSection={<IconCategory size={16} />}
                    value={syncType}
                    onChange={(value) => setSyncType(value || 'standard')}
                    data={[
                      { value: 'standard', label: '📅 Standart (Son X Ay)' },
                      { value: 'dateRange', label: '📆 Tarih Aralığı' },
                      { value: 'category', label: '🏷️ Kategori Bazlı' },
                      { value: 'vendor', label: '🏪 Satıcı Bazlı' },
                    ]}
                  />

                  {syncType === 'standard' && (
                    <NumberInput
                      label="Geriye Dönük Ay"
                      value={syncMonths}
                      onChange={(value) => setSyncMonths(Number(value) || 3)}
                      min={1}
                      max={12}
                    />
                  )}

                  {(syncType === 'standard' || syncType === 'dateRange') && (
                    <NumberInput
                      label="Maksimum Fatura"
                      value={maxInvoices}
                      onChange={(value) => setMaxInvoices(Number(value) || 500)}
                      min={10}
                      max={5000}
                      step={100}
                    />
                  )}

                  <Group>
                    <Button
                      leftSection={
                        syncing ? (
                          <Loader size={14} color="white" />
                        ) : (
                          <IconCloudDownload size={16} />
                        )
                      }
                      onClick={handleManualSync}
                      loading={syncing}
                    >
                      Senkronize Et
                    </Button>

                    <Button
                      leftSection={<IconTrash size={16} />}
                      variant="light"
                      color="orange"
                      onClick={cleanupDuplicates}
                    >
                      Duplicate Temizle
                    </Button>

                    <Button
                      leftSection={<IconChartBar size={16} />}
                      variant="light"
                      color="violet"
                      onClick={generateReport}
                    >
                      Haftalık Rapor
                    </Button>
                  </Group>

                  <Alert icon={<IconClock size={16} />} color="blue" variant="light">
                    Otomatik güncelleme: Her 6 saatte bir çalışır
                  </Alert>
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          {/* İHALE TAB */}
          <Tabs.Panel value="tenders" pt="xl">
            <Stack gap="lg">
              {/* İhale Durum Kartları */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      SCRAPER DURUM
                    </Text>
                    <ThemeIcon
                      color={tenderSchedulerStatus?.isRunning ? 'blue' : 'gray'}
                      variant="light"
                      size={30}
                    >
                      <IconPlayerPlay size={16} />
                    </ThemeIcon>
                  </Group>
                  <Badge
                    size="xl"
                    color={tenderSchedulerStatus?.isRunning ? 'blue' : 'gray'}
                    variant="filled"
                  >
                    {tenderSchedulerStatus?.isRunning ? 'AKTİF' : 'PASİF'}
                  </Badge>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      SON TARAMA
                    </Text>
                    <ThemeIcon color="cyan" variant="light" size={30}>
                      <IconClock size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg">
                    {tenderSchedulerStatus?.lastScrapeTime
                      ? dayjs(tenderSchedulerStatus.lastScrapeTime).format('DD.MM HH:mm')
                      : 'Henüz yapılmadı'}
                  </Text>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      TOPLAM TARAMA
                    </Text>
                    <ThemeIcon color="indigo" variant="light" size={30}>
                      <IconChartBar size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg">
                    {tenderSchedulerStatus?.stats?.totalRuns || 0}
                  </Text>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      YENİ İHALE
                    </Text>
                    <ThemeIcon color="green" variant="light" size={30}>
                      <IconFileText size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg">
                    {tenderSchedulerStatus?.stats?.lastNewTenders || 0}
                  </Text>
                </Paper>
              </SimpleGrid>

              {/* İhale Kontrol Paneli */}
              <Card withBorder shadow="sm" p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="lg" fw={600}>
                      🔍 İhale Tarama Kontrolü
                    </Text>
                    <Button
                      leftSection={
                        tenderSchedulerStatus?.isRunning ? (
                          <IconPlayerStop size={16} />
                        ) : (
                          <IconPlayerPlay size={16} />
                        )
                      }
                      color={tenderSchedulerStatus?.isRunning ? 'red' : 'blue'}
                      onClick={toggleTenderScheduler}
                    >
                      Otomatik Taramayı {tenderSchedulerStatus?.isRunning ? 'Durdur' : 'Başlat'}
                    </Button>
                  </Group>

                  <Divider />

                  <Text size="sm" c="dimmed">
                    İhale sitelerinden yeni ihaleleri tarayıp veritabanına kaydedin. Sayfa sayısı
                    arttıkça tarama süresi uzar.
                  </Text>

                  <Group>
                    <Button
                      leftSection={
                        scrapingTenders ? (
                          <Loader size={14} color="white" />
                        ) : (
                          <IconFileText size={16} />
                        )
                      }
                      onClick={() => handleTenderScrape(3)}
                      loading={scrapingTenders}
                      color="blue"
                    >
                      3 Sayfa Tara (~1dk)
                    </Button>

                    <Button
                      leftSection={<IconFileText size={16} />}
                      variant="light"
                      color="blue"
                      onClick={() => handleTenderScrape(5)}
                      disabled={scrapingTenders}
                    >
                      5 Sayfa Tara (~2dk)
                    </Button>

                    <Button
                      leftSection={<IconFileText size={16} />}
                      variant="subtle"
                      color="blue"
                      onClick={() => handleTenderScrape(10)}
                      disabled={scrapingTenders}
                    >
                      10 Sayfa Tara (~4dk)
                    </Button>
                  </Group>

                  <Alert icon={<IconClock size={16} />} color="blue" variant="light">
                    <Text size="sm" fw={600}>
                      Otomatik Tarama Zamanları:
                    </Text>
                    <Text size="xs">• 08:00 - Sabah güncellemesi (5 sayfa)</Text>
                    <Text size="xs">• 14:00 - Öğlen güncellemesi (3 sayfa)</Text>
                    <Text size="xs">• 19:00 - Akşam güncellemesi (2 sayfa)</Text>
                  </Alert>
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          {/* YEDEKLEME TAB */}
          <Tabs.Panel value="backup" pt="xl">
            <Stack gap="lg">
              {/* Yedekleme Durumu */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      SON YEDEKLEME
                    </Text>
                    <ThemeIcon color="green" variant="light" size={30}>
                      <IconCheck size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg">
                    05.01.2025 03:00
                  </Text>
                  <Text size="xs" c="dimmed">
                    Otomatik yedekleme
                  </Text>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      VERİTABANI BOYUTU
                    </Text>
                    <ThemeIcon color="orange" variant="light" size={30}>
                      <IconDatabase size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg">
                    245 MB
                  </Text>
                  <Progress value={24.5} color="orange" size="xs" mt="xs" />
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      TOPLAM YEDEK
                    </Text>
                    <ThemeIcon color="violet" variant="light" size={30}>
                      <IconCloudDownload size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg">
                    12 Adet
                  </Text>
                  <Text size="xs" c="dimmed">
                    Son 30 gün
                  </Text>
                </Paper>
              </SimpleGrid>

              {/* Yedekleme İşlemleri */}
              <Card withBorder shadow="sm" p="lg">
                <Stack gap="md">
                  <Text size="lg" fw={600}>
                    💾 Yedekleme İşlemleri
                  </Text>

                  <Divider />

                  <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                    <Text size="sm">
                      <strong>Otomatik Yedekleme:</strong> Her gece saat 03:00'te otomatik yedekleme
                      alınır.
                    </Text>
                    <Text size="xs" c="dimmed" mt="xs">
                      Son 30 günlük yedekler saklanır, daha eskiler otomatik silinir.
                    </Text>
                  </Alert>

                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <Stack>
                      <Text size="sm" fw={600}>
                        Manuel Yedekleme
                      </Text>
                      <Button
                        leftSection={<IconDatabase size={16} />}
                        variant="filled"
                        color="green"
                      >
                        Şimdi Yedekle
                      </Button>
                      <Text size="xs" c="dimmed">
                        Tüm veritabanının yedeğini alır (faturalar, ihaleler, dökümanlar)
                      </Text>
                    </Stack>

                    <Stack>
                      <Text size="sm" fw={600}>
                        Yedekten Geri Yükle
                      </Text>
                      <Button
                        leftSection={<IconCloudDownload size={16} />}
                        variant="light"
                        color="orange"
                      >
                        Yedek Seç
                      </Button>
                      <Text size="xs" c="dimmed">
                        Mevcut yedeklerden birini seçip geri yükleyin
                      </Text>
                    </Stack>
                  </SimpleGrid>

                  <Divider />

                  <Stack gap="xs">
                    <Text size="sm" fw={600}>
                      Yedekleme Ayarları
                    </Text>
                    <Group>
                      <Switch label="Otomatik yedekleme aktif" defaultChecked />
                      <Select
                        placeholder="Yedekleme zamanı"
                        defaultValue="03:00"
                        data={['00:00', '03:00', '06:00', '12:00', '18:00']}
                        size="xs"
                        w={120}
                      />
                      <NumberInput
                        placeholder="Saklama süresi"
                        defaultValue={30}
                        min={7}
                        max={90}
                        suffix=" gün"
                        size="xs"
                        w={120}
                      />
                    </Group>
                  </Stack>
                </Stack>
              </Card>

              {/* Yedek Listesi */}
              <Card withBorder shadow="sm" p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="lg" fw={600}>
                      📦 Mevcut Yedekler
                    </Text>
                    <Button size="xs" variant="subtle" leftSection={<IconRefresh size={14} />}>
                      Yenile
                    </Button>
                  </Group>

                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Tarih</Table.Th>
                        <Table.Th>Tip</Table.Th>
                        <Table.Th>Boyut</Table.Th>
                        <Table.Th>İşlemler</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td>05.01.2025 03:00</Table.Td>
                        <Table.Td>
                          <Badge color="blue" size="sm">
                            Otomatik
                          </Badge>
                        </Table.Td>
                        <Table.Td>245 MB</Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon size="sm" variant="light" color="blue">
                              <IconCloudDownload size={14} />
                            </ActionIcon>
                            <ActionIcon size="sm" variant="light" color="orange">
                              <IconRefresh size={14} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>04.01.2025 15:30</Table.Td>
                        <Table.Td>
                          <Badge color="green" size="sm">
                            Manuel
                          </Badge>
                        </Table.Td>
                        <Table.Td>243 MB</Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon size="sm" variant="light" color="blue">
                              <IconCloudDownload size={14} />
                            </ActionIcon>
                            <ActionIcon size="sm" variant="light" color="orange">
                              <IconRefresh size={14} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          {/* VERİTABANI ÖZETİ TAB */}
          <Tabs.Panel value="database" pt="xl">
            <Stack gap="lg">
              {/* Supabase Erişim */}
              <Alert
                icon={<IconDatabase size={16} />}
                title="Detaylı Veritabanı Yönetimi"
                color="blue"
              >
                <Stack gap="sm">
                  <Text size="sm">
                    Tablo düzenleme, SQL sorguları ve detaylı veri yönetimi için Supabase
                    Dashboard'u kullanın.
                  </Text>
                  <Group>
                    <Button
                      leftSection={<IconDatabase size={16} />}
                      component="a"
                      href="https://app.supabase.com"
                      target="_blank"
                      color="green"
                    >
                      Supabase Dashboard'a Git
                    </Button>
                    <Text size="xs" c="dimmed">
                      (Yeni sekmede açılır)
                    </Text>
                  </Group>
                </Stack>
              </Alert>

              {/* Veritabanı İstatistikleri */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      TOPLAM FATURA
                    </Text>
                    <ThemeIcon color="blue" variant="light" size={30}>
                      <IconFileInvoice size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="xl">
                    {databaseStats?.invoices?.total || 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Manuel: {databaseStats?.invoices?.manual || 0} | Uyumsoft:{' '}
                    {databaseStats?.invoices?.uyumsoft || 0}
                  </Text>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      TOPLAM İHALE
                    </Text>
                    <ThemeIcon color="cyan" variant="light" size={30}>
                      <IconGavel size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="xl">
                    {databaseStats?.tenders?.total || 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Aktif: {databaseStats?.tenders?.active || 0} | Kapalı:{' '}
                    {databaseStats?.tenders?.closed || 0}
                  </Text>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      DÖKÜMAN
                    </Text>
                    <ThemeIcon color="violet" variant="light" size={30}>
                      <IconFileText size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="xl">
                    {databaseStats?.documents?.total || 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    PDF: {databaseStats?.documents?.pdf || 0} | Excel:{' '}
                    {databaseStats?.documents?.excel || 0}
                  </Text>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      VERİTABANI BOYUTU
                    </Text>
                    <ThemeIcon color="orange" variant="light" size={30}>
                      <IconDatabase size={16} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="xl">
                    {databaseStats?.database?.sizePretty || '0 MB'}
                  </Text>
                  <Progress
                    value={
                      databaseStats?.database?.size
                        ? (databaseStats.database.size / (1024 * 1024 * 1024)) * 100
                        : 0
                    }
                    color="orange"
                    size="xs"
                    mt="xs"
                  />
                </Paper>
              </SimpleGrid>

              {/* Tablo Bilgileri */}
              <Card withBorder shadow="sm" p="lg">
                <Stack gap="md">
                  <Text size="lg" fw={600}>
                    📊 Tablo Bilgileri
                  </Text>

                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Tablo Adı</Table.Th>
                        <Table.Th>Kayıt Sayısı</Table.Th>
                        <Table.Th>Boyut</Table.Th>
                        <Table.Th>Son Güncelleme</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {databaseStats?.tables?.map((table: any, index: number) => (
                        <Table.Tr key={table.name}>
                          <Table.Td>
                            <Group gap="xs">
                              {table.name.includes('invoice') ? (
                                <IconFileInvoice size={14} />
                              ) : table.name.includes('tender') ? (
                                <IconGavel size={14} />
                              ) : table.name.includes('document') ? (
                                <IconFileText size={14} />
                              ) : (
                                <IconDatabase size={14} />
                              )}
                              <Text fw={500}>{table.name}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>{table.count.toLocaleString('tr-TR')}</Table.Td>
                          <Table.Td>{databaseStats?.tableSizes?.[index]?.size || 'N/A'}</Table.Td>
                          <Table.Td>
                            {table.lastUpdate
                              ? dayjs(table.lastUpdate).format('DD.MM.YYYY HH:mm')
                              : '-'}
                          </Table.Td>
                        </Table.Tr>
                      )) || (
                        <Table.Tr>
                          <Table.Td colSpan={4} ta="center">
                            <Text c="dimmed">Veri yükleniyor...</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Card>

              {/* Hızlı Sorgular */}
              <Card withBorder shadow="sm" p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="lg" fw={600}>
                      🤖 AI ile Sorgulama
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconBrain size={14} />}
                      component="a"
                      href="/ai-chat"
                    >
                      AI Chat'e Git
                    </Button>
                  </Group>

                  <Alert icon={<IconSparkles size={16} />} color="violet" variant="light">
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>
                        AI Chat ile yapabilecekleriniz:
                      </Text>
                      <Text size="xs">• "Bu ay kaç fatura var?"</Text>
                      <Text size="xs">• "En yüksek tutarlı 5 faturayı göster"</Text>
                      <Text size="xs">• "Aktif ihale sayısı nedir?"</Text>
                      <Text size="xs">• "Tavuk kategorisinde toplam harcama?"</Text>
                      <Text size="xs">• "Son 7 günde eklenen ihaleler"</Text>
                    </Stack>
                  </Alert>

                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <Button
                      variant="light"
                      leftSection={<IconBrain size={16} />}
                      component="a"
                      href="/ai-chat?query=Bu ay kaç fatura var?"
                    >
                      Bu Ay Fatura Sayısı
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconBrain size={16} />}
                      component="a"
                      href="/ai-chat?query=Aktif ihale listesi"
                    >
                      Aktif İhaleler
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconBrain size={16} />}
                      component="a"
                      href="/ai-chat?query=En yüksek 5 fatura"
                    >
                      En Yüksek Faturalar
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconBrain size={16} />}
                      component="a"
                      href="/ai-chat?query=Kategori bazlı harcama raporu"
                    >
                      Kategori Raporu
                    </Button>
                  </SimpleGrid>
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {/* Son Senkronizasyon Logları */}
        <Card withBorder shadow="sm" p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="lg" fw={600}>
                📝 Son İşlem Logları
              </Text>
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconRefresh size={14} />}
                onClick={loadSyncLogs}
              >
                Yenile
              </Button>
            </Group>

            <Divider />

            {syncLogs.length > 0 ? (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tip</Table.Th>
                    <Table.Th>Durum</Table.Th>
                    <Table.Th>Başlangıç</Table.Th>
                    <Table.Th>Süre</Table.Th>
                    <Table.Th>Senkronize</Table.Th>
                    <Table.Th>Yeni</Table.Th>
                    <Table.Th>Hata</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {syncLogs.slice(0, 10).map((log, index) => (
                    <Table.Tr key={log.id || index}>
                      <Table.Td>
                        <Badge variant="light" color="blue" size="sm">
                          {log.sync_type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={
                            log.status === 'success'
                              ? 'green'
                              : log.status === 'running'
                                ? 'blue'
                                : 'red'
                          }
                          size="sm"
                        >
                          {log.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{dayjs(log.started_at).format('DD.MM HH:mm')}</Table.Td>
                      <Table.Td>
                        {log.finished_at
                          ? `${Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                          : '-'}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500} c="blue">
                          {log.invoices_synced || 0}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500} c="green">
                          {log.new_invoices || 0}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {log.error_message && (
                          <Tooltip label={log.error_message}>
                            <IconAlertCircle size={16} color="red" />
                          </Tooltip>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                Henüz log kaydı bulunmuyor
              </Text>
            )}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
