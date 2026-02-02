'use client';

import { Box, ScrollArea, Text, ThemeIcon, Timeline } from '@mantine/core';
import { IconClock, IconFileAnalytics, IconNote, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

interface TimelinePanelProps {
  tenderId: number; // Used for API calls in real implementation
}

interface TimelineEvent {
  id: string;
  type: 'created' | 'note' | 'analysis' | 'status' | 'update';
  title: string;
  description?: string;
  timestamp: Date;
}

export function TimelinePanel({ tenderId: _tenderId }: TimelinePanelProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  // Generate mock events (in real app, fetch from API using tenderId)
  useEffect(() => {
    // Mock data - replace with actual API call
    const mockEvents: TimelineEvent[] = [
      {
        id: '1',
        type: 'created',
        title: 'İhale takibe alındı',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: '2',
        type: 'analysis',
        title: 'Dökümanlar analiz edildi',
        description: '5 döküman işlendi',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: '3',
        type: 'note',
        title: 'Not eklendi',
        description: 'Teknik şartlar incelendi',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: '4',
        type: 'status',
        title: 'Durum güncellendi',
        description: 'Bekliyor → İnceleniyor',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ];
    setEvents(mockEvents);
  }, []);

  // Get icon for event type
  const getEventIcon = (type: TimelineEvent['type']) => {
    const iconMap = {
      created: { icon: IconPlus, color: 'green' },
      note: { icon: IconNote, color: 'yellow' },
      analysis: { icon: IconFileAnalytics, color: 'blue' },
      status: { icon: IconRefresh, color: 'violet' },
      update: { icon: IconClock, color: 'orange' },
    };
    const config = iconMap[type] || iconMap.update;
    return (
      <ThemeIcon size="sm" variant="light" color={config.color} radius="xl">
        <config.icon size={12} />
      </ThemeIcon>
    );
  };

  // Format date
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;

    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <Box p="xs">
      <ScrollArea.Autosize mah={250}>
        {events.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="md">
            Henüz aktivite yok
          </Text>
        ) : (
          <Timeline active={events.length - 1} bulletSize={20} lineWidth={2}>
            {events.map((event) => (
              <Timeline.Item
                key={event.id}
                bullet={getEventIcon(event.type)}
                title={
                  <Text size="xs" fw={500}>
                    {event.title}
                  </Text>
                }
              >
                {event.description && (
                  <Text size="xs" c="dimmed">
                    {event.description}
                  </Text>
                )}
                <Text size="xs" c="dimmed" mt={2}>
                  {formatDate(event.timestamp)}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </ScrollArea.Autosize>
    </Box>
  );
}
