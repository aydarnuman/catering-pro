'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Loader,
  Paper,
  Popover,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrain,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconClipboardList,
  IconCopy,
  IconDatabase,
  IconFileInvoice,
  IconFlame,
  IconHistory,
  IconRefresh,
  IconRobot,
  IconSend,
  IconSettings,
  IconSparkles,
  IconThumbDown,
  IconThumbUp,
  IconTool,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { aiAPI } from '@/lib/api/services/ai';

// Tip tanımları
interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  iterations?: number;
  godMode?: boolean; // God Mode ile mi yanıtlandı?
}

interface PromptTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  is_active: boolean;
}

interface PageContext {
  type?: 'tender' | 'invoice' | 'cari' | 'personel' | 'stok' | 'planlama' | 'muhasebe' | 'general';
  id?: number | string;
  title?: string;
  data?: Record<string, unknown>;
  pathname?: string;
  department?: string;
  page?: string;
  isGodMode?: boolean;
}

interface AIChatProps {
  defaultDepartment?: string;
  compact?: boolean;
  pageContext?: PageContext;
  defaultGodMode?: boolean; // God Mode varsayılan olarak aktif mi?
  /** Toolbar vb. dışarıdan açıldığında ilk mesajı otomatik gönder */
  initialMessage?: string | null;
  /** initialMessage gönderildikten sonra çağrılır (state temizliği için) */
  onInitialMessageConsumed?: () => void;
}

// Tool ikon mapping
const toolIcons: Record<string, React.ReactNode> = {
  satin_alma: <IconClipboardList size={12} />,
  cari: <IconUsers size={12} />,
  fatura: <IconFileInvoice size={12} />,
  ihale: <IconDatabase size={12} />,
  rapor: <IconChartBar size={12} />,
};

const getToolIcon = (toolName: string) => {
  const module = toolName.split('_')[0];
  return toolIcons[module] || <IconTool size={12} />;
};

const getToolDisplayName = (toolName: string) => {
  const parts = toolName.split('_');
  const module = parts[0];
  const action = parts.slice(1).join(' ');

  const moduleNames: Record<string, string> = {
    satin_alma: 'Satın Alma',
    cari: 'Cariler',
    fatura: 'Faturalar',
    ihale: 'İhaleler',
    rapor: 'Raporlar',
  };

  return `${moduleNames[module] || module}: ${action}`;
};

export function AIChat({
  defaultDepartment = 'TÜM SİSTEM',
  compact = false,
  pageContext,
  defaultGodMode = false,
  initialMessage,
  onInitialMessageConsumed,
}: AIChatProps) {
  // Auth context - God Mode için
  const { isSuperAdmin } = useAuth();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('default');
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set()); // Feedback verilen mesajlar
  const [godModeEnabled, setGodModeEnabled] = useState(defaultGodMode); // God Mode toggle - varsayılan prop'tan
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // God Mode prop değiştiğinde state'i güncelle
  useEffect(() => {
    setGodModeEnabled(defaultGodMode);
  }, [defaultGodMode]);

  // Session ID - tarayıcı oturumu boyunca aynı kalır, hafıza için kullanılır
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('ai_session_id');
      if (stored) return stored;
      const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('ai_session_id', newId);
      return newId;
    }
    return `session_${Date.now()}`;
  });

  // Departmana göre önerilen sorular
  const _departmentQuestions: Record<string, string[]> = {
    PERSONEL: [
      '👥 Toplam personel maliyetimiz ne kadar?',
      '💰 40.000 TL net maaşın brüt ve toplam maliyeti ne?',
      '📊 Bu ay izinli kaç kişi var?',
      "🧮 Ahmet'in kıdem tazminatını hesapla",
      '📋 Aktif personelleri listele',
      '💵 Ocak ayı bordro özeti göster',
    ],
    MENU_PLANLAMA: [
      '📅 Ocak ayı için KYK menüsü hazırla',
      '🍲 Mevcut reçeteleri listele',
      '💰 Mercimek çorbası maliyetini hesapla',
      '🥗 Düşük kalorili haftalık menü öner',
      '📊 9 Ocak menüsünü göster',
      '👨‍🍳 Tavuk sote reçetesi oluştur',
    ],
    'TÜM SİSTEM': [
      '📊 Bu ay KYK için ne kadar harcama yapıldı?',
      '📦 Bekleyen siparişler hangileri?',
      '💰 En çok alım yaptığımız tedarikçi kim?',
      '📅 Yaklaşan ihaleler neler?',
      '⚠️ Kritik uyarılar var mı?',
      '📈 Geçen ayla karşılaştırma yap',
    ],
  };

  // Departmana göre hızlı komutlar
  const departmentCommands: Record<string, Array<{ label: string; value: string }>> = {
    PERSONEL: [
      { label: '👥 Personel istatistikleri', value: 'Personel istatistiklerini göster' },
      { label: '💰 Bordro hesapla', value: 'Tüm personelin bordrosunu hesapla' },
      { label: '📅 İzin bakiyesi', value: 'Personellerin izin bakiyelerini listele' },
      { label: '🧮 Maliyet analizi', value: 'Toplam personel maliyeti analizi yap' },
    ],
    MENU_PLANLAMA: [
      {
        label: '📅 Aylık menü oluştur',
        value: 'KYK projesi için Ocak 2026 menüsü oluştur, 1000 kişilik',
      },
      { label: '📋 Reçeteleri listele', value: 'Tüm reçeteleri kategorilere göre listele' },
      { label: '💰 Maliyet hesapla', value: 'Seçili reçetenin maliyetini hesapla' },
      { label: '🍽️ Menü öner', value: 'Bütçeye uygun haftalık öğle menüsü öner' },
    ],
    'TÜM SİSTEM': [
      { label: '🆕 Yeni sipariş oluştur', value: "KYK için Metro'dan 100 kg süt siparişi oluştur" },
      { label: '📊 Sistem özeti', value: 'Sistem özeti göster' },
      { label: '📋 Proje harcamaları', value: 'Proje bazlı harcama raporu göster' },
      { label: '🏢 Tedarikçi analizi', value: 'En çok alım yaptığımız tedarikçileri listele' },
    ],
    GOD_MODE: [
      { label: '🔥 SQL Çalıştır', value: 'SELECT COUNT(*) FROM users sorgusunu çalıştır' },
      { label: '📁 Dosya Listele', value: 'Backend src klasöründeki tüm dosyaları listele' },
      {
        label: '🔑 Secretları Göster',
        value: 'Sistemdeki tüm API keylerini ve secretları listele',
      },
      { label: '⚡ Shell Komutu', value: 'df -h komutu ile disk kullanımını göster' },
    ],
  };

  // Şablona göre önerilen sorular
  const templateQuestions: { [key: string]: string[] } = {
    default: [
      '📊 Bu ay KYK için ne kadar harcama yapıldı?',
      '📦 Bekleyen siparişler hangileri?',
      '🏆 En çok alım yaptığımız tedarikçi kim?',
      '📋 Yaklaşan ihaleler neler?',
    ],
    'cfo-analiz': [
      '📈 Aylık gelir-gider karşılaştırması yap',
      '💰 Nakit akış durumunu analiz et',
      '📊 Karlılık oranlarını hesapla',
      '🔮 Önümüzdeki 3 ay için bütçe tahmini yap',
    ],
    'risk-uzman': [
      '⚠️ Vadesi geçen alacakları listele',
      '🔴 Kritik stok seviyesindeki ürünler hangileri?',
      '💳 Ödenmemiş faturaları risk sırasına göre göster',
      '📉 Mali risk analizi yap',
    ],
    'ihale-uzman': [
      '📋 Yaklaşan ihale son başvuru tarihlerini listele',
      '🎯 Kazanma şansı yüksek ihaleleri analiz et',
      '📊 İhale başarı oranımızı hesapla',
      '🏢 Rakip firma analizi yap',
    ],
    'hizli-yanit': [
      '💰 Toplam borç ne kadar?',
      '📦 Stok durumu?',
      '👥 Personel sayısı?',
      '📈 Bugünkü satışlar?',
    ],
    'god-mode': [
      '🔥 Veritabanındaki tüm tabloları listele',
      '⚡ SELECT * FROM users LIMIT 10 sorgusunu çalıştır',
      '📁 Backend klasöründeki dosyaları listele',
      '🔑 Sistemdeki tüm secret ve API keylerini göster',
    ],
    'strateji-danismani': [
      '🎯 SWOT analizi yap',
      '📊 Pazar payı değerlendirmesi',
      '🚀 Büyüme fırsatlarını belirle',
      '📋 Yıllık hedef takibi',
    ],
  };

  // Seçili şablona göre önerileri al - God Mode aktifse özel sorular
  const suggestedQuestions = godModeEnabled
    ? templateQuestions['god-mode']
    : templateQuestions[selectedTemplate] || templateQuestions.default;
  const quickCommands = godModeEnabled
    ? departmentCommands.GOD_MODE
    : departmentCommands[defaultDepartment] || departmentCommands['TÜM SİSTEM'];

  // Prompt şablonlarını yükle
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await aiAPI.getTemplates();
        const rawTemplates =
          res.data?.templates ?? (res as { templates?: PromptTemplate[] }).templates;
        if (rawTemplates?.length) {
          // API'den gelen template'leri PromptTemplate formatına dönüştür
          const templates: PromptTemplate[] = rawTemplates.map((t) => {
            const tmpl = t as unknown as Record<string, unknown>;
            return {
              id: t.id,
              slug: (tmpl.slug as string) || `template-${t.id}`,
              name: t.name,
              description: t.description || '',
              category: t.category || 'general',
              icon: (tmpl.icon as string) || 'robot',
              color: (tmpl.color as string) || 'blue',
              is_active: (tmpl.is_active as boolean) ?? true,
            };
          });
          const activeTemplates = templates.filter((t) => t.is_active);
          setPromptTemplates(activeTemplates);
        }
      } catch (_error) {
        // Template yükleme hatası - sessizce geç
      }
    };

    fetchTemplates();
  }, []);

  // Mesajları scroll et
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Seçili şablonun bilgilerini al
  const currentTemplate =
    promptTemplates.find((t) => t.slug === selectedTemplate) || promptTemplates[0];

  // Feedback gönder
  const sendFeedback = async (
    messageId: string,
    messageContent: string,
    aiResponse: string,
    isPositive: boolean
  ) => {
    if (feedbackGiven.has(messageId)) return;

    try {
      await aiAPI.sendFeedback({
        rating: isPositive ? 5 : 1,
        feedbackType: isPositive ? 'helpful' : 'not_helpful',
        messageContent,
        aiResponse,
        templateSlug: selectedTemplate,
      });

      setFeedbackGiven((prev) => new Set([...prev, messageId]));

      notifications.show({
        title: isPositive ? '👍 Teşekkürler!' : '👎 Geri bildirim alındı',
        message: isPositive
          ? 'Olumlu geri bildiriminiz kaydedildi'
          : 'İyileştirme için çalışacağız',
        color: isPositive ? 'green' : 'orange',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const handleSendMessage = async (overrideContent?: string) => {
    const content = (overrideContent ?? inputValue).trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideContent) setInputValue('');
    setIsLoading(true);

    try {
      // Mesaj geçmişini hazırla (son 10 mesaj)
      const history = messages.slice(-10).map((m) => ({
        role: (m.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      const messageData = {
        message: content,
        history,
        sessionId,
        department: defaultDepartment,
        templateSlug: selectedTemplate,
        pageContext: pageContext,
      };

      // God Mode veya normal Agent endpoint'i kullan
      type AgentResult = {
        success: boolean;
        response?: string;
        toolsUsed?: string[];
        iterations?: number;
        godMode?: boolean;
        error?: string;
        message?: string;
      };
      let data: AgentResult;
      try {
        data =
          godModeEnabled && isSuperAdmin
            ? await aiAPI.sendGodModeMessage(messageData)
            : await aiAPI.sendAgentMessage(messageData);
      } catch (error: unknown) {
        console.error('[AIChat] API çağrısı hatası:', error);
        const err = error as {
          response?: { data?: { error?: string }; status?: number };
          message?: string;
        };
        const errorMessage = err?.response?.data?.error || err?.message || 'API hatası';
        const statusCode = err?.response?.status;
        throw new Error(
          statusCode === 404
            ? `Endpoint bulunamadı (404). Backend çalışıyor mu? Endpoint: ${godModeEnabled ? '/api/ai/god-mode/execute' : '/api/ai/agent'}`
            : statusCode === 401
              ? 'Yetkilendirme hatası (401). Lütfen tekrar giriş yapın.'
              : statusCode === 403
                ? 'Yetki hatası (403). Bu işlem için Super Admin yetkisi gerekli.'
                : errorMessage
        );
      }

      if (!data.success) {
        console.error('[AIChat] API response başarısız:', {
          success: data.success,
          error: data.error,
          message: data.message,
          data,
          endpoint: godModeEnabled ? '/api/ai/god-mode/execute' : '/api/ai/agent',
          godMode: godModeEnabled,
        });

        const errorMessage = data.error || data.message || 'API hatası';
        throw new Error(
          errorMessage.includes('Endpoint') ? errorMessage : `API hatası: ${errorMessage}`
        );
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.response ?? '',
        timestamp: new Date(),
        toolsUsed: data.toolsUsed ?? [],
        iterations: data.iterations,
        godMode: godModeEnabled && data.godMode,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Şablon kullanım sayacını artır
      if (selectedTemplate && selectedTemplate !== 'default') {
        aiAPI.incrementTemplateUsage(selectedTemplate).catch(() => {});
      }
    } catch (error) {
      console.error('AI API Error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `Üzgünüm, bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}\n\nLütfen tekrar deneyin.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Toolbar'dan gelen ilk mesajı otomatik gönder (tek seferlik)
  const initialMessageConsumedRef = useRef(false);
  useEffect(() => {
    if (!initialMessage) {
      initialMessageConsumedRef.current = false;
      return;
    }
    if (!initialMessage.trim() || initialMessageConsumedRef.current) return;
    initialMessageConsumedRef.current = true;
    onInitialMessageConsumed?.();
    handleSendMessage(initialMessage.trim());
  }, [initialMessage]);

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const toggleExpanded = (id: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Şablonları kategoriye göre grupla
  const templatesByCategory = promptTemplates.reduce(
    (acc, t) => {
      const category = t.category || 'Genel';
      if (!acc[category]) acc[category] = [];
      acc[category].push(t);
      return acc;
    },
    {} as Record<string, PromptTemplate[]>
  );

  // Kategori renkleri
  const categoryColors: Record<string, string> = {
    Genel: 'blue',
    Muhasebe: 'green',
    İhale: 'violet',
    Operasyon: 'orange',
    İK: 'indigo',
    Risk: 'red',
    Strateji: 'cyan',
    Yazışma: 'grape',
  };

  // Template seçim popover state
  const [templatePopoverOpened, setTemplatePopoverOpened] = useState(false);

  if (compact) {
    return (
      <Box
        h="100%"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden', // Önemli: taşmayı engeller
        }}
      >
        {/* Compact Header - dark klasik */}
        <Box
          p="xs"
          style={{
            borderBottom: isDark
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid var(--mantine-color-gray-3)',
            flexShrink: 0,
            background: isDark ? 'rgba(0,0,0,0.2)' : undefined,
          }}
        >
          <Group gap="xs" justify="space-between">
            <Group gap="xs">
              <IconBrain size={16} color={isDark ? 'gray.4' : 'var(--mantine-color-violet-6)'} />
              <Text size="xs" fw={500} c={isDark ? 'gray.4' : undefined}>
                AI Agent
              </Text>
            </Group>
            <Popover
              opened={templatePopoverOpened}
              onChange={setTemplatePopoverOpened}
              position="bottom-end"
              shadow="lg"
              radius="md"
              withinPortal
              zIndex={10000}
            >
              <Popover.Target>
                <UnstyledButton
                  onClick={() => setTemplatePopoverOpened((o) => !o)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--mantine-color-gray-0)',
                    border: isDark
                      ? '1px solid rgba(255,255,255,0.12)'
                      : '1px solid var(--mantine-color-gray-3)',
                    fontSize: 12,
                  }}
                >
                  <Text size="md">{currentTemplate?.icon || '🤖'}</Text>
                  <Text
                    size="xs"
                    fw={500}
                    style={{
                      maxWidth: 80,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentTemplate?.name?.replace(
                      /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u,
                      ''
                    ) || 'Şablon'}
                  </Text>
                  <IconChevronDown size={12} style={{ opacity: 0.5 }} />
                </UnstyledButton>
              </Popover.Target>
              <Popover.Dropdown p="sm" style={{ maxHeight: 400, overflowY: 'auto' }}>
                <Text size="xs" fw={600} c="dimmed" mb="xs">
                  Şablon Seçin
                </Text>
                <Stack gap="xs">
                  {Object.entries(templatesByCategory).map(([category, templates]) => (
                    <Box key={category}>
                      <Text size="xs" fw={600} c={categoryColors[category] || 'gray'} mb={4}>
                        {category}
                      </Text>
                      <Stack gap={4}>
                        {templates.map((t) => (
                          <UnstyledButton
                            key={t.slug}
                            onClick={() => {
                              setSelectedTemplate(t.slug);
                              setTemplatePopoverOpened(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 8px',
                              borderRadius: 6,
                              background:
                                selectedTemplate === t.slug
                                  ? 'var(--mantine-color-violet-0)'
                                  : 'transparent',
                              border:
                                selectedTemplate === t.slug
                                  ? '1px solid var(--mantine-color-violet-3)'
                                  : '1px solid transparent',
                            }}
                          >
                            <Text size="lg">{t.icon}</Text>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text size="xs" fw={500}>
                                {t.name.replace(
                                  /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u,
                                  ''
                                )}
                              </Text>
                            </div>
                            {selectedTemplate === t.slug && (
                              <IconCheck size={14} color="var(--mantine-color-violet-6)" />
                            )}
                          </UnstyledButton>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Box>

        {/* Messages Area - Scroll edilebilir alan */}
        <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ScrollArea
            h="100%"
            type="always"
            scrollbarSize={8}
            offsetScrollbars
            styles={{
              root: { height: '100%' },
              viewport: {
                height: '100%',
                // Mobilde touch scroll için
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
              },
            }}
          >
            <Stack gap="sm" p="sm">
              {messages.length === 0 ? (
                <Stack gap="sm" align="center" py="md">
                  <Text size="sm" c={isDark ? 'gray.4' : 'dimmed'} ta="center">
                    Merhaba! 👋 Size nasıl yardımcı olabilirim?
                  </Text>
                  <Stack gap={4} w="100%">
                    {suggestedQuestions.slice(0, 4).map((question) => (
                      <Paper
                        key={question}
                        p="xs"
                        radius="sm"
                        withBorder={!isDark}
                        style={{
                          cursor: 'pointer',
                          fontSize: '12px',
                          ...(isDark && {
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }),
                        }}
                        onClick={() => handleSuggestedQuestion(question)}
                      >
                        <Text size="xs" c={isDark ? 'gray.3' : undefined}>
                          {question}
                        </Text>
                      </Paper>
                    ))}
                  </Stack>
                </Stack>
              ) : (
                messages.map((message) => (
                  <Group key={message.id} align="flex-start" gap="xs" wrap="nowrap">
                    <Avatar
                      size="sm"
                      color={message.type === 'user' ? 'blue' : 'violet'}
                      radius="xl"
                    >
                      {message.type === 'user' ? <IconUser size={14} /> : <IconRobot size={14} />}
                    </Avatar>
                    <Paper
                      p="xs"
                      bg={message.type === 'user' ? 'blue.0' : 'gray.0'}
                      radius="md"
                      style={{
                        flex: 1,
                        maxWidth: 'calc(100% - 40px)',
                        ...(isDark && {
                          background:
                            message.type === 'user'
                              ? 'rgba(59, 130, 246, 0.2)'
                              : 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }),
                      }}
                    >
                      <Text
                        size="xs"
                        c={isDark ? 'gray.3' : undefined}
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                      >
                        {message.content}
                      </Text>
                      {message.toolsUsed && message.toolsUsed.length > 0 && (
                        <Group gap={4} mt={4}>
                          {message.toolsUsed.slice(0, 3).map((tool) => (
                            <Badge key={tool} size="xs" variant="dot" color="violet">
                              {tool.split('_').slice(0, 2).join(' ')}
                            </Badge>
                          ))}
                          {message.toolsUsed.length > 3 && (
                            <Badge size="xs" variant="light" color="gray">
                              +{message.toolsUsed.length - 3}
                            </Badge>
                          )}
                        </Group>
                      )}
                    </Paper>
                  </Group>
                ))
              )}
              {isLoading && (
                <Group gap="xs">
                  <Avatar size="sm" color="violet" radius="xl">
                    <IconRobot size={14} />
                  </Avatar>
                  <Paper p="xs" radius="md" className="nested-card">
                    <Group gap="xs">
                      <Loader size="xs" color="violet" />
                      <Text size="xs" c={isDark ? 'gray.4' : 'dimmed'}>
                        Düşünüyor...
                      </Text>
                    </Group>
                  </Paper>
                </Group>
              )}
              <div ref={messagesEndRef} />
            </Stack>
          </ScrollArea>
        </Box>

        {/* Input Area - dark klasik */}
        <Box
          p="sm"
          style={{
            borderTop: isDark
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid var(--mantine-color-gray-3)',
            paddingBottom: 'env(safe-area-inset-bottom, 8px)',
            flexShrink: 0,
            background: isDark ? 'rgba(0,0,0,0.2)' : undefined,
          }}
        >
          <Group gap="xs">
            <TextInput
              flex={1}
              placeholder="Mesaj yazın..."
              value={inputValue}
              onChange={(e) => setInputValue(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              size="md"
              radius="xl"
              styles={{
                input: {
                  paddingLeft: 16,
                  paddingRight: 16,
                  minHeight: 44,
                  ...(isDark && {
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.9)',
                  }),
                },
              }}
            />
            <ActionIcon
              size={44}
              radius="xl"
              variant={isDark ? 'filled' : 'gradient'}
              color={isDark ? 'dark.4' : undefined}
              gradient={!isDark ? { from: 'violet', to: 'grape' } : undefined}
              onClick={() => handleSendMessage()}
              loading={isLoading}
              disabled={!inputValue.trim()}
              style={{
                minWidth: 44,
                minHeight: 44,
                ...(isDark && { background: 'rgba(255,255,255,0.12)', color: 'white' }),
              }}
            >
              <IconSend size={16} />
            </ActionIcon>
          </Group>
        </Box>
      </Box>
    );
  }

  return (
    <Paper
      p="md"
      radius="md"
      withBorder
      style={{
        height: 'calc(100vh - 280px)',
        minHeight: 450,
        maxWidth: 900,
        margin: '0 auto',
        // God Mode aktifken dramatik stil değişikliği
        background: godModeEnabled
          ? 'linear-gradient(135deg, rgba(255, 71, 87, 0.08) 0%, rgba(238, 90, 36, 0.08) 100%)'
          : undefined,
        borderColor: godModeEnabled ? 'rgba(255, 71, 87, 0.5)' : undefined,
        borderWidth: godModeEnabled ? 2 : 1,
        boxShadow: godModeEnabled
          ? '0 0 30px rgba(255, 71, 87, 0.2), inset 0 0 60px rgba(255, 71, 87, 0.05)'
          : undefined,
        transition: 'all 0.4s ease',
      }}
    >
      <Stack gap="sm" h="100%">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon
              size="lg"
              color={godModeEnabled ? 'red' : 'violet'}
              variant="gradient"
              gradient={
                godModeEnabled ? { from: 'red', to: 'orange' } : { from: 'violet', to: 'purple' }
              }
              style={{
                boxShadow: godModeEnabled ? '0 0 20px rgba(255, 71, 87, 0.5)' : undefined,
                transition: 'all 0.3s ease',
              }}
            >
              <IconBrain size={20} />
            </ThemeIcon>
            <div>
              <Text
                size="lg"
                fw={600}
                style={{ color: godModeEnabled ? '#ff4757' : undefined, transition: 'color 0.3s' }}
              >
                {godModeEnabled ? '🔥 GOD MODE AI' : '🤖 AI Agent'}
              </Text>
              <Text
                size="xs"
                c={godModeEnabled ? 'orange' : 'dimmed'}
                style={{ transition: 'color 0.3s' }}
              >
                {godModeEnabled
                  ? 'Sınırsız yetki aktif - Dikkatli kullan!'
                  : 'Tüm sisteme erişebilen akıllı asistan'}
              </Text>
            </div>
          </Group>

          <Group gap="sm">
            {/* God Mode + Şablon: aynı yükseklik ve stil */}
            {isSuperAdmin && (
              <Tooltip
                label={
                  godModeEnabled
                    ? 'God Mode Aktif - Sınırsız yetki!'
                    : 'God Mode - Tüm sisteme tam erişim'
                }
                position="bottom"
              >
                <UnstyledButton
                  onClick={() => setGodModeEnabled(!godModeEnabled)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 40,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: godModeEnabled
                      ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'
                      : 'var(--mantine-color-gray-0)',
                    border: godModeEnabled
                      ? '2px solid #ff4757'
                      : '1px solid var(--mantine-color-gray-3)',
                    transition: 'all 0.3s',
                    boxShadow: godModeEnabled ? '0 0 20px rgba(255, 71, 87, 0.4)' : 'none',
                  }}
                >
                  <IconFlame
                    size={18}
                    color={godModeEnabled ? 'white' : '#666'}
                    style={{
                      animation: godModeEnabled ? 'pulse 1s infinite' : 'none',
                    }}
                  />
                  <Text size="sm" fw={600} c={godModeEnabled ? 'white' : 'dark'}>
                    {godModeEnabled ? '🔥 GOD MODE' : 'God Mode'}
                  </Text>
                  {godModeEnabled && (
                    <Badge size="xs" color="yellow" variant="filled">
                      ADMIN
                    </Badge>
                  )}
                </UnstyledButton>
              </Tooltip>
            )}

            {/* Şablon Seçici - God Mode ile aynı yükseklik/stil */}
            <Popover
              opened={templatePopoverOpened}
              onChange={setTemplatePopoverOpened}
              position="bottom-end"
              shadow="xl"
              radius="md"
              width={340}
            >
              <Popover.Target>
                <UnstyledButton
                  onClick={() => setTemplatePopoverOpened((o) => !o)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 40,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'var(--mantine-color-gray-0)',
                    border: '1px solid var(--mantine-color-gray-3)',
                    transition: 'all 0.2s',
                  }}
                >
                  <Text size="lg" style={{ lineHeight: 1 }}>
                    {currentTemplate?.icon || '🤖'}
                  </Text>
                  <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {currentTemplate?.name?.replace(
                        /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u,
                        ''
                      ) || 'Şablon Seç'}
                    </Text>
                    <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
                      {currentTemplate?.category || 'Genel'}
                    </Badge>
                  </Group>
                  <IconChevronDown size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
                </UnstyledButton>
              </Popover.Target>
              <Popover.Dropdown p="md" style={{ maxHeight: 450, overflowY: 'auto' }}>
                <Text size="sm" fw={600} mb="sm">
                  🎯 Şablon Seçin
                </Text>
                <Stack gap="md">
                  {Object.entries(templatesByCategory).map(([category, templates]) => (
                    <Box key={category}>
                      <Group gap="xs" mb="xs">
                        <Badge size="xs" color={categoryColors[category] || 'gray'} variant="light">
                          {category}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {templates.length} şablon
                        </Text>
                      </Group>
                      <SimpleGrid cols={1} spacing="xs">
                        {templates.map((t) => (
                          <UnstyledButton
                            key={t.slug}
                            onClick={() => {
                              setSelectedTemplate(t.slug);
                              setTemplatePopoverOpened(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 12px',
                              borderRadius: 8,
                              background:
                                selectedTemplate === t.slug
                                  ? `var(--mantine-color-${categoryColors[category] || 'violet'}-0)`
                                  : 'var(--mantine-color-gray-0)',
                              border:
                                selectedTemplate === t.slug
                                  ? `2px solid var(--mantine-color-${categoryColors[category] || 'violet'}-4)`
                                  : '1px solid var(--mantine-color-gray-2)',
                              transition: 'all 0.15s',
                            }}
                          >
                            <Text size="xl">{t.icon}</Text>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" fw={500}>
                                {t.name.replace(
                                  /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u,
                                  ''
                                )}
                              </Text>
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {t.description}
                              </Text>
                            </div>
                            {selectedTemplate === t.slug && (
                              <ThemeIcon
                                size="sm"
                                radius="xl"
                                color={categoryColors[category] || 'violet'}
                              >
                                <IconCheck size={12} />
                              </ThemeIcon>
                            )}
                          </UnstyledButton>
                        ))}
                      </SimpleGrid>
                    </Box>
                  ))}
                </Stack>
              </Popover.Dropdown>
            </Popover>

            <Tooltip label="Sohbet Geçmişi">
              <ActionIcon variant="subtle" color="violet" component="a" href="/ai-chat/history">
                <IconHistory size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="AI Ayarları">
              <ActionIcon variant="subtle" color="gray" component="a" href="/ayarlar/ai">
                <IconSettings size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Sohbeti Temizle">
              <ActionIcon variant="subtle" color="red" onClick={clearChat}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Seçili şablon bilgisi */}
        {currentTemplate && selectedTemplate !== 'default' && (
          <Paper p="xs" bg="violet.0" radius="sm">
            <Group gap="xs">
              <Text size="lg">{currentTemplate.icon}</Text>
              <div>
                <Text size="sm" fw={500}>
                  {currentTemplate.name.replace(
                    /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u,
                    ''
                  )}
                </Text>
                <Text size="xs" c="dimmed">
                  {currentTemplate.description}
                </Text>
              </div>
            </Group>
          </Paper>
        )}

        <Divider />

        {/* Messages */}
        <ScrollArea
          flex={1}
          type="scroll"
          scrollbarSize={8}
          offsetScrollbars
          styles={{
            viewport: {
              // Mobilde touch scroll için
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            },
          }}
        >
          <Stack gap="sm" p="xs">
            {messages.length === 0 ? (
              <Stack gap="md" align="center" py="md">
                <ThemeIcon size={50} color="violet" variant="light" radius="xl">
                  <IconSparkles size={24} />
                </ThemeIcon>
                <div style={{ textAlign: 'center' }}>
                  <Text size="lg" fw={600} mb={2}>
                    Merhaba! Ben AI Agent 🤖
                  </Text>
                  <Text c="dimmed" size="xs" maw={400}>
                    Siparişler, cariler, faturalar, ihaleler ve raporlar. Veri sorgulayabilir ve
                    analiz yapabilirim.
                  </Text>
                </div>

                {/* Önerilen Sorular */}
                <Stack gap="xs" w="100%" maw={600}>
                  <Text size="sm" fw={500} c={godModeEnabled ? 'red.6' : 'dimmed'}>
                    {godModeEnabled ? '🔥 God Mode Komutları:' : '💡 Önerilen Sorular:'}
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    {suggestedQuestions.map((question) => (
                      <Card
                        key={question}
                        p="sm"
                        radius="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderColor: godModeEnabled ? 'rgba(255, 71, 87, 0.3)' : undefined,
                          background: godModeEnabled ? 'rgba(255, 71, 87, 0.05)' : undefined,
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => handleSuggestedQuestion(question)}
                      >
                        <Text size="sm" c={godModeEnabled ? 'red.7' : undefined}>
                          {question}
                        </Text>
                      </Card>
                    ))}
                  </SimpleGrid>
                </Stack>

                {/* Hızlı Komutlar */}
                <Stack gap="xs" w="100%" maw={600}>
                  <Text size="sm" fw={500} c={godModeEnabled ? 'orange.6' : 'dimmed'}>
                    {godModeEnabled ? '⚡ Güçlü Komutlar:' : '⚡ Hızlı Komutlar:'}
                  </Text>
                  <Group gap="xs">
                    {quickCommands.map((cmd) => (
                      <Badge
                        key={cmd.value}
                        size="lg"
                        variant={godModeEnabled ? 'gradient' : 'light'}
                        gradient={godModeEnabled ? { from: 'red', to: 'orange' } : undefined}
                        color={godModeEnabled ? undefined : 'violet'}
                        style={{
                          cursor: 'pointer',
                          boxShadow: godModeEnabled
                            ? '0 2px 10px rgba(255, 71, 87, 0.3)'
                            : undefined,
                        }}
                        onClick={() => handleSuggestedQuestion(cmd.value)}
                      >
                        {cmd.label}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
              </Stack>
            ) : (
              messages.map((message) => (
                <Group key={message.id} align="flex-start" gap="md">
                  <Avatar color={message.type === 'user' ? 'blue' : 'violet'} radius="xl">
                    {message.type === 'user' ? <IconUser size={18} /> : <IconRobot size={18} />}
                  </Avatar>

                  <Stack gap="xs" flex={1}>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {message.type === 'user' ? 'Sen' : 'AI Agent'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {message.timestamp.toLocaleTimeString('tr-TR')}
                      </Text>
                      {message.toolsUsed && message.toolsUsed.length > 0 && (
                        <Badge
                          size="xs"
                          variant="light"
                          color="violet"
                          leftSection={<IconTool size={10} />}
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleExpanded(message.id)}
                        >
                          {message.toolsUsed.length} tool kullanıldı
                          {expandedMessages.has(message.id) ? (
                            <IconChevronUp size={10} />
                          ) : (
                            <IconChevronDown size={10} />
                          )}
                        </Badge>
                      )}
                      {message.iterations && message.iterations > 1 && (
                        <Badge size="xs" variant="outline" color="gray">
                          {message.iterations} iterasyon
                        </Badge>
                      )}
                    </Group>

                    {/* Tool detayları */}
                    {message.toolsUsed && message.toolsUsed.length > 0 && (
                      <Collapse in={expandedMessages.has(message.id)}>
                        <Paper p="xs" className="nested-card" radius="sm" mb="xs">
                          <Text size="xs" fw={500} mb={4}>
                            🔧 Kullanılan Araçlar:
                          </Text>
                          <Group gap={4}>
                            {message.toolsUsed.map((tool) => (
                              <Badge
                                key={tool}
                                size="sm"
                                variant="dot"
                                color="violet"
                                leftSection={getToolIcon(tool)}
                              >
                                {getToolDisplayName(tool)}
                              </Badge>
                            ))}
                          </Group>
                        </Paper>
                      </Collapse>
                    )}

                    <Paper p="md" bg={message.type === 'user' ? 'blue.0' : 'violet.0'} radius="md">
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {message.content}
                      </Text>
                    </Paper>

                    <Group gap="xs">
                      <Tooltip label="Kopyala">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          onClick={() => copyMessage(message.content)}
                        >
                          <IconCopy size={12} />
                        </ActionIcon>
                      </Tooltip>

                      {/* Feedback butonları - sadece AI mesajlarında */}
                      {message.type === 'ai' && !feedbackGiven.has(message.id) && (
                        <>
                          <Tooltip label="Yardımcı oldu">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="green"
                              onClick={() => {
                                const userMsg = messages.find(
                                  (m, idx) =>
                                    m.type === 'user' && messages[idx + 1]?.id === message.id
                                );
                                sendFeedback(
                                  message.id,
                                  userMsg?.content || '',
                                  message.content,
                                  true
                                );
                              }}
                            >
                              <IconThumbUp size={12} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Yardımcı olmadı">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={() => {
                                const userMsg = messages.find(
                                  (m, idx) =>
                                    m.type === 'user' && messages[idx + 1]?.id === message.id
                                );
                                sendFeedback(
                                  message.id,
                                  userMsg?.content || '',
                                  message.content,
                                  false
                                );
                              }}
                            >
                              <IconThumbDown size={12} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}

                      {/* Feedback verildi göstergesi */}
                      {message.type === 'ai' && feedbackGiven.has(message.id) && (
                        <Badge
                          size="xs"
                          variant="light"
                          color="gray"
                          leftSection={<IconCheck size={10} />}
                        >
                          Geri bildirim verildi
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Group>
              ))
            )}

            {isLoading && (
              <Group gap="md">
                <Avatar color="violet" radius="xl">
                  <IconRobot size={18} />
                </Avatar>
                <Paper p="md" bg="violet.0" radius="md" flex={1}>
                  <Group gap="xs">
                    <Loader size="sm" color="violet" />
                    <Text size="sm" c="dimmed">
                      AI Agent çalışıyor... Verilere erişiliyor...
                    </Text>
                  </Group>
                </Paper>
              </Group>
            )}

            <div ref={messagesEndRef} />
          </Stack>
        </ScrollArea>

        {/* Input */}
        <Group gap="xs">
          <TextInput
            flex={1}
            placeholder={
              godModeEnabled
                ? '🔥 God Mode: SQL, dosya, shell, kod çalıştır...'
                : 'Soru sorun, komut verin veya işlem yaptırın...'
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading}
            size="md"
            styles={{
              input: godModeEnabled
                ? {
                    borderColor: 'rgba(255, 71, 87, 0.4)',
                    backgroundColor: 'rgba(255, 71, 87, 0.05)',
                    '&:focus': {
                      borderColor: '#ff4757',
                    },
                  }
                : undefined,
            }}
          />
          <Button
            variant={godModeEnabled ? 'gradient' : 'filled'}
            gradient={godModeEnabled ? { from: 'red', to: 'orange' } : undefined}
            color={godModeEnabled ? undefined : 'violet'}
            onClick={() => handleSendMessage()}
            loading={isLoading}
            style={godModeEnabled ? { boxShadow: '0 0 15px rgba(255, 71, 87, 0.4)' } : undefined}
            disabled={!inputValue.trim()}
            leftSection={<IconSend size={16} />}
            size="md"
          >
            Gönder
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
