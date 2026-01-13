'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  SimpleGrid,
  Grid,
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
  Progress,
  RingProgress,
  Alert,
  LoadingOverlay,
  Divider,
  Checkbox
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconPackage,
  IconPackages,
  IconAlertTriangle,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconCheck,
  IconTrendingUp,
  IconTrendingDown,
  IconArrowsExchange,
  IconBarcode,
  IconCategory,
  IconChartBar,
  IconBuilding,
  IconRefresh,
  IconTruck,
  IconX,
  IconAlertCircle,
  IconFileInvoice,
  IconLink,
  IconLinkOff,
  IconChevronDown,
  IconClipboardList,
  IconHistory,
  IconCalendar,
  IconShoppingCart
} from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { DataActions } from '@/components/DataActions';

// API URL
const API_URL = 'http://localhost:3001/api';

// Tip tanımları
interface StokItem {
  id: number;
  kod: string;
  ad: string;
  kategori: string;
  kategori_id?: number;
  birim: string;
  ana_birim_id?: number;
  toplam_stok: number;
  rezerve_stok?: number;
  kullanilabilir_stok?: number;
  min_stok: number;
  max_stok: number;
  kritik_stok: number;
  son_alis_fiyat: number;
  stok_deger?: number;
  tedarikci?: string;
  durum: 'normal' | 'dusuk' | 'kritik' | 'fazla' | 'tukendi';
  depo_durumlari?: DepoStok[];
}

interface DepoStok {
  depo_id: number;
  depo_kod: string;
  depo_ad: string;
  miktar: number;
  rezerve_miktar?: number;
  kullanilabilir?: number;
  lokasyon_kodu?: string;
}

interface Depo {
  id: number;
  kod: string;
  ad: string;
  tip: string;
  tur?: string;
  lokasyon?: string;
  adres?: string;
  sorumlu_kisi?: string;
  telefon?: string;
  email?: string;
  yetkili?: string;
  kapasite_m3?: number;
  urun_sayisi?: number;
  toplam_deger?: number;
  kritik_urun?: number;
  aktif: boolean;
}

interface Kategori {
  id: number;
  kod: string;
  ad: string;
  ust_kategori_id?: number;
  renk?: string;
}

interface Birim {
  id: number;
  kod: string;
  ad: string;
  kisa_ad: string;
  tip: string;
}

const COLORS = ['#4dabf7', '#51cf66', '#ff922b', '#ff6b6b', '#845ef7', '#339af0', '#20c997', '#f06595'];

function StokPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [opened, { open, close }] = useDisclosure(false);
  const [transferOpened, { open: openTransfer, close: closeTransfer }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [stoklar, setStoklar] = useState<StokItem[]>([]);
  const [tumStokSayisi, setTumStokSayisi] = useState<number>(0); // Toplam stok kartı sayısı
  const [depolar, setDepolar] = useState<Depo[]>([]);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [birimler, setBirimler] = useState<Birim[]>([]);
  const [selectedDepo, setSelectedDepo] = useState<number | null>(null);
  const [selectedLokasyon, setSelectedLokasyon] = useState<number | null>(null);
  const [selectedStoklar, setSelectedStoklar] = useState<number[]>([]);
  const [lokasyonlar, setLokasyonlar] = useState<any[]>([]);
  const [selectedStok, setSelectedStok] = useState<StokItem | null>(null);

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    stok_kart_id: 0,
    kaynak_depo_id: 0,
    hedef_depo_id: 0,
    miktar: 0,
    belge_no: '',
    aciklama: ''
  });
  
  // Yeni ürün formu
  const [urunForm, setUrunForm] = useState({
    kod: '',
    ad: '',
    kategori_id: '',
    ana_birim_id: '',
    barkod: '',
    min_stok: 0,
    max_stok: 0,
    son_alis_fiyat: 0,
    kdv_orani: 18,
    aciklama: ''
  });
  
  // Depo yönetimi state'leri
  const [depoModalOpened, setDepoModalOpened] = useState(false);
  const [editingDepo, setEditingDepo] = useState<Depo | null>(null);
  const [depoForm, setDepoForm] = useState({
    ad: '',
    kod: '',
    tur: 'genel',
    adres: '',
    telefon: '',
    email: '',
    yetkili: '',
    kapasite_m3: 0
  });
  
  // Faturadan stok girişi state'leri
  const [faturaModalOpened, setFaturaModalOpened] = useState(false);
  
  // Yeni modal state'leri
  const [stokGirisModalOpened, setStokGirisModalOpened] = useState(false);
  const [stokCikisModalOpened, setStokCikisModalOpened] = useState(false);
  const [sayimModalOpened, setSayimModalOpened] = useState(false);
  const [hareketlerModalOpened, setHareketlerModalOpened] = useState(false);
  
  // Stok girişi form state
  const [girisForm, setGirisForm] = useState({
    stok_kart_id: null as number | null,
    depo_id: null as number | null,
    miktar: 0,
    birim_fiyat: 0,
    giris_tipi: 'SATIN_ALMA',
    aciklama: ''
  });
  
  // Stok çıkışı form state
  const [cikisForm, setCikisForm] = useState({
    stok_kart_id: null as number | null,
    depo_id: null as number | null,
    miktar: 0,
    cikis_tipi: 'TUKETIM',
    aciklama: ''
  });
  
  // Stok hareketleri state
  const [hareketler, setHareketler] = useState<any[]>([]);
  const [hareketlerLoading, setHareketlerLoading] = useState(false);
  
  // Sayım state
  const [sayimDepoId, setSayimDepoId] = useState<number | null>(null);
  const [sayimVerileri, setSayimVerileri] = useState<{[key: number]: number}>({});
  const [faturalar, setFaturalar] = useState<any[]>([]);
  const [faturaLoading, setFaturaLoading] = useState(false);
  const [selectedFatura, setSelectedFatura] = useState<any>(null);
  const [faturaKalemler, setFaturaKalemler] = useState<any[]>([]);
  const [faturaGirisDepo, setFaturaGirisDepo] = useState<number | null>(null);
  const [kalemEslestirme, setKalemEslestirme] = useState<{[key: number]: number | null}>({});

  // Depo yönetimi fonksiyonları
  const handleEditDepo = (depoId: number) => {
    const depo = depolar.find(d => d.id === depoId);
    if (depo) {
      setEditingDepo(depo);
      setDepoForm({
        ad: depo.ad,
        kod: depo.kod,
        tur: depo.tur || 'genel',
        adres: depo.adres || '',
        telefon: depo.telefon || '',
        email: depo.email || '',
        yetkili: depo.yetkili || '',
        kapasite_m3: depo.kapasite_m3 || 0
      });
      setDepoModalOpened(true);
    }
  };

  const handleSaveDepo = async () => {
    try {
      setLoading(true);
      const url = editingDepo 
        ? `${API_URL}/stok/depolar/${editingDepo.id}`
        : `${API_URL}/stok/depolar`;
      
      const method = editingDepo ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(depoForm)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'İşlem başarısız');
      }

      notifications.show({
        title: 'Başarılı',
        message: editingDepo ? 'Depo güncellendi' : 'Depo eklendi',
        color: 'green'
      });

      setDepoModalOpened(false);
      setEditingDepo(null);
      setDepoForm({
        ad: '',
        kod: '',
        tur: 'genel',
        adres: '',
        telefon: '',
        email: '',
        yetkili: '',
        kapasite_m3: 0
      });
      
      await loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error?.message || 'Bir hata oluştu',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepo = async (depoId: number) => {
    if (!confirm('Bu depoyu silmek istediğinizden emin misiniz?')) return;
    
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/stok/depolar/${depoId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Silme işlemi başarısız');
      }

      notifications.show({
        title: 'Başarılı',
        message: 'Depo silindi',
        color: 'green'
      });

      await loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // API'den verileri yükle
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Paralel istekler
      const [stokRes, depoRes, katRes, birimRes] = await Promise.all([
        fetch(`${API_URL}/stok/kartlar?limit=100`),
        fetch(`${API_URL}/stok/depolar`),
        fetch(`${API_URL}/stok/kategoriler`),
        fetch(`${API_URL}/stok/birimler`)
      ]);

      if (!stokRes.ok || !depoRes.ok || !katRes.ok || !birimRes.ok) {
        throw new Error('Veri yüklenemedi');
      }

      const [stokData, depoData, katData, birimData] = await Promise.all([
        stokRes.json(),
        depoRes.json(),
        katRes.json(),
        birimRes.json()
      ]);

      const stokList = stokData.data || [];
      setStoklar(stokList);
      setTumStokSayisi(stokList.length); // Toplam stok kartı sayısını kaydet
      setDepolar(depoData.data || []);
      setKategoriler(katData.data || []);
      setBirimler(birimData.data || []);

    } catch (err) {
      console.error('Veri yükleme hatası:', err);
      setError('Veriler yüklenirken hata oluştu');
      notifications.show({
        title: 'Hata',
        message: 'Veriler yüklenemedi',
        color: 'red',
        icon: <IconAlertCircle />
      });
    } finally {
      setLoading(false);
    }
  };

  // Depo stoklarını yükle
  const loadDepoStoklar = async (depoId: number) => {
    setLoading(true);
    try {
      setSelectedDepo(depoId);
      setSelectedLokasyon(null);
      
      // Lokasyonları yükle
      const lokRes = await fetch(`${API_URL}/stok/depolar/${depoId}/lokasyonlar`);
      const lokResult = await lokRes.json();
      if (lokResult.success) {
        setLokasyonlar(lokResult.data || []);
      }
      
      // Stokları yükle
      const response = await fetch(`${API_URL}/stok/depolar/${depoId}/stoklar`);
      const result = await response.json();
      
      if (result.success) {
        setStoklar(result.data || []);
      }
    } catch (err) {
      console.error('Depo stok yükleme hatası:', err);
      notifications.show({
        title: 'Hata',
        message: 'Depo stokları yüklenemedi',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Lokasyon stoklarını yükle
  const loadLokasyonStoklar = async (lokasyonId: number) => {
    setLoading(true);
    try {
      setSelectedLokasyon(lokasyonId);
      
      const response = await fetch(`${API_URL}/stok/lokasyonlar/${lokasyonId}/stoklar`);
      const result = await response.json();
      
      if (result.success) {
        setStoklar(result.data || []);
      }
    } catch (err) {
      console.error('Lokasyon stok yükleme hatası:', err);
      notifications.show({
        title: 'Hata',
        message: 'Lokasyon stokları yüklenemedi',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Stok sil
  const handleDeleteStok = async (stokId: number) => {
    try {
      setLoading(true);
      
      const res = await fetch(`${API_URL}/stok/kartlar/${stokId}`, {
        method: 'DELETE'
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'Silme işlemi başarısız');
      }
      
      notifications.show({
        title: 'Başarılı',
        message: 'Ürün silindi',
        color: 'green',
        icon: <IconCheck />
      });
      
      // Listeyi yenile
      await loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setLoading(false);
    }
  };

  // Toplu stok sil
  const handleBulkDelete = async () => {
    if (selectedStoklar.length === 0) return;
    
    if (!confirm(`${selectedStoklar.length} ürünü silmek istediğinizden emin misiniz?`)) {
      return;
    }
    
    try {
      setLoading(true);
      let basarili = 0;
      let hatali = 0;
      
      for (const stokId of selectedStoklar) {
        try {
          const res = await fetch(`${API_URL}/stok/kartlar/${stokId}`, {
            method: 'DELETE'
          });
          if (res.ok) basarili++;
          else hatali++;
        } catch {
          hatali++;
        }
      }
      
      notifications.show({
        title: 'Toplu Silme Tamamlandı',
        message: `${basarili} ürün silindi${hatali > 0 ? `, ${hatali} hata` : ''}`,
        color: hatali > 0 ? 'yellow' : 'green',
        icon: <IconCheck />
      });
      
      setSelectedStoklar([]);
      await loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setLoading(false);
    }
  };

  // Tümünü seç/kaldır
  const handleSelectAll = () => {
    if (selectedStoklar.length === filteredStoklar.length) {
      setSelectedStoklar([]);
    } else {
      setSelectedStoklar(filteredStoklar.map(s => s.id));
    }
  };

  // Tek ürün seç/kaldır
  const handleSelectStok = (stokId: number) => {
    if (selectedStoklar.includes(stokId)) {
      setSelectedStoklar(selectedStoklar.filter(id => id !== stokId));
    } else {
      setSelectedStoklar([...selectedStoklar, stokId]);
    }
  };

  // Faturaları yükle
  const loadFaturalar = async () => {
    setFaturaLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/faturalar?limit=50`);
      const result = await response.json();
      if (result.success) {
        setFaturalar(result.data);
      }
    } catch (error: any) {
      console.error('Fatura yükleme hatası:', error);
    } finally {
      setFaturaLoading(false);
    }
  };

  // Fatura kalemlerini yükle
  const loadFaturaKalemler = async (ettn: string) => {
    setFaturaLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/faturalar/${ettn}/kalemler`);
      const result = await response.json();
      if (result.success) {
        setFaturaKalemler(result.kalemler);
        // Önerilen eşleştirmeleri otomatik doldur
        const eslestirmeler: {[key: number]: number | null} = {};
        result.kalemler.forEach((k: any) => {
          eslestirmeler[k.sira] = k.onerilen_stok_kart_id;
        });
        setKalemEslestirme(eslestirmeler);
      }
    } catch (error: any) {
      console.error('Fatura kalem hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Fatura kalemleri yüklenemedi',
        color: 'red'
      });
    } finally {
      setFaturaLoading(false);
    }
  };

  // Faturadan stok girişi yap
  const handleFaturaStokGirisi = async () => {
    if (!selectedFatura || !faturaGirisDepo) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen depo seçin',
        color: 'yellow'
      });
      return;
    }

    const eslesmisKalemler = faturaKalemler
      .filter(k => kalemEslestirme[k.sira])
      .map(k => ({
        kalem_sira: k.sira,
        stok_kart_id: kalemEslestirme[k.sira],
        miktar: k.miktar,
        birim_fiyat: k.birim_fiyat,
        urun_kodu: k.urun_kodu,
        urun_adi: k.urun_adi
      }));

    if (eslesmisKalemler.length === 0) {
      notifications.show({
        title: 'Uyarı',
        message: 'En az bir kalem eşleştirmeniz gerekiyor',
        color: 'yellow'
      });
      return;
    }

    setFaturaLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/faturadan-giris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ettn: selectedFatura.ettn,
          depo_id: faturaGirisDepo,
          kalemler: eslesmisKalemler
        })
      });

      const result = await response.json();

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: result.message,
          color: 'green',
          icon: <IconCheck />
        });
        setFaturaModalOpened(false);
        setSelectedFatura(null);
        setFaturaKalemler([]);
        setKalemEslestirme({});
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red'
      });
    } finally {
      setFaturaLoading(false);
    }
  };

  // Stok kartı arama
  const [stokAramaQuery, setStokAramaQuery] = useState('');
  const [stokAramaSonuclari, setStokAramaSonuclari] = useState<any[]>([]);
  
  const araStokKarti = async (query: string) => {
    if (query.length < 2) {
      setStokAramaSonuclari([]);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/stok/kartlar/ara?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      if (result.success) {
        setStokAramaSonuclari(result.data);
      }
    } catch (error: any) {
      console.error('Stok arama hatası:', error);
    }
  };

  // Yeni ürün kaydet
  const handleSaveUrun = async () => {
    if (!urunForm.kod || !urunForm.ad || !urunForm.kategori_id || !urunForm.ana_birim_id) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen zorunlu alanları doldurun',
        color: 'yellow',
        icon: <IconAlertTriangle />
      });
      return;
    }
    
    try {
      setLoading(true);
      
      const res = await fetch(`${API_URL}/stok/kartlar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...urunForm,
          kategori_id: parseInt(urunForm.kategori_id),
          ana_birim_id: parseInt(urunForm.ana_birim_id)
        })
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'Kayıt başarısız');
      }
      
      notifications.show({
        title: 'Başarılı',
        message: 'Yeni ürün eklendi',
        color: 'green',
        icon: <IconCheck />
      });
      
      close();
      setUrunForm({
        kod: '',
        ad: '',
        kategori_id: '',
        ana_birim_id: '',
        barkod: '',
        min_stok: 0,
        max_stok: 0,
        son_alis_fiyat: 0,
        kdv_orani: 18,
        aciklama: ''
      });
      await loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setLoading(false);
    }
  };

  // Stok detayını yükle
  const loadStokDetay = async (stokId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/kartlar/${stokId}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedStok(result.data);
      }
    } catch (err) {
      console.error('Stok detay yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  // Transfer yap
  const handleTransfer = async () => {
    if (!transferForm.stok_kart_id || !transferForm.kaynak_depo_id || 
        !transferForm.hedef_depo_id || transferForm.miktar <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen tüm alanları doldurun',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/hareketler/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...transferForm,
          belge_no: transferForm.belge_no || `TRF-${Date.now()}`,
          belge_tarihi: new Date().toISOString().split('T')[0]
        })
      });

      const result = await response.json();

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: result.message,
          color: 'green',
          icon: <IconCheck />
        });
        closeTransfer();
        loadData(); // Verileri yenile
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Transfer başarısız',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Stok girişi yap
  const handleStokGiris = async () => {
    if (!girisForm.stok_kart_id || !girisForm.depo_id || girisForm.miktar <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen ürün, depo ve miktar seçin',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/hareketler/giris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stok_kart_id: girisForm.stok_kart_id,
          depo_id: girisForm.depo_id,
          miktar: girisForm.miktar,
          birim_fiyat: girisForm.birim_fiyat || 0,
          belge_no: `GRS-${Date.now()}`,
          belge_tarihi: new Date().toISOString().split('T')[0],
          aciklama: `${girisForm.giris_tipi}: ${girisForm.aciklama}`
        })
      });

      const result = await response.json();

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Stok girişi yapıldı',
          color: 'green',
          icon: <IconCheck />
        });
        setStokGirisModalOpened(false);
        setGirisForm({ stok_kart_id: null, depo_id: null, miktar: 0, birim_fiyat: 0, giris_tipi: 'SATIN_ALMA', aciklama: '' });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Stok girişi başarısız',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Stok çıkışı yap
  const handleStokCikis = async () => {
    if (!cikisForm.stok_kart_id || !cikisForm.depo_id || cikisForm.miktar <= 0) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen ürün, depo ve miktar seçin',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/hareketler/cikis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stok_kart_id: cikisForm.stok_kart_id,
          depo_id: cikisForm.depo_id,
          miktar: cikisForm.miktar,
          belge_no: `CKS-${Date.now()}`,
          belge_tarihi: new Date().toISOString().split('T')[0],
          aciklama: `${cikisForm.cikis_tipi}: ${cikisForm.aciklama}`
        })
      });

      const result = await response.json();

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Stok çıkışı yapıldı',
          color: 'green',
          icon: <IconCheck />
        });
        setStokCikisModalOpened(false);
        setCikisForm({ stok_kart_id: null, depo_id: null, miktar: 0, cikis_tipi: 'TUKETIM', aciklama: '' });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Stok çıkışı başarısız',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Stok hareketlerini yükle
  const loadHareketler = async () => {
    setHareketlerLoading(true);
    try {
      const response = await fetch(`${API_URL}/stok/hareketler?limit=100`);
      const result = await response.json();
      if (result.success) {
        setHareketler(result.data || []);
      }
    } catch (error: any) {
      console.error('Hareketler yükleme hatası:', error);
    } finally {
      setHareketlerLoading(false);
    }
  };

  // Sayım için depo stoklarını yükle
  const loadSayimVerileri = async (depoId: number) => {
    setSayimDepoId(depoId);
    try {
      const response = await fetch(`${API_URL}/stok/depolar/${depoId}/stoklar`);
      const result = await response.json();
      if (result.success) {
        // Mevcut stokları sayım verilerine kopyala
        const initialSayim: {[key: number]: number} = {};
        result.data.forEach((item: any) => {
          initialSayim[item.id] = item.toplam_stok || 0;
        });
        setSayimVerileri(initialSayim);
      }
    } catch (error: any) {
      console.error('Sayım verileri yükleme hatası:', error);
    }
  };

  // Sayımı kaydet
  const handleSayimKaydet = async () => {
    if (!sayimDepoId) {
      notifications.show({ title: 'Hata', message: 'Lütfen depo seçin', color: 'red' });
      return;
    }

    setLoading(true);
    try {
      // Her ürün için fark varsa hareket oluştur
      let islemSayisi = 0;

      for (const item of filteredStoklar) {
        const sistemStok = item.toplam_stok || 0;
        const sayimStok = sayimVerileri[item.id] || 0;
        const fark = sayimStok - sistemStok;

        if (fark !== 0) {
          const endpoint = fark > 0 ? 'giris' : 'cikis';
          await fetch(`${API_URL}/stok/hareketler/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stok_kart_id: item.id,
              depo_id: sayimDepoId,
              miktar: Math.abs(fark),
              belge_no: `SAYIM-${Date.now()}`,
              belge_tarihi: new Date().toISOString().split('T')[0],
              aciklama: `Stok sayımı: ${fark > 0 ? 'Fazla' : 'Eksik'} (${Math.abs(fark)} ${item.birim})`
            })
          });
          islemSayisi++;
        }
      }

      notifications.show({
        title: 'Başarılı',
        message: `Sayım tamamlandı. ${islemSayisi} ürün güncellendi.`,
        color: 'green',
        icon: <IconCheck />
      });
      setSayimModalOpened(false);
      setSayimVerileri({});
      loadData();
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Sayım kaydedilemedi',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Component mount
  useEffect(() => {
    loadData();
  }, []);

  // URL'de fatura parametresi varsa modalı aç ve o faturayı seç
  useEffect(() => {
    const faturaParam = searchParams.get('fatura');
    if (faturaParam && depolar.length > 0) {
      // Önce faturaları yükle, sonra ilgili faturayı seç
      const loadAndSelectFatura = async () => {
        setFaturaLoading(true);
        try {
          const response = await fetch(`${API_URL}/stok/faturalar?limit=100`);
          const result = await response.json();
          if (result.success) {
            setFaturalar(result.data);
            // Gelen faturalardan parametredeki ETTN'i bul
            const targetFatura = result.data.find((f: any) => f.ettn === faturaParam);
            if (targetFatura) {
              setSelectedFatura(targetFatura);
              setFaturaModalOpened(true);
              // Fatura kalemlerini yükle
              loadFaturaKalemler(faturaParam);
            } else {
              notifications.show({
                title: 'Uyarı',
                message: 'Fatura bulunamadı veya zaten işlenmiş',
                color: 'yellow'
              });
            }
          }
        } catch (error: any) {
          console.error('Fatura yükleme hatası:', error);
        } finally {
          setFaturaLoading(false);
        }
      };
      loadAndSelectFatura();
      // URL'den parametreyi temizle
      router.replace('/muhasebe/stok');
    }
  }, [searchParams, depolar]);

  // Hareketler modalı açıldığında verileri yükle
  useEffect(() => {
    if (hareketlerModalOpened) {
      loadHareketler();
    }
  }, [hareketlerModalOpened]);

  // Miktar formatı (gereksiz ondalıkları kaldır)
  const formatMiktar = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    // Tam sayı ise ondalık gösterme, değilse en fazla 2 basamak
    if (Number.isInteger(num)) {
      return num.toLocaleString('tr-TR');
    }
    // Ondalık kısmı varsa, gereksiz sıfırları kaldır
    const formatted = num.toLocaleString('tr-TR', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    });
    return formatted;
  };

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      style: 'currency', 
      currency: 'TRY', 
      minimumFractionDigits: 0 
    }).format(value || 0);
  };

  // Filtreleme
  const filteredStoklar = stoklar.filter(item => {
    const matchesTab = activeTab === 'tumu' || 
                      (activeTab === 'kritik' && item.durum === 'kritik') ||
                      (activeTab === 'dusuk' && item.durum === 'dusuk');
    const matchesSearch = item.ad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.kod?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // İstatistikler
  const toplamKalem = stoklar.length;
  const kritikStok = stoklar.filter(s => s.durum === 'kritik').length;
  const toplamDeger = stoklar.reduce((acc, s) => acc + (s.toplam_stok * s.son_alis_fiyat), 0);
  const kategoriSayisi = [...new Set(stoklar.map(s => s.kategori))].length;

  // Kategori dağılımı (gerçek verilerle)
  const kategoriDagilimi = kategoriler.map(kat => ({
    name: kat.ad,
    value: stoklar
      .filter(s => s.kategori === kat.ad)
      .reduce((acc, s) => acc + (s.toplam_stok * s.son_alis_fiyat), 0)
  })).filter(k => k.value > 0);

  return (
    <Container fluid>
      <LoadingOverlay visible={loading} />
      
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      <Group justify="space-between" mb="md">
        <Group gap="md">
          <ThemeIcon size={42} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            <IconPackage size={24} />
          </ThemeIcon>
          <Box>
            <Title order={3}>Stok Yönetimi</Title>
            <Text size="xs" c="dimmed">Ürün ve malzeme stoklarınızı takip edin</Text>
          </Box>
        </Group>
        <Group gap="xs">
          <ActionIcon 
            variant="light" 
            size="lg" 
            radius="xl"
            onClick={() => loadData()}
            title="Yenile"
          >
            <IconRefresh size={18} />
          </ActionIcon>
          <Button 
            variant="light" 
            color="teal" 
            size="sm" 
            radius="xl" 
            leftSection={<IconBuilding size={16} />}
            onClick={() => setDepoModalOpened(true)}
          >
            Depo Ekle
          </Button>
          <Menu shadow="md" width={220}>
            <Menu.Target>
              <Button 
                variant="filled" 
                color="grape" 
                size="sm" 
                radius="xl" 
                leftSection={<IconPlus size={16} />}
                rightSection={<IconChevronDown size={14} />}
              >
                İşlemler
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Stok Hareketleri</Menu.Label>
              <Menu.Item leftSection={<IconTrendingUp size={16} color="green" />} onClick={() => setStokGirisModalOpened(true)}>
                Stok Girişi
              </Menu.Item>
              <Menu.Item leftSection={<IconTrendingDown size={16} color="red" />} onClick={() => setStokCikisModalOpened(true)}>
                Stok Çıkışı
              </Menu.Item>
              <Menu.Item leftSection={<IconArrowsExchange size={16} color="blue" />} onClick={openTransfer}>
                Depolar Arası Transfer
              </Menu.Item>
              <Menu.Item leftSection={<IconClipboardList size={16} color="orange" />} onClick={() => setSayimModalOpened(true)}>
                Stok Sayımı
              </Menu.Item>
              
              <Menu.Divider />
              <Menu.Label>Ürün İşlemleri</Menu.Label>
              <Menu.Item 
                leftSection={<IconFileInvoice size={16} color="teal" />} 
                onClick={() => {
                  setFaturaModalOpened(true);
                  loadFaturalar();
                }}
              >
                Faturadan Ekle
              </Menu.Item>
              <Menu.Item leftSection={<IconPlus size={16} color="grape" />} onClick={open}>
                Yeni Ürün
              </Menu.Item>
              
              <Menu.Divider />
              <Menu.Item leftSection={<IconHistory size={16} color="gray" />} onClick={() => setHareketlerModalOpened(true)}>
                Hareketleri Görüntüle
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <DataActions 
            type="stok" 
            onImportSuccess={() => loadData()}
            kategoriler={kategoriler.map(k => k.ad)}
          />
        </Group>
      </Group>

      {/* Modern İstatistik Kartları */}
      <Paper 
        p="md" 
        radius="lg" 
        mb="lg"
        style={{ 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
          border: '1px solid var(--mantine-color-gray-2)'
        }}
      >
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Box ta="center" py="xs">
            <Text size="2rem" fw={800} c="blue">{toplamKalem}</Text>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">Toplam Ürün</Text>
          </Box>
          <Box ta="center" py="xs" style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}>
            <Text size="2rem" fw={800} c="red">{kritikStok}</Text>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">Kritik Stok</Text>
          </Box>
          <Box ta="center" py="xs" style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}>
            <Text size="2rem" fw={800} c="teal">{formatMoney(toplamDeger)}</Text>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">Stok Değeri</Text>
          </Box>
          <Box ta="center" py="xs" style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}>
            <Text size="2rem" fw={800} c="grape">{kategoriSayisi}</Text>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">Kategori</Text>
          </Box>
        </SimpleGrid>
      </Paper>

      {/* Modern Depo Seçimi */}
      <Box mb="lg">
        <Group gap="md" wrap="wrap">
          {/* Tüm Depolar Kartı */}
          <Box
            onClick={() => { setSelectedDepo(null); loadData(); }}
            style={{
              cursor: 'pointer',
              padding: '14px 20px',
              borderRadius: '16px',
              background: selectedDepo === null 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'white',
              color: selectedDepo === null ? 'white' : '#495057',
              boxShadow: selectedDepo === null 
                ? '0 4px 15px rgba(102, 126, 234, 0.4)' 
                : '0 2px 10px rgba(0,0,0,0.08)',
              transition: 'all 0.3s ease',
              border: selectedDepo === null ? 'none' : '1px solid #e9ecef',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: '150px'
            }}
          >
            <Box style={{ 
              background: selectedDepo === null ? 'rgba(255,255,255,0.2)' : '#667eea15',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex'
            }}>
              <IconPackages size={22} color={selectedDepo === null ? 'white' : '#667eea'} />
            </Box>
            <Stack gap={2}>
              <Text size="xs" fw={500} style={{ opacity: 0.85 }}>Tüm Depolar</Text>
              <Text size="lg" fw={700}>{tumStokSayisi} <Text span size="sm" fw={400}>ürün</Text></Text>
            </Stack>
          </Box>

          {/* Depo Kartları */}
          {depolar.map((depo, index) => {
            const colors = [
              { from: '#11998e', to: '#38ef7d', shadow: 'rgba(17, 153, 142, 0.4)' },
              { from: '#ee0979', to: '#ff6a00', shadow: 'rgba(238, 9, 121, 0.4)' },
              { from: '#2193b0', to: '#6dd5ed', shadow: 'rgba(33, 147, 176, 0.4)' },
              { from: '#8E2DE2', to: '#4A00E0', shadow: 'rgba(142, 45, 226, 0.4)' },
            ];
            const colorSet = colors[index % colors.length];
            const isSelected = selectedDepo === depo.id;
            
            return (
              <Box
                key={depo.id}
                style={{
                  cursor: 'pointer',
                  padding: '14px 20px',
                  borderRadius: '16px',
                  background: isSelected 
                    ? `linear-gradient(135deg, ${colorSet.from} 0%, ${colorSet.to} 100%)`
                    : 'white',
                  color: isSelected ? 'white' : '#495057',
                  boxShadow: isSelected 
                    ? `0 4px 15px ${colorSet.shadow}` 
                    : '0 2px 10px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  border: isSelected ? 'none' : '1px solid #e9ecef',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  minWidth: '170px',
                  position: 'relative'
                }}
                onClick={() => loadDepoStoklar(depo.id)}
              >
                <Box style={{ 
                  background: isSelected ? 'rgba(255,255,255,0.2)' : `${colorSet.from}15`,
                  borderRadius: '12px',
                  padding: '10px',
                  display: 'flex'
                }}>
                  <IconBuilding size={22} color={isSelected ? 'white' : colorSet.from} />
                </Box>
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="xs" fw={500} style={{ opacity: 0.85 }} lineClamp={1}>{depo.ad}</Text>
                  <Text size="lg" fw={700}>{Number(depo.urun_sayisi) || 0} <Text span size="sm" fw={400}>ürün</Text></Text>
                </Stack>
                
                {/* Silme butonu */}
                {Number(depo.urun_sayisi || 0) === 0 && (
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    radius="md"
                    style={{ 
                      position: 'absolute', 
                      top: -8, 
                      right: -8,
                      backdropFilter: 'blur(8px)',
                      backgroundColor: 'rgba(255, 82, 82, 0.15)',
                      border: '1px solid rgba(255, 82, 82, 0.3)',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 8px rgba(255, 82, 82, 0.2)'
                    }}
                    className="depo-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`"${depo.ad}" deposunu silmek istediğinizden emin misiniz?`)) {
                        handleDeleteDepo(depo.id);
                      }
                    }}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                )}
              </Box>
            );
          })}
        </Group>
      </Box>

      {/* Modern Lokasyon Seçimi */}
      {selectedDepo && lokasyonlar.length > 0 && (
        <Paper p="sm" radius="lg" mb="lg" withBorder>
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="grape" radius="xl">
              <IconCategory size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600} c="dimmed">Bölümler:</Text>
            
            <Button
              variant={selectedLokasyon === null ? "filled" : "light"}
              color="grape"
              size="xs"
              radius="xl"
              onClick={() => {
                setSelectedLokasyon(null);
                loadDepoStoklar(selectedDepo);
              }}
            >
              Tümü ({stoklar.length})
            </Button>
            
            {lokasyonlar.map((lok: any) => {
              const getEmoji = () => {
                switch(lok.tur) {
                  case 'soguk_hava': return '❄️';
                  case 'dondurulmus': return '🧊';
                  case 'kuru_gida': return '🌾';
                  case 'sebze_meyve': return '🥬';
                  case 'temizlik': return '🧹';
                  case 'baharat': return '🌶️';
                  default: return '📦';
                }
              };
              
              return (
                <Button
                  key={lok.id}
                  variant={selectedLokasyon === lok.id ? "filled" : "light"}
                  color={selectedLokasyon === lok.id ? "grape" : "gray"}
                  size="xs"
                  radius="xl"
                  leftSection={<span style={{ fontSize: '14px' }}>{getEmoji()}</span>}
                  onClick={() => loadLokasyonStoklar(lok.id)}
                >
                  {lok.ad} ({Number(lok.urun_sayisi) || 0})
                </Button>
              );
            })}
          </Group>
        </Paper>
      )}

      {/* Ana İçerik */}
      <Grid>
        <Grid.Col span={12}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab value="tumu">
                  Tümü ({stoklar.length})
                </Tabs.Tab>
                <Tabs.Tab value="kritik" color="red">
                  Kritik ({kritikStok})
                </Tabs.Tab>
                <Tabs.Tab value="dusuk" color="orange">
                  Düşük ({stoklar.filter(s => s.durum === 'dusuk').length})
                </Tabs.Tab>
              </Tabs.List>

              <Box mt="md">
                <TextInput
                  placeholder="Ürün adı veya kodu ile ara..."
                  leftSection={<IconSearch size={16} />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  mb="md"
                />

                {/* Toplu İşlem Çubuğu */}
                {selectedStoklar.length > 0 && (
                  <Paper p="xs" mb="sm" withBorder radius="md" bg="red.0">
                    <Group justify="space-between">
                      <Text size="sm" fw={500} c="red.7">
                        {selectedStoklar.length} ürün seçildi
                      </Text>
                      <Group gap="xs">
                        <Button 
                          size="xs" 
                          variant="light" 
                          color="gray"
                          onClick={() => setSelectedStoklar([])}
                        >
                          Seçimi Kaldır
                        </Button>
                        <Button 
                          size="xs" 
                          color="red" 
                          leftSection={<IconTrash size={14} />}
                          onClick={handleBulkDelete}
                          loading={loading}
                        >
                          Toplu Sil
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                )}

                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={40}>
                        <Checkbox
                          checked={selectedStoklar.length === filteredStoklar.length && filteredStoklar.length > 0}
                          indeterminate={selectedStoklar.length > 0 && selectedStoklar.length < filteredStoklar.length}
                          onChange={handleSelectAll}
                        />
                      </Table.Th>
                      <Table.Th>Kod</Table.Th>
                      <Table.Th>Ürün Adı</Table.Th>
                      <Table.Th>Kategori</Table.Th>
                      <Table.Th>Stok</Table.Th>
                      <Table.Th>Birim Fiyat</Table.Th>
                      <Table.Th>Durum</Table.Th>
                      <Table.Th>Değer</Table.Th>
                      <Table.Th style={{ width: 120 }}>İşlemler</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredStoklar.map((item) => (
                      <Table.Tr key={item.id} bg={selectedStoklar.includes(item.id) ? 'blue.0' : undefined}>
                        <Table.Td>
                          <Checkbox
                            checked={selectedStoklar.includes(item.id)}
                            onChange={() => handleSelectStok(item.id)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Badge variant="light">{item.kod}</Badge>
                            {item.kod?.startsWith('FAT-') && (
                              <Badge size="xs" variant="dot" color="violet">Faturadan</Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td><Text fw={500}>{item.ad}</Text></Table.Td>
                        <Table.Td>{item.kategori}</Table.Td>
                        <Table.Td>
                          {formatMiktar(item.toplam_stok)} {item.birim}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500} c="blue">
                            {item.son_alis_fiyat ? `${formatMoney(item.son_alis_fiyat)}/${item.birim}` : '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge 
                            color={
                              item.durum === 'kritik' ? 'red' : 
                              item.durum === 'dusuk' ? 'orange' :
                              item.durum === 'fazla' ? 'blue' : 'green'
                            }
                          >
                            {item.durum.toUpperCase()}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{formatMoney(item.toplam_stok * item.son_alis_fiyat)}</Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            {(item.durum === 'kritik' || item.durum === 'dusuk') && (
                              <ActionIcon 
                                variant="filled" 
                                color="blue" 
                                size="sm"
                                onClick={() => router.push(`/muhasebe/satin-alma?urun=${encodeURIComponent(item.ad)}&miktar=${item.min_stok - item.toplam_stok}`)}
                                title="Sipariş Ver"
                              >
                                <IconShoppingCart size={16} />
                              </ActionIcon>
                            )}
                            <ActionIcon 
                              variant="subtle" 
                              color="green" 
                              size="sm"
                              onClick={() => {
                                setTransferForm({
                                  ...transferForm,
                                  stok_kart_id: item.id
                                });
                                openTransfer();
                              }}
                              title="Transfer"
                            >
                              <IconArrowsExchange size={16} />
                            </ActionIcon>
                            <ActionIcon 
                              variant="subtle" 
                              color="red" 
                              size="sm"
                              onClick={() => {
                                if (confirm(`"${item.ad}" ürününü silmek istediğinizden emin misiniz?`)) {
                                  handleDeleteStok(item.id);
                                }
                              }}
                              title="Sil"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
            </Tabs>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Depo Yönetim Modal */}
      <Modal
        opened={depoModalOpened}
        onClose={() => {
          setDepoModalOpened(false);
          setEditingDepo(null);
          setDepoForm({
            ad: '',
            kod: '',
            tur: 'genel',
            adres: '',
            telefon: '',
            email: '',
            yetkili: '',
            kapasite_m3: 0
          });
        }}
        title={editingDepo ? "Depo Düzenle" : "Yeni Depo Ekle"}
        size="lg"
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Depo Adı"
            placeholder="Örn: Ana Depo"
            value={depoForm.ad}
            onChange={(e) => setDepoForm({ ...depoForm, ad: e.target.value })}
            required
          />
          <TextInput
            label="Depo Kodu"
            placeholder="Örn: ANA01"
            value={depoForm.kod}
            onChange={(e) => setDepoForm({ ...depoForm, kod: e.target.value })}
            required
            disabled={!!editingDepo}
          />
          <Select
            label="Depo Türü"
            data={[
              { value: 'genel', label: 'Genel Depo' },
              { value: 'soguk', label: 'Soğuk Hava Deposu' },
              { value: 'kuru', label: 'Kuru Gıda Deposu' },
              { value: 'sebze', label: 'Sebze/Meyve Deposu' }
            ]}
            value={depoForm.tur}
            onChange={(value) => setDepoForm({ ...depoForm, tur: value || 'genel' })}
          />
          <TextInput
            label="Yetkili"
            placeholder="Yetkili kişi adı"
            value={depoForm.yetkili}
            onChange={(e) => setDepoForm({ ...depoForm, yetkili: e.target.value })}
          />
          <TextInput
            label="Telefon"
            placeholder="0XXX XXX XX XX"
            value={depoForm.telefon}
            onChange={(e) => setDepoForm({ ...depoForm, telefon: e.target.value })}
          />
          <TextInput
            label="E-posta"
            placeholder="depo@sirket.com"
            value={depoForm.email}
            onChange={(e) => setDepoForm({ ...depoForm, email: e.target.value })}
          />
          <TextInput
            label="Adres"
            placeholder="Depo adresi"
            value={depoForm.adres}
            onChange={(e) => setDepoForm({ ...depoForm, adres: e.target.value })}
            style={{ gridColumn: 'span 2' }}
          />
          <NumberInput
            label="Kapasite (m³)"
            placeholder="0"
            value={depoForm.kapasite_m3}
            onChange={(value) => setDepoForm({ ...depoForm, kapasite_m3: typeof value === 'number' ? value : 0 })}
            min={0}
          />
        </SimpleGrid>
        <Group justify="flex-end" mt="lg">
          <Button variant="light" onClick={() => {
            setDepoModalOpened(false);
            setEditingDepo(null);
          }}>
            İptal
          </Button>
          <Button onClick={handleSaveDepo}>
            {editingDepo ? 'Güncelle' : 'Kaydet'}
          </Button>
        </Group>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        opened={transferOpened}
        onClose={closeTransfer}
        title="Depolar Arası Transfer"
        size="md"
      >
        <Stack>
          <Select
            label="Ürün"
            placeholder="Transfer edilecek ürünü seçin"
            data={stoklar.map(s => ({ value: s.id.toString(), label: `${s.kod} - ${s.ad}` }))}
            value={transferForm.stok_kart_id?.toString()}
            onChange={(value) => setTransferForm({ 
              ...transferForm, 
              stok_kart_id: parseInt(value || '0') 
            })}
            required
            searchable
          />

          <Select
            label="Kaynak Depo"
            placeholder="Çıkış yapılacak depo"
            data={depolar.map(d => ({ value: d.id.toString(), label: d.ad }))}
            value={transferForm.kaynak_depo_id?.toString()}
            onChange={(value) => setTransferForm({ 
              ...transferForm, 
              kaynak_depo_id: parseInt(value || '0') 
            })}
            required
          />

          <Select
            label="Hedef Depo"
            placeholder="Giriş yapılacak depo"
            data={depolar.map(d => ({ value: d.id.toString(), label: d.ad }))}
            value={transferForm.hedef_depo_id?.toString()}
            onChange={(value) => setTransferForm({ 
              ...transferForm, 
              hedef_depo_id: parseInt(value || '0') 
            })}
            required
          />

          <NumberInput
            label="Miktar"
            placeholder="Transfer edilecek miktar"
            value={transferForm.miktar}
            onChange={(value) => setTransferForm({ ...transferForm, miktar: Number(value) })}
            min={0}
            required
          />

          <TextInput
            label="Belge No"
            placeholder="Transfer belge numarası"
            value={transferForm.belge_no}
            onChange={(e) => setTransferForm({ ...transferForm, belge_no: e.target.value })}
          />

          <Textarea
            label="Açıklama"
            placeholder="Transfer açıklaması"
            value={transferForm.aciklama}
            onChange={(e) => setTransferForm({ ...transferForm, aciklama: e.target.value })}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={closeTransfer}>İptal</Button>
            <Button onClick={handleTransfer} loading={loading}>Transfer Yap</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Stok Girişi Modal */}
      <Modal
        opened={stokGirisModalOpened}
        onClose={() => setStokGirisModalOpened(false)}
        title={<Group gap="xs"><IconTrendingUp size={20} color="green" /><Text fw={600}>Stok Girişi</Text></Group>}
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Giriş Türü"
            placeholder="Seçin"
            data={[
              { value: 'SATIN_ALMA', label: '🛒 Satın Alma' },
              { value: 'URETIM', label: '🏭 Üretim' },
              { value: 'TRANSFER', label: '🔄 Transfer Girişi' },
              { value: 'SAYIM_FAZLASI', label: '📊 Sayım Fazlası' },
              { value: 'DIGER', label: '📋 Diğer' }
            ]}
            value={girisForm.giris_tipi}
            onChange={(val) => setGirisForm({ ...girisForm, giris_tipi: val || 'SATIN_ALMA' })}
          />
          <Select
            label="Depo"
            placeholder="Giriş yapılacak depo"
            data={depolar.map(d => ({ value: String(d.id), label: d.ad }))}
            value={girisForm.depo_id ? String(girisForm.depo_id) : null}
            onChange={(val) => setGirisForm({ ...girisForm, depo_id: val ? parseInt(val) : null })}
            required
          />
          <Select
            label="Ürün"
            placeholder="Giriş yapılacak ürün"
            searchable
            data={stoklar.map(s => ({ value: String(s.id), label: `${s.kod} - ${s.ad}` }))}
            value={girisForm.stok_kart_id ? String(girisForm.stok_kart_id) : null}
            onChange={(val) => setGirisForm({ ...girisForm, stok_kart_id: val ? parseInt(val) : null })}
            required
          />
          <Group grow>
            <NumberInput
              label="Miktar"
              placeholder="Giriş miktarı"
              value={girisForm.miktar}
              onChange={(val) => setGirisForm({ ...girisForm, miktar: Number(val) || 0 })}
              min={0.001}
              decimalScale={3}
              required
            />
            <NumberInput
              label="Birim Fiyat"
              placeholder="₺"
              value={girisForm.birim_fiyat}
              onChange={(val) => setGirisForm({ ...girisForm, birim_fiyat: Number(val) || 0 })}
              min={0}
              decimalScale={2}
              prefix="₺"
              thousandSeparator="."
              decimalSeparator=","
            />
          </Group>
          <Textarea
            label="Açıklama"
            placeholder="Giriş açıklaması..."
            value={girisForm.aciklama}
            onChange={(e) => setGirisForm({ ...girisForm, aciklama: e.target.value })}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setStokGirisModalOpened(false)}>İptal</Button>
            <Button color="green" onClick={handleStokGiris} loading={loading} leftSection={<IconTrendingUp size={16} />}>
              Giriş Yap
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Stok Çıkışı Modal */}
      <Modal
        opened={stokCikisModalOpened}
        onClose={() => setStokCikisModalOpened(false)}
        title={<Group gap="xs"><IconTrendingDown size={20} color="red" /><Text fw={600}>Stok Çıkışı</Text></Group>}
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Çıkış Türü"
            placeholder="Seçin"
            data={[
              { value: 'TUKETIM', label: '🍽️ Tüketim (Mutfak Kullanımı)' },
              { value: 'FIRE', label: '🗑️ Fire (Bozulma/Çürüme)' },
              { value: 'IADE', label: '↩️ İade (Tedarikçiye)' },
              { value: 'DIGER', label: '📋 Diğer' }
            ]}
            value={cikisForm.cikis_tipi}
            onChange={(val) => setCikisForm({ ...cikisForm, cikis_tipi: val || 'TUKETIM' })}
          />
          <Select
            label="Depo"
            placeholder="Çıkış yapılacak depo"
            data={depolar.map(d => ({ value: String(d.id), label: d.ad }))}
            value={cikisForm.depo_id ? String(cikisForm.depo_id) : null}
            onChange={(val) => setCikisForm({ ...cikisForm, depo_id: val ? parseInt(val) : null })}
            required
          />
          <Select
            label="Ürün"
            placeholder="Çıkış yapılacak ürün"
            searchable
            data={stoklar.map(s => ({ value: String(s.id), label: `${s.kod} - ${s.ad}` }))}
            value={cikisForm.stok_kart_id ? String(cikisForm.stok_kart_id) : null}
            onChange={(val) => setCikisForm({ ...cikisForm, stok_kart_id: val ? parseInt(val) : null })}
            required
          />
          <NumberInput
            label="Miktar"
            placeholder="Çıkış miktarı"
            value={cikisForm.miktar}
            onChange={(val) => setCikisForm({ ...cikisForm, miktar: Number(val) || 0 })}
            min={0.001}
            decimalScale={3}
            required
          />
          <Textarea
            label="Açıklama"
            placeholder="Çıkış nedeni..."
            value={cikisForm.aciklama}
            onChange={(e) => setCikisForm({ ...cikisForm, aciklama: e.target.value })}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setStokCikisModalOpened(false)}>İptal</Button>
            <Button color="red" onClick={handleStokCikis} loading={loading} leftSection={<IconTrendingDown size={16} />}>
              Çıkış Yap
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Stok Sayımı Modal */}
      <Modal
        opened={sayimModalOpened}
        onClose={() => { setSayimModalOpened(false); setSayimVerileri({}); setSayimDepoId(null); }}
        title={<Group gap="xs"><IconClipboardList size={20} color="orange" /><Text fw={600}>Stok Sayımı</Text></Group>}
        size="xl"
      >
        <Stack gap="md">
          <Select
            label="Sayım Yapılacak Depo"
            placeholder="Depo seçin"
            data={depolar.map(d => ({ value: String(d.id), label: d.ad }))}
            value={sayimDepoId ? String(sayimDepoId) : null}
            onChange={(val) => val && loadSayimVerileri(parseInt(val))}
            required
          />
          
          {sayimDepoId && (
            <>
              <Alert color="blue" variant="light">
                Fiziksel sayım sonuçlarını girin. Farklar otomatik hesaplanacak ve kaydedilecek.
              </Alert>
              
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Ürün</Table.Th>
                    <Table.Th>Sistem Stok</Table.Th>
                    <Table.Th>Sayım</Table.Th>
                    <Table.Th>Fark</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredStoklar.map((item) => {
                    const sistemStok = item.toplam_stok || 0;
                    const sayimStok = sayimVerileri[item.id] ?? sistemStok;
                    const fark = sayimStok - sistemStok;
                    
                    return (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>{item.ad}</Text>
                          <Text size="xs" c="dimmed">{item.kod}</Text>
                        </Table.Td>
                        <Table.Td>{formatMiktar(sistemStok)} {item.birim}</Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            value={sayimStok}
                            onChange={(val) => setSayimVerileri({ ...sayimVerileri, [item.id]: Number(val) || 0 })}
                            min={0}
                            decimalScale={3}
                            style={{ width: 100 }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Badge 
                            color={fark === 0 ? 'gray' : fark > 0 ? 'green' : 'red'}
                            variant="light"
                          >
                            {fark > 0 ? '+' : ''}{formatMiktar(fark)} {item.birim}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
              
              <Group justify="flex-end">
                <Button variant="light" onClick={() => { setSayimModalOpened(false); setSayimVerileri({}); }}>İptal</Button>
                <Button color="orange" onClick={handleSayimKaydet} loading={loading} leftSection={<IconCheck size={16} />}>
                  Sayımı Kaydet
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {/* Stok Hareketleri Modal */}
      <Modal
        opened={hareketlerModalOpened}
        onClose={() => setHareketlerModalOpened(false)}
        title={<Group gap="xs"><IconHistory size={20} /><Text fw={600}>Stok Hareketleri</Text></Group>}
        size="xl"
      >
        <LoadingOverlay visible={hareketlerLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tarih</Table.Th>
              <Table.Th>Ürün</Table.Th>
              <Table.Th>Tür</Table.Th>
              <Table.Th>Miktar</Table.Th>
              <Table.Th>Depo</Table.Th>
              <Table.Th>Belge</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {hareketler.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed" py="xl">Henüz hareket kaydı yok</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              hareketler.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td>
                    <Text size="sm">{new Date(h.created_at).toLocaleDateString('tr-TR')}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{h.stok_ad || h.stok_kart_id}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge 
                      color={h.hareket_tipi === 'GIRIS' ? 'green' : h.hareket_tipi === 'CIKIS' ? 'red' : 'blue'}
                      variant="light"
                    >
                      {h.hareket_tipi}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={h.hareket_yonu === '+' ? 'green' : 'red'} fw={500}>
                      {h.hareket_yonu === '+' ? '+' : '-'}{formatMiktar(h.miktar)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{h.giris_depo_ad || h.cikis_depo_ad || '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">{h.belge_no || '-'}</Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Modal>

      {/* Yeni Ürün Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title="Yeni Ürün Ekle"
        size="lg"
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Ürün Kodu"
            placeholder="Örn: URN001"
            value={urunForm.kod}
            onChange={(e) => setUrunForm({ ...urunForm, kod: e.target.value })}
            required
          />
          <TextInput
            label="Ürün Adı"
            placeholder="Örn: Pirinç"
            value={urunForm.ad}
            onChange={(e) => setUrunForm({ ...urunForm, ad: e.target.value })}
            required
          />
          <Select
            label="Kategori"
            placeholder="Kategori seçin"
            data={kategoriler.map(k => ({ value: k.id.toString(), label: k.ad }))}
            value={urunForm.kategori_id}
            onChange={(value) => setUrunForm({ ...urunForm, kategori_id: value || '' })}
            required
            searchable
          />
          <Select
            label="Birim"
            placeholder="Birim seçin"
            data={birimler.map(b => ({ value: b.id.toString(), label: `${b.ad} (${b.kisa_ad})` }))}
            value={urunForm.ana_birim_id}
            onChange={(value) => setUrunForm({ ...urunForm, ana_birim_id: value || '' })}
            required
            searchable
          />
          <TextInput
            label="Barkod"
            placeholder="Ürün barkodu"
            value={urunForm.barkod}
            onChange={(e) => setUrunForm({ ...urunForm, barkod: e.target.value })}
          />
          <NumberInput
            label="Alış Fiyatı (₺)"
            placeholder="0.00"
            value={urunForm.son_alis_fiyat}
            onChange={(value) => setUrunForm({ ...urunForm, son_alis_fiyat: Number(value) || 0 })}
            min={0}
            decimalScale={2}
          />
          <NumberInput
            label="Min Stok"
            placeholder="0"
            value={urunForm.min_stok}
            onChange={(value) => setUrunForm({ ...urunForm, min_stok: Number(value) || 0 })}
            min={0}
          />
          <NumberInput
            label="Max Stok"
            placeholder="0"
            value={urunForm.max_stok}
            onChange={(value) => setUrunForm({ ...urunForm, max_stok: Number(value) || 0 })}
            min={0}
          />
          <NumberInput
            label="KDV Oranı (%)"
            placeholder="18"
            value={urunForm.kdv_orani}
            onChange={(value) => setUrunForm({ ...urunForm, kdv_orani: Number(value) || 0 })}
            min={0}
            max={100}
          />
          <Textarea
            label="Açıklama"
            placeholder="Ürün açıklaması"
            value={urunForm.aciklama}
            onChange={(e) => setUrunForm({ ...urunForm, aciklama: e.target.value })}
            style={{ gridColumn: 'span 2' }}
          />
        </SimpleGrid>
        <Group justify="flex-end" mt="lg">
          <Button variant="light" onClick={close}>İptal</Button>
          <Button onClick={handleSaveUrun} loading={loading}>Kaydet</Button>
        </Group>
      </Modal>

      {/* Faturadan Stok Girişi Modal */}
      <Modal
        opened={faturaModalOpened}
        onClose={() => {
          setFaturaModalOpened(false);
          setSelectedFatura(null);
          setFaturaKalemler([]);
          setKalemEslestirme({});
        }}
        title={selectedFatura ? `📄 ${selectedFatura.sender_name}` : "📄 Faturadan Stok Girişi"}
        size="xl"
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <LoadingOverlay visible={faturaLoading} />
        
        {!selectedFatura ? (
          // Fatura Listesi
          <Stack>
            <Text size="sm" c="dimmed" mb="md">
              Son 3 ayın gelen faturaları listeleniyor. İşlemek istediğiniz faturayı seçin.
            </Text>
            
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tarih</Table.Th>
                  <Table.Th>Gönderen</Table.Th>
                  <Table.Th>Tutar</Table.Th>
                  <Table.Th>Durum</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {faturalar.map(fatura => (
                  <Table.Tr key={fatura.ettn}>
                    <Table.Td>
                      {new Date(fatura.invoice_date).toLocaleDateString('tr-TR')}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1} style={{ maxWidth: 300 }}>
                        {fatura.sender_name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>
                        {parseFloat(fatura.payable_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {fatura.stok_islendi ? (
                        <Badge color="green" variant="light">İşlendi ✓</Badge>
                      ) : (
                        <Badge color="gray" variant="light">Bekliyor</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Button 
                        size="xs" 
                        variant="light"
                        disabled={fatura.stok_islendi}
                        onClick={() => {
                          setSelectedFatura(fatura);
                          loadFaturaKalemler(fatura.ettn);
                        }}
                      >
                        Seç
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            
            {faturalar.length === 0 && (
              <Text ta="center" c="dimmed" py="xl">
                Henüz işlenecek fatura bulunmuyor
              </Text>
            )}
          </Stack>
        ) : (
          // Fatura Kalemleri ve Eşleştirme
          <Stack>
            <Group justify="space-between">
              <Button 
                variant="subtle" 
                size="xs" 
                leftSection={<IconX size={14} />}
                onClick={() => {
                  setSelectedFatura(null);
                  setFaturaKalemler([]);
                  setKalemEslestirme({});
                }}
              >
                Geri Dön
              </Button>
              <Badge size="lg">
                {new Date(selectedFatura.invoice_date).toLocaleDateString('tr-TR')} - {parseFloat(selectedFatura.payable_amount).toLocaleString('tr-TR')} ₺
              </Badge>
            </Group>
            
            <Select
              label="Hedef Depo"
              placeholder="Stok girişi yapılacak depoyu seçin"
              data={depolar.map(d => ({ value: d.id.toString(), label: d.ad }))}
              value={faturaGirisDepo?.toString() || null}
              onChange={(val) => setFaturaGirisDepo(val ? parseInt(val) : null)}
              required
            />
            
            <Divider my="sm" label="Fatura Kalemleri" labelPosition="center" />
            
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ürün</Table.Th>
                  <Table.Th>Miktar</Table.Th>
                  <Table.Th>Fiyat</Table.Th>
                  <Table.Th>Stok Kartı Eşleştirme</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {faturaKalemler.map(kalem => (
                  <Table.Tr key={kalem.sira}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={500}>{kalem.urun_adi}</Text>
                        <Text size="xs" c="dimmed">Kod: {kalem.urun_kodu}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text>{formatMiktar(kalem.miktar)} {kalem.birim === 'KGM' ? 'Kg' : kalem.birim === 'C62' ? 'Ad' : kalem.birim}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{kalem.birim_fiyat.toLocaleString('tr-TR')} ₺</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Select
                          placeholder="Stok kartı seç"
                          data={stoklar
                            .filter(s => !s.kod?.startsWith('FAT-')) // Faturadan otomatik oluşturulanları hariç tut
                            .map(s => ({ value: s.id.toString(), label: `${s.kod} - ${s.ad}` }))}
                          value={kalemEslestirme[kalem.sira]?.toString() || null}
                          onChange={(val) => setKalemEslestirme(prev => ({
                            ...prev,
                            [kalem.sira]: val ? parseInt(val) : null
                          }))}
                          searchable
                          clearable
                          nothingFoundMessage="Stok kartı bulunamadı"
                          leftSection={kalemEslestirme[kalem.sira] ? <IconLink size={14} color="green" /> : <IconLinkOff size={14} color="gray" />}
                          style={{ flex: 1 }}
                        />
                        <ActionIcon
                          variant="light"
                          color="green"
                          title="Bu ürünü yeni stok kartı olarak ekle"
                          onClick={async () => {
                            // Fatura kaleminden stok kartı oluştur
                            try {
                              const birimId = birimler.find(b => 
                                b.kisa_ad === (kalem.birim === 'KGM' ? 'kg' : 'adet') ||
                                b.kod === (kalem.birim === 'KGM' ? 'KG' : 'ADET')
                              )?.id || birimler[0]?.id;
                              
                              const res = await fetch(`${API_URL}/stok/kartlar`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  kod: kalem.urun_kodu || `FAT-${kalem.sira}`,
                                  ad: kalem.urun_adi,
                                  ana_birim_id: birimId,
                                  kategori_id: kategoriler[0]?.id,
                                  son_alis_fiyat: kalem.birim_fiyat,
                                  kdv_orani: kalem.kdv_orani || 0
                                })
                              });
                              const result = await res.json();
                              if (result.success) {
                                notifications.show({
                                  title: 'Başarılı',
                                  message: `"${kalem.urun_adi}" stok kartı oluşturuldu`,
                                  color: 'green'
                                });
                                // Stokları yenile ve eşleştir
                                await loadData();
                                setKalemEslestirme(prev => ({
                                  ...prev,
                                  [kalem.sira]: result.data.id
                                }));
                              } else {
                                throw new Error(result.error);
                              }
                            } catch (error: any) {
                              notifications.show({
                                title: 'Hata',
                                message: error.message,
                                color: 'red'
                              });
                            }
                          }}
                        >
                          <IconPlus size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            
            <Group justify="space-between" mt="md">
              <Text size="sm" c="dimmed">
                Eşleştirilen: {Object.values(kalemEslestirme).filter(v => v).length} / {faturaKalemler.length} kalem
              </Text>
              <Button 
                onClick={handleFaturaStokGirisi} 
                loading={faturaLoading}
                disabled={!faturaGirisDepo || Object.values(kalemEslestirme).filter(v => v).length === 0}
                leftSection={<IconCheck size={16} />}
              >
                Stok Girişi Yap
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}

// Next.js 15 requires Suspense wrapper for useSearchParams
import { Loader, Center } from '@mantine/core';

export default function StokPage() {
  return (
    <Suspense fallback={<Center h="50vh"><Loader size="lg" /></Center>}>
      <StokPageContent />
    </Suspense>
  );
}
