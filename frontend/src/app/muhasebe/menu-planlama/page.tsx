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
  ActionIcon,
  Select,
  Modal,
  NumberInput,
  Textarea,
  Tabs,
  Paper,
  Divider,
  Loader,
  Center,
  Tooltip,
  ScrollArea,
  Grid,
  TextInput,
  Collapse,
  UnstyledButton,
  Table,
  rem,
  SegmentedControl,
  Menu,
  Alert,
  Switch
} from '@mantine/core';
// import { MonthPickerInput } from '@mantine/dates'; // Gerekirse kullanılacak
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconCalendar,
  IconChefHat,
  IconSoup,
  IconMeat,
  IconSalad,
  IconCoffee,
  IconCoin,
  IconUsers,
  IconBuilding,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconChevronRight,
  IconChevronDown,
  IconFlame,
  IconScale,
  IconSparkles,
  IconCheck,
  IconSearch,
  IconFilter,
  IconArrowRight,
  IconCalculator,
  IconFileText,
  IconUpload,
  IconFileAnalytics,
  IconX,
  IconClock
} from '@tabler/icons-react';
import { Dropzone, PDF_MIME_TYPE, MS_EXCEL_MIME_TYPE, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

dayjs.locale('tr');

const API_URL = `${API_BASE_URL}/api`;

// =====================================================
// TİP TANIMLARI
// =====================================================

interface Proje {
  id: number;
  ad: string;
  kod: string | null;
}

interface Kategori {
  id: number;
  kod: string;
  ad: string;
  ikon: string;
}

interface Malzeme {
  id: number;
  malzeme_adi: string;
  miktar: string;
  birim: string;
  birim_fiyat: number | null;
  toplam_fiyat: number | null;
  stok_kart_id: number | null;
}

interface Recete {
  id: number;
  kod: string;
  ad: string;
  kategori_id: number;
  kategori_adi: string;
  kategori_ikon: string;
  tahmini_maliyet: string | null;
  kalori: string | null;
  protein: string | null;
  karbonhidrat: string | null;
  yag: string | null;
  malzeme_sayisi: string;
  hazirlik_suresi: number | null;
  pisirme_suresi: number | null;
  tarif: string | null;
  malzemeler?: Malzeme[];
}

interface OgunTipi {
  id: number;
  kod: string;
  ad: string;
  ikon: string;
}

interface Sartname {
  id: number;
  kod: string;
  ad: string;
  kurum_id: number;
  kurum_adi: string;
  kurum_ikon: string;
  yil: number;
  versiyon: string;
  kaynak_url: string | null;
  notlar: string | null;
  gramaj_sayisi: string;
  proje_sayisi: string;
  aktif: boolean;
}

interface SartnameGramaj {
  id: number;
  sartname_id: number;
  kategori_id: number | null;
  kategori_adi: string | null;
  kategori_ikon: string | null;
  yemek_turu: string;
  porsiyon_gramaj: number;
  birim: string;
  aciklama: string | null;
  sira: number;
}

interface OgunYapisi {
  id: number;
  sartname_id: number;
  ogun_tipi: string;
  min_cesit: number | null;
  max_cesit: number | null;
  zorunlu_kategoriler: string[] | null;
  aciklama: string | null;
  aktif?: boolean;
}

interface Kurum {
  id: number;
  kod: string;
  ad: string;
  ikon: string;
}

interface MenuOgun {
  id: number;
  tarih: string;
  ogun_tipi_id: number;
  ogun_tip_adi: string;
  ogun_ikon: string;
  kisi_sayisi: number | null;
  toplam_maliyet: string | null;
  porsiyon_maliyet: string | null;
  yemekler: {
    id: number;
    recete_id: number;
    recete_ad: string;
    recete_kategori: string;
    recete_ikon: string;
    sira: number;
    porsiyon_maliyet: string | null;
    toplam_maliyet: string | null;
  }[] | null;
}

// =====================================================
// YARDIMCI FONKSİYONLAR
// =====================================================

const formatCurrency = (value: number | string | null) => {
  if (!value) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(num);
};

const getKategoriIcon = (kod: string) => {
  switch (kod) {
    case 'corba': return <IconSoup size={18} />;
    case 'ana_yemek': return <IconMeat size={18} />;
    case 'salata_meze': return <IconSalad size={18} />;
    case 'icecek': return <IconCoffee size={18} />;
    default: return <IconChefHat size={18} />;
  }
};

// =====================================================
// MİNİ TAKVİM BİLEŞENİ (Kompakt Versiyon)
// =====================================================

function MiniCalendar({ selectedDate, onSelectDate }: { 
  selectedDate: Date | null; 
  onSelectDate: (date: Date) => void;
}) {
  if (!selectedDate) return null;
  
  const currentMonth = dayjs(selectedDate);
  const startOfMonth = currentMonth.startOf('month');
  const endOfMonth = currentMonth.endOf('month');
  const startDay = startOfMonth.day();
  const daysInMonth = endOfMonth.date();
  
  const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;
  
  const days = [];
  const weekDays = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'];
  
  const prevMonth = startOfMonth.subtract(1, 'month');
  const prevMonthDays = prevMonth.daysInMonth();
  for (let i = adjustedStartDay - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: prevMonth.date(prevMonthDays - i) });
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, isCurrentMonth: true, date: currentMonth.date(i) });
  }
  
  // Sadece 5 satır yeterli (35 gün)
  const remainingDays = Math.max(0, 35 - days.length);
  const nextMonth = currentMonth.add(1, 'month');
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ day: i, isCurrentMonth: false, date: nextMonth.date(i) });
  }
  
  const isToday = (date: dayjs.Dayjs) => date.isSame(dayjs(), 'day');
  const isSelected = (date: dayjs.Dayjs) => date.isSame(selectedDate, 'day');
  
  return (
    <Box>
      {/* Haftanın günleri - Kompakt */}
      <SimpleGrid cols={7} spacing={0}>
        {weekDays.map((day, i) => (
          <Text key={i} ta="center" size="10px" fw={600} c="dimmed" py={1}>
            {day}
          </Text>
        ))}
      </SimpleGrid>
      
      {/* Günler - Kompakt */}
      <SimpleGrid cols={7} spacing={1}>
        {days.slice(0, 35).map((item, idx) => (
          <UnstyledButton
            key={idx}
            onClick={() => onSelectDate(item.date.toDate())}
            style={{
              width: '100%',
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 3,
              backgroundColor: isSelected(item.date) 
                ? 'var(--mantine-color-orange-6)' 
                : isToday(item.date) 
                  ? 'var(--mantine-color-orange-1)' 
                  : 'transparent',
              color: isSelected(item.date) 
                ? 'white' 
                : item.isCurrentMonth 
                  ? 'inherit' 
                  : 'var(--mantine-color-gray-4)',
              fontWeight: isToday(item.date) || isSelected(item.date) ? 600 : 400,
              fontSize: 10,
              cursor: 'pointer',
              transition: 'all 0.1s ease'
            }}
          >
            {item.day}
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Box>
  );
}

// =====================================================
// ANA BİLEŞEN
// =====================================================

export default function MenuPlanlamaPage() {
  // State
  const [loading, setLoading] = useState(true);
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [secilenProje, setSecilenProje] = useState<string | null>(null);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [receteler, setReceteler] = useState<Recete[]>([]);
  const [secilenReceteler, setSecilenReceteler] = useState<number[]>([]); // Toplu silme için
  const [ogunTipleri, setOgunTipleri] = useState<OgunTipi[]>([]);
  const [secilenTarih, setSecilenTarih] = useState<Date | null>(null);
  const [gunlukOgunler, setGunlukOgunler] = useState<MenuOgun[]>([]);
  const [kisiSayisi, setKisiSayisi] = useState<number>(1000);
  const [gunlukKisiSayilari, setGunlukKisiSayilari] = useState<Record<string, number>>({});
  const [kisiSayisiKaydediliyor, setKisiSayisiKaydediliyor] = useState(false);
  
  // Client-side tarih initialization (hydration fix)
  useEffect(() => {
    setSecilenTarih(new Date());
  }, []);
  
  // Modals
  const [receteModalOpened, { open: openReceteModal, close: closeReceteModal }] = useDisclosure(false);
  const [yemekEkleModalOpened, { open: openYemekEkleModal, close: closeYemekEkleModal }] = useDisclosure(false);
  const [menuOlusturModalOpened, { open: openMenuOlusturModal, close: closeMenuOlusturModal }] = useDisclosure(false);
  const [secilenRecete, setSecilenRecete] = useState<Recete | null>(null);
  const [secilenOgun, setSecilenOgun] = useState<MenuOgun | null>(null);
  const [secilenKategori, setSecilenKategori] = useState<string | null>(null);
  const [receteArama, setReceteArama] = useState('');
  const [menuPlanId, setMenuPlanId] = useState<number | null>(null);
  const [secilenOgunTip, setSecilenOgunTip] = useState<string>('ogle');
  const [aylikMenu, setAylikMenu] = useState<Record<string, Record<string, any[]>>>({});
  
  // Şartname State
  const [sartnameModalOpened, { open: openSartnameModal, close: closeSartnameModal }] = useDisclosure(false);
  
  // Menü İçe Aktarma State
  const [menuImportModalOpened, { open: openMenuImportModal, close: closeMenuImportModal }] = useDisclosure(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  // Yeni Reçete Oluşturma State
  const [yeniReceteModalOpened, { open: openYeniReceteModal, close: closeYeniReceteModal }] = useDisclosure(false);
  const [yeniReceteLoading, setYeniReceteLoading] = useState(false);
  const [yeniReceteForm, setYeniReceteForm] = useState({
    ad: '',
    kategori_id: '',
    kalori: '',
    protein: '',
    karbonhidrat: '',
    yag: ''
  });
  const [gramajModalOpened, { open: openGramajModal, close: closeGramajModal }] = useDisclosure(false);
  const [sartnameListesi, setSartnameListesi] = useState<Sartname[]>([]);
  const [secilenSartname, setSecilenSartname] = useState<Sartname | null>(null);
  const [sartnameGramajlar, setSartnameGramajlar] = useState<SartnameGramaj[]>([]);
  const [kurumlar, setKurumlar] = useState<Kurum[]>([]);
  const [yeniSartname, setYeniSartname] = useState({
    kod: '',
    ad: '',
    kurum_id: '',
    yil: new Date().getFullYear(),
    kaynak_url: '',
    notlar: ''
  });
  const [yeniGramaj, setYeniGramaj] = useState({
    kategori_id: '',
    yemek_turu: '',
    porsiyon_gramaj: '',
    birim: 'g',
    aciklama: ''
  });
  const [ogunYapilari, setOgunYapilari] = useState<OgunYapisi[]>([]);
  const [sartnameKartAcik, setSartnameKartAcik] = useState(true);
  const [aktifSekme, setAktifSekme] = useState<string | null>('menu');
  const [projeSartnamesi, setProjeSartnamesi] = useState<Sartname | null>(null);
  const [projeSartnameGramajlari, setProjeSartnameGramajlari] = useState<SartnameGramaj[]>([]);
  
  // Malzeme düzenleme
  const [malzemeModalOpened, { open: openMalzemeModal, close: closeMalzemeModal }] = useDisclosure(false);
  const [duzenlenenMalzeme, setDuzenlenenMalzeme] = useState<{
    id: number | null;
    recete_id: number;
    malzeme_adi: string;
    miktar: string;
    birim: string;
    stok_kart_id: number | null;
  } | null>(null);
  const [stokKartlari, setStokKartlari] = useState<{id: number; ad: string; kod: string}[]>([]);

  // Veri yükleme
  const fetchProjeler = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/projeler`);
      const data = await res.json();
      // API direkt dizi veya { success, data } formatında olabilir
      const projelerData = Array.isArray(data) ? data : (data.data || []);
      setProjeler(projelerData);
      if (projelerData.length > 0 && !secilenProje) {
        setSecilenProje(projelerData[0].id.toString());
      }
    } catch (error) {
      console.error('Proje listesi hatası:', error);
    }
  }, [secilenProje]);

  const fetchKategoriler = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/kategoriler`);
      const data = await res.json();
      if (data.success) {
        setKategoriler(data.data || []);
      }
    } catch (error) {
      console.error('Kategori listesi hatası:', error);
    }
  }, []);

  const fetchReceteler = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      // Proje bazlı filtreleme
      if (secilenProje) params.set('proje_id', secilenProje);
      if (secilenKategori) params.set('kategori', secilenKategori);
      if (receteArama) params.set('arama', receteArama);
      
      const res = await fetch(`${API_URL}/menu-planlama/receteler?${params}`);
      const data = await res.json();
      if (data.success) {
        setReceteler(data.data || []);
      }
    } catch (error) {
      console.error('Reçete listesi hatası:', error);
    }
  }, [secilenProje, secilenKategori, receteArama]);

  const fetchStokKartlari = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/stok/kartlar?limit=500`);
      const data = await res.json();
      const kartlar = Array.isArray(data) ? data : (data.data || []);
      setStokKartlari(kartlar);
    } catch (error) {
      console.error('Stok kartları hatası:', error);
    }
  }, []);

  const fetchOgunTipleri = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/ogun-tipleri`);
      const data = await res.json();
      if (data.success) {
        setOgunTipleri(data.data || []);
      }
    } catch (error) {
      console.error('Öğün tipleri hatası:', error);
    }
  }, []);
  
  // Aylık menü planını çek
  const fetchMenuPlan = useCallback(async () => {
    if (!secilenProje || !secilenTarih) return;
    
    try {
      const ayBaslangic = dayjs(secilenTarih).startOf('month').format('YYYY-MM-DD');
      const ayBitis = dayjs(secilenTarih).endOf('month').format('YYYY-MM-DD');
      
      const res = await fetch(
        `${API_URL}/menu-planlama/menu-plan?proje_id=${secilenProje}&baslangic=${ayBaslangic}&bitis=${ayBitis}`
      );
      const data = await res.json();
      
      if (data.success && data.data) {
        // Veriyi tarih -> öğün -> yemekler şeklinde organize et
        const menuMap: Record<string, Record<string, any[]>> = {};
        const kisiMap: Record<string, number> = {};
        
        data.data.ogunler?.forEach((ogun: any) => {
          const tarih = dayjs(ogun.tarih).format('YYYY-MM-DD');
          const ogunTip = ogun.ogun_tip_kodu || 'diger';
          
          if (!menuMap[tarih]) menuMap[tarih] = {};
          if (!menuMap[tarih][ogunTip]) menuMap[tarih][ogunTip] = [];
          
          if (ogun.yemekler) {
            menuMap[tarih][ogunTip].push(...ogun.yemekler);
          }
          
          // Günlük kişi sayısını kaydet (ilk öğünden al)
          if (!kisiMap[tarih] && ogun.kisi_sayisi) {
            kisiMap[tarih] = ogun.kisi_sayisi;
          }
        });
        
        setAylikMenu(menuMap);
        setMenuPlanId(data.data.plan_id);
        setGunlukKisiSayilari(kisiMap);
      }
    } catch (error) {
      console.error('Menü planı çekme hatası:', error);
    }
  }, [secilenProje, secilenTarih]);

  const fetchReceteDetay = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/receteler/${id}`);
      const data = await res.json();
      if (data.success) {
        setSecilenRecete(data.data);
        openReceteModal();
      }
    } catch (error) {
      console.error('Reçete detay hatası:', error);
    }
  }, [openReceteModal]);

  // Şartname fonksiyonları
  const fetchSartnameler = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/sartname/liste?aktif=all`);
      const data = await res.json();
      if (data.success) {
        setSartnameListesi(data.data || []);
      }
    } catch (error) {
      console.error('Şartname listesi hatası:', error);
    }
  }, []);

  const fetchKurumlar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/sartname/kurumlar`);
      const data = await res.json();
      if (data.success) {
        setKurumlar(data.data || []);
      }
    } catch (error) {
      console.error('Kurum listesi hatası:', error);
    }
  }, []);

  const fetchSartnameDetay = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/sartname/${id}`);
      const data = await res.json();
      if (data.success) {
        setSecilenSartname(data.data);
        setSartnameGramajlar(data.data.gramajlar || []);
        setOgunYapilari(data.data.ogun_yapilari || []);
      }
    } catch (error) {
      console.error('Şartname detay hatası:', error);
    }
  }, []);

  // Proje şartnamesini getir ve Şartname sekmesinde otomatik göster
  const fetchProjeSartnamesi = useCallback(async (projeId: string) => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/proje/${projeId}/sartnameler`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        // Varsayılan şartnameyi al veya ilkini
        const varsayilan = data.data.find((s: Sartname & { varsayilan: boolean }) => s.varsayilan) || data.data[0];
        setProjeSartnamesi(varsayilan);
        
        // Şartname gramajlarını da al
        const detayRes = await fetch(`${API_URL}/menu-planlama/sartname/${varsayilan.id}`);
        const detayData = await detayRes.json();
        if (detayData.success) {
          setProjeSartnameGramajlari(detayData.data.gramajlar || []);
          // Şartname sekmesi için de otomatik seç
          setSecilenSartname(detayData.data);
          setSartnameGramajlar(detayData.data.gramajlar || []);
          setOgunYapilari(detayData.data.ogun_yapilari || []);
        }
      } else {
        setProjeSartnamesi(null);
        setProjeSartnameGramajlari([]);
        setSecilenSartname(null);
        setSartnameGramajlar([]);
        setOgunYapilari([]);
      }
    } catch (error) {
      console.error('Proje şartnamesi hatası:', error);
    }
  }, []);

  const handleSartnameEkle = async () => {
    if (!yeniSartname.kod || !yeniSartname.ad) {
      notifications.show({
        title: 'Hata',
        message: 'Kod ve ad zorunlu',
        color: 'red'
      });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/menu-planlama/sartname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...yeniSartname,
          kurum_id: yeniSartname.kurum_id ? parseInt(yeniSartname.kurum_id) : null
        })
      });
      const data = await res.json();
      
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Şartname oluşturuldu',
          color: 'green'
        });
        setYeniSartname({ kod: '', ad: '', kurum_id: '', yil: new Date().getFullYear(), kaynak_url: '', notlar: '' });
        fetchSartnameler();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Şartname ekleme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Şartname eklenemedi',
        color: 'red'
      });
    }
  };

  const handleGramajEkle = async () => {
    if (!secilenSartname || !yeniGramaj.yemek_turu || !yeniGramaj.porsiyon_gramaj) {
      notifications.show({
        title: 'Hata',
        message: 'Yemek türü ve porsiyon gramajı zorunlu',
        color: 'red'
      });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/menu-planlama/sartname/${secilenSartname.id}/gramaj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kategori_id: yeniGramaj.kategori_id ? parseInt(yeniGramaj.kategori_id) : null,
          yemek_turu: yeniGramaj.yemek_turu,
          porsiyon_gramaj: parseInt(yeniGramaj.porsiyon_gramaj),
          birim: yeniGramaj.birim,
          aciklama: yeniGramaj.aciklama || null
        })
      });
      const data = await res.json();
      
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Porsiyon gramajı eklendi',
          color: 'green'
        });
        setYeniGramaj({ kategori_id: '', yemek_turu: '', porsiyon_gramaj: '', birim: 'g', aciklama: '' });
        closeGramajModal();
        fetchSartnameDetay(secilenSartname.id);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Gramaj ekleme hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Gramaj eklenemedi',
        color: 'red'
      });
    }
  };

  const handleGramajSil = async (gramajId: number) => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/sartname/gramaj/${gramajId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success && secilenSartname) {
        notifications.show({
          title: 'Başarılı',
          message: 'Gramaj silindi',
          color: 'green'
        });
        fetchSartnameDetay(secilenSartname.id);
      }
    } catch (error) {
      console.error('Gramaj silme hatası:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchProjeler(),
        fetchKategoriler(),
        fetchReceteler(),
        fetchOgunTipleri(),
        fetchSartnameler(),
        fetchKurumlar(),
        fetchStokKartlari()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchProjeler, fetchKategoriler, fetchReceteler, fetchOgunTipleri, fetchSartnameler, fetchKurumlar]);
  
  // Proje veya ay değişince menü planını yenile
  useEffect(() => {
    if (secilenProje && secilenTarih) {
      fetchMenuPlan();
    }
  }, [secilenProje, secilenTarih, fetchMenuPlan]);

  // Proje değişince şartnameyi yükle
  useEffect(() => {
    if (secilenProje) {
      fetchProjeSartnamesi(secilenProje);
    }
  }, [secilenProje, fetchProjeSartnamesi]);

  // Proje, kategori veya arama değişince reçeteleri yenile
  useEffect(() => {
    fetchReceteler();
  }, [secilenProje, secilenKategori, receteArama, fetchReceteler]);

  // Günlük menü oluştur
  const menuOlustur = async () => {
    if (!secilenProje || !secilenTarih) {
      notifications.show({
        title: 'Hata',
        message: 'Lütfen proje ve tarih seçin',
        color: 'red'
      });
      return;
    }

    try {
      // Önce menü planı var mı kontrol et, yoksa oluştur
      let planId = menuPlanId;
      
      if (!planId) {
        // Yeni plan oluştur
        const ayBaslangic = dayjs(secilenTarih).startOf('month').format('YYYY-MM-DD');
        const ayBitis = dayjs(secilenTarih).endOf('month').format('YYYY-MM-DD');
        
        const planRes = await fetch(`${API_URL}/menu-planlama/menu-planlari`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proje_id: parseInt(secilenProje),
            ad: `${dayjs(secilenTarih).format('MMMM YYYY')} Menüsü`,
            tip: 'aylik',
            baslangic_tarihi: ayBaslangic,
            bitis_tarihi: ayBitis,
            varsayilan_kisi_sayisi: kisiSayisi
          })
        });
        
        const planData = await planRes.json();
        if (planData.success) {
          planId = planData.data.id;
          setMenuPlanId(planId);
        }
      }

      if (!planId) {
        throw new Error('Plan oluşturulamadı');
      }

      // Her öğün tipi için öğün oluştur
      for (const ogunTipi of ogunTipleri) {
        await fetch(`${API_URL}/menu-planlama/menu-planlari/${planId}/ogunler`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tarih: dayjs(secilenTarih).format('YYYY-MM-DD'),
            ogun_tipi_id: ogunTipi.id,
            kisi_sayisi: kisiSayisi
          })
        });
      }

      notifications.show({
        title: 'Menü Oluşturuldu',
        message: `${dayjs(secilenTarih).format('D MMMM')} için öğünler eklendi`,
        color: 'green'
      });

      // Günlük öğünleri yeniden yükle
      fetchGunlukOgunler();
      closeMenuOlusturModal();
    } catch (error) {
      console.error('Menü oluşturma hatası:', error);
      notifications.show({
        title: 'Hata',
        message: 'Menü oluşturulamadı',
        color: 'red'
      });
    }
  };

  // Günlük öğünleri getir
  const fetchGunlukOgunler = useCallback(async () => {
    if (!menuPlanId || !secilenTarih) return;
    
    try {
      const res = await fetch(`${API_URL}/menu-planlama/menu-planlari/${menuPlanId}`);
      const data = await res.json();
      
      if (data.success && data.data.ogunler) {
        const tarihStr = dayjs(secilenTarih).format('YYYY-MM-DD');
        const gunOgunleri = data.data.ogunler.filter(
          (o: MenuOgun) => o.tarih === tarihStr
        );
        setGunlukOgunler(gunOgunleri);
      }
    } catch (error) {
      console.error('Öğün yükleme hatası:', error);
    }
  }, [menuPlanId, secilenTarih]);

  // Tarih değiştiğinde öğünleri yükle
  useEffect(() => {
    if (menuPlanId && secilenTarih) {
      fetchGunlukOgunler();
    }
  }, [menuPlanId, secilenTarih, fetchGunlukOgunler]);

  // Tarih değiştiğinde kişi sayısını güncelle
  useEffect(() => {
    if (!secilenTarih) return;
    
    const tarihStr = dayjs(secilenTarih).format('YYYY-MM-DD');
    
    // Önce günlük kişi sayılarından kontrol et
    if (gunlukKisiSayilari[tarihStr]) {
      setKisiSayisi(gunlukKisiSayilari[tarihStr]);
    } else if (gunlukOgunler.length > 0 && gunlukOgunler[0].kisi_sayisi) {
      // Yoksa öğünlerden al
      setKisiSayisi(gunlukOgunler[0].kisi_sayisi);
    }
    // Hiçbiri yoksa varsayılan (1000) kalır
  }, [secilenTarih, gunlukKisiSayilari, gunlukOgunler]);

  // Kişi sayısını kaydet
  const handleKisiSayisiKaydet = async (yeniKisiSayisi: number) => {
    if (!secilenProje || !secilenTarih) return;
    
    const tarihStr = dayjs(secilenTarih).format('YYYY-MM-DD');
    
    // Local state'i hemen güncelle
    setGunlukKisiSayilari(prev => ({ ...prev, [tarihStr]: yeniKisiSayisi }));
    
    // Eğer o gün için öğün varsa veritabanını da güncelle
    if (gunlukOgunler.length > 0) {
      setKisiSayisiKaydediliyor(true);
      try {
        // Tüm günlük öğünleri güncelle
        for (const ogun of gunlukOgunler) {
          await fetch(`${API_URL}/menu-planlama/menu-ogun/${ogun.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kisi_sayisi: yeniKisiSayisi })
          });
        }
        
        notifications.show({
          title: '✅ Kaydedildi',
          message: `${dayjs(secilenTarih).format('D MMMM')} → ${yeniKisiSayisi.toLocaleString()} kişi`,
          color: 'green'
        });
        
        fetchGunlukOgunler();
        fetchMenuPlan();
      } catch (error) {
        console.error('Kişi sayısı güncelleme hatası:', error);
        notifications.show({
          title: 'Hata',
          message: 'Kişi sayısı kaydedilemedi',
          color: 'red'
        });
      } finally {
        setKisiSayisiKaydediliyor(false);
      }
    } else {
      // Öğün yoksa sadece local kaydet
      notifications.show({
        title: '💾 Geçici Kaydedildi',
        message: `${dayjs(secilenTarih).format('D MMMM')} → ${yeniKisiSayisi.toLocaleString()} kişi (Menü oluşturulduğunda uygulanacak)`,
        color: 'blue'
      });
    }
  };

  // Reçete silme
  const handleReceteSil = async (receteId: number, receteAd: string) => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/receteler/${receteId}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Silme başarısız');
      
      notifications.show({
        title: 'Başarılı',
        message: `"${receteAd}" reçetesi silindi`,
        color: 'green'
      });
      
      fetchReceteler();
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Reçete silinemedi',
        color: 'red'
      });
    }
  };

  // Maliyet hesaplama
  const hesaplaMaliyet = async (receteId: number) => {
    try {
      const res = await fetch(`${API_URL}/menu-planlama/receteler/${receteId}/maliyet-hesapla`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({
          title: 'Maliyet Hesaplandı',
          message: `Porsiyon maliyeti: ${formatCurrency(data.maliyet)}`,
          color: 'green'
        });
        fetchReceteler();
      }
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Maliyet hesaplanamadı',
        color: 'red'
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <Center h={400}>
        <Stack align="center">
          <Loader size="lg" />
          <Text c="dimmed">Menü planlama yükleniyor...</Text>
        </Stack>
      </Center>
    );
  }

  // Günlük maliyet hesabı
  const gunlukToplamMaliyet = gunlukOgunler.reduce((sum, o) => {
    return sum + parseFloat(o.toplam_maliyet || '0');
  }, 0);

  return (
    <Container size="xl" py="md">
      {/* Başlık */}
      <Group justify="space-between" mb="lg">
        <Stack gap={4}>
          <Title order={2}>
            <Group gap="xs">
              <ThemeIcon size="lg" variant="light" color="orange">
                <IconChefHat size={24} />
              </ThemeIcon>
              Menü Planlama
            </Group>
          </Title>
          <Text c="dimmed" size="sm">
            Proje bazlı menü planlaması ve maliyet takibi
          </Text>
        </Stack>
        
        <Group>
          <Group gap={4}>
            <Select
              placeholder="Proje Seçin"
              data={projeler.map(p => ({ value: p.id.toString(), label: p.ad }))}
              value={secilenProje}
              onChange={setSecilenProje}
              w={200}
              leftSection={<IconUsers size={16} />}
            />
            <Tooltip label="Kurum Bilgisi">
              <ActionIcon 
                variant="light" 
                color="blue" 
                size="lg"
                onClick={() => setAktifSekme('kurum')}
                disabled={!secilenProje}
              >
                <IconBuilding size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Group gap={4}>
            <NumberInput
              placeholder="Kişi"
              value={kisiSayisi}
              onChange={(val) => setKisiSayisi(val as number || 1000)}
              w={90}
              min={1}
              leftSection={<IconUsers size={14} />}
              styles={{ input: { textAlign: 'center', paddingLeft: 28 } }}
              size="xs"
            />
            <ActionIcon 
              variant="filled" 
              color="teal" 
              size="lg"
              onClick={() => handleKisiSayisiKaydet(kisiSayisi)}
              loading={kisiSayisiKaydediliyor}
              title="Kişi sayısını kaydet"
            >
              <IconCheck size={16} />
            </ActionIcon>
          </Group>
          <Button 
            leftSection={<IconUpload size={16} />}
            variant="light"
            color="grape"
            onClick={openMenuImportModal}
          >
            Menü İçe Aktar
          </Button>
        </Group>
      </Group>

      {/* Ana İçerik - Split View */}
      <Grid gutter="sm">
        {/* Sol Panel - Takvim & Özet (Kompakt) */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Stack gap="xs">
            {/* Mini Takvim - Kompakt */}
            <Card withBorder shadow="sm" radius="md" p={0}>
              <Box px="xs" py={6} bg="orange.1" style={{ borderBottom: '1px solid var(--mantine-color-orange-2)' }}>
                <Group justify="space-between">
                  <Group gap={4}>
                    <ThemeIcon size="xs" color="orange" variant="filled">
                      <IconCalendar size={12} />
                    </ThemeIcon>
                    <Text fw={600} size="xs" c="orange.9">
                      {secilenTarih ? dayjs(secilenTarih).format('MMM YYYY') : '...'}
                    </Text>
                  </Group>
                  <Group gap={2}>
                    <ActionIcon 
                      size="xs" 
                      variant="subtle" 
                      color="orange"
                      onClick={() => secilenTarih && setSecilenTarih(dayjs(secilenTarih).subtract(1, 'month').toDate())}
                    >
                      <IconChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                    </ActionIcon>
                    <ActionIcon 
                      size="xs" 
                      variant="subtle" 
                      color="orange"
                      onClick={() => secilenTarih && setSecilenTarih(dayjs(secilenTarih).add(1, 'month').toDate())}
                    >
                      <IconChevronRight size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Box>
              <Box px={6} py={4}>
                <MiniCalendar 
                  selectedDate={secilenTarih} 
                  onSelectDate={setSecilenTarih} 
                />
              </Box>
            </Card>

            {/* Günlük Özet - Kompakt */}
            <Card withBorder shadow="sm" radius="md" p={0}>
              <Box px="xs" py={6} bg="blue.1" style={{ borderBottom: '1px solid var(--mantine-color-blue-2)' }}>
                <Text fw={600} size="xs" c="blue.9">
                  📅 {secilenTarih ? dayjs(secilenTarih).format('D MMM ddd') : '—'}
                </Text>
              </Box>
              <Stack gap={4} p="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Günlük Öğün</Text>
                  <Text size="xs" fw={500}>
                    {ogunYapilari.filter(o => o.aktif).length > 0 
                      ? ogunYapilari.filter(o => o.aktif).map(o => 
                          o.ogun_tipi === 'kahvalti' ? 'Sabah' : 
                          o.ogun_tipi === 'ogle' ? 'Öğle' : 'Akşam'
                        ).join(', ')
                      : '—'
                    }
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Kişi Sayısı</Text>
                  <Text size="xs" fw={500} c="blue">{kisiSayisi.toLocaleString()}</Text>
                </Group>
                <Divider size="xs" />
                <Group justify="space-between">
                  <Text size="xs" fw={500}>Günlük Maliyet</Text>
                  <Text size="xs" fw={700} c="green.7">{formatCurrency(gunlukToplamMaliyet * kisiSayisi)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="10px" c="dimmed">Porsiyon Ort.</Text>
                  <Text size="10px">{formatCurrency(gunlukToplamMaliyet / (gunlukOgunler.length || 1))}</Text>
                </Group>
              </Stack>
            </Card>

            {/* Proje Şartname Referansı */}
            <Card withBorder shadow="sm" radius="md" p={0}>
              <Box p="sm" bg="teal.1" style={{ borderBottom: '1px solid var(--mantine-color-teal-2)' }}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon size="sm" color="teal" variant="filled">
                      <IconFileText size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm" c="teal.9">
                      {projeSartnamesi ? projeSartnamesi.ad : 'Şartname Yok'}
                    </Text>
                  </Group>
                  {!projeSartnamesi && (
                    <Tooltip label="Şartnameler sekmesinden proje için şartname atayın">
                      <Badge size="xs" color="orange" variant="light">Atanmamış</Badge>
                    </Tooltip>
                  )}
                </Group>
              </Box>
              {projeSartnamesi ? (
                <ScrollArea h={150}>
                  <Stack gap={4} p="xs">
                    {projeSartnameGramajlari.map((g) => (
                      <Group key={g.id} justify="space-between" px="xs" py={2} style={{ borderRadius: 4, background: 'var(--mantine-color-gray-0)' }}>
                        <Text size="xs" c="dimmed">{g.yemek_turu}</Text>
                        <Badge size="xs" variant="outline" color="teal">
                          {g.porsiyon_gramaj} {g.birim}
                        </Badge>
                      </Group>
                    ))}
                    {projeSartnameGramajlari.length === 0 && (
                      <Text size="xs" c="dimmed" ta="center" py="md">Gramaj tanımı yok</Text>
                    )}
                  </Stack>
                </ScrollArea>
              ) : (
                <Stack gap="xs" p="sm" align="center">
                  <IconFileText size={24} color="gray" />
                  <Text size="xs" c="dimmed" ta="center">
                    Bu projeye henüz şartname atanmamış.
                    <br />Şartnameler sekmesinden atama yapabilirsiniz.
                  </Text>
                </Stack>
              )}
            </Card>
          </Stack>
        </Grid.Col>

        {/* Sağ Panel - Reçeteler & Günlük Menü */}
        <Grid.Col span={{ base: 12, md: 9 }}>
          <Tabs value={aktifSekme} onChange={setAktifSekme}>
            <Tabs.List>
              <Tabs.Tab value="menu" leftSection={<IconCalendar size={16} />}>
                Menü Planı
              </Tabs.Tab>
              <Tabs.Tab value="receteler" leftSection={<IconChefHat size={16} />}>
                Reçete Kütüphanesi
              </Tabs.Tab>
            </Tabs.List>

            {/* Reçete Kütüphanesi Tab */}
            <Tabs.Panel value="receteler" pt="md">
              <Card withBorder shadow="sm" radius="md">
                {/* Filtreler */}
                <Card.Section withBorder inheritPadding py="xs">
                  <Group justify="space-between">
                    <Group gap="sm">
                      <TextInput
                        placeholder="Reçete ara..."
                        value={receteArama}
                        onChange={(e) => setReceteArama(e.target.value)}
                        leftSection={<IconSearch size={16} />}
                        size="xs"
                        w={200}
                      />
                      <Select
                        placeholder="Kategori"
                        data={[
                          { value: '', label: 'Tümü' },
                          ...kategoriler.map(k => ({ value: k.kod, label: `${k.ikon} ${k.ad}` }))
                        ]}
                        value={secilenKategori || ''}
                        onChange={(val) => setSecilenKategori(val || null)}
                        size="xs"
                        w={180}
                        leftSection={<IconFilter size={16} />}
                        clearable
                      />
                    </Group>
                    <Button 
                      size="xs" 
                      leftSection={<IconPlus size={14} />} 
                      color="orange"
                      onClick={openYeniReceteModal}
                    >
                      Yeni Reçete
                    </Button>
                  </Group>
                </Card.Section>

                {/* Reçete Listesi */}
                <ScrollArea h={500}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Reçete</Table.Th>
                        <Table.Th>Kategori</Table.Th>
                        <Table.Th ta="right">Malzeme</Table.Th>
                        <Table.Th ta="right">Kalori</Table.Th>
                        <Table.Th ta="right">Maliyet</Table.Th>
                        <Table.Th ta="center" w={80}>İşlem</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {receteler.map((recete) => (
                        <Table.Tr key={recete.id}>
                          <Table.Td>
                            <UnstyledButton onClick={() => fetchReceteDetay(recete.id)}>
                              <Group gap="xs">
                                <Text size="sm">{recete.kategori_ikon}</Text>
                                <Text size="sm" fw={500} c="blue" style={{ cursor: 'pointer' }}>
                                  {recete.ad}
                                </Text>
                              </Group>
                            </UnstyledButton>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="sm">
                              {recete.kategori_adi}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm">{recete.malzeme_sayisi}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm">{recete.kalori ? `${recete.kalori} kcal` : '—'}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm" fw={500} c={recete.tahmini_maliyet ? 'green' : 'dimmed'}>
                              {formatCurrency(recete.tahmini_maliyet)}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Group gap={4} justify="center">
                              <Tooltip label="Maliyeti Hesapla">
                                <ActionIcon 
                                  variant="light" 
                                  color="blue" 
                                  size="sm"
                                  onClick={() => hesaplaMaliyet(recete.id)}
                                >
                                  <IconCalculator size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Düzenle">
                                <ActionIcon 
                                  variant="light" 
                                  size="sm"
                                  onClick={() => fetchReceteDetay(recete.id)}
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Sil">
                                <ActionIcon 
                                  variant="light" 
                                  color="red"
                                  size="sm"
                                  onClick={() => handleReceteSil(recete.id, recete.ad)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Menüye Ekle">
                                <ActionIcon 
                                  variant="filled" 
                                  color="green"
                                  size="sm"
                                  onClick={() => {
                                    if (!secilenProje) {
                                      notifications.show({
                                        title: 'Uyarı',
                                        message: 'Önce proje seçin',
                                        color: 'yellow'
                                      });
                                      return;
                                    }
                                    setSecilenRecete(recete);
                                    openYemekEkleModal();
                                  }}
                                >
                                  <IconPlus size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      {receteler.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Center py="xl">
                              <Stack align="center" gap="xs">
                                <IconChefHat size={40} color="gray" />
                                <Text c="dimmed">Henüz reçete yok</Text>
                                <Button size="xs" variant="light">İlk reçeteyi ekle</Button>
                              </Stack>
                            </Center>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Card>
            </Tabs.Panel>

            {/* Menü Planı Tab - Aylık Görünüm */}
            <Tabs.Panel value="menu" pt="md">
              <Card withBorder shadow="sm" radius="md" p={0}>
                {/* Başlık */}
                <Box p="sm" bg="blue.0" style={{ borderBottom: '1px solid var(--mantine-color-blue-2)' }}>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <ThemeIcon size="sm" color="blue" variant="filled">
                        <IconCalendar size={14} />
                      </ThemeIcon>
                      <Text fw={600} size="sm" c="blue.9">
                        {secilenTarih ? dayjs(secilenTarih).format('MMMM YYYY') : ''} Aylık Menü
                      </Text>
                    </Group>
                    <Badge color="green" variant="light">
                      Toplam: {formatCurrency(0)}
                    </Badge>
                  </Group>
                </Box>
                
                {/* Aylık Tablo */}
                <ScrollArea>
                  <Table striped withTableBorder withColumnBorders horizontalSpacing="sm" verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={50} ta="center">Gün</Table.Th>
                        <Table.Th w={90} ta="center">Tarih</Table.Th>
                        <Table.Th ta="center">☀️ Kahvaltı</Table.Th>
                        <Table.Th ta="center">🌞 Öğle</Table.Th>
                        <Table.Th ta="center">🌙 Akşam</Table.Th>
                        <Table.Th w={90} ta="center">Maliyet</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {secilenTarih && Array.from({ length: dayjs(secilenTarih).daysInMonth() }, (_, i) => {
                        const gun = dayjs(secilenTarih).date(i + 1);
                        const tarihKey = gun.format('YYYY-MM-DD');
                        const gunMenu = aylikMenu[tarihKey] || {};
                        const kahvalti = gunMenu['kahvalti'] || [];
                        const ogle = gunMenu['ogle'] || [];
                        const aksam = gunMenu['aksam'] || [];
                        const isWeekend = gun.day() === 0 || gun.day() === 6;
                        const isToday = gun.isSame(dayjs(), 'day');
                        const isSelected = gun.isSame(secilenTarih, 'day');
                        const hasMenu = kahvalti.length > 0 || ogle.length > 0 || aksam.length > 0;
                        
                        // Günlük toplam maliyet
                        const gunlukMaliyet = [...kahvalti, ...ogle, ...aksam].reduce(
                          (sum, y) => sum + (parseFloat(y.porsiyon_maliyet) || 0), 0
                        );
                        
                        const renderOgunCell = (yemekler: any[], ogunTip: string) => (
                          <UnstyledButton 
                            w="100%"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSecilenTarih(gun.toDate());
                              setSecilenOgunTip(ogunTip);
                              openYemekEkleModal();
                            }}
                          >
                            {yemekler.length > 0 ? (
                              <Stack gap={2}>
                                {yemekler.map((y, idx) => (
                                  <Box
                                    key={idx}
                                    onClick={async (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      try {
                                        const res = await fetch(`${API_URL}/menu-planlama/yemekler/${y.id}`, {
                                          method: 'DELETE'
                                        });
                                        if (res.ok) {
                                          notifications.show({
                                            title: 'Silindi',
                                            message: `${y.recete_ad} menüden çıkarıldı`,
                                            color: 'orange'
                                          });
                                          fetchMenuPlan();
                                        }
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    style={{ width: '100%' }}
                                  >
                                    <Text size="xs" lineClamp={1} style={{ cursor: 'pointer' }} className="hover-red">
                                      {y.recete_ikon || '🍽️'} {y.recete_ad}
                                    </Text>
                                  </Box>
                                ))}
                              </Stack>
                            ) : (
                              <Text size="xs" c="dimmed" style={{ cursor: 'pointer' }}>
                                + Ekle
                              </Text>
                            )}
                          </UnstyledButton>
                        );
                        
                        return (
                          <Table.Tr 
                            key={i}
                            style={{ 
                              backgroundColor: isSelected 
                                ? 'var(--mantine-color-orange-1)' 
                                : isToday 
                                  ? 'var(--mantine-color-blue-0)' 
                                  : hasMenu
                                    ? 'var(--mantine-color-green-0)'
                                    : isWeekend 
                                      ? 'var(--mantine-color-gray-0)' 
                                      : undefined,
                              cursor: 'pointer'
                            }}
                            onClick={() => setSecilenTarih(gun.toDate())}
                          >
                            <Table.Td ta="center">
                              <Text size="xs" fw={isWeekend ? 400 : 600} c={isWeekend ? 'dimmed' : undefined}>
                                {i + 1}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Text size="xs" c={isWeekend ? 'dimmed' : undefined}>
                                {gun.format('D MMM ddd')}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="center">
                              {renderOgunCell(kahvalti, 'kahvalti')}
                            </Table.Td>
                            <Table.Td ta="center">
                              {renderOgunCell(ogle, 'ogle')}
                            </Table.Td>
                            <Table.Td ta="center">
                              {renderOgunCell(aksam, 'aksam')}
                            </Table.Td>
                            <Table.Td ta="center">
                              {gunlukMaliyet > 0 ? (
                                <Text size="xs" fw={500} c="green.7">
                                  {formatCurrency(gunlukMaliyet * kisiSayisi)}
                                </Text>
                              ) : (
                                <Text size="xs" c="dimmed">—</Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Card>
            </Tabs.Panel>

            {/* Kurum Bilgisi Tab - Proje Bazlı */}
            <Tabs.Panel value="kurum" pt="md">
              {/* Proje Bilgisi Header */}
              <Card withBorder shadow="sm" radius="md" mb="md" bg="blue.0">
                <Group justify="space-between">
                  <Group gap="md">
                    <ThemeIcon size={50} radius="md" color="blue" variant="light">
                      <IconUsers size={28} />
                    </ThemeIcon>
                    <Box>
                      <Text size="xs" c="dimmed">Seçili Proje</Text>
                      <Text size="lg" fw={700}>
                        {projeler.find(p => p.id.toString() === secilenProje)?.ad || 'Proje Seçilmedi'}
                      </Text>
                      {projeSartnamesi ? (
                        <Stack gap={4} mt={4}>
                          <Group gap="xs">
                            <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
                              Şartname Atandı
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {projeSartnamesi.kurum_ikon} {projeSartnamesi.ad}
                            </Text>
                          </Group>
                          <Group gap="xs">
                            <Text size="xs" c="dimmed">Öğünler:</Text>
                            {[
                              { tip: 'kahvalti', label: 'Sabah', color: 'yellow' },
                              { tip: 'ogle', label: 'Öğle', color: 'orange' },
                              { tip: 'aksam', label: 'Akşam', color: 'indigo' }
                            ].map(ogun => {
                              const yapisi = ogunYapilari.find(o => o.ogun_tipi === ogun.tip);
                              return (
                                <Badge 
                                  key={ogun.tip} 
                                  size="sm" 
                                  variant={yapisi?.aktif ? 'filled' : 'light'}
                                  color={yapisi?.aktif ? ogun.color : 'gray'}
                                  style={{ cursor: 'pointer' }}
                                  onClick={async () => {
                                    if (!yapisi) return;
                                    try {
                                      const res = await fetch(`${API_URL}/menu-planlama/ogun-yapisi/${yapisi.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ aktif: !yapisi.aktif })
                                      });
                                      if (res.ok) {
                                        // Proje şartnamesini yeniden yükle
                                        if (secilenProje) {
                                          await fetchProjeSartnamesi(secilenProje);
                                        }
                                        notifications.show({
                                          title: !yapisi.aktif ? '✅ Aktif' : '❌ Pasif',
                                          message: `${ogun.label} ${!yapisi.aktif ? 'aktif edildi' : 'pasif edildi'}`,
                                          color: !yapisi.aktif ? 'green' : 'gray'
                                        });
                                      }
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                >
                                  {ogun.label}
                                </Badge>
                              );
                            })}
                          </Group>
                        </Stack>
                      ) : (
                        <Badge color="orange" variant="light" mt={4}>Şartname Atanmamış</Badge>
                      )}
                    </Box>
                  </Group>
                  <Group gap="xs">
                    <Select
                      size="xs"
                      placeholder="Başka şartname seç..."
                      data={sartnameListesi.map(s => ({ 
                        value: s.id.toString(), 
                        label: `${s.kurum_ikon} ${s.ad}` 
                      }))}
                      value={secilenSartname?.id?.toString() || null}
                      onChange={(val) => val && fetchSartnameDetay(parseInt(val))}
                      w={220}
                      clearable
                    />
                    <Button 
                      size="xs" 
                      variant="light"
                      leftSection={<IconPlus size={14} />}
                      onClick={openSartnameModal}
                    >
                      Yeni Şartname
                    </Button>
                  </Group>
                </Group>
              </Card>

              {/* Gramaj Listesi */}
              <Card withBorder shadow="sm" radius="md">
                <Card.Section withBorder inheritPadding py="xs">
                  <Group justify="space-between">
                    <Group gap="sm">
                      <IconScale size={18} />
                      <Box>
                        <Text fw={600} size="sm">
                          {secilenSartname ? secilenSartname.ad : 'Şartname Gramajları'}
                        </Text>
                        {secilenSartname && (
                          <Text size="xs" c="dimmed">
                            {secilenSartname.kurum_ikon} {secilenSartname.kurum_adi} • {secilenSartname.yil}
                          </Text>
                        )}
                      </Box>
                    </Group>
                  </Group>
                </Card.Section>
                
                {secilenSartname && (
                  <Card.Section inheritPadding py="xs" withBorder>
                    <Group justify="flex-end" gap="xs">
                      {projeSartnamesi?.id === secilenSartname.id ? (
                        <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
                          {projeler.find(p => p.id.toString() === secilenProje)?.ad || 'Proje'} için Atandı
                        </Badge>
                      ) : (
                        <Menu shadow="md" width={200}>
                          <Menu.Target>
                            <Button 
                              size="xs" 
                              variant="light"
                              color="teal"
                              leftSection={<IconUsers size={14} />}
                            >
                              Projeye Ata
                            </Button>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Label>Proje Seçin</Menu.Label>
                            {projeler.map(proje => (
                              <Menu.Item
                                key={proje.id}
                                leftSection={<IconUsers size={14} />}
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`${API_URL}/menu-planlama/sartname/${secilenSartname.id}/proje-ata`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ proje_id: proje.id, varsayilan: true })
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                      notifications.show({
                                        title: 'Başarılı',
                                        message: `${secilenSartname.ad} şartnamesi ${proje.ad} projesine atandı`,
                                        color: 'green'
                                      });
                                      if (secilenProje === proje.id.toString()) {
                                        fetchProjeSartnamesi(secilenProje);
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Şartname atama hatası:', error);
                                    notifications.show({
                                      title: 'Hata',
                                      message: 'Şartname atanamadı',
                                      color: 'red'
                                    });
                                  }
                                }}
                              >
                                {proje.ad}
                              </Menu.Item>
                            ))}
                          </Menu.Dropdown>
                        </Menu>
                      )}
                      <Button 
                        size="xs" 
                        variant="light"
                        leftSection={<IconPlus size={14} />}
                        onClick={openGramajModal}
                      >
                        Gramaj Ekle
                      </Button>
                    </Group>
                  </Card.Section>
                )}
                
                {secilenSartname ? (
                      <ScrollArea h={500}>
                        {/* Öğün Yapıları */}
                        {ogunYapilari.length > 0 && (
                          <Box p="sm" mb="sm" bg="blue.0" style={{ borderRadius: 8 }}>
                            <Text size="sm" fw={600} mb="xs">📋 Öğün Yapıları</Text>
                            <SimpleGrid cols={3}>
                              {ogunYapilari.map(oy => (
                                <Card key={oy.id} withBorder p="xs" radius="sm">
                                  <Text size="sm" fw={500}>
                                    {oy.ogun_tipi === 'kahvalti' ? '☀️ Kahvaltı' : 
                                     oy.ogun_tipi === 'ogle' ? '🌞 Öğle' : '🌙 Akşam'}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {oy.min_cesit}-{oy.max_cesit} çeşit
                                  </Text>
                                  {oy.aciklama && <Text size="xs" mt={4}>{oy.aciklama}</Text>}
                                </Card>
                              ))}
                            </SimpleGrid>
                          </Box>
                        )}
                        
                        {/* Porsiyon Gramajları Tablosu */}
                        <Table striped withTableBorder>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Kategori</Table.Th>
                              <Table.Th>Yemek Türü</Table.Th>
                              <Table.Th ta="center">Porsiyon</Table.Th>
                              <Table.Th>Açıklama</Table.Th>
                              <Table.Th w={60}></Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {sartnameGramajlar.map((g) => (
                              <Table.Tr key={g.id}>
                                <Table.Td>
                                  <Group gap="xs">
                                    {g.kategori_ikon && <Text size="sm">{g.kategori_ikon}</Text>}
                                    <Text size="sm" c="dimmed">{g.kategori_adi || '—'}</Text>
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm" fw={500}>{g.yemek_turu}</Text>
                                </Table.Td>
                                <Table.Td ta="center">
                                  <Badge size="md" variant="light" color="blue">
                                    {g.porsiyon_gramaj} {g.birim}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" c="dimmed">{g.aciklama || '—'}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <ActionIcon 
                                    variant="subtle" 
                                    color="red" 
                                    size="sm"
                                    onClick={() => handleGramajSil(g.id)}
                                  >
                                    <IconTrash size={14} />
                                  </ActionIcon>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                            {sartnameGramajlar.length === 0 && (
                              <Table.Tr>
                                <Table.Td colSpan={5}>
                                  <Center py="xl">
                                    <Text c="dimmed" size="sm">Bu şartnamede henüz porsiyon gramajı tanımlı değil</Text>
                                  </Center>
                                </Table.Td>
                              </Table.Tr>
                            )}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                ) : (
                  <Center h={400}>
                    <Stack align="center" gap="xs">
                      <IconChevronRight size={40} color="gray" />
                      <Text c="dimmed" size="sm">Gramajları görmek için bir şartname seçin</Text>
                    </Stack>
                  </Center>
                )}
              </Card>
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>
      </Grid>

      {/* Şartname Ekleme Modal */}
      <Modal
        opened={sartnameModalOpened}
        onClose={closeSartnameModal}
        title={
          <Group gap="xs">
            <IconScale size={20} />
            <Text fw={600}>Yeni Şartname Oluştur</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Şartname Kodu"
            placeholder="Örn: KYK-2024"
            value={yeniSartname.kod}
            onChange={(e) => setYeniSartname({ ...yeniSartname, kod: e.target.value })}
            required
          />
          <TextInput
            label="Şartname Adı"
            placeholder="Örn: KYK Yurt Yemek Şartnamesi 2024"
            value={yeniSartname.ad}
            onChange={(e) => setYeniSartname({ ...yeniSartname, ad: e.target.value })}
            required
          />
          <Select
            label="Kurum"
            placeholder="Kurum seçin"
            value={yeniSartname.kurum_id}
            onChange={(val) => setYeniSartname({ ...yeniSartname, kurum_id: val || '' })}
            data={kurumlar.map(k => ({ value: k.id.toString(), label: `${k.ikon} ${k.ad}` }))}
            clearable
          />
          <NumberInput
            label="Yıl"
            value={yeniSartname.yil}
            onChange={(val) => setYeniSartname({ ...yeniSartname, yil: typeof val === 'number' ? val : new Date().getFullYear() })}
          />
          <TextInput
            label="Kaynak URL"
            placeholder="Resmi gazete veya mevzuat linki"
            value={yeniSartname.kaynak_url}
            onChange={(e) => setYeniSartname({ ...yeniSartname, kaynak_url: e.target.value })}
          />
          <Textarea
            label="Notlar"
            placeholder="Ek açıklamalar..."
            value={yeniSartname.notlar}
            onChange={(e) => setYeniSartname({ ...yeniSartname, notlar: e.target.value })}
            rows={3}
          />
          <Button onClick={handleSartnameEkle} fullWidth>
            Şartname Oluştur
          </Button>
        </Stack>
      </Modal>

      {/* Porsiyon Gramajı Ekleme Modal - BASİT */}
      <Modal
        opened={gramajModalOpened}
        onClose={closeGramajModal}
        title={
          <Group gap="xs">
            <IconScale size={20} />
            <Text fw={600}>Porsiyon Gramajı Ekle</Text>
          </Group>
        }
        size="sm"
      >
        <Stack gap="md">
          <Select
            label="Kategori"
            placeholder="Kategori seçin (opsiyonel)"
            value={yeniGramaj.kategori_id}
            onChange={(val) => setYeniGramaj({ ...yeniGramaj, kategori_id: val || '' })}
            data={kategoriler.map(k => ({ value: k.id.toString(), label: `${k.ikon} ${k.ad}` }))}
            clearable
          />
          <TextInput
            label="Yemek Türü"
            placeholder="Örn: Et Yemeği, Pilav, Çorba"
            value={yeniGramaj.yemek_turu}
            onChange={(e) => setYeniGramaj({ ...yeniGramaj, yemek_turu: e.target.value })}
            required
          />
          <Group grow>
            <NumberInput
              label="Porsiyon Gramajı"
              placeholder="150"
              value={yeniGramaj.porsiyon_gramaj ? parseInt(yeniGramaj.porsiyon_gramaj) : undefined}
              onChange={(val) => setYeniGramaj({ ...yeniGramaj, porsiyon_gramaj: val?.toString() || '' })}
              required
              min={1}
            />
            <Select
              label="Birim"
              value={yeniGramaj.birim}
              onChange={(val) => setYeniGramaj({ ...yeniGramaj, birim: val || 'g' })}
              data={[
                { value: 'g', label: 'Gram (g)' },
                { value: 'ml', label: 'ml' },
                { value: 'adet', label: 'Adet' }
              ]}
            />
          </Group>
          <TextInput
            label="Açıklama (opsiyonel)"
            placeholder="Örn: Kemiksiz et minimum"
            value={yeniGramaj.aciklama}
            onChange={(e) => setYeniGramaj({ ...yeniGramaj, aciklama: e.target.value })}
          />
          <Button onClick={handleGramajEkle} fullWidth>
            Ekle
          </Button>
        </Stack>
      </Modal>

      {/* Reçete Detay Modal */}
      <Modal
        opened={receteModalOpened}
        onClose={closeReceteModal}
        title={
          <Group gap="xs">
            <Text size="lg">{secilenRecete?.kategori_ikon}</Text>
            <Text fw={600}>{secilenRecete?.ad}</Text>
          </Group>
        }
        size="lg"
      >
        {secilenRecete && (
          <Stack gap="md">
            {/* Özet Bilgiler */}
            <SimpleGrid cols={4}>
              <Card withBorder p="xs" radius="md">
                <Text size="xs" c="dimmed">Kategori</Text>
                <Text size="sm" fw={500}>{secilenRecete.kategori_adi}</Text>
              </Card>
              <Card withBorder p="xs" radius="md">
                <Text size="xs" c="dimmed">Kalori</Text>
                <Text size="sm" fw={500}>{secilenRecete.kalori ? `${secilenRecete.kalori} kcal` : '—'}</Text>
              </Card>
              <Card withBorder p="xs" radius="md">
                <Text size="xs" c="dimmed">Süre</Text>
                <Text size="sm" fw={500}>
                  {(secilenRecete.hazirlik_suresi || 0) + (secilenRecete.pisirme_suresi || 0)} dk
                </Text>
              </Card>
              <Card withBorder p="xs" radius="md" bg="green.0">
                <Text size="xs" c="dimmed">Maliyet</Text>
                <Text size="sm" fw={600} c="green">{formatCurrency(secilenRecete.tahmini_maliyet)}</Text>
              </Card>
            </SimpleGrid>

            {/* Besin Değerleri */}
            {(secilenRecete.protein || secilenRecete.karbonhidrat || secilenRecete.yag) && (
              <Card withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" mb="xs">Besin Değerleri (1 porsiyon)</Text>
                <Group gap="xl">
                  <Box>
                    <Text size="xs" c="dimmed">Protein</Text>
                    <Text size="sm" fw={500}>{secilenRecete.protein || '—'} g</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Karbonhidrat</Text>
                    <Text size="sm" fw={500}>{secilenRecete.karbonhidrat || '—'} g</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Yağ</Text>
                    <Text size="sm" fw={500}>{secilenRecete.yag || '—'} g</Text>
                  </Box>
                </Group>
              </Card>
            )}

            {/* Malzemeler */}
            <Card withBorder p="sm" radius="md">
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={600}>Malzemeler ({secilenRecete.malzemeler?.length || 0})</Text>
                <Button 
                  size="xs" 
                  variant="subtle" 
                  leftSection={<IconPlus size={12} />}
                  onClick={async () => {
                    // Yeni satır ekle
                    try {
                      const res = await fetch(`${API_URL}/menu-planlama/recete/${secilenRecete.id}/malzeme`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          malzeme_adi: 'Yeni Malzeme',
                          miktar: 100,
                          birim: 'g',
                          stok_kart_id: null
                        })
                      });
                      if (res.ok) {
                        fetchReceteDetay(secilenRecete.id);
                      }
                    } catch (error) {
                      console.error(error);
                    }
                  }}
                >
                  Malzeme Ekle
                </Button>
              </Group>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Malzeme</Table.Th>
                    <Table.Th w={120}>Miktar</Table.Th>
                    <Table.Th w={100}>Birim</Table.Th>
                    <Table.Th ta="right">Birim Fiyat</Table.Th>
                    <Table.Th ta="right">Tutar</Table.Th>
                    <Table.Th w={50}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {secilenRecete.malzemeler?.map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          variant="unstyled"
                          defaultValue={m.malzeme_adi}
                          styles={{ input: { fontWeight: 500 } }}
                          onBlur={async (e) => {
                            if (e.target.value !== m.malzeme_adi) {
                              await fetch(`${API_URL}/menu-planlama/recete/malzeme/${m.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  malzeme_adi: e.target.value,
                                  miktar: m.miktar,
                                  birim: m.birim,
                                  stok_kart_id: m.stok_kart_id
                                })
                              });
                              fetchReceteDetay(secilenRecete.id);
                            }
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          variant="unstyled"
                          defaultValue={parseFloat(m.miktar)}
                          min={0}
                          decimalScale={2}
                          onBlur={async (e) => {
                            const newMiktar = parseFloat(e.target.value) || m.miktar;
                            if (newMiktar !== parseFloat(m.miktar)) {
                              await fetch(`${API_URL}/menu-planlama/recete/malzeme/${m.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  malzeme_adi: m.malzeme_adi,
                                  miktar: newMiktar,
                                  birim: m.birim,
                                  stok_kart_id: m.stok_kart_id
                                })
                              });
                              fetchReceteDetay(secilenRecete.id);
                            }
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          variant="unstyled"
                          data={['g', 'kg', 'ml', 'L', 'adet', 'dilim', 'demet', 'tutam']}
                          defaultValue={m.birim}
                          onChange={async (val) => {
                            if (val && val !== m.birim) {
                              await fetch(`${API_URL}/menu-planlama/recete/malzeme/${m.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  malzeme_adi: m.malzeme_adi,
                                  miktar: m.miktar,
                                  birim: val,
                                  stok_kart_id: m.stok_kart_id
                                })
                              });
                              fetchReceteDetay(secilenRecete.id);
                            }
                          }}
                        />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c="dimmed">{formatCurrency(m.birim_fiyat)}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={500}>{formatCurrency(m.toplam_fiyat)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label="Sil">
                          <ActionIcon 
                            variant="subtle" 
                            color="red" 
                            size="sm"
                            onClick={async () => {
                              try {
                                const res = await fetch(`${API_URL}/menu-planlama/recete/malzeme/${m.id}`, {
                                  method: 'DELETE'
                                });
                                if (res.ok) {
                                  notifications.show({
                                    title: 'Başarılı',
                                    message: 'Malzeme silindi',
                                    color: 'green'
                                  });
                                  fetchReceteDetay(secilenRecete.id);
                                }
                              } catch (error) {
                                notifications.show({
                                  title: 'Hata',
                                  message: 'Malzeme silinemedi',
                                  color: 'red'
                                });
                              }
                            }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {(!secilenRecete.malzemeler || secilenRecete.malzemeler.length === 0) && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text size="sm" c="dimmed" ta="center" py="md">
                          Henüz malzeme eklenmemiş. "Malzeme Ekle" butonuna tıklayın.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Card>

            {/* Tarif */}
            {secilenRecete.tarif && (
              <Card withBorder p="sm" radius="md">
                <Text size="sm" fw={600} mb="xs">Tarif</Text>
                <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                  {secilenRecete.tarif}
                </Text>
              </Card>
            )}

            {/* Aksiyonlar */}
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeReceteModal}>Kapat</Button>
              <Button 
                color="blue" 
                leftSection={<IconCalculator size={16} />}
                onClick={() => {
                  hesaplaMaliyet(secilenRecete.id);
                  closeReceteModal();
                }}
              >
                Maliyeti Hesapla
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Malzeme Düzenleme Modal */}
      <Modal
        opened={malzemeModalOpened}
        onClose={closeMalzemeModal}
        title={duzenlenenMalzeme?.id ? 'Malzeme Düzenle' : 'Malzeme Ekle'}
        size="md"
      >
        {duzenlenenMalzeme && (
          <Stack gap="md">
            <Select
              label="Stok Kartından Seç (Opsiyonel)"
              placeholder="Stok kartı ara..."
              data={stokKartlari.map(sk => ({ value: sk.id.toString(), label: sk.ad }))}
              value={duzenlenenMalzeme.stok_kart_id?.toString() || ''}
              onChange={(val) => {
                const sk = stokKartlari.find(s => s.id.toString() === val);
                setDuzenlenenMalzeme({
                  ...duzenlenenMalzeme,
                  stok_kart_id: val ? parseInt(val) : null,
                  malzeme_adi: sk ? sk.ad : duzenlenenMalzeme.malzeme_adi
                });
              }}
              searchable
              clearable
            />
            <TextInput
              label="Malzeme Adı"
              placeholder="Malzeme adı"
              value={duzenlenenMalzeme.malzeme_adi}
              onChange={(e) => setDuzenlenenMalzeme({...duzenlenenMalzeme, malzeme_adi: e.target.value})}
              required
            />
            <Group grow>
              <NumberInput
                label="Miktar"
                placeholder="Miktar"
                value={parseFloat(duzenlenenMalzeme.miktar) || ''}
                onChange={(val) => setDuzenlenenMalzeme({...duzenlenenMalzeme, miktar: val?.toString() || ''})}
                min={0}
                decimalScale={2}
                required
              />
              <Select
                label="Birim"
                data={[
                  { value: 'g', label: 'Gram (g)' },
                  { value: 'kg', label: 'Kilogram (kg)' },
                  { value: 'ml', label: 'Mililitre (ml)' },
                  { value: 'L', label: 'Litre (L)' },
                  { value: 'adet', label: 'Adet' },
                  { value: 'dilim', label: 'Dilim' },
                  { value: 'demet', label: 'Demet' },
                  { value: 'tutam', label: 'Tutam' }
                ]}
                value={duzenlenenMalzeme.birim}
                onChange={(val) => setDuzenlenenMalzeme({...duzenlenenMalzeme, birim: val || 'g'})}
              />
            </Group>
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeMalzemeModal}>İptal</Button>
              <Button
                color="blue"
                onClick={async () => {
                  try {
                    const url = duzenlenenMalzeme.id 
                      ? `${API_URL}/menu-planlama/recete/malzeme/${duzenlenenMalzeme.id}`
                      : `${API_URL}/menu-planlama/recete/${duzenlenenMalzeme.recete_id}/malzeme`;
                    
                    const res = await fetch(url, {
                      method: duzenlenenMalzeme.id ? 'PUT' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        malzeme_adi: duzenlenenMalzeme.malzeme_adi,
                        miktar: parseFloat(duzenlenenMalzeme.miktar),
                        birim: duzenlenenMalzeme.birim,
                        stok_kart_id: duzenlenenMalzeme.stok_kart_id
                      })
                    });
                    
                    if (res.ok) {
                      notifications.show({
                        title: 'Başarılı',
                        message: duzenlenenMalzeme.id ? 'Malzeme güncellendi' : 'Malzeme eklendi',
                        color: 'green'
                      });
                      closeMalzemeModal();
                      fetchReceteDetay(duzenlenenMalzeme.recete_id);
                    } else {
                      throw new Error('İşlem başarısız');
                    }
                  } catch (error) {
                    notifications.show({
                      title: 'Hata',
                      message: 'İşlem sırasında hata oluştu',
                      color: 'red'
                    });
                  }
                }}
              >
                {duzenlenenMalzeme.id ? 'Güncelle' : 'Ekle'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Yemek Ekleme Modal */}
      <Modal
        opened={yemekEkleModalOpened}
        onClose={() => {
          closeYemekEkleModal();
          setSecilenRecete(null);
        }}
        title={
          <Group gap="xs">
            <IconChefHat size={20} />
            <Box>
              <Text fw={600}>{secilenRecete ? `"${secilenRecete.ad}" Menüye Ekle` : 'Yemek Ekle'}</Text>
              <Text size="xs" c="dimmed">
                {secilenTarih ? dayjs(secilenTarih).format('D MMMM dddd') : 'Tarih seçin'}
              </Text>
            </Box>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          {/* Seçilen reçete varsa tarih seçtir */}
          {secilenRecete && (
            <Card withBorder p="sm" bg="green.0">
              <Group gap="sm">
                <Text size="lg">{secilenRecete.kategori_ikon || '🍽️'}</Text>
                <Box>
                  <Text fw={600}>{secilenRecete.ad}</Text>
                  <Text size="xs" c="dimmed">{secilenRecete.kategori_adi}</Text>
                </Box>
              </Group>
            </Card>
          )}
          
          {/* Tarih Seçimi */}
          {secilenRecete && (
            <Box>
              <Text size="sm" fw={500} mb="xs">📅 Tarih Seç</Text>
              <input 
                type="date" 
                value={secilenTarih ? dayjs(secilenTarih).format('YYYY-MM-DD') : ''}
                onChange={(e) => setSecilenTarih(e.target.value ? new Date(e.target.value) : null)}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  borderRadius: '8px', 
                  border: '1px solid #dee2e6',
                  fontSize: '14px'
                }}
              />
            </Box>
          )}
          
          {/* Öğün Tipi Seçimi */}
          <Box>
            <Text size="sm" fw={500} mb="xs">Öğün Seç</Text>
            <SegmentedControl
              fullWidth
              value={secilenOgunTip}
              onChange={setSecilenOgunTip}
              data={[
                { label: '☀️ Kahvaltı', value: 'kahvalti' },
                { label: '🌞 Öğle', value: 'ogle' },
                { label: '🌙 Akşam', value: 'aksam' },
              ]}
            />
          </Box>
          
          {/* Seçilen reçete varsa direkt ekle butonu */}
          {secilenRecete && (
            <Button 
              fullWidth 
              size="lg"
              color="green"
              leftSection={<IconPlus size={20} />}
              disabled={!secilenTarih}
              onClick={async () => {
                try {
                  const res = await fetch(`${API_URL}/menu-planlama/menu-plan/yemek-ekle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      proje_id: secilenProje,
                      tarih: dayjs(secilenTarih).format('YYYY-MM-DD'),
                      ogun_tipi: secilenOgunTip,
                      recete_id: secilenRecete.id,
                      kisi_sayisi: kisiSayisi
                    })
                  });
                  
                  if (!res.ok) throw new Error('Yemek eklenemedi');
                  
                  closeYemekEkleModal();
                  setSecilenRecete(null);
                  notifications.show({
                    title: '✅ Yemek Eklendi',
                    message: `${secilenRecete.ad} → ${dayjs(secilenTarih).format('D MMMM')} ${secilenOgunTip === 'kahvalti' ? 'Kahvaltı' : secilenOgunTip === 'ogle' ? 'Öğle' : 'Akşam'}`,
                    color: 'green'
                  });
                  fetchMenuPlan();
                } catch (err) {
                  notifications.show({
                    title: 'Hata',
                    message: 'Yemek eklenirken hata oluştu',
                    color: 'red'
                  });
                }
              }}
            >
              Menüye Ekle
            </Button>
          )}
          
          {/* Reçete Arama - seçili reçete yoksa göster */}
          {!secilenRecete && (
            <Group gap="sm">
              <TextInput
                placeholder="Reçete ara..."
                leftSection={<IconSearch size={16} />}
                value={receteArama}
                onChange={(e) => setReceteArama(e.target.value)}
                style={{ flex: 1 }}
              />
              <Select
                placeholder="Kategori"
                data={[
                  { value: '', label: 'Tümü' },
                  ...kategoriler.map(k => ({ value: k.kod, label: `${k.ikon} ${k.ad}` }))
                ]}
                value={secilenKategori || ''}
                onChange={(val) => setSecilenKategori(val || null)}
                w={180}
                clearable
              />
            </Group>
          )}
          
          {/* Reçete Listesi - seçili reçete yoksa göster */}
          {!secilenRecete && (
            <ScrollArea h={350}>
              <Stack gap="xs">
                {receteler.filter(r => 
                  (!receteArama || r.ad.toLowerCase().includes(receteArama.toLowerCase())) &&
                  (!secilenKategori || kategoriler.find(k => k.kod === secilenKategori)?.id === r.kategori_id)
                ).map((recete) => (
                  <UnstyledButton
                    key={recete.id}
                    onClick={async () => {
                      // Yemek ekleme işlemi
                      try {
                        const res = await fetch(`${API_URL}/menu-planlama/menu-plan/yemek-ekle`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            proje_id: secilenProje,
                            tarih: dayjs(secilenTarih).format('YYYY-MM-DD'),
                            ogun_tipi: secilenOgunTip,
                            recete_id: recete.id,
                            kisi_sayisi: kisiSayisi
                          })
                        });
                        
                        if (!res.ok) throw new Error('Yemek eklenemedi');
                        
                        closeYemekEkleModal();
                        notifications.show({
                          title: 'Yemek Eklendi',
                          message: `${recete.ad} - ${secilenOgunTip === 'kahvalti' ? 'Kahvaltı' : secilenOgunTip === 'ogle' ? 'Öğle' : 'Akşam'} menüsüne eklendi`,
                          color: 'green'
                        });
                        // Menü planını yenile
                        fetchMenuPlan();
                      } catch (err) {
                        notifications.show({
                          title: 'Hata',
                          message: 'Yemek eklenirken hata oluştu',
                          color: 'red'
                        });
                      }
                    }}
                    w="100%"
                  >
                    <Card withBorder p="sm" radius="sm" style={{ cursor: 'pointer' }} className="hover-lift">
                      <Group justify="space-between">
                        <Group gap="sm">
                          <Text size="xl">{recete.kategori_ikon}</Text>
                          <Box>
                            <Text size="sm" fw={500}>{recete.ad}</Text>
                            <Group gap="xs">
                              <Badge size="xs" variant="light">{recete.kategori_adi}</Badge>
                              <Text size="xs" c="dimmed">{recete.malzeme_sayisi} malzeme</Text>
                            </Group>
                          </Box>
                        </Group>
                        <Box ta="right">
                          <Text size="sm" c="green" fw={600}>{formatCurrency(recete.tahmini_maliyet)}</Text>
                          <Text size="xs" c="dimmed">{recete.kalori || '—'} kcal</Text>
                        </Box>
                      </Group>
                    </Card>
                  </UnstyledButton>
                ))}
                
                {receteler.length === 0 && (
                  <Center py="xl">
                    <Stack align="center" gap="xs">
                      <IconChefHat size={40} color="gray" />
                      <Text c="dimmed" size="sm">Henüz reçete yok</Text>
                    </Stack>
                  </Center>
                )}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Modal>
      
      {/* ========================= */}
      {/* YENİ REÇETE OLUŞTURMA MODAL */}
      {/* ========================= */}
      <Modal
        opened={yeniReceteModalOpened}
        onClose={closeYeniReceteModal}
        title={
          <Group gap="xs">
            <ThemeIcon size="md" variant="light" color="orange">
              <IconChefHat size={18} />
            </ThemeIcon>
            <Text fw={600}>Yeni Reçete Oluştur</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Reçete Adı"
            placeholder="Örn: Mercimek Çorbası"
            required
            value={yeniReceteForm.ad}
            onChange={(e) => setYeniReceteForm(prev => ({ ...prev, ad: e.target.value }))}
          />
          
          <Select
            label="Kategori"
            placeholder="Kategori seçin"
            required
            data={kategoriler.map(k => ({ value: k.id.toString(), label: `${k.ikon} ${k.ad}` }))}
            value={yeniReceteForm.kategori_id}
            onChange={(val) => setYeniReceteForm(prev => ({ ...prev, kategori_id: val || '' }))}
          />
          
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              label="Kalori (kcal)"
              placeholder="180"
              value={yeniReceteForm.kalori ? Number(yeniReceteForm.kalori) : ''}
              onChange={(val) => setYeniReceteForm(prev => ({ ...prev, kalori: val?.toString() || '' }))}
            />
            <NumberInput
              label="Protein (g)"
              placeholder="12"
              value={yeniReceteForm.protein ? Number(yeniReceteForm.protein) : ''}
              onChange={(val) => setYeniReceteForm(prev => ({ ...prev, protein: val?.toString() || '' }))}
            />
            <NumberInput
              label="Karbonhidrat (g)"
              placeholder="28"
              value={yeniReceteForm.karbonhidrat ? Number(yeniReceteForm.karbonhidrat) : ''}
              onChange={(val) => setYeniReceteForm(prev => ({ ...prev, karbonhidrat: val?.toString() || '' }))}
            />
            <NumberInput
              label="Yağ (g)"
              placeholder="4"
              value={yeniReceteForm.yag ? Number(yeniReceteForm.yag) : ''}
              onChange={(val) => setYeniReceteForm(prev => ({ ...prev, yag: val?.toString() || '' }))}
            />
          </SimpleGrid>
          
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={closeYeniReceteModal}>İptal</Button>
            <Button
              color="orange"
              leftSection={<IconPlus size={16} />}
              loading={yeniReceteLoading}
              disabled={!yeniReceteForm.ad || !yeniReceteForm.kategori_id}
              onClick={async () => {
                setYeniReceteLoading(true);
                try {
                  const kod = yeniReceteForm.ad.substring(0,3).toUpperCase().replace(/[^A-ZĞÜŞİÖÇ]/gi,'X') + '-' + Date.now().toString().slice(-6);
                  
                  const res = await fetch(`${API_URL}/menu-planlama/receteler`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      kod,
                      ad: yeniReceteForm.ad,
                      kategori_id: parseInt(yeniReceteForm.kategori_id),
                      porsiyon_miktar: 1,
                      kalori: yeniReceteForm.kalori ? parseFloat(yeniReceteForm.kalori) : null,
                      protein: yeniReceteForm.protein ? parseFloat(yeniReceteForm.protein) : null,
                      karbonhidrat: yeniReceteForm.karbonhidrat ? parseFloat(yeniReceteForm.karbonhidrat) : null,
                      yag: yeniReceteForm.yag ? parseFloat(yeniReceteForm.yag) : null,
                      proje_id: secilenProje ? parseInt(secilenProje) : null // Proje bazlı reçete
                    })
                  });
                  
                  if (!res.ok) throw new Error('Reçete oluşturulamadı');
                  
                  notifications.show({
                    title: 'Başarılı',
                    message: `${yeniReceteForm.ad} reçetesi oluşturuldu`,
                    color: 'green'
                  });
                  
                  closeYeniReceteModal();
                  setYeniReceteForm({ ad: '', kategori_id: '', kalori: '', protein: '', karbonhidrat: '', yag: '' });
                  fetchReceteler();
                } catch (err) {
                  notifications.show({
                    title: 'Hata',
                    message: 'Reçete oluşturulamadı',
                    color: 'red'
                  });
                } finally {
                  setYeniReceteLoading(false);
                }
              }}
            >
              Reçete Oluştur
            </Button>
          </Group>
        </Stack>
      </Modal>
      
      {/* ========================= */}
      {/* MENÜ İÇE AKTARMA MODAL */}
      {/* ========================= */}
      <Modal
        opened={menuImportModalOpened}
        onClose={() => {
          closeMenuImportModal();
          setImportResult(null);
        }}
        title={
          <Group gap="xs">
            <ThemeIcon size="md" variant="light" color="grape">
              <IconFileAnalytics size={18} />
            </ThemeIcon>
            <Text fw={600}>Menü Planına Aktar</Text>
          </Group>
        }
        size="xl"
      >
        <Stack gap="md">
          {!importResult ? (
            <>
              <Alert icon={<IconFileAnalytics size={16} />} color="grape" variant="light">
                Excel, PDF veya görsel formatında menü dosyası yükleyin. 
                Sistem tarihleri ve yemekleri otomatik algılayıp menü planına aktaracak.
              </Alert>
              
              <Dropzone
                onDrop={async (files) => {
                  if (files.length === 0) return;
                  
                  setImportLoading(true);
                  const formData = new FormData();
                  formData.append('file', files[0]);
                  
                  try {
                    const res = await fetch(`${API_URL}/menu-planlama/import/analyze`, {
                      method: 'POST',
                      body: formData
                    });
                    
                    if (!res.ok) throw new Error('Analiz başarısız');
                    
                    const data = await res.json();
                    if (data.success) {
                      setImportResult(data);
                      notifications.show({
                        title: 'Analiz Tamamlandı',
                        message: `${data.ozet?.toplam_gun || 0} gün, ${data.ozet?.toplam_yemek || 0} yemek bulundu`,
                        color: 'green'
                      });
                    } else {
                      throw new Error(data.error || 'Analiz başarısız');
                    }
                  } catch (err: any) {
                    notifications.show({
                      title: 'Hata',
                      message: err.message || 'Dosya analiz edilemedi',
                      color: 'red'
                    });
                  } finally {
                    setImportLoading(false);
                  }
                }}
                loading={importLoading}
                accept={[...PDF_MIME_TYPE, ...MS_EXCEL_MIME_TYPE, ...IMAGE_MIME_TYPE]}
                maxSize={50 * 1024 * 1024}
                useFsAccessApi={false}
              >
                <Group justify="center" gap="xl" mih={200} style={{ pointerEvents: 'none' }}>
                  <Dropzone.Accept>
                    <IconUpload size={52} color="var(--mantine-color-grape-6)" />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <IconX size={52} color="var(--mantine-color-red-6)" />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <IconFileAnalytics size={52} color="var(--mantine-color-dimmed)" />
                  </Dropzone.Idle>
                  
                  <Stack gap="xs" align="center">
                    <Text size="xl" fw={500}>
                      Menü dosyasını sürükleyin
                    </Text>
                    <Text size="sm" c="dimmed">
                      Excel (.xlsx), PDF veya Görsel (PNG/JPG) formatları desteklenir
                    </Text>
                    <Group gap="xs">
                      <Badge variant="light" color="blue">Excel</Badge>
                      <Badge variant="light" color="red">PDF</Badge>
                      <Badge variant="light" color="green">PNG/JPG</Badge>
                    </Group>
                  </Stack>
                </Group>
              </Dropzone>
            </>
          ) : (
            <>
              {/* Özet Bilgiler */}
              <SimpleGrid cols={4}>
                <Card withBorder p="sm" radius="md" bg="grape.0">
                  <Text size="xs" c="dimmed">Toplam Gün</Text>
                  <Text size="xl" fw={700} c="grape">{importResult.ozet?.toplam_gun || 0}</Text>
                </Card>
                <Card withBorder p="sm" radius="md" bg="blue.0">
                  <Text size="xs" c="dimmed">Toplam Yemek</Text>
                  <Text size="xl" fw={700} c="blue">{importResult.ozet?.toplam_yemek || 0}</Text>
                </Card>
                <Card withBorder p="sm" radius="md" bg="orange.0">
                  <Text size="xs" c="dimmed">Kahvaltı</Text>
                  <Text size="xl" fw={700} c="orange">{importResult.ozet?.ogunler?.kahvalti || 0}</Text>
                </Card>
                <Card withBorder p="sm" radius="md" bg="teal.0">
                  <Text size="xs" c="dimmed">Akşam</Text>
                  <Text size="xl" fw={700} c="teal">{importResult.ozet?.ogunler?.aksam || 0}</Text>
                </Card>
              </SimpleGrid>
              
              {/* Tarih Aralığı */}
              {importResult.ozet?.tarih_araligi && (
                <Alert icon={<IconCalendar size={16} />} color="blue" variant="light">
                  <Group gap="xs">
                    <Text size="sm" fw={500}>Tarih Aralığı:</Text>
                    <Text size="sm">{dayjs(importResult.ozet.tarih_araligi.baslangic).format('D MMMM YYYY')}</Text>
                    <Text size="sm">-</Text>
                    <Text size="sm">{dayjs(importResult.ozet.tarih_araligi.bitis).format('D MMMM YYYY')}</Text>
                  </Group>
                </Alert>
              )}
              
              {/* Menü Önizleme */}
              <Text size="sm" fw={500}>Önizleme ({importResult.data?.length || 0} gün)</Text>
              <ScrollArea h={300}>
                <Stack gap="xs">
                  {(importResult.data || []).map((gun: any, idx: number) => (
                    <Card key={idx} withBorder p="sm" radius="sm">
                      <Group justify="space-between" mb="xs">
                        <Group gap="xs">
                          <Badge 
                            color={gun.ogun === 'kahvalti' ? 'orange' : gun.ogun === 'ogle' ? 'yellow' : 'blue'}
                            variant="light"
                          >
                            {gun.ogun === 'kahvalti' ? '☀️ Kahvaltı' : gun.ogun === 'ogle' ? '🌞 Öğle' : '🌙 Akşam'}
                          </Badge>
                          <Text size="sm" fw={500}>{dayjs(gun.tarih).format('D MMMM dddd')}</Text>
                        </Group>
                        <Badge variant="dot" size="sm">{gun.yemekler?.length || 0} yemek</Badge>
                      </Group>
                      <Group gap="xs" wrap="wrap">
                        {(gun.yemekler || []).map((yemek: string, yIdx: number) => (
                          <Badge key={yIdx} variant="outline" color="gray" size="sm">
                            {yemek}
                          </Badge>
                        ))}
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
              
              {/* Aksiyon Butonları */}
              <Group justify="space-between">
                <Button 
                  variant="subtle" 
                  color="gray"
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => setImportResult(null)}
                >
                  Başka Dosya Yükle
                </Button>
                <Button
                  color="grape"
                  size="md"
                  leftSection={<IconCheck size={18} />}
                  loading={importLoading}
                  disabled={!secilenProje}
                  onClick={async () => {
                    if (!secilenProje) {
                      notifications.show({
                        title: 'Hata',
                        message: 'Lütfen önce bir proje seçin',
                        color: 'red'
                      });
                      return;
                    }
                    
                    setImportLoading(true);
                    try {
                      const res = await fetch(`${API_URL}/menu-planlama/import/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          proje_id: secilenProje,
                          menuData: importResult.data
                        })
                      });
                      
                      if (!res.ok) throw new Error('Kayıt başarısız');
                      
                      const data = await res.json();
                      
                      if (data.success) {
                        notifications.show({
                          title: '🎉 Aktarım Tamamlandı!',
                          message: `${data.sonuc.eklenen_gun} gün, ${data.sonuc.eklenen_yemek} yemek menü planına eklendi`,
                          color: 'green',
                          autoClose: 5000
                        });
                        
                        closeMenuImportModal();
                        setImportResult(null);
                        
                        // Menü planını yenile
                        fetchMenuPlan();
                        fetchReceteler();
                      } else {
                        throw new Error(data.error);
                      }
                    } catch (err: any) {
                      notifications.show({
                        title: 'Hata',
                        message: err.message || 'Menü aktarılamadı',
                        color: 'red'
                      });
                    } finally {
                      setImportLoading(false);
                    }
                  }}
                >
                  Menü Planına Aktar ({importResult.ozet?.toplam_yemek || 0} yemek)
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Container>
  );
}

