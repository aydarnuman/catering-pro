'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Code,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  rem,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconClearAll,
  IconClock,
  IconCommand,
  IconDatabase,
  IconDeviceFloppy,
  IconHistory,
  IconNetwork,
  IconPlayerPlay,
  IconRefresh,
  IconServer,
  IconTerminal2,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';

interface CommandOutput {
  id: string;
  command: string;
  output: string;
  success: boolean;
  duration?: number;
  timestamp: string;
  isPreset?: boolean;
}

interface PresetCommand {
  id: string;
  command: string;
  description: string;
  safe: boolean;
}

interface WarningResponse {
  success: false;
  warning: true;
  message: string;
  command: string;
}

// Kategorize edilmiş hazır komutlar - macOS uyumlu
const PRESET_CATEGORIES = {
  sistem: {
    label: '💻 Sistem',
    icon: IconServer,
    commands: [
      { id: 'disk_usage', command: 'df -h', description: 'Disk', safe: true },
      { id: 'memory_usage', command: 'vm_stat | head -10 && sysctl hw.memsize', description: 'Bellek', safe: true },
      { id: 'cpu_info', command: 'sysctl -n machdep.cpu.brand_string && ps -A -o %cpu | awk \'{s+=$1} END {print "CPU: " s "%"}\'', description: 'CPU', safe: true },
      { id: 'network_ports', command: 'lsof -iTCP -sTCP:LISTEN -P -n | head -15', description: 'Portlar', safe: true },
      { id: 'system_uptime', command: 'uptime', description: 'Uptime', safe: true },
      { id: 'node_version', command: 'node -v && npm -v', description: 'Node', safe: true },
    ],
  },
  pm2: {
    label: '🔄 PM2',
    icon: IconRefresh,
    commands: [
      { id: 'pm2_status', command: 'pm2 status', description: 'Durum', safe: true },
      { id: 'pm2_logs', command: 'pm2 logs --lines 30 --nostream', description: 'Loglar', safe: true },
      { id: 'backend_restart', command: 'pm2 restart catering-backend 2>/dev/null || echo "Bulunamadı"', description: 'Backend', safe: false },
      { id: 'frontend_restart', command: 'pm2 restart catering-frontend 2>/dev/null || echo "Bulunamadı"', description: 'Frontend', safe: false },
    ],
  },
  git: {
    label: '📂 Git',
    icon: IconHistory,
    commands: [
      { id: 'git_status', command: 'cd /Users/numanaydar/Desktop/CATERİNG && git status --short', description: 'Status', safe: true },
      { id: 'git_log', command: 'cd /Users/numanaydar/Desktop/CATERİNG && git log --oneline -10', description: 'Son 10', safe: true },
      { id: 'git_branch', command: 'cd /Users/numanaydar/Desktop/CATERİNG && git branch -a', description: 'Branch', safe: true },
    ],
  },
  diger: {
    label: '⚙️ Diğer',
    icon: IconCommand,
    commands: [
      { id: 'db_connection', command: `curl -s ${process.env.NEXT_PUBLIC_API_URL || ''}/health | grep -q ok && echo "✅ DB Aktif" || echo "❌ DB Yok"`, description: 'DB Test', safe: true },
      { id: 'clear_cache', command: 'rm -rf /tmp/catering-cache/* 2>/dev/null; echo "✅ Temizlendi"', description: 'Cache', safe: false },
      { id: 'env_check', command: 'cd /Users/numanaydar/Desktop/CATERİNG/backend && cat .env | grep -E "^[A-Z]" | cut -d= -f1 | head -10', description: 'ENV', safe: true },
    ],
  },
};

// Tüm komutları düz liste olarak da tut (arama/history için)
const ALL_PRESETS: PresetCommand[] = Object.values(PRESET_CATEGORIES).flatMap((cat) => cat.commands);

export function GodModeTerminal() {
  // Cookie-only authentication - token gerekmiyor
  const [command, setCommand] = useState('');
  const [outputs, setOutputs] = useState<CommandOutput[]>([]);
  const presets = ALL_PRESETS;
  const [loading, setLoading] = useState(false);
  const [presetLoading, setPresetLoading] = useState<string | null>(null);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeCategory, setActiveCategory] = useState<string>('sistem');

  // Scroll to bottom on new output
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [outputs]);

  // Manuel komut çalıştır
  const executeCommand = useCallback(async (cmd: string, confirmed = false) => {
    if (!cmd.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/system/terminal/execute`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: cmd, confirmed }),
      });
      const data = await res.json();

      // Uyarı durumu
      if (data.warning) {
        setPendingCommand(cmd);
        openConfirm();
        setLoading(false);
        return;
      }

      // Blocked durumu
      if (data.blocked) {
        setOutputs((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            command: cmd,
            output: data.error,
            success: false,
            timestamp: new Date().toISOString(),
          },
        ]);
        notifications.show({
          title: '🚫 Engellendi',
          message: 'Bu komut güvenlik nedeniyle engellenmiştir.',
          color: 'red',
        });
        setLoading(false);
        return;
      }

      // Normal sonuç
      const output = data.success
        ? data.output || '(Çıktı yok)'
        : `Error: ${data.error}\n${data.output || ''}${data.stderr ? `\nStderr: ${data.stderr}` : ''}`;

      setOutputs((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          command: cmd,
          output,
          success: data.success,
          duration: data.duration,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      ]);

      // Command history'ye ekle
      setCommandHistory((prev) => {
        const newHistory = [cmd, ...prev.filter((c) => c !== cmd)].slice(0, 50);
        return newHistory;
      });
      setHistoryIndex(-1);
      setCommand('');
    } catch (error) {
      setOutputs((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          command: cmd,
          output: `Network Error: ${error instanceof Error ? error.message : 'Bağlantı hatası'}`,
          success: false,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [openConfirm]);

  // Preset komut çalıştır (preset komutu direkt execute endpoint'ine gönder)
  const executePreset = useCallback(async (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    
    setPresetLoading(presetId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/system/terminal/execute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: preset.command }),
      });
      const data = await res.json();

      const output = data.success
        ? data.output || '(Çıktı yok)'
        : `Error: ${data.error}\n${data.output || ''}`;

      setOutputs((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          command: preset.command,
          output,
          success: data.success,
          duration: data.duration,
          timestamp: data.timestamp || new Date().toISOString(),
          isPreset: true,
        },
      ]);
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Komut çalıştırılamadı',
        color: 'red',
      });
    } finally {
      setPresetLoading(null);
    }
  }, [presets]);

  // Onaylı komut çalıştır
  const confirmAndExecute = useCallback(() => {
    if (pendingCommand) {
      executeCommand(pendingCommand, true);
      setPendingCommand(null);
      closeConfirm();
    }
  }, [pendingCommand, executeCommand, closeConfirm]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand(command);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      // Ctrl+C - clear current input
      setCommand('');
      setHistoryIndex(-1);
    } else if (e.key === 'l' && e.ctrlKey) {
      // Ctrl+L - clear terminal
      e.preventDefault();
      setOutputs([]);
    }
  };

  // Güvenli komut sayısı
  const safeCount = presets.filter((p) => p.safe).length;

  return (
    <Stack gap="md">
      {/* Hazır Komutlar - Kategorize Tab'lar */}
      <Paper p="sm" radius="md" withBorder>
        <Tabs value={activeCategory} onChange={(v) => setActiveCategory(v || 'sistem')} variant="pills" radius="md">
          <Group justify="space-between" align="center" mb="xs">
            <Tabs.List style={{ gap: rem(4) }}>
              {Object.entries(PRESET_CATEGORIES).map(([key, cat]) => (
                <Tabs.Tab
                  key={key}
                  value={key}
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >
                  {cat.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Badge variant="light" color="green" size="sm">
              {safeCount} Güvenli
            </Badge>
          </Group>

          {Object.entries(PRESET_CATEGORIES).map(([key, cat]) => (
            <Tabs.Panel key={key} value={key} pt="xs">
              <Group gap="xs">
                {cat.commands.map((preset) => (
                  <Tooltip key={preset.id} label={preset.command} multiline w={280} withArrow>
                    <Button
                      variant={preset.safe ? 'light' : 'outline'}
                      color={preset.safe ? 'blue' : 'orange'}
                      size="xs"
                      loading={presetLoading === preset.id}
                      onClick={() => executePreset(preset.id)}
                      style={{ minWidth: 70 }}
                    >
                      {preset.description}
                    </Button>
                  </Tooltip>
                ))}
              </Group>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Paper>

      {/* Terminal */}
      <Paper
        p={0}
        radius="md"
        style={{
          overflow: 'hidden',
          border: '2px solid var(--mantine-color-dark-4)',
          backgroundColor: '#0d1117',
        }}
      >
        {/* Terminal Header */}
        <Group
          px="md"
          py="xs"
          justify="space-between"
          style={{
            backgroundColor: '#161b22',
            borderBottom: '1px solid #30363d',
          }}
        >
          <Group gap="sm">
            <Group gap={6}>
              <Box w={12} h={12} style={{ borderRadius: '50%', backgroundColor: '#ff5f56' }} />
              <Box w={12} h={12} style={{ borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
              <Box w={12} h={12} style={{ borderRadius: '50%', backgroundColor: '#27c93f' }} />
            </Group>
            <Text size="sm" c="dimmed" fw={500}>
              💻 God Mode Terminal
            </Text>
          </Group>
          <Group gap="xs">
            <Tooltip label="Temizle (Ctrl+L)">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setOutputs([])}
              >
                <IconClearAll size={16} />
              </ActionIcon>
            </Tooltip>
            <Badge size="sm" color="green" variant="dot">
              Bağlı
            </Badge>
          </Group>
        </Group>

        {/* Terminal Output */}
        <ScrollArea
          h={400}
          viewportRef={scrollRef}
          style={{ backgroundColor: '#0d1117' }}
          px="md"
          py="sm"
        >
          {outputs.length === 0 ? (
            <Stack align="center" justify="center" h={350} gap="md">
              <ThemeIcon size={60} color="gray" variant="light" radius="xl">
                <IconTerminal2 size={30} />
              </ThemeIcon>
              <Text c="dimmed" ta="center">
                Komut çalıştırmak için aşağıya yazın veya<br />
                hazır komutlardan birini seçin
              </Text>
              <Group gap="xs">
                <Badge color="gray" variant="light" size="sm">↑↓ Geçmiş</Badge>
                <Badge color="gray" variant="light" size="sm">Ctrl+L Temizle</Badge>
                <Badge color="gray" variant="light" size="sm">Enter Çalıştır</Badge>
              </Group>
            </Stack>
          ) : (
            <Stack gap="md">
              {outputs.map((item) => (
                <Box key={item.id}>
                  {/* Command Line */}
                  <Group gap="xs" mb={4}>
                    <Text size="sm" c="green" fw={600} style={{ fontFamily: 'monospace' }}>
                      root@catering:~$
                    </Text>
                    <Text size="sm" c="white" style={{ fontFamily: 'monospace' }}>
                      {item.command}
                    </Text>
                    {item.isPreset && (
                      <Badge size="xs" color="blue" variant="light">preset</Badge>
                    )}
                    {item.duration && (
                      <Badge size="xs" color="gray" variant="light" leftSection={<IconClock size={10} />}>
                        {item.duration}ms
                      </Badge>
                    )}
                  </Group>

                  {/* Output */}
                  <Code
                    block
                    style={{
                      backgroundColor: item.success ? '#161b22' : '#2d1b1b',
                      color: item.success ? '#c9d1d9' : '#f85149',
                      border: `1px solid ${item.success ? '#30363d' : '#f8514933'}`,
                      fontFamily: 'JetBrains Mono, Fira Code, monospace',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {item.output}
                  </Code>
                </Box>
              ))}

              {loading && (
                <Group gap="xs">
                  <Text size="sm" c="green" fw={600} style={{ fontFamily: 'monospace' }}>
                    root@catering:~$
                  </Text>
                  <Text size="sm" c="white" style={{ fontFamily: 'monospace' }}>
                    {command}
                  </Text>
                  <Loader size="xs" color="green" />
                </Group>
              )}
            </Stack>
          )}
        </ScrollArea>

        {/* Terminal Input */}
        <Group
          px="md"
          py="sm"
          gap="sm"
          style={{
            backgroundColor: '#161b22',
            borderTop: '1px solid #30363d',
          }}
        >
          <Text size="sm" c="green" fw={600} style={{ fontFamily: 'monospace' }}>
            root@catering:~$
          </Text>
          <TextInput
            ref={inputRef}
            placeholder="Komut girin..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            style={{ flex: 1 }}
            styles={{
              input: {
                backgroundColor: 'transparent',
                border: 'none',
                color: 'white',
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                fontSize: 14,
                '&:focus': {
                  border: 'none',
                },
              },
            }}
          />
          <Button
            variant="light"
            color="green"
            size="sm"
            leftSection={<IconPlayerPlay size={16} />}
            loading={loading}
            onClick={() => executeCommand(command)}
            disabled={!command.trim()}
          >
            Çalıştır
          </Button>
        </Group>
      </Paper>

      {/* Uyarı Modal */}
      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title={
          <Group gap="sm">
            <ThemeIcon color="orange" variant="light">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
            <Text fw={600}>⚠️ Tehlikeli Komut</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Bu komut sistemi etkileyebilir. Devam etmek istediğinizden emin misiniz?
          </Text>
          <Code block style={{ backgroundColor: '#2d1b1b', color: '#f85149' }}>
            {pendingCommand}
          </Code>
          <Group justify="flex-end" gap="sm">
            <Button variant="light" color="gray" onClick={closeConfirm} leftSection={<IconX size={16} />}>
              İptal
            </Button>
            <Button color="red" onClick={confirmAndExecute} leftSection={<IconCheck size={16} />}>
              Evet, Çalıştır
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
