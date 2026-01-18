'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Divider,
  Group,
  Paper,
  Popover,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCalendar,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from '@tabler/icons-react';
import { useRef, useState } from 'react';
import styles from './StyledDatePicker.module.css';

interface StyledDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  w?: string | number;
  style?: React.CSSProperties;
}

const MONTHS_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export default function StyledDatePicker({
  value,
  onChange,
  label,
  placeholder = 'Tarih seçin',
  clearable = true,
  minDate,
  maxDate,
  required,
  error,
  disabled,
  size = 'sm',
  w,
  style,
}: StyledDatePickerProps) {
  const [opened, setOpened] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date());
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatShortDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('tr-TR');
  };

  const handleSelect = (date: Date) => {
    onChange(date);
    setOpened(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert to Monday = 0
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && date < new Date(minDate.setHours(0, 0, 0, 0))) return true;
    if (maxDate && date > new Date(maxDate.setHours(23, 59, 59, 999))) return true;
    return false;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return value && date.toDateString() === value.toDateString();
  };

  const renderDaysView = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);

    const days = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push(
        <UnstyledButton
          key={`prev-${i}`}
          className={`${styles.dayButton} ${styles.otherMonth}`}
          onClick={() => handleSelect(date)}
          disabled={isDateDisabled(date)}
        >
          {prevMonthDays - i}
        </UnstyledButton>
      );
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const disabled = isDateDisabled(date);
      const today = isToday(date);
      const selected = isSelected(date);

      days.push(
        <UnstyledButton
          key={i}
          className={`${styles.dayButton} ${today ? styles.today : ''} ${selected ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
          onClick={() => !disabled && handleSelect(date)}
          disabled={disabled}
        >
          {i}
        </UnstyledButton>
      );
    }

    // Next month days
    const totalDays = days.length;
    const remainingDays = 42 - totalDays; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push(
        <UnstyledButton
          key={`next-${i}`}
          className={`${styles.dayButton} ${styles.otherMonth}`}
          onClick={() => handleSelect(date)}
          disabled={isDateDisabled(date)}
        >
          {i}
        </UnstyledButton>
      );
    }

    return (
      <Stack gap="xs">
        {/* Day names */}
        <SimpleGrid cols={7} spacing={0}>
          {DAYS_TR.map((day) => (
            <Text key={day} ta="center" size="xs" fw={600} c="dimmed" py={4}>
              {day}
            </Text>
          ))}
        </SimpleGrid>

        {/* Days grid */}
        <SimpleGrid cols={7} spacing={0}>
          {days}
        </SimpleGrid>
      </Stack>
    );
  };

  const renderMonthsView = () => {
    const year = viewDate.getFullYear();

    return (
      <SimpleGrid cols={3} spacing="xs">
        {MONTHS_TR.map((month, index) => {
          const _date = new Date(year, index, 1);
          const isCurrentMonth =
            new Date().getMonth() === index && new Date().getFullYear() === year;
          const isSelectedMonth =
            value && value.getMonth() === index && value.getFullYear() === year;

          return (
            <UnstyledButton
              key={month}
              className={`${styles.monthButton} ${isCurrentMonth ? styles.today : ''} ${isSelectedMonth ? styles.selected : ''}`}
              onClick={() => {
                setViewDate(new Date(year, index, 1));
                setViewMode('days');
              }}
            >
              {month.slice(0, 3)}
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    );
  };

  const renderYearsView = () => {
    const currentYear = viewDate.getFullYear();
    const startYear = Math.floor(currentYear / 10) * 10 - 1;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);

    return (
      <SimpleGrid cols={3} spacing="xs">
        {years.map((year) => {
          const isCurrentYear = new Date().getFullYear() === year;
          const isSelectedYear = value && value.getFullYear() === year;

          return (
            <UnstyledButton
              key={year}
              className={`${styles.yearButton} ${isCurrentYear ? styles.today : ''} ${isSelectedYear ? styles.selected : ''}`}
              onClick={() => {
                setViewDate(new Date(year, viewDate.getMonth(), 1));
                setViewMode('months');
              }}
            >
              {year}
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    );
  };

  const navigatePrev = () => {
    if (viewMode === 'days') {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    } else if (viewMode === 'months') {
      setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1));
    } else {
      setViewDate(new Date(viewDate.getFullYear() - 10, viewDate.getMonth(), 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'days') {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    } else if (viewMode === 'months') {
      setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1));
    } else {
      setViewDate(new Date(viewDate.getFullYear() + 10, viewDate.getMonth(), 1));
    }
  };

  const getHeaderText = () => {
    if (viewMode === 'days') {
      return `${MONTHS_TR[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
    } else if (viewMode === 'months') {
      return viewDate.getFullYear().toString();
    } else {
      const startYear = Math.floor(viewDate.getFullYear() / 10) * 10;
      return `${startYear} - ${startYear + 9}`;
    }
  };

  const handleHeaderClick = () => {
    if (viewMode === 'days') {
      setViewMode('months');
    } else if (viewMode === 'months') {
      setViewMode('years');
    }
  };

  const goToToday = () => {
    const today = new Date();
    setViewDate(today);
    setViewMode('days');
  };

  return (
    <Popover
      opened={opened && !disabled}
      onChange={setOpened}
      position="bottom-start"
      shadow="lg"
      radius="lg"
      width={320}
      transitionProps={{ transition: 'pop', duration: 200 }}
    >
      <Popover.Target>
        <TextInput
          ref={inputRef}
          label={label}
          placeholder={placeholder}
          value={formatDate(value)}
          onClick={() => setOpened(true)}
          readOnly
          required={required}
          error={error}
          disabled={disabled}
          size={size}
          w={w}
          style={{ cursor: 'pointer', ...style }}
          styles={{
            input: {
              cursor: 'pointer',
              fontWeight: 500,
              '&:focus': {
                borderColor: 'var(--mantine-color-blue-5)',
              },
            },
          }}
          leftSection={<IconCalendar size={18} color="var(--mantine-color-blue-6)" />}
          rightSection={
            clearable && value ? (
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={handleClear}
                style={{ pointerEvents: 'all' }}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
        />
      </Popover.Target>

      <Popover.Dropdown p={0} className={styles.dropdown}>
        <Stack gap={0}>
          {/* Header */}
          <Paper p="sm" className={styles.header}>
            <Group justify="space-between" wrap="nowrap">
              <ActionIcon variant="subtle" onClick={navigatePrev} size="md" radius="xl">
                <IconChevronLeft size={18} />
              </ActionIcon>

              <UnstyledButton onClick={handleHeaderClick} className={styles.headerTitle}>
                <Text fw={600} size="sm">
                  {getHeaderText()}
                </Text>
              </UnstyledButton>

              <ActionIcon variant="subtle" onClick={navigateNext} size="md" radius="xl">
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          </Paper>

          <Divider />

          {/* Calendar Body */}
          <Box p="sm" className={styles.body}>
            {viewMode === 'days' && renderDaysView()}
            {viewMode === 'months' && renderMonthsView()}
            {viewMode === 'years' && renderYearsView()}
          </Box>

          <Divider />

          {/* Footer */}
          <Paper p="xs" className={styles.footer}>
            <Group justify="space-between">
              <UnstyledButton onClick={goToToday} className={styles.todayButton}>
                <Group gap={4}>
                  <IconCalendarEvent size={14} />
                  <Text size="xs" fw={500}>
                    Bugün
                  </Text>
                </Group>
              </UnstyledButton>

              {value && (
                <Badge variant="light" color="blue" size="sm">
                  {formatShortDate(value)}
                </Badge>
              )}
            </Group>
          </Paper>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

// DateRangePicker için de benzer bileşen
interface StyledDateRangePickerProps {
  value: [Date | null, Date | null];
  onChange: (dates: [Date | null, Date | null]) => void;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  w?: string | number;
}

export function StyledDateRangePicker({
  value,
  onChange,
  label,
  placeholder = 'Tarih aralığı seçin',
  clearable = true,
  minDate,
  maxDate,
  required,
  error,
  disabled,
  size = 'sm',
  w,
}: StyledDateRangePickerProps) {
  const [opened, setOpened] = useState(false);
  const [viewDate, setViewDate] = useState(value[0] || new Date());
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');

  const formatRange = () => {
    if (!value[0] && !value[1]) return '';
    const start = value[0]?.toLocaleDateString('tr-TR') || '...';
    const end = value[1]?.toLocaleDateString('tr-TR') || '...';
    return `${start} - ${end}`;
  };

  const handleSelect = (date: Date) => {
    if (selecting === 'start') {
      onChange([date, null]);
      setSelecting('end');
    } else {
      if (value[0] && date < value[0]) {
        onChange([date, value[0]]);
      } else {
        onChange([value[0], date]);
      }
      setSelecting('start');
      setOpened(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([null, null]);
    setSelecting('start');
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const isInRange = (date: Date) => {
    if (!value[0] || !value[1]) return false;
    return date >= value[0] && date <= value[1];
  };

  const isRangeStart = (date: Date) => value[0] && date.toDateString() === value[0].toDateString();
  const isRangeEnd = (date: Date) => value[1] && date.toDateString() === value[1].toDateString();
  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  const renderDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);

    const days = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push(
        <UnstyledButton key={`prev-${i}`} className={`${styles.dayButton} ${styles.otherMonth}`}>
          {prevMonthDays - i}
        </UnstyledButton>
      );
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const inRange = isInRange(date);
      const rangeStart = isRangeStart(date);
      const rangeEnd = isRangeEnd(date);
      const today = isToday(date);

      days.push(
        <UnstyledButton
          key={i}
          className={`${styles.dayButton} ${today ? styles.today : ''} ${rangeStart || rangeEnd ? styles.selected : ''} ${inRange ? styles.inRange : ''}`}
          onClick={() => handleSelect(date)}
        >
          {i}
        </UnstyledButton>
      );
    }

    return days;
  };

  return (
    <Popover
      opened={opened && !disabled}
      onChange={setOpened}
      position="bottom-start"
      shadow="lg"
      radius="lg"
      width={320}
    >
      <Popover.Target>
        <TextInput
          label={label}
          placeholder={placeholder}
          value={formatRange()}
          onClick={() => setOpened(true)}
          readOnly
          required={required}
          error={error}
          disabled={disabled}
          size={size}
          w={w}
          style={{ cursor: 'pointer' }}
          leftSection={<IconCalendar size={18} color="var(--mantine-color-blue-6)" />}
          rightSection={
            clearable && (value[0] || value[1]) ? (
              <ActionIcon size="sm" variant="subtle" color="gray" onClick={handleClear}>
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
        />
      </Popover.Target>

      <Popover.Dropdown p={0} className={styles.dropdown}>
        <Stack gap={0}>
          <Paper p="sm" className={styles.header}>
            <Group justify="space-between">
              <ActionIcon
                variant="subtle"
                onClick={() =>
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
                }
                radius="xl"
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Text fw={600} size="sm">
                {MONTHS_TR[viewDate.getMonth()]} {viewDate.getFullYear()}
              </Text>
              <ActionIcon
                variant="subtle"
                onClick={() =>
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
                }
                radius="xl"
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          </Paper>

          <Divider />

          <Box p="sm">
            <SimpleGrid cols={7} spacing={0} mb="xs">
              {DAYS_TR.map((day) => (
                <Text key={day} ta="center" size="xs" fw={600} c="dimmed" py={4}>
                  {day}
                </Text>
              ))}
            </SimpleGrid>
            <SimpleGrid cols={7} spacing={0}>
              {renderDays()}
            </SimpleGrid>
          </Box>

          <Divider />

          <Paper p="xs" className={styles.footer}>
            <Group justify="center" gap="xs">
              <Badge variant="light" color={selecting === 'start' ? 'blue' : 'gray'} size="sm">
                Başlangıç: {value[0]?.toLocaleDateString('tr-TR') || '-'}
              </Badge>
              <Badge variant="light" color={selecting === 'end' ? 'blue' : 'gray'} size="sm">
                Bitiş: {value[1]?.toLocaleDateString('tr-TR') || '-'}
              </Badge>
            </Group>
          </Paper>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
