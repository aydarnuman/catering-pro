/**
 * YeniUrunModal - Yeni Ürün Ekleme Modalı
 */

'use client';

import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Textarea,
  TextInput,
} from '@mantine/core';

import type { Birim, Kategori, UrunForm } from '../../types';

interface YeniUrunModalProps {
  opened: boolean;
  onClose: () => void;
  urunForm: UrunForm;
  setUrunForm: (form: UrunForm | ((prev: UrunForm) => UrunForm)) => void;
  kategoriler: Kategori[];
  birimler: Birim[];
  onSave: () => Promise<void>;
  loading?: boolean;
}

export default function YeniUrunModal({
  opened,
  onClose,
  urunForm,
  setUrunForm,
  kategoriler,
  birimler,
  onSave,
  loading = false,
}: YeniUrunModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Yeni Ürün Ekle" size="lg">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <TextInput
          label="Ürün Kodu"
          placeholder="Örn: URN001"
          value={urunForm.kod}
          onChange={(e) => setUrunForm({ ...urunForm, kod: e.target.value })}
          required
        />
        <TextInput
          label="Ürün Adı"
          placeholder="Örn: Pirinç"
          value={urunForm.ad}
          onChange={(e) => setUrunForm({ ...urunForm, ad: e.target.value })}
          required
        />
        <Select
          label="Kategori"
          placeholder="Kategori seçin"
          data={kategoriler.map((k) => ({ value: k.id.toString(), label: k.ad }))}
          value={urunForm.kategori_id}
          onChange={(value) => setUrunForm({ ...urunForm, kategori_id: value || '' })}
          required
          searchable
        />
        <Select
          label="Birim"
          placeholder="Birim seçin"
          data={birimler.map((b) => ({
            value: b.id.toString(),
            label: `${b.ad} (${b.kisa_ad})`,
          }))}
          value={urunForm.ana_birim_id}
          onChange={(value) => setUrunForm({ ...urunForm, ana_birim_id: value || '' })}
          required
          searchable
        />
        <TextInput
          label="Barkod"
          placeholder="Ürün barkodu"
          value={urunForm.barkod}
          onChange={(e) => setUrunForm({ ...urunForm, barkod: e.target.value })}
        />
        <NumberInput
          label="Alış Fiyatı (₺)"
          placeholder="0.00"
          value={urunForm.son_alis_fiyat}
          onChange={(value) => setUrunForm({ ...urunForm, son_alis_fiyat: Number(value) || 0 })}
          min={0}
          decimalScale={2}
        />
        <NumberInput
          label="Min Stok"
          placeholder="0"
          value={urunForm.min_stok}
          onChange={(value) => setUrunForm({ ...urunForm, min_stok: Number(value) || 0 })}
          min={0}
        />
        <NumberInput
          label="Max Stok"
          placeholder="0"
          value={urunForm.max_stok}
          onChange={(value) => setUrunForm({ ...urunForm, max_stok: Number(value) || 0 })}
          min={0}
        />
        <NumberInput
          label="KDV Oranı (%)"
          placeholder="18"
          value={urunForm.kdv_orani}
          onChange={(value) => setUrunForm({ ...urunForm, kdv_orani: Number(value) || 0 })}
          min={0}
          max={100}
        />
        <Textarea
          label="Açıklama"
          placeholder="Ürün açıklaması"
          value={urunForm.aciklama}
          onChange={(e) => setUrunForm({ ...urunForm, aciklama: e.target.value })}
          style={{ gridColumn: 'span 2' }}
        />
      </SimpleGrid>
      <Group justify="flex-end" mt="lg">
        <Button variant="light" onClick={onClose}>
          İptal
        </Button>
        <Button onClick={onSave} loading={loading}>
          Kaydet
        </Button>
      </Group>
    </Modal>
  );
}
