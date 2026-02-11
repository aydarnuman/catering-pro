import { Box, Group, Stack, Text } from '@mantine/core';
import { IconCalendar, IconFileText } from '@tabler/icons-react';
import type { ToolResult } from '../../types';
import { ToolResultCard } from './ToolResultCard';

interface DraftToolProps {
  result: ToolResult;
  onClose: () => void;
}

export function DraftTool({ result, onClose }: DraftToolProps) {
  return (
    <ToolResultCard title="Zeyilname Taslagi" color="indigo" onClose={onClose}>
      <Stack gap={8}>
        {/* Header */}
        <Group gap={6} wrap="nowrap">
          <IconFileText size={14} color="var(--mantine-color-indigo-4)" />
          <Text size="xs" fw={700} c="white" lineClamp={1} style={{ flex: 1 }}>
            {result.draftTitle}
          </Text>
        </Group>

        {/* Metadata */}
        <Group gap={12}>
          {result.addressee && (
            <Text size="10px" c="dimmed">
              Muhatap: {result.addressee}
            </Text>
          )}
          {result.draftDate && (
            <Group gap={4}>
              <IconCalendar size={10} color="var(--mantine-color-gray-5)" />
              <Text size="10px" c="dimmed">
                {result.draftDate}
              </Text>
            </Group>
          )}
        </Group>

        {/* Body */}
        <Box
          p="xs"
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.04)',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          <Text
            size="xs"
            c="gray.4"
            style={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}
          >
            {result.draftBody}
          </Text>
        </Box>
      </Stack>
    </ToolResultCard>
  );
}
