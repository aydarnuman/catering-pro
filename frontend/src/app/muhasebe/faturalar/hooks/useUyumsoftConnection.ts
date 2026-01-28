/**
 * useUyumsoftConnection - Uyumsoft Bağlantı Yönetimi Hook'u
 *
 * Uyumsoft bağlantı durumu, connect/disconnect, kayıtlı bilgilerle bağlan,
 * credentials state.
 */

import { notifications } from '@mantine/notifications';
import { useCallback, useState } from 'react';
import { uyumsoftAPI } from '@/lib/invoice-api';
import type { UyumsoftCredentials, UyumsoftStatus } from '../types';

export interface UseUyumsoftConnectionReturn {
  status: UyumsoftStatus;
  credentials: UyumsoftCredentials;
  setCredentials: React.Dispatch<React.SetStateAction<UyumsoftCredentials>>;

  checkStatus: () => Promise<void>;

  connect: (username: string, password: string, remember?: boolean) => Promise<boolean>;
  connectSaved: (options?: { silent?: boolean }) => Promise<boolean>;
  disconnect: () => Promise<void>;

  isConnecting: boolean;
}

const defaultStatus: UyumsoftStatus = {
  connected: false,
  hasCredentials: false,
  lastSync: null,
  syncCount: 0,
};

const defaultCredentials: UyumsoftCredentials = {
  username: '',
  password: '',
  remember: true,
};

export function useUyumsoftConnection(): UseUyumsoftConnectionReturn {
  const [status, setStatus] = useState<UyumsoftStatus>(defaultStatus);
  const [credentials, setCredentials] = useState<UyumsoftCredentials>(defaultCredentials);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectSaved = useCallback(async (options?: { silent?: boolean }): Promise<boolean> => {
    const silent = options?.silent ?? false;
    setIsConnecting(true);
    try {
      const data = (await uyumsoftAPI.connectSaved()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (data?.success) {
        if (!silent) {
          notifications.show({
            title: 'Başarılı!',
            message: "Uyumsoft'a bağlandı",
            color: 'green',
          });
        }
        setStatus((prev) => ({ ...prev, connected: true }));
        return true;
      }
      if (!silent) {
        notifications.show({
          title: 'Bağlantı Hatası',
          message: data?.error || data?.message || 'Bağlantı başarısız',
          color: 'red',
        });
      }
      return false;
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Uyumsoft bağlantısı kurulamadı. İnternet ve Uyumsoft erişimini kontrol edin.';
      if (!silent) {
        notifications.show({
          title: 'Bağlantı Hatası',
          message: msg,
          color: 'red',
        });
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const data = await uyumsoftAPI.status();
      const newStatus: UyumsoftStatus =
        typeof data === 'object' && data !== null && 'connected' in data
          ? { ...defaultStatus, ...(data as UyumsoftStatus) }
          : defaultStatus;
      setStatus(newStatus);
      // Otomatik giriş: Kayıtlı bilgi varsa ve bağlı değilse, sessizce connect-saved dene
      if (newStatus.hasCredentials && !newStatus.connected) {
        await connectSaved({ silent: true });
      }
    } catch {
      setStatus(defaultStatus);
    }
  }, [connectSaved]);

  const connectImpl = useCallback(
    async (username: string, password: string, remember = true): Promise<boolean> => {
      if (!username?.trim() || !password?.trim()) {
        notifications.show({
          title: 'Hata!',
          message: 'Kullanıcı adı ve şifre gerekli',
          color: 'red',
        });
        return false;
      }

      setIsConnecting(true);
      try {
        const data = (await uyumsoftAPI.connect(username, password, remember)) as {
          success?: boolean;
          error?: string;
          message?: string;
        };

        if (data?.success) {
          notifications.show({
            title: 'Başarılı!',
            message: "Uyumsoft'a bağlandı",
            color: 'green',
          });
          setStatus((prev) => ({
            ...prev,
            connected: true,
            hasCredentials: remember,
          }));
          setCredentials({ username, password, remember });
          return true;
        }
        notifications.show({
          title: 'Bağlantı Hatası',
          message: data?.error || data?.message || 'Bağlantı başarısız',
          color: 'red',
        });
        return false;
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Uyumsoft bağlantısı kurulamadı. İnternet ve Uyumsoft erişimini kontrol edin.';
        notifications.show({
          title: 'Bağlantı Hatası',
          message: msg,
          color: 'red',
        });
        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    []
  );

  const disconnect = useCallback(async () => {
    try {
      await uyumsoftAPI.disconnect();
      setStatus((prev) => ({ ...prev, connected: false }));
      notifications.show({ title: 'Bilgi', message: 'Bağlantı kesildi', color: 'blue' });
    } catch (err) {
      console.error('Disconnect error:', err);
      setStatus((prev) => ({ ...prev, connected: false }));
    }
  }, []);

  return {
    status,
    credentials,
    setCredentials,
    checkStatus,
    connect: connectImpl,
    connectSaved,
    disconnect,
    isConnecting,
  };
}
