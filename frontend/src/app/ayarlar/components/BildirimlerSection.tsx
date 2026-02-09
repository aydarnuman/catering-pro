'use client';

import { Divider, Group, Stack, Switch, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBellRinging, IconMailOpened } from '@tabler/icons-react';
import { SettingsCard } from '@/components/ui/cards';
import type { UserPreferences } from './types';

interface BildirimlerSectionProps {
  preferences: UserPreferences;
  savePreferences: (newPrefs: Partial<UserPreferences>) => void;
}

export default function BildirimlerSection({
  preferences,
  savePreferences,
}: BildirimlerSectionProps) {
  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb={4}>
          🔔 Bildirim Ayarları
        </Title>
        <Text c="dimmed" size="sm">
          Hangi bildirimleri almak istediğinizi seçin
        </Text>
      </div>

      <SettingsCard
        title="E-posta Bildirimleri"
        description="Önemli güncellemeler için e-posta alın"
        icon={
          <ThemeIcon variant="light" color="blue" size="lg">
            <IconMailOpened size={18} />
          </ThemeIcon>
        }
        rightAction={
          <Switch
            checked={preferences.notifications.email}
            onChange={(e) =>
              savePreferences({
                notifications: {
                  ...preferences.notifications,
                  email: e.currentTarget.checked,
                },
              })
            }
          />
        }
      />

      <SettingsCard
        title="Tarayıcı Bildirimleri"
        description="Masaüstü bildirimleri alın (tarayıcı izni gerekli)"
        icon={
          <ThemeIcon variant="light" color="violet" size="lg">
            <IconBellRinging size={18} />
          </ThemeIcon>
        }
        rightAction={
          <Switch
            checked={preferences.notifications.browser}
            onChange={(e) =>
              savePreferences({
                notifications: {
                  ...preferences.notifications,
                  browser: e.currentTarget.checked,
                },
              })
            }
          />
        }
      />

      <SettingsCard title="Bildirim Kategorileri">
        <Divider />
        <Group justify="space-between">
          <div>
            <Text size="sm" fw={500}>
              İhale Güncellemeleri
            </Text>
            <Text size="xs" c="dimmed">
              Yeni ihaleler ve durum değişiklikleri
            </Text>
          </div>
          <Switch
            checked={preferences.notifications.tenderUpdates}
            onChange={(e) =>
              savePreferences({
                notifications: {
                  ...preferences.notifications,
                  tenderUpdates: e.currentTarget.checked,
                },
              })
            }
          />
        </Group>
        <Divider />
        <Group justify="space-between">
          <div>
            <Text size="sm" fw={500}>
              Fatura Hatırlatıcıları
            </Text>
            <Text size="xs" c="dimmed">
              Yaklaşan ödeme tarihleri
            </Text>
          </div>
          <Switch
            checked={preferences.notifications.invoiceReminders}
            onChange={(e) =>
              savePreferences({
                notifications: {
                  ...preferences.notifications,
                  invoiceReminders: e.currentTarget.checked,
                },
              })
            }
          />
        </Group>
        <Divider />
        <Group justify="space-between">
          <div>
            <Text size="sm" fw={500}>
              Haftalık Özet Raporu
            </Text>
            <Text size="xs" c="dimmed">
              Haftanın özeti e-posta ile
            </Text>
          </div>
          <Switch
            checked={preferences.notifications.weeklyReport}
            onChange={(e) =>
              savePreferences({
                notifications: {
                  ...preferences.notifications,
                  weeklyReport: e.currentTarget.checked,
                },
              })
            }
          />
        </Group>
      </SettingsCard>
    </Stack>
  );
}
