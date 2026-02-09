'use client';

import {
  Badge,
  Box,
  Divider,
  Group,
  NavLink,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalculator,
  IconCheck,
  IconCheckbox,
  IconCircleDashed,
  IconFileSpreadsheet,
  IconScale,
  IconSparkles,
} from '@tabler/icons-react';
import { formatDate } from '@/lib/formatters';
import { formatPara, formatParaKisa } from '../../teklif/hesaplamalar';
import type { UseTeklifMerkeziReturn } from './hooks/useTeklifMerkezi';
import type { SectionCompletionStatus } from './types';
import { SECTIONS } from './types';

interface SidebarProps {
  ctx: UseTeklifMerkeziReturn;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  sparkles: <IconSparkles size={18} />,
  calculator: <IconCalculator size={18} />,
  scale: <IconScale size={18} />,
  table: <IconFileSpreadsheet size={18} />,
  check: <IconCheckbox size={18} />,
};

function CompletionIndicator({ status }: { status: SectionCompletionStatus }) {
  switch (status) {
    case 'complete':
      return (
        <ThemeIcon size={20} radius="xl" color="green" variant="filled">
          <IconCheck size={12} />
        </ThemeIcon>
      );
    case 'partial':
      return (
        <ThemeIcon size={20} radius="xl" color="yellow" variant="light">
          <IconCircleDashed size={12} />
        </ThemeIcon>
      );
    case 'warning':
      return (
        <ThemeIcon size={20} radius="xl" color="red" variant="light">
          <IconAlertTriangle size={12} />
        </ThemeIcon>
      );
    default:
      return (
        <ThemeIcon size={20} radius="xl" color="dark" variant="light">
          <IconCircleDashed size={12} />
        </ThemeIcon>
      );
  }
}

export function TeklifMerkeziSidebar({ ctx }: SidebarProps) {
  const {
    activeSection,
    setActiveSection,
    completionMap,
    hesaplanmisTeklifData,
    hesaplamaState,
    aktifSinirDeger,
    riskAnalizi,
    tender,
  } = ctx;

  const maliyetToplam = hesaplanmisTeklifData.maliyet_toplam;
  const teklifFiyati = hesaplanmisTeklifData.teklif_fiyati;
  const karOrani = hesaplanmisTeklifData.kar_orani;

  return (
    <Box
      style={{
        width: 260,
        minWidth: 260,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--mantine-color-dark-8)',
        borderRight: '1px solid var(--mantine-color-dark-5)',
      }}
    >
      {/* ─── İhale Bilgileri ─── */}
      <Box p="md" pb="sm">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
          İhale
        </Text>
        <Tooltip label={tender.ihale_basligi} multiline maw={300}>
          <Text size="sm" fw={600} lineClamp={2} lh={1.3}>
            {tender.ihale_basligi}
          </Text>
        </Tooltip>
        <Text size="xs" c="dimmed" mt={4} lineClamp={1}>
          {tender.kurum}
        </Text>
        {tender.external_id && (
          <Text size="xs" c="dimmed" mt={2}>
            {tender.external_id}
          </Text>
        )}
        {tender.tarih && (
          <Badge size="xs" variant="light" color="blue" mt={6}>
            {formatDate(tender.tarih, 'short')}
          </Badge>
        )}
      </Box>

      <Divider color="dark.5" />

      {/* ─── Navigation ─── */}
      <Box style={{ flex: 1, overflow: 'auto' }} py="xs">
        {SECTIONS.map((section) => (
          <NavLink
            key={section.id}
            label={section.label}
            description={section.description}
            leftSection={
              <ThemeIcon
                size={30}
                radius="md"
                variant={activeSection === section.id ? 'filled' : 'light'}
                color={activeSection === section.id ? 'blue' : 'dark'}
              >
                {SECTION_ICONS[section.icon]}
              </ThemeIcon>
            }
            rightSection={<CompletionIndicator status={completionMap[section.id]} />}
            active={activeSection === section.id}
            onClick={() => setActiveSection(section.id)}
            styles={{
              root: {
                borderRadius: 0,
                borderLeft:
                  activeSection === section.id
                    ? '3px solid var(--mantine-color-blue-6)'
                    : '3px solid transparent',
                '&:hover': {
                  background: 'var(--mantine-color-dark-7)',
                },
              },
              label: { fontSize: 13, fontWeight: activeSection === section.id ? 600 : 400 },
              description: { fontSize: 11 },
            }}
          />
        ))}
      </Box>

      <Divider color="dark.5" />

      {/* ─── Canlı Finansal Özet ─── */}
      <Box p="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
          Finansal Özet
        </Text>
        <Stack gap={6}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Toplam Maliyet
            </Text>
            <Text size="xs" fw={500}>
              {maliyetToplam > 0 ? formatParaKisa(maliyetToplam) : '—'}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Kâr %{karOrani}
            </Text>
            <Text size="xs" fw={500}>
              {hesaplanmisTeklifData.kar_tutari > 0
                ? formatParaKisa(hesaplanmisTeklifData.kar_tutari)
                : '—'}
            </Text>
          </Group>

          <Divider color="dark.5" my={4} />

          {/* Teklif Fiyatı - büyük gösterim */}
          <Paper
            p="xs"
            radius="md"
            bg={riskAnalizi.isAsiriDusuk ? 'rgba(255, 107, 107, 0.1)' : 'rgba(81, 207, 102, 0.1)'}
            style={{
              borderColor: riskAnalizi.isAsiriDusuk
                ? 'var(--mantine-color-red-7)'
                : 'var(--mantine-color-green-7)',
              border: '1px solid',
            }}
          >
            <Text size="xs" c="dimmed" ta="center">
              Teklif Fiyatı
            </Text>
            <Text size="lg" fw={700} ta="center" c={riskAnalizi.isAsiriDusuk ? 'red' : 'green'}>
              {teklifFiyati > 0 ? formatPara(teklifFiyati) : '—'}
            </Text>
          </Paper>

          {/* Sınır değer karşılaştırma */}
          {aktifSinirDeger > 0 && hesaplamaState.bizimTeklif > 0 && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Sınır Değer
              </Text>
              <Badge
                size="xs"
                color={riskAnalizi.isAsiriDusuk ? 'red' : 'green'}
                variant="light"
                leftSection={
                  riskAnalizi.isAsiriDusuk ? (
                    <IconAlertTriangle size={10} />
                  ) : (
                    <IconCheck size={10} />
                  )
                }
              >
                {riskAnalizi.isAsiriDusuk ? 'ALTINDA' : 'ÜSTÜNDE'}
              </Badge>
            </Group>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
