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

import { SegmentedControl, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { IhaleGecmisiDetay } from './IhaleGecmisiDetay';
import { KatilimcilarDetay } from './KatilimcilarDetay';
import { ProfilAnaliziDetay } from './ProfilAnaliziDetay';

type Sekme = 'ozet' | 'gecmis' | 'katilimcilar';

interface Props {
  /** Her alt modülün verisi — key: backend modül adı */
  veriler: Record<string, Record<string, unknown> | null>;
}

export function IhalePerformansiDetay({ veriler }: Props) {
  const [sekme, setSekme] = useState<Sekme>('ozet');

  const profilVeri = veriler.profil_analizi ?? null;
  const gecmisVeri = veriler.ihale_gecmisi ?? null;
  const katilimciVeri = veriler.katilimcilar ?? null;

  // Üstte küçük özet satırı
  const ihaleSayisi = gecmisVeri
    ? ((gecmisVeri.toplam as number) || ((gecmisVeri.ihaleler as unknown[])?.length ?? 0))
    : 0;
  const katilimciSayisi = katilimciVeri
    ? ((katilimciVeri.katilimcilar as unknown[])?.length ?? 0)
    : 0;

  return (
    <Stack gap="md">
      {/* Bilgi satırı */}
      <Text size="xs" c="dimmed">
        {ihaleSayisi > 0 && `${ihaleSayisi} ihale`}
        {ihaleSayisi > 0 && katilimciSayisi > 0 && ' · '}
        {katilimciSayisi > 0 && `${katilimciSayisi} katılımcı kaydı`}
        {ihaleSayisi === 0 && katilimciSayisi === 0 && 'Modülleri çalıştırarak veri toplayabilirsiniz'}
      </Text>

      {/* Sekme geçişi */}
      <SegmentedControl
        value={sekme}
        onChange={(v) => setSekme(v as Sekme)}
        data={[
          { label: 'Özet', value: 'ozet' },
          { label: 'Geçmiş', value: 'gecmis' },
          { label: 'Katılımcılar', value: 'katilimcilar' },
        ]}
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
    </Stack>
  );
}
