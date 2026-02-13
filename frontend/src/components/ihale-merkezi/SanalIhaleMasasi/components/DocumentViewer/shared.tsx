/**
 * DocumentViewer — Shared UI primitives used across tabs
 */

import { Badge, Box, Divider, Group, Stack, Table, Text } from '@mantine/core';
import type { AnalysisData } from '../../../types';
import { DARK_TABLE_STYLES, isOgunTable } from './helpers';

// ─── Section Block ──────────────────────────────────────────

export function SectionBlock({
  title,
  count,
  badge,
  children,
}: {
  title: string;
  count?: number;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Group gap="xs" mb={8}>
        <Text size="xs" fw={700} c="white" tt="uppercase" style={{ letterSpacing: 0.8 }}>
          {title}
        </Text>
        {count !== undefined && (
          <Badge size="xs" variant="light" color="gray" radius="sm">
            {count}
          </Badge>
        )}
        {badge && (
          <Badge size="xs" variant="light" color="cyan" radius="sm">
            {badge}
          </Badge>
        )}
      </Group>
      <Divider color="rgba(255,255,255,0.04)" mb={8} />
      {children}
    </Box>
  );
}

// ─── Data Row ───────────────────────────────────────────────

export function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Box
      p={8}
      style={{
        background: highlight ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        borderLeft: `2px solid ${highlight ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <Text size="10px" c="dimmed" fw={600} tt="uppercase" mb={2}>
        {label}
      </Text>
      <Text
        size="xs"
        c={highlight ? 'green.3' : 'gray.3'}
        fw={highlight ? 600 : 400}
        style={{ lineHeight: 1.5, wordBreak: 'break-word' }}
      >
        {value}
      </Text>
    </Box>
  );
}

// ─── Mini Stat ──────────────────────────────────────────────

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Text size="9px" c="dimmed" fw={600} w={50}>
        {label}
      </Text>
      <Text size="9px" c="gray.4" fw={500}>
        {value}
      </Text>
    </Group>
  );
}

// ─── Empty Tab ──────────────────────────────────────────────

export function EmptyTab({ message = 'Veri bulunamadi' }: { message?: string }) {
  return (
    <Text size="xs" c="dimmed" ta="center" py="xl">
      {message}
    </Text>
  );
}

// ─── Ogun Section ───────────────────────────────────────────

export function OgunSection({ data }: { data: AnalysisData }) {
  if (!data.ogun_bilgileri?.length) return null;
  return (
    <SectionBlock title="Ogun Bilgileri" count={data.ogun_bilgileri.length}>
      <Stack gap={8}>
        {data.ogun_bilgileri.map((ogun) => {
          if (isOgunTable(ogun)) {
            return (
              <Box key={`ogun-tbl-${ogun.headers.join('-')}`}>
                <Table withTableBorder withColumnBorders highlightOnHover styles={DARK_TABLE_STYLES}>
                  <Table.Thead>
                    <Table.Tr>
                      {ogun.headers.map((h) => (
                        <Table.Th key={h}>{h}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {ogun.rows.map((row) => (
                      <Table.Tr key={row.join('-')}>
                        {row.map((cell) => (
                          <Table.Td key={cell}>{cell}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
            );
          }
          if (!ogun.tur) return null;
          return (
            <DataRow
              key={`ogun-${ogun.tur}`}
              label={`Ogun: ${ogun.tur}`}
              value={ogun.miktar ? `${ogun.miktar} ${ogun.birim || 'kisi'}` : 'Detay mevcut'}
            />
          );
        })}
      </Stack>
    </SectionBlock>
  );
}

// ─── Servis Saatleri Section ────────────────────────────────

export function ServisSaatleriSection({ data }: { data: AnalysisData }) {
  const has = data.servis_saatleri?.kahvalti || data.servis_saatleri?.ogle || data.servis_saatleri?.aksam;
  if (!has) return null;
  return (
    <SectionBlock title="Servis Saatleri">
      <Stack gap={6}>
        {data.servis_saatleri?.kahvalti && <DataRow label="Kahvalti" value={data.servis_saatleri.kahvalti} />}
        {data.servis_saatleri?.ogle && <DataRow label="Ogle" value={data.servis_saatleri.ogle} />}
        {data.servis_saatleri?.aksam && <DataRow label="Aksam" value={data.servis_saatleri.aksam} />}
      </Stack>
    </SectionBlock>
  );
}
