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
  IconBrandInstagram,
  IconCalculator,
  IconCheck,
  IconClock,
  IconCopy,
  IconFileAnalytics,
  IconFileText,
  IconHelmet,
  IconInfoCircle,
  IconLink,
  IconMessageChatbot,
  IconNote,
  IconPencil,
  IconPlus,
  IconRadar,
  IconReportAnalytics,
  IconScale,
  IconSearch,
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

const MODEL_OPTIONS = [{ value: 'claude-opus-4-20250514', label: 'Claude Opus 4' }];

// ─── Category Definitions ─────────────────────────────────────

const IHALE_AGENT_SLUGS = ['mevzuat', 'maliyet', 'teknik', 'rekabet'];

interface AgentCategory {
  label: string;
  description: string;
  agents: Agent[];
}

function categorizeAgents(agents: Agent[]): AgentCategory[] {
  const ihaleAgents = agents.filter((a) => IHALE_AGENT_SLUGS.includes(a.slug));
  const generalAgents = agents.filter((a) => !IHALE_AGENT_SLUGS.includes(a.slug));

  const categories: AgentCategory[] = [];

  if (ihaleAgents.length > 0) {
    categories.push({
      label: 'İhale Analiz Agentları',
      description: 'Sanal İhale Masası için özelleştirilmiş analiz agentları',
      agents: ihaleAgents,
    });
  }

  if (generalAgents.length > 0) {
    categories.push({
      label: 'Genel Agentlar',
      description: 'Genel amaçlı AI asistan agentları',
      agents: generalAgents,
    });
  }

  return categories;
}

// ─── Static AI Services (Not in DB) ──────────────────────────

interface StaticAIService {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: 'assistant' | 'domain' | 'analysis';
  configLocation: string;
  features: string[];
}

const STATIC_AI_SERVICES: StaticAIService[] = [
  {
    id: 'ai-chat',
    name: 'Ana AI Asistan',
    description: 'Tüm modüllere erişimi olan merkezi sohbet asistanı. Tool calling, hafıza ve öğrenme destekli.',
    icon: IconMessageChatbot,
    color: 'violet',
    category: 'assistant',
    configLocation: 'Model ve Ayarlar sekmesinden',
    features: ['Sohbet', 'Tool Calling', 'Hafıza', 'Öğrenme'],
  },
  {
    id: 'instagram-ai',
    name: 'Instagram İçerik AI',
    description: 'Yemek fotoğraflarından sosyal medya içeriği, caption ve hashtag üretir.',
    icon: IconBrandInstagram,
    color: 'pink',
    category: 'domain',
    configLocation: "Henüz UI'dan yapılandırılamıyor",
    features: ['Caption', 'Hashtag', 'DM Yanıt', 'Menü Postu'],
  },
  {
    id: 'yuklenici-ai',
    name: 'Yüklenici Analiz AI',
    description: 'Firma profil özeti, güçlü/zayıf yönler ve ihale bazlı rakip risk analizi yapar.',
    icon: IconSearch,
    color: 'orange',
    category: 'domain',
    configLocation: "Henüz UI'dan yapılandırılamıyor",
    features: ['Profil Özeti', 'Rakip Analizi', 'İstihbarat Raporu'],
  },
  {
    id: 'doc-pipeline',
    name: 'Doküman Analiz Pipeline',
    description:
      'İhale dokümanlarını Azure AI ve Claude ile otomatik analiz eder. Teknik şartname, birim fiyat çıkarımı.',
    icon: IconFileAnalytics,
    color: 'cyan',
    category: 'analysis',
    configLocation: 'ai.config.js ve environment variables',
    features: ['PDF Analiz', 'Azure DI', 'Claude Vision', 'Otomatik Sınıflandırma'],
  },
  {
    id: 'daily-audit',
    name: 'Günlük Veri Denetimi',
    description: 'Fiyat anomalileri, kategori sapmaları ve veri kalitesi sorunlarını otomatik tespit eder.',
    icon: IconReportAnalytics,
    color: 'yellow',
    category: 'analysis',
    configLocation: "Henüz UI'dan yapılandırılamıyor",
    features: ['Fiyat Anomali', 'Kategori Sapma', 'Veri Kalitesi'],
  },
  {
    id: 'duplicate-detector',
    name: 'Mükerrer Fatura Tespiti',
    description: 'Aynı faturanın birden fazla kaydedilmesini SQL ve AI ile tespit ederek uyarır.',
    icon: IconCopy,
    color: 'red',
    category: 'analysis',
    configLocation: "Henüz UI'dan yapılandırılamıyor",
    features: ['Benzerlik Analizi', 'Otomatik Uyarı'],
  },
];

const STATIC_CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  assistant: { label: 'Merkezi Asistan', description: 'Ana AI sohbet asistanı' },
  domain: { label: 'Alan Uzmanı Servisler', description: 'Belirli iş alanları için AI destekli özellikler' },
  analysis: { label: 'Analiz ve Denetim', description: 'Otomatik veri analizi ve kalite kontrol servisleri' },
};

// ─── Helpers ──────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  if (diffHour < 24) return `${diffHour} saat önce`;
  if (diffDay < 7) return `${diffDay} gün önce`;
  return date.toLocaleDateString('tr-TR');
}

// ─── Main Component ──────────────────────────────────────────

export default function AgentsSection() {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Fetch all agents
  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await agentAPI.getAll();
      const raw = response as unknown as { success: boolean; agents?: Agent[]; data?: { agents?: Agent[] } };
      return raw.success ? (raw.data?.agents ?? raw.agents ?? []) : [];
    },
  });

  const agents = agentsData || [];
  const categories = categorizeAgents(agents);

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
          <Group gap="xs">
            <Badge size="lg" variant="light" color="cyan">
              {agents.length} Agent
            </Badge>
            <Badge size="lg" variant="light" color="green">
              {agents.filter((a) => a.is_active).length} Aktif
            </Badge>
          </Group>
        </Group>

        {categories.map((category) => (
          <Box key={category.label} mb="lg">
            <Group gap="xs" mb="xs">
              <Text fw={600} size="sm" c="dimmed" tt="uppercase" lts={0.5}>
                {category.label}
              </Text>
              <Text size="xs" c="dimmed">
                — {category.description}
              </Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {category.agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onSelect={() => setSelectedAgent(agent.slug)} />
              ))}
            </SimpleGrid>
          </Box>
        ))}
      </Paper>

      {/* Static AI Services */}
      <Paper p="lg" withBorder radius="md">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>Diğer AI Servisleri</Title>
            <Text c="dimmed" size="sm">
              Sistemdeki yapay zeka destekli özellikler
            </Text>
          </div>
          <Badge size="lg" variant="light" color="grape">
            {STATIC_AI_SERVICES.length} Servis
          </Badge>
        </Group>

        {(['assistant', 'domain', 'analysis'] as const).map((cat) => {
          const services = STATIC_AI_SERVICES.filter((s) => s.category === cat);
          if (services.length === 0) return null;
          const catMeta = STATIC_CATEGORY_LABELS[cat];
          return (
            <Box key={cat} mb="lg">
              <Group gap="xs" mb="xs">
                <Text fw={600} size="sm" c="dimmed" tt="uppercase" lts={0.5}>
                  {catMeta.label}
                </Text>
                <Text size="xs" c="dimmed">
                  — {catMeta.description}
                </Text>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {services.map((svc) => (
                  <StaticServiceCard key={svc.id} service={svc} />
                ))}
              </SimpleGrid>
            </Box>
          );
        })}
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
  const queryClient = useQueryClient();
  const IconComponent = AGENT_ICONS[agent.icon || 'brain'] || IconBrain;

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (newActive: boolean) => agentAPI.update(agent.slug, { is_active: newActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      notifications.show({
        title: agent.is_active ? 'Devre Dışı' : 'Aktif',
        message: `${agent.name} ${agent.is_active ? 'devre dışı bırakıldı' : 'aktif edildi'}`,
        color: agent.is_active ? 'orange' : 'green',
      });
    },
    onError: () => {
      notifications.show({ title: 'Hata', message: 'Durum değiştirilemedi', color: 'red' });
    },
  });

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (agent.is_system) return; // System agents cannot be toggled
    toggleMutation.mutate(!agent.is_active);
  };

  const switchElement = (
    <Switch
      checked={agent.is_active}
      size="sm"
      onClick={handleToggle}
      disabled={agent.is_system}
      styles={agent.is_system ? { track: { cursor: 'not-allowed' } } : undefined}
    />
  );

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ cursor: 'pointer', opacity: agent.is_active ? 1 : 0.6 }}
      onClick={onSelect}
    >
      <Group justify="space-between" mb="sm">
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
        {agent.is_system ? (
          <Tooltip label="Sistem agentı devre dışı bırakılamaz" withArrow>
            <Box>{switchElement}</Box>
          </Tooltip>
        ) : (
          switchElement
        )}
      </Group>

      <Group gap="xs" mb="xs">
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

      {/* Last run info */}
      {agent.last_analysis_at && (
        <Group gap={4} mt={4}>
          <IconClock size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Text size="10px" c="dimmed">
            Son analiz: {formatRelativeTime(agent.last_analysis_at)}
          </Text>
          {agent.last_analysis_status && (
            <Badge
              size="xs"
              variant="dot"
              color={
                agent.last_analysis_status === 'completed'
                  ? 'green'
                  : agent.last_analysis_status === 'error'
                    ? 'red'
                    : 'yellow'
              }
            >
              {agent.last_analysis_status === 'completed'
                ? 'Başarılı'
                : agent.last_analysis_status === 'error'
                  ? 'Hata'
                  : 'Devam ediyor'}
            </Badge>
          )}
        </Group>
      )}
    </Card>
  );
}

// ─── Static Service Card ─────────────────────────────────────

interface StaticServiceCardProps {
  service: StaticAIService;
}

function StaticServiceCard({ service }: StaticServiceCardProps) {
  const IconComp = service.icon;

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <ThemeIcon size="lg" variant="light" color={service.color} radius="md">
            <IconComp size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600} size="sm">
              {service.name}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {service.description}
            </Text>
          </div>
        </Group>
      </Group>

      <Group gap={4} wrap="wrap" mb="xs">
        {service.features.map((f) => (
          <Badge key={f} size="xs" variant="light" color={service.color}>
            {f}
          </Badge>
        ))}
      </Group>

      <Group gap={4}>
        <IconSettings size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
        <Text size="10px" c="dimmed">
          {service.configLocation}
        </Text>
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
      const raw = response as unknown as { success: boolean; agent?: AgentDetail; data?: { agent?: AgentDetail } };
      return raw.success ? (raw.data?.agent ?? raw.agent ?? null) : null;
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
      onClose();
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
            <TextInput label="Agent Adı" placeholder="Mevzuat & Sözleşme" {...form.getInputProps('name')} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Alt Başlık" placeholder="Kanun & Sözleşme Analizi" {...form.getInputProps('subtitle')} />
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
            <Tooltip
              label="Yanıt uzunluk limitini belirler. Yüksek değer = daha detaylı yanıtlar, daha yavaş ve maliyetli."
              withArrow
              multiline
              w={260}
            >
              <NumberInput
                label={
                  <Group gap={4}>
                    <span>Maks. Yanıt Uzunluğu</span>
                    <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Group>
                }
                min={256}
                max={8192}
                step={256}
                {...form.getInputProps('max_tokens')}
              />
            </Tooltip>
          </Grid.Col>
        </Grid>

        <Box>
          <Tooltip
            label="Düşük = tutarlı ve öngörülebilir yanıtlar. Yüksek = yaratıcı ve çeşitli yanıtlar. Analiz için 0.1-0.3 önerilir."
            withArrow
            multiline
            w={280}
          >
            <Text size="sm" fw={500} mb="xs" style={{ cursor: 'help' }}>
              <Group gap={4}>
                <span>Yaratıcılık Seviyesi: {Number(form.values.temperature ?? 0).toFixed(2)}</span>
                <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
              </Group>
            </Text>
          </Tooltip>
          <Slider
            min={0}
            max={1}
            step={0.05}
            marks={[
              { value: 0, label: 'Tutarlı' },
              { value: 0.5, label: 'Dengeli' },
              { value: 1, label: 'Yaratıcı' },
            ]}
            {...form.getInputProps('temperature')}
          />
        </Box>

        <Box>
          <Tooltip
            label="Bu agent'ın nihai karardaki (gir/girme) etkisini belirler. Yüksek = bu agent'ın görüşü daha belirleyici."
            withArrow
            multiline
            w={280}
          >
            <Text size="sm" fw={500} mb="xs" style={{ cursor: 'help' }}>
              <Group gap={4}>
                <span>Karar Etkisi: %{Math.round(Number(form.values.verdict_weight ?? 0) * 100)}</span>
                <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
              </Group>
            </Text>
          </Tooltip>
          <Slider
            min={0}
            max={1}
            step={0.05}
            marks={[
              { value: 0, label: 'Düşük' },
              { value: 0.5, label: 'Orta' },
              { value: 1, label: 'Yüksek' },
            ]}
            {...form.getInputProps('verdict_weight')}
          />
        </Box>

        <Divider label="Davranış Talimatı" labelPosition="center" />

        <Tooltip
          label="Agent'ın nasıl davranacağını belirleyen ana talimat metni. Uzmanlık alanı, ton ve kurallar burada tanımlanır."
          withArrow
          multiline
          w={300}
          position="top-start"
        >
          <Textarea
            placeholder="Agent'ın davranış talimatı..."
            rows={8}
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: 12,
              },
            }}
            {...form.getInputProps('system_prompt')}
          />
        </Tooltip>

        <Group justify="space-between">
          <Switch
            label="Agent Aktif"
            disabled={agent.is_system}
            {...form.getInputProps('is_active', { type: 'checkbox' })}
          />
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
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setShowAddModal(true)}>
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
                    <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => setEditingTool(tool)}>
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
      tool ? agentAPI.updateTool(agentSlug, tool.tool_slug, data) : agentAPI.addTool(agentSlug, data),
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
            <TextInput label="Araç Slug" placeholder="redline" disabled={!!tool} {...form.getInputProps('tool_slug')} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Etiket" placeholder="Maddeyi Düzenle" {...form.getInputProps('label')} />
          </Grid.Col>
        </Grid>

        <Textarea label="Açıklama" placeholder="Bu araç ne yapar..." rows={2} {...form.getInputProps('description')} />

        <Textarea
          label="AI Prompt Şablonu"
          placeholder="{{input}} değişkeni kullanılabilir..."
          rows={6}
          styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
          {...form.getInputProps('ai_prompt_template')}
        />

        <Switch label="Metin seçimi gerektirir" {...form.getInputProps('requires_selection', { type: 'checkbox' })} />

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
      const raw = response as unknown as {
        success: boolean;
        knowledge?: AgentKnowledge[];
        data?: { knowledge?: AgentKnowledge[] };
      };
      return raw.success ? (raw.data?.knowledge ?? raw.knowledge ?? []) : [];
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
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setShowAddModal(true)}>
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
        <ScrollArea mah={300}>
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
          disabled={!title || (contentType !== 'pdf' && !content) || (contentType === 'pdf' && !file)}
        >
          Ekle
        </Button>
      </Group>
    </Stack>
  );
}
