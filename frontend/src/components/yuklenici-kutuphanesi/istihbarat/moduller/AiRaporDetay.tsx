'use client';

/**
 * AI İstihbarat Raporu Detay Paneli
 * Claude Opus 4.6 tarafından oluşturulan firma istihbarat briefing'i.
 * + Tavily Research ile Derin Analiz özelliği.
 */

import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  List,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  TypographyStylesProvider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconBulb,
  IconExternalLink,
  IconMapPin,
  IconReportAnalytics,
  IconSearch,
  IconSpyOff,
  IconUsers,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { getApiUrl } from '@/lib/config';

interface Props {
  veri: Record<string, unknown> | null;
  yukleniciId?: number;
}

// ── Derin Analiz Tipi ──
interface DerinAnalizData {
  ozet: string;
  kaynaklar: Array<{ title: string; url: string; excerpt: string; score: number }>;
  kaynak_sayisi: number;
  alt_sorgular: string[];
  olusturma_tarihi?: string;
  son_guncelleme?: string;
}

export function AiRaporDetay({ veri, yukleniciId }: Props) {
  // ── Derin Analiz State ──
  const [derinAnaliz, setDerinAnaliz] = useState<DerinAnalizData | null>(null);
  const [derinYukleniyor, setDerinYukleniyor] = useState(false);
  const [derinCalistiriliyor, setDerinCalistiriliyor] = useState(false);

  /** Cache'lenmiş derin analiz sonucunu çek */
  const fetchDerinAnaliz = useCallback(async () => {
    if (!yukleniciId) return;
    setDerinYukleniyor(true);
    try {
      const res = await fetch(getApiUrl(`/contractors/${yukleniciId}/derin-analiz`), {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDerinAnaliz(json.data as DerinAnalizData);
      }
    } catch {
      // Sessiz geç
    } finally {
      setDerinYukleniyor(false);
    }
  }, [yukleniciId]);

  /** Derin analiz çalıştır */
  const calistirDerinAnaliz = useCallback(async () => {
    if (!yukleniciId) return;
    setDerinCalistiriliyor(true);
    try {
      const res = await fetch(getApiUrl(`/contractors/${yukleniciId}/derin-analiz`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (json.success) {
        setDerinAnaliz(json.data as DerinAnalizData);
        notifications.show({
          title: 'Derin Analiz Tamamlandı',
          message: `${json.data.kaynak_sayisi} kaynaktan bilgi toplandı`,
          color: 'teal',
        });
      } else {
        notifications.show({ title: 'Hata', message: json.error, color: 'red' });
      }
    } catch (err) {
      notifications.show({
        title: 'Bağlantı Hatası',
        message: err instanceof Error ? err.message : 'Sunucuya bağlanılamadı',
        color: 'red',
      });
    } finally {
      setDerinCalistiriliyor(false);
    }
  }, [yukleniciId]);

  // İlk yüklemede cache kontrol et
  useEffect(() => {
    fetchDerinAnaliz();
  }, [fetchDerinAnaliz]);

  if (!veri) return <Text c="dimmed">Veri bulunamadı. Modülü çalıştırarak AI raporu oluşturabilirsiniz.</Text>;

  const rapor = veri.rapor as Record<string, unknown> | undefined;
  const hamMetin = veri.ham_metin as string | undefined;
  const olusturmaTarihi = veri.olusturulma_tarihi as string | undefined;
  const model = veri.model as string | undefined;
  const sureMs = veri.sure_ms as number | undefined;

  // Rapor parse edilemediğinde ham metni göster
  if (!rapor && hamMetin) {
    return (
      <Stack gap="md">
        <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
          {hamMetin}
        </Text>
        {olusturmaTarihi && (
          <Text size="xs" c="dimmed">
            Oluşturulma: {new Date(olusturmaTarihi).toLocaleString('tr-TR')}
          </Text>
        )}
      </Stack>
    );
  }

  if (!rapor) {
    return <Text c="dimmed">AI raporu henüz oluşturulmamış.</Text>;
  }

  // Yeni format (istihbarat briefing)
  const tehlikeSeviyesi = (rapor.tehlike_seviyesi as string) || (rapor.risk_seviyesi as string) || 'orta';
  const tehlikeRenk =
    tehlikeSeviyesi === 'çok yüksek'
      ? 'red'
      : tehlikeSeviyesi === 'yüksek'
        ? 'orange'
        : tehlikeSeviyesi === 'düşük'
          ? 'green'
          : 'yellow';

  // Eski format uyumluluğu (SWOT)
  const eskiFormat = !!(rapor.genel_degerlendirme || rapor.guclu_yonler);

  // Yeni format alanları
  const ozetProfil = rapor.ozet_profil as string;
  const tehlikeGerekce = rapor.tehlike_gerekce as string;
  const faaliyetAlani = rapor.faaliyet_alani as string;
  const ihaleDavranisi = rapor.ihale_davranisi as string;
  const riskSinyalleri = rapor.risk_sinyalleri as string;
  const rakipAgi = rapor.rakip_agi as string;
  const stratejikTavsiyeler = (rapor.stratejik_tavsiyeler as string[]) || [];
  const tamMetin = rapor.tam_metin as string;

  return (
    <Stack gap="md">
      {/* Meta bilgi */}
      <Group gap="xs">
        {model && (
          <Badge size="xs" variant="light" color="violet">
            {model}
          </Badge>
        )}
        {sureMs && (
          <Text size="xs" c="dimmed">
            {(sureMs / 1000).toFixed(1)} saniye
          </Text>
        )}
        <Badge size="sm" variant="filled" color={tehlikeRenk}>
          Tehlike: {tehlikeSeviyesi.toUpperCase()}
        </Badge>
      </Group>

      {/* Eski format — SWOT */}
      {eskiFormat && <EskiFormatGoster rapor={rapor} />}

      {/* Yeni format — İstihbarat Briefing (Opus 4.6 Markdown çıktısı) */}
      {!eskiFormat && (
        <>
          {/* Tam Markdown Rapor */}
          {!!tamMetin && (
            <TypographyStylesProvider>
              <div style={{ fontSize: '0.875rem' }}>
                <Markdown>{tamMetin}</Markdown>
              </div>
            </TypographyStylesProvider>
          )}

          {/* Markdown yoksa parse edilmiş bölümleri göster */}
          {!tamMetin && (
            <>
              {!!ozetProfil && (
                <Alert variant="light" color={tehlikeRenk} title="Özet Profil" icon={<IconSpyOff size={18} />}>
                  <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                    {ozetProfil}
                  </Text>
                  {!!tehlikeGerekce && (
                    <Text size="xs" mt="xs" c="dimmed" fs="italic">
                      {tehlikeGerekce}
                    </Text>
                  )}
                </Alert>
              )}

              {!!faaliyetAlani && (
                <BriefingKart
                  baslik="Faaliyet Alanı"
                  icerik={faaliyetAlani}
                  ikon={<IconMapPin size={14} />}
                  renk="teal"
                />
              )}

              {!!ihaleDavranisi && (
                <BriefingKart
                  baslik="İhale Davranışı"
                  icerik={ihaleDavranisi}
                  ikon={<IconReportAnalytics size={14} />}
                  renk="blue"
                />
              )}

              {!!riskSinyalleri && (
                <BriefingKart
                  baslik="Risk Sinyalleri"
                  icerik={riskSinyalleri}
                  ikon={<IconAlertTriangle size={14} />}
                  renk="red"
                />
              )}

              {!!rakipAgi && (
                <BriefingKart baslik="Rakip Ağı" icerik={rakipAgi} ikon={<IconUsers size={14} />} renk="grape" />
              )}

              {stratejikTavsiyeler.length > 0 && (
                <Card withBorder p="sm" radius="sm" style={{ borderColor: 'var(--mantine-color-blue-3)' }}>
                  <Group gap="xs" mb="xs">
                    <ThemeIcon size="sm" variant="light" color="blue">
                      <IconBulb size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={700}>
                      Stratejik Tavsiyeler
                    </Text>
                  </Group>
                  <List size="sm" spacing={6}>
                    {stratejikTavsiyeler.map((t) => (
                      <List.Item key={`tav-${t.slice(0, 30)}`}>{t}</List.Item>
                    ))}
                  </List>
                </Card>
              )}
            </>
          )}
        </>
      )}

      <Divider />

      {olusturmaTarihi && (
        <Text size="xs" c="dimmed" ta="right">
          Oluşturulma: {new Date(olusturmaTarihi).toLocaleString('tr-TR')}
        </Text>
      )}

      {/* ── Derin Analiz (Tavily Research) ── */}
      {yukleniciId && (
        <DerinAnalizPanel
          data={derinAnaliz}
          yukleniyor={derinYukleniyor}
          calistiriliyor={derinCalistiriliyor}
          onCalistir={calistirDerinAnaliz}
        />
      )}
    </Stack>
  );
}

// ── Yeni format: Briefing kartı ──
function BriefingKart({
  baslik,
  icerik,
  ikon,
  renk,
}: {
  baslik: string;
  icerik: string;
  ikon: React.ReactNode;
  renk: string;
}) {
  return (
    <Card withBorder p="sm" radius="sm">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color={renk}>
          {ikon}
        </ThemeIcon>
        <Text size="sm" fw={600}>
          {baslik}
        </Text>
      </Group>
      <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
        {icerik}
      </Text>
    </Card>
  );
}

// ── Eski format uyumluluğu (SWOT) ──
function EskiFormatGoster({ rapor }: { rapor: Record<string, unknown> }) {
  return (
    <>
      {!!rapor.genel_degerlendirme && (
        <Card withBorder p="sm" radius="sm">
          <Text size="sm" fw={600} mb="xs">
            Genel Değerlendirme
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
            {rapor.genel_degerlendirme as string}
          </Text>
        </Card>
      )}
      <Group grow align="flex-start">
        <SWOTKart baslik="Güçlü Yönler" maddeler={(rapor.guclu_yonler as string[]) || []} renk="green" />
        <SWOTKart baslik="Zayıf Yönler" maddeler={(rapor.zayif_yonler as string[]) || []} renk="red" />
      </Group>
      <Group grow align="flex-start">
        <SWOTKart baslik="Fırsatlar" maddeler={(rapor.firsatlar as string[]) || []} renk="blue" />
        <SWOTKart baslik="Tehditler" maddeler={(rapor.tehditler as string[]) || []} renk="orange" />
      </Group>
      {!!rapor.rekabet_stratejisi && (
        <Card withBorder p="sm" radius="sm">
          <Text size="sm" fw={600} mb="xs">
            Rekabet Stratejisi
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
            {rapor.rekabet_stratejisi as string}
          </Text>
        </Card>
      )}
      {(rapor.tavsiyeler as string[])?.length > 0 && (
        <Card withBorder p="sm" radius="sm" bg="blue.0">
          <Text size="sm" fw={600} mb="xs">
            Tavsiyeler
          </Text>
          <List size="sm" spacing={4}>
            {(rapor.tavsiyeler as string[]).map((t) => (
              <List.Item key={`tav-${t.slice(0, 30)}`}>{t}</List.Item>
            ))}
          </List>
        </Card>
      )}
    </>
  );
}

function SWOTKart({ baslik, maddeler, renk }: { baslik: string; maddeler: string[]; renk: string }) {
  if (maddeler.length === 0) return null;
  return (
    <Card withBorder p="sm" radius="sm">
      <Text size="xs" fw={600} c={renk} mb="xs">
        {baslik}
      </Text>
      <List size="xs" spacing={2}>
        {maddeler.map((m) => (
          <List.Item key={`${baslik}-${m.slice(0, 30)}`}>{m}</List.Item>
        ))}
      </List>
    </Card>
  );
}

// ── Derin Analiz Paneli ──
function DerinAnalizPanel({
  data,
  yukleniyor,
  calistiriliyor,
  onCalistir,
}: {
  data: DerinAnalizData | null;
  yukleniyor: boolean;
  calistiriliyor: boolean;
  onCalistir: () => void;
}) {
  return (
    <Card withBorder radius="md" p="md" mt="md" style={{ borderColor: 'var(--mantine-color-teal-3)' }}>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="teal">
            <IconSearch size={14} />
          </ThemeIcon>
          <Text size="sm" fw={700} c="teal.7">
            Derin Web Analizi
          </Text>
          <Badge size="xs" variant="light" color="teal">
            Tavily Research
          </Badge>
        </Group>
        <Button
          size="xs"
          variant="light"
          color="teal"
          leftSection={calistiriliyor ? <Loader size={12} /> : <IconSearch size={14} />}
          loading={calistiriliyor}
          onClick={onCalistir}
          disabled={calistiriliyor}
        >
          {data ? 'Yenile' : 'Analiz Başlat'}
        </Button>
      </Group>

      {yukleniyor && !data && (
        <Group gap="xs" py="sm">
          <Loader size="xs" />
          <Text size="xs" c="dimmed">
            Önceki analiz sonuçları yükleniyor...
          </Text>
        </Group>
      )}

      {calistiriliyor && (
        <Alert variant="light" color="teal" p="xs" mb="sm">
          <Group gap="xs">
            <Loader size="xs" color="teal" />
            <Text size="xs">Çoklu kaynak taranıyor... Bu işlem 15-30 saniye sürebilir.</Text>
          </Group>
        </Alert>
      )}

      {!data && !yukleniyor && !calistiriliyor && (
        <Text size="xs" c="dimmed">
          Birden fazla arama stratejisi ile kapsamlı web araştırması yapar. Her çalıştırmada ~5-8 Tavily kredisi
          harcanır.
        </Text>
      )}

      {data && (
        <Stack gap="sm">
          {/* AI Özet */}
          {data.ozet && (
            <Alert variant="light" color="teal" title="Araştırma Özeti" p="xs">
              <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                {data.ozet}
              </Text>
            </Alert>
          )}

          {/* Kaynaklar */}
          {data.kaynaklar && data.kaynaklar.length > 0 && (
            <Accordion variant="separated" radius="sm" defaultValue={null}>
              <Accordion.Item value="kaynaklar">
                <Accordion.Control>
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      Kaynaklar
                    </Text>
                    <Badge size="xs" variant="light" color="gray">
                      {data.kaynaklar.length} sayfa
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {data.kaynaklar.map((k) => {
                      const kaynakKey = k.url || k.title || String(Math.random());
                      return (
                        <Card key={kaynakKey} withBorder p="xs" radius="sm">
                          <Text size="xs" fw={600} lineClamp={1}>
                            <Anchor href={k.url} target="_blank" underline="hover" c="inherit">
                              {k.title}
                              <IconExternalLink size={10} style={{ marginLeft: 4 }} />
                            </Anchor>
                          </Text>
                          {k.excerpt && (
                            <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
                              {k.excerpt}
                            </Text>
                          )}
                          {k.score > 0 && (
                            <Badge size="xs" variant="dot" color="teal" mt={4}>
                              Skor: {(k.score * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </Card>
                      );
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}

          {/* Meta bilgi */}
          <Group gap="xs">
            {data.alt_sorgular?.length > 0 && (
              <Text size="xs" c="dimmed">
                {data.alt_sorgular.length + 1} farklı arama stratejisi
              </Text>
            )}
            {(data.olusturma_tarihi || data.son_guncelleme) && (
              <Text size="xs" c="dimmed">
                Son: {new Date(data.son_guncelleme || data.olusturma_tarihi || '').toLocaleString('tr-TR')}
              </Text>
            )}
          </Group>
        </Stack>
      )}
    </Card>
  );
}
