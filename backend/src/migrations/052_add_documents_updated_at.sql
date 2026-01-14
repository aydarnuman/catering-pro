-- Documents tablosuna updated_at kolonu ekle
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Mevcut kayıtlar için updated_at = created_at yap
UPDATE documents 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Trigger: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_documents_updated_at ON documents;

CREATE TRIGGER trigger_update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_documents_updated_at();
