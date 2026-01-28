'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  CopyButton,
  Group,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconCheck,
  IconCopy,
  IconDotsVertical,
  IconExternalLink,
  IconHeart,
  IconHeartFilled,
  IconHome,
  IconPlus,
  IconSearch,
  IconShare,
  IconSparkles,
  IconTrash,
  IconWand,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import type { PBSavedPrompt } from '@/components/PromptBuilder/types';
import {
  useDeleteSavedPrompt,
  useSavedPrompts,
  useUpdateSavedPrompt,
  useUserStats,
} from '@/hooks/usePromptBuilder';

export default function SavedPromptsPage() {
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [selectedPrompt, setSelectedPrompt] = useState<PBSavedPrompt | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  // Queries
  const { data: prompts, isLoading } = useSavedPrompts({
    favoriteOnly: filter === 'favorites',
  });
  const { data: stats } = useUserStats();

  // Mutations
  const updateMutation = useUpdateSavedPrompt();
  const deleteMutation = useDeleteSavedPrompt();

  // Handlers
  const handleToggleFavorite = async (prompt: PBSavedPrompt) => {
    try {
      await updateMutation.mutateAsync({
        id: prompt.id,
        isFavorite: !prompt.is_favorite,
      });
      notifications.show({
        title: prompt.is_favorite ? 'Favorilerden çıkarıldı' : 'Favorilere eklendi',
        message: '',
        color: prompt.is_favorite ? 'gray' : 'pink',
      });
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'İşlem başarısız',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bu prompt silinecek. Emin misiniz?')) return;

    try {
      await deleteMutation.mutateAsync(id);
      notifications.show({
        title: 'Silindi',
        message: 'Prompt başarıyla silindi',
        color: 'green',
      });
    } catch (_error) {
      notifications.show({
        title: 'Hata',
        message: 'Silme başarısız',
        color: 'red',
      });
    }
  };

  const handleViewDetail = (prompt: PBSavedPrompt) => {
    setSelectedPrompt(prompt);
    openDetail();
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Breadcrumbs */}
        <Breadcrumbs>
          <Link href="/admin" style={{ textDecoration: 'none' }}>
            <Group gap={4}>
              <IconHome size={14} />
              <Text size="sm" c="dimmed">
                Admin
              </Text>
            </Group>
          </Link>
          <Link href="/admin/prompt-builder" style={{ textDecoration: 'none' }}>
            <Text size="sm" c="dimmed">
              Prompt Builder
            </Text>
          </Link>
          <Text size="sm">Kayıtlı Prompt&apos;larım</Text>
        </Breadcrumbs>

        {/* Header */}
        <Paper p="xl" radius="lg" withBorder>
          <Group justify="space-between">
            <Group gap="md">
              <ThemeIcon
                size={60}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'green', to: 'teal' }}
              >
                <IconBookmark size={32} />
              </ThemeIcon>
              <div>
                <Title order={2}>Kayıtlı Prompt&apos;larım</Title>
                <Text c="dimmed" size="sm">
                  Oluşturduğunuz ve kaydettiğiniz prompt&apos;lar
                </Text>
              </div>
            </Group>

            <Button
              variant="gradient"
              gradient={{ from: 'violet', to: 'grape' }}
              leftSection={<IconPlus size={16} />}
              component={Link}
              href="/admin/prompt-builder"
            >
              Yeni Prompt
            </Button>
          </Group>
        </Paper>

        {/* Stats */}
        {stats && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Card p="md" radius="md" withBorder>
              <Group gap="xs">
                <ThemeIcon variant="light" color="blue" size="lg">
                  <IconSparkles size={18} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>
                    {stats.total_prompts}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Toplam Prompt
                  </Text>
                </div>
              </Group>
            </Card>
            <Card p="md" radius="md" withBorder>
              <Group gap="xs">
                <ThemeIcon variant="light" color="pink" size="lg">
                  <IconHeart size={18} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>
                    {stats.favorite_count}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Favori
                  </Text>
                </div>
              </Group>
            </Card>
            <Card p="md" radius="md" withBorder>
              <Group gap="xs">
                <ThemeIcon variant="light" color="green" size="lg">
                  <IconShare size={18} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>
                    {stats.shared_count}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Paylaşılan
                  </Text>
                </div>
              </Group>
            </Card>
            <Card p="md" radius="md" withBorder>
              <Group gap="xs">
                <ThemeIcon variant="light" color="orange" size="lg">
                  <IconExternalLink size={18} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>
                    {stats.total_usage}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Kullanım
                  </Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        )}

        {/* Filter */}
        <Group justify="space-between">
          <SegmentedControl
            value={filter}
            onChange={(v) => setFilter(v as 'all' | 'favorites')}
            data={[
              { label: 'Tümü', value: 'all' },
              { label: '⭐ Favoriler', value: 'favorites' },
            ]}
          />
          <Text size="sm" c="dimmed">
            {prompts?.length || 0} prompt
          </Text>
        </Group>

        {/* Prompts List */}
        {isLoading ? (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} height={180} radius="md" />
            ))}
          </SimpleGrid>
        ) : prompts?.length === 0 ? (
          <Card p="xl" radius="lg" withBorder ta="center">
            <Stack align="center" gap="md">
              <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                <IconSearch size={30} />
              </ThemeIcon>
              <Text c="dimmed">
                {filter === 'favorites'
                  ? 'Henüz favori prompt yok'
                  : 'Henüz kaydedilmiş prompt yok'}
              </Text>
              <Button
                variant="light"
                component={Link}
                href="/admin/prompt-builder"
                leftSection={<IconWand size={16} />}
              >
                İlk Prompt&apos;unu Oluştur
              </Button>
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {prompts?.map((prompt) => (
              <Card
                key={prompt.id}
                p="lg"
                radius="md"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => handleViewDetail(prompt)}
              >
                <Stack gap="sm" h="100%">
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Text size="lg">{prompt.category_icon || '📄'}</Text>
                      <Badge size="sm" color={prompt.category_color || 'gray'} variant="light">
                        {prompt.category_name || 'Genel'}
                      </Badge>
                    </Group>
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        color={prompt.is_favorite ? 'pink' : 'gray'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(prompt);
                        }}
                      >
                        {prompt.is_favorite ? (
                          <IconHeartFilled size={16} />
                        ) : (
                          <IconHeart size={16} />
                        )}
                      </ActionIcon>
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <CopyButton value={prompt.generated_prompt}>
                            {({ copy }) => (
                              <Menu.Item
                                leftSection={<IconCopy size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copy();
                                  notifications.show({
                                    title: 'Kopyalandı',
                                    message: '',
                                    color: 'green',
                                  });
                                }}
                              >
                                Kopyala
                              </Menu.Item>
                            )}
                          </CopyButton>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(prompt.id);
                            }}
                          >
                            Sil
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>

                  <Box style={{ flex: 1 }}>
                    <Text fw={600} lineClamp={1} mb={4}>
                      {prompt.name}
                    </Text>
                    {prompt.description && (
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {prompt.description}
                      </Text>
                    )}
                  </Box>

                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      {new Date(prompt.created_at).toLocaleDateString('tr-TR')}
                    </Text>
                    {prompt.usage_count > 0 && (
                      <Badge size="xs" variant="outline" color="gray">
                        {prompt.usage_count}x kullanıldı
                      </Badge>
                    )}
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>

      {/* Detail Modal */}
      <Modal
        opened={detailOpened}
        onClose={closeDetail}
        title={
          <Group gap="sm">
            <Text size="lg">{selectedPrompt?.category_icon || '📄'}</Text>
            <Text fw={600}>{selectedPrompt?.name}</Text>
          </Group>
        }
        size="lg"
        radius="lg"
      >
        {selectedPrompt && (
          <Stack gap="md">
            <Group gap="xs">
              <Badge color={selectedPrompt.category_color || 'gray'}>
                {selectedPrompt.category_name || 'Genel'}
              </Badge>
              {selectedPrompt.template_name && (
                <Badge variant="outline" color="gray">
                  {selectedPrompt.template_name}
                </Badge>
              )}
              {selectedPrompt.is_public && (
                <Badge color="green" variant="light">
                  Herkese Açık
                </Badge>
              )}
            </Group>

            {selectedPrompt.description && (
              <Text size="sm" c="dimmed">
                {selectedPrompt.description}
              </Text>
            )}

            <Card p={0} radius="md" withBorder>
              <Box
                p="sm"
                style={{
                  borderBottom: '1px solid var(--mantine-color-gray-3)',
                  background: 'var(--mantine-color-gray-0)',
                }}
              >
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    Prompt
                  </Text>
                  <CopyButton value={selectedPrompt.generated_prompt}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                        <ActionIcon
                          variant={copied ? 'filled' : 'subtle'}
                          color={copied ? 'green' : 'gray'}
                          onClick={copy}
                        >
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
              </Box>
              <ScrollArea h={300} p="md">
                <Text
                  size="sm"
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    lineHeight: 1.6,
                  }}
                >
                  {selectedPrompt.generated_prompt}
                </Text>
              </ScrollArea>
            </Card>

            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Oluşturulma: {new Date(selectedPrompt.created_at).toLocaleString('tr-TR')}
              </Text>
              <Text size="xs" c="dimmed">
                {selectedPrompt.generated_prompt.length} karakter
              </Text>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
