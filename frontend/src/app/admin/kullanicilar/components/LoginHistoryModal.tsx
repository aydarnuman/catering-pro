'use client';

import { Alert, Badge, Center, Group, Loader, Modal, Stack, Table, Text } from '@mantine/core';
import { IconCheck, IconClock, IconHistory, IconX } from '@tabler/icons-react';
import type { User } from '@/lib/api/services/admin';

interface LoginHistoryModalProps {
  opened: boolean;
  onClose: () => void;
  selectedUser: User | null;
  loginHistory: any[];
  loading: boolean;
}

export function LoginHistoryModal({ opened, onClose, selectedUser, loginHistory, loading }: LoginHistoryModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group>
          <IconHistory size={20} />
          <Text fw={600}>{selectedUser?.name} - Giriş Geçmişi</Text>
        </Group>
      }
      size="xl"
    >
      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : loginHistory.length === 0 ? (
        <Alert color="blue" icon={<IconHistory size={16} />}>
          Henüz giriş kaydı bulunmuyor
        </Alert>
      ) : (
        <Stack gap="md">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tarih</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th>IP Adresi</Table.Th>
                <Table.Th>User Agent</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loginHistory.map((attempt: any, index: number) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <Group gap="xs">
                      <IconClock size={14} />
                      <Text size="sm">
                        {new Date(attempt.attempted_at || attempt.created_at).toLocaleString('tr-TR')}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={attempt.success ? 'green' : 'red'}
                      variant="light"
                      leftSection={attempt.success ? <IconCheck size={12} /> : <IconX size={12} />}
                    >
                      {attempt.success ? 'Başarılı' : 'Başarısız'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {attempt.ip_address || 'N/A'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ maxWidth: 300 }} truncate>
                      {attempt.user_agent || 'N/A'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}
    </Modal>
  );
}
