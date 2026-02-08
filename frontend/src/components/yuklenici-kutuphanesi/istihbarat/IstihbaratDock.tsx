'use client';

/**
 * IstihbaratDock — macOS-style Floating Dock Bar
 * ───────────────────────────────────────────────
 * Ekranın altında 8 istihbarat modül ikonu gösterir.
 * Hover'da fisheye efekti, gold glow aktif durumu,
 * durum noktası ve tooltip barındırır.
 */

import { ThemeIcon } from '@mantine/core';
import {
  IconBrain,
  IconBuilding,
  IconChartPie,
  IconFileText,
  IconGavel,
  IconNews,
  IconShieldOff,
  IconUsers,
} from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import type { IstihbaratModul, IstihbaratModulAdi, ModulMeta } from '@/types/yuklenici';
import { getDurumEtiket } from './modul-meta';

// ─── Ikon haritası ──────────────────────────────────────────────

const IKON_MAP: Record<string, React.ReactNode> = {
  IconFileText: <IconFileText size={22} />,
  IconChartPie: <IconChartPie size={22} />,
  IconUsers: <IconUsers size={22} />,
  IconGavel: <IconGavel size={22} />,
  IconShieldOff: <IconShieldOff size={22} />,
  IconBuilding: <IconBuilding size={22} />,
  IconNews: <IconNews size={22} />,
  IconBrain: <IconBrain size={22} />,
};

// ─── Props ──────────────────────────────────────────────────────

interface IstihbaratDockProps {
  modulListesi: ModulMeta[];
  moduller: IstihbaratModul[];
  seciliModul: IstihbaratModulAdi | null;
  onModulSec: (modul: IstihbaratModulAdi) => void;
  onCalistir: (modul: IstihbaratModulAdi) => void;
}

// ─── Component ──────────────────────────────────────────────────

export function IstihbaratDock({
  modulListesi,
  moduller,
  seciliModul,
  onModulSec,
  onCalistir,
}: IstihbaratDockProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const dockRef = useRef<HTMLElement>(null);

  /** Durum bilgisini al */
  const getDurum = useCallback(
    (modulAdi: IstihbaratModulAdi) => {
      const found = moduller.find((m) => m.modul === modulAdi);
      return found?.durum ?? 'bekliyor';
    },
    [moduller]
  );

  /** Son güncelleme zamanını format */
  const getSonGuncelleme = useCallback(
    (modulAdi: IstihbaratModulAdi): string => {
      const found = moduller.find((m) => m.modul === modulAdi);
      if (!found?.son_guncelleme) return 'Henüz çalıştırılmadı';
      return formatZaman(found.son_guncelleme);
    },
    [moduller]
  );

  return (
    <nav className="yk-dock-container" ref={dockRef} onMouseLeave={() => setHoveredIdx(null)} aria-label="İstihbarat modülleri">
      {modulListesi.map((meta, idx) => {
        const durum = getDurum(meta.ad);
        const isActive = seciliModul === meta.ad;
        const isAi = meta.ad === 'ai_arastirma';

        // Neighbor detection for fisheye
        const isNeighbor = hoveredIdx !== null && Math.abs(hoveredIdx - idx) === 1;

        return (
          <button
            type="button"
            key={meta.ad}
            className={[
              'yk-dock-item',
              isActive ? 'yk-dock-item-active' : '',
              isAi ? 'yk-dock-item-ai' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-neighbor={isNeighbor && hoveredIdx !== idx ? '1' : undefined}
            onMouseEnter={() => setHoveredIdx(idx)}
            onClick={() => onModulSec(meta.ad)}
            onDoubleClick={(e) => {
              e.preventDefault();
              if (durum !== 'calisiyor') onCalistir(meta.ad);
            }}
            aria-label={meta.baslik}
            aria-pressed={isActive}
            style={{ border: 'none', background: 'transparent' }}
          >
            {/* Tooltip */}
            <div className="yk-dock-tooltip">
              <div className="yk-dock-tooltip-title">{meta.baslik}</div>
              <div className="yk-dock-tooltip-status">
                {getDurumEtiket(durum)} · {getSonGuncelleme(meta.ad)}
              </div>
            </div>

            {/* Ikon */}
            <ThemeIcon
              size={40}
              variant="light"
              color={isActive ? 'yellow' : meta.renk}
              radius="md"
              style={{
                transition: 'all 0.2s ease',
                ...(isActive
                  ? {
                      background: 'var(--yk-gold-dim)',
                      color: 'var(--yk-gold)',
                      border: '1px solid var(--yk-border)',
                    }
                  : {}),
              }}
            >
              {IKON_MAP[meta.ikon] || <IconFileText size={22} />}
            </ThemeIcon>

            {/* Durum noktası */}
            <span className="yk-dock-status-dot" data-status={durum} />
          </button>
        );
      })}
    </nav>
  );
}

// ─── Yardımcı ───────────────────────────────────────────────────

function formatZaman(isoStr: string): string {
  const tarih = new Date(isoStr);
  const simdi = new Date();
  const farkMs = simdi.getTime() - tarih.getTime();
  const farkDk = Math.floor(farkMs / 60000);
  const farkSaat = Math.floor(farkMs / 3600000);
  const farkGun = Math.floor(farkMs / 86400000);

  if (farkDk < 1) return 'Az önce';
  if (farkDk < 60) return `${farkDk} dk önce`;
  if (farkSaat < 24) return `${farkSaat} saat önce`;
  if (farkGun < 7) return `${farkGun} gün önce`;
  return tarih.toLocaleDateString('tr-TR');
}
