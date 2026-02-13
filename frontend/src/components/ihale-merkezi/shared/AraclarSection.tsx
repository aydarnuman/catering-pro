'use client';

import { Anchor, Badge, Box, Group, Paper, SimpleGrid, Skeleton, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { IconExternalLink, IconGavel, IconLeaf, IconSparkles, IconTrendingUp } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { SavedTender } from '../types';

// ─── Gündem mini types ──────────────────────────────────

interface GundemHaber {
  baslik: string;
  url: string;
}

interface GundemKonu {
  konu: string;
  baslik: string;
  ozet?: string;
  haberler: GundemHaber[];
}

interface GundemData {
  success: boolean;
  konular: GundemKonu[];
}

const KONU_ICON: Record<string, { icon: React.ReactNode; color: string }> = {
  kik_ihale: { icon: <IconGavel size={12} />, color: 'orange' },
  gida_mevzuat: { icon: <IconLeaf size={12} />, color: 'green' },
  gida_fiyat_trend: { icon: <IconTrendingUp size={12} />, color: 'blue' },
};

export function AraclarSection({ tender }: { tender: SavedTender; onRefresh?: () => void }) {
  // Tespit edilen veriler
  const hesaplamaVerileri = ((tender as unknown as Record<string, unknown>).hesaplama_verileri || {}) as Record<
    string,
    unknown
  >;
  const isSuresi = (hesaplamaVerileri.is_suresi ||
    tender.analysis_summary?.teslim_suresi ||
    tender.analysis_summary?.sure) as string | undefined;
  const toplamOgun = Number(
    hesaplamaVerileri.toplam_ogun_sayisi ||
      tender.analysis_summary?.toplam_ogun_sayisi ||
      tender.analysis_summary?.ogun_bilgileri?.reduce(
        (sum: number, o: { miktar?: number | string }) => sum + (Number(o.miktar) || 0),
        0
      ) ||
      0
  );
  const teknikSartSayisi = Number(
    hesaplamaVerileri.teknik_sart_sayisi || tender.analysis_summary?.teknik_sartlar?.length || 0
  );
  const birimFiyatSayisi = Number(
    hesaplamaVerileri.birim_fiyat_sayisi || tender.analysis_summary?.birim_fiyatlar?.length || 0
  );

  // ─── Gündem verisi ──────────────────────────────────────

  const [gundem, setGundem] = useState<GundemData | null>(null);
  const [gundemLoading, setGundemLoading] = useState(false);

  const fetchGundem = useCallback(async () => {
    setGundemLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/mevzuat/gundem'), { credentials: 'include' });
      if (!res.ok) return;
      const json: GundemData = await res.json();
      if (json.success) setGundem(json);
    } catch {
      // sessizce devam
    } finally {
      setGundemLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGundem();
  }, [fetchGundem]);

  return (
    <Stack gap="md">
      {/* Döküman Analizi - Kompakt Özet */}
      {(isSuresi || toplamOgun > 0) && (
        <Paper p="sm" withBorder radius="md" bg="rgba(20, 184, 166, 0.03)">
          <Group gap="xs" mb="xs">
            <IconSparkles size={14} color="var(--mantine-color-teal-6)" />
            <Text size="xs" fw={600} c="teal">
              Döküman Analizi
            </Text>
          </Group>
          <SimpleGrid cols={4} spacing="xs">
            {isSuresi && (
              <Box>
                <Text size="xs" c="dimmed">
                  Süre
                </Text>
                <Text size="sm" fw={500}>
                  {isSuresi}
                </Text>
              </Box>
            )}
            {toplamOgun > 0 && (
              <Box>
                <Text size="xs" c="dimmed">
                  Öğün
                </Text>
                <Text size="sm" fw={500}>
                  {(toplamOgun / 1000000).toFixed(1)}M
                </Text>
              </Box>
            )}
            {teknikSartSayisi > 0 && (
              <Box>
                <Text size="xs" c="dimmed">
                  Şart
                </Text>
                <Text size="sm" fw={500}>
                  {teknikSartSayisi}
                </Text>
              </Box>
            )}
            {birimFiyatSayisi > 0 && (
              <Box>
                <Text size="xs" c="dimmed">
                  Kalem
                </Text>
                <Text size="sm" fw={500}>
                  {birimFiyatSayisi}
                </Text>
              </Box>
            )}
          </SimpleGrid>
        </Paper>
      )}

      {/* Piyasa & Mevzuat — Canlı Gündem */}
      <Paper p="sm" withBorder radius="md" bg="rgba(59, 130, 246, 0.03)">
        <Group gap="xs" mb="xs">
          <IconGavel size={14} color="var(--mantine-color-orange-6)" />
          <Text size="xs" fw={600} c="orange">
            Piyasa & Mevzuat
          </Text>
        </Group>

        {gundemLoading && !gundem ? (
          <Stack gap="xs">
            <Skeleton height={40} radius="sm" />
            <Skeleton height={40} radius="sm" />
          </Stack>
        ) : gundem && gundem.konular.length > 0 ? (
          <Stack gap="xs">
            {gundem.konular.map((konu) => {
              const meta = KONU_ICON[konu.konu] || {
                icon: <IconTrendingUp size={12} />,
                color: 'gray',
              };
              return (
                <Box key={konu.konu}>
                  <Group gap={4} mb={2}>
                    <ThemeIcon size="xs" variant="light" color={meta.color} radius="xl">
                      {meta.icon}
                    </ThemeIcon>
                    <Text size="xs" fw={600}>
                      {konu.baslik}
                    </Text>
                    <Badge size="xs" variant="dot" color={meta.color}>
                      {konu.haberler.length}
                    </Badge>
                  </Group>

                  {/* İlk 2 haber */}
                  <Stack gap={2} ml="md">
                    {konu.haberler.slice(0, 2).map((haber, idx) => (
                      <Anchor
                        key={`${konu.konu}-${idx}`}
                        href={haber.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        size="xs"
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}
                      >
                        <IconExternalLink size={10} style={{ flexShrink: 0, marginTop: 3 }} />
                        <Text size="xs" lineClamp={1} inherit>
                          {haber.baslik}
                        </Text>
                      </Anchor>
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">
            Gündem verisi yüklenemedi
          </Text>
        )}

        {/* KIK link */}
        <Group gap="xs" mt="xs" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-dark-5)' }}>
          <Tooltip label="KİK Karar Arama Motoru" position="top">
            <Anchor
              href="https://ekk.kik.gov.tr/EKAP/"
              target="_blank"
              size="xs"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <IconGavel size={12} />
              KİK Emsal Ara
            </Anchor>
          </Tooltip>
        </Group>
      </Paper>
    </Stack>
  );
}
