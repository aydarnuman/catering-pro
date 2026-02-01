'use client';

import React from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconBook2,
  IconRefresh,
  IconSearch,
  IconSparkles,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useCallback } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { menuPlanlamaAPI, type Recete } from '@/lib/api/services/menu-planlama';
import { API_BASE_URL } from '@/lib/config';
import { notifications } from '@mantine/notifications';

// Optimized ReceteCard component
const ReceteCard = React.memo(({
  recete,
  aiMalzemeLoading,
  onReceteClick,
  onAiMalzemeOner,
}: {
  recete: Recete;
  aiMalzemeLoading: number | null;
  onReceteClick: (id: number) => void;
  onAiMalzemeOner: (id: number, e: React.MouseEvent) => void;
}) => {
  const malzemeSayisi = recete.malzeme_sayisi || 0;
  
  return (
    <Paper
      p="sm"
      withBorder
      radius="md"
      style={{ cursor: 'pointer', transition: 'all 0.15s' }}
      onClick={() => onReceteClick(recete.id)}
    >
      <Group justify="space-between">
        <Group gap="sm" style={{ flex: 1 }}>
          <Text size="xl">
            {recete.kategori_ikon || '🍽️'}
          </Text>
          <Box style={{ flex: 1 }}>
            <Group gap="xs">
              <Text size="sm" fw={500}>
                {recete.ad}
              </Text>
              {malzemeSayisi > 0 ? (
                <Badge size="xs" variant="dot" color="gray">
                  {malzemeSayisi} malzeme
                </Badge>
              ) : (
                <Badge
                  size="xs"
                  variant="light"
                  color="orange"
                  leftSection={<IconAlertTriangle size={10} />}
                >
                  Malzeme yok
                </Badge>
              )}
            </Group>
            {recete.kategori_adi && (
              <Text size="xs" c="dimmed">
                {recete.kategori_adi}
              </Text>
            )}
          </Box>
        </Group>
        
        <Stack gap="xs" align="flex-end">
          {recete.tahmini_maliyet && (
            <Text size="sm" fw={600} c="teal">
              ₺{Number(recete.tahmini_maliyet).toFixed(2)}
            </Text>
          )}
          
          {malzemeSayisi === 0 && (
            <ActionIcon
              variant="light"
              color="blue"
              size="sm"
              loading={aiMalzemeLoading === recete.id}
              onClick={(e) => onAiMalzemeOner(recete.id, e)}
              title="AI ile malzeme öner"
            >
              <IconSparkles size={14} />
            </ActionIcon>
          )}
        </Stack>
      </Group>
    </Paper>
  );
});

interface ReceteDetay {
  id: number;
  kod: string;
  ad: string;
  kategori: string;
  kalori?: number;
  hazirlik_suresi?: number;
  pisirme_suresi?: number;
  tahmini_maliyet: number;
  malzemeler: Array<{
    id: number;
    malzeme_adi: string;
    miktar: number;
    birim: string;
    aktif_fiyat?: number;
    toplam_fiyat?: number;
  }>;
}

export default function RecetelerPage() {
  const { isMobile, isMounted } = useResponsive();
  
  // State
  const [receteArama, setReceteArama] = useState('');
  const [showOnlyEmpty, setShowOnlyEmpty] = useState(false);
  const [detayModalOpened, setDetayModalOpened] = useState(false);
  const [receteDetayId, setReceteDetayId] = useState<number | null>(null);
  const [aiMalzemeLoading, setAiMalzemeLoading] = useState<number | null>(null);

  const [debouncedReceteArama] = useDebouncedValue(receteArama, 300);

  // React Query: Reçeteler
  const {
    data: receteler = [],
    isLoading: recetelerLoading,
    error: recetelerError,
  } = useQuery<Recete[]>({
    queryKey: ['receteler', debouncedReceteArama],
    queryFn: async (): Promise<Recete[]> => {
      const res = await menuPlanlamaAPI.getReceteler({
        limit: 1000,
        arama: debouncedReceteArama || undefined,
      });
      if (!res.success) {
        throw new Error('Reçeteler yüklenemedi');
      }
      return res.data;
    },
    enabled: true,
  });

  // React Query: Reçete detayı
  const {
    data: receteDetay,
    isLoading: receteDetayLoading,
    error: receteDetayError,
  } = useQuery<ReceteDetay>({
    queryKey: ['recete-detay', receteDetayId],
    queryFn: async (): Promise<ReceteDetay> => {
      if (!receteDetayId) throw new Error('Reçete ID gerekli');
      
      const result = await menuPlanlamaAPI.getMaliyetAnalizi(receteDetayId);
      if (!result.success || !result.data) {
        throw new Error('Reçete detayı yüklenemedi');
      }

      const backendData = result.data as any;

      return {
        id: backendData.recete.id,
        kod: backendData.recete.kod || '',
        ad: backendData.recete.ad,
        kategori: backendData.recete.kategori_adi || 'Diğer',
        kalori: backendData.recete.kalori,
        hazirlik_suresi: backendData.recete.hazirlik_suresi,
        pisirme_suresi: backendData.recete.pisirme_suresi,
        tahmini_maliyet: Number(backendData.recete.tahmini_maliyet || 0),
        malzemeler: (backendData.malzemeler || []).map((m: any) => ({
          id: m.id,
          malzeme_adi: m.malzeme_adi || m.stok_adi,
          miktar: m.miktar,
          birim: m.birim || m.stok_birim || 'gr',
          aktif_fiyat: m.aktif_fiyat || 0,
          toplam_fiyat: m.toplam_fiyat || 0,
        })),
      };
    },
    enabled: !!receteDetayId,
  });

  // Malzemesiz reçete sayısı
  const malzemesizSayisi = useMemo(() => {
    return receteler.filter((r) => !r.malzeme_sayisi || r.malzeme_sayisi === 0).length;
  }, [receteler]);

  // Filtrelenmiş reçeteler
  const filteredReceteler = useMemo(() => {
    let result = receteler;

    // Malzemesiz filtresi
    if (showOnlyEmpty) {
      result = result.filter((r) => !r.malzeme_sayisi || r.malzeme_sayisi === 0);
    }

    // Arama filtresi
    if (debouncedReceteArama) {
      const arama = debouncedReceteArama.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.ad?.toLowerCase().includes(arama) ||
          r.kod?.toLowerCase().includes(arama) ||
          r.kategori_adi?.toLowerCase().includes(arama)
      );
    }

    return result;
  }, [receteler, debouncedReceteArama, showOnlyEmpty]);

  // Reçete detay modal aç
  const fetchReceteDetay = useCallback((receteId: number) => {
    setReceteDetayId(receteId);
    setDetayModalOpened(true);
  }, []);

  // AI ile malzeme önerisi
  const handleAiMalzemeOner = useCallback(
    async (receteId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setAiMalzemeLoading(receteId);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/menu-planlama/receteler/${receteId}/ai-malzeme-oneri`,
          { method: 'POST' }
        );
        const data = await response.json();
        if (data.success) {
          notifications.show({
            title: 'Malzeme Önerildi',
            message: `${data.eklenen_malzeme || 0} malzeme eklendi`,
            color: 'green',
          });
        } else {
          throw new Error(data.error || 'AI malzeme önerisi başarısız');
        }
      } catch (error: any) {
        notifications.show({
          title: 'Hata',
          message: error.message || 'AI malzeme önerisi sırasında hata oluştu',
          color: 'red',
        });
      } finally {
        setAiMalzemeLoading(null);
      }
    },
    []
  );

  if (!isMounted) {
    return null;
  }

  return (
    <>
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <Group gap="md">
          <IconBook2 size={32} color="var(--mantine-color-blue-6)" />
          <Box>
            <Title order={3}>Reçete Yönetimi</Title>
            <Text c="dimmed" size="sm">
              Reçeteleri düzenle, malzeme ekle, maliyet analizi yap
            </Text>
          </Box>
        </Group>
        
        {malzemesizSayisi > 0 && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="orange"
            variant="light"
            style={{ maxWidth: 300 }}
          >
            <Text size="sm">
              {malzemesizSayisi} reçetede malzeme eksik
            </Text>
          </Alert>
        )}
      </Group>

      {/* Arama ve Filtreler */}
      <Paper p="md" withBorder radius="md" mb="md">
        <Group justify="space-between" wrap="wrap" gap="md">
          <TextInput
            placeholder="Reçete ara..."
            leftSection={<IconSearch size={16} />}
            value={receteArama}
            onChange={(event) => setReceteArama(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          
          <SegmentedControl
            value={showOnlyEmpty ? 'bos' : 'hepsi'}
            onChange={(value) => setShowOnlyEmpty(value === 'bos')}
            data={[
              { label: 'Hepsi', value: 'hepsi' },
              { 
                label: 'Malzemesiz', 
                value: 'bos',
                disabled: malzemesizSayisi === 0 
              },
            ]}
            size="sm"
          />
        </Group>
      </Paper>

      {/* Reçete Listesi */}
      {recetelerLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} height={120} radius="md" />
          ))}
        </SimpleGrid>
      ) : filteredReceteler.length === 0 ? (
        <Paper p="xl" withBorder radius="md">
          <Text ta="center" c="dimmed">
            {debouncedReceteArama
              ? 'Arama kriterlerine uygun reçete bulunamadı'
              : showOnlyEmpty
                ? 'Malzemesiz reçete bulunmuyor'
                : 'Henüz reçete eklenmemiş'}
          </Text>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {filteredReceteler.map((recete) => (
            <ReceteCard
              key={recete.id}
              recete={recete}
              aiMalzemeLoading={aiMalzemeLoading}
              onReceteClick={fetchReceteDetay}
              onAiMalzemeOner={handleAiMalzemeOner}
            />
          ))}
        </SimpleGrid>
      )}

      {/* Reçete Detay Modal */}
      <Modal
        opened={detayModalOpened}
        onClose={() => setDetayModalOpened(false)}
        title={receteDetay ? `📋 ${receteDetay.ad}` : 'Reçete Detayı'}
        size="lg"
        styles={{
          title: { fontSize: '1.2rem', fontWeight: 600 },
        }}
      >
        {receteDetayLoading ? (
          <Stack gap="md">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} height={60} radius="md" />
            ))}
          </Stack>
        ) : receteDetay ? (
          <Stack gap="md">
            {/* Reçete Bilgileri */}
            <Group justify="space-between" wrap="wrap">
              <Group gap="md">
                {receteDetay.hazirlik_suresi && (
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Hazırlık:</Text>
                    <Text size="sm" fw={500}>{receteDetay.hazirlik_suresi} dk</Text>
                  </Group>
                )}
                {receteDetay.pisirme_suresi && (
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Pişirme:</Text>
                    <Text size="sm" fw={500}>{receteDetay.pisirme_suresi} dk</Text>
                  </Group>
                )}
                {receteDetay.kalori && (
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Kalori:</Text>
                    <Text size="sm" fw={500}>{receteDetay.kalori} kcal</Text>
                  </Group>
                )}
              </Group>
              
              <Group gap="xs">
                <Text size="sm" c="dimmed">Toplam Maliyet:</Text>
                <Text size="lg" fw={700} c="teal">
                  ₺{receteDetay.tahmini_maliyet.toFixed(2)}
                </Text>
              </Group>
            </Group>

            {/* Malzemeler */}
            <Box>
              <Group justify="space-between" mb="sm">
                <Text fw={600} size="md">
                  🧄 Malzemeler ({receteDetay.malzemeler.length})
                </Text>
                {receteDetay.malzemeler.length === 0 && (
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="sm"
                    loading={aiMalzemeLoading === receteDetay.id}
                    onClick={(e) => handleAiMalzemeOner(receteDetay.id, e)}
                    title="AI ile malzeme öner"
                  >
                    <IconSparkles size={14} />
                  </ActionIcon>
                )}
              </Group>

              {receteDetay.malzemeler.length === 0 ? (
                <Paper p="md" withBorder radius="md" style={{ background: 'var(--mantine-color-orange-light)' }}>
                  <Text size="sm" c="orange">
                    Bu reçetede henüz malzeme bulunmuyor. AI önerisini dene!
                  </Text>
                </Paper>
              ) : (
                <Stack gap="sm">
                  {receteDetay.malzemeler.map((malzeme) => (
                    <Paper key={malzeme.id} p="sm" withBorder radius="sm">
                      <Group justify="space-between">
                        <Group gap="sm">
                          <Text size="sm" fw={500}>
                            {malzeme.malzeme_adi}
                          </Text>
                          <Badge size="xs" variant="light" color="gray">
                            {malzeme.miktar} {malzeme.birim}
                          </Badge>
                        </Group>
                        
                        <Group gap="sm">
                          {malzeme.aktif_fiyat && (
                            <Text size="xs" c="dimmed">
                              ₺{malzeme.aktif_fiyat.toFixed(2)}/{malzeme.birim}
                            </Text>
                          )}
                          {malzeme.toplam_fiyat && (
                            <Text size="sm" fw={600} c="teal">
                              ₺{malzeme.toplam_fiyat.toFixed(2)}
                            </Text>
                          )}
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            Reçete bilgisi bulunamadı
          </Text>
        )}
      </Modal>
    </>
  );
}