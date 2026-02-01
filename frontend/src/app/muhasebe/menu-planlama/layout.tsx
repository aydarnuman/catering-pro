'use client';

import { Box, Container } from '@mantine/core';
import { MenuPlanlamaProvider } from './components/MenuPlanlamaContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface MenuPlanlamaLayoutProps {
  children: React.ReactNode;
}

export default function MenuPlanlamaLayout({ children }: MenuPlanlamaLayoutProps) {
  return (
    <ErrorBoundary
      fallbackTitle="Menü Planlama Hatası"
      fallbackMessage="Menü planlama sisteminde bir sorun oluştu. Lütfen tekrar deneyin."
    >
      <MenuPlanlamaProvider>
        <Box
          style={{
            minHeight: '100vh',
            background:
              'linear-gradient(180deg, rgba(20, 184, 166, 0.03) 0%, rgba(59, 130, 246, 0.03) 100%)',
          }}
        >
          <Container size="xl" py="xl">
            <ErrorBoundary
              fallbackTitle="İçerik Yükleme Hatası"
              fallbackMessage="Bu sayfa yüklenirken bir hata oluştu."
            >
              {children}
            </ErrorBoundary>
          </Container>
        </Box>
      </MenuPlanlamaProvider>
    </ErrorBoundary>
  );
}