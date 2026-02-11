import { ActionIcon, Badge, Box, Divider, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalculator,
  IconHelmet,
  IconInfoCircle,
  IconRadar2,
  IconScale,
} from '@tabler/icons-react';
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
}

export function AgentDetailPanel({ agent, analysis, snippetDrops, tenderId, analysisContext, daysLeft, onBack, onToolComplete }: AgentDetailPanelProps) {
  const IconComponent = ICON_MAP[agent.iconName];
  const agentSnippets = snippetDrops?.filter((s) => s.agentId === agent.id) || [];

  return (
    <div
      className="agent-detail-panel"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
        <Box p="lg">
          <Stack gap="lg">
            {/* Header */}
            <Group justify="space-between" align="center">
              <Group gap="md">
                <ThemeIcon
                  size={44}
                  variant="gradient"
                  gradient={{ from: agent.color, to: agent.color }}
                  radius="xl"
                >
                  <IconComponent size={24} />
                </ThemeIcon>
                <div>
                  <Text size="lg" fw={700} c="white">{agent.name}</Text>
                  <Text size="xs" c="gray.5">{agent.subtitle}</Text>
                </div>
              </Group>
              <ActionIcon variant="subtle" color="gray" onClick={onBack} size="lg">
                <IconArrowLeft size={18} />
              </ActionIcon>
            </Group>

            {/* Score */}
            <Group gap="sm">
              <Badge
                size="lg"
                variant="gradient"
                gradient={{ from: agent.color, to: agent.color }}
              >
                Risk Skoru: {analysis.riskScore}/100
              </Badge>
            </Group>

            <Divider color="dark.5" />

            {/* Dropped Snippets */}
            {agentSnippets.length > 0 && (
              <>
                <Text size="sm" fw={600} c={agent.color}>
                  Suruklenen Metin Analizi ({agentSnippets.length})
                </Text>
                <Stack gap={8}>
                  {agentSnippets.map((snippet, idx) => (
                    <Box
                      key={idx}
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
              {analysis.findings.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  Bu alan icin analiz verisi bulunamadi
                </Text>
              ) : (
                analysis.findings.map((finding, idx) => {
                  const severityConf = finding.severity
                    ? SEVERITY_CONFIG[finding.severity]
                    : null;

                  return (
                    <Box
                      key={idx}
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
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={600} c={agent.color}>
                            {finding.label}
                          </Text>
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

            {/* Agent Toolkit (tools section) */}
            <AgentToolkit agent={agent} tenderId={tenderId} analysisContext={analysisContext} daysLeft={daysLeft} onToolComplete={onToolComplete} />
          </Stack>
        </Box>
    </div>
  );
}
