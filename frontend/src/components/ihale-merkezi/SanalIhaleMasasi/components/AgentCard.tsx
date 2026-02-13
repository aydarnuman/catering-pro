import { Badge, Box, Group, Loader, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle, IconCalculator, IconHelmet, IconRadar2, IconScale } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { AgentAnalysis, AgentPersona, ViewMode } from '../types';

const ICON_MAP = {
  scale: IconScale,
  calculator: IconCalculator,
  hardhat: IconHelmet,
  radar: IconRadar2,
};

const STATUS_LABELS: Record<AgentAnalysis['status'], { label: string; color: string }> = {
  analyzing: { label: 'Analiz Ediliyor', color: 'blue' },
  complete: { label: 'Tamamlandı', color: 'green' },
  warning: { label: 'Dikkat', color: 'yellow' },
  critical: { label: 'Kritik', color: 'red' },
  'no-data': { label: 'Veri Yok', color: 'gray' },
};

interface AgentCardProps {
  agent: AgentPersona;
  analysis: AgentAnalysis;
  viewMode: ViewMode;
  isMobile?: boolean;
  /** Whether something is being dragged over this agent */
  isDropTarget?: boolean;
  /** Number of snippets already dropped on this agent */
  snippetCount?: number;
  onClick: () => void;
}

export function AgentCard({
  agent,
  analysis,
  viewMode,
  isMobile,
  isDropTarget,
  snippetCount,
  onClick,
}: AgentCardProps) {
  const IconComponent = ICON_MAP[agent.iconName];
  const statusInfo = STATUS_LABELS[analysis.status];

  const isCurrentlyAnalyzing = analysis.status === 'analyzing';
  const isError = analysis.status === 'no-data';
  const hasFindings = !isCurrentlyAnalyzing && !isError && analysis.findings.length > 0;

  // Bulgu severity sayaci
  const severityCounts = useMemo(() => {
    if (!hasFindings) return null;
    const critical = analysis.findings.filter((f) => f.severity === 'critical').length;
    const warning = analysis.findings.filter((f) => f.severity === 'warning').length;
    const info = analysis.findings.filter((f) => f.severity === 'info').length;
    return { critical, warning, info };
  }, [analysis.findings, hasFindings]);

  // ─── Mobile Layout ────────────────────────────────────────

  if (isMobile) {
    return (
      <motion.div
        layout
        onClick={onClick}
        whileTap={{ scale: 0.95 }}
        animate={isDropTarget ? { scale: 1.15 } : { scale: 1 }}
        style={{ cursor: 'pointer' }}
      >
        <Box
          className={`agent-card ${agent.color}`}
          style={
            isDropTarget
              ? {
                  boxShadow: `0 0 40px ${agent.accentHex}60`,
                  borderColor: agent.accentHex,
                }
              : undefined
          }
        >
          <Stack align="center" gap={6}>
            <ThemeIcon size={36} variant="light" color={isError ? 'gray' : agent.color} radius="xl">
              {isCurrentlyAnalyzing ? (
                <Loader size={16} color={agent.color} type="dots" />
              ) : isError ? (
                <IconAlertTriangle size={18} />
              ) : (
                <IconComponent size={20} />
              )}
            </ThemeIcon>
            <Text size="9px" fw={600} ta="center" c="dimmed" lineClamp={2}>
              {agent.name}
            </Text>
            {/* Mobile: kompakt bulgu sayaci */}
            {severityCounts && (severityCounts.critical > 0 || severityCounts.warning > 0) && (
              <Group gap={4} justify="center">
                {severityCounts.critical > 0 && (
                  <Text size="8px" fw={700} c="red.4">
                    {severityCounts.critical} kritik
                  </Text>
                )}
                {severityCounts.warning > 0 && (
                  <Text size="8px" fw={600} c="yellow.5">
                    {severityCounts.warning} uyari
                  </Text>
                )}
              </Group>
            )}
          </Stack>
        </Box>
      </motion.div>
    );
  }

  // ─── Desktop Layout ───────────────────────────────────────

  return (
    <motion.div
      layout
      onClick={onClick}
      whileHover={!isDropTarget ? { scale: 1.04 } : undefined}
      whileTap={{ scale: 0.97 }}
      animate={isDropTarget ? { scale: 1.15 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ cursor: 'pointer' }}
    >
      <Box
        className={`agent-card ${agent.color}`}
        style={
          isDropTarget
            ? {
                boxShadow: `0 0 48px ${agent.accentHex}50, 0 0 80px ${agent.accentHex}20`,
                borderColor: `${agent.accentHex}80`,
              }
            : undefined
        }
      >
        <Stack align="center" gap={10}>
          <Box style={{ position: 'relative' }}>
            <motion.div
              animate={
                isCurrentlyAnalyzing
                  ? {
                      boxShadow: [
                        `0 0 8px ${agent.accentHex}30`,
                        `0 0 24px ${agent.accentHex}60`,
                        `0 0 8px ${agent.accentHex}30`,
                      ],
                    }
                  : {}
              }
              transition={isCurrentlyAnalyzing ? { duration: 1.5, repeat: Number.POSITIVE_INFINITY } : {}}
              style={{ borderRadius: '50%' }}
            >
              <ThemeIcon
                size={48}
                variant="gradient"
                gradient={
                  isError
                    ? { from: 'gray.7', to: 'gray.6', deg: 135 }
                    : { from: agent.color, to: agent.color, deg: 135 }
                }
                radius="xl"
                style={{ boxShadow: isCurrentlyAnalyzing ? undefined : `0 0 16px ${agent.accentHex}40` }}
              >
                {isCurrentlyAnalyzing ? (
                  <Loader size={20} color="white" type="dots" />
                ) : isError ? (
                  <IconAlertTriangle size={22} />
                ) : (
                  <IconComponent size={24} />
                )}
              </ThemeIcon>
            </motion.div>
            {/* Snippet count badge */}
            {(snippetCount ?? 0) > 0 && (
              <Badge
                size="xs"
                variant="filled"
                color={agent.color}
                circle
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 18,
                  height: 18,
                  padding: 0,
                  fontSize: 10,
                }}
              >
                {snippetCount}
              </Badge>
            )}
          </Box>

          <div>
            <Text size="sm" fw={700} ta="center" c="white">
              {agent.name}
            </Text>
            <Text size="xs" ta="center" c={isCurrentlyAnalyzing ? 'blue.4' : 'dimmed'} mt={2}>
              {isCurrentlyAnalyzing ? 'AI analiz ediliyor...' : agent.subtitle}
            </Text>
          </div>

          {/* Bulgu sayaci -- analiz tamamlandiginda goster */}
          {severityCounts && (
            <Group gap={6} justify="center">
              {severityCounts.critical > 0 && (
                <Text size="10px" fw={700} c="red.4">
                  {severityCounts.critical} kritik
                </Text>
              )}
              {severityCounts.warning > 0 && (
                <Text size="10px" fw={600} c="yellow.5">
                  {severityCounts.warning} uyari
                </Text>
              )}
              {severityCounts.critical === 0 && severityCounts.warning === 0 && severityCounts.info > 0 && (
                <Text size="10px" fw={500} c="dimmed">
                  {severityCounts.info} bilgi
                </Text>
              )}
            </Group>
          )}

          <Badge size="sm" variant="dot" color={statusInfo.color}>
            {statusInfo.label}
          </Badge>

          {analysis.riskScore > 0 && viewMode !== 'ASSEMBLE' && !isCurrentlyAnalyzing && (
            <Text size="xs" fw={600} c={agent.color}>
              Skor: {analysis.riskScore}/100
            </Text>
          )}

          {/* Analiz ozeti -- en kritik bulgunun tek satirlik aciklamasi */}
          {hasFindings && analysis.summary && viewMode !== 'ASSEMBLE' && (
            <Text
              size="9px"
              c="dimmed"
              ta="center"
              lineClamp={2}
              style={{ maxWidth: 140, lineHeight: 1.4, opacity: 0.7 }}
            >
              {analysis.summary}
            </Text>
          )}

          {/* Drop target hint */}
          {isDropTarget && (
            <Text size="10px" fw={600} c={agent.color} ta="center">
              Birak &rarr; Analiz Et
            </Text>
          )}
        </Stack>
      </Box>
    </motion.div>
  );
}
