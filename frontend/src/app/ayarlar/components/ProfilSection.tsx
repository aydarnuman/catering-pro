'use client';

import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  PasswordInput,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar,
  IconCheck,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconInfoCircle,
  IconKey,
  IconLock,
  IconLockOpen,
  IconLogout,
  IconMail,
  IconShieldLock,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { authFetch } from '@/lib/api';
import { adminAPI } from '@/lib/api/services/admin';
import { API_BASE_URL } from '@/lib/config';
import type { UserInfo } from './types';

interface ProfilSectionProps {
  user: UserInfo | null;
  loading: boolean;
}

export default function ProfilSection({ user, loading }: ProfilSectionProps) {
  const { logout, isAuthenticated } = useAuth();

  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const [passwordModalOpened, { open: openPasswordModal, close: closePasswordModal }] = useDisclosure(false);
  const [logoutModalOpened, { open: openLogoutModal, close: closeLogoutModal }] = useDisclosure(false);

  // Session management
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Kaydedilmemiş değişiklik kontrolü
  const hasUnsavedChanges = useMemo(() => {
    if (!user) return false;
    return profileForm.name !== (user.name || '') || profileForm.email !== (user.email || '');
  }, [profileForm, user]);
  useUnsavedChanges(hasUnsavedChanges);

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || '', email: user.email || '' });
    }
  }, [user]);

  // Session'ları yükle
  const fetchSessions = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    setSessionsLoading(true);
    try {
      const data = await adminAPI.getSessions();
      if (data.success) {
        setSessions((data as any).sessions || []);
      }
    } catch (error: any) {
      if (error.response?.status !== 401) {
        console.error('Session yükleme hatası:', error);
      }
    } finally {
      setSessionsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && user) {
        fetchSessions();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user, fetchSessions]);

  const handleTerminateSession = async (sessionId: number) => {
    try {
      const data = await adminAPI.terminateSession(sessionId);
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Oturum sonlandırıldı',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchSessions();
      }
    } catch {
      notifications.show({ title: 'Hata', message: 'Oturum sonlandırılamadı', color: 'red' });
    }
  };

  const handleTerminateOtherSessions = async () => {
    try {
      const data = await adminAPI.terminateOtherSessions();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${(data as any).count || 0} oturum sonlandırıldı`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchSessions();
      }
    } catch {
      notifications.show({ title: 'Hata', message: 'Oturumlar sonlandırılamadı', color: 'red' });
    }
  };

  const getDeviceIcon = (deviceInfo: any) => {
    const device = deviceInfo?.device || 'Desktop';
    return device === 'Mobile' ? IconDeviceMobile : IconDeviceDesktop;
  };

  const formatDeviceInfo = (deviceInfo: any) => {
    if (!deviceInfo) return 'Bilinmiyor';
    const parts = [];
    if (deviceInfo.os) parts.push(deviceInfo.os);
    if (deviceInfo.browser) parts.push(deviceInfo.browser);
    return parts.join(' - ') || 'Bilinmiyor';
  };

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });

      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: 'Profil bilgileriniz güncellendi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        throw new Error('Güncelleme başarısız');
      }
    } catch (_err) {
      notifications.show({
        title: 'Hata',
        message: 'Profil güncellenirken bir hata oluştu',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      notifications.show({
        title: 'Hata',
        message: 'Yeni şifreler eşleşmiyor',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    if (passwordForm.new.length < 6) {
      notifications.show({
        title: 'Hata',
        message: 'Şifre en az 6 karakter olmalı',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/auth/password`, {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new,
        }),
      });

      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: 'Şifreniz değiştirildi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        closePasswordModal();
        setPasswordForm({ current: '', new: '', confirm: '' });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Şifre değiştirilemedi');
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Şifre değiştirilirken bir hata oluştu',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      <Stack gap="lg">
        <div>
          <Title order={3} mb={4}>
            👤 Profil Ayarları
          </Title>
          <Text c="dimmed" size="sm">
            Hesap bilgilerinizi yönetin
          </Text>
        </div>

        {/* Kullanıcı Kartı */}
        <Paper p="lg" radius="md" withBorder>
          <Group>
            {loading ? (
              <>
                <Skeleton circle height={80} />
                <div style={{ flex: 1 }}>
                  <Skeleton height={24} width={200} mb={8} />
                  <Skeleton height={16} width={250} />
                </div>
              </>
            ) : user ? (
              <>
                <Avatar size={80} radius="xl" color="blue" variant="filled">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <Group justify="space-between">
                    <div>
                      <Text fw={700} size="xl">
                        {user.name}
                      </Text>
                      <Group gap="xs" mt={4}>
                        <IconMail size={14} color="var(--mantine-color-dimmed)" />
                        <Text size="sm" c="dimmed">
                          {user.email}
                        </Text>
                      </Group>
                      {user.created_at && (
                        <Group gap="xs" mt={4}>
                          <IconCalendar size={14} color="var(--mantine-color-dimmed)" />
                          <Text size="xs" c="dimmed">
                            Üyelik: {new Date(user.created_at).toLocaleDateString('tr-TR')}
                          </Text>
                        </Group>
                      )}
                    </div>
                    <Badge
                      size="lg"
                      color={user.role === 'admin' ? 'red' : 'blue'}
                      variant="light"
                      leftSection={user.role === 'admin' ? <IconShieldLock size={14} /> : null}
                    >
                      {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                    </Badge>
                  </Group>
                </div>
              </>
            ) : (
              <Alert icon={<IconInfoCircle size={16} />} color="yellow" w="100%">
                Profil bilgilerini görmek için giriş yapın
              </Alert>
            )}
          </Group>
        </Paper>

        {/* Profil Düzenleme */}
        {user && (
          <>
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Text fw={600}>Profil Bilgileri</Text>
                <TextInput
                  label="Ad Soyad"
                  placeholder="Ad Soyad"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.currentTarget.value })}
                  leftSection={<IconUser size={16} />}
                />
                <TextInput
                  label="E-posta"
                  placeholder="E-posta"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.currentTarget.value })}
                  leftSection={<IconMail size={16} />}
                />
                <Button onClick={handleProfileSave} loading={saving} leftSection={<IconCheck size={16} />}>
                  Kaydet
                </Button>
              </Stack>
            </Paper>

            {/* Güvenlik */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Text fw={600}>Güvenlik</Text>
                <Group justify="space-between">
                  <div>
                    <Text size="sm">Şifre Değiştir</Text>
                    <Text size="xs" c="dimmed">
                      Hesabınızın güvenliği için düzenli olarak şifre değiştirin
                    </Text>
                  </div>
                  <Button
                    variant="light"
                    color="orange"
                    leftSection={<IconKey size={16} />}
                    onClick={openPasswordModal}
                  >
                    Şifre Değiştir
                  </Button>
                </Group>
              </Stack>
            </Paper>

            {/* Aktif Oturumlar */}
            <Paper p="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600}>Aktif Oturumlar</Text>
                  <Text size="xs" c="dimmed">
                    Tüm cihazlardaki oturumlarınızı yönetin
                  </Text>
                </div>
                {sessions.filter((s) => s.isActive).length > 1 && (
                  <Button
                    variant="light"
                    color="red"
                    size="xs"
                    leftSection={<IconLockOpen size={14} />}
                    onClick={handleTerminateOtherSessions}
                  >
                    Diğerlerini Sonlandır
                  </Button>
                )}
              </Group>
              {sessionsLoading ? (
                <Center py="md">
                  <Loader size="sm" />
                </Center>
              ) : sessions.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Aktif oturum bilgisi yok
                </Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Cihaz</Table.Th>
                      <Table.Th>IP</Table.Th>
                      <Table.Th>Son Aktivite</Table.Th>
                      <Table.Th ta="right">İşlem</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sessions.map((session) => {
                      const DeviceIcon = getDeviceIcon(session.deviceInfo);
                      const isCurrent = session.isCurrent || false;
                      return (
                        <Table.Tr key={session.id}>
                          <Table.Td>
                            <Group gap="xs">
                              <DeviceIcon size={16} />
                              <Text size="sm">{formatDeviceInfo(session.deviceInfo)}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{session.ipAddress || '-'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {session.lastActivity
                                ? new Date(session.lastActivity).toLocaleString('tr-TR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '-'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" justify="flex-end">
                              {isCurrent && (
                                <Badge size="sm" color="green" variant="light">
                                  Mevcut
                                </Badge>
                              )}
                              {session.isActive && !isCurrent && (
                                <Tooltip label="Sonlandır">
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => handleTerminateSession(session.id)}
                                  >
                                    <IconTrash size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>

            {/* Çıkış */}
            <Paper p="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>
                    Oturum
                  </Text>
                  <Text size="xs" c="dimmed">
                    Hesabınızdan güvenli çıkış yapın
                  </Text>
                </div>
                <Button variant="light" color="red" leftSection={<IconLogout size={16} />} onClick={openLogoutModal}>
                  Çıkış Yap
                </Button>
              </Group>
            </Paper>
          </>
        )}
      </Stack>

      {/* Şifre Değiştir Modal */}
      <Modal opened={passwordModalOpened} onClose={closePasswordModal} title="Şifre Değiştir" size="sm">
        <Stack gap="md">
          <PasswordInput
            label="Mevcut Şifre"
            placeholder="Mevcut şifrenizi girin"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.currentTarget.value })}
            leftSection={<IconLock size={16} />}
          />
          <PasswordInput
            label="Yeni Şifre"
            placeholder="Yeni şifrenizi girin"
            value={passwordForm.new}
            onChange={(e) => setPasswordForm({ ...passwordForm, new: e.currentTarget.value })}
            leftSection={<IconKey size={16} />}
          />
          <PasswordInput
            label="Yeni Şifre (Tekrar)"
            placeholder="Yeni şifrenizi tekrar girin"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.currentTarget.value })}
            leftSection={<IconKey size={16} />}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closePasswordModal}>
              İptal
            </Button>
            <Button onClick={handlePasswordChange} loading={saving} color="blue">
              Şifreyi Değiştir
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Çıkış Onay Modal */}
      <Modal opened={logoutModalOpened} onClose={closeLogoutModal} title="Çıkış Yap" size="sm" centered>
        <Stack gap="md">
          <Text>Oturumunuzu kapatmak istediğinize emin misiniz?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeLogoutModal}>
              İptal
            </Button>
            <Button color="red" onClick={handleLogout} leftSection={<IconLogout size={16} />}>
              Çıkış Yap
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
