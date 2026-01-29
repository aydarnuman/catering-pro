'use client';

import {
  ActionIcon,
  Box,
  Card,
  Collapse,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { memo, type ReactNode, useCallback, useMemo } from 'react';
import { EmptyState, LoadingState } from '@/components/common';
import { useResponsive } from '@/hooks/useResponsive';

interface Column<T> {
  key: keyof T | string;
  label: string;
  // Mobilde gösterilsin mi? (false = sadece expanded'da görünür)
  showOnMobile?: boolean;
  // Render fonksiyonu
  render?: (item: T) => ReactNode;
  // Mobil kart başlığı olarak kullanılsın mı?
  isPrimaryField?: boolean;
  // Genişlik
  width?: number | string;
  // Hizalama
  align?: 'left' | 'center' | 'right';
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  // Satır tıklandığında
  onRowClick?: (item: T) => void;
  // Satır aksiyonları
  actions?: (item: T) => ReactNode;
  // Yükleniyor mu?
  loading?: boolean;
  // Boş mesaj
  emptyMessage?: string;
  // Satır key'i
  getRowKey: (item: T) => string | number;
  // Mobil kart rengi
  mobileCardColor?: string;
}

/**
 * Responsive Tablo Bileşeni
 * - Desktop: Normal tablo görünümü
 * - Mobile: Kart görünümü (expandable)
 */
export function ResponsiveTable<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  actions,
  loading,
  emptyMessage = 'Veri bulunamadı',
  getRowKey,
  mobileCardColor,
}: ResponsiveTableProps<T>) {
  const { isMobile } = useResponsive();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  if (loading) {
    return <LoadingState loading={true} message="Yükleniyor..." />;
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} compact />;
  }

  // Desktop: Normal tablo
  if (!isMobile) {
    return (
      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {columns.map((col) => (
                <Table.Th
                  key={String(col.key)}
                  style={{
                    width: col.width,
                    textAlign: col.align || 'left',
                  }}
                >
                  {col.label}
                </Table.Th>
              ))}
              {actions && <Table.Th style={{ width: 100 }}>İşlemler</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr
                key={getRowKey(item)}
                style={{ cursor: onRowClick ? 'pointer' : undefined }}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <Table.Td key={String(col.key)} style={{ textAlign: col.align || 'left' }}>
                    {col.render ? col.render(item) : (item[col.key as keyof T] as ReactNode)}
                  </Table.Td>
                ))}
                {actions && (
                  <Table.Td onClick={(e) => e.stopPropagation()}>{actions(item)}</Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    );
  }

  // Mobile: Kart görünümü
  return (
    <Stack gap="sm">
      {data.map((item) => (
        <MobileCard
          key={getRowKey(item)}
          item={item}
          columns={columns}
          onRowClick={onRowClick}
          actions={actions}
          isDark={isDark}
          mobileCardColor={mobileCardColor}
        />
      ))}
    </Stack>
  );
}

// Mobil kart bileşeni - React.memo ile sarılmış
interface MobileCardProps<T> {
  item: T;
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  actions?: (item: T) => ReactNode;
  isDark: boolean;
  mobileCardColor?: string;
}

function MobileCardComponent<T extends Record<string, unknown>>({
  item,
  columns,
  onRowClick,
  actions,
  isDark,
  mobileCardColor,
}: MobileCardProps<T>) {
  const [opened, { toggle }] = useDisclosure(false);

  // Primary field (başlık) - useMemo ile cache'le
  const primaryColumn = useMemo(() => columns.find((c) => c.isPrimaryField), [columns]);
  // Mobilde gösterilecek alanlar - useMemo ile cache'le
  const mobileVisibleColumns = useMemo(
    () => columns.filter((c) => c.showOnMobile !== false),
    [columns]
  );
  // Sadece expanded'da gösterilecek alanlar - useMemo ile cache'le
  const expandedColumns = useMemo(() => columns.filter((c) => c.showOnMobile === false), [columns]);

  // Click handler - useCallback ile cache'le
  const handleCardClick = useCallback(() => {
    onRowClick?.(item);
  }, [onRowClick, item]);

  const handleToggleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggle();
    },
    [toggle]
  );

  const handleActionsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Card
      shadow="sm"
      padding="sm"
      radius="md"
      withBorder
      style={{
        borderLeft: mobileCardColor ? `3px solid ${mobileCardColor}` : undefined,
        cursor: onRowClick ? 'pointer' : undefined,
      }}
      onClick={handleCardClick}
    >
      {/* Kart Header */}
      <Group justify="space-between" mb="xs">
        <Box style={{ flex: 1 }}>
          {primaryColumn && (
            <Text fw={600} size="sm" lineClamp={2}>
              {primaryColumn.render
                ? primaryColumn.render(item)
                : (item[primaryColumn.key as keyof T] as ReactNode)}
            </Text>
          )}
        </Box>
        {expandedColumns.length > 0 && (
          <ActionIcon variant="subtle" size="sm" onClick={handleToggleClick}>
            {opened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </ActionIcon>
        )}
      </Group>

      {/* Mobilde görünen alanlar */}
      <Stack gap={4}>
        {mobileVisibleColumns
          .filter((c) => !c.isPrimaryField)
          .slice(0, 3) // İlk 3 alanı göster
          .map((col) => (
            <Group key={String(col.key)} gap="xs" wrap="nowrap">
              <Text size="xs" c="dimmed" style={{ minWidth: 80 }}>
                {col.label}:
              </Text>
              <Text size="xs" lineClamp={1}>
                {col.render ? col.render(item) : (item[col.key as keyof T] as ReactNode)}
              </Text>
            </Group>
          ))}
      </Stack>

      {/* Expanded alanlar */}
      <Collapse in={opened}>
        <Box
          mt="sm"
          pt="sm"
          style={{
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}
        >
          <Stack gap={4}>
            {/* Mobilde görünmeyen diğer alanlar */}
            {mobileVisibleColumns.slice(3).map((col) => (
              <Group key={String(col.key)} gap="xs" wrap="nowrap">
                <Text size="xs" c="dimmed" style={{ minWidth: 80 }}>
                  {col.label}:
                </Text>
                <Text size="xs">
                  {col.render ? col.render(item) : (item[col.key as keyof T] as ReactNode)}
                </Text>
              </Group>
            ))}
            {/* Sadece expanded'da görünen alanlar */}
            {expandedColumns.map((col) => (
              <Group key={String(col.key)} gap="xs" wrap="nowrap">
                <Text size="xs" c="dimmed" style={{ minWidth: 80 }}>
                  {col.label}:
                </Text>
                <Text size="xs">
                  {col.render ? col.render(item) : (item[col.key as keyof T] as ReactNode)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Box>
      </Collapse>

      {/* Aksiyonlar */}
      {actions && (
        <Box
          mt="sm"
          pt="sm"
          style={{
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}
          onClick={handleActionsClick}
        >
          {actions(item)}
        </Box>
      )}
    </Card>
  );
}

// MobileCard'ı React.memo ile sar - gereksiz re-render'ları önle
const MobileCard = memo(MobileCardComponent) as typeof MobileCardComponent;

export type { Column };
