'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Center, Loader, Text, Stack } from '@mantine/core';

/**
 * İhale Uzmanı sayfası artık /tracking sayfasına entegre edildi.
 * Bu sayfa otomatik olarak /tracking'e yönlendirir.
 */
export default function IhaleUzmaniPage() {
  const router = useRouter();

  useEffect(() => {
    // /tracking sayfasına yönlendir
    router.replace('/tracking');
  }, [router]);

  return (
    <Container size="sm" py="xl" mt={100}>
      <Center h={300}>
        <Stack align="center" gap="md">
          <Loader size="lg" color="violet" />
          <Text c="dimmed">İhale Takibim sayfasına yönlendiriliyorsunuz...</Text>
        </Stack>
      </Center>
    </Container>
  );
}
