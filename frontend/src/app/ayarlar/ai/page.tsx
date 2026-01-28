'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Code,
  ColorSwatch,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBolt,
  IconBrain,
  IconCheck,
  IconChevronLeft,
  IconClock,
  IconCopy,
  IconDatabase,
  IconDownload,
  IconEdit,
  IconEye,
  IconHistory,
  IconInfoCircle,
  IconPlus,
  IconRefresh,
  IconRobot,
  IconSettings,
  IconStar,
  IconTemplate,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { type AITemplate, aiAPI } from '@/lib/api/services/ai';

// Tip tanımları
interface PromptTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  icon: string;
  color: string;
  is_active: boolean;
  is_default: boolean;
  is_system: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface AIModel {
  id: string;
  name: string;
  description: string;
  icon: string;
  speed: 'fast' | 'slow';
  intelligence: 'high' | 'highest';
}

interface AISettings {
  default_model: string;
  available_models: AIModel[];
  auto_learn_enabled: boolean;
  auto_learn_threshold: number;
  max_memory_items: number;
  memory_retention_days: number;
  daily_snapshot_enabled: boolean;
  snapshot_time: string;
}

interface FeedbackStats {
  total: number;
  positive: number;
  negative: number;
  avg_rating: number;
  avg_response_time: number;
}

interface MemoryItem {
  id: number;
  memory_type: string;
  category: string;
  key: string;
  value: string;
  importance: number;
  usage_count: number;
}

// Renk seçenekleri
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

// Emoji seçenekleri
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

export default function AIAyarlariPage() {
  // Auth kontrolü api.ts tarafından otomatik yapılıyor
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('templates');

  // AI Settings state
  const [_aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [_settingsLoading, setSettingsLoading] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Editable settings state
  const [editableSettings, setEditableSettings] = useState({
    auto_learn_enabled: true,
    daily_snapshot_enabled: true,
    max_memory_items: 100,
    memory_retention_days: 365,
    auto_learn_threshold: 0.8,
    snapshot_time: '04:00',
  });

  // Feedback & Memory state
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);

  // Version History state
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [versionHistoryLoading, setVersionHistoryLoading] = useState(false);
  const [selectedSettingKey, setSelectedSettingKey] = useState<string>('');

  // Import/Export state
  const [importModalOpened, { open: openImportModal, close: closeImportModal }] =
    useDisclosure(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    category: 'Genel',
    icon: '🤖',
    color: 'blue',
    is_active: true,
    preferred_model: '', // Boş = varsayılan model kullanılır
  });

  const categories = ['Genel', 'Muhasebe', 'İhale', 'Risk', 'Strateji', 'Raporlama'];

  // Şablonları API'den yükle
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await aiAPI.getTemplates();

      if (data.success) {
        // Backend'den gelen format: { success: true, data: { templates: [...] } }
        const templates = data.data?.templates || [];
        setTemplates(templates as unknown as PromptTemplate[]);
      } else {
        setError(data.error || 'Şablonlar yüklenemedi');
      }
    } catch (err) {
      console.error('Template fetch error:', err);
      setError('Sunucuya bağlanılamadı');
      setTemplates([]); // Hata durumunda boş array set et
    } finally {
      setLoading(false);
    }
  }, []);

  // AI ayarlarını yükle
  const fetchAISettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const [settingsData, modelsData] = await Promise.all([
        aiAPI.getSettings(),
        aiAPI.getModels(),
      ]);

      if (settingsData.success) {
        // Backend'den gelen format: { success: true, data: { settings: {...} } }
        const settings = (settingsData.data?.settings as any) || {};

        setAiSettings(settings as unknown as AISettings);

        // Editable settings'i parse et (JSONB'den gelen değerler parse edilmiş olabilir)
        const parseValue = (value: any, defaultValue: any) => {
          if (value === null || value === undefined) return defaultValue;
          // Eğer string ise ve JSON gibi görünüyorsa parse et
          if (
            typeof value === 'string' &&
            (value.startsWith('"') || value.startsWith('[') || value.startsWith('{'))
          ) {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return value;
        };

        setEditableSettings({
          auto_learn_enabled: parseValue(settings.auto_learn_enabled, true),
          daily_snapshot_enabled: parseValue(settings.daily_snapshot_enabled, true),
          max_memory_items: parseValue(settings.max_memory_items, 100),
          memory_retention_days: parseValue(settings.memory_retention_days, 365),
          auto_learn_threshold: parseValue(settings.auto_learn_threshold, 0.8),
          snapshot_time: parseValue(settings.snapshot_time, '04:00'),
        });
      }

      if (modelsData.success) {
        // Backend'den gelen format: { success: true, data: { models: [...], defaultModel: ... } }
        const models = modelsData.data?.models || [];
        const defaultModel = modelsData.data?.defaultModel || '';
        setAvailableModels(models as unknown as AIModel[]);
        setSelectedModel(defaultModel);
      }
    } catch (err) {
      console.error('Settings fetch error:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // AI ayarlarını export et
  const handleExportSettings = async () => {
    setExporting(true);
    try {
      const blob = await aiAPI.exportSettings();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-settings-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      notifications.show({
        title: 'Başarılı',
        message: 'AI ayarları export edildi',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.response?.data?.error || 'Export başarısız',
        color: 'red',
      });
    } finally {
      setExporting(false);
    }
  };

  // Import dosyası seçildiğinde
  const handleImportFileSelect = (file: File | null) => {
    if (!file) {
      setImportFile(null);
      setImportPreview(null);
      return;
    }

    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        setImportPreview(parsed);
      } catch (_error) {
        notifications.show({
          title: 'Hata',
          message: 'Geçersiz JSON dosyası',
          color: 'red',
        });
        setImportFile(null);
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };

  // AI ayarlarını import et
  const handleImportSettings = async (overwrite: boolean = false) => {
    if (!importPreview?.settings) {
      notifications.show({
        title: 'Hata',
        message: 'Geçersiz import dosyası',
        color: 'red',
      });
      return;
    }

    setImporting(true);
    try {
      const data = await aiAPI.importSettings(importPreview.settings, overwrite);

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: (data.data as any).message || `${data.data.imported} ayar import edildi`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        // Ayarları yeniden yükle
        await fetchAISettings();
        closeImportModal();
        setImportFile(null);
        setImportPreview(null);
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Import başarısız',
          color: 'red',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.response?.data?.error || 'Import başarısız',
        color: 'red',
      });
    } finally {
      setImporting(false);
    }
  };

  // Versiyon geçmişini yükle
  const fetchVersionHistory = useCallback(async () => {
    setVersionHistoryLoading(true);
    try {
      const data = await aiAPI.getSettingsHistory(selectedSettingKey || undefined, 100);
      if (data.success && data.data) {
        setVersionHistory(data.data.history || []);
      }
    } catch (error) {
      console.error('Version history fetch error:', error);
      notifications.show({
        title: 'Hata',
        message: 'Versiyon geçmişi yüklenemedi',
        color: 'red',
      });
    } finally {
      setVersionHistoryLoading(false);
    }
  }, [selectedSettingKey]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchVersionHistory();
    }
  }, [activeTab, fetchVersionHistory]);

  // Versiyona geri dön
  const handleRestoreVersion = async (settingKey: string, version: number) => {
    if (!confirm(`Versiyon ${version} geri yüklenecek. Devam etmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const data = await aiAPI.restoreVersion(settingKey, version, 'Versiyon geri yüklendi');

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `Versiyon ${version} geri yüklendi`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchVersionHistory();
        // Ayarları da yeniden yükle
        await fetchAISettings();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Geri yükleme başarısız',
          color: 'red',
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası',
        color: 'red',
      });
    }
  };

  // AI ayarlarını kaydet
  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      // JSON parse edilmiş değerleri string'e çevir
      const settingsToSave: Record<string, any> = {
        auto_learn_enabled: editableSettings.auto_learn_enabled,
        daily_snapshot_enabled: editableSettings.daily_snapshot_enabled,
        max_memory_items: editableSettings.max_memory_items,
        memory_retention_days: editableSettings.memory_retention_days,
        auto_learn_threshold: editableSettings.auto_learn_threshold,
        snapshot_time: editableSettings.snapshot_time,
      };

      const data = await aiAPI.updateSettings(settingsToSave);

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'AI ayarları güncellendi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        // Ayarları yeniden yükle
        await fetchAISettings();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Ayarlar güncellenemedi',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (err) {
      console.error('Save settings error:', err);
      notifications.show({
        title: 'Hata',
        message: 'Sunucu hatası oluştu',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  // Feedback istatistiklerini yükle
  const fetchFeedbackStats = useCallback(async () => {
    try {
      const data = await aiAPI.getFeedbackStats();
      if (data.success) {
        // Backend'den gelen format: { success: true, data: { stats: {...} } }
        const stats = data.data?.stats;
        if (stats) {
          setFeedbackStats(stats as unknown as FeedbackStats);
        }
      }
    } catch (err) {
      console.error('Feedback stats error:', err);
    }
  }, []);

  // Hafızayı yükle
  const fetchMemories = useCallback(async () => {
    try {
      setMemoriesLoading(true);
      const data = await aiAPI.getMemories({ limit: 20 });
      if (data.success) {
        // Backend'den gelen format: { success: true, data: { memories: [...] } }
        const memories = data.data?.memories || [];
        setMemories(memories as unknown as MemoryItem[]);
      }
    } catch (err) {
      console.error('Memory fetch error:', err);
      setMemories([]); // Hata durumunda boş array set et
    } finally {
      setMemoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchAISettings();
    fetchFeedbackStats();
    fetchMemories();
  }, [fetchAISettings, fetchFeedbackStats, fetchMemories, fetchTemplates]);

  // Model değiştir
  const handleModelChange = async (modelId: string) => {
    if (!modelId || modelId === selectedModel) return;

    setModelSaving(true);
    try {
      const data = await aiAPI.updateModel(modelId);

      if (data.success) {
        setSelectedModel(modelId);
        notifications.show({
          title: 'Model Değiştirildi',
          message: data.message || 'Model başarıyla değiştirildi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Model değiştirilemedi',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (_err) {
      notifications.show({
        title: 'Hata',
        message: 'Model değiştirilemedi',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setModelSaving(false);
    }
  };

  // Hafıza sil
  const handleDeleteMemory = async (id: number) => {
    try {
      const data = await aiAPI.deleteMemory(id);

      if (data.success) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        notifications.show({
          title: 'Silindi',
          message: 'Hafıza öğesi silindi',
          color: 'green',
        });
      }
    } catch (_err) {
      notifications.show({
        title: 'Hata',
        message: 'Silinemedi',
        color: 'red',
      });
    }
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
      preferred_model: (template as any).preferred_model || '',
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

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconChevronLeft size={16} />}
              component="a"
              href="/ayarlar"
            >
              Geri
            </Button>
            <div>
              <Title order={1} size="h2" mb={4}>
                🤖 AI Asistan Ayarları
              </Title>
              <Text c="dimmed" size="lg">
                Yapay zeka prompt şablonları ve davranış ayarları
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="green"
              leftSection={<IconDownload size={16} />}
              onClick={handleExportSettings}
              loading={exporting}
            >
              Export
            </Button>
            <Button
              variant="light"
              color="blue"
              leftSection={<IconUpload size={16} />}
              onClick={openImportModal}
            >
              Import
            </Button>
            <Button
              variant="subtle"
              leftSection={<IconRefresh size={16} />}
              onClick={fetchTemplates}
              loading={loading}
            >
              Yenile
            </Button>
            <Badge size="lg" variant="light" color="violet">
              {templates.filter((t) => t.is_active).length} Aktif Şablon
            </Badge>
          </Group>
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Hata">
            {error}
          </Alert>
        )}

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="templates" leftSection={<IconTemplate size={16} />}>
              Prompt Şablonları
            </Tabs.Tab>
            <Tabs.Tab value="behavior" leftSection={<IconBrain size={16} />}>
              AI Davranışı
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              Genel Ayarlar
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
              Versiyon Geçmişi
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="templates" pt="xl">
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
          </Tabs.Panel>

          <Tabs.Panel value="behavior" pt="xl">
            <Stack gap="lg">
              {/* Model Seçimi */}
              <Card withBorder p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600} size="lg">
                        🧠 AI Model Seçimi
                      </Text>
                      <Text c="dimmed" size="sm">
                        Kullanılacak yapay zeka modelini seçin
                      </Text>
                    </div>
                    {modelSaving && <Loader size="sm" />}
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    {availableModels.map((model) => (
                      <Card
                        key={model.id}
                        withBorder
                        p="md"
                        style={{
                          cursor: 'pointer',
                          borderColor:
                            selectedModel === model.id
                              ? 'var(--mantine-color-violet-5)'
                              : undefined,
                          borderWidth: selectedModel === model.id ? 2 : 1,
                          backgroundColor:
                            selectedModel === model.id
                              ? 'var(--mantine-color-violet-0)'
                              : undefined,
                        }}
                        onClick={() => handleModelChange(model.id)}
                      >
                        <Group justify="space-between" mb="xs">
                          <Group gap="xs">
                            <Text size="xl">{model.icon}</Text>
                            <div>
                              <Text fw={600}>{model.name}</Text>
                              <Text size="xs" c="dimmed">
                                {model.description}
                              </Text>
                            </div>
                          </Group>
                          {selectedModel === model.id && (
                            <ThemeIcon color="violet" variant="filled" radius="xl" size="sm">
                              <IconCheck size={12} />
                            </ThemeIcon>
                          )}
                        </Group>
                        <Group gap="xs" mt="sm">
                          <Badge
                            size="xs"
                            variant="light"
                            color={model.speed === 'fast' ? 'green' : 'orange'}
                            leftSection={<IconBolt size={10} />}
                          >
                            {model.speed === 'fast' ? 'Hızlı' : 'Yavaş'}
                          </Badge>
                          <Badge
                            size="xs"
                            variant="light"
                            color={model.intelligence === 'highest' ? 'violet' : 'blue'}
                            leftSection={<IconStar size={10} />}
                          >
                            {model.intelligence === 'highest' ? 'En Akıllı' : 'Akıllı'}
                          </Badge>
                        </Group>
                      </Card>
                    ))}
                  </SimpleGrid>
                </Stack>
              </Card>

              {/* Feedback İstatistikleri */}
              <Card withBorder p="lg">
                <Stack gap="md">
                  <div>
                    <Text fw={600} size="lg">
                      📊 Geri Bildirim İstatistikleri
                    </Text>
                    <Text c="dimmed" size="sm">
                      Son 30 günlük AI performansı
                    </Text>
                  </div>

                  {feedbackStats ? (
                    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                      <Card withBorder p="md" ta="center">
                        <Text size="xs" c="dimmed" mb="xs">
                          Toplam Feedback
                        </Text>
                        <Text size="xl" fw={700}>
                          {feedbackStats.total || 0}
                        </Text>
                      </Card>
                      <Card withBorder p="md" ta="center">
                        <Text size="xs" c="dimmed" mb="xs">
                          Olumlu
                        </Text>
                        <Group justify="center" gap={4}>
                          <IconThumbUp size={16} color="var(--mantine-color-green-6)" />
                          <Text size="xl" fw={700} c="green">
                            {feedbackStats.positive || 0}
                          </Text>
                        </Group>
                      </Card>
                      <Card withBorder p="md" ta="center">
                        <Text size="xs" c="dimmed" mb="xs">
                          Olumsuz
                        </Text>
                        <Group justify="center" gap={4}>
                          <IconThumbDown size={16} color="var(--mantine-color-red-6)" />
                          <Text size="xl" fw={700} c="red">
                            {feedbackStats.negative || 0}
                          </Text>
                        </Group>
                      </Card>
                      <Card withBorder p="md" ta="center">
                        <Text size="xs" c="dimmed" mb="xs">
                          Ort. Puan
                        </Text>
                        <Text size="xl" fw={700} c="violet">
                          {feedbackStats.avg_rating || '-'}
                        </Text>
                      </Card>
                    </SimpleGrid>
                  ) : (
                    <Center py="xl">
                      <Text c="dimmed">Henüz veri yok</Text>
                    </Center>
                  )}
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="settings" pt="xl">
            <Stack gap="lg">
              {/* Hafıza Yönetimi */}
              <Card withBorder p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600} size="lg">
                        🧠 AI Hafızası
                      </Text>
                      <Text c="dimmed" size="sm">
                        AI&apos;ın öğrendiği bilgiler ve tercihler
                      </Text>
                    </div>
                    <Button
                      variant="subtle"
                      leftSection={<IconRefresh size={16} />}
                      onClick={fetchMemories}
                      loading={memoriesLoading}
                      size="xs"
                    >
                      Yenile
                    </Button>
                  </Group>

                  {memoriesLoading ? (
                    <Stack gap="xs">
                      <Skeleton height={40} />
                      <Skeleton height={40} />
                      <Skeleton height={40} />
                    </Stack>
                  ) : memories.length > 0 ? (
                    <Paper withBorder>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Tip</Table.Th>
                            <Table.Th>Anahtar</Table.Th>
                            <Table.Th>Değer</Table.Th>
                            <Table.Th>Önem</Table.Th>
                            <Table.Th w={60}>İşlem</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {memories.map((memory) => (
                            <Table.Tr key={memory.id}>
                              <Table.Td>
                                <Badge
                                  size="sm"
                                  variant="light"
                                  color={
                                    memory.memory_type === 'fact'
                                      ? 'blue'
                                      : memory.memory_type === 'preference'
                                        ? 'green'
                                        : 'orange'
                                  }
                                >
                                  {memory.memory_type}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" fw={500}>
                                  {memory.key}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" lineClamp={1}>
                                  {memory.value}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Progress
                                  value={memory.importance * 10}
                                  size="sm"
                                  w={60}
                                  color={
                                    memory.importance >= 8
                                      ? 'green'
                                      : memory.importance >= 5
                                        ? 'yellow'
                                        : 'gray'
                                  }
                                />
                              </Table.Td>
                              <Table.Td>
                                <ActionIcon
                                  size="sm"
                                  color="red"
                                  variant="subtle"
                                  onClick={() => handleDeleteMemory(memory.id)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Paper>
                  ) : (
                    <Center py="xl">
                      <Stack align="center" gap="xs">
                        <ThemeIcon size={48} variant="light" color="gray" radius="xl">
                          <IconDatabase size={24} />
                        </ThemeIcon>
                        <Text c="dimmed">AI henüz bir şey öğrenmedi</Text>
                        <Text c="dimmed" size="xs">
                          Sohbet ettikçe otomatik öğrenecek
                        </Text>
                      </Stack>
                    </Center>
                  )}
                </Stack>
              </Card>

              {/* Öğrenme Ayarları */}
              <Card withBorder p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600} size="lg">
                        ⚙️ Öğrenme Ayarları
                      </Text>
                      <Text c="dimmed" size="sm">
                        Otomatik öğrenme ve hafıza ayarları
                      </Text>
                    </div>
                    <Button
                      onClick={handleSaveSettings}
                      loading={settingsSaving}
                      leftSection={<IconCheck size={16} />}
                      color="violet"
                    >
                      Kaydet
                    </Button>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Switch
                      label="Otomatik Öğrenme"
                      description="Konuşmalardan otomatik bilgi çıkarımı"
                      checked={editableSettings.auto_learn_enabled}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          auto_learn_enabled: e.currentTarget.checked,
                        })
                      }
                    />
                    <Switch
                      label="Günlük Özet"
                      description="Her gün sistem durumu özeti oluştur"
                      checked={editableSettings.daily_snapshot_enabled}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          daily_snapshot_enabled: e.currentTarget.checked,
                        })
                      }
                    />
                  </SimpleGrid>

                  <Divider />

                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                    <NumberInput
                      label="Maksimum Hafıza"
                      description="AI'ın saklayabileceği maksimum hafıza öğesi sayısı"
                      value={editableSettings.max_memory_items}
                      onChange={(value) =>
                        setEditableSettings({
                          ...editableSettings,
                          max_memory_items: Number(value) || 100,
                        })
                      }
                      min={10}
                      max={1000}
                      step={10}
                    />
                    <NumberInput
                      label="Saklama Süresi (Gün)"
                      description="Hafıza öğelerinin saklanacağı süre"
                      value={editableSettings.memory_retention_days}
                      onChange={(value) =>
                        setEditableSettings({
                          ...editableSettings,
                          memory_retention_days: Number(value) || 365,
                        })
                      }
                      min={30}
                      max={3650}
                      step={30}
                    />
                    <NumberInput
                      label="Güven Eşiği (%)"
                      description="Otomatik öğrenme için minimum güven seviyesi"
                      value={editableSettings.auto_learn_threshold * 100}
                      onChange={(value) =>
                        setEditableSettings({
                          ...editableSettings,
                          auto_learn_threshold: (Number(value) || 80) / 100,
                        })
                      }
                      min={50}
                      max={100}
                      step={5}
                      suffix="%"
                    />
                  </SimpleGrid>

                  {editableSettings.daily_snapshot_enabled && (
                    <TextInput
                      label="Günlük Özet Saati"
                      description="Günlük özetin oluşturulacağı saat (HH:MM formatında)"
                      type="time"
                      value={editableSettings.snapshot_time}
                      onChange={(e) =>
                        setEditableSettings({
                          ...editableSettings,
                          snapshot_time: e.currentTarget.value || '04:00',
                        })
                      }
                    />
                  )}
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="xl">
            <Stack gap="lg">
              <Card withBorder p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600} size="lg">
                        📚 Versiyon Geçmişi
                      </Text>
                      <Text c="dimmed" size="sm">
                        AI ayarlarının değişiklik geçmişi ve geri yükleme
                      </Text>
                    </div>
                    <Group>
                      <Select
                        placeholder="Tüm ayarlar"
                        value={selectedSettingKey}
                        onChange={(value) => setSelectedSettingKey(value || '')}
                        data={[
                          { value: '', label: 'Tüm Ayarlar' },
                          { value: 'default_model', label: 'Varsayılan Model' },
                          { value: 'auto_learn_enabled', label: 'Otomatik Öğrenme' },
                          { value: 'max_memory_items', label: 'Maksimum Hafıza' },
                          { value: 'memory_retention_days', label: 'Hafıza Saklama Süresi' },
                          { value: 'auto_learn_threshold', label: 'Öğrenme Eşiği' },
                          { value: 'daily_snapshot_enabled', label: 'Günlük Özet' },
                          { value: 'snapshot_time', label: 'Özet Saati' },
                        ]}
                        clearable
                        style={{ width: 200 }}
                      />
                      <ActionIcon
                        variant="light"
                        size="lg"
                        onClick={fetchVersionHistory}
                        loading={versionHistoryLoading}
                      >
                        <IconRefresh size={18} />
                      </ActionIcon>
                    </Group>
                  </Group>

                  {versionHistoryLoading ? (
                    <Center py="xl">
                      <Loader />
                    </Center>
                  ) : versionHistory.length === 0 ? (
                    <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                      Henüz versiyon geçmişi yok
                    </Alert>
                  ) : (
                    <Paper withBorder>
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Ayar</Table.Th>
                            <Table.Th>Versiyon</Table.Th>
                            <Table.Th>Değer</Table.Th>
                            <Table.Th>Değiştiren</Table.Th>
                            <Table.Th>Not</Table.Th>
                            <Table.Th>Tarih</Table.Th>
                            <Table.Th ta="right">İşlem</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {versionHistory.map((item) => {
                            let displayValue = '';
                            try {
                              const parsed =
                                typeof item.setting_value === 'string'
                                  ? JSON.parse(item.setting_value)
                                  : item.setting_value;

                              if (typeof parsed === 'boolean') {
                                displayValue = parsed ? 'Açık' : 'Kapalı';
                              } else if (typeof parsed === 'number') {
                                displayValue = parsed.toString();
                              } else if (typeof parsed === 'string') {
                                displayValue =
                                  parsed.length > 50 ? `${parsed.substring(0, 50)}...` : parsed;
                              } else {
                                displayValue = `${JSON.stringify(parsed).substring(0, 50)}...`;
                              }
                            } catch {
                              displayValue = String(item.setting_value).substring(0, 50);
                            }

                            return (
                              <Table.Tr key={item.id}>
                                <Table.Td>
                                  <Text size="sm" fw={500} ff="monospace">
                                    {item.setting_key}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Badge variant="light" color="blue">
                                    v{item.version}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                    style={{ maxWidth: 200 }}
                                    lineClamp={1}
                                  >
                                    {displayValue}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm">
                                    {item.user_name || item.user_email || 'Sistem'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                    style={{ maxWidth: 150 }}
                                    lineClamp={1}
                                  >
                                    {item.change_note || '-'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm" c="dimmed">
                                    {new Date(item.created_at).toLocaleString('tr-TR')}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Tooltip label="Bu versiyona geri dön">
                                    <ActionIcon
                                      variant="subtle"
                                      color="green"
                                      onClick={() =>
                                        handleRestoreVersion(item.setting_key, item.version)
                                      }
                                    >
                                      <IconClock size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    </Paper>
                  )}
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {/* Şablon Ekleme/Düzenleme Modal */}
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

            {/* Model Seçimi */}
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

        {/* Önizleme Modal */}
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

        {/* Import Modal */}
        <Modal
          opened={importModalOpened}
          onClose={closeImportModal}
          title="AI Ayarları Import"
          size="lg"
        >
          <Stack gap="md">
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              <Text size="sm">
                JSON formatında export edilmiş ayar dosyasını seçin. Mevcut ayarların üzerine
                yazılacak.
              </Text>
            </Alert>

            <div>
              <Text size="sm" fw={500} mb="xs">
                Dosya Seç
              </Text>
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleImportFileSelect(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
                id="import-file-input"
              />
              <label htmlFor="import-file-input">
                <Button
                  component="span"
                  variant="light"
                  leftSection={<IconUpload size={16} />}
                  fullWidth
                >
                  {importFile ? importFile.name : 'Dosya Seç'}
                </Button>
              </label>
            </div>

            {importPreview && (
              <div>
                <Text size="sm" fw={500} mb="xs">
                  Önizleme
                </Text>
                <Paper withBorder p="md" style={{ maxHeight: 300, overflow: 'auto' }}>
                  <Code block>{JSON.stringify(importPreview, null, 2)}</Code>
                </Paper>
                {importPreview.metadata && (
                  <Text size="xs" c="dimmed" mt="xs">
                    Export Tarihi:{' '}
                    {new Date(importPreview.metadata.exported_at).toLocaleString('tr-TR')} |
                    Versiyon: {importPreview.metadata.version} | Ayar Sayısı:{' '}
                    {importPreview.metadata.count}
                  </Text>
                )}
              </div>
            )}

            {importPreview && (
              <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
                <Text size="sm">
                  <strong>Uyarı:</strong> Bu işlem mevcut ayarların üzerine yazacak. Devam etmek
                  istediğinize emin misiniz?
                </Text>
              </Alert>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeImportModal}>
                İptal
              </Button>
              {importPreview && (
                <>
                  <Button
                    variant="light"
                    color="orange"
                    onClick={() => handleImportSettings(false)}
                    loading={importing}
                  >
                    Mevcutları Koru
                  </Button>
                  <Button
                    color="red"
                    onClick={() => handleImportSettings(true)}
                    loading={importing}
                    leftSection={<IconCheck size={16} />}
                  >
                    Üzerine Yaz
                  </Button>
                </>
              )}
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
