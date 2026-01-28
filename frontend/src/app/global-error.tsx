'use client';

import '@mantine/core/styles.css';
import {
  Button,
  ColorSchemeScript,
  Container,
  MantineProvider,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconHome, IconRefresh } from '@tabler/icons-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="tr">
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>
        <MantineProvider
          theme={{
            primaryColor: 'blue',
            defaultRadius: 'md',
            colors: {
              blue: [
                '#e7f5ff',
                '#d0ebff',
                '#a5d8ff',
                '#74c0fc',
                '#4dabf7',
                '#339af0',
                '#228be6',
                '#1c7ed6',
                '#1971c2',
                '#1864ab',
              ],
            },
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            headings: {
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: '700',
            },
          }}
        >
          <Container
            size="sm"
            py="xl"
            style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}
          >
            <Stack align="center" gap="lg" style={{ width: '100%' }}>
              <IconAlertCircle size={64} color="red" />
              <Title order={1} ta="center">
                Kritik Hata
              </Title>
              <Text c="dimmed" ta="center" size="lg">
                {error.message || 'Uygulamada beklenmeyen bir hata oluştu.'}
              </Text>
              {error.digest && (
                <Text size="xs" c="dimmed" ta="center">
                  Hata ID: {error.digest}
                </Text>
              )}
              {process.env.NODE_ENV === 'development' && error.stack && (
                <Text
                  component="div"
                  size="xs"
                  c="dimmed"
                  ta="left"
                  style={{ maxWidth: '100%', overflow: 'auto' }}
                >
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {error.stack}
                  </pre>
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
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  variant="light"
                  size="md"
                >
                  Ana Sayfaya Dön
                </Button>
              </Stack>
            </Stack>
          </Container>
        </MantineProvider>
      </body>
    </html>
  );
}
