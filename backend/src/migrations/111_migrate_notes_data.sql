-- ============================================
-- UNIFIED NOTES SYSTEM - DATA MIGRATION
-- Migration: 111_migrate_notes_data.sql
-- Description: Migrates data from old notes systems
--              (notlar table and tender_tracking.user_notes JSONB)
--              to the new unified_notes table
-- ============================================

-- Note: Run this migration AFTER 110_unified_notes_system.sql
-- and AFTER verifying the new tables are created

-- ============================================
-- STEP 1: Migrate personal notes from 'notlar' table
-- ============================================

INSERT INTO unified_notes (
    id,
    user_id,
    context_type,
    context_id,
    content,
    content_format,
    is_task,
    is_completed,
    completed_at,
    priority,
    color,
    pinned,
    due_date,
    sort_order,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    COALESCE(user_id, 1),  -- Default to user 1 if null
    NULL,  -- Personal note (no context)
    NULL,
    content,
    'plain',  -- Old notlar used plain text
    TRUE,  -- Old notlar were task-oriented
    COALESCE(is_completed, FALSE),
    CASE WHEN is_completed THEN updated_at ELSE NULL END,
    COALESCE(priority, 'normal'),
    COALESCE(color, 'blue'),
    COALESCE(pinned, FALSE),
    due_date::timestamp,
    id,  -- Use old sequential ID as sort order
    COALESCE(created_at, NOW()),
    COALESCE(updated_at, NOW())
FROM notlar
WHERE content IS NOT NULL AND content != ''
ON CONFLICT DO NOTHING;

-- Log migration count
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM unified_notes
    WHERE context_type IS NULL;

    RAISE NOTICE 'Migrated % personal notes from notlar table', migrated_count;
END $$;

-- ============================================
-- STEP 2: Migrate tender notes from JSONB
-- ============================================

DO $$
DECLARE
    rec RECORD;
    note_elem JSONB;
    new_note_id UUID;
    tag_name TEXT;
    tag_id_val INTEGER;
    note_count INTEGER := 0;
    tag_count INTEGER := 0;
    attachment_count INTEGER := 0;
    reminder_count INTEGER := 0;
BEGIN
    -- Loop through tender_tracking records with user_notes
    FOR rec IN
        SELECT
            tt.id as tracking_id,
            tt.user_id,
            tt.tender_id,
            jsonb_array_elements(COALESCE(tt.user_notes, '[]'::jsonb)) as note_elem
        FROM tender_tracking tt
        WHERE tt.user_notes IS NOT NULL
          AND tt.user_notes != '[]'::jsonb
          AND jsonb_array_length(tt.user_notes) > 0
    LOOP
        note_elem := rec.note_elem;

        -- Skip if no text content
        IF (note_elem->>'text' IS NULL OR note_elem->>'text' = '')
           AND (note_elem->>'not' IS NULL OR note_elem->>'not' = '') THEN
            CONTINUE;
        END IF;

        new_note_id := gen_random_uuid();

        -- Insert the note
        INSERT INTO unified_notes (
            id,
            user_id,
            context_type,
            context_id,
            content,
            content_format,
            is_task,
            is_completed,
            priority,
            color,
            pinned,
            due_date,
            reminder_date,
            sort_order,
            created_at,
            updated_at
        ) VALUES (
            new_note_id,
            COALESCE(rec.user_id, 1),
            'tender',
            rec.tender_id,
            COALESCE(note_elem->>'text', note_elem->>'not', ''),
            'markdown',  -- Tender notes supported markdown
            FALSE,  -- Tender notes were not task-oriented
            FALSE,
            'normal',
            COALESCE(note_elem->>'color', 'yellow'),
            COALESCE((note_elem->>'pinned')::boolean, FALSE),
            NULL,  -- Tender notes didn't have due dates
            CASE WHEN note_elem->>'reminder_date' IS NOT NULL
                 THEN (note_elem->>'reminder_date')::timestamp
                 ELSE NULL END,
            COALESCE((note_elem->>'order')::integer, 0),
            COALESCE((note_elem->>'created_at')::timestamp, NOW()),
            COALESCE((note_elem->>'updated_at')::timestamp, NOW())
        );

        note_count := note_count + 1;

        -- Migrate tags
        IF jsonb_typeof(note_elem->'tags') = 'array' THEN
            FOR tag_name IN SELECT jsonb_array_elements_text(note_elem->'tags')
            LOOP
                IF tag_name IS NOT NULL AND tag_name != '' THEN
                    -- Get or create tag
                    INSERT INTO note_tags_master (user_id, name, color)
                    VALUES (COALESCE(rec.user_id, 1), tag_name, 'gray')
                    ON CONFLICT (user_id, name)
                    DO UPDATE SET usage_count = note_tags_master.usage_count + 1
                    RETURNING id INTO tag_id_val;

                    -- Link tag to note
                    INSERT INTO note_tags (note_id, tag_id)
                    VALUES (new_note_id, tag_id_val)
                    ON CONFLICT DO NOTHING;

                    tag_count := tag_count + 1;
                END IF;
            END LOOP;
        END IF;

        -- Migrate reminder (create in reminders table)
        IF note_elem->>'reminder_date' IS NOT NULL THEN
            INSERT INTO unified_note_reminders (
                id,
                note_id,
                user_id,
                reminder_date,
                reminder_type,
                reminder_sent,
                created_at
            ) VALUES (
                gen_random_uuid(),
                new_note_id,
                COALESCE(rec.user_id, 1),
                (note_elem->>'reminder_date')::timestamp,
                'notification',
                FALSE,
                NOW()
            );
            reminder_count := reminder_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Migrated % tender notes', note_count;
    RAISE NOTICE 'Created % tag associations', tag_count;
    RAISE NOTICE 'Created % reminders', reminder_count;
END $$;

-- ============================================
-- STEP 3: Migrate attachments
-- ============================================

-- Create mapping table for old note_id to new UUID
CREATE TEMP TABLE note_id_mapping AS
SELECT
    un.id as new_note_id,
    tt.id as tracking_id,
    (elem->>'id') as old_note_id
FROM unified_notes un
JOIN tender_tracking tt ON un.context_id = tt.tender_id AND un.context_type = 'tender'
CROSS JOIN jsonb_array_elements(tt.user_notes) elem
WHERE (elem->>'id') IS NOT NULL;

-- Migrate attachments using mapping
INSERT INTO unified_note_attachments (
    id,
    note_id,
    user_id,
    filename,
    original_filename,
    file_path,
    file_size,
    file_type,
    created_at
)
SELECT
    gen_random_uuid(),
    nim.new_note_id,
    COALESCE(na.user_id, tt.user_id, 1),
    na.filename,
    COALESCE(na.original_filename, na.filename),
    na.file_path,
    na.file_size,
    na.file_type,
    COALESCE(na.created_at, NOW())
FROM note_attachments na
JOIN tender_tracking tt ON na.tracking_id = tt.id
JOIN note_id_mapping nim ON na.tracking_id = nim.tracking_id AND na.note_id = nim.old_note_id
WHERE na.filename IS NOT NULL
ON CONFLICT DO NOTHING;

-- Log attachment migration
DO $$
DECLARE
    att_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO att_count FROM unified_note_attachments;
    RAISE NOTICE 'Migrated % attachments', att_count;
END $$;

-- Clean up temp table
DROP TABLE IF EXISTS note_id_mapping;

-- ============================================
-- STEP 4: Migrate old reminders table data
-- ============================================

-- Map old note_reminders to new system
INSERT INTO unified_note_reminders (
    id,
    note_id,
    user_id,
    reminder_date,
    reminder_type,
    reminder_sent,
    created_at
)
SELECT
    gen_random_uuid(),
    un.id,
    COALESCE(nr.user_id, 1),
    nr.reminder_date,
    'notification',
    COALESCE(nr.reminder_sent, FALSE),
    COALESCE(nr.created_at, NOW())
FROM note_reminders nr
JOIN tender_tracking tt ON nr.tracking_id = tt.id
JOIN unified_notes un ON un.context_type = 'tender'
    AND un.context_id = tt.tender_id
    AND un.content = COALESCE(
        (SELECT elem->>'text' FROM jsonb_array_elements(tt.user_notes) elem WHERE (elem->>'id') = nr.note_id LIMIT 1),
        (SELECT elem->>'not' FROM jsonb_array_elements(tt.user_notes) elem WHERE (elem->>'id') = nr.note_id LIMIT 1),
        ''
    )
WHERE nr.reminder_date IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM unified_note_reminders unr
      WHERE unr.note_id = un.id
        AND unr.reminder_date = nr.reminder_date
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 5: Verification queries
-- ============================================

DO $$
DECLARE
    old_personal_count INTEGER;
    new_personal_count INTEGER;
    old_tender_count INTEGER;
    new_tender_count INTEGER;
BEGIN
    -- Count old personal notes
    SELECT COUNT(*) INTO old_personal_count FROM notlar WHERE content IS NOT NULL AND content != '';

    -- Count new personal notes
    SELECT COUNT(*) INTO new_personal_count FROM unified_notes WHERE context_type IS NULL;

    -- Count old tender notes (approximate)
    SELECT COALESCE(SUM(jsonb_array_length(COALESCE(user_notes, '[]'::jsonb))), 0)
    INTO old_tender_count
    FROM tender_tracking
    WHERE user_notes IS NOT NULL AND user_notes != '[]'::jsonb;

    -- Count new tender notes
    SELECT COUNT(*) INTO new_tender_count FROM unified_notes WHERE context_type = 'tender';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Personal notes: old=% new=%', old_personal_count, new_personal_count;
    RAISE NOTICE 'Tender notes: old~% new=%', old_tender_count, new_tender_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 6: Create backup of old tables (optional)
-- ============================================

-- Rename old tables as backup (uncomment if needed)
-- ALTER TABLE notlar RENAME TO notlar_backup_v1;
-- Note: tender_tracking.user_notes column is kept as is for now

-- Add comment to indicate migration status
COMMENT ON TABLE unified_notes IS 'Unified notes system - migrated from notlar and tender_tracking.user_notes on ' || NOW()::text;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Final counts
SELECT
    'unified_notes' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE context_type IS NULL) as personal_notes,
    COUNT(*) FILTER (WHERE context_type = 'tender') as tender_notes
FROM unified_notes;

SELECT
    'note_tags_master' as table_name,
    COUNT(*) as total_tags
FROM note_tags_master;

SELECT
    'unified_note_attachments' as table_name,
    COUNT(*) as total_attachments
FROM unified_note_attachments;

SELECT
    'unified_note_reminders' as table_name,
    COUNT(*) as total_reminders
FROM unified_note_reminders;
