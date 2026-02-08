'use client';

/**
 * IstihbaratDock — macOS-style Floating Dock Bar
 * ───────────────────────────────────────────────
 * Ekranın altında 5 grup ikonu gösterir (8 backend modül → 5 grup).
 * Hover'da fisheye efekti, gold glow aktif durumu,
 * durum noktası ve tooltip barındırır.
 */

import {
  IconBrain,
  IconBuilding,
  IconChartPie,
  IconFileText,
  IconNews,
  IconShieldOff,
} from '@tabler/icons-react';
import React, { useRef, useState } from 'react';
import type { DockGrupAdi, DockGrupMeta, IstihbaratModul } from '@/types/yuklenici';
import { getDurumEtiket, getGrupDurum, getGrupSonGuncelleme } from './modul-meta';

// ─── Ikon haritası ──────────────────────────────────────────────

const IKON_MAP: Record<string, React.ReactNode> = {
  IconChartPie: <IconChartPie size={20} stroke={1.5} />,
  IconBuilding: <IconBuilding size={20} stroke={1.5} />,
  IconShieldOff: <IconShieldOff size={20} stroke={1.5} />,
  IconNews: <IconNews size={20} stroke={1.5} />,
  IconBrain: <IconBrain size={20} stroke={1.5} />,
};

// ─── Props ──────────────────────────────────────────────────────

interface IstihbaratDockProps {
  /** 5 dock grubu */
  grupListesi: DockGrupMeta[];
  /** Backend'den gelen 8 modül durumu */
  moduller: IstihbaratModul[];
  /** Seçili dock grubu */
  seciliGrup: DockGrupAdi | null;
  /** Grup seçme callback */
  onGrupSec: (grup: DockGrupAdi) => void;
  /** Grup çalıştırma callback (tüm alt modülleri başlatır) */
  onGrupCalistir: (grup: DockGrupAdi) => void;
}

// ─── Component ──────────────────────────────────────────────────

export function IstihbaratDock({
  grupListesi,
  moduller,
  seciliGrup,
  onGrupSec,
  onGrupCalistir,
}: IstihbaratDockProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const dockRef = useRef<HTMLElement>(null);

  return (
    <nav
      className="yk-dock-container"
      ref={dockRef}
      onMouseLeave={() => setHoveredIdx(null)}
      aria-label="İstihbarat modülleri"
    >
      {grupListesi.map((meta, idx) => {
        const durum = getGrupDurum(meta.ad, moduller);
        const isActive = seciliGrup === meta.ad;
        const isAi = meta.ad === 'ai_arastirma';
        const isSirket = meta.ad === 'sirket_bilgileri';
        const sirketIdx = grupListesi.findIndex((g) => g.ad === 'sirket_bilgileri');

        // Neighbor detection for fisheye
        const isNeighbor = hoveredIdx !== null && Math.abs(hoveredIdx - idx) === 1;

        // Divider before & after sirket_bilgileri
        const showDividerBefore = idx === sirketIdx;
        const showDividerAfter = idx === sirketIdx;

        // Son güncelleme zamanı (grubun en yeni alt modülü)
        const sonGuncTs = getGrupSonGuncelleme(meta.ad, moduller);
        const sonGuncStr = sonGuncTs ? formatZaman(sonGuncTs) : 'Henüz çalıştırılmadı';

        return (
          <React.Fragment key={meta.ad}>
            {showDividerBefore && <span className="yk-dock-divider" />}
            <button
              type="button"
              className={[
                'yk-dock-item',
                isActive ? 'yk-dock-item-active' : '',
                isAi ? 'yk-dock-item-ai' : '',
                isSirket ? 'yk-dock-item-sirket' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-neighbor={isNeighbor && hoveredIdx !== idx ? '1' : undefined}
              onMouseEnter={() => setHoveredIdx(idx)}
              onClick={() => onGrupSec(meta.ad)}
              onDoubleClick={(e) => {
                e.preventDefault();
                if (durum !== 'calisiyor') onGrupCalistir(meta.ad);
              }}
              aria-label={meta.baslik}
              aria-pressed={isActive}
              style={{ border: 'none', background: 'transparent' }}
            >
              {/* Tooltip */}
              <div className="yk-dock-tooltip">
                <div className="yk-dock-tooltip-title">{meta.baslik}</div>
                <div className="yk-dock-tooltip-status">
                  {durum === 'calisiyor'
                    ? 'Çalışıyor...'
                    : durum === 'bekliyor'
                      ? 'Henüz çalıştırılmadı'
                      : `${getDurumEtiket(durum)} · ${sonGuncStr}`}
                </div>
              </div>

              {/* Ikon */}
              <div
                className={`yk-dock-icon ${isActive ? 'yk-dock-icon-active' : ''} ${isSirket ? 'yk-dock-icon-sirket' : ''}`}
              >
                {isSirket ? (
                  <IconBuilding size={26} stroke={1.6} />
                ) : (
                  IKON_MAP[meta.ikon] || <IconFileText size={20} stroke={1.5} />
                )}
              </div>

              {/* Durum noktası */}
              <span className="yk-dock-status-dot" data-status={durum} />
            </button>
            {showDividerAfter && <span className="yk-dock-divider" />}
          </React.Fragment>
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
