'use client';

import {
  ActionIcon,
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
  Tabs,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconBuilding,
  IconChartLine,
  IconCheck,
  IconCurrencyLira,
  IconDownload,
  IconHistory,
  IconMinus,
  IconPackages,
  IconRefresh,
  IconShoppingCart,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  type FiyatGecmisiItem,
  faturaKalemleriAPI,
  type PriceHistoryData,
  type RafFiyatSonuc,
} from '@/lib/api/services/fatura-kalemleri';
import { menuPlanlamaAPI, type UrunVaryant, type VaryantOzet } from '@/lib/api/services/menu-planlama';
import { urunlerAPI } from '@/lib/api/services/urunler';
import { formatDate, formatMoney } from '@/lib/formatters';
import { PiyasaFiyatlariSection } from './PiyasaFiyatlariSection';
import type { SeciliUrunDetayType, SonIslemRow, TedarikciAnalizRow } from './types';
import classes from './UrunDetayModal.module.css';
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
  const [manuelFiyat, setManuelFiyat] = useState<number | string>('');
  const [manuelFiyatSaving, setManuelFiyatSaving] = useState(false);
  const [fiyatKaynakSaving, setFiyatKaynakSaving] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<string | null>('genel');
  // Fiyat tipi secimini local olarak takip et (API basarili olunca guncellenir)
  const [aktifTipiOverride, setAktifTipiOverride] = useState<string | null>(null);

  // Reset state on open/close
  useMemo(() => {
    if (opened && urun) {
      setModalTab('genel');
      setAktifTipiOverride(null);
    } else {
      setManuelFiyat('');
      setAktifTipiOverride(null);
    }
  }, [opened, urun]);

  // ─── Queries ────────────────────────────────────────────────────

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

  // Varyant verileri
  const { data: varyantData, isLoading: varyantLoading } = useQuery<{
    varyantlar: UrunVaryant[];
    ozet: VaryantOzet;
  }>({
    queryKey: ['urun-varyantlar', urun?.urun_id],
    queryFn: async () => {
      const urunId = urun?.urun_id;
      if (!urunId) return { varyantlar: [], ozet: { varyant_sayisi: 0, fiyatli_varyant_sayisi: 0, en_ucuz_fiyat: null, en_ucuz_varyant_adi: null, en_pahali_fiyat: null, ortalama_fiyat: null } };
      const res = await menuPlanlamaAPI.getUrunVaryantlari(urunId);
      if (!res.success || !res.data) return { varyantlar: [], ozet: { varyant_sayisi: 0, fiyatli_varyant_sayisi: 0, en_ucuz_fiyat: null, en_ucuz_varyant_adi: null, en_pahali_fiyat: null, ortalama_fiyat: null } };
      return res.data;
    },
    enabled: !!urun?.urun_id && opened,
    staleTime: 2 * 60 * 1000,
  });

  const varyantlar = varyantData?.varyantlar || [];
  const varyantOzet = varyantData?.ozet;

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
      gecenAy: oncekiAy.avg_price,
      fark,
      farkYuzde,
      trend: fark > 0 ? 'increasing' : fark < 0 ? 'decreasing' : ('stable' as const),
    };
  }, [miniTrendData]);

  // Computed prices
  const fiyatBilgi = useMemo(() => {
    if (!urun) return null;
    const faturaFiyat = urun.price_per_unit || urun.avg_unit_price || 0;
    const rafOrt =
      rafFiyatlar.length > 0
        ? rafFiyatlar
            .map((r) => Number(r.birim_fiyat || r.piyasa_fiyat_ort || 0))
            .filter((f) => f > 0)
            .reduce((a, b) => a + b, 0) /
          (rafFiyatlar.filter((r) => Number(r.birim_fiyat || r.piyasa_fiyat_ort || 0) > 0).length ||
            1)
        : 0;
    const aktifFiyat = faturaFiyat || rafOrt || 0;

    // Gerçek fiyat kaynağını belirle (override > aktif_fiyat_tipi > fallback mantık)
    const tipi =
      aktifTipiOverride?.toUpperCase() ||
      (urun as { aktif_fiyat_tipi?: string | null }).aktif_fiyat_tipi?.toUpperCase();
    let kaynak: string;
    let kaynakRenk: string;
    if (tipi === 'FATURA') {
      kaynak = 'Fatura';
      kaynakRenk = 'blue';
    } else if (tipi === 'MANUEL') {
      kaynak = 'Manuel';
      kaynakRenk = 'violet';
    } else if (tipi === 'VARSAYILAN') {
      kaynak = 'Varsayilan';
      kaynakRenk = 'gray';
    } else if (tipi === 'PIYASA') {
      kaynak = 'Piyasa';
      kaynakRenk = 'orange';
    } else if (tipi === 'SOZLESME') {
      kaynak = 'Sozlesme';
      kaynakRenk = 'teal';
    } else if (faturaFiyat > 0) {
      // tipi yoksa fallback: fatura fiyatına bak
      kaynak = 'Fatura';
      kaynakRenk = 'blue';
    } else if (rafOrt > 0) {
      kaynak = 'Piyasa';
      kaynakRenk = 'orange';
    } else {
      kaynak = 'Fiyat Yok';
      kaynakRenk = 'gray';
    }

    // Manuel fiyat bilgisi
    const manuelFiyatDeger = Number(urun.manuel_fiyat) || 0;
    // Fatura fiyat: sadece son_alis_fiyati varsa goster, yoksa 0 (generic fiyata fallback etme)
    const faturaFiyatDeger = Number(urun.son_alis_fiyati) || 0;
    const aktifTipi = tipi || null;

    return {
      faturaFiyat,
      faturaFiyatDeger,
      manuelFiyatDeger,
      rafOrt,
      aktifFiyat,
      kaynak,
      kaynakRenk,
      aktifTipi,
    };
  }, [urun, rafFiyatlar, aktifTipiOverride]);

  // ─── Callbacks ─────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['maliyet-ozet'] });
    queryClient.invalidateQueries({ queryKey: ['fiyat-gecmisi-recent', urun?.urun_id] });
    queryClient.invalidateQueries({ queryKey: ['tedarikci-karsilastirma', urun?.urun_id] });
    queryClient.invalidateQueries({ queryKey: ['fiyat-gecmisi-mini', urun?.urun_id] });
    queryClient.invalidateQueries({ queryKey: ['raf-fiyat', urun?.urun_id] });
  }, [queryClient, urun?.urun_id]);

  const handleManuelFiyatKaydet = useCallback(async () => {
    if (!urun?.urun_id || !manuelFiyat) return;
    setManuelFiyatSaving(true);
    try {
      // Hem fiyat geçmişine kaydet hem de aktif fiyat kaynağını MANUEL yap
      await urunlerAPI.updateFiyat(urun.urun_id, {
        birim_fiyat: Number(manuelFiyat),
        kaynak: 'manuel',
        aciklama: 'Menü planlama modalından manuel giriş',
      });
      await urunlerAPI.aktifFiyatSec(urun.urun_id, {
        fiyat_tipi: 'MANUEL',
        fiyat: Number(manuelFiyat),
      });
      // UI'i aninda guncelle
      setAktifTipiOverride('MANUEL');
      notifications.show({
        title: 'Fiyat Kaydedildi',
        message: `₺${Number(manuelFiyat).toFixed(2)} manuel fiyat olarak ayarlandı`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
      setManuelFiyat('');
      queryClient.invalidateQueries({ queryKey: ['maliyet-ozet'] });
      queryClient.invalidateQueries({ queryKey: ['urun-kartlari-fiyatlar'] });
      queryClient.invalidateQueries({ queryKey: ['raf-fiyat', urun.urun_id] });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const backendMsg = axiosErr?.response?.data?.error;
      notifications.show({
        title: 'Hata',
        message: backendMsg || (err instanceof Error ? err.message : 'Fiyat kaydedilemedi'),
        color: 'red',
      });
    } finally {
      setManuelFiyatSaving(false);
    }
  }, [urun?.urun_id, manuelFiyat, queryClient]);

  const handleFiyatKaynakSec = useCallback(
    async (tipi: 'FATURA' | 'PIYASA' | 'MANUEL', fiyat?: number) => {
      if (!urun?.urun_id) return;
      setFiyatKaynakSaving(tipi);
      try {
        const res = await urunlerAPI.aktifFiyatSec(urun.urun_id, {
          fiyat_tipi: tipi,
          fiyat,
        });
        if (res.success) {
          // UI'i aninda guncelle (query invalidation beklemeden)
          setAktifTipiOverride(tipi);
          notifications.show({
            title: 'Fiyat Güncellendi',
            message: res.message || `Aktif fiyat ${tipi} olarak ayarlandı`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          });
          queryClient.invalidateQueries({ queryKey: ['maliyet-ozet'] });
          queryClient.invalidateQueries({ queryKey: ['urun-kartlari-fiyatlar'] });
          queryClient.invalidateQueries({ queryKey: ['raf-fiyat', urun.urun_id] });
        } else {
          notifications.show({
            title: 'Hata',
            message: res.error || 'Fiyat kaynağı değiştirilemedi',
            color: 'red',
          });
        }
      } catch (err: unknown) {
        // Axios hatasindan backend mesajini cikar
        const axiosErr = err as { response?: { data?: { error?: string } } };
        const backendMsg = axiosErr?.response?.data?.error;
        notifications.show({
          title: 'Hata',
          message:
            backendMsg || (err instanceof Error ? err.message : 'Fiyat kaynağı değiştirilemedi'),
          color: 'red',
        });
      } finally {
        setFiyatKaynakSaving(null);
      }
    },
    [urun?.urun_id, queryClient]
  );

  const exportToExcel = useCallback(() => {
    if (!urun) return;
    const csvData = [
      [
        'Ürün Adı',
        'Toplam Tutar',
        'Ort. Fiyat',
        'Min',
        'Max',
        'Miktar',
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
    link.setAttribute('download', `${urun.product_name.replace(/[^a-z0-9]/gi, '_')}_analiz.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [urun]);

  const d = urun; // shorthand

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      fullScreen={isMobile && isMounted}
      radius="lg"
      padding={0}
      withCloseButton={false}
      styles={{
        content: { background: 'var(--mantine-color-dark-7)', overflow: 'hidden' },
        body: { padding: 0 },
      }}
    >
      {d && fiyatBilgi && (
        <>
          {/* ══ HEADER ══════════════════════════════════════════ */}
          <Box
            px="lg"
            pt="lg"
            pb="md"
            style={{
              borderBottom: '1px solid var(--mantine-color-dark-5)',
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap="sm" mb={4}>
                  {d.category && (
                    <Badge size="xs" variant="light" color="gray" radius="sm">
                      {d.category}
                    </Badge>
                  )}
                  {d.invoice_count > 0 && (
                    <Badge size="xs" variant="dot" color="blue">
                      {d.invoice_count} fatura
                    </Badge>
                  )}
                </Group>
                <Text fw={700} size="lg" lineClamp={1}>
                  {d.product_name}
                </Text>
              </Box>
              <Group gap={6}>
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleRefresh}>
                  <IconRefresh size={15} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={exportToExcel}>
                  <IconDownload size={15} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
                  <IconMinus size={15} />
                </ActionIcon>
              </Group>
            </Group>

            {/* ── Hero Fiyat ──────────────────────────── */}
            <Box
              mt="md"
              p="md"
              style={{
                borderRadius: 'var(--mantine-radius-md)',
                background: 'var(--mantine-color-dark-6)',
              }}
            >
              <Group justify="space-between" align="center" wrap="wrap">
                <Box>
                  <Text size="xs" c="dimmed" mb={2}>
                    Aktif Birim Fiyat
                  </Text>
                  {fiyatBilgi.aktifFiyat > 0 ? (
                    <Group gap="sm" align="baseline">
                      <Text fw={800} size="28px" lh={1} c={fiyatBilgi.kaynakRenk}>
                        ₺{fiyatBilgi.aktifFiyat.toFixed(2)}
                      </Text>
                      <Text size="sm" c="dimmed">
                        /
                        {(() => {
                          const u = (d.standard_unit || 'kg').toLowerCase();
                          if (['lt', 'litre', 'l'].includes(u)) return 'L';
                          if (['kg', 'kilo'].includes(u)) return 'kg';
                          if (['adet', 'ad'].includes(u)) return 'adet';
                          return u;
                        })()}
                      </Text>
                      <Badge size="xs" variant="light" color={fiyatBilgi.kaynakRenk} radius="sm">
                        {fiyatBilgi.kaynak}
                      </Badge>
                    </Group>
                  ) : (
                    <Group gap="sm" align="center">
                      <Text fw={600} size="lg" c="yellow">
                        Fiyat bilgisi yok
                      </Text>
                      <IconAlertTriangle size={16} color="var(--mantine-color-yellow-5)" />
                    </Group>
                  )}
                </Box>

                {/* Aylık trend küçük gösterge */}
                {zamanKarsilastirma && (
                  <Box ta="right">
                    <Text size="xs" c="dimmed" mb={2}>
                      Aylık Değişim
                    </Text>
                    <Group gap={6} justify="flex-end">
                      {zamanKarsilastirma.fark > 0 ? (
                        <IconTrendingUp size={18} color="var(--mantine-color-red-5)" />
                      ) : zamanKarsilastirma.fark < 0 ? (
                        <IconTrendingDown size={18} color="var(--mantine-color-green-5)" />
                      ) : null}
                      <Text
                        fw={700}
                        size="lg"
                        c={
                          zamanKarsilastirma.fark > 0
                            ? 'red'
                            : zamanKarsilastirma.fark < 0
                              ? 'green'
                              : 'dimmed'
                        }
                      >
                        {zamanKarsilastirma.fark > 0 ? '+' : ''}
                        {zamanKarsilastirma.farkYuzde.toFixed(1)}%
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      ₺{zamanKarsilastirma.gecenAy.toFixed(2)} → ₺
                      {zamanKarsilastirma.buAy.toFixed(2)}
                    </Text>
                  </Box>
                )}
              </Group>

              {/* Fiyat Kaynağı Seçici */}
              <Box mt="sm" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-5)' }}>
                <Group gap={6} grow>
                  {/* 1. Piyasa (öncelikli - otomatik sync) */}
                  <Box
                    p="xs"
                    style={{
                      borderRadius: 'var(--mantine-radius-md)',
                      border: `1.5px solid ${fiyatBilgi.aktifTipi === 'PIYASA' ? 'var(--mantine-color-orange-5)' : 'var(--mantine-color-dark-5)'}`,
                      background:
                        fiyatBilgi.aktifTipi === 'PIYASA'
                          ? 'rgba(253, 126, 20, 0.08)'
                          : 'var(--mantine-color-dark-7)',
                      cursor: fiyatBilgi.rafOrt > 0 ? 'pointer' : 'not-allowed',
                      opacity: fiyatBilgi.rafOrt > 0 ? 1 : 0.4,
                      transition: 'all 150ms ease',
                      position: 'relative',
                    }}
                    onClick={() => {
                      if (fiyatBilgi.rafOrt > 0 && fiyatBilgi.aktifTipi !== 'PIYASA') {
                        handleFiyatKaynakSec('PIYASA');
                      }
                    }}
                  >
                    {fiyatBilgi.aktifTipi === 'PIYASA' && (
                      <Box
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: 'var(--mantine-color-orange-5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconCheck size={10} color="white" />
                      </Box>
                    )}
                    {fiyatKaynakSaving === 'PIYASA' && (
                      <Box
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 'var(--mantine-radius-md)',
                          background: 'rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text size="xs" c="dimmed">
                          ...
                        </Text>
                      </Box>
                    )}
                    <Text size="10px" c="dimmed" fw={500}>
                      Piyasa
                    </Text>
                    <Text size="sm" fw={700} c={fiyatBilgi.rafOrt > 0 ? 'orange.4' : 'dimmed'}>
                      {fiyatBilgi.rafOrt > 0 ? `₺${fiyatBilgi.rafOrt.toFixed(2)}` : '—'}
                    </Text>
                  </Box>

                  {/* 2. Fatura */}
                  <Box
                    p="xs"
                    style={{
                      borderRadius: 'var(--mantine-radius-md)',
                      border: `1.5px solid ${fiyatBilgi.aktifTipi === 'FATURA' ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-dark-5)'}`,
                      background:
                        fiyatBilgi.aktifTipi === 'FATURA'
                          ? 'rgba(34, 139, 230, 0.08)'
                          : 'var(--mantine-color-dark-7)',
                      cursor: fiyatBilgi.faturaFiyatDeger > 0 ? 'pointer' : 'not-allowed',
                      opacity: fiyatBilgi.faturaFiyatDeger > 0 ? 1 : 0.4,
                      transition: 'all 150ms ease',
                      position: 'relative',
                    }}
                    onClick={() => {
                      if (fiyatBilgi.faturaFiyatDeger > 0 && fiyatBilgi.aktifTipi !== 'FATURA') {
                        handleFiyatKaynakSec('FATURA');
                      }
                    }}
                  >
                    {fiyatBilgi.aktifTipi === 'FATURA' && (
                      <Box
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: 'var(--mantine-color-blue-5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconCheck size={10} color="white" />
                      </Box>
                    )}
                    {fiyatKaynakSaving === 'FATURA' && (
                      <Box
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 'var(--mantine-radius-md)',
                          background: 'rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text size="xs" c="dimmed">
                          ...
                        </Text>
                      </Box>
                    )}
                    <Text size="10px" c="dimmed" fw={500}>
                      Fatura
                    </Text>
                    <Text
                      size="sm"
                      fw={700}
                      c={fiyatBilgi.faturaFiyatDeger > 0 ? 'blue.4' : 'dimmed'}
                    >
                      {fiyatBilgi.faturaFiyatDeger > 0
                        ? `₺${fiyatBilgi.faturaFiyatDeger.toFixed(2)}`
                        : '—'}
                    </Text>
                  </Box>

                  {/* 3. Manuel */}
                  <Box
                    p="xs"
                    style={{
                      borderRadius: 'var(--mantine-radius-md)',
                      border: `1.5px solid ${fiyatBilgi.aktifTipi === 'MANUEL' || fiyatBilgi.aktifTipi === 'VARSAYILAN' ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-dark-5)'}`,
                      background:
                        fiyatBilgi.aktifTipi === 'MANUEL' || fiyatBilgi.aktifTipi === 'VARSAYILAN'
                          ? 'rgba(121, 80, 242, 0.08)'
                          : 'var(--mantine-color-dark-7)',
                      cursor: fiyatBilgi.manuelFiyatDeger > 0 ? 'pointer' : 'not-allowed',
                      opacity: fiyatBilgi.manuelFiyatDeger > 0 ? 1 : 0.4,
                      transition: 'all 150ms ease',
                      position: 'relative',
                    }}
                    onClick={() => {
                      if (fiyatBilgi.manuelFiyatDeger > 0 && fiyatBilgi.aktifTipi !== 'MANUEL') {
                        handleFiyatKaynakSec('MANUEL', fiyatBilgi.manuelFiyatDeger);
                      }
                    }}
                  >
                    {(fiyatBilgi.aktifTipi === 'MANUEL' ||
                      fiyatBilgi.aktifTipi === 'VARSAYILAN') && (
                      <Box
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: 'var(--mantine-color-violet-5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconCheck size={10} color="white" />
                      </Box>
                    )}
                    {fiyatKaynakSaving === 'MANUEL' && (
                      <Box
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 'var(--mantine-radius-md)',
                          background: 'rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text size="xs" c="dimmed">
                          ...
                        </Text>
                      </Box>
                    )}
                    <Text size="10px" c="dimmed" fw={500}>
                      Manuel
                    </Text>
                    <Text
                      size="sm"
                      fw={700}
                      c={fiyatBilgi.manuelFiyatDeger > 0 ? 'violet.4' : 'dimmed'}
                    >
                      {fiyatBilgi.manuelFiyatDeger > 0
                        ? `₺${fiyatBilgi.manuelFiyatDeger.toFixed(2)}`
                        : '—'}
                    </Text>
                  </Box>
                </Group>

                {/* ── Aktif fiyat seçim mantığı açıklaması ── */}
                {fiyatBilgi.aktifFiyat > 0 && (
                  <Text size="xs" c="dimmed" mt={4} ta="center" style={{ lineHeight: 1.3 }}>
                    {fiyatBilgi.aktifTipi === 'FATURA'
                      ? 'Son fatura birim fiyatı aktif. Tıklayarak piyasa veya manuel fiyata geçebilirsiniz.'
                      : fiyatBilgi.aktifTipi === 'PIYASA'
                        ? 'Piyasa ortalaması aktif. Market fiyatlarından hesaplanır.'
                        : fiyatBilgi.aktifTipi === 'MANUEL'
                          ? 'Manuel girilen fiyat aktif.'
                          : fiyatBilgi.aktifTipi === 'VARSAYILAN'
                            ? 'Varsayılan fiyat aktif. Fatura veya piyasa fiyatı gelince otomatik güncellenir.'
                            : fiyatBilgi.aktifTipi === 'SOZLESME'
                              ? 'Sözleşme fiyatı aktif.'
                              : 'Fiyat kaynağı: otomatik seçim (fatura > piyasa > varsayılan).'}
                  </Text>
                )}
              </Box>
            </Box>
          </Box>

          {/* ══ TAB İÇERİK ══════════════════════════════════════ */}
          <Tabs
            value={modalTab}
            onChange={setModalTab}
            variant="default"
            classNames={{ tab: classes.tab }}
            styles={{
              root: { display: 'flex', flexDirection: 'column', flex: 1 },
              list: {
                background: 'var(--mantine-color-dark-7)',
                borderBottom: '1px solid var(--mantine-color-dark-5)',
                paddingInline: 'var(--mantine-spacing-lg)',
                gap: 0,
              },
              panel: { padding: 0 },
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="genel" leftSection={<IconChartLine size={14} />}>
                Genel
              </Tabs.Tab>
              <Tabs.Tab value="islemler" leftSection={<IconHistory size={14} />}>
                İşlemler
              </Tabs.Tab>
              <Tabs.Tab value="tedarikciler" leftSection={<IconBuilding size={14} />}>
                Tedarikçiler
              </Tabs.Tab>
              <Tabs.Tab value="piyasa" leftSection={<IconShoppingCart size={14} />}>
                Piyasa
              </Tabs.Tab>
              {(varyantlar.length > 0 || varyantLoading) && (
                <Tabs.Tab value="varyantlar" leftSection={<IconPackages size={14} />}>
                  Varyantlar
                  {varyantOzet && varyantOzet.varyant_sayisi > 0 && (
                    <Badge size="xs" variant="filled" color="violet" ml={6} radius="xl">
                      {varyantOzet.varyant_sayisi}
                    </Badge>
                  )}
                </Tabs.Tab>
              )}
            </Tabs.List>

            <ScrollArea h={isMobile ? 'calc(100vh - 320px)' : 400} offsetScrollbars>
              {/* ── Genel Tab ─────────────────────────────── */}
              <Tabs.Panel value="genel">
                <Stack gap="md" p="lg">
                  {/* Fiyat İstatistikleri */}
                  {d.invoice_count > 0 && (
                    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                      <StatCard
                        label="Toplam Tutar"
                        value={formatMoney(d.total_amount)}
                        color="grape"
                      />
                      <StatCard
                        label="Ortalama"
                        value={`₺${d.avg_unit_price?.toFixed(2) || '0'}`}
                        color="blue"
                        subtitle={
                          d.avg_unit_price
                            ? calculateUnitPrice(d.avg_unit_price, d.product_name)?.display
                            : undefined
                        }
                      />
                      <StatCard
                        label="Minimum"
                        value={`₺${d.min_unit_price?.toFixed(2) || '0'}`}
                        color="green"
                      />
                      <StatCard
                        label="Maksimum"
                        value={`₺${d.max_unit_price?.toFixed(2) || '0'}`}
                        color="red"
                      />
                    </SimpleGrid>
                  )}

                  {/* Fiyat Aralığı Bar */}
                  {Number(d.min_unit_price) > 0 && Number(d.max_unit_price) > 0 && (
                    <Box>
                      <Text size="xs" c="dimmed" fw={500} mb="xs">
                        Fiyat Aralığı
                      </Text>
                      <Box
                        style={{
                          position: 'relative',
                          height: 6,
                          borderRadius: 3,
                          background: 'var(--mantine-color-dark-5)',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          style={{
                            position: 'absolute',
                            left: '0%',
                            right: '0%',
                            height: '100%',
                            borderRadius: 3,
                            background:
                              'linear-gradient(90deg, var(--mantine-color-green-6), var(--mantine-color-blue-6), var(--mantine-color-red-6))',
                          }}
                        />
                      </Box>
                      <Group justify="space-between" mt={4}>
                        <Text size="xs" c="green" fw={600}>
                          ₺{d.min_unit_price.toFixed(2)}
                        </Text>
                        {d.avg_unit_price && (
                          <Text size="xs" c="blue" fw={500}>
                            ₺{d.avg_unit_price.toFixed(2)}
                          </Text>
                        )}
                        <Text size="xs" c="red" fw={600}>
                          ₺{d.max_unit_price.toFixed(2)}
                        </Text>
                      </Group>
                    </Box>
                  )}

                  {/* Mini Grafik */}
                  {miniChartData.length > 1 && (
                    <Box>
                      <Group justify="space-between" mb="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Fiyat Trendi
                        </Text>
                        <ActionIcon
                          variant="subtle"
                          color="grape"
                          size="xs"
                          onClick={() => {
                            onFiyatTrendiSec(d.urun_id, d.product_name ?? d.urun_ad);
                            onClose();
                          }}
                          title="Detaylı grafikte göster"
                        >
                          <IconChartLine size={14} />
                        </ActionIcon>
                      </Group>
                      <Box
                        h={140}
                        style={{
                          borderRadius: 'var(--mantine-radius-md)',
                          background: 'var(--mantine-color-dark-6)',
                          padding: '8px 4px 0 0',
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={miniChartData}>
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 9, fill: 'var(--mantine-color-dimmed)' }}
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
                              tick={{ fontSize: 9, fill: 'var(--mantine-color-dimmed)' }}
                              tickLine={false}
                              axisLine={false}
                              width={40}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload?.length) {
                                  const data = payload[0].payload as PriceHistoryData & {
                                    monthLabel: string;
                                  };
                                  return (
                                    <Paper p="xs" shadow="md" withBorder radius="sm">
                                      <Text size="xs" fw={600}>
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
                            <Line
                              type="monotone"
                              dataKey="avg_price"
                              stroke="var(--mantine-color-grape-5)"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4, fill: 'var(--mantine-color-grape-5)' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    </Box>
                  )}

                  {/* Manuel Fiyat Girişi - kompakt */}
                  <Box
                    p="sm"
                    style={{
                      borderRadius: 'var(--mantine-radius-md)',
                      background: 'var(--mantine-color-dark-6)',
                    }}
                  >
                    <Group gap="sm" align="flex-end">
                      <NumberInput
                        label={
                          <Text size="xs" c="dimmed" fw={500}>
                            Manuel Fiyat
                          </Text>
                        }
                        placeholder="₺0.00"
                        value={manuelFiyat}
                        onChange={setManuelFiyat}
                        min={0}
                        decimalScale={2}
                        fixedDecimalScale
                        thousandSeparator=","
                        leftSection={<IconCurrencyLira size={14} />}
                        size="sm"
                        radius="md"
                        style={{ flex: 1 }}
                        styles={{
                          input: {
                            background: 'var(--mantine-color-dark-7)',
                            border: '1px solid var(--mantine-color-dark-4)',
                          },
                        }}
                      />
                      <Button
                        size="sm"
                        radius="md"
                        color="teal"
                        loading={manuelFiyatSaving}
                        disabled={!manuelFiyat || Number(manuelFiyat) <= 0}
                        onClick={handleManuelFiyatKaydet}
                      >
                        Kaydet
                      </Button>
                    </Group>
                  </Box>
                </Stack>
              </Tabs.Panel>

              {/* ── İşlemler Tab ──────────────────────────── */}
              <Tabs.Panel value="islemler">
                <Stack gap={0} p="lg">
                  {sonIslemlerLoading ? (
                    <Stack gap="sm">
                      <Skeleton height={52} radius="md" />
                      <Skeleton height={52} radius="md" />
                      <Skeleton height={52} radius="md" />
                    </Stack>
                  ) : sonIslemler.length > 0 ? (
                    <Stack gap={1}>
                      {sonIslemler.map((item, idx) => (
                        <Box
                          key={item.id}
                          py="sm"
                          px="xs"
                          style={{
                            borderBottom:
                              idx < sonIslemler.length - 1
                                ? '1px solid var(--mantine-color-dark-5)'
                                : 'none',
                          }}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Group gap="xs" mb={2}>
                                <Text size="xs" c="dimmed">
                                  {formatDate(item.invoice_date, 'short')}
                                </Text>
                                {item.supplier_name && (
                                  <>
                                    <Text size="xs" c="dimmed">
                                      ·
                                    </Text>
                                    <Text size="xs" c="dimmed" lineClamp={1}>
                                      {item.supplier_name}
                                    </Text>
                                  </>
                                )}
                              </Group>
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {item.description}
                              </Text>
                            </Box>
                            <Box ta="right" style={{ flexShrink: 0 }}>
                              <Text size="sm" fw={600}>
                                ₺{(item.unit_price ?? 0).toFixed(2)}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {item.quantity} {item.unit ?? ''}
                              </Text>
                            </Box>
                          </Group>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Center py="xl">
                      <Stack align="center" gap="sm">
                        <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
                          <IconHistory size={24} />
                        </ThemeIcon>
                        <Text size="sm" c="dimmed">
                          Henüz işlem kaydı yok
                        </Text>
                      </Stack>
                    </Center>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* ── Tedarikçiler Tab ──────────────────────── */}
              <Tabs.Panel value="tedarikciler">
                <Stack gap={0} p="lg">
                  {tedarikciLoading ? (
                    <Stack gap="sm">
                      <Skeleton height={60} radius="md" />
                      <Skeleton height={60} radius="md" />
                    </Stack>
                  ) : tedarikciAnalizi.length > 0 ? (
                    <Stack gap="sm">
                      {tedarikciAnalizi
                        .sort((a, b) => a.avg_unit_price - b.avg_unit_price)
                        .map((supplier, index) => (
                          <Box
                            key={supplier.supplier_name}
                            p="sm"
                            style={{
                              borderRadius: 'var(--mantine-radius-md)',
                              background:
                                index === 0 ? 'var(--mantine-color-dark-6)' : 'transparent',
                              border:
                                index === 0
                                  ? '1px solid var(--mantine-color-green-8)'
                                  : '1px solid var(--mantine-color-dark-5)',
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap">
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <Group gap="xs" mb={2}>
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
                                  {supplier.invoice_count} fatura
                                  {supplier.min_unit_price > 0 &&
                                    supplier.max_unit_price > 0 &&
                                    ` · ₺${supplier.min_unit_price.toFixed(2)} – ₺${supplier.max_unit_price.toFixed(2)}`}
                                </Text>
                              </Box>
                              <Text
                                size="lg"
                                fw={700}
                                c={index === 0 ? 'green' : 'white'}
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                              >
                                ₺{supplier.avg_unit_price.toFixed(2)}
                              </Text>
                            </Group>
                          </Box>
                        ))}
                    </Stack>
                  ) : (
                    <Center py="xl">
                      <Stack align="center" gap="sm">
                        <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
                          <IconBuilding size={24} />
                        </ThemeIcon>
                        <Text size="sm" c="dimmed">
                          Tedarikçi bilgisi bulunamadı
                        </Text>
                      </Stack>
                    </Center>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* ── Piyasa Tab ────────────────────────────── */}
              <Tabs.Panel value="piyasa">
                <Box p="lg">
                  <PiyasaFiyatlariSection
                    rafFiyatlar={rafFiyatlar}
                    rafFiyatLoading={rafFiyatLoading}
                    productName={d.product_name}
                    urunId={d.urun_id}
                    faturaFiyat={d.price_per_unit || d.avg_unit_price || 0}
                    modalOpened={opened}
                  />
                </Box>
              </Tabs.Panel>

              {/* ── Varyantlar Tab ────────────────────────── */}
              <Tabs.Panel value="varyantlar">
                <Stack gap="md" p="lg">
                  {varyantLoading ? (
                    <Stack gap="sm">
                      <Skeleton height={60} radius="md" />
                      <Skeleton height={60} radius="md" />
                      <Skeleton height={60} radius="md" />
                    </Stack>
                  ) : varyantlar.length > 0 ? (
                    <>
                      {/* Varyant Özet */}
                      {varyantOzet && varyantOzet.varyant_sayisi > 0 && (
                        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                          <StatCard
                            label="Toplam Varyant"
                            value={String(varyantOzet.varyant_sayisi)}
                            color="violet"
                          />
                          <StatCard
                            label="Fiyatlı"
                            value={String(varyantOzet.fiyatli_varyant_sayisi)}
                            color="green"
                          />
                          <StatCard
                            label="En Ucuz"
                            value={varyantOzet.en_ucuz_fiyat ? `₺${Number(varyantOzet.en_ucuz_fiyat).toFixed(2)}` : '—'}
                            color="teal"
                            subtitle={varyantOzet.en_ucuz_varyant_adi || undefined}
                          />
                          <StatCard
                            label="Ortalama"
                            value={varyantOzet.ortalama_fiyat ? `₺${Number(varyantOzet.ortalama_fiyat).toFixed(2)}` : '—'}
                            color="blue"
                          />
                        </SimpleGrid>
                      )}

                      {/* Varyant Listesi */}
                      <Stack gap="xs">
                        {varyantlar.map((v, _idx) => {
                          const isEnUcuz = varyantOzet?.en_ucuz_varyant_adi === v.ad;
                          const vFiyat = Number(v.guncel_fiyat) || 0;
                          return (
                            <Box
                              key={v.id}
                              p="sm"
                              style={{
                                borderRadius: 'var(--mantine-radius-md)',
                                background: isEnUcuz ? 'var(--mantine-color-dark-6)' : 'transparent',
                                border: isEnUcuz
                                  ? '1px solid var(--mantine-color-teal-8)'
                                  : '1px solid var(--mantine-color-dark-5)',
                              }}
                            >
                              <Group justify="space-between" wrap="nowrap">
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <Group gap="xs" mb={2}>
                                    <Text size="sm" fw={500} lineClamp={1}>
                                      {v.ad}
                                    </Text>
                                    {isEnUcuz && (
                                      <Badge size="xs" color="teal" variant="light">
                                        En Uygun
                                      </Badge>
                                    )}
                                  </Group>
                                  <Group gap={6}>
                                    {v.varyant_tipi && (
                                      <Badge size="xs" variant="outline" color="gray" radius="sm">
                                        {v.varyant_tipi}
                                      </Badge>
                                    )}
                                    <Badge
                                      size="xs"
                                      variant="dot"
                                      color={
                                        v.fiyat_kaynagi === 'FATURA'
                                          ? 'blue'
                                          : v.fiyat_kaynagi === 'PIYASA'
                                            ? 'orange'
                                            : v.fiyat_kaynagi === 'MANUEL'
                                              ? 'violet'
                                              : 'gray'
                                      }
                                    >
                                      {v.fiyat_kaynagi === 'YOK' ? 'Fiyat Yok' : v.fiyat_kaynagi}
                                    </Badge>
                                    {v.birim && (
                                      <Text size="xs" c="dimmed">
                                        {v.birim}
                                      </Text>
                                    )}
                                  </Group>
                                  {v.tedarikci_urun_adi && v.tedarikci_urun_adi !== v.ad && (
                                    <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
                                      Fatura: {v.tedarikci_urun_adi}
                                    </Text>
                                  )}
                                </Box>
                                <Box ta="right" style={{ flexShrink: 0 }}>
                                  {vFiyat > 0 ? (
                                    <Text
                                      size="lg"
                                      fw={700}
                                      c={isEnUcuz ? 'teal' : 'white'}
                                      style={{ fontVariantNumeric: 'tabular-nums' }}
                                    >
                                      ₺{vFiyat.toFixed(2)}
                                    </Text>
                                  ) : (
                                    <Text size="sm" c="red.5" fw={500}>
                                      Fiyat yok
                                    </Text>
                                  )}
                                  {v.son_fiyat_guncelleme && (
                                    <Text size="xs" c="dimmed">
                                      {formatDate(v.son_fiyat_guncelleme, 'short')}
                                    </Text>
                                  )}
                                </Box>
                              </Group>
                            </Box>
                          );
                        })}
                      </Stack>
                    </>
                  ) : (
                    <Center py="xl">
                      <Stack align="center" gap="sm">
                        <ThemeIcon size="xl" variant="light" color="gray" radius="xl">
                          <IconPackages size={24} />
                        </ThemeIcon>
                        <Text size="sm" c="dimmed">
                          Bu ürünün varyantı bulunmuyor
                        </Text>
                      </Stack>
                    </Center>
                  )}
                </Stack>
              </Tabs.Panel>
            </ScrollArea>
          </Tabs>
        </>
      )}
    </Modal>
  );
}

// ─── Mini Stat Card Component ──────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <Box
      p="sm"
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        background: 'var(--mantine-color-dark-6)',
      }}
    >
      <Text size="xs" c="dimmed" mb={4}>
        {label}
      </Text>
      <Text fw={700} size="md" c={color}>
        {value}
      </Text>
      {subtitle && (
        <Text size="xs" c="dimmed" mt={2}>
          {subtitle}
        </Text>
      )}
    </Box>
  );
}
