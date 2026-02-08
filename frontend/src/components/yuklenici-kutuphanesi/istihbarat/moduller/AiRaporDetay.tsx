'use client';

/**
 * AI İstihbarat Raporu Detay Paneli
 * Claude AI tarafından oluşturulan kapsamlı analiz raporu.
 */

import { Alert, Badge, Card, Divider, Group, List, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconAlertTriangle,
  IconBulb,
  IconShield,
  IconStar,
  IconTarget,
  IconTrendingUp,
} from '@tabler/icons-react';

interface Props {
  veri: Record<string, unknown> | null;
}

export function AiRaporDetay({ veri }: Props) {
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
        <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{hamMetin}</Text>
        {olusturmaTarihi && <Text size="xs" c="dimmed">Oluşturulma: {new Date(olusturmaTarihi).toLocaleString('tr-TR')}</Text>}
      </Stack>
    );
  }

  if (!rapor) {
    return <Text c="dimmed">AI raporu henüz oluşturulmamış.</Text>;
  }

  const riskSeviyesi = rapor.risk_seviyesi as string;
  const riskRenk = riskSeviyesi === 'yüksek' ? 'red' : riskSeviyesi === 'düşük' ? 'green' : 'orange';

  return (
    <Stack gap="md">
      {/* Meta bilgi */}
      <Group gap="xs">
        {model && <Badge size="xs" variant="light" color="pink">{model}</Badge>}
        {sureMs && <Text size="xs" c="dimmed">{(sureMs / 1000).toFixed(1)} saniye</Text>}
        <Badge size="xs" variant="filled" color={riskRenk}>
          Risk: {riskSeviyesi || 'Orta'}
        </Badge>
      </Group>

      {/* Genel Değerlendirme */}
      {rapor.genel_degerlendirme && (
        <Card withBorder p="sm" radius="sm">
          <Text size="sm" fw={600} mb="xs">Genel Değerlendirme</Text>
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{rapor.genel_degerlendirme as string}</Text>
        </Card>
      )}

      {/* SWOT Analizi */}
      <Group grow align="flex-start">
        <SWOTKart
          baslik="Güçlü Yönler"
          maddeler={rapor.guclu_yonler as string[] || []}
          renk="green"
          ikon={<IconStar size={14} />}
        />
        <SWOTKart
          baslik="Zayıf Yönler"
          maddeler={rapor.zayif_yonler as string[] || []}
          renk="red"
          ikon={<IconAlertTriangle size={14} />}
        />
      </Group>

      <Group grow align="flex-start">
        <SWOTKart
          baslik="Fırsatlar"
          maddeler={rapor.firsatlar as string[] || []}
          renk="blue"
          ikon={<IconTarget size={14} />}
        />
        <SWOTKart
          baslik="Tehditler"
          maddeler={rapor.tehditler as string[] || []}
          renk="orange"
          ikon={<IconShield size={14} />}
        />
      </Group>

      {/* Rekabet Stratejisi */}
      {rapor.rekabet_stratejisi && (
        <Card withBorder p="sm" radius="sm">
          <Group gap="xs" mb="xs">
            <ThemeIcon size="sm" variant="light" color="violet">
              <IconTrendingUp size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>Rekabet Stratejisi</Text>
          </Group>
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{rapor.rekabet_stratejisi as string}</Text>
        </Card>
      )}

      {/* Fiyat Analizi */}
      {rapor.fiyat_analizi && (
        <Card withBorder p="sm" radius="sm">
          <Text size="sm" fw={600} mb="xs">Fiyat Analizi</Text>
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{rapor.fiyat_analizi as string}</Text>
        </Card>
      )}

      {/* Tavsiyeler */}
      {(rapor.tavsiyeler as string[])?.length > 0 && (
        <Card withBorder p="sm" radius="sm" bg="blue.0">
          <Group gap="xs" mb="xs">
            <ThemeIcon size="sm" variant="light" color="blue">
              <IconBulb size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>Tavsiyeler</Text>
          </Group>
          <List size="sm" spacing={4}>
            {(rapor.tavsiyeler as string[]).map((t, idx) => (
              <List.Item key={`tav-${idx}`}>{t}</List.Item>
            ))}
          </List>
        </Card>
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

function SWOTKart({
  baslik,
  maddeler,
  renk,
  ikon,
}: {
  baslik: string;
  maddeler: string[];
  renk: string;
  ikon: React.ReactNode;
}) {
  if (maddeler.length === 0) return null;

  return (
    <Card withBorder p="sm" radius="sm">
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" variant="light" color={renk}>
          {ikon}
        </ThemeIcon>
        <Text size="xs" fw={600}>{baslik}</Text>
      </Group>
      <List size="xs" spacing={2}>
        {maddeler.map((m, idx) => (
          <List.Item key={`${baslik}-${idx}`}>{m}</List.Item>
        ))}
      </List>
    </Card>
  );
}
