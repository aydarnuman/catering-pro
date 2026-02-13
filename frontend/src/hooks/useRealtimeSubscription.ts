'use client';

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * SUPABASE REALTIME HOOK
 * Belirtilen tablodaki değişiklikleri dinler ve callback çağırır
 *
 * Kullanım:
 * useRealtimeTable('invoices', () => refetchInvoices());
 * useRealtimeTable(['invoices', 'cariler'], () => refetchAll());
 */

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

// Supabase realtime payload type
type PostgresChangesPayload = RealtimePostgresChangesPayload<{ [key: string]: unknown }>;

interface UseRealtimeOptions {
  event?: RealtimeEvent;
  schema?: string;
  filter?: string;
  enabled?: boolean;
}

export function useRealtimeTable(
  table: string | string[],
  onUpdate: (payload?: PostgresChangesPayload) => void,
  options: UseRealtimeOptions = {}
) {
  const { event = '*', schema = 'public', enabled = true } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const tablesArray = Array.isArray(table) ? table : [table];

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    // Unique channel name
    const channelName = `realtime-${tablesArray.join('-')}-${Date.now()}`;

    // Channel oluştur ve subscribe et
    const channel = supabase.channel(channelName);

    // Her tablo için subscription ekle
    for (const tableName of tablesArray) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel as any).on(
        'postgres_changes',
        {
          event,
          schema,
          table: tableName,
        },
        (payload: PostgresChangesPayload) => {
          onUpdate(payload);
        }
      );
    }

    // Subscribe
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.debug(`[Realtime] Bağlandı: ${tablesArray.join(', ')}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[Realtime] Bağlantı hatası: ${tablesArray.join(', ')}`);
      }
    });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        console.debug(`[Realtime] Bağlantı kapatılıyor: ${tablesArray.join(', ')}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [event, schema, enabled, onUpdate, tablesArray]);

  return channelRef.current;
}

/**
 * Birden fazla tablo için tek hook
 * Kullanım: useRealtimeTables({ invoices: refetchInvoices, cariler: refetchCariler })
 */
export function useRealtimeTables(
  tableCallbacks: Record<string, (payload?: PostgresChangesPayload) => void>,
  options: Omit<UseRealtimeOptions, 'filter'> = {}
) {
  const { event = '*', schema = 'public', enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const tables = Object.keys(tableCallbacks);

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    const supabase = createClient();
    const channelName = `realtime-multi-${Date.now()}`;

    const channel = supabase.channel(channelName);

    // Her tablo için ayrı callback
    for (const tableName of tables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel as any).on(
        'postgres_changes',
        {
          event,
          schema,
          table: tableName,
        },
        (payload: PostgresChangesPayload) => {
          tableCallbacks[tableName]?.(payload);
        }
      );
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.debug(`[Realtime] Multi-table bağlandı: ${tables.join(', ')}`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [event, schema, enabled, tableCallbacks, tables]);

  return channelRef.current;
}

/**
 * Global notification listener
 * Tüm önemli tablolardaki değişiklikleri dinler
 */
export function useGlobalRealtimeNotifications(
  onNotification: (table: string, event: string, payload: PostgresChangesPayload) => void,
  enabled = true
) {
  const criticalTables = [
    'invoices',
    'cariler',
    'cari_hareketler',
    'stok',
    'stok_hareketler',
    'tenders',
    'notifications',
    'personel',
    'kasa_banka_hareketler',
  ];

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `global-notifications-${Date.now()}`;

    const channel = supabase.channel(channelName);

    for (const tableName of criticalTables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel as any).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload: PostgresChangesPayload) => {
          onNotification(tableName, payload.eventType, payload);
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onNotification]);
}
