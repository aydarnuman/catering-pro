'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { IconBulb, IconSend, IconSparkles, IconUser } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import type { Tender } from '@/types/api';
import type { SavedTender } from '../types';

interface AIChatSectionProps {
  tender: Tender | SavedTender | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Soru havuzu
const QUESTION_POOL = {
  teknik: [
    'Bu ihalenin teknik şartlarını özetle',
    'Dikkat edilmesi gereken kritik noktalar neler?',
    'Teknik yeterlilik kriterleri neler?',
  ],
  idari: [
    'İhale sürecini ve önemli tarihleri açıkla',
    'Gerekli belgeler neler?',
    'Teminat şartları neler?',
  ],
  mali: [
    'Yaklaşık maliyet hesabı nasıl yapılır?',
    'Sınır değer hesaplama yöntemi ne?',
    'Kar marjı önerir misin?',
  ],
};

// Check if tender is SavedTender
function isSavedTender(tender: Tender | SavedTender | null): tender is SavedTender {
  return tender !== null && 'tender_id' in tender;
}

export function AIChatSection({ tender }: AIChatSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Get tender context with calculation and analysis data
  const getTenderContext = () => {
    if (!tender) return '';

    const isSaved = isSavedTender(tender);
    const title = isSaved ? tender.ihale_basligi : tender.title;
    const organization = isSaved ? tender.kurum : tender.organization;
    const city = tender.city;
    const date = isSaved ? tender.tarih : (tender as Tender).tender_date;
    const bedel = isSaved
      ? tender.bedel
      : tender.estimated_cost
        ? `${tender.estimated_cost.toLocaleString('tr-TR')} ₺`
        : null;

    let context = `
İhale: ${title}
Kurum: ${organization}
Şehir: ${city}
Tarih: ${date || 'Belirtilmemiş'}
Bedel: ${bedel || 'Belirtilmemiş'}`.trim();

    // Add calculation data if available (for saved tenders)
    if (isSaved) {
      if (tender.yaklasik_maliyet || tender.sinir_deger || tender.bizim_teklif) {
        context += '\n\n📊 HESAPLAMA VERİLERİ:';
        if (tender.yaklasik_maliyet) {
          context += `\nYaklaşık Maliyet: ${tender.yaklasik_maliyet.toLocaleString('tr-TR')} ₺`;
        }
        if (tender.sinir_deger) {
          context += `\nSınır Değer: ${tender.sinir_deger.toLocaleString('tr-TR')} ₺`;
        }
        if (tender.bizim_teklif) {
          context += `\nBizim Teklif: ${tender.bizim_teklif.toLocaleString('tr-TR')} ₺`;
          if (tender.sinir_deger) {
            const asiriDusuk = tender.bizim_teklif < tender.sinir_deger;
            context += asiriDusuk ? ' (⚠️ Aşırı Düşük - Açıklama gerekebilir)' : ' (✓ Uygun)';
          }
        }
      }

      // Add analysis summary if available
      const analysis = tender.analysis_summary;
      if (analysis) {
        if (analysis.teknik_sartlar?.length) {
          context += `\n\n📋 TEKNİK ŞARTLAR (${analysis.teknik_sartlar.length} adet):`;
          // İlk 5 teknik şartı ekle
          analysis.teknik_sartlar.slice(0, 5).forEach((sart, i) => {
            const text = typeof sart === 'string' ? sart : sart.text;
            context += `\n${i + 1}. ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`;
          });
          if (analysis.teknik_sartlar.length > 5) {
            context += `\n... ve ${analysis.teknik_sartlar.length - 5} adet daha`;
          }
        }

        if (analysis.birim_fiyatlar?.length) {
          context += `\n\n💰 BİRİM FİYATLAR (${analysis.birim_fiyatlar.length} kalem)`;
        }

        if (analysis.notlar?.length) {
          context += `\n\n📝 AI NOTLARI (${analysis.notlar.length} adet):`;
          analysis.notlar.slice(0, 3).forEach((not, i) => {
            const text = typeof not === 'string' ? not : not.text;
            context += `\n${i + 1}. ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`;
          });
        }
      }

      // Document stats
      if (tender.dokuman_sayisi) {
        context += `\n\n📄 DÖKÜMANLAR: ${tender.dokuman_sayisi} döküman`;
        if (tender.analiz_edilen_dokuman) {
          context += `, ${tender.analiz_edilen_dokuman} analiz edildi`;
        }
      }
    }

    return context;
  };

  // Send message
  const handleSend = async (customMessage?: string) => {
    const messageText = customMessage || input.trim();
    if (!messageText || loading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      // Build context
      const context = getTenderContext();
      const fullMessage = context
        ? `📋 SEÇİLİ İHALE:\n${context}\n\n---\n${messageText}`
        : messageText;

      // Call AI API
      const response = await aiAPI.chat({
        message: fullMessage,
        context: 'tender_assistant',
      });

      if (response.success && response.data?.message) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        scrollToBottom();
      }
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid var(--mantine-color-default-border)',
      }}
    >
      {/* Question Pool */}
      <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group gap={4} mb={4}>
          <IconBulb size={14} color="var(--mantine-color-yellow-6)" />
          <Text size="xs" fw={500}>
            Soru Havuzu
          </Text>
        </Group>
        <Group gap={4}>
          {Object.keys(QUESTION_POOL).map((category) => (
            <Badge
              key={category}
              size="sm"
              variant={selectedCategory === category ? 'filled' : 'light'}
              color={
                category === 'teknik' ? 'blue' : category === 'idari' ? 'orange' : 'green'
              }
              style={{ cursor: 'pointer' }}
              onClick={() =>
                setSelectedCategory(selectedCategory === category ? null : category)
              }
            >
              {category === 'teknik' ? 'Teknik' : category === 'idari' ? 'İdari' : 'Mali'}
            </Badge>
          ))}
        </Group>
        {selectedCategory && (
          <Stack gap={2} mt="xs">
            {QUESTION_POOL[selectedCategory as keyof typeof QUESTION_POOL].map((q) => (
              <Paper
                key={q}
                p={6}
                radius="sm"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  handleSend(q);
                  setSelectedCategory(null);
                }}
              >
                <Text size="xs">{q}</Text>
              </Paper>
            ))}
          </Stack>
        )}
      </Box>

      {/* Messages */}
      <ScrollArea style={{ flex: 1 }} p="xs" offsetScrollbars>
        <Stack gap="xs">
          {messages.length === 0 ? (
            <Box ta="center" py="md">
              <IconSparkles size={32} color="var(--mantine-color-violet-4)" />
              <Text size="sm" c="dimmed" mt="xs">
                Soru havuzundan seçin veya mesaj yazın
              </Text>
            </Box>
          ) : (
            messages.map((msg) => (
              <Paper
                key={msg.id}
                p="xs"
                radius="md"
                style={{
                  background:
                    msg.role === 'user'
                      ? 'var(--mantine-color-blue-light)'
                      : 'var(--mantine-color-gray-light)',
                  marginLeft: msg.role === 'user' ? '20%' : 0,
                  marginRight: msg.role === 'assistant' ? '20%' : 0,
                }}
              >
                <Group gap={6} mb={4}>
                  <ThemeIcon
                    size="xs"
                    variant="transparent"
                    color={msg.role === 'user' ? 'blue' : 'violet'}
                  >
                    {msg.role === 'user' ? <IconUser size={12} /> : <IconSparkles size={12} />}
                  </ThemeIcon>
                  <Text size="xs" fw={500}>
                    {msg.role === 'user' ? 'Sen' : 'AI Asistan'}
                  </Text>
                </Group>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </Text>
              </Paper>
            ))
          )}
          {loading && (
            <Group gap="xs">
              <Loader size="xs" color="violet" />
              <Text size="xs" c="dimmed">
                Düşünüyorum...
              </Text>
            </Group>
          )}
          <div ref={scrollRef} />
        </Stack>
      </ScrollArea>

      {/* Input */}
      <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
        <Group gap="xs" align="flex-end">
          <Textarea
            ref={textareaRef}
            placeholder="Mesajınızı yazın..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            autosize
            minRows={1}
            maxRows={3}
            style={{ flex: 1 }}
            disabled={loading || !tender}
          />
          <ActionIcon
            variant="gradient"
            gradient={{ from: 'violet', to: 'grape' }}
            size="lg"
            onClick={() => handleSend()}
            loading={loading}
            disabled={!input.trim() || !tender}
          >
            <IconSend size={16} />
          </ActionIcon>
        </Group>
      </Box>
    </Box>
  );
}
