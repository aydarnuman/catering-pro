'use client';

/**
 * AIHelpTool - Not bazli AI islemleri
 * - Notu ozetle
 * - Yazim duzelt
 * - Gorev cikar (metinden gorev listesi)
 */

import {
  Box,
  Button,
  CopyButton,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCopy,
  IconFileText,
  IconListCheck,
  IconPencil,
  IconSparkles,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import type { UnifiedNote } from '@/types/notes';

type AIAction = 'summarize' | 'fix-writing' | 'extract-tasks';

interface AIHelpToolProps {
  notes: UnifiedNote[];
  onCreateTasksFromAI?: (tasks: string[]) => void;
}

const AI_ACTIONS: Array<{
  value: AIAction;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    value: 'summarize',
    label: 'Notu Ozetle',
    icon: <IconFileText size={16} />,
    description: 'Secilen notun kisa ozetini cikarir',
  },
  {
    value: 'fix-writing',
    label: 'Yazim Duzelt',
    icon: <IconPencil size={16} />,
    description: 'Imla ve gramer hatalarini duzeltir',
  },
  {
    value: 'extract-tasks',
    label: 'Gorev Cikar',
    icon: <IconListCheck size={16} />,
    description: 'Metinden yapilacak maddeleri cikarir',
  },
];

function stripHtml(html: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
  return html.replace(/<[^>]*>/g, '');
}

export function AIHelpTool({ notes, onCreateTasksFromAI }: AIHelpToolProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [action, setAction] = useState<AIAction>('summarize');
  const [customText, setCustomText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  const noteOptions = notes.map((n) => ({
    value: n.id,
    label: n.title || stripHtml(n.content).slice(0, 60) || 'Baslıksiz not',
  }));

  const getPrompt = useCallback((act: AIAction, text: string): string => {
    switch (act) {
      case 'summarize':
        return `Asagidaki notu Turkce olarak 2-3 cumlede ozetle. Sadece ozeti yaz, baska aciklama ekleme:\n\n${text}`;
      case 'fix-writing':
        return `Asagidaki Turkce metindeki yazim, imla ve gramer hatalarini duzelt. Sadece duzeltilmis metni yaz, aciklama ekleme:\n\n${text}`;
      case 'extract-tasks':
        return `Asagidaki metinden yapilacak is/gorev maddelerini cikar. Her maddeyi ayri satirda "- " ile baslat. Sadece gorev listesini yaz:\n\n${text}`;
      default:
        return text;
    }
  }, []);

  const handleRun = useCallback(async () => {
    let text = customText;

    if (!useCustom && selectedNoteId) {
      const note = notes.find((n) => n.id === selectedNoteId);
      if (note) {
        text = note.title ? `${note.title}\n\n${stripHtml(note.content)}` : stripHtml(note.content);
      }
    }

    if (!text.trim()) {
      notifications.show({ message: 'Islenecek metin yok', color: 'orange' });
      return;
    }

    setLoading(true);
    setResult('');

    try {
      const prompt = getPrompt(action, text);
      const response = await aiAPI.sendAgentMessage({
        message: prompt,
        department: 'GENEL',
        systemContext:
          'Kullanici not yonetim araci icerisinden islem yapiyor. Kisa ve oz cevap ver.',
      });

      if (response.success && response.data?.response) {
        setResult(response.data.response);
      } else {
        notifications.show({ title: 'Hata', message: 'AI yanit veremedi', color: 'red' });
      }
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'AI servisi ile baglanti kurulamadi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedNoteId, action, notes, customText, useCustom, getPrompt]);

  const selectedAction = AI_ACTIONS.find((a) => a.value === action);

  const actionColors: Record<AIAction, string> = {
    summarize: 'blue',
    'fix-writing': 'teal',
    'extract-tasks': 'orange',
  };

  return (
    <Stack gap="md">
      <Group gap="sm">
        <Box
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDark
              ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)'
              : 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.06) 100%)',
            color: 'var(--mantine-color-blue-5)',
          }}
        >
          <IconSparkles size={18} />
        </Box>
        <Box>
          <Text size="lg" fw={700} style={{ letterSpacing: '-0.02em' }}>
            AI Yardim
          </Text>
          <Text size="xs" c="dimmed">
            Notlarinizi AI ile analiz edin
          </Text>
        </Box>
      </Group>

      {/* Action selection - card based */}
      <Stack gap="xs">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Islem sec
        </Text>
        <Group gap="xs">
          {AI_ACTIONS.map((act) => {
            const isSelected = action === act.value;
            const clr = actionColors[act.value];
            return (
              <Paper
                key={act.value}
                p="sm"
                radius="md"
                className="ws-ai-action"
                style={{
                  flex: 1,
                  border: isSelected
                    ? `1.5px solid var(--mantine-color-${clr}-${isDark ? '5' : '4'})`
                    : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  background: isSelected
                    ? isDark
                      ? `rgba(var(--mantine-color-${clr}-9-rgb, 0,0,0), 0.1)`
                      : `var(--mantine-color-${clr}-0)`
                    : 'transparent',
                  boxShadow: isSelected
                    ? `0 0 12px var(--mantine-color-${clr}-${isDark ? '9' : '1'})`
                    : 'none',
                }}
                onClick={() => setAction(act.value)}
              >
                <Stack gap={6} align="center">
                  <Box
                    style={{
                      color: isSelected
                        ? `var(--mantine-color-${clr}-${isDark ? '4' : '6'})`
                        : isDark
                          ? 'rgba(255,255,255,0.5)'
                          : 'rgba(0,0,0,0.4)',
                    }}
                  >
                    {act.icon}
                  </Box>
                  <Text
                    size="xs"
                    fw={isSelected ? 700 : 500}
                    ta="center"
                    style={{ lineHeight: 1.2 }}
                  >
                    {act.label}
                  </Text>
                </Stack>
              </Paper>
            );
          })}
        </Group>
        {selectedAction && (
          <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
            {selectedAction.description}
          </Text>
        )}
      </Stack>

      {/* Source selection */}
      <Stack gap="xs">
        <Group gap="xs">
          <Button
            variant={!useCustom ? 'light' : 'subtle'}
            color={!useCustom ? 'violet' : 'gray'}
            size="xs"
            radius="md"
            onClick={() => setUseCustom(false)}
          >
            Nottan sec
          </Button>
          <Button
            variant={useCustom ? 'light' : 'subtle'}
            color={useCustom ? 'violet' : 'gray'}
            size="xs"
            radius="md"
            onClick={() => setUseCustom(true)}
          >
            Metin yapistir
          </Button>
        </Group>

        {!useCustom ? (
          <Select
            placeholder="Not secin..."
            data={noteOptions}
            value={selectedNoteId}
            onChange={setSelectedNoteId}
            searchable
            size="sm"
            radius="md"
            nothingFoundMessage="Not bulunamadi"
          />
        ) : (
          <Textarea
            placeholder="Islenecek metni buraya yapistirin..."
            value={customText}
            onChange={(e) => setCustomText(e.currentTarget.value)}
            minRows={4}
            maxRows={8}
            autosize
            size="sm"
            radius="md"
          />
        )}
      </Stack>

      {/* Run button */}
      <Button
        onClick={handleRun}
        loading={loading}
        disabled={!useCustom && !selectedNoteId}
        leftSection={!loading ? <IconSparkles size={16} /> : undefined}
        color="violet"
        radius="md"
        size="md"
        style={{
          background: loading
            ? undefined
            : 'linear-gradient(135deg, var(--mantine-color-violet-6) 0%, var(--mantine-color-indigo-6) 100%)',
        }}
      >
        {loading ? 'AI dusunuyor...' : 'Calistir'}
      </Button>

      {/* Loading state */}
      {loading && !result && (
        <Paper
          p="lg"
          radius="md"
          style={{
            background: isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.03)',
            border: `1px solid ${isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'}`,
          }}
        >
          <Group gap="sm" justify="center">
            <Loader size="sm" color="violet" type="dots" />
            <Text size="sm" c="dimmed" fw={500}>
              Metin isleniyor...
            </Text>
          </Group>
        </Paper>
      )}

      {/* Result */}
      {result && (
        <Paper
          p="md"
          radius="lg"
          style={{
            border: `1px solid var(--mantine-color-violet-${isDark ? '7' : '3'})`,
            background: isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.03)',
            overflow: 'hidden',
          }}
        >
          {/* Result header */}
          <Group
            justify="space-between"
            mb="sm"
            pb="xs"
            style={{
              borderBottom: `1px solid ${isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'}`,
            }}
          >
            <Group gap={6}>
              <IconSparkles size={14} color="var(--mantine-color-violet-5)" />
              <Text size="xs" fw={700} c="violet">
                Sonuc
              </Text>
            </Group>
            <CopyButton value={result}>
              {({ copied, copy }) => (
                <Button
                  variant="subtle"
                  size="xs"
                  color={copied ? 'green' : 'gray'}
                  leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  onClick={copy}
                  radius="md"
                >
                  {copied ? 'Kopyalandi' : 'Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
          <ScrollArea mah={300}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {result}
            </Text>
          </ScrollArea>

          {action === 'extract-tasks' && onCreateTasksFromAI && (
            <Button
              variant="light"
              size="xs"
              color="orange"
              mt="sm"
              radius="md"
              leftSection={<IconListCheck size={14} />}
              onClick={() => {
                const tasks = result
                  .split('\n')
                  .map((l) => l.replace(/^[-*•]\s*/, '').trim())
                  .filter(Boolean);
                onCreateTasksFromAI(tasks);
                notifications.show({ message: `${tasks.length} gorev eklendi`, color: 'green' });
              }}
            >
              Gorev olarak ekle
            </Button>
          )}
        </Paper>
      )}
    </Stack>
  );
}
