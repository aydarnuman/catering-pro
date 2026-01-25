'use client';

import { Box } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { usePathname } from 'next/navigation';
import { ClientLayout } from '@/components/ClientLayout';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';

const NO_NAVBAR_PAGES = [
  '/giris',
  '/kayit',
  '/sifremi-unuttum',
  '/sifre-sifirla',
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  const isAuthPage = NO_NAVBAR_PAGES.some((page) =>
    pathname?.startsWith(page)
  );
  const showNavbar =
    !isAuthPage && isAuthenticated && !isLoading;

  return (
    <>
      <Notifications position="top-right" />
      <Box
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {showNavbar && <Navbar />}
        <Box component="main" className="main-content" style={{ flex: 1 }}>
          <ClientLayout>{children}</ClientLayout>
        </Box>
      </Box>
    </>
  );
}
