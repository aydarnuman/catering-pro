'use client';

import { Badge, Card, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconChartBar,
  IconChartLine,
  IconMinus,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_BASE_URL } from '@/lib/config';

interface TrendData {
  tarih: string;
  urun_sayisi: number;
  kayit_sayisi: number;
  ort_fiyat: number;
}

interface KategoriData {
  kategori_id: number;
  kategori_ad: string;
  urun_sayisi: number;
  guncel_fiyat: number;
  eski_fiyat: number;
  ortalama_guven: number;
}

interface DashboardChartsProps {
  kategoriler: KategoriData[];
}

const COLORS = ['#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2', '#20c997', '#fd7e14', '#868e96'];

// Özel tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper p="xs" withBorder shadow="sm" style={{ background: 'white' }}>
        <Text size="xs" fw={500}>
          {label}
        </Text>
        {payload.map((entry: any, index: number) => (
          <Text key={index} size="sm" c={entry.color}>
            {entry.name}: {entry.value?.toLocaleString('tr-TR')}
          </Text>
        ))}
      </Paper>
    );
  }
  return null;
};

export function DashboardCharts({ kategoriler }: DashboardChartsProps) {
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/raporlar/trend`);
        const data = await res.json();
        if (data.success) {
          setTrendData(
            data.data.map((d: any) => ({
              ...d,
              tarih: new Date(d.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
              ort_fiyat: parseFloat(d.ort_fiyat) || 0,
              kayit_sayisi: parseInt(d.kayit_sayisi, 10) || 0,
              urun_sayisi: parseInt(d.urun_sayisi, 10) || 0,
            }))
          );
        }
      } catch (error) {
        console.error('Trend verisi yükleme hatası:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrend();
  }, []);

  // Kategori pie chart verisi
  const pieData = kategoriler
    .filter((k) => k.urun_sayisi > 0)
    .slice(0, 8)
    .map((k) => ({
      name: k.kategori_ad,
      value: k.urun_sayisi,
      guncel: k.guncel_fiyat,
      eski: k.eski_fiyat,
    }));

  // En aktif kategoriler (bar chart için)
  const barData = kategoriler
    .filter((k) => k.urun_sayisi > 0)
    .sort((a, b) => b.urun_sayisi - a.urun_sayisi)
    .slice(0, 6)
    .map((k) => ({
      name: k.kategori_ad.length > 12 ? k.kategori_ad.substring(0, 12) + '...' : k.kategori_ad,
      guncel: k.guncel_fiyat,
      eski: k.eski_fiyat,
      guven: k.ortalama_guven,
    }));

  // Trend hesapla
  const trendYuzdesi =
    trendData.length >= 2
      ? (
          ((trendData[trendData.length - 1].kayit_sayisi - trendData[0].kayit_sayisi) / (trendData[0].kayit_sayisi || 1)) *
          100
        ).toFixed(1)
      : null;

  if (loading || kategoriler.length === 0) {
    return null;
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="lg">
      {/* Fiyat Güncelleme Trendi */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="blue">
              <IconChartLine size={14} />
            </ThemeIcon>
            <Text size="sm" fw={500}>
              Son 30 Gün Fiyat Güncelleme Trendi
            </Text>
          </Group>
          {trendYuzdesi && (
            <Badge
              color={parseFloat(trendYuzdesi) > 0 ? 'green' : parseFloat(trendYuzdesi) < 0 ? 'red' : 'gray'}
              variant="light"
              leftSection={
                parseFloat(trendYuzdesi) > 0 ? (
                  <IconTrendingUp size={12} />
                ) : parseFloat(trendYuzdesi) < 0 ? (
                  <IconTrendingDown size={12} />
                ) : (
                  <IconMinus size={12} />
                )
              }
            >
              {parseFloat(trendYuzdesi) > 0 ? '+' : ''}
              {trendYuzdesi}%
            </Badge>
          )}
        </Group>

        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorKayit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#228be6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#228be6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="tarih" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="kayit_sayisi"
                name="Güncelleme"
                stroke="#228be6"
                strokeWidth={2}
                fill="url(#colorKayit)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Trend verisi bulunamadı
          </Text>
        )}
      </Paper>

      {/* Kategori Dağılımı Pie Chart */}
      <Paper p="md" withBorder>
        <Group gap="xs" mb="md">
          <ThemeIcon size="sm" variant="light" color="violet">
            <IconChartBar size={14} />
          </ThemeIcon>
          <Text size="sm" fw={500}>
            Kategori Bazlı Ürün Dağılımı
          </Text>
        </Group>

        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, entry: any) => [
                  `${value} ürün (${entry.payload.guncel} güncel, ${entry.payload.eski} eski)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Kategori verisi bulunamadı
          </Text>
        )}
      </Paper>

      {/* Kategori Bazlı Güncellik Durumu */}
      <Paper p="md" withBorder style={{ gridColumn: 'span 2' }}>
        <Group gap="xs" mb="md">
          <ThemeIcon size="sm" variant="light" color="green">
            <IconChartBar size={14} />
          </ThemeIcon>
          <Text size="sm" fw={500}>
            Kategori Bazlı Fiyat Güncelliği
          </Text>
        </Group>

        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="guncel" name="Güncel" fill="#40c057" stackId="a" />
              <Bar dataKey="eski" name="Eski" fill="#fab005" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Kategori verisi bulunamadı
          </Text>
        )}
      </Paper>
    </SimpleGrid>
  );
}
