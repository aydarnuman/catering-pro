'use client';

import { Box, Button, Center, Container, Loader, Stack, Tabs, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBook2, IconCalendar, IconClipboardList, IconPackages } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { useResponsive } from '@/hooks/useResponsive';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { MaliyetDetayModal } from './components/MaliyetDetayModal';
import { MenuPlanlamaProvider } from './components/MenuPlanlamaContext';
import { MobileMenuNav } from './components/MobileMenuNav';
import { PlanlamaWorkspace } from './components/PlanlamaWorkspace';
import { menuPlanlamaKeys } from './components/queryKeys';
import { ReceteDetayModal } from './components/ReceteDetayModal';
import { RecetelerTab } from './components/RecetelerTab';
import { SartnameYonetimModal } from './components/SartnameYonetimModal';
import {
  type BackendReceteResponse,
  type KategoriInfo,
  type ReceteKategori,
  VARSAYILAN_KATEGORILER,
} from './components/types';
import { UrunlerTab } from './components/UrunlerTab';

const VALID_TABS = ['planlama', 'receteler', 'urunler'] as const;

// Eski URL'lerden yönlendirme
const TAB_ALIASES: Record<string, string> = {
  takvim: 'planlama',
  menuler: 'planlama',
};

export default function MenuPlanlamaPage() {
  const { isMobile, isMounted } = useResponsive();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL'den tab parametresini oku (eski URL uyumluluğu dahil)
  const tabParam = searchParams.get('tab');
  const resolvedTab = tabParam ? TAB_ALIASES[tabParam] || tabParam : null;
  const initialTab = VALID_TABS.includes(resolvedTab as (typeof VALID_TABS)[number]) ? resolvedTab : 'planlama';

  // Eski URL'den ?mode=kurum bilgisini de çek (menuler&subtab=kurum → planlama&mode=kurum)
  const subtabParam = searchParams.get('subtab');
  const initialMode =
    tabParam === 'menuler' && subtabParam === 'kurum'
      ? 'kurum'
      : searchParams.get('mode') === 'kurum'
        ? 'kurum'
        : 'proje';

  const [activeTab, setActiveTab] = useState<string | null>(initialTab);

  // Tab değiştiğinde URL'yi güncelle
  const handleTabChange = useCallback(
    (tab: string | null) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab && tab !== 'planlama') {
        params.set('tab', tab);
      } else {
        params.delete('tab');
      }
      // Eski param'ları temizle
      params.delete('subtab');
      const qs = params.toString();
      router.replace(`/menu-planlama${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Şartname yönetimi modal
  const [sartnameModalOpened, setSartnameModalOpened] = useState(false);

  // Reçete detay modal
  const [detayModalOpened, setDetayModalOpened] = useState(false);
  const [receteDetayId, setReceteDetayId] = useState<number | null>(null);

  // Maliyet detay modal
  const [maliyetModalOpened, setMaliyetModalOpened] = useState(false);
  const [maliyetReceteId, setMaliyetReceteId] = useState<number | null>(null);

  // React Query: Reçete kategorileri
  const {
    data: receteKategorileri = [],
    isLoading: loading,
    error: receteKategorileriError,
    refetch: refetchReceteler,
  } = useQuery<ReceteKategori[]>({
    queryKey: menuPlanlamaKeys.receteler.kategoriler(),
    queryFn: async (): Promise<ReceteKategori[]> => {
      const result = await menuPlanlamaAPI.getRecetelerMaliyet();
      if (!result.success) {
        throw new Error('Reçeteler yüklenemedi');
      }

      const receteler = (result.data || []) as BackendReceteResponse[];
      const kategoriMap = new Map<string, ReceteKategori>();

      receteler.forEach((recete: BackendReceteResponse) => {
        let kategoriKod = 'diger';
        let kategoriAdi = recete.kategori_adi || 'Diğer';
        let kategoriIkon = recete.kategori_ikon || '🍽️';

        const varsayilanKategori = VARSAYILAN_KATEGORILER.find((k) => k.ad.toLowerCase() === kategoriAdi.toLowerCase());

        if (varsayilanKategori) {
          kategoriKod = varsayilanKategori.kod;
          kategoriAdi = varsayilanKategori.ad;
          kategoriIkon = varsayilanKategori.ikon;
        } else {
          kategoriKod =
            kategoriAdi
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_|_$/g, '') || 'diger';
        }

        if (!kategoriMap.has(kategoriKod)) {
          kategoriMap.set(kategoriKod, {
            kod: kategoriKod,
            ad: kategoriAdi,
            ikon: kategoriIkon,
            renk: varsayilanKategori?.renk || 'gray',
            yemekler: [],
          });
        }

        const kategori = kategoriMap.get(kategoriKod);
        if (!kategori) return;
        kategori.yemekler.push({
          id: recete.id,
          ad: recete.ad,
          kategori: kategoriKod,
          fiyat: Number(recete.tahmini_maliyet || 0),
          porsiyon: Number(recete.porsiyon_miktar || 0),
        });
      });

      return Array.from(kategoriMap.values());
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Error handling
  useEffect(() => {
    if (receteKategorileriError) {
      notifications.show({
        title: 'Hata',
        message: 'Reçeteler yüklenemedi. Tekrar denemek için tıklayın.',
        color: 'red',
        autoClose: false,
        onClick: () => refetchReceteler(),
      });
    }
  }, [receteKategorileriError, refetchReceteler]);

  // Realtime hook
  useRealtimeRefetch(['menu_items', 'urunler'], () => {
    queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.receteler.kategoriler() });
    queryClient.invalidateQueries({ queryKey: menuPlanlamaKeys.receteler.all() });
    queryClient.invalidateQueries({ queryKey: ['urunler'] });
  });

  // Reçete detayını aç
  const fetchReceteDetay = useCallback((receteId: number) => {
    setReceteDetayId(receteId);
    setDetayModalOpened(true);
  }, []);

  // Maliyet detay modalını aç
  const handleMaliyetClick = useCallback((receteId: number) => {
    setMaliyetReceteId(receteId);
    setMaliyetModalOpened(true);
  }, []);

  // Kategoriler (memoized)
  const KATEGORILER = useMemo<KategoriInfo[]>(() => {
    if ((receteKategorileri ?? []).length === 0) {
      return VARSAYILAN_KATEGORILER;
    }
    return (receteKategorileri ?? []).map((k) => ({
      kod: k.kod,
      ad: k.ad,
      ikon: k.ikon,
      renk: k.renk || 'gray',
    }));
  }, [receteKategorileri]);

  if (loading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" color="teal" />
          <Text c="dimmed">Yükleniyor...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, rgba(20, 184, 166, 0.03) 0%, rgba(59, 130, 246, 0.03) 100%)',
      }}
    >
      <Box style={{ paddingBottom: isMobile ? 70 : 0 }}>
        <Container size="xl" py="md">
          <Tabs value={activeTab} onChange={handleTabChange} variant="outline" radius="md">
            <Tabs.List mb="md">
              <Tabs.Tab value="planlama" leftSection={<IconCalendar size={16} />}>
                Planlama
              </Tabs.Tab>

              {/* Ayırıcı */}
              <Box
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  margin: '6px 8px',
                  background: 'var(--mantine-color-dark-4)',
                }}
              />

              <Tabs.Tab value="receteler" leftSection={<IconBook2 size={16} />}>
                Reçeteler
              </Tabs.Tab>
              <Tabs.Tab value="urunler" leftSection={<IconPackages size={16} />}>
                Ürünler
              </Tabs.Tab>

              {/* Şartname Yönetimi butonu - tabların sağında */}
              <Box ml="auto" style={{ display: 'flex', alignItems: 'center' }}>
                <Button
                  leftSection={<IconClipboardList size={14} />}
                  variant="light"
                  size="xs"
                  color="teal"
                  onClick={() => setSartnameModalOpened(true)}
                >
                  Şartname Yönetimi
                </Button>
              </Box>
            </Tabs.List>

            <Tabs.Panel value="planlama">
              <MenuPlanlamaProvider>
                <PlanlamaWorkspace initialMode={initialMode as 'proje' | 'kurum'} />
              </MenuPlanlamaProvider>
            </Tabs.Panel>

            <Tabs.Panel value="receteler">
              <RecetelerTab
                fetchReceteDetay={fetchReceteDetay}
                onMaliyetClick={handleMaliyetClick}
                KATEGORILER={KATEGORILER}
                isActive={activeTab === 'receteler'}
              />
            </Tabs.Panel>

            <Tabs.Panel value="urunler">
              <UrunlerTab isActive={activeTab === 'urunler'} isMobile={isMobile} isMounted={isMounted} />
            </Tabs.Panel>
          </Tabs>
        </Container>

        {/* Mobil Bottom Navigation */}
        {isMobile && isMounted && (
          <MobileMenuNav
            activeTab={(activeTab as 'planlama' | 'receteler' | 'urunler') || 'planlama'}
            onTabChange={(tab) => handleTabChange(tab)}
          />
        )}

        {/* Reçete Detay Modal */}
        <ReceteDetayModal
          opened={detayModalOpened}
          onClose={() => setDetayModalOpened(false)}
          receteId={receteDetayId}
          isMobile={isMobile}
          isMounted={isMounted}
        />

        {/* Maliyet Detay Modal */}
        <MaliyetDetayModal
          opened={maliyetModalOpened}
          onClose={() => setMaliyetModalOpened(false)}
          receteId={maliyetReceteId}
          isMobile={isMobile}
          isMounted={isMounted}
        />

        {/* Şartname Yönetimi Drawer */}
        <SartnameYonetimModal opened={sartnameModalOpened} onClose={() => setSartnameModalOpened(false)} />
      </Box>
    </Box>
  );
}
