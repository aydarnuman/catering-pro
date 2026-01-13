'use client';

import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/config';
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  TextInput,
  Select,
  Badge,
  ActionIcon,
  ScrollArea,
  Avatar,
  Loader,
  Divider,
  SimpleGrid,
  Card,
  ThemeIcon,
  Tooltip,
  Collapse,
  Box
} from '@mantine/core';
import {
  IconRobot,
  IconUser,
  IconSend,
  IconSettings,
  IconRefresh,
  IconCopy,
  IconBrain,
  IconSparkles,
  IconTool,
  IconChevronDown,
  IconChevronUp,
  IconDatabase,
  IconFileInvoice,
  IconUsers,
  IconClipboardList,
  IconChartBar,
  IconThumbUp,
  IconThumbDown,
  IconCheck
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

const API_URL = `${API_BASE_URL}/api`;

// Tip tanımları
interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  iterations?: number;
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

interface AIChatProps {
  defaultDepartment?: string;
  compact?: boolean;
}

// Tool ikon mapping
const toolIcons: Record<string, React.ReactNode> = {
  'satin_alma': <IconClipboardList size={12} />,
  'cari': <IconUsers size={12} />,
  'fatura': <IconFileInvoice size={12} />,
  'ihale': <IconDatabase size={12} />,
  'rapor': <IconChartBar size={12} />
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
    'satin_alma': 'Satın Alma',
    'cari': 'Cariler',
    'fatura': 'Faturalar',
    'ihale': 'İhaleler',
    'rapor': 'Raporlar'
  };
  
  return `${moduleNames[module] || module}: ${action}`;
};

export function AIChat({ defaultDepartment = 'TÜM SİSTEM', compact = false }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('default');
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set()); // Feedback verilen mesajlar
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const departmentQuestions: Record<string, string[]> = {
    'PERSONEL': [
      '👥 Toplam personel maliyetimiz ne kadar?',
      '💰 40.000 TL net maaşın brüt ve toplam maliyeti ne?',
      '📊 Bu ay izinli kaç kişi var?',
      '🧮 Ahmet\'in kıdem tazminatını hesapla',
      '📋 Aktif personelleri listele',
      '💵 Ocak ayı bordro özeti göster'
    ],
    'MENU_PLANLAMA': [
      '📅 Ocak ayı için KYK menüsü hazırla',
      '🍲 Mevcut reçeteleri listele',
      '💰 Mercimek çorbası maliyetini hesapla',
      '🥗 Düşük kalorili haftalık menü öner',
      '📊 9 Ocak menüsünü göster',
      '👨‍🍳 Tavuk sote reçetesi oluştur'
    ],
    'TÜM SİSTEM': [
    '📊 Bu ay KYK için ne kadar harcama yapıldı?',
    '📦 Bekleyen siparişler hangileri?',
    '💰 En çok alım yaptığımız tedarikçi kim?',
    '📅 Yaklaşan ihaleler neler?',
    '⚠️ Kritik uyarılar var mı?',
    '📈 Geçen ayla karşılaştırma yap'
    ]
  };

  // Departmana göre hızlı komutlar
  const departmentCommands: Record<string, Array<{label: string; value: string}>> = {
    'PERSONEL': [
      { label: '👥 Personel istatistikleri', value: 'Personel istatistiklerini göster' },
      { label: '💰 Bordro hesapla', value: 'Tüm personelin bordrosunu hesapla' },
      { label: '📅 İzin bakiyesi', value: 'Personellerin izin bakiyelerini listele' },
      { label: '🧮 Maliyet analizi', value: 'Toplam personel maliyeti analizi yap' }
    ],
    'MENU_PLANLAMA': [
      { label: '📅 Aylık menü oluştur', value: 'KYK projesi için Ocak 2026 menüsü oluştur, 1000 kişilik' },
      { label: '📋 Reçeteleri listele', value: 'Tüm reçeteleri kategorilere göre listele' },
      { label: '💰 Maliyet hesapla', value: 'Seçili reçetenin maliyetini hesapla' },
      { label: '🍽️ Menü öner', value: 'Bütçeye uygun haftalık öğle menüsü öner' }
    ],
    'TÜM SİSTEM': [
    { label: '🆕 Yeni sipariş oluştur', value: 'KYK için Metro\'dan 100 kg süt siparişi oluştur' },
    { label: '📊 Sistem özeti', value: 'Sistem özeti göster' },
    { label: '📋 Proje harcamaları', value: 'Proje bazlı harcama raporu göster' },
    { label: '🏢 Tedarikçi analizi', value: 'En çok alım yaptığımız tedarikçileri listele' }
    ]
  };

  // Şablona göre önerilen sorular
  const templateQuestions: { [key: string]: string[] } = {
    'default': [
      '📊 Bu ay KYK için ne kadar harcama yapıldı?',
      '📦 Bekleyen siparişler hangileri?',
      '🏆 En çok alım yaptığımız tedarikçi kim?',
      '📋 Yaklaşan ihaleler neler?'
    ],
    'cfo-analiz': [
      '📈 Aylık gelir-gider karşılaştırması yap',
      '💰 Nakit akış durumunu analiz et',
      '📊 Karlılık oranlarını hesapla',
      '🔮 Önümüzdeki 3 ay için bütçe tahmini yap'
    ],
    'risk-uzman': [
      '⚠️ Vadesi geçen alacakları listele',
      '🔴 Kritik stok seviyesindeki ürünler hangileri?',
      '💳 Ödenmemiş faturaları risk sırasına göre göster',
      '📉 Mali risk analizi yap'
    ],
    'ihale-uzman': [
      '📋 Yaklaşan ihale son başvuru tarihlerini listele',
      '🎯 Kazanma şansı yüksek ihaleleri analiz et',
      '📊 İhale başarı oranımızı hesapla',
      '🏢 Rakip firma analizi yap'
    ],
    'hizli-yanit': [
      '💰 Toplam borç ne kadar?',
      '📦 Stok durumu?',
      '👥 Personel sayısı?',
      '📈 Bugünkü satışlar?'
    ],
    'strateji-danismani': [
      '🎯 SWOT analizi yap',
      '📊 Pazar payı değerlendirmesi',
      '🚀 Büyüme fırsatlarını belirle',
      '📋 Yıllık hedef takibi'
    ]
  };

  // Seçili şablona göre önerileri al
  const suggestedQuestions = templateQuestions[selectedTemplate] || templateQuestions['default'];
  const quickCommands = departmentCommands[defaultDepartment] || departmentCommands['TÜM SİSTEM'];

  // Prompt şablonlarını yükle
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        console.log('🔄 Fetching templates from:', `${API_URL}/ai/templates`);
        const response = await fetch(`${API_URL}/ai/templates`);
        const data = await response.json();
        
        console.log('📦 Templates response:', data);
        
        if (data.success && data.templates) {
          const activeTemplates = data.templates.filter((t: PromptTemplate) => t.is_active);
          console.log('✅ Active templates:', activeTemplates.length, activeTemplates);
          setPromptTemplates(activeTemplates);
        }
      } catch (error) {
        console.error('❌ Failed to fetch templates:', error);
      }
    };

    fetchTemplates();
  }, []);

  // Mesajları scroll et
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Seçili şablonun bilgilerini al
  const currentTemplate = promptTemplates.find(t => t.slug === selectedTemplate) || promptTemplates[0];

  // Feedback gönder
  const sendFeedback = async (messageId: string, messageContent: string, aiResponse: string, isPositive: boolean) => {
    if (feedbackGiven.has(messageId)) return;
    
    try {
      await fetch(`${API_URL}/ai/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: isPositive ? 5 : 1,
          feedbackType: isPositive ? 'helpful' : 'not_helpful',
          messageContent,
          aiResponse,
          templateSlug: selectedTemplate
        })
      });
      
      setFeedbackGiven(prev => new Set([...prev, messageId]));
      
      notifications.show({
        title: isPositive ? '👍 Teşekkürler!' : '👎 Geri bildirim alındı',
        message: isPositive ? 'Olumlu geri bildiriminiz kaydedildi' : 'İyileştirme için çalışacağız',
        color: isPositive ? 'green' : 'orange',
        icon: <IconCheck size={16} />
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Mesaj geçmişini hazırla (son 10 mesaj)
      const history = messages.slice(-10).map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      // AI Agent endpoint'i kullan - şablon bilgisi ile
      const response = await fetch(`${API_URL}/ai/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history,
          sessionId,
          department: defaultDepartment,
          templateSlug: selectedTemplate  // Şablon slug'ı gönder
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'API hatası');
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.response,
        timestamp: new Date(),
        toolsUsed: data.toolsUsed || [],
        iterations: data.iterations
      };

      setMessages(prev => [...prev, aiMessage]);

      // Şablon kullanım sayacını artır
      if (selectedTemplate && selectedTemplate !== 'default') {
        fetch(`${API_URL}/ai/templates/${selectedTemplate}/increment-usage`, { method: 'POST' }).catch(() => {});
      }

    } catch (error) {
      console.error('AI API Error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `Üzgünüm, bir hata oluştu: ${(error instanceof Error) ? error.message : 'Bilinmeyen hata'}\n\nLütfen tekrar deneyin.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

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
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Şablon seçici - Select data formatı
  const templateSelectData = promptTemplates.map(t => ({
    value: t.slug,
    label: `${t.icon} ${t.name.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '')}`
  }));

  if (compact) {
    return (
      <Stack gap={0} h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Compact Header with Template Select */}
        <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <Group gap="xs" justify="space-between">
            <Group gap="xs">
              <IconBrain size={16} color="var(--mantine-color-violet-6)" />
              <Text size="xs" fw={500}>AI Agent</Text>
            </Group>
            <Select
              data={templateSelectData}
              value={selectedTemplate}
              onChange={(value) => setSelectedTemplate(value || 'default')}
              size="xs"
              w={130}
              placeholder="Şablon"
              styles={{ input: { fontSize: 11 } }}
              comboboxProps={{ withinPortal: true, zIndex: 10000 }}
            />
          </Group>
        </Box>

        {/* Messages Area */}
        <ScrollArea flex={1} p="sm" style={{ minHeight: 0 }}>
          <Stack gap="sm">
            {messages.length === 0 ? (
              <Stack gap="sm" align="center" py="md">
                <Text size="sm" c="dimmed" ta="center">
                  Merhaba! 👋 Size nasıl yardımcı olabilirim?
                </Text>
                <Stack gap={4} w="100%">
                  {suggestedQuestions.slice(0, 4).map((question, index) => (
                    <Paper 
                      key={index} 
                      p="xs" 
                      radius="sm" 
                      withBorder 
                      style={{ cursor: 'pointer', fontSize: '12px' }}
                      onClick={() => handleSuggestedQuestion(question)}
                    >
                      <Text size="xs">{question}</Text>
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            ) : (
              messages.map((message) => (
                <Group key={message.id} align="flex-start" gap="xs" wrap="nowrap">
                  <Avatar size="sm" color={message.type === 'user' ? 'blue' : 'violet'} radius="xl">
                    {message.type === 'user' ? <IconUser size={14} /> : <IconRobot size={14} />}
                  </Avatar>
                  <Paper 
                    p="xs" 
                    bg={message.type === 'user' ? 'blue.0' : 'gray.0'} 
                    radius="md" 
                    style={{ flex: 1, maxWidth: 'calc(100% - 40px)' }}
                  >
                    <Text size="xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {message.content}
                    </Text>
                    {message.toolsUsed && message.toolsUsed.length > 0 && (
                      <Group gap={4} mt={4}>
                        {message.toolsUsed.slice(0, 3).map((tool, i) => (
                          <Badge key={i} size="xs" variant="dot" color="violet">
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
                <Paper p="xs" bg="gray.0" radius="md">
                  <Group gap="xs">
                    <Loader size="xs" color="violet" />
                    <Text size="xs" c="dimmed">Düşünüyor...</Text>
            </Group>
                </Paper>
          </Group>
            )}
            <div ref={messagesEndRef} />
          </Stack>
        </ScrollArea>

        {/* Input Area */}
        <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Group gap="xs">
            <TextInput
              flex={1}
              placeholder="Mesaj yazın..."
              value={inputValue}
              onChange={(e) => setInputValue(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              size="sm"
              radius="xl"
              styles={{
                input: {
                  paddingLeft: 16,
                  paddingRight: 16,
                }
              }}
            />
            <ActionIcon 
              size="lg"
              radius="xl"
              variant="gradient"
              gradient={{ from: 'violet', to: 'grape' }}
              onClick={handleSendMessage}
              loading={isLoading}
              disabled={!inputValue.trim()}
            >
              <IconSend size={16} />
            </ActionIcon>
          </Group>
        </Box>
        </Stack>
    );
  }

  return (
    <Paper p="xl" radius="md" withBorder style={{ height: 'calc(100vh - 200px)', minHeight: 600 }}>
      <Stack gap="md" h="100%">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size="lg" color="violet" variant="gradient" gradient={{ from: 'violet', to: 'purple' }}>
              <IconBrain size={20} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={600}>🤖 AI Agent</Text>
              <Text size="xs" c="dimmed">Tüm sisteme erişebilen akıllı asistan</Text>
            </div>
          </Group>
          
          <Group gap="md">
            {/* Şablon Seçici */}
            <Group gap="xs">
              <Text size="xs" c="dimmed">Şablon:</Text>
              <Select
                data={templateSelectData}
                value={selectedTemplate}
                onChange={(value) => setSelectedTemplate(value || 'default')}
                size="xs"
                w={180}
                placeholder="Şablon seçin"
                leftSection={currentTemplate?.icon ? <Text size="sm">{currentTemplate.icon}</Text> : undefined}
              />
            </Group>
            
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
                <Text size="sm" fw={500}>{currentTemplate.name.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '')}</Text>
                <Text size="xs" c="dimmed">{currentTemplate.description}</Text>
              </div>
            </Group>
          </Paper>
        )}

        <Divider />

        {/* Messages */}
        <ScrollArea flex={1} type="auto">
          <Stack gap="md" p="sm">
            {messages.length === 0 ? (
              <Stack gap="lg" align="center" py="xl">
                <ThemeIcon size={80} color="violet" variant="light" radius="xl">
                  <IconSparkles size={40} />
                </ThemeIcon>
                <div style={{ textAlign: 'center' }}>
                  <Text size="xl" fw={600} mb={4}>Merhaba! Ben AI Agent 🤖</Text>
                  <Text c="dimmed" size="sm" maw={500}>
                    Tüm sisteme erişebilirim: Siparişler, cariler, faturalar, ihaleler ve raporlar.
                    Veri sorgulayabilir, yeni kayıtlar oluşturabilir ve analiz yapabilirim.
                  </Text>
                </div>

                {/* Önerilen Sorular */}
                <Stack gap="xs" w="100%" maw={600}>
                  <Text size="sm" fw={500} c="dimmed">💡 Önerilen Sorular:</Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    {suggestedQuestions.map((question, index) => (
                      <Card 
                        key={index} 
                        p="sm" 
                        radius="md" 
                        withBorder 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSuggestedQuestion(question)}
                      >
                        <Text size="sm">{question}</Text>
                      </Card>
                    ))}
                  </SimpleGrid>
                </Stack>

                {/* Hızlı Komutlar */}
                <Stack gap="xs" w="100%" maw={600}>
                  <Text size="sm" fw={500} c="dimmed">⚡ Hızlı Komutlar:</Text>
                  <Group gap="xs">
                    {quickCommands.map((cmd, index) => (
                      <Badge
                        key={index}
                        size="lg"
                        variant="light"
                        color="violet"
                        style={{ cursor: 'pointer' }}
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
                  <Avatar 
                    color={message.type === 'user' ? 'blue' : 'violet'} 
                    radius="xl"
                  >
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
                          {expandedMessages.has(message.id) ? <IconChevronUp size={10} /> : <IconChevronDown size={10} />}
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
                        <Paper p="xs" bg="gray.0" radius="sm" mb="xs">
                          <Text size="xs" fw={500} mb={4}>🔧 Kullanılan Araçlar:</Text>
                          <Group gap={4}>
                            {message.toolsUsed.map((tool, i) => (
                              <Badge key={i} size="sm" variant="dot" color="violet" leftSection={getToolIcon(tool)}>
                                {getToolDisplayName(tool)}
                              </Badge>
                            ))}
                          </Group>
                        </Paper>
                      </Collapse>
                    )}
                    
                    <Paper 
                      p="md" 
                      bg={message.type === 'user' ? 'blue.0' : 'violet.0'} 
                      radius="md"
                    >
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
                                const userMsg = messages.find((m, idx) => 
                                  m.type === 'user' && messages[idx + 1]?.id === message.id
                                );
                                sendFeedback(message.id, userMsg?.content || '', message.content, true);
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
                                const userMsg = messages.find((m, idx) => 
                                  m.type === 'user' && messages[idx + 1]?.id === message.id
                                );
                                sendFeedback(message.id, userMsg?.content || '', message.content, false);
                              }}
                            >
                              <IconThumbDown size={12} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                      
                      {/* Feedback verildi göstergesi */}
                      {message.type === 'ai' && feedbackGiven.has(message.id) && (
                        <Badge size="xs" variant="light" color="gray" leftSection={<IconCheck size={10} />}>
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
                    <Text size="sm" c="dimmed">AI Agent çalışıyor... Verilere erişiliyor...</Text>
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
            placeholder="Soru sorun, komut verin veya işlem yaptırın..."
            value={inputValue}
            onChange={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            disabled={isLoading}
            size="md"
          />
          <Button
            color="violet"
            onClick={handleSendMessage}
            loading={isLoading}
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
