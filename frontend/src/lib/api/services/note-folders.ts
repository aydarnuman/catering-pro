/**
 * Note Folders API Service
 */

import { authFetch } from '@/lib/api';
import { getApiBaseUrlDynamic } from '@/lib/config';
import type { NoteFolder } from '@/types/notes';

const getApiBaseUrl = () => getApiBaseUrlDynamic() || '';

export const noteFoldersAPI = {
  /** List all folders for the current user */
  async list(): Promise<{ success: boolean; folders: NoteFolder[] }> {
    const res = await authFetch(`${getApiBaseUrl()}/api/notes/folders`);
    return res.json();
  },

  /** Create a new folder */
  async create(data: {
    name: string;
    color?: string;
    icon?: string;
    password?: string | null;
  }): Promise<{ success: boolean; folder: NoteFolder }> {
    const res = await authFetch(`${getApiBaseUrl()}/api/notes/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  /** Update a folder */
  async update(
    id: number,
    data: {
      name?: string;
      color?: string;
      icon?: string;
      password?: string;
      remove_password?: boolean;
    }
  ): Promise<{ success: boolean; folder: NoteFolder }> {
    const res = await authFetch(`${getApiBaseUrl()}/api/notes/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  /** Delete a folder (notes become folder-less) */
  async remove(id: number): Promise<{ success: boolean }> {
    const res = await authFetch(`${getApiBaseUrl()}/api/notes/folders/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  /** Unlock a password-protected folder */
  async unlock(id: number, password: string): Promise<{ success: boolean; unlocked?: boolean }> {
    const res = await authFetch(`${getApiBaseUrl()}/api/notes/folders/${id}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return res.json();
  },

  /** Move a note to a folder (or remove from folder with folder_id=null) */
  async moveNote(noteId: string, folderId: number | null): Promise<{ success: boolean }> {
    const res = await authFetch(`${getApiBaseUrl()}/api/notes/folders/move-note`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: noteId, folder_id: folderId }),
    });
    return res.json();
  },
};
