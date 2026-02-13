'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AuthModalProvider } from '@/components/auth';
import { UnifiedNotesModal } from '@/components/notes';
import { QuickNotePopover } from '@/components/notes/QuickNotePopover';
import { ReminderPoller } from '@/components/notes/ReminderPoller';
import { AuthProvider } from '@/context/AuthContext';
import { NotesProvider, useNotesModal } from '@/context/NotesContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import { RealtimeProvider } from '@/context/RealtimeContext';
import { initializeErrorCollector } from '@/lib/error-handling';
import { ErrorBoundary } from './ErrorBoundary';

/** Global keyboard shortcuts for notes */
function NotesKeyboardShortcuts() {
  const { openNotes, toggleQuickNote } = useNotesModal();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + W -> Open Calisma Alanim
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        openNotes();
      }
      // Ctrl/Cmd + Shift + N -> Quick Note
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        toggleQuickNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openNotes, toggleQuickNote]);

  return null;
}

/**
 * Deep link listener: ?notes=open / ?notes=tasks / ?openNotes=1 / ?noteId=xxx
 * Opens the notes modal based on URL parameters on page load.
 */
function NotesDeepLinkListener() {
  const { openNotes, state } = useNotesModal();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (handled || state.opened) return;

    const params = new URLSearchParams(window.location.search);
    const notesParam = params.get('notes');
    const openNotesParam = params.get('openNotes');
    const noteIdParam = params.get('noteId');
    const tabParam = params.get('notesTab');

    if (notesParam === 'open' || openNotesParam === '1') {
      setHandled(true);
      const tab = tabParam || (notesParam === 'tasks' ? 'tasks' : undefined);
      openNotes({ tab, noteId: noteIdParam || undefined });

      // Clean URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('notes');
      url.searchParams.delete('openNotes');
      url.searchParams.delete('noteId');
      url.searchParams.delete('notesTab');
      window.history.replaceState({}, '', url.toString());
    }
  }, [handled, state.opened, openNotes]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Global chunk load error handler + AI Error Collector
  useEffect(() => {
    initializeErrorCollector();

    const handleChunkError = (event: ErrorEvent) => {
      if (event.message?.includes('Loading chunk') || event.message?.includes('ChunkLoadError')) {
        event.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener('error', handleChunkError);
    return () => window.removeEventListener('error', handleChunkError);
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PreferencesProvider>
            <AuthModalProvider>
              <RealtimeProvider>
                <NotesProvider>
                  {children}
                  <UnifiedNotesModal />
                  <QuickNotePopover />
                  <ReminderPoller />
                  <NotesKeyboardShortcuts />
                  <NotesDeepLinkListener />
                </NotesProvider>
              </RealtimeProvider>
            </AuthModalProvider>
          </PreferencesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
