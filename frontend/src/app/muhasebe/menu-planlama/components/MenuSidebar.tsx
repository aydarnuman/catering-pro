'use client';

import { Box, Stack, Text, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core';
import { IconBook2, IconCalendar, IconChartLine } from '@tabler/icons-react';
import type React from 'react';

export type SidebarCategory = 'planlama' | 'katalog' | 'analiz';

export interface SidebarTab {
  id: string;
  label: string;
}

export interface SidebarItem {
  id: SidebarCategory;
  label: string;
  icon: React.ReactNode;
  tabs: SidebarTab[];
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: 'planlama',
    label: 'Planlama',
    icon: <IconCalendar size={20} />,
    tabs: [{ id: 'takvim', label: 'Takvim' }],
  },
  {
    id: 'katalog',
    label: 'Katalog',
    icon: <IconBook2 size={20} />,
    tabs: [
      { id: 'receteler', label: 'Reçeteler' },
      { id: 'urunler', label: 'Ürünler' },
      { id: 'menuler', label: 'Menüler' },
    ],
  },
  {
    id: 'analiz',
    label: 'Analiz',
    icon: <IconChartLine size={20} />,
    tabs: [{ id: 'fiyatlar', label: 'Fiyatlar' }],
  },
];

interface MenuSidebarProps {
  activeCategory: SidebarCategory;
  onCategoryChange: (category: SidebarCategory) => void;
}

export function MenuSidebar({ activeCategory, onCategoryChange }: MenuSidebarProps) {
  return (
    <Box
      style={{
        width: 70,
        minHeight: 'calc(100vh - 120px)',
        borderRight: '1px solid var(--mantine-color-dark-4)',
        background: 'var(--mantine-color-dark-7)',
        position: 'sticky',
        top: 60,
      }}
    >
      <Stack gap={0} py="md">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activeCategory === item.id;

          return (
            <Tooltip key={item.id} label={item.label} position="right" withArrow>
              <UnstyledButton
                onClick={() => onCategoryChange(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 8px',
                  margin: '4px 8px',
                  borderRadius: 'var(--mantine-radius-md)',
                  background: isActive ? 'var(--mantine-color-blue-light)' : 'transparent',
                  border: isActive
                    ? '1px solid var(--mantine-color-blue-5)'
                    : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--mantine-color-dark-5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <ThemeIcon
                  size="md"
                  variant={isActive ? 'filled' : 'subtle'}
                  color={isActive ? 'blue' : 'gray'}
                >
                  {item.icon}
                </ThemeIcon>
                <Text
                  size="10px"
                  mt={4}
                  c={isActive ? 'blue' : 'dimmed'}
                  fw={isActive ? 600 : 400}
                  ta="center"
                >
                  {item.label}
                </Text>
              </UnstyledButton>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}
