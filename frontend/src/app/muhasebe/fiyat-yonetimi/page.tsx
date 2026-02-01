'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader, Text, Stack } from '@mantine/core';
/**
 * Fiyat Yönetimi sayfası artık Menü Planlama altında tab olarak bulunuyor.
 * Bu sayfa kullanıcıları otomatik olarak doğru sayfaya yönlendirir.
 */

export default function FiyatYonetimiRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Kullanıcıyı Menü Planlama sayfasındaki Fiyat Yönetimi tab'ına yönlendir
    router.replace('/muhasebe/menu-planlama?tab=fiyat-yonetimi');
  }, [router]);

  return (
    <Center style={{ minHeight: '60vh' }}>
      <Stack align="center" gap="md">
        <Loader size="lg" />
        <Text size="sm" c="dimmed">
          Fiyat Yönetimi sayfasına yönlendiriliyor...
        </Text>
        <Text size="xs" c="dimmed">
          Fiyat Yönetimi artık Menü Planlama içinde bulunur
        </Text>
      </Stack>
    </Center>
  );
}
