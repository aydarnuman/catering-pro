'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Container,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Paper,
  rem,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconCheck,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFileUpload,
  IconId,
  IconMail,
  IconPhone,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUser,
  IconUserOff,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BordroImportModal } from '@/components/BordroImportModal';
import { DataActions } from '@/components/DataActions';
import StyledDatePicker from '@/components/ui/StyledDatePicker';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefetch } from '@/context/RealtimeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { personelAPI } from '@/lib/api/services/personel';
import { formatDate, formatMoney } from '@/lib/formatters';
import { validateEmail, validateRequired, validateTcKimlik, validateTelefon } from '@/lib/validation/tr';
import 'dayjs/locale/tr';
import type { Personel, Proje } from '@/types/domain';

// =====================================================
// TİP TANIMLARI
// =====================================================

interface TahakkukBilgisi {
  exists: boolean;
  personel_sayisi?: number;
  aylik_ucret_toplami?: number;
  fazla_mesai_toplami?: number;
  isveren_sgk_hissesi?: number;
  isveren_issizlik?: number;
  toplam_gider?: number;
  odenecek_net_ucret?: number;
  odenecek_sgk_primi?: number;
  odenecek_sgd_primi?: number;
  odenecek_gelir_vergisi?: number;
  odenecek_damga_vergisi?: number;
  odenecek_issizlik?: number;
  toplam_odeme?: number;
  toplam_sgk_primi?: number;
  net_odenecek_sgk?: number;
  kaynak_dosya?: string;
}

interface BordroOzet {
  personel_sayisi: number;
  toplam_brut: number;
  toplam_net: number;
  toplam_sgk_isci: number;
  toplam_sgk_isveren: number;
  toplam_gelir_vergisi: number;
  toplam_damga_vergisi: number;
  toplam_maliyet: number;
}

interface MaasOdemePersonel {
  id: number;
  personel_id: number;
  ad: string;
  soyad: string;
  net_maas: number;
  bordro_maas: number;
  elden_fark: number;
  avans: number;
  prim: number;
  fazla_mesai: number;
  net_odenecek: number;
  banka_odendi: boolean;
  elden_odendi: boolean;
  banka_odeme_tarihi: string | null;
  elden_odeme_tarihi: string | null;
  notlar: string | null;
}

interface MaasOdemeOzet {
  personel_sayisi: number;
  toplam_bordro: number;
  toplam_elden: number;
  toplam_avans: number;
  toplam_prim: number;
  toplam_net: number;
  banka_odenen: number;
  elden_odenen: number;
  odeme_gunu: number;
}

interface AylikOdeme {
  id?: number;
  proje_id: number;
  yil: number;
  ay: number;
  maas_banka_odendi: boolean;
  maas_banka_tarih: string | null;
  maas_elden_odendi: boolean;
  maas_elden_tarih: string | null;
  sgk_odendi: boolean;
  sgk_tarih: string | null;
  gelir_vergisi_odendi: boolean;
  gelir_vergisi_tarih: string | null;
  damga_vergisi_odendi: boolean;
  damga_vergisi_tarih: string | null;
  issizlik_odendi: boolean;
  issizlik_tarih: string | null;
}

// =====================================================
// SABİTLER
// =====================================================

const departmanlar = ['Mutfak', 'Servis', 'Temizlik', 'Yönetim', 'Depo', 'Lojistik', 'Diğer'];
const pozisyonlar: Record<string, string[]> = {
  Mutfak: ['Şef', 'Aşçı', 'Aşçı Yardımcısı', 'Komi', 'Mutfak Personeli'],
  Servis: ['Garson', 'Garson Yardımcısı', 'Hostes', 'Servis Personeli'],
  Temizlik: ['Temizlik Personeli', 'Temizlik Sorumlusu'],
  Yönetim: ['Müdür', 'Müdür Yardımcısı', 'İdari Personel', 'Muhasebeci'],
  Depo: ['Depo Sorumlusu', 'Depo Personeli'],
  Lojistik: ['Şoför', 'Kurye', 'Araç Sorumlusu'],
  Diğer: ['Diğer'],
};

const aylar = [
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
  { value: '12', label: 'Aralık' },
];

// =====================================================
// ANA BİLEŞEN
// =====================================================

export default function PersonelPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');

  // === YETKİ KONTROLÜ ===
  const { canCreate, canEdit, canDelete, isSuperAdmin } = usePermissions();
  const canEditPersonel = isSuperAdmin || canEdit('personel');
  const canCreatePersonel = isSuperAdmin || canCreate('personel');
  const canDeletePersonel = isSuperAdmin || canDelete('personel');
  const canEditBordro = isSuperAdmin || canEdit('bordro');

  // === TEMEL STATE ===
  const [loading, setLoading] = useState(true);
  const [personelListLoading, setPersonelListLoading] = useState(false);
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [selectedProje, setSelectedProje] = useState<number | null>(null);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>('personel');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartman, setFilterDepartman] = useState<string | null>(null);
  const [filterDurum, setFilterDurum] = useState<string | null>(null);
  const [personelViewMode, setPersonelViewMode] = useState<'table' | 'cards'>('table');
  const [selectedPersonelIds, setSelectedPersonelIds] = useState<number[]>([]);

  // === BORDRO STATE ===
  const [bordroYil, setBordroYil] = useState(new Date().getFullYear());
  const [bordroAy, setBordroAy] = useState(new Date().getMonth() + 1);
  const [tahakkuk, setTahakkuk] = useState<TahakkukBilgisi | null>(null);
  const [bordroOzet, setBordroOzet] = useState<BordroOzet | null>(null);
  const [bordroLoading, setBordroLoading] = useState(false);

  // === MAAŞ ÖDEME STATE ===
  const [maasOdemePersoneller, setMaasOdemePersoneller] = useState<MaasOdemePersonel[]>([]);
  const [maasOdemeOzet, setMaasOdemeOzet] = useState<MaasOdemeOzet | null>(null);
  const [_maasOdemeLoading, setMaasOdemeLoading] = useState(false);
  const [showOdemeDetay, setShowOdemeDetay] = useState(false);
  const [tahakkukDetailOpen, setTahakkukDetailOpen] = useState(false);
  const [aylikOdeme, setAylikOdeme] = useState<AylikOdeme | null>(null);
  const [editingOdeme, setEditingOdeme] = useState<MaasOdemePersonel | null>(null);
  const [odemeForm, setOdemeForm] = useState({ elden_fark: 0, avans: 0, prim: 0 });

  // === MODAL STATE ===
  const [bordroImportOpen, setBordroImportOpen] = useState(false);
  const [personelModalOpened, { open: openPersonelModal, close: closePersonelModal }] = useDisclosure(false);
  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);

  // === FORM STATE ===
  const [editingPersonel, setEditingPersonel] = useState<Personel | null>(null);
  const [selectedPersonel, setSelectedPersonel] = useState<Personel | null>(null);

  const [personelForm, setPersonelForm] = useState({
    ad: '',
    soyad: '',
    tc_kimlik: '',
    telefon: '',
    email: '',
    departman: '',
    pozisyon: '',
    ise_giris_tarihi: new Date(),
    maas: 0,
    bordro_maas: 0,
    durum: 'aktif',
    medeni_durum: 'bekar',
    cocuk_sayisi: 0,
    sgk_no: '',
  });

  // =====================================================
  // VERİ ÇEKME FONKSİYONLARI
  // =====================================================

  const fetchProjeler = useCallback(async () => {
    try {
      setLoading(true);
      const result = await personelAPI.getProjeler({ durum: 'aktif' });
      if (result.success) {
        setProjeler(result.data || []);
        // İlk projeyi seç (sadece hiç proje seçilmemişse)
        setSelectedProje((current) => {
          if (!current && result.data && result.data.length > 0) {
            return result.data[0].id;
          }
          return current;
        });
      }
    } catch (error: unknown) {
      console.error('Proje yükleme hatası:', error);
      const res =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response
          : undefined;
      if (res?.status === 401) {
        notifications.show({
          title: 'Oturum Süresi Doldu',
          message: 'Lütfen tekrar giriş yapın',
          color: 'red',
        });
        setTimeout(() => {
          window.location.href = '/giris';
        }, 2000);
      }
      // Hata durumunda da projeler listesini boş array olarak set et
      setProjeler([]);
    } finally {
      setLoading(false);
    }
  }, []); // selectedProje dependency'sini kaldırdık - functional update kullanıyoruz

  const fetchPersoneller = useCallback(async () => {
    if (!selectedProje) return;
    setPersonelListLoading(true);
    try {
      const result = await personelAPI.getProjePersoneller(selectedProje);
      if (result.success) {
        setPersoneller(result.data || []);
      }
    } catch (error: unknown) {
      console.error('Personel yükleme hatası:', error);
      const res =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response
          : undefined;
      if (res?.status === 401) {
        notifications.show({
          title: 'Oturum Süresi Doldu',
          message: 'Lütfen tekrar giriş yapın',
          color: 'red',
        });
        setTimeout(() => {
          window.location.href = '/giris';
        }, 2000);
      }
    } finally {
      setPersonelListLoading(false);
    }
  }, [selectedProje]);

  const fetchBordro = useCallback(async () => {
    if (!selectedProje) return;
    setBordroLoading(true);
    try {
      const [tahakkukRes, ozetRes] = await Promise.allSettled([
        personelAPI.getBordroTahakkuk(selectedProje, bordroYil, bordroAy),
        personelAPI.getBordroOzet(bordroYil, bordroAy, selectedProje),
      ]);

      if (tahakkukRes.status === 'fulfilled' && tahakkukRes.value.success) {
        setTahakkuk(tahakkukRes.value.data);
      } else if (tahakkukRes.status === 'rejected') {
        console.error('Tahakkuk yükleme hatası:', tahakkukRes.reason);
      }

      if (ozetRes.status === 'fulfilled' && ozetRes.value.success) {
        setBordroOzet(ozetRes.value.data);
      } else if (ozetRes.status === 'rejected') {
        console.error('Bordro özet yükleme hatası:', ozetRes.reason);
      }
    } catch (error: unknown) {
      console.error('Bordro yükleme hatası:', error);
      const res =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response
          : undefined;
      if (res?.status === 401) {
        notifications.show({
          title: 'Oturum Süresi Doldu',
          message: 'Lütfen tekrar giriş yapın',
          color: 'red',
        });
      }
    } finally {
      setBordroLoading(false);
    }
  }, [selectedProje, bordroYil, bordroAy]);

  const fetchMaasOdeme = useCallback(async () => {
    if (!selectedProje) return;
    setMaasOdemeLoading(true);
    try {
      const result = await personelAPI.getMaasOdemeOzet(selectedProje, bordroYil, bordroAy);
      if (result.success) {
        setMaasOdemePersoneller(result.data?.personeller || []);
        setMaasOdemeOzet(result.data?.ozet || null);
      }
    } catch (error: unknown) {
      console.error('Maaş ödeme yükleme hatası:', error);
      const res =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response
          : undefined;
      if (res?.status === 401) {
        notifications.show({
          title: 'Oturum Süresi Doldu',
          message: 'Lütfen tekrar giriş yapın',
          color: 'red',
        });
      }
    } finally {
      setMaasOdemeLoading(false);
    }
  }, [selectedProje, bordroYil, bordroAy]);

  const _handleOlusturMaasOdeme = async () => {
    if (!selectedProje) return;
    try {
      const result = await personelAPI.createMaasOdeme(selectedProje, bordroYil, bordroAy);
      if (result.success) {
        notifications.show({
          message: '✓ Maaş ödemeleri oluşturuldu',
          color: 'green',
          autoClose: 2000,
        });
        fetchMaasOdeme();
      }
    } catch (_error) {
      notifications.show({ message: '✗ İşlem başarısız', color: 'red', autoClose: 2500 });
    }
  };

  const _handleTopluOdeme = async (tip: 'banka' | 'elden', odendi: boolean) => {
    if (!selectedProje) return;
    try {
      const result = await personelAPI.topluMaasOdendi(selectedProje, bordroYil, bordroAy);
      if (result.success) {
        notifications.show({
          message: `${tip === 'banka' ? '🏦' : '💵'} ${odendi ? '✓' : '○'}`,
          color: odendi ? 'green' : 'gray',
          autoClose: 1500,
          withCloseButton: false,
        });
        fetchMaasOdeme();
        fetchAylikOdeme();
      }
    } catch (_error) {
      notifications.show({ message: '✗ İşlem başarısız', color: 'red', autoClose: 2500 });
    }
  };

  const fetchAylikOdeme = useCallback(async () => {
    if (!selectedProje) return;
    try {
      const result = await personelAPI.getAylikOdeme(selectedProje, bordroYil, bordroAy);
      if (result.success && result.data !== undefined) {
        const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
        setAylikOdeme(data as AylikOdeme | null);
      }
    } catch (error: unknown) {
      console.error('Aylık ödeme yükleme hatası:', error);
      const res =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response
          : undefined;
      if (res?.status === 401) {
        notifications.show({
          title: 'Oturum Süresi Doldu',
          message: 'Lütfen tekrar giriş yapın',
          color: 'red',
        });
      }
    }
  }, [selectedProje, bordroYil, bordroAy]);

  const handleToggleOdeme = async (field: string, currentValue: boolean) => {
    if (!selectedProje) return;
    try {
      const result = await personelAPI.updateAylikOdeme(selectedProje, bordroYil, bordroAy, {
        field,
        odendi: !currentValue,
      });
      if (result.success) {
        const fieldNames: Record<string, string> = {
          maas_banka_odendi: 'Banka maaşları',
          maas_elden_odendi: 'Elden ödemeler',
          sgk_odendi: 'SGK primi',
          gelir_vergisi_odendi: 'Gelir vergisi',
          damga_vergisi_odendi: 'Damga vergisi',
          issizlik_odendi: 'İşsizlik sigortası',
        };
        notifications.show({
          message: `${fieldNames[field]} ${!currentValue ? '✓' : '○'}`,
          color: !currentValue ? 'green' : 'gray',
          autoClose: 1500,
          withCloseButton: false,
        });
        fetchAylikOdeme();
      }
    } catch (_error) {
      notifications.show({ message: '✗ İşlem başarısız', color: 'red', autoClose: 2500 });
    }
  };

  const handleTumunuOde = useCallback(
    async (odendi: boolean) => {
      if (!selectedProje) return;
      const fields = [
        'maas_banka_odendi',
        'maas_elden_odendi',
        'sgk_odendi',
        'gelir_vergisi_odendi',
        'damga_vergisi_odendi',
        'issizlik_odendi',
      ];
      try {
        for (const field of fields) {
          await personelAPI.updateAylikOdeme(selectedProje, bordroYil, bordroAy, { field, odendi });
        }

        // Tüm ödemeler tamamlandıysa proje_hareketler'e kayıt ekle
        // tahakkuk state'ini functional update ile kullan
        setTahakkuk((currentTahakkuk) => {
          if (odendi && currentTahakkuk) {
            personelAPI.finalizeOdeme(selectedProje, bordroYil, bordroAy).catch(console.error);
          }
          return currentTahakkuk;
        });

        notifications.show({
          message: odendi ? '✅ Tüm ödemeler tamamlandı' : '○ Tüm ödemeler sıfırlandı',
          color: odendi ? 'green' : 'gray',
          autoClose: 2000,
        });
        fetchAylikOdeme();
      } catch (_error) {
        notifications.show({ message: '✗ İşlem başarısız', color: 'red', autoClose: 2500 });
      }
    },
    [selectedProje, bordroYil, bordroAy, fetchAylikOdeme]
  );

  // Personel ödeme düzenleme
  const handleEditOdeme = (personel: MaasOdemePersonel) => {
    setEditingOdeme(personel);
    setOdemeForm({
      elden_fark: personel.elden_fark || 0,
      avans: personel.avans || 0,
      prim: personel.prim || 0,
    });
  };

  const handleSaveOdeme = async () => {
    if (!editingOdeme || !selectedProje) return;
    try {
      const result = await personelAPI.updatePersonelOdeme(editingOdeme.personel_id, {
        proje_id: selectedProje,
        yil: bordroYil,
        ay: bordroAy,
        ...odemeForm,
      });
      if (result.success) {
        notifications.show({ message: '✓ Ödeme güncellendi', color: 'green', autoClose: 2000 });
        setEditingOdeme(null);
        fetchMaasOdeme();
      }
    } catch (_error) {
      notifications.show({ message: '✗ Güncelleme başarısız', color: 'red', autoClose: 2500 });
    }
  };

  // === EFFECTS ===
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    fetchProjeler();
  }, [fetchProjeler, authLoading, isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (selectedProje) {
      fetchPersoneller();
    }
  }, [selectedProje, fetchPersoneller, authLoading, isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (selectedProje && activeTab === 'bordro') {
      fetchBordro();
      fetchMaasOdeme();
      fetchAylikOdeme();
    }
  }, [selectedProje, activeTab, fetchBordro, fetchMaasOdeme, fetchAylikOdeme, authLoading, isAuthenticated]);

  // 🔴 REALTIME - Personel ve bordro tablolarını dinle
  const refetchPersonelData = useCallback(() => {
    if (selectedProje) {
      fetchPersoneller();
      if (activeTab === 'bordro') {
        fetchBordro();
        fetchMaasOdeme();
        fetchAylikOdeme();
      }
    }
  }, [selectedProje, activeTab, fetchPersoneller, fetchBordro, fetchMaasOdeme, fetchAylikOdeme]);

  useRealtimeRefetch(['personel', 'bordro'], refetchPersonelData);

  // =====================================================
  // CRUD FONKSİYONLARI
  // =====================================================

  const handleSavePersonel = async () => {
    const adOk = validateRequired(personelForm.ad, 'Ad');
    const soyadOk = validateRequired(personelForm.soyad, 'Soyad');
    const tcOk = validateTcKimlik(personelForm.tc_kimlik);
    const telOk = validateTelefon(personelForm.telefon);
    const emailOk = validateEmail(personelForm.email);

    for (const r of [adOk, soyadOk, tcOk, telOk, emailOk]) {
      if (!r.valid) {
        notifications.show({ title: 'Hata', message: r.message, color: 'red' });
        return;
      }
    }

    try {
      const data = {
        ...personelForm,
        ise_giris_tarihi: personelForm.ise_giris_tarihi.toISOString().split('T')[0],
        proje_id: selectedProje,
      };

      const result = editingPersonel
        ? await personelAPI.updatePersonel(editingPersonel.id, data as Record<string, unknown>)
        : await personelAPI.createPersonel(data as Record<string, unknown>);

      if (!result.success) throw new Error('İşlem başarısız');

      notifications.show({
        title: 'Başarılı',
        message: `Personel ${editingPersonel ? 'güncellendi' : 'eklendi'}`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      closePersonelModal();
      resetPersonelForm();
      fetchPersoneller();
      fetchProjeler();
    } catch (error: unknown) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'İşlem başarısız',
        color: 'red',
      });
    }
  };

  const handleDeletePersonel = async (id: number) => {
    if (!confirm('Bu personeli silmek istediğinizden emin misiniz?')) return;

    try {
      const result = await personelAPI.deletePersonel(id);
      if (!result.success) throw new Error('Silme başarısız');

      notifications.show({ title: 'Silindi', message: 'Personel kaydı silindi', color: 'orange' });
      fetchPersoneller();
      fetchProjeler();
    } catch (error: unknown) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Silme başarısız',
        color: 'red',
      });
    }
  };

  // === RESET FONKSİYONLARI ===
  const resetPersonelForm = () => {
    setEditingPersonel(null);
    setPersonelForm({
      ad: '',
      soyad: '',
      tc_kimlik: '',
      telefon: '',
      email: '',
      departman: '',
      pozisyon: '',
      ise_giris_tarihi: new Date(),
      maas: 0,
      bordro_maas: 0,
      durum: 'aktif',
      medeni_durum: 'bekar',
      cocuk_sayisi: 0,
      sgk_no: '',
    });
  };

  const handleSelectAllPersonel = () => {
    if (selectedPersonelIds.length === filteredPersoneller.length) {
      setSelectedPersonelIds([]);
    } else {
      setSelectedPersonelIds(filteredPersoneller.map((p) => p.id));
    }
  };

  const handleTogglePersonelSelection = (id: number) => {
    setSelectedPersonelIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkPasif = async () => {
    if (selectedPersonelIds.length === 0) return;
    if (!confirm(`${selectedPersonelIds.length} personeli pasife almak istediğinize emin misiniz?`)) return;
    try {
      for (const id of selectedPersonelIds) {
        await personelAPI.updatePersonel(id, { durum: 'pasif' });
      }
      notifications.show({
        title: 'Başarılı',
        message: `${selectedPersonelIds.length} personel pasife alındı`,
        color: 'green',
      });
      setSelectedPersonelIds([]);
      fetchPersoneller();
    } catch (error: unknown) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Toplu güncelleme başarısız',
        color: 'red',
      });
    }
  };

  const handleEditPersonel = (p: Personel) => {
    setEditingPersonel(p);
    setPersonelForm({
      ad: p.ad,
      soyad: p.soyad,
      tc_kimlik: p.tc_kimlik || '',
      telefon: p.telefon || '',
      email: p.email || '',
      departman: p.departman || '',
      pozisyon: p.pozisyon || '',
      ise_giris_tarihi: p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi) : new Date(),
      maas: p.maas ?? 0,
      bordro_maas: p.bordro_maas || 0,
      durum: p.durum || 'aktif',
      medeni_durum: p.medeni_durum || 'bekar',
      cocuk_sayisi: p.cocuk_sayisi || 0,
      sgk_no: p.sgk_no || '',
    });
    openPersonelModal();
  };

  // =====================================================
  // YARDIMCI FONKSİYONLAR
  // =====================================================

  const getAvatarColor = (departman: string | null) => {
    const colors: Record<string, string> = {
      Mutfak: 'orange',
      Servis: 'blue',
      Temizlik: 'green',
      Yönetim: 'violet',
      Depo: 'cyan',
      Lojistik: 'pink',
    };
    return colors[departman || ''] || 'gray';
  };

  const getDurumBadge = (durum: string) => {
    const config: Record<string, { color: string; label: string }> = {
      aktif: { color: 'green', label: 'Aktif' },
      izinli: { color: 'yellow', label: 'İzinli' },
      pasif: { color: 'gray', label: 'Pasif' },
    };
    const { color, label } = config[durum] || config.aktif;
    return (
      <Badge color={color} variant="light">
        {label}
      </Badge>
    );
  };

  /** P5: Satır/kart sol kenar rengi (durum göstergesi) */
  const getDurumBorderColor = (durum: string) => {
    const map: Record<string, string> = { aktif: 'var(--mantine-color-green-6)', izinli: 'var(--mantine-color-yellow-6)', pasif: 'var(--mantine-color-gray-5)' };
    return map[durum] ?? 'var(--mantine-color-gray-4)';
  };

  // Filtrelenmiş personeller (arama + departman + durum)
  const filteredPersoneller = personeller.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      `${p.ad} ${p.soyad}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pozisyon?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartman = !filterDepartman || p.departman === filterDepartman;
    const matchesDurum = !filterDurum || (p.durum || 'aktif') === filterDurum;
    return matchesSearch && matchesDepartman && matchesDurum;
  });

  // Seçili proje bilgisi
  const selectedProjeData = projeler.find((p) => p.id === selectedProje);

  // =====================================================
  // RENDER
  // =====================================================

  // Loading state - sadece ilk yüklemede göster (projeler yüklenene kadar)
  if (loading && projeler.length === 0) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="xl" color="violet" />
          <Text c="dimmed" size="sm">
            Projeler yükleniyor...
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(132,94,247,0.05) 0%, rgba(0,0,0,0) 100%)'
          : 'linear-gradient(180deg, rgba(132,94,247,0.08) 0%, rgba(255,255,255,0) 100%)',
        minHeight: '100vh',
      }}
    >
      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* ==================== BAŞLIK ==================== */}
          <Group justify="space-between" align="flex-end">
            <Box>
              <Title order={1} fw={700}>
                🧑‍💼 Personel Yönetimi
              </Title>
              <Text c="dimmed" size="lg">
                Proje bazlı personel ve bordro yönetimi
              </Text>
            </Box>
            <Group>
              <Button
                leftSection={<IconRefresh size={18} />}
                variant="light"
                color="gray"
                onClick={() => {
                  fetchProjeler();
                  fetchPersoneller();
                }}
              >
                Yenile
              </Button>
              <DataActions
                type="personel"
                onImportSuccess={() => {
                  fetchProjeler();
                  fetchPersoneller();
                }}
              />
            </Group>
          </Group>

          {/* ==================== PROJE KARTLARI ==================== */}
          <Card withBorder shadow="sm" p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <Text fw={600} size="lg">
                🏢 Projeler
              </Text>
              <Button
                component={Link}
                href="/ayarlar?section=firma"
                variant="subtle"
                color="violet"
                size="sm"
                leftSection={<IconBuilding size={16} />}
              >
                Proje Yönetimi
              </Button>
            </Group>

            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }}>
              {projeler.map((proje) => (
                <Card
                  key={proje.id}
                  withBorder
                  shadow={selectedProje === proje.id ? 'md' : 'xs'}
                  p="md"
                  radius="md"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedProje === proje.id ? 'var(--mantine-color-violet-5)' : undefined,
                    background:
                      selectedProje === proje.id
                        ? isDark
                          ? 'rgba(132,94,247,0.15)'
                          : 'rgba(132,94,247,0.08)'
                        : undefined,
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setSelectedProje(proje.id)}
                >
                  <Group justify="space-between" mb="xs">
                    <Text fw={600} size="sm" lineClamp={1}>
                      {proje.ad}
                    </Text>
                    {selectedProje === proje.id && (
                      <Badge size="xs" color="violet">
                        Seçili
                      </Badge>
                    )}
                  </Group>
                  <Group gap="xs">
                    <Badge variant="light" color="blue" size="sm">
                      {proje.personel_sayisi} kişi
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">
                    {formatMoney(proje.toplam_maas || 0)}
                  </Text>
                </Card>
              ))}

              {projeler.length === 0 && (
                <Card withBorder p="xl" radius="md" style={{ gridColumn: '1 / -1' }}>
                  <Center>
                    <Stack align="center" gap="sm">
                      <ThemeIcon size="xl" color="gray" variant="light" radius="xl">
                        <IconBuilding size={24} />
                      </ThemeIcon>
                      <Text c="dimmed">Henüz proje eklenmemiş</Text>
                      <Text size="xs" c="dimmed">
                        Projeler merkezi olarak Ayarlar &gt; Firma Bilgileri'nden yönetilir
                      </Text>
                      <Button
                        component={Link}
                        href="/ayarlar?section=firma"
                        variant="light"
                        size="sm"
                        leftSection={<IconBuilding size={16} />}
                      >
                        Proje Ekle
                      </Button>
                    </Stack>
                  </Center>
                </Card>
              )}
            </SimpleGrid>
          </Card>

          {/* ==================== SEÇİLİ PROJE İÇERİĞİ ==================== */}
          {selectedProje && selectedProjeData && (
            <Card withBorder shadow="sm" radius="md">
              {/* PROJE BAŞLIĞI */}
              <Card.Section withBorder inheritPadding py="md">
                <Group justify="space-between">
                  <Group>
                    <ThemeIcon size="lg" radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
                      <IconBuilding size={20} />
                    </ThemeIcon>
                    <Box>
                      <Text fw={700} size="lg">
                        {selectedProjeData.ad}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {selectedProjeData.personel_sayisi} personel • {formatMoney(selectedProjeData.toplam_maas || 0)}{' '}
                        maaş
                      </Text>
                    </Box>
                  </Group>
                </Group>
              </Card.Section>

              {/* TAB'LAR */}
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="personel" leftSection={<IconUsers size={16} />}>
                    Personeller ({filteredPersoneller.length})
                  </Tabs.Tab>
                  <Tabs.Tab value="bordro" leftSection={<IconReceipt size={16} />}>
                    Maaş ve Bordro
                  </Tabs.Tab>
                </Tabs.List>

                {/* ==================== PERSONEL TAB ==================== */}
                <Tabs.Panel value="personel" pt="md">
                  <Stack gap="md">
                    {/* Aksiyon Bar */}
                    <Group justify="space-between">
                      <Group gap="sm">
                        <TextInput
                          placeholder="Personel ara..."
                          leftSection={<IconSearch size={16} />}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.currentTarget.value)}
                          style={{ width: 300 }}
                        />
                        <Select
                          placeholder="Departman"
                          clearable
                          value={filterDepartman}
                          onChange={(v) => setFilterDepartman(v || null)}
                          data={departmanlar.map((d) => ({ value: d, label: d }))}
                          size="sm"
                          style={{ width: 140 }}
                        />
                        <Select
                          placeholder="Durum"
                          clearable
                          value={filterDurum}
                          onChange={(v) => setFilterDurum(v || null)}
                          data={[
                            { value: 'aktif', label: 'Aktif' },
                            { value: 'izinli', label: 'İzinli' },
                            { value: 'pasif', label: 'Pasif' },
                          ]}
                          size="sm"
                          style={{ width: 110 }}
                        />
                        <SegmentedControl
                          value={personelViewMode}
                          onChange={(v) => setPersonelViewMode(v as 'table' | 'cards')}
                          data={[
                            { value: 'table', label: 'Tablo' },
                            { value: 'cards', label: 'Kart' },
                          ]}
                          size="sm"
                        />
                      </Group>
                      <Button
                        component={Link}
                        href="/muhasebe/demirbas"
                        variant="subtle"
                        color="gray"
                        size="xs"
                        title="Zimmetli demirbaşları görüntüle"
                      >
                        Zimmetli demirbaşlar
                      </Button>
                      {canCreatePersonel && (
                        <Button
                          variant="gradient"
                          gradient={{ from: 'violet', to: 'grape' }}
                          leftSection={<IconPlus size={16} />}
                          onClick={() => {
                            resetPersonelForm();
                            openPersonelModal();
                          }}
                        >
                          Personel Ekle
                        </Button>
                      )}
                    </Group>

                    {/* Toplu işlem çubuğu */}
                    {selectedPersonelIds.length > 0 && (
                      <Paper withBorder p="sm" bg="violet.0">
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>
                            {selectedPersonelIds.length} personel seçildi
                          </Text>
                          <Group gap="xs">
                            <Button
                              variant="subtle"
                              size="xs"
                              onClick={() => setSelectedPersonelIds([])}
                            >
                              Seçimi kaldır
                            </Button>
                            {canEditPersonel && (
                              <Button
                                variant="light"
                                color="gray"
                                size="xs"
                                leftSection={<IconUserOff size={14} />}
                                onClick={handleBulkPasif}
                              >
                                Seçilenleri pasife al
                              </Button>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                    )}

                    {/* Personel listesi: loading / boş / tablo */}
                    {personelListLoading ? (
                      <Center py="xl">
                        <Stack align="center" gap="md">
                          <Loader size="lg" color="violet" />
                          <Text c="dimmed" size="sm">
                            Personel listesi yükleniyor...
                          </Text>
                        </Stack>
                      </Center>
                    ) : filteredPersoneller.length === 0 ? (
                      <Center py="xl">
                        <Stack align="center" gap="md">
                          <ThemeIcon size="xl" color="gray" variant="light" radius="xl">
                            <IconUser size={24} />
                          </ThemeIcon>
                          <Text c="dimmed">Bu projede personel bulunamadı</Text>
                          {canCreatePersonel && (
                            <Button
                              variant="light"
                              color="violet"
                              leftSection={<IconPlus size={16} />}
                              onClick={() => {
                                resetPersonelForm();
                                openPersonelModal();
                              }}
                            >
                              Personel Ekle
                            </Button>
                          )}
                        </Stack>
                      </Center>
                    ) : personelViewMode === 'cards' ? (
                      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
                        {filteredPersoneller.map((personel) => (
                          <Card
                            key={personel.id}
                            withBorder
                            padding="md"
                            radius="md"
                            shadow="sm"
                            style={{
                              borderLeftWidth: 3,
                              borderLeftColor: getDurumBorderColor(personel.durum || 'aktif'),
                              borderLeftStyle: 'solid',
                            }}
                          >
                            <Group justify="space-between" mb="sm">
                              <Group gap="sm">
                                <Checkbox
                                  checked={selectedPersonelIds.includes(personel.id)}
                                  onChange={() => handleTogglePersonelSelection(personel.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`${personel.ad} ${personel.soyad} seç`}
                                />
                                <Avatar color={getAvatarColor(personel.departman ?? null)} radius="xl" size="md">
                                  {personel.ad[0]}
                                  {personel.soyad[0]}
                                </Avatar>
                                <div>
                                  <Text size="sm" fw={600}>
                                    {personel.ad} {personel.soyad}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {personel.pozisyon || '-'}
                                  </Text>
                                </div>
                              </Group>
                              <Menu position="bottom-end" shadow="md">
                                <Menu.Target>
                                  <ActionIcon variant="subtle" color="gray" size="sm">
                                    <IconDotsVertical size={16} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Item
                                    leftSection={<IconEye style={{ width: rem(14), height: rem(14) }} />}
                                    onClick={() => {
                                      setSelectedPersonel(personel);
                                      openDetailModal();
                                    }}
                                  >
                                    Detay
                                  </Menu.Item>
                                  {canEditPersonel && (
                                    <Menu.Item
                                      leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />}
                                      onClick={() => handleEditPersonel(personel)}
                                    >
                                      Düzenle
                                    </Menu.Item>
                                  )}
                                  {canDeletePersonel && (
                                    <>
                                      <Menu.Divider />
                                      <Menu.Item
                                        color="red"
                                        leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
                                        onClick={() => handleDeletePersonel(personel.id)}
                                      >
                                        Sil
                                      </Menu.Item>
                                    </>
                                  )}
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                            <Group gap="xs" mb="xs">
                              <Badge variant="light" color={getAvatarColor(personel.departman ?? null)} size="sm">
                                {personel.departman || 'Belirsiz'}
                              </Badge>
                              {getDurumBadge(personel.durum || 'aktif')}
                            </Group>
                            <Group justify="space-between" mt="xs">
                              <Text size="xs" c="dimmed">
                                İşe giriş: {formatDate(personel.ise_giris_tarihi)}
                              </Text>
                            </Group>
                            <Group justify="space-between" mt="xs">
                              <Text size="sm" fw={600} c="green">
                                {formatMoney(personel.maas)}
                              </Text>
                              <Text size="xs" c="orange">
                                Bordro: {formatMoney(personel.bordro_maas || 0)}
                              </Text>
                            </Group>
                          </Card>
                        ))}
                      </SimpleGrid>
                    ) : (
                      <Table.ScrollContainer minWidth={800}>
                        <Table verticalSpacing="sm" highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th style={{ width: 40 }}>
                                <Checkbox
                                  checked={
                                    filteredPersoneller.length > 0 &&
                                    selectedPersonelIds.length === filteredPersoneller.length
                                  }
                                  indeterminate={
                                    selectedPersonelIds.length > 0 &&
                                    selectedPersonelIds.length < filteredPersoneller.length
                                  }
                                  onChange={handleSelectAllPersonel}
                                  aria-label="Tümünü seç"
                                />
                              </Table.Th>
                              <Table.Th>Personel</Table.Th>
                              <Table.Th>Departman</Table.Th>
                              <Table.Th>Pozisyon</Table.Th>
                              <Table.Th>İşe Giriş</Table.Th>
                              <Table.Th>Durum</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                <Tooltip label="Gerçek ödenen maaş (elden)">
                                  <Text size="sm" fw={600}>
                                    Net Maaş
                                  </Text>
                                </Tooltip>
                              </Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                <Tooltip label="Resmi bordro maaşı (SGK'ya bildirilen)">
                                  <Text size="sm" fw={600} c="orange">
                                    Bordro
                                  </Text>
                                </Tooltip>
                              </Table.Th>
                              <Table.Th style={{ textAlign: 'center', width: 80 }}>İşlem</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {filteredPersoneller.map((personel) => (
                              <Table.Tr
                                key={personel.id}
                                style={{
                                  borderLeftWidth: 3,
                                  borderLeftColor: getDurumBorderColor(personel.durum || 'aktif'),
                                  borderLeftStyle: 'solid',
                                }}
                              >
                                <Table.Td>
                                  <Checkbox
                                    checked={selectedPersonelIds.includes(personel.id)}
                                    onChange={() => handleTogglePersonelSelection(personel.id)}
                                    aria-label={`${personel.ad} ${personel.soyad} seç`}
                                  />
                                </Table.Td>
                                <Table.Td>
                                  <Group gap="sm">
                                    <Avatar color={getAvatarColor(personel.departman ?? null)} radius="xl">
                                      {personel.ad[0]}
                                      {personel.soyad[0]}
                                    </Avatar>
                                    <div>
                                      <Text size="sm" fw={500}>
                                        {personel.ad} {personel.soyad}
                                      </Text>
                                      <Text size="xs" c="dimmed">
                                        {personel.telefon || '-'}
                                      </Text>
                                    </div>
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  <Badge variant="light" color={getAvatarColor(personel.departman ?? null)}>
                                    {personel.departman || 'Belirsiz'}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm">{personel.pozisyon || '-'}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm" c="dimmed">
                                    {formatDate(personel.ise_giris_tarihi)}
                                  </Text>
                                </Table.Td>
                                <Table.Td>{getDurumBadge(personel.durum || 'aktif')}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text size="sm" fw={600} c="green">
                                    {formatMoney(personel.maas)}
                                  </Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text size="sm" fw={500} c="orange">
                                    {formatMoney(personel.bordro_maas || 0)}
                                  </Text>
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
                                        onClick={() => {
                                          setSelectedPersonel(personel);
                                          openDetailModal();
                                        }}
                                      >
                                        Detay
                                      </Menu.Item>
                                      {canEditPersonel && (
                                        <Menu.Item
                                          leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />}
                                          onClick={() => handleEditPersonel(personel)}
                                        >
                                          Düzenle
                                        </Menu.Item>
                                      )}
                                      {canDeletePersonel && (
                                        <>
                                          <Menu.Divider />
                                          <Menu.Item
                                            color="red"
                                            leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
                                            onClick={() => handleDeletePersonel(personel.id)}
                                          >
                                            Sil
                                          </Menu.Item>
                                        </>
                                      )}
                                    </Menu.Dropdown>
                                  </Menu>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                    )}
                  </Stack>
                </Tabs.Panel>

                {/* ==================== BORDRO TAB ==================== */}
                <Tabs.Panel value="bordro" pt="md">
                  <Stack gap="md">
                    {/* Dönem Seçimi ve Yükleme */}
                    <Group justify="space-between">
                      <Group>
                        <Select
                          label="Yıl"
                          data={[2024, 2025, 2026, 2027].map((y) => ({
                            value: y.toString(),
                            label: y.toString(),
                          }))}
                          value={bordroYil.toString()}
                          onChange={(v) => setBordroYil(parseInt(v || '2026', 10))}
                          style={{ width: 100 }}
                        />
                        <Select
                          label="Ay"
                          data={aylar}
                          value={bordroAy.toString()}
                          onChange={(v) => setBordroAy(parseInt(v || '1', 10))}
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
                      <Button
                        variant="gradient"
                        gradient={{ from: 'blue', to: 'cyan' }}
                        leftSection={<IconFileUpload size={16} />}
                        onClick={() => setBordroImportOpen(true)}
                        mt={24}
                      >
                        📤 Tahakkuk Yükle
                      </Button>
                    </Group>

                    {bordroLoading ? (
                      <Center py="xl">
                        <Loader color="violet" />
                      </Center>
                    ) : tahakkuk?.exists ? (
                      /* ==================== TAHAKKUK BİLGİLERİ ==================== */
                      <Stack gap="md">
                        <Badge color="green" variant="light" size="lg">
                          ✅ {aylar.find((a) => a.value === bordroAy.toString())?.label} {bordroYil} Tahakkuk Yüklendi
                        </Badge>

                        {/* ÖZET KARTLARI */}
                        <SimpleGrid cols={{ base: 2, md: 5 }}>
                          <Card withBorder p="md" radius="md">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              👥 Personel
                            </Text>
                            <Text fw={700} size="xl">
                              {tahakkuk.personel_sayisi || bordroOzet?.personel_sayisi || 0}
                            </Text>
                          </Card>
                          <Card withBorder p="md" radius="md">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              💵 Net Ücretler
                            </Text>
                            <Text fw={700} size="xl" c="green">
                              {formatMoney(tahakkuk.odenecek_net_ucret || 0)}
                            </Text>
                          </Card>
                          <Card withBorder p="md" radius="md">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              📤 Elden Fark
                            </Text>
                            <Text fw={700} size="xl" c="orange">
                              {formatMoney(maasOdemeOzet?.toplam_elden || 0)}
                            </Text>
                          </Card>
                          <Card withBorder p="md" radius="md">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              🏛️ SGK + Vergi
                            </Text>
                            <Text fw={700} size="xl" c="blue">
                              {formatMoney(
                                parseFloat(String(tahakkuk.toplam_gider || 0)) -
                                  parseFloat(String(tahakkuk.odenecek_net_ucret || 0))
                              )}
                            </Text>
                          </Card>
                          <Card withBorder p="md" radius="md" bg={isDark ? 'red.9' : 'red.0'}>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              💰 Toplam Maliyet
                            </Text>
                            <Text fw={700} size="xl" c="red">
                              {formatMoney(tahakkuk.toplam_gider || 0)}
                            </Text>
                          </Card>
                        </SimpleGrid>

                        {/* Tahakkuk Detay Butonu */}
                        <Group justify="center">
                          <Button
                            variant="subtle"
                            size="xs"
                            leftSection={<IconEye size={14} />}
                            onClick={() => setTahakkukDetailOpen(true)}
                          >
                            Tahakkuk Detayını Görüntüle
                          </Button>
                          {tahakkuk.kaynak_dosya && (
                            <Text size="xs" c="dimmed">
                              Kaynak: {tahakkuk.kaynak_dosya}
                            </Text>
                          )}
                        </Group>

                        {/* ==================== TÜM ÖDEMELER TAKİP ==================== */}
                        <Divider my="md" label="💸 ÖDEME TAKİP" labelPosition="center" />

                        {/* GENEL ÖDEME DURUMU */}
                        {aylikOdeme && tahakkuk && (
                          <Paper
                            withBorder
                            p="md"
                            radius="md"
                            mb="md"
                            bg={
                              aylikOdeme.maas_banka_odendi &&
                              aylikOdeme.maas_elden_odendi &&
                              aylikOdeme.sgk_odendi &&
                              aylikOdeme.gelir_vergisi_odendi &&
                              aylikOdeme.damga_vergisi_odendi &&
                              aylikOdeme.issizlik_odendi
                                ? isDark
                                  ? 'green.9'
                                  : 'green.1'
                                : isDark
                                  ? 'dark.6'
                                  : 'gray.0'
                            }
                          >
                            <Group justify="space-between" mb="md">
                              <Group gap="md">
                                <Text fw={700} size="lg">
                                  {aylar.find((a) => a.value === bordroAy.toString())?.label} {bordroYil} Ödemeleri
                                </Text>
                                {aylikOdeme.maas_banka_odendi &&
                                aylikOdeme.maas_elden_odendi &&
                                aylikOdeme.sgk_odendi &&
                                aylikOdeme.gelir_vergisi_odendi &&
                                aylikOdeme.damga_vergisi_odendi &&
                                aylikOdeme.issizlik_odendi ? (
                                  <Badge size="xl" color="green" variant="filled" leftSection="✅">
                                    TÜM ÖDEMELER TAMAMLANDI
                                  </Badge>
                                ) : (
                                  <Badge size="lg" color="orange" variant="light" leftSection="⏳">
                                    {
                                      [
                                        aylikOdeme.maas_banka_odendi,
                                        aylikOdeme.maas_elden_odendi,
                                        aylikOdeme.sgk_odendi,
                                        aylikOdeme.gelir_vergisi_odendi,
                                        aylikOdeme.damga_vergisi_odendi,
                                        aylikOdeme.issizlik_odendi,
                                      ].filter(Boolean).length
                                    }{' '}
                                    / 6 Ödeme Yapıldı
                                  </Badge>
                                )}
                              </Group>
                              <Group gap="xs">
                                {!(
                                  aylikOdeme.maas_banka_odendi &&
                                  aylikOdeme.maas_elden_odendi &&
                                  aylikOdeme.sgk_odendi &&
                                  aylikOdeme.gelir_vergisi_odendi &&
                                  aylikOdeme.damga_vergisi_odendi &&
                                  aylikOdeme.issizlik_odendi
                                ) && (
                                  <Button
                                    size="sm"
                                    variant="filled"
                                    color="green"
                                    leftSection={<IconCheck size={16} />}
                                    onClick={() => handleTumunuOde(true)}
                                  >
                                    Tümünü Öde
                                  </Button>
                                )}
                                {(aylikOdeme.maas_banka_odendi ||
                                  aylikOdeme.maas_elden_odendi ||
                                  aylikOdeme.sgk_odendi ||
                                  aylikOdeme.gelir_vergisi_odendi ||
                                  aylikOdeme.damga_vergisi_odendi ||
                                  aylikOdeme.issizlik_odendi) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    color="gray"
                                    leftSection={<IconRefresh size={16} />}
                                    onClick={() => handleTumunuOde(false)}
                                  >
                                    Tümünü Sıfırla
                                  </Button>
                                )}
                              </Group>
                            </Group>

                            {/* TOPLAM ÖDENEN - 2 SATIR */}
                            {(() => {
                              // RESMİ TOPLAM (Tahakkuktan gelen doğru değer)
                              const resmiToplam = parseFloat(String(tahakkuk.toplam_gider || 0));

                              // EK ÖDEMELER (Kayıt dışı)
                              const eldenFark = parseFloat(String(maasOdemeOzet?.toplam_elden || 0));
                              const prim = parseFloat(String(maasOdemeOzet?.toplam_prim || 0));
                              const avans = parseFloat(String(maasOdemeOzet?.toplam_avans || 0));
                              const ekOdemeler = eldenFark + prim - avans;

                              // GENEL TOPLAM
                              const genelToplam = resmiToplam + ekOdemeler;

                              // Ödeme hesabı için kart değerleri (kartlardaki değerlerle aynı olmalı)
                              const netMaas = parseFloat(String(tahakkuk.odenecek_net_ucret || 0));
                              const sgkPrimi =
                                parseFloat(String(tahakkuk.odenecek_sgk_primi || 0)) +
                                parseFloat(String(tahakkuk.odenecek_sgd_primi || 0));
                              const gelirVergisi = parseFloat(String(tahakkuk.odenecek_gelir_vergisi || 0));
                              const damgaVergisi = parseFloat(String(tahakkuk.odenecek_damga_vergisi || 0));
                              const issizlik = parseFloat(String(tahakkuk.odenecek_issizlik || 0));

                              // ÖDENEN (kartlardaki değerlere göre)
                              const resmiOdenen =
                                (aylikOdeme.maas_banka_odendi ? netMaas : 0) +
                                (aylikOdeme.sgk_odendi ? sgkPrimi : 0) +
                                (aylikOdeme.gelir_vergisi_odendi ? gelirVergisi : 0) +
                                (aylikOdeme.damga_vergisi_odendi ? damgaVergisi : 0) +
                                (aylikOdeme.issizlik_odendi ? issizlik : 0);

                              const ekOdenen = aylikOdeme.maas_elden_odendi ? ekOdemeler : 0;
                              const toplamOdenen = resmiOdenen + ekOdenen;

                              return (
                                <Stack gap="md">
                                  {/* Resmi Ödemeler */}
                                  <SimpleGrid cols={{ base: 2, md: 4 }}>
                                    <Box>
                                      <Text size="xs" c="dimmed">
                                        📋 Tahakkuk Toplamı (Resmi)
                                      </Text>
                                      <Text fw={700} size="lg">
                                        {formatMoney(resmiToplam)}
                                      </Text>
                                    </Box>
                                    <Box>
                                      <Text size="xs" c="dimmed">
                                        💵 Ek Ödemeler (Elden/Prim)
                                      </Text>
                                      <Text fw={700} size="lg" c={ekOdemeler > 0 ? 'orange' : 'dimmed'}>
                                        {ekOdemeler >= 0 ? '+' : ''}
                                        {formatMoney(ekOdemeler)}
                                      </Text>
                                    </Box>
                                    <Box>
                                      <Text size="xs" c="dimmed">
                                        💰 Genel Toplam
                                      </Text>
                                      <Text fw={700} size="xl" c="blue">
                                        {formatMoney(genelToplam)}
                                      </Text>
                                    </Box>
                                    <Box>
                                      <Text size="xs" c="dimmed">
                                        ✅ Ödenen
                                      </Text>
                                      <Text fw={700} size="xl" c="green">
                                        {formatMoney(toplamOdenen)}
                                      </Text>
                                    </Box>
                                  </SimpleGrid>

                                  {/* Detay satırı */}
                                  <Group
                                    gap="xl"
                                    style={{
                                      fontSize: '12px',
                                      color: 'var(--mantine-color-dimmed)',
                                    }}
                                  >
                                    <Text size="xs">
                                      Elden: {formatMoney(eldenFark)} | Prim: +{formatMoney(prim)} | Avans: -
                                      {formatMoney(avans)}
                                    </Text>
                                    <Text size="xs" c={genelToplam - toplamOdenen > 0 ? 'orange' : 'green'}>
                                      Kalan: {formatMoney(genelToplam - toplamOdenen)}
                                    </Text>
                                  </Group>
                                </Stack>
                              );
                            })()}
                          </Paper>
                        )}

                        {/* ÖDEME KARTLARI */}
                        <SimpleGrid cols={{ base: 2, md: 3 }} mb="md">
                          {/* BANKA MAAŞLARI */}
                          <Card
                            withBorder
                            p="md"
                            radius="md"
                            bg={
                              aylikOdeme?.maas_banka_odendi
                                ? isDark
                                  ? 'green.9'
                                  : 'green.1'
                                : isDark
                                  ? 'dark.7'
                                  : 'white'
                            }
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() =>
                              handleToggleOdeme('maas_banka_odendi', aylikOdeme?.maas_banka_odendi || false)
                            }
                          >
                            <Group justify="space-between" mb="xs">
                              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                🏦 Banka Maaşları
                              </Text>
                              <ThemeIcon
                                size="sm"
                                radius="xl"
                                color={aylikOdeme?.maas_banka_odendi ? 'green' : 'gray'}
                                variant={aylikOdeme?.maas_banka_odendi ? 'filled' : 'light'}
                              >
                                <IconCheck size={12} />
                              </ThemeIcon>
                            </Group>
                            <Text fw={700} size="xl">
                              {formatMoney(tahakkuk.odenecek_net_ucret || 0)}
                            </Text>
                            {aylikOdeme?.maas_banka_tarih && (
                              <Text size="xs" c="dimmed">
                                Ödendi: {formatDate(aylikOdeme.maas_banka_tarih)}
                              </Text>
                            )}
                          </Card>

                          {/* ELDEN ÖDEMELER */}
                          <Card
                            withBorder
                            p="md"
                            radius="md"
                            bg={
                              aylikOdeme?.maas_elden_odendi
                                ? isDark
                                  ? 'green.9'
                                  : 'green.1'
                                : isDark
                                  ? 'dark.7'
                                  : 'white'
                            }
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() =>
                              handleToggleOdeme('maas_elden_odendi', aylikOdeme?.maas_elden_odendi || false)
                            }
                          >
                            <Group justify="space-between" mb="xs">
                              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                💵 Elden Ödemeler
                              </Text>
                              <ThemeIcon
                                size="sm"
                                radius="xl"
                                color={aylikOdeme?.maas_elden_odendi ? 'green' : 'gray'}
                                variant={aylikOdeme?.maas_elden_odendi ? 'filled' : 'light'}
                              >
                                <IconCheck size={12} />
                              </ThemeIcon>
                            </Group>
                            <Text fw={700} size="xl" c="orange">
                              {formatMoney(maasOdemeOzet?.toplam_elden || 0)}
                            </Text>
                            {aylikOdeme?.maas_elden_tarih && (
                              <Text size="xs" c="dimmed">
                                Ödendi: {formatDate(aylikOdeme.maas_elden_tarih)}
                              </Text>
                            )}
                          </Card>

                          {/* SGK PRİMİ */}
                          <Card
                            withBorder
                            p="md"
                            radius="md"
                            bg={aylikOdeme?.sgk_odendi ? (isDark ? 'green.9' : 'green.1') : isDark ? 'dark.7' : 'white'}
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() => handleToggleOdeme('sgk_odendi', aylikOdeme?.sgk_odendi || false)}
                          >
                            <Group justify="space-between" mb="xs">
                              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                🏛️ SGK Primi
                              </Text>
                              <ThemeIcon
                                size="sm"
                                radius="xl"
                                color={aylikOdeme?.sgk_odendi ? 'green' : 'gray'}
                                variant={aylikOdeme?.sgk_odendi ? 'filled' : 'light'}
                              >
                                <IconCheck size={12} />
                              </ThemeIcon>
                            </Group>
                            <Text fw={700} size="xl" c="blue">
                              {formatMoney(
                                parseFloat(String(tahakkuk.odenecek_sgk_primi || 0)) +
                                  parseFloat(String(tahakkuk.odenecek_sgd_primi || 0))
                              )}
                            </Text>
                            {aylikOdeme?.sgk_tarih && (
                              <Text size="xs" c="dimmed">
                                Ödendi: {formatDate(aylikOdeme.sgk_tarih)}
                              </Text>
                            )}
                          </Card>

                          {/* GELİR VERGİSİ */}
                          <Card
                            withBorder
                            p="md"
                            radius="md"
                            bg={
                              aylikOdeme?.gelir_vergisi_odendi
                                ? isDark
                                  ? 'green.9'
                                  : 'green.1'
                                : isDark
                                  ? 'dark.7'
                                  : 'white'
                            }
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() =>
                              handleToggleOdeme('gelir_vergisi_odendi', aylikOdeme?.gelir_vergisi_odendi || false)
                            }
                          >
                            <Group justify="space-between" mb="xs">
                              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                📋 Gelir Vergisi
                              </Text>
                              <ThemeIcon
                                size="sm"
                                radius="xl"
                                color={aylikOdeme?.gelir_vergisi_odendi ? 'green' : 'gray'}
                                variant={aylikOdeme?.gelir_vergisi_odendi ? 'filled' : 'light'}
                              >
                                <IconCheck size={12} />
                              </ThemeIcon>
                            </Group>
                            <Text fw={700} size="xl" c="violet">
                              {formatMoney(tahakkuk.odenecek_gelir_vergisi || 0)}
                            </Text>
                            {aylikOdeme?.gelir_vergisi_tarih && (
                              <Text size="xs" c="dimmed">
                                Ödendi: {formatDate(aylikOdeme.gelir_vergisi_tarih)}
                              </Text>
                            )}
                          </Card>

                          {/* DAMGA VERGİSİ */}
                          <Card
                            withBorder
                            p="md"
                            radius="md"
                            bg={
                              aylikOdeme?.damga_vergisi_odendi
                                ? isDark
                                  ? 'green.9'
                                  : 'green.1'
                                : isDark
                                  ? 'dark.7'
                                  : 'white'
                            }
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() =>
                              handleToggleOdeme('damga_vergisi_odendi', aylikOdeme?.damga_vergisi_odendi || false)
                            }
                          >
                            <Group justify="space-between" mb="xs">
                              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                📄 Damga Vergisi
                              </Text>
                              <ThemeIcon
                                size="sm"
                                radius="xl"
                                color={aylikOdeme?.damga_vergisi_odendi ? 'green' : 'gray'}
                                variant={aylikOdeme?.damga_vergisi_odendi ? 'filled' : 'light'}
                              >
                                <IconCheck size={12} />
                              </ThemeIcon>
                            </Group>
                            <Text fw={700} size="xl" c="grape">
                              {formatMoney(tahakkuk.odenecek_damga_vergisi || 0)}
                            </Text>
                            {aylikOdeme?.damga_vergisi_tarih && (
                              <Text size="xs" c="dimmed">
                                Ödendi: {formatDate(aylikOdeme.damga_vergisi_tarih)}
                              </Text>
                            )}
                          </Card>

                          {/* İŞSİZLİK SİGORTASI */}
                          <Card
                            withBorder
                            p="md"
                            radius="md"
                            bg={
                              aylikOdeme?.issizlik_odendi
                                ? isDark
                                  ? 'green.9'
                                  : 'green.1'
                                : isDark
                                  ? 'dark.7'
                                  : 'white'
                            }
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() => handleToggleOdeme('issizlik_odendi', aylikOdeme?.issizlik_odendi || false)}
                          >
                            <Group justify="space-between" mb="xs">
                              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                👷 İşsizlik Sigortası
                              </Text>
                              <ThemeIcon
                                size="sm"
                                radius="xl"
                                color={aylikOdeme?.issizlik_odendi ? 'green' : 'gray'}
                                variant={aylikOdeme?.issizlik_odendi ? 'filled' : 'light'}
                              >
                                <IconCheck size={12} />
                              </ThemeIcon>
                            </Group>
                            <Text fw={700} size="xl" c="cyan">
                              {formatMoney(tahakkuk.odenecek_issizlik || 0)}
                            </Text>
                            {aylikOdeme?.issizlik_tarih && (
                              <Text size="xs" c="dimmed">
                                Ödendi: {formatDate(aylikOdeme.issizlik_tarih)}
                              </Text>
                            )}
                          </Card>
                        </SimpleGrid>

                        {/* PERSONEL DETAY BUTONU */}
                        <Group justify="center" mb="md">
                          <Button size="xs" variant="subtle" onClick={() => setShowOdemeDetay(!showOdemeDetay)}>
                            {showOdemeDetay ? '👆 Personel Listesini Gizle' : '👇 Personel Bazlı Detay Göster'}
                          </Button>
                        </Group>

                        {/* Personel Bazlı Ödeme Listesi */}
                        {showOdemeDetay && maasOdemePersoneller.length > 0 && (
                          <Table striped highlightOnHover withTableBorder>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Personel</Table.Th>
                                <Table.Th style={{ textAlign: 'right' }}>Bordro (Banka)</Table.Th>
                                <Table.Th style={{ textAlign: 'right' }}>Elden Fark</Table.Th>
                                <Table.Th style={{ textAlign: 'right' }}>Avans</Table.Th>
                                <Table.Th style={{ textAlign: 'right' }}>Prim</Table.Th>
                                <Table.Th style={{ textAlign: 'right' }}>Net Ödenecek</Table.Th>
                                <Table.Th style={{ textAlign: 'center' }}>Durum</Table.Th>
                                <Table.Th style={{ textAlign: 'center' }}>İşlem</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {maasOdemePersoneller.map((p) => (
                                <Table.Tr key={p.id}>
                                  <Table.Td>
                                    <Text size="sm" fw={500}>
                                      {p.ad} {p.soyad}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: 'right' }}>
                                    <Text size="sm">{formatMoney(p.bordro_maas)}</Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: 'right' }}>
                                    <Text size="sm" c="orange">
                                      {formatMoney(p.elden_fark)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: 'right' }}>
                                    <Text size="sm" c="red">
                                      {p.avans > 0 ? `-${formatMoney(p.avans)}` : '-'}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: 'right' }}>
                                    <Text size="sm" c="green">
                                      {p.prim > 0 ? `+${formatMoney(p.prim)}` : '-'}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: 'right' }}>
                                    <Text size="sm" fw={700}>
                                      {formatMoney(p.net_odenecek)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: 'center' }}>
                                    <Group gap={4} justify="center">
                                      <Tooltip label={p.banka_odendi ? 'Banka ödendi' : 'Banka bekleniyor'}>
                                        <Badge size="xs" color={p.banka_odendi ? 'green' : 'gray'} variant="light">
                                          🏦
                                        </Badge>
                                      </Tooltip>
                                      <Tooltip label={p.elden_odendi ? 'Elden ödendi' : 'Elden bekleniyor'}>
                                        <Badge size="xs" color={p.elden_odendi ? 'green' : 'gray'} variant="light">
                                          💵
                                        </Badge>
                                      </Tooltip>
                                    </Group>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: 'center' }}>
                                    {canEditBordro ? (
                                      <ActionIcon
                                        variant="light"
                                        color="blue"
                                        size="sm"
                                        onClick={() => handleEditOdeme(p)}
                                      >
                                        <IconEdit size={14} />
                                      </ActionIcon>
                                    ) : (
                                      <Text c="dimmed" size="xs">
                                        -
                                      </Text>
                                    )}
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        )}
                      </Stack>
                    ) : (
                      /* TAHAKKUK YOK */
                      <Center py="xl">
                        <Stack align="center" gap="md">
                          <ThemeIcon size="xl" color="gray" variant="light" radius="xl">
                            <IconReceipt size={24} />
                          </ThemeIcon>
                          <Text c="dimmed">Bu dönem için tahakkuk bilgisi bulunamadı</Text>
                          <Button
                            variant="light"
                            leftSection={<IconFileUpload size={16} />}
                            onClick={() => setBordroImportOpen(true)}
                          >
                            Tahakkuk Yükle
                          </Button>
                        </Stack>
                      </Center>
                    )}
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Card>
          )}
        </Stack>

        {/* ==================== MODAL'LAR ==================== */}

        {/* Personel Modal */}
        <Modal
          opened={personelModalOpened}
          onClose={() => {
            resetPersonelForm();
            closePersonelModal();
          }}
          title={
            <Text fw={600} size="lg">
              {editingPersonel ? 'Personel Düzenle' : 'Yeni Personel'}
            </Text>
          }
          size="lg"
          fullScreen={isMobile}
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Ad"
                required
                value={personelForm.ad}
                onChange={(e) => setPersonelForm({ ...personelForm, ad: e.currentTarget.value })}
              />
              <TextInput
                label="Soyad"
                required
                value={personelForm.soyad}
                onChange={(e) => setPersonelForm({ ...personelForm, soyad: e.currentTarget.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="TC Kimlik No"
                required
                value={personelForm.tc_kimlik}
                onChange={(e) => setPersonelForm({ ...personelForm, tc_kimlik: e.currentTarget.value })}
                leftSection={<IconId size={16} />}
              />
              <TextInput
                label="SGK No"
                value={personelForm.sgk_no}
                onChange={(e) => setPersonelForm({ ...personelForm, sgk_no: e.currentTarget.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Telefon"
                value={personelForm.telefon}
                onChange={(e) => setPersonelForm({ ...personelForm, telefon: e.currentTarget.value })}
                leftSection={<IconPhone size={16} />}
              />
              <TextInput
                label="E-posta"
                value={personelForm.email}
                onChange={(e) => setPersonelForm({ ...personelForm, email: e.currentTarget.value })}
                leftSection={<IconMail size={16} />}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Departman"
                data={departmanlar}
                value={personelForm.departman}
                onChange={(v) => setPersonelForm({ ...personelForm, departman: v || '', pozisyon: '' })}
              />
              <Select
                label="Pozisyon"
                data={personelForm.departman ? pozisyonlar[personelForm.departman] || [] : []}
                value={personelForm.pozisyon}
                onChange={(v) => setPersonelForm({ ...personelForm, pozisyon: v || '' })}
                disabled={!personelForm.departman}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <StyledDatePicker
                label="İşe Giriş Tarihi"
                value={personelForm.ise_giris_tarihi}
                onChange={(v) => setPersonelForm({ ...personelForm, ise_giris_tarihi: v || new Date() })}
                required
              />
              <Select
                label="Durum"
                data={[
                  { label: 'Aktif', value: 'aktif' },
                  { label: 'İzinli', value: 'izinli' },
                  { label: 'Pasif', value: 'pasif' },
                ]}
                value={personelForm.durum}
                onChange={(v) => setPersonelForm({ ...personelForm, durum: v || 'aktif' })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput
                label="💰 Net Maaş (Elden Ödenen)"
                description="Gerçek ödenen tutar"
                value={personelForm.maas}
                onChange={(v) => setPersonelForm({ ...personelForm, maas: Number(v) || 0 })}
                min={0}
                thousandSeparator="."
                decimalSeparator=","
                styles={{ input: { borderColor: 'var(--mantine-color-green-5)' } }}
              />
              <NumberInput
                label="📋 Bordro Maaş (SGK Bildirimi)"
                description="Resmi kayıtlardaki tutar"
                value={personelForm.bordro_maas}
                onChange={(v) => setPersonelForm({ ...personelForm, bordro_maas: Number(v) || 0 })}
                min={0}
                thousandSeparator="."
                decimalSeparator=","
                styles={{ input: { borderColor: 'var(--mantine-color-orange-5)' } }}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Medeni Durum"
                data={[
                  { value: 'bekar', label: 'Bekar' },
                  { value: 'evli', label: 'Evli' },
                ]}
                value={personelForm.medeni_durum}
                onChange={(v) => setPersonelForm({ ...personelForm, medeni_durum: v || 'bekar' })}
              />
              <NumberInput
                label="Çocuk Sayısı"
                value={personelForm.cocuk_sayisi}
                onChange={(v) => setPersonelForm({ ...personelForm, cocuk_sayisi: Number(v) || 0 })}
                min={0}
                max={10}
              />
            </SimpleGrid>

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  resetPersonelForm();
                  closePersonelModal();
                }}
              >
                İptal
              </Button>
              <Button color="violet" onClick={handleSavePersonel}>
                {editingPersonel ? 'Güncelle' : 'Kaydet'}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Personel Detay Modal */}
        <Modal
          opened={detailModalOpened}
          onClose={closeDetailModal}
          title={
            <Text fw={600} size="lg">
              👤 Personel Detayı
            </Text>
          }
          size="xl"
          fullScreen={isMobile}
        >
          {selectedPersonel &&
            (() => {
              // Kıdem hesapla
              const iseGiris = new Date(selectedPersonel.ise_giris_tarihi || Date.now());
              const bugun = new Date();
              const farkMs = bugun.getTime() - iseGiris.getTime();
              const gunFark = Math.floor(farkMs / (1000 * 60 * 60 * 24));
              const yil = Math.floor(gunFark / 365);
              const ay = Math.floor((gunFark % 365) / 30);
              const gun = gunFark % 30;
              const kidemStr = yil > 0 ? `${yil} yıl ${ay} ay` : ay > 0 ? `${ay} ay ${gun} gün` : `${gun} gün`;

              // Maaş farkı
              const maasFark = (selectedPersonel.maas ?? 0) - (selectedPersonel.bordro_maas || 0);

              return (
                <Stack gap="md">
                  {/* PROFİL HEADER */}
                  <Paper withBorder p="lg" radius="md" bg={isDark ? 'dark.6' : 'violet.0'}>
                    <Group>
                      <Avatar size={80} color={getAvatarColor(selectedPersonel.departman ?? null)} radius="xl">
                        <Text size="xl" fw={700}>
                          {selectedPersonel.ad[0]}
                          {selectedPersonel.soyad[0]}
                        </Text>
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <Text size="xl" fw={700}>
                          {selectedPersonel.ad} {selectedPersonel.soyad}
                        </Text>
                        <Group gap="xs" mt={4}>
                          <Badge variant="filled" color={getAvatarColor(selectedPersonel.departman ?? null)}>
                            {selectedPersonel.departman || 'Belirsiz'}
                          </Badge>
                          <Badge variant="light" color="gray">
                            {selectedPersonel.pozisyon || 'Pozisyon Yok'}
                          </Badge>
                          {getDurumBadge(selectedPersonel.durum || 'aktif')}
                        </Group>
                        <Text size="sm" c="dimmed" mt={4}>
                          🏢 {selectedProjeData?.ad || 'Proje Atanmamış'} • ⏱️ Kıdem: {kidemStr}
                        </Text>
                        {/* P2: İzin kalan / son ödeme (API'de varsa dolar) */}
                        <Group gap="lg" mt="xs" visibleFrom="xs">
                          <Text size="xs" c="dimmed">
                            İzin kalan:{' '}
                            {(selectedPersonel as { izin_kalan_gun?: number })?.izin_kalan_gun != null
                              ? `${(selectedPersonel as { izin_kalan_gun?: number }).izin_kalan_gun} gün`
                              : '—'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Son ödeme:{' '}
                            {(selectedPersonel as { son_odeme_durumu?: string })?.son_odeme_durumu ?? '—'}
                          </Text>
                        </Group>
                      </div>
                    </Group>
                  </Paper>

                  <SimpleGrid cols={{ base: 1, md: 2 }}>
                    {/* KİŞİSEL BİLGİLER */}
                    <Paper withBorder p="md" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">
                        🪪 Kimlik Bilgileri
                      </Text>
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            TC Kimlik No:
                          </Text>
                          <Text size="sm" fw={500}>
                            {selectedPersonel.tc_kimlik}
                          </Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            SGK No:
                          </Text>
                          <Text size="sm" fw={500}>
                            {selectedPersonel.sgk_no || '-'}
                          </Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            Medeni Durum:
                          </Text>
                          <Text size="sm" fw={500}>
                            {selectedPersonel.medeni_durum === 'evli' ? 'Evli' : 'Bekar'}
                          </Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            Çocuk Sayısı:
                          </Text>
                          <Text size="sm" fw={500}>
                            {selectedPersonel.cocuk_sayisi || 0}
                          </Text>
                        </Group>
                      </Stack>
                    </Paper>

                    {/* İLETİŞİM */}
                    <Paper withBorder p="md" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">
                        📞 İletişim
                      </Text>
                      <Stack gap="xs">
                        <Group gap="xs">
                          <ThemeIcon size="sm" variant="light" color="blue">
                            <IconPhone size={12} />
                          </ThemeIcon>
                          <Text size="sm">{selectedPersonel.telefon || 'Telefon girilmemiş'}</Text>
                        </Group>
                        <Group gap="xs">
                          <ThemeIcon size="sm" variant="light" color="red">
                            <IconMail size={12} />
                          </ThemeIcon>
                          <Text size="sm">{selectedPersonel.email || 'E-posta girilmemiş'}</Text>
                        </Group>
                      </Stack>
                    </Paper>
                  </SimpleGrid>

                  {/* MAAŞ BİLGİLERİ */}
                  <Paper withBorder p="md" radius="md">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">
                      💰 Maaş Bilgileri
                    </Text>
                    <SimpleGrid cols={{ base: 2, md: 4 }}>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Net Maaş (Elden)
                        </Text>
                        <Text size="xl" fw={700} c="green">
                          {formatMoney(selectedPersonel.maas)}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Bordro Maaş (SGK)
                        </Text>
                        <Text size="xl" fw={700} c="orange">
                          {formatMoney(selectedPersonel.bordro_maas || 0)}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Fark (Kayıt Dışı)
                        </Text>
                        <Text size="xl" fw={700} c={maasFark > 0 ? 'red' : 'gray'}>
                          {formatMoney(maasFark)}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Yıllık Maliyet
                        </Text>
                        <Text size="xl" fw={700} c="blue">
                          {formatMoney((selectedPersonel.maas ?? 0) * 12)}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Paper>

                  {/* ÇALIŞMA BİLGİLERİ */}
                  <Paper withBorder p="md" radius="md">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="sm">
                      📋 Çalışma Bilgileri
                    </Text>
                    <SimpleGrid cols={{ base: 2, md: 4 }}>
                      <Box>
                        <Text size="xs" c="dimmed">
                          İşe Giriş Tarihi
                        </Text>
                        <Text size="lg" fw={600}>
                          {formatDate(selectedPersonel.ise_giris_tarihi)}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Kıdem
                        </Text>
                        <Text size="lg" fw={600}>
                          {kidemStr}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Toplam Gün
                        </Text>
                        <Text size="lg" fw={600}>
                          {gunFark.toLocaleString('tr-TR')} gün
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          Yıllık İzin Hakkı
                        </Text>
                        <Text size="lg" fw={600}>
                          {yil >= 5 ? (yil >= 15 ? 26 : 20) : 14} gün
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Paper>

                  <Group justify="flex-end">
                    <Button variant="default" onClick={closeDetailModal}>
                      Kapat
                    </Button>
                    <Button
                      color="violet"
                      leftSection={<IconEdit size={16} />}
                      onClick={() => {
                        closeDetailModal();
                        handleEditPersonel(selectedPersonel);
                      }}
                    >
                      Düzenle
                    </Button>
                  </Group>
                </Stack>
              );
            })()}
        </Modal>

        {/* Personel Ödeme Düzenleme Modal */}
        <Modal
          opened={!!editingOdeme}
          onClose={() => setEditingOdeme(null)}
          title={
            <Text fw={600}>
              💰 Ödeme Düzenle - {editingOdeme?.ad} {editingOdeme?.soyad}
            </Text>
          }
          size="md"
          fullScreen={isMobile}
        >
          <Stack gap="md">
            <NumberInput
              label="Elden Fark (₺)"
              description="Bordro dışı ödenen tutar"
              value={odemeForm.elden_fark}
              onChange={(val) => setOdemeForm({ ...odemeForm, elden_fark: Number(val) || 0 })}
              min={0}
              decimalScale={2}
              thousandSeparator=","
              leftSection="₺"
            />
            <NumberInput
              label="Avans (₺)"
              description="Maaştan düşülecek avans tutarı"
              value={odemeForm.avans}
              onChange={(val) => setOdemeForm({ ...odemeForm, avans: Number(val) || 0 })}
              min={0}
              decimalScale={2}
              thousandSeparator=","
              leftSection="₺"
            />
            <NumberInput
              label="Prim (₺)"
              description="Ek prim ödemesi"
              value={odemeForm.prim}
              onChange={(val) => setOdemeForm({ ...odemeForm, prim: Number(val) || 0 })}
              min={0}
              decimalScale={2}
              thousandSeparator=","
              leftSection="₺"
            />
            <Divider />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Net Ödenecek:{' '}
                <Text component="span" fw={700} c="blue">
                  {formatMoney(
                    (editingOdeme?.bordro_maas || 0) + odemeForm.elden_fark + odemeForm.prim - odemeForm.avans
                  )}
                </Text>
              </Text>
              <Group>
                <Button variant="light" onClick={() => setEditingOdeme(null)}>
                  İptal
                </Button>
                <Button onClick={handleSaveOdeme}>Kaydet</Button>
              </Group>
            </Group>
          </Stack>
        </Modal>

        {/* Tahakkuk Detay Modal */}
        <Modal
          opened={tahakkukDetailOpen}
          onClose={() => setTahakkukDetailOpen(false)}
          title={
            <Text fw={600} size="lg">
              📋 Tahakkuk Detayı - {aylar.find((a) => a.value === bordroAy.toString())?.label} {bordroYil}
            </Text>
          }
          size="xl"
          fullScreen={isMobile}
        >
          {tahakkuk?.exists && (
            <Stack gap="md">
              {/* GİDERLER ve ÖDEMELER */}
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {/* GİDERLER */}
                <Paper withBorder p="md" radius="md" bg={isDark ? 'dark.6' : 'blue.0'}>
                  <Text fw={600} mb="md" c="blue">
                    💰 GİDERLER (İşveren Tarafı)
                  </Text>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm">Aylık Ücretler Toplamı:</Text>
                      <Text size="sm" fw={500}>
                        {formatMoney(tahakkuk.aylik_ucret_toplami || 0)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Fazla Mesai Toplamı:</Text>
                      <Text size="sm" fw={500}>
                        {formatMoney(tahakkuk.fazla_mesai_toplami || 0)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">İşveren SGK Hissesi:</Text>
                      <Text size="sm" fw={500}>
                        {formatMoney(tahakkuk.isveren_sgk_hissesi || 0)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">İşveren İşsizlik:</Text>
                      <Text size="sm" fw={500}>
                        {formatMoney(tahakkuk.isveren_issizlik || 0)}
                      </Text>
                    </Group>
                    <Divider my="xs" />
                    <Group justify="space-between">
                      <Text size="sm" fw={700}>
                        TOPLAM GİDER:
                      </Text>
                      <Text size="lg" fw={700} c="red">
                        {formatMoney(tahakkuk.toplam_gider || 0)}
                      </Text>
                    </Group>
                  </Stack>
                </Paper>

                {/* ÖDEMELER */}
                <Paper withBorder p="md" radius="md" bg={isDark ? 'dark.6' : 'green.0'}>
                  <Text fw={600} mb="md" c="green">
                    📤 ÖDEMELER (Dağıtım)
                  </Text>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm">Ödenecek Net Ücretler:</Text>
                      <Text size="sm" fw={500} c="green">
                        {formatMoney(tahakkuk.odenecek_net_ucret || 0)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Ödenecek SGK Primi:</Text>
                      <Text size="sm" fw={500}>
                        {formatMoney(tahakkuk.odenecek_sgk_primi || 0)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Ödenecek SGD Primi:</Text>
                      <Text size="sm" fw={500}>
                        {formatMoney(tahakkuk.odenecek_sgd_primi || 0)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Ödenecek Gelir Vergisi:</Text>
                      <Text size="sm" fw={500}>
                        {formatMoney(tahakkuk.odenecek_gelir_vergisi || 0)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Ödenecek Damga Vergisi:</Text>
                      <Text size="sm" fw={500}>
                        {formatMoney(tahakkuk.odenecek_damga_vergisi || 0)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Ödenecek İşsizlik:</Text>
                      <Text size="sm" fw={500}>
                        {formatMoney(tahakkuk.odenecek_issizlik || 0)}
                      </Text>
                    </Group>
                    <Divider my="xs" />
                    <Group justify="space-between">
                      <Text size="sm" fw={700}>
                        TOPLAM ÖDEME:
                      </Text>
                      <Text size="lg" fw={700} c="blue">
                        {formatMoney(tahakkuk.toplam_odeme || 0)}
                      </Text>
                    </Group>
                  </Stack>
                </Paper>
              </SimpleGrid>

              {/* SGK PRİMLERİ */}
              <Paper withBorder p="md" radius="md" bg={isDark ? 'dark.6' : 'orange.0'}>
                <Text fw={600} mb="md" c="orange">
                  🏛️ SGK PRİMLERİ
                </Text>
                <SimpleGrid cols={3}>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Toplam SGK Primi
                    </Text>
                    <Text fw={600}>{formatMoney(tahakkuk.toplam_sgk_primi || 0)}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      İndirilecek İşveren Payı
                    </Text>
                    <Text fw={600}>{formatMoney(0)}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Net Ödenecek SGK
                    </Text>
                    <Text fw={700} c="orange">
                      {formatMoney(tahakkuk.net_odenecek_sgk || tahakkuk.toplam_sgk_primi || 0)}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Paper>

              {/* VERGİLER */}
              <Paper withBorder p="md" radius="md" bg={isDark ? 'dark.6' : 'violet.0'}>
                <Text fw={600} mb="md" c="violet">
                  🧾 VERGİLER
                </Text>
                <SimpleGrid cols={3}>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Gelir Vergisi
                    </Text>
                    <Text fw={600}>{formatMoney(tahakkuk.odenecek_gelir_vergisi || 0)}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Damga Vergisi
                    </Text>
                    <Text fw={600}>{formatMoney(tahakkuk.odenecek_damga_vergisi || 0)}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Toplam Vergi
                    </Text>
                    <Text fw={700} c="violet">
                      {formatMoney(
                        parseFloat(String(tahakkuk.odenecek_gelir_vergisi || 0)) +
                          parseFloat(String(tahakkuk.odenecek_damga_vergisi || 0))
                      )}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Paper>

              {tahakkuk.kaynak_dosya && (
                <Text size="xs" c="dimmed" ta="center">
                  📁 Kaynak Dosya: {tahakkuk.kaynak_dosya}
                </Text>
              )}
            </Stack>
          )}
        </Modal>

        {/* Bordro Import Modal */}
        <BordroImportModal
          opened={bordroImportOpen}
          onClose={() => setBordroImportOpen(false)}
          onSuccess={() => {
            fetchBordro();
            setBordroImportOpen(false);
          }}
          defaultProjeId={selectedProje || undefined}
        />
      </Container>
    </Box>
  );
}
