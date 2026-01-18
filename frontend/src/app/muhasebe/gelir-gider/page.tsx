'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Menu,
  Modal,
  NumberInput,
  rem,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCheck,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconFileSpreadsheet,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import StyledDatePicker from '@/components/ui/StyledDatePicker';
import 'dayjs/locale/tr';

// Tip tanımları
interface GelirGider {
  id: string;
  tip: 'gelir' | 'gider';
  kategori: string;
  aciklama: string;
  tutar: number;
  tarih: string;
  odemeYontemi: string;
  belgeNo: string;
  not: string;
  createdAt: string;
}

const STORAGE_KEY = 'muhasebe_gelir_gider';

// Kategoriler
const kategoriler = {
  gelir: ['İhale Ödemesi', 'Fatura Tahsilatı', 'Avans', 'Diğer Gelir'],
  gider: [
    'Personel',
    'Malzeme',
    'Kira',
    'Ulaşım',
    'Fatura',
    'Vergi',
    'Bakım/Onarım',
    'Diğer Gider',
  ],
};

const odemeYontemleri = ['Nakit', 'Banka Transferi', 'Kredi Kartı', 'Çek', 'Senet'];

// Demo veriler
const demoVeriler: GelirGider[] = [
  {
    id: '1',
    tip: 'gelir',
    kategori: 'İhale Ödemesi',
    aciklama: 'Metro Holding - Ocak ayı',
    tutar: 45000,
    tarih: '2026-01-02',
    odemeYontemi: 'Banka Transferi',
    belgeNo: 'FTR-2026-001',
    not: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    tip: 'gider',
    kategori: 'Personel',
    aciklama: 'Ocak Maaşları',
    tutar: 28500,
    tarih: '2026-01-01',
    odemeYontemi: 'Banka Transferi',
    belgeNo: '',
    not: '15 personel',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    tip: 'gelir',
    kategori: 'Fatura Tahsilatı',
    aciklama: 'Okul Yemekhane Faturası',
    tutar: 18750,
    tarih: '2025-12-30',
    odemeYontemi: 'Banka Transferi',
    belgeNo: 'FTR-2025-089',
    not: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    tip: 'gider',
    kategori: 'Malzeme',
    aciklama: 'Metro Market - Gıda Alımı',
    tutar: 12400,
    tarih: '2025-12-28',
    odemeYontemi: 'Nakit',
    belgeNo: 'ALM-2025-045',
    not: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    tip: 'gider',
    kategori: 'Ulaşım',
    aciklama: 'Araç Yakıt Gideri',
    tutar: 3200,
    tarih: '2025-12-27',
    odemeYontemi: 'Nakit',
    belgeNo: '',
    not: '3 araç',
    createdAt: new Date().toISOString(),
  },
  {
    id: '6',
    tip: 'gelir',
    kategori: 'İhale Ödemesi',
    aciklama: 'Belediye Kafeterya',
    tutar: 32000,
    tarih: '2025-12-25',
    odemeYontemi: 'Banka Transferi',
    belgeNo: 'FTR-2025-088',
    not: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: '7',
    tip: 'gider',
    kategori: 'Kira',
    aciklama: 'Depo Kirası - Ocak',
    tutar: 8500,
    tarih: '2025-12-24',
    odemeYontemi: 'Banka Transferi',
    belgeNo: '',
    not: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: '8',
    tip: 'gider',
    kategori: 'Fatura',
    aciklama: 'Elektrik Faturası',
    tutar: 4200,
    tarih: '2025-12-22',
    odemeYontemi: 'Banka Transferi',
    belgeNo: 'ELK-2025-012',
    not: '',
    createdAt: new Date().toISOString(),
  },
];

export default function GelirGiderPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [opened, { open, close }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [searchTerm, setSearchTerm] = useState('');
  const [islemler, setIslemler] = useState<GelirGider[]>([]);
  const [editingItem, setEditingItem] = useState<GelirGider | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    tip: 'gelir' as 'gelir' | 'gider',
    kategori: '',
    aciklama: '',
    tutar: 0,
    tarih: new Date(),
    odemeYontemi: 'Nakit',
    belgeNo: '',
    not: '',
  });

  // localStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setIslemler(JSON.parse(saved));
    } else {
      setIslemler(demoVeriler);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demoVeriler));
    }
  }, []);

  // localStorage'a kaydet
  const saveToStorage = (data: GelirGider[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setIslemler(data);
  };

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Tarih formatı
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR');
  };

  // Filtreleme
  const filteredIslemler = islemler
    .filter((islem) => {
      const matchesTab = activeTab === 'tumu' || islem.tip === activeTab;
      const matchesSearch =
        islem.aciklama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        islem.kategori.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

  // Toplamlar
  const toplamGelir = islemler
    .filter((i) => i.tip === 'gelir')
    .reduce((acc, i) => acc + i.tutar, 0);
  const toplamGider = islemler
    .filter((i) => i.tip === 'gider')
    .reduce((acc, i) => acc + i.tutar, 0);
  const netDurum = toplamGelir - toplamGider;

  // Yeni işlem ekle
  const handleSubmit = () => {
    if (!formData.kategori || !formData.aciklama || formData.tutar <= 0) {
      notifications.show({
        title: 'Hata!',
        message: 'Lütfen zorunlu alanları doldurun.',
        color: 'red',
      });
      return;
    }

    const newItem: GelirGider = {
      id: editingItem?.id || Date.now().toString(),
      tip: formData.tip,
      kategori: formData.kategori,
      aciklama: formData.aciklama,
      tutar: formData.tutar,
      tarih: formData.tarih.toISOString().split('T')[0],
      odemeYontemi: formData.odemeYontemi,
      belgeNo: formData.belgeNo,
      not: formData.not,
      createdAt: editingItem?.createdAt || new Date().toISOString(),
    };

    let newIslemler: GelirGider[];
    if (editingItem) {
      newIslemler = islemler.map((i) => (i.id === editingItem.id ? newItem : i));
    } else {
      newIslemler = [newItem, ...islemler];
    }

    saveToStorage(newIslemler);

    notifications.show({
      title: 'Başarılı!',
      message: editingItem
        ? 'İşlem güncellendi.'
        : `${formData.tip === 'gelir' ? 'Gelir' : 'Gider'} kaydı eklendi.`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });

    resetForm();
    close();
  };

  // Silme
  const handleDelete = (id: string) => {
    const newIslemler = islemler.filter((i) => i.id !== id);
    saveToStorage(newIslemler);
    notifications.show({
      title: 'Silindi',
      message: 'İşlem kaydı silindi.',
      color: 'orange',
    });
  };

  // Düzenleme
  const handleEdit = (item: GelirGider) => {
    setEditingItem(item);
    setFormData({
      tip: item.tip,
      kategori: item.kategori,
      aciklama: item.aciklama,
      tutar: item.tutar,
      tarih: new Date(item.tarih),
      odemeYontemi: item.odemeYontemi,
      belgeNo: item.belgeNo,
      not: item.not,
    });
    open();
  };

  // Form sıfırla
  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      tip: 'gelir',
      kategori: '',
      aciklama: '',
      tutar: 0,
      tarih: new Date(),
      odemeYontemi: 'Nakit',
      belgeNo: '',
      not: '',
    });
  };

  // Excel export
  const exportToExcel = () => {
    const headers = ['Tarih', 'Tip', 'Kategori', 'Açıklama', 'Tutar', 'Ödeme Yöntemi', 'Belge No'];
    const rows = filteredIslemler.map((i) => [
      formatDate(i.tarih),
      i.tip === 'gelir' ? 'Gelir' : 'Gider',
      i.kategori,
      i.aciklama,
      i.tip === 'gelir' ? i.tutar : -i.tutar,
      i.odemeYontemi,
      i.belgeNo,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gelir-gider-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    notifications.show({
      title: 'Excel İndirildi',
      message: 'Veriler CSV formatında indirildi.',
      color: 'blue',
      icon: <IconFileSpreadsheet size={16} />,
    });
  };

  return (
    <Box
      style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(20,184,166,0.05) 0%, rgba(0,0,0,0) 100%)'
          : 'linear-gradient(180deg, rgba(20,184,166,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh',
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>
                📊 Gelir / Gider
              </Title>
              <Text c="dimmed" size="lg">
                Tüm gelir ve gider hareketlerinizi yönetin
              </Text>
            </Box>
            <Button
              leftSection={<IconPlus size={18} />}
              variant="gradient"
              gradient={{ from: 'teal', to: 'cyan' }}
              onClick={() => {
                resetForm();
                open();
              }}
            >
              Yeni İşlem Ekle
            </Button>
          </Group>

          {/* Stats Cards */}
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Toplam Gelir
                </Text>
                <ThemeIcon color="green" variant="light" size="lg" radius="md">
                  <IconTrendingUp size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="green">
                {formatMoney(toplamGelir)}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                {islemler.filter((i) => i.tip === 'gelir').length} işlem
              </Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Toplam Gider
                </Text>
                <ThemeIcon color="red" variant="light" size="lg" radius="md">
                  <IconTrendingDown size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="red">
                {formatMoney(toplamGider)}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                {islemler.filter((i) => i.tip === 'gider').length} işlem
              </Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Net Durum
                </Text>
                <ThemeIcon
                  color={netDurum >= 0 ? 'teal' : 'red'}
                  variant="light"
                  size="lg"
                  radius="md"
                >
                  <IconReceipt size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c={netDurum >= 0 ? 'teal' : 'red'}>
                {formatMoney(netDurum)}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                {netDurum >= 0 ? 'Kâr' : 'Zarar'}
              </Text>
            </Card>
          </SimpleGrid>

          {/* Filters & Table */}
          <Card withBorder shadow="sm" p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="tumu">Tümü ({islemler.length})</Tabs.Tab>
                  <Tabs.Tab
                    value="gelir"
                    leftSection={<IconArrowUpRight size={14} />}
                    color="green"
                  >
                    Gelirler ({islemler.filter((i) => i.tip === 'gelir').length})
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="gider"
                    leftSection={<IconArrowDownRight size={14} />}
                    color="red"
                  >
                    Giderler ({islemler.filter((i) => i.tip === 'gider').length})
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs>
              <Group>
                <TextInput
                  placeholder="Ara..."
                  leftSection={<IconSearch size={16} />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.currentTarget.value)}
                  style={{ width: 200 }}
                />
                <Button
                  variant="light"
                  leftSection={<IconDownload size={16} />}
                  onClick={exportToExcel}
                >
                  Excel
                </Button>
              </Group>
            </Group>

            {/* Table */}
            <Table.ScrollContainer minWidth={700}>
              <Table verticalSpacing="sm" highlightOnHover striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tip</Table.Th>
                    <Table.Th>Kategori</Table.Th>
                    <Table.Th>Açıklama</Table.Th>
                    <Table.Th>Tarih</Table.Th>
                    <Table.Th>Ödeme</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: 80 }}>İşlem</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredIslemler.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text ta="center" c="dimmed" py="xl">
                          Kayıt bulunamadı
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    filteredIslemler.map((islem) => (
                      <Table.Tr key={islem.id}>
                        <Table.Td>
                          <ThemeIcon
                            color={islem.tip === 'gelir' ? 'green' : 'red'}
                            variant="light"
                            size="sm"
                            radius="xl"
                          >
                            {islem.tip === 'gelir' ? (
                              <IconArrowUpRight size={14} />
                            ) : (
                              <IconArrowDownRight size={14} />
                            )}
                          </ThemeIcon>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light"
                            color={islem.tip === 'gelir' ? 'green' : 'red'}
                            size="sm"
                          >
                            {islem.kategori}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {islem.aciklama}
                          </Text>
                          {islem.belgeNo && (
                            <Text size="xs" c="dimmed">
                              {islem.belgeNo}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {formatDate(islem.tarih)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {islem.odemeYontemi}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600} c={islem.tip === 'gelir' ? 'green' : 'red'}>
                            {islem.tip === 'gelir' ? '+' : '-'}
                            {formatMoney(islem.tutar)}
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
                                leftSection={
                                  <IconEdit style={{ width: rem(14), height: rem(14) }} />
                                }
                                onClick={() => handleEdit(islem)}
                              >
                                Düzenle
                              </Menu.Item>
                              <Menu.Item
                                color="red"
                                leftSection={
                                  <IconTrash style={{ width: rem(14), height: rem(14) }} />
                                }
                                onClick={() => handleDelete(islem.id)}
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
          onClose={() => {
            resetForm();
            close();
          }}
          title={<Title order={3}>{editingItem ? 'İşlemi Düzenle' : 'Yeni İşlem Ekle'}</Title>}
          size="md"
        >
          <Stack gap="md">
            <SegmentedControl
              fullWidth
              value={formData.tip}
              onChange={(value) =>
                setFormData({ ...formData, tip: value as 'gelir' | 'gider', kategori: '' })
              }
              data={[
                { label: '💰 Gelir', value: 'gelir' },
                { label: '💸 Gider', value: 'gider' },
              ]}
              color={formData.tip === 'gelir' ? 'green' : 'red'}
            />

            <Select
              label="Kategori"
              placeholder="Kategori seçin"
              data={kategoriler[formData.tip]}
              value={formData.kategori}
              onChange={(value) => setFormData({ ...formData, kategori: value || '' })}
              required
            />

            <TextInput
              label="Açıklama"
              placeholder="İşlem açıklaması"
              value={formData.aciklama}
              onChange={(e) => setFormData({ ...formData, aciklama: e.currentTarget.value })}
              required
            />

            <NumberInput
              label="Tutar (₺)"
              placeholder="0"
              min={0}
              value={formData.tutar}
              onChange={(value) => setFormData({ ...formData, tutar: Number(value) || 0 })}
              thousandSeparator="."
              decimalSeparator=","
              required
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <StyledDatePicker
                label="Tarih"
                placeholder="Tarih seçin"
                value={formData.tarih}
                onChange={(value) => setFormData({ ...formData, tarih: value || new Date() })}
              />

              <Select
                label="Ödeme Yöntemi"
                data={odemeYontemleri}
                value={formData.odemeYontemi}
                onChange={(value) => setFormData({ ...formData, odemeYontemi: value || 'Nakit' })}
              />
            </SimpleGrid>

            <TextInput
              label="Belge No"
              placeholder="Fatura/Makbuz No (opsiyonel)"
              value={formData.belgeNo}
              onChange={(e) => setFormData({ ...formData, belgeNo: e.currentTarget.value })}
            />

            <Textarea
              label="Not"
              placeholder="Opsiyonel not..."
              rows={2}
              value={formData.not}
              onChange={(e) => setFormData({ ...formData, not: e.currentTarget.value })}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  resetForm();
                  close();
                }}
              >
                İptal
              </Button>
              <Button color={formData.tip === 'gelir' ? 'green' : 'red'} onClick={handleSubmit}>
                {editingItem ? 'Güncelle' : 'Kaydet'}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Container>
    </Box>
  );
}
