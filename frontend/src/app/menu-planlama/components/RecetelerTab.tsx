'use client';

import {
  Badge,
  Box,
  Button,
  Center,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconBook2, IconClipboardList, IconPlus, IconSearch, IconSparkles } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { menuPlanlamaAPI, type Recete } from '@/lib/api/services/menu-planlama';
import { menuPlanlamaKeys } from './queryKeys';
import type { KategoriInfo } from './types';

interface RecetelerTabProps {
  fetchReceteDetay: (receteId: number) => void;
  KATEGORILER: KategoriInfo[];
  isActive: boolean;
}

export function RecetelerTab({ fetchReceteDetay, KATEGORILER, isActive }: RecetelerTabProps) {
  const queryClient = useQueryClient();

  // Local state
  const [receteArama, setReceteArama] = useState('');
  const [debouncedReceteArama] = useDebouncedValue(receteArama, 300);
  const [seciliKategoriKod, setSeciliKategoriKod] = useState<string | null>(null);
  const [seciliSartnameId, setSeciliSartnameId] = useState<string | null>(null);

  // Hızlı reçete ekleme state'leri
  const [hizliReceteAdi, setHizliReceteAdi] = useState('');
  const [hizliReceteKategoriId, setHizliReceteKategoriId] = useState<string | null>(null);
  const [hizliReceteLoading, setHizliReceteLoading] = useState(false);

  // Reçete kategorilerini API'den çek
  type KategoriApiItem = { id: number; kod: string; ad: string; ikon: string; sira: number };
  const { data: receteKategorileriAPI = [] } = useQuery<KategoriApiItem[]>({
    queryKey: menuPlanlamaKeys.receteler.kategorilerApi(),
    queryFn: async (): Promise<KategoriApiItem[]> => {
      const res = await menuPlanlamaAPI.getKategoriler();
      if (!res.success || !Array.isArray(res.data)) return [];
      return res.data as unknown as KategoriApiItem[];
    },
    staleTime: 60000,
  });

  // Şartname listesi (önizleme için)
  type SartnameItem = { id: number; kod: string; ad: string };
  const { data: sartnameler = [] } = useQuery<SartnameItem[]>({
    queryKey: menuPlanlamaKeys.sartnameler.liste(),
    queryFn: async () => {
      const res = await menuPlanlamaAPI.getSartnameListesi();
      return res.success ? (res.data as SartnameItem[]) : [];
    },
    enabled: isActive,
    staleTime: 60 * 1000,
  });

  // Toplu gramaj uyum kontrolü (şartname seçiliyken özet)
  const { data: gramajKontrolToplu } = useQuery({
    queryKey: ['gramaj-kontrol-toplu', seciliSartnameId],
    queryFn: async () => {
      if (!seciliSartnameId) return null;
      const res = await menuPlanlamaAPI.getGramajKontrolToplu(Number(seciliSartnameId));
      return res.success ? res.data : null;
    },
    enabled: !!seciliSartnameId && isActive,
    staleTime: 60 * 1000,
  });

  // React Query: Reçeteler listesi (şartname seçiliyse önizleme gramaj/fiyat ile)
  const {
    data: receteler = [],
    isLoading: recetelerLoading,
    error: recetelerError,
  } = useQuery<Recete[]>({
    queryKey: menuPlanlamaKeys.receteler.liste(debouncedReceteArama, seciliSartnameId ? parseInt(seciliSartnameId, 10) : null),
    queryFn: async (): Promise<Recete[]> => {
      const res = await menuPlanlamaAPI.getReceteler({
        limit: 1000,
        arama: debouncedReceteArama || undefined,
        sartname_id: seciliSartnameId ? parseInt(seciliSartnameId, 10) : undefined,
      });
      if (!res.success) {
        throw new Error('Reçeteler yüklenemedi');
      }
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isActive,
    retry: 2,
  });

  // Error handling for receteler
  useEffect(() => {
    if (recetelerError) {
      notifications.show({
        title: 'Hata',
        message: 'Reçeteler yüklenemedi',
        color: 'red',
      });
    }
  }, [recetelerError]);

  // Filtrelenmiş reçeteler (memoized)
  const filteredReceteler = useMemo(() => {
    let sonuc = receteler;

    // Kategori filtresi
    if (seciliKategoriKod) {
      const seciliKat = receteKategorileriAPI.find((k) => k.kod === seciliKategoriKod);
      if (seciliKat) {
        sonuc = sonuc.filter((r) => r.kategori_adi === seciliKat.ad);
      }
    }

    // Arama filtresi
    if (debouncedReceteArama && debouncedReceteArama.trim() !== '') {
      const arama = debouncedReceteArama.toLowerCase().trim();
      sonuc = sonuc.filter(
        (r) =>
          r.ad?.toLowerCase().includes(arama) ||
          r.kategori_adi?.toLowerCase().includes(arama) ||
          r.kategori?.toLowerCase().includes(arama)
      );
    }

    return sonuc;
  }, [receteler, debouncedReceteArama, seciliKategoriKod, receteKategorileriAPI]);

  // Hızlı reçete ekleme fonksiyonu (AI ile malzeme önerisi dahil)
  const handleHizliReceteEkle = useCallback(async () => {
    if (!hizliReceteAdi.trim()) {
      notifications.show({
        title: 'Hata',
        message: 'Reçete adı giriniz',
        color: 'red',
      });
      return;
    }

    setHizliReceteLoading(true);
    try {
      // 1. Önce reçeteyi oluştur
      const createData = await menuPlanlamaAPI.createRecete({
        ad: hizliReceteAdi.trim(),
        kategori_id: hizliReceteKategoriId ? parseInt(hizliReceteKategoriId, 10) : undefined,
        porsiyon_miktar: 1,
        ai_olusturuldu: true,
      });

      if (!createData.success || !createData.data) {
        throw new Error('Reçete oluşturulamadı');
      }

      const yeniReceteId = createData.data.id;

      // 2. AI ile malzeme önerisi al
      notifications.show({
        id: 'ai-loading',
        title: 'AI Çalışıyor',
        message: 'Malzemeler öneriliyor...',
        loading: true,
        autoClose: false,
      });

      const aiData = await menuPlanlamaAPI.getAiMalzemeOneri(yeniReceteId, hizliReceteAdi.trim());

      notifications.hide('ai-loading');

      if (aiData.success && aiData.data?.malzemeler?.length > 0) {
        // 3. AI önerdiği malzemeleri ekle
        for (const malzeme of aiData.data.malzemeler) {
          await menuPlanlamaAPI.saveMalzeme(yeniReceteId, {
            urun_adi: malzeme.malzeme_adi,
            miktar: malzeme.miktar,
            birim: malzeme.birim || 'gr',
            urun_kart_id: malzeme.urun_kart_id || undefined,
          });
        }

        notifications.show({
          title: 'Başarılı',
          message: `"${hizliReceteAdi}" reçetesi ${aiData.data.malzemeler.length} malzeme ile oluşturuldu`,
          color: 'teal',
        });
      } else {
        notifications.show({
          title: 'Reçete Oluşturuldu',
          message: `"${hizliReceteAdi}" oluşturuldu. Malzemeleri manuel ekleyebilirsiniz.`,
          color: 'blue',
        });
      }

      // Formu temizle ve listeyi yenile
      setHizliReceteAdi('');
      setHizliReceteKategoriId(null);
      queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.receteler.all() });
      queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.receteler.kategoriler() });

      // Yeni reçetenin detayını aç
      fetchReceteDetay(yeniReceteId);
    } catch (error) {
      notifications.hide('ai-loading');
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Reçete oluşturulamadı',
        color: 'red',
      });
    } finally {
      setHizliReceteLoading(false);
    }
  }, [hizliReceteAdi, hizliReceteKategoriId, queryClient, fetchReceteDetay]);

  return (
    <Paper p="md" withBorder radius="lg">
      {/* Premium Header */}
      <Group justify="space-between" mb="lg">
        <Text fw={500} size="md" c="dimmed">
          Reçete Kataloğu
        </Text>
        <Text size="xs" c="dimmed">
          {filteredReceteler.length} / {receteler.length}
        </Text>
      </Group>

      {/* Hızlı Reçete Ekleme Satırı */}
      <Paper
        p="sm"
        mb="md"
        radius="md"
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-teal-9) 0%, var(--mantine-color-cyan-9) 100%)',
          border: '1px solid var(--mantine-color-teal-7)',
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <TextInput
            placeholder="Reçete adı yazın (örn: Mercimek Çorbası)"
            value={hizliReceteAdi}
            onChange={(e) => setHizliReceteAdi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !hizliReceteLoading) {
                handleHizliReceteEkle();
              }
            }}
            leftSection={<IconPlus size={16} />}
            size="sm"
            radius="md"
            style={{ flex: 1 }}
            styles={{
              input: {
                background: 'var(--mantine-color-dark-7)',
                border: 'none',
                '&::placeholder': {
                  color: 'var(--mantine-color-dark-3)',
                },
              },
            }}
            disabled={hizliReceteLoading}
          />
          <Select
            placeholder="Kategori"
            value={hizliReceteKategoriId}
            onChange={setHizliReceteKategoriId}
            data={receteKategorileriAPI.map((k) => ({
              value: k.id.toString(),
              label: `${k.ikon} ${k.ad}`,
            }))}
            size="sm"
            radius="md"
            w={160}
            clearable
            styles={{
              input: {
                background: 'var(--mantine-color-dark-7)',
                border: 'none',
              },
            }}
            disabled={hizliReceteLoading}
            comboboxProps={{ withinPortal: true }}
          />
          <Button
            size="sm"
            radius="md"
            variant="white"
            color="dark"
            leftSection={<IconSparkles size={16} />}
            onClick={handleHizliReceteEkle}
            loading={hizliReceteLoading}
            disabled={!hizliReceteAdi.trim()}
          >
            AI ile Oluştur
          </Button>
        </Group>
        <Text size="xs" c="white" mt={6} opacity={0.8}>
          Reçete adını yazın, AI otomatik malzemeleri önersin
        </Text>
      </Paper>

      {/* Şartname önizleme seçicisi - seçilen şartnameye göre gramaj/fiyat önizlemesi */}
      {sartnameler.length > 0 && (
        <Stack gap="xs" mb="md">
          <Select
            placeholder="Şartnameye göre önizleme (gramaj & fiyat)"
            value={seciliSartnameId}
            onChange={setSeciliSartnameId}
            data={sartnameler.map((s) => ({ value: String(s.id), label: `${s.kod || ''} ${s.ad}`.trim() }))}
            clearable
            leftSection={<IconClipboardList size={16} />}
            size="sm"
            radius="md"
            styles={{
              input: {
                background: 'var(--mantine-color-dark-6)',
                border: seciliSartnameId ? '1px solid var(--mantine-color-teal-6)' : undefined,
              },
            }}
            comboboxProps={{ withinPortal: true }}
          />
          {gramajKontrolToplu?.ozet && gramajKontrolToplu.ozet.toplam_recete > 0 && (
            <Group gap="xs">
              <Badge size="sm" variant="light" color="green">
                {gramajKontrolToplu.receteler.filter((r) => r.tam_uyum === true).length} uyumlu reçete
              </Badge>
              {gramajKontrolToplu.ozet.toplam_uyumsuz > 0 && (
                <Badge size="sm" variant="light" color="orange">
                  {gramajKontrolToplu.receteler.filter((r) => r.tam_uyum === false).length} uyumsuz reçete
                </Badge>
              )}
            </Group>
          )}
        </Stack>
      )}

      {/* Premium Search */}
      <TextInput
        placeholder="Ara..."
        leftSection={<IconSearch size={14} stroke={1.5} />}
        value={receteArama}
        onChange={(e) => setReceteArama(e.target.value)}
        mb="md"
        size="sm"
        radius="md"
        styles={{
          input: {
            background: 'var(--mantine-color-dark-6)',
            border: 'none',
            '&:focus': {
              border: 'none',
            },
          },
        }}
      />

      {/* Premium Kategori Filter - Minimal Pill Style */}
      <ScrollArea scrollbarSize={0} offsetScrollbars={false} mb="lg">
        <Group gap={8} wrap="nowrap">
          <UnstyledButton
            onClick={() => setSeciliKategoriKod(null)}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              background: seciliKategoriKod === null ? 'var(--mantine-color-dark-4)' : 'transparent',
              transition: 'all 0.2s ease',
            }}
          >
            <Text
              size="xs"
              fw={seciliKategoriKod === null ? 500 : 400}
              c={seciliKategoriKod === null ? 'white' : 'dimmed'}
            >
              Tümü
            </Text>
          </UnstyledButton>
          {receteKategorileriAPI.map((kat) => {
            const katSayisi = receteler.filter((r) => r.kategori_adi === kat.ad).length;
            if (katSayisi === 0) return null;
            const isActive = seciliKategoriKod === kat.kod;
            return (
              <UnstyledButton
                key={kat.kod}
                onClick={() => setSeciliKategoriKod(kat.kod)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  background: isActive ? 'var(--mantine-color-dark-4)' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" style={{ lineHeight: 1 }}>
                    {kat.ikon}
                  </Text>
                  <Text size="xs" fw={isActive ? 500 : 400} c={isActive ? 'white' : 'dimmed'}>
                    {kat.ad}
                  </Text>
                </Group>
              </UnstyledButton>
            );
          })}
        </Group>
      </ScrollArea>

      {recetelerLoading ? (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
          <Skeleton height={140} radius="lg" />
          <Skeleton height={140} radius="lg" />
          <Skeleton height={140} radius="lg" />
          <Skeleton height={140} radius="lg" />
          <Skeleton height={140} radius="lg" />
          <Skeleton height={140} radius="lg" />
          <Skeleton height={140} radius="lg" />
          <Skeleton height={140} radius="lg" />
        </SimpleGrid>
      ) : filteredReceteler.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="sm">
            <IconBook2 size={40} color="var(--mantine-color-gray-5)" />
            <Text size="sm" c="dimmed">
              {receteler.length === 0 ? 'Henüz reçete yok' : 'Arama sonucu bulunamadı'}
            </Text>
          </Stack>
        </Center>
      ) : (
        <ScrollArea.Autosize mah={520}>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
            {filteredReceteler.map((recete) => {
              const kategoriAdi = recete.kategori_adi || recete.kategori || 'Kategorisiz';
              const kategoriInfo = KATEGORILER.find(
                (k) => k.ad === kategoriAdi || (recete.kategori && k.kod === recete.kategori)
              );
              const maliyet = Number(recete.tahmini_maliyet || recete.toplam_maliyet || 0);
              const malzemeSayisi = recete.malzeme_sayisi || recete.malzemeler?.length || 0;
              const porsiyon = recete.porsiyon_miktar || recete.porsiyon;
              const kalori = recete.kalori;
              const hazirlama = recete.hazirlik_suresi;
              const pisirme = recete.pisirme_suresi;
              const toplamSure = (hazirlama || 0) + (pisirme || 0);

              return (
                <UnstyledButton
                  key={recete.id}
                  onClick={() => fetchReceteDetay(recete.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '14px',
                    borderRadius: 16,
                    background: 'var(--mantine-color-dark-6)',
                    transition: 'all 0.2s ease',
                    height: '100%',
                    minHeight: 155,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--mantine-color-dark-5)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--mantine-color-dark-6)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Top: Icon & Price */}
                  <Group justify="space-between" mb="xs" w="100%">
                    <Box
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--mantine-color-dark-5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text size="lg">{kategoriInfo?.ikon || recete.kategori_ikon || '🍽️'}</Text>
                    </Box>
                    {maliyet > 0 && !Number.isNaN(maliyet) && (
                      <Text size="sm" fw={600} c="teal">
                        ₺{maliyet.toFixed(2)}
                      </Text>
                    )}
                  </Group>

                  {/* Name */}
                  <Text size="sm" fw={500} lineClamp={2} mb={6} style={{ flex: 1 }}>
                    {recete.ad}
                  </Text>

                  {/* Stats Row */}
                  <Group gap={8} mb={6}>
                    {porsiyon && (
                      <Text size="xs" c="dimmed">
                        {porsiyon}g
                      </Text>
                    )}
                    {kalori && (
                      <Text size="xs" c="orange">
                        {kalori} kcal
                      </Text>
                    )}
                    {toplamSure > 0 && (
                      <Text size="xs" c="blue">
                        {toplamSure}dk
                      </Text>
                    )}
                  </Group>

                  {/* Bottom: Category & Ingredients */}
                  <Group gap={6} wrap="nowrap">
                    <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                      {kategoriAdi}
                    </Text>
                    {malzemeSayisi > 0 && (
                      <Badge size="xs" variant="light" color="gray" radius="sm">
                        {malzemeSayisi}
                      </Badge>
                    )}
                  </Group>
                </UnstyledButton>
              );
            })}
          </SimpleGrid>
        </ScrollArea.Autosize>
      )}
    </Paper>
  );
}
