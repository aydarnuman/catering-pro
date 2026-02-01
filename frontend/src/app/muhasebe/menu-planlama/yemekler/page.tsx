'use client';

import React from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Drawer,
  Group,
  Paper,
  Popover,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCheck,
  IconInfoCircle,
  IconShoppingCart,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useMenuPlanlama } from '../components/MenuPlanlamaContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useReceteKategorileri, type ReceteYemek, type KategoriInfo } from '@/hooks/useReceteKategorileri';
import { formatMoney } from '@/lib/formatters';

// FiyatBadge Component - Memoized for performance
const FiyatBadge = React.memo(({
  fatura,
  piyasa,
  faturaGuncel = true,
  piyasaGuncel = true,
}: {
  fatura?: number;
  piyasa?: number;
  faturaGuncel?: boolean;
  piyasaGuncel?: boolean;
}) => {
  const fark = fatura && piyasa ? ((piyasa - fatura) / fatura) * 100 : 0;

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
        <Badge size="xs" variant="filled" color={fark > 0 ? 'red' : 'green'}>
          {fark > 0 ? '↑' : '↓'}
          {Math.abs(fark).toFixed(0)}%
        </Badge>
      )}
    </Group>
  );
});

export default function YemeklerPage() {
  const { isMobile, isMounted } = useResponsive();
  const { seciliYemekler, handleYemekEkle, clearSepet, handleYemekSil } = useMenuPlanlama();
  
  // State for popover and mobile drawer
  const [openedPopover, setOpenedPopover] = useState<string | null>(null);
  const [mobileDrawerKategori, setMobileDrawerKategori] = useState<string | null>(null);

  // Custom hook: Reçete kategorileri yönetimi
  const {
    receteKategorileri,
    receteKategorileriLoading,
    KATEGORILER,
    getRecetelerForKategori,
  } = useReceteKategorileri();

  // Sepet hesaplamaları - Memoized
  const sepetIstatistikleri = useMemo(() => {
    return {
      toplamUrunSayisi: seciliYemekler.length,
      kategoriBazindaDagılım: seciliYemekler.reduce((acc, yemek) => {
        acc[yemek.kategori] = (acc[yemek.kategori] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [seciliYemekler]);

  // Yemek seçme handler - Optimized
  const handleYemekSec = useCallback((kategori: string, yemek: ReceteYemek) => {
    handleYemekEkle({
      ad: yemek.ad,
      kategori,
      fiyat: yemek.fiyat || yemek.sistem_maliyet || 0,
      ikon: KATEGORILER.find(k => k.kod === kategori)?.ikon,
    });
  }, [handleYemekEkle, KATEGORILER]);

  // Sepet sidebar component - Memoized
  const SepetSidebar = React.memo(() => (
    <Paper p="md" withBorder radius="md" style={{ position: 'sticky', top: '2rem' }}>
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon size="sm" color="teal" radius="xl">
            <IconShoppingCart size={14} />
          </ThemeIcon>
          <Text fw={600} size="sm">Seçilen Yemekler</Text>
        </Group>
        {seciliYemekler.length > 0 && (
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={clearSepet}
            title="Sepeti Temizle"
          >
            <IconTrash size={14} />
          </ActionIcon>
        )}
      </Group>

      {seciliYemekler.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Henüz yemek seçilmedi
        </Text>
      ) : (
        <Stack gap="sm">
          {seciliYemekler.map((yemek, index) => (
            <Paper key={yemek.id} p="sm" radius="md" withBorder>
              <Group justify="space-between">
                <Group gap="sm">
                  <Badge size="sm" variant="light" color="gray">
                    {index + 1}
                  </Badge>
                  <Text size="sm">{yemek.ikon}</Text>
                  <Box>
                    <Text fw={500} size="sm">
                      {yemek.ad}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {yemek.kategori}
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
          ))}
        </Stack>
      )}
    </Paper>
  ));

  if (!isMounted) {
    return null;
  }

  return (
    <Group align="flex-start" gap="xl">
      {/* Ana içerik */}
      <Box style={{ flex: 1 }}>
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
              const seciliSayisi = sepetIstatistikleri.kategoriBazindaDagılım[kat.kod] || 0;
              const yemekler = getRecetelerForKategori(kat.kod);
              const isOpen = openedPopover === kat.kod;

              // Kategori buton komponenti - Memoized
              const KategoriButton = React.memo(() => (
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
              ));

              // Mobilde sadece buton göster
              if (isMobile && isMounted) {
                return <Box key={kat.kod}><KategoriButton /></Box>;
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
                  <Popover.Target><KategoriButton /></Popover.Target>
                  <Popover.Dropdown p={0}>
                    <Box
                      p="xs"
                      style={{
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                      }}
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
                            (y) => y.ad === yemek.ad && y.kategori === kat.kod
                          );
                          return (
                            <Box
                              key={yemek.id}
                              p="xs"
                              style={{
                                borderBottom:
                                  '1px solid var(--mantine-color-default-border)',
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
                                      // TODO: Reçete detayı göster
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

        {/* Mobile Drawer for categories */}
        <Drawer
          opened={!!mobileDrawerKategori}
          onClose={() => setMobileDrawerKategori(null)}
          position="bottom"
          size="75%"
          styles={{
            content: { borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' },
          }}
          withCloseButton={false}
        >
          {mobileDrawerKategori &&
            (() => {
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
                        onClick={() => setMobileDrawerKategori(null)}
                      >
                        <IconX size={18} />
                      </ActionIcon>
                    </Group>
                  </Box>

                  {/* Content */}
                  <ScrollArea style={{ height: 'calc(75vh - 100px)' }}>
                    <Stack gap={0}>
                      {yemekler.map((yemek) => {
                        const isSecili = seciliYemekler.some(
                          (y) => y.ad === yemek.ad && y.kategori === kat.kod
                        );
                        return (
                          <Box
                            key={yemek.id}
                            p="md"
                            style={{
                              borderBottom: '1px solid var(--mantine-color-default-border)',
                              background: isSecili ? 'var(--mantine-color-teal-light)' : undefined,
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap">
                              <UnstyledButton
                                onClick={() => {
                                  handleYemekSec(kat.kod, yemek);
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
                                    <Text size="sm" fw={500} truncate>
                                      {yemek.ad}
                                    </Text>
                                    <FiyatBadge
                                      fatura={yemek.fatura_maliyet || yemek.sistem_maliyet}
                                      piyasa={yemek.piyasa_maliyet}
                                    />
                                  </Box>
                                </Group>
                              </UnstyledButton>
                            </Group>
                          </Box>
                        );
                      })}
                    </Stack>
                  </ScrollArea>
                </>
              );
            })()}
        </Drawer>
      </Box>

      {/* Sepet Sidebar - Desktop only */}
      {!isMobile && (
        <Box style={{ width: 350, flexShrink: 0 }}>
          <SepetSidebar />
        </Box>
      )}
    </Group>
  );
}