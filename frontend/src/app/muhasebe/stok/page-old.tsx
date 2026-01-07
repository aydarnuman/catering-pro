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
  NumberInput,
  Textarea,
  Tabs,
  useMantineColorScheme,
  Paper,
  Menu,
  rem,
  Progress,
  RingProgress
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconPackage,
  IconPackages,
  IconAlertTriangle,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconCheck,
  IconTrendingUp,
  IconTrendingDown,
  IconArrowsExchange,
  IconBarcode,
  IconCategory,
  IconChartBar
} from '@tabler/icons-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Tip tanımları
interface StokItem {
  id: string;
  kod: string;
  ad: string;
  kategori: string;
  birim: string;
  miktar: number;
  minStok: number;
  maxStok: number;
  birimFiyat: number;
  tedarikci: string;
  raf: string;
  barkod: string;
  notlar: string;
  createdAt: string;
}

interface StokHareket {
  id: string;
  stokId: string;
  tip: 'giris' | 'cikis';
  miktar: number;
  aciklama: string;
  tarih: string;
}

const STOK_KEY = 'muhasebe_stok';
const HAREKET_KEY = 'muhasebe_stok_hareket';

// Kategoriler
const kategoriler = ['Gıda', 'İçecek', 'Temizlik', 'Ambalaj', 'Mutfak Ekipman', 'Tüketim Malzeme', 'Diğer'];
const birimler = ['Kg', 'Adet', 'Lt', 'Paket', 'Koli', 'Porsiyon', 'Metre', 'Kutu'];

const COLORS = ['#4dabf7', '#51cf66', '#ff922b', '#ff6b6b', '#845ef7', '#339af0', '#20c997', '#f06595'];

// Demo veriler
const demoStoklar: StokItem[] = [
  { id: '1', kod: 'GD001', ad: 'Pirinç', kategori: 'Gıda', birim: 'Kg', miktar: 250, minStok: 100, maxStok: 500, birimFiyat: 45, tedarikci: 'ABC Gıda', raf: 'A-1', barkod: '8690001000001', notlar: '', createdAt: new Date().toISOString() },
  { id: '2', kod: 'GD002', ad: 'Zeytinyağı', kategori: 'Gıda', birim: 'Lt', miktar: 85, minStok: 50, maxStok: 200, birimFiyat: 180, tedarikci: 'ABC Gıda', raf: 'A-2', barkod: '8690001000002', notlar: '', createdAt: new Date().toISOString() },
  { id: '3', kod: 'TM001', ad: 'Bulaşık Deterjanı', kategori: 'Temizlik', birim: 'Lt', miktar: 25, minStok: 20, maxStok: 100, birimFiyat: 85, tedarikci: 'XYZ Malzeme', raf: 'B-1', barkod: '8690001000003', notlar: 'Kritik stok!', createdAt: new Date().toISOString() },
  { id: '4', kod: 'IC001', ad: 'Su (0.5Lt)', kategori: 'İçecek', birim: 'Adet', miktar: 480, minStok: 200, maxStok: 1000, birimFiyat: 5, tedarikci: 'Su Deposu', raf: 'C-1', barkod: '8690001000004', notlar: '', createdAt: new Date().toISOString() },
  { id: '5', kod: 'AM001', ad: 'Tek Kullanımlık Tabak', kategori: 'Ambalaj', birim: 'Paket', miktar: 45, minStok: 30, maxStok: 150, birimFiyat: 120, tedarikci: 'Ambalaj Ltd', raf: 'D-1', barkod: '8690001000005', notlar: '', createdAt: new Date().toISOString() },
  { id: '6', kod: 'GD003', ad: 'Makarna', kategori: 'Gıda', birim: 'Kg', miktar: 180, minStok: 80, maxStok: 300, birimFiyat: 35, tedarikci: 'ABC Gıda', raf: 'A-3', barkod: '8690001000006', notlar: '', createdAt: new Date().toISOString() },
  { id: '7', kod: 'GD004', ad: 'Domates Salçası', kategori: 'Gıda', birim: 'Kg', miktar: 15, minStok: 25, maxStok: 80, birimFiyat: 95, tedarikci: 'ABC Gıda', raf: 'A-4', barkod: '8690001000007', notlar: 'Stok tükeniyor!', createdAt: new Date().toISOString() },
  { id: '8', kod: 'ME001', ad: 'Çatal (Paslanmaz)', kategori: 'Mutfak Ekipman', birim: 'Adet', miktar: 200, minStok: 100, maxStok: 500, birimFiyat: 25, tedarikci: 'Mutfak Market', raf: 'E-1', barkod: '8690001000008', notlar: '', createdAt: new Date().toISOString() },
];

export default function StokPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [opened, { open, close }] = useDisclosure(false);
  const [hareketOpened, { open: openHareket, close: closeHareket }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [searchTerm, setSearchTerm] = useState('');
  const [stoklar, setStoklar] = useState<StokItem[]>([]);
  const [editingItem, setEditingItem] = useState<StokItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    kod: '',
    ad: '',
    kategori: '',
    birim: 'Adet',
    miktar: 0,
    minStok: 0,
    maxStok: 0,
    birimFiyat: 0,
    tedarikci: '',
    raf: '',
    barkod: '',
    notlar: ''
  });

  const [hareketForm, setHareketForm] = useState({
    stokId: '',
    tip: 'giris' as 'giris' | 'cikis',
    miktar: 0,
    aciklama: ''
  });

  // localStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem(STOK_KEY);
    if (saved) {
      setStoklar(JSON.parse(saved));
    } else {
      setStoklar(demoStoklar);
      localStorage.setItem(STOK_KEY, JSON.stringify(demoStoklar));
    }
  }, []);

  // localStorage'a kaydet
  const saveToStorage = (data: StokItem[]) => {
    localStorage.setItem(STOK_KEY, JSON.stringify(data));
    setStoklar(data);
  };

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(value);
  };

  // Stok durumu
  const getStokDurum = (item: StokItem) => {
    const yuzde = (item.miktar / item.maxStok) * 100;
    if (item.miktar <= item.minStok) return { color: 'red', label: 'Kritik', yuzde };
    if (yuzde < 30) return { color: 'orange', label: 'Düşük', yuzde };
    if (yuzde > 80) return { color: 'blue', label: 'Yüksek', yuzde };
    return { color: 'green', label: 'Normal', yuzde };
  };

  // Filtreleme
  const filteredStoklar = stoklar.filter(item => {
    const matchesTab = activeTab === 'tumu' || 
                      (activeTab === 'kritik' && item.miktar <= item.minStok) ||
                      (activeTab === 'dusuk' && item.miktar > item.minStok && (item.miktar / item.maxStok) < 0.3) ||
                      item.kategori === activeTab;
    const matchesSearch = item.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.kod.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Toplamlar
  const toplamKalem = stoklar.length;
  const kritikStok = stoklar.filter(s => s.miktar <= s.minStok).length;
  const toplamDeger = stoklar.reduce((acc, s) => acc + (s.miktar * s.birimFiyat), 0);

  // Kategori dağılımı
  const kategoriDagilimi = kategoriler.map(kat => ({
    name: kat,
    value: stoklar.filter(s => s.kategori === kat).reduce((acc, s) => acc + (s.miktar * s.birimFiyat), 0)
  })).filter(k => k.value > 0);

  // Kaydet
  const handleSubmit = () => {
    if (!formData.ad || !formData.kategori) {
      notifications.show({ title: 'Hata!', message: 'Lütfen zorunlu alanları doldurun.', color: 'red' });
      return;
    }

    const newItem: StokItem = {
      id: editingItem?.id || Date.now().toString(),
      kod: formData.kod || `STK${String(stoklar.length + 1).padStart(3, '0')}`,
      ...formData,
      createdAt: editingItem?.createdAt || new Date().toISOString(),
    };

    let newStoklar: StokItem[];
    if (editingItem) {
      newStoklar = stoklar.map(s => s.id === editingItem.id ? newItem : s);
    } else {
      newStoklar = [newItem, ...stoklar];
    }

    saveToStorage(newStoklar);
    notifications.show({ title: 'Başarılı!', message: 'Stok kaydedildi.', color: 'green', icon: <IconCheck size={16} /> });
    resetForm();
    close();
  };

  // Stok hareketi kaydet
  const handleHareketSubmit = () => {
    if (!hareketForm.stokId || hareketForm.miktar <= 0) {
      notifications.show({ title: 'Hata!', message: 'Lütfen ürün ve miktar girin.', color: 'red' });
      return;
    }

    const updatedStoklar = stoklar.map(s => {
      if (s.id === hareketForm.stokId) {
        const yeniMiktar = hareketForm.tip === 'giris' 
          ? s.miktar + hareketForm.miktar 
          : Math.max(0, s.miktar - hareketForm.miktar);
        return { ...s, miktar: yeniMiktar };
      }
      return s;
    });

    saveToStorage(updatedStoklar);
    notifications.show({ 
      title: 'Başarılı!', 
      message: `Stok ${hareketForm.tip === 'giris' ? 'girişi' : 'çıkışı'} kaydedildi.`, 
      color: hareketForm.tip === 'giris' ? 'green' : 'orange',
      icon: <IconCheck size={16} /> 
    });
    setHareketForm({ stokId: '', tip: 'giris', miktar: 0, aciklama: '' });
    closeHareket();
  };

  // Silme
  const handleDelete = (id: string) => {
    saveToStorage(stoklar.filter(s => s.id !== id));
    notifications.show({ title: 'Silindi', message: 'Stok kaydı silindi.', color: 'orange' });
  };

  // Düzenleme
  const handleEdit = (item: StokItem) => {
    setEditingItem(item);
    setFormData({
      kod: item.kod,
      ad: item.ad,
      kategori: item.kategori,
      birim: item.birim,
      miktar: item.miktar,
      minStok: item.minStok,
      maxStok: item.maxStok,
      birimFiyat: item.birimFiyat,
      tedarikci: item.tedarikci,
      raf: item.raf,
      barkod: item.barkod,
      notlar: item.notlar
    });
    open();
  };

  // Form sıfırla
  const resetForm = () => {
    setEditingItem(null);
    setFormData({ kod: '', ad: '', kategori: '', birim: 'Adet', miktar: 0, minStok: 0, maxStok: 0, birimFiyat: 0, tedarikci: '', raf: '', barkod: '', notlar: '' });
  };

  return (
    <Box 
      style={{ 
        background: isDark 
          ? 'linear-gradient(180deg, rgba(255,146,43,0.05) 0%, rgba(0,0,0,0) 100%)' 
          : 'linear-gradient(180deg, rgba(255,146,43,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh' 
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>📦 Stok Yönetimi</Title>
              <Text c="dimmed" size="lg">Ürün ve malzeme stoklarınızı takip edin</Text>
            </Box>
            <Group>
              <Button leftSection={<IconArrowsExchange size={18} />} variant="light" onClick={openHareket}>
                Stok Hareketi
              </Button>
              <Button leftSection={<IconPlus size={18} />} variant="gradient" gradient={{ from: 'orange', to: 'red' }} onClick={() => { resetForm(); open(); }}>
                Yeni Ürün
              </Button>
            </Group>
          </Group>

          {/* Stats Cards */}
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Ürün</Text>
                <ThemeIcon color="blue" variant="light" size="lg" radius="md"><IconPackages size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md">{toplamKalem}</Text>
              <Text size="xs" c="dimmed">ürün çeşidi</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Kritik Stok</Text>
                <ThemeIcon color="red" variant="light" size="lg" radius="md"><IconAlertTriangle size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="red">{kritikStok}</Text>
              <Text size="xs" c="dimmed">ürün</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Stok Değeri</Text>
                <ThemeIcon color="green" variant="light" size="lg" radius="md"><IconChartBar size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="green">{formatMoney(toplamDeger)}</Text>
              <Text size="xs" c="dimmed">toplam değer</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Kategori</Text>
                <ThemeIcon color="violet" variant="light" size="lg" radius="md"><IconCategory size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md">{new Set(stoklar.map(s => s.kategori)).size}</Text>
              <Text size="xs" c="dimmed">farklı kategori</Text>
            </Card>
          </SimpleGrid>

          {/* Grafik */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Text fw={600} size="lg" mb="md">Kategori Bazlı Stok Değeri</Text>
              <Box h={250}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={kategoriDagilimi}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {kategoriDagilimi.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => formatMoney(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Card>

            <Card withBorder shadow="sm" p="lg" radius="md">
              <Text fw={600} size="lg" mb="md">Kritik Stok Uyarıları</Text>
              <Stack gap="sm">
                {stoklar.filter(s => s.miktar <= s.minStok).slice(0, 5).map(item => (
                  <Paper key={item.id} withBorder p="sm" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>{item.ad}</Text>
                        <Text size="xs" c="dimmed">{item.kod} • {item.kategori}</Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={600} c="red">{item.miktar} {item.birim}</Text>
                        <Text size="xs" c="dimmed">Min: {item.minStok}</Text>
                      </div>
                    </Group>
                    <Progress value={(item.miktar / item.minStok) * 100} color="red" size="xs" mt="xs" />
                  </Paper>
                ))}
                {stoklar.filter(s => s.miktar <= s.minStok).length === 0 && (
                  <Text c="dimmed" ta="center" py="xl">Kritik stok yok 👍</Text>
                )}
              </Stack>
            </Card>
          </SimpleGrid>

          {/* Table */}
          <Card withBorder shadow="sm" p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="tumu">Tümü ({stoklar.length})</Tabs.Tab>
                  <Tabs.Tab value="kritik" color="red">Kritik ({kritikStok})</Tabs.Tab>
                  <Tabs.Tab value="Gıda">Gıda</Tabs.Tab>
                  <Tabs.Tab value="Temizlik">Temizlik</Tabs.Tab>
                </Tabs.List>
              </Tabs>
              <TextInput placeholder="Ürün ara..." leftSection={<IconSearch size={16} />} value={searchTerm} onChange={(e) => setSearchTerm(e.currentTarget.value)} style={{ width: 250 }} />
            </Group>

            <Table.ScrollContainer minWidth={900}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Kod</Table.Th>
                    <Table.Th>Ürün</Table.Th>
                    <Table.Th>Kategori</Table.Th>
                    <Table.Th>Miktar</Table.Th>
                    <Table.Th>Durum</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>B.Fiyat</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Değer</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: 80 }}>İşlem</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredStoklar.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={8}><Text ta="center" c="dimmed" py="xl">Ürün bulunamadı</Text></Table.Td></Table.Tr>
                  ) : (
                    filteredStoklar.map((item) => {
                      const durum = getStokDurum(item);
                      return (
                        <Table.Tr key={item.id}>
                          <Table.Td><Text size="sm" fw={500}>{item.kod}</Text></Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>{item.ad}</Text>
                            {item.raf && <Text size="xs" c="dimmed">Raf: {item.raf}</Text>}
                          </Table.Td>
                          <Table.Td><Badge variant="light" color="gray">{item.kategori}</Badge></Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>{item.miktar} {item.birim}</Text>
                            <Text size="xs" c="dimmed">Min: {item.minStok} / Max: {item.maxStok}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <RingProgress size={35} thickness={4} roundCaps sections={[{ value: durum.yuzde, color: durum.color }]} />
                              <Badge color={durum.color} variant="light" size="sm">{durum.label}</Badge>
                            </Group>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text size="sm">{formatMoney(item.birimFiyat)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={600}>{formatMoney(item.miktar * item.birimFiyat)}</Text></Table.Td>
                          <Table.Td>
                            <Menu position="bottom-end" shadow="md">
                              <Menu.Target>
                                <ActionIcon variant="subtle" color="gray"><IconDotsVertical size={16} /></ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item leftSection={<IconTrendingUp style={{ width: rem(14), height: rem(14) }} />} color="green" onClick={() => { setHareketForm({ ...hareketForm, stokId: item.id, tip: 'giris' }); openHareket(); }}>Giriş</Menu.Item>
                                <Menu.Item leftSection={<IconTrendingDown style={{ width: rem(14), height: rem(14) }} />} color="orange" onClick={() => { setHareketForm({ ...hareketForm, stokId: item.id, tip: 'cikis' }); openHareket(); }}>Çıkış</Menu.Item>
                                <Menu.Divider />
                                <Menu.Item leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />} onClick={() => handleEdit(item)}>Düzenle</Menu.Item>
                                <Menu.Item color="red" leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />} onClick={() => handleDelete(item.id)}>Sil</Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Stack>

        {/* Ürün Modal */}
        <Modal opened={opened} onClose={() => { resetForm(); close(); }} title={<Title order={3}>{editingItem ? 'Ürün Düzenle' : 'Yeni Ürün'}</Title>} size="lg">
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <TextInput label="Ürün Kodu" placeholder="Otomatik" value={formData.kod} onChange={(e) => setFormData({ ...formData, kod: e.currentTarget.value })} />
              <TextInput label="Ürün Adı" placeholder="Ürün adı" value={formData.ad} onChange={(e) => setFormData({ ...formData, ad: e.currentTarget.value })} required />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <Select label="Kategori" placeholder="Seçin" data={kategoriler} value={formData.kategori} onChange={(v) => setFormData({ ...formData, kategori: v || '' })} required />
              <Select label="Birim" data={birimler} value={formData.birim} onChange={(v) => setFormData({ ...formData, birim: v || 'Adet' })} />
            </SimpleGrid>
            <SimpleGrid cols={3}>
              <NumberInput label="Miktar" value={formData.miktar} onChange={(v) => setFormData({ ...formData, miktar: Number(v) || 0 })} min={0} />
              <NumberInput label="Min Stok" value={formData.minStok} onChange={(v) => setFormData({ ...formData, minStok: Number(v) || 0 })} min={0} />
              <NumberInput label="Max Stok" value={formData.maxStok} onChange={(v) => setFormData({ ...formData, maxStok: Number(v) || 0 })} min={0} />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <NumberInput label="Birim Fiyat (₺)" value={formData.birimFiyat} onChange={(v) => setFormData({ ...formData, birimFiyat: Number(v) || 0 })} min={0} decimalScale={2} />
              <TextInput label="Tedarikçi" placeholder="Tedarikçi adı" value={formData.tedarikci} onChange={(e) => setFormData({ ...formData, tedarikci: e.currentTarget.value })} />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <TextInput label="Raf/Konum" placeholder="Örn: A-1" value={formData.raf} onChange={(e) => setFormData({ ...formData, raf: e.currentTarget.value })} leftSection={<IconPackage size={16} />} />
              <TextInput label="Barkod" placeholder="Barkod numarası" value={formData.barkod} onChange={(e) => setFormData({ ...formData, barkod: e.currentTarget.value })} leftSection={<IconBarcode size={16} />} />
            </SimpleGrid>
            <Textarea label="Notlar" placeholder="Ek notlar..." rows={2} value={formData.notlar} onChange={(e) => setFormData({ ...formData, notlar: e.currentTarget.value })} />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => { resetForm(); close(); }}>İptal</Button>
              <Button color="orange" onClick={handleSubmit}>{editingItem ? 'Güncelle' : 'Kaydet'}</Button>
            </Group>
          </Stack>
        </Modal>

        {/* Hareket Modal */}
        <Modal opened={hareketOpened} onClose={closeHareket} title={<Title order={3}>Stok Hareketi</Title>} size="md">
          <Stack gap="md">
            <Select label="İşlem Tipi" data={[{ label: '📥 Stok Girişi', value: 'giris' }, { label: '📤 Stok Çıkışı', value: 'cikis' }]} value={hareketForm.tip} onChange={(v) => setHareketForm({ ...hareketForm, tip: v as any })} />
            <Select label="Ürün" placeholder="Ürün seçin" data={stoklar.map(s => ({ label: `${s.kod} - ${s.ad} (${s.miktar} ${s.birim})`, value: s.id }))} value={hareketForm.stokId} onChange={(v) => setHareketForm({ ...hareketForm, stokId: v || '' })} searchable required />
            <NumberInput label="Miktar" value={hareketForm.miktar} onChange={(v) => setHareketForm({ ...hareketForm, miktar: Number(v) || 0 })} min={1} required />
            <TextInput label="Açıklama" placeholder="İşlem açıklaması" value={hareketForm.aciklama} onChange={(e) => setHareketForm({ ...hareketForm, aciklama: e.currentTarget.value })} />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeHareket}>İptal</Button>
              <Button color={hareketForm.tip === 'giris' ? 'green' : 'orange'} onClick={handleHareketSubmit}>Kaydet</Button>
            </Group>
          </Stack>
        </Modal>
      </Container>
    </Box>
  );
}
