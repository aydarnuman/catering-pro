'use client';

import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Text,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconChartBar,
  IconCheck,
  IconMessage,
  IconPhoto,
  IconPlug,
  IconPlugOff,
  IconSend,
  IconTrendingUp,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

interface ServiceStatus {
  connected: boolean;
  loading: boolean;
  stats?: {
    followers?: number;
    messages?: number;
    engagement?: number;
  };
}

export default function SosyalMedyaDashboard() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Mock service status - gerçek API'den gelecek
  const [instagramStatus, _setInstagramStatus] = useState<ServiceStatus>({
    connected: false,
    loading: false,
    stats: {
      followers: 12500,
      messages: 24,
      engagement: 4.2,
    },
  });

  const [whatsappStatus, _setWhatsappStatus] = useState<ServiceStatus>({
    connected: false,
    loading: false,
    stats: {
      messages: 48,
    },
  });

  const cardStyle = {
    background: isDark ? 'var(--surface-elevated)' : 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${isDark ? 'var(--surface-border)' : 'rgba(0,0,0,0.06)'}`,
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: isDark
          ? 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        paddingTop: 140,
        paddingBottom: 40,
      }}
    >
      <Container size="xl">
        {/* Header */}
        <Box mb="xl">
          <Group justify="space-between" align="flex-start">
            <Box>
              <Title
                order={1}
                style={{
                  background: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                📱 Sosyal Medya Yönetimi
              </Title>
              <Text c="dimmed" mt="xs">
                Instagram ve WhatsApp hesaplarınızı tek panelden yönetin
              </Text>
            </Box>
            <Badge size="lg" variant="gradient" gradient={{ from: 'pink', to: 'grape' }}>
              BETA
            </Badge>
          </Group>
        </Box>

        {/* Service Cards */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mb="xl">
          {/* Instagram Card */}
          <Paper
            p="xl"
            radius="lg"
            style={{
              ...cardStyle,
              borderLeft: '4px solid #E4405F',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Gradient overlay */}
            <Box
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 150,
                height: 150,
                background: 'linear-gradient(135deg, rgba(228, 64, 95, 0.1) 0%, transparent 100%)',
                borderRadius: '0 0 0 100%',
              }}
            />

            <Group justify="space-between" mb="lg">
              <Group>
                <ThemeIcon
                  size={56}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: '#E4405F', to: '#F77737' }}
                >
                  <IconBrandInstagram size={32} />
                </ThemeIcon>
                <Box>
                  <Text fw={700} size="xl">
                    Instagram
                  </Text>
                  <Text size="sm" c="dimmed">
                    Post, Story, Reels, DM
                  </Text>
                </Box>
              </Group>
              <Badge
                size="lg"
                color={instagramStatus.connected ? 'green' : 'gray'}
                leftSection={
                  instagramStatus.connected ? <IconCheck size={12} /> : <IconPlugOff size={12} />
                }
              >
                {instagramStatus.connected ? 'Bağlı' : 'Bağlı Değil'}
              </Badge>
            </Group>

            {instagramStatus.connected ? (
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="lg">
                <Box ta="center">
                  <Text size="2rem" fw={800} c="#E4405F">
                    {instagramStatus.stats?.followers?.toLocaleString()}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Takipçi
                  </Text>
                </Box>
                <Box ta="center">
                  <Text size="2rem" fw={800} c="blue">
                    {instagramStatus.stats?.messages}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Okunmamış DM
                  </Text>
                </Box>
                <Box ta="center">
                  <Text size="2rem" fw={800} c="green">
                    %{instagramStatus.stats?.engagement}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Etkileşim
                  </Text>
                </Box>
              </SimpleGrid>
            ) : (
              <Box
                p="xl"
                ta="center"
                style={{
                  background: isDark ? 'var(--surface-elevated-more)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12,
                  marginBottom: 16,
                }}
              >
                <IconPlug size={48} style={{ opacity: 0.3 }} />
                <Text c="dimmed" mt="md">
                  Instagram hesabınızı bağlayarak yönetmeye başlayın
                </Text>
              </Box>
            )}

            <Group>
              <Button
                component={Link}
                href="/sosyal-medya/instagram"
                variant="gradient"
                gradient={{ from: '#E4405F', to: '#F77737' }}
                leftSection={<IconBrandInstagram size={18} />}
                fullWidth
              >
                {instagramStatus.connected ? 'Yönet' : 'Bağlan'}
              </Button>
            </Group>
          </Paper>

          {/* WhatsApp Card */}
          <Paper
            p="xl"
            radius="lg"
            style={{
              ...cardStyle,
              borderLeft: '4px solid #25D366',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Gradient overlay */}
            <Box
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 150,
                height: 150,
                background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.1) 0%, transparent 100%)',
                borderRadius: '0 0 0 100%',
              }}
            />

            <Group justify="space-between" mb="lg">
              <Group>
                <ThemeIcon
                  size={56}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: '#25D366', to: '#128C7E' }}
                >
                  <IconBrandWhatsapp size={32} />
                </ThemeIcon>
                <Box>
                  <Text fw={700} size="xl">
                    WhatsApp
                  </Text>
                  <Text size="sm" c="dimmed">
                    Mesaj, Grup, Medya
                  </Text>
                </Box>
              </Group>
              <Badge
                size="lg"
                color={whatsappStatus.connected ? 'green' : 'gray'}
                leftSection={
                  whatsappStatus.connected ? <IconCheck size={12} /> : <IconPlugOff size={12} />
                }
              >
                {whatsappStatus.connected ? 'Bağlı' : 'Bağlı Değil'}
              </Badge>
            </Group>

            {whatsappStatus.connected ? (
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="lg">
                <Box ta="center">
                  <Text size="2rem" fw={800} c="#25D366">
                    {whatsappStatus.stats?.messages}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Aktif Sohbet
                  </Text>
                </Box>
                <Box ta="center">
                  <Text size="2rem" fw={800} c="blue">
                    12
                  </Text>
                  <Text size="xs" c="dimmed">
                    Okunmamış
                  </Text>
                </Box>
                <Box ta="center">
                  <Text size="2rem" fw={800} c="orange">
                    156
                  </Text>
                  <Text size="xs" c="dimmed">
                    Bugün Gönderilen
                  </Text>
                </Box>
              </SimpleGrid>
            ) : (
              <Box
                p="xl"
                ta="center"
                style={{
                  background: isDark ? 'var(--surface-elevated-more)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12,
                  marginBottom: 16,
                }}
              >
                <IconPlug size={48} style={{ opacity: 0.3 }} />
                <Text c="dimmed" mt="md">
                  QR kod ile WhatsApp&apos;ı bağlayın
                </Text>
              </Box>
            )}

            <Group>
              <Button
                component={Link}
                href="/sosyal-medya/whatsapp"
                variant="gradient"
                gradient={{ from: '#25D366', to: '#128C7E' }}
                leftSection={<IconBrandWhatsapp size={18} />}
                fullWidth
              >
                {whatsappStatus.connected ? 'Yönet' : 'QR ile Bağlan'}
              </Button>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* Quick Actions */}
        <Paper p="xl" radius="lg" style={cardStyle} mb="xl">
          <Text fw={600} size="lg" mb="md">
            ⚡ Hızlı İşlemler
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Button
              variant="light"
              color="pink"
              size="lg"
              leftSection={<IconPhoto size={20} />}
              disabled={!instagramStatus.connected}
            >
              Post Paylaş
            </Button>
            <Button
              variant="light"
              color="orange"
              size="lg"
              leftSection={<IconMessage size={20} />}
              disabled={!instagramStatus.connected}
            >
              Story Ekle
            </Button>
            <Button
              variant="light"
              color="green"
              size="lg"
              leftSection={<IconSend size={20} />}
              disabled={!whatsappStatus.connected}
            >
              Mesaj Gönder
            </Button>
            <Button variant="light" color="blue" size="lg" leftSection={<IconChartBar size={20} />}>
              Analitik
            </Button>
          </SimpleGrid>
        </Paper>

        {/* Info Box */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            ...cardStyle,
            background: isDark
              ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
          }}
        >
          <Group>
            <ThemeIcon size={48} radius="xl" variant="light" color="pink">
              <IconTrendingUp size={24} />
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text fw={600} size="lg">
                Sosyal Medya Modülü Beta Sürümünde
              </Text>
              <Text size="sm" c="dimmed">
                Bu modül aktif geliştirme aşamasındadır. Instagram ve WhatsApp entegrasyonları ayrı
                servisler üzerinden çalışır. Geri bildirimleriniz bizim için değerli!
              </Text>
            </Box>
          </Group>
        </Paper>
      </Container>
    </Box>
  );
}
