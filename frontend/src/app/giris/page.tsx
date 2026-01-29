'use client';

import { Box, Loader, Stack, Text } from '@mantine/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { LoginStep } from '@/components/auth/steps/LoginStep';
import { useAuth } from '@/context/AuthContext';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const redirectTo = searchParams.get('redirect') || '/';
  const hasRedirected = useRef(false);

  // Zaten giriş yapmışsa yönlendir
  useEffect(() => {
    if (hasRedirected.current) return;
    if (authLoading) return;

    if (isAuthenticated) {
      hasRedirected.current = true;
      const target = redirectTo.startsWith('/') ? redirectTo : '/';
      router.replace(target);
    }
  }, [authLoading, isAuthenticated, router, redirectTo]);

  const handleSuccess = () => {
    hasRedirected.current = true;
    const target = redirectTo.startsWith('/') ? redirectTo : '/';
    window.location.href = target;
  };

  // Loading state
  if (authLoading) {
    return (
      <Box className="auth-page-container">
        <Stack align="center" gap="md">
          <Loader size="lg" color="white" type="dots" />
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Oturum kontrol ediliyor...</Text>
        </Stack>
      </Box>
    );
  }

  // Authenticated - redirect bekle
  if (isAuthenticated && !hasRedirected.current) {
    return (
      <Box className="auth-page-container">
        <Stack align="center" gap="md">
          <Loader size="lg" color="green" type="dots" />
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Yönlendiriliyor...</Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box className="auth-page-container">
      {/* Animated background blobs */}
      <Box className="auth-page-blob auth-page-blob-1" />
      <Box className="auth-page-blob auth-page-blob-2" />
      <Box className="auth-page-blob auth-page-blob-3" />

      {/* Login Card */}
      <Box className="auth-page-card">
        {/* Gradient overlay */}
        <Box className="auth-modal-gradient-bg" />

        {/* Content */}
        <Box pos="relative" p="xl" style={{ zIndex: 1 }}>
          <LoginStep onSuccess={handleSuccess} />
        </Box>
      </Box>

      {/* Version info */}
      <Text
        size="xs"
        ta="center"
        mt="lg"
        style={{ color: 'rgba(255,255,255,0.4)', position: 'relative', zIndex: 1 }}
      >
        Catering Pro v2.0
      </Text>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Box className="auth-page-container">
          <Stack align="center" gap="md">
            <Loader size="lg" color="white" type="dots" />
            <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Yükleniyor...</Text>
          </Stack>
        </Box>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
