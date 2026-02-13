'use client';

import { Button, Group, Modal, PasswordInput, Select, Stack, Switch, TextInput } from '@mantine/core';
import type { User } from '@/lib/api/services/admin';

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  user_type: 'super_admin' | 'admin' | 'user';
  is_active: boolean;
}

interface UserFormModalProps {
  opened: boolean;
  onClose: () => void;
  editingUser: User | null;
  formData: UserFormData;
  setFormData: (data: UserFormData) => void;
  onSave: () => void;
  submitting: boolean;
}

export function UserFormModal({
  opened,
  onClose,
  editingUser,
  formData,
  setFormData,
  onSave,
  submitting,
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
            { value: 'user', label: '👤 Kullanıcı' },
            { value: 'admin', label: '🛡️ Yönetici' },
            { value: 'super_admin', label: '👑 Süper Admin' },
          ]}
          value={formData.user_type}
          onChange={(value) => {
            const userType = (value || 'user') as 'super_admin' | 'admin' | 'user';
            const role = userType === 'super_admin' || userType === 'admin' ? 'admin' : 'user';
            setFormData({ ...formData, user_type: userType, role });
          }}
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
