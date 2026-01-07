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
  Divider
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
  IconFileInvoice
} from '@tabler/icons-react';

// Tip tanımları
interface Cari {
  id: string;
  tip: 'musteri' | 'tedarikci' | 'her_ikisi';
  unvan: string;
  yetkili: string;
  vergiNo: string;
  telefon: string;
  email: string;
  adres: string;
  il: string;
  borc: number;
  alacak: number;
  notlar: string;
  createdAt: string;
}

const STORAGE_KEY = 'muhasebe_cariler';

// Şehirler
const iller = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep',
  'Mersin', 'Diyarbakır', 'Kayseri', 'Eskişehir', 'Samsun', 'Denizli', 'Şanlıurfa', 'Diğer'
];

// Demo veriler
const demoVeriler: Cari[] = [
  { id: '1', tip: 'musteri', unvan: 'Metro Holding A.Ş.', yetkili: 'Ahmet Yılmaz', vergiNo: '1234567890', telefon: '0212 555 1234', email: 'info@metro.com', adres: 'Maslak Mah. Büyükdere Cad. No:123', il: 'İstanbul', borc: 0, alacak: 45000, notlar: 'Aylık sözleşmeli', createdAt: new Date().toISOString() },
  { id: '2', tip: 'tedarikci', unvan: 'ABC Gıda Ltd. Şti.', yetkili: 'Mehmet Demir', vergiNo: '9876543210', telefon: '0216 444 5678', email: 'satis@abcgida.com', adres: 'Organize Sanayi Bölgesi 5. Cad. No:42', il: 'İstanbul', borc: 15600, alacak: 0, notlar: 'Haftalık teslimat', createdAt: new Date().toISOString() },
  { id: '3', tip: 'musteri', unvan: 'Belediye Sosyal Tesisler', yetkili: 'Ayşe Kaya', vergiNo: '5678901234', telefon: '0312 333 9999', email: 'sosyal@belediye.gov.tr', adres: 'Atatürk Bulvarı No:50', il: 'Ankara', borc: 0, alacak: 32000, notlar: 'Kamu kurumu', createdAt: new Date().toISOString() },
  { id: '4', tip: 'tedarikci', unvan: 'XYZ Malzeme A.Ş.', yetkili: 'Ali Öztürk', vergiNo: '4567890123', telefon: '0232 222 3456', email: 'siparis@xyz.com', adres: 'Sanayi Sitesi B Blok No:15', il: 'İzmir', borc: 8900, alacak: 0, notlar: '', createdAt: new Date().toISOString() },
  { id: '5', tip: 'her_ikisi', unvan: 'Temizlik Hizmetleri Ltd.', yetkili: 'Fatma Şahin', vergiNo: '3456789012', telefon: '0224 111 7890', email: 'info@temizlik.com', adres: 'Nilüfer Mah. Çiçek Sok. No:8', il: 'Bursa', borc: 4500, alacak: 2000, notlar: 'Hem müşteri hem tedarikçi', createdAt: new Date().toISOString() },
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

  // Form state
  const [formData, setFormData] = useState({
    tip: 'musteri' as 'musteri' | 'tedarikci' | 'her_ikisi',
    unvan: '',
    yetkili: '',
    vergiNo: '',
    telefon: '',
    email: '',
    adres: '',
    il: '',
    borc: 0,
    alacak: 0,
    notlar: ''
  });

  // localStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setCariler(JSON.parse(saved));
    } else {
      setCariler(demoVeriler);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demoVeriler));
    }
  }, []);

  // localStorage'a kaydet
  const saveToStorage = (data: Cari[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setCariler(data);
  };

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Filtreleme
  const filteredCariler = cariler.filter(cari => {
    const matchesTab = activeTab === 'tumu' || cari.tip === activeTab || 
                      (activeTab === 'musteri' && cari.tip === 'her_ikisi') ||
                      (activeTab === 'tedarikci' && cari.tip === 'her_ikisi');
    const matchesSearch = cari.unvan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cari.yetkili.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Toplamlar
  const toplamMusteri = cariler.filter(c => c.tip === 'musteri' || c.tip === 'her_ikisi').length;
  const toplamTedarikci = cariler.filter(c => c.tip === 'tedarikci' || c.tip === 'her_ikisi').length;
  const toplamAlacak = cariler.reduce((acc, c) => acc + c.alacak, 0);
  const toplamBorc = cariler.reduce((acc, c) => acc + c.borc, 0);

  // Bakiye hesapla
  const getBakiye = (cari: Cari) => cari.alacak - cari.borc;

  // Kaydet
  const handleSubmit = () => {
    if (!formData.unvan) {
      notifications.show({
        title: 'Hata!',
        message: 'Lütfen cari ünvanını girin.',
        color: 'red',
      });
      return;
    }

    const newItem: Cari = {
      id: editingItem?.id || Date.now().toString(),
      ...formData,
      createdAt: editingItem?.createdAt || new Date().toISOString(),
    };

    let newCariler: Cari[];
    if (editingItem) {
      newCariler = cariler.map(c => c.id === editingItem.id ? newItem : c);
    } else {
      newCariler = [newItem, ...cariler];
    }

    saveToStorage(newCariler);

    notifications.show({
      title: 'Başarılı!',
      message: editingItem ? 'Cari güncellendi.' : 'Yeni cari eklendi.',
      color: 'green',
      icon: <IconCheck size={16} />,
    });

    resetForm();
    close();
  };

  // Silme
  const handleDelete = (id: string) => {
    const newCariler = cariler.filter(c => c.id !== id);
    saveToStorage(newCariler);
    notifications.show({
      title: 'Silindi',
      message: 'Cari kaydı silindi.',
      color: 'orange',
    });
  };

  // Düzenleme
  const handleEdit = (item: Cari) => {
    setEditingItem(item);
    setFormData({
      tip: item.tip,
      unvan: item.unvan,
      yetkili: item.yetkili,
      vergiNo: item.vergiNo,
      telefon: item.telefon,
      email: item.email,
      adres: item.adres,
      il: item.il,
      borc: item.borc,
      alacak: item.alacak,
      notlar: item.notlar
    });
    open();
  };

  // Detay görüntüle
  const handleViewDetail = (cari: Cari) => {
    setSelectedCari(cari);
    openDetail();
  };

  // Form sıfırla
  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      tip: 'musteri',
      unvan: '',
      yetkili: '',
      vergiNo: '',
      telefon: '',
      email: '',
      adres: '',
      il: '',
      borc: 0,
      alacak: 0,
      notlar: ''
    });
  };

  // Tip badge'i
  const getTipBadge = (tip: string) => {
    switch (tip) {
      case 'musteri':
        return <Badge color="blue" variant="light">Müşteri</Badge>;
      case 'tedarikci':
        return <Badge color="orange" variant="light">Tedarikçi</Badge>;
      case 'her_ikisi':
        return <Badge color="violet" variant="light">Müşteri/Tedarikçi</Badge>;
      default:
        return null;
    }
  };

  return (
    <Box 
      style={{ 
        background: isDark 
          ? 'linear-gradient(180deg, rgba(59,130,246,0.05) 0%, rgba(0,0,0,0) 100%)' 
          : 'linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh' 
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>
                👥 Cari Hesaplar
              </Title>
              <Text c="dimmed" size="lg">
                Müşteri ve tedarikçi hesaplarınızı yönetin
              </Text>
            </Box>
            <Button
              leftSection={<IconPlus size={18} />}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              onClick={() => { resetForm(); open(); }}
            >
              Yeni Cari Ekle
            </Button>
          </Group>

          {/* Stats Cards */}
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Cari</Text>
                <ThemeIcon color="gray" variant="light" size="lg" radius="md">
                  <IconUsers size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md">{cariler.length}</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Müşteriler</Text>
                <ThemeIcon color="blue" variant="light" size="lg" radius="md">
                  <IconUserCheck size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md">{toplamMusteri}</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Tedarikçiler</Text>
                <ThemeIcon color="orange" variant="light" size="lg" radius="md">
                  <IconTruck size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md">{toplamTedarikci}</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Net Bakiye</Text>
                <ThemeIcon color={toplamAlacak - toplamBorc >= 0 ? 'green' : 'red'} variant="light" size="lg" radius="md">
                  <IconCash size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c={toplamAlacak - toplamBorc >= 0 ? 'green' : 'red'}>
                {formatMoney(toplamAlacak - toplamBorc)}
              </Text>
            </Card>
          </SimpleGrid>

          {/* Filters & Table */}
          <Card withBorder shadow="sm" p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="tumu">Tümü ({cariler.length})</Tabs.Tab>
                  <Tabs.Tab value="musteri" leftSection={<IconUserCheck size={14} />} color="blue">
                    Müşteriler
                  </Tabs.Tab>
                  <Tabs.Tab value="tedarikci" leftSection={<IconTruck size={14} />} color="orange">
                    Tedarikçiler
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs>
              <TextInput
                placeholder="Cari ara..."
                leftSection={<IconSearch size={16} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                style={{ width: 250 }}
              />
            </Group>

            {/* Table */}
            <Table.ScrollContainer minWidth={800}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Cari</Table.Th>
                    <Table.Th>Tip</Table.Th>
                    <Table.Th>İletişim</Table.Th>
                    <Table.Th>İl</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Alacak</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Borç</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Bakiye</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: 80 }}>İşlem</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredCariler.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={8}>
                        <Text ta="center" c="dimmed" py="xl">Kayıt bulunamadı</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    filteredCariler.map((cari) => (
                      <Table.Tr key={cari.id}>
                        <Table.Td>
                          <Group gap="sm">
                            <Avatar color={cari.tip === 'musteri' ? 'blue' : cari.tip === 'tedarikci' ? 'orange' : 'violet'} radius="xl">
                              {cari.unvan.substring(0, 2).toUpperCase()}
                            </Avatar>
                            <div>
                              <Text size="sm" fw={500}>{cari.unvan}</Text>
                              <Text size="xs" c="dimmed">{cari.yetkili}</Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>{getTipBadge(cari.tip)}</Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{cari.telefon}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{cari.il}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" c="green" fw={500}>
                            {cari.alacak > 0 ? formatMoney(cari.alacak) : '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" c="red" fw={500}>
                            {cari.borc > 0 ? formatMoney(cari.borc) : '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600} c={getBakiye(cari) >= 0 ? 'green' : 'red'}>
                            {formatMoney(getBakiye(cari))}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<IconEye style={{ width: rem(14), height: rem(14) }} />}
                                onClick={() => handleViewDetail(cari)}
                              >
                                Detay
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />}
                                onClick={() => handleEdit(cari)}
                              >
                                Düzenle
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
                                onClick={() => handleDelete(cari.id)}
                              >
                                Sil
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Stack>

        {/* Add/Edit Modal */}
        <Modal 
          opened={opened} 
          onClose={() => { resetForm(); close(); }} 
          title={<Title order={3}>{editingItem ? 'Cari Düzenle' : 'Yeni Cari Ekle'}</Title>}
          size="lg"
        >
          <Stack gap="md">
            <Select
              label="Cari Tipi"
              data={[
                { label: '👤 Müşteri', value: 'musteri' },
                { label: '🚚 Tedarikçi', value: 'tedarikci' },
                { label: '🔄 Her İkisi', value: 'her_ikisi' },
              ]}
              value={formData.tip}
              onChange={(value) => setFormData({ ...formData, tip: value as any })}
              required
            />

            <TextInput
              label="Ünvan / Firma Adı"
              placeholder="Firma ünvanı"
              value={formData.unvan}
              onChange={(e) => setFormData({ ...formData, unvan: e.currentTarget.value })}
              required
            />

            <SimpleGrid cols={2}>
              <TextInput
                label="Yetkili Kişi"
                placeholder="Ad Soyad"
                value={formData.yetkili}
                onChange={(e) => setFormData({ ...formData, yetkili: e.currentTarget.value })}
              />
              <TextInput
                label="Vergi No / TC"
                placeholder="Vergi numarası"
                value={formData.vergiNo}
                onChange={(e) => setFormData({ ...formData, vergiNo: e.currentTarget.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={2}>
              <TextInput
                label="Telefon"
                placeholder="0xxx xxx xxxx"
                leftSection={<IconPhone size={16} />}
                value={formData.telefon}
                onChange={(e) => setFormData({ ...formData, telefon: e.currentTarget.value })}
              />
              <TextInput
                label="E-posta"
                placeholder="email@firma.com"
                leftSection={<IconMail size={16} />}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.currentTarget.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Adres"
                placeholder="Açık adres"
                leftSection={<IconMapPin size={16} />}
                value={formData.adres}
                onChange={(e) => setFormData({ ...formData, adres: e.currentTarget.value })}
              />
              <Select
                label="İl"
                placeholder="İl seçin"
                data={iller}
                value={formData.il}
                onChange={(value) => setFormData({ ...formData, il: value || '' })}
                searchable
              />
            </SimpleGrid>

            <Divider label="Bakiye Bilgileri" labelPosition="center" />

            <SimpleGrid cols={2}>
              <TextInput
                label="Alacak (₺)"
                placeholder="0"
                leftSection={<IconArrowUpRight size={16} />}
                value={formData.alacak.toString()}
                onChange={(e) => setFormData({ ...formData, alacak: Number(e.currentTarget.value) || 0 })}
                type="number"
              />
              <TextInput
                label="Borç (₺)"
                placeholder="0"
                leftSection={<IconArrowDownRight size={16} />}
                value={formData.borc.toString()}
                onChange={(e) => setFormData({ ...formData, borc: Number(e.currentTarget.value) || 0 })}
                type="number"
              />
            </SimpleGrid>

            <Textarea
              label="Notlar"
              placeholder="Ek notlar..."
              rows={2}
              value={formData.notlar}
              onChange={(e) => setFormData({ ...formData, notlar: e.currentTarget.value })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => { resetForm(); close(); }}>İptal</Button>
              <Button color="blue" onClick={handleSubmit}>
                {editingItem ? 'Güncelle' : 'Kaydet'}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Detail Modal */}
        <Modal 
          opened={detailOpened} 
          onClose={closeDetail} 
          title={<Title order={3}>Cari Detayı</Title>}
          size="lg"
        >
          {selectedCari && (
            <Stack gap="md">
              <Group>
                <Avatar size="xl" color={selectedCari.tip === 'musteri' ? 'blue' : selectedCari.tip === 'tedarikci' ? 'orange' : 'violet'} radius="xl">
                  {selectedCari.unvan.substring(0, 2).toUpperCase()}
                </Avatar>
                <div>
                  <Text size="xl" fw={700}>{selectedCari.unvan}</Text>
                  <Group gap="xs">
                    {getTipBadge(selectedCari.tip)}
                    <Text size="sm" c="dimmed">{selectedCari.yetkili}</Text>
                  </Group>
                </div>
              </Group>

              <Divider />

              <SimpleGrid cols={2}>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>İletişim</Text>
                  <Stack gap="xs" mt="sm">
                    <Group gap="xs">
                      <IconPhone size={14} />
                      <Text size="sm">{selectedCari.telefon || '-'}</Text>
                    </Group>
                    <Group gap="xs">
                      <IconMail size={14} />
                      <Text size="sm">{selectedCari.email || '-'}</Text>
                    </Group>
                    <Group gap="xs">
                      <IconMapPin size={14} />
                      <Text size="sm">{selectedCari.adres || '-'}, {selectedCari.il}</Text>
                    </Group>
                  </Stack>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Bakiye Durumu</Text>
                  <Stack gap="xs" mt="sm">
                    <Group justify="space-between">
                      <Text size="sm">Alacak:</Text>
                      <Text size="sm" c="green" fw={600}>{formatMoney(selectedCari.alacak)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Borç:</Text>
                      <Text size="sm" c="red" fw={600}>{formatMoney(selectedCari.borc)}</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>Net Bakiye:</Text>
                      <Text size="lg" c={getBakiye(selectedCari) >= 0 ? 'green' : 'red'} fw={700}>
                        {formatMoney(getBakiye(selectedCari))}
                      </Text>
                    </Group>
                  </Stack>
                </Paper>
              </SimpleGrid>

              {selectedCari.notlar && (
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Notlar</Text>
                  <Text size="sm" mt="sm">{selectedCari.notlar}</Text>
                </Paper>
              )}

              <Group justify="flex-end">
                <Button variant="light" leftSection={<IconFileInvoice size={16} />}>
                  Hesap Ekstresi
                </Button>
                <Button variant="default" onClick={closeDetail}>Kapat</Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Container>
    </Box>
  );
}
