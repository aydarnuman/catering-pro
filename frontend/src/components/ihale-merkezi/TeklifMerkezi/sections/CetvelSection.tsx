'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconFileSpreadsheet, IconPlus, IconTrash } from '@tabler/icons-react';
import { formatPara } from '../../../teklif/hesaplamalar';
import type { UseTeklifMerkeziReturn } from '../hooks/useTeklifMerkezi';

interface CetvelSectionProps {
  ctx: UseTeklifMerkeziReturn;
}

export function CetvelSection({ ctx }: CetvelSectionProps) {
  const {
    hesaplanmisTeklifData,
    handleCetvelBirimFiyatChange,
    handleCetvelMiktarChange,
    handleCetvelIsKalemiChange,
    handleCetvelBirimChange,
    handleCetvelKalemEkle,
    handleCetvelKalemSil,
  } = ctx;

  const cetvel = hesaplanmisTeklifData.birim_fiyat_cetveli;
  const cetvelToplami = hesaplanmisTeklifData.cetvel_toplami;

  return (
    <Stack gap="lg">
      {/* Header */}
      <Paper p="lg" withBorder radius="md">
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <IconFileSpreadsheet size={22} color="var(--mantine-color-blue-6)" />
            <div>
              <Text size="md" fw={600}>
                Birim Fiyat Teklif Cetveli
              </Text>
              <Text size="xs" c="dimmed">
                İhale kalemlerinin birim fiyatlarını belirleyin
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            <Badge size="lg" color="blue" variant="light">
              {cetvel.length} Kalem
            </Badge>
            <Badge size="lg" color="green" variant="light">
              Toplam: {formatPara(cetvelToplami)}
            </Badge>
          </Group>
        </Group>

        {cetvel.length === 0 ? (
          <Box ta="center" py="xl">
            <IconFileSpreadsheet size={48} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed" mt="md">
              Henüz birim fiyat kalemi eklenmemiş
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              AI analizi birim fiyat kalemleri tespit ettiyse otomatik olarak eklenecektir
            </Text>
            <Button
              variant="light"
              color="blue"
              mt="md"
              leftSection={<IconPlus size={16} />}
              onClick={handleCetvelKalemEkle}
            >
              İlk Kalemi Ekle
            </Button>
          </Box>
        ) : (
          <>
            <ScrollArea>
              <Table withTableBorder withColumnBorders striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={50} ta="center">
                      Sıra
                    </Table.Th>
                    <Table.Th miw={250}>İş Kalemi</Table.Th>
                    <Table.Th w={100}>Birim</Table.Th>
                    <Table.Th w={120} ta="right">
                      Miktar
                    </Table.Th>
                    <Table.Th w={140} ta="right">
                      Birim Fiyat (₺)
                    </Table.Th>
                    <Table.Th w={140} ta="right">
                      Tutar (₺)
                    </Table.Th>
                    <Table.Th w={50}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {cetvel.map((kalem, idx) => (
                    <Table.Tr key={kalem.sira}>
                      <Table.Td ta="center">
                        <Text size="sm" c="dimmed">
                          {kalem.sira}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          variant="unstyled"
                          placeholder="İş kalemi açıklaması"
                          value={kalem.isKalemi}
                          onChange={(e) => handleCetvelIsKalemiChange(idx, e.currentTarget.value)}
                          styles={{ input: { fontWeight: 500 } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          variant="unstyled"
                          placeholder="Birim"
                          value={kalem.birim}
                          onChange={(e) => handleCetvelBirimChange(idx, e.currentTarget.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          variant="unstyled"
                          placeholder="0"
                          value={kalem.miktar || ''}
                          onChange={(val) => handleCetvelMiktarChange(idx, Number(val) || 0)}
                          thousandSeparator="."
                          decimalSeparator=","
                          hideControls
                          styles={{ input: { textAlign: 'right' } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          variant="unstyled"
                          placeholder="0,00"
                          value={kalem.birimFiyat || ''}
                          onChange={(val) => handleCetvelBirimFiyatChange(idx, Number(val) || 0)}
                          thousandSeparator="."
                          decimalSeparator=","
                          decimalScale={2}
                          hideControls
                          styles={{ input: { textAlign: 'right', fontWeight: 600 } }}
                        />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={600}>
                          {kalem.tutar > 0
                            ? kalem.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
                            : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          onClick={() => handleCetvelKalemSil(idx)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr>
                    <Table.Td colSpan={5} ta="right">
                      <Text fw={700}>GENEL TOPLAM</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fw={700} size="md" c="green">
                        {formatPara(cetvelToplami)}
                      </Text>
                    </Table.Td>
                    <Table.Td />
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </ScrollArea>

            <Button
              variant="light"
              color="blue"
              mt="md"
              leftSection={<IconPlus size={16} />}
              onClick={handleCetvelKalemEkle}
            >
              Yeni Kalem Ekle
            </Button>
          </>
        )}
      </Paper>
    </Stack>
  );
}
