/**
 * Unified Notes API Service
 */

import { authFetch } from '@/lib/api';
import { getApiBaseUrlDynamic } from '@/lib/config';
import type {
  CreateNoteDTO,
  NoteAttachment,
  NoteReminder,
  NoteResponse,
  NotesFilter,
  NotesListResponse,
  NoteTag,
  RemindersResponse,
  TagSuggestionsResponse,
  TagsResponse,
  UpdateNoteDTO,
} from '@/types/notes';

const getApiBaseUrl = () => getApiBaseUrlDynamic() || '';

/**
 * Build query string from filter object
 */
function buildQueryString(filter?: Record<string, unknown>): string {
  if (!filter) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => {
          params.append(key, String(v));
        });
      } else {
        params.append(key, String(value));
      }
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export const notesAPI = {
  // ========== PERSONAL NOTES ==========

  /**
   * Get personal notes with optional filtering
   */
  async getNotes(filter?: NotesFilter): Promise<NotesListResponse> {
    const queryString = buildQueryString(filter as Record<string, unknown>);
    const response = await authFetch(`${getApiBaseUrl()}/api/notes${queryString}`);
    return response.json();
  },

  /**
   * Get a single note by ID
   */
  async getNoteById(id: string): Promise<NoteResponse> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/${id}`);
    return response.json();
  },

  /**
   * Create a new personal note
   */
  async createNote(data: CreateNoteDTO): Promise<NoteResponse> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * Update a note
   */
  async updateNote(id: string, data: UpdateNoteDTO): Promise<NoteResponse> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * Delete a note
   */
  async deleteNote(id: string): Promise<{ success: boolean; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  /**
   * Toggle note completion status
   */
  async toggleComplete(id: string): Promise<NoteResponse> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/${id}/toggle`, {
      method: 'PUT',
    });
    return response.json();
  },

  /**
   * Toggle note pin status
   */
  async togglePin(id: string): Promise<NoteResponse> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/${id}/pin`, {
      method: 'PUT',
    });
    return response.json();
  },

  /**
   * Reorder personal notes (drag-drop)
   */
  async reorderNotes(noteIds: string[]): Promise<{ success: boolean; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteIds }),
    });
    return response.json();
  },

  /**
   * Delete all completed notes
   */
  async deleteCompleted(): Promise<{ success: boolean; deleted: number; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/completed`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // ========== CONTEXT NOTES ==========

  /**
   * Get notes for a specific context (tender, customer, etc.)
   */
  async getContextNotes(
    contextType: string,
    contextId: number,
    filter?: Omit<NotesFilter, 'context_type' | 'context_id'>
  ): Promise<NotesListResponse> {
    const queryString = buildQueryString(filter as Record<string, unknown>);
    const response = await authFetch(
      `${getApiBaseUrl()}/api/notes/context/${contextType}/${contextId}${queryString}`
    );
    return response.json();
  },

  /**
   * Create a note for a specific context
   */
  async createContextNote(
    contextType: string,
    contextId: number,
    data: CreateNoteDTO
  ): Promise<NoteResponse> {
    const response = await authFetch(
      `${getApiBaseUrl()}/api/notes/context/${contextType}/${contextId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    return response.json();
  },

  /**
   * Reorder notes for a specific context
   */
  async reorderContextNotes(
    contextType: string,
    contextId: number,
    noteIds: string[]
  ): Promise<{ success: boolean; message: string }> {
    const response = await authFetch(
      `${getApiBaseUrl()}/api/notes/context/${contextType}/${contextId}/reorder`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteIds }),
      }
    );
    return response.json();
  },

  // ========== TAGS ==========

  /**
   * Get all user tags
   */
  async getTags(): Promise<TagsResponse> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/tags`);
    return response.json();
  },

  /**
   * Get tag suggestions for autocomplete
   */
  async getTagSuggestions(query?: string): Promise<TagSuggestionsResponse> {
    const queryString = query ? `?q=${encodeURIComponent(query)}` : '';
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/tags/suggestions${queryString}`);
    return response.json();
  },

  /**
   * Create a new tag
   */
  async createTag(
    name: string,
    color?: string
  ): Promise<{ success: boolean; tag: NoteTag; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    return response.json();
  },

  /**
   * Update a tag
   */
  async updateTag(
    tagId: number,
    data: { name?: string; color?: string }
  ): Promise<{ success: boolean; tag: NoteTag; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/tags/${tagId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * Delete a tag
   */
  async deleteTag(tagId: number): Promise<{ success: boolean; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/tags/${tagId}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // ========== REMINDERS ==========

  /**
   * Get upcoming reminders
   */
  async getUpcomingReminders(limit?: number): Promise<RemindersResponse> {
    const queryString = limit ? `?limit=${limit}` : '';
    const response = await authFetch(
      `${getApiBaseUrl()}/api/notes/reminders/upcoming${queryString}`
    );
    return response.json();
  },

  /**
   * Get due reminders (for notification system)
   */
  async getDueReminders(): Promise<RemindersResponse> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/reminders/due`);
    return response.json();
  },

  /**
   * Add a reminder to a note
   */
  async addReminder(
    noteId: string,
    reminderDate: string,
    reminderType?: 'notification' | 'email' | 'both'
  ): Promise<{ success: boolean; reminder: NoteReminder; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/reminders/${noteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reminder_date: reminderDate,
        reminder_type: reminderType,
      }),
    });
    return response.json();
  },

  /**
   * Mark a reminder as sent
   */
  async markReminderSent(
    reminderId: string
  ): Promise<{ success: boolean; reminder: NoteReminder; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/reminders/${reminderId}/sent`, {
      method: 'PUT',
    });
    return response.json();
  },

  /**
   * Delete a reminder
   */
  async deleteReminder(reminderId: string): Promise<{ success: boolean; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/reminders/${reminderId}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // ========== ATTACHMENTS ==========

  /**
   * Upload a file attachment to a note
   */
  async uploadAttachment(
    noteId: string,
    file: File
  ): Promise<{ success: boolean; attachment: NoteAttachment; message: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authFetch(`${getApiBaseUrl()}/api/notes/attachments/${noteId}`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type - browser will set it with boundary for FormData
    });
    return response.json();
  },

  /**
   * Get download URL for an attachment
   */
  getAttachmentDownloadUrl(attachmentId: string): string {
    return `${getApiBaseUrl()}/api/notes/attachments/${attachmentId}/download`;
  },

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: string): Promise<{ success: boolean; message: string }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  /**
   * List attachments for a note
   */
  async getNoteAttachments(
    noteId: string
  ): Promise<{ success: boolean; attachments: NoteAttachment[] }> {
    const response = await authFetch(`${getApiBaseUrl()}/api/notes/attachments/note/${noteId}`);
    return response.json();
  },
};

export default notesAPI;
