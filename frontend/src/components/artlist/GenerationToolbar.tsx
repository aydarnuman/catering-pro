'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  ScrollArea,
  Text,
  Textarea,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAdjustments,
  IconArrowsExchange,
  IconBolt,
  IconChartBar,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconGridDots,
  IconLayersSubtract,
  IconMinus,
  IconNote,
  IconPackage,
  IconPencil,
  IconPhoto,
  IconPlayerPlay,
  IconReceipt,
  IconSearch,
  IconSend,
  IconSparkles,
  IconTypography,
  IconUpload,
  IconVideo,
  IconVolume,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RealtimeIndicator } from '@/components/RealtimeIndicator';
import { useNotesModal } from '@/context/NotesContext';
import { ToolbarNotesWidget } from './ToolbarNotesWidget';

export type GenerationToolbarVariant = 'artlist' | 'catering';

export interface GenerationToolbarProps {
  /** 'artlist' = video/medya üretim demo, 'catering' = Catering Pro hızlı aksiyonlar */
  variant?: GenerationToolbarVariant;
  /** Catering: Arama modalını aç (Navbar ile kullanırken) */
  onSearchClick?: () => void;
  /** Catering: AI sohbeti aç (FloatingAIChat) */
  onAIClick?: () => void;
  /** Catering: toolbar açık mı (açılır kapanır) */
  expanded?: boolean;
  /** Catering: toolbar aç/kapa toggle */
  onToggle?: () => void;
}

const ARTLIST_LEFT = [
  { icon: IconPhoto, label: 'Görsel Ekle' },
  { icon: IconArrowsExchange, label: 'Dönüştür' },
  { icon: IconLayersSubtract, label: 'Katmanlar' },
];

const ARTLIST_MEDIA = [
  { icon: IconPhoto, label: 'Görsel' },
  { icon: IconVideo, label: 'Video' },
];

const ARTLIST_RIGHT = [
  { icon: IconTypography, label: 'Metin' },
  { icon: IconPencil, label: 'Çiz' },
];

const ARTLIST_BADGES = [
  { icon: null, label: 'Kling 2.6 Pro', gradient: true },
  { icon: IconGridDots, label: 'Oran' },
  { icon: IconClock, label: '5 sn' },
  { icon: IconVolume, label: 'Ses' },
  { icon: IconMinus, label: 'Negatif' },
  { icon: IconAdjustments, label: 'Ayarlar' },
];

const CATERING_LEFT = [
  { icon: IconUpload, label: 'Döküman Yükle', href: '/upload' },
  { icon: IconSearch, label: 'İhale / Arama', action: 'search' as const },
  { icon: IconNote, label: 'Hızlı Not', action: 'notes' as const },
];

const CATERING_MEDIA = [
  { icon: IconReceipt, label: 'Faturalar', href: '/muhasebe/faturalar' },
  { icon: IconChartBar, label: 'Raporlar', href: '/muhasebe/raporlar/dashboard' },
];

// Catering: sağ ikon sütunu yok (Hızlı İşlem badge'lerde). Tek giriş: metin + sarı buton.
const CATERING_RIGHT: Array<{ icon: typeof IconBolt; label: string; href?: string }> = [];

// Tek AI giriş noktası: toolbar metin kutusu + Gönder / AI'ya Sor butonu (open-ai-chat). AI Uzman badge kaldırıldı.
const CATERING_BADGES = [
  { icon: IconGridDots, label: 'İhaleler', href: '/tenders' },
  { icon: IconChartBar, label: 'Finans', href: '/muhasebe/finans' },
  { icon: IconPackage, label: 'Stok', href: '/muhasebe/stok' },
  { icon: IconBolt, label: 'Hızlı İşlem', href: '/tenders' },
  { icon: IconAdjustments, label: 'Ayarlar', href: '/ayarlar' },
];

/* ─── Liquid Gold Animation CSS ───
 *  Referans: Rafał Staromłyński – Liquid Gold Animation (Dribbble)
 *  Kalın metalik altın halka + sıvı metal akış efekti + 3D bevel derinliği
 */
const LIQUID_GOLD_CSS = `
/* --- Keyframes --- */
@keyframes lgold-flow {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes lgold-glow {
  0%, 100% {
    box-shadow:
      0 0 8px rgba(212,175,55,0.15),
      0 0 24px rgba(212,175,55,0.08),
      0 0 48px rgba(212,175,55,0.04);
  }
  50% {
    box-shadow:
      0 0 12px rgba(212,175,55,0.28),
      0 0 32px rgba(212,175,55,0.14),
      0 0 64px rgba(212,175,55,0.06);
  }
}
@keyframes lgold-shimmer {
  0%   { transform: translateX(-200%); }
  100% { transform: translateX(300%); }
}
/* İkon çerçevesi: dönen conic-gradient (metalik yüzük) */
@keyframes lgold-icon-rotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes lgold-icon-glow {
  0%, 100% {
    box-shadow: 0 0 6px rgba(212,175,55,0.18), 0 0 14px rgba(212,175,55,0.06);
  }
  50% {
    box-shadow: 0 0 10px rgba(212,175,55,0.32), 0 0 22px rgba(212,175,55,0.10);
  }
}

/* --- Altın Halka (Metalik Ring) --- */
.lgold-wrap {
  border-radius: 9999px;
  padding: 2.5px;
  background:
    linear-gradient(
      270deg,
      #3d2a06,
      #6b4c10,
      #96720e,
      #c49b1a,
      #dab42a,
      #f0d048,
      #ffd700,
      #f0d048,
      #dab42a,
      #c49b1a,
      #96720e,
      #6b4c10,
      #3d2a06
    );
  background-size: 300% 100%;
  animation: lgold-flow 6s ease infinite, lgold-glow 4s ease-in-out infinite;
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
}

/* Dış ışık hüzmesi (ambient glow) */
.lgold-wrap::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  background:
    linear-gradient(
      270deg,
      #3d2a06, #6b4c10, #c49b1a, #ffd700, #f0d048,
      #ffd700, #c49b1a, #6b4c10, #3d2a06
    );
  background-size: 300% 100%;
  animation: lgold-flow 6s ease infinite;
  filter: blur(16px);
  opacity: 0.30;
  z-index: -1;
  pointer-events: none;
  transition: all 0.4s ease;
}

/* Hover: halka kalınlaşır, ışık güçlenir */
.lgold-wrap:hover {
  padding: 3px;
  animation: lgold-flow 3s ease infinite, lgold-glow 2s ease-in-out infinite;
}
.lgold-wrap:hover::before {
  opacity: 0.50;
  filter: blur(20px);
  inset: -8px;
}

/* --- İç Buton (Koyu Cam) --- */
.lgold-btn-inner {
  position: relative;
  overflow: hidden;
  border-radius: 9999px !important;
  box-shadow:
    inset 0 1px 3px rgba(0,0,0,0.4),
    inset 0 -1px 2px rgba(212,175,55,0.06);
}

/* Shimmer sweep - yüzeyde kayan ışık yansıması */
.lgold-btn-inner::after {
  content: '';
  position: absolute;
  top: 0;
  left: -200%;
  width: 45%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,215,0,0.03) 20%,
    rgba(255,215,0,0.10) 45%,
    rgba(255,215,0,0.16) 50%,
    rgba(255,215,0,0.10) 55%,
    rgba(255,215,0,0.03) 80%,
    transparent 100%
  );
  animation: lgold-shimmer 5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  animation-delay: 1s;
  pointer-events: none;
  z-index: 10;
  border-radius: inherit;
}
.lgold-wrap:hover .lgold-btn-inner::after {
  animation-duration: 2.5s;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,215,0,0.06) 20%,
    rgba(255,215,0,0.18) 45%,
    rgba(255,215,0,0.28) 50%,
    rgba(255,215,0,0.18) 55%,
    rgba(255,215,0,0.06) 80%,
    transparent 100%
  );
}

/* ═══ İkon çerçevesi – Çok katmanlı Liquid Gold ═══ */

/* Katman 0: Sabit altın halka (base) – her zaman parlak altın */
.lgold-icon-frame {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(
    160deg,
    #d4af37 0%,
    #c49b28 20%,
    #b08820 40%,
    #a07a1c 60%,
    #b08820 80%,
    #c49b28 100%
  );
  outline: 1px solid rgba(0,0,0,0.35);
  box-shadow:
    0 0 8px rgba(212,175,55,0.18),
    0 0 16px rgba(212,175,55,0.06),
    0 2px 4px rgba(0,0,0,0.25);
  animation: lgold-icon-glow 4s ease-in-out infinite;
  transition: box-shadow 0.3s ease;
}

/* Katman 1: Ana ışık yansıması – parlak nokta döner */
.lgold-icon-frame::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150%;
  height: 150%;
  transform-origin: center;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    transparent 110deg,
    rgba(255,235,140,0.35) 145deg,
    rgba(255,245,180,0.6) 168deg,
    rgba(255,252,220,0.85) 180deg,
    rgba(255,245,180,0.6) 192deg,
    rgba(255,235,140,0.35) 215deg,
    transparent 250deg,
    transparent 360deg
  );
  animation: lgold-icon-rotate 5s linear infinite;
}

/* Katman 2: İkincil yansıma – karşı tarafta daha yumuşak */
.lgold-icon-frame::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150%;
  height: 150%;
  transform-origin: center;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    transparent 290deg,
    rgba(255,225,120,0.12) 325deg,
    rgba(255,240,170,0.22) 345deg,
    rgba(255,225,120,0.12) 365deg
  );
  animation: lgold-icon-rotate 5s linear infinite;
}

/* Katman 3: İç koyu alan – halka ile arasında 3D derinlik */
.lgold-icon-frame-inner {
  position: absolute;
  inset: 3px;
  z-index: 2;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 1px 3px rgba(0,0,0,0.5),
    inset 0 -1px 2px rgba(212,175,55,0.08),
    inset 0 0 1px rgba(0,0,0,0.3);
}

/* Hover: glow güçlenir */
.lgold-icon-frame:hover {
  box-shadow:
    0 0 12px rgba(212,175,55,0.30),
    0 0 24px rgba(212,175,55,0.10),
    0 2px 6px rgba(0,0,0,0.25);
}
.lgold-icon-frame:hover::before {
  animation-duration: 2.5s;
}
.lgold-icon-frame:hover::after {
  animation-duration: 2.5s;
}

/* ═══ macOS Dock Efekti ═══ */

@keyframes dock-appear {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(20px) scale(0.8);
  }
  60% {
    opacity: 1;
    transform: translateX(-50%) translateY(-4px) scale(1.03);
  }
  80% {
    transform: translateX(-50%) translateY(2px) scale(0.99);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes dock-bounce {
  0%   { transform: translateY(0); }
  20%  { transform: translateY(-10px); }
  40%  { transform: translateY(-3px); }
  55%  { transform: translateY(-7px); }
  70%  { transform: translateY(-1px); }
  85%  { transform: translateY(-3px); }
  100% { transform: translateY(0); }
}

@keyframes dock-reflection-pulse {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 0.55; }
}

/* Dock konteyneri – sabit pozisyon */
.dock-container {
  position: fixed;
  left: 50%;
  z-index: 40;
  transform: translateX(-50%);
  animation: dock-appear 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

/* Dock shelf – sadece yapısal wrapper, görsel yok */
.dock-shelf {
  position: relative;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Dock magnification – hover ile büyüme (macOS dock efekti) */
.dock-shelf:hover {
  transform: scale(1.08) translateY(-4px);
}

/* Dock active – tıklama anında geri çekilme */
.dock-shelf:active {
  transform: scale(0.95) translateY(0px);
  transition-duration: 0.12s;
}

/* Dock reflection – altındaki yansıma */
.dock-reflection {
  position: absolute;
  bottom: -10px;
  left: 12%;
  right: 12%;
  height: 8px;
  border-radius: 50%;
  pointer-events: none;
  animation: dock-reflection-pulse 4s ease-in-out infinite;
}
.dock-reflection-dark {
  background: radial-gradient(
    ellipse at center,
    rgba(212,175,55,0.08) 0%,
    rgba(255,255,255,0.03) 40%,
    transparent 70%
  );
}
.dock-reflection-light {
  background: radial-gradient(
    ellipse at center,
    rgba(0,0,0,0.04) 0%,
    rgba(0,0,0,0.02) 40%,
    transparent 70%
  );
}

/* Dock item (buton) – cam efekti rafın içinde */
.dock-item {
  border-radius: 14px !important;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
}
.dock-item:hover {
  transform: translateY(-1px);
}

/* Active indicator – macOS'taki çalışan app noktası */
.dock-indicator {
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  pointer-events: none;
}
.dock-indicator-dark {
  background: rgba(212,175,55,0.6);
  box-shadow: 0 0 6px rgba(212,175,55,0.3);
}
.dock-indicator-light {
  background: rgba(120,90,20,0.4);
  box-shadow: 0 0 4px rgba(120,90,20,0.2);
}
`;

export function GenerationToolbar({
  variant = 'artlist',
  onSearchClick,
  onAIClick,
  expanded = true,
  onToggle,
}: GenerationToolbarProps) {
  const [prompt, setPrompt] = useState('');
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { openNotes: openNotesModal } = useNotesModal();

  const isCatering = variant === 'catering';
  const isCollapsed = isCatering && !expanded;

  // Inject liquid gold animation styles (client-side only)
  useEffect(() => {
    const id = 'liquid-gold-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = LIQUID_GOLD_CSS;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  const leftIcons = isCatering ? CATERING_LEFT : ARTLIST_LEFT;
  const mediaButtons = isCatering ? CATERING_MEDIA : ARTLIST_MEDIA;
  const rightIcons = isCatering ? CATERING_RIGHT : ARTLIST_RIGHT;
  const toolbarBadges = isCatering ? CATERING_BADGES : ARTLIST_BADGES;

  const placeholder = isCatering ? 'Mesajınızı yazın…' : 'Yapay zeka ile ne oluşturmak istersiniz?';

  const ctaLabel = isCatering
    ? prompt.trim()
      ? 'Gönder'
      : "AI'ya Sor"
    : isMobile
      ? 'Üret'
      : 'Oluştur';

  const handleSubmit = () => {
    const text = prompt.trim();
    if (isCatering) {
      window.dispatchEvent(
        new CustomEvent('open-ai-chat', { detail: { message: text || undefined } })
      );
      onAIClick?.();
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Artlist Toolkit: ultra şeffaf cam – neredeyse sadece blur
  const toolbarGlassStyle = {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.18)',
    backdropFilter: 'blur(48px) saturate(180%)',
    WebkitBackdropFilter: 'blur(48px) saturate(180%)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.12)'}`,
    boxShadow: 'none',
  };

  // Kapalıyken: profesyonel asistan FAB (mobilde kompakt)
  const fabIconSize = isMobile ? 30 : 36;
  const fabIconInner = isMobile ? 16 : 18;
  if (isCollapsed) {
    return (
      <div className="dock-container" style={{ bottom: isMobile ? 16 : 24 }}>
        {/* macOS Dock shelf – görünmez wrapper, sadece magnification + bounce */}
        <div className="dock-shelf">
          <Tooltip
            label="Asistan panelini aç"
            position="top"
            withArrow
            styles={{
              tooltip: {
                fontSize: isMobile ? 11 : 12,
                fontWeight: 500,
                letterSpacing: '0.01em',
                padding: isMobile ? '6px 10px' : '8px 12px',
                borderRadius: 10,
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.12)',
              },
            }}
          >
            <Button
              className="asistan-ac-btn dock-item"
              onClick={onToggle}
              size={isMobile ? 'sm' : 'md'}
              radius="xl"
              leftSection={
                /* Dönen conic-gradient metalik yüzük – Liquid Gold referansı */
                <div
                  className="lgold-icon-frame"
                  style={{ width: fabIconSize, height: fabIconSize }}
                >
                  <div
                    className="lgold-icon-frame-inner"
                    style={{
                      background: isDark
                        ? 'linear-gradient(160deg, rgba(24,20,12,0.97), rgba(12,10,5,0.99))'
                        : 'linear-gradient(160deg, rgba(255,252,240,0.97), rgba(248,244,230,0.99))',
                    }}
                  >
                    <IconSparkles
                      size={fabIconInner}
                      stroke={2}
                      style={{ color: isDark ? '#fff' : '#92400e' }}
                    />
                  </div>
                </div>
              }
              rightSection={<IconChevronUp size={isMobile ? 14 : 16} style={{ opacity: 0.7 }} />}
              styles={{
                root: {
                  borderRadius: 9999,
                  paddingLeft: isMobile ? 12 : 16,
                  paddingRight: isMobile ? 14 : 18,
                  minHeight: isMobile ? 40 : 44,
                  fontSize: isMobile ? 13 : undefined,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: isDark
                    ? '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)'
                    : '0 4px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)',
                },
              }}
              style={{
                ...toolbarGlassStyle,
                color: isDark ? 'rgba(255,255,255,0.96)' : 'rgba(0,0,0,0.88)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)'}`,
              }}
            >
              Asistanı aç
            </Button>
          </Tooltip>

          {/* Active indicator – macOS dock noktası */}
          <div
            className={`dock-indicator ${isDark ? 'dock-indicator-dark' : 'dock-indicator-light'}`}
          />
        </div>

        {/* Dock reflection – yansıma */}
        <div
          className={`dock-reflection ${isDark ? 'dock-reflection-dark' : 'dock-reflection-light'}`}
        />
      </div>
    );
  }

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: isMobile ? 16 : 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        width: '100%',
        maxWidth: isMobile ? 'calc(100% - 32px)' : 960,
        padding: isMobile ? '0 8px' : 0,
      }}
    >
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          ...toolbarGlassStyle,
          borderRadius: 24,
          overflow: 'hidden',
        }}
      >
        {/* Üst satır: solda bugünün tarihi, sağda LIVE + kapat butonu - Catering */}
        {isCatering && onToggle && (
          <Group
            justify="space-between"
            p="xs"
            onClick={onToggle}
            style={{
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)'}`,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Text size="xs" c="dimmed" style={{ fontWeight: 500, marginLeft: 8 }}>
              {new Date().toLocaleDateString('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <Group gap="sm">
              <RealtimeIndicator />
              <Tooltip
                label={expanded ? "Toolbar'ı kapat" : "Toolbar'ı aç"}
                position="bottom"
                withArrow
              >
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  radius="xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                  }}
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  {expanded ? <IconChevronDown size={18} /> : <IconChevronUp size={18} />}
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        )}
        {/* Ana Input Alanı - Artlist Toolkit: tek sade blok */}
        <Group gap="md" align="flex-start" p="sm" wrap="nowrap">
          {/* Sol İkonlar */}
          {!isMobile && (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
              {leftIcons.map((item) => {
                const actionIcon = (
                  <ActionIcon
                    variant="filled"
                    size="lg"
                    radius="xl"
                    onClick={
                      isCatering && 'action' in item
                        ? item.action === 'search'
                          ? () => {
                              window.dispatchEvent(new CustomEvent('open-search-modal'));
                              onSearchClick?.();
                            }
                          : item.action === 'notes'
                            ? () => openNotesModal()
                            : undefined
                        : undefined
                    }
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      color: isDark ? '#d4d4d4' : '#374151',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <item.icon size={20} />
                  </ActionIcon>
                );
                const btn =
                  isCatering && 'href' in item && item.href ? (
                    <Link href={item.href}>{actionIcon}</Link>
                  ) : (
                    actionIcon
                  );
                return (
                  <Tooltip
                    key={item.label}
                    label={item.label}
                    position="right"
                    withArrow
                    styles={{
                      tooltip: {
                        fontSize: 11,
                        fontWeight: 400,
                        color: 'rgba(255,255,255,0.78)',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                      },
                    }}
                  >
                    {btn}
                  </Tooltip>
                );
              })}
            </Box>
          )}

          {/* Sol Medya / Hızlı Erişim Butonları */}
          {!isMobile && (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
              {mediaButtons.map((item) => {
                const actionIcon = (
                  <ActionIcon
                    variant="outline"
                    size="lg"
                    radius="xl"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      color: isDark ? '#a3a3a3' : '#6b7280',
                      backgroundColor: 'transparent',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <item.icon size={20} />
                  </ActionIcon>
                );
                const btn =
                  isCatering && 'href' in item && item.href ? (
                    <Link href={item.href}>{actionIcon}</Link>
                  ) : (
                    actionIcon
                  );
                return (
                  <Tooltip
                    key={item.label}
                    label={item.label}
                    position="right"
                    withArrow
                    styles={{
                      tooltip: {
                        fontSize: 11,
                        fontWeight: 400,
                        color: 'rgba(255,255,255,0.78)',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                      },
                    }}
                  >
                    {btn}
                  </Tooltip>
                );
              })}
            </Box>
          )}

          {/* Metin Girişi – Artlist: sade placeholder, label yok */}
          <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              minRows={isMobile ? 2 : 1}
              maxRows={5}
              autosize
              styles={{
                input: {
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.95)',
                  fontSize: isMobile ? 14 : 17,
                  fontWeight: 400,
                  padding: 0,
                  resize: 'none',
                  '&::placeholder': {
                    color: 'rgba(255,255,255,0.42)',
                  },
                },
              }}
            />
          </Box>

          {/* Sağ İkonlar - Catering'de boş (tek giriş: sarı buton) */}
          {!isMobile && rightIcons.length > 0 && (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
              {rightIcons.map((item) => {
                const actionIcon = (
                  <ActionIcon
                    variant="subtle"
                    size="lg"
                    radius="xl"
                    onClick={
                      isCatering && 'action' in item && item.action === 'ai' ? onAIClick : undefined
                    }
                    style={{
                      color: '#a3a3a3',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <item.icon size={20} />
                  </ActionIcon>
                );
                const btn =
                  isCatering && 'href' in item && item.href ? (
                    <Link href={item.href}>{actionIcon}</Link>
                  ) : (
                    actionIcon
                  );
                return (
                  <Tooltip
                    key={item.label}
                    label={item.label}
                    position="left"
                    withArrow
                    styles={{
                      tooltip: {
                        fontSize: 11,
                        fontWeight: 400,
                        color: 'rgba(255,255,255,0.78)',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                      },
                    }}
                  >
                    {btn}
                  </Tooltip>
                );
              })}
            </Box>
          )}

          {/* Notlar / Ajanda: panelin içinde sağ sütun (masaüstü) */}
          {isCatering && !isMobile && (
            <Box
              style={{
                width: 260,
                flexShrink: 0,
                maxHeight: 140,
                overflowY: 'auto',
                borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)'}`,
                paddingLeft: 14,
              }}
            >
              <ToolbarNotesWidget />
            </Box>
          )}
        </Group>

        {/* Alt Toolbar - Artlist: ince çizgi */}
        <Box
          px="md"
          py="sm"
          style={{
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Group justify="space-between" wrap="nowrap" gap="md">
            {/* Badge'ler - Mobilde kaydırılabilir */}
            <ScrollArea type="never" offsetScrollbars={false} style={{ flex: 1 }}>
              <Group gap={10} wrap="nowrap">
                {toolbarBadges.map((badge) => {
                  const badgeEl = (
                    <Badge
                      key={badge.label}
                      size="lg"
                      radius="xl"
                      variant="outline"
                      leftSection={
                        'gradient' in badge && badge.gradient ? (
                          <Box
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: isCatering
                                ? 'linear-gradient(135deg, #e6c530 0%, #ca8a04 100%)'
                                : 'linear-gradient(135deg, #60a5fa 0%, #a855f7 100%)',
                            }}
                          />
                        ) : badge.icon ? (
                          <badge.icon size={14} />
                        ) : null
                      }
                      styles={{
                        root: {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                          color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.75)',
                          cursor: 'pointer',
                          padding: '8px 14px',
                          height: 'auto',
                          flexShrink: 0,
                          transition: 'all 0.2s ease',
                          textDecoration: 'none',
                          borderRadius: 9999,
                          '&:hover': {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                            color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
                          },
                        },
                        label: {
                          fontSize: 12,
                          fontWeight: 500,
                          letterSpacing: '0.02em',
                        },
                      }}
                    >
                      {badge.label}
                    </Badge>
                  );
                  return isCatering && 'href' in badge && badge.href ? (
                    <Link key={badge.label} href={badge.href}>
                      {badgeEl}
                    </Link>
                  ) : (
                    <span key={badge.label}>{badgeEl}</span>
                  );
                })}
              </Group>
            </ScrollArea>

            {/* CTA: Artlist Toolkit tarzı - pill, yumuşak vurgu, gölge yok */}
            <Button
              radius="xl"
              size={isMobile ? 'sm' : 'md'}
              fw={600}
              px={isMobile ? 'md' : 'xl'}
              leftSection={
                isCatering ? (
                  prompt.trim() ? (
                    <IconSend size={16} />
                  ) : (
                    <IconSparkles size={16} />
                  )
                ) : (
                  <IconPlayerPlay size={16} />
                )
              }
              onClick={isCatering ? handleSubmit : undefined}
              styles={{
                root: {
                  backgroundColor: isDark ? 'rgba(230, 197, 48, 0.2)' : 'rgba(230, 197, 48, 0.9)',
                  color: isDark ? '#e6c530' : '#0a0a0a',
                  flexShrink: 0,
                  border: isDark
                    ? '1px solid rgba(230, 197, 48, 0.35)'
                    : '1px solid rgba(230, 197, 48, 0.5)',
                  boxShadow: 'none',
                  borderRadius: 9999,
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(230, 197, 48, 0.28)' : 'rgba(230, 197, 48, 1)',
                    borderColor: isDark ? 'rgba(230, 197, 48, 0.5)' : 'rgba(230, 197, 48, 0.6)',
                  },
                },
              }}
            >
              {ctaLabel}
            </Button>
          </Group>
        </Box>
      </Box>
      {/* Mobil: notlar panelin altında */}
      {isCatering && isMobile && (
        <Box style={{ maxHeight: 120, overflowY: 'auto', marginTop: 8, width: '100%' }}>
          <ToolbarNotesWidget />
        </Box>
      )}
    </Box>
  );
}
