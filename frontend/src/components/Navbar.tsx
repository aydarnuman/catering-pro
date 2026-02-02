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
  const isMobile = mounted ? isMobileQuery : false; // SSR'da false, client'da gerçek değer
  const isTablet = mounted ? isTabletQuery : false;

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
    pathname === '/tenders' || pathname === '/upload' || pathname === '/tracking' || pathname === '/ihale-merkezi';

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

  // Artlist tarzı: çok şeffaf cam, minimal çizgi, güçlü blur
  const glassStyle = useMemo(
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
          ...glassStyle,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transition: 'all 0.3s ease',
        }}
      >
        {/* ========== AI DUYURU ÇUBUĞU (kapatılabilir) ========== */}
        {!aiBannerDismissed && (
          <Box
            py={6}
            px="md"
            style={{
              textAlign: 'center',
              background: isDark
                ? 'linear-gradient(90deg, rgba(30,30,30,0.98) 0%, rgba(26,26,26,0.99) 100%)'
                : 'linear-gradient(90deg, rgba(250,250,250,0.98) 0%, rgba(245,245,245,0.99) 100%)',
              borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
            }}
          >
            <Group gap={8} justify="center">
              <IconSparkles size={14} color="#e6c530" />
              <Text size="xs" c="dimmed">
                Yeni! İhtiyaç duyduğunuz tüm yapay zeka araçları tek bir araç setinde bir araya
                getirildi.
              </Text>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label="Bannerı kapat"
                onClick={dismissAiBanner}
                style={{ opacity: 0.8, minWidth: 28, minHeight: 28 }}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Box>
        )}

        {/* ========== PRIMARY BAR (Artlist: tek sade bar) ========== */}
        <Box
          px={mounted && isMobile ? 'sm' : 'lg'}
          style={{
            height: mounted && isMobile ? 60 : 68,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* LEFT: Logo */}
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 'xs',
                borderRadius: 12,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'transparent',
              }}
              className="logo-container"
            >
              {/* Logo - Artlist tarzı minimal */}
              <Box
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box
                  style={{
                    position: 'absolute',
                    width: mounted && isMobile ? 44 : 56,
                    height: mounted && isMobile ? 44 : 56,
                    borderRadius: '50%',
                    background: isDark
                      ? 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 70%)',
                    filter: 'blur(6px)',
                    transition: 'all 0.3s ease',
                  }}
                  className="logo-glow"
                />
                <Image
                  src="/logo-transparent.png"
                  alt="Catering Pro"
                  width={136}
                  height={136}
                  sizes="(max-width: 768px) 56px, 68px"
                  priority
                  style={{
                    position: 'relative',
                    width: mounted && isMobile ? 56 : 68,
                    height: 'auto',
                    objectFit: 'contain',
                    transition: 'transform 0.3s ease, filter 0.3s ease',
                    // Dark theme: logo beyaz/açık ton (mavi-mor uyumsuzluğu gider)
                    ...(isDark && {
                      filter: 'brightness(0) invert(1)',
                    }),
                  }}
                  className="logo-image"
                />
              </Box>
            </Box>
          </Link>

          {/* Logo hover styles */}
          <style jsx global>{`
            .logo-container:hover {
              background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.3)'};
            }
            .logo-container:hover .logo-glow {
              filter: blur(8px);
              transform: scale(1.15);
              opacity: 1;
            }
            .logo-container:hover .logo-image {
              transform: scale(1.04);
              filter: ${isDark ? 'brightness(0) invert(1) drop-shadow(0 0 8px rgba(255,255,255,0.2))' : 'drop-shadow(0 0 6px rgba(255,255,255,0.4))'};
            }
            .user-menu-trigger:hover {
              background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
              border-color: ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)'} !important;
            }
          `}</style>

          {/* CENTER: Search Bar - Artlist tarzı pill */}
          {mounted && !isMobile && (
            <Box style={{ flex: 1, maxWidth: 420 }} mx="lg">
              <UnstyledButton
                onClick={openSearchModal}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 9999,
                  backgroundColor: isDark ? 'var(--surface-elevated)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? 'var(--surface-border)' : 'rgba(0,0,0,0.06)'}`,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
                className="search-trigger"
              >
                <IconSearch size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
                <Text size="sm" c="dimmed" style={{ flex: 1, textAlign: 'left' }}>
                  İhale, cari, fatura ara...
                </Text>
                <Group gap={4} style={{ flexShrink: 0 }}>
                  <Kbd size="xs">⌘</Kbd>
                  <Kbd size="xs">K</Kbd>
                </Group>
              </UnstyledButton>
            </Box>
          )}

          {/* RIGHT: Actions */}
          <Group gap={mounted && isMobile ? 6 : 'sm'}>
            {/* Mobile Search Icon */}
            {mounted && isMobile && (
              <Tooltip label="Ara" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  radius="xl"
                  color="gray"
                  onClick={openSearchModal}
                  style={{
                    background: isDark ? 'var(--surface-elevated)' : 'rgba(0,0,0,0.03)',
                  }}
                >
                  <IconSearch size={18} />
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
              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton
                    style={{
                      padding: mounted && isMobile ? '6px 8px' : '8px 12px',
                      borderRadius: 9999,
                      backgroundColor: isDark ? 'var(--surface-elevated)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'var(--surface-border)' : 'rgba(0,0,0,0.06)'}`,
                      transition: 'all 0.2s ease',
                    }}
                    className="user-menu-trigger"
                  >
                    <Group gap={mounted && isMobile ? 6 : 10} wrap="nowrap">
                      <Avatar
                        size={mounted && isMobile ? 'sm' : 32}
                        radius="xl"
                        color="blue"
                        variant="filled"
                        style={{ flexShrink: 0 }}
                      >
                        {getInitials(user.name ?? '')}
                      </Avatar>
                      {mounted && !isMobile && (
                        <>
                          <Box style={{ lineHeight: 1.25, minWidth: 0 }}>
                            <Group gap={6} wrap="nowrap" align="center">
                              <Text size="sm" fw={600} truncate style={{ lineHeight: 1.25 }}>
                                {(user.name ?? user.email).split(' ')[0]}
                              </Text>
                              {userIsAdmin && (
                                <Badge
                                  size="xs"
                                  color="red"
                                  variant="light"
                                  radius="sm"
                                  styles={{
                                    root: {
                                      fontWeight: 600,
                                      paddingLeft: 6,
                                      paddingRight: 6,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.02em',
                                    },
                                  }}
                                >
                                  Admin
                                </Badge>
                              )}
                            </Group>
                          </Box>
                          <IconChevronDown
                            size={16}
                            style={{ opacity: 0.5, flexShrink: 0, marginLeft: 2 }}
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
                  variant="light"
                  color="blue"
                  size="lg"
                  radius="xl"
                >
                  <IconLogin size={18} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Button
                component={Link}
                href="/giris"
                variant="light"
                size="sm"
                radius="xl"
                leftSection={<IconLogin size={16} />}
              >
                Giriş
              </Button>
            )}

            {/* Mobile Hamburger */}
            {mounted && (isMobile || isTablet) && (
              <Burger
                opened={mobileMenuOpened}
                onClick={() => setMobileMenuOpened(!mobileMenuOpened)}
                size="sm"
              />
            )}
          </Group>
        </Box>

        {/* ========== NAVIGATION BAR (Desktop Only) ========== */}
        {mounted && !isMobile && !isTablet && (
          <Box
            px="lg"
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              borderTop: `1px solid ${isDark ? 'var(--surface-border-subtle)' : 'rgba(0,0,0,0.04)'}`,
              gap: 'xs',
            }}
          >
            {/* Ana Sayfa */}
            <Button
              component={Link}
              href="/"
              leftSection={<IconHome size={16} />}
              variant={isActive('/') ? 'light' : 'subtle'}
              color={isActive('/') ? 'blue' : 'gray'}
              size="compact-sm"
              radius="md"
              style={isActive('/') ? { borderRadius: 8 } : undefined}
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
                    leftSection={<IconFolder size={16} />}
                    variant={isIhaleMerkezi ? 'light' : 'subtle'}
                    color={isIhaleMerkezi ? 'blue' : 'gray'}
                    size="compact-sm"
                    radius="md"
                    style={isIhaleMerkezi ? { borderRadius: 8 } : undefined}
                  >
                    İhale Merkezi
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    component={Link}
                    href="/ihale-merkezi"
                    leftSection={<IconSparkles size={16} color="var(--mantine-color-violet-6)" />}
                  >
                    <Box>
                      <Group justify="space-between" w="100%">
                        <Text size="sm" fw={500}>
                          İhale Merkezi
                        </Text>
                        <Badge size="xs" color="violet" variant="light">
                          Yeni
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        AI Destekli Yönetim
                      </Text>
                    </Box>
                  </Menu.Item>
                  <Menu.Divider />
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
                    leftSection={<IconCoin size={16} />}
                    variant={isFinans ? 'light' : 'subtle'}
                    color={isFinans ? 'teal' : 'gray'}
                    size="compact-sm"
                    radius="md"
                    style={isFinans ? { borderRadius: 8 } : undefined}
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
                    leftSection={<IconBuildingFactory2 size={16} />}
                    variant={isOperasyon ? 'light' : 'subtle'}
                    color={isOperasyon ? 'violet' : 'gray'}
                    size="compact-sm"
                    radius="md"
                    style={isOperasyon ? { borderRadius: 8 } : undefined}
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
                    leftSection={<IconDeviceMobile size={16} />}
                    variant={isSosyalMedya ? 'light' : 'subtle'}
                    color={isSosyalMedya ? 'pink' : 'gray'}
                    size="compact-sm"
                    radius="md"
                    style={isSosyalMedya ? { borderRadius: 8 } : undefined}
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
