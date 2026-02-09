'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Center,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconChartLine,
  IconInfoCircle,
  IconPackages,
  IconSearch,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type FiyatGecmisiItem,
  faturaKalemleriAPI,
  type MaliyetOzetItem,
  type PriceHistoryData,
} from '@/lib/api/services/fatura-kalemleri';
import type { FiyatListeUrun, SeciliUrunDetayType } from './types';
import { getCategoryColor } from './utils';

interface FiyatlarTabProps {
  seciliFiyatUrunId: number | null;
  seciliFiyatUrunAd: string | null;
  onFiyatTrendiSec: (urunId: number, urunAdi: string) => void;
  onClearSelection: () => void;
  onUrunDetayAc: (urun: SeciliUrunDetayType) => void;
  isMobile: boolean;
  isActive: boolean;
}

export function FiyatlarTab({
  seciliFiyatUrunId,
  seciliFiyatUrunAd,
  onFiyatTrendiSec,
  onClearSelection,
  onUrunDetayAc,
  isMobile,
  isActive,
}: FiyatlarTabProps) {
  // Local state
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('6m');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [fiyatArama, setFiyatArama] = useState('');
  const [debouncedFiyatArama] = useDebouncedValue(fiyatArama, 300);
  const [sadecegida, setSadeceGida] = useState<boolean>(true);

  // React Query: Maliyet özeti – Single Source (fatura_kalemleri)
  const {
    data: topUrunler = [],
    isLoading: fiyatLoading,
    error: topUrunlerError,
  } = useQuery<FiyatListeUrun[]>({
    queryKey: ['maliyet-ozet', 'fiyatlar'],
    queryFn: async (): Promise<FiyatListeUrun[]> => {
      const res = await faturaKalemleriAPI.getMaliyetOzet();
      if (!res.success || !Array.isArray(res.data)) return [];
      return (res.data as MaliyetOzetItem[]).map((m) => ({
        ...m,
        product_name: m.urun_ad,
        category: m.kategori_ad ?? 'Genel',
        urun_id: m.urun_id,
        avg_unit_price: Number(m.ortalama_fiyat) || 0,
        min_unit_price: Number(m.min_fiyat) || 0,
        max_unit_price: Number(m.max_fiyat) || 0,
        total_amount: Number(m.toplam_harcama) || 0,
        invoice_count: Number(m.fatura_kalem_sayisi) || 0,
        total_quantity: Number(m.toplam_alinan_miktar) || 0,
        is_food: true,
        clean_product_name: m.urun_ad,
        standard_unit: 'ADET',
        price_per_unit: Number(m.ortalama_fiyat) || 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: isActive,
    retry: 2,
  });

  // Error handling for top ürünler
  useEffect(() => {
    if (topUrunlerError) {
      notifications.show({
        title: 'Hata',
        message: 'En çok alınan ürünler yüklenemedi',
        color: 'red',
      });
    }
  }, [topUrunlerError]);

  // React Query: Fiyat trendi – Single Source (fatura_kalemleri, urunId ile)
  const {
    data: fiyatTrendi = [],
    isLoading: trendLoading,
    error: trendError,
  } = useQuery<PriceHistoryData[]>({
    queryKey: ['fiyat-gecmisi', seciliFiyatUrunId, timeRange],
    queryFn: async (): Promise<PriceHistoryData[]> => {
      if (seciliFiyatUrunId == null) return [];
      const rows = (await faturaKalemleriAPI.getFiyatGecmisi(
        String(seciliFiyatUrunId),
        500
      )) as FiyatGecmisiItem[];
      if (rows.length === 0) return [];
      // Aylık grupla (PriceHistoryData formatına dönüştür)
      const byMonth = new Map<string, { sum: number; cnt: number; qty: number; amount: number }>();
      for (const r of rows) {
        const d = r.fatura_tarihi ? format(parseISO(r.fatura_tarihi), 'yyyy-MM') : '';
        if (!d) continue;
        const cur = byMonth.get(d) || { sum: 0, cnt: 0, qty: 0, amount: 0 };
        cur.sum += Number(r.birim_fiyat) || 0;
        cur.cnt += 1;
        cur.qty += Number(r.miktar) || 0;
        cur.amount += Number(r.tutar) || 0;
        byMonth.set(d, cur);
      }
      const sorted = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      return sorted.map(([month, v]) => ({
        month: `${month}-01`,
        avg_price: v.cnt ? v.sum / v.cnt : 0,
        transaction_count: v.cnt,
        total_quantity: v.qty,
        total_amount: v.amount,
        min_price: v.cnt ? v.sum / v.cnt : 0,
        max_price: v.cnt ? v.sum / v.cnt : 0,
        change_percent: 0,
        trend: 'stable' as const,
      }));
    },
    enabled: seciliFiyatUrunId != null,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  // Error handling for fiyat trendi
  useEffect(() => {
    if (trendError) {
      notifications.show({
        title: 'Hata',
        message: 'Fiyat trendi yüklenemedi',
        color: 'red',
      });
    }
  }, [trendError]);

  // Fiyat trendi için formatlanmış data (memoized)
  const chartData = useMemo(() => {
    return fiyatTrendi.map((item) => {
      try {
        const monthDate = parseISO(item.month);
        return {
          ...item,
          month: format(monthDate, 'yyyy-MM', { locale: tr }),
          monthLabel: format(monthDate, 'MMM yyyy', { locale: tr }),
        };
      } catch {
        return {
          ...item,
          month: typeof item.month === 'string' ? item.month.slice(0, 7) : item.month,
          monthLabel: typeof item.month === 'string' ? item.month.slice(0, 7) : String(item.month),
        };
      }
    });
  }, [fiyatTrendi]);

  // Fiyat trendi istatistikleri (memoized)
  const fiyatIstatistikleri = useMemo(() => {
    if (fiyatTrendi.length === 0) return null;

    const prices = fiyatTrendi.map((d) => d.avg_price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const firstPrice = fiyatTrendi[0]?.avg_price || 0;
    const lastPrice = fiyatTrendi[fiyatTrendi.length - 1]?.avg_price || 0;
    const changePercent = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    return {
      avgPrice,
      minPrice,
      maxPrice,
      changePercent,
      trend:
        changePercent > 0 ? 'increasing' : changePercent < 0 ? 'decreasing' : ('stable' as const),
    };
  }, [fiyatTrendi]);

  return (
    <Stack gap="md">
      {/* Fiyat Trendi Grafiği - Geliştirilmiş */}
      {seciliFiyatUrunAd && (
        <Paper p="md" withBorder radius="lg">
          <Group justify="space-between" mb="md" wrap="wrap">
            <Group gap="sm">
              <Text fw={600} size="sm">
                📈 {seciliFiyatUrunAd} - Fiyat Trendi
              </Text>
            </Group>
            <Group gap="xs">
              <SegmentedControl
                size="xs"
                value={timeRange}
                onChange={(value) => setTimeRange(value as typeof timeRange)}
                data={[
                  { label: '3 Ay', value: '3m' },
                  { label: '6 Ay', value: '6m' },
                  { label: '1 Yıl', value: '1y' },
                  { label: 'Tümü', value: 'all' },
                ]}
              />
              <SegmentedControl
                size="xs"
                value={chartType}
                onChange={(value) => setChartType(value as typeof chartType)}
                data={[
                  { label: 'Çizgi', value: 'line' },
                  { label: 'Sütun', value: 'bar' },
                  { label: 'Alan', value: 'area' },
                ]}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={onClearSelection}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Group>

          {/* İstatistikler Kartı */}
          {fiyatIstatistikleri && (
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="md">
              <Paper p="sm" withBorder radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Ortalama
                </Text>
                <Text fw={600} size="sm">
                  ₺{fiyatIstatistikleri.avgPrice.toFixed(2)}
                </Text>
              </Paper>
              <Paper p="sm" withBorder radius="md" ta="center" bg="green.0">
                <Text size="xs" c="dimmed">
                  Min
                </Text>
                <Text fw={600} size="sm" c="green">
                  ₺{fiyatIstatistikleri.minPrice.toFixed(2)}
                </Text>
              </Paper>
              <Paper p="sm" withBorder radius="md" ta="center" bg="red.0">
                <Text size="xs" c="dimmed">
                  Max
                </Text>
                <Text fw={600} size="sm" c="red">
                  ₺{fiyatIstatistikleri.maxPrice.toFixed(2)}
                </Text>
              </Paper>
              <Paper
                p="sm"
                withBorder
                radius="md"
                ta="center"
                bg={fiyatIstatistikleri.changePercent > 0 ? 'red.0' : 'green.0'}
              >
                <Text size="xs" c="dimmed">
                  Değişim
                </Text>
                <Group gap={4} justify="center">
                  {fiyatIstatistikleri.trend === 'increasing' ? (
                    <IconTrendingUp size={14} color="var(--mantine-color-red-6)" />
                  ) : (
                    <IconTrendingDown
                      size={14}
                      color="var(--mantine-color-green-6)"
                    />
                  )}
                  <Text
                    fw={600}
                    size="sm"
                    c={fiyatIstatistikleri.changePercent > 0 ? 'red' : 'green'}
                  >
                    {fiyatIstatistikleri.changePercent > 0 ? '+' : ''}
                    {fiyatIstatistikleri.changePercent.toFixed(1)}%
                  </Text>
                </Group>
              </Paper>
            </SimpleGrid>
          )}

          {/* Grafik */}
          {trendLoading ? (
            <Skeleton height={isMobile ? 200 : 300} radius="md" />
          ) : trendError ? (
            <Alert color="red" title="Hata" icon={<IconAlertCircle />}>
              Fiyat trendi yüklenemedi:{' '}
              {trendError instanceof Error ? trendError.message : 'Bilinmeyen hata'}
            </Alert>
          ) : chartData.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconChartLine size={48} color="var(--mantine-color-gray-5)" />
                <Text c="dimmed" ta="center">
                  Bu ürün için henüz fiyat geçmişi bulunmuyor
                </Text>
              </Stack>
            </Center>
          ) : (
            <Box h={isMobile ? 200 : 300}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val) => {
                        try {
                          return format(parseISO(val), 'MMM', { locale: tr });
                        } catch {
                          return val;
                        }
                      }}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as PriceHistoryData & {
                            monthLabel: string;
                          };
                          return (
                            <Paper p="sm" shadow="md" withBorder>
                              <Text fw={600} mb="xs">
                                {data.monthLabel}
                              </Text>
                              <Stack gap={4}>
                                <Group justify="space-between" gap="xl">
                                  <Text size="xs">Ortalama:</Text>
                                  <Text size="xs" fw={600}>
                                    ₺{data.avg_price.toFixed(2)}
                                  </Text>
                                </Group>
                                <Group justify="space-between" gap="xl">
                                  <Text size="xs">Min:</Text>
                                  <Text size="xs" c="green">
                                    ₺{(data.min_price ?? 0).toFixed(2)}
                                  </Text>
                                </Group>
                                <Group justify="space-between" gap="xl">
                                  <Text size="xs">Max:</Text>
                                  <Text size="xs" c="red">
                                    ₺{(data.max_price ?? 0).toFixed(2)}
                                  </Text>
                                </Group>
                                <Group justify="space-between" gap="xl">
                                  <Text size="xs">İşlem:</Text>
                                  <Text size="xs">{data.transaction_count} adet</Text>
                                </Group>
                              </Stack>
                            </Paper>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_price"
                      stroke="var(--mantine-color-grape-6)"
                      strokeWidth={2}
                      dot={{ fill: 'var(--mantine-color-grape-6)', r: 4 }}
                      name="Ortalama"
                    />
                    <Line
                      type="monotone"
                      dataKey="min_price"
                      stroke="var(--mantine-color-green-6)"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Min"
                    />
                    <Line
                      type="monotone"
                      dataKey="max_price"
                      stroke="var(--mantine-color-red-6)"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Max"
                    />
                    <Legend />
                  </LineChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val) => {
                        try {
                          return format(parseISO(val), 'MMM', { locale: tr });
                        } catch {
                          return val;
                        }
                      }}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as PriceHistoryData & {
                            monthLabel: string;
                          };
                          return (
                            <Paper p="sm" shadow="md" withBorder>
                              <Text fw={600} mb="xs">
                                {data.monthLabel}
                              </Text>
                              <Text size="xs">
                                Ortalama: ₺{data.avg_price.toFixed(2)}
                              </Text>
                            </Paper>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="avg_price"
                      fill="var(--mantine-color-grape-6)"
                      name="Ortalama Fiyat"
                    />
                  </BarChart>
                ) : (
                  <AreaChart data={chartData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val) => {
                        try {
                          return format(parseISO(val), 'MMM', { locale: tr });
                        } catch {
                          return val;
                        }
                      }}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as PriceHistoryData & {
                            monthLabel: string;
                          };
                          return (
                            <Paper p="sm" shadow="md" withBorder>
                              <Text fw={600} mb="xs">
                                {data.monthLabel}
                              </Text>
                              <Text size="xs">
                                Ortalama: ₺{data.avg_price.toFixed(2)}
                              </Text>
                            </Paper>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avg_price"
                      stroke="var(--mantine-color-grape-6)"
                      fill="var(--mantine-color-grape-1)"
                      name="Ortalama Fiyat"
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      )}

      {/* Top Ürünler - Geliştirilmiş */}
      <Paper p="md" withBorder radius="lg">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={600} size="sm">
              📦 Ürün Fiyatları (Son 3 Ay)
            </Text>
            {topUrunlerError && (
              <Badge color="red" variant="light" size="sm">
                Hata
              </Badge>
            )}
          </Group>

          {/* Arama Kutusu */}
          <TextInput
            placeholder="Ürün ara..."
            leftSection={<IconSearch size={16} />}
            value={fiyatArama}
            onChange={(e) => setFiyatArama(e.currentTarget.value)}
            size="sm"
          />

          {/* Gıda/Tümü Toggle ve Sonuç Sayısı */}
          {!fiyatLoading && !topUrunlerError && (
            <Stack gap="xs">
              <SegmentedControl
                size="xs"
                value={sadecegida ? 'gida' : 'tumu'}
                onChange={(value) => setSadeceGida(value === 'gida')}
                data={[
                  { label: '🍎 Gıda', value: 'gida' },
                  { label: '📦 Tümü', value: 'tumu' },
                ]}
              />
              <Group justify="space-between" wrap="wrap">
                <Text size="xs" c="dimmed">
                  {(() => {
                    const filtered = topUrunler.filter((u) => {
                      if (sadecegida && u.is_food === false) return false;
                      if (!debouncedFiyatArama) return true;
                      const searchLower = debouncedFiyatArama.toLowerCase();
                      const productName = (
                        u.clean_product_name || u.product_name
                      ).toLowerCase();
                      const category = (u.category || '').toLowerCase();
                      return (
                        productName.includes(searchLower) ||
                        category.includes(searchLower)
                      );
                    });
                    const gidaSayisi = topUrunler.filter(
                      (u) => u.is_food !== false
                    ).length;
                    const gidaDisSayisi = topUrunler.filter(
                      (u) => u.is_food === false
                    ).length;
                    return `${filtered.length} ürün gösteriliyor (${gidaSayisi} gıda, ${gidaDisSayisi} diğer)`;
                  })()}
                </Text>
              </Group>
            </Stack>
          )}
        </Stack>

        {fiyatLoading ? (
          <Stack gap="xs" mt="md">
            <Skeleton height={50} radius="md" />
            <Skeleton height={50} radius="md" />
            <Skeleton height={50} radius="md" />
            <Skeleton height={50} radius="md" />
            <Skeleton height={50} radius="md" />
          </Stack>
        ) : topUrunlerError ? (
          <Alert color="red" title="Hata" icon={<IconAlertCircle />} mt="md">
            Ürün fiyatları yüklenemedi
          </Alert>
        ) : (
          <ScrollArea h={400} mt="md">
            <Stack gap="xs">
              {topUrunler
                .filter((urun) => {
                  if (sadecegida && urun.is_food === false) return false;
                  if (!debouncedFiyatArama) return true;
                  const searchLower = debouncedFiyatArama.toLowerCase();
                  const productName = (
                    urun.clean_product_name || urun.product_name
                  ).toLowerCase();
                  const category = (urun.category || '').toLowerCase();
                  return (
                    productName.includes(searchLower) ||
                    category.includes(searchLower)
                  );
                })
                .map((urun, index) => {
                  const isSelected = seciliFiyatUrunId === urun.urun_id;
                  const displayName = urun.clean_product_name || urun.product_name;
                  const standardUnit = urun.standard_unit || 'ADET';
                  const pricePerUnit =
                    urun.price_per_unit || urun.avg_unit_price || 0;
                  const categoryColor = getCategoryColor(urun.category ?? undefined);

                  return (
                    <Paper
                      key={`${urun.product_name}-${index}`}
                      p="xs"
                      withBorder
                      radius="md"
                      style={{
                        border: `1px solid ${isSelected ? 'var(--mantine-color-grape-5)' : 'var(--mantine-color-default-border)'}`,
                        background: isSelected
                          ? 'var(--mantine-color-grape-light)'
                          : undefined,
                        transition: 'all 0.15s',
                        cursor: 'pointer',
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <UnstyledButton
                          onClick={() =>
                            onFiyatTrendiSec(urun.urun_id, urun.product_name)
                          }
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          <Group
                            gap="xs"
                            wrap="nowrap"
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            <Text
                              size="xs"
                              c="dimmed"
                              fw={500}
                              style={{ minWidth: 20 }}
                            >
                              {index + 1}.
                            </Text>
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" fw={500} lineClamp={1}>
                                {displayName}
                              </Text>
                              <Group gap={8} mt={2}>
                                <Text size="xs" c={categoryColor}>
                                  {urun.category || 'Genel'}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  |
                                </Text>
                                <Text size="xs" fw={600} c="grape">
                                  ₺{pricePerUnit.toFixed(2)}/
                                  {standardUnit.toLowerCase()}
                                </Text>
                              </Group>
                            </Box>
                          </Group>
                        </UnstyledButton>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUrunDetayAc(urun);
                          }}
                          title="Detaylı Analiz"
                        >
                          <IconInfoCircle size={16} />
                        </ActionIcon>
                      </Group>
                    </Paper>
                  );
                })}
              {topUrunler.filter((urun) => {
                if (sadecegida && urun.is_food === false) return false;
                if (!debouncedFiyatArama) return true;
                const searchLower = debouncedFiyatArama.toLowerCase();
                const productName = (
                  urun.clean_product_name || urun.product_name
                ).toLowerCase();
                const category = (urun.category || '').toLowerCase();
                return (
                  productName.includes(searchLower) || category.includes(searchLower)
                );
              }).length === 0 && (
                <Center py="xl">
                  <Stack align="center" gap="md">
                    <IconPackages size={40} color="var(--mantine-color-gray-5)" />
                    <Text size="sm" c="dimmed" ta="center">
                      {debouncedFiyatArama
                        ? 'Arama sonucu bulunamadı'
                        : sadecegida
                          ? 'Gıda ürünü bulunamadı'
                          : 'Henüz fatura kalemi yok'}
                    </Text>
                  </Stack>
                </Center>
              )}
            </Stack>
          </ScrollArea>
        )}
      </Paper>
    </Stack>
  );
}
