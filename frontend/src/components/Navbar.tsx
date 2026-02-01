'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Burger,
  Button,
  Group,
  Kbd,
  Loader,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure, useHotkeys, useMediaQuery } from '@mantine/hooks';
import {
  IconBookmark,
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconBuildingFactory2,
  IconBuildingStore,
  IconCalculator,
  IconChartBar,
  IconChartPie,
  IconChevronDown,
  IconCoin,
  IconDeviceMobile,
  IconFolder,
  IconHome,
  IconList,
  IconLogin,
  IconLogout,
  IconPackage,
  IconReceipt,
  IconSearch,
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
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
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
import { MobileSidebar } from './MobileSidebar';
import { NotificationDropdown } from './NotificationDropdown';
import { WhatsAppNavButton } from './WhatsAppNavButton';

// SearchModal'ı lazy load et - sadece açıldığında yükle
const SearchModal = dynamic(
  () => import('./SearchModal').then((mod) => ({ default: mod.SearchModal })),
  {
    ssr: false,
    loading: () => null,
  }
);

export function Navbar() {
  const { colorScheme } = useMantineColorScheme();
  const pathname = usePathname();
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);
  const [searchModalOpened, { open: openSearchModal, close: closeSearchModal }] =
    useDisclosure(false);
  const [mounted, setMounted] = useState(false);
  const { user, isAdmin: userIsAdmin, logout } = useAuth();
  const { canView, isSuperAdmin, loading: permLoading, error: permError } = usePermissions();

  // Fallback: Yetkiler yüklenemediğinde veya loading durumunda tüm sayfaları göster
  // useMemo ile cache'le - her render'da yeniden oluşturulmasın
  const safeCanView = useCallback(
    (module: string) => {
      // Loading durumunda veya hata varsa true döndür (fallback)
      if (permLoading || permError) return true;
      // canView undefined ise true döndür (fallback)
      if (!canView) return true;
      return canView(module);
    },
    [permLoading, permError, canView]
  );

  const safeIsSuperAdmin = useMemo(
    () => (permLoading || permError ? false : isSuperAdmin),
    [permLoading, permError, isSuperAdmin]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // AI banner: kapatılabilir (localStorage)
  const AI_BANNER_KEY = 'catering_ai_banner_dismissed';
  const [aiBannerDismissed, setAiBannerDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setAiBannerDismissed(window.localStorage.getItem(AI_BANNER_KEY) === 'true');
  }, []);
  const dismissAiBanner = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AI_BANNER_KEY, 'true');
      setAiBannerDismissed(true);
    }
  }, []);

  // AppLayout zaten navbar'ın gösterilip gösterilmeyeceğini kontrol ediyor
  // Bu yüzden burada ekstra kontrol yapmıyoruz - sadece mounted kontrolü SSR için
  // Eğer AppLayout navbar'ı render ettiyse, burada render edilmeli

  // Responsive breakpoints - SSR için mounted kontrolü
  const isMobileQuery = useMediaQuery('(max-width: 768px)');
  const isTabletQuery = useMediaQuery('(max-width: 1024px)');
  const isSmallMobileQuery = useMediaQuery('(max-width: 480px)');
  const isMobile = mounted ? isMobileQuery : false; // SSR'da false, client'da gerçek değer
  const isTablet = mounted ? isTabletQuery : false;
  const isSmallMobile = mounted ? isSmallMobileQuery : false;

  // Keyboard shortcut for search
  useHotkeys([['mod+k', () => openSearchModal()]]);

  // Toolbar'daki arama ikonundan gelen event: sayfaya gitmeden arama modalını aç
  useEffect(() => {
    const handler = () => openSearchModal();
    window.addEventListener('open-search-modal', handler);
    return () => window.removeEventListener('open-search-modal', handler);
  }, [openSearchModal]);

  // Use mounted check to avoid hydration mismatch
  const isDark = mounted ? colorScheme === 'dark' : true; // Default to dark for SSR

  // Route helpers
  const isActive = (path: string) => pathname === path;
  const isIhaleMerkezi =
    pathname === '/tenders' || pathname === '/upload' || pathname === '/tracking';

  // Finans sayfaları
  const isFinans =
    pathname === '/muhasebe' ||
    pathname === '/muhasebe/finans' ||
    pathname === '/muhasebe/faturalar' ||
    pathname === '/muhasebe/gelir-gider' ||
    pathname === '/muhasebe/cariler' ||
    pathname === '/muhasebe/kasa-banka' ||
    pathname === '/muhasebe/raporlar';

  // Operasyon sayfaları
  const isOperasyon =
    pathname === '/muhasebe/stok' ||
    pathname === '/muhasebe/satin-alma' ||
    pathname === '/muhasebe/menu-planlama' ||
    pathname === '/muhasebe/personel' ||
    pathname === '/muhasebe/demirbas';

  // Sosyal Medya sayfaları
  const isSosyalMedya = pathname.startsWith('/sosyal-medya');

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const getInitials = useCallback((name: string) => {
    return (
      (name ?? '')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?'
    );
  }, []);

  // Glassmorphism style: transparent with blur + soft shadows
  const colors = useMemo(() => getColors(isDark), [isDark]);
  
  const navbarStyle = useMemo(
    () => ({
      backgroundColor: isDark ? 'rgba(18, 18, 18, 0.25)' : 'rgba(255, 255, 255, 0.35)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}`,
      boxShadow: 'none',
    }),
    [isDark]
  );

  return (
    <>
      {/* Search Modal - Lazy loaded */}
      <Suspense fallback={null}>
        <SearchModal opened={searchModalOpened} onClose={closeSearchModal} />
      </Suspense>

      {/* Main Header Container */}
      <Box
        style={{
          ...navbarStyle,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transition: `all ${animations.transition.slow}`,
        }}
      >
        {/* ========== AI DUYURU ÇUBUĞU (kapatılabilir) ========== */}
        {!aiBannerDismissed && (
          <Box
            py={spacing.sm}
            px={spacing.md}
            style={{
              textAlign: 'center',
              background: isDark
                ? colors.surfaceElevated
                : colors.surface,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              boxShadow: getShadow('subtle', isDark),
            }}
          >
            <Group gap={spacing.sm} justify="center">
              <IconSparkles size={14} color={colors.accent} />
              <Text size="xs" c={colors.textSecondary} fw={500}>
                Yeni! İhtiyaç duyduğunuz tüm yapay zeka araçları tek bir araç setinde bir araya
                getirildi.
              </Text>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label="Bannerı kapat"
                onClick={dismissAiBanner}
                style={{ 
                  opacity: 0.8, 
                  minWidth: sizes.touchTarget.min, 
                  minHeight: sizes.touchTarget.min,
                  borderRadius: radius.sm,
                }}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Box>
        )}

        {/* ========== PRIMARY BAR (Neumorphism: soft elevated bar) ========== */}
        <Box
          px={mounted && isSmallMobile ? spacing.sm : mounted && isMobile ? spacing.md : spacing.lg}
          style={{
            height: mounted && isSmallMobile ? sizes.navbar.mobile : mounted && isMobile ? sizes.navbar.tablet : sizes.navbar.desktop,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* LEFT: Logo */}
          <Link 
            href="/" 
            style={{ textDecoration: 'none', flexShrink: 0 }}
            aria-label="Ana sayfaya git"
          >
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: spacing.xs,
                borderRadius: radius.lg,
                transition: `all ${animations.transition.slow}`,
                background: colors.surface,
                boxShadow: getShadow('subtle', isDark),
                border: `1px solid ${colors.borderSubtle}`,
              }}
              className="logo-container"
            >
              {/* Logo - Neumorphism: soft inset container */}
              <Box
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.xs,
                }}
              >
                  <Box
                    style={{
                      position: 'absolute',
                      width: mounted && isSmallMobile ? 40 : mounted && isMobile ? 44 : 56,
                      height: mounted && isSmallMobile ? 40 : mounted && isMobile ? 44 : 56,
                      borderRadius: '50%',
                      background: isDark
                        ? `radial-gradient(circle, ${colors.accent}15 0%, transparent 70%)`
                        : `radial-gradient(circle, ${colors.accent}20 0%, transparent 70%)`,
                      filter: mounted && isMobile ? 'blur(6px)' : 'blur(8px)',
                      transition: `all ${animations.transition.slow}`,
                    }}
                    className="logo-glow"
                  />
                  <Image
                    src="/logo-transparent.png"
                    alt="Catering Pro"
                    width={136}
                    height={136}
                    sizes="(max-width: 480px) 48px, (max-width: 768px) 56px, 68px"
                    priority
                    style={{
                      position: 'relative',
                      width: mounted && isSmallMobile ? 48 : mounted && isMobile ? 56 : 68,
                      height: 'auto',
                      objectFit: 'contain',
                      transition: `transform ${animations.transition.slow}, filter ${animations.transition.slow}`,
                      ...(isDark && {
                        filter: 'brightness(0) invert(1)',
                      }),
                    }}
                    className="logo-image"
                  />
              </Box>
            </Box>
          </Link>

          {/* Logo hover styles + Focus states for accessibility - Neumorphism */}
          <style jsx global>{`
            .logo-container:hover,
            .logo-container:focus-visible {
              background: ${colors.surfaceHover};
              box-shadow: ${getShadow('raised', isDark)};
              border-color: ${colors.borderHover};
              transform: translateY(-2px);
            }
            .logo-container:active {
              transform: translateY(0) scale(0.98);
              box-shadow: ${getShadow('pressed', isDark)};
            }
            .logo-container:focus-visible {
              outline: 2px solid ${colors.accent};
              outline-offset: 2px;
            }
            .logo-container:hover .logo-glow,
            .logo-container:focus-visible .logo-glow {
              filter: blur(10px);
              transform: scale(1.2);
              opacity: 1;
            }
            .logo-container:hover .logo-image,
            .logo-container:focus-visible .logo-image {
              transform: scale(1.05);
              filter: ${isDark ? 'brightness(0) invert(1) drop-shadow(0 0 12px rgba(230, 197, 48, 0.3))' : 'drop-shadow(0 0 8px rgba(202, 138, 4, 0.3))'};
            }
            .user-menu-trigger:hover,
            .user-menu-trigger:focus-visible {
              background: ${colors.surfaceHover} !important;
              box-shadow: ${getShadow('subtle', isDark)} !important;
              border-color: ${colors.borderHover} !important;
              transform: translateY(-1px);
            }
            .user-menu-trigger:active {
              transform: translateY(0) scale(0.98);
              box-shadow: ${getShadow('pressed', isDark)} !important;
            }
            .user-menu-trigger:focus-visible {
              outline: 2px solid ${colors.accent};
              outline-offset: 2px;
            }
            .search-trigger:hover {
              background: ${colors.surfaceHover} !important;
              box-shadow: ${getShadow('raised', isDark)} !important;
              border-color: ${colors.borderHover} !important;
              transform: translateY(-1px);
            }
            .search-trigger:active {
              transform: translateY(0) scale(0.99);
              box-shadow: ${getShadow('inset', isDark)} !important;
            }
            .search-trigger:focus-visible {
              outline: 2px solid ${colors.accent};
              outline-offset: 2px;
            }
            /* Hamburger container animations */
            .hamburger-container:hover {
              background: ${colors.surfaceHover} !important;
              box-shadow: ${getShadow('raised', isDark)} !important;
              border-color: ${colors.borderHover} !important;
              transform: translateY(-1px);
            }
            .hamburger-container:active {
              transform: translateY(0) scale(0.96);
              box-shadow: ${getShadow('pressed', isDark)} !important;
            }
            
            /* Navigation button animations */
            .mantine-Button-root {
              transition: all ${animations.transition.normal} !important;
            }
            .mantine-Button-root:hover {
              transform: translateY(-1px);
            }
            .mantine-Button-root:active {
              transform: translateY(0) scale(0.98);
            }
            
            /* Menu dropdown animations */
            .mantine-Menu-dropdown {
              background: ${isDark ? neuColors.dark.bgSecondary : neuColors.light.bgSecondary} !important;
              border: 1px solid ${colors.border} !important;
              box-shadow: ${getShadow('floating', isDark)} !important;
              border-radius: ${radius.lg}px !important;
              backdrop-filter: blur(20px);
            }
            .mantine-Menu-item {
              border-radius: ${radius.md}px !important;
              margin: 2px 4px !important;
              transition: all ${animations.transition.fast} !important;
            }
            .mantine-Menu-item:hover {
              background: ${colors.surfaceHover} !important;
              transform: translateX(2px);
            }
            .mantine-Menu-item[data-hovered] {
              background: ${colors.surfaceHover} !important;
            }
            
            /* Action icon animations */
            .mantine-ActionIcon-root {
              transition: all ${animations.transition.normal} !important;
            }
            .mantine-ActionIcon-root:hover {
              transform: translateY(-1px) scale(1.05);
              box-shadow: ${getShadow('subtle', isDark)} !important;
            }
            .mantine-ActionIcon-root:active {
              transform: translateY(0) scale(0.95);
              box-shadow: ${getShadow('pressed', isDark)} !important;
            }
            
            /* Tooltip styling */
            .mantine-Tooltip-tooltip {
              background: ${isDark ? neuColors.dark.surfaceElevated : neuColors.light.surfaceElevated} !important;
              color: ${colors.textPrimary} !important;
              border: 1px solid ${colors.border} !important;
              box-shadow: ${getShadow('subtle', isDark)} !important;
              border-radius: ${radius.sm}px !important;
              font-weight: 500;
            }
            
            /* Badge animations */
            .mantine-Badge-root {
              transition: all ${animations.transition.fast} !important;
            }
            
            /* High contrast mode support */
            @media (prefers-contrast: high) {
              .logo-container, .user-menu-trigger, .search-trigger, .hamburger-container {
                border: 2px solid currentColor !important;
              }
            }
            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
              .logo-container *, .user-menu-trigger *, .search-trigger *, .hamburger-container *,
              .mantine-Button-root, .mantine-ActionIcon-root, .mantine-Menu-item {
                transition: none !important;
                animation: none !important;
                transform: none !important;
              }
            }
          `}</style>

          {/* CENTER: Search Bar - Neumorphism: inset input field */}
          {mounted && !isMobile && (
            <Box style={{ flex: 1, maxWidth: 420 }} mx={spacing.lg}>
              <UnstyledButton
                onClick={openSearchModal}
                aria-label="Arama yap (⌘K)"
                style={{
                  width: '100%',
                  padding: `${spacing.sm + 2}px ${spacing.md}px`,
                  borderRadius: radius.full,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  boxShadow: getShadow('inset', isDark),
                  transition: `all ${animations.transition.normal}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm + 2,
                }}
                className="search-trigger"
              >
                <IconSearch size={sizes.icon.sm} style={{ opacity: 0.5, flexShrink: 0, color: colors.textMuted }} />
                <Text size="sm" c={colors.textMuted} style={{ flex: 1, textAlign: 'left' }}>
                  İhale, cari, fatura ara...
                </Text>
                <Group gap={spacing.xs} style={{ flexShrink: 0 }}>
                  <Kbd size="xs" style={{ 
                    background: colors.surfaceElevated,
                    border: `1px solid ${colors.border}`,
                    boxShadow: getShadow('subtle', isDark),
                  }}>⌘</Kbd>
                  <Kbd size="xs" style={{ 
                    background: colors.surfaceElevated,
                    border: `1px solid ${colors.border}`,
                    boxShadow: getShadow('subtle', isDark),
                  }}>K</Kbd>
                </Group>
              </UnstyledButton>
            </Box>
          )}

          {/* RIGHT: Actions */}
          <Group gap={mounted && isSmallMobile ? spacing.xs : mounted && isMobile ? spacing.sm : spacing.sm}>
            {/* Mobile Search Icon */}
            {mounted && isMobile && (
              <Tooltip label="Ara" withArrow>
                <ActionIcon
                  variant="subtle"
                  size={mounted && isSmallMobile ? 'md' : 'lg'}
                  radius={radius.lg}
                  color="gray"
                  onClick={openSearchModal}
                  style={{
                    background: colors.surfaceElevated,
                    boxShadow: getShadow('subtle', isDark),
                    border: `1px solid ${colors.border}`,
                    minWidth: sizes.touchTarget.min,
                    minHeight: sizes.touchTarget.min,
                    transition: `all ${animations.transition.normal}`,
                  }}
                >
                  <IconSearch size={mounted && isSmallMobile ? sizes.icon.sm : sizes.icon.md - 2} />
                </ActionIcon>
              </Tooltip>
            )}

            {/* WhatsApp */}
            <WhatsAppNavButton />

            {/* Notifications */}
            <NotificationDropdown />

            {/* User Menu */}
            {!mounted ? (
              <Loader size="sm" />
            ) : user ? (
              <Menu shadow="lg" width={220} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton
                    aria-label={`Kullanıcı menüsü - ${user.name ?? user.email}`}
                    style={{
                      padding: mounted && isSmallMobile ? `${spacing.xs}px ${spacing.sm - 2}px` : mounted && isMobile ? `${spacing.sm - 2}px ${spacing.sm}px` : `${spacing.sm}px ${spacing.md - 4}px`,
                      borderRadius: radius.full,
                      backgroundColor: colors.surfaceElevated,
                      border: `1px solid ${colors.border}`,
                      boxShadow: getShadow('subtle', isDark),
                      transition: `all ${animations.transition.normal}`,
                      minWidth: mounted && isMobile ? sizes.touchTarget.min : 'auto',
                      minHeight: mounted && isMobile ? sizes.touchTarget.min : 'auto',
                    }}
                    className="user-menu-trigger"
                  >
                    <Group
                      gap={mounted && isSmallMobile ? spacing.xs : mounted && isMobile ? spacing.sm - 2 : spacing.sm + 2}
                      wrap="nowrap"
                    >
                      <Avatar
                        size={mounted && isSmallMobile ? sizes.avatar.sm - 4 : mounted && isMobile ? 'sm' : sizes.avatar.md - 4}
                        radius={radius.lg}
                        color="blue"
                        variant="gradient"
                        gradient={{ from: colors.accent, to: isDark ? '#f0d050' : '#b47d04', deg: 135 }}
                        style={{ 
                          flexShrink: 0,
                          boxShadow: getShadow('subtle', isDark),
                        }}
                      >
                        {getInitials(user.name ?? '')}
                      </Avatar>
                      {mounted && !isMobile && (
                        <>
                          <Box style={{ lineHeight: 1.25, minWidth: 0 }}>
                            <Group gap={spacing.sm - 2} wrap="nowrap" align="center">
                              <Text size="sm" fw={600} truncate style={{ lineHeight: 1.25, color: colors.textPrimary }}>
                                {(user.name ?? user.email).split(' ')[0]}
                              </Text>
                              {userIsAdmin && (
                                <Badge
                                  size="xs"
                                  variant="gradient"
                                  gradient={{ from: colors.error, to: '#f87171', deg: 135 }}
                                  radius={radius.sm}
                                  styles={{
                                    root: {
                                      fontWeight: 600,
                                      paddingLeft: spacing.sm - 2,
                                      paddingRight: spacing.sm - 2,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.02em',
                                      boxShadow: getShadow('subtle', isDark),
                                    },
                                  }}
                                >
                                  Admin
                                </Badge>
                              )}
                            </Group>
                          </Box>
                          <IconChevronDown
                            size={sizes.icon.sm}
                            style={{ opacity: 0.5, flexShrink: 0, marginLeft: 2, color: colors.textMuted }}
                          />
                        </>
                      )}
                    </Group>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>
                    <Text size="sm" fw={500}>
                      {user.name ?? user.email}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {user.email}
                    </Text>
                  </Menu.Label>
                  <Menu.Divider />
                  <Menu.Item component={Link} href="/profil" leftSection={<IconUser size={16} />}>
                    Profilim
                  </Menu.Item>
                  <Menu.Item
                    component={Link}
                    href="/ayarlar"
                    leftSection={<IconSettings size={16} />}
                  >
                    Ayarlar
                  </Menu.Item>
                  {userIsAdmin && (
                    <>
                      <Menu.Divider />
                      <Menu.Item
                        component={Link}
                        href="/admin"
                        leftSection={<IconShieldLock size={16} />}
                        color="red"
                      >
                        Admin Panel
                      </Menu.Item>
                    </>
                  )}
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconLogout size={16} />}
                    color="red"
                    onClick={handleLogout}
                  >
                    Çıkış Yap
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : mounted && isMobile ? (
              <Tooltip label="Giriş Yap" withArrow>
                <ActionIcon
                  component={Link}
                  href="/giris"
                  variant="filled"
                  size={mounted && isSmallMobile ? 'md' : 'lg'}
                  radius={radius.lg}
                  style={{
                    minWidth: sizes.touchTarget.min,
                    minHeight: sizes.touchTarget.min,
                    background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentHover} 100%)`,
                    boxShadow: getShadow('raised', isDark),
                    border: 'none',
                    transition: `all ${animations.transition.normal}`,
                  }}
                >
                  <IconLogin size={mounted && isSmallMobile ? sizes.icon.sm : sizes.icon.md - 2} color={isDark ? '#0a0a0a' : '#ffffff'} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Button
                component={Link}
                href="/giris"
                size="sm"
                radius={radius.full}
                leftSection={<IconLogin size={sizes.icon.sm} />}
                style={{
                  background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentHover} 100%)`,
                  color: isDark ? '#0a0a0a' : '#ffffff',
                  boxShadow: getShadow('raised', isDark),
                  border: 'none',
                  fontWeight: 600,
                  transition: `all ${animations.transition.normal}`,
                }}
              >
                Giriş
              </Button>
            )}

            {/* Mobile Hamburger */}
            {mounted && (isMobile || isTablet) && (
              <Box
                style={{
                  padding: spacing.xs,
                  borderRadius: radius.md,
                  background: colors.surfaceElevated,
                  boxShadow: getShadow('subtle', isDark),
                  border: `1px solid ${colors.border}`,
                  transition: `all ${animations.transition.normal}`,
                }}
                className="hamburger-container"
              >
                <Burger
                  opened={mobileMenuOpened}
                  onClick={() => setMobileMenuOpened(!mobileMenuOpened)}
                  size={mounted && isSmallMobile ? 'xs' : 'sm'}
                  aria-label={mobileMenuOpened ? "Menüyü kapat" : "Menüyü aç"}
                  color={colors.textPrimary}
                  style={{
                    minWidth: sizes.touchTarget.min - spacing.sm,
                    minHeight: sizes.touchTarget.min - spacing.sm,
                  }}
                />
              </Box>
            )}
          </Group>
        </Box>

        {/* ========== NAVIGATION BAR (Desktop Only) - Neumorphism ========== */}
        {mounted && !isMobile && !isTablet && (
          <Box
            px={spacing.lg}
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              borderTop: `1px solid ${colors.borderSubtle}`,
              background: colors.surface,
              gap: spacing.xs,
            }}
          >
            {/* Ana Sayfa */}
            <Button
              component={Link}
              href="/"
              leftSection={<IconHome size={sizes.icon.sm} />}
              variant={isActive('/') ? 'filled' : 'subtle'}
              size="compact-sm"
              radius={radius.md}
              style={{
                background: isActive('/') ? colors.surfaceElevated : 'transparent',
                color: isActive('/') ? colors.textPrimary : colors.textSecondary,
                boxShadow: isActive('/') ? getShadow('subtle', isDark) : 'none',
                border: isActive('/') ? `1px solid ${colors.border}` : '1px solid transparent',
                fontWeight: isActive('/') ? 600 : 500,
                transition: `all ${animations.transition.normal}`,
              }}
            >
              Ana Sayfa
            </Button>

            {/* İhale Merkezi Dropdown - Yetki kontrolü */}
            {(safeIsSuperAdmin || safeCanView('ihale')) && (
              <Menu
                shadow="lg"
                width={240}
                position="bottom-start"
                transitionProps={{ transition: 'pop-top-left' }}
              >
                <Menu.Target>
                  <Button
                    rightSection={<IconChevronDown size={14} />}
                    leftSection={<IconFolder size={sizes.icon.sm} />}
                    variant={isIhaleMerkezi ? 'filled' : 'subtle'}
                    size="compact-sm"
                    radius={radius.md}
                    style={{
                      background: isIhaleMerkezi ? colors.infoMuted : 'transparent',
                      color: isIhaleMerkezi ? colors.info : colors.textSecondary,
                      boxShadow: isIhaleMerkezi ? getShadow('subtle', isDark) : 'none',
                      border: isIhaleMerkezi ? `1px solid ${isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.2)'}` : '1px solid transparent',
                      fontWeight: isIhaleMerkezi ? 600 : 500,
                      transition: `all ${animations.transition.normal}`,
                    }}
                  >
                    İhale Merkezi
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item component={Link} href="/tenders" leftSection={<IconList size={16} />}>
                    <Group justify="space-between" w="100%">
                      <Text size="sm">İhale Listesi</Text>
                      {isActive('/tenders') && (
                        <Badge size="xs" color="blue">
                          Aktif
                        </Badge>
                      )}
                    </Group>
                  </Menu.Item>
                  <Menu.Item
                    component={Link}
                    href="/upload"
                    leftSection={<IconSparkles size={16} color="var(--mantine-color-violet-6)" />}
                  >
                    <Box>
                      <Text size="sm" fw={500}>
                        Yükle & Analiz
                      </Text>
                      <Text size="xs" c="dimmed">
                        AI Analiz
                      </Text>
                    </Box>
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    component={Link}
                    href="/tracking"
                    leftSection={<IconBookmark size={16} color="var(--mantine-color-cyan-6)" />}
                  >
                    İhale Takibim
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}

            {/* Finans Dropdown */}
            {(safeIsSuperAdmin ||
              safeCanView('fatura') ||
              safeCanView('cari') ||
              safeCanView('kasa_banka') ||
              safeCanView('rapor')) && (
              <Menu
                shadow="lg"
                width={240}
                position="bottom-start"
                transitionProps={{ transition: 'pop-top-left' }}
              >
                <Menu.Target>
                  <Button
                    rightSection={<IconChevronDown size={14} />}
                    leftSection={<IconCoin size={sizes.icon.sm} />}
                    variant={isFinans ? 'filled' : 'subtle'}
                    size="compact-sm"
                    radius={radius.md}
                    style={{
                      background: isFinans ? colors.successMuted : 'transparent',
                      color: isFinans ? colors.success : colors.textSecondary,
                      boxShadow: isFinans ? getShadow('subtle', isDark) : 'none',
                      border: isFinans ? `1px solid ${isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(22, 163, 74, 0.2)'}` : '1px solid transparent',
                      fontWeight: isFinans ? 600 : 500,
                      transition: `all ${animations.transition.normal}`,
                    }}
                  >
                    Finans
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    component={Link}
                    href="/muhasebe"
                    leftSection={<IconChartPie size={16} />}
                  >
                    <Group justify="space-between" w="100%">
                      <Text size="sm">Dashboard</Text>
                      {isActive('/muhasebe') && (
                        <Badge size="xs" color="teal">
                          Aktif
                        </Badge>
                      )}
                    </Group>
                  </Menu.Item>
                  {(safeIsSuperAdmin || safeCanView('kasa_banka') || safeCanView('cari')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/finans"
                      leftSection={<IconWallet size={16} color="var(--mantine-color-blue-6)" />}
                    >
                      <Box>
                        <Text size="sm" fw={500}>
                          Finans Merkezi
                        </Text>
                        <Text size="xs" c="dimmed">
                          Kasa, Banka, Cariler
                        </Text>
                      </Box>
                    </Menu.Item>
                  )}
                  <Menu.Divider />
                  {(safeIsSuperAdmin || safeCanView('fatura')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/faturalar"
                      leftSection={<IconReceipt size={16} />}
                    >
                      Faturalar
                    </Menu.Item>
                  )}
                  <Menu.Divider />
                  {(safeIsSuperAdmin || safeCanView('rapor')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/raporlar"
                      leftSection={<IconChartBar size={16} />}
                    >
                      Raporlar
                    </Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}

            {/* Operasyon Dropdown */}
            {(safeIsSuperAdmin ||
              safeCanView('stok') ||
              safeCanView('personel') ||
              safeCanView('demirbas') ||
              safeCanView('planlama')) && (
              <Menu
                shadow="lg"
                width={240}
                position="bottom-start"
                transitionProps={{ transition: 'pop-top-left' }}
              >
                <Menu.Target>
                  <Button
                    rightSection={<IconChevronDown size={14} />}
                    leftSection={<IconBuildingFactory2 size={sizes.icon.sm} />}
                    variant={isOperasyon ? 'filled' : 'subtle'}
                    size="compact-sm"
                    radius={radius.md}
                    style={{
                      background: isOperasyon ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                      color: isOperasyon ? '#8B5CF6' : colors.textSecondary,
                      boxShadow: isOperasyon ? getShadow('subtle', isDark) : 'none',
                      border: isOperasyon ? `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'}` : '1px solid transparent',
                      fontWeight: isOperasyon ? 600 : 500,
                      transition: `all ${animations.transition.normal}`,
                    }}
                  >
                    Operasyon
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {(safeIsSuperAdmin || safeCanView('stok')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/stok"
                      leftSection={<IconPackage size={16} color="var(--mantine-color-blue-6)" />}
                    >
                      <Box>
                        <Text size="sm" fw={500}>
                          Stok Takibi
                        </Text>
                        <Text size="xs" c="dimmed">
                          Depo & Envanter
                        </Text>
                      </Box>
                    </Menu.Item>
                  )}
                  {(safeIsSuperAdmin || safeCanView('stok')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/satin-alma"
                      leftSection={
                        <IconShoppingCart size={16} color="var(--mantine-color-orange-6)" />
                      }
                    >
                      <Box>
                        <Text size="sm" fw={500}>
                          Satın Alma
                        </Text>
                        <Text size="xs" c="dimmed">
                          Sipariş & Tedarik
                        </Text>
                      </Box>
                    </Menu.Item>
                  )}
                  <Menu.Divider />
                  {(safeIsSuperAdmin || safeCanView('planlama')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/menu-planlama"
                      leftSection={
                        <IconToolsKitchen2 size={16} color="var(--mantine-color-teal-6)" />
                      }
                    >
                      <Box>
                        <Text size="sm" fw={500}>
                          Menü Planlama
                        </Text>
                        <Text size="xs" c="dimmed">
                          Reçete & Maliyet
                        </Text>
                      </Box>
                    </Menu.Item>
                  )}
                  <Menu.Divider />
                  {(safeIsSuperAdmin || safeCanView('personel')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/personel"
                      leftSection={<IconUserCircle size={16} />}
                    >
                      Personel
                    </Menu.Item>
                  )}
                  {(safeIsSuperAdmin || safeCanView('demirbas')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/demirbas"
                      leftSection={<IconBuildingStore size={16} />}
                    >
                      Demirbaş
                    </Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}

            {/* Sosyal Medya Dropdown */}
            {(safeIsSuperAdmin || safeCanView('sosyal_medya')) && (
              <Menu
                shadow="lg"
                width={240}
                position="bottom-start"
                transitionProps={{ transition: 'pop-top-left' }}
              >
                <Menu.Target>
                  <Button
                    rightSection={<IconChevronDown size={14} />}
                    leftSection={<IconDeviceMobile size={sizes.icon.sm} />}
                    variant={isSosyalMedya ? 'filled' : 'subtle'}
                    size="compact-sm"
                    radius={radius.md}
                    style={{
                      background: isSosyalMedya ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
                      color: isSosyalMedya ? '#EC4899' : colors.textSecondary,
                      boxShadow: isSosyalMedya ? getShadow('subtle', isDark) : 'none',
                      border: isSosyalMedya ? `1px solid ${isDark ? 'rgba(236, 72, 153, 0.3)' : 'rgba(236, 72, 153, 0.2)'}` : '1px solid transparent',
                      fontWeight: isSosyalMedya ? 600 : 500,
                      transition: `all ${animations.transition.normal}`,
                    }}
                  >
                    Sosyal Medya
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    component={Link}
                    href="/sosyal-medya"
                    leftSection={<IconChartPie size={16} />}
                  >
                    <Group justify="space-between" w="100%">
                      <Text size="sm">Dashboard</Text>
                      {isActive('/sosyal-medya') && pathname === '/sosyal-medya' && (
                        <Badge size="xs" color="pink">
                          Aktif
                        </Badge>
                      )}
                    </Group>
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    component={Link}
                    href="/sosyal-medya/instagram"
                    leftSection={<IconBrandInstagram size={16} color="#E4405F" />}
                  >
                    <Box>
                      <Text size="sm" fw={500}>
                        Instagram
                      </Text>
                      <Text size="xs" c="dimmed">
                        Post, Story, DM
                      </Text>
                    </Box>
                  </Menu.Item>
                  <Menu.Item
                    component={Link}
                    href="/sosyal-medya/whatsapp"
                    leftSection={<IconBrandWhatsapp size={16} color="#25D366" />}
                  >
                    <Box>
                      <Text size="sm" fw={500}>
                        WhatsApp
                      </Text>
                      <Text size="xs" c="dimmed">
                        Mesajlar, Sohbet
                      </Text>
                    </Box>
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}

            {/* Ayarlar ve Admin butonları kullanıcı dropdown menüsünde mevcut - tekrar etmesin */}
          </Box>
        )}
      </Box>

      {/* ========== PREMIUM MOBILE SIDEBAR ========== */}
      {mounted && (isMobile || isTablet) && (
        <MobileSidebar
          opened={mobileMenuOpened}
          onClose={() => setMobileMenuOpened(false)}
          user={user}
          isAdmin={userIsAdmin}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
