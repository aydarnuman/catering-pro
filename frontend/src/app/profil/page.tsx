'use client';

import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Grid,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconKey,
  IconLock,
  IconLockOpen,
  IconMail,
  IconShieldCheck,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { adminAPI } from '@/lib/api/services/admin';

export default function ProfilPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Session management
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Kullanıcı bilgilerini yükle
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // Auth kontrolü ve redirect - sadece gerçekten authenticated değilse yönlendir
  const hasRedirected = useRef(false);
  useEffect(() => {
    // Loading bitene kadar bekle
    if (authLoading) return;

    // Zaten redirect yaptıysak tekrar yapma
    if (hasRedirected.current) return;

    // Eğer authenticated değilse ve user da yoksa login'e yönlendir
    if (!isAuthenticated && !user) {
      hasRedirected.current = true;
      router.replace('/giris');
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Session'ları yükle (opsiyonel - 401 hatası normal)
  useEffect(() => {
    const fetchSessions = async () => {
      if (!isAuthenticated || !user) return;

      setSessionsLoading(true);
      try {
        const data = await adminAPI.getSessions();
        if (data.success) {
          setSessions((data as any).sessions || []);

          // Mevcut session'ı belirle (refresh token'dan)
          // Not: Backend'den mevcut session bilgisi gelirse daha iyi olur
        }
      } catch (error: any) {
        // 401 hatası normal - session endpoint Bearer token bekliyor ama cookie-based auth kullanıyoruz
        // Bu endpoint opsiyonel, hata durumunda sessizce devam et
        if (error.response?.status !== 401) {
          console.error('Session yükleme hatası:', error);
        }
      } finally {
        setSessionsLoading(false);
      }
    };

    // Kısa bir gecikme ile çağır (auth state'inin stabilize olması için)
    const timer = setTimeout(() => {
      if (isAuthenticated && user) {
        fetchSessions();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user]);

  // Session sonlandır
  const handleTerminateSession = async (sessionId: number) => {
    if (!confirm('Bu oturumu sonlandırmak istediğinize emin misiniz?')) {
      return;
    }

    try {
      const data = await adminAPI.terminateSession(sessionId);
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Oturum sonlandırıldı',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        // Session listesini yenile
        const sessionsData = await adminAPI.getSessions();
        if (sessionsData.success) {
          setSessions((sessionsData as any).sessions || []);
        }
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Oturum sonlandırılamadı',
        color: 'red',
      });
    }
  };

  // Diğer tüm oturumları sonlandır
  const handleTerminateOtherSessions = async () => {
    if (!confirm('Diğer tüm oturumları sonlandırmak istediğinize emin misiniz?')) {
      return;
    }

    try {
      const data = await adminAPI.terminateOtherSessions();
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${(data as any).count || 0} oturum sonlandırıldı`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        // Session listesini yenile
        const sessionsData = await adminAPI.getSessions();
        if (sessionsData.success) {
          setSessions((sessionsData as any).sessions || []);
        }
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Oturumlar sonlandırılamadı',
        color: 'red',
      });
    }
  };

  // Device icon belirle
  const getDeviceIcon = (deviceInfo: any) => {
    const device = deviceInfo?.device || 'Desktop';
    return device === 'Mobile' ? IconDeviceMobile : IconDeviceDesktop;
  };

  // Device bilgisi formatla
  const formatDeviceInfo = (deviceInfo: any) => {
    if (!deviceInfo) return 'Bilinmiyor';
    const parts = [];
    if (deviceInfo.os) parts.push(deviceInfo.os);
    if (deviceInfo.browser) parts.push(deviceInfo.browser);
    if (deviceInfo.device) parts.push(deviceInfo.device);
    return parts.join(' • ') || 'Bilinmiyor';
  };

  // Giriş yapmamışsa login sayfasına yönlendir
  // Loading state veya user yoksa loader göster
  if (authLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  // Eğer authenticated değilse ve user da yoksa, redirect zaten useEffect'te yapılıyor
  // Burada sadece loader göster (redirect olana kadar)
  if (!isAuthenticated && !user) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  // Profil güncelleme
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsUpdating(true);

    try {
      const data = await adminAPI.updateProfile({ name, email });

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Profil bilgileriniz güncellendi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        refreshUser();
      } else {
        setError(data.error || 'Güncelleme başarısız');
      }
    } catch (_err) {
      setError('Sunucu hatası');
    } finally {
      setIsUpdating(false);
    }
  };

  // Şifre değiştirme
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni şifreler eşleşmiyor');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Şifre en az 6 karakter olmalı');
      return;
    }

    setIsChangingPassword(true);

    try {
      const data = await adminAPI.changePassword({
        currentPassword,
        newPassword,
      });

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Şifreniz değiştirildi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.error || 'Şifre değiştirme başarısız');
      }
    } catch (_err) {
      setPasswordError('Sunucu hatası');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group>
          <ThemeIcon
            size={50}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
          >
            <IconUser size={28} />
          </ThemeIcon>
          <div>
            <Title order={2}>Profilim</Title>
            <Text c="dimmed" size="sm">
              Hesap bilgilerinizi yönetin
            </Text>
          </div>
        </Group>

        <Grid>
          {/* Sol Kolon - Profil Kartı */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card shadow="sm" radius="lg" withBorder p="xl">
              <Stack align="center" gap="md">
                <Avatar
                  size={100}
                  radius={100}
                  color="blue"
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                >
                  {user?.name ? getInitials(user.name) : 'U'}
                </Avatar>

                <div style={{ textAlign: 'center' }}>
                  <Text size="xl" fw={700}>
                    {user?.name}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {user?.email}
                  </Text>
                </div>

                <Badge
                  size="lg"
                  variant="gradient"
                  gradient={{
                    from:
                      user?.user_type === 'admin' || user?.user_type === 'super_admin'
                        ? 'red'
                        : 'blue',
                    to:
                      user?.user_type === 'admin' || user?.user_type === 'super_admin'
                        ? 'pink'
                        : 'cyan',
                  }}
                  leftSection={<IconShieldCheck size={14} />}
                >
                  {user?.user_type === 'admin' || user?.user_type === 'super_admin'
                    ? 'Yönetici'
                    : 'Kullanıcı'}
                </Badge>

                <Divider w="100%" my="xs" />

                <Stack gap="xs" w="100%">
                  <Group gap="xs">
                    <IconCalendar size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    <Text size="sm" c="dimmed">
                      Hesap Oluşturulma
                    </Text>
                  </Group>
                  <Text size="sm" fw={500}>
                    -
                  </Text>
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Sağ Kolon - Formlar */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="lg">
              {/* Profil Bilgileri */}
              <Paper shadow="sm" radius="lg" p="xl" withBorder>
                <Group mb="lg">
                  <ThemeIcon size={36} radius="md" variant="light" color="blue">
                    <IconUser size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>Profil Bilgileri</Title>
                    <Text size="sm" c="dimmed">
                      Ad ve email adresinizi güncelleyin
                    </Text>
                  </div>
                </Group>

                {error && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                    {error}
                  </Alert>
                )}

                <form onSubmit={handleUpdateProfile}>
                  <Stack gap="md">
                    <TextInput
                      label="Ad Soyad"
                      placeholder="Adınız Soyadınız"
                      leftSection={<IconUser size={16} />}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />

                    <TextInput
                      label="Email"
                      placeholder="ornek@sirket.com"
                      leftSection={<IconMail size={16} />}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      type="email"
                    />

                    <Group justify="flex-end" mt="xs">
                      <Button
                        type="submit"
                        loading={isUpdating}
                        leftSection={<IconCheck size={16} />}
                      >
                        Kaydet
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Paper>

              {/* Şifre Değiştirme */}
              <Paper shadow="sm" radius="lg" p="xl" withBorder>
                <Group mb="lg">
                  <ThemeIcon size={36} radius="md" variant="light" color="orange">
                    <IconKey size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>Şifre Değiştir</Title>
                    <Text size="sm" c="dimmed">
                      Hesap güvenliğiniz için şifrenizi güncelleyin
                    </Text>
                  </div>
                </Group>

                {passwordError && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                    {passwordError}
                  </Alert>
                )}

                <form onSubmit={handleChangePassword}>
                  <Stack gap="md">
                    <PasswordInput
                      label="Mevcut Şifre"
                      placeholder="••••••••"
                      leftSection={<IconLock size={16} />}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />

                    <PasswordInput
                      label="Yeni Şifre"
                      placeholder="••••••••"
                      leftSection={<IconLock size={16} />}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      description="En az 6 karakter"
                    />

                    <PasswordInput
                      label="Yeni Şifre (Tekrar)"
                      placeholder="••••••••"
                      leftSection={<IconLock size={16} />}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      error={
                        newPassword && confirmPassword && newPassword !== confirmPassword
                          ? 'Şifreler eşleşmiyor'
                          : ''
                      }
                    />

                    <Group justify="flex-end" mt="xs">
                      <Button
                        type="submit"
                        loading={isChangingPassword}
                        color="orange"
                        leftSection={<IconKey size={16} />}
                        disabled={!currentPassword || !newPassword || !confirmPassword}
                      >
                        Şifreyi Değiştir
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Paper>

              {/* Aktif Oturumlar */}
              <Paper shadow="sm" radius="lg" p="xl" withBorder>
                <Group mb="lg" justify="space-between">
                  <Group>
                    <ThemeIcon size={36} radius="md" variant="light" color="violet">
                      <IconDeviceDesktop size={20} />
                    </ThemeIcon>
                    <div>
                      <Title order={4}>Aktif Oturumlar</Title>
                      <Text size="sm" c="dimmed">
                        Tüm cihazlardaki oturumlarınızı yönetin
                      </Text>
                    </div>
                  </Group>
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
                  <Center py="xl">
                    <Loader size="sm" />
                  </Center>
                ) : sessions.length === 0 ? (
                  <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                    Aktif oturum bulunmuyor
                  </Alert>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Cihaz</Table.Th>
                        <Table.Th>IP Adresi</Table.Th>
                        <Table.Th>Son Aktivite</Table.Th>
                        <Table.Th>Oluşturulma</Table.Th>
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
                                <DeviceIcon size={18} />
                                <div>
                                  <Text size="sm" fw={500}>
                                    {formatDeviceInfo(session.deviceInfo)}
                                  </Text>
                                  {session.userAgent && (
                                    <Text size="xs" c="dimmed" lineClamp={1}>
                                      {session.userAgent.substring(0, 50)}...
                                    </Text>
                                  )}
                                </div>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{session.ipAddress || 'Bilinmiyor'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {session.lastActivity
                                  ? new Date(session.lastActivity).toLocaleString('tr-TR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '-'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {new Date(session.createdAt).toLocaleDateString('tr-TR')}
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
                                  <Tooltip label="Oturumu Sonlandır">
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      onClick={() => handleTerminateSession(session.id)}
                                    >
                                      <IconTrash size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                                {!session.isActive && (
                                  <Badge size="sm" color="gray" variant="light">
                                    Sonlandırılmış
                                  </Badge>
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
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
