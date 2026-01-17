'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/config';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  SimpleGrid,
  ThemeIcon,
  Badge,
  Button,
  Paper,
  Loader,
  Progress,
  ActionIcon,
  Tooltip,
  Table,
  Timeline,
  RingProgress,
  Skeleton
} from '@mantine/core';
import {
  IconServer,
  IconDatabase,
  IconUsers,
  IconRefresh,
  IconCheck,
  IconX,
  IconSettings,
  IconFileText,
  IconActivity,
  IconCloudDownload,
  IconShieldLock,
  IconExternalLink,
  IconChevronRight,
  IconClock,
  IconTrendingUp,
  IconReceipt,
  IconBriefcase,
  IconUser,
  IconBug
} from '@tabler/icons-react';

interface AdminStats {
  tablolar: { ad: string; kayit: number }[];
  veritabani: { boyut: string; bytes: number };
  baglanti: { toplam: number; aktif: number; bekleyen: number };
  bugun: { fatura: number; ihale: number; cari: number; personel: number };
  sonAktiviteler: any[];
  performans: { responseTime: number; timestamp: string };
}

interface HealthData {
  status: string;
  database: { connected: boolean; responseTime: number; version: string };
  uptime: { formatted: string; days: number };
  api: { responseTime: number };
}

export default function AdminPage() {
  const API_URL = API_BASE_URL;
  
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch(`${API_URL}/api/database-stats/admin-stats`).then(r => r.json()).catch(() => null),
        fetch(`${API_URL}/api/database-stats/health-detailed`).then(r => r.json()).catch(() => null)
      ]);
      
      if (statsRes?.success) setStats(statsRes.data);
      if (healthRes?.success) setHealth(healthRes.data);
    } catch (err) {
      console.error('Veri alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Her 30 saniyede yenile
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const adminCards = [
    {
      id: 'kullanicilar',
      title: 'Kullanıcı Yönetimi',
      description: 'Kullanıcı ekleme, silme ve düzenleme',
      icon: IconUsers,
      color: 'blue',
      path: '/admin/kullanicilar',
      badge: null
    },
    {
      id: 'yetkiler',
      title: 'Yetki Yönetimi',
      description: 'Modül bazlı yetkilendirme ve roller',
      icon: IconShieldLock,
      color: 'violet',
      path: '/admin/yetkiler',
      badge: null
    },
    {
      id: 'loglar',
      title: 'İşlem Geçmişi',
      description: 'Kim ne zaman ne değiştirdi',
      icon: IconActivity,
      color: 'teal',
      path: '/admin/loglar',
      badge: null
    },
    {
      id: 'veri',
      title: 'Veri Yönetimi',
      description: 'Senkronizasyon, yedekleme, import/export',
      icon: IconCloudDownload,
      color: 'cyan',
      path: '/admin/sync',
      badge: null
    },
    {
      id: 'sistem',
      title: 'Sistem & Geliştirici',
      description: 'API Docs, loglar, sistem durumu',
      icon: IconServer,
      color: 'gray',
      path: '/admin/sistem',
      badge: null
    },
    {
      id: 'scraper',
      title: 'Scraper Dashboard',
      description: 'İhale scraper durumu ve yönetimi',
      icon: IconBug,
      color: 'grape',
      path: '/admin/scraper',
      badge: null
    }
  ];

  // DB boyutu yüzdesi (500MB limit varsayımı)
  const dbPercentage = stats ? Math.min((stats.veritabani.bytes / (500 * 1024 * 1024)) * 100, 100) : 0;

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Group gap="sm" mb={4}>
              <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'red', to: 'orange' }}>
                <IconShieldLock size={20} />
              </ThemeIcon>
              <Title order={1} size="h2">Admin Panel</Title>
            </Group>
            <Text c="dimmed">Sistem yönetimi ve yapılandırma</Text>
          </div>
          
          <Group>
            <Tooltip label="Yenile">
              <ActionIcon variant="light" size="lg" onClick={fetchData} loading={loading}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Badge size="lg" variant="light" color="red">Admin Only</Badge>
          </Group>
        </Group>

        {/* Sistem Durumu Kartları */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {/* Backend Status */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">Backend API</Text>
              <ThemeIcon variant="light" color={health?.status === 'healthy' ? 'green' : 'red'} size="sm" radius="xl">
                <IconServer size={14} />
              </ThemeIcon>
            </Group>
            {loading ? (
              <Skeleton height={24} width={80} />
            ) : health?.status === 'healthy' ? (
              <Group gap="xs">
                <IconCheck size={16} color="var(--mantine-color-green-6)" />
                <Text fw={600} c="green">Çalışıyor</Text>
              </Group>
            ) : (
              <Group gap="xs">
                <IconX size={16} color="var(--mantine-color-red-6)" />
                <Text fw={600} c="red">Bağlantı Yok</Text>
              </Group>
            )}
            {health && (
              <Text size="xs" c="dimmed" mt={4}>{health.api.responseTime}ms</Text>
            )}
          </Card>

          {/* Database Status */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">Veritabanı</Text>
              <ThemeIcon variant="light" color="cyan" size="sm" radius="xl">
                <IconDatabase size={14} />
              </ThemeIcon>
            </Group>
            {loading ? (
              <Skeleton height={24} width={80} />
            ) : health?.database.connected ? (
              <>
                <Group gap="xs">
                  <IconCheck size={16} color="var(--mantine-color-green-6)" />
                  <Text fw={600} c="green">Bağlı</Text>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>{health.database.responseTime}ms</Text>
              </>
            ) : (
              <Group gap="xs">
                <IconX size={16} color="var(--mantine-color-red-6)" />
                <Text fw={600} c="red">Bağlantı Yok</Text>
              </Group>
            )}
          </Card>

          {/* DB Boyutu */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">DB Boyutu</Text>
              <ThemeIcon variant="light" color="violet" size="sm" radius="xl">
                <IconDatabase size={14} />
              </ThemeIcon>
            </Group>
            {loading ? (
              <Skeleton height={24} width={80} />
            ) : (
              <>
                <Text fw={700} size="lg">{stats?.veritabani.boyut || '-'}</Text>
                <Progress value={dbPercentage} size="xs" mt={4} color={dbPercentage > 80 ? 'red' : 'blue'} />
              </>
            )}
          </Card>

          {/* Uptime */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">Uptime</Text>
              <ThemeIcon variant="light" color="orange" size="sm" radius="xl">
                <IconClock size={14} />
              </ThemeIcon>
            </Group>
            {loading ? (
              <Skeleton height={24} width={80} />
            ) : (
              <>
                <Text fw={700} size="lg">{health?.uptime.formatted || '-'}</Text>
                <Text size="xs" c="dimmed" mt={4}>{health?.uptime.days || 0} gün</Text>
              </>
            )}
          </Card>
        </SimpleGrid>

        {/* İkinci Satır - Bugünkü Aktivite */}
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>📊 Bugünkü Aktivite</Title>
            <Badge color="blue" variant="light">Canlı</Badge>
          </Group>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Group>
              <ThemeIcon size={40} radius="md" variant="light" color="green">
                <IconReceipt size={20} />
              </ThemeIcon>
              <div>
                <Text size="xl" fw={700}>{stats?.bugun.fatura || 0}</Text>
                <Text size="xs" c="dimmed">Yeni Fatura</Text>
              </div>
            </Group>
            <Group>
              <ThemeIcon size={40} radius="md" variant="light" color="blue">
                <IconBriefcase size={20} />
              </ThemeIcon>
              <div>
                <Text size="xl" fw={700}>{stats?.bugun.ihale || 0}</Text>
                <Text size="xs" c="dimmed">Yeni İhale</Text>
              </div>
            </Group>
            <Group>
              <ThemeIcon size={40} radius="md" variant="light" color="violet">
                <IconUsers size={20} />
              </ThemeIcon>
              <div>
                <Text size="xl" fw={700}>{stats?.bugun.cari || 0}</Text>
                <Text size="xs" c="dimmed">Yeni Cari</Text>
              </div>
            </Group>
            <Group>
              <ThemeIcon size={40} radius="md" variant="light" color="orange">
                <IconUser size={20} />
              </ThemeIcon>
              <div>
                <Text size="xl" fw={700}>{stats?.bugun.personel || 0}</Text>
                <Text size="xs" c="dimmed">Yeni Personel</Text>
              </div>
            </Group>
          </SimpleGrid>
        </Paper>

        {/* İki Kolon - Tablolar ve Yönetim */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {/* Tablo Kayıt Sayıları */}
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">🗄️ Veritabanı Tabloları</Title>
            {loading ? (
              <Stack gap="xs">
                {[1,2,3,4,5].map(i => <Skeleton key={i} height={30} />)}
              </Stack>
            ) : (
              <Table>
                <Table.Tbody>
                  {stats?.tablolar.slice(0, 8).map((tablo, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{tablo.ad}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Badge variant="light" color="gray">{tablo.kayit.toLocaleString()}</Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>

          {/* Bağlantı Durumu */}
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">🔗 Bağlantı Durumu</Title>
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm">Toplam Bağlantı</Text>
                <Badge size="lg">{stats?.baglanti.toplam || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Aktif</Text>
                <Badge size="lg" color="green">{stats?.baglanti.aktif || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Bekleyen</Text>
                <Badge size="lg" color="yellow">{stats?.baglanti.bekleyen || 0}</Badge>
              </Group>
              {health?.database.version && (
                <>
                  <Text size="xs" c="dimmed" mt="md">Veritabanı Versiyonu</Text>
                  <Text size="sm" fw={500}>{health.database.version}</Text>
                </>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Yönetim Kartları */}
        <div>
          <Title order={3} mb="md">🔧 Yönetim</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {adminCards.map((card) => (
              <Card key={card.id} padding="xl" radius="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <ThemeIcon size={50} radius="md" variant="light" color={card.color}>
                      <card.icon size={28} />
                    </ThemeIcon>
                    {card.badge ? (
                      <Badge color="gray" variant="light">{card.badge}</Badge>
                    ) : (
                      <ActionIcon variant="subtle" color="gray">
                        <IconChevronRight size={16} />
                      </ActionIcon>
                    )}
                  </Group>

                  <div>
                    <Title order={4} mb={4}>{card.title}</Title>
                    <Text c="dimmed" size="sm">{card.description}</Text>
                  </div>

                  <Button
                    variant="light"
                    color={card.color}
                    fullWidth
                    leftSection={<IconSettings size={16} />}
                    component="a"
                    href={card.path}
                    disabled={!!card.badge}
                  >
                    {card.badge ? 'Yakında' : 'Yönet'}
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </div>

        {/* Hızlı Linkler */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={3} mb="md">🔗 Hızlı Erişim</Title>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Button 
              variant="light" 
              leftSection={<IconFileText size={16} />}
              rightSection={<IconExternalLink size={14} />}
              onClick={() => window.open(`${API_URL}/api-docs`, '_blank')}
            >
              API Docs
            </Button>
            <Button 
              variant="light" 
              color="green"
              leftSection={<IconActivity size={16} />}
              rightSection={<IconExternalLink size={14} />}
              onClick={() => window.open(`${API_URL}/health`, '_blank')}
            >
              Health Check
            </Button>
            <Button 
              variant="light" 
              color="cyan"
              leftSection={<IconCloudDownload size={16} />}
              component="a"
              href="/admin/sync"
            >
              Veri Sync
            </Button>
            <Button 
              variant="light" 
              color="gray"
              leftSection={<IconServer size={16} />}
              component="a"
              href="/admin/sistem"
            >
              Sistem Logları
            </Button>
          </SimpleGrid>
        </Paper>

        {/* Son Güncelleme */}
        <Text size="xs" c="dimmed" ta="center">
          Son güncelleme: {stats?.performans.timestamp ? new Date(stats.performans.timestamp).toLocaleString('tr-TR') : '-'}
          {stats?.performans.responseTime && ` (${stats.performans.responseTime}ms)`}
        </Text>
      </Stack>
    </Container>
  );
}
