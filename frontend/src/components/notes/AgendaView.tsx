'use client';

/**
 * AgendaView - Weekly/daily agenda timeline for notes with due dates.
 * Shows notes grouped by day in a visual timeline format.
 */

import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconNote,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import type { NoteColor, UnifiedNote } from '@/types/notes';
import { NOTE_COLORS } from '@/types/notes';

type AgendaRange = 'week' | '2weeks';

const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];
const AYLAR = [
  'Ocak',
  'Subat',
  'Mart',
  'Nisan',
  'Mayis',
  'Haziran',
  'Temmuz',
  'Agustos',
  'Eylul',
  'Ekim',
  'Kasim',
  'Aralik',
];

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(d: Date): string | null {
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function getNoteColor(color: NoteColor): string {
  const config = NOTE_COLORS[color];
  return config?.accent ?? '#3b82f6';
}

interface DayGroup {
  date: Date;
  notes: UnifiedNote[];
  isToday: boolean;
  isPast: boolean;
}

interface AgendaViewProps {
  notes: UnifiedNote[];
  onEdit: (note: UnifiedNote) => void;
  onToggleComplete: (id: string) => void;
}

export function AgendaView({ notes, onEdit, onToggleComplete }: AgendaViewProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [range, setRange] = useState<AgendaRange>('week');
  const [weekOffset, setWeekOffset] = useState(0);

  const today = startOfDay(new Date());
  const rangeLength = range === 'week' ? 7 : 14;

  const startDate = useMemo(() => {
    const d = addDays(today, weekOffset * 7);
    // Start from Monday
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(d, diff);
  }, [today, weekOffset]);

  const dayGroups: DayGroup[] = useMemo(() => {
    const dueNotes = notes.filter((n) => n.due_date);
    const groups: DayGroup[] = [];

    for (let i = 0; i < rangeLength; i++) {
      const date = addDays(startDate, i);
      const dayNotes = dueNotes.filter((n) => {
        if (!n.due_date) return false;
        const noteDate = new Date(n.due_date);
        return isSameDay(noteDate, date);
      });
      groups.push({
        date,
        notes: dayNotes,
        isToday: isSameDay(date, today),
        isPast: date < today && !isSameDay(date, today),
      });
    }

    return groups;
  }, [notes, startDate, rangeLength, today]);

  // Overdue notes (before the visible range)
  const overdueNotes = useMemo(() => {
    return notes.filter((n) => {
      if (!n.due_date || n.is_completed) return false;
      const noteDate = startOfDay(new Date(n.due_date));
      return noteDate < startDate;
    });
  }, [notes, startDate]);

  const totalWithDueDate = notes.filter((n) => n.due_date).length;
  const noDueDateCount = notes.length - totalWithDueDate;

  const headerLabel = useMemo(() => {
    const endDate = addDays(startDate, rangeLength - 1);
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.getDate()} - ${endDate.getDate()} ${AYLAR[startDate.getMonth()]} ${startDate.getFullYear()}`;
    }
    return `${startDate.getDate()} ${AYLAR[startDate.getMonth()]} - ${endDate.getDate()} ${AYLAR[endDate.getMonth()]} ${endDate.getFullYear()}`;
  }, [startDate, rangeLength]);

  const goToToday = useCallback(() => setWeekOffset(0), []);

  const borderSubtl = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header controls */}
      <Box px="lg" py="sm" style={{ borderBottom: `1px solid ${borderSubtl}` }}>
        <Group justify="space-between">
          <Group gap="xs">
            <ActionIcon variant="subtle" size="sm" radius="md" onClick={() => setWeekOffset((p) => p - 1)}>
              <IconChevronLeft size={16} />
            </ActionIcon>
            <Text size="sm" fw={600} style={{ minWidth: 220, textAlign: 'center' }}>
              {headerLabel}
            </Text>
            <ActionIcon variant="subtle" size="sm" radius="md" onClick={() => setWeekOffset((p) => p + 1)}>
              <IconChevronRight size={16} />
            </ActionIcon>
            {weekOffset !== 0 && (
              <Badge variant="light" color="blue" size="sm" style={{ cursor: 'pointer' }} onClick={goToToday}>
                Bugun
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            {noDueDateCount > 0 && (
              <Badge variant="light" color="gray" size="sm">
                {noDueDateCount} tarihsiz
              </Badge>
            )}
            <SegmentedControl
              value={range}
              onChange={(v) => setRange(v as AgendaRange)}
              size="xs"
              data={[
                { value: 'week', label: '1 Hafta' },
                { value: '2weeks', label: '2 Hafta' },
              ]}
            />
          </Group>
        </Group>
      </Box>

      {/* Timeline */}
      <ScrollArea style={{ flex: 1 }} px="lg" py="sm">
        <Stack gap="xs">
          {/* Overdue section */}
          {overdueNotes.length > 0 && (
            <Paper
              p="sm"
              radius="md"
              style={{
                background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)',
                border: `1px solid ${isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'}`,
              }}
            >
              <Group gap="xs" mb="xs">
                <IconClock size={14} color="var(--mantine-color-red-5)" />
                <Text size="xs" fw={700} c="red">
                  Geciken ({overdueNotes.length})
                </Text>
              </Group>
              <Stack gap={4}>
                {overdueNotes.slice(0, 5).map((note) => (
                  <AgendaNoteItem
                    key={note.id}
                    note={note}
                    isDark={isDark}
                    onEdit={onEdit}
                    onToggleComplete={onToggleComplete}
                    showDate
                  />
                ))}
                {overdueNotes.length > 5 && (
                  <Text size="xs" c="dimmed">
                    +{overdueNotes.length - 5} daha...
                  </Text>
                )}
              </Stack>
            </Paper>
          )}

          {/* Day rows */}
          {dayGroups.map((group) => (
            <DayRow
              key={group.date.toISOString()}
              group={group}
              isDark={isDark}
              onEdit={onEdit}
              onToggleComplete={onToggleComplete}
            />
          ))}

          {/* Empty state */}
          {totalWithDueDate === 0 && overdueNotes.length === 0 && (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconCalendar size={40} stroke={1.2} color="var(--mantine-color-gray-4)" />
                <Text size="sm" c="dimmed" fw={500}>
                  Ajandanizda goruntulenecek not yok
                </Text>
                <Text size="xs" c="dimmed">
                  Notlariniza son tarih ekleyerek burada goruntuleyebilirsiniz
                </Text>
              </Stack>
            </Center>
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

// ── DayRow ──
function DayRow({
  group,
  isDark,
  onEdit,
  onToggleComplete,
}: {
  group: DayGroup;
  isDark: boolean;
  onEdit: (note: UnifiedNote) => void;
  onToggleComplete: (id: string) => void;
}) {
  const dayName = GUN_KISA[group.date.getDay()];
  const dayNum = group.date.getDate();
  const hasNotes = group.notes.length > 0;

  return (
    <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minHeight: 36 }}>
      {/* Day label */}
      <Box
        style={{
          width: 52,
          flexShrink: 0,
          textAlign: 'center',
          paddingTop: 4,
        }}
      >
        <Text size="xs" fw={group.isToday ? 700 : 500} c={group.isToday ? 'blue' : group.isPast ? 'dimmed' : undefined}>
          {dayName}
        </Text>
        <Text
          size="lg"
          fw={group.isToday ? 800 : 600}
          c={group.isToday ? 'blue' : group.isPast ? 'dimmed' : undefined}
          style={
            group.isToday
              ? {
                  background: 'var(--mantine-color-blue-6)',
                  color: 'white',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }
              : undefined
          }
        >
          {dayNum}
        </Text>
      </Box>

      {/* Divider line */}
      <Box
        style={{
          width: 2,
          alignSelf: 'stretch',
          minHeight: 36,
          borderRadius: 1,
          background: group.isToday
            ? 'var(--mantine-color-blue-5)'
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.06)',
        }}
      />

      {/* Notes */}
      <Box style={{ flex: 1, minWidth: 0 }}>
        {hasNotes ? (
          <Stack gap={4}>
            {group.notes.map((note) => (
              <AgendaNoteItem
                key={note.id}
                note={note}
                isDark={isDark}
                onEdit={onEdit}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </Stack>
        ) : (
          <Box py={4}>
            <Text size="xs" c="dimmed" style={{ opacity: 0.5 }}>
              —
            </Text>
          </Box>
        )}
      </Box>
    </Group>
  );
}

// ── AgendaNoteItem ──
function AgendaNoteItem({
  note,
  isDark,
  onEdit,
  onToggleComplete,
  showDate,
}: {
  note: UnifiedNote;
  isDark: boolean;
  onEdit: (note: UnifiedNote) => void;
  onToggleComplete: (id: string) => void;
  showDate?: boolean;
}) {
  const noteDate = note.due_date ? new Date(note.due_date) : null;
  const time = noteDate ? formatTime(noteDate) : null;
  const noteColor = getNoteColor(note.color);

  return (
    <Paper
      p="xs"
      radius="sm"
      style={{
        cursor: 'pointer',
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
        borderLeft: `3px solid ${noteColor}`,
        opacity: note.is_completed ? 0.5 : 1,
        transition: 'background 0.1s ease',
      }}
      onClick={() => onEdit(note)}
    >
      <Group gap="xs" wrap="nowrap">
        <ActionIcon
          variant="transparent"
          size="xs"
          color={note.is_completed ? 'green' : 'gray'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(note.id);
          }}
        >
          <IconCircleCheck size={14} />
        </ActionIcon>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            size="xs"
            fw={500}
            lineClamp={1}
            style={{ textDecoration: note.is_completed ? 'line-through' : 'none' }}
          >
            {note.title || note.content.replace(/<[^>]+>/g, '').slice(0, 60)}
          </Text>
        </Box>
        <Group gap={4} style={{ flexShrink: 0 }}>
          {showDate && noteDate && (
            <Text size="xs" c="dimmed">
              {noteDate.getDate()}/{noteDate.getMonth() + 1}
            </Text>
          )}
          {time && (
            <Badge variant="light" color="gray" size="xs">
              {time}
            </Badge>
          )}
          {note.is_task && <IconNote size={10} color="var(--mantine-color-orange-5)" />}
        </Group>
      </Group>
    </Paper>
  );
}
