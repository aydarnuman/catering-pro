'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  FileInput,
  Grid,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconBook2,
  IconBrain,
  IconCalculator,
  IconCheck,
  IconFileText,
  IconHelmet,
  IconLink,
  IconNote,
  IconPencil,
  IconPlus,
  IconRadar,
  IconScale,
  IconSettings,
  IconTool,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  type Agent,
  type AgentDetail,
  type AgentKnowledge,
  type AgentTool,
  type AgentToolInput,
  type AgentUpdateInput,
  agentAPI,
} from '@/lib/api/services/agents';

// ─── Icon Map ────────────────────────────────────────────────

const AGENT_ICONS: Record<string, React.ElementType> = {
  scale: IconScale,
  calculator: IconCalculator,
  hardhat: IconHelmet,
  radar: IconRadar,
  brain: IconBrain,
};

const CONTENT_TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: IconFileText,
  url: IconLink,
  note: IconNote,
  template: IconFileText,
  past_analysis: IconBrain,
};

const MODEL_OPTIONS = [
  { value: 'default', label: 'Varsayılan (Claude Sonnet)' },
  { value: 'haiku', label: 'Claude Haiku (Hızlı)' },
  { value: 'sonnet', label: 'Claude Sonnet (Dengeli)' },
  { value: 'opus', label: 'Claude Opus (Güçlü)' },
];

// ─── Main Component ──────────────────────────────────────────

export default function AgentsSection() {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Fetch all agents
  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await agentAPI.getAll();
      return response.success ? (response.data?.agents ?? []) : [];
    },
  });

  const agents = agentsData || [];

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Agent&apos;lar yükleniyor...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Paper p="lg" withBorder radius="md">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>Agent Yönetimi</Title>
            <Text c="dimmed" size="sm">
              AI agent&apos;larını yapılandırın ve yönetin
            </Text>
          </div>
          <Badge size="lg" variant="light" color="cyan">
            {agents.length} Agent
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onSelect={() => setSelectedAgent(agent.slug)} />
          ))}
        </SimpleGrid>
      </Paper>

      {/* Agent Detail Modal */}
      <Modal
        opened={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        size="xl"
        title={
          <Group gap="sm">
            <IconBrain size={20} />
            <Text fw={600}>Agent Düzenle</Text>
          </Group>
        }
      >
        {selectedAgent && (
          <AgentDetailEditor
            slug={selectedAgent}
            onClose={() => {
              setSelectedAgent(null);
              queryClient.invalidateQueries({ queryKey: ['agents'] });
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

// ─── Agent Card ──────────────────────────────────────────────

interface AgentCardProps {
  agent: Agent;
  onSelect: () => void;
}

function AgentCard({ agent, onSelect }: AgentCardProps) {
  const IconComponent = AGENT_ICONS[agent.icon || 'brain'] || IconBrain;

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ cursor: 'pointer' }}
      onClick={onSelect}
    >
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon
            size="lg"
            variant="gradient"
            gradient={{ from: agent.color || 'gray', to: agent.color || 'gray' }}
            radius="md"
          >
            <IconComponent size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600} size="sm">
              {agent.name}
            </Text>
            <Text size="xs" c="dimmed">
              {agent.subtitle}
            </Text>
          </div>
        </Group>
        <Switch checked={agent.is_active} size="sm" onClick={(e) => e.stopPropagation()} readOnly />
      </Group>

      <Group gap="xs">
        <Badge size="xs" variant="light" color={agent.color || 'gray'}>
          {agent.tool_count || 0} araç
        </Badge>
        <Badge size="xs" variant="light" color={agent.color || 'gray'}>
          {agent.knowledge_count || 0} kaynak
        </Badge>
        {agent.is_system && (
          <Badge size="xs" variant="outline" color="gray">
            Sistem
          </Badge>
        )}
      </Group>
    </Card>
  );
}

// ─── Agent Detail Editor ─────────────────────────────────────

interface AgentDetailEditorProps {
  slug: string;
  onClose: () => void;
}

function AgentDetailEditor({ slug, onClose }: AgentDetailEditorProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('general');

  // Fetch agent detail
  const { data: agentDetail, isLoading } = useQuery({
    queryKey: ['agent-detail', slug],
    queryFn: async () => {
      const response = await agentAPI.getBySlug(slug);
      return response.success ? (response.data?.agent ?? null) : null;
    },
  });

  // Update agent mutation
  const updateMutation = useMutation({
    mutationFn: (data: AgentUpdateInput) => agentAPI.update(slug, data),
    onSuccess: () => {
      notifications.show({
        title: 'Kaydedildi',
        message: 'Agent güncellendi',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      queryClient.invalidateQueries({ queryKey: ['agent-detail', slug] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      onClose(); // Close modal after save
    },
    onError: () => {
      notifications.show({
        title: 'Hata',
        message: 'Güncelleme başarısız',
        color: 'red',
      });
    },
  });

  if (isLoading || !agentDetail) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  return (
    <Tabs value={activeTab} onChange={setActiveTab}>
      <Tabs.List mb="md">
        <Tabs.Tab value="general" leftSection={<IconSettings size={14} />}>
          Genel
        </Tabs.Tab>
        <Tabs.Tab value="tools" leftSection={<IconTool size={14} />}>
          Araçlar ({agentDetail.tools?.length || 0})
        </Tabs.Tab>
        <Tabs.Tab value="knowledge" leftSection={<IconBook2 size={14} />}>
          Kütüphane ({agentDetail.knowledgeStats?.total || 0})
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="general">
        <GeneralSettingsTab
          agent={agentDetail}
          onSave={(data) => updateMutation.mutate(data)}
          saving={updateMutation.isPending}
        />
      </Tabs.Panel>

      <Tabs.Panel value="tools">
        <ToolsTab agent={agentDetail} />
      </Tabs.Panel>

      <Tabs.Panel value="knowledge">
        <KnowledgeTab agent={agentDetail} />
      </Tabs.Panel>
    </Tabs>
  );
}

// ─── General Settings Tab ────────────────────────────────────

interface GeneralSettingsTabProps {
  agent: AgentDetail;
  onSave: (data: AgentUpdateInput) => void;
  saving: boolean;
}

function GeneralSettingsTab({ agent, onSave, saving }: GeneralSettingsTabProps) {
  const form = useForm({
    initialValues: {
      name: agent.name,
      subtitle: agent.subtitle || '',
      description: agent.description || '',
      model: agent.model,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
      verdict_weight: agent.verdict_weight,
      system_prompt: agent.system_prompt || '',
      is_active: agent.is_active,
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    onSave(values);
  });

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Grid>
          <Grid.Col span={6}>
            <TextInput
              label="Agent Adı"
              placeholder="Mevzuat & Sözleşme"
              {...form.getInputProps('name')}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Alt Başlık"
              placeholder="Kanun & Sözleşme Analizi"
              {...form.getInputProps('subtitle')}
            />
          </Grid.Col>
        </Grid>

        <Textarea
          label="Açıklama"
          placeholder="Agent'ın görev tanımı..."
          rows={2}
          {...form.getInputProps('description')}
        />

        <Divider label="Model Ayarları" labelPosition="center" />

        <Grid>
          <Grid.Col span={6}>
            <Select label="Model" data={MODEL_OPTIONS} {...form.getInputProps('model')} />
          </Grid.Col>
          <Grid.Col span={6}>
            <NumberInput
              label="Max Tokens"
              min={256}
              max={8192}
              step={256}
              {...form.getInputProps('max_tokens')}
            />
          </Grid.Col>
        </Grid>

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Temperature: {form.values.temperature.toFixed(2)}
          </Text>
          <Slider
            min={0}
            max={1}
            step={0.05}
            marks={[
              { value: 0, label: '0' },
              { value: 0.5, label: '0.5' },
              { value: 1, label: '1' },
            ]}
            {...form.getInputProps('temperature')}
          />
        </Box>

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Verdict Ağırlığı: %{Math.round(form.values.verdict_weight * 100)}
          </Text>
          <Slider
            min={0}
            max={1}
            step={0.05}
            marks={[
              { value: 0, label: '0%' },
              { value: 0.5, label: '50%' },
              { value: 1, label: '100%' },
            ]}
            {...form.getInputProps('verdict_weight')}
          />
        </Box>

        <Divider label="System Prompt" labelPosition="center" />

        <Textarea
          placeholder="Agent'ın system prompt'u..."
          rows={8}
          styles={{
            input: {
              fontFamily: 'monospace',
              fontSize: 12,
            },
          }}
          {...form.getInputProps('system_prompt')}
        />

        <Group justify="space-between">
          <Switch label="Agent Aktif" {...form.getInputProps('is_active', { type: 'checkbox' })} />
          <Button type="submit" loading={saving} leftSection={<IconCheck size={16} />}>
            Kaydet
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

// ─── Tools Tab ───────────────────────────────────────────────

interface ToolsTabProps {
  agent: AgentDetail;
}

function ToolsTab({ agent }: ToolsTabProps) {
  const queryClient = useQueryClient();
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Delete tool mutation
  const deleteMutation = useMutation({
    mutationFn: (toolSlug: string) => agentAPI.deleteTool(agent.slug, toolSlug),
    onSuccess: () => {
      notifications.show({ title: 'Silindi', message: 'Araç silindi', color: 'orange' });
      queryClient.invalidateQueries({ queryKey: ['agent-detail', agent.slug] });
    },
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Agent&apos;ın kullanabileceği araçlar
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => setShowAddModal(true)}
        >
          Araç Ekle
        </Button>
      </Group>

      {agent.tools?.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          Henüz araç tanımlanmamış
        </Text>
      ) : (
        <Stack gap="xs">
          {agent.tools?.map((tool) => (
            <Paper key={tool.id} p="sm" withBorder radius="md">
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon size="sm" variant="light" color={agent.color || 'gray'}>
                    <IconTool size={12} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" fw={500}>
                      {tool.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {tool.description}
                    </Text>
                  </div>
                </Group>
                <Group gap={4}>
                  <Tooltip label="Düzenle">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      size="sm"
                      onClick={() => setEditingTool(tool)}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Sil">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      loading={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm('Bu aracı silmek istediğinize emin misiniz?')) {
                          deleteMutation.mutate(tool.tool_slug);
                        }
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Add/Edit Tool Modal */}
      <Modal
        opened={showAddModal || !!editingTool}
        onClose={() => {
          setShowAddModal(false);
          setEditingTool(null);
        }}
        title={editingTool ? 'Aracı Düzenle' : 'Yeni Araç Ekle'}
      >
        <ToolForm
          agentSlug={agent.slug}
          tool={editingTool}
          onClose={() => {
            setShowAddModal(false);
            setEditingTool(null);
            queryClient.invalidateQueries({ queryKey: ['agent-detail', agent.slug] });
          }}
        />
      </Modal>
    </Stack>
  );
}

// ─── Tool Form ───────────────────────────────────────────────

interface ToolFormProps {
  agentSlug: string;
  tool?: AgentTool | null;
  onClose: () => void;
}

function ToolForm({ agentSlug, tool, onClose }: ToolFormProps) {
  const form = useForm<AgentToolInput>({
    initialValues: {
      tool_slug: tool?.tool_slug || '',
      label: tool?.label || '',
      description: tool?.description || '',
      icon: tool?.icon || 'tool',
      requires_selection: tool?.requires_selection || false,
      tool_type: tool?.tool_type || 'ai_prompt',
      ai_prompt_template: tool?.ai_prompt_template || '',
      urgency_priority: tool?.urgency_priority || 5,
      sort_order: tool?.sort_order || 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: AgentToolInput) =>
      tool
        ? agentAPI.updateTool(agentSlug, tool.tool_slug, data)
        : agentAPI.addTool(agentSlug, data),
    onSuccess: () => {
      notifications.show({
        title: 'Kaydedildi',
        message: tool ? 'Araç güncellendi' : 'Araç eklendi',
        color: 'green',
      });
      onClose();
    },
    onError: () => {
      notifications.show({ title: 'Hata', message: 'İşlem başarısız', color: 'red' });
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
      <Stack gap="md">
        <Grid>
          <Grid.Col span={6}>
            <TextInput
              label="Araç Slug"
              placeholder="redline"
              disabled={!!tool}
              {...form.getInputProps('tool_slug')}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Etiket"
              placeholder="Maddeyi Düzenle"
              {...form.getInputProps('label')}
            />
          </Grid.Col>
        </Grid>

        <Textarea
          label="Açıklama"
          placeholder="Bu araç ne yapar..."
          rows={2}
          {...form.getInputProps('description')}
        />

        <Textarea
          label="AI Prompt Şablonu"
          placeholder="{{input}} değişkeni kullanılabilir..."
          rows={6}
          styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
          {...form.getInputProps('ai_prompt_template')}
        />

        <Switch
          label="Metin seçimi gerektirir"
          {...form.getInputProps('requires_selection', { type: 'checkbox' })}
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            İptal
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {tool ? 'Güncelle' : 'Ekle'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

// ─── Knowledge Tab ───────────────────────────────────────────

interface KnowledgeTabProps {
  agent: AgentDetail;
}

function KnowledgeTab({ agent }: KnowledgeTabProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch knowledge
  const { data: knowledgeData, isLoading } = useQuery({
    queryKey: ['agent-knowledge', agent.slug],
    queryFn: async () => {
      const response = await agentAPI.getKnowledge(agent.slug);
      return response.success ? (response.data?.knowledge ?? []) : [];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => agentAPI.deleteKnowledge(agent.slug, id),
    onSuccess: () => {
      notifications.show({ title: 'Silindi', message: 'Kaynak silindi', color: 'orange' });
      queryClient.invalidateQueries({ queryKey: ['agent-knowledge', agent.slug] });
    },
  });

  const knowledge = knowledgeData || [];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Agent&apos;ın bilgi tabanı kaynakları
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => setShowAddModal(true)}
        >
          Kaynak Ekle
        </Button>
      </Group>

      {isLoading ? (
        <Stack align="center" py="xl">
          <Loader size="sm" />
        </Stack>
      ) : knowledge.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          Henüz kaynak eklenmemiş
        </Text>
      ) : (
        <ScrollArea h={300}>
          <Stack gap="xs">
            {knowledge.map((item: AgentKnowledge) => {
              const IconComp = CONTENT_TYPE_ICONS[item.content_type] || IconFileText;
              return (
                <Paper key={item.id} p="sm" withBorder radius="md">
                  <Group justify="space-between">
                    <Group gap="sm">
                      <ThemeIcon size="sm" variant="light" color={agent.color || 'gray'}>
                        <IconComp size={12} />
                      </ThemeIcon>
                      <div>
                        <Text size="sm" fw={500}>
                          {item.title}
                        </Text>
                        <Group gap="xs">
                          <Badge size="xs" variant="dot">
                            {item.content_type}
                          </Badge>
                          {item.usage_count > 0 && (
                            <Text size="10px" c="dimmed">
                              {item.usage_count}x kullanıldı
                            </Text>
                          )}
                        </Group>
                      </div>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      loading={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm('Bu kaynağı silmek istediğinize emin misiniz?')) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        </ScrollArea>
      )}

      {/* Add Knowledge Modal */}
      <Modal opened={showAddModal} onClose={() => setShowAddModal(false)} title="Kaynak Ekle">
        <KnowledgeForm
          agentSlug={agent.slug}
          onClose={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ['agent-knowledge', agent.slug] });
          }}
        />
      </Modal>
    </Stack>
  );
}

// ─── Knowledge Form ──────────────────────────────────────────

interface KnowledgeFormProps {
  agentSlug: string;
  onClose: () => void;
}

function KnowledgeForm({ agentSlug, onClose }: KnowledgeFormProps) {
  const [contentType, setContentType] = useState<string>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (contentType === 'pdf' && file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('content_type', 'pdf');
        return agentAPI.addKnowledge(agentSlug, formData);
      }
      return agentAPI.addKnowledge(agentSlug, {
        title,
        content_type: contentType as 'note' | 'url',
        content,
      });
    },
    onSuccess: () => {
      notifications.show({
        title: 'Eklendi',
        message: 'Kaynak eklendi',
        color: 'green',
      });
      onClose();
    },
    onError: () => {
      notifications.show({ title: 'Hata', message: 'Ekleme başarısız', color: 'red' });
    },
  });

  return (
    <Stack gap="md">
      <Select
        label="Kaynak Tipi"
        value={contentType}
        onChange={(v) => setContentType(v || 'note')}
        data={[
          { value: 'note', label: 'Not' },
          { value: 'url', label: 'URL' },
          { value: 'pdf', label: 'PDF Dosyası' },
        ]}
      />

      <TextInput
        label="Başlık"
        placeholder="Kaynak başlığı"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      {contentType === 'pdf' ? (
        <FileInput
          label="PDF Dosyası"
          placeholder="Dosya seçin"
          accept="application/pdf"
          value={file}
          onChange={setFile}
        />
      ) : (
        <Textarea
          label={contentType === 'url' ? 'URL' : 'İçerik'}
          placeholder={contentType === 'url' ? 'https://...' : 'Not içeriği...'}
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      )}

      <Group justify="flex-end">
        <Button variant="subtle" onClick={onClose}>
          İptal
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={
            !title || (contentType !== 'pdf' && !content) || (contentType === 'pdf' && !file)
          }
        >
          Ekle
        </Button>
      </Group>
    </Stack>
  );
}
