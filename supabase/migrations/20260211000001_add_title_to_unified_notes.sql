-- Add title column to unified_notes for Orbit Ring attachment system
ALTER TABLE unified_notes ADD COLUMN IF NOT EXISTS title VARCHAR(255);
