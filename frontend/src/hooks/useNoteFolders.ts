'use client';

/**
 * useNoteFolders - Hook for note folder management (TanStack React Query)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { noteFoldersAPI } from '@/lib/api/services/note-folders';
import type { NoteFolder } from '@/types/notes';

const FOLDERS_QUERY_KEY = ['note-folders'];

export function useNoteFolders() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ success: boolean; folders: NoteFolder[] }>({
    queryKey: FOLDERS_QUERY_KEY,
    queryFn: () => noteFoldersAPI.list(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const folders = data?.folders ?? [];

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY });
  }, [queryClient]);

  const createFolder = useCallback(
    async (params: { name: string; color?: string; icon?: string; password?: string | null }) => {
      const result = await noteFoldersAPI.create(params);
      if (result.success) {
        invalidate();
        return result.folder;
      }
      return null;
    },
    [invalidate]
  );

  const updateFolder = useCallback(
    async (
      id: number,
      params: {
        name?: string;
        color?: string;
        icon?: string;
        password?: string;
        remove_password?: boolean;
      }
    ) => {
      const result = await noteFoldersAPI.update(id, params);
      if (result.success) {
        invalidate();
        return result.folder;
      }
      return null;
    },
    [invalidate]
  );

  const deleteFolder = useCallback(
    async (id: number) => {
      const result = await noteFoldersAPI.remove(id);
      if (result.success) invalidate();
      return result.success;
    },
    [invalidate]
  );

  const unlockFolder = useCallback(async (id: number, password: string) => {
    const result = await noteFoldersAPI.unlock(id, password);
    return result.success && result.unlocked;
  }, []);

  const moveNote = useCallback(
    async (noteId: string, folderId: number | null) => {
      const result = await noteFoldersAPI.moveNote(noteId, folderId);
      if (result.success) invalidate();
      return result.success;
    },
    [invalidate]
  );

  const refresh = useCallback(() => invalidate(), [invalidate]);

  return {
    folders,
    isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    unlockFolder,
    moveNote,
    refresh,
  };
}
