'use client';

import { Select, Badge, Group, Text } from '@mantine/core';
import { IconFlag, IconFlagFilled } from '@tabler/icons-react';
import { PRIORITY_COLORS, PRIORITY_LABELS, type NotePriority } from '@/types/notes';

interface NotePrioritySelectProps {
  value: NotePriority;
  onChange: (value: NotePriority) => void;
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
  variant?: 'select' | 'badges';
}

export function NotePrioritySelect({
  value,
  onChange,
  size = 'sm',
  disabled = false,
  variant = 'select',
}: NotePrioritySelectProps) {
  const priorities: NotePriority[] = ['urgent', 'high', 'normal', 'low'];

  if (variant === 'badges') {
    return (
      <Group gap={4}>
        {priorities.map((priority) => {
          const isSelected = value === priority;
          const color = PRIORITY_COLORS[priority];

          return (
            <Badge
              key={priority}
              variant={isSelected ? 'filled' : 'outline'}
              color={isSelected ? color : 'gray'}
              size={size}
              style={{
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
              onClick={() => !disabled && onChange(priority)}
              leftSection={
                isSelected ? (
                  <IconFlagFilled size={12} />
                ) : (
                  <IconFlag size={12} />
                )
              }
            >
              {PRIORITY_LABELS[priority]}
            </Badge>
          );
        })}
      </Group>
    );
  }

  return (
    <Select
      value={value}
      onChange={(val) => val && onChange(val as NotePriority)}
      data={priorities.map((p) => ({
        value: p,
        label: PRIORITY_LABELS[p],
      }))}
      size={size}
      disabled={disabled}
      leftSection={<IconFlag size={16} color={PRIORITY_COLORS[value]} />}
      styles={{
        input: {
          borderColor: PRIORITY_COLORS[value],
        },
      }}
      renderOption={({ option }) => {
        const priority = option.value as NotePriority;
        return (
          <Group gap="xs">
            <IconFlag size={14} color={PRIORITY_COLORS[priority]} />
            <Text size="sm">{option.label}</Text>
          </Group>
        );
      }}
    />
  );
}

export default NotePrioritySelect;
