'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// FloatingAIChat'i lazy load et - bundle size'ı küçültür
const FloatingAIChat = dynamic(() => import('./FloatingAIChat').then((mod) => ({ default: mod.FloatingAIChat })), {
  ssr: false,
  loading: () => null, // Yüklenirken hiçbir şey gösterme
});

// Altta sabit AI input toolbar (Artlist tarzı)
const GenerationToolbar = dynamic(
  () => import('./artlist/GenerationToolbar').then((mod) => ({ default: mod.GenerationToolbar })),
  { ssr: false, loading: () => null }
);

interface ClientLayoutProps {
  children: React.ReactNode;
}

// FloatingAIChat ve GenerationToolbar'ın gösterilmeyeceği sayfalar
const EXCLUDED_PATHS = ['/giris', '/kayit', '/sifremi-unuttum', '/auth'];

export function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  // Toolbar açılır kapanır; varsayılan kapalı, AI açıldığında da kapalı kalsın
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  useEffect(() => {
    const handler = () => setToolbarExpanded(false);
    window.addEventListener('open-ai-chat', handler);
    return () => window.removeEventListener('open-ai-chat', handler);
  }, []);

  // Notes modal artık NotesContext üzerinden global olarak yönetiliyor
  // Toolbar widget doğrudan useNotesModal().openNotes() kullanıyor

  const shouldShowChat = !isLoading && isAuthenticated && !EXCLUDED_PATHS.some((path) => pathname?.startsWith(path));

  return (
    <>
      {children}
      {shouldShowChat && (
        <>
          <Suspense fallback={null}>
            <FloatingAIChat />
          </Suspense>
          <Suspense fallback={null}>
            <GenerationToolbar
              variant="catering"
              expanded={toolbarExpanded}
              onToggle={() => setToolbarExpanded((v) => !v)}
            />
          </Suspense>
        </>
      )}
    </>
  );
}
