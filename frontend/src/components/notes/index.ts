/**
 * Unified Notes Components - Barrel Export
 */

export { NoteCard } from './NoteCard';
export { NoteEditor } from './NoteEditor';
export { NoteColorPicker } from './NoteColorPicker';
export { NotePrioritySelect } from './NotePrioritySelect';
export { NoteTagsInput } from './NoteTagsInput';
export { UnifiedNotesModal } from './UnifiedNotesModal';
export { ContextualNotesSection } from './ContextualNotesSection';

// Re-export types
export type {
  UnifiedNote,
  CreateNoteDTO,
  UpdateNoteDTO,
  NotesFilter,
  NoteTag,
  NoteAttachment,
  NoteReminder,
  NoteColor,
  NotePriority,
  NoteContentFormat,
  NoteContextType,
} from '@/types/notes';

// Re-export constants
export {
  NOTE_COLORS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
} from '@/types/notes';
