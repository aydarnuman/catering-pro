'use client';

import { ActionIcon, Badge, Box, Card, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconCalendar, IconEye, IconTrash } from '@tabler/icons-react';

export interface ConversationSummary {
  session_id: string;
  user_id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  user_messages: number;
  ai_messages: number;
  first_user_message: string;
  preview: string;
}

interface ChatHistoryListProps {
  conversations: ConversationSummary[];
  onView: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export function ChatHistoryList({ conversations, onView, onDelete }: ChatHistoryListProps) {
  // Zaman farkı hesapla
  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;

    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (conversations.length === 0) {
    return null;
  }

  return (
    <Stack gap="sm">
      {conversations.map((conv) => (
        <Card key={conv.session_id} p="md" withBorder>
          <Group justify="space-between" wrap="nowrap">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Group gap="xs" mb={4}>
                <IconCalendar size={14} color="gray" />
                <Text size="xs" c="dimmed">
                  {getTimeAgo(conv.last_message_at)}
                </Text>
                <Badge size="xs" variant="light">
                  {conv.message_count} mesaj
                </Badge>
              </Group>

              <Text size="sm" fw={500} lineClamp={1} mb={4}>
                {conv.preview || conv.first_user_message || 'Boş oturum'}
              </Text>

              <Group gap="xs">
                <Badge size="xs" color="blue" variant="dot">
                  {conv.user_messages} soru
                </Badge>
                <Badge size="xs" color="violet" variant="dot">
                  {conv.ai_messages} cevap
                </Badge>
              </Group>
            </Box>

            <Group gap="xs">
              <Tooltip label="Görüntüle">
                <ActionIcon variant="light" color="blue" onClick={() => onView(conv.session_id)}>
                  <IconEye size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Sil">
                <ActionIcon variant="light" color="red" onClick={() => onDelete(conv.session_id)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
