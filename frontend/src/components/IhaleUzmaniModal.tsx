'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Chip,
  Collapse,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBrain,
  IconBuilding,
  IconBulb,
  IconCalculator,
  IconCheck,
  IconChevronRight,
  IconClipboardCopy,
  IconClipboardList,
  IconDeviceFloppy,
  IconDownload,
  IconEye,
  IconFileAnalytics,
  IconFileText,
  IconGavel,
  IconInfoCircle,
  IconMessageCircle,
  IconNote,
  IconPencil,
  IconPlus,
  IconScale,
  IconSend,
  IconTrash,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { aiAPI } from '@/lib/api/services/ai';
import { tendersAPI } from '@/lib/api/services/tenders';

// Unified Notes System

import {
  IconBuildingBank,
  IconPackage,
  IconReceipt,
  IconTool,
  IconTruck,
  IconUsers,
} from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useResponsive } from '@/hooks/useResponsive';
import { useClipboard, useIhaleData } from './IhaleUzmani/hooks';
import { ClipboardModal } from './IhaleUzmani/modals/ClipboardModal';
import { DokumanlarTab } from './IhaleUzmani/tabs/DokumanlarTab';
import { HesaplamalarTab } from './IhaleUzmani/tabs/HesaplamalarTab';
// Modüler yapıdan import
import {
  type ChatMessage,
  dilekceTypeLabels,
  type IhaleUzmaniModalProps,
  type SavedTender,
  statusConfig,
} from './IhaleUzmani/types';

// TeklifModal lazy load (78KB tasarruf)
const TeklifModal = dynamic(() => import('./teklif/TeklifModal'), {
  ssr: false,
  loading: () => null,
});

export default function IhaleUzmaniModal({
  opened,
  onClose,
  tender,
  onUpdateStatus,
  onDelete: _onDelete,
  // Deprecated props - NotesSection handles notes internally
  onAddNote: _onAddNote,
  onDeleteNote: _onDeleteNote,
}: IhaleUzmaniModalProps) {
  // Responsive hook
  const { isMobile, isMounted } = useResponsive();

  // Tab state
  const [activeTab, setActiveTab] = useState<string | null>('ozet');

  // Soru havuzu kategori seçimi
  const [selectedQuestionCategory, setSelectedQuestionCategory] = useState<string>('teknik');

  // Döküman Analizi - Filtreleme States
  const [_teknikSartArama, _setTeknikSartArama] = useState('');
  const [_sadeceZorunluGoster, _setSadeceZorunluGoster] = useState(false);
  const [_birimFiyatArama, _setBirimFiyatArama] = useState('');
  const [_aiNotArama, _setAiNotArama] = useState('');

  // Çalışma Panosu - useClipboard hook
  const clipboard = useClipboard(tender?.id);

  // İhale Data - useIhaleData hook
  const ihaleData = useIhaleData(tender, opened);

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
  const [activePanel, setActivePanel] = useState<'ai' | 'dilekce'>('ai'); // AI veya Dilekçe paneli
  const [dilekceType, setDilekceType] = useState<string | null>(null);
  const [dilekceContent, setDilekceContent] = useState('');
  type DilekceMessage = { id: string; role: 'user' | 'assistant'; content: string };
  const [dilekceMessages, setDilekceMessages] = useState<DilekceMessage[]>([]);
  const [dilekceInput, setDilekceInput] = useState('');
  const [dilekceLoading, setDilekceLoading] = useState(false);
  const [dilekceSessionId, setDilekceSessionId] = useState<string | null>(null);
  const [savedDilekces, setSavedDilekces] = useState<any[]>([]);
  const [_dilekceListLoading, setDilekceListLoading] = useState(false);
  const [dilekceSaving, setDilekceSaving] = useState(false);
  const [dilekceConversations, setDilekceConversations] = useState<any[]>([]); // Kayıtlı konuşmalar
  const [showDilekceChat, setShowDilekceChat] = useState(false); // true: sohbet, false: kart listesi
  const [isDilekceEditing, setIsDilekceEditing] = useState(false); // Dilekçe düzenleme modu
  const [showChatHistory, setShowChatHistory] = useState(false); // Sohbet geçmişini göster/gizle
  const dilekceEndRef = useRef<HTMLDivElement>(null);

  // Teklif Cetveli States
  const [teklifModalOpened, setTeklifModalOpened] = useState(false);
  const [teklifOzet, _setTeklifOzet] = useState<{
    personelSayisi: number;
    personelMaliyet: number;
    aracSayisi: number;
    nakliyeMaliyet: number;
    sarfKalemSayisi: number;
    sarfMaliyet: number;
    ekipmanSayisi: number;
    ekipmanMaliyet: number;
    yasalMaliyet: number;
    genelGiderMaliyet: number;
    toplamMaliyet: number;
    karOrani: number;
    teklifTutari: number;
    sonGuncelleme: string | null;
  } | null>(null);

  // Firma ve Analysis - useIhaleData hook'tan alias'lar
  const {
    analysisData,
    analysisLoading,
    analysisStats,
    firmalar,
    selectedFirmaId,
    setSelectedFirmaId,
    selectedFirma,
    loadAnalysisData,
    hideNote,
  } = ihaleData;

  // Helper: Mesajdan context kısmını kaldır (eski kayıtlar için)
  const stripContextFromMessage = (content: string): string => {
    if (!content) return content;
    // Eğer mesaj "📋 SEÇİLİ İHALE:" ile başlıyorsa, "---" sonrasını al
    if (content.includes('📋 SEÇİLİ İHALE:') && content.includes('---\n')) {
      const lastSeparator = content.lastIndexOf('---\n');
      if (lastSeparator !== -1) {
        const actualMessage = content.substring(lastSeparator + 4).trim();
        if (actualMessage.length > 0) {
          return actualMessage;
        }
      }
    }
    return content;
  };

  // dilekceTypeLabels artık types.ts'den import ediliyor

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

      await tendersAPI.updateTracking(Number(tender.id), {
        yaklasik_maliyet: yaklasikMaliyet || null,
        sinir_deger: sinirDeger || null,
        bizim_teklif: bizimTeklif || null,
        hesaplama_verileri: hesaplamaVerileri,
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
      setTeklifListesi([
        { firma: '', tutar: 0 },
        { firma: '', tutar: 0 },
      ]);
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
      setDilekceMessages([]); // Dilekçe mesajlarını temizle
      setActiveTab('ozet'); // Her zaman Özet sekmesinden başla

      // Sonra verileri yükle (async)
      loadAnalysisData();
      loadSavedHesaplamaData().catch((error) => {
        console.error('Hesaplama verisi yükleme hatası:', error);
      });

      // AI Danışman sessionId'sini oluştur
      const tenderSessionId = `ihale_${tender.tender_id || tender.id}`;
      setChatSessionId(tenderSessionId);

      // AI Danışman conversation'ını yükle
      loadConversations(tenderSessionId);

      // Dilekçe session'ı türe göre belirlenir - kullanıcı tür seçince yüklenecek
      setDilekceSessionId(null);

      // Kayıtlı dilekçeleri yükle
      loadSavedDilekces();

      // Firmalar artık useIhaleData hook'ta otomatik yükleniyor
    } else if (!opened) {
      // Modal kapandığında conversation state'lerini temizle
      // Hesaplama verileri de temizlenir ama ZATEN VERİTABANINDA KAYDEDİLMİŞ
      // Modal tekrar açıldığında loadSavedHesaplamaData() ile yüklenecek
      setMessages([]);
      setDilekceMessages([]);
      setChatSessionId(null);
      setDilekceSessionId(null);
    }
    // loadConversations, loadSavedDilekces, loadSavedHesaplamaData bu effect'ten sonra tanımlı;
    // dep listesine koymak "Cannot access before initialization" hatası verir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, tender?.tender_id, tender, loadAnalysisData]);

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
            teknik_sart_sayisi: analysisData.teknik_sartlar?.length || 0,
            birim_fiyat_sayisi: analysisData.birim_fiyatlar?.length || 0,
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
  }, [
    opened,
    tender,
    yaklasikMaliyet,
    sinirDeger,
    bizimTeklif,
    teklifListesi,
    analysisData.birim_fiyatlar?.length,
    analysisData.teknik_sartlar?.length,
  ]);

  // Load saved hesaplama data from tender - API'den güncel veriyi çek
  const loadSavedHesaplamaData = async () => {
    if (!tender) return;

    try {
      // Önce API'den güncel veriyi çek
      const result = await tendersAPI.getTrackingList();

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
              if (
                hv.teklif_listesi &&
                Array.isArray(hv.teklif_listesi) &&
                hv.teklif_listesi.length >= 2
              ) {
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

  // Dilekçe türü değiştiğinde o türe ait konuşmaları yükle (kart listesi olarak)
  const handleDilekceTypeChange = async (type: string) => {
    if (!tender) return;

    // Panel'i dilekçe moduna geçir
    setActivePanel('dilekce');

    // Dilekçe türünü set et
    setDilekceType(type);
    setDilekceContent('');
    setDilekceMessages([]); // Önceki mesajları temizle
    setShowDilekceChat(false); // Kart listesini göster
    setDilekceSessionId(null);

    // O türe ait kayıtlı konuşmaları yükle
    await loadDilekceConversationsList(type);
  };

  // Belirli türdeki tüm konuşmaları yükle (kart listesi için)
  const loadDilekceConversationsList = async (type: string) => {
    if (!tender) return;

    try {
      const result = await aiAPI.listConversationsByPrefix(
        `ihale_${tender.tender_id || tender.id}_dilekce_${type}`
      );

      if (result.success && (result as any).conversations) {
        setDilekceConversations((result as any).conversations);
      } else {
        setDilekceConversations([]);
      }
    } catch (error) {
      console.error('Konuşma listesi yüklenemedi:', error);
      setDilekceConversations([]);
    }
  };

  // Kayıtlı konuşmayı aç (karta tıklayınca)
  const openDilekceConversation = async (sessionId: string) => {
    setDilekceSessionId(sessionId);
    setShowDilekceChat(true);
    setShowChatHistory(false); // Sohbet varsayılan olarak gizli
    setIsDilekceEditing(false); // Düzenleme modu kapalı başla

    try {
      const data = await aiAPI.getConversation(sessionId);

      if (data.success && (data as any).messages) {
        const formattedMessages = (data as any).messages.map((msg: any, i: number) => ({
          id: (msg as { id?: string }).id ?? `d-load-${i}-${msg.role}`,
          role: msg.role,
          content: stripContextFromMessage(msg.content), // Eski context'leri temizle
        }));
        setDilekceMessages(formattedMessages);

        // AI'ın son mesajını dilekçe içeriği olarak ayarla (düzenleme için)
        const lastAiMessage = [...(data as any).messages]
          .reverse()
          .find((m: any) => m.role === 'assistant');
        if (lastAiMessage) {
          setDilekceContent(lastAiMessage.content);
        }
      }
    } catch (error) {
      console.error('Konuşma yüklenemedi:', error);
    }
  };

  // Yeni konuşma başlat
  const startNewDilekceConversation = () => {
    if (!tender || !dilekceType) return;

    // Yeni unique sessionId oluştur (timestamp ile)
    const newSessionId = `ihale_${tender.tender_id || tender.id}_dilekce_${dilekceType}_${Date.now()}`;
    setDilekceSessionId(newSessionId);
    setDilekceMessages([]);
    setDilekceContent('');
    setShowDilekceChat(true);
  };

  // Konuşma listesine geri dön
  const backToDilekceList = () => {
    setShowDilekceChat(false);
  };

  // Konuşmayı sil
  const deleteDilekceConversation = async (sessionId: string) => {
    if (!window.confirm('Bu konuşmayı silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const result = await aiAPI.deleteConversation(sessionId);

      if (result.success) {
        notifications.show({
          title: 'Silindi',
          message: 'Konuşma başarıyla silindi',
          color: 'green',
        });
        // Listeyi güncelle
        if (dilekceType && tender) {
          loadDilekceConversationsList(dilekceType);
        }
      } else {
        notifications.show({
          title: 'Hata',
          message: 'Konuşma silinemedi',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Konuşma silme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Konuşma silinirken bir hata oluştu',
        color: 'red',
      });
    }
    setDilekceMessages([]);
    if (dilekceType) {
      loadDilekceConversationsList(dilekceType);
    }
  };

  // Önceki conversation'ları yükle
  const loadConversations = async (sessionId: string) => {
    try {
      const result = await aiAPI.getConversation(sessionId);

      if (result.success && (result as any).messages && (result as any).messages.length > 0) {
        // Backend'den gelen mesajları ChatMessage formatına çevir
        const loadedMessages: ChatMessage[] = (result as any).messages.map(
          (msg: any, index: number) => ({
            id: `${msg.id || index}`,
            role: msg.role,
            content: stripContextFromMessage(msg.content), // Eski context'leri temizle
            timestamp: new Date(msg.created_at),
          })
        );

        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Conversation yükleme hatası:', error);
      // Hata durumunda devam et, boş başla
    }
  };

  // Dilekçe conversation'larını yükle
  const _loadDilekceConversations = async (sessionId: string) => {
    try {
      const result = await aiAPI.getConversation(sessionId);

      if (result.success && (result as any).messages && (result as any).messages.length > 0) {
        // Backend'den gelen mesajları dilekçe formatına çevir
        const loadedMessages = (result as any).messages.map((msg: any, i: number) => ({
          id: (msg as { id?: string }).id ?? `d-loaded-${i}-${msg.role}`,
          role: msg.role as 'user' | 'assistant',
          content: stripContextFromMessage(msg.content), // Eski context'leri temizle
        }));

        setDilekceMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Dilekçe conversation yükleme hatası:', error);
      // Hata durumunda devam et, boş başla
    }
  };

  // loadAnalysisData ve getAnalysisData artık useIhaleData hook'tan geliyor

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

    const { anaCigGirdi, yardimciGirdi, iscilik, nakliye, sozlesmeGideri, genelGider, kar } =
      maliyetBilesenleri;
    const toplamMaliyet =
      anaCigGirdi + yardimciGirdi + iscilik + nakliye + sozlesmeGideri + genelGider + kar;
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
      const analysis = analysisData;

      // Context oluştur - İhale temel bilgileri
      let context = `📋 SEÇİLİ İHALE:\n- Başlık: ${tender.ihale_basligi}\n- Kurum: ${tender.kurum}\n`;
      if (tender.bedel) context += `- Tahmini Bedel: ${tender.bedel}\n`;
      if (tender.tarih) context += `- Tarih: ${tender.tarih}\n`;
      if (yaklasikMaliyet > 0)
        context += `- Yaklaşık Maliyet: ${yaklasikMaliyet.toLocaleString('tr-TR')} TL\n`;
      if (sinirDeger) context += `- Sınır Değer: ${sinirDeger.toLocaleString('tr-TR')} TL\n`;
      if (bizimTeklif > 0) context += `- Bizim Teklif: ${bizimTeklif.toLocaleString('tr-TR')} TL\n`;

      // Firma bilgilerini ekle
      if (selectedFirma) {
        context += '\n🏢 FİRMA BİLGİLERİ:\n';
        context += `- Firma: ${selectedFirma.unvan}\n`;
        if (selectedFirma.vergi_no) context += `- Vergi No: ${selectedFirma.vergi_no}\n`;
        if (selectedFirma.yetkili_adi)
          context += `- Yetkili: ${selectedFirma.yetkili_adi} (${selectedFirma.yetkili_unvani || 'Şirket Yetkilisi'})\n`;
      }

      // ========== DÖKÜMAN ANALİZ VERİLERİ ==========
      // Teknik Şartlar - TÜM şartlar ekleniyor (limit yok)
      if (analysis.teknik_sartlar && analysis.teknik_sartlar.length > 0) {
        context += `\n📝 TEKNİK ŞARTLAR (${analysis.teknik_sartlar.length} adet):\n`;
        analysis.teknik_sartlar.forEach((sart, i) => {
          const sartText = typeof sart === 'object' ? sart.text : sart;
          const sartSource = typeof sart === 'object' && sart.source ? ` [${sart.source}]` : '';
          context += `${i + 1}. ${sartText}${sartSource}\n`;
        });
      }

      // Birim Fiyatlar - TÜM kalemler ekleniyor (limit yok)
      if (analysis.birim_fiyatlar && analysis.birim_fiyatlar.length > 0) {
        context += `\n💰 BİRİM FİYATLAR / MAL HİZMET LİSTESİ (${analysis.birim_fiyatlar.length} kalem):\n`;
        analysis.birim_fiyatlar.forEach((item, i) => {
          if (typeof item === 'object') {
            const source = item.source ? ` [${item.source}]` : '';
            context += `${i + 1}. ${item.kalem || item.aciklama || item.text || '-'}: ${item.miktar || '-'} ${item.birim || ''} - ${item.fiyat || item.tutar || '-'}${source}\n`;
          } else {
            context += `${i + 1}. ${item}\n`;
          }
        });
      }

      // AI Notları - TÜM notlar ekleniyor (limit yok)
      if (analysis.notlar && analysis.notlar.length > 0) {
        context += `\n⚠️ AI NOTLARI (${analysis.notlar.length} adet):\n`;
        analysis.notlar.forEach((not) => {
          const notText = typeof not === 'object' ? not.text : not;
          const notSource = typeof not === 'object' && not.source ? ` [${not.source}]` : '';
          context += `• ${notText}${notSource}\n`;
        });
      }

      // ========== HESAPLAMA VERİLERİ ==========
      // Rakip Teklifleri
      const gecerliTeklifler = teklifListesi.filter((t) => t.tutar > 0);
      if (gecerliTeklifler.length > 0) {
        context += `\n📊 RAKİP TEKLİFLERİ (${gecerliTeklifler.length} teklif):\n`;
        gecerliTeklifler.forEach((t, i) => {
          context += `${i + 1}. ${t.firma || `Firma ${i + 1}`}: ${t.tutar.toLocaleString('tr-TR')} TL\n`;
        });
      }

      // Maliyet Bileşenleri (eğer girilmişse)
      const toplamMaliyet = Object.values(maliyetBilesenleri).reduce((a, b) => a + b, 0);
      if (toplamMaliyet > 0) {
        context += '\n🧮 MALİYET BİLEŞENLERİ:\n';
        context += `- Ana Çiğ Girdi: ${maliyetBilesenleri.anaCigGirdi.toLocaleString('tr-TR')} TL\n`;
        context += `- Yardımcı Girdi: ${maliyetBilesenleri.yardimciGirdi.toLocaleString('tr-TR')} TL\n`;
        context += `- İşçilik: ${maliyetBilesenleri.iscilik.toLocaleString('tr-TR')} TL\n`;
        context += `- Nakliye: ${maliyetBilesenleri.nakliye.toLocaleString('tr-TR')} TL\n`;
        context += `- Sözleşme Gideri: ${maliyetBilesenleri.sozlesmeGideri.toLocaleString('tr-TR')} TL\n`;
        context += `- Genel Gider: ${maliyetBilesenleri.genelGider.toLocaleString('tr-TR')} TL\n`;
        context += `- Kar: ${maliyetBilesenleri.kar.toLocaleString('tr-TR')} TL\n`;
        context += `- TOPLAM MALİYET: ${toplamMaliyet.toLocaleString('tr-TR')} TL\n`;
      }

      // ========== PANO NOTLARI ==========
      if (clipboardItems.length > 0) {
        context += `\n📋 KULLANICI PANO NOTLARI (${clipboardItems.length} adet):\n`;
        clipboardItems.forEach((item, i) => {
          context += `${i + 1}. [${item.type}] ${item.content}\n`;
        });
      }

      // ========== TAM METİN ==========
      if (analysis.tam_metin && analysis.tam_metin.length > 0) {
        // Tam metin - 20000 karaktere kadar (daha fazla bilgi)
        const tamMetinOzet = analysis.tam_metin.substring(0, 20000);
        context += `\n📄 DÖKÜMAN TAM METİN:\n${tamMetinOzet}${analysis.tam_metin.length > 20000 ? '\n... (devamı var)' : ''}\n`;
      }

      // İhale ID'sini ekle (AI tool kullanabilsin)
      context += `\n🔑 İHALE ID: ${tender.tender_id || tender.id}\n`;
      context +=
        '\n---\nYukarıdaki ihale bilgileri, döküman analizleri, hesaplamalar ve kullanıcı notlarını baz alarak cevap ver. Tüm verilere erişimin var.\n\n';

      // Önceki mesajları history olarak hazırla (AI bağlamı hatırlasın)
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const data = await aiAPI.sendAgentMessage({
        message: inputMessage, // Sadece kullanıcı mesajı (context ayrı)
        systemContext: context, // Context ayrı gönderiliyor (kaydedilmeyecek)
        history: conversationHistory,
        sessionId: chatSessionId || undefined,
        templateSlug: 'ihale-uzman',
        pageContext: tender
          ? {
              type: 'tender',
              id: tender.tender_id || tender.id,
              title: tender.ihale_basligi,
            }
          : undefined,
      });

      if (!data.success && !(data as any).response) throw new Error('AI yanıt vermedi');

      // Backend'den sessionId gelirse onu kullan (eğer henüz set edilmemişse)
      if ((data as any).sessionId && !chatSessionId) {
        setChatSessionId((data as any).sessionId);
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: (data as any).response || data.message || 'Yanıt alınamadı',
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
      setDilekceMessages((prev) => [
        ...prev,
        { id: `d-${Date.now()}-user`, role: 'user', content: userInput },
      ]);
      setDilekceInput('');

      // Kullanıcı mesajını backend'e kaydet
      try {
        await aiAPI.saveConversationToMemory({
          sessionId: dilekceSessionId,
          context: {
            session_id: dilekceSessionId,
            user_id: 'default',
            role: 'user',
            content: userInput,
            tools_used: [],
            metadata: { type: 'dilekce_chat', dilekce_type: dilekceType },
          },
        });
      } catch (error) {
        console.error('Kullanıcı mesajı kaydetme hatası:', error);
        // Hata olsa bile devam et
      }
    }

    setDilekceLoading(true);

    try {
      const _analysis = analysisData;

      // Dilekçe türüne göre prompt oluştur
      let prompt = '';
      const ihaleBilgi = `
İHALE BİLGİLERİ:
- Başlık: ${tender.ihale_basligi}
- Kurum: ${tender.kurum}
- İhale No: ${tender.external_id || 'Bilinmiyor'}
- Tarih: ${tender.tarih || 'Bilinmiyor'}
- Yaklaşık Maliyet: ${yaklasikMaliyet > 0 ? `${yaklasikMaliyet.toLocaleString('tr-TR')} TL` : tender.bedel || 'Bilinmiyor'}
- Sınır Değer: ${sinirDeger ? `${sinirDeger.toLocaleString('tr-TR')} TL` : 'Hesaplanmadı'}
- Bizim Teklif: ${bizimTeklif > 0 ? `${bizimTeklif.toLocaleString('tr-TR')} TL` : 'Girilmedi'}
`;

      const maliyetBilgi = `
MALİYET BİLEŞENLERİ:
- Ana Çiğ Girdi: ${maliyetBilesenleri.anaCigGirdi.toLocaleString('tr-TR')} TL
- Yardımcı Girdi: ${maliyetBilesenleri.yardimciGirdi.toLocaleString('tr-TR')} TL
- İşçilik: ${maliyetBilesenleri.iscilik.toLocaleString('tr-TR')} TL
- Nakliye: ${maliyetBilesenleri.nakliye.toLocaleString('tr-TR')} TL
- Sözleşme Gideri: ${maliyetBilesenleri.sozlesmeGideri.toLocaleString('tr-TR')} TL
- Genel Gider + Kar: ${(maliyetBilesenleri.genelGider + maliyetBilesenleri.kar).toLocaleString('tr-TR')} TL
- TOPLAM: ${Object.values(maliyetBilesenleri)
        .reduce((a, b) => a + b, 0)
        .toLocaleString('tr-TR')} TL
`;

      // Firma bilgileri
      const firmaBilgi = selectedFirma
        ? `
FİRMA BİLGİLERİ (Dilekçede kullan):
- Firma Ünvanı: ${selectedFirma.unvan}
- Vergi No: ${selectedFirma.vergi_no || 'Belirtilmemiş'}
- Vergi Dairesi: ${selectedFirma.vergi_dairesi || 'Belirtilmemiş'}
- Adres: ${selectedFirma.adres || 'Belirtilmemiş'}
- Telefon: ${selectedFirma.telefon || 'Belirtilmemiş'}
- E-posta: ${selectedFirma.email || 'Belirtilmemiş'}
- Yetkili Adı: ${selectedFirma.yetkili_adi || 'Belirtilmemiş'}
- Yetkili Ünvanı: ${selectedFirma.yetkili_unvani || 'Şirket Yetkilisi'}
`
        : '';

      switch (dilekceType) {
        case 'asiri_dusuk':
          prompt = `Sen bir ihale hukuku uzmanısın. Aşağıdaki ihale için EK-H.4 formatında AŞIRI DÜŞÜK TEKLİF AÇIKLAMASI hazırla.

${ihaleBilgi}
${maliyetBilgi}
${firmaBilgi}

${userInput ? `KULLANICI İSTEĞİ: ${userInput}\n` : ''}

KURALLAR:
1. Resmi dilekçe formatında yaz
2. EK-H.4 Malzemeli Yemek Sunumu Hesap Cetveli formatını kullan
3. 4734 sayılı Kanun ve Hizmet Alımı İhaleleri Uygulama Yönetmeliği'ne atıf yap
4. Maliyet bileşenlerini tablo halinde sun
5. Teklifin ekonomik olarak sürdürülebilir olduğunu açıkla
6. Firma bilgilerini kullanarak imza bölümünü doldur (ünvan, yetkili adı, unvanı)
7. Tarih alanı bırak`;
          break;

        case 'idare_sikayet':
          prompt = `Sen bir ihale hukuku uzmanısın. Aşağıdaki ihale için İDAREYE ŞİKAYET DİLEKÇESİ hazırla.

${ihaleBilgi}
${firmaBilgi}

${userInput ? `ŞİKAYET KONUSU/SEBEBİ: ${userInput}\n` : 'Kullanıcı şikayet konusunu belirtmedi, genel bir şablon hazırla.\n'}

KURALLAR:
1. 4734 sayılı Kanun 54. maddesine uygun format kullan
2. Şikayet süresinin 10 gün olduğunu belirt
3. Tebliğ tarihinden itibaren süre başlangıcını not düş
4. İdareye hitap eden resmi format kullan
5. Talep kısmını net yaz (düzeltici işlem/iptal)
6. Firma bilgilerini kullanarak imza bölümünü doldur (ünvan, yetkili adı, unvanı, adres)
7. Tarih alanı bırak`;
          break;

        case 'kik_itiraz':
          prompt = `Sen bir ihale hukuku uzmanısın. Aşağıdaki ihale için KİK'e İTİRAZEN ŞİKAYET DİLEKÇESİ hazırla.

${ihaleBilgi}
${firmaBilgi}

${userInput ? `İTİRAZ KONUSU: ${userInput}\n` : 'Kullanıcı itiraz konusunu belirtmedi, genel bir şablon hazırla.\n'}

KURALLAR:
1. 4734 sayılı Kanun 56. maddesine uygun format kullan
2. Kamu İhale Kurumu Başkanlığına hitap et
3. İdareye yapılan şikayet özeti ekle
4. İtirazen şikayet bedeli bilgisini ekle
5. 10 günlük süreyi belirt
6. Emsal KİK kararlarına atıf yap
7. Firma bilgilerini kullanarak imza bölümünü doldur (ünvan, yetkili adı, unvanı, adres)
8. Tarih alanı bırak`;
          break;

        case 'aciklama_cevabi':
          prompt = `Sen bir ihale hukuku uzmanısın. Aşağıdaki ihale için İDARE AÇIKLAMA TALEBİNE CEVAP hazırla.

${ihaleBilgi}
${maliyetBilgi}
${firmaBilgi}

${userInput ? `AÇIKLAMA TALEBİ KONUSU: ${userInput}\n` : 'Kullanıcı açıklama konusunu belirtmedi, genel bir şablon hazırla.\n'}

KURALLAR:
1. İdare talebine cevap formatı kullan
2. Talep edilen bilgileri net ve açık sun
3. Destekleyici belgelere atıf yap
4. Profesyonel ve resmi dil kullan
5. Firma bilgilerini kullanarak imza bölümünü doldur (ünvan, yetkili adı, unvanı)
6. Tarih alanı bırak`;
          break;
      }

      // AI'a gönder
      const data = await aiAPI.sendAgentMessage({
        message: prompt,
        sessionId: dilekceSessionId || undefined,
        templateSlug: 'resmi-yazi', // Resmi Yazı Uzmanı şablonu (Opus model)
        pageContext: tender
          ? {
              type: 'tender',
              id: tender.tender_id || tender.id,
              title: tender.ihale_basligi,
            }
          : undefined,
      });

      if (!data.success && !(data as any).response) throw new Error('AI yanıt vermedi');
      const aiResponse = (data as any).response || data.message || 'Dilekçe oluşturulamadı';

      // Backend'den sessionId gelirse onu kullan (eğer henüz set edilmemişse)
      const finalSessionId = (data as any).sessionId || dilekceSessionId;
      if ((data as any).sessionId && !dilekceSessionId) {
        setDilekceSessionId((data as any).sessionId);
      }

      // AI cevabını mesajlara ekle
      const assistantMessageContent = 'Dilekçeniz hazırlandı. Sağ panelde görüntüleyebilirsiniz.';
      setDilekceMessages((prev) => [
        ...prev,
        { id: `d-${Date.now()}-asst`, role: 'assistant', content: assistantMessageContent },
      ]);

      // AI cevabını backend'e kaydet (eğer sessionId varsa)
      if (finalSessionId) {
        try {
          await aiAPI.saveConversationToMemory({
            sessionId: finalSessionId,
            context: {
              session_id: finalSessionId,
              user_id: 'default',
              role: 'assistant',
              content: assistantMessageContent,
              tools_used: (data as any).toolsUsed || [],
              metadata: {
                type: 'dilekce_chat',
                dilekce_type: dilekceType,
                dilekce_content_preview: aiResponse.substring(0, 500), // İlk 500 karakter önizleme
              },
            },
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
      setDilekceMessages((prev) => [
        ...prev,
        {
          id: `d-${Date.now()}-err`,
          role: 'assistant',
          content: 'Üzgünüm, dilekçe oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.',
        },
      ]);
    } finally {
      setDilekceLoading(false);
    }
  };

  // Dilekçe İndirme - Backend API kullanarak gerçek PDF/TXT
  const downloadDilekce = async (format: 'docx' | 'pdf') => {
    if (!dilekceContent || !tender) return;

    try {
      const blob = await aiAPI.exportDilekce(format, {
        title: dilekceTypeLabels[dilekceType || 'dilekce'],
        content: dilekceContent,
        metadata: {
          type: dilekceType,
          ihale: {
            baslik: tender.ihale_basligi,
            kurum: tender.kurum,
            ihale_no: tender.external_id,
          },
        },
      });
      const filename = `dilekce_${dilekceType || 'genel'}_${Date.now()}.${format === 'pdf' ? 'pdf' : 'docx'}`;

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
        message: `${filename} başarıyla indirildi`,
        color: 'green',
        icon: <IconDownload size={16} />,
      });
    } catch (error) {
      console.error('İndirme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Dilekçe indirilemedi',
        color: 'red',
      });
    }
  };

  // Dilekçe Kaydet
  const saveDilekce = async () => {
    if (!dilekceContent || !dilekceType || !tender) return;

    setDilekceSaving(true);
    try {
      const data = await aiAPI.saveDilekce({
        tender_tracking_id: tender.id,
        tender_id: tender.tender_id,
        dilekce_type: dilekceType,
        title: dilekceTypeLabels[dilekceType],
        content: dilekceContent,
        ihale_bilgileri: {
          baslik: tender.ihale_basligi,
          kurum: tender.kurum,
          ihale_no: tender.external_id,
          tarih: tender.tarih,
        },
        maliyet_bilgileri: {
          yaklasik_maliyet: yaklasikMaliyet,
          sinir_deger: sinirDeger,
          bizim_teklif: bizimTeklif,
          maliyet_bilesenleri: maliyetBilesenleri,
        },
      } as any);

      if (data.success) {
        notifications.show({
          title: 'Kaydedildi',
          message: data.message || 'Dilekçe başarıyla kaydedildi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        // Listeyi güncelle
        loadSavedDilekces();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Dilekçe kaydedilemedi',
        color: 'red',
      });
    } finally {
      setDilekceSaving(false);
    }
  };

  // Geçmiş dilekçeleri yükle
  const loadSavedDilekces = async () => {
    if (!tender) return;

    setDilekceListLoading(true);
    try {
      const data = await aiAPI.getDilekceByTender(tender.tender_id || tender.id);
      if (data.success) {
        // API returns { dilekce: [] } format
        setSavedDilekces((data.data as any)?.dilekce || data.data || []);
      }
    } catch (error) {
      console.error('Dilekçe listesi yüklenemedi:', error);
    } finally {
      setDilekceListLoading(false);
    }
  };

  // loadFirmalar artık useIhaleData hook'tan geliyor

  // Kayıtlı dilekçeyi yükle
  const loadDilekce = (dilekce: any) => {
    setDilekceType(dilekce.dilekce_type);
    setDilekceContent(dilekce.content);
    notifications.show({
      title: 'Yüklendi',
      message: `${dilekceTypeLabels[dilekce.dilekce_type]} v${dilekce.version} yüklendi`,
      color: 'blue',
    });
  };

  // Dilekçe sil
  const deleteDilekce = async (id: number) => {
    try {
      const data = await aiAPI.deleteDilekce(id);
      if (data.success) {
        notifications.show({
          title: 'Silindi',
          message: 'Dilekçe silindi',
          color: 'green',
        });
        loadSavedDilekces();
      }
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  // ========== ÇALIŞMA PANOSU - useClipboard hook'tan alias'lar ==========
  const addToClipboard = clipboard.addItem;
  const clipboardItems = clipboard.items;
  const _clipboardModalOpened = clipboard.modalOpened;
  const setClipboardModalOpened = clipboard.setModalOpened;

  // JSON export
  const _downloadJSON = () => {
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

  // analysisData artık useIhaleData hook'tan geliyor (yukarıda destructure edildi)

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Box
          className="modal-header-glass"
          style={{
            margin: 0,
            padding: isMobile && isMounted ? '12px 12px' : '16px 20px',
            borderRadius: 16,
          }}
        >
          <Group
            gap={isMobile && isMounted ? 'xs' : 'md'}
            wrap={isMobile && isMounted ? 'wrap' : 'nowrap'}
          >
            <ThemeIcon
              size={isMobile && isMounted ? 36 : 48}
              radius="xl"
              variant="gradient"
              gradient={{ from: 'violet', to: 'blue' }}
              style={{ boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' }}
            >
              <IconScale size={isMobile && isMounted ? 18 : 24} />
            </ThemeIcon>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Group gap="xs">
                <Text fw={700} size={isMobile && isMounted ? 'md' : 'lg'}>
                  İhale Uzmanı
                </Text>
                <Badge variant="gradient" gradient={{ from: 'violet', to: 'grape' }} size="xs">
                  PRO
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" lineClamp={1} maw={isMobile && isMounted ? '100%' : 500}>
                {tender.ihale_basligi}
              </Text>
            </div>

            {/* Mobilde Firma ve Pano butonları alt satırda */}
            {isMobile && isMounted ? (
              <Group gap="xs" w="100%" justify="space-between">
                {/* Firma Seçici - Mobil */}
                {firmalar.length > 0 && (
                  <Select
                    size="xs"
                    placeholder="Firma"
                    data={firmalar.map((f) => ({
                      value: f.id.toString(),
                      label:
                        f.kisa_ad && f.kisa_ad !== 'Kısa Ad' && f.kisa_ad.length > 2
                          ? f.kisa_ad
                          : f.unvan?.length > 15
                            ? `${f.unvan.substring(0, 15)}...`
                            : f.unvan,
                    }))}
                    value={selectedFirmaId?.toString() || null}
                    onChange={(val) => setSelectedFirmaId(val ? parseInt(val, 10) : null)}
                    leftSection={<IconBuilding size={12} />}
                    styles={{
                      root: { flex: 1, maxWidth: 140 },
                      input: { fontSize: 11 },
                    }}
                    comboboxProps={{ withinPortal: true }}
                  />
                )}

                {/* Çalışma Panosu Butonu - Mobil */}
                <Button
                  variant="light"
                  color="orange"
                  size="xs"
                  leftSection={<IconClipboardCopy size={14} />}
                  onClick={() => setClipboardModalOpened(true)}
                  style={{ fontWeight: 600 }}
                >
                  Pano
                  {clipboardItems.length > 0 && (
                    <Badge size="xs" variant="filled" color="orange" ml={4}>
                      {clipboardItems.length}
                    </Badge>
                  )}
                </Button>
              </Group>
            ) : (
              <>
                {/* Firma Seçici - Desktop */}
                {firmalar.length > 0 && (
                  <Select
                    size="xs"
                    placeholder="Firma seçin"
                    data={firmalar.map((f) => ({
                      value: f.id.toString(),
                      label:
                        f.kisa_ad && f.kisa_ad !== 'Kısa Ad' && f.kisa_ad.length > 2
                          ? f.kisa_ad
                          : f.unvan?.length > 30
                            ? `${f.unvan.substring(0, 30)}...`
                            : f.unvan,
                    }))}
                    value={selectedFirmaId?.toString() || null}
                    onChange={(val) => setSelectedFirmaId(val ? parseInt(val, 10) : null)}
                    leftSection={<IconBuilding size={14} />}
                    styles={{
                      root: { width: 220 },
                      input: { fontSize: 12 },
                    }}
                    comboboxProps={{ withinPortal: true }}
                  />
                )}

                {/* Çalışma Panosu Butonu - Desktop */}
                <Tooltip label="Çalışma Panosu" position="bottom">
                  <Button
                    variant="light"
                    color="orange"
                    size="sm"
                    leftSection={<IconClipboardCopy size={16} />}
                    onClick={() => setClipboardModalOpened(true)}
                    style={{ fontWeight: 600 }}
                  >
                    Pano
                    {clipboardItems.length > 0 && (
                      <Badge
                        size="xs"
                        variant="filled"
                        color="orange"
                        ml={6}
                        style={{ minWidth: 18 }}
                      >
                        {clipboardItems.length}
                      </Badge>
                    )}
                  </Button>
                </Tooltip>
              </>
            )}
          </Group>
        </Box>
      }
      size="xl"
      fullScreen
      transitionProps={{ transition: 'slide-up', duration: 300 }}
      styles={{
        header: {
          background: 'transparent',
          padding: isMobile && isMounted ? '8px 12px' : '12px 20px',
        },
        body: {
          padding: isMobile && isMounted ? '0 12px 12px 12px' : '0 24px 24px 24px',
        },
      }}
    >
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        variant="unstyled"
        classNames={{
          root: 'ihale-tabs-root',
          list: 'ihale-tabs-list',
          tab: 'ihale-tabs-tab',
        }}
      >
        <ScrollArea type={isMobile && isMounted ? 'scroll' : 'never'} scrollbarSize={4}>
          <Tabs.List
            grow={!(isMobile && isMounted)}
            mb={isMobile && isMounted ? 'sm' : 'lg'}
            style={{ flexWrap: 'nowrap' }}
          >
            <Tabs.Tab
              value="ozet"
              leftSection={<IconInfoCircle size={isMobile && isMounted ? 16 : 18} stroke={1.5} />}
              style={{ whiteSpace: 'nowrap', fontSize: isMobile && isMounted ? 13 : undefined }}
            >
              Özet
            </Tabs.Tab>
            <Tabs.Tab
              value="dokumanlar"
              leftSection={
                <IconClipboardList size={isMobile && isMounted ? 16 : 18} stroke={1.5} />
              }
              style={{ whiteSpace: 'nowrap', fontSize: isMobile && isMounted ? 13 : undefined }}
            >
              <Group gap={4}>
                {isMobile && isMounted ? 'Döküman' : 'Döküman Analizi'}
                {analysisStats && (
                  <Badge
                    size="xs"
                    variant="light"
                    color="gray"
                    styles={{
                      root: {
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        fontWeight: 600,
                      },
                    }}
                  >
                    {analysisStats.analiz_edilen}/{analysisStats.toplam_dokuman}
                  </Badge>
                )}
              </Group>
            </Tabs.Tab>
            <Tabs.Tab
              value="hesaplamalar"
              leftSection={<IconCalculator size={isMobile && isMounted ? 16 : 18} stroke={1.5} />}
              style={{ whiteSpace: 'nowrap', fontSize: isMobile && isMounted ? 13 : undefined }}
            >
              Araçlar
            </Tabs.Tab>
            <Tabs.Tab
              value="dilekce"
              leftSection={<IconBrain size={isMobile && isMounted ? 16 : 18} stroke={1.5} />}
              style={{ whiteSpace: 'nowrap', fontSize: isMobile && isMounted ? 13 : undefined }}
            >
              {isMobile && isMounted ? 'AI' : 'AI & Dilekçeler'}
            </Tabs.Tab>
          </Tabs.List>
        </ScrollArea>

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
            </Group>

            {/* Özet Kartları - Glassy Header Card */}
            <Paper className="glassy-header-card" p="lg" radius="lg">
              {/* Üst Bilgi Satırı */}
              <Group justify="space-between" mb="md">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text fw={700} size="lg">
                      {tender.ihale_basligi?.substring(0, 60) || 'İhale'}
                      {tender.ihale_basligi && tender.ihale_basligi.length > 60 ? '...' : ''}
                    </Text>
                    <Badge className="glassy-badge info" size="sm">
                      {tender.status === 'bekliyor'
                        ? 'Bekliyor'
                        : tender.status === 'kazanildi'
                          ? 'Kazanıldı'
                          : tender.status === 'basvuruldu'
                            ? 'Başvuruldu'
                            : 'Kaybedildi'}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    İhale No: #{tender.tender_id || tender.id}
                  </Text>
                </div>
              </Group>

              {/* Glassy Bilgi Satırı - Görsel'deki gibi */}
              <div className="glassy-info-row">
                <div className="glassy-info-item">
                  <div className="glassy-info-label">Kurum</div>
                  <div className="glassy-info-value">{tender.kurum || 'Belirtilmemiş'}</div>
                </div>
                <div className="glassy-info-item">
                  <div className="glassy-info-label">Şehir</div>
                  <div className="glassy-info-value">{tender.city || 'Belirtilmemiş'}</div>
                </div>
                <div className="glassy-info-item">
                  <div className="glassy-info-label">Tarih</div>
                  <div className="glassy-info-value">{tender.tarih || 'Belirtilmemiş'}</div>
                </div>
                <div className="glassy-info-item">
                  <div className="glassy-info-label">Bedel</div>
                  <div className="glassy-info-value">{tender.bedel || 'Belirtilmemiş'}</div>
                </div>
              </div>
            </Paper>

            {/* Hesaplama Özeti - Glassy Content Card */}
            <Paper
              className="glassy-content-card"
              p="md"
              radius="lg"
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveTab('hesaplamalar')}
            >
              <Group justify="space-between">
                <Group gap="md">
                  <ThemeIcon
                    size="lg"
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'indigo' }}
                    radius="xl"
                  >
                    <IconCalculator size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={600} size="sm">
                      Teklif Hesaplamaları
                    </Text>
                    {yaklasikMaliyet > 0 || sinirDeger || bizimTeklif > 0 ? (
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
                    ) : (
                      <Text size="xs" c="dimmed">
                        Sınır değer, aşırı düşük ve itiraz bedeli hesapla
                      </Text>
                    )}
                  </div>
                </Group>
                <Group gap="sm">
                  {sinirDeger && bizimTeklif > 0 && (
                    <Badge
                      className={`glassy-badge ${bizimTeklif < sinirDeger ? 'warning' : 'success'}`}
                      leftSection={
                        bizimTeklif < sinirDeger ? (
                          <IconAlertTriangle size={12} />
                        ) : (
                          <IconCheck size={12} />
                        )
                      }
                    >
                      {bizimTeklif < sinirDeger
                        ? `%${Math.round((bizimTeklif / sinirDeger) * 100)} - Risk`
                        : 'Uygun'}
                    </Badge>
                  )}
                  <Badge className="glassy-badge info" rightSection={<IconEye size={12} />}>
                    {yaklasikMaliyet > 0 ? 'Detay' : 'Hesapla'}
                  </Badge>
                </Group>
              </Group>
            </Paper>

            {/* TEKLİF CETVELİ KARTI - Glassy Style */}
            <Paper className="glassy-content-card" p="lg" radius="lg">
              <Group justify="space-between" mb="md">
                <Group gap="sm">
                  <ThemeIcon
                    size="lg"
                    variant={teklifOzet ? 'gradient' : 'light'}
                    gradient={{ from: 'teal', to: 'cyan' }}
                    color="teal"
                    radius="xl"
                  >
                    <IconReceipt size={20} />
                  </ThemeIcon>
                  <div>
                    <Group gap={6}>
                      <Text fw={600} size="sm">
                        Teklif Cetveli
                      </Text>
                      <Text size="xs" c="dimmed" fs="italic">
                        (ön teklif hesaplama)
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {teklifOzet
                        ? `Son güncelleme: ${teklifOzet.sonGuncelleme || 'Bilinmiyor'}`
                        : 'Detaylı maliyet analizi ve teklif hazırlama'}
                    </Text>
                  </div>
                </Group>
                {teklifOzet && (
                  <Badge variant="filled" color="teal" size="lg">
                    {teklifOzet.teklifTutari.toLocaleString('tr-TR')} ₺
                  </Badge>
                )}
              </Group>

              {teklifOzet ? (
                <>
                  {/* Maliyet Kartları - Glassy Nested */}
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="xs" mb="md">
                    <Paper className="glassy-card-nested" p="xs" radius="md">
                      <Group gap={4} mb={2}>
                        <IconUsers size={14} color="var(--mantine-color-blue-5)" />
                        <Text size="xs" c="blue.4" fw={600}>
                          Personel
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {teklifOzet.personelSayisi} kişi
                      </Text>
                      <Text size="sm" fw={700} c="blue.4">
                        {teklifOzet.personelMaliyet.toLocaleString('tr-TR')} ₺
                      </Text>
                    </Paper>

                    <Paper className="glassy-card-nested" p="xs" radius="md">
                      <Group gap={4} mb={2}>
                        <IconTruck size={14} color="var(--mantine-color-orange-5)" />
                        <Text size="xs" c="orange.4" fw={600}>
                          Nakliye
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {teklifOzet.aracSayisi} araç
                      </Text>
                      <Text size="sm" fw={700} c="orange.4">
                        {teklifOzet.nakliyeMaliyet.toLocaleString('tr-TR')} ₺
                      </Text>
                    </Paper>

                    <Paper className="glassy-card-nested" p="xs" radius="md">
                      <Group gap={4} mb={2}>
                        <IconPackage size={14} color="var(--mantine-color-green-5)" />
                        <Text size="xs" c="green.4" fw={600}>
                          Sarf
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {teklifOzet.sarfKalemSayisi} kalem
                      </Text>
                      <Text size="sm" fw={700} c="green.4">
                        {teklifOzet.sarfMaliyet.toLocaleString('tr-TR')} ₺
                      </Text>
                    </Paper>

                    <Paper className="glassy-card-nested" p="xs" radius="md">
                      <Group gap={4} mb={2}>
                        <IconTool size={14} color="var(--mantine-color-grape-5)" />
                        <Text size="xs" c="grape.4" fw={600}>
                          Ekipman
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {teklifOzet.ekipmanSayisi} kalem
                      </Text>
                      <Text size="sm" fw={700} c="grape.4">
                        {teklifOzet.ekipmanMaliyet.toLocaleString('tr-TR')} ₺
                      </Text>
                    </Paper>

                    <Paper className="glassy-card-nested" p="xs" radius="md">
                      <Group gap={4} mb={2}>
                        <IconBuildingBank size={14} color="var(--mantine-color-red-5)" />
                        <Text size="xs" c="red.4" fw={600}>
                          Yasal
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        SGK, Vergi
                      </Text>
                      <Text size="sm" fw={700} c="red.4">
                        {teklifOzet.yasalMaliyet.toLocaleString('tr-TR')} ₺
                      </Text>
                    </Paper>

                    <Paper className="glassy-card-nested" p="xs" radius="md">
                      <Group gap={4} mb={2}>
                        <IconReceipt size={14} color="var(--mantine-color-gray-5)" />
                        <Text size="xs" c="gray.4" fw={600}>
                          Genel
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        Giderler
                      </Text>
                      <Text size="sm" fw={700} c="gray.4">
                        {teklifOzet.genelGiderMaliyet.toLocaleString('tr-TR')} ₺
                      </Text>
                    </Paper>
                  </SimpleGrid>

                  {/* Özet Satır - Glassy */}
                  <Paper className="glassy-card-nested" p="sm" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed">
                          Toplam Maliyet
                        </Text>
                        <Text size="md" fw={700}>
                          {teklifOzet.toplamMaliyet.toLocaleString('tr-TR')} ₺
                        </Text>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Text size="xs" c="dimmed">
                          Kar Oranı
                        </Text>
                        <Badge size="lg" variant="light" color="teal">
                          %{teklifOzet.karOrani}
                        </Badge>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="xs" c="dimmed">
                          Teklif Tutarı
                        </Text>
                        <Text size="lg" fw={700} c="teal.7">
                          {teklifOzet.teklifTutari.toLocaleString('tr-TR')} ₺
                        </Text>
                      </div>
                      {sinirDeger && (
                        <Badge
                          size="lg"
                          variant="filled"
                          color={teklifOzet.teklifTutari < sinirDeger ? 'orange' : 'green'}
                          leftSection={
                            teklifOzet.teklifTutari < sinirDeger ? (
                              <IconAlertTriangle size={14} />
                            ) : (
                              <IconCheck size={14} />
                            )
                          }
                        >
                          {teklifOzet.teklifTutari < sinirDeger ? 'Risk' : 'Uygun'}
                        </Badge>
                      )}
                    </Group>
                  </Paper>

                  {/* Butonlar */}
                  <Group justify="flex-end" mt="md" gap="xs">
                    <Button
                      variant="light"
                      color="teal"
                      size="sm"
                      leftSection={<IconPencil size={16} />}
                      onClick={() => setTeklifModalOpened(true)}
                    >
                      Teklif Düzenle
                    </Button>
                    <Button
                      variant="outline"
                      color="teal"
                      size="sm"
                      leftSection={<IconDownload size={16} />}
                    >
                      Excel İndir
                    </Button>
                  </Group>
                </>
              ) : (
                /* Teklif Hazırlanmamış Durumu */
                <Center py="xl">
                  <Stack align="center" gap="md">
                    <ThemeIcon size={60} variant="light" color="teal" radius="xl">
                      <IconReceipt size={30} />
                    </ThemeIcon>
                    <div style={{ textAlign: 'center' }}>
                      <Text fw={600} size="md" mb={4}>
                        Henüz teklif cetveli hazırlanmadı
                      </Text>
                      <Text size="sm" c="dimmed" maw={400}>
                        Döküman analizinden elde edilen birim fiyatları kullanarak detaylı maliyet
                        analizi ve teklif cetveli hazırlayın
                      </Text>
                    </div>
                    <Button
                      variant="gradient"
                      gradient={{ from: 'teal', to: 'cyan' }}
                      size="md"
                      leftSection={<IconPlus size={18} />}
                      onClick={() => setTeklifModalOpened(true)}
                    >
                      Teklif Cetveli Hazırla
                    </Button>
                  </Stack>
                </Center>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* DÖKÜMANLAR TAB */}
        <Tabs.Panel value="dokumanlar">
          <DokumanlarTab
            analysisData={analysisData}
            tenderId={tender?.tender_id}
            onHideNote={hideNote}
            addToClipboard={addToClipboard}
          />
        </Tabs.Panel>

        {/* HESAPLAMALAR TAB */}
        <Tabs.Panel value="hesaplamalar">
          <HesaplamalarTab
            yaklasikMaliyet={yaklasikMaliyet}
            setYaklasikMaliyet={setYaklasikMaliyet}
            sinirDeger={sinirDeger}
            setSinirDeger={setSinirDeger}
            bizimTeklif={bizimTeklif}
            setBizimTeklif={setBizimTeklif}
            teklifListesi={teklifListesi}
            setTeklifListesi={setTeklifListesi}
            hesaplananSinirDeger={hesaplananSinirDeger}
            maliyetBilesenleri={maliyetBilesenleri}
            setMaliyetBilesenleri={setMaliyetBilesenleri}
            asiriDusukSonuc={asiriDusukSonuc}
            teminatSonuc={teminatSonuc}
            bedelData={bedelData}
            setBedelData={setBedelData}
            bedelSonuc={bedelSonuc}
            saveStatus={saveStatus}
            hesaplaSinirDeger={hesaplaSinirDeger}
            hesaplaAsiriDusuk={hesaplaAsiriDusuk}
            hesaplaTeminat={hesaplaTeminat}
            hesaplaBedel={hesaplaBedel}
          />
        </Tabs.Panel>

        {/* AI & DİLEKÇELER TAB - Birleştirilmiş Panel */}
        <Tabs.Panel value="dilekce">
          <Box style={{ display: 'flex', gap: 'var(--mantine-spacing-lg)', minHeight: 550 }}>
            {/* SOL SİDEBAR - Dilekçe Türleri (Sabit) */}
            <Paper
              p="md"
              withBorder
              radius="lg"
              style={{
                width: 220,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                background:
                  'linear-gradient(180deg, rgba(139, 92, 246, 0.03) 0%, rgba(255,255,255,1) 100%)',
              }}
            >
              {/* AI Danışman Kartı */}
              <Paper
                p="sm"
                radius="md"
                onClick={() => {
                  setActivePanel('ai');
                  setDilekceType(null);
                }}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border:
                    activePanel === 'ai' && !dilekceType
                      ? '2px solid var(--mantine-color-violet-5)'
                      : '1px solid var(--mantine-color-gray-2)',
                  backgroundColor:
                    activePanel === 'ai' && !dilekceType
                      ? 'var(--mantine-color-violet-0)'
                      : 'white',
                  marginBottom: 12,
                }}
              >
                <Group gap="xs" wrap="nowrap">
                  <ThemeIcon
                    size={36}
                    radius="md"
                    variant={activePanel === 'ai' && !dilekceType ? 'gradient' : 'light'}
                    gradient={{ from: 'violet', to: 'pink' }}
                    color="violet"
                  >
                    <IconBrain size={18} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" fw={600}>
                      AI Danışman
                    </Text>
                    <Text size="xs" c="dimmed">
                      İhale danışmanlığı
                    </Text>
                  </div>
                </Group>
              </Paper>

              {/* Ayırıcı */}
              <Box
                mb="sm"
                pb="sm"
                style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
              >
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="light" color="gray" radius="xl">
                    <IconFileText size={12} />
                  </ThemeIcon>
                  <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                    Dilekçe Türü
                  </Text>
                </Group>
              </Box>

              <Stack gap="xs" style={{ flex: 1 }}>
                {/* Aşırı Düşük */}
                <Paper
                  p="sm"
                  radius="md"
                  onClick={() => handleDilekceTypeChange('asiri_dusuk')}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border:
                      dilekceType === 'asiri_dusuk'
                        ? '2px solid var(--mantine-color-orange-5)'
                        : '1px solid var(--mantine-color-gray-2)',
                    backgroundColor:
                      dilekceType === 'asiri_dusuk' ? 'var(--mantine-color-orange-0)' : 'white',
                  }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <ThemeIcon
                      size={32}
                      radius="md"
                      variant={dilekceType === 'asiri_dusuk' ? 'filled' : 'light'}
                      color="orange"
                    >
                      <IconFileAnalytics size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" fw={600}>
                        Aşırı Düşük
                      </Text>
                      <Text size="xs" c="dimmed">
                        EK-H.4
                      </Text>
                    </div>
                  </Group>
                </Paper>

                {/* İdareye Şikayet */}
                <Paper
                  p="sm"
                  radius="md"
                  onClick={() => handleDilekceTypeChange('idare_sikayet')}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border:
                      dilekceType === 'idare_sikayet'
                        ? '2px solid var(--mantine-color-red-5)'
                        : '1px solid var(--mantine-color-gray-2)',
                    backgroundColor:
                      dilekceType === 'idare_sikayet' ? 'var(--mantine-color-red-0)' : 'white',
                  }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <ThemeIcon
                      size={32}
                      radius="md"
                      variant={dilekceType === 'idare_sikayet' ? 'filled' : 'light'}
                      color="red"
                    >
                      <IconGavel size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" fw={600}>
                        İdareye Şikayet
                      </Text>
                      <Text size="xs" c="dimmed">
                        10 gün
                      </Text>
                    </div>
                  </Group>
                </Paper>

                {/* KİK İtiraz */}
                <Paper
                  p="sm"
                  radius="md"
                  onClick={() => handleDilekceTypeChange('kik_itiraz')}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border:
                      dilekceType === 'kik_itiraz'
                        ? '2px solid var(--mantine-color-violet-5)'
                        : '1px solid var(--mantine-color-gray-2)',
                    backgroundColor:
                      dilekceType === 'kik_itiraz' ? 'var(--mantine-color-violet-0)' : 'white',
                  }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <ThemeIcon
                      size={32}
                      radius="md"
                      variant={dilekceType === 'kik_itiraz' ? 'filled' : 'light'}
                      color="violet"
                    >
                      <IconScale size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" fw={600}>
                        KİK İtiraz
                      </Text>
                      <Text size="xs" c="dimmed">
                        İtirazen
                      </Text>
                    </div>
                  </Group>
                </Paper>

                {/* Açıklama Cevabı */}
                <Paper
                  p="sm"
                  radius="md"
                  onClick={() => handleDilekceTypeChange('aciklama_cevabi')}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border:
                      dilekceType === 'aciklama_cevabi'
                        ? '2px solid var(--mantine-color-teal-5)'
                        : '1px solid var(--mantine-color-gray-2)',
                    backgroundColor:
                      dilekceType === 'aciklama_cevabi' ? 'var(--mantine-color-teal-0)' : 'white',
                  }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <ThemeIcon
                      size={32}
                      radius="md"
                      variant={dilekceType === 'aciklama_cevabi' ? 'filled' : 'light'}
                      color="teal"
                    >
                      <IconNote size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" fw={600}>
                        Açıklama
                      </Text>
                      <Text size="xs" c="dimmed">
                        Cevap
                      </Text>
                    </div>
                  </Group>
                </Paper>
              </Stack>

              {/* Seçili Tür Bilgisi */}
              {dilekceType && (
                <Paper p="sm" radius="md" className="nested-card" mt="auto">
                  <Text size="xs" c="dimmed" mb={4}>
                    📋 Seçili:
                  </Text>
                  <Text
                    size="xs"
                    fw={600}
                    c={
                      dilekceType === 'asiri_dusuk'
                        ? 'orange'
                        : dilekceType === 'idare_sikayet'
                          ? 'red'
                          : dilekceType === 'kik_itiraz'
                            ? 'violet'
                            : 'teal'
                    }
                  >
                    {dilekceTypeLabels[dilekceType]}
                  </Text>
                </Paper>
              )}
            </Paper>

            {/* SAĞ PANEL - Dinamik İçerik */}
            <Paper
              p="lg"
              withBorder
              radius="lg"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {activePanel === 'ai' ? (
                /* AI DANIŞMAN PANELİ */
                <Stack gap="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Chat Area */}
                  <Paper
                    withBorder
                    p="md"
                    radius="md"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                  >
                    <ScrollArea
                      type="scroll"
                      style={{ flex: 1, height: '100%' }}
                      offsetScrollbars
                      styles={{
                        viewport: {
                          paddingBottom: 16,
                        },
                      }}
                    >
                      {messages.length === 0 ? (
                        <Box
                          py="xl"
                          px="md"
                          style={{
                            background:
                              'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, rgba(236, 72, 153, 0.03) 100%)',
                            borderRadius: 16,
                            minHeight: '100%',
                          }}
                        >
                          <Stack gap="lg" align="center">
                            {/* Header with animated icon */}
                            <Box style={{ position: 'relative', padding: 16 }}>
                              <Box
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background:
                                    'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
                                  borderRadius: '50%',
                                  filter: 'blur(20px)',
                                }}
                              />
                              <ThemeIcon
                                size={70}
                                radius="xl"
                                variant="gradient"
                                gradient={{ from: 'violet', to: 'pink', deg: 135 }}
                                style={{ boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)' }}
                              >
                                <IconBrain size={36} />
                              </ThemeIcon>
                            </Box>

                            <div>
                              <Text fw={700} ta="center" size="xl" style={{ letterSpacing: -0.5 }}>
                                İhale Danışmanınız Hazır
                              </Text>
                              <Text c="dimmed" ta="center" size="sm" mt={4}>
                                Opus AI ile detaylı ihale analizi ve stratejik danışmanlık
                              </Text>
                            </div>

                            {/* Kategori Seçici */}
                            <Box w="100%" maw={750}>
                              <Chip.Group
                                multiple={false}
                                value={selectedQuestionCategory}
                                onChange={(val) => setSelectedQuestionCategory(val as string)}
                              >
                                <Group gap={8} justify="center" mb="lg" wrap="wrap">
                                  <Chip
                                    value="teknik"
                                    variant="light"
                                    color="blue"
                                    size="sm"
                                    styles={{ label: { fontWeight: 500 } }}
                                  >
                                    🔧 Teknik
                                  </Chip>
                                  <Chip
                                    value="mali"
                                    variant="light"
                                    color="green"
                                    size="sm"
                                    styles={{ label: { fontWeight: 500 } }}
                                  >
                                    💰 Mali
                                  </Chip>
                                  <Chip
                                    value="risk"
                                    variant="light"
                                    color="orange"
                                    size="sm"
                                    styles={{ label: { fontWeight: 500 } }}
                                  >
                                    ⚠️ Risk
                                  </Chip>
                                  <Chip
                                    value="yeterlilik"
                                    variant="light"
                                    color="violet"
                                    size="sm"
                                    styles={{ label: { fontWeight: 500 } }}
                                  >
                                    📋 Yeterlilik
                                  </Chip>
                                  <Chip
                                    value="lojistik"
                                    variant="light"
                                    color="cyan"
                                    size="sm"
                                    styles={{ label: { fontWeight: 500 } }}
                                  >
                                    🚚 Lojistik
                                  </Chip>
                                  <Chip
                                    value="strateji"
                                    variant="light"
                                    color="grape"
                                    size="sm"
                                    styles={{ label: { fontWeight: 500 } }}
                                  >
                                    🎯 Strateji
                                  </Chip>
                                  <Chip
                                    value="hukuki"
                                    variant="light"
                                    color="red"
                                    size="sm"
                                    styles={{ label: { fontWeight: 500 } }}
                                  >
                                    ⚖️ Hukuki
                                  </Chip>
                                </Group>
                              </Chip.Group>

                              {/* Seçili Kategorinin Soruları - Kısa Liste */}
                              <Paper
                                withBorder
                                p="md"
                                radius="lg"
                                bg="white"
                                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
                              >
                                <ScrollArea h={180} offsetScrollbars>
                                  <Stack gap={4}>
                                    {(selectedQuestionCategory === 'teknik'
                                      ? [
                                          'Günlük menü çeşitliliği ve yemek sayısı ne olmalı?',
                                          'Gramaj ve porsiyon miktarları neler?',
                                          'Gıda güvenliği sertifikaları gerekli mi?',
                                          'Personel sayısı ve nitelikleri ne olmalı?',
                                        ]
                                      : selectedQuestionCategory === 'mali'
                                        ? [
                                            'Bu ihalenin tahmini karını hesapla.',
                                            'Yaklaşık maliyet ve sınır değer nedir?',
                                            'Maliyet kalemleri neler?',
                                            'Teminat oranları nedir?',
                                          ]
                                        : selectedQuestionCategory === 'risk'
                                          ? [
                                              'Bu ihale için risk değerlendirmesi yap.',
                                              'Cezai şartlar ve kesinti oranları neler?',
                                              'Sözleşme fesih koşulları nelerdir?',
                                            ]
                                          : selectedQuestionCategory === 'yeterlilik'
                                            ? [
                                                'İş deneyim belgesi tutarı ne kadar olmalı?',
                                                'Benzer iş tanımı nedir?',
                                                'Kalite belgeleri hangileri isteniyor?',
                                              ]
                                            : selectedQuestionCategory === 'lojistik'
                                              ? [
                                                  'Teslimat noktaları ve dağıtım planı ne olmalı?',
                                                  'Araç ve ekipman gereksinimleri neler?',
                                                ]
                                              : selectedQuestionCategory === 'strateji'
                                                ? [
                                                    'Optimal teklif fiyatı ne olmalı?',
                                                    'Rakip analizi yap.',
                                                  ]
                                                : [
                                                    'İhale hukuki açıdan uygun mu?',
                                                    'Şartname maddelerini değerlendir.',
                                                  ]
                                    ).map((soru) => (
                                      <Paper
                                        key={soru}
                                        p="sm"
                                        radius="md"
                                        style={{
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                          border: '1px solid transparent',
                                        }}
                                        onClick={() => setInputMessage(soru)}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor =
                                            'var(--mantine-color-violet-0)';
                                          e.currentTarget.style.borderColor =
                                            'var(--mantine-color-violet-2)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                          e.currentTarget.style.borderColor = 'transparent';
                                        }}
                                      >
                                        <Group gap="xs" wrap="nowrap">
                                          <Text size="sm" c="violet.5">
                                            →
                                          </Text>
                                          <Text size="sm">{soru}</Text>
                                        </Group>
                                      </Paper>
                                    ))}
                                  </Stack>
                                </ScrollArea>
                              </Paper>
                            </Box>
                          </Stack>
                        </Box>
                      ) : (
                        <Stack gap="md" p="md" pb="xl">
                          {messages.map((msg: ChatMessage) => (
                            <Box
                              key={msg.id}
                              style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                gap: 8,
                                alignItems: 'flex-start',
                              }}
                            >
                              {msg.role !== 'user' && (
                                <ThemeIcon
                                  size={32}
                                  radius="xl"
                                  variant="gradient"
                                  gradient={{ from: 'violet', to: 'pink', deg: 135 }}
                                  style={{ flexShrink: 0 }}
                                >
                                  <IconBrain size={18} />
                                </ThemeIcon>
                              )}
                              <Paper
                                p="md"
                                radius="lg"
                                style={{
                                  maxWidth: '80%',
                                  backgroundColor:
                                    msg.role === 'user'
                                      ? 'var(--mantine-color-violet-6)'
                                      : 'var(--mantine-color-gray-0)',
                                  borderTopRightRadius: msg.role === 'user' ? 4 : 16,
                                  borderTopLeftRadius: msg.role === 'user' ? 16 : 4,
                                }}
                              >
                                <Text
                                  size="sm"
                                  c={msg.role === 'user' ? 'white' : 'dark'}
                                  style={{ whiteSpace: 'pre-wrap' }}
                                >
                                  {stripContextFromMessage(msg.content)}
                                </Text>
                                {msg.timestamp && (
                                  <Text
                                    size="xs"
                                    c={msg.role === 'user' ? 'violet.1' : 'dimmed'}
                                    mt={4}
                                  >
                                    {msg.timestamp.toLocaleTimeString('tr-TR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </Text>
                                )}
                              </Paper>
                              {msg.role === 'user' && (
                                <ThemeIcon
                                  size={32}
                                  radius="xl"
                                  variant="light"
                                  color="violet"
                                  style={{ flexShrink: 0 }}
                                >
                                  <Text size="xs" fw={600}>
                                    S
                                  </Text>
                                </ThemeIcon>
                              )}
                            </Box>
                          ))}
                          {isAILoading && (
                            <Group gap="xs">
                              <ThemeIcon
                                size={32}
                                radius="xl"
                                variant="gradient"
                                gradient={{ from: 'violet', to: 'pink' }}
                              >
                                <IconBrain size={18} />
                              </ThemeIcon>
                              <Paper p="md" radius="md" className="nested-card">
                                <Loader size="sm" color="violet" />
                              </Paper>
                            </Group>
                          )}
                          <div ref={chatEndRef} />
                        </Stack>
                      )}
                    </ScrollArea>
                  </Paper>

                  {/* Input Area */}
                  <Box>
                    <Group gap="sm" align="flex-end">
                      <Textarea
                        placeholder="İhale hakkında bir soru sorun..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        autosize
                        minRows={1}
                        maxRows={4}
                        style={{ flex: 1 }}
                        styles={{
                          input: {
                            borderRadius: 12,
                            border: '2px solid var(--mantine-color-gray-3)',
                            '&:focus': { borderColor: 'var(--mantine-color-violet-5)' },
                          },
                        }}
                      />
                      <ActionIcon
                        size="xl"
                        radius="xl"
                        variant="gradient"
                        gradient={{ from: 'violet', to: 'grape' }}
                        onClick={sendMessage}
                        loading={isAILoading}
                        disabled={!inputMessage.trim()}
                      >
                        <IconSend size={18} />
                      </ActionIcon>
                    </Group>
                  </Box>
                </Stack>
              ) : !showDilekceChat ? (
                /* STATE 2: Tür seçili - Birleşik Liste (Konuşmalar + Kayıtlı Dilekçeler) */
                <Stack gap="md" style={{ flex: 1, overflow: 'hidden' }}>
                  {/* Header */}
                  <Group justify="space-between">
                    <Group gap="sm">
                      <ThemeIcon
                        size="md"
                        variant="light"
                        radius="lg"
                        color={
                          dilekceType === 'asiri_dusuk'
                            ? 'orange'
                            : dilekceType === 'idare_sikayet'
                              ? 'red'
                              : dilekceType === 'kik_itiraz'
                                ? 'violet'
                                : 'teal'
                        }
                      >
                        {dilekceType === 'asiri_dusuk' && <IconFileAnalytics size={18} />}
                        {dilekceType === 'idare_sikayet' && <IconGavel size={18} />}
                        {dilekceType === 'kik_itiraz' && <IconScale size={18} />}
                        {dilekceType === 'aciklama_cevabi' && <IconNote size={18} />}
                      </ThemeIcon>
                      <div>
                        <Text fw={600} size="sm">
                          {dilekceType && dilekceTypeLabels[dilekceType]}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {dilekceConversations.length +
                            savedDilekces.filter((d) => d.dilekce_type === dilekceType).length}{' '}
                          kayıt
                        </Text>
                      </div>
                    </Group>
                    <Button
                      variant="gradient"
                      gradient={{ from: 'violet', to: 'grape' }}
                      leftSection={<IconPlus size={16} />}
                      onClick={startNewDilekceConversation}
                    >
                      Yeni Oluştur
                    </Button>
                  </Group>

                  {/* Bilgi Kutusu */}
                  <Alert
                    variant="light"
                    color={
                      dilekceType === 'asiri_dusuk'
                        ? 'orange'
                        : dilekceType === 'idare_sikayet'
                          ? 'red'
                          : dilekceType === 'kik_itiraz'
                            ? 'violet'
                            : 'teal'
                    }
                    radius="md"
                    icon={<IconInfoCircle size={18} />}
                  >
                    <Text size="xs">
                      {dilekceType === 'asiri_dusuk' &&
                        "EK-H.4 formatında maliyet tablosu ve 4734 sayılı Kanun'a uygun aşırı düşük teklif açıklaması hazırlanır."}
                      {dilekceType === 'idare_sikayet' &&
                        'Kesinleşen ihale kararının tebliğinden itibaren 10 gün içinde idareye şikayet başvurusu yapılabilir.'}
                      {dilekceType === 'kik_itiraz' &&
                        "İdare şikayet sonucundan memnun kalınmazsa KİK'e itirazen şikayet başvurusu yapılabilir."}
                      {dilekceType === 'aciklama_cevabi' &&
                        'İdarenin açıklama talebine profesyonel ve detaylı cevap hazırlanır.'}
                    </Text>
                  </Alert>

                  {/* Liste */}
                  <ScrollArea type="scroll" style={{ flex: 1, height: '100%' }} offsetScrollbars>
                    <Stack gap="sm" pb="md">
                      {/* Kayıtlı Dilekçeler (Bu türe ait) */}
                      {savedDilekces.filter((d) => d.dilekce_type === dilekceType).length > 0 && (
                        <>
                          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                            📄 Kayıtlı Dilekçeler
                          </Text>
                          {savedDilekces
                            .filter((d) => d.dilekce_type === dilekceType)
                            .map((d: any) => (
                              <Paper
                                key={d.id}
                                p="md"
                                withBorder
                                radius="lg"
                                style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                                onClick={() => loadDilekce(d)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor =
                                    'var(--mantine-color-green-4)';
                                  e.currentTarget.style.backgroundColor =
                                    'var(--mantine-color-green-0)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--mantine-color-gray-3)';
                                  e.currentTarget.style.backgroundColor = 'white';
                                }}
                              >
                                <Group justify="space-between" wrap="nowrap">
                                  <Group gap="sm" wrap="nowrap">
                                    <ThemeIcon size="lg" variant="light" color="green" radius="lg">
                                      <IconDeviceFloppy size={18} />
                                    </ThemeIcon>
                                    <div>
                                      <Text size="sm" fw={500}>
                                        v{d.version} - {d.title}
                                      </Text>
                                      <Text size="xs" c="dimmed">
                                        {new Date(d.created_at).toLocaleDateString('tr-TR', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </Text>
                                    </div>
                                  </Group>
                                  <Group gap="xs">
                                    <Tooltip label="PDF İndir">
                                      <ActionIcon
                                        variant="light"
                                        color="red"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          downloadDilekce('pdf');
                                        }}
                                      >
                                        <IconDownload size={14} />
                                      </ActionIcon>
                                    </Tooltip>
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteDilekce(d.id);
                                      }}
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  </Group>
                                </Group>
                              </Paper>
                            ))}
                        </>
                      )}

                      {/* Konuşma Geçmişi */}
                      {dilekceConversations.length > 0 && (
                        <>
                          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mt="sm">
                            💬 Konuşma Geçmişi
                          </Text>
                          {dilekceConversations.map((conv: any) => (
                            <Paper
                              key={conv.session_id}
                              p="md"
                              withBorder
                              radius="lg"
                              style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                              onClick={() => openDilekceConversation(conv.session_id)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--mantine-color-violet-4)';
                                e.currentTarget.style.backgroundColor =
                                  'var(--mantine-color-violet-0)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--mantine-color-gray-3)';
                                e.currentTarget.style.backgroundColor = 'white';
                              }}
                            >
                              <Group justify="space-between" wrap="nowrap">
                                <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                  <ThemeIcon size="lg" variant="light" color="violet" radius="lg">
                                    <IconBrain size={18} />
                                  </ThemeIcon>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <Text size="sm" fw={500} lineClamp={1}>
                                      {conv.preview || 'AI Konuşması'}
                                    </Text>
                                    <Group gap="xs" mt={4}>
                                      <Badge size="xs" variant="light" color="gray">
                                        {conv.message_count} mesaj
                                      </Badge>
                                      <Text size="xs" c="dimmed">
                                        {new Date(conv.last_message_at).toLocaleDateString(
                                          'tr-TR',
                                          {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          }
                                        )}
                                      </Text>
                                    </Group>
                                  </div>
                                </Group>
                                <Group gap={4}>
                                  <Tooltip label="Sil">
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteDilekceConversation(conv.session_id);
                                      }}
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <ActionIcon variant="subtle" color="violet">
                                    <IconChevronRight size={16} />
                                  </ActionIcon>
                                </Group>
                              </Group>
                            </Paper>
                          ))}
                        </>
                      )}

                      {/* Boş durum */}
                      {dilekceConversations.length === 0 &&
                        savedDilekces.filter((d) => d.dilekce_type === dilekceType).length ===
                          0 && (
                          <Paper p="xl" radius="md" className="nested-card">
                            <Stack align="center" gap="md">
                              <ThemeIcon
                                size={60}
                                variant="light"
                                color={
                                  dilekceType === 'asiri_dusuk'
                                    ? 'orange'
                                    : dilekceType === 'idare_sikayet'
                                      ? 'red'
                                      : dilekceType === 'kik_itiraz'
                                        ? 'violet'
                                        : 'teal'
                                }
                                radius="xl"
                              >
                                <IconBrain size={30} />
                              </ThemeIcon>
                              <Text fw={600}>Henüz dilekçe yok</Text>
                              <Text size="sm" c="dimmed" ta="center" maw={300}>
                                Bu türde henüz dilekçe oluşturmadınız. AI asistan ile yeni bir
                                dilekçe oluşturmak için başlayın.
                              </Text>
                              <Button
                                variant="light"
                                color="violet"
                                leftSection={<IconPlus size={16} />}
                                onClick={startNewDilekceConversation}
                              >
                                İlk Dilekçeyi Oluştur
                              </Button>
                            </Stack>
                          </Paper>
                        )}
                    </Stack>
                  </ScrollArea>
                </Stack>
              ) : (
                /* STATE 3: Düzenlenebilir Önizleme (Ana Görünüm) */
                <Stack gap="md" style={{ flex: 1, overflow: 'hidden' }}>
                  {/* Header */}
                  <Group justify="space-between">
                    <Group gap="sm">
                      <ActionIcon variant="subtle" color="gray" onClick={backToDilekceList}>
                        <IconArrowLeft size={18} />
                      </ActionIcon>
                      <ThemeIcon
                        size="md"
                        variant="light"
                        radius="lg"
                        color={
                          dilekceType === 'asiri_dusuk'
                            ? 'orange'
                            : dilekceType === 'idare_sikayet'
                              ? 'red'
                              : dilekceType === 'kik_itiraz'
                                ? 'violet'
                                : 'teal'
                        }
                      >
                        {dilekceType === 'asiri_dusuk' && <IconFileAnalytics size={18} />}
                        {dilekceType === 'idare_sikayet' && <IconGavel size={18} />}
                        {dilekceType === 'kik_itiraz' && <IconScale size={18} />}
                        {dilekceType === 'aciklama_cevabi' && <IconNote size={18} />}
                      </ThemeIcon>
                      <div>
                        <Text fw={600} size="sm">
                          {dilekceTypeLabels[dilekceType || '']}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {dilekceMessages.length} mesaj
                        </Text>
                      </div>
                    </Group>
                    <Group gap="xs">
                      <Button
                        variant={showChatHistory ? 'filled' : 'light'}
                        color="violet"
                        size="xs"
                        leftSection={<IconMessageCircle size={14} />}
                        onClick={() => setShowChatHistory(!showChatHistory)}
                      >
                        {showChatHistory ? 'Sohbeti Gizle' : 'Sohbeti Gör'}
                      </Button>
                      {dilekceContent && (
                        <>
                          <Tooltip label={isDilekceEditing ? 'Düzenlemeyi Bitir' : 'Düzenle'}>
                            <ActionIcon
                              variant={isDilekceEditing ? 'filled' : 'light'}
                              color="orange"
                              size="md"
                              onClick={() => setIsDilekceEditing(!isDilekceEditing)}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Kaydet">
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="md"
                              onClick={saveDilekce}
                              loading={dilekceSaving}
                            >
                              <IconDeviceFloppy size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Kopyala">
                            <ActionIcon
                              variant="light"
                              color="gray"
                              size="md"
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
                          <Tooltip label="Word">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="md"
                              onClick={() => downloadDilekce('docx')}
                            >
                              <IconDownload size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="PDF">
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="md"
                              onClick={() => downloadDilekce('pdf')}
                            >
                              <IconDownload size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                  </Group>

                  {/* Sohbet Geçmişi - Collapsible */}
                  <Collapse in={showChatHistory}>
                    <Paper p="md" radius="md" className="nested-card" mah={250}>
                      <ScrollArea h={200} offsetScrollbars>
                        <Stack gap="sm">
                          {dilekceMessages.length === 0 ? (
                            <Text size="sm" c="dimmed" ta="center">
                              Henüz mesaj yok
                            </Text>
                          ) : (
                            dilekceMessages.map((msg) => (
                              <Group
                                key={msg.id}
                                align="flex-start"
                                gap="xs"
                                style={{
                                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                }}
                              >
                                <ThemeIcon
                                  size={24}
                                  radius="xl"
                                  variant={msg.role === 'user' ? 'filled' : 'gradient'}
                                  color={msg.role === 'user' ? 'blue' : undefined}
                                  gradient={
                                    msg.role === 'assistant'
                                      ? { from: 'violet', to: 'grape' }
                                      : undefined
                                  }
                                >
                                  {msg.role === 'user' ? (
                                    <Text size="xs" fw={600}>
                                      S
                                    </Text>
                                  ) : (
                                    <IconBrain size={12} />
                                  )}
                                </ThemeIcon>
                                <Paper
                                  p="xs"
                                  radius="md"
                                  maw="80%"
                                  bg={msg.role === 'user' ? 'blue.6' : 'white'}
                                >
                                  <Text
                                    size="xs"
                                    c={msg.role === 'user' ? 'white' : undefined}
                                    lineClamp={3}
                                  >
                                    {stripContextFromMessage(msg.content)}
                                  </Text>
                                </Paper>
                              </Group>
                            ))
                          )}
                        </Stack>
                      </ScrollArea>
                      {/* Sohbet Input */}
                      <Group
                        gap="xs"
                        mt="sm"
                        pt="sm"
                        style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
                      >
                        <Textarea
                          placeholder="Değişiklik isteği yazın..."
                          value={dilekceInput}
                          onChange={(e) => setDilekceInput(e.currentTarget.value)}
                          style={{ flex: 1 }}
                          minRows={1}
                          maxRows={2}
                          autosize
                          size="xs"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleDilekceChat(dilekceInput);
                            }
                          }}
                        />
                        <Button
                          variant="gradient"
                          gradient={{ from: 'violet', to: 'grape' }}
                          size="xs"
                          loading={dilekceLoading}
                          onClick={() => handleDilekceChat(dilekceInput)}
                        >
                          Gönder
                        </Button>
                      </Group>
                    </Paper>
                  </Collapse>

                  {/* Ana İçerik: Dilekçe Önizleme/Düzenleme veya Boş Durum */}
                  {dilekceContent ? (
                    <Paper
                      p="md"
                      withBorder
                      radius="md"
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        background:
                          'linear-gradient(180deg, rgba(34, 197, 94, 0.02) 0%, white 100%)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Content - Düzenlenebilir veya Önizleme */}
                      {isDilekceEditing ? (
                        <Textarea
                          value={dilekceContent}
                          onChange={(e) => setDilekceContent(e.currentTarget.value)}
                          style={{ flex: 1 }}
                          minRows={20}
                          styles={{
                            root: { flex: 1, display: 'flex', flexDirection: 'column' },
                            wrapper: { flex: 1 },
                            input: {
                              flex: 1,
                              fontSize: 13,
                              fontFamily: 'inherit',
                              lineHeight: 1.7,
                              whiteSpace: 'pre-wrap',
                              minHeight: '100%',
                            },
                          }}
                        />
                      ) : (
                        <ScrollArea
                          type="scroll"
                          style={{ flex: 1, height: '100%' }}
                          offsetScrollbars
                        >
                          <Text
                            size="sm"
                            style={{
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'inherit',
                              lineHeight: 1.7,
                              paddingBottom: 16,
                            }}
                          >
                            {dilekceContent}
                          </Text>
                        </ScrollArea>
                      )}

                      {/* Referanslar */}
                      <Box
                        mt="md"
                        pt="sm"
                        style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
                      >
                        <Group justify="space-between">
                          <Group gap="xs">
                            <Badge size="xs" variant="light" color="blue">
                              4734 Kanun
                            </Badge>
                            <Badge size="xs" variant="light" color="violet">
                              KİK
                            </Badge>
                            {dilekceType === 'asiri_dusuk' && (
                              <Badge size="xs" variant="light" color="orange">
                                EK-H.4
                              </Badge>
                            )}
                          </Group>
                          {dilekceLoading && (
                            <Badge
                              size="xs"
                              variant="light"
                              color="blue"
                              leftSection={<Loader size={10} />}
                            >
                              Güncelleniyor...
                            </Badge>
                          )}
                        </Group>
                      </Box>
                    </Paper>
                  ) : (
                    /* Henüz dilekçe oluşturulmadı */
                    <Paper p="xl" withBorder radius="md" style={{ flex: 1 }}>
                      <Stack align="center" justify="center" h="100%" gap="lg">
                        <ThemeIcon
                          size={80}
                          variant="light"
                          color={
                            dilekceType === 'asiri_dusuk'
                              ? 'orange'
                              : dilekceType === 'idare_sikayet'
                                ? 'red'
                                : dilekceType === 'kik_itiraz'
                                  ? 'violet'
                                  : 'teal'
                          }
                          radius="xl"
                        >
                          <IconBulb size={40} />
                        </ThemeIcon>
                        <div style={{ textAlign: 'center' }}>
                          <Text fw={600} size="lg">
                            {dilekceTypeLabels[dilekceType || '']}
                          </Text>
                          <Text size="sm" c="dimmed" mt="xs">
                            AI ile dilekçe oluşturmak için aşağıdaki butona tıklayın
                          </Text>
                        </div>
                        <Button
                          variant="gradient"
                          gradient={{ from: 'violet', to: 'grape' }}
                          size="lg"
                          leftSection={<IconBrain size={20} />}
                          loading={dilekceLoading}
                          onClick={() => handleDilekceChat()}
                        >
                          Dilekçe Oluştur
                        </Button>
                      </Stack>
                    </Paper>
                  )}
                </Stack>
              )}
            </Paper>
          </Box>
        </Tabs.Panel>
      </Tabs>

      {/* ========== ÇALIŞMA PANOSU MODAL ========== */}
      <ClipboardModal clipboard={clipboard} />

      {/* Teklif Cetveli Modal */}
      <TeklifModal
        opened={teklifModalOpened}
        onClose={() => setTeklifModalOpened(false)}
        ihaleBasligi={tender?.ihale_basligi || 'İsimsiz İhale'}
        ihaleBedeli={
          tender?.bedel
            ? parseFloat(tender.bedel.replace(/[^\d,]/g, '').replace(',', '.'))
            : undefined
        }
        ihaleId={tender?.tender_id}
        birimFiyatlar={analysisData?.birim_fiyatlar?.map((bf) => ({
          kalem: bf.kalem || '',
          birim: bf.birim || 'adet',
          miktar: Number(bf.miktar) || 0,
        }))}
      />
    </Modal>
  );
}
