'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Container,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
  Select,
  Badge,
  Loader,
  Center,
} from '@mantine/core';
import { IconCalendar, IconList, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import MenuPlanCalendarView from '@/components/MenuPlanCalendarView';
import { api } from '@/lib/api';

interface Proje {
  id: number;
  ad: string;
}

interface MenuPlan {
  id: number;
  ad: string;
  proje_id: number;
  varsayilan_kisi_sayisi: number;
  baslangic_tarihi: string;
  bitis_tarihi: string;
}

interface MenuPlanOgun {
  id: number;
  tarih: string;
  ogun_tipi_id: number;
  ogun_tip_adi: string;
  ogun_ikon: string;
  kisi_sayisi: number;
  toplam_maliyet?: number;
  yemekler?: Array<{
    id: number;
    recete_adi: string;
  }>;
}

interface OgunTipi {
  id: number;
  kod: string;
  ad: string;
  ikon: string;
}

export default function MenuPlanlamaTakvimPage() {
  const queryClient = useQueryClient();
  const [selectedProjeId, setSelectedProjeId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Projeleri getir
  const { data: projeler, isLoading: projelerLoading } = useQuery({
    queryKey: ['projeler'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Proje[] }>('/api/projeler');
      return response.data.data;
    },
  });

  // Seçili projenin menü planlarını getir
  const { data: menuPlanlari, isLoading: planlariLoading } = useQuery({
    queryKey: ['menu-planlari', selectedProjeId],
    queryFn: async () => {
      if (!selectedProjeId) return [];
      const response = await api.get<{ success: boolean; data: MenuPlan[] }>(
        `/api/menu-planlama/projeler/${selectedProjeId}/menu-planlari`
      );
      return response.data.data;
    },
    enabled: !!selectedProjeId,
  });

  // Seçili planın öğünlerini getir
  const { data: ogunler, isLoading: ogunlerLoading } = useQuery({
    queryKey: ['plan-ogunleri', selectedPlanId],
    queryFn: async () => {
      if (!selectedPlanId) return [];
      const response = await api.get<{ success: boolean; data: MenuPlanOgun[] }>(
        `/api/menu-planlama/menu-planlari/${selectedPlanId}`
      );
      return response.data.data.ogunler || [];
    },
    enabled: !!selectedPlanId,
  });

  // Öğün tiplerini getir
  const { data: ogunTipleri } = useQuery({
    queryKey: ['ogun-tipleri'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: OgunTipi[] }>(
        '/api/menu-planlama/ogun-tipleri'
      );
      return response.data.data;
    },
  });

  const selectedPlan = menuPlanlari?.find((p) => p.id === Number(selectedPlanId));

  const handleOgunEkle = async (data: { tarih: Date; ogun_tipi_id: number; kisi_sayisi: number }) => {
    if (!selectedPlanId) return;

    try {
      const response = await api.post(`/api/menu-planlama/menu-planlari/${selectedPlanId}/ogunler`, {
        tarih: data.tarih.toISOString().split('T')[0],
        ogun_tipi_id: data.ogun_tipi_id,
        kisi_sayisi: data.kisi_sayisi,
      });

      if (response.data.success) {
        await queryClient.invalidateQueries({ queryKey: ['plan-ogunleri', selectedPlanId] });
        notifications.show({
          title: 'Başarılı',
          message: 'Öğün eklendi',
          color: 'green',
        });
      }
    } catch (error: any) {
      if (error.response?.data?.conflict) {
        throw error; // MenuPlanCalendarView'da handle edilecek
      }
      throw new Error(error.response?.data?.error || 'Öğün eklenirken hata oluştu');
    }
  };

  const handleOgunClick = (ogun: MenuPlanOgun) => {
    notifications.show({
      title: `${ogun.ogun_ikon} ${ogun.ogun_tip_adi}`,
      message: `${ogun.kisi_sayisi} kişi - ${ogun.yemekler?.length || 0} yemek`,
      color: 'blue',
    });
    // TODO: Modal ile detay göster
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>📅 Menü Planlama - Takvim Görünümü</Title>
            <Text c="dimmed" size="sm">
              Takvimde tarih seçerek hızlıca öğün ekleyebilirsiniz
            </Text>
          </div>
          <Group>
            <SegmentedControl
              value={viewMode}
              onChange={(value) => setViewMode(value as 'calendar' | 'list')}
              data={[
                { label: '📅 Takvim', value: 'calendar' },
                { label: '📝 Liste', value: 'list' },
              ]}
            />
          </Group>
        </Group>

        {/* Filtreler */}
        <Paper p="md" withBorder>
          <Group>
            <Select
              placeholder="Proje seçin"
              data={
                projeler?.map((p) => ({
                  value: String(p.id),
                  label: p.ad,
                })) || []
              }
              value={selectedProjeId}
              onChange={(value) => {
                setSelectedProjeId(value);
                setSelectedPlanId(null);
              }}
              style={{ flex: 1 }}
              searchable
              disabled={projelerLoading}
            />

            <Select
              placeholder="Menü planı seçin"
              data={
                menuPlanlari?.map((p) => ({
                  value: String(p.id),
                  label: p.ad,
                })) || []
              }
              value={selectedPlanId}
              onChange={setSelectedPlanId}
              style={{ flex: 1 }}
              disabled={!selectedProjeId || planlariLoading}
            />

            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['plan-ogunleri', selectedPlanId] });
              }}
              disabled={!selectedPlanId}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>

          {selectedPlan && (
            <Group mt="md" gap="xs">
              <Badge variant="light" color="blue">
                {new Date(selectedPlan.baslangic_tarihi).toLocaleDateString('tr-TR')} -{' '}
                {new Date(selectedPlan.bitis_tarihi).toLocaleDateString('tr-TR')}
              </Badge>
              <Badge variant="light" color="green">
                👥 {selectedPlan.varsayilan_kisi_sayisi} kişi
              </Badge>
              <Badge variant="light" color="orange">
                🍽️ {ogunler?.length || 0} öğün
              </Badge>
            </Group>
          )}
        </Paper>

        {/* İçerik */}
        {!selectedPlanId ? (
          <Paper p="xl" withBorder>
            <Center>
              <Stack align="center" gap="md">
                <IconCalendar size={48} stroke={1.5} opacity={0.5} />
                <Text c="dimmed" size="lg">
                  Proje ve menü planı seçerek başlayın
                </Text>
              </Stack>
            </Center>
          </Paper>
        ) : ogunlerLoading ? (
          <Paper p="xl" withBorder>
            <Center>
              <Loader />
            </Center>
          </Paper>
        ) : viewMode === 'calendar' ? (
          <MenuPlanCalendarView
            menuPlanId={Number(selectedPlanId)}
            ogunler={ogunler || []}
            ogunTipleri={ogunTipleri || []}
            varsayilanKisiSayisi={selectedPlan?.varsayilan_kisi_sayisi || 1000}
            onOgunEkle={handleOgunEkle}
            onOgunClick={handleOgunClick}
          />
        ) : (
          <Paper p="md" withBorder>
            <Text c="dimmed" ta="center">
              Liste görünümü yakında eklenecek
            </Text>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
