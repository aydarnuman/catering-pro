-- ============================================
-- NOTE FOLDERS SYSTEM
-- Klasor bazli not organizasyonu + sifre korumasi
-- ============================================

-- Folders table
CREATE TABLE IF NOT EXISTS note_folders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT 'blue',
    icon VARCHAR(50) DEFAULT 'folder',
    password_hash VARCHAR(255) DEFAULT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_note_folders_user ON note_folders(user_id);

-- Add folder_id to unified_notes
ALTER TABLE unified_notes ADD COLUMN IF NOT EXISTS folder_id INTEGER
    REFERENCES note_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_unified_notes_folder ON unified_notes(folder_id);

-- Add title column if missing
ALTER TABLE unified_notes ADD COLUMN IF NOT EXISTS title VARCHAR(500) DEFAULT NULL;
