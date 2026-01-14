'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  SimpleGrid,
  ThemeIcon,
  Badge,
  Button,
  Box,
  Table,
  ActionIcon,
  TextInput,
  Select,
  Modal,
  NumberInput,
  Textarea,
  Tabs,
  useMantineColorScheme,
  Paper,
  Menu,
  rem,
  Divider,
  Progress,
  PasswordInput,
  Checkbox,
  Loader,
  Alert,
  Tooltip,
  ScrollArea
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconFileInvoice,
  IconReceipt,
  IconClock,
  IconCheck,
  IconX,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconCalendar,
  IconDownload,
  IconPrinter,
  IconEye,
  IconAlertTriangle,
  IconSend,
  IconRefresh,
  IconPlugConnected,
  IconPlugConnectedX,
  IconCloudDownload,
  IconInfoCircle,
  IconReload,
  IconAlertCircle,
  IconPackage
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import 'dayjs/locale/tr';
import { invoiceAPI, uyumsoftAPI, convertToFrontendFormat, convertToAPIFormat } from '@/lib/invoice-api';
import { DataActions } from '@/components/DataActions';

// API URL
const API_URL = `${API_BASE_URL}/api`;

// Tip tanımları
interface FaturaKalem {
  id: string;
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  kdvOrani: number;
  tutar: number;
}

interface Fatura {
  id: string;
  tip: 'satis' | 'alis';
  seri: string;
  no: string;
  cariId: string;
  cariUnvan: string;
  tarih: string;
  vadeTarihi: string;
  kalemler: FaturaKalem[];
  araToplam: number;
  kdvToplam: number;
  genelToplam: number;
  durum: 'taslak' | 'gonderildi' | 'odendi' | 'gecikti' | 'iptal';
  notlar: string;
  createdAt: string;
  // Uyumsoft faturaları için ek alanlar
  ettn?: string;
  gonderenVkn?: string;
  gonderenEmail?: string;
  kaynak?: 'manuel' | 'uyumsoft';
}

interface UyumsoftFatura {
  faturaNo: string;
  ettn: string;
  faturaTarihi: string;
  olusturmaTarihi: string;
  gonderenVkn: string;
  gonderenUnvan: string;
  gonderenEmail?: string;
  odenecekTutar: number;
  vergilerHaricTutar: number;
  kdvTutari: number;
  paraBirimi: string;
  durum: string;
  faturaTipi: string;
  isNew?: boolean;
  isSeen?: boolean;
  stokIslendi?: boolean;
  stokIslemTarihi?: string;
}

interface UyumsoftStatus {
  connected: boolean;
  hasCredentials: boolean;
  lastSync: string | null;
  syncCount: number;
}

const STORAGE_KEY = 'muhasebe_faturalar';
const UYUMSOFT_FATURALAR_KEY = 'uyumsoft_faturalar';

// Cari tipi
interface Cari {
  id: number;
  unvan: string;
  tip: 'musteri' | 'tedarikci' | 'her_ikisi';
}

// Demo faturalar
const demoFaturalar: Fatura[] = [
  {
    id: '1', tip: 'satis', seri: 'A', no: '2026-001', cariId: '1', cariUnvan: 'Metro Holding A.Ş.',
    tarih: '2026-01-02', vadeTarihi: '2026-02-02',
    kalemler: [
      { id: '1', aciklama: 'Ocak Ayı Yemek Hizmeti', miktar: 1, birim: 'Ay', birimFiyat: 45000, kdvOrani: 10, tutar: 45000 }
    ],
    araToplam: 45000, kdvToplam: 4500, genelToplam: 49500,
    durum: 'gonderildi', notlar: '', createdAt: new Date().toISOString(), kaynak: 'manuel'
  },
];

const birimler = ['Adet', 'Kg', 'Lt', 'Metre', 'Paket', 'Koli', 'Porsiyon', 'Gün', 'Ay', 'Saat', 'Parti'];
const kdvOranlari = [0, 1, 10, 20];

export default function FaturalarPage() {
  const router = useRouter();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [opened, { open, close }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [connectOpened, { open: openConnect, close: closeConnect }] = useDisclosure(false);
  const [uyumsoftDetailOpened, { open: openUyumsoftDetail, close: closeUyumsoftDetail }] = useDisclosure(false);
  const [selectedUyumsoftFatura, setSelectedUyumsoftFatura] = useState<UyumsoftFatura | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [faturaDetail, setFaturaDetail] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [searchTerm, setSearchTerm] = useState('');
  const [faturalar, setFaturalar] = useState<Fatura[]>([]);
  const [uyumsoftFaturalar, setUyumsoftFaturalar] = useState<UyumsoftFatura[]>([]);
  const [selectedFatura, setSelectedFatura] = useState<Fatura | null>(null);
  const [editingItem, setEditingItem] = useState<Fatura | null>(null);

  // Uyumsoft states
  const [uyumsoftStatus, setUyumsoftStatus] = useState<UyumsoftStatus>({
    connected: false,
    hasCredentials: false,
    lastSync: null,
    syncCount: 0
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '', remember: true });
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  
  // Loading ve Error state'leri
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [isLoadingUyumsoft, setIsLoadingUyumsoft] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uyumsoftError, setUyumsoftError] = useState<string | null>(null);
  
  // Cariler state'i - API'den gelecek
  const [cariler, setCariler] = useState<Cari[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    tip: 'satis' as 'satis' | 'alis',
    seri: 'A',
    no: '',
    cariId: '',
    cariUnvan: '',
    tarih: new Date(),
    vadeTarihi: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    durum: 'taslak' as Fatura['durum'],
    notlar: ''
  });

  const [kalemler, setKalemler] = useState<FaturaKalem[]>([
    { id: '1', aciklama: '', miktar: 1, birim: 'Adet', birimFiyat: 0, kdvOrani: 10, tutar: 0 }
  ]);

  // API'den faturaları yükle
  useEffect(() => {
    loadInvoices();
    loadUyumsoftInvoices();
    loadCariler();
    checkUyumsoftStatus();
    }, []);

  // Carileri yükle
  const loadCariler = async () => {
    try {
      const response = await fetch(`${API_URL}/cariler`);
      if (!response.ok) throw new Error('Cariler yüklenemedi');
      const result = await response.json();
      setCariler(result.data || []);
    } catch (error) {
      console.error('Cariler yükleme hatası:', error);
    }
  };

  // Manuel faturaları yükle
  const loadInvoices = async () => {
    setIsLoadingInvoices(true);
    setLoadError(null);
    try {
      const result = await invoiceAPI.list({ limit: 250 });
      if (result.success && result.data && result.data.length > 0) {
        const formattedInvoices = result.data.map((inv: any) => convertToFrontendFormat(inv));
        setFaturalar(formattedInvoices);
      } else {
        // API'den veri gelmezse demo faturaları göster
        console.log('API\'den fatura gelmedi, demo faturalar gösteriliyor');
        setFaturalar(demoFaturalar);
      }
    } catch (error: any) {
      console.error('Faturalar yüklenemedi:', error);
      const errorMessage = error.message || 'Faturalar yüklenirken bir hata oluştu';
      setLoadError(errorMessage);
      // Hata durumunda demo faturaları göster
      console.log('API hatası, demo faturalar gösteriliyor');
      setFaturalar(demoFaturalar);
      notifications.show({
        title: 'Bilgi',
        message: 'Demo veriler gösteriliyor',
        color: 'blue'
      });
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Uyumsoft faturalarını yükle  
  const loadUyumsoftInvoices = async () => {
    setIsLoadingUyumsoft(true);
    setUyumsoftError(null);
    try {
      // Limit 250 olarak ayarlı
      const result = await uyumsoftAPI.getInvoices({ limit: 250 });
      if (result.success && result.data) {
        setUyumsoftFaturalar(result.data);
      }
    } catch (error: any) {
      console.error('Uyumsoft faturaları yüklenemedi:', error);
      setUyumsoftError(error.message || 'Uyumsoft faturaları yüklenemedi');
    } finally {
      setIsLoadingUyumsoft(false);
    }
  };

  // Uyumsoft durumunu kontrol et
  const checkUyumsoftStatus = async () => {
    try {
      const data = await uyumsoftAPI.status();
      setUyumsoftStatus(data);
    } catch (error) {
      console.error('Uyumsoft status check failed:', error);
    }
  };

  // Uyumsoft'a bağlan
  const handleConnect = async () => {
    if (!credentials.username || !credentials.password) {
      notifications.show({ title: 'Hata!', message: 'Kullanıcı adı ve şifre gerekli', color: 'red' });
      return;
    }

    setIsConnecting(true);
    try {
      const data = await uyumsoftAPI.connect(
        credentials.username,
        credentials.password,
        credentials.remember
      );
      
      if (data.success) {
        notifications.show({ title: 'Başarılı!', message: 'Uyumsoft\'a bağlandı', color: 'green', icon: <IconCheck size={16} /> });
        setUyumsoftStatus(prev => ({ ...prev, connected: true, hasCredentials: credentials.remember }));
        closeConnect();
      } else {
        notifications.show({ title: 'Bağlantı Hatası', message: data.error || 'Bağlantı başarısız', color: 'red' });
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata!', message: error.message, color: 'red' });
    } finally {
      setIsConnecting(false);
    }
  };

  // Kayıtlı bilgilerle bağlan
  const handleConnectSaved = async () => {
    setIsConnecting(true);
    try {
      const data = await uyumsoftAPI.connectSaved();
      if (data.success) {
        notifications.show({ title: 'Başarılı!', message: 'Uyumsoft\'a bağlandı', color: 'green', icon: <IconCheck size={16} /> });
        setUyumsoftStatus(prev => ({ ...prev, connected: true }));
      } else {
        notifications.show({ title: 'Bağlantı Hatası', message: data.error || 'Bağlantı başarısız', color: 'red' });
        openConnect();
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata!', message: error.message, color: 'red' });
      openConnect();
    } finally {
      setIsConnecting(false);
    }
  };

  // Bağlantıyı kes
  const handleDisconnect = async () => {
    try {
      await uyumsoftAPI.disconnect();
      setUyumsoftStatus(prev => ({ ...prev, connected: false }));
      notifications.show({ title: 'Bilgi', message: 'Bağlantı kesildi', color: 'blue' });
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  // Faturaları senkronize et
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncMessage('Faturalar çekiliyor ve veritabanına kaydediliyor...');

    try {
      const data = await uyumsoftAPI.sync(3, 1000);
      
      if (data.success && data.data) {
        // Frontend için formatlanmış veriyi kullan
        setUyumsoftFaturalar(data.data);
        
        // Başarı mesajını göster - veritabanına kayıt bilgisini de ekle
        const dbMessage = data.savedToDb ? ` (${data.savedToDb} tanesi veritabanına kaydedildi)` : '';
        
        notifications.show({
          title: 'Senkronizasyon Tamamlandı!',
          message: `${data.total} fatura başarıyla çekildi${dbMessage}`,
          color: 'green',
          icon: <IconCheck size={16} />
        });

        // Veritabanından güncel listeyi yükle
        await loadUyumsoftInvoices();
        
        // Status'u güncelle
        checkUyumsoftStatus();
      } else {
        notifications.show({
          title: 'Senkronizasyon Hatası',
          message: data.error || 'Faturalar çekilemedi',
          color: 'red'
        });
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata!', message: error.message, color: 'red' });
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
      setSyncMessage('');
    }
  };

  // API'ye kaydet (artık kullanılmıyor, direkt API çağrıları yapılıyor)
  const saveToStorage = (data: Fatura[]) => {
    // Artık localStorage kullanmıyoruz
    setFaturalar(data);
  };

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Tarih formatı
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // Uyumsoft formatı: "31.12.2025 17:46:18"
    if (dateStr.includes('.')) {
      const parts = dateStr.split(' ')[0].split('.');
      if (parts.length === 3) {
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
    }
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  // Filtreleme - Manuel faturalar
  const filteredFaturalar = faturalar.filter(f => {
    const matchesTab = activeTab === 'tumu' || activeTab === 'manuel' ||
                      (activeTab === 'satis' && f.tip === 'satis') ||
                      (activeTab === 'alis' && f.tip === 'alis') ||
                      (activeTab === 'bekleyen' && (f.durum === 'gonderildi' || f.durum === 'gecikti'));
    const matchesSearch = f.cariUnvan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${f.seri}${f.no}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  }).sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

  // Filtreleme - Uyumsoft faturalar
  const filteredUyumsoftFaturalar = uyumsoftFaturalar.filter(f => {
    // Tab filtreleme
    const matchesTab = activeTab === 'tumu' || 
                       activeTab === 'uyumsoft' ||
                       (activeTab === 'alis' && f.faturaTipi === 'gelen'); // Uyumsoft faturaları genelde alış (gelen) faturasıdır
    
    const matchesSearch = f.gonderenUnvan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         f.faturaNo.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Toplamlar
  const toplamSatis = faturalar.filter(f => f.tip === 'satis').reduce((acc, f) => acc + f.genelToplam, 0);
  const toplamAlis = faturalar.filter(f => f.tip === 'alis').reduce((acc, f) => acc + f.genelToplam, 0);
  const uyumsoftToplam = uyumsoftFaturalar.reduce((acc, f) => acc + f.odenecekTutar, 0);
  const bekleyenToplam = faturalar.filter(f => f.durum === 'gonderildi' || f.durum === 'gecikti').reduce((acc, f) => acc + f.genelToplam, 0);

  // Kalem hesaplama
  const hesaplaKalem = (kalem: FaturaKalem): FaturaKalem => {
    const tutar = kalem.miktar * kalem.birimFiyat;
    return { ...kalem, tutar };
  };

  // Kalem ekle
  const addKalem = () => {
    setKalemler([...kalemler, { 
      id: Date.now().toString(), 
      aciklama: '', 
      miktar: 1, 
      birim: 'Adet', 
      birimFiyat: 0, 
      kdvOrani: 10, 
      tutar: 0 
    }]);
  };

  // Kalem sil
  const removeKalem = (id: string) => {
    if (kalemler.length > 1) {
      setKalemler(kalemler.filter(k => k.id !== id));
    }
  };

  // Kalem güncelle
  const updateKalem = (id: string, field: string, value: any) => {
    // Validasyon kontrolleri
    if (field === 'miktar' && value < 0) {
      notifications.show({ 
        title: 'Uyarı', 
        message: 'Miktar negatif olamaz', 
        color: 'orange' 
      });
      return;
    }
    
    if (field === 'birimFiyat' && value < 0) {
      notifications.show({ 
        title: 'Uyarı', 
        message: 'Birim fiyat negatif olamaz', 
        color: 'orange' 
      });
      return;
    }
    
    if (field === 'kdvOrani' && (value < 0 || value > 100)) {
      notifications.show({ 
        title: 'Uyarı', 
        message: 'KDV oranı 0-100 arasında olmalıdır', 
        color: 'orange' 
      });
      return;
    }

    setKalemler(kalemler.map(k => {
      if (k.id === id) {
        const updated = { ...k, [field]: value };
        return hesaplaKalem(updated);
      }
      return k;
    }));
  };

  // Toplamları hesapla
  const araToplam = kalemler.reduce((acc, k) => acc + k.tutar, 0);
  const kdvToplam = kalemler.reduce((acc, k) => acc + (k.tutar * k.kdvOrani / 100), 0);
  const genelToplam = araToplam + kdvToplam;

  // Form Validasyon Fonksiyonları
  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validatePhone = (phone: string) => {
    const regex = /^[0-9\s\-\+\(\)]+$/;
    return !phone || regex.test(phone);
  };

  const validateVKN = (vkn: string) => {
    return !vkn || (vkn.length === 10 || vkn.length === 11);
  };

  const validateForm = () => {
    const errors: string[] = [];

    // Zorunlu alan kontrolleri
    if (!formData.cariId && !formData.cariUnvan) {
      errors.push('Cari seçimi veya cari ünvanı zorunludur');
    }

    if (!formData.seri || formData.seri.trim().length === 0) {
      errors.push('Fatura serisi boş olamaz');
    }

    // Tarih kontrolleri
    if (formData.vadeTarihi < formData.tarih) {
      errors.push('Vade tarihi fatura tarihinden önce olamaz');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 1);
    
    if (formData.tarih > futureLimit) {
      errors.push('Fatura tarihi 1 yıldan fazla ileri tarihli olamaz');
    }

    // Kalem kontrolleri
    if (kalemler.length === 0) {
      errors.push('En az bir fatura kalemi olmalıdır');
    }

    kalemler.forEach((kalem, index) => {
      if (!kalem.aciklama || kalem.aciklama.trim().length === 0) {
        errors.push(`${index + 1}. kalem açıklaması boş olamaz`);
      }
      if (kalem.miktar <= 0) {
        errors.push(`${index + 1}. kalem miktarı 0'dan büyük olmalıdır`);
      }
      if (kalem.birimFiyat < 0) {
        errors.push(`${index + 1}. kalem birim fiyatı negatif olamaz`);
      }
      if (kalem.kdvOrani < 0 || kalem.kdvOrani > 100) {
        errors.push(`${index + 1}. kalem KDV oranı 0-100 arasında olmalıdır`);
      }
    });

    // Tutar kontrolleri
    if (genelToplam <= 0 && formData.durum !== 'iptal') {
      errors.push('Fatura toplamı 0 veya negatif olamaz');
    }

    if (genelToplam > 10000000) {
      errors.push('Fatura toplamı 10.000.000 TL\'yi aşamaz');
    }

    return errors;
  };

  // Kaydet
  const handleSubmit = async () => {
    // Validasyon kontrolleri
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      notifications.show({ 
        title: 'Form Hatası!', 
        message: validationErrors[0], // İlk hatayı göster
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
      
      // Tüm hataları console'a yaz
      console.error('Form validasyon hataları:', validationErrors);
      return;
    }

    const cari = cariler.find(c => String(c.id) === formData.cariId);
    
    // Ek validasyonlar - email ve telefon (eğer girilmişse)
    if (formData.cariUnvan && formData.cariUnvan.includes('@') && !validateEmail(formData.cariUnvan)) {
      notifications.show({ 
        title: 'Hata!', 
        message: 'Geçersiz e-posta formatı', 
        color: 'red' 
      });
      return;
    }

    const newFatura: Fatura = {
      id: editingItem?.id || Date.now().toString(),
      tip: formData.tip,
      seri: formData.seri,
      no: formData.no || `${new Date().getFullYear()}-${String(faturalar.length + 1).padStart(3, '0')}`,
      cariId: formData.cariId,
      cariUnvan: cari?.unvan || formData.cariUnvan,
      tarih: formData.tarih.toISOString().split('T')[0],
      vadeTarihi: formData.vadeTarihi.toISOString().split('T')[0],
      kalemler: kalemler,
      araToplam,
      kdvToplam,
      genelToplam,
      durum: formData.durum,
      notlar: formData.notlar,
      createdAt: editingItem?.createdAt || new Date().toISOString(),
      kaynak: 'manuel'
    };

    try {
      // API formatına dönüştür
      const apiInvoice = convertToAPIFormat(newFatura);
      
      let result;
      if (editingItem) {
        // Güncelleme
        result = await invoiceAPI.update(parseInt(editingItem.id), apiInvoice);
      } else {
        // Yeni kayıt
        result = await invoiceAPI.create(apiInvoice);
      }

      if (result.success) {
        notifications.show({ 
          title: 'Başarılı!', 
          message: 'Fatura veritabanına kaydedildi.', 
          color: 'green', 
          icon: <IconCheck size={16} /> 
        });
        
        // Listeyi yenile
        await loadInvoices();
        resetForm();
        close();
      }
    } catch (error: any) {
      notifications.show({ 
        title: 'Hata!', 
        message: error.message || 'Fatura kaydedilemedi', 
        color: 'red' 
      });
    }
  };

  // Durum güncelle
  const updateDurum = async (id: string, durum: Fatura['durum']) => {
    try {
      // Türkçe durumu İngilizce'ye çevir
      const statusMap: Record<string, 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'> = {
        'taslak': 'draft',
        'gonderildi': 'sent',
        'odendi': 'paid',
        'gecikti': 'overdue',
        'iptal': 'cancelled'
      };
      
      const apiStatus = statusMap[durum];
      const result = await invoiceAPI.updateStatus(parseInt(id), apiStatus);
      if (result.success) {
        notifications.show({ title: 'Güncellendi', message: 'Fatura durumu değiştirildi.', color: 'blue' });
        await loadInvoices(); // Listeyi yenile
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata!', message: error.message, color: 'red' });
    }
  };

  // Silme
  const handleDelete = async (id: string) => {
    if (!confirm('Bu faturayı silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const result = await invoiceAPI.delete(parseInt(id));
      if (result.success) {
        notifications.show({ title: 'Silindi', message: 'Fatura silindi.', color: 'orange' });
        await loadInvoices();
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata!', message: error.message, color: 'red' });
    }
  };

  // Detay görüntüle
  const handleViewDetail = (fatura: Fatura) => {
    setSelectedFatura(fatura);
    openDetail();
  };

  // Uyumsoft fatura detay görüntüle - API'den detay çeker
  const handleViewUyumsoftDetail = async (fatura: UyumsoftFatura) => {
    setSelectedUyumsoftFatura(fatura);
    setFaturaDetail(null);
    openUyumsoftDetail();
    
    // Fatura detayını API'den çek (HTML görünümü)
    setIsLoadingDetail(true);
    try {
      const data = await uyumsoftAPI.getInvoiceDetail(fatura.ettn);
      if (data.success && data.html) {
        setFaturaDetail({ html: data.html, isVerified: data.isVerified });
        notifications.show({ 
          title: 'Fatura Yüklendi', 
          message: data.isVerified ? 'E-imza doğrulandı ✓' : 'Fatura görüntüleniyor',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        notifications.show({ 
          title: 'Detay Bulunamadı', 
          message: data.error || 'Fatura detayı çekilemedi.',
          color: 'orange',
          icon: <IconInfoCircle size={16} />
        });
      }
    } catch (error: any) {
      notifications.show({ 
        title: 'Hata', 
        message: error.message || 'Detay çekilemedi',
        color: 'red'
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Form sıfırla
  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      tip: 'satis',
      seri: 'A',
      no: '',
      cariId: '',
      cariUnvan: '',
      tarih: new Date(),
      vadeTarihi: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      durum: 'taslak',
      notlar: ''
    });
    setKalemler([{ id: '1', aciklama: '', miktar: 1, birim: 'Adet', birimFiyat: 0, kdvOrani: 10, tutar: 0 }]);
  };

  // Durum badge
  const getDurumBadge = (durum: string) => {
    const config: Record<string, { color: string; icon: any; label: string }> = {
      taslak: { color: 'gray', icon: IconClock, label: 'Taslak' },
      gonderildi: { color: 'blue', icon: IconSend, label: 'Gönderildi' },
      odendi: { color: 'green', icon: IconCheck, label: 'Ödendi' },
      gecikti: { color: 'red', icon: IconAlertTriangle, label: 'Gecikti' },
      iptal: { color: 'dark', icon: IconX, label: 'İptal' },
    };
    const { color, icon: Icon, label } = config[durum] || config.taslak;
    return <Badge color={color} variant="light" leftSection={<Icon size={12} />}>{label}</Badge>;
  };

  // Kalan gün
  const getKalanGun = (vadeTarihi: string) => {
    const vade = new Date(vadeTarihi);
    const today = new Date();
    const diff = Math.ceil((vade.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <Box 
      style={{ 
        background: isDark 
          ? 'linear-gradient(180deg, rgba(139,92,246,0.05) 0%, rgba(0,0,0,0) 100%)' 
          : 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh' 
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Box>
              <Title order={1} fw={700}>🧾 Faturalar</Title>
              <Text c="dimmed" size="lg">Satış ve alış faturalarınızı yönetin</Text>
            </Box>
            <Group>
              {/* Uyumsoft Bağlantı Durumu */}
              <Paper withBorder p="sm" radius="md" style={{ minWidth: 200 }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <ThemeIcon 
                      color={uyumsoftStatus.connected ? 'green' : 'gray'} 
                      variant="light" 
                      size="sm"
                    >
                      {uyumsoftStatus.connected ? <IconPlugConnected size={14} /> : <IconPlugConnectedX size={14} />}
                    </ThemeIcon>
                    <Text size="xs" fw={600}>Uyumsoft</Text>
                  </Group>
                  <Badge 
                    color={uyumsoftStatus.connected ? 'green' : 'gray'} 
                    variant="light" 
                    size="xs"
                  >
                    {uyumsoftStatus.connected ? 'Bağlı' : 'Bağlı Değil'}
                  </Badge>
                </Group>
                
                {uyumsoftStatus.lastSync && (
                  <Text size="xs" c="dimmed" mb="xs">
                    Son sync: {new Date(uyumsoftStatus.lastSync).toLocaleString('tr-TR')}
                  </Text>
                )}

                <Group gap="xs">
                  {!uyumsoftStatus.connected ? (
                    uyumsoftStatus.hasCredentials ? (
                      <Button 
                        size="xs" 
                        variant="light" 
                        color="violet"
                        leftSection={<IconPlugConnected size={14} />}
                        onClick={handleConnectSaved}
                        loading={isConnecting}
                        fullWidth
                      >
                        Bağlan
                      </Button>
                    ) : (
                      <Button 
                        size="xs" 
                        variant="light" 
                        color="violet"
                        leftSection={<IconPlugConnected size={14} />}
                        onClick={openConnect}
                        fullWidth
                      >
                        Giriş Yap
                      </Button>
                    )
                  ) : (
                    <>
                      <Tooltip label="Faturaları Senkronize Et">
                        <Button 
                          size="xs" 
                          variant="light" 
                          color="blue"
                          leftSection={<IconRefresh size={14} />}
                          onClick={handleSync}
                          loading={isSyncing}
                        >
                          Sync
                        </Button>
                      </Tooltip>
                      <Tooltip label="Bağlantıyı Kes">
                        <ActionIcon 
                          variant="light" 
                          color="red" 
                          size="md"
                          onClick={handleDisconnect}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </>
                  )}
                </Group>
              </Paper>

              <Button leftSection={<IconPlus size={18} />} variant="gradient" gradient={{ from: 'violet', to: 'grape' }} onClick={() => { resetForm(); open(); }}>
                Yeni Fatura
              </Button>
              <DataActions 
                type="fatura" 
                onImportSuccess={() => loadInvoices()} 
              />
            </Group>
          </Group>

          {/* Sync Progress */}
          {isSyncing && (
            <Alert icon={<Loader size={20} />} color="blue" variant="light">
              <Group justify="space-between">
                <Text size="sm">{syncMessage || 'Faturalar senkronize ediliyor...'}</Text>
              </Group>
              <Progress value={syncProgress} size="sm" mt="xs" animated />
            </Alert>
          )}

          {/* Stats Cards */}
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Satış Faturaları</Text>
                <ThemeIcon color="green" variant="light" size="lg" radius="md"><IconReceipt size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="green">{formatMoney(toplamSatis)}</Text>
              <Text size="xs" c="dimmed">{faturalar.filter(f => f.tip === 'satis').length} fatura</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Alış Faturaları</Text>
                <ThemeIcon color="orange" variant="light" size="lg" radius="md"><IconFileInvoice size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="orange">{formatMoney(toplamAlis)}</Text>
              <Text size="xs" c="dimmed">{faturalar.filter(f => f.tip === 'alis').length} fatura</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Uyumsoft Gelen</Text>
                <ThemeIcon color="violet" variant="light" size="lg" radius="md"><IconCloudDownload size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="violet">{formatMoney(uyumsoftToplam)}</Text>
              <Text size="xs" c="dimmed">{uyumsoftFaturalar.length} fatura</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Bekleyen Tahsilat</Text>
                <ThemeIcon color="blue" variant="light" size="lg" radius="md"><IconClock size={20} /></ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="md" c="blue">{formatMoney(bekleyenToplam)}</Text>
            </Card>
          </SimpleGrid>

          {/* Filters & Table */}
          <Card withBorder shadow="sm" p={{ base: 'sm', sm: 'lg' }} radius="md">
            <Stack gap="md" mb="md">
              {/* Tabs with horizontal scroll on mobile */}
              <ScrollArea type="scroll" offsetScrollbars scrollbarSize={4}>
                <Tabs value={activeTab} onChange={setActiveTab}>
                  <Tabs.List style={{ flexWrap: 'nowrap' }}>
                    <Tabs.Tab value="tumu">Tümü</Tabs.Tab>
                    <Tabs.Tab value="manuel">Manuel ({faturalar.length})</Tabs.Tab>
                    <Tabs.Tab value="uyumsoft" color="violet">
                      Uyumsoft ({uyumsoftFaturalar.length})
                    </Tabs.Tab>
                    <Tabs.Tab value="satis" color="green">Satış</Tabs.Tab>
                    <Tabs.Tab value="alis" color="orange">Alış</Tabs.Tab>
                  </Tabs.List>
                </Tabs>
              </ScrollArea>
              {/* Search - full width on mobile */}
              <TextInput 
                placeholder="Fatura ara..." 
                leftSection={<IconSearch size={16} />} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.currentTarget.value)} 
                style={{ maxWidth: isMobile ? '100%' : 250 }} 
              />
            </Stack>

            {/* Tümü Sekmesi - Manuel + Uyumsoft Birleşik */}
            {activeTab === 'tumu' ? (
              <Table.ScrollContainer minWidth={800}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Fatura No</Table.Th>
                      <Table.Th>Cari / Gönderen</Table.Th>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Vade</Table.Th>
                      <Table.Th>Kaynak</Table.Th>
                      <Table.Th>Durum</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                      <Table.Th style={{ textAlign: 'center', width: 80 }}>İşlem</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {/* Manuel Faturalar */}
                    {filteredFaturalar.map((fatura) => {
                      const kalanGun = getKalanGun(fatura.vadeTarihi);
                      return (
                        <Table.Tr key={`manuel-${fatura.id}`}>
                          <Table.Td>
                            <Group gap="xs">
                              <Badge color={fatura.tip === 'satis' ? 'green' : 'orange'} variant="light" size="xs">
                                {fatura.tip === 'satis' ? 'S' : 'A'}
                              </Badge>
                              <Text size="sm" fw={500}>{fatura.seri}{fatura.no}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td><Text size="sm">{fatura.cariUnvan}</Text></Table.Td>
                          <Table.Td><Text size="sm" c="dimmed">{formatDate(fatura.tarih)}</Text></Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">{formatDate(fatura.vadeTarihi)}</Text>
                            {fatura.durum !== 'odendi' && fatura.durum !== 'iptal' && (
                              <Text size="xs" c={kalanGun < 0 ? 'red' : kalanGun < 7 ? 'orange' : 'dimmed'}>
                                {kalanGun < 0 ? `${Math.abs(kalanGun)} gün gecikti` : `${kalanGun} gün kaldı`}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="gray">Manuel</Badge>
                          </Table.Td>
                          <Table.Td>{getDurumBadge(fatura.durum)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm" fw={600} c={fatura.tip === 'satis' ? 'green' : 'orange'}>
                              {formatMoney(fatura.genelToplam)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Menu position="bottom-end" shadow="md">
                              <Menu.Target>
                                <ActionIcon variant="subtle" color="gray"><IconDotsVertical size={16} /></ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item leftSection={<IconEye style={{ width: rem(14), height: rem(14) }} />} onClick={() => handleViewDetail(fatura)}>Görüntüle</Menu.Item>
                                <Menu.Divider />
                                <Menu.Label>Durum Değiştir</Menu.Label>
                                <Menu.Item leftSection={<IconSend style={{ width: rem(14), height: rem(14) }} />} onClick={() => updateDurum(fatura.id, 'gonderildi')}>Gönderildi</Menu.Item>
                                <Menu.Item leftSection={<IconCheck style={{ width: rem(14), height: rem(14) }} />} color="green" onClick={() => updateDurum(fatura.id, 'odendi')}>Ödendi</Menu.Item>
                                <Menu.Item leftSection={<IconX style={{ width: rem(14), height: rem(14) }} />} onClick={() => updateDurum(fatura.id, 'iptal')}>İptal</Menu.Item>
                                <Menu.Divider />
                                <Menu.Item color="red" leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />} onClick={() => handleDelete(fatura.id)}>Sil</Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                    
                    {/* Uyumsoft Faturalar */}
                    {filteredUyumsoftFaturalar.map((fatura) => (
                      <Table.Tr key={`uyumsoft-${fatura.ettn}`}>
                        <Table.Td>
                          <Group gap="xs">
                            <Badge color="violet" variant="light" size="xs">U</Badge>
                            <Text size="sm" fw={500}>{fatura.faturaNo}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td><Text size="sm">{fatura.gonderenUnvan}</Text></Table.Td>
                        <Table.Td><Text size="sm" c="dimmed">{formatDate(fatura.faturaTarihi)}</Text></Table.Td>
                        <Table.Td><Text size="sm" c="dimmed">-</Text></Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Badge size="xs" variant="light" color="violet">Uyumsoft</Badge>
                            {fatura.stokIslendi && (
                              <Badge size="xs" variant="filled" color="green">Stok ✓</Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="blue" variant="light" size="xs">E-Fatura</Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600} c="violet">
                            {formatMoney(fatura.odenecekTutar)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray"><IconDotsVertical size={16} /></ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item leftSection={<IconEye style={{ width: rem(14), height: rem(14) }} />} onClick={() => handleViewUyumsoftDetail(fatura)}>Görüntüle</Menu.Item>
                              <Menu.Item leftSection={<IconDownload style={{ width: rem(14), height: rem(14) }} />} onClick={() => window.open(`${API_URL}/uyumsoft/invoice/${fatura.ettn}/pdf`, '_blank')}>PDF İndir</Menu.Item>
                              <Menu.Item leftSection={<IconPrinter style={{ width: rem(14), height: rem(14) }} />} onClick={() => {
                                const printWindow = window.open(`${API_URL}/uyumsoft/invoice/${fatura.ettn}/html`, '_blank');
                                if (printWindow) {
                                  printWindow.onload = () => {
                                    printWindow.print();
                                  };
                                }
                              }}>Yazdır</Menu.Item>
                              <Menu.Divider />
                              {fatura.stokIslendi ? (
                                <Menu.Item 
                                  leftSection={<IconCheck style={{ width: rem(14), height: rem(14) }} />} 
                                  color="green"
                                  disabled
                                >
                                  Stoğa İşlendi ✓
                                </Menu.Item>
                              ) : (
                                <Menu.Item 
                                  leftSection={<IconPackage style={{ width: rem(14), height: rem(14) }} />} 
                                  color="teal"
                                  onClick={() => router.push(`/muhasebe/stok?fatura=${fatura.ettn}`)}
                                >
                                  Stoğa İşle
                                </Menu.Item>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    
                    {/* Boş durum */}
                    {filteredFaturalar.length === 0 && filteredUyumsoftFaturalar.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={8}>
                          <Stack align="center" py="xl" gap="md">
                            <ThemeIcon color="gray" size={60} variant="light" radius="xl">
                              <IconFileInvoice size={30} />
                            </ThemeIcon>
                            <Text ta="center" c="dimmed">Henüz fatura bulunamadı</Text>
                            <Group>
                              <Button 
                                variant="light" 
                                leftSection={<IconPlus size={16} />}
                                onClick={() => { resetForm(); open(); }}
                              >
                                Manuel Fatura Ekle
                              </Button>
                              {!uyumsoftStatus.connected && (
                                <Button 
                                  variant="light" 
                                  color="violet"
                                  leftSection={<IconPlugConnected size={16} />}
                                  onClick={uyumsoftStatus.hasCredentials ? handleConnectSaved : openConnect}
                                >
                                  Uyumsoft Bağla
                                </Button>
                              )}
                            </Group>
                          </Stack>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : activeTab === 'uyumsoft' ? (
              /* Uyumsoft Faturaları - Geliştirilmiş Görünüm */
              <Stack gap="md">
                {/* Özet Bilgiler */}
                <SimpleGrid cols={4} mb="md">
                  <Paper p="md" radius="md" withBorder>
                    <Group justify="space-between">
                      <Stack gap={0}>
                        <Text size="xs" c="dimmed">Toplam Fatura</Text>
                        <Text size="xl" fw={700} c="violet">{uyumsoftFaturalar.length}</Text>
                      </Stack>
                      <ThemeIcon size="lg" radius="md" variant="light" color="violet">
                        <IconFileInvoice size={20} />
                      </ThemeIcon>
                    </Group>
                  </Paper>
                  
                  <Paper p="md" radius="md" withBorder>
                    <Group justify="space-between">
                      <Stack gap={0}>
                        <Text size="xs" c="dimmed">Toplam Tutar</Text>
                        <Text size="lg" fw={700} c="green">
                          {formatMoney(uyumsoftFaturalar.reduce((sum, f) => sum + (f.odenecekTutar || 0), 0))}
                        </Text>
                      </Stack>
                      <ThemeIcon size="lg" radius="md" variant="light" color="green">
                        <IconReceipt size={20} />
                      </ThemeIcon>
                    </Group>
                  </Paper>
                  
                  <Paper p="md" radius="md" withBorder>
                    <Group justify="space-between">
                      <Stack gap={0}>
                        <Text size="xs" c="dimmed">Yeni Fatura</Text>
                        <Text size="xl" fw={700} c="blue">
                          {uyumsoftFaturalar.filter(f => f.isNew).length}
                        </Text>
                      </Stack>
                      <Badge color="blue" size="lg" variant="light">YENİ</Badge>
                    </Group>
                  </Paper>
                  
                  <Paper p="md" radius="md" withBorder>
                    <Group justify="space-between">
                      <Stack gap={0}>
                        <Text size="xs" c="dimmed">Son Güncelleme</Text>
                        <Text size="sm" fw={500}>
                          {uyumsoftStatus.lastSync ? new Date(uyumsoftStatus.lastSync).toLocaleString('tr-TR') : 'Henüz yapılmadı'}
                        </Text>
                      </Stack>
                      <ThemeIcon size="lg" radius="md" variant="light" color="gray">
                        <IconClock size={20} />
                      </ThemeIcon>
                    </Group>
                  </Paper>
                </SimpleGrid>

                <ScrollArea h={500}>
                  <Table verticalSpacing="md" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 50 }}></Table.Th>
                        <Table.Th>Fatura Bilgileri</Table.Th>
                        <Table.Th>Gönderen Firma</Table.Th>
                        <Table.Th>Tarihler</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Tutarlar</Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>İşlemler</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {isLoadingUyumsoft ? (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Stack align="center" py="xl" gap="md">
                              <Loader size="lg" color="violet" />
                              <Text c="dimmed">Uyumsoft faturaları yükleniyor...</Text>
                            </Stack>
                          </Table.Td>
                        </Table.Tr>
                      ) : uyumsoftError ? (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Alert 
                              icon={<IconAlertCircle size={16} />} 
                              color="orange" 
                              variant="light"
                              title="Uyumsoft Yükleme Hatası"
                            >
                              <Stack gap="xs">
                                <Text size="sm">{uyumsoftError}</Text>
                                <Group gap="xs">
                                  <Button 
                                    size="xs" 
                                    variant="light" 
                                    color="orange"
                                    leftSection={<IconReload size={14} />}
                                    onClick={loadUyumsoftInvoices}
                                  >
                                    Tekrar Dene
                                  </Button>
                                  {uyumsoftStatus.connected && (
                                    <Button 
                                      size="xs" 
                                      variant="light" 
                                      color="blue"
                                      leftSection={<IconRefresh size={14} />}
                                      onClick={handleSync}
                                    >
                                      Yeniden Senkronize Et
                                    </Button>
                                  )}
                                </Group>
                              </Stack>
                            </Alert>
                          </Table.Td>
                        </Table.Tr>
                      ) : filteredUyumsoftFaturalar.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Stack align="center" py="xl" gap="md">
                              <ThemeIcon color="gray" size={60} variant="light" radius="xl">
                                <IconCloudDownload size={30} />
                              </ThemeIcon>
                              <Text ta="center" c="dimmed">
                                {uyumsoftStatus.connected 
                                  ? 'Henüz fatura çekilmedi. Sync butonuna tıklayın.'
                                  : 'Uyumsoft\'a bağlanarak faturaları çekebilirsiniz.'}
                              </Text>
                              {!uyumsoftStatus.connected && (
                                <Button 
                                  variant="light" 
                                  color="violet"
                                  leftSection={<IconPlugConnected size={16} />}
                                  onClick={uyumsoftStatus.hasCredentials ? handleConnectSaved : openConnect}
                                >
                                  {uyumsoftStatus.hasCredentials ? 'Bağlan' : 'Giriş Yap'}
                                </Button>
                              )}
                            </Stack>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        filteredUyumsoftFaturalar.map((fatura, index) => (
                          <Table.Tr key={fatura.ettn || index}>
                            <Table.Td>
                              <Text size="xs" c="dimmed">#{index + 1}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={4}>
                                <Group gap="xs">
                                  <Badge 
                                    size="sm" 
                                    variant="light" 
                                    color={fatura.faturaTipi === 'SATIŞ' ? 'green' : 'orange'}
                                  >
                                    {fatura.faturaTipi || 'FATURA'}
                                  </Badge>
                                  {fatura.isNew && (
                                    <Badge size="sm" color="blue" variant="dot">
                                      YENİ
                                    </Badge>
                                  )}
                                </Group>
                                <Text size="sm" fw={600}>{fatura.faturaNo || 'Numara Yok'}</Text>
                                <Group gap={4}>
                                  <Text size="xs" c="dimmed">ETTN:</Text>
                                  <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                                    {fatura.ettn?.substring(0, 8)}...
                                  </Text>
                                </Group>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="sm" fw={500} lineClamp={1}>
                                  {fatura.gonderenUnvan}
                                </Text>
                                <Group gap={4}>
                                  <Text size="xs" c="dimmed">VKN:</Text>
                                  <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                                    {fatura.gonderenVkn}
                                  </Text>
                                </Group>
                                {fatura.gonderenEmail && (
                                  <Text size="xs" c="dimmed" lineClamp={1}>
                                    {fatura.gonderenEmail}
                                  </Text>
                                )}
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Group gap={4}>
                                  <IconCalendar size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                                  <Text size="sm">{formatDate(fatura.faturaTarihi)}</Text>
                                </Group>
                                <Text size="xs" c="dimmed">
                                  Oluşturma: {formatDate(fatura.olusturmaTarihi)}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <Stack gap={2} align="flex-end">
                                <Text size="lg" fw={700} c="violet">
                                  {formatMoney(fatura.odenecekTutar)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Ara Toplam: {formatMoney(fatura.vergilerHaricTutar)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  KDV: {formatMoney(fatura.kdvTutari)}
                                </Text>
                                <Badge size="xs" variant="light" color="gray">
                                  {fatura.paraBirimi || 'TRY'}
                                </Badge>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs" justify="center">
                                <Tooltip label="Detayları Görüntüle">
                                  <ActionIcon 
                                    variant="light" 
                                    color="violet" 
                                    size="lg"
                                    onClick={() => handleViewUyumsoftDetail(fatura)}
                                  >
                                    <IconEye size={18} />
                                  </ActionIcon>
                                </Tooltip>
                                <Menu position="bottom-end" shadow="md">
                                  <Menu.Target>
                                    <ActionIcon variant="subtle" color="gray" size="lg">
                                      <IconDotsVertical size={18} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    <Menu.Item 
                                      leftSection={<IconDownload size={14} />}
                                      onClick={() => window.open(`${API_URL}/uyumsoft/invoice/${fatura.ettn}/pdf`, '_blank')}
                                    >
                                      PDF İndir
                                    </Menu.Item>
                                    <Menu.Item 
                                      leftSection={<IconDownload size={14} />}
                                      onClick={() => window.open(`${API_URL}/uyumsoft/invoice/${fatura.ettn}/xml`, '_blank')}
                                    >
                                      XML İndir
                                    </Menu.Item>
                                    <Menu.Divider />
                                    <Menu.Item 
                                      leftSection={<IconPrinter size={14} />}
                                      onClick={() => {
                                        const printWindow = window.open(`${API_URL}/uyumsoft/invoice/${fatura.ettn}/html`, '_blank');
                                        if (printWindow) {
                                          printWindow.onload = () => {
                                            printWindow.print();
                                          };
                                        }
                                      }}
                                    >
                                      Yazdır
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Stack>
            ) : activeTab === 'satis' || activeTab === 'alis' || activeTab === 'manuel' ? (
              /* Manuel, Satış ve Alış Faturaları */
              <Table.ScrollContainer minWidth={800}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Fatura No</Table.Th>
                      <Table.Th>Cari</Table.Th>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Vade</Table.Th>
                      <Table.Th>Durum</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                      <Table.Th style={{ textAlign: 'center', width: 80 }}>İşlem</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {isLoadingInvoices ? (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Stack align="center" py="xl" gap="md">
                            <Loader size="lg" color="violet" />
                            <Text c="dimmed">Faturalar yükleniyor...</Text>
                          </Stack>
                        </Table.Td>
                      </Table.Tr>
                    ) : loadError ? (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Alert 
                            icon={<IconAlertCircle size={16} />} 
                            color="red" 
                            variant="light"
                            title="Yükleme Hatası"
                          >
                            <Stack gap="xs">
                              <Text size="sm">{loadError}</Text>
                              <Button 
                                size="xs" 
                                variant="light" 
                                color="red"
                                leftSection={<IconReload size={14} />}
                                onClick={loadInvoices}
                              >
                                Tekrar Dene
                              </Button>
                            </Stack>
                          </Alert>
                        </Table.Td>
                      </Table.Tr>
                    ) : filteredFaturalar.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Stack align="center" py="xl" gap="md">
                            <ThemeIcon color="gray" size={60} variant="light" radius="xl">
                              <IconFileInvoice size={30} />
                            </ThemeIcon>
                            <Text ta="center" c="dimmed">Fatura bulunamadı</Text>
                            <Button 
                              variant="light" 
                              leftSection={<IconPlus size={16} />}
                              onClick={() => { resetForm(); open(); }}
                            >
                              İlk Faturanızı Ekleyin
                            </Button>
                          </Stack>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      filteredFaturalar.map((fatura) => {
                        const kalanGun = getKalanGun(fatura.vadeTarihi);
                        return (
                          <Table.Tr key={fatura.id}>
                            <Table.Td>
                              <Group gap="xs">
                                <Badge color={fatura.tip === 'satis' ? 'green' : 'orange'} variant="light" size="xs">
                                  {fatura.tip === 'satis' ? 'S' : 'A'}
                                </Badge>
                                <Text size="sm" fw={500}>{fatura.seri}{fatura.no}</Text>
                              </Group>
                            </Table.Td>
                            <Table.Td><Text size="sm">{fatura.cariUnvan}</Text></Table.Td>
                            <Table.Td><Text size="sm" c="dimmed">{formatDate(fatura.tarih)}</Text></Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">{formatDate(fatura.vadeTarihi)}</Text>
                              {fatura.durum !== 'odendi' && fatura.durum !== 'iptal' && (
                                <Text size="xs" c={kalanGun < 0 ? 'red' : kalanGun < 7 ? 'orange' : 'dimmed'}>
                                  {kalanGun < 0 ? `${Math.abs(kalanGun)} gün gecikti` : `${kalanGun} gün kaldı`}
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>{getDurumBadge(fatura.durum)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <Text size="sm" fw={600} c={fatura.tip === 'satis' ? 'green' : 'orange'}>
                                {formatMoney(fatura.genelToplam)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Menu position="bottom-end" shadow="md">
                                <Menu.Target>
                                  <ActionIcon variant="subtle" color="gray"><IconDotsVertical size={16} /></ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Item leftSection={<IconEye style={{ width: rem(14), height: rem(14) }} />} onClick={() => handleViewDetail(fatura)}>Görüntüle</Menu.Item>
                                  <Menu.Divider />
                                  <Menu.Label>Durum Değiştir</Menu.Label>
                                  <Menu.Item leftSection={<IconSend style={{ width: rem(14), height: rem(14) }} />} onClick={() => updateDurum(fatura.id, 'gonderildi')}>Gönderildi</Menu.Item>
                                  <Menu.Item leftSection={<IconCheck style={{ width: rem(14), height: rem(14) }} />} color="green" onClick={() => updateDurum(fatura.id, 'odendi')}>Ödendi</Menu.Item>
                                  <Menu.Item leftSection={<IconX style={{ width: rem(14), height: rem(14) }} />} onClick={() => updateDurum(fatura.id, 'iptal')}>İptal</Menu.Item>
                                  <Menu.Divider />
                                  <Menu.Item color="red" leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />} onClick={() => handleDelete(fatura.id)}>Sil</Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : null}
          </Card>
        </Stack>

        {/* Uyumsoft Bağlantı Modal */}
        <Modal opened={connectOpened} onClose={closeConnect} title="🔐 Uyumsoft Bağlantısı" size="sm" fullScreen={isMobile}>
          <Stack gap="md">
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              Uyumsoft Portal hesabınızla giriş yapın. Gelen e-faturalarınızı otomatik olarak çekebilirsiniz.
            </Alert>

            <TextInput
              label="Kullanıcı Adı"
              placeholder="Kullanıcı adınız"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.currentTarget.value })}
              required
            />

            <PasswordInput
              label="Şifre"
              placeholder="Şifreniz"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.currentTarget.value })}
              required
            />

            <Checkbox
              label="Giriş bilgilerimi hatırla"
              checked={credentials.remember}
              onChange={(e) => setCredentials({ ...credentials, remember: e.currentTarget.checked })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeConnect}>İptal</Button>
              <Button 
                color="violet" 
                onClick={handleConnect}
                loading={isConnecting}
                leftSection={<IconPlugConnected size={16} />}
              >
                Bağlan
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Yeni Fatura Modal */}
        <Modal opened={opened} onClose={() => { resetForm(); close(); }} title="📄 Yeni Fatura" size="xl" fullScreen={isMobile}>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select label="Fatura Tipi" data={[{ label: '📤 Satış Faturası', value: 'satis' }, { label: '📥 Alış Faturası', value: 'alis' }]} value={formData.tip} onChange={(v) => setFormData({ ...formData, tip: v as any, seri: v === 'satis' ? 'A' : 'B' })} />
              <Select label="Cari" placeholder="Cari seçin" data={cariler.map(c => ({ label: c.unvan, value: String(c.id) }))} value={formData.cariId} onChange={(v) => setFormData({ ...formData, cariId: v || '' })} searchable required />
            </SimpleGrid>

            <SimpleGrid cols={4}>
              <TextInput label="Seri" value={formData.seri} onChange={(e) => setFormData({ ...formData, seri: e.currentTarget.value })} />
              <TextInput label="No" placeholder="Otomatik" value={formData.no} onChange={(e) => setFormData({ ...formData, no: e.currentTarget.value })} />
              <DatePickerInput label="Tarih" leftSection={<IconCalendar size={16} />} value={formData.tarih} onChange={(v) => setFormData({ ...formData, tarih: v || new Date() })} locale="tr" />
              <DatePickerInput label="Vade Tarihi" leftSection={<IconCalendar size={16} />} value={formData.vadeTarihi} onChange={(v) => setFormData({ ...formData, vadeTarihi: v || new Date() })} locale="tr" />
            </SimpleGrid>

            <Divider label="Kalemler" labelPosition="center" />

            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: '35%' }}>Açıklama</Table.Th>
                  <Table.Th>Miktar</Table.Th>
                  <Table.Th>Birim</Table.Th>
                  <Table.Th>B.Fiyat</Table.Th>
                  <Table.Th>KDV %</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {kalemler.map((kalem, idx) => (
                  <Table.Tr key={kalem.id}>
                    <Table.Td>
                      <TextInput size="xs" placeholder="Ürün/hizmet açıklaması" value={kalem.aciklama} onChange={(e) => updateKalem(kalem.id, 'aciklama', e.currentTarget.value)} />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" value={kalem.miktar} onChange={(v) => updateKalem(kalem.id, 'miktar', v)} min={1} style={{ width: 70 }} />
                    </Table.Td>
                    <Table.Td>
                      <Select size="xs" data={birimler} value={kalem.birim} onChange={(v) => updateKalem(kalem.id, 'birim', v)} style={{ width: 90 }} />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" value={kalem.birimFiyat} onChange={(v) => updateKalem(kalem.id, 'birimFiyat', v)} min={0} decimalScale={2} style={{ width: 100 }} />
                    </Table.Td>
                    <Table.Td>
                      <Select size="xs" data={kdvOranlari.map(k => ({ label: `%${k}`, value: k.toString() }))} value={kalem.kdvOrani.toString()} onChange={(v) => updateKalem(kalem.id, 'kdvOrani', Number(v))} style={{ width: 70 }} />
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={500}>{formatMoney(kalem.tutar)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeKalem(kalem.id)} disabled={kalemler.length === 1}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={addKalem}>
              Kalem Ekle
            </Button>

            <Paper withBorder p="md" radius="md">
              <SimpleGrid cols={3}>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Ara Toplam:</Text>
                  <Text size="sm" fw={500}>{formatMoney(araToplam)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">KDV Toplam:</Text>
                  <Text size="sm" fw={500}>{formatMoney(kdvToplam)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Genel Toplam:</Text>
                  <Text size="lg" fw={700} c="violet">{formatMoney(genelToplam)}</Text>
                </Group>
              </SimpleGrid>
            </Paper>

            <Textarea label="Notlar" placeholder="Ek notlar..." rows={2} value={formData.notlar} onChange={(e) => setFormData({ ...formData, notlar: e.currentTarget.value })} />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => { resetForm(); close(); }}>İptal</Button>
              <Button color="violet" onClick={handleSubmit}>Kaydet</Button>
            </Group>
          </Stack>
        </Modal>

        {/* Uyumsoft Fatura Detay Modal */}
        <Modal 
          opened={uyumsoftDetailOpened} 
          onClose={closeUyumsoftDetail} 
          fullScreen={isMobile}
          title={
            <Group gap="sm">
              <Title order={3}>📄 E-Fatura Görüntüleyici</Title>
              {faturaDetail?.isVerified && (
                <Badge color="green" variant="filled" size="sm">✓ E-İmza Doğrulandı</Badge>
              )}
            </Group>
          } 
          size="90%"
          styles={{
            body: { padding: 0 }
          }}
        >
          {selectedUyumsoftFatura && (
            <Stack gap={0}>
              {/* Üst Bilgi Bar */}
              <Paper p="sm" radius={0} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                <Group justify="space-between">
                  <Group gap="lg">
                    <div>
                      <Text size="xs" c="dimmed">Fatura No</Text>
                      <Text fw={700}>{selectedUyumsoftFatura.faturaNo}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Tarih</Text>
                      <Text fw={500}>{formatDate(selectedUyumsoftFatura.faturaTarihi)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Gönderen</Text>
                      <Text fw={500} style={{ maxWidth: 300 }} lineClamp={1}>{selectedUyumsoftFatura.gonderenUnvan}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">VKN</Text>
                      <Text fw={500}>{selectedUyumsoftFatura.gonderenVkn}</Text>
                    </div>
                  </Group>
                  <Group>
                    <Text size="lg" fw={700} c="violet">
                      {formatMoney(selectedUyumsoftFatura.odenecekTutar)}
                    </Text>
                    <Button 
                      variant="light" 
                      size="xs"
                      leftSection={<IconDownload size={14} />}
                      onClick={() => window.open(`${API_URL}/uyumsoft/invoice/${selectedUyumsoftFatura.ettn}/pdf`, '_blank')}
                    >
                      PDF
                    </Button>
                  </Group>
                </Group>
              </Paper>

              {/* Fatura HTML İçeriği */}
              {isLoadingDetail ? (
                <Stack align="center" py={100}>
                  <Loader size="xl" color="violet" />
                  <Text c="dimmed">Fatura Uyumsoft API'den yükleniyor...</Text>
                </Stack>
              ) : faturaDetail?.html ? (
                <div 
                  style={{ 
                    height: 'calc(100vh - 250px)', 
                    overflow: 'auto',
                    background: 'white'
                  }}
                >
                  <iframe
                    srcDoc={faturaDetail.html}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      background: 'white'
                    }}
                    title="E-Fatura Görünümü"
                  />
                </div>
              ) : (
                <Stack align="center" py={100}>
                  <ThemeIcon color="gray" size={60} variant="light" radius="xl">
                    <IconFileInvoice size={30} />
                  </ThemeIcon>
                  <Text size="lg" c="dimmed">Fatura içeriği yüklenemedi</Text>
                  <Text size="sm" c="dimmed">Lütfen tekrar deneyin</Text>
                </Stack>
              )}
            </Stack>
          )}
        </Modal>

        {/* Detay Modal */}
        <Modal opened={detailOpened} onClose={closeDetail} title="📋 Fatura Detayı" size="lg" fullScreen={isMobile}>
          {selectedFatura && (
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text size="xl" fw={700}>{selectedFatura.seri}{selectedFatura.no}</Text>
                  <Group gap="xs">
                    <Badge color={selectedFatura.tip === 'satis' ? 'green' : 'orange'} variant="light">
                      {selectedFatura.tip === 'satis' ? 'Satış Faturası' : 'Alış Faturası'}
                    </Badge>
                    {getDurumBadge(selectedFatura.durum)}
                  </Group>
                </div>
                <Text size="xl" fw={700} c="violet">{formatMoney(selectedFatura.genelToplam)}</Text>
              </Group>

              <Divider />

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Cari Bilgileri</Text>
                  <Text size="lg" fw={600} mt="xs">{selectedFatura.cariUnvan}</Text>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Tarihler</Text>
                  <Group justify="space-between" mt="xs">
                    <Text size="sm">Fatura: {formatDate(selectedFatura.tarih)}</Text>
                    <Text size="sm">Vade: {formatDate(selectedFatura.vadeTarihi)}</Text>
                  </Group>
                </Paper>
              </SimpleGrid>

              <Paper withBorder p="md" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">Kalemler</Text>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Açıklama</Table.Th>
                      <Table.Th>Miktar</Table.Th>
                      <Table.Th>B.Fiyat</Table.Th>
                      <Table.Th>KDV</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Tutar</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedFatura.kalemler.map((k) => (
                      <Table.Tr key={k.id}>
                        <Table.Td>{k.aciklama}</Table.Td>
                        <Table.Td>{k.miktar} {k.birim}</Table.Td>
                        <Table.Td>{formatMoney(k.birimFiyat)}</Table.Td>
                        <Table.Td>%{k.kdvOrani}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatMoney(k.tutar)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                <Divider my="sm" />
                <Group justify="flex-end" gap="xl">
                  <Text size="sm" c="dimmed">Ara Toplam: {formatMoney(selectedFatura.araToplam)}</Text>
                  <Text size="sm" c="dimmed">KDV: {formatMoney(selectedFatura.kdvToplam)}</Text>
                  <Text size="lg" fw={700}>Toplam: {formatMoney(selectedFatura.genelToplam)}</Text>
                </Group>
              </Paper>

              <Group justify="flex-end">
                <Button variant="light" leftSection={<IconPrinter size={16} />}>Yazdır</Button>
                <Button variant="default" onClick={closeDetail}>Kapat</Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Container>
    </Box>
  );
}
