'use client';

import { Box, Center, Loader } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClientLayout } from '@/components/ClientLayout';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { LoginStep } from '@/components/auth/steps/LoginStep';

const NO_NAVBAR_PAGES = ['/giris', '/kayit', '/sifremi-unuttum', '/sifre-sifirla'];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthPage = NO_NAVBAR_PAGES.some((page) => pathname?.startsWith(page));

  // Auth sayfası değilse ve yükleniyor - loading göster
  if (!isAuthPage && isLoading) {
    return (
      <>
        <Notifications position="top-right" />
        <Center h="100vh" bg="#050507">
          <Loader color="indigo" size="lg" />
        </Center>
      </>
    );
  }

  // Auth sayfası değilse ve giriş yapılmamış - login ekranı göster
  // isLoading bittiyse ve authenticated değilse login göster
  if (!isAuthPage && !isLoading && !isAuthenticated) {
    return (
      <>
        <Notifications position="top-right" />
        <Box className="auth-page-container">
          <Box className="auth-page-blob auth-page-blob-1" />
          <Box className="auth-page-blob auth-page-blob-2" />
          <Box className="auth-page-blob auth-page-blob-3" />
          <Box className="auth-page-card">
            <Box className="auth-modal-gradient-bg" />
            <Box py={48} px={40} style={{ position: 'relative', zIndex: 1 }}>
              <LoginStep onSuccess={() => window.location.reload()} />
            </Box>
          </Box>
        </Box>
      </>
    );
  }

  // Navbar sadece auth sayfalarında gizli, diğer her yerde görünür
  const showNavbar = mounted && !isAuthPage;

  return (
    <>
      <Notifications position="top-right" />
      <Box
        className={isAuthPage ? '' : 'glassy-page-bg'}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {showNavbar && <Navbar />}
        <Box
          component="main"
          className={`main-content ${showNavbar ? 'has-navbar' : 'no-navbar'}`}
          style={{ flex: 1, minHeight: 0, overflow: 'visible' }}
        >
          <ClientLayout>{children}</ClientLayout>
        </Box>
      </Box>
    </>
  );
}
