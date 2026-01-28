'use client';

import { Badge, Tooltip } from '@mantine/core';
import { IconWifi, IconWifiOff } from '@tabler/icons-react';
import { useRealtime } from '@/context/RealtimeContext';

/**
 * Realtime bağlantı durumunu gösteren küçük indicator
 * Navbar'a veya footer'a eklenebilir
 */
export function RealtimeIndicator() {
  const { isConnected, connectionError } = useRealtime();

  if (connectionError) {
    return (
      <Tooltip label={connectionError} withArrow>
        <Badge size="xs" color="red" variant="dot" leftSection={<IconWifiOff size={10} />}>
          Offline
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={isConnected ? 'Gerçek zamanlı bağlı' : 'Bağlanıyor...'} withArrow>
      <Badge
        size="xs"
        color={isConnected ? 'green' : 'yellow'}
        variant="dot"
        leftSection={<IconWifi size={10} />}
      >
        {isConnected ? 'Live' : '...'}
      </Badge>
    </Tooltip>
  );
}
