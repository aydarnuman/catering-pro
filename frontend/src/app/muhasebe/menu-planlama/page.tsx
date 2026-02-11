'use client';

import { Box, Center, Container, Loader, Stack, Tabs, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBook2, IconCalendar, IconFile, IconPackages } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useResponsive } from '@/hooks/useResponsive';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { KaydedilenMenuler } from './components/KaydedilenMenuler';
import { MenuPlanlamaProvider } from './components/MenuPlanlamaContext';
import { MenuTakvim } from './components/MenuTakvim';
import { MobileKategoriDrawer } from './components/MobileKategoriDrawer';
import { MobileMenuNav } from './components/MobileMenuNav';
import { ReceteDetayModal } from './components/ReceteDetayModal';
import { RecetelerTab } from './components/RecetelerTab';
import {
  type BackendReceteResponse,
  type KategoriInfo,
  type ReceteKategori,
  type ReceteYemek,
  type SeciliYemek,
  VARSAYILAN_KATEGORILER,
} from './components/types';
import { UrunlerTab } from './components/UrunlerTab';

export default function MenuMaliyetPage() {
  const { isMobile, isMounted } = useResponsive();
  const queryClient = useQueryClient();

  // Aktif tab
  const [activeTab, setActiveTab] = useState<string | null>('takvim');

  // LocalStorage: sepet
  const [seciliYemekler, setSeciliYemekler] = useLocalStorage<SeciliYemek[]>('menu-sepet', []);

  // Mobil drawer için kategori seçimi
  const [mobileDrawerKategori, setMobileDrawerKategori] = useState<string | null>(null);

  // Reçete detay modal
  const [detayModalOpened, setDetayModalOpened] = useState(false);
  const [receteDetayId, setReceteDetayId] = useState<number | null>(null);

  // React Query: Reçete kategorileri
  const {
    data: receteKategorileri = [],
    isLoading: loading,
    error: receteKategorileriError,
    refetch: refetchReceteler,
  } = useQuery<ReceteKategori[]>({
    queryKey: ['recete-kategorileri'],
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

        const varsayilanKategori = VARSAYILAN_KATEGORILER.find(
          (k) => k.ad.toLowerCase() === kategoriAdi.toLowerCase()
        );

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
          fatura_fiyat: Number(recete.tahmini_maliyet || 0),
          piyasa_fiyat: Number(recete.tahmini_maliyet || 0),
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
    queryClient.invalidateQueries({ queryKey: ['recete-kategorileri'] });
    queryClient.invalidateQueries({ queryKey: ['receteler'] });
    queryClient.invalidateQueries({ queryKey: ['urunler'] });
  });

  // Kategori için reçeteleri getir
  const getRecetelerForKategori = (kategoriKod: string): ReceteYemek[] => {
    const kategori = receteKategorileri.find((k) => k.kod === kategoriKod);
    return kategori?.yemekler || [];
  };

  // Reçete detayını aç
  const fetchReceteDetay = useCallback((receteId: number) => {
    setReceteDetayId(receteId);
    setDetayModalOpened(true);
  }, []);

  // Yemek seç (sepete ekle/çıkar)
  const handleYemekSec = (kategori: string, yemek: ReceteYemek) => {
    const id = `recete-${yemek.id}`;
    const mevcut = seciliYemekler.find((y) => y.id === id);

    if (mevcut) {
      setSeciliYemekler(seciliYemekler.filter((y) => y.id !== id));
    } else {
      setSeciliYemekler([
        ...seciliYemekler,
        {
          id,
          recete_id: yemek.id,
          kategori,
          ad: yemek.ad,
          fiyat: yemek.piyasa_maliyet || yemek.sistem_maliyet || 0,
          fatura_fiyat: yemek.fatura_maliyet || yemek.sistem_maliyet || 0,
          piyasa_fiyat: yemek.piyasa_maliyet || 0,
        },
      ]);
      notifications.show({
        message: `${yemek.ad} eklendi`,
        color: 'teal',
        autoClose: 1000,
      });
    }
  };

  // Kategoriler (memoized)
  const KATEGORILER = useMemo<KategoriInfo[]>(() => {
    if (receteKategorileri.length === 0) {
      return VARSAYILAN_KATEGORILER;
    }
    return receteKategorileri.map((k) => ({
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
        background:
          'linear-gradient(180deg, rgba(20, 184, 166, 0.03) 0%, rgba(59, 130, 246, 0.03) 100%)',
      }}
    >
      <Box style={{ paddingBottom: isMobile ? 70 : 0 }}>
        <Container size="xl" py="md">
          <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
            <Tabs.List mb="md">
              <Tabs.Tab value="takvim" leftSection={<IconCalendar size={16} />}>
                Takvim
              </Tabs.Tab>
              <Tabs.Tab value="receteler" leftSection={<IconBook2 size={16} />}>
                Reçeteler
              </Tabs.Tab>
              <Tabs.Tab value="urunler" leftSection={<IconPackages size={16} />}>
                Ürünler
              </Tabs.Tab>
              <Tabs.Tab value="menuler" leftSection={<IconFile size={16} />}>
                Menüler
              </Tabs.Tab>
            </Tabs.List>

            {/* Tab: Takvim */}
            <Tabs.Panel value="takvim">
              <MenuPlanlamaProvider>
                <MenuTakvim />
              </MenuPlanlamaProvider>
            </Tabs.Panel>

            {/* Tab: Reçeteler */}
            <Tabs.Panel value="receteler">
              <RecetelerTab
                fetchReceteDetay={fetchReceteDetay}
                KATEGORILER={KATEGORILER}
                isActive={activeTab === 'receteler'}
              />
            </Tabs.Panel>

            {/* Tab: Ürünler (birleştirilmiş: ürünler + fiyatlar) */}
            <Tabs.Panel value="urunler">
              <UrunlerTab
                isActive={activeTab === 'urunler'}
                isMobile={isMobile}
                isMounted={isMounted}
              />
            </Tabs.Panel>

            {/* Tab: Menüler */}
            <Tabs.Panel value="menuler">
              <MenuPlanlamaProvider>
                <KaydedilenMenuler />
              </MenuPlanlamaProvider>
            </Tabs.Panel>
          </Tabs>
        </Container>

        {/* Mobil Bottom Navigation */}
        {isMobile && isMounted && (
          <MobileMenuNav
            activeCategory={
              activeTab === 'takvim'
                ? 'planlama'
                : activeTab === 'receteler' || activeTab === 'urunler' || activeTab === 'menuler'
                  ? 'katalog'
                  : 'analiz'
            }
            onCategoryChange={(cat) => {
              if (cat === 'planlama') setActiveTab('takvim');
              else if (cat === 'katalog') setActiveTab('receteler');
              else if (cat === 'analiz') setActiveTab('urunler');
            }}
          />
        )}

        {/* Mobil Kategori Drawer */}
        {isMobile && isMounted && (
          <MobileKategoriDrawer
            kategoriKod={mobileDrawerKategori}
            onClose={() => setMobileDrawerKategori(null)}
            kategoriler={KATEGORILER}
            getRecetelerForKategori={getRecetelerForKategori}
            seciliYemekler={seciliYemekler}
            onYemekSec={handleYemekSec}
            onReceteDetay={fetchReceteDetay}
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
      </Box>
    </Box>
  );
}
