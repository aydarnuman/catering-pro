/**
 * Unified Notes Components - Barrel Export
 */

// Re-export types
export type {
  CreateNoteDTO,
  NoteAttachment,
  NoteColor,
  NoteContentFormat,
  NoteContextType,
  NotePriority,
  NoteReminder,
  NotesFilter,
  NoteTag,
  UnifiedNote,
  UpdateNoteDTO,
} from '@/types/notes';
// Re-export constants
export {
  NOTE_COLORS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
} from '@/types/notes';
export { ContextualNotesSection } from './ContextualNotesSection';
export { NoteCard } from './NoteCard';
export { NoteColorPicker } from './NoteColorPicker';
export { NoteEditor } from './NoteEditor';
export { NotePrioritySelect } from './NotePrioritySelect';
export { NoteTagsInput } from './NoteTagsInput';
export { UnifiedNotesModal } from './UnifiedNotesModal';
