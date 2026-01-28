'use client';

import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  CopyButton,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  Transition,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCopy,
  IconPlus,
  IconSend,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PromptBuilderModal } from '@/components/PromptBuilder/PromptBuilderModal';
import { api } from '@/lib/api';

interface SavedPrompt {
  id: number;
  name: string;
  generated_prompt: string;
  style: string;
  created_at: string;
  usage_count: number;
}

export default function PromptBuilderPage() {
  const router = useRouter();
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadSavedPrompts = useCallback(async () => {
    try {
      const res = await api.get('/api/prompt-builder/saved');
      if (res.data.success) setSavedPrompts(res.data.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedPrompts();
  }, [loadSavedPrompts]);

  const handleDelete = useCallback(async (id: number) => {
    setDeletingId(id);
    try {
      const res = await api.delete(`/api/prompt-builder/saved/${id}`);
      if (res.data.success) {
        setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
        notifications.show({ message: 'Silindi', color: 'green' });
      }
    } catch {
      notifications.show({ message: 'Hata', color: 'red' });
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleUseInChat = (prompt: string, targetModule?: string) => {
    sessionStorage.setItem('ai_prefill_prompt', prompt);
    if (targetModule) {
      sessionStorage.setItem('ai_target_module', targetModule);
    }
    router.push('/ai-chat');
  };

  return (
    <Box
      style={{
        minHeight: 'calc(100vh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: savedPrompts.length > 0 ? 'flex-start' : 'center',
        padding: '2rem',
      }}
    >
      {/* Main CTA */}
      <Box ta="center" mb={savedPrompts.length > 0 ? 'xl' : 0}>
        <ThemeIcon
          size={80}
          radius="xl"
          variant="gradient"
          gradient={{ from: 'violet', to: 'grape' }}
          mb="md"
          style={{ cursor: 'pointer' }}
          onClick={openModal}
        >
          <IconSparkles size={40} />
        </ThemeIcon>

        <Text size="xl" fw={600} mb={4}>
          AI Prompt Builder
        </Text>
        <Text size="sm" c="dimmed" mb="lg" maw={300} mx="auto">
          AI sorularla sizi yönlendirerek mükemmel promptlar oluşturur
        </Text>

        <Button
          size="lg"
          variant="gradient"
          gradient={{ from: 'violet', to: 'grape' }}
          leftSection={<IconPlus size={20} />}
          onClick={openModal}
          radius="xl"
        >
          Yeni Prompt Oluştur
        </Button>
      </Box>

      {/* Saved Prompts */}
      {isLoading ? (
        <Center py="xl">
          <Loader color="violet" size="sm" />
        </Center>
      ) : savedPrompts.length > 0 ? (
        <Box w="100%" maw={600} mt="xl">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm" ta="center">
            Kayıtlı Promptlar ({savedPrompts.length})
          </Text>

          <Stack gap="xs">
            {savedPrompts.map((prompt, index) => (
              <Transition
                key={prompt.id}
                mounted
                transition="slide-up"
                duration={200}
                timingFunction="ease"
              >
                {(styles) => (
                  <Card
                    style={{ ...styles, transitionDelay: `${index * 50}ms` }}
                    padding="sm"
                    radius="md"
                    withBorder
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={500} lineClamp={1}>
                          {prompt.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {prompt.usage_count || 0}x kullanıldı
                        </Text>
                      </Box>

                      <Group gap={4}>
                        <CopyButton value={prompt.generated_prompt || ''}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                              <ActionIcon
                                variant="subtle"
                                color={copied ? 'green' : 'gray'}
                                size="sm"
                                onClick={copy}
                              >
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                        <Tooltip label="AI'a Gönder">
                          <ActionIcon
                            variant="subtle"
                            color="violet"
                            size="sm"
                            onClick={() => handleUseInChat(prompt.generated_prompt)}
                          >
                            <IconSend size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Sil">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => handleDelete(prompt.id)}
                            loading={deletingId === prompt.id}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Card>
                )}
              </Transition>
            ))}
          </Stack>
        </Box>
      ) : null}

      {/* Modal */}
      <PromptBuilderModal
        opened={modalOpened}
        onClose={closeModal}
        onSaved={loadSavedPrompts}
        onUseInChat={handleUseInChat}
      />
    </Box>
  );
}
