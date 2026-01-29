'use client';

import { Box } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClientLayout } from '@/components/ClientLayout';
import { Navbar } from '@/components/Navbar';

const NO_NAVBAR_PAGES = ['/giris', '/kayit', '/sifremi-unuttum', '/sifre-sifirla'];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthPage = NO_NAVBAR_PAGES.some((page) => pathname?.startsWith(page));

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
