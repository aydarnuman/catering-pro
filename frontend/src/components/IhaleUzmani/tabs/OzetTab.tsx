'use client';

import {
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalculator,
  IconCheck,
  IconDownload,
  IconEye,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { NotesSection } from '@/components/NotesSection';
import { type SavedTender, statusConfig, type TenderStatus } from '../types';

interface OzetTabProps {
  tender: SavedTender;
  analysisLoading: boolean;
  yaklasikMaliyet: number;
  sinirDeger: number | null;
  bizimTeklif: number;
  onUpdateStatus: (id: string, status: TenderStatus) => void;
  onDelete: (id: string) => void;
  onNavigateToHesaplamalar: () => void;
  onDownloadJSON: () => void;
}

export function OzetTab({
  tender,
  analysisLoading,
  yaklasikMaliyet,
  sinirDeger,
  bizimTeklif,
  onUpdateStatus,
  onDelete,
  onNavigateToHesaplamalar,
  onDownloadJSON,
}: OzetTabProps) {
  return (
    <Stack gap="md">
      {/* Üst Bar */}
      <Group justify="space-between">
        <Group gap="sm">
          <Select
            value={tender.status}
            onChange={(value) => value && onUpdateStatus(tender.id, value as TenderStatus)}
            data={Object.entries(statusConfig).map(([key, val]) => ({
              value: key,
              label: `${val.icon} ${val.label}`,
            }))}
            w={160}
            size="sm"
          />
          {analysisLoading && <Loader size="xs" />}
        </Group>
        <Group gap="xs">
          <Button
            variant="outline"
            size="xs"
            leftSection={<IconEye size={14} />}
            component={Link}
            href={`/tenders/${tender.tender_id}`}
            target="_blank"
          >
            Detay
          </Button>
          <Button
            variant="outline"
            size="xs"
            leftSection={<IconDownload size={14} />}
            onClick={onDownloadJSON}
          >
            JSON
          </Button>
          <Button
            variant="outline"
            color="red"
            size="xs"
            leftSection={<IconTrash size={14} />}
            onClick={() => onDelete(tender.id)}
          >
            Sil
          </Button>
        </Group>
      </Group>

      {/* Özet Kartları */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm">
        <Tooltip
          label={tender.ihale_basligi}
          multiline
          w={300}
          withArrow
          disabled={!tender.ihale_basligi}
        >
          <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
            <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
              İhale Başlığı
            </Text>
            <Text size="sm" fw={500} lineClamp={2}>
              {tender.ihale_basligi || (
                <Text span c="gray.5">
                  Belirtilmemiş
                </Text>
              )}
            </Text>
          </Paper>
        </Tooltip>

        <Tooltip label={tender.kurum} multiline w={300} withArrow disabled={!tender.kurum}>
          <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
            <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
              Kurum
            </Text>
            <Text size="sm" fw={500} lineClamp={2}>
              {tender.kurum || (
                <Text span c="gray.5">
                  Belirtilmemiş
                </Text>
              )}
            </Text>
          </Paper>
        </Tooltip>

        <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
          <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
            Tarih
          </Text>
          <Text size="sm" fw={600}>
            {tender.tarih || (
              <Text span c="gray.5">
                Belirtilmemiş
              </Text>
            )}
          </Text>
        </Paper>

        <Paper
          p="sm"
          withBorder
          radius="md"
          shadow="xs"
          style={{ borderColor: tender.bedel ? 'var(--mantine-color-green-5)' : undefined }}
          className="hover-card"
        >
          <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
            Tahmini Bedel
          </Text>
          <Text size="sm" fw={700} c={tender.bedel ? 'green' : 'gray.5'}>
            {tender.bedel || 'Belirtilmemiş'}
          </Text>
        </Paper>

        <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
          <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
            Şehir
          </Text>
          <Text size="sm" fw={500}>
            {tender.city || (
              <Text span c="gray.5">
                Belirtilmemiş
              </Text>
            )}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Hesaplama Özeti */}
      {yaklasikMaliyet > 0 || sinirDeger || bizimTeklif > 0 ? (
        <Paper
          p="md"
          withBorder
          radius="md"
          shadow="sm"
          style={{
            background:
              sinirDeger && bizimTeklif > 0
                ? bizimTeklif < sinirDeger
                  ? 'linear-gradient(135deg, rgba(255,244,230,0.5) 0%, rgba(255,255,255,1) 100%)'
                  : 'linear-gradient(135deg, rgba(235,251,238,0.5) 0%, rgba(255,255,255,1) 100%)'
                : 'var(--mantine-color-gray-0)',
            cursor: 'pointer',
          }}
          onClick={onNavigateToHesaplamalar}
        >
          <Group justify="space-between">
            <Group gap="md">
              <ThemeIcon
                size="lg"
                variant="gradient"
                gradient={{ from: 'violet', to: 'indigo' }}
                radius="xl"
              >
                <IconCalculator size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="sm">
                  Teklif Hesaplamaları
                </Text>
                <Group gap="lg" mt={4}>
                  {yaklasikMaliyet > 0 && (
                    <Text size="xs" c="dimmed">
                      Maliyet: <strong>{yaklasikMaliyet.toLocaleString('tr-TR')} TL</strong>
                    </Text>
                  )}
                  {sinirDeger && (
                    <Text size="xs" c="dimmed">
                      Sınır: <strong>{sinirDeger.toLocaleString('tr-TR')} TL</strong>
                    </Text>
                  )}
                  {bizimTeklif > 0 && (
                    <Text size="xs" c="dimmed">
                      Teklif: <strong>{bizimTeklif.toLocaleString('tr-TR')} TL</strong>
                    </Text>
                  )}
                </Group>
              </div>
            </Group>
            <Group gap="sm">
              {sinirDeger && bizimTeklif > 0 && (
                <Badge
                  size="md"
                  variant="filled"
                  color={bizimTeklif < sinirDeger ? 'orange' : 'green'}
                  leftSection={
                    bizimTeklif < sinirDeger ? (
                      <IconAlertTriangle size={12} />
                    ) : (
                      <IconCheck size={12} />
                    )
                  }
                >
                  {bizimTeklif < sinirDeger
                    ? `%${Math.round((bizimTeklif / sinirDeger) * 100)} - Risk`
                    : 'Uygun'}
                </Badge>
              )}
              <Badge variant="light" color="violet" rightSection={<IconEye size={12} />}>
                Detay
              </Badge>
            </Group>
          </Group>
        </Paper>
      ) : (
        <Paper
          p="md"
          withBorder
          radius="md"
          bg="gray.0"
          style={{ cursor: 'pointer' }}
          onClick={onNavigateToHesaplamalar}
        >
          <Group justify="space-between">
            <Group gap="md">
              <ThemeIcon size="lg" variant="light" color="violet" radius="xl">
                <IconCalculator size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="sm">
                  Teklif Hesaplamaları
                </Text>
                <Text size="xs" c="dimmed">
                  Sınır değer, aşırı düşük ve itiraz bedeli hesapla
                </Text>
              </div>
            </Group>
            <Badge variant="light" color="violet" rightSection={<IconEye size={12} />}>
              Hesapla
            </Badge>
          </Group>
        </Paper>
      )}

      {/* Notlar */}
      <NotesSection trackingId={Number(tender.id)} tenderId={tender.tender_id} />
    </Stack>
  );
}
