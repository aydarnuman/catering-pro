'use client';

import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconChevronDown,
  IconCoffee,
  IconCopy,
  IconFilter,
  IconMoon,
  IconPackage,
  IconSearch,
  IconStar,
  IconStarFilled,
  IconSun,
  IconToolsKitchen2,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { formatMoney } from '@/lib/formatters';
import { useMenuPlanlama } from './MenuPlanlamaContext';

// Types
interface MenuSablon {
  id: number;
  ad: string;
  kategori: 'kahvalti' | 'ogle' | 'aksam' | 'ozel';
  segment: 'ekonomik' | 'standart' | 'premium';
  yemekler: Array<{
    id: number;
    ad: string;
    fiyat: number;
    ikon?: string;
  }>;
  toplam_maliyet: number;
  kisi_basi_maliyet: number;
  olusturulma_tarihi: string;
  kullanim_sayisi: number;
  favori?: boolean;
}

// Kategori bilgileri
const KATEGORILER = [
  { kod: 'ozel', ad: 'Özel Paketlerim', ikon: <IconStarFilled size={18} />, renk: 'yellow' },
  { kod: 'kahvalti', ad: 'Kahvaltı Menüleri', ikon: <IconCoffee size={18} />, renk: 'orange' },
  { kod: 'ogle', ad: 'Öğle Menüleri', ikon: <IconSun size={18} />, renk: 'blue' },
  { kod: 'aksam', ad: 'Akşam Menüleri', ikon: <IconMoon size={18} />, renk: 'violet' },
];

const SEGMENTLER = [
  { value: 'hepsi', label: 'Tümü' },
  { value: 'ekonomik', label: '💰 Ekonomik' },
  { value: 'standart', label: '⭐ Standart' },
  { value: 'premium', label: '👑 Premium' },
];

// Menü Kartı Komponenti
const MenuKart = ({
  menu,
  onKullan,
  onFavoriToggle,
}: {
  menu: MenuSablon;
  onKullan: (menu: MenuSablon) => void;
  onFavoriToggle: (menuId: number) => void;
}) => {
  const [detayAcik, setDetayAcik] = useState(false);

  const segmentRenk =
    {
      ekonomik: 'green',
      standart: 'blue',
      premium: 'grape',
    }[menu.segment] || 'gray';

  return (
    <>
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        withBorder
        style={{
          background: 'var(--mantine-color-dark-6)',
          borderColor: 'var(--mantine-color-dark-4)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--mantine-color-teal-5)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--mantine-color-dark-4)';
          e.currentTarget.style.transform = '';
        }}
        onClick={() => setDetayAcik(true)}
      >
        <Stack gap="xs">
          {/* Başlık ve Favori */}
          <Group justify="space-between" align="flex-start">
            <Box style={{ flex: 1 }}>
              <Text fw={600} size="sm" lineClamp={1}>
                {menu.ad}
              </Text>
              <Badge size="xs" variant="light" color={segmentRenk} mt={4}>
                {menu.segment === 'ekonomik'
                  ? '💰 Ekonomik'
                  : menu.segment === 'standart'
                    ? '⭐ Standart'
                    : '👑 Premium'}
              </Badge>
            </Box>
            <ActionIcon
              variant="subtle"
              color={menu.favori ? 'yellow' : 'gray'}
              onClick={(e) => {
                e.stopPropagation();
                onFavoriToggle(menu.id);
              }}
            >
              {menu.favori ? <IconStarFilled size={16} /> : <IconStar size={16} />}
            </ActionIcon>
          </Group>

          {/* Yemek Listesi Özet */}
          <Box>
            {menu.yemekler.slice(0, 3).map((yemek, idx) => (
              <Text key={idx} size="xs" c="dimmed" lineClamp={1}>
                • {yemek.ad}
              </Text>
            ))}
            {menu.yemekler.length > 3 && (
              <Text size="xs" c="dimmed" fs="italic">
                +{menu.yemekler.length - 3} yemek daha
              </Text>
            )}
          </Box>

          {/* Maliyet ve Butonlar */}
          <Divider color="dark.5" />

          <Group justify="space-between" align="center">
            <Box>
              <Text size="xs" c="dimmed">
                {menu.yemekler.length} çeşit
              </Text>
              <Text fw={700} c="teal" size="lg">
                {formatMoney(menu.kisi_basi_maliyet)}
                <Text span size="xs" c="dimmed">
                  /kişi
                </Text>
              </Text>
            </Box>
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<IconCopy size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onKullan(menu);
              }}
            >
              Kullan
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Detay Modal */}
      <Modal opened={detayAcik} onClose={() => setDetayAcik(false)} title={menu.ad} size="md">
        <Stack gap="md">
          <Group>
            <Badge color={segmentRenk}>
              {menu.segment === 'ekonomik'
                ? '💰 Ekonomik'
                : menu.segment === 'standart'
                  ? '⭐ Standart'
                  : '👑 Premium'}
            </Badge>
            <Text size="sm" c="dimmed">
              {menu.kullanim_sayisi} kez kullanıldı
            </Text>
          </Group>

          <Divider label="Menü İçeriği" labelPosition="center" />

          <Stack gap="xs">
            {menu.yemekler.map((yemek, idx) => (
              <Group key={idx} justify="space-between">
                <Group gap="xs">
                  <Text size="sm">{yemek.ikon || '🍽️'}</Text>
                  <Text size="sm">{yemek.ad}</Text>
                </Group>
                <Text size="sm" fw={500} c="teal">
                  {formatMoney(yemek.fiyat)}
                </Text>
              </Group>
            ))}
          </Stack>

          <Divider />

          <Group justify="space-between">
            <Text fw={600}>Toplam Maliyet (kişi başı):</Text>
            <Text fw={700} size="xl" c="teal">
              {formatMoney(menu.kisi_basi_maliyet)}
            </Text>
          </Group>

          <Button
            fullWidth
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            leftSection={<IconCopy size={16} />}
            onClick={() => {
              onKullan(menu);
              setDetayAcik(false);
            }}
          >
            Bu Menüyü Kullan
          </Button>
        </Stack>
      </Modal>
    </>
  );
};

export function MenuKutuphanesi() {
  const queryClient = useQueryClient();
  const { setSeciliYemekler } = useMenuPlanlama();

  const [aramaMetni, setAramaMetni] = useState('');
  const [seciliSegment, setSeciliSegment] = useState<string>('hepsi');
  const [acikKategoriler, setAcikKategoriler] = useState<string[]>(['ozel', 'kahvalti']);

  // Menü şablonlarını getir
  const { data: menuSablonlari = [], isLoading } = useQuery<MenuSablon[]>({
    queryKey: ['menu-sablonlari'],
    queryFn: async () => {
      // Gerçek API'den çek veya mock data kullan
      const res = await fetch(`${API_BASE_URL}/api/menu-planlama/menu-sablonlari`);
      if (!res.ok) {
        // Mock data döndür
        return getMockMenuler();
      }
      const data = await res.json();
      return data.success ? data.data : getMockMenuler();
    },
  });

  // Favori toggle mutation
  const favoriMutation = useMutation({
    mutationFn: async (menuId: number) => {
      // API call - şimdilik local state'de toggle
      return menuId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-sablonlari'] });
    },
  });

  // Filtrelenmiş menüler
  const filteredMenuler = useMemo(() => {
    return menuSablonlari.filter((menu) => {
      // Arama filtresi
      if (aramaMetni) {
        const aranan = aramaMetni.toLowerCase();
        if (
          !menu.ad.toLowerCase().includes(aranan) &&
          !menu.yemekler.some((y) => y.ad.toLowerCase().includes(aranan))
        ) {
          return false;
        }
      }
      // Segment filtresi
      if (seciliSegment !== 'hepsi' && menu.segment !== seciliSegment) {
        return false;
      }
      return true;
    });
  }, [menuSablonlari, aramaMetni, seciliSegment]);

  // Kategoriye göre grupla
  const menulerByKategori = useMemo(() => {
    const grouped: Record<string, MenuSablon[]> = {
      ozel: [],
      kahvalti: [],
      ogle: [],
      aksam: [],
    };

    filteredMenuler.forEach((menu) => {
      if (menu.favori) {
        grouped.ozel.push(menu);
      }
      if (grouped[menu.kategori]) {
        grouped[menu.kategori].push(menu);
      }
    });

    return grouped;
  }, [filteredMenuler]);

  // Menüyü sepete ekle
  const handleMenuKullan = (menu: MenuSablon) => {
    const yeniYemekler = menu.yemekler.map((y, idx) => ({
      id: `menu-${menu.id}-${idx}-${Date.now()}`,
      recete_id: y.id,
      ad: y.ad,
      kategori: menu.kategori,
      fiyat: y.fiyat,
      ikon: y.ikon,
    }));

    setSeciliYemekler(yeniYemekler);

    notifications.show({
      title: 'Menü Yüklendi',
      message: `${menu.ad} sepete eklendi`,
      color: 'teal',
    });
  };

  const handleFavoriToggle = (menuId: number) => {
    favoriMutation.mutate(menuId);
    notifications.show({
      title: 'Güncellendi',
      message: 'Favori durumu değiştirildi',
      color: 'yellow',
    });
  };

  if (isLoading) {
    return (
      <Paper p="xl" radius="md" withBorder>
        <Group justify="center" py="xl">
          <Loader />
          <Text>Menü kütüphanesi yükleniyor...</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Başlık ve Filtreler */}
      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" wrap="wrap" gap="md">
          <Group gap="md">
            <ThemeIcon size="lg" color="violet" variant="light">
              <IconPackage size={20} />
            </ThemeIcon>
            <Box>
              <Text fw={600} size="lg">
                Menü Kütüphanesi
              </Text>
              <Text size="xs" c="dimmed">
                {menuSablonlari.length} menü şablonu
              </Text>
            </Box>
          </Group>

          <Group gap="sm">
            <TextInput
              placeholder="Menü veya yemek ara..."
              leftSection={<IconSearch size={16} />}
              value={aramaMetni}
              onChange={(e) => setAramaMetni(e.currentTarget.value)}
              style={{ width: 200 }}
            />
            <Select
              placeholder="Segment"
              data={SEGMENTLER}
              value={seciliSegment}
              onChange={(val) => setSeciliSegment(val || 'hepsi')}
              leftSection={<IconFilter size={16} />}
              style={{ width: 150 }}
            />
          </Group>
        </Group>
      </Paper>

      {/* Accordion + Kart Grid */}
      <Accordion
        multiple
        value={acikKategoriler}
        onChange={setAcikKategoriler}
        variant="separated"
        radius="md"
        chevron={<IconChevronDown size={16} />}
        styles={{
          item: {
            background: 'var(--mantine-color-dark-6)',
            border: '1px solid var(--mantine-color-dark-4)',
          },
          control: {
            padding: '12px 16px',
          },
        }}
      >
        {KATEGORILER.map((kategori) => {
          const menuler = menulerByKategori[kategori.kod] || [];
          const toplamMaliyet = menuler.reduce((sum, m) => sum + m.kisi_basi_maliyet, 0);

          // Özel paketler boşsa ve favori yoksa gösterme
          if (kategori.kod === 'ozel' && menuler.length === 0) {
            return null;
          }

          return (
            <Accordion.Item key={kategori.kod} value={kategori.kod}>
              <Accordion.Control>
                <Group justify="space-between" pr="md">
                  <Group gap="sm">
                    <ThemeIcon size="sm" color={kategori.renk} variant="light">
                      {kategori.ikon}
                    </ThemeIcon>
                    <Text fw={600}>{kategori.ad}</Text>
                    <Badge size="sm" variant="light" color="gray">
                      {menuler.length} menü
                    </Badge>
                  </Group>
                  {menuler.length > 0 && (
                    <Text size="sm" c="dimmed">
                      Ort. {formatMoney(toplamMaliyet / menuler.length)}/kişi
                    </Text>
                  )}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                {menuler.length === 0 ? (
                  <Text c="dimmed" ta="center" py="md">
                    {kategori.kod === 'ozel'
                      ? 'Henüz favori menünüz yok. Menülere ⭐ tıklayarak favorilere ekleyin.'
                      : 'Bu kategoride menü bulunamadı'}
                  </Text>
                ) : (
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
                    {menuler.map((menu) => (
                      <MenuKart
                        key={menu.id}
                        menu={menu}
                        onKullan={handleMenuKullan}
                        onFavoriToggle={handleFavoriToggle}
                      />
                    ))}
                  </SimpleGrid>
                )}
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}

// Mock data
function getMockMenuler(): MenuSablon[] {
  return [
    {
      id: 1,
      ad: 'Standart Kahvaltı',
      kategori: 'kahvalti',
      segment: 'standart',
      yemekler: [
        { id: 1, ad: 'Beyaz Peynir', fiyat: 3.5, ikon: '🧀' },
        { id: 2, ad: 'Zeytin', fiyat: 2.0, ikon: '🫒' },
        { id: 3, ad: 'Domates-Salatalık', fiyat: 1.5, ikon: '🥗' },
        { id: 4, ad: 'Yumurta', fiyat: 2.5, ikon: '🥚' },
      ],
      toplam_maliyet: 9.5,
      kisi_basi_maliyet: 9.5,
      olusturulma_tarihi: '2026-01-15',
      kullanim_sayisi: 45,
      favori: true,
    },
    {
      id: 2,
      ad: 'Ekonomik Kahvaltı',
      kategori: 'kahvalti',
      segment: 'ekonomik',
      yemekler: [
        { id: 1, ad: 'Beyaz Peynir', fiyat: 3.5, ikon: '🧀' },
        { id: 2, ad: 'Zeytin', fiyat: 2.0, ikon: '🫒' },
        { id: 3, ad: 'Çay', fiyat: 0.5, ikon: '🍵' },
      ],
      toplam_maliyet: 6.0,
      kisi_basi_maliyet: 6.0,
      olusturulma_tarihi: '2026-01-10',
      kullanim_sayisi: 120,
    },
    {
      id: 3,
      ad: 'Şantiye Öğle Menüsü',
      kategori: 'ogle',
      segment: 'ekonomik',
      yemekler: [
        { id: 1, ad: 'Mercimek Çorbası', fiyat: 2.5, ikon: '🥣' },
        { id: 2, ad: 'Tavuk Sote', fiyat: 8.0, ikon: '🍗' },
        { id: 3, ad: 'Pilav', fiyat: 2.0, ikon: '🍚' },
        { id: 4, ad: 'Ayran', fiyat: 1.5, ikon: '🥛' },
      ],
      toplam_maliyet: 14.0,
      kisi_basi_maliyet: 14.0,
      olusturulma_tarihi: '2026-01-20',
      kullanim_sayisi: 85,
      favori: true,
    },
    {
      id: 4,
      ad: 'Kurumsal Öğle Menüsü',
      kategori: 'ogle',
      segment: 'premium',
      yemekler: [
        { id: 1, ad: 'Mercimek Çorbası', fiyat: 2.5, ikon: '🥣' },
        { id: 2, ad: 'Izgara Köfte', fiyat: 12.0, ikon: '🥩' },
        { id: 3, ad: 'Pilav', fiyat: 2.0, ikon: '🍚' },
        { id: 4, ad: 'Mevsim Salata', fiyat: 3.5, ikon: '🥗' },
        { id: 5, ad: 'Tatlı', fiyat: 4.0, ikon: '🍮' },
      ],
      toplam_maliyet: 24.0,
      kisi_basi_maliyet: 24.0,
      olusturulma_tarihi: '2026-01-18',
      kullanim_sayisi: 32,
    },
    {
      id: 5,
      ad: 'Akşam Menüsü - Standart',
      kategori: 'aksam',
      segment: 'standart',
      yemekler: [
        { id: 1, ad: 'Ezogelin Çorbası', fiyat: 2.5, ikon: '🥣' },
        { id: 2, ad: 'Karnıyarık', fiyat: 10.0, ikon: '🍆' },
        { id: 3, ad: 'Bulgur Pilavı', fiyat: 2.5, ikon: '🍚' },
        { id: 4, ad: 'Cacık', fiyat: 2.0, ikon: '🥒' },
      ],
      toplam_maliyet: 17.0,
      kisi_basi_maliyet: 17.0,
      olusturulma_tarihi: '2026-01-22',
      kullanim_sayisi: 56,
    },
    {
      id: 6,
      ad: 'Premium Akşam Menüsü',
      kategori: 'aksam',
      segment: 'premium',
      yemekler: [
        { id: 1, ad: 'Domates Çorbası', fiyat: 3.0, ikon: '🥣' },
        { id: 2, ad: 'Kuzu Tandır', fiyat: 18.0, ikon: '🍖' },
        { id: 3, ad: 'Tereyağlı Pilav', fiyat: 3.5, ikon: '🍚' },
        { id: 4, ad: 'Mevsim Salata', fiyat: 3.5, ikon: '🥗' },
        { id: 5, ad: 'Künefe', fiyat: 6.0, ikon: '🍰' },
      ],
      toplam_maliyet: 34.0,
      kisi_basi_maliyet: 34.0,
      olusturulma_tarihi: '2026-01-25',
      kullanim_sayisi: 18,
    },
  ];
}
