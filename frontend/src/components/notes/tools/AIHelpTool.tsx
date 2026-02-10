'use client';

/**
 * AIHelpTool - Not bazli AI islemleri
 * - Notu ozetle
 * - Yazim duzelt
 * - Gorev cikar (metinden gorev listesi)
 */

import {
  Button,
  CopyButton,
  Group,
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

const AI_ACTIONS: Array<{ value: AIAction; label: string; icon: React.ReactNode; description: string }> = [
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

  const getPrompt = useCallback(
    (act: AIAction, text: string): string => {
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
    },
    []
  );

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
        systemContext: 'Kullanici not yonetim araci icerisinden islem yapiyor. Kisa ve oz cevap ver.',
      });

      if (response.success && response.data?.response) {
        setResult(response.data.response);
      } else {
        notifications.show({ title: 'Hata', message: 'AI yanit veremedi', color: 'red' });
      }
    } catch {
      notifications.show({ title: 'Hata', message: 'AI servisi ile baglanti kurulamadi', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [selectedNoteId, action, notes, customText, useCustom, getPrompt]);

  const selectedAction = AI_ACTIONS.find((a) => a.value === action);

  return (
    <Stack gap="md">
      <Group gap="sm">
        <IconSparkles size={20} />
        <Text size="lg" fw={700}>
          AI Yardim
        </Text>
      </Group>

      {/* Action selection */}
      <Stack gap="xs">
        <Text size="xs" c="dimmed" fw={600}>
          Islem sec:
        </Text>
        <Group gap="xs">
          {AI_ACTIONS.map((act) => (
            <Button
              key={act.value}
              variant={action === act.value ? 'filled' : 'light'}
              color={action === act.value ? 'violet' : 'gray'}
              size="xs"
              leftSection={act.icon}
              onClick={() => setAction(act.value)}
            >
              {act.label}
            </Button>
          ))}
        </Group>
        {selectedAction && (
          <Text size="xs" c="dimmed">
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
            onClick={() => setUseCustom(false)}
          >
            Nottan sec
          </Button>
          <Button
            variant={useCustom ? 'light' : 'subtle'}
            color={useCustom ? 'violet' : 'gray'}
            size="xs"
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
          />
        )}
      </Stack>

      {/* Run button */}
      <Button
        onClick={handleRun}
        loading={loading}
        disabled={!useCustom && !selectedNoteId}
        leftSection={<IconSparkles size={16} />}
        color="violet"
      >
        {loading ? 'Isleniyor...' : 'Calistir'}
      </Button>

      {/* Result */}
      {result && (
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            borderColor: 'var(--mantine-color-violet-4)',
            background: isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.03)',
          }}
        >
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={600} c="violet">
              Sonuc
            </Text>
            <CopyButton value={result}>
              {({ copied, copy }) => (
                <Button
                  variant="subtle"
                  size="xs"
                  color={copied ? 'green' : 'gray'}
                  leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  onClick={copy}
                >
                  {copied ? 'Kopyalandi' : 'Kopyala'}
                </Button>
              )}
            </CopyButton>
          </Group>
          <ScrollArea mah={300}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {result}
            </Text>
          </ScrollArea>

          {action === 'extract-tasks' && onCreateTasksFromAI && (
            <Button
              variant="light"
              size="xs"
              color="orange"
              mt="sm"
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
