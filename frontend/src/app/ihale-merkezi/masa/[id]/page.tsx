'use client';

import { Box, Button, Center, Group, Loader, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconFileAnalytics } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SanalIhaleMasasiContent } from '@/components/ihale-merkezi/SanalIhaleMasasi';
import { useTrackedTenderDetail } from '@/hooks/useIhaleMerkeziData';

export default function IhaleMasasiPage() {
  const params = useParams();
  const router = useRouter();
  const tenderId = params?.id ? Number(params.id) : null;

  const { data: tender, isLoading, error } = useTrackedTenderDetail(tenderId);

  // Loading state
  if (isLoading) {
    return (
      <Center h="100vh" bg="#0a0a14">
        <Stack align="center" gap="md">
          <Loader size="lg" color="violet" />
          <Text c="dimmed" size="sm">
            Ihale masasi yukleniyor...
          </Text>
        </Stack>
      </Center>
    );
  }

  // Error / not found state
  if (error || !tender) {
    return (
      <Center h="100vh" bg="#0a0a14">
        <Paper
          p="xl"
          radius="lg"
          bg="dark.8"
          withBorder
          style={{ borderColor: 'rgba(255,255,255,0.1)', maxWidth: 440 }}
        >
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="red">
              <IconAlertTriangle size={32} />
            </ThemeIcon>
            <Title order={3} c="white" ta="center">
              Ihale Bulunamadi
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              Bu ihale takip listenizde bulunamadi veya henuz takip listesine eklenmemis.
            </Text>
            <Group gap="sm">
              <Button
                variant="light"
                color="gray"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => router.back()}
              >
                Geri Don
              </Button>
              <Button
                component={Link}
                href="/ihale-merkezi?tab=tracked"
                variant="gradient"
                gradient={{ from: 'violet', to: 'indigo', deg: 135 }}
              >
                Takip Listesine Git
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Center>
    );
  }

  // analysis_summary guard — tender exists but no analysis yet
  if (!tender.analysis_summary) {
    return (
      <Center h="100vh" bg="#0a0a14">
        <Paper
          p="xl"
          radius="lg"
          bg="dark.8"
          withBorder
          style={{ borderColor: 'rgba(255,255,255,0.1)', maxWidth: 480 }}
        >
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="yellow">
              <IconFileAnalytics size={32} />
            </ThemeIcon>
            <Title order={3} c="white" ta="center">
              Dokuman Analizi Gerekli
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              Bu ihale icin henuz dokuman analizi yapilmamis. Ihale masasini kullanabilmek icin once dokumanlarin analiz
              edilmesi gerekiyor.
            </Text>
            <Text c="dimmed" ta="center" size="xs">
              {tender.ihale_basligi}
            </Text>
            <Group gap="sm">
              <Button
                variant="light"
                color="gray"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => router.back()}
              >
                Geri Don
              </Button>
              <Button
                component={Link}
                href={`/ihale-merkezi?tab=tracked&tender=${tender.tender_id}`}
                variant="gradient"
                gradient={{ from: 'violet', to: 'indigo', deg: 135 }}
                leftSection={<IconFileAnalytics size={16} />}
              >
                Dokumanlari Analiz Et
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Center>
    );
  }

  // Main content — standalone page version of Sanal Ihale Masasi
  return (
    <Box style={{ height: '100vh', overflow: 'hidden' }}>
      <SanalIhaleMasasiContent tender={tender} onClose={() => router.back()} enabled />
    </Box>
  );
}
