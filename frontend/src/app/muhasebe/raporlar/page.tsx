'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconCash,
  IconChartPie,
  IconPackage,
  IconRefresh,
  IconReportMoney,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import RaporMerkeziModal from '@/components/rapor-merkezi/RaporMerkeziModal';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import { stokAPI } from '@/lib/api/services/stok';
import { formatMoney } from '@/lib/formatters';

interface KasaBankaHareket {
  tarih?: string;
  created_at?: string;
  tip?: string;
  yon?: string;
  tutar?: number | string;
  kategori?: string;
  aciklama?: string;
  hesap_adi?: string;
}

interface CariItem {
  bakiye?: number | string;
  unvan?: string;
  tip?: string;
}

interface StokKart {
  kategori?: string;
  grup?: string;
  birim_fiyat?: number | string;
  miktar?: number | string;
  stok_miktari?: number | string;
  kritik_stok?: number | string;
  ad?: string;
}

interface KasaBankaOzetData {
  toplam_bakiye?: number;
  hesap_sayisi?: number;
  hesaplar?: Array<{ hesap_adi?: string; bakiye?: number; tip?: string }>;
  kasaBakiye?: number;
  kasa_bakiye?: number;
  bankaBakiye?: number;
  banka_bakiye?: number;
}

const AY_ISIMLERI = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const GIDER_RENKLERI: Record<string, string> = {
  Personel: '#4dabf7',
  Malzeme: '#51cf66',
  Kira: '#ff922b',
  Faturalar: '#ff6b6b',
  Ulaşım: '#845ef7',
  Diğer: '#20c997',
};

export default function RaporlarPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [donem, setDonem] = useState('yillik');
  const [loading, setLoading] = useState(true);
  const [raporMerkeziOpen, setRaporMerkeziOpen] = useState(false);

  // Gerçek veri state'leri
  const [hareketler, setHareketler] = useState<KasaBankaHareket[]>([]);
  const [cariler, setCariler] = useState<CariItem[]>([]);
  const [stokKartlar, setStokKartlar] = useState<StokKart[]>([]);
  const [kasaBankaOzet, setKasaBankaOzet] = useState<KasaBankaOzetData | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hareketRes, cariRes, stokRes, ozetRes] = await Promise.all([
        muhasebeAPI.getKasaBankaHareketler({ limit: 500 }),
        muhasebeAPI.getCariler(),
        stokAPI.getKartlar({ limit: 500 }),
        muhasebeAPI.getKasaBankaOzet(),
      ]);
      if (hareketRes.success) setHareketler(hareketRes.data || []);
      if (cariRes.success) setCariler(cariRes.data || []);
      if (stokRes.success) setStokKartlar(stokRes.data || []);
      if (ozetRes.success) setKasaBankaOzet(ozetRes.data);
    } catch (error) {
      console.error('Rapor verileri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==================== HESAPLAMALAR ====================

  // Aylık gelir/gider hesaplama (kasa-banka hareketlerinden)
  const aylikGelirGider = useMemo(() => {
    const yil = new Date().getFullYear();
    const aylikData = AY_ISIMLERI.map((ay) => ({ ay, gelir: 0, gider: 0 }));

    for (const h of hareketler) {
      if (!h.tarih) continue;
      const d = new Date(h.tarih);
      if (d.getFullYear() !== yil) continue;
      const ayIndex = d.getMonth();
      if (h.tip === 'gelir' || h.yon === 'gelir') {
        aylikData[ayIndex].gelir += Math.abs(Number(h.tutar) || 0);
      } else if (h.tip === 'gider' || h.yon === 'gider') {
        aylikData[ayIndex].gider += Math.abs(Number(h.tutar) || 0);
      }
    }

    return aylikData;
  }, [hareketler]);

  // Gider dağılımı (hareketlerden kategori bazlı)
  const giderDagilimi = useMemo(() => {
    const kategoriler: Record<string, number> = {};
    for (const h of hareketler) {
      if (h.tip === 'gider' || h.yon === 'gider') {
        const kat = h.kategori || h.aciklama?.split(' ')[0] || 'Diğer';
        kategoriler[kat] = (kategoriler[kat] || 0) + Math.abs(Number(h.tutar) || 0);
      }
    }

    const renkler = ['#4dabf7', '#51cf66', '#ff922b', '#ff6b6b', '#845ef7', '#20c997', '#fcc419', '#e599f7'];
    return Object.entries(kategoriler)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], i) => ({
        name,
        value,
        color: GIDER_RENKLERI[name] || renkler[i % renkler.length],
      }));
  }, [hareketler]);

  // Stok durumu özeti (stok kartlarından kategori bazlı)
  const stokDurumu = useMemo(() => {
    const kategoriler: Record<string, { deger: number; kalem: number; kritik: number }> = {};
    for (const k of stokKartlar) {
      const kat = k.kategori || k.grup || 'Diğer';
      if (!kategoriler[kat]) kategoriler[kat] = { deger: 0, kalem: 0, kritik: 0 };
      kategoriler[kat].kalem += 1;
      kategoriler[kat].deger += Number(k.birim_fiyat || 0) * Number(k.miktar || k.stok_miktari || 0);
      if (k.kritik_stok && Number(k.miktar || k.stok_miktari || 0) <= Number(k.kritik_stok)) {
        kategoriler[kat].kritik += 1;
      }
    }
    return Object.entries(kategoriler).map(([kategori, data]) => ({ kategori, ...data }));
  }, [stokKartlar]);

  // Cari özet hesaplama
  const cariOzet = useMemo(() => {
    let alacakToplam = 0;
    let alacakAdet = 0;
    let borcToplam = 0;
    let borcAdet = 0;

    for (const c of cariler) {
      const bakiye = Number(c.bakiye || 0);
      if (bakiye > 0) {
        alacakToplam += bakiye;
        alacakAdet += 1;
      } else if (bakiye < 0) {
        borcToplam += Math.abs(bakiye);
        borcAdet += 1;
      }
    }

    return [
      { tip: 'Alacak', toplam: alacakToplam, adet: alacakAdet },
      { tip: 'Borç', toplam: borcToplam, adet: borcAdet },
    ];
  }, [cariler]);

  // Özet hesaplamalar
  const toplamGelir = aylikGelirGider.reduce((acc, d) => acc + d.gelir, 0);
  const toplamGider = aylikGelirGider.reduce((acc, d) => acc + d.gider, 0);
  const netKar = toplamGelir - toplamGider;
  const karMarji = toplamGelir > 0 ? ((netKar / toplamGelir) * 100).toFixed(1) : '0.0';

  if (loading) {
    return (
      <Center h="80vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Rapor verileri yükleniyor...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(77,171,247,0.05) 0%, rgba(0,0,0,0) 100%)'
          : 'linear-gradient(180deg, rgba(77,171,247,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh',
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>
                📈 Muhasebe Raporları
              </Title>
              <Text c="dimmed" size="lg">
                Detaylı finansal analizler ve raporlar
              </Text>
            </Box>
            <Group>
              <SegmentedControl
                value={donem}
                onChange={setDonem}
                data={[
                  { label: 'Aylık', value: 'aylik' },
                  { label: 'Yıllık', value: 'yillik' },
                ]}
              />
              <Button
                variant="light"
                color="indigo"
                leftSection={<IconReportMoney size={16} />}
                onClick={() => setRaporMerkeziOpen(true)}
              >
                Rapor Merkezi
              </Button>
              <Button variant="subtle" leftSection={<IconRefresh size={16} />} onClick={loadData}>
                Yenile
              </Button>
            </Group>
          </Group>

          {/* Özet Kartlar */}
          <SimpleGrid cols={{ base: 2, md: 4 }}>
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
                {new Date().getFullYear()} yılı toplamı
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
                {new Date().getFullYear()} yılı toplamı
              </Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Net Kâr
                </Text>
                <ThemeIcon color="teal" variant="light" size="lg" radius="md">
                  <IconCash size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c={netKar >= 0 ? 'teal' : 'red'}>
                {formatMoney(netKar)}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Gelir - Gider farkı
              </Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Kâr Marjı
                </Text>
                <ThemeIcon color="violet" variant="light" size="lg" radius="md">
                  <IconChartPie size={20} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="violet">
                %{karMarji}
              </Text>
              <Progress value={Number(karMarji)} color="violet" size="sm" mt="xs" />
            </Card>
          </SimpleGrid>

          {/* Grafikler - Satır 1 */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {/* Gelir/Gider Trendi */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg">
                  Gelir/Gider Trendi
                </Text>
                <Badge variant="light">{new Date().getFullYear()}</Badge>
              </Group>
              <Box h={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={aylikGelirGider}>
                    <defs>
                      <linearGradient id="colorGelir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#51cf66" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#51cf66" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorGider" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                    <XAxis dataKey="ay" stroke={isDark ? '#888' : '#666'} fontSize={12} />
                    <YAxis
                      stroke={isDark ? '#888' : '#666'}
                      fontSize={12}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => formatMoney(value)}
                      contentStyle={{
                        backgroundColor: isDark ? '#1a1b1e' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="gelir"
                      stroke="#51cf66"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorGelir)"
                      name="Gelir"
                    />
                    <Area
                      type="monotone"
                      dataKey="gider"
                      stroke="#ff6b6b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorGider)"
                      name="Gider"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Card>

            {/* Gider Dağılımı */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Text fw={600} size="lg" mb="md">
                Gider Dağılımı
              </Text>
              <Box h={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={giderDagilimi}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {giderDagilimi.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => formatMoney(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </SimpleGrid>

          {/* Grafikler - Satır 2 */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {/* Kasa & Banka Özeti */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg">
                  Kasa & Banka Özeti
                </Text>
                <ThemeIcon color="blue" variant="light">
                  <IconCash size={18} />
                </ThemeIcon>
              </Group>
              {kasaBankaOzet ? (
                <Stack gap="md">
                  <SimpleGrid cols={2}>
                    <Paper withBorder p="md" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Kasa Bakiye
                      </Text>
                      <Text fw={700} size="lg" c="teal" mt="xs">
                        {formatMoney(kasaBankaOzet.kasaBakiye || kasaBankaOzet.kasa_bakiye || 0)}
                      </Text>
                    </Paper>
                    <Paper withBorder p="md" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Banka Bakiye
                      </Text>
                      <Text fw={700} size="lg" c="blue" mt="xs">
                        {formatMoney(kasaBankaOzet.bankaBakiye || kasaBankaOzet.banka_bakiye || 0)}
                      </Text>
                    </Paper>
                  </SimpleGrid>
                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>
                        Toplam Varlık:
                      </Text>
                      <Text size="xl" fw={700} c="teal">
                        {formatMoney(
                          (kasaBankaOzet.kasaBakiye || kasaBankaOzet.kasa_bakiye || 0) +
                            (kasaBankaOzet.bankaBakiye || kasaBankaOzet.banka_bakiye || 0)
                        )}
                      </Text>
                    </Group>
                  </Paper>
                </Stack>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  Kasa-Banka verisi bulunamadı
                </Text>
              )}
            </Card>

            {/* Kâr Trendi */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Text fw={600} size="lg" mb="md">
                Aylık Kâr Trendi
              </Text>
              <Box h={280}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aylikGelirGider.map((d) => ({ ...d, kar: d.gelir - d.gider }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                    <XAxis dataKey="ay" stroke={isDark ? '#888' : '#666'} fontSize={12} />
                    <YAxis
                      stroke={isDark ? '#888' : '#666'}
                      fontSize={12}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => formatMoney(value)}
                      contentStyle={{
                        backgroundColor: isDark ? '#1a1b1e' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="kar"
                      stroke="#20c997"
                      strokeWidth={3}
                      dot={{ fill: '#20c997', r: 4 }}
                      name="Kâr"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </SimpleGrid>

          {/* Alt Tablolar */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {/* Stok Durumu */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg">
                  Stok Durumu Özeti
                </Text>
                <ThemeIcon color="orange" variant="light">
                  <IconPackage size={18} />
                </ThemeIcon>
              </Group>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Kategori</Table.Th>
                    <Table.Th>Kalem</Table.Th>
                    <Table.Th>Kritik</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Değer</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stokDurumu.map((item) => (
                    <Table.Tr key={item.kategori}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {item.kategori}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{item.kalem}</Text>
                      </Table.Td>
                      <Table.Td>
                        {item.kritik > 0 ? (
                          <Badge color="red" variant="light">
                            {item.kritik}
                          </Badge>
                        ) : (
                          <Badge color="green" variant="light">
                            0
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={500}>
                          {formatMoney(item.deger)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Paper withBorder p="sm" radius="md" mt="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Toplam Stok Değeri:
                  </Text>
                  <Text size="lg" fw={700} c="orange">
                    {formatMoney(stokDurumu.reduce((acc, s) => acc + s.deger, 0))}
                  </Text>
                </Group>
              </Paper>
            </Card>

            {/* Cari Özet */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg">
                  Cari Hesap Özeti
                </Text>
                <ThemeIcon color="blue" variant="light">
                  <IconUsers size={18} />
                </ThemeIcon>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Toplam Alacak
                  </Text>
                  <Text fw={700} size="xl" c="green" mt="xs">
                    {formatMoney(cariOzet[0].toplam)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {cariOzet[0].adet} cari
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Toplam Borç
                  </Text>
                  <Text fw={700} size="xl" c="red" mt="xs">
                    {formatMoney(cariOzet[1].toplam)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {cariOzet[1].adet} cari
                  </Text>
                </Paper>
              </SimpleGrid>
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    Net Cari Bakiye:
                  </Text>
                  <Text size="xl" fw={700} c="teal">
                    {formatMoney(cariOzet[0].toplam - cariOzet[1].toplam)}
                  </Text>
                </Group>
                <Progress
                  value={(cariOzet[0].toplam / (cariOzet[0].toplam + cariOzet[1].toplam)) * 100}
                  color="green"
                  size="lg"
                  mt="md"
                  radius="xl"
                />
                <Group justify="space-between" mt="xs">
                  <Text size="xs" c="green">
                    Alacak %{((cariOzet[0].toplam / (cariOzet[0].toplam + cariOzet[1].toplam)) * 100).toFixed(0)}
                  </Text>
                  <Text size="xs" c="red">
                    Borç %{((cariOzet[1].toplam / (cariOzet[0].toplam + cariOzet[1].toplam)) * 100).toFixed(0)}
                  </Text>
                </Group>
              </Paper>
            </Card>
          </SimpleGrid>

          {/* Aylık Detay Tablosu */}
          <Card withBorder shadow="sm" p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <Text fw={600} size="lg">
                Aylık Gelir/Gider Detayı
              </Text>
              <Button
                variant="light"
                size="xs"
                color="indigo"
                leftSection={<IconReportMoney size={14} />}
                onClick={() => setRaporMerkeziOpen(true)}
              >
                Dışa Aktar
              </Button>
            </Group>
            <Table.ScrollContainer minWidth={600}>
              <Table verticalSpacing="sm" highlightOnHover striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Ay</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Gelir</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Gider</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Net Kâr</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Marj</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {aylikGelirGider.map((item) => {
                    const kar = item.gelir - item.gider;
                    const marj = ((kar / item.gelir) * 100).toFixed(1);
                    return (
                      <Table.Tr key={item.ay}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {item.ay}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" c="green">
                            {formatMoney(item.gelir)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" c="red">
                            {formatMoney(item.gider)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600} c={kar >= 0 ? 'teal' : 'red'}>
                            {formatMoney(kar)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Badge
                            color={Number(marj) >= 20 ? 'green' : Number(marj) >= 10 ? 'yellow' : 'red'}
                            variant="light"
                          >
                            %{marj}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr style={{ fontWeight: 'bold' }}>
                    <Table.Td>TOPLAM</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={700} c="green">
                        {formatMoney(toplamGelir)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={700} c="red">
                        {formatMoney(toplamGider)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={700} c="teal">
                        {formatMoney(netKar)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Badge color="teal" variant="filled">
                        %{karMarji}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Stack>
      </Container>

      {/* Rapor Merkezi Modal */}
      <RaporMerkeziModal opened={raporMerkeziOpen} onClose={() => setRaporMerkeziOpen(false)} />
    </Box>
  );
}
