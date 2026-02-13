/**
 * TransferModal - Depolar Arası Transfer Modalı
 */

'use client';

import { Button, Group, Modal, NumberInput, Select, Stack, Textarea, TextInput } from '@mantine/core';

import type { Depo, StokItem, TransferForm } from '../../types';

interface TransferModalProps {
  opened: boolean;
  onClose: () => void;
  transferForm: TransferForm;
  setTransferForm: (form: TransferForm | ((prev: TransferForm) => TransferForm)) => void;
  stoklar: StokItem[];
  depolar: Depo[];
  onTransfer: () => Promise<void>;
  loading?: boolean;
}

export default function TransferModal({
  opened,
  onClose,
  transferForm,
  setTransferForm,
  stoklar,
  depolar,
  onTransfer,
  loading = false,
}: TransferModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Depolar Arası Transfer" size="md">
      <Stack>
        <Select
          label="Ürün"
          placeholder="Transfer edilecek ürünü seçin"
          data={stoklar.map((s) => ({ value: s.id.toString(), label: `${s.kod} - ${s.ad}` }))}
          value={transferForm.stok_kart_id?.toString()}
          onChange={(value) =>
            setTransferForm({
              ...transferForm,
              stok_kart_id: parseInt(value || '0', 10),
            })
          }
          required
          searchable
        />

        <Select
          label="Kaynak Depo"
          placeholder="Çıkış yapılacak depo"
          data={depolar.map((d) => ({ value: d.id.toString(), label: d.ad }))}
          value={transferForm.kaynak_depo_id?.toString()}
          onChange={(value) =>
            setTransferForm({
              ...transferForm,
              kaynak_depo_id: parseInt(value || '0', 10),
            })
          }
          required
        />

        <Select
          label="Hedef Depo"
          placeholder="Giriş yapılacak depo"
          data={depolar.map((d) => ({ value: d.id.toString(), label: d.ad }))}
          value={transferForm.hedef_depo_id?.toString()}
          onChange={(value) =>
            setTransferForm({
              ...transferForm,
              hedef_depo_id: parseInt(value || '0', 10),
            })
          }
          required
        />

        <NumberInput
          label="Miktar"
          placeholder="Transfer edilecek miktar"
          value={transferForm.miktar}
          onChange={(value) => setTransferForm({ ...transferForm, miktar: Number(value) })}
          min={0}
          required
        />

        <TextInput
          label="Belge No"
          placeholder="Transfer belge numarası"
          value={transferForm.belge_no}
          onChange={(e) => setTransferForm({ ...transferForm, belge_no: e.target.value })}
        />

        <Textarea
          label="Açıklama"
          placeholder="Transfer açıklaması"
          value={transferForm.aciklama}
          onChange={(e) => setTransferForm({ ...transferForm, aciklama: e.target.value })}
        />

        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={onTransfer} loading={loading}>
            Transfer Yap
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
