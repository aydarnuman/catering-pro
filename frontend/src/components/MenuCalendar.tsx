'use client';

import type { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import trLocale from '@fullcalendar/core/locales/tr';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { Badge, Box, Group, Paper, Text, Title, Tooltip } from '@mantine/core';
import type React from 'react';
import { useRef } from 'react';

// FullCalendar React tip tanımı props'u tanımıyor; JSX için geçici cast
const Calendar = FullCalendar as unknown as React.ComponentType<Record<string, unknown>>;

interface MenuPlanOgun {
  id: number;
  tarih: string;
  ogun_tipi_id: number;
  ogun_tip_adi: string;
  ogun_ikon: string;
  kisi_sayisi: number;
  toplam_maliyet?: number;
  yemekler?: Array<{
    id: number;
    recete_adi: string;
  }>;
}

interface MenuCalendarProps {
  ogunler: MenuPlanOgun[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (ogun: MenuPlanOgun) => void;
  height?: number | string;
}

export default function MenuCalendar({
  ogunler,
  onDateClick,
  onEventClick,
  height = 600,
}: MenuCalendarProps) {
  const calendarRef = useRef<Record<string, unknown> | null>(null);

  // Öğünleri FullCalendar event formatına dönüştür
  const events: EventInput[] = ogunler.map((ogun) => {
    // Renk belirle (öğün tipine göre)
    const colorMap: Record<number, string> = {
      1: '#ffc078', // Kahvaltı - turuncu
      2: '#74c0fc', // Öğle - mavi
      3: '#b197fc', // Akşam - mor
      4: '#8ce99a', // Ara öğün - yeşil
      5: '#ffd43b', // Gece - sarı
    };

    const yemekSayisi = ogun.yemekler?.length || 0;
    const yemekListesi = ogun.yemekler?.map((y) => y.recete_adi).join(', ') || 'Yemek seçilmedi';

    return {
      id: String(ogun.id),
      title: `${ogun.ogun_ikon} ${ogun.ogun_tip_adi}`,
      start: ogun.tarih,
      backgroundColor: colorMap[ogun.ogun_tipi_id] || '#868e96',
      borderColor: colorMap[ogun.ogun_tipi_id] || '#868e96',
      extendedProps: {
        ogun,
        kisiSayisi: ogun.kisi_sayisi,
        yemekSayisi,
        yemekListesi,
        maliyet: ogun.toplam_maliyet,
      },
    };
  });

  const handleDateClick = (info: any) => {
    if (onDateClick) {
      onDateClick(info.date);
    }
  };

  const handleEventClick = (info: EventClickArg) => {
    const ogun = info.event.extendedProps.ogun as MenuPlanOgun;
    if (onEventClick) {
      onEventClick(ogun);
    }
  };

  return (
    <Paper p="md" withBorder>
      <Box>
        <Calendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={trLocale}
          height={height}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek',
          }}
          buttonText={{
            today: 'Bugün',
            month: 'Ay',
            week: 'Hafta',
          }}
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventContent={(eventInfo: EventContentArg) => {
            const { kisiSayisi, yemekSayisi, maliyet, yemekListesi } =
              eventInfo.event.extendedProps;

            return (
              <Tooltip
                label={
                  <Box>
                    <Text size="sm" fw={600}>
                      {eventInfo.event.title}
                    </Text>
                    <Text size="xs" mt={4}>
                      👥 {kisiSayisi} kişi
                    </Text>
                    <Text size="xs">🍽️ {yemekSayisi} çeşit yemek</Text>
                    {maliyet && (
                      <Text size="xs">
                        💰 ₺{Number(maliyet).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </Text>
                    )}
                    <Text size="xs" mt={4} c="dimmed">
                      {yemekListesi}
                    </Text>
                  </Box>
                }
                multiline
                w={300}
              >
                <Box
                  style={{
                    padding: '2px 6px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Group gap={4} wrap="nowrap">
                    <Text
                      size="xs"
                      fw={500}
                      style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {eventInfo.event.title}
                    </Text>
                    <Badge size="xs" variant="light" color="dark">
                      {yemekSayisi}
                    </Badge>
                  </Group>
                </Box>
              </Tooltip>
            );
          }}
          dayMaxEvents={3}
          eventMaxStack={3}
          moreLinkText={(num: number) => `+${num} öğün`}
          firstDay={1} // Pazartesi
          weekends={true}
          selectable={true}
          selectMirror={true}
          dayHeaders={true}
          navLinks={true}
          editable={false} // Drag & drop şimdilik kapalı (güvenlik)
        />
      </Box>

      {/* Legend */}
      <Group mt="md" gap="xs">
        <Text size="sm" fw={500}>
          Öğün Tipleri:
        </Text>
        <Badge color="#ffc078" variant="filled">
          ☀️ Kahvaltı
        </Badge>
        <Badge color="#74c0fc" variant="filled">
          🌞 Öğle
        </Badge>
        <Badge color="#b197fc" variant="filled">
          🌙 Akşam
        </Badge>
        <Badge color="#8ce99a" variant="filled">
          🍎 Ara Öğün
        </Badge>
        <Badge color="#ffd43b" variant="filled">
          🌃 Gece
        </Badge>
      </Group>
    </Paper>
  );
}
