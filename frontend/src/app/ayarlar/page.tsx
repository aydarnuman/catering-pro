'use client';

import { useState, useEffect, Suspense } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Container,
  Title,
  Text,
  Group,
  Stack,
  Paper,
  Avatar,
  Skeleton,
  Badge,
  NavLink,
  Box,
  Divider,
  useMantineColorScheme,
  Switch,
  TextInput,
  Button,
  PasswordInput,
  Select,
  SegmentedControl,
  Slider,
  Alert,
  Card,
  SimpleGrid,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  Modal,
  ColorSwatch,
  CheckIcon,
  ScrollArea,
  rem,
  Loader
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconUser,
  IconPalette,
  IconRobot,
  IconBell,
  IconSettings,
  IconMail,
  IconCalendar,
  IconLock,
  IconLogout,
  IconCheck,
  IconX,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconChevronRight,
  IconShieldLock,
  IconEdit,
  IconKey,
  IconEye,
  IconEyeOff,
  IconInfoCircle,
  IconBellRinging,
  IconMailOpened,
  IconDeviceMobile,
  IconClock,
  IconLanguage,
  IconCalendarEvent,
  IconCurrencyLira,
  IconDatabase,
  IconRefresh,
  IconBuilding,
  IconPhone,
  IconMapPin,
  IconId,
  IconSignature,
  IconSparkles
} from '@tabler/icons-react';
import Link from 'next/link';

// Tip tanımları
interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  accentColor: string;
  compactMode: boolean;
  fontSize: number;
  notifications: {
    email: boolean;
    browser: boolean;
    tenderUpdates: boolean;
    invoiceReminders: boolean;
    weeklyReport: boolean;
  };
  language: string;
  dateFormat: string;
  currency: string;
}

// Firma Bilgileri tipi
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
  posta_kodu?: string;
  telefon: string;
  fax?: string;
  email: string;
  web_sitesi?: string;
  yetkili_adi: string;
  yetkili_unvani: string;
  yetkili_tc?: string;
  yetkili_telefon?: string;
  yetkili_email?: string;
  imza_yetkisi: string;
  banka_adi?: string;
  banka_sube?: string;
  iban?: string;
  hesap_no?: string;
  // Belgeler
  vergi_levhasi_url?: string;
  vergi_levhasi_tarih?: string;
  sicil_gazetesi_url?: string;
  sicil_gazetesi_tarih?: string;
  imza_sirküleri_url?: string;
  imza_sirküleri_tarih?: string;
  faaliyet_belgesi_url?: string;
  faaliyet_belgesi_tarih?: string;
  iso_sertifika_url?: string;
  iso_sertifika_tarih?: string;
  ek_belgeler?: Array<{ ad: string; url: string; tarih?: string }>;
  // Meta
  varsayilan: boolean;
  aktif: boolean;
  notlar?: string;
  created_at?: string;
  updated_at?: string;
}

// Yeni firma için boş şablon
const emptyFirma: Partial<FirmaBilgileri> = {
  unvan: '',
  kisa_ad: '',
  vergi_dairesi: '',
  vergi_no: '',
  ticaret_sicil_no: '',
  mersis_no: '',
  adres: '',
  il: '',
  ilce: '',
  telefon: '',
  fax: '',
  email: '',
  web_sitesi: '',
  yetkili_adi: '',
  yetkili_unvani: '',
  yetkili_tc: '',
  yetkili_telefon: '',
  yetkili_email: '',
  imza_yetkisi: '',
  banka_adi: '',
  banka_sube: '',
  iban: '',
  varsayilan: false,
  aktif: true,
  notlar: '',
};

// Varsayılan tercihler
const defaultPreferences: UserPreferences = {
  theme: 'auto',
  accentColor: 'blue',
  compactMode: false,
  fontSize: 14,
  notifications: {
    email: true,
    browser: true,
    tenderUpdates: true,
    invoiceReminders: true,
    weeklyReport: false
  },
  language: 'tr',
  dateFormat: 'DD.MM.YYYY',
  currency: 'TRY'
};

// Renk seçenekleri
const colorOptions = [
  { color: '#228be6', name: 'Mavi', value: 'blue' },
  { color: '#40c057', name: 'Yeşil', value: 'green' },
  { color: '#7950f2', name: 'Mor', value: 'violet' },
  { color: '#fd7e14', name: 'Turuncu', value: 'orange' },
  { color: '#e64980', name: 'Pembe', value: 'pink' },
  { color: '#15aabf', name: 'Cyan', value: 'cyan' },
  { color: '#fab005', name: 'Sarı', value: 'yellow' },
  { color: '#fa5252', name: 'Kırmızı', value: 'red' },
];

function AyarlarContent() {
  const API_URL = API_BASE_URL;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  
  // Active section
  const [activeSection, setActiveSection] = useState(searchParams.get('section') || 'profil');
  
  // User state
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  
  // Form states
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Firma bilgileri state - çoklu firma desteği (Database)
  const [firmalar, setFirmalar] = useState<FirmaBilgileri[]>([]);
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [firmaModalOpened, { open: openFirmaModal, close: closeFirmaModal }] = useDisclosure(false);
  const [belgeModalOpened, { open: openBelgeModal, close: closeBelgeModal }] = useDisclosure(false);
  const [editingFirma, setEditingFirma] = useState<FirmaBilgileri | null>(null);
  const [firmaFormData, setFirmaFormData] = useState<Partial<FirmaBilgileri>>(emptyFirma);
  const [selectedBelgeTipi, setSelectedBelgeTipi] = useState<string>('');
  const [uploadingBelge, setUploadingBelge] = useState(false);
  const [analyzingBelge, setAnalyzingBelge] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);
  
  // Modal states
  const [passwordModalOpened, { open: openPasswordModal, close: closePasswordModal }] = useDisclosure(false);
  const [logoutModalOpened, { open: openLogoutModal, close: closeLogoutModal }] = useDisclosure(false);

  // Kullanıcı bilgilerini yükle
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setProfileForm({ name: data.user.name || '', email: data.user.email || '' });
          }
        }
      } catch (err) {
        console.error('Kullanıcı bilgisi alınamadı');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
    
    // LocalStorage'dan tercihleri yükle
    const savedPrefs = localStorage.getItem('userPreferences');
    if (savedPrefs) {
      setPreferences({ ...defaultPreferences, ...JSON.parse(savedPrefs) });
    }
    
    // Database'den firmalar listesini yükle
    fetchFirmalar();
  }, [API_URL]);

  // Firmaları API'den yükle
  const fetchFirmalar = async () => {
    try {
      setFirmaLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/firmalar`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFirmalar(data.data || []);
      }
    } catch (err) {
      console.error('Firmalar yüklenemedi:', err);
    } finally {
      setFirmaLoading(false);
    }
  };

  // URL'deki section parametresini takip et
  useEffect(() => {
    const section = searchParams.get('section');
    if (section) {
      setActiveSection(section);
    }
  }, [searchParams]);

  // Tercihleri kaydet
  const savePreferences = (newPrefs: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);
    localStorage.setItem('userPreferences', JSON.stringify(updated));
    notifications.show({
      title: 'Kaydedildi',
      message: 'Tercihleriniz güncellendi',
      color: 'green',
      icon: <IconCheck size={16} />
    });
  };

  // Firma ekleme/düzenleme modalını aç
  const handleOpenFirmaModal = (firma?: FirmaBilgileri) => {
    if (firma) {
      setEditingFirma(firma);
      setFirmaFormData({ ...firma });
    } else {
      setEditingFirma(null);
      setFirmaFormData({ ...emptyFirma, varsayilan: firmalar.length === 0 });
    }
    openFirmaModal();
  };

  // Firma kaydet (ekle veya güncelle) - API
  const handleSaveFirma = async () => {
    if (!firmaFormData.unvan?.trim()) {
      notifications.show({
        title: 'Hata',
        message: 'Firma ünvanı zorunludur',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingFirma 
        ? `${API_URL}/api/firmalar/${editingFirma.id}`
        : `${API_URL}/api/firmalar`;
      
      const res = await fetch(url, {
        method: editingFirma ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(firmaFormData)
      });

      if (res.ok) {
        await fetchFirmalar(); // Listeyi yenile
        closeFirmaModal();
        notifications.show({
          title: 'Kaydedildi',
          message: editingFirma ? 'Firma bilgileri güncellendi' : 'Yeni firma eklendi',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'İşlem başarısız');
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Firma kaydedilemedi',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // Firma sil - API
  const handleDeleteFirma = async (id: number) => {
    if (!confirm('Bu firmayı silmek istediğinize emin misiniz?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/firmalar/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchFirmalar();
        notifications.show({
          title: 'Silindi',
          message: 'Firma silindi',
          color: 'orange',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Hata',
        message: 'Firma silinemedi',
        color: 'red',
      });
    }
  };

  // Varsayılan firmayı değiştir - API
  const handleSetVarsayilan = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/firmalar/${id}/varsayilan`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchFirmalar();
        notifications.show({
          title: 'Güncellendi',
          message: 'Varsayılan firma değiştirildi',
          color: 'green',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Hata',
        message: 'Varsayılan değiştirilemedi',
        color: 'red',
      });
    }
  };

  // Belge yükle
  const handleBelgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingFirma || !selectedBelgeTipi) return;

    setUploadingBelge(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('dosya', file);
      formData.append('belge_tipi', selectedBelgeTipi);
      formData.append('tarih', new Date().toISOString().split('T')[0]);

      const res = await fetch(`${API_URL}/api/firmalar/${editingFirma.id}/belge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        await fetchFirmalar();
        closeBelgeModal();
        notifications.show({
          title: 'Yüklendi',
          message: 'Belge başarıyla yüklendi',
          color: 'green',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Hata',
        message: 'Belge yüklenemedi',
        color: 'red',
      });
    } finally {
      setUploadingBelge(false);
    }
  };

  // Belge tiplerinin Türkçe karşılıkları
  const belgeTipleri = [
    { value: 'vergi_levhasi', label: 'Vergi Levhası' },
    { value: 'sicil_gazetesi', label: 'Ticaret Sicil Gazetesi' },
    { value: 'imza_sirküleri', label: 'İmza Sirküleri' },
    { value: 'faaliyet_belgesi', label: 'Faaliyet Belgesi' },
    { value: 'iso_sertifika', label: 'ISO Sertifikası' },
  ];

  // Belgeden AI ile firma bilgisi çıkar
  const handleBelgeAnaliz = async (file: File, belgeTipi: string) => {
    if (!file || !belgeTipi) return;

    setAnalyzingBelge(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('dosya', file);
      formData.append('belge_tipi', belgeTipi);

      const res = await fetch(`${API_URL}/api/firmalar/analyze-belge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setLastAnalysis(data);
        
        if (data.analiz?.success && data.analiz?.data) {
          // Analiz sonuçlarını forma uygula
          const analizData = data.analiz.data;
          setFirmaFormData(prev => ({
            ...prev,
            unvan: analizData.unvan || prev.unvan,
            vergi_dairesi: analizData.vergi_dairesi || prev.vergi_dairesi,
            vergi_no: analizData.vergi_no || prev.vergi_no,
            ticaret_sicil_no: analizData.ticaret_sicil_no || prev.ticaret_sicil_no,
            mersis_no: analizData.mersis_no || prev.mersis_no,
            adres: analizData.adres || prev.adres,
            il: analizData.il || prev.il,
            ilce: analizData.ilce || prev.ilce,
            telefon: analizData.telefon || prev.telefon,
            yetkili_adi: analizData.yetkili_adi || prev.yetkili_adi,
            yetkili_tc: analizData.yetkili_tc || prev.yetkili_tc,
            yetkili_unvani: analizData.yetkili_unvani || prev.yetkili_unvani,
            imza_yetkisi: analizData.imza_yetkisi || prev.imza_yetkisi,
          }));

          notifications.show({
            title: '✨ AI Analiz Tamamlandı',
            message: `${data.analiz.belgeTipiAd} analiz edildi. Form otomatik dolduruldu.`,
            color: 'green',
            autoClose: 5000,
          });
        } else {
          notifications.show({
            title: 'Analiz Tamamlandı',
            message: 'Belge okundu ancak bazı bilgiler çıkarılamadı. Manuel kontrol edin.',
            color: 'yellow',
          });
        }
      }
    } catch (err) {
      notifications.show({
        title: 'Hata',
        message: 'Belge analiz edilemedi',
        color: 'red',
      });
    } finally {
      setAnalyzingBelge(false);
    }
  };

  // Tema değiştir
  const handleThemeChange = (value: string) => {
    if (value === 'auto') {
      setColorScheme('auto');
    } else {
      setColorScheme(value as 'light' | 'dark');
    }
    savePreferences({ theme: value as 'light' | 'dark' | 'auto' });
  };

  // Profil güncelle
  const handleProfileSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileForm)
      });
      
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        notifications.show({
          title: 'Başarılı',
          message: 'Profil bilgileriniz güncellendi',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        throw new Error('Güncelleme başarısız');
      }
    } catch (err) {
      notifications.show({
        title: 'Hata',
        message: 'Profil güncellenirken bir hata oluştu',
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setSaving(false);
    }
  };

  // Şifre değiştir
  const handlePasswordChange = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      notifications.show({
        title: 'Hata',
        message: 'Yeni şifreler eşleşmiyor',
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }
    
    if (passwordForm.new.length < 6) {
      notifications.show({
        title: 'Hata',
        message: 'Şifre en az 6 karakter olmalı',
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new
        })
      });
      
      if (res.ok) {
        notifications.show({
          title: 'Başarılı',
          message: 'Şifreniz değiştirildi',
          color: 'green',
          icon: <IconCheck size={16} />
        });
        closePasswordModal();
        setPasswordForm({ current: '', new: '', confirm: '' });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Şifre değiştirilemedi');
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message || 'Şifre değiştirilirken bir hata oluştu',
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setSaving(false);
    }
  };

  // Çıkış yap
  const handleLogout = () => {
    localStorage.removeItem('token');
    notifications.show({
      title: 'Çıkış Yapıldı',
      message: 'Güvenli bir şekilde çıkış yaptınız',
      color: 'blue',
      icon: <IconLogout size={16} />
    });
    router.push('/');
  };

  // Menü öğeleri
  const menuItems = [
    { id: 'profil', label: 'Profil', icon: IconUser, color: 'blue', description: 'Hesap bilgileri' },
    { id: 'firma', label: 'Firma Bilgileri', icon: IconBuilding, color: 'teal', description: 'Şirket bilgileri' },
    { id: 'gorunum', label: 'Görünüm', icon: IconPalette, color: 'pink', description: 'Tema ve arayüz' },
    { id: 'bildirimler', label: 'Bildirimler', icon: IconBell, color: 'orange', description: 'Uyarı tercihleri' },
    { id: 'ai', label: 'AI Ayarları', icon: IconRobot, color: 'violet', description: 'Yapay zeka', href: '/ayarlar/ai' },
    { id: 'sistem', label: 'Sistem', icon: IconSettings, color: 'gray', description: 'Genel tercihler' },
  ];

  // İçerik render
  const renderContent = () => {
    switch (activeSection) {
      case 'profil':
        return (
          <Stack gap="lg">
            <div>
              <Title order={3} mb={4}>👤 Profil Ayarları</Title>
              <Text c="dimmed" size="sm">Hesap bilgilerinizi yönetin</Text>
            </div>

            {/* Kullanıcı Kartı */}
            <Paper p="lg" radius="md" withBorder>
              <Group>
                {loading ? (
                  <>
                    <Skeleton circle height={80} />
                    <div style={{ flex: 1 }}>
                      <Skeleton height={24} width={200} mb={8} />
                      <Skeleton height={16} width={250} />
                    </div>
                  </>
                ) : user ? (
                  <>
                    <Avatar size={80} radius="xl" color="blue" variant="filled">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                    <div style={{ flex: 1 }}>
                      <Group justify="space-between">
                        <div>
                          <Text fw={700} size="xl">{user.name}</Text>
                          <Group gap="xs" mt={4}>
                            <IconMail size={14} color="var(--mantine-color-dimmed)" />
                            <Text size="sm" c="dimmed">{user.email}</Text>
                          </Group>
                          {user.created_at && (
                            <Group gap="xs" mt={4}>
                              <IconCalendar size={14} color="var(--mantine-color-dimmed)" />
                              <Text size="xs" c="dimmed">
                                Üyelik: {new Date(user.created_at).toLocaleDateString('tr-TR')}
                              </Text>
                            </Group>
                          )}
                        </div>
                        <Badge 
                          size="lg"
                          color={user.role === 'admin' ? 'red' : 'blue'} 
                          variant="light"
                          leftSection={user.role === 'admin' ? <IconShieldLock size={14} /> : null}
                        >
                          {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                        </Badge>
                      </Group>
                    </div>
                  </>
                ) : (
                  <Alert icon={<IconInfoCircle size={16} />} color="yellow" w="100%">
                    Profil bilgilerini görmek için giriş yapın
                  </Alert>
                )}
              </Group>
            </Paper>

            {user && (
              <>
                {/* Profil Düzenleme */}
                <Paper p="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text fw={600}>Profil Bilgileri</Text>
                      <IconEdit size={18} color="var(--mantine-color-dimmed)" />
                    </Group>
                    <Divider />
                    <TextInput
                      label="Ad Soyad"
                      placeholder="Adınızı girin"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.currentTarget.value })}
                      leftSection={<IconUser size={16} />}
                    />
                    <TextInput
                      label="E-posta"
                      placeholder="E-posta adresiniz"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.currentTarget.value })}
                      leftSection={<IconMail size={16} />}
                      disabled
                      description="E-posta değiştirmek için yöneticiyle iletişime geçin"
                    />
                    <Group justify="flex-end">
                      <Button 
                        onClick={handleProfileSave} 
                        loading={saving}
                        leftSection={<IconCheck size={16} />}
                      >
                        Kaydet
                      </Button>
                    </Group>
                  </Stack>
                </Paper>

                {/* Güvenlik */}
                <Paper p="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text fw={600}>Güvenlik</Text>
                      <IconLock size={18} color="var(--mantine-color-dimmed)" />
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>Şifre</Text>
                        <Text size="xs" c="dimmed">Hesabınızın güvenliği için güçlü bir şifre kullanın</Text>
                      </div>
                      <Button 
                        variant="light" 
                        leftSection={<IconKey size={16} />}
                        onClick={openPasswordModal}
                      >
                        Şifre Değiştir
                      </Button>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>Oturumu Kapat</Text>
                        <Text size="xs" c="dimmed">Tüm cihazlardan çıkış yapın</Text>
                      </div>
                      <Button 
                        variant="light" 
                        color="red"
                        leftSection={<IconLogout size={16} />}
                        onClick={openLogoutModal}
                      >
                        Çıkış Yap
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              </>
            )}
          </Stack>
        );

      case 'firma':
        return (
          <Stack gap="lg">
            <div>
              <Title order={3} mb={4}>🏢 Firma Bilgileri</Title>
              <Text c="dimmed" size="sm">
                Birden fazla firma ekleyebilir, belgelerini yükleyebilir ve İhale Uzmanı sayfasında dilekçe hazırlarken seçebilirsiniz.
              </Text>
            </div>

            {/* Firma Ekle Butonu */}
            <Group justify="space-between">
              <Text fw={600} size="sm">Kayıtlı Firmalar ({firmalar.length})</Text>
              <Button
                leftSection={<IconBuilding size={16} />}
                onClick={() => handleOpenFirmaModal()}
                color="teal"
                loading={firmaLoading}
              >
                Yeni Firma Ekle
              </Button>
            </Group>

            {/* Firma Listesi */}
            {firmaLoading ? (
              <Paper p="xl" radius="md" withBorder ta="center">
                <Skeleton height={100} />
              </Paper>
            ) : firmalar.length === 0 ? (
              <Paper p="xl" radius="md" withBorder ta="center">
                <IconBuilding size={48} color="var(--mantine-color-gray-5)" style={{ marginBottom: 16 }} />
                <Text c="dimmed" mb="md">Henüz firma eklenmemiş</Text>
                <Button
                  variant="light"
                  color="teal"
                  leftSection={<IconBuilding size={16} />}
                  onClick={() => handleOpenFirmaModal()}
                >
                  İlk Firmayı Ekle
                </Button>
              </Paper>
            ) : (
              <Stack gap="md">
                {firmalar.map((firma) => (
                  <Paper key={firma.id} p="md" radius="md" withBorder style={{
                    borderColor: firma.varsayilan ? 'var(--mantine-color-teal-5)' : undefined,
                    background: firma.varsayilan ? 'rgba(0, 166, 125, 0.03)' : undefined,
                  }}>
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="md" style={{ flex: 1, minWidth: 0 }}>
                        <ThemeIcon size="lg" radius="md" variant="light" color={firma.varsayilan ? 'teal' : 'gray'}>
                          <IconBuilding size={20} />
                        </ThemeIcon>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Group gap="xs">
                            <Text fw={600} truncate>{firma.unvan}</Text>
                            {firma.varsayilan && (
                              <Badge size="xs" color="teal" variant="filled">Varsayılan</Badge>
                            )}
                          </Group>
                          <Group gap="xs" mt={4}>
                            {firma.vergi_no && (
                              <Text size="xs" c="dimmed">VKN: {firma.vergi_no}</Text>
                            )}
                            {firma.yetkili_adi && (
                              <Text size="xs" c="dimmed">• {firma.yetkili_adi}</Text>
                            )}
                          </Group>
                          {/* Belge göstergeleri */}
                          <Group gap={4} mt={6}>
                            {firma.vergi_levhasi_url && <Badge size="xs" variant="dot" color="green">Vergi Levhası</Badge>}
                            {firma.sicil_gazetesi_url && <Badge size="xs" variant="dot" color="green">Sicil Gazetesi</Badge>}
                            {firma.imza_sirküleri_url && <Badge size="xs" variant="dot" color="green">İmza Sirküleri</Badge>}
                          </Group>
                        </div>
                      </Group>
                      <Group gap="xs">
                        {!firma.varsayilan && (
                          <Tooltip label="Varsayılan Yap">
                            <ActionIcon 
                              variant="light" 
                              color="teal"
                              onClick={() => handleSetVarsayilan(firma.id)}
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="Düzenle">
                          <ActionIcon 
                            variant="light" 
                            color="blue"
                            onClick={() => handleOpenFirmaModal(firma)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Sil">
                          <ActionIcon 
                            variant="light" 
                            color="red"
                            onClick={() => handleDeleteFirma(firma.id)}
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}

            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              <Text size="sm">
                <strong>Varsayılan firma</strong> İhale Uzmanı sayfasında otomatik seçilir. 
                Dilekçe hazırlarken dropdown'dan farklı bir firma da seçebilirsiniz.
              </Text>
            </Alert>

            {/* Firma Ekleme/Düzenleme Modalı - Genişletilmiş */}
            <Modal
              opened={firmaModalOpened}
              onClose={closeFirmaModal}
              title={
                <Group gap="sm">
                  <ThemeIcon size="md" radius="md" variant="light" color="teal">
                    <IconBuilding size={16} />
                  </ThemeIcon>
                  <Text fw={600}>{editingFirma ? 'Firma Düzenle' : 'Yeni Firma Ekle'}</Text>
                </Group>
              }
              size="xl"
              centered
            >
              <ScrollArea h={500} type="auto" offsetScrollbars>
                <Stack gap="md" pr="sm">
                  {/* Belgeden Tanı - AI ile Otomatik Doldurma */}
                  {!editingFirma && (
                    <Paper p="md" radius="md" withBorder style={{ background: 'linear-gradient(135deg, rgba(64,192,87,0.05) 0%, rgba(34,139,230,0.05) 100%)' }}>
                      <Stack gap="sm">
                        <Group gap="xs">
                          <ThemeIcon size="sm" variant="light" color="green">
                            <IconSparkles size={14} />
                          </ThemeIcon>
                          <Text fw={600} size="sm">🤖 Belgeden Tanı (AI)</Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          Vergi levhası, sicil gazetesi veya imza sirküleri yükleyin - AI bilgileri otomatik çıkarsın.
                        </Text>
                        <SimpleGrid cols={{ base: 2, sm: 3 }}>
                          {belgeTipleri.slice(0, 3).map((belge) => (
                            <Paper key={belge.value} p="xs" radius="md" withBorder style={{ cursor: 'pointer' }}>
                              <Stack gap={4} align="center">
                                <Text size="xs" fw={500} ta="center">{belge.label}</Text>
                                <label style={{ cursor: 'pointer' }}>
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleBelgeAnaliz(file, belge.value);
                                    }}
                                    disabled={analyzingBelge}
                                  />
                                  <Badge 
                                    size="xs" 
                                    variant="light" 
                                    color="blue" 
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {analyzingBelge ? 'Analiz...' : '📄 Yükle'}
                                  </Badge>
                                </label>
                              </Stack>
                            </Paper>
                          ))}
                        </SimpleGrid>
                        {analyzingBelge && (
                          <Group gap="xs">
                            <Loader size="xs" />
                            <Text size="xs" c="dimmed">AI belgeyi analiz ediyor...</Text>
                          </Group>
                        )}
                        {lastAnalysis?.analiz?.success && (
                          <Alert color="green" variant="light" p="xs">
                            <Text size="xs">✅ {lastAnalysis.analiz.belgeTipiAd} analiz edildi. Güven: {Math.round((lastAnalysis.analiz.data?.guven_skoru || 0.85) * 100)}%</Text>
                          </Alert>
                        )}
                      </Stack>
                    </Paper>
                  )}

                  <Divider label="veya manuel girin" labelPosition="center" />

                  {/* Temel Bilgiler */}
                  <Text fw={600} size="sm" c="dimmed">TEMEL BİLGİLER</Text>
                  
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="Firma Ünvanı"
                      placeholder="ABC Yemek Hizmetleri Ltd. Şti."
                      value={firmaFormData.unvan || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, unvan: e.currentTarget.value })}
                      leftSection={<IconBuilding size={16} />}
                      required
                    />
                    <TextInput
                      label="Kısa Ad"
                      placeholder="ABC Yemek"
                      value={firmaFormData.kisa_ad || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, kisa_ad: e.currentTarget.value })}
                    />
                  </SimpleGrid>
                  
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TextInput
                      label="Vergi Dairesi"
                      placeholder="Ankara Kurumlar"
                      value={firmaFormData.vergi_dairesi || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, vergi_dairesi: e.currentTarget.value })}
                      leftSection={<IconId size={16} />}
                    />
                    <TextInput
                      label="Vergi No"
                      placeholder="1234567890"
                      value={firmaFormData.vergi_no || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, vergi_no: e.currentTarget.value })}
                      leftSection={<IconId size={16} />}
                    />
                    <TextInput
                      label="MERSİS No"
                      placeholder="0123456789012345"
                      value={firmaFormData.mersis_no || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, mersis_no: e.currentTarget.value })}
                    />
                  </SimpleGrid>

                  <TextInput
                    label="Ticaret Sicil No"
                    placeholder="123456"
                    value={firmaFormData.ticaret_sicil_no || ''}
                    onChange={(e) => setFirmaFormData({ ...firmaFormData, ticaret_sicil_no: e.currentTarget.value })}
                  />

                  <Divider label="İletişim" labelPosition="center" />

                  <TextInput
                    label="Adres"
                    placeholder="Firma adresi"
                    value={firmaFormData.adres || ''}
                    onChange={(e) => setFirmaFormData({ ...firmaFormData, adres: e.currentTarget.value })}
                    leftSection={<IconMapPin size={16} />}
                  />
                  
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TextInput
                      label="İl"
                      placeholder="Ankara"
                      value={firmaFormData.il || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, il: e.currentTarget.value })}
                    />
                    <TextInput
                      label="İlçe"
                      placeholder="Çankaya"
                      value={firmaFormData.ilce || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, ilce: e.currentTarget.value })}
                    />
                    <TextInput
                      label="Telefon"
                      placeholder="0312 XXX XX XX"
                      value={firmaFormData.telefon || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, telefon: e.currentTarget.value })}
                      leftSection={<IconPhone size={16} />}
                    />
                  </SimpleGrid>
                  
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="E-posta"
                      placeholder="info@firma.com.tr"
                      value={firmaFormData.email || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, email: e.currentTarget.value })}
                      leftSection={<IconMail size={16} />}
                    />
                    <TextInput
                      label="Web Sitesi"
                      placeholder="www.firma.com.tr"
                      value={firmaFormData.web_sitesi || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, web_sitesi: e.currentTarget.value })}
                    />
                  </SimpleGrid>

                  <Divider label="Yetkili Bilgileri" labelPosition="center" />
                  
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="Yetkili Adı Soyadı"
                      placeholder="Ad Soyad"
                      value={firmaFormData.yetkili_adi || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, yetkili_adi: e.currentTarget.value })}
                      leftSection={<IconUser size={16} />}
                    />
                    <TextInput
                      label="Yetkili Unvanı"
                      placeholder="Şirket Müdürü"
                      value={firmaFormData.yetkili_unvani || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, yetkili_unvani: e.currentTarget.value })}
                      leftSection={<IconId size={16} />}
                    />
                  </SimpleGrid>

                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="Yetkili TC Kimlik No"
                      placeholder="12345678901"
                      value={firmaFormData.yetkili_tc || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, yetkili_tc: e.currentTarget.value })}
                    />
                    <TextInput
                      label="Yetkili Telefon"
                      placeholder="0532 XXX XX XX"
                      value={firmaFormData.yetkili_telefon || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, yetkili_telefon: e.currentTarget.value })}
                    />
                  </SimpleGrid>
                  
                  <TextInput
                    label="İmza Yetkisi Açıklaması"
                    placeholder="Şirketi her türlü konuda temsile yetkilidir"
                    value={firmaFormData.imza_yetkisi || ''}
                    onChange={(e) => setFirmaFormData({ ...firmaFormData, imza_yetkisi: e.currentTarget.value })}
                    leftSection={<IconSignature size={16} />}
                  />

                  <Divider label="Banka Bilgileri" labelPosition="center" />
                  
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="Banka Adı"
                      placeholder="Ziraat Bankası"
                      value={firmaFormData.banka_adi || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, banka_adi: e.currentTarget.value })}
                    />
                    <TextInput
                      label="Şube"
                      placeholder="Kızılay Şubesi"
                      value={firmaFormData.banka_sube || ''}
                      onChange={(e) => setFirmaFormData({ ...firmaFormData, banka_sube: e.currentTarget.value })}
                    />
                  </SimpleGrid>

                  <TextInput
                    label="IBAN"
                    placeholder="TR00 0000 0000 0000 0000 0000 00"
                    value={firmaFormData.iban || ''}
                    onChange={(e) => setFirmaFormData({ ...firmaFormData, iban: e.currentTarget.value })}
                  />

                  {/* Belgeler - Sadece düzenleme modunda */}
                  {editingFirma && (
                    <>
                      <Divider label="Belgeler" labelPosition="center" />
                      
                      <SimpleGrid cols={{ base: 2, sm: 3 }}>
                        {belgeTipleri.map((belge) => {
                          const urlKey = `${belge.value}_url` as keyof FirmaBilgileri;
                          const hasFile = editingFirma[urlKey];
                          return (
                            <Paper key={belge.value} p="sm" radius="md" withBorder>
                              <Stack gap="xs">
                                <Text size="xs" fw={500}>{belge.label}</Text>
                                {hasFile ? (
                                  <Group gap="xs">
                                    <Badge size="xs" color="green" variant="light">Yüklü</Badge>
                                    <ActionIcon 
                                      size="xs" 
                                      variant="subtle" 
                                      component="a" 
                                      href={`${API_URL}${hasFile}`} 
                                      target="_blank"
                                    >
                                      <IconEye size={12} />
                                    </ActionIcon>
                                  </Group>
                                ) : (
                                  <Button 
                                    size="xs" 
                                    variant="light"
                                    onClick={() => {
                                      setSelectedBelgeTipi(belge.value);
                                      openBelgeModal();
                                    }}
                                  >
                                    Yükle
                                  </Button>
                                )}
                              </Stack>
                            </Paper>
                          );
                        })}
                      </SimpleGrid>
                    </>
                  )}

                  <Divider />

                  <Switch
                    label="Varsayılan firma olarak ayarla"
                    description="İhale Uzmanı sayfasında otomatik seçilir"
                    checked={firmaFormData.varsayilan || false}
                    onChange={(e) => setFirmaFormData({ ...firmaFormData, varsayilan: e.currentTarget.checked })}
                    color="teal"
                  />

                  <Group justify="flex-end" mt="md">
                    <Button variant="light" onClick={closeFirmaModal}>İptal</Button>
                    <Button color="teal" onClick={handleSaveFirma} loading={saving} leftSection={<IconCheck size={16} />}>
                      {editingFirma ? 'Güncelle' : 'Ekle'}
                    </Button>
                  </Group>
                </Stack>
              </ScrollArea>
            </Modal>

            {/* Belge Yükleme Modalı */}
            <Modal
              opened={belgeModalOpened}
              onClose={closeBelgeModal}
              title="Belge Yükle"
              size="sm"
              centered
            >
              <Stack gap="md">
                <Text size="sm">
                  <strong>{belgeTipleri.find(b => b.value === selectedBelgeTipi)?.label}</strong> yükleyin
                </Text>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleBelgeUpload}
                  disabled={uploadingBelge}
                />
                {uploadingBelge && <Text size="xs" c="dimmed">Yükleniyor...</Text>}
              </Stack>
            </Modal>
          </Stack>
        );

      case 'gorunum':
        return (
          <Stack gap="lg">
            <div>
              <Title order={3} mb={4}>🎨 Görünüm Ayarları</Title>
              <Text c="dimmed" size="sm">Arayüz tercihlerinizi özelleştirin</Text>
            </div>

            {/* Tema Seçimi */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600}>Tema</Text>
                  {colorScheme === 'dark' ? <IconMoon size={18} /> : <IconSun size={18} />}
                </Group>
                <Divider />
                <SegmentedControl
                  value={preferences.theme}
                  onChange={handleThemeChange}
                  fullWidth
                  data={[
                    { 
                      label: (
                        <Group gap="xs" justify="center">
                          <IconSun size={16} />
                          <span>Açık</span>
                        </Group>
                      ), 
                      value: 'light' 
                    },
                    { 
                      label: (
                        <Group gap="xs" justify="center">
                          <IconMoon size={16} />
                          <span>Koyu</span>
                        </Group>
                      ), 
                      value: 'dark' 
                    },
                    { 
                      label: (
                        <Group gap="xs" justify="center">
                          <IconDeviceDesktop size={16} />
                          <span>Sistem</span>
                        </Group>
                      ), 
                      value: 'auto' 
                    },
                  ]}
                />
              </Stack>
            </Paper>

            {/* Accent Renk */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600}>Ana Renk</Text>
                  <ColorSwatch color={colorOptions.find(c => c.value === preferences.accentColor)?.color || '#228be6'} size={20} />
                </Group>
                <Divider />
                <Group gap="xs">
                  {colorOptions.map((option) => (
                    <Tooltip key={option.value} label={option.name}>
                      <ColorSwatch
                        color={option.color}
                        onClick={() => savePreferences({ accentColor: option.value })}
                        style={{ cursor: 'pointer' }}
                        size={36}
                      >
                        {preferences.accentColor === option.value && (
                          <IconCheck size={18} color="white" />
                        )}
                      </ColorSwatch>
                    </Tooltip>
                  ))}
                </Group>
              </Stack>
            </Paper>

            {/* Görünüm Seçenekleri */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Text fw={600}>Görünüm Seçenekleri</Text>
                <Divider />
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500}>Kompakt Mod</Text>
                    <Text size="xs" c="dimmed">Daha az boşluk, daha fazla içerik</Text>
                  </div>
                  <Switch
                    checked={preferences.compactMode}
                    onChange={(e) => savePreferences({ compactMode: e.currentTarget.checked })}
                  />
                </Group>
                <Divider />
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>Yazı Boyutu</Text>
                    <Text size="sm" c="dimmed">{preferences.fontSize}px</Text>
                  </Group>
                  <Slider
                    value={preferences.fontSize}
                    onChange={(value) => setPreferences({ ...preferences, fontSize: value })}
                    onChangeEnd={(value) => savePreferences({ fontSize: value })}
                    min={12}
                    max={18}
                    step={1}
                    marks={[
                      { value: 12, label: 'Küçük' },
                      { value: 14, label: 'Normal' },
                      { value: 16, label: 'Büyük' },
                      { value: 18, label: 'Çok Büyük' },
                    ]}
                  />
                </div>
              </Stack>
            </Paper>
          </Stack>
        );

      case 'bildirimler':
        return (
          <Stack gap="lg">
            <div>
              <Title order={3} mb={4}>🔔 Bildirim Ayarları</Title>
              <Text c="dimmed" size="sm">Hangi bildirimleri almak istediğinizi seçin</Text>
            </div>

            {/* E-posta Bildirimleri */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="blue" size="lg">
                      <IconMailOpened size={18} />
                    </ThemeIcon>
                    <Text fw={600}>E-posta Bildirimleri</Text>
                  </Group>
                  <Switch
                    checked={preferences.notifications.email}
                    onChange={(e) => savePreferences({ 
                      notifications: { ...preferences.notifications, email: e.currentTarget.checked }
                    })}
                  />
                </Group>
                <Text size="xs" c="dimmed">Önemli güncellemeler için e-posta alın</Text>
              </Stack>
            </Paper>

            {/* Tarayıcı Bildirimleri */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="violet" size="lg">
                      <IconBellRinging size={18} />
                    </ThemeIcon>
                    <Text fw={600}>Tarayıcı Bildirimleri</Text>
                  </Group>
                  <Switch
                    checked={preferences.notifications.browser}
                    onChange={(e) => savePreferences({ 
                      notifications: { ...preferences.notifications, browser: e.currentTarget.checked }
                    })}
                  />
                </Group>
                <Text size="xs" c="dimmed">Masaüstü bildirimleri alın (tarayıcı izni gerekli)</Text>
              </Stack>
            </Paper>

            {/* Bildirim Kategorileri */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Text fw={600}>Bildirim Kategorileri</Text>
                <Divider />
                
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500}>İhale Güncellemeleri</Text>
                    <Text size="xs" c="dimmed">Yeni ihaleler ve durum değişiklikleri</Text>
                  </div>
                  <Switch
                    checked={preferences.notifications.tenderUpdates}
                    onChange={(e) => savePreferences({ 
                      notifications: { ...preferences.notifications, tenderUpdates: e.currentTarget.checked }
                    })}
                  />
                </Group>
                
                <Divider />
                
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500}>Fatura Hatırlatıcıları</Text>
                    <Text size="xs" c="dimmed">Yaklaşan ödeme tarihleri</Text>
                  </div>
                  <Switch
                    checked={preferences.notifications.invoiceReminders}
                    onChange={(e) => savePreferences({ 
                      notifications: { ...preferences.notifications, invoiceReminders: e.currentTarget.checked }
                    })}
                  />
                </Group>
                
                <Divider />
                
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500}>Haftalık Özet Raporu</Text>
                    <Text size="xs" c="dimmed">Haftanın özeti e-posta ile</Text>
                  </div>
                  <Switch
                    checked={preferences.notifications.weeklyReport}
                    onChange={(e) => savePreferences({ 
                      notifications: { ...preferences.notifications, weeklyReport: e.currentTarget.checked }
                    })}
                  />
                </Group>
              </Stack>
            </Paper>
          </Stack>
        );

      case 'sistem':
        return (
          <Stack gap="lg">
            <div>
              <Title order={3} mb={4}>⚙️ Sistem Ayarları</Title>
              <Text c="dimmed" size="sm">Genel tercihler ve bölgesel ayarlar</Text>
            </div>

            {/* Bölgesel Ayarlar */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600}>Bölgesel Ayarlar</Text>
                  <IconLanguage size={18} color="var(--mantine-color-dimmed)" />
                </Group>
                <Divider />
                
                <Select
                  label="Dil"
                  value={preferences.language}
                  onChange={(value) => savePreferences({ language: value || 'tr' })}
                  data={[
                    { value: 'tr', label: '🇹🇷 Türkçe' },
                    { value: 'en', label: '🇬🇧 English (Yakında)' },
                  ]}
                  leftSection={<IconLanguage size={16} />}
                />
                
                <Select
                  label="Tarih Formatı"
                  value={preferences.dateFormat}
                  onChange={(value) => savePreferences({ dateFormat: value || 'DD.MM.YYYY' })}
                  data={[
                    { value: 'DD.MM.YYYY', label: '31.12.2024' },
                    { value: 'DD/MM/YYYY', label: '31/12/2024' },
                    { value: 'YYYY-MM-DD', label: '2024-12-31' },
                    { value: 'MM/DD/YYYY', label: '12/31/2024' },
                  ]}
                  leftSection={<IconCalendarEvent size={16} />}
                />
                
                <Select
                  label="Para Birimi"
                  value={preferences.currency}
                  onChange={(value) => savePreferences({ currency: value || 'TRY' })}
                  data={[
                    { value: 'TRY', label: '₺ Türk Lirası (TRY)' },
                    { value: 'USD', label: '$ Amerikan Doları (USD)' },
                    { value: 'EUR', label: '€ Euro (EUR)' },
                  ]}
                  leftSection={<IconCurrencyLira size={16} />}
                />
              </Stack>
            </Paper>

            {/* Uygulama Ayarları */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Text fw={600}>Uygulama Ayarları</Text>
                <Divider />
                
                <Select
                  label="Sayfa Başına Kayıt"
                  description="Listelerde kaç kayıt gösterilsin"
                  defaultValue="20"
                  data={[
                    { value: '10', label: '10 kayıt' },
                    { value: '20', label: '20 kayıt' },
                    { value: '50', label: '50 kayıt' },
                    { value: '100', label: '100 kayıt' },
                  ]}
                />
                
                <Select
                  label="Otomatik Oturum Kapatma"
                  description="İşlem yapılmadığında oturumu kapat"
                  defaultValue="never"
                  data={[
                    { value: 'never', label: 'Hiçbir zaman' },
                    { value: '30', label: '30 dakika' },
                    { value: '60', label: '1 saat' },
                    { value: '120', label: '2 saat' },
                  ]}
                  leftSection={<IconClock size={16} />}
                />
              </Stack>
            </Paper>

            {/* Sistem Bilgisi */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600}>Sistem Bilgisi</Text>
                  <Badge variant="light" color="blue">v1.0.0</Badge>
                </Group>
                <Divider />
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <div>
                    <Text size="xs" c="dimmed">Backend</Text>
                    <Text size="sm">{API_URL}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Ortam</Text>
                    <Text size="sm">{process.env.NODE_ENV}</Text>
                  </div>
                </SimpleGrid>
                <Button 
                  variant="light" 
                  leftSection={<IconDatabase size={16} />}
                  component={Link}
                  href="/admin/sistem"
                >
                  Detaylı Sistem Bilgisi
                </Button>
              </Stack>
            </Paper>

            {/* Admin Panel */}
            {user?.role === 'admin' && (
              <Paper p="lg" radius="md" withBorder style={{ background: 'var(--mantine-color-red-light)' }}>
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="red" variant="filled" size="lg">
                      <IconShieldLock size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Admin Panel</Text>
                      <Text size="xs" c="dimmed">Sistem yönetimi ve kullanıcı kontrolü</Text>
                    </div>
                  </Group>
                  <Button 
                    color="red" 
                    variant="light"
                    rightSection={<IconChevronRight size={16} />}
                    component={Link}
                    href="/admin"
                  >
                    Panele Git
                  </Button>
                </Group>
              </Paper>
            )}
          </Stack>
        );

      default:
        return null;
    }
  };

  return (
    <Container size="xl" py="xl" style={{ overflow: 'hidden' }}>
      <Stack gap="xl" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={1} size="h2" mb={4}>⚙️ Ayarlar</Title>
            <Text c="dimmed">Hesap ve uygulama tercihlerinizi yönetin</Text>
          </div>
          <Badge size="lg" variant="light" color="blue">v1.0.0</Badge>
        </Group>

        {/* Main Content */}
        <Box 
          style={{ 
            display: 'flex', 
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 'var(--mantine-spacing-xl)',
            minHeight: '60vh',
            flexWrap: 'wrap',
          }}
          className="settings-main-content"
        >
          {/* Sidebar */}
          <Paper 
            p="md" 
            radius="md" 
            withBorder 
            w={280} 
            style={{ position: 'sticky', top: 80, flexShrink: 0 }}
            visibleFrom="md"
          >
            <Stack gap="xs">
              {/* User Mini Card */}
              {user && (
                <>
                  <Group gap="sm" p="sm">
                    <Avatar size={40} radius="xl" color="blue">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <Text size="sm" fw={600} truncate>{user.name}</Text>
                      <Text size="xs" c="dimmed" truncate>{user.email}</Text>
                    </div>
                  </Group>
                  <Divider />
                </>
              )}
              
              {/* Nav Links */}
              {menuItems.map((item) => (
                item.href ? (
                  <NavLink
                    key={item.id}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    description={item.description}
                    leftSection={
                      <ThemeIcon variant="light" color={item.color} size="md">
                        <item.icon size={16} />
                      </ThemeIcon>
                    }
                    rightSection={<IconChevronRight size={14} />}
                    style={{ borderRadius: 8 }}
                  />
                ) : (
                  <NavLink
                    key={item.id}
                    label={item.label}
                    description={item.description}
                    leftSection={
                      <ThemeIcon variant="light" color={item.color} size="md">
                        <item.icon size={16} />
                      </ThemeIcon>
                    }
                    active={activeSection === item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      router.push(`/ayarlar?section=${item.id}`);
                    }}
                    style={{ borderRadius: 8 }}
                  />
                )
              ))}
            </Stack>
          </Paper>

          {/* Mobile Tabs */}
          <Box hiddenFrom="md" w="100%" style={{ overflow: 'hidden' }}>
            <Paper p="xs" radius="md" withBorder mb="md">
              <ScrollArea type="scroll" offsetScrollbars scrollbarSize={4}>
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 'max-content' }}>
                  {menuItems.filter(m => !m.href).map((item) => (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? 'filled' : 'subtle'}
                      color={item.color}
                      size="sm"
                      leftSection={<item.icon size={16} />}
                      onClick={() => {
                        setActiveSection(item.id);
                        router.push(`/ayarlar?section=${item.id}`);
                      }}
                      style={{ flexShrink: 0 }}
                    >
                      {item.label}
                    </Button>
                  ))}
                  <Button
                    variant="subtle"
                    color="violet"
                    size="sm"
                    leftSection={<IconRobot size={16} />}
                    component={Link}
                    href="/ayarlar/ai"
                    style={{ flexShrink: 0 }}
                  >
                    AI
                  </Button>
                </Group>
              </ScrollArea>
            </Paper>
          </Box>

          {/* Content */}
          <Box style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            {renderContent()}
          </Box>
        </Box>
      </Stack>

      {/* Şifre Değiştir Modal */}
      <Modal 
        opened={passwordModalOpened} 
        onClose={closePasswordModal}
        title="Şifre Değiştir"
        size="sm"
      >
        <Stack gap="md">
          <PasswordInput
            label="Mevcut Şifre"
            placeholder="Mevcut şifrenizi girin"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.currentTarget.value })}
            leftSection={<IconLock size={16} />}
          />
          <PasswordInput
            label="Yeni Şifre"
            placeholder="Yeni şifrenizi girin"
            value={passwordForm.new}
            onChange={(e) => setPasswordForm({ ...passwordForm, new: e.currentTarget.value })}
            leftSection={<IconKey size={16} />}
          />
          <PasswordInput
            label="Yeni Şifre (Tekrar)"
            placeholder="Yeni şifrenizi tekrar girin"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.currentTarget.value })}
            leftSection={<IconKey size={16} />}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closePasswordModal}>İptal</Button>
            <Button onClick={handlePasswordChange} loading={saving}>Değiştir</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Çıkış Onay Modal */}
      <Modal 
        opened={logoutModalOpened} 
        onClose={closeLogoutModal}
        title="Çıkış Yap"
        size="sm"
      >
        <Stack gap="md">
          <Text>Oturumunuzu kapatmak istediğinize emin misiniz?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeLogoutModal}>İptal</Button>
            <Button color="red" onClick={handleLogout} leftSection={<IconLogout size={16} />}>
              Çıkış Yap
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

// Suspense wrapper for useSearchParams
export default function AyarlarPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</div>}>
      <AyarlarContent />
    </Suspense>
  );
}