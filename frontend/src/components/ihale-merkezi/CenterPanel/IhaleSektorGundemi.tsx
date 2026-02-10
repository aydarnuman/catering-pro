'use client';

/**
 * İhale Merkezi Sektör Gündemi
 * ────────────────────────────
 * İhale seçilmediğinde CenterPanel'de gösterilir.
 * Yeni hibrit pipeline: Tavily + DB + Claude AI
 *
 * 5 kategori: İhale Duyuruları, KİK Kararları, Zeyilname, Mevzuat, Sektör Haberleri
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
  IconBell,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconFileAlert,
  IconGavel,
  IconLeaf,
  IconNewSection,
  IconRefresh,
  IconTrendingUp,
} from '@tabler/icons-react';
import { type GundemKonu, useSektorGundem } from '@/hooks/useSektorGundem';

// ─── Kategori meta ───────────────────────────────────────

const KONU_META: Record<string, { icon: React.ReactNode; color: string }> = {
  ihale_duyuru: { icon: <IconBell size={16} />, color: 'cyan' },
  kik_karar: { icon: <IconGavel size={16} />, color: 'orange' },
  zeyilname: { icon: <IconNewSection size={16} />, color: 'yellow' },
  mevzuat: { icon: <IconLeaf size={16} />, color: 'green' },
  sektor_haber: { icon: <IconTrendingUp size={16} />, color: 'blue' },
};

// ─── Component ───────────────────────────────────────────

export function IhaleSektorGundemi() {
  const { data, isLoading, refetch, isFetching } = useSektorGundem('ihale');
  const [expanded, { toggle }] = useDisclosure(true);

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

  const toplamHaber = data?.konular?.reduce((sum, k) => sum + (k.haberler?.length || 0), 0) || 0;

  // ─── Loading ─────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <Paper p="md" withBorder radius="md" bg="rgba(59, 130, 246, 0.02)">
        <Group justify="space-between" mb="sm">
          <Skeleton height={20} width={200} />
          <Skeleton height={20} width={80} />
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={120} radius="md" />
          ))}
        </SimpleGrid>
      </Paper>
    );
  }

  // Veri yoksa minimal göster
  if (!data || !data.konular?.length) {
    return (
      <Paper p="sm" withBorder radius="md" bg="rgba(255, 255, 255, 0.02)">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="blue" radius="xl">
              <IconTrendingUp size={14} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Sektör gündemi yükleniyor...
            </Text>
          </Group>
          <ActionIcon size="xs" variant="subtle" onClick={() => refetch()} loading={isFetching}>
            <IconRefresh size={14} />
          </ActionIcon>
        </Group>
      </Paper>
    );
  }

  // ─── Render ──────────────────────────────────────────

  return (
    <Paper p="md" withBorder radius="md" bg="rgba(59, 130, 246, 0.02)">
      {/* Header */}
      <Group justify="space-between" mb={expanded ? 'sm' : 0}>
        <Group gap="xs" style={{ cursor: 'pointer' }} onClick={toggle}>
          <ThemeIcon size="sm" variant="light" color="blue" radius="xl">
            <IconTrendingUp size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Sektör Gündemi
          </Text>
          <Badge size="xs" variant="light" color="blue">
            {toplamHaber} haber
          </Badge>
          {data.kaynak === 'cache' && data.guncelleme && (
            <Text size="xs" c="dimmed">
              {timeAgo(data.guncelleme)}
            </Text>
          )}
          {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </Group>

        <Group gap={4}>
          {data.kaynak && (
            <Badge size="xs" variant="dot" color={data.kaynak === 'canli' ? 'green' : 'gray'}>
              {data.kaynak === 'canli' ? 'Canlı' : 'Önbellek'}
            </Badge>
          )}
          <Tooltip label="Yenile (canlı çek)">
            <ActionIcon size="xs" variant="subtle" loading={isFetching} onClick={() => refetch()}>
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Content */}
      <Collapse in={expanded}>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {data.konular.map((konu: GundemKonu) => (
            <KonuKart key={konu.konu} konu={konu} />
          ))}
        </SimpleGrid>
      </Collapse>
    </Paper>
  );
}

// ─── Alt component: Konu Kartı ───────────────────────────

function KonuKart({ konu }: { konu: GundemKonu }) {
  const meta = KONU_META[konu.konu] || { icon: <IconFileAlert size={16} />, color: 'gray' };
  const ozet = konu.ai_ozet || konu.ozet; // backward compat

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      style={{ borderColor: `var(--mantine-color-${meta.color}-3)`, borderWidth: 1 }}
    >
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color={meta.color} radius="xl">
          {meta.icon}
        </ThemeIcon>
        <Text size="xs" fw={600} style={{ flex: 1 }}>
          {konu.baslik}
        </Text>
        <Group gap={4}>
          <Badge size="xs" variant="dot" color={meta.color}>
            {konu.haberler?.length || 0}
          </Badge>
          {konu.kaynaklar && konu.kaynaklar.db > 0 && (
            <Badge size="xs" variant="outline" color="teal">
              +{konu.kaynaklar.db} DB
            </Badge>
          )}
        </Group>
      </Group>

      {/* AI Özet */}
      {ozet && (
        <Text size="xs" c="dimmed" mb="xs" lineClamp={3}>
          {ozet}
        </Text>
      )}

      {/* Haber listesi */}
      <Stack gap={4}>
        {konu.haberler?.slice(0, 4).map((haber, idx) => (
          <Box
            key={`${konu.konu}-${idx}`}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}
          >
            {haber.kaynak_tipi && (
              <Badge
                size="xs"
                variant="outline"
                color={
                  haber.kaynak_tipi === 'db' || haber.kaynak_tipi === 'ihalebul' ? 'teal' : 'blue'
                }
                style={{ flexShrink: 0, fontSize: 9, padding: '0 4px' }}
              >
                {haber.kaynak_tipi === 'ihalebul'
                  ? 'İB'
                  : haber.kaynak_tipi === 'db'
                    ? 'DB'
                    : 'Web'}
              </Badge>
            )}
            {haber.url ? (
              <Anchor
                href={haber.url}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                size="xs"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flex: 1 }}
              >
                <IconExternalLink size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                <Text size="xs" lineClamp={2} inherit>
                  {haber.baslik}
                </Text>
              </Anchor>
            ) : (
              <Text size="xs" lineClamp={2} style={{ flex: 1 }}>
                {haber.baslik}
              </Text>
            )}
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
