'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  CopyButton,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  RingProgress,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
  Transition,
  useMantineTheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconBookmark,
  IconBraces,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconFileInvoice,
  IconLanguage,
  IconList,
  IconListNumbers,
  IconMarkdown,
  IconMessageCircle,
  IconMinus,
  IconPlus,
  IconQuestionMark,
  IconRefresh,
  IconRobot,
  IconSend,
  IconSparkles,
  IconTable,
  IconUser,
  IconUsers,
  IconWand,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  options?: string[];
  selectedOption?: string;
}

interface ConversationItem {
  question: string;
  answer: string;
}

interface PromptBuilderModalProps {
  opened: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onUseInChat?: (prompt: string, targetModule?: string) => void;
}

// Dönüştürme işlemleri - Icon only
const TRANSFORM_ACTIONS = [
  { key: 'translate_en', label: "İngilizce'ye Çevir", icon: IconLanguage, color: 'blue' },
  { key: 'to_json', label: 'JSON Formatı', icon: IconBraces, color: 'orange' },
  { key: 'to_markdown', label: 'Markdown', icon: IconMarkdown, color: 'gray' },
  { key: 'shorten', label: 'Kısalt', icon: IconMinus, color: 'red' },
  { key: 'expand', label: 'Genişlet', icon: IconPlus, color: 'green' },
  { key: 'optimize', label: 'Optimize Et', icon: IconSparkles, color: 'violet' },
];

const STYLE_ACTIONS = [
  { key: 'professional', label: 'Profesyonel', color: 'blue' },
  { key: 'casual', label: 'Günlük', color: 'teal' },
  { key: 'technical', label: 'Teknik', color: 'orange' },
  { key: 'simple', label: 'Basit', color: 'gray' },
];

const FORMAT_ACTIONS = [
  { key: 'step_by_step', label: 'Adım Adım', icon: IconListNumbers },
  { key: 'bullet_list', label: 'Liste', icon: IconList },
  { key: 'qa_format', label: 'Soru-Cevap', icon: IconQuestionMark },
  { key: 'table', label: 'Tablo', icon: IconTable },
];

// AI Modül hedefleri
const AI_MODULES = [
  { key: 'chat', label: 'Asistan', icon: IconMessageCircle, color: 'violet', keywords: [] },
  { key: 'fatura', label: 'Muhasebe', icon: IconFileInvoice, color: 'green', keywords: ['fatura', 'muhasebe', 'ödeme', 'tahsilat', 'cari', 'borç', 'alacak', 'gelir', 'gider'] },
  { key: 'personel', label: 'İK / Personel', icon: IconUsers, color: 'blue', keywords: ['personel', 'çalışan', 'maaş', 'bordro', 'izin', 'işe giriş', 'işten çıkış'] },
];

export function PromptBuilderModal({ opened, onClose, onSaved, onUseInChat }: PromptBuilderModalProps) {
  const theme = useMantineTheme();
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [promptName, setPromptName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [promptVersion, setPromptVersion] = useState(1);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Token count
  useEffect(() => {
    setTokenCount(Math.ceil(generatedPrompt.length / 4));
  }, [generatedPrompt]);

  // Akıllı modül önerisi - prompt içeriğine göre
  const suggestedModule = useMemo(() => {
    const lowerPrompt = generatedPrompt.toLowerCase();
    for (const mod of AI_MODULES) {
      if (mod.keywords.some(kw => lowerPrompt.includes(kw))) {
        return mod;
      }
    }
    return AI_MODULES[0]; // Default: Asistan
  }, [generatedPrompt]);

  // Token rengi
  const tokenColor = useMemo(() => {
    if (tokenCount < 100) return 'green';
    if (tokenCount < 300) return 'yellow';
    return 'red';
  }, [tokenCount]);

  // Reset
  const handleClose = useCallback(() => {
    setUserInput('');
    setMessages([]);
    setConversationHistory([]);
    setIsComplete(false);
    setGeneratedPrompt('');
    setPromptName('');
    setPromptVersion(1);
    setPromptHistory([]);
    onClose();
  }, [onClose]);

  // Start conversation
  const handleStart = useCallback(async () => {
    if (!userInput.trim()) return;
    setIsLoading(true);

    const userMsg: Message = { id: `user-${Date.now()}`, type: 'user', content: userInput };
    setMessages([userMsg]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/prompt-builder/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: userInput.trim(), conversationHistory: [] }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        if (data.data.isComplete) {
          setGeneratedPrompt(data.data.suggestedPrompt || userInput);
          setPromptHistory([data.data.suggestedPrompt || userInput]);
          setIsComplete(true);
          setMessages((prev) => [
            ...prev,
            { id: `ai-complete-${Date.now()}`, type: 'ai', content: '✅ Prompt hazır!' },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              type: 'ai',
              content: data.data.question,
              options: data.data.options,
            },
          ]);
        }
      }
    } catch {
      notifications.show({ title: 'Hata', message: 'AI yanıt veremedi', color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, [userInput]);

  // Select option
  const handleSelectOption = useCallback(
    async (messageId: string, option: string) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, selectedOption: option } : msg))
      );

      const questionMsg = messages.find((m) => m.id === messageId);
      if (!questionMsg) return;

      const newHistory = [...conversationHistory, { question: questionMsg.content, answer: option }];
      setConversationHistory(newHistory);
      setIsLoading(true);

      try {
        const originalInput = messages.find((m) => m.type === 'user')?.content || '';
        const res = await fetch(`${API_BASE_URL}/api/prompt-builder/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userInput: originalInput, conversationHistory: newHistory }),
        });
        const data = await res.json();

        if (data.success && data.data) {
          if (data.data.isComplete) {
            setGeneratedPrompt(data.data.suggestedPrompt);
            setPromptHistory([data.data.suggestedPrompt]);
            setIsComplete(true);
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-complete-${Date.now()}`,
                type: 'ai',
                content: `✅ ${data.data.summary || 'Prompt hazır!'}`,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-${Date.now()}`,
                type: 'ai',
                content: data.data.question,
                options: data.data.options,
              },
            ]);
          }
        }
      } catch {
        notifications.show({ title: 'Hata', message: 'AI yanıt veremedi', color: 'red' });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, conversationHistory]
  );

  // Transform prompt
  const handleTransform = useCallback(
    async (action: string) => {
      if (!generatedPrompt) return;
      setIsTransforming(true);

      const actionPrompts: Record<string, string> = {
        translate_en: `Translate the following prompt to English. Keep the meaning and structure intact:\n\n${generatedPrompt}`,
        to_json: `Convert this prompt to a JSON structure with fields like "task", "context", "requirements", "output_format":\n\n${generatedPrompt}`,
        to_markdown: `Format this prompt with proper Markdown (headers, lists, bold, etc.):\n\n${generatedPrompt}`,
        shorten: `Shorten this prompt while keeping the essential meaning (max 100 words):\n\n${generatedPrompt}`,
        expand: `Expand this prompt with more details, examples, and context:\n\n${generatedPrompt}`,
        optimize: `Optimize this prompt for better AI responses. Make it clearer, more specific, and well-structured:\n\n${generatedPrompt}`,
        professional: `Rewrite this prompt in a professional, formal tone:\n\n${generatedPrompt}`,
        casual: `Rewrite this prompt in a casual, friendly tone:\n\n${generatedPrompt}`,
        technical: `Rewrite this prompt with technical jargon and precise terminology:\n\n${generatedPrompt}`,
        simple: `Rewrite this prompt in simple, easy-to-understand language:\n\n${generatedPrompt}`,
        step_by_step: `Restructure this prompt as numbered step-by-step instructions:\n\n${generatedPrompt}`,
        bullet_list: `Restructure this prompt as a bullet point list:\n\n${generatedPrompt}`,
        qa_format: `Restructure this prompt as a Q&A format with questions and expected answers:\n\n${generatedPrompt}`,
        table: `Restructure this prompt to include a table format where appropriate:\n\n${generatedPrompt}`,
      };

      try {
        const res = await fetch(`${API_BASE_URL}/api/prompt-builder/transform`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: actionPrompts[action], action }),
        });
        const data = await res.json();

        if (data.success && data.data?.result) {
          setPromptHistory((prev) => [...prev, generatedPrompt]);
          setGeneratedPrompt(data.data.result);
          setPromptVersion((prev) => prev + 1);
          notifications.show({
            title: 'Dönüştürüldü',
            message: `v${promptVersion + 1} oluşturuldu`,
            color: 'green',
          });
        }
      } catch {
        notifications.show({ title: 'Hata', message: 'Dönüştürme başarısız', color: 'red' });
      } finally {
        setIsTransforming(false);
      }
    },
    [generatedPrompt, promptVersion]
  );

  // Undo transform
  const handleUndo = useCallback(() => {
    if (promptHistory.length > 0) {
      const prev = promptHistory[promptHistory.length - 1];
      setPromptHistory((h) => h.slice(0, -1));
      setGeneratedPrompt(prev);
      setPromptVersion((v) => Math.max(1, v - 1));
    }
  }, [promptHistory]);

  // Reset
  const handleReset = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    setIsComplete(false);
    setGeneratedPrompt('');
    setPromptName('');
    setUserInput('');
    setPromptVersion(1);
    setPromptHistory([]);
  }, []);

  // Save
  const handleSave = useCallback(async () => {
    if (!promptName.trim()) {
      notifications.show({ title: 'Hata', message: 'Prompt adı gerekli', color: 'red' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/prompt-builder/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: `${promptName} v${promptVersion}`,
          generatedPrompt,
          answers: { conversationHistory },
          style: 'interactive',
        }),
      });
      if ((await res.json()).success) {
        notifications.show({
          title: 'Kaydedildi!',
          message: 'Prompt başarıyla kaydedildi',
          color: 'green',
        });
        onSaved?.();
        handleClose();
      }
    } catch {
      notifications.show({ title: 'Hata', message: 'Kaydetme başarısız', color: 'red' });
    } finally {
      setIsSaving(false);
    }
  }, [promptName, generatedPrompt, conversationHistory, promptVersion, onSaved, handleClose]);

  // AI'ye gönder
  const handleSendToAI = useCallback(
    (moduleKey?: string) => {
      const target = moduleKey || suggestedModule.key;
      if (onUseInChat) {
        onUseInChat(generatedPrompt, target);
        handleClose();
      }
    },
    [generatedPrompt, suggestedModule, onUseInChat, handleClose]
  );

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size={isComplete ? 'xl' : 'lg'}
      centered
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.65, blur: 8 }}
      styles={{
        header: {
          background: `linear-gradient(135deg, ${theme.colors.violet[6]}15 0%, ${theme.colors.grape[6]}15 100%)`,
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${theme.colors.violet[2]}`,
          padding: '1rem 1.5rem',
        },
        body: {
          padding: 0,
        },
        content: {
          overflow: 'hidden',
        },
      }}
      title={
        <Group gap="md">
          <Box
            style={{
              position: 'relative',
              animation: 'float 3s ease-in-out infinite',
            }}
          >
            <ThemeIcon
              size={44}
              radius="xl"
              variant="gradient"
              gradient={{ from: 'violet', to: 'grape', deg: 135 }}
              style={{
                boxShadow: `0 4px 20px ${theme.colors.violet[4]}50`,
              }}
            >
              <IconWand size={24} stroke={1.5} />
            </ThemeIcon>
            <Box
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.colors.yellow[4]}, ${theme.colors.orange[4]})`,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          </Box>
          <Box>
            <Text fw={700} size="lg" style={{ letterSpacing: '-0.3px' }}>
              AI Prompt Builder
            </Text>
            <Text size="xs" c="dimmed" style={{ opacity: 0.8 }}>
              Akıllı sorularla mükemmel promptlar oluşturun
            </Text>
          </Box>
        </Group>
      }
    >
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-4px); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.9); }
          }
          @keyframes gradient-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}
      </style>

      <Stack gap={0}>
        {/* Chat Area */}
        {!isComplete && (
          <Box p="md">
            <ScrollArea h={280} viewportRef={scrollRef} offsetScrollbars>
              <Stack gap="md" p="xs">
                {messages.length === 0 ? (
                  <Paper
                    p="xl"
                    radius="lg"
                    ta="center"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.violet[0]} 0%, ${theme.colors.grape[0]} 100%)`,
                      border: `1px dashed ${theme.colors.violet[3]}`,
                    }}
                  >
                    <Stack align="center" gap="md">
                      <ThemeIcon
                        size={64}
                        radius="xl"
                        variant="gradient"
                        gradient={{ from: 'violet', to: 'grape' }}
                        style={{ boxShadow: `0 8px 32px ${theme.colors.violet[3]}40` }}
                      >
                        <IconSparkles size={32} />
                      </ThemeIcon>
                      <Text fw={600} size="lg">
                        Ne yapmak istiyorsunuz?
                      </Text>
                      <Text size="sm" c="dimmed" maw={300}>
                        İsteğinizi yazın, AI size sorular sorarak en uygun prompt&apos;u oluşturacak
                      </Text>
                    </Stack>
                  </Paper>
                ) : (
                  messages.map((msg) => (
                    <Transition
                      key={msg.id}
                      mounted
                      transition="slide-up"
                      duration={300}
                      timingFunction="ease"
                    >
                      {(styles) => (
                        <Box style={styles}>
                          {msg.type === 'user' ? (
                            <Group justify="flex-end">
                              <Paper
                                p="sm"
                                px="md"
                                radius="xl"
                                style={{
                                  maxWidth: '85%',
                                  background: `linear-gradient(135deg, ${theme.colors.violet[6]} 0%, ${theme.colors.grape[6]} 100%)`,
                                  boxShadow: `0 4px 12px ${theme.colors.violet[4]}30`,
                                }}
                              >
                                <Text c="white" size="sm">
                                  {msg.content}
                                </Text>
                              </Paper>
                              <ThemeIcon size="sm" radius="xl" color="violet" variant="light">
                                <IconUser size={14} />
                              </ThemeIcon>
                            </Group>
                          ) : (
                            <Group align="flex-start" gap="xs">
                              <ThemeIcon size="sm" radius="xl" color="teal" variant="light">
                                <IconRobot size={14} />
                              </ThemeIcon>
                              <Box style={{ flex: 1 }}>
                                <Paper
                                  p="sm"
                                  px="md"
                                  radius="xl"
                                  style={{
                                    maxWidth: '90%',
                                    background: theme.colors.gray[0],
                                    border: `1px solid ${theme.colors.gray[2]}`,
                                  }}
                                >
                                  <Text size="sm" fw={500}>
                                    {msg.content}
                                  </Text>
                                </Paper>
                                {msg.options && !msg.selectedOption && (
                                  <Group gap="xs" mt="sm" wrap="wrap">
                                    {msg.options.map((opt) => (
                                      <Button
                                        key={opt}
                                        size="xs"
                                        variant="light"
                                        color="violet"
                                        radius="xl"
                                        onClick={() => handleSelectOption(msg.id, opt)}
                                        disabled={isLoading}
                                        leftSection={<IconCheck size={12} />}
                                        style={{
                                          transition: 'all 0.2s ease',
                                        }}
                                      >
                                        {opt}
                                      </Button>
                                    ))}
                                  </Group>
                                )}
                                {msg.selectedOption && (
                                  <Badge
                                    mt="xs"
                                    color="teal"
                                    variant="light"
                                    size="lg"
                                    leftSection={<IconCheck size={12} />}
                                  >
                                    {msg.selectedOption}
                                  </Badge>
                                )}
                              </Box>
                            </Group>
                          )}
                        </Box>
                      )}
                    </Transition>
                  ))
                )}
                {isLoading && (
                  <Group align="flex-start" gap="xs">
                    <ThemeIcon size="sm" radius="xl" color="teal" variant="light">
                      <IconRobot size={14} />
                    </ThemeIcon>
                    <Paper p="sm" radius="xl" bg="gray.0">
                      <Group gap="xs">
                        <Loader size="xs" color="violet" type="dots" />
                        <Text size="sm" c="dimmed">
                          AI düşünüyor...
                        </Text>
                      </Group>
                    </Paper>
                  </Group>
                )}
              </Stack>
            </ScrollArea>

            {/* Input */}
            <Group gap="xs" mt="md">
              <Textarea
                placeholder="Örn: Fatura sistemini kontrol etmek istiyorum..."
                value={userInput}
                onChange={(e) => setUserInput(e.currentTarget?.value ?? '')}
                style={{ flex: 1 }}
                minRows={1}
                maxRows={3}
                autosize
                disabled={messages.length > 0 || isLoading}
                radius="xl"
                styles={{
                  input: {
                    paddingLeft: 16,
                    paddingRight: 16,
                  },
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && messages.length === 0 && !isLoading) {
                    e.preventDefault();
                    handleStart();
                  }
                }}
              />
              {messages.length === 0 ? (
                <Button
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'grape' }}
                  onClick={handleStart}
                  disabled={!userInput.trim() || isLoading}
                  loading={isLoading}
                  radius="xl"
                  px="lg"
                  rightSection={<IconArrowRight size={16} />}
                >
                  Başla
                </Button>
              ) : (
                <Button
                  variant="light"
                  color="red"
                  onClick={handleReset}
                  leftSection={<IconRefresh size={16} />}
                  disabled={isLoading}
                  radius="xl"
                >
                  Sıfırla
                </Button>
              )}
            </Group>
          </Box>
        )}

        {/* Result Area */}
        {isComplete && (
          <Box>
            {/* Header Stats */}
            <Box
              px="lg"
              py="sm"
              style={{
                background: `linear-gradient(90deg, ${theme.colors.teal[0]} 0%, ${theme.colors.green[0]} 100%)`,
                borderBottom: `1px solid ${theme.colors.teal[2]}`,
              }}
            >
              <Group justify="space-between">
                <Group gap="sm">
                  <Badge
                    size="lg"
                    variant="filled"
                    color="teal"
                    leftSection={<IconCheck size={14} />}
                    style={{ textTransform: 'none' }}
                  >
                    Prompt Hazır
                  </Badge>
                  <Badge size="lg" variant="outline" color="violet">
                    v{promptVersion}
                  </Badge>
                </Group>

                {/* Circular Token Counter */}
                <Tooltip label={`~${tokenCount} token (tahmini)`}>
                  <Box>
                    <RingProgress
                      size={44}
                      thickness={4}
                      roundCaps
                      sections={[{ value: Math.min((tokenCount / 500) * 100, 100), color: tokenColor }]}
                      label={
                        <Text size="xs" ta="center" fw={600}>
                          {tokenCount}
                        </Text>
                      }
                    />
                  </Box>
                </Tooltip>
              </Group>
            </Box>

            {/* Code Editor Style Prompt Display */}
            <Box p="md">
              <Paper
                radius="lg"
                p={0}
                style={{
                  overflow: 'hidden',
                  background: `linear-gradient(135deg, ${theme.colors.dark[7]} 0%, ${theme.colors.dark[8]} 100%)`,
                  position: 'relative',
                }}
              >
                {/* Animated gradient border */}
                <Box
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: 2,
                    borderRadius: 'var(--mantine-radius-lg)',
                    background: `linear-gradient(90deg, ${theme.colors.violet[5]}, ${theme.colors.grape[5]}, ${theme.colors.pink[5]}, ${theme.colors.violet[5]})`,
                    backgroundSize: '300% 100%',
                    animation: 'gradient-shift 4s ease infinite',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    pointerEvents: 'none',
                  }}
                />

                {/* Editor header */}
                <Group
                  px="md"
                  py="xs"
                  justify="space-between"
                  style={{ borderBottom: `1px solid ${theme.colors.dark[5]}` }}
                >
                  <Group gap={6}>
                    <Box w={12} h={12} style={{ borderRadius: '50%', background: '#ff5f57' }} />
                    <Box w={12} h={12} style={{ borderRadius: '50%', background: '#febc2e' }} />
                    <Box w={12} h={12} style={{ borderRadius: '50%', background: '#28c840' }} />
                  </Group>
                  <Text size="xs" c="dimmed">
                    prompt.txt
                  </Text>
                  <Group gap={4}>
                    {promptHistory.length > 0 && (
                      <Tooltip label="Geri Al">
                        <ActionIcon variant="subtle" color="gray" size="md" onClick={handleUndo}>
                          <IconRefresh size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <CopyButton value={generatedPrompt}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Kopyalandı!' : 'Kopyala'}>
                          <ActionIcon
                            variant="subtle"
                            color={copied ? 'green' : 'gray'}
                            size="sm"
                            onClick={copy}
                          >
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                    <Tooltip label="İndir">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() => {
                          const blob = new Blob([generatedPrompt], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `prompt-v${promptVersion}.txt`;
                          a.click();
                        }}
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>

                {/* Editor content */}
                <ScrollArea h={140} p="md">
                  <Text
                    size="sm"
                    c="gray.3"
                    style={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.8,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    }}
                  >
                    {generatedPrompt}
                  </Text>
                </ScrollArea>
              </Paper>
            </Box>

            {/* Transform Actions - Icon Only */}
            <Box px="md" pb="sm">
              <Divider
                label={
                  <Text size="xs" c="dimmed" fw={500}>
                    Dönüştür
                  </Text>
                }
                labelPosition="center"
                mb="sm"
              />

              <Group justify="center" gap="xs">
                {TRANSFORM_ACTIONS.map((action) => (
                  <Tooltip key={action.key} label={action.label} withArrow>
                    <ActionIcon
                      variant="light"
                      color={action.color}
                      size="lg"
                      radius="md"
                      onClick={() => handleTransform(action.key)}
                      loading={isTransforming}
                      disabled={isTransforming}
                    >
                      <action.icon size={18} />
                    </ActionIcon>
                  </Tooltip>
                ))}

                <Divider orientation="vertical" />

                <Menu shadow="md" width={160}>
                  <Menu.Target>
                    <Tooltip label="Stil Değiştir" withArrow>
                      <ActionIcon variant="light" color="blue" size="lg" radius="md">
                        <IconChevronDown size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Stil</Menu.Label>
                    {STYLE_ACTIONS.map((style) => (
                      <Menu.Item
                        key={style.key}
                        onClick={() => handleTransform(style.key)}
                        disabled={isTransforming}
                      >
                        {style.label}
                      </Menu.Item>
                    ))}
                    <Menu.Divider />
                    <Menu.Label>Format</Menu.Label>
                    {FORMAT_ACTIONS.map((format) => (
                      <Menu.Item
                        key={format.key}
                        leftSection={<format.icon size={14} />}
                        onClick={() => handleTransform(format.key)}
                        disabled={isTransforming}
                      >
                        {format.label}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Box>

            <Divider />

            {/* Save & Send Section */}
            <Box p="md">
              <TextInput
                placeholder="Prompt adı (örn: Fatura Kontrol)"
                value={promptName}
                onChange={(e) => setPromptName(e.currentTarget?.value ?? '')}
                radius="md"
                mb="md"
                leftSection={<IconBookmark size={16} />}
              />

              {/* Floating Action Bar */}
              <Paper
                p="sm"
                radius="lg"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.gray[0]} 0%, ${theme.colors.gray[1]} 100%)`,
                  border: `1px solid ${theme.colors.gray[2]}`,
                }}
              >
                <Group justify="space-between">
                  <Button
                    variant="subtle"
                    color="gray"
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleReset}
                    size="sm"
                  >
                    Yeniden
                  </Button>

                  <Group gap="xs">
                    {/* AI Gönder - Split Button */}
                    {onUseInChat && (
                      <Group gap={0}>
                        <Tooltip
                          label={`Önerilen: ${suggestedModule.label}`}
                          withArrow
                          position="top"
                        >
                          <Button
                            variant="gradient"
                            gradient={{ from: suggestedModule.color, to: 'violet' }}
                            leftSection={<suggestedModule.icon size={16} />}
                            onClick={() => handleSendToAI()}
                            radius="md"
                            style={{
                              borderTopRightRadius: 0,
                              borderBottomRightRadius: 0,
                            }}
                          >
                            {suggestedModule.label}&apos;a Gönder
                          </Button>
                        </Tooltip>
                        <Menu shadow="md" width={180} position="top-end">
                          <Menu.Target>
                            <Button
                              variant="gradient"
                              gradient={{ from: suggestedModule.color, to: 'violet' }}
                              px="xs"
                              radius="md"
                              style={{
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                borderLeft: '1px solid rgba(255,255,255,0.3)',
                              }}
                            >
                              <IconChevronDown size={16} />
                            </Button>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Label>Hedef Modül</Menu.Label>
                            {AI_MODULES.map((mod) => (
                              <Menu.Item
                                key={mod.key}
                                leftSection={<mod.icon size={16} color={theme.colors[mod.color][6]} />}
                                onClick={() => handleSendToAI(mod.key)}
                                rightSection={
                                  mod.key === suggestedModule.key ? (
                                    <Badge size="xs" color="violet" variant="light">
                                      Önerilen
                                    </Badge>
                                  ) : null
                                }
                              >
                                {mod.label}
                              </Menu.Item>
                            ))}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    )}

                    <Button
                      variant="gradient"
                      gradient={{ from: 'teal', to: 'green' }}
                      leftSection={<IconBookmark size={16} />}
                      onClick={handleSave}
                      loading={isSaving}
                      disabled={!promptName.trim()}
                      radius="md"
                    >
                      Kaydet
                    </Button>
                  </Group>
                </Group>
              </Paper>
            </Box>
          </Box>
        )}
      </Stack>
    </Modal>
  );
}
