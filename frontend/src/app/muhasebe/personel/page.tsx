'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Avatar,
  Divider,
  Loader,
  Center,
  MultiSelect,
  Checkbox,
  Tooltip,
  SegmentedControl,
  Alert
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconUsers,
  IconUser,
  IconCash,
  IconCheck,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconCalendar,
  IconEye,
  IconPhone,
  IconMail,
  IconId,
  IconBriefcase,
  IconCalendarStats,
  IconBuilding,
  IconUserPlus,
  IconUserMinus,
  IconMapPin,
  IconRefresh,
  IconAlertCircle,
  IconChevronRight,
  IconReceipt,
  IconCalculator,
  IconCreditCard,
  IconFileInvoice,
  IconHeart,
  IconBeach,
  IconClockHour4,
  IconCalendarEvent,
  IconX,
  IconCoin
} from '@tabler/icons-react';
import { DataActions } from '@/components/DataActions';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import 'dayjs/locale/tr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Tip tanımları
interface Proje {
  id: number;
  ad: string;
  kod: string | null;
  aciklama: string | null;
  musteri: string | null;
  lokasyon: string | null;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  durum: 'aktif' | 'pasif' | 'tamamlandi' | 'beklemede';
  butce: number;
  personel_sayisi: number;
  toplam_maas: number;
  created_at: string;
}

interface PersonelProje {
  proje_id: number;
  proje_ad: string;
  proje_kod: string | null;
  gorev: string | null;
  baslangic_tarihi: string;
  bitis_tarihi: string | null;
  atama_id?: number;
}

interface Personel {
  id: number;
  sicil_no: string | null;
  tc_kimlik: string;
  ad: string;
  soyad: string;
  tam_ad?: string;
  telefon: string | null;
  email: string | null;
  adres: string | null;
  departman: string | null;
  pozisyon: string | null;
  ise_giris_tarihi: string;
  isten_cikis_tarihi: string | null;
  maas: number;
  maas_tipi: string;
  iban: string | null;
  dogum_tarihi: string | null;
  cinsiyet: string | null;
  notlar: string | null;
  acil_kisi: string | null;
  acil_telefon: string | null;
  durum: 'aktif' | 'izinli' | 'pasif';
  projeler: PersonelProje[];
  created_at: string;
  // Bordro için yeni alanlar
  medeni_durum?: string;
  es_calisiyormu?: boolean;
  cocuk_sayisi?: number;
  engel_derecesi?: number;
  sgk_no?: string;
  yemek_yardimi?: number;
  yol_yardimi?: number;
}

interface Bordro {
  id: number;
  personel_id: number;
  ad?: string;
  soyad?: string;
  yil: number;
  ay: number;
  brut_maas: number;
  brut_toplam: number;
  sgk_isci: number;
  issizlik_isci: number;
  toplam_isci_sgk: number;
  gelir_vergisi: number;
  damga_vergisi: number;
  agi_tutari: number;
  net_maas: number;
  sgk_isveren: number;
  issizlik_isveren: number;
  toplam_isveren_sgk: number;
  toplam_maliyet: number;
  odeme_durumu: string;
  odeme_tarihi?: string;
}

interface BordroOzet {
  personel_sayisi: number;
  toplam_brut: number;
  toplam_net: number;
  toplam_sgk_isci: number;
  toplam_sgk_isveren: number;
  toplam_gelir_vergisi: number;
  toplam_damga_vergisi: number;
  toplam_agi: number;
  toplam_maliyet: number;
  odenen: number;
  bekleyen: number;
}

// İzin tipleri
interface IzinTuru {
  id: number;
  kod: string;
  ad: string;
  ucretli: boolean;
  renk: string;
}

interface IzinTalebi {
  id: number;
  personel_id: number;
  personel_ad: string;
  personel_soyad: string;
  departman: string;
  izin_turu_id: number;
  izin_turu_ad: string;
  izin_turu_kod: string;
  izin_renk: string;
  ucretli: boolean;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  gun_sayisi: number;
  aciklama: string;
  durum: 'beklemede' | 'onaylandi' | 'reddedildi' | 'iptal';
  onaylayan_ad?: string;
  onaylayan_soyad?: string;
  created_at: string;
}

interface IzinStats {
  bekleyen: number;
  bugun_izinli: number;
  bu_yil_onaylanan: number;
  bu_yil_toplam_gun: number;
}

interface KidemHesap {
  personel: { id: number; ad: string; soyad: string; net_maas: number; brut_maas: number };
  calisma: { toplam_gun: number; toplam_yil: number };
  kidem: { hakki_var: boolean; tavan: number; tazminat: number };
  ihbar: { hakki_var: boolean; sure_gun: number; sure_hafta: number; tazminat: number };
  izin: { yillik_hak: number; kullanilan: number; kalan: number; ucret: number };
  toplam_tazminat: number;
}

interface Stats {
  toplam_personel: number;
  izinli_personel: number;
  aktif_proje: number;
  toplam_maas: number;
  gorevli_personel: number;
}

// Sabitler
const departmanlar = ['Mutfak', 'Servis', 'Temizlik', 'Yönetim', 'Depo', 'Lojistik', 'Diğer'];
const pozisyonlar: Record<string, string[]> = {
  'Mutfak': ['Şef', 'Aşçı', 'Aşçı Yardımcısı', 'Komi', 'Mutfak Personeli'],
  'Servis': ['Garson', 'Garson Yardımcısı', 'Hostes', 'Servis Personeli'],
  'Temizlik': ['Temizlik Personeli', 'Temizlik Sorumlusu'],
  'Yönetim': ['Müdür', 'Müdür Yardımcısı', 'İdari Personel', 'Muhasebeci'],
  'Depo': ['Depo Sorumlusu', 'Depo Personeli'],
  'Lojistik': ['Şoför', 'Kurye', 'Araç Sorumlusu'],
  'Diğer': ['Diğer']
};

const COLORS = ['#845ef7', '#20c997', '#339af0', '#ff6b6b', '#fcc419', '#51cf66', '#ff922b', '#a855f7'];

export default function PersonelPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  
  // State
  const [loading, setLoading] = useState(true);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [departmanStats, setDepartmanStats] = useState<{ departman: string; personel_sayisi: number; toplam_maas: number }[]>([]);
  
  const [selectedProje, setSelectedProje] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('personel');
  const [searchTerm, setSearchTerm] = useState('');
  const [durumFilter, setDurumFilter] = useState<string>('aktif');
  
  const [selectedPersonel, setSelectedPersonel] = useState<Personel | null>(null);
  const [editingPersonel, setEditingPersonel] = useState<Personel | null>(null);
  const [editingProje, setEditingProje] = useState<Proje | null>(null);
  
  // Modals
  const [personelModalOpened, { open: openPersonelModal, close: closePersonelModal }] = useDisclosure(false);
  const [projeModalOpened, { open: openProjeModal, close: closeProjeModal }] = useDisclosure(false);
  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const [atamaModalOpened, { open: openAtamaModal, close: closeAtamaModal }] = useDisclosure(false);
  
  // Form states
  const [personelForm, setPersonelForm] = useState({
    ad: '', soyad: '', tc_kimlik: '', telefon: '', email: '', adres: '',
    departman: '', pozisyon: '', ise_giris_tarihi: new Date(), maas: 0,
    maas_tipi: 'aylik', iban: '', dogum_tarihi: null as Date | null, cinsiyet: '',
    notlar: '', sicil_no: '', acil_kisi: '', acil_telefon: '', durum: 'aktif',
    // Bordro için yeni alanlar
    medeni_durum: 'bekar', es_calisiyormu: false, cocuk_sayisi: 0,
    engel_derecesi: 0, sgk_no: '', yemek_yardimi: 0, yol_yardimi: 0
  });
  
  // Bordro state
  const [bordroList, setBordroList] = useState<Bordro[]>([]);
  const [bordroOzet, setBordroOzet] = useState<BordroOzet | null>(null);
  const [bordroYil, setBordroYil] = useState(new Date().getFullYear());
  const [bordroAy, setBordroAy] = useState(new Date().getMonth() + 1);
  const [bordroLoading, setBordroLoading] = useState(false);
  
  // Maaş önizleme hesabı (form için)
  const [maasOnizleme, setMaasOnizleme] = useState<{
    brut_maas: number;
    sgk_isci: number;
    issizlik_isci: number;
    gelir_vergisi: number;
    damga_vergisi: number;
    agi_tutari: number;
    net_maas: number;
    sgk_isveren: number;
    issizlik_isveren: number;
    toplam_maliyet: number;
  } | null>(null);
  const [maasHesaplaniyor, setMaasHesaplaniyor] = useState(false);
  
  // Detay modalı için maliyet hesabı
  const [detayMaliyet, setDetayMaliyet] = useState<{
    brut_maas: number;
    sgk_isci: number;
    issizlik_isci: number;
    gelir_vergisi: number;
    damga_vergisi: number;
    agi_tutari: number;
    net_maas: number;
    sgk_isveren: number;
    issizlik_isveren: number;
    toplam_maliyet: number;
  } | null>(null);
  
  // İzin state'leri
  const [izinTurleri, setIzinTurleri] = useState<IzinTuru[]>([]);
  const [izinTalepleri, setIzinTalepleri] = useState<IzinTalebi[]>([]);
  const [izinStats, setIzinStats] = useState<IzinStats | null>(null);
  const [izinLoading, setIzinLoading] = useState(false);
  const [izinModalOpened, { open: openIzinModal, close: closeIzinModal }] = useDisclosure(false);
  const [kidemModalOpened, { open: openKidemModal, close: closeKidemModal }] = useDisclosure(false);
  const [kidemHesap, setKidemHesap] = useState<KidemHesap | null>(null);
  const [kidemPersonelId, setKidemPersonelId] = useState<number | null>(null);
  
  const [izinForm, setIzinForm] = useState({
    personel_id: '',
    izin_turu_id: '',
    baslangic_tarihi: new Date(),
    bitis_tarihi: new Date(),
    aciklama: ''
  });
  
  const [projeForm, setProjeForm] = useState({
    ad: '', kod: '', aciklama: '', musteri: '', lokasyon: '',
    baslangic_tarihi: null as Date | null, bitis_tarihi: null as Date | null,
    butce: 0, durum: 'aktif'
  });
  
  const [atamaForm, setAtamaForm] = useState({
    personel_ids: [] as string[],
    gorev: '',
    baslangic_tarihi: new Date()
  });
  const [atamaProjeId, setAtamaProjeId] = useState<number | null>(null);

  // API Functions
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [personelRes, projelerRes, statsRes, deptStatsRes] = await Promise.all([
        fetch(`${API_URL}/api/personel${durumFilter ? `?durum=${durumFilter}` : ''}`),
        fetch(`${API_URL}/api/personel/projeler`),
        fetch(`${API_URL}/api/personel/stats/overview`),
        fetch(`${API_URL}/api/personel/stats/departman`)
      ]);

      if (personelRes.ok) {
        const data = await personelRes.json();
        setPersoneller(data);
      }
      if (projelerRes.ok) {
        const data = await projelerRes.json();
        setProjeler(data);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (deptStatsRes.ok) {
        const data = await deptStatsRes.json();
        setDepartmanStats(data);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      notifications.show({ title: 'Hata', message: 'Veriler yüklenemedi', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [durumFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Bordro verilerini çek
  const fetchBordro = useCallback(async () => {
    setBordroLoading(true);
    try {
      const [listRes, ozetRes] = await Promise.all([
        fetch(`${API_URL}/api/bordro?yil=${bordroYil}&ay=${bordroAy}`),
        fetch(`${API_URL}/api/bordro/ozet/${bordroYil}/${bordroAy}`)
      ]);

      if (listRes.ok) {
        const data = await listRes.json();
        setBordroList(data);
      }
      if (ozetRes.ok) {
        const data = await ozetRes.json();
        setBordroOzet(data);
      }
    } catch (error) {
      console.error('Bordro yükleme hatası:', error);
    } finally {
      setBordroLoading(false);
    }
  }, [bordroYil, bordroAy]);

  useEffect(() => {
    if (activeTab === 'bordro') {
      fetchBordro();
    }
  }, [activeTab, fetchBordro]);

  // Maaş değiştiğinde gerçek hesaplama yap
  useEffect(() => {
    const hesaplaMaas = async () => {
      if (personelForm.maas <= 0) {
        setMaasOnizleme(null);
        return;
      }
      
      setMaasHesaplaniyor(true);
      try {
        // Net'ten brüt hesapla API'si
        const response = await fetch(`${API_URL}/api/bordro/net-brut-hesapla`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            net_maas: personelForm.maas,
            medeni_durum: personelForm.medeni_durum,
            es_calisiyormu: personelForm.es_calisiyormu,
            cocuk_sayisi: personelForm.cocuk_sayisi,
            yemek_yardimi: personelForm.yemek_yardimi || 0,
            yol_yardimi: personelForm.yol_yardimi || 0
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          setMaasOnizleme(data);
        }
      } catch (error) {
        console.error('Maaş hesaplama hatası:', error);
      } finally {
        setMaasHesaplaniyor(false);
      }
    };
    
    // Debounce - 500ms bekle
    const timer = setTimeout(hesaplaMaas, 500);
    return () => clearTimeout(timer);
  }, [personelForm.maas, personelForm.medeni_durum, personelForm.es_calisiyormu, personelForm.cocuk_sayisi, personelForm.yemek_yardimi, personelForm.yol_yardimi]);

  // Detay modalı açıldığında maliyet hesapla
  useEffect(() => {
    const hesaplaDetayMaliyet = async () => {
      if (!selectedPersonel || selectedPersonel.maas <= 0) {
        setDetayMaliyet(null);
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/api/bordro/net-brut-hesapla`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            net_maas: selectedPersonel.maas,
            medeni_durum: selectedPersonel.medeni_durum || 'bekar',
            es_calisiyormu: selectedPersonel.es_calisiyormu || false,
            cocuk_sayisi: selectedPersonel.cocuk_sayisi || 0,
            yemek_yardimi: selectedPersonel.yemek_yardimi || 0,
            yol_yardimi: selectedPersonel.yol_yardimi || 0
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          setDetayMaliyet(data);
        }
      } catch (error) {
        console.error('Detay maliyet hesaplama hatası:', error);
      }
    };
    
    if (detailModalOpened && selectedPersonel) {
      hesaplaDetayMaliyet();
    }
  }, [detailModalOpened, selectedPersonel]);

  // İzin verilerini çek
  const fetchIzinData = useCallback(async () => {
    setIzinLoading(true);
    try {
      const [turlerRes, taleplerRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/izin/turler`),
        fetch(`${API_URL}/api/izin/talepler`),
        fetch(`${API_URL}/api/izin/stats`)
      ]);

      if (turlerRes.ok) setIzinTurleri(await turlerRes.json());
      if (taleplerRes.ok) setIzinTalepleri(await taleplerRes.json());
      if (statsRes.ok) setIzinStats(await statsRes.json());
    } catch (error) {
      console.error('İzin verileri hatası:', error);
    } finally {
      setIzinLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'izinler') {
      fetchIzinData();
    }
  }, [activeTab, fetchIzinData]);

  // İzin talebi oluştur
  const handleCreateIzin = async () => {
    if (!izinForm.personel_id || !izinForm.izin_turu_id) {
      notifications.show({ title: 'Hata', message: 'Personel ve izin türü zorunludur', color: 'red' });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/izin/talepler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...izinForm,
          baslangic_tarihi: izinForm.baslangic_tarihi.toISOString().split('T')[0],
          bitis_tarihi: izinForm.bitis_tarihi.toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'İşlem başarısız');
      }

      notifications.show({ title: 'Başarılı', message: 'İzin talebi oluşturuldu', color: 'green' });
      closeIzinModal();
      setIzinForm({ personel_id: '', izin_turu_id: '', baslangic_tarihi: new Date(), bitis_tarihi: new Date(), aciklama: '' });
      fetchIzinData();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // İzin onayla/reddet
  const handleIzinDurum = async (id: number, durum: 'onaylandi' | 'reddedildi') => {
    try {
      const response = await fetch(`${API_URL}/api/izin/talepler/${id}/durum`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durum, onaylayan_id: 1 }) // TODO: Gerçek kullanıcı ID
      });

      if (!response.ok) throw new Error('İşlem başarısız');

      notifications.show({ 
        title: 'Başarılı', 
        message: durum === 'onaylandi' ? 'İzin onaylandı' : 'İzin reddedildi', 
        color: durum === 'onaylandi' ? 'green' : 'orange' 
      });
      fetchIzinData();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // Kıdem hesapla
  const handleKidemHesapla = async (personelId: number) => {
    setKidemPersonelId(personelId);
    try {
      const response = await fetch(`${API_URL}/api/izin/kidem-hesapla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personel_id: personelId, cikis_nedeni: 'isten_cikarma' })
      });

      if (response.ok) {
        const data = await response.json();
        setKidemHesap(data);
        openKidemModal();
      }
    } catch (error) {
      console.error('Kıdem hesaplama hatası:', error);
    }
  };

  // Toplu bordro hesapla
  const handleTopluBordro = async () => {
    if (!confirm(`${bordroAy}/${bordroYil} dönemi için tüm aktif personellerin bordrosunu hesaplamak istiyor musunuz?`)) return;
    
    setBordroLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/bordro/toplu-hesapla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yil: bordroYil, ay: bordroAy })
      });

      if (!response.ok) throw new Error('Hesaplama başarısız');
      
      const result = await response.json();
      notifications.show({ 
        title: 'Başarılı', 
        message: `${result.basarili} personel için bordro hesaplandı${result.hatali > 0 ? `, ${result.hatali} hata` : ''}`, 
        color: result.hatali > 0 ? 'yellow' : 'green' 
      });
      fetchBordro();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    } finally {
      setBordroLoading(false);
    }
  };

  // Toplu ödeme
  const handleTopluOdeme = async () => {
    const bekleyenler = bordroList.filter(b => b.odeme_durumu === 'beklemede');
    if (bekleyenler.length === 0) {
      notifications.show({ title: 'Uyarı', message: 'Bekleyen ödeme yok', color: 'yellow' });
      return;
    }
    
    if (!confirm(`${bekleyenler.length} personelin ödemesini "Ödendi" olarak işaretlemek istiyor musunuz?`)) return;
    
    try {
      const response = await fetch(`${API_URL}/api/bordro/toplu-odeme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bordro_ids: bekleyenler.map(b => b.id), odeme_yontemi: 'banka' })
      });

      if (!response.ok) throw new Error('İşlem başarısız');
      
      const result = await response.json();
      notifications.show({ title: 'Başarılı', message: `${result.basarili} ödeme tamamlandı`, color: 'green' });
      fetchBordro();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(value);
  };

  // Tarih formatı
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  // Çalışma süresi
  const getCalismaSuresi = (tarih: string) => {
    const giris = new Date(tarih);
    const bugun = new Date();
    const fark = bugun.getTime() - giris.getTime();
    const yil = Math.floor(fark / (1000 * 60 * 60 * 24 * 365));
    const ay = Math.floor((fark % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
    if (yil > 0) return `${yil} yıl ${ay} ay`;
    return `${ay} ay`;
  };

  // Filtreleme
  const filteredPersoneller = personeller.filter(p => {
    const matchesSearch = `${p.ad} ${p.soyad}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.pozisyon?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.tc_kimlik?.includes(searchTerm);
    const matchesProje = !selectedProje || p.projeler?.some(pr => pr.proje_id.toString() === selectedProje);
    return matchesSearch && matchesProje;
  });

  // Durum badge
  const getDurumBadge = (durum: string) => {
    const config: Record<string, { color: string; label: string }> = {
      aktif: { color: 'green', label: 'Aktif' },
      izinli: { color: 'yellow', label: 'İzinli' },
      pasif: { color: 'gray', label: 'Pasif' },
      tamamlandi: { color: 'blue', label: 'Tamamlandı' },
      beklemede: { color: 'orange', label: 'Beklemede' }
    };
    const { color, label } = config[durum] || config.aktif;
    return <Badge color={color} variant="light">{label}</Badge>;
  };

  // Avatar rengi
  const getAvatarColor = (departman: string | null) => {
    const colors: Record<string, string> = {
      'Mutfak': 'orange',
      'Servis': 'blue',
      'Temizlik': 'green',
      'Yönetim': 'violet',
      'Depo': 'cyan',
      'Lojistik': 'pink'
    };
    return colors[departman || ''] || 'gray';
  };

  // Personel kaydet
  const handleSavePersonel = async () => {
    if (!personelForm.ad || !personelForm.soyad || !personelForm.tc_kimlik) {
      notifications.show({ title: 'Hata', message: 'Ad, soyad ve TC kimlik zorunludur', color: 'red' });
      return;
    }

    try {
      const url = editingPersonel 
        ? `${API_URL}/api/personel/${editingPersonel.id}`
        : `${API_URL}/api/personel`;
      
      const method = editingPersonel ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...personelForm,
          ise_giris_tarihi: personelForm.ise_giris_tarihi.toISOString().split('T')[0],
          dogum_tarihi: personelForm.dogum_tarihi?.toISOString().split('T')[0] || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'İşlem başarısız');
      }

      notifications.show({ title: 'Başarılı', message: `Personel ${editingPersonel ? 'güncellendi' : 'eklendi'}`, color: 'green', icon: <IconCheck size={16} /> });
      closePersonelModal();
      resetPersonelForm();
      fetchData();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // Proje kaydet
  const handleSaveProje = async () => {
    if (!projeForm.ad) {
      notifications.show({ title: 'Hata', message: 'Proje adı zorunludur', color: 'red' });
      return;
    }

    try {
      const url = editingProje 
        ? `${API_URL}/api/personel/projeler/${editingProje.id}`
        : `${API_URL}/api/personel/projeler`;
      
      const method = editingProje ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...projeForm,
          baslangic_tarihi: projeForm.baslangic_tarihi?.toISOString().split('T')[0] || null,
          bitis_tarihi: projeForm.bitis_tarihi?.toISOString().split('T')[0] || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'İşlem başarısız');
      }

      notifications.show({ title: 'Başarılı', message: `Proje ${editingProje ? 'güncellendi' : 'eklendi'}`, color: 'green', icon: <IconCheck size={16} /> });
      closeProjeModal();
      resetProjeForm();
      fetchData();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // Personel sil
  const handleDeletePersonel = async (id: number) => {
    if (!confirm('Bu personeli silmek istediğinizden emin misiniz?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/personel/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Silme başarısız');
      
      notifications.show({ title: 'Silindi', message: 'Personel kaydı silindi', color: 'orange' });
      fetchData();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // Proje sil
  const handleDeleteProje = async (id: number) => {
    if (!confirm('Bu projeyi silmek istediğinizden emin misiniz? Tüm personel atamaları da silinecek.')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/personel/projeler/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Silme başarısız');
      
      notifications.show({ title: 'Silindi', message: 'Proje silindi', color: 'orange' });
      fetchData();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // Personel ata
  const handleAtamaSubmit = async () => {
    if (!atamaProjeId || atamaForm.personel_ids.length === 0) {
      notifications.show({ title: 'Hata', message: 'Proje ve en az bir personel seçmelisiniz', color: 'red' });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/personel/projeler/${atamaProjeId}/personel/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personel_ids: atamaForm.personel_ids.map(id => parseInt(id)),
          gorev: atamaForm.gorev || null,
          baslangic_tarihi: atamaForm.baslangic_tarihi.toISOString().split('T')[0]
        })
      });

      if (!response.ok) throw new Error('Atama başarısız');
      
      const result = await response.json();
      notifications.show({ 
        title: 'Başarılı', 
        message: `${result.success.length} personel atandı${result.errors.length > 0 ? `, ${result.errors.length} hata` : ''}`, 
        color: result.errors.length > 0 ? 'yellow' : 'green' 
      });
      
      closeAtamaModal();
      setAtamaForm({ personel_ids: [], gorev: '', baslangic_tarihi: new Date() });
      setAtamaProjeId(null);
      fetchData();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // Atama kaldır
  const handleRemoveAtama = async (atamaId: number) => {
    if (!confirm('Bu personeli projeden çıkarmak istediğinizden emin misiniz?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/personel/atama/${atamaId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('İşlem başarısız');
      
      notifications.show({ title: 'Başarılı', message: 'Personel projeden çıkarıldı', color: 'orange' });
      fetchData();
      closeDetailModal();
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // Form reset
  const resetPersonelForm = () => {
    setEditingPersonel(null);
    setPersonelForm({
      ad: '', soyad: '', tc_kimlik: '', telefon: '', email: '', adres: '',
      departman: '', pozisyon: '', ise_giris_tarihi: new Date(), maas: 0,
      maas_tipi: 'aylik', iban: '', dogum_tarihi: null, cinsiyet: '',
      notlar: '', sicil_no: '', acil_kisi: '', acil_telefon: '', durum: 'aktif',
      medeni_durum: 'bekar', es_calisiyormu: false, cocuk_sayisi: 0,
      engel_derecesi: 0, sgk_no: '', yemek_yardimi: 0, yol_yardimi: 0
    });
  };

  const resetProjeForm = () => {
    setEditingProje(null);
    setProjeForm({
      ad: '', kod: '', aciklama: '', musteri: '', lokasyon: '',
      baslangic_tarihi: null, bitis_tarihi: null, butce: 0, durum: 'aktif'
    });
  };

  // Edit handlers
  const handleEditPersonel = (p: Personel) => {
    setEditingPersonel(p);
    setPersonelForm({
      ad: p.ad,
      soyad: p.soyad,
      tc_kimlik: p.tc_kimlik,
      telefon: p.telefon || '',
      email: p.email || '',
      adres: p.adres || '',
      departman: p.departman || '',
      pozisyon: p.pozisyon || '',
      ise_giris_tarihi: new Date(p.ise_giris_tarihi),
      maas: p.maas,
      maas_tipi: p.maas_tipi || 'aylik',
      iban: p.iban || '',
      dogum_tarihi: p.dogum_tarihi ? new Date(p.dogum_tarihi) : null,
      cinsiyet: p.cinsiyet || '',
      notlar: p.notlar || '',
      sicil_no: p.sicil_no || '',
      acil_kisi: p.acil_kisi || '',
      acil_telefon: p.acil_telefon || '',
      durum: p.durum || 'aktif',
      medeni_durum: p.medeni_durum || 'bekar',
      es_calisiyormu: p.es_calisiyormu || false,
      cocuk_sayisi: p.cocuk_sayisi || 0,
      engel_derecesi: p.engel_derecesi || 0,
      sgk_no: p.sgk_no || '',
      yemek_yardimi: p.yemek_yardimi || 0,
      yol_yardimi: p.yol_yardimi || 0
    });
    openPersonelModal();
  };

  const handleEditProje = (p: Proje) => {
    setEditingProje(p);
    setProjeForm({
      ad: p.ad,
      kod: p.kod || '',
      aciklama: p.aciklama || '',
      musteri: p.musteri || '',
      lokasyon: p.lokasyon || '',
      baslangic_tarihi: p.baslangic_tarihi ? new Date(p.baslangic_tarihi) : null,
      bitis_tarihi: p.bitis_tarihi ? new Date(p.bitis_tarihi) : null,
      butce: p.butce,
      durum: p.durum
    });
    openProjeModal();
  };

  // Atama açma
  const openAtamaForProje = (projeId: number) => {
    setAtamaProjeId(projeId);
    setAtamaForm({ personel_ids: [], gorev: '', baslangic_tarihi: new Date() });
    openAtamaModal();
  };

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="xl" color="violet" />
      </Center>
    );
  }

  return (
    <Box 
      style={{ 
        background: isDark 
          ? 'linear-gradient(180deg, rgba(132,94,247,0.05) 0%, rgba(0,0,0,0) 100%)' 
          : 'linear-gradient(180deg, rgba(132,94,247,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh' 
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>🧑‍💼 Personel Yönetimi</Title>
              <Text c="dimmed" size="lg">Proje bazlı çalışan bilgilerini yönetin</Text>
            </Box>
            <Group>
              <Button 
                leftSection={<IconRefresh size={18} />} 
                variant="light" 
                color="gray"
                onClick={fetchData}
              >
                Yenile
              </Button>
              <Button 
                leftSection={<IconBuilding size={18} />} 
                variant="light" 
                color="cyan"
                onClick={() => { resetProjeForm(); openProjeModal(); }}
              >
                Yeni Proje
              </Button>
              <Button 
                leftSection={<IconPlus size={18} />} 
                variant="gradient" 
                gradient={{ from: 'violet', to: 'grape' }} 
                onClick={() => { resetPersonelForm(); openPersonelModal(); }}
              >
              Yeni Personel
            </Button>
            <DataActions 
              type="personel" 
              onImportSuccess={() => { fetchPersoneller(); fetchStats(); }}
              projeler={projeler}
              departmanlar={[...new Set(personeller.map(p => p.departman).filter(Boolean) as string[])]}
            />
            </Group>
          </Group>

          {/* Stats Cards */}
          {stats && (
            <SimpleGrid cols={{ base: 2, md: 5 }}>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Personel</Text>
                <ThemeIcon color="blue" variant="light" size="lg" radius="md"><IconUsers size={20} /></ThemeIcon>
              </Group>
                <Text fw={700} size="xl" mt="md">{stats.toplam_personel}</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Görevli Personel</Text>
                <ThemeIcon color="green" variant="light" size="lg" radius="md"><IconUser size={20} /></ThemeIcon>
              </Group>
                <Text fw={700} size="xl" mt="md" c="green">{stats.gorevli_personel}</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Aktif Proje</Text>
                  <ThemeIcon color="cyan" variant="light" size="lg" radius="md"><IconBuilding size={20} /></ThemeIcon>
                </Group>
                <Text fw={700} size="xl" mt="md" c="cyan">{stats.aktif_proje}</Text>
              </Card>
              <Card withBorder shadow="sm" p="lg" radius="md">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Aylık Maaş</Text>
                <ThemeIcon color="orange" variant="light" size="lg" radius="md"><IconCash size={20} /></ThemeIcon>
              </Group>
                <Text fw={700} size="xl" mt="md" c="orange">{formatMoney(stats.toplam_maas)}</Text>
            </Card>
            <Card withBorder shadow="sm" p="lg" radius="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>İzinli</Text>
                <ThemeIcon color="yellow" variant="light" size="lg" radius="md"><IconCalendarStats size={20} /></ThemeIcon>
              </Group>
                <Text fw={700} size="xl" mt="md" c="yellow">{stats.izinli_personel}</Text>
            </Card>
          </SimpleGrid>
          )}

          {/* Tabs */}
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
              <Tabs.Tab value="personel" leftSection={<IconUsers size={16} />}>
                Personeller ({personeller.length})
              </Tabs.Tab>
              <Tabs.Tab value="projeler" leftSection={<IconBuilding size={16} />}>
                Projeler ({projeler.length})
              </Tabs.Tab>
              <Tabs.Tab value="izinler" leftSection={<IconBeach size={16} />}>
                İzinler {izinStats?.bekleyen ? <Badge size="xs" color="orange" ml={4}>{izinStats.bekleyen}</Badge> : null}
              </Tabs.Tab>
              <Tabs.Tab value="bordro" leftSection={<IconReceipt size={16} />}>
                Bordro
              </Tabs.Tab>
              <Tabs.Tab value="grafikler" leftSection={<IconBriefcase size={16} />}>
                Grafikler
              </Tabs.Tab>
                </Tabs.List>

            {/* Personel Tab */}
            <Tabs.Panel value="personel" pt="md">
              <Card withBorder shadow="sm" p="lg" radius="md">
                <Group justify="space-between" mb="md">
                  <Group>
                    <Select
                      placeholder="Proje filtrele"
                      clearable
                      data={projeler.map(p => ({ value: p.id.toString(), label: p.ad }))}
                      value={selectedProje}
                      onChange={setSelectedProje}
                      leftSection={<IconBuilding size={16} />}
                      style={{ width: 200 }}
                    />
                    <SegmentedControl
                      value={durumFilter}
                      onChange={(v) => setDurumFilter(v)}
                      data={[
                        { label: 'Aktif', value: 'aktif' },
                        { label: 'İzinli', value: 'izinli' },
                        { label: 'Pasif', value: 'pasif' },
                        { label: 'Tümü', value: '' }
                      ]}
                    />
                  </Group>
                  <TextInput 
                    placeholder="Personel ara..." 
                    leftSection={<IconSearch size={16} />} 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.currentTarget.value)} 
                    style={{ width: 250 }} 
                  />
            </Group>

                <Table.ScrollContainer minWidth={1000}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Personel</Table.Th>
                    <Table.Th>Departman</Table.Th>
                    <Table.Th>Pozisyon</Table.Th>
                        <Table.Th>Projeler</Table.Th>
                    <Table.Th>İşe Giriş</Table.Th>
                    <Table.Th>Durum</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Maaş</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: 80 }}>İşlem</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredPersoneller.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={8}>
                            <Text ta="center" c="dimmed" py="xl">Personel bulunamadı</Text>
                          </Table.Td>
                        </Table.Tr>
                  ) : (
                    filteredPersoneller.map((personel) => (
                      <Table.Tr key={personel.id}>
                        <Table.Td>
                          <Group gap="sm">
                            <Avatar color={getAvatarColor(personel.departman)} radius="xl">
                              {personel.ad[0]}{personel.soyad[0]}
                            </Avatar>
                            <div>
                              <Text size="sm" fw={500}>{personel.ad} {personel.soyad}</Text>
                                  <Text size="xs" c="dimmed">{personel.telefon || '-'}</Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                              <Badge variant="light" color={getAvatarColor(personel.departman)}>
                                {personel.departman || 'Belirsiz'}
                              </Badge>
                        </Table.Td>
                            <Table.Td><Text size="sm">{personel.pozisyon || '-'}</Text></Table.Td>
                            <Table.Td>
                              {personel.projeler && personel.projeler.length > 0 ? (
                                <Group gap={4}>
                                  {personel.projeler.slice(0, 2).map((pr, i) => (
                                    <Badge key={i} size="xs" variant="dot" color="cyan">
                                      {pr.proje_ad}
                                    </Badge>
                                  ))}
                                  {personel.projeler.length > 2 && (
                                    <Badge size="xs" variant="light" color="gray">
                                      +{personel.projeler.length - 2}
                                    </Badge>
                                  )}
                                </Group>
                              ) : (
                                <Text size="xs" c="dimmed">Atama yok</Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">{formatDate(personel.ise_giris_tarihi)}</Text>
                              <Text size="xs" c="dimmed">{getCalismaSuresi(personel.ise_giris_tarihi)}</Text>
                            </Table.Td>
                            <Table.Td>{getDurumBadge(personel.durum || 'aktif')}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600}>{formatMoney(personel.maas)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                                  <ActionIcon variant="subtle" color="gray">
                                    <IconDotsVertical size={16} />
                                  </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                                  <Menu.Item 
                                    leftSection={<IconEye style={{ width: rem(14), height: rem(14) }} />} 
                                    onClick={() => { setSelectedPersonel(personel); openDetailModal(); }}
                                  >
                                    Detay
                                  </Menu.Item>
                                  <Menu.Item 
                                    leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />} 
                                    onClick={() => handleEditPersonel(personel)}
                                  >
                                    Düzenle
                                  </Menu.Item>
                              <Menu.Divider />
                                  <Menu.Item 
                                    color="red" 
                                    leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />} 
                                    onClick={() => handleDeletePersonel(personel.id)}
                                  >
                                    Sil
                                  </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
            </Tabs.Panel>

            {/* Projeler Tab */}
            <Tabs.Panel value="projeler" pt="md">
              <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }}>
                {projeler.map((proje) => (
                  <Card key={proje.id} withBorder shadow="sm" p="lg" radius="md">
                    <Group justify="space-between" mb="md">
                      <Box>
                        <Group gap="xs">
                          <Text fw={600} size="lg">{proje.ad}</Text>
                          {proje.kod && <Badge variant="light" size="sm">{proje.kod}</Badge>}
                        </Group>
                        <Group gap="xs" mt={4}>
                          {getDurumBadge(proje.durum)}
                          {proje.musteri && (
                            <Text size="xs" c="dimmed">{proje.musteri}</Text>
                          )}
                        </Group>
                      </Box>
                      <Menu position="bottom-end" shadow="md">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item 
                            leftSection={<IconUserPlus style={{ width: rem(14), height: rem(14) }} />} 
                            onClick={() => openAtamaForProje(proje.id)}
                          >
                            Personel Ata
                          </Menu.Item>
                          <Menu.Item 
                            leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />} 
                            onClick={() => handleEditProje(proje)}
                          >
                            Düzenle
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item 
                            color="red" 
                            leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />} 
                            onClick={() => handleDeleteProje(proje.id)}
                          >
                            Sil
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                    
                    {proje.lokasyon && (
                      <Group gap="xs" mb="sm">
                        <IconMapPin size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                        <Text size="sm" c="dimmed">{proje.lokasyon}</Text>
                      </Group>
                    )}

                    <SimpleGrid cols={2} mt="md">
                      <Paper withBorder p="sm" radius="md">
                        <Text size="xs" c="dimmed">Personel</Text>
                        <Text fw={600} size="lg">{proje.personel_sayisi}</Text>
                      </Paper>
                      <Paper withBorder p="sm" radius="md">
                        <Text size="xs" c="dimmed">Maaş Gideri</Text>
                        <Text fw={600} size="sm" c="orange">{formatMoney(proje.toplam_maas)}</Text>
                      </Paper>
                    </SimpleGrid>

                    {proje.butce > 0 && (
                      <Paper withBorder p="sm" radius="md" mt="sm">
                        <Text size="xs" c="dimmed">Bütçe</Text>
                        <Text fw={600}>{formatMoney(proje.butce)}</Text>
                      </Paper>
                    )}

                    <Button 
                      variant="light" 
                      fullWidth 
                      mt="md"
                      leftSection={<IconUserPlus size={16} />}
                      onClick={() => openAtamaForProje(proje.id)}
                    >
                      Personel Ata
                    </Button>
                  </Card>
                ))}

                {projeler.length === 0 && (
                  <Card withBorder shadow="sm" p="xl" radius="md" style={{ gridColumn: '1 / -1' }}>
                    <Center>
                      <Stack align="center" gap="md">
                        <ThemeIcon size="xl" color="gray" variant="light" radius="xl">
                          <IconBuilding size={24} />
                        </ThemeIcon>
                        <Text c="dimmed">Henüz proje eklenmemiş</Text>
                        <Button 
                          variant="light" 
                          leftSection={<IconPlus size={16} />}
                          onClick={() => { resetProjeForm(); openProjeModal(); }}
                        >
                          İlk Projeyi Ekle
                        </Button>
        </Stack>
                    </Center>
                  </Card>
                )}
              </SimpleGrid>
            </Tabs.Panel>

            {/* İzinler Tab */}
            <Tabs.Panel value="izinler" pt="md">
              <Stack gap="md">
                {/* İstatistik Kartları */}
                <SimpleGrid cols={{ base: 2, md: 4 }}>
                  <Card withBorder shadow="sm" p="lg" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Bekleyen Talepler</Text>
                        <Text fw={700} size="xl" c="orange">{izinStats?.bekleyen || 0}</Text>
                      </div>
                      <ThemeIcon color="orange" variant="light" size="lg" radius="md">
                        <IconClockHour4 size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                  <Card withBorder shadow="sm" p="lg" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Bugün İzinli</Text>
                        <Text fw={700} size="xl" c="blue">{izinStats?.bugun_izinli || 0}</Text>
                      </div>
                      <ThemeIcon color="blue" variant="light" size="lg" radius="md">
                        <IconBeach size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                  <Card withBorder shadow="sm" p="lg" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Bu Yıl Onaylanan</Text>
                        <Text fw={700} size="xl" c="green">{izinStats?.bu_yil_onaylanan || 0}</Text>
                      </div>
                      <ThemeIcon color="green" variant="light" size="lg" radius="md">
                        <IconCheck size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                  <Card withBorder shadow="sm" p="lg" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam İzin Günü</Text>
                        <Text fw={700} size="xl">{izinStats?.bu_yil_toplam_gun || 0}</Text>
                      </div>
                      <ThemeIcon color="violet" variant="light" size="lg" radius="md">
                        <IconCalendarEvent size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </SimpleGrid>

                {/* Butonlar */}
                <Group>
                  <Button 
                    variant="gradient" 
                    gradient={{ from: 'cyan', to: 'teal' }}
                    leftSection={<IconPlus size={16} />}
                    onClick={() => {
                      setIzinForm({ personel_id: '', izin_turu_id: '', baslangic_tarihi: new Date(), bitis_tarihi: new Date(), aciklama: '' });
                      openIzinModal();
                    }}
                  >
                    Yeni İzin Talebi
                  </Button>
                  <Button 
                    variant="light" 
                    leftSection={<IconRefresh size={16} />}
                    onClick={fetchIzinData}
                    loading={izinLoading}
                  >
                    Yenile
                  </Button>
                </Group>

                {/* İzin Talepleri Tablosu */}
                <Card withBorder shadow="sm" p="lg" radius="md">
                  <Text fw={600} size="lg" mb="md">İzin Talepleri</Text>
                  
                  {izinLoading ? (
                    <Center py="xl"><Loader color="cyan" /></Center>
                  ) : izinTalepleri.length === 0 ? (
                    <Center py="xl">
                      <Stack align="center" gap="md">
                        <ThemeIcon size="xl" color="gray" variant="light" radius="xl">
                          <IconBeach size={24} />
                        </ThemeIcon>
                        <Text c="dimmed">Henüz izin talebi yok</Text>
                      </Stack>
                    </Center>
                  ) : (
                    <Table.ScrollContainer minWidth={900}>
                      <Table verticalSpacing="sm" highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Personel</Table.Th>
                            <Table.Th>İzin Türü</Table.Th>
                            <Table.Th>Tarih Aralığı</Table.Th>
                            <Table.Th style={{ textAlign: 'center' }}>Gün</Table.Th>
                            <Table.Th>Durum</Table.Th>
                            <Table.Th>İşlem</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {izinTalepleri.map((talep) => (
                            <Table.Tr key={talep.id}>
                              <Table.Td>
                                <Group gap="sm">
                                  <Avatar size="sm" color={getAvatarColor(talep.departman)} radius="xl">
                                    {talep.personel_ad[0]}{talep.personel_soyad[0]}
                                  </Avatar>
                                  <div>
                                    <Text size="sm" fw={500}>{talep.personel_ad} {talep.personel_soyad}</Text>
                                    <Text size="xs" c="dimmed">{talep.departman || '-'}</Text>
                                  </div>
                                </Group>
                              </Table.Td>
                              <Table.Td>
                                <Badge color={talep.izin_renk?.replace('#', '') || 'blue'} variant="light">
                                  {talep.izin_turu_ad}
                                </Badge>
                                {!talep.ucretli && <Badge color="gray" variant="outline" size="xs" ml={4}>Ücretsiz</Badge>}
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{formatDate(talep.baslangic_tarihi)}</Text>
                                <Text size="xs" c="dimmed">→ {formatDate(talep.bitis_tarihi)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'center' }}>
                                <Badge variant="filled" color="gray" size="lg">{talep.gun_sayisi}</Badge>
                              </Table.Td>
                              <Table.Td>
                                <Badge 
                                  color={
                                    talep.durum === 'onaylandi' ? 'green' : 
                                    talep.durum === 'reddedildi' ? 'red' : 
                                    talep.durum === 'iptal' ? 'gray' : 'orange'
                                  }
                                  variant="light"
                                >
                                  {talep.durum === 'onaylandi' ? '✓ Onaylı' : 
                                   talep.durum === 'reddedildi' ? '✗ Reddedildi' : 
                                   talep.durum === 'iptal' ? 'İptal' : '⏳ Bekliyor'}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                {talep.durum === 'beklemede' && (
                                  <Group gap={4}>
                                    <Tooltip label="Onayla">
                                      <ActionIcon color="green" variant="light" onClick={() => handleIzinDurum(talep.id, 'onaylandi')}>
                                        <IconCheck size={16} />
                                      </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Reddet">
                                      <ActionIcon color="red" variant="light" onClick={() => handleIzinDurum(talep.id, 'reddedildi')}>
                                        <IconX size={16} />
                                      </ActionIcon>
                                    </Tooltip>
                                  </Group>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
                </Card>

                {/* İzin Türleri Bilgisi */}
                <Card withBorder shadow="sm" p="lg" radius="md">
                  <Text fw={600} size="lg" mb="md">📋 İzin Türleri ve Haklar</Text>
                  <SimpleGrid cols={{ base: 2, md: 4 }}>
                    {izinTurleri.map((tur) => (
                      <Paper key={tur.id} withBorder p="sm" radius="md">
                        <Group gap="xs" mb="xs">
                          <Box w={12} h={12} style={{ borderRadius: 4, backgroundColor: tur.renk }} />
                          <Text size="sm" fw={500}>{tur.ad}</Text>
                        </Group>
                        <Badge size="xs" color={tur.ucretli ? 'green' : 'gray'} variant="light">
                          {tur.ucretli ? 'Ücretli' : 'Ücretsiz'}
                        </Badge>
                      </Paper>
                    ))}
                  </SimpleGrid>
                </Card>
              </Stack>
            </Tabs.Panel>

            {/* Grafikler Tab */}
            <Tabs.Panel value="grafikler" pt="md">
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <Card withBorder shadow="sm" p="lg" radius="md">
                  <Text fw={600} size="lg" mb="md">Departman Bazlı Personel</Text>
                  <Box h={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmanStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                        <XAxis dataKey="departman" stroke={isDark ? '#888' : '#666'} fontSize={12} />
                        <YAxis stroke={isDark ? '#888' : '#666'} fontSize={12} />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1a1b1e' : '#fff', 
                            border: `1px solid ${isDark ? '#333' : '#ddd'}`, 
                            borderRadius: '8px' 
                          }} 
                        />
                        <Bar dataKey="personel_sayisi" fill="#845ef7" name="Personel Sayısı" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Card>

                <Card withBorder shadow="sm" p="lg" radius="md">
                  <Text fw={600} size="lg" mb="md">Proje Bazlı Personel Dağılımı</Text>
                  <Box h={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={projeler.filter(p => p.personel_sayisi > 0)}
                          dataKey="personel_sayisi"
                          nameKey="ad"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {projeler.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1a1b1e' : '#fff', 
                            border: `1px solid ${isDark ? '#333' : '#ddd'}`, 
                            borderRadius: '8px' 
                          }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Card>

                <Card withBorder shadow="sm" p="lg" radius="md" style={{ gridColumn: '1 / -1' }}>
                  <Text fw={600} size="lg" mb="md">Departman Bazlı Maaş Gideri</Text>
                  <Box h={250}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmanStats} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                        <XAxis type="number" stroke={isDark ? '#888' : '#666'} fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <YAxis type="category" dataKey="departman" stroke={isDark ? '#888' : '#666'} fontSize={12} width={100} />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1a1b1e' : '#fff', 
                            border: `1px solid ${isDark ? '#333' : '#ddd'}`, 
                            borderRadius: '8px' 
                          }}
                          formatter={(value: number) => formatMoney(value)}
                        />
                        <Bar dataKey="toplam_maas" fill="#20c997" name="Toplam Maaş" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Card>
              </SimpleGrid>
            </Tabs.Panel>

            {/* AI Asistan Tab */}
            {/* Bordro Tab */}
            <Tabs.Panel value="bordro" pt="md">
              <Stack gap="md">
                {/* Dönem Seçimi ve Butonlar */}
                <Card withBorder shadow="sm" p="lg" radius="md">
                  <Group justify="space-between">
                    <Group>
                      <Select
                        label="Yıl"
                        data={[2024, 2025, 2026].map(y => ({ value: y.toString(), label: y.toString() }))}
                        value={bordroYil.toString()}
                        onChange={(v) => setBordroYil(parseInt(v || '2026'))}
                        style={{ width: 100 }}
                      />
                      <Select
                        label="Ay"
                        data={[
                          { value: '1', label: 'Ocak' },
                          { value: '2', label: 'Şubat' },
                          { value: '3', label: 'Mart' },
                          { value: '4', label: 'Nisan' },
                          { value: '5', label: 'Mayıs' },
                          { value: '6', label: 'Haziran' },
                          { value: '7', label: 'Temmuz' },
                          { value: '8', label: 'Ağustos' },
                          { value: '9', label: 'Eylül' },
                          { value: '10', label: 'Ekim' },
                          { value: '11', label: 'Kasım' },
                          { value: '12', label: 'Aralık' }
                        ]}
                        value={bordroAy.toString()}
                        onChange={(v) => setBordroAy(parseInt(v || '1'))}
                        style={{ width: 120 }}
                      />
                      <Button 
                        variant="light" 
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchBordro}
                        loading={bordroLoading}
                        mt={24}
                      >
                        Yenile
                      </Button>
                    </Group>
                    <Group mt={24}>
                      <Button 
                        variant="gradient" 
                        gradient={{ from: 'violet', to: 'grape' }}
                        leftSection={<IconCalculator size={16} />}
                        onClick={handleTopluBordro}
                        loading={bordroLoading}
                      >
                        Toplu Bordro Hesapla
                      </Button>
                      <Button 
                        variant="gradient" 
                        gradient={{ from: 'teal', to: 'green' }}
                        leftSection={<IconCreditCard size={16} />}
                        onClick={handleTopluOdeme}
                        disabled={bordroList.filter(b => b.odeme_durumu === 'beklemede').length === 0}
                      >
                        Toplu Ödeme Yap
                      </Button>
                    </Group>
                  </Group>
                </Card>

                {/* Özet Kartlar */}
                {bordroOzet && (
                  <SimpleGrid cols={{ base: 2, md: 4 }}>
                    <Card withBorder shadow="sm" p="lg" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Personel Sayısı</Text>
                      <Text fw={700} size="xl" mt="xs">{bordroOzet.personel_sayisi}</Text>
                    </Card>
                    <Card withBorder shadow="sm" p="lg" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Net Maaş</Text>
                      <Text fw={700} size="xl" mt="xs" c="green">{formatMoney(bordroOzet.toplam_net)}</Text>
                    </Card>
                    <Card withBorder shadow="sm" p="lg" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam SGK (İşçi+İşveren)</Text>
                      <Text fw={700} size="xl" mt="xs" c="orange">
                        {formatMoney(bordroOzet.toplam_sgk_isci + bordroOzet.toplam_sgk_isveren)}
                      </Text>
                    </Card>
                    <Card withBorder shadow="sm" p="lg" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Toplam Maliyet</Text>
                      <Text fw={700} size="xl" mt="xs" c="red">{formatMoney(bordroOzet.toplam_maliyet)}</Text>
                    </Card>
                  </SimpleGrid>
                )}

                {/* Bordro Tablosu */}
                <Card withBorder shadow="sm" p="lg" radius="md">
                  <Group justify="space-between" mb="md">
                    <Text fw={600} size="lg">
                      {bordroAy}/{bordroYil} Dönemi Bordro Listesi
                    </Text>
                    <Group gap="xs">
                      <Badge color="green" variant="light">
                        Ödenen: {bordroOzet?.odenen || 0}
                      </Badge>
                      <Badge color="orange" variant="light">
                        Bekleyen: {bordroOzet?.bekleyen || 0}
                      </Badge>
                    </Group>
                  </Group>

                  {bordroLoading ? (
                    <Center py="xl"><Loader color="violet" /></Center>
                  ) : bordroList.length === 0 ? (
                    <Center py="xl">
                      <Stack align="center" gap="md">
                        <ThemeIcon size="xl" color="gray" variant="light" radius="xl">
                          <IconReceipt size={24} />
                        </ThemeIcon>
                        <Text c="dimmed">Bu dönem için bordro kaydı bulunamadı</Text>
                        <Button 
                          variant="light" 
                          leftSection={<IconCalculator size={16} />}
                          onClick={handleTopluBordro}
                        >
                          Bordro Hesapla
                        </Button>
                      </Stack>
                    </Center>
                  ) : (
                    <Table.ScrollContainer minWidth={1200}>
                      <Table verticalSpacing="sm" highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Personel</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>Brüt Maaş</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>SGK (İşçi)</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>Gelir V.</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>Damga V.</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>AGİ</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>Net Maaş</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>İşveren SGK</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>Maliyet</Table.Th>
                            <Table.Th>Durum</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {bordroList.map((bordro) => (
                            <Table.Tr key={bordro.id}>
                              <Table.Td>
                                <Text size="sm" fw={500}>{bordro.ad} {bordro.soyad}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm">{formatMoney(bordro.brut_toplam)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" c="orange">{formatMoney(bordro.toplam_isci_sgk)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm">{formatMoney(bordro.gelir_vergisi)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm">{formatMoney(bordro.damga_vergisi)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" c="teal">+{formatMoney(bordro.agi_tutari)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" fw={600} c="green">{formatMoney(bordro.net_maas)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" c="orange">{formatMoney(bordro.toplam_isveren_sgk)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" fw={600} c="red">{formatMoney(bordro.toplam_maliyet)}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge 
                                  color={bordro.odeme_durumu === 'odendi' ? 'green' : 'orange'} 
                                  variant="light"
                                >
                                  {bordro.odeme_durumu === 'odendi' ? 'Ödendi' : 'Bekliyor'}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
                </Card>

                {/* SGK Bilgi Kartı */}
                <Card withBorder shadow="sm" p="lg" radius="md">
                  <Text fw={600} size="lg" mb="md">📋 SGK ve Vergi Oranları (2026)</Text>
                  <SimpleGrid cols={{ base: 1, md: 3 }}>
                    <Paper withBorder p="md" radius="md">
                      <Text fw={600} mb="xs" c="blue">İşçi Kesintileri</Text>
                      <Stack gap={4}>
                        <Group justify="space-between">
                          <Text size="sm">SGK Primi:</Text>
                          <Text size="sm" fw={500}>%14</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">İşsizlik Sigortası:</Text>
                          <Text size="sm" fw={500}>%1</Text>
                        </Group>
                        <Divider my="xs" />
                        <Group justify="space-between">
                          <Text size="sm" fw={600}>Toplam:</Text>
                          <Text size="sm" fw={600} c="blue">%15</Text>
                        </Group>
                      </Stack>
                    </Paper>
                    <Paper withBorder p="md" radius="md">
                      <Text fw={600} mb="xs" c="orange">İşveren Kesintileri</Text>
                      <Stack gap={4}>
                        <Group justify="space-between">
                          <Text size="sm">SGK Primi:</Text>
                          <Text size="sm" fw={500}>%15.5</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">İşsizlik Sigortası:</Text>
                          <Text size="sm" fw={500}>%2</Text>
                        </Group>
                        <Divider my="xs" />
                        <Group justify="space-between">
                          <Text size="sm" fw={600}>Toplam:</Text>
                          <Text size="sm" fw={600} c="orange">%17.5</Text>
                        </Group>
                      </Stack>
                    </Paper>
                    <Paper withBorder p="md" radius="md">
                      <Text fw={600} mb="xs" c="violet">Vergiler</Text>
                      <Stack gap={4}>
                        <Group justify="space-between">
                          <Text size="sm">Damga Vergisi:</Text>
                          <Text size="sm" fw={500}>%0.759</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm">Gelir Vergisi:</Text>
                          <Text size="sm" fw={500}>%15-%40</Text>
                        </Group>
                        <Text size="xs" c="dimmed" mt="xs">
                          Gelir vergisi kümülatif matrah dilimlerine göre hesaplanır.
                        </Text>
                      </Stack>
                    </Paper>
                  </SimpleGrid>
                </Card>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>

        {/* Personel Modal */}
        <Modal 
          opened={personelModalOpened} 
          onClose={() => { resetPersonelForm(); closePersonelModal(); }} 
          title={<Text fw={600} size="lg">{editingPersonel ? 'Personel Düzenle' : 'Yeni Personel'}</Text>} 
          size="xl"
        >
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <TextInput label="Ad" placeholder="Ad" required value={personelForm.ad} onChange={(e) => setPersonelForm({ ...personelForm, ad: e.currentTarget.value })} />
              <TextInput label="Soyad" placeholder="Soyad" required value={personelForm.soyad} onChange={(e) => setPersonelForm({ ...personelForm, soyad: e.currentTarget.value })} />
            </SimpleGrid>

            <SimpleGrid cols={2}>
              <TextInput label="TC Kimlik No" placeholder="11 haneli" required value={personelForm.tc_kimlik} onChange={(e) => setPersonelForm({ ...personelForm, tc_kimlik: e.currentTarget.value })} leftSection={<IconId size={16} />} />
              <TextInput label="Sicil No" placeholder="Sicil numarası" value={personelForm.sicil_no} onChange={(e) => setPersonelForm({ ...personelForm, sicil_no: e.currentTarget.value })} />
            </SimpleGrid>

            <SimpleGrid cols={2}>
              <TextInput label="Telefon" placeholder="0xxx xxx xxxx" value={personelForm.telefon} onChange={(e) => setPersonelForm({ ...personelForm, telefon: e.currentTarget.value })} leftSection={<IconPhone size={16} />} />
              <TextInput label="E-posta" placeholder="email@firma.com" value={personelForm.email} onChange={(e) => setPersonelForm({ ...personelForm, email: e.currentTarget.value })} leftSection={<IconMail size={16} />} />
            </SimpleGrid>

            <SimpleGrid cols={2}>
              <Select 
                label="Departman" 
                placeholder="Seçin" 
                data={departmanlar} 
                value={personelForm.departman} 
                onChange={(v) => setPersonelForm({ ...personelForm, departman: v || '', pozisyon: '' })} 
              />
              <Select 
                label="Pozisyon" 
                placeholder="Seçin" 
                data={personelForm.departman ? pozisyonlar[personelForm.departman] || [] : []} 
                value={personelForm.pozisyon} 
                onChange={(v) => setPersonelForm({ ...personelForm, pozisyon: v || '' })} 
                disabled={!personelForm.departman} 
              />
            </SimpleGrid>

            <SimpleGrid cols={3}>
              <DatePickerInput 
                label="İşe Giriş Tarihi" 
                leftSection={<IconCalendar size={16} />} 
                value={personelForm.ise_giris_tarihi} 
                onChange={(v) => setPersonelForm({ ...personelForm, ise_giris_tarihi: v || new Date() })} 
                locale="tr" 
                required
              />
              <NumberInput 
                label="Net Maaş (₺)" 
                description="Personelin eline geçecek tutar"
                value={personelForm.maas} 
                onChange={(v) => setPersonelForm({ ...personelForm, maas: Number(v) || 0 })} 
                min={0} 
                thousandSeparator="." 
                decimalSeparator="," 
              />
              <Select 
                label="Durum" 
                data={[
                  { label: 'Aktif', value: 'aktif' }, 
                  { label: 'İzinli', value: 'izinli' }, 
                  { label: 'Pasif', value: 'pasif' }
                ]} 
                value={personelForm.durum} 
                onChange={(v) => setPersonelForm({ ...personelForm, durum: v || 'aktif' })} 
              />
            </SimpleGrid>

            <TextInput label="Adres" placeholder="Açık adres" value={personelForm.adres} onChange={(e) => setPersonelForm({ ...personelForm, adres: e.currentTarget.value })} />

            <Divider label="SGK ve Bordro Bilgileri" labelPosition="center" />

            <SimpleGrid cols={3}>
              <Select 
                label="Medeni Durum" 
                leftSection={<IconHeart size={16} />}
                data={[
                  { value: 'bekar', label: 'Bekar' },
                  { value: 'evli', label: 'Evli' }
                ]}
                value={personelForm.medeni_durum}
                onChange={(v) => setPersonelForm({ ...personelForm, medeni_durum: v || 'bekar' })}
              />
              <Checkbox 
                label="Eşi Çalışıyor mu?" 
                checked={personelForm.es_calisiyormu} 
                onChange={(e) => setPersonelForm({ ...personelForm, es_calisiyormu: e.currentTarget.checked })}
                disabled={personelForm.medeni_durum !== 'evli'}
                mt={30}
              />
              <NumberInput 
                label="Çocuk Sayısı" 
                value={personelForm.cocuk_sayisi} 
                onChange={(v) => setPersonelForm({ ...personelForm, cocuk_sayisi: Number(v) || 0 })} 
                min={0}
                max={10}
              />
            </SimpleGrid>

            <SimpleGrid cols={3}>
              <TextInput 
                label="SGK No" 
                placeholder="SGK sicil numarası" 
                value={personelForm.sgk_no} 
                onChange={(e) => setPersonelForm({ ...personelForm, sgk_no: e.currentTarget.value })} 
              />
              <NumberInput 
                label="Yemek Yardımı (₺)" 
                value={personelForm.yemek_yardimi} 
                onChange={(v) => setPersonelForm({ ...personelForm, yemek_yardimi: Number(v) || 0 })} 
                min={0}
                thousandSeparator="."
                decimalSeparator=","
              />
              <NumberInput 
                label="Yol Yardımı (₺)" 
                value={personelForm.yol_yardimi} 
                onChange={(v) => setPersonelForm({ ...personelForm, yol_yardimi: Number(v) || 0 })} 
                min={0}
                thousandSeparator="."
                decimalSeparator=","
              />
            </SimpleGrid>

            <Divider label="Acil Durum İletişim" labelPosition="center" />

            <SimpleGrid cols={2}>
              <TextInput label="Acil Durumda Aranacak Kişi" placeholder="Ad Soyad" value={personelForm.acil_kisi} onChange={(e) => setPersonelForm({ ...personelForm, acil_kisi: e.currentTarget.value })} />
              <TextInput label="Acil Durum Telefonu" placeholder="0xxx xxx xxxx" value={personelForm.acil_telefon} onChange={(e) => setPersonelForm({ ...personelForm, acil_telefon: e.currentTarget.value })} />
            </SimpleGrid>

            <Textarea label="Notlar" placeholder="Ek notlar..." rows={2} value={personelForm.notlar} onChange={(e) => setPersonelForm({ ...personelForm, notlar: e.currentTarget.value })} />

            {/* Gerçek Maliyet Hesabı */}
            {personelForm.maas > 0 && (
              <Paper withBorder p="md" radius="md" bg={isDark ? 'dark.6' : 'violet.0'}>
                <Group gap="xs" mb="sm" justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon size="sm" color="violet" variant="filled" radius="xl">
                      <IconCalculator size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm">Maliyet Hesabı</Text>
                  </Group>
                  {maasHesaplaniyor && <Loader size="xs" color="violet" />}
                </Group>
                
                {maasOnizleme ? (
                  <>
                    {/* Ana Bilgiler */}
                    <SimpleGrid cols={3} mb="md">
                      <Paper withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'white'}>
                        <Text size="xs" c="dimmed">Net Maaş (Eline Geçecek)</Text>
                        <Text fw={700} size="lg" c="green">{formatMoney(maasOnizleme.net_maas)}</Text>
                      </Paper>
                      <Paper withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'white'}>
                        <Text size="xs" c="dimmed">Brüt Maaş</Text>
                        <Text fw={700} size="lg">{formatMoney(maasOnizleme.brut_maas)}</Text>
                      </Paper>
                      <Paper withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'white'}>
                        <Text size="xs" c="dimmed">Toplam Maliyet</Text>
                        <Text fw={700} size="lg" c="red">{formatMoney(maasOnizleme.toplam_maliyet)}</Text>
                      </Paper>
                    </SimpleGrid>

                    {/* Detaylı Kesintiler */}
                    <SimpleGrid cols={2} mb="md">
                      <Box>
                        <Text size="xs" fw={600} c="blue" mb="xs">📋 İşçi Kesintileri</Text>
                        <Stack gap={4}>
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">SGK Primi (%14)</Text>
                            <Text size="xs" fw={500} c="orange">-{formatMoney(maasOnizleme.sgk_isci)}</Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">İşsizlik Sigortası (%1)</Text>
                            <Text size="xs" fw={500} c="orange">-{formatMoney(maasOnizleme.issizlik_isci)}</Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Gelir Vergisi</Text>
                            <Text size="xs" fw={500} c="orange">-{formatMoney(maasOnizleme.gelir_vergisi)}</Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Damga Vergisi (%0.759)</Text>
                            <Text size="xs" fw={500} c="orange">-{formatMoney(maasOnizleme.damga_vergisi)}</Text>
                          </Group>
                          <Divider my={4} />
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">AGİ (Asgari Geçim İndirimi)</Text>
                            <Text size="xs" fw={500} c="teal">+{formatMoney(maasOnizleme.agi_tutari)}</Text>
                          </Group>
                        </Stack>
                      </Box>
                      <Box>
                        <Text size="xs" fw={600} c="red" mb="xs">🏢 İşveren Kesintileri</Text>
                        <Stack gap={4}>
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">SGK İşveren (%15.5)</Text>
                            <Text size="xs" fw={500} c="red">+{formatMoney(maasOnizleme.sgk_isveren)}</Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">İşsizlik İşveren (%2)</Text>
                            <Text size="xs" fw={500} c="red">+{formatMoney(maasOnizleme.issizlik_isveren)}</Text>
                          </Group>
                          <Divider my={4} />
                          <Group justify="space-between">
                            <Text size="xs" fw={600}>Toplam İşveren SGK</Text>
                            <Text size="xs" fw={600} c="red">{formatMoney(maasOnizleme.sgk_isveren + maasOnizleme.issizlik_isveren)}</Text>
                          </Group>
                        </Stack>
                      </Box>
                    </SimpleGrid>

                    <Alert variant="light" color="violet" radius="md" p="xs">
                      <Text size="xs">
                        💡 Bu personel için <strong>aylık toplam maliyetiniz {formatMoney(maasOnizleme.toplam_maliyet)}</strong> olacaktır. 
                        Personelin eline <strong>{formatMoney(maasOnizleme.net_maas)}</strong> geçecektir.
                      </Text>
                    </Alert>
                  </>
                ) : (
                  <Center py="md">
                    <Text size="sm" c="dimmed">Hesaplanıyor...</Text>
                  </Center>
                )}
              </Paper>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => { resetPersonelForm(); closePersonelModal(); }}>İptal</Button>
              <Button color="violet" onClick={handleSavePersonel}>{editingPersonel ? 'Güncelle' : 'Kaydet'}</Button>
            </Group>
          </Stack>
        </Modal>

        {/* Proje Modal */}
        <Modal 
          opened={projeModalOpened} 
          onClose={() => { resetProjeForm(); closeProjeModal(); }} 
          title={<Text fw={600} size="lg">{editingProje ? 'Proje Düzenle' : 'Yeni Proje'}</Text>} 
          size="lg"
        >
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <TextInput label="Proje Adı" placeholder="Proje adı" required value={projeForm.ad} onChange={(e) => setProjeForm({ ...projeForm, ad: e.currentTarget.value })} />
              <TextInput label="Proje Kodu" placeholder="PRJ-001" value={projeForm.kod} onChange={(e) => setProjeForm({ ...projeForm, kod: e.currentTarget.value })} />
            </SimpleGrid>

            <SimpleGrid cols={2}>
              <TextInput label="Müşteri" placeholder="Müşteri adı" value={projeForm.musteri} onChange={(e) => setProjeForm({ ...projeForm, musteri: e.currentTarget.value })} />
              <TextInput label="Lokasyon" placeholder="Şehir / Adres" value={projeForm.lokasyon} onChange={(e) => setProjeForm({ ...projeForm, lokasyon: e.currentTarget.value })} leftSection={<IconMapPin size={16} />} />
            </SimpleGrid>

            <SimpleGrid cols={3}>
              <DatePickerInput 
                label="Başlangıç Tarihi" 
                leftSection={<IconCalendar size={16} />} 
                value={projeForm.baslangic_tarihi} 
                onChange={(v) => setProjeForm({ ...projeForm, baslangic_tarihi: v })} 
                locale="tr"
                clearable
              />
              <DatePickerInput 
                label="Bitiş Tarihi" 
                leftSection={<IconCalendar size={16} />} 
                value={projeForm.bitis_tarihi} 
                onChange={(v) => setProjeForm({ ...projeForm, bitis_tarihi: v })} 
                locale="tr"
                clearable
              />
              <Select 
                label="Durum" 
                data={[
                  { label: 'Aktif', value: 'aktif' }, 
                  { label: 'Beklemede', value: 'beklemede' }, 
                  { label: 'Tamamlandı', value: 'tamamlandi' },
                  { label: 'Pasif', value: 'pasif' }
                ]} 
                value={projeForm.durum} 
                onChange={(v) => setProjeForm({ ...projeForm, durum: v || 'aktif' })} 
              />
            </SimpleGrid>

            <NumberInput 
              label="Bütçe (₺)" 
              value={projeForm.butce} 
              onChange={(v) => setProjeForm({ ...projeForm, butce: Number(v) || 0 })} 
              min={0} 
              thousandSeparator="." 
              decimalSeparator="," 
            />

            <Textarea label="Açıklama" placeholder="Proje hakkında notlar..." rows={3} value={projeForm.aciklama} onChange={(e) => setProjeForm({ ...projeForm, aciklama: e.currentTarget.value })} />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => { resetProjeForm(); closeProjeModal(); }}>İptal</Button>
              <Button color="cyan" onClick={handleSaveProje}>{editingProje ? 'Güncelle' : 'Kaydet'}</Button>
            </Group>
          </Stack>
        </Modal>

        {/* Detay Modal */}
        <Modal 
          opened={detailModalOpened} 
          onClose={closeDetailModal} 
          title={<Text fw={600} size="lg">Personel Detayı</Text>} 
          size="lg"
        >
          {selectedPersonel && (
            <Stack gap="md">
              <Group>
                <Avatar size="xl" color={getAvatarColor(selectedPersonel.departman)} radius="xl">
                  {selectedPersonel.ad[0]}{selectedPersonel.soyad[0]}
                </Avatar>
                <div>
                  <Text size="xl" fw={700}>{selectedPersonel.ad} {selectedPersonel.soyad}</Text>
                  <Group gap="xs">
                    <Badge variant="light" color={getAvatarColor(selectedPersonel.departman)}>{selectedPersonel.departman || 'Belirsiz'}</Badge>
                    <Text c="dimmed">{selectedPersonel.pozisyon || '-'}</Text>
                    {getDurumBadge(selectedPersonel.durum || 'aktif')}
                  </Group>
                </div>
              </Group>

              <Divider />

              <SimpleGrid cols={2}>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>İletişim</Text>
                  <Stack gap="xs" mt="sm">
                    <Group gap="xs"><IconPhone size={14} /><Text size="sm">{selectedPersonel.telefon || '-'}</Text></Group>
                    <Group gap="xs"><IconMail size={14} /><Text size="sm">{selectedPersonel.email || '-'}</Text></Group>
                    <Group gap="xs"><IconId size={14} /><Text size="sm">TC: {selectedPersonel.tc_kimlik}</Text></Group>
                  </Stack>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Çalışma Bilgileri</Text>
                  <Stack gap="xs" mt="sm">
                    <Group justify="space-between">
                      <Text size="sm">İşe Giriş:</Text>
                      <Text size="sm">{formatDate(selectedPersonel.ise_giris_tarihi)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Çalışma Süresi:</Text>
                      <Text size="sm">{getCalismaSuresi(selectedPersonel.ise_giris_tarihi)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>Net Maaş:</Text>
                      <Text size="lg" fw={700} c="green">{formatMoney(selectedPersonel.maas)}</Text>
                    </Group>
                  </Stack>
                </Paper>
              </SimpleGrid>

              {/* Maliyet Bilgileri */}
              {detayMaliyet && (
                <Paper withBorder p="md" radius="md" bg={isDark ? 'dark.6' : 'violet.0'}>
                  <Group gap="xs" mb="md">
                    <ThemeIcon size="sm" color="violet" variant="filled" radius="xl">
                      <IconReceipt size={14} />
                    </ThemeIcon>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Maaş ve Maliyet Detayı</Text>
                  </Group>
                  
                  <SimpleGrid cols={3} mb="md">
                    <Paper withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'white'}>
                      <Text size="xs" c="dimmed">Net Maaş</Text>
                      <Text fw={700} c="green">{formatMoney(detayMaliyet.net_maas)}</Text>
                    </Paper>
                    <Paper withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'white'}>
                      <Text size="xs" c="dimmed">Brüt Maaş</Text>
                      <Text fw={700}>{formatMoney(detayMaliyet.brut_maas)}</Text>
                    </Paper>
                    <Paper withBorder p="sm" radius="sm" bg={isDark ? 'dark.7' : 'white'}>
                      <Text size="xs" c="dimmed">Toplam Maliyet</Text>
                      <Text fw={700} c="red">{formatMoney(detayMaliyet.toplam_maliyet)}</Text>
                    </Paper>
                  </SimpleGrid>

                  <SimpleGrid cols={2}>
                    <Box>
                      <Text size="xs" fw={600} c="blue" mb="xs">İşçi Kesintileri</Text>
                      <Stack gap={2}>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">SGK (%14)</Text>
                          <Text size="xs" c="orange">-{formatMoney(detayMaliyet.sgk_isci)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">İşsizlik (%1)</Text>
                          <Text size="xs" c="orange">-{formatMoney(detayMaliyet.issizlik_isci)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">Gelir Vergisi</Text>
                          <Text size="xs" c="orange">-{formatMoney(detayMaliyet.gelir_vergisi)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">Damga Vergisi</Text>
                          <Text size="xs" c="orange">-{formatMoney(detayMaliyet.damga_vergisi)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">AGİ</Text>
                          <Text size="xs" c="teal">+{formatMoney(detayMaliyet.agi_tutari)}</Text>
                        </Group>
                      </Stack>
                    </Box>
                    <Box>
                      <Text size="xs" fw={600} c="red" mb="xs">İşveren Kesintileri</Text>
                      <Stack gap={2}>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">SGK İşveren (%15.5)</Text>
                          <Text size="xs" c="red">+{formatMoney(detayMaliyet.sgk_isveren)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">İşsizlik İşveren (%2)</Text>
                          <Text size="xs" c="red">+{formatMoney(detayMaliyet.issizlik_isveren)}</Text>
                        </Group>
                        <Divider my={4} />
                        <Group justify="space-between">
                          <Text size="xs" fw={600}>Toplam İşveren SGK</Text>
                          <Text size="xs" fw={600} c="red">{formatMoney(detayMaliyet.sgk_isveren + detayMaliyet.issizlik_isveren)}</Text>
                        </Group>
                      </Stack>
                    </Box>
                  </SimpleGrid>
                </Paper>
              )}

              {/* Projeler */}
              <Paper withBorder p="md" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">Görevli Olduğu Projeler</Text>
                {selectedPersonel.projeler && selectedPersonel.projeler.length > 0 ? (
                  <Stack gap="xs">
                    {selectedPersonel.projeler.map((pr, i) => (
                      <Group key={i} justify="space-between" p="xs" style={{ borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                        <Group gap="sm">
                          <ThemeIcon color="cyan" variant="light" size="sm"><IconBuilding size={14} /></ThemeIcon>
                          <div>
                            <Text size="sm" fw={500}>{pr.proje_ad}</Text>
                            <Text size="xs" c="dimmed">{pr.gorev || 'Görev belirtilmemiş'} • {formatDate(pr.baslangic_tarihi)}'den beri</Text>
                          </div>
                        </Group>
                        {pr.atama_id && (
                          <ActionIcon 
                            variant="subtle" 
                            color="red" 
                            size="sm"
                            onClick={() => handleRemoveAtama(pr.atama_id!)}
                          >
                            <IconUserMinus size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    ))}
                  </Stack>
                ) : (
                  <Text c="dimmed" size="sm">Henüz bir projeye atanmamış</Text>
                )}
              </Paper>

              {(selectedPersonel.acil_kisi || selectedPersonel.notlar) && (
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Ek Bilgiler</Text>
                  {selectedPersonel.acil_kisi && (
                    <Text size="sm" mt="xs">Acil Durum: {selectedPersonel.acil_kisi} - {selectedPersonel.acil_telefon}</Text>
                  )}
                  {selectedPersonel.notlar && <Text size="sm" mt="xs">Not: {selectedPersonel.notlar}</Text>}
                </Paper>
              )}

              <Group justify="flex-end">
                <Button 
                  variant="light" 
                  color="orange"
                  leftSection={<IconCoin size={16} />} 
                  onClick={() => handleKidemHesapla(selectedPersonel.id)}
                >
                  Kıdem Hesapla
                </Button>
                <Button variant="default" onClick={closeDetailModal}>Kapat</Button>
                <Button color="violet" leftSection={<IconEdit size={16} />} onClick={() => { closeDetailModal(); handleEditPersonel(selectedPersonel); }}>Düzenle</Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* İzin Talebi Modal */}
        <Modal 
          opened={izinModalOpened} 
          onClose={closeIzinModal} 
          title={<Text fw={600} size="lg">Yeni İzin Talebi</Text>} 
          size="md"
        >
          <Stack gap="md">
            <Select
              label="Personel"
              placeholder="Personel seçin"
              required
              data={personeller.map(p => ({ value: p.id.toString(), label: `${p.ad} ${p.soyad}` }))}
              value={izinForm.personel_id}
              onChange={(v) => setIzinForm({ ...izinForm, personel_id: v || '' })}
              searchable
            />
            <Select
              label="İzin Türü"
              placeholder="İzin türü seçin"
              required
              data={izinTurleri.map(t => ({ value: t.id.toString(), label: `${t.ad} ${t.ucretli ? '' : '(Ücretsiz)'}` }))}
              value={izinForm.izin_turu_id}
              onChange={(v) => setIzinForm({ ...izinForm, izin_turu_id: v || '' })}
            />
            <SimpleGrid cols={2}>
              <DatePickerInput
                label="Başlangıç Tarihi"
                placeholder="Tarih seçin"
                required
                locale="tr"
                value={izinForm.baslangic_tarihi}
                onChange={(v) => setIzinForm({ ...izinForm, baslangic_tarihi: v || new Date() })}
              />
              <DatePickerInput
                label="Bitiş Tarihi"
                placeholder="Tarih seçin"
                required
                locale="tr"
                value={izinForm.bitis_tarihi}
                onChange={(v) => setIzinForm({ ...izinForm, bitis_tarihi: v || new Date() })}
                minDate={izinForm.baslangic_tarihi}
              />
            </SimpleGrid>
            
            {izinForm.baslangic_tarihi && izinForm.bitis_tarihi && (
              <Alert color="blue" variant="light">
                <Text size="sm">
                  Toplam: <strong>{Math.ceil((izinForm.bitis_tarihi.getTime() - izinForm.baslangic_tarihi.getTime()) / (1000 * 60 * 60 * 24)) + 1} gün</strong>
                </Text>
              </Alert>
            )}

            <Textarea
              label="Açıklama"
              placeholder="İzin sebebi..."
              rows={2}
              value={izinForm.aciklama}
              onChange={(e) => setIzinForm({ ...izinForm, aciklama: e.currentTarget.value })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeIzinModal}>İptal</Button>
              <Button color="cyan" onClick={handleCreateIzin}>Talep Oluştur</Button>
            </Group>
          </Stack>
        </Modal>

        {/* Kıdem Hesaplama Modal */}
        <Modal 
          opened={kidemModalOpened} 
          onClose={closeKidemModal} 
          title={<Text fw={600} size="lg">💰 Kıdem ve Tazminat Hesabı</Text>} 
          size="lg"
        >
          {kidemHesap && (
            <Stack gap="md">
              {/* Personel Bilgisi */}
              <Paper withBorder p="md" radius="md" bg={isDark ? 'dark.6' : 'gray.0'}>
                <Group justify="space-between">
                  <div>
                    <Text fw={700} size="lg">{kidemHesap.personel.ad} {kidemHesap.personel.soyad}</Text>
                    <Text size="sm" c="dimmed">
                      Çalışma Süresi: {Math.floor(kidemHesap.calisma.toplam_yil)} yıl {Math.round((kidemHesap.calisma.toplam_yil % 1) * 12)} ay
                    </Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">Net Maaş</Text>
                    <Text fw={600} c="green">{formatMoney(kidemHesap.personel.net_maas)}</Text>
                  </div>
                </Group>
              </Paper>

              {/* Tazminat Detayları */}
              <SimpleGrid cols={2}>
                <Paper withBorder p="md" radius="md">
                  <Text fw={600} mb="sm" c="violet">🏆 Kıdem Tazminatı</Text>
                  {kidemHesap.kidem.hakki_var ? (
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">Tavan</Text>
                        <Text size="sm">{formatMoney(kidemHesap.kidem.tavan)}</Text>
                      </Group>
                      <Divider />
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>Tazminat</Text>
                        <Text size="lg" fw={700} c="violet">{formatMoney(kidemHesap.kidem.tazminat)}</Text>
                      </Group>
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">1 yıldan az çalışma veya istifa - hak yok</Text>
                  )}
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Text fw={600} mb="sm" c="orange">📋 İhbar Tazminatı</Text>
                  {kidemHesap.ihbar.hakki_var ? (
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">İhbar Süresi</Text>
                        <Text size="sm">{kidemHesap.ihbar.sure_hafta} hafta ({kidemHesap.ihbar.sure_gun} gün)</Text>
                      </Group>
                      <Divider />
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>Tazminat</Text>
                        <Text size="lg" fw={700} c="orange">{formatMoney(kidemHesap.ihbar.tazminat)}</Text>
                      </Group>
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">İstifa durumunda hak yok</Text>
                  )}
                </Paper>
              </SimpleGrid>

              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm" c="blue">🏖️ Kullanılmamış İzin Ücreti</Text>
                <SimpleGrid cols={3}>
                  <div>
                    <Text size="xs" c="dimmed">Yıllık Hak</Text>
                    <Text fw={600}>{kidemHesap.izin.yillik_hak} gün</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Kullanılan</Text>
                    <Text fw={600}>{kidemHesap.izin.kullanilan} gün</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Kalan ({kidemHesap.izin.kalan} gün)</Text>
                    <Text fw={600} c="blue">{formatMoney(kidemHesap.izin.ucret)}</Text>
                  </div>
                </SimpleGrid>
              </Paper>

              {/* Toplam */}
              <Paper withBorder p="lg" radius="md" bg={isDark ? 'green.9' : 'green.0'}>
                <Group justify="space-between">
                  <Text fw={700} size="lg">TOPLAM TAZMİNAT</Text>
                  <Text fw={700} size="xl" c="green">{formatMoney(kidemHesap.toplam_tazminat)}</Text>
                </Group>
              </Paper>

              <Alert color="yellow" variant="light">
                <Text size="xs">
                  ⚠️ Bu hesaplama tahminidir. Gerçek tazminat tutarları SGK ve vergi hesaplamalarına göre değişebilir.
                  Resmi işlemler için mali müşavirinize danışın.
                </Text>
              </Alert>

              <Group justify="flex-end">
                <Button variant="default" onClick={closeKidemModal}>Kapat</Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Atama Modal */}
        <Modal 
          opened={atamaModalOpened} 
          onClose={() => { closeAtamaModal(); setAtamaProjeId(null); }} 
          title={<Text fw={600} size="lg">Projeye Personel Ata</Text>} 
          size="lg"
        >
          <Stack gap="md">
            {atamaProjeId && (
              <Alert color="cyan" variant="light" icon={<IconBuilding size={16} />}>
                <Text fw={500}>{projeler.find(p => p.id === atamaProjeId)?.ad}</Text>
              </Alert>
            )}

            <MultiSelect
              label="Personel Seç"
              placeholder="Personelleri seçin..."
              data={personeller
                .filter(p => !p.projeler?.some(pr => pr.proje_id === atamaProjeId))
                .map(p => ({ value: p.id.toString(), label: `${p.ad} ${p.soyad} (${p.departman || 'Belirsiz'})` }))}
              value={atamaForm.personel_ids}
              onChange={(v) => setAtamaForm({ ...atamaForm, personel_ids: v })}
              searchable
              clearable
            />

            <TextInput 
              label="Görev" 
              placeholder="Projedeki görev (isteğe bağlı)" 
              value={atamaForm.gorev} 
              onChange={(e) => setAtamaForm({ ...atamaForm, gorev: e.currentTarget.value })} 
            />

            <DatePickerInput 
              label="Başlangıç Tarihi" 
              leftSection={<IconCalendar size={16} />} 
              value={atamaForm.baslangic_tarihi} 
              onChange={(v) => setAtamaForm({ ...atamaForm, baslangic_tarihi: v || new Date() })} 
              locale="tr" 
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => { closeAtamaModal(); setAtamaProjeId(null); }}>İptal</Button>
              <Button color="cyan" leftSection={<IconUserPlus size={16} />} onClick={handleAtamaSubmit}>
                {atamaForm.personel_ids.length} Personel Ata
              </Button>
            </Group>
          </Stack>
        </Modal>

        </Container>
    </Box>
  );
}
