'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthModalProvider } from '@/components/auth';
import { AuthProvider } from '@/context/AuthContext';
import { RealtimeProvider } from '@/context/RealtimeContext';
import { ErrorBoundary } from './ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 saniye (daha kısa - realtime ile birlikte)
            refetchOnWindowFocus: true, // Pencereye dönünce yenile
            refetchOnReconnect: true, // İnternet gelince yenile
            retry: 1,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthModalProvider>
            <RealtimeProvider>{children}</RealtimeProvider>
          </AuthModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
