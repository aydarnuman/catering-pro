'use client';

import {
  Box,
  Center,
  Container,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBook2,
  IconCalendar,
  IconChartLine,
  IconCurrencyLira,
  IconFile,
  IconPackages,
  IconToolsKitchen2,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useResponsive } from '@/hooks/useResponsive';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';
import { KaydedilenMenuler } from './components/KaydedilenMenuler';
// Menü Planlama Componentleri
import { MenuPlanlamaProvider } from './components/MenuPlanlamaContext';
import { MenuSidebar, SIDEBAR_ITEMS, type SidebarCategory } from './components/MenuSidebar';
import { MenuTakvim } from './components/MenuTakvim';
// Refactored components
import { FiyatlarTab } from './components/FiyatlarTab';
import { MobileKategoriDrawer } from './components/MobileKategoriDrawer';
import { MobileMenuNav } from './components/MobileMenuNav';
import { ReceteDetayModal } from './components/ReceteDetayModal';
import { RecetelerTab } from './components/RecetelerTab';
import { UrunDetayModal } from './components/UrunDetayModal';
import { UrunlerTab } from './components/UrunlerTab';
import {
  type BackendReceteResponse,
  type KategoriInfo,
  type ReceteKategori,
  type ReceteYemek,
  type SeciliUrunDetayType,
  type SeciliYemek,
  VARSAYILAN_KATEGORILER,
} from './components/types';

export default function MenuMaliyetPage() {
  const { isMobile, isMounted } = useResponsive();
  const queryClient = useQueryClient();

  // LocalStorage persist edilmiş state'ler
  const [seciliYemekler, setSeciliYemekler] = useLocalStorage<SeciliYemek[]>('menu-sepet', []);

  // Mobil drawer için kategori seçimi
  const [mobileDrawerKategori, setMobileDrawerKategori] = useState<string | null>(null);

  // Reçete detay modal
  const [detayModalOpened, setDetayModalOpened] = useState(false);

  // Sidebar & Tab state
  const [activeCategory, setActiveCategory] = useState<SidebarCategory>('planlama');
  const [activeTab, setActiveTab] = useState<string | null>('takvim');

  // Kategori değiştiğinde ilk tab'a git
  useEffect(() => {
    const category = SIDEBAR_ITEMS.find((s) => s.id === activeCategory);
    if (category && category.tabs.length > 0) {
      setActiveTab(category.tabs[0].id);
    }
  }, [activeCategory]);

  // Aktif kategorinin tab'larını al
  const currentTabs = useMemo(() => {
    return SIDEBAR_ITEMS.find((s) => s.id === activeCategory)?.tabs || [];
  }, [activeCategory]);

  // Fiyat analizi state'leri - shared across FiyatlarTab and UrunDetayModal
  const [seciliFiyatUrunId, setSeciliFiyatUrunId] = useState<number | null>(null);
  const [seciliFiyatUrunAd, setSeciliFiyatUrunAd] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [urunDetayModalOpened, setUrunDetayModalOpened] = useState(false);
  const [seciliUrunDetay, setSeciliUrunDetay] = useState<SeciliUrunDetayType | null>(null);



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
    staleTime: 5 * 60 * 1000, // 5 dakika
    retry: 2,
  });

  // Error handling for recete kategorileri
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

  // Reçete detay ID - ReceteDetayModal'a geçirilir
  const [receteDetayId, setReceteDetayId] = useState<number | null>(null);

  // Reçete detayını getir
  const fetchReceteDetay = useCallback((receteId: number) => {
    setReceteDetayId(receteId);
    setDetayModalOpened(true);
  }, []);

  // Fiyat trendi fetch fonksiyonu (ürün seçimi için)
  const handleFiyatTrendiSec = useCallback(
    (urunId: number, urunAdi: string) => {
      setSeciliFiyatUrunId(urunId);
      setSeciliFiyatUrunAd(urunAdi);
      if (selectedProducts.length < 2 && !selectedProducts.includes(urunAdi)) {
        setSelectedProducts([...selectedProducts, urunAdi]);
      }
    },
    [selectedProducts]
  );

  // Ürün detayını aç
  const handleUrunDetayAc = useCallback(
    (urun: SeciliUrunDetayType) => {
      setSeciliUrunDetay(urun);
      setUrunDetayModalOpened(true);
    },
    []
  );

  // Yemek seç
  const handleYemekSec = (kategori: string, yemek: ReceteYemek) => {
    const id = `recete-${yemek.id}`;
    const mevcut = seciliYemekler.find((y) => y.id === id);

    if (mevcut) {
      // Zaten var, kaldır
      setSeciliYemekler(seciliYemekler.filter((y) => y.id !== id));
    } else {
      // Ekle
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

  // Kategorileri backend'den gelen veriden çıkar (memoized)
  const KATEGORILER = useMemo<KategoriInfo[]>(() => {
    if (receteKategorileri.length === 0) {
      return VARSAYILAN_KATEGORILER;
    }
    // Backend'den gelen kategorileri kullan
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
      {/* Ana Layout: Sol Sidebar + İçerik */}
      <Group align="flex-start" gap={0} wrap="nowrap">
        {/* Sol Sidebar - Mobilde gizli */}
        {!isMobile && (
          <MenuSidebar activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
        )}

        {/* Ana İçerik Alanı */}
        <Box style={{ flex: 1, minWidth: 0, paddingBottom: isMobile ? 70 : 0 }}>
          <Container size="xl" py="md">
            {/* Ana İçerik */}
            <Box>
              <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
                {/* Dinamik Tab Listesi - Kategoriye göre değişir */}
                <Tabs.List mb="md">
                  {currentTabs.map((tab) => (
                    <Tabs.Tab
                      key={tab.id}
                      value={tab.id}
                      leftSection={
                        tab.id === 'yemekler' ? (
                          <IconToolsKitchen2 size={16} />
                        ) : tab.id === 'urunler' ? (
                          <IconPackages size={16} />
                        ) : tab.id === 'receteler' ? (
                          <IconBook2 size={16} />
                        ) : tab.id === 'fiyatlar' ? (
                          <IconChartLine size={16} />
                        ) : tab.id === 'takvim' ? (
                          <IconCalendar size={16} />
                        ) : tab.id === 'maliyet' ? (
                          <IconCurrencyLira size={16} />
                        ) : tab.id === 'menuler' ? (
                          <IconFile size={16} />
                        ) : null
                      }
                    >
                      {tab.label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>

                {/* Tab: Ürünler */}
                <Tabs.Panel value="urunler">
                  <UrunlerTab isActive={activeTab === 'urunler'} />
                </Tabs.Panel>

                {/* Tab 3: Reçeteler */}
                <Tabs.Panel value="receteler">
                  <RecetelerTab
                    fetchReceteDetay={fetchReceteDetay}
                    KATEGORILER={KATEGORILER}
                    isActive={activeTab === 'receteler'}
                  />
                </Tabs.Panel>

                {/* Tab 4: Fiyatlar */}
                <Tabs.Panel value="fiyatlar">
                  <FiyatlarTab
                    seciliFiyatUrunId={seciliFiyatUrunId}
                    seciliFiyatUrunAd={seciliFiyatUrunAd}
                    onFiyatTrendiSec={handleFiyatTrendiSec}
                    onClearSelection={() => {
                      setSeciliFiyatUrunId(null);
                      setSeciliFiyatUrunAd(null);
                      setSelectedProducts([]);
                    }}
                    onUrunDetayAc={handleUrunDetayAc}
                    isMobile={isMobile}
                    isActive={activeTab === 'fiyatlar'}
                  />
                </Tabs.Panel>

                {/* Tab 5: Takvim - Menü Planlama Takvimi */}
                <Tabs.Panel value="takvim">
                  <MenuPlanlamaProvider>
                    <MenuTakvim />
                  </MenuPlanlamaProvider>
                </Tabs.Panel>

                {/* Tab 6: Menüler - Şablonlar + Kaydedilenler */}
                <Tabs.Panel value="menuler">
                  <MenuPlanlamaProvider>
                    <KaydedilenMenuler />
                  </MenuPlanlamaProvider>
                </Tabs.Panel>
              </Tabs>
            </Box>
          </Container>

          {/* Mobil Bottom Navigation */}
          {isMobile && isMounted && (
            <MobileMenuNav
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
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

          {/* Ürün Detay Modal - Detaylı Fiyat Analizi */}
          <UrunDetayModal
            opened={urunDetayModalOpened}
            onClose={() => {
              setUrunDetayModalOpened(false);
              setSeciliUrunDetay(null);
            }}
            urun={seciliUrunDetay}
            isMobile={isMobile}
            isMounted={isMounted}
            onFiyatTrendiSec={handleFiyatTrendiSec}
          />

          {/* Reçete Detay Modal */}
          <ReceteDetayModal
            opened={detayModalOpened}
            onClose={() => setDetayModalOpened(false)}
            receteId={receteDetayId}
            isMobile={isMobile}
            isMounted={isMounted}
          />
        </Box>
      </Group>
    </Box>
  );
}
