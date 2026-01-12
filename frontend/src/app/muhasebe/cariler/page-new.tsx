'use client';

import { useState, useEffect } from 'react';
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
  Box,
  Table,
  ActionIcon,
  TextInput,
  Select,
  Modal,
  Textarea,
  Tabs,
  useMantineColorScheme,
  Avatar,
  Menu,
  rem,
  Paper,
  Progress,
  Divider,
  LoadingOverlay,
  Alert
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconUsers,
  IconUserCheck,
  IconTruck,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconCheck,
  IconPhone,
  IconMail,
  IconMapPin,
  IconReceipt,
  IconCash,
  IconArrowUpRight,
  IconArrowDownRight,
  IconEye,
  IconFileInvoice,
  IconAlertCircle
} from '@tabler/icons-react';

// API URL
const API_URL = 'http://localhost:3001/api';

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
  kredi_limiti: number;
  banka_adi?: string;
  iban?: string;
  aktif: boolean;
  notlar?: string;
  created_at: string;
  updated_at: string;
}

// Şehirler
const iller = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep',
  'Mersin', 'Diyarbakır', 'Kayseri', 'Eskişehir', 'Samsun', 'Denizli', 'Şanlıurfa', 'Diğer'
];

export default function CarilerPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [opened, { open, close }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
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
    notlar: ''
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
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  // Component mount olduğunda verileri yükle
  useEffect(() => {
    loadCariler();
  }, []);

  // Cari kaydet (oluştur veya güncelle)
  const handleSubmit = async () => {
    if (!formData.unvan || !formData.tip) {
      notifications.show({
        title: 'Hata',
        message: 'Ünvan ve tip zorunludur',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const url = editingItem 
        ? `${API_URL}/cariler/${editingItem.id}`
        : `${API_URL}/cariler`;
      
      const method = editingItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('İşlem başarısız');

      const result = await response.json();
      
      notifications.show({
        title: 'Başarılı',
        message: result.message || 'İşlem tamamlandı',
        color: 'green',
        icon: <IconCheck size={16} />
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
        color: 'red'
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
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Silme başarısız');

      notifications.show({
        title: 'Başarılı',
        message: 'Cari silindi',
        color: 'green'
      });

      await loadCariler();
      
    } catch (error) {
      console.error('Silme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Silme işlemi başarısız',
        color: 'red'
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
      notlar: ''
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
      notlar: cari.notlar || ''
    });
    setEditingItem(cari);
    open();
  };

  // Filtreleme
  const filteredCariler = cariler.filter(cari => {
    // Tab filtresi
    if (activeTab === 'musteri' && cari.tip !== 'musteri' && cari.tip !== 'her_ikisi') return false;
    if (activeTab === 'tedarikci' && cari.tip !== 'tedarikci' && cari.tip !== 'her_ikisi') return false;
    
    // Arama filtresi
    if (searchTerm && !cari.unvan.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    
    return true;
  });

  // Özet hesaplamaları
  const ozet = {
    toplamCari: cariler.length,
    musteriSayisi: cariler.filter(c => c.tip === 'musteri' || c.tip === 'her_ikisi').length,
    tedarikciSayisi: cariler.filter(c => c.tip === 'tedarikci' || c.tip === 'her_ikisi').length,
    toplamBorc: cariler.reduce((sum, c) => sum + Number(c.borc), 0),
    toplamAlacak: cariler.reduce((sum, c) => sum + Number(c.alacak), 0)
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
            <Text c="dimmed" size="sm">Müşteri ve tedarikçi yönetimi</Text>
          </div>
          <Button 
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              resetForm();
              open();
            }}
          >
            Yeni Cari
          </Button>
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
                <Text size="xs" c="dimmed">Toplam Cari</Text>
                <Text fw={700} size="xl">{ozet.toplamCari}</Text>
              </div>
            </Group>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Group>
              <ThemeIcon color="green" variant="light" size="xl" radius="md">
                <IconUserCheck size={28} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Müşteri</Text>
                <Text fw={700} size="xl">{ozet.musteriSayisi}</Text>
              </div>
            </Group>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Group>
              <ThemeIcon color="orange" variant="light" size="xl" radius="md">
                <IconTruck size={28} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Tedarikçi</Text>
                <Text fw={700} size="xl">{ozet.tedarikciSayisi}</Text>
              </div>
            </Group>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Group>
              <ThemeIcon color="teal" variant="light" size="xl" radius="md">
                <IconCash size={28} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Net Bakiye</Text>
                <Text fw={700} size="xl" c={ozet.toplamAlacak - ozet.toplamBorc >= 0 ? 'green' : 'red'}>
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

        {/* Tablo */}
        <Card withBorder>
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ünvan</Table.Th>
                  <Table.Th>Tip</Table.Th>
                  <Table.Th>Yetkili</Table.Th>
                  <Table.Th>Telefon</Table.Th>
                  <Table.Th>İl</Table.Th>
                  <Table.Th>Bakiye</Table.Th>
                  <Table.Th>İşlemler</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredCariler.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                      <Text c="dimmed">Kayıt bulunamadı</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredCariler.map((cari) => (
                    <Table.Tr key={cari.id}>
                      <Table.Td><Text fw={500}>{cari.unvan}</Text></Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={
                            cari.tip === 'musteri' ? 'green' :
                            cari.tip === 'tedarikci' ? 'orange' : 'blue'
                          }
                        >
                          {cari.tip === 'musteri' ? 'Müşteri' :
                           cari.tip === 'tedarikci' ? 'Tedarikçi' : 'Her İkisi'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{cari.yetkili || '-'}</Table.Td>
                      <Table.Td>{cari.telefon || '-'}</Table.Td>
                      <Table.Td>{cari.il || '-'}</Table.Td>
                      <Table.Td>
                        <Text c={Number(cari.bakiye) >= 0 ? 'green' : 'red'} fw={500}>
                          {formatMoney(Number(cari.bakiye))}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            onClick={() => {
                              setSelectedCari(cari);
                              openDetail();
                            }}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="blue"
                            onClick={() => handleEdit(cari)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="red"
                            onClick={() => handleDelete(cari.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>

        {/* Form Modal */}
        <Modal
          opened={opened}
          onClose={() => {
            close();
            resetForm();
          }}
          title={editingItem ? 'Cari Düzenle' : 'Yeni Cari'}
          size="lg"
        >
          <Stack>
            <Select
              label="Tip"
              required
              data={[
                { value: 'musteri', label: 'Müşteri' },
                { value: 'tedarikci', label: 'Tedarikçi' },
                { value: 'her_ikisi', label: 'Her İkisi' }
              ]}
              value={formData.tip}
              onChange={(value) => setFormData({ ...formData, tip: value as any })}
            />
            
            <TextInput
              label="Ünvan"
              required
              value={formData.unvan}
              onChange={(e) => setFormData({ ...formData, unvan: e.target.value })}
            />
            
            <SimpleGrid cols={2}>
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
            
            <SimpleGrid cols={2}>
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
            
            <SimpleGrid cols={2}>
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
              <Button variant="light" onClick={() => {
                close();
                resetForm();
              }}>
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
