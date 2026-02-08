'use client';

/**
 * Profil Analizi Detay Paneli
 * ───────────────────────────
 * ihalebul.com analiz sayfasından çekilen yüklenici profil verileri.
 *
 * Veri yapısı (DB: yukleniciler.analiz_verisi):
 *   ozet            → genel sayılar (ihale sayısı, sözleşme tutarı, tenzilat vb.)
 *   yillik_trend    → yıllara göre performans
 *   rakipler        → en sık karşılaşılan firmalar
 *   idareler        → en çok çalışılan kurumlar
 *   sektorler       → sektör dağılımı
 *   aktif_sehirler  → ayrı kolon, şehir listesi (string[])
 *
 * NOT: analiz_verisi.sehirler alanı yıl verisi içeriyor (scraper hatası),
 *      o yüzden kullanılmıyor. Gerçek şehirler aktif_sehirler'den geliyor.
 */

import { Badge, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { formatCurrency } from '@/types/yuklenici';

interface Props {
  veri: Record<string, unknown> | null;
}

export function ProfilAnaliziDetay({ veri }: Props) {
  if (!veri) return <Text c="dimmed">Veri bulunamadı.</Text>;

  const analiz = veri.analiz as Record<string, unknown> | null;
  const scrapedAt = veri.scraped_at as string | null;
  const aktifSehirler = (veri.aktif_sehirler ?? []) as string[];

  if (!analiz) {
    return (
      <Text c="dimmed">Analiz verisi henüz yok. Modülü çalıştırarak veri toplayabilirsiniz.</Text>
    );
  }

  const ozet = analiz.ozet as Record<string, unknown> | undefined;
  const yillikTrend = (analiz.yillik_trend ?? []) as Array<Record<string, unknown>>;
  const rakipler = (analiz.rakipler ?? []) as Array<Record<string, unknown>>;
  const idareler = (analiz.idareler ?? []) as Array<Record<string, unknown>>;
  const sektorler = (analiz.sektorler ?? []) as Array<Record<string, unknown>>;

  return (
    <Stack gap="lg">
      {scrapedAt && (
        <Text size="xs" c="dimmed">
          Son çekilme: {new Date(scrapedAt).toLocaleString('tr-TR')}
        </Text>
      )}

      {/* ─── Özet Kartları ──────────────────────────── */}
      {ozet && <OzetBolum ozet={ozet} />}

      {/* ─── Yıllık Trend ──────────────────────────── */}
      {yillikTrend.length > 0 && (
        <Bolum baslik="Yıllık Performans">
          {yillikTrend.map((t) => (
            <Group key={`trend-${String(t.yil)}`} justify="space-between" py={4} style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
              <Text size="sm" fw={600}>{String(t.yil)}</Text>
              <Group gap="md">
                <Text size="xs" c="dimmed">
                  {(t.tamamlanan as number) || 0} tamamlanan · {(t.devam_eden as number) || 0} devam
                </Text>
                {!!t.toplam_sozlesme && (
                  <Text size="xs" c="orange" fw={500}>
                    {formatCurrency(t.toplam_sozlesme as number)}
                  </Text>
                )}
                {!!t.tenzilat_yuzde && (
                  <Text size="xs" c="teal">
                    %{(t.tenzilat_yuzde as number).toFixed(1)} tenzilat
                  </Text>
                )}
              </Group>
            </Group>
          ))}
        </Bolum>
      )}

      {/* ─── En Sık Rakipler ───────────────────────── */}
      {rakipler.length > 0 && (
        <Bolum baslik="En Sık Karşılaşılan Rakipler">
          {rakipler.slice(0, 10).map((r) => (
            <Group key={`rakip-${String(r.rakip_adi)}`} justify="space-between" py={2}>
              <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                {r.rakip_adi as string}
              </Text>
              <Group gap={8} wrap="nowrap">
                <Text size="xs" c="dimmed">{r.ihale_sayisi as number} ihale</Text>
                {!!r.toplam_sozlesme && (
                  <Text size="xs" c="orange">{formatCurrency(r.toplam_sozlesme as number)}</Text>
                )}
              </Group>
            </Group>
          ))}
        </Bolum>
      )}

      {/* ─── En Çok Çalışılan İdareler ─────────────── */}
      {idareler.length > 0 && (
        <Bolum baslik="En Çok Çalışılan İdareler">
          {idareler.slice(0, 8).map((d) => (
            <Group key={`idare-${String(d.idare_adi)}`} justify="space-between" py={2}>
              <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                {d.idare_adi as string}
              </Text>
              <Group gap={8} wrap="nowrap">
                <Text size="xs" c="dimmed">
                  {((d.tamamlanan as number) || 0) + ((d.devam_eden as number) || 0)} ihale
                </Text>
                {!!d.toplam_sozlesme && (
                  <Text size="xs" c="orange">{formatCurrency(d.toplam_sozlesme as number)}</Text>
                )}
              </Group>
            </Group>
          ))}
        </Bolum>
      )}

      {/* ─── Sektör Dağılımı ──────────────────────── */}
      {sektorler.length > 0 && (
        <Bolum baslik="Sektör Dağılımı">
          {sektorler.slice(0, 6).map((s) => (
            <Group key={`sektor-${String(s.sektor_adi)}`} justify="space-between" py={2}>
              <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                {s.sektor_adi as string}
              </Text>
              <Group gap={8} wrap="nowrap">
                <Text size="xs" c="dimmed">
                  {((s.tamamlanan as number) || 0) + ((s.devam_eden as number) || 0)} ihale
                </Text>
                {!!s.toplam_sozlesme && (
                  <Text size="xs" c="orange">{formatCurrency(s.toplam_sozlesme as number)}</Text>
                )}
              </Group>
            </Group>
          ))}
        </Bolum>
      )}

      {/* ─── Aktif Şehirler ──────────────────────── */}
      {aktifSehirler.length > 0 && (
        <Bolum baslik={`Aktif Şehirler (${aktifSehirler.length})`}>
          <Group gap={6} style={{ flexWrap: 'wrap' }}>
            {aktifSehirler.map((sehir) => (
              <Badge key={sehir} variant="light" color="blue" size="sm" radius="sm">
                {sehir}
              </Badge>
            ))}
          </Group>
        </Bolum>
      )}
    </Stack>
  );
}

// ─── Alt Bileşenler ─────────────────────────────────────────────

function OzetBolum({ ozet }: { ozet: Record<string, unknown> }) {
  const toplam = ozet.toplam_sozlesme as Record<string, unknown> | undefined;
  const tenzilat = ozet.ort_tenzilat as Record<string, unknown> | undefined;
  const devamEden = ozet.devam_eden as Record<string, unknown> | undefined;
  const tamamlanan = ozet.tamamlanan as Record<string, unknown> | undefined;
  const yillik = ozet.yillik_ortalama as Record<string, unknown> | undefined;
  const isBitirme = ozet.is_bitirme_5yil as Record<string, unknown> | undefined;

  return (
    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
      <OzetKart baslik="Toplam İhale" deger={ozet.gecmis_ihale as number} />
      <OzetKart baslik="Aktif İhale" deger={ozet.aktif_ihale as number} renk="blue" />
      {!!tamamlanan?.sayi && (
        <OzetKart baslik="Tamamlanan" deger={tamamlanan.sayi as number} renk="green" />
      )}
      {!!devamEden?.sayi && (
        <OzetKart baslik="Devam Eden" deger={devamEden.sayi as number} renk="cyan" />
      )}
      {!!toplam?.tutar && (
        <OzetKart baslik="Toplam Sözleşme" deger={formatCurrency(toplam.tutar as number)} />
      )}
      {!!yillik?.tutar && (
        <OzetKart baslik="Yıllık Ortalama" deger={formatCurrency(yillik.tutar as number)} renk="indigo" />
      )}
      {!!isBitirme?.tutar && (
        <OzetKart baslik="İş Bitirme (5 Yıl)" deger={formatCurrency(isBitirme.tutar as number)} renk="grape" />
      )}
      {!!tenzilat?.yuzde && (
        <OzetKart baslik="Ort. Tenzilat" deger={`%${tenzilat.yuzde}`} renk="teal" />
      )}
      {!!ozet.ort_sozlesme_suresi_gun && (
        <OzetKart baslik="Ort. Süre" deger={`${ozet.ort_sozlesme_suresi_gun} gün`} />
      )}
      {!!ozet.ilk_sozlesme && (
        <OzetKart baslik="İlk Sözleşme" deger={ozet.ilk_sozlesme as string} renk="dimmed" />
      )}
      {!!ozet.son_sozlesme && (
        <OzetKart baslik="Son Sözleşme" deger={ozet.son_sozlesme as string} renk="dimmed" />
      )}
    </SimpleGrid>
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

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div>
      <Text size="sm" fw={600} mb="xs" style={{ color: 'var(--yk-text-secondary)', letterSpacing: '0.02em' }}>
        {baslik}
      </Text>
      {children}
    </div>
  );
}
