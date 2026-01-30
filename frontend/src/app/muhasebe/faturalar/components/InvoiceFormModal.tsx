/**
 * InvoiceFormModal Component
 * Yeni fatura oluşturma ve düzenleme modal'ı
 */

'use client';

import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import StyledDatePicker from '@/components/ui/StyledDatePicker';
import { formatMoney } from '@/lib/formatters';
import type { Cari, Fatura, FaturaKalem, FaturaTip } from '../types';
import { BIRIMLER, KDV_ORANLARI } from '../types';

interface InvoiceFormModalProps {
  opened: boolean;
  onClose: () => void;
  isMobile: boolean;

  // Form data
  formData: {
    tip: 'satis' | 'alis';
    seri: string;
    no: string;
    cariId: string;
    cariUnvan: string;
    tarih: Date;
    vadeTarihi: Date;
    durum: Fatura['durum'];
    notlar: string;
  };
  setFormData: (data: any) => void;

  // Kalemler
  kalemler: FaturaKalem[];
  addKalem: () => void;
  removeKalem: (id: string) => void;
  updateKalem: (id: string, field: string, value: string | number) => void;

  // Cariler
  cariler: Cari[];

  // Actions
  onSubmit: () => void;
  onReset: () => void;
}

const birimler = [...BIRIMLER];
const kdvOranlari = [...KDV_ORANLARI];

export function InvoiceFormModal({
  opened,
  onClose,
  isMobile,
  formData,
  setFormData,
  kalemler,
  addKalem,
  removeKalem,
  updateKalem,
  cariler,
  onSubmit,
  onReset,
}: InvoiceFormModalProps) {
  // Toplamları hesapla
  const araToplam = kalemler.reduce((acc, k) => acc + k.tutar, 0);
  const kdvToplam = kalemler.reduce((acc, k) => acc + (k.tutar * k.kdvOrani) / 100, 0);
  const genelToplam = araToplam + kdvToplam;

  const handleClose = () => {
    onReset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="📄 Yeni Fatura"
      size="xl"
      fullScreen={isMobile}
    >
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Fatura Tipi"
            data={[
              { label: '📤 Satış Faturası', value: 'satis' },
              { label: '📥 Alış Faturası', value: 'alis' },
            ]}
            value={formData.tip}
            onChange={(v) =>
              setFormData({
                ...formData,
                tip: (v as FaturaTip) ?? 'satis',
                seri: v === 'satis' ? 'A' : 'B',
              })
            }
          />
          <Select
            label="Cari"
            placeholder="Cari seçin"
            data={cariler.map((c) => ({ label: c.unvan, value: String(c.id) }))}
            value={formData.cariId}
            onChange={(v) => setFormData({ ...formData, cariId: v || '' })}
            searchable
            required
          />
        </SimpleGrid>

        <SimpleGrid cols={4}>
          <TextInput
            label="Seri"
            value={formData.seri}
            onChange={(e) => setFormData({ ...formData, seri: e.currentTarget.value })}
          />
          <TextInput
            label="No"
            placeholder="Otomatik"
            value={formData.no}
            onChange={(e) => setFormData({ ...formData, no: e.currentTarget.value })}
          />
          <StyledDatePicker
            label="Tarih"
            value={formData.tarih}
            onChange={(v) => setFormData({ ...formData, tarih: v || new Date() })}
          />
          <StyledDatePicker
            label="Vade Tarihi"
            value={formData.vadeTarihi}
            onChange={(v) => setFormData({ ...formData, vadeTarihi: v || new Date() })}
          />
        </SimpleGrid>

        <Divider label="Kalemler" labelPosition="center" />

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '35%' }}>Açıklama</Table.Th>
              <Table.Th>Miktar</Table.Th>
              <Table.Th>Birim</Table.Th>
              <Table.Th>B.Fiyat</Table.Th>
              <Table.Th>KDV %</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {kalemler.map((kalem) => (
              <Table.Tr key={kalem.id}>
                <Table.Td>
                  <TextInput
                    size="xs"
                    placeholder="Ürün/hizmet açıklaması"
                    value={kalem.aciklama}
                    onChange={(e) => updateKalem(kalem.id, 'aciklama', e.currentTarget.value)}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    value={kalem.miktar}
                    onChange={(v) => updateKalem(kalem.id, 'miktar', v)}
                    min={1}
                    style={{ width: 70 }}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    data={birimler}
                    value={kalem.birim}
                    onChange={(v) => updateKalem(kalem.id, 'birim', v ?? '')}
                    style={{ width: 90 }}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    value={kalem.birimFiyat}
                    onChange={(v) => updateKalem(kalem.id, 'birimFiyat', v)}
                    min={0}
                    decimalScale={2}
                    style={{ width: 100 }}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    data={kdvOranlari.map((k) => ({ label: `%${k}`, value: k.toString() }))}
                    value={kalem.kdvOrani.toString()}
                    onChange={(v) => updateKalem(kalem.id, 'kdvOrani', Number(v))}
                    style={{ width: 70 }}
                  />
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={500}>
                    {formatMoney(kalem.tutar)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => removeKalem(kalem.id)}
                    disabled={kalemler.length === 1}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={addKalem}
        >
          Kalem Ekle
        </Button>

        <Paper withBorder p="md" radius="md">
          <SimpleGrid cols={3}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Ara Toplam:
              </Text>
              <Text size="sm" fw={500}>
                {formatMoney(araToplam)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                KDV Toplam:
              </Text>
              <Text size="sm" fw={500}>
                {formatMoney(kdvToplam)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                Genel Toplam:
              </Text>
              <Text size="lg" fw={700} c="violet">
                {formatMoney(genelToplam)}
              </Text>
            </Group>
          </SimpleGrid>
        </Paper>

        <Textarea
          label="Notlar"
          placeholder="Ek notlar..."
          rows={2}
          value={formData.notlar}
          onChange={(e) => setFormData({ ...formData, notlar: e.currentTarget.value })}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose}>
            İptal
          </Button>
          <Button color="violet" onClick={onSubmit}>
            Kaydet
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
