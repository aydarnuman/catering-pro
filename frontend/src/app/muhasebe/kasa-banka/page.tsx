'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader, Stack, Text } from '@mantine/core';

/**
 * Kasa-Banka sayfası artık Finans Merkezi'ne entegre edildi.
 * Bu sayfa otomatik olarak /muhasebe/finans?tab=hesaplar adresine yönlendirir.
 */
export default function KasaBankaRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Finans sayfasının hesaplar tabına yönlendir
    router.replace('/muhasebe/finans?tab=hesaplar');
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
