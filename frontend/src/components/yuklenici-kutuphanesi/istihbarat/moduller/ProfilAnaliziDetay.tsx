'use client';

/**
 * Profil Analizi Detay Paneli
 * ihalebul.com analiz sayfasından çekilen özet veriler.
 */

import { Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { formatCurrency } from '@/types/yuklenici';

interface Props {
  veri: Record<string, unknown> | null;
}

export function ProfilAnaliziDetay({ veri }: Props) {
  if (!veri) return <Text c="dimmed">Veri bulunamadı.</Text>;

  const analiz = veri.analiz as Record<string, unknown> | null;
  const scrapedAt = veri.scraped_at as string | null;

  if (!analiz) {
    return <Text c="dimmed">Analiz verisi henüz yok. Modülü çalıştırarak veri toplayabilirsiniz.</Text>;
  }

  const ozet = analiz.ozet as Record<string, unknown> | undefined;

  return (
    <Stack gap="md">
      {scrapedAt && (
        <Text size="xs" c="dimmed">Son çekilme: {new Date(scrapedAt).toLocaleString('tr-TR')}</Text>
      )}

      {/* Özet Kartları */}
      {ozet && (
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
          <OzetKart baslik="Geçmiş İhale" deger={ozet.gecmis_ihale as number} />
          <OzetKart baslik="İptal İhale" deger={ozet.iptal_ihale as number} renk="red" />
          <OzetKart baslik="KİK Kararları" deger={ozet.kik_kararlari as number} renk="orange" />
          {(ozet.toplam_sozlesme as Record<string, unknown>)?.tutar && (
            <OzetKart baslik="Toplam Sözleşme" deger={formatCurrency((ozet.toplam_sozlesme as Record<string, unknown>).tutar as number)} />
          )}
          {(ozet.ort_tenzilat as Record<string, unknown>)?.yuzde && (
            <OzetKart baslik="Ort. Tenzilat" deger={`%${(ozet.ort_tenzilat as Record<string, unknown>).yuzde}`} renk="teal" />
          )}
          {ozet.ort_sozlesme_suresi_gun && (
            <OzetKart baslik="Ort. Süre" deger={`${ozet.ort_sozlesme_suresi_gun} gün`} />
          )}
        </SimpleGrid>
      )}

      {/* Rakipler */}
      {analiz.rakipler && Array.isArray(analiz.rakipler) && (analiz.rakipler as unknown[]).length > 0 && (
        <div>
          <Text size="sm" fw={600} mb="xs">En Sık Karşılaşılan Rakipler</Text>
          <Stack gap={4}>
            {(analiz.rakipler as Array<Record<string, unknown>>).slice(0, 10).map((r, idx) => (
              <Group key={`rakip-${idx}`} justify="space-between">
                <Text size="xs" lineClamp={1}>{r.rakip_adi as string}</Text>
                <Group gap={8}>
                  <Text size="xs" c="dimmed">{r.ihale_sayisi as number} ihale</Text>
                  {r.toplam_sozlesme && <Text size="xs" c="orange">{formatCurrency(r.toplam_sozlesme as number)}</Text>}
                </Group>
              </Group>
            ))}
          </Stack>
        </div>
      )}

      {/* Şehirler */}
      {analiz.sehirler && Array.isArray(analiz.sehirler) && (analiz.sehirler as unknown[]).length > 0 && (
        <div>
          <Text size="sm" fw={600} mb="xs">Aktif Şehirler</Text>
          <Stack gap={4}>
            {(analiz.sehirler as Array<Record<string, unknown>>).slice(0, 10).map((s, idx) => (
              <Group key={`sehir-${idx}`} justify="space-between">
                <Text size="xs">{s.sehir as string}</Text>
                <Group gap={8}>
                  <Text size="xs" c="dimmed">Toplam: {((s.guncel as number) || 0) + ((s.gecmis as number) || 0)}</Text>
                  {s.toplam_sozlesme && <Text size="xs" c="orange">{formatCurrency(s.toplam_sozlesme as number)}</Text>}
                </Group>
              </Group>
            ))}
          </Stack>
        </div>
      )}
    </Stack>
  );
}

function OzetKart({ baslik, deger, renk }: { baslik: string; deger: unknown; renk?: string }) {
  if (deger === undefined || deger === null) return null;
  return (
    <Card withBorder p="xs" radius="sm">
      <Text size="xs" c="dimmed">{baslik}</Text>
      <Text size="sm" fw={700} c={renk}>{String(deger)}</Text>
    </Card>
  );
}
