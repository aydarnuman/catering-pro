'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBuilding,
  IconChevronDown,
  IconChevronUp,
  IconCurrencyLira,
  IconExternalLink,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconShield,
  IconTarget,
  IconTrendingUp,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useRakipAnalizi } from '@/hooks/useRakipAnalizi';
import type { Rakip, RakipGecmis } from '@/lib/api/services/tenders';

interface RakipAnaliziProps {
  tenderId: number | null;
}

// Katman config
const KATMAN_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof IconTarget }
> = {
  kesin: { label: 'Kesin Rakip', color: 'red', icon: IconTarget },
  kuvvetli: { label: 'Kuvvetli Aday', color: 'orange', icon: IconTrendingUp },
  sehir: { label: 'Bölgede Aktif', color: 'blue', icon: IconMapPin },
  web_kesfedildi: { label: 'Web Keşfi', color: 'grape', icon: IconSearch },
  web_yeni: { label: 'Yeni Keşif', color: 'teal', icon: IconUserPlus },
};

function RakipKarti({ rakip }: { rakip: Rakip }) {
  const [expanded, setExpanded] = useState(false);
  const config = KATMAN_CONFIG[rakip.katman] || KATMAN_CONFIG.sehir;
  const Icon = config.icon;

  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      style={{
        borderLeft: `3px solid var(--mantine-color-${config.color}-6)`,
        background: `linear-gradient(135deg, rgba(var(--mantine-color-${config.color}-light-color), 0.03), transparent)`,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <ThemeIcon size="sm" variant="light" color={config.color} radius="xl" style={{ flexShrink: 0 }}>
            <Icon size={12} />
          </ThemeIcon>
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Group gap={4} wrap="nowrap">
              <Text size="sm" fw={600} truncate="end">
                {rakip.unvan}
              </Text>
              {rakip.takipte && (
                <Badge size="xs" variant="dot" color="green" style={{ flexShrink: 0 }}>
                  Takipte
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {rakip.neden}
            </Text>
          </Box>
        </Group>

        <Group gap={4} style={{ flexShrink: 0 }}>
          {rakip.ihalebul_url && (
            <Tooltip label="ihalebul.com profili">
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                component="a"
                href={rakip.ihalebul_url}
                target="_blank"
              >
                <IconExternalLink size={12} />
              </ActionIcon>
            </Tooltip>
          )}
          {rakip.gecmis?.length > 0 && (
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setExpanded(!expanded)}>
              {expanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
            </ActionIcon>
          )}
        </Group>
      </Group>

      {/* İstatistikler */}
      {(rakip.kazanma_orani != null || rakip.ortalama_indirim_orani != null || rakip.katildigi_ihale_sayisi != null) && (
        <Group gap="xs" mt={6} wrap="wrap">
          {rakip.katildigi_ihale_sayisi != null && (
            <Badge variant="light" color="gray" size="xs" leftSection={<IconUsers size={9} />}>
              {rakip.katildigi_ihale_sayisi} ihale
            </Badge>
          )}
          {rakip.kazanma_orani != null && (
            <Badge
              variant="light"
              color={rakip.kazanma_orani >= 50 ? 'red' : 'gray'}
              size="xs"
              leftSection={<IconShield size={9} />}
            >
              %{rakip.kazanma_orani.toFixed(0)} kazanma
            </Badge>
          )}
          {rakip.ortalama_indirim_orani != null && (
            <Badge variant="light" color="green" size="xs" leftSection={<IconCurrencyLira size={9} />}>
              %{rakip.ortalama_indirim_orani.toFixed(1)} ort. indirim
            </Badge>
          )}
          {rakip.devam_eden_is != null && rakip.devam_eden_is > 0 && (
            <Badge variant="light" color="blue" size="xs" leftSection={<IconBuilding size={9} />}>
              {rakip.devam_eden_is} devam eden iş
            </Badge>
          )}
        </Group>
      )}

      {/* Geçmiş ihale detayları (collapse) */}
      <Collapse in={expanded}>
        <Divider my={6} />
        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            Bu kurumdaki geçmişi:
          </Text>
          {rakip.gecmis?.map((g: RakipGecmis) => (
            <Paper key={`${g.ihale_basligi}-${g.kurum_adi}-${g.sozlesme_tarihi}`} p="xs" radius="sm" bg="dark.7">
              <Group justify="space-between" gap="xs">
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text size="xs" lineClamp={1} fw={500}>
                    {g.ihale_basligi}
                  </Text>
                  <Group gap={4} mt={2}>
                    {g.sehir && (
                      <Text size="xs" c="dimmed">
                        {g.sehir}
                      </Text>
                    )}
                    {g.sozlesme_tarihi && (
                      <Text size="xs" c="dimmed">
                        · {new Date(g.sozlesme_tarihi).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })}
                      </Text>
                    )}
                  </Group>
                </Box>
                <Group gap={4} style={{ flexShrink: 0 }}>
                  {g.sozlesme_bedeli && (
                    <Badge size="xs" variant="outline" color="green">
                      {Number(g.sozlesme_bedeli).toLocaleString('tr-TR')} ₺
                    </Badge>
                  )}
                  {g.indirim_orani && (
                    <Badge size="xs" variant="outline" color="orange">
                      %{Number(g.indirim_orani).toFixed(1)}
                    </Badge>
                  )}
                  <Badge
                    size="xs"
                    variant="light"
                    color={g.rol === 'yuklenici' ? 'green' : 'gray'}
                  >
                    {g.rol === 'yuklenici' ? 'Kazandı' : g.rol === 'katilimci' ? 'Katıldı' : g.rol}
                  </Badge>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Collapse>
    </Paper>
  );
}

export function RakipAnalizi({ tenderId }: RakipAnaliziProps) {
  const { data, isLoading, isError, refetch, toplamRakip } = useRakipAnalizi(tenderId);

  if (!tenderId) return null;

  // Loading state
  if (isLoading) {
    return (
      <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Rakip analizi yapılıyor...
          </Text>
        </Group>
      </Paper>
    );
  }

  // Error state
  if (isError) {
    return (
      <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="red">
            <IconAlertTriangle size={12} />
          </ThemeIcon>
          <Text size="xs" c="dimmed">
            Rakip analizi yüklenemedi
          </Text>
          <Button size="compact-xs" variant="subtle" onClick={() => refetch()}>
            Tekrar Dene
          </Button>
        </Group>
      </Paper>
    );
  }

  // Sonuç yok
  if (!data || toplamRakip === 0) {
    return (
      <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="gray">
              <IconUsers size={12} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              Bu kurum için potansiyel rakip bulunamadı
            </Text>
          </Group>
          <Tooltip label="Yeniden ara">
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => refetch()}>
              <IconRefresh size={12} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>
    );
  }

  const { katmanlar, kaynak, tavily_ozet } = data;
  const tumRakipler = [
    ...katmanlar.kesin_rakipler,
    ...katmanlar.kuvvetli_adaylar,
    ...katmanlar.sehir_aktif,
    ...katmanlar.web_kesfedilen,
  ];

  return (
    <Paper p="sm" withBorder radius="md" className="glassy-card-nested">
      {/* Header */}
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="red">
            <IconTarget size={12} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Potansiyel Rakipler
          </Text>
          <Badge size="xs" variant="light" color="red">
            {toplamRakip}
          </Badge>
          {data.cached && (
            <Badge size="xs" variant="outline" color="gray">
              önbellek
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          <Badge size="xs" variant="light" color={kaynak === 'ic_veri' ? 'blue' : kaynak === 'tavily' ? 'grape' : 'gray'}>
            {kaynak === 'ic_veri' ? 'İç Veri' : kaynak === 'tavily' ? 'Web' : '-'}
          </Badge>
          <Tooltip label="Yenile (cache temizle)">
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => refetch()}>
              <IconRefresh size={12} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Tavily AI özeti */}
      {tavily_ozet && (
        <Paper p="xs" radius="sm" bg="dark.7" mb="xs">
          <Text size="xs" c="dimmed" lineClamp={3}>
            {tavily_ozet}
          </Text>
        </Paper>
      )}

      {/* Rakip kartları */}
      <Stack gap={6}>
        {tumRakipler.map((rakip) => (
          <RakipKarti key={rakip.yuklenici_id ?? `${rakip.katman}-${rakip.unvan}`} rakip={rakip} />
        ))}
      </Stack>
    </Paper>
  );
}
