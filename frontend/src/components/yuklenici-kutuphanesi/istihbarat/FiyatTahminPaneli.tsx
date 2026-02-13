'use client';

/**
 * Fiyat Tahmin Paneli
 * ────────────────────
 * Yüklenicinin geçmiş ihalelerine dayalı indirim oranı analizi ve trend gösterimi.
 * Şehir bazlı ortalamalar, trend yönü ve istatistikler gösterilir.
 */

import { Alert, Badge, Card, Center, Group, Loader, Progress, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconArrowDown,
  IconArrowRight,
  IconArrowUp,
  IconChartLine,
  IconInfoCircle,
  IconMapPin,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { FiyatTahminVeri } from '@/types/yuklenici';

interface Props {
  yukleniciId: number;
}

export function FiyatTahminPaneli({ yukleniciId }: Props) {
  const [veri, setVeri] = useState<FiyatTahminVeri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const fetchTahmin = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const res = await fetch(getApiUrl(`/contractors/${yukleniciId}/fiyat-tahmin`), {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setVeri(json.data);
      } else {
        setHata(json.error);
      }
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      setYukleniyor(false);
    }
  }, [yukleniciId]);

  useEffect(() => {
    fetchTahmin();
  }, [fetchTahmin]);

  if (yukleniyor) {
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );
  }

  if (hata) {
    return (
      <Alert color="red" title="Hata">
        {hata}
      </Alert>
    );
  }

  if (!veri || !veri.yeterli_veri) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light" title="Yetersiz Veri">
        {veri?.mesaj || 'Fiyat tahmini için yeterli ihale verisi bulunmuyor.'}
      </Alert>
    );
  }

  // Trend ikonu ve rengi
  const trendIkon =
    veri.trend === 'artiyor' ? (
      <IconArrowUp size={16} />
    ) : veri.trend === 'azaliyor' ? (
      <IconArrowDown size={16} />
    ) : (
      <IconArrowRight size={16} />
    );
  const trendRenk = veri.trend === 'artiyor' ? 'red' : veri.trend === 'azaliyor' ? 'green' : 'blue';
  const trendMesaj =
    veri.trend === 'artiyor'
      ? 'İndirim oranı artıyor — firma daha agresif teklif veriyor'
      : veri.trend === 'azaliyor'
        ? 'İndirim oranı düşüyor — firma daha tutucu teklif veriyor'
        : 'İndirim oranı sabit — teklif davranışı tutarlı';

  return (
    <Stack gap="md">
      {/* Ana İstatistikler */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatKart baslik="Toplam İhale" deger={String(veri.toplam_ihale)} />
        <StatKart baslik="Ort. İndirim" deger={`%${veri.ortalama_indirim}`} renk="teal" />
        <StatKart baslik="Medyan İndirim" deger={`%${veri.medyan_indirim}`} renk="blue" />
        <StatKart baslik="Min / Max" deger={`%${veri.min_indirim} — %${veri.max_indirim}`} renk="grape" />
      </SimpleGrid>

      {/* Trend Kartı */}
      <Card withBorder p="sm" radius="sm">
        <Group gap="xs" mb="xs">
          <ThemeIcon size="md" variant="light" color={trendRenk} radius="md">
            {trendIkon}
          </ThemeIcon>
          <div>
            <Text size="sm" fw={600}>
              Trend: {veri.trend === 'artiyor' ? 'Artıyor' : veri.trend === 'azaliyor' ? 'Azalıyor' : 'Sabit'}
            </Text>
            <Text size="xs" c="dimmed">
              {trendMesaj}
            </Text>
          </div>
        </Group>

        {veri.trend_detay && (
          <Group gap="md" mt="xs">
            <div>
              <Text size="xs" c="dimmed">
                Son 10 İhale Ort.
              </Text>
              <Text size="sm" fw={600}>
                %{veri.trend_detay.son_10_ort}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Önceki Ort.
              </Text>
              <Text size="sm" fw={600}>
                %{veri.trend_detay.onceki_ort}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Fark
              </Text>
              <Text size="sm" fw={600} c={trendRenk}>
                {veri.trend_detay.fark > 0 ? '+' : ''}
                {veri.trend_detay.fark} puan
              </Text>
            </div>
          </Group>
        )}
      </Card>

      {/* Şehir Bazlı Dağılım */}
      {veri.sehir_bazli && veri.sehir_bazli.length > 0 && (
        <div>
          <Group gap="xs" mb="xs">
            <IconMapPin size={14} />
            <Text size="sm" fw={600}>
              Şehir Bazlı İndirim Ortalamaları
            </Text>
          </Group>
          <Stack gap={4}>
            {veri.sehir_bazli.map((s) => (
              <Group key={`sehir-${s.sehir}`} justify="space-between">
                <Group gap="xs">
                  <Text size="xs" w={100}>
                    {s.sehir}
                  </Text>
                  <Badge size="xs" variant="light">
                    {s.ihale_sayisi} ihale
                  </Badge>
                </Group>
                <Group gap="xs" style={{ flex: 1, maxWidth: 200 }}>
                  <Progress value={Math.min(s.ort_indirim * 2, 100)} size="sm" color="teal" style={{ flex: 1 }} />
                  <Text size="xs" fw={600} w={50} ta="right">
                    %{s.ort_indirim}
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        </div>
      )}

      {/* İpucu */}
      <Alert icon={<IconChartLine size={16} />} color="blue" variant="light" title="İpucu">
        Bu veriler, firmanın gelecek ihalelerdeki muhtemel indirim oranını tahmin etmenize yardımcı olur. Yüksek indirim
        oranı agresif rekabeti, düşük indirim oranı tutucu stratejiyi gösterir.
      </Alert>
    </Stack>
  );
}

function StatKart({ baslik, deger, renk }: { baslik: string; deger: string; renk?: string }) {
  return (
    <Card withBorder p="xs" radius="sm">
      <Text size="xs" c="dimmed">
        {baslik}
      </Text>
      <Text size="sm" fw={700} c={renk}>
        {deger}
      </Text>
    </Card>
  );
}
