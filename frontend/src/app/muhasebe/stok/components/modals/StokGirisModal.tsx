/**
 * StokGirisModal - Stok Giriş Modalı
 */

'use client';

import { Button, Group, Modal, NumberInput, Select, Stack, Text, Textarea } from '@mantine/core';
import { IconTrendingUp } from '@tabler/icons-react';

import type { Depo, StokGirisForm, StokItem } from '../../types';
import { GIRIS_TIPLERI } from '../../types';

interface StokGirisModalProps {
  opened: boolean;
  onClose: () => void;
  girisForm: StokGirisForm;
  setGirisForm: (form: StokGirisForm | ((prev: StokGirisForm) => StokGirisForm)) => void;
  stoklar: StokItem[];
  depolar: Depo[];
  onGiris: () => Promise<void>;
  loading?: boolean;
}

export default function StokGirisModal({
  opened,
  onClose,
  girisForm,
  setGirisForm,
  stoklar,
  depolar,
  onGiris,
  loading = false,
}: StokGirisModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconTrendingUp size={20} color="green" />
          <Text fw={600}>Stok Girişi</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        <Select
          label="Giriş Türü"
          placeholder="Seçin"
          data={GIRIS_TIPLERI}
          value={girisForm.giris_tipi}
          onChange={(val) => setGirisForm({ ...girisForm, giris_tipi: val || 'SATIN_ALMA' })}
        />
        <Select
          label="Depo"
          placeholder="Giriş yapılacak depo"
          data={depolar.map((d) => ({ value: String(d.id), label: d.ad }))}
          value={girisForm.depo_id ? String(girisForm.depo_id) : null}
          onChange={(val) =>
            setGirisForm({ ...girisForm, depo_id: val ? parseInt(val, 10) : null })
          }
          required
        />
        <Select
          label="Ürün"
          placeholder="Giriş yapılacak ürün"
          searchable
          data={stoklar.map((s) => ({ value: String(s.id), label: `${s.kod} - ${s.ad}` }))}
          value={girisForm.stok_kart_id ? String(girisForm.stok_kart_id) : null}
          onChange={(val) =>
            setGirisForm({ ...girisForm, stok_kart_id: val ? parseInt(val, 10) : null })
          }
          required
        />
        <Group grow>
          <NumberInput
            label="Miktar"
            placeholder="Giriş miktarı"
            value={girisForm.miktar}
            onChange={(val) => setGirisForm({ ...girisForm, miktar: Number(val) || 0 })}
            min={0.001}
            decimalScale={3}
            required
          />
          <NumberInput
            label="Birim Fiyat"
            placeholder="₺"
            value={girisForm.birim_fiyat}
            onChange={(val) => setGirisForm({ ...girisForm, birim_fiyat: Number(val) || 0 })}
            min={0}
            decimalScale={2}
            prefix="₺"
            thousandSeparator="."
            decimalSeparator=","
          />
        </Group>
        <Textarea
          label="Açıklama"
          placeholder="Giriş açıklaması..."
          value={girisForm.aciklama}
          onChange={(e) => setGirisForm({ ...girisForm, aciklama: e.target.value })}
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            İptal
          </Button>
          <Button
            color="green"
            onClick={onGiris}
            loading={loading}
            leftSection={<IconTrendingUp size={16} />}
          >
            Giriş Yap
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
