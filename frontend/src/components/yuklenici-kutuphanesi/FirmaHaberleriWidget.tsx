'use client';

/**
 * Firma Haberleri Widget
 * ──────────────────────
 * Yüklenici profilinde firma bazlı hibrit haber araması.
 * Tavily (web) + DB (ihale geçmişi) + Claude AI (özet)
 *
 * Kullanım:
 *   <FirmaHaberleriWidget firmaAdi="ABC Gıda A.Ş." />
 */

import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Collapse,
  Group,
  Paper,
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
  IconNews,
  IconRefresh,
} from '@tabler/icons-react';
import { useFirmaHaberleri } from '@/hooks/useSektorGundem';

interface FirmaHaberleriWidgetProps {
  firmaAdi: string | null | undefined;
}

export function FirmaHaberleriWidget({ firmaAdi }: FirmaHaberleriWidgetProps) {
  const { data, isLoading, isFetching, refetch } = useFirmaHaberleri(firmaAdi);
  const [expanded, { toggle }] = useDisclosure(true);

  // Firma adı yoksa veya çok kısa
  if (!firmaAdi || firmaAdi.length < 3) return null;

  // Loading
  if (isLoading && !data) {
    return (
      <Paper p="sm" withBorder radius="md">
        <Group gap="xs" mb="xs">
          <Skeleton height={16} width={16} circle />
          <Skeleton height={14} width={180} />
        </Group>
        <Stack gap="xs">
          <Skeleton height={40} radius="sm" />
          <Skeleton height={40} radius="sm" />
        </Stack>
      </Paper>
    );
  }

  // Hata veya veri yok
  if (!data || !data.success) return null;

  const toplamHaber = data.haberler?.length || 0;
  if (toplamHaber === 0 && !data.ai_ozet) return null;

  return (
    <Paper p="sm" withBorder radius="md" bg="rgba(0, 150, 136, 0.03)">
      {/* Header */}
      <Group justify="space-between" mb={expanded ? 'xs' : 0}>
        <Group gap="xs" style={{ cursor: 'pointer' }} onClick={toggle}>
          <ThemeIcon size="sm" variant="light" color="teal" radius="xl">
            <IconNews size={14} />
          </ThemeIcon>
          <Text size="xs" fw={600}>
            Firma Haberleri
          </Text>
          <Badge size="xs" variant="light" color="teal">
            {toplamHaber}
          </Badge>
          {data.kaynaklar && (
            <Text size="xs" c="dimmed">
              ({data.kaynaklar.tavily} web + {data.kaynaklar.db} DB)
            </Text>
          )}
          {expanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        </Group>

        <Tooltip label="Yenile">
          <ActionIcon size="xs" variant="subtle" loading={isFetching} onClick={() => refetch()}>
            <IconRefresh size={12} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Collapse in={expanded}>
        <Stack gap="xs">
          {/* AI Özet */}
          {data.ai_ozet && (
            <Paper p="xs" bg="rgba(0, 150, 136, 0.05)" radius="sm">
              <Text size="xs" c="dimmed" lineClamp={4}>
                {data.ai_ozet}
              </Text>
            </Paper>
          )}

          {/* Firma profil özeti */}
          {data.firma_profil && (
            <Group gap="xs" wrap="wrap">
              {data.firma_profil.katildigi_ihale != null && (
                <Badge size="xs" variant="outline" color="blue">
                  {data.firma_profil.katildigi_ihale} ihale
                </Badge>
              )}
              {data.firma_profil.kazanma_orani != null && (
                <Badge size="xs" variant="outline" color="green">
                  %{data.firma_profil.kazanma_orani} kazanma
                </Badge>
              )}
              {data.firma_profil.toplam_sozlesme_tutari != null && (
                <Badge size="xs" variant="outline" color="orange">
                  {Number(data.firma_profil.toplam_sozlesme_tutari).toLocaleString('tr-TR')} TL
                </Badge>
              )}
            </Group>
          )}

          {/* Haber listesi */}
          {data.haberler?.slice(0, 6).map((haber) => (
            <Box
              key={`firma-${haber.baslik}-${haber.url || haber.kaynak_tipi}`}
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
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 3, flex: 1 }}
                >
                  <IconExternalLink size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                  <Box style={{ flex: 1 }}>
                    <Text size="xs" lineClamp={2} inherit>
                      {haber.baslik}
                    </Text>
                    {haber.ozet && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {haber.ozet}
                      </Text>
                    )}
                  </Box>
                </Anchor>
              ) : (
                <Box style={{ flex: 1 }}>
                  <Text size="xs" lineClamp={2}>
                    {haber.baslik}
                  </Text>
                  {haber.ozet && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {haber.ozet}
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Paper>
  );
}
