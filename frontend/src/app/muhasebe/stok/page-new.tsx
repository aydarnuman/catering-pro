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
  RingProgress,
  Alert,
  LoadingOverlay
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
  IconChartBar,
  IconBuilding,
  IconRefresh,
  IconTruck,
  IconX,
  IconAlertCircle,
  IconWarehouse
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

// API URL
const API_URL = 'http://localhost:3001/api';

// Tip tanımları
interface StokItem {
  id: number;
  kod: string;
  ad: string;
  kategori: string;
  kategori_id?: number;
  birim: string;
  ana_birim_id?: number;
  toplam_stok: number;
  rezerve_stok?: number;
  kullanilabilir_stok?: number;
  min_stok: number;
  max_stok: number;
  kritik_stok: number;
  son_alis_fiyat: number;
  stok_deger?: number;
  tedarikci?: string;
  durum: 'normal' | 'dusuk' | 'kritik' | 'fazla' | 'tukendi';
  depo_durumlari?: DepoStok[];
}

interface DepoStok {
  depo_id: number;
  depo_kod: string;
  depo_ad: string;
  miktar: number;
  rezerve_miktar?: number;
  kullanilabilir?: number;
  lokasyon_kodu?: string;
}

interface Depo {
  id: number;
  kod: string;
  ad: string;
  tip: string;
  lokasyon?: string;
  sorumlu_kisi?: string;
  telefon?: string;
  urun_sayisi?: number;
  toplam_deger?: number;
  kritik_urun?: number;
  aktif: boolean;
}

interface Kategori {
  id: number;
  kod: string;
  ad: string;
  ust_kategori_id?: number;
  renk?: string;
}

interface Birim {
  id: number;
  kod: string;
  ad: string;
  kisa_ad: string;
  tip: string;
}

const COLORS = ['#4dabf7', '#51cf66', '#ff922b', '#ff6b6b', '#845ef7', '#339af0', '#20c997', '#f06595'];

export default function StokPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [opened, { open, close }] = useDisclosure(false);
  const [transferOpened, { open: openTransfer, close: closeTransfer }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [stoklar, setStoklar] = useState<StokItem[]>([]);
  const [depolar, setDepolar] = useState<Depo[]>([]);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [birimler, setBirimler] = useState<Birim[]>([]);
  const [selectedDepo, setSelectedDepo] = useState<number | null>(null);
  const [selectedStok, setSelectedStok] = useState<StokItem | null>(null);

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    stok_kart_id: 0,
    kaynak_depo_id: 0,
    hedef_depo_id: 0,
    miktar: 0,
    belge_no: '',
    aciklama: ''
  });

  // API'den verileri yükle
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Paralel istekler
      const [stokRes, depoRes, katRes, birimRes] = await Promise.all([
        fetch(`${API_URL}/stok/kartlar?limit=100`),
        fetch(`${API_URL}/stok/depolar`),
        fetch(`${API_URL}/stok/kategoriler`),
        fetch(`${API_URL}/stok/birimler`)
      ]);

      if (!stokRes.ok || !depoRes.ok || !katRes.ok || !birimRes.ok) {
        throw new Error('Veri yüklenemedi');
      }

      const [stokData, depoData, katData, birimData] = await Promise.all([
        stokRes.json(),
        depoRes.json(),
        katRes.json(),
        birimRes.json()
      ]);

      setStoklar(stokData.data || []);
      setDepolar(depoData.data || []);
      setKategoriler(katData.data || []);
      setBirimler(birimData.data || []);

    } catch (err) {
      console.error('Veri yükleme hatası:', err);
      setError('Veriler yüklenirken hata oluştu');
      notifications.show({
        title: 'Hata',
        message: 'Veriler yüklenemedi',
        color: 'red',
        icon: <IconAlertCircle />
      });
    } finally {
      setLoading(false);
    }
  };

  // Depo stoklarını yükle
  const loadDepoStoklar = async (depoId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/depolar/${depoId}/stoklar`);
      const result = await response.json();
      
      if (result.success) {
        setStoklar(result.data || []);
        setSelectedDepo(depoId);
      }
    } catch (err) {
      console.error('Depo stok yükleme hatası:', err);
      notifications.show({
        title: 'Hata',
        message: 'Depo stokları yüklenemedi',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Stok detayını yükle
  const loadStokDetay = async (stokId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/kartlar/${stokId}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedStok(result.data);
      }
    } catch (err) {
      console.error('Stok detay yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  // Transfer yap
  const handleTransfer = async () => {
    if (!transferForm.stok_kart_id || !transferForm.kaynak_depo_id || 
        !transferForm.hedef_depo_id || transferForm.miktar <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen tüm alanları doldurun',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/hareketler/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...transferForm,
          belge_no: transferForm.belge_no || `TRF-${Date.now()}`,
          belge_tarihi: new Date().toISOString().split('T')[0]
        })
      });

      const result = await response.json();

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: result.message,
          color: 'green',
          icon: <IconCheck />
        });
        closeTransfer();
        loadData(); // Verileri yenile
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Transfer başarısız',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Component mount
  useEffect(() => {
    loadData();
  }, []);

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      style: 'currency', 
      currency: 'TRY', 
      minimumFractionDigits: 0 
    }).format(value || 0);
  };

  // Filtreleme
  const filteredStoklar = stoklar.filter(item => {
    const matchesTab = activeTab === 'tumu' || 
                      (activeTab === 'kritik' && item.durum === 'kritik') ||
                      (activeTab === 'dusuk' && item.durum === 'dusuk');
    const matchesSearch = item.ad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.kod?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // İstatistikler
  const toplamKalem = stoklar.length;
  const kritikStok = stoklar.filter(s => s.durum === 'kritik').length;
  const toplamDeger = stoklar.reduce((acc, s) => acc + (s.toplam_stok * s.son_alis_fiyat), 0);
  const kategoriSayisi = [...new Set(stoklar.map(s => s.kategori))].length;

  // Kategori dağılımı (gerçek verilerle)
  const kategoriDagilimi = kategoriler.map(kat => ({
    name: kat.ad,
    value: stoklar
      .filter(s => s.kategori === kat.ad)
      .reduce((acc, s) => acc + (s.toplam_stok * s.son_alis_fiyat), 0)
  })).filter(k => k.value > 0);

  return (
    <Container fluid>
      <LoadingOverlay visible={loading} />
      
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={2} mb="xs">
            <ThemeIcon size="lg" radius="md" mr="xs" style={{ verticalAlign: 'middle' }}>
              <IconPackage size={24} />
            </ThemeIcon>
            Stok Yönetimi
          </Title>
          <Text c="dimmed" size="sm">Ürün ve malzeme stoklarınızı takip edin</Text>
        </Box>
        <Group>
          <Button 
            leftSection={<IconRefresh size={16} />} 
            variant="light"
            onClick={() => loadData()}
          >
            Yenile
          </Button>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button leftSection={<IconArrowsExchange size={16} />} variant="light">
                Stok Hareketi
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item 
                leftSection={<IconTrendingUp size={16} />}
                onClick={openTransfer}
              >
                Transfer Yap
              </Menu.Item>
              <Menu.Item leftSection={<IconTrendingDown size={16} />}>
                Stok Girişi
              </Menu.Item>
              <Menu.Item leftSection={<IconTruck size={16} />}>
                Stok Çıkışı
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Yeni Ürün
          </Button>
        </Group>
      </Group>

      {/* İstatistik Kartları */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size="xl" radius="md" variant="light" color="blue">
              <IconPackages size={28} />
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">TOPLAM ÜRÜN</Text>
              <Text size="xl" fw={700}>{toplamKalem}</Text>
              <Text size="xs" c="dimmed">ürün çeşidi</Text>
            </Box>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size="xl" radius="md" variant="light" color="red">
              <IconAlertTriangle size={28} />
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">KRİTİK STOK</Text>
              <Text size="xl" fw={700} color="red">{kritikStok}</Text>
              <Text size="xs" c="dimmed">ürün</Text>
            </Box>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size="xl" radius="md" variant="light" color="green">
              <IconChartBar size={28} />
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">STOK DEĞERİ</Text>
              <Text size="xl" fw={700} color="green">{formatMoney(toplamDeger)}</Text>
              <Text size="xs" c="dimmed">toplam değer</Text>
            </Box>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size="xl" radius="md" variant="light" color="grape">
              <IconCategory size={28} />
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">KATEGORİ</Text>
              <Text size="xl" fw={700}>{kategoriSayisi}</Text>
              <Text size="xs" c="dimmed">farklı kategori</Text>
            </Box>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Depo Seçimi */}
      <Card shadow="sm" padding="md" radius="md" withBorder mb="xl">
        <Group mb="md">
          <IconWarehouse size={20} />
          <Text fw={600}>Depo Seçimi</Text>
        </Group>
        <Group>
          <Button
            variant={selectedDepo === null ? "filled" : "light"}
            onClick={() => {
              setSelectedDepo(null);
              loadData();
            }}
          >
            Tüm Depolar
          </Button>
          {depolar.map(depo => (
            <Button
              key={depo.id}
              variant={selectedDepo === depo.id ? "filled" : "light"}
              onClick={() => loadDepoStoklar(depo.id)}
            >
              {depo.ad} ({depo.urun_sayisi || 0})
            </Button>
          ))}
        </Group>
      </Card>

      {/* Ana İçerik */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab value="tumu">
                  Tümü ({stoklar.length})
                </Tabs.Tab>
                <Tabs.Tab value="kritik" color="red">
                  Kritik ({kritikStok})
                </Tabs.Tab>
                <Tabs.Tab value="dusuk" color="orange">
                  Düşük ({stoklar.filter(s => s.durum === 'dusuk').length})
                </Tabs.Tab>
              </Tabs.List>

              <Box mt="md">
                <TextInput
                  placeholder="Ürün adı veya kodu ile ara..."
                  leftSection={<IconSearch size={16} />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  mb="md"
                />

                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Kod</Table.Th>
                      <Table.Th>Ürün Adı</Table.Th>
                      <Table.Th>Kategori</Table.Th>
                      <Table.Th>Stok</Table.Th>
                      <Table.Th>Durum</Table.Th>
                      <Table.Th>Değer</Table.Th>
                      <Table.Th>İşlemler</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredStoklar.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Badge variant="light">{item.kod}</Badge>
                        </Table.Td>
                        <Table.Td><Text fw={500}>{item.ad}</Text></Table.Td>
                        <Table.Td>{item.kategori}</Table.Td>
                        <Table.Td>
                          {item.toplam_stok} {item.birim}
                        </Table.Td>
                        <Table.Td>
                          <Badge 
                            color={
                              item.durum === 'kritik' ? 'red' : 
                              item.durum === 'dusuk' ? 'orange' :
                              item.durum === 'fazla' ? 'blue' : 'green'
                            }
                          >
                            {item.durum.toUpperCase()}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{formatMoney(item.toplam_stok * item.son_alis_fiyat)}</Table.Td>
                        <Table.Td>
                          <Menu>
                            <Menu.Target>
                              <ActionIcon variant="subtle">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item 
                                leftSection={<IconEdit size={16} />}
                                onClick={() => loadStokDetay(item.id)}
                              >
                                Detay
                              </Menu.Item>
                              <Menu.Item 
                                leftSection={<IconArrowsExchange size={16} />}
                                onClick={() => {
                                  setTransferForm({
                                    ...transferForm,
                                    stok_kart_id: item.id
                                  });
                                  openTransfer();
                                }}
                              >
                                Transfer
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
            </Tabs>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {/* Kategori Dağılımı */}
          <Card shadow="sm" padding="lg" radius="md" withBorder mb="md">
            <Text size="lg" fw={600} mb="md">Kategori Bazlı Stok Değeri</Text>
            {kategoriDagilimi.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={kategoriDagilimi}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {kategoriDagilimi.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => formatMoney(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Text c="dimmed" ta="center">Veri yok</Text>
            )}
            
            <Stack gap="xs" mt="md">
              {kategoriDagilimi.map((kat, index) => (
                <Group key={kat.name} justify="space-between">
                  <Group gap="xs">
                    <Box w={12} h={12} bg={COLORS[index % COLORS.length]} style={{ borderRadius: 4 }} />
                    <Text size="sm">{kat.name}</Text>
                  </Group>
                  <Text size="sm" fw={500}>{formatMoney(kat.value)}</Text>
                </Group>
              ))}
            </Stack>
          </Card>

          {/* Kritik Stok Uyarıları */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Kritik Stok Uyarıları</Text>
            {stoklar.filter(s => s.durum === 'kritik').length > 0 ? (
              <Stack gap="sm">
                {stoklar.filter(s => s.durum === 'kritik').slice(0, 5).map((item) => (
                  <Paper key={item.id} p="sm" withBorder>
                    <Group justify="space-between">
                      <Box>
                        <Text fw={500} size="sm">{item.ad}</Text>
                        <Text size="xs" c="dimmed">{item.kod} • {item.kategori}</Text>
                      </Box>
                      <Box ta="right">
                        <Text size="sm" fw={600} c="red">
                          {item.toplam_stok} {item.birim}
                        </Text>
                        <Text size="xs" c="dimmed">Min: {item.min_stok}</Text>
                      </Box>
                    </Group>
                    <Progress 
                      value={(item.toplam_stok / item.min_stok) * 100} 
                      color="red" 
                      size="sm" 
                      mt="xs"
                    />
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" ta="center">Kritik stok yok</Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Transfer Modal */}
      <Modal
        opened={transferOpened}
        onClose={closeTransfer}
        title="Depolar Arası Transfer"
        size="md"
      >
        <Stack>
          <Select
            label="Ürün"
            placeholder="Transfer edilecek ürünü seçin"
            data={stoklar.map(s => ({ value: s.id.toString(), label: `${s.kod} - ${s.ad}` }))}
            value={transferForm.stok_kart_id?.toString()}
            onChange={(value) => setTransferForm({ 
              ...transferForm, 
              stok_kart_id: parseInt(value || '0') 
            })}
            required
            searchable
          />

          <Select
            label="Kaynak Depo"
            placeholder="Çıkış yapılacak depo"
            data={depolar.map(d => ({ value: d.id.toString(), label: d.ad }))}
            value={transferForm.kaynak_depo_id?.toString()}
            onChange={(value) => setTransferForm({ 
              ...transferForm, 
              kaynak_depo_id: parseInt(value || '0') 
            })}
            required
          />

          <Select
            label="Hedef Depo"
            placeholder="Giriş yapılacak depo"
            data={depolar.map(d => ({ value: d.id.toString(), label: d.ad }))}
            value={transferForm.hedef_depo_id?.toString()}
            onChange={(value) => setTransferForm({ 
              ...transferForm, 
              hedef_depo_id: parseInt(value || '0') 
            })}
            required
          />

          <NumberInput
            label="Miktar"
            placeholder="Transfer edilecek miktar"
            value={transferForm.miktar}
            onChange={(value) => setTransferForm({ ...transferForm, miktar: Number(value) })}
            min={0}
            required
          />

          <TextInput
            label="Belge No"
            placeholder="Transfer belge numarası"
            value={transferForm.belge_no}
            onChange={(e) => setTransferForm({ ...transferForm, belge_no: e.target.value })}
          />

          <Textarea
            label="Açıklama"
            placeholder="Transfer açıklaması"
            value={transferForm.aciklama}
            onChange={(e) => setTransferForm({ ...transferForm, aciklama: e.target.value })}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={closeTransfer}>İptal</Button>
            <Button onClick={handleTransfer} loading={loading}>Transfer Yap</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
