'use client';

/**
 * CalcPopup - Floating calculator popup
 */

import { ActionIcon, Box, Group, Paper, ScrollArea, Text, useMantineColorScheme } from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import { IconCalculator, IconX } from '@tabler/icons-react';
import { CalculatorTool } from './tools/CalculatorTool';

interface CalcPopupProps {
  open: boolean;
  onClose: () => void;
}

export function CalcPopup({ open, onClose }: CalcPopupProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const ref = useClickOutside(onClose);

  if (!open) return null;

  return (
    <Paper
      ref={ref}
      shadow="xl"
      radius="lg"
      p="md"
      className="ws-tool-fade-in"
      style={{
        position: 'absolute',
        top: 8,
        right: 16,
        width: 340,
        maxHeight: 500,
        zIndex: 100,
        background: isDark ? 'rgba(26,26,30,0.97)' : 'rgba(255,255,255,0.97)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        backdropFilter: 'blur(24px)',
        boxShadow: isDark
          ? '0 12px 48px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)'
          : '0 12px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Box
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDark ? 'rgba(20,184,166,0.15)' : 'rgba(20,184,166,0.1)',
              color: 'var(--mantine-color-teal-5)',
            }}
          >
            <IconCalculator size={14} />
          </Box>
          <Text size="sm" fw={700}>
            Hesap Makinasi
          </Text>
        </Group>
        <ActionIcon variant="subtle" size="sm" radius="md" onClick={onClose}>
          <IconX size={14} />
        </ActionIcon>
      </Group>
      <ScrollArea mah={420}>
        <CalculatorTool />
      </ScrollArea>
    </Paper>
  );
}
