'use client';

import { Box, Group, Tooltip } from '@mantine/core';
import { NOTE_COLORS, type NoteColor } from '@/types/notes';

interface NoteColorPickerProps {
  value: NoteColor;
  onChange: (color: NoteColor) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
};

export function NoteColorPicker({
  value,
  onChange,
  size = 'md',
  disabled = false,
}: NoteColorPickerProps) {
  const dotSize = SIZES[size];
  const colors = Object.keys(NOTE_COLORS) as NoteColor[];

  return (
    <Group gap={4}>
      {colors.map((color) => {
        const config = NOTE_COLORS[color];
        const isSelected = value === color;

        return (
          <Tooltip key={color} label={config.name} position="top" withArrow>
            <Box
              onClick={() => !disabled && onChange(color)}
              style={{
                width: dotSize + 4,
                height: dotSize + 4,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isSelected ? `2px solid ${config.accent}` : '2px solid transparent',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                if (!disabled) {
                  e.currentTarget.style.transform = 'scale(1.1)';
                }
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Box
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  background: config.bg,
                  border: `1px solid ${config.border}`,
                }}
              />
            </Box>
          </Tooltip>
        );
      })}
    </Group>
  );
}

export default NoteColorPicker;
