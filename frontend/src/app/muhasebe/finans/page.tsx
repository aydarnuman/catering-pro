'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';
import {
  Container,
  Title,
  Text,
  Group,
  Stack,
  Paper,
  SimpleGrid,
  Tabs,
  Table,
  Badge,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  ActionIcon,
  ThemeIcon,
  Box,
  Divider,
  Progress,
  Center,
  Loader,
  Menu,
  Tooltip,
  Card,
  RingProgress,
  Grid,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconWallet,
  IconBuildingBank,
  IconCreditCard,
  IconReceipt,
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowsExchange,
  IconChartBar,
  IconChartPie,
  IconTrendingUp,
  IconTrendingDown,
  IconCash,
  IconReportMoney,
  IconCalendar,
  IconDots,
  IconEdit,
  IconTrash,
  IconCheck,
  IconClock,
  IconAlertCircle,
  IconBuilding,
  IconFileInvoice,
  IconRefresh,
  IconChevronRight,
  IconEye,
} from '@tabler/icons-react';

const API_URL = `${API_BASE_URL}/api`;

// ==================== INTERFACES ====================

interface Hesap {
  id: number;
  ad: string;
  tip: 'kasa' | 'banka' | 'kredi_karti';
  bakiye: number;
  banka_adi?: string;
  iban?: string;
  // Kredi kartı için
  limit?: number;
  ekstre_kesim?: number;
  son_odeme_gun?: number;
}

interface Hareket {
  id: number;
  hesap_id: number;
  hesap_adi?: string;
  tip: 'gelir' | 'gider';
  tutar: number;
  tarih: string;
  aciklama?: string;
  kategori?: string;
  cari_id?: number;
  cari_adi?: string;
  odeme_yontemi?: string;
  taksit_sayisi?: number;
}

interface CekSenet {
  id: number;
  tip: 'cek' | 'senet';
  yon: 'alacak' | 'borc';
  tutar: number;
  vade_tarihi: string;
  duzenleme_tarihi: string;
  cari_id?: number;
  cari_adi?: string;
  aciklama?: string;
  durum: 'beklemede' | 'tahsil_edildi' | 'odendi' | 'iade' | 'protesto';
  banka_adi?: string;
  seri_no?: string;
}

interface Proje {
  id: number;
  ad: string;
}

interface ProjeHareket {
  id: number;
  proje_id: number;
  tip: 'gelir' | 'gider';
  kategori: string;
  tutar: number;
  tarih: string;
  aciklama?: string;
  referans_tip?: string;
}

interface Cari {
  id: number;
  unvan: string;
  tip: string;
}

// ==================== HELPERS ====================

const formatMoney = (value: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// ==================== MAIN COMPONENT ====================

export default function FinansMerkeziPage() {
  const [activeTab, setActiveTab] = useState<string | null>('ozet');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [hesaplar, setHesaplar] = useState<Hesap[]>([]);
  const [hareketler, setHareketler] = useState<Hareket[]>([]);
  const [cekSenetler, setCekSenetler] = useState<CekSenet[]>([]);
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);
  
  // Proje Analiz States
  const [selectedProje, setSelectedProje] = useState<number | null>(null);
  const [projeYil, setProjeYil] = useState(new Date().getFullYear());
  const [projeAy, setProjeAy] = useState(new Date().getMonth() + 1);
  const [projeHareketler, setProjeHareketler] = useState<ProjeHareket[]>([]);
  
  // Modal States
  const [hesapModalOpen, setHesapModalOpen] = useState(false);
  const [hareketModalOpen, setHareketModalOpen] = useState(false);
  const [cekSenetModalOpen, setCekSenetModalOpen] = useState(false);
  const [projeHareketModalOpen, setProjeHareketModalOpen] = useState(false);
  
  // Kategori Detay Modal
  const [kategoriDetayModal, setKategoriDetayModal] = useState<{
    open: boolean;
    kategori: string;
    baslik: string;
  }>({ open: false, kategori: '', baslik: '' });
  
  // Form States
  const [hesapForm, setHesapForm] = useState({
    ad: '',
    tip: 'kasa' as 'kasa' | 'banka' | 'kredi_karti',
    banka_adi: '',
    iban: '',
    limit: 0,
    ekstre_kesim: 1,
    son_odeme_gun: 15,
  });
  
  const [hareketForm, setHareketForm] = useState({
    hesap_id: 0,
    tip: 'gider' as 'gelir' | 'gider',
    tutar: 0,
    tarih: new Date(),
    aciklama: '',
    kategori: '',
    cari_id: null as number | null,
    odeme_yontemi: 'nakit',
    taksit_sayisi: 1,
  });

  // ==================== DATA LOADING ====================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hesapRes, hareketRes, cekRes, projeRes, cariRes] = await Promise.all([
        fetch(`${API_URL}/kasa-banka/hesaplar`),
        fetch(`${API_URL}/kasa-banka/hareketler?limit=50`),
        fetch(`${API_URL}/kasa-banka/cek-senetler`),
        fetch(`${API_URL}/projeler?durum=aktif`),
        fetch(`${API_URL}/kasa-banka/cariler`),
      ]);
      
      if (hesapRes.ok) setHesaplar(await hesapRes.json());
      if (hareketRes.ok) setHareketler(await hareketRes.json());
      if (cekRes.ok) setCekSenetler(await cekRes.json());
      if (projeRes.ok) setProjeler(await projeRes.json());
      if (cariRes.ok) setCariler(await cariRes.json());
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjeHareketler = useCallback(async () => {
    if (!selectedProje) return;
    try {
      const res = await fetch(
        `${API_URL}/proje-hareketler/${selectedProje}?yil=${projeYil}&ay=${projeAy}`
      );
      if (res.ok) {
        setProjeHareketler(await res.json());
      }
    } catch (error) {
      console.error('Proje hareketleri yükleme hatası:', error);
    }
  }, [selectedProje, projeYil, projeAy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedProje) {
      loadProjeHareketler();
    }
  }, [selectedProje, projeYil, projeAy, loadProjeHareketler]);

  // ==================== CALCULATIONS ====================

  const kasaBakiye = hesaplar.filter(h => h.tip === 'kasa').reduce((sum, h) => sum + h.bakiye, 0);
  const bankaBakiye = hesaplar.filter(h => h.tip === 'banka').reduce((sum, h) => sum + h.bakiye, 0);
  const kkBorcToplam = hesaplar.filter(h => h.tip === 'kredi_karti').reduce((sum, h) => sum + Math.abs(h.bakiye), 0);
  const toplamVarlik = kasaBakiye + bankaBakiye - kkBorcToplam;
  
  const bekleyenCekler = cekSenetler.filter(c => c.tip === 'cek' && c.durum === 'beklemede');
  const bekleyenSenetler = cekSenetler.filter(c => c.tip === 'senet' && c.durum === 'beklemede');
  const bekleyenAlacak = cekSenetler.filter(c => c.yon === 'alacak' && c.durum === 'beklemede').reduce((sum, c) => sum + c.tutar, 0);
  const bekleyenBorc = cekSenetler.filter(c => c.yon === 'borc' && c.durum === 'beklemede').reduce((sum, c) => sum + c.tutar, 0);

  // Proje hesaplamaları
  const projeGelir = projeHareketler.filter(h => h.tip === 'gelir').reduce((sum, h) => sum + h.tutar, 0);
  const projeGider = projeHareketler.filter(h => h.tip === 'gider').reduce((sum, h) => sum + h.tutar, 0);
  const projeNet = projeGelir - projeGider;

  // ==================== HANDLERS ====================

  const handleSaveHesap = async () => {
    try {
      const res = await fetch(`${API_URL}/kasa-banka/hesaplar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hesapForm),
      });
      if (res.ok) {
        notifications.show({ message: '✓ Hesap eklendi', color: 'green' });
        setHesapModalOpen(false);
        loadData();
        setHesapForm({ ad: '', tip: 'kasa', banka_adi: '', iban: '', limit: 0, ekstre_kesim: 1, son_odeme_gun: 15 });
      }
    } catch (error) {
      notifications.show({ message: '✗ Hata oluştu', color: 'red' });
    }
  };

  const handleSaveHareket = async () => {
    try {
      const res = await fetch(`${API_URL}/kasa-banka/hareketler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...hareketForm,
          tarih: hareketForm.tarih.toISOString().split('T')[0],
        }),
      });
      if (res.ok) {
        notifications.show({ message: '✓ Hareket kaydedildi', color: 'green' });
        setHareketModalOpen(false);
        loadData();
      }
    } catch (error) {
      notifications.show({ message: '✗ Hata oluştu', color: 'red' });
    }
  };

  const handleSaveProjeHareket = async () => {
    if (!selectedProje) return;
    try {
      const res = await fetch(`${API_URL}/proje-hareketler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proje_id: selectedProje,
          ...hareketForm,
          tarih: hareketForm.tarih.toISOString().split('T')[0],
        }),
      });
      if (res.ok) {
        notifications.show({ message: '✓ Hareket eklendi', color: 'green' });
        setProjeHareketModalOpen(false);
        loadProjeHareketler();
      }
    } catch (error) {
      notifications.show({ message: '✗ Hata oluştu', color: 'red' });
    }
  };

  // ==================== LOADING STATE ====================

  if (loading) {
    return (
      <Center h="80vh">
        <Stack align="center" gap="md">
          <Loader size="lg" type="bars" />
          <Text c="dimmed">Yükleniyor...</Text>
        </Stack>
      </Center>
    );
  }

  // ==================== RENDER ====================

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2} fw={700} c="dark.7">
            💼 Finans Merkezi
          </Title>
          <Text c="dimmed" size="sm">
            Şirket mali durumu ve nakit akışı yönetimi
          </Text>
        </div>
        <Group>
          <Button 
            variant="light" 
            leftSection={<IconRefresh size={18} />}
            onClick={loadData}
          >
            Yenile
          </Button>
        </Group>
      </Group>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="ozet" leftSection={<IconChartPie size={18} />} fw={500}>
            Özet
          </Tabs.Tab>
          <Tabs.Tab value="hesaplar" leftSection={<IconWallet size={18} />} fw={500}>
            Hesaplar
          </Tabs.Tab>
          <Tabs.Tab value="cek-senet" leftSection={<IconReceipt size={18} />} fw={500}>
            Çek/Senet
          </Tabs.Tab>
          <Tabs.Tab value="proje-karlilik" leftSection={<IconChartBar size={18} />} fw={500}>
            Proje Analiz
          </Tabs.Tab>
        </Tabs.List>

        {/* ==================== ÖZET TAB ==================== */}
        <Tabs.Panel value="ozet">
          <Stack gap="lg">
            {/* Ana Metrikler */}
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              {/* Kasa */}
              <Paper
                p="lg"
                radius="lg"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500} opacity={0.9}>💵 Kasa</Text>
                  <ThemeIcon size={36} radius="xl" variant="white" color="violet">
                    <IconCash size={20} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="xl">{formatMoney(kasaBakiye)}</Text>
                <Text size="xs" opacity={0.8}>{hesaplar.filter(h => h.tip === 'kasa').length} hesap</Text>
              </Paper>

              {/* Banka */}
              <Paper
                p="lg"
                radius="lg"
                style={{
                  background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                  color: 'white',
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500} opacity={0.9}>🏦 Banka</Text>
                  <ThemeIcon size={36} radius="xl" variant="white" color="teal">
                    <IconBuildingBank size={20} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="xl">{formatMoney(bankaBakiye)}</Text>
                <Text size="xs" opacity={0.8}>{hesaplar.filter(h => h.tip === 'banka').length} hesap</Text>
              </Paper>

              {/* Kredi Kartı Borcu */}
              <Paper
                p="lg"
                radius="lg"
                style={{
                  background: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
                  color: 'white',
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500} opacity={0.9}>💳 KK Borç</Text>
                  <ThemeIcon size={36} radius="xl" variant="white" color="red">
                    <IconCreditCard size={20} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="xl">{formatMoney(kkBorcToplam)}</Text>
                <Text size="xs" opacity={0.8}>{hesaplar.filter(h => h.tip === 'kredi_karti').length} kart</Text>
              </Paper>

              {/* Toplam Varlık */}
              <Paper
                p="lg"
                radius="lg"
                style={{
                  background: toplamVarlik >= 0 
                    ? 'linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)'
                    : 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
                  color: 'white',
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500} opacity={0.9}>💰 Net Varlık</Text>
                  <ThemeIcon size={36} radius="xl" variant="white" color={toplamVarlik >= 0 ? 'cyan' : 'red'}>
                    <IconReportMoney size={20} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="xl">{formatMoney(toplamVarlik)}</Text>
                <Text size="xs" opacity={0.8}>Kasa + Banka - KK</Text>
              </Paper>
            </SimpleGrid>

            {/* İkinci Satır */}
            <Grid>
              {/* Bekleyen İşlemler */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper withBorder p="lg" radius="lg" h="100%">
                  <Group justify="space-between" mb="md">
                    <Text fw={600} size="sm">⏳ Bekleyen İşlemler</Text>
                    <Badge variant="light" color="orange">{bekleyenCekler.length + bekleyenSenetler.length}</Badge>
                  </Group>
                  <Stack gap="sm">
                    <Group justify="space-between" p="sm" style={{ background: 'var(--mantine-color-blue-0)', borderRadius: 8 }}>
                      <Group gap="xs">
                        <Text size="sm">📄</Text>
                        <Text size="sm">Bekleyen Çekler</Text>
                      </Group>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={600}>{bekleyenCekler.length} adet</Text>
                        <Text size="xs" c="dimmed">{formatMoney(bekleyenCekler.reduce((s, c) => s + c.tutar, 0))}</Text>
                      </div>
                    </Group>
                    <Group justify="space-between" p="sm" style={{ background: 'var(--mantine-color-grape-0)', borderRadius: 8 }}>
                      <Group gap="xs">
                        <Text size="sm">📋</Text>
                        <Text size="sm">Bekleyen Senetler</Text>
                      </Group>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={600}>{bekleyenSenetler.length} adet</Text>
                        <Text size="xs" c="dimmed">{formatMoney(bekleyenSenetler.reduce((s, c) => s + c.tutar, 0))}</Text>
                      </div>
                    </Group>
                    <Divider my="xs" />
                    <Group justify="space-between">
                      <Text size="sm" c="teal.7">📥 Alacak</Text>
                      <Text size="sm" fw={600} c="teal.7">+{formatMoney(bekleyenAlacak)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="red.7">📤 Borç</Text>
                      <Text size="sm" fw={600} c="red.7">-{formatMoney(bekleyenBorc)}</Text>
                    </Group>
                  </Stack>
                </Paper>
              </Grid.Col>

              {/* Son Hareketler */}
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Paper withBorder p="lg" radius="lg" h="100%">
                  <Group justify="space-between" mb="md">
                    <Text fw={600} size="sm">📊 Son Hareketler</Text>
                    <Button variant="subtle" size="xs" rightSection={<IconChevronRight size={14} />} onClick={() => setActiveTab('hesaplar')}>
                      Tümünü Gör
                    </Button>
                  </Group>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Tarih</Table.Th>
                        <Table.Th>Hesap</Table.Th>
                        <Table.Th>Açıklama</Table.Th>
                        <Table.Th ta="right">Tutar</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {hareketler.slice(0, 5).map((h) => (
                        <Table.Tr key={h.id}>
                          <Table.Td>
                            <Text size="sm">{formatDate(h.tarih)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="sm">
                              {h.hesap_adi || 'Hesap'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" lineClamp={1}>{h.aciklama || '-'}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} c={h.tip === 'gelir' ? 'teal' : 'red'}>
                              {h.tip === 'gelir' ? '+' : '-'}{formatMoney(h.tutar)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      {hareketler.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={4}>
                            <Center py="xl">
                              <Stack align="center" gap="xs">
                                <IconCash size={32} color="var(--mantine-color-dimmed)" />
                                <Text c="dimmed" size="sm">Henüz hareket yok</Text>
                                <Text c="dimmed" size="xs">İlk hareketi eklemek için Gelir/Gider butonlarını kullanın</Text>
                              </Stack>
                            </Center>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Grid.Col>
            </Grid>

            {/* Proje Analiz Özeti */}
            <Paper withBorder p="lg" radius="lg">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="sm">📊 Proje Analiz Özeti</Text>
                <Button variant="subtle" size="xs" rightSection={<IconChevronRight size={14} />} onClick={() => setActiveTab('proje-karlilik')}>
                  Detaylı Görünüm
                </Button>
              </Group>
              {projeler.length > 0 ? (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                  {projeler.slice(0, 6).map((proje) => (
                    <Paper key={proje.id} withBorder p="md" radius="md" bg="gray.0">
                      <Group justify="space-between" mb="xs">
                        <Text size="sm" fw={500} lineClamp={1}>{proje.ad}</Text>
                        <IconChevronRight size={14} color="gray" />
                      </Group>
                      <Text size="xs" c="dimmed">Detay için tıklayın</Text>
                    </Paper>
                  ))}
                </SimpleGrid>
              ) : (
                <Center py="xl">
                  <Text c="dimmed">Aktif proje bulunamadı</Text>
                </Center>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* ==================== HESAPLAR TAB ==================== */}
        <Tabs.Panel value="hesaplar">
          <Stack gap="lg">
            {/* Üst Bar */}
            <Group justify="space-between">
              <Group>
                <Button leftSection={<IconPlus size={18} />} onClick={() => setHesapModalOpen(true)}>
                  Hesap Ekle
                </Button>
                <Button variant="light" leftSection={<IconArrowsExchange size={18} />}>
                  Transfer
                </Button>
              </Group>
              <Button variant="light" leftSection={<IconPlus size={18} />} color="green" onClick={() => setHareketModalOpen(true)}>
                Hareket Ekle
              </Button>
            </Group>

            {/* Hesap Listeleri */}
            <Grid>
              {/* Kasalar */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper withBorder p="md" radius="lg">
                  <Group justify="space-between" mb="md">
                    <Group gap="xs">
                      <ThemeIcon size={28} radius="md" variant="light" color="violet">
                        <IconCash size={16} />
                      </ThemeIcon>
                      <Text fw={600}>Kasalar</Text>
                    </Group>
                    <Text fw={700} c="violet">{formatMoney(kasaBakiye)}</Text>
                  </Group>
                  <Stack gap="xs">
                    {hesaplar.filter(h => h.tip === 'kasa').map((hesap) => (
                      <Paper key={hesap.id} withBorder p="sm" radius="md" bg="gray.0">
                        <Group justify="space-between">
                          <Text size="sm">{hesap.ad}</Text>
                          <Text size="sm" fw={600}>{formatMoney(hesap.bakiye)}</Text>
                        </Group>
                      </Paper>
                    ))}
                    {hesaplar.filter(h => h.tip === 'kasa').length === 0 && (
                      <Text size="sm" c="dimmed" ta="center" py="md">Kasa hesabı yok</Text>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>

              {/* Bankalar */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper withBorder p="md" radius="lg">
                  <Group justify="space-between" mb="md">
                    <Group gap="xs">
                      <ThemeIcon size={28} radius="md" variant="light" color="teal">
                        <IconBuildingBank size={16} />
                      </ThemeIcon>
                      <Text fw={600}>Bankalar</Text>
                    </Group>
                    <Text fw={700} c="teal">{formatMoney(bankaBakiye)}</Text>
                  </Group>
                  <Stack gap="xs">
                    {hesaplar.filter(h => h.tip === 'banka').map((hesap) => (
                      <Paper key={hesap.id} withBorder p="sm" radius="md" bg="gray.0">
                        <Group justify="space-between">
                          <div>
                            <Text size="sm" fw={500}>{hesap.ad}</Text>
                            {hesap.banka_adi && <Text size="xs" c="dimmed">{hesap.banka_adi}</Text>}
                          </div>
                          <Text size="sm" fw={600}>{formatMoney(hesap.bakiye)}</Text>
                        </Group>
                      </Paper>
                    ))}
                    {hesaplar.filter(h => h.tip === 'banka').length === 0 && (
                      <Text size="sm" c="dimmed" ta="center" py="md">Banka hesabı yok</Text>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>

              {/* Kredi Kartları */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper withBorder p="md" radius="lg">
                  <Group justify="space-between" mb="md">
                    <Group gap="xs">
                      <ThemeIcon size={28} radius="md" variant="light" color="red">
                        <IconCreditCard size={16} />
                      </ThemeIcon>
                      <Text fw={600}>Kredi Kartları</Text>
                    </Group>
                    <Text fw={700} c="red">{formatMoney(kkBorcToplam)}</Text>
                  </Group>
                  <Stack gap="xs">
                    {hesaplar.filter(h => h.tip === 'kredi_karti').map((hesap) => (
                      <Paper key={hesap.id} withBorder p="sm" radius="md" bg="gray.0">
                        <Group justify="space-between" mb="xs">
                          <Text size="sm" fw={500}>{hesap.ad}</Text>
                          <Text size="sm" fw={600} c="red">{formatMoney(Math.abs(hesap.bakiye))}</Text>
                        </Group>
                        {hesap.limit && (
                          <div>
                            <Group justify="space-between" mb={4}>
                              <Text size="xs" c="dimmed">Limit: {formatMoney(hesap.limit)}</Text>
                              <Text size="xs" c="dimmed">{Math.round((Math.abs(hesap.bakiye) / hesap.limit) * 100)}%</Text>
                            </Group>
                            <Progress value={(Math.abs(hesap.bakiye) / hesap.limit) * 100} color="red" size="sm" />
                          </div>
                        )}
                      </Paper>
                    ))}
                    {hesaplar.filter(h => h.tip === 'kredi_karti').length === 0 && (
                      <Text size="sm" c="dimmed" ta="center" py="md">Kredi kartı yok</Text>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

            {/* Son Hareketler */}
            <Paper withBorder p="lg" radius="lg">
              <Text fw={600} mb="md">📋 Tüm Hareketler</Text>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tarih</Table.Th>
                    <Table.Th>Hesap</Table.Th>
                    <Table.Th>Kategori</Table.Th>
                    <Table.Th>Açıklama</Table.Th>
                    <Table.Th>Cari</Table.Th>
                    <Table.Th ta="right">Tutar</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {hareketler.map((h) => (
                    <Table.Tr key={h.id}>
                      <Table.Td>{formatDate(h.tarih)}</Table.Td>
                      <Table.Td><Badge variant="light" size="sm">{h.hesap_adi}</Badge></Table.Td>
                      <Table.Td><Text size="sm">{h.kategori || '-'}</Text></Table.Td>
                      <Table.Td><Text size="sm" lineClamp={1}>{h.aciklama || '-'}</Text></Table.Td>
                      <Table.Td><Text size="sm">{h.cari_adi || '-'}</Text></Table.Td>
                      <Table.Td ta="right">
                        <Text fw={600} c={h.tip === 'gelir' ? 'teal' : 'red'}>
                          {h.tip === 'gelir' ? '+' : '-'}{formatMoney(h.tutar)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {hareketler.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Center py="xl">
                          <Stack align="center" gap="xs">
                            <IconWallet size={40} color="var(--mantine-color-dimmed)" />
                            <Text c="dimmed" size="sm" fw={500}>Henüz hareket kaydı yok</Text>
                            <Text c="dimmed" size="xs">Gelir veya gider ekleyerek başlayın</Text>
                          </Stack>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* ==================== ÇEK/SENET TAB ==================== */}
        <Tabs.Panel value="cek-senet">
          <Stack gap="lg">
            <Group justify="space-between">
              <Group>
                <Button leftSection={<IconPlus size={18} />} onClick={() => setCekSenetModalOpen(true)}>
                  Çek/Senet Ekle
                </Button>
              </Group>
              <Group>
                <Badge size="lg" variant="light" color="blue">
                  Bekleyen: {formatMoney(bekleyenAlacak + bekleyenBorc)}
                </Badge>
              </Group>
            </Group>

            {/* Özet Kartlar */}
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <Paper withBorder p="md" radius="lg" style={{ borderLeft: '4px solid var(--mantine-color-teal-6)' }}>
                <Text size="xs" c="dimmed">Alacak Çekler</Text>
                <Text fw={700} size="lg" c="teal">{formatMoney(cekSenetler.filter(c => c.tip === 'cek' && c.yon === 'alacak' && c.durum === 'beklemede').reduce((s, c) => s + c.tutar, 0))}</Text>
              </Paper>
              <Paper withBorder p="md" radius="lg" style={{ borderLeft: '4px solid var(--mantine-color-red-6)' }}>
                <Text size="xs" c="dimmed">Borç Çekler</Text>
                <Text fw={700} size="lg" c="red">{formatMoney(cekSenetler.filter(c => c.tip === 'cek' && c.yon === 'borc' && c.durum === 'beklemede').reduce((s, c) => s + c.tutar, 0))}</Text>
              </Paper>
              <Paper withBorder p="md" radius="lg" style={{ borderLeft: '4px solid var(--mantine-color-grape-6)' }}>
                <Text size="xs" c="dimmed">Alacak Senetler</Text>
                <Text fw={700} size="lg" c="grape">{formatMoney(cekSenetler.filter(c => c.tip === 'senet' && c.yon === 'alacak' && c.durum === 'beklemede').reduce((s, c) => s + c.tutar, 0))}</Text>
              </Paper>
              <Paper withBorder p="md" radius="lg" style={{ borderLeft: '4px solid var(--mantine-color-orange-6)' }}>
                <Text size="xs" c="dimmed">Borç Senetler</Text>
                <Text fw={700} size="lg" c="orange">{formatMoney(cekSenetler.filter(c => c.tip === 'senet' && c.yon === 'borc' && c.durum === 'beklemede').reduce((s, c) => s + c.tutar, 0))}</Text>
              </Paper>
            </SimpleGrid>

            {/* Çek/Senet Listesi */}
            <Paper withBorder p="lg" radius="lg">
              <Text fw={600} mb="md">📋 Çek/Senet Listesi</Text>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tip</Table.Th>
                    <Table.Th>Yön</Table.Th>
                    <Table.Th>Cari</Table.Th>
                    <Table.Th>Vade</Table.Th>
                    <Table.Th ta="right">Tutar</Table.Th>
                    <Table.Th ta="center">Durum</Table.Th>
                    <Table.Th ta="center">İşlem</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {cekSenetler.map((cs) => (
                    <Table.Tr key={cs.id}>
                      <Table.Td>
                        <Badge color={cs.tip === 'cek' ? 'blue' : 'grape'} variant="light">
                          {cs.tip === 'cek' ? '📄 Çek' : '📋 Senet'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={cs.yon === 'alacak' ? 'teal' : 'red'} variant="outline" size="sm">
                          {cs.yon === 'alacak' ? '📥 Alacak' : '📤 Borç'}
                        </Badge>
                      </Table.Td>
                      <Table.Td><Text size="sm">{cs.cari_adi || '-'}</Text></Table.Td>
                      <Table.Td><Text size="sm">{formatDate(cs.vade_tarihi)}</Text></Table.Td>
                      <Table.Td ta="right">
                        <Text fw={600}>{formatMoney(cs.tutar)}</Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge 
                          color={
                            cs.durum === 'beklemede' ? 'orange' :
                            cs.durum === 'tahsil_edildi' || cs.durum === 'odendi' ? 'green' :
                            'red'
                          }
                          variant="light"
                        >
                          {cs.durum === 'beklemede' ? '⏳ Bekliyor' :
                           cs.durum === 'tahsil_edildi' ? '✅ Tahsil' :
                           cs.durum === 'odendi' ? '✅ Ödendi' :
                           cs.durum === 'iade' ? '↩️ İade' : '❌ Protesto'}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Menu shadow="md" width={150}>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconCheck size={14} />}>Tahsil Et</Menu.Item>
                            <Menu.Item leftSection={<IconArrowsExchange size={14} />}>Ciro Et</Menu.Item>
                            <Menu.Item leftSection={<IconAlertCircle size={14} />} color="red">İade/Protesto</Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {cekSenetler.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Center py="xl">
                          <Stack align="center" gap="xs">
                            <IconReceipt size={40} color="var(--mantine-color-dimmed)" />
                            <Text c="dimmed" size="sm" fw={500}>Henüz çek/senet kaydı yok</Text>
                            <Text c="dimmed" size="xs">Yeni çek veya senet eklemek için yukarıdaki butonu kullanın</Text>
                          </Stack>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* ==================== PROJE KARLILIK TAB ==================== */}
        <Tabs.Panel value="proje-karlilik">
          <Stack gap="lg">
            {/* Filtre Bar */}
            <Paper withBorder p="md" radius="lg" bg="gray.0">
              <Group justify="space-between">
                <Group>
                  <Select
                    placeholder="Proje Seç"
                    data={projeler.map(p => ({ value: String(p.id), label: p.ad }))}
                    value={selectedProje ? String(selectedProje) : null}
                    onChange={(v) => setSelectedProje(v ? parseInt(v) : null)}
                    w={250}
                    leftSection={<IconBuilding size={16} />}
                  />
                  <Select
                    data={Array.from({ length: 5 }, (_, i) => ({
                      value: String(new Date().getFullYear() - 2 + i),
                      label: String(new Date().getFullYear() - 2 + i)
                    }))}
                    value={String(projeYil)}
                    onChange={(v) => setProjeYil(parseInt(v || String(new Date().getFullYear())))}
                    w={100}
                  />
                  <Select
                    data={[
                      { value: '1', label: 'Ocak' }, { value: '2', label: 'Şubat' },
                      { value: '3', label: 'Mart' }, { value: '4', label: 'Nisan' },
                      { value: '5', label: 'Mayıs' }, { value: '6', label: 'Haziran' },
                      { value: '7', label: 'Temmuz' }, { value: '8', label: 'Ağustos' },
                      { value: '9', label: 'Eylül' }, { value: '10', label: 'Ekim' },
                      { value: '11', label: 'Kasım' }, { value: '12', label: 'Aralık' }
                    ]}
                    value={String(projeAy)}
                    onChange={(v) => setProjeAy(parseInt(v || '1'))}
                    w={130}
                  />
                </Group>
                <Button
                  leftSection={<IconPlus size={16} />}
                  variant="light"
                  disabled={!selectedProje}
                  onClick={() => setProjeHareketModalOpen(true)}
                >
                  Gelir/Gider Ekle
                </Button>
              </Group>
            </Paper>

            {selectedProje ? (
              <>
                {/* Özet Kartlar */}
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Paper
                    p="lg"
                    radius="lg"
                    style={{
                      background: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
                      color: 'white',
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500} opacity={0.9}>📉 Toplam Gider</Text>
                      <IconTrendingDown size={24} opacity={0.7} />
                    </Group>
                    <Text fw={700} size="xl">{formatMoney(projeGider)}</Text>
                  </Paper>

                  <Paper
                    p="lg"
                    radius="lg"
                    style={{
                      background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                      color: 'white',
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500} opacity={0.9}>📈 Toplam Gelir</Text>
                      <IconTrendingUp size={24} opacity={0.7} />
                    </Group>
                    <Text fw={700} size="xl">{formatMoney(projeGelir)}</Text>
                  </Paper>

                  <Paper
                    p="lg"
                    radius="lg"
                    style={{
                      background: projeNet >= 0
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: 'white',
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500} opacity={0.9}>💰 Net Kar/Zarar</Text>
                      <IconReportMoney size={24} opacity={0.7} />
                    </Group>
                    <Text fw={700} size="xl">{projeNet >= 0 ? '+' : ''}{formatMoney(projeNet)}</Text>
                  </Paper>
                </SimpleGrid>

                {/* Kategori Detay */}
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Paper withBorder p="lg" radius="lg">
                      <Text fw={600} mb="md" c="red.7">📉 Gider Kalemleri</Text>
                      <Stack gap="xs">
                        {/* Personel Giderleri */}
                        <Paper 
                          withBorder p="md" radius="md" bg="red.0"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setKategoriDetayModal({ open: true, kategori: 'personel', baslik: '👥 Personel Giderleri Detayı' })}
                        >
                          <Group justify="space-between">
                            <Group gap="xs">
                              <Text>👥</Text>
                              <div>
                                <Text size="sm" fw={500}>Personel Giderleri</Text>
                                <Badge size="xs" color="green" variant="light">OTOMATİK</Badge>
                              </div>
                            </Group>
                            <Group gap="xs">
                              <Text fw={600} c="red.7">
                                {formatMoney(projeHareketler.filter(h => 
                                  h.tip === 'gider' && 
                                  ['personel_maas', 'personel_sgk', 'personel_vergi'].includes(h.kategori)
                                ).reduce((s, h) => s + h.tutar, 0))}
                              </Text>
                              <IconChevronRight size={16} color="gray" />
                            </Group>
                          </Group>
                        </Paper>
                        {/* Diğer Giderler */}
                        <Paper 
                          withBorder p="md" radius="md" bg="gray.0"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setKategoriDetayModal({ open: true, kategori: 'diger_gider', baslik: '📦 Diğer Giderler Detayı' })}
                        >
                          <Group justify="space-between">
                            <Group gap="xs">
                              <Text>📦</Text>
                              <Text size="sm" fw={500}>Diğer Giderler</Text>
                            </Group>
                            <Group gap="xs">
                              <Text fw={600} c="red.7">
                                {formatMoney(projeHareketler.filter(h => 
                                  h.tip === 'gider' && 
                                  !['personel_maas', 'personel_sgk', 'personel_vergi'].includes(h.kategori)
                                ).reduce((s, h) => s + h.tutar, 0))}
                              </Text>
                              <IconChevronRight size={16} color="gray" />
                            </Group>
                          </Group>
                        </Paper>
                      </Stack>
                    </Paper>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Paper withBorder p="lg" radius="lg">
                      <Text fw={600} mb="md" c="teal.7">📈 Gelir Kalemleri</Text>
                      <Stack gap="xs">
                        {/* Hakediş */}
                        <Paper 
                          withBorder p="md" radius="md" bg="teal.0"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setKategoriDetayModal({ open: true, kategori: 'hakedis', baslik: '💰 Hakediş Detayı' })}
                        >
                          <Group justify="space-between">
                            <Group gap="xs">
                              <Text>💰</Text>
                              <Text size="sm" fw={500}>Hakediş</Text>
                            </Group>
                            <Group gap="xs">
                              <Text fw={600} c="teal.7">
                                +{formatMoney(projeHareketler.filter(h => h.kategori === 'hakedis').reduce((s, h) => s + h.tutar, 0))}
                              </Text>
                              <IconChevronRight size={16} color="gray" />
                            </Group>
                          </Group>
                        </Paper>
                        {/* Diğer Gelirler */}
                        <Paper 
                          withBorder p="md" radius="md" bg="gray.0"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setKategoriDetayModal({ open: true, kategori: 'diger_gelir', baslik: '📦 Diğer Gelirler Detayı' })}
                        >
                          <Group justify="space-between">
                            <Group gap="xs">
                              <Text>📦</Text>
                              <Text size="sm" fw={500}>Diğer Gelirler</Text>
                            </Group>
                            <Group gap="xs">
                              <Text fw={600} c="teal.7">
                                +{formatMoney(projeHareketler.filter(h => h.tip === 'gelir' && h.kategori !== 'hakedis').reduce((s, h) => s + h.tutar, 0))}
                              </Text>
                              <IconChevronRight size={16} color="gray" />
                            </Group>
                          </Group>
                        </Paper>
                      </Stack>
                    </Paper>
                  </Grid.Col>
                </Grid>

                {/* Hareket Listesi */}
                <Paper withBorder p="lg" radius="lg">
                  <Text fw={600} mb="md">📋 Hareket Listesi</Text>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Tarih</Table.Th>
                        <Table.Th>Kategori</Table.Th>
                        <Table.Th>Açıklama</Table.Th>
                        <Table.Th ta="right">Tutar</Table.Th>
                        <Table.Th ta="center">Kaynak</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {projeHareketler.map((h) => (
                        <Table.Tr key={h.id}>
                          <Table.Td>{formatDate(h.tarih)}</Table.Td>
                          <Table.Td>
                            <Badge color={h.tip === 'gelir' ? 'teal' : 'red'} variant="light" size="sm">
                              {h.kategori === 'hakedis' ? '💰 Hakediş' :
                               h.kategori === 'personel_maas' ? '💵 Maaş' :
                               h.kategori === 'personel_sgk' ? '🏛️ SGK' :
                               h.kategori === 'personel_vergi' ? '📋 Vergi' :
                               `📦 ${h.kategori}`}
                            </Badge>
                          </Table.Td>
                          <Table.Td><Text size="sm" lineClamp={1}>{h.aciklama || '-'}</Text></Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} c={h.tip === 'gelir' ? 'teal' : 'red'}>
                              {h.tip === 'gelir' ? '+' : '-'}{formatMoney(h.tutar)}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge variant="dot" color={h.referans_tip === 'bordro' ? 'green' : 'blue'} size="sm">
                              {h.referans_tip === 'bordro' ? 'Personel' : 'Manuel'}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      {projeHareketler.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={5} ta="center" py="xl">
                            <Stack align="center" gap="xs">
                              <ThemeIcon size={40} variant="light" color="gray" radius="xl">
                                <IconReportMoney size={20} />
                              </ThemeIcon>
                              <Text c="dimmed">Bu dönemde hareket yok</Text>
                            </Stack>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </>
            ) : (
              <Paper withBorder p="xl" radius="lg">
                <Center py="xl">
                  <Stack align="center" gap="md">
                    <ThemeIcon size={60} variant="light" color="grape" radius="xl">
                      <IconBuilding size={30} />
                    </ThemeIcon>
                    <Text fw={600} size="lg">Proje Seçin</Text>
                    <Text c="dimmed" ta="center">Analiz için yukarıdan bir proje seçin</Text>
                  </Stack>
                </Center>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* ==================== MODALS ==================== */}

      {/* Hesap Ekleme Modal */}
      <Modal
        opened={hesapModalOpen}
        onClose={() => setHesapModalOpen(false)}
        title={<Text fw={600}>💼 Yeni Hesap Ekle</Text>}
        size="md"
      >
        <Stack>
          <Select
            label="Hesap Tipi"
            data={[
              { value: 'kasa', label: '💵 Kasa' },
              { value: 'banka', label: '🏦 Banka' },
              { value: 'kredi_karti', label: '💳 Kredi Kartı' },
            ]}
            value={hesapForm.tip}
            onChange={(v) => setHesapForm({ ...hesapForm, tip: v as any })}
          />
          <TextInput
            label="Hesap Adı"
            placeholder="örn: Ana Kasa, İş Bankası"
            value={hesapForm.ad}
            onChange={(e) => setHesapForm({ ...hesapForm, ad: e.target.value })}
          />
          {hesapForm.tip !== 'kasa' && (
            <TextInput
              label="Banka Adı"
              placeholder="örn: İş Bankası"
              value={hesapForm.banka_adi}
              onChange={(e) => setHesapForm({ ...hesapForm, banka_adi: e.target.value })}
            />
          )}
          {hesapForm.tip === 'banka' && (
            <TextInput
              label="IBAN"
              placeholder="TR..."
              value={hesapForm.iban}
              onChange={(e) => setHesapForm({ ...hesapForm, iban: e.target.value })}
            />
          )}
          {hesapForm.tip === 'kredi_karti' && (
            <>
              <NumberInput
                label="Limit"
                placeholder="50000"
                value={hesapForm.limit}
                onChange={(v) => setHesapForm({ ...hesapForm, limit: Number(v) || 0 })}
                thousandSeparator="."
                decimalSeparator=","
              />
              <Group grow>
                <NumberInput
                  label="Ekstre Kesim Günü"
                  value={hesapForm.ekstre_kesim}
                  onChange={(v) => setHesapForm({ ...hesapForm, ekstre_kesim: Number(v) || 1 })}
                  min={1}
                  max={31}
                />
                <NumberInput
                  label="Son Ödeme Günü"
                  value={hesapForm.son_odeme_gun}
                  onChange={(v) => setHesapForm({ ...hesapForm, son_odeme_gun: Number(v) || 15 })}
                  min={1}
                  max={31}
                />
              </Group>
            </>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setHesapModalOpen(false)}>İptal</Button>
            <Button onClick={handleSaveHesap}>Kaydet</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hareket Ekleme Modal */}
      <Modal
        opened={hareketModalOpen}
        onClose={() => setHareketModalOpen(false)}
        title={<Text fw={600}>💸 Yeni Hareket</Text>}
        size="md"
      >
        <Stack>
          <Select
            label="İşlem Tipi"
            data={[
              { value: 'gelir', label: '📥 Gelir (Tahsilat)' },
              { value: 'gider', label: '📤 Gider (Ödeme)' },
            ]}
            value={hareketForm.tip}
            onChange={(v) => setHareketForm({ ...hareketForm, tip: v as any })}
          />
          <Select
            label="Ödeme Yöntemi"
            data={[
              { value: 'nakit', label: '💵 Nakit (Kasa)' },
              { value: 'banka', label: '🏦 Banka (Havale/EFT)' },
              { value: 'kredi_karti', label: '💳 Kredi Kartı' },
              { value: 'cek', label: '📄 Çek' },
              { value: 'senet', label: '📋 Senet' },
            ]}
            value={hareketForm.odeme_yontemi}
            onChange={(v) => setHareketForm({ ...hareketForm, odeme_yontemi: v || 'nakit' })}
          />
          <Select
            label="Hesap"
            placeholder="Hesap seçin"
            data={hesaplar
              .filter(h => {
                if (hareketForm.odeme_yontemi === 'nakit') return h.tip === 'kasa';
                if (hareketForm.odeme_yontemi === 'banka') return h.tip === 'banka';
                if (hareketForm.odeme_yontemi === 'kredi_karti') return h.tip === 'kredi_karti';
                return true;
              })
              .map(h => ({ value: String(h.id), label: h.ad }))}
            value={hareketForm.hesap_id ? String(hareketForm.hesap_id) : null}
            onChange={(v) => setHareketForm({ ...hareketForm, hesap_id: v ? parseInt(v) : 0 })}
          />
          <NumberInput
            label="Tutar"
            placeholder="0"
            value={hareketForm.tutar}
            onChange={(v) => setHareketForm({ ...hareketForm, tutar: Number(v) || 0 })}
            thousandSeparator="."
            decimalSeparator=","
            leftSection="₺"
          />
          {hareketForm.odeme_yontemi === 'kredi_karti' && (
            <Select
              label="Taksit"
              data={[
                { value: '1', label: 'Tek Çekim' },
                { value: '2', label: '2 Taksit' },
                { value: '3', label: '3 Taksit' },
                { value: '6', label: '6 Taksit' },
                { value: '9', label: '9 Taksit' },
                { value: '12', label: '12 Taksit' },
              ]}
              value={String(hareketForm.taksit_sayisi)}
              onChange={(v) => setHareketForm({ ...hareketForm, taksit_sayisi: parseInt(v || '1') })}
            />
          )}
          <DateInput
            label="Tarih"
            value={hareketForm.tarih}
            onChange={(v) => setHareketForm({ ...hareketForm, tarih: v || new Date() })}
            locale="tr"
          />
          <Select
            label="Cari (Opsiyonel)"
            placeholder="Cari seçin"
            data={cariler.map(c => ({ value: String(c.id), label: c.unvan }))}
            value={hareketForm.cari_id ? String(hareketForm.cari_id) : null}
            onChange={(v) => setHareketForm({ ...hareketForm, cari_id: v ? parseInt(v) : null })}
            clearable
            searchable
          />
          <Textarea
            label="Açıklama"
            placeholder="Açıklama girin"
            value={hareketForm.aciklama}
            onChange={(e) => setHareketForm({ ...hareketForm, aciklama: e.target.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setHareketModalOpen(false)}>İptal</Button>
            <Button color={hareketForm.tip === 'gelir' ? 'teal' : 'red'} onClick={handleSaveHareket}>
              {hareketForm.tip === 'gelir' ? '📥 Gelir Kaydet' : '📤 Gider Kaydet'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Proje Hareket Modal */}
      <Modal
        opened={projeHareketModalOpen}
        onClose={() => setProjeHareketModalOpen(false)}
        title={<Text fw={600}>📊 Proje Gelir/Gider Ekle</Text>}
        size="md"
      >
        <Stack>
          <Select
            label="İşlem Tipi"
            data={[
              { value: 'gelir', label: '📈 Gelir' },
              { value: 'gider', label: '📉 Gider' },
            ]}
            value={hareketForm.tip}
            onChange={(v) => setHareketForm({ ...hareketForm, tip: v as any })}
          />
          <Select
            label="Kategori"
            data={hareketForm.tip === 'gelir' 
              ? [
                  { value: 'hakedis', label: '💰 Hakediş' },
                  { value: 'diger', label: '📦 Diğer Gelir' },
                ]
              : [
                  { value: 'malzeme', label: '📦 Malzeme' },
                  { value: 'taseron', label: '👷 Taşeron' },
                  { value: 'kira', label: '🏠 Kira' },
                  { value: 'diger', label: '📋 Diğer Gider' },
                ]
            }
            value={hareketForm.kategori}
            onChange={(v) => setHareketForm({ ...hareketForm, kategori: v || '' })}
          />
          <NumberInput
            label="Tutar"
            value={hareketForm.tutar}
            onChange={(v) => setHareketForm({ ...hareketForm, tutar: Number(v) || 0 })}
            thousandSeparator="."
            decimalSeparator=","
            leftSection="₺"
          />
          <DateInput
            label="Tarih"
            value={hareketForm.tarih}
            onChange={(v) => setHareketForm({ ...hareketForm, tarih: v || new Date() })}
            locale="tr"
          />
          <Textarea
            label="Açıklama"
            value={hareketForm.aciklama}
            onChange={(e) => setHareketForm({ ...hareketForm, aciklama: e.target.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setProjeHareketModalOpen(false)}>İptal</Button>
            <Button color={hareketForm.tip === 'gelir' ? 'teal' : 'red'} onClick={handleSaveProjeHareket}>
              Kaydet
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Kategori Detay Modal */}
      <Modal
        opened={kategoriDetayModal.open}
        onClose={() => setKategoriDetayModal({ ...kategoriDetayModal, open: false })}
        title={<Text fw={600}>{kategoriDetayModal.baslik}</Text>}
        size="lg"
      >
        <Stack>
          {/* Personel Giderleri Detayı */}
          {kategoriDetayModal.kategori === 'personel' && (
            <>
              {/* Özet Kartlar */}
              <SimpleGrid cols={3}>
                <Paper withBorder p="md" radius="md" style={{ borderLeft: '4px solid var(--mantine-color-blue-6)' }}>
                  <Text size="xs" c="dimmed">💵 Net Maaşlar</Text>
                  <Text fw={700} size="lg" c="blue.7">
                    {formatMoney(projeHareketler.filter(h => h.kategori === 'personel_maas').reduce((s, h) => s + h.tutar, 0))}
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md" style={{ borderLeft: '4px solid var(--mantine-color-orange-6)' }}>
                  <Text size="xs" c="dimmed">🏛️ SGK Primleri</Text>
                  <Text fw={700} size="lg" c="orange.7">
                    {formatMoney(projeHareketler.filter(h => h.kategori === 'personel_sgk').reduce((s, h) => s + h.tutar, 0))}
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md" style={{ borderLeft: '4px solid var(--mantine-color-red-6)' }}>
                  <Text size="xs" c="dimmed">📋 Vergiler</Text>
                  <Text fw={700} size="lg" c="red.7">
                    {formatMoney(projeHareketler.filter(h => h.kategori === 'personel_vergi').reduce((s, h) => s + h.tutar, 0))}
                  </Text>
                </Paper>
              </SimpleGrid>
              
              {/* Toplam */}
              <Paper withBorder p="md" radius="md" bg="red.0">
                <Group justify="space-between">
                  <Text fw={600}>👥 Toplam Personel Gideri</Text>
                  <Text fw={700} size="xl" c="red.7">
                    {formatMoney(projeHareketler.filter(h => 
                      ['personel_maas', 'personel_sgk', 'personel_vergi'].includes(h.kategori)
                    ).reduce((s, h) => s + h.tutar, 0))}
                  </Text>
                </Group>
              </Paper>
              
              {/* Liste */}
              <Paper withBorder radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Kategori</Table.Th>
                      <Table.Th>Açıklama</Table.Th>
                      <Table.Th ta="right">Tutar</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {projeHareketler
                      .filter(h => ['personel_maas', 'personel_sgk', 'personel_vergi'].includes(h.kategori))
                      .map((h) => (
                        <Table.Tr key={h.id}>
                          <Table.Td>{formatDate(h.tarih)}</Table.Td>
                          <Table.Td>
                            <Badge size="sm" color={
                              h.kategori === 'personel_maas' ? 'blue' :
                              h.kategori === 'personel_sgk' ? 'orange' : 'red'
                            } variant="light">
                              {h.kategori === 'personel_maas' ? '💵 Maaş' :
                               h.kategori === 'personel_sgk' ? '🏛️ SGK' : '📋 Vergi'}
                            </Badge>
                          </Table.Td>
                          <Table.Td><Text size="sm">{h.aciklama || '-'}</Text></Table.Td>
                          <Table.Td ta="right"><Text fw={600} c="red">{formatMoney(h.tutar)}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                    {projeHareketler.filter(h => ['personel_maas', 'personel_sgk', 'personel_vergi'].includes(h.kategori)).length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={4} ta="center" py="xl" c="dimmed">Bu dönemde personel gideri yok</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Paper>
              
              <Button variant="light" onClick={() => window.location.href = '/muhasebe/personel'}>
                Personel Sayfasına Git →
              </Button>
            </>
          )}

          {/* Hakediş Detayı */}
          {kategoriDetayModal.kategori === 'hakedis' && (
            <>
              <Paper withBorder p="md" radius="md" bg="teal.0">
                <Group justify="space-between">
                  <Text fw={600}>💰 Toplam Hakediş</Text>
                  <Text fw={700} size="xl" c="teal.7">
                    +{formatMoney(projeHareketler.filter(h => h.kategori === 'hakedis').reduce((s, h) => s + h.tutar, 0))}
                  </Text>
                </Group>
              </Paper>
              
              <Paper withBorder radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Açıklama</Table.Th>
                      <Table.Th ta="right">Tutar</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {projeHareketler
                      .filter(h => h.kategori === 'hakedis')
                      .map((h) => (
                        <Table.Tr key={h.id}>
                          <Table.Td>{formatDate(h.tarih)}</Table.Td>
                          <Table.Td><Text size="sm">{h.aciklama || '-'}</Text></Table.Td>
                          <Table.Td ta="right"><Text fw={600} c="teal">+{formatMoney(h.tutar)}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                    {projeHareketler.filter(h => h.kategori === 'hakedis').length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={3} ta="center" py="xl" c="dimmed">Bu dönemde hakediş kaydı yok</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Paper>
            </>
          )}

          {/* Diğer Giderler Detayı */}
          {kategoriDetayModal.kategori === 'diger_gider' && (
            <>
              <Paper withBorder p="md" radius="md" bg="red.0">
                <Group justify="space-between">
                  <Text fw={600}>📦 Toplam Diğer Gider</Text>
                  <Text fw={700} size="xl" c="red.7">
                    {formatMoney(projeHareketler.filter(h => 
                      h.tip === 'gider' && !['personel_maas', 'personel_sgk', 'personel_vergi'].includes(h.kategori)
                    ).reduce((s, h) => s + h.tutar, 0))}
                  </Text>
                </Group>
              </Paper>
              
              <Paper withBorder radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Kategori</Table.Th>
                      <Table.Th>Açıklama</Table.Th>
                      <Table.Th ta="right">Tutar</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {projeHareketler
                      .filter(h => h.tip === 'gider' && !['personel_maas', 'personel_sgk', 'personel_vergi'].includes(h.kategori))
                      .map((h) => (
                        <Table.Tr key={h.id}>
                          <Table.Td>{formatDate(h.tarih)}</Table.Td>
                          <Table.Td><Badge size="sm" variant="light">{h.kategori}</Badge></Table.Td>
                          <Table.Td><Text size="sm">{h.aciklama || '-'}</Text></Table.Td>
                          <Table.Td ta="right"><Text fw={600} c="red">{formatMoney(h.tutar)}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                    {projeHareketler.filter(h => h.tip === 'gider' && !['personel_maas', 'personel_sgk', 'personel_vergi'].includes(h.kategori)).length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={4} ta="center" py="xl" c="dimmed">Bu dönemde diğer gider kaydı yok</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Paper>
            </>
          )}

          {/* Diğer Gelirler Detayı */}
          {kategoriDetayModal.kategori === 'diger_gelir' && (
            <>
              <Paper withBorder p="md" radius="md" bg="teal.0">
                <Group justify="space-between">
                  <Text fw={600}>📦 Toplam Diğer Gelir</Text>
                  <Text fw={700} size="xl" c="teal.7">
                    +{formatMoney(projeHareketler.filter(h => h.tip === 'gelir' && h.kategori !== 'hakedis').reduce((s, h) => s + h.tutar, 0))}
                  </Text>
                </Group>
              </Paper>
              
              <Paper withBorder radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Kategori</Table.Th>
                      <Table.Th>Açıklama</Table.Th>
                      <Table.Th ta="right">Tutar</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {projeHareketler
                      .filter(h => h.tip === 'gelir' && h.kategori !== 'hakedis')
                      .map((h) => (
                        <Table.Tr key={h.id}>
                          <Table.Td>{formatDate(h.tarih)}</Table.Td>
                          <Table.Td><Badge size="sm" variant="light" color="teal">{h.kategori}</Badge></Table.Td>
                          <Table.Td><Text size="sm">{h.aciklama || '-'}</Text></Table.Td>
                          <Table.Td ta="right"><Text fw={600} c="teal">+{formatMoney(h.tutar)}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                    {projeHareketler.filter(h => h.tip === 'gelir' && h.kategori !== 'hakedis').length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={4} ta="center" py="xl" c="dimmed">Bu dönemde diğer gelir kaydı yok</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Paper>
            </>
          )}
        </Stack>
      </Modal>
    </Container>
  );
}
