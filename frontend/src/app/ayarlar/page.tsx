'use client';

import { useState, useEffect } from 'react';
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
  Paper,
  ActionIcon,
  Avatar,
  Skeleton
} from '@mantine/core';
import {
  IconRobot,
  IconUser,
  IconBell,
  IconPalette,
  IconSettings2,
  IconChevronRight,
  IconMail,
  IconCalendar
} from '@tabler/icons-react';

interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function AyarlarPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('Kullanıcı bilgisi alınamadı');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const settingsCards = [
    {
      id: 'profil',
      title: '👤 Profil',
      description: 'Hesap bilgileri ve şifre değişikliği',
      icon: IconUser,
      color: 'blue',
      path: '/ayarlar/profil',
      badge: 'Yakında'
    },
    {
      id: 'ai',
      title: '🤖 AI Ayarları',
      description: 'Yapay zeka ayarları ve prompt şablonları',
      icon: IconRobot,
      color: 'violet',
      path: '/ayarlar/ai',
      badge: null
    },
    {
      id: 'bildirimler',
      title: '🔔 Bildirimler',
      description: 'Email ve sistem bildirimleri',
      icon: IconBell,
      color: 'orange',
      path: '/ayarlar/bildirimler',
      badge: 'Yakında'
    },
    {
      id: 'gorunum',
      title: '🎨 Görünüm',
      description: 'Tema ve arayüz tercihleri',
      icon: IconPalette,
      color: 'pink',
      path: '/ayarlar/gorunum',
      badge: 'Yakında'
    }
  ];

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={1} size="h2" mb={4}>⚙️ Ayarlar</Title>
            <Text c="dimmed" size="lg">Kişisel tercihler ve hesap ayarları</Text>
          </div>
          <Badge size="lg" variant="light" color="blue">v1.0.0</Badge>
        </Group>

        {/* Kullanıcı Kartı */}
        <Paper p="lg" radius="md" withBorder>
          <Group>
            {loading ? (
              <>
                <Skeleton circle height={60} />
                <div>
                  <Skeleton height={20} width={150} mb={8} />
                  <Skeleton height={14} width={200} />
                </div>
              </>
            ) : user ? (
              <>
                <Avatar 
                  size={60} 
                  radius="xl" 
                  color="blue"
                  variant="filled"
                >
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <Group justify="space-between">
                    <div>
                      <Text fw={600} size="lg">{user.name}</Text>
                      <Group gap="xs" mt={4}>
                        <IconMail size={14} color="var(--mantine-color-dimmed)" />
                        <Text size="sm" c="dimmed">{user.email}</Text>
                      </Group>
                    </div>
                    <Stack gap={4} align="flex-end">
                      <Badge 
                        color={user.role === 'admin' ? 'red' : 'blue'} 
                        variant="light"
                      >
                        {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                      </Badge>
                      {user.created_at && (
                        <Group gap={4}>
                          <IconCalendar size={12} color="var(--mantine-color-dimmed)" />
                          <Text size="xs" c="dimmed">
                            {new Date(user.created_at).toLocaleDateString('tr-TR')}
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  </Group>
                </div>
              </>
            ) : (
              <Group>
                <Avatar size={60} radius="xl" color="gray">?</Avatar>
                <div>
                  <Text fw={500}>Giriş yapılmamış</Text>
                  <Text size="sm" c="dimmed">Ayarları görmek için giriş yapın</Text>
                </div>
              </Group>
            )}
          </Group>
        </Paper>

        {/* Ayar Kartları */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          {settingsCards.map((card) => (
            <Card 
              key={card.id} 
              padding="xl" 
              radius="md" 
              withBorder
              style={{ cursor: card.badge ? 'default' : 'pointer' }}
            >
              <Stack gap="md">
                <Group justify="space-between">
                  <ThemeIcon size={50} radius="md" variant="light" color={card.color}>
                    <card.icon size={28} />
                  </ThemeIcon>
                  {card.badge ? (
                    <Badge color="gray" variant="light">{card.badge}</Badge>
                  ) : (
                    <ActionIcon variant="subtle" color="gray">
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  )}
                </Group>

                <div>
                  <Title order={3} size="h4" mb={4}>{card.title}</Title>
                  <Text c="dimmed" size="sm">{card.description}</Text>
                </div>

                <Button
                  variant="light"
                  color={card.color}
                  fullWidth
                  leftSection={<IconSettings2 size={16} />}
                  component="a"
                  href={card.path}
                  disabled={!!card.badge}
                >
                  {card.badge ? 'Yakında' : 'Ayarları Aç'}
                </Button>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        {/* Admin Panel Yönlendirme */}
        <Paper p="lg" radius="md" withBorder style={{ background: 'var(--mantine-color-dark-6)' }}>
          <Group justify="space-between">
            <div>
              <Text fw={500} mb={4}>🔒 Sistem Yönetimi</Text>
              <Text size="sm" c="dimmed">
                Kullanıcı yönetimi, veri senkronizasyonu ve sistem ayarları için Admin Panel'e gidin.
              </Text>
            </div>
            <Button
              variant="light"
              color="red"
              component="a"
              href="/admin"
              rightSection={<IconChevronRight size={16} />}
            >
              Admin Panel
            </Button>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
}
