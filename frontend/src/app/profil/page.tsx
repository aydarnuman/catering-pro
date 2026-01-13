'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Group,
  Avatar,
  Divider,
  Alert,
  Grid,
  Badge,
  Card,
  ThemeIcon,
  Box,
  rem,
  Center,
  Loader
} from '@mantine/core';
import { 
  IconUser, 
  IconMail, 
  IconLock, 
  IconCheck, 
  IconAlertCircle,
  IconShieldCheck,
  IconCalendar,
  IconKey
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ProfilPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Kullanıcı bilgilerini yükle
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // Giriş yapmamışsa login sayfasına yönlendir
  if (authLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    router.push('/giris');
    return null;
  }

  // Profil güncelleme
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsUpdating(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, email })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Profil bilgileriniz güncellendi',
          color: 'green',
          icon: <IconCheck size={16} />
        });
        refreshUser();
      } else {
        setError(data.error || 'Güncelleme başarısız');
      }
    } catch (err) {
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
      const response = await fetch(`${API_URL}/api/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          currentPassword, 
          newPassword 
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Şifreniz değiştirildi',
          color: 'green',
          icon: <IconCheck size={16} />
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.error || 'Şifre değiştirme başarısız');
      }
    } catch (err) {
      setPasswordError('Sunucu hatası');
    } finally {
      setIsChangingPassword(false);
    }
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
    <Container size="md" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group>
          <ThemeIcon size={50} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            <IconUser size={28} />
          </ThemeIcon>
          <div>
            <Title order={2}>Profilim</Title>
            <Text c="dimmed" size="sm">Hesap bilgilerinizi yönetin</Text>
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
                  <Text size="xl" fw={700}>{user?.name}</Text>
                  <Text size="sm" c="dimmed">{user?.email}</Text>
                </div>

                <Badge 
                  size="lg" 
                  variant="gradient" 
                  gradient={{ from: user?.role === 'admin' ? 'red' : 'blue', to: user?.role === 'admin' ? 'pink' : 'cyan' }}
                  leftSection={<IconShieldCheck size={14} />}
                >
                  {user?.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                </Badge>

                <Divider w="100%" my="xs" />

                <Stack gap="xs" w="100%">
                  <Group gap="xs">
                    <IconCalendar size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    <Text size="sm" c="dimmed">Hesap Oluşturulma</Text>
                  </Group>
                  <Text size="sm" fw={500}>-</Text>
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
                    <Text size="sm" c="dimmed">Ad ve email adresinizi güncelleyin</Text>
                  </div>
                </Group>

                {error && (
                  <Alert 
                    icon={<IconAlertCircle size={16} />} 
                    color="red" 
                    variant="light"
                    mb="md"
                  >
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
                    <Text size="sm" c="dimmed">Hesap güvenliğiniz için şifrenizi güncelleyin</Text>
                  </div>
                </Group>

                {passwordError && (
                  <Alert 
                    icon={<IconAlertCircle size={16} />} 
                    color="red" 
                    variant="light"
                    mb="md"
                  >
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
                      error={newPassword && confirmPassword && newPassword !== confirmPassword ? 'Şifreler eşleşmiyor' : ''}
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
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}

