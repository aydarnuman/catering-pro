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
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconChartLine,
  IconCoin,
  IconCoinOff,
  IconFileInvoice,
  IconInfoCircle,
  IconPackages,
  IconReceipt,
  IconSearch,
  IconShoppingCart,
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
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type FiyatGecmisiItem,
  faturaKalemleriAPI,
  type PriceHistoryData,
} from '@/lib/api/services/fatura-kalemleri';
import { menuPlanlamaAPI, type UrunKartiFiyat } from '@/lib/api/services/menu-planlama';
import type { SeciliUrunDetayType } from './types';

interface FiyatlarTabProps {
  seciliFiyatUrunId: number | null;
  seciliFiyatUrunAd: string | null;
  onFiyatTrendiSec: (urunId: number, urunAdi: string) => void;
  onClearSelection: () => void;
  onUrunDetayAc: (urun: SeciliUrunDetayType) => void;
  isMobile: boolean;
  isActive: boolean;
}

// Fiyat kaynağı bilgisi
function getFiyatKaynagi(urun: UrunKartiFiyat): {
  label: string;
  color: string;
  icon: typeof IconCoin;
} {
  const tipi = urun.aktif_fiyat_tipi?.toUpperCase();
  if (tipi === 'FATURA') return { label: 'Fatura', color: 'green', icon: IconFileInvoice };
  if (tipi === 'PIYASA') return { label: 'Piyasa', color: 'orange', icon: IconShoppingCart };
  if (tipi === 'MANUEL') return { label: 'Manuel', color: 'blue', icon: IconCoin };
  if (tipi === 'VARSAYILAN') return { label: 'Manuel', color: 'blue', icon: IconCoin };
  if (tipi === 'SOZLESME') return { label: 'Sözleşme', color: 'cyan', icon: IconReceipt };
  if (urun.aktif_fiyat && Number(urun.aktif_fiyat) > 0)
    return { label: 'Varsayılan', color: 'grape', icon: IconCoin };
  if (urun.piyasa_fiyati && Number(urun.piyasa_fiyati) > 0)
    return { label: 'Piyasa', color: 'orange', icon: IconShoppingCart };
  if (urun.son_alis_fiyati && Number(urun.son_alis_fiyati) > 0)
    return { label: 'Fatura', color: 'green', icon: IconFileInvoice };
  if (urun.manuel_fiyat && Number(urun.manuel_fiyat) > 0)
    return { label: 'Manuel', color: 'blue', icon: IconCoin };
  return { label: 'Fiyat Yok', color: 'red', icon: IconCoinOff };
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
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('6m');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [fiyatArama, setFiyatArama] = useState('');
  const [debouncedFiyatArama] = useDebouncedValue(fiyatArama, 300);
  const [seciliKategori, setSeciliKategori] = useState<string>('tumu');
  const [siralama, setSiralama] = useState<'ad' | 'fiyat-azalan' | 'fiyat-artan'>('ad');

  // ── Ürün kartları (fiyatlarıyla birlikte) ──────────────────
  const {
    data: urunKartlari = [],
    isLoading,
    error: urunlerError,
  } = useQuery<UrunKartiFiyat[]>({
    queryKey: ['urun-kartlari-fiyatlar'],
    queryFn: async (): Promise<UrunKartiFiyat[]> => {
      const res = await menuPlanlamaAPI.getUrunKartlari({ aktif: 'true' });
      if (!res.success || !Array.isArray(res.data)) return [];
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: isActive,
    retry: 2,
  });

  useEffect(() => {
    if (urunlerError) {
      notifications.show({
        title: 'Hata',
        message: 'Ürün fiyatları yüklenemedi',
        color: 'red',
      });
    }
  }, [urunlerError]);

  // ── Fiyat trendi grafiği ────────────
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

  useEffect(() => {
    if (trendError) {
      notifications.show({ title: 'Hata', message: 'Fiyat trendi yüklenemedi', color: 'red' });
    }
  }, [trendError]);

  // ── Memoized türetilmiş veriler ────────────────────────────
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

  // Kategoriler
  const kategoriler = useMemo(() => {
    const katMap = new Map<string, { ad: string; sayi: number }>();
    for (const u of urunKartlari) {
      const katAd = u.kategori_adi || 'Diğer';
      const mevcut = katMap.get(katAd) || { ad: katAd, sayi: 0 };
      mevcut.sayi += 1;
      katMap.set(katAd, mevcut);
    }
    return Array.from(katMap.values()).sort((a, b) => b.sayi - a.sayi);
  }, [urunKartlari]);

  // Filtrelenmiş ürünler
  const filtrelenmisUrunler = useMemo(() => {
    let sonuc = [...urunKartlari];
    if (seciliKategori !== 'tumu') {
      sonuc = sonuc.filter((u) => (u.kategori_adi || 'Diğer') === seciliKategori);
    }
    if (debouncedFiyatArama) {
      const ara = debouncedFiyatArama.toLowerCase();
      sonuc = sonuc.filter(
        (u) =>
          u.ad.toLowerCase().includes(ara) ||
          (u.kod || '').toLowerCase().includes(ara) ||
          (u.kategori_adi || '').toLowerCase().includes(ara)
      );
    }
    sonuc.sort((a, b) => {
      if (siralama === 'fiyat-azalan') {
        return (Number(b.guncel_fiyat) || 0) - (Number(a.guncel_fiyat) || 0);
      }
      if (siralama === 'fiyat-artan') {
        return (Number(a.guncel_fiyat) || 0) - (Number(b.guncel_fiyat) || 0);
      }
      return a.ad.localeCompare(b.ad, 'tr');
    });
    return sonuc;
  }, [urunKartlari, seciliKategori, debouncedFiyatArama, siralama]);

  // Genel istatistikler
  const genelIstatistikler = useMemo(() => {
    const toplam = urunKartlari.length;
    const fiyatli = urunKartlari.filter((u) => Number(u.guncel_fiyat) > 0).length;
    const fiyatsiz = toplam - fiyatli;
    const piyasali = urunKartlari.filter((u) => u.piyasa_fiyati).length;
    const yuzde = toplam > 0 ? Math.round((fiyatli / toplam) * 100) : 0;
    return { toplam, fiyatli, fiyatsiz, piyasali, yuzde };
  }, [urunKartlari]);

  return (
    <Stack gap="md">
      {/* ── Özet İstatistikler ─────────────────────────── */}
      {!isLoading && !urunlerError && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Box
            p="sm"
            style={{
              borderRadius: 'var(--mantine-radius-md)',
              background: 'var(--mantine-color-dark-6)',
            }}
          >
            <Text size="xs" c="dimmed" fw={500}>
              Toplam Ürün
            </Text>
            <Text size="xl" fw={700} mt={2}>
              {genelIstatistikler.toplam}
            </Text>
          </Box>
          <Box
            p="sm"
            style={{
              borderRadius: 'var(--mantine-radius-md)',
              background: 'var(--mantine-color-dark-6)',
            }}
          >
            <Text size="xs" c="dimmed" fw={500}>
              Fiyatı Var
            </Text>
            <Group gap={6} align="baseline" mt={2}>
              <Text size="xl" fw={700} c="green">
                {genelIstatistikler.fiyatli}
              </Text>
              <Text size="xs" c="dimmed">
                %{genelIstatistikler.yuzde}
              </Text>
            </Group>
          </Box>
          <Box
            p="sm"
            style={{
              borderRadius: 'var(--mantine-radius-md)',
              background: 'var(--mantine-color-dark-6)',
            }}
          >
            <Text size="xs" c="dimmed" fw={500}>
              Fiyatı Yok
            </Text>
            <Text size="xl" fw={700} c="red" mt={2}>
              {genelIstatistikler.fiyatsiz}
            </Text>
          </Box>
          <Box
            p="sm"
            style={{
              borderRadius: 'var(--mantine-radius-md)',
              background: 'var(--mantine-color-dark-6)',
            }}
          >
            <Text size="xs" c="dimmed" fw={500}>
              Piyasa Verisi
            </Text>
            <Text size="xl" fw={700} c="grape" mt={2}>
              {genelIstatistikler.piyasali}
            </Text>
          </Box>
        </SimpleGrid>
      )}

      {/* ── Fiyat Trendi Grafiği ─────────────────────────── */}
      {seciliFiyatUrunAd && (
        <Box
          p="md"
          style={{
            borderRadius: 'var(--mantine-radius-lg)',
            background: 'var(--mantine-color-dark-6)',
          }}
        >
          <Group justify="space-between" mb="md" wrap="wrap">
            <Group gap="sm">
              <Text fw={600} size="sm">
                {seciliFiyatUrunAd}
              </Text>
              {fiyatIstatistikleri && (
                <Badge
                  size="sm"
                  variant="light"
                  color={fiyatIstatistikleri.changePercent > 0 ? 'red' : 'green'}
                  leftSection={
                    fiyatIstatistikleri.changePercent > 0 ? (
                      <IconTrendingUp size={12} />
                    ) : (
                      <IconTrendingDown size={12} />
                    )
                  }
                >
                  {fiyatIstatistikleri.changePercent > 0 ? '+' : ''}
                  {fiyatIstatistikleri.changePercent.toFixed(1)}%
                </Badge>
              )}
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
                styles={{
                  root: { background: 'var(--mantine-color-dark-7)' },
                }}
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
                styles={{
                  root: { background: 'var(--mantine-color-dark-7)' },
                }}
              />
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClearSelection}>
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Group>

          {fiyatIstatistikleri && (
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="md">
              {[
                { label: 'Ortalama', value: fiyatIstatistikleri.avgPrice, color: 'dimmed' },
                { label: 'Minimum', value: fiyatIstatistikleri.minPrice, color: 'green' },
                { label: 'Maksimum', value: fiyatIstatistikleri.maxPrice, color: 'red' },
                {
                  label: 'Son Fiyat',
                  value: fiyatTrendi[fiyatTrendi.length - 1]?.avg_price || 0,
                  color: 'grape',
                },
              ].map((stat) => (
                <Box
                  key={stat.label}
                  p="xs"
                  style={{
                    borderRadius: 'var(--mantine-radius-sm)',
                    background: 'var(--mantine-color-dark-7)',
                  }}
                >
                  <Text size="xs" c="dimmed">
                    {stat.label}
                  </Text>
                  <Text fw={600} size="sm" c={stat.color}>
                    ₺{stat.value.toFixed(2)}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          )}

          {trendLoading ? (
            <Skeleton height={isMobile ? 200 : 280} radius="md" />
          ) : trendError ? (
            <Alert color="red" title="Hata" icon={<IconAlertCircle />}>
              Fiyat trendi yüklenemedi
            </Alert>
          ) : chartData.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
                  <IconChartLine size={24} />
                </ThemeIcon>
                <Text c="dimmed" ta="center" size="sm">
                  Fiyat geçmişi bulunmuyor
                </Text>
              </Stack>
            </Center>
          ) : (
            <Box h={isMobile ? 200 : 280}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: 'var(--mantine-color-dimmed)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        try {
                          return format(parseISO(val), 'MMM', { locale: tr });
                        } catch {
                          return val;
                        }
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--mantine-color-dimmed)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const data = payload[0].payload as PriceHistoryData & {
                            monthLabel: string;
                          };
                          return (
                            <Paper p="xs" shadow="md" withBorder radius="sm">
                              <Text fw={600} size="xs">
                                {data.monthLabel}
                              </Text>
                              <Text size="xs" c="grape">
                                ₺{data.avg_price.toFixed(2)}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {data.transaction_count} işlem
                              </Text>
                            </Paper>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_price"
                      stroke="var(--mantine-color-grape-5)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--mantine-color-grape-5)' }}
                    />
                  </LineChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: 'var(--mantine-color-dimmed)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        try {
                          return format(parseISO(val), 'MMM', { locale: tr });
                        } catch {
                          return val;
                        }
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--mantine-color-dimmed)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const data = payload[0].payload as PriceHistoryData & {
                            monthLabel: string;
                          };
                          return (
                            <Paper p="xs" shadow="md" withBorder radius="sm">
                              <Text fw={600} size="xs">
                                {data.monthLabel}
                              </Text>
                              <Text size="xs" c="grape">
                                ₺{data.avg_price.toFixed(2)}
                              </Text>
                            </Paper>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="avg_price"
                      fill="var(--mantine-color-grape-5)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  <AreaChart data={chartData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: 'var(--mantine-color-dimmed)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        try {
                          return format(parseISO(val), 'MMM', { locale: tr });
                        } catch {
                          return val;
                        }
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--mantine-color-dimmed)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const data = payload[0].payload as PriceHistoryData & {
                            monthLabel: string;
                          };
                          return (
                            <Paper p="xs" shadow="md" withBorder radius="sm">
                              <Text fw={600} size="xs">
                                {data.monthLabel}
                              </Text>
                              <Text size="xs" c="grape">
                                ₺{data.avg_price.toFixed(2)}
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
                      stroke="var(--mantine-color-grape-5)"
                      fill="rgba(145, 71, 255, 0.15)"
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </Box>
          )}
        </Box>
      )}

      {/* ── Ürün Listesi ──────────────────────────────────── */}
      <Box>
        {/* Kontroller */}
        <Group justify="space-between" mb="md" wrap="wrap">
          <Text fw={500} size="md" c="dimmed">
            Ürün Fiyatları
          </Text>
          <Text size="xs" c="dimmed">
            {filtrelenmisUrunler.length} / {urunKartlari.length}
          </Text>
        </Group>

        {/* Arama */}
        <TextInput
          placeholder="Ara..."
          leftSection={<IconSearch size={14} stroke={1.5} />}
          value={fiyatArama}
          onChange={(e) => setFiyatArama(e.currentTarget.value)}
          mb="md"
          size="sm"
          radius="md"
          styles={{
            input: {
              background: 'var(--mantine-color-dark-6)',
              border: 'none',
            },
          }}
          rightSection={
            fiyatArama ? (
              <ActionIcon size="xs" variant="subtle" onClick={() => setFiyatArama('')}>
                <IconX size={12} />
              </ActionIcon>
            ) : null
          }
        />

        {/* Kategori pills - minimal */}
        <ScrollArea scrollbarSize={0} offsetScrollbars={false} mb="md">
          <Group gap={8} wrap="nowrap">
            <UnstyledButton
              onClick={() => setSeciliKategori('tumu')}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                background:
                  seciliKategori === 'tumu' ? 'var(--mantine-color-dark-4)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <Text
                size="xs"
                fw={seciliKategori === 'tumu' ? 500 : 400}
                c={seciliKategori === 'tumu' ? 'white' : 'dimmed'}
              >
                Tümü
              </Text>
            </UnstyledButton>
            {kategoriler.slice(0, 12).map((kat) => {
              const isKatActive = seciliKategori === kat.ad;
              return (
                <UnstyledButton
                  key={kat.ad}
                  onClick={() => setSeciliKategori(isKatActive ? 'tumu' : kat.ad)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    background: isKatActive ? 'var(--mantine-color-dark-4)' : 'transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Text size="xs" fw={isKatActive ? 500 : 400} c={isKatActive ? 'white' : 'dimmed'}>
                    {kat.ad}
                  </Text>
                </UnstyledButton>
              );
            })}
          </Group>
        </ScrollArea>

        {/* Sıralama - minimal */}
        <SegmentedControl
          size="xs"
          value={siralama}
          onChange={(val) => setSiralama(val as typeof siralama)}
          data={[
            { label: 'A-Z', value: 'ad' },
            { label: 'Fiyat ↓', value: 'fiyat-azalan' },
            { label: 'Fiyat ↑', value: 'fiyat-artan' },
          ]}
          mb="md"
          styles={{
            root: { background: 'var(--mantine-color-dark-6)' },
          }}
        />

        {/* Ürün listesi */}
        {isLoading ? (
          <Stack gap="xs">
            {[1, 2, 3, 4, 5].map((n) => (
              <Skeleton key={`skel-${n}`} height={56} radius="md" />
            ))}
          </Stack>
        ) : urunlerError ? (
          <Alert color="red" title="Hata" icon={<IconAlertCircle />}>
            Ürün fiyatları yüklenemedi
          </Alert>
        ) : (
          <ScrollArea h={isMobile ? 400 : 480} offsetScrollbars>
            <Stack gap={2}>
              {filtrelenmisUrunler.map((urun) => {
                const isSelected = seciliFiyatUrunId === urun.id;
                const fiyat = Number(urun.guncel_fiyat) || 0;
                const piyasaFiyat = Number(urun.piyasa_fiyati) || 0;
                const rawBirim = (urun.varsayilan_birim || 'adet').toLowerCase();
                const birim = ['lt', 'litre', 'l'].includes(rawBirim)
                  ? 'L'
                  : ['kg', 'kilo'].includes(rawBirim)
                    ? 'kg'
                    : ['adet', 'ad'].includes(rawBirim)
                      ? 'adet'
                      : rawBirim;
                const kaynak = getFiyatKaynagi(urun);
                const receteSayisi = Number(urun.recete_sayisi) || 0;

                return (
                  <UnstyledButton
                    key={urun.id}
                    onClick={() => onFiyatTrendiSec(urun.id, urun.ad)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 'var(--mantine-radius-md)',
                      background: isSelected ? 'var(--mantine-color-dark-5)' : 'transparent',
                      borderLeft: isSelected
                        ? '3px solid var(--mantine-color-grape-5)'
                        : '3px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'var(--mantine-color-dark-6)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {/* Kategori ikonu */}
                    <ThemeIcon
                      size="sm"
                      variant="light"
                      color="gray"
                      radius="xl"
                      style={{ flexShrink: 0 }}
                    >
                      <IconPackages size={12} />
                    </ThemeIcon>

                    {/* Ürün bilgisi */}
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {urun.ad}
                      </Text>
                      <Group gap={6} mt={2}>
                        <Text size="xs" c="dimmed">
                          {urun.kategori_adi || 'Genel'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          ·
                        </Text>
                        <Text size="xs" c={kaynak.color}>
                          {kaynak.label}
                        </Text>
                        {receteSayisi > 0 && (
                          <>
                            <Text size="xs" c="dimmed">
                              ·
                            </Text>
                            <Text size="xs" c="dimmed">
                              {receteSayisi} reçete
                            </Text>
                          </>
                        )}
                      </Group>
                    </Box>

                    {/* Fiyat */}
                    <Box ta="right" style={{ flexShrink: 0, minWidth: 80 }}>
                      {fiyat > 0 ? (
                        <>
                          <Text size="sm" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
                            ₺{fiyat.toFixed(2)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            /{birim}
                          </Text>
                        </>
                      ) : (
                        <Text size="xs" c="red.5" fw={500}>
                          Fiyat yok
                        </Text>
                      )}
                      {piyasaFiyat > 0 && fiyat > 0 && (
                        <Text size="xs" c={piyasaFiyat > fiyat ? 'green' : 'orange'}>
                          {piyasaFiyat > fiyat ? '↓' : '↑'} ₺{piyasaFiyat.toFixed(2)}
                        </Text>
                      )}
                    </Box>

                    {/* Detay butonu - div olarak render (UnstyledButton icinde button olamaz) */}
                    <Box
                      component="div"
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUrunDetayAc({
                          product_name: urun.ad,
                          category: urun.kategori_adi,
                          urun_id: urun.id,
                          avg_unit_price: fiyat,
                          min_unit_price: fiyat,
                          max_unit_price: fiyat,
                          total_amount: 0,
                          total_quantity: 0,
                          invoice_count: 0,
                          clean_product_name: urun.ad,
                          standard_unit: birim,
                          price_per_unit: fiyat,
                          aktif_fiyat_tipi: urun.aktif_fiyat_tipi,
                          manuel_fiyat: urun.manuel_fiyat,
                          son_alis_fiyati: urun.son_alis_fiyati,
                          urun_ad: urun.ad,
                          urun_kod: urun.kod || '',
                          kategori_id: urun.kategori_id,
                          kategori_ad: urun.kategori_adi,
                          ortalama_fiyat: fiyat,
                          min_fiyat: fiyat,
                          max_fiyat: fiyat,
                          son_fiyat: fiyat || null,
                          son_alis_tarihi: null,
                          toplam_harcama: 0,
                          fatura_kalem_sayisi: 0,
                          toplam_alinan_miktar: 0,
                        } as unknown as SeciliUrunDetayType);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: 'var(--mantine-radius-sm)',
                        cursor: 'pointer',
                        color: 'var(--mantine-color-gray-5)',
                        flexShrink: 0,
                      }}
                    >
                      <IconInfoCircle size={15} />
                    </Box>
                  </UnstyledButton>
                );
              })}

              {filtrelenmisUrunler.length === 0 && (
                <Center py="xl">
                  <Stack align="center" gap="sm">
                    <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
                      <IconPackages size={24} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed" ta="center">
                      {debouncedFiyatArama
                        ? 'Arama sonucu bulunamadı'
                        : seciliKategori !== 'tumu'
                          ? 'Bu kategoride ürün yok'
                          : 'Henüz ürün kartı oluşturulmamış'}
                    </Text>
                  </Stack>
                </Center>
              )}
            </Stack>
          </ScrollArea>
        )}
      </Box>
    </Stack>
  );
}
