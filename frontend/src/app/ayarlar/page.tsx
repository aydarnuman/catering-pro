'use client';

import {
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  NavLink,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconChevronRight, IconHome, IconMenu2 } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { usePreferencesContext } from '@/context/PreferencesContext';
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
import type { FirmaBilgileri, UserInfo } from './components/types';
import { menuItems } from './components/types';

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

  // Preferences (from global context - local-first + server-sync)
  const { preferences, setPreferences, savePreferences: savePrefs } = usePreferencesContext();

  // Confirm dialog
  const { confirm: confirmDialog, ConfirmDialogComponent } = useConfirmDialog();

  // Mobile drawer
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);

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
  const savePreferences = useCallback(
    (newPrefs: Partial<import('./components/types').UserPreferences>) => {
      savePrefs(newPrefs);
      notifications.show({
        title: 'Kaydedildi',
        message: 'Tercihleriniz güncellendi',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    },
    [savePrefs]
  );

  const handleOpenFirmaModal = (firma?: FirmaBilgileri) => {
    setEditingFirma(firma || null);
    setFirmaModalOpened(true);
  };

  const handleDeleteFirma = async (id: number) => {
    const confirmed = await confirmDialog({
      title: 'Firmayı Sil',
      message: 'Bu firmayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      variant: 'danger',
      confirmText: 'Sil',
      cancelText: 'İptal',
    });
    if (!confirmed) return;

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
        return <BildirimlerSection preferences={preferences} savePreferences={savePreferences} />;

      case 'sistem':
        return <SistemSection preferences={preferences} savePreferences={savePreferences} user={user} />;

      case 'kisayollar':
        return <KisayollarSection />;

      default:
        return null;
    }
  };

  // ─── Sidebar Nav Items ──────────────────────────────────
  const renderNavItems = () => (
    <>
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
            onClick={closeDrawer}
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
              closeDrawer();
            }}
            style={{ borderRadius: 8 }}
          />
        )
      )}
    </>
  );

  // ─── Layout ────────────────────────────────────────────
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Group gap="md" align="center" mb="xs">
              <Button component={Link} href="/" variant="light" leftSection={<IconHome size={18} />} size="sm">
                Ana Sayfa
              </Button>
              {isMobile && (
                <Button variant="light" leftSection={<IconMenu2 size={18} />} size="sm" onClick={openDrawer}>
                  Menü
                </Button>
              )}
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

        {/* Mobile Drawer */}
        <Drawer opened={drawerOpened} onClose={closeDrawer} title="Ayarlar Menüsü" size="xs" padding="md">
          <Stack gap="xs">{renderNavItems()}</Stack>
        </Drawer>

        {/* Main Content */}
        <Box
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 'var(--mantine-spacing-xl)',
            minHeight: '60vh',
          }}
        >
          {/* Desktop Sidebar */}
          {!isMobile && (
            <Paper p="md" radius="md" withBorder w={280} style={{ position: 'sticky', top: 80, flexShrink: 0 }}>
              <Stack gap="xs">{renderNavItems()}</Stack>
            </Paper>
          )}

          {/* Content */}
          <Box style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'visible' }}>{renderContent()}</Box>
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

      {/* Confirm Dialog */}
      <ConfirmDialogComponent />
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
