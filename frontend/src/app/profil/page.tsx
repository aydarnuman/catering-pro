'use client';

import { Center, Loader, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * /profil -> /ayarlar?section=profil redirect
 * Profil düzenleme artık ayarlar sayfası altında birleştirildi.
 */
export default function ProfilPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ayarlar?section=profil');
  }, [router]);

  return (
    <Center h="60vh">
      <Stack align="center" gap="md">
        <Loader size="md" />
        <Text c="dimmed" size="sm">
          Yönlendiriliyor...
        </Text>
      </Stack>
    </Center>
  );
}
