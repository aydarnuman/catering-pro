'use client';

import { Box, Stack, Text, UnstyledButton, useMantineColorScheme } from '@mantine/core';
import { IconNote } from '@tabler/icons-react';
import useSWR from 'swr';
import { authFetch } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';

interface NotItem {
  id: number;
  content: string;
  is_completed: boolean;
  due_date: string | null;
  pinned?: boolean;
  color?: string;
  priority?: string;
}

interface NotlarResponse {
  success: boolean;
  notlar: NotItem[];
}

function getTodayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Yerel tarih (gün/ay/yıl) karşılaştırması için */
function toLocalDateKey(d: Date): number {
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
}

const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const AYLAR_KISA = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

/** Vade etiketi: due_date varsa her zaman göster – bugün 16.00, yarın, Cum 14.00, 5 Şub vb. */
function formatVadeEtiket(
  d: Date,
  todayKey: number,
  tomorrowKey: number,
  weekEndKey: number
): string {
  const key = toLocalDateKey(d);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const timeStr = hasTime
    ? `${d.getHours().toString().padStart(2, '0')}.${d.getMinutes().toString().padStart(2, '0')}`
    : '';

  if (key === todayKey) return timeStr ? `bugün ${timeStr}` : 'bugün';
  if (key === tomorrowKey) return timeStr ? `yarın ${timeStr}` : 'yarın';
  if (key >= todayKey && key <= weekEndKey) {
    const dayName = GUN_KISA[d.getDay()];
    return timeStr ? `${dayName} ${timeStr}` : dayName;
  }
  const shortDate = `${d.getDate()} ${AYLAR_KISA[d.getMonth()]}`;
  return timeStr ? `${shortDate} ${timeStr}` : shortDate;
}

const PREVIEW_LEN = 36;
function preview(content: string): string {
  const t = (content || '').trim().replace(/\s+/g, ' ');
  return t.length <= PREVIEW_LEN ? t : `${t.slice(0, PREVIEW_LEN)}…`;
}

const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
  violet: '#8b5cf6',
};

function getColor(n: NotItem): string {
  return COLOR_MAP[n.color ?? ''] ?? COLOR_MAP.blue;
}

/** Bugün vadeli notlar kırmızı etiket (sol çubuk) */
function getBarColor(n: NotItem & { vadeEtiket?: string | null }): string {
  if (n.vadeEtiket?.startsWith('bugün')) return COLOR_MAP.red;
  return getColor(n);
}

export function ToolbarNotesWidget() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const { data } = useSWR<NotlarResponse>(
    'toolbar-notlar',
    () => authFetch(`${API_BASE_URL}/api/notes?limit=30`).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const notlar = data?.notlar ?? [];
  const todayStart = getTodayStart();
  const todayKey = toLocalDateKey(todayStart);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowKey = toLocalDateKey(tomorrowStart);
  const weekEnd = getWeekEnd();
  const weekEndKey = toLocalDateKey(weekEnd);

  const gosterilecek = notlar
    .filter((n) => !n.is_completed)
    .slice(0, 4)
    .map((n) => {
      const d = n.due_date ? new Date(n.due_date) : null;
      const vadeEtiket = d ? formatVadeEtiket(d, todayKey, tomorrowKey, weekEndKey) : null;
      return { ...n, vadeEtiket };
    });

  const openNotes = () => window.dispatchEvent(new CustomEvent('open-notes-modal'));

  /* Gömülü his: parlak olmayan, arka planla uyumlu tonlar */
  const noteTextColor = isDark ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.52)';
  const noteMetaColor = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.42)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)';

  const noteFont = {
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    lineHeight: 1.45,
    letterSpacing: '0.015em',
  };

  return (
    <Box px={6} py={4} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      <Stack gap={2} align="stretch" style={{ width: '100%', maxWidth: 260 }}>
        {gosterilecek.length > 0 ? (
          gosterilecek.map((n) => (
            <UnstyledButton
              key={n.id}
              onClick={openNotes}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 0,
                padding: '8px 10px',
                borderRadius: 8,
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = hoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Sol çubuk – yumuşak, toolbar ile uyumlu */}
              <Box
                style={{
                  width: 3,
                  height: 14,
                  borderRadius: 2,
                  flexShrink: 0,
                  backgroundColor: getBarColor(n),
                  opacity: 0.9,
                }}
              />
              {/* Not metni – notlara uyumlu yazı tipi, tek satır */}
              <Text
                size="sm"
                lineClamp={1}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  color: noteTextColor,
                  textAlign: 'left',
                  ...noteFont,
                }}
              >
                {preview(n.content)}
              </Text>
              {/* Vade – küçük etiket, metinle uyumlu */}
              {n.vadeEtiket && (
                <Text
                  size="xs"
                  style={{
                    ...noteFont,
                    fontSize: 10,
                    fontWeight: 500,
                    flexShrink: 0,
                    color: noteMetaColor,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                  }}
                >
                  {n.vadeEtiket}
                </Text>
              )}
            </UnstyledButton>
          ))
        ) : (
          <UnstyledButton
            onClick={openNotes}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              color: noteMetaColor,
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = hoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <IconNote size={18} style={{ opacity: 0.8, flexShrink: 0 }} />
            <Text size="sm" fw={500} style={{ color: noteMetaColor, ...noteFont }}>
              Notlar & Ajanda
            </Text>
          </UnstyledButton>
        )}
      </Stack>
    </Box>
  );
}
