'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Tooltip as MantineTooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconChartLine,
  IconCheck,
  IconCurrencyLira,
  IconEdit,
  IconFile,
  IconFileSpreadsheet,
  IconRefresh,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  type FiyatGecmisiItem,
  faturaKalemleriAPI,
  type PriceHistoryData,
  type RafFiyatSonuc,
} from '@/lib/api/services/fatura-kalemleri';
import { urunlerAPI } from '@/lib/api/services/urunler';
import { formatDate, formatMoney } from '@/lib/formatters';
import { PiyasaFiyatlariSection } from './PiyasaFiyatlariSection';
import type { SeciliUrunDetayType, SonIslemRow, TedarikciAnalizRow } from './types';
import { calculateUnitPrice } from './utils';

interface UrunDetayModalProps {
  opened: boolean;
  onClose: () => void;
  urun: SeciliUrunDetayType | null;
  isMobile: boolean;
  isMounted: boolean;
  onFiyatTrendiSec: (urunId: number, urunAd: string) => void;
}

export function UrunDetayModal({
  opened,
  onClose,
  urun,
  isMobile,
  isMounted,
  onFiyatTrendiSec,
}: UrunDetayModalProps) {
  const queryClient = useQueryClient();

  // ─── Local State ────────────────────────────────────────────────
  const [manuelFiyat, setManuelFiyat] = useState<number | string>('');
  const [manuelFiyatSaving, setManuelFiyatSaving] = useState(false);
  const [dataValidationErrors, setDataValidationErrors] = useState<string[]>([]);

  // ─── Veri Doğrulama ─────────────────────────────────────────────
  const validateProductData = useCallback((data: SeciliUrunDetayType): string[] => {
    const errors: string[] = [];
    const total = data.total_amount ?? data.toplam_harcama ?? 0;
    const avg = data.avg_unit_price ?? data.ortalama_fiyat ?? 0;
    const qty = data.total_quantity ?? data.toplam_alinan_miktar ?? 0;
    const minP = data.min_unit_price ?? data.min_fiyat;
    const maxP = data.max_unit_price ?? data.max_fiyat;
    const invCnt = data.invoice_count ?? data.fatura_kalem_sayisi ?? 0;
    if (total < 0) errors.push('Toplam tutar negatif olamaz');
    if (avg && qty > 0 && Math.abs(total / qty - avg) > 0.01)
      errors.push('Ortalama fiyat tutarsız');
    if (minP != null && maxP != null && minP > maxP)
      errors.push('Min fiyat max fiyattan büyük olamaz');
    if (qty < 0) errors.push('Toplam miktar negatif olamaz');
    if (invCnt < 0) errors.push('Fatura sayısı negatif olamaz');
    return errors;
  }, []);

  // Modal açıldığında doğrulama yap
  useMemo(() => {
    if (opened && urun) {
      const errors = validateProductData(urun);
      setDataValidationErrors(errors);
      if (errors.length > 0) {
        notifications.show({
          title: 'Veri Uyarısı',
          message: `Veri tutarsızlıkları tespit edildi: ${errors.join(', ')}`,
          color: 'orange',
          autoClose: 5000,
        });
      }
    } else {
      setDataValidationErrors([]);
      setManuelFiyat('');
    }
  }, [opened, urun, validateProductData]);

  // ─── Queries ────────────────────────────────────────────────────

  // Son işlemler
  const { data: sonIslemler = [], isLoading: sonIslemlerLoading } = useQuery<SonIslemRow[]>({
    queryKey: ['fiyat-gecmisi-recent', urun?.urun_id],
    queryFn: async (): Promise<SonIslemRow[]> => {
      const urunId = urun?.urun_id;
      if (urunId == null) return [];
      const rows = (await faturaKalemleriAPI.getFiyatGecmisi(
        String(urunId),
        10
      )) as FiyatGecmisiItem[];
      return rows.map((r, i) => ({
        id: i,
        invoice_date: r.fatura_tarihi ?? undefined,
        supplier_name: r.tedarikci_ad ?? undefined,
        unit_price: r.birim_fiyat,
        quantity: r.miktar,
        line_total: r.tutar,
        description: r.orijinal_urun_adi,
        unit: r.birim ?? undefined,
      }));
    },
    enabled: !!urun?.urun_id && opened,
    staleTime: 2 * 60 * 1000,
  });

  // Tedarikçi analizi
  const { data: tedarikciAnalizi = [], isLoading: tedarikciLoading } = useQuery<
    TedarikciAnalizRow[]
  >({
    queryKey: ['tedarikci-karsilastirma', urun?.urun_id],
    queryFn: async (): Promise<TedarikciAnalizRow[]> => {
      const urunId = urun?.urun_id;
      if (urunId == null) return [];
      const rows = (await faturaKalemleriAPI.getTedarikciKarsilastirma(urunId)) ?? [];
      return (Array.isArray(rows) ? rows : []).map(
        (r: {
          tedarikci_ad?: string;
          ortalama_fiyat?: number;
          fatura_sayisi?: number;
          min_fiyat?: number;
          max_fiyat?: number;
        }) => ({
          supplier_name: r.tedarikci_ad || 'Bilinmeyen',
          invoice_count: Number(r.fatura_sayisi) || 0,
          total_quantity: 0,
          total_amount: Number(r.ortalama_fiyat) || 0,
          avg_unit_price: Number(r.ortalama_fiyat) || 0,
          min_unit_price: Number(r.min_fiyat) || 0,
          max_unit_price: Number(r.max_fiyat) || 0,
        })
      );
    },
    enabled: !!urun?.urun_id && opened,
    staleTime: 5 * 60 * 1000,
  });

  // Mini grafik
  const { data: miniTrendData = [] } = useQuery<PriceHistoryData[]>({
    queryKey: ['fiyat-gecmisi-mini', urun?.urun_id],
    queryFn: async (): Promise<PriceHistoryData[]> => {
      const urunId = urun?.urun_id;
      if (urunId == null) return [];
      const rows = (await faturaKalemleriAPI.getFiyatGecmisi(
        String(urunId),
        100
      )) as FiyatGecmisiItem[];
      const byMonth = new Map<string, { sum: number; cnt: number }>();
      for (const r of rows) {
        const d = r.fatura_tarihi ? format(parseISO(r.fatura_tarihi), 'yyyy-MM') : '';
        if (!d) continue;
        const cur = byMonth.get(d) || { sum: 0, cnt: 0 };
        cur.sum += Number(r.birim_fiyat) || 0;
        cur.cnt += 1;
        byMonth.set(d, cur);
      }
      return Array.from(byMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => ({ month: `${month}-01`, avg_price: v.cnt ? v.sum / v.cnt : 0 }));
    },
    enabled: !!urun?.urun_id && opened,
    staleTime: 2 * 60 * 1000,
  });

  // Raf / Piyasa Fiyatları
  const { data: rafFiyatlar = [], isLoading: rafFiyatLoading } = useQuery<RafFiyatSonuc[]>({
    queryKey: ['raf-fiyat', urun?.urun_id],
    queryFn: async (): Promise<RafFiyatSonuc[]> => {
      const urunId = urun?.urun_id;
      if (!urunId) return [];
      const res = await faturaKalemleriAPI.getRafFiyat(urunId);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!urun?.urun_id && opened,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Memos ──────────────────────────────────────────────────────

  const miniChartData = useMemo(() => {
    return miniTrendData.map((item) => {
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
  }, [miniTrendData]);

  const zamanKarsilastirma = useMemo(() => {
    if (miniTrendData.length < 2) return null;

    const sorted = [...miniTrendData].sort(
      (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()
    );

    const sonAy = sorted[sorted.length - 1];
    const oncekiAy = sorted[sorted.length - 2];

    if (!sonAy || !oncekiAy) return null;

    const fark = sonAy.avg_price - oncekiAy.avg_price;
    const farkYuzde = oncekiAy.avg_price > 0 ? (fark / oncekiAy.avg_price) * 100 : 0;

    return {
      buAy: sonAy.avg_price,
      geçenAy: oncekiAy.avg_price,
      fark,
      farkYuzde,
      trend: fark > 0 ? 'increasing' : fark < 0 ? 'decreasing' : ('stable' as const),
    };
  }, [miniTrendData]);

  // ─── Export Callbacks ───────────────────────────────────────────

  const exportToPDF = useCallback(() => {
    if (!urun) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${urun.product_name} - Fiyat Analizi</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>${urun.product_name} - Detaylı Fiyat Analizi</h1>
            <h2>Özet Bilgiler</h2>
            <table>
              <tr><th>Toplam Tutar</th><td>${formatMoney(urun.total_amount)}</td></tr>
              <tr><th>Ortalama Fiyat</th><td>₺${urun.avg_unit_price?.toFixed(2) || '0'}</td></tr>
              <tr><th>Min Fiyat</th><td>₺${urun.min_unit_price?.toFixed(2) || '0'}</td></tr>
              <tr><th>Max Fiyat</th><td>₺${urun.max_unit_price?.toFixed(2) || '0'}</td></tr>
              <tr><th>Toplam Miktar</th><td>${urun.total_quantity.toFixed(2)}</td></tr>
              <tr><th>Fatura Sayısı</th><td>${urun.invoice_count}</td></tr>
              <tr><th>Kategori</th><td>${urun.category || 'Genel'}</td></tr>
            </table>
            <p>Rapor Tarihi: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: tr })}</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [urun]);

  const exportToExcel = useCallback(() => {
    if (!urun) return;

    const csvData = [
      [
        'Ürün Adı',
        'Toplam Tutar',
        'Ortalama Fiyat',
        'Min Fiyat',
        'Max Fiyat',
        'Toplam Miktar',
        'Fatura Sayısı',
        'Kategori',
      ],
      [
        urun.product_name,
        urun.total_amount.toString(),
        (urun.avg_unit_price || 0).toString(),
        (urun.min_unit_price || 0).toString(),
        (urun.max_unit_price || 0).toString(),
        urun.total_quantity.toString(),
        urun.invoice_count.toString(),
        urun.category || 'Genel',
      ],
    ];

    const csv = csvData.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${urun.product_name.replace(/[^a-z0-9]/gi, '_')}_analiz.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [urun]);

  // ─── Refresh handler ───────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['maliyet-ozet'] });
    queryClient.invalidateQueries({
      queryKey: ['fiyat-gecmisi-recent', urun?.urun_id],
    });
    queryClient.invalidateQueries({
      queryKey: ['tedarikci-karsilastirma', urun?.urun_id],
    });
    queryClient.invalidateQueries({
      queryKey: ['fiyat-gecmisi-mini', urun?.urun_id],
    });
    queryClient.invalidateQueries({
      queryKey: ['raf-fiyat', urun?.urun_id],
    });
  }, [queryClient, urun?.urun_id]);

  // ─── Manuel fiyat kaydetme ──────────────────────────────────────

  const handleManuelFiyatKaydet = useCallback(async () => {
    if (!urun?.urun_id || !manuelFiyat) return;
    setManuelFiyatSaving(true);
    try {
      await urunlerAPI.updateFiyat(urun.urun_id, {
        birim_fiyat: Number(manuelFiyat),
        kaynak: 'manuel',
        aciklama: 'Menü planlama modalından manuel giriş',
      });
      notifications.show({
        title: 'Fiyat Kaydedildi',
        message: `₺${Number(manuelFiyat).toFixed(2)} olarak güncellendi`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
      setManuelFiyat('');
      queryClient.invalidateQueries({ queryKey: ['maliyet-ozet'] });
      queryClient.invalidateQueries({ queryKey: ['raf-fiyat', urun.urun_id] });
    } catch (err) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Fiyat kaydedilemedi',
        color: 'red',
      });
    } finally {
      setManuelFiyatSaving(false);
    }
  }, [urun?.urun_id, manuelFiyat, queryClient]);

  // ─── Render ─────────────────────────────────────────────────────

  const seciliUrunDetay = urun;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group justify="space-between" style={{ flex: 1 }}>
          <Group gap="sm">
            <IconChartLine size={24} color="var(--mantine-color-grape-6)" />
            <Text fw={600}>{seciliUrunDetay?.product_name || 'Ürün Detayı'}</Text>
          </Group>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="blue"
              size="sm"
              onClick={handleRefresh}
              title="Yenile"
            >
              <IconRefresh size={16} />
            </ActionIcon>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconFile size={14} />}
              onClick={exportToPDF}
            >
              PDF
            </Button>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconFileSpreadsheet size={14} />}
              onClick={exportToExcel}
            >
              Excel
            </Button>
          </Group>
        </Group>
      }
      size="xl"
      fullScreen={isMobile && isMounted}
    >
      {seciliUrunDetay && (
        <Stack gap="md">
          {/* Veri Doğrulama Uyarıları */}
          {dataValidationErrors.length > 0 && (
            <Alert color="orange" title="Veri Uyarısı" icon={<IconAlertCircle />}>
              <Stack gap="xs">
                {dataValidationErrors.map((error) => (
                  <Text key={error} size="xs">
                    • {error}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}

          {/* === A. Fiyat Özet Kartı === */}
          {(() => {
            const faturaFiyat =
              seciliUrunDetay.price_per_unit || seciliUrunDetay.avg_unit_price || 0;
            const rafOrt =
              rafFiyatlar.length > 0
                ? rafFiyatlar
                    .map((r) => Number(r.birim_fiyat || r.piyasa_fiyat_ort || 0))
                    .filter((f) => f > 0)
                    .reduce((a, b) => a + b, 0) /
                    rafFiyatlar.filter(
                      (r) => Number(r.birim_fiyat || r.piyasa_fiyat_ort || 0) > 0
                    ).length || 0
                : 0;
            const aktifFiyat = faturaFiyat || rafOrt || 0;
            const kaynak: string =
              faturaFiyat > 0 ? 'Fatura' : rafOrt > 0 ? 'Piyasa Fiyatı' : 'Fiyat Yok';
            const kaynakRenk = faturaFiyat > 0 ? 'blue' : rafOrt > 0 ? 'orange' : 'gray';

            return (
              <Paper
                p="md"
                withBorder
                radius="lg"
                style={{
                  background:
                    aktifFiyat > 0 ? 'var(--mantine-color-dark-6)' : undefined,
                  border:
                    aktifFiyat === 0
                      ? '2px dashed var(--mantine-color-yellow-6)'
                      : undefined,
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  {/* Sol: Aktif fiyat + kaynak */}
                  <Box>
                    <Group gap="xs" mb={4}>
                      <IconCurrencyLira size={16} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">
                        Aktif Fiyat
                      </Text>
                      <Badge size="xs" variant="light" color={kaynakRenk} radius="sm">
                        {kaynak}
                      </Badge>
                    </Group>
                    {aktifFiyat > 0 ? (
                      <Text
                        fw={800}
                        size="xl"
                        c={
                          kaynakRenk === 'blue'
                            ? 'blue.4'
                            : kaynakRenk === 'orange'
                              ? 'orange.4'
                              : 'dimmed'
                        }
                      >
                        ₺{aktifFiyat.toFixed(2)}
                        <Text span size="sm" fw={400} c="dimmed">
                          {' '}
                          /{seciliUrunDetay.standard_unit?.toLowerCase() || 'kg'}
                        </Text>
                      </Text>
                    ) : (
                      <Text fw={700} size="lg" c="yellow.5">
                        Fiyat bilgisi yok
                      </Text>
                    )}
                    {seciliUrunDetay.invoice_count > 0 && (
                      <Text size="xs" c="dimmed" mt={2}>
                        {seciliUrunDetay.invoice_count} fatura kaydından
                      </Text>
                    )}
                  </Box>

                  {/* Sağ: Fiyat karşılaştırma barları */}
                  {(faturaFiyat > 0 || rafOrt > 0) && (
                    <Stack gap={6} miw={140}>
                      {faturaFiyat > 0 && (
                        <Group gap="xs" wrap="nowrap">
                          <Text size="xs" c="dimmed" w={50}>
                            Fatura
                          </Text>
                          <Box
                            style={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              background: 'var(--mantine-color-dark-4)',
                            }}
                          >
                            <Box
                              style={{
                                width: `${Math.min((faturaFiyat / Math.max(faturaFiyat, rafOrt || faturaFiyat)) * 100, 100)}%`,
                                height: '100%',
                                borderRadius: 4,
                                background: 'var(--mantine-color-blue-6)',
                              }}
                            />
                          </Box>
                          <Text size="xs" fw={600} c="blue.4" w={60} ta="right">
                            ₺{faturaFiyat.toFixed(2)}
                          </Text>
                        </Group>
                      )}
                      {rafOrt > 0 && (
                        <Group gap="xs" wrap="nowrap">
                          <Text size="xs" c="dimmed" w={50}>
                            Piyasa
                          </Text>
                          <Box
                            style={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              background: 'var(--mantine-color-dark-4)',
                            }}
                          >
                            <Box
                              style={{
                                width: `${Math.min((rafOrt / Math.max(faturaFiyat || rafOrt, rafOrt)) * 100, 100)}%`,
                                height: '100%',
                                borderRadius: 4,
                                background: 'var(--mantine-color-orange-6)',
                              }}
                            />
                          </Box>
                          <Text size="xs" fw={600} c="orange.4" w={60} ta="right">
                            ₺{rafOrt.toFixed(2)}
                          </Text>
                        </Group>
                      )}
                      {faturaFiyat > 0 && rafOrt > 0 && (
                        <Text
                          size="xs"
                          ta="right"
                          c={faturaFiyat <= rafOrt ? 'green' : 'red'}
                        >
                          {faturaFiyat <= rafOrt ? 'Piyasadan ucuz' : 'Piyasadan pahalı'} (
                          {(((faturaFiyat - rafOrt) / rafOrt) * 100).toFixed(0)}%)
                        </Text>
                      )}
                    </Stack>
                  )}
                </Group>

                {/* Fiyat yoksa uyarı */}
                {aktifFiyat === 0 && (
                  <Alert
                    color="yellow"
                    variant="light"
                    mt="sm"
                    icon={<IconAlertCircle size={16} />}
                    p="xs"
                  >
                    <Text size="xs">
                      Bu ürün için fatura veya piyasa fiyatı bulunamadı. Aşağıdan
                      manuel fiyat girebilirsiniz.
                    </Text>
                  </Alert>
                )}
              </Paper>
            );
          })()}

          {/* === B. Manuel Fiyat Girişi === */}
          <Paper p="md" withBorder radius="md">
            <Group gap="xs" mb="sm">
              <IconEdit size={16} />
              <Text fw={600} size="sm">
                Manuel Fiyat Girişi
              </Text>
            </Group>
            <Group gap="sm" align="flex-end">
              <NumberInput
                label="Birim Fiyat (₺/kg)"
                placeholder="Fiyat girin"
                value={manuelFiyat}
                onChange={setManuelFiyat}
                min={0}
                decimalScale={2}
                fixedDecimalScale
                thousandSeparator=","
                leftSection={<IconCurrencyLira size={14} />}
                size="sm"
                style={{ flex: 1 }}
              />
              <Button
                size="sm"
                color="teal"
                loading={manuelFiyatSaving}
                disabled={!manuelFiyat || Number(manuelFiyat) <= 0}
                leftSection={<IconCheck size={14} />}
                onClick={handleManuelFiyatKaydet}
              >
                Kaydet
              </Button>
            </Group>
          </Paper>

          {/* Piyasa Fiyatları - Ayrı component */}
          <PiyasaFiyatlariSection
            rafFiyatlar={rafFiyatlar}
            rafFiyatLoading={rafFiyatLoading}
            productName={seciliUrunDetay.product_name}
            urunId={seciliUrunDetay.urun_id}
            faturaFiyat={
              seciliUrunDetay.price_per_unit || seciliUrunDetay.avg_unit_price || 0
            }
            modalOpened={opened}
          />

          {/* Özet Bilgiler - Fatura verileri varsa göster */}
          {seciliUrunDetay.invoice_count > 0 ? (
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
              <Paper p="sm" withBorder radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Toplam Tutar
                </Text>
                <Text fw={700} size="lg" c="grape">
                  {formatMoney(seciliUrunDetay.total_amount)}
                </Text>
              </Paper>
              <Paper p="sm" withBorder radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Ortalama Fiyat
                </Text>
                <Text fw={700} size="lg" c="blue">
                  ₺{seciliUrunDetay.avg_unit_price?.toFixed(2) || '0'}
                </Text>
                {(() => {
                  const unitPrice = seciliUrunDetay.avg_unit_price
                    ? calculateUnitPrice(
                        seciliUrunDetay.avg_unit_price,
                        seciliUrunDetay.product_name
                      )
                    : null;
                  return unitPrice ? (
                    <MantineTooltip label={unitPrice.tooltip}>
                      <Text size="xs" c="dimmed" mt={4} style={{ cursor: 'help' }}>
                        {unitPrice.display}
                      </Text>
                    </MantineTooltip>
                  ) : null;
                })()}
              </Paper>
              <Paper p="sm" withBorder radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Min Fiyat
                </Text>
                <Text fw={700} size="lg" c="green">
                  ₺{seciliUrunDetay.min_unit_price?.toFixed(2) || '0'}
                </Text>
              </Paper>
              <Paper p="sm" withBorder radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Max Fiyat
                </Text>
                <Text fw={700} size="lg" c="red">
                  ₺{seciliUrunDetay.max_unit_price?.toFixed(2) || '0'}
                </Text>
              </Paper>
            </SimpleGrid>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
              <Paper p="sm" withBorder radius="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Toplam Miktar
                  </Text>
                  <Text fw={600}>{seciliUrunDetay.total_quantity.toFixed(2)}</Text>
                </Group>
              </Paper>
              <Paper p="sm" withBorder radius="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Fatura Sayısı
                  </Text>
                  <Badge size="lg" variant="light" color="gray">
                    {seciliUrunDetay.invoice_count}
                  </Badge>
                </Group>
              </Paper>
              <Paper p="sm" withBorder radius="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Kategori
                  </Text>
                  <Badge variant="dot">{seciliUrunDetay.category || 'Genel'}</Badge>
                </Group>
              </Paper>
            </SimpleGrid>
          )}

          {/* Zaman Bazlı Karşılaştırma */}
          {zamanKarsilastirma && (
            <Paper
              p="md"
              withBorder
              radius="md"
              bg={zamanKarsilastirma.fark > 0 ? 'red.0' : 'green.0'}
            >
              <Text fw={600} mb="md">
                📊 Aylık Karşılaştırma
              </Text>
              <SimpleGrid cols={2} spacing="xs">
                <Paper p="sm" withBorder radius="md" bg="white">
                  <Text size="xs" c="dimmed">
                    Bu Ay
                  </Text>
                  <Text fw={600} size="lg">
                    ₺{zamanKarsilastirma.buAy.toFixed(2)}
                  </Text>
                </Paper>
                <Paper p="sm" withBorder radius="md" bg="white">
                  <Text size="xs" c="dimmed">
                    Geçen Ay
                  </Text>
                  <Group gap={4}>
                    <Text fw={600} size="lg">
                      ₺{zamanKarsilastirma.geçenAy.toFixed(2)}
                    </Text>
                    <Badge
                      color={zamanKarsilastirma.fark > 0 ? 'red' : 'green'}
                      variant="filled"
                      size="sm"
                    >
                      {zamanKarsilastirma.fark > 0 ? '+' : ''}
                      {zamanKarsilastirma.farkYuzde.toFixed(1)}%
                    </Badge>
                  </Group>
                </Paper>
              </SimpleGrid>
              <Text size="xs" c="dimmed" mt="xs">
                {zamanKarsilastirma.fark > 0 ? '📈' : '📉'}
                {zamanKarsilastirma.fark > 0 ? 'Artış' : 'Azalış'}: ₺
                {Math.abs(zamanKarsilastirma.fark).toFixed(2)}
              </Text>
            </Paper>
          )}

          {/* Fiyat Aralığı */}
          {Number(seciliUrunDetay.min_unit_price) > 0 &&
            Number(seciliUrunDetay.max_unit_price) > 0 && (
              <Paper p="md" withBorder radius="md" bg="grape.0">
                <Text fw={600} mb="xs">
                  Fiyat Aralığı
                </Text>
                <Group gap="md">
                  <Box>
                    <Text size="xs" c="dimmed">
                      Minimum
                    </Text>
                    <Text fw={600} c="green">
                      ₺{seciliUrunDetay.min_unit_price.toFixed(2)}
                    </Text>
                    {(() => {
                      const unitPrice = calculateUnitPrice(
                        seciliUrunDetay.min_unit_price,
                        seciliUrunDetay.product_name
                      );
                      return unitPrice ? (
                        <MantineTooltip label={unitPrice.tooltip}>
                          <Text size="xs" c="dimmed" style={{ cursor: 'help' }}>
                            {unitPrice.display}
                          </Text>
                        </MantineTooltip>
                      ) : null;
                    })()}
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Text size="xs" c="dimmed">
                      Ortalama
                    </Text>
                    <Text fw={600} c="blue">
                      ₺{seciliUrunDetay.avg_unit_price?.toFixed(2) || '0'}
                    </Text>
                    {(() => {
                      const unitPrice = seciliUrunDetay.avg_unit_price
                        ? calculateUnitPrice(
                            seciliUrunDetay.avg_unit_price,
                            seciliUrunDetay.product_name
                          )
                        : null;
                      return unitPrice ? (
                        <MantineTooltip label={unitPrice.tooltip}>
                          <Text size="xs" c="dimmed" style={{ cursor: 'help' }}>
                            {unitPrice.display}
                          </Text>
                        </MantineTooltip>
                      ) : null;
                    })()}
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Maksimum
                    </Text>
                    <Text fw={600} c="red">
                      ₺{seciliUrunDetay.max_unit_price.toFixed(2)}
                    </Text>
                    {(() => {
                      const unitPrice = calculateUnitPrice(
                        seciliUrunDetay.max_unit_price,
                        seciliUrunDetay.product_name
                      );
                      return unitPrice ? (
                        <MantineTooltip label={unitPrice.tooltip}>
                          <Text size="xs" c="dimmed" style={{ cursor: 'help' }}>
                            {unitPrice.display}
                          </Text>
                        </MantineTooltip>
                      ) : null;
                    })()}
                  </Box>
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  Fiyat farkı: ₺
                  {(
                    seciliUrunDetay.max_unit_price - seciliUrunDetay.min_unit_price
                  ).toFixed(2)}
                  (
                  {(
                    ((seciliUrunDetay.max_unit_price - seciliUrunDetay.min_unit_price) /
                      seciliUrunDetay.min_unit_price) *
                    100
                  ).toFixed(1)}
                  %)
                </Text>
              </Paper>
            )}

          {/* Mini Grafik - Son 6 Ay Trendi */}
          {miniChartData.length > 0 && (
            <Paper p="md" withBorder radius="md">
              <Text fw={600} mb="md">
                📈 Son 6 Ay Trendi
              </Text>
              <Box h={150}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={miniChartData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 8 }}
                      tickFormatter={(val) => {
                        try {
                          return format(parseISO(val), 'MMM', { locale: tr });
                        } catch {
                          return val;
                        }
                      }}
                    />
                    <YAxis tick={{ fontSize: 8 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as PriceHistoryData & {
                            monthLabel: string;
                          };
                          return (
                            <Paper p="xs" shadow="md" withBorder>
                              <Text size="xs" fw={600}>
                                {data.monthLabel}
                              </Text>
                              <Text size="xs">Ort: ₺{data.avg_price.toFixed(2)}</Text>
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
                      dot={{ fill: 'var(--mantine-color-grape-6)', r: 3 }}
                      name="Ortalama Fiyat"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          )}

          {/* Son İşlemler Listesi */}
          <Paper p="md" withBorder radius="md">
            <Text fw={600} mb="md">
              📋 Son İşlemler
            </Text>
            {sonIslemlerLoading ? (
              <Stack gap="xs">
                <Skeleton height={50} radius="md" />
                <Skeleton height={50} radius="md" />
                <Skeleton height={50} radius="md" />
              </Stack>
            ) : sonIslemler.length > 0 ? (
              <ScrollArea.Autosize mah={200}>
                <Stack gap="xs">
                  {sonIslemler.map((item) => (
                    <Paper key={item.id} p="sm" withBorder radius="md">
                      <Group justify="space-between" wrap="nowrap">
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" fw={500} lineClamp={1}>
                            {formatDate(item.invoice_date, 'short')}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {item.supplier_name || 'Tedarikçi bilgisi yok'} •{' '}
                            {item.invoice_no ||
                              (item.invoice_date
                                ? `Fatura ${item.invoice_date}`
                                : 'Son işlem')}
                          </Text>
                        </Box>
                        <Stack align="flex-end" gap={2}>
                          <Text size="sm" fw={600} c="grape">
                            ₺{(item.unit_price ?? 0).toFixed(2)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {item.quantity} {item.unit ?? ''}
                          </Text>
                        </Stack>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            ) : (
              <Center py="xl">
                <Text size="sm" c="dimmed">
                  Henüz işlem bulunmuyor
                </Text>
              </Center>
            )}
          </Paper>

          {/* Tedarikçi Analizi */}
          <Paper p="md" withBorder radius="md">
            <Text fw={600} mb="md">
              🏢 Tedarikçi Analizi
            </Text>
            {tedarikciLoading ? (
              <Stack gap="xs">
                <Skeleton height={50} radius="md" />
                <Skeleton height={50} radius="md" />
              </Stack>
            ) : tedarikciAnalizi.length > 0 ? (
              <ScrollArea.Autosize mah={200}>
                <Stack gap="xs">
                  {tedarikciAnalizi
                    .sort((a, b) => a.avg_unit_price - b.avg_unit_price)
                    .map((supplier, index) => (
                      <Paper
                        key={supplier.supplier_name}
                        p="sm"
                        withBorder
                        radius="md"
                        bg={index === 0 ? 'green.0' : undefined}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs">
                              <Text size="sm" fw={500} lineClamp={1}>
                                {supplier.supplier_name}
                              </Text>
                              {index === 0 && (
                                <Badge size="xs" color="green" variant="light">
                                  En Uygun
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              {supplier.invoice_count} fatura •{' '}
                              {supplier.total_quantity.toFixed(2)} miktar
                            </Text>
                          </Box>
                          <Stack align="flex-end" gap={2}>
                            <Text
                              size="sm"
                              fw={600}
                              c={index === 0 ? 'green' : 'blue'}
                            >
                              ₺{supplier.avg_unit_price.toFixed(2)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              Toplam: {formatMoney(supplier.total_amount)}
                            </Text>
                            {supplier.min_unit_price && supplier.max_unit_price && (
                              <Text size="xs" c="dimmed">
                                {supplier.min_unit_price.toFixed(2)} -{' '}
                                {supplier.max_unit_price.toFixed(2)} ₺
                              </Text>
                            )}
                          </Stack>
                        </Group>
                      </Paper>
                    ))}
                </Stack>
              </ScrollArea.Autosize>
            ) : (
              <Center py="xl">
                <Text size="sm" c="dimmed">
                  Tedarikçi bilgisi bulunmuyor
                </Text>
              </Center>
            )}
          </Paper>

          {/* Grafik Gösterimi */}
          <Paper p="md" withBorder radius="md">
            <Text fw={600} mb="md">
              Fiyat Trendi
            </Text>
            <Button
              variant="light"
              fullWidth
              onClick={() => {
                onFiyatTrendiSec(
                  seciliUrunDetay.urun_id,
                  seciliUrunDetay.product_name ?? seciliUrunDetay.urun_ad
                );
                onClose();
              }}
              leftSection={<IconChartLine size={16} />}
            >
              Detaylı Grafikte Göster
            </Button>
          </Paper>

          {/* Bilgi */}
          <Paper p="sm" withBorder radius="md" bg="blue.0">
            <Text size="xs" c="dimmed">
              💡 Bu ürün için detaylı fiyat analizi grafikte görüntülenebilir. Detaylı
              grafikte göster butonuna tıklayarak fiyat trendini inceleyebilirsiniz.
            </Text>
          </Paper>
        </Stack>
      )}
    </Modal>
  );
}
