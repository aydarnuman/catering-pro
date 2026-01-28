'use client';

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  LoadingOverlay,
  Modal,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { isEmail, useForm } from '@mantine/form';
import { useDebouncedValue, useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconCash,
  IconCheck,
  IconMapPin,
  IconPhone,
  IconPlus,
  IconSearch,
  IconTruck,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumbs, EmptyState } from '@/components/common';
import { DataActions } from '@/components/DataActions';
import { useAuth } from '@/context/AuthContext';

const CariDetayModal = dynamic(
  () => import('@/components/muhasebe/CariDetayModal').then((m) => m.default),
  { ssr: false }
);
const MutabakatModal = dynamic(
  () => import('@/components/muhasebe/MutabakatModal').then((m) => m.default),
  { ssr: false }
);
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import { formatMoney } from '@/lib/formatters';
import type { Cari, CariTip, PaginationInfo } from '@/types/domain';

// Form validasyon kuralları
const validateVergiNo = (value: string | undefined) => {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, '');
  if (!/^\d{10,11}$/.test(cleaned)) {
    return 'Vergi no 10 veya 11 haneli olmalı';
  }
  return null;
};

const validateTelefon = (value: string | undefined) => {
  if (!value) return null;
  const cleaned = value.replace(/[\s\-()]/g, '');
  if (!/^(\+90|0)?[1-9]\d{9}$/.test(cleaned)) {
    return 'Geçerli bir telefon numarası girin';
  }
  return null;
};

const validateIBAN = (value: string | undefined) => {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, '').toUpperCase();
  if (!/^TR\d{24}$/.test(cleaned)) {
    return 'Geçerli bir IBAN girin (TR + 24 hane)';
  }
  return null;
};

// Yaygın etiketler
const etiketler = [
  'Şarküteri',
  'Market',
  'Restoran',
  'Kafe',
  'Otel',
  'Hastane',
  'Okul',
  'Fabrika',
  'Toptan',
  'Perakende',
  'Dağıtıcı',
  'Üretici',
  'İthalatçı',
  'Diğer',
];

// Şehirler
const iller = [
  'İstanbul',
  'Ankara',
  'İzmir',
  'Bursa',
  'Antalya',
  'Adana',
  'Konya',
  'Gaziantep',
  'Mersin',
  'Diyarbakır',
  'Kayseri',
  'Eskişehir',
  'Samsun',
  'Denizli',
  'Şanlıurfa',
  'Diğer',
];

export default function CarilerPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { colorScheme } = useMantineColorScheme();
  const _isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');

  // === YETKİ KONTROLÜ ===
  const { canCreate, canEdit, canDelete, isSuperAdmin } = usePermissions();
  const canCreateCari = isSuperAdmin || canCreate('cari');
  const canEditCari = isSuperAdmin || canEdit('cari');
  const canDeleteCari = isSuperAdmin || canDelete('cari');
  const [opened, { open, close }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [mutabakatOpened, { open: openMutabakat, close: closeMutabakat }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [editingItem, setEditingItem] = useState<Cari | null>(null);
  const [selectedCari, setSelectedCari] = useState<Cari | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Mantine Form ile validasyon
  const form = useForm({
    initialValues: {
      tip: 'musteri' as CariTip,
      unvan: '',
      yetkili: '',
      vergi_no: '',
      vergi_dairesi: '',
      telefon: '',
      email: '',
      adres: '',
      il: '',
      ilce: '',
      kredi_limiti: 0,
      banka_adi: '',
      iban: '',
      notlar: '',
      etiket: '',
    },
    validate: {
      unvan: (value) => (value.length < 2 ? 'Ünvan en az 2 karakter olmalı' : null),
      tip: (value) => (!value ? 'Tip seçimi zorunlu' : null),
      email: (value) => (value && !isEmail(value) ? 'Geçerli bir email adresi girin' : null),
      vergi_no: validateVergiNo,
      telefon: validateTelefon,
      iban: validateIBAN,
    },
  });

  // API'den carileri yükle (pagination ve arama destekli)
  const loadCariler = useCallback(async (page = 1, search?: string, tip?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: { page: number; limit: number; search?: string; tip?: CariTip } = {
        page,
        limit: 20,
      };

      // Arama parametresi
      if (search) {
        params.search = search;
      }

      // Tip filtresi (tümü hariç)
      if (tip && tip !== 'tumu') {
        params.tip = tip as CariTip;
      }

      const result = await muhasebeAPI.getCariler(params);

      // PaginatedResponse veya eski format kontrolü
      if ('pagination' in result) {
        setCariler(result.data);
        setPagination(result.pagination);
      } else {
        // Eski format için geriye uyumluluk
        setCariler(result.data || []);
        setPagination({
          page: 1,
          limit: 20,
          total: result.data?.length || 0,
          totalPages: 1,
        });
      }
    } catch (err) {
      console.error('Cariler yükleme hatası:', err);
      setError('Veriler yüklenirken hata oluştu');
      notifications.show({
        title: 'Hata',
        message: 'Cariler yüklenemedi',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Component mount olduğunda verileri yükle
  useEffect(() => {
    if (authLoading) return;
    loadCariler(1, debouncedSearch || undefined, activeTab || undefined);
  }, [loadCariler, authLoading, debouncedSearch, activeTab]);

  // 🔴 REALTIME - Cariler ve cari hareketler tablolarını dinle
  useRealtimeRefetch(['cariler', 'cari_hareketler'], () => {
    loadCariler(pagination.page, debouncedSearch || undefined, activeTab || undefined);
  });

  // Sayfa değişikliği
  const handlePageChange = (page: number) => {
    loadCariler(page, debouncedSearch || undefined, activeTab || undefined);
  };

  // Cari kaydet (oluştur veya güncelle) - form validasyonlu
  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      const result = editingItem
        ? await muhasebeAPI.updateCari(editingItem.id, values)
        : await muhasebeAPI.createCari(values);

      if (!result.success) throw new Error(result.error || 'İşlem başarısız');

      notifications.show({
        title: 'Başarılı',
        message: result.message || 'İşlem tamamlandı',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Listeyi yenile
      await loadCariler(pagination.page, debouncedSearch || undefined, activeTab || undefined);

      // Formu temizle ve kapat
      resetForm();
      close();
    } catch (err) {
      console.error('Kayıt hatası:', err);
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'İşlem başarısız oldu',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  });

  // Cari sil
  const handleDelete = async (id: number) => {
    if (!confirm('Bu cariyi silmek istediğinize emin misiniz?')) return;

    setLoading(true);
    try {
      const result = await muhasebeAPI.deleteCari(id);

      if (!result.success) throw new Error('Silme başarısız');

      notifications.show({
        title: 'Başarılı',
        message: 'Cari silindi',
        color: 'green',
      });

      await loadCariler(pagination.page, debouncedSearch || undefined, activeTab || undefined);
    } catch (err) {
      console.error('Silme hatası:', err);
      notifications.show({
        title: 'Hata',
        message: 'Silme işlemi başarısız',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Form sıfırlama
  const resetForm = () => {
    form.reset();
    setEditingItem(null);
  };

  // Düzenleme için formu doldur
  const handleEdit = (cari: Cari) => {
    form.setValues({
      tip: cari.tip,
      unvan: cari.unvan,
      yetkili: cari.yetkili || '',
      vergi_no: cari.vergi_no || '',
      vergi_dairesi: cari.vergi_dairesi || '',
      telefon: cari.telefon || '',
      email: cari.email || '',
      adres: cari.adres || '',
      il: cari.il || '',
      ilce: cari.ilce || '',
      kredi_limiti: Number(cari.kredi_limiti) || 0,
      banka_adi: cari.banka_adi || '',
      iban: cari.iban || '',
      notlar: cari.notlar || '',
      etiket: cari.etiket || '',
    });
    setEditingItem(cari);
    open();
  };

  // Özet hesaplamaları (memoized)
  const ozet = useMemo(
    () => ({
      toplamCari: pagination.total,
      musteriSayisi: cariler.filter((c) => c.tip === 'musteri' || c.tip === 'her_ikisi').length,
      tedarikciSayisi: cariler.filter((c) => c.tip === 'tedarikci' || c.tip === 'her_ikisi').length,
      toplamBorc: cariler.reduce((sum, c) => sum + Number(c.borc), 0),
      toplamAlacak: cariler.reduce((sum, c) => sum + Number(c.alacak), 0),
    }),
    [cariler, pagination.total]
  );

  return (
    <Container size="xl" py="md">
      <Breadcrumbs items={[{ label: 'Muhasebe', href: '/muhasebe' }, { label: 'Cari Hesaplar' }]} />
      <LoadingOverlay visible={loading} />

      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" wrap="wrap">
          <div>
            <Title order={2}>Cariler</Title>
            <Text c="dimmed" size="sm">
              Müşteri ve tedarikçi yönetimi
            </Text>
          </div>
          <Group>
            {canCreateCari && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  resetForm();
                  open();
                }}
              >
                Yeni Cari
              </Button>
            )}
            <DataActions type="cari" onImportSuccess={() => loadCariler()} />
          </Group>
        </Group>

        {/* Hata mesajı */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        {/* Özet Kartları */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          <Paper withBorder p="md" radius="md">
            <Group>
              <ThemeIcon color="blue" variant="light" size="xl" radius="md">
                <IconUsers size={28} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">
                  Toplam Cari
                </Text>
                <Text fw={700} size="xl">
                  {ozet.toplamCari}
                </Text>
              </div>
            </Group>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Group>
              <ThemeIcon color="green" variant="light" size="xl" radius="md">
                <IconUserCheck size={28} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">
                  Müşteri
                </Text>
                <Text fw={700} size="xl">
                  {ozet.musteriSayisi}
                </Text>
              </div>
            </Group>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Group>
              <ThemeIcon color="orange" variant="light" size="xl" radius="md">
                <IconTruck size={28} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">
                  Tedarikçi
                </Text>
                <Text fw={700} size="xl">
                  {ozet.tedarikciSayisi}
                </Text>
              </div>
            </Group>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Group>
              <ThemeIcon color="teal" variant="light" size="xl" radius="md">
                <IconCash size={28} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">
                  Net Bakiye
                </Text>
                <Text
                  fw={700}
                  size="xl"
                  c={ozet.toplamAlacak - ozet.toplamBorc >= 0 ? 'green' : 'red'}
                >
                  {formatMoney(ozet.toplamAlacak - ozet.toplamBorc, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </div>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* Filtreler ve Arama */}
        <Card withBorder>
          <Stack gap="md">
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab value="tumu">Tümü ({pagination.total})</Tabs.Tab>
                <Tabs.Tab value="musteri">Müşteriler ({ozet.musteriSayisi})</Tabs.Tab>
                <Tabs.Tab value="tedarikci">Tedarikçiler ({ozet.tedarikciSayisi})</Tabs.Tab>
              </Tabs.List>
            </Tabs>

            <TextInput
              placeholder="Ünvan, vergi no, telefon veya email ile ara..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.currentTarget.value)}
            />
          </Stack>
        </Card>

        {/* Cari Listesi - Kart Görünümü */}
        {cariler.length === 0 ? (
          <EmptyState
            title="Kayıt bulunamadı"
            description="İlk carinizi ekleyerek başlayın"
            icon={<IconUsers size={30} />}
            iconColor="blue"
            action={{
              label: 'İlk Carinizi Ekleyin',
              onClick: () => {
                resetForm();
                open();
              },
              icon: <IconPlus size={16} />,
            }}
          />
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
              {cariler.map((cari) => {
                const bakiye = Number(cari.bakiye);
                const tipRenk =
                  cari.tip === 'musteri' ? 'green' : cari.tip === 'tedarikci' ? 'orange' : 'blue';
                const TipIcon =
                  cari.tip === 'musteri'
                    ? IconUserCheck
                    : cari.tip === 'tedarikci'
                      ? IconTruck
                      : IconUsers;

                return (
                  <Paper
                    key={cari.id}
                    shadow="sm"
                    radius="lg"
                    p="md"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      borderLeft: `4px solid var(--mantine-color-${tipRenk}-5)`,
                    }}
                    onClick={() => {
                      setSelectedCari(cari);
                      openDetail();
                    }}
                    className="cari-card"
                  >
                    {/* Header */}
                    <Group justify="space-between" mb="sm" wrap="wrap">
                      <Group gap="sm">
                        <Avatar color={tipRenk} radius="xl" size={40} variant="light">
                          <TipIcon size={20} />
                        </Avatar>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text fw={600} size="sm" lineClamp={1}>
                            {cari.unvan}
                          </Text>
                          <Group gap={4}>
                            <Badge size="xs" variant="light" color={tipRenk}>
                              {cari.tip === 'musteri'
                                ? 'Müşteri'
                                : cari.tip === 'tedarikci'
                                  ? 'Tedarikçi'
                                  : 'Her İkisi'}
                            </Badge>
                            {cari.etiket && (
                              <Badge size="xs" variant="outline" color="violet">
                                {cari.etiket}
                              </Badge>
                            )}
                          </Group>
                        </div>
                      </Group>
                    </Group>

                    {/* İletişim Bilgileri */}
                    <Stack gap={4} mb="sm">
                      {cari.vergi_no && (
                        <Text size="xs" c="dimmed">
                          VKN: {cari.vergi_no}
                        </Text>
                      )}
                      {cari.telefon && (
                        <Group gap={4}>
                          <IconPhone size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
                          <Text size="xs" c="dimmed">
                            {cari.telefon}
                          </Text>
                        </Group>
                      )}
                      {cari.il && (
                        <Group gap={4}>
                          <IconMapPin size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
                          <Text size="xs" c="dimmed">
                            {cari.ilce ? `${cari.ilce}, ` : ''}
                            {cari.il}
                          </Text>
                        </Group>
                      )}
                      {cari.adres && (
                        <Text size="xs" c="dimmed" lineClamp={1} title={cari.adres}>
                          {cari.adres}
                        </Text>
                      )}
                    </Stack>

                    <Divider mb="sm" />

                    {/* Bakiye */}
                    <Group justify="space-between" align="center" wrap="wrap">
                      <div>
                        <Text size="xs" c="dimmed">
                          Bakiye
                        </Text>
                        <Group gap={4}>
                          {bakiye < 0 ? (
                            <IconArrowDownRight
                              size={16}
                              style={{ color: 'var(--mantine-color-red-6)' }}
                            />
                          ) : bakiye > 0 ? (
                            <IconArrowUpRight
                              size={16}
                              style={{ color: 'var(--mantine-color-green-6)' }}
                            />
                          ) : null}
                          <Text
                            fw={700}
                            size="lg"
                            c={bakiye > 0 ? 'green' : bakiye < 0 ? 'red' : 'dimmed'}
                          >
                            {formatMoney(Math.abs(bakiye), {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </Text>
                        </Group>
                      </div>
                      {bakiye !== 0 && (
                        <Badge size="sm" variant="light" color={bakiye > 0 ? 'green' : 'red'}>
                          {bakiye > 0 ? 'Alacak' : 'Borç'}
                        </Badge>
                      )}
                      {bakiye === 0 && (
                        <Badge size="sm" variant="light" color="gray">
                          Dengeli
                        </Badge>
                      )}
                    </Group>
                  </Paper>
                );
              })}
            </SimpleGrid>

            {/* Alt Bilgi ve Pagination */}
            <Paper withBorder p="md" radius="md" mt="md">
              <Stack gap="md">
                <Group justify="space-between" wrap="wrap">
                  <Text size="sm" c="dimmed">
                    Toplam <strong>{pagination.total}</strong> cari, sayfa {pagination.page}/
                    {pagination.totalPages}
                  </Text>
                  <Group gap="xl">
                    <Group gap={6}>
                      <Text size="sm" c="dimmed">
                        Toplam Alacak:
                      </Text>
                      <Text size="sm" fw={600} c="green">
                        {formatMoney(
                          cariler.reduce((sum, c) => sum + Math.max(0, Number(c.bakiye)), 0)
                        )}
                      </Text>
                    </Group>
                    <Group gap={6}>
                      <Text size="sm" c="dimmed">
                        Toplam Borç:
                      </Text>
                      <Text size="sm" fw={600} c="red">
                        {formatMoney(
                          Math.abs(
                            cariler.reduce((sum, c) => sum + Math.min(0, Number(c.bakiye)), 0)
                          )
                        )}
                      </Text>
                    </Group>
                  </Group>
                </Group>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <Group justify="center">
                    <Pagination
                      value={pagination.page}
                      onChange={handlePageChange}
                      total={pagination.totalPages}
                      size="sm"
                      withEdges
                    />
                  </Group>
                )}
              </Stack>
            </Paper>
          </>
        )}

        {/* Cari Detay Modal */}
        <CariDetayModal
          opened={detailOpened}
          onClose={closeDetail}
          cari={selectedCari}
          onEdit={
            canEditCari
              ? (cari) => {
                  handleEdit(cari);
                }
              : undefined
          }
          onMutabakat={(cari) => {
            setSelectedCari(cari);
            openMutabakat();
          }}
          onDelete={
            canDeleteCari
              ? (cariId) => {
                  handleDelete(cariId);
                }
              : undefined
          }
        />

        {/* Mutabakat Modal */}
        <MutabakatModal opened={mutabakatOpened} onClose={closeMutabakat} cari={selectedCari} />

        {/* Form Modal - @mantine/form ile validasyon */}
        <Modal
          opened={opened}
          onClose={() => {
            close();
            resetForm();
          }}
          title={editingItem ? 'Cari Düzenle' : 'Yeni Cari'}
          size="lg"
          fullScreen={isMobile}
        >
          <form onSubmit={handleSubmit}>
            <Stack>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select
                  label="Tip"
                  required
                  data={[
                    { value: 'musteri', label: 'Müşteri' },
                    { value: 'tedarikci', label: 'Tedarikçi' },
                    { value: 'her_ikisi', label: 'Her İkisi' },
                  ]}
                  {...form.getInputProps('tip')}
                />
                <Select
                  label="Etiket/Kategori"
                  placeholder="Seçin"
                  data={etiketler}
                  {...form.getInputProps('etiket')}
                  searchable
                  clearable
                />
              </SimpleGrid>

              <TextInput label="Ünvan" required {...form.getInputProps('unvan')} />

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Yetkili" {...form.getInputProps('yetkili')} />
                <TextInput label="Telefon" {...form.getInputProps('telefon')} />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Vergi No" {...form.getInputProps('vergi_no')} />
                <TextInput label="Vergi Dairesi" {...form.getInputProps('vergi_dairesi')} />
              </SimpleGrid>

              <TextInput label="Email" type="email" {...form.getInputProps('email')} />

              <Textarea label="Adres" {...form.getInputProps('adres')} />

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select label="İl" data={iller} {...form.getInputProps('il')} searchable />
                <TextInput label="İlçe" {...form.getInputProps('ilce')} />
              </SimpleGrid>

              <Textarea label="Notlar" {...form.getInputProps('notlar')} />

              <Group justify="flex-end">
                <Button
                  type="button"
                  variant="light"
                  onClick={() => {
                    close();
                    resetForm();
                  }}
                >
                  İptal
                </Button>
                <Button type="submit" loading={loading}>
                  {editingItem ? 'Güncelle' : 'Kaydet'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Container>
  );
}
