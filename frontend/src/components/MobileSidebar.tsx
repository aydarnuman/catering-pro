'use client';

import {
  Avatar,
  Badge,
  Box,
  Group,
  ScrollArea,
  Stack,
  Text,
  Transition,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconBookmark,
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconBuildingStore,
  IconCalculator,
  IconChartBar,
  IconChartPie,
  IconChevronRight,
  IconDeviceMobile,
  IconHome,
  IconList,
  IconLogout,
  IconPackage,
  IconReceipt,
  IconSettings,
  IconShieldLock,
  IconShoppingCart,
  IconSparkles,
  IconToolsKitchen2,
  IconUser,
  IconUserCircle,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getShadow,
  getColors,
  neuColors,
  spacing,
  radius,
  sizes,
  animations,
} from '@/styles/neumorphism';

interface MobileSidebarProps {
  opened: boolean;
  onClose: () => void;
  user: { name?: string; email: string } | null;
  isAdmin: boolean;
  onLogout: () => void;
}

interface MenuItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  permission?: string; // Yetki kontrolü için
}

interface MenuGroup {
  title: string;
  color: string;
  gradient: string;
  permission?: string; // Grup genelinde yetki
  items: MenuItem[];
}

// Statik menü tanımı - yetki kontrolü dinamik olarak yapılacak
const allMenuGroups: MenuGroup[] = [
  {
    title: 'İhale Merkezi',
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
    permission: 'ihale',
    items: [
      { label: 'İhale Listesi', href: '/tenders', icon: IconList },
      {
        label: 'Yükle & Analiz',
        href: '/upload',
        icon: IconSparkles,
        badge: 'AI',
        badgeColor: 'violet',
      },
      { label: 'İhale Takibim', href: '/tracking', icon: IconBookmark },
    ],
  },
  {
    title: 'Finans',
    color: '#14B8A6',
    gradient: 'linear-gradient(135deg, #14B8A6 0%, #10B981 100%)',
    items: [
      { label: 'Dashboard', href: '/muhasebe', icon: IconChartPie },
      {
        label: 'Finans Merkezi',
        href: '/muhasebe/finans',
        icon: IconWallet,
        permission: 'kasa_banka',
      },
      { label: 'Faturalar', href: '/muhasebe/faturalar', icon: IconReceipt, permission: 'fatura' },
      { label: 'Raporlar', href: '/muhasebe/raporlar', icon: IconChartBar, permission: 'rapor' },
    ],
  },
  {
    title: 'Operasyon',
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
    items: [
      { label: 'Stok Takibi', href: '/muhasebe/stok', icon: IconPackage, permission: 'stok' },
      {
        label: 'Satın Alma',
        href: '/muhasebe/satin-alma',
        icon: IconShoppingCart,
        permission: 'stok',
      },
      {
        label: 'Menü Planlama',
        href: '/muhasebe/menu-planlama',
        icon: IconToolsKitchen2,
        permission: 'planlama',
      },
      {
        label: 'Personel',
        href: '/muhasebe/personel',
        icon: IconUserCircle,
        permission: 'personel',
      },
      {
        label: 'Demirbaş',
        href: '/muhasebe/demirbas',
        icon: IconBuildingStore,
        permission: 'demirbas',
      },
    ],
  },
  {
    title: 'Sosyal Medya',
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
    permission: 'sosyal_medya',
    items: [
      { label: 'Dashboard', href: '/sosyal-medya', icon: IconDeviceMobile },
      { label: 'Instagram', href: '/sosyal-medya/instagram', icon: IconBrandInstagram },
      { label: 'WhatsApp', href: '/sosyal-medya/whatsapp', icon: IconBrandWhatsapp },
    ],
  },
  {
    title: 'Sistem',
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    permission: 'ayarlar',
    items: [{ label: 'Ayarlar', href: '/ayarlar', icon: IconSettings }],
  },
];

export function MobileSidebar({ opened, onClose, user, isAdmin, onLogout }: MobileSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { canView, isSuperAdmin, loading: permLoading, error: permError } = usePermissions();
  
  // Neumorphism colors
  const colors = useMemo(() => getColors(isDark), [isDark]);
  
  // Responsive breakpoints
  const isSmallMobile = useMediaQuery('(max-width: 480px)');

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Yetkilere göre filtrelenmiş menü grupları
  const menuGroups = useMemo(() => {
    // Fallback: Yetkiler yüklenemediğinde veya loading durumunda tüm sayfaları göster
    const safeCanView = (module: string) => {
      if (permLoading || permError) return true;
      if (!canView) return true;
      return canView(module);
    };

    const safeIsSuperAdmin = permLoading || permError ? false : isSuperAdmin;

    return allMenuGroups
      .map((group) => {
        // Grup genelinde yetki kontrolü
        if (group.permission && !safeIsSuperAdmin && !safeCanView(group.permission)) {
          return null;
        }

        // Her item için yetki kontrolü
        const filteredItems = group.items.filter((item) => {
          if (!item.permission) return true; // Yetki tanımlanmamışsa göster
          return safeIsSuperAdmin || safeCanView(item.permission);
        });

        // Hiç item kalmadıysa grubu gösterme
        if (filteredItems.length === 0) return null;

        return { ...group, items: filteredItems };
      })
      .filter(Boolean) as MenuGroup[];
  }, [canView, isSuperAdmin, permLoading, permError]);

  const getInitials = (name: string) => {
    return (
      (name ?? '')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?'
    );
  };

  const handleNavigation = (href: string) => {
    // Haptic feedback for mobile
    if (typeof window !== 'undefined' && 'vibrate' in navigator && isSmallMobile) {
      navigator.vibrate(10); // Subtle vibration
    }
    onClose();
    router.push(href);
  };

  // Close on backdrop click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (opened) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [opened, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (opened) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [opened]);

  // Keyboard accessibility - ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opened) {
        onClose();
      }
    };

    if (opened) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [opened, onClose]);

  return (
    <>
      {/* Backdrop - Neumorphism: deeper blur */}
      <Transition mounted={opened} transition="fade" duration={250}>
        {(styles) => (
          <Box
            style={{
              ...styles,
              position: 'fixed',
              inset: 0,
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 199,
            }}
          />
        )}
      </Transition>

      {/* Sidebar - Glassmorphism: transparent with blur */}
      <Transition 
        mounted={opened} 
        transition="slide-left" 
        duration={isSmallMobile ? 200 : 280}
      >
        {(styles) => (
          <Box
            ref={sidebarRef}
            style={{
              ...styles,
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: isSmallMobile ? '90%' : '85%',
              maxWidth: isSmallMobile ? 320 : 360,
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: isDark ? 'rgba(13, 17, 23, 0.85)' : 'rgba(250, 251, 252, 0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.3)',
              borderLeft: `1px solid ${colors.borderSubtle}`,
            }}
          >
            {/* Hero Section with Logo – Glassmorphism: transparent gradient */}
            <Box
              style={{
                position: 'relative',
                padding: isSmallMobile ? `${spacing.md}px ${spacing.md}px ${spacing.lg}px` : `${spacing.lg}px ${spacing.lg}px ${spacing.lg}px`,
                minHeight: 80,
                overflow: 'hidden',
                background: isDark
                  ? 'linear-gradient(160deg, #1a2d47 0%, #0f1929 50%, #0a1219 100%)'
                  : 'linear-gradient(160deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}`,
              }}
            >
              {/* Subtle radial glow */}
              <Box
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              {/* Accent line */}
              <Box
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                }}
              />

              <Group
                justify="space-between"
                align="center"
                style={{ position: 'relative', zIndex: 1 }}
              >
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 64,
                    padding: `${spacing.xs}px 0`,
                  }}
                >
                  <Image
                    src="/logo-transparent.png"
                    alt="Catering Pro"
                    width={200}
                    height={80}
                    sizes="(max-width: 480px) 140px, (max-width: 360px) 160px, 200px"
                    priority
                    style={{
                      height: 'auto',
                      maxHeight: isSmallMobile ? 56 : 64,
                      width: 'auto',
                      maxWidth: isSmallMobile ? 180 : 220,
                      objectFit: 'contain',
                      filter: 'brightness(0) invert(1)',
                      transition: `all ${animations.transition.normal}`,
                    }}
                  />
                </Box>

                <UnstyledButton
                  onClick={onClose}
                  aria-label="Menüyü kapat"
                  style={{
                    width: sizes.touchTarget.comfortable,
                    height: sizes.touchTarget.comfortable,
                    borderRadius: radius.lg,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: `all ${animations.transition.normal}`,
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  className="sidebar-close-btn"
                >
                  <IconX size={sizes.icon.md} color="white" />
                </UnstyledButton>
              </Group>
            </Box>

            {/* Menu Content */}
            <ScrollArea style={{ flex: 1 }} offsetScrollbars>
              <Stack gap={isSmallMobile ? spacing.sm : spacing.md} p={isSmallMobile ? spacing.sm : spacing.md}>
                {/* Ana Sayfa - Standalone - Neumorphism */}
                <UnstyledButton
                  onClick={() => handleNavigation('/')}
                  aria-label="Ana sayfa"
                  role="button"
                  tabIndex={0}
                  style={{
                    padding: `${spacing.md}px`,
                    minHeight: sizes.touchTarget.comfortable,
                    borderRadius: radius.lg,
                    backgroundColor: isActive('/')
                      ? colors.surfaceElevated
                      : colors.surface,
                    boxShadow: isActive('/') ? getShadow('raised', isDark) : getShadow('subtle', isDark),
                    border: `1px solid ${isActive('/') ? colors.accent + '40' : colors.border}`,
                    transition: `all ${animations.transition.normal}`,
                  }}
                  className="menu-item"
                >
                  <Group justify="space-between">
                    <Group gap={spacing.sm}>
                      <Box
                        style={{
                          width: sizes.touchTarget.min,
                          height: sizes.touchTarget.min,
                          borderRadius: radius.md,
                          background: isActive('/')
                            ? `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentHover} 100%)`
                            : colors.surfaceElevated,
                          boxShadow: isActive('/') ? getShadow('subtle', isDark) : getShadow('inset', isDark),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: `all ${animations.transition.normal}`,
                        }}
                      >
                        <IconHome
                          size={sizes.icon.lg}
                          color={isActive('/') ? (isDark ? '#0a0a0a' : '#ffffff') : colors.textSecondary}
                        />
                      </Box>
                      <Text
                        fw={isActive('/') ? 700 : 600}
                        size="md"
                        c={isActive('/') ? colors.textPrimary : colors.textSecondary}
                        style={{
                          letterSpacing: '0.01em',
                          lineHeight: 1.3
                        }}
                      >
                        Ana Sayfa
                      </Text>
                    </Group>
                    <IconChevronRight size={sizes.icon.md - 2} style={{ opacity: 0.4, color: colors.textMuted }} />
                  </Group>
                </UnstyledButton>

                {/* Menu Groups - Neumorphism cards */}
                {menuGroups.map((group, _groupIndex) => (
                  <Box
                    key={group.title}
                    style={{
                      backgroundColor: colors.surfaceElevated,
                      borderRadius: radius.xl,
                      border: `1px solid ${colors.border}`,
                      borderLeft: `4px solid ${group.color}`,
                      overflow: 'hidden',
                      boxShadow: getShadow('raised', isDark),
                      transition: `all ${animations.transition.normal}`,
                    }}
                  >
                    {/* Group Header */}
                    <Box
                      px={spacing.md}
                      py={spacing.sm + 2}
                      style={{
                        borderBottom: `1px solid ${colors.borderSubtle}`,
                        background: colors.surface,
                      }}
                    >
                      <Text
                        size="xs"
                        fw={700}
                        tt="uppercase"
                        style={{
                          letterSpacing: '0.1em',
                          color: group.color,
                          lineHeight: 1.2,
                          textShadow: isDark 
                            ? `0 1px 3px rgba(0,0,0,0.4)` 
                            : `0 1px 2px rgba(255,255,255,0.9)`,
                        }}
                      >
                        {group.title}
                      </Text>
                    </Box>

                    {/* Group Items - Neumorphism with proper touch targets */}
                    <Stack gap={0}>
                      {group.items.map((item, itemIndex) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);

                        return (
                          <UnstyledButton
                            key={item.href}
                            onClick={() => handleNavigation(item.href)}
                            aria-label={`${item.label} sayfasına git${active ? ' (aktif sayfa)' : ''}`}
                            role="button"
                            tabIndex={0}
                            style={{
                              padding: `${spacing.md - 2}px ${spacing.md}px`,
                              minHeight: sizes.touchTarget.comfortable,
                              borderBottom:
                                itemIndex < group.items.length - 1
                                  ? `1px solid ${colors.borderSubtle}`
                                  : 'none',
                              backgroundColor: active
                                ? colors.surfaceHover
                                : 'transparent',
                              position: 'relative',
                              transition: `all ${animations.transition.fast}`,
                            }}
                            className="menu-item"
                          >
                            {/* Active indicator - glowing bar */}
                            {active && (
                              <Box
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  width: 4,
                                  height: '65%',
                                  backgroundColor: group.color,
                                  borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
                                  boxShadow: `0 0 12px ${group.color}80, 0 0 4px ${group.color}`,
                                }}
                              />
                            )}

                            <Group justify="space-between">
                              <Group gap={spacing.sm}>
                                <Box
                                  style={{
                                    width: sizes.touchTarget.min - 4,
                                    height: sizes.touchTarget.min - 4,
                                    borderRadius: radius.md,
                                    background: active
                                      ? group.gradient
                                      : colors.surface,
                                    boxShadow: active ? getShadow('subtle', isDark) : getShadow('inset', isDark),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: `all ${animations.transition.normal}`,
                                  }}
                                >
                                  <Icon
                                    size={sizes.icon.md}
                                    color={active ? 'white' : group.color}
                                    style={{ transition: `all ${animations.transition.normal}` }}
                                  />
                                </Box>
                                <Box>
                                  <Group gap={spacing.sm - 2}>
                                    <Text
                                      fw={active ? 600 : 500}
                                      size="sm"
                                      c={active ? colors.textPrimary : colors.textSecondary}
                                      style={{
                                        letterSpacing: '0.01em',
                                        lineHeight: 1.3
                                      }}
                                    >
                                      {item.label}
                                    </Text>
                                    {item.badge && (
                                      <Badge
                                        size="xs"
                                        variant="gradient"
                                        gradient={{ from: colors.accent, to: colors.accentHover, deg: 90 }}
                                        style={{
                                          fontSize: 9,
                                          padding: `0 ${spacing.sm - 2}px`,
                                          textTransform: 'uppercase',
                                          boxShadow: getShadow('subtle', isDark),
                                        }}
                                      >
                                        {item.badge}
                                      </Badge>
                                    )}
                                  </Group>
                                </Box>
                              </Group>
                              <IconChevronRight
                                size={sizes.icon.sm}
                                style={{
                                  opacity: active ? 0.8 : 0.3,
                                  color: colors.textMuted,
                                  transition: `all ${animations.transition.normal}`,
                                }}
                                className="menu-chevron"
                              />
                            </Group>
                          </UnstyledButton>
                        );
                      })}
                    </Stack>
                  </Box>
                ))}

                {/* Admin Panel (if admin) - Neumorphism */}
                {isAdmin && (
                  <UnstyledButton
                    onClick={() => handleNavigation('/admin')}
                    aria-label="Admin panel sayfasına git"
                    role="button"
                    tabIndex={0}
                    style={{
                      padding: spacing.md,
                      minHeight: sizes.touchTarget.comfortable,
                      borderRadius: radius.lg,
                      background: isActive('/admin')
                        ? colors.errorMuted
                        : `${colors.error}10`,
                      boxShadow: isActive('/admin') ? getShadow('raised', isDark) : getShadow('subtle', isDark),
                      border: `1px solid ${isActive('/admin') ? `${colors.error}50` : `${colors.error}30`}`,
                      transition: `all ${animations.transition.normal}`,
                    }}
                    className="menu-item"
                  >
                    <Group justify="space-between">
                      <Group gap={spacing.sm}>
                        <Box
                          style={{
                            width: sizes.touchTarget.min,
                            height: sizes.touchTarget.min,
                            borderRadius: radius.md,
                            background: `linear-gradient(135deg, ${colors.error} 0%, #DC2626 100%)`,
                            boxShadow: getShadow('subtle', isDark),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconShieldLock size={sizes.icon.lg} color="white" />
                        </Box>
                        <Box>
                          <Text 
                            fw={600} 
                            size="md" 
                            c={isDark ? '#FCA5A5' : colors.error}
                            style={{
                              letterSpacing: '0.01em',
                              lineHeight: 1.3
                            }}
                          >
                            Admin Panel
                          </Text>
                          <Text 
                            size="xs" 
                            c={colors.textMuted}
                            fw={500}
                            style={{
                              letterSpacing: '0.025em',
                              lineHeight: 1.2
                            }}
                          >
                            Sistem yönetimi
                          </Text>
                        </Box>
                      </Group>
                      <Badge 
                        size="sm" 
                        variant="gradient"
                        gradient={{ from: colors.error, to: '#DC2626', deg: 135 }}
                        style={{ boxShadow: getShadow('subtle', isDark) }}
                      >
                        ADMIN
                      </Badge>
                    </Group>
                  </UnstyledButton>
                )}
              </Stack>
            </ScrollArea>

            {/* User Section - Fixed at bottom - Neumorphism */}
            {user && (
              <Box
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  padding: `${spacing.md}px ${spacing.lg}px`,
                  background: colors.surfaceElevated,
                  boxShadow: `0 -4px 20px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'}`,
                }}
              >
                <Group justify="space-between" mb={spacing.sm}>
                  <Group gap={spacing.sm}>
                    <Avatar
                      size={sizes.touchTarget.min}
                      radius={radius.md}
                      variant="gradient"
                      gradient={{ from: colors.accent, to: colors.accentHover, deg: 135 }}
                      style={{ boxShadow: getShadow('subtle', isDark) }}
                    >
                      {getInitials(user.name ?? '')}
                    </Avatar>
                    <Box>
                      <Text 
                        fw={600} 
                        size="sm" 
                        c={colors.textPrimary}
                        style={{
                          letterSpacing: '0.01em',
                          lineHeight: 1.3
                        }}
                      >
                        {user.name ?? user.email}
                      </Text>
                      <Text 
                        size="xs" 
                        c={colors.textMuted}
                        fw={500}
                        truncate 
                        style={{ 
                          maxWidth: 160,
                          letterSpacing: '0.025em',
                          lineHeight: 1.2
                        }}
                      >
                        {user.email}
                      </Text>
                    </Box>
                  </Group>
                  {isAdmin && (
                    <Badge 
                      size="xs" 
                      color="red" 
                      variant="dot"
                      style={{ boxShadow: getShadow('subtle', isDark) }}
                    >
                      Admin
                    </Badge>
                  )}
                </Group>

                <Group grow gap={spacing.sm}>
                  <UnstyledButton
                    onClick={() => handleNavigation('/profil')}
                    aria-label="Profil sayfasına git"
                    role="button"
                    tabIndex={0}
                    style={{
                      padding: `${spacing.sm + 2}px ${spacing.md - 4}px`,
                      minHeight: sizes.touchTarget.min,
                      borderRadius: radius.md,
                      backgroundColor: colors.surface,
                      boxShadow: getShadow('raised', isDark),
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center',
                      transition: `all ${animations.transition.normal}`,
                    }}
                    className="user-action-btn"
                  >
                    <Group gap={spacing.sm - 2} justify="center">
                      <IconUser size={sizes.icon.sm} color={colors.textSecondary} />
                      <Text size="xs" fw={600} c={colors.textSecondary}>
                        Profil
                      </Text>
                    </Group>
                  </UnstyledButton>

                  <UnstyledButton
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    aria-label="Çıkış yap"
                    role="button"
                    tabIndex={0}
                    style={{
                      padding: `${spacing.sm + 2}px ${spacing.md - 4}px`,
                      minHeight: sizes.touchTarget.min,
                      borderRadius: radius.md,
                      backgroundColor: colors.errorMuted,
                      boxShadow: getShadow('raised', isDark),
                      border: `1px solid ${colors.error}30`,
                      textAlign: 'center',
                      transition: `all ${animations.transition.normal}`,
                    }}
                    className="logout-btn"
                  >
                    <Group gap={spacing.sm - 2} justify="center">
                      <IconLogout size={sizes.icon.sm} color={colors.error} />
                      <Text size="xs" fw={600} c={colors.error}>
                        Çıkış
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Group>
              </Box>
            )}

            {/* Accessibility styles - Neumorphism enhanced */}
            <style jsx global>{`
              .menu-item:hover {
                background: ${colors.surfaceHover} !important;
                transform: translateX(4px);
              }
              .menu-item:hover .menu-chevron {
                opacity: 0.8 !important;
                transform: translateX(2px);
              }
              .menu-item:active {
                transform: translateX(2px) scale(0.99);
                box-shadow: ${getShadow('pressed', isDark)} !important;
              }
              .menu-item:focus-visible,
              .user-action-btn:focus-visible,
              .logout-btn:focus-visible,
              .sidebar-close-btn:focus-visible {
                outline: 2px solid ${colors.accent} !important;
                outline-offset: 2px;
              }
              
              .sidebar-close-btn:hover {
                background: ${colors.surfaceHover} !important;
                box-shadow: ${getShadow('raised', isDark)} !important;
                transform: scale(1.05);
              }
              .sidebar-close-btn:active {
                transform: scale(0.95);
                box-shadow: ${getShadow('pressed', isDark)} !important;
              }
              
              .user-action-btn:hover {
                background: ${colors.surfaceHover} !important;
                box-shadow: ${getShadow('raised', isDark)} !important;
                transform: translateY(-2px);
              }
              .user-action-btn:active {
                transform: translateY(0) scale(0.98);
                box-shadow: ${getShadow('pressed', isDark)} !important;
              }
              
              .logout-btn:hover {
                background: ${colors.error}25 !important;
                box-shadow: ${getShadow('raised', isDark)} !important;
                transform: translateY(-2px);
              }
              .logout-btn:active {
                transform: translateY(0) scale(0.98);
                box-shadow: ${getShadow('pressed', isDark)} !important;
              }
              
              /* High contrast mode support */
              @media (prefers-contrast: high) {
                .menu-item, .user-action-btn, .logout-btn, .sidebar-close-btn {
                  border: 2px solid currentColor !important;
                }
              }
              
              /* Reduced motion support */
              @media (prefers-reduced-motion: reduce) {
                .menu-item *, .user-action-btn *, .logout-btn *, .sidebar-close-btn * {
                  transition: none !important;
                  animation: none !important;
                  transform: none !important;
                }
              }

              /* Touch device optimizations */
              @media (hover: none) and (pointer: coarse) {
                .menu-item {
                  min-height: ${sizes.touchTarget.comfortable}px !important;
                }
                .user-action-btn, .logout-btn {
                  min-height: ${sizes.touchTarget.min}px !important;
                }
              }
            `}</style>
          </Box>
        )}
      </Transition>
    </>
  );
}
