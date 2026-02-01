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
import { useEffect, useMemo, useState } from 'react';
import { RealtimeIndicator } from '@/components/RealtimeIndicator';
import {
  spacing,
  radius,
  sizes,
  animations,
} from '@/styles/neumorphism';
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

export function GenerationToolbar({
  variant = 'artlist',
  onSearchClick,
  onAIClick,
  expanded = true,
  onToggle,
}: GenerationToolbarProps) {
  const [prompt, setPrompt] = useState('');
  const [mounted, setMounted] = useState(false);
  const { colorScheme } = useMantineColorScheme();
  const isDark = mounted ? colorScheme === 'dark' : true;
  const isMobileQuery = useMediaQuery('(max-width: 768px)');
  const isMobile = mounted ? isMobileQuery : false;
  
  // Mount check for SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  const isCatering = variant === 'catering';
  const isCollapsed = isCatering && !expanded;
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

  // Glassmorphism: ultra transparent with strong blur
  const toolbarStyle = useMemo(() => ({
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.18)',
    backdropFilter: 'blur(48px) saturate(180%)',
    WebkitBackdropFilter: 'blur(48px) saturate(180%)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.12)'}`,
    boxShadow: 'none',
  }), [isDark]);

  // Kapalıyken: Glassmorphism FAB - professional assistant button
  const fabIconSize = isMobile ? sizes.icon.lg : sizes.icon.xl;
  const fabIconInner = isMobile ? sizes.icon.sm : sizes.icon.md - 2;
  if (isCollapsed) {
    return (
      <Box
        style={{
          position: 'fixed',
          bottom: isMobile ? spacing.md : spacing.lg,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
        }}
      >
        <Tooltip
          label="Asistan panelini aç"
          position="top"
          withArrow
          styles={{
            tooltip: {
              fontSize: isMobile ? 11 : 12,
              fontWeight: 500,
              letterSpacing: '0.01em',
              padding: isMobile ? `${spacing.sm - 2}px ${spacing.sm + 2}px` : `${spacing.sm}px ${spacing.md - 4}px`,
              borderRadius: radius.md,
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.12)',
            },
          }}
        >
          <Button
            className="asistan-ac-btn"
            onClick={onToggle}
            size={isMobile ? 'sm' : 'md'}
            radius={radius.full}
            leftSection={
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: fabIconSize,
                  height: fabIconSize,
                  borderRadius: radius.md,
                  background: isDark ? 'rgba(167, 139, 250, 0.18)' : 'rgba(124, 58, 237, 0.12)',
                  color: isDark ? '#a78bfa' : '#7c3aed',
                }}
              >
                <IconSparkles size={fabIconInner} stroke={2.25} />
              </Box>
            }
            rightSection={<IconChevronUp size={isMobile ? sizes.icon.xs : sizes.icon.sm} style={{ opacity: 0.85 }} />}
            styles={{
              root: {
                borderRadius: radius.full,
                paddingLeft: isMobile ? spacing.md - 4 : spacing.md,
                paddingRight: isMobile ? spacing.md - 2 : spacing.md + 2,
                minHeight: isMobile ? sizes.touchTarget.min : sizes.touchTarget.comfortable,
                fontSize: isMobile ? 13 : undefined,
                fontWeight: 600,
                letterSpacing: '0.02em',
                transition: `all ${animations.transition.normal}`,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(48px) saturate(180%)',
                boxShadow: isDark
                  ? '0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)'
                  : '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)'}`,
                color: isDark ? 'rgba(255,255,255,0.96)' : 'rgba(0,0,0,0.88)',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: isDark
                    ? '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(167,139,250,0.15)'
                    : '0 8px 32px rgba(124,58,237,0.12), 0 0 0 1px rgba(124,58,237,0.08)',
                },
                '&:active': {
                  transform: 'translateY(0) scale(0.98)',
                },
              },
            }}
          >
            Asistanı aç
          </Button>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: isMobile ? spacing.md : spacing.lg,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        width: '100%',
        maxWidth: isMobile ? `calc(100% - ${spacing.xl}px)` : 960,
        padding: isMobile ? `0 ${spacing.sm}px` : 0,
      }}
    >
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          ...toolbarStyle,
          borderRadius: radius.xxl,
          overflow: 'hidden',
        }}
      >
        {/* Üst satır: solda bugünün tarihi, sağda LIVE + kapat butonu - Catering - Glassmorphism */}
        {isCatering && onToggle && (
          <Group
            justify="space-between"
            p={spacing.sm}
            style={{
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)'}`,
            }}
          >
            <Text size="xs" c="dimmed" style={{ fontWeight: 500 }}>
              {new Date().toLocaleDateString('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <Group gap={spacing.sm}>
              <RealtimeIndicator />
              <Tooltip label="Toolbar'ı kapat" position="bottom" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  radius={radius.md}
                  onClick={onToggle}
                  style={{ 
                    color: 'rgba(255,255,255,0.6)',
                    transition: `all ${animations.transition.fast}`,
                  }}
                  className="toolbar-close-btn"
                >
                  <IconChevronDown size={sizes.icon.md - 2} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        )}
        {/* Ana Input Alanı - Neumorphism: soft elevated panel */}
        <Group gap={spacing.md} align="flex-start" p={spacing.sm} wrap="nowrap">
          {/* Sol İkonlar - Glassmorphism buttons */}
          {!isMobile && (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, paddingTop: spacing.xs }}>
              {leftIcons.map((item) => {
                const actionIcon = (
                  <ActionIcon
                    variant="filled"
                    size="lg"
                    radius={radius.lg}
                    onClick={
                      isCatering && 'action' in item
                        ? item.action === 'search'
                          ? () => {
                              window.dispatchEvent(new CustomEvent('open-search-modal'));
                              onSearchClick?.();
                            }
                          : item.action === 'notes'
                            ? () => window.dispatchEvent(new CustomEvent('open-notes-modal'))
                            : undefined
                        : undefined
                    }
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      color: isDark ? '#d4d4d4' : '#374151',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                      transition: `all ${animations.transition.normal}`,
                    }}
                    className="toolbar-action-btn"
                  >
                    <item.icon size={sizes.icon.md} />
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

          {/* Sol Medya / Hızlı Erişim Butonları - Glassmorphism outline */}
          {!isMobile && (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, paddingTop: spacing.xs }}>
              {mediaButtons.map((item) => {
                const actionIcon = (
                  <ActionIcon
                    variant="outline"
                    size="lg"
                    radius={radius.lg}
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      color: isDark ? '#a3a3a3' : '#6b7280',
                      backgroundColor: 'transparent',
                      transition: `all ${animations.transition.normal}`,
                    }}
                    className="toolbar-action-btn"
                  >
                    <item.icon size={sizes.icon.md} />
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

          {/* Metin Girişi – Glassmorphism: transparent input field */}
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

          {/* Sağ İkonlar - Glassmorphism - Catering'de boş */}
          {!isMobile && rightIcons.length > 0 && (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, paddingTop: spacing.xs }}>
              {rightIcons.map((item) => {
                const actionIcon = (
                  <ActionIcon
                    variant="subtle"
                    size="lg"
                    radius={radius.lg}
                    onClick={
                      isCatering && 'action' in item && item.action === 'ai' ? onAIClick : undefined
                    }
                    style={{
                      color: '#a3a3a3',
                      transition: `all ${animations.transition.normal}`,
                    }}
                    className="toolbar-action-btn"
                  >
                    <item.icon size={sizes.icon.md} />
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

          {/* Notlar / Ajanda: panelin içinde sağ sütun (masaüstü) - Glassmorphism */}
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

        {/* Alt Toolbar - Glassmorphism: thin border */}
        <Box
          px={spacing.md}
          py={spacing.sm}
          style={{
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Group justify="space-between" wrap="nowrap" gap={spacing.md}>
            {/* Badge'ler - Mobilde kaydırılabilir - Glassmorphism pills */}
            <ScrollArea type="never" offsetScrollbars={false} style={{ flex: 1 }}>
              <Group gap={10} wrap="nowrap">
                {toolbarBadges.map((badge) => {
                  const badgeEl = (
                    <Badge
                      key={badge.label}
                      size="lg"
                      radius={radius.full}
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
                          transition: `all ${animations.transition.normal}`,
                          textDecoration: 'none',
                          borderRadius: radius.full,
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

            {/* CTA: Glassmorphism - accent pill button */}
            <Button
              radius={radius.full}
              size={isMobile ? 'sm' : 'md'}
              fw={600}
              px={isMobile ? spacing.md : spacing.xl}
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
                  borderRadius: radius.full,
                  minHeight: sizes.touchTarget.min,
                  transition: `all ${animations.transition.normal}`,
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
      {/* Mobil: notlar panelin altında - Glassmorphism */}
      {isCatering && isMobile && (
        <Box style={{ maxHeight: 120, overflowY: 'auto', marginTop: spacing.sm, width: '100%' }}>
          <ToolbarNotesWidget />
        </Box>
      )}
      
      {/* Global styles for toolbar animations */}
      <style jsx global>{`
        .toolbar-action-btn:hover {
          transform: translateY(-2px) scale(1.05);
          background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
          border-color: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'} !important;
        }
        .toolbar-action-btn:active {
          transform: translateY(0) scale(0.95);
        }
        .toolbar-close-btn:hover {
          background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'} !important;
          transform: scale(1.1);
        }
        .toolbar-close-btn:active {
          transform: scale(0.95);
        }
        @media (prefers-reduced-motion: reduce) {
          .toolbar-action-btn, .toolbar-close-btn, .asistan-ac-btn {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </Box>
  );
}
