/**
 * SayimModal - Stok Sayım Modalı
 */

'use client';

import { Alert, Badge, Button, Group, Modal, NumberInput, Select, Stack, Table, Text } from '@mantine/core';
import { IconCheck, IconClipboardList } from '@tabler/icons-react';

import type { Depo, StokItem } from '../../types';

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

interface SayimModalProps {
  opened: boolean;
  onClose: () => void;
  depolar: Depo[];
  filteredStoklar: StokItem[];
  sayimDepoId: number | null;
  sayimVerileri: { [key: number]: number };
  setSayimVerileri: (
    veriler: { [key: number]: number } | ((prev: { [key: number]: number }) => { [key: number]: number })
  ) => void;
  onDepoSelect: (depoId: number) => Promise<void>;
  onSave: () => Promise<void>;
  loading?: boolean;
}

export default function SayimModal({
  opened,
  onClose,
  depolar,
  filteredStoklar,
  sayimDepoId,
  sayimVerileri,
  setSayimVerileri,
  onDepoSelect,
  onSave,
  loading = false,
}: SayimModalProps) {
  const handleClose = () => {
    setSayimVerileri({});
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconClipboardList size={20} color="orange" />
          <Text fw={600}>Stok Sayımı</Text>
        </Group>
      }
      size="xl"
    >
      <Stack gap="md">
        <Select
          label="Sayım Yapılacak Depo"
          placeholder="Depo seçin"
          data={depolar.map((d) => ({ value: String(d.id), label: d.ad }))}
          value={sayimDepoId ? String(sayimDepoId) : null}
          onChange={(val) => val && onDepoSelect(parseInt(val, 10))}
          required
        />

        {sayimDepoId && (
          <>
            <Alert color="blue" variant="light">
              Fiziksel sayım sonuçlarını girin. Farklar otomatik hesaplanacak ve kaydedilecek.
            </Alert>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ürün</Table.Th>
                  <Table.Th>Sistem Stok</Table.Th>
                  <Table.Th>Sayım</Table.Th>
                  <Table.Th>Fark</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredStoklar.map((item) => {
                  const sistemStok = item.toplam_stok || 0;
                  const sayimStok = sayimVerileri[item.id] ?? sistemStok;
                  const fark = sayimStok - sistemStok;

                  return (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {item.ad}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {item.kod}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {formatMiktar(sistemStok)} {item.birim}
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          value={sayimStok}
                          onChange={(val) => setSayimVerileri({ ...sayimVerileri, [item.id]: Number(val) || 0 })}
                          min={0}
                          decimalScale={3}
                          style={{ width: 100 }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Badge color={fark === 0 ? 'gray' : fark > 0 ? 'green' : 'red'} variant="light">
                          {fark > 0 ? '+' : ''}
                          {formatMiktar(fark)} {item.birim}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            <Group justify="flex-end">
              <Button variant="light" onClick={handleClose}>
                İptal
              </Button>
              <Button color="orange" onClick={onSave} loading={loading} leftSection={<IconCheck size={16} />}>
                Sayımı Kaydet
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
