/**
 * DepoModal - Depo Ekleme/Düzenleme Modalı
 */

'use client';

import { Button, Group, Modal, NumberInput, Select, SimpleGrid, TextInput } from '@mantine/core';

import type { Depo, DepoForm } from '../../types';
import { DEPO_TURLERI } from '../../types';

interface DepoModalProps {
  opened: boolean;
  onClose: () => void;
  editingDepo: Depo | null;
  depoForm: DepoForm;
  setDepoForm: (form: DepoForm | ((prev: DepoForm) => DepoForm)) => void;
  onSave: () => Promise<void>;
  loading?: boolean;
}

export default function DepoModal({
  opened,
  onClose,
  editingDepo,
  depoForm,
  setDepoForm,
  onSave,
  loading = false,
}: DepoModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={editingDepo ? 'Depo Düzenle' : 'Yeni Depo Ekle'} size="lg">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <TextInput
          label="Depo Adı"
          placeholder="Örn: Ana Depo"
          value={depoForm.ad}
          onChange={(e) => setDepoForm({ ...depoForm, ad: e.target.value })}
          required
        />
        <TextInput
          label="Depo Kodu"
          placeholder="Örn: ANA01"
          value={depoForm.kod}
          onChange={(e) => setDepoForm({ ...depoForm, kod: e.target.value })}
          required
          disabled={!!editingDepo}
        />
        <Select
          label="Depo Türü"
          data={DEPO_TURLERI}
          value={depoForm.tur}
          onChange={(value) => setDepoForm({ ...depoForm, tur: value || 'genel' })}
        />
        <TextInput
          label="Yetkili"
          placeholder="Yetkili kişi adı"
          value={depoForm.yetkili}
          onChange={(e) => setDepoForm({ ...depoForm, yetkili: e.target.value })}
        />
        <TextInput
          label="Telefon"
          placeholder="0XXX XXX XX XX"
          value={depoForm.telefon}
          onChange={(e) => setDepoForm({ ...depoForm, telefon: e.target.value })}
        />
        <TextInput
          label="E-posta"
          placeholder="depo@sirket.com"
          value={depoForm.email}
          onChange={(e) => setDepoForm({ ...depoForm, email: e.target.value })}
        />
        <TextInput
          label="Adres"
          placeholder="Depo adresi"
          value={depoForm.adres}
          onChange={(e) => setDepoForm({ ...depoForm, adres: e.target.value })}
          style={{ gridColumn: 'span 2' }}
        />
        <NumberInput
          label="Kapasite (m³)"
          placeholder="0"
          value={depoForm.kapasite_m3}
          onChange={(value) => setDepoForm({ ...depoForm, kapasite_m3: typeof value === 'number' ? value : 0 })}
          min={0}
        />
      </SimpleGrid>
      <Group justify="flex-end" mt="lg">
        <Button variant="light" onClick={onClose}>
          İptal
        </Button>
        <Button onClick={onSave} loading={loading}>
          {editingDepo ? 'Güncelle' : 'Kaydet'}
        </Button>
      </Group>
    </Modal>
  );
}
