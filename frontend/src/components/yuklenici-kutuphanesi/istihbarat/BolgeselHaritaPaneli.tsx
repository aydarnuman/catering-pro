'use client';

/**
 * Bölgesel Rekabet Haritası — Türkiye İl Bazlı Görünüm
 * ──────────────────────────────────────────────────────
 * Yüklenicinin ihale yaptığı şehirleri harita üzerinde gösterir.
 * Renk yoğunluğu = ihale sayısı / sözleşme bedeli.
 * Hover'da tooltip: il adı, ihale sayısı, toplam bedel, ort indirim.
 */

import {
  Alert,
  Badge,
  Card,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconInfoCircle, IconMapPin } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import { formatCurrency } from '@/types/yuklenici';
import { bulIl, TURKIYE_ILLERI } from './turkiye-svg-paths';

interface Props {
  yukleniciId: number;
}

interface SehirVerisi {
  sehir: string;
  ihale_sayisi: number;
  ort_indirim: number;
  toplam_bedel?: number;
}

// Renk paleti (ihale sayısına göre yoğunluk)
function getRenk(ihale_sayisi: number, maxSayi: number): string {
  if (maxSayi === 0) return '#e0e0e0';
  const oran = ihale_sayisi / maxSayi;
  if (oran > 0.75) return '#c0392b'; // Çok yoğun — kırmızı
  if (oran > 0.5) return '#e67e22'; // Yoğun — turuncu
  if (oran > 0.25) return '#f1c40f'; // Orta — sarı
  if (oran > 0) return '#2ecc71'; // Az — yeşil
  return '#e0e0e0'; // Veri yok — gri
}

export function BolgeselHaritaPaneli({ yukleniciId }: Props) {
  const [sehirler, setSehirler] = useState<SehirVerisi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const fetchVeri = useCallback(async () => {
    setYukleniyor(true);
    try {
      const res = await fetch(getApiUrl(`/contractors/${yukleniciId}/fiyat-tahmin`), {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data?.sehir_bazli) {
        setSehirler(json.data.sehir_bazli);
      }
    } catch (err) {
      console.error('Bölgesel harita veri hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  }, [yukleniciId]);

  useEffect(() => {
    fetchVeri();
  }, [fetchVeri]);

  if (yukleniyor)
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );

  if (sehirler.length === 0) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light" title="Veri Yetersiz">
        Bölgesel harita için yeterli şehir verisi bulunamadı. Önce &quot;İhale Geçmişi&quot;
        modülünü çalıştırın.
      </Alert>
    );
  }

  const maxIhale = Math.max(...sehirler.map((s) => s.ihale_sayisi));

  // Şehir verisini harita noktalarına eşle
  const noktalar = TURKIYE_ILLERI.map((il) => {
    const veri = sehirler.find((s) => {
      const eslesme = bulIl(s.sehir);
      return eslesme?.ad === il.ad;
    });
    return { ...il, veri };
  });

  return (
    <Stack gap="md">
      {/* Harita */}
      <Card withBorder p="sm">
        <Group gap="xs" mb="sm">
          <IconMapPin size={16} />
          <Text size="sm" fw={600}>
            Türkiye Bölgesel Rekabet Haritası
          </Text>
        </Group>

        <Paper p="xs" bg="gray.1" radius="sm" style={{ position: 'relative', overflow: 'hidden' }}>
          <svg
            viewBox="120 80 750 330"
            style={{ width: '100%', height: 'auto', minHeight: 250, maxHeight: 400 }}
            role="img"
            aria-label="Türkiye bölgesel rekabet haritası"
          >
            <title>Türkiye Bölgesel Rekabet Haritası</title>
            {/* Arka plan — Türkiye ana hat (basitleştirilmiş) */}
            <rect x="120" y="80" width="750" height="330" fill="transparent" />

            {/* Veri olmayan iller — küçük gri nokta */}
            {noktalar
              .filter((n) => !n.veri)
              .map((il) => (
                <Tooltip key={`dot-${il.plaka}`} label={il.ad} position="top" withArrow>
                  <circle
                    cx={il.x}
                    cy={il.y}
                    r={3}
                    fill="#d0d0d0"
                    stroke="#bbb"
                    strokeWidth={0.5}
                    style={{ cursor: 'default' }}
                  />
                </Tooltip>
              ))}

            {/* Veri olan iller — renkli ve büyük daire */}
            {noktalar
              .filter((n) => n.veri)
              .map((il) => {
                const v = il.veri as SehirVerisi;
                const boyut = Math.max(6, Math.min(18, 6 + (v.ihale_sayisi / maxIhale) * 14));
                const renk = getRenk(v.ihale_sayisi, maxIhale);

                return (
                  <Tooltip
                    key={`active-${il.plaka}`}
                    label={
                      <div>
                        <Text size="xs" fw={700}>
                          {il.ad}
                        </Text>
                        <Text size="xs">{v.ihale_sayisi} ihale</Text>
                        {v.toplam_bedel && <Text size="xs">{formatCurrency(v.toplam_bedel)}</Text>}
                        <Text size="xs">Ort. indirim: %{v.ort_indirim}</Text>
                      </div>
                    }
                    position="top"
                    withArrow
                    multiline
                    w={180}
                  >
                    <g style={{ cursor: 'pointer' }}>
                      <circle
                        cx={il.x}
                        cy={il.y}
                        r={boyut}
                        fill={renk}
                        fillOpacity={0.7}
                        stroke={renk}
                        strokeWidth={1.5}
                      />
                      {/* İhale sayısı > 3 ise sayıyı göster */}
                      {v.ihale_sayisi > 3 && boyut > 10 && (
                        <text
                          x={il.x}
                          y={il.y + 1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize={8}
                          fontWeight={700}
                        >
                          {v.ihale_sayisi}
                        </text>
                      )}
                    </g>
                  </Tooltip>
                );
              })}
          </svg>
        </Paper>

        {/* Lejant */}
        <Group gap="md" mt="xs" justify="center">
          <Group gap={4}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2ecc71' }} />
            <Text size="xs">Az (1-2)</Text>
          </Group>
          <Group gap={4}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f1c40f' }} />
            <Text size="xs">Orta (3-5)</Text>
          </Group>
          <Group gap={4}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e67e22' }} />
            <Text size="xs">Yoğun (6+)</Text>
          </Group>
          <Group gap={4}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#c0392b' }} />
            <Text size="xs">Çok Yoğun</Text>
          </Group>
        </Group>
      </Card>

      {/* Şehir Listesi (tablo) */}
      <Card withBorder p="sm">
        <Text size="sm" fw={600} mb="xs">
          Şehir Bazlı Detay ({sehirler.length} il)
        </Text>
        <Stack gap={4}>
          {sehirler.slice(0, 15).map((s) => (
            <Group key={`slist-${s.sehir}`} justify="space-between">
              <Group gap="xs">
                <Badge size="xs" variant="filled" color={getRenk(s.ihale_sayisi, maxIhale)} />
                <Text size="xs" fw={500}>
                  {s.sehir}
                </Text>
              </Group>
              <Group gap="md">
                <Badge size="xs" variant="light">
                  {s.ihale_sayisi} ihale
                </Badge>
                <Text size="xs" c="teal">
                  %{s.ort_indirim}
                </Text>
                {s.toplam_bedel && (
                  <Text size="xs" c="orange">
                    {formatCurrency(s.toplam_bedel)}
                  </Text>
                )}
              </Group>
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
