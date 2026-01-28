'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';

// FloatingAIChat'i lazy load et - bundle size'ı küçültür
const FloatingAIChat = dynamic(() => import('./FloatingAIChat').then(mod => ({ default: mod.FloatingAIChat })), {
  ssr: false,
  loading: () => null, // Yüklenirken hiçbir şey gösterme
});

interface ClientLayoutProps {
  children: React.ReactNode;
}

// FloatingAIChat'in gösterilmeyeceği sayfalar
const EXCLUDED_PATHS = ['/giris', '/kayit', '/sifremi-unuttum', '/auth'];

export function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  // Auth yükleniyor, excluded path veya authenticate olmamışsa FloatingAIChat'i gösterme
  const shouldShowChat =
    !isLoading && isAuthenticated && !EXCLUDED_PATHS.some((path) => pathname?.startsWith(path));

  return (
    <>
      {children}
      {shouldShowChat && (
        <Suspense fallback={null}>
          <FloatingAIChat />
        </Suspense>
      )}
    </>
  );
}
