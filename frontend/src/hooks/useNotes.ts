'use client';

/**
 * useNotes Hook
 * Main hook for unified notes system with SWR caching
 */

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { notesAPI } from '@/lib/api/services/notes';
import type {
  CreateNoteDTO,
  NotesFilter,
  NoteTag,
  UnifiedNote,
  UpdateNoteDTO,
} from '@/types/notes';

interface UseNotesOptions {
  /** Filter options for notes */
  filter?: NotesFilter;
  /** Context type (tender, customer, etc.) - null for personal notes */
  contextType?: string | null;
  /** Context ID - null for personal notes */
  contextId?: number | null;
  /** Whether to enable fetching */
  enabled?: boolean;
  /** SWR revalidation interval in ms (0 to disable) */
  refreshInterval?: number;
}

interface UseNotesReturn {
  /** List of notes */
  notes: UnifiedNote[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count of notes */
  total: number;
  /** Create a new note */
  createNote: (data: CreateNoteDTO) => Promise<UnifiedNote | null>;
  /** Update a note */
  updateNote: (id: string, data: UpdateNoteDTO) => Promise<UnifiedNote | null>;
  /** Delete a note */
  deleteNote: (id: string) => Promise<boolean>;
  /** Toggle note completion */
  toggleComplete: (id: string) => Promise<UnifiedNote | null>;
  /** Toggle note pin status */
  togglePin: (id: string) => Promise<UnifiedNote | null>;
  /** Reorder notes (drag-drop) */
  reorderNotes: (noteIds: string[]) => Promise<boolean>;
  /** Delete all completed notes */
  deleteCompleted: () => Promise<number>;
  /** Refresh notes list */
  refresh: () => void;
  /** Mutate notes (for optimistic updates) */
  mutate: (
    data?: UnifiedNote[] | ((current: UnifiedNote[] | undefined) => UnifiedNote[] | undefined),
    shouldRevalidate?: boolean
  ) => void;
}

/**
 * Hook for managing unified notes
 */
export function useNotes(options: UseNotesOptions = {}): UseNotesReturn {
  const { filter, contextType, contextId, enabled = true, refreshInterval = 0 } = options;

  const isContextual = !!contextType && contextId !== undefined;

  // Build cache key
  const cacheKey = useMemo(() => {
    if (!enabled) return null;

    if (isContextual) {
      return ['notes', 'context', contextType, contextId, JSON.stringify(filter)];
    }
    return ['notes', 'personal', JSON.stringify(filter)];
  }, [enabled, isContextual, contextType, contextId, filter]);

  // Fetcher function
  const fetcher = useCallback(async () => {
    if (isContextual && contextType && contextId != null) {
      const res = await notesAPI.getContextNotes(contextType, contextId as number, filter);
      return { notes: res.notes ?? [], total: res.total ?? 0 };
    }
    const res = await notesAPI.getNotes(filter);
    return { notes: res.notes ?? [], total: res.total ?? 0 };
  }, [isContextual, contextType, contextId, filter]);

  // SWR hook
  const { data, error, isLoading, mutate } = useSWR<{ notes: UnifiedNote[]; total: number }>(
    cacheKey,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      refreshInterval,
    }
  );

  const notes = data?.notes ?? [];
  const total = data?.total ?? 0;

  /**
   * Create a new note
   */
  const createNote = useCallback(
    async (noteData: CreateNoteDTO): Promise<UnifiedNote | null> => {
      try {
        const res =
          isContextual && contextType && contextId != null
            ? await notesAPI.createContextNote(contextType, contextId as number, noteData)
            : await notesAPI.createNote(noteData);

        if (res.success && res.note) {
          // Optimistic update - add new note at the beginning
          mutate(
            (current) => ({
              notes: [res.note, ...(current?.notes ?? [])],
              total: (current?.total ?? 0) + 1,
            }),
            false
          );
          return res.note;
        }
        return null;
      } catch (err) {
        console.error('Error creating note:', err);
        return null;
      }
    },
    [isContextual, contextType, contextId, mutate]
  );

  /**
   * Update a note
   */
  const updateNote = useCallback(
    async (id: string, noteData: UpdateNoteDTO): Promise<UnifiedNote | null> => {
      try {
        const res = await notesAPI.updateNote(id, noteData);

        if (res.success && res.note) {
          // Optimistic update
          mutate(
            (current) => ({
              notes: (current?.notes ?? []).map((n) => (n.id === id ? res.note : n)),
              total: current?.total ?? 0,
            }),
            false
          );
          return res.note;
        }
        return null;
      } catch (err) {
        console.error('Error updating note:', err);
        return null;
      }
    },
    [mutate]
  );

  /**
   * Delete a note
   */
  const deleteNote = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await notesAPI.deleteNote(id);

        if (res.success) {
          // Optimistic update
          mutate(
            (current) => ({
              notes: (current?.notes ?? []).filter((n) => n.id !== id),
              total: Math.max((current?.total ?? 1) - 1, 0),
            }),
            false
          );
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error deleting note:', err);
        return false;
      }
    },
    [mutate]
  );

  /**
   * Toggle note completion
   */
  const toggleComplete = useCallback(
    async (id: string): Promise<UnifiedNote | null> => {
      try {
        const res = await notesAPI.toggleComplete(id);

        if (res.success && res.note) {
          // Optimistic update
          mutate(
            (current) => ({
              notes: (current?.notes ?? []).map((n) => (n.id === id ? res.note : n)),
              total: current?.total ?? 0,
            }),
            false
          );
          return res.note;
        }
        return null;
      } catch (err) {
        console.error('Error toggling note completion:', err);
        return null;
      }
    },
    [mutate]
  );

  /**
   * Toggle note pin status
   */
  const togglePin = useCallback(
    async (id: string): Promise<UnifiedNote | null> => {
      try {
        const res = await notesAPI.togglePin(id);

        if (res.success && res.note) {
          // Optimistic update with re-sorting (pinned first)
          mutate((current) => {
            const updatedNotes = (current?.notes ?? []).map((n) => (n.id === id ? res.note : n));
            // Re-sort: pinned first, then by sort_order
            updatedNotes.sort((a, b) => {
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              return a.sort_order - b.sort_order;
            });
            return {
              notes: updatedNotes,
              total: current?.total ?? 0,
            };
          }, false);
          return res.note;
        }
        return null;
      } catch (err) {
        console.error('Error toggling note pin:', err);
        return null;
      }
    },
    [mutate]
  );

  /**
   * Reorder notes (drag-drop)
   */
  const reorderNotes = useCallback(
    async (noteIds: string[]): Promise<boolean> => {
      try {
        // Optimistic update
        mutate((current) => {
          const noteMap = new Map((current?.notes ?? []).map((n) => [n.id, n]));
          const reorderedNotes = noteIds
            .map((id, idx) => {
              const note = noteMap.get(id);
              return note ? { ...note, sort_order: idx } : null;
            })
            .filter(Boolean) as UnifiedNote[];
          return {
            notes: reorderedNotes,
            total: current?.total ?? 0,
          };
        }, false);

        // API call
        const res =
          isContextual && contextType && contextId != null
            ? await notesAPI.reorderContextNotes(contextType, contextId as number, noteIds)
            : await notesAPI.reorderNotes(noteIds);

        return res.success;
      } catch (err) {
        console.error('Error reordering notes:', err);
        // Revalidate on error
        mutate();
        return false;
      }
    },
    [isContextual, contextType, contextId, mutate]
  );

  /**
   * Delete all completed notes
   */
  const deleteCompleted = useCallback(async (): Promise<number> => {
    try {
      const res = await notesAPI.deleteCompleted();

      if (res.success) {
        // Optimistic update
        mutate(
          (current) => ({
            notes: (current?.notes ?? []).filter((n) => !n.is_completed),
            total: Math.max((current?.total ?? res.deleted) - res.deleted, 0),
          }),
          false
        );
        return res.deleted;
      }
      return 0;
    } catch (err) {
      console.error('Error deleting completed notes:', err);
      return 0;
    }
  }, [mutate]);

  /**
   * Refresh notes
   */
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    notes,
    isLoading,
    error: error ?? null,
    total,
    createNote,
    updateNote,
    deleteNote,
    toggleComplete,
    togglePin,
    reorderNotes,
    deleteCompleted,
    refresh,
    mutate: (data, shouldRevalidate) => {
      if (typeof data === 'function') {
        mutate((current) => {
          const result = data(current?.notes);
          return result ? { notes: result, total: result.length } : current;
        }, shouldRevalidate);
      } else if (data) {
        mutate({ notes: data, total: data.length }, shouldRevalidate);
      } else {
        mutate();
      }
    },
  };
}

/**
 * Hook for tag suggestions
 */
export function useNoteTags() {
  const { data, error, isLoading, mutate } = useSWR<{ suggestions: NoteTag[] }>(
    ['notes', 'tags', 'suggestions'],
    async () => {
      const res = await notesAPI.getTagSuggestions();
      return { suggestions: res.suggestions ?? [] };
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute cache
    }
  );

  const suggestions = data?.suggestions ?? [];

  const searchTags = useCallback(async (query: string): Promise<NoteTag[]> => {
    try {
      const res = await notesAPI.getTagSuggestions(query);
      return res.suggestions ?? [];
    } catch {
      return [];
    }
  }, []);

  const createTag = useCallback(
    async (name: string, color?: string): Promise<NoteTag | null> => {
      try {
        const res = await notesAPI.createTag(name, color);
        if (res.success && res.tag) {
          mutate();
          return res.tag;
        }
        return null;
      } catch {
        return null;
      }
    },
    [mutate]
  );

  return {
    suggestions,
    isLoading,
    error: error ?? null,
    searchTags,
    createTag,
    refresh: () => mutate(),
  };
}

/**
 * Hook for upcoming reminders
 */
export function useNoteReminders(limit?: number) {
  const { data, error, isLoading, mutate } = useSWR(
    ['notes', 'reminders', 'upcoming', limit],
    async () => {
      const res = await notesAPI.getUpcomingReminders(limit);
      return { reminders: res.reminders ?? [] };
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 60000, // Refresh every minute
    }
  );

  const reminders = data?.reminders ?? [];

  const markAsSent = useCallback(
    async (reminderId: string): Promise<boolean> => {
      try {
        const res = await notesAPI.markReminderSent(reminderId);
        if (res.success) {
          mutate();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [mutate]
  );

  return {
    reminders,
    isLoading,
    error: error ?? null,
    markAsSent,
    refresh: () => mutate(),
  };
}

export default useNotes;
