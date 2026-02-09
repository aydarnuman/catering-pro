'use client';

import {
  Badge,
  Box,
  Center,
  Group,
  Paper,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPackages, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { type UrunKarti, urunlerAPI } from '@/lib/api/services/urunler';

interface UrunlerTabProps {
  isActive: boolean;
}

export function UrunlerTab({ isActive }: UrunlerTabProps) {
  // Local state
  const [urunArama, setUrunArama] = useState('');
  const [debouncedUrunArama] = useDebouncedValue(urunArama, 300);

  // React Query: Ürünler
  const {
    data: urunler = [],
    isLoading: urunlerLoading,
    error: urunlerError,
  } = useQuery<UrunKarti[]>({
    queryKey: ['urunler', debouncedUrunArama],
    queryFn: async (): Promise<UrunKarti[]> => {
      const res = await urunlerAPI.getUrunler({
        limit: 1000,
        arama: debouncedUrunArama || undefined,
      });
      if (!res.success) {
        throw new Error('Ürünler yüklenemedi');
      }
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isActive,
    retry: 2,
  });

  // Error handling for ürünler
  useEffect(() => {
    if (urunlerError) {
      notifications.show({
        title: 'Hata',
        message: 'Ürünler yüklenemedi',
        color: 'red',
      });
    }
  }, [urunlerError]);

  // Filtrelenmiş ürünler (memoized)
  const filteredUrunler = useMemo(() => {
    if (!debouncedUrunArama) return urunler;
    const arama = debouncedUrunArama.toLowerCase().trim();
    return urunler.filter(
      (u) => u.ad?.toLowerCase().includes(arama) || u.kod?.toLowerCase().includes(arama)
    );
  }, [urunler, debouncedUrunArama]);

  return (
    <Paper p="md" withBorder radius="lg">
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <Text fw={600} size="lg">
            📦 Ürün Kartları
          </Text>
          <Badge variant="light" color="indigo">
            {filteredUrunler.length} / {urunler.length} ürün
          </Badge>
        </Group>
      </Group>

      <TextInput
        placeholder="Ürün ara (kod, ad)..."
        leftSection={<IconSearch size={16} />}
        value={urunArama}
        onChange={(e) => setUrunArama(e.target.value)}
        mb="md"
      />

      {urunlerLoading ? (
        <Stack gap="xs">
          <Skeleton height={60} radius="md" />
          <Skeleton height={60} radius="md" />
          <Skeleton height={60} radius="md" />
          <Skeleton height={60} radius="md" />
          <Skeleton height={60} radius="md" />
        </Stack>
      ) : (
        <ScrollArea.Autosize mah={500}>
          <Stack gap="xs">
            {filteredUrunler.map((urun) => (
              <Paper
                key={urun.id}
                p="sm"
                withBorder
                radius="md"
                style={{ cursor: 'pointer' }}
              >
                <Group justify="space-between">
                  <Group gap="sm" style={{ flex: 1 }}>
                    <Badge size="sm" variant="light" color="gray">
                      {urun.kod}
                    </Badge>
                    <Box style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>
                        {urun.ad}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {urun.kategori || 'Kategorisiz'}
                      </Text>
                    </Box>
                  </Group>
                  <Stack gap={2} align="flex-end">
                    <Group gap="xs">
                      <Text size="sm" fw={600}>
                        {Number(urun.toplam_stok || 0).toFixed(1)}{' '}
                        {urun.birim_kisa || urun.birim || 'Ad'}
                      </Text>
                      <Badge
                        size="xs"
                        color={
                          urun.durum === 'kritik'
                            ? 'red'
                            : urun.durum === 'dusuk'
                              ? 'orange'
                              : 'green'
                        }
                      >
                        {urun.durum || 'normal'}
                      </Badge>
                    </Group>
                    {urun.son_alis_fiyati && (
                      <Text size="xs" c="blue" fw={500}>
                        ₺{Number(urun.son_alis_fiyati).toFixed(2)}/
                        {urun.birim_kisa || 'kg'}
                      </Text>
                    )}
                  </Stack>
                </Group>
              </Paper>
            ))}
            {filteredUrunler.length === 0 && (
              <Center py="xl">
                <Stack align="center" gap="sm">
                  <IconPackages size={40} color="var(--mantine-color-gray-5)" />
                  <Text size="sm" c="dimmed">
                    {urunler.length === 0
                      ? 'Henüz ürün kartı yok'
                      : 'Arama sonucu bulunamadı'}
                  </Text>
                </Stack>
              </Center>
            )}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Paper>
  );
}
