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

import { Divider, Stack, Text } from '@mantine/core';
import { KikKararlariDetay } from './KikKararlariDetay';
import { KikYasaklilarDetay } from './KikYasaklilarDetay';

interface Props {
  /** Her alt modülün verisi — key: backend modül adı */
  veriler: Record<string, Record<string, unknown> | null>;
}

export function HukukiDurumDetay({ veriler }: Props) {
  const yasakliVeri = veriler.kik_yasaklilar ?? null;
  const kararlarVeri = veriler.kik_kararlari ?? null;

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
    </Stack>
  );
}
