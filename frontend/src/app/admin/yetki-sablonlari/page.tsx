'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Table,
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
  IconPlus,
  IconRefresh,
  IconShieldLock,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';

interface Module {
  id: number;
  name: string;
  display_name: string;
  icon: string;
  color: string;
}

interface PermissionTemplate {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  permissions: Record<string, {
    view?: boolean;
    create?: boolean;
    edit?: boolean;
    delete?: boolean;
    export?: boolean;
  }>;
  is_system: boolean;
  created_at: string;
}

export default function YetkiSablonlariPage() {
  const { isSuperAdmin } = useAuth();
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingTemplate, setEditingTemplate] = useState<PermissionTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: {} as Record<string, {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      export: boolean;
    }>,
  });

  // Verileri yükle
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, modulesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/permissions/templates`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${API_BASE_URL}/api/permissions/modules`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }),
      ]);

      const templatesData = await templatesRes.json();
      const modulesData = await modulesRes.json();

      if (templatesData.success) {
        setTemplates(templatesData.data);
      }
      if (modulesData.success) {
        setModules(modulesData.data);
        
        // Form permissions'ı modüllerle initialize et
        if (!editingTemplate) {
          const initialPermissions: Record<string, any> = {};
          modulesData.data.forEach((mod: Module) => {
            initialPermissions[mod.name] = {
              view: false,
              create: false,
              edit: false,
              delete: false,
              export: false,
            };
          });
          setFormData((prev) => ({ ...prev, permissions: initialPermissions }));
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      notifications.show({
        title: 'Hata',
        message: 'Veriler yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [editingTemplate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Form sıfırla
  const resetForm = () => {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: {},
    });
    setEditingTemplate(null);
  };

  // Yeni şablon modal aç
  const handleNewTemplate = () => {
    resetForm();
    // Permissions'ı modüllerle initialize et
    const initialPermissions: Record<string, any> = {};
    modules.forEach((mod) => {
      initialPermissions[mod.name] = {
        view: false,
        create: false,
        edit: false,
        delete: false,
        export: false,
      };
    });
    setFormData((prev) => ({ ...prev, permissions: initialPermissions }));
    openModal();
  };

  // Şablon düzenle
  const handleEditTemplate = (template: PermissionTemplate) => {
    setEditingTemplate(template);
    // Permissions'ı normalize et (optional property'leri default değerlerle doldur)
    const normalizedPermissions: Record<string, {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      export: boolean;
    }> = {};
    
    if (template.permissions) {
      Object.entries(template.permissions).forEach(([key, perms]) => {
        normalizedPermissions[key] = {
          view: perms.view ?? false,
          create: perms.create ?? false,
          edit: perms.edit ?? false,
          delete: perms.delete ?? false,
          export: perms.export ?? false,
        };
      });
    }
    
    setFormData({
      name: template.name,
      display_name: template.display_name,
      description: template.description || '',
      permissions: normalizedPermissions,
    });
    openModal();
  };

  // Şablon kaydet
  const handleSave = async () => {
    if (!formData.name || !formData.display_name) {
      notifications.show({
        title: 'Hata',
        message: 'İsim ve görünen isim gerekli',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const url = editingTemplate
        ? `${API_BASE_URL}/api/permissions/templates/${editingTemplate.id}`
        : `${API_BASE_URL}/api/permissions/templates`;
      
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const body = editingTemplate
        ? {
            display_name: formData.display_name,
            description: formData.description,
            permissions: formData.permissions,
          }
        : {
            name: formData.name,
            display_name: formData.display_name,
            description: formData.description,
            permissions: formData.permissions,
          };

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: editingTemplate ? 'Şablon güncellendi' : 'Şablon oluşturuldu',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchData();
        closeModal();
        resetForm();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'İşlem başarısız',
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // Şablon sil
  const handleDelete = async (id: number) => {
    if (!confirm('Bu şablonu silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/permissions/templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Şablon silindi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchData();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Silme başarısız',
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası',
        color: 'red',
      });
    }
  };

  // Permission toggle
  const togglePermission = (moduleName: string, action: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleName]: {
          ...prev.permissions[moduleName],
          [action]: value,
        },
      },
    }));
  };

  // Tüm modül izinlerini toggle
  const toggleModuleAll = (moduleName: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleName]: {
          view: value,
          create: value,
          edit: value,
          delete: value,
          export: value,
        },
      },
    }));
  };

  // Tüm modüller için tüm izinleri toggle
  const toggleAllPermissions = (value: boolean) => {
    const newPermissions: Record<string, any> = {};
    modules.forEach((mod) => {
      newPermissions[mod.name] = {
        view: value,
        create: value,
        edit: value,
        delete: value,
        export: value,
      };
    });
    setFormData((prev) => ({ ...prev, permissions: newPermissions }));
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={1} size="h2" mb={4}>
              🎭 Yetki Şablonları
            </Title>
            <Text c="dimmed" size="lg">
              Önceden tanımlı yetki profilleri oluşturun ve yönetin
            </Text>
          </div>
          <Group>
            <ActionIcon variant="light" size="lg" onClick={fetchData} loading={loading}>
              <IconRefresh size={18} />
            </ActionIcon>
            {isSuperAdmin && (
              <Button leftSection={<IconPlus size={18} />} onClick={handleNewTemplate}>
                Yeni Şablon
              </Button>
            )}
          </Group>
        </Group>

        {/* Bilgilendirme */}
        {!isSuperAdmin && (
          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            <Text size="sm">
              Şablon oluşturma ve düzenleme için süper admin yetkisi gerekli.
            </Text>
          </Alert>
        )}

        {/* Şablon Listesi */}
        {loading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : templates.length === 0 ? (
          <Alert color="blue" icon={<IconAlertCircle size={16} />}>
            Henüz şablon yok
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {templates.map((template) => (
              <Card key={template.id} withBorder p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Group gap="xs" mb={4}>
                        <Text fw={600} size="lg">
                          {template.display_name}
                        </Text>
                        {template.is_system && (
                          <Badge color="blue" variant="light" leftSection={<IconLock size={12} />}>
                            Sistem
                          </Badge>
                        )}
                      </Group>
                      <Text c="dimmed" size="sm">
                        {template.description || 'Açıklama yok'}
                      </Text>
                    </div>
                  </Group>

                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Modül İzinleri:
                    </Text>
                    <Stack gap="xs">
                      {Object.entries(template.permissions || {}).slice(0, 3).map(([modName, perms]) => {
                        const module = modules.find((m) => m.name === modName);
                        if (!module) return null;
                        
                        const activeCount = Object.values(perms).filter(Boolean).length;
                        return (
                          <Group key={modName} justify="space-between">
                            <Text size="sm">{module.display_name}</Text>
                            <Badge variant="light" color={activeCount > 0 ? 'green' : 'gray'}>
                              {activeCount} izin
                            </Badge>
                          </Group>
                        );
                      })}
                      {Object.keys(template.permissions || {}).length > 3 && (
                        <Text size="xs" c="dimmed">
                          +{Object.keys(template.permissions || {}).length - 3} modül daha
                        </Text>
                      )}
                    </Stack>
                  </div>

                  <Group justify="flex-end">
                    {isSuperAdmin && !template.is_system && (
                      <>
                        <Tooltip label="Düzenle">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Sil">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDelete(template.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {/* Şablon Ekleme/Düzenleme Modal */}
        <Modal
          opened={modalOpened}
          onClose={() => {
            closeModal();
            resetForm();
          }}
          title={editingTemplate ? 'Şablon Düzenle' : 'Yeni Şablon'}
          size="xl"
        >
          <Stack gap="md">
            {!editingTemplate && (
              <TextInput
                label="Şablon Adı (Teknik)"
                placeholder="muhasebe, satinalma, mutfak"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
                required
                description="Küçük harf, alt çizgi kullanın (değiştirilemez)"
              />
            )}

            <TextInput
              label="Görünen İsim"
              placeholder="Muhasebeci, Satın Alma Sorumlusu"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.currentTarget.value })}
              required
            />

            <Textarea
              label="Açıklama"
              placeholder="Bu şablonun ne için kullanıldığını açıklayın"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
              minRows={2}
            />

            <Divider />

            <Group justify="space-between">
              <Text fw={600} size="lg">
                Modül İzinleri
              </Text>
              <Group gap="xs">
                <Button size="xs" variant="light" onClick={() => toggleAllPermissions(true)}>
                  Tümünü Aç
                </Button>
                <Button size="xs" variant="light" onClick={() => toggleAllPermissions(false)}>
                  Tümünü Kapat
                </Button>
              </Group>
            </Group>

            <Paper withBorder p="md" style={{ maxHeight: 400, overflow: 'auto' }}>
              <Stack gap="md">
                {modules.map((module) => {
                  const perms = formData.permissions[module.name] || {
                    view: false,
                    create: false,
                    edit: false,
                    delete: false,
                    export: false,
                  };
                  
                  const allChecked = Object.values(perms).every(Boolean);
                  const someChecked = Object.values(perms).some(Boolean);

                  return (
                    <div key={module.id}>
                      <Group justify="space-between" mb="xs">
                        <Group gap="xs">
                          <Checkbox
                            checked={allChecked}
                            indeterminate={someChecked && !allChecked}
                            onChange={(e) => toggleModuleAll(module.name, e.currentTarget.checked)}
                            label={module.display_name}
                          />
                        </Group>
                      </Group>
                      <SimpleGrid cols={5} spacing="xs" ml="xl">
                        <Checkbox
                          label="Görüntüle"
                          checked={perms.view}
                          onChange={(e) => togglePermission(module.name, 'view', e.currentTarget.checked)}
                        />
                        <Checkbox
                          label="Oluştur"
                          checked={perms.create}
                          onChange={(e) => togglePermission(module.name, 'create', e.currentTarget.checked)}
                        />
                        <Checkbox
                          label="Düzenle"
                          checked={perms.edit}
                          onChange={(e) => togglePermission(module.name, 'edit', e.currentTarget.checked)}
                        />
                        <Checkbox
                          label="Sil"
                          checked={perms.delete}
                          onChange={(e) => togglePermission(module.name, 'delete', e.currentTarget.checked)}
                        />
                        <Checkbox
                          label="Export"
                          checked={perms.export}
                          onChange={(e) => togglePermission(module.name, 'export', e.currentTarget.checked)}
                        />
                      </SimpleGrid>
                    </div>
                  );
                })}
              </Stack>
            </Paper>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => { closeModal(); resetForm(); }}>
                İptal
              </Button>
              <Button onClick={handleSave} loading={saving} leftSection={<IconCheck size={16} />}>
                {editingTemplate ? 'Güncelle' : 'Oluştur'}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
