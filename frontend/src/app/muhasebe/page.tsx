'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Container,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconBuildingBank,
  IconCalendarStats,
  IconCash,
  IconDotsVertical,
  IconPackage,
  IconReceipt,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import ProjeCard from '@/components/muhasebe/ProjeCard';
import ProjeYonetimModal from '@/components/muhasebe/ProjeYonetimModal';

// Demo veriler
const monthlyData = [
  { ay: 'Oca', gelir: 125000, gider: 89000 },
  { ay: 'Şub', gelir: 142000, gider: 95000 },
  { ay: 'Mar', gelir: 158000, gider: 102000 },
  { ay: 'Nis', gelir: 135000, gider: 88000 },
  { ay: 'May', gelir: 189000, gider: 115000 },
  { ay: 'Haz', gelir: 203000, gider: 128000 },
  { ay: 'Tem', gelir: 178000, gider: 110000 },
  { ay: 'Ağu', gelir: 195000, gider: 125000 },
  { ay: 'Eyl', gelir: 220000, gider: 142000 },
  { ay: 'Eki', gelir: 245000, gider: 158000 },
  { ay: 'Kas', gelir: 268000, gider: 172000 },
  { ay: 'Ara', gelir: 298000, gider: 195000 },
];

const giderDagilimi = [
  { name: 'Personel', value: 35, color: '#339af0' },
  { name: 'Malzeme', value: 28, color: '#51cf66' },
  { name: 'Kira', value: 15, color: '#fcc419' },
  { name: 'Ulaşım', value: 12, color: '#ff6b6b' },
  { name: 'Diğer', value: 10, color: '#845ef7' },
];

const sonIslemler = [
  {
    id: 1,
    tip: 'gelir',
    aciklama: 'Metro İhale Ödemesi',
    tutar: 45000,
    tarih: '02.01.2026',
    durum: 'tamamlandi',
  },
  {
    id: 2,
    tip: 'gider',
    aciklama: 'Personel Maaşları',
    tutar: -28500,
    tarih: '01.01.2026',
    durum: 'tamamlandi',
  },
  {
    id: 3,
    tip: 'gelir',
    aciklama: 'Okul Yemekhane Faturası',
    tutar: 18750,
    tarih: '30.12.2025',
    durum: 'beklemede',
  },
  {
    id: 4,
    tip: 'gider',
    aciklama: 'Malzeme Alımı - Metro',
    tutar: -12400,
    tarih: '28.12.2025',
    durum: 'tamamlandi',
  },
  {
    id: 5,
    tip: 'gider',
    aciklama: 'Araç Yakıt',
    tutar: -3200,
    tarih: '27.12.2025',
    durum: 'tamamlandi',
  },
];

const bekleyenFaturalar = [
  { id: 1, firma: 'ABC Gıda Ltd.', tutar: 15600, vadeTarihi: '15.01.2026', gun: 13 },
  { id: 2, firma: 'XYZ Malzeme A.Ş.', tutar: 8900, vadeTarihi: '10.01.2026', gun: 8 },
  { id: 3, firma: 'Temizlik Hizmetleri', tutar: 4500, vadeTarihi: '05.01.2026', gun: 3 },
];

export default function MuhasebeDashboard() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [projeModalOpen, setProjeModalOpen] = useState(false);

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Özet kartları
  const stats = [
    {
      title: 'Toplam Gelir',
      value: formatMoney(2356000),
      change: '+12.5%',
      trend: 'up',
      icon: IconTrendingUp,
      color: 'green',
      description: 'Bu yıl',
    },
    {
      title: 'Toplam Gider',
      value: formatMoney(1519000),
      change: '+8.2%',
      trend: 'up',
      icon: IconTrendingDown,
      color: 'red',
      description: 'Bu yıl',
    },
    {
      title: 'Net Kâr',
      value: formatMoney(837000),
      change: '+23.1%',
      trend: 'up',
      icon: IconCash,
      color: 'teal',
      description: 'Bu yıl',
    },
    {
      title: 'Bekleyen Fatura',
      value: '12',
      change: '₺48.200',
      trend: 'neutral',
      icon: IconReceipt,
      color: 'orange',
      description: 'Ödenmemiş',
    },
  ];

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
                💰 Muhasebe Dashboard
              </Title>
              <Text c="dimmed" size="lg">
                Mali durumunuzun genel görünümü
              </Text>
            </Box>
            <Badge
              size="lg"
              variant="light"
              color="teal"
              leftSection={<IconCalendarStats size={14} />}
            >
              Ocak 2026
            </Badge>
          </Group>

          {/* Stats Cards */}
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
            {stats.map((stat, index) => (
              <Card key={index} withBorder shadow="sm" p="lg" radius="md">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    {stat.title}
                  </Text>
                  <ThemeIcon color={stat.color} variant="light" size="lg" radius="md">
                    <stat.icon size={20} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="xl" mt="md">
                  {stat.value}
                </Text>
                <Group gap="xs" mt={4}>
                  {stat.trend === 'up' && (
                    <ThemeIcon color="green" variant="light" size="sm" radius="xl">
                      <IconArrowUpRight size={14} />
                    </ThemeIcon>
                  )}
                  {stat.trend === 'down' && (
                    <ThemeIcon color="red" variant="light" size="sm" radius="xl">
                      <IconArrowDownRight size={14} />
                    </ThemeIcon>
                  )}
                  <Text
                    size="sm"
                    c={stat.trend === 'up' ? 'green' : stat.trend === 'down' ? 'red' : 'dimmed'}
                  >
                    {stat.change}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {stat.description}
                  </Text>
                </Group>
              </Card>
            ))}
          </SimpleGrid>

          {/* Proje Merkezi Kartı */}
          <ProjeCard onYonetClick={() => setProjeModalOpen(true)} />

          {/* Proje Yönetim Modal */}
          <ProjeYonetimModal opened={projeModalOpen} onClose={() => setProjeModalOpen(false)} />

          {/* Charts Row */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {/* Gelir/Gider Grafiği */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600} size="lg">
                    Gelir / Gider Trendi
                  </Text>
                  <Text size="sm" c="dimmed">
                    Aylık karşılaştırma
                  </Text>
                </div>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Group>
              <Box h={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
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
                    <XAxis
                      dataKey="ay"
                      stroke={isDark ? '#888' : '#666'}
                      fontSize={isMobile ? 10 : 12}
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      interval={isMobile ? 1 : 0}
                    />
                    <YAxis
                      stroke={isDark ? '#888' : '#666'}
                      fontSize={isMobile ? 10 : 12}
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      width={isMobile ? 35 : 45}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => formatMoney(value)}
                      contentStyle={{
                        backgroundColor: isDark ? '#1a1b1e' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        borderRadius: '8px',
                      }}
                    />
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
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600} size="lg">
                    Gider Dağılımı
                  </Text>
                  <Text size="sm" c="dimmed">
                    Kategorilere göre
                  </Text>
                </div>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Group>
              <Box h={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={giderDagilimi}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 40 : 60}
                      outerRadius={isMobile ? 70 : 100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {giderDagilimi.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend
                      verticalAlign="bottom"
                      height={isMobile ? 60 : 36}
                      wrapperStyle={{ fontSize: isMobile ? 11 : 14 }}
                      formatter={(value, entry: any) => (
                        <span
                          style={{ color: isDark ? '#ccc' : '#333', fontSize: isMobile ? 11 : 14 }}
                        >
                          {value} ({entry.payload.value}%)
                        </span>
                      )}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => `%${value}`}
                      contentStyle={{
                        backgroundColor: isDark ? '#1a1b1e' : '#fff',
                        border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </SimpleGrid>

          {/* Tables Row */}
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {/* Son İşlemler */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600} size="lg">
                    Son İşlemler
                  </Text>
                  <Text size="sm" c="dimmed">
                    Son 5 hareket
                  </Text>
                </div>
                <Badge variant="light" color="blue">
                  Tümünü Gör
                </Badge>
              </Group>
              <Table.ScrollContainer minWidth={320}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>İşlem</Table.Th>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sonIslemler.map((islem) => (
                      <Table.Tr key={islem.id}>
                        <Table.Td>
                          <Group gap="xs">
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
                            <div>
                              <Text size="sm" fw={500}>
                                {islem.aciklama}
                              </Text>
                              {islem.durum === 'beklemede' && (
                                <Badge size="xs" color="orange" variant="light">
                                  Beklemede
                                </Badge>
                              )}
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {islem.tarih}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600} c={islem.tutar > 0 ? 'green' : 'red'}>
                            {islem.tutar > 0 ? '+' : ''}
                            {formatMoney(islem.tutar)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>

            {/* Bekleyen Faturalar */}
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600} size="lg">
                    Yaklaşan Ödemeler
                  </Text>
                  <Text size="sm" c="dimmed">
                    Vadesi yaklaşan faturalar
                  </Text>
                </div>
                <ThemeIcon color="orange" variant="light" size="lg" radius="md">
                  <IconAlertCircle size={20} />
                </ThemeIcon>
              </Group>
              <Stack gap="md">
                {bekleyenFaturalar.map((fatura) => (
                  <Paper
                    key={fatura.id}
                    withBorder
                    p="md"
                    radius="md"
                    style={{
                      borderColor: fatura.gun <= 3 ? 'var(--mantine-color-red-5)' : undefined,
                      borderWidth: fatura.gun <= 3 ? 2 : 1,
                    }}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text fw={500}>{fatura.firma}</Text>
                        <Group gap="xs">
                          <Text size="sm" c="dimmed">
                            Vade: {fatura.vadeTarihi}
                          </Text>
                          <Badge
                            size="sm"
                            color={fatura.gun <= 3 ? 'red' : fatura.gun <= 7 ? 'orange' : 'blue'}
                            variant="light"
                          >
                            {fatura.gun} gün kaldı
                          </Badge>
                        </Group>
                      </div>
                      <Text fw={700} size="lg" c="red">
                        {formatMoney(fatura.tutar)}
                      </Text>
                    </Group>
                    <Progress
                      value={((14 - fatura.gun) / 14) * 100}
                      color={fatura.gun <= 3 ? 'red' : fatura.gun <= 7 ? 'orange' : 'blue'}
                      size="xs"
                      mt="sm"
                    />
                  </Paper>
                ))}
              </Stack>
            </Card>
          </SimpleGrid>

          {/* Quick Stats Bottom */}
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
            <Paper withBorder p="md" radius="md">
              <Group>
                <ThemeIcon color="blue" variant="light" size="xl" radius="md">
                  <IconUsers size={24} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Aktif Cariler
                  </Text>
                  <Text fw={700} size="xl">
                    48
                  </Text>
                </div>
              </Group>
            </Paper>
            <Paper withBorder p="md" radius="md">
              <Group>
                <ThemeIcon color="violet" variant="light" size="xl" radius="md">
                  <IconReceipt size={24} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Bu Ay Fatura
                  </Text>
                  <Text fw={700} size="xl">
                    127
                  </Text>
                </div>
              </Group>
            </Paper>
            <Paper withBorder p="md" radius="md">
              <Group>
                <ThemeIcon color="cyan" variant="light" size="xl" radius="md">
                  <IconPackage size={24} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Stok Kalem
                  </Text>
                  <Text fw={700} size="xl">
                    342
                  </Text>
                </div>
              </Group>
            </Paper>
            <Paper withBorder p="md" radius="md">
              <Group>
                <ThemeIcon color="green" variant="light" size="xl" radius="md">
                  <IconBuildingBank size={24} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Banka Bakiye
                  </Text>
                  <Text fw={700} size="xl">
                    {formatMoney(485000)}
                  </Text>
                </div>
              </Group>
            </Paper>
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}
