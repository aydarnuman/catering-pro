'use client';

import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  Badge,
  Button,
  Paper,
  ActionIcon,
  Alert,
  SimpleGrid,
  ThemeIcon
} from '@mantine/core';
import {
  IconUsers,
  IconArrowLeft,
  IconUserPlus,
  IconShield,
  IconKey,
  IconAlertCircle
} from '@tabler/icons-react';

export default function KullanicilarPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="subtle" size="lg" component="a" href="/admin">
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={1} size="h2" mb={4}>👥 Kullanıcı Yönetimi</Title>
              <Text c="dimmed">Kullanıcılar, roller ve izinler</Text>
            </div>
          </Group>
          <Badge size="lg" variant="light" color="red">Admin</Badge>
        </Group>

        {/* Yakında Alert */}
        <Alert 
          icon={<IconAlertCircle size={18} />} 
          title="Geliştirme Aşamasında" 
          color="blue"
        >
          Kullanıcı yönetimi modülü yakında aktif olacak. Şu anda kullanıcılar veritabanı üzerinden yönetilmektedir.
        </Alert>

        {/* Planlanan Özellikler */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={3} mb="md">📋 Planlanan Özellikler</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            <Card padding="lg" radius="md" withBorder>
              <Group mb="md">
                <ThemeIcon size={40} radius="md" variant="light" color="blue">
                  <IconUserPlus size={22} />
                </ThemeIcon>
              </Group>
              <Text fw={500} mb={4}>Kullanıcı Ekleme</Text>
              <Text size="sm" c="dimmed">
                Yeni kullanıcı davet etme ve kayıt işlemleri
              </Text>
            </Card>

            <Card padding="lg" radius="md" withBorder>
              <Group mb="md">
                <ThemeIcon size={40} radius="md" variant="light" color="violet">
                  <IconShield size={22} />
                </ThemeIcon>
              </Group>
              <Text fw={500} mb={4}>Rol Yönetimi</Text>
              <Text size="sm" c="dimmed">
                Admin, Editor, Viewer rolleri tanımlama
              </Text>
            </Card>

            <Card padding="lg" radius="md" withBorder>
              <Group mb="md">
                <ThemeIcon size={40} radius="md" variant="light" color="orange">
                  <IconKey size={22} />
                </ThemeIcon>
              </Group>
              <Text fw={500} mb={4}>İzin Yönetimi</Text>
              <Text size="sm" c="dimmed">
                Modül bazlı erişim kontrolü
              </Text>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* Mevcut Durum */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={3} mb="md">📊 Mevcut Durum</Title>
          <Stack gap="sm">
            <Group>
              <Badge color="green">Aktif</Badge>
              <Text size="sm">JWT tabanlı kimlik doğrulama</Text>
            </Group>
            <Group>
              <Badge color="green">Aktif</Badge>
              <Text size="sm">Şifre hashleme (bcrypt)</Text>
            </Group>
            <Group>
              <Badge color="yellow">Kısmi</Badge>
              <Text size="sm">Rol bazlı erişim (admin/user)</Text>
            </Group>
            <Group>
              <Badge color="gray">Beklemede</Badge>
              <Text size="sm">Kullanıcı arayüz yönetimi</Text>
            </Group>
          </Stack>
        </Paper>

        {/* Geçici Çözüm */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={3} mb="md">🛠️ Geçici Çözüm</Title>
          <Text size="sm" c="dimmed" mb="md">
            Şu an kullanıcı eklemek için API endpoint kullanabilirsiniz:
          </Text>
          <code style={{ 
            display: 'block', 
            padding: '12px', 
            background: 'var(--mantine-color-dark-7)', 
            borderRadius: '8px',
            fontSize: '13px'
          }}>
            POST /api/auth/register<br/>
            {`{ "email": "user@example.com", "password": "...", "name": "Ad Soyad", "role": "user" }`}
          </code>
        </Paper>
      </Stack>
    </Container>
  );
}
