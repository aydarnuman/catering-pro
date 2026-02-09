'use client';

import { Box, Group, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { SIDEBAR_ITEMS, type SidebarCategory } from './MenuSidebar';

interface MobileMenuNavProps {
  activeCategory: SidebarCategory;
  onCategoryChange: (category: SidebarCategory) => void;
}

export function MobileMenuNav({ activeCategory, onCategoryChange }: MobileMenuNavProps) {
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
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activeCategory === item.id;
          return (
            <UnstyledButton
              key={item.id}
              onClick={() => onCategoryChange(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px 12px',
              }}
            >
              <ThemeIcon
                size="sm"
                variant={isActive ? 'filled' : 'subtle'}
                color={isActive ? 'blue' : 'gray'}
              >
                {item.icon}
              </ThemeIcon>
              <Text
                size="10px"
                mt={2}
                c={isActive ? 'blue' : 'dimmed'}
                fw={isActive ? 600 : 400}
              >
                {item.label}
              </Text>
            </UnstyledButton>
          );
        })}
      </Group>
    </Box>
  );
}
