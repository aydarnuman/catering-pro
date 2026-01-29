-- ============================================
-- UNIFIED NOTES SYSTEM - SUPABASE MIGRATION
-- Migration: 20260128000110_unified_notes_system.sql
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main unified_notes table
CREATE TABLE IF NOT EXISTS unified_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context_type VARCHAR(50) DEFAULT NULL,
    context_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    content_format VARCHAR(20) DEFAULT 'plain',
    is_task BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    priority VARCHAR(10) DEFAULT 'normal',
    color VARCHAR(20) DEFAULT 'blue',
    pinned BOOLEAN DEFAULT FALSE,
    due_date TIMESTAMP,
    reminder_date TIMESTAMP,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_context CHECK (
        (context_type IS NULL AND context_id IS NULL) OR
        (context_type IS NOT NULL AND context_id IS NOT NULL)
    )
);

-- Tags master table
CREATE TABLE IF NOT EXISTS note_tags_master (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Note-tag junction
CREATE TABLE IF NOT EXISTS note_tags (
    note_id UUID NOT NULL REFERENCES unified_notes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES note_tags_master(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- Attachments
CREATE TABLE IF NOT EXISTS unified_note_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES unified_notes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),
    thumbnail_path TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reminders
CREATE TABLE IF NOT EXISTS unified_note_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES unified_notes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_date TIMESTAMP NOT NULL,
    reminder_type VARCHAR(20) DEFAULT 'notification',
    reminder_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unified_notes_user ON unified_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_notes_context ON unified_notes(context_type, context_id) WHERE context_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_notes_personal ON unified_notes(user_id, pinned DESC, sort_order ASC) WHERE context_type IS NULL;
CREATE INDEX IF NOT EXISTS idx_unified_notes_due_date ON unified_notes(due_date) WHERE due_date IS NOT NULL AND is_completed = FALSE;
CREATE INDEX IF NOT EXISTS idx_unified_notes_reminder ON unified_notes(reminder_date) WHERE reminder_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_notes_task ON unified_notes(user_id, is_completed) WHERE is_task = TRUE;
CREATE INDEX IF NOT EXISTS idx_unified_notes_pinned ON unified_notes(user_id, pinned) WHERE pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_note_tags_master_user ON note_tags_master(user_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_unified_note_attachments_note ON unified_note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_unified_note_reminders_pending ON unified_note_reminders(reminder_date) WHERE reminder_sent = FALSE;

-- Updated at trigger
CREATE OR REPLACE FUNCTION set_unified_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unified_notes_updated_at ON unified_notes;
CREATE TRIGGER trigger_unified_notes_updated_at
    BEFORE UPDATE ON unified_notes
    FOR EACH ROW
    EXECUTE FUNCTION set_unified_notes_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE unified_notes;
