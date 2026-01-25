'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  CopyButton,
  Grid,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBookmark,
  IconCheck,
  IconCopy,
  IconDownload,
  IconRefresh,
  IconRobot,
  IconSend,
  IconSparkles,
} from '@tabler/icons-react';
import { useState } from 'react';

interface PromptOutputProps {
  prompt: string;
  templateName?: string;
  categoryName?: string;
  categoryColor?: string;
  onBack: () => void;
  onReset: () => void;
  onSave: () => void;
  onUseInChat?: () => void;
  isSaving?: boolean;
}

export function PromptOutput({
  prompt,
  templateName,
  categoryName,
  categoryColor = 'violet',
  onBack,
  onReset,
  onSave,
  onUseInChat,
  isSaving,
}: PromptOutputProps) {
  const [showConfetti] = useState(true);

  const handleCopy = () => {
    notifications.show({
      title: 'Kopyalandı!',
      message: 'Prompt panoya kopyalandı',
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  const handleDownload = () => {
    const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    notifications.show({
      title: 'İndirildi!',
      message: 'Prompt dosya olarak indirildi',
      color: 'blue',
      icon: <IconDownload size={16} />,
    });
  };

  return (
    <Grid gutter="xl">
      {/* Sol Panel: Prompt İçeriği */}
      <Grid.Col span={{ base: 12, lg: 8 }}>
        <Stack gap="lg">
          {/* Success Header */}
          <Paper
            p="xl"
            radius="xl"
            style={{
              background: `linear-gradient(135deg, var(--mantine-color-${categoryColor}-9) 0%, var(--mantine-color-green-9) 100%)`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background sparkles */}
            <Box
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                opacity: 0.1,
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-rule='evenodd'%3E%3Ccircle cx='5' cy='5' r='2'/%3E%3Ccircle cx='35' cy='25' r='1.5'/%3E%3Ccircle cx='55' cy='45' r='2'/%3E%3Ccircle cx='15' cy='55' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />

            <Group justify="space-between" style={{ position: 'relative' }}>
              <Group gap="md">
                <ThemeIcon
                  size={60}
                  radius="xl"
                  variant="white"
                  color={categoryColor}
                  style={{
                    animation: showConfetti ? 'pulse 2s infinite' : 'none',
                  }}
                >
                  <IconSparkles size={32} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700} c="white">
                    ✨ Prompt Hazır!
                  </Text>
                  <Group gap="xs" mt={4}>
                    {categoryName && (
                      <Badge
                        variant="white"
                        color="dark"
                        style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
                      >
                        {categoryName}
                      </Badge>
                    )}
                    {templateName && (
                      <Badge variant="outline" color="white">
                        {templateName}
                      </Badge>
                    )}
                  </Group>
                </div>
              </Group>

              <Group>
                <Text size="sm" c="white" style={{ opacity: 0.8 }}>
                  {prompt.length} karakter
                </Text>
              </Group>
            </Group>

            <style jsx global>{`
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
            `}</style>
          </Paper>

          {/* Prompt Content */}
          <Card
            p={0}
            radius="xl"
            withBorder
            style={{
              overflow: 'hidden',
            }}
          >
            {/* Toolbar */}
            <Box
              p="md"
              bg="gray.1"
              style={{
                borderBottom: '1px solid var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between">
                <Group gap="xs">
                  <Box
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'var(--mantine-color-red-6)',
                    }}
                  />
                  <Box
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'var(--mantine-color-yellow-6)',
                    }}
                  />
                  <Box
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'var(--mantine-color-green-6)',
                    }}
                  />
                  <Text size="xs" c="dimmed" ml="sm">
                    prompt.txt
                  </Text>
                </Group>

                <Group gap="xs">
                  <CopyButton value={prompt}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                        <ActionIcon
                          variant={copied ? 'filled' : 'subtle'}
                          color={copied ? 'green' : 'gray'}
                          size="sm"
                          onClick={() => {
                            copy();
                            handleCopy();
                          }}
                        >
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  <Tooltip label="İndir">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={handleDownload}
                    >
                      <IconDownload size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Box>

            {/* Code Content */}
            <ScrollArea h={350} p="lg">
              <Text
                size="sm"
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  lineHeight: 1.8,
                }}
              >
                {prompt}
              </Text>
            </ScrollArea>
          </Card>
        </Stack>
      </Grid.Col>

      {/* Sağ Panel: Aksiyonlar */}
      <Grid.Col span={{ base: 12, lg: 4 }}>
        <Stack gap="lg" style={{ position: 'sticky', top: 100 }}>
          {/* Quick Actions */}
          <Card
            p="xl"
            radius="xl"
            withBorder
          >
            <Text fw={600} mb="lg">
              🚀 Hızlı Aksiyonlar
            </Text>

            <Stack gap="sm">
              <CopyButton value={prompt}>
                {({ copied, copy }) => (
                  <Button
                    fullWidth
                    size="lg"
                    variant={copied ? 'filled' : 'gradient'}
                    gradient={{ from: 'blue', to: 'cyan' }}
                    color={copied ? 'green' : undefined}
                    leftSection={copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                    onClick={() => {
                      copy();
                      handleCopy();
                    }}
                  >
                    {copied ? 'Kopyalandı!' : 'Panoya Kopyala'}
                  </Button>
                )}
              </CopyButton>

              <Button
                fullWidth
                size="lg"
                variant="gradient"
                gradient={{ from: 'green', to: 'teal' }}
                leftSection={<IconBookmark size={18} />}
                onClick={onSave}
                loading={isSaving}
              >
                💾 Kaydet
              </Button>

              {onUseInChat && (
                <Button
                  fullWidth
                  size="lg"
                  variant="gradient"
                  gradient={{ from: categoryColor, to: 'grape' }}
                  rightSection={<IconSend size={18} />}
                  onClick={onUseInChat}
                >
                  🤖 AI&apos;a Gönder
                </Button>
              )}
            </Stack>
          </Card>

          {/* Secondary Actions */}
          <Card
            p="lg"
            radius="xl"
            withBorder
          >
            <Stack gap="sm">
              <Button
                fullWidth
                variant="light"
                color="gray"
                leftSection={<IconArrowLeft size={16} />}
                onClick={onBack}
              >
                Düzenle
              </Button>
              <Button
                fullWidth
                variant="subtle"
                color="gray"
                leftSection={<IconRefresh size={16} />}
                onClick={onReset}
              >
                Yeni Prompt Oluştur
              </Button>
              <Button
                fullWidth
                variant="subtle"
                color="gray"
                leftSection={<IconDownload size={16} />}
                onClick={handleDownload}
              >
                Dosya Olarak İndir
              </Button>
            </Stack>
          </Card>

          {/* Pro Tip */}
          <Paper
            p="md"
            radius="lg"
            bg={`${categoryColor}.0`}
            withBorder
          >
            <Group gap="xs" wrap="nowrap">
              <Text size="xl">💡</Text>
              <div>
                <Text size="sm" fw={500}>
                  Pro İpucu
                </Text>
                <Text size="xs" c="dimmed">
                  Kaydettiğiniz prompt&apos;ları daha sonra düzenleyebilir ve 
                  tekrar kullanabilirsiniz.
                </Text>
              </div>
            </Group>
          </Paper>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
