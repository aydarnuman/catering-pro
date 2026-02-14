'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Collapse,
  Container,
  Group,
  Paper,
  Progress,
  rem,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconActivity,
  IconBriefcase,
  IconBug,
  IconCheck,
  IconClock,
  IconCloudDownload,
  IconDatabase,
  IconExternalLink,
  IconFileText,
  IconFlame,
  IconLock,
  IconReceipt,
  IconRefresh,
  IconServer,
  IconShieldLock,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { adminAPI } from '@/lib/api/services/admin';

interface AdminStats {
  tablolar: { ad: string; kayit: number }[];
  veritabani: { boyut: string; bytes: number };
  baglanti: { toplam: number; aktif: number; bekleyen: number };
  bugun: { fatura: number; ihale: number; cari: number; personel: number };
  sonAktiviteler: Array<Record<string, unknown>>;
  performans: { responseTime: number; timestamp: string };
}

interface HealthData {
  status: string;
  database: { connected: boolean; responseTime: number; version: string };
  uptime: { formatted: string; days: number };
  api: { responseTime: number };
}

export default function AdminPage() {
  // API_URL kaldırıldı - adminAPI kullanılıyor (özel endpoint'ler için API_BASE_URL kullanılıyor)
  const router = useRouter();
  const { isSuperAdmin } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityOpen, { toggle: toggleActivity }] = useDisclosure(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, healthRes] = await Promise.all([
        adminAPI.getAdminStats().catch(() => null),
        adminAPI.getHealthDetailed().catch(() => null),
      ]);

      if (statsRes?.success) setStats(statsRes.data);
      if (healthRes?.success) setHealth(healthRes.data);
    } catch (err) {
      console.error('Veri alınamadı:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Her 60 saniyede yenile — tab görünür değilse polling'i duraklat
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!interval) {
        interval = setInterval(fetchData, 60000);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchData();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData]);

  // Kategorize edilmiş admin modülleri
  const adminCategories = {
    guvenlik: {
      label: '🔐 Güvenlik',
      color: 'blue',
      items: [
        {
          id: 'kullanicilar',
          title: 'Kullanıcılar',
          description: 'Kullanıcı ekleme, silme, düzenleme ve yetki atama işlemleri',
          icon: IconUsers,
          color: 'blue',
          path: '/admin/kullanicilar',
          stat: null,
        },
        {
          id: 'yetkiler',
          title: 'Yetkiler',
          description: 'Modül bazlı yetkilendirme, rol tanımlama ve erişim kontrolü',
          icon: IconShieldLock,
          color: 'violet',
          path: '/admin/yetkiler',
          stat: null,
        },
        {
          id: 'yetki-sablonlari',
          title: 'Yetki Şablonları',
          description: 'Önceden tanımlı yetki profilleri oluşturma ve yönetimi',
          icon: IconShieldLock,
          color: 'grape',
          path: '/admin/yetki-sablonlari',
          stat: null,
        },
        {
          id: 'ip-management',
          title: 'IP Erişim Yönetimi',
          description: 'IP whitelist ve blacklist kuralları - Erişim kontrolü',
          icon: IconLock,
          color: 'orange',
          path: '/admin/ip-management',
          stat: null,
        },
        {
          id: 'loglar',
          title: 'İşlem Logları',
          description: 'Tüm sistem aktivitelerinin detaylı kaydı - Kim, ne zaman, ne yaptı',
          icon: IconActivity,
          color: 'teal',
          path: '/admin/loglar',
          stat: null,
        },
      ],
    },
    sistem: {
      label: '⚙️ Sistem',
      color: 'cyan',
      items: [
        {
          id: 'veri',
          title: 'Veri Yönetimi',
          description: 'Uyumsoft senkronizasyonu, veritabanı yedekleme, import/export işlemleri',
          icon: IconCloudDownload,
          color: 'cyan',
          path: '/admin/sync',
          stat: null,
        },
        {
          id: 'sistem',
          title: 'Geliştirici Araçları',
          description: 'Swagger API Docs, sistem logları, performans metrikleri',
          icon: IconServer,
          color: 'gray',
          path: '/admin/sistem',
          stat: null,
        },
      ],
    },
    otomasyon: {
      label: '🤖 AI & Otomasyon',
      color: 'grape',
      items: [
        {
          id: 'scraper',
          title: 'İhale Scraper',
          description: 'ihalebul.com otomatik tarama, döküman indirme ve analiz durumu',
          icon: IconBug,
          color: 'grape',
          path: '/admin/scraper',
          stat: null,
        },
        {
          id: 'model-egitimi',
          title: 'Model Eğitimi',
          description: 'Azure DI model eğitim durumu, düzeltme istatistikleri ve manuel eğitim tetikleme',
          icon: IconDatabase,
          color: 'cyan',
          path: '/admin/model-egitimi',
          stat: null,
        },
      ],
    },
  };

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
              <Title order={1} size="h2">
                Admin Panel
              </Title>
            </Group>
            <Text c="dimmed">Sistem yönetimi ve yapılandırma</Text>
          </div>

          <Group>
            <Tooltip label="Yenile">
              <ActionIcon variant="light" size="lg" onClick={fetchData} loading={loading}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>

            {/* 📊 Bugünkü Aktivite Button */}
            <Tooltip label={activityOpen ? 'Aktiviteyi Kapat' : 'Bugünkü Aktivite'}>
              <ActionIcon
                size="lg"
                radius="md"
                variant={activityOpen ? 'filled' : 'light'}
                color="blue"
                onClick={toggleActivity}
                style={{
                  transition: 'all 0.3s ease',
                }}
              >
                <IconActivity size={20} />
              </ActionIcon>
            </Tooltip>

            {/* 🔥 God Mode Button - Super Admin Only */}
            {isSuperAdmin && (
              <Button
                size="sm"
                radius="md"
                variant="gradient"
                gradient={{ from: 'red', to: 'orange' }}
                leftSection={<IconFlame size={18} />}
                onClick={() => router.push('/admin/god-mode')}
                style={{
                  boxShadow: '0 0 15px rgba(255, 71, 87, 0.4)',
                  transition: 'all 0.3s ease',
                }}
              >
                GOD MODE
              </Button>
            )}

            <Badge size="lg" variant="light" color="red">
              Admin Only
            </Badge>
          </Group>
        </Group>

        {/* 📊 Bugünkü Aktivite Panel - Header'dan açılır */}
        <Collapse in={activityOpen}>
          <Paper p="md" radius="md" className="standard-card">
            <Group justify="space-between" mb="md">
              <Text fw={600}>📊 Bugünkü Aktivite</Text>
              <Badge color="blue" variant="light">
                Canlı
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              <Group>
                <ThemeIcon size={40} radius="md" variant="light" color="green">
                  <IconReceipt size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>
                    {stats?.bugun.fatura || 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Yeni Fatura
                  </Text>
                </div>
              </Group>
              <Group>
                <ThemeIcon size={40} radius="md" variant="light" color="blue">
                  <IconBriefcase size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>
                    {stats?.bugun.ihale || 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Yeni İhale
                  </Text>
                </div>
              </Group>
              <Group>
                <ThemeIcon size={40} radius="md" variant="light" color="violet">
                  <IconUsers size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>
                    {stats?.bugun.cari || 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Yeni Cari
                  </Text>
                </div>
              </Group>
              <Group>
                <ThemeIcon size={40} radius="md" variant="light" color="orange">
                  <IconUser size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>
                    {stats?.bugun.personel || 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Yeni Personel
                  </Text>
                </div>
              </Group>
            </SimpleGrid>
          </Paper>
        </Collapse>

        {/* 🔧 Yönetim - Tab Bar + Kompakt Kartlar */}
        <Paper p="lg" radius="md" className="standard-card">
          <Title order={3} mb="md">
            🔧 Yönetim
          </Title>

          <Tabs defaultValue="guvenlik" variant="pills" radius="md">
            <Tabs.List mb="md" style={{ gap: rem(8) }}>
              {Object.entries(adminCategories).map(([key, category]) => (
                <Tabs.Tab
                  key={key}
                  value={key}
                  leftSection={<Text size="sm">{category.label.split(' ')[0]}</Text>}
                  style={{ fontWeight: 500 }}
                >
                  {category.label.split(' ').slice(1).join(' ')}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {Object.entries(adminCategories).map(([key, category]) => (
              <Tabs.Panel key={key} value={key}>
                <SimpleGrid cols={{ base: 1, sm: 2, md: category.items.length }} spacing="md">
                  {category.items.map((item) => (
                    <Tooltip key={item.id} label={item.description} position="bottom" withArrow multiline w={220}>
                      <UnstyledButton component="a" href={item.path} style={{ width: '100%' }}>
                        <Card padding="lg" radius="md" className="standard-card-hover">
                          <Stack gap="sm" align="center">
                            <ThemeIcon size={50} radius="xl" variant="light" color={item.color}>
                              <item.icon size={26} />
                            </ThemeIcon>
                            <div style={{ textAlign: 'center' }}>
                              <Text fw={600} size="sm">
                                {item.title}
                              </Text>
                              {item.stat && (
                                <Badge size="sm" variant="light" color={item.color} mt={4}>
                                  {item.stat}
                                </Badge>
                              )}
                            </div>
                          </Stack>
                        </Card>
                      </UnstyledButton>
                    </Tooltip>
                  ))}
                </SimpleGrid>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Paper>

        {/* Sistem Durumu Kartları */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {/* Backend Status */}
          <Card padding="lg" radius="md" className="stat-card">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                Backend API
              </Text>
              <ThemeIcon variant="light" color={health?.status === 'healthy' ? 'green' : 'red'} size="sm" radius="xl">
                <IconServer size={14} />
              </ThemeIcon>
            </Group>
            {loading ? (
              <Skeleton height={24} width={80} />
            ) : health?.status === 'healthy' ? (
              <Group gap="xs">
                <IconCheck size={16} color="var(--mantine-color-green-6)" />
                <Text fw={600} c="green">
                  Çalışıyor
                </Text>
              </Group>
            ) : (
              <Group gap="xs">
                <IconX size={16} color="var(--mantine-color-red-6)" />
                <Text fw={600} c="red">
                  Bağlantı Yok
                </Text>
              </Group>
            )}
            {health && (
              <Text size="xs" c="dimmed" mt={4}>
                {health.api.responseTime}ms
              </Text>
            )}
          </Card>

          {/* Database Status */}
          <Card padding="lg" radius="md" className="stat-card">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                Veritabanı
              </Text>
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
                  <Text fw={600} c="green">
                    Bağlı
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  {health.database.responseTime}ms
                </Text>
              </>
            ) : (
              <Group gap="xs">
                <IconX size={16} color="var(--mantine-color-red-6)" />
                <Text fw={600} c="red">
                  Bağlantı Yok
                </Text>
              </Group>
            )}
          </Card>

          {/* DB Boyutu */}
          <Card padding="lg" radius="md" className="stat-card">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                DB Boyutu
              </Text>
              <ThemeIcon variant="light" color="violet" size="sm" radius="xl">
                <IconDatabase size={14} />
              </ThemeIcon>
            </Group>
            {loading ? (
              <Skeleton height={24} width={80} />
            ) : (
              <>
                <Text fw={700} size="lg">
                  {stats?.veritabani.boyut || '-'}
                </Text>
                <Progress value={dbPercentage} size="xs" mt={4} color={dbPercentage > 80 ? 'red' : 'blue'} />
              </>
            )}
          </Card>

          {/* Uptime */}
          <Card padding="lg" radius="md" className="stat-card">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                Uptime
              </Text>
              <ThemeIcon variant="light" color="orange" size="sm" radius="xl">
                <IconClock size={14} />
              </ThemeIcon>
            </Group>
            {loading ? (
              <Skeleton height={24} width={80} />
            ) : (
              <>
                <Text fw={700} size="lg">
                  {health?.uptime.formatted || '-'}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  {health?.uptime.days || 0} gün
                </Text>
              </>
            )}
          </Card>
        </SimpleGrid>

        {/* İki Kolon - Tablolar ve Yönetim */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {/* Tablo Kayıt Sayıları */}
          <Paper p="lg" radius="md" className="standard-card">
            <Title order={4} mb="md">
              🗄️ Veritabanı Tabloları
            </Title>
            {loading ? (
              <Stack gap="xs">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} height={30} />
                ))}
              </Stack>
            ) : (
              <Table>
                <Table.Tbody>
                  {stats?.tablolar.slice(0, 8).map((tablo) => (
                    <Table.Tr key={tablo.ad}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {tablo.ad}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Badge variant="light" color="gray">
                          {tablo.kayit.toLocaleString()}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>

          {/* Bağlantı Durumu */}
          <Paper p="lg" radius="md" className="standard-card">
            <Title order={4} mb="md">
              🔗 Bağlantı Durumu
            </Title>
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm">Toplam Bağlantı</Text>
                <Badge size="lg">{stats?.baglanti.toplam || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Aktif</Text>
                <Badge size="lg" color="green">
                  {stats?.baglanti.aktif || 0}
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Bekleyen</Text>
                <Badge size="lg" color="yellow">
                  {stats?.baglanti.bekleyen || 0}
                </Badge>
              </Group>
              {health?.database.version && (
                <>
                  <Text size="xs" c="dimmed" mt="md">
                    Veritabanı Versiyonu
                  </Text>
                  <Text size="sm" fw={500}>
                    {health.database.version}
                  </Text>
                </>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Hızlı Linkler */}
        <Paper p="lg" radius="md" className="standard-card">
          <Title order={3} mb="md">
            🔗 Hızlı Erişim
          </Title>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Button
              variant="light"
              leftSection={<IconFileText size={16} />}
              rightSection={<IconExternalLink size={14} />}
              onClick={() => window.open(adminAPI.getApiDocsUrl(), '_blank')}
            >
              API Docs
            </Button>
            <Button
              variant="light"
              color="green"
              leftSection={<IconActivity size={16} />}
              rightSection={<IconExternalLink size={14} />}
              onClick={() => window.open(adminAPI.getHealthUrl(), '_blank')}
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
          Son güncelleme:{' '}
          {stats?.performans.timestamp ? new Date(stats.performans.timestamp).toLocaleString('tr-TR') : '-'}
          {stats?.performans.responseTime && ` (${stats.performans.responseTime}ms)`}
        </Text>
      </Stack>
    </Container>
  );
}
