'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  SimpleGrid,
  ThemeIcon,
  Badge,
  Button,
  Tabs,
  Paper,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import {
  IconSettings,
  IconRobot,
  IconDatabase,
  IconUsers,
  IconShield,
  IconBell,
  IconPalette,
  IconLanguage,
  IconSettings2,
  IconChevronRight,
  IconCloudDownload
} from '@tabler/icons-react';

export default function AyarlarPage() {
  const [activeTab, setActiveTab] = useState('genel');

  const settingsCards = [
    {
      id: 'ai',
      title: '🤖 AI Asistan',
      description: 'Yapay zeka ayarları ve prompt şablonları',
      icon: IconRobot,
      color: 'violet',
      path: '/ayarlar/ai'
    },
    {
      id: 'data',
      title: '📊 Veri Yönetimi Merkezi',
      description: 'Otomatik güncelleme, senkronizasyon ve yedekleme işlemleri',
      icon: IconDatabase,
      color: 'cyan',
      path: '/admin/sync'
    },
    {
      id: 'users',
      title: '👥 Kullanıcı Yönetimi',
      description: 'Kullanıcı rolleri ve izinleri',
      icon: IconUsers,
      color: 'blue',
      path: '/ayarlar/kullanicilar'
    },
    {
      id: 'security',
      title: '🔒 Güvenlik',
      description: 'Güvenlik politikaları ve erişim kontrolü',
      icon: IconShield,
      color: 'red',
      path: '/ayarlar/guvenlik'
    },
    {
      id: 'notifications',
      title: '🔔 Bildirimler',
      description: 'Email ve sistem bildirimleri',
      icon: IconBell,
      color: 'orange',
      path: '/ayarlar/bildirimler'
    },
    {
      id: 'appearance',
      title: '🎨 Görünüm',
      description: 'Tema ve arayüz özelleştirmeleri',
      icon: IconPalette,
      color: 'pink',
      path: '/ayarlar/gorunum'
    }
  ];

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between">
          <div>
            <Title order={1} size="h2" mb={4}>⚙️ Sistem Ayarları</Title>
            <Text c="dimmed" size="lg">
              Sistem geneli ayarları ve yapılandırmaları
            </Text>
          </div>
          <Badge size="lg" variant="light" color="blue">
            v1.0.0
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {settingsCards.map((card) => (
            <Card key={card.id} padding="xl" radius="md" withBorder hover>
              <Stack gap="md">
                <Group justify="space-between">
                  <ThemeIcon
                    size={50}
                    radius="md"
                    variant="light"
                    color={card.color}
                  >
                    <card.icon size={28} />
                  </ThemeIcon>
                  <ActionIcon variant="subtle" color="gray">
                    <IconChevronRight size={16} />
                  </ActionIcon>
                </Group>

                <div>
                  <Title order={3} size="h4" mb={4}>
                    {card.title}
                  </Title>
                  <Text c="dimmed" size="sm">
                    {card.description}
                  </Text>
                </div>

                <Button
                  variant="light"
                  color={card.color}
                  fullWidth
                  leftSection={<IconSettings2 size={16} />}
                  component="a"
                  href={card.path}
                >
                  Ayarları Aç
                </Button>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        {/* Hızlı Ayarlar */}
        <Paper p="xl" radius="md" withBorder>
          <Title order={3} mb="md">⚡ Hızlı Ayarlar</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <Button variant="light" color="violet" leftSection={<IconRobot size={16} />}>
              AI Asistanı Aç
            </Button>
            <Button variant="light" color="blue" leftSection={<IconUsers size={16} />}>
              Kullanıcı Ekle
            </Button>
            <Button variant="light" color="green" leftSection={<IconDatabase size={16} />}>
              Yedek Al
            </Button>
            <Button variant="light" color="orange" leftSection={<IconBell size={16} />}>
              Bildirim Ayarları
            </Button>
          </SimpleGrid>
        </Paper>
      </Stack>
    </Container>
  );
}
