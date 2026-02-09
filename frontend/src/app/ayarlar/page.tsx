'use client';

import {
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  NavLink,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconChevronRight, IconHome } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/api';
import { firmalarAPI } from '@/lib/api/services/firmalar';
import { API_BASE_URL } from '@/lib/config';

// Section components
import BildirimlerSection from './components/BildirimlerSection';
import FirmaFormModal from './components/FirmaFormModal';
import FirmaProjelerSection from './components/FirmaProjelerSection';
import GorunumSection from './components/GorunumSection';
import KisayollarSection from './components/KisayollarSection';
import ProfilSection from './components/ProfilSection';
import SistemSection from './components/SistemSection';
import type { FirmaBilgileri, UserInfo, UserPreferences } from './components/types';
import { defaultPreferences, menuItems } from './components/types';

function AyarlarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auth
  const { user: authUser } = useAuth();

  // Active section
  const [activeSection, setActiveSection] = useState(searchParams.get('section') || 'profil');

  // User state
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  // Firma state (shared: FirmaProjelerSection + FirmaFormModal)
  const [firmalar, setFirmalar] = useState<FirmaBilgileri[]>([]);
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [firmaModalOpened, setFirmaModalOpened] = useState(false);
  const [editingFirma, setEditingFirma] = useState<FirmaBilgileri | null>(null);

  // ─── Effects ───────────────────────────────────────────
  useEffect(() => {
    if (authUser) {
      setUser(authUser as UserInfo);
      setLoading(false);
    } else {
      const fetchUser = async () => {
        try {
          const res = await authFetch(`${API_BASE_URL}/api/auth/me`);
          if (res.ok) {
            const data = await res.json();
            if (data.user) setUser(data.user);
          }
        } catch (_err) {
          console.error('Kullanıcı bilgisi alınamadı');
        } finally {
          setLoading(false);
        }
      };
      fetchUser();
    }

    const savedPrefs = localStorage.getItem('userPreferences');
    if (savedPrefs) {
      setPreferences({ ...defaultPreferences, ...JSON.parse(savedPrefs) });
    }
  }, [authUser]);

  const fetchFirmalar = useCallback(async () => {
    try {
      setFirmaLoading(true);
      const response = await firmalarAPI.getFirmalar();
      if (response.success && response.data) {
        setFirmalar(response.data as FirmaBilgileri[]);
      } else {
        console.error('Firmalar yüklenemedi:', response.error);
        setFirmalar([]);
      }
    } catch (err) {
      console.error('Firmalar yüklenemedi:', err);
      setFirmalar([]);
    } finally {
      setFirmaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFirmalar();
  }, [fetchFirmalar]);

  useEffect(() => {
    const section = searchParams.get('section');
    if (section) setActiveSection(section);
  }, [searchParams]);

  // ─── Handlers ──────────────────────────────────────────
  const savePreferences = (newPrefs: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);
    localStorage.setItem('userPreferences', JSON.stringify(updated));
    notifications.show({
      title: 'Kaydedildi',
      message: 'Tercihleriniz güncellendi',
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  const handleOpenFirmaModal = (firma?: FirmaBilgileri) => {
    setEditingFirma(firma || null);
    setFirmaModalOpened(true);
  };

  const handleDeleteFirma = async (id: number) => {
    if (!confirm('Bu firmayı silmek istediğinize emin misiniz?')) return;

    try {
      const res = await authFetch(`${API_BASE_URL}/api/firmalar/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchFirmalar();
        notifications.show({ title: 'Silindi', message: 'Firma silindi', color: 'orange' });
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Firma silinemedi', color: 'red' });
    }
  };

  const handleSetVarsayilan = async (id: number) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/firmalar/${id}/varsayilan`, {
        method: 'PATCH',
      });
      if (res.ok) {
        await fetchFirmalar();
        notifications.show({
          title: 'Güncellendi',
          message: 'Varsayılan firma değiştirildi',
          color: 'green',
        });
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Varsayılan değiştirilemedi', color: 'red' });
    }
  };

  // ─── Section Routing ───────────────────────────────────
  const renderContent = () => {
    switch (activeSection) {
      case 'profil':
        return <ProfilSection user={user} loading={loading} />;

      case 'firma':
        return (
          <FirmaProjelerSection
            firmalar={firmalar}
            firmaLoading={firmaLoading}
            handleOpenFirmaModal={handleOpenFirmaModal}
            handleDeleteFirma={handleDeleteFirma}
            handleSetVarsayilan={handleSetVarsayilan}
            API_BASE_URL={API_BASE_URL}
          />
        );

      case 'gorunum':
        return (
          <GorunumSection
            preferences={preferences}
            savePreferences={savePreferences}
            setPreferencesLocal={setPreferences}
          />
        );

      case 'bildirimler':
        return (
          <BildirimlerSection preferences={preferences} savePreferences={savePreferences} />
        );

      case 'sistem':
        return (
          <SistemSection
            preferences={preferences}
            savePreferences={savePreferences}
            user={user}
          />
        );

      case 'kisayollar':
        return <KisayollarSection />;

      default:
        return null;
    }
  };

  // ─── Layout ────────────────────────────────────────────
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Group gap="md" align="center" mb="xs">
              <Button
                component={Link}
                href="/"
                variant="light"
                leftSection={<IconHome size={18} />}
                size="sm"
              >
                Ana Sayfa
              </Button>
            </Group>
            <Title order={1} size="h2" mb={4}>
              ⚙️ Ayarlar
            </Title>
            <Text c="dimmed">Hesap ve uygulama tercihlerinizi yönetin</Text>
          </div>
          <Badge size="lg" variant="light" color="blue">
            v1.0.0
          </Badge>
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
            w={{ base: '100%', sm: 280 }}
            style={{ position: 'sticky', top: 80, flexShrink: 0 }}
          >
            <Stack gap="xs">
              {user && (
                <>
                  <Group gap="sm" p="sm">
                    <Avatar size={40} radius="xl" color="blue">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <Text size="sm" fw={600} truncate>
                        {user.name}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {user.email}
                      </Text>
                    </div>
                  </Group>
                  <Divider />
                </>
              )}

              {menuItems.map((item) =>
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
              )}
            </Stack>
          </Paper>

          {/* Content */}
          <Box style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'visible' }}>
            {renderContent()}
          </Box>
        </Box>
      </Stack>

      {/* Firma Form Modal - tüm sayfada erişilebilir */}
      <FirmaFormModal
        opened={firmaModalOpened}
        onClose={() => setFirmaModalOpened(false)}
        firma={editingFirma}
        firmaCount={firmalar.length}
        onSaved={fetchFirmalar}
      />
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
