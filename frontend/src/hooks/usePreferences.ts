/**
 * usePreferences Hook
 *
 * Local-first, server-sync tercihleri yönetimi.
 * 1. İlk yükleme: localStorage'dan anında oku (hızlı render)
 * 2. Arka planda: sunucudan tercihleri çek ve birleştir
 * 3. Kaydetme: Önce localStorage'a yaz (anında), sonra sunucuya sync et (arka plan)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserPreferences } from '@/app/ayarlar/components/types';
import { defaultPreferences } from '@/app/ayarlar/components/types';
import { preferencesAPI } from '@/lib/api/services/preferences';

const STORAGE_KEY = 'userPreferences';
const SYNC_DEBOUNCE_MS = 1000;

function loadFromLocalStorage(): UserPreferences {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...defaultPreferences, ...JSON.parse(saved) };
    }
  } catch {
    // localStorage parse hatası
  }
  return { ...defaultPreferences };
}

function saveToLocalStorage(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage dolu veya erişilemiyor
  }
}

export function usePreferences(isAuthenticated: boolean) {
  const [preferences, setPreferences] = useState<UserPreferences>(loadFromLocalStorage);
  const [syncing, setSyncing] = useState(false);
  const [serverLoaded, setServerLoaded] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sunucudan tercihleri yükle (login sonrası bir kez)
  useEffect(() => {
    if (!isAuthenticated || serverLoaded) return;

    let cancelled = false;

    const fetchServerPrefs = async () => {
      try {
        const response = await preferencesAPI.getAll();
        if (cancelled) return;

        if (response.success && response.preferences) {
          const serverPrefs = response.preferences;
          // Sunucu verisinde 'ui_preferences' key'i varsa, ondan oku
          const serverData =
            typeof serverPrefs.ui_preferences === 'object'
              ? (serverPrefs.ui_preferences as Partial<UserPreferences>)
              : {};

          // Sunucu tercihlerini localStorage ile birleştir
          // Sunucu daha güncel ise sunucuyu kullan
          if (Object.keys(serverData).length > 0) {
            const merged = { ...defaultPreferences, ...serverData };
            setPreferences(merged);
            saveToLocalStorage(merged);
          }
        }
      } catch {
        // Sunucu erişilemiyor - localStorage ile devam et
      } finally {
        if (!cancelled) {
          setServerLoaded(true);
        }
      }
    };

    fetchServerPrefs();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, serverLoaded]);

  // Sunucuya debounced sync
  const syncToServer = useCallback(
    (prefs: UserPreferences) => {
      if (!isAuthenticated) return;

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      syncTimerRef.current = setTimeout(async () => {
        try {
          setSyncing(true);
          await preferencesAPI.updateAll({ ui_preferences: prefs });
        } catch {
          // Sunucu sync başarısız - localStorage'daki veri korunuyor
          console.warn('Tercihler sunucuya kaydedilemedi');
        } finally {
          setSyncing(false);
        }
      }, SYNC_DEBOUNCE_MS);
    },
    [isAuthenticated]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  // Tercihleri güncelle (local-first + server-sync)
  const savePreferences = useCallback(
    (newPrefs: Partial<UserPreferences>) => {
      setPreferences((prev) => {
        const updated = { ...prev, ...newPrefs };
        saveToLocalStorage(updated);
        syncToServer(updated);
        return updated;
      });
    },
    [syncToServer]
  );

  return {
    preferences,
    setPreferences,
    savePreferences,
    syncing,
    serverLoaded,
  };
}
