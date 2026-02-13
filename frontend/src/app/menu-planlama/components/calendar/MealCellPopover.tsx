'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Collapse,
  Divider,
  Group,
  Loader,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconSearch,
  IconToolsKitchen2,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { Recete } from '@/lib/api/services/menu-planlama';
import { formatMoney } from '@/lib/formatters';
import type { OgunInfo, TakvimHucre } from './types';

// Kategori bilgileri
const KATEGORILER = [
  { kod: '', ad: 'Tümü', ikon: '📋' },
  { kod: 'corba', ad: 'Çorba', ikon: '🍲' },
  { kod: 'ana_yemek', ad: 'Ana Yemek', ikon: '🍖' },
  { kod: 'pilav_makarna', ad: 'Pilav/Makarna', ikon: '🍚' },
  { kod: 'salata_meze', ad: 'Salata/Meze', ikon: '🥗' },
  { kod: 'tatli', ad: 'Tatlı', ikon: '🍮' },
  { kod: 'kahvaltilik', ad: 'Kahvaltılık', ikon: '🧀' },
];

interface MealCellPopoverProps {
  hucre?: TakvimHucre;
  ogun: OgunInfo;
  tarih: Date;
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  onYemekEkle: (yemek: Recete) => void;
  receteler: Recete[];
  recetelerLoading: boolean;
  aramaMetni: string;
  onAramaChange: (val: string) => void;
  seciliKategori: string;
  onKategoriChange: (kategori: string) => void;
}

export function MealCellPopover({
  hucre,
  ogun,
  tarih,
  isOpen,
  onToggle,
  onClear,
  onYemekEkle,
  receteler,
  recetelerLoading,
  aramaMetni,
  onAramaChange,
  seciliKategori,
  onKategoriChange,
}: MealCellPopoverProps) {
  const yemekSayisi = hucre?.yemekler?.length || 0;
  const toplamFiyat = hucre?.yemekler?.reduce((sum, y) => sum + y.fiyat, 0) || 0;

  // Yemek ekleme dropdown açık mı - boş hücrelerde otomatik aç
  const [eklemeAcik, setEklemeAcik] = useState(false);
  const eklemeGoster = eklemeAcik || yemekSayisi === 0;

  return (
    <Popover
      opened={isOpen}
      onChange={(opened) => {
        if (!opened) {
          setEklemeAcik(false);
          onToggle();
        }
      }}
      position="bottom"
      withArrow
      shadow="xl"
      width={380}
    >
      <Popover.Target>
        <Card
          p="xs"
          radius="sm"
          withBorder
          style={{
            background: yemekSayisi > 0 ? `var(--mantine-color-${ogun.renk}-light)` : 'var(--mantine-color-dark-6)',
            borderColor: isOpen
              ? `var(--mantine-color-${ogun.renk}-6)`
              : yemekSayisi > 0
                ? `var(--mantine-color-${ogun.renk}-5)`
                : 'var(--mantine-color-dark-4)',
            minHeight: 80,
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: isOpen ? `0 0 0 2px var(--mantine-color-${ogun.renk}-5)` : 'none',
          }}
          onClick={onToggle}
          onMouseEnter={(e) => {
            if (!isOpen) {
              e.currentTarget.style.borderColor = `var(--mantine-color-${ogun.renk}-5)`;
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.currentTarget.style.borderColor =
                yemekSayisi > 0 ? `var(--mantine-color-${ogun.renk}-5)` : 'var(--mantine-color-dark-4)';
              e.currentTarget.style.transform = '';
            }
          }}
        >
          {yemekSayisi === 0 ? (
            <Stack align="center" justify="center" h={60} gap={4}>
              <IconPlus size={20} style={{ opacity: 0.5 }} />
              <Text size="xs" c="dimmed">
                Ekle
              </Text>
            </Stack>
          ) : (
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <Text size="xs" fw={600} lineClamp={1}>
                  {yemekSayisi} yemek
                </Text>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                >
                  <IconX size={12} />
                </ActionIcon>
              </Group>
              <Text size="10px" c="dimmed" lineClamp={2}>
                {hucre?.yemekler
                  ?.slice(0, 2)
                  .map((y) => y.ad)
                  .join(', ')}
                {yemekSayisi > 2 && '...'}
              </Text>
              <Text size="xs" fw={600} c={ogun.renk}>
                {formatMoney(toplamFiyat)}
              </Text>
            </Stack>
          )}
        </Card>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Box>
          {/* Başlık */}
          <Group
            justify="space-between"
            p="xs"
            style={{
              borderBottom: '1px solid var(--mantine-color-dark-4)',
              background: 'var(--mantine-color-dark-7)',
            }}
          >
            <Group gap="xs">
              <ThemeIcon size="sm" color={ogun.renk} variant="light">
                {ogun.ikon}
              </ThemeIcon>
              <Text size="sm" fw={600}>
                {ogun.ad}
              </Text>
              <Text size="xs" c="dimmed">
                {tarih.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              </Text>
            </Group>
            {yemekSayisi > 0 && (
              <Badge size="sm" color={ogun.renk} variant="light">
                {formatMoney(toplamFiyat)}
              </Badge>
            )}
          </Group>

          {/* ANA İÇERİK: Seçilen Reçeteler (Ön Planda) */}
          <Box p="xs">
            {yemekSayisi === 0 ? (
              <Stack align="center" py="lg" gap="xs">
                <ThemeIcon size={40} color="gray" variant="light" radius="xl">
                  <IconToolsKitchen2 size={20} />
                </ThemeIcon>
                <Text size="sm" c="dimmed" ta="center">
                  Henüz reçete eklenmedi
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  Aşağıdaki butonu kullanarak reçete ekleyebilirsiniz
                </Text>
              </Stack>
            ) : (
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text size="xs" fw={600} c="dimmed">
                    Reçeteler ({yemekSayisi})
                  </Text>
                  <ActionIcon size="xs" color="red" variant="subtle" onClick={onClear}>
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
                <ScrollArea.Autosize mah={180}>
                  <Stack gap={4}>
                    {hucre?.yemekler?.map((y, i) => (
                      <Group
                        key={y.id || i}
                        justify="space-between"
                        wrap="nowrap"
                        p="6px 8px"
                        style={{
                          borderRadius: 6,
                          background: 'var(--mantine-color-dark-6)',
                          border: '1px solid var(--mantine-color-dark-4)',
                        }}
                      >
                        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          <Text size="14px">{y.ikon || '🍽️'}</Text>
                          <Text size="xs" fw={500} lineClamp={1}>
                            {y.ad}
                          </Text>
                        </Group>
                        <Text size="xs" fw={600} c={ogun.renk} style={{ whiteSpace: 'nowrap' }}>
                          {formatMoney(y.fiyat)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>

                {/* Toplam */}
                <Group
                  justify="space-between"
                  p="6px 8px"
                  style={{
                    borderRadius: 6,
                    background: `var(--mantine-color-${ogun.renk}-light)`,
                  }}
                >
                  <Text size="xs" fw={700}>
                    Toplam
                  </Text>
                  <Text size="sm" fw={700} c={ogun.renk}>
                    {formatMoney(toplamFiyat)}
                  </Text>
                </Group>
              </Stack>
            )}
          </Box>

          <Divider color="dark.4" />

          {/* YEMEK EKLEME DROPDOWN (İkincil) */}
          <UnstyledButton
            onClick={() => setEklemeAcik((prev) => !prev)}
            w="100%"
            p="8px 12px"
            style={{
              background: eklemeGoster ? `var(--mantine-color-${ogun.renk}-light)` : 'var(--mantine-color-dark-7)',
              transition: 'background 0.15s',
            }}
          >
            <Group justify="space-between">
              <Group gap="xs">
                <IconPlus size={14} />
                <Text size="xs" fw={600}>
                  Yemek Ekle
                </Text>
              </Group>
              {eklemeGoster ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </Group>
          </UnstyledButton>

          <Collapse in={eklemeGoster}>
            <Box
              style={{
                borderTop: '1px solid var(--mantine-color-dark-4)',
              }}
            >
              {/* Arama */}
              <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
                <TextInput
                  placeholder="Reçete ara..."
                  size="xs"
                  leftSection={<IconSearch size={12} />}
                  value={aramaMetni}
                  onChange={(e) => onAramaChange(e.currentTarget.value)}
                  rightSection={
                    aramaMetni && (
                      <ActionIcon size="xs" variant="subtle" onClick={() => onAramaChange('')}>
                        <IconX size={10} />
                      </ActionIcon>
                    )
                  }
                  styles={{ input: { fontSize: 11 } }}
                />
              </Box>

              {/* Kategori Filtreleri */}
              <ScrollArea scrollbarSize={4} type="hover">
                <Group gap={4} p="6px 8px" wrap="nowrap">
                  {KATEGORILER.map((kat) => (
                    <UnstyledButton
                      key={kat.kod}
                      onClick={() => onKategoriChange(kat.kod)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 10,
                        whiteSpace: 'nowrap',
                        background:
                          seciliKategori === kat.kod
                            ? `var(--mantine-color-${ogun.renk}-light)`
                            : 'var(--mantine-color-dark-6)',
                        border: `1px solid ${
                          seciliKategori === kat.kod
                            ? `var(--mantine-color-${ogun.renk}-5)`
                            : 'var(--mantine-color-dark-4)'
                        }`,
                        fontWeight: seciliKategori === kat.kod ? 600 : 400,
                      }}
                    >
                      {kat.ikon} {kat.ad}
                    </UnstyledButton>
                  ))}
                </Group>
              </ScrollArea>

              {/* Reçete Listesi */}
              <ScrollArea.Autosize mah={200}>
                <Stack gap={0} p={4}>
                  {recetelerLoading ? (
                    <Stack align="center" py="md">
                      <Loader size="xs" />
                    </Stack>
                  ) : receteler?.length > 0 ? (
                    receteler.slice(0, 20).map((recete) => (
                      <UnstyledButton
                        key={recete.id}
                        onClick={() => onYemekEkle(recete)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `var(--mantine-color-${ogun.renk}-light)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '';
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap" gap={4}>
                          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                            <Text size="13px">{recete.kategori_ikon || '🍽️'}</Text>
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="11px" fw={500} lineClamp={1}>
                                {recete.ad}
                              </Text>
                              {recete.kategori_adi && (
                                <Text size="9px" c="dimmed" lineClamp={1}>
                                  {recete.kategori_adi}
                                  {recete.malzeme_sayisi ? ` · ${recete.malzeme_sayisi} malzeme` : ''}
                                </Text>
                              )}
                            </Box>
                          </Group>
                          <Group gap={4} wrap="nowrap">
                            <Text size="10px" fw={600} c={ogun.renk}>
                              {formatMoney(recete.tahmini_maliyet || recete.porsiyon_miktar || 0)}
                            </Text>
                            <ThemeIcon size={16} color={ogun.renk} variant="light" radius="xl">
                              <IconPlus size={10} />
                            </ThemeIcon>
                          </Group>
                        </Group>
                      </UnstyledButton>
                    ))
                  ) : (
                    <Text size="xs" c="dimmed" ta="center" py="md">
                      Sonuç yok
                    </Text>
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Box>
          </Collapse>
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
