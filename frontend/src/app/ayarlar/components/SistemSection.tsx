'use client';

import { Badge, Button, Divider, Group, Paper, Select, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import {
  IconCalendarEvent,
  IconChevronRight,
  IconClock,
  IconCurrencyLira,
  IconDatabase,
  IconLanguage,
  IconShieldLock,
} from '@tabler/icons-react';
import Link from 'next/link';
import { SettingsCard } from '@/components/ui/cards';
import { API_BASE_URL } from '@/lib/config';
import type { UserInfo, UserPreferences } from './types';

interface SistemSectionProps {
  preferences: UserPreferences;
  savePreferences: (newPrefs: Partial<UserPreferences>) => void;
  user: UserInfo | null;
}

export default function SistemSection({ preferences, savePreferences, user }: SistemSectionProps) {
  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb={4}>
          ⚙️ Sistem Ayarları
        </Title>
        <Text c="dimmed" size="sm">
          Genel tercihler ve bölgesel ayarlar
        </Text>
      </div>

      <SettingsCard title="Bölgesel Ayarlar" rightAction={<IconLanguage size={18} color="var(--card-accent)" />}>
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
      </SettingsCard>

      <SettingsCard title="Uygulama Ayarları">
        <Divider />
        <Select
          label="Sayfa Başına Kayıt"
          description="Listelerde kaç kayıt gösterilsin"
          value={preferences.pageSize}
          onChange={(value) => savePreferences({ pageSize: value || '20' })}
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
          value={preferences.autoLogout}
          onChange={(value) => savePreferences({ autoLogout: value || 'never' })}
          data={[
            { value: 'never', label: 'Hiçbir zaman' },
            { value: '30', label: '30 dakika' },
            { value: '60', label: '1 saat' },
            { value: '120', label: '2 saat' },
          ]}
          leftSection={<IconClock size={16} />}
        />
      </SettingsCard>

      <SettingsCard
        title="Sistem Bilgisi"
        rightAction={
          <Badge variant="light" color="blue">
            v1.0.0
          </Badge>
        }
      >
        <Divider />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <div>
            <Text size="xs" c="dimmed">
              Backend
            </Text>
            <Text size="sm">{API_BASE_URL}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Ortam
            </Text>
            <Text size="sm">{process.env.NODE_ENV}</Text>
          </div>
        </SimpleGrid>
        <Button variant="light" leftSection={<IconDatabase size={16} />} component={Link} href="/admin/sistem">
          Detaylı Sistem Bilgisi
        </Button>
      </SettingsCard>

      {/* Admin Panel */}
      {(user?.user_type === 'admin' || user?.user_type === 'super_admin') && (
        <Paper p="lg" radius="md" withBorder style={{ background: 'var(--mantine-color-red-light)' }}>
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon color="red" variant="filled" size="lg">
                <IconShieldLock size={18} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Admin Panel</Text>
                <Text size="xs" c="dimmed">
                  Sistem yönetimi ve kullanıcı kontrolü
                </Text>
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
}
