'use client';

import { useState, useEffect } from 'react';
import {
  Group,
  Button,
  Text,
  ActionIcon,
  useMantineColorScheme,
  Burger,
  Stack,
  Box,
  Badge,
  Menu,
  Divider,
  ThemeIcon,
  Tooltip,
  Avatar,
  Loader,
  ScrollArea
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconSun,
  IconMoon,
  IconHome,
  IconList,
  IconUpload,
  IconChartBar,
  IconFileText,
  IconChevronDown,
  IconFolder,
  IconSettings,
  IconSparkles,
  IconBookmark,
  IconWallet,
  IconReportMoney,
  IconUsers,
  IconReceipt,
  IconShoppingCart,
  IconPackage,
  IconUserCircle,
  IconBuildingBank,
  IconChartPie,
  IconRobot,
  IconBuilding,
  IconToolsKitchen2,
  IconShieldLock,
  IconLogin,
  IconLogout,
  IconUser
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function Navbar() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const pathname = usePathname();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated, isAdmin: userIsAdmin, isLoading, logout } = useAuth();
  
  // Mobil responsive kontrolü
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Client-side mount kontrolü (hydration hatası önleme)
  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => pathname === path;
  const isIhaleMerkezi = pathname === '/tenders' || pathname === '/upload' || pathname === '/tracking';
  const isMuhasebe = pathname.startsWith('/muhasebe');
  const isAyarlar = pathname.startsWith('/ayarlar');
  const isPlanlama = pathname.startsWith('/planlama');
  const isAdminPage = pathname.startsWith('/admin');

  const handleLogout = () => {
    logout();
    router.push('/giris');
  };

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Box
        style={(theme) => ({
          borderBottom: `1px solid ${
            colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
          }`,
          backgroundColor: colorScheme === 'dark' 
            ? 'rgba(26, 27, 30, 0.75)' 
            : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          boxShadow: colorScheme === 'dark'
            ? '0 4px 30px rgba(0, 0, 0, 0.3)'
            : '0 4px 30px rgba(0, 0, 0, 0.08)',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transition: 'all 0.3s ease',
        })}
      >
        <Group h={mounted && isMobile ? 56 : 100} px={mounted && isMobile ? 'sm' : 'md'} justify="space-between">
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Box style={{ 
              width: mounted && isMobile ? 100 : 220, 
              display: 'flex', 
              alignItems: 'center' 
            }}>
              <img 
                src="/logo.png" 
                alt="Catering Pro" 
                style={{ 
                  height: mounted && isMobile ? 70 : 170,
                  width: 'auto',
                  objectFit: 'contain',
                  marginTop: mounted && isMobile ? -8 : -35,
                  marginBottom: 0,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            </Box>
          </Link>

          {/* Desktop Navigation */}
          <Group gap="sm" visibleFrom="sm">
            {/* Ana Sayfa */}
            <Button
              component={Link}
              href="/"
              leftSection={<IconHome size={18} />}
              variant={isActive('/') ? 'filled' : 'subtle'}
              color={isActive('/') ? 'blue' : 'gray'}
            >
              Ana Sayfa
            </Button>

            {/* İhale Merkezi Dropdown */}
            <Menu 
              shadow="md" 
              width={220} 
              position="bottom-start"
              transitionProps={{ transition: 'pop-top-left' }}
            >
              <Menu.Target>
                <Button
                  rightSection={<IconChevronDown size={16} />}
                  leftSection={<IconFolder size={18} />}
                  variant={isIhaleMerkezi ? 'filled' : 'subtle'}
                  color={isIhaleMerkezi ? 'blue' : 'gray'}
                >
                  İhale Merkezi
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>İhale İşlemleri</Menu.Label>
                
                <Menu.Item
                  component={Link}
                  href="/tenders"
                  leftSection={<IconList size={18} />}
                  style={{
                    backgroundColor: isActive('/tenders') ? 'var(--mantine-color-blue-light)' : undefined,
                  }}
                >
                  <Group justify="space-between" w="100%">
                    <Text size="sm">İhale Listesi</Text>
                    {isActive('/tenders') && (
                      <Badge size="xs" color="blue" variant="filled">Aktif</Badge>
                    )}
                  </Group>
                </Menu.Item>

                <Menu.Item
                  component={Link}
                  href="/upload"
                  leftSection={<IconSparkles size={18} color="var(--mantine-color-violet-6)" />}
                  style={{
                    backgroundColor: isActive('/upload') ? 'var(--mantine-color-violet-light)' : undefined,
                  }}
                >
                  <Group justify="space-between" w="100%">
                    <div>
                      <Text size="sm" fw={500}>Yükle & Analiz</Text>
                      <Text size="xs" c="dimmed">Claude AI</Text>
                    </div>
                    {isActive('/upload') && (
                      <Badge size="xs" color="violet" variant="filled">Aktif</Badge>
                    )}
                  </Group>
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  component={Link}
                  href="/tracking"
                  leftSection={<IconBookmark size={18} color="var(--mantine-color-cyan-6)" />}
                  style={{
                    backgroundColor: isActive('/tracking') ? 'var(--mantine-color-cyan-light)' : undefined,
                  }}
                >
                  <Group justify="space-between" w="100%">
                    <div>
                      <Text size="sm" fw={500}>İhale Takibim</Text>
                      <Text size="xs" c="dimmed">Kaydedilenler</Text>
                    </div>
                    {isActive('/tracking') && (
                      <Badge size="xs" color="cyan" variant="filled">Aktif</Badge>
                    )}
                  </Group>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Muhasebe Dropdown */}
            <Menu 
              shadow="md" 
              width={220} 
              position="bottom-start"
              transitionProps={{ transition: 'pop-top-left' }}
            >
              <Menu.Target>
                <Button
                  rightSection={<IconChevronDown size={16} />}
                  leftSection={<IconWallet size={18} />}
                  variant={isMuhasebe ? 'filled' : 'subtle'}
                  color={isMuhasebe ? 'teal' : 'gray'}
                >
                  Muhasebe
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Mali İşlemler</Menu.Label>
                
                <Menu.Item
                  component={Link}
                  href="/muhasebe"
                  leftSection={<IconChartPie size={18} />}
                  style={{
                    backgroundColor: isActive('/muhasebe') ? 'var(--mantine-color-teal-light)' : undefined,
                  }}
                >
                  <Text size="sm">Dashboard</Text>
                </Menu.Item>

                <Menu.Item
                  component={Link}
                  href="/muhasebe/finans"
                  leftSection={<IconWallet size={18} color="var(--mantine-color-blue-6)" />}
                  style={{
                    backgroundColor: isActive('/muhasebe/finans') ? 'var(--mantine-color-blue-light)' : undefined,
                  }}
                >
                  <Group justify="space-between" w="100%">
                    <div>
                      <Text size="sm" fw={500}>Finans Merkezi</Text>
                      <Text size="xs" c="dimmed">Kasa, Banka, Çek/Senet</Text>
                    </div>
                  </Group>
                </Menu.Item>

                <Menu.Item
                  component={Link}
                  href="/muhasebe/cariler"
                  leftSection={<IconUsers size={18} />}
                  style={{
                    backgroundColor: isActive('/muhasebe/cariler') ? 'var(--mantine-color-teal-light)' : undefined,
                  }}
                >
                  <Text size="sm">Cari Hesaplar</Text>
                </Menu.Item>

                <Menu.Item
                  component={Link}
                  href="/muhasebe/faturalar"
                  leftSection={<IconReceipt size={18} />}
                  style={{
                    backgroundColor: isActive('/muhasebe/faturalar') ? 'var(--mantine-color-teal-light)' : undefined,
                  }}
                >
                  <Text size="sm">Faturalar</Text>
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  component={Link}
                  href="/muhasebe/satin-alma"
                  leftSection={<IconShoppingCart size={18} />}
                  style={{
                    backgroundColor: isActive('/muhasebe/satin-alma') ? 'var(--mantine-color-teal-light)' : undefined,
                  }}
                >
                  <Text size="sm">Satın Alma</Text>
                </Menu.Item>

                <Menu.Item
                  component={Link}
                  href="/muhasebe/stok"
                  leftSection={<IconPackage size={18} />}
                  style={{
                    backgroundColor: isActive('/muhasebe/stok') ? 'var(--mantine-color-teal-light)' : undefined,
                  }}
                >
                  <Text size="sm">Stok Takibi</Text>
                </Menu.Item>

                <Menu.Item
                  component={Link}
                  href="/muhasebe/demirbas"
                  leftSection={<IconBuilding size={18} />}
                  style={{
                    backgroundColor: isActive('/muhasebe/demirbas') ? 'var(--mantine-color-teal-light)' : undefined,
                  }}
                >
                  <Text size="sm">Envanter</Text>
                </Menu.Item>

                <Menu.Item
                  component={Link}
                  href="/muhasebe/personel"
                  leftSection={<IconUserCircle size={18} />}
                  style={{
                    backgroundColor: isActive('/muhasebe/personel') ? 'var(--mantine-color-teal-light)' : undefined,
                  }}
                >
                  <Text size="sm">Personel</Text>
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  component={Link}
                  href="/muhasebe/raporlar"
                  leftSection={<IconChartBar size={18} />}
                  style={{
                    backgroundColor: isActive('/muhasebe/raporlar') ? 'var(--mantine-color-teal-light)' : undefined,
                  }}
                >
                  <Text size="sm">Raporlar</Text>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Planlama Dropdown */}
            <Menu 
              shadow="md" 
              width={220} 
              position="bottom-start"
              transitionProps={{ transition: 'pop-top-left' }}
            >
              <Menu.Target>
                <Button
                  rightSection={<IconChevronDown size={16} />}
                  leftSection={<IconRobot size={18} />}
                  variant={isPlanlama ? 'filled' : 'subtle'}
                  color={isPlanlama ? 'violet' : 'gray'}
                >
                  Planlama
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>AI Destekli Planlama</Menu.Label>
                
                <Menu.Item
                  component={Link}
                  href="/planlama/piyasa-robotu"
                  leftSection={<IconRobot size={18} color="var(--mantine-color-violet-6)" />}
                  style={{
                    backgroundColor: pathname === '/planlama/piyasa-robotu' ? 'var(--mantine-color-violet-light)' : undefined,
                  }}
                >
                  <Group justify="space-between" w="100%">
                    <div>
                      <Text size="sm" fw={500}>Piyasa Robotu</Text>
                      <Text size="xs" c="dimmed">Fiyat Araştırma</Text>
                    </div>
                    {pathname === '/planlama/piyasa-robotu' && (
                      <Badge size="xs" color="violet" variant="filled">Aktif</Badge>
                    )}
                  </Group>
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  component={Link}
                  href="/muhasebe/menu-planlama"
                  leftSection={<IconToolsKitchen2 size={18} color="var(--mantine-color-orange-6)" />}
                  style={{
                    backgroundColor: pathname === '/muhasebe/menu-planlama' ? 'var(--mantine-color-orange-light)' : undefined,
                  }}
                >
                  <Group justify="space-between" w="100%">
                    <div>
                      <Text size="sm" fw={500}>Menü Planlama</Text>
                      <Text size="xs" c="dimmed">Reçete & Maliyet</Text>
                    </div>
                    {pathname === '/muhasebe/menu-planlama' && (
                      <Badge size="xs" color="orange" variant="filled">Aktif</Badge>
                    )}
                  </Group>
                </Menu.Item>

                <Menu.Divider />
                <Menu.Label c="dimmed">Yakında</Menu.Label>

                <Menu.Item
                  leftSection={<IconReportMoney size={18} />}
                  disabled
                >
                  <Text size="sm" c="dimmed">Maliyet Analizi</Text>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Ayarlar */}
            <Button
              component={Link}
              href="/ayarlar"
              leftSection={<IconSettings size={18} />}
              variant={isAyarlar ? 'filled' : 'subtle'}
              color={isAyarlar ? 'orange' : 'gray'}
            >
              Ayarlar
            </Button>
          </Group>

          {/* Right Section */}
          <Group gap={mounted && isMobile ? 4 : 'xs'}>
            {/* Admin Button - only for admin users (mounted kontrolü) */}
            {mounted && isAuthenticated && userIsAdmin && (
              <Tooltip label="Admin Panel" withArrow>
                <ActionIcon
                  component={Link}
                  href="/admin"
                  variant={isAdminPage ? 'filled' : 'subtle'}
                  color={isAdminPage ? 'red' : 'gray'}
                  size={mounted && isMobile ? 'md' : 'lg'}
                  radius="xl"
                  style={{
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isAdminPage 
                      ? undefined 
                      : (colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                  }}
                >
                  <IconShieldLock size={mounted && isMobile ? 16 : 18} />
                </ActionIcon>
              </Tooltip>
            )}

            {/* Dark Mode Toggle */}
            <Tooltip label={colorScheme === 'dark' ? 'Aydınlık mod' : 'Karanlık mod'} withArrow>
              <ActionIcon
                variant="subtle"
                onClick={() => toggleColorScheme()}
                size={mounted && isMobile ? 'md' : 'lg'}
                radius="xl"
                aria-label="Toggle color scheme"
                color="gray"
                style={{
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: colorScheme === 'dark' 
                    ? 'rgba(255,255,255,0.05)' 
                    : 'rgba(0,0,0,0.03)',
                }}
              >
                {colorScheme === 'dark' ? (
                  <IconSun size={mounted && isMobile ? 16 : 18} style={{ transition: 'transform 0.3s ease' }} />
                ) : (
                  <IconMoon size={mounted && isMobile ? 16 : 18} style={{ transition: 'transform 0.3s ease' }} />
                )}
              </ActionIcon>
            </Tooltip>

            {/* Auth Section - mounted kontrolü ile hydration hatası önleme */}
            {!mounted || isLoading ? (
              <Loader size="sm" />
            ) : isAuthenticated && user ? (
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <Tooltip label={user.name} withArrow disabled={!isMobile}>
                    <ActionIcon 
                      variant="subtle" 
                      size={mounted && isMobile ? 'md' : 'lg'} 
                      radius="xl"
                      style={{ transition: 'all 0.2s ease' }}
                    >
                      <Avatar
                        size={mounted && isMobile ? 'xs' : 'sm'}
                        radius="xl"
                        color="blue"
                        style={{ cursor: 'pointer' }}
                      >
                        {getInitials(user.name)}
                      </Avatar>
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>
                    <Text size="sm" fw={500}>{user.name}</Text>
                    <Text size="xs" c="dimmed">{user.email}</Text>
                  </Menu.Label>
                  <Menu.Divider />
                  <Menu.Item
                    component={Link}
                    href="/profil"
                    leftSection={<IconUser size={16} />}
                  >
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
            ) : (
              /* Giriş Butonu - Mobilde sadece ikon, Desktop'ta text */
              mounted && isMobile ? (
                <Tooltip label="Giriş Yap" withArrow>
                  <ActionIcon
                    component={Link}
                    href="/giris"
                    variant="subtle"
                    color="blue"
                    size="md"
                    radius="xl"
                    style={{ 
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: colorScheme === 'dark' 
                        ? 'rgba(34, 139, 230, 0.1)' 
                        : 'rgba(34, 139, 230, 0.08)',
                    }}
                  >
                    <IconLogin size={16} />
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
                  style={{ 
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontWeight: 500,
                  }}
                >
                  Giriş
                </Button>
              )
            )}
            
            {/* Mobile Burger */}
            <Burger
              opened={opened}
              onClick={() => setOpened(!opened)}
              hiddenFrom="sm"
              size="sm"
              style={{ transition: 'all 0.2s ease' }}
            />
          </Group>
        </Group>

        {/* Mobile Navigation */}
        {opened && (
          <Box hiddenFrom="sm" pb="md" px="md">
            <ScrollArea.Autosize mah="calc(100vh - 80px)" offsetScrollbars>
            <Stack gap="xs">
              <Button
                component={Link}
                href="/"
                leftSection={<IconHome size={18} />}
                variant={isActive('/') ? 'filled' : 'light'}
                fullWidth
                onClick={() => setOpened(false)}
              >
                Ana Sayfa
              </Button>

              <Divider label="İhale Merkezi" labelPosition="center" />

              <Button
                component={Link}
                href="/tenders"
                leftSection={<IconList size={18} />}
                variant={isActive('/tenders') ? 'filled' : 'light'}
                fullWidth
                onClick={() => setOpened(false)}
              >
                İhale Listesi
              </Button>

              <Button
                component={Link}
                href="/upload"
                leftSection={<IconSparkles size={18} />}
                variant={isActive('/upload') ? 'filled' : 'light'}
                color="violet"
                fullWidth
                onClick={() => setOpened(false)}
              >
                Yükle & Analiz (AI)
              </Button>

              <Button
                component={Link}
                href="/tracking"
                leftSection={<IconBookmark size={18} />}
                variant={isActive('/tracking') ? 'filled' : 'light'}
                color="cyan"
                fullWidth
                onClick={() => setOpened(false)}
              >
                İhale Takibim
              </Button>

              <Divider label="Muhasebe" labelPosition="center" />

              <Button
                component={Link}
                href="/muhasebe"
                leftSection={<IconChartPie size={18} />}
                variant={isActive('/muhasebe') ? 'filled' : 'light'}
                color="teal"
                fullWidth
                onClick={() => setOpened(false)}
              >
                Dashboard
              </Button>

              <Button
                component={Link}
                href="/muhasebe/finans"
                leftSection={<IconWallet size={18} />}
                variant={isActive('/muhasebe/finans') ? 'filled' : 'light'}
                color="blue"
                fullWidth
                onClick={() => setOpened(false)}
              >
                Finans Merkezi
              </Button>

              <Button
                component={Link}
                href="/muhasebe/cariler"
                leftSection={<IconUsers size={18} />}
                variant={isActive('/muhasebe/cariler') ? 'filled' : 'light'}
                color="teal"
                fullWidth
                onClick={() => setOpened(false)}
              >
                Cari Hesaplar
              </Button>

              <Button
                component={Link}
                href="/muhasebe/faturalar"
                leftSection={<IconReceipt size={18} />}
                variant={isActive('/muhasebe/faturalar') ? 'filled' : 'light'}
                color="teal"
                fullWidth
                onClick={() => setOpened(false)}
              >
                Faturalar
              </Button>

              <Divider label="Planlama" labelPosition="center" />

              <Button
                component={Link}
                href="/planlama/piyasa-robotu"
                leftSection={<IconRobot size={18} />}
                variant={pathname === '/planlama/piyasa-robotu' ? 'filled' : 'light'}
                color="violet"
                fullWidth
                onClick={() => setOpened(false)}
              >
                Piyasa Robotu
              </Button>

              <Divider label="Sistem" labelPosition="center" />

              <Button
                component={Link}
                href="/ayarlar"
                leftSection={<IconSettings size={18} />}
                variant={isAyarlar ? 'filled' : 'light'}
                color="orange"
                fullWidth
                onClick={() => setOpened(false)}
              >
                Ayarlar
              </Button>

              {mounted && isAuthenticated && userIsAdmin && (
                <Button
                  component={Link}
                  href="/admin"
                  leftSection={<IconShieldLock size={18} />}
                  variant={isAdminPage ? 'filled' : 'light'}
                  color="red"
                  fullWidth
                  onClick={() => setOpened(false)}
                >
                  Admin Panel
                </Button>
              )}

              <Divider my="xs" />

              {!mounted ? (
                <Loader size="sm" mx="auto" />
              ) : isAuthenticated && user ? (
                <>
                  <Box px="xs" py="sm">
                    <Group>
                      <Avatar size="sm" radius="xl" color="blue">
                        {getInitials(user.name)}
                      </Avatar>
                      <div>
                        <Text size="sm" fw={500}>{user.name}</Text>
                        <Text size="xs" c="dimmed">{user.email}</Text>
                      </div>
                    </Group>
                  </Box>
                  <Button
                    leftSection={<IconLogout size={18} />}
                    variant="light"
                    color="red"
                    fullWidth
                    onClick={() => {
                      setOpened(false);
                      handleLogout();
                    }}
                  >
                    Çıkış Yap
                  </Button>
                </>
              ) : (
                <Button
                  component={Link}
                  href="/giris"
                  leftSection={<IconLogin size={18} />}
                  variant="filled"
                  color="blue"
                  fullWidth
                  onClick={() => setOpened(false)}
                >
                  Giriş Yap
                </Button>
              )}
            </Stack>
            </ScrollArea.Autosize>
          </Box>
        )}
      </Box>
    </>
  );
}
