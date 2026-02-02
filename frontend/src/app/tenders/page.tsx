'use client';

/**
 * /tenders sayfası artık /ihale-merkezi'ne yönlendiriliyor.
 * Tüm ihale listesi işlevselliği ihale-merkezi'nde birleştirildi.
 */

import { Box, Center, Loader, Text } from '@mantine/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // URL parametrelerini koru
    const params = new URLSearchParams();
    params.set('tab', 'all');
    
    // Mevcut search parametresini aktar
    const search = searchParams.get('search');
    if (search) params.set('search', search);
    
    router.replace(`/ihale-merkezi?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <Center h="100vh">
      <Box ta="center">
        <Loader size="lg" color="violet" />
        <Text c="dimmed" mt="md">
          İhale Merkezi'ne yönlendiriliyorsunuz...
        </Text>
      </Box>
    </Center>
  );
}

export default function TendersPage() {
  return (
    <Suspense
      fallback={
        <Center h="100vh">
          <Box ta="center">
            <Loader size="lg" color="violet" />
            <Text c="dimmed" mt="md">
              Yükleniyor...
            </Text>
          </Box>
        </Center>
      }
    >
      <RedirectContent />
    </Suspense>
  );
}
