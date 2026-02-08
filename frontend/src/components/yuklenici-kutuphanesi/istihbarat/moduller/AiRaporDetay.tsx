'use client';

/**
 * AI İstihbarat Raporu Detay Paneli
 * Claude Opus 4.6 tarafından oluşturulan firma istihbarat briefing'i.
 */

import {
  Alert,
  Badge,
  Card,
  Divider,
  Group,
  List,
  Stack,
  Text,
  ThemeIcon,
  TypographyStylesProvider,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBulb,
  IconMapPin,
  IconReportAnalytics,
  IconSpyOff,
  IconUsers,
} from '@tabler/icons-react';
import Markdown from 'react-markdown';

interface Props {
  veri: Record<string, unknown> | null;
}

export function AiRaporDetay({ veri }: Props) {
  if (!veri)
    return (
      <Text c="dimmed">Veri bulunamadı. Modülü çalıştırarak AI raporu oluşturabilirsiniz.</Text>
    );

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
      {eskiFormat && (
        <EskiFormatGoster rapor={rapor} />
      )}

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
                <Alert
                  variant="light"
                  color={tehlikeRenk}
                  title="Özet Profil"
                  icon={<IconSpyOff size={18} />}
                >
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
                <BriefingKart
                  baslik="Rakip Ağı"
                  icerik={rakipAgi}
                  ikon={<IconUsers size={14} />}
                  renk="grape"
                />
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
          <Text size="sm" fw={600} mb="xs">Genel Değerlendirme</Text>
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
          <Text size="sm" fw={600} mb="xs">Rekabet Stratejisi</Text>
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
            {rapor.rekabet_stratejisi as string}
          </Text>
        </Card>
      )}
      {(rapor.tavsiyeler as string[])?.length > 0 && (
        <Card withBorder p="sm" radius="sm" bg="blue.0">
          <Text size="sm" fw={600} mb="xs">Tavsiyeler</Text>
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

function SWOTKart({
  baslik,
  maddeler,
  renk,
}: {
  baslik: string;
  maddeler: string[];
  renk: string;
}) {
  if (maddeler.length === 0) return null;
  return (
    <Card withBorder p="sm" radius="sm">
      <Text size="xs" fw={600} c={renk} mb="xs">{baslik}</Text>
      <List size="xs" spacing={2}>
        {maddeler.map((m) => (
          <List.Item key={`${baslik}-${m.slice(0, 30)}`}>{m}</List.Item>
        ))}
      </List>
    </Card>
  );
}
