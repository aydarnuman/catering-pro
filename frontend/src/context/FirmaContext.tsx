'use client';

import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getApiBaseUrlDynamic } from '@/lib/config';
import { useAuth } from './AuthContext';

interface Firma {
  id: number;
  unvan: string;
  kisa_ad: string | null;
}

interface FirmaContextType {
  selectedFirma: Firma | null;
  availableFirmalar: Firma[];
  isLoading: boolean;
  switchFirma: (firmaId: number) => Promise<void>;
  refreshFirmalar: () => Promise<void>;
}

const FirmaContext = createContext<FirmaContextType | undefined>(undefined);
const FIRMA_STORAGE_KEY = 'selected_firma';

export function FirmaProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFirma, setSelectedFirma] = useState<Firma | null>(null);
  const [availableFirmalar, setAvailableFirmalar] = useState<Firma[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getApiUrl = useCallback(() => {
    const base = getApiBaseUrlDynamic() || '';
    if (typeof window !== 'undefined' && base.startsWith(window.location.origin)) {
      return '';
    }
    return base;
  }, []);

  const fetchFirmalar = useCallback(async () => {
    if (!isAuthenticated || typeof window === 'undefined') {
      setAvailableFirmalar([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${getApiUrl()}/api/auth/firmalar`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (data.success && data.firmalar) {
        setAvailableFirmalar(data.firmalar);

        // /me endpoint'inden gelen firma bilgisini kullan
        if (user?.firma_id) {
          const currentFirma = data.firmalar.find((f: Firma) => f.id === user.firma_id);
          if (currentFirma) {
            setSelectedFirma(currentFirma);
            localStorage.setItem(FIRMA_STORAGE_KEY, JSON.stringify(currentFirma));
            setIsLoading(false);
            return;
          }
        }

        // localStorage'dan restore et
        const stored = localStorage.getItem(FIRMA_STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const stillValid = data.firmalar.find((f: Firma) => f.id === parsed.id);
            if (stillValid) {
              setSelectedFirma(stillValid);
              setIsLoading(false);
              return;
            }
          } catch {
            // JSON parse hatası
          }
          localStorage.removeItem(FIRMA_STORAGE_KEY);
        }

        // Tek firma varsa otomatik seç
        if (data.firmalar.length === 1) {
          setSelectedFirma(data.firmalar[0]);
          localStorage.setItem(FIRMA_STORAGE_KEY, JSON.stringify(data.firmalar[0]));
        }
      }
    } catch (error) {
      console.warn('[FirmaContext] Firma listesi alınamadı:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getApiUrl, user?.firma_id]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchFirmalar();
    } else if (!authLoading && !isAuthenticated) {
      setSelectedFirma(null);
      setAvailableFirmalar([]);
      setIsLoading(false);
      localStorage.removeItem(FIRMA_STORAGE_KEY);
    }
  }, [authLoading, isAuthenticated, fetchFirmalar]);

  const switchFirma = useCallback(
    async (firmaId: number) => {
      try {
        const response = await fetch(`${getApiUrl()}/api/auth/switch-firma`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firma_id: firmaId }),
        });

        const data = await response.json();
        if (data.success && data.firma) {
          setSelectedFirma(data.firma);
          localStorage.setItem(FIRMA_STORAGE_KEY, JSON.stringify(data.firma));
          // TanStack Query cache temizle — tüm veri yeni firma bağlamında yeniden yüklenecek
          queryClient.clear();
          notifications.show({
            title: 'Firma değiştirildi',
            message: `${data.firma.kisa_ad || data.firma.unvan} firmasına geçildi`,
            color: 'blue',
          });
        } else {
          notifications.show({
            title: 'Hata',
            message: data.error || 'Firma değiştirilemedi',
            color: 'red',
          });
        }
      } catch (error) {
        console.error('[FirmaContext] Switch firma hatası:', error);
        notifications.show({ title: 'Hata', message: 'Firma değiştirilemedi', color: 'red' });
      }
    },
    [getApiUrl, queryClient]
  );

  const value: FirmaContextType = {
    selectedFirma,
    availableFirmalar,
    isLoading,
    switchFirma,
    refreshFirmalar: fetchFirmalar,
  };

  return <FirmaContext.Provider value={value}>{children}</FirmaContext.Provider>;
}

export function useFirma() {
  const context = useContext(FirmaContext);
  if (context === undefined) {
    throw new Error('useFirma must be used within a FirmaProvider');
  }
  return context;
}
