'use client';

import { notifications } from '@mantine/notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * REALTIME CONTEXT
 * Uygulama genelinde realtime değişiklikleri yönetir
 * Toast bildirimleri gösterir
 * Sayfaların refetch yapmasını sağlar
 */

interface RealtimeChange {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  timestamp: Date;
  payload?: unknown;
}

interface RealtimeContextType {
  isConnected: boolean;
  lastChange: RealtimeChange | null;
  subscribe: (table: string, callback: () => void) => () => void;
  connectionError: string | null;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  lastChange: null,
  subscribe: () => () => {},
  connectionError: null,
});

// Tablo isimleri Türkçe karşılıkları
const TABLE_NAMES_TR: Record<string, string> = {
  invoices: 'Faturalar',
  cariler: 'Cariler',
  cari_hareketler: 'Cari Hareketler',
  stok: 'Stok',
  stok_hareketler: 'Stok Hareketleri',
  tenders: 'İhaleler',
  notifications: 'Bildirimler',
  personel: 'Personel',
  kasa_banka_hareketler: 'Kasa/Banka',
  bordro: 'Bordro',
  projeler: 'Projeler',
  demirbas: 'Demirbaş',
  urunler: 'Ürünler',
  menu_items: 'Menü',
  satin_alma: 'Satın Alma',
  unified_notes: 'Notlar',
};

// Event isimleri
const EVENT_NAMES_TR: Record<string, string> = {
  INSERT: 'eklendi',
  UPDATE: 'güncellendi',
  DELETE: 'silindi',
};

// Kritik tablolar - bunlar için realtime açık olacak
const REALTIME_TABLES = [
  'invoices',
  'cariler',
  'cari_hareketler',
  'stok',
  'stok_hareketler',
  'tenders',
  'notifications',
  'personel',
  'kasa_banka_hareketler',
  'bordro',
  'projeler',
  'demirbas',
  'urunler',
  'menu_items',
  'satin_alma',
  'unified_notes',
];

// Realtime özelliğini aktif/pasif yapmak için environment variable
const REALTIME_ENABLED = process.env.NEXT_PUBLIC_ENABLE_REALTIME === 'true';

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastChange, setLastChange] = useState<RealtimeChange | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribersRef = useRef<Map<string, Set<() => void>>>(new Map());
  const lastNotifyAtRef = useRef<Record<string, number>>({});
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const hasShownConnectionErrorRef = useRef(false);
  const NOTIFY_THROTTLE_MS = 4000; // Aynı tablo için en fazla 4 saniyede bir bildirim

  // Subscriber ekle
  const subscribe = useCallback((table: string, callback: () => void) => {
    if (!subscribersRef.current.has(table)) {
      subscribersRef.current.set(table, new Set());
    }
    subscribersRef.current.get(table)?.add(callback);

    // Unsubscribe fonksiyonu döndür
    return () => {
      subscribersRef.current.get(table)?.delete(callback);
    };
  }, []);

  // Değişiklik geldiğinde
  const handleChange = useCallback((table: string, eventType: string, payload: unknown) => {
    const change: RealtimeChange = {
      table,
      event: eventType as 'INSERT' | 'UPDATE' | 'DELETE',
      timestamp: new Date(),
      payload,
    };

    setLastChange(change);

    // İlgili subscriber'ları bilgilendir
    const callbacks = subscribersRef.current.get(table);
    if (callbacks) {
      for (const cb of callbacks) cb();
    }

    // Bildirim göster – throttle: aynı tablo için 4 sn’de bir (notifications hariç)
    if (table !== 'notifications') {
      const now = Date.now();
      const last = lastNotifyAtRef.current[table] ?? 0;
      if (now - last >= NOTIFY_THROTTLE_MS) {
        lastNotifyAtRef.current[table] = now;
        const tableName = TABLE_NAMES_TR[table] || table;
        const eventName = EVENT_NAMES_TR[eventType] || eventType;
        notifications.show({
          id: `realtime-${table}-${now}`,
          title: '🔄 Veri Güncellendi',
          message: `${tableName} ${eventName}`,
          color: 'blue',
          icon: <IconRefresh size={16} />,
          autoClose: 3000,
          withBorder: true,
        });
      }
    }
  }, []);

  // Supabase Realtime bağlantısı + kopunca otomatik yeniden deneme
  useEffect(() => {
    if (!REALTIME_ENABLED) {
      console.debug('[Realtime] Realtime devre dışı (NEXT_PUBLIC_ENABLE_REALTIME != true)');
      return;
    }

    const supabase = createClient();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url.includes('placeholder')) {
      console.warn('[Realtime] Supabase yapılandırılmamış, realtime devre dışı');
      return;
    }

    const scheduleReconnect = () => {
      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.warn('[Realtime] Maksimum yeniden deneme sayısına ulaşıldı');
        return;
      }
      reconnectAttemptRef.current += 1;
      const delay = RECONNECT_DELAY_MS;
      console.debug(
        `[Realtime] ${delay / 1000} sn sonra yeniden bağlanıyor (deneme ${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})`
      );
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        setReconnectTrigger((t) => t + 1);
      }, delay);
    };

    const channelName = `global-realtime-${Date.now()}`;
    let channel = supabase.channel(channelName);

    REALTIME_TABLES.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        handleChange(table, payload.eventType, payload);
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptRef.current = 0;
        hasShownConnectionErrorRef.current = false;
        console.debug('[Realtime] Bağlantı kuruldu');
      } else if (status === 'CHANNEL_ERROR') {
        setIsConnected(false);
        setConnectionError('Realtime bağlantı hatası');
        // Konsolu ve kullanıcıyı spam etme: sadece ilk hatada uyar, sonrakilerde sessiz yeniden dene
        if (!hasShownConnectionErrorRef.current) {
          hasShownConnectionErrorRef.current = true;
          console.warn(
            "[Realtime] Bağlantı kurulamadı. Supabase Realtime açık değilse veya tablolar publication'da değilse REALTIME_SETUP.md adımlarını uygulayın. Devre dışı bırakmak için NEXT_PUBLIC_ENABLE_REALTIME=false yapın."
          );
          notifications.show({
            id: 'realtime-error',
            title: 'Realtime kullanılamıyor',
            message:
              'Gerçek zamanlı güncellemeler kapalı veya yapılandırılmamış. Devre dışı bırakmak için NEXT_PUBLIC_ENABLE_REALTIME=false',
            color: 'orange',
            icon: <IconAlertCircle size={16} />,
            autoClose: 8000,
          });
        }
        scheduleReconnect();
      } else if (status === 'CLOSED') {
        setIsConnected(false);
        scheduleReconnect();
      }
    });

    channelRef.current = channel;

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (channelRef.current) {
        console.debug('[Realtime] Bağlantı kapatılıyor...');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleChange, reconnectTrigger]);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        lastChange,
        subscribe,
        connectionError,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Realtime context hook
 */
export function useRealtime() {
  return useContext(RealtimeContext);
}

/**
 * Belirli bir tabloyu dinleyen hook
 * Sayfa componentlerinde kullanılır. refetchFn her render’da değişse bile
 * abonelik yenilenmez (ref ile güncel fonksiyon çağrılır).
 *
 * Örnek:
 * useRealtimeRefetch('invoices', loadInvoices);
 */
export function useRealtimeRefetch(table: string | string[], refetchFn: () => void) {
  const { subscribe, isConnected } = useRealtime();
  const refetchRef = useRef(refetchFn);
  refetchRef.current = refetchFn;
  const tables = Array.isArray(table) ? table : [table];
  const tableKey = Array.isArray(table) ? [...table].sort().join(',') : String(table);

  // tableKey ile tablo seti sabit; tables/tables.map yerine tableKey kullanarak gereksiz re-subscribe onlenir
  useEffect(() => {
    if (!isConnected) return;
    const unsubscribes = tables.map((t) => subscribe(t, () => refetchRef.current?.()));

    return () => {
      for (const unsub of unsubscribes) unsub();
    };
  }, [subscribe, isConnected, tableKey]);

  return isConnected;
}
