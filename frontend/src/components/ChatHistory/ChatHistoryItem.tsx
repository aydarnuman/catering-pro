'use client';

import { Avatar, Badge, Box, Group, Paper, Text } from '@mantine/core';
import { IconRobot, IconTool, IconUser } from '@tabler/icons-react';

export interface ChatMessage {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  tools_used: string[] | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface ChatHistoryItemProps {
  message: ChatMessage;
  showTime?: boolean;
}

export function ChatHistoryItem({ message, showTime = true }: ChatHistoryItemProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isUser = message.role === 'user';

  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <Avatar size="sm" color={isUser ? 'blue' : 'violet'} radius="xl">
        {isUser ? <IconUser size={14} /> : <IconRobot size={14} />}
      </Avatar>

      <Box style={{ flex: 1 }}>
        <Group gap="xs" mb={4}>
          <Text size="xs" fw={500}>
            {isUser ? 'Siz' : 'AI Agent'}
          </Text>
          {showTime && (
            <Text size="xs" c="dimmed">
              {formatDate(message.created_at)}
            </Text>
          )}
        </Group>

        <Paper p="sm" bg={isUser ? 'blue.0' : 'violet.0'} radius="md">
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Text>
        </Paper>

        {message.tools_used && message.tools_used.length > 0 && (
          <Group gap={4} mt={4}>
            <IconTool size={12} color="gray" />
            {message.tools_used.slice(0, 5).map((tool, i) => (
              <Badge key={i} size="xs" variant="dot" color="violet">
                {tool.split('_').slice(0, 2).join(' ')}
              </Badge>
            ))}
            {message.tools_used.length > 5 && (
              <Badge size="xs" variant="light" color="gray">
                +{message.tools_used.length - 5}
              </Badge>
            )}
          </Group>
        )}
      </Box>
    </Group>
  );
}
