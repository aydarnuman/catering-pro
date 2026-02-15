'use client';

import { Box, Group, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { IconBook2, IconCalendar, IconPackages } from '@tabler/icons-react';
import type { MenuTab } from './types';

const MOBILE_NAV_ITEMS: { id: MenuTab; label: string; icon: React.ReactNode }[] = [
  { id: 'planlama', label: 'Planlama', icon: <IconCalendar size={20} /> },
  { id: 'receteler', label: 'Reçeteler', icon: <IconBook2 size={20} /> },
  { id: 'urunler', label: 'Ürünler', icon: <IconPackages size={20} /> },
];

interface MobileMenuNavProps {
  activeTab: MenuTab;
  onTabChange: (tab: MenuTab) => void;
}

export function MobileMenuNav({ activeTab, onTabChange }: MobileMenuNavProps) {
  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--mantine-color-dark-7)',
        borderTop: '1px solid var(--mantine-color-dark-4)',
        padding: '8px 0',
        zIndex: 100,
      }}
    >
      <Group justify="space-around" gap={0}>
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <UnstyledButton
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px 12px',
              }}
            >
              <ThemeIcon size="sm" variant={isActive ? 'filled' : 'subtle'} color={isActive ? 'blue' : 'gray'}>
                {item.icon}
              </ThemeIcon>
              <Text size="10px" mt={2} c={isActive ? 'blue' : 'dimmed'} fw={isActive ? 600 : 400}>
                {item.label}
              </Text>
            </UnstyledButton>
          );
        })}
      </Group>
    </Box>
  );
}
