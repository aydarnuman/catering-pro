'use client';

import { Center, Loader, Stack, Text } from '@mantine/core';
import { useEffect } from 'react';
import { useAuthModal } from '@/components/auth';
import { useAuth } from '@/context/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Genel auth guard - giriş yapmamış kullanıcılar için auth modal açar
 * Admin gerektirmeyen protected sayfalar için kullanılır
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
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
          <Text c="dimmed">Oturum kontrol ediliyor...</Text>
        </Stack>
      </Center>
    );
  }

  // Not authenticated - modal açık olacak
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

  // Authenticated
  return <>{children}</>;
}
