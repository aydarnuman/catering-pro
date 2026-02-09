'use client';

import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBuilding, IconEdit } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import ProjeYonetimModal from '@/components/muhasebe/ProjeYonetimModal';
import { authFetch } from '@/lib/api';
import type { Proje } from './types';

interface ProjelerSectionProps {
  API_BASE_URL: string;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '₺0';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
};

export default function ProjelerSection({ API_BASE_URL }: ProjelerSectionProps) {
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [loadingProjeler, setLoadingProjeler] = useState(true);
  const [projeModalOpened, { open: openProjeModal, close: closeProjeModal }] = useDisclosure(false);
  const [selectedProjeId, setSelectedProjeId] = useState<number | undefined>(undefined);

  const fetchProjeler = useCallback(async () => {
    try {
      setLoadingProjeler(true);
      const res = await authFetch(`${API_BASE_URL}/api/projeler`);
      if (res.ok) {
        const data = await res.json();
        setProjeler(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Projeler yüklenemedi:', err);
    } finally {
      setLoadingProjeler(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchProjeler();
  }, [fetchProjeler]);

  const handleCloseProjeModal = () => {
    closeProjeModal();
    setSelectedProjeId(undefined);
    fetchProjeler();
  };

  const handleOpenProjeDetay = (projeId: number) => {
    setSelectedProjeId(projeId);
    openProjeModal();
  };

  return (
    <div>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={4}>📋 Projeler</Title>
          <Text size="sm" c="dimmed">
            Merkezi proje yönetimi - tüm modüller buradan veri çeker
          </Text>
        </div>
        <Button
          leftSection={<IconEdit size={16} />}
          onClick={openProjeModal}
          color="orange"
          variant="light"
          size="sm"
        >
          Proje Yönetimi
        </Button>
      </Group>

      {loadingProjeler ? (
        <Skeleton height={100} radius="md" />
      ) : projeler.length === 0 ? (
        <Paper p="lg" radius="md" withBorder ta="center">
          <Text c="dimmed" mb="sm">
            Henüz proje eklenmemiş
          </Text>
          <Button
            onClick={openProjeModal}
            variant="light"
            color="orange"
            size="sm"
            leftSection={<IconEdit size={14} />}
          >
            Proje Yönetimine Git
          </Button>
        </Paper>
      ) : (
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Paper p="sm" radius="md" withBorder>
              <Text size="xs" c="dimmed">Toplam Proje</Text>
              <Text size="lg" fw={700}>{projeler.length}</Text>
            </Paper>
            <Paper p="sm" radius="md" withBorder>
              <Text size="xs" c="dimmed">Aktif</Text>
              <Text size="lg" fw={700} c="green">
                {projeler.filter((p) => p.durum === 'aktif').length}
              </Text>
            </Paper>
            <Paper p="sm" radius="md" withBorder>
              <Text size="xs" c="dimmed">Personel</Text>
              <Text size="lg" fw={700} c="blue">
                {projeler.reduce((sum, p) => sum + (Number(p.personel_sayisi) || 0), 0)}
              </Text>
            </Paper>
            <Paper p="sm" radius="md" withBorder>
              <Text size="xs" c="dimmed">Bütçe</Text>
              <Text size="lg" fw={700} c="orange">
                {formatCurrency(projeler.reduce((sum, p) => sum + (Number(p.butce) || 0), 0))}
              </Text>
            </Paper>
          </SimpleGrid>

          {projeler.slice(0, 8).map((proje) => (
            <Paper
              key={proje.id}
              p="sm"
              radius="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => handleOpenProjeDetay(proje.id)}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                  <ThemeIcon size="sm" radius="md" variant="light" color="orange">
                    <IconBuilding size={14} />
                  </ThemeIcon>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={500} size="sm" truncate>
                      {proje.ad}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {proje.kurum || proje.musteri || proje.adres || '-'}
                    </Text>
                  </div>
                </Group>
                <Group gap="xs">
                  <Badge size="sm" variant="light" color="blue">
                    {Number(proje.personel_sayisi) || 0} kişi
                  </Badge>
                  <Badge size="sm" color={proje.durum === 'aktif' ? 'green' : 'gray'}>
                    {proje.durum === 'aktif' ? 'Aktif' : proje.durum || '-'}
                  </Badge>
                </Group>
              </Group>
            </Paper>
          ))}

          {projeler.length > 8 && (
            <Button onClick={openProjeModal} variant="subtle" color="gray" size="sm" fullWidth>
              +{projeler.length - 8} proje daha... (Proje Yönetimi)
            </Button>
          )}
        </Stack>
      )}

      <ProjeYonetimModal
        opened={projeModalOpened}
        onClose={handleCloseProjeModal}
        initialProjeId={selectedProjeId}
      />
    </div>
  );
}
