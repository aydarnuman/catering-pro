'use client';

/**
 * EditableCell - Inline editable table cell
 * Supports: text, number, date, select (with colored badges)
 * Features: conditional coloring for numbers, mini bar chart
 */

import { Badge, Box, NumberInput, Select, Text, TextInput, useMantineColorScheme } from '@mantine/core';
import { useCallback, useState } from 'react';
import { fmtNum } from './helpers';
import type { TrackerColumn } from './types';
import { SELECT_OPTION_COLORS } from './types';

interface EditableCellProps {
  value: string | number;
  column: TrackerColumn;
  onChange: (val: string | number) => void;
  /** Max value in this column (for bar chart) */
  columnMax?: number;
  /** Show mini bar chart background */
  showBar?: boolean;
  /** Is this the last cell in the last row? (for tab-to-new-row) */
  isLastCell?: boolean;
  onTabAtEnd?: () => void;
}

/** Get badge color for a select option based on its index */
function getOptionColor(option: string, options: string[]): string {
  const idx = options.indexOf(option);
  return SELECT_OPTION_COLORS[idx] ?? 'gray';
}

export function EditableCell({
  value,
  column,
  onChange,
  columnMax = 0,
  showBar = false,
  isLastCell = false,
  onTabAtEnd,
}: EditableCellProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);

  const commit = useCallback(() => {
    setEditing(false);
    if (localVal !== value) onChange(localVal);
  }, [localVal, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commit();
      } else if (e.key === 'Tab' && isLastCell && onTabAtEnd) {
        e.preventDefault();
        commit();
        onTabAtEnd();
      }
    },
    [commit, isLastCell, onTabAtEnd]
  );

  // ─── Select type: colored badge dropdown ───
  if (column.type === 'select' && column.options) {
    const currentOption = typeof value === 'string' ? value : '';
    const color = currentOption ? getOptionColor(currentOption, column.options) : 'gray';

    return (
      <Select
        data={column.options.map((o) => ({ value: o, label: o }))}
        value={currentOption}
        onChange={(v) => onChange(v || '')}
        size="xs"
        radius="sm"
        variant="unstyled"
        placeholder="Sec..."
        styles={{
          input: {
            height: 28,
            minHeight: 28,
            fontSize: 12,
            padding: '0 6px',
            color: `var(--mantine-color-${color}-${isDark ? '4' : '6'})`,
            fontWeight: 600,
          },
        }}
        renderOption={({ option }) => {
          const optColor = getOptionColor(option.value, column.options || []);
          return (
            <Badge size="sm" variant="light" color={optColor} radius="sm">
              {option.label}
            </Badge>
          );
        }}
      />
    );
  }

  // ─── Display mode (not editing) ───
  if (!editing) {
    // Number bar chart background
    const barWidth =
      showBar && column.type === 'number' && columnMax > 0 && typeof value === 'number'
        ? Math.min((value / columnMax) * 100, 100)
        : 0;

    return (
      <Box
        onClick={() => {
          setLocalVal(value);
          setEditing(true);
        }}
        style={{
          minHeight: 28,
          padding: '2px 6px',
          borderRadius: 4,
          cursor: 'text',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = barWidth > 0 ? 'transparent' : 'transparent';
        }}
      >
        {/* Mini bar chart background */}
        {barWidth > 0 && (
          <Box
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${barWidth}%`,
              background: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)',
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }}
          />
        )}
        <Text
          size="xs"
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {column.type === 'number' && typeof value === 'number' ? fmtNum(value) : value || '\u00A0'}
        </Text>
      </Box>
    );
  }

  // ─── Edit mode: number ───
  if (column.type === 'number') {
    return (
      <NumberInput
        value={typeof localVal === 'number' ? localVal : ''}
        onChange={(v) => setLocalVal(typeof v === 'number' ? v : '')}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        size="xs"
        radius="sm"
        decimalScale={2}
        autoFocus
        styles={{ input: { height: 28, minHeight: 28, fontSize: 12 } }}
      />
    );
  }

  // ─── Edit mode: text / date ───
  return (
    <TextInput
      value={String(localVal)}
      onChange={(e) => setLocalVal(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      size="xs"
      radius="sm"
      type={column.type === 'date' ? 'date' : 'text'}
      autoFocus
      styles={{ input: { height: 28, minHeight: 28, fontSize: 12 } }}
    />
  );
}
