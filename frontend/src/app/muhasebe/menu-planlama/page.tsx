'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Drawer,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Popover,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBook2,
  IconCalculator,
  IconCheck,
  IconCurrencyLira,
  IconInfoCircle,
  IconPackages,
  IconScale,
  IconShoppingCart,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import ReceteModal from '@/components/ReceteModal';
import UrunKartlariModal from '@/components/UrunKartlariModal';
import { useResponsive } from '@/hooks/useResponsive';
import { formatMoney } from '@/lib/formatters';
import { menuPlanlamaAPI } from '@/lib/api/services/menu-planlama';

// Fiyat Badge Komponenti
const FiyatBadge = ({ 
  fatura, 
  piyasa, 
  faturaGuncel = true,
  piyasaGuncel = true 
}: { 
  fatura?: number; 
  piyasa?: number;
  faturaGuncel?: boolean;
  piyasaGuncel?: boolean;
}) => {
  const fark = fatura && piyasa ? ((piyasa - fatura) / fatura * 100) : 0;
  
  return (
    <Group gap={4}>
      {fatura !== undefined && fatura > 0 && (
        <Badge 
          size="xs" 
          variant="light" 
          color={faturaGuncel ? 'blue' : 'yellow'}
          leftSection={<Text size="10px">📄</Text>}
        >
          ₺{fatura.toFixed(2)}
        </Badge>
      )}
      {piyasa !== undefined && piyasa > 0 && (
        <Badge 
          size="xs" 
          variant="light" 
          color={piyasaGuncel ? 'teal' : 'orange'}
          leftSection={<Text size="10px">📊</Text>}
        >
          ₺{piyasa.toFixed(2)}
        </Badge>
      )}
      {fatura && piyasa && Math.abs(fark) > 5 && (
        <Badge 
          size="xs" 
          variant="filled" 
          color={fark > 0 ? 'red' : 'green'}
        >
          {fark > 0 ? '↑' : '↓'}{Math.abs(fark).toFixed(0)}%
        </Badge>
      )}
    </Group>
  );
};

// Yemek Kategorileri
const KATEGORILER = [
  { kod: 'corba', ad: 'Çorbalar', ikon: '🥣', renk: 'orange' },
  { kod: 'sebze', ad: 'Sebze Yemekleri', ikon: '🥬', renk: 'green' },
  { kod: 'bakliyat', ad: 'Bakliyat', ikon: '🫘', renk: 'yellow' },
  { kod: 'tavuk', ad: 'Tavuk Yemekleri', ikon: '🍗', renk: 'orange' },
  { kod: 'et', ad: 'Et Yemekleri', ikon: '🥩', renk: 'red' },
  { kod: 'balik', ad: 'Balık', ikon: '🐟', renk: 'blue' },
  { kod: 'pilav', ad: 'Pilav & Makarna', ikon: '🍚', renk: 'cyan' },
  { kod: 'salata', ad: 'Salatalar', ikon: '🥗', renk: 'lime' },
  { kod: 'tatli', ad: 'Tatlılar', ikon: '🍮', renk: 'pink' },
  { kod: 'icecek', ad: 'İçecekler', ikon: '🥛', renk: 'grape' },
];

interface ReceteYemek {
  id: number;
  kod: string;
  ad: string;
  sistem_maliyet: number;
  piyasa_maliyet: number;
  fatura_maliyet?: number;
  fatura_guncel?: boolean;
  piyasa_guncel?: boolean;
  fiyat_uyari?: string;
  kalori: number;
}

interface ReceteKategori {
  kod: string;
  ad: string;
  ikon: string;
  yemekler: ReceteYemek[];
}

interface SeciliYemek {
  id: string;
  recete_id: number;
  kategori: string;
  ad: string;
  fiyat: number;
  fatura_fiyat?: number;
  piyasa_fiyat?: number;
}

interface Malzeme {
  id: number;
  malzeme_adi: string;
  miktar: number;
  birim: string;
  stok_kart_id: number | null;
  stok_adi: string | null;
  sistem_fiyat: number | null;
  piyasa_fiyat: number | null;
  stok_birim: string | null;
}

interface ReceteDetay {
  id: number;
  kod: string;
  ad: string;
  kategori: string;
  porsiyon_gram: number;
  sistem_maliyet: number;
  piyasa_maliyet: number;
  malzemeler: Malzeme[];
}

export default function MenuMaliyetPage() {
  const { isMobile, isMounted } = useResponsive();
  const [receteKategorileri, setReceteKategorileri] = useState<ReceteKategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [seciliYemekler, setSeciliYemekler] = useState<SeciliYemek[]>([]);
  const [openedPopover, setOpenedPopover] = useState<string | null>(null);
  const [kisiSayisi, setKisiSayisi] = useState<number>(1000);

  // Mobil drawer için kategori seçimi
  const [mobileDrawerKategori, setMobileDrawerKategori] = useState<string | null>(null);

  // Reçete detay modal
  const [detayModalOpened, setDetayModalOpened] = useState(false);
  const [receteDetay, setReceteDetay] = useState<ReceteDetay | null>(null);
  const [detayLoading, setDetayLoading] = useState(false);

  // Reçete Yönetimi Modal
  const [receteModalOpened, setReceteModalOpened] = useState(false);

  // Ürün Kartları Modal
  const [urunKartlariModalOpened, setUrunKartlariModalOpened] = useState(false);

  // Reçeteleri yükle
  useEffect(() => {
    fetchReceteler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReceteler = async () => {
    setLoading(true);
    try {
      const result = await menuPlanlamaAPI.getRecetelerMaliyet();
      if (result.success) {
        setReceteKategorileri(result.data as unknown as ReceteKategori[]);
      }
    } catch (error) {
      console.error('Reçete yükleme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Reçeteler yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Kategori için reçeteleri getir
  const getRecetelerForKategori = (kategoriKod: string): ReceteYemek[] => {
    const kategori = receteKategorileri.find((k) => k.kod === kategoriKod);
    return kategori?.yemekler || [];
  };

  // Reçete detayını getir
  const fetchReceteDetay = async (receteId: number) => {
    setDetayLoading(true);
    setDetayModalOpened(true);
    try {
      const result = await menuPlanlamaAPI.getMaliyetAnalizi(receteId);
      if (result.success) {
        setReceteDetay(result.data as unknown as ReceteDetay);
      } else {
        notifications.show({
          title: 'Hata',
          message: 'Reçete detayı yüklenemedi',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Reçete detay hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Reçete detayı yüklenemedi',
        color: 'red',
      });
    } finally {
      setDetayLoading(false);
    }
  };

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
      setOpenedPopover(null);
      notifications.show({
        message: `${yemek.ad} eklendi`,
        color: 'teal',
        autoClose: 1000,
      });
    }
  };

  // Yemek sil
  const handleYemekSil = (id: string) => {
    setSeciliYemekler(seciliYemekler.filter((y) => y.id !== id));
  };

  // Sepeti temizle
  const handleTemizle = () => {
    setSeciliYemekler([]);
  };

  // Toplam maliyetler
  const toplamMaliyet = seciliYemekler.reduce((sum, y) => sum + y.fiyat, 0);
  const toplamFaturaMaliyet = seciliYemekler.reduce((sum, y) => sum + (y.fatura_fiyat || y.fiyat), 0);
  const toplamPiyasaMaliyet = seciliYemekler.reduce((sum, y) => sum + (y.piyasa_fiyat || y.fiyat), 0);
  const maliyetFarki = toplamPiyasaMaliyet - toplamFaturaMaliyet;
  const maliyetFarkiYuzde = toplamFaturaMaliyet > 0 
    ? ((maliyetFarki / toplamFaturaMaliyet) * 100) 
    : 0;


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
      <Container size="xl" py="xl">
        {/* Header */}
        <Stack gap="md" mb="xl">
          <Group justify="space-between" wrap="wrap" gap="md">
            <Group gap="md">
              <ThemeIcon
                size={isMobile ? 40 : 50}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'teal', to: 'cyan' }}
              >
                <IconCalculator size={isMobile ? 20 : 26} />
              </ThemeIcon>
              <Box>
                <Title order={isMobile ? 4 : 2}>Menü Maliyet Hesaplama</Title>
                <Text c="dimmed" size="xs">
                  Reçete seçin, maliyeti görün
                </Text>
              </Box>
            </Group>

            {/* Masaüstünde butonları göster */}
            {(!isMobile || !isMounted) && (
              <Group gap="xs">
                <Button
                  variant="gradient"
                  gradient={{ from: 'indigo', to: 'violet' }}
                  leftSection={<IconPackages size={18} />}
                  onClick={() => setUrunKartlariModalOpened(true)}
                >
                  Ürün Kartları
                </Button>
                <Button
                  variant="gradient"
                  gradient={{ from: 'orange', to: 'red' }}
                  leftSection={<IconBook2 size={18} />}
                  onClick={() => setReceteModalOpened(true)}
                >
                  Reçete ve Maliyet
                </Button>
                {seciliYemekler.length > 0 && (
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={handleTemizle}
                  >
                    Temizle
                  </Button>
                )}
              </Group>
            )}
          </Group>

          {/* Mobilde butonları alt satıra al */}
          {isMobile && isMounted && (
            <Group gap="xs" grow>
              <Button
                variant="light"
                color="indigo"
                size="xs"
                leftSection={<IconPackages size={14} />}
                onClick={() => setUrunKartlariModalOpened(true)}
              >
                Ürünler
              </Button>
              <Button
                variant="light"
                color="orange"
                size="xs"
                leftSection={<IconBook2 size={14} />}
                onClick={() => setReceteModalOpened(true)}
              >
                Reçeteler
              </Button>
              {seciliYemekler.length > 0 && (
                <Button
                  variant="light"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={handleTemizle}
                >
                  Temizle
                </Button>
              )}
            </Group>
          )}
        </Stack>

        {/* Ana İçerik */}
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
          {/* Sol: Kategori Kartları */}
          <Box>
            <Paper p="md" withBorder radius="lg" mb="md">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="lg">
                  🍽️ Yemek Kategorileri
                </Text>
                <Badge variant="light" color="gray">
                  {receteKategorileri.reduce((sum, k) => sum + k.yemekler.length, 0)} reçete
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
                {KATEGORILER.map((kat) => {
                  const seciliSayisi = seciliYemekler.filter((y) => y.kategori === kat.kod).length;
                  const yemekler = getRecetelerForKategori(kat.kod);
                  const isOpen = openedPopover === kat.kod;

                  // Kategori buton komponenti
                  const KategoriButton = (
                    <UnstyledButton
                      style={{
                        padding: 10,
                        borderRadius: 'var(--mantine-radius-md)',
                        border: `${seciliSayisi > 0 ? 2 : 1}px solid`,
                        borderColor:
                          seciliSayisi > 0
                            ? `var(--mantine-color-${kat.renk}-5)`
                            : 'var(--mantine-color-default-border)',
                        background:
                          seciliSayisi > 0
                            ? `var(--mantine-color-${kat.renk}-light)`
                            : isOpen || mobileDrawerKategori === kat.kod
                              ? 'var(--mantine-color-gray-0)'
                              : undefined,
                        transition: 'all 0.15s',
                        width: '100%',
                      }}
                      onClick={() => {
                        if (isMobile && isMounted) {
                          setMobileDrawerKategori(kat.kod);
                        } else {
                          setOpenedPopover(isOpen ? null : kat.kod);
                        }
                      }}
                    >
                      <Group gap={6} wrap="nowrap">
                        <Text size="xl">{kat.ikon}</Text>
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text fw={500} size="xs" truncate>
                            {kat.ad}
                          </Text>
                          <Text size="10px" c="dimmed">
                            {yemekler.length} yemek
                          </Text>
                        </Box>
                        {seciliSayisi > 0 && (
                          <Badge size="xs" color="teal" variant="filled" circle>
                            {seciliSayisi}
                          </Badge>
                        )}
                      </Group>
                    </UnstyledButton>
                  );

                  // Mobilde sadece buton göster, drawer ayrı render edilecek
                  if (isMobile && isMounted) {
                    return <Box key={kat.kod}>{KategoriButton}</Box>;
                  }

                  // Masaüstünde Popover kullan
                  return (
                    <Popover
                      key={kat.kod}
                      opened={isOpen}
                      onChange={(opened) => setOpenedPopover(opened ? kat.kod : null)}
                      position="bottom"
                      withArrow
                      shadow="lg"
                      width={320}
                    >
                      <Popover.Target>{KategoriButton}</Popover.Target>

                      <Popover.Dropdown p={0}>
                        <Box
                          p="xs"
                          style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
                        >
                          <Group justify="space-between">
                            <Group gap="xs">
                              <Text size="lg">{kat.ikon}</Text>
                              <Text fw={600} size="sm">
                                {kat.ad}
                              </Text>
                            </Group>
                            <Badge size="xs" variant="light" color="gray">
                              {yemekler.length} reçete
                            </Badge>
                          </Group>
                        </Box>
                        <ScrollArea.Autosize mah={300}>
                          <Stack gap={0}>
                            {yemekler.map((yemek) => {
                              const isSecili = seciliYemekler.some(
                                (y) => y.id === `recete-${yemek.id}`
                              );
                              return (
                                <Box
                                  key={yemek.id}
                                  p="xs"
                                  style={{
                                    borderBottom: '1px solid var(--mantine-color-default-border)',
                                    background: isSecili
                                      ? 'var(--mantine-color-teal-light)'
                                      : undefined,
                                  }}
                                >
                                  <Group justify="space-between" wrap="nowrap">
                                    <UnstyledButton
                                      onClick={() => handleYemekSec(kat.kod, yemek)}
                                      style={{ flex: 1, minWidth: 0 }}
                                    >
                                      <Group gap="xs" wrap="nowrap">
                                        {isSecili && (
                                          <IconCheck
                                            size={14}
                                            color="var(--mantine-color-teal-6)"
                                          />
                                        )}
                                        <Text size="sm" truncate fw={isSecili ? 600 : 400}>
                                          {yemek.ad}
                                        </Text>
                                      </Group>
                                    </UnstyledButton>
                                    <Group gap="xs" wrap="nowrap">
                                      <FiyatBadge 
                                        fatura={yemek.fatura_maliyet || yemek.sistem_maliyet}
                                        piyasa={yemek.piyasa_maliyet}
                                        faturaGuncel={yemek.fatura_guncel !== false}
                                        piyasaGuncel={yemek.piyasa_guncel !== false}
                                      />
                                      <ActionIcon
                                        variant="subtle"
                                        color="blue"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          fetchReceteDetay(yemek.id);
                                        }}
                                        title="Reçete Detayı"
                                      >
                                        <IconInfoCircle size={16} />
                                      </ActionIcon>
                                    </Group>
                                  </Group>
                                </Box>
                              );
                            })}
                            {yemekler.length === 0 && (
                              <Text size="sm" c="dimmed" ta="center" py="md">
                                Bu kategoride reçete yok
                              </Text>
                            )}
                          </Stack>
                        </ScrollArea.Autosize>
                      </Popover.Dropdown>
                    </Popover>
                  );
                })}
              </SimpleGrid>
            </Paper>

            {/* Bilgi Kartı */}
            <Paper p="md" withBorder radius="lg" bg="blue.0">
              <Group gap="xs" mb="xs">
                <IconCurrencyLira size={20} color="var(--mantine-color-blue-6)" />
                <Text fw={600} size="sm" c="blue.9">
                  Fiyat Bilgisi
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                Fiyatlar piyasa araştırmasından otomatik çekilmektedir. Piyasa fiyatı bulunamayan
                ürünler için sistem fiyatı kullanılır.
              </Text>
            </Paper>
          </Box>

          {/* Sağ: Sepet */}
          <Box>
            <Paper
              withBorder
              radius="lg"
              p={0}
              style={{
                overflow: 'hidden',
                minHeight: 500,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Sepet Başlık */}
              <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconShoppingCart size={20} />
                    <Text fw={600}>Menü Sepeti</Text>
                  </Group>
                  <Badge size="lg" variant="light" color="teal">
                    {seciliYemekler.length} yemek
                  </Badge>
                </Group>
              </Box>

              {seciliYemekler.length === 0 ? (
                <Center style={{ flex: 1 }} py="xl">
                  <Stack align="center" gap="md">
                    <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                      <IconShoppingCart size={30} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text c="dimmed" ta="center">
                        Henüz yemek seçilmedi
                      </Text>
                      <Text size="xs" c="dimmed" ta="center">
                        Kategori kartlarına tıklayarak yemek ekleyin
                      </Text>
                    </Stack>
                  </Stack>
                </Center>
              ) : (
                <>
                  {/* Yemek Listesi */}
                  <ScrollArea style={{ flex: 1 }} p="md">
                    <Stack gap="xs">
                      {seciliYemekler.map((yemek, index) => {
                        const kategori = KATEGORILER.find((k) => k.kod === yemek.kategori);
                        return (
                          <Paper key={yemek.id} p="sm" radius="md" withBorder>
                            <Group justify="space-between">
                              <Group gap="sm">
                                <Badge size="sm" variant="light" color="gray">
                                  {index + 1}
                                </Badge>
                                <Text size="sm">{kategori?.ikon}</Text>
                                <Box>
                                  <Text fw={500} size="sm">
                                    {yemek.ad}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {kategori?.ad}
                                  </Text>
                                </Box>
                              </Group>
                              <Group gap="sm">
                                <Text fw={600} c="teal">
                                  {formatMoney(yemek.fiyat)}
                                </Text>
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  size="sm"
                                  onClick={() => handleYemekSil(yemek.id)}
                                >
                                  <IconX size={14} />
                                </ActionIcon>
                              </Group>
                            </Group>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </ScrollArea>

                  {/* Toplam - Karşılaştırmalı */}
                  <Box
                    p="md"
                    style={{
                      borderTop: '2px solid var(--mantine-color-teal-5)',
                      background: 'var(--mantine-color-gray-0)',
                    }}
                  >
                    <Text fw={700} size="sm" mb="sm">1 PORSİYON MALİYET</Text>
                    
                    {/* Fatura vs Piyasa Karşılaştırma */}
                    <SimpleGrid cols={2} spacing="xs" mb="md">
                      <Paper p="sm" withBorder radius="md" bg="blue.0">
                        <Group gap={4} mb={4}>
                          <Text size="10px">📄</Text>
                          <Text size="xs" c="dimmed">Fatura</Text>
                        </Group>
                        <Text fw={700} size="lg" c="blue.7">
                          {formatMoney(toplamFaturaMaliyet)}
                        </Text>
                      </Paper>
                      <Paper p="sm" withBorder radius="md" bg="teal.0">
                        <Group gap={4} mb={4}>
                          <Text size="10px">📊</Text>
                          <Text size="xs" c="dimmed">Piyasa</Text>
                        </Group>
                        <Text fw={700} size="lg" c="teal.7">
                          {formatMoney(toplamPiyasaMaliyet)}
                        </Text>
                      </Paper>
                    </SimpleGrid>
                    
                    {/* Fark Gösterimi */}
                    {Math.abs(maliyetFarkiYuzde) > 1 && (
                      <Paper 
                        p="xs" 
                        radius="md" 
                        mb="md"
                        bg={maliyetFarki > 0 ? 'red.0' : 'green.0'}
                      >
                        <Group justify="space-between">
                          <Text size="xs" c={maliyetFarki > 0 ? 'red.7' : 'green.7'}>
                            {maliyetFarki > 0 ? '📈 Piyasa daha pahalı' : '📉 Piyasa daha ucuz'}
                          </Text>
                          <Badge color={maliyetFarki > 0 ? 'red' : 'green'} variant="filled">
                            {maliyetFarki > 0 ? '+' : ''}{formatMoney(maliyetFarki)} ({maliyetFarkiYuzde.toFixed(1)}%)
                          </Badge>
                        </Group>
                      </Paper>
                    )}

                    <Divider mb="md" />

                    {/* Kişi Sayısı Girişi */}
                    <Group mb="md">
                      <Text size="sm" fw={500}>
                        👥 Kişi Sayısı:
                      </Text>
                      <NumberInput
                        value={kisiSayisi}
                        onChange={(val) => setKisiSayisi(typeof val === 'number' ? val : 1000)}
                        min={1}
                        max={100000}
                        step={100}
                        w={120}
                        size="sm"
                      />
                    </Group>

                    {/* Hızlı Hesap */}
                    <SimpleGrid cols={3} spacing="xs" mb="md">
                      <Paper p="xs" radius="md" withBorder ta="center" bg="white">
                        <Text size="xs" c="dimmed">
                          100 Kişi
                        </Text>
                        <Text fw={600} size="sm">
                          {formatMoney(toplamMaliyet * 100)}
                        </Text>
                      </Paper>
                      <Paper p="xs" radius="md" withBorder ta="center" bg="white">
                        <Text size="xs" c="dimmed">
                          500 Kişi
                        </Text>
                        <Text fw={600} size="sm">
                          {formatMoney(toplamMaliyet * 500)}
                        </Text>
                      </Paper>
                      <Paper p="xs" radius="md" withBorder ta="center" bg="white">
                        <Text size="xs" c="dimmed">
                          1000 Kişi
                        </Text>
                        <Text fw={600} size="sm">
                          {formatMoney(toplamMaliyet * 1000)}
                        </Text>
                      </Paper>
                    </SimpleGrid>

                    {/* Özel Hesap Sonucu */}
                    <Card withBorder radius="md" p="md" bg="teal.9">
                      <Group justify="space-between">
                        <Box>
                          <Text size="xs" c="teal.2">
                            {kisiSayisi.toLocaleString('tr-TR')} Kişi için
                          </Text>
                          <Text size="xs" c="teal.3">
                            TOPLAM MALİYET
                          </Text>
                        </Box>
                        <Text fw={800} size="xl" c="white">
                          {formatMoney(toplamMaliyet * kisiSayisi)}
                        </Text>
                      </Group>
                    </Card>
                  </Box>
                </>
              )}
            </Paper>
          </Box>
        </SimpleGrid>
      </Container>

      {/* Mobil Kategori Drawer */}
      {isMobile && isMounted && (
        <Drawer
          opened={!!mobileDrawerKategori}
          onClose={() => setMobileDrawerKategori(null)}
          position="bottom"
          size="70%"
          withCloseButton={false}
          styles={{
            content: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            },
          }}
        >
          {mobileDrawerKategori && (() => {
            const kat = KATEGORILER.find((k) => k.kod === mobileDrawerKategori);
            const yemekler = getRecetelerForKategori(mobileDrawerKategori);
            if (!kat) return null;
            
            return (
              <>
                {/* Drawer handle */}
                <Box ta="center" py="xs">
                  <Box
                    style={{
                      width: 40,
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--mantine-color-gray-3)',
                      margin: '0 auto',
                    }}
                  />
                </Box>

                {/* Header */}
                <Box
                  p="md"
                  style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
                >
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Text size="xl">{kat.ikon}</Text>
                      <Box>
                        <Text fw={600}>{kat.ad}</Text>
                        <Text size="xs" c="dimmed">
                          {yemekler.length} reçete
                        </Text>
                      </Box>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => setMobileDrawerKategori(null)}
                    >
                      <IconX size={18} />
                    </ActionIcon>
                  </Group>
                </Box>

                {/* Yemek Listesi */}
                <ScrollArea style={{ height: 'calc(100% - 80px)' }}>
                  <Stack gap={0}>
                    {yemekler.map((yemek) => {
                      const isSecili = seciliYemekler.some(
                        (y) => y.id === `recete-${yemek.id}`
                      );
                      return (
                        <Box
                          key={yemek.id}
                          p="md"
                          style={{
                            borderBottom: '1px solid var(--mantine-color-default-border)',
                            background: isSecili
                              ? 'var(--mantine-color-teal-light)'
                              : undefined,
                          }}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <UnstyledButton
                              onClick={() => {
                                handleYemekSec(kat.kod, yemek);
                                // Seçildiğinde drawer'ı kapatma - kullanıcı isterse kapatır
                              }}
                              style={{ flex: 1, minWidth: 0 }}
                            >
                              <Group gap="sm" wrap="nowrap">
                                {isSecili ? (
                                  <ThemeIcon size="sm" color="teal" radius="xl">
                                    <IconCheck size={12} />
                                  </ThemeIcon>
                                ) : (
                                  <Box
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: '50%',
                                      border: '2px solid var(--mantine-color-gray-3)',
                                    }}
                                  />
                                )}
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <Text size="sm" truncate fw={isSecili ? 600 : 400}>
                                    {yemek.ad}
                                  </Text>
                                  <FiyatBadge 
                                    fatura={yemek.fatura_maliyet || yemek.sistem_maliyet}
                                    piyasa={yemek.piyasa_maliyet}
                                    faturaGuncel={yemek.fatura_guncel !== false}
                                    piyasaGuncel={yemek.piyasa_guncel !== false}
                                  />
                                </Box>
                              </Group>
                            </UnstyledButton>
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              size="lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchReceteDetay(yemek.id);
                              }}
                            >
                              <IconInfoCircle size={20} />
                            </ActionIcon>
                          </Group>
                        </Box>
                      );
                    })}
                    {yemekler.length === 0 && (
                      <Center py="xl">
                        <Text c="dimmed">Bu kategoride reçete yok</Text>
                      </Center>
                    )}
                  </Stack>
                </ScrollArea>
              </>
            );
          })()}
        </Drawer>
      )}

      {/* Reçete Detay Modal */}
      <Modal
        opened={detayModalOpened}
        onClose={() => {
          setDetayModalOpened(false);
          setReceteDetay(null);
        }}
        title={
          <Group gap="sm">
            <IconScale size={24} color="var(--mantine-color-teal-6)" />
            <Text fw={600}>{receteDetay?.ad || 'Reçete Detayı'}</Text>
          </Group>
        }
        size="lg"
        fullScreen={isMobile && isMounted}
      >
        {detayLoading ? (
          <Center py="xl">
            <Loader color="teal" />
          </Center>
        ) : receteDetay ? (
          <Stack gap="md">
            {/* Özet Bilgiler */}
            <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
              <Paper p="sm" withBorder radius="md" ta="center">
                <Text size="xs" c="dimmed">
                  Porsiyon
                </Text>
                <Text fw={600}>{receteDetay.porsiyon_gram || 250}g</Text>
              </Paper>
              <Paper p="sm" withBorder radius="md" ta="center" bg="blue.0">
                <Text size="xs" c="dimmed">
                  Sistem Maliyet
                </Text>
                <Text fw={600} c="blue">
                  {formatMoney(receteDetay.sistem_maliyet || 0)}
                </Text>
              </Paper>
              <Paper p="sm" withBorder radius="md" ta="center" bg="teal.0">
                <Text size="xs" c="dimmed">
                  Piyasa Maliyet
                </Text>
                <Text fw={600} c="teal">
                  {formatMoney(receteDetay.piyasa_maliyet || 0)}
                </Text>
              </Paper>
            </SimpleGrid>

            {/* Malzeme Listesi */}
            <Box>
              <Text fw={600} mb="sm">
                📋 Malzemeler ({receteDetay.malzemeler?.length || 0} kalem)
              </Text>

              {receteDetay.malzemeler && receteDetay.malzemeler.length > 0 ? (
                isMobile && isMounted ? (
                  // Mobil: Card listesi
                  <Stack gap="xs">
                    {receteDetay.malzemeler.map((m) => (
                      <Paper key={m.id} p="sm" withBorder radius="md">
                        <Group justify="space-between" wrap="nowrap">
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={500} truncate>
                              {m.malzeme_adi || m.stok_adi}
                            </Text>
                            {m.stok_adi && m.malzeme_adi !== m.stok_adi && (
                              <Text size="xs" c="dimmed" truncate>
                                {m.stok_adi}
                              </Text>
                            )}
                          </Box>
                          <Stack gap={2} align="flex-end">
                            <Group gap="xs">
                              <Text size="sm" fw={600}>
                                {m.miktar}
                              </Text>
                              <Badge variant="light" color="gray" size="xs">
                                {m.birim || m.stok_birim || 'gr'}
                              </Badge>
                            </Group>
                            {m.piyasa_fiyat ? (
                              <Text size="xs" c="teal" fw={500}>
                                ₺{m.piyasa_fiyat.toFixed(2)}/{m.stok_birim || 'kg'}
                              </Text>
                            ) : m.sistem_fiyat ? (
                              <Text size="xs" c="blue" fw={500}>
                                ₺{m.sistem_fiyat.toFixed(2)}
                              </Text>
                            ) : (
                              <Text size="xs" c="dimmed">—</Text>
                            )}
                          </Stack>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  // Masaüstü: Tablo
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Malzeme</Table.Th>
                        <Table.Th ta="right">Miktar</Table.Th>
                        <Table.Th ta="right">Birim</Table.Th>
                        <Table.Th ta="right">Piyasa Fiyat</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {receteDetay.malzemeler.map((m) => (
                        <Table.Tr key={m.id}>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {m.malzeme_adi || m.stok_adi}
                            </Text>
                            {m.stok_adi && m.malzeme_adi !== m.stok_adi && (
                              <Text size="xs" c="dimmed">
                                {m.stok_adi}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm" fw={600}>
                              {m.miktar}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Badge variant="light" color="gray" size="sm">
                              {m.birim || m.stok_birim || 'gr'}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            {m.piyasa_fiyat ? (
                              <Text size="sm" c="teal" fw={500}>
                                ₺{m.piyasa_fiyat.toFixed(2)}/{m.stok_birim || 'kg'}
                              </Text>
                            ) : m.sistem_fiyat ? (
                              <Text size="sm" c="blue" fw={500}>
                                ₺{m.sistem_fiyat.toFixed(2)}
                              </Text>
                            ) : (
                              <Text size="sm" c="dimmed">
                                —
                              </Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )
              ) : (
                <Paper p="xl" withBorder ta="center" bg="gray.0">
                  <Text c="dimmed">Bu reçeteye henüz malzeme eklenmemiş</Text>
                </Paper>
              )}
            </Box>

            {/* Alt Bilgi */}
            <Paper p="sm" withBorder radius="md" bg="blue.0">
              <Text size="xs" c="dimmed">
                💡 Sistem fiyatı stok kartındaki son alış fiyatıdır.
              </Text>
            </Paper>
          </Stack>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            Reçete bilgisi bulunamadı
          </Text>
        )}
      </Modal>

      {/* Reçete Yönetimi Modal */}
      <ReceteModal
        opened={receteModalOpened}
        onClose={() => {
          setReceteModalOpened(false);
          // Modal kapandığında reçeteleri yenile
          fetchReceteler();
        }}
      />

      {/* Ürün Kartları Modal */}
      <UrunKartlariModal
        opened={urunKartlariModalOpened}
        onClose={() => setUrunKartlariModalOpened(false)}
      />
    </Box>
  );
}
