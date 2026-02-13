'use client';

import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBolt,
  IconCheck,
  IconClock,
  IconDatabase,
  IconInfoCircle,
  IconRefresh,
  IconStar,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import type { AIModel, EditableSettings, FeedbackStats, MemoryItem, VersionHistoryItem } from './types';

export default function ModelSettingsTab() {
  // Model state
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelSaving, setModelSaving] = useState(false);

  // Editable settings state
  const [editableSettings, setEditableSettings] = useState<EditableSettings>({
    auto_learn_enabled: true,
    daily_snapshot_enabled: true,
    max_memory_items: 100,
    memory_retention_days: 365,
    auto_learn_threshold: 0.8,
    snapshot_time: '04:00',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Feedback & Memory state
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);

  // Version History state
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [versionHistoryLoading, setVersionHistoryLoading] = useState(false);
  const [selectedSettingKey, setSelectedSettingKey] = useState<string>('');

  // ─── Data Fetching ──────────────────────────────────────────

  const fetchAISettings = useCallback(async () => {
    try {
      const [settingsData, modelsData] = await Promise.all([aiAPI.getSettings(), aiAPI.getModels()]);

      if (settingsData.success) {
        const settings = (settingsData.data?.settings as Record<string, unknown>) || {};

        const parseValue = (value: unknown, defaultValue: unknown) => {
          if (value === null || value === undefined) return defaultValue;
          if (typeof value === 'string' && (value.startsWith('"') || value.startsWith('[') || value.startsWith('{'))) {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return value;
        };

        setEditableSettings({
          auto_learn_enabled: parseValue(settings.auto_learn_enabled, true) as boolean,
          daily_snapshot_enabled: parseValue(settings.daily_snapshot_enabled, true) as boolean,
          max_memory_items: parseValue(settings.max_memory_items, 100) as number,
          memory_retention_days: parseValue(settings.memory_retention_days, 365) as number,
          auto_learn_threshold: parseValue(settings.auto_learn_threshold, 0.8) as number,
          snapshot_time: parseValue(settings.snapshot_time, '04:00') as string,
        });
      }

      if (modelsData.success) {
        const models = modelsData.data?.models || [];
        const defaultModel = modelsData.data?.defaultModel || '';
        setAvailableModels(models as unknown as AIModel[]);
        setSelectedModel(defaultModel);
      }
    } catch (err) {
      console.error('Settings fetch error:', err);
    }
  }, []);

  const fetchFeedbackStats = useCallback(async () => {
    try {
      const data = await aiAPI.getFeedbackStats();
      if (data.success) {
        const stats = data.data?.stats;
        if (stats) {
          setFeedbackStats(stats as unknown as FeedbackStats);
        }
      }
    } catch (err) {
      console.error('Feedback stats error:', err);
    }
  }, []);

  const fetchMemories = useCallback(async () => {
    try {
      setMemoriesLoading(true);
      const data = await aiAPI.getMemories({ limit: 20 });
      if (data.success) {
        const memories = data.data?.memories || [];
        setMemories(memories as unknown as MemoryItem[]);
      }
    } catch (err) {
      console.error('Memory fetch error:', err);
      setMemories([]);
    } finally {
      setMemoriesLoading(false);
    }
  }, []);

  const fetchVersionHistory = useCallback(async () => {
    setVersionHistoryLoading(true);
    try {
      const data = await aiAPI.getSettingsHistory(selectedSettingKey || undefined, 100);
      if (data.success && data.data) {
        const mapped: VersionHistoryItem[] = (data.data.history || []).map((h: Record<string, unknown>) => ({
          id: h.id as number,
          setting_key: h.settingKey as string,
          setting_value: h.value,
          version: h.version as number,
          user_name: h.changedBy as string | undefined,
          change_note: h.changeNote as string | undefined,
          created_at: h.createdAt as string,
        }));
        setVersionHistory(mapped);
      }
    } catch (error) {
      console.error('Version history fetch error:', error);
    } finally {
      setVersionHistoryLoading(false);
    }
  }, [selectedSettingKey]);

  useEffect(() => {
    fetchAISettings();
    fetchFeedbackStats();
    fetchMemories();
  }, [fetchAISettings, fetchFeedbackStats, fetchMemories]);

  // Versiyon gecmisi filtresi degistiginde yeniden fetch
  // fetchVersionHistory zaten selectedSettingKey'e bagli (useCallback dep)
  // Bu sayede filtre degisince otomatik tetiklenir
  const [versionHistoryOpened, setVersionHistoryOpened] = useState(false);

  useEffect(() => {
    if (versionHistoryOpened) {
      fetchVersionHistory();
    }
  }, [versionHistoryOpened, fetchVersionHistory]);

  // ─── Handlers ───────────────────────────────────────────────

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

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const settingsToSave: Record<string, string | number | boolean> = {
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

  // ─── Render ─────────────────────────────────────────────────

  return (
    <Stack gap="lg">
      {/* 1. Model Secimi */}
      <Card withBorder p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={600} size="lg">
                AI Model Seçimi
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
                bg={selectedModel === model.id ? 'var(--mantine-color-violet-0)' : undefined}
                style={{
                  cursor: 'pointer',
                  borderColor: selectedModel === model.id ? 'var(--mantine-color-violet-5)' : undefined,
                  borderWidth: selectedModel === model.id ? 2 : 1,
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

      {/* 2. Ogrenme Ayarlari */}
      <Card withBorder p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={600} size="lg">
                Öğrenme Ayarları
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
              size="sm"
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
              description="Maks. hafıza öğesi sayısı"
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
              size="sm"
            />
            <NumberInput
              label="Saklama Süresi (Gün)"
              description="Hafıza saklama süresi"
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
              size="sm"
            />
            <NumberInput
              label="Güven Eşiği (%)"
              description="Min. güven seviyesi"
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
              size="sm"
            />
          </SimpleGrid>

          {editableSettings.daily_snapshot_enabled && (
            <TextInput
              label="Günlük Özet Saati"
              description="Özetin oluşturulacağı saat (HH:MM)"
              type="time"
              value={editableSettings.snapshot_time}
              onChange={(e) =>
                setEditableSettings({
                  ...editableSettings,
                  snapshot_time: e.currentTarget.value || '04:00',
                })
              }
              style={{ maxWidth: 200 }}
              size="sm"
            />
          )}
        </Stack>
      </Card>

      {/* 3. Hafiza & Feedback - yan yana kompakt */}
      <Grid gutter="lg">
        {/* Sol: AI Hafizasi */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder p="lg" h="100%">
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text fw={600}>AI Hafızası</Text>
                  <Text c="dimmed" size="xs">
                    Öğrenilen bilgiler ve tercihler
                  </Text>
                </div>
                <ActionIcon variant="subtle" onClick={fetchMemories} loading={memoriesLoading} size="sm">
                  <IconRefresh size={14} />
                </ActionIcon>
              </Group>

              {memoriesLoading ? (
                <Stack gap="xs">
                  <Skeleton height={30} />
                  <Skeleton height={30} />
                  <Skeleton height={30} />
                </Stack>
              ) : memories.length > 0 ? (
                <Paper withBorder>
                  <Table striped highlightOnHover fz="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Tip</Table.Th>
                        <Table.Th>Anahtar</Table.Th>
                        <Table.Th>Değer</Table.Th>
                        <Table.Th>Önem</Table.Th>
                        <Table.Th w={40} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {memories.map((memory) => (
                        <Table.Tr key={memory.id}>
                          <Table.Td>
                            <Badge
                              size="xs"
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
                            <Text size="xs" fw={500}>
                              {memory.key}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" lineClamp={1}>
                              {memory.value}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Progress
                              value={memory.importance * 10}
                              size="xs"
                              w={40}
                              color={memory.importance >= 8 ? 'green' : memory.importance >= 5 ? 'yellow' : 'gray'}
                            />
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon
                              size="xs"
                              color="red"
                              variant="subtle"
                              onClick={() => handleDeleteMemory(memory.id)}
                            >
                              <IconTrash size={12} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              ) : (
                <Center py="md">
                  <Stack align="center" gap={4}>
                    <ThemeIcon size={32} variant="light" color="gray" radius="xl">
                      <IconDatabase size={16} />
                    </ThemeIcon>
                    <Text c="dimmed" size="xs">
                      AI henüz bir şey öğrenmedi
                    </Text>
                  </Stack>
                </Center>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Sag: Feedback Istatistikleri */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder p="lg" h="100%">
            <Stack gap="md">
              <div>
                <Text fw={600}>Geri Bildirim</Text>
                <Text c="dimmed" size="xs">
                  Son 30 günlük performans
                </Text>
              </div>

              {feedbackStats ? (
                <SimpleGrid cols={2} spacing="sm">
                  <Card withBorder p="sm" ta="center">
                    <Text size="xs" c="dimmed" mb={4}>
                      Toplam
                    </Text>
                    <Text size="lg" fw={700}>
                      {feedbackStats.total || 0}
                    </Text>
                  </Card>
                  <Card withBorder p="sm" ta="center">
                    <Text size="xs" c="dimmed" mb={4}>
                      Olumlu
                    </Text>
                    <Group justify="center" gap={4}>
                      <IconThumbUp size={14} color="var(--mantine-color-green-6)" />
                      <Text size="lg" fw={700} c="green">
                        {feedbackStats.positive || 0}
                      </Text>
                    </Group>
                  </Card>
                  <Card withBorder p="sm" ta="center">
                    <Text size="xs" c="dimmed" mb={4}>
                      Olumsuz
                    </Text>
                    <Group justify="center" gap={4}>
                      <IconThumbDown size={14} color="var(--mantine-color-red-6)" />
                      <Text size="lg" fw={700} c="red">
                        {feedbackStats.negative || 0}
                      </Text>
                    </Group>
                  </Card>
                  <Card withBorder p="sm" ta="center">
                    <Text size="xs" c="dimmed" mb={4}>
                      Ort. Puan
                    </Text>
                    <Text size="lg" fw={700} c="violet">
                      {feedbackStats.avg_rating || '-'}
                    </Text>
                  </Card>
                </SimpleGrid>
              ) : (
                <Center py="md">
                  <Text c="dimmed" size="xs">
                    Henüz veri yok
                  </Text>
                </Center>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* 4. Versiyon Gecmisi - Accordion (varsayilan kapali) */}
      <Accordion variant="contained" radius="md">
        <Accordion.Item value="version-history">
          <Accordion.Control
            icon={<IconClock size={18} />}
            onClick={() => {
              setVersionHistoryOpened(true);
            }}
          >
            <div>
              <Text fw={600} size="sm">
                Versiyon Geçmişi
              </Text>
              <Text c="dimmed" size="xs">
                Ayar değişikliklerinin geçmişi ve geri yükleme
              </Text>
            </div>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Group justify="flex-end">
                <Select
                  placeholder="Tüm ayarlar"
                  value={selectedSettingKey}
                  onChange={(value) => {
                    setSelectedSettingKey(value || '');
                  }}
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
                  size="xs"
                  style={{ width: 200 }}
                />
                <ActionIcon variant="light" size="md" onClick={fetchVersionHistory} loading={versionHistoryLoading}>
                  <IconRefresh size={14} />
                </ActionIcon>
              </Group>

              {versionHistoryLoading ? (
                <Center py="md">
                  <Loader size="sm" />
                </Center>
              ) : versionHistory.length === 0 ? (
                <Alert color="blue" icon={<IconInfoCircle size={16} />} variant="light">
                  Henüz versiyon geçmişi yok
                </Alert>
              ) : (
                <Paper withBorder>
                  <Table fz="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Ayar</Table.Th>
                        <Table.Th>Ver.</Table.Th>
                        <Table.Th>Değer</Table.Th>
                        <Table.Th>Değiştiren</Table.Th>
                        <Table.Th>Tarih</Table.Th>
                        <Table.Th ta="right">Geri Al</Table.Th>
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
                            displayValue = parsed.length > 30 ? `${parsed.substring(0, 30)}...` : parsed;
                          } else {
                            displayValue = `${JSON.stringify(parsed).substring(0, 30)}...`;
                          }
                        } catch {
                          displayValue = String(item.setting_value).substring(0, 30);
                        }

                        return (
                          <Table.Tr key={item.id}>
                            <Table.Td>
                              <Text size="xs" fw={500} ff="monospace">
                                {item.setting_key}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" color="blue" size="xs">
                                v{item.version}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed" lineClamp={1} style={{ maxWidth: 150 }}>
                                {displayValue}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">{item.user_name || item.user_email || 'Sistem'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {new Date(item.created_at).toLocaleString('tr-TR')}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label="Bu versiyona geri dön">
                                <ActionIcon
                                  variant="subtle"
                                  color="green"
                                  size="xs"
                                  onClick={() => handleRestoreVersion(item.setting_key, item.version)}
                                >
                                  <IconClock size={14} />
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
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
