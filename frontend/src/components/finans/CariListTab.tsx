'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Pagination,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCash,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFileInvoice,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTruck,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import { formatMoney } from '@/lib/formatters';
import type { Cari, CariTip, PaginationInfo } from '@/types/domain';

interface CariListTabProps {
  onCariSelect: (cari: Cari) => void;
  onCariEdit?: (cari: Cari) => void;
  onCariCreate?: () => void;
  onMutabakat?: (cari: Cari) => void;
}

export default function CariListTab({
  onCariSelect,
  onCariEdit,
  onCariCreate,
  onMutabakat,
}: CariListTabProps) {
  const { canCreate, canEdit, canDelete, isSuperAdmin } = usePermissions();
  const canCreateCari = isSuperAdmin || canCreate('cari');
  const canEditCari = isSuperAdmin || canEdit('cari');
  const canDeleteCari = isSuperAdmin || canDelete('cari');

  const [cariler, setCariler] = useState<Cari[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);
  const [activeFilter, setActiveFilter] = useState<string>('tumu');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  // API'den carileri yükle
  const loadCariler = useCallback(async (page = 1, search?: string, tip?: string) => {
    setLoading(true);
    try {
      const params: { page: number; limit: number; search?: string; tip?: CariTip } = {
        page,
        limit: 15,
      };

      if (search) {
        params.search = search;
      }

      if (tip && tip !== 'tumu') {
        params.tip = tip as CariTip;
      }

      const result = await muhasebeAPI.getCariler(params);

      if ('pagination' in result) {
        setCariler(result.data);
        setPagination(result.pagination);
      } else {
        setCariler(result.data || []);
        setPagination({
          page: 1,
          limit: 15,
          total: result.data?.length || 0,
          totalPages: 1,
        });
      }
    } catch (err) {
      console.error('Cariler yükleme hatası:', err);
      notifications.show({
        message: 'Cariler yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCariler(1, debouncedSearch || undefined, activeFilter);
  }, [loadCariler, debouncedSearch, activeFilter]);

  const handlePageChange = (page: number) => {
    loadCariler(page, debouncedSearch || undefined, activeFilter);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu cariyi silmek istediğinize emin misiniz?')) return;

    try {
      const result = await muhasebeAPI.deleteCari(id);
      if (result.success) {
        notifications.show({ message: 'Cari silindi', color: 'green' });
        loadCariler(pagination.page, debouncedSearch || undefined, activeFilter);
      }
    } catch (_err) {
      notifications.show({ message: 'Silme işlemi başarısız', color: 'red' });
    }
  };

  // Özet hesaplamaları
  const ozet = {
    toplamCari: pagination.total,
    musteriSayisi: cariler.filter((c) => c.tip === 'musteri' || c.tip === 'her_ikisi').length,
    tedarikciSayisi: cariler.filter((c) => c.tip === 'tedarikci' || c.tip === 'her_ikisi').length,
    toplamBorc: cariler.reduce((sum, c) => sum + Number(c.borc || 0), 0),
    toplamAlacak: cariler.reduce((sum, c) => sum + Number(c.alacak || 0), 0),
  };

  const getBakiyeColor = (bakiye: number) => {
    if (bakiye > 0) return 'teal';
    if (bakiye < 0) return 'red';
    return 'gray';
  };

  const getBakiyeIcon = (bakiye: number) => {
    if (bakiye > 0) return <IconArrowUpRight size={14} />;
    if (bakiye < 0) return <IconArrowDownRight size={14} />;
    return null;
  };

  const getTipBadge = (tip: CariTip) => {
    switch (tip) {
      case 'musteri':
        return (
          <Badge color="blue" variant="light" size="sm">
            Müşteri
          </Badge>
        );
      case 'tedarikci':
        return (
          <Badge color="orange" variant="light" size="sm">
            Tedarikçi
          </Badge>
        );
      case 'her_ikisi':
        return (
          <Badge color="grape" variant="light" size="sm">
            Her İkisi
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading && cariler.length === 0) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <Loader size="lg" type="bars" />
          <Text c="dimmed">Cariler yükleniyor...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      {/* Özet Kartları */}
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Paper p="md" radius="md" className="standard-card">
          <Group>
            <ThemeIcon color="blue" variant="light" size="lg" radius="md">
              <IconUsers size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Toplam
              </Text>
              <Text fw={700} size="lg">
                {ozet.toplamCari}
              </Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" className="standard-card">
          <Group>
            <ThemeIcon color="green" variant="light" size="lg" radius="md">
              <IconUserCheck size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Müşteri
              </Text>
              <Text fw={700} size="lg">
                {ozet.musteriSayisi}
              </Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" className="standard-card">
          <Group>
            <ThemeIcon color="orange" variant="light" size="lg" radius="md">
              <IconTruck size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Tedarikçi
              </Text>
              <Text fw={700} size="lg">
                {ozet.tedarikciSayisi}
              </Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" className="standard-card">
          <Group>
            <ThemeIcon color="teal" variant="light" size="lg" radius="md">
              <IconCash size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Net Bakiye
              </Text>
              <Text fw={700} size="lg" c={getBakiyeColor(ozet.toplamAlacak - ozet.toplamBorc)}>
                {formatMoney(ozet.toplamAlacak - ozet.toplamBorc)}
              </Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Filtreler ve Arama */}
      <Paper p="md" radius="md" className="standard-card">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Group gap="md">
            <TextInput
              placeholder="Cari ara..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 250 }}
            />
            <SegmentedControl
              value={activeFilter}
              onChange={setActiveFilter}
              data={[
                { label: 'Tümü', value: 'tumu' },
                { label: 'Müşteri', value: 'musteri' },
                { label: 'Tedarikçi', value: 'tedarikci' },
              ]}
              size="sm"
            />
          </Group>
          {canCreateCari && onCariCreate && (
            <Button leftSection={<IconPlus size={16} />} onClick={onCariCreate}>
              Yeni Cari
            </Button>
          )}
        </Group>
      </Paper>

      {/* Cari Listesi */}
      <Paper p="md" radius="md" className="standard-card">
        {cariler.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                <IconUsers size={30} />
              </ThemeIcon>
              <Text c="dimmed" ta="center">
                {searchTerm ? 'Aramanızla eşleşen cari bulunamadı' : 'Henüz cari kaydı yok'}
              </Text>
              {canCreateCari && onCariCreate && !searchTerm && (
                <Button variant="light" leftSection={<IconPlus size={16} />} onClick={onCariCreate}>
                  İlk Cariyi Ekle
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cari</Table.Th>
                  <Table.Th>Tip</Table.Th>
                  <Table.Th>İletişim</Table.Th>
                  <Table.Th ta="right">Borç</Table.Th>
                  <Table.Th ta="right">Alacak</Table.Th>
                  <Table.Th ta="right">Bakiye</Table.Th>
                  <Table.Th w={80}>İşlem</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cariler.map((cari) => {
                  const bakiye = Number(cari.alacak || 0) - Number(cari.borc || 0);
                  return (
                    <Table.Tr
                      key={cari.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onCariSelect(cari)}
                    >
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar radius="xl" size="sm" color="blue">
                            {cari.unvan?.charAt(0)?.toUpperCase() || '?'}
                          </Avatar>
                          <div>
                            <Text size="sm" fw={500} lineClamp={1}>
                              {cari.unvan}
                            </Text>
                            {cari.yetkili && (
                              <Text size="xs" c="dimmed">
                                {cari.yetkili}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>{getTipBadge(cari.tip)}</Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          {cari.telefon && (
                            <Text size="xs" c="dimmed">
                              {cari.telefon}
                            </Text>
                          )}
                          {cari.email && (
                            <Text size="xs" c="dimmed">
                              {cari.email}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c="red">
                          {formatMoney(Number(cari.borc || 0))}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c="teal">
                          {formatMoney(Number(cari.alacak || 0))}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Group gap={4} justify="flex-end">
                          {getBakiyeIcon(bakiye)}
                          <Text size="sm" fw={600} c={getBakiyeColor(bakiye)}>
                            {formatMoney(Math.abs(bakiye))}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Menu shadow="md" width={160} position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconDotsVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEye size={14} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                onCariSelect(cari);
                              }}
                            >
                              Detay
                            </Menu.Item>
                            {canEditCari && onCariEdit && (
                              <Menu.Item
                                leftSection={<IconEdit size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCariEdit(cari);
                                }}
                              >
                                Düzenle
                              </Menu.Item>
                            )}
                            {onMutabakat && (
                              <Menu.Item
                                leftSection={<IconFileInvoice size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMutabakat(cari);
                                }}
                              >
                                Mutabakat
                              </Menu.Item>
                            )}
                            {canDeleteCari && (
                              <>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={(e) => handleDelete(cari.id, e)}
                                >
                                  Sil
                                </Menu.Item>
                              </>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination
                  total={pagination.totalPages}
                  value={pagination.page}
                  onChange={handlePageChange}
                  size="sm"
                />
              </Group>
            )}
          </>
        )}
      </Paper>
    </Stack>
  );
}
