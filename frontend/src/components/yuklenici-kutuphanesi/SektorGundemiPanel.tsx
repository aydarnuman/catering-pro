'use client';

/**
 * Sektör Gündem Paneli
 * ──────────────────────
 * Tavily API ile çekilen canlı sektör haberlerini gösterir.
 * KIK duyuruları, gıda mevzuatı, fiyat trendleri.
 *
 * Kullanım:
 *   <SektorGundemiPanel />               — tam panel (yüklenici kütüphanesi)
 *   <SektorGundemiPanel compact />        — kompakt mod (widget / sidebar)
 */

import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Collapse,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconGavel,
  IconLeaf,
  IconRefresh,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';

// ─── Types ──────────────────────────────────────────────

interface Haber {
  baslik: string;
  url: string;
  ozet?: string;
  tarih?: string;
}

interface GundemKonu {
  konu: string;
  baslik: string;
  ozet?: string;
  haberler: Haber[];
}

interface GundemData {
  success: boolean;
  kaynak: string;
  guncelleme?: string;
  konular: GundemKonu[];
  uyari?: string;
}

// ─── Konu meta ──────────────────────────────────────────

const KONU_META: Record<string, { icon: React.ReactNode; color: string }> = {
  kik_ihale: { icon: <IconGavel size={16} />, color: 'orange' },
  gida_mevzuat: { icon: <IconLeaf size={16} />, color: 'green' },
  gida_fiyat_trend: { icon: <IconTrendingUp size={16} />, color: 'blue' },
};

// ─── Component ──────────────────────────────────────────

interface SektorGundemiPanelProps {
  compact?: boolean;
  maxHaber?: number;
}

export function SektorGundemiPanel({ compact = false, maxHaber = 3 }: SektorGundemiPanelProps) {
  const [data, setData] = useState<GundemData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, { toggle }] = useDisclosure(!compact);

  const fetchGundem = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = getApiUrl(`/api/mevzuat/gundem${refresh ? '?refresh=1' : ''}`);
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: GundemData = await res.json();
      if (!json.success) throw new Error(json.uyari || 'Veri alınamadı');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGundem();
  }, [fetchGundem]);

  // Güncelleme zamanını "X saat önce" formatına çevir
  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    return `${Math.floor(hours / 24)} gün önce`;
  };

  // ─── Loading skeleton ─────────────────────────────────

  if (loading && !data) {
    return (
      <Paper p="md" withBorder radius="md">
        <Group justify="space-between" mb="sm">
          <Skeleton height={20} width={160} />
          <Skeleton height={20} width={80} />
        </Group>
        <SimpleGrid cols={compact ? 1 : 3} spacing="sm">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={compact ? 60 : 120} radius="md" />
          ))}
        </SimpleGrid>
      </Paper>
    );
  }

  // ─── Error state ──────────────────────────────────────

  if (error && !data) {
    return (
      <Paper p="sm" withBorder radius="md" bg="rgba(255, 107, 107, 0.05)">
        <Group justify="space-between">
          <Text size="xs" c="red.5">
            Sektör gündemi yüklenemedi: {error}
          </Text>
          <ActionIcon size="xs" variant="subtle" onClick={() => fetchGundem()}>
            <IconRefresh size={14} />
          </ActionIcon>
        </Group>
      </Paper>
    );
  }

  if (!data || data.konular.length === 0) return null;

  // ─── Render ───────────────────────────────────────────

  return (
    <Paper p="md" withBorder radius="md" bg="rgba(59, 130, 246, 0.02)">
      {/* Header */}
      <Group justify="space-between" mb={expanded ? 'sm' : 0}>
        <Group
          gap="xs"
          style={{ cursor: 'pointer' }}
          onClick={toggle}
        >
          <Text size="sm" fw={600}>
            Sektör Gündemi
          </Text>
          <Badge size="xs" variant="light" color="blue">
            {data.konular.reduce((sum, k) => sum + k.haberler.length, 0)} haber
          </Badge>
          {data.kaynak === 'cache' && data.guncelleme && (
            <Text size="xs" c="dimmed">
              {timeAgo(data.guncelleme)}
            </Text>
          )}
          {compact && (expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />)}
        </Group>

        <Group gap={4}>
          <Tooltip label="Yenile">
            <ActionIcon
              size="xs"
              variant="subtle"
              loading={loading}
              onClick={() => fetchGundem(true)}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Content */}
      <Collapse in={expanded}>
        <SimpleGrid cols={compact ? 1 : { base: 1, sm: 2, md: 3 }} spacing="sm">
          {data.konular.map((konu) => {
            const meta = KONU_META[konu.konu] || { icon: <IconTrendingUp size={16} />, color: 'gray' };
            return (
              <Paper
                key={konu.konu}
                p="sm"
                withBorder
                radius="md"
                style={{ borderColor: `var(--mantine-color-${meta.color}-3)`, borderWidth: 1 }}
              >
                <Group gap="xs" mb="xs">
                  <ThemeIcon size="sm" variant="light" color={meta.color} radius="xl">
                    {meta.icon}
                  </ThemeIcon>
                  <Text size="xs" fw={600}>
                    {konu.baslik}
                  </Text>
                  <Badge size="xs" variant="dot" color={meta.color}>
                    {konu.haberler.length}
                  </Badge>
                </Group>

                {/* AI Özet */}
                {konu.ozet && !compact && (
                  <Text size="xs" c="dimmed" mb="xs" lineClamp={2}>
                    {konu.ozet}
                  </Text>
                )}

                {/* Haber listesi */}
                <Stack gap={4}>
                  {konu.haberler.slice(0, maxHaber).map((haber, idx) => (
                    <Anchor
                      key={`${konu.konu}-${idx}`}
                      href={haber.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      size="xs"
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}
                    >
                      <IconExternalLink
                        size={12}
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <Box style={{ flex: 1 }}>
                        <Text size="xs" lineClamp={2} inherit>
                          {haber.baslik}
                        </Text>
                      </Box>
                    </Anchor>
                  ))}
                </Stack>
              </Paper>
            );
          })}
        </SimpleGrid>
      </Collapse>
    </Paper>
  );
}
