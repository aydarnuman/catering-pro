'use client';

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  PasswordInput,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar,
  IconCheck,
  IconInfoCircle,
  IconKey,
  IconLock,
  IconLogout,
  IconMail,
  IconShieldLock,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import type { UserInfo } from './types';

interface ProfilSectionProps {
  user: UserInfo | null;
  loading: boolean;
}

export default function ProfilSection({ user, loading }: ProfilSectionProps) {
  const { logout } = useAuth();

  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const [passwordModalOpened, { open: openPasswordModal, close: closePasswordModal }] =
    useDisclosure(false);
  const [logoutModalOpened, { open: openLogoutModal, close: closeLogoutModal }] =
    useDisclosure(false);

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || '', email: user.email || '' });
    }
  }, [user]);

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
                <Button
                  onClick={handleProfileSave}
                  loading={saving}
                  leftSection={<IconCheck size={16} />}
                >
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
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={openLogoutModal}
                >
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
