'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  Button,
  Modal,
  TextInput,
  Textarea,
  Select,
  Switch,
  Badge,
  ActionIcon,
  Table,
  Paper,
  Alert,
  Tabs,
  Divider,
  Code,
  Tooltip
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconRobot,
  IconPlus,
  IconEdit,
  IconTrash,
  IconEye,
  IconCopy,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconBrain,
  IconSettings,
  IconTemplate,
  IconChevronLeft
} from '@tabler/icons-react';

// Tip tanımları
interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  usageCount: number;
}

// Varsayılan şablonlar
const defaultTemplates: PromptTemplate[] = [
  {
    id: 'cfo-analiz',
    name: '📈 CFO Analizi',
    description: 'Mali müşavir bakış açısıyla detaylı finansal analiz',
    prompt: `Sen deneyimli bir CFO'sun. Türkçe cevap ver.
- Sayıları formatla (1.000.000 TL)
- Risk uyarıları yap
- Stratejik öneriler sun
- Kaynak belirt
- Grafik öner`,
    category: 'Muhasebe',
    isActive: true,
    isDefault: true,
    createdAt: '2024-01-01',
    usageCount: 45
  },
  {
    id: 'risk-uzman',
    name: '⚠️ Risk Uzmanı',
    description: 'Risk odaklı analiz ve uyarılar',
    prompt: `Sen bir risk analiz uzmanısın. Türkçe cevap ver.
- Potansiyel riskleri belirt
- Önlem öneriler sun
- Acil durumları vurgula
- Olasılık hesapları yap`,
    category: 'Genel',
    isActive: true,
    isDefault: true,
    createdAt: '2024-01-01',
    usageCount: 23
  },
  {
    id: 'ihale-uzman',
    name: '📋 İhale Uzmanı',
    description: 'İhale süreçleri ve rekabet analizi',
    prompt: `Sen bir ihale uzmanısın. Türkçe cevap ver.
- Rekabet analizi yap
- Fırsat değerlendirmeleri sun
- Süreç öneriler ver
- Başarı oranları hesapla`,
    category: 'İhale',
    isActive: true,
    isDefault: true,
    createdAt: '2024-01-01',
    usageCount: 18
  },
  {
    id: 'hizli-yanit',
    name: '⚡ Hızlı Yanıt',
    description: 'Kısa ve öz cevaplar',
    prompt: `Kısa ve öz cevap ver. Türkçe kullan.
- Maksimum 3 cümle
- Ana noktaları belirt
- Sayıları formatla`,
    category: 'Genel',
    isActive: true,
    isDefault: true,
    createdAt: '2024-01-01',
    usageCount: 67
  }
];

export default function AIAyarlariPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>(defaultTemplates);
  const [opened, { open, close }] = useDisclosure(false);
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [activeTab, setActiveTab] = useState('templates');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    category: 'Genel',
    isActive: true
  });

  const categories = [
    'Genel',
    'Muhasebe', 
    'İhale',
    'Risk',
    'Strateji',
    'Raporlama'
  ];

  const handleSave = () => {
    if (!formData.name || !formData.prompt) {
      notifications.show({
        title: 'Hata',
        message: 'Ad ve prompt alanları zorunludur',
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    const newTemplate: PromptTemplate = {
      id: editingTemplate?.id || Date.now().toString(),
      name: formData.name,
      description: formData.description,
      prompt: formData.prompt,
      category: formData.category,
      isActive: formData.isActive,
      isDefault: false,
      createdAt: editingTemplate?.createdAt || new Date().toISOString(),
      usageCount: editingTemplate?.usageCount || 0
    };

    if (editingTemplate) {
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? newTemplate : t));
      notifications.show({
        title: 'Başarılı',
        message: 'Şablon güncellendi',
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } else {
      setTemplates(prev => [...prev, newTemplate]);
      notifications.show({
        title: 'Başarılı',
        message: 'Yeni şablon eklendi',
        color: 'green',
        icon: <IconCheck size={16} />
      });
    }

    resetForm();
    close();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      prompt: '',
      category: 'Genel',
      isActive: true
    });
    setEditingTemplate(null);
  };

  const handleEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      prompt: template.prompt,
      category: template.category,
      isActive: template.isActive
    });
    open();
  };

  const handleDelete = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (template?.isDefault) {
      notifications.show({
        title: 'Uyarı',
        message: 'Varsayılan şablonlar silinemez',
        color: 'orange',
        icon: <IconInfoCircle size={16} />
      });
      return;
    }

    setTemplates(prev => prev.filter(t => t.id !== id));
    notifications.show({
      title: 'Başarılı',
      message: 'Şablon silindi',
      color: 'green',
      icon: <IconCheck size={16} />
    });
  };

  const toggleActive = (id: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, isActive: !t.isActive } : t
    ));
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    notifications.show({
      title: 'Kopyalandı',
      message: 'Prompt panoya kopyalandı',
      color: 'blue',
      icon: <IconCopy size={16} />
    });
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <Button variant="subtle" leftSection={<IconChevronLeft size={16} />} component="a" href="/ayarlar">
              Geri
            </Button>
            <div>
              <Title order={1} size="h2" mb={4}>🤖 AI Asistan Ayarları</Title>
              <Text c="dimmed" size="lg">
                Yapay zeka prompt şablonları ve davranış ayarları
              </Text>
            </div>
          </Group>
          <Badge size="lg" variant="light" color="violet">
            {templates.filter(t => t.isActive).length} Aktif Şablon
          </Badge>
        </Group>

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
          </Tabs.List>

          <Tabs.Panel value="templates" pt="xl">
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="lg" fw={500}>Prompt Şablonları</Text>
                <Button 
                  leftSection={<IconPlus size={16} />}
                  onClick={() => { resetForm(); open(); }}
                  color="violet"
                >
                  Yeni Şablon
                </Button>
              </Group>

              <Paper withBorder>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Şablon</Table.Th>
                      <Table.Th>Kategori</Table.Th>
                      <Table.Th>Kullanım</Table.Th>
                      <Table.Th>Durum</Table.Th>
                      <Table.Th width={120}>İşlemler</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {templates.map((template) => (
                      <Table.Tr key={template.id}>
                        <Table.Td>
                          <Stack gap={4}>
                            <Group gap="xs">
                              <Text fw={500}>{template.name}</Text>
                              {template.isDefault && (
                                <Badge size="xs" color="blue" variant="light">
                                  Varsayılan
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {template.description}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm">
                            {template.category}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {template.usageCount} kez
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Switch
                            checked={template.isActive}
                            onChange={() => toggleActive(template.id)}
                            size="sm"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Tooltip label="Önizle">
                              <ActionIcon 
                                variant="subtle" 
                                color="blue"
                                onClick={() => { setSelectedTemplate(template); openPreview(); }}
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
                            {!template.isDefault && (
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
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="behavior" pt="xl">
            <Alert icon={<IconInfoCircle size={16} />} color="blue" mb="md">
              Bu özellikler yakında eklenecek
            </Alert>
          </Tabs.Panel>

          <Tabs.Panel value="settings" pt="xl">
            <Alert icon={<IconInfoCircle size={16} />} color="blue" mb="md">
              Bu özellikler yakında eklenecek
            </Alert>
          </Tabs.Panel>
        </Tabs>

        {/* Şablon Ekleme/Düzenleme Modal */}
        <Modal 
          opened={opened} 
          onClose={close} 
          title={editingTemplate ? "Şablon Düzenle" : "Yeni Şablon"}
          size="lg"
        >
          <Stack gap="md">
            <TextInput
              label="Şablon Adı"
              placeholder="Örn: CFO Analizi"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
              required
            />

            <TextInput
              label="Açıklama"
              placeholder="Bu şablonun ne için kullanıldığını açıklayın"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
            />

            <Select
              label="Kategori"
              data={categories}
              value={formData.category}
              onChange={(value) => setFormData({ ...formData, category: value || 'Genel' })}
            />

            <Textarea
              label="Prompt"
              placeholder="AI'nın nasıl davranması gerektiğini açıklayın..."
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.currentTarget.value })}
              minRows={6}
              required
            />

            <Switch
              label="Aktif"
              description="Bu şablon kullanıma açık olsun"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.currentTarget.checked })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={close}>İptal</Button>
              <Button color="violet" onClick={handleSave}>
                {editingTemplate ? 'Güncelle' : 'Kaydet'}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Önizleme Modal */}
        <Modal 
          opened={previewOpened} 
          onClose={closePreview} 
          title="Şablon Önizleme"
          size="lg"
        >
          {selectedTemplate && (
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={4}>{selectedTemplate.name}</Title>
                <Badge variant="light">{selectedTemplate.category}</Badge>
              </Group>
              
              <Text c="dimmed">{selectedTemplate.description}</Text>
              
              <Divider />
              
              <div>
                <Text size="sm" fw={500} mb="xs">Prompt İçeriği:</Text>
                <Code block>{selectedTemplate.prompt}</Code>
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
      </Stack>
    </Container>
  );
}
