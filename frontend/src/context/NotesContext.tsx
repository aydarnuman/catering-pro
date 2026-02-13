'use client';

/**
 * NotesContext - Global Notes Modal Management
 * Tek bir modal, her yerden acilabilir.
 * Personal ve contextual notlari destekler.
 * Quick note popover destegi.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { NoteContextType } from '@/types/notes';

interface NotesModalState {
  opened: boolean;
  contextType: NoteContextType;
  contextId: number | null;
  contextTitle: string | null;
  /** Agenda tab'a direkt acmak icin */
  initialTab: string | null;
  /** Belirli bir notu acmak icin */
  initialNoteId: string | null;
}

interface QuickNoteState {
  opened: boolean;
}

interface NotesContextValue {
  /** Modal state */
  state: NotesModalState;
  /** Quick note state */
  quickNoteState: QuickNoteState;
  /** Kisisel notlar modalini ac */
  openNotes: (options?: { tab?: string; noteId?: string }) => void;
  /** Baglam bazli notlar modalini ac (ihale, musteri vb.) */
  openContextNotes: (contextType: Exclude<NoteContextType, null>, contextId: number, contextTitle?: string) => void;
  /** Modali kapat */
  closeNotes: () => void;
  /** Quick note popover ac/kapa */
  openQuickNote: () => void;
  closeQuickNote: () => void;
  toggleQuickNote: () => void;
}

const NotesContext = createContext<NotesContextValue | null>(null);

const INITIAL_STATE: NotesModalState = {
  opened: false,
  contextType: null,
  contextId: null,
  contextTitle: null,
  initialTab: null,
  initialNoteId: null,
};

const INITIAL_QUICK_NOTE: QuickNoteState = { opened: false };

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NotesModalState>(INITIAL_STATE);
  const [quickNoteState, setQuickNoteState] = useState<QuickNoteState>(INITIAL_QUICK_NOTE);

  const openNotes = useCallback((options?: { tab?: string; noteId?: string }) => {
    setQuickNoteState(INITIAL_QUICK_NOTE);
    setState({
      opened: true,
      contextType: null,
      contextId: null,
      contextTitle: null,
      initialTab: options?.tab ?? null,
      initialNoteId: options?.noteId ?? null,
    });
  }, []);

  const openContextNotes = useCallback(
    (contextType: Exclude<NoteContextType, null>, contextId: number, contextTitle?: string) => {
      setQuickNoteState(INITIAL_QUICK_NOTE);
      setState({
        opened: true,
        contextType,
        contextId,
        contextTitle: contextTitle ?? null,
        initialTab: null,
        initialNoteId: null,
      });
    },
    []
  );

  const closeNotes = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const openQuickNote = useCallback(() => {
    setQuickNoteState({ opened: true });
  }, []);

  const closeQuickNote = useCallback(() => {
    setQuickNoteState(INITIAL_QUICK_NOTE);
  }, []);

  const toggleQuickNote = useCallback(() => {
    setQuickNoteState((prev) => ({ opened: !prev.opened }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      quickNoteState,
      openNotes,
      openContextNotes,
      closeNotes,
      openQuickNote,
      closeQuickNote,
      toggleQuickNote,
    }),
    [state, quickNoteState, openNotes, openContextNotes, closeNotes, openQuickNote, closeQuickNote, toggleQuickNote]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

/**
 * Hook: Notes modal'i kontrol et
 */
export function useNotesModal() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotesModal must be used within a NotesProvider');
  }
  return context;
}
