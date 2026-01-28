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
  IconPackage,
  IconReceipt,
  IconX,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api/services/admin';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  source?: 'normal' | 'admin';
  severity?: string;
}

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
  system: IconInfoCircle,
};

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  const router = useRouter();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Sadece normal bildirim sayısı (auth/admin bildirimleri kaldırıldı)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await adminAPI.getUnreadNotificationCount();
      const count = data.success && data.data ? data.data.count : 0;
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  // Sadece normal bildirimler (auth/admin bildirimleri kaldırıldı)
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getNotifications(10);
      if (data.success && data.data) {
        const list = (data.data as Notification[]).map((n) => ({ ...n, source: 'normal' as const }));
        setNotifications(list.slice(0, 10));
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yükleme ve 60 sn'de bir poll
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch when opened
  useEffect(() => {
    if (opened) {
      fetchNotifications();
    }
  }, [opened, fetchNotifications]);

  // Mark as read (sadece normal bildirimler)
  const markAsRead = async (id: number) => {
    try {
      await adminAPI.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Sessizce devam
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await adminAPI.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Sessizce devam
    }
  };

  // Handle notification click
  const handleClick = (notification: Notification & { source?: string }) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.link) {
      router.push(notification.link);
      setOpened(false);
    }
  };

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

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      shadow="lg"
      width={360}
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
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
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
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <Group justify="space-between">
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
            {unreadCount > 0 && (
              <UnstyledButton onClick={markAllAsRead}>
                <Text size="xs" c="blue" fw={500}>
                  Tümünü okundu işaretle
                </Text>
              </UnstyledButton>
            )}
          </Group>
        </Box>

        {/* Content */}
        <ScrollArea.Autosize mah={350}>
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
                // Admin bildirimleri için severity'ye göre type belirle
                const notificationType =
                  notification.severity === 'critical'
                    ? 'error'
                    : notification.severity === 'warning'
                      ? 'warning'
                      : notification.type;

                const config = typeConfig[notificationType] || typeConfig.info;
                const Icon = config.icon;
                const _CategoryIcon = categoryIcons[notification.category] || IconInfoCircle;

                return (
                  <UnstyledButton
                    key={notification.id}
                    onClick={() => handleClick(notification)}
                    p="sm"
                    style={{
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                      backgroundColor: notification.is_read
                        ? 'transparent'
                        : isDark
                          ? 'rgba(34, 139, 230, 0.1)'
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
                            ? `var(--mantine-color-${config.color}-9)`
                            : `var(--mantine-color-${config.color}-0)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={18} color={`var(--mantine-color-${config.color}-6)`} />
                      </Box>

                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group justify="space-between" wrap="nowrap" mb={2}>
                          <Text size="sm" fw={notification.is_read ? 400 : 600} truncate>
                            {notification.title}
                          </Text>
                          {!notification.is_read && (
                            <Box
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: 'var(--mantine-color-blue-6)',
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
                router.push('/ayarlar');
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
