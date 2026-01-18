'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Modal,
  Tabs,
  Stack,
  Group,
  Text,
  Paper,
  Badge,
  Button,
  NumberInput,
  TextInput,
  Textarea,
  Select,
  SimpleGrid,
  Box,
  Divider,
  Alert,
  ScrollArea,
  ThemeIcon,
  ActionIcon,
  Accordion,
  Card,
  Center,
  Loader,
  Table,
  Tooltip,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import {
  IconScale,
  IconCalculator,
  IconBrain,
  IconFileText,
  IconCalendar,
  IconCoin,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconSend,
  IconSettings,
  IconNote,
  IconClipboardList,
  IconReportMoney,
  IconGavel,
  IconSearch,
  IconFileAnalytics,
  IconMathFunction,
  IconEye,
  IconDownload,
  IconTrash,
  IconReceipt,
  IconChevronRight,
  IconInfoCircle,
  IconCloudCheck,
  IconBulb,
  IconSparkles,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { API_BASE_URL } from '@/lib/config';
import Link from 'next/link';

// Types
interface AnalysisData {
  ihale_basligi?: string;
  kurum?: string;
  tarih?: string;
  bedel?: string;
  sure?: string;
  teknik_sartlar?: string[];
  birim_fiyatlar?: any[];
  notlar?: string[];
  tam_metin?: string;
  iletisim?: any;
}

interface UserNote {
  id: string;
  text: string;
  created_at: string;
}

interface SavedTender {
  id: string;
  tender_id: number;
  ihale_basligi: string;
  kurum: string;
  tarih: string;
  bedel: string;
  sure: string;
  city?: string;
  external_id?: string;
  url?: string;
  status: 'bekliyor' | 'basvuruldu' | 'kazanildi' | 'kaybedildi' | 'iptal';
  notes: string;
  notlar?: string;
  user_notes?: UserNote[];
  created_at: string;
  dokuman_sayisi: number;
  analiz_edilen_dokuman?: number;
  teknik_sart_sayisi: number;
  birim_fiyat_sayisi: number;
  analiz_data?: AnalysisData;
  analysis_summary?: AnalysisData;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface IhaleUzmaniModalProps {
  opened: boolean;
  onClose: () => void;
  tender: SavedTender | null;
  onUpdateStatus: (id: string, status: SavedTender['status']) => void;
  onDelete: (id: string) => void;
  onAddNote: (id: string, text: string) => void;
  onDeleteNote: (trackingId: string, noteId: string) => void;
}

const statusConfig = {
  bekliyor: { color: 'yellow', label: 'Bekliyor', icon: '🟡' },
  basvuruldu: { color: 'blue', label: 'Başvuruldu', icon: '🔵' },
  kazanildi: { color: 'green', label: 'Kazanıldı', icon: '🟢' },
  kaybedildi: { color: 'red', label: 'Kaybedildi', icon: '🔴' },
  iptal: { color: 'gray', label: 'İptal Edildi', icon: '⚫' },
};

export default function IhaleUzmaniModal({
  opened,
  onClose,
  tender,
  onUpdateStatus,
  onDelete,
  onAddNote,
  onDeleteNote,
}: IhaleUzmaniModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<string | null>('ozet');
  
  // Analysis data
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [liveAnalysisData, setLiveAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisStats, setAnalysisStats] = useState<{toplam_dokuman: number; analiz_edilen: number} | null>(null);
  
  // Notes
  const [userNote, setUserNote] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  
  // Save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Hesaplama states
  const [yaklasikMaliyet, setYaklasikMaliyet] = useState<number>(0);
  const [sinirDeger, setSinirDeger] = useState<number | null>(null);
  const [bizimTeklif, setBizimTeklif] = useState<number>(0);
  const [teklifListesi, setTeklifListesi] = useState<{firma: string, tutar: number}[]>([{firma: '', tutar: 0}, {firma: '', tutar: 0}]);
  const [hesaplananSinirDeger, setHesaplananSinirDeger] = useState<number | null>(null);
  
  // Aşırı düşük
  const [asiriDusukData, setAsiriDusukData] = useState({ anaGirdi: 0, iscilik: 0, toplamTeklif: 0 });
  const [asiriDusukSonuc, setAsiriDusukSonuc] = useState<{ oran: number; gecerli: boolean; aciklama: string } | null>(null);
  
  // Süre
  const [sureData, setSureData] = useState({ tebligTarihi: '', basvuruTuru: 'sikayet' as 'sikayet' | 'itirazen_sikayet' });
  const [sureSonuc, setSureSonuc] = useState<{ sonTarih: Date; kalanGun: number; uyarilar: string[] } | null>(null);
  
  // Bedel
  const [bedelData, setBedelData] = useState({ yaklasikMaliyet: 0 });
  const [bedelSonuc, setBedelSonuc] = useState<{ bedel: number; aciklama: string } | null>(null);
  
  // AI Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-save debounced function
  const saveHesaplamaData = useDebouncedCallback(async () => {
    if (!tender || !dataLoaded) return;
    
    setSaveStatus('saving');
    try {
      const hesaplamaVerileri = {
        teklif_listesi: teklifListesi.filter(t => t.tutar > 0),
        asiri_dusuk: asiriDusukData,
        sure_hesaplama: sureData,
        son_kayit: new Date().toISOString()
      };

      await fetch(`${API_BASE_URL}/api/tender-tracking/${tender.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yaklasik_maliyet: yaklasikMaliyet || null,
          sinir_deger: sinirDeger || null,
          bizim_teklif: bizimTeklif || null,
          hesaplama_verileri: hesaplamaVerileri
        })
      });
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Hesaplama verisi kaydetme hatası:', error);
      setSaveStatus('idle');
    }
  }, 1000);

  // Trigger auto-save when hesaplama data changes
  useEffect(() => {
    if (dataLoaded && (yaklasikMaliyet > 0 || sinirDeger || bizimTeklif > 0)) {
      saveHesaplamaData();
    }
  }, [yaklasikMaliyet, sinirDeger, bizimTeklif, teklifListesi, asiriDusukData, sureData, dataLoaded]);

  // Load saved data and analysis when tender changes
  useEffect(() => {
    if (opened && tender) {
      setDataLoaded(false);
      loadAnalysisData();
      loadSavedHesaplamaData();
    }
  }, [opened, tender]);

  // Update AI context when modal opens or hesaplama data changes
  useEffect(() => {
    if (opened && tender && typeof window !== 'undefined') {
      const contextEvent = new CustomEvent('ai-context-update', {
        detail: {
          type: 'tender',
          id: tender.tender_id,
          title: tender.ihale_basligi,
          data: {
            title: tender.ihale_basligi,
            organization: tender.kurum,
            city: tender.city,
            deadline: tender.tarih,
            estimated_cost: tender.bedel,
            external_id: tender.external_id,
            // Hesaplama verileri
            yaklasik_maliyet: yaklasikMaliyet > 0 ? `${yaklasikMaliyet.toLocaleString('tr-TR')} TL` : null,
            sinir_deger: sinirDeger ? `${sinirDeger.toLocaleString('tr-TR')} TL` : null,
            bizim_teklif: bizimTeklif > 0 ? `${bizimTeklif.toLocaleString('tr-TR')} TL` : null,
            teklif_listesi: teklifListesi.filter(t => t.tutar > 0).map(t => `${t.firma}: ${t.tutar.toLocaleString('tr-TR')} TL`),
            // Analiz özeti
            teknik_sart_sayisi: getAnalysisData().teknik_sartlar?.length || 0,
            birim_fiyat_sayisi: getAnalysisData().birim_fiyatlar?.length || 0,
          }
        }
      });
      window.dispatchEvent(contextEvent);
    }
    
    // Modal kapandığında context'i sıfırla
    if (!opened && typeof window !== 'undefined') {
      const contextEvent = new CustomEvent('ai-context-update', {
        detail: { type: 'general' }
      });
      window.dispatchEvent(contextEvent);
    }
  }, [opened, tender, yaklasikMaliyet, sinirDeger, bizimTeklif, teklifListesi, liveAnalysisData]);

  // Load saved hesaplama data from tender
  const loadSavedHesaplamaData = () => {
    if (!tender) return;
    
    // Load from tender object (comes from API with new fields)
    const tenderAny = tender as any;
    
    if (tenderAny.yaklasik_maliyet) {
      setYaklasikMaliyet(parseFloat(tenderAny.yaklasik_maliyet));
      setBedelData({ yaklasikMaliyet: parseFloat(tenderAny.yaklasik_maliyet) });
    } else if (tender.bedel) {
      // Fallback: parse from bedel string
      const numericBedel = parseFloat(tender.bedel.replace(/[^\d,]/g, '').replace(',', '.'));
      if (!isNaN(numericBedel)) {
        setYaklasikMaliyet(numericBedel);
        setBedelData({ yaklasikMaliyet: numericBedel });
      }
    }
    
    if (tenderAny.sinir_deger) {
      setSinirDeger(parseFloat(tenderAny.sinir_deger));
    }
    
    if (tenderAny.bizim_teklif) {
      setBizimTeklif(parseFloat(tenderAny.bizim_teklif));
    }
    
    // Load hesaplama_verileri JSON
    if (tenderAny.hesaplama_verileri) {
      const hv = typeof tenderAny.hesaplama_verileri === 'string' 
        ? JSON.parse(tenderAny.hesaplama_verileri) 
        : tenderAny.hesaplama_verileri;
      
      if (hv.teklif_listesi && Array.isArray(hv.teklif_listesi) && hv.teklif_listesi.length >= 2) {
        setTeklifListesi(hv.teklif_listesi);
      }
      if (hv.asiri_dusuk) {
        setAsiriDusukData(hv.asiri_dusuk);
      }
      if (hv.sure_hesaplama) {
        setSureData(hv.sure_hesaplama);
      }
    }
    
    // Mark data as loaded (enables auto-save)
    setTimeout(() => setDataLoaded(true), 500);
  };


  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAnalysisData = async () => {
    if (!tender) return;
    try {
      setAnalysisLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking/${tender.tender_id}/analysis`);
      const result = await response.json();
      if (result.success && result.data) {
        setLiveAnalysisData(result.data.analysis);
        setAnalysisStats(result.data.stats);
      }
    } catch (error) {
      console.error('Analiz verisi çekme hatası:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const getAnalysisData = (): AnalysisData => {
    if (liveAnalysisData) return liveAnalysisData;
    if (tender?.analiz_data) return tender.analiz_data;
    if (tender?.analysis_summary) return tender.analysis_summary;
    return {
      ihale_basligi: tender?.ihale_basligi,
      kurum: tender?.kurum,
      tarih: tender?.tarih,
      bedel: tender?.bedel,
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [],
    };
  };

  // Sınır değer hesaplama (KİK formülü)
  const hesaplaSinirDeger = useCallback(() => {
    if (yaklasikMaliyet <= 0) {
      notifications.show({ title: 'Hata', message: 'Yaklaşık maliyet giriniz', color: 'red' });
      return;
    }

    const gecerliTeklifler = teklifListesi.filter(t => t.tutar > 0).map(t => t.tutar);
    const n = gecerliTeklifler.length;
    
    if (n < 2) {
      notifications.show({ title: 'Hata', message: 'En az 2 geçerli teklif gerekli', color: 'red' });
      return;
    }

    const toplam = gecerliTeklifler.reduce((a, b) => a + b, 0);
    const Tort1 = toplam / n;
    const varyans = gecerliTeklifler.reduce((acc, t) => acc + Math.pow(t - Tort1, 2), 0) / (n - 1);
    const stdSapma = Math.sqrt(varyans);
    const altSinir = Tort1 - stdSapma;
    const ustSinir = Tort1 + stdSapma;
    const aralikTeklifler = gecerliTeklifler.filter(t => t >= altSinir && t <= ustSinir);
    
    let Tort2 = Tort1;
    if (aralikTeklifler.length > 0) {
      Tort2 = aralikTeklifler.reduce((a, b) => a + b, 0) / aralikTeklifler.length;
    }

    const C = Tort2 / yaklasikMaliyet;
    let K: number;
    if (C < 0.60) K = C;
    else if (C <= 1.00) K = (3.2 * C - C * C - 0.6) / (C + 1);
    else K = 1;

    const calculatedSinirDeger = K * Tort2;
    setHesaplananSinirDeger(calculatedSinirDeger);
    setSinirDeger(calculatedSinirDeger);
  }, [yaklasikMaliyet, teklifListesi]);

  // Aşırı düşük hesaplama
  const hesaplaAsiriDusuk = useCallback(() => {
    const { anaGirdi, iscilik, toplamTeklif } = asiriDusukData;
    if (toplamTeklif <= 0) {
      notifications.show({ title: 'Hata', message: 'Toplam teklif tutarı 0\'dan büyük olmalıdır', color: 'red' });
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

  // Süre hesaplama
  const hesaplaSure = useCallback(() => {
    if (!sureData.tebligTarihi) {
      notifications.show({ title: 'Hata', message: 'Tebliğ tarihi seçiniz', color: 'red' });
      return;
    }

    const gun = 10;
    const sonTarih = new Date(sureData.tebligTarihi);
    sonTarih.setDate(sonTarih.getDate() + gun);

    const uyarilar: string[] = [];
    while (sonTarih.getDay() === 0 || sonTarih.getDay() === 6) {
      sonTarih.setDate(sonTarih.getDate() + 1);
      uyarilar.push('Son gün hafta sonuna denk geliyor, ilk iş gününe uzatıldı.');
    }

    const bugun = new Date();
    const kalanGun = Math.ceil((sonTarih.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24));

    if (kalanGun < 3 && kalanGun > 0) uyarilar.push('⚠️ Süre dolmak üzere! Acil işlem yapın.');
    else if (kalanGun <= 0) uyarilar.push('❌ Süre dolmuş! Başvuru hakkı geçmiş olabilir.');

    setSureSonuc({ sonTarih, kalanGun: Math.max(0, kalanGun), uyarilar });
  }, [sureData]);

  // Bedel hesaplama (2025 tarifeleri)
  const hesaplaBedel = useCallback(() => {
    const { yaklasikMaliyet } = bedelData;
    if (yaklasikMaliyet <= 0) {
      notifications.show({ title: 'Hata', message: 'Yaklaşık maliyet giriniz', color: 'red' });
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

  // AI Chat
  const sendMessage = async () => {
    if (!inputMessage.trim() || !tender) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsAILoading(true);

    try {
      let context = `Seçili İhale:\n- Başlık: ${tender.ihale_basligi}\n- Kurum: ${tender.kurum}\n`;
      if (tender.bedel) context += `- Tahmini Bedel: ${tender.bedel}\n`;
      if (tender.tarih) context += `- Tarih: ${tender.tarih}\n`;
      if (yaklasikMaliyet > 0) context += `- Yaklaşık Maliyet: ${yaklasikMaliyet.toLocaleString('tr-TR')} TL\n`;
      if (sinirDeger) context += `- Sınır Değer: ${sinirDeger.toLocaleString('tr-TR')} TL\n`;
      if (bizimTeklif > 0) context += `- Bizim Teklif: ${bizimTeklif.toLocaleString('tr-TR')} TL\n`;
      context += '\nBu ihale bağlamında cevap ver.\n\n';

      const response = await fetch(`${API_BASE_URL}/api/ai/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          message: context + inputMessage,
          context: 'ihale_uzmani',
          model: 'claude-sonnet-4-20250514',
        }),
      });

      if (!response.ok) throw new Error('AI yanıt vermedi');

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
      notifications.show({ title: 'Hata', message: 'AI yanıt veremedi', color: 'red' });
    } finally {
      setIsAILoading(false);
    }
  };

  // Quick AI actions
  const quickActions = [
    { label: 'Aşırı Düşük Açıklama', prompt: 'Bu ihale için aşırı düşük teklif açıklama yazısı hazırla. EK-H.4 formatında olsun.' },
    { label: 'İtiraz Dilekçesi', prompt: 'Bu ihale için idareye şikayet dilekçesi taslağı hazırla.' },
    { label: 'KİK Emsal Karar', prompt: 'Bu ihale konusunda benzer KİK kararlarını araştır ve özetle.' },
    { label: 'Mevzuat Bilgisi', prompt: 'Bu ihale türü için geçerli mevzuat maddelerini açıkla.' },
  ];

  // JSON export
  const downloadJSON = () => {
    if (!tender) return;
    const exportData = {
      ihale_bilgileri: {
        baslik: tender.ihale_basligi,
        kurum: tender.kurum,
        tarih: tender.tarih,
        bedel: tender.bedel,
        durum: statusConfig[tender.status].label
      },
      hesaplamalar: {
        yaklasik_maliyet: yaklasikMaliyet,
        sinir_deger: sinirDeger,
        bizim_teklif: bizimTeklif,
      },
      analiz_data: tender.analiz_data,
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ihale-${tender.id}-uzman.json`;
    link.click();
  };

  if (!tender) return null;

  const analysisData = getAnalysisData();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Box className="modal-header-glass" style={{ margin: 0, padding: '16px 20px', borderRadius: 16 }}>
          <Group gap="md">
            <ThemeIcon 
              size={48} 
              radius="xl" 
              variant="gradient" 
              gradient={{ from: 'violet', to: 'blue' }}
              style={{ boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' }}
            >
              <IconScale size={24} />
            </ThemeIcon>
            <div>
              <Group gap="xs">
                <Text fw={700} size="lg">İhale Uzmanı</Text>
                <Badge variant="gradient" gradient={{ from: 'violet', to: 'grape' }} size="sm">
                  PRO
                </Badge>
              </Group>
              <Text size="sm" c="dimmed" lineClamp={1} maw={500}>{tender.ihale_basligi}</Text>
            </div>
          </Group>
        </Box>
      }
      size="xl"
      fullScreen
      transitionProps={{ transition: 'slide-up', duration: 300 }}
      styles={{
        header: { 
          background: 'transparent',
          padding: '12px 20px',
        },
        body: {
          padding: '0 24px 24px 24px',
        }
      }}
    >
      <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="lg">
        <Tabs.List grow mb="lg" style={{ gap: 8 }}>
          <Tabs.Tab 
            value="ozet" 
            leftSection={<IconInfoCircle size={18} />}
            style={{ fontWeight: 600, padding: '12px 20px' }}
          >
            Özet
          </Tabs.Tab>
          <Tabs.Tab 
            value="dokumanlar" 
            leftSection={<IconClipboardList size={18} />}
            style={{ fontWeight: 600, padding: '12px 20px' }}
          >
            Döküman Analizi
            {analysisStats && (
              <Badge 
                size="sm" 
                ml={8} 
                variant="gradient" 
                gradient={{ from: 'violet', to: 'blue' }}
                className="tab-badge-pulse"
              >
                {analysisStats.analiz_edilen}/{analysisStats.toplam_dokuman}
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab 
            value="hesaplamalar" 
            leftSection={<IconCalculator size={18} />}
            style={{ fontWeight: 600, padding: '12px 20px' }}
          >
            Hesaplamalar
          </Tabs.Tab>
          <Tabs.Tab 
            value="ai" 
            leftSection={<IconBrain size={18} />}
            style={{ fontWeight: 600, padding: '12px 20px' }}
          >
            <Group gap={6}>
              AI Danışman
              <IconSparkles size={14} style={{ color: 'var(--mantine-color-yellow-5)' }} />
            </Group>
          </Tabs.Tab>
          <Tabs.Tab 
            value="dilekce" 
            leftSection={<IconFileText size={18} />}
            style={{ fontWeight: 600, padding: '12px 20px' }}
          >
            Dilekçeler
          </Tabs.Tab>
        </Tabs.List>

        {/* ÖZET TAB */}
        <Tabs.Panel value="ozet">
          <Stack gap="md">
            {/* Üst Bar */}
            <Group justify="space-between">
              <Group gap="sm">
                <Select
                  value={tender.status}
                  onChange={(value) => value && onUpdateStatus(tender.id, value as SavedTender['status'])}
                  data={Object.entries(statusConfig).map(([key, val]) => ({ value: key, label: `${val.icon} ${val.label}` }))}
                  w={160}
                  size="sm"
                />
                {analysisLoading && <Loader size="xs" />}
              </Group>
              <Group gap="xs">
                <Button variant="outline" size="xs" leftSection={<IconEye size={14} />} component={Link} href={`/tenders/${tender.tender_id}`} target="_blank">
                  Detay
                </Button>
                <Button variant="outline" size="xs" leftSection={<IconDownload size={14} />} onClick={downloadJSON}>
                  JSON
                </Button>
                <Button variant="outline" color="red" size="xs" leftSection={<IconTrash size={14} />} onClick={() => onDelete(tender.id)}>
                  Sil
                </Button>
              </Group>
            </Group>

            {/* Özet Kartları */}
            <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm">
              <Tooltip label={tender.ihale_basligi} multiline w={300} withArrow disabled={!tender.ihale_basligi}>
                <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
                  <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>İhale Başlığı</Text>
                  <Text size="sm" fw={500} lineClamp={2}>{tender.ihale_basligi || <Text span c="gray.5">Belirtilmemiş</Text>}</Text>
                </Paper>
              </Tooltip>
              <Tooltip label={tender.kurum} multiline w={300} withArrow disabled={!tender.kurum}>
                <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
                  <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>Kurum</Text>
                  <Text size="sm" fw={500} lineClamp={2}>{tender.kurum || <Text span c="gray.5">Belirtilmemiş</Text>}</Text>
                </Paper>
              </Tooltip>
              <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
                <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>Tarih</Text>
                <Text size="sm" fw={600}>{tender.tarih || <Text span c="gray.5">Belirtilmemiş</Text>}</Text>
              </Paper>
              <Paper p="sm" withBorder radius="md" shadow="xs" style={{ borderColor: tender.bedel ? 'var(--mantine-color-green-5)' : undefined }} className="hover-card">
                <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>Tahmini Bedel</Text>
                <Text size="sm" fw={700} c={tender.bedel ? 'green' : 'gray.5'}>{tender.bedel || 'Belirtilmemiş'}</Text>
              </Paper>
              <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
                <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>Şehir</Text>
                <Text size="sm" fw={500}>{tender.city || <Text span c="gray.5">Belirtilmemiş</Text>}</Text>
              </Paper>
            </SimpleGrid>

            {/* Veri Girişi */}
            <Paper p="md" withBorder radius="md" bg="gray.0" shadow="sm">
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <Text fw={600} size="sm" c="gray.8">📊 İhale Verileri</Text>
                  {/* Save Status Indicator */}
                  {saveStatus === 'saving' && (
                    <Badge size="xs" variant="light" color="blue" leftSection={<Loader size={10} />}>
                      Kaydediliyor...
                    </Badge>
                  )}
                  {saveStatus === 'saved' && (
                    <Badge size="xs" variant="light" color="green" leftSection={<IconCloudCheck size={12} />}>
                      Kaydedildi
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  Hesaplamalar sekmesinden sınır değer hesaplayabilirsiniz
                </Text>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <NumberInput
                  label="Yaklaşık Maliyet (TL)"
                  description="İdarenin belirlediği tutar"
                  value={yaklasikMaliyet || ''}
                  onChange={(val) => setYaklasikMaliyet(Number(val) || 0)}
                  thousandSeparator="." decimalSeparator="," min={0}
                  leftSection={<IconCoin size={16} />}
                />
                <NumberInput
                  label="Sınır Değer (TL)"
                  description="Hesapla veya gir"
                  value={sinirDeger || ''}
                  onChange={(val) => setSinirDeger(Number(val) || null)}
                  thousandSeparator="." decimalSeparator="," min={0}
                  leftSection={<IconAlertTriangle size={16} />}
                />
                <NumberInput
                  label="Bizim Teklifimiz (TL)"
                  value={bizimTeklif || ''}
                  onChange={(val) => setBizimTeklif(Number(val) || 0)}
                  thousandSeparator="." decimalSeparator="," min={0}
                  leftSection={<IconReportMoney size={16} />}
                />
              </SimpleGrid>

              {sinirDeger && bizimTeklif > 0 && (
                <Alert
                  mt="md"
                  color={bizimTeklif < sinirDeger ? 'orange' : 'green'}
                  variant="light"
                  icon={bizimTeklif < sinirDeger ? <IconAlertTriangle size={18} /> : <IconCheck size={18} />}
                >
                  <Text size="sm">
                    {bizimTeklif < sinirDeger
                      ? `Teklifiniz sınır değerin ${((1 - bizimTeklif / sinirDeger) * 100).toFixed(1)}% altında - Aşırı düşük açıklama gerekli!`
                      : 'Teklifiniz sınır değerin üzerinde'}
                  </Text>
                </Alert>
              )}
            </Paper>

            {/* Notlar */}
            <Paper p="sm" withBorder radius="md" shadow="xs">
              <Group justify="space-between" mb="sm">
                <Group gap="xs">
                  <ThemeIcon size="sm" color="yellow" variant="light">
                    <IconNote size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={600} c="gray.7">Notlarım</Text>
                  {tender.user_notes && tender.user_notes.length > 0 && (
                    <Badge size="xs" variant="filled" color="yellow" c="dark">{tender.user_notes.length}</Badge>
                  )}
                </Group>
              </Group>
              
              {tender.user_notes && tender.user_notes.length > 0 && (
                <ScrollArea.Autosize mah={120} mb="sm" offsetScrollbars>
                  <Stack gap={4}>
                    {tender.user_notes.map((note) => (
                      <Paper key={note.id} p="xs" withBorder radius="sm" bg="yellow.0">
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" style={{ flex: 1 }}>{note.text}</Text>
                          <Group gap={4}>
                            <Text size="xs" c="dimmed">{new Date(note.created_at).toLocaleDateString('tr-TR')}</Text>
                            <ActionIcon size="xs" color="red" variant="subtle" onClick={() => onDeleteNote(tender.id, note.id)}>
                              <IconX size={10} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              )}
              
              <Group gap="xs">
                <TextInput
                  placeholder="Not ekle... (Enter)"
                  size="xs"
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  style={{ flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && userNote.trim()) {
                      e.preventDefault();
                      onAddNote(tender.id, userNote);
                      setUserNote('');
                    }
                  }}
                />
                <Button size="xs" variant="filled" color="yellow" c="dark" onClick={() => { onAddNote(tender.id, userNote); setUserNote(''); }} disabled={!userNote.trim()}>
                  +
                </Button>
              </Group>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* DÖKÜMANLAR TAB */}
        <Tabs.Panel value="dokumanlar">
          <Tabs defaultValue="teknik" variant="pills" radius="md">
            <Tabs.List mb="lg" style={{ gap: 6 }}>
              <Tabs.Tab 
                value="teknik" 
                leftSection={<IconSettings size={14} />}
                style={{ fontWeight: 500 }}
              >
                Teknik Şartlar
                <Badge size="xs" variant="filled" color="blue" ml={6}>
                  {analysisData.teknik_sartlar?.length || 0}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab 
                value="fiyat" 
                leftSection={<IconCoin size={14} />}
                style={{ fontWeight: 500 }}
              >
                Birim Fiyatlar
                <Badge size="xs" variant="filled" color="green" ml={6}>
                  {analysisData.birim_fiyatlar?.length || 0}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab 
                value="ainotlar" 
                leftSection={<IconBulb size={14} />}
                style={{ fontWeight: 500 }}
              >
                AI Notları
                <Badge size="xs" variant="gradient" gradient={{ from: 'orange', to: 'yellow' }} ml={6}>
                  {analysisData.notlar?.length || 0}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab 
                value="metin" 
                leftSection={<IconClipboardList size={14} />}
                style={{ fontWeight: 500 }}
              >
                Tam Metin
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="teknik">
              <ScrollArea h="calc(100vh - 280px)" offsetScrollbars>
                {analysisData.teknik_sartlar && analysisData.teknik_sartlar.length > 0 ? (
                  <Stack gap="sm">
                    {analysisData.teknik_sartlar.map((sart, i) => {
                      // Önem seviyesi belirleme
                      const isImportant = /zorunlu|mecburi|şart|gerekli|mutlaka/i.test(sart);
                      const isWarning = /dikkat|uyarı|önemli|not:|ödeme/i.test(sart);
                      const cardClass = isImportant ? 'teknik-sart-card important' : isWarning ? 'teknik-sart-card warning' : 'teknik-sart-card info';
                      const iconColor = isImportant ? 'red' : isWarning ? 'orange' : 'blue';
                      
                      return (
                        <Paper 
                          key={i} 
                          p="md" 
                          withBorder 
                          radius="lg" 
                          shadow="sm"
                          className={cardClass}
                        >
                          <Group gap="md" wrap="nowrap" align="flex-start">
                            <Badge 
                              size="xl" 
                              variant="gradient" 
                              gradient={{ from: iconColor, to: iconColor === 'red' ? 'pink' : iconColor === 'orange' ? 'yellow' : 'cyan' }} 
                              circle
                              className="number-badge"
                              style={{ minWidth: 40, minHeight: 40, fontSize: 14 }}
                            >
                              {i + 1}
                            </Badge>
                            <div style={{ flex: 1 }}>
                              <Text size="sm" fw={500} style={{ lineHeight: 1.6 }}>{sart}</Text>
                              {isImportant && (
                                <Badge size="xs" color="red" variant="light" mt="xs">
                                  Zorunlu Şart
                                </Badge>
                              )}
                            </div>
                          </Group>
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : (
                  <Center h={300}>
                    <Stack align="center" gap="md">
                      <ThemeIcon size={80} radius="xl" variant="gradient" gradient={{ from: 'gray', to: 'dark' }}>
                        <IconClipboardList size={40} />
                      </ThemeIcon>
                      <Text c="dimmed" size="lg">Teknik şart bulunamadı</Text>
                      <Text c="dimmed" size="sm">Döküman analizi yapıldığında burada görünecek</Text>
                    </Stack>
                  </Center>
                )}
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="fiyat">
              <ScrollArea h="calc(100vh - 280px)" offsetScrollbars>
                {analysisData.birim_fiyatlar && analysisData.birim_fiyatlar.length > 0 ? (
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={50}>#</Table.Th>
                        <Table.Th>Kalem</Table.Th>
                        <Table.Th>Birim</Table.Th>
                        <Table.Th>Miktar</Table.Th>
                        <Table.Th ta="right">Fiyat</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {analysisData.birim_fiyatlar.map((item: any, i: number) => (
                        <Table.Tr key={i}>
                          <Table.Td>{i + 1}</Table.Td>
                          <Table.Td>{typeof item === 'object' ? (item.kalem || item.aciklama || '-') : item}</Table.Td>
                          <Table.Td>{typeof item === 'object' ? (item.birim || '-') : '-'}</Table.Td>
                          <Table.Td>{typeof item === 'object' ? (item.miktar || '-') : '-'}</Table.Td>
                          <Table.Td ta="right">
                            <Badge color="green" variant="light">
                              {typeof item === 'object' ? (item.fiyat || item.tutar || '-') : '-'}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text c="dimmed" ta="center" py="xl">Birim fiyat bulunamadı</Text>
                )}
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="ainotlar">
              <ScrollArea h="calc(100vh - 280px)" offsetScrollbars>
                {analysisData.notlar && analysisData.notlar.length > 0 ? (
                  <Stack gap="md">
                    {analysisData.notlar.map((not, i) => (
                      <Paper 
                        key={i} 
                        p="lg" 
                        radius="lg" 
                        shadow="md"
                        className="ai-note-card"
                        style={{ 
                          borderLeft: '5px solid var(--mantine-color-orange-5)'
                        }}
                      >
                        <Group gap="md" wrap="nowrap" align="flex-start">
                          <ThemeIcon 
                            size={44} 
                            radius="xl" 
                            variant="gradient" 
                            gradient={{ from: 'orange', to: 'yellow' }}
                          >
                            <IconBulb size={22} />
                          </ThemeIcon>
                          <div style={{ flex: 1 }}>
                            <Group gap="xs" mb="xs">
                              <Badge size="sm" variant="gradient" gradient={{ from: 'orange', to: 'red' }}>
                                AI İçgörü #{i + 1}
                              </Badge>
                            </Group>
                            <Text size="sm" fw={500} style={{ lineHeight: 1.7 }}>{not}</Text>
                          </div>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Center h={300}>
                    <Stack align="center" gap="md">
                      <ThemeIcon size={80} radius="xl" variant="gradient" gradient={{ from: 'orange', to: 'yellow' }}>
                        <IconBulb size={40} />
                      </ThemeIcon>
                      <Text c="dimmed" size="lg">AI notu bulunamadı</Text>
                      <Text c="dimmed" size="sm">AI analizi yapıldığında notlar burada görünecek</Text>
                    </Stack>
                  </Center>
                )}
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="metin">
              <ScrollArea h="calc(100vh - 280px)" offsetScrollbars>
                {analysisData.tam_metin ? (
                  <Paper p="md" withBorder bg="gray.0">
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {analysisData.tam_metin}
                    </Text>
                  </Paper>
                ) : (
                  <Text c="dimmed" ta="center" py="xl">Tam metin bulunamadı</Text>
                )}
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>

        {/* HESAPLAMALAR TAB */}
        <Tabs.Panel value="hesaplamalar">
          <ScrollArea h="calc(100vh - 200px)" offsetScrollbars>
            <Box style={{ maxWidth: 700, margin: '0 auto' }}>
            <Accordion 
              defaultValue="sinir-deger" 
              variant="separated"
              radius="md"
              styles={{
                item: {
                  border: '1px solid var(--mantine-color-gray-3)',
                  marginBottom: 10,
                },
                control: {
                  padding: '12px 16px',
                },
                panel: {
                  padding: '16px',
                }
              }}
            >
              {/* Sınır Değer Hesaplama */}
              <Accordion.Item value="sinir-deger">
                <Accordion.Control 
                  icon={
                    <ThemeIcon size={36} radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }}>
                      <IconMathFunction size={20} />
                    </ThemeIcon>
                  }
                >
                  <div>
                    <Text fw={600} size="md">Sınır Değer Hesaplama</Text>
                    <Text size="xs" c="dimmed">KİK Formülü ile hesaplama</Text>
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    <NumberInput
                      label="Yaklaşık Maliyet (TL)"
                      value={yaklasikMaliyet || ''}
                      onChange={(val) => setYaklasikMaliyet(Number(val) || 0)}
                      thousandSeparator="." decimalSeparator="," min={0}
                    />
                    
                    <div>
                      <Group justify="space-between" mb="xs">
                        <Text size="sm" fw={500}>Teklif Listesi</Text>
                        <Button size="xs" variant="light" color="green" leftSection={<IconCheck size={14} />} onClick={() => setTeklifListesi(prev => [...prev, {firma: '', tutar: 0}])}>
                          Teklif Ekle
                        </Button>
                      </Group>
                      <Stack gap="sm">
                        {teklifListesi.map((teklif, index) => (
                          <Group key={index} gap="xs" align="flex-end">
                            <TextInput
                              placeholder={`Firma ${index + 1} (opsiyonel)`}
                              value={teklif.firma}
                              onChange={(e) => setTeklifListesi(prev => prev.map((t, i) => i === index ? {...t, firma: e.target.value} : t))}
                              style={{ flex: 1, maxWidth: 180 }}
                              size="sm"
                            />
                            <NumberInput
                              placeholder={`Teklif tutarı`}
                              value={teklif.tutar || ''}
                              onChange={(val) => setTeklifListesi(prev => prev.map((t, i) => i === index ? {...t, tutar: Number(val) || 0} : t))}
                              thousandSeparator="." decimalSeparator="," min={0}
                              style={{ flex: 1 }}
                              size="sm"
                              rightSection={<Text size="xs" c="dimmed">TL</Text>}
                            />
                            {teklifListesi.length > 2 && (
                              <ActionIcon variant="light" color="red" onClick={() => setTeklifListesi(prev => prev.filter((_, i) => i !== index))} size="md">
                                <IconTrash size={16} />
                              </ActionIcon>
                            )}
                          </Group>
                        ))}
                      </Stack>
                    </div>

                    <Button 
                      size="md" 
                      variant="gradient" 
                      gradient={{ from: 'violet', to: 'indigo' }}
                      leftSection={<IconCalculator size={18} />} 
                      onClick={hesaplaSinirDeger} 
                      disabled={teklifListesi.filter(t => t.tutar > 0).length < 2}
                    >
                      Sınır Değer Hesapla
                    </Button>

                    {hesaplananSinirDeger && (
                      <Alert color="green" icon={<IconCheck size={18} />}>
                        <Group justify="space-between">
                          <div>
                            <Text size="xs" c="dimmed">Hesaplanan Sınır Değer</Text>
                            <Text size="xl" fw={700} c="green">{hesaplananSinirDeger.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</Text>
                          </div>
                          <Button size="sm" color="green" onClick={() => setSinirDeger(Math.round(hesaplananSinirDeger))}>
                            Kaydet
                          </Button>
                        </Group>
                      </Alert>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              {/* Aşırı Düşük Hesaplama */}
              <Accordion.Item value="asiri-dusuk">
                <Accordion.Control 
                  icon={
                    <ThemeIcon size={36} radius="xl" variant="gradient" gradient={{ from: 'orange', to: 'red' }}>
                      <IconReportMoney size={20} />
                    </ThemeIcon>
                  }
                >
                  <div>
                    <Text fw={600} size="md">Aşırı Düşük Teklif Hesaplama</Text>
                    <Text size="xs" c="dimmed">Teklif oranı analizi</Text>
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
                    <NumberInput label="Ana Çiğ Girdi (TL)" value={asiriDusukData.anaGirdi || ''} onChange={(val) => setAsiriDusukData(prev => ({ ...prev, anaGirdi: Number(val) || 0 }))} thousandSeparator="." decimalSeparator="," min={0} />
                    <NumberInput label="İşçilik (TL)" value={asiriDusukData.iscilik || ''} onChange={(val) => setAsiriDusukData(prev => ({ ...prev, iscilik: Number(val) || 0 }))} thousandSeparator="." decimalSeparator="," min={0} />
                    <NumberInput label="Toplam Teklif (TL)" value={asiriDusukData.toplamTeklif || ''} onChange={(val) => setAsiriDusukData(prev => ({ ...prev, toplamTeklif: Number(val) || 0 }))} thousandSeparator="." decimalSeparator="," min={0} />
                  </SimpleGrid>
                  <Button 
                    size="md" 
                    variant="gradient" 
                    gradient={{ from: 'orange', to: 'red' }}
                    leftSection={<IconCalculator size={16} />} 
                    onClick={hesaplaAsiriDusuk}
                  >
                    Aşırı Düşük Analiz
                  </Button>
                  {asiriDusukSonuc && (
                    <Alert mt="md" color={asiriDusukSonuc.gecerli ? 'green' : 'red'} icon={asiriDusukSonuc.gecerli ? <IconCheck size={18} /> : <IconX size={18} />}>
                      <Text fw={700}>{(asiriDusukSonuc.oran * 100).toFixed(2)}%</Text>
                      <Text size="sm">{asiriDusukSonuc.aciklama}</Text>
                    </Alert>
                  )}
                </Accordion.Panel>
              </Accordion.Item>

              {/* Süre Hesaplama */}
              <Accordion.Item value="sure">
                <Accordion.Control 
                  icon={
                    <ThemeIcon size={36} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                      <IconCalendar size={20} />
                    </ThemeIcon>
                  }
                >
                  <div>
                    <Text fw={600} size="md">İtiraz Süresi Hesaplama</Text>
                    <Text size="xs" c="dimmed">Şikayet ve itirazen şikayet süreleri</Text>
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
                    <TextInput label="Tebliğ Tarihi" type="date" value={sureData.tebligTarihi} onChange={(e) => setSureData(prev => ({ ...prev, tebligTarihi: e.target.value }))} />
                    <Select label="Başvuru Türü" value={sureData.basvuruTuru} onChange={(val) => setSureData(prev => ({ ...prev, basvuruTuru: val as 'sikayet' | 'itirazen_sikayet' }))} data={[{ value: 'sikayet', label: 'İdareye Şikayet (10 gün)' }, { value: 'itirazen_sikayet', label: 'KİK İtirazen Şikayet (10 gün)' }]} />
                  </SimpleGrid>
                  <Button 
                    size="md" 
                    variant="gradient" 
                    gradient={{ from: 'blue', to: 'cyan' }}
                    leftSection={<IconCalendar size={16} />} 
                    onClick={hesaplaSure}
                  >
                    Süre Hesapla
                  </Button>
                  {sureSonuc && (
                    <Alert mt="md" color={sureSonuc.kalanGun > 3 ? 'blue' : sureSonuc.kalanGun > 0 ? 'orange' : 'red'} icon={<IconCalendar size={18} />}>
                      <Group><Text fw={700}>Son: {sureSonuc.sonTarih.toLocaleDateString('tr-TR')}</Text><Badge>{sureSonuc.kalanGun} gün kaldı</Badge></Group>
                      {sureSonuc.uyarilar.map((u, i) => <Text key={i} size="sm" c="orange">{u}</Text>)}
                    </Alert>
                  )}
                </Accordion.Panel>
              </Accordion.Item>

              {/* Bedel Hesaplama */}
              <Accordion.Item value="bedel">
                <Accordion.Control 
                  icon={
                    <ThemeIcon size={36} radius="xl" variant="gradient" gradient={{ from: 'green', to: 'teal' }}>
                      <IconCoin size={20} />
                    </ThemeIcon>
                  }
                >
                  <div>
                    <Text fw={600} size="md">İtirazen Şikayet Bedeli</Text>
                    <Text size="xs" c="dimmed">2025 yılı güncel tarifeleri</Text>
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  <NumberInput label="Yaklaşık Maliyet (TL)" value={bedelData.yaklasikMaliyet || ''} onChange={(val) => setBedelData({ yaklasikMaliyet: Number(val) || 0 })} thousandSeparator="." decimalSeparator="," min={0} mb="md" style={{ maxWidth: 300 }} />
                  <Button 
                    size="md" 
                    variant="gradient" 
                    gradient={{ from: 'green', to: 'teal' }}
                    leftSection={<IconCoin size={16} />} 
                    onClick={hesaplaBedel}
                  >
                    Bedel Hesapla
                  </Button>
                  {bedelSonuc && (
                    <Alert mt="md" color="green" icon={<IconCoin size={18} />}>
                      <Text size="xl" fw={700}>{bedelSonuc.bedel.toLocaleString('tr-TR')} TL</Text>
                      <Text size="sm" c="dimmed">{bedelSonuc.aciklama}</Text>
                    </Alert>
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
            </Box>
          </ScrollArea>
        </Tabs.Panel>

        {/* AI DANIŞMAN TAB */}
        <Tabs.Panel value="ai">
          <Stack gap="md" h="calc(100vh - 200px)">
            {/* Quick Actions */}
            <Group gap="xs">
              {quickActions.map((action, i) => (
                <Button key={i} variant="light" size="xs" onClick={() => setInputMessage(action.prompt)}>
                  {action.label}
                </Button>
              ))}
            </Group>

            {/* Chat Area */}
            <Paper withBorder p="md" radius="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <ScrollArea style={{ flex: 1 }} offsetScrollbars>
                {messages.length === 0 ? (
                  <Stack gap="lg" align="center" py="xl">
                    <ThemeIcon size={60} radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
                      <IconBrain size={32} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600} ta="center" size="lg">İhale Danışmanınız Hazır</Text>
                      <Text c="dimmed" ta="center" size="sm">Aşağıdaki sorulardan birini seçin veya kendi sorunuzu yazın</Text>
                    </div>
                    
                    {/* Örnek Sorular */}
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" w="100%" maw={600}>
                      <Paper 
                        p="sm" 
                        withBorder 
                        radius="md" 
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        className="hover-card"
                        onClick={() => setInputMessage('Bu ihalenin tahmini karını hesapla ve analiz et.')}
                      >
                        <Group gap="xs">
                          <ThemeIcon size="sm" color="green" variant="light"><IconCoin size={14} /></ThemeIcon>
                          <Text size="sm">Kâr analizi yap</Text>
                        </Group>
                      </Paper>
                      <Paper 
                        p="sm" 
                        withBorder 
                        radius="md" 
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        className="hover-card"
                        onClick={() => setInputMessage('Bu ihale için risk değerlendirmesi yap.')}
                      >
                        <Group gap="xs">
                          <ThemeIcon size="sm" color="orange" variant="light"><IconAlertTriangle size={14} /></ThemeIcon>
                          <Text size="sm">Risk analizi</Text>
                        </Group>
                      </Paper>
                      <Paper 
                        p="sm" 
                        withBorder 
                        radius="md" 
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        className="hover-card"
                        onClick={() => setInputMessage('Teknik şartnamedeki önemli maddeleri özetle.')}
                      >
                        <Group gap="xs">
                          <ThemeIcon size="sm" color="blue" variant="light"><IconClipboardList size={14} /></ThemeIcon>
                          <Text size="sm">Şartname özeti</Text>
                        </Group>
                      </Paper>
                      <Paper 
                        p="sm" 
                        withBorder 
                        radius="md" 
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        className="hover-card"
                        onClick={() => setInputMessage('Bu ihale için rekabet analizi yap, rakipler kimler olabilir?')}
                      >
                        <Group gap="xs">
                          <ThemeIcon size="sm" color="violet" variant="light"><IconSearch size={14} /></ThemeIcon>
                          <Text size="sm">Rekabet analizi</Text>
                        </Group>
                      </Paper>
                    </SimpleGrid>
                  </Stack>
                ) : (
                  <Stack gap="md">
                    {messages.map((msg) => (
                      <Box key={msg.id} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <Paper p="sm" radius="md" bg={msg.role === 'user' ? 'blue.6' : 'gray.1'}>
                          <Text size="sm" c={msg.role === 'user' ? 'white' : undefined} style={{ whiteSpace: 'pre-wrap' }}>
                            {msg.content}
                          </Text>
                        </Paper>
                        <Text size="xs" c="dimmed" mt={4} ta={msg.role === 'user' ? 'right' : 'left'}>
                          {msg.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </Box>
                    ))}
                    {isAILoading && <Group gap="xs"><Loader size="xs" /><Text size="sm" c="dimmed">Düşünüyor...</Text></Group>}
                    <div ref={chatEndRef} />
                  </Stack>
                )}
              </ScrollArea>

              {/* Input */}
              <Box mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                <Group gap="xs">
                  <Textarea
                    placeholder="Soru sorun..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
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
                  <ActionIcon size="lg" variant="filled" color="violet" onClick={sendMessage} loading={isAILoading} disabled={!inputMessage.trim()}>
                    <IconSend size={18} />
                  </ActionIcon>
                </Group>
              </Box>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* DİLEKÇELER TAB */}
        <Tabs.Panel value="dilekce">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            {/* Aşırı Düşük Açıklama */}
            <Card 
              withBorder 
              padding="xl" 
              radius="lg"
              className="ihale-card"
              style={{ 
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.05) 0%, rgba(234, 88, 12, 0.02) 100%)',
                borderColor: 'var(--mantine-color-orange-3)'
              }}
            >
              <ThemeIcon 
                size={56} 
                radius="xl" 
                variant="gradient" 
                gradient={{ from: 'orange', to: 'red' }}
                mb="lg"
                style={{ boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)' }}
              >
                <IconFileAnalytics size={28} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb="xs">Aşırı Düşük Açıklama</Text>
              <Text size="sm" c="dimmed" mb="lg" style={{ lineHeight: 1.6 }}>
                EK-H.4 formatında aşırı düşük teklif açıklama yazısı oluşturun
              </Text>
              <Button 
                fullWidth 
                variant="gradient" 
                gradient={{ from: 'orange', to: 'red' }}
                size="md"
                radius="md"
                onClick={() => { setActiveTab('ai'); setInputMessage('Bu ihale için aşırı düşük teklif açıklama yazısı hazırla. EK-H.4 formatında olsun.'); }}
              >
                Oluştur
              </Button>
            </Card>

            {/* İdareye Şikayet */}
            <Card 
              withBorder 
              padding="xl" 
              radius="lg"
              className="ihale-card"
              style={{ 
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.02) 100%)',
                borderColor: 'var(--mantine-color-red-3)'
              }}
            >
              <ThemeIcon 
                size={56} 
                radius="xl" 
                variant="gradient" 
                gradient={{ from: 'red', to: 'pink' }}
                mb="lg"
                style={{ boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
              >
                <IconGavel size={28} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb="xs">İdareye Şikayet Dilekçesi</Text>
              <Text size="sm" c="dimmed" mb="lg" style={{ lineHeight: 1.6 }}>
                4734 sayılı Kanun kapsamında şikayet başvurusu taslağı
              </Text>
              <Button 
                fullWidth 
                variant="gradient" 
                gradient={{ from: 'red', to: 'pink' }}
                size="md"
                radius="md"
                onClick={() => { setActiveTab('ai'); setInputMessage('Bu ihale için idareye şikayet dilekçesi taslağı hazırla.'); }}
              >
                Oluştur
              </Button>
            </Card>

            {/* KİK İtirazen Şikayet */}
            <Card 
              withBorder 
              padding="xl" 
              radius="lg"
              className="ihale-card"
              style={{ 
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(124, 58, 237, 0.02) 100%)',
                borderColor: 'var(--mantine-color-violet-3)'
              }}
            >
              <ThemeIcon 
                size={56} 
                radius="xl" 
                variant="gradient" 
                gradient={{ from: 'violet', to: 'grape' }}
                mb="lg"
                style={{ boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' }}
              >
                <IconScale size={28} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb="xs">KİK İtirazen Şikayet</Text>
              <Text size="sm" c="dimmed" mb="lg" style={{ lineHeight: 1.6 }}>
                Kamu İhale Kurumuna itirazen şikayet başvurusu
              </Text>
              <Button 
                fullWidth 
                variant="gradient" 
                gradient={{ from: 'violet', to: 'grape' }}
                size="md"
                radius="md"
                onClick={() => { setActiveTab('ai'); setInputMessage('Bu ihale için KİK\'e itirazen şikayet dilekçesi hazırla.'); }}
              >
                Oluştur
              </Button>
            </Card>

            {/* Emsal Karar Araştırması */}
            <Card 
              withBorder 
              padding="xl" 
              radius="lg"
              className="ihale-card"
              style={{ 
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(37, 99, 235, 0.02) 100%)',
                borderColor: 'var(--mantine-color-blue-3)'
              }}
            >
              <ThemeIcon 
                size={56} 
                radius="xl" 
                variant="gradient" 
                gradient={{ from: 'blue', to: 'cyan' }}
                mb="lg"
                style={{ boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)' }}
              >
                <IconSearch size={28} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb="xs">Emsal Karar Araştırması</Text>
              <Text size="sm" c="dimmed" mb="lg" style={{ lineHeight: 1.6 }}>
                Benzer KİK kararlarını araştırın ve inceleyin
              </Text>
              <Button 
                fullWidth 
                variant="gradient" 
                gradient={{ from: 'blue', to: 'cyan' }}
                size="md"
                radius="md"
                onClick={() => { setActiveTab('ai'); setInputMessage('Bu ihale konusunda benzer KİK kararlarını araştır.'); }}
              >
                Araştır
              </Button>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
