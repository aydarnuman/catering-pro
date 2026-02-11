'use client';

import {
  ActionIcon,
  Box,
  Center,
  Drawer,
  Group,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconInfoCircle, IconX } from '@tabler/icons-react';
import { FiyatBadge } from './FiyatBadge';
import type { KategoriInfo, ReceteYemek, SeciliYemek } from './types';

interface MobileKategoriDrawerProps {
  kategoriKod: string | null;
  onClose: () => void;
  kategoriler: KategoriInfo[];
  getRecetelerForKategori: (kod: string) => ReceteYemek[];
  seciliYemekler: SeciliYemek[];
  onYemekSec: (kategori: string, yemek: ReceteYemek) => void;
  onReceteDetay: (receteId: number) => void;
}

export function MobileKategoriDrawer({
  kategoriKod,
  onClose,
  kategoriler,
  getRecetelerForKategori,
  seciliYemekler,
  onYemekSec,
  onReceteDetay,
}: MobileKategoriDrawerProps) {
  return (
    <Drawer
      opened={!!kategoriKod}
      onClose={onClose}
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
      {kategoriKod &&
        (() => {
          const kat = kategoriler.find((k) => k.kod === kategoriKod);
          const yemekler = getRecetelerForKategori(kategoriKod);
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
              <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
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
                  <ActionIcon variant="subtle" color="gray" onClick={onClose}>
                    <IconX size={18} />
                  </ActionIcon>
                </Group>
              </Box>

              {/* Yemek Listesi */}
              <ScrollArea style={{ height: 'calc(100% - 80px)' }}>
                <Stack gap={0}>
                  {yemekler.map((yemek) => {
                    const isSecili = seciliYemekler.some((y) => y.id === `recete-${yemek.id}`);
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
                              onYemekSec(kat.kod, yemek);
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
                              onReceteDetay(yemek.id);
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
  );
}
