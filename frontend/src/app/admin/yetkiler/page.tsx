'use client';

import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  Notification,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconCrown,
  IconEdit,
  IconRefresh,
  IconShieldLock,
  IconUser,
  IconUserShield,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';

interface Module {
  name: string;
  display_name: string;
  icon: string;
  color: string;
}

interface UserPermission {
  user_id: number;
  user_name: string;
  email: string;
  user_type: string;
  is_active: boolean;
  permissions: any;
}

interface Permission {
  module_name: string;
  display_name: string;
  icon: string;
  color: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

interface Template {
  id: number;
  name: string;
  display_name: string;
  description: string;
  permissions: any;
  is_system: boolean;
}

export default function YetkilerPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [_modules, setModules] = useState<Module[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit modal
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [selectedUser, setSelectedUser] = useState<UserPermission | null>(null);
  const [editPermissions, setEditPermissions] = useState<Permission[]>([]);
  const [editUserType, setEditUserType] = useState<string>('user');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, modulesRes, templatesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/permissions/users`, { 
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch(`${API_BASE_URL}/api/permissions/modules`, { 
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch(`${API_BASE_URL}/api/permissions/templates`, { 
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
          .then((r) => r.json())
          .catch(() => ({ success: false })),
      ]);

      if (usersRes.success) setUsers(usersRes.data);
      if (modulesRes.success) setModules(modulesRes.data);
      if (templatesRes.success) setTemplates(templatesRes.data);
    } catch (err) {
      console.error('Veri alınamadı:', err);
      setMessage({ type: 'error', text: 'Veriler yüklenemedi' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditUser = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/permissions/user/${userId}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (data.success) {
        const userToEdit = users.find((u) => u.user_id === userId);
        setSelectedUser(userToEdit || null);
        setEditPermissions(data.data.permissions);
        setEditUserType(data.data.userType || 'user');
        openEditModal();
      }
    } catch (_err) {
      setMessage({ type: 'error', text: 'Kullanıcı yetkileri alınamadı' });
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/permissions/user/${selectedUser.user_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userType: editUserType,
          permissions: editPermissions.map((p) => ({
            module_name: p.module_name,
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
            can_export: p.can_export,
          })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Yetkiler başarıyla güncellendi' });
        closeEditModal();
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Yetkiler güncellenemedi' });
      }
    } catch (_err) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplate = async (templateName: string) => {
    if (!selectedUser) return;
    setSaving(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/permissions/user/${selectedUser.user_id}/apply-template`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ templateName }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: `${templateName} şablonu uygulandı` });
        // Yetkileri yeniden yükle
        handleEditUser(selectedUser.user_id);
      } else {
        setMessage({ type: 'error', text: data.error || 'Şablon uygulanamadı' });
      }
    } catch (_err) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const updatePermission = (moduleIndex: number, field: string, value: boolean) => {
    setEditPermissions((prev) => {
      const updated = [...prev];
      updated[moduleIndex] = { ...updated[moduleIndex], [field]: value };
      return updated;
    });
  };

  const setAllPermissions = (value: boolean) => {
    setEditPermissions((prev) =>
      prev.map((p) => ({
        ...p,
        can_view: value,
        can_create: value,
        can_edit: value,
        can_delete: value,
        can_export: value,
      }))
    );
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'super_admin':
        return <IconCrown size={16} />;
      case 'admin':
        return <IconUserShield size={16} />;
      default:
        return <IconUser size={16} />;
    }
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'super_admin':
        return 'red';
      case 'admin':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getUserTypeName = (userType: string) => {
    switch (userType) {
      case 'super_admin':
        return 'Süper Admin';
      case 'admin':
        return 'Admin';
      default:
        return 'Kullanıcı';
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Group gap="sm" mb={4}>
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconArrowLeft size={16} />}
                component={Link}
                href="/admin"
                size="compact-sm"
              >
                Admin Panel
              </Button>
            </Group>
            <Group gap="sm" mb={4}>
              <ThemeIcon
                size="lg"
                radius="md"
                variant="gradient"
                gradient={{ from: 'violet', to: 'blue' }}
              >
                <IconShieldLock size={20} />
              </ThemeIcon>
              <Title order={1} size="h2">
                Yetki Yönetimi
              </Title>
            </Group>
            <Text c="dimmed">Kullanıcı rollerini ve modül bazlı yetkileri yönetin</Text>
          </div>

          <Group>
            <Tooltip label="Yenile">
              <ActionIcon variant="light" size="lg" onClick={fetchData} loading={loading}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Badge size="lg" variant="light" color="red">
              Sadece Süper Admin
            </Badge>
          </Group>
        </Group>

        {/* Mesaj */}
        {message && (
          <Notification
            color={message.type === 'success' ? 'green' : 'red'}
            icon={message.type === 'success' ? <IconCheck /> : <IconX />}
            onClose={() => setMessage(null)}
            withCloseButton
          >
            {message.text}
          </Notification>
        )}

        {/* Kullanıcı Listesi */}
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>👥 Kullanıcılar ve Yetkileri</Title>
            <Badge color="blue">{users.length} kullanıcı</Badge>
          </Group>

          {loading ? (
            <Stack align="center" py="xl">
              <Loader />
              <Text c="dimmed">Yükleniyor...</Text>
            </Stack>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Kullanıcı</Table.Th>
                  <Table.Th>E-posta</Table.Th>
                  <Table.Th>Tip</Table.Th>
                  <Table.Th>Durum</Table.Th>
                  <Table.Th>Yetkili Modüller</Table.Th>
                  <Table.Th ta="right">İşlem</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((u) => {
                  const activePerms = Array.isArray(u.permissions)
                    ? u.permissions.filter((p: any) => p.view).length
                    : 0;

                  return (
                    <Table.Tr key={u.user_id}>
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar color={getUserTypeColor(u.user_type)} radius="xl" size="sm">
                            {u.user_name?.charAt(0).toUpperCase()}
                          </Avatar>
                          <Text size="sm" fw={500}>
                            {u.user_name}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {u.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          leftSection={getUserTypeIcon(u.user_type)}
                          color={getUserTypeColor(u.user_type)}
                          variant="light"
                        >
                          {getUserTypeName(u.user_type)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={u.is_active ? 'green' : 'red'} variant="dot">
                          {u.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {u.user_type === 'super_admin' ? (
                          <Badge color="red" variant="light">
                            Tam Yetki
                          </Badge>
                        ) : (
                          <Badge color="blue" variant="light">
                            {activePerms} modül
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">
                        {u.user_type === 'super_admin' ? (
                          <Tooltip label="Süper Admin yetkileri değiştirilemez">
                            <ActionIcon variant="subtle" color="gray" disabled>
                              <IconShieldLock size={16} />
                            </ActionIcon>
                          </Tooltip>
                        ) : user?.id === u.user_id ? (
                          <Tooltip label="Kendi yetkinizi değiştiremezsiniz">
                            <ActionIcon variant="subtle" color="gray" disabled>
                              <IconShieldLock size={16} />
                            </ActionIcon>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Yetkileri Düzenle">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => handleEditUser(u.user_id)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* Yetki Şablonları */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={4} mb="md">
            📋 Hazır Yetki Şablonları
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            Kullanıcıları düzenlerken bu şablonları hızlıca uygulayabilirsiniz
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {templates.map((t) => (
              <Card key={t.id} padding="md" radius="md" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text fw={600}>{t.display_name}</Text>
                  {t.is_system && (
                    <Badge size="xs" color="gray">
                      Sistem
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {t.description}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Paper>
      </Stack>

      {/* Yetki Düzenleme Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title={
          <Group>
            <IconShieldLock size={20} />
            <Text fw={600}>{selectedUser?.user_name} - Yetki Düzenleme</Text>
          </Group>
        }
        size="xl"
      >
        {selectedUser && (
          <Stack gap="md">
            {/* Uyarı */}
            <Alert color="yellow" icon={<IconAlertTriangle />}>
              Yapacağınız değişiklikler hemen uygulanacaktır.
            </Alert>

            {/* Kullanıcı Tipi */}
            <Select
              label="Kullanıcı Tipi"
              description="Kullanıcının sistem içindeki rolü"
              value={editUserType}
              onChange={(v) => setEditUserType(v || 'user')}
              data={[
                { value: 'user', label: '👤 Kullanıcı (Sınırlı Yetki)' },
                { value: 'admin', label: '🛡️ Admin (Belirlenen Yetkiler)' },
              ]}
            />

            <Divider label="Şablon Uygula" labelPosition="center" />

            {/* Şablon Seçimi */}
            <Group>
              {templates.map((t) => (
                <Button
                  key={t.id}
                  variant="light"
                  size="xs"
                  onClick={() => handleApplyTemplate(t.name)}
                  loading={saving}
                >
                  {t.display_name}
                </Button>
              ))}
            </Group>

            <Divider label="Modül Yetkileri" labelPosition="center" />

            {/* Toplu İşlem */}
            <Group>
              <Button
                size="xs"
                variant="light"
                color="green"
                onClick={() => setAllPermissions(true)}
              >
                Tümünü Aç
              </Button>
              <Button
                size="xs"
                variant="light"
                color="red"
                onClick={() => setAllPermissions(false)}
              >
                Tümünü Kapat
              </Button>
            </Group>

            {/* Yetki Tablosu */}
            <Box style={{ maxHeight: 400, overflow: 'auto' }}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Modül</Table.Th>
                    <Table.Th ta="center">Görüntüle</Table.Th>
                    <Table.Th ta="center">Ekle</Table.Th>
                    <Table.Th ta="center">Düzenle</Table.Th>
                    <Table.Th ta="center">Sil</Table.Th>
                    <Table.Th ta="center">Dışa Aktar</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {editPermissions.map((perm, index) => (
                    <Table.Tr key={perm.module_name}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {perm.display_name}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Checkbox
                          checked={perm.can_view || false}
                          onChange={(e) =>
                            updatePermission(index, 'can_view', e.currentTarget.checked)
                          }
                        />
                      </Table.Td>
                      <Table.Td ta="center">
                        <Checkbox
                          checked={perm.can_create || false}
                          onChange={(e) =>
                            updatePermission(index, 'can_create', e.currentTarget.checked)
                          }
                        />
                      </Table.Td>
                      <Table.Td ta="center">
                        <Checkbox
                          checked={perm.can_edit || false}
                          onChange={(e) =>
                            updatePermission(index, 'can_edit', e.currentTarget.checked)
                          }
                        />
                      </Table.Td>
                      <Table.Td ta="center">
                        <Checkbox
                          checked={perm.can_delete || false}
                          onChange={(e) =>
                            updatePermission(index, 'can_delete', e.currentTarget.checked)
                          }
                        />
                      </Table.Td>
                      <Table.Td ta="center">
                        <Checkbox
                          checked={perm.can_export || false}
                          onChange={(e) =>
                            updatePermission(index, 'can_export', e.currentTarget.checked)
                          }
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>

            {/* Kaydet */}
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeEditModal}>
                İptal
              </Button>
              <Button
                color="blue"
                leftSection={<IconCheck size={16} />}
                onClick={handleSavePermissions}
                loading={saving}
              >
                Değişiklikleri Kaydet
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
