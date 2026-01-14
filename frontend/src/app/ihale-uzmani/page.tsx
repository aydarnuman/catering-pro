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
  Collapse,
  Table,
  Accordion,
  Center,
  Stepper,
  Modal,
} from '@mantine/core';
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
  IconSearch,
  IconArrowRight,
  IconArrowLeft,
  IconInfoCircle,
  IconBookmark,
  IconFileAnalytics,
  IconReportMoney,
  IconPlus,
  IconTrash,
  IconEdit,
  IconListCheck,
  IconForms,
  IconTools,
  IconMathFunction,
  IconBuilding,
  IconSettings,
  IconRefresh,
  IconUsers,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { API_BASE_URL } from '@/lib/config';
import Link from 'next/link';
import { 
  ihaleSonuclariApi, 
  type IhaleSonucu, 
  type CreateIhaleSonucInput,
  type RakipTeklif,
  durumConfig,
  type IhaleSonucDurum 
} from '@/lib/ihale-sonuclari-api';

// Firma bilgileri interface (Database)
interface FirmaBilgileri {
  id: number;
  unvan: string;
  kisa_ad?: string;
  vergi_dairesi: string;
  vergi_no: string;
  adres: string;
  telefon: string;
  email: string;
  yetkili_adi: string;
  yetkili_unvani: string;
  imza_yetkisi: string;
  varsayilan: boolean;
}

// Chat message interface
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function IhaleUzmaniPage() {
  const { colorScheme } = useMantineColorScheme();
  
  // İhale Sonuçları (Database'den)
  const [ihaleSonuclari, setIhaleSonuclari] = useState<IhaleSonucu[]>([]);
  const [selectedIhale, setSelectedIhale] = useState<IhaleSonucu | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Wizard step
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState<string | null>('hesaplamalar');
  
  // Modal states
  const [formModalOpened, { open: openFormModal, close: closeFormModal }] = useDisclosure(false);
  const [rakipTeklifModalOpened, { open: openRakipTeklifModal, close: closeRakipTeklifModal }] = useDisclosure(false);
  const [sinirDegerModalOpened, { open: openSinirDegerModal, close: closeSinirDegerModal }] = useDisclosure(false);
  
  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateIhaleSonucInput>({
    ihale_basligi: '',
    kurum: '',
    yaklasik_maliyet: undefined,
    sinir_deger: undefined,
    bizim_teklif: undefined,
    bizim_sira: undefined,
    kesinlesme_tarihi: '',
    durum: 'beklemede',
    notlar: '',
  });
  
  // Rakip teklif form
  const [rakipTeklifForm, setRakipTeklifForm] = useState({ firma: '', teklif: 0 });
  
  // Sınır değer hesaplama
  const [teklifListesi, setTeklifListesi] = useState<number[]>([0, 0]);
  const [hesaplananSinirDeger, setHesaplananSinirDeger] = useState<number | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Firma state
  const [firmalar, setFirmalar] = useState<FirmaBilgileri[]>([]);
  const [seciliFirmaId, setSeciliFirmaId] = useState<number | null>(null);
  const [firmaPanelOpen, setFirmaPanelOpen] = useState(false);
  const [firmaLoading, setFirmaLoading] = useState(false);
  
  const seciliFirma = firmalar.find(f => f.id === seciliFirmaId) || firmalar.find(f => f.varsayilan) || null;

  // Hesaplama states
  const [asiriDusukData, setAsiriDusukData] = useState({ anaGirdi: 0, iscilik: 0, toplamTeklif: 0 });
  const [asiriDusukSonuc, setAsiriDusukSonuc] = useState<{ oran: number; gecerli: boolean; aciklama: string } | null>(null);
  const [sureData, setSureData] = useState({ tebligTarihi: '', basvuruTuru: 'sikayet' as 'sikayet' | 'itirazen_sikayet' });
  const [sureSonuc, setSureSonuc] = useState<{ sonTarih: Date; kalanGun: number; uyarilar: string[] } | null>(null);
  const [bedelData, setBedelData] = useState({ yaklasikMaliyet: 0 });
  const [bedelSonuc, setBedelSonuc] = useState<{ bedel: number; aciklama: string } | null>(null);

  // Load data
  useEffect(() => {
    loadIhaleSonuclari();
    loadFirmalar();
  }, []);

  // Load ihale sonuçları from API
  const loadIhaleSonuclari = async () => {
    try {
      setLoading(true);
      const result = await ihaleSonuclariApi.list({ limit: 100 });
      setIhaleSonuclari(result.data);
    } catch (error) {
      console.error('İhale sonuçları yüklenemedi:', error);
      notifications.show({
        title: 'Hata',
        message: 'İhale sonuçları yüklenemedi',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load firmalar
  const loadFirmalar = async () => {
    try {
      setFirmaLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/firmalar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFirmalar(data.data || []);
        const varsayilan = data.data?.find((f: FirmaBilgileri) => f.varsayilan);
        if (varsayilan) setSeciliFirmaId(varsayilan.id);
        else if (data.data?.length > 0) setSeciliFirmaId(data.data[0].id);
      }
    } catch (e) {
      console.error('Firmalar yüklenemedi:', e);
    } finally {
      setFirmaLoading(false);
    }
  };

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // İhale seçildiğinde
  useEffect(() => {
    if (selectedIhale) {
      // Veriler tamam mı kontrol et
      const { yaklasik_maliyet, sinir_deger, bizim_teklif, kesinlesme_tarihi } = selectedIhale;
      if (yaklasik_maliyet && sinir_deger && bizim_teklif && kesinlesme_tarihi) {
        setCurrentStep(2); // Araçlara geç
        // AI sohbet geçmişini yükle
        if (selectedIhale.ai_sohbet_gecmisi?.length > 0) {
          setMessages(selectedIhale.ai_sohbet_gecmisi.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })));
        } else {
          setMessages([]);
        }
      } else {
        setCurrentStep(1); // Veri girişine geç
      }
      // Hesaplama alanlarını doldur
      if (selectedIhale.bizim_teklif) {
        setAsiriDusukData(prev => ({ ...prev, toplamTeklif: Number(selectedIhale.bizim_teklif) }));
      }
      if (selectedIhale.yaklasik_maliyet) {
        setBedelData({ yaklasikMaliyet: Number(selectedIhale.yaklasik_maliyet) });
      }
      if (selectedIhale.kesinlesme_tarihi) {
        setSureData(prev => ({ ...prev, tebligTarihi: selectedIhale.kesinlesme_tarihi?.split('T')[0] || '' }));
      }
    } else {
      setCurrentStep(0);
      setMessages([]);
    }
  }, [selectedIhale]);

  // Form submit - create or update
  const handleFormSubmit = async () => {
    if (!formData.ihale_basligi || !formData.kurum) {
      notifications.show({ title: 'Hata', message: 'İhale başlığı ve kurum zorunludur', color: 'red' });
      return;
    }

    try {
      if (editingId) {
        const result = await ihaleSonuclariApi.update(editingId, formData);
        setIhaleSonuclari(prev => prev.map(i => i.id === editingId ? result.data : i));
        if (selectedIhale?.id === editingId) setSelectedIhale(result.data);
        notifications.show({ title: 'Güncellendi', message: result.message, color: 'green' });
      } else {
        const result = await ihaleSonuclariApi.create(formData);
        setIhaleSonuclari(prev => [result.data, ...prev]);
        notifications.show({ title: 'Eklendi', message: result.message, color: 'green' });
      }
      closeFormModal();
      resetForm();
    } catch (error: unknown) {
      notifications.show({ title: 'Hata', message: error instanceof Error ? error.message : 'Bir hata oluştu', color: 'red' });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      ihale_basligi: '',
      kurum: '',
      yaklasik_maliyet: undefined,
      sinir_deger: undefined,
      bizim_teklif: undefined,
      bizim_sira: undefined,
      kesinlesme_tarihi: '',
      durum: 'beklemede',
      notlar: '',
    });
    setEditingId(null);
  };

  // Edit ihale
  const handleEdit = (ihale: IhaleSonucu) => {
    setFormData({
      ihale_basligi: ihale.ihale_basligi,
      kurum: ihale.kurum,
      yaklasik_maliyet: ihale.yaklasik_maliyet ? Number(ihale.yaklasik_maliyet) : undefined,
      sinir_deger: ihale.sinir_deger ? Number(ihale.sinir_deger) : undefined,
      bizim_teklif: ihale.bizim_teklif ? Number(ihale.bizim_teklif) : undefined,
      bizim_sira: ihale.bizim_sira || undefined,
      kesinlesme_tarihi: ihale.kesinlesme_tarihi?.split('T')[0] || '',
      durum: ihale.durum,
      notlar: ihale.notlar || '',
    });
    setEditingId(ihale.id);
    openFormModal();
  };

  // Delete ihale
  const handleDelete = async (id: number) => {
    if (!confirm('Bu ihale sonucunu silmek istediğinize emin misiniz?')) return;
    
    try {
      await ihaleSonuclariApi.delete(id);
      setIhaleSonuclari(prev => prev.filter(i => i.id !== id));
      if (selectedIhale?.id === id) {
        setSelectedIhale(null);
        setCurrentStep(0);
      }
      notifications.show({ title: 'Silindi', message: 'İhale sonucu silindi', color: 'orange' });
    } catch (error: unknown) {
      notifications.show({ title: 'Hata', message: error instanceof Error ? error.message : 'Silinemedi', color: 'red' });
    }
  };

  // Update selected ihale field
  const updateSelectedField = async (field: string, value: unknown) => {
    if (!selectedIhale) return;
    
    try {
      const result = await ihaleSonuclariApi.update(selectedIhale.id, { [field]: value });
      setSelectedIhale(result.data);
      setIhaleSonuclari(prev => prev.map(i => i.id === selectedIhale.id ? result.data : i));
    } catch (error) {
      console.error('Güncelleme hatası:', error);
    }
  };

  // Add rakip teklif
  const handleAddRakipTeklif = async () => {
    if (!selectedIhale || !rakipTeklifForm.firma || !rakipTeklifForm.teklif) {
      notifications.show({ title: 'Hata', message: 'Firma adı ve teklif zorunludur', color: 'red' });
      return;
    }

    try {
      const result = await ihaleSonuclariApi.addRakipTeklif(selectedIhale.id, rakipTeklifForm);
      setSelectedIhale(result.data);
      setIhaleSonuclari(prev => prev.map(i => i.id === selectedIhale.id ? result.data : i));
      setRakipTeklifForm({ firma: '', teklif: 0 });
      notifications.show({ title: 'Eklendi', message: 'Rakip teklif eklendi', color: 'green' });
    } catch (error: unknown) {
      notifications.show({ title: 'Hata', message: error instanceof Error ? error.message : 'Eklenemedi', color: 'red' });
    }
  };

  // Remove rakip teklif
  const handleRemoveRakipTeklif = async (sira: number) => {
    if (!selectedIhale) return;

    try {
      const result = await ihaleSonuclariApi.removeRakipTeklif(selectedIhale.id, sira);
      setSelectedIhale(result.data);
      setIhaleSonuclari(prev => prev.map(i => i.id === selectedIhale.id ? result.data : i));
    } catch (error: unknown) {
      notifications.show({ title: 'Hata', message: error instanceof Error ? error.message : 'Silinemedi', color: 'red' });
    }
  };

  // Sınır değer hesaplama (KİK formülü)
  const hesaplaSinirDeger = useCallback((yaklasikMaliyet: number, teklifler: number[]) => {
    if (yaklasikMaliyet <= 0) {
      notifications.show({ title: 'Hata', message: 'Yaklaşık maliyet giriniz', color: 'red' });
      return null;
    }

    const gecerliTeklifler = teklifler.filter(t => t > 0);
    const n = gecerliTeklifler.length;
    
    if (n < 2) {
      notifications.show({ title: 'Hata', message: 'En az 2 geçerli teklif gerekli', color: 'red' });
      return null;
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

    const sinirDeger = K * Tort2;
    setHesaplananSinirDeger(sinirDeger);
    
    return sinirDeger;
  }, []);

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

    // Hesaplamayı kaydet
    if (selectedIhale) {
      ihaleSonuclariApi.saveHesaplama(selectedIhale.id, 'asiri_dusuk_oran', { oran, gecerli }).catch(console.error);
    }
  }, [asiriDusukData, selectedIhale]);

  // Süre hesaplama
  const hesaplaSure = useCallback(() => {
    if (!sureData.tebligTarihi) {
      notifications.show({ title: 'Hata', message: 'Tebliğ tarihi seçiniz', color: 'red' });
      return;
    }

    const gun = 10; // Her iki başvuru türü için 10 gün
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

  // Bedel hesaplama
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

  // AI Message send
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
    setIsAILoading(true);

    try {
      // Build context
      let context = '';
      if (seciliFirma) {
        context += `Kullanıcının Firma Bilgileri:\n- Firma: ${seciliFirma.unvan}\n`;
        if (seciliFirma.vergi_no) context += `- Vergi No: ${seciliFirma.vergi_no}\n`;
        if (seciliFirma.adres) context += `- Adres: ${seciliFirma.adres}\n`;
        if (seciliFirma.yetkili_adi) context += `- Yetkili: ${seciliFirma.yetkili_adi}\n\n`;
      }
      
      if (selectedIhale) {
        context += `Seçili İhale:\n`;
        context += `- Başlık: ${selectedIhale.ihale_basligi}\n`;
        context += `- Kurum: ${selectedIhale.kurum}\n`;
        context += `- Durum: ${durumConfig[selectedIhale.durum].label}\n`;
        if (selectedIhale.yaklasik_maliyet) context += `- Yaklaşık Maliyet: ${Number(selectedIhale.yaklasik_maliyet).toLocaleString('tr-TR')} TL\n`;
        if (selectedIhale.sinir_deger) context += `- Sınır Değer: ${Number(selectedIhale.sinir_deger).toLocaleString('tr-TR')} TL\n`;
        if (selectedIhale.bizim_teklif) context += `- Bizim Teklif: ${Number(selectedIhale.bizim_teklif).toLocaleString('tr-TR')} TL (${selectedIhale.bizim_sira}. sıra)\n`;
        if (selectedIhale.diger_teklifler?.length > 0) {
          context += `- Diğer Teklifler:\n`;
          selectedIhale.diger_teklifler.forEach(t => {
            context += `  ${t.sira}. ${t.firma}: ${t.teklif.toLocaleString('tr-TR')} TL${t.asiri_dusuk ? ' (A.D.)' : ''}\n`;
          });
        }
        context += `\nBu ihale bağlamında cevap ver.\n\n`;
      }

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

      // Save to database
      if (selectedIhale) {
        await ihaleSonuclariApi.saveAISohbet(selectedIhale.id, 'user', inputMessage);
        await ihaleSonuclariApi.saveAISohbet(selectedIhale.id, 'assistant', assistantMessage.content);
      }
    } catch (error) {
      console.error('AI Error:', error);
      notifications.show({ title: 'Hata', message: 'AI yanıt veremedi', color: 'red' });
    } finally {
      setIsAILoading(false);
    }
  };

  // Quick actions
  const quickActions = [
    { label: 'Aşırı Düşük Açıklama', prompt: 'Bu ihale için aşırı düşük teklif açıklama yazısı hazırla. EK-H.4 formatında olsun.' },
    { label: 'İtiraz Dilekçesi', prompt: 'Bu ihale için idareye şikayet dilekçesi taslağı hazırla.' },
    { label: 'KİK Emsal Karar', prompt: 'Bu ihale konusunda benzer KİK kararlarını araştır ve özetle.' },
    { label: 'Mevzuat Bilgisi', prompt: 'Bu ihale türü için geçerli mevzuat maddelerini açıkla.' },
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
          <Group gap="sm">
            <ThemeIcon size={48} radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'blue', deg: 135 }}>
              <IconScale size={28} />
            </ThemeIcon>
            <div>
              <Title order={2}>İhale Uzmanı</Title>
              <Text size="sm" c="dimmed">İhale sonuç analizi ve hukuk desteği</Text>
            </div>
          </Group>
          <Group gap="sm">
            {firmaLoading ? <Loader size="sm" /> : firmalar.length > 0 ? (
              <Select
                placeholder="Firma seçin"
                data={firmalar.map(f => ({ value: String(f.id), label: f.unvan }))}
                value={seciliFirmaId ? String(seciliFirmaId) : null}
                onChange={(val) => setSeciliFirmaId(val ? Number(val) : null)}
                leftSection={<IconBuilding size={18} />}
                style={{ minWidth: 200 }}
              />
            ) : (
              <Button component={Link} href="/ayarlar?section=firma" variant="filled" color="orange" leftSection={<IconBuilding size={18} />}>
                Firma Ekle
              </Button>
            )}
            <Tooltip label="Firma bilgileri">
              <ActionIcon variant="light" color={seciliFirma ? 'teal' : 'gray'} size="lg" onClick={() => setFirmaPanelOpen(!firmaPanelOpen)} disabled={!seciliFirma}>
                <IconInfoCircle size={20} />
              </ActionIcon>
            </Tooltip>
            <Button component={Link} href="/tracking" variant="light" leftSection={<IconBookmark size={18} />}>
              İhale Takibim
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Firma Panel */}
      <Collapse in={firmaPanelOpen && !!seciliFirma}>
        <Paper p="md" mb="lg" radius="md" withBorder style={{ background: colorScheme === 'dark' ? 'rgba(0, 166, 125, 0.05)' : 'rgba(0, 166, 125, 0.03)', borderColor: 'var(--mantine-color-teal-4)' }}>
          <Group justify="space-between" mb="md">
            <Group gap="sm">
              <ThemeIcon size="md" radius="md" variant="light" color="teal"><IconBuilding size={16} /></ThemeIcon>
              <Text fw={600} size="sm">Seçili Firma: {seciliFirma?.unvan}</Text>
            </Group>
            <ActionIcon variant="subtle" color="gray" onClick={() => setFirmaPanelOpen(false)}><IconX size={16} /></ActionIcon>
          </Group>
          {seciliFirma && (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
              <Box><Text size="xs" c="dimmed">Vergi No</Text><Text size="sm">{seciliFirma.vergi_no || '-'}</Text></Box>
              <Box><Text size="xs" c="dimmed">Yetkili</Text><Text size="sm">{seciliFirma.yetkili_adi || '-'}</Text></Box>
              <Box><Text size="xs" c="dimmed">Telefon</Text><Text size="sm">{seciliFirma.telefon || '-'}</Text></Box>
              <Box><Text size="xs" c="dimmed">Adres</Text><Text size="sm" lineClamp={1}>{seciliFirma.adres || '-'}</Text></Box>
            </SimpleGrid>
          )}
        </Paper>
      </Collapse>

      {/* Stepper */}
      <Paper p="md" mb="lg" radius="md" withBorder>
        <Stepper active={currentStep} color="violet" size="sm" completedIcon={<IconCheck size={16} />}>
          <Stepper.Step icon={<IconListCheck size={16} />} label="İhale Seç" description="Listeden seç veya ekle" />
          <Stepper.Step icon={<IconForms size={16} />} label="Verileri Tamamla" description="Maliyet, sınır değer, teklif" />
          <Stepper.Step icon={<IconTools size={16} />} label="Araçlar" description="Hesaplamalar, AI, Dilekçe" />
        </Stepper>
      </Paper>

      {/* STEP 0: İhale Seçimi */}
      {currentStep === 0 && (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper p="md" radius="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Text fw={600} size="sm"><IconListCheck size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />İhale Sonuçları</Text>
                <Group gap="xs">
                  <Badge size="sm" variant="light" color="blue">{ihaleSonuclari.length}</Badge>
                  <Tooltip label="Yenile">
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={loadIhaleSonuclari} loading={loading}><IconRefresh size={16} /></ActionIcon>
                  </Tooltip>
                  <Tooltip label="Yeni Ekle">
                    <ActionIcon variant="filled" color="violet" size="md" onClick={() => { resetForm(); openFormModal(); }}><IconPlus size={18} /></ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <ScrollArea h={400} offsetScrollbars>
                <Stack gap="xs">
                  {loading ? (
                    <Center py="xl"><Loader /></Center>
                  ) : ihaleSonuclari.length === 0 ? (
                    <Alert icon={<IconInfoCircle size={18} />} color="violet" variant="light">
                      Henüz ihale sonucu eklenmemiş. Yeni eklemek için + butonuna tıklayın.
                    </Alert>
                  ) : (
                    ihaleSonuclari.map((ihale) => (
                      <Card
                        key={ihale.id}
                        padding="sm"
                        radius="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderColor: `var(--mantine-color-${durumConfig[ihale.durum].color}-3)`,
                          borderLeftWidth: 3,
                        }}
                        onClick={() => setSelectedIhale(ihale)}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" mb={4}>
                              <Badge size="xs" color={durumConfig[ihale.durum].color} variant="light">
                                {durumConfig[ihale.durum].icon} {durumConfig[ihale.durum].label}
                              </Badge>
                              {ihale.kalan_gun !== null && ihale.kalan_gun !== undefined && ihale.kalan_gun <= 5 && ihale.kalan_gun >= 0 && (
                                <Badge size="xs" color="red" variant="filled">{ihale.kalan_gun} gün!</Badge>
                              )}
                            </Group>
                            <Text size="sm" fw={500} lineClamp={1}>{ihale.ihale_basligi}</Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>{ihale.kurum}</Text>
                            {ihale.bizim_teklif && (
                              <Text size="xs" c="green" fw={500}>{Number(ihale.bizim_teklif).toLocaleString('tr-TR')} ₺</Text>
                            )}
                          </div>
                          <Group gap={4}>
                            <ActionIcon variant="subtle" color="blue" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(ihale); }}>
                              <IconEdit size={14} />
                            </ActionIcon>
                            <ActionIcon variant="subtle" color="red" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(ihale.id); }}>
                              <IconTrash size={14} />
                            </ActionIcon>
                            <IconArrowRight size={16} color="gray" />
                          </Group>
                        </Group>
                      </Card>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper p="xl" radius="md" withBorder h="100%">
              <Center h={400}>
                <Stack align="center" gap="lg">
                  <ThemeIcon size={80} radius="xl" variant="light" color="violet"><IconListCheck size={40} /></ThemeIcon>
                  <div style={{ textAlign: 'center' }}>
                    <Title order={3} mb="xs">İhale Sonucu Seçin</Title>
                    <Text c="dimmed" size="sm" maw={400}>
                      Sol panelden bir ihale seçin veya yeni ihale sonucu ekleyin.
                    </Text>
                  </div>
                  <Button variant="light" color="violet" size="lg" leftSection={<IconPlus size={20} />} onClick={() => { resetForm(); openFormModal(); }}>
                    Yeni İhale Sonucu Ekle
                  </Button>
                </Stack>
              </Center>
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      {/* STEP 1: Veri Girişi */}
      {currentStep === 1 && selectedIhale && (
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="lg">
            <div>
              <Button variant="subtle" color="gray" size="xs" leftSection={<IconArrowLeft size={14} />} onClick={() => { setSelectedIhale(null); setCurrentStep(0); }} mb={4}>
                Geri
              </Button>
              <Title order={3}>{selectedIhale.ihale_basligi}</Title>
              <Text c="dimmed" size="sm">{selectedIhale.kurum}</Text>
            </div>
            <Badge color={durumConfig[selectedIhale.durum].color} size="lg">
              {durumConfig[selectedIhale.durum].icon} {durumConfig[selectedIhale.durum].label}
            </Badge>
          </Group>

          <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light" mb="lg">
            Hesaplama araçlarını kullanabilmek için aşağıdaki bilgileri doldurun.
          </Alert>

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="md">
                <NumberInput
                  label="Yaklaşık Maliyet (TL)"
                  description="İdarenin belirlediği tahmini tutar"
                  value={selectedIhale.yaklasik_maliyet ? Number(selectedIhale.yaklasik_maliyet) : ''}
                  onChange={(val) => updateSelectedField('yaklasik_maliyet', val)}
                  thousandSeparator="." decimalSeparator="," min={0} size="md"
                  leftSection={<IconCoin size={18} />}
                />
                <NumberInput
                  label="Sınır Değer (TL)"
                  description="Aşırı düşük teklif sınırı"
                  value={selectedIhale.sinir_deger ? Number(selectedIhale.sinir_deger) : ''}
                  onChange={(val) => updateSelectedField('sinir_deger', val)}
                  thousandSeparator="." decimalSeparator="," min={0} size="md"
                  leftSection={<IconAlertTriangle size={18} />}
                />
                <NumberInput
                  label="Bizim Teklifimiz (TL)"
                  value={selectedIhale.bizim_teklif ? Number(selectedIhale.bizim_teklif) : ''}
                  onChange={(val) => updateSelectedField('bizim_teklif', val)}
                  thousandSeparator="." decimalSeparator="," min={0} size="md"
                  leftSection={<IconReportMoney size={18} />}
                />
                <TextInput
                  label="Kesinleşme Tarihi"
                  type="date"
                  value={selectedIhale.kesinlesme_tarihi?.split('T')[0] || ''}
                  onChange={(e) => updateSelectedField('kesinlesme_tarihi', e.target.value)}
                  size="md"
                  leftSection={<IconCalendar size={18} />}
                />
                <Select
                  label="Durum"
                  value={selectedIhale.durum}
                  onChange={(val) => val && updateSelectedField('durum', val)}
                  data={Object.entries(durumConfig).map(([key, val]) => ({ value: key, label: `${val.icon} ${val.label}` }))}
                  size="md"
                />
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              {/* Rakip Teklifler */}
              <Paper p="md" radius="md" withBorder style={{ background: colorScheme === 'dark' ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.03)' }}>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size="md" radius="md" variant="light" color="violet"><IconUsers size={16} /></ThemeIcon>
                    <Text fw={600} size="sm">Rakip Teklifler ({selectedIhale.diger_teklifler?.length || 0})</Text>
                  </Group>
                  <Button size="xs" variant="light" color="green" leftSection={<IconPlus size={14} />} onClick={openRakipTeklifModal}>
                    Ekle
                  </Button>
                </Group>

                {selectedIhale.diger_teklifler?.length > 0 ? (
                  <Stack gap="xs">
                    {selectedIhale.diger_teklifler.map((teklif, idx) => (
                      <Paper key={idx} p="xs" radius="sm" withBorder>
                        <Group justify="space-between">
                          <Group gap="xs">
                            <Badge size="sm" color={teklif.asiri_dusuk ? 'orange' : 'gray'} variant="light">{teklif.sira}.</Badge>
                            <div>
                              <Text size="sm" fw={500}>{teklif.firma}</Text>
                              <Text size="xs" c="green">{teklif.teklif.toLocaleString('tr-TR')} ₺</Text>
                            </div>
                          </Group>
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleRemoveRakipTeklif(teklif.sira)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" ta="center" py="md">Henüz rakip teklif eklenmemiş</Text>
                )}

                <Divider my="md" />

                <Button
                  fullWidth variant="light" color="violet" size="md"
                  leftSection={<IconMathFunction size={18} />}
                  onClick={() => {
                    setTeklifListesi([0, 0]);
                    setHesaplananSinirDeger(null);
                    openSinirDegerModal();
                  }}
                  disabled={!selectedIhale.yaklasik_maliyet}
                >
                  Sınır Değer Hesapla
                </Button>
              </Paper>
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="xl">
            <Button
              size="lg" color="violet" rightSection={<IconArrowRight size={18} />}
              disabled={!selectedIhale.yaklasik_maliyet || !selectedIhale.sinir_deger || !selectedIhale.bizim_teklif || !selectedIhale.kesinlesme_tarihi}
              onClick={() => setCurrentStep(2)}
            >
              Araçlara Geç
            </Button>
          </Group>
        </Paper>
      )}

      {/* STEP 2: Araçlar */}
      {currentStep === 2 && selectedIhale && (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper p="md" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Button variant="subtle" color="gray" size="xs" leftSection={<IconArrowLeft size={14} />} onClick={() => { setSelectedIhale(null); setCurrentStep(0); }}>
                  Başka İhale
                </Button>
                <ActionIcon variant="light" color="blue" size="sm" onClick={() => setCurrentStep(1)}><IconEdit size={14} /></ActionIcon>
              </Group>

              <Text fw={600} size="lg" mb="xs">{selectedIhale.ihale_basligi}</Text>
              <Text c="dimmed" size="sm" mb="md">{selectedIhale.kurum}</Text>
              <Badge size="lg" mb="md" color={durumConfig[selectedIhale.durum].color}>
                {durumConfig[selectedIhale.durum].icon} {durumConfig[selectedIhale.durum].label}
              </Badge>

              <Divider my="md" />

              <SimpleGrid cols={2} spacing="sm">
                <Paper p="sm" radius="sm" withBorder>
                  <Text size="xs" c="dimmed">Yaklaşık Maliyet</Text>
                  <Text size="sm" fw={600} c="blue">{selectedIhale.yaklasik_maliyet ? `${Number(selectedIhale.yaklasik_maliyet).toLocaleString('tr-TR')} ₺` : '-'}</Text>
                </Paper>
                <Paper p="sm" radius="sm" withBorder>
                  <Text size="xs" c="dimmed">Sınır Değer</Text>
                  <Text size="sm" fw={600} c="orange">{selectedIhale.sinir_deger ? `${Number(selectedIhale.sinir_deger).toLocaleString('tr-TR')} ₺` : '-'}</Text>
                </Paper>
                <Paper p="sm" radius="sm" withBorder>
                  <Text size="xs" c="dimmed">Bizim Teklif</Text>
                  <Text size="sm" fw={600} c="green">{selectedIhale.bizim_teklif ? `${Number(selectedIhale.bizim_teklif).toLocaleString('tr-TR')} ₺` : '-'}</Text>
                </Paper>
                <Paper p="sm" radius="sm" withBorder>
                  <Text size="xs" c="dimmed">Sıramız</Text>
                  <Text size="sm" fw={600}>{selectedIhale.bizim_sira || '-'}</Text>
                </Paper>
              </SimpleGrid>

              {selectedIhale.sinir_deger && selectedIhale.bizim_teklif && (
                <Alert
                  mt="md"
                  color={Number(selectedIhale.bizim_teklif) < Number(selectedIhale.sinir_deger) ? 'orange' : 'green'}
                  variant="light"
                  icon={Number(selectedIhale.bizim_teklif) < Number(selectedIhale.sinir_deger) ? <IconAlertTriangle size={18} /> : <IconCheck size={18} />}
                >
                  <Text size="sm">
                    {Number(selectedIhale.bizim_teklif) < Number(selectedIhale.sinir_deger)
                      ? `Teklifiniz sınır değerin ${((1 - Number(selectedIhale.bizim_teklif) / Number(selectedIhale.sinir_deger)) * 100).toFixed(1)}% altında - Açıklama gerekli!`
                      : 'Teklifiniz sınır değerin üzerinde'}
                  </Text>
                </Alert>
              )}

              {/* Rakip Teklifler Özet */}
              {selectedIhale.diger_teklifler?.length > 0 && (
                <>
                  <Divider my="md" label="Teklif Sıralaması" labelPosition="center" />
                  <Stack gap={4}>
                    {selectedIhale.diger_teklifler.slice(0, 5).map((t, i) => (
                      <Group key={i} justify="space-between" gap="xs">
                        <Group gap="xs">
                          <Badge size="xs" color={t.asiri_dusuk ? 'orange' : 'gray'}>{t.sira}</Badge>
                          <Text size="xs" lineClamp={1} style={{ maxWidth: 120 }}>{t.firma}</Text>
                        </Group>
                        <Text size="xs" fw={500}>{t.teklif.toLocaleString('tr-TR')} ₺</Text>
                      </Group>
                    ))}
                  </Stack>
                </>
              )}
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper p="md" radius="md" withBorder>
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List mb="md">
                  <Tabs.Tab value="hesaplamalar" leftSection={<IconCalculator size={16} />}>Hesaplamalar</Tabs.Tab>
                  <Tabs.Tab value="uzman" leftSection={<IconBrain size={16} />}>AI Uzman</Tabs.Tab>
                  <Tabs.Tab value="dilekce" leftSection={<IconFileText size={16} />}>Dilekçe</Tabs.Tab>
                </Tabs.List>

                {/* Hesaplamalar Tab */}
                <Tabs.Panel value="hesaplamalar">
                  <Accordion defaultValue="asiri-dusuk" variant="separated">
                    <Accordion.Item value="asiri-dusuk">
                      <Accordion.Control icon={<IconReportMoney size={20} color="var(--mantine-color-orange-6)" />}>
                        <Text fw={500}>Aşırı Düşük Teklif Hesaplama</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
                          <NumberInput label="Ana Çiğ Girdi (TL)" value={asiriDusukData.anaGirdi} onChange={(val) => setAsiriDusukData(prev => ({ ...prev, anaGirdi: Number(val) || 0 }))} thousandSeparator="." decimalSeparator="," min={0} />
                          <NumberInput label="İşçilik (TL)" value={asiriDusukData.iscilik} onChange={(val) => setAsiriDusukData(prev => ({ ...prev, iscilik: Number(val) || 0 }))} thousandSeparator="." decimalSeparator="," min={0} />
                          <NumberInput label="Toplam Teklif (TL)" value={asiriDusukData.toplamTeklif} onChange={(val) => setAsiriDusukData(prev => ({ ...prev, toplamTeklif: Number(val) || 0 }))} thousandSeparator="." decimalSeparator="," min={0} />
                        </SimpleGrid>
                        <Button onClick={hesaplaAsiriDusuk} leftSection={<IconCalculator size={16} />}>Hesapla</Button>
                        {asiriDusukSonuc && (
                          <Alert mt="md" color={asiriDusukSonuc.gecerli ? 'green' : 'red'} icon={asiriDusukSonuc.gecerli ? <IconCheck size={18} /> : <IconX size={18} />}>
                            <Text fw={700}>{(asiriDusukSonuc.oran * 100).toFixed(2)}%</Text>
                            <Text size="sm">{asiriDusukSonuc.aciklama}</Text>
                          </Alert>
                        )}
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="sure">
                      <Accordion.Control icon={<IconCalendar size={20} color="var(--mantine-color-blue-6)" />}>
                        <Text fw={500}>İtiraz Süresi Hesaplama</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
                          <TextInput label="Tebliğ Tarihi" type="date" value={sureData.tebligTarihi} onChange={(e) => setSureData(prev => ({ ...prev, tebligTarihi: e.target.value }))} />
                          <Select label="Başvuru Türü" value={sureData.basvuruTuru} onChange={(val) => setSureData(prev => ({ ...prev, basvuruTuru: val as 'sikayet' | 'itirazen_sikayet' }))} data={[{ value: 'sikayet', label: 'İdareye Şikayet (10 gün)' }, { value: 'itirazen_sikayet', label: 'KİK İtirazen Şikayet (10 gün)' }]} />
                        </SimpleGrid>
                        <Button onClick={hesaplaSure} leftSection={<IconCalendar size={16} />}>Hesapla</Button>
                        {sureSonuc && (
                          <Alert mt="md" color={sureSonuc.kalanGun > 3 ? 'blue' : sureSonuc.kalanGun > 0 ? 'orange' : 'red'} icon={<IconCalendar size={18} />}>
                            <Group><Text fw={700}>Son: {sureSonuc.sonTarih.toLocaleDateString('tr-TR')}</Text><Badge>{sureSonuc.kalanGun} gün kaldı</Badge></Group>
                            {sureSonuc.uyarilar.map((u, i) => <Text key={i} size="sm" c="orange">{u}</Text>)}
                          </Alert>
                        )}
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="bedel">
                      <Accordion.Control icon={<IconCoin size={20} color="var(--mantine-color-green-6)" />}>
                        <Text fw={500}>İtirazen Şikayet Bedeli (2025)</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <NumberInput label="Yaklaşık Maliyet (TL)" value={bedelData.yaklasikMaliyet} onChange={(val) => setBedelData({ yaklasikMaliyet: Number(val) || 0 })} thousandSeparator="." decimalSeparator="," min={0} mb="md" style={{ maxWidth: 300 }} />
                        <Button onClick={hesaplaBedel} leftSection={<IconCoin size={16} />}>Hesapla</Button>
                        {bedelSonuc && (
                          <Alert mt="md" color="green" icon={<IconCoin size={18} />}>
                            <Text size="xl" fw={700}>{bedelSonuc.bedel.toLocaleString('tr-TR')} TL</Text>
                            <Text size="sm" c="dimmed">{bedelSonuc.aciklama}</Text>
                          </Alert>
                        )}
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>
                </Tabs.Panel>

                {/* AI Uzman Tab */}
                <Tabs.Panel value="uzman">
                  <Group gap="xs" mb="md">
                    {quickActions.map((action, i) => (
                      <Button key={i} variant="light" size="xs" onClick={() => setInputMessage(action.prompt)}>{action.label}</Button>
                    ))}
                  </Group>
                  <Paper withBorder p="md" radius="md" style={{ height: 450, display: 'flex', flexDirection: 'column' }}>
                    <ScrollArea style={{ flex: 1 }} offsetScrollbars>
                      {messages.length === 0 ? (
                        <Center h={300}>
                          <Stack align="center">
                            <ThemeIcon size={60} radius="xl" variant="light" color="violet"><IconBrain size={32} /></ThemeIcon>
                            <Text c="dimmed" ta="center">İhale uzmanınıza soru sorun.</Text>
                          </Stack>
                        </Center>
                      ) : (
                        <Stack gap="md">
                          {messages.map((msg) => (
                            <Box key={msg.id} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                              <Paper p="sm" radius="md" style={{ background: msg.role === 'user' ? 'var(--mantine-color-blue-6)' : colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                                <Text size="sm" c={msg.role === 'user' ? 'white' : undefined} style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
                              </Paper>
                              <Text size="xs" c="dimmed" mt={4} ta={msg.role === 'user' ? 'right' : 'left'}>{msg.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
                            </Box>
                          ))}
                          {isAILoading && <Group gap="xs"><Loader size="xs" /><Text size="sm" c="dimmed">Düşünüyor...</Text></Group>}
                          <div ref={chatEndRef} />
                        </Stack>
                      )}
                    </ScrollArea>
                    <Box mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                      <Group gap="xs">
                        <Textarea placeholder="Soru sorun..." value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} style={{ flex: 1 }} minRows={1} maxRows={3} autosize onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
                        <ActionIcon size="lg" variant="filled" color="violet" onClick={sendMessage} loading={isAILoading} disabled={!inputMessage.trim()}><IconSend size={18} /></ActionIcon>
                      </Group>
                    </Box>
                  </Paper>
                </Tabs.Panel>

                {/* Dilekçe Tab */}
                <Tabs.Panel value="dilekce">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Card withBorder padding="lg" radius="md">
                      <ThemeIcon size={40} radius="md" variant="light" color="orange" mb="md"><IconFileAnalytics size={22} /></ThemeIcon>
                      <Text fw={600} mb="xs">Aşırı Düşük Açıklama</Text>
                      <Text size="sm" c="dimmed" mb="md">EK-H.4 formatında</Text>
                      <Button variant="light" onClick={() => { setActiveTab('uzman'); setInputMessage('Bu ihale için aşırı düşük teklif açıklama yazısı hazırla. EK-H.4 formatında olsun.'); }}>Oluştur</Button>
                    </Card>
                    <Card withBorder padding="lg" radius="md">
                      <ThemeIcon size={40} radius="md" variant="light" color="red" mb="md"><IconGavel size={22} /></ThemeIcon>
                      <Text fw={600} mb="xs">İdareye Şikayet</Text>
                      <Text size="sm" c="dimmed" mb="md">4734 sayılı Kanun</Text>
                      <Button variant="light" color="red" onClick={() => { setActiveTab('uzman'); setInputMessage('Bu ihale için idareye şikayet dilekçesi taslağı hazırla.'); }}>Oluştur</Button>
                    </Card>
                    <Card withBorder padding="lg" radius="md">
                      <ThemeIcon size={40} radius="md" variant="light" color="violet" mb="md"><IconScale size={22} /></ThemeIcon>
                      <Text fw={600} mb="xs">KİK İtirazen Şikayet</Text>
                      <Text size="sm" c="dimmed" mb="md">KİK başvurusu</Text>
                      <Button variant="light" color="violet" onClick={() => { setActiveTab('uzman'); setInputMessage('Bu ihale için KİK\'e itirazen şikayet dilekçesi hazırla.'); }}>Oluştur</Button>
                    </Card>
                    <Card withBorder padding="lg" radius="md">
                      <ThemeIcon size={40} radius="md" variant="light" color="blue" mb="md"><IconSearch size={22} /></ThemeIcon>
                      <Text fw={600} mb="xs">Emsal Karar</Text>
                      <Text size="sm" c="dimmed" mb="md">KİK kararları</Text>
                      <Button variant="light" color="blue" onClick={() => { setActiveTab('uzman'); setInputMessage('Bu ihale konusunda benzer KİK kararlarını araştır.'); }}>Araştır</Button>
                    </Card>
                  </SimpleGrid>
                </Tabs.Panel>
              </Tabs>
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      {/* Form Modal */}
      <Modal opened={formModalOpened} onClose={closeFormModal} title={<Group gap="sm"><ThemeIcon size="md" radius="md" variant="light" color="violet">{editingId ? <IconEdit size={16} /> : <IconPlus size={16} />}</ThemeIcon><Text fw={600}>{editingId ? 'İhale Düzenle' : 'Yeni İhale Sonucu'}</Text></Group>} size="lg" centered>
        <Stack gap="md">
          <TextInput label="İhale Başlığı" placeholder="Malzemeli Yemek Alımı" value={formData.ihale_basligi} onChange={(e) => setFormData(prev => ({ ...prev, ihale_basligi: e.target.value }))} required />
          <TextInput label="Kurum" placeholder="... Belediyesi" value={formData.kurum} onChange={(e) => setFormData(prev => ({ ...prev, kurum: e.target.value }))} required />
          <SimpleGrid cols={2}>
            <NumberInput label="Yaklaşık Maliyet (TL)" value={formData.yaklasik_maliyet || ''} onChange={(val) => setFormData(prev => ({ ...prev, yaklasik_maliyet: Number(val) || undefined }))} thousandSeparator="." decimalSeparator="," min={0} />
            <NumberInput label="Sınır Değer (TL)" value={formData.sinir_deger || ''} onChange={(val) => setFormData(prev => ({ ...prev, sinir_deger: Number(val) || undefined }))} thousandSeparator="." decimalSeparator="," min={0} />
          </SimpleGrid>
          <SimpleGrid cols={2}>
            <NumberInput label="Bizim Teklif (TL)" value={formData.bizim_teklif || ''} onChange={(val) => setFormData(prev => ({ ...prev, bizim_teklif: Number(val) || undefined }))} thousandSeparator="." decimalSeparator="," min={0} />
            <TextInput label="Kesinleşme Tarihi" type="date" value={formData.kesinlesme_tarihi || ''} onChange={(e) => setFormData(prev => ({ ...prev, kesinlesme_tarihi: e.target.value }))} />
          </SimpleGrid>
          <Select label="Durum" value={formData.durum} onChange={(val) => setFormData(prev => ({ ...prev, durum: val as IhaleSonucDurum || 'beklemede' }))} data={Object.entries(durumConfig).map(([key, val]) => ({ value: key, label: `${val.icon} ${val.label}` }))} />
          <Textarea label="Notlar" value={formData.notlar} onChange={(e) => setFormData(prev => ({ ...prev, notlar: e.target.value }))} minRows={2} />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeFormModal}>İptal</Button>
            <Button color="violet" leftSection={editingId ? <IconCheck size={16} /> : <IconPlus size={16} />} onClick={handleFormSubmit}>{editingId ? 'Güncelle' : 'Ekle'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Rakip Teklif Modal */}
      <Modal opened={rakipTeklifModalOpened} onClose={closeRakipTeklifModal} title="Rakip Teklif Ekle" centered>
        <Stack gap="md">
          <TextInput label="Firma Adı" placeholder="ABC Gıda Ltd." value={rakipTeklifForm.firma} onChange={(e) => setRakipTeklifForm(prev => ({ ...prev, firma: e.target.value }))} required />
          <NumberInput label="Teklif Tutarı (TL)" value={rakipTeklifForm.teklif || ''} onChange={(val) => setRakipTeklifForm(prev => ({ ...prev, teklif: Number(val) || 0 }))} thousandSeparator="." decimalSeparator="," min={0} required />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeRakipTeklifModal}>İptal</Button>
            <Button color="green" leftSection={<IconPlus size={16} />} onClick={handleAddRakipTeklif}>Ekle</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Sınır Değer Hesaplama Modal */}
      <Modal opened={sinirDegerModalOpened} onClose={closeSinirDegerModal} title={<Group gap="sm"><ThemeIcon size="md" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'blue' }}><IconMathFunction size={16} /></ThemeIcon><Text fw={600}>Sınır Değer Hesaplama</Text></Group>} size="md" centered>
        <Stack gap="md">
          {selectedIhale?.yaklasik_maliyet && (
            <Alert icon={<IconCoin size={16} />} color="blue" variant="light">
              <Group justify="space-between"><Text size="sm">Yaklaşık Maliyet:</Text><Text size="sm" fw={700}>{Number(selectedIhale.yaklasik_maliyet).toLocaleString('tr-TR')} TL</Text></Group>
            </Alert>
          )}
          <div>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>Teklif Listesi</Text>
              <Button size="xs" variant="light" color="green" leftSection={<IconPlus size={14} />} onClick={() => setTeklifListesi(prev => [...prev, 0])}>Ekle</Button>
            </Group>
            <Stack gap="xs">
              {teklifListesi.map((teklif, index) => (
                <Group key={index} gap="xs">
                  <NumberInput placeholder={`${index + 1}. Teklif`} value={teklif || ''} onChange={(val) => setTeklifListesi(prev => prev.map((t, i) => i === index ? (Number(val) || 0) : t))} thousandSeparator="." decimalSeparator="," min={0} style={{ flex: 1 }} />
                  {teklifListesi.length > 2 && <ActionIcon variant="light" color="red" onClick={() => setTeklifListesi(prev => prev.filter((_, i) => i !== index))}><IconTrash size={16} /></ActionIcon>}
                </Group>
              ))}
            </Stack>
          </div>
          <Button fullWidth color="violet" size="md" leftSection={<IconCalculator size={18} />} onClick={() => selectedIhale?.yaklasik_maliyet && hesaplaSinirDeger(Number(selectedIhale.yaklasik_maliyet), teklifListesi)} disabled={teklifListesi.filter(t => t > 0).length < 2}>
            Hesapla
          </Button>
          {hesaplananSinirDeger && (
            <Paper p="md" radius="md" withBorder style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed">Hesaplanan Sınır Değer</Text>
                  <Text size="xl" fw={700} c="green">{hesaplananSinirDeger.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</Text>
                </div>
                <Button color="green" leftSection={<IconCheck size={16} />} onClick={() => { updateSelectedField('sinir_deger', Math.round(hesaplananSinirDeger)); closeSinirDegerModal(); }}>Kaydet</Button>
              </Group>
            </Paper>
          )}
        </Stack>
      </Modal>
    </Container>
  );
}
