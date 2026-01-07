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
  Select,
  useMantineColorScheme,
  Paper,
  Table,
  Progress,
  SegmentedControl
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconChartBar,
  IconChartPie,
  IconTrendingUp,
  IconTrendingDown,
  IconDownload,
  IconCalendar,
  IconReceipt,
  IconUsers,
  IconPackage,
  IconCash,
  IconArrowUpRight,
  IconArrowDownRight,
  IconPrinter
} from '@tabler/icons-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts';
import 'dayjs/locale/tr';

// Renk paleti
const COLORS = ['#4dabf7', '#51cf66', '#ff922b', '#ff6b6b', '#845ef7', '#339af0', '#20c997', '#f06595'];

// Demo veriler - Gerçek uygulamada localStorage'dan gelecek
const aylikGelirGider = [
  { ay: 'Oca', gelir: 125000, gider: 98000 },
  { ay: 'Şub', gelir: 118000, gider: 92000 },
  { ay: 'Mar', gelir: 145000, gider: 105000 },
  { ay: 'Nis', gelir: 138000, gider: 98000 },
  { ay: 'May', gelir: 152000, gider: 112000 },
  { ay: 'Haz', gelir: 168000, gider: 125000 },
  { ay: 'Tem', gelir: 175000, gider: 128000 },
  { ay: 'Ağu', gelir: 182000, gider: 135000 },
  { ay: 'Eyl', gelir: 165000, gider: 122000 },
  { ay: 'Eki', gelir: 158000, gider: 118000 },
  { ay: 'Kas', gelir: 172000, gider: 128000 },
  { ay: 'Ara', gelir: 195000, gider: 145000 },
];

const giderDagilimi = [
  { name: 'Personel', value: 450000, color: '#4dabf7' },
  { name: 'Malzeme', value: 280000, color: '#51cf66' },
  { name: 'Kira', value: 120000, color: '#ff922b' },
  { name: 'Faturalar', value: 85000, color: '#ff6b6b' },
  { name: 'Ulaşım', value: 65000, color: '#845ef7' },
  { name: 'Diğer', value: 100000, color: '#20c997' },
];

const departmanMaliyet = [
  { departman: 'Mutfak', maas: 185000, malzeme: 120000, diger: 25000 },
  { departman: 'Servis', maas: 95000, malzeme: 15000, diger: 8000 },
  { departman: 'Temizlik', maas: 45000, malzeme: 35000, diger: 5000 },
  { departman: 'Yönetim', maas: 85000, malzeme: 5000, diger: 12000 },
  { departman: 'Lojistik', maas: 40000, malzeme: 8000, diger: 25000 },
];

const stokDurumu = [
  { kategori: 'Gıda', deger: 45000, kalem: 25, kritik: 2 },
  { kategori: 'İçecek', deger: 12000, kalem: 8, kritik: 0 },
  { kategori: 'Temizlik', deger: 8500, kalem: 12, kritik: 1 },
  { kategori: 'Ambalaj', deger: 15000, kalem: 15, kritik: 0 },
  { kategori: 'Ekipman', deger: 5000, kalem: 10, kritik: 0 },
];

const cariOzet = [
  { tip: 'Alacak', toplam: 285000, adet: 12 },
  { tip: 'Borç', toplam: 125000, adet: 8 },
];

export default function RaporlarPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [donem, setDonem] = useState('yillik');
  const [raporTipi, setRaporTipi] = useState('genel');

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(value);
  };

  // Özet hesaplamalar
  const toplamGelir = aylikGelirGider.reduce((acc, d) => acc + d.gelir, 0);
  const toplamGider = aylikGelirGider.reduce((acc, d) => acc + d.gider, 0);
  const netKar = toplamGelir - toplamGider;
  const karMarji = ((netKar / toplamGelir) * 100).toFixed(1);

  // Önceki yıla göre değişim (demo)
  const gelirDegisim = 12.5;
  const giderDegisim = 8.2;
  const karDegisim = 18.3;

  return (
    <Box 
      style={{ 
        background: isDark 
          ? 'linear-gradient(180deg, rgba(77,171,247,0.05) 0%, rgba(0,0,0,0) 100%)' 
          : 'linear-gradient(180deg, rgba(77,171,247,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh' 
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>📈 Muhasebe Raporları</Title>
              <Text c="dimmed" size="lg">Detaylı finansal analizler ve raporlar</Text>
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
              <Button variant="light" leftSection={<IconPrinter size={16} />}>Yazdır</Button>
              <Button leftSection={<IconDownload size={16} />}>Excel İndir</Button>
            </Group>
          </Group>

          {/* Özet Kartlar */}
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Gelir</Text>
                <ThemeIcon color="green" variant="light" size="lg" radius="md"><IconTrendingUp size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="green">{formatMoney(toplamGelir)}</Text>
              <Group gap="xs" mt={4}>
                <Badge color="green" variant="light" size="xs" leftSection={<IconArrowUpRight size={10} />}>+{gelirDegisim}%</Badge>
                <Text size="xs" c="dimmed">önceki yıla göre</Text>
              </Group>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Gider</Text>
                <ThemeIcon color="red" variant="light" size="lg" radius="md"><IconTrendingDown size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="red">{formatMoney(toplamGider)}</Text>
              <Group gap="xs" mt={4}>
                <Badge color="orange" variant="light" size="xs" leftSection={<IconArrowUpRight size={10} />}>+{giderDegisim}%</Badge>
                <Text size="xs" c="dimmed">önceki yıla göre</Text>
              </Group>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Net Kâr</Text>
                <ThemeIcon color="teal" variant="light" size="lg" radius="md"><IconCash size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="teal">{formatMoney(netKar)}</Text>
              <Group gap="xs" mt={4}>
                <Badge color="teal" variant="light" size="xs" leftSection={<IconArrowUpRight size={10} />}>+{karDegisim}%</Badge>
                <Text size="xs" c="dimmed">önceki yıla göre</Text>
              </Group>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Kâr Marjı</Text>
                <ThemeIcon color="violet" variant="light" size="lg" radius="md"><IconChartPie size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="violet">%{karMarji}</Text>
              <Progress value={Number(karMarji)} color="violet" size="sm" mt="xs" />
            </Card>
          </SimpleGrid>

          {/* Grafikler - Satır 1 */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {/* Gelir/Gider Trendi */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg">Gelir/Gider Trendi</Text>
                <Badge variant="light">2025</Badge>
              </Group>
              <Box h={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={aylikGelirGider}>
                    <defs>
                      <linearGradient id="colorGelir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#51cf66" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#51cf66" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorGider" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                    <XAxis dataKey="ay" stroke={isDark ? '#888' : '#666'} fontSize={12} />
                    <YAxis stroke={isDark ? '#888' : '#666'} fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <RechartsTooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: isDark ? '#1a1b1e' : '#fff', border: `1px solid ${isDark ? '#333' : '#ddd'}`, borderRadius: '8px' }} />
                    <Legend />
                    <Area type="monotone" dataKey="gelir" stroke="#51cf66" strokeWidth={2} fillOpacity={1} fill="url(#colorGelir)" name="Gelir" />
                    <Area type="monotone" dataKey="gider" stroke="#ff6b6b" strokeWidth={2} fillOpacity={1} fill="url(#colorGider)" name="Gider" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Card>

            {/* Gider Dağılımı */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Text fw={600} size="lg" mb="md">Gider Dağılımı</Text>
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
                      {giderDagilimi.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
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
            {/* Departman Maliyetleri */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Text fw={600} size="lg" mb="md">Departman Bazlı Maliyet</Text>
              <Box h={280}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmanMaliyet} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                    <XAxis type="number" stroke={isDark ? '#888' : '#666'} fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <YAxis dataKey="departman" type="category" stroke={isDark ? '#888' : '#666'} fontSize={12} width={80} />
                    <RechartsTooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: isDark ? '#1a1b1e' : '#fff', border: `1px solid ${isDark ? '#333' : '#ddd'}`, borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="maas" stackId="a" fill="#4dabf7" name="Maaş" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="malzeme" stackId="a" fill="#51cf66" name="Malzeme" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="diger" stackId="a" fill="#ff922b" name="Diğer" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Card>

            {/* Kâr Trendi */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Text fw={600} size="lg" mb="md">Aylık Kâr Trendi</Text>
              <Box h={280}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aylikGelirGider.map(d => ({ ...d, kar: d.gelir - d.gider }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                    <XAxis dataKey="ay" stroke={isDark ? '#888' : '#666'} fontSize={12} />
                    <YAxis stroke={isDark ? '#888' : '#666'} fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <RechartsTooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ backgroundColor: isDark ? '#1a1b1e' : '#fff', border: `1px solid ${isDark ? '#333' : '#ddd'}`, borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="kar" stroke="#20c997" strokeWidth={3} dot={{ fill: '#20c997', r: 4 }} name="Kâr" />
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
                <Text fw={600} size="lg">Stok Durumu Özeti</Text>
                <ThemeIcon color="orange" variant="light"><IconPackage size={18} /></ThemeIcon>
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
                      <Table.Td><Text size="sm" fw={500}>{item.kategori}</Text></Table.Td>
                      <Table.Td><Text size="sm">{item.kalem}</Text></Table.Td>
                      <Table.Td>
                        {item.kritik > 0 ? (
                          <Badge color="red" variant="light">{item.kritik}</Badge>
                        ) : (
                          <Badge color="green" variant="light">0</Badge>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={500}>{formatMoney(item.deger)}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Paper withBorder p="sm" radius="md" mt="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Toplam Stok Değeri:</Text>
                  <Text size="lg" fw={700} c="orange">{formatMoney(stokDurumu.reduce((acc, s) => acc + s.deger, 0))}</Text>
                </Group>
              </Paper>
            </Card>

            {/* Cari Özet */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg">Cari Hesap Özeti</Text>
                <ThemeIcon color="blue" variant="light"><IconUsers size={18} /></ThemeIcon>
              </Group>
              <SimpleGrid cols={2} mb="md">
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Alacak</Text>
                  <Text fw={700} size="xl" c="green" mt="xs">{formatMoney(cariOzet[0].toplam)}</Text>
                  <Text size="xs" c="dimmed">{cariOzet[0].adet} cari</Text>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Borç</Text>
                  <Text fw={700} size="xl" c="red" mt="xs">{formatMoney(cariOzet[1].toplam)}</Text>
                  <Text size="xs" c="dimmed">{cariOzet[1].adet} cari</Text>
                </Paper>
              </SimpleGrid>
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Net Cari Bakiye:</Text>
                  <Text size="xl" fw={700} c="teal">{formatMoney(cariOzet[0].toplam - cariOzet[1].toplam)}</Text>
                </Group>
                <Progress 
                  value={(cariOzet[0].toplam / (cariOzet[0].toplam + cariOzet[1].toplam)) * 100} 
                  color="green" 
                  size="lg" 
                  mt="md"
                  radius="xl"
                />
                <Group justify="space-between" mt="xs">
                  <Text size="xs" c="green">Alacak %{((cariOzet[0].toplam / (cariOzet[0].toplam + cariOzet[1].toplam)) * 100).toFixed(0)}</Text>
                  <Text size="xs" c="red">Borç %{((cariOzet[1].toplam / (cariOzet[0].toplam + cariOzet[1].toplam)) * 100).toFixed(0)}</Text>
                </Group>
              </Paper>
            </Card>
          </SimpleGrid>

          {/* Aylık Detay Tablosu */}
          <Card withBorder shadow="sm" p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <Text fw={600} size="lg">Aylık Gelir/Gider Detayı</Text>
              <Button variant="light" size="xs" leftSection={<IconDownload size={14} />}>Excel</Button>
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
                        <Table.Td><Text size="sm" fw={500}>{item.ay}</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}><Text size="sm" c="green">{formatMoney(item.gelir)}</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}><Text size="sm" c="red">{formatMoney(item.gider)}</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={600} c={kar >= 0 ? 'teal' : 'red'}>{formatMoney(kar)}</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}><Badge color={Number(marj) >= 20 ? 'green' : Number(marj) >= 10 ? 'yellow' : 'red'} variant="light">%{marj}</Badge></Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr style={{ fontWeight: 'bold' }}>
                    <Table.Td>TOPLAM</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={700} c="green">{formatMoney(toplamGelir)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={700} c="red">{formatMoney(toplamGider)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={700} c="teal">{formatMoney(netKar)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Badge color="teal" variant="filled">%{karMarji}</Badge></Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
