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
import {
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconBuildingStore,
  IconChartBar,
  IconChartPie,
  IconChevronRight,
  IconDeviceMobile,
  IconHome,
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
      {
        label: 'İhale Merkezi',
        href: '/ihale-merkezi',
        icon: IconSparkles,
        badge: 'Yeni',
        badgeColor: 'violet',
      },
      {
        label: 'Yükle & Analiz',
        href: '/upload',
        icon: IconSparkles,
        badge: 'AI',
        badgeColor: 'violet',
      },
      {
        label: 'İhale İstihbarat',
        href: '/yuklenici-kutuphanesi',
        icon: IconBuildingStore,
      },
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

  return (
    <>
      {/* Backdrop */}
      <Transition mounted={opened} transition="fade" duration={200}>
        {(styles) => (
          <Box
            style={{
              ...styles,
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 199,
            }}
          />
        )}
      </Transition>

      {/* Sidebar */}
      <Transition mounted={opened} transition="slide-left" duration={300}>
        {(styles) => (
          <Box
            ref={sidebarRef}
            style={{
              ...styles,
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '85%',
              maxWidth: 360,
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: isDark ? '#0D1117' : '#FAFBFC',
              boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Hero Section with Logo – modern, logo düzgün oran */}
            <Box
              style={{
                position: 'relative',
                padding: '20px 20px 24px',
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
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
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
                    padding: '4px 0',
                  }}
                >
                  <Image
                    src="/logo-transparent.png"
                    alt="Catering Pro"
                    width={200}
                    height={80}
                    sizes="(max-width: 360px) 160px, 200px"
                    priority
                    style={{
                      height: 'auto',
                      maxHeight: 64,
                      width: 'auto',
                      maxWidth: 220,
                      objectFit: 'contain',
                      filter: 'brightness(0) invert(1)',
                    }}
                  />
                </Box>

                <UnstyledButton
                  onClick={onClose}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  className="sidebar-close-btn"
                >
                  <IconX size={20} color="white" />
                </UnstyledButton>
              </Group>
            </Box>

            {/* Menu Content */}
            <ScrollArea style={{ flex: 1 }} offsetScrollbars>
              <Stack gap="md" p="md">
                {/* Ana Sayfa - Standalone */}
                <UnstyledButton
                  onClick={() => handleNavigation('/')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    backgroundColor: isActive('/')
                      ? isDark
                        ? 'rgba(59, 130, 246, 0.2)'
                        : 'rgba(59, 130, 246, 0.1)'
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${isActive('/') ? 'rgba(59, 130, 246, 0.3)' : 'transparent'}`,
                    transition: 'all 0.2s ease',
                  }}
                  className="menu-item"
                >
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: isActive('/')
                            ? 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)'
                            : isDark
                              ? 'rgba(255,255,255,0.1)'
                              : 'rgba(0,0,0,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconHome
                          size={22}
                          color={isActive('/') ? 'white' : isDark ? '#9CA3AF' : '#6B7280'}
                        />
                      </Box>
                      <Text
                        fw={600}
                        size="md"
                        c={
                          isActive('/')
                            ? isDark
                              ? 'white'
                              : '#1F2937'
                            : isDark
                              ? '#E5E7EB'
                              : '#374151'
                        }
                      >
                        Ana Sayfa
                      </Text>
                    </Group>
                    <IconChevronRight size={18} style={{ opacity: 0.4 }} />
                  </Group>
                </UnstyledButton>

                {/* Menu Groups */}
                {menuGroups.map((group, _groupIndex) => (
                  <Box
                    key={group.title}
                    style={{
                      backgroundColor: isDark ? 'var(--surface-elevated)' : 'rgba(255,255,255,0.8)',
                      borderRadius: 16,
                      border: `1px solid ${isDark ? 'var(--surface-border)' : 'rgba(0,0,0,0.06)'}`,
                      borderLeft: `3px solid ${group.color}`,
                      overflow: 'hidden',
                      boxShadow: isDark
                        ? '0 4px 20px rgba(0,0,0,0.3)'
                        : '0 4px 20px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Group Header */}
                    <Box
                      px="md"
                      py="sm"
                      style={{
                        borderBottom: `1px solid ${isDark ? 'var(--surface-border-subtle)' : 'rgba(0,0,0,0.06)'}`,
                        background: isDark ? 'var(--surface-elevated-more)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <Text
                        size="xs"
                        fw={700}
                        tt="uppercase"
                        style={{
                          letterSpacing: 1.2,
                          color: group.color,
                        }}
                      >
                        {group.title}
                      </Text>
                    </Box>

                    {/* Group Items */}
                    <Stack gap={0}>
                      {group.items.map((item, itemIndex) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);

                        return (
                          <UnstyledButton
                            key={item.href}
                            onClick={() => handleNavigation(item.href)}
                            style={{
                              padding: '12px 16px',
                              borderBottom:
                                itemIndex < group.items.length - 1
                                  ? `1px solid ${isDark ? 'var(--surface-border-subtle)' : 'rgba(0,0,0,0.04)'}`
                                  : 'none',
                              backgroundColor: active
                                ? isDark
                                  ? 'var(--surface-elevated-more)'
                                  : 'rgba(0,0,0,0.04)'
                                : 'transparent',
                              position: 'relative',
                              transition: 'all 0.15s ease',
                            }}
                            className="menu-item"
                          >
                            {/* Active indicator */}
                            {active && (
                              <Box
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  width: 3,
                                  height: '60%',
                                  backgroundColor: group.color,
                                  borderRadius: '0 4px 4px 0',
                                  boxShadow: `0 0 10px ${group.color}`,
                                }}
                              />
                            )}

                            <Group justify="space-between">
                              <Group gap="sm">
                                <Box
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    background: active
                                      ? group.gradient
                                      : isDark
                                        ? 'var(--surface-elevated)'
                                        : 'rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <Icon
                                    size={20}
                                    color={active ? 'white' : group.color}
                                    style={{ transition: 'all 0.2s ease' }}
                                  />
                                </Box>
                                <Box>
                                  <Group gap={6}>
                                    <Text
                                      fw={active ? 600 : 500}
                                      size="sm"
                                      c={
                                        active
                                          ? isDark
                                            ? 'white'
                                            : '#111827'
                                          : isDark
                                            ? '#D1D5DB'
                                            : '#4B5563'
                                      }
                                    >
                                      {item.label}
                                    </Text>
                                    {item.badge && (
                                      <Badge
                                        size="xs"
                                        variant="gradient"
                                        gradient={{ from: 'violet', to: 'grape', deg: 90 }}
                                        style={{
                                          fontSize: 9,
                                          padding: '0 6px',
                                          textTransform: 'uppercase',
                                        }}
                                      >
                                        {item.badge}
                                      </Badge>
                                    )}
                                  </Group>
                                </Box>
                              </Group>
                              <IconChevronRight
                                size={16}
                                style={{
                                  opacity: active ? 0.8 : 0.3,
                                  transition: 'all 0.2s ease',
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

                {/* Admin Panel (if admin) */}
                {isAdmin && (
                  <UnstyledButton
                    onClick={() => handleNavigation('/admin')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: isActive('/admin')
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)'
                        : isDark
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'rgba(239, 68, 68, 0.05)',
                      border: `1px solid ${isActive('/admin') ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.2)'}`,
                      transition: 'all 0.2s ease',
                    }}
                    className="menu-item"
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <Box
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconShieldLock size={22} color="white" />
                        </Box>
                        <Box>
                          <Text fw={600} size="md" c={isDark ? '#FCA5A5' : '#DC2626'}>
                            Admin Panel
                          </Text>
                          <Text size="xs" c="dimmed">
                            Sistem yönetimi
                          </Text>
                        </Box>
                      </Group>
                      <Badge size="sm" color="red" variant="light">
                        ADMIN
                      </Badge>
                    </Group>
                  </UnstyledButton>
                )}
              </Stack>
            </ScrollArea>

            {/* User Section - Fixed at bottom */}
            {user && (
              <Box
                style={{
                  borderTop: `1px solid ${isDark ? 'var(--surface-border)' : 'rgba(0,0,0,0.08)'}`,
                  padding: '16px 20px',
                  background: isDark
                    ? 'var(--surface-elevated)'
                    : 'linear-gradient(180deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.03) 100%)',
                }}
              >
                <Group justify="space-between" mb="sm">
                  <Group gap="sm">
                    <Avatar
                      size={44}
                      radius="md"
                      color="blue"
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
                    >
                      {getInitials(user.name ?? '')}
                    </Avatar>
                    <Box>
                      <Text fw={600} size="sm" c={isDark ? 'white' : '#111827'}>
                        {user.name ?? user.email}
                      </Text>
                      <Text size="xs" c="dimmed" truncate style={{ maxWidth: 160 }}>
                        {user.email}
                      </Text>
                    </Box>
                  </Group>
                  {isAdmin && (
                    <Badge size="xs" color="red" variant="dot">
                      Admin
                    </Badge>
                  )}
                </Group>

                <Group grow gap="xs">
                  <UnstyledButton
                    onClick={() => handleNavigation('/profil')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: isDark ? 'var(--surface-elevated-more)' : 'rgba(0,0,0,0.05)',
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                    }}
                    className="user-action-btn"
                  >
                    <Group gap={6} justify="center">
                      <IconUser size={16} />
                      <Text size="xs" fw={500}>
                        Profil
                      </Text>
                    </Group>
                  </UnstyledButton>

                  <UnstyledButton
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: isDark
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(239, 68, 68, 0.1)',
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                    }}
                    className="logout-btn"
                  >
                    <Group gap={6} justify="center">
                      <IconLogout size={16} color="#EF4444" />
                      <Text size="xs" fw={500} c="#EF4444">
                        Çıkış
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Group>
              </Box>
            )}
          </Box>
        )}
      </Transition>
    </>
  );
}
