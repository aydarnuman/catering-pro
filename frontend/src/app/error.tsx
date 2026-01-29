'use client';

import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconHome, IconRefresh } from '@tabler/icons-react';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Chunk load error - auto reload page
    if (error.message?.includes('Loading chunk') || error.message?.includes('ChunkLoadError')) {
      window.location.reload();
      return;
    }
    // Log error to console for debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="lg" mt="xl">
        <IconAlertCircle size={64} color="red" />
        <Title order={1} ta="center">
          Bir Hata Oluştu
        </Title>
        <Text c="dimmed" ta="center" size="lg">
          {error.message || 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'}
        </Text>
        {error.digest && (
          <Text size="xs" c="dimmed" ta="center">
            Hata ID: {error.digest}
          </Text>
        )}
        <Stack gap="sm" mt="md">
          <Button
            leftSection={<IconRefresh size={18} />}
            onClick={reset}
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
            size="lg"
          >
            Tekrar Dene
          </Button>
          <Button
            leftSection={<IconHome size={18} />}
            component="a"
            href="/"
            variant="light"
            size="md"
          >
            Ana Sayfaya Dön
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
