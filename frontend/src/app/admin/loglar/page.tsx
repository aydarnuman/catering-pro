'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Code,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  Pagination,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconActivity,
  IconArrowLeft,
  IconCalendar,
  IconClock,
  IconDownload,
  IconEdit,
  IconEye,
  IconFilter,
  IconHistory,
  IconLogin,
  IconLogout,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import RaporMerkeziModal from '@/components/rapor-merkezi/RaporMerkeziModal';
import StyledDatePicker from '@/components/ui/StyledDatePicker';
import { adminAPI } from '@/lib/api/services/admin';
import { formatDate } from '@/lib/formatters';
import 'dayjs/locale/tr';

interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  ip_address: string;
  description: string;
  created_at: string;
}

interface Summary {
  todayCount: number;
  weekCount: number;
  activeUsers: { user_name: string; action_count: number }[];
  actionDistribution: { action: string; count: number }[];
  moduleDistribution: { entity_type: string; count: number }[];
}

interface Filters {
  users: { user_id: number; user_name: string }[];
  actions: string[];
  entityTypes: string[];
}

export default function LoglarPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filtre state'leri
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterEntityType, setFilterEntityType] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);

  // Detay modal
  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [raporMerkeziOpen, setRaporMerkeziOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getAuditLogs({
        page,
        limit: 30,
        user_id: filterUserId || undefined,
        action: filterAction || undefined,
        entity_type: filterEntityType || undefined,
        search: filterSearch || undefined,
        start_date: filterStartDate?.toISOString(),
        end_date: filterEndDate?.toISOString(),
      });

      if (data.success) {
        setLogs((data.logs || []) as unknown as AuditLog[]);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Loglar alınamadı:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterUserId, filterAction, filterEntityType, filterSearch, filterStartDate, filterEndDate]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await adminAPI.getAuditLogSummary();
      if (data.success) setSummary(data.data);
    } catch (err) {
      console.error('Özet alınamadı:', err);
    }
  }, []);

  const fetchFilters = useCallback(async () => {
    try {
      const data = await adminAPI.getAuditLogFilters();
      if (data.success) setFilters(data.data);
    } catch (err) {
      console.error('Filtreler alınamadı:', err);
    }
  }, []);

  // İlk yükleme
  useEffect(() => {
    fetchSummary();
    fetchFilters();
  }, [fetchSummary, fetchFilters]);

  // Logları filtre/sayfa değiştiğinde yükle
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const clearFilters = () => {
    setFilterUserId(null);
    setFilterAction(null);
    setFilterEntityType(null);
    setFilterSearch('');
    setFilterStartDate(null);
    setFilterEndDate(null);
    setPage(1);
  };

  const viewLogDetail = async (logId: number) => {
    try {
      const data = await adminAPI.getAuditLogDetail(logId);
      if (data.success) {
        setSelectedLog(data.data);
        openDetailModal();
      }
    } catch (err) {
      console.error('Log detayı alınamadı:', err);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <IconPlus size={14} />;
      case 'update':
        return <IconEdit size={14} />;
      case 'delete':
        return <IconTrash size={14} />;
      case 'login':
        return <IconLogin size={14} />;
      case 'logout':
        return <IconLogout size={14} />;
      case 'export':
        return <IconDownload size={14} />;
      default:
        return <IconEye size={14} />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'green';
      case 'update':
        return 'blue';
      case 'delete':
        return 'red';
      case 'login':
        return 'teal';
      case 'logout':
        return 'gray';
      case 'export':
        return 'violet';
      case 'unauthorized_access':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getActionName = (action: string) => {
    switch (action) {
      case 'create':
        return 'Oluşturma';
      case 'update':
        return 'Güncelleme';
      case 'delete':
        return 'Silme';
      case 'login':
        return 'Giriş';
      case 'logout':
        return 'Çıkış';
      case 'export':
        return 'Dışa Aktarma';
      case 'view':
        return 'Görüntüleme';
      case 'unauthorized_access':
        return 'Yetkisiz Erişim';
      default:
        return action;
    }
  };

  const getEntityTypeName = (type: string) => {
    const names: Record<string, string> = {
      user: 'Kullanıcı',
      invoice: 'Fatura',
      tender: 'İhale',
      cari: 'Cari',
      personel: 'Personel',
      stok: 'Stok',
      firma: 'Firma',
      bordro: 'Bordro',
      permission: 'Yetki',
      menu: 'Menü',
      recete: 'Reçete',
    };
    return names[type] || type;
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Group gap="sm" mb={4}>
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconArrowLeft size={16} />}
                component={Link}
                href="/admin"
                size="compact-sm"
              >
                Admin Panel
              </Button>
            </Group>
            <Group gap="sm" mb={4}>
              <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'cyan', to: 'teal' }}>
                <IconHistory size={20} />
              </ThemeIcon>
              <Title order={1} size="h2">
                İşlem Geçmişi
              </Title>
            </Group>
            <Text c="dimmed">Sistemdeki tüm işlemlerin kaydı</Text>
          </div>

          <Group>
            <Tooltip label="Dışa Aktar">
              <ActionIcon variant="light" color="indigo" size="lg" onClick={() => setRaporMerkeziOpen(true)}>
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Yenile">
              <ActionIcon
                variant="light"
                size="lg"
                onClick={() => {
                  fetchLogs();
                  fetchSummary();
                }}
                loading={loading}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Özet Kartları */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                Bugün
              </Text>
              <ThemeIcon variant="light" color="blue" size="sm" radius="xl">
                <IconActivity size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {summary?.todayCount || 0}
            </Text>
            <Text size="xs" c="dimmed">
              işlem
            </Text>
          </Card>

          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                Son 7 Gün
              </Text>
              <ThemeIcon variant="light" color="green" size="sm" radius="xl">
                <IconCalendar size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {summary?.weekCount || 0}
            </Text>
            <Text size="xs" c="dimmed">
              işlem
            </Text>
          </Card>

          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                En Aktif
              </Text>
              <ThemeIcon variant="light" color="violet" size="sm" radius="xl">
                <IconUser size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="lg" lineClamp={1}>
              {summary?.activeUsers?.[0]?.user_name || '-'}
            </Text>
            <Text size="xs" c="dimmed">
              {summary?.activeUsers?.[0]?.action_count || 0} işlem
            </Text>
          </Card>

          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed">
                En Çok
              </Text>
              <ThemeIcon variant="light" color="orange" size="sm" radius="xl">
                <IconClock size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="lg" lineClamp={1}>
              {getActionName(summary?.actionDistribution?.[0]?.action || '')}
            </Text>
            <Text size="xs" c="dimmed">
              {summary?.actionDistribution?.[0]?.count || 0} işlem
            </Text>
          </Card>
        </SimpleGrid>

        {/* Filtreler */}
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <IconFilter size={16} />
              <Text fw={500}>Filtreler</Text>
            </Group>
            <Button variant="subtle" size="xs" onClick={clearFilters}>
              Temizle
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 6 }} spacing="md">
            <Select
              placeholder="Kullanıcı"
              value={filterUserId}
              onChange={setFilterUserId}
              data={filters?.users.map((u) => ({ value: u.user_id.toString(), label: u.user_name })) || []}
              clearable
              searchable
            />
            <Select
              placeholder="İşlem Tipi"
              value={filterAction}
              onChange={setFilterAction}
              data={filters?.actions.map((a) => ({ value: a, label: getActionName(a) })) || []}
              clearable
            />
            <Select
              placeholder="Modül"
              value={filterEntityType}
              onChange={setFilterEntityType}
              data={filters?.entityTypes.map((t) => ({ value: t, label: getEntityTypeName(t) })) || []}
              clearable
            />
            <StyledDatePicker placeholder="Başlangıç" value={filterStartDate} onChange={setFilterStartDate} clearable />
            <StyledDatePicker placeholder="Bitiş" value={filterEndDate} onChange={setFilterEndDate} clearable />
            <TextInput
              placeholder="Ara..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.currentTarget.value)}
              rightSection={
                <ActionIcon variant="subtle" onClick={handleSearch}>
                  <IconSearch size={16} />
                </ActionIcon>
              }
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </SimpleGrid>
        </Paper>

        {/* Log Listesi */}
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>📋 İşlem Kayıtları</Title>
            <Badge color="gray">{logs.length} kayıt</Badge>
          </Group>

          {loading ? (
            <Stack align="center" py="xl">
              <Loader />
              <Text c="dimmed">Yükleniyor...</Text>
            </Stack>
          ) : logs.length === 0 ? (
            <Stack align="center" py="xl">
              <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                <IconHistory size={30} />
              </ThemeIcon>
              <Text c="dimmed">Kayıt bulunamadı</Text>
            </Stack>
          ) : (
            <>
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Kullanıcı</Table.Th>
                      <Table.Th>İşlem</Table.Th>
                      <Table.Th>Modül</Table.Th>
                      <Table.Th>Açıklama</Table.Th>
                      <Table.Th ta="right">Detay</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {logs.map((log) => (
                      <Table.Tr key={log.id}>
                        <Table.Td>
                          <Text size="sm">{formatDate(log.created_at)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <IconUser size={14} />
                            <Text size="sm" fw={500}>
                              {log.user_name || '-'}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            leftSection={getActionIcon(log.action)}
                            color={getActionColor(log.action)}
                            variant="light"
                            size="sm"
                          >
                            {getActionName(log.action)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="outline" color="gray" size="sm">
                            {getEntityTypeName(log.entity_type)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" lineClamp={1} maw={300}>
                            {log.description || log.entity_name || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Tooltip label="Detay Görüntüle">
                            <ActionIcon variant="light" color="gray" onClick={() => viewLogDetail(log.id)}>
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <Group justify="center" mt="lg">
                  <Pagination total={totalPages} value={page} onChange={setPage} withEdges />
                </Group>
              )}
            </>
          )}
        </Paper>
      </Stack>

      {/* Detay Modal */}
      <Modal
        opened={detailModalOpened}
        onClose={closeDetailModal}
        title={
          <Group>
            <IconHistory size={20} />
            <Text fw={600}>İşlem Detayı #{selectedLog?.id}</Text>
          </Group>
        }
        size="lg"
      >
        {selectedLog && (
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="xs" c="dimmed">
                  Tarih
                </Text>
                <Text fw={500}>{formatDate(selectedLog.created_at, 'datetime')}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Kullanıcı
                </Text>
                <Group gap="xs">
                  <Text fw={500}>{selectedLog.user_name}</Text>
                  <Text size="xs" c="dimmed">
                    ({selectedLog.user_email})
                  </Text>
                </Group>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  İşlem
                </Text>
                <Badge leftSection={getActionIcon(selectedLog.action)} color={getActionColor(selectedLog.action)}>
                  {getActionName(selectedLog.action)}
                </Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Modül
                </Text>
                <Badge variant="outline">{getEntityTypeName(selectedLog.entity_type)}</Badge>
              </div>
              {selectedLog.entity_name && (
                <div>
                  <Text size="xs" c="dimmed">
                    Kayıt Adı
                  </Text>
                  <Text fw={500}>{selectedLog.entity_name}</Text>
                </div>
              )}
              {selectedLog.ip_address && (
                <div>
                  <Text size="xs" c="dimmed">
                    IP Adresi
                  </Text>
                  <Code>{selectedLog.ip_address}</Code>
                </div>
              )}
            </SimpleGrid>

            {selectedLog.description && (
              <>
                <Divider label="Açıklama" labelPosition="center" />
                <Text>{selectedLog.description}</Text>
              </>
            )}

            {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
              <>
                <Divider label="Değişiklikler" labelPosition="center" />
                <ScrollArea h={200}>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Alan</Table.Th>
                        <Table.Th>Eski Değer</Table.Th>
                        <Table.Th>Yeni Değer</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {Object.entries(selectedLog.changes).map(([key, value]) => (
                        <Table.Tr key={key}>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {key}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Code color="red">{JSON.stringify(value.old)}</Code>
                          </Table.Td>
                          <Table.Td>
                            <Code color="green">{JSON.stringify(value.new)}</Code>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </>
            )}
          </Stack>
        )}
      </Modal>

      {/* Rapor Merkezi Modal */}
      <RaporMerkeziModal opened={raporMerkeziOpen} onClose={() => setRaporMerkeziOpen(false)} module="admin" />
    </Container>
  );
}
