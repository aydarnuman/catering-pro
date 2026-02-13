import { Badge, Box, Group, Text, ThemeIcon } from '@mantine/core';
import { IconBrain, IconFileText, IconLink, IconNote } from '@tabler/icons-react';
import type { AgentKnowledge } from '@/lib/api/services/agents';

const CONTENT_TYPE_ICONS: Record<string, typeof IconFileText> = {
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

export function KnowledgeCard({ item, agentColor }: KnowledgeCardProps) {
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
