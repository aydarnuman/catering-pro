'use client';

import { Card, Group, SimpleGrid, Text, ThemeIcon } from '@mantine/core';
import { IconCheck, IconShield, IconUsers, IconX } from '@tabler/icons-react';
import type { User } from '@/lib/api/services/admin';

interface UserStatsCardsProps {
  users: User[];
}

export function UserStatsCards({ users }: UserStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
      <Card padding="lg" radius="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text size="xl" fw={700}>
              {users.length}
            </Text>
            <Text size="sm" c="dimmed">
              Toplam Kullanıcı
            </Text>
          </div>
          <ThemeIcon size={40} radius="md" variant="light" color="blue">
            <IconUsers size={22} />
          </ThemeIcon>
        </Group>
      </Card>
      <Card padding="lg" radius="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text size="xl" fw={700}>
              {users.filter((u) => u.role === 'admin').length}
            </Text>
            <Text size="sm" c="dimmed">
              Admin
            </Text>
          </div>
          <ThemeIcon size={40} radius="md" variant="light" color="red">
            <IconShield size={22} />
          </ThemeIcon>
        </Group>
      </Card>
      <Card padding="lg" radius="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text size="xl" fw={700}>
              {users.filter((u) => u.is_active).length}
            </Text>
            <Text size="sm" c="dimmed">
              Aktif
            </Text>
          </div>
          <ThemeIcon size={40} radius="md" variant="light" color="green">
            <IconCheck size={22} />
          </ThemeIcon>
        </Group>
      </Card>
      <Card padding="lg" radius="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text size="xl" fw={700}>
              {users.filter((u) => !u.is_active).length}
            </Text>
            <Text size="sm" c="dimmed">
              Pasif
            </Text>
          </div>
          <ThemeIcon size={40} radius="md" variant="light" color="gray">
            <IconX size={22} />
          </ThemeIcon>
        </Group>
      </Card>
    </SimpleGrid>
  );
}
