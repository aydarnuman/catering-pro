import { ActionIcon, Box, Group, Text, Tooltip } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalculator,
  IconChartBar,
  IconFileText,
  IconGauge,
  IconGavel,
  IconLoader2,
  IconPencil,
  IconSearch,
  IconShieldCheck,
  IconTarget,
  IconToolsKitchen2,
  IconUsers,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import type { AgentTool, ToolExecution } from '../../types';

const ICON_MAP: Record<string, typeof IconPencil> = {
  pencil: IconPencil,
  gavel: IconGavel,
  'file-text': IconFileText,
  calculator: IconCalculator,
  'chart-bar': IconChartBar,
  'shield-check': IconShieldCheck,
  users: IconUsers,
  'chef-hat': IconToolsKitchen2,
  gauge: IconGauge,
  search: IconSearch,
  target: IconTarget,
};

interface ToolButtonProps {
  tool: AgentTool;
  execution?: ToolExecution;
  disabled?: boolean;
  onExecute: () => void;
}

export function ToolButton({ tool, execution, disabled, onExecute }: ToolButtonProps) {
  const Icon = ICON_MAP[tool.icon] || IconFileText;
  const isGenerating = execution?.status === 'generating';
  const isComplete = execution?.status === 'complete';
  const isError = execution?.status === 'error';

  return (
    <Tooltip label={tool.description} position="top" withArrow>
      <Box
        component={motion.div}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
      >
        <Group
          gap={8}
          wrap="nowrap"
          p="xs"
          px="sm"
          onClick={disabled || isGenerating ? undefined : onExecute}
          style={{
            background: isComplete
              ? 'rgba(16, 185, 129, 0.08)'
              : isError
                ? 'rgba(239, 68, 68, 0.08)'
                : isGenerating
                  ? 'rgba(99, 102, 241, 0.08)'
                  : 'rgba(255,255,255,0.03)',
            borderRadius: 10,
            border: `1px solid ${
              isComplete
                ? 'rgba(16, 185, 129, 0.2)'
                : isError
                  ? 'rgba(239, 68, 68, 0.2)'
                  : isGenerating
                    ? 'rgba(99, 102, 241, 0.2)'
                    : 'rgba(255,255,255,0.06)'
            }`,
            cursor: disabled || isGenerating ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          <ActionIcon
            variant="subtle"
            color={isComplete ? 'green' : isError ? 'red' : isGenerating ? 'indigo' : 'gray'}
            size="sm"
          >
            {isGenerating ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
              >
                <IconLoader2 size={16} />
              </motion.div>
            ) : isError ? (
              <IconAlertTriangle size={16} />
            ) : (
              <Icon size={16} />
            )}
          </ActionIcon>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text size="xs" fw={600} c={isComplete ? 'green.4' : isError ? 'red.4' : 'white'} lineClamp={1}>
              {tool.label}
            </Text>
            {isGenerating && (
              <Text size="10px" c="indigo.4">
                Olusturuluyor...
              </Text>
            )}
            {isComplete && (
              <Text size="10px" c="green.5">
                Tamamlandi
              </Text>
            )}
            {isError && (
              <Text size="10px" c="red.4">
                Hata — tekrar deneyin
              </Text>
            )}
            {tool.requiresSelection && !isGenerating && !isComplete && !isError && (
              <Text size="10px" c="dimmed">
                Metin secimi gerekli
              </Text>
            )}
          </div>
        </Group>
      </Box>
    </Tooltip>
  );
}
