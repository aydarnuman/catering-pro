'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Progress,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconRefresh, IconSearch, IconShoppingCart } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { faturaKalemleriAPI, type RafFiyatSonuc } from '@/lib/api/services/fatura-kalemleri';

// ─── TYPES ────────────────────────────────────────────────

interface FiyatOzetProp {
  birim_fiyat_ekonomik: number | null;
  birim_fiyat_min: number | null;
  birim_fiyat_max: number | null;
  birim_fiyat_medyan: number | null;
  birim_tipi: string | null;
  confidence: number | null;
  kaynak_sayisi: number | null;
  kaynak_tip: string | null;
  varyant_fiyat_dahil: boolean;
  son_guncelleme: string | null;
}

interface PiyasaFiyatlariSectionProps {
  rafFiyatlar: RafFiyatSonuc[];
  rafFiyatLoading: boolean;
  productName: string | undefined;
  urunId: number | undefined;
  faturaFiyat: number; // birim fiyat (TL/kg veya TL/L)
  modalOpened: boolean;
  /** IQR temizli fiyat özeti (varsa ham hesaplama yerine kullanılır) */
  fiyatOzet?: FiyatOzetProp | null;
}

// ─── HELPERS ──────────────────────────────────────────────

/** Araştırma tarihinden kaç gün geçtiğini hesapla */
function gunFarki(tarih: string | null | undefined): number {
  if (!tarih) return 999;
  return Math.floor((Date.now() - new Date(tarih).getTime()) / (1000 * 60 * 60 * 24));
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

/** birimTipi'ni kaynaklar JSON'dan parse et ve normalize et */
function parseBirimTipi(rf: RafFiyatSonuc): string {
  try {
    const k = rf.kaynaklar as unknown;
    if (k && typeof k === 'object' && !Array.isArray(k) && 'birimTipi' in (k as Record<string, unknown>)) {
      const raw = ((k as Record<string, string>).birimTipi || 'kg').toLowerCase();
      // Normalize: lt/litre → L, kg/kilo → kg, adet/ad → adet
      if (['lt', 'litre', 'l'].includes(raw)) return 'L';
      if (['kg', 'kilo'].includes(raw)) return 'kg';
      if (['adet', 'ad'].includes(raw)) return 'adet';
      return raw;
    }
  } catch {
    /* ignore */
  }
  return 'kg';
}

/** Kaynak tipini kaynaklar JSON'dan parse et */
function parseKaynakTip(rf: RafFiyatSonuc): 'market' | 'toptanci_hal' | 'web_arama' {
  try {
    const k = rf.kaynaklar as unknown;
    if (k && typeof k === 'object' && !Array.isArray(k) && 'kaynakTip' in (k as Record<string, unknown>)) {
      const tip = (k as Record<string, string>).kaynakTip;
      if (tip === 'toptanci_hal' || tip === 'web_arama') return tip;
    }
  } catch {
    /* ignore */
  }
  return 'market';
}

/** Kaynak tipi label ve renk */
function kaynakTipLabel(tip: 'market' | 'toptanci_hal' | 'web_arama'): {
  label: string;
  color: string;
} {
  switch (tip) {
    case 'toptanci_hal':
      return { label: 'Hal.gov.tr (Toptancı)', color: 'teal' };
    case 'web_arama':
      return { label: 'Web Arama (Tahmini)', color: 'yellow' };
    default:
      return { label: 'Market (Camgöz)', color: 'orange' };
  }
}

/** Ambalaj bilgisini okunabilir formata dönüştür */
function formatAmbalaj(miktar: string | number | null | undefined, birimTipi: string): string | null {
  if (!miktar) return null;
  const n = Number(miktar);
  if (!n || n <= 0) return null;
  const birim = birimTipi === 'L' ? 'L' : 'kg';
  if (n >= 1) return `${n}${birim}`;
  if (birim === 'kg') return `${Math.round(n * 1000)}gr`;
  return `${Math.round(n * 1000)}ml`;
}

/** Ürün adından marka kısmını çıkar */
function temizUrunAdi(urunAdi: string | null | undefined, marka: string | null | undefined): string {
  if (!urunAdi) return 'Ürün';
  if (!marka) return urunAdi;
  // Marka adını baştan temizle
  const markaRegex = new RegExp(`^${marka.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
  return urunAdi.replace(markaRegex, '').trim() || urunAdi;
}

// Marka bazlı gruplama tipi
interface MarkaGrubu {
  marka: string;
  urunler: RafFiyatSonuc[];
  minFiyat: number;
  maxFiyat: number;
  ortFiyat: number;
  marketSayisi: number;
}

// ─── COMPONENT ────────────────────────────────────────────

export function PiyasaFiyatlariSection({
  rafFiyatlar,
  rafFiyatLoading,
  productName,
  urunId,
  faturaFiyat,
  modalOpened,
  fiyatOzet,
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
          title: 'Piyasa Güncellendi',
          message: `${res.piyasa.kaynaklar?.length || 0} market fiyatı bulundu`,
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
  useEffect(() => {
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
      const timer = setTimeout(() => {
        if (autoSearchTriggered.current) return;
        autoSearchTriggered.current = true;
        handlePiyasaArastir();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [modalOpened, productName, urunId, rafFiyatLoading, aramaLoading, rafFiyatlar, handlePiyasaArastir]);

  // ─── Hesaplamalar (özet varsa IQR temizli, yoksa ham) ──
  const birimFiyatlar = rafFiyatlar.map((r) => Number(r.birim_fiyat || r.piyasa_fiyat_ort || 0)).filter((f) => f > 0);

  // Özet tablodan IQR temizli değerler (varsa)
  const minFiyat = fiyatOzet?.birim_fiyat_min
    ? Number(fiyatOzet.birim_fiyat_min)
    : birimFiyatlar.length > 0
      ? Math.min(...birimFiyatlar)
      : 0;
  const maxFiyat = fiyatOzet?.birim_fiyat_max
    ? Number(fiyatOzet.birim_fiyat_max)
    : birimFiyatlar.length > 0
      ? Math.max(...birimFiyatlar)
      : 0;
  const ortFiyat = fiyatOzet?.birim_fiyat_ekonomik
    ? Number(fiyatOzet.birim_fiyat_ekonomik)
    : birimFiyatlar.length > 0
      ? birimFiyatlar.reduce((a, b) => a + b, 0) / birimFiyatlar.length
      : 0;
  const enYeniTarih = fiyatOzet?.son_guncelleme || rafFiyatlar[0]?.arastirma_tarihi;
  const birimTipi = fiyatOzet?.birim_tipi || (rafFiyatlar.length > 0 ? parseBirimTipi(rafFiyatlar[0]) : 'kg');
  const confidence = fiyatOzet?.confidence ? Number(fiyatOzet.confidence) : null;

  // Sıralı liste (birim fiyata göre artan)
  const sirali = [...rafFiyatlar]
    .filter((r) => Number(r.birim_fiyat || r.piyasa_fiyat_ort || 0) > 0)
    .sort(
      (a, b) => Number(a.birim_fiyat || a.piyasa_fiyat_ort || 0) - Number(b.birim_fiyat || b.piyasa_fiyat_ort || 0)
    );

  // Marka bazlı gruplama
  const markaGruplari: MarkaGrubu[] = (() => {
    const grupMap = new Map<string, RafFiyatSonuc[]>();
    for (const rf of sirali) {
      const marka = rf.marka || 'Diğer';
      const existing = grupMap.get(marka);
      if (existing) {
        existing.push(rf);
      } else {
        grupMap.set(marka, [rf]);
      }
    }
    return Array.from(grupMap.entries())
      .map(([marka, urunler]) => {
        const fiyatlar = urunler.map((u) => Number(u.birim_fiyat || u.piyasa_fiyat_ort || 0)).filter((f) => f > 0);
        return {
          marka,
          urunler,
          minFiyat: fiyatlar.length > 0 ? Math.min(...fiyatlar) : 0,
          maxFiyat: fiyatlar.length > 0 ? Math.max(...fiyatlar) : 0,
          ortFiyat: fiyatlar.length > 0 ? fiyatlar.reduce((a, b) => a + b, 0) / fiyatlar.length : 0,
          marketSayisi: new Set(urunler.map((u) => u.market_adi).filter(Boolean)).size,
        };
      })
      .sort((a, b) => a.minFiyat - b.minFiyat);
  })();

  const SHOW_LIMIT = 8;
  const goruntulenecek = expanded ? sirali : sirali.slice(0, SHOW_LIMIT);
  const kalanSayi = sirali.length - SHOW_LIMIT;

  // Benzersiz market sayısı
  const benzersizMarketler = new Set(sirali.map((r) => r.market_adi).filter(Boolean));

  // Kaynak tipleri (hangi veri kaynaklarından geldiğini göstermek için)
  const kaynakTipleri = [...new Set(sirali.map((r) => parseKaynakTip(r)))] as Array<
    'market' | 'toptanci_hal' | 'web_arama'
  >;

  // ─── Loading state ────────────────────────────────────
  if (rafFiyatLoading) {
    return <Skeleton height={100} radius="md" />;
  }

  // ─── Veri yok → araştırma butonu ─────────────────────
  if (rafFiyatlar.length === 0 && !aramaLoading) {
    return (
      <Box
        p="md"
        style={{
          borderRadius: 'var(--mantine-radius-md)',
          background: 'var(--mantine-color-dark-7)',
          border: '1px solid var(--mantine-color-dark-4)',
        }}
      >
        <Group gap="xs" mb="sm">
          <IconShoppingCart size={16} color="var(--mantine-color-dimmed)" />
          <Text fw={600} size="sm">
            Piyasa Fiyatları
          </Text>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          Bu ürün için henüz piyasa fiyatı yok.
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
      </Box>
    );
  }

  // ─── Araştırma devam ediyor ─────────────────────────
  if (aramaLoading && rafFiyatlar.length === 0) {
    return (
      <Box
        p="md"
        style={{
          borderRadius: 'var(--mantine-radius-md)',
          background: 'var(--mantine-color-dark-7)',
          border: '1px solid var(--mantine-color-dark-4)',
        }}
      >
        <Group gap="xs" mb="sm">
          <IconShoppingCart size={16} color="var(--mantine-color-dimmed)" />
          <Text fw={600} size="sm">
            Piyasa Fiyatları
          </Text>
          <Text size="xs" c="dimmed">
            Araştırılıyor...
          </Text>
        </Group>
        <Stack gap="xs">
          <Skeleton height={16} width="70%" />
          <Skeleton height={40} />
          <Skeleton height={30} />
          <Skeleton height={30} />
        </Stack>
      </Box>
    );
  }

  // ─── Karşılaştırma hesaplaması ────────────────────────
  let fark: number | null = null;
  if (faturaFiyat > 0 && ortFiyat > 0) {
    fark = ((faturaFiyat - ortFiyat) / ortFiyat) * 100;
  }

  // ─── Ana render ───────────────────────────────────────
  return (
    <Box
      p="md"
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        background: 'var(--mantine-color-dark-7)',
        border: '1px solid var(--mantine-color-dark-4)',
      }}
    >
      {/* ── Header ── */}
      <Group gap="xs" mb="sm" justify="space-between">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="orange" radius="xl">
            <IconShoppingCart size={14} />
          </ThemeIcon>
          <Text fw={600} size="sm">
            Piyasa Fiyatları
          </Text>
          <Text size="xs" c="dimmed">
            {sirali.length} fiyat · {benzersizMarketler.size} market
          </Text>
        </Group>
        <Group gap={6}>
          {enYeniTarih && (
            <Text size="xs" c="dimmed">
              {relativeDate(enYeniTarih)}
            </Text>
          )}
          <Tooltip label="Fiyatları yenile">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              loading={aramaLoading}
              onClick={() => {
                autoSearchTriggered.current = true;
                handlePiyasaArastir();
              }}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* ── Fatura vs Piyasa Karşılaştırma ── */}
      {fark !== null && (
        <Box
          p="sm"
          mb="sm"
          style={{
            borderRadius: 'var(--mantine-radius-sm)',
            background: 'var(--mantine-color-dark-6)',
          }}
        >
          <Group gap="xs" justify="space-between" wrap="nowrap">
            <Box>
              <Text size="xs" c="dimmed" lh={1}>
                Fatura Fiyatı
              </Text>
              <Text size="sm" fw={700}>
                ₺{faturaFiyat.toFixed(2)}
                <Text span size="xs" fw={400} c="dimmed">
                  /{birimTipi}
                </Text>
              </Text>
            </Box>
            <Box ta="center">
              <Badge size="md" variant="light" color={fark < -5 ? 'green' : fark > 5 ? 'red' : 'gray'} radius="sm">
                {fark > 0 ? '+' : ''}
                {fark.toFixed(0)}%
              </Badge>
            </Box>
            <Box ta="right">
              <Text size="xs" c="dimmed" lh={1}>
                Piyasa Ort.
              </Text>
              <Text size="sm" fw={700} c="orange">
                ₺{ortFiyat.toFixed(2)}
                <Text span size="xs" fw={400} c="dimmed">
                  /{birimTipi}
                </Text>
              </Text>
            </Box>
          </Group>
          <Progress.Root size={4} mt={8} radius="xl">
            <Progress.Section
              value={Math.min(
                100,
                ortFiyat > 0 ? (Math.min(faturaFiyat, ortFiyat) / Math.max(faturaFiyat, ortFiyat)) * 100 : 50
              )}
              color={fark < -5 ? 'green' : fark > 5 ? 'red' : 'gray'}
            />
          </Progress.Root>
        </Box>
      )}

      {/* ── Özet: Min / Ort / Max ── */}
      <Box
        p="xs"
        mb="sm"
        style={{
          borderRadius: 'var(--mantine-radius-sm)',
          background: 'var(--mantine-color-dark-6)',
        }}
      >
        <Group gap="xs" justify="space-between">
          <Text size="xs" fw={600} c="green" style={{ fontVariantNumeric: 'tabular-nums' }}>
            ₺{minFiyat.toFixed(2)}
          </Text>
          <Text size="xs" fw={500} c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
            ₺{ortFiyat.toFixed(2)}
          </Text>
          <Text size="xs" fw={600} c="red" style={{ fontVariantNumeric: 'tabular-nums' }}>
            ₺{maxFiyat.toFixed(2)}
          </Text>
        </Group>
        <Progress.Root size={3} mt={4} radius="xl">
          <Progress.Section value={33} color="green.8" />
          <Progress.Section value={34} color="dark.3" />
          <Progress.Section value={33} color="red.8" />
        </Progress.Root>
        <Group gap={4} justify="center" mt={2}>
          <Text size="xs" c="dimmed">
            {birimTipi} basina fiyat araligi
          </Text>
          {confidence !== null && (
            <Tooltip
              label={`Güvenilirlik: %${Math.round(confidence * 100)} (kaynak çeşitliliği + fiyat tutarlılığı + güncellik)`}
            >
              <Badge
                size="xs"
                variant="light"
                color={confidence >= 0.7 ? 'green' : confidence >= 0.4 ? 'yellow' : 'red'}
                radius="sm"
              >
                {confidence >= 0.7 ? 'Güvenilir' : confidence >= 0.4 ? 'Orta' : 'Düşük'}
              </Badge>
            </Tooltip>
          )}
        </Group>
      </Box>

      {/* ── Marka özet şeridi ── */}
      {markaGruplari.length > 1 && (
        <Group gap={4} mb="sm" style={{ flexWrap: 'wrap' }}>
          {markaGruplari.slice(0, 6).map((g) => (
            <Tooltip
              key={g.marka}
              label={`${g.marka}: ₺${g.minFiyat.toFixed(0)}${g.minFiyat !== g.maxFiyat ? ` - ₺${g.maxFiyat.toFixed(0)}` : ''}/${birimTipi} (${g.urunler.length} sonuç)`}
            >
              <Badge size="xs" variant="light" color="gray" radius="sm" style={{ cursor: 'default' }}>
                {g.marka} ₺{g.ortFiyat.toFixed(0)}
              </Badge>
            </Tooltip>
          ))}
        </Group>
      )}

      {/* ── Ürün Listesi ── */}
      <Stack gap={2}>
        {goruntulenecek.map((rf) => {
          const fiyat = Number(rf.birim_fiyat || rf.piyasa_fiyat_ort || 0);
          const paketFiyat = Number(rf.piyasa_fiyat_ort || rf.birim_fiyat || 0);
          const isMin = fiyat > 0 && fiyat === minFiyat && birimFiyatlar.length > 1;
          const isMax = fiyat > 0 && fiyat === maxFiyat && birimFiyatlar.length > 1;
          const ambalaj = formatAmbalaj(rf.ambalaj_miktar, birimTipi);
          const cleanName = temizUrunAdi(rf.urun_adi, rf.marka);
          const rfKaynakTip = parseKaynakTip(rf);

          return (
            <Box
              key={rf.id}
              px="xs"
              py={6}
              style={{
                borderRadius: 'var(--mantine-radius-sm)',
                background: 'var(--mantine-color-dark-6)',
                borderLeft: isMin
                  ? '3px solid var(--mantine-color-green-6)'
                  : isMax
                    ? '3px solid var(--mantine-color-red-6)'
                    : '3px solid transparent',
              }}
            >
              <Group justify="space-between" wrap="nowrap" gap={6}>
                {/* Sol: Birim fiyat */}
                <Text
                  size="sm"
                  fw={700}
                  c={isMin ? 'green' : isMax ? 'red' : undefined}
                  style={{ minWidth: 72, fontVariantNumeric: 'tabular-nums' }}
                >
                  ₺{fiyat.toFixed(2)}
                  <Text span size="xs" fw={400} c="dimmed">
                    /{birimTipi}
                  </Text>
                </Text>

                {/* Orta: Ürün bilgisi */}
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={4} wrap="nowrap">
                    {rf.marka && rf.marka !== 'Diğer' && (
                      <Text size="xs" c="dimmed" fw={500} style={{ flexShrink: 0 }}>
                        {rf.marka}
                      </Text>
                    )}
                    <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                      {cleanName}
                    </Text>
                  </Group>
                  <Group gap={4} mt={1} wrap="nowrap">
                    {rf.market_adi && rf.market_adi !== 'Piyasa' && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {rf.market_adi}
                        {ambalaj ? ` · ${ambalaj}` : ''}
                        {paketFiyat > 0 && paketFiyat !== fiyat ? ` · Paket ₺${paketFiyat.toFixed(2)}` : ''}
                      </Text>
                    )}
                    {rfKaynakTip !== 'market' && (
                      <Badge
                        size="xs"
                        variant="light"
                        color={rfKaynakTip === 'toptanci_hal' ? 'teal' : 'yellow'}
                        style={{ flexShrink: 0 }}
                      >
                        {rfKaynakTip === 'toptanci_hal' ? 'Hal' : 'Web'}
                      </Badge>
                    )}
                  </Group>
                </Box>
              </Group>
            </Box>
          );
        })}
      </Stack>

      {/* ── Daha fazla göster ── */}
      {kalanSayi > 0 && (
        <Button
          variant="subtle"
          color="gray"
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

      {/* ── Kaynak bilgisi ── */}
      <Group gap={4} justify="center" mt="xs">
        {kaynakTipleri.map((tip) => {
          const { label, color } = kaynakTipLabel(tip);
          return (
            <Badge key={tip} size="xs" variant="dot" color={color}>
              {label}
            </Badge>
          );
        })}
        {benzersizMarketler.size > 0 && (
          <Text size="xs" c="dimmed">
            · {benzersizMarketler.size} kaynak
          </Text>
        )}
      </Group>
    </Box>
  );
}
