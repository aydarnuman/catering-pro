'use client';

import { Alert, Button, Code, Container, Group, Menu, Modal, Paper, Stack, Tabs, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconCheck,
  IconChevronLeft,
  IconDotsVertical,
  IconDownload,
  IconInfoCircle,
  IconRobot,
  IconSettings,
  IconTemplate,
  IconUpload,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import AgentsSection from '../components/AgentsSection';
import ModelSettingsTab from './components/ModelSettingsTab';
import TemplatesTab from './components/TemplatesTab';
import type { AIModel, ImportPreviewData } from './components/types';

export default function AIAyarlariPage() {
  const [activeTab, setActiveTab] = useState<string | null>('templates');

  // Import/Export state
  const [importModalOpened, { open: openImportModal, close: closeImportModal }] = useDisclosure(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Models (needed by TemplatesTab for per-template model override)
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const modelsData = await aiAPI.getModels();
        if (modelsData.success) {
          const models = modelsData.data?.models || [];
          setAvailableModels(models as unknown as AIModel[]);
        }
      } catch (err) {
        console.error('Models fetch error:', err);
      }
    };
    fetchModels();
  }, []);

  // ─── Export / Import ────────────────────────────────────────

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
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Export başarısız';
      notifications.show({ title: 'Hata', message: errMsg, color: 'red' });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileSelect = useCallback((file: File | null) => {
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
  }, []);

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
          message: `${data.data.imported} ayar import edildi`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
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
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Import başarısız';
      notifications.show({ title: 'Hata', message: errMsg, color: 'red' });
    } finally {
      setImporting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header - kompakt */}
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconChevronLeft size={16} />}
              component="a"
              href="/ayarlar"
              size="sm"
            >
              Geri
            </Button>
            <div>
              <Title order={2} size="h3">
                AI Asistan Ayarları
              </Title>
              <Text c="dimmed" size="sm">
                Prompt şablonları, model ve davranış ayarları
              </Text>
            </div>
          </Group>

          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <Button variant="subtle" color="gray" size="sm" px="xs">
                <IconDotsVertical size={18} />
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconDownload size={14} />} onClick={handleExportSettings} disabled={exporting}>
                {exporting ? 'Export ediliyor...' : 'Ayarları Export Et'}
              </Menu.Item>
              <Menu.Item leftSection={<IconUpload size={14} />} onClick={openImportModal}>
                Ayarları Import Et
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* 3 Tab */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="templates" leftSection={<IconTemplate size={16} />}>
              Prompt Şablonları
            </Tabs.Tab>
            <Tabs.Tab value="model-settings" leftSection={<IconSettings size={16} />}>
              Model ve Ayarlar
            </Tabs.Tab>
            <Tabs.Tab value="agents" leftSection={<IconRobot size={16} />}>
              Agent Yönetimi
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="templates" pt="xl">
            <Stack gap="lg">
              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                <Text size="sm">
                  <strong>Prompt şablonları</strong>, AI asistanın farklı görevler için nasıl yanıt vereceğini belirler.
                  Her şablon belirli bir kategori ve kullanım senaryosu için optimize edilmiştir. Şablonları
                  düzenleyerek AI&apos;ın ton, detay seviyesi ve odak noktasını değiştirebilirsiniz.
                </Text>
              </Alert>
              <TemplatesTab availableModels={availableModels} />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="model-settings" pt="xl">
            <Stack gap="lg">
              <Alert icon={<IconInfoCircle size={16} />} color="cyan" variant="light">
                <Text size="sm">
                  <strong>Model ayarları</strong>, AI&apos;ın temel davranış parametrelerini kontrol eder. Temperature
                  (yaratıcılık), max tokens (yanıt uzunluğu) ve varsayılan model seçimi burada yapılır. Düşük
                  temperature daha tutarlı, yüksek temperature daha yaratıcı yanıtlar üretir.
                </Text>
              </Alert>
              <ModelSettingsTab />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="agents" pt="xl">
            <Stack gap="lg">
              <Alert icon={<IconInfoCircle size={16} />} color="violet" variant="light">
                <Text size="sm">
                  <strong>Agent&apos;lar</strong>, belirli uzmanlık alanlarında analiz ve görev yapabilen
                  özelleştirilmiş AI modülleridir. Her agent kendi system prompt&apos;u, araçları ve bilgi tabanı
                  (kütüphane) ile çalışır. Yeni agent&apos;lar ekleyebilir, mevcut agent&apos;ların davranışlarını ve
                  kaynaklarını buradan yönetebilirsiniz.
                </Text>
              </Alert>
              <AgentsSection />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {/* Import Modal */}
        <Modal opened={importModalOpened} onClose={closeImportModal} title="AI Ayarları Import" size="lg">
          <Stack gap="md">
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              <Text size="sm">JSON formatında export edilmiş ayar dosyasını seçin.</Text>
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
                <Button component="span" variant="light" leftSection={<IconUpload size={16} />} fullWidth>
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
                    Export Tarihi: {new Date(importPreview.metadata.exported_at).toLocaleString('tr-TR')} | Versiyon:{' '}
                    {importPreview.metadata.version} | Ayar Sayısı: {importPreview.metadata.count}
                  </Text>
                )}
              </div>
            )}

            {importPreview && (
              <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
                <Text size="sm">
                  <strong>Uyarı:</strong> Bu işlem mevcut ayarların üzerine yazacak.
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
