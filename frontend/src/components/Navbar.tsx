'use client';

import { useState } from 'react';
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
  Tooltip
} from '@mantine/core';
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
  IconShieldLock
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);

  const isActive = (path: string) => pathname === path;
  const isIhaleMerkezi = pathname === '/tenders' || pathname === '/upload' || pathname === '/tracking';
  const isMuhasebe = pathname.startsWith('/muhasebe');
  const isAyarlar = pathname.startsWith('/ayarlar');
  const isPlanlama = pathname.startsWith('/planlama');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <>
      <Box
        style={(theme) => ({
          borderBottom: `1px solid ${
            colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[2]
          }`,
          backgroundColor: colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        })}
      >
        <Group h={60} px="md" justify="space-between">
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Group gap="xs">
              <ThemeIcon size={36} radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                <IconFileText size={22} />
              </ThemeIcon>
              <Text size="xl" fw={700} style={{ 
                background: 'linear-gradient(45deg, var(--mantine-color-blue-6), var(--mantine-color-cyan-6))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Catering Pro
              </Text>
            </Group>
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
          <Group gap="xs">
            {/* Admin Button */}
            <Tooltip label="Admin Panel">
              <ActionIcon
                component={Link}
                href="/admin"
                variant={isAdmin ? 'filled' : 'subtle'}
                color={isAdmin ? 'red' : 'gray'}
                size="lg"
              >
                <IconShieldLock size={20} />
              </ActionIcon>
            </Tooltip>

            <ActionIcon
              variant="subtle"
              onClick={() => toggleColorScheme()}
              size="lg"
              aria-label="Toggle color scheme"
            >
              {colorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
            </ActionIcon>
            
            {/* Mobile Burger */}
            <Burger
              opened={opened}
              onClick={() => setOpened(!opened)}
              hiddenFrom="sm"
              size="sm"
            />
          </Group>
        </Group>

        {/* Mobile Navigation */}
        {opened && (
          <Box hiddenFrom="sm" pb="md" px="md">
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

              <Button
                component={Link}
                href="/admin"
                leftSection={<IconShieldLock size={18} />}
                variant={isAdmin ? 'filled' : 'light'}
                color="red"
                fullWidth
                onClick={() => setOpened(false)}
              >
                Admin Panel
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    </>
  );
}
