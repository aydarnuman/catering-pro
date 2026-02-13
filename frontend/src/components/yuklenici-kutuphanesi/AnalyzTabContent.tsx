'use client';

import { Badge, Card, Divider, Group, ScrollArea, Stack, Table, Tabs, Text, ThemeIcon } from '@mantine/core';
import { IconBuildingBank, IconChartPie, IconMapPin, IconSpy, IconTrendingUp, IconUsers } from '@tabler/icons-react';
import { useState } from 'react';
import type { AnalyzData } from '@/types/yuklenici';
import { formatCurrency } from '@/types/yuklenici';
import { StatMiniCard } from './StatMiniCard';

export function AnalyzTabContent({
  analiz,
  analizScrapedAt,
}: {
  analiz: AnalyzData | null;
  analizScrapedAt: string | null;
}) {
  const [activeSection, setActiveSection] = useState<string | null>('ozet');

  if (!analiz) {
    return (
      <Card withBorder radius="md" p="xl" bg="var(--mantine-color-yellow-light)">
        <Stack gap="md" align="center" py="md">
          <ThemeIcon size={64} variant="light" color="red" radius="xl">
            <IconSpy size={32} />
          </ThemeIcon>
          <div style={{ textAlign: 'center' }}>
            <Text fw={600} size="md" mb={4}>
              Analiz Verisi Henuz Cekilmedi
            </Text>
            <Text size="sm" c="dimmed" maw={400}>
              Yuklenici detay sayfasindaki istihbarat butonuna (casus ikonu) basarak analiz verilerini otomatik olarak
              cekin. Idareler, rakipler, ortak girisimler, yillik trend ve daha fazlasi cekilecek.
            </Text>
          </div>
        </Stack>
      </Card>
    );
  }

  const o = analiz.ozet;

  return (
    <Stack gap="md" pb="md">
      <Text size="xs" c="dimmed">
        Son analiz: {analizScrapedAt ? new Date(analizScrapedAt).toLocaleString('tr-TR') : '-'} — Istihbarat butonuyla
        guncellenir
      </Text>

      {o && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}
        >
          <StatMiniCard
            label="Toplam Sozlesme"
            value={o.toplam_sozlesme?.sayi}
            sub={formatCurrency(o.toplam_sozlesme?.tutar ?? null)}
            color="orange"
          />
          <StatMiniCard
            label="Tamamlanan"
            value={o.tamamlanan?.sayi}
            sub={formatCurrency(o.tamamlanan?.tutar ?? null)}
            color="green"
          />
          <StatMiniCard
            label="Devam Eden"
            value={o.devam_eden?.sayi}
            sub={formatCurrency(o.devam_eden?.tutar ?? null)}
            color="blue"
          />
          <StatMiniCard
            label="Ort. Tenzilat"
            value={`%${o.ort_tenzilat?.yuzde?.toFixed(1) || '0'}`}
            sub={formatCurrency(o.ort_tenzilat?.tutar ?? null)}
            color="teal"
          />
          <StatMiniCard
            label="Ort. Sure"
            value={`${o.ort_sozlesme_suresi_gun || 0} gun`}
            sub={`${o.ilk_sozlesme || '-'} → ${o.son_sozlesme || '-'}`}
            color="grape"
          />
          <StatMiniCard
            label="KIK Kararlari"
            value={o.kik_kararlari || 0}
            sub={`${o.iptal_ihale || 0} iptal`}
            color="red"
          />
        </div>
      )}

      <Tabs value={activeSection} onChange={setActiveSection} variant="pills" radius="xl">
        <ScrollArea type="auto" offsetScrollbars>
          <Tabs.List>
            <Tabs.Tab value="ozet" leftSection={<IconTrendingUp size={12} />}>
              Yillik Trend
            </Tabs.Tab>
            <Tabs.Tab value="idareler" leftSection={<IconBuildingBank size={12} />}>
              Idareler ({analiz.idareler?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="rakipler" leftSection={<IconUsers size={12} />}>
              Rakipler ({analiz.rakipler?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="ortak" leftSection={<IconUsers size={12} />}>
              Ortak Girisim ({analiz.ortak_girisimler?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="sehirler" leftSection={<IconMapPin size={12} />}>
              Sehirler ({analiz.sehirler?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="dagilimlar" leftSection={<IconChartPie size={12} />}>
              Dagilimlar
            </Tabs.Tab>
          </Tabs.List>
        </ScrollArea>

        <Tabs.Panel value="ozet" pt="md">
          {analiz.yillik_trend && analiz.yillik_trend.length > 0 ? (
            <ScrollArea>
              <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Yil</Table.Th>
                    <Table.Th>Ort. Katilimci</Table.Th>
                    <Table.Th>Gecerli Teklif</Table.Th>
                    <Table.Th>Tenzilat</Table.Th>
                    <Table.Th>Devam Eden</Table.Th>
                    <Table.Th>Tamamlanan</Table.Th>
                    <Table.Th>Toplam Sozlesme</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analiz.yillik_trend.map((row, idx) => (
                    <Table.Tr key={`yil-${row.yil}-${idx}`}>
                      <Table.Td fw={600}>{row.yil}</Table.Td>
                      <Table.Td>{row.ort_katilimci}</Table.Td>
                      <Table.Td>{row.ort_gecerli_teklif}</Table.Td>
                      <Table.Td c="teal">%{Number(row.tenzilat_yuzde || 0).toFixed(1)}</Table.Td>
                      <Table.Td>{row.devam_eden}</Table.Td>
                      <Table.Td>{row.tamamlanan}</Table.Td>
                      <Table.Td c="orange" fw={500}>
                        {formatCurrency(row.toplam_sozlesme)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" size="sm">
              Yillik trend verisi yok
            </Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="idareler" pt="md">
          {analiz.idareler && analiz.idareler.length > 0 ? (
            <ScrollArea h={350}>
              <Table striped highlightOnHover withTableBorder fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Idare Adi</Table.Th>
                    <Table.Th ta="right">Gecmis</Table.Th>
                    <Table.Th ta="right">Devam</Table.Th>
                    <Table.Th ta="right">Tamamlanan</Table.Th>
                    <Table.Th ta="right">Toplam</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analiz.idareler.map((row, idx) => (
                    <Table.Tr key={`${row.idare_adi}-${idx}`}>
                      <Table.Td
                        style={{
                          maxWidth: 250,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.idare_adi}
                      </Table.Td>
                      <Table.Td ta="right">{row.gecmis}</Table.Td>
                      <Table.Td ta="right">
                        {row.devam_eden > 0 ? (
                          <Badge size="xs" color="blue">
                            {row.devam_eden}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </Table.Td>
                      <Table.Td ta="right">{row.tamamlanan}</Table.Td>
                      <Table.Td ta="right" c="orange" fw={500}>
                        {formatCurrency(row.toplam_sozlesme)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" size="sm">
              Idare verisi yok
            </Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="rakipler" pt="md">
          {analiz.rakipler && analiz.rakipler.length > 0 ? (
            <ScrollArea h={350}>
              <Table striped highlightOnHover withTableBorder fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Rakip Adi</Table.Th>
                    <Table.Th ta="right">Ihale Sayisi</Table.Th>
                    <Table.Th ta="right">Toplam Sozlesme</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analiz.rakipler.map((row, idx) => (
                    <Table.Tr key={`${row.rakip_adi}-${idx}`}>
                      <Table.Td
                        style={{
                          maxWidth: 280,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.rakip_adi}
                      </Table.Td>
                      <Table.Td ta="right">{row.ihale_sayisi}</Table.Td>
                      <Table.Td ta="right" c="orange" fw={500}>
                        {formatCurrency(row.toplam_sozlesme)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" size="sm">
              Rakip verisi yok
            </Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="ortak" pt="md">
          {analiz.ortak_girisimler && analiz.ortak_girisimler.length > 0 ? (
            <Stack gap="xs">
              {analiz.ortak_girisimler.map((row, idx) => (
                <Paper key={`${row.partner_adi}-${idx}`} withBorder p="sm" radius="sm">
                  <Text size="sm" fw={600} lineClamp={2}>
                    {row.partner_adi}
                  </Text>
                  <Group gap="md" mt={4}>
                    {row.devam_eden > 0 && (
                      <Badge size="xs" color="blue">
                        {row.devam_eden} devam eden
                      </Badge>
                    )}
                    <Badge size="xs" variant="light">
                      {row.tamamlanan} tamamlanan
                    </Badge>
                    <Text size="xs" c="orange" fw={500}>
                      {formatCurrency(row.toplam_sozlesme)}
                    </Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">
              Ortak girisim verisi yok
            </Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="sehirler" pt="md">
          {analiz.sehirler && analiz.sehirler.length > 0 ? (
            <ScrollArea h={350}>
              <Table striped highlightOnHover withTableBorder fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Sehir</Table.Th>
                    <Table.Th ta="right">Gecmis</Table.Th>
                    <Table.Th ta="right">Devam</Table.Th>
                    <Table.Th ta="right">Tamamlanan</Table.Th>
                    <Table.Th ta="right">Toplam</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analiz.sehirler.map((row, idx) => (
                    <Table.Tr key={`${row.sehir}-${idx}`}>
                      <Table.Td fw={500}>{row.sehir}</Table.Td>
                      <Table.Td ta="right">{row.gecmis}</Table.Td>
                      <Table.Td ta="right">
                        {row.devam_eden > 0 ? (
                          <Badge size="xs" color="blue">
                            {row.devam_eden}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </Table.Td>
                      <Table.Td ta="right">{row.tamamlanan}</Table.Td>
                      <Table.Td ta="right" c="orange" fw={500}>
                        {formatCurrency(row.toplam_sozlesme)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" size="sm">
              Sehir verisi yok
            </Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="dagilimlar" pt="md">
          <Stack gap="lg">
            {analiz.ihale_usulleri && analiz.ihale_usulleri.length > 0 && (
              <div>
                <Text size="sm" fw={600} mb="xs">
                  Ihale Usulleri
                </Text>
                <Stack gap={4}>
                  {analiz.ihale_usulleri.slice(0, 8).map((row, idx) => (
                    <Group key={`usul-${row.ad}-${idx}`} justify="space-between" wrap="nowrap">
                      <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                        {row.ad}
                      </Text>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="xs" variant="light">
                          {row.gecmis} ihale
                        </Badge>
                        <Text size="xs" c="orange" fw={500} style={{ minWidth: 80, textAlign: 'right' }}>
                          {formatCurrency(row.toplam_sozlesme)}
                        </Text>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </div>
            )}

            <Divider />

            {analiz.teklif_turleri && analiz.teklif_turleri.length > 0 && (
              <div>
                <Text size="sm" fw={600} mb="xs">
                  Teklif Turleri
                </Text>
                <Stack gap={4}>
                  {analiz.teklif_turleri.map((row, idx) => (
                    <Group key={`teklif-${row.ad}-${idx}`} justify="space-between" wrap="nowrap">
                      <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                        {row.ad}
                      </Text>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="xs" variant="light">
                          {row.gecmis} ihale
                        </Badge>
                        <Text size="xs" c="orange" fw={500} style={{ minWidth: 80, textAlign: 'right' }}>
                          {formatCurrency(row.toplam_sozlesme)}
                        </Text>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </div>
            )}

            <Divider />

            {analiz.sektorler && analiz.sektorler.length > 0 && (
              <div>
                <Text size="sm" fw={600} mb="xs">
                  Sektorler (CPV)
                </Text>
                <Stack gap={4}>
                  {analiz.sektorler.slice(0, 8).map((row, idx) => (
                    <Group key={`${row.cpv_kodu}-${idx}`} justify="space-between" wrap="nowrap">
                      <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                        <Text span c="dimmed">
                          {row.cpv_kodu}
                        </Text>{' '}
                        {row.sektor_adi}
                      </Text>
                      <Text size="xs" c="orange" fw={500} style={{ minWidth: 80, textAlign: 'right' }}>
                        {formatCurrency(row.toplam_sozlesme)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </div>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// Re-export Paper for ortak_girisimler section
import { Paper } from '@mantine/core';
