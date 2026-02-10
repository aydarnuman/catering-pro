'use client';

/**
 * NotesContext - Global Notes Modal Management
 * Tek bir modal, her yerden açılabilir.
 * Personal ve contextual notları destekler.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { NoteContextType } from '@/types/notes';

interface NotesModalState {
  opened: boolean;
  contextType: NoteContextType;
  contextId: number | null;
  contextTitle: string | null;
  /** Agenda tab'a direkt açmak için */
  initialTab: string | null;
}

interface NotesContextValue {
  /** Modal state */
  state: NotesModalState;
  /** Kişisel notlar modalını aç */
  openNotes: (options?: { tab?: string }) => void;
  /** Bağlam bazlı notlar modalını aç (ihale, müşteri vb.) */
  openContextNotes: (
    contextType: Exclude<NoteContextType, null>,
    contextId: number,
    contextTitle?: string
  ) => void;
  /** Modalı kapat */
  closeNotes: () => void;
}

const NotesContext = createContext<NotesContextValue | null>(null);

const INITIAL_STATE: NotesModalState = {
  opened: false,
  contextType: null,
  contextId: null,
  contextTitle: null,
  initialTab: null,
};

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NotesModalState>(INITIAL_STATE);

  const openNotes = useCallback((options?: { tab?: string }) => {
    setState({
      opened: true,
      contextType: null,
      contextId: null,
      contextTitle: null,
      initialTab: options?.tab ?? null,
    });
  }, []);

  const openContextNotes = useCallback(
    (
      contextType: Exclude<NoteContextType, null>,
      contextId: number,
      contextTitle?: string
    ) => {
      setState({
        opened: true,
        contextType,
        contextId,
        contextTitle: contextTitle ?? null,
        initialTab: null,
      });
    },
    []
  );

  const closeNotes = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const value = useMemo(
    () => ({ state, openNotes, openContextNotes, closeNotes }),
    [state, openNotes, openContextNotes, closeNotes]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

/**
 * Hook: Notes modal'ı kontrol et
 */
export function useNotesModal() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotesModal must be used within a NotesProvider');
  }
  return context;
}
