'use client';

import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconCrown,
  IconEdit,
  IconFilter,
  IconHistory,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconSearch,
  IconShield,
  IconShieldLock,
  IconSquare,
  IconSquareCheck,
  IconTrash,
  IconUserPlus,
  IconUserShield,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { adminAPI, type User } from '@/lib/api/services/admin';

export default function KullanicilarPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    user_type: 'user' as 'super_admin' | 'admin' | 'user',
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [loginHistoryModal, { open: openLoginHistory, close: closeLoginHistory }] =
    useDisclosure(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Arama ve Filtreleme
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Toplu Seçim
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());

  // Confirm Dialog
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // Filtrelenmiş kullanıcılar
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Arama filtresi
      const matchesSearch =
        searchQuery === '' ||
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      // Rol filtresi
      const matchesRole =
        !roleFilter ||
        (roleFilter === 'super_admin' && user.user_type === 'super_admin') ||
        (roleFilter === 'admin' && user.role === 'admin' && user.user_type !== 'super_admin') ||
        (roleFilter === 'user' && user.role === 'user');

      // Durum filtresi
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.is_active) ||
        (statusFilter === 'inactive' && !user.is_active) ||
        (statusFilter === 'locked' && user.isLocked);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Tümünü seç / Seçimi kaldır
  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  // Tek kullanıcı seç
  const toggleUserSelect = (userId: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  // Kullanıcıları getir
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getUsers();
      if (data.success) {
        setUsers((data as any).users || []);
      }
    } catch (error) {
      console.error('Kullanıcılar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    fetchUsers();
  }, [fetchUsers, authLoading, isAuthenticated]);

  // Yeni kullanıcı formunu aç
  const handleNewUser = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      user_type: 'user',
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
      user_type: (user.user_type as 'super_admin' | 'admin' | 'user') || 'user',
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
      const body: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        user_type: formData.user_type,
        is_active: formData.is_active,
      };

      if (formData.password) {
        body.password = formData.password;
      }

      const data = editingUser
        ? await adminAPI.updateUser(editingUser.id, body)
        : await adminAPI.createUser(body);

      if (data.success) {
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
    const user = users.find((u) => u.id === userId);
    const confirmed = await confirm({
      title: 'Kullanıcıyı Sil',
      message: `"${user?.name || 'Bu kullanıcı'}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      variant: 'danger',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
    });

    if (!confirmed) return;

    try {
      const data = await adminAPI.deleteUser(userId);

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Kullanıcı silindi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setSelectedUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
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

  // Toplu silme
  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;

    const confirmed = await confirm({
      title: 'Toplu Silme',
      message: `${selectedUsers.size} kullanıcı kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      variant: 'danger',
      confirmText: `${selectedUsers.size} Kullanıcıyı Sil`,
      cancelText: 'Vazgeç',
    });

    if (!confirmed) return;

    let successCount = 0;
    let failCount = 0;

    for (const userId of selectedUsers) {
      try {
        const data = await adminAPI.deleteUser(userId);
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    notifications.show({
      title: 'Toplu Silme Tamamlandı',
      message: `${successCount} başarılı, ${failCount} başarısız`,
      color: failCount > 0 ? 'orange' : 'green',
    });

    setSelectedUsers(new Set());
    fetchUsers();
  };

  // Toplu aktif/pasif
  const handleBulkToggleActive = async (activate: boolean) => {
    if (selectedUsers.size === 0) return;

    const confirmed = await confirm({
      title: activate ? 'Toplu Aktif Et' : 'Toplu Pasif Et',
      message: `${selectedUsers.size} kullanıcı ${activate ? 'aktif' : 'pasif'} duruma getirilecek.`,
      variant: 'warning',
      confirmText: activate ? 'Aktif Et' : 'Pasif Et',
      cancelText: 'Vazgeç',
    });

    if (!confirmed) return;

    let successCount = 0;
    let failCount = 0;

    for (const userId of selectedUsers) {
      try {
        const data = await adminAPI.updateUser(userId, { is_active: activate });
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    notifications.show({
      title: 'İşlem Tamamlandı',
      message: `${successCount} başarılı, ${failCount} başarısız`,
      color: failCount > 0 ? 'orange' : 'green',
    });

    setSelectedUsers(new Set());
    fetchUsers();
  };

  // Hesabı kilitle
  const handleLockUser = async (userId: number) => {
    const user = users.find((u) => u.id === userId);
    const confirmed = await confirm({
      title: 'Hesabı Kilitle',
      message: `"${user?.name || 'Bu kullanıcı'}" hesabı 1 saat boyunca kilitlenecek ve giriş yapamayacak.`,
      variant: 'warning',
      confirmText: 'Kilitle',
      cancelText: 'Vazgeç',
    });

    if (!confirmed) return;

    try {
      const data = await adminAPI.lockUser(userId, 60);

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Hesap kilitlendi',
          color: 'orange',
          icon: <IconLock size={16} />,
        });
        fetchUsers();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Kilitleme başarısız',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Kilitleme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası',
        color: 'red',
      });
    }
  };

  // Hesabı aç
  const handleUnlockUser = async (userId: number) => {
    try {
      const data = await adminAPI.unlockUser(userId);

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Hesap açıldı',
          color: 'green',
          icon: <IconLockOpen size={16} />,
        });
        fetchUsers();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Açma başarısız',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Açma hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası',
        color: 'red',
      });
    }
  };

  // Login geçmişini getir
  const handleViewLoginHistory = async (user: User) => {
    setSelectedUser(user);
    setLoadingHistory(true);
    openLoginHistory();
    try {
      const data = await adminAPI.getUserLoginAttempts(user.id, 50);
      if (data.success) {
        setLoginHistory(data.data?.history || []);
      }
    } catch (error) {
      console.error('Login geçmişi yüklenemedi:', error);
      notifications.show({
        title: 'Hata',
        message: 'Login geçmişi yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoadingHistory(false);
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
                Kullanıcı Yönetimi
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

        {/* Arama ve Filtreleme */}
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" wrap="wrap">
            <Group>
              <TextInput
                placeholder="Ad veya email ara..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                w={250}
              />
              <Select
                placeholder="Rol filtrele"
                leftSection={<IconFilter size={16} />}
                data={[
                  { value: 'super_admin', label: 'Süper Admin' },
                  { value: 'admin', label: 'Yönetici' },
                  { value: 'user', label: 'Kullanıcı' },
                ]}
                value={roleFilter}
                onChange={setRoleFilter}
                clearable
                w={160}
              />
              <SegmentedControl
                value={statusFilter}
                onChange={setStatusFilter}
                data={[
                  { value: 'all', label: 'Tümü' },
                  { value: 'active', label: 'Aktif' },
                  { value: 'inactive', label: 'Pasif' },
                  { value: 'locked', label: 'Kilitli' },
                ]}
              />
            </Group>

            {/* Toplu İşlem Butonları */}
            {selectedUsers.size > 0 && (
              <Group>
                <Badge variant="light" size="lg">
                  {selectedUsers.size} seçili
                </Badge>
                <Menu shadow="md" width={200}>
                  <Menu.Target>
                    <Button variant="light" rightSection={<IconChevronDown size={16} />}>
                      Toplu İşlem
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconCheck size={16} />}
                      onClick={() => handleBulkToggleActive(true)}
                    >
                      Aktif Et
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconX size={16} />}
                      onClick={() => handleBulkToggleActive(false)}
                    >
                      Pasif Et
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      onClick={handleBulkDelete}
                    >
                      Sil
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => setSelectedUsers(new Set())}
                  title="Seçimi Temizle"
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            )}
          </Group>

          {/* Sonuç bilgisi */}
          {(searchQuery || roleFilter || statusFilter !== 'all') && (
            <Text size="sm" c="dimmed" mt="sm">
              {filteredUsers.length} / {users.length} kullanıcı gösteriliyor
            </Text>
          )}
        </Paper>

        {/* Kullanıcı Listesi */}
        <Paper p="lg" radius="md" withBorder>
          {loading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : filteredUsers.length === 0 ? (
            <Alert color="blue" icon={<IconUsers size={16} />}>
              {users.length === 0
                ? 'Henüz kullanıcı bulunmuyor'
                : 'Filtrelere uygun kullanıcı bulunamadı'}
            </Alert>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Tooltip
                      label={
                        selectedUsers.size === filteredUsers.length
                          ? 'Tüm seçimi kaldır'
                          : 'Tümünü seç'
                      }
                    >
                      <ActionIcon
                        variant="subtle"
                        onClick={toggleSelectAll}
                        color={selectedUsers.size > 0 ? 'blue' : 'gray'}
                      >
                        {selectedUsers.size === filteredUsers.length && filteredUsers.length > 0 ? (
                          <IconSquareCheck size={18} />
                        ) : (
                          <IconSquare size={18} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  </Table.Th>
                  <Table.Th>Kullanıcı</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Rol</Table.Th>
                  <Table.Th>Durum</Table.Th>
                  <Table.Th>Kayıt Tarihi</Table.Th>
                  <Table.Th ta="right">İşlemler</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredUsers.map((user) => (
                  <Table.Tr
                    key={user.id}
                    bg={selectedUsers.has(user.id) ? 'var(--mantine-color-blue-light)' : undefined}
                  >
                    <Table.Td>
                      <Checkbox
                        checked={selectedUsers.has(user.id)}
                        onChange={() => toggleUserSelect(user.id)}
                      />
                    </Table.Td>
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
                      <Stack gap="xs">
                        {user.is_active ? (
                          <Badge color="green" variant="light">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge color="gray" variant="light">
                            Pasif
                          </Badge>
                        )}
                        {user.isLocked && user.lockedUntil && (
                          <Badge color="red" variant="light" leftSection={<IconLock size={12} />}>
                            Kilitli
                          </Badge>
                        )}
                        {user.failedAttempts && user.failedAttempts > 0 && (
                          <Text size="xs" c="orange">
                            {user.failedAttempts}/5 başarısız deneme
                          </Text>
                        )}
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<IconHistory size={14} />}
                          onClick={() => handleViewLoginHistory(user)}
                          mt={4}
                        >
                          Giriş Geçmişi
                        </Button>
                      </Stack>
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
                        {user.isLocked ? (
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            onClick={() => handleUnlockUser(user.id)}
                            title="Hesabı Aç"
                          >
                            <IconLockOpen size={16} />
                          </ActionIcon>
                        ) : (
                          <ActionIcon
                            variant="subtle"
                            color="orange"
                            onClick={() => handleLockUser(user.id)}
                            title="Hesabı Kilitle"
                          >
                            <IconLock size={16} />
                          </ActionIcon>
                        )}
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
              // user_type'a göre role'ü otomatik ayarla
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
            <Button variant="light" onClick={close}>
              İptal
            </Button>
            <Button onClick={handleSave} loading={submitting}>
              {editingUser ? 'Güncelle' : 'Oluştur'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Login Geçmişi Modal */}
      <Modal
        opened={loginHistoryModal}
        onClose={closeLoginHistory}
        title={
          <Group>
            <IconHistory size={20} />
            <Text fw={600}>{selectedUser?.name} - Giriş Geçmişi</Text>
          </Group>
        }
        size="xl"
      >
        {loadingHistory ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : loginHistory.length === 0 ? (
          <Alert color="blue" icon={<IconHistory size={16} />}>
            Henüz giriş kaydı bulunmuyor
          </Alert>
        ) : (
          <Stack gap="md">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tarih</Table.Th>
                  <Table.Th>Durum</Table.Th>
                  <Table.Th>IP Adresi</Table.Th>
                  <Table.Th>User Agent</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loginHistory.map((attempt: any, index: number) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconClock size={14} />
                        <Text size="sm">
                          {new Date(attempt.attempted_at || attempt.created_at).toLocaleString(
                            'tr-TR'
                          )}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={attempt.success ? 'green' : 'red'}
                        variant="light"
                        leftSection={
                          attempt.success ? <IconCheck size={12} /> : <IconX size={12} />
                        }
                      >
                        {attempt.success ? 'Başarılı' : 'Başarısız'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {attempt.ip_address || 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" style={{ maxWidth: 300 }} truncate>
                        {attempt.user_agent || 'N/A'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialogComponent />
    </Container>
  );
}
