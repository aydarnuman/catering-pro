'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBrain,
  IconCode,
  IconDatabase,
  IconFile,
  IconFlame,
  IconKey,
  IconMessageCircle,
  IconServer,
  IconShieldLock,
  IconTerminal2,
  IconWorld,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AIChat } from '@/components/AIChat';
import { GodModeTerminal } from '@/components/GodModeTerminal';
import { API_BASE_URL } from '@/lib/config';

interface GodModeTool {
  name: string;
  description: string;
  isGodMode: boolean;
}

export default function GodModePage() {
  const router = useRouter();
  const { isSuperAdmin, isLoading: authLoading, token } = useAuth();
  const [tools, setTools] = useState<GodModeTool[]>([]);
  const [loading, setLoading] = useState(true);

  // Erişim kontrolü
  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push('/admin');
    }
  }, [authLoading, isSuperAdmin, router]);

  // Tool listesini al
  useEffect(() => {
    const fetchTools = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/ai/god-mode/tools`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setTools(data.allTools || []);
        }
      } catch (error) {
        console.error('Tool listesi alınamadı:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isSuperAdmin) {
      fetchTools();
    }
  }, [isSuperAdmin, token]);

  if (authLoading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" gap="md" py={100}>
          <Loader size="lg" color="red" />
          <Text c="dimmed">Yetki kontrol ediliyor...</Text>
        </Stack>
      </Container>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" gap="md" py={100}>
          <ThemeIcon size={80} color="red" variant="light">
            <IconShieldLock size={40} />
          </ThemeIcon>
          <Title order={2}>Erişim Reddedildi</Title>
          <Text c="dimmed">Bu sayfaya sadece Super Admin erişebilir.</Text>
          <Button component={Link} href="/admin" leftSection={<IconArrowLeft size={16} />}>
            Admin Panele Dön
          </Button>
        </Stack>
      </Container>
    );
  }

  const godModeTools = tools.filter((t) => t.isGodMode);

  const toolCategories = [
    {
      title: 'Kod & Çalıştırma',
      icon: IconCode,
      color: 'red',
      tools: ['god_code_execute', 'god_shell_execute'],
    },
    {
      title: 'Veritabanı',
      icon: IconDatabase,
      color: 'blue',
      tools: ['god_sql_execute'],
    },
    {
      title: 'Dosya Sistemi',
      icon: IconFile,
      color: 'green',
      tools: ['god_file_read', 'god_file_write', 'god_file_list'],
    },
    {
      title: 'Secret & API',
      icon: IconKey,
      color: 'orange',
      tools: ['god_list_secrets', 'god_get_secret', 'god_add_secret', 'god_delete_secret', 'god_read_env'],
    },
    {
      title: 'Harici Servisler',
      icon: IconWorld,
      color: 'violet',
      tools: ['god_http_request', 'god_github_api', 'god_supabase_storage'],
    },
    {
      title: 'Dinamik Tool',
      icon: IconBrain,
      color: 'grape',
      tools: ['god_create_tool'],
    },
  ];

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Paper
          p="xl"
          radius="md"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 71, 87, 0.15) 0%, rgba(238, 90, 36, 0.15) 100%)',
            border: '2px solid rgba(255, 71, 87, 0.3)',
          }}
        >
          <Group justify="space-between">
            <Group gap="lg">
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconArrowLeft size={16} />}
                component={Link}
                href="/admin"
              >
                Geri
              </Button>
              <ThemeIcon
                size={60}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'red', to: 'orange' }}
                style={{ boxShadow: '0 0 40px rgba(255, 71, 87, 0.5)' }}
              >
                <IconFlame size={32} />
              </ThemeIcon>
              <div>
                <Title order={1} style={{ color: '#ff4757' }}>
                  🔥 GOD MODE AI
                </Title>
                <Text c="dimmed">Sınırsız yetki ile AI Agent - Her şeyi yapabilir</Text>
              </div>
            </Group>
            <Stack gap={4} align="flex-end">
              <Badge size="xl" variant="gradient" gradient={{ from: 'red', to: 'orange' }}>
                SUPER ADMIN
              </Badge>
              <Text size="xs" c="dimmed">
                {godModeTools.length} God Mode Tool Aktif
              </Text>
            </Stack>
          </Group>
        </Paper>

        {/* Tool Kategorileri */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
          {toolCategories.map((cat) => (
            <Card key={cat.title} padding="md" radius="md" withBorder>
              <Stack gap="xs" align="center">
                <ThemeIcon size="lg" color={cat.color} variant="light">
                  <cat.icon size={20} />
                </ThemeIcon>
                <Text size="xs" fw={600} ta="center">
                  {cat.title}
                </Text>
                <Badge size="xs" color={cat.color} variant="light">
                  {cat.tools.length} tool
                </Badge>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        {/* Uyarı */}
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{ borderColor: 'var(--mantine-color-yellow-5)', backgroundColor: 'rgba(255, 193, 7, 0.1)' }}
        >
          <Group gap="sm">
            <ThemeIcon color="yellow" variant="light">
              <IconShieldLock size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600} size="sm">
                ⚠️ DİKKAT: God Mode Aktif
              </Text>
              <Text size="xs" c="dimmed">
                Bu modda AI, veritabanı sorguları, dosya işlemleri ve shell komutları çalıştırabilir. Tüm
                işlemler loglanır.
              </Text>
            </div>
          </Group>
        </Paper>

        {/* Tabs: AI Chat & Terminal */}
        <Paper p="md" radius="md" withBorder>
          <Tabs defaultValue="ai-chat" variant="pills" radius="md">
            <Tabs.List mb="md">
              <Tabs.Tab
                value="ai-chat"
                leftSection={<IconMessageCircle size={16} />}
                style={{ fontWeight: 500 }}
              >
                🤖 AI Agent
              </Tabs.Tab>
              <Tabs.Tab
                value="terminal"
                leftSection={<IconTerminal2 size={16} />}
                color="green"
                style={{ fontWeight: 500 }}
              >
                💻 Terminal
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="ai-chat">
              <AIChat 
                defaultDepartment="GOD_MODE" 
                pageContext={{ isGodMode: true, page: 'admin/god-mode' }} 
                defaultGodMode={true}
              />
            </Tabs.Panel>

            <Tabs.Panel value="terminal">
              <GodModeTerminal />
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Stack>
    </Container>
  );
}
