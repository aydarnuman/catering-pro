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
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
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
import { useEffect, useState } from 'react';
import { DataActions } from '@/components/DataActions';
import CariDetayModal from '@/components/muhasebe/CariDetayModal';
import MutabakatModal from '@/components/muhasebe/MutabakatModal';
import { usePermissions } from '@/hooks/usePermissions';
import { API_BASE_URL } from '@/lib/config';

// API URL - config'den al
const API_URL = `${API_BASE_URL}/api`;

// Tip tanımları
interface Cari {
  id: number;
  tip: 'musteri' | 'tedarikci' | 'her_ikisi';
  unvan: string;
  yetkili?: string;
  vergi_no?: string;
  vergi_dairesi?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  il?: string;
  ilce?: string;
  borc: number;
  alacak: number;
  bakiye: number;
  kredi_limiti?: number;
  banka_adi?: string;
  iban?: string;
  aktif?: boolean;
  notlar?: string;
  etiket?: string;
  created_at?: string;
  updated_at?: string;
}

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
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [editingItem, setEditingItem] = useState<Cari | null>(null);
  const [selectedCari, setSelectedCari] = useState<Cari | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    tip: 'musteri' as 'musteri' | 'tedarikci' | 'her_ikisi',
    unvan: '',
    yetkili: '',
    vergi_no: '',
    vergi_dairesi: '',
    telefon: '',
    email: '',
    adres: '',
    il: '',
    ilce: '',
    borc: 0,
    alacak: 0,
    kredi_limiti: 0,
    banka_adi: '',
    iban: '',
    notlar: '',
    etiket: '',
  });

  // API'den carileri yükle
  const loadCariler = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/cariler`);
      if (!response.ok) throw new Error('Veri yüklenemedi');

      const result = await response.json();
      setCariler(result.data || []);
    } catch (error) {
      console.error('Cariler yükleme hatası:', error);
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
  };

  // Component mount olduğunda verileri yükle
  useEffect(() => {
    loadCariler();
  }, [loadCariler]);

  // Cari kaydet (oluştur veya güncelle)
  const handleSubmit = async () => {
    if (!formData.unvan || !formData.tip) {
      notifications.show({
        title: 'Hata',
        message: 'Ünvan ve tip zorunludur',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const url = editingItem ? `${API_URL}/cariler/${editingItem.id}` : `${API_URL}/cariler`;

      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('İşlem başarısız');

      const result = await response.json();

      notifications.show({
        title: 'Başarılı',
        message: result.message || 'İşlem tamamlandı',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Listeyi yenile
      await loadCariler();

      // Formu temizle ve kapat
      resetForm();
      close();
    } catch (error) {
      console.error('Kayıt hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'İşlem başarısız oldu',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Cari sil
  const handleDelete = async (id: number) => {
    if (!confirm('Bu cariyi silmek istediğinize emin misiniz?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/cariler/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Silme başarısız');

      notifications.show({
        title: 'Başarılı',
        message: 'Cari silindi',
        color: 'green',
      });

      await loadCariler();
    } catch (error) {
      console.error('Silme hatası:', error);
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
    setFormData({
      tip: 'musteri',
      unvan: '',
      yetkili: '',
      vergi_no: '',
      vergi_dairesi: '',
      telefon: '',
      email: '',
      adres: '',
      il: '',
      ilce: '',
      borc: 0,
      alacak: 0,
      kredi_limiti: 0,
      banka_adi: '',
      iban: '',
      notlar: '',
      etiket: '',
    });
    setEditingItem(null);
  };

  // Düzenleme için formu doldur
  const handleEdit = (cari: Cari) => {
    setFormData({
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
      borc: Number(cari.borc) || 0,
      alacak: Number(cari.alacak) || 0,
      kredi_limiti: Number(cari.kredi_limiti) || 0,
      banka_adi: cari.banka_adi || '',
      iban: cari.iban || '',
      notlar: cari.notlar || '',
      etiket: cari.etiket || '',
    });
    setEditingItem(cari);
    open();
  };

  // Filtreleme
  const filteredCariler = cariler.filter((cari) => {
    // Tab filtresi
    if (activeTab === 'musteri' && cari.tip !== 'musteri' && cari.tip !== 'her_ikisi') return false;
    if (activeTab === 'tedarikci' && cari.tip !== 'tedarikci' && cari.tip !== 'her_ikisi')
      return false;

    // Arama filtresi
    if (searchTerm && !cari.unvan.toLowerCase().includes(searchTerm.toLowerCase())) return false;

    return true;
  });

  // Özet hesaplamaları
  const ozet = {
    toplamCari: cariler.length,
    musteriSayisi: cariler.filter((c) => c.tip === 'musteri' || c.tip === 'her_ikisi').length,
    tedarikciSayisi: cariler.filter((c) => c.tip === 'tedarikci' || c.tip === 'her_ikisi').length,
    toplamBorc: cariler.reduce((sum, c) => sum + Number(c.borc), 0),
    toplamAlacak: cariler.reduce((sum, c) => sum + Number(c.alacak), 0),
  };

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading} />

      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
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
                  {formatMoney(ozet.toplamAlacak - ozet.toplamBorc)}
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
                <Tabs.Tab value="tumu">Tümü ({cariler.length})</Tabs.Tab>
                <Tabs.Tab value="musteri">Müşteriler ({ozet.musteriSayisi})</Tabs.Tab>
                <Tabs.Tab value="tedarikci">Tedarikçiler ({ozet.tedarikciSayisi})</Tabs.Tab>
              </Tabs.List>
            </Tabs>

            <TextInput
              placeholder="Cari ara..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.currentTarget.value)}
            />
          </Stack>
        </Card>

        {/* Cari Listesi - Kart Görünümü */}
        {filteredCariler.length === 0 ? (
          <Card withBorder>
            <Stack align="center" py="xl" gap="md">
              <ThemeIcon size={60} variant="light" color="gray" radius="xl">
                <IconUsers size={30} />
              </ThemeIcon>
              <Text c="dimmed" size="lg">
                Kayıt bulunamadı
              </Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  resetForm();
                  open();
                }}
              >
                İlk Carinizi Ekleyin
              </Button>
            </Stack>
          </Card>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
              {filteredCariler.map((cari) => {
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
                    <Group justify="space-between" mb="sm">
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
                    <Group justify="space-between" align="center">
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
                            {formatMoney(Math.abs(bakiye))}
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

            {/* Alt Bilgi */}
            <Paper withBorder p="md" radius="md" mt="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Toplam <strong>{filteredCariler.length}</strong> cari gösteriliyor
                </Text>
                <Group gap="xl">
                  <Group gap={6}>
                    <Text size="sm" c="dimmed">
                      Toplam Alacak:
                    </Text>
                    <Text size="sm" fw={600} c="green">
                      {formatMoney(
                        filteredCariler.reduce((sum, c) => sum + Math.max(0, Number(c.bakiye)), 0)
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
                          filteredCariler.reduce((sum, c) => sum + Math.min(0, Number(c.bakiye)), 0)
                        )
                      )}
                    </Text>
                  </Group>
                </Group>
              </Group>
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

        {/* Form Modal */}
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
                value={formData.tip}
                onChange={(value) => setFormData({ ...formData, tip: value as any })}
              />
              <Select
                label="Etiket/Kategori"
                placeholder="Seçin"
                data={etiketler}
                value={formData.etiket || null}
                onChange={(value) => setFormData({ ...formData, etiket: value || '' })}
                searchable
                clearable
              />
            </SimpleGrid>

            <TextInput
              label="Ünvan"
              required
              value={formData.unvan}
              onChange={(e) => setFormData({ ...formData, unvan: e.target.value })}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Yetkili"
                value={formData.yetkili}
                onChange={(e) => setFormData({ ...formData, yetkili: e.target.value })}
              />
              <TextInput
                label="Telefon"
                value={formData.telefon}
                onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Vergi No"
                value={formData.vergi_no}
                onChange={(e) => setFormData({ ...formData, vergi_no: e.target.value })}
              />
              <TextInput
                label="Vergi Dairesi"
                value={formData.vergi_dairesi}
                onChange={(e) => setFormData({ ...formData, vergi_dairesi: e.target.value })}
              />
            </SimpleGrid>

            <TextInput
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Textarea
              label="Adres"
              value={formData.adres}
              onChange={(e) => setFormData({ ...formData, adres: e.target.value })}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="İl"
                data={iller}
                value={formData.il}
                onChange={(value) => setFormData({ ...formData, il: value || '' })}
                searchable
              />
              <TextInput
                label="İlçe"
                value={formData.ilce}
                onChange={(e) => setFormData({ ...formData, ilce: e.target.value })}
              />
            </SimpleGrid>

            <Textarea
              label="Notlar"
              value={formData.notlar}
              onChange={(e) => setFormData({ ...formData, notlar: e.target.value })}
            />

            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => {
                  close();
                  resetForm();
                }}
              >
                İptal
              </Button>
              <Button onClick={handleSubmit} loading={loading}>
                {editingItem ? 'Güncelle' : 'Kaydet'}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
