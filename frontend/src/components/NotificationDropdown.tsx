'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Group,
  Indicator,
  Loader,
  Menu,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBell,
  IconCheck,
  IconExternalLink,
  IconFileText,
  IconInfoCircle,
  IconLock,
  IconPackage,
  IconReceipt,
  IconServer,
  IconShieldExclamation,
  IconX,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api/services/admin';
import { useAuth } from '@/context/AuthContext';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  source: 'user' | 'admin' | 'system';
  severity: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, unknown>;
}

type FilterType = 'all' | 'user' | 'admin';

const typeConfig = {
  info: { icon: IconInfoCircle, color: 'blue' },
  success: { icon: IconCheck, color: 'green' },
  warning: { icon: IconAlertTriangle, color: 'orange' },
  error: { icon: IconX, color: 'red' },
};

const categoryIcons: Record<string, typeof IconInfoCircle> = {
  tender: IconFileText,
  invoice: IconReceipt,
  stock: IconPackage,
  system: IconServer,
  account_locked: IconLock,
  suspicious_activity: IconShieldExclamation,
  system_error: IconServer,
  high_priority: IconAlertTriangle,
};

const severityColors: Record<string, string> = {
  info: 'blue',
  warning: 'orange',
  error: 'red',
  critical: 'red',
};

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const router = useRouter();
  const { colorScheme } = useMantineColorScheme();
  const { user } = useAuth();
  const isDark = colorScheme === 'dark';

  // Kullanıcı admin mi?
  const isAdmin = user?.user_type === 'admin' || user?.user_type === 'super_admin';

  // Bildirim sayısını getir
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await adminAPI.getUnreadNotificationCount();
      const count = data.success && data.data ? data.data.count : 0;
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  // Bildirimleri getir
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof adminAPI.getNotifications>[0] = {
        limit: 15,
      };

      // Filtre uygula
      if (filter === 'user') {
        params.source = 'user';
      } else if (filter === 'admin' && isAdmin) {
        params.source = 'admin';
      }

      const data = await adminAPI.getNotifications(params);
      if (data.success && data.data) {
        setNotifications(data.data as Notification[]);
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [filter, isAdmin]);

  // İlk yükleme ve 60 sn'de bir poll
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Dropdown açıldığında veya filtre değiştiğinde fetch
  useEffect(() => {
    if (opened) {
      fetchNotifications();
    }
  }, [opened, fetchNotifications]);

  // Bildirimi okundu işaretle
  const markAsRead = async (id: number) => {
    try {
      await adminAPI.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Sessizce devam
    }
  };

  // Tüm bildirimleri okundu işaretle
  const markAllAsRead = async () => {
    try {
      const source = filter === 'all' ? undefined : filter === 'admin' ? 'admin' : 'user';
      await adminAPI.markAllNotificationsRead(source);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      fetchUnreadCount(); // Sayıyı güncelle
    } catch {
      // Sessizce devam
    }
  };

  // Bildirime tıkla
  const handleClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.link) {
      router.push(notification.link);
      setOpened(false);
    }
  };

  // Zaman formatla
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: tr,
      });
    } catch {
      return '';
    }
  };

  // Bildirim tipi belirleme
  const getNotificationType = (notification: Notification) => {
    if (notification.severity === 'critical' || notification.severity === 'error') {
      return 'error';
    }
    if (notification.severity === 'warning') {
      return 'warning';
    }
    return notification.type || 'info';
  };

  // Kaynak badge'i
  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'admin':
        return (
          <Badge size="xs" variant="light" color="red">
            Admin
          </Badge>
        );
      case 'system':
        return (
          <Badge size="xs" variant="light" color="gray">
            Sistem
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      shadow="lg"
      width={400}
      position="bottom-end"
      transitionProps={{ transition: 'pop-top-right' }}
      styles={{
        dropdown: {
          backgroundColor: isDark ? 'rgba(26, 27, 30, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 12,
          padding: 0,
        },
      }}
    >
      <Menu.Target>
        <Tooltip label="Bildirimler" withArrow>
          <Indicator
            disabled={unreadCount === 0}
            label={unreadCount > 9 ? '9+' : unreadCount}
            size={18}
            offset={4}
            color="red"
            processing={unreadCount > 0}
          >
            <ActionIcon
              variant="subtle"
              size="lg"
              radius="xl"
              color="gray"
              style={{
                transition: 'all 0.2s ease',
                background: isDark ? 'var(--surface-elevated)' : 'rgba(0,0,0,0.03)',
              }}
            >
              <IconBell size={20} />
            </ActionIcon>
          </Indicator>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        {/* Header */}
        <Box
          p="sm"
          style={{
            borderBottom: `1px solid ${isDark ? 'var(--surface-border)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Text fw={600} size="sm">
                Bildirimler
              </Text>
              {unreadCount > 0 && (
                <Badge size="sm" variant="filled" color="red">
                  {unreadCount}
                </Badge>
              )}
            </Group>
            {notifications.some((n) => !n.is_read) && (
              <UnstyledButton onClick={markAllAsRead}>
                <Text size="xs" c="blue" fw={500}>
                  Tümünü okundu işaretle
                </Text>
              </UnstyledButton>
            )}
          </Group>

          {/* Filtre - Sadece admin kullanıcıları için */}
          {isAdmin && (
            <SegmentedControl
              value={filter}
              onChange={(value) => setFilter(value as FilterType)}
              size="xs"
              fullWidth
              data={[
                { label: 'Tümü', value: 'all' },
                { label: 'Genel', value: 'user' },
                { label: 'Admin', value: 'admin' },
              ]}
            />
          )}
        </Box>

        {/* Content */}
        <ScrollArea.Autosize mah={400}>
          {loading ? (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          ) : notifications.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconBell size={40} style={{ opacity: 0.2 }} />
                <Text c="dimmed" size="sm">
                  Bildirim yok
                </Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap={0}>
              {notifications.map((notification) => {
                const notificationType = getNotificationType(notification);
                const config = typeConfig[notificationType] || typeConfig.info;
                const Icon = categoryIcons[notification.category] || config.icon;
                const iconColor =
                  notification.source === 'admin'
                    ? severityColors[notification.severity] || config.color
                    : config.color;

                return (
                  <UnstyledButton
                    key={notification.id}
                    onClick={() => handleClick(notification)}
                    p="sm"
                    style={{
                      borderBottom: `1px solid ${isDark ? 'var(--surface-border-subtle)' : 'rgba(0,0,0,0.05)'}`,
                      backgroundColor: notification.is_read
                        ? 'transparent'
                        : isDark
                          ? notification.source === 'admin'
                            ? 'rgba(250, 82, 82, 0.1)'
                            : 'rgba(34, 139, 230, 0.1)'
                          : notification.source === 'admin'
                            ? 'rgba(250, 82, 82, 0.05)'
                            : 'rgba(34, 139, 230, 0.05)',
                      transition: 'all 0.15s ease',
                    }}
                    className="notification-item"
                  >
                    <Group wrap="nowrap" align="flex-start" gap="sm">
                      <Box
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: isDark
                            ? `var(--mantine-color-${iconColor}-9)`
                            : `var(--mantine-color-${iconColor}-0)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={18} color={`var(--mantine-color-${iconColor}-6)`} />
                      </Box>

                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group justify="space-between" wrap="nowrap" mb={2}>
                          <Group gap={6}>
                            <Text size="sm" fw={notification.is_read ? 400 : 600} truncate>
                              {notification.title}
                            </Text>
                            {getSourceBadge(notification.source)}
                          </Group>
                          {!notification.is_read && (
                            <Box
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor:
                                  notification.source === 'admin'
                                    ? 'var(--mantine-color-red-6)'
                                    : 'var(--mantine-color-blue-6)',
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </Group>

                        {notification.message && (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {notification.message}
                          </Text>
                        )}

                        <Group gap="xs" mt={4}>
                          <Text size="xs" c="dimmed">
                            {formatTime(notification.created_at)}
                          </Text>
                          {notification.severity === 'critical' && (
                            <Badge size="xs" color="red" variant="filled">
                              Kritik
                            </Badge>
                          )}
                          {notification.link && (
                            <IconExternalLink size={12} style={{ opacity: 0.5 }} />
                          )}
                        </Group>
                      </Box>
                    </Group>
                  </UnstyledButton>
                );
              })}
            </Stack>
          )}
        </ScrollArea.Autosize>

        {/* Footer */}
        {notifications.length > 0 && (
          <Box
            p="sm"
            style={{
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <UnstyledButton
              onClick={() => {
                router.push('/ayarlar?tab=bildirimler');
                setOpened(false);
              }}
              style={{ width: '100%' }}
            >
              <Text size="sm" c="blue" ta="center" fw={500}>
                Tüm bildirimleri gör
              </Text>
            </UnstyledButton>
          </Box>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
