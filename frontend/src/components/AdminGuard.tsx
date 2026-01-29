'use client';

import { Center, Container, Loader, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconShieldOff } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useAuthModal } from '@/components/auth';
import { useAuth } from '@/context/AuthContext';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const { openModal } = useAuthModal();

  // Giriş yapmamış kullanıcılar için modal aç
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      openModal('login');
    }
  }, [isLoading, isAuthenticated, openModal]);

  // Loading state
  if (isLoading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Yetki kontrol ediliyor...</Text>
        </Stack>
      </Center>
    );
  }

  // Not authenticated - show modal
  if (!isAuthenticated) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Giriş yapmanız gerekmektedir...</Text>
        </Stack>
      </Center>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" radius="lg" withBorder ta="center">
          <Stack align="center" gap="md">
            <ThemeIcon size={80} radius="xl" color="red" variant="light">
              <IconShieldOff size={40} />
            </ThemeIcon>
            <Text size="xl" fw={700}>
              Erişim Reddedildi
            </Text>
            <Text c="dimmed">
              Bu sayfaya erişim yetkiniz bulunmamaktadır.
              <br />
              Admin yetkisi gereklidir.
            </Text>
            <Text size="sm" c="dimmed">
              Giriş yapan kullanıcı: {user?.name} ({user?.email})
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Authorized
  return <>{children}</>;
}
