'use client';

import { Center, Loader, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Cariler sayfası artık Finans Merkezi'ne entegre edildi.
 * Bu sayfa otomatik olarak /muhasebe/finans?tab=cariler adresine yönlendirir.
 */
export default function CarilerRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Finans sayfasının cariler tabına yönlendir
    router.replace('/muhasebe/finans?tab=cariler');
  }, [router]);

  return (
    <Center h="80vh">
      <Stack align="center" gap="md">
        <Loader size="lg" type="bars" />
        <Text c="dimmed">Finans Merkezi'ne yönlendiriliyor...</Text>
      </Stack>
    </Center>
  );
}
