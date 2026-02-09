'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Progress,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconChevronDown,
  IconCircleCheck,
  IconClock,
  IconRefresh,
  IconSearch,
  IconShoppingCart,
  IconTag,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { faturaKalemleriAPI, type RafFiyatSonuc } from '@/lib/api/services/fatura-kalemleri';

// ─── TYPES ────────────────────────────────────────────────

interface PiyasaFiyatlariSectionProps {
  rafFiyatlar: RafFiyatSonuc[];
  rafFiyatLoading: boolean;
  productName: string | undefined;
  urunId: number | undefined;
  faturaFiyat: number; // birim fiyat (TL/kg veya TL/L)
  modalOpened: boolean;
}

// ─── HELPERS ──────────────────────────────────────────────

/** Araştırma tarihinden kaç gün geçtiğini hesapla */
function gunFarki(tarih: string | null | undefined): number {
  if (!tarih) return 999;
  return Math.floor((Date.now() - new Date(tarih).getTime()) / (1000 * 60 * 60 * 24));
}

/** Güncellik rengi ve ikonu */
function guncellikBilgisi(tarih: string | null | undefined) {
  const gun = gunFarki(tarih);
  if (gun <= 7) return { renk: 'green', ikon: IconCircleCheck, etiket: `${gun}g` };
  if (gun <= 30) return { renk: 'yellow', ikon: IconClock, etiket: `${gun}g` };
  return { renk: 'red', ikon: IconClock, etiket: `${gun}g` };
}

/** "3 gün önce" şeklinde relative date */
function relativeDate(tarih: string | null | undefined): string {
  const gun = gunFarki(tarih);
  if (gun === 0) return 'Bugün';
  if (gun === 1) return 'Dün';
  if (gun < 30) return `${gun} gün önce`;
  if (gun < 365) return `${Math.floor(gun / 30)} ay önce`;
  return `${Math.floor(gun / 365)} yıl önce`;
}

/** birimTipi'ni kaynaklar JSON'dan parse et */
function parseBirimTipi(rf: RafFiyatSonuc): string {
  try {
    const k = rf.kaynaklar as unknown;
    if (k && typeof k === 'object' && !Array.isArray(k) && 'birimTipi' in (k as Record<string, unknown>)) {
      return (k as Record<string, string>).birimTipi || 'kg';
    }
  } catch { /* ignore */ }
  return 'kg';
}

/** Ambalaj bilgisini okunabilir formata dönüştür (0.2 → "200gr", 1 → "1 kg") */
function formatAmbalaj(miktar: string | null | undefined): string | null {
  if (!miktar) return null;
  const n = Number(miktar);
  if (!n || n <= 0) return null;
  if (n >= 1) return `${n} kg`;
  return `${Math.round(n * 1000)}gr`;
}

// ─── COMPONENT ────────────────────────────────────────────

export function PiyasaFiyatlariSection({
  rafFiyatlar,
  rafFiyatLoading,
  productName,
  urunId,
  faturaFiyat,
  modalOpened,
}: PiyasaFiyatlariSectionProps) {
  const queryClient = useQueryClient();
  const [aramaLoading, setAramaLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const autoSearchTriggered = useRef(false);
  const lastSearchedUrunId = useRef<number | undefined>(undefined);

  // ─── Araştırma fonksiyonu ─────────────────────────────
  const handlePiyasaArastir = useCallback(async () => {
    if (!productName || aramaLoading) return;
    setAramaLoading(true);
    try {
      const res = await faturaKalemleriAPI.rafFiyatArastir(productName, urunId);
      queryClient.invalidateQueries({ queryKey: ['raf-fiyat', urunId] });
      queryClient.invalidateQueries({ queryKey: ['maliyet-ozet'] });

      if (res.success && res.piyasa) {
        notifications.show({
          title: 'Güncellendi',
          message: `${res.piyasa.kaynaklar?.length || 0} sonuç bulundu`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Sonuç Bulunamadı',
          message: res.error || 'Bu ürün için piyasa fiyatı bulunamadı',
          color: 'yellow',
        });
      }
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Piyasa araştırması başarısız',
        color: 'red',
      });
    } finally {
      setAramaLoading(false);
    }
  }, [productName, urunId, aramaLoading, queryClient]);

  // ─── Otomatik araştırma ───────────────────────────────
  // Modal açıldığında: veri yoksa veya 7+ gün eskiyse otomatik tetikle
  useEffect(() => {
    // Ürün değişince ref'i reset et
    if (urunId !== lastSearchedUrunId.current) {
      autoSearchTriggered.current = false;
      lastSearchedUrunId.current = urunId;
    }
  }, [urunId]);

  useEffect(() => {
    if (!modalOpened || !productName || !urunId) return;
    if (rafFiyatLoading || aramaLoading) return;
    if (autoSearchTriggered.current) return;

    const enYeniTarih = rafFiyatlar[0]?.arastirma_tarihi;
    const eskiMi = !enYeniTarih || gunFarki(enYeniTarih) > 7;

    if (eskiMi) {
      // 500ms debounce - hızlı modal açıp kapamayı engelle
      const timer = setTimeout(() => {
        if (autoSearchTriggered.current) return;
        autoSearchTriggered.current = true;
        handlePiyasaArastir();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [modalOpened, productName, urunId, rafFiyatLoading, aramaLoading, rafFiyatlar, handlePiyasaArastir]);

  // ─── Hesaplamalar ─────────────────────────────────────
  const birimFiyatlar = rafFiyatlar
    .map((r) => Number(r.birim_fiyat || r.piyasa_fiyat_ort || 0))
    .filter((f) => f > 0);
  const minFiyat = birimFiyatlar.length > 0 ? Math.min(...birimFiyatlar) : 0;
  const maxFiyat = birimFiyatlar.length > 0 ? Math.max(...birimFiyatlar) : 0;
  const ortFiyat =
    birimFiyatlar.length > 0
      ? birimFiyatlar.reduce((a, b) => a + b, 0) / birimFiyatlar.length
      : 0;
  const enYeniTarih = rafFiyatlar[0]?.arastirma_tarihi;
  const birimTipi = rafFiyatlar.length > 0 ? parseBirimTipi(rafFiyatlar[0]) : 'kg';

  // Sıralı liste (birim fiyata göre artan)
  const sirali = [...rafFiyatlar]
    .filter((r) => Number(r.birim_fiyat || r.piyasa_fiyat_ort || 0) > 0)
    .sort(
      (a, b) =>
        Number(a.birim_fiyat || a.piyasa_fiyat_ort || 0) -
        Number(b.birim_fiyat || b.piyasa_fiyat_ort || 0)
    );

  const SHOW_LIMIT = 5;
  const goruntulenecek = expanded ? sirali : sirali.slice(0, SHOW_LIMIT);
  const kalanSayi = sirali.length - SHOW_LIMIT;

  // ─── Loading state ────────────────────────────────────
  if (rafFiyatLoading) {
    return <Skeleton height={100} radius="md" />;
  }

  // ─── Veri yok → araştırma butonu ─────────────────────
  if (rafFiyatlar.length === 0 && !aramaLoading) {
    return (
      <Paper p="md" withBorder radius="md">
        <Group gap="xs" mb="sm">
          <IconShoppingCart size={18} color="var(--mantine-color-dimmed)" />
          <Text fw={600} size="sm">
            Piyasa Fiyatları
          </Text>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          Bu ürün için henüz piyasa fiyatı yok.
          {aramaLoading
            ? ' Araştırılıyor...'
            : ' Camgöz.net üzerinden güncel fiyatlar çekilebilir.'}
        </Text>
        <Button
          variant="light"
          color="orange"
          size="sm"
          fullWidth
          loading={aramaLoading}
          leftSection={<IconSearch size={16} />}
          onClick={handlePiyasaArastir}
        >
          Piyasa Fiyatını Araştır
        </Button>
      </Paper>
    );
  }

  // ─── Araştırma devam ediyor (veri var ama yenileniyor) ─
  if (aramaLoading && rafFiyatlar.length === 0) {
    return (
      <Paper p="md" withBorder radius="md" bg="orange.0">
        <Group gap="xs" mb="sm">
          <IconShoppingCart size={18} color="var(--mantine-color-orange-7)" />
          <Text fw={600} size="sm">
            Piyasa Fiyatları
          </Text>
          <Badge size="xs" variant="light" color="orange">
            Araştırılıyor...
          </Badge>
        </Group>
        <Stack gap="xs">
          <Skeleton height={16} width="70%" />
          <Skeleton height={40} />
          <Skeleton height={30} />
          <Skeleton height={30} />
        </Stack>
      </Paper>
    );
  }

  // ─── Karşılaştırma hesaplaması ────────────────────────
  let fark: number | null = null;
  if (faturaFiyat > 0 && ortFiyat > 0) {
    fark = ((faturaFiyat - ortFiyat) / ortFiyat) * 100;
  }

  // ─── Ana render ───────────────────────────────────────
  return (
    <Paper p="md" withBorder radius="md" bg="orange.0">
      {/* Header */}
      <Group gap="xs" mb="sm" justify="space-between">
        <Group gap="xs">
          <IconShoppingCart size={18} color="var(--mantine-color-orange-7)" />
          <Text fw={600} size="sm">
            Piyasa Fiyatları
          </Text>
          <Badge size="xs" variant="light" color="orange">
            {sirali.length} sonuç
          </Badge>
        </Group>
        <Group gap={6}>
          {enYeniTarih && (
            <Text size="xs" c="dimmed">
              {relativeDate(enYeniTarih)}
            </Text>
          )}
          <ActionIcon
            variant="subtle"
            color="orange"
            size="sm"
            loading={aramaLoading}
            title="Piyasa fiyatlarını yenile"
            onClick={() => {
              autoSearchTriggered.current = true;
              handlePiyasaArastir();
            }}
          >
            <IconRefresh size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Karşılaştırma Barı */}
      {fark !== null && (
        <Paper p="xs" mb="sm" withBorder radius="sm" bg={fark < 0 ? 'green.0' : fark > 0 ? 'red.0' : 'gray.0'}>
          <Group gap="xs" justify="space-between" wrap="nowrap">
            <Group gap={6} wrap="nowrap">
              {fark < 0 ? (
                <IconTrendingDown size={16} color="var(--mantine-color-green-7)" />
              ) : fark > 0 ? (
                <IconTrendingUp size={16} color="var(--mantine-color-red-7)" />
              ) : (
                <IconTag size={16} />
              )}
              <Text size="xs" fw={500}>
                Faturanız:{' '}
                <Text span fw={700}>
                  ₺{faturaFiyat.toFixed(2)}/{birimTipi}
                </Text>
              </Text>
            </Group>
            <Text size="xs" fw={700} c={fark < 0 ? 'green.7' : fark > 0 ? 'red.7' : 'gray.7'}>
              {fark > 0 ? '+' : ''}
              {fark.toFixed(1)}% {fark < 0 ? 'daha uygun' : fark > 0 ? 'daha pahalı' : 'ortalamada'}
            </Text>
          </Group>
          {/* Mini progress bar - fatura vs piyasa */}
          <Progress.Root size="sm" mt={6} radius="xl">
            <Progress.Section
              value={Math.min(100, ortFiyat > 0 ? (Math.min(faturaFiyat, ortFiyat) / Math.max(faturaFiyat, ortFiyat)) * 100 : 50)}
              color={fark < 0 ? 'green' : 'red'}
            />
          </Progress.Root>
        </Paper>
      )}

      {/* Özet: Min / Ort / Max */}
      <Group gap="xs" mb="sm" justify="space-between">
        <Text size="xs" c="dimmed">
          <Text span fw={700} c="green.7">
            ₺{minFiyat.toFixed(2)}
          </Text>
          {' ~ '}
          <Text span fw={600} c="dimmed">
            ₺{ortFiyat.toFixed(2)}
          </Text>
          {' ~ '}
          <Text span fw={700} c="red.7">
            ₺{maxFiyat.toFixed(2)}
          </Text>
          <Text span c="dimmed">
            {' '}
            /{birimTipi}
          </Text>
        </Text>
      </Group>

      {/* Ürün Listesi - Düz, birim fiyata göre sıralı */}
      <Stack gap={4}>
        {goruntulenecek.map((rf) => {
          const fiyat = Number(rf.birim_fiyat || rf.piyasa_fiyat_ort || 0);
          const paketFiyat = Number(rf.piyasa_fiyat_ort || rf.birim_fiyat || 0);
          const isMin = fiyat > 0 && fiyat === minFiyat && birimFiyatlar.length > 1;
          const isMax = fiyat > 0 && fiyat === maxFiyat && birimFiyatlar.length > 1;
          const guncBilgi = guncellikBilgisi(rf.arastirma_tarihi);
          const GuncIkon = guncBilgi.ikon;
          const ambalaj = formatAmbalaj(rf.ambalaj_miktar);

          return (
            <Paper
              key={rf.id}
              p="xs"
              withBorder
              radius="sm"
              bg={isMin ? 'green.0' : isMax ? 'red.0' : 'white'}
              style={
                isMin
                  ? { borderColor: 'var(--mantine-color-green-4)' }
                  : isMax
                    ? { borderColor: 'var(--mantine-color-red-4)' }
                    : undefined
              }
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                {/* Sol: Birim fiyat (büyük) */}
                <Text
                  size="sm"
                  fw={700}
                  c={isMin ? 'green.7' : isMax ? 'red.7' : 'orange.7'}
                  style={{ minWidth: 80, fontVariantNumeric: 'tabular-nums' }}
                >
                  ₺{fiyat.toFixed(2)}
                  <Text span size="xs" fw={400} c="dimmed">
                    /{birimTipi}
                  </Text>
                </Text>

                {/* Orta: Ürün bilgisi */}
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={4} wrap="nowrap">
                    {rf.marka && (
                      <Badge size="xs" variant="filled" color="dark" radius="sm" style={{ flexShrink: 0 }}>
                        {rf.marka}
                      </Badge>
                    )}
                    <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                      {rf.marka
                        ? (rf.urun_adi || '').replace(new RegExp(`^${rf.marka}\\s*`, 'i'), '')
                        : rf.urun_adi || 'Ürün'}
                    </Text>
                  </Group>
                  <Group gap={4} mt={2}>
                    <Badge size="xs" variant="light" color="blue" radius="sm">
                      {rf.market_adi || 'Piyasa'}
                    </Badge>
                    {ambalaj && (
                      <Badge size="xs" variant="outline" color="gray" radius="sm">
                        {ambalaj}
                      </Badge>
                    )}
                    {paketFiyat > 0 && paketFiyat !== fiyat && (
                      <Tooltip label={`Paket fiyatı: ₺${paketFiyat.toFixed(2)}`}>
                        <Text size="xs" c="dimmed" style={{ cursor: 'help' }}>
                          Paket: ₺{paketFiyat.toFixed(2)}
                        </Text>
                      </Tooltip>
                    )}
                  </Group>
                </Box>

                {/* Sağ: Güncellik */}
                <Tooltip label={`Araştırma: ${relativeDate(rf.arastirma_tarihi)}`}>
                  <Box>
                    <GuncIkon size={14} color={`var(--mantine-color-${guncBilgi.renk}-6)`} />
                  </Box>
                </Tooltip>
              </Group>
            </Paper>
          );
        })}
      </Stack>

      {/* Daha fazla göster */}
      {kalanSayi > 0 && (
        <Button
          variant="subtle"
          color="orange"
          size="xs"
          fullWidth
          mt={4}
          rightSection={
            <IconChevronDown
              size={14}
              style={{
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 200ms',
              }}
            />
          }
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Daha az göster' : `${kalanSayi} sonuç daha`}
        </Button>
      )}
    </Paper>
  );
}
