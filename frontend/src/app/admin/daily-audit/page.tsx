'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconChefHat,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconCoin,
  IconFileAnalytics,
  IconFilter,
  IconList,
  IconPlayerPlay,
  IconRefresh,
  IconRobot,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

// ============================================================================
// TYPES
// ============================================================================

interface AuditStats {
  toplam_denetim: number;
  toplam_sorun: number;
  otomatik_duzeltilen: number;
  manuel_duzeltilen: number;
  bekleyen: number;
  kritik_sorun: number;
  en_cok_sorun_kategori: string | null;
  en_cok_sorun_tipi: string | null;
}

interface AuditRun {
  run_id: number;
  baslangic_zamani: string;
  bitis_zamani: string | null;
  durum: 'running' | 'completed' | 'failed';
  toplam_sorun: number;
  otomatik_duzeltilen: number;
  onay_bekleyen: number;
  recete_sorun: number;
  menu_sorun: number;
  fiyat_sorun: number;
  ai_genel_degerlendirme: string | null;
  sure_saniye: number | null;
  kritik_sayisi: number;
  bekleyen_sayisi: number;
}

interface AuditFinding {
  id: number;
  kategori: 'recete' | 'menu' | 'fiyat';
  sorun_tipi: string;
  onem_seviyesi: 'kritik' | 'orta' | 'dusuk';
  ilgili_tablo: string | null;
  ilgili_id: number | null;
  ilgili_kod: string | null;
  ilgili_ad: string | null;
  aciklama: string;
  detay_json: Record<string, unknown>;
  ai_analizi: string | null;
  ai_kok_neden: string | null;
  onerilen_duzeltme_json: Record<string, unknown> | null;
  otomatik_duzeltme_uygun: boolean;
  durum: 'beklemede' | 'onaylandi' | 'reddedildi' | 'duzeltildi' | 'otomatik_duzeltildi';
  created_at: string;
  audit_tarihi: string;
}

interface KategoriDagilim {
  kategori: 'recete' | 'menu' | 'fiyat';
  sayi: number;
  kritik: number;
}

interface StatsResponse {
  success: boolean;
  stats: AuditStats;
  latestRun: AuditRun | null;
  pendingCount: number;
  kategoriDagilimi: KategoriDagilim[];
  trend: Array<{ tarih: string; sorun_sayisi: number; otomatik: number; bekleyen: number }>;
}

// ============================================================================
// HELPERS
// ============================================================================

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getKategoriIcon = (kategori: string) => {
  switch (kategori) {
    case 'recete':
      return <IconChefHat size={16} />;
    case 'menu':
      return <IconList size={16} />;
    case 'fiyat':
      return <IconCoin size={16} />;
    default:
      return <IconFileAnalytics size={16} />;
  }
};

const getKategoriLabel = (kategori: string) => {
  switch (kategori) {
    case 'recete':
      return 'Reçete';
    case 'menu':
      return 'Menü';
    case 'fiyat':
      return 'Fiyat';
    default:
      return kategori;
  }
};

const getOnemColor = (onem: string) => {
  switch (onem) {
    case 'kritik':
      return 'red';
    case 'orta':
      return 'yellow';
    case 'dusuk':
      return 'blue';
    default:
      return 'gray';
  }
};

const getDurumColor = (durum: string) => {
  switch (durum) {
    case 'beklemede':
      return 'yellow';
    case 'onaylandi':
    case 'duzeltildi':
    case 'otomatik_duzeltildi':
      return 'green';
    case 'reddedildi':
      return 'red';
    default:
      return 'gray';
  }
};

const getDurumLabel = (durum: string) => {
  switch (durum) {
    case 'beklemede':
      return 'Beklemede';
    case 'onaylandi':
      return 'Onaylandı';
    case 'duzeltildi':
      return 'Düzeltildi';
    case 'otomatik_duzeltildi':
      return 'Otomatik Düzeltildi';
    case 'reddedildi':
      return 'Reddedildi';
    default:
      return durum;
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function DailyAuditPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [kategoriFilter, setKategoriFilter] = useState<string>('all');
  const [durumFilter, setDurumFilter] = useState<string>('all');
  
  // Modal state
  const [detailModal, setDetailModal] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<AuditFinding | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/daily-audit/stats`);
      const data = await res.json();
      if (data.success) {
        setStats(data);
      }
    } catch (error) {
      console.error('Stats fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch findings
  const fetchFindings = useCallback(async () => {
    setFindingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (kategoriFilter !== 'all') params.append('kategori', kategoriFilter);
      if (durumFilter !== 'all') params.append('durum', durumFilter);
      params.append('limit', '100');

      const res = await fetch(`${API_BASE_URL}/api/daily-audit/findings?${params}`);
      const data = await res.json();
      if (data.success) {
        setFindings(data.data);
      }
    } catch (error) {
      console.error('Findings fetch error:', error);
    } finally {
      setFindingsLoading(false);
    }
  }, [kategoriFilter, durumFilter]);

  // Run audit
  const runAudit = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/daily-audit/run`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.success) {
        notifications.show({
          title: 'Denetim Tamamlandı',
          message: `${data.stats?.recete + data.stats?.menu + data.stats?.fiyat || 0} sorun tespit edildi`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchStats();
        fetchFindings();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Denetim başlatılamadı',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası',
        color: 'red',
      });
    } finally {
      setRunning(false);
    }
  };

  // Approve finding
  const approveFinding = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/daily-audit/findings/${id}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.success) {
        notifications.show({
          title: 'Onaylandı',
          message: 'Düzeltme uygulandı',
          color: 'green',
        });
        setDetailModal(false);
        fetchStats();
        fetchFindings();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error,
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Sunucu hatası', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  // Reject finding
  const rejectFinding = async (id: number) => {
    if (!rejectReason.trim()) {
      notifications.show({ title: 'Uyarı', message: 'Red nedeni giriniz', color: 'yellow' });
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/daily-audit/findings/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neden: rejectReason }),
      });
      const data = await res.json();
      
      if (data.success) {
        notifications.show({
          title: 'Reddedildi',
          message: 'Bulgu reddedildi',
          color: 'blue',
        });
        setDetailModal(false);
        setRejectReason('');
        fetchStats();
        fetchFindings();
      } else {
        notifications.show({ title: 'Hata', message: data.error, color: 'red' });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Sunucu hatası', color: 'red' });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'findings') {
      fetchFindings();
    }
  }, [activeTab, fetchFindings]);

  if (loading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Group>
          <ActionIcon variant="subtle" component={Link} href="/admin">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Title order={2}>AI Günlük Denetim</Title>
            <Text size="sm" c="dimmed">
              Reçete, menü ve fiyat tutarsızlıklarını tespit ve düzeltme
            </Text>
          </div>
        </Group>
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={() => {
              fetchStats();
              if (activeTab === 'findings') fetchFindings();
            }}
          >
            Yenile
          </Button>
          <Button
            leftSection={running ? <Loader size={16} color="white" /> : <IconPlayerPlay size={16} />}
            onClick={runAudit}
            disabled={running}
            color="violet"
          >
            {running ? 'Çalışıyor...' : 'Denetimi Çalıştır'}
          </Button>
        </Group>
      </Group>

      {/* Stats Overview */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Toplam Sorun
              </Text>
              <Text size="xl" fw={700}>
                {stats?.stats?.toplam_sorun || 0}
              </Text>
            </div>
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconFileAnalytics size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Otomatik Düzeltilen
              </Text>
              <Text size="xl" fw={700} c="green">
                {stats?.stats?.otomatik_duzeltilen || 0}
              </Text>
            </div>
            <ThemeIcon size="lg" variant="light" color="green">
              <IconRobot size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Onay Bekleyen
              </Text>
              <Text size="xl" fw={700} c="yellow">
                {stats?.pendingCount || 0}
              </Text>
            </div>
            <ThemeIcon size="lg" variant="light" color="yellow">
              <IconClock size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Kritik Sorun
              </Text>
              <Text size="xl" fw={700} c="red">
                {stats?.stats?.kritik_sorun || 0}
              </Text>
            </div>
            <ThemeIcon size="lg" variant="light" color="red">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconFileAnalytics size={16} />}>
            Genel Bakış
          </Tabs.Tab>
          <Tabs.Tab value="findings" leftSection={<IconList size={16} />}>
            Bulgular
            {(stats?.pendingCount || 0) > 0 && (
              <Badge size="xs" ml={6} color="yellow">
                {stats?.pendingCount}
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
            Ayarlar
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {/* Son Denetim */}
            <Card withBorder>
              <Card.Section withBorder inheritPadding py="xs">
                <Text fw={600}>Son Denetim</Text>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                {stats?.latestRun ? (
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Tarih:</Text>
                      <Text size="sm">{formatDate(stats.latestRun.baslangic_zamani)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Durum:</Text>
                      <Badge color={stats.latestRun.durum === 'completed' ? 'green' : 'yellow'}>
                        {stats.latestRun.durum === 'completed' ? 'Tamamlandı' : 'Devam Ediyor'}
                      </Badge>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Süre:</Text>
                      <Text size="sm">{stats.latestRun.sure_saniye ? `${stats.latestRun.sure_saniye}s` : '-'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Toplam Sorun:</Text>
                      <Text size="sm" fw={600}>{stats.latestRun.toplam_sorun}</Text>
                    </Group>
                    {stats.latestRun.ai_genel_degerlendirme && (
                      <Paper p="sm" bg="gray.0" radius="sm">
                        <Text size="xs" c="dimmed" mb={4}>AI Değerlendirmesi:</Text>
                        <Text size="sm">{stats.latestRun.ai_genel_degerlendirme}</Text>
                      </Paper>
                    )}
                  </Stack>
                ) : (
                  <Text c="dimmed" ta="center" py="xl">
                    Henüz denetim yapılmamış
                  </Text>
                )}
              </Card.Section>
            </Card>

            {/* Kategori Dağılımı */}
            <Card withBorder>
              <Card.Section withBorder inheritPadding py="xs">
                <Text fw={600}>Kategori Dağılımı</Text>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                {stats?.kategoriDagilimi && stats.kategoriDagilimi.length > 0 ? (
                  <Stack gap="md">
                    {stats.kategoriDagilimi.map((k) => (
                      <div key={k.kategori}>
                        <Group justify="space-between" mb={4}>
                          <Group gap="xs">
                            {getKategoriIcon(k.kategori)}
                            <Text size="sm">{getKategoriLabel(k.kategori)}</Text>
                          </Group>
                          <Group gap="xs">
                            <Text size="sm" fw={600}>{k.sayi}</Text>
                            {k.kritik > 0 && (
                              <Badge size="xs" color="red">{k.kritik} kritik</Badge>
                            )}
                          </Group>
                        </Group>
                        <Progress
                          value={(k.sayi / (stats?.stats?.toplam_sorun || 1)) * 100}
                          color={k.kategori === 'recete' ? 'violet' : k.kategori === 'menu' ? 'blue' : 'green'}
                          size="sm"
                        />
                      </div>
                    ))}
                  </Stack>
                ) : (
                  <Text c="dimmed" ta="center" py="xl">
                    Veri yok
                  </Text>
                )}
              </Card.Section>
            </Card>

            {/* Son 7 Gün Trendi */}
            <Card withBorder style={{ gridColumn: 'span 2' }}>
              <Card.Section withBorder inheritPadding py="xs">
                <Text fw={600}>Son 7 Gün Trendi</Text>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                {stats?.trend && stats.trend.length > 0 ? (
                  <Group gap="lg" justify="center">
                    {stats.trend.map((t) => (
                      <Stack key={t.tarih} gap={4} align="center">
                        <RingProgress
                          size={60}
                          thickness={6}
                          roundCaps
                          sections={[
                            { value: t.otomatik, color: 'green' },
                            { value: t.bekleyen, color: 'yellow' },
                          ]}
                          label={
                            <Text size="xs" ta="center" fw={600}>
                              {t.sorun_sayisi}
                            </Text>
                          }
                        />
                        <Text size="xs" c="dimmed">
                          {new Date(t.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                        </Text>
                      </Stack>
                    ))}
                  </Group>
                ) : (
                  <Text c="dimmed" ta="center" py="xl">
                    Henüz trend verisi yok
                  </Text>
                )}
              </Card.Section>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        {/* Findings Tab */}
        <Tabs.Panel value="findings" pt="md">
          {/* Filters */}
          <Group mb="md">
            <SegmentedControl
              value={kategoriFilter}
              onChange={setKategoriFilter}
              data={[
                { label: 'Tümü', value: 'all' },
                { label: 'Reçete', value: 'recete' },
                { label: 'Menü', value: 'menu' },
                { label: 'Fiyat', value: 'fiyat' },
              ]}
            />
            <SegmentedControl
              value={durumFilter}
              onChange={setDurumFilter}
              data={[
                { label: 'Tümü', value: 'all' },
                { label: 'Beklemede', value: 'beklemede' },
                { label: 'Düzeltildi', value: 'duzeltildi' },
                { label: 'Reddedildi', value: 'reddedildi' },
              ]}
            />
          </Group>

          {/* Findings Table */}
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Kategori</Table.Th>
                  <Table.Th>Önem</Table.Th>
                  <Table.Th>Sorun</Table.Th>
                  <Table.Th>İlgili Kayıt</Table.Th>
                  <Table.Th>Durum</Table.Th>
                  <Table.Th>Tarih</Table.Th>
                  <Table.Th>İşlem</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {findingsLoading ? (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Center py="xl">
                        <Loader size="sm" />
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : findings.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text c="dimmed" ta="center" py="xl">
                        Bulgu bulunamadı
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  findings.map((f) => (
                    <Table.Tr key={f.id}>
                      <Table.Td>
                        <Group gap="xs">
                          {getKategoriIcon(f.kategori)}
                          <Text size="sm">{getKategoriLabel(f.kategori)}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getOnemColor(f.onem_seviyesi)} size="sm">
                          {f.onem_seviyesi}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={f.aciklama} multiline w={300}>
                          <Text size="sm" lineClamp={1} style={{ maxWidth: 300 }}>
                            {f.aciklama}
                          </Text>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {f.ilgili_ad || f.ilgili_kod || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getDurumColor(f.durum)} size="sm">
                          {getDurumLabel(f.durum)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {formatDate(f.created_at)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Tooltip label="Detay">
                            <ActionIcon
                              variant="light"
                              size="sm"
                              onClick={() => {
                                setSelectedFinding(f);
                                setDetailModal(true);
                              }}
                            >
                              <IconFilter size={14} />
                            </ActionIcon>
                          </Tooltip>
                          {f.durum === 'beklemede' && (
                            <>
                              <Tooltip label="Onayla">
                                <ActionIcon
                                  variant="light"
                                  color="green"
                                  size="sm"
                                  onClick={() => approveFinding(f.id)}
                                >
                                  <IconCheck size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Reddet">
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedFinding(f);
                                    setDetailModal(true);
                                  }}
                                >
                                  <IconX size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>

        {/* Settings Tab */}
        <Tabs.Panel value="settings" pt="md">
          <Card withBorder>
            <Card.Section withBorder inheritPadding py="xs">
              <Text fw={600}>Denetim Zamanlaması</Text>
            </Card.Section>
            <Card.Section inheritPadding py="md">
              <Stack gap="sm">
                <Group>
                  <ThemeIcon variant="light" color="violet">
                    <IconClock size={16} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" fw={500}>Günlük Denetim</Text>
                    <Text size="xs" c="dimmed">Her gün saat 06:00'da otomatik çalışır (Europe/Istanbul)</Text>
                  </div>
                </Group>
                <Text size="sm" c="dimmed">
                  Denetim yapılandırması veritabanında saklanır. Gelişmiş ayarlar için veritabanı tablosunu düzenleyin.
                </Text>
              </Stack>
            </Card.Section>
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Detail Modal */}
      <Modal
        opened={detailModal}
        onClose={() => {
          setDetailModal(false);
          setRejectReason('');
        }}
        title="Bulgu Detayı"
        size="lg"
      >
        {selectedFinding && (
          <Stack gap="md">
            <Group>
              <Badge color={getOnemColor(selectedFinding.onem_seviyesi)}>
                {selectedFinding.onem_seviyesi}
              </Badge>
              <Badge color={getDurumColor(selectedFinding.durum)}>
                {getDurumLabel(selectedFinding.durum)}
              </Badge>
              <Badge variant="light">
                {getKategoriLabel(selectedFinding.kategori)}
              </Badge>
            </Group>

            <Paper p="sm" withBorder>
              <Text size="sm" fw={500} mb={4}>Açıklama:</Text>
              <Text size="sm">{selectedFinding.aciklama}</Text>
            </Paper>

            {selectedFinding.ai_analizi && (
              <Paper p="sm" bg="blue.0" radius="sm">
                <Text size="sm" fw={500} mb={4}>AI Analizi:</Text>
                <Text size="sm">{selectedFinding.ai_analizi}</Text>
              </Paper>
            )}

            {selectedFinding.ai_kok_neden && (
              <Paper p="sm" bg="yellow.0" radius="sm">
                <Text size="sm" fw={500} mb={4}>Kök Neden:</Text>
                <Text size="sm">{selectedFinding.ai_kok_neden}</Text>
              </Paper>
            )}

            {selectedFinding.onerilen_duzeltme_json && (
              <Paper p="sm" bg="green.0" radius="sm">
                <Text size="sm" fw={500} mb={4}>Önerilen Düzeltme:</Text>
                <Text size="sm" component="pre" style={{ whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(selectedFinding.onerilen_duzeltme_json, null, 2)}
                </Text>
              </Paper>
            )}

            {selectedFinding.durum === 'beklemede' && (
              <>
                <Textarea
                  label="Red Nedeni (isteğe bağlı)"
                  placeholder="Neden reddediyorsunuz?"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  minRows={2}
                />

                <Group justify="flex-end">
                  <Button
                    variant="light"
                    color="red"
                    onClick={() => rejectFinding(selectedFinding.id)}
                    loading={actionLoading}
                    leftSection={<IconCircleX size={16} />}
                  >
                    Reddet
                  </Button>
                  <Button
                    color="green"
                    onClick={() => approveFinding(selectedFinding.id)}
                    loading={actionLoading}
                    leftSection={<IconCircleCheck size={16} />}
                  >
                    Onayla ve Uygula
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
