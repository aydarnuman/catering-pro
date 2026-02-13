'use client';

/**
 * ModulKarti — Tek Istihbarat Modulunun Kart Gorunumu
 * ─────────────────────────────────────────────────────
 * Istihbarat Merkezi grid'inde her modul bu kartla gosterilir.
 * Durum badge'i, son guncelleme, border renklendirme ve calistir butonu icerir.
 */

import { Badge, Button, Card, Group, Loader, Progress, Text, ThemeIcon, Tooltip } from '@mantine/core';
import {
  IconBrain,
  IconBuilding,
  IconChartPie,
  IconCheck,
  IconFileText,
  IconGavel,
  IconNews,
  IconPlayerPlay,
  IconRefresh,
  IconShieldOff,
  IconUsers,
} from '@tabler/icons-react';
import type { IstihbaratModul, ModulMeta } from '@/types/yuklenici';
import { getDurumEtiket, getDurumRenk } from './modul-meta';

// Ikon haritasi
const IKON_MAP: Record<string, React.ReactNode> = {
  IconFileText: <IconFileText size={20} />,
  IconChartPie: <IconChartPie size={20} />,
  IconUsers: <IconUsers size={20} />,
  IconGavel: <IconGavel size={20} />,
  IconShieldOff: <IconShieldOff size={20} />,
  IconBuilding: <IconBuilding size={20} />,
  IconNews: <IconNews size={20} />,
  IconBrain: <IconBrain size={20} />,
};

// Durum -> CSS class eslesmesi
const DURUM_CLASS_MAP: Record<string, string> = {
  bekliyor: 'modul-kart-bekliyor',
  calisiyor: 'modul-kart-calisiyor',
  tamamlandi: 'modul-kart-tamamlandi',
  hata: 'modul-kart-hata',
};

interface ModulKartiProps {
  meta: ModulMeta;
  durum: IstihbaratModul;
  onCalistir: () => void;
  onDetayAc: () => void;
  secili: boolean;
  animationDelay?: number;
}

export function ModulKarti({ meta, durum, onCalistir, onDetayAc, secili, animationDelay = 0 }: ModulKartiProps) {
  const calisiyor = durum.durum === 'calisiyor';
  const tamamlandi = durum.durum === 'tamamlandi';

  // Son guncelleme zamanini okunabilir formata cevir
  // updated_at her durum degisikliginde guncellenir (calisiyor/tamamlandi/hata)
  const zamanKaynagi = durum.updated_at || durum.son_guncelleme;
  const sonGuncelleme = zamanKaynagi ? formatZaman(zamanKaynagi) : 'Henuz calistirilmadi';

  const durumClass = DURUM_CLASS_MAP[durum.durum] || 'modul-kart-bekliyor';

  return (
    <Card
      radius="md"
      p="sm"
      className={`yk-modul-kart ${durumClass} stagger-fade-in`}
      style={{
        cursor: 'pointer',
        borderColor: secili ? 'var(--yk-gold)' : undefined,
        borderWidth: secili ? 2 : 1,
        transition: 'all 0.2s ease',
        position: 'relative',
        animationDelay: `${animationDelay}ms`,
        boxShadow: secili ? '0 0 16px var(--yk-gold-glow)' : undefined,
      }}
      onClick={onDetayAc}
    >
      {/* Tamamlandi checkmark overlay */}
      {tamamlandi && (
        <ThemeIcon
          size="xs"
          color="green"
          variant="filled"
          radius="xl"
          style={{ position: 'absolute', top: 6, right: 6 }}
        >
          <IconCheck size={10} />
        </ThemeIcon>
      )}

      {/* Ust: Ikon + Baslik + Durum badge */}
      <Group justify="space-between" mb={6} wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon size="md" variant="light" color={meta.renk} radius="md">
            {IKON_MAP[meta.ikon] || <IconFileText size={20} />}
          </ThemeIcon>
          <div>
            <Text size="sm" fw={600} lineClamp={1} style={{ color: 'var(--yk-text-primary)' }}>
              {meta.baslik}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {meta.kaynak}
            </Text>
          </div>
        </Group>

        <Badge
          size="xs"
          variant={tamamlandi ? 'filled' : 'light'}
          color={getDurumRenk(durum.durum)}
          style={{
            flexShrink: 0,
            ...(calisiyor
              ? {
                  background: 'var(--yk-gold-dim)',
                  color: 'var(--yk-gold)',
                  border: '1px solid var(--yk-border)',
                }
              : {}),
          }}
        >
          {calisiyor ? <Loader size={8} color="var(--yk-gold)" mr={4} /> : null}
          {getDurumEtiket(durum.durum)}
        </Badge>
      </Group>

      {/* Calisiyor durumunda progress bar — gold */}
      {calisiyor && <Progress size="xs" value={100} animated color="yellow" mb={4} />}

      {/* Alt: Son guncelleme + Calistir butonu */}
      <Group justify="space-between" mt={4}>
        <Text size="xs" c="dimmed">
          {durum.durum === 'hata' ? (
            <Text span c="red" size="xs">
              {durum.hata_mesaji?.substring(0, 40) || 'Hata olustu'}
            </Text>
          ) : (
            sonGuncelleme
          )}
        </Text>

        <Tooltip label={calisiyor ? 'Calisiyor, bekleyin...' : durum.son_guncelleme ? 'Yeniden calistir' : 'Baslat'}>
          <Button
            size="compact-xs"
            loading={calisiyor}
            leftSection={durum.son_guncelleme ? <IconRefresh size={12} /> : <IconPlayerPlay size={12} />}
            onClick={(e) => {
              e.stopPropagation();
              if (!calisiyor) onCalistir();
            }}
            style={{
              background: 'var(--yk-gold-dim)',
              color: 'var(--yk-gold)',
              border: '1px solid var(--yk-border)',
            }}
          >
            {durum.son_guncelleme ? 'Yenile' : 'Baslat'}
          </Button>
        </Tooltip>
      </Group>
    </Card>
  );
}

/** Zamani okunabilir formata cevirir: "2 saat once", "3 gun once" vb. */
function formatZaman(isoStr: string): string {
  const tarih = new Date(isoStr);
  const simdi = new Date();
  const farkMs = simdi.getTime() - tarih.getTime();
  const farkDk = Math.floor(farkMs / 60000);
  const farkSaat = Math.floor(farkMs / 3600000);
  const farkGun = Math.floor(farkMs / 86400000);

  if (farkDk < 1) return 'Az once';
  if (farkDk < 60) return `${farkDk} dk once`;
  if (farkSaat < 24) return `${farkSaat} saat once`;
  if (farkGun < 7) return `${farkGun} gun once`;
  return tarih.toLocaleDateString('tr-TR');
}
