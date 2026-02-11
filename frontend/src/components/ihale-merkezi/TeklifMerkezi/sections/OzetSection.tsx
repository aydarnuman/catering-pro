'use client';

import {
  Badge,
  Box,
  Divider,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalculator,
  IconCheckbox,
  IconFileSpreadsheet,
  IconScale,
  IconSparkles,
} from '@tabler/icons-react';
import { formatPara } from '../../../teklif/hesaplamalar';
import type { UseTeklifMerkeziReturn } from '../hooks/useTeklifMerkezi';
import type { SectionCompletionStatus, TeklifMerkeziSection } from '../types';
import { SECTIONS } from '../types';

interface OzetSectionProps {
  ctx: UseTeklifMerkeziReturn;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  sparkles: <IconSparkles size={18} />,
  calculator: <IconCalculator size={18} />,
  scale: <IconScale size={18} />,
  table: <IconFileSpreadsheet size={18} />,
  check: <IconCheckbox size={18} />,
};

function statusColor(s: SectionCompletionStatus) {
  if (s === 'complete') return 'green';
  if (s === 'partial') return 'yellow';
  if (s === 'warning') return 'red';
  return 'gray';
}

function statusLabel(s: SectionCompletionStatus) {
  if (s === 'complete') return 'Tamamlandı';
  if (s === 'partial') return 'Kısmen Dolu';
  if (s === 'warning') return 'Uyarı';
  return 'Başlanmadı';
}

export function OzetSection({ ctx }: OzetSectionProps) {
  const {
    completionMap,
    hesaplanmisTeklifData,
    hesaplamaState,
    aktifSinirDeger,
    riskAnalizi,
    teminatlar,
    setActiveSection,
  } = ctx;

  const md = hesaplanmisTeklifData.maliyet_detay;
  const maliyetToplam = hesaplanmisTeklifData.maliyet_toplam;
  const teklifFiyati = hesaplanmisTeklifData.teklif_fiyati;
  const karTutari = hesaplanmisTeklifData.kar_tutari;
  const karOrani = hesaplanmisTeklifData.kar_orani;
  const cetvelToplami = hesaplanmisTeklifData.cetvel_toplami;

  // Completion yüzdesi
  const sectionKeys: TeklifMerkeziSection[] = ['tespit', 'maliyet', 'hesaplamalar', 'cetvel'];
  const completed = sectionKeys.filter((k) => completionMap[k] === 'complete').length;
  const completionPct = Math.round((completed / sectionKeys.length) * 100);

  // Warnings
  const warnings: string[] = [];
  if (completionMap.tespit === 'not_started') warnings.push('Döküman tespitleri uygulanmadı');
  if (completionMap.maliyet === 'not_started') warnings.push('Teklif maliyetlendirme yapılmadı');
  if (completionMap.hesaplamalar === 'not_started') warnings.push('KİK hesaplamaları eksik');
  if (completionMap.cetvel === 'not_started') warnings.push('Teklif cetveli boş');
  if (riskAnalizi.isAsiriDusuk) warnings.push('Teklif sınır değerin altında - aşırı düşük riski!');

  return (
    <Stack gap="lg">
      {/* ─── Tamamlanma Durumu ─── */}
      <Paper p="lg" withBorder radius="md">
        <Group justify="space-between" mb="md">
          <Text size="md" fw={600}>
            Tamamlanma Durumu
          </Text>
          <Badge size="lg" color={completionPct === 100 ? 'green' : 'blue'} variant="light">
            %{completionPct}
          </Badge>
        </Group>
        <Progress
          value={completionPct}
          size="lg"
          radius="xl"
          color={completionPct === 100 ? 'green' : 'blue'}
          mb="md"
        />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {SECTIONS.filter((s) => s.id !== 'ozet').map((section) => {
            const status = completionMap[section.id];
            return (
              <Paper
                key={section.id}
                p="sm"
                radius="md"
                withBorder
                style={{
                  cursor: 'pointer',
                  borderColor: `var(--mantine-color-${statusColor(status)}-6)`,
                }}
                onClick={() => setActiveSection(section.id)}
              >
                <Group gap="sm">
                  <ThemeIcon size={32} radius="md" variant="light" color={statusColor(status)}>
                    {SECTION_ICONS[section.icon]}
                  </ThemeIcon>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>
                      {section.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {section.description}
                    </Text>
                  </Box>
                  <Badge size="xs" color={statusColor(status)} variant="light">
                    {statusLabel(status)}
                  </Badge>
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>
      </Paper>

      {/* ─── Uyarılar ─── */}
      {warnings.length > 0 && (
        <Paper
          p="lg"
          withBorder
          radius="md"
          bg="rgba(255, 107, 107, 0.05)"
          style={{ borderColor: 'var(--mantine-color-red-7)' }}
        >
          <Group gap="xs" mb="sm">
            <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" />
            <Text size="md" fw={600} c="red">
              Dikkat Edilmesi Gerekenler
            </Text>
          </Group>
          <Stack gap={4}>
            {warnings.map((w) => (
              <Group key={w} gap="xs">
                <Text size="xs" c="red">
                  •
                </Text>
                <Text size="sm" c="red.3">
                  {w}
                </Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      {/* ─── Finansal Özet ─── */}
      <Paper p="lg" withBorder radius="md">
        <Text size="md" fw={600} mb="md">
          Finansal Özet
        </Text>

        {/* Maliyet Dağılımı */}
        <Stack gap={6} mb="md">
          {[
            { label: 'Öğün Maliyeti', tutar: md.malzeme.tutar, color: 'green' },
            { label: 'Personel', tutar: md.personel.tutar, color: 'blue' },
            { label: 'Nakliye', tutar: md.nakliye.tutar, color: 'cyan' },
            { label: 'Sarf Malzeme', tutar: md.sarf_malzeme.tutar, color: 'teal' },
            { label: 'Ekipman & Bakım', tutar: md.ekipman_bakim.tutar, color: 'violet' },
            { label: 'Genel Gider', tutar: md.genel_gider.tutar, color: 'yellow' },
            { label: 'Yasal Giderler', tutar: md.yasal_giderler.tutar, color: 'orange' },
            { label: 'Risk Payı', tutar: md.risk_payi.tutar, color: 'red' },
          ].map((item) => (
            <Group key={item.label} justify="space-between">
              <Group gap="xs">
                <Box
                  w={10}
                  h={10}
                  style={{
                    borderRadius: '50%',
                    background: `var(--mantine-color-${item.color}-6)`,
                  }}
                />
                <Text size="sm">{item.label}</Text>
              </Group>
              <Text size="sm" fw={500}>
                {item.tutar > 0 ? formatPara(item.tutar) : '—'}
              </Text>
            </Group>
          ))}
        </Stack>

        <Divider my="sm" />

        {/* Toplamlar */}
        <Stack gap={6}>
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Toplam Maliyet
            </Text>
            <Text size="sm" fw={600}>
              {maliyetToplam > 0 ? formatPara(maliyetToplam) : '—'}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Kâr (%{karOrani})
            </Text>
            <Text size="sm" fw={500} c="green">
              {karTutari > 0 ? `+${formatPara(karTutari)}` : '—'}
            </Text>
          </Group>

          <Divider my={4} />

          <Group justify="space-between">
            <Text size="lg" fw={700}>
              TEKLİF FİYATI
            </Text>
            <Text size="lg" fw={700} c={riskAnalizi.isAsiriDusuk ? 'red' : 'green'}>
              {teklifFiyati > 0 ? formatPara(teklifFiyati) : '—'}
            </Text>
          </Group>

          {cetvelToplami > 0 && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Cetvel Toplamı
              </Text>
              <Text size="sm" fw={500}>
                {formatPara(cetvelToplami)}
              </Text>
            </Group>
          )}
        </Stack>
      </Paper>

      {/* ─── Risk & Teminat ─── */}
      {(hesaplamaState.yaklasikMaliyet > 0 || hesaplamaState.bizimTeklif > 0) && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {/* Risk */}
          <Paper p="lg" withBorder radius="md">
            <Text size="md" fw={600} mb="md">
              Risk Değerlendirmesi
            </Text>
            <Stack gap={6}>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Yaklaşık Maliyet
                </Text>
                <Text size="sm" fw={500}>
                  {formatPara(hesaplamaState.yaklasikMaliyet)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Sınır Değer
                </Text>
                <Text size="sm" fw={500} c="blue">
                  {aktifSinirDeger > 0 ? formatPara(aktifSinirDeger) : '—'}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Bizim Teklif
                </Text>
                <Text size="sm" fw={500} c={riskAnalizi.isAsiriDusuk ? 'red' : 'green'}>
                  {hesaplamaState.bizimTeklif > 0 ? formatPara(hesaplamaState.bizimTeklif) : '—'}
                </Text>
              </Group>
              {riskAnalizi.fark !== 0 && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Fark
                  </Text>
                  <Text size="sm" fw={500} c={riskAnalizi.fark >= 0 ? 'green' : 'red'}>
                    {riskAnalizi.fark >= 0 ? '+' : ''}
                    {formatPara(riskAnalizi.fark)} ({riskAnalizi.farkYuzde.toFixed(1)}%)
                  </Text>
                </Group>
              )}
              {riskAnalizi.isAsiriDusuk && (
                <Badge color="red" variant="light" size="lg" mt="xs" fullWidth>
                  AŞIRI DÜŞÜK TEKLİF RİSKİ
                </Badge>
              )}
            </Stack>
          </Paper>

          {/* Teminat */}
          {hesaplamaState.bizimTeklif > 0 && (
            <Paper p="lg" withBorder radius="md">
              <Text size="md" fw={600} mb="md">
                Teminat Tutarları
              </Text>
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Geçici Teminat (%3)
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatPara(teminatlar.geciciTeminat)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Kesin Teminat (%6)
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatPara(teminatlar.kesinTeminat)}
                  </Text>
                </Group>
                <Divider my={4} />
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    Toplam Teminat
                  </Text>
                  <Text size="sm" fw={600}>
                    {formatPara(teminatlar.geciciTeminat + teminatlar.kesinTeminat)}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          )}
        </SimpleGrid>
      )}
    </Stack>
  );
}
