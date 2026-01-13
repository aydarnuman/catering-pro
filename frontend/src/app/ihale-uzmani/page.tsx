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
  Stepper,
} from '@mantine/core';
// Date inputs now use native HTML date type
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
  IconArrowLeft,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconBookmark,
  IconHistory,
  IconSparkles,
  IconFileAnalytics,
  IconReportMoney,
  IconPlus,
  IconTrash,
  IconEdit,
  IconHandStop,
  IconListCheck,
  IconForms,
  IconTools,
  IconMathFunction,
  IconBuilding,
  IconUser,
  IconSettings,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { Modal } from '@mantine/core';
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

// Firma bilgileri interface (Database)
interface FirmaBilgileri {
  id: number;
  unvan: string;
  kisa_ad?: string;
  vergi_dairesi: string;
  vergi_no: string;
  ticaret_sicil_no?: string;
  mersis_no?: string;
  adres: string;
  il?: string;
  ilce?: string;
  telefon: string;
  email: string;
  yetkili_adi: string;
  yetkili_unvani: string;
  yetkili_tc?: string;
  imza_yetkisi: string;
  banka_adi?: string;
  iban?: string;
  varsayilan: boolean;
  aktif: boolean;
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

// Manuel ihale interface
interface ManuelIhale {
  id: string;
  ihale_basligi: string;
  kurum: string;
  yaklasik_maliyet: number;
  sinir_deger: number;
  bizim_teklif: number;
  kesinlesme_tarihi: string;
  durum: 'beklemede' | 'asiri_dusuk' | 'kazandik' | 'elendik';
  notlar?: string;
  created_at: string;
  isManuel: true;
  // Sınır değer hesaplama için ek veriler
  diger_teklifler?: number[];
  verilerTamam?: boolean;
}


export default function IhaleUzmaniPage() {
  const { colorScheme } = useMantineColorScheme();
  const [savedTenders, setSavedTenders] = useState<SavedTender[]>([]);
  const [manuelIhaleler, setManuelIhaleler] = useState<ManuelIhale[]>([]);
  const [selectedTender, setSelectedTender] = useState<SavedTender | ManuelIhale | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('hesaplamalar');
  
  // 3 Aşamalı wizard step state
  const [currentStep, setCurrentStep] = useState(0); // 0: İhale Seç, 1: Veriler, 2: Araçlar
  
  // Sınır değer hesaplama state
  const [teklifListesi, setTeklifListesi] = useState<number[]>([0, 0]); // dinamik teklif listesi
  const [hesaplananSinirDeger, setHesaplananSinirDeger] = useState<number | null>(null);
  const [sinirDegerModalOpened, { open: openSinirDegerModal, close: closeSinirDegerModal }] = useDisclosure(false);
  
  // Manuel ihale modal
  const [manuelModalOpened, { open: openManuelModal, close: closeManuelModal }] = useDisclosure(false);
  const [manuelFormData, setManuelFormData] = useState({
    ihale_basligi: '',
    kurum: '',
    yaklasik_maliyet: 0,
    sinir_deger: 0,
    bizim_teklif: 0,
    kesinlesme_tarihi: null as Date | null,
    durum: 'beklemede' as 'beklemede' | 'asiri_dusuk' | 'kazandik' | 'elendik',
    notlar: '',
  });
  const [editingManuelId, setEditingManuelId] = useState<string | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Firma bilgileri state - Database'den çekiliyor
  const [firmalar, setFirmalar] = useState<FirmaBilgileri[]>([]);
  const [seciliFirmaId, setSeciliFirmaId] = useState<number | null>(null);
  const [firmaPanelOpen, setFirmaPanelOpen] = useState(false);
  const [firmaLoading, setFirmaLoading] = useState(false);
  
  // Seçili firma objesi
  const seciliFirma = firmalar.find(f => f.id === seciliFirmaId) || firmalar.find(f => f.varsayilan) || null;

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
    
    // Load manuel ihaleler
    const manuelSaved = localStorage.getItem('manuelIhaleler');
    if (manuelSaved) {
      try {
        const manuel = JSON.parse(manuelSaved);
        setManuelIhaleler(manuel);
      } catch (e) {
        console.error('Failed to parse manuel ihaleler:', e);
      }
    }
    
    // Load firmalar from database
    fetchFirmalar();
  }, []);

  // Firmaları API'den yükle
  const fetchFirmalar = async () => {
    try {
      setFirmaLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/firmalar`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const firmalarData = data.data || [];
        setFirmalar(firmalarData);
        // Varsayılan firmayı seç
        const varsayilan = firmalarData.find((f: FirmaBilgileri) => f.varsayilan);
        if (varsayilan) {
          setSeciliFirmaId(varsayilan.id);
        } else if (firmalarData.length > 0) {
          setSeciliFirmaId(firmalarData[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch firmalar:', e);
    } finally {
      setFirmaLoading(false);
    }
  };

  // Manuel ihale kaydetme
  const saveManuelIhale = useCallback(() => {
    if (!manuelFormData.ihale_basligi || !manuelFormData.kurum) {
      notifications.show({
        title: 'Hata',
        message: 'İhale başlığı ve kurum zorunludur',
        color: 'red',
      });
      return;
    }

    const newIhale: ManuelIhale = {
      id: editingManuelId || `manuel_${Date.now()}`,
      ihale_basligi: manuelFormData.ihale_basligi,
      kurum: manuelFormData.kurum,
      yaklasik_maliyet: manuelFormData.yaklasik_maliyet,
      sinir_deger: manuelFormData.sinir_deger,
      bizim_teklif: manuelFormData.bizim_teklif,
      kesinlesme_tarihi: manuelFormData.kesinlesme_tarihi?.toISOString().split('T')[0] || '',
      durum: manuelFormData.durum,
      notlar: manuelFormData.notlar,
      created_at: new Date().toISOString(),
      isManuel: true,
    };

    let updatedList: ManuelIhale[];
    if (editingManuelId) {
      updatedList = manuelIhaleler.map(m => m.id === editingManuelId ? newIhale : m);
    } else {
      updatedList = [...manuelIhaleler, newIhale];
    }

    setManuelIhaleler(updatedList);
    localStorage.setItem('manuelIhaleler', JSON.stringify(updatedList));
    
    notifications.show({
      title: editingManuelId ? 'Güncellendi' : 'Eklendi',
      message: `${newIhale.ihale_basligi} ${editingManuelId ? 'güncellendi' : 'eklendi'}`,
      color: 'green',
    });

    // Reset form
    setManuelFormData({
      ihale_basligi: '',
      kurum: '',
      yaklasik_maliyet: 0,
      sinir_deger: 0,
      bizim_teklif: 0,
      kesinlesme_tarihi: null,
      durum: 'beklemede',
      notlar: '',
    });
    setEditingManuelId(null);
    closeManuelModal();
  }, [manuelFormData, manuelIhaleler, editingManuelId, closeManuelModal]);

  // Manuel ihale düzenleme
  const editManuelIhale = useCallback((ihale: ManuelIhale) => {
    setManuelFormData({
      ihale_basligi: ihale.ihale_basligi,
      kurum: ihale.kurum,
      yaklasik_maliyet: ihale.yaklasik_maliyet,
      sinir_deger: ihale.sinir_deger,
      bizim_teklif: ihale.bizim_teklif,
      kesinlesme_tarihi: ihale.kesinlesme_tarihi ? new Date(ihale.kesinlesme_tarihi) : null,
      durum: ihale.durum,
      notlar: ihale.notlar || '',
    });
    setEditingManuelId(ihale.id);
    openManuelModal();
  }, [openManuelModal]);

  // Manuel ihale silme
  const deleteManuelIhale = useCallback((id: string) => {
    const updatedList = manuelIhaleler.filter(m => m.id !== id);
    setManuelIhaleler(updatedList);
    localStorage.setItem('manuelIhaleler', JSON.stringify(updatedList));
    if (selectedTender && 'isManuel' in selectedTender && selectedTender.id === id) {
      setSelectedTender(null);
    }
    notifications.show({
      title: 'Silindi',
      message: 'Manuel ihale silindi',
      color: 'orange',
    });
  }, [manuelIhaleler, selectedTender]);

  // Seçili ihaleden form verilerini doldur
  const fillFromSelectedTender = useCallback(() => {
    if (!selectedTender) return;
    
    if ('isManuel' in selectedTender) {
      // Manuel ihale
      setAsiriDusukData({
        anaGirdi: 0,
        iscilik: 0,
        toplamTeklif: selectedTender.bizim_teklif,
      });
      setBedelData({
        yaklasikMaliyet: selectedTender.yaklasik_maliyet,
      });
      if (selectedTender.kesinlesme_tarihi) {
        setSureData(prev => ({
          ...prev,
          tebligTarihi: new Date(selectedTender.kesinlesme_tarihi),
        }));
      }
    }
  }, [selectedTender]);

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

  // Sınır değer hesaplama fonksiyonu (KİK formülü)
  const hesaplaSinirDeger = useCallback((yaklasikMaliyet: number, teklifler: number[]) => {
    if (yaklasikMaliyet <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Yaklaşık maliyet giriniz',
        color: 'red',
      });
      return null;
    }

    // Geçerli teklifler (0'dan büyük)
    const gecerliTeklifler = teklifler.filter(t => t > 0);
    const n = gecerliTeklifler.length;
    
    if (n < 2) {
      notifications.show({
        title: 'Hata',
        message: 'En az 2 geçerli teklif gerekli',
        color: 'red',
      });
      return null;
    }

    // 1. Aritmetik ortalama (Tort1)
    const toplam = gecerliTeklifler.reduce((a, b) => a + b, 0);
    const Tort1 = toplam / n;

    // 2. Standart sapma
    const varyans = gecerliTeklifler.reduce((acc, t) => acc + Math.pow(t - Tort1, 2), 0) / (n - 1);
    const stdSapma = Math.sqrt(varyans);

    // 3. Tort2: (Tort1 - σ) ile (Tort1 + σ) arasındaki tekliflerin ortalaması
    const altSinir = Tort1 - stdSapma;
    const ustSinir = Tort1 + stdSapma;
    const aralikTeklifler = gecerliTeklifler.filter(t => t >= altSinir && t <= ustSinir);
    
    let Tort2 = Tort1; // Default
    if (aralikTeklifler.length > 0) {
      Tort2 = aralikTeklifler.reduce((a, b) => a + b, 0) / aralikTeklifler.length;
    }

    // 4. C değeri
    const C = Tort2 / yaklasikMaliyet;

    // 5. K değeri
    let K: number;
    if (C < 0.60) {
      K = C;
    } else if (C <= 1.00) {
      K = (3.2 * C - C * C - 0.6) / (C + 1);
    } else {
      K = 1;
    }

    // 6. Sınır Değer = K × Tort2 (Hizmet alımı için N=1.00)
    const sinirDeger = (K * Tort2);

    setHesaplananSinirDeger(sinirDeger);
    
    return sinirDeger;
  }, []);

  // Teklif ekleme/silme
  const addTeklif = useCallback(() => {
    setTeklifListesi(prev => [...prev, 0]);
  }, []);

  const removeTeklif = useCallback((index: number) => {
    setTeklifListesi(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateTeklif = useCallback((index: number, value: number) => {
    setTeklifListesi(prev => prev.map((t, i) => i === index ? value : t));
  }, []);

  // İhale seçildiğinde step kontrolü
  useEffect(() => {
    if (selectedTender) {
      // Manuel ihale ve veriler tamam mı kontrol et
      if ('isManuel' in selectedTender) {
        const { yaklasik_maliyet, sinir_deger, bizim_teklif, kesinlesme_tarihi } = selectedTender;
        if (yaklasik_maliyet > 0 && sinir_deger > 0 && bizim_teklif > 0 && kesinlesme_tarihi) {
          setCurrentStep(2); // Araçlara geç
        } else {
          setCurrentStep(1); // Veri girişine geç
        }
      } else {
        // Tracking'den gelen ihale - direkt araçlara
        setCurrentStep(2);
      }
    } else {
      setCurrentStep(0);
    }
  }, [selectedTender]);

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
      // Build context with seçili firma bilgileri
      let firmaContext = '';
      if (seciliFirma) {
        firmaContext = `
Kullanıcının Firma Bilgileri (dilekçe ve resmi yazışmalarda kullan):
- Firma Ünvanı: ${seciliFirma.unvan}
${seciliFirma.vergi_dairesi ? `- Vergi Dairesi: ${seciliFirma.vergi_dairesi}` : ''}
${seciliFirma.vergi_no ? `- Vergi No: ${seciliFirma.vergi_no}` : ''}
${seciliFirma.adres ? `- Adres: ${seciliFirma.adres}` : ''}
${seciliFirma.telefon ? `- Telefon: ${seciliFirma.telefon}` : ''}
${seciliFirma.email ? `- E-posta: ${seciliFirma.email}` : ''}
${seciliFirma.yetkili_adi ? `- Yetkili: ${seciliFirma.yetkili_adi}` : ''}
${seciliFirma.yetkili_unvani ? `- Yetkili Unvanı: ${seciliFirma.yetkili_unvani}` : ''}
${seciliFirma.imza_yetkisi ? `- İmza Yetkisi: ${seciliFirma.imza_yetkisi}` : ''}

`;
      }
      
      // Build context with selected tender info
      let context = firmaContext;
      if (selectedTender) {
        if ('isManuel' in selectedTender) {
          // Manuel ihale context
          context += `
Kullanıcının seçili ihalesi (manuel eklenen):
- Başlık: ${selectedTender.ihale_basligi}
- Kurum: ${selectedTender.kurum}
- Durum: ${selectedTender.durum === 'asiri_dusuk' ? 'Aşırı Düşük Teklif' : selectedTender.durum === 'kazandik' ? 'Kazandık' : selectedTender.durum === 'elendik' ? 'Elendik' : 'Beklemede'}
${selectedTender.yaklasik_maliyet > 0 ? `- Yaklaşık Maliyet: ${selectedTender.yaklasik_maliyet.toLocaleString('tr-TR')} TL` : ''}
${selectedTender.sinir_deger > 0 ? `- Sınır Değer: ${selectedTender.sinir_deger.toLocaleString('tr-TR')} TL` : ''}
${selectedTender.bizim_teklif > 0 ? `- Bizim Teklifimiz: ${selectedTender.bizim_teklif.toLocaleString('tr-TR')} TL` : ''}
${selectedTender.kesinlesme_tarihi ? `- Kesinleşme Tarihi: ${selectedTender.kesinlesme_tarihi}` : ''}
${selectedTender.notlar ? `- Notlar: ${selectedTender.notlar}` : ''}

Bu ihale bağlamında cevap ver.

`;
        } else {
          // Tracking'den gelen ihale context
          context += `
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
          <Group gap="sm">
            {firmaLoading ? (
              <Loader size="sm" />
            ) : firmalar.length > 0 ? (
              <Select
                placeholder="Firma seçin"
                data={firmalar.map(f => ({ value: String(f.id), label: f.unvan }))}
                value={seciliFirmaId ? String(seciliFirmaId) : null}
                onChange={(val) => setSeciliFirmaId(val ? Number(val) : null)}
                leftSection={<IconBuilding size={18} />}
                style={{ minWidth: 200 }}
                comboboxProps={{ withinPortal: true }}
              />
            ) : (
              <Button
                component={Link}
                href="/ayarlar?section=firma"
                variant="filled"
                color="orange"
                leftSection={<IconBuilding size={18} />}
              >
                Firma Ekle
              </Button>
            )}
            <Tooltip label={seciliFirma ? 'Firma detaylarını göster' : 'Firma bilgisi yok'}>
              <ActionIcon
                variant="light"
                color={seciliFirma ? 'teal' : 'gray'}
                size="lg"
                onClick={() => setFirmaPanelOpen(!firmaPanelOpen)}
                disabled={!seciliFirma}
              >
                <IconInfoCircle size={20} />
              </ActionIcon>
            </Tooltip>
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

      {/* Firma Bilgileri Panel */}
      <Collapse in={firmaPanelOpen && !!seciliFirma}>
        <Paper p="md" mb="lg" radius="md" withBorder style={{ 
          background: colorScheme === 'dark' ? 'rgba(0, 166, 125, 0.05)' : 'rgba(0, 166, 125, 0.03)',
          borderColor: 'var(--mantine-color-teal-4)'
        }}>
          <Group justify="space-between" mb="md">
            <Group gap="sm">
              <ThemeIcon size="md" radius="md" variant="light" color="teal">
                <IconBuilding size={16} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="sm">Seçili Firma: {seciliFirma?.unvan}</Text>
                <Text size="xs" c="dimmed">Bu firma bilgileri AI asistana gönderilir</Text>
              </div>
            </Group>
            <Group gap="xs">
              <Button
                component={Link}
                href="/ayarlar?section=firma"
                variant="light"
                size="xs"
                color="teal"
                leftSection={<IconSettings size={14} />}
              >
                Firmaları Yönet
              </Button>
              <ActionIcon 
                variant="subtle" 
                color="gray" 
                onClick={() => setFirmaPanelOpen(false)}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          </Group>
          
          {seciliFirma && (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
              <Box>
                <Text size="xs" c="dimmed">Firma Ünvanı</Text>
                <Text size="sm" fw={500}>{seciliFirma.unvan}</Text>
              </Box>
              {seciliFirma.vergi_no && (
                <Box>
                  <Text size="xs" c="dimmed">Vergi No</Text>
                  <Text size="sm">{seciliFirma.vergi_no}</Text>
                </Box>
              )}
              {seciliFirma.yetkili_adi && (
                <Box>
                  <Text size="xs" c="dimmed">Yetkili</Text>
                  <Text size="sm">{seciliFirma.yetkili_adi} {seciliFirma.yetkili_unvani && `(${seciliFirma.yetkili_unvani})`}</Text>
                </Box>
              )}
              {seciliFirma.telefon && (
                <Box>
                  <Text size="xs" c="dimmed">İletişim</Text>
                  <Text size="sm">{seciliFirma.telefon}</Text>
                </Box>
              )}
            </SimpleGrid>
          )}
        </Paper>
      </Collapse>

      {/* Stepper */}
      <Paper p="md" mb="lg" radius="md" withBorder>
        <Stepper 
          active={currentStep} 
          onStepClick={(step) => {
            // Sadece tamamlanmış adımlara geri dönülebilir
            if (step < currentStep) {
              setCurrentStep(step);
            } else if (step === 1 && selectedTender) {
              setCurrentStep(1);
            } else if (step === 2 && selectedTender && 'isManuel' in selectedTender) {
              const { yaklasik_maliyet, sinir_deger, bizim_teklif, kesinlesme_tarihi } = selectedTender;
              if (yaklasik_maliyet > 0 && sinir_deger > 0 && bizim_teklif > 0 && kesinlesme_tarihi) {
                setCurrentStep(2);
              }
            }
          }}
          color="violet"
          size="sm"
          completedIcon={<IconCheck size={16} />}
        >
          <Stepper.Step 
            icon={<IconListCheck size={16} />} 
            label="İhale Seç" 
            description="Manuel ekle veya listeden seç"
            loading={!selectedTender && currentStep === 0}
          />
          <Stepper.Step 
            icon={<IconForms size={16} />} 
            label="Verileri Tamamla" 
            description="Yaklaşık maliyet, sınır değer, teklif"
            loading={currentStep === 1}
          />
          <Stepper.Step 
            icon={<IconTools size={16} />} 
            label="Araçlar" 
            description="Hesaplamalar, AI Uzman, Dilekçe"
          />
        </Stepper>
      </Paper>

      {/* STEP 0: İhale Seçimi */}
      {currentStep === 0 && (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper p="md" radius="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="sm">
                  <IconClipboardList size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  İhaleler
                </Text>
                <Group gap="xs">
                  <Badge size="sm" variant="light" color="blue">
                    {savedTenders.length + manuelIhaleler.length}
                  </Badge>
                  <Tooltip label="Manuel İhale Ekle">
                    <ActionIcon 
                      variant="filled" 
                      color="violet" 
                      size="md"
                      onClick={() => {
                        setEditingManuelId(null);
                        setManuelFormData({
                          ihale_basligi: '',
                          kurum: '',
                          yaklasik_maliyet: 0,
                          sinir_deger: 0,
                          bizim_teklif: 0,
                          kesinlesme_tarihi: null,
                          durum: 'beklemede',
                          notlar: '',
                        });
                        openManuelModal();
                      }}
                    >
                      <IconPlus size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <ScrollArea h={400} offsetScrollbars>
                <Stack gap="xs">
                  {manuelIhaleler.length > 0 && (
                    <>
                      <Text size="xs" c="dimmed" fw={500}>
                        <IconHandStop size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Manuel Eklenenler
                      </Text>
                      {manuelIhaleler.map((ihale) => (
                        <Card
                          key={ihale.id}
                          padding="sm"
                          radius="md"
                          withBorder
                          style={{
                            cursor: 'pointer',
                            borderColor: 'var(--mantine-color-orange-3)',
                            borderLeftWidth: 3,
                          }}
                          onClick={() => {
                            setSelectedTender(ihale);
                            setCurrentStep(1);
                          }}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" fw={500} lineClamp={1}>{ihale.ihale_basligi}</Text>
                              <Text size="xs" c="dimmed">{ihale.kurum}</Text>
                            </div>
                            <IconArrowRight size={16} color="gray" />
                          </Group>
                        </Card>
                      ))}
                    </>
                  )}

                  {savedTenders.length > 0 && (
                    <>
                      <Text size="xs" c="dimmed" fw={500} mt="xs">
                        <IconBookmark size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Takip Edilen
                      </Text>
                      {savedTenders.map((tender) => (
                        <Card
                          key={tender.id}
                          padding="sm"
                          radius="md"
                          withBorder
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedTender(tender);
                            setCurrentStep(2); // Tracking'den gelenler direkt araçlara
                          }}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" fw={500} lineClamp={1}>{tender.ihale_basligi}</Text>
                              <Text size="xs" c="dimmed">{tender.kurum?.slice(0, 30)}...</Text>
                            </div>
                            <IconArrowRight size={16} color="gray" />
                          </Group>
                        </Card>
                      ))}
                    </>
                  )}

                  {savedTenders.length === 0 && manuelIhaleler.length === 0 && (
                    <Alert icon={<IconInfoCircle size={18} />} color="violet" variant="light">
                      <Text size="sm">
                        Henüz ihale eklenmemiş.
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </ScrollArea>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper p="xl" radius="md" withBorder h="100%">
              <Center h={400}>
                <Stack align="center" gap="lg">
                  <ThemeIcon size={80} radius="xl" variant="light" color="violet">
                    <IconListCheck size={40} />
                  </ThemeIcon>
                  <div style={{ textAlign: 'center' }}>
                    <Title order={3} mb="xs">İhale Seçin</Title>
                    <Text c="dimmed" size="sm" maw={400}>
                      Sol panelden bir ihale seçin veya{' '}
                      <Text component="span" c="violet" fw={600} style={{ cursor: 'pointer' }} onClick={openManuelModal}>
                        manuel ekle
                      </Text>
                      {' '}butonuyla yeni ihale oluşturun.
                    </Text>
                  </div>
                  <Button 
                    variant="light" 
                    color="violet" 
                    size="lg"
                    leftSection={<IconPlus size={20} />}
                    onClick={openManuelModal}
                  >
                    Manuel İhale Ekle
                  </Button>
                </Stack>
              </Center>
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      {/* STEP 1: Veri Girişi */}
      {currentStep === 1 && selectedTender && 'isManuel' in selectedTender && (
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="lg">
            <div>
              <Group gap="xs" mb={4}>
                <Button 
                  variant="subtle" 
                  color="gray" 
                  size="xs"
                  leftSection={<IconArrowLeft size={14} />}
                  onClick={() => {
                    setSelectedTender(null);
                    setCurrentStep(0);
                  }}
                >
                  Geri
                </Button>
              </Group>
              <Title order={3}>{selectedTender.ihale_basligi}</Title>
              <Text c="dimmed" size="sm">{selectedTender.kurum}</Text>
            </div>
            <Badge color={
              selectedTender.durum === 'asiri_dusuk' ? 'orange' :
              selectedTender.durum === 'kazandik' ? 'green' :
              selectedTender.durum === 'elendik' ? 'red' : 'gray'
            } size="lg">
              {selectedTender.durum === 'asiri_dusuk' ? '⚠️ Aşırı Düşük' :
               selectedTender.durum === 'kazandik' ? '✅ Kazandık' :
               selectedTender.durum === 'elendik' ? '❌ Elendik' : '⏳ Beklemede'}
            </Badge>
          </Group>

          <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light" mb="lg">
            <Text size="sm">
              Hesaplama ve dilekçe araçlarını kullanabilmek için aşağıdaki bilgileri doldurun. 
              Sınır değeri bilmiyorsanız &quot;Sınır Değer Hesapla&quot; butonunu kullanın.
            </Text>
          </Alert>

          <Grid gutter="lg">
            {/* Sol: Ana Veriler */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="md">
                <NumberInput
                  label="Yaklaşık Maliyet (TL)"
                  description="İdarenin belirlediği tahmini tutar"
                  placeholder="0"
                  value={selectedTender.yaklasik_maliyet || ''}
                  onChange={(val) => {
                    const updated = { ...selectedTender, yaklasik_maliyet: Number(val) || 0 };
                    setSelectedTender(updated);
                    const list = manuelIhaleler.map(m => m.id === updated.id ? updated : m);
                    setManuelIhaleler(list);
                    localStorage.setItem('manuelIhaleler', JSON.stringify(list));
                  }}
                  thousandSeparator="."
                  decimalSeparator=","
                  min={0}
                  required
                  size="md"
                  leftSection={<IconCoin size={18} />}
                />

                <NumberInput
                  label="Sınır Değer (TL)"
                  description="Aşırı düşük teklif sınırı"
                  placeholder="0"
                  value={selectedTender.sinir_deger || ''}
                  onChange={(val) => {
                    const updated = { ...selectedTender, sinir_deger: Number(val) || 0 };
                    setSelectedTender(updated);
                    const list = manuelIhaleler.map(m => m.id === updated.id ? updated : m);
                    setManuelIhaleler(list);
                    localStorage.setItem('manuelIhaleler', JSON.stringify(list));
                  }}
                  thousandSeparator="."
                  decimalSeparator=","
                  min={0}
                  required
                  size="md"
                  leftSection={<IconAlertTriangle size={18} />}
                  rightSection={
                    <Tooltip label="Sınır değer hesapla">
                      <ActionIcon 
                        variant="subtle" 
                        color="violet"
                        onClick={() => {
                          // Sınır değer hesaplama modalı aç - basit formülle
                          if (hesaplananSinirDeger) {
                            const updated = { ...selectedTender, sinir_deger: hesaplananSinirDeger };
                            setSelectedTender(updated);
                            const list = manuelIhaleler.map(m => m.id === updated.id ? updated : m);
                            setManuelIhaleler(list);
                            localStorage.setItem('manuelIhaleler', JSON.stringify(list));
                          }
                        }}
                      >
                        <IconMathFunction size={16} />
                      </ActionIcon>
                    </Tooltip>
                  }
                />

                <NumberInput
                  label="Bizim Teklifimiz (TL)"
                  description="Verdiğimiz teklif tutarı"
                  placeholder="0"
                  value={selectedTender.bizim_teklif || ''}
                  onChange={(val) => {
                    const updated = { ...selectedTender, bizim_teklif: Number(val) || 0 };
                    setSelectedTender(updated);
                    const list = manuelIhaleler.map(m => m.id === updated.id ? updated : m);
                    setManuelIhaleler(list);
                    localStorage.setItem('manuelIhaleler', JSON.stringify(list));
                  }}
                  thousandSeparator="."
                  decimalSeparator=","
                  min={0}
                  required
                  size="md"
                  leftSection={<IconReportMoney size={18} />}
                />

                <TextInput
                  label="Kesinleşme Tarihi"
                  description="İtiraz süreleri başlangıcı"
                  type="date"
                  value={selectedTender.kesinlesme_tarihi || ''}
                  onChange={(e) => {
                    const updated = { ...selectedTender, kesinlesme_tarihi: e.target.value };
                    setSelectedTender(updated);
                    const list = manuelIhaleler.map(m => m.id === updated.id ? updated : m);
                    setManuelIhaleler(list);
                    localStorage.setItem('manuelIhaleler', JSON.stringify(list));
                  }}
                  required
                  size="md"
                  leftSection={<IconCalendar size={18} />}
                />

                <Select
                  label="Durum"
                  value={selectedTender.durum}
                  onChange={(val) => {
                    const updated = { ...selectedTender, durum: val as any || 'beklemede' };
                    setSelectedTender(updated);
                    const list = manuelIhaleler.map(m => m.id === updated.id ? updated : m);
                    setManuelIhaleler(list);
                    localStorage.setItem('manuelIhaleler', JSON.stringify(list));
                  }}
                  data={[
                    { value: 'beklemede', label: '⏳ Beklemede' },
                    { value: 'asiri_dusuk', label: '⚠️ Aşırı Düşük Teklif' },
                    { value: 'kazandik', label: '✅ Kazandık' },
                    { value: 'elendik', label: '❌ Elendik' },
                  ]}
                  size="md"
                />
              </Stack>
            </Grid.Col>

            {/* Sağ: Sınır Değer Hesaplama */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper p="md" radius="md" withBorder style={{ background: colorScheme === 'dark' ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.03)' }}>
                <Group gap="xs" mb="md">
                  <ThemeIcon size="md" radius="md" variant="light" color="violet">
                    <IconMathFunction size={16} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">Sınır Değer Hesaplama</Text>
                </Group>
                
                <Text size="xs" c="dimmed" mb="md">
                  Sınır değeri bilmiyorsanız, diğer teklifleri girerek KİK formülüyle hesaplayabilirsiniz.
                </Text>

                <Button 
                  fullWidth 
                  variant="light"
                  color="violet"
                  size="lg"
                  onClick={() => {
                    setTeklifListesi([0, 0]);
                    setHesaplananSinirDeger(null);
                    openSinirDegerModal();
                  }}
                  leftSection={<IconMathFunction size={20} />}
                  disabled={!selectedTender.yaklasik_maliyet}
                >
                  Sınır Değer Hesaplama Aracını Aç
                </Button>

                {selectedTender.sinir_deger > 0 && (
                  <Alert mt="md" color="green" icon={<IconCheck size={16} />}>
                    <Text size="sm" fw={600}>
                      Mevcut Sınır Değer: {selectedTender.sinir_deger.toLocaleString('tr-TR')} TL
                    </Text>
                  </Alert>
                )}

                <Divider my="md" />

                <Text size="xs" c="dimmed">
                  <strong>Formül:</strong> KİK Tebliği gereği hizmet alımları için standart sapma yöntemi kullanılır (N=1.00).
                </Text>
              </Paper>
            </Grid.Col>
          </Grid>

          {/* İlerleme Butonu */}
          <Group justify="flex-end" mt="xl">
            <Button
              size="lg"
              color="violet"
              rightSection={<IconArrowRight size={18} />}
              disabled={
                !selectedTender.yaklasik_maliyet || 
                !selectedTender.sinir_deger || 
                !selectedTender.bizim_teklif || 
                !selectedTender.kesinlesme_tarihi
              }
              onClick={() => {
                // Verileri kaydet
                const list = manuelIhaleler.map(m => m.id === selectedTender.id ? selectedTender : m);
                setManuelIhaleler(list);
                localStorage.setItem('manuelIhaleler', JSON.stringify(list));
                setCurrentStep(2);
                notifications.show({
                  title: 'Veriler Kaydedildi',
                  message: 'Şimdi hesaplama ve AI araçlarını kullanabilirsiniz.',
                  color: 'green',
                });
              }}
            >
              Araçlara Geç
            </Button>
          </Group>
        </Paper>
      )}

      {/* STEP 2: Araçlar */}
      {currentStep === 2 && selectedTender && (
        <Grid gutter="lg">
        {/* Left Panel - Seçili İhale Özeti */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" radius="md" withBorder>
            {/* Geri ve Değiştir Butonları */}
            <Group justify="space-between" mb="md">
              <Button 
                variant="subtle" 
                color="gray" 
                size="xs"
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => {
                  setSelectedTender(null);
                  setCurrentStep(0);
                }}
              >
                Başka İhale Seç
              </Button>
              {'isManuel' in selectedTender && (
                <ActionIcon 
                  variant="light" 
                  color="blue" 
                  size="sm"
                  onClick={() => setCurrentStep(1)}
                >
                  <IconEdit size={14} />
                </ActionIcon>
              )}
            </Group>

            {/* İhale Başlığı */}
            <Text fw={600} size="lg" mb="xs">{selectedTender.ihale_basligi}</Text>
            <Text c="dimmed" size="sm" mb="md">{selectedTender.kurum}</Text>

            {'isManuel' in selectedTender && (
              <Badge 
                size="lg" 
                mb="md"
                color={
                  selectedTender.durum === 'asiri_dusuk' ? 'orange' :
                  selectedTender.durum === 'kazandik' ? 'green' :
                  selectedTender.durum === 'elendik' ? 'red' : 'gray'
                }
              >
                {selectedTender.durum === 'asiri_dusuk' ? '⚠️ Aşırı Düşük' :
                 selectedTender.durum === 'kazandik' ? '✅ Kazandık' :
                 selectedTender.durum === 'elendik' ? '❌ Elendik' : '⏳ Beklemede'}
              </Badge>
            )}

            <Divider my="md" />

            {/* Özet Bilgiler */}
            {'isManuel' in selectedTender ? (
              <Stack gap="sm">
                <SimpleGrid cols={2} spacing="sm">
                  <Paper p="sm" radius="sm" withBorder>
                    <Text size="xs" c="dimmed">Yaklaşık Maliyet</Text>
                    <Text size="sm" fw={600} c="blue">
                      {selectedTender.yaklasik_maliyet > 0 
                        ? `${selectedTender.yaklasik_maliyet.toLocaleString('tr-TR')} ₺` 
                        : '-'}
                    </Text>
                  </Paper>
                  <Paper p="sm" radius="sm" withBorder>
                    <Text size="xs" c="dimmed">Sınır Değer</Text>
                    <Text size="sm" fw={600} c="orange">
                      {selectedTender.sinir_deger > 0 
                        ? `${selectedTender.sinir_deger.toLocaleString('tr-TR')} ₺` 
                        : '-'}
                    </Text>
                  </Paper>
                  <Paper p="sm" radius="sm" withBorder>
                    <Text size="xs" c="dimmed">Bizim Teklif</Text>
                    <Text size="sm" fw={600} c="green">
                      {selectedTender.bizim_teklif > 0 
                        ? `${selectedTender.bizim_teklif.toLocaleString('tr-TR')} ₺` 
                        : '-'}
                    </Text>
                  </Paper>
                  <Paper p="sm" radius="sm" withBorder>
                    <Text size="xs" c="dimmed">Kesinleşme</Text>
                    <Text size="sm" fw={600}>
                      {selectedTender.kesinlesme_tarihi || '-'}
                    </Text>
                  </Paper>
                </SimpleGrid>
                
                {/* Aşırı Düşük Durumu Özet */}
                {selectedTender.sinir_deger > 0 && selectedTender.bizim_teklif > 0 && (
                  <Alert 
                    color={selectedTender.bizim_teklif < selectedTender.sinir_deger ? 'orange' : 'green'} 
                    variant="light"
                    icon={selectedTender.bizim_teklif < selectedTender.sinir_deger ? <IconAlertTriangle size={18} /> : <IconCheck size={18} />}
                  >
                    <Text size="sm">
                      {selectedTender.bizim_teklif < selectedTender.sinir_deger 
                        ? `Teklifiniz sınır değerin ${((1 - selectedTender.bizim_teklif / selectedTender.sinir_deger) * 100).toFixed(1)}% altında - Açıklama gerekli!`
                        : 'Teklifiniz sınır değerin üzerinde - Açıklama gerekmez.'}
                    </Text>
                  </Alert>
                )}
              </Stack>
            ) : (
              // Tracking'den gelen ihale
              <SimpleGrid cols={2} spacing="sm">
                <Paper p="sm" radius="sm" withBorder>
                  <Text size="xs" c="dimmed">Bedel</Text>
                  <Text size="sm" fw={600}>{selectedTender.bedel}</Text>
                </Paper>
                <Paper p="sm" radius="sm" withBorder>
                  <Text size="xs" c="dimmed">Tarih</Text>
                  <Text size="sm" fw={600}>{selectedTender.tarih}</Text>
                </Paper>
                <Paper p="sm" radius="sm" withBorder>
                  <Text size="xs" c="dimmed">Süre</Text>
                  <Text size="sm" fw={600}>{selectedTender.sure}</Text>
                </Paper>
                {selectedTender.ihale_kayit_no && (
                  <Paper p="sm" radius="sm" withBorder>
                    <Text size="xs" c="dimmed">Kayıt No</Text>
                    <Text size="sm" fw={600}>{selectedTender.ihale_kayit_no}</Text>
                  </Paper>
                )}
              </SimpleGrid>
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
                        <TextInput
                          label="Tebliğ Tarihi"
                          type="date"
                          value={sureData.tebligTarihi ? sureData.tebligTarihi.toISOString().split('T')[0] : ''}
                          onChange={(e) => setSureData(prev => ({ 
                            ...prev, 
                            tebligTarihi: e.target.value ? new Date(e.target.value) : null 
                          }))}
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
                    style={{ height: 500, display: 'flex', flexDirection: 'column' }}
                  >
                    <ScrollArea style={{ flex: 1 }} offsetScrollbars type="always" scrollbarSize={8}>
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
                    <Box mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)', flexShrink: 0 }}>
                      <Group gap="xs">
                        <Textarea
                          placeholder={selectedTender ? `"${selectedTender.ihale_basligi}" hakkında soru sorun...` : 'İhale uzmanına soru sorun...'}
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
      )}

      {/* Manuel İhale Ekleme Modal */}
      <Modal
        opened={manuelModalOpened}
        onClose={closeManuelModal}
        title={
          <Group gap="sm">
            <ThemeIcon size="md" radius="md" variant="light" color="violet">
              {editingManuelId ? <IconEdit size={16} /> : <IconPlus size={16} />}
            </ThemeIcon>
            <Text fw={600}>{editingManuelId ? 'İhale Düzenle' : 'Manuel İhale Ekle'}</Text>
          </Group>
        }
        size="lg"
        centered
      >
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            <Text size="xs">
              İhale açıklandıktan sonra görünen bilgileri girin. Bu veriler hesaplama ve dilekçe oluşturmada kullanılacak.
            </Text>
          </Alert>

          <TextInput
            label="İhale Başlığı"
            placeholder="Malzemeli Yemek Alımı İhalesi"
            value={manuelFormData.ihale_basligi}
            onChange={(e) => setManuelFormData(prev => ({ ...prev, ihale_basligi: e.target.value }))}
            required
          />

          <TextInput
            label="Kurum / İdare"
            placeholder="... Belediyesi / ... Müdürlüğü"
            value={manuelFormData.kurum}
            onChange={(e) => setManuelFormData(prev => ({ ...prev, kurum: e.target.value }))}
            required
          />

          <NumberInput
            label="Yaklaşık Maliyet (TL)"
            placeholder="0"
            value={manuelFormData.yaklasik_maliyet || ''}
            onChange={(val) => setManuelFormData(prev => ({ ...prev, yaklasik_maliyet: Number(val) || 0 }))}
            thousandSeparator="."
            decimalSeparator=","
            min={0}
            description="İdarenin belirlediği tahmini tutar"
          />

          <SimpleGrid cols={2}>
            <NumberInput
              label="Sınır Değer (TL)"
              placeholder="0"
              value={manuelFormData.sinir_deger || ''}
              onChange={(val) => setManuelFormData(prev => ({ ...prev, sinir_deger: Number(val) || 0 }))}
              thousandSeparator="."
              decimalSeparator=","
              min={0}
              description="Biliyorsanız doğrudan girin"
            />
            <Stack gap="xs" justify="flex-end">
              <Text size="xs" c="dimmed">veya</Text>
              <Button 
                variant="light"
                color="violet"
                leftSection={<IconMathFunction size={16} />}
                onClick={() => {
                  setTeklifListesi([0, 0]);
                  setHesaplananSinirDeger(null);
                  openSinirDegerModal();
                }}
                disabled={!manuelFormData.yaklasik_maliyet}
              >
                Tekliflerden Hesapla
              </Button>
            </Stack>
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <NumberInput
              label="Bizim Teklifimiz (TL)"
              placeholder="0"
              value={manuelFormData.bizim_teklif || ''}
              onChange={(val) => setManuelFormData(prev => ({ ...prev, bizim_teklif: Number(val) || 0 }))}
              thousandSeparator="."
              decimalSeparator=","
              min={0}
              description="Verdiğimiz teklif tutarı"
            />
            <TextInput
              label="Kesinleşme Tarihi"
              type="date"
              value={manuelFormData.kesinlesme_tarihi ? manuelFormData.kesinlesme_tarihi.toISOString().split('T')[0] : ''}
              onChange={(e) => setManuelFormData(prev => ({ 
                ...prev, 
                kesinlesme_tarihi: e.target.value ? new Date(e.target.value) : null 
              }))}
              description="İtiraz süreleri başlangıcı"
            />
          </SimpleGrid>

          <Select
            label="Durum"
            placeholder="Seçin"
            value={manuelFormData.durum}
            onChange={(val) => setManuelFormData(prev => ({ ...prev, durum: val as any || 'beklemede' }))}
            data={[
              { value: 'beklemede', label: '⏳ Beklemede' },
              { value: 'asiri_dusuk', label: '⚠️ Aşırı Düşük Teklif' },
              { value: 'kazandik', label: '✅ Kazandık' },
              { value: 'elendik', label: '❌ Elendik' },
            ]}
          />

          <Textarea
            label="Notlar"
            placeholder="Ek notlar, önemli detaylar..."
            value={manuelFormData.notlar}
            onChange={(e) => setManuelFormData(prev => ({ ...prev, notlar: e.target.value }))}
            minRows={2}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeManuelModal}>
              İptal
            </Button>
            <Button 
              color="violet" 
              leftSection={editingManuelId ? <IconCheck size={16} /> : <IconPlus size={16} />}
              onClick={saveManuelIhale}
            >
              {editingManuelId ? 'Güncelle' : 'Ekle'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Sınır Değer Hesaplama Modal */}
      <Modal
        opened={sinirDegerModalOpened}
        onClose={closeSinirDegerModal}
        title={
          <Group gap="sm">
            <ThemeIcon size="md" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'blue' }}>
              <IconMathFunction size={16} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Sınır Değer Hesaplama</Text>
              <Text size="xs" c="dimmed">KİK Tebliği Formülü</Text>
            </div>
          </Group>
        }
        size="md"
        centered
      >
        <Stack gap="md">
          {/* Yaklaşık Maliyet Gösterimi */}
          <Alert icon={<IconCoin size={16} />} color="blue" variant="light">
            <Group justify="space-between">
              <Text size="sm">Yaklaşık Maliyet:</Text>
              <Text size="sm" fw={700}>{manuelFormData.yaklasik_maliyet.toLocaleString('tr-TR')} TL</Text>
            </Group>
          </Alert>

          {/* Teklif Listesi */}
          <div>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>Teklif Listesi</Text>
              <Button 
                size="xs" 
                variant="light" 
                color="green"
                leftSection={<IconPlus size={14} />}
                onClick={addTeklif}
              >
                Teklif Ekle
              </Button>
            </Group>

            <Stack gap="xs">
              {teklifListesi.map((teklif, index) => (
                <Group key={index} gap="xs">
                  <NumberInput
                    placeholder={`${index + 1}. Teklif`}
                    value={teklif || ''}
                    onChange={(val) => updateTeklif(index, Number(val) || 0)}
                    thousandSeparator="."
                    decimalSeparator=","
                    min={0}
                    style={{ flex: 1 }}
                    leftSection={<Text size="xs" c="dimmed" w={20}>{index + 1}.</Text>}
                  />
                  {teklifListesi.length > 2 && (
                    <ActionIcon 
                      variant="light" 
                      color="red" 
                      onClick={() => removeTeklif(index)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Group>
              ))}
            </Stack>

            <Text size="xs" c="dimmed" mt="xs">
              En az 2 teklif gerekli. Kendi teklifinizi de dahil edin.
            </Text>
          </div>

          <Divider />

          {/* Hesapla Butonu */}
          <Button
            fullWidth
            color="violet"
            size="md"
            leftSection={<IconCalculator size={18} />}
            onClick={() => {
              const sonuc = hesaplaSinirDeger(manuelFormData.yaklasik_maliyet, teklifListesi);
              if (sonuc) {
                notifications.show({
                  title: 'Hesaplandı',
                  message: `Sınır Değer: ${sonuc.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL`,
                  color: 'green',
                });
              }
            }}
            disabled={teklifListesi.filter(t => t > 0).length < 2}
          >
            Sınır Değer Hesapla
          </Button>

          {/* Sonuç */}
          {hesaplananSinirDeger && (
            <Paper p="md" radius="md" withBorder style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
              <Group justify="space-between" align="center">
                <div>
                  <Text size="xs" c="dimmed">Hesaplanan Sınır Değer</Text>
                  <Text size="xl" fw={700} c="green">
                    {hesaplananSinirDeger.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                  </Text>
                </div>
                <Button
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  onClick={() => {
                    setManuelFormData(prev => ({ ...prev, sinir_deger: Math.round(hesaplananSinirDeger) }));
                    closeSinirDegerModal();
                    notifications.show({
                      title: 'Aktarıldı',
                      message: 'Sınır değer forma aktarıldı',
                      color: 'green',
                    });
                  }}
                >
                  Forma Aktar
                </Button>
              </Group>
            </Paper>
          )}

          {/* Formül Açıklaması */}
          <Accordion variant="contained">
            <Accordion.Item value="formul">
              <Accordion.Control icon={<IconInfoCircle size={16} />}>
                <Text size="xs">Formül Nasıl Çalışır?</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="xs" c="dimmed">
                  1. Tekliflerin aritmetik ortalaması (T̄₁) hesaplanır<br/>
                  2. Standart sapma (σ) hesaplanır<br/>
                  3. (T̄₁ - σ) ile (T̄₁ + σ) arasındaki tekliflerin ortalaması (T̄₂) alınır<br/>
                  4. C = T̄₂ / Yaklaşık Maliyet<br/>
                  5. K katsayısı belirlenir<br/>
                  6. Sınır Değer = K × T̄₂
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      </Modal>
    </Container>
  );
}
