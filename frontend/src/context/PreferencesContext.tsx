'use client';

/**
 * PREFERENCES CONTEXT
 * Kullanıcı tercihlerini uygulama genelinde erişilebilir yapar.
 * local-first + server-sync: Anında localStorage, arka planda sunucu.
 */

import { createContext, useContext } from 'react';
import type { UserPreferences } from '@/app/ayarlar/components/types';
import { defaultPreferences } from '@/app/ayarlar/components/types';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/hooks/usePreferences';

interface PreferencesContextType {
  preferences: UserPreferences;
  savePreferences: (newPrefs: Partial<UserPreferences>) => void;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
  syncing: boolean;
}

const PreferencesContext = createContext<PreferencesContextType>({
  preferences: defaultPreferences,
  savePreferences: () => {},
  setPreferences: () => {},
  syncing: false,
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { preferences, setPreferences, savePreferences, syncing } = usePreferences(isAuthenticated);

  return (
    <PreferencesContext.Provider value={{ preferences, savePreferences, setPreferences, syncing }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferencesContext() {
  return useContext(PreferencesContext);
}
