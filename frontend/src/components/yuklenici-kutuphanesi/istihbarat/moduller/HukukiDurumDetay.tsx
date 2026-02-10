'use client';

/**
 * Hukuki Durum — Birleşik Panel
 * ──────────────────────────────
 * 2 backend modülünü tek panelde gösterir:
 *   • Üst: Yasaklı Sorgusu (EKAP) — en kritik bilgi, hemen görünür
 *   • Alt: KİK Kararları — şikayet/itiraz detayları
 *
 * Alt sekme yok — dikey stack, ikisi birden görünür.
 */

import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Divider,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconExternalLink, IconGavel } from '@tabler/icons-react';
import type { HavuzVeri } from '../ModulDetay';
import { KikKararlariDetay } from './KikKararlariDetay';
import { KikYasaklilarDetay } from './KikYasaklilarDetay';

interface Props {
  /** Her alt modülün verisi — key: backend modül adı */
  veriler: Record<string, Record<string, unknown> | null>;
  /** Veri havuzundan zenginleştirilmiş web istihbaratı */
  havuzVeri?: HavuzVeri | null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function HukukiDurumDetay({ veriler, havuzVeri }: Props) {
  const yasakliVeri = veriler.kik_yasaklilar ?? null;
  const kararlarVeri = veriler.kik_kararlari ?? null;

  // Havuzdan gelen KİK web sonuçları ve tam metinleri
  const webKikSonuclari = havuzVeri?.web_istihbarat?.kik_sonuclari ?? [];
  const tamMetinler = (havuzVeri?.tam_metinler ?? []).filter(
    (t) => t.domain?.includes('kik') || t.domain?.includes('ihale')
  );

  return (
    <Stack gap="lg">
      {/* Yasaklı durumu — en kritik bilgi, üstte */}
      <div>
        <Text size="sm" fw={600} mb="xs" style={{ color: 'var(--yk-text-secondary)', letterSpacing: '0.02em' }}>
          EKAP Yasaklı Sorgusu
        </Text>
        <KikYasaklilarDetay veri={yasakliVeri} />
      </div>

      <Divider style={{ borderColor: 'var(--yk-border-subtle)' }} />

      {/* KİK Kararları — altta */}
      <div>
        <Text size="sm" fw={600} mb="xs" style={{ color: 'var(--yk-text-secondary)', letterSpacing: '0.02em' }}>
          KİK Kararları
        </Text>
        <KikKararlariDetay veri={kararlarVeri} />
      </div>

      {/* Web'den gelen KİK bulguları */}
      {webKikSonuclari.length > 0 && (
        <>
          <Divider style={{ borderColor: 'var(--yk-border-subtle)' }} />
          <div>
            <Group gap="xs" mb="xs">
              <ThemeIcon size="sm" variant="light" color="red">
                <IconGavel size={12} />
              </ThemeIcon>
              <Title order={6}>Web KİK Bulguları ({webKikSonuclari.length})</Title>
              <Badge size="xs" variant="light" color="indigo">Veri Havuzu</Badge>
            </Group>

            <Accordion variant="contained" radius="sm">
              {webKikSonuclari.map((sonuc, i) => {
                const key = sonuc.url || `kik-web-${i}`;
                // Bu sonuçla eşleşen tam metin var mı?
                const tamMetin = tamMetinler.find(
                  (t) => t.url === sonuc.url
                );
                return (
                  <Accordion.Item key={key} value={key}>
                    <Accordion.Control>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="xs" color="red" variant="light">KİK Web</Badge>
                        <Text size="sm" lineClamp={1}>
                          {sonuc.title || 'KİK Kararı'}
                        </Text>
                        <Badge size="xs" variant="outline" color="gray">{getDomain(sonuc.url)}</Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="xs">
                        {sonuc.content && (
                          <Text size="xs" c="dimmed">{sonuc.content}</Text>
                        )}
                        {tamMetin && (
                          <Alert variant="light" color="gray" title="Tam Metin" p="xs">
                            <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                              {tamMetin.metin.substring(0, 2000)}
                              {tamMetin.metin.length > 2000 && '...'}
                            </Text>
                          </Alert>
                        )}
                        {sonuc.url && (
                          <Anchor href={sonuc.url} target="_blank" size="xs">
                            Kaynağı görüntüle <IconExternalLink size={10} />
                          </Anchor>
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          </div>
        </>
      )}
    </Stack>
  );
}
