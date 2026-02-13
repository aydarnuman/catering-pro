'use client';

import { ActionIcon, Badge, Box, Group, Paper, SimpleGrid, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconCopy, IconX } from '@tabler/icons-react';
import { formatMoney } from '@/lib/formatters';
import type { OgunInfo, TakvimHucre, TakvimState } from './types';
import { formatGunAdi, formatGunNo, formatTarih } from './types';

interface MonthlyCalendarGridProps {
  tarihler: Date[];
  ogunler: OgunInfo[];
  takvimState: TakvimState;
  selectedGun: string | null;
  onGunSec: (tarih: Date) => void;
  kopyaKaynakTarih: Date | null;
  onKopyaBaslat: (tarih: Date) => void;
  onKopyaYapistir: (kaynakTarih: Date, hedefTarihler: Date[]) => void;
  onKopyaIptal: () => void;
}

export function MonthlyCalendarGrid({
  tarihler,
  ogunler,
  takvimState,
  selectedGun,
  onGunSec,
  kopyaKaynakTarih,
  onKopyaBaslat,
  onKopyaYapistir,
  onKopyaIptal,
}: MonthlyCalendarGridProps) {
  const getHucreKey = (tarih: Date, ogunKod: string) => `${formatTarih(tarih)}_${ogunKod}`;

  return (
    <SimpleGrid cols={{ base: 5, sm: 6, md: 7 }} spacing="xs">
      {tarihler.map((tarih) => {
        const tarihKey = formatTarih(tarih);
        const isSelected = selectedGun === tarihKey;
        const isKopyaKaynak = kopyaKaynakTarih && formatTarih(kopyaKaynakTarih) === tarihKey;

        // Bu günün yemek sayısını ve maliyetini hesapla
        let yemekSayisi = 0;
        let gunMaliyet = 0;
        const doluOgunler: string[] = [];

        for (const ogun of ogunler) {
          const key = getHucreKey(tarih, ogun.kod);
          const hucre: TakvimHucre | undefined = takvimState[key];
          if (hucre && hucre.yemekler.length > 0) {
            yemekSayisi += hucre.yemekler.length;
            gunMaliyet += hucre.yemekler.reduce((s, y) => s + y.fiyat, 0);
            doluOgunler.push(ogun.kod);
          }
        }

        const gunDolu = yemekSayisi > 0;

        return (
          <Paper
            key={tarihKey}
            p="xs"
            radius="sm"
            withBorder
            style={{
              cursor: 'pointer',
              background: isSelected
                ? 'var(--mantine-color-indigo-light)'
                : isKopyaKaynak
                  ? 'var(--mantine-color-blue-light)'
                  : gunDolu
                    ? 'var(--mantine-color-dark-6)'
                    : 'var(--mantine-color-dark-7)',
              borderColor: isSelected
                ? 'var(--mantine-color-indigo-5)'
                : isKopyaKaynak
                  ? 'var(--mantine-color-blue-5)'
                  : gunDolu
                    ? 'var(--mantine-color-dark-4)'
                    : 'var(--mantine-color-dark-5)',
              transition: 'all 0.15s',
              minHeight: 80,
            }}
          >
            <UnstyledButton onClick={() => onGunSec(tarih)} style={{ width: '100%' }}>
              <Group justify="space-between" mb={4}>
                <Box>
                  <Text size="xs" c="dimmed">
                    {formatGunAdi(tarih)}
                  </Text>
                  <Text fw={700} size="lg">
                    {formatGunNo(tarih)}
                  </Text>
                </Box>
                {gunDolu && (
                  <Stack gap={2} align="flex-end">
                    {kopyaKaynakTarih && !isKopyaKaynak ? (
                      <Tooltip label="Bu güne yapıştır">
                        <ActionIcon
                          size="xs"
                          variant="light"
                          color="teal"
                          onClick={(e) => {
                            e.stopPropagation();
                            onKopyaYapistir(kopyaKaynakTarih, [tarih]);
                          }}
                        >
                          <IconCopy size={10} />
                        </ActionIcon>
                      </Tooltip>
                    ) : isKopyaKaynak ? (
                      <Tooltip label="İptal">
                        <ActionIcon
                          size="xs"
                          variant="filled"
                          color="blue"
                          onClick={(e) => {
                            e.stopPropagation();
                            onKopyaIptal();
                          }}
                        >
                          <IconX size={10} />
                        </ActionIcon>
                      </Tooltip>
                    ) : (
                      <Tooltip label="Bu günü kopyala">
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={(e) => {
                            e.stopPropagation();
                            onKopyaBaslat(tarih);
                          }}
                        >
                          <IconCopy size={10} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Stack>
                )}
                {!gunDolu && kopyaKaynakTarih && !isKopyaKaynak && (
                  <Tooltip label="Bu güne yapıştır">
                    <ActionIcon
                      size="xs"
                      variant="light"
                      color="teal"
                      onClick={(e) => {
                        e.stopPropagation();
                        onKopyaYapistir(kopyaKaynakTarih, [tarih]);
                      }}
                    >
                      <IconCopy size={10} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>

              {gunDolu ? (
                <Stack gap={2}>
                  <Group gap={4}>
                    {ogunler.map((ogun) => {
                      const dolu = doluOgunler.includes(ogun.kod);
                      return (
                        <Badge
                          key={ogun.kod}
                          size="xs"
                          variant={dolu ? 'light' : 'outline'}
                          color={dolu ? ogun.renk : 'gray'}
                          style={{ opacity: dolu ? 1 : 0.3 }}
                        >
                          {ogun.ad.charAt(0)}
                        </Badge>
                      );
                    })}
                  </Group>
                  <Group justify="space-between">
                    <Text size="10px" c="dimmed">
                      {yemekSayisi} yemek
                    </Text>
                    <Text size="10px" fw={600} c="teal">
                      {formatMoney(gunMaliyet)}
                    </Text>
                  </Group>
                </Stack>
              ) : (
                <Text size="10px" c="dimmed" ta="center" py={4}>
                  Boş
                </Text>
              )}
            </UnstyledButton>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}
