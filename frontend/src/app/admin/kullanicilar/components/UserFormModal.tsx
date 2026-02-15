'use client';

import { Button, Group, Modal, MultiSelect, PasswordInput, Select, Stack, Switch, TextInput } from '@mantine/core';
import type { User } from '@/lib/api/services/admin';

interface FirmaOption {
  id: number;
  unvan: string;
  kisa_ad: string | null;
}

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  user_type: 'super_admin' | 'admin' | 'user';
  is_active: boolean;
  firma_ids: string[];
}

interface UserFormModalProps {
  opened: boolean;
  onClose: () => void;
  editingUser: User | null;
  formData: UserFormData;
  setFormData: (data: UserFormData) => void;
  onSave: () => void;
  submitting: boolean;
  availableFirmalar: FirmaOption[];
}

export function UserFormModal({
  opened,
  onClose,
  editingUser,
  formData,
  setFormData,
  onSave,
  submitting,
  availableFirmalar,
}: UserFormModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'} size="md">
      <Stack gap="md">
        <TextInput
          label="Ad Soyad"
          placeholder="Ahmet Yılmaz"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <TextInput
          label="Email"
          placeholder="ahmet@sirket.com"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
        <PasswordInput
          label={editingUser ? 'Yeni Şifre (boş bırakılırsa değişmez)' : 'Şifre'}
          placeholder="••••••••"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required={!editingUser}
        />
        <Select
          label="Kullanıcı Tipi"
          description="Kullanıcının yetki seviyesini belirler"
          data={[
            { value: 'user', label: 'Kullanıcı' },
            { value: 'admin', label: 'Yönetici' },
            { value: 'super_admin', label: 'Süper Admin' },
          ]}
          value={formData.user_type}
          onChange={(value) => {
            const userType = (value || 'user') as 'super_admin' | 'admin' | 'user';
            const role = userType === 'super_admin' || userType === 'admin' ? 'admin' : 'user';
            setFormData({ ...formData, user_type: userType, role });
          }}
        />
        <MultiSelect
          label="Firmalar"
          description="Kullanıcının erişebileceği firmaları seçin"
          placeholder="Firma seçin..."
          data={(availableFirmalar ?? []).map((f) => ({
            value: String(f.id),
            label: f.kisa_ad || f.unvan,
          }))}
          value={formData.firma_ids}
          onChange={(value) => setFormData({ ...formData, firma_ids: value })}
          required
          searchable={availableFirmalar.length > 5}
        />
        <Switch
          label="Aktif"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.currentTarget.checked })}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={onSave} loading={submitting}>
            {editingUser ? 'Güncelle' : 'Oluştur'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
