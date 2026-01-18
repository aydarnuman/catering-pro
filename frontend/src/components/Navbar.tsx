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
  IconBuilding,
  IconChartBar,
  IconChartPie,
  IconChevronDown,
  IconFolder,
  IconHome,
  IconList,
  IconLogin,
  IconLogout,
  IconMoon,
  IconPackage,
  IconReceipt,
  IconRobot,
  IconSearch,
  IconSettings,
  IconShieldLock,
  IconSparkles,
  IconSun,
  IconToolsKitchen2,
  IconUser,
  IconUserCircle,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { MobileSidebar } from './MobileSidebar';
import { NotificationDropdown } from './NotificationDropdown';
import { SearchModal } from './SearchModal';

export function Navbar() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);
  const [_mobileSearchOpened, _setMobileSearchOpened] = useState(false);
  const [searchModalOpened, { open: openSearchModal, close: closeSearchModal }] =
    useDisclosure(false);
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated, isAdmin: userIsAdmin, isLoading, logout } = useAuth();
  const { canView, isSuperAdmin, loading: permLoading } = usePermissions();

  const isDark = colorScheme === 'dark';

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  // Keyboard shortcut for search
  useHotkeys([['mod+k', () => openSearchModal()]]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Route helpers
  const isActive = (path: string) => pathname === path;
  const isIhaleMerkezi =
    pathname === '/tenders' || pathname === '/upload' || pathname === '/tracking';
  const isMuhasebe = pathname.startsWith('/muhasebe');
  const _isAyarlar = pathname.startsWith('/ayarlar');
  const isPlanlama = pathname.startsWith('/planlama');
  const _isAdminPage = pathname.startsWith('/admin');

  const handleLogout = () => {
    logout();
    router.push('/giris');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Glassmorphism styles - More transparent
  const glassStyle = {
    backgroundColor: isDark ? 'rgba(26, 27, 30, 0.65)' : 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
    boxShadow: isDark ? '0 4px 30px rgba(0, 0, 0, 0.2)' : '0 4px 30px rgba(0, 0, 0, 0.04)',
  };

  return (
    <>
      {/* Search Modal */}
      <SearchModal opened={searchModalOpened} onClose={closeSearchModal} />

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
        {/* ========== PRIMARY BAR ========== */}
        <Box
          px={mounted && isMobile ? 'sm' : 'lg'}
          style={{
            height: mounted && isMobile ? 64 : 72,
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
                padding: '4px 8px',
                borderRadius: 12,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'transparent',
              }}
              className="logo-container"
            >
              {/* Logo with subtle glow */}
              <Box
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Glow effect behind logo */}
                <Box
                  style={{
                    position: 'absolute',
                    width: mounted && isMobile ? 50 : 65,
                    height: mounted && isMobile ? 50 : 65,
                    borderRadius: '50%',
                    background:
                      'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12))',
                    filter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                  }}
                  className="logo-glow"
                />
                <img
                  src="/logo-transparent.png"
                  alt="Catering Pro"
                  style={{
                    position: 'relative',
                    height: mounted && isMobile ? 56 : 68,
                    width: 'auto',
                    objectFit: 'contain',
                    transition: 'transform 0.3s ease',
                  }}
                  className="logo-image"
                />
              </Box>
            </Box>
          </Link>

          {/* Logo hover styles */}
          <style jsx global>{`
            .logo-container:hover {
              background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.04)'};
            }
            .logo-container:hover .logo-glow {
              filter: blur(14px);
              transform: scale(1.3);
            }
            .logo-container:hover .logo-image {
              transform: scale(1.05);
            }
          `}</style>

          {/* CENTER: Search Bar (Desktop & Tablet) */}
          {mounted && !isMobile && (
            <Box style={{ flex: 1, maxWidth: 480, margin: '0 24px' }}>
              <UnstyledButton
                onClick={openSearchModal}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 12,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
                className="search-trigger"
              >
                <IconSearch size={18} style={{ opacity: 0.5 }} />
                <Text size="sm" c="dimmed" style={{ flex: 1 }}>
                  İhale, cari, fatura ara...
                </Text>
                <Group gap={4}>
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
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  }}
                >
                  <IconSearch size={18} />
                </ActionIcon>
              </Tooltip>
            )}

            {/* Notifications */}
            <NotificationDropdown />

            {/* Theme Toggle */}
            <Tooltip label={isDark ? 'Aydınlık mod' : 'Karanlık mod'} withArrow>
              <ActionIcon
                variant="subtle"
                onClick={() => toggleColorScheme()}
                size="lg"
                radius="xl"
                color="gray"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease',
                }}
              >
                {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>

            {/* User Menu */}
            {!mounted || isLoading ? (
              <Loader size="sm" />
            ) : isAuthenticated && user ? (
              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton
                    style={{
                      padding: mounted && isMobile ? 4 : '6px 12px',
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                      transition: 'all 0.2s ease',
                    }}
                    className="user-menu-trigger"
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Avatar
                        size={mounted && isMobile ? 'sm' : 32}
                        radius="xl"
                        color="blue"
                        variant="filled"
                      >
                        {getInitials(user.name)}
                      </Avatar>
                      {mounted && !isMobile && (
                        <>
                          <Box style={{ lineHeight: 1.2 }}>
                            <Text size="sm" fw={500} style={{ lineHeight: 1.2 }}>
                              {user.name.split(' ')[0]}
                            </Text>
                            {userIsAdmin && (
                              <Badge size="xs" color="red" variant="light">
                                Admin
                              </Badge>
                            )}
                          </Box>
                          <IconChevronDown size={14} style={{ opacity: 0.5 }} />
                        </>
                      )}
                    </Group>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>
                    <Text size="sm" fw={500}>
                      {user.name}
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
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
              gap: 4,
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
            >
              Ana Sayfa
            </Button>

            {/* İhale Merkezi Dropdown - Yetki kontrolü */}
            {(isSuperAdmin || canView('ihale')) && (
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

            {/* Muhasebe Dropdown - Yetki kontrolü */}
            {(isSuperAdmin ||
              canView('fatura') ||
              canView('cari') ||
              canView('stok') ||
              canView('personel') ||
              canView('kasa_banka') ||
              canView('demirbas') ||
              canView('rapor')) && (
              <Menu
                shadow="lg"
                width={240}
                position="bottom-start"
                transitionProps={{ transition: 'pop-top-left' }}
              >
                <Menu.Target>
                  <Button
                    rightSection={<IconChevronDown size={14} />}
                    leftSection={<IconWallet size={16} />}
                    variant={isMuhasebe ? 'light' : 'subtle'}
                    color={isMuhasebe ? 'teal' : 'gray'}
                    size="compact-sm"
                    radius="md"
                  >
                    Muhasebe
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    component={Link}
                    href="/muhasebe"
                    leftSection={<IconChartPie size={16} />}
                  >
                    Dashboard
                  </Menu.Item>
                  {(isSuperAdmin || canView('kasa_banka')) && (
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
                          Kasa, Banka
                        </Text>
                      </Box>
                    </Menu.Item>
                  )}
                  <Menu.Divider />
                  {(isSuperAdmin || canView('cari')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/cariler"
                      leftSection={<IconUsers size={16} />}
                    >
                      Cari Hesaplar
                    </Menu.Item>
                  )}
                  {(isSuperAdmin || canView('fatura')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/faturalar"
                      leftSection={<IconReceipt size={16} />}
                    >
                      Faturalar
                    </Menu.Item>
                  )}
                  {(isSuperAdmin || canView('stok')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/stok"
                      leftSection={<IconPackage size={16} />}
                    >
                      Stok Takibi
                    </Menu.Item>
                  )}
                  <Menu.Divider />
                  {(isSuperAdmin || canView('personel')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/personel"
                      leftSection={<IconUserCircle size={16} />}
                    >
                      Personel
                    </Menu.Item>
                  )}
                  {(isSuperAdmin || canView('demirbas')) && (
                    <Menu.Item
                      component={Link}
                      href="/muhasebe/demirbas"
                      leftSection={<IconBuilding size={16} />}
                    >
                      Envanter
                    </Menu.Item>
                  )}
                  <Menu.Divider />
                  {(isSuperAdmin || canView('rapor')) && (
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

            {/* Planlama Dropdown - Yetki kontrolü */}
            {(isSuperAdmin || canView('planlama')) && (
              <Menu
                shadow="lg"
                width={240}
                position="bottom-start"
                transitionProps={{ transition: 'pop-top-left' }}
              >
                <Menu.Target>
                  <Button
                    rightSection={<IconChevronDown size={14} />}
                    leftSection={<IconRobot size={16} />}
                    variant={isPlanlama ? 'light' : 'subtle'}
                    color={isPlanlama ? 'violet' : 'gray'}
                    size="compact-sm"
                    radius="md"
                  >
                    Planlama
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
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
