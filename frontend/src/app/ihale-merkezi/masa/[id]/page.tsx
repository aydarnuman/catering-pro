'use client';

import { Box, Button, Center, Group, Loader, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconFileAnalytics } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { SanalIhaleMasasiContent } from '@/components/ihale-merkezi/SanalIhaleMasasi';
import type { AnalysisData, SavedTender } from '@/components/ihale-merkezi/types';
import { useMasaVeriPaketi } from '@/hooks/useMasaVeriPaketi';

export default function IhaleMasasiPage() {
  const params = useParams();
  const router = useRouter();
  const tenderId = params?.id ? Number(params.id) : null;

  // Tek veri kaynağı: sağ panelden gönderilen veri paketi
  const { data: masaPaketi, isLoading, error } = useMasaVeriPaketi(tenderId);

  // Paketten SavedTender-uyumlu obje oluştur (SanalIhaleMasasiContent bunu bekliyor)
  const tenderFromPaket: SavedTender | null = useMemo(() => {
    if (!masaPaketi) return null;
    return {
      id: String(masaPaketi.id),
      tender_id: masaPaketi.tender_id,
      ihale_basligi: masaPaketi.tender_title || '',
      kurum: masaPaketi.kurum || '',
      tarih: masaPaketi.tarih || '',
      bedel: masaPaketi.bedel || '',
      sure: masaPaketi.sure || undefined,
      status: 'inceleniyor' as const,
      notes: '',
      created_at: masaPaketi.created_at,
      dokuman_sayisi: 0,
      teknik_sart_sayisi: 0,
      birim_fiyat_sayisi: 0,
      analysis_summary: masaPaketi.analysis_cards as unknown as AnalysisData,
    };
  }, [masaPaketi]);

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

  // Error / not found — paket yok demek masaya gönderilmemiş
  if (error || !masaPaketi || !tenderFromPaket) {
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
              Veri Paketi Bulunamadi
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              Bu ihale icin henuz veri paketi olusturulmamis. Ihale merkezinde sag panelden &quot;Masaya Gonder&quot;
              butonuyla veri paketini gondermeniz gerekiyor.
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
                Ihale Merkezine Git
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Center>
    );
  }

  // analysis_cards guard — paket var ama analiz boş
  const hasAnalysis = masaPaketi.analysis_cards && Object.keys(masaPaketi.analysis_cards).length > 0;

  if (!hasAnalysis) {
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
              Veri paketi olusturulmus ancak analiz verisi bos. Once ihale merkezinde dokumanlarin analiz edilmesi
              gerekiyor.
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
                href={`/ihale-merkezi?tab=tracked&tender=${tenderId}`}
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

  // Main content — masaya gelen paket verisiyle beslenen ihale masası
  return (
    <Box style={{ height: '100vh', overflow: 'hidden' }}>
      <SanalIhaleMasasiContent tender={tenderFromPaket} onClose={() => router.back()} enabled masaPaketi={masaPaketi} />
    </Box>
  );
}
