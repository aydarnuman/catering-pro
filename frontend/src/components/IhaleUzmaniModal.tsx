'use client';

import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Chip,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconBrain,
  IconBulb,
  IconCalculator,
  IconCalendar,
  IconCheck,
  IconClipboardList,
  IconCloudCheck,
  IconCoin,
  IconDownload,
  IconEye,
  IconFileAnalytics,
  IconFileText,
  IconGavel,
  IconInfoCircle,
  IconMathFunction,
  IconNote,
  IconReportMoney,
  IconScale,
  IconSearch,
  IconSend,
  IconSettings,
  IconSparkles,
  IconTrash,
  IconX,
  IconPlus,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { NotesSection } from '@/components/NotesSection';

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
  /** @deprecated NotesSection handles notes internally now */
  onAddNote?: (id: string, text: string) => void;
  /** @deprecated NotesSection handles notes internally now */
  onDeleteNote?: (trackingId: string, noteId: string) => void;
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
  // Deprecated props - NotesSection handles notes internally
  onAddNote: _onAddNote,
  onDeleteNote: _onDeleteNote,
}: IhaleUzmaniModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<string | null>('ozet');
  
  // Soru havuzu kategori seçimi
  const [selectedQuestionCategory, setSelectedQuestionCategory] = useState<string>('teknik');

  // Analysis data
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [liveAnalysisData, setLiveAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisStats, setAnalysisStats] = useState<{
    toplam_dokuman: number;
    analiz_edilen: number;
  } | null>(null);

  // Save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dataLoaded, setDataLoaded] = useState(false);

  // Hesaplama states
  const [yaklasikMaliyet, setYaklasikMaliyet] = useState<number>(0);
  const [sinirDeger, setSinirDeger] = useState<number | null>(null);
  const [bizimTeklif, setBizimTeklif] = useState<number>(0);
  const [teklifListesi, setTeklifListesi] = useState<{ firma: string; tutar: number }[]>([
    { firma: '', tutar: 0 },
    { firma: '', tutar: 0 },
  ]);
  const [hesaplananSinirDeger, setHesaplananSinirDeger] = useState<number | null>(null);

  // Aşırı düşük - Maliyet Bileşenleri
  const [maliyetBilesenleri, setMaliyetBilesenleri] = useState({
    anaCigGirdi: 0,
    yardimciGirdi: 0,
    iscilik: 0,
    nakliye: 0,
    sozlesmeGideri: 0,
    genelGider: 0,
    kar: 0,
  });
  const [asiriDusukSonuc, setAsiriDusukSonuc] = useState<{
    toplamMaliyet: number;
    asiriDusukMu: boolean;
    fark: number;
    farkOran: number;
    aciklama: string;
  } | null>(null);

  // Teminat Hesaplama
  const [teminatSonuc, setTeminatSonuc] = useState<{
    geciciTeminat: number;
    kesinTeminat: number;
    damgaVergisi: number;
  } | null>(null);

  // Bedel
  const [bedelData, setBedelData] = useState({ yaklasikMaliyet: 0 });
  const [bedelSonuc, setBedelSonuc] = useState<{ bedel: number; aciklama: string } | null>(null);

  // AI Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Dilekçe Tab States
  const [dilekceType, setDilekceType] = useState<string | null>(null);
  const [dilekceContent, setDilekceContent] = useState('');
  const [dilekceMessages, setDilekceMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [dilekceInput, setDilekceInput] = useState('');
  const [dilekceLoading, setDilekceLoading] = useState(false);
  const [dilekceSessionId, setDilekceSessionId] = useState<string | null>(null);
  const dilekceEndRef = useRef<HTMLDivElement>(null);

  const dilekceTypeLabels: Record<string, string> = {
    asiri_dusuk: 'Aşırı Düşük Teklif Açıklaması',
    idare_sikayet: 'İdareye Şikayet Dilekçesi',
    kik_itiraz: 'KİK İtirazen Şikayet Dilekçesi',
    aciklama_cevabi: 'İdare Açıklama Cevabı',
  };

  // Auto-save debounced function
  const saveHesaplamaData = useDebouncedCallback(async () => {
    if (!tender || !dataLoaded) return;

    setSaveStatus('saving');
    try {
      const hesaplamaVerileri = {
        teklif_listesi: teklifListesi.filter((t) => t.tutar > 0),
        maliyet_bilesenleri: maliyetBilesenleri,
        son_kayit: new Date().toISOString(),
      };

      await fetch(`${API_BASE_URL}/api/tender-tracking/${tender.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yaklasik_maliyet: yaklasikMaliyet || null,
          sinir_deger: sinirDeger || null,
          bizim_teklif: bizimTeklif || null,
          hesaplama_verileri: hesaplamaVerileri,
        }),
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
  }, [yaklasikMaliyet, sinirDeger, bizimTeklif, dataLoaded, saveHesaplamaData]);

  // Load saved data and analysis when tender changes
  useEffect(() => {
    if (opened && tender) {
      setDataLoaded(false);
      
      // ÖNCE hesaplama verilerini sıfırla (yeni ihale için temiz başla)
      // Sonra loadSavedHesaplamaData() ile doğru verileri yükle
      setYaklasikMaliyet(0);
      setSinirDeger(null);
      setBizimTeklif(0);
      setTeklifListesi([{ firma: '', tutar: 0 }, { firma: '', tutar: 0 }]);
      setMaliyetBilesenleri({
        anaCigGirdi: 0,
        yardimciGirdi: 0,
        iscilik: 0,
        nakliye: 0,
        sozlesmeGideri: 0,
        genelGider: 0,
        kar: 0,
      });
      setBedelData({ yaklasikMaliyet: 0 });
      setBedelSonuc(null);
      setAsiriDusukSonuc(null);
      setTeminatSonuc(null);
      setDilekceContent('');
      setDilekceType(null);
      
      // Sonra verileri yükle (async)
      loadAnalysisData();
      loadSavedHesaplamaData().catch((error) => {
        console.error('Hesaplama verisi yükleme hatası:', error);
      });
      
      // SessionId'leri oluştur ve conversation'ları yükle
      const tenderSessionId = `ihale_${tender.tender_id || tender.id}`;
      const dilekceSessId = `ihale_${tender.tender_id || tender.id}_dilekce`;
      
      setChatSessionId(tenderSessionId);
      setDilekceSessionId(dilekceSessId);
      
      // Önceki conversation'ları yükle
      loadConversations(tenderSessionId);
      loadDilekceConversations(dilekceSessId);
    } else if (!opened) {
      // Modal kapandığında conversation state'lerini temizle
      // Hesaplama verileri de temizlenir ama ZATEN VERİTABANINDA KAYDEDİLMİŞ
      // Modal tekrar açıldığında loadSavedHesaplamaData() ile yüklenecek
      setMessages([]);
      setDilekceMessages([]);
      setChatSessionId(null);
      setDilekceSessionId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, tender?.tender_id]);

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
            yaklasik_maliyet:
              yaklasikMaliyet > 0 ? `${yaklasikMaliyet.toLocaleString('tr-TR')} TL` : null,
            sinir_deger: sinirDeger ? `${sinirDeger.toLocaleString('tr-TR')} TL` : null,
            bizim_teklif: bizimTeklif > 0 ? `${bizimTeklif.toLocaleString('tr-TR')} TL` : null,
            teklif_listesi: teklifListesi
              .filter((t) => t.tutar > 0)
              .map((t) => `${t.firma}: ${t.tutar.toLocaleString('tr-TR')} TL`),
            // Analiz özeti
            teknik_sart_sayisi: getAnalysisData().teknik_sartlar?.length || 0,
            birim_fiyat_sayisi: getAnalysisData().birim_fiyatlar?.length || 0,
          },
        },
      });
      window.dispatchEvent(contextEvent);
    }

    // Modal kapandığında context'i sıfırla
    if (!opened && typeof window !== 'undefined') {
      const contextEvent = new CustomEvent('ai-context-update', {
        detail: { type: 'general' },
      });
      window.dispatchEvent(contextEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, tender, yaklasikMaliyet, sinirDeger, bizimTeklif, teklifListesi]);

  // Load saved hesaplama data from tender - API'den güncel veriyi çek
  const loadSavedHesaplamaData = async () => {
    if (!tender) return;

    try {
      // Önce API'den güncel veriyi çek
      const response = await fetch(`${API_BASE_URL}/api/tender-tracking`);
      const result = await response.json();

      if (result.success && result.data) {
        // Bu ihale için güncel kaydı bul
        const currentTracking = result.data.find(
          (t: any) => t.id.toString() === tender.id || t.tender_id === tender.tender_id
        );

        if (currentTracking) {
          // Güncel verilerden yükle
          if (currentTracking.yaklasik_maliyet) {
            const yaklasikMaliyetValue = parseFloat(currentTracking.yaklasik_maliyet);
            setYaklasikMaliyet(yaklasikMaliyetValue);
            setBedelData({ yaklasikMaliyet: yaklasikMaliyetValue });
          } else if (tender.bedel) {
            // Fallback: parse from bedel string
            const numericBedel = parseFloat(tender.bedel.replace(/[^\d,]/g, '').replace(',', '.'));
            if (!Number.isNaN(numericBedel)) {
              setYaklasikMaliyet(numericBedel);
              setBedelData({ yaklasikMaliyet: numericBedel });
            }
          }

          if (currentTracking.sinir_deger) {
            setSinirDeger(parseFloat(currentTracking.sinir_deger));
          }

          if (currentTracking.bizim_teklif) {
            setBizimTeklif(parseFloat(currentTracking.bizim_teklif));
          }

          // Load hesaplama_verileri JSON (backend'den JSONB olarak gelir)
          if (currentTracking.hesaplama_verileri) {
            const hv =
              typeof currentTracking.hesaplama_verileri === 'string'
                ? JSON.parse(currentTracking.hesaplama_verileri)
                : currentTracking.hesaplama_verileri;

            if (hv && typeof hv === 'object') {
              if (hv.teklif_listesi && Array.isArray(hv.teklif_listesi) && hv.teklif_listesi.length >= 2) {
                setTeklifListesi(hv.teklif_listesi);
              }
              if (hv.maliyet_bilesenleri && typeof hv.maliyet_bilesenleri === 'object') {
                setMaliyetBilesenleri({
                  anaCigGirdi: hv.maliyet_bilesenleri.anaCigGirdi || 0,
                  yardimciGirdi: hv.maliyet_bilesenleri.yardimciGirdi || 0,
                  iscilik: hv.maliyet_bilesenleri.iscilik || 0,
                  nakliye: hv.maliyet_bilesenleri.nakliye || 0,
                  sozlesmeGideri: hv.maliyet_bilesenleri.sozlesmeGideri || 0,
                  genelGider: hv.maliyet_bilesenleri.genelGider || 0,
                  kar: hv.maliyet_bilesenleri.kar || 0,
                });
              }
            }
          }

          // Mark data as loaded (enables auto-save)
          setTimeout(() => setDataLoaded(true), 500);
          return;
        }
      }
    } catch (error) {
      console.error('Güncel veri yükleme hatası:', error);
      // Hata durumunda fallback: tender objesinden yükle
    }

    // Fallback: tender objesinden yükle (API hatası durumunda)
    const tenderAny = tender as any;

    if (tenderAny.yaklasik_maliyet) {
      setYaklasikMaliyet(parseFloat(tenderAny.yaklasik_maliyet));
      setBedelData({ yaklasikMaliyet: parseFloat(tenderAny.yaklasik_maliyet) });
    } else if (tender.bedel) {
      // Fallback: parse from bedel string
      const numericBedel = parseFloat(tender.bedel.replace(/[^\d,]/g, '').replace(',', '.'));
      if (!Number.isNaN(numericBedel)) {
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
      const hv =
        typeof tenderAny.hesaplama_verileri === 'string'
          ? JSON.parse(tenderAny.hesaplama_verileri)
          : tenderAny.hesaplama_verileri;

      if (hv.teklif_listesi && Array.isArray(hv.teklif_listesi) && hv.teklif_listesi.length >= 2) {
        setTeklifListesi(hv.teklif_listesi);
      }
      if (hv.maliyet_bilesenleri) {
        setMaliyetBilesenleri(hv.maliyet_bilesenleri);
      }
    }

    // Mark data as loaded (enables auto-save)
    setTimeout(() => setDataLoaded(true), 500);
  };

  // Scroll chat to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  // Dilekçe chat auto-scroll
  useEffect(() => {
    if (dilekceMessages.length > 0) {
      dilekceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dilekceMessages]);

  // Önceki conversation'ları yükle
  const loadConversations = async (sessionId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/ai/conversations/${sessionId}?userId=default`
      );
      
      if (!response.ok) {
        // Session yoksa boş array döndür
        return;
      }
      
      const result = await response.json();
      
      if (result.success && result.messages && result.messages.length > 0) {
        // Backend'den gelen mesajları ChatMessage formatına çevir
        const loadedMessages: ChatMessage[] = result.messages.map((msg: any, index: number) => ({
          id: `${msg.id || index}`,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }));
        
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Conversation yükleme hatası:', error);
      // Hata durumunda devam et, boş başla
    }
  };

  // Dilekçe conversation'larını yükle
  const loadDilekceConversations = async (sessionId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/ai/conversations/${sessionId}?userId=default`
      );
      
      if (!response.ok) {
        // Session yoksa boş array döndür
        return;
      }
      
      const result = await response.json();
      
      if (result.success && result.messages && result.messages.length > 0) {
        // Backend'den gelen mesajları dilekçe formatına çevir
        const loadedMessages = result.messages.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));
        
        setDilekceMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Dilekçe conversation yükleme hatası:', error);
      // Hata durumunda devam et, boş başla
    }
  };

  const loadAnalysisData = async () => {
    if (!tender) return;
    try {
      setAnalysisLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/tender-tracking/${tender.tender_id}/analysis`
      );
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

    const gecerliTeklifler = teklifListesi.filter((t) => t.tutar > 0).map((t) => t.tutar);
    const n = gecerliTeklifler.length;

    if (n < 2) {
      notifications.show({
        title: 'Hata',
        message: 'En az 2 geçerli teklif gerekli',
        color: 'red',
      });
      return;
    }

    const toplam = gecerliTeklifler.reduce((a, b) => a + b, 0);
    const Tort1 = toplam / n;
    const varyans = gecerliTeklifler.reduce((acc, t) => acc + (t - Tort1) ** 2, 0) / (n - 1);
    const stdSapma = Math.sqrt(varyans);
    const altSinir = Tort1 - stdSapma;
    const ustSinir = Tort1 + stdSapma;
    const aralikTeklifler = gecerliTeklifler.filter((t) => t >= altSinir && t <= ustSinir);

    let Tort2 = Tort1;
    if (aralikTeklifler.length > 0) {
      Tort2 = aralikTeklifler.reduce((a, b) => a + b, 0) / aralikTeklifler.length;
    }

    const C = Tort2 / yaklasikMaliyet;
    let K: number;
    if (C < 0.6) K = C;
    else if (C <= 1.0) K = (3.2 * C - C * C - 0.6) / (C + 1);
    else K = 1;

    const calculatedSinirDeger = K * Tort2;
    setHesaplananSinirDeger(calculatedSinirDeger);
    setSinirDeger(calculatedSinirDeger);
  }, [yaklasikMaliyet, teklifListesi]);

  // Aşırı düşük hesaplama
  // Aşırı Düşük Analizi - Sınır değer karşılaştırması + Maliyet bileşenleri
  const hesaplaAsiriDusuk = useCallback(() => {
    if (!sinirDeger || sinirDeger <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Önce sınır değer hesaplayın veya girin',
        color: 'red',
      });
      return;
    }
    if (bizimTeklif <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Bizim teklif tutarını girin',
        color: 'red',
      });
      return;
    }

    const { anaCigGirdi, yardimciGirdi, iscilik, nakliye, sozlesmeGideri, genelGider, kar } = maliyetBilesenleri;
    const toplamMaliyet = anaCigGirdi + yardimciGirdi + iscilik + nakliye + sozlesmeGideri + genelGider + kar;
    const asiriDusukMu = bizimTeklif < sinirDeger;
    const fark = sinirDeger - bizimTeklif;
    const farkOran = ((sinirDeger - bizimTeklif) / sinirDeger) * 100;

    let aciklama = '';
    if (asiriDusukMu) {
      aciklama = `Teklifiniz sınır değerin %${farkOran.toFixed(1)} altında. AŞIRI DÜŞÜK TEKLİF açıklaması yapmanız gerekiyor!`;
      if (toplamMaliyet > 0 && toplamMaliyet > bizimTeklif) {
        aciklama += ` Maliyet bileşenleriniz (${toplamMaliyet.toLocaleString('tr-TR')} TL) teklifinizden yüksek - DİKKAT!`;
      }
    } else {
      aciklama = 'Teklifiniz sınır değerin üzerinde. Aşırı düşük teklif açıklaması gerekmez.';
    }

    setAsiriDusukSonuc({
      toplamMaliyet,
      asiriDusukMu,
      fark,
      farkOran,
      aciklama,
    });
  }, [sinirDeger, bizimTeklif, maliyetBilesenleri]);

  // Teminat Hesaplama
  const hesaplaTeminat = useCallback(() => {
    if (bizimTeklif <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Bizim teklif tutarını girin',
        color: 'red',
      });
      return;
    }

    const geciciTeminat = bizimTeklif * 0.03; // %3
    const kesinTeminat = bizimTeklif * 0.06; // %6
    const damgaVergisi = bizimTeklif * 0.00569; // Binde 5.69 (2025)

    setTeminatSonuc({
      geciciTeminat,
      kesinTeminat,
      damgaVergisi,
    });
  }, [bizimTeklif]);

  // Süre hesaplama
  // İtirazen Şikayet Bedeli - 2026 Tarifeleri (%27.67 Yİ-ÜFE güncellemesi)
  const hesaplaBedel = useCallback(() => {
    const ym = bedelData.yaklasikMaliyet || yaklasikMaliyet;
    if (ym <= 0) {
      notifications.show({ title: 'Hata', message: 'Yaklaşık maliyet giriniz', color: 'red' });
      return;
    }

    // 2026 Tarifeleri (2025'e %27.67 Yİ-ÜFE uygulanmış)
    let bedel = 0;
    let aciklama = '';

    if (ym <= 10784287) {
      // 8.447.946 * 1.2767 ≈ 10.784.287
      bedel = 64645; // 50.640 * 1.2767
      aciklama = "10.784.287 TL'ye kadar olan ihaleler (2026)";
    } else if (ym <= 43141277) {
      // 33.791.911 * 1.2767 ≈ 43.141.277
      bedel = 129386; // 101.344 * 1.2767
      aciklama = '10.784.287 TL - 43.141.277 TL arası (2026)';
    } else if (ym <= 323566614) {
      // 253.439.417 * 1.2767 ≈ 323.566.614
      bedel = 194085; // 152.021 * 1.2767
      aciklama = '43.141.277 TL - 323.566.614 TL arası (2026)';
    } else {
      bedel = 258790; // 202.718 * 1.2767
      aciklama = '323.566.614 TL üstü (2026)';
    }

    setBedelSonuc({ bedel, aciklama });
  }, [bedelData, yaklasikMaliyet]);

  // AI Chat
  const sendMessage = async () => {
    if (!inputMessage.trim() || !tender) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsAILoading(true);

    try {
      // Analiz verilerini al
      const analysis = getAnalysisData();
      
      // Context oluştur - İhale temel bilgileri
      let context = `📋 SEÇİLİ İHALE:\n- Başlık: ${tender.ihale_basligi}\n- Kurum: ${tender.kurum}\n`;
      if (tender.bedel) context += `- Tahmini Bedel: ${tender.bedel}\n`;
      if (tender.tarih) context += `- Tarih: ${tender.tarih}\n`;
      if (yaklasikMaliyet > 0)
        context += `- Yaklaşık Maliyet: ${yaklasikMaliyet.toLocaleString('tr-TR')} TL\n`;
      if (sinirDeger) context += `- Sınır Değer: ${sinirDeger.toLocaleString('tr-TR')} TL\n`;
      if (bizimTeklif > 0) context += `- Bizim Teklif: ${bizimTeklif.toLocaleString('tr-TR')} TL\n`;
      
      // Döküman analiz verilerini context'e ekle
      if (analysis.teknik_sartlar && analysis.teknik_sartlar.length > 0) {
        context += `\n📝 TEKNİK ŞARTLAR (${analysis.teknik_sartlar.length} adet):\n`;
        // İlk 20 şartı ekle (token limiti için)
        analysis.teknik_sartlar.slice(0, 20).forEach((sart, i) => {
          context += `${i + 1}. ${sart}\n`;
        });
        if (analysis.teknik_sartlar.length > 20) {
          context += `... ve ${analysis.teknik_sartlar.length - 20} şart daha\n`;
        }
      }
      
      if (analysis.birim_fiyatlar && analysis.birim_fiyatlar.length > 0) {
        context += `\n💰 BİRİM FİYATLAR (${analysis.birim_fiyatlar.length} kalem):\n`;
        // İlk 15 kalemi ekle
        analysis.birim_fiyatlar.slice(0, 15).forEach((item, i) => {
          if (typeof item === 'object') {
            context += `${i + 1}. ${item.kalem || item.aciklama || '-'}: ${item.miktar || '-'} ${item.birim || ''} - ${item.fiyat || item.tutar || '-'}\n`;
          } else {
            context += `${i + 1}. ${item}\n`;
          }
        });
        if (analysis.birim_fiyatlar.length > 15) {
          context += `... ve ${analysis.birim_fiyatlar.length - 15} kalem daha\n`;
        }
      }
      
      if (analysis.notlar && analysis.notlar.length > 0) {
        context += `\n⚠️ AI NOTLARI:\n`;
        analysis.notlar.slice(0, 10).forEach((not) => {
          context += `• ${not}\n`;
        });
      }
      
      if (analysis.tam_metin && analysis.tam_metin.length > 0) {
        // Tam metinden özet (ilk 8000 karakter - daha fazla bilgi içermesi için artırıldı)
        const tamMetinOzet = analysis.tam_metin.substring(0, 8000);
        context += `\n📄 DÖKÜMAN TAM METİN:\n${tamMetinOzet}${analysis.tam_metin.length > 8000 ? '\n... (devamı var, detay için ihale_get_ihale_dokumanlari tool\'unu kullan)' : ''}\n`;
      }
      
      // İhale ID'sini ekle (AI tool kullanabilsin)
      context += `\n🔑 İHALE ID: ${tender.tender_id || tender.id}\n`;
      context += '\n---\nYukarıdaki ihale bilgileri ve döküman analizlerini baz alarak cevap ver. Eğer detaylı bilgi gerekirse ihale_get_ihale_dokumanlari tool\'unu kullanabilirsin.\n\n';

      const response = await fetch(`${API_BASE_URL}/api/ai/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          message: context + inputMessage,
          sessionId: chatSessionId || undefined,
          context: 'ihale_uzmani',
          model: 'claude-sonnet-4-20250514',
          pageContext: tender ? {
            type: 'tender',
            id: tender.tender_id || tender.id,
            title: tender.ihale_basligi,
          } : undefined,
        }),
      });

      if (!response.ok) throw new Error('AI yanıt vermedi');

      const data = await response.json();

      // Backend'den sessionId gelirse onu kullan (eğer henüz set edilmemişse)
      if (data.sessionId && !chatSessionId) {
        setChatSessionId(data.sessionId);
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'Yanıt alınamadı',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Error:', error);
      notifications.show({ title: 'Hata', message: 'AI yanıt veremedi', color: 'red' });
    } finally {
      setIsAILoading(false);
    }
  };

  // Dilekçe Chat Handler
  const handleDilekceChat = async (customMessage?: string) => {
    if (!tender || !dilekceType) return;

    const userInput = customMessage || dilekceInput;
    
    // Kullanıcı mesajı varsa ekle ve kaydet
    if (userInput.trim() && dilekceSessionId) {
      setDilekceMessages((prev) => [...prev, { role: 'user', content: userInput }]);
      setDilekceInput('');
      
      // Kullanıcı mesajını backend'e kaydet
      try {
        await fetch(`${API_BASE_URL}/api/ai-memory/conversation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            session_id: dilekceSessionId,
            user_id: 'default',
            role: 'user',
            content: userInput,
            tools_used: [],
            metadata: { type: 'dilekce_chat', dilekce_type: dilekceType },
          }),
        });
      } catch (error) {
        console.error('Kullanıcı mesajı kaydetme hatası:', error);
        // Hata olsa bile devam et
      }
    }

    setDilekceLoading(true);

    try {
      const analysis = getAnalysisData();
      
      // Dilekçe türüne göre prompt oluştur
      let prompt = '';
      const ihaleBilgi = `
İHALE BİLGİLERİ:
- Başlık: ${tender.ihale_basligi}
- Kurum: ${tender.kurum}
- İhale No: ${tender.external_id || 'Bilinmiyor'}
- Tarih: ${tender.tarih || 'Bilinmiyor'}
- Yaklaşık Maliyet: ${yaklasikMaliyet > 0 ? yaklasikMaliyet.toLocaleString('tr-TR') + ' TL' : tender.bedel || 'Bilinmiyor'}
- Sınır Değer: ${sinirDeger ? sinirDeger.toLocaleString('tr-TR') + ' TL' : 'Hesaplanmadı'}
- Bizim Teklif: ${bizimTeklif > 0 ? bizimTeklif.toLocaleString('tr-TR') + ' TL' : 'Girilmedi'}
`;

      const maliyetBilgi = `
MALİYET BİLEŞENLERİ:
- Ana Çiğ Girdi: ${maliyetBilesenleri.anaCigGirdi.toLocaleString('tr-TR')} TL
- Yardımcı Girdi: ${maliyetBilesenleri.yardimciGirdi.toLocaleString('tr-TR')} TL
- İşçilik: ${maliyetBilesenleri.iscilik.toLocaleString('tr-TR')} TL
- Nakliye: ${maliyetBilesenleri.nakliye.toLocaleString('tr-TR')} TL
- Sözleşme Gideri: ${maliyetBilesenleri.sozlesmeGideri.toLocaleString('tr-TR')} TL
- Genel Gider + Kar: ${(maliyetBilesenleri.genelGider + maliyetBilesenleri.kar).toLocaleString('tr-TR')} TL
- TOPLAM: ${Object.values(maliyetBilesenleri).reduce((a, b) => a + b, 0).toLocaleString('tr-TR')} TL
`;

      switch (dilekceType) {
        case 'asiri_dusuk':
          prompt = `Sen bir ihale hukuku uzmanısın. Aşağıdaki ihale için EK-H.4 formatında AŞIRI DÜŞÜK TEKLİF AÇIKLAMASI hazırla.

${ihaleBilgi}
${maliyetBilgi}

${userInput ? `KULLANICI İSTEĞİ: ${userInput}\n` : ''}

KURALLAR:
1. Resmi dilekçe formatında yaz
2. EK-H.4 Malzemeli Yemek Sunumu Hesap Cetveli formatını kullan
3. 4734 sayılı Kanun ve Hizmet Alımı İhaleleri Uygulama Yönetmeliği'ne atıf yap
4. Maliyet bileşenlerini tablo halinde sun
5. Teklifin ekonomik olarak sürdürülebilir olduğunu açıkla
6. Tarih ve imza alanı bırak`;
          break;

        case 'idare_sikayet':
          prompt = `Sen bir ihale hukuku uzmanısın. Aşağıdaki ihale için İDAREYE ŞİKAYET DİLEKÇESİ hazırla.

${ihaleBilgi}

${userInput ? `ŞİKAYET KONUSU/SEBEBİ: ${userInput}\n` : 'Kullanıcı şikayet konusunu belirtmedi, genel bir şablon hazırla.\n'}

KURALLAR:
1. 4734 sayılı Kanun 54. maddesine uygun format kullan
2. Şikayet süresinin 10 gün olduğunu belirt
3. Tebliğ tarihinden itibaren süre başlangıcını not düş
4. İdareye hitap eden resmi format kullan
5. Talep kısmını net yaz (düzeltici işlem/iptal)
6. Tarih ve imza alanı bırak`;
          break;

        case 'kik_itiraz':
          prompt = `Sen bir ihale hukuku uzmanısın. Aşağıdaki ihale için KİK'e İTİRAZEN ŞİKAYET DİLEKÇESİ hazırla.

${ihaleBilgi}

${userInput ? `İTİRAZ KONUSU: ${userInput}\n` : 'Kullanıcı itiraz konusunu belirtmedi, genel bir şablon hazırla.\n'}

KURALLAR:
1. 4734 sayılı Kanun 56. maddesine uygun format kullan
2. Kamu İhale Kurumu Başkanlığına hitap et
3. İdareye yapılan şikayet özeti ekle
4. İtirazen şikayet bedeli bilgisini ekle
5. 10 günlük süreyi belirt
6. Emsal KİK kararlarına atıf yap
7. Tarih ve imza alanı bırak`;
          break;

        case 'aciklama_cevabi':
          prompt = `Sen bir ihale hukuku uzmanısın. Aşağıdaki ihale için İDARE AÇIKLAMA TALEBİNE CEVAP hazırla.

${ihaleBilgi}
${maliyetBilgi}

${userInput ? `AÇIKLAMA TALEBİ KONUSU: ${userInput}\n` : 'Kullanıcı açıklama konusunu belirtmedi, genel bir şablon hazırla.\n'}

KURALLAR:
1. İdare talebine cevap formatı kullan
2. Talep edilen bilgileri net ve açık sun
3. Destekleyici belgelere atıf yap
4. Profesyonel ve resmi dil kullan
5. Tarih ve imza alanı bırak`;
          break;
      }

      // AI'a gönder
      const response = await fetch(`${API_BASE_URL}/api/ai/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          message: prompt,
          sessionId: dilekceSessionId || undefined,
          context: 'dilekce_olustur',
          model: 'claude-sonnet-4-20250514',
          pageContext: tender ? {
            type: 'tender',
            id: tender.tender_id || tender.id,
            title: tender.ihale_basligi,
          } : undefined,
        }),
      });

      if (!response.ok) throw new Error('AI yanıt vermedi');

      const data = await response.json();
      const aiResponse = data.response || data.message || 'Dilekçe oluşturulamadı';

      // Backend'den sessionId gelirse onu kullan (eğer henüz set edilmemişse)
      const finalSessionId = data.sessionId || dilekceSessionId;
      if (data.sessionId && !dilekceSessionId) {
        setDilekceSessionId(data.sessionId);
      }

      // AI cevabını mesajlara ekle
      const assistantMessageContent = 'Dilekçeniz hazırlandı. Sağ panelde görüntüleyebilirsiniz.';
      setDilekceMessages((prev) => [...prev, { role: 'assistant', content: assistantMessageContent }]);
      
      // AI cevabını backend'e kaydet (eğer sessionId varsa)
      if (finalSessionId) {
        try {
          await fetch(`${API_BASE_URL}/api/ai-memory/conversation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({
              session_id: finalSessionId,
              user_id: 'default',
              role: 'assistant',
              content: assistantMessageContent,
              tools_used: data.toolsUsed || [],
              metadata: { 
                type: 'dilekce_chat', 
                dilekce_type: dilekceType,
                dilekce_content_preview: aiResponse.substring(0, 500) // İlk 500 karakter önizleme
              },
            }),
          });
        } catch (error) {
          console.error('AI cevabı kaydetme hatası:', error);
          // Hata olsa bile devam et
        }
      }
      
      // Dilekçe içeriğini set et
      setDilekceContent(aiResponse);

    } catch (error) {
      console.error('Dilekçe oluşturma hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Dilekçe oluşturulurken bir hata oluştu',
        color: 'red',
      });
      setDilekceMessages((prev) => [...prev, { role: 'assistant', content: 'Üzgünüm, dilekçe oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.' }]);
    } finally {
      setDilekceLoading(false);
    }
  };

  // Dilekçe İndirme
  const downloadDilekce = (format: 'docx' | 'pdf') => {
    if (!dilekceContent || !tender) return;

    // Basit metin dosyası olarak indir (gerçek Word/PDF için backend gerekir)
    const filename = `${dilekceTypeLabels[dilekceType || 'dilekce']}_${tender.external_id || tender.id}.txt`;
    const blob = new Blob([dilekceContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notifications.show({
      title: 'İndirildi',
      message: `${filename} indirildi. Word/PDF formatı için metni kopyalayıp yapıştırabilirsiniz.`,
      color: 'green',
    });
  };

  // JSON export
  const downloadJSON = () => {
    if (!tender) return;
    const exportData = {
      ihale_bilgileri: {
        baslik: tender.ihale_basligi,
        kurum: tender.kurum,
        tarih: tender.tarih,
        bedel: tender.bedel,
        durum: statusConfig[tender.status].label,
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
        <Box
          className="modal-header-glass"
          style={{ margin: 0, padding: '16px 20px', borderRadius: 16 }}
        >
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
                <Text fw={700} size="lg">
                  İhale Uzmanı
                </Text>
                <Badge variant="gradient" gradient={{ from: 'violet', to: 'grape' }} size="sm">
                  PRO
                </Badge>
              </Group>
              <Text size="sm" c="dimmed" lineClamp={1} maw={500}>
                {tender.ihale_basligi}
              </Text>
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
        },
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
                  onChange={(value) =>
                    value && onUpdateStatus(tender.id, value as SavedTender['status'])
                  }
                  data={Object.entries(statusConfig).map(([key, val]) => ({
                    value: key,
                    label: `${val.icon} ${val.label}`,
                  }))}
                  w={160}
                  size="sm"
                />
                {analysisLoading && <Loader size="xs" />}
              </Group>
              <Group gap="xs">
                <Button
                  variant="outline"
                  size="xs"
                  leftSection={<IconEye size={14} />}
                  component={Link}
                  href={`/tenders/${tender.tender_id}`}
                  target="_blank"
                >
                  Detay
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  leftSection={<IconDownload size={14} />}
                  onClick={downloadJSON}
                >
                  JSON
                </Button>
                <Button
                  variant="outline"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => onDelete(tender.id)}
                >
                  Sil
                </Button>
              </Group>
            </Group>

            {/* Özet Kartları */}
            <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm">
              <Tooltip
                label={tender.ihale_basligi}
                multiline
                w={300}
                withArrow
                disabled={!tender.ihale_basligi}
              >
                <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
                  <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
                    İhale Başlığı
                  </Text>
                  <Text size="sm" fw={500} lineClamp={2}>
                    {tender.ihale_basligi || (
                      <Text span c="gray.5">
                        Belirtilmemiş
                      </Text>
                    )}
                  </Text>
                </Paper>
              </Tooltip>
              <Tooltip label={tender.kurum} multiline w={300} withArrow disabled={!tender.kurum}>
                <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
                  <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
                    Kurum
                  </Text>
                  <Text size="sm" fw={500} lineClamp={2}>
                    {tender.kurum || (
                      <Text span c="gray.5">
                        Belirtilmemiş
                      </Text>
                    )}
                  </Text>
                </Paper>
              </Tooltip>
              <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
                <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
                  Tarih
                </Text>
                <Text size="sm" fw={600}>
                  {tender.tarih || (
                    <Text span c="gray.5">
                      Belirtilmemiş
                    </Text>
                  )}
                </Text>
              </Paper>
              <Paper
                p="sm"
                withBorder
                radius="md"
                shadow="xs"
                style={{ borderColor: tender.bedel ? 'var(--mantine-color-green-5)' : undefined }}
                className="hover-card"
              >
                <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
                  Tahmini Bedel
                </Text>
                <Text size="sm" fw={700} c={tender.bedel ? 'green' : 'gray.5'}>
                  {tender.bedel || 'Belirtilmemiş'}
                </Text>
              </Paper>
              <Paper p="sm" withBorder radius="md" shadow="xs" className="hover-card">
                <Text size="xs" c="gray.6" tt="uppercase" fw={600} mb={4}>
                  Şehir
                </Text>
                <Text size="sm" fw={500}>
                  {tender.city || (
                    <Text span c="gray.5">
                      Belirtilmemiş
                    </Text>
                  )}
                </Text>
              </Paper>
            </SimpleGrid>

            {/* Hesaplama Özeti - Hesaplamalar sekmesine yönlendirme */}
            {(yaklasikMaliyet > 0 || sinirDeger || bizimTeklif > 0) ? (
              <Paper 
                p="md" 
                withBorder 
                radius="md" 
                shadow="sm"
                style={{
                  background: sinirDeger && bizimTeklif > 0
                    ? bizimTeklif < sinirDeger 
                      ? 'linear-gradient(135deg, rgba(255,244,230,0.5) 0%, rgba(255,255,255,1) 100%)'
                      : 'linear-gradient(135deg, rgba(235,251,238,0.5) 0%, rgba(255,255,255,1) 100%)'
                    : 'var(--mantine-color-gray-0)',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('hesaplamalar')}
              >
                <Group justify="space-between">
                  <Group gap="md">
                    <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }} radius="xl">
                      <IconCalculator size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600} size="sm">Teklif Hesaplamaları</Text>
                      <Group gap="lg" mt={4}>
                        {yaklasikMaliyet > 0 && (
                          <Text size="xs" c="dimmed">
                            Maliyet: <strong>{yaklasikMaliyet.toLocaleString('tr-TR')} TL</strong>
                          </Text>
                        )}
                        {sinirDeger && (
                          <Text size="xs" c="dimmed">
                            Sınır: <strong>{sinirDeger.toLocaleString('tr-TR')} TL</strong>
                          </Text>
                        )}
                        {bizimTeklif > 0 && (
                          <Text size="xs" c="dimmed">
                            Teklif: <strong>{bizimTeklif.toLocaleString('tr-TR')} TL</strong>
                          </Text>
                        )}
                      </Group>
                    </div>
                  </Group>
                  <Group gap="sm">
                    {sinirDeger && bizimTeklif > 0 && (
                      <Badge 
                        size="md" 
                        variant="filled"
                        color={bizimTeklif < sinirDeger ? 'orange' : 'green'}
                        leftSection={bizimTeklif < sinirDeger ? <IconAlertTriangle size={12} /> : <IconCheck size={12} />}
                      >
                        {bizimTeklif < sinirDeger ? `%${Math.round((bizimTeklif / sinirDeger) * 100)} - Risk` : 'Uygun'}
                      </Badge>
                    )}
                    <Badge variant="light" color="violet" rightSection={<IconEye size={12} />}>
                      Detay
                    </Badge>
                  </Group>
                </Group>
              </Paper>
            ) : (
              <Paper 
                p="md" 
                withBorder 
                radius="md" 
                bg="gray.0"
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveTab('hesaplamalar')}
              >
                <Group justify="space-between">
                  <Group gap="md">
                    <ThemeIcon size="lg" variant="light" color="violet" radius="xl">
                      <IconCalculator size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600} size="sm">Teklif Hesaplamaları</Text>
                      <Text size="xs" c="dimmed">Sınır değer, aşırı düşük ve itiraz bedeli hesapla</Text>
                    </div>
                  </Group>
                  <Badge variant="light" color="violet" rightSection={<IconEye size={12} />}>
                    Hesapla
                  </Badge>
                </Group>
              </Paper>
            )}

            {/* Notlar - Enhanced Sticky Notes */}
            <NotesSection
              trackingId={Number(tender.id)}
              tenderId={tender.tender_id}
            />
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
                <Badge
                  size="xs"
                  variant="gradient"
                  gradient={{ from: 'orange', to: 'yellow' }}
                  ml={6}
                >
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
                      const cardClass = isImportant
                        ? 'teknik-sart-card important'
                        : isWarning
                          ? 'teknik-sart-card warning'
                          : 'teknik-sart-card info';
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
                              gradient={{
                                from: iconColor,
                                to:
                                  iconColor === 'red'
                                    ? 'pink'
                                    : iconColor === 'orange'
                                      ? 'yellow'
                                      : 'cyan',
                              }}
                              circle
                              className="number-badge"
                              style={{ minWidth: 40, minHeight: 40, fontSize: 14 }}
                            >
                              {i + 1}
                            </Badge>
                            <div style={{ flex: 1 }}>
                              <Text size="sm" fw={500} style={{ lineHeight: 1.6 }}>
                                {sart}
                              </Text>
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
                      <ThemeIcon
                        size={80}
                        radius="xl"
                        variant="gradient"
                        gradient={{ from: 'gray', to: 'dark' }}
                      >
                        <IconClipboardList size={40} />
                      </ThemeIcon>
                      <Text c="dimmed" size="lg">
                        Teknik şart bulunamadı
                      </Text>
                      <Text c="dimmed" size="sm">
                        Döküman analizi yapıldığında burada görünecek
                      </Text>
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
                          <Table.Td>
                            {typeof item === 'object' ? item.kalem || item.aciklama || '-' : item}
                          </Table.Td>
                          <Table.Td>{typeof item === 'object' ? item.birim || '-' : '-'}</Table.Td>
                          <Table.Td>{typeof item === 'object' ? item.miktar || '-' : '-'}</Table.Td>
                          <Table.Td ta="right">
                            <Badge color="green" variant="light">
                              {typeof item === 'object' ? item.fiyat || item.tutar || '-' : '-'}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text c="dimmed" ta="center" py="xl">
                    Birim fiyat bulunamadı
                  </Text>
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
                          borderLeft: '5px solid var(--mantine-color-orange-5)',
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
                              <Badge
                                size="sm"
                                variant="gradient"
                                gradient={{ from: 'orange', to: 'red' }}
                              >
                                AI İçgörü #{i + 1}
                              </Badge>
                            </Group>
                            <Text size="sm" fw={500} style={{ lineHeight: 1.7 }}>
                              {not}
                            </Text>
                          </div>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Center h={300}>
                    <Stack align="center" gap="md">
                      <ThemeIcon
                        size={80}
                        radius="xl"
                        variant="gradient"
                        gradient={{ from: 'orange', to: 'yellow' }}
                      >
                        <IconBulb size={40} />
                      </ThemeIcon>
                      <Text c="dimmed" size="lg">
                        AI notu bulunamadı
                      </Text>
                      <Text c="dimmed" size="sm">
                        AI analizi yapıldığında notlar burada görünecek
                      </Text>
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
                  <Text c="dimmed" ta="center" py="xl">
                    Tam metin bulunamadı
                  </Text>
                )}
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>

        {/* HESAPLAMALAR TAB - YENİ TASARIM */}
        <Tabs.Panel value="hesaplamalar">
          <ScrollArea h="calc(100vh - 200px)" offsetScrollbars>
            <Stack gap="lg">
              {/* ÜST BÖLÜM: TEMEL VERİLER */}
              <Paper 
                p="lg" 
                withBorder 
                radius="lg" 
                shadow="sm"
                style={{
                  background: sinirDeger && bizimTeklif > 0
                    ? bizimTeklif < sinirDeger 
                      ? 'linear-gradient(135deg, rgba(255,244,230,0.7) 0%, rgba(255,255,255,1) 100%)'
                      : 'linear-gradient(135deg, rgba(235,251,238,0.7) 0%, rgba(255,255,255,1) 100%)'
                    : 'linear-gradient(135deg, rgba(248,249,250,1) 0%, rgba(255,255,255,1) 100%)'
                }}
              >
                <Group justify="space-between" mb="lg">
                  <Group gap="sm">
                    <ThemeIcon size="xl" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }} radius="xl">
                      <IconCalculator size={24} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700} size="lg">Teklif Verileri</Text>
                      <Text size="xs" c="dimmed">Hesaplamalarda kullanılacak temel değerler</Text>
                    </div>
                  </Group>
                  {/* Save Status */}
                  {saveStatus === 'saving' && (
                    <Badge size="sm" variant="light" color="blue" leftSection={<Loader size={10} />}>
                      Kaydediliyor...
                    </Badge>
                  )}
                  {saveStatus === 'saved' && (
                    <Badge size="sm" variant="light" color="green" leftSection={<IconCloudCheck size={12} />}>
                      Kaydedildi
                    </Badge>
                  )}
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <Paper p="md" radius="md" withBorder bg="white" shadow="xs">
                    <Group gap="xs" mb="sm">
                      <ThemeIcon size="sm" variant="light" color="blue" radius="xl">
                        <IconCoin size={14} />
                      </ThemeIcon>
                      <Text size="sm" fw={600} c="blue.7">Yaklaşık Maliyet</Text>
                    </Group>
                    <NumberInput
                      placeholder="İdarenin belirlediği tutar"
                      value={yaklasikMaliyet || ''}
                      onChange={(val) => setYaklasikMaliyet(Number(val) || 0)}
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      variant="filled"
                      size="lg"
                      hideControls
                      styles={{ input: { fontWeight: 700, fontSize: 18 } }}
                      rightSection={<Text size="sm" c="dimmed" mr={12}>TL</Text>}
                    />
                  </Paper>
                  <Paper p="md" radius="md" withBorder bg="white" shadow="xs">
                    <Group gap="xs" mb="sm">
                      <ThemeIcon size="sm" variant="light" color="orange" radius="xl">
                        <IconAlertTriangle size={14} />
                      </ThemeIcon>
                      <Text size="sm" fw={600} c="orange.7">Sınır Değer</Text>
                    </Group>
                    <NumberInput
                      placeholder="Hesapla veya gir"
                      value={sinirDeger || ''}
                      onChange={(val) => setSinirDeger(Number(val) || null)}
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      variant="filled"
                      size="lg"
                      hideControls
                      styles={{ input: { fontWeight: 700, fontSize: 18 } }}
                      rightSection={<Text size="sm" c="dimmed" mr={12}>TL</Text>}
                    />
                  </Paper>
                  <Paper p="md" radius="md" withBorder bg="white" shadow="xs">
                    <Group gap="xs" mb="sm">
                      <ThemeIcon size="sm" variant="light" color="green" radius="xl">
                        <IconReportMoney size={14} />
                      </ThemeIcon>
                      <Text size="sm" fw={600} c="green.7">Bizim Teklifimiz</Text>
                    </Group>
                    <NumberInput
                      placeholder="Vereceğiniz teklif"
                      value={bizimTeklif || ''}
                      onChange={(val) => setBizimTeklif(Number(val) || 0)}
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      variant="filled"
                      size="lg"
                      hideControls
                      styles={{ input: { fontWeight: 700, fontSize: 18 } }}
                      rightSection={<Text size="sm" c="dimmed" mr={12}>TL</Text>}
                    />
                  </Paper>
                </SimpleGrid>

                {/* Progress Bar & Durum */}
                {sinirDeger && sinirDeger > 0 && bizimTeklif > 0 && (
                  <Box mt="lg">
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500}>Teklif / Sınır Değer Oranı</Text>
                      <Badge 
                        size="lg" 
                        variant="filled"
                        color={bizimTeklif < sinirDeger ? 'orange' : 'green'}
                        leftSection={bizimTeklif < sinirDeger ? <IconAlertTriangle size={14} /> : <IconCheck size={14} />}
                      >
                        %{Math.round((bizimTeklif / sinirDeger) * 100)} {bizimTeklif < sinirDeger ? '- Aşırı Düşük Riski' : '- Uygun'}
                      </Badge>
                    </Group>
                    <Progress.Root size={24} radius="xl">
                      <Progress.Section 
                        value={Math.min((bizimTeklif / sinirDeger) * 100, 100)} 
                        color={bizimTeklif < sinirDeger ? 'orange' : 'green'}
                      >
                        <Progress.Label style={{ fontSize: 12, fontWeight: 600 }}>
                          {bizimTeklif.toLocaleString('tr-TR')} TL
                        </Progress.Label>
                      </Progress.Section>
                    </Progress.Root>
                    <Group justify="space-between" mt={6}>
                      <Text size="xs" c="dimmed">0 TL</Text>
                      <Text size="xs" c="dimmed" fw={500}>Sınır: {sinirDeger.toLocaleString('tr-TR')} TL</Text>
                    </Group>
                    {bizimTeklif < sinirDeger && (
                      <Alert mt="md" color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
                        <Text size="sm">
                          Teklifiniz sınır değerin <strong>%{((1 - bizimTeklif / sinirDeger) * 100).toFixed(1)}</strong> altında. 
                          Aşırı düşük teklif açıklaması hazırlamanız gerekebilir.
                        </Text>
                      </Alert>
                    )}
                  </Box>
                )}
              </Paper>

              {/* ALT BÖLÜM: HESAPLAMA KARTLARI */}
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {/* Sınır Değer Hesaplama Kartı */}
                <Paper p="lg" withBorder radius="lg" shadow="sm" style={{ background: 'white' }}>
                  <Group gap="sm" mb="lg">
                    <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }} radius="xl">
                      <IconMathFunction size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Sınır Değer Hesaplama</Text>
                      <Text size="xs" c="dimmed">KİK formülü ile hesapla</Text>
                    </div>
                  </Group>

                  <div>
                    <Group justify="space-between" mb="sm">
                      <Text size="sm" fw={500}>Teklif Listesi</Text>
                      <Button
                        size="xs"
                        variant="light"
                        color="violet"
                        leftSection={<IconPlus size={14} />}
                        onClick={() => setTeklifListesi((prev) => [...prev, { firma: '', tutar: 0 }])}
                      >
                        Ekle
                      </Button>
                    </Group>
                    <Stack gap="xs">
                      {teklifListesi.map((teklif, index) => (
                        <Group key={index} gap="xs">
                          <TextInput
                            placeholder={`Firma ${index + 1}`}
                            value={teklif.firma}
                            onChange={(e) =>
                              setTeklifListesi((prev) =>
                                prev.map((t, i) => i === index ? { ...t, firma: e.target.value } : t)
                              )
                            }
                            style={{ flex: 1, maxWidth: 140 }}
                            size="xs"
                          />
                          <NumberInput
                            placeholder="Tutar"
                            value={teklif.tutar || ''}
                            onChange={(val) =>
                              setTeklifListesi((prev) =>
                                prev.map((t, i) => i === index ? { ...t, tutar: Number(val) || 0 } : t)
                              )
                            }
                            thousandSeparator="."
                            decimalSeparator=","
                            min={0}
                            style={{ flex: 1 }}
                            size="xs"
                            rightSection={<Text size="xs" c="dimmed">TL</Text>}
                          />
                          {teklifListesi.length > 2 && (
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="sm"
                              onClick={() => setTeklifListesi((prev) => prev.filter((_, i) => i !== index))}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          )}
                        </Group>
                      ))}
                    </Stack>
                  </div>

                  <Button
                    fullWidth
                    mt="md"
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'indigo' }}
                    leftSection={<IconCalculator size={16} />}
                    onClick={hesaplaSinirDeger}
                    disabled={teklifListesi.filter((t) => t.tutar > 0).length < 2}
                  >
                    Sınır Değer Hesapla
                  </Button>

                  {hesaplananSinirDeger && (
                    <Paper mt="md" p="md" radius="md" bg="green.0" withBorder style={{ borderColor: 'var(--mantine-color-green-4)' }}>
                      <Group justify="space-between">
                        <div>
                          <Text size="xs" c="dimmed">Hesaplanan Değer</Text>
                          <Text size="xl" fw={700} c="green.7">
                            {hesaplananSinirDeger.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                          </Text>
                        </div>
                        <Button size="sm" color="green" onClick={() => setSinirDeger(Math.round(hesaplananSinirDeger))}>
                          Kaydet
                        </Button>
                      </Group>
                    </Paper>
                  )}
                </Paper>

                {/* Aşırı Düşük Analiz Kartı - Sınır Değer Karşılaştırması */}
                <Paper p="lg" withBorder radius="lg" shadow="sm" style={{ background: 'white' }}>
                  <Group gap="sm" mb="md">
                    <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'orange', to: 'red' }} radius="xl">
                      <IconReportMoney size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Aşırı Düşük Analizi</Text>
                      <Text size="xs" c="dimmed">Sınır değer karşılaştırması</Text>
                    </div>
                  </Group>

                  {/* Durum Göstergesi */}
                  {sinirDeger && bizimTeklif > 0 && (
                    <Paper 
                      p="sm" 
                      mb="md" 
                      radius="md" 
                      bg={bizimTeklif < sinirDeger ? 'orange.0' : 'green.0'}
                      withBorder
                      style={{ borderColor: bizimTeklif < sinirDeger ? 'var(--mantine-color-orange-4)' : 'var(--mantine-color-green-4)' }}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text size="xs" c="dimmed">Durum</Text>
                          <Text fw={700} c={bizimTeklif < sinirDeger ? 'orange.7' : 'green.7'}>
                            {bizimTeklif < sinirDeger ? '⚠️ AÇIKLAMA GEREKLİ' : '✅ AÇIKLAMA GEREKMİYOR'}
                          </Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text size="xs" c="dimmed">Fark</Text>
                          <Text fw={600} c={bizimTeklif < sinirDeger ? 'orange.7' : 'green.7'}>
                            {(sinirDeger - bizimTeklif).toLocaleString('tr-TR')} TL
                          </Text>
                        </div>
                      </Group>
                    </Paper>
                  )}

                  <Text size="xs" fw={500} mb="xs" c="dimmed">Maliyet Bileşenleri (EK-H.4 için)</Text>
                  <SimpleGrid cols={2} spacing="xs">
                    <NumberInput
                      label="Ana Çiğ Girdi"
                      placeholder="0"
                      value={maliyetBilesenleri.anaCigGirdi || ''}
                      onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, anaCigGirdi: Number(val) || 0 }))}
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      size="xs"
                    />
                    <NumberInput
                      label="Yardımcı Girdi"
                      placeholder="0"
                      value={maliyetBilesenleri.yardimciGirdi || ''}
                      onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, yardimciGirdi: Number(val) || 0 }))}
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      size="xs"
                    />
                    <NumberInput
                      label="İşçilik"
                      placeholder="0"
                      value={maliyetBilesenleri.iscilik || ''}
                      onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, iscilik: Number(val) || 0 }))}
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      size="xs"
                    />
                    <NumberInput
                      label="Nakliye"
                      placeholder="0"
                      value={maliyetBilesenleri.nakliye || ''}
                      onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, nakliye: Number(val) || 0 }))}
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      size="xs"
                    />
                    <NumberInput
                      label="Sözleşme Gideri"
                      placeholder="0"
                      value={maliyetBilesenleri.sozlesmeGideri || ''}
                      onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, sozlesmeGideri: Number(val) || 0 }))}
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      size="xs"
                    />
                    <NumberInput
                      label="Genel Gider + Kâr"
                      placeholder="0"
                      value={maliyetBilesenleri.genelGider || ''}
                      onChange={(val) => setMaliyetBilesenleri((prev) => ({ ...prev, genelGider: Number(val) || 0 }))}
                      thousandSeparator="."
                      decimalSeparator=","
                      min={0}
                      size="xs"
                    />
                  </SimpleGrid>

                  <Button
                    fullWidth
                    mt="md"
                    variant="gradient"
                    gradient={{ from: 'orange', to: 'red' }}
                    leftSection={<IconCalculator size={16} />}
                    onClick={hesaplaAsiriDusuk}
                    disabled={!sinirDeger || bizimTeklif <= 0}
                  >
                    Detaylı Analiz
                  </Button>

                  {asiriDusukSonuc && (
                    <Paper 
                      mt="md" 
                      p="md" 
                      radius="md" 
                      bg={asiriDusukSonuc.asiriDusukMu ? 'orange.0' : 'green.0'} 
                      withBorder 
                      style={{ borderColor: asiriDusukSonuc.asiriDusukMu ? 'var(--mantine-color-orange-4)' : 'var(--mantine-color-green-4)' }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Badge color={asiriDusukSonuc.asiriDusukMu ? 'orange' : 'green'} size="lg">
                          {asiriDusukSonuc.asiriDusukMu ? 'AŞIRI DÜŞÜK' : 'NORMAL TEKLİF'}
                        </Badge>
                        {asiriDusukSonuc.toplamMaliyet > 0 && (
                          <Text size="sm" fw={600}>
                            Toplam Maliyet: {asiriDusukSonuc.toplamMaliyet.toLocaleString('tr-TR')} TL
                          </Text>
                        )}
                      </Group>
                      <Text size="sm">{asiriDusukSonuc.aciklama}</Text>
                    </Paper>
                  )}
                </Paper>

                {/* İtirazen Şikayet Bedeli Kartı - 2026 Güncel */}
                <Paper p="lg" withBorder radius="lg" shadow="sm" style={{ background: 'white' }}>
                  <Group gap="sm" mb="lg">
                    <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'teal', to: 'green' }} radius="xl">
                      <IconCoin size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>İtirazen Şikayet Bedeli</Text>
                      <Text size="xs" c="dimmed">2026 yılı güncel tarifeleri</Text>
                    </div>
                  </Group>

                  <NumberInput
                    label="Yaklaşık Maliyet (TL)"
                    placeholder="Otomatik: üstteki değer kullanılır"
                    value={bedelData.yaklasikMaliyet || yaklasikMaliyet || ''}
                    onChange={(val) => setBedelData({ yaklasikMaliyet: Number(val) || 0 })}
                    thousandSeparator="."
                    decimalSeparator=","
                    min={0}
                    size="sm"
                  />

                  <Button
                    fullWidth
                    mt="md"
                    variant="gradient"
                    gradient={{ from: 'teal', to: 'green' }}
                    leftSection={<IconCoin size={16} />}
                    onClick={hesaplaBedel}
                  >
                    Bedel Hesapla
                  </Button>

                  {bedelSonuc && (
                    <Paper 
                      mt="md" 
                      p="md" 
                      radius="md" 
                      bg="green.0" 
                      withBorder 
                      style={{ borderColor: 'var(--mantine-color-green-4)' }}
                    >
                      <Text size="xl" fw={700} c="green.7">
                        {bedelSonuc.bedel.toLocaleString('tr-TR')} TL
                      </Text>
                      <Text size="xs" c="dimmed">{bedelSonuc.aciklama}</Text>
                    </Paper>
                  )}
                </Paper>

                {/* Teminat Hesaplama Kartı */}
                <Paper p="lg" withBorder radius="lg" shadow="sm" style={{ background: 'white' }}>
                  <Group gap="sm" mb="lg">
                    <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'pink', to: 'grape' }} radius="xl">
                      <IconScale size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Teminat Hesaplama</Text>
                      <Text size="xs" c="dimmed">Geçici %3, Kesin %6, Damga Vergisi</Text>
                    </div>
                  </Group>

                  <Text size="sm" c="dimmed" mb="md">
                    Bizim Teklifimiz: <strong>{bizimTeklif > 0 ? `${bizimTeklif.toLocaleString('tr-TR')} TL` : 'Girilmedi'}</strong>
                  </Text>

                  <Button
                    fullWidth
                    variant="gradient"
                    gradient={{ from: 'pink', to: 'grape' }}
                    leftSection={<IconScale size={16} />}
                    onClick={hesaplaTeminat}
                    disabled={bizimTeklif <= 0}
                  >
                    Teminat Hesapla
                  </Button>

                  {teminatSonuc && (
                    <Stack gap="sm" mt="md">
                      <Paper p="sm" radius="md" bg="violet.0" withBorder style={{ borderColor: 'var(--mantine-color-violet-4)' }}>
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>Geçici Teminat (%3)</Text>
                          <Text size="md" fw={700} c="violet.7">
                            {teminatSonuc.geciciTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                          </Text>
                        </Group>
                      </Paper>
                      <Paper p="sm" radius="md" bg="grape.0" withBorder style={{ borderColor: 'var(--mantine-color-grape-4)' }}>
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>Kesin Teminat (%6)</Text>
                          <Text size="md" fw={700} c="grape.7">
                            {teminatSonuc.kesinTeminat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                          </Text>
                        </Group>
                      </Paper>
                      <Paper p="sm" radius="md" bg="pink.0" withBorder style={{ borderColor: 'var(--mantine-color-pink-4)' }}>
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>Damga Vergisi (‰5.69)</Text>
                          <Text size="md" fw={700} c="pink.7">
                            {teminatSonuc.damgaVergisi.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                          </Text>
                        </Group>
                      </Paper>
                    </Stack>
                  )}
                </Paper>
              </SimpleGrid>
            </Stack>
          </ScrollArea>
        </Tabs.Panel>

        {/* AI DANIŞMAN TAB */}
        <Tabs.Panel value="ai">
          <Stack gap="md" h="calc(100vh - 200px)">

            {/* Chat Area */}
            <Paper
              withBorder
              p="md"
              radius="md"
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <ScrollArea style={{ flex: 1 }} offsetScrollbars>
                {messages.length === 0 ? (
                  <Stack gap="lg" align="center" py="xl">
                    <ThemeIcon
                      size={60}
                      radius="xl"
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'grape' }}
                    >
                      <IconBrain size={32} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600} ta="center" size="lg">
                        İhale Danışmanınız Hazır
                      </Text>
                      <Text c="dimmed" ta="center" size="sm">
                        Aşağıdaki sorulardan birini seçin veya kendi sorunuzu yazın
                      </Text>
                    </div>

                    {/* Hazır Soru Havuzu - Chip Tabanlı */}
                    <Box w="100%" maw={700}>
                      {/* Kategori Chip'leri */}
                      <Chip.Group multiple={false} value={selectedQuestionCategory} onChange={(val) => setSelectedQuestionCategory(val as string)}>
                        <Group gap={6} justify="center" mb="md" wrap="wrap">
                          <Chip value="teknik" variant="light" color="blue" size="sm">Teknik</Chip>
                          <Chip value="mali" variant="light" color="green" size="sm">Mali</Chip>
                          <Chip value="risk" variant="light" color="orange" size="sm">Risk</Chip>
                          <Chip value="yeterlilik" variant="light" color="violet" size="sm">Yeterlilik</Chip>
                          <Chip value="lojistik" variant="light" color="cyan" size="sm">Lojistik</Chip>
                          <Chip value="strateji" variant="light" color="grape" size="sm">Strateji</Chip>
                          <Chip value="hukuki" variant="light" color="red" size="sm">Hukuki</Chip>
                        </Group>
                      </Chip.Group>

                      {/* Seçili Kategorinin Soruları */}
                      <Paper withBorder p="md" radius="md" bg="gray.0">
                        <ScrollArea h={200} offsetScrollbars>
                          <Stack gap={4}>
                            {selectedQuestionCategory === 'teknik' && [
                              'Günlük menü çeşitliliği ve yemek sayısı ne olmalı?',
                              'Gramaj ve porsiyon miktarları neler?',
                              'Servis saatleri ve teslimat koşulları neler?',
                              'Gıda güvenliği sertifikaları (ISO, HACCP) gerekli mi?',
                              'Personel sayısı ve nitelikleri ne olmalı?',
                              'Kaç okula/merkeze yemek verilecek?',
                              'Toplam kaç öğrenci/kişiye hizmet verilecek?',
                            ].map((soru, i) => (
                              <Text
                                key={i}
                                size="sm"
                                p={8}
                                style={{ cursor: 'pointer', borderRadius: 6, transition: 'all 0.15s' }}
                                className="hover-card"
                                onClick={() => setInputMessage(soru)}
                              >
                                {soru}
                              </Text>
                            ))}
                            {selectedQuestionCategory === 'mali' && [
                              'Bu ihalenin tahmini karını hesapla ve analiz et.',
                              'Toplam öğün sayısı ve önerilen birim fiyat ne olmalı?',
                              'Yaklaşık maliyet ve sınır değer nedir?',
                              'Maliyet kalemleri neler? (işçilik, malzeme, nakliye)',
                              'Fiyat farkı (enflasyon) uygulanacak mı?',
                              'Avans veya hakediş ödeme koşulları neler?',
                              'Teminat oranları (geçici/kesin) nedir?',
                            ].map((soru, i) => (
                              <Text
                                key={i}
                                size="sm"
                                p={8}
                                style={{ cursor: 'pointer', borderRadius: 6, transition: 'all 0.15s' }}
                                className="hover-card"
                                onClick={() => setInputMessage(soru)}
                              >
                                {soru}
                              </Text>
                            ))}
                            {selectedQuestionCategory === 'risk' && [
                              'Bu ihale için risk değerlendirmesi yap.',
                              'Cezai şartlar ve kesinti oranları neler?',
                              'Sözleşme fesih koşulları nelerdir?',
                              'İş artışı/eksilişi limitleri nedir?',
                              'Mücbir sebep tanımları neler?',
                              'Sigorta gereksinimleri var mı?',
                              'Gecikme cezası nasıl hesaplanıyor?',
                            ].map((soru, i) => (
                              <Text
                                key={i}
                                size="sm"
                                p={8}
                                style={{ cursor: 'pointer', borderRadius: 6, transition: 'all 0.15s' }}
                                className="hover-card"
                                onClick={() => setInputMessage(soru)}
                              >
                                {soru}
                              </Text>
                            ))}
                            {selectedQuestionCategory === 'yeterlilik' && [
                              'İş deneyim belgesi tutarı ne kadar olmalı?',
                              'Benzer iş tanımı nedir?',
                              'Mali yeterlilik kriterleri neler?',
                              'Personel yeterlilikleri (aşçı, diyetisyen) neler?',
                              'Kalite belgeleri hangileri isteniyor?',
                              'SGK ve vergi borcu limitleri nedir?',
                              'Ortaklık veya konsorsiyum mümkün mü?',
                            ].map((soru, i) => (
                              <Text
                                key={i}
                                size="sm"
                                p={8}
                                style={{ cursor: 'pointer', borderRadius: 6, transition: 'all 0.15s' }}
                                className="hover-card"
                                onClick={() => setInputMessage(soru)}
                              >
                                {soru}
                              </Text>
                            ))}
                            {selectedQuestionCategory === 'lojistik' && [
                              'Teslimat noktaları (okul/merkez) kaç adet?',
                              'Dağıtım mesafeleri ve süreleri neler?',
                              'Depolama ve soğuk zincir gereksinimleri var mı?',
                              'Acil durum planı gerekli mi?',
                              'Araç ve personel planlaması nasıl olmalı?',
                              'Hijyen ve denetim kuralları neler?',
                            ].map((soru, i) => (
                              <Text
                                key={i}
                                size="sm"
                                p={8}
                                style={{ cursor: 'pointer', borderRadius: 6, transition: 'all 0.15s' }}
                                className="hover-card"
                                onClick={() => setInputMessage(soru)}
                              >
                                {soru}
                              </Text>
                            ))}
                            {selectedQuestionCategory === 'strateji' && [
                              'Bu ihale için rekabet analizi yap, rakipler kimler olabilir?',
                              'Bu bölgede daha önce benzer ihaleleri kim kazandı?',
                              'Optimal teklif fiyatı ne olmalı?',
                              'Güçlü ve zayıf yönlerimiz neler?',
                              'Bu ihaleye girmeli miyiz? Önerir misin?',
                              'Kazanma şansımızı artırmak için ne yapmalıyız?',
                            ].map((soru, i) => (
                              <Text
                                key={i}
                                size="sm"
                                p={8}
                                style={{ cursor: 'pointer', borderRadius: 6, transition: 'all 0.15s' }}
                                className="hover-card"
                                onClick={() => setInputMessage(soru)}
                              >
                                {soru}
                              </Text>
                            ))}
                            {selectedQuestionCategory === 'hukuki' && [
                              'Bu ihale için aşırı düşük teklif açıklama yazısı hazırla.',
                              'İdareye şikayet dilekçesi taslağı hazırla.',
                              'KİK\'e itirazen şikayet dilekçesi hazırla.',
                              'Benzer KİK kararlarını araştır ve özetle.',
                              'Bu ihale türü için geçerli mevzuat maddelerini açıkla.',
                              'İhale itiraz süreleri ve prosedürleri neler?',
                              'Sözleşme imzalamama durumunda yaptırımlar neler?',
                              'Teminat mektubu iade koşulları nelerdir?',
                            ].map((soru, i) => (
                              <Text
                                key={i}
                                size="sm"
                                p={8}
                                style={{ cursor: 'pointer', borderRadius: 6, transition: 'all 0.15s' }}
                                className="hover-card"
                                onClick={() => setInputMessage(soru)}
                              >
                                {soru}
                              </Text>
                            ))}
                          </Stack>
                        </ScrollArea>
                      </Paper>
                    </Box>
                  </Stack>
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
                        <Paper p="sm" radius="md" bg={msg.role === 'user' ? 'blue.6' : 'gray.1'}>
                          <Text
                            size="sm"
                            c={msg.role === 'user' ? 'white' : undefined}
                            style={{ whiteSpace: 'pre-wrap' }}
                          >
                            {msg.content}
                          </Text>
                        </Paper>
                        <Text
                          size="xs"
                          c="dimmed"
                          mt={4}
                          ta={msg.role === 'user' ? 'right' : 'left'}
                        >
                          {msg.timestamp.toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </Box>
                    ))}
                    {isAILoading && (
                      <Group gap="xs">
                        <Loader size="xs" />
                        <Text size="sm" c="dimmed">
                          Düşünüyor...
                        </Text>
                      </Group>
                    )}
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
                    onChange={(e) => setInputMessage(e.currentTarget.value)}
                    style={{ flex: 1 }}
                    minRows={1}
                    maxRows={3}
                    autosize
                    onKeyPress={(e) => {
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
                    loading={isAILoading}
                    disabled={!inputMessage.trim()}
                  >
                    <IconSend size={18} />
                  </ActionIcon>
                </Group>
              </Box>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* DİLEKÇELER TAB */}
        <Tabs.Panel value="dilekce">
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
            {/* Sol Panel - Dilekçe Türleri + Chat */}
            <Stack gap="md">
              {/* Dilekçe Türü Seçimi */}
              <Paper p="md" withBorder radius="md">
                <Text fw={600} size="sm" mb="md">
                  Dilekçe Türü Seçin
                </Text>
                <SimpleGrid cols={2} spacing="xs">
                  <Button
                    variant={dilekceType === 'asiri_dusuk' ? 'filled' : 'light'}
                    color="orange"
                    size="sm"
                    leftSection={<IconFileAnalytics size={16} />}
                    onClick={() => {
                      setDilekceType('asiri_dusuk');
                      setDilekceContent('');
                    }}
                    styles={{ root: { height: 'auto', padding: '10px' } }}
                  >
                    <Stack gap={2} align="flex-start">
                      <Text size="xs" fw={600}>Aşırı Düşük</Text>
                      <Text size="xs" c="dimmed">EK-H.4 Açıklama</Text>
                    </Stack>
                  </Button>
                  <Button
                    variant={dilekceType === 'idare_sikayet' ? 'filled' : 'light'}
                    color="red"
                    size="sm"
                    leftSection={<IconGavel size={16} />}
                    onClick={() => {
                      setDilekceType('idare_sikayet');
                      setDilekceContent('');
                    }}
                    styles={{ root: { height: 'auto', padding: '10px' } }}
                  >
                    <Stack gap={2} align="flex-start">
                      <Text size="xs" fw={600}>İdareye Şikayet</Text>
                      <Text size="xs" c="dimmed">10 gün süre</Text>
                    </Stack>
                  </Button>
                  <Button
                    variant={dilekceType === 'kik_itiraz' ? 'filled' : 'light'}
                    color="violet"
                    size="sm"
                    leftSection={<IconScale size={16} />}
                    onClick={() => {
                      setDilekceType('kik_itiraz');
                      setDilekceContent('');
                    }}
                    styles={{ root: { height: 'auto', padding: '10px' } }}
                  >
                    <Stack gap={2} align="flex-start">
                      <Text size="xs" fw={600}>KİK İtiraz</Text>
                      <Text size="xs" c="dimmed">İtirazen Şikayet</Text>
                    </Stack>
                  </Button>
                  <Button
                    variant={dilekceType === 'aciklama_cevabi' ? 'filled' : 'light'}
                    color="teal"
                    size="sm"
                    leftSection={<IconNote size={16} />}
                    onClick={() => {
                      setDilekceType('aciklama_cevabi');
                      setDilekceContent('');
                    }}
                    styles={{ root: { height: 'auto', padding: '10px' } }}
                  >
                    <Stack gap={2} align="flex-start">
                      <Text size="xs" fw={600}>Açıklama Cevabı</Text>
                      <Text size="xs" c="dimmed">İdare Talebi</Text>
                    </Stack>
                  </Button>
                </SimpleGrid>
              </Paper>

              {/* AI Chat Alanı */}
              <Paper
                p="md"
                withBorder
                radius="md"
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 400 }}
              >
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="violet" radius="xl">
                      <IconBrain size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm">AI Asistan</Text>
                  </Group>
                  {dilekceLoading && (
                    <Badge size="xs" variant="light" color="blue" leftSection={<Loader size={10} />}>
                      Hazırlanıyor...
                    </Badge>
                  )}
                </Group>

                <ScrollArea style={{ flex: 1, minHeight: 250 }} offsetScrollbars>
                  <Stack gap="sm">
                    {dilekceMessages.length === 0 ? (
                      <Paper p="md" radius="md" bg="gray.0">
                        {dilekceType ? (
                          <Stack gap="sm">
                            <Group gap="xs" justify="center">
                              <ThemeIcon 
                                size="md" 
                                variant="light" 
                                color={
                                  dilekceType === 'asiri_dusuk' ? 'orange' :
                                  dilekceType === 'idare_sikayet' ? 'red' :
                                  dilekceType === 'kik_itiraz' ? 'violet' : 'teal'
                                }
                                radius="xl"
                              >
                                <IconBulb size={16} />
                              </ThemeIcon>
                              <Text fw={600} size="sm">{dilekceTypeLabels[dilekceType]}</Text>
                            </Group>
                            
                            <Text size="xs" c="dimmed" ta="center" style={{ lineHeight: 1.6 }}>
                              {dilekceType === 'asiri_dusuk' && (
                                <>
                                  📋 <strong>EK-H.4 formatında</strong> maliyet bileşenleri tablosu hazırlanacak.<br/>
                                  📌 Ana çiğ girdi, işçilik, nakliye gibi kalemler detaylandırılacak.<br/>
                                  ⚖️ 4734 sayılı Kanun ve Yönetmelik'e uygun açıklama oluşturulacak.
                                </>
                              )}
                              {dilekceType === 'idare_sikayet' && (
                                <>
                                  ⏰ <strong>10 gün</strong> içinde idareye başvuru yapılmalıdır.<br/>
                                  📄 Şikayet konusu ve talep (iptal/düzeltme) belirtilecek.<br/>
                                  📌 4734 sayılı Kanun 54. maddesine uygun format kullanılacak.
                                </>
                              )}
                              {dilekceType === 'kik_itiraz' && (
                                <>
                                  🏛️ Kamu İhale Kurumu Başkanlığı'na hitap edilecek.<br/>
                                  💰 İtirazen şikayet bedeli bilgisi eklenecek.<br/>
                                  📚 Emsal KİK kararlarına atıf yapılacak.
                                </>
                              )}
                              {dilekceType === 'aciklama_cevabi' && (
                                <>
                                  📝 İdare talebine profesyonel cevap hazırlanacak.<br/>
                                  📎 Destekleyici belgeler referans gösterilecek.<br/>
                                  ✅ Net ve açık bilgi sunumu sağlanacak.
                                </>
                              )}
                            </Text>
                            
                            <Text size="xs" c="dimmed" ta="center" mt="xs">
                              👇 <strong>Oluştur</strong> butonuna tıklayın veya ek taleplerinizi yazın
                            </Text>
                          </Stack>
                        ) : (
                          <Text size="sm" c="dimmed" ta="center">
                            👆 Yukarıdan bir dilekçe türü seçin
                          </Text>
                        )}
                      </Paper>
                    ) : (
                      dilekceMessages.map((msg, idx) => (
                        <Box
                          key={idx}
                          style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '90%',
                          }}
                        >
                          <Paper
                            p="sm"
                            radius="md"
                            bg={msg.role === 'user' ? 'blue.6' : 'gray.1'}
                          >
                            <Text
                              size="sm"
                              c={msg.role === 'user' ? 'white' : undefined}
                              style={{ whiteSpace: 'pre-wrap' }}
                            >
                              {msg.content}
                            </Text>
                          </Paper>
                        </Box>
                      ))
                    )}
                    <div ref={dilekceEndRef} />
                  </Stack>
                </ScrollArea>

                {/* Input */}
                <Box mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                  <Group gap="xs">
                    <Textarea
                      placeholder={dilekceType ? 'Ek bilgi veya değişiklik isteği...' : 'Dilekçe türü seçin'}
                      value={dilekceInput}
                      onChange={(e) => setDilekceInput(e.currentTarget.value)}
                      style={{ flex: 1 }}
                      minRows={1}
                      maxRows={2}
                      autosize
                      disabled={!dilekceType}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && dilekceType) {
                          e.preventDefault();
                          handleDilekceChat(dilekceInput);
                        }
                      }}
                    />
                    <Button
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'grape' }}
                      disabled={!dilekceType}
                      loading={dilekceLoading}
                      onClick={() => handleDilekceChat()}
                    >
                      {dilekceContent ? 'Güncelle' : 'Oluştur'}
                    </Button>
                  </Group>
                </Box>
              </Paper>
            </Stack>

            {/* Sağ Panel - Dilekçe Önizleme */}
            <Paper
              p="md"
              withBorder
              radius="md"
              style={{ display: 'flex', flexDirection: 'column', minHeight: 500 }}
            >
              <Group justify="space-between" mb="md">
                <Text fw={600} size="sm">
                  📄 {dilekceType ? dilekceTypeLabels[dilekceType] : 'Dilekçe Önizleme'}
                </Text>
                {dilekceContent && (
                  <Group gap="xs">
                    <Tooltip label="Kopyala">
                      <ActionIcon
                        variant="light"
                        color="gray"
                        onClick={() => {
                          navigator.clipboard.writeText(dilekceContent);
                          notifications.show({
                            title: 'Kopyalandı',
                            message: 'Dilekçe panoya kopyalandı',
                            color: 'green',
                          });
                        }}
                      >
                        <IconClipboardList size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Word İndir">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => downloadDilekce('docx')}
                      >
                        <IconDownload size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="PDF İndir">
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => downloadDilekce('pdf')}
                      >
                        <IconDownload size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                )}
              </Group>

              <ScrollArea style={{ flex: 1 }} offsetScrollbars>
                {dilekceContent ? (
                  <Paper p="lg" radius="md" bg="white" style={{ border: '1px solid var(--mantine-color-gray-3)' }}>
                    <Text
                      size="sm"
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                        lineHeight: 1.7,
                      }}
                    >
                      {dilekceContent}
                    </Text>
                  </Paper>
                ) : (
                  <Center style={{ height: '100%', minHeight: 300 }}>
                    <Stack align="center" gap="md">
                      <ThemeIcon size={60} variant="light" color="gray" radius="xl">
                        <IconFileText size={30} />
                      </ThemeIcon>
                      <Text size="sm" c="dimmed" ta="center">
                        Dilekçe türü seçip "Oluştur" butonuna tıklayın.
                        <br />
                        AI, ihale verilerini kullanarak dilekçe hazırlayacak.
                      </Text>
                    </Stack>
                  </Center>
                )}
              </ScrollArea>

              {/* Referanslar */}
              {dilekceContent && (
                <Box mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                  <Text size="xs" c="dimmed" mb="xs">
                    📚 Kullanılan Kaynaklar
                  </Text>
                  <Group gap="xs">
                    <Badge size="xs" variant="light" color="blue">4734 sayılı Kanun</Badge>
                    <Badge size="xs" variant="light" color="violet">KİK Mevzuat</Badge>
                    {dilekceType === 'asiri_dusuk' && (
                      <Badge size="xs" variant="light" color="orange">EK-H.4 Format</Badge>
                    )}
                  </Group>
                </Box>
              )}
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
