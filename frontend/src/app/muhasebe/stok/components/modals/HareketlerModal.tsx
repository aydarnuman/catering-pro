/**
 * HareketlerModal - Stok Hareketleri Listesi Modalı
 */

'use client';

import { Badge, Group, LoadingOverlay, Modal, Table, Text } from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';
import { EmptyState } from '@/components/common';

import type { StokHareket } from '../../types';

// Miktar formatı
const formatMiktar = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '0';
  if (Number.isInteger(num)) {
    return num.toLocaleString('tr-TR');
  }
  return num.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

interface HareketlerModalProps {
  opened: boolean;
  onClose: () => void;
  hareketler: StokHareket[];
  loading?: boolean;
}

export default function HareketlerModal({
  opened,
  onClose,
  hareketler,
  loading = false,
}: HareketlerModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconHistory size={20} />
          <Text fw={600}>Stok Hareketleri</Text>
        </Group>
      }
      size="xl"
    >
      <LoadingOverlay visible={loading} />
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tarih</Table.Th>
            <Table.Th>Ürün</Table.Th>
            <Table.Th>Tür</Table.Th>
            <Table.Th>Miktar</Table.Th>
            <Table.Th>Depo</Table.Th>
            <Table.Th>Belge</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {hareketler.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <EmptyState
                  title="Henüz hareket kaydı yok"
                  compact
                  icon={<IconHistory size={24} />}
                  iconColor="gray"
                />
              </Table.Td>
            </Table.Tr>
          ) : (
            hareketler.map((h) => (
              <Table.Tr key={h.id}>
                <Table.Td>
                  <Text size="sm">{new Date(h.created_at).toLocaleDateString('tr-TR')}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {h.stok_ad || h.stok_kart_id}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={
                      h.hareket_tipi === 'GIRIS'
                        ? 'green'
                        : h.hareket_tipi === 'CIKIS'
                          ? 'red'
                          : 'blue'
                    }
                    variant="light"
                  >
                    {h.hareket_tipi}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={h.hareket_yonu === '+' ? 'green' : 'red'} fw={500}>
                    {h.hareket_yonu === '+' ? '+' : '-'}
                    {formatMiktar(h.miktar)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{h.giris_depo_ad || h.cikis_depo_ad || '-'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {h.belge_no || '-'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Modal>
  );
}
