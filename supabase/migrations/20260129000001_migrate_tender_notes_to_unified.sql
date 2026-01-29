-- Migration: tender_tracking.user_notes (JSONB) → unified_notes tablosuna taşı
-- Bu migration mevcut ihale notlarını unified_notes sistemine aktarır

-- 1. Mevcut JSONB notlarını unified_notes'a taşı
INSERT INTO unified_notes (
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
    sort_order,
    metadata,
    created_at,
    updated_at
)
SELECT
    COALESCE(tt.user_id, 1) as user_id,
    'tender' as context_type,
    tt.tender_id as context_id,
    (note->>'text')::text as content,
    'plain' as content_format,
    false as is_task,
    false as is_completed,
    'normal' as priority,
    COALESCE(note->>'color', 'yellow') as color,
    COALESCE((note->>'pinned')::boolean, false) as pinned,
    COALESCE((note->>'order')::int, row_number() OVER (PARTITION BY tt.id ORDER BY (note->>'created_at')::timestamp)) as sort_order,
    jsonb_build_object(
        'migrated_from', 'tender_tracking.user_notes',
        'original_id', note->>'id',
        'tracking_id', tt.id
    ) as metadata,
    COALESCE((note->>'created_at')::timestamp, NOW()) as created_at,
    COALESCE((note->>'updated_at')::timestamp, NOW()) as updated_at
FROM tender_tracking tt,
     jsonb_array_elements(COALESCE(tt.user_notes, '[]'::jsonb)) as note
WHERE tt.user_notes IS NOT NULL
  AND jsonb_array_length(tt.user_notes) > 0
  AND (note->>'text') IS NOT NULL
  AND (note->>'text') != ''
ON CONFLICT DO NOTHING;

-- 2. Migration log
DO $$
DECLARE
    migrated_count INT;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM unified_notes
    WHERE metadata->>'migrated_from' = 'tender_tracking.user_notes';

    RAISE NOTICE 'Migrated % notes from tender_tracking.user_notes to unified_notes', migrated_count;
END $$;

-- 3. NOT: user_notes sütununu silmiyoruz (backup olarak kalacak)
-- İleride temizlik için: ALTER TABLE tender_tracking DROP COLUMN user_notes;

COMMENT ON TABLE unified_notes IS 'Unified notes system - all notes (personal and contextual) are stored here. Migrated from tender_tracking.user_notes on 2026-01-29.';
