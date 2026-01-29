/**
 * Unified Notes System - Type Definitions
 */

// Note Colors - Extended palette
export type NoteColor =
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'violet'
  | 'pink'
  | 'purple'
  | 'gray';

// Priority levels
export type NotePriority = 'low' | 'normal' | 'high' | 'urgent';

// Content format
export type NoteContentFormat = 'plain' | 'markdown';

// Context types - what entity the note is attached to
export type NoteContextType = 'tender' | 'customer' | 'event' | 'project' | null;

// Reminder types
export type NoteReminderType = 'notification' | 'email' | 'both';

/**
 * Tag interface
 */
export interface NoteTag {
  id: number;
  name: string;
  color: string;
  usage_count?: number;
}

/**
 * Attachment interface
 */
export interface NoteAttachment {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
}

/**
 * Reminder interface
 */
export interface NoteReminder {
  id: string;
  reminder_date: string;
  reminder_type: NoteReminderType;
  reminder_sent: boolean;
}

/**
 * Main Unified Note interface
 */
export interface UnifiedNote {
  id: string;
  user_id: number;
  context_type: NoteContextType;
  context_id: number | null;
  content: string;
  content_format: NoteContentFormat;
  is_task: boolean;
  is_completed: boolean;
  completed_at: string | null;
  priority: NotePriority;
  color: NoteColor;
  pinned: boolean;
  due_date: string | null;
  reminder_date: string | null;
  sort_order: number;
  metadata?: Record<string, unknown>;
  tags: NoteTag[];
  attachments: NoteAttachment[];
  reminders: NoteReminder[];
  created_at: string;
  updated_at: string;
}

/**
 * DTO for creating a note
 */
export interface CreateNoteDTO {
  content: string;
  content_format?: NoteContentFormat;
  is_task?: boolean;
  priority?: NotePriority;
  color?: NoteColor;
  pinned?: boolean;
  due_date?: string | null;
  reminder_date?: string | null;
  tags?: string[];
}

/**
 * DTO for updating a note
 */
export interface UpdateNoteDTO extends Partial<CreateNoteDTO> {
  is_completed?: boolean;
  sort_order?: number;
}

/**
 * Filter options for listing notes
 */
export interface NotesFilter {
  context_type?: NoteContextType;
  context_id?: number;
  is_task?: boolean;
  is_completed?: boolean;
  priority?: NotePriority;
  color?: NoteColor;
  pinned?: boolean;
  due_date_from?: string;
  due_date_to?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * API Response for notes list
 */
export interface NotesListResponse {
  success: boolean;
  notes: UnifiedNote[];
  total: number;
  limit?: number;
  offset?: number;
  context_type?: string;
  context_id?: number;
}

/**
 * API Response for single note
 */
export interface NoteResponse {
  success: boolean;
  note: UnifiedNote;
  message?: string;
}

/**
 * API Response for tags
 */
export interface TagsResponse {
  success: boolean;
  tags: NoteTag[];
}

/**
 * API Response for tag suggestions
 */
export interface TagSuggestionsResponse {
  success: boolean;
  suggestions: NoteTag[];
}

/**
 * API Response for reminders
 */
export interface RemindersResponse {
  success: boolean;
  reminders: Array<
    NoteReminder & {
      note_id: string;
      content: string;
      content_format: NoteContentFormat;
      priority: NotePriority;
      color: NoteColor;
      context_type: NoteContextType;
      context_id: number | null;
    }
  >;
}

/**
 * Note color configuration
 */
export interface NoteColorConfig {
  bg: string;
  border: string;
  accent: string;
  name: string;
}

/**
 * Color constants with styling
 */
export const NOTE_COLORS: Record<NoteColor, NoteColorConfig> = {
  yellow: {
    bg: 'linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)',
    border: '#fbc02d',
    accent: '#f57f17',
    name: 'Sari',
  },
  blue: {
    bg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    border: '#42a5f5',
    accent: '#1565c0',
    name: 'Mavi',
  },
  green: {
    bg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
    border: '#66bb6a',
    accent: '#2e7d32',
    name: 'Yesil',
  },
  pink: {
    bg: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)',
    border: '#ec407a',
    accent: '#c2185b',
    name: 'Pembe',
  },
  orange: {
    bg: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
    border: '#ffa726',
    accent: '#e65100',
    name: 'Turuncu',
  },
  purple: {
    bg: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
    border: '#ab47bc',
    accent: '#7b1fa2',
    name: 'Mor',
  },
  red: {
    bg: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
    border: '#ef5350',
    accent: '#c62828',
    name: 'Kirmizi',
  },
  violet: {
    bg: 'linear-gradient(135deg, #ede7f6 0%, #d1c4e9 100%)',
    border: '#7e57c2',
    accent: '#512da8',
    name: 'Eflatun',
  },
  gray: {
    bg: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
    border: '#9e9e9e',
    accent: '#616161',
    name: 'Gri',
  },
};

/**
 * Priority color mapping
 */
export const PRIORITY_COLORS: Record<NotePriority, string> = {
  urgent: '#dc2626',
  high: '#ef4444',
  normal: '#8b5cf6',
  low: '#6b7280',
};

/**
 * Priority labels (Turkish)
 */
export const PRIORITY_LABELS: Record<NotePriority, string> = {
  urgent: 'Acil',
  high: 'Yuksek',
  normal: 'Normal',
  low: 'Dusuk',
};
