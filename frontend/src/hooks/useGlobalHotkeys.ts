'use client';

import { useHotkeys } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface GlobalHotkeysOptions {
  onSearch?: () => void;
  onSave?: () => void;
  onNew?: () => void;
  onRefresh?: () => void;
  onEscape?: () => void;
  onToggleTheme?: () => void;
  enabled?: boolean;
}

interface HotkeyInfo {
  key: string;
  description: string;
  modifiers?: string[];
}

export const HOTKEY_LIST: HotkeyInfo[] = [
  { key: 'K', modifiers: ['cmd'], description: 'Arama aç' },
  { key: 'S', modifiers: ['cmd'], description: 'Kaydet' },
  { key: 'N', modifiers: ['cmd'], description: 'Yeni oluştur' },
  { key: 'R', modifiers: ['cmd', 'shift'], description: 'Yenile' },
  { key: 'D', modifiers: ['cmd', 'shift'], description: 'Tema değiştir' },
  { key: 'Escape', description: 'Kapat / İptal' },
  { key: '1', modifiers: ['cmd'], description: 'Ana sayfa' },
  { key: '2', modifiers: ['cmd'], description: 'İhaleler' },
  { key: '3', modifiers: ['cmd'], description: 'Muhasebe' },
];

export function useGlobalHotkeys(options: GlobalHotkeysOptions = {}) {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const {
    onSearch,
    onSave,
    onNew,
    onRefresh,
    onEscape,
    onToggleTheme,
    enabled = true,
  } = options;

  // Arama modal kontrolü - global event
  const openSearch = useCallback(() => {
    if (onSearch) {
      onSearch();
    } else {
      // Global search event dispatch
      window.dispatchEvent(new CustomEvent('open-search'));
    }
    setIsSearchOpen(true);
  }, [onSearch]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  // Tema değiştir
  const toggleTheme = useCallback(() => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      // Global theme event dispatch
      window.dispatchEvent(new CustomEvent('toggle-theme'));
    }
  }, [onToggleTheme]);

  // Kaydet
  const handleSave = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      if (onSave) {
        onSave();
      }
    },
    [onSave]
  );

  // Yeni
  const handleNew = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      if (onNew) {
        onNew();
      }
    },
    [onNew]
  );

  // Yenile
  const handleRefresh = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      if (onRefresh) {
        onRefresh();
      } else {
        window.location.reload();
      }
    },
    [onRefresh]
  );

  // Escape
  const handleEscape = useCallback(() => {
    if (onEscape) {
      onEscape();
    }
    closeSearch();
  }, [onEscape, closeSearch]);

  // Navigasyon
  const navigateTo = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  // Mantine useHotkeys kullan
  useHotkeys(
    enabled
      ? [
          ['mod+K', openSearch],
          ['mod+S', handleSave],
          ['mod+N', handleNew],
          ['mod+shift+R', handleRefresh],
          ['mod+shift+D', toggleTheme],
          ['Escape', handleEscape],
          ['mod+1', () => navigateTo('/')],
          ['mod+2', () => navigateTo('/tenders')],
          ['mod+3', () => navigateTo('/muhasebe')],
        ]
      : []
  );

  // Global event listener for search close
  useEffect(() => {
    const handleSearchClose = () => setIsSearchOpen(false);
    window.addEventListener('close-search', handleSearchClose);
    return () => window.removeEventListener('close-search', handleSearchClose);
  }, []);

  return {
    isSearchOpen,
    openSearch,
    closeSearch,
    toggleTheme,
  };
}

// Hotkey bilgilerini göstermek için yardımcı komponent
export function formatHotkey(hotkey: HotkeyInfo): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const modifierSymbols: Record<string, string> = {
    cmd: isMac ? '⌘' : 'Ctrl',
    shift: isMac ? '⇧' : 'Shift',
    alt: isMac ? '⌥' : 'Alt',
  };

  const parts = (hotkey.modifiers || []).map((m) => modifierSymbols[m] || m);
  parts.push(hotkey.key);

  return parts.join(isMac ? '' : '+');
}
