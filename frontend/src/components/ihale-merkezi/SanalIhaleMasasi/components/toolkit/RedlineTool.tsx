import { Box, Stack, Text } from '@mantine/core';
import type { ToolResult } from '../../types';
import { ToolResultCard } from './ToolResultCard';

interface RedlineToolProps {
  result: ToolResult;
  onClose: () => void;
}

export function RedlineTool({ result, onClose }: RedlineToolProps) {
  return (
    <ToolResultCard title="Madde Revizyonu" color="indigo" onClose={onClose}>
      <Stack gap={8}>
        {/* Original (red strikethrough) */}
        <Box
          p="xs"
          style={{
            background: 'rgba(244, 63, 94, 0.06)',
            borderRadius: 8,
            borderLeft: '2px solid rgba(244, 63, 94, 0.4)',
          }}
        >
          <Text size="10px" c="red.4" fw={600} mb={2}>
            MEVCUT
          </Text>
          <Text size="xs" c="gray.5" style={{ textDecoration: 'line-through', lineHeight: 1.6 }}>
            {result.originalText}
          </Text>
        </Box>

        {/* Revised (green) */}
        <Box
          p="xs"
          style={{
            background: 'rgba(16, 185, 129, 0.06)',
            borderRadius: 8,
            borderLeft: '2px solid rgba(16, 185, 129, 0.4)',
          }}
        >
          <Text size="10px" c="green.4" fw={600} mb={2}>
            ONERILEN
          </Text>
          <Text size="xs" c="white" style={{ lineHeight: 1.6 }}>
            {result.revisedText}
          </Text>
        </Box>

        {/* Explanation */}
        {result.explanation && (
          <Text size="10px" c="dimmed" style={{ lineHeight: 1.5 }}>
            {result.explanation}
          </Text>
        )}
      </Stack>
    </ToolResultCard>
  );
}
