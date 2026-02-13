'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCalendar,
  IconEye,
  IconHistory,
  IconMessage,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconTool,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import { formatDate } from '@/lib/formatters';

interface ConversationSummary {
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

interface Message {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  tools_used: string[] | null;
  created_at: string;
}

export default function ChatHistoryPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Sohbet geçmişini yükle
  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await aiAPI.getConversations({ limit: 100 });

      if (data.success) {
        setConversations((data as any).conversations || []);
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Geçmiş yüklenemedi',
          color: 'red',
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Sunucuya bağlanılamadı',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Arama
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      notifications.show({
        title: 'Uyarı',
        message: 'En az 2 karakter girin',
        color: 'yellow',
      });
      return;
    }

    try {
      setSearching(true);
      const data = await aiAPI.searchConversations(searchQuery, 50);

      if (data.success) {
        setSearchResults((data as any).results || []);
        if (!(data as any).results || (data as any).results.length === 0) {
          notifications.show({
            title: 'Sonuç Yok',
            message: 'Aramanızla eşleşen sonuç bulunamadı',
            color: 'blue',
          });
        }
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Arama yapılamadı',
        color: 'red',
      });
    } finally {
      setSearching(false);
    }
  };

  // Oturum detayını görüntüle
  const viewSession = async (sessionId: string) => {
    try {
      setLoadingSession(true);
      setSelectedSession(sessionId);
      setDetailModalOpen(true);

      const data = await aiAPI.getConversation(sessionId);

      if (data.success) {
        setSessionMessages((data as any).messages || []);
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Oturum yüklenemedi',
          color: 'red',
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Oturum detayı yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoadingSession(false);
    }
  };

  // Oturum sil
  const deleteSession = async (sessionId: string) => {
    if (!confirm('Bu sohbet oturumunu silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const data = await aiAPI.deleteConversation(sessionId);

      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: `${(data as any).deletedCount || 0} mesaj silindi`,
          color: 'green',
        });
        fetchConversations();
        if (selectedSession === sessionId) {
          setDetailModalOpen(false);
        }
      } else {
        notifications.show({
          title: 'Hata',
          message: data.error || 'Silinemedi',
          color: 'red',
        });
      }
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Silme işlemi başarısız',
        color: 'red',
      });
    }
  };

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
    return formatDate(dateStr);
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="md">
            <ActionIcon component={Link} href="/ai-chat" variant="subtle" size="lg">
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={2}>
                <IconHistory size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Sohbet Geçmişi
              </Title>
              <Text c="dimmed" size="sm">
                AI Asistan ile geçmiş konuşmalarınız
              </Text>
            </div>
          </Group>

          <Group gap="xs">
            <Tooltip label="Yenile">
              <ActionIcon variant="light" onClick={fetchConversations} loading={loading}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button component={Link} href="/ai-chat" leftSection={<IconRobot size={16} />}>
              Yeni Sohbet
            </Button>
          </Group>
        </Group>

        {/* Arama */}
        <Paper p="md" withBorder>
          <Group gap="xs">
            <TextInput
              flex={1}
              placeholder="Sohbetlerde ara..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} loading={searching} disabled={searchQuery.length < 2}>
              Ara
            </Button>
            {searchResults.length > 0 && (
              <Button variant="subtle" color="gray" onClick={() => setSearchResults([])}>
                Temizle
              </Button>
            )}
          </Group>
        </Paper>

        {/* Arama Sonuçları */}
        {searchResults.length > 0 && (
          <Paper p="md" withBorder>
            <Text fw={500} mb="md">
              🔍 Arama Sonuçları ({searchResults.length})
            </Text>
            <Stack gap="xs">
              {searchResults.map((result) => (
                <Card
                  key={result.id}
                  p="sm"
                  withBorder
                  style={{ cursor: 'pointer' }}
                  onClick={() => viewSession(result.session_id)}
                >
                  <Group gap="xs" mb={4}>
                    <Badge size="xs" color={result.role === 'user' ? 'blue' : 'violet'}>
                      {result.role === 'user' ? 'Siz' : 'AI'}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {formatDate(result.created_at)}
                    </Text>
                  </Group>
                  <Text size="sm" lineClamp={2}>
                    {result.content}
                  </Text>
                </Card>
              ))}
            </Stack>
          </Paper>
        )}

        {/* Sohbet Listesi */}
        {loading ? (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        ) : conversations.length === 0 ? (
          <Paper p="xl" withBorder ta="center">
            <IconHistory size={48} color="gray" style={{ opacity: 0.5 }} />
            <Text c="dimmed" mt="md">
              Henüz sohbet geçmişi yok
            </Text>
            <Button component={Link} href="/ai-chat" mt="md">
              İlk Sohbeti Başlat
            </Button>
          </Paper>
        ) : (
          <Stack gap="sm">
            <Text c="dimmed" size="sm">
              Toplam {conversations.length} oturum
            </Text>

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
                      <ActionIcon variant="light" color="blue" onClick={() => viewSession(conv.session_id)}>
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Sil">
                      <ActionIcon variant="light" color="red" onClick={() => deleteSession(conv.session_id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      {/* Oturum Detay Modal */}
      <Modal
        opened={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={
          <Group gap="xs">
            <IconMessage size={20} />
            <Text fw={500}>Sohbet Detayı</Text>
          </Group>
        }
        size="lg"
      >
        {loadingSession ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : (
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {sessionMessages.length} mesaj
              </Text>
              <Button
                size="xs"
                color="red"
                variant="light"
                leftSection={<IconTrash size={14} />}
                onClick={() => selectedSession && deleteSession(selectedSession)}
              >
                Oturumu Sil
              </Button>
            </Group>

            <Divider />

            <ScrollArea h={400}>
              <Stack gap="md">
                {sessionMessages.map((msg) => (
                  <Group key={msg.id} align="flex-start" gap="sm" wrap="nowrap">
                    <Avatar size="sm" color={msg.role === 'user' ? 'blue' : 'violet'} radius="xl">
                      {msg.role === 'user' ? <IconUser size={14} /> : <IconRobot size={14} />}
                    </Avatar>

                    <Box style={{ flex: 1 }}>
                      <Group gap="xs" mb={4}>
                        <Text size="xs" fw={500}>
                          {msg.role === 'user' ? 'Siz' : 'AI Agent'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatDate(msg.created_at)}
                        </Text>
                      </Group>

                      <Paper p="sm" bg={msg.role === 'user' ? 'blue.0' : 'violet.0'} radius="md">
                        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </Text>
                      </Paper>

                      {msg.tools_used && msg.tools_used.length > 0 && (
                        <Group gap={4} mt={4}>
                          <IconTool size={12} color="gray" />
                          {msg.tools_used.map((tool, i) => (
                            <Badge key={i} size="xs" variant="dot" color="violet">
                              {tool}
                            </Badge>
                          ))}
                        </Group>
                      )}
                    </Box>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
