'use client';

import { Badge, Box, Collapse, Group, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: number;
  disabled?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  color,
  isExpanded,
  onToggle,
  badge,
  disabled,
  children,
}: CollapsibleSectionProps) {
  return (
    <Box
      style={{
        borderBottom: '1px solid var(--mantine-color-default-border)',
      }}
    >
      {/* Header */}
      <UnstyledButton
        onClick={onToggle}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 12px',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color={color}>
              {icon}
            </ThemeIcon>
            <Text size="sm" fw={500}>
              {title}
            </Text>
            {badge !== undefined && badge > 0 && (
              <Badge size="xs" variant="filled" color={color}>
                {badge}
              </Badge>
            )}
          </Group>
          {isExpanded ? (
            <IconChevronDown size={16} color="var(--mantine-color-gray-6)" />
          ) : (
            <IconChevronRight size={16} color="var(--mantine-color-gray-6)" />
          )}
        </Group>
      </UnstyledButton>

      {/* Content */}
      <Collapse in={isExpanded && !disabled}>
        <Box
          style={{
            background: 'var(--mantine-color-gray-light)',
            maxHeight: 300,
            overflow: 'auto',
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}
