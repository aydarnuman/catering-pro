'use client';

import { useState, useEffect } from 'react';
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
  rem
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
  IconRefresh
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

export default function AyarlarPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
  }, [API_URL]);

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
                <SimpleGrid cols={2}>
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
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={1} size="h2" mb={4}>⚙️ Ayarlar</Title>
            <Text c="dimmed">Hesap ve uygulama tercihlerinizi yönetin</Text>
          </div>
          <Badge size="lg" variant="light" color="blue">v1.0.0</Badge>
        </Group>

        {/* Main Content */}
        <Group align="flex-start" gap="xl" wrap="nowrap" style={{ minHeight: '60vh' }}>
          {/* Sidebar */}
          <Paper 
            p="md" 
            radius="md" 
            withBorder 
            w={280} 
            style={{ position: 'sticky', top: 80 }}
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
          <Box hiddenFrom="md" w="100%">
            <Paper p="xs" radius="md" withBorder mb="md">
              <Group gap="xs" style={{ overflowX: 'auto' }}>
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
                >
                  AI
                </Button>
              </Group>
            </Paper>
          </Box>

          {/* Content */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            {renderContent()}
          </Box>
        </Group>
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
