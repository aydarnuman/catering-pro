'use client';

import { Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalculator,
  IconCheck,
  IconSparkles,
} from '@tabler/icons-react';
import { useState } from 'react';
import { CalculationModal } from '../CalculationModal';
import type { SavedTender } from '../types';

export function AraclarSection({
  tender,
  onRefresh,
}: {
  tender: SavedTender;
  onRefresh?: () => void;
}) {
  const [calcModalOpen, setCalcModalOpen] = useState(false);

  // Mevcut değerler (sadece gösterim için)
  const yaklasikMaliyet = tender.yaklasik_maliyet || 0;
  const bizimTeklif = tender.bizim_teklif || 0;
  const otomatikSinirDeger = yaklasikMaliyet > 0 ? Math.round(yaklasikMaliyet * 0.85) : 0;

  // Tespit edilen veriler
  const hesaplamaVerileri = (tender as any).hesaplama_verileri || {};
  const isSuresi =
    hesaplamaVerileri.is_suresi ||
    tender.analysis_summary?.teslim_suresi ||
    tender.analysis_summary?.sure;
  const toplamOgun =
    hesaplamaVerileri.toplam_ogun_sayisi ||
    tender.analysis_summary?.ogun_bilgileri?.reduce(
      (sum: number, o: any) => sum + (Number(o.miktar) || 0),
      0
    ) ||
    0;
  const teknikSartSayisi =
    hesaplamaVerileri.teknik_sart_sayisi || tender.analysis_summary?.teknik_sartlar?.length || 0;
  const birimFiyatSayisi =
    hesaplamaVerileri.birim_fiyat_sayisi || tender.analysis_summary?.birim_fiyatlar?.length || 0;

  // Hesaplamalar
  const ogunBasiMaliyet = yaklasikMaliyet && toplamOgun ? yaklasikMaliyet / toplamOgun : 0;

  // Risk hesaplama
  const isAsiriDusuk =
    bizimTeklif > 0 && otomatikSinirDeger > 0 && bizimTeklif < otomatikSinirDeger;
  const fark = bizimTeklif > 0 && otomatikSinirDeger > 0 ? bizimTeklif - otomatikSinirDeger : 0;

  return (
    <>
      {/* Hesaplama Modalı */}
      <CalculationModal
        opened={calcModalOpen}
        onClose={() => setCalcModalOpen(false)}
        tender={tender}
        onRefresh={onRefresh}
      />

      <Stack gap="md">
        {/* Ana Hesaplama Kartı - Hero */}
        <Paper
          p="lg"
          withBorder
          radius="md"
          bg={
            yaklasikMaliyet === 0
              ? 'dark.6'
              : isAsiriDusuk
                ? 'rgba(255, 107, 107, 0.08)'
                : 'rgba(81, 207, 102, 0.08)'
          }
          style={{
            borderColor:
              yaklasikMaliyet === 0
                ? undefined
                : isAsiriDusuk
                  ? 'var(--mantine-color-red-6)'
                  : 'var(--mantine-color-green-6)',
            cursor: 'pointer',
          }}
          onClick={() => setCalcModalOpen(true)}
        >
          <Group justify="space-between" align="flex-start">
            <div>
              <Group gap="xs" mb="xs">
                <ThemeIcon
                  size="lg"
                  variant="light"
                  color={yaklasikMaliyet === 0 ? 'blue' : isAsiriDusuk ? 'red' : 'green'}
                >
                  <IconCalculator size={20} />
                </ThemeIcon>
                <div>
                  <Text size="sm" fw={600}>
                    Teklif Hesaplama
                  </Text>
                  <Text size="xs" c="dimmed">
                    Sınır değer ve risk analizi
                  </Text>
                </div>
              </Group>

              {yaklasikMaliyet > 0 ? (
                <SimpleGrid cols={3} spacing="md" mt="md">
                  <Box>
                    <Text size="xs" c="dimmed">
                      Yaklaşık Maliyet
                    </Text>
                    <Text size="sm" fw={600}>
                      {yaklasikMaliyet.toLocaleString('tr-TR')} ₺
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Sınır Değer
                    </Text>
                    <Text size="sm" fw={600} c="blue">
                      {otomatikSinirDeger.toLocaleString('tr-TR')} ₺
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Bizim Teklif
                    </Text>
                    <Text size="sm" fw={600} c={isAsiriDusuk ? 'red' : 'green'}>
                      {bizimTeklif > 0 ? `${bizimTeklif.toLocaleString('tr-TR')} ₺` : '—'}
                    </Text>
                  </Box>
                </SimpleGrid>
              ) : (
                <Text size="sm" c="dimmed" mt="xs">
                  Teklif analizi için tıklayın
                </Text>
              )}
            </div>

            {yaklasikMaliyet > 0 && bizimTeklif > 0 && (
              <Badge
                size="lg"
                variant="light"
                color={isAsiriDusuk ? 'red' : 'green'}
                leftSection={
                  isAsiriDusuk ? <IconAlertTriangle size={14} /> : <IconCheck size={14} />
                }
              >
                {isAsiriDusuk ? 'RİSKLİ' : 'UYGUN'}
              </Badge>
            )}
          </Group>

          {yaklasikMaliyet > 0 && bizimTeklif > 0 && (
            <Group
              gap="xs"
              mt="md"
              pt="md"
              style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}
            >
              <Text size="xs" c="dimmed">
                Fark:
              </Text>
              <Text size="xs" fw={500} c={fark >= 0 ? 'green' : 'red'}>
                {fark >= 0 ? '+' : ''}
                {fark.toLocaleString('tr-TR')} ₺
              </Text>
              {ogunBasiMaliyet > 0 && (
                <>
                  <Text size="xs" c="dimmed" ml="md">
                    Öğün Başı:
                  </Text>
                  <Text size="xs" fw={500} c="blue">
                    {ogunBasiMaliyet.toFixed(2)} ₺
                  </Text>
                </>
              )}
            </Group>
          )}
        </Paper>

        {/* Açılır Hesaplama Butonu */}
        <Button
          fullWidth
          size="md"
          variant="gradient"
          gradient={{ from: 'blue', to: 'cyan' }}
          leftSection={<IconCalculator size={18} />}
          onClick={() => setCalcModalOpen(true)}
        >
          Detaylı Hesaplama Aç
        </Button>

        {/* Tespit Edilen Veriler - Kompakt */}
        {(isSuresi || toplamOgun > 0) && (
          <Paper p="sm" withBorder radius="md" bg="rgba(20, 184, 166, 0.03)">
            <Group gap="xs" mb="xs">
              <IconSparkles size={14} color="var(--mantine-color-teal-6)" />
              <Text size="xs" fw={600} c="teal">
                Döküman Analizi
              </Text>
            </Group>
            <SimpleGrid cols={4} spacing="xs">
              {isSuresi && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Süre
                  </Text>
                  <Text size="sm" fw={500}>
                    {isSuresi}
                  </Text>
                </Box>
              )}
              {toplamOgun > 0 && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Öğün
                  </Text>
                  <Text size="sm" fw={500}>
                    {(toplamOgun / 1000000).toFixed(1)}M
                  </Text>
                </Box>
              )}
              {teknikSartSayisi > 0 && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Şart
                  </Text>
                  <Text size="sm" fw={500}>
                    {teknikSartSayisi}
                  </Text>
                </Box>
              )}
              {birimFiyatSayisi > 0 && (
                <Box>
                  <Text size="xs" c="dimmed">
                    Kalem
                  </Text>
                  <Text size="sm" fw={500}>
                    {birimFiyatSayisi}
                  </Text>
                </Box>
              )}
            </SimpleGrid>
          </Paper>
        )}
      </Stack>
    </>
  );
}
