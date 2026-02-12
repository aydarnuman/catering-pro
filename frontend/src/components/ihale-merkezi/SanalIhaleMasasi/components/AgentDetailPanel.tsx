import {
  ActionIcon,
  Badge,
  Box,
  Divider,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBook2,
  IconBrain,
  IconCalculator,
  IconFileText,
  IconHelmet,
  IconInfoCircle,
  IconLink,
  IconNote,
  IconRadar2,
  IconRefresh,
  IconScale,
  IconSettings,
  IconTool,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { type AgentKnowledge, agentAPI } from '@/lib/api/services/agents';
import type { AgentAnalysis, AgentPersona, SnippetDrop, ToolResult } from '../types';
import { AgentToolkit } from './toolkit/AgentToolkit';

const ICON_MAP = {
  scale: IconScale,
  calculator: IconCalculator,
  hardhat: IconHelmet,
  radar: IconRadar2,
};

const SEVERITY_CONFIG = {
  info: { color: 'blue', icon: IconInfoCircle },
  warning: { color: 'yellow', icon: IconAlertTriangle },
  critical: { color: 'red', icon: IconAlertTriangle },
};

interface AgentDetailPanelProps {
  agent: AgentPersona;
  analysis: AgentAnalysis;
  snippetDrops?: SnippetDrop[];
  tenderId?: number;
  analysisContext?: Record<string, unknown>;
  daysLeft?: number | null;
  onBack: () => void;
  onToolComplete?: (agentId: AgentPersona['id'], toolId: string, result: ToolResult) => void;
  onReanalyze?: (agentId: string) => Promise<void>;
}

export function AgentDetailPanel({
  agent,
  analysis,
  snippetDrops,
  tenderId,
  analysisContext,
  daysLeft,
  onBack,
  onToolComplete,
  onReanalyze,
}: AgentDetailPanelProps) {
  const IconComponent = ICON_MAP[agent.iconName];
  const agentSnippets = snippetDrops?.filter((s) => s.agentId === agent.id) || [];
  const [reanalyzing, setReanalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('findings');
  const isCurrentlyAnalyzing = analysis.status === 'analyzing' || reanalyzing;

  // Fetch agent knowledge base for Kütüphane tab
  const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery({
    queryKey: ['agent-knowledge', agent.id],
    queryFn: async () => {
      try {
        const response = await agentAPI.getKnowledge(agent.id, { limit: 20 });
        return response.success ? (response.data ?? null) : null;
      } catch {
        return null;
      }
    },
    enabled: activeTab === 'library',
    staleTime: 5 * 60 * 1000,
    placeholderData: null,
  });

  // Fetch agent detail for Ayarlar tab
  const { data: agentDetail, isLoading: agentLoading } = useQuery({
    queryKey: ['agent-detail', agent.id],
    queryFn: async () => {
      try {
        const response = await agentAPI.getBySlug(agent.id);
        return response.success ? (response.data?.agent ?? null) : null;
      } catch {
        return null;
      }
    },
    enabled: activeTab === 'settings',
    staleTime: 5 * 60 * 1000,
    placeholderData: null,
  });

  const handleReanalyze = async () => {
    if (!onReanalyze || reanalyzing) return;
    setReanalyzing(true);
    try {
      await onReanalyze(agent.id);
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div
      className="agent-detail-panel"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box p="lg" pb="sm">
        {/* Header */}
        <Group justify="space-between" align="center" mb="md">
          <Group gap="md">
            <ThemeIcon
              size={44}
              variant="gradient"
              gradient={{ from: agent.color, to: agent.color }}
              radius="xl"
            >
              {isCurrentlyAnalyzing ? (
                <Loader size={22} color="white" type="dots" />
              ) : (
                <IconComponent size={24} />
              )}
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700} c="white">
                {agent.name}
              </Text>
              <Text size="xs" c="gray.5">
                {agent.subtitle}
              </Text>
            </div>
          </Group>
          <Group gap={4}>
            {onReanalyze && (
              <Tooltip label="Yeniden Analiz Et" position="left">
                <ActionIcon
                  variant="subtle"
                  color={agent.color}
                  onClick={handleReanalyze}
                  loading={reanalyzing}
                  size="lg"
                >
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            <ActionIcon variant="subtle" color="gray" onClick={onBack} size="lg">
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Group>
        </Group>

        {/* AI indicator + Score */}
        <Group gap="sm" mb="md">
          <Badge size="lg" variant="gradient" gradient={{ from: agent.color, to: agent.color }}>
            Risk Skoru: {analysis.riskScore}/100
          </Badge>
          {analysis.status !== 'analyzing' && analysis.status !== 'no-data' && (
            <Badge size="sm" variant="light" color="teal" leftSection={<IconBrain size={12} />}>
              AI Analiz
            </Badge>
          )}
        </Group>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        variant="pills"
        color={agent.color}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        styles={{
          root: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
          panel: { flex: 1, overflow: 'hidden', minHeight: 0 },
        }}
      >
        <Tabs.List px="lg" pb="xs">
          <Tabs.Tab value="findings" leftSection={<IconInfoCircle size={14} />}>
            Bulgular
          </Tabs.Tab>
          <Tabs.Tab value="tools" leftSection={<IconTool size={14} />}>
            Araçlar
          </Tabs.Tab>
          <Tabs.Tab value="library" leftSection={<IconBook2 size={14} />}>
            Kütüphane
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />}>
            Ayarlar
          </Tabs.Tab>
        </Tabs.List>

        {/* Bulgular (Findings) Tab */}
        <Tabs.Panel value="findings" style={{ overflow: 'hidden' }}>
          <ScrollArea h="100%" px="lg" pb="lg">
            <Stack gap="md">
              {/* Dropped Snippets */}
              {agentSnippets.length > 0 && (
                <>
                  <Text size="sm" fw={600} c={agent.color}>
                    Sürüklenen Metin Analizi ({agentSnippets.length})
                  </Text>
                  <Stack gap={8}>
                    {agentSnippets.map((snippet) => (
                      <Box
                        key={`${snippet.agentId}-${snippet.timestamp}-${snippet.text.slice(0, 20)}`}
                        p="sm"
                        style={{
                          background: `rgba(${agent.accentHex === '#6366f1' ? '99,102,241' : agent.accentHex === '#10b981' ? '16,185,129' : agent.accentHex === '#f59e0b' ? '245,158,11' : '244,63,94'}, 0.08)`,
                          borderRadius: 10,
                          borderLeft: `3px solid ${agent.accentHex}`,
                        }}
                      >
                        <Text size="xs" c="white" lineClamp={4} style={{ lineHeight: 1.6 }}>
                          &ldquo;{snippet.text}&rdquo;
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                  <Divider color="dark.5" />
                </>
              )}

              {/* Findings */}
              <Stack gap={10}>
                {isCurrentlyAnalyzing ? (
                  <Stack align="center" py="xl" gap="sm">
                    <Loader size="sm" color={agent.color} type="bars" />
                    <Text size="sm" c="dimmed">
                      AI analiz ediliyor...
                    </Text>
                  </Stack>
                ) : analysis.findings.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    Bu alan için analiz verisi bulunamadı
                  </Text>
                ) : (
                  analysis.findings.map((finding) => {
                    const severityConf = finding.severity
                      ? SEVERITY_CONFIG[finding.severity]
                      : null;
                    // Generate unique key from label hash
                    const findingKey = `finding-${finding.label.slice(0, 20).replace(/\s/g, '-')}-${finding.value.slice(0, 10).replace(/\s/g, '-')}`;

                    return (
                      <Box
                        key={findingKey}
                        p="sm"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: 10,
                          borderLeft: severityConf
                            ? `3px solid var(--mantine-color-${severityConf.color}-5)`
                            : '3px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <Group gap={8} wrap="nowrap" align="flex-start">
                          {severityConf && (
                            <severityConf.icon
                              size={15}
                              color={`var(--mantine-color-${severityConf.color}-5)`}
                              style={{ flexShrink: 0, marginTop: 3 }}
                            />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Group gap={6} justify="space-between" wrap="nowrap">
                              <Text size="sm" fw={600} c={agent.color}>
                                {finding.label}
                              </Text>
                              {typeof finding.confidence === 'number' && (
                                <Tooltip
                                  label={
                                    finding.reasoning ||
                                    `Güven: %${Math.round(finding.confidence * 100)}`
                                  }
                                  multiline
                                  maw={280}
                                >
                                  <Badge
                                    size="xs"
                                    variant="light"
                                    color={
                                      finding.confidence >= 0.8
                                        ? 'teal'
                                        : finding.confidence >= 0.5
                                          ? 'yellow'
                                          : 'red'
                                    }
                                    style={{ flexShrink: 0, cursor: 'help' }}
                                  >
                                    %{Math.round(finding.confidence * 100)}
                                  </Badge>
                                </Tooltip>
                              )}
                            </Group>
                            <Text size="xs" c="gray.5" mt={2} style={{ lineHeight: 1.6 }}>
                              {finding.value}
                            </Text>
                          </div>
                        </Group>
                      </Box>
                    );
                  })
                )}
              </Stack>
            </Stack>
          </ScrollArea>
        </Tabs.Panel>

        {/* Araçlar (Tools) Tab */}
        <Tabs.Panel value="tools" style={{ overflow: 'hidden' }}>
          <ScrollArea h="100%" px="lg" pb="lg">
            <AgentToolkit
              agent={agent}
              tenderId={tenderId}
              analysisContext={analysisContext}
              daysLeft={daysLeft}
              onToolComplete={onToolComplete}
            />
          </ScrollArea>
        </Tabs.Panel>

        {/* Kütüphane (Library) Tab */}
        <Tabs.Panel value="library" style={{ overflow: 'hidden' }}>
          <ScrollArea h="100%" px="lg" pb="lg">
            <Stack gap="md">
              {knowledgeLoading ? (
                <Stack align="center" py="xl" gap="sm">
                  <Loader size="sm" color={agent.color} type="bars" />
                  <Text size="sm" c="dimmed">
                    Kütüphane yükleniyor...
                  </Text>
                </Stack>
              ) : !knowledgeData?.knowledge || knowledgeData.knowledge.length === 0 ? (
                <Stack align="center" py="xl" gap="sm">
                  <IconBook2 size={32} color="var(--mantine-color-gray-6)" />
                  <Text size="sm" c="dimmed" ta="center">
                    Bu agent için henüz kütüphane kaynağı yok.
                  </Text>
                  <Text size="xs" c="dimmed" ta="center">
                    Ayarlar sayfasından kaynak ekleyebilirsiniz.
                  </Text>
                </Stack>
              ) : (
                knowledgeData.knowledge.map((item: AgentKnowledge) => (
                  <KnowledgeCard key={item.id} item={item} agentColor={agent.color} />
                ))
              )}
            </Stack>
          </ScrollArea>
        </Tabs.Panel>

        {/* Ayarlar (Settings) Tab */}
        <Tabs.Panel value="settings" style={{ overflow: 'hidden' }}>
          <ScrollArea h="100%" px="lg" pb="lg">
            <Stack gap="md">
              {agentLoading ? (
                <Stack align="center" py="xl" gap="sm">
                  <Loader size="sm" color={agent.color} type="bars" />
                  <Text size="sm" c="dimmed">
                    Yükleniyor...
                  </Text>
                </Stack>
              ) : agentDetail ? (
                <>
                  {/* Model */}
                  <Box
                    p="sm"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 10,
                    }}
                  >
                    <Text size="xs" c="dimmed" mb={4}>
                      Model
                    </Text>
                    <Badge variant="light" color={agent.color}>
                      {agentDetail.model === 'default' ? 'Varsayılan' : agentDetail.model}
                    </Badge>
                  </Box>

                  {/* Verdict Weight */}
                  <Box
                    p="sm"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 10,
                    }}
                  >
                    <Text size="xs" c="dimmed" mb={4}>
                      Verdict Ağırlığı
                    </Text>
                    <Text size="sm" c="white" fw={500}>
                      %{Math.round(agentDetail.verdict_weight * 100)}
                    </Text>
                  </Box>

                  {/* System Prompt Preview */}
                  <Box
                    p="sm"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 10,
                    }}
                  >
                    <Text size="xs" c="dimmed" mb={4}>
                      System Prompt
                    </Text>
                    <Text
                      size="xs"
                      c="gray.5"
                      lineClamp={4}
                      style={{
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                      }}
                    >
                      {agentDetail.system_prompt || '(Tanımlanmamış)'}
                    </Text>
                  </Box>

                  {/* Link to full settings */}
                  <Divider color="dark.5" />
                  <Box ta="center">
                    <Link href="/ayarlar?tab=agents" passHref legacyBehavior>
                      <Text
                        component="a"
                        size="sm"
                        c={agent.color}
                        style={{ textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        Ayarlar sayfasında düzenle
                      </Text>
                    </Link>
                  </Box>
                </>
              ) : (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  Agent bilgileri alınamadı.
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ─── Knowledge Card Component ────────────────────────────────

const CONTENT_TYPE_ICONS = {
  pdf: IconFileText,
  url: IconLink,
  note: IconNote,
  template: IconFileText,
  past_analysis: IconBrain,
};

interface KnowledgeCardProps {
  item: AgentKnowledge;
  agentColor: string;
}

function KnowledgeCard({ item, agentColor }: KnowledgeCardProps) {
  const IconComp = CONTENT_TYPE_ICONS[item.content_type] || IconFileText;

  return (
    <Box
      p="sm"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        borderLeft: `3px solid var(--mantine-color-${agentColor}-5)`,
      }}
    >
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size="md" variant="light" color={agentColor}>
          <IconComp size={14} />
        </ThemeIcon>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} c="white" lineClamp={1}>
            {item.title}
          </Text>
          {item.summary && (
            <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
              {item.summary}
            </Text>
          )}
          <Group gap="xs" mt={6}>
            <Badge size="xs" variant="dot" color={agentColor}>
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
    </Box>
  );
}
