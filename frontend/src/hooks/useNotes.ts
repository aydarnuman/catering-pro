'use client';

/**
 * useNotes Hook
 * Main hook for unified notes system with TanStack React Query
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { notesAPI } from '@/lib/api/services/notes';
import type { CreateNoteDTO, NotesFilter, NoteTag, UnifiedNote, UpdateNoteDTO } from '@/types/notes';

interface UseNotesOptions {
  /** Filter options for notes */
  filter?: NotesFilter;
  /** Context type (tender, customer, etc.) - null for personal notes */
  contextType?: string | null;
  /** Context ID - null for personal notes */
  contextId?: number | null;
  /** Whether to enable fetching */
  enabled?: boolean;
  /** Refetch interval in ms (0 to disable) */
  refreshInterval?: number;
}

interface UseNotesReturn {
  notes: UnifiedNote[];
  isLoading: boolean;
  error: Error | null;
  total: number;
  createNote: (data: CreateNoteDTO) => Promise<UnifiedNote | null>;
  updateNote: (id: string, data: UpdateNoteDTO) => Promise<UnifiedNote | null>;
  deleteNote: (id: string) => Promise<boolean>;
  toggleComplete: (id: string) => Promise<UnifiedNote | null>;
  togglePin: (id: string) => Promise<UnifiedNote | null>;
  reorderNotes: (noteIds: string[]) => Promise<boolean>;
  deleteCompleted: () => Promise<number>;
  refresh: () => void;
  mutate: (
    data?: UnifiedNote[] | ((current: UnifiedNote[] | undefined) => UnifiedNote[] | undefined),
    shouldRevalidate?: boolean
  ) => void;
}

type NotesData = { notes: UnifiedNote[]; total: number };

/**
 * Hook for managing unified notes
 */
export function useNotes(options: UseNotesOptions = {}): UseNotesReturn {
  const { filter, contextType, contextId, enabled = true, refreshInterval = 0 } = options;
  const queryClient = useQueryClient();

  const isContextual = !!contextType && contextId !== undefined;

  // Build query key
  const queryKey = useMemo(() => {
    if (isContextual) {
      return ['notes', 'context', contextType, contextId, JSON.stringify(filter)];
    }
    return ['notes', 'personal', JSON.stringify(filter)];
  }, [isContextual, contextType, contextId, filter]);

  // TanStack Query
  const { data, error, isLoading } = useQuery<NotesData>({
    queryKey,
    queryFn: async () => {
      if (isContextual && contextType && contextId != null) {
        const res = await notesAPI.getContextNotes(contextType, contextId as number, filter);
        return { notes: res.notes ?? [], total: res.total ?? 0 };
      }
      const res = await notesAPI.getNotes(filter);
      return { notes: res.notes ?? [], total: res.total ?? 0 };
    },
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: refreshInterval || false,
  });

  const notes = data?.notes ?? [];
  const total = data?.total ?? 0;

  // Helper to update cache optimistically
  const setData = useCallback(
    (updater: (prev: NotesData | undefined) => NotesData | undefined) => {
      queryClient.setQueryData<NotesData>(queryKey, (prev) => updater(prev) ?? prev);
    },
    [queryClient, queryKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const createNote = useCallback(
    async (noteData: CreateNoteDTO): Promise<UnifiedNote | null> => {
      try {
        const res =
          isContextual && contextType && contextId != null
            ? await notesAPI.createContextNote(contextType, contextId as number, noteData)
            : await notesAPI.createNote(noteData);

        if (res.success && res.note) {
          setData((prev) => ({
            notes: [res.note, ...(prev?.notes ?? [])],
            total: (prev?.total ?? 0) + 1,
          }));
          return res.note;
        }
        return null;
      } catch (err) {
        console.error('Error creating note:', err);
        return null;
      }
    },
    [isContextual, contextType, contextId, setData]
  );

  const updateNote = useCallback(
    async (id: string, noteData: UpdateNoteDTO): Promise<UnifiedNote | null> => {
      try {
        const res = await notesAPI.updateNote(id, noteData);
        if (res.success && res.note) {
          setData((prev) => ({
            notes: (prev?.notes ?? []).map((n) => (n.id === id ? res.note : n)),
            total: prev?.total ?? 0,
          }));
          return res.note;
        }
        return null;
      } catch (err) {
        console.error('Error updating note:', err);
        return null;
      }
    },
    [setData]
  );

  const deleteNote = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await notesAPI.deleteNote(id);
        if (res.success) {
          setData((prev) => ({
            notes: (prev?.notes ?? []).filter((n) => n.id !== id),
            total: Math.max((prev?.total ?? 1) - 1, 0),
          }));
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error deleting note:', err);
        return false;
      }
    },
    [setData]
  );

  const toggleComplete = useCallback(
    async (id: string): Promise<UnifiedNote | null> => {
      try {
        const res = await notesAPI.toggleComplete(id);
        if (res.success && res.note) {
          setData((prev) => ({
            notes: (prev?.notes ?? []).map((n) => (n.id === id ? res.note : n)),
            total: prev?.total ?? 0,
          }));
          return res.note;
        }
        return null;
      } catch (err) {
        console.error('Error toggling note completion:', err);
        return null;
      }
    },
    [setData]
  );

  const togglePin = useCallback(
    async (id: string): Promise<UnifiedNote | null> => {
      try {
        const res = await notesAPI.togglePin(id);
        if (res.success && res.note) {
          setData((prev) => {
            const updatedNotes = (prev?.notes ?? []).map((n) => (n.id === id ? res.note : n));
            updatedNotes.sort((a, b) => {
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              return a.sort_order - b.sort_order;
            });
            return { notes: updatedNotes, total: prev?.total ?? 0 };
          });
          return res.note;
        }
        return null;
      } catch (err) {
        console.error('Error toggling note pin:', err);
        return null;
      }
    },
    [setData]
  );

  const reorderNotes = useCallback(
    async (noteIds: string[]): Promise<boolean> => {
      try {
        // Optimistic
        setData((prev) => {
          const noteMap = new Map((prev?.notes ?? []).map((n) => [n.id, n]));
          const reorderedNotes = noteIds
            .map((id, idx) => {
              const note = noteMap.get(id);
              return note ? { ...note, sort_order: idx } : null;
            })
            .filter(Boolean) as UnifiedNote[];
          return { notes: reorderedNotes, total: prev?.total ?? 0 };
        });

        const res =
          isContextual && contextType && contextId != null
            ? await notesAPI.reorderContextNotes(contextType, contextId as number, noteIds)
            : await notesAPI.reorderNotes(noteIds);

        return res.success;
      } catch (err) {
        console.error('Error reordering notes:', err);
        invalidate();
        return false;
      }
    },
    [isContextual, contextType, contextId, setData, invalidate]
  );

  const deleteCompleted = useCallback(async (): Promise<number> => {
    try {
      const res = await notesAPI.deleteCompleted();
      if (res.success) {
        setData((prev) => ({
          notes: (prev?.notes ?? []).filter((n) => !n.is_completed),
          total: Math.max((prev?.total ?? res.deleted) - res.deleted, 0),
        }));
        return res.deleted;
      }
      return 0;
    } catch (err) {
      console.error('Error deleting completed notes:', err);
      return 0;
    }
  }, [setData]);

  const refresh = useCallback(() => {
    invalidate();
  }, [invalidate]);

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
        queryClient.setQueryData<NotesData>(queryKey, (prev) => {
          const result = data(prev?.notes);
          return result ? { notes: result, total: result.length } : prev;
        });
      } else if (data) {
        queryClient.setQueryData<NotesData>(queryKey, { notes: data, total: data.length });
      }
      if (shouldRevalidate !== false && !data) {
        invalidate();
      }
    },
  };
}

/**
 * Hook for tag suggestions
 */
export function useNoteTags() {
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery<{ suggestions: NoteTag[] }>({
    queryKey: ['notes', 'tags', 'suggestions'],
    queryFn: async () => {
      const res = await notesAPI.getTagSuggestions();
      return { suggestions: res.suggestions ?? [] };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

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
          queryClient.invalidateQueries({ queryKey: ['notes', 'tags', 'suggestions'] });
          return res.tag;
        }
        return null;
      } catch {
        return null;
      }
    },
    [queryClient]
  );

  return {
    suggestions,
    isLoading,
    error: error ?? null,
    searchTags,
    createTag,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['notes', 'tags', 'suggestions'] }),
  };
}

/**
 * Hook for upcoming reminders
 */
export function useNoteReminders(limit?: number) {
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    queryKey: ['notes', 'reminders', 'upcoming', limit],
    queryFn: async () => {
      const res = await notesAPI.getUpcomingReminders(limit);
      return { reminders: res.reminders ?? [] };
    },
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const reminders = data?.reminders ?? [];

  const markAsSent = useCallback(
    async (reminderId: string): Promise<boolean> => {
      try {
        const res = await notesAPI.markReminderSent(reminderId);
        if (res.success) {
          queryClient.invalidateQueries({ queryKey: ['notes', 'reminders', 'upcoming'] });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [queryClient]
  );

  return {
    reminders,
    isLoading,
    error: error ?? null,
    markAsSent,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['notes', 'reminders', 'upcoming'] }),
  };
}

export default useNotes;
