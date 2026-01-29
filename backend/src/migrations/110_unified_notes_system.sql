-- ============================================
-- UNIFIED NOTES SYSTEM - SCHEMA
-- Migration: 110_unified_notes_system.sql
-- Description: Creates unified notes tables that merge
--              personal notes (notlar) and tender notes
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. MAIN TABLE: unified_notes
-- ============================================
CREATE TABLE IF NOT EXISTS unified_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Context: NULL for personal notes, or entity reference
    context_type VARCHAR(50) DEFAULT NULL,  -- 'tender', 'customer', 'event', 'project', etc.
    context_id INTEGER DEFAULT NULL,        -- ID of the related entity

    -- Core Content
    content TEXT NOT NULL,
    content_format VARCHAR(20) DEFAULT 'plain',  -- 'plain', 'markdown'

    -- Task/Todo Properties
    is_task BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,

    -- Organization
    priority VARCHAR(10) DEFAULT 'normal',  -- 'low', 'normal', 'high', 'urgent'
    color VARCHAR(20) DEFAULT 'blue',       -- 'blue', 'green', 'yellow', 'orange', 'red', 'violet', 'pink', 'purple'
    pinned BOOLEAN DEFAULT FALSE,

    -- Dates
    due_date TIMESTAMP,
    reminder_date TIMESTAMP,

    -- Ordering (for drag-drop)
    sort_order INTEGER DEFAULT 0,

    -- Metadata for future extensibility
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_context CHECK (
        (context_type IS NULL AND context_id IS NULL) OR
        (context_type IS NOT NULL AND context_id IS NOT NULL)
    ),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT valid_content_format CHECK (content_format IN ('plain', 'markdown'))
);

-- Comment on table
COMMENT ON TABLE unified_notes IS 'Unified notes system - supports both personal notes and context-bound notes (tenders, customers, etc.)';

-- ============================================
-- 2. INDEXES FOR unified_notes
-- ============================================

-- User index
CREATE INDEX IF NOT EXISTS idx_unified_notes_user ON unified_notes(user_id);

-- Context index (for entity-bound notes)
CREATE INDEX IF NOT EXISTS idx_unified_notes_context ON unified_notes(context_type, context_id)
    WHERE context_type IS NOT NULL;

-- Personal notes index (optimized for listing)
CREATE INDEX IF NOT EXISTS idx_unified_notes_personal ON unified_notes(user_id, pinned DESC, sort_order ASC)
    WHERE context_type IS NULL;

-- Due date index (for calendar/agenda views)
CREATE INDEX IF NOT EXISTS idx_unified_notes_due_date ON unified_notes(due_date)
    WHERE due_date IS NOT NULL AND is_completed = FALSE;

-- Reminder index (for notification system)
CREATE INDEX IF NOT EXISTS idx_unified_notes_reminder ON unified_notes(reminder_date)
    WHERE reminder_date IS NOT NULL;

-- Task index (for todo lists)
CREATE INDEX IF NOT EXISTS idx_unified_notes_task ON unified_notes(user_id, is_completed)
    WHERE is_task = TRUE;

-- Pinned index
CREATE INDEX IF NOT EXISTS idx_unified_notes_pinned ON unified_notes(user_id, pinned)
    WHERE pinned = TRUE;

-- Full-text search on content
CREATE INDEX IF NOT EXISTS idx_unified_notes_content_search ON unified_notes
    USING gin(to_tsvector('simple', content));

-- ============================================
-- 3. TAGS MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS note_tags_master (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

COMMENT ON TABLE note_tags_master IS 'Master list of tags per user';

-- Indexes for tags master
CREATE INDEX IF NOT EXISTS idx_note_tags_master_user ON note_tags_master(user_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_master_usage ON note_tags_master(user_id, usage_count DESC);

-- ============================================
-- 4. NOTE-TAG JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS note_tags (
    note_id UUID NOT NULL REFERENCES unified_notes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES note_tags_master(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

COMMENT ON TABLE note_tags IS 'Junction table linking notes to tags';

-- Indexes for note tags
CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);

-- ============================================
-- 5. ATTACHMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS unified_note_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES unified_notes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),

    -- Optional thumbnail for images
    thumbnail_path TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE unified_note_attachments IS 'File attachments for notes';

-- Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_unified_note_attachments_note ON unified_note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_unified_note_attachments_user ON unified_note_attachments(user_id);

-- ============================================
-- 6. REMINDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS unified_note_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES unified_notes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    reminder_date TIMESTAMP NOT NULL,
    reminder_type VARCHAR(20) DEFAULT 'notification',  -- 'notification', 'email', 'both'
    reminder_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('notification', 'email', 'both'))
);

COMMENT ON TABLE unified_note_reminders IS 'Scheduled reminders for notes';

-- Indexes for reminders
CREATE INDEX IF NOT EXISTS idx_unified_note_reminders_pending ON unified_note_reminders(reminder_date)
    WHERE reminder_sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_unified_note_reminders_user ON unified_note_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_note_reminders_note ON unified_note_reminders(note_id);

-- ============================================
-- 7. UPDATED_AT TRIGGER
-- ============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION set_unified_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_unified_notes_updated_at ON unified_notes;
CREATE TRIGGER trigger_unified_notes_updated_at
    BEFORE UPDATE ON unified_notes
    FOR EACH ROW
    EXECUTE FUNCTION set_unified_notes_updated_at();

-- ============================================
-- 8. HELPER VIEWS
-- ============================================

-- View: Notes with tags, attachments, and reminders
CREATE OR REPLACE VIEW unified_notes_full AS
SELECT
    n.*,
    COALESCE(
        (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
         FROM note_tags nt
         JOIN note_tags_master t ON nt.tag_id = t.id
         WHERE nt.note_id = n.id),
        '[]'::json
    ) as tags,
    COALESCE(
        (SELECT json_agg(json_build_object(
            'id', a.id,
            'filename', a.filename,
            'original_filename', a.original_filename,
            'file_type', a.file_type,
            'file_size', a.file_size
        ))
         FROM unified_note_attachments a
         WHERE a.note_id = n.id),
        '[]'::json
    ) as attachments,
    COALESCE(
        (SELECT json_agg(json_build_object(
            'id', r.id,
            'reminder_date', r.reminder_date,
            'reminder_type', r.reminder_type,
            'reminder_sent', r.reminder_sent
        ))
         FROM unified_note_reminders r
         WHERE r.note_id = n.id AND r.reminder_sent = FALSE),
        '[]'::json
    ) as reminders
FROM unified_notes n;

-- View: Personal notes (for agenda/todo)
CREATE OR REPLACE VIEW personal_notes_agenda AS
SELECT * FROM unified_notes_full
WHERE context_type IS NULL
ORDER BY pinned DESC NULLS LAST,
         CASE WHEN due_date IS NOT NULL AND due_date <= NOW() + INTERVAL '7 days' THEN 0 ELSE 1 END,
         due_date ASC NULLS LAST,
         sort_order ASC,
         created_at DESC;

-- View: Popular tags per user
CREATE OR REPLACE VIEW popular_user_tags AS
SELECT
    user_id,
    id,
    name,
    color,
    usage_count
FROM note_tags_master
ORDER BY user_id, usage_count DESC, name ASC;

-- ============================================
-- 9. FUNCTIONS FOR TAG MANAGEMENT
-- ============================================

-- Function to get or create tag
CREATE OR REPLACE FUNCTION get_or_create_tag(
    p_user_id INTEGER,
    p_tag_name VARCHAR(100),
    p_color VARCHAR(20) DEFAULT 'gray'
)
RETURNS INTEGER AS $$
DECLARE
    v_tag_id INTEGER;
BEGIN
    -- Try to find existing tag
    SELECT id INTO v_tag_id
    FROM note_tags_master
    WHERE user_id = p_user_id AND LOWER(name) = LOWER(p_tag_name);

    -- If not found, create it
    IF v_tag_id IS NULL THEN
        INSERT INTO note_tags_master (user_id, name, color)
        VALUES (p_user_id, p_tag_name, p_color)
        RETURNING id INTO v_tag_id;
    END IF;

    RETURN v_tag_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update tag usage counts
CREATE OR REPLACE FUNCTION update_tag_usage_count(p_tag_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE note_tags_master
    SET usage_count = (
        SELECT COUNT(*) FROM note_tags WHERE tag_id = p_tag_id
    )
    WHERE id = p_tag_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update tag usage count on note_tags changes
CREATE OR REPLACE FUNCTION trigger_update_tag_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM update_tag_usage_count(NEW.tag_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_tag_usage_count(OLD.tag_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_note_tags_usage ON note_tags;
CREATE TRIGGER trigger_note_tags_usage
    AFTER INSERT OR DELETE ON note_tags
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_tag_usage();

-- ============================================
-- 10. ENABLE REALTIME (SUPABASE)
-- ============================================

-- Enable realtime for unified_notes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'unified_notes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE unified_notes;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        -- Publication doesn't exist, skip
        NULL;
END $$;

-- ============================================
-- 11. ROW LEVEL SECURITY (Optional)
-- ============================================

-- Enable RLS on unified_notes
ALTER TABLE unified_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notes
CREATE POLICY unified_notes_user_policy ON unified_notes
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::integer)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::integer);

-- Policy for note_tags_master
ALTER TABLE note_tags_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY note_tags_master_user_policy ON note_tags_master
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::integer)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::integer);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
