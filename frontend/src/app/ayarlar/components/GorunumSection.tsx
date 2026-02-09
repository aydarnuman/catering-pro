'use client';

import {
  ColorSwatch,
  Divider,
  Group,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { SegmentedControl, useMantineColorScheme } from '@mantine/core';
import { SettingsCard } from '@/components/ui/cards';
import type { UserPreferences } from './types';
import { colorOptions } from './types';

interface GorunumSectionProps {
  preferences: UserPreferences;
  savePreferences: (newPrefs: Partial<UserPreferences>) => void;
  setPreferencesLocal: (prefs: UserPreferences) => void;
}

export default function GorunumSection({
  preferences,
  savePreferences,
  setPreferencesLocal,
}: GorunumSectionProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const handleThemeChange = (value: string) => {
    if (value === 'auto') {
      setColorScheme('auto');
    } else {
      setColorScheme(value as 'light' | 'dark');
    }
    savePreferences({ theme: value as 'light' | 'dark' | 'auto' });
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={3} mb={4}>
          🎨 Görünüm Ayarları
        </Title>
        <Text c="dimmed" size="sm">
          Arayüz tercihlerinizi özelleştirin
        </Text>
      </div>

      <SettingsCard
        title="Tema"
        rightAction={
          colorScheme === 'dark' ? (
            <IconMoon size={18} color="var(--card-accent)" />
          ) : (
            <IconSun size={18} color="var(--card-accent)" />
          )
        }
      >
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
              value: 'light',
            },
            {
              label: (
                <Group gap="xs" justify="center">
                  <IconMoon size={16} />
                  <span>Koyu</span>
                </Group>
              ),
              value: 'dark',
            },
            {
              label: (
                <Group gap="xs" justify="center">
                  <IconDeviceDesktop size={16} />
                  <span>Sistem</span>
                </Group>
              ),
              value: 'auto',
            },
          ]}
        />
      </SettingsCard>

      <SettingsCard
        title="Ana Renk"
        rightAction={
          <ColorSwatch
            color={
              colorOptions.find((c) => c.value === preferences.accentColor)?.color || '#228be6'
            }
            size={20}
          />
        }
      >
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
      </SettingsCard>

      <SettingsCard title="Görünüm Seçenekleri">
        <Divider />
        <Group justify="space-between">
          <div>
            <Text size="sm" fw={500}>
              Kompakt Mod
            </Text>
            <Text size="xs" c="dimmed">
              Daha az boşluk, daha fazla içerik
            </Text>
          </div>
          <Switch
            checked={preferences.compactMode}
            onChange={(e) => savePreferences({ compactMode: e.currentTarget.checked })}
          />
        </Group>
        <Divider />
        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              Yazı Boyutu
            </Text>
            <Text size="sm" c="dimmed">
              {preferences.fontSize}px
            </Text>
          </Group>
          <Slider
            value={preferences.fontSize}
            onChange={(value) => setPreferencesLocal({ ...preferences, fontSize: value })}
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
      </SettingsCard>
    </Stack>
  );
}
