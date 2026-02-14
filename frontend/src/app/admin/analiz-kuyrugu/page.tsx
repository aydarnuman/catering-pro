'use client';

/**
 * Analiz Kuyruğu Dashboard
 * Tüm döküman analizlerini izleme ve yönetim sayfası
 */

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconActivity,
  IconCheck,
  IconClock,
  IconFile,
  IconLoader,
  IconRefresh,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/config';

// Dashboard veri tipi
interface QueueDashboardData {
  active: DocumentItem[];
  queued: DocumentItem[];
  recentCompleted: DocumentItem[];
  recentFailed: DocumentItem[];
  stats: {
    todayCompleted: number;
    weekCompleted: number;
    weekFailed: number;
    totalInQueue: number;
    avgDurationSeconds: number;
    successRate: number;
  };
}

interface DocumentItem {
  id: number;
  tender_id: number;
  original_filename: string;
  filename: string;
  file_type: string;
  source_type: string;
  processing_status: string;
  created_at: string;
  processed_at?: string;
  tender_title?: string;
  tender_external_id?: string;
  duration_seconds?: number;
}

// Süre formatla
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Zaman farkı formatla
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 1) return 'Az önce';
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  return date.toLocaleDateString('tr-TR');
}

// Status badge
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    processing: {
      color: 'blue',
      label: 'İşleniyor',
      icon: <IconLoader size={12} className="animate-spin" />,
    },
    pending: { color: 'gray', label: 'Bekliyor', icon: <IconClock size={12} /> },
    queued: { color: 'orange', label: 'Sırada', icon: <IconClock size={12} /> },
    completed: { color: 'green', label: 'Tamamlandı', icon: <IconCheck size={12} /> },
    failed: { color: 'red', label: 'Hata', icon: <IconX size={12} /> },
  };

  const { color, label, icon } = config[status] || { color: 'gray', label: status, icon: null };

  return (
    <Badge size="sm" color={color} variant="light" leftSection={icon}>
      {label}
    </Badge>
  );
}

// Stat Card
function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            {title}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          )}
        </div>
        <ThemeIcon size={48} radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

// Document Row
function DocumentRow({ doc }: { doc: DocumentItem }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon size="sm" variant="light" color="gray">
            <IconFile size={12} />
          </ThemeIcon>
          <div>
            <Text size="sm" lineClamp={1}>
              {doc.original_filename || doc.filename}
            </Text>
            <Text size="xs" c="dimmed">
              {doc.file_type?.toUpperCase()} • {doc.source_type}
            </Text>
          </div>
        </Group>
      </Table.Td>
      <Table.Td>
        {doc.tender_title ? (
          <Link href={`/tenders/${doc.tender_id}`} style={{ textDecoration: 'none' }}>
            <Text size="sm" c="blue" lineClamp={1}>
              {doc.tender_title}
            </Text>
          </Link>
        ) : (
          <Text size="sm" c="dimmed">
            -
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <StatusBadge status={doc.processing_status} />
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">
          {doc.processed_at ? formatTimeAgo(doc.processed_at) : formatTimeAgo(doc.created_at)}
        </Text>
      </Table.Td>
      {doc.duration_seconds !== undefined && (
        <Table.Td>
          <Text size="xs">{formatDuration(doc.duration_seconds)}</Text>
        </Table.Td>
      )}
    </Table.Tr>
  );
}

export default function AnalizKuyrugu() {
  const _queryClient = useQueryClient();

  // Dashboard verisi
  const { data, isLoading, error, refetch } = useQuery<{
    success: boolean;
    data: QueueDashboardData;
  }>({
    queryKey: ['queue-dashboard'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/tender-content/queue/dashboard`, {
        credentials: 'include',
      });
      return res.json();
    },
    refetchInterval: 30000, // Her 30 saniyede yenile
  });

  const dashboard = data?.data;

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" gap="md">
          <Loader size="xl" />
          <Text>Yükleniyor...</Text>
        </Stack>
      </Container>
    );
  }

  if (error || !dashboard) {
    return (
      <Container size="xl" py="xl">
        <Paper p="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <IconX size={48} color="red" />
            <Text>Dashboard yüklenemedi</Text>
            <Button onClick={() => refetch()}>Tekrar Dene</Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>📋 Analiz Kuyruğu</Title>
            <Text c="dimmed">Döküman analiz durumlarını izle ve yönet</Text>
          </div>
          <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={() => refetch()}>
            Yenile
          </Button>
        </Group>

        {/* Stats */}
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          <StatCard
            title="Sırada Bekleyen"
            value={dashboard.stats.totalInQueue}
            icon={<IconClock size={24} />}
            color="orange"
          />
          <StatCard
            title="Bugün Tamamlanan"
            value={dashboard.stats.todayCompleted}
            icon={<IconCheck size={24} />}
            color="green"
          />
          <StatCard
            title="Bu Hafta"
            value={dashboard.stats.weekCompleted}
            icon={<IconTrendingUp size={24} />}
            color="blue"
            subtitle={`${dashboard.stats.weekFailed} hatalı`}
          />
          <StatCard
            title="Ort. Süre"
            value={formatDuration(dashboard.stats.avgDurationSeconds)}
            icon={<IconActivity size={24} />}
            color="violet"
            subtitle={`%${dashboard.stats.successRate} başarı`}
          />
        </SimpleGrid>

        <Grid gutter="md">
          {/* Aktif İşler */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" color="blue" variant="light">
                    <IconLoader size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Aktif İşler</Text>
                </Group>
                <Badge color="blue">{dashboard.active.length}</Badge>
              </Group>

              {dashboard.active.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Şu an aktif işlem yok
                </Text>
              ) : (
                <ScrollArea h={250}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Dosya</Table.Th>
                        <Table.Th>İhale</Table.Th>
                        <Table.Th>Durum</Table.Th>
                        <Table.Th>Başlangıç</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {dashboard.active.map((doc) => (
                        <DocumentRow key={doc.id} doc={doc} />
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Card>
          </Grid.Col>

          {/* Sırada Bekleyenler */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" color="orange" variant="light">
                    <IconClock size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Sırada Bekleyenler</Text>
                </Group>
                <Badge color="orange">{dashboard.queued.length}</Badge>
              </Group>

              {dashboard.queued.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Kuyruk boş
                </Text>
              ) : (
                <ScrollArea h={250}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Dosya</Table.Th>
                        <Table.Th>İhale</Table.Th>
                        <Table.Th>Durum</Table.Th>
                        <Table.Th>Eklendi</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {dashboard.queued.map((doc) => (
                        <DocumentRow key={doc.id} doc={doc} />
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Card>
          </Grid.Col>

          {/* Son Tamamlananlar */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" color="green" variant="light">
                    <IconCheck size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Son Tamamlananlar (24 saat)</Text>
                </Group>
                <Badge color="green">{dashboard.recentCompleted.length}</Badge>
              </Group>

              {dashboard.recentCompleted.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Son 24 saatte tamamlanan işlem yok
                </Text>
              ) : (
                <ScrollArea h={300}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Dosya</Table.Th>
                        <Table.Th>İhale</Table.Th>
                        <Table.Th>Durum</Table.Th>
                        <Table.Th>Zaman</Table.Th>
                        <Table.Th>Süre</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {dashboard.recentCompleted.map((doc) => (
                        <DocumentRow key={doc.id} doc={doc} />
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Card>
          </Grid.Col>

          {/* Son Hatalılar */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" color="red" variant="light">
                    <IconX size={18} />
                  </ThemeIcon>
                  <Text fw={600}>Son Hatalar</Text>
                </Group>
                <Badge color="red">{dashboard.recentFailed.length}</Badge>
              </Group>

              {dashboard.recentFailed.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  🎉 Son 7 günde hata yok!
                </Text>
              ) : (
                <ScrollArea h={300}>
                  <Stack gap="xs">
                    {dashboard.recentFailed.map((doc) => (
                      <Paper key={doc.id} p="xs" radius="sm" withBorder>
                        <Group justify="space-between" wrap="nowrap">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" lineClamp={1}>
                              {doc.original_filename || doc.filename}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatTimeAgo(doc.processed_at || doc.created_at)}
                            </Text>
                          </div>
                          <Tooltip label="Tekrar Dene">
                            <ActionIcon
                              size="sm"
                              color="blue"
                              variant="light"
                              onClick={() => {
                                // TODO: Retry logic
                                notifications.show({
                                  title: 'Yakında',
                                  message: 'Tekrar deneme özelliği eklenecek',
                                  color: 'blue',
                                });
                              }}
                            >
                              <IconRefresh size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea>
              )}
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
