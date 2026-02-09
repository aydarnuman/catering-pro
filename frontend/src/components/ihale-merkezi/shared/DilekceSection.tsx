'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCopy,
  IconFileAnalytics,
  IconFileDownload,
  IconGavel,
  IconNote,
  IconScale,
  IconSend,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import { detectMissingCriticalData, InlineDataForm } from '../InlineDataForm';
import type { SavedTender } from '../types';

// Dilekçe Type Card Component
function DilekceTypeCard({
  label,
  description,
  icon,
  color,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Paper
      p="sm"
      radius="md"
      withBorder
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderColor: selected ? `var(--mantine-color-${color}-5)` : undefined,
        borderWidth: selected ? 2 : 1,
        background: selected ? `var(--mantine-color-${color}-light)` : undefined,
        transition: 'all 0.15s ease',
      }}
    >
      <Group gap="xs">
        <ThemeIcon size="md" variant={selected ? 'filled' : 'light'} color={color}>
          {icon}
        </ThemeIcon>
        <Box>
          <Text size="sm" fw={600}>
            {label}
          </Text>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </Box>
      </Group>
    </Paper>
  );
}

const dilekceTypes = {
  asiri_dusuk: {
    label: 'Aşırı Düşük Savunma',
    description: 'Aşırı düşük teklif açıklaması',
    icon: IconFileAnalytics,
    color: 'orange',
  },
  idare_sikayet: {
    label: 'İdareye Şikayet',
    description: 'İdareye şikayet başvurusu',
    icon: IconGavel,
    color: 'red',
  },
  kik_itiraz: {
    label: 'KİK İtiraz',
    description: 'Kamu İhale Kurumu itirazı',
    icon: IconScale,
    color: 'yellow',
  },
  aciklama_cevabi: {
    label: 'Açıklama Cevabı',
    description: 'Genel açıklama/cevap yazısı',
    icon: IconNote,
    color: 'teal',
  },
};

interface DilekceSectionProps {
  tender: SavedTender | null;
  dilekceType: string | null;
  onSelectType: (type: string | null) => void;
}

export function DilekceSection({ tender, dilekceType, onSelectType }: DilekceSectionProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(
    []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dilekceContent, setDilekceContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showDataForm, setShowDataForm] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Eksik kritik verileri tespit et
  const missingFields = tender
    ? detectMissingCriticalData({
        yaklasik_maliyet: tender.yaklasik_maliyet,
        bizim_teklif: tender.bizim_teklif,
        sinir_deger: tender.sinir_deger,
      })
    : [];

  // Sadece zorunlu alanları kontrol et (sinir_deger opsiyonel)
  const hasCriticalMissing = missingFields.filter((f) => f !== 'sinir_deger').length > 0;

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // AI ile dilekçe oluştur
  const handleSendMessage = async (messageOverride?: string) => {
    const messageToSend = messageOverride || input.trim();
    if (!messageToSend || !tender || !dilekceType) return;

    // Kritik veriler eksikse önce formu göster
    if (hasCriticalMissing && !messageOverride) {
      setPendingMessage(messageToSend);
      setShowDataForm(true);
      return;
    }

    const userMessage = messageToSend;
    if (!messageOverride) setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const typeInfo = dilekceTypes[dilekceType as keyof typeof dilekceTypes];

      // Zengin ihale context'i oluştur
      const analysisData = tender.analysis_summary;
      const teknikSartlar = analysisData?.teknik_sartlar?.slice(0, 10) || [];
      const birimFiyatlar = analysisData?.birim_fiyatlar?.slice(0, 10) || [];

      const systemPrompt = `Sen bir kamu ihale uzmanısın. ${typeInfo.label} dilekçesi hazırlamaya yardım ediyorsun.

## İHALE BİLGİLERİ
- Başlık: ${tender.ihale_basligi}
- Kurum: ${tender.kurum}
- Tarih: ${tender.tarih}
- Şehir: ${tender.city || '-'}
- İKN: ${tender.external_id || '-'}

## MALİ BİLGİLER
- Yaklaşık Maliyet: ${tender.yaklasik_maliyet ? `${tender.yaklasik_maliyet.toLocaleString('tr-TR')} ₺` : 'Belirtilmemiş'}
- Bizim Teklif: ${tender.bizim_teklif ? `${tender.bizim_teklif.toLocaleString('tr-TR')} ₺` : 'Belirtilmemiş'}
- Sınır Değer: ${tender.sinir_deger ? `${tender.sinir_deger.toLocaleString('tr-TR')} ₺` : 'Belirtilmemiş'}

## TEKNİK ŞARTLAR (${teknikSartlar.length} adet)
${teknikSartlar.map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : s.text}`).join('\n') || 'Teknik şart bilgisi yok'}

## BİRİM FİYATLAR (${birimFiyatlar.length} adet)
${birimFiyatlar.map((b) => `- ${b.kalem}: ${b.miktar} ${b.birim}`).join('\n') || 'Birim fiyat bilgisi yok'}

## İŞ SÜRESİ VE DETAYLAR
- İş Süresi: ${analysisData?.sure || '-'}
- Günlük Öğün: ${analysisData?.gunluk_ogun_sayisi || '-'}
- Kişi Sayısı: ${analysisData?.kisi_sayisi || '-'}

## TALİMAT
Kullanıcının isteğine göre profesyonel bir ${typeInfo.label} hazırla. Dilekçe formatında, resmi dil kullan. 
Yukarıdaki ihale bilgilerini dilekçede uygun şekilde kullan.
Eğer kritik bir bilgi eksikse (örn: yaklaşık maliyet, bizim teklif) bunu nazikçe belirt.`;

      const response = await aiAPI.sendAgentMessage({
        message: userMessage,
        systemContext: systemPrompt,
        department: 'İHALE',
      });

      // API doğrudan { success, response } döndürür, data wrapper yok
      const aiResponse = (response as unknown as { success: boolean; response: string }).response;
      if (response.success && aiResponse) {
        const assistantMessage = aiResponse;
        setMessages((prev) => [...prev, { role: 'assistant', content: assistantMessage }]);

        // Eğer dilekçe içeriği oluşturulduysa kaydet
        if (
          assistantMessage.includes('SAYIN') ||
          assistantMessage.includes('İDAREYE') ||
          assistantMessage.includes('KAMU İHALE KURUMU')
        ) {
          setDilekceContent(assistantMessage);
        }
      }
    } catch (error) {
      console.error('Dilekçe AI error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Bir hata oluştu. Lütfen tekrar deneyin.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Dilekçeyi kopyala
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dilekceContent);
      notifications.show({
        title: 'Kopyalandı',
        message: 'Dilekçe panoya kopyalandı',
        color: 'green',
      });
    } catch {
      // Fallback
    }
  };

  // Dilekçeyi indir (txt)
  const handleDownload = () => {
    const blob = new Blob([dilekceContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dilekce_${dilekceType}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tür seçilmemişse kart listesi göster
  if (!dilekceType) {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Dilekçe tipi seçerek AI destekli dilekçe hazırlayın
        </Text>
        <SimpleGrid cols={2} spacing="xs">
          {Object.entries(dilekceTypes).map(([key, type]) => {
            const IconComp = type.icon;
            return (
              <DilekceTypeCard
                key={key}
                label={type.label}
                description={type.description}
                icon={<IconComp size={18} />}
                color={type.color}
                selected={false}
                onClick={() => onSelectType(key)}
              />
            );
          })}
        </SimpleGrid>
      </Stack>
    );
  }

  const selectedType = dilekceTypes[dilekceType as keyof typeof dilekceTypes];

  return (
    <Stack gap="md" h={450}>
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            onClick={() => {
              onSelectType(null);
              setMessages([]);
              setDilekceContent('');
            }}
          >
            <IconArrowLeft size={16} />
          </ActionIcon>
          <Badge color={selectedType.color} variant="light" size="lg">
            {selectedType.label}
          </Badge>
        </Group>
        {dilekceContent && (
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconCopy size={14} />}
              onClick={handleCopy}
            >
              Kopyala
            </Button>
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconFileDownload size={14} />}
              onClick={handleDownload}
            >
              İndir
            </Button>
          </Group>
        )}
      </Group>

      {/* Dilekçe içeriği veya chat */}
      {dilekceContent && !isEditing ? (
        <Paper p="md" withBorder radius="md" style={{ flex: 1, overflow: 'auto' }}>
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600}>
              Oluşturulan Dilekçe
            </Text>
            <Button size="xs" variant="subtle" onClick={() => setIsEditing(true)}>
              Düzenle
            </Button>
          </Group>
          <ScrollArea h={300}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {dilekceContent}
            </Text>
          </ScrollArea>
        </Paper>
      ) : dilekceContent && isEditing ? (
        <Paper p="md" withBorder radius="md" style={{ flex: 1 }}>
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={600}>
              Dilekçeyi Düzenle
            </Text>
            <Button size="xs" variant="filled" color="green" onClick={() => setIsEditing(false)}>
              Kaydet
            </Button>
          </Group>
          <Textarea
            value={dilekceContent}
            onChange={(e) => setDilekceContent(e.target.value)}
            minRows={12}
            maxRows={15}
            autosize
          />
        </Paper>
      ) : (
        <>
          {/* Chat mesajları */}
          <ScrollArea style={{ flex: 1 }} offsetScrollbars>
            <Stack gap="xs">
              {messages.length === 0 && (
                <Paper p="md" withBorder radius="md" ta="center">
                  <ThemeIcon
                    size="xl"
                    variant="light"
                    color={selectedType.color}
                    radius="xl"
                    mb="sm"
                  >
                    <selectedType.icon size={24} />
                  </ThemeIcon>
                  <Text size="sm" fw={600} mb="xs">
                    {selectedType.label}
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    AI ile {selectedType.label.toLowerCase()} hazırlamak için talimatlarınızı yazın.
                  </Text>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      Örnek: &quot;Bu ihale için aşırı düşük savunma dilekçesi hazırla&quot;
                    </Text>
                    <Text size="xs" c="dimmed">
                      Örnek: &quot;Sınır değerin altında kaldık, açıklama yaz&quot;
                    </Text>
                  </Stack>
                </Paper>
              )}
              {messages.map((msg, idx) => (
                <Paper
                  key={`dilekce-msg-${msg.role}-${idx}`}
                  p="sm"
                  radius="md"
                  bg={
                    msg.role === 'user'
                      ? 'var(--mantine-color-blue-light)'
                      : 'var(--mantine-color-gray-light)'
                  }
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%',
                  }}
                >
                  <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </Text>
                </Paper>
              ))}
              {loading && (
                <Paper p="sm" radius="md" bg="var(--mantine-color-gray-light)">
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="xs" c="dimmed">
                      Dilekçe hazırlanıyor...
                    </Text>
                  </Group>
                </Paper>
              )}

              {/* Eksik Bilgi Formu */}
              {showDataForm && tender && missingFields.length > 0 && (
                <InlineDataForm
                  tenderId={Number(tender.id)}
                  missingFields={missingFields}
                  currentValues={{
                    yaklasik_maliyet: tender.yaklasik_maliyet,
                    bizim_teklif: tender.bizim_teklif,
                    sinir_deger: tender.sinir_deger,
                  }}
                  onSaved={() => {
                    setShowDataForm(false);
                    // Bekleyen mesajı gönder
                    if (pendingMessage) {
                      handleSendMessage(pendingMessage);
                      setPendingMessage(null);
                    }
                  }}
                  onCancel={() => {
                    setShowDataForm(false);
                    setPendingMessage(null);
                  }}
                />
              )}

              <div ref={messagesEndRef} />
            </Stack>
          </ScrollArea>

          {/* Input */}
          <Group gap="xs">
            <Textarea
              placeholder="Dilekçe talimatlarınızı yazın..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              style={{ flex: 1 }}
              minRows={1}
              maxRows={3}
              autosize
              disabled={loading || !tender}
            />
            <ActionIcon
              size="lg"
              color="blue"
              variant="filled"
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || loading || !tender}
            >
              <IconSend size={16} />
            </ActionIcon>
          </Group>
        </>
      )}
    </Stack>
  );
}
