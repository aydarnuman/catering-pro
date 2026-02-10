'use client';

/**
 * İhale Performansı — Birleşik Panel
 * ───────────────────────────────────
 * 3 backend modülünü tek panelde gösterir:
 *   • Özet   → ProfilAnaliziDetay verileri
 *   • Geçmiş → IhaleGecmisiDetay verileri
 *   • Katılımcılar → KatilimcilarDetay verileri
 *
 * SegmentedControl ile alt sekmeler arasında geçiş yapılır.
 * Veri kaybı yok — aynı veriler, daha derli toplu sunum.
 */

import {
  Anchor,
  Badge,
  Card,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconExternalLink, IconWorld } from '@tabler/icons-react';
import { useState } from 'react';
import type { HavuzVeri } from '../ModulDetay';
import { IhaleGecmisiDetay } from './IhaleGecmisiDetay';
import { KatilimcilarDetay } from './KatilimcilarDetay';
import { ProfilAnaliziDetay } from './ProfilAnaliziDetay';

type Sekme = 'ozet' | 'gecmis' | 'katilimcilar' | 'web_bulgu';

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

export function IhalePerformansiDetay({ veriler, havuzVeri }: Props) {
  const [sekme, setSekme] = useState<Sekme>('ozet');

  const profilVeri = veriler.profil_analizi ?? null;
  const gecmisVeri = veriler.ihale_gecmisi ?? null;
  const katilimciVeri = veriler.katilimcilar ?? null;

  // Havuzdan gelen web ihale bulguları
  const webIhaleBulgu = havuzVeri?.web_istihbarat?.ihale_sonuclari ?? [];
  const webAiOzet = havuzVeri?.web_istihbarat?.ai_ozet;

  // Üstte küçük özet satırı
  const ihaleSayisi = gecmisVeri
    ? ((gecmisVeri.toplam as number) || ((gecmisVeri.ihaleler as unknown[])?.length ?? 0))
    : 0;
  const katilimciSayisi = katilimciVeri
    ? ((katilimciVeri.katilimcilar as unknown[])?.length ?? 0)
    : 0;

  const sekmeler = [
    { label: 'Özet', value: 'ozet' },
    { label: 'Geçmiş', value: 'gecmis' },
    { label: 'Katılımcılar', value: 'katilimcilar' },
    ...(webIhaleBulgu.length > 0 ? [{ label: `Web (${webIhaleBulgu.length})`, value: 'web_bulgu' }] : []),
  ];

  return (
    <Stack gap="md">
      {/* Bilgi satırı */}
      <Text size="xs" c="dimmed">
        {ihaleSayisi > 0 && `${ihaleSayisi} ihale`}
        {ihaleSayisi > 0 && katilimciSayisi > 0 && ' · '}
        {katilimciSayisi > 0 && `${katilimciSayisi} katılımcı kaydı`}
        {webIhaleBulgu.length > 0 && ` · ${webIhaleBulgu.length} web bulgusu`}
        {ihaleSayisi === 0 && katilimciSayisi === 0 && webIhaleBulgu.length === 0 && 'Modülleri çalıştırarak veri toplayabilirsiniz'}
      </Text>

      {/* Sekme geçişi */}
      <SegmentedControl
        value={sekme}
        onChange={(v) => setSekme(v as Sekme)}
        data={sekmeler}
        size="xs"
        styles={{
          root: {
            background: 'var(--yk-surface-glass)',
            border: '1px solid var(--yk-border-subtle)',
          },
        }}
      />

      {/* Alt panel içeriği */}
      {sekme === 'ozet' && <ProfilAnaliziDetay veri={profilVeri} />}
      {sekme === 'gecmis' && <IhaleGecmisiDetay veri={gecmisVeri} />}
      {sekme === 'katilimcilar' && <KatilimcilarDetay veri={katilimciVeri} />}
      {sekme === 'web_bulgu' && (
        <Stack gap="sm">
          {webAiOzet && (
            <Card withBorder radius="md" p="sm" bg="blue.0">
              <Text size="xs" fw={600} c="blue.8" mb={4}>Web İstihbarat Özeti</Text>
              <Text size="sm" c="blue.9">{webAiOzet}</Text>
            </Card>
          )}
          <Group gap="xs" mb="xs">
            <ThemeIcon size="sm" variant="light" color="blue">
              <IconWorld size={12} />
            </ThemeIcon>
            <Title order={6}>Web İhale Bulguları ({webIhaleBulgu.length})</Title>
          </Group>
          {webIhaleBulgu.map((item, i) => (
            <Paper key={item.url || i} withBorder p="sm" radius="sm">
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
      )}
    </Stack>
  );
}
