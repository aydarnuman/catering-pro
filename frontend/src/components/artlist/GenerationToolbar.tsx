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
import { useState } from 'react';
import { RealtimeIndicator } from '@/components/RealtimeIndicator';
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
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');

  const isCatering = variant === 'catering';
  const isCollapsed = isCatering && !expanded;
  const leftIcons = isCatering ? CATERING_LEFT : ARTLIST_LEFT;
  const mediaButtons = isCatering ? CATERING_MEDIA : ARTLIST_MEDIA;
  const rightIcons = isCatering ? CATERING_RIGHT : ARTLIST_RIGHT;
  const toolbarBadges = isCatering ? CATERING_BADGES : ARTLIST_BADGES;

  const placeholder = isCatering
    ? 'Mesajınızı yazın…'
    : 'Yapay zeka ile ne oluşturmak istersiniz?';

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
  const fabIconSize = isMobile ? 22 : 28;
  const fabIconInner = isMobile ? 14 : 16;
  if (isCollapsed) {
    return (
      <Box
        style={{
          position: 'fixed',
          bottom: isMobile ? 16 : 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
        }}
      >
        <Tooltip
          label="Asistan panelini aç"
          position="bottom"
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
            className="asistan-ac-btn"
            onClick={onToggle}
            size={isMobile ? 'sm' : 'md'}
            radius="xl"
            leftSection={
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: fabIconSize,
                  height: fabIconSize,
                  borderRadius: isMobile ? 8 : 10,
                  background: isDark
                    ? 'rgba(167, 139, 250, 0.18)'
                    : 'rgba(124, 58, 237, 0.12)',
                  color: isDark ? '#a78bfa' : '#7c3aed',
                }}
              >
                <IconSparkles size={fabIconInner} stroke={2.25} />
              </Box>
            }
            rightSection={
              <IconChevronUp size={isMobile ? 14 : 16} style={{ opacity: 0.85 }} />
            }
            styles={{
              root: {
                borderRadius: 9999,
                paddingLeft: isMobile ? 12 : 16,
                paddingRight: isMobile ? 14 : 18,
                minHeight: isMobile ? 40 : 44,
                fontSize: isMobile ? 13 : undefined,
                fontWeight: 600,
                letterSpacing: '0.02em',
                transition: 'all 0.2s ease',
                boxShadow: isDark
                  ? '0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)'
                  : '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: isDark
                    ? '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(167,139,250,0.15)'
                    : '0 8px 32px rgba(124,58,237,0.12), 0 0 0 1px rgba(124,58,237,0.08)',
                },
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
      </Box>
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
          <Group justify="space-between" p="xs" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)'}` }}>
            <Text size="xs" c="dimmed" style={{ fontWeight: 500 }}>
              {new Date().toLocaleDateString('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <Group gap="sm">
              <RealtimeIndicator />
              <Tooltip label="Toolbar'ı kapat" position="bottom" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  radius="xl"
                  onClick={onToggle}
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  <IconChevronDown size={18} />
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
                            ? () => window.dispatchEvent(new CustomEvent('open-notes-modal'))
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
                  border: isDark ? '1px solid rgba(230, 197, 48, 0.35)' : '1px solid rgba(230, 197, 48, 0.5)',
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
