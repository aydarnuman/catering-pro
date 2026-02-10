'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  Group,
  LoadingOverlay,
  Menu,
  Modal,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowsExchange,
  IconBuilding,
  IconCar,
  IconCheck,
  IconChevronDown,
  IconClipboardList,
  IconDotsVertical,
  IconEdit,
  IconMapPin,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconTool,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import RaporMerkeziModal from '@/components/rapor-merkezi/RaporMerkeziModal';
import StyledDatePicker from '@/components/ui/StyledDatePicker';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { demirbasAPI } from '@/lib/api/services/demirbas';
import { personelAPI } from '@/lib/api/services/personel';
import { formatDate } from '@/lib/formatters';
import 'dayjs/locale/tr';

// Tip tanımları
interface Kategori {
  id: number;
  kod: string;
  ad: string;
  renk: string;
  ikon: string;
  demirbas_sayisi: number;
  ust_kategori_id: number | null;
}

interface Lokasyon {
  id: number;
  kod: string;
  ad: string;
  tip: string;
  demirbas_sayisi: number;
}

interface Demirbas {
  id: number;
  kod: string;
  ad: string;
  kategori_id: number;
  kategori_ad: string;
  kategori_renk: string;
  kategori_ikon: string;
  marka: string;
  model: string;
  seri_no: string;
  alis_tarihi: string;
  alis_fiyati: number;
  garanti_bitis: string;
  garanti_durumu: string;
  net_defter_degeri: number;
  birikimis_amortisman: number;
  lokasyon_id: number;
  lokasyon_ad: string;
  lokasyon_detay: string;
  proje_id: number | null;
  proje_ad: string | null;
  zimmetli_personel_id: number;
  zimmetli_personel: string;
  zimmetli_departman: string;
  durum: string;
  tedarikci: string;
}

interface Proje {
  id: number;
  ad: string;
}

interface Personel {
  id: number;
  ad: string;
  soyad: string;
  departman: string;
}

interface Istatistik {
  toplam_demirbas: number;
  aktif: number;
  bakimda: number;
  arizali: number;
  zimmetli: number;
  toplam_alis_degeri: number;
  toplam_net_deger: number;
  toplam_amortisman: number;
}

interface GarantiItem {
  id: number | string;
  ad: string;
  marka?: string;
  model?: string;
  kalan_gun: number;
}

interface BakimItem {
  id: number | string;
  ad: string;
  servis_firma?: string;
  gecen_gun: number;
}

interface DemirbasDetay {
  kod: string;
  ad: string;
  marka?: string;
  model?: string;
  seri_no?: string;
  durum?: string;
  alis_fiyati?: number | string;
  birikimis_amortisman?: number | string;
  net_defter_degeri?: number | string;
  zimmetli_personel?: string;
  zimmetli_departman?: string;
  lokasyon_ad?: string;
  lokasyon_detay?: string;
  hareketler?: Array<{
    tarih: string;
    hareket_tipi: string;
    aciklama?: string;
    yeni_personel?: string;
    yeni_lokasyon?: string;
  }>;
  [key: string]: unknown;
}

export default function DemirbasPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [demirbaslar, setDemirbaslar] = useState<Demirbas[]>([]);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [lokasyonlar, setLokasyonlar] = useState<Lokasyon[]>([]);
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [istatistik, setIstatistik] = useState<Istatistik | null>(null);
  const [_kategoriDagilimi, setKategoriDagilimi] = useState<Record<string, unknown>[]>([]);
  const [garantiYaklasan, setGarantiYaklasan] = useState<GarantiItem[]>([]);
  const [bakimdakiler, setBakimdakiler] = useState<BakimItem[]>([]);

  // Filter states
  const [activeTab, setActiveTab] = useState<string | null>('tumu');
  const [selectedKategori, _setSelectedKategori] = useState<string | null>(null);
  const [selectedLokasyonFilter, setSelectedLokasyonFilter] = useState<number | null>(null);
  const [selectedProjeFilter, setSelectedProjeFilter] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  // Modal states
  const [demirbasModalOpened, { open: openDemirbasModal, close: closeDemirbasModal }] =
    useDisclosure(false);
  const [aracModalOpened, { open: openAracModal, close: closeAracModal }] = useDisclosure(false);
  const [zimmetModalOpened, { open: openZimmetModal, close: closeZimmetModal }] =
    useDisclosure(false);
  const [bakimModalOpened, { open: openBakimModal, close: closeBakimModal }] = useDisclosure(false);
  const [transferModalOpened, { open: openTransferModal, close: closeTransferModal }] =
    useDisclosure(false);
  const [detayModalOpened, { open: openDetayModal, close: closeDetayModal }] = useDisclosure(false);
  const [lokasyonModalOpened, { open: openLokasyonModal, close: closeLokasyonModal }] =
    useDisclosure(false);

  // Lokasyon yönetimi
  const [editingLokasyon, setEditingLokasyon] = useState<Lokasyon | null>(null);
  const [lokasyonForm, setLokasyonForm] = useState({
    ad: '',
    kod: '',
    tip: 'depo',
    adres: '',
    aciklama: '',
  });

  // Rapor Merkezi
  const [raporMerkeziOpen, setRaporMerkeziOpen] = useState(false);

  // Selected item for operations
  const [selectedDemirbas, setSelectedDemirbas] = useState<Demirbas | null>(null);
  const [detayData, setDetayData] = useState<DemirbasDetay | null>(null);

  // Envanter Form (Yatay Kart Seçimi)
  const [envanterStep, setEnvanterStep] = useState(1);
  const [selectedKategoriForForm, setSelectedKategoriForForm] = useState<Kategori | null>(null);

  // Form states
  const [demirbasForm, setDemirbasForm] = useState({
    ad: '',
    kategori_id: '',
    marka: '',
    model: '',
    seri_no: '',
    alis_tarihi: null as Date | null,
    alis_fiyati: 0,
    garanti_suresi: 24,
    lokasyon_id: '',
    lokasyon_detay: '',
    proje_id: '',
    aciklama: '',
  });

  // Araç Form (özel alanlar)
  const [aracForm, setAracForm] = useState({
    ad: '',
    plaka: '',
    marka: '',
    model: '',
    yil: new Date().getFullYear(),
    sasi_no: '',
    motor_no: '',
    renk: '',
    yakit_tipi: 'dizel',
    alis_tarihi: null as Date | null,
    alis_fiyati: 0,
    km: 0,
    muayene_tarihi: null as Date | null,
    sigorta_bitis: null as Date | null,
    kasko_bitis: null as Date | null,
    lokasyon_id: '',
    aciklama: '',
  });

  const [zimmetForm, setZimmetForm] = useState({
    personel_id: '',
    tarih: new Date(),
    notlar: '',
  });

  const [bakimForm, setBakimForm] = useState({
    bakim_tipi: 'ariza',
    bakim_nedeni: '',
    servis_firma: '',
    tahmini_donus: null as Date | null,
    tahmini_maliyet: 0,
    garanti_kapsaminda: false,
  });

  const [transferForm, setTransferForm] = useState({
    lokasyon_id: '',
    lokasyon_detay: '',
    aciklama: '',
  });

  // Para formatı
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  // Verileri yükle
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [demirbasRes, kategoriRes, lokasyonRes, projelerRes, personelRes, istatistikRes] =
        await Promise.allSettled([
          demirbasAPI.getDemirbaslar(),
          demirbasAPI.getKategoriler(),
          demirbasAPI.getLokasyonlar(),
          personelAPI.getProjeler({ durum: 'aktif' }),
          personelAPI.getPersoneller(),
          demirbasAPI.getIstatistikOzet(),
        ]);

      // Her bir sonucu kontrol et
      if (demirbasRes.status === 'fulfilled' && demirbasRes.value.success) {
        setDemirbaslar((demirbasRes.value.data as Demirbas[]) || []);
      } else {
        console.error(
          'Demirbaş yükleme hatası:',
          demirbasRes.status === 'rejected' ? demirbasRes.reason : 'API başarısız'
        );
        setDemirbaslar([]);
      }

      if (kategoriRes.status === 'fulfilled' && kategoriRes.value.success) {
        setKategoriler((kategoriRes.value.data as Kategori[]) || []);
      } else {
        console.error(
          'Kategori yükleme hatası:',
          kategoriRes.status === 'rejected' ? kategoriRes.reason : 'API başarısız'
        );
        setKategoriler([]);
      }

      if (lokasyonRes.status === 'fulfilled' && lokasyonRes.value.success) {
        setLokasyonlar((lokasyonRes.value.data as Lokasyon[]) || []);
      } else {
        console.error(
          'Lokasyon yükleme hatası:',
          lokasyonRes.status === 'rejected' ? lokasyonRes.reason : 'API başarısız'
        );
        setLokasyonlar([]);
      }

      if (projelerRes.status === 'fulfilled' && projelerRes.value.success) {
        setProjeler(projelerRes.value.data || []);
      } else {
        console.error(
          'Proje yükleme hatası:',
          projelerRes.status === 'rejected' ? projelerRes.reason : 'API başarısız'
        );
        setProjeler([]);
      }

      if (personelRes.status === 'fulfilled' && personelRes.value.success) {
        setPersoneller((personelRes.value.data as unknown as Personel[]) || []);
      } else {
        // Daha detaylı hata mesajı
        const errorMessage =
          personelRes.status === 'rejected'
            ? personelRes.reason?.message || personelRes.reason || 'Bilinmeyen hata'
            : personelRes.value?.error || personelRes.value?.message || 'API başarısız';
        console.error('Personel yükleme hatası:', {
          status: personelRes.status,
          error: errorMessage,
          response: personelRes.status === 'fulfilled' ? personelRes.value : null,
        });
        setPersoneller([]);
        // Sessiz hata - kullanıcıya bildirim gösterme (diğer veriler yüklenebilir)
      }

      if (
        istatistikRes.status === 'fulfilled' &&
        istatistikRes.value.success &&
        istatistikRes.value.data
      ) {
        setIstatistik(istatistikRes.value.data.ozet);
        setKategoriDagilimi(istatistikRes.value.data.kategoriDagilimi || []);
        setGarantiYaklasan((istatistikRes.value.data.garantiYaklasan || []) as GarantiItem[]);
        setBakimdakiler((istatistikRes.value.data.bakimdakiler || []) as BakimItem[]);
      } else {
        console.error(
          'İstatistik yükleme hatası:',
          istatistikRes.status === 'rejected' ? istatistikRes.reason : 'API başarısız'
        );
        setIstatistik(null);
        setKategoriDagilimi([]);
        setGarantiYaklasan([]);
        setBakimdakiler([]);
      }
    } catch (err: unknown) {
      console.error('Veri yükleme hatası:', err);
      const axiosErr = err as { response?: { status?: number }; message?: string };
      const errorMessage =
        axiosErr?.response?.status === 401
          ? 'Oturum süresi doldu. Lütfen tekrar giriş yapın.'
          : axiosErr?.message || 'Veriler yüklenirken hata oluştu';
      setError(errorMessage);

      // Hata durumunda state'leri boş array olarak set et
      setDemirbaslar([]);
      setKategoriler([]);
      setLokasyonlar([]);
      setProjeler([]);
      setPersoneller([]);
      setIstatistik(null);
      setKategoriDagilimi([]);
      setGarantiYaklasan([]);
      setBakimdakiler([]);

      // 401 hatası ise login sayfasına yönlendir
      if (axiosErr?.response?.status === 401) {
        setTimeout(() => {
          window.location.href = '/giris';
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  }, []); // Boş dependency array - sadece mount'ta çalışsın

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    loadData();
  }, [loadData, authLoading, isAuthenticated]);

  // 🔴 REALTIME - Demirbaş tablosunu dinle
  useRealtimeRefetch('demirbas', loadData);

  // Ana kategorileri filtrele (ust_kategori_id null olanlar)
  const anaKategoriler = kategoriler.filter((k) => !k.ust_kategori_id);

  // Filtreleme
  const filteredDemirbaslar = demirbaslar.filter((item) => {
    const matchesTab =
      activeTab === 'tumu' ||
      (activeTab === 'bakimda' && item.durum === 'bakimda') ||
      (activeTab === 'zimmetli' && item.zimmetli_personel_id);

    const matchesKategori = !selectedKategori || item.kategori_id?.toString() === selectedKategori;

    const matchesLokasyon = !selectedLokasyonFilter || item.lokasyon_id === selectedLokasyonFilter;

    const matchesProje = !selectedProjeFilter || item.proje_id === selectedProjeFilter;

    const matchesSearch =
      !searchTerm ||
      item.kod?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.marka?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.seri_no?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTab && matchesKategori && matchesLokasyon && matchesProje && matchesSearch;
  });

  // Kategori kartına tıklandığında
  const handleKategoriSelect = (kategori: Kategori) => {
    if (kategori.kod === 'ARAC') {
      // Araç için özel modal aç
      openAracModal();
    } else {
      setSelectedKategoriForForm(kategori);
      setDemirbasForm({ ...demirbasForm, kategori_id: kategori.id.toString() });
      setEnvanterStep(2);
    }
  };

  // Yeni demirbaş ekle
  const handleSaveDemirbas = async () => {
    if (!demirbasForm.ad || !demirbasForm.kategori_id || !demirbasForm.alis_tarihi) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen zorunlu alanları doldurun',
        color: 'yellow',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await demirbasAPI.createDemirbas({
        ...demirbasForm,
        kategori_id: parseInt(demirbasForm.kategori_id, 10),
        lokasyon_id: demirbasForm.lokasyon_id ? parseInt(demirbasForm.lokasyon_id, 10) : null,
        proje_id: demirbasForm.proje_id ? parseInt(demirbasForm.proje_id, 10) : null,
        alis_tarihi: demirbasForm.alis_tarihi?.toISOString().split('T')[0],
      } as Record<string, unknown>);

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Envanter eklendi',
          color: 'green',
          icon: <IconCheck />,
        });
        closeDemirbasModal();
        resetDemirbasForm();
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Araç kaydet
  const handleSaveArac = async () => {
    if (!aracForm.ad || !aracForm.plaka || !aracForm.alis_tarihi) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen zorunlu alanları doldurun (Ad, Plaka, Alış Tarihi)',
        color: 'yellow',
      });
      return;
    }

    // Araç kategorisini bul
    const aracKategori = kategoriler.find((k) => k.kod === 'ARAC');
    if (!aracKategori) {
      notifications.show({
        title: 'Hata',
        message: 'Araç kategorisi bulunamadı',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      // Teknik özellikler JSON olarak kaydet
      const teknikOzellik = JSON.stringify({
        plaka: aracForm.plaka,
        yil: aracForm.yil,
        sasi_no: aracForm.sasi_no,
        motor_no: aracForm.motor_no,
        renk: aracForm.renk,
        yakit_tipi: aracForm.yakit_tipi,
        km: aracForm.km,
        muayene_tarihi: aracForm.muayene_tarihi?.toISOString().split('T')[0],
        sigorta_bitis: aracForm.sigorta_bitis?.toISOString().split('T')[0],
        kasko_bitis: aracForm.kasko_bitis?.toISOString().split('T')[0],
      });

      const result = await demirbasAPI.createDemirbas({
        ad: aracForm.ad,
        kategori_id: aracKategori.id,
        marka: aracForm.marka,
        model: aracForm.model,
        seri_no: aracForm.plaka, // Plaka seri no olarak
        alis_tarihi: aracForm.alis_tarihi?.toISOString().split('T')[0],
        alis_fiyati: aracForm.alis_fiyati,
        lokasyon_id: aracForm.lokasyon_id ? parseInt(aracForm.lokasyon_id, 10) : null,
        aciklama: aracForm.aciklama,
        teknik_ozellik: teknikOzellik,
      } as Record<string, unknown>);

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: 'Araç eklendi',
          color: 'green',
          icon: <IconCheck />,
        });
        closeAracModal();
        resetAracForm();
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetDemirbasForm = () => {
    setDemirbasForm({
      ad: '',
      kategori_id: '',
      marka: '',
      model: '',
      seri_no: '',
      alis_tarihi: null,
      alis_fiyati: 0,
      garanti_suresi: 24,
      lokasyon_id: '',
      lokasyon_detay: '',
      proje_id: '',
      aciklama: '',
    });
    setSelectedKategoriForForm(null);
    setEnvanterStep(1);
  };

  const resetAracForm = () => {
    setAracForm({
      ad: '',
      plaka: '',
      marka: '',
      model: '',
      yil: new Date().getFullYear(),
      sasi_no: '',
      motor_no: '',
      renk: '',
      yakit_tipi: 'dizel',
      alis_tarihi: null,
      alis_fiyati: 0,
      km: 0,
      muayene_tarihi: null,
      sigorta_bitis: null,
      kasko_bitis: null,
      lokasyon_id: '',
      aciklama: '',
    });
  };

  // Zimmet ver
  const handleZimmetVer = async () => {
    if (!selectedDemirbas || !zimmetForm.personel_id) {
      notifications.show({ title: 'Uyarı', message: 'Lütfen personel seçin', color: 'yellow' });
      return;
    }

    setLoading(true);
    try {
      const result = await demirbasAPI.zimmetAta(selectedDemirbas.id, {
        personel_id: parseInt(zimmetForm.personel_id, 10),
        tarih: zimmetForm.tarih?.toISOString().split('T')[0],
        aciklama: zimmetForm.notlar,
      });

      if (result.success) {
        notifications.show({ title: 'Başarılı', message: 'Zimmet verildi', color: 'green' });
        closeZimmetModal();
        setZimmetForm({ personel_id: '', tarih: new Date(), notlar: '' });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Zimmet iade
  const handleZimmetIade = async (demirbasId: number) => {
    if (!confirm('Zimmet iade alınacak, onaylıyor musunuz?')) return;

    setLoading(true);
    try {
      const result = await demirbasAPI.zimmetIade(demirbasId, {
        tarih: new Date().toISOString().split('T')[0],
      });

      if (result.success) {
        notifications.show({ title: 'Başarılı', message: 'Zimmet iade alındı', color: 'green' });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Bakıma gönder
  const handleBakimaGonder = async () => {
    if (!selectedDemirbas || !bakimForm.bakim_nedeni) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen bakım nedenini girin',
        color: 'yellow',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await demirbasAPI.bakimEkle(selectedDemirbas.id, {
        tarih: new Date().toISOString().split('T')[0],
        aciklama: bakimForm.bakim_nedeni,
        maliyet: bakimForm.tahmini_maliyet,
        sonraki_bakim: bakimForm.tahmini_donus?.toISOString().split('T')[0],
      });

      if (result.success) {
        notifications.show({ title: 'Başarılı', message: 'Bakıma gönderildi', color: 'green' });
        closeBakimModal();
        setBakimForm({
          bakim_tipi: 'ariza',
          bakim_nedeni: '',
          servis_firma: '',
          tahmini_donus: null,
          tahmini_maliyet: 0,
          garanti_kapsaminda: false,
        });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Transfer
  const handleTransfer = async () => {
    if (!selectedDemirbas || !transferForm.lokasyon_id) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen hedef lokasyonu seçin',
        color: 'yellow',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await demirbasAPI.transfer(selectedDemirbas.id, {
        hedef_lokasyon_id: parseInt(transferForm.lokasyon_id, 10),
        aciklama: transferForm.aciklama,
      });

      if (result.success) {
        notifications.show({ title: 'Başarılı', message: 'Transfer yapıldı', color: 'green' });
        closeTransferModal();
        setTransferForm({ lokasyon_id: '', lokasyon_detay: '', aciklama: '' });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Sil
  const handleDelete = async (demirbasId: number) => {
    if (!confirm('Bu envanteri silmek istediğinizden emin misiniz?')) return;

    setLoading(true);
    try {
      const result = await demirbasAPI.deleteDemirbas(demirbasId);
      if (result.success) {
        notifications.show({ title: 'Başarılı', message: 'Envanter silindi', color: 'green' });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Toplu sil
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`${selectedItems.length} envanteri silmek istediğinizden emin misiniz?`)) return;

    setLoading(true);
    try {
      const result = await demirbasAPI.deleteToplu(selectedItems);
      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: result.message || 'Silindi',
          color: 'green',
        });
        setSelectedItems([]);
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // ========== LOKASYON YÖNETİMİ ==========
  const resetLokasyonForm = () => {
    setLokasyonForm({ ad: '', kod: '', tip: 'depo', adres: '', aciklama: '' });
    setEditingLokasyon(null);
  };

  const handleEditLokasyon = (lokasyon: Lokasyon) => {
    setEditingLokasyon(lokasyon);
    setLokasyonForm({
      ad: lokasyon.ad || '',
      kod: lokasyon.kod || '',
      tip: lokasyon.tip || 'depo',
      adres: (lokasyon as Lokasyon & { adres?: string }).adres || '',
      aciklama: (lokasyon as Lokasyon & { aciklama?: string }).aciklama || '',
    });
    openLokasyonModal();
  };

  const handleSaveLokasyon = async () => {
    if (!lokasyonForm.ad.trim()) {
      notifications.show({ title: 'Hata', message: 'Lokasyon adı zorunludur', color: 'red' });
      return;
    }

    setLoading(true);
    try {
      const result = editingLokasyon
        ? await demirbasAPI.updateLokasyon(
            editingLokasyon.id,
            lokasyonForm as Record<string, unknown>
          )
        : await demirbasAPI.createLokasyon(lokasyonForm as Record<string, unknown>);

      if (result.success) {
        notifications.show({
          title: 'Başarılı',
          message: editingLokasyon ? 'Lokasyon güncellendi' : 'Lokasyon eklendi',
          color: 'green',
        });
        closeLokasyonModal();
        resetLokasyonForm();
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLokasyon = async (lokasyonId: number) => {
    if (!confirm('Bu lokasyonu silmek istediğinizden emin misiniz?')) return;

    setLoading(true);
    try {
      const result = await demirbasAPI.deleteLokasyon(lokasyonId);
      if (result.success) {
        notifications.show({ title: 'Başarılı', message: 'Lokasyon silindi', color: 'green' });
        loadData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Bilinmeyen hata',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Detay görüntüle
  const handleShowDetay = async (demirbasId: number) => {
    setLoading(true);
    try {
      const result = await demirbasAPI.getDemirbas(demirbasId);
      if (result.success) {
        setDetayData(result.data as DemirbasDetay);
        openDetayModal();
      }
    } catch (err) {
      console.error('Detay yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  // Seçim işlemleri
  const handleSelectAll = () => {
    if (selectedItems.length === filteredDemirbaslar.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredDemirbaslar.map((d) => d.id));
    }
  };

  const handleSelectItem = (id: number) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter((i) => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  // Durum badge rengi
  const getDurumColor = (durum: string) => {
    switch (durum) {
      case 'aktif':
        return 'green';
      case 'bakimda':
        return 'yellow';
      case 'arizali':
        return 'red';
      case 'hurda':
        return 'gray';
      case 'satildi':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Garanti badge rengi
  const getGarantiColor = (durum: string) => {
    switch (durum) {
      case 'gecerli':
        return 'green';
      case 'yaklasiyor':
        return 'yellow';
      case 'bitti':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Container fluid>
      <LoadingOverlay visible={loading} />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group gap="md">
          <ThemeIcon
            size={42}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet' }}
          >
            <IconBuilding size={24} />
          </ThemeIcon>
          <Box>
            <Title order={3}>Envanter Yönetimi</Title>
            <Text size="xs" c="dimmed">
              Şirket varlıklarınızı takip edin
            </Text>
          </Box>
        </Group>
        <Group gap="xs">
          <Tooltip label="Raporlar">
            <ActionIcon
              variant="light"
              color="indigo"
              size="lg"
              radius="xl"
              onClick={() => setRaporMerkeziOpen(true)}
            >
              <IconClipboardList size={18} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon variant="light" size="lg" radius="xl" onClick={loadData} title="Yenile">
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {/* İstatistik Kartları */}
      {istatistik && (
        <Paper
          p="md"
          radius="lg"
          mb="lg"
          style={{
            background:
              'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
            border: '1px solid var(--mantine-color-gray-2)',
          }}
        >
          <SimpleGrid cols={{ base: 2, sm: 4, md: 5 }} spacing="md">
            <Box ta="center" py="xs">
              <Text size="2rem" fw={800} c="indigo">
                {istatistik.toplam_demirbas}
              </Text>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">
                Toplam Varlık
              </Text>
            </Box>
            <Box
              ta="center"
              py="xs"
              style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Text size="2rem" fw={800} c="teal">
                {formatMoney(Number(istatistik.toplam_net_deger))}
              </Text>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">
                Net Değer
              </Text>
            </Box>
            <Box
              ta="center"
              py="xs"
              style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Text size="2rem" fw={800} c="blue">
                {istatistik.zimmetli}
              </Text>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">
                Zimmetli
              </Text>
            </Box>
            <Box
              ta="center"
              py="xs"
              style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Text size="2rem" fw={800} c="yellow">
                {istatistik.bakimda}
              </Text>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">
                Bakımda
              </Text>
            </Box>
            <Box
              ta="center"
              py="xs"
              style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Text size="2rem" fw={800} c="orange">
                {formatMoney(Number(istatistik.toplam_amortisman))}
              </Text>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">
                Birikmiş Amor.
              </Text>
            </Box>
          </SimpleGrid>
        </Paper>
      )}

      {/* Kategori Filtreleri - Kompakt Butonlar */}
      {/* Kategori Filtreleri - Gizli (gerekirse açılabilir) */}
      {/* 
      <Paper p="xs" radius="md" withBorder mb="sm" bg="gray.0">
        <Group gap={6} wrap="wrap">
          <Button
            size="xs"
            radius="xl"
            variant={!selectedKategori ? 'filled' : 'light'}
            color="indigo"
            onClick={() => setSelectedKategori(null)}
            leftSection={<IconPackage size={14} />}
            styles={{ root: { fontWeight: 500, textTransform: 'none' } }}
          >
            Tümü ({demirbaslar.length})
          </Button>

          {kategoriDagilimi.map((kat) => {
            const isSelected = selectedKategori === kat.id?.toString();
            return (
              <Button
                key={kat.id}
                size="xs"
                radius="xl"
                variant={isSelected ? 'filled' : 'light'}
                color={isSelected ? undefined : 'gray'}
                onClick={() => setSelectedKategori(kat.id?.toString())}
                leftSection={<span style={{ fontSize: '13px' }}>{kat.ikon}</span>}
                styles={{ 
                  root: { 
                    fontWeight: 500, 
                    textTransform: 'none',
                    backgroundColor: isSelected ? kat.renk : undefined,
                    borderColor: isSelected ? kat.renk : undefined
                  } 
                }}
              >
                {kat.ad} ({kat.toplam_adet || 0})
              </Button>
            );
          })}
        </Group>
      </Paper>
      */}

      {/* Lokasyon & Proje Yönetimi - Yan Yana */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="md">
        {/* Lokasyonlar */}
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{ background: 'linear-gradient(135deg, #fff8f0 0%, #fff 100%)' }}
        >
          <Text size="sm" fw={600} c="orange.7" mb="sm">
            📍 Lokasyonlar
          </Text>

          {lokasyonlar.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              Henüz lokasyon yok
            </Text>
          ) : (
            <Stack gap="xs" mb="sm">
              {lokasyonlar.slice(0, 5).map((lok) => (
                <Group
                  key={lok.id}
                  justify="space-between"
                  p="xs"
                  style={{
                    background: selectedLokasyonFilter === lok.id ? '#fed7aa' : '#fafafa',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border:
                      selectedLokasyonFilter === lok.id
                        ? '2px solid #f97316'
                        : '2px solid transparent',
                  }}
                  onClick={() => {
                    if (selectedLokasyonFilter === lok.id) {
                      setSelectedLokasyonFilter(null);
                    } else {
                      setSelectedLokasyonFilter(lok.id);
                      setSelectedProjeFilter(null); // Proje filtresini temizle
                    }
                  }}
                >
                  <Group gap="xs">
                    <Text size="md">
                      {lok.tip === 'sube'
                        ? '🏢'
                        : lok.tip === 'depo'
                          ? '📦'
                          : lok.tip === 'ofis'
                            ? '🏠'
                            : '📍'}
                    </Text>
                    <Text size="sm" fw={500}>
                      {lok.ad}
                    </Text>
                    <Badge size="xs" variant="light" color="orange">
                      {lok.demirbas_sayisi || 0}
                    </Badge>
                  </Group>
                  <Menu shadow="md" width={100} position="bottom-end">
                    <Menu.Target>
                      <ActionIcon size="xs" variant="subtle" onClick={(e) => e.stopPropagation()}>
                        <IconDotsVertical size={14} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleEditLokasyon(lok)}
                      >
                        Düzenle
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => handleDeleteLokasyon(lok.id)}
                      >
                        Sil
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              ))}
              {lokasyonlar.length > 5 && (
                <Text size="xs" c="dimmed" ta="center">
                  +{lokasyonlar.length - 5} daha...
                </Text>
              )}
            </Stack>
          )}

          <Button
            size="xs"
            variant="light"
            color="orange"
            fullWidth
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              resetLokasyonForm();
              openLokasyonModal();
            }}
          >
            Yeni Lokasyon
          </Button>
        </Paper>

        {/* Projeler */}
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #fff 100%)' }}
        >
          <Text size="sm" fw={600} c="blue.7" mb="sm">
            📁 Projeler
          </Text>

          {projeler.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              Henüz proje yok
            </Text>
          ) : (
            <Stack gap="xs" mb="sm">
              {projeler.slice(0, 5).map((proje) => (
                <Group
                  key={proje.id}
                  justify="space-between"
                  p="xs"
                  style={{
                    background: selectedProjeFilter === proje.id ? '#bfdbfe' : '#f8faff',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border:
                      selectedProjeFilter === proje.id
                        ? '2px solid #3b82f6'
                        : '2px solid transparent',
                  }}
                  onClick={() => {
                    if (selectedProjeFilter === proje.id) {
                      setSelectedProjeFilter(null);
                    } else {
                      setSelectedProjeFilter(proje.id);
                      setSelectedLokasyonFilter(null); // Lokasyon filtresini temizle
                    }
                  }}
                >
                  <Group gap="xs">
                    <Text size="md">📁</Text>
                    <Text size="sm" fw={500}>
                      {proje.ad}
                    </Text>
                  </Group>
                  <Badge size="xs" variant="light" color="blue">
                    {demirbaslar.filter((d) => d.proje_id === proje.id).length} varlık
                  </Badge>
                </Group>
              ))}
              {projeler.length > 5 && (
                <Text size="xs" c="dimmed" ta="center">
                  +{projeler.length - 5} daha...
                </Text>
              )}
            </Stack>
          )}

          {projeler.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" fs="italic">
              Projeler merkezi sistemden yüklenir
            </Text>
          )}
        </Paper>
      </SimpleGrid>

      {/* Ana İçerik */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Group justify="space-between" align="flex-end">
            <Tabs.List>
              <Tabs.Tab value="tumu">Tümü ({demirbaslar.length})</Tabs.Tab>
              <Tabs.Tab value="zimmetli" color="blue">
                Zimmetli ({demirbaslar.filter((d) => d.zimmetli_personel_id).length})
              </Tabs.Tab>
              <Tabs.Tab value="bakimda" color="yellow">
                Bakımda ({demirbaslar.filter((d) => d.durum === 'bakimda').length})
              </Tabs.Tab>
            </Tabs.List>

            <Menu shadow="md" width={220}>
              <Menu.Target>
                <Button
                  variant="filled"
                  color="indigo"
                  size="sm"
                  radius="xl"
                  leftSection={<IconPlus size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                >
                  Yeni Ekle
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Envanter Türü Seçin</Menu.Label>
                <Menu.Item leftSection={<IconPackage size={16} />} onClick={openDemirbasModal}>
                  Genel Envanter
                </Menu.Item>
                <Menu.Item leftSection={<IconCar size={16} />} onClick={openAracModal}>
                  Araç Ekle
                </Menu.Item>
                <Menu.Divider />
                <Menu.Label>Toplu İşlemler</Menu.Label>
                <Menu.Item
                  leftSection={<IconTrash size={16} color="red" />}
                  onClick={handleBulkDelete}
                  disabled={selectedItems.length === 0}
                >
                  Seçilenleri Sil ({selectedItems.length})
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          {/* Aktif Filtreler */}
          {(selectedLokasyonFilter || selectedProjeFilter) && (
            <Box mt="md" mb="sm">
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  Filtreler:
                </Text>
                {selectedLokasyonFilter && (
                  <Badge
                    variant="filled"
                    color="orange"
                    rightSection={
                      <ActionIcon
                        size="xs"
                        variant="transparent"
                        c="white"
                        onClick={() => setSelectedLokasyonFilter(null)}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    }
                  >
                    📍 {lokasyonlar.find((l) => l.id === selectedLokasyonFilter)?.ad}
                  </Badge>
                )}
                {selectedProjeFilter && (
                  <Badge
                    variant="filled"
                    color="blue"
                    rightSection={
                      <ActionIcon
                        size="xs"
                        variant="transparent"
                        c="white"
                        onClick={() => setSelectedProjeFilter(null)}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    }
                  >
                    📁 {projeler.find((p) => p.id === selectedProjeFilter)?.ad}
                  </Badge>
                )}
                <Button
                  variant="subtle"
                  size="xs"
                  color="gray"
                  onClick={() => {
                    setSelectedLokasyonFilter(null);
                    setSelectedProjeFilter(null);
                  }}
                >
                  Tümünü Temizle
                </Button>
              </Group>
            </Box>
          )}

          <Box mt="md">
            <TextInput
              placeholder="Kod, ad, marka, model veya seri no ile ara..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              mb="md"
            />

            {/* Toplu İşlem Çubuğu */}
            {selectedItems.length > 0 && (
              <Paper p="xs" mb="sm" withBorder radius="md" bg="indigo.0">
                <Group justify="space-between">
                  <Text size="sm" fw={500} c="indigo.7">
                    {selectedItems.length} envanter seçildi
                  </Text>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      color="gray"
                      onClick={() => setSelectedItems([])}
                    >
                      Seçimi Kaldır
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={handleBulkDelete}
                    >
                      Toplu Sil
                    </Button>
                  </Group>
                </Group>
              </Paper>
            )}

            <Table.ScrollContainer minWidth={1000}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40}>
                      <Checkbox
                        checked={
                          selectedItems.length === filteredDemirbaslar.length &&
                          filteredDemirbaslar.length > 0
                        }
                        indeterminate={
                          selectedItems.length > 0 &&
                          selectedItems.length < filteredDemirbaslar.length
                        }
                        onChange={handleSelectAll}
                      />
                    </Table.Th>
                    <Table.Th>Kod</Table.Th>
                    <Table.Th>Envanter</Table.Th>
                    <Table.Th>Kategori</Table.Th>
                    <Table.Th>Lokasyon</Table.Th>
                    <Table.Th>Zimmetli</Table.Th>
                    <Table.Th>Değer</Table.Th>
                    <Table.Th>Garanti</Table.Th>
                    <Table.Th>Durum</Table.Th>
                    <Table.Th w={120}>İşlemler</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredDemirbaslar.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={10}>
                        <Text ta="center" c="dimmed" py="xl">
                          {searchTerm
                            ? 'Aramanıza uygun envanter bulunamadı'
                            : 'Henüz envanter kaydı yok'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    filteredDemirbaslar.map((item) => (
                      <Table.Tr
                        key={item.id}
                        bg={selectedItems.includes(item.id) ? 'indigo.0' : undefined}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleShowDetay(item.id)}
                      >
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleSelectItem(item.id)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="indigo">
                            {item.kod}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm" fw={500}>
                              {item.ad}
                            </Text>
                            {(item.marka || item.model) && (
                              <Text size="xs" c="dimmed">
                                {[item.marka, item.model].filter(Boolean).join(' ')}
                              </Text>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light"
                            leftSection={<Text size="sm">{item.kategori_ikon}</Text>}
                            style={{
                              backgroundColor: `${item.kategori_renk}20`,
                              color: item.kategori_renk,
                            }}
                          >
                            {item.kategori_ad}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <IconMapPin size={14} color="gray" />
                            <Text size="sm">{item.lokasyon_ad || '-'}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {item.zimmetli_personel ? (
                            <Group gap="xs">
                              <IconUser size={14} color="blue" />
                              <Stack gap={0}>
                                <Text size="sm">{item.zimmetli_personel}</Text>
                                <Text size="xs" c="dimmed">
                                  {item.zimmetli_departman}
                                </Text>
                              </Stack>
                            </Group>
                          ) : (
                            <Text size="sm" c="dimmed">
                              -
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={0}>
                            <Text size="sm" fw={500}>
                              {formatMoney(Number(item.net_defter_degeri))}
                            </Text>
                            <Text size="xs" c="dimmed">
                              Alış: {formatMoney(Number(item.alis_fiyati))}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getGarantiColor(item.garanti_durumu)} variant="light">
                            {item.garanti_bitis ? formatDate(item.garanti_bitis) : 'Belirsiz'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getDurumColor(item.durum)} variant="filled">
                            {item.durum?.toUpperCase()}
                          </Badge>
                        </Table.Td>
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <Group gap={4}>
                            {!item.zimmetli_personel_id ? (
                              <Tooltip label="Zimmet Ver">
                                <ActionIcon
                                  variant="subtle"
                                  color="blue"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDemirbas(item);
                                    openZimmetModal();
                                  }}
                                >
                                  <IconUser size={16} />
                                </ActionIcon>
                              </Tooltip>
                            ) : (
                              <Tooltip label="Zimmet İade">
                                <ActionIcon
                                  variant="subtle"
                                  color="orange"
                                  size="sm"
                                  onClick={() => handleZimmetIade(item.id)}
                                >
                                  <IconReceipt size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                            <Tooltip label="Transfer">
                              <ActionIcon
                                variant="subtle"
                                color="teal"
                                size="sm"
                                onClick={() => {
                                  setSelectedDemirbas(item);
                                  openTransferModal();
                                }}
                              >
                                <IconArrowsExchange size={16} />
                              </ActionIcon>
                            </Tooltip>
                            {item.durum !== 'bakimda' && (
                              <Tooltip label="Bakıma Gönder">
                                <ActionIcon
                                  variant="subtle"
                                  color="yellow"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDemirbas(item);
                                    openBakimModal();
                                  }}
                                >
                                  <IconTool size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                            <Tooltip label="Sil">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Box>
        </Tabs>
      </Card>

      {/* Uyarı Kartları */}
      <SimpleGrid cols={{ base: 1, md: 2 }} mt="lg">
        {garantiYaklasan.length > 0 && (
          <Card withBorder radius="md" p="md">
            <Group mb="md">
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconAlertTriangle size={20} />
              </ThemeIcon>
              <Text fw={600}>Garantisi Yaklaşan</Text>
            </Group>
            <Stack gap="xs">
              {garantiYaklasan.map((item) => (
                <Paper key={item.id} withBorder p="sm" radius="md">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>
                        {item.ad}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.marka} {item.model}
                      </Text>
                    </div>
                    <Badge color="yellow" variant="light">
                      {item.kalan_gun} gün
                    </Badge>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Card>
        )}

        {bakimdakiler.length > 0 && (
          <Card withBorder radius="md" p="md">
            <Group mb="md">
              <ThemeIcon color="orange" variant="light" size="lg">
                <IconTool size={20} />
              </ThemeIcon>
              <Text fw={600}>Bakımda Olanlar</Text>
            </Group>
            <Stack gap="xs">
              {bakimdakiler.map((item) => (
                <Paper key={item.id} withBorder p="sm" radius="md">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>
                        {item.ad}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.servis_firma}
                      </Text>
                    </div>
                    <Badge color="orange" variant="light">
                      {item.gecen_gun} gündür
                    </Badge>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Card>
        )}
      </SimpleGrid>

      {/* ========== MODAL'LAR ========== */}

      {/* Genel Envanter Modal - Yatay Kategori Kartları */}
      <Modal
        opened={demirbasModalOpened}
        onClose={() => {
          closeDemirbasModal();
          resetDemirbasForm();
        }}
        title={
          <Group gap="xs">
            <IconPlus size={20} />
            <Text fw={600}>Yeni Envanter Ekle</Text>
          </Group>
        }
        size="xl"
      >
        {envanterStep === 1 ? (
          // Adım 1: Kategori Seçimi - Yatay Kartlar
          <Box>
            <Text size="sm" c="dimmed" mb="md">
              Eklemek istediğiniz envanter türünü seçin:
            </Text>
            {anaKategoriler.length === 0 ? (
              <Alert color="yellow">Kategoriler yükleniyor...</Alert>
            ) : (
              <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
                {anaKategoriler
                  .filter((k) => k.kod !== 'ARAC')
                  .map((kat) => (
                    <Paper
                      key={kat.id}
                      withBorder
                      p="md"
                      radius="md"
                      onClick={() => handleKategoriSelect(kat)}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                        border: `2px solid ${kat.renk}30`,
                        background: `linear-gradient(135deg, ${kat.renk}08 0%, ${kat.renk}15 100%)`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = `0 8px 25px ${kat.renk}40`;
                        e.currentTarget.style.borderColor = kat.renk;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = `${kat.renk}30`;
                      }}
                    >
                      <Text size="2.5rem" mb="xs">
                        {kat.ikon}
                      </Text>
                      <Text size="sm" fw={600} c={kat.renk}>
                        {kat.ad}
                      </Text>
                    </Paper>
                  ))}
              </SimpleGrid>
            )}
          </Box>
        ) : (
          // Adım 2: Form
          <Box>
            <Group mb="md">
              <Button variant="light" size="xs" onClick={() => setEnvanterStep(1)}>
                ← Geri
              </Button>
              {selectedKategoriForForm && (
                <Badge
                  size="lg"
                  style={{
                    backgroundColor: `${selectedKategoriForForm.renk}20`,
                    color: selectedKategoriForForm.renk,
                  }}
                >
                  {selectedKategoriForForm.ikon} {selectedKategoriForForm.ad}
                </Badge>
              )}
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="Envanter Adı"
                placeholder="Örn: MacBook Pro 16"
                value={demirbasForm.ad}
                onChange={(e) => setDemirbasForm({ ...demirbasForm, ad: e.target.value })}
                required
              />
              <StyledDatePicker
                label="Alış Tarihi"
                placeholder="Seçin"
                value={demirbasForm.alis_tarihi}
                onChange={(val) => setDemirbasForm({ ...demirbasForm, alis_tarihi: val })}
                required
              />
              <TextInput
                label="Marka"
                placeholder="Örn: Apple"
                value={demirbasForm.marka}
                onChange={(e) => setDemirbasForm({ ...demirbasForm, marka: e.target.value })}
              />
              <TextInput
                label="Model"
                placeholder="Örn: M3 Pro"
                value={demirbasForm.model}
                onChange={(e) => setDemirbasForm({ ...demirbasForm, model: e.target.value })}
              />
              <TextInput
                label="Seri No"
                placeholder="Cihaz seri numarası"
                value={demirbasForm.seri_no}
                onChange={(e) => setDemirbasForm({ ...demirbasForm, seri_no: e.target.value })}
              />
              <NumberInput
                label="Alış Fiyatı (₺)"
                placeholder="0"
                value={demirbasForm.alis_fiyati}
                onChange={(val) =>
                  setDemirbasForm({ ...demirbasForm, alis_fiyati: Number(val) || 0 })
                }
                min={0}
                thousandSeparator=","
              />
              <NumberInput
                label="Garanti Süresi (Ay)"
                placeholder="24"
                value={demirbasForm.garanti_suresi}
                onChange={(val) =>
                  setDemirbasForm({ ...demirbasForm, garanti_suresi: Number(val) || 0 })
                }
                min={0}
              />
              <Select
                label="Lokasyon"
                placeholder="Seçin"
                data={lokasyonlar.map((l) => ({ value: l.id.toString(), label: l.ad }))}
                value={demirbasForm.lokasyon_id}
                onChange={(val) => setDemirbasForm({ ...demirbasForm, lokasyon_id: val || '' })}
                searchable
              />
              <Select
                label="Proje"
                placeholder="Proje seçin (opsiyonel)"
                data={projeler.map((p) => ({ value: p.id.toString(), label: p.ad }))}
                value={demirbasForm.proje_id}
                onChange={(val) => setDemirbasForm({ ...demirbasForm, proje_id: val || '' })}
                searchable
                clearable
              />
              <TextInput
                label="Lokasyon Detay"
                placeholder="Oda no, kat vb."
                value={demirbasForm.lokasyon_detay}
                onChange={(e) =>
                  setDemirbasForm({ ...demirbasForm, lokasyon_detay: e.target.value })
                }
              />
              <Textarea
                label="Açıklama"
                placeholder="Ek notlar..."
                value={demirbasForm.aciklama}
                onChange={(e) => setDemirbasForm({ ...demirbasForm, aciklama: e.target.value })}
              />
            </SimpleGrid>
            <Group justify="flex-end" mt="lg">
              <Button
                variant="light"
                onClick={() => {
                  closeDemirbasModal();
                  resetDemirbasForm();
                }}
              >
                İptal
              </Button>
              <Button onClick={handleSaveDemirbas} loading={loading}>
                Kaydet
              </Button>
            </Group>
          </Box>
        )}
      </Modal>

      {/* Araç Ekleme Modal */}
      <Modal
        opened={aracModalOpened}
        onClose={() => {
          closeAracModal();
          resetAracForm();
        }}
        title={
          <Group gap="xs">
            <IconCar size={20} />
            <Text fw={600}>Yeni Araç Ekle</Text>
          </Group>
        }
        size="xl"
      >
        <Tabs defaultValue="genel">
          <Tabs.List>
            <Tabs.Tab value="genel">Genel Bilgiler</Tabs.Tab>
            <Tabs.Tab value="teknik">Teknik Bilgiler</Tabs.Tab>
            <Tabs.Tab value="belgeler">Belge & Tarihler</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="genel" pt="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="Araç Adı"
                placeholder="Örn: Ford Transit"
                value={aracForm.ad}
                onChange={(e) => setAracForm({ ...aracForm, ad: e.target.value })}
                required
              />
              <TextInput
                label="Plaka"
                placeholder="34 ABC 123"
                value={aracForm.plaka}
                onChange={(e) => setAracForm({ ...aracForm, plaka: e.target.value.toUpperCase() })}
                required
              />
              <TextInput
                label="Marka"
                placeholder="Örn: Ford"
                value={aracForm.marka}
                onChange={(e) => setAracForm({ ...aracForm, marka: e.target.value })}
              />
              <TextInput
                label="Model"
                placeholder="Örn: Transit Custom"
                value={aracForm.model}
                onChange={(e) => setAracForm({ ...aracForm, model: e.target.value })}
              />
              <NumberInput
                label="Model Yılı"
                value={aracForm.yil}
                onChange={(val) =>
                  setAracForm({ ...aracForm, yil: Number(val) || new Date().getFullYear() })
                }
                min={1990}
                max={new Date().getFullYear() + 1}
              />
              <Select
                label="Yakıt Tipi"
                data={[
                  { value: 'benzin', label: '⛽ Benzin' },
                  { value: 'dizel', label: '🛢️ Dizel' },
                  { value: 'lpg', label: '🔵 LPG' },
                  { value: 'elektrik', label: '⚡ Elektrik' },
                  { value: 'hibrit', label: '🔋 Hibrit' },
                ]}
                value={aracForm.yakit_tipi}
                onChange={(val) => setAracForm({ ...aracForm, yakit_tipi: val || 'dizel' })}
              />
              <TextInput
                label="Renk"
                placeholder="Beyaz"
                value={aracForm.renk}
                onChange={(e) => setAracForm({ ...aracForm, renk: e.target.value })}
              />
              <Select
                label="Lokasyon"
                placeholder="Seçin"
                data={lokasyonlar.map((l) => ({ value: l.id.toString(), label: l.ad }))}
                value={aracForm.lokasyon_id}
                onChange={(val) => setAracForm({ ...aracForm, lokasyon_id: val || '' })}
                searchable
              />
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="teknik" pt="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="Şasi No"
                placeholder="VIN numarası"
                value={aracForm.sasi_no}
                onChange={(e) => setAracForm({ ...aracForm, sasi_no: e.target.value })}
              />
              <TextInput
                label="Motor No"
                placeholder="Motor numarası"
                value={aracForm.motor_no}
                onChange={(e) => setAracForm({ ...aracForm, motor_no: e.target.value })}
              />
              <NumberInput
                label="Kilometre"
                placeholder="0"
                value={aracForm.km}
                onChange={(val) => setAracForm({ ...aracForm, km: Number(val) || 0 })}
                min={0}
                thousandSeparator=","
                suffix=" km"
              />
              <NumberInput
                label="Alış Fiyatı (₺)"
                placeholder="0"
                value={aracForm.alis_fiyati}
                onChange={(val) => setAracForm({ ...aracForm, alis_fiyati: Number(val) || 0 })}
                min={0}
                thousandSeparator=","
              />
              <StyledDatePicker
                label="Alış Tarihi"
                placeholder="Seçin"
                value={aracForm.alis_tarihi}
                onChange={(val) => setAracForm({ ...aracForm, alis_tarihi: val })}
                required
              />
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="belgeler" pt="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Paper withBorder p="md" radius="md" bg="yellow.0">
                <Group mb="sm">
                  <IconShieldCheck size={20} color="orange" />
                  <Text fw={600}>Muayene</Text>
                </Group>
                <StyledDatePicker
                  label="Muayene Tarihi"
                  placeholder="Son muayene tarihi"
                  value={aracForm.muayene_tarihi}
                  onChange={(val) => setAracForm({ ...aracForm, muayene_tarihi: val })}
                />
              </Paper>

              <Paper withBorder p="md" radius="md" bg="blue.0">
                <Group mb="sm">
                  <IconShieldCheck size={20} color="blue" />
                  <Text fw={600}>Trafik Sigortası</Text>
                </Group>
                <StyledDatePicker
                  label="Sigorta Bitiş Tarihi"
                  placeholder="Bitiş tarihi"
                  value={aracForm.sigorta_bitis}
                  onChange={(val) => setAracForm({ ...aracForm, sigorta_bitis: val })}
                />
              </Paper>

              <Paper withBorder p="md" radius="md" bg="teal.0">
                <Group mb="sm">
                  <IconShieldCheck size={20} color="teal" />
                  <Text fw={600}>Kasko</Text>
                </Group>
                <StyledDatePicker
                  label="Kasko Bitiş Tarihi"
                  placeholder="Bitiş tarihi"
                  value={aracForm.kasko_bitis}
                  onChange={(val) => setAracForm({ ...aracForm, kasko_bitis: val })}
                />
              </Paper>
            </SimpleGrid>

            <Textarea
              label="Açıklama"
              placeholder="Araç hakkında ek notlar..."
              value={aracForm.aciklama}
              onChange={(e) => setAracForm({ ...aracForm, aciklama: e.target.value })}
              mt="md"
            />
          </Tabs.Panel>
        </Tabs>

        <Group justify="flex-end" mt="xl">
          <Button
            variant="light"
            onClick={() => {
              closeAracModal();
              resetAracForm();
            }}
          >
            İptal
          </Button>
          <Button
            color="pink"
            onClick={handleSaveArac}
            loading={loading}
            leftSection={<IconCar size={16} />}
          >
            Araç Kaydet
          </Button>
        </Group>
      </Modal>

      {/* Zimmet Modal */}
      <Modal
        opened={zimmetModalOpened}
        onClose={closeZimmetModal}
        title={
          <Group gap="xs">
            <IconUser size={20} />
            <Text fw={600}>Zimmet Ver</Text>
          </Group>
        }
        size="md"
      >
        {selectedDemirbas && (
          <Alert color="blue" variant="light" mb="md">
            <Text size="sm">
              {selectedDemirbas.kod} - {selectedDemirbas.ad}
            </Text>
          </Alert>
        )}
        <Stack gap="md">
          <Select
            label="Personel"
            placeholder="Seçin"
            searchable
            data={personeller.map((p) => ({
              value: p.id.toString(),
              label: `${p.ad} ${p.soyad} - ${p.departman || 'Belirtilmemiş'}`,
            }))}
            value={zimmetForm.personel_id}
            onChange={(val) => setZimmetForm({ ...zimmetForm, personel_id: val || '' })}
            required
          />
          <StyledDatePicker
            label="Zimmet Tarihi"
            value={zimmetForm.tarih}
            onChange={(val) => setZimmetForm({ ...zimmetForm, tarih: val || new Date() })}
          />
          <Textarea
            label="Notlar"
            placeholder="Zimmet ile ilgili notlar..."
            value={zimmetForm.notlar}
            onChange={(e) => setZimmetForm({ ...zimmetForm, notlar: e.target.value })}
          />
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button variant="light" onClick={closeZimmetModal}>
            İptal
          </Button>
          <Button color="blue" onClick={handleZimmetVer} loading={loading}>
            Zimmet Ver
          </Button>
        </Group>
      </Modal>

      {/* Bakım Modal */}
      <Modal
        opened={bakimModalOpened}
        onClose={closeBakimModal}
        title={
          <Group gap="xs">
            <IconTool size={20} />
            <Text fw={600}>Bakıma Gönder</Text>
          </Group>
        }
        size="md"
      >
        {selectedDemirbas && (
          <Alert color="yellow" variant="light" mb="md">
            <Text size="sm">
              {selectedDemirbas.kod} - {selectedDemirbas.ad}
            </Text>
          </Alert>
        )}
        <Stack gap="md">
          <Select
            label="Bakım Tipi"
            data={[
              { value: 'ariza', label: '🔧 Arıza/Onarım' },
              { value: 'periyodik', label: '📅 Periyodik Bakım' },
              { value: 'garanti', label: '🛡️ Garanti Kapsamında' },
              { value: 'onleyici', label: '⚠️ Önleyici Bakım' },
            ]}
            value={bakimForm.bakim_tipi}
            onChange={(val) => setBakimForm({ ...bakimForm, bakim_tipi: val || 'ariza' })}
          />
          <Textarea
            label="Bakım Nedeni"
            placeholder="Arıza veya bakım açıklaması..."
            value={bakimForm.bakim_nedeni}
            onChange={(e) => setBakimForm({ ...bakimForm, bakim_nedeni: e.target.value })}
            required
          />
          <TextInput
            label="Servis Firma"
            placeholder="Servis firması adı"
            value={bakimForm.servis_firma}
            onChange={(e) => setBakimForm({ ...bakimForm, servis_firma: e.target.value })}
          />
          <StyledDatePicker
            label="Tahmini Dönüş"
            value={bakimForm.tahmini_donus}
            onChange={(val) => setBakimForm({ ...bakimForm, tahmini_donus: val })}
          />
          <NumberInput
            label="Tahmini Maliyet (₺)"
            value={bakimForm.tahmini_maliyet}
            onChange={(val) => setBakimForm({ ...bakimForm, tahmini_maliyet: Number(val) || 0 })}
            min={0}
          />
          <Checkbox
            label="Garanti kapsamında"
            checked={bakimForm.garanti_kapsaminda}
            onChange={(e) =>
              setBakimForm({ ...bakimForm, garanti_kapsaminda: e.currentTarget.checked })
            }
          />
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button variant="light" onClick={closeBakimModal}>
            İptal
          </Button>
          <Button color="yellow" onClick={handleBakimaGonder} loading={loading}>
            Bakıma Gönder
          </Button>
        </Group>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        opened={transferModalOpened}
        onClose={closeTransferModal}
        title={
          <Group gap="xs">
            <IconArrowsExchange size={20} />
            <Text fw={600}>Lokasyon Transfer</Text>
          </Group>
        }
        size="md"
      >
        {selectedDemirbas && (
          <Alert color="teal" variant="light" mb="md">
            <Text size="sm">
              {selectedDemirbas.kod} - {selectedDemirbas.ad}
            </Text>
            <Text size="xs" c="dimmed">
              Mevcut: {selectedDemirbas.lokasyon_ad || 'Belirtilmemiş'}
            </Text>
          </Alert>
        )}
        <Stack gap="md">
          <Select
            label="Hedef Lokasyon"
            placeholder="Seçin"
            data={lokasyonlar.map((l) => ({ value: l.id.toString(), label: l.ad }))}
            value={transferForm.lokasyon_id}
            onChange={(val) => setTransferForm({ ...transferForm, lokasyon_id: val || '' })}
            required
            searchable
          />
          <TextInput
            label="Lokasyon Detay"
            placeholder="Oda no, kat vb."
            value={transferForm.lokasyon_detay}
            onChange={(e) => setTransferForm({ ...transferForm, lokasyon_detay: e.target.value })}
          />
          <Textarea
            label="Açıklama"
            placeholder="Transfer nedeni..."
            value={transferForm.aciklama}
            onChange={(e) => setTransferForm({ ...transferForm, aciklama: e.target.value })}
          />
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button variant="light" onClick={closeTransferModal}>
            İptal
          </Button>
          <Button color="teal" onClick={handleTransfer} loading={loading}>
            Transfer Yap
          </Button>
        </Group>
      </Modal>

      {/* Detay Modal */}
      <Modal
        opened={detayModalOpened}
        onClose={closeDetayModal}
        title={
          <Group gap="xs">
            <IconClipboardList size={20} />
            <Text fw={600}>Envanter Detayı</Text>
          </Group>
        }
        size="xl"
      >
        {detayData && (
          <Stack gap="md">
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Badge size="lg" variant="light" color="indigo" mb="xs">
                    {detayData.kod}
                  </Badge>
                  <Title order={4}>{detayData.ad}</Title>
                  <Text c="dimmed">
                    {[detayData.marka, detayData.model].filter(Boolean).join(' ')}
                  </Text>
                  {detayData.seri_no && <Text size="sm">Seri No: {detayData.seri_no}</Text>}
                </div>
                <Badge color={getDurumColor(detayData.durum || '')} size="lg">
                  {detayData.durum?.toUpperCase()}
                </Badge>
              </Group>
            </Paper>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm" c="dimmed">
                  💰 Mali Bilgiler
                </Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Alış Fiyatı:</Text>
                    <Text size="sm" fw={500}>
                      {formatMoney(Number(detayData.alis_fiyati))}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Birikmiş Amortisman:</Text>
                    <Text size="sm" fw={500} c="orange">
                      {formatMoney(Number(detayData.birikimis_amortisman))}
                    </Text>
                  </Group>
                  <Divider />
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>
                      Net Değer:
                    </Text>
                    <Text size="sm" fw={700} c="teal">
                      {formatMoney(Number(detayData.net_defter_degeri))}
                    </Text>
                  </Group>
                  <Progress
                    value={
                      (Number(detayData.birikimis_amortisman) / Number(detayData.alis_fiyati)) * 100
                    }
                    color="orange"
                    size="sm"
                    mt="xs"
                  />
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm" c="dimmed">
                  👤 Zimmet & Lokasyon
                </Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Zimmetli:</Text>
                    <Text size="sm" fw={500}>
                      {detayData.zimmetli_personel || '-'}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Departman:</Text>
                    <Text size="sm">{detayData.zimmetli_departman || '-'}</Text>
                  </Group>
                  <Divider />
                  <Group justify="space-between">
                    <Text size="sm">Lokasyon:</Text>
                    <Text size="sm" fw={500}>
                      {detayData.lokasyon_ad || '-'}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Detay:</Text>
                    <Text size="sm">{detayData.lokasyon_detay || '-'}</Text>
                  </Group>
                </Stack>
              </Paper>
            </SimpleGrid>

            {detayData.hareketler && detayData.hareketler.length > 0 && (
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm" c="dimmed">
                  📜 Hareket Geçmişi
                </Text>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>İşlem</Table.Th>
                      <Table.Th>Açıklama</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {detayData.hareketler.map((h) => (
                      <Table.Tr
                        key={`${h.tarih}-${h.hareket_tipi}-${h.aciklama || ''}`}
                      >
                        <Table.Td>{formatDate(h.tarih)}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm">
                            {h.hareket_tipi}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{h.aciklama || '-'}</Text>
                          {h.yeni_personel && (
                            <Text size="xs" c="dimmed">
                              → {h.yeni_personel}
                            </Text>
                          )}
                          {h.yeni_lokasyon && (
                            <Text size="xs" c="dimmed">
                              → {h.yeni_lokasyon}
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </Stack>
        )}
      </Modal>

      {/* Lokasyon Yönetimi Modal */}
      <Modal
        opened={lokasyonModalOpened}
        onClose={() => {
          closeLokasyonModal();
          resetLokasyonForm();
        }}
        title={
          <Group gap="xs">
            <IconMapPin size={20} />
            <Text fw={600}>{editingLokasyon ? 'Lokasyon Düzenle' : 'Yeni Lokasyon Ekle'}</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Lokasyon Adı"
            placeholder="örn: Ana Depo, Merkez Ofis"
            value={lokasyonForm.ad}
            onChange={(e) => setLokasyonForm({ ...lokasyonForm, ad: e.target.value })}
            required
            leftSection={<IconBuilding size={16} />}
          />
          <TextInput
            label="Kod"
            placeholder="örn: DEPO-01"
            value={lokasyonForm.kod}
            onChange={(e) =>
              setLokasyonForm({ ...lokasyonForm, kod: e.target.value.toUpperCase() })
            }
          />
          <Select
            label="Lokasyon Tipi"
            data={[
              { value: 'depo', label: '📦 Depo' },
              { value: 'sube', label: '🏢 Şube' },
              { value: 'ofis', label: '🏠 Ofis' },
              { value: 'santiye', label: '🏗️ Şantiye' },
              { value: 'diger', label: '📍 Diğer' },
            ]}
            value={lokasyonForm.tip}
            onChange={(val) => setLokasyonForm({ ...lokasyonForm, tip: val || 'depo' })}
          />
          <TextInput
            label="Adres"
            placeholder="Tam adres"
            value={lokasyonForm.adres}
            onChange={(e) => setLokasyonForm({ ...lokasyonForm, adres: e.target.value })}
          />
          <Textarea
            label="Açıklama"
            placeholder="Ek notlar..."
            value={lokasyonForm.aciklama}
            onChange={(e) => setLokasyonForm({ ...lokasyonForm, aciklama: e.target.value })}
            rows={2}
          />
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button
            variant="light"
            onClick={() => {
              closeLokasyonModal();
              resetLokasyonForm();
            }}
          >
            İptal
          </Button>
          <Button color="orange" onClick={handleSaveLokasyon} loading={loading}>
            {editingLokasyon ? 'Güncelle' : 'Kaydet'}
          </Button>
        </Group>
      </Modal>

      {/* Rapor Merkezi Modal */}
      <RaporMerkeziModal
        opened={raporMerkeziOpen}
        onClose={() => setRaporMerkeziOpen(false)}
        module="operasyon"
      />
    </Container>
  );
}
