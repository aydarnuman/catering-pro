'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Container,
  CopyButton,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconActivity,
  IconApi,
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconCopy,
  IconDatabase,
  IconExternalLink,
  IconFileText,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';

interface HealthStatus {
  status: string;
  timestamp: string;
  database: string;
}

export default function AdminSistemPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const data = await res.json();
      setHealth(data);
    } catch (_err) {
      setHealthError('Backend bağlantısı kurulamadı');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchLogs = async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/logs/recent`);
      const data = await res.json();
      setLogs(data.data || []);
    } catch (_err) {
      setLogsError('Loglar alınamadı');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const systemInfo = [
    { label: 'Backend URL', value: API_BASE_URL },
    { label: 'API Docs', value: `${API_BASE_URL}/api-docs` },
    { label: 'OpenAPI JSON', value: `${API_BASE_URL}/api-docs.json` },
    { label: 'Health Endpoint', value: `${API_BASE_URL}/health` },
  ];

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
              <Title order={1} size="h2" mb={4}>
                🛠️ Sistem & Geliştirici
              </Title>
              <Text c="dimmed">Sistem durumu, API dokümantasyonu ve loglar</Text>
            </div>
          </Group>
          <Badge size="lg" variant="light" color="red">
            Admin
          </Badge>
        </Group>

        {/* Durum Kartları */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Backend API</Text>
              <ActionIcon variant="subtle" onClick={fetchHealth}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
            {healthLoading ? (
              <Loader size="sm" />
            ) : healthError ? (
              <Badge color="red" size="lg" leftSection={<IconX size={14} />}>
                Bağlantı Yok
              </Badge>
            ) : (
              <Badge color="green" size="lg" leftSection={<IconCheck size={14} />}>
                Çalışıyor
              </Badge>
            )}
          </Card>

          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Veritabanı</Text>
              <ThemeIcon variant="light" color="cyan" size="sm">
                <IconDatabase size={14} />
              </ThemeIcon>
            </Group>
            {healthLoading ? (
              <Loader size="sm" />
            ) : health?.database === 'connected' ? (
              <Badge color="green" size="lg" leftSection={<IconCheck size={14} />}>
                Bağlı
              </Badge>
            ) : (
              <Badge color="red" size="lg" leftSection={<IconX size={14} />}>
                Bağlantı Yok
              </Badge>
            )}
          </Card>

          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>API Docs</Text>
              <ThemeIcon variant="light" color="violet" size="sm">
                <IconFileText size={14} />
              </ThemeIcon>
            </Group>
            <Button
              variant="light"
              size="xs"
              fullWidth
              rightSection={<IconExternalLink size={14} />}
              onClick={() => window.open(`${API_BASE_URL}/api-docs`, '_blank')}
            >
              Swagger Aç
            </Button>
          </Card>

          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Son Kontrol</Text>
              <ThemeIcon variant="light" color="gray" size="sm">
                <IconClock size={14} />
              </ThemeIcon>
            </Group>
            <Text size="sm" c="dimmed">
              {health?.timestamp ? new Date(health.timestamp).toLocaleString('tr-TR') : '-'}
            </Text>
          </Card>
        </SimpleGrid>

        {/* Sistem Bilgileri */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={3} mb="md">
            📋 Sistem Bilgileri
          </Title>
          <Table>
            <Table.Tbody>
              {systemInfo.map((item, i) => (
                <Table.Tr key={i}>
                  <Table.Td fw={500} w={150}>
                    {item.label}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Code>{item.value}</Code>
                      <CopyButton value={item.value}>
                        {({ copied, copy }) => (
                          <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={copy}
                              color={copied ? 'green' : 'gray'}
                            >
                              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </CopyButton>
                      {item.label.includes('API') && (
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => window.open(item.value, '_blank')}
                        >
                          <IconExternalLink size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Log Viewer */}
        <Paper p="lg" radius="md" withBorder id="logs">
          <Group justify="space-between" mb="md">
            <Title order={3}>🐛 Son Hata Logları</Title>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconRefresh size={14} />}
              onClick={fetchLogs}
              loading={logsLoading}
            >
              Yenile
            </Button>
          </Group>

          {logsError ? (
            <Alert color="red" title="Hata">
              {logsError}
            </Alert>
          ) : logs.length === 0 && !logsLoading ? (
            <Alert color="green" title="Harika!">
              Bugün için hata kaydı bulunmuyor.
            </Alert>
          ) : (
            <ScrollArea h={300}>
              <Code block style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                {logs.length > 0
                  ? logs.join('\n')
                  : 'Logları görmek için "Yenile" butonuna tıklayın.'}
              </Code>
            </ScrollArea>
          )}
        </Paper>

        {/* Hızlı Linkler */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={3} mb="md">
            🔗 Hızlı Linkler
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <Button
              variant="light"
              leftSection={<IconFileText size={16} />}
              rightSection={<IconExternalLink size={14} />}
              onClick={() => window.open(`${API_BASE_URL}/api-docs`, '_blank')}
            >
              Swagger UI
            </Button>
            <Button
              variant="light"
              color="cyan"
              leftSection={<IconApi size={16} />}
              rightSection={<IconExternalLink size={14} />}
              onClick={() => window.open(`${API_BASE_URL}/api-docs.json`, '_blank')}
            >
              OpenAPI JSON
            </Button>
            <Button
              variant="light"
              color="green"
              leftSection={<IconActivity size={16} />}
              rightSection={<IconExternalLink size={14} />}
              onClick={() => window.open(`${API_BASE_URL}/health`, '_blank')}
            >
              Health Check
            </Button>
            <Button
              variant="light"
              color="orange"
              leftSection={<IconDatabase size={16} />}
              rightSection={<IconExternalLink size={14} />}
              onClick={() => window.open(`${API_BASE_URL}/stats`, '_blank')}
            >
              API Stats
            </Button>
          </SimpleGrid>
        </Paper>
      </Stack>
    </Container>
  );
}
