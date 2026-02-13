/**
 * StokCikisModal - Stok Çıkış Modalı
 */

'use client';

import { Button, Group, Modal, NumberInput, Select, Stack, Text, Textarea } from '@mantine/core';
import { IconTrendingDown } from '@tabler/icons-react';

import type { Depo, StokCikisForm, StokItem } from '../../types';
import { CIKIS_TIPLERI } from '../../types';

interface StokCikisModalProps {
  opened: boolean;
  onClose: () => void;
  cikisForm: StokCikisForm;
  setCikisForm: (form: StokCikisForm | ((prev: StokCikisForm) => StokCikisForm)) => void;
  stoklar: StokItem[];
  depolar: Depo[];
  onCikis: () => Promise<void>;
  loading?: boolean;
}

export default function StokCikisModal({
  opened,
  onClose,
  cikisForm,
  setCikisForm,
  stoklar,
  depolar,
  onCikis,
  loading = false,
}: StokCikisModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconTrendingDown size={20} color="red" />
          <Text fw={600}>Stok Çıkışı</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        <Select
          label="Çıkış Türü"
          placeholder="Seçin"
          data={CIKIS_TIPLERI}
          value={cikisForm.cikis_tipi}
          onChange={(val) => setCikisForm({ ...cikisForm, cikis_tipi: val || 'TUKETIM' })}
        />
        <Select
          label="Depo"
          placeholder="Çıkış yapılacak depo"
          data={depolar.map((d) => ({ value: String(d.id), label: d.ad }))}
          value={cikisForm.depo_id ? String(cikisForm.depo_id) : null}
          onChange={(val) => setCikisForm({ ...cikisForm, depo_id: val ? parseInt(val, 10) : null })}
          required
        />
        <Select
          label="Ürün"
          placeholder="Çıkış yapılacak ürün"
          searchable
          data={stoklar.map((s) => ({ value: String(s.id), label: `${s.kod} - ${s.ad}` }))}
          value={cikisForm.stok_kart_id ? String(cikisForm.stok_kart_id) : null}
          onChange={(val) => setCikisForm({ ...cikisForm, stok_kart_id: val ? parseInt(val, 10) : null })}
          required
        />
        <NumberInput
          label="Miktar"
          placeholder="Çıkış miktarı"
          value={cikisForm.miktar}
          onChange={(val) => setCikisForm({ ...cikisForm, miktar: Number(val) || 0 })}
          min={0.001}
          decimalScale={3}
          required
        />
        <Textarea
          label="Açıklama"
          placeholder="Çıkış nedeni..."
          value={cikisForm.aciklama}
          onChange={(e) => setCikisForm({ ...cikisForm, aciklama: e.target.value })}
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            İptal
          </Button>
          <Button color="red" onClick={onCikis} loading={loading} leftSection={<IconTrendingDown size={16} />}>
            Çıkış Yap
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
