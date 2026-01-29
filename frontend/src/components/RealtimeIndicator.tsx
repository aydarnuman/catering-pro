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
        <Badge
          size="sm"
          color="red"
          variant="dot"
          leftSection={<IconWifiOff size={10} />}
          styles={{
            root: {
              minWidth: 52,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              alignSelf: 'center',
            },
          }}
        >
          Offline
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={isConnected ? 'Gerçek zamanlı bağlı' : 'Bağlanıyor...'} withArrow>
        <Badge
          size="sm"
          color={isConnected ? 'green' : 'yellow'}
          variant="dot"
          leftSection={<IconWifi size={10} />}
          styles={{
            root: {
              minWidth: 52,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              alignSelf: 'center',
            },
          }}
        >
        {isConnected ? 'LIVE' : '...'}
      </Badge>
    </Tooltip>
  );
}
