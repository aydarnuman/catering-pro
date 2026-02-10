'use client';

/**
 * Haberler & İstihbarat Detay Paneli
 * ───────────────────────────────────
 * Hibrit kaynaklardan gelen verileri gösterir:
 * - Tavily web sonuçları
 * - Google News RSS haberleri
 * - KİK kararları (ayrı bölüm)
 * - AI özet (Tavily tarafından üretilen)
 */

import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Box,
  Card,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconExternalLink,
  IconGavel,
  IconNews,
  IconRobot,
  IconWorld,
} from '@tabler/icons-react';

import type { HavuzVeri } from '../ModulDetay';

interface Props {
  veri: Record<string, unknown> | null;
  /** Veri havuzundan zenginleştirilmiş web istihbaratı */
  havuzVeri?: HavuzVeri | null;
}

const KAYNAK_TIPI_CONFIG: Record<string, { label: string; color: string }> = {
  tavily: { label: 'Web', color: 'blue' },
  google_news: { label: 'GNews', color: 'orange' },
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/#{1,3}\s*/g, '') // Markdown başlıklarını temizle
    .replace(/\*{1,2}/g, '') // Bold/italic işaretlerini temizle
    .trim();
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function HaberlerDetay({ veri, havuzVeri }: Props) {
  if (!veri)
    return (
      <Text c="dimmed">Veri bulunamadı. Modülü çalıştırarak haber taraması yapabilirsiniz.</Text>
    );

  const haberler = (veri.haberler as Array<Record<string, unknown>>) || [];
  const kikKararlari = (veri.kik_kararlari as Array<Record<string, unknown>>) || [];
  const aiOzet = veri.ai_ozet as string | undefined;
  const kaynaklar = veri.kaynaklar as Record<string, number> | undefined;
  const aramaMetni = veri.arama_metni as string | undefined;
  const sorgulamaTarihi = veri.sorgulama_tarihi as string | undefined;
  const toplam = haberler.length + kikKararlari.length;

  if (toplam === 0) {
    return (
      <Stack gap="sm">
        <Text c="dimmed">
          {aramaMetni ? `"${aramaMetni}" araması için sonuç bulunamadı.` : 'Sonuç bulunamadı.'}
        </Text>
        <Text size="xs" c="dimmed">
          Bu firma hakkında güncel web kaynağı veya KİK kararı bulunamadı.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Kaynak özeti */}
      <Group gap="xs">
        {kaynaklar?.tavily != null && kaynaklar.tavily > 0 && (
          <Badge size="sm" variant="light" color="blue" leftSection={<IconWorld size={10} />}>
            Web: {kaynaklar.tavily}
          </Badge>
        )}
        {kaynaklar?.google_news != null && kaynaklar.google_news > 0 && (
          <Badge size="sm" variant="light" color="orange" leftSection={<IconNews size={10} />}>
            GNews: {kaynaklar.google_news}
          </Badge>
        )}
        {kaynaklar?.kik != null && kaynaklar.kik > 0 && (
          <Badge size="sm" variant="light" color="red" leftSection={<IconGavel size={10} />}>
            KİK: {kaynaklar.kik}
          </Badge>
        )}
      </Group>

      {/* AI Özet */}
      {aiOzet && (
        <Card withBorder radius="md" p="sm" bg="blue.0">
          <Group gap="xs" mb={4}>
            <ThemeIcon size="sm" variant="light" color="blue">
              <IconRobot size={12} />
            </ThemeIcon>
            <Text size="xs" fw={600} c="blue.8">
              AI Özet
            </Text>
          </Group>
          <Text size="sm" c="blue.9">
            {stripHtml(aiOzet)}
          </Text>
        </Card>
      )}

      {/* KİK Kararları */}
      {kikKararlari.length > 0 && (
        <Box>
          <Group gap="xs" mb="xs">
            <ThemeIcon size="sm" variant="light" color="red">
              <IconGavel size={12} />
            </ThemeIcon>
            <Title order={6}>KİK Kararları ({kikKararlari.length})</Title>
          </Group>

          <Accordion variant="contained" radius="sm">
            {kikKararlari.map((karar) => {
              const kararKey = String(karar.link || karar.baslik || Math.random());
              return (
              <Accordion.Item key={kararKey} value={kararKey}>
                <Accordion.Control>
                  <Group gap="xs" wrap="nowrap">
                    <Badge size="xs" color="red" variant="light">
                      KİK
                    </Badge>
                    <Text size="sm" lineClamp={1}>
                      {karar.ozet
                        ? stripHtml(String(karar.ozet)).substring(0, 120)
                        : 'KİK Kararı'}
                    </Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {typeof karar.ozet === 'string' && karar.ozet && (
                      <Text size="xs" c="dimmed">
                        {stripHtml(karar.ozet)}
                      </Text>
                    )}
                    {typeof karar.tam_metin === 'string' && karar.tam_metin && (
                      <Alert variant="light" color="gray" title="Karar Tam Metni" p="xs">
                        <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                          {karar.tam_metin.substring(0, 1500)}
                          {karar.tam_metin.length > 1500 && '...'}
                        </Text>
                      </Alert>
                    )}
                    {typeof karar.link === 'string' && karar.link && (
                      <Anchor href={karar.link} target="_blank" size="xs">
                        Kararı görüntüle <IconExternalLink size={10} />
                      </Anchor>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
              );
            })}
          </Accordion>
        </Box>
      )}

      {/* Haberler & Web Sonuçları */}
      {haberler.length > 0 && (
        <Box>
          {kikKararlari.length > 0 && <Divider my="xs" />}
          <Group gap="xs" mb="xs">
            <ThemeIcon size="sm" variant="light" color="blue">
              <IconWorld size={12} />
            </ThemeIcon>
            <Title order={6}>Web Sonuçları ({haberler.length})</Title>
          </Group>

          <Stack gap="xs">
            {haberler.map((haber) => {
              const haberKey = String(haber.link || haber.baslik || Math.random());
              const kaynakTipi = String(haber.kaynak_tipi || 'tavily');
              const config = KAYNAK_TIPI_CONFIG[kaynakTipi] || KAYNAK_TIPI_CONFIG.tavily;

              return (
                <Paper key={haberKey} withBorder p="sm" radius="sm">
                  <Group justify="space-between" wrap="nowrap" mb={4}>
                    <Text size="sm" fw={600} lineClamp={2} style={{ flex: 1 }}>
                      {haber.link ? (
                        <Anchor
                          href={String(haber.link)}
                          target="_blank"
                          underline="hover"
                          c="inherit"
                        >
                          {String(haber.baslik)}
                          <IconExternalLink
                            size={12}
                            style={{ marginLeft: 4, verticalAlign: 'middle' }}
                          />
                        </Anchor>
                      ) : (
                        String(haber.baslik)
                      )}
                    </Text>
                  </Group>

                  {!!haber.ozet && (
                    <Text size="xs" c="dimmed" lineClamp={2} mb={4}>
                      {stripHtml(String(haber.ozet))}
                    </Text>
                  )}

                  <Group gap={8}>
                    <Badge size="xs" variant="light" color={config.color}>
                      {config.label}
                    </Badge>
                    {!!haber.kaynak && (
                      <Badge size="xs" variant="outline" color="gray">
                        {String(haber.kaynak)}
                      </Badge>
                    )}
                    {!!haber.tarih_okunur && (
                      <Text size="xs" c="dimmed">
                        {String(haber.tarih_okunur)}
                      </Text>
                    )}
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Veri Havuzundan ek haber bulguları */}
      {havuzVeri?.web_istihbarat?.haber_sonuclari && havuzVeri.web_istihbarat.haber_sonuclari.length > 0 && (
        <Box>
          <Divider my="xs" />
          <Group gap="xs" mb="xs">
            <ThemeIcon size="sm" variant="light" color="indigo">
              <IconWorld size={12} />
            </ThemeIcon>
            <Title order={6}>Ek Web Haberleri ({havuzVeri.web_istihbarat.haber_sonuclari.length})</Title>
            <Badge size="xs" variant="light" color="indigo">Veri Havuzu</Badge>
          </Group>

          {havuzVeri.web_istihbarat.haber_ozet && (
            <Card withBorder radius="md" p="sm" bg="indigo.0" mb="xs">
              <Text size="xs" fw={600} c="indigo.8" mb={4}>Haber Özeti (Tavily)</Text>
              <Text size="sm" c="indigo.9">{havuzVeri.web_istihbarat.haber_ozet}</Text>
            </Card>
          )}

          <Stack gap="xs">
            {havuzVeri.web_istihbarat.haber_sonuclari.map((item, i) => (
              <Paper key={item.url || `havuz-haber-${i}`} withBorder p="sm" radius="sm">
                <Group justify="space-between" wrap="nowrap" mb={4}>
                  <Text size="sm" fw={600} lineClamp={2} style={{ flex: 1 }}>
                    {item.url ? (
                      <Anchor href={item.url} target="_blank" underline="hover" c="inherit">
                        {item.title || 'Web kaynağı'}
                        <IconExternalLink size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                      </Anchor>
                    ) : (
                      item.title || 'Web kaynağı'
                    )}
                  </Text>
                </Group>
                {item.content && (
                  <Text size="xs" c="dimmed" lineClamp={3} mb={4}>{item.content}</Text>
                )}
                <Badge size="xs" variant="outline" color="gray">{getDomain(item.url)}</Badge>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {/* Son tarama zamanı */}
      {sorgulamaTarihi && (
        <Text size="xs" c="dimmed" ta="right" mt="xs">
          Son tarama: {new Date(sorgulamaTarihi).toLocaleString('tr-TR')}
        </Text>
      )}
      {havuzVeri?.meta?.toplama_tarihi && (
        <Text size="xs" c="dimmed" ta="right">
          Veri havuzu: {new Date(havuzVeri.meta.toplama_tarihi).toLocaleString('tr-TR')}
        </Text>
      )}
    </Stack>
  );
}
