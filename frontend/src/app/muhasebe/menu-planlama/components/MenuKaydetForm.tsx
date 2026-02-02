'use client';

import { Box, Button, Divider, Group, Paper, Select, Stack, Text, ThemeIcon } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconBuilding,
  IconCalendar,
  IconClock,
  IconDeviceFloppy,
  IconPlus,
} from '@tabler/icons-react';
import React, { useState } from 'react';
import { useMenuPlanlama } from './MenuPlanlamaContext';
import { YeniProjeModal } from './YeniProjeModal';

export function MenuKaydetForm() {
  const {
    seciliYemekler,
    selectedProjeId,
    setSelectedProjeId,
    selectedTarih,
    setSelectedTarih,
    selectedOgunId,
    setSelectedOgunId,
    projeler,
    projelerLoading,
    ogunTipleri,
    ogunTipleriLoading,
    saveMenuPlan,
    savingMenu,
  } = useMenuPlanlama();

  const [yeniProjeModalOpen, setYeniProjeModalOpen] = useState(false);

  // Sepet boşsa form gösterme
  if (seciliYemekler.length === 0) {
    return null;
  }

  // Proje seçenekleri
  const projeOptions = projeler.map((p) => ({
    value: String(p.id),
    label: `${p.ad}${p.musteri ? ` - ${p.musteri}` : ''}`,
  }));

  // Öğün seçenekleri
  const ogunOptions = ogunTipleri.map((o) => ({
    value: String(o.id),
    label: o.ad,
  }));

  const handleKaydet = async () => {
    await saveMenuPlan();
  };

  const isFormValid = selectedProjeId && selectedOgunId && selectedTarih;

  return (
    <>
      <Paper
        p="md"
        radius="md"
        withBorder
        mt="md"
        style={{
          background: 'var(--mantine-color-dark-6)',
          borderColor: 'var(--mantine-color-dark-4)',
        }}
      >
        <Stack gap="sm">
          {/* Başlık */}
          <Group gap="xs">
            <ThemeIcon size="sm" color="blue" variant="light">
              <IconDeviceFloppy size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">
              Menüyü Kaydet
            </Text>
          </Group>

          <Divider color="dark.4" />

          {/* Proje Seçimi */}
          <Box>
            <Group justify="space-between" mb={4}>
              <Group gap={4}>
                <IconBuilding size={14} style={{ opacity: 0.7 }} />
                <Text size="xs" c="dimmed">
                  Proje / Şantiye
                </Text>
              </Group>
              <Button
                variant="subtle"
                size="compact-xs"
                leftSection={<IconPlus size={12} />}
                onClick={() => setYeniProjeModalOpen(true)}
              >
                Yeni
              </Button>
            </Group>
            <Select
              placeholder="Proje seçin..."
              data={projeOptions}
              value={selectedProjeId ? String(selectedProjeId) : null}
              onChange={(val) => setSelectedProjeId(val ? parseInt(val, 10) : null)}
              searchable
              clearable
              disabled={projelerLoading}
              styles={{
                input: {
                  background: 'var(--mantine-color-dark-7)',
                  borderColor: 'var(--mantine-color-dark-4)',
                },
              }}
            />
          </Box>

          {/* Tarih Seçimi */}
          <Box>
            <Group gap={4} mb={4}>
              <IconCalendar size={14} style={{ opacity: 0.7 }} />
              <Text size="xs" c="dimmed">
                Tarih
              </Text>
            </Group>
            <DatePickerInput
              value={selectedTarih}
              onChange={(date) => date && setSelectedTarih(date)}
              placeholder="Tarih seçin"
              locale="tr"
              valueFormat="DD MMMM YYYY"
              styles={{
                input: {
                  background: 'var(--mantine-color-dark-7)',
                  borderColor: 'var(--mantine-color-dark-4)',
                },
              }}
            />
          </Box>

          {/* Öğün Seçimi */}
          <Box>
            <Group gap={4} mb={4}>
              <IconClock size={14} style={{ opacity: 0.7 }} />
              <Text size="xs" c="dimmed">
                Öğün
              </Text>
            </Group>
            <Select
              placeholder="Öğün seçin..."
              data={ogunOptions}
              value={selectedOgunId ? String(selectedOgunId) : null}
              onChange={(val) => setSelectedOgunId(val ? parseInt(val, 10) : null)}
              disabled={ogunTipleriLoading}
              styles={{
                input: {
                  background: 'var(--mantine-color-dark-7)',
                  borderColor: 'var(--mantine-color-dark-4)',
                },
              }}
            />
          </Box>

          {/* Kaydet Butonu */}
          <Button
            fullWidth
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleKaydet}
            loading={savingMenu}
            disabled={!isFormValid}
            mt="xs"
          >
            Menüyü Kaydet
          </Button>

          {!isFormValid && (
            <Text size="xs" c="dimmed" ta="center">
              Kaydetmek için proje, tarih ve öğün seçin
            </Text>
          )}
        </Stack>
      </Paper>

      {/* Yeni Proje Modal */}
      <YeniProjeModal opened={yeniProjeModalOpen} onClose={() => setYeniProjeModalOpen(false)} />
    </>
  );
}
