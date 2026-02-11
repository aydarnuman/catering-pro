'use client';

/**
 * useNoteFolders - Hook for note folder management
 */

import { useCallback } from 'react';
import useSWR from 'swr';
import { noteFoldersAPI } from '@/lib/api/services/note-folders';
import type { NoteFolder } from '@/types/notes';

const FOLDERS_KEY = 'note-folders';

export function useNoteFolders() {
  const { data, error, mutate } = useSWR<{ success: boolean; folders: NoteFolder[] }>(
    FOLDERS_KEY,
    () => noteFoldersAPI.list(),
    { revalidateOnFocus: false }
  );

  const folders = data?.folders ?? [];
  const isLoading = !data && !error;

  const createFolder = useCallback(
    async (params: { name: string; color?: string; icon?: string; password?: string | null }) => {
      const result = await noteFoldersAPI.create(params);
      if (result.success) {
        await mutate();
        return result.folder;
      }
      return null;
    },
    [mutate]
  );

  const updateFolder = useCallback(
    async (id: number, params: { name?: string; color?: string; icon?: string; password?: string; remove_password?: boolean }) => {
      const result = await noteFoldersAPI.update(id, params);
      if (result.success) {
        await mutate();
        return result.folder;
      }
      return null;
    },
    [mutate]
  );

  const deleteFolder = useCallback(
    async (id: number) => {
      const result = await noteFoldersAPI.remove(id);
      if (result.success) await mutate();
      return result.success;
    },
    [mutate]
  );

  const unlockFolder = useCallback(
    async (id: number, password: string) => {
      const result = await noteFoldersAPI.unlock(id, password);
      return result.success && result.unlocked;
    },
    []
  );

  const moveNote = useCallback(
    async (noteId: string, folderId: number | null) => {
      const result = await noteFoldersAPI.moveNote(noteId, folderId);
      if (result.success) await mutate();
      return result.success;
    },
    [mutate]
  );

  const refresh = useCallback(() => mutate(), [mutate]);

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
