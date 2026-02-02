'use client';

import { Center, Container, Loader, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * İhale Uzmanı sayfası artık /ihale-merkezi sayfasına entegre edildi.
 * Bu sayfa otomatik olarak İhale Merkezi'ne yönlendirir.
 */
export default function IhaleUzmaniPage() {
  const router = useRouter();

  useEffect(() => {
    // /ihale-merkezi sayfasına yönlendir
    router.replace('/ihale-merkezi?tab=tracked');
  }, [router]);

  return (
    <Container size="sm" py="xl" mt={100}>
      <Center h={300}>
        <Stack align="center" gap="md">
          <Loader size="lg" color="violet" />
          <Text c="dimmed">İhale Merkezi'ne yönlendiriliyorsunuz...</Text>
        </Stack>
      </Center>
    </Container>
  );
}
