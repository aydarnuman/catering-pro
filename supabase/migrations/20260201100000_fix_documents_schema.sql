-- =============================================================================
-- Migration: Fix Documents Schema
-- Description: Eksik kolonları ekler ve gerekli trigger'ları oluşturur
-- Created: 2026-02-01
-- =============================================================================

-- 1. Documents tablosu eksik kolonları
-- =============================================================================

-- source_type kolonu (content, download, upload)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'source_type'
    ) THEN
        ALTER TABLE documents ADD COLUMN source_type VARCHAR(20);
        
        -- Mevcut kayıtları güncelle (storage_path varsa download, content_text varsa content)
        UPDATE documents SET source_type = 
            CASE 
                WHEN storage_path IS NOT NULL AND storage_path != '' THEN 'download'
                WHEN content_text IS NOT NULL AND content_text != '' THEN 'content'
                ELSE 'upload'
            END
        WHERE source_type IS NULL;
    END IF;
END $$;

-- source_url kolonu
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'source_url'
    ) THEN
        ALTER TABLE documents ADD COLUMN source_url TEXT;
    END IF;
END $$;

-- storage_path kolonu
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'storage_path'
    ) THEN
        ALTER TABLE documents ADD COLUMN storage_path TEXT;
    END IF;
END $$;

-- storage_url kolonu
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'storage_url'
    ) THEN
        ALTER TABLE documents ADD COLUMN storage_url TEXT;
    END IF;
END $$;

-- doc_type kolonu
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'doc_type'
    ) THEN
        ALTER TABLE documents ADD COLUMN doc_type VARCHAR(50);
    END IF;
END $$;

-- is_extracted kolonu (ZIP'ten çıkarıldı mı)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'is_extracted'
    ) THEN
        ALTER TABLE documents ADD COLUMN is_extracted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- parent_doc_id kolonu (ZIP parent referansı)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'parent_doc_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN parent_doc_id INTEGER REFERENCES documents(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Tenders tablosu eksik kolonları
-- =============================================================================

-- document_links kolonu (JSONB)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenders' AND column_name = 'document_links'
    ) THEN
        ALTER TABLE tenders ADD COLUMN document_links JSONB DEFAULT '{}';
    END IF;
END $$;

-- category_id kolonu
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenders' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE tenders ADD COLUMN category_id INTEGER;
    END IF;
END $$;

-- category_name kolonu
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenders' AND column_name = 'category_name'
    ) THEN
        ALTER TABLE tenders ADD COLUMN category_name VARCHAR(100);
    END IF;
END $$;

-- raw_data kolonu (scraper'dan gelen ham veri)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenders' AND column_name = 'raw_data'
    ) THEN
        ALTER TABLE tenders ADD COLUMN raw_data JSONB;
    END IF;
END $$;

-- 3. set_updated_at_timestamp fonksiyonu
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger'lar
-- =============================================================================

-- Tenders için updated_at trigger
DROP TRIGGER IF EXISTS trigger_tenders_updated_at ON tenders;
CREATE TRIGGER trigger_tenders_updated_at
    BEFORE UPDATE ON tenders
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at_timestamp();

-- Documents için updated_at trigger (eğer yoksa)
DROP TRIGGER IF EXISTS trigger_documents_updated_at ON documents;
CREATE TRIGGER trigger_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at_timestamp();

-- 5. Indexler
-- =============================================================================

-- Documents indeksleri
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_tender_source ON documents(tender_id, source_type);
CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_doc_id) WHERE parent_doc_id IS NOT NULL;

-- Tenders indeksleri
CREATE INDEX IF NOT EXISTS idx_tenders_category_id ON tenders(category_id);
CREATE INDEX IF NOT EXISTS idx_tenders_document_links ON tenders USING GIN(document_links);

-- 6. Unique constraint güncelleme
-- =============================================================================

-- Documents için unique constraint (tender_id, original_filename)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'documents_tender_id_original_filename_key'
    ) THEN
        -- Önce duplicate'leri temizle
        DELETE FROM documents a USING documents b
        WHERE a.id < b.id 
        AND a.tender_id = b.tender_id 
        AND a.original_filename = b.original_filename
        AND a.tender_id IS NOT NULL;
        
        -- Sonra constraint ekle
        ALTER TABLE documents 
        ADD CONSTRAINT documents_tender_id_original_filename_key 
        UNIQUE (tender_id, original_filename);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        NULL; -- Constraint zaten var
    WHEN unique_violation THEN
        RAISE NOTICE 'Duplicate kayıtlar var, constraint eklenemedi. Manuel temizlik gerekli.';
END $$;

-- =============================================================================
-- Migration tamamlandı
-- =============================================================================

COMMENT ON COLUMN documents.source_type IS 'Döküman kaynağı: content (site içeriği), download (indirilen), upload (kullanıcı yükledi)';
COMMENT ON COLUMN documents.source_url IS 'Orijinal indirme URL''i';
COMMENT ON COLUMN documents.storage_path IS 'Supabase Storage dosya yolu';
COMMENT ON COLUMN documents.storage_url IS 'Supabase Storage public URL';
COMMENT ON COLUMN documents.doc_type IS 'Döküman tipi: tech_spec, admin_spec, announcement vb.';
COMMENT ON COLUMN documents.is_extracted IS 'ZIP/RAR''dan çıkarıldı mı?';
COMMENT ON COLUMN documents.parent_doc_id IS 'ZIP/RAR parent döküman ID''si';
COMMENT ON COLUMN tenders.document_links IS 'İhale döküman linkleri (JSON)';
COMMENT ON COLUMN tenders.category_id IS 'ihalebul.com kategori ID''si';
COMMENT ON COLUMN tenders.category_name IS 'Kategori adı';
