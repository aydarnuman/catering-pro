'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Code,
  ColorSwatch,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconEye,
  IconInfoCircle,
  IconPlus,
  IconRobot,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { type AITemplate, aiAPI } from '@/lib/api/services/ai';
import type { AIModel, PromptTemplate, TemplateFormData } from './types';

// Renk secenekleri
const colorOptions = [
  { value: 'blue', label: 'Mavi', color: '#228be6' },
  { value: 'green', label: 'Yeşil', color: '#40c057' },
  { value: 'red', label: 'Kırmızı', color: '#fa5252' },
  { value: 'yellow', label: 'Sarı', color: '#fab005' },
  { value: 'violet', label: 'Mor', color: '#7950f2' },
  { value: 'cyan', label: 'Turkuaz', color: '#15aabf' },
  { value: 'orange', label: 'Turuncu', color: '#fd7e14' },
  { value: 'pink', label: 'Pembe', color: '#e64980' },
  { value: 'gray', label: 'Gri', color: '#868e96' },
];

// Emoji secenekleri
const iconOptions = [
  '🤖',
  '📈',
  '⚠️',
  '📋',
  '⚡',
  '🎯',
  '💡',
  '🔍',
  '📊',
  '💰',
  '🏢',
  '📝',
  '🛡️',
  '🎨',
  '⚙️',
  '🚀',
  '💼',
  '📌',
  '🔔',
  '✨',
];

const categories = ['Genel', 'Muhasebe', 'İhale', 'Risk', 'Strateji', 'Raporlama'];

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    Genel: 'gray',
    Muhasebe: 'green',
    İhale: 'violet',
    Risk: 'red',
    Strateji: 'cyan',
    Raporlama: 'blue',
  };
  return colors[category] || 'gray';
};

interface TemplatesTabProps {
  availableModels: AIModel[];
}

export default function TemplatesTab({ availableModels }: TemplatesTabProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);

  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    prompt: '',
    category: 'Genel',
    icon: '🤖',
    color: 'blue',
    is_active: true,
    preferred_model: '',
  });

  // Sablonlari API'den yukle
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aiAPI.getTemplates();
      if (data.success) {
        const templates = data.data?.templates || [];
        setTemplates(templates as unknown as PromptTemplate[]);
      }
    } catch (err) {
      console.error('Template fetch error:', err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      prompt: '',
      category: 'Genel',
      icon: '🤖',
      color: 'blue',
      is_active: true,
      preferred_model: '',
    });
    setEditingTemplate(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.prompt) {
      notifications.show({
        title: 'Hata',
        message: 'Ad ve prompt alanları zorunludur',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    setSaving(true);
    try {
      const data = editingTemplate
        ? await aiAPI.updateTemplate(editingTemplate.id, formData)
        : await aiAPI.createTemplate(formData);

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: editingTemplate ? 'Şablon güncellendi' : 'Yeni şablon eklendi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchTemplates();
        resetForm();
        close();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'İşlem başarısız',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (err) {
      console.error('Save error:', err);
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası oluştu',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      prompt: template.prompt,
      category: template.category,
      icon: template.icon || '🤖',
      color: template.color || 'blue',
      is_active: template.is_active,
      preferred_model: template.preferred_model || '',
    });
    open();
  };

  const handleDelete = async (id: number) => {
    const template = templates.find((t) => t.id === id);
    if (template?.is_system) {
      notifications.show({
        title: 'Uyarı',
        message: 'Sistem şablonları silinemez',
        color: 'orange',
        icon: <IconInfoCircle size={16} />,
      });
      return;
    }

    if (!confirm('Bu şablonu silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const data = await aiAPI.deleteTemplate(id);
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Şablon silindi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchTemplates();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Silme başarısız',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (err) {
      console.error('Delete error:', err);
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası oluştu',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const toggleActive = async (template: PromptTemplate) => {
    try {
      const data = await aiAPI.updateTemplate(template.id, {
        is_active: !template.is_active,
      } as Partial<AITemplate>);
      if (data.success) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === template.id ? { ...t, is_active: !t.is_active } : t))
        );
      }
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    notifications.show({
      title: 'Kopyalandı',
      message: 'Prompt panoya kopyalandı',
      color: 'blue',
      icon: <IconCopy size={16} />,
    });
  };

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="lg" fw={500}>
            Prompt Şablonları
          </Text>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              resetForm();
              open();
            }}
            color="violet"
          >
            Yeni Şablon
          </Button>
        </Group>

        {loading ? (
          <Stack gap="sm">
            <Skeleton height={60} />
            <Skeleton height={60} />
            <Skeleton height={60} />
          </Stack>
        ) : (
          <Paper withBorder>
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Şablon</Table.Th>
                    <Table.Th>Kategori</Table.Th>
                    <Table.Th>Kullanım</Table.Th>
                    <Table.Th>Durum</Table.Th>
                    <Table.Th style={{ width: 140 }}>İşlemler</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {templates.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Center py="xl">
                          <Stack align="center" gap="xs">
                            <IconRobot size={48} stroke={1.5} color="gray" />
                            <Text c="dimmed">Henüz şablon yok</Text>
                            <Button
                              size="sm"
                              variant="light"
                              onClick={() => {
                                resetForm();
                                open();
                              }}
                            >
                              İlk şablonu oluştur
                            </Button>
                          </Stack>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    templates.map((template) => (
                      <Table.Tr key={template.id}>
                        <Table.Td>
                          <Stack gap={4}>
                            <Group gap="xs">
                              <Text size="lg">{template.icon}</Text>
                              <Text fw={500}>
                                {template.name.replace(
                                  /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u,
                                  ''
                                )}
                              </Text>
                              {template.is_system && (
                                <Badge size="xs" color="blue" variant="light">
                                  Sistem
                                </Badge>
                              )}
                              {template.is_default && (
                                <Badge size="xs" color="green" variant="light">
                                  Varsayılan
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {template.description || 'Açıklama yok'}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light"
                            size="sm"
                            color={getCategoryColor(template.category)}
                          >
                            {template.category}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {template.usage_count} kez
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Switch
                            checked={template.is_active}
                            onChange={() => toggleActive(template)}
                            size="sm"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Tooltip label="Önizle">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  openPreview();
                                }}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Düzenle">
                              <ActionIcon
                                variant="subtle"
                                color="yellow"
                                onClick={() => handleEdit(template)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Kopyala">
                              <ActionIcon
                                variant="subtle"
                                color="green"
                                onClick={() => copyPrompt(template.prompt)}
                              >
                                <IconCopy size={16} />
                              </ActionIcon>
                            </Tooltip>
                            {!template.is_system && (
                              <Tooltip label="Sil">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  onClick={() => handleDelete(template.id)}
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </Stack>

      {/* Sablon Ekleme/Duzenleme Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={editingTemplate ? 'Şablon Düzenle' : 'Yeni Şablon'}
        size="lg"
      >
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Şablon Adı"
              placeholder="Örn: CFO Analizi"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
              required
            />
            <Select
              label="Kategori"
              data={categories}
              value={formData.category}
              onChange={(value) => setFormData({ ...formData, category: value || 'Genel' })}
            />
          </Group>

          <TextInput
            label="Açıklama"
            placeholder="Bu şablonun ne için kullanıldığını açıklayın"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
          />

          <Select
            label="AI Model"
            description="Bu şablon için özel model seçin (boş = varsayılan model)"
            placeholder="Varsayılan modeli kullan"
            data={[
              { value: '', label: '⚡ Varsayılan (Ayarlardan)' },
              ...(availableModels || []).map((m) => ({
                value: String(m.id),
                label: `${m.icon} ${m.name} - ${m.description}`,
              })),
            ]}
            value={formData.preferred_model}
            onChange={(value) => setFormData({ ...formData, preferred_model: value || '' })}
            clearable
          />

          <Group grow>
            <div>
              <Text size="sm" fw={500} mb="xs">
                İkon
              </Text>
              <Group gap="xs">
                {iconOptions.map((icon) => (
                  <ActionIcon
                    key={icon}
                    variant={formData.icon === icon ? 'filled' : 'light'}
                    color={formData.icon === icon ? 'violet' : 'gray'}
                    size="lg"
                    onClick={() => setFormData({ ...formData, icon })}
                  >
                    {icon}
                  </ActionIcon>
                ))}
              </Group>
            </div>
          </Group>

          <div>
            <Text size="sm" fw={500} mb="xs">
              Renk
            </Text>
            <Group gap="xs">
              {colorOptions.map((opt) => (
                <Tooltip key={opt.value} label={opt.label}>
                  <ActionIcon
                    variant={formData.color === opt.value ? 'filled' : 'outline'}
                    color={opt.value}
                    size="lg"
                    onClick={() => setFormData({ ...formData, color: opt.value })}
                  >
                    <ColorSwatch color={opt.color} size={20} />
                  </ActionIcon>
                </Tooltip>
              ))}
            </Group>
          </div>

          <Textarea
            label="Prompt"
            placeholder="AI'nın nasıl davranması gerektiğini açıklayın..."
            value={formData.prompt}
            onChange={(e) => setFormData({ ...formData, prompt: e.currentTarget.value })}
            minRows={8}
            required
          />

          <Switch
            label="Aktif"
            description="Bu şablon kullanıma açık olsun"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.currentTarget.checked })}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={close}>
              İptal
            </Button>
            <Button color="violet" onClick={handleSave} loading={saving}>
              {editingTemplate ? 'Güncelle' : 'Kaydet'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Onizleme Modal */}
      <Modal opened={previewOpened} onClose={closePreview} title="Şablon Önizleme" size="lg">
        {selectedTemplate && (
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <Text size="xl">{selectedTemplate.icon}</Text>
                <Title order={4}>
                  {selectedTemplate.name.replace(
                    /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u,
                    ''
                  )}
                </Title>
              </Group>
              <Group gap="xs">
                <Badge variant="light" color={getCategoryColor(selectedTemplate.category)}>
                  {selectedTemplate.category}
                </Badge>
                {selectedTemplate.is_system && (
                  <Badge variant="light" color="blue">
                    Sistem
                  </Badge>
                )}
              </Group>
            </Group>

            <Text c="dimmed">{selectedTemplate.description || 'Açıklama yok'}</Text>

            <Divider />

            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  Prompt İçeriği:
                </Text>
                <Text size="xs" c="dimmed">
                  Kullanım: {selectedTemplate.usage_count} kez
                </Text>
              </Group>
              <Code block style={{ whiteSpace: 'pre-wrap' }}>
                {selectedTemplate.prompt}
              </Code>
            </div>

            <Group justify="flex-end">
              <Button
                variant="light"
                leftSection={<IconCopy size={16} />}
                onClick={() => copyPrompt(selectedTemplate.prompt)}
              >
                Kopyala
              </Button>
              <Button onClick={closePreview}>Kapat</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
