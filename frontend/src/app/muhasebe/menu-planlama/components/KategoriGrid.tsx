'use client';

import React from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Popover,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconInfoCircle, IconX } from '@tabler/icons-react';
import type { KategoriInfo, ReceteYemek } from '@/hooks/useReceteKategorileri';
import type { SeciliYemek } from '@/hooks/useMaliyetHesaplama';

interface KategoriGridProps {
  KATEGORILER: KategoriInfo[];
  seciliYemekler: SeciliYemek[];
  getRecetelerForKategori: (kod: string) => ReceteYemek[];
  onYemekSec: (kategori: string, yemek: ReceteYemek) => void;
  isMobile: boolean;
  isMounted: boolean;
  openedPopover: string | null;
  setOpenedPopover: (kod: string | null) => void;
  setMobileDrawerKategori: (kod: string | null) => void;
  FiyatBadge: React.ComponentType<{
    fatura?: number;
    piyasa?: number;
    faturaGuncel?: boolean;
    piyasaGuncel?: boolean;
  }>;
}

export const KategoriGrid = React.memo(({
  KATEGORILER,
  seciliYemekler,
  getRecetelerForKategori,
  onYemekSec,
  isMobile,
  isMounted,
  openedPopover,
  setOpenedPopover,
  setMobileDrawerKategori,
  FiyatBadge,
}: KategoriGridProps) => {
  return (
    <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
      {KATEGORILER.map((kat) => {
        const sepetKategorisi = seciliYemekler.filter(y => y.kategori === kat.kod);
        const seciliSayisi = sepetKategorisi.length;
        const yemekler = getRecetelerForKategori(kat.kod);
        const isOpen = openedPopover === kat.kod;

        // Kategori buton komponenti
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
                  : isOpen 
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
                            onClick={() => onYemekSec(kat.kod, yemek)}
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
  );
});