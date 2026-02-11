import { Badge, Box, Group, Stack, Text } from '@mantine/core';
import { IconScale } from '@tabler/icons-react';
import type { ToolResult } from '../../types';
import { ToolResultCard } from './ToolResultCard';

const RELEVANCE_COLOR: Record<string, string> = {
  Yuksek: 'red',
  Orta: 'yellow',
  Dusuk: 'gray',
};

interface PrecedentToolProps {
  result: ToolResult;
  onClose: () => void;
}

export function PrecedentTool({ result, onClose }: PrecedentToolProps) {
  return (
    <ToolResultCard title="Emsal Kararlar" color="indigo" onClose={onClose}>
      <Stack gap={8}>
        {(result.citations || []).map((citation, idx) => (
          <Box
            key={idx}
            p="xs"
            style={{
              background: 'rgba(99, 102, 241, 0.04)',
              borderRadius: 8,
              border: '1px solid rgba(99, 102, 241, 0.1)',
            }}
          >
            <Group gap={6} mb={4} wrap="nowrap">
              <IconScale size={12} color="var(--mantine-color-indigo-4)" style={{ flexShrink: 0 }} />
              <Text size="10px" fw={700} c="indigo.4" lineClamp={1} style={{ flex: 1 }}>
                {citation.reference}
              </Text>
              <Badge
                size="xs"
                variant="light"
                color={RELEVANCE_COLOR[citation.relevance] || 'gray'}
                style={{ flexShrink: 0 }}
              >
                {citation.relevance}
              </Badge>
            </Group>
            <Text size="xs" c="gray.4" style={{ lineHeight: 1.5 }}>
              {citation.summary}
            </Text>
          </Box>
        ))}
      </Stack>
    </ToolResultCard>
  );
}
