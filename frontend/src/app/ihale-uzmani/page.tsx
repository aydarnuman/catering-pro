'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  Grid,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  TextInput,
  NumberInput,
  Textarea,
  Select,
  Tabs,
  Card,
  ThemeIcon,
  ActionIcon,
  Loader,
  Box,
  Divider,
  Alert,
  ScrollArea,
  useMantineColorScheme,
  Tooltip,
  SimpleGrid,
  Progress,
  Collapse,
  Table,
  CopyButton,
  Accordion,
  RingProgress,
  Center,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconScale,
  IconFileText,
  IconCalculator,
  IconCalendar,
  IconCoin,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconSend,
  IconBrain,
  IconGavel,
  IconClipboardList,
  IconSearch,
  IconDownload,
  IconCopy,
  IconRefresh,
  IconArrowRight,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconBookmark,
  IconHistory,
  IconSparkles,
  IconFileAnalytics,
  IconReportMoney,
} from '@tabler/icons-react';
import { API_BASE_URL } from '@/lib/config';
import Link from 'next/link';

// Saved tender interface from tracking
interface SavedTender {
  id: string;
  ihale_basligi: string;
  kurum: string;
  tarih: string;
  bedel: string;
  sure: string;
  status: string;
  ihale_kayit_no?: string;
  yaklasik_maliyet?: number;
  analiz_data?: {
    teknik_sartlar?: string[];
    birim_fiyatlar?: any[];
    tam_metin?: string;
    [key: string]: any;
  };
}

// Chat message interface
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Calculation results
interface AsiriDusukSonuc {
  oran: number;
  gecerli: boolean;
  aciklama: string;
}

interface SureHesapSonuc {
  sonTarih: Date;
  kalanGun: number;
  uyarilar: string[];
}

interface BedelHesapSonuc {
  bedel: number;
  aciklama: string;
}

export default function IhaleUzmaniPage() {
  const { colorScheme } = useMantineColorScheme();
  const [savedTenders, setSavedTenders] = useState<SavedTender[]>([]);
  const [selectedTender, setSelectedTender] = useState<SavedTender | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('hesaplamalar');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Calculation states
  const [asiriDusukData, setAsiriDusukData] = useState({
    anaGirdi: 0,
    iscilik: 0,
    toplamTeklif: 0,
  });
  const [asiriDusukSonuc, setAsiriDusukSonuc] = useState<AsiriDusukSonuc | null>(null);

  const [sureData, setSureData] = useState({
    tebligTarihi: null as Date | null,
    basvuruTuru: 'sikayet' as 'sikayet' | 'itirazen_sikayet',
  });
  const [sureSonuc, setSureSonuc] = useState<SureHesapSonuc | null>(null);

  const [bedelData, setBedelData] = useState({
    yaklasikMaliyet: 0,
  });
  const [bedelSonuc, setBedelSonuc] = useState<BedelHesapSonuc | null>(null);

  // Load saved tenders from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedTenders');
    if (saved) {
      try {
        const tenders = JSON.parse(saved);
        setSavedTenders(tenders);
      } catch (e) {
        console.error('Failed to parse saved tenders:', e);
      }
    }
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Calculate aşırı düşük oran
  const hesaplaAsiriDusuk = useCallback(() => {
    const { anaGirdi, iscilik, toplamTeklif } = asiriDusukData;
    if (toplamTeklif <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Toplam teklif tutarı 0\'dan büyük olmalıdır',
        color: 'red',
      });
      return;
    }

    const oran = (anaGirdi + iscilik) / toplamTeklif;
    const gecerli = oran >= 0.80 && oran <= 0.95;

    setAsiriDusukSonuc({
      oran,
      gecerli,
      aciklama: gecerli 
        ? 'Teklif geçerli aralıktadır (0.80-0.95)' 
        : oran < 0.80 
          ? 'Teklif çok yüksek! Ana girdi ve işçilik oranı %80\'in altında.' 
          : 'Teklif çok düşük! Ana girdi ve işçilik oranı %95\'in üzerinde.',
    });
  }, [asiriDusukData]);

  // Calculate süre
  const hesaplaSure = useCallback(() => {
    if (!sureData.tebligTarihi) {
      notifications.show({
        title: 'Hata',
        message: 'Tebliğ tarihi seçiniz',
        color: 'red',
      });
      return;
    }

    const gun = sureData.basvuruTuru === 'sikayet' ? 10 : 10;
    const sonTarih = new Date(sureData.tebligTarihi);
    sonTarih.setDate(sonTarih.getDate() + gun);

    // Tatil kontrolü (basit - hafta sonu)
    const uyarilar: string[] = [];
    while (sonTarih.getDay() === 0 || sonTarih.getDay() === 6) {
      sonTarih.setDate(sonTarih.getDate() + 1);
      uyarilar.push('Son gün hafta sonuna denk geliyor, ilk iş gününe uzatıldı.');
    }

    const bugun = new Date();
    const kalanGun = Math.ceil((sonTarih.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24));

    if (kalanGun < 3 && kalanGun > 0) {
      uyarilar.push('⚠️ Süre dolmak üzere! Acil işlem yapın.');
    } else if (kalanGun <= 0) {
      uyarilar.push('❌ Süre dolmuş! Başvuru hakkı geçmiş olabilir.');
    }

    setSureSonuc({
      sonTarih,
      kalanGun: Math.max(0, kalanGun),
      uyarilar,
    });
  }, [sureData]);

  // Calculate başvuru bedeli
  const hesaplaBedel = useCallback(() => {
    const { yaklasikMaliyet } = bedelData;
    if (yaklasikMaliyet <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Yaklaşık maliyet giriniz',
        color: 'red',
      });
      return;
    }

    let bedel = 0;
    let aciklama = '';

    if (yaklasikMaliyet <= 8447946) {
      bedel = 50640;
      aciklama = '8.447.946 TL\'ye kadar olan ihaleler';
    } else if (yaklasikMaliyet <= 33791911) {
      bedel = 101344;
      aciklama = '8.447.946 TL - 33.791.911 TL arası';
    } else if (yaklasikMaliyet <= 253439417) {
      bedel = 152021;
      aciklama = '33.791.911 TL - 253.439.417 TL arası';
    } else {
      bedel = 202718;
      aciklama = '253.439.417 TL üstü';
    }

    setBedelSonuc({ bedel, aciklama });
  }, [bedelData]);

  // Send message to AI
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build context with selected tender info
      let context = '';
      if (selectedTender) {
        context = `
Kullanıcının seçili ihalesi:
- Başlık: ${selectedTender.ihale_basligi}
- Kurum: ${selectedTender.kurum}
- Tarih: ${selectedTender.tarih}
- Bedel: ${selectedTender.bedel}
- Süre: ${selectedTender.sure}
${selectedTender.ihale_kayit_no ? `- İhale Kayıt No: ${selectedTender.ihale_kayit_no}` : ''}
${selectedTender.yaklasik_maliyet ? `- Yaklaşık Maliyet: ${selectedTender.yaklasik_maliyet.toLocaleString('tr-TR')} TL` : ''}

Bu ihale bağlamında cevap ver.

`;
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          message: context + inputMessage,
          context: 'ihale_uzmani',
          model: 'claude-sonnet-4-20250514', // Opus for accuracy
        }),
      });

      if (!response.ok) {
        throw new Error('AI yanıt vermedi');
      }

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'Yanıt alınamadı',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Error:', error);
      notifications.show({
        title: 'Hata',
        message: 'AI yanıt veremedi. Lütfen tekrar deneyin.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action buttons for AI
  const quickActions = [
    { label: 'Aşırı Düşük Açıklama', prompt: 'Bu ihale için aşırı düşük teklif açıklama yazısı hazırla. EK-H.4 formatında olsun.' },
    { label: 'İtiraz Dilekçesi', prompt: 'Bu ihale için idareye şikayet dilekçesi taslağı hazırla.' },
    { label: 'KİK Emsal Karar', prompt: 'Bu ihale konusunda benzer KİK kararlarını araştır ve özetle.' },
    { label: 'Mevzuat Bilgisi', prompt: 'Bu ihale türü için geçerli mevzuat maddelerini ve dikkat edilmesi gereken hususları açıkla.' },
  ];

  return (
    <Container size="xl" py="md" mt={100}>
      {/* Header */}
      <Paper
        p="lg"
        mb="lg"
        radius="lg"
        style={{
          background: colorScheme === 'dark'
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1))'
            : 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.05))',
          border: `1px solid ${colorScheme === 'dark' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'}`,
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="sm" mb="xs">
              <ThemeIcon
                size={48}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'violet', to: 'blue', deg: 135 }}
              >
                <IconScale size={28} />
              </ThemeIcon>
              <div>
                <Title order={2}>İhale Uzmanı</Title>
                <Text size="sm" c="dimmed">
                  Claude Opus destekli kamu ihale danışmanı
                </Text>
              </div>
            </Group>
          </div>
          <Group>
            <Button
              component={Link}
              href="/tracking"
              variant="light"
              leftSection={<IconBookmark size={18} />}
            >
              İhale Takibim
            </Button>
          </Group>
        </Group>
      </Paper>

      <Grid gutter="lg">
        {/* Left Panel - Tender Selector */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" radius="md" withBorder h="100%">
            <Group justify="space-between" mb="md">
              <Text fw={600} size="sm">
                <IconClipboardList size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Kayıtlı İhaleler
              </Text>
              <Badge size="sm" variant="light" color="blue">
                {savedTenders.length}
              </Badge>
            </Group>

            {savedTenders.length === 0 ? (
              <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
                <Text size="sm">
                  Henüz kayıtlı ihale yok.{' '}
                  <Text component={Link} href="/tracking" c="blue" td="underline">
                    İhale Takibim
                  </Text>
                  {' '}sayfasından ihale kaydedin.
                </Text>
              </Alert>
            ) : (
              <ScrollArea h={400} offsetScrollbars>
                <Stack gap="xs">
                  {savedTenders.map((tender) => (
                    <Card
                      key={tender.id}
                      padding="sm"
                      radius="md"
                      withBorder
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderColor: selectedTender?.id === tender.id
                          ? 'var(--mantine-color-violet-5)'
                          : undefined,
                        background: selectedTender?.id === tender.id
                          ? colorScheme === 'dark'
                            ? 'rgba(139, 92, 246, 0.1)'
                            : 'rgba(139, 92, 246, 0.05)'
                          : undefined,
                      }}
                      onClick={() => setSelectedTender(tender)}
                    >
                      <Text size="sm" fw={500} lineClamp={2} mb={4}>
                        {tender.ihale_basligi}
                      </Text>
                      <Group gap="xs">
                        <Badge size="xs" variant="light" color="gray">
                          {tender.kurum?.slice(0, 20)}...
                        </Badge>
                        <Badge size="xs" variant="light" color="blue">
                          {tender.tarih}
                        </Badge>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
            )}

            {/* Selected Tender Details */}
            {selectedTender && (
              <Box mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                <Text size="xs" c="dimmed" mb="xs">Seçili İhale</Text>
                <Text size="sm" fw={600} mb="xs">{selectedTender.ihale_basligi}</Text>
                <SimpleGrid cols={2} spacing="xs">
                  <div>
                    <Text size="xs" c="dimmed">Kurum</Text>
                    <Text size="xs">{selectedTender.kurum}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Bedel</Text>
                    <Text size="xs" fw={500}>{selectedTender.bedel}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Tarih</Text>
                    <Text size="xs">{selectedTender.tarih}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Süre</Text>
                    <Text size="xs">{selectedTender.sure}</Text>
                  </div>
                </SimpleGrid>
              </Box>
            )}
          </Paper>
        </Grid.Col>

        {/* Right Panel - Expert Interface */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper p="md" radius="md" withBorder>
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List mb="md">
                <Tabs.Tab value="hesaplamalar" leftSection={<IconCalculator size={16} />}>
                  Hesaplamalar
                </Tabs.Tab>
                <Tabs.Tab value="uzman" leftSection={<IconBrain size={16} />}>
                  AI Uzman
                </Tabs.Tab>
                <Tabs.Tab value="dilekce" leftSection={<IconFileText size={16} />}>
                  Dilekçe Oluştur
                </Tabs.Tab>
              </Tabs.List>

              {/* Hesaplamalar Tab */}
              <Tabs.Panel value="hesaplamalar">
                <Accordion defaultValue="asiri-dusuk" variant="separated">
                  {/* Aşırı Düşük Hesaplama */}
                  <Accordion.Item value="asiri-dusuk">
                    <Accordion.Control icon={<IconReportMoney size={20} color="var(--mantine-color-orange-6)" />}>
                      <Text fw={500}>Aşırı Düşük Teklif Hesaplama</Text>
                      <Text size="xs" c="dimmed">Yemek ihalesi oranı (0.80 - 0.95)</Text>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
                        <NumberInput
                          label="Ana Çiğ Girdi (TL)"
                          placeholder="0"
                          value={asiriDusukData.anaGirdi}
                          onChange={(val) => setAsiriDusukData(prev => ({ ...prev, anaGirdi: Number(val) || 0 }))}
                          thousandSeparator="."
                          decimalSeparator=","
                          min={0}
                        />
                        <NumberInput
                          label="İşçilik (TL)"
                          placeholder="0"
                          value={asiriDusukData.iscilik}
                          onChange={(val) => setAsiriDusukData(prev => ({ ...prev, iscilik: Number(val) || 0 }))}
                          thousandSeparator="."
                          decimalSeparator=","
                          min={0}
                        />
                        <NumberInput
                          label="Toplam Teklif (TL)"
                          placeholder="0"
                          value={asiriDusukData.toplamTeklif}
                          onChange={(val) => setAsiriDusukData(prev => ({ ...prev, toplamTeklif: Number(val) || 0 }))}
                          thousandSeparator="."
                          decimalSeparator=","
                          min={0}
                        />
                      </SimpleGrid>
                      <Button onClick={hesaplaAsiriDusuk} leftSection={<IconCalculator size={16} />}>
                        Hesapla
                      </Button>

                      {asiriDusukSonuc && (
                        <Alert
                          mt="md"
                          color={asiriDusukSonuc.gecerli ? 'green' : 'red'}
                          icon={asiriDusukSonuc.gecerli ? <IconCheck size={18} /> : <IconX size={18} />}
                          title={asiriDusukSonuc.gecerli ? 'Geçerli Teklif' : 'Geçersiz Teklif'}
                        >
                          <Table withColumnBorders mt="sm">
                            <Table.Tbody>
                              <Table.Tr>
                                <Table.Td>Ana Çiğ Girdi</Table.Td>
                                <Table.Td ta="right">{asiriDusukData.anaGirdi.toLocaleString('tr-TR')} TL</Table.Td>
                              </Table.Tr>
                              <Table.Tr>
                                <Table.Td>İşçilik</Table.Td>
                                <Table.Td ta="right">{asiriDusukData.iscilik.toLocaleString('tr-TR')} TL</Table.Td>
                              </Table.Tr>
                              <Table.Tr>
                                <Table.Td>Toplam Teklif</Table.Td>
                                <Table.Td ta="right">{asiriDusukData.toplamTeklif.toLocaleString('tr-TR')} TL</Table.Td>
                              </Table.Tr>
                              <Table.Tr>
                                <Table.Td fw={700}>Oran</Table.Td>
                                <Table.Td ta="right" fw={700}>{(asiriDusukSonuc.oran * 100).toFixed(2)}%</Table.Td>
                              </Table.Tr>
                            </Table.Tbody>
                          </Table>
                          <Text size="sm" mt="sm">{asiriDusukSonuc.aciklama}</Text>
                        </Alert>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* Süre Hesaplama */}
                  <Accordion.Item value="sure">
                    <Accordion.Control icon={<IconCalendar size={20} color="var(--mantine-color-blue-6)" />}>
                      <Text fw={500}>İtiraz Süresi Hesaplama</Text>
                      <Text size="xs" c="dimmed">Şikayet ve itirazen şikayet son tarih</Text>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
                        <DateInput
                          label="Tebliğ Tarihi"
                          placeholder="Tarih seçin"
                          value={sureData.tebligTarihi}
                          onChange={(val) => setSureData(prev => ({ ...prev, tebligTarihi: val }))}
                          locale="tr"
                        />
                        <Select
                          label="Başvuru Türü"
                          value={sureData.basvuruTuru}
                          onChange={(val) => setSureData(prev => ({ ...prev, basvuruTuru: val as 'sikayet' | 'itirazen_sikayet' }))}
                          data={[
                            { value: 'sikayet', label: 'İdareye Şikayet (10 gün)' },
                            { value: 'itirazen_sikayet', label: 'KİK\'e İtirazen Şikayet (10 gün)' },
                          ]}
                        />
                      </SimpleGrid>
                      <Button onClick={hesaplaSure} leftSection={<IconCalendar size={16} />}>
                        Hesapla
                      </Button>

                      {sureSonuc && (
                        <Alert
                          mt="md"
                          color={sureSonuc.kalanGun > 3 ? 'blue' : sureSonuc.kalanGun > 0 ? 'orange' : 'red'}
                          icon={<IconCalendar size={18} />}
                          title="Süre Hesabı"
                        >
                          <Group>
                            <div>
                              <Text size="sm">Son Başvuru Tarihi</Text>
                              <Text fw={700}>{sureSonuc.sonTarih.toLocaleDateString('tr-TR')}</Text>
                            </div>
                            <Divider orientation="vertical" />
                            <div>
                              <Text size="sm">Kalan Gün</Text>
                              <Text fw={700} c={sureSonuc.kalanGun <= 0 ? 'red' : sureSonuc.kalanGun <= 3 ? 'orange' : 'blue'}>
                                {sureSonuc.kalanGun} gün
                              </Text>
                            </div>
                          </Group>
                          {sureSonuc.uyarilar.map((uyari, i) => (
                            <Text key={i} size="sm" c="orange" mt="xs">
                              {uyari}
                            </Text>
                          ))}
                        </Alert>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* Başvuru Bedeli */}
                  <Accordion.Item value="bedel">
                    <Accordion.Control icon={<IconCoin size={20} color="var(--mantine-color-green-6)" />}>
                      <Text fw={500}>İtirazen Şikayet Bedeli</Text>
                      <Text size="xs" c="dimmed">2025 yılı başvuru ücretleri</Text>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <NumberInput
                        label="Yaklaşık Maliyet (TL)"
                        placeholder="İhale yaklaşık maliyeti"
                        value={bedelData.yaklasikMaliyet}
                        onChange={(val) => setBedelData(prev => ({ ...prev, yaklasikMaliyet: Number(val) || 0 }))}
                        thousandSeparator="."
                        decimalSeparator=","
                        min={0}
                        mb="md"
                        style={{ maxWidth: 300 }}
                      />
                      <Button onClick={hesaplaBedel} leftSection={<IconCoin size={16} />}>
                        Hesapla
                      </Button>

                      {bedelSonuc && (
                        <Alert mt="md" color="green" icon={<IconCoin size={18} />} title="Başvuru Bedeli">
                          <Text size="xl" fw={700}>{bedelSonuc.bedel.toLocaleString('tr-TR')} TL</Text>
                          <Text size="sm" c="dimmed" mt="xs">{bedelSonuc.aciklama}</Text>
                        </Alert>
                      )}

                      <Box mt="md" p="sm" style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                        <Text size="xs" fw={500} mb="xs">2025 Yılı Tarife</Text>
                        <Table>
                          <Table.Tbody>
                            <Table.Tr>
                              <Table.Td>8.447.946 TL&apos;ye kadar</Table.Td>
                              <Table.Td ta="right">50.640 TL</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                              <Table.Td>8.447.946 - 33.791.911 TL</Table.Td>
                              <Table.Td ta="right">101.344 TL</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                              <Table.Td>33.791.911 - 253.439.417 TL</Table.Td>
                              <Table.Td ta="right">152.021 TL</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                              <Table.Td>253.439.417 TL üstü</Table.Td>
                              <Table.Td ta="right">202.718 TL</Table.Td>
                            </Table.Tr>
                          </Table.Tbody>
                        </Table>
                      </Box>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </Tabs.Panel>

              {/* AI Uzman Tab */}
              <Tabs.Panel value="uzman">
                <Box>
                  {/* Quick Actions */}
                  <Group gap="xs" mb="md">
                    {quickActions.map((action, i) => (
                      <Button
                        key={i}
                        variant="light"
                        size="xs"
                        onClick={() => {
                          setInputMessage(action.prompt);
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Group>

                  {/* Chat Area */}
                  <Paper
                    withBorder
                    p="md"
                    radius="md"
                    style={{ minHeight: 400, maxHeight: 500, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                  >
                    <ScrollArea style={{ flex: 1 }} offsetScrollbars>
                      {messages.length === 0 ? (
                        <Center h={300}>
                          <Stack align="center" gap="md">
                            <ThemeIcon size={60} radius="xl" variant="light" color="violet">
                              <IconBrain size={32} />
                            </ThemeIcon>
                            <Text c="dimmed" ta="center">
                              İhale uzmanınıza soru sorun.<br />
                              {selectedTender ? 'Seçili ihale hakkında sorular sorabilirsiniz.' : 'Sol panelden ihale seçin veya genel sorular sorun.'}
                            </Text>
                          </Stack>
                        </Center>
                      ) : (
                        <Stack gap="md">
                          {messages.map((msg) => (
                            <Box
                              key={msg.id}
                              style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                              }}
                            >
                              <Paper
                                p="sm"
                                radius="md"
                                style={{
                                  background: msg.role === 'user'
                                    ? 'var(--mantine-color-blue-6)'
                                    : colorScheme === 'dark'
                                      ? 'rgba(255,255,255,0.05)'
                                      : 'rgba(0,0,0,0.03)',
                                }}
                              >
                                <Text
                                  size="sm"
                                  c={msg.role === 'user' ? 'white' : undefined}
                                  style={{ whiteSpace: 'pre-wrap' }}
                                >
                                  {msg.content}
                                </Text>
                              </Paper>
                              <Text size="xs" c="dimmed" mt={4} ta={msg.role === 'user' ? 'right' : 'left'}>
                                {msg.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </Box>
                          ))}
                          {isLoading && (
                            <Group gap="xs">
                              <Loader size="xs" />
                              <Text size="sm" c="dimmed">Uzman düşünüyor...</Text>
                            </Group>
                          )}
                          <div ref={chatEndRef} />
                        </Stack>
                      )}
                    </ScrollArea>

                    {/* Input Area */}
                    <Box mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                      <Group gap="xs">
                        <Textarea
                          placeholder={selectedTender ? `"${selectedTender.ihale_basligi}" hakkında soru sorun...` : 'İhale uzmanına soru sorun...'}
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.currentTarget.value)}
                          style={{ flex: 1 }}
                          minRows={1}
                          maxRows={3}
                          autosize
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                        />
                        <ActionIcon
                          size="lg"
                          variant="filled"
                          color="violet"
                          onClick={sendMessage}
                          loading={isLoading}
                          disabled={!inputMessage.trim()}
                        >
                          <IconSend size={18} />
                        </ActionIcon>
                      </Group>
                    </Box>
                  </Paper>
                </Box>
              </Tabs.Panel>

              {/* Dilekçe Tab */}
              <Tabs.Panel value="dilekce">
                <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light" mb="md">
                  <Text size="sm">
                    Dilekçe oluşturmak için <strong>AI Uzman</strong> sekmesindeki &quot;İtiraz Dilekçesi&quot; veya &quot;Aşırı Düşük Açıklama&quot; 
                    butonlarını kullanın. AI, seçili ihale bilgilerini kullanarak profesyonel dilekçe hazırlayacaktır.
                  </Text>
                </Alert>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Card withBorder padding="lg" radius="md">
                    <ThemeIcon size={40} radius="md" variant="light" color="orange" mb="md">
                      <IconFileAnalytics size={22} />
                    </ThemeIcon>
                    <Text fw={600} mb="xs">Aşırı Düşük Açıklama</Text>
                    <Text size="sm" c="dimmed" mb="md">
                      EK-H.4 formatında malzemeli yemek sunumu hesap cetveli ve açıklama yazısı
                    </Text>
                    <Button
                      variant="light"
                      onClick={() => {
                        setActiveTab('uzman');
                        setInputMessage('Bu ihale için aşırı düşük teklif açıklama yazısı hazırla. EK-H.4 formatında olsun.');
                      }}
                    >
                      Oluştur
                    </Button>
                  </Card>

                  <Card withBorder padding="lg" radius="md">
                    <ThemeIcon size={40} radius="md" variant="light" color="red" mb="md">
                      <IconGavel size={22} />
                    </ThemeIcon>
                    <Text fw={600} mb="xs">İdareye Şikayet</Text>
                    <Text size="sm" c="dimmed" mb="md">
                      4734 sayılı Kanun kapsamında idareye şikayet dilekçesi
                    </Text>
                    <Button
                      variant="light"
                      color="red"
                      onClick={() => {
                        setActiveTab('uzman');
                        setInputMessage('Bu ihale için idareye şikayet dilekçesi taslağı hazırla.');
                      }}
                    >
                      Oluştur
                    </Button>
                  </Card>

                  <Card withBorder padding="lg" radius="md">
                    <ThemeIcon size={40} radius="md" variant="light" color="violet" mb="md">
                      <IconScale size={22} />
                    </ThemeIcon>
                    <Text fw={600} mb="xs">KİK İtirazen Şikayet</Text>
                    <Text size="sm" c="dimmed" mb="md">
                      Kamu İhale Kurumu&apos;na itirazen şikayet başvurusu
                    </Text>
                    <Button
                      variant="light"
                      color="violet"
                      onClick={() => {
                        setActiveTab('uzman');
                        setInputMessage('Bu ihale için KİK\'e itirazen şikayet dilekçesi taslağı hazırla.');
                      }}
                    >
                      Oluştur
                    </Button>
                  </Card>

                  <Card withBorder padding="lg" radius="md">
                    <ThemeIcon size={40} radius="md" variant="light" color="blue" mb="md">
                      <IconSearch size={22} />
                    </ThemeIcon>
                    <Text fw={600} mb="xs">Emsal Karar Araştırma</Text>
                    <Text size="sm" c="dimmed" mb="md">
                      Benzer konularda KİK kararları araştırması
                    </Text>
                    <Button
                      variant="light"
                      color="blue"
                      onClick={() => {
                        setActiveTab('uzman');
                        setInputMessage('Bu ihale konusunda benzer KİK kararlarını araştır ve özetle.');
                      }}
                    >
                      Araştır
                    </Button>
                  </Card>
                </SimpleGrid>
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
