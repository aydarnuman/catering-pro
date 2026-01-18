'use client';

import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCheck,
  IconCrown,
  IconEdit,
  IconRefresh,
  IconShield,
  IconShieldLock,
  IconTrash,
  IconUserPlus,
  IconUserShield,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';

const API_URL = API_BASE_URL;

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  user_type?: 'super_admin' | 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

export default function KullanicilarPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  // Kullanıcıları getir
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/auth/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Kullanıcılar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, fetchUsers]);

  // Yeni kullanıcı formunu aç
  const handleNewUser = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      is_active: true,
    });
    open();
  };

  // Kullanıcı düzenle
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active,
    });
    open();
  };

  // Kullanıcı kaydet
  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      notifications.show({
        title: 'Hata',
        message: 'Ad ve email zorunludur',
        color: 'red',
      });
      return;
    }

    if (!editingUser && !formData.password) {
      notifications.show({
        title: 'Hata',
        message: 'Yeni kullanıcı için şifre zorunludur',
        color: 'red',
      });
      return;
    }

    setSubmitting(true);
    try {
      const url = editingUser
        ? `${API_URL}/api/auth/users/${editingUser.id}`
        : `${API_URL}/api/auth/register`;

      const method = editingUser ? 'PUT' : 'POST';

      const body: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active,
      };

      if (formData.password) {
        body.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        notifications.show({
          title: 'Başarılı',
          message: editingUser ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        close();
        fetchUsers();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'İşlem başarısız',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Kullanıcı sil
  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Kullanıcı silindi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchUsers();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Silme başarısız',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="subtle" size="lg" component="a" href="/admin">
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={1} size="h2" mb={4}>
                👥 Kullanıcı Yönetimi
              </Title>
              <Text c="dimmed">Kullanıcılar, roller ve izinler</Text>
            </div>
          </Group>
          <Group>
            <ActionIcon variant="light" size="lg" onClick={fetchUsers}>
              <IconRefresh size={18} />
            </ActionIcon>
            <Button leftSection={<IconUserPlus size={18} />} onClick={handleNewUser}>
              Yeni Kullanıcı
            </Button>
          </Group>
        </Group>

        {/* Kullanıcı Listesi */}
        <Paper p="lg" radius="md" withBorder>
          {loading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : users.length === 0 ? (
            <Alert color="blue" icon={<IconUsers size={16} />}>
              Henüz kullanıcı bulunmuyor
            </Alert>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Kullanıcı</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Rol</Table.Th>
                  <Table.Th>Durum</Table.Th>
                  <Table.Th>Kayıt Tarihi</Table.Th>
                  <Table.Th ta="right">İşlemler</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar
                          size="sm"
                          radius="xl"
                          color={user.role === 'admin' ? 'red' : 'blue'}
                        >
                          {getInitials(user.name)}
                        </Avatar>
                        <Text size="sm" fw={500}>
                          {user.name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {user.email}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          user.user_type === 'super_admin'
                            ? 'red'
                            : user.role === 'admin'
                              ? 'orange'
                              : 'blue'
                        }
                        variant="light"
                        leftSection={
                          user.user_type === 'super_admin' ? (
                            <IconCrown size={12} />
                          ) : user.role === 'admin' ? (
                            <IconUserShield size={12} />
                          ) : (
                            <IconShield size={12} />
                          )
                        }
                      >
                        {user.user_type === 'super_admin'
                          ? 'Süper Admin'
                          : user.role === 'admin'
                            ? 'Yönetici'
                            : 'Kullanıcı'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {user.is_active ? (
                        <Badge color="green" variant="light">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="light">
                          Pasif
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {new Date(user.created_at).toLocaleDateString('tr-TR')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => handleEditUser(user)}
                          title="Kullanıcıyı Düzenle"
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="violet"
                          component={Link}
                          href="/admin/yetkiler"
                          title="Yetkileri Düzenle"
                        >
                          <IconShieldLock size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteUser(user.id)}
                          title="Kullanıcıyı Sil"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* İstatistikler */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xl" fw={700}>
                  {users.length}
                </Text>
                <Text size="sm" c="dimmed">
                  Toplam Kullanıcı
                </Text>
              </div>
              <ThemeIcon size={40} radius="md" variant="light" color="blue">
                <IconUsers size={22} />
              </ThemeIcon>
            </Group>
          </Card>
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xl" fw={700}>
                  {users.filter((u) => u.role === 'admin').length}
                </Text>
                <Text size="sm" c="dimmed">
                  Admin
                </Text>
              </div>
              <ThemeIcon size={40} radius="md" variant="light" color="red">
                <IconShield size={22} />
              </ThemeIcon>
            </Group>
          </Card>
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xl" fw={700}>
                  {users.filter((u) => u.is_active).length}
                </Text>
                <Text size="sm" c="dimmed">
                  Aktif
                </Text>
              </div>
              <ThemeIcon size={40} radius="md" variant="light" color="green">
                <IconCheck size={22} />
              </ThemeIcon>
            </Group>
          </Card>
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xl" fw={700}>
                  {users.filter((u) => !u.is_active).length}
                </Text>
                <Text size="sm" c="dimmed">
                  Pasif
                </Text>
              </div>
              <ThemeIcon size={40} radius="md" variant="light" color="gray">
                <IconX size={22} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>
      </Stack>

      {/* Kullanıcı Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
        size="md"
      >
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
            label="Rol"
            data={[
              { value: 'user', label: '👤 Kullanıcı' },
              { value: 'admin', label: '🛡️ Yönetici' },
            ]}
            value={formData.role}
            onChange={(value) => setFormData({ ...formData, role: value || 'user' })}
          />
          <Switch
            label="Aktif"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.currentTarget.checked })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={close}>
              İptal
            </Button>
            <Button onClick={handleSave} loading={submitting}>
              {editingUser ? 'Güncelle' : 'Oluştur'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
