import { Badge, Box, Button, Divider, Group, Stack, Text, Tooltip } from '@mantine/core';
import {
  IconArrowLeft,
  IconCircleCheck,
  IconCircleX,
  IconFileInvoice,
  IconHelpCircle,
  IconShieldCheck,
  IconShieldExclamation,
  IconShieldX,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { AGENTS } from '../constants';
import type { ChecklistItem, CrossReference, VerdictData } from '../types';

const RECOMMENDATION_CONFIG = {
  gir: {
    color: 'green',
    icon: IconShieldCheck,
    gradient: { from: 'green', to: 'teal' },
    glowColor: 'rgba(16, 185, 129, 0.35)',
    glowHex: '#10b981',
  },
  dikkat: {
    color: 'yellow',
    icon: IconShieldExclamation,
    gradient: { from: 'yellow', to: 'orange' },
    glowColor: 'rgba(245, 158, 11, 0.35)',
    glowHex: '#f59e0b',
  },
  girme: {
    color: 'red',
    icon: IconShieldX,
    gradient: { from: 'red', to: 'pink' },
    glowColor: 'rgba(244, 63, 94, 0.35)',
    glowHex: '#f43f5e',
  },
};

interface RiskScoreRingProps {
  score: number;
  color: string;
  glowColor: string;
}

function RiskScoreRing({ score, color, glowColor }: RiskScoreRingProps) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Box className="risk-score-ring" style={{ position: 'relative' }}>
      {/* Glow behind ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        style={{
          position: 'absolute',
          inset: -12,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          filter: 'blur(8px)',
          zIndex: 0,
        }}
      />
      <svg width="110" height="110" viewBox="0 0 110 110" style={{ position: 'relative', zIndex: 1 }}>
        <title>Risk Skoru</title>
        {/* Background circle */}
        <circle cx="55" cy="55" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        {/* Outer decorative ring */}
        <circle
          cx="55"
          cy="55"
          r={radius + 4}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        {/* Score arc */}
        <motion.circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={`var(--mantine-color-${color}-5)`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ delay: 1, duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <motion.div
        className="score-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        style={{ color: `var(--mantine-color-${color}-4)` }}
      >
        {score}
      </motion.div>
    </Box>
  );
}

interface VerdictReportProps {
  data: VerdictData;
  crossReferences?: CrossReference[];
  onReset: () => void;
  onOpenTeklif?: () => void;
}

export function VerdictReport({ data, crossReferences = [], onReset, onOpenTeklif }: VerdictReportProps) {
  const config = RECOMMENDATION_CONFIG[data.recommendation];
  const RecommendIcon = config.icon;

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ delay: 0.8, type: 'spring', stiffness: 80, damping: 18 }}
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
      }}
    >
      {/* Holographic outer glow */}
      <div
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: 24,
          background: `radial-gradient(ellipse at 50% 100%, ${config.glowColor} 0%, transparent 60%)`,
          filter: 'blur(16px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Box className="verdict-card-holo" style={{ position: 'relative', zIndex: 1 }}>
        <Stack gap="md">
          {/* Header */}
          <Group justify="center" gap="sm">
            <RecommendIcon size={28} color={`var(--mantine-color-${config.color}-4)`} />
            <Text size="lg" fw={800} c="white">
              Karar Raporu
            </Text>
          </Group>

          {/* Score + Recommendation */}
          <Group justify="center" gap="xl" align="center">
            <RiskScoreRing score={data.overallScore} color={config.color} glowColor={config.glowColor} />
            <Stack gap={4}>
              <Badge size="lg" variant="gradient" gradient={config.gradient} style={{ fontSize: 13 }}>
                {data.recommendationLabel}
              </Badge>
              <Text size="xs" c="dimmed" ta="center">
                Genel Risk Skoru
              </Text>
            </Stack>
          </Group>

          <Divider color="dark.5" />

          {/* Agent Summaries with Weights */}
          <Stack gap={10}>
            {data.agents.map((agentAnalysis, idx) => {
              const agent = AGENTS.find((a) => a.id === agentAnalysis.agentId);
              if (!agent) return null;
              const weight = data.weights?.[agentAnalysis.agentId];

              return (
                <motion.div
                  key={agentAnalysis.agentId}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + idx * 0.15, duration: 0.4 }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Badge size="sm" variant="filled" color={agent.color} w={36} style={{ flexShrink: 0 }}>
                      {agentAnalysis.riskScore}
                    </Badge>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Group gap={4} align="center">
                        <Text size="xs" fw={600} c="white" lineClamp={1}>
                          {agent.name}
                        </Text>
                        {weight !== undefined && (
                          <Text size="9px" c="dimmed" fw={500}>
                            ×{Math.round(weight * 100)}%
                          </Text>
                        )}
                      </Group>
                      <Text size="10px" c="gray.5" lineClamp={1}>
                        {agentAnalysis.summary}
                      </Text>
                    </div>
                  </Group>
                </motion.div>
              );
            })}
          </Stack>

          {/* Go/No-Go Checklist */}
          {data.checklist && data.checklist.length > 0 && (
            <>
              <Divider color="dark.5" />
              <ChecklistSection checklist={data.checklist} />
            </>
          )}

          {/* Cross-Agent References */}
          {crossReferences.length > 0 && (
            <>
              <Divider color="dark.5" />
              <CrossReferenceSection crossReferences={crossReferences} />
            </>
          )}

          <Divider color="dark.5" />

          {/* Actions */}
          <Group justify="center" gap="sm">
            <Button variant="subtle" color="gray" size="sm" leftSection={<IconArrowLeft size={14} />} onClick={onReset}>
              Yeniden Degerlendir
            </Button>
            {onOpenTeklif && (
              <Button
                variant="gradient"
                gradient={
                  data.recommendation === 'girme'
                    ? { from: 'gray', to: 'dark' }
                    : data.recommendation === 'gir'
                      ? { from: 'violet', to: 'indigo', deg: 135 }
                      : { from: 'yellow', to: 'orange', deg: 135 }
                }
                size="sm"
                leftSection={<IconFileInvoice size={14} />}
                onClick={onOpenTeklif}
              >
                Teklif Hazirla
              </Button>
            )}
          </Group>
        </Stack>
      </Box>
    </motion.div>
  );
}

// ─── Checklist Section ───────────────────────────────────────

const CHECKLIST_STATUS_CONFIG = {
  pass: { icon: IconCircleCheck, color: 'green' },
  fail: { icon: IconCircleX, color: 'red' },
  unknown: { icon: IconHelpCircle, color: 'yellow' },
};

function CrossReferenceSection({ crossReferences }: { crossReferences: CrossReference[] }) {
  const severityColor = (s: CrossReference['severity']) =>
    s === 'critical' ? '#f43f5e' : s === 'warning' ? '#f59e0b' : '#6366f1';

  return (
    <Stack gap={8}>
      <Text size="xs" fw={700} c="white">
        Agent Etkilesimleri
      </Text>
      <Stack gap={6}>
        {crossReferences.map((ref) => {
          const fromAgent = AGENTS.find((a) => a.id === ref.fromAgentId);
          const toAgent = AGENTS.find((a) => a.id === ref.toAgentId);
          return (
            <Group
              key={`${ref.fromAgentId}-${ref.toAgentId}-${ref.fromFinding}`}
              gap="xs"
              wrap="nowrap"
              p={6}
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 6,
                borderLeft: `3px solid ${severityColor(ref.severity)}`,
              }}
            >
              <Badge size="xs" color={fromAgent?.color}>
                {fromAgent?.name?.split(' ')[0]}
              </Badge>
              <Text size="xs" c="dimmed">
                →
              </Text>
              <Badge size="xs" color={toAgent?.color}>
                {toAgent?.name?.split(' ')[0]}
              </Badge>
              <Text size="xs" c="gray.4" style={{ flex: 1 }} lineClamp={1}>
                {ref.impact}
              </Text>
            </Group>
          );
        })}
      </Stack>
    </Stack>
  );
}

function ChecklistSection({ checklist }: { checklist: ChecklistItem[] }) {
  const passCount = checklist.filter((c) => c.status === 'pass').length;
  const failCount = checklist.filter((c) => c.status === 'fail').length;

  return (
    <Stack gap={8}>
      <Group justify="space-between" align="center">
        <Text size="xs" fw={700} c="white">
          Go/No-Go Kontrol
        </Text>
        <Group gap={4}>
          <Badge size="xs" variant="light" color="green">
            {passCount} uygun
          </Badge>
          {failCount > 0 && (
            <Badge size="xs" variant="light" color="red">
              {failCount} eksik
            </Badge>
          )}
        </Group>
      </Group>

      <Stack gap={4}>
        {checklist.map((item, idx) => {
          const statusConf = CHECKLIST_STATUS_CONFIG[item.status];
          const StatusIcon = statusConf.icon;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2 + idx * 0.06, duration: 0.3 }}
            >
              <Tooltip label={item.detail || ''} disabled={!item.detail} withArrow multiline w={240}>
                <Group gap={6} wrap="nowrap" style={{ cursor: item.detail ? 'help' : 'default' }}>
                  <StatusIcon
                    size={14}
                    color={`var(--mantine-color-${statusConf.color}-5)`}
                    style={{ flexShrink: 0 }}
                  />
                  <Text
                    size="10px"
                    c={item.status === 'fail' ? `${statusConf.color}.4` : 'gray.4'}
                    fw={item.severity === 'critical' ? 600 : 400}
                    lineClamp={1}
                    style={{ flex: 1 }}
                  >
                    {item.label}
                  </Text>
                  {item.severity === 'critical' && (
                    <Text size="8px" c="red.5" fw={700} style={{ flexShrink: 0 }}>
                      KRİTİK
                    </Text>
                  )}
                </Group>
              </Tooltip>
            </motion.div>
          );
        })}
      </Stack>
    </Stack>
  );
}
