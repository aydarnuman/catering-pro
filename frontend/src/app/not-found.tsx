'use client';

import { Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconHome, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="lg" mt="xl">
        <Title order={1} size={120} c="dimmed" style={{ lineHeight: 1 }}>
          404
        </Title>
        <Title order={2} ta="center">
          Sayfa Bulunamadı
        </Title>
        <Text c="dimmed" ta="center" size="lg">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </Text>

        <Group mt="xl" wrap="wrap" justify="center">
          <Button
            leftSection={<IconHome size={18} />}
            component={Link}
            href="/"
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
            size="md"
          >
            Ana Sayfa
          </Button>
          <Button
            leftSection={<IconArrowLeft size={18} />}
            variant="light"
            onClick={() => router.back()}
            size="md"
          >
            Geri Dön
          </Button>
          <Button
            leftSection={<IconSearch size={18} />}
            variant="light"
            component={Link}
            href="/tenders"
            size="md"
          >
            İhaleler
          </Button>
        </Group>

        {/* Popüler Linkler */}
        <Stack gap="xs" mt="xl" w="100%">
          <Text fw={600} size="sm" c="dimmed" ta="center">
            Popüler Sayfalar:
          </Text>
          <Group gap="xs" justify="center" wrap="wrap">
            <Button variant="subtle" size="xs" component={Link} href="/muhasebe/faturalar">
              Faturalar
            </Button>
            <Button variant="subtle" size="xs" component={Link} href="/muhasebe/menu-planlama">
              Menu Planlama
            </Button>
            <Button variant="subtle" size="xs" component={Link} href="/tenders">
              İhaleler
            </Button>
            <Button variant="subtle" size="xs" component={Link} href="/muhasebe/stok">
              Stok
            </Button>
            <Button variant="subtle" size="xs" component={Link} href="/muhasebe/personel">
              Personel
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Container>
  );
}
