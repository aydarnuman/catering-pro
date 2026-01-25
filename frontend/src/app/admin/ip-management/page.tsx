'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconCheck,
  IconEdit,
  IconLock,
  IconLockOpen,
  IconPlus,
  IconRefresh,
  IconShield,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { adminAPI } from '@/lib/api/services/admin';

interface IpRule {
  id: number;
  ipAddress: string;
  type: 'whitelist' | 'blacklist';
  description: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export default function IPManagementPage() {
  const [rules, setRules] = useState<IpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [opened, { open, close }] = useDisclosure(false);
  const [editingRule, setEditingRule] = useState<IpRule | null>(null);
  const [formData, setFormData] = useState({
    ipAddress: '',
    type: 'blacklist' as 'whitelist' | 'blacklist',
    description: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // IP kurallarını yükle
  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getIpRules();
      if (data.success) {
        setRules((data as any).rules || []);
      }
    } catch (error) {
      console.error('IP kuralları yüklenemedi:', error);
      notifications.show({
        title: 'Hata',
        message: 'IP kuralları yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Form sıfırla
  const resetForm = () => {
    setFormData({
      ipAddress: '',
      type: 'blacklist',
      description: '',
      isActive: true,
    });
    setEditingRule(null);
  };

  // Yeni kural modal aç
  const handleNewRule = () => {
    resetForm();
    open();
  };

  // Kural düzenle
  const handleEditRule = (rule: IpRule) => {
    setEditingRule(rule);
    setFormData({
      ipAddress: rule.ipAddress,
      type: rule.type,
      description: rule.description || '',
      isActive: rule.isActive,
    });
    open();
  };

  // Kural kaydet
  const handleSave = async () => {
    if (!formData.ipAddress) {
      notifications.show({
        title: 'Hata',
        message: 'IP adresi gerekli',
        color: 'red',
      });
      return;
    }

    // CIDR formatını basit kontrol et
    const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!cidrPattern.test(formData.ipAddress)) {
      notifications.show({
        title: 'Hata',
        message: 'Geçersiz IP formatı. Örnek: 192.168.1.0/24 veya 10.0.0.1/32',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const data = editingRule
        ? await adminAPI.updateIpRule(editingRule.id, formData)
        : await adminAPI.createIpRule({
            ipAddress: formData.ipAddress,
            type: formData.type,
            description: formData.description || undefined,
          });

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: editingRule ? 'IP kuralı güncellendi' : 'IP kuralı eklendi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchRules();
        close();
        resetForm();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'İşlem başarısız',
          color: 'red',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.response?.data?.error || 'Sunucu hatası',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // Kural sil
  const handleDelete = async (id: number) => {
    if (!confirm('Bu IP kuralını silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const data = await adminAPI.deleteIpRule(id);
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'IP kuralı silindi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchRules();
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Silme başarısız',
        color: 'red',
      });
    }
  };

  // Aktif/pasif toggle
  const handleToggleActive = async (rule: IpRule) => {
    try {
      const data = await adminAPI.updateIpRule(rule.id, { isActive: !rule.isActive });
      if (data.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
        );
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Güncelleme başarısız',
        color: 'red',
      });
    }
  };

  // Filtrelenmiş kurallar
  const filteredRules =
    activeTab === 'all'
      ? rules
      : activeTab === 'whitelist'
        ? rules.filter((r) => r.type === 'whitelist')
        : rules.filter((r) => r.type === 'blacklist');

  const whitelistCount = rules.filter((r) => r.type === 'whitelist' && r.isActive).length;
  const blacklistCount = rules.filter((r) => r.type === 'blacklist' && r.isActive).length;

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={1} size="h2" mb={4}>
              🛡️ IP Erişim Yönetimi
            </Title>
            <Text c="dimmed" size="lg">
              IP whitelist ve blacklist kuralları
            </Text>
          </div>
          <Group>
            <ActionIcon variant="light" size="lg" onClick={fetchRules}>
              <IconRefresh size={18} />
            </ActionIcon>
            <Button leftSection={<IconPlus size={18} />} onClick={handleNewRule}>
              Yeni Kural
            </Button>
          </Group>
        </Group>

        {/* Bilgilendirme */}
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          <Text size="sm">
            <strong>Whitelist:</strong> Sadece listedeki IP'ler erişebilir (diğerleri reddedilir)
            <br />
            <strong>Blacklist:</strong> Listedeki IP'ler erişemez (diğerleri erişebilir)
            <br />
            <strong>CIDR Format:</strong> 192.168.1.0/24 (ağ) veya 10.0.0.1/32 (tek IP)
          </Text>
        </Alert>

        {/* İstatistikler */}
        <Group gap="md">
          <Card withBorder p="md" style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="xl" fw={700}>
                  {whitelistCount}
                </Text>
                <Text size="sm" c="dimmed">
                  Aktif Whitelist
                </Text>
              </div>
              <IconLockOpen size={32} color="var(--mantine-color-green-6)" />
            </Group>
          </Card>
          <Card withBorder p="md" style={{ flex: 1 }}>
            <Group justify="space-between">
              <div>
                <Text size="xl" fw={700}>
                  {blacklistCount}
                </Text>
                <Text size="sm" c="dimmed">
                  Aktif Blacklist
                </Text>
              </div>
              <IconLock size={32} color="var(--mantine-color-red-6)" />
            </Group>
          </Card>
        </Group>

        {/* Tab'lar */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="all" leftSection={<IconShield size={16} />}>
              Tümü ({rules.length})
            </Tabs.Tab>
            <Tabs.Tab value="whitelist" leftSection={<IconLockOpen size={16} />}>
              Whitelist ({rules.filter((r) => r.type === 'whitelist').length})
            </Tabs.Tab>
            <Tabs.Tab value="blacklist" leftSection={<IconLock size={16} />}>
              Blacklist ({rules.filter((r) => r.type === 'blacklist').length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value={activeTab || 'all'} pt="xl">
            {loading ? (
              <Center py="xl">
                <Loader />
              </Center>
            ) : filteredRules.length === 0 ? (
              <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                {activeTab === 'all'
                  ? 'Henüz IP kuralı yok'
                  : activeTab === 'whitelist'
                    ? 'Whitelist kuralı yok'
                    : 'Blacklist kuralı yok'}
              </Alert>
            ) : (
              <Paper withBorder>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>IP Adresi</Table.Th>
                      <Table.Th>Tip</Table.Th>
                      <Table.Th>Açıklama</Table.Th>
                      <Table.Th>Durum</Table.Th>
                      <Table.Th>Oluşturulma</Table.Th>
                      <Table.Th ta="right">İşlemler</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredRules.map((rule) => (
                      <Table.Tr key={rule.id}>
                        <Table.Td>
                          <Text fw={500} size="sm" ff="monospace">
                            {rule.ipAddress}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={rule.type === 'whitelist' ? 'green' : 'red'}
                            variant="light"
                            leftSection={
                              rule.type === 'whitelist' ? (
                                <IconLockOpen size={12} />
                              ) : (
                                <IconLock size={12} />
                              )
                            }
                          >
                            {rule.type === 'whitelist' ? 'Whitelist' : 'Blacklist'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {rule.description || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Switch
                            checked={rule.isActive}
                            onChange={() => handleToggleActive(rule)}
                            size="sm"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {new Date(rule.createdAt).toLocaleDateString('tr-TR')}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" justify="flex-end">
                            <Tooltip label="Düzenle">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => handleEditRule(rule)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Sil">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => handleDelete(rule.id)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </Tabs.Panel>
        </Tabs>

        {/* Kural Ekleme/Düzenleme Modal */}
        <Modal
          opened={opened}
          onClose={() => {
            close();
            resetForm();
          }}
          title={editingRule ? 'IP Kuralı Düzenle' : 'Yeni IP Kuralı'}
          size="md"
        >
          <Stack gap="md">
            <TextInput
              label="IP Adresi (CIDR)"
              placeholder="192.168.1.0/24 veya 10.0.0.1/32"
              value={formData.ipAddress}
              onChange={(e) => setFormData({ ...formData, ipAddress: e.currentTarget.value })}
              required
              description="CIDR formatında IP adresi veya ağ aralığı"
            />

            <div>
              <Text size="sm" fw={500} mb="xs">
                Kural Tipi
              </Text>
              <Group gap="xs">
                <Button
                  variant={formData.type === 'whitelist' ? 'filled' : 'outline'}
                  color="green"
                  leftSection={<IconLockOpen size={16} />}
                  onClick={() => setFormData({ ...formData, type: 'whitelist' })}
                  style={{ flex: 1 }}
                >
                  Whitelist
                </Button>
                <Button
                  variant={formData.type === 'blacklist' ? 'filled' : 'outline'}
                  color="red"
                  leftSection={<IconLock size={16} />}
                  onClick={() => setFormData({ ...formData, type: 'blacklist' })}
                  style={{ flex: 1 }}
                >
                  Blacklist
                </Button>
              </Group>
            </div>

            <Textarea
              label="Açıklama"
              placeholder="Örn: Ofis IP aralığı, Şüpheli IP"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
              minRows={2}
            />

            {editingRule && (
              <Switch
                label="Aktif"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.currentTarget.checked })}
              />
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => { close(); resetForm(); }}>
                İptal
              </Button>
              <Button onClick={handleSave} loading={saving} leftSection={<IconCheck size={16} />}>
                {editingRule ? 'Güncelle' : 'Kaydet'}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
